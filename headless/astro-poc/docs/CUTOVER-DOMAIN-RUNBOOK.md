# Domain cut-over + rollback runbook (PREPARE ONLY — do not execute)

**Site:** `noamdoronmath.co.il` classic Wix Studio → Headless Astro (`df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46`)  
**Repo:** `noamd-collab/noamdoronmath-worksheets` · `headless/astro-poc`  
**Candidate base:** `headless/consolidation-r1` @ `5a74467` (PR #9)  
**Hard rule:** No DNS / domain / Publish / `wix release` until Noam explicitly approves.

## Preconditions (day-1 cutover)

- [x] PDF CDN fleet OPEN-08 CLOSED (956/956)
- [ ] `WIX_FORMS_API_KEY` = real `IST.` site key for metaSite `36dd9544-…` (Forms only)
- [ ] Noam approves contact live test → then `WIX_FORMS_LIVE_SUBMIT=1`
- [ ] Redirect map merged + live Wix Redirect Manager rows updated by Noam (triangle / equations-1 / inequalities-1 / coordinate-plane-intro)
- [ ] Preview SEO: noindex on `*.wix-site-host.com`; production build uses index + canonical `https://www.noamdoronmath.co.il`
- [ ] Supabase Auth Redirect URL includes **exact** production `https://www.noamdoronmath.co.il/learning.html` (and www variant if used)
- [ ] Google Workspace MX / SPF / DKIM / DMARC / TXT inventory captured **before** any DNS edit

## Cut-over steps (execute only when authorized)

1. Freeze classic content edits.
2. Assign custom domain to Headless Wix site `df6b8141-…` (www + apex).
3. Wait for SSL on www + root.
4. Point DNS A/CNAME/ALIAS per Wix Headless domain instructions **without** touching MX/TXT mail records.
5. Verify: home 200, `/worksheetsfor7thgrade` → `/grade-7` one hop, PDF CDN 200, `/learning.html` Google button, `/aboutus` contact dry-run or approved live, `/sitemap-index.xml` + `/sitemap-blog.xml`.
6. Search Console: submit sitemap-index; spot-check indexed URLs from PPLX list.
7. Keep classic site unpublished/unlinked but recoverable for rollback window (agree duration with Noam).

## Rollback

1. Repoint DNS apex/www back to classic Wix Studio site (`36dd9544-…`) using prior records.
2. Confirm SSL on classic; do **not** change MX/SPF/DKIM/DMARC.
3. Re-enable classic Redirect Manager as source of truth temporarily.
4. Leave Headless preview intact for diagnosis.
5. Document time-to-restore and what failed.

## Explicit non-goals (day-1)

Live CMS/Collections · long AI/job queue · Claude worksheet package · Supabase→Wix Members · new Kimi animations beyond consolidation-r1.
