-- Additive, isolated curated hints for Ramzi. Existing exercise and learning tables are untouched.
-- Apply only after release approval, then run learning/ramzi-hints-seed.sql.
-- Reapplying this transaction resets stale public/table/column grants too.
-- Visitors read only rows marked 'verified', with the publishable key, and only the
-- exercise id, the three hints and their immutable source-revision bindings.
-- Review notes stay with the dashboard. Hints only:
-- full solutions and final answers never go in this table.
begin;
create table if not exists public.noam_ramzi_hints (
 exercise_id text primary key check (exercise_id ~ '^G[1-9]-T[0-9]{2}-[ABE]-Q[0-9]{2}[א-ת]?$'),
 hint_1 text not null check (char_length(hint_1) between 1 and 600),
 hint_2 text not null check (char_length(hint_2) between 1 and 600),
 hint_3 text not null check (char_length(hint_3) between 1 and 600),
 source_pdf_hash text not null check (source_pdf_hash ~ '^[a-f0-9]{32}$'),
 source_native_sha256 text check (source_native_sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'review' check (status in ('verified','review')),
 source text not null check (char_length(source) between 1 and 80),
 source_id text not null check (char_length(source_id) between 1 and 40),
 source_exercise_text text check (char_length(source_exercise_text)<=2000),
 review_note text check (char_length(review_note)<=1000),
 updated_at timestamptz not null default now()
);
alter table public.noam_ramzi_hints enable row level security;
revoke all on public.noam_ramzi_hints from public, anon, authenticated;
do $$ declare columns text; begin
 select string_agg(quote_ident(attname), ',' order by attnum) into columns
 from pg_attribute where attrelid='public.noam_ramzi_hints'::regclass and attnum>0 and not attisdropped;
 execute format('revoke all (%s) on public.noam_ramzi_hints from public, anon, authenticated',columns);
end $$;
grant select (exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256) on public.noam_ramzi_hints to anon, authenticated;
grant select,insert,update,delete on public.noam_ramzi_hints to service_role;
drop policy if exists ramzi_hints_verified_read on public.noam_ramzi_hints;
create policy ramzi_hints_verified_read on public.noam_ramzi_hints for select to anon, authenticated using (status='verified');
create or replace function public.noam_ramzi_hints_timestamp() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function public.noam_ramzi_hints_timestamp() from public,anon,authenticated;
drop trigger if exists ramzi_hints_timestamp on public.noam_ramzi_hints;
create trigger ramzi_hints_timestamp before insert or update on public.noam_ramzi_hints for each row execute function public.noam_ramzi_hints_timestamp();
comment on table public.noam_ramzi_hints is 'Curated three-step hints per worksheet part, keyed by the viewer exercise id. Only verified rows reach Ramzi. No solutions, answers or student data.';
do $$ declare visitor text; c record; begin
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
 end loop;
 -- An extra permissive visitor read policy could expose review rows even with
 -- the correct column grants. Do not silently remove an unreviewed policy.
 if exists (select 1 from pg_policy where polrelid='public.noam_ramzi_hints'::regclass
   and polname<>'ramzi_hints_verified_read' and polcmd in ('r','*')
   and exists (select 1 from unnest(polroles) as policy_role
     where case when policy_role=0 then true else
       pg_has_role('anon',policy_role,'USAGE') or pg_has_role('authenticated',policy_role,'USAGE') end)) then
  raise exception 'Unreviewed visitor read policy on noam_ramzi_hints';
 end if;
end $$;
commit;
