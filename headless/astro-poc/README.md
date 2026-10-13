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

## Pull request checks

Workflow: [`.github/workflows/astro-poc-pr.yml`](../../.github/workflows/astro-poc-pr.yml). It runs on every pull request into `main`.

Blocking checks (these must pass):

| Check | What it does |
|---|---|
| `astro-poc-build` | `npm ci`, then a local Astro build |
| `astro-poc-test` | `npm test` when `package.json` has a test script. Live HTML fetches skip when `CI=true` |
| `astro-poc-internal-links` | crawls the built site and fails on broken internal links |

The build command is `bash .github/scripts/build-servable.sh`: the site-guide prebuild, then `astro build --config astro.config.preview.mjs` (Node adapter, same pages). `npm run build` is `wix build`, which stops without `WIX_CLIENT_ID` and the Wix server secrets from `wix env pull`, and its output is a Wix/Cloudflare bundle rather than a server this workflow can crawl. The workflow does not run `wix env pull`, `wix preview`, or `wix release`, and it never deploys to Wix.

Advisory checks do not block merge (`continue-on-error`). Each posts one pull request comment and updates that same comment on later pushes. Secrets are not allowed in job-level `if:`, so each advisory job maps the shared secret to a job env flag and gates every step on it: when the secret is missing, including on fork pull requests, the job reports success without running anything.

Both advisory jobs call the QwenCloud Token Plan gateway (`https://token-plan.maas.qwencloudapi.com/compatible-mode/v1`, OpenAI-compatible) with one shared secret.

| Check | Secret | Model | What it does |
|---|---|---|---|
| `astro-poc-deepseek-review` | `CHINESE_MODELS_API_KEY` | `deepseek-v4-pro` | sends the pull request diff to the gateway |
| `astro-poc-qwen-visual-review` | `CHINESE_MODELS_API_KEY` | `qwen3.8-max` | screenshots changed pages (fallback: `/`, `/grade-9`, `/worksheets?grade=9`) at 390px and 1280px, sends them to the gateway, uploads `qwen-visual-screenshots` |

Qwen findings must be verified by a human. The comment says so.

### Add the secret

Repository **Settings → Secrets and variables → Actions → New repository secret**:

- `CHINESE_MODELS_API_KEY` — QwenCloud Token Plan gateway key, used by both advisory jobs

Do not commit the key. The workflow does not print it. The link check and the visual review each build the site again in the job that serves it.

### Require the blocking checks

**Settings → Rules → Rulesets** (or **Branches → Branch protection**) for `main`:

- Require status checks to pass before merging
- Add only: `astro-poc-build`, `astro-poc-test`, `astro-poc-internal-links`

Do not require `astro-poc-deepseek-review` or `astro-poc-qwen-visual-review`. They are advisory, and on a fork they are skipped because the secrets are not available.
