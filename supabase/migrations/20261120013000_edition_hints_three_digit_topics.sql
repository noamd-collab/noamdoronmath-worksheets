-- Candidate only: not applied to any remote database.
-- Broaden only the edition table's topic-number width. Do not alter rows,
-- legacy hints, review requirements, source bindings, policies or grants.
begin;
do $migration$
declare
  current_definition text;
  old_pattern constant text := '^G[1-9]-T[0-9]{2}-([ABE]|E2)-Q[0-9]{2}[א-ת]?$';
  new_pattern constant text := '^(G[1-9]-T[0-9]{2}|G[7-9]-T[1-9][0-9]{2})-([ABE]|E2)-Q[0-9]{2}[א-ת]?$';
begin
  select pg_get_constraintdef(oid)
    into current_definition
    from pg_constraint
    where conrelid = 'public.noam_worksheet_edition_hints'::regclass
      and conname = 'noam_worksheet_edition_hints_exercise_id_check'
      and contype = 'c';
  if current_definition = format('CHECK ((exercise_id ~ %L::text))', new_pattern) then
    return;
  end if;
  if current_definition is distinct from format('CHECK ((exercise_id ~ %L::text))', old_pattern) then
    raise exception 'Unexpected edition-hints exercise-id constraint; inspect before migration';
  end if;
  alter table public.noam_worksheet_edition_hints
    drop constraint noam_worksheet_edition_hints_exercise_id_check;
  alter table public.noam_worksheet_edition_hints
    add constraint noam_worksheet_edition_hints_exercise_id_check
    check (exercise_id ~ '^(G[1-9]-T[0-9]{2}|G[7-9]-T[1-9][0-9]{2})-([ABE]|E2)-Q[0-9]{2}[א-ת]?$');
end
$migration$;
commit;
