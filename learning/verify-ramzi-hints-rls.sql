begin;
-- Check effective permissions, including PUBLIC and inherited-role grants.
do $$ declare visitor text; c record; begin
 if not (select relrowsecurity from pg_class where oid='public.noam_ramzi_hints'::regclass) then
  raise exception 'RLS is disabled on noam_ramzi_hints';
 end if;
 foreach visitor in array array['anon','authenticated'] loop
  if has_table_privilege(visitor,'public.noam_ramzi_hints','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
   raise exception 'Unexpected table privileges for % on noam_ramzi_hints',visitor;
  end if;
  for c in select attname from pg_attribute where attrelid='public.noam_ramzi_hints'::regclass and attnum>0 and not attisdropped loop
   if has_column_privilege(visitor,'public.noam_ramzi_hints',c.attname,'SELECT')
      <> (c.attname=any(array['exercise_id','hint_1','hint_2','hint_3','source_pdf_hash','source_native_sha256']))
     or has_column_privilege(visitor,'public.noam_ramzi_hints',c.attname,'INSERT,UPDATE,REFERENCES') then
    raise exception 'Unexpected column privileges for % on noam_ramzi_hints.%',visitor,c.attname;
   end if;
  end loop;
  if has_function_privilege(visitor,'public.noam_ramzi_hints_timestamp()','EXECUTE') then
   raise exception 'Visitor may call the maintenance trigger function';
  end if;
 end loop;
end $$;
insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,status,source,source_id,source_pdf_hash,source_native_sha256) values
 ('G9-T99-A-Q01א','רמז א','רמז ב','רמז ג','verified','rls-test','rls-1',repeat('a',32),repeat('b',64)),
 ('G9-T99-A-Q01ב','רמז א','רמז ב','רמז ג','review','rls-test','rls-2',repeat('a',32),null);
do $$ begin
 begin
  insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id,source_pdf_hash) values ('G9-T99-C-Q01א','א','ב','ג','rls-test','rls-3',repeat('a',32));
  raise exception 'Level C allowed';
 exception when check_violation then null; end;
 begin
  insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,status,source,source_id,source_pdf_hash) values ('G9-T99-A-Q02א','א','ב','ג','live','rls-test','rls-4',repeat('a',32));
  raise exception 'Invalid status allowed';
 exception when check_violation then null; end;
 begin
  insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id,source_pdf_hash) values ('G9-T99-A-Q04א','א','ב','ג','rls-test','rls-6',null);
  raise exception 'Missing PDF binding allowed';
 exception when not_null_violation then null; end;
 begin
  insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id,source_pdf_hash) values ('G9-T99-A-Q04א','א','ב','ג','rls-test','rls-6','bad');
  raise exception 'Malformed PDF binding allowed';
 exception when check_violation then null; end;
 begin
  insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id,source_pdf_hash,source_native_sha256) values ('G9-T99-A-Q04א','א','ב','ג','rls-test','rls-6',repeat('a',32),'bad');
  raise exception 'Malformed native binding allowed';
 exception when check_violation then null; end;
end $$;
set local role service_role;
do $$ begin
 if (select count(*) from public.noam_ramzi_hints where exercise_id like 'G9-T99-%')<>2 then raise exception 'Service role cannot read all maintenance rows'; end if;
 insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id,source_pdf_hash) values ('G9-T99-A-Q05א','א','ב','ג','rls-test','rls-7',repeat('c',32));
 update public.noam_ramzi_hints set hint_1='תחזוקה' where exercise_id='G9-T99-A-Q05א';
 if (select hint_1 from public.noam_ramzi_hints where exercise_id='G9-T99-A-Q05א')<>'תחזוקה' then raise exception 'Service role update failed'; end if;
 delete from public.noam_ramzi_hints where exercise_id='G9-T99-A-Q05א';
end $$;
reset role;
set local role anon;
set local request.jwt.claims='{"role":"anon"}';
do $$ declare n integer; begin
 if (select count(*) from public.noam_ramzi_hints where exercise_id like 'G9-T99-%')<>1 then raise exception 'Guest sees unverified rows'; end if;
 if (select hint_3 from public.noam_ramzi_hints where exercise_id='G9-T99-A-Q01א')<>'רמז ג' then raise exception 'Guest cannot read hints'; end if;
 if (select source_pdf_hash from public.noam_ramzi_hints where exercise_id='G9-T99-A-Q01א')<>repeat('a',32) then raise exception 'Guest cannot read PDF binding'; end if;
 if (select source_native_sha256 from public.noam_ramzi_hints where exercise_id='G9-T99-A-Q01א')<>repeat('b',64) then raise exception 'Guest cannot read native binding'; end if;
 begin perform review_note from public.noam_ramzi_hints;raise exception 'Guest reads review notes';exception when insufficient_privilege then null;end;
 begin perform status from public.noam_ramzi_hints;raise exception 'Guest reads status';exception when insufficient_privilege then null;end;
 begin perform source from public.noam_ramzi_hints;raise exception 'Guest reads source';exception when insufficient_privilege then null;end;
 begin perform source_id from public.noam_ramzi_hints;raise exception 'Guest reads source id';exception when insufficient_privilege then null;end;
 begin perform source_exercise_text from public.noam_ramzi_hints;raise exception 'Guest reads exercise text';exception when insufficient_privilege then null;end;
 begin perform updated_at from public.noam_ramzi_hints;raise exception 'Guest reads timestamp';exception when insufficient_privilege then null;end;
 begin insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,source,source_id,source_pdf_hash) values ('G9-T99-A-Q03א','א','ב','ג','rls-test','rls-5',repeat('a',32));raise exception 'Guest insert allowed';exception when insufficient_privilege then null;end;
 begin update public.noam_ramzi_hints set hint_1='x' where exercise_id like 'G9-T99-%';raise exception 'Guest update allowed';exception when insufficient_privilege then null;end;
 begin delete from public.noam_ramzi_hints where exercise_id like 'G9-T99-%';raise exception 'Guest delete allowed';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
do $$ begin
 if (select count(*) from public.noam_ramzi_hints where exercise_id like 'G9-T99-%')<>1 then raise exception 'Learner sees unverified rows'; end if;
 begin perform source_exercise_text from public.noam_ramzi_hints;raise exception 'Learner reads bank text';exception when insufficient_privilege then null;end;
 begin update public.noam_ramzi_hints set status='verified' where exercise_id like 'G9-T99-%';raise exception 'Learner update allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: guests and learners read verified hints only, and only the id, three hints and two source bindings; no guest or learner writes; level, status and binding validation; all test rows rolled back' as verification;
rollback;
