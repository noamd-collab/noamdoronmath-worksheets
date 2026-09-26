# Cutover readiness report — classic → Headless

**Date:** 2026-09-26  
**Branch:** `cursor/cutover-readiness-179e` (from `headless/consolidation-r1` @ `5a74467` / PR #9)  
**Hard constraints held:** no merge main · no Publish · no wix release · no DNS · no classic live edits · no real contact send

## Candidate commit

| Choice | Value |
|--------|--------|
| Base | `headless/consolidation-r1` tip **`5a74467`** (PR #9 draft → `headless/astro-poc-baseline` `3ffcf82`) |
| Why | Includes approved motion/Kimi consolidation + r6 nav/footer without pulling out-of-scope day-1 work |

## Closed in this branch

1. **Mobile PDF question-view** reconciled from main `7496453` into `headless/astro-poc/public/worksheet-viewer-noam.html`: `max-height` 96→160, loading status instead of embedding question text, `:not([hidden])` preview rules, `showExercisePreviewFailure`, mobile DPR ternary.
2. **Redirects** (`src/data/redirects.json`):
   - `/triangle-area-grade-7-worksheets` → `/triangle-area-grade-7` (not powers)
   - `/special-triangles-grade-7` → `/special-triangles-grade-7-new`
   - keep `worksheetsfor1th/2th/3th…9thgrade`
   - add `worksheets8grade-1/-2` → `/grade-8`
   - keep `/blank-1`, `/page`→`/terms`, `/high-school-math-1`, coordinate-plane-intro→scale
   - `/workflow` **not** redirected (flagged)
   - ambiguous blog/category/popup listed for Noam
3. **SEO:** `siteSeo.ts` + BaseLayout — preview hosts `noindex`, production `index,follow`, Hebrew defaults (no Astro POC), canonical main domain, real `404.astro` already present, `/sitemap-pages.xml` + `/sitemap-index.xml` (+ existing `/sitemap-blog.xml`).
4. **Contact form wired** for live path behind `IST.` key + `WIX_FORMS_LIVE_SUBMIT=1`; honeypot + errors; **default remains dry-run**; **no real send performed**.
5. **Domain cut-over + rollback runbook** (prepare only): `headless/astro-poc/docs/CUTOVER-DOMAIN-RUNBOOK.md`.

## Left / blocked

| Item | Status |
|------|--------|
| PPLX URL list file `/home/ubuntu/.cursor/projects/workspace/uploads/PPLX_URLS_DEEP_893e.md` | **Missing in this environment** — could not diff all 196 URLs; required aliases from the task were still mapped |
| Live Wix Redirect Manager | Still wrong on production for triangle/equations-1/inequalities-1/coordinate-plane-intro — **Noam must edit** |
| `WIX_FORMS_API_KEY` | Current env value **not** `IST.` · 401 MetaSite — **Noam must create new Forms site API key** |
| Google login E2E | Allowlist for `wglqn3` already present; full Google click-through **needs human** (OAuth UI) |
| DNS / domain assign / SSL / MX preserve | Prepared in runbook only — **needs Noam approval to execute** |

## Needs Noam approval

1. Create new Wix API key (site `36dd9544-…`, Forms only, must start with `IST.`) → `wix env set --key WIX_FORMS_API_KEY --value "$(pbpaste)"`.
2. After key verifies read-only 200: approve one real contact test → set `WIX_FORMS_LIVE_SUBMIT=1`.
3. Edit live Redirect Manager rows (triangle worksheets, equations-1, inequalities-1, coordinate-plane-intro).
4. Decide `/workflow` target (do not auto-home).
5. Explicit go-ahead before any DNS/domain cut-over (see runbook).

## Out of scope (not worked)

Live CMS · long AI/job queue · Claude worksheet package · Supabase→Wix Members · new Kimi animations beyond consolidation-r1.
