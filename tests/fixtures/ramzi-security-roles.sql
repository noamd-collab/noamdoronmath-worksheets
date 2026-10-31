-- Synthetic local fixture only. Never run this on the production project.
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.exercises_middle (
 id text primary key,
 subject text,
 topic text,
 question_text text,
 theory text,
 trick_identification text,
 hints_ladder jsonb,
 full_solution text,
 private_review text
);
create table public.exercises_elementary (like public.exercises_middle including all);
insert into public.exercises_middle values
 ('synthetic','math','topic','question','theory','hint','[]','synthetic private solution','private maintainer note');
insert into public.exercises_elementary select * from public.exercises_middle;
grant all on public.exercises_middle,public.exercises_elementary to public,anon,authenticated,service_role;
-- These independent column grants survive a table-only REVOKE.
grant select(private_review) on public.exercises_middle to anon;
grant insert(full_solution) on public.exercises_middle to authenticated;
grant update(question_text) on public.exercises_middle to public;
