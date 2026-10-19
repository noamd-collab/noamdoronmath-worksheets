# Ramzi reading space — 2026-10-19

The live G9-T40 hint succeeded, but its 552px-high desktop panel left only 113.5px for the answer. Fixed toolbars occupied the rest. The answer and understanding controls were clipped inside a second scrollport.

The Headless presentation adapter now measures the actual panel. Below 720px it gives the body one scrollport; the transcript and composer occupy normal flow. The header remains fixed. A new rendered reply is revealed after layout; subsequent decorations do not move the user's scroll, typing stays undisturbed, and source-preview/diagram reveal retain their own behavior. Taller panels retain the existing layout. GitHub Pages root viewer and all provider/auth/storage/worksheet code are unchanged.

## Browser evidence

Screenshots replay the **actual already-rendered live G9-T40 answer DOM**, with the changed production CSS and reply-reveal helper. These are isolated layout tests, not new live-model calls or functional AI-control tests.

- desktop.png: 1420x678, 512x552 panel. Entire answer and both understanding controls visible (answer y378–535; checks y480–534).
- phone.png: 390x844, ordinary tall layout. Answer and both controls visible.
- short-phone.png: 390x600, compact layout. Entire answer y233–415 and checks y360–414 visible; composer continues below in the same scrollport.
- Keyboard focus reaches the composer and scrolls the body, rather than trapping it behind a fixed footer.

Behavior tests cover deferred reveal, long-answer start, no repeated scroll hijack, typing, source preview, diagram ownership, tall layout, and stale transcript cancellation. Existing understanding and protected-boundary tests also pass (31 total).

Qwen visual review is recorded separately. Deployment and exact PR review receipts belong in the PR.

## Review and preview completion

The initial short-phone PNG was accidentally captured after a browser reload cleared emulation. Independent review caught this. It was replaced with the verified **390x600** PNG, and Qwen re-reviewed that exact replacement in `qwen-short-phone-review.md` (no blockers). Qwen mis-transcribes some button labels in its prose; the actual screenshot/DOM labels are unchanged. The earlier Qwen report applies to desktop and tall phone only.

`composer-focus.png` shows the desktop body scrolled to the input. Filling the field focuses `noamQuestion`, fully visible at y553.7–605.7 within panel y126–678. Shift+Tab reaches `noamMathToggle`; body scroll remains 134.5px.

The exact source built successfully (96.82s, 1,866 static assets). Wix preview opened the actual G9-T40 PDF and question 1א. The new compact class activates on the actual 552px panel. Writing, opening/closing the math keyboard, and expanding the original question work. Expanded question keeps its dedicated preview and hides the transcript; no tutor request was sent. Preview URL is in the PR handoff, not evidence for production deployment.
