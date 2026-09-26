# Cutover readiness report — classic → Headless

**Date:** 2026-09-26 (updated 16:33 IST)  
**Branch:** `cursor/cutover-readiness-179e` (from `headless/consolidation-r1` @ `5a74467` / PR #9)  
**Hard constraints held:** no merge main · no Publish · no wix release · no DNS

## Candidate commit

| Choice | Value |
|--------|--------|
| Base | `headless/consolidation-r1` tip **`5a74467`** (PR #9 draft → `headless/astro-poc-baseline` `3ffcf82`) |
| Why | Includes approved motion/Kimi consolidation + r6 nav/footer without pulling out-of-scope day-1 work |

## Closed in this branch

1. **Mobile PDF question-view** reconciled into Headless viewer.
2. **Redirects** map + middleware; `/workflow` = intentional real **404** until content.
3. **SEO:** preview `noindex` / production `index,follow` + canonical + sitemaps.
4. **Contact form** wired; **live submit stays off**.
5. **Domain cut-over + rollback runbook** (prepare only).

## Closed by Noam (live, 2026-09-26)

| Item | Status |
|------|--------|
| Live Redirect Manager (4 + worksheets8grade-1/-2) | **CLOSED** — curl 301 verified |
| Forms API key (`IST.`) + one live test | **CLOSED** — `WIX_FORMS_LIVE_SUBMIT` remains **off** |
| `/workflow` decision | **CLOSED** — real 404 until content exists |

## Needs Noam (remaining)

1. Explicit go-ahead before any DNS/domain cut-over (see runbook).
2. Optional: Google login human E2E on production URL after domain assign.

## Go / no-go (code + live prep)

**Conditional GO** for DNS cut-over once Noam approves — PR #10 content + live redirects + Forms credential are ready; agent must not execute DNS/release/publish.

## Out of scope

Live CMS · long AI/job queue · Claude worksheet package · Supabase→Wix Members · new Kimi animations beyond consolidation-r1.
