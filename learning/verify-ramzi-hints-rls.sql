begin;
insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,status,source,source_id) values
 ('G9-T99-A-Q01א','רמז א','רמז ב','רמז ג','verified','rls-test','rls-1'),
 ('G9-T99-A-Q01ב','רמז א','רמז ב','רמז ג','review','rls-test','rls-2');
do $$ begin
 begin
  insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id) values ('G9-T99-C-Q01א','א','ב','ג','rls-test','rls-3');
  raise exception 'Level C allowed';
 exception when check_violation then null; end;
 begin
  insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,status,source,source_id) values ('G9-T99-A-Q02א','א','ב','ג','live','rls-test','rls-4');
  raise exception 'Invalid status allowed';
 exception when check_violation then null; end;
end $$;
set local role anon;
set local request.jwt.claims='{"role":"anon"}';
do $$ declare n integer; begin
 if (select count(*) from public.noam_ramzi_hints where source='rls-test')<>1 then raise exception 'Guest sees unverified rows'; end if;
 begin insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id) values ('G9-T99-A-Q03א','א','ב','ג','rls-test','rls-5');raise exception 'Guest insert allowed';exception when insufficient_privilege then null;end;
 begin update public.noam_ramzi_hints set hint_1='x' where source='rls-test';raise exception 'Guest update allowed';exception when insufficient_privilege then null;end;
 begin delete from public.noam_ramzi_hints where source='rls-test';raise exception 'Guest delete allowed';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
do $$ begin
 if (select count(*) from public.noam_ramzi_hints where source='rls-test')<>1 then raise exception 'Learner sees unverified rows'; end if;
 begin update public.noam_ramzi_hints set status='verified' where source='rls-test';raise exception 'Learner update allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: guests and learners read verified hints only; no guest or learner writes; level and status validation; all test rows rolled back' as verification;
rollback;
