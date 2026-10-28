# Astro POC — worksheet catalog (isolated)

Local **Astro 5 + React** proof of concept under `headless/astro-poc/`.

- Suitable **in principle** for the [Wix-managed Astro path](https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/about-the-astro-integration.md) (docs require **Astro 5**; Astro 6+ not supported for `headless link`).
- **Not** linked to Wix: no `wix init`, no `wix.config.json`, no deploy.
- Catalog data is an **in-repo generated snapshot** at `src/data/catalog.v1.json` (real file, not a sibling symlink).
- Outbound worksheet links = existing public GitHub Pages viewer + Wix Media PDFs (`src/lib/worksheetLinks.ts`).
- **HEADLESS-MIGRATION-11–14:** reversible Headless viewer + learning copy under `public/`. Manifests via `npm run sync:static`. Learning brand → `/`; viewer accepts `back=/learning.html`. Flags: `PUBLIC_USE_HEADLESS_VIEWER`, `HEADLESS_USE_LOCAL_MANIFESTS`.


## Catalog snapshot (packaging)

| File | Role |
|---|---|
| `src/data/catalog.v1.json` | Snapshot copied from authoritative generated catalog — **do not hand-edit** |
| `src/data/catalog.v1.json.sha256` | SHA-256 of the snapshot bytes |
| `src/data/catalog.snapshot.json` | Metadata (`sourcePath`, `sourceSha256`, `generatedAt`) |

```bash
# After the authoritative exporter updates headless/catalog/catalog.v1.json:
npm run refresh:catalog

# CI / local gate — fails if snapshot is a symlink, hash mismatch, or stale vs authority:
npm run check:catalog
```

Authoritative source remains `headless/catalog/catalog.v1.json` (exporter output). This POC never edits it.

## Routes

- `/` — home / catalog shell
- `/worksheets?grade=7` (default when `grade` absent) … `grade=1`–`9`
- Invalid `grade` → explicit error UI (no silent remap)

## Commands (loopback only)

```bash
cd headless/astro-poc
npm install
npm run check:catalog
npm run typecheck
npm test
npm run build
npm run preview   # http://127.0.0.1:4321/worksheets?grade=7
# or: npm run dev
```

## Differences vs `headless/web` (Next.js)

| Topic | Next (`headless/web`) | This POC |
|---|---|---|
| Framework | Next 16 App Router | Astro 5 + React islands |
| Catalog load | `fs` + `process.cwd()` sibling | Build-time import of in-repo snapshot |
| Grade URL | `force-dynamic` page | `prerender = false` + `Astro.url.searchParams` |
| Nav links | `next/link` | plain `<a href>` |
| Hosting adapter | `next start` | `@astrojs/node` **local only** (Wix would replace when linked) |

## Ported from Phase 2 web sources

`grades.ts`, `search.ts`, `worksheetLinks.ts`, `types.ts`, `GradeNav` / `WorksheetsClient` (adapted), `catalog.css` (copy of web globals).

## Blockers to a real Wix preview

1. Must run `npm create @wix/new@latest -- headless link` (creates Wix project) — **not done** here.
2. Account/plan, domain, auth/SEO handled by Wix Astro integration after link.
3. Local Node adapter ≠ Wix hosting adapter; expect config changes on link.
4. Keep running `npm run refresh:catalog` when the authoritative catalog changes before linking/building elsewhere.
