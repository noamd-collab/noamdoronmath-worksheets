# Two-line scientific practice calculator

A second, independent calculator for the Noam Doron math-tools page. The selector in `../scientific-calculator/calculators.html` keeps the natural-display calculator as its default. Each calculator lives in its own iframe; changing tabs retains the current expressions, results and memories without reloading either one.

The public folder name is unchanged so existing links keep working. That folder name still contains a retired model token. It is called out in the cleanup report so it can be renamed later with a redirect.

## Scope

- A generic case and 50 buttons, with secondary and letter legends.
- Two-line SVG LCD: vector input, ten-digit segmented results, exponent and status indicators.
- Linear fractions, mixed/improper and decimal conversion; default overwrite editing, INS, DEL, replay and expression scrolling.
- Ordinary precedence, trigonometric/inverse/hyperbolic functions, roots and powers, permutations/combinations, factorial, DMS and angle conversion, logarithms, engineering notation, random values and rounding.
- Percentage operations including markup, discount and percentage change.
- Nine variables, Ans and independent memory; coordinate conversion through E/F.
- COMP, SD and REG, six regression types, frequency entry, data review/edit/delete, predictions and a full-memory stop.
- MODE/CLR, Deg/Rad/Gra, Fix/Sci/Norm, fraction format, decimal separator, contrast and OFF/ON.
- Accessible tabs, keyboard operation, visible focus, reduced motion, screen-reader output and Hebrew help.

The two-line controller uses its own input model and explicit precedence. It does not reuse the natural-display editor or its mode menus. The restricted arithmetic engine and statistics algorithms are reused as numerical primitives.

## Reproduce

Inside `src`, install locked dependencies with `npm ci`; `npm test` builds and runs the model, built UI, selector tests and the shared trademark guard. `npm run build` produces the standalone `../index.html`. The selector source is `src/calculators.html`. The published selector is `../scientific-calculator/calculators.html` and also includes the external practice-tips link. No remote scripts or runtime libraries are required.

## Limits

The implementation is not a commercial product, a firmware emulator, or a certification of hardware equivalence. It uses JavaScript floating-point arithmetic, so extreme inputs, last-digit rounding and memory-capacity edge cases may differ from a handheld unit. A short note appears in the expandable help. No firmware, manual images or proprietary fonts are distributed.

Calculator preferences and nine memories are stored locally. No sign-in, tracking or network submission is used. The selector forwards only its rendered height to the embedding site page, which checks both the sending origin and frame window.

Third-party licenses are supplied alongside the built calculator.
