# Agents

## How to start

- The live website builds from `headless/astro-poc-baseline`. Every pull request that changes the website targets `headless/astro-poc-baseline`. Merging to `main` does not publish the site.
- Other work branches from `main` and opens its pull request against `main`.
- Never push directly to `main` or `headless/astro-poc-baseline`.
- `archive/old-main` is frozen. Do not target it.

## Merge gate

- Pull requests only.
- Never merge, auto-merge, enqueue, or delegate a merge without Noam's explicit approval for that specific pull request.
- Approval to implement, review, or preview is not merge approval.
- Publish needs its own approval, unless Noam approves both.

## Branches

- Never delete a local or remote branch, and never turn on auto branch deletion, without explicit approval that names the branch and the pull request.

## Secrets

- Never stage, commit, or push secrets in any file: env files, config, docs, logs, screenshots, or artifacts.
- Keep secret files untracked and ignored.
- Inspect what is staged before you commit.

## Security

- Never disable, bypass, or weaken reCAPTCHA in Noam AI or Ramzi, including in previews and tests against live services.

## Publish

- Publishing and deployment go only through `tools/release/release.sh`, after explicit approval for that pull request.
- That script's `RELEASE_BRANCH` defaults to `headless/astro-poc-baseline`.
- Never use a provider command, API, dashboard, or an old `release-NNN.sh` script.
- Preview approval is not publish approval.
- Build the Wix preview with `.env.local` only.

## Checks

- Node `>=22.12.0`. In `headless/astro-poc`: `npm ci`, `npm run build`, `npm test`.
- Slash fractions: `node .github/scripts/check-slash-fractions.mjs` must pass.
- Teacher print also runs `npx tsx --test tests/teacher-marked-print.test.ts` and the output is inspected for near-empty pages.
- Record pass, fail, or blocked. A skipped check is not a pass.
- Do not run or request Qwen or DeepSeek reviews.

## Review

- Run the relevant code, build, and link checks.
- Verify the UI on phone and desktop.
- Wix preview, built with `.env.local` only.
- Local preview: `cd headless/astro-poc && npm run preview` (`.env.local` only).

## Reporting

- Each version is one package for Noam: pull request number, reviewed commit, preview link, what changed, what was checked (with evidence), what is still blocked.
- Write that package to Noam in short simple Hebrew, in the Grok Bot chat only. Never Slack.
- Separately, put a technical handoff in the hub thread (`noamd-collab/noam-agent-hub`).
- The hub message does not replace the report to Noam.
- If a destination is unavailable, report the blocker. Never claim the message was delivered.

## Worksheets

- One unified worksheet document, cropped from the original PDFs.
- No near-empty pages. A near-empty page is a non-final page under about 40% filled when the next whole exercise would fit.
- An exercise and its drawing stay together.
- Show the levels on the sheet: רמה א׳, רמה ב׳, מצוינות. Never רמה ג׳.
- Append the answer sheet at the end.
- בס״ד on every page and design.
- Every worksheet pull request updates `docs/worksheets-tracker.md`.

## Noam AI

- It is a site guide that navigates to pages, using the current page context.
- Ask for a missing count, level, or lesson length before proposing.
- Preserve didactic order. The order file is `noam-ai/site-companion/topic-order.js` (catalog group order, then topics). Do not keep a second list.
- Show a thinking indicator with elapsed seconds. Reset it on completion or failure.
- No duplicate buttons.
- On a phone, the bottom sheet must not cover the lesson content.
- Clear the input after send.

## Ramzi

- Exactly one pair of הבנתי / לא הבנתי after every question or hint.
- Never duplicate that pair under earlier replies.
- Do not show the pair after the closing message or after errors. There is nothing to answer there.
- Use a warm opening.
- Use feminine or neutral wording.
- Drawing hints (רמז בשרטוט / sketch hints) may appear only on worksheet pages whose topic is geometry or analytic geometry. Algebra, arithmetic, fractions, equations, and every other topic show no drawing hint.
- On other topics that includes saved drawings, automatic visuals, and explicit drawing requests. Textual hints and the original worksheet stay available.
- Enforce the same topic policy in the viewer and the diagram services. Unknown topics deny drawings. Do not infer permission from a student's message.

## Layout

- Hebrew is RTL. Keep ∠ and ∥ formulas in reading order, and keep a formula on one line (`nowrap`) when it would break.
- Fractions use a horizontal bar. Never write a fraction or division with `/` in visible site text (blogs excluded).
- Animations play when the operating system asks for reduced motion. The site accessibility menu and Stop Animations stop them and show the final frame.
- Tap targets are at least 44px.

## Where things live

- `tools/` — release, review, and Puppeteer helpers.
- `tools/release/release.sh` — the only publish path.
- `docs/worksheets-tracker.md` — worksheet tracker.
- Hub: `noamd-collab/noam-agent-hub`.

## Local run

`npm run dev` in `headless/astro-poc` is `wix dev` and stops without Wix secrets. The loopback server is:

```bash
cd headless/astro-poc
node scripts/bundle-native-svg.mjs generate
npx astro dev --config astro.config.preview.mjs --host 127.0.0.1 --port 4321
```

CI build, no Wix: `bash .github/scripts/build-servable.sh`, then `bash .github/scripts/serve-built-site.sh`.

Worksheet gate: `node tools/validate.js index.html`.

`npm run test:unit` skips the gitignored blog-capture check only when `CI=true`, same as GitHub Actions. Do not run `wix release` except through `tools/release/release.sh` after explicit publish approval.
