begin;

create function public.noam_teacher_created_worksheets()
returns table (id uuid, lesson jsonb, status text, phase text, result jsonb, created_at timestamptz, formats text[])
language sql stable security invoker set search_path='' as $$
  select j.id,
         pg_catalog.jsonb_build_object('topicId', j.lesson->'topicId', 'lastLesson', j.lesson->'lastLesson'),
         j.status, j.phase,
         pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
           'automatedChecksPassed', j.result->'automatedChecksPassed',
           'authoringProfile', j.result->'authoringProfile',
           'renderingChecksPassed', j.result->'renderingChecksPassed',
           'humanReviewRequired', j.result->'humanReviewRequired',
           'checks', j.result->'checks'
         )),
         j.created_at, files.formats
  from public.noam_teacher_generation_jobs as j
  cross join lateral (
    select pg_catalog.array_agg(f.kind order by f.position) as formats
    from (values ('pdf', 1), ('docx', 2)) as f(kind, position)
    where exists (
      select 1 from storage.objects as o
      where o.bucket_id='teacher-generation-private'
        and o.name=j.owner_id::text || '/' || j.id::text || '/sheet.' || f.kind
    )
    having count(*) > 0
  ) as files
  where j.owner_id=(select auth.uid()) and j.status='needs_review'
    and public.noam_teacher_generation_draft_downloadable(j.result)
  order by j.created_at desc, j.id desc
  limit 20;
$$;

revoke all on function public.noam_teacher_created_worksheets() from public, anon, authenticated, service_role;
grant execute on function public.noam_teacher_created_worksheets() to authenticated;
comment on function public.noam_teacher_created_worksheets() is
  'Latest private worksheet drafts with an available PDF or Word file, under the caller''s job and Storage read policies.';

commit;
