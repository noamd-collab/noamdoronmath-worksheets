# Agents

## Ramzi drawings — Noam's rule, 29 October 2026

Visual hints (drawings, illustrations, sketches and graphics) are permitted only
on geometry or analytic geometry worksheets. All other worksheets must show no
Ramzi drawings, including saved drawings, automatic visuals and explicit drawing
requests. Textual hints and the original worksheet remain available. Enforce the
same worksheet policy in the viewer and diagram services; unknown topics deny
drawings. Do not infer permission from a student's message.

Work on `main` through pull requests. Do not merge or publish without Noam's approval.

## Review

1. Run the relevant code, build, and link checks.
2. Verify the UI on phone and desktop.
3. Wix preview, built with `.env.local` only.

## Noam's rules

- בס״ד on every page and design.
- Levels are רמה א׳, רמה ב׳, and מצוינות. Never רמה ג׳.
- Ramzi always shows הבנתי and לא הבנתי.
- Worksheets are cropped from the original PDFs.
- An exercise and its drawing never split across pages.

## Where things live

- `tools/` — release, review, and Puppeteer helpers.
- `docs/worksheets-tracker.md` — worksheet tracker.
- Hub: `noamd-collab/noam-agent-hub`.

## Forbidden

Secrets in code. Deploying. Force-push.

## Local run

`npm run dev` in `headless/astro-poc` is `wix dev` and stops without Wix secrets. The loopback server is:

```bash
cd headless/astro-poc
node scripts/bundle-native-svg.mjs generate
npx astro dev --config astro.config.preview.mjs --host 127.0.0.1 --port 4321
```

CI build, no Wix: `bash .github/scripts/build-servable.sh`, then `bash .github/scripts/serve-built-site.sh`.

Worksheet gate: `node tools/validate.js index.html`.

`npm run test:unit` skips the gitignored blog-capture check only when `CI=true`, same as GitHub Actions. Do not run `wix release`.
