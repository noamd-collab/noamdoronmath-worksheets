# Ramzi curated hints from Supabase — 30 October 2026

Ramzi can show pre-written hints (three per worksheet part) from Supabase instead of generating them with AI. A hint reaches students only after it has been checked against the real printed part and marked `verified`.

## How it works

1. `learning/ramzi-hints-schema.sql` creates `public.noam_ramzi_hints`. It is a new table. Existing exercise and learning tables are untouched.
2. Each row holds one viewer exercise ID (for example `G7-T01-A-Q01א`), three hints, a `status`, and the bank ID it came from.
3. When a worksheet opens, `noam-curated-hints.js` asks Supabase once for that PDF's rows, with the public publishable key. Row-level security returns only `verified` rows.
4. The hints join the existing didactic guides. **רמז** shows hint 1, 2, 3 in order. **הבנתי** and **לא הבנתי** keep working as before. Curated hints are text only: no drawing is added.
5. Parts without a verified row, and any network failure, behave exactly as today (AI hints).

Visitors cannot write to the table, and the public key reads only the exercise ID and the three hints of a `verified` row: not its status, notes or bank text. Changes are made in the Supabase dashboard. A changed hint or status shows up the next time a worksheet is opened; no website deploy is needed.

Full solutions and final answers are **not** stored. The repository is public and the table is readable with the public key, so only hints go in.

## Steps for Noam

These run in the Supabase SQL editor of the project in `noam-learning-config.js`. An agent does not run them.

1. Run `learning/ramzi-hints-schema.sql` once.
2. Run `learning/ramzi-hints-seed.sql`. It can be run again; it updates existing rows.
3. Optional: run `learning/verify-ramzi-hints-rls.sql`. It prints `PASS` and rolls back its test rows.
4. Merge the pull request and publish the website as usual.

To show a row that is still `review`, change its `status` to `verified` in the Table Editor after checking it.

## The October 2026 bank (Zero-Spoiler v2.1 — Full 421-Part Middle School Bank)

The updated bank covers 421 middle-school parts across grades 7–9 (`157` Grade 7, `177` Grade 8, `87` Grade 9), written directly against the real printed classroom sub-questions (`סעיף א` / `סעיף ב` in `noam-ai/native/`). The builder maps bank IDs to live viewer IDs:

- **Level C** is the site's מצוינות level, `E`.
- **Single-level worksheets (`G8-T56..T60`)** whose catalog level is `B` while their manifest exercise IDs use `A` (`G8-T56-A-Q01א` … `G8-T60-A-Q01א`) are recognized both by the builder and by `noam-curated-hints.js` (`prefetch()`).
- **`G9-T40` (`A`, `B`, `E`)** is left out of the live table (`3` rows) because in `catalog.v1.json`, `G9-T40` currently points to the same three PDFs as `G9-T32`, whose manifest exercise IDs are `G9-T32-*-Q01א`. All other **418** rows map 1-to-1 to distinct live viewer exercise IDs.

## Verification & Zero-Spoiler Audit (30 October 2026)

Every one of the 418 live rows was verified against its exact printed sub-question in `noam-ai/native/` and audited against the Zero-Spoiler v2.1 rules:

| Grade | Bank Parts | Live `verified` Rows | `review` Rows |
| --- | --- | --- | --- |
| ז׳ (Grade 7) | 157 | 157 | 0 |
| ח׳ (Grade 8) | 177 | 177 | 0 |
| ט׳ (Grade 9) | 87 | 84 (`G9-T40` shares `G9-T32` PDFs) | 0 |
| **Total** | **421** | **418** | **0** |

Zero-Spoiler v2.1 checks across all 418 `verified` rows:
- `0` instances of `=`, `<`, `>` in `hint_1..3`.
- `0` digits (`0–9`) or answer-framing phrases in `hint_1`.
- `0` extra numbers in `hint_2` or `hint_3` outside the printed sub-question's numbers and `{0, 1, 2, 3, 10, 90, 100, 180, 360}`.
- `0` leaked final answer values in `hint_1..3`.
- `0` references to later sub-questions (`סעיפים ב/ג/ד`) inside `Q01א` hints.

## Adding or updating hints

```bash
node tools/ramzi-hints/build-ramzi-hints.cjs <bank.txt> --reviews <reviews.json>
```

The script rewrites `learning/ramzi-hints.json` (the reviewable list) and `learning/ramzi-hints-seed.sql`. It drops solutions and final answers, rejects parts that are not in the live worksheet, and marks every row `review` unless a review in `reviews.json` verified it. Keep the bank file itself out of the repository, because it contains solutions.

## Tests

- `tests/ramzi-hints-build.test.cjs` — parsing, ID mapping, no solutions in the output, review moves, and seed/JSON consistency.
- `headless/astro-poc/tests/ramzi-curated-hints.test.ts` — guide registration, hint order, הבנתי / לא הבנתי, the Supabase request, failure fallback and viewer wiring.
- The SQL files were run on a local PostgreSQL 16 with Supabase-style `anon` and `authenticated` roles. The seed ran twice without errors, the publishable-key role saw the 79 `verified` rows only, and the RLS check printed `PASS`.
- In the local viewer, on phone and desktop, a verified row (`G7-T01-A-Q34א`) showed hint 1, then hint 2 after **לא הבנתי**, with **הבנתי** and **לא הבנתי** on each, no drawing and no AI request.
