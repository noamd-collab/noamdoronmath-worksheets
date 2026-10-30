-- Additive, isolated curated hints for Ramzi. Existing exercise and learning tables are untouched.
-- Run once in the Supabase SQL editor, then run learning/ramzi-hints-seed.sql.
-- Visitors read only rows marked 'verified', with the publishable key, and only the
-- exercise id and the three hints. Review notes stay with the dashboard. Hints only:
-- full solutions and final answers never go in this table.
create table public.noam_ramzi_hints (
 exercise_id text primary key check (exercise_id ~ '^G[1-9]-T[0-9]{2}-[ABE]-Q[0-9]{2}[א-ת]?$'),
 hint_1 text not null check (char_length(hint_1) between 1 and 600),
 hint_2 text not null check (char_length(hint_2) between 1 and 600),
 hint_3 text not null check (char_length(hint_3) between 1 and 600),
 status text not null default 'review' check (status in ('verified','review')),
 source text not null check (char_length(source) between 1 and 80),
 source_id text not null check (char_length(source_id) between 1 and 40),
 source_exercise_text text check (char_length(source_exercise_text)<=2000),
 review_note text check (char_length(review_note)<=1000),
 updated_at timestamptz not null default now()
);
alter table public.noam_ramzi_hints enable row level security;
revoke all on public.noam_ramzi_hints from anon, authenticated;
grant select (exercise_id,hint_1,hint_2,hint_3) on public.noam_ramzi_hints to anon, authenticated;
create policy ramzi_hints_verified_read on public.noam_ramzi_hints for select to anon, authenticated using (status='verified');
create function public.noam_ramzi_hints_timestamp() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function public.noam_ramzi_hints_timestamp() from public,anon,authenticated;
create trigger ramzi_hints_timestamp before insert or update on public.noam_ramzi_hints for each row execute function public.noam_ramzi_hints_timestamp();
comment on table public.noam_ramzi_hints is 'Curated three-step hints per worksheet part, keyed by the viewer exercise id. Only verified rows reach Ramzi. No solutions, answers or student data.';
