-- Paid teacher access. A Grow transaction grants a time-boxed entitlement; the
-- site never trusts the browser redirect, only a server-to-server call that
-- carries the shared grant secret. Install this file with the secret unset:
-- grant() raises GRANT_SECRET_MISSING until an operator inserts one.
begin;

create schema noam_teacher_access;
revoke all on schema noam_teacher_access from public, anon, authenticated, service_role;
-- The schema is reachable so the public wrappers can call into it, but no table
-- privilege is granted to a client role; only the functions below are callable.
grant usage on schema noam_teacher_access to anon, authenticated, service_role;

-- One row per paid transaction. payment_id is the idempotency key: a retried
-- webhook returns the same entitlement instead of extending it twice.
create table noam_teacher_access.entitlements (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique check (length(payment_id) between 6 and 128),
  email text not null check (email = lower(email) and position('@' in email) > 1 and length(email) <= 254),
  user_id uuid references auth.users(id) on delete set null,
  plan text not null check (plan in ('monthly','yearly')),
  days integer not null check (days in (30,365)),
  amount_agorot integer not null check (amount_agorot > 0),
  status text not null default 'active' check (status in ('active','refunded','cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check ((plan = 'monthly' and days = 30) or (plan = 'yearly' and days = 365))
);
create index entitlements_active_email on noam_teacher_access.entitlements (lower(email))
  where status = 'active';
create index entitlements_active_user on noam_teacher_access.entitlements (user_id)
  where status = 'active';
create index entitlements_expiry on noam_teacher_access.entitlements (expires_at desc);

-- The secret is written once by an operator and never read by a client. The
-- table has no policies and no grants, so only the security-definer functions
-- below can see it.
create table noam_teacher_access.grant_secret (
  singleton boolean primary key default true check (singleton),
  secret text not null check (length(secret) >= 32),
  rotated_at timestamptz not null default now()
);
revoke all on all tables in schema noam_teacher_access from public, anon, authenticated, service_role;

alter table noam_teacher_access.entitlements enable row level security;
alter table noam_teacher_access.grant_secret enable row level security;

create function noam_teacher_access.secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.secret = p_secret from noam_teacher_access.grant_secret s where s.singleton),
    false)
$$;
revoke all on function noam_teacher_access.secret_ok(text) from public, anon, authenticated, service_role;

