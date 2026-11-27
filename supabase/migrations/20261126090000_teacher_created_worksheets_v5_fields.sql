-- The browser shows a worksheet-wire/5 (PDF-only) draft by the same rule as the database (M1,
-- 20261125090000). The history it reads returned only five result fields, which the v5 rule cannot
-- decide from. For a v5 row only, it now also returns authorContract, notRun, the skill name and the
-- artifact kinds (no hash, size or path), and lists the PDF alone as a format. Every other row
-- returns exactly what it returned before (jsonb_strip_nulls drops the new keys for it).
-- Rollback: re-run the function body of 20261122050000_teacher_generation_created_worksheets.sql
-- with "create or replace" inside one transaction.
begin;
set local lock_timeout = '5s';

create or replace function public.noam_teacher_created_worksheets()
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
           'checks', j.result->'checks',
           'authorContract', case when v5.yes then j.result->'authorContract' end,
           'notRun', case when v5.yes then j.result->'notRun' end,
           'skill', case when v5.yes then pg_catalog.jsonb_build_object('name', j.result->'skill'->'name') end,
           'artifacts', case when v5.yes and pg_catalog.jsonb_typeof(j.result->'artifacts')='array' then
             (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', e.value->'kind') order by e.position)
              from pg_catalog.jsonb_array_elements(j.result->'artifacts') with ordinality as e(value, position))
           end
         )),
         j.created_at, files.formats
  from public.noam_teacher_generation_jobs as j
  cross join lateral (select coalesce(j.result->>'authorContract' = 'worksheet-wire/5', false) as yes) as v5
  cross join lateral (
    select pg_catalog.array_agg(f.kind order by f.position) as formats
    from (values ('pdf', 1), ('docx', 2)) as f(kind, position)
    where (not v5.yes or f.kind = 'pdf')
      and exists (
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
  'Latest private worksheet drafts with an available PDF or Word file, under the caller''s job and Storage read policies. A worksheet-wire/5 draft also returns the fields its readiness rule reads, and only its PDF.';

commit;
