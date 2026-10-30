# Ramzi curated hints from Supabase — 30 October 2026

Ramzi can show pre-written hints (three per worksheet part) from Supabase instead of generating them with AI. A hint reaches students only after it has been checked against the real printed part and marked `verified`.

## How it works

1. `learning/ramzi-hints-schema.sql` creates `public.noam_ramzi_hints`. It is a new table. Existing exercise and learning tables are untouched.
2. Each row holds one viewer exercise ID (for example `G7-T01-A-Q01א`), three hints, a `status`, and the bank ID it came from.
3. When a worksheet opens, `noam-curated-hints.js` asks Supabase once for that PDF's rows, with the public publishable key. Row-level security returns only `verified` rows.
4. The hints join the existing didactic guides. **רמז** shows hint 1, 2, 3 in order. **הבנתי** and **לא הבנתי** keep working as before. Curated hints are text only: no drawing is added.
5. Parts without a verified row, and any network failure, behave exactly as today (AI hints).

Visitors cannot write to the table. Changes are made in the Supabase dashboard. A changed hint or status shows up the next time a worksheet is opened; no website deploy is needed.

Full solutions and final answers are **not** stored. The repository is public and the table is readable with the public key, so only hints go in.

## Steps for Noam

These run in the Supabase SQL editor of the project in `noam-learning-config.js`. An agent does not run them.

1. Run `learning/ramzi-hints-schema.sql` once.
2. Run `learning/ramzi-hints-seed.sql`. It can be run again; it updates existing rows.
3. Optional: run `learning/verify-ramzi-hints-rls.sql`. It prints `PASS` and rolls back its test rows.
4. Merge the pull request and publish the website as usual.

To show a row that is still `review`, change its `status` to `verified` in the Table Editor after checking it.

## The October 2026 bank (Zero-Spoiler v2.1)

The bank had 136 parts for grades 7–9. The builder maps bank IDs to live viewer IDs:

- **Level C** is the site's מצוינות level, `E`.
- **Grades 8 and 9** number topics by the manifest topic ID, not the site prefix. The topic title decides the prefix, and the number must agree. For example, bank `G8-T04` (יחס ופרופורציה) is site `G8-T24`, and bank `G9-T16` (חוקי חזקות) is site `G9-T01`.
- `G7-T16-A` was left out: that worksheet has one level, whose parts are `G7-T16-B-…`.

The bank's own exercise texts are not the printed exercises, so every hint set was checked against the real part. See the review results below.

## Adding or updating hints

```bash
node tools/ramzi-hints/build-ramzi-hints.cjs <bank.txt> --reviews <reviews.json>
```

The script rewrites `learning/ramzi-hints.json` (the reviewable list) and `learning/ramzi-hints-seed.sql`. It drops solutions and final answers, rejects parts that are not in the live worksheet, and marks every row `review` unless a review in `reviews.json` verified it. Keep the bank file itself out of the repository, because it contains solutions.

## Tests

- `tests/ramzi-hints-build.test.cjs` — parsing, ID mapping, no solutions in the output, review moves, and seed/JSON consistency.
- `headless/astro-poc/tests/ramzi-curated-hints.test.ts` — guide registration, hint order, הבנתי / לא הבנתי, the Supabase request, failure fallback and viewer wiring.
- The SQL files were run on a local PostgreSQL 16 with Supabase-style `anon` and `authenticated` roles.
