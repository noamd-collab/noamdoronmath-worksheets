-- The private pilot continues to admit only its authenticated owner. Keep
-- pilot eligibility independent of count limits so lifting the pilot later
-- cannot accidentally exempt ordinary teacher accounts.
begin;

create function public.noam_teacher_generation_pilot_owner() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.owner_id <> '80da2957-9492-4a9d-babb-28ba70dedd12'::uuid then
    raise exception using errcode='42501', message='GENERATION_OWNER_REQUIRED';
  end if;
  return new;
end $$;

revoke all on function public.noam_teacher_generation_pilot_owner() from public, anon, authenticated;
create trigger generation_pilot_owner before insert on public.noam_teacher_generation_jobs
for each row execute function public.noam_teacher_generation_pilot_owner();

-- Local dates are converted to instants independently on either side of the
-- boundary so the short/long daylight-saving days need no special case.
create function public.noam_teacher_generation_day_bounds(instant timestamptz)
returns table(starts_at timestamptz, resets_at timestamptz)
language sql stable strict security invoker set search_path='' as $$
  select day::timestamp at time zone 'Asia/Jerusalem',
         (day+1)::timestamp at time zone 'Asia/Jerusalem'
    from (select (instant at time zone 'Asia/Jerusalem')::date as day) calendar
$$;
revoke all on function public.noam_teacher_generation_day_bounds(timestamptz) from public, anon;
grant execute on function public.noam_teacher_generation_day_bounds(timestamptz) to authenticated, service_role;

-- The website supplies no parameters, using the caller's authenticated
-- session and existing job RLS. Only the privileged insert trigger needs to
-- query a specific account. This function never elevates the caller's rights.
create function public.noam_teacher_generation_quota_status(p_account_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  actor uuid;
  day_start timestamptz;
  next_midnight timestamptz;
  daily_limit integer;
  remaining integer;
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

  select starts_at, resets_at into day_start, next_midnight
    from public.noam_teacher_generation_day_bounds(statement_timestamp());
  if actor <> '80da2957-9492-4a9d-babb-28ba70dedd12'::uuid then
    daily_limit := 5;
    select greatest(0, daily_limit-count(*))::integer into remaining
      from public.noam_teacher_generation_jobs
      where owner_id=actor and status in ('queued','running','needs_review')
        and created_at>=day_start and created_at<next_midnight;
  end if;
  return jsonb_build_object('dailyLimit',daily_limit,'remainingToday',remaining,'resetsAt',next_midnight);
end $$;
revoke all on function public.noam_teacher_generation_quota_status(uuid) from public, anon;
grant execute on function public.noam_teacher_generation_quota_status(uuid) to authenticated, service_role;

create or replace function public.noam_teacher_generation_quota() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(1171212, pg_catalog.hashtext(new.owner_id::text));

  if exists (select 1 from public.noam_teacher_generation_jobs
             where owner_id=new.owner_id and request_key=new.request_key) then
    raise exception using errcode='23505', message='REQUEST_CONFLICT';
  end if;

  if exists (select 1 from public.noam_teacher_generation_jobs
             where owner_id=new.owner_id and status in ('queued','running')) then
    raise exception using errcode='PT423', message='GENERATION_ACTIVE';
  end if;

  if new.status <> 'failed' and
     (public.noam_teacher_generation_quota_status(new.owner_id)->>'remainingToday')::integer = 0 then
    raise exception using errcode='PT429', message='GENERATION_LIMIT';
  end if;

  return new;
end $$;

commit;
