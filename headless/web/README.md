# Headless catalog prototype (Phase 1)

Isolated Next.js App Router app under `headless/web/`. Reads `../catalog/catalog.v1.json`. Does **not** replace production `index.html`.

## Vertical slice

- Route: `/worksheets?grade=7` (Hebrew RTL grade-7 catalog)
- Local Hebrew search + group chips
- Outgoing worksheet links open the **existing** public viewer/PDF (GitHub Pages / Wix media), not this app

## Commands (loopback only)

```bash
cd headless/web
npm install
npm run typecheck
npm test
npm run build
npm run start   # http://127.0.0.1:3000
# or: npm run dev
```

Stop with Ctrl+C. Do not expose publicly.
