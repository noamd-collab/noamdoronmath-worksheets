# Ramzi curated hints from Supabase — updated 31 October 2026

Ramzi can show pre-written hints (three per worksheet part) from Supabase instead of generating them with AI. A hint reaches students only after it has been checked against the real printed part and marked `verified`.

## Current runtime contract (31 October)

1. `public.noam_ramzi_hints` is the existing Claude PR302 catalogue, with one added reviewed row for `G9-T39-E-Q03ב`. There are now 501 rows: 416 verified, 85 review. This is coverage of selected worksheet parts, not a complete bank for every site question.
2. Every row is bound to its current manifest's immutable `source_pdf_hash`. Where the manifest pins native JSON, `source_native_sha256` must also match. The builder refuses unresolved or stale bindings. Reused T32/T40 IDs are resolved only to the exact canonical owner with matching topic and printed task; a T40 page cannot consume T32 hints.
3. `noam-curated-hints.js` prefetches the public rows when the manifest is loaded. RLS exposes verified rows only; column grants expose only the exercise ID, three hint texts and the two source-binding fields. Status, review notes and bank context remain private to privileged maintainers. Visitors cannot write.
4. All three standard hint buttons read only this bound catalogue. They never start image analysis, a model, the former source-probe shortcut, answer repair or an automatic drawing. The reply is shown immediately after the bounded catalogue read. A thread pins one complete ladder so revisions cannot mix.
5. A missing, review, stale, malformed or failed catalogue result gives an unavailable/retry state and keeps the exact hint number. It does **not** fall back to AI. Student attachments and drafts remain intact.
6. Flash remains available for additional student questions through the existing protected request flow. reCAPTCHA is unchanged. No Max choice, route or fallback is introduced.
7. **הבנתי** answers locally, does not increment the hint counter, and does not call AI. **לא הבנתי** may request the next prepared hint through the same catalogue-only flow.

No complete solutions or final answers are added. The new q3b row asks about the common side, conditionally refers to the congruence requested in part a, then asks which congruence theorem fits the given diagonals, common side and justified included angles. It does not treat the requested angle equality as a given.

## Database and release order

The current Noam task authorizes completing and publishing this integration; the former manual-only run note is superseded by that instruction.

1. Review and pin the exact schema/seed/UI commit, run focused and full checks, and obtain the required Opus5.5 medium review.
2. Publish backend PR29's seven-column `getExercisesMiddle` projection before changing the older exercise-table grants. Its code is backward compatible with both permission states.
3. Apply `learning/ramzi-hints-schema.sql` transactionally, then `learning/ramzi-hints-seed.sql`; verify 416 verified and 85 review rows, exact target ladder and public grants/hidden review rows. Record SQL file hashes and readback evidence.
4. Apply the reviewed `learning/exercises-tables-rls.sql` only after the backend publish succeeds. It enables RLS and removes public solution-column access while preserving the Home projection and service-role access. Verify the actual grants and approved reads/denied writes afterwards.
5. Merge the website integration PR against baseline, publish via `tools/release/release.sh` using the existing workflow, verify live asset bytes, all three q3b hints and their timings, then an additional Flash question. Record public catalogue requests separately from provider requests.

Future catalogue content updates require review against the exact source revision. A `review` row remains hidden until the content and its source binding are reviewed. A running thread must not silently mix old and new ladders.

## The October 2026 banks

The original PR302 bank contained 500 rows from two Zero-Spoiler v2.1 banks plus ten PDF additions (415 verified, 85 review). PR309 added G9-T39-E-Q03ב making it 501 rows (416 verified, 85 review). On 31 October 2026, all 85 review rows were audited and rewritten according to Noam's Zero-Spoiler rules and promoted to verified, and all 42 remaining sub-questions of the Trapezoid Excellence worksheet (G9-T39-E) were added and verified. The catalog now holds 543 rows, all 543 verified (0 in review).

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

By grade, `verified`: ז׳ 141 of 157, ח׳ 125 of 177, ט׳ 68 of 84. With the 72 kept rows and the 10 PDF rows, the original bank had **415 `verified`** and **85 `review`** rows. The added q3b ladder brings the current bank to **416 `verified`**, with **85 `review`** unchanged.

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
- The original PR302 SQL files were run on a local PostgreSQL 16 with Supabase-style `anon` and `authenticated` roles. The seed ran twice without errors, the publishable-key role saw only the 415 `verified` rows and only their ID and hints, and the RLS check printed `PASS`.
