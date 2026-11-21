-- Private REVIEW drafts keep automatedChecksPassed=false. Match the server's
-- readiness predicate without changing owner identity, Google requirements,
-- job/quota state, upload rights, or access to any other Storage bucket.
begin;

create function public.noam_teacher_generation_draft_downloadable(document jsonb)
returns boolean
language sql immutable security invoker set search_path='' as $$
  select case
    when document is null or pg_catalog.jsonb_typeof(document) is distinct from 'object' then false
    when document->'automatedChecksPassed'='true'::jsonb then
      case
        -- Retain historical PASS records that predate explicit check arrays.
        when not (document ? 'checks') then true
        when pg_catalog.jsonb_typeof(document->'checks')='array' then
          not exists(select 1 from pg_catalog.jsonb_array_elements(document->'checks') c
                     where c->>'status' is distinct from 'PASS')
        else false
      end
    when document->'automatedChecksPassed'='false'::jsonb
      and document->>'authoringProfile'='general-skill-source/v1'
      and document->'renderingChecksPassed'='true'::jsonb
      and document->'humanReviewRequired'='true'::jsonb then
      case when pg_catalog.jsonb_typeof(document->'checks')='array' then
        pg_catalog.jsonb_array_length(document->'checks')>0
        and not exists(select 1 from pg_catalog.jsonb_array_elements(document->'checks') c
                       where coalesce(c->>'status','') not in ('PASS','REVIEW'))
      else false end
    else false
  end;
$$;
revoke all on function public.noam_teacher_generation_draft_downloadable(jsonb) from public,anon,authenticated;
grant execute on function public.noam_teacher_generation_draft_downloadable(jsonb) to authenticated;
comment on function public.noam_teacher_generation_draft_downloadable(jsonb) is
  'Pure JSON readiness predicate for owner-only downloads; REVIEW is not an automated PASS. No data access or elevated privileges.';

alter policy generation_owner_download on storage.objects using (
  bucket_id='teacher-generation-private'
  and (select auth.uid())='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (select auth.jwt()->'app_metadata'->>'provider')='google'
  and split_part(name,'/',1)=(select auth.uid())::text
  and exists(select 1 from public.noam_teacher_generation_jobs j
    where j.id::text=split_part(name,'/',2) and j.owner_id=(select auth.uid()) and j.status='needs_review'
      and public.noam_teacher_generation_draft_downloadable(j.result)
      and name in (j.owner_id::text||'/'||j.id::text||'/sheet.pdf',j.owner_id::text||'/'||j.id::text||'/sheet.docx'))
);
alter policy generation_private_read_boundary on storage.objects using (
  bucket_id<>'teacher-generation-private' or (
    (select auth.uid())='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
    and (select auth.jwt()->'app_metadata'->>'provider')='google'
    and exists(select 1 from public.noam_teacher_generation_jobs j
      where j.owner_id=(select auth.uid()) and j.status='needs_review'
        and public.noam_teacher_generation_draft_downloadable(j.result)
        and name in (j.owner_id::text||'/'||j.id::text||'/sheet.pdf',j.owner_id::text||'/'||j.id::text||'/sheet.docx'))
  )
);
commit;
