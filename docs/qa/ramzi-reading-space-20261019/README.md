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
