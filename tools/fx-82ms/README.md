# fx-82MS 2nd edition practice calculator

A second, independent calculator for the existing Noam Doron math-tools page. The selector in `../scientific-calculator/calculators.html` keeps the existing fx-991ES PLUS as its default. Each model lives in its own iframe; changing tabs retains the current expressions, results and memories without reloading either model.

## Scope

- CSS case and 50 physical buttons based on the user-supplied photograph, with yellow SHIFT and red ALPHA legends.
- Two-line SVG LCD: vector dot-matrix input, ten-digit segmented results, exponent and status indicators.
- MS linear fractions, mixed/improper and decimal conversion; default overwrite editing, INS, DEL, replay and expression scrolling.
- MS precedence, trigonometric/inverse/hyperbolic functions, roots and powers, permutations/combinations, factorial, DMS and angle conversion, logarithms, engineering notation, random values and rounding.
- MS percentage operations including markup, discount and percentage change.
- Nine variables, Ans and independent memory; coordinate conversion through E/F.
- COMP, SD and REG, six regression types, frequency entry, DT, S-SUM, S-VAR, data review/edit/delete, predictions and Data Full handling.
- MODE/CLR, Deg/Rad/Gra, Fix/Sci/Norm, fraction format, decimal separator, contrast and OFF/ON.
- Accessible model tabs, keyboard operation, visible focus, reduced motion, screen-reader output and Hebrew help.

The MS controller uses its own input model and explicit MS precedence; it does not reuse the ES natural-display editor or its mode menus. The restricted arithmetic engine and statistics algorithms are reused as numerical primitives. Existing ES files are unchanged.

## Reproduce

Inside `src`, install locked dependencies with `npm ci`; `npm test` builds and runs the MS model, built UI and selector tests. `npm run build` produces the standalone `../index.html`. The maintained selector source is `src/calculators.html`; copy it to `../scientific-calculator/calculators.html` when changing the selector. No remote scripts or runtime libraries are required.

84 calculator/selector tests passed, including official key sequences and all six regression families. Five Wix integration tests cover insertion, SPA recovery, external links, message origin/source validation and preserving native page content. Browser checks covered 320, 360 and 390 px, all 50 key bounds, actual fraction entry, tab switching and retained state. The final publication record lives in the local task status.

## Reference and limits

[CASIO's official fx-82MS 2nd edition S-V.P.A.M. manual](https://support.casio.com/global/en/calc/manual/fx-82MS_85MS_220PLUS_300MS_350MS_en/) is the behavioral reference. The implementation is not a Casio product, firmware emulator or certification of exhaustive hardware equivalence. It uses JavaScript floating-point arithmetic, so extreme inputs, last-digit rounding, exact internal stack accounting and memory-capacity edge cases may differ from the physical device. A matching short note appears in the expandable help. No firmware, manual images or proprietary fonts are distributed.

Calculator preferences and nine memories are stored locally under a key specific to this model. No sign-in, tracking or network submission is used. The selector forwards only its rendered height to the embedding Wix page, which checks both the sending origin and frame window.

Third-party licenses are supplied alongside the built calculator. Reference downloads and local QA fixtures are not publication assets.
