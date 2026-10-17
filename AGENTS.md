# Agents

## How to start

- Branch from `main`. Open the pull request against `main`. Never push to `main`.
- `archive/old-main` and `headless/astro-poc-baseline` are frozen. Do not target them, including for CI.

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

## Publish

- Publishing and deployment go only through `tools/release/release.sh`, after explicit approval for that pull request.
- Never use a provider command, API, dashboard, or an old `release-NNN.sh` script.
- Preview approval is not publish approval.
- Build the Wix preview with `.env.local` only.

## Checks

- PR 114 CI (`.github/workflows/astro-poc-pr.yml`) is planned. It is not current for `main`.
- Node `>=22.12.0`. In `headless/astro-poc`: `npm ci`, `npm run build`, `npm test`.
- Teacher print also runs `npx tsx --test tests/teacher-marked-print.test.ts` and the output is inspected for near-empty pages.
- Record pass, fail, or blocked. A skipped check is not a pass.
- The link checker is blocked until that workflow is on `main`.
- AI comments are advisory. A skipped AI job does not satisfy the required DeepSeek or Qwen review.

## Review

- DeepSeek writes code and reviews code: `python tools/review/run_review.py` (needs `review.diff` and `CHINESE_MODELS_API_KEY`).
- Qwen 3.8 Max does visual review only, phone and desktop. It does not write code: `python tools/review/run_qwen.py`.
- Verify every Qwen claim yourself before you report it.
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

## Layout

- Hebrew is RTL. Keep ∠ and ∥ formulas in reading order, and keep a formula on one line (`nowrap`) when it would break.
- Reduced motion shows the final frame.
- Tap targets are at least 44px.

## Where things live

- `tools/` — release, review, and Puppeteer helpers.
- `tools/release/release.sh` — the only publish path.
- `docs/worksheets-tracker.md` — worksheet tracker.
- Hub: `noamd-collab/noam-agent-hub`.
