---
cursor:
  subagentId: "bc-221ffa4c-f7df-5982-b28f-b07d87cad636"
---

# OPEN-08 — PDF fleet HEAD check (956)

**Date:** 2026-09-25
**Branch:** `cursor/pdf-fleet-head-179e`
**CDN base:** `https://static.wixstatic.com/ugd/d8e7ad_<id>.pdf`
**Method:** HEAD (fallback Range GET if HEAD fails); max **5** concurrent; read-only
**ID source:** `media/arch-100/pdf-ids-956.txt` (= `headless/catalog/catalog.v1.json`, 956 unique)
**Elapsed:** 23.9s
**Production / DNS / PR / app code:** **No**

## Summary

| Metric | Count |
|--------|------:|
| Total IDs | 956 |
| **PASS** (HTTP 200/206 + `application/pdf`, not HTML) | **956** |
| **FAIL** | **0** |

### Status codes

| Status | Count |
|--------|------:|
| 200 | 956 |

### Content-Type (primary)

| Content-Type | Count |
|--------------|------:|
| `application/pdf` | 956 |

## Failures

**None.** All 956 returned PDF Content-Type with success status.

## Artifacts

- Peer CSV: `internal/pdf-fleet-check.csv`
- Peer MD: `internal/pdf-fleet-check.md` (this file)
- Workspace mirror: `/workspace/internal/pdf-fleet-check.csv` + `.md`

## math-tools.json (recommendation only — not implemented)

`src/data/site-pages/math-tools.json` still loads the scientific calculator iframe/links from `noamd-collab.github.io/.../tools/...`. **Recommendation:** leave on GitHub Pages until after domain/Headless cutover sign-off; optionally later copy tools into Headless `public/tools` and point the JSON at same-origin URLs. Not a PDF cutover blocker (tools ≠ worksheet PDF bytes).

## OPEN-08 fleet gate

**Fleet Content-Type gate: PASS** — ready as pre-DNS evidence that CDN hosts all 956 as real PDFs.
