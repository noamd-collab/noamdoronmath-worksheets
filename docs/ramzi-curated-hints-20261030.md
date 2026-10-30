# Ramzi curated hints from Supabase — 30 October 2026

Ramzi can show pre-written hints (three per worksheet part) from Supabase instead of generating them with AI. A hint reaches students only after it has been checked against the real printed part and marked `verified`.

## How it works

1. `learning/ramzi-hints-schema.sql` creates `public.noam_ramzi_hints`. It is a new table. Existing exercise and learning tables are untouched.
2. Each row holds one viewer exercise ID (for example `G7-T01-A-Q01א`), three hints, a `status`, and the bank ID it came from.
3. When a worksheet opens, `noam-curated-hints.js` asks Supabase once for that PDF's rows, with the public publishable key. Row-level security returns only `verified` rows.
4. The hints join the existing didactic guides. **רמז** shows hint 1, 2, 3 in order. **לא הבנתי** opens the next hint with a short soft lead. **הבנתי** never opens a hint: Ramzi asks the student to keep going and points to **רמז**, or says they can move on once all three hints are open. Curated hints are text only: no drawing is added.
5. Parts without a verified row, and any network failure, behave exactly as today (AI hints).

Visitors cannot write to the table, and the public key reads only the exercise ID and the three hints of a `verified` row: not its status, notes or bank text. Changes are made in the Supabase dashboard. A changed hint or status shows up the next time a worksheet is opened; no website deploy is needed.

Full solutions and final answers are **not** stored. The repository is public and the table is readable with the public key, so only hints go in.

## Steps for Noam: the SQL run

Everything runs in the Supabase SQL editor of the project in `noam-learning-config.js` (`ouzquolkeuceektfihss`). An agent does not run them. Run each file whole, in this order:

| # | File | What it does | Expected result |
| --- | --- | --- | --- |
| 1 | `learning/ramzi-hints-schema.sql` | Creates `public.noam_ramzi_hints`, with row-level security and read access for the publishable key to the ID and three hints only. Run it once. | "Success. No rows returned" |
| 2 | `learning/ramzi-hints-seed.sql` | Inserts the 500 rows. It can be run again: it updates existing rows. | "Success. No rows returned" |
| 3 | `learning/verify-ramzi-hints-rls.sql` | Optional. Checks access and rolls back its test rows. | One row starting with `PASS` |
| 4 | Check | `select status, count(*) from public.noam_ramzi_hints group by 1;` | `verified 415`, `review 85` |

Then merge the pull request and publish the website as usual. Until the site is published, the table is not read.

The older exercise tables have their own script, `learning/exercises-tables-rls.sql`. Its steps are in `docs/exercises-tables-rls-20261030.md`: publish the one-line Wix backend change first, then run the script.

To show a row that is still `review`, change its `status` to `verified` in the Table Editor after checking it.

## The October 2026 banks

Two Zero-Spoiler v2.1 banks feed the table, plus ten rows added afterwards: 500 rows in all.

**The 421-part middle-school bank** (157 grade 7, 177 grade 8, 87 grade 9) was written against the printed parts in `noam-ai/native/`, mostly part א of question 1. The builder maps its IDs to live viewer IDs:

- **Level C** is the site's מצוינות level, `E`.
- **Single-level worksheets (`G8-T56..T60`)** have catalog level `B` while their exercise IDs use `A` (`G8-T56-A-Q01א` … `G8-T60-A-Q01א`). The builder and `noam-curated-hints.js` both follow the exercise IDs.
- **`G9-T40` (`A`, `B`, `E`)** is left out (3 rows): in `catalog.v1.json` it points to the same three PDFs as `G9-T32`. The other **418** rows map one-to-one to live exercise IDs.

**72 rows from the first 136-part bank** are kept. Their bank texts did not match the printed parts, so each hint set was matched to the part of the same topic it fits and checked by a student-lens and a teacher-lens reviewer. They sit on parts the new bank does not cover (for example `G7-T01-A-Q34א`). Their `review_note` names the bank ID they came from.

