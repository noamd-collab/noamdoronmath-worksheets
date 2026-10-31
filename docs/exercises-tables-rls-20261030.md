# Locking the older exercise tables — 30 October 2026

On 30 October, Codex found that `public.exercises_middle` and `public.exercises_elementary` had row-level security off, and that the publishable key (role `anon`) could read `full_solution`. The publishable key is public: it is in `noam-learning-config.js` and in every browser that opens the site. The confirmed problem was public solution-column read access; public write access should not be inferred from default grants.

## Current state — read-only check on 31 October

The earlier release already applied the original protection. Live metadata and the read-only verification script now confirm:

- RLS is enabled on both exercise tables and `noam_ramzi_hints`.
- `anon` and `authenticated` can read exactly the seven Home columns of `exercises_middle`, and no columns of `exercises_elementary`.
- Both visitor roles are denied `full_solution`, all other private exercise columns, and writes. `service_role` retains solution access.
- The hints table exposes exactly the ID, three hints and two source bindings, and only verified rows. Review context and notes are denied publicly. No related public view or ordinary function referencing the exercise/hints tables was found.

No production permissions or data were changed for this follow-up PR. Its SQL remains pending approval.

## Who reads these tables

A search of this repository (`main` and `headless/astro-poc-baseline`) and of `noamd-collab/my-site-2` found one reader:

- `my-site-2/src/backend/aModule.jsw` → `getExercisesMiddle` reads `exercises_middle?select=*` with the publishable key. `src/pages/Home.c1dmp.js` shows the rows in a repeater and uses `id`, `subject`, `topic`, `question_text`, `theory`, `trick_identification` and `hints_ladder`. Because it is a web module, every column, `full_solution` included, also reaches the browser.

Nothing reads `exercises_elementary` with the publishable key. `askTutor` is a disabled stub. Edge functions use `service_role`, which bypasses row-level security.

## What `learning/exercises-tables-rls.sql` does

1. It turns on row-level security on both tables and revokes table and column privileges from `PUBLIC`, `anon` and `authenticated`.
2. On `exercises_middle` it grants `select` only on the seven columns the Home page shows, with a read policy for `anon` and `authenticated`.
3. It grants nothing on `exercises_elementary`.
4. It checks the exact public projection and refuses to commit if any private column, column write or table-level privilege remains. This also detects access inherited through an unexpected role.

`service_role` keeps full access. The script skips a table that does not exist, and it can be run again.

A table-level `REVOKE` does not remove an independent column grant. Resetting both is necessary for a repeat run to repair a stale grant on a private column. See [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).

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
4. Run `learning/verify-exercises-tables-rls.sql`. It uses a read-only transaction, checks both visitor roles and service access, exercises allowed/denied reads without returning exercise values, then rolls back. Write denial is checked from effective table and column grants rather than by accepting an unrelated constraint error from an attempted insert.

If step 1 shows that a column in the list is missing, the script reports it and grants the others.

## Tested

The scripts were run on a local PostgreSQL 16, with Supabase-style `anon`, `authenticated` and `service_role` roles and copies of both tables in their current open state.

- **Before:** `anon` read `full_solution`.
- **After:**
  - `anon` reads the seven columns, which is the query `getExercisesMiddle` will send.
  - `anon` is refused `full_solution`, `select *`, any write, and all of `exercises_elementary`.
  - `service_role` still reads everything.
- **Repeat run and missing table:** a second run changed nothing, a missing table was skipped, and the check printed `PASS` both times.

## Follow-up regression checks — 31 October

`tools/security/verify-rls-postgres.mjs` runs an in-memory PostgreSQL instance with synthetic fixtures only. The external pinned test dependency is not part of the site or its package files:

```bash
npm install --prefix /tmp/noam-rls-tests --no-audit --no-fund @electric-sql/pglite@0.5.14
NOAM_PGLITE_MODULE=/tmp/noam-rls-tests/node_modules/@electric-sql/pglite/dist/index.js node --test tools/security/verify-rls-postgres.mjs
```

Seven checks pass: public and stale column grants are removed; repeated repair preserves Home/service access; column-only insert privileges are detected; inherited private access aborts; the hint schema can be reapplied and resets stale grants; direct or inherited extra hint-read policies abort; and an absent elementary table is skipped. Hint verification also checks the exact public columns, no writes, hidden review rows and private trigger-function access.

The production exercise verification was run read-only and passed. The synthetic hint/write fixtures were run only in the in-memory database. Security advisors no longer report disabled RLS on the exercise tables. Their separate warnings for a publicly executable event-trigger function and disabled leaked-password protection are outside this solution-column change and have not been modified.
