# Public teacher trial

The schema migration installs a closed campaign. The owner can continue generating throughout rollout. Trial admission requires a confirmed Google account, fresh actor-isolated worker capabilities and the normal CAPTCHA. The database reserves a maximum of five jobs per Google identity over the entire campaign. A failed job or a terminal draft missing either checked file releases the credit. Returning teachers can retrieve their own successful files after the trial closes.

## Activate once

After the reviewed website and worker are deployed, run the following with the database operator. It opens a 72-hour window at the database clock and refuses to start on a stale or incompatible worker heartbeat. A repeated call preserves the original dates, any operator pause, and every existing reservation.

```sql
begin;
do $$
begin
  if not noam_teacher_trial.worker_ready() then raise exception 'Compatible public trial worker is not ready'; end if;
  insert into noam_teacher_trial.campaign(starts_at,ends_at,enabled)
    select t,t+interval '72 hours',true from (select statement_timestamp() as t) s
    on conflict(singleton) do nothing;
end $$;
commit;
select public.noam_teacher_generation_trial_window();
```

The website displays the stored deadline in Asia/Jerusalem. The database closes admissions at the exact end instant. Existing accepted jobs can finish.

## Pause and resume

```sql
update noam_teacher_trial.campaign set enabled=false where singleton;
```

To resume within the original interval, set `enabled=true` on the same row. Private material, credits already spent and the deadline survive either action.

To check historical or current usage, query aggregate counts in the private reservation ledger using operator access. The public status function reveals only trial availability and dates.
