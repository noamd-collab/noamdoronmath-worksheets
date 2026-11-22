-- Installs closed. A separate operator action starts the single 72-hour campaign.
begin;
create schema noam_teacher_trial;
revoke all on schema noam_teacher_trial from public, anon, authenticated, service_role;
grant usage on schema noam_teacher_trial to anon, authenticated, service_role;

create table noam_teacher_trial.campaign (
  singleton boolean primary key default true check (singleton),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at = starts_at + interval '72 hours'),
  enabled boolean not null
);
-- Keep spent credits even if old files and job history are purged. Only failure
-- releases a reservation. Google's provider ID is independent of email and sessions.
create table noam_teacher_trial.reservations (
  job_id uuid primary key,
  subject_hash bytea not null
);
create index trial_reservations_subject on noam_teacher_trial.reservations(subject_hash);
revoke all on all tables in schema noam_teacher_trial from public, anon, authenticated, service_role;
grant select on noam_teacher_trial.campaign to service_role;
grant select, insert, delete on noam_teacher_trial.reservations to service_role;

create function noam_teacher_trial.window_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'active', coalesce(c.enabled and statement_timestamp() >= c.starts_at and statement_timestamp() < c.ends_at,false),
    'startsAt', c.starts_at, 'endsAt', c.ends_at)
  from (values (true)) as input(singleton)
  left join noam_teacher_trial.campaign c using(singleton)
$$;
revoke all on function noam_teacher_trial.window_status() from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.window_status() to anon, authenticated, service_role;
create function public.noam_teacher_generation_trial_window() returns jsonb
language sql stable security invoker set search_path='' as $$ select noam_teacher_trial.window_status() $$;
revoke all on function public.noam_teacher_generation_trial_window() from public, anon, authenticated, service_role;
grant execute on function public.noam_teacher_generation_trial_window() to anon, authenticated, service_role;

-- Called with an actor from the server only. An ambiguous or unconfirmed identity
-- cannot spend a credit. No caller receives a provider ID or email.
create function noam_teacher_trial.google_subject(actor uuid) returns bytea
language sql stable strict security definer set search_path='' as $$
  select case when count(*)=1 then sha256(convert_to(min(i.provider_id),'UTF8')) end
    from auth.identities i join auth.users u on u.id=i.user_id
   where u.id=actor and i.provider='google' and nullif(i.provider_id,'') is not null
     and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
     and u.raw_app_meta_data->>'provider'='google'
$$;
revoke all on function noam_teacher_trial.google_subject(uuid) from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.google_subject(uuid) to service_role;

create function noam_teacher_trial.remaining(subject bytea) returns integer
language sql stable strict security invoker set search_path='' as $$
  select greatest(0,5-count(*))::int from noam_teacher_trial.reservations where subject_hash=subject
$$;
revoke all on function noam_teacher_trial.remaining(bytea) from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.remaining(bytea) to service_role;
create function noam_teacher_trial.self_remaining() returns integer
language sql stable security definer set search_path='' as $$
  select noam_teacher_trial.remaining(noam_teacher_trial.google_subject(auth.uid()))
$$;
revoke all on function noam_teacher_trial.self_remaining() from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.self_remaining() to authenticated, service_role;

