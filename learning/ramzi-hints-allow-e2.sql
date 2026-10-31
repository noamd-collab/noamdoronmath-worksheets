-- Add the catalogue's existing second excellence level. No data or access grants change.
begin;
do $guard$
declare current_definition text;
begin
 select pg_get_constraintdef(oid) into current_definition from pg_constraint
 where conrelid='public.noam_ramzi_hints'::regclass
 and conname='noam_ramzi_hints_exercise_id_check' and contype='c';
 if current_definition is null or
    (position('^G[1-9]-T[0-9]{2}-[ABE]-Q[0-9]{2}[א-ת]?$' in current_definition)=0
     and position('^G[1-9]-T[0-9]{2}-([ABE]|E2)-Q[0-9]{2}[א-ת]?$' in current_definition)=0) then
   raise exception 'Unexpected existing hint identity constraint; refusing to replace it';
 end if;
end $guard$;
alter table public.noam_ramzi_hints drop constraint noam_ramzi_hints_exercise_id_check;
alter table public.noam_ramzi_hints add constraint noam_ramzi_hints_exercise_id_check
 check (exercise_id ~ '^G[1-9]-T[0-9]{2}-([ABE]|E2)-Q[0-9]{2}[א-ת]?$');
commit;
