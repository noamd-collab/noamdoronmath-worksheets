begin;
insert into auth.users(id,aud,role) values ('00000000-0000-4000-8000-0000000000a1','authenticated','authenticated'),('00000000-0000-4000-8000-0000000000b1','authenticated','authenticated');
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
insert into public.noam_learning_progress(user_id,worksheet_id,status) values ('00000000-0000-4000-8000-0000000000a1','g9-t1-a','started');
update public.noam_learning_progress set status='completed' where worksheet_id='g9-t1-a';
do $$ begin
 if (select count(*) from public.noam_learning_progress where status='completed')<>1 then raise exception 'Own read/update failed'; end if;
 begin
  update public.noam_learning_progress set user_id='00000000-0000-4000-8000-0000000000b1';
  raise exception 'Ownership reassignment was allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.noam_learning_progress values ('00000000-0000-4000-8000-0000000000a1','g9-t1-b','invalid',now());
  raise exception 'Invalid status allowed';
 exception when check_violation then null; end;
end $$;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
do $$ declare n integer; begin
 if (select count(*) from public.noam_learning_progress)<>0 then raise exception 'Other learner visible'; end if;
 update public.noam_learning_progress set status='review' where user_id='00000000-0000-4000-8000-0000000000a1';get diagnostics n=row_count;
 if n<>0 then raise exception 'Other learner writable'; end if;
 delete from public.noam_learning_progress where user_id='00000000-0000-4000-8000-0000000000a1';get diagnostics n=row_count;
 if n<>0 then raise exception 'Other learner deletable'; end if;
 begin
  insert into public.noam_learning_progress(user_id,worksheet_id,status) values ('00000000-0000-4000-8000-0000000000a1','g9-t1-b','started');
  raise exception 'Spoofed owner allowed';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
set local request.jwt.claims='{"role":"anon"}';
do $$ begin
 begin perform * from public.noam_learning_progress;raise exception 'Guest read allowed';exception when insufficient_privilege then null;end;
 begin insert into public.noam_learning_progress(user_id,worksheet_id,status) values ('00000000-0000-4000-8000-0000000000b1','g9-t1-b','started');raise exception 'Guest write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: own read/write; no cross-user read/write/delete; no ownership reassignment; status validation; no guest access; all test rows rolled back' as verification;
rollback;
