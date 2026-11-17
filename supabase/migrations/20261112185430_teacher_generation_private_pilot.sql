-- New, isolated owner-only pilot. Does not change normal teacher access or
-- existing profiles, saved documents, learner data, hints, or public worksheets.
begin;
create table public.noam_teacher_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  request_key uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  lesson jsonb not null check (jsonb_typeof(lesson)='object' and octet_length(lesson::text)<=16000),
  status text not null default 'queued' check (status in ('queued','running','needs_review','failed')),
  phase text not null default 'queued' check (phase in ('queued','authoring','checking','rendering','needs_review','failed')),
  result jsonb check (result is null or (jsonb_typeof(result)='object' and octet_length(result::text)<=32000)),
  error_code text check (error_code is null or error_code ~ '^[A-Z_]{1,60}$'),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,request_key),
  check ((status='needs_review') = (result is not null))
);
create index teacher_generation_queue on public.noam_teacher_generation_jobs(created_at) where status='queued';
create index teacher_generation_owner_history on public.noam_teacher_generation_jobs(owner_id,created_at desc);
alter table public.noam_teacher_generation_jobs enable row level security;
revoke all on public.noam_teacher_generation_jobs from public,anon,authenticated;
grant select on public.noam_teacher_generation_jobs to authenticated;
grant all on public.noam_teacher_generation_jobs to service_role;

create policy generation_owner_read on public.noam_teacher_generation_jobs for select to authenticated using (
  owner_id=(select auth.uid()) and owner_id='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (select auth.jwt()->'app_metadata'->>'provider')='google'
);
-- Only the server may enqueue, after owner Auth, same-origin validation and
-- CAPTCHA. Even the owner cannot bypass those gates through the Data API.
-- Serialized quota also applies to a service-role insert.
-- Invoker rights: no elevated function is exposed to the browser.
create function public.noam_teacher_generation_quota() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.owner_id <> '80da2957-9492-4a9d-babb-28ba70dedd12'::uuid then
    raise exception using errcode='42501',message='GENERATION_OWNER_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(1171212,pg_catalog.hashtext(new.owner_id::text));
  if exists(select 1 from public.noam_teacher_generation_jobs where owner_id=new.owner_id and request_key=new.request_key) then
    raise exception using errcode='23505',message='REQUEST_CONFLICT';
  end if;
  if exists(select 1 from public.noam_teacher_generation_jobs where owner_id=new.owner_id and status in ('queued','running'))
    or (select count(*) from public.noam_teacher_generation_jobs where owner_id=new.owner_id and created_at>now()-interval '24 hours')>=5 then
    raise exception using errcode='PT429',message='GENERATION_LIMIT';
  end if;
  return new;
end $$;
revoke all on function public.noam_teacher_generation_quota() from public,anon,authenticated;
create trigger generation_quota before insert on public.noam_teacher_generation_jobs
for each row execute function public.noam_teacher_generation_quota();

create table public.noam_teacher_generation_workers (
  id text primary key check (id='primary'),
  updated_at timestamptz not null default now(),
  capabilities jsonb not null check (jsonb_typeof(capabilities)='object' and octet_length(capabilities::text)<=64000)
);
alter table public.noam_teacher_generation_workers enable row level security;
revoke all on public.noam_teacher_generation_workers from public,anon,authenticated;
grant select on public.noam_teacher_generation_workers to authenticated;
grant all on public.noam_teacher_generation_workers to service_role;
create policy generation_owner_health on public.noam_teacher_generation_workers for select to authenticated using (
  (select auth.uid())='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (select auth.jwt()->'app_metadata'->>'provider')='google'
);

-- Worker-only claim; no automatic retry of an expired paid-model request.
create function public.claim_teacher_generation_job() returns setof public.noam_teacher_generation_jobs
language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
  update public.noam_teacher_generation_jobs set status='failed',phase='failed',error_code='WORKER_INTERRUPTED',lease_token=null,lease_until=null,updated_at=now()
    where status='running' and lease_until<now();
  select id into target from public.noam_teacher_generation_jobs
    where status='queued' order by created_at for update skip locked limit 1;
  if target is not null then
    return query update public.noam_teacher_generation_jobs set status='running',phase='authoring',lease_token=gen_random_uuid(),lease_until=now()+interval '20 minutes',updated_at=now()
      where id=target returning *;
  end if;
end $$;
revoke all on function public.claim_teacher_generation_job() from public,anon,authenticated;
grant execute on function public.claim_teacher_generation_job() to service_role;

-- Private artifacts are never published in Wix or a public bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('teacher-generation-private','teacher-generation-private',false,15728640,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;
do $$ begin
  if not exists(select 1 from storage.buckets where id='teacher-generation-private' and public=false and file_size_limit=15728640
    and cardinality(allowed_mime_types)=2 and allowed_mime_types @> array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then
    raise exception 'GENERATION_BUCKET_CONFIG_CONFLICT';
  end if;
end $$;
create policy generation_owner_download on storage.objects for select to authenticated using (
  bucket_id='teacher-generation-private'
  and (select auth.uid())='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (select auth.jwt()->'app_metadata'->>'provider')='google'
  and split_part(name,'/',1)=(select auth.uid())::text
  and exists(select 1 from public.noam_teacher_generation_jobs j
    where j.id::text=split_part(name,'/',2) and j.owner_id=(select auth.uid()) and j.status='needs_review'
      and j.result->'automatedChecksPassed'='true'::jsonb
      and name in (j.owner_id::text||'/'||j.id::text||'/sheet.pdf',j.owner_id::text||'/'||j.id::text||'/sheet.docx'))
);
-- Existing permissive Storage policies combine with OR. These bucket-scoped
-- restrictive guards keep a broad older policy from exposing or overwriting
-- this pilot, while leaving every other bucket's permissions unchanged.
create policy generation_private_anonymous_read_boundary on storage.objects as restrictive for select to anon
using(bucket_id<>'teacher-generation-private');
create policy generation_private_read_boundary on storage.objects as restrictive for select to authenticated using (
  bucket_id<>'teacher-generation-private' or (
    (select auth.uid())='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
    and (select auth.jwt()->'app_metadata'->>'provider')='google'
    and exists(select 1 from public.noam_teacher_generation_jobs j
      where j.owner_id=(select auth.uid()) and j.status='needs_review' and j.result->'automatedChecksPassed'='true'::jsonb
        and name in (j.owner_id::text||'/'||j.id::text||'/sheet.pdf',j.owner_id::text||'/'||j.id::text||'/sheet.docx'))
  )
);
create policy generation_private_insert_boundary on storage.objects as restrictive for insert to anon,authenticated
with check(bucket_id<>'teacher-generation-private');
create policy generation_private_update_boundary on storage.objects as restrictive for update to anon,authenticated
using(bucket_id<>'teacher-generation-private') with check(bucket_id<>'teacher-generation-private');
create policy generation_private_delete_boundary on storage.objects as restrictive for delete to anon,authenticated
using(bucket_id<>'teacher-generation-private');
commit;
