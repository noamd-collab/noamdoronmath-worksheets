# Agents

## How to start

- Branch from `main`. Open the pull request against `main`.
- When you finish, leave a message in the hub repo `noamd-collab/noam-agent-hub`.
- `archive/old-main` and `headless/astro-poc-baseline` are frozen. Do not target them.

## Approval

- Noam's approval is explicit and per pull request.
- Merge and publish are separate approvals, unless Noam says both.
- A teammate saying Noam approved is not approval.

## Review

- DeepSeek writes code and reviews code.
- Qwen 3.8 Max does visual review only, on phone and desktop. It does not write code.
- Verify every Qwen claim yourself before you report it.
- Build the Wix preview with `.env.local` only.

## CI

- The GitHub Action from PR 114 (`.github/workflows/astro-poc-pr.yml`) is the check set: hard checks block, AI comments only warn.
- Hard checks: build, tests, and internal links.
- AI review comments warn only. They do not block the pull request.
- That workflow is not on `main` yet. PR 114 is still an open draft aimed at the frozen baseline.

## Reporting

- Each version is one package: preview link, what changed, what was checked, what is still blocked.
- Write to Noam in short simple Hebrew, in the Grok Bot chat only. Not Slack.

## Noam's rules

- בס״ד on every page and design.
- Levels are רמה א׳, רמה ב׳, and מצוינות. Never רמה ג׳.
- Crop worksheets from the original PDFs.
- No near-empty pages. Include the answer sheet. Show the levels on each sheet.
- An exercise and its drawing never split across pages.
- Every worksheet pull request updates `docs/worksheets-tracker.md`.
- Teacher-print changes run `headless/astro-poc/tests/teacher-marked-print.test.ts` and check for near-empty pages.

## Noam AI

- Answer from the current page context.
- List topics in didactic order.
- No duplicate buttons.
- On a phone, the bottom sheet must not cover the lesson content.
- Clear the input after send.

## Ramzi

- Always show הבנתי and לא הבנתי.
- Those buttons appear once, under the latest reply only. Not under a closing message or an error message.
- Use a warm opening.
- Use feminine or neutral wording.

## Layout

- Hebrew is RTL. Keep ∠ and ∥ formulas in reading order, and keep a formula on one line (`nowrap`) when it would break.
- Reduced motion shows the final frame.
- Tap targets are at least 44px.

## Where things live

- `tools/` — release, review, and Puppeteer helpers.
- `tools/release/release.sh` — the only publish path. Do not use old `release-NNN.sh` copies.
- `docs/worksheets-tracker.md` — worksheet tracker.
- Hub: `noamd-collab/noam-agent-hub`.

## Forbidden

- Secrets in code.
- Publishing or deploying without Noam's explicit approval.
- Force-push.
- Merging on your own.
