-- Queue position and a rough wait estimate for the caller's own job (V5-DESIGN §15).
-- The caller receives three numbers about their own job; never a row, an id or a
-- count per teacher. Enqueue, quota, leases and every policy are unchanged.
begin;
-- Fail fast rather than hold every claim, enqueue and poll behind a blocked alter.
set local lock_timeout = '5s';

-- When the worker took the job. Lets the estimate use real run times.
alter table public.noam_teacher_generation_jobs add column started_at timestamptz;
-- Serves the "busy" read below and the claim's expiry sweep. Keyed on a column written once per
-- job: an index on lease_until or updated_at would end heap-only updates for every lease renewal.
create index teacher_generation_running on public.noam_teacher_generation_jobs(started_at) where status='running';

-- Same body as 20261112185430; the claim also records started_at.
create or replace function public.claim_teacher_generation_job() returns setof public.noam_teacher_generation_jobs
language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
  update public.noam_teacher_generation_jobs set status='failed',phase='failed',error_code='WORKER_INTERRUPTED',lease_token=null,lease_until=null,updated_at=now()
    where status='running' and lease_until<now();
  select id into target from public.noam_teacher_generation_jobs
    where status='queued' order by created_at for update skip locked limit 1;
  if target is not null then
    return query update public.noam_teacher_generation_jobs set status='running',phase='authoring',lease_token=gen_random_uuid(),lease_until=now()+interval '20 minutes',started_at=now(),updated_at=now()
      where id=target returning *;
  end if;
end $$;

-- position: 1 is next; 0 once the job runs or has ended.
-- etaSeconds: a queued job waits for the jobs ahead of it and those running now, shared
-- between the live workers, then runs once; a running job has the rest of a typical run.
-- A typical run is the median of the 20 latest finished drafts, or 240 s until five exist.
-- Each run counts as at most the 20-minute lease: updated_at is a last-write time, so a
-- finished row written again later would otherwise look like a run of hours.
create function noam_teacher_trial.self_queue_status(job uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with mine as (
    select j.status, j.created_at, j.id, coalesce(j.started_at, j.updated_at) as started
      from public.noam_teacher_generation_jobs j
     where j.id=job and j.owner_id=auth.uid()
       and (auth.jwt()->'app_metadata'->>'provider')='google'
       and coalesce(auth.jwt()->>'is_anonymous','false')='false'
  ), slots as (
    select greatest(1, count(*))::int as n from public.noam_teacher_generation_workers
     where updated_at > clock_timestamp()-interval '90 seconds'
  ), typical as (
    select coalesce((select percentile_cont(0.5) within group (order by least(1200, extract(epoch from recent.updated_at-recent.started_at)))
                       from (select f.updated_at, f.started_at from public.noam_teacher_generation_jobs f
                              where f.status='needs_review' and f.started_at is not null and f.updated_at>=f.started_at
                              order by f.updated_at desc limit 20) recent
                     having count(*)>=5), 240)::numeric as seconds
  ), ahead as (
    select count(*)::int as n from public.noam_teacher_generation_jobs q, mine
     where mine.status='queued' and q.status='queued' and (q.created_at, q.id) < (mine.created_at, mine.id)
  ), busy as (
    select count(*)::int as n from public.noam_teacher_generation_jobs r
     where r.status='running' and r.lease_until > clock_timestamp()
  )
  select case mine.status
    when 'queued' then jsonb_build_object('status','queued','position',ahead.n+1,
      'etaSeconds', ceil(((ahead.n+least(busy.n,slots.n))::numeric/slots.n+1)*typical.seconds)::int)
    when 'running' then jsonb_build_object('status','running','position',0,
      'etaSeconds', greatest(0, ceil(typical.seconds-extract(epoch from clock_timestamp()-mine.started)))::int)
    else jsonb_build_object('status',mine.status,'position',0,'etaSeconds',0) end
  from mine, slots, typical, ahead, busy
$$;
revoke all on function noam_teacher_trial.self_queue_status(uuid) from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.self_queue_status(uuid) to authenticated;

create function public.noam_teacher_generation_queue_status(p_job uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select noam_teacher_trial.self_queue_status(p_job) $$;
revoke all on function public.noam_teacher_generation_queue_status(uuid) from public, anon, authenticated, service_role;
grant execute on function public.noam_teacher_generation_queue_status(uuid) to authenticated;
comment on function public.noam_teacher_generation_queue_status(uuid) is
  'Queue position and a rough wait estimate for the caller''s own job. Counts only; null for any other job.';
commit;