**10 rows added on 30 October** cover worksheets whose question 1 the bank missed: `G8-T65-E`, `G9-T41-A`, `G9-T42-A`, `G9-T43-E`, `G9-T44-A/B/E` and `G9-T45-A/B/E`. Their hints were written from the original PDFs, because these worksheets have no package in `noam-ai/native/`. They were audited the same way against that transcription. `G9-T44-B-Q01א` gives the answer away and is hidden.

Fractions in hints use a horizontal bar (Noam, 18.10.2026): the builder turns a numeric slash fraction such as 1/4 into `$\frac{1}{4}$`, which Ramzi renders with KaTeX.

## Independent audit (30 October 2026)

The bank's own pattern checks (no `=`, no extra numbers, no final answer value) reported no problems in the 418 rows, but such checks miss hints that hand the student the decisive step in words. Every one of the 418 rows was therefore checked by an agent against the printed part in `noam-ai/native/` (the six special worksheets through the viewer's `PACKAGE_ALIASES`). Each problem it found had to be confirmed by two more reviewers, one reading as a student and one as a teacher, before the row was hidden.

| | Rows |
| --- | --- |
| `verified`: fits the part and does not give the answer away | 334 |
| `review`: a hint gives the answer or the decisive result away | 68 |
| `review`: hints fit only partly or contain an error | 11 |
| `review`: both | 5 |
| **Total from the 421-part bank** | **418** (334 `verified`, 84 `review`) |

By grade, `verified`: ז׳ 141 of 157, ח׳ 125 of 177, ט׳ 68 of 84. With the 72 kept rows and the 10 added rows, the table has **415 `verified`** and **85 `review`** rows.

The typical spoiler is hint 2 or 3 reading the values off the graph or table for the student, or naming the theorem or rule the part asks for. Two rows have factual errors: `G8-T10-E-Q01א` (segment times differ from the graph) and `G8-T35-B-Q01א` (values of b and c are swapped).

The hidden rows are listed in `learning/ramzi-hints-audit.json`, each with a one-sentence reason that does not state the answer. To bring one back, rewrite its hints, remove its entry from that file, rebuild, and run the seed again.

## Adding or updating hints

```bash
node tools/ramzi-hints/build-ramzi-hints.cjs <bank.txt> --keep learning/ramzi-hints.json --reviews learning/ramzi-hints-audit.json
node tools/ramzi-hints/build-ramzi-hints.cjs --rows learning/ramzi-hints.json --reviews learning/ramzi-hints-audit.json
```

The first form reads a new bank. `--keep` keeps published rows for parts the bank does not cover, so checked hints are not dropped. The second form rebuilds from the published rows when the bank file is not at hand. Both rewrite `learning/ramzi-hints.json` and `learning/ramzi-hints-seed.sql`, drop solutions and final answers, reject parts that are not in the live worksheet, and apply the audit file. A bank row is `review` unless a review marks it verified. Keep the bank file itself out of the repository, because it contains solutions.

## Tests

- `tests/ramzi-hints-build.test.cjs`: parsing, ID mapping, no solutions in the output, review moves, rebuilding from rows and keeping rows, native package aliases, bar fractions, public column grants, and seed/JSON consistency.
- `headless/astro-poc/tests/ramzi-curated-hints.test.ts`: guide registration, hint order, הבנתי / לא הבנתי, the Supabase request, single-level worksheets, failure fallback and viewer wiring.
- `headless/astro-poc/tests/ramzi-understanding.test.ts`: הבנתי answers locally and never opens a hint or calls the model; לא הבנתי keeps its steps.
- The SQL files were run on a local PostgreSQL 16 with Supabase-style `anon` and `authenticated` roles. The seed ran twice without errors, the publishable-key role saw only the 415 `verified` rows and only their ID and hints, and the RLS check printed `PASS`.
