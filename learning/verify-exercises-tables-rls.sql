-- Read-only verification: no exercise values are returned and no writes are tried.
-- Run after learning/exercises-tables-rls.sql. Any ACL drift raises an error.
begin read only;
do $$
declare
  visitor text;
  t text;
  a record;
  expected boolean;
begin
  foreach visitor in array array['anon','authenticated'] loop
    foreach t in array array['exercises_middle','exercises_elementary'] loop
      if to_regclass('public.'||t) is null then continue; end if;
      if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then
        raise exception 'RLS is disabled on %', t;
      end if;
      if has_table_privilege(visitor,format('public.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'Unexpected table grant for % on %', visitor,t;
      end if;
      for a in select attname from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped loop
        expected := t='exercises_middle' and a.attname=any(array['id','subject','topic','question_text','theory','trick_identification','hints_ladder']);
        if has_column_privilege(visitor,format('public.%I',t),a.attname,'SELECT') <> expected
          or has_column_privilege(visitor,format('public.%I',t),a.attname,'INSERT,UPDATE,REFERENCES') then
          raise exception 'Unexpected column grant for % on %.%',visitor,t,a.attname;
        end if;
      end loop;
    end loop;
  end loop;
  foreach t in array array['exercises_middle','exercises_elementary'] loop
    if to_regclass('public.'||t) is not null
      and not has_column_privilege('service_role',format('public.%I',t),'full_solution','SELECT') then
      raise exception 'Service role lost solution access on %',t;
    end if;
  end loop;
end $$;
set local role anon;
set local request.jwt.claims='{"role":"anon"}';
do $$ begin
 if to_regclass('public.exercises_middle') is not null then
  perform id,subject,topic,question_text,theory,trick_identification,hints_ladder from public.exercises_middle limit 1;
  begin perform full_solution from public.exercises_middle limit 1; raise exception 'Guest reads full_solution'; exception when insufficient_privilege then null; end;
  begin perform * from public.exercises_middle limit 1; raise exception 'Guest reads every column'; exception when insufficient_privilege then null; end;
 end if;
 if to_regclass('public.exercises_elementary') is not null then
  begin perform 1 from public.exercises_elementary limit 1; raise exception 'Guest reads exercises_elementary'; exception when insufficient_privilege then null; end;
 end if;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
do $$ begin
 if to_regclass('public.exercises_middle') is not null then
  perform id,subject,topic,question_text,theory,trick_identification,hints_ladder from public.exercises_middle limit 1;
  begin perform full_solution from public.exercises_middle limit 1; raise exception 'Learner reads full_solution'; exception when insufficient_privilege then null; end;
 end if;
 if to_regclass('public.exercises_elementary') is not null then
  begin perform 1 from public.exercises_elementary limit 1; raise exception 'Learner reads exercises_elementary'; exception when insufficient_privilege then null; end;
 end if;
end $$;
reset role;
select 'PASS: exact Home projection, no private columns, no writes or elementary access, service access preserved' as verification;
rollback;
