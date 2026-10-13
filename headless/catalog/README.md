# Headless catalog contract (Phase 0)

Deterministic, machine-readable export of the worksheet catalog for a **future** Headless frontend.

## Source of truth

**`index.html` remains authoritative.** Production catalog behavior is unchanged. This directory does **not** cut over the live site, does not start Next.js, and does not make Wix CMS the source of truth.

| Live SoT (do not bypass) | Generated contract |
|---|---|
| `index.html` → `DATA`, `SEARCH_TERMS`, `BASE`, `VIEWER`, `ICONS`, `NOAM_PREFIX_FALLBACK`, `TRACK_GROUPS`, `LEVELS`, `GRADE_*` | `catalog.v1.json` |

`noam-learning-catalog.js` is a **separate** generated artifact (learning progress IDs). It is not this contract and must not be treated as the new SoT.

## What `catalog.v1.json` is for

- Give a future Next.js (or other) app a stable JSON shape without scraping HTML.
- Preserve enough fields to reproduce **current** catalog behavior: grades, groups, topics, levels, PDF media IDs, search terms, Noam prefixes, track grouping, and `sheetHref` routing inputs.
- Keep URLs **derived**: store `config.pdfBase` + per-level `pdfId` (32-hex), not hundreds of full PDF URLs.

## Files

| File | Role |
|---|---|
| `catalog.v1.json` | Generated catalog document (`contractVersion: 1`) |
| `catalog.schema.json` | Documented contract: required / optional / generated / legacy-specific |
| `README.md` | This file |

## Regenerate

From the repo root (Node built-ins only — no new npm deps):

```bash
node scripts/export-headless-catalog.cjs
```

Check that the committed JSON still matches `index.html`:

```bash
node scripts/export-headless-catalog.cjs --check
```

Dry-run (stats only, no write):

```bash
node scripts/export-headless-catalog.cjs --dry-run
```

Shared logic lives in `scripts/lib/headless-catalog.cjs`.

## Validate

Parity + integrity (also covered by automated tests):

```bash
node --test tests/headless-catalog-contract.test.cjs
```

Still run the existing production safeguard before any catalog publish:

```bash
node tools/validate.js index.html
```

The headless export **reads** `index.html`; it does not replace `tools/validate.js`.

## Contract highlights

- **Grades / labels** — `grades[].grade`, `grades[].label` (+ emoji from `GRADE_EMOJI`).
- **Groups** — `key`, `label` (from `name`), `reducedProgram` when key ∈ `TRACK_GROUPS`.
- **Topics** — `id`, `title` (`t`), optional `description` (`d`) / `note` (`n`), `group`, `icon`, optional `parent`, optional `noamTopicId` (`x`).
- **Levels** — `a` / `b` / `c` / `one` with `pdfId` and resolved display `label`. The catalog level id for a single-sheet row stays `one` (do not rename to `b`).
- **Routing** — `topics[].routing` mirrors `noamTopicPrefix` + `sheetHref` gating (derived; see schema `x-field-classification.sheetHref-recipe`). Viewer links are used only when the viewer is enabled, a Noam prefix resolves (`x` or `NOAM_PREFIX_FALLBACK`), and the grade is middle school (7–9); otherwise the href is a direct PDF (`pdfBase` + `pdfId` + `.pdf`). For viewer-routed `one` rows, production `levelLinksHTML` calls `sheetHref(..., "b", row.one, ...)` so the query param is `lv=b` while the catalog level key remains `one`.
- **Search** — `searchTerms` mirrors `SEARCH_TERMS`.
- **Icons** — full `ICONS` map keyed by topic `icon`.

## No production cutover

- Do not point Wix iframes at this JSON.
- Do not delete or rewrite PDF hex IDs.
- Do not modify `index.html` as part of regenerating this contract.
- When `DATA` (or related declarations) change in `index.html`, regenerate and commit `catalog.v1.json` in the same change set once this contract is adopted in workflow.
