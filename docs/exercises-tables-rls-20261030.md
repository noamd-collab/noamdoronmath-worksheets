# Locking the older exercise tables — 30 October 2026

Codex found that `public.exercises_middle` and `public.exercises_elementary` have row-level security off, and that the publishable key (role `anon`) can read `full_solution`. The publishable key is public: it is in `noam-learning-config.js` and in every browser that opens the site. So anyone could read every full solution, and with the default grants also change rows.

## Who reads these tables

A search of this repository (`main` and `headless/astro-poc-baseline`) and of `noamd-collab/my-site-2` found one reader:

- `my-site-2/src/backend/aModule.jsw` → `getExercisesMiddle` reads `exercises_middle?select=*` with the publishable key. `src/pages/Home.c1dmp.js` shows the rows in a repeater and uses `id`, `subject`, `topic`, `question_text`, `theory`, `trick_identification` and `hints_ladder`. Because it is a web module, every column, `full_solution` included, also reaches the browser.

Nothing reads `exercises_elementary` with the publishable key. `askTutor` is a disabled stub. Edge functions use `service_role`, which bypasses row-level security.

## What `learning/exercises-tables-rls.sql` does

1. It turns on row-level security on both tables and revokes every privilege from `anon` and `authenticated`.
2. On `exercises_middle` it grants `select` only on the seven columns the Home page shows, with a read policy for `anon` and `authenticated`.
3. It grants nothing on `exercises_elementary`.
4. It stops and rolls back if any column whose name contains `solution` or `answer` is still readable with the publishable key.

`service_role` keeps full access. The script skips a table that does not exist, and it can be run again.

## Steps for Noam

1. **Look first** (read-only, in the Supabase SQL editor):

   ```sql
   select relname, relrowsecurity from pg_class where relname in ('exercises_middle','exercises_elementary');
   select table_name, column_name from information_schema.columns
    where table_schema='public' and table_name in ('exercises_middle','exercises_elementary')
    order by table_name, ordinal_position;
   ```

2. **Change the Wix backend** so `getExercisesMiddle` asks for those seven columns. The change is in noamd-collab/my-site-2#29. After the script, `select=*` is refused, because the publishable key may no longer read every column. The change works before and after the script, so publish it first. In `my-site-2/src/backend/aModule.jsw`:

   ```js
   // The publishable key reads only these columns (learning/exercises-tables-rls.sql
   // in noamdoronmath-worksheets). full_solution stays server-side.
   const HOME_COLUMNS = 'id,subject,topic,question_text,theory,trick_identification,hints_ladder';
   ```

   and in the fetch URL, replace `select=*` with `select=${HOME_COLUMNS}`.

3. Run `learning/exercises-tables-rls.sql`.
4. Optional: run `learning/verify-exercises-tables-rls.sql`. It prints `PASS` and rolls back.

If step 1 shows that a column in the list is missing, the script reports it and grants the others.

## Tested

The scripts were run on a local PostgreSQL 16, with Supabase-style `anon`, `authenticated` and `service_role` roles and copies of both tables in their current open state.

- **Before:** `anon` read `full_solution`.
- **After:**
  - `anon` reads the seven columns, which is the query `getExercisesMiddle` will send.
  - `anon` is refused `full_solution`, `select *`, any write, and all of `exercises_elementary`.
  - `service_role` still reads everything.
- **Repeat run and missing table:** a second run changed nothing, a missing table was skipped, and the check printed `PASS` both times.
