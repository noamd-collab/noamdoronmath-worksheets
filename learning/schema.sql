-- Additive, isolated learning state. Existing exercise tables are untouched.
create table public.noam_learning_worksheets (
 worksheet_id text primary key check (worksheet_id ~ '^g[1-9]-t[0-9]+-(a|b|c|one)$')
);
alter table public.noam_learning_worksheets enable row level security;
revoke all on public.noam_learning_worksheets from anon, authenticated;
grant select on public.noam_learning_worksheets to authenticated;
create policy learning_catalog_read on public.noam_learning_worksheets for select to authenticated using (true);
create table public.noam_learning_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 worksheet_id text not null references public.noam_learning_worksheets(worksheet_id),
 status text not null check(status in ('started','completed','review')),
 updated_at timestamptz not null default now(),
 primary key(user_id,worksheet_id)
);
alter table public.noam_learning_progress enable row level security;
revoke all on public.noam_learning_progress from anon, authenticated;
grant select,insert,update,delete on public.noam_learning_progress to authenticated;
create policy learning_own_select on public.noam_learning_progress for select to authenticated using ((select auth.uid())=user_id);
create policy learning_own_insert on public.noam_learning_progress for insert to authenticated with check ((select auth.uid())=user_id);
create policy learning_own_update on public.noam_learning_progress for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy learning_own_delete on public.noam_learning_progress for delete to authenticated using ((select auth.uid())=user_id);
create function public.noam_learning_timestamp() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function public.noam_learning_timestamp() from public,anon,authenticated;
create trigger learning_timestamp before insert or update on public.noam_learning_progress for each row execute function public.noam_learning_timestamp();
comment on table public.noam_learning_progress is 'Optional learner-reported worksheet status. Not assessment scores. No guest records or free-text student data.';
