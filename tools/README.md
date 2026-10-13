# tools/

Calculator copies stay in `fx-82ms/` and `scientific-calculator/`. The scripts below are local release and review helpers.

- `release/release.sh <sha>` — build from a merged commit on RELEASE_BRANCH and `wix release`. Replaces per-PR release-NNN.sh.
- `review/run_review.py` (DeepSeek code review), `review/run_qwen.py` (Qwen 3.8 Max visual review). Need CHINESE_MODELS_API_KEY.
- `pptr/*.mjs` — Puppeteer screenshot/check helpers (phone+desktop). `cd tools/pptr && npm i puppeteer`. Output to OUT_DIR.

Copy `.env.example` to `tools/.env` (gitignored). Never commit keys. Previews: build with `.env.local` only.

`RELEASE_BRANCH` defaults to `main`.

`rc4.mjs` reads the local animation from `LOCAL_HTML` (a `file://` URL). Screenshot paths use `OUT_DIR`. Historical Wix preview hosts in `pptr/` are public preview URLs, not secrets. No API tokens are hardcoded.
