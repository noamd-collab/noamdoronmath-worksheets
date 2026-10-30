# Grade-loop source map

`LOOPS_MAP_73_v2.csv` is the unchanged 73-row input map from the existing `NOAM-CLAUDE-DESIGN-ASSETS-2026-09-28/05_MAPPING_AND_QA` design handoff, already cited by `src/lib/gradeLoopPools.ts`. It was recovered from the original local handoff; the independent design checkout and review copy have identical bytes. This fixture is source input, not regenerated from the current loop implementation.

SHA-256: `da585bca6ebea78eaed1536d879c1c75ac2b543a948d405c6988c7fc7e4f2e26`.

Keeping the input here makes copy/number parity run in every checkout rather than silently skipping when an untracked root CSV is missing.

`approved-amendments.json` records the one later change to a numeric question in this map. [PR 97](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/97), commit `de606a86f90f23f8fd90e936769bc082822a3208` (11 October 2026), explicitly replaced L14 `diff-sq`'s numeric example with Noam's letters-only Kimi v6 film. Its committed diff changes the grade copy to `x² − y² = (x − y) · (x + y)`, the displayed question to `x² − y² = ?`, and the engine to a 22-second lap with a 20.5-second hold. The amendment was transcribed from that historical diff, not inferred from today's implementation.

The test still checks every one of the 69 pooled variants against its original row and checks the 20 unamended numeric questions against their original numbers. For L14 it requires the exact approved formula in both grade copy and the rendered component, the exact question, and the approved duration/hold. No variant is excluded from the source comparison. The original CSV's SHA-256 is checked too.

Other reviewed changes do not need numeric-question amendments: commit `3b2fdf500cd14d0c2e8adc4849e68845e2fe5718` ([PR 87](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/87)) replaced L01's renderer with the vertex-descent film while retaining its angle-sum topic; commit `892dc51cac01e13d6eafc12b429a0c5a59be8490` made fractions stack consistently and corrected prose without replacing the numeric examples. Numeric comparison normalizes Unicode fractions and superscripts, so `¼` retains the original numerator and denominator. Existing renderer, timing and rotation tests remain active.
