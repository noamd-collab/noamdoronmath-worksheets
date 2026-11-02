# Worksheets republished with their final answers — 2 November 2026

Noam asked for a final-answers page on every live grade 7–9 worksheet PDF that lacked one. **401 of the 404 live sheets without answers** were republished. The remaining three are G8-T65 (הוכחות בחפיפת משולשים, levels א׳, ב׳ and מצוינות). G8-T65 never had an answer key: no package, manifest or earlier delivery contains one. Its key is being written separately and will ship in a later PR.

## What changed in each PDF

- **The question pages were not changed.** Each new PDF starts with the same question pages as the sheet that is live now, followed by the final-answers pages of that sheet's verified delivery.
- Those answer pages were written and checked when the package was built. They were copied as they are, with one exception: on 120 sheets the first answer page carried a teacher-facing subtitle (such as "מפתח פרטי…" or "מפתח למורה…"). Noam approved removing it, and it is gone. No other text was added, removed or moved.
- The page-count footer on the question pages reads "עמוד i מתוך N", where N is the new total. That footer comes from the verified delivery, which already counted its answer pages.

## Verification

All results below come from one run per check on the files that were uploaded. The full per-sheet evidence is kept outside the public repository, under `worksheet-work/claude-final-answers-evidence-20261102/`, and listed by file name at the end of this document.

1. **Question pages: text and drawings.** On every question page, each text line (digits included) and each drawing primitive (its type and rectangle) matches the live sheet. The bottom 40 pt footer band is excluded. Result: 401/401 (`build_report.json`, `questions_identical`).
2. **Answer pages: text.** The answer text in the new PDF is the delivery's answer text, as a multiset of lines, minus only the removed subtitle lines. No teacher-only wording is left. Result: 401/401 (`answers_intact`, `private_words_left`).
3. **Display identity, render-level.** All 6,153 pages (5,240 question pages and 913 answer pages) were rendered at 72 dpi in grey. Each question page was compared with the live sheet and each answer page with the verified delivery. Only three kinds of difference are allowed:
   - the page-count footer, whose text may differ only in the total;
   - the removed subtitle lines;
   - rendering rounding of at most 2/255 grey, which comes from the re-serialized content stream.

   Every other pixel is equal on 392 sheets. On the other 9 sheets, 1 to 34 pixels differ by more than 2/255 on a few pages. On those pages the text lines and their positions match to 0.01 pt, so this is sub-pixel glyph rasterization. The largest cases (G8-T22 c p3, G8-T62 b p13, G9-T31 b p12) were inspected visually and print the same characters. Result: 401/401 (`pixelcheck2.json`).

   Under the skill's production rule, this display identity is what allows the earlier visual and mathematical review of each answer page to be reused instead of repeated.
4. **Mathematical review of the keys, reused.** Each chosen key is the key of a verified delivery, and the earlier review records were located (`evidence.json`, `evidence_class`):
   - 326 sheets: the package folder holds the level folder whose `sheet.pdf` is the chosen PDF (matched by SHA-256 or text) and its review records (REVIEW / SOLVED-BEFORE-KEY / independent reviews);
   - 4 sheets: package review records, no level folder;
   - 34 sheets: the 18-package handoff index records the SHA-256 of exactly this verified copy;
   - 29 sheets: batch 02/03 "ready" folders, whose eye-check report states that every package passed independent review and repair;
   - 8 sheets: release-readiness candidates with topic-level independent reviews.

   For the last 37 sheets the review records apply at batch or topic level; they are not bound to the exact file by a hash.
5. **Skill checkers.** The skill's three level checkers (`verify_export.py`, `selfcheck_noam_package.py`, `check_didactic.py`, skill 7.0.3-noam / engine 6.18-noam) were run once on the level folder behind each key where one exists (`checkers.json`). On the 332 level folders: `verify_export` and `selfcheck_noam_package` report zero errors on all 332. `check_didactic` gives PASS on 149, REVIEW only (no FAIL) on 182 and one FAIL: G7-T03 b, D12 q3g. The checker flags that the expression behind q3g's answer, (−1) · 46, is already printed as part q3c. The question appears to reuse it on purpose, but that needs a human decision. It concerns the question pages, which this PR does not touch, so it is reported to Noam and left open. The other 69 sheets come from deliveries that kept only the PDF, so the checkers have no level folder to read; for them the evidence is items 1–4.
6. **Sheets with more than one answer version (24).** Where several deliveries of the same sheet had different answer pages, the chosen key is the latest verified delivery (`variant-decisions.json`). For 10 sheets this replaced an earlier pick:
   - 8 sheets now use the verified copy in the 18-package "ready" folder instead of an older handoff input or work copy: G7-T23 a/b, G8-T09 a, G8-T15 a, G8-T30 a, G9-T09 a/b, G9-T31 a;
   - G7-T30 c uses the key after the C14b key repair; the independent audit of 2 November confirmed that this version corrects the older one;
   - G8-T33 b uses the verified repair of 16 October.

## Site changes

- 401 new manifests (`noam-ai/manifests/<new id>.json`, mirrored in `public/`). Each equals the original manifest except for three fields: `pdfHash`, `pageCount` and the new `questionPagesIdenticalTo: [<old id>]`. The old manifests stay, so old links keep working.
- The catalog, search index, site guide, teacher indexes, the legacy index and the site-companion catalog point at the new PDFs. Each old PDF id redirects to its replacement through `catalog-migrations`.
- Ramzi hints: `noam-curated-hints.js` accepts a hint row bound to the original PDF when the manifest lists that PDF in `questionPagesIdenticalTo`. `noam-source-panels.js` keeps approved source crops on the original PDF. Hints therefore work before and after the Supabase rebind.
- `learning/ramzi-hints.json`, the seed SQL and the review ledger bind the 30,229 affected rows to the new PDF ids; the hint text is unchanged. `learning/ramzi-hints-rebind-final-answers-20261102.sql` applies the same rebind to production. It is guarded by the bank fingerprint before (`608051e5…`) and after (`a14e5ecc…`).
- `sync-provenance.json` was regenerated by the sync script itself in an isolated copy. `npm run check:static` passes (426 manifests). The check also failed on the untouched baseline (a stale hash for 043606cd…); the regeneration fixes that too.

## Not done in this PR

- G8-T65 answers (separate PR).
- Applying the Supabase rebind SQL needs database access. Until it is applied, hints load through the alias.
- The Wix Velo backend copy of the site catalog (`DEPLOY_WIX/backend/noam-site-catalog.js`) needs its own deploy.

## Evidence files

In `worksheet-work/claude-final-answers-evidence-20261102/`:

| File | Contents |
|---|---|
| `fullmatch.json` | how each live sheet was matched to its delivery |
| `build_report.json` | per-sheet build checks |
| `pixelcheck2.json` | render-level identity |
| `evidence.json` | key source, SHA-256, package, level folder and review records |
| `checkers.json` | skill checker results |
| `variant-decisions.json`, `keyconflict.json` | sheets with several answer versions |
| `swap.json`, `wixmap.txt` | old to new PDF ids |
| `scripts/` | the scripts that produced all of the above |
