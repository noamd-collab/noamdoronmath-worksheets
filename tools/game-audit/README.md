# game-audit — the live games harness

Browser checks for the Eliyahu games corner. Every tool here runs against a URL, writes its output
under this directory and never touches the site. The GitHub workflow
`.github/workflows/live-games-audit.yml` runs exactly these files.

## What is here

| File | Role |
|---|---|
| `live_audit.sh` | Runs all three checks per slug and exits non-zero if any of them fails |
| `shots-live.mjs` | Screenshots every step at phone 390 and desktop 1280, layout checks, and the zero-pointer flow |
| `shots.mjs` | The same against the local build (file:// pages built from the worktree's engine) |
| `page_audit.mjs` | Keyboard reachability and per-step layout problems |
| `drag_probe.mjs` | Proves a pointer drag still moves the handles |
| `_browser.mjs` | Shared browser bootstrap for the two audit scripts |
| `live_flow.mjs` | Runs one flow module against one URL at both viewports and asserts the score |
| `summarize_live.py` | Builds the results table from the three outputs |
| `contact_sheet.py` | Puts every step of one game into a single image |
| `flows/<slug>.mjs` | The per-game play-through, one file per game |

## Run it

```bash
APP=$PWD/headless/astro-poc \
TOOLS=$PWD/tools/game-audit \
A11Y=$PWD/tools/game-audit \
BASE=https://www.noamdoronmath.co.il \
bash tools/game-audit/live_audit.sh mad-hazavit kod-batzadim
```

`APP` must be the directory whose `node_modules` contains `puppeteer-core` (`npm ci` there first).
The browser comes from `BROWSER_PATH`, or from the first Chromium-family binary found. Results:

- `shots-live/<slug>/<vp>-<NN>.png` and `summary.json`
- `audit-live/<slug>.json`
- `verify-live/<slug>.{shots,audit,drag1,drag3,drag5}.txt`

Then:

```bash
python3 tools/game-audit/summarize_live.py --tools tools/game-audit <slug>...
python3 tools/game-audit/contact_sheet.py --tools tools/game-audit <slug>
```

## Rules that keep the results honest

1. Run `--steps=all` once per game and keep that run as the record; a targeted rerun after a fix
   overwrites `summary.json` with fewer steps.
2. A green flow is not a clean screen: read the contact sheet for clipping and layout.
3. Success is `total 320` at both viewports, no console errors, no horizontal overflow and no target
   under 44px.
4. One known probe false positive: on `kod-batzadim` step 5 the loop scene reports `text, repeatDot`
   as handles that do not move. A real mouse drag on the dot does change the repeat count (1 -> 2 -> 1),
   because the probe drives synthetic pointer events in a different coordinate space than the SVG
   group. `kod-batzadim` is therefore not in the workflow's default slug list; audit it manually and
   read the drag line with that in mind.
5. These outputs are generated, never committed: `shots-live/`, `audit-live/`, `verify-live/`,
   `contact/` are ignored by `.gitignore` in this directory.
