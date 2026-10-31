-- Locks down the two older exercise tables, public.exercises_middle and
-- public.exercises_elementary. Codex found on 30 October 2026 that row-level
-- security is off on both and that the publishable key (role anon) can read
-- full_solution.
--
-- Who reads them with the publishable key: only getExercisesMiddle in the Wix
-- backend (my-site-2, src/backend/aModule.jsw), for the Home page repeater. The
-- page uses id, subject, topic, question_text, theory, trick_identification and
-- hints_ladder. No code reads exercises_elementary with the publishable key.
-- service_role (edge functions, dashboard) bypasses row-level security and keeps
-- full access.
--
-- Before running: getExercisesMiddle must ask for those columns instead of
-- select=*, because the publishable key can no longer read every column. That
-- change works before and after this script.
--
-- Run once in the Supabase SQL editor. It can be run again.
begin;

do $$
declare
  t text;
  columns text;
begin
  foreach t in array array['exercises_middle','exercises_elementary'] loop
    if to_regclass('public.'||t) is null then
      raise notice 'public.% does not exist; skipped', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    -- Table-level REVOKE does not remove earlier column-level grants. Reset
    -- those too, including PUBLIC grants inherited by every visitor role.
    select string_agg(quote_ident(a.attname), ',' order by a.attnum)
      into columns from pg_attribute a
      where a.attrelid=to_regclass('public.'||t)
        and a.attnum>0 and not a.attisdropped;
    execute format('revoke all (%s) on public.%I from public, anon, authenticated', columns, t);
  end loop;
end $$;

-- exercises_middle: guests and learners read only the columns the Home page shows.
do $$
declare
  wanted text[] := array['id','subject','topic','question_text','theory','trick_identification','hints_ladder'];
  present text;
  missing text;
begin
  if to_regclass('public.exercises_middle') is null then return; end if;
  select string_agg(quote_ident(c), ',' order by array_position(wanted, c))
    into present
    from unnest(wanted) as c
    where exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='exercises_middle' and column_name=c);
  select string_agg(c, ', ')
    into missing
    from unnest(wanted) as c
    where not exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='exercises_middle' and column_name=c);
  if missing is not null then raise notice 'exercises_middle has no column(s): %', missing; end if;
  if present is null then raise exception 'exercises_middle has none of the expected columns'; end if;
  execute format('grant select (%s) on public.exercises_middle to anon, authenticated', present);
  execute 'drop policy if exists exercises_middle_public_read on public.exercises_middle';
  execute 'create policy exercises_middle_public_read on public.exercises_middle for select to anon, authenticated using (true)';
end $$;

-- Refuse to finish if effective privileges differ from the public projection.
-- This also catches grants inherited through another role, which cannot be
-- repaired by revoking a direct grant from anon/authenticated alone.
do $$
declare
  leak text;
  role_name text;
  t text;
begin
  select string_agg(table_name||'.'||column_name, ', ')
    into leak
    from information_schema.columns
    where table_schema='public'
      and table_name in ('exercises_middle','exercises_elementary')
      and column_name ~* '(solution|answer)'
      and (has_column_privilege('anon', format('public.%I', table_name), column_name, 'SELECT')
        or has_column_privilege('authenticated', format('public.%I', table_name), column_name, 'SELECT'));
  if leak is not null then raise exception 'Still readable with the publishable key: %', leak; end if;
  foreach role_name in array array['anon','authenticated'] loop
    select string_agg(table_name||'.'||column_name, ', ')
      into leak from information_schema.columns
      where table_schema='public'
        and table_name in ('exercises_middle','exercises_elementary')
        and (
          has_column_privilege(role_name, format('public.%I',table_name), column_name, 'SELECT')
            <> (table_name='exercises_middle' and column_name=any(array['id','subject','topic','question_text','theory','trick_identification','hints_ladder']))
          or has_column_privilege(role_name, format('public.%I',table_name), column_name, 'INSERT,UPDATE,REFERENCES')
        );
    if leak is not null then raise exception 'Unexpected column privileges for %: %', role_name, leak; end if;
    foreach t in array array['exercises_middle','exercises_elementary'] loop
      if to_regclass('public.'||t) is null then continue; end if;
      if has_table_privilege(role_name, format('public.%I',t), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'Unexpected table privileges for % on %', role_name, t;
      end if;
    end loop;
  end loop;
end $$;

commit;
