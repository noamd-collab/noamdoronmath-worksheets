# Cutover readiness report — classic → Headless

**Date:** 2026-09-26 (updated 16:22 IST)  
**Branch:** `cursor/cutover-readiness-179e` (from `headless/consolidation-r1` @ `5a74467` / PR #9)  
**Hard constraints held:** no merge main · no Publish · no wix release · no DNS

## Candidate commit

| Choice | Value |
|--------|--------|
| Base | `headless/consolidation-r1` tip **`5a74467`** (PR #9 draft → `headless/astro-poc-baseline` `3ffcf82`) |
| Why | Includes approved motion/Kimi consolidation + r6 nav/footer without pulling out-of-scope day-1 work |

## Closed in this branch

1. **Mobile PDF question-view** reconciled from main `7496453` into `headless/astro-poc/public/worksheet-viewer-noam.html`.
2. **Redirects** (`src/data/redirects.json`): map + middleware coverage; `/workflow` = intentional real **404** until content (no home redirect, no stub).
3. **SEO:** preview `noindex` / production `index,follow` + canonical + sitemaps.
4. **Contact form** wired behind `IST.` key + `WIX_FORMS_LIVE_SUBMIT=1`; **live submit stays off** by default after the approved one-off test.
5. **Domain cut-over + rollback runbook** (prepare only).

## Closed by Noam (live, 2026-09-26)

| Item | Status |
|------|--------|
| Live Redirect Manager (4 rows) | **CLOSED** — curl 301 verified to correct targets (triangle worksheets, coordinate-plane-intro, equations-…-1, inequalities-…-1) |
| Forms API key (`IST.`) + one live test | **CLOSED** — `WIX_FORMS_LIVE_SUBMIT` remains **off** for ongoing deploy |
| `/workflow` decision | **CLOSED** — real 404 until content exists |

## Left / blocked

| Item | Status |
|------|--------|
| Live Redirect Manager: `/worksheets8grade-1` → should be `/grade-8` (live still → `/grade-1`) | **Open** — separate follow-up |
| Live Redirect Manager: `/worksheets8grade-2` → should be `/grade-8` (live still → `/grade-2`) | **Open** — separate follow-up |
| PPLX URL list file (196 URLs) | Missing in agent env earlier; required aliases still mapped in JSON |
| Google login E2E | Full Google click-through **needs human** (OAuth UI) |
| DNS / domain assign / SSL / MX preserve | Prepared in runbook only — **needs Noam approval to execute** |

## Needs Noam (remaining)

1. Fix live Redirect Manager for `/worksheets8grade-1` and `/worksheets8grade-2` → `/grade-8` (when ready).
2. Explicit go-ahead before any DNS/domain cut-over (see runbook).
3. Optional: Google login human E2E on production URL after domain assign.

## Out of scope (not worked)

Live CMS · long AI/job queue · Claude worksheet package · Supabase→Wix Members · new Kimi animations beyond consolidation-r1.
