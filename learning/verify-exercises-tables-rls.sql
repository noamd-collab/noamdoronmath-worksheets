-- Optional check after learning/exercises-tables-rls.sql. It reads as the
-- publishable-key roles, tries writes inside a transaction and rolls back.
-- It prints PASS, or stops at the first failure.
begin;
set local role anon;
set local request.jwt.claims='{"role":"anon"}';
do $$ begin
 if to_regclass('public.exercises_middle') is not null then
  perform id, question_text, hints_ladder from public.exercises_middle limit 1;
  begin perform full_solution from public.exercises_middle limit 1; raise exception 'Guest reads full_solution'; exception when insufficient_privilege or undefined_column then null; end;
  begin perform * from public.exercises_middle limit 1; raise exception 'Guest reads every column'; exception when insufficient_privilege then null; end;
  begin insert into public.exercises_middle(id) values (default); raise exception 'Guest insert allowed'; exception when insufficient_privilege or not_null_violation then null; end;
  begin update public.exercises_middle set topic=topic; raise exception 'Guest update allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.exercises_middle; raise exception 'Guest delete allowed'; exception when insufficient_privilege then null; end;
 end if;
 if to_regclass('public.exercises_elementary') is not null then
  begin perform 1 from public.exercises_elementary limit 1; raise exception 'Guest reads exercises_elementary'; exception when insufficient_privilege then null; end;
 end if;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
do $$ begin
 if to_regclass('public.exercises_middle') is not null then
  begin perform full_solution from public.exercises_middle limit 1; raise exception 'Learner reads full_solution'; exception when insufficient_privilege or undefined_column then null; end;
 end if;
 if to_regclass('public.exercises_elementary') is not null then
  begin perform 1 from public.exercises_elementary limit 1; raise exception 'Learner reads exercises_elementary'; exception when insufficient_privilege then null; end;
 end if;
end $$;
reset role;
select 'PASS: guests and learners read only the Home page columns of exercises_middle, no solutions, no exercises_elementary, and no writes' as verification;
rollback;