create or replace function public.noam_teacher_generation_quota_status(p_account_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid; quota int; campaign jsonb; is_owner boolean;
begin
  if p_account_id is not null then
    if current_user not in ('postgres','service_role') then
      raise exception using errcode='42501', message='GENERATION_ACCESS_DENIED';
    end if;
    actor := p_account_id;
  else
    actor := auth.uid();
    if actor is null or (auth.jwt()->'app_metadata'->>'provider') is distinct from 'google'
       or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' then
      raise exception using errcode='42501', message='GENERATION_ACCESS_DENIED';
    end if;
  end if;
  campaign := noam_teacher_trial.window_status();
  is_owner := actor = '80da2957-9492-4a9d-babb-28ba70dedd12'::uuid;
  if not is_owner then
    if p_account_id is null then quota := noam_teacher_trial.self_remaining();
    else quota := noam_teacher_trial.remaining(noam_teacher_trial.google_subject(actor)); end if;
  end if;
  return campaign || jsonb_build_object(
    'mode',case when is_owner then 'owner' else 'trial' end,
    'active',is_owner or (quota is not null and (campaign->>'active')::boolean),
    'totalLimit',case when not is_owner then 5 end,
    'remainingTotal',case when not is_owner then coalesce(quota,0) end)
    -- The site's previous owner-only build expects these three fields during
    -- the closed installation or a website rollback. No regular trial resets daily.
    || case when is_owner then jsonb_build_object('dailyLimit',null,'remainingToday',null,
         'resetsAt',(select resets_at from public.noam_teacher_generation_day_bounds(statement_timestamp())))
       else '{}'::jsonb end;
end $$;

-- Serialize admissions with an operator pause without giving the worker
-- permission to edit the campaign. Cutoff is rechecked after any lock wait.
create function noam_teacher_trial.lock_active_window() returns timestamptz
language sql volatile security definer set search_path='' as $$
  select ends_at from noam_teacher_trial.campaign
    where singleton and enabled and starts_at<=clock_timestamp() for share
$$;
revoke all on function noam_teacher_trial.lock_active_window() from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.lock_active_window() to service_role;

-- The worker uploads both files before marking a job successful. Verify its
-- readiness report and both exact object keys before retaining a trial credit.
create function noam_teacher_trial.complete_pair(actor uuid, job uuid, document jsonb) returns boolean
language sql stable security definer set search_path='' as $$
  select public.noam_teacher_generation_draft_downloadable(document) and
    (select count(*)=2 from storage.objects where bucket_id='teacher-generation-private'
       and name in (actor::text||'/'||job::text||'/sheet.pdf', actor::text||'/'||job::text||'/sheet.docx'))
$$;
revoke all on function noam_teacher_trial.complete_pair(uuid,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.complete_pair(uuid,uuid,jsonb) to service_role;

-- Check the worker again in the transaction that spends the credit. A stale
-- process must never receive a new teacher job during deployment or rollback.
create function noam_teacher_trial.worker_ready() returns boolean
language sql volatile security invoker set search_path='' as $$
  select exists(select 1 from public.noam_teacher_generation_workers
      where id='primary' and updated_at between clock_timestamp()-interval '90 seconds' and clock_timestamp()+interval '10 seconds'
        and capabilities->'trialActorIsolation'='1'::jsonb
        and capabilities->>'profile'='general-skill-source/v1'
        and capabilities->>'curriculumSha256'='57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b'
        and capabilities->'acceptedIntakeVersions' @> '[3]'::jsonb)
$$;
revoke all on function noam_teacher_trial.worker_ready() from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.worker_ready() to service_role;

drop trigger generation_pilot_owner on public.noam_teacher_generation_jobs;
drop function public.noam_teacher_generation_pilot_owner();
create or replace function public.noam_teacher_generation_quota() returns trigger
language plpgsql security invoker set search_path='' as $$
declare subject bytea; until_at timestamptz;
begin
  perform pg_advisory_xact_lock(1171212,hashtext(new.owner_id::text));
  if exists(select 1 from public.noam_teacher_generation_jobs where owner_id=new.owner_id and request_key=new.request_key) then
    raise exception using errcode='23505',message='REQUEST_CONFLICT';
  end if;
  if exists(select 1 from public.noam_teacher_generation_jobs where owner_id=new.owner_id and status in ('queued','running')) then
    raise exception using errcode='PT423',message='GENERATION_ACTIVE';
  end if;
  if new.owner_id='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid then return new; end if;
  subject := noam_teacher_trial.google_subject(new.owner_id);
  if subject is null then raise exception using errcode='42501',message='GENERATION_ACCESS_DENIED'; end if;
  -- Re-linking an authenticated account to the same Google subject must share
  -- both its five slots and the lock used to reserve them.
  perform pg_advisory_xact_lock(1171213,hashtext(encode(subject,'hex')));
  until_at := noam_teacher_trial.lock_active_window();
  if until_at is null or clock_timestamp()>=until_at then
    raise exception using errcode='PT403',message='TRIAL_CLOSED';
  end if;
  if not noam_teacher_trial.worker_ready() then
    raise exception using errcode='PT503',message='TRIAL_WORKER_UNAVAILABLE';
  end if;
  if new.status='needs_review' and not noam_teacher_trial.complete_pair(new.owner_id,new.id,new.result) then
    raise exception using errcode='23514',message='GENERATION_INCOMPLETE_DRAFT';
  end if;
  if new.status<>'failed' then
    if noam_teacher_trial.remaining(subject)=0 then
      raise exception using errcode='PT429',message='GENERATION_LIMIT';
    end if;
    insert into noam_teacher_trial.reservations(job_id,subject_hash) values(new.id,subject);
  end if;
  return new;
end $$;
create function noam_teacher_trial.release_failure() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.status='failed' then
    raise exception using errcode='23514',message='GENERATION_FAILED_TERMINAL';
  end if;
  if new.status='needs_review' and not noam_teacher_trial.complete_pair(new.owner_id,new.id,new.result) then
    new.status := 'failed'; new.phase := 'failed'; new.error_code := 'DRAFT_NOT_AVAILABLE';
    new.result := null; new.lease_token := null; new.lease_until := null;
  end if;
  if new.status='failed' then delete from noam_teacher_trial.reservations where job_id=new.id; end if;
  return new;
end $$;
revoke all on function noam_teacher_trial.release_failure() from public, anon, authenticated, service_role;
create trigger generation_trial_release before update of status on public.noam_teacher_generation_jobs
for each row when (old.status is distinct from new.status and old.owner_id<>'80da2957-9492-4a9d-babb-28ba70dedd12'::uuid)
execute function noam_teacher_trial.release_failure();

-- Authenticated users keep their own history and successful files after the
-- window closes. The API still checks Google Auth, same-origin, and CAPTCHA.
alter policy generation_owner_read on public.noam_teacher_generation_jobs using (
  owner_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (select auth.jwt()->'app_metadata'->>'provider')='google'
);
alter policy generation_owner_health on public.noam_teacher_generation_workers using (
  coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and (select auth.jwt()->'app_metadata'->>'provider')='google'
  and ((select auth.uid())='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid
       or (select (noam_teacher_trial.window_status()->>'active')::boolean))
);
alter policy generation_owner_download on storage.objects using (
  bucket_id='teacher-generation-private'
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
    coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
    and (select auth.jwt()->'app_metadata'->>'provider')='google'
    and exists(select 1 from public.noam_teacher_generation_jobs j
      where j.owner_id=(select auth.uid()) and j.status='needs_review'
        and public.noam_teacher_generation_draft_downloadable(j.result)
        and name in (j.owner_id::text||'/'||j.id::text||'/sheet.pdf',j.owner_id::text||'/'||j.id::text||'/sheet.docx'))
  )
);
commit;
