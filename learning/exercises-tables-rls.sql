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
begin
  foreach t in array array['exercises_middle','exercises_elementary'] loop
    if to_regclass('public.'||t) is null then
      raise notice 'public.% does not exist; skipped', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
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

-- Refuse to finish if a guest or learner could still read a solution or answer.
do $$
declare
  leak text;
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
end $$;

commit;