-- Grant is the only writer. It refuses an unknown plan, a mismatched price and
-- a missing secret, and it never extends an existing payment_id.
create function noam_teacher_access.grant(
  p_secret text, p_payment_id text, p_email text,
  p_plan text, p_days integer, p_amount_agorot integer
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  expected_days integer;
  expected_amount integer;
  expires timestamptz;
begin
  if not exists (select 1 from noam_teacher_access.grant_secret where singleton) then
    raise exception using errcode = '42501', message = 'GRANT_SECRET_MISSING';
  end if;
  if not noam_teacher_access.secret_ok(p_secret) then
    raise exception using errcode = '42501', message = 'GRANT_SECRET_INVALID';
  end if;
  if p_plan = 'monthly' then
    expected_days := 30; expected_amount := 1800;
  elsif p_plan = 'yearly' then
    expected_days := 365; expected_amount := 18000;
  else
    raise exception using errcode = '22023', message = 'PLAN_UNKNOWN';
  end if;
  if p_days is distinct from expected_days or p_amount_agorot is distinct from expected_amount then
    raise exception using errcode = '22023', message = 'PLAN_TERMS_MISMATCH';
  end if;
  if p_payment_id is null or length(p_payment_id) < 6 or length(p_payment_id) > 128 then
    raise exception using errcode = '22023', message = 'PAYMENT_ID_INVALID';
  end if;
  if p_email is null or length(p_email) > 254 or position('@' in p_email) < 2 then
    raise exception using errcode = '22023', message = 'EMAIL_INVALID';
  end if;

  insert into noam_teacher_access.entitlements
    (payment_id, email, plan, days, amount_agorot, starts_at, expires_at)
  values
    (p_payment_id, lower(trim(p_email)), p_plan, p_days, p_amount_agorot,
     statement_timestamp(), statement_timestamp() + make_interval(days => p_days))
  on conflict (payment_id) do nothing
  returning expires_at into expires;

  if expires is null then
    select e.expires_at into expires
      from noam_teacher_access.entitlements e where e.payment_id = p_payment_id;
    return jsonb_build_object('granted', false, 'duplicate', true, 'expiresAt', expires);
  end if;
  return jsonb_build_object('granted', true, 'duplicate', false, 'expiresAt', expires);
end $$;
revoke all on function noam_teacher_access.grant(text,text,text,text,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function noam_teacher_access.grant(text,text,text,text,integer,integer)
  to anon, authenticated, service_role;

-- A refund or a cancellation revokes access immediately; the row stays for the
-- accountant and for the seven-year retention.
create function noam_teacher_access.revoke(p_secret text, p_payment_id text, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare changed integer;
begin
  if not noam_teacher_access.secret_ok(p_secret) then
    raise exception using errcode = '42501', message = 'GRANT_SECRET_INVALID';
  end if;
  if p_reason is null or p_reason not in ('refunded','cancelled') then
    raise exception using errcode = '22023', message = 'REASON_INVALID';
  end if;
  update noam_teacher_access.entitlements
     set status = p_reason
   where payment_id = p_payment_id and status = 'active';
  get diagnostics changed = row_count;
  return jsonb_build_object('revoked', changed = 1, 'reason', p_reason);
end $$;
revoke all on function noam_teacher_access.revoke(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function noam_teacher_access.revoke(text,text,text)
  to anon, authenticated, service_role;

-- Reads the caller's own entitlement. An unbound row still counts, so a buyer
-- sees access on the first sign-in, before bind_self runs.
create function noam_teacher_access.self_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  chosen record;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'SIGN_IN_REQUIRED';
  end if;
  select e.plan, e.expires_at into chosen
    from noam_teacher_access.entitlements e
   where e.status = 'active'
     and e.expires_at > statement_timestamp()
     and (e.user_id = actor or (e.user_id is null and lower(e.email) = mail))
   order by e.expires_at desc
   limit 1;
  return jsonb_build_object(
    'active', chosen.expires_at is not null,
    'plan', chosen.plan,
    'expiresAt', chosen.expires_at);
end $$;
revoke all on function noam_teacher_access.self_status() from public, anon, authenticated, service_role;
grant execute on function noam_teacher_access.self_status() to authenticated, service_role;

-- Binds a paid row to the Google account that just signed in. Only a confirmed
-- Google identity can bind, and only rows that still carry no user_id.
create function noam_teacher_access.bind_self() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if actor is null
     or coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'false'
     or auth.jwt() -> 'app_metadata' ->> 'provider' is distinct from 'google' then
    raise exception using errcode = '42501', message = 'SIGN_IN_REQUIRED';
  end if;
  if mail = '' then
    raise exception using errcode = '42501', message = 'EMAIL_MISSING';
  end if;
  update noam_teacher_access.entitlements
     set user_id = actor
   where user_id is null
     and lower(email) = mail
     and status = 'active'
     and expires_at > statement_timestamp();
  return noam_teacher_access.self_status();
end $$;
revoke all on function noam_teacher_access.bind_self() from public, anon, authenticated, service_role;
grant execute on function noam_teacher_access.bind_self() to authenticated, service_role;

-- Public RPC wrappers, because the REST API only exposes the public schema.
create function public.noam_teacher_access_grant(
  p_secret text, p_payment_id text, p_email text,
  p_plan text, p_days integer, p_amount_agorot integer
) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select noam_teacher_access.grant(p_secret, p_payment_id, p_email, p_plan, p_days, p_amount_agorot)
$$;
revoke all on function public.noam_teacher_access_grant(text,text,text,text,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.noam_teacher_access_grant(text,text,text,text,integer,integer)
  to anon, authenticated, service_role;

create function public.noam_teacher_access_revoke(p_secret text, p_payment_id text, p_reason text)
returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select noam_teacher_access.revoke(p_secret, p_payment_id, p_reason)
$$;
revoke all on function public.noam_teacher_access_revoke(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.noam_teacher_access_revoke(text,text,text)
  to anon, authenticated, service_role;

create function public.noam_teacher_access_status() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select noam_teacher_access.self_status()
$$;
revoke all on function public.noam_teacher_access_status() from public, anon, authenticated, service_role;
grant execute on function public.noam_teacher_access_status() to authenticated, service_role;

create function public.noam_teacher_access_bind() returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select noam_teacher_access.bind_self()
$$;
revoke all on function public.noam_teacher_access_bind() from public, anon, authenticated, service_role;
grant execute on function public.noam_teacher_access_bind() to authenticated, service_role;

commit;
