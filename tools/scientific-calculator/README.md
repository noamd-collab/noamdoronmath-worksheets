# Scientific calculator

Independent educational browser calculator for Noam Doron Math. The shell is a generic math-display layout: a teal case, a short wordmark, and ordinary scientific keys. It is not a copy of any commercial product, and it does not include firmware, a ROM, or brand artwork.

## Use and maintenance

- Public host: `https://noamd-collab.github.io/noamdoronmath-worksheets/tools/scientific-calculator/`
- Site page: `https://www.noamdoronmath.co.il/math-tools`
- `index.html` is a self-contained calculator; `preview.html` is a lightweight static rendering of the same shell for the site card.
- Sources and tests are in `src/`. From that directory, run `npm ci`, `npm test`, then `npm run build`. Building regenerates the two HTML files in the parent directory.
- `make-ui.cjs` and `device.css` define the shell. `natural-editor.js` owns the structured input slots, token cursor, capture and serialization; `device.js` handles the keys, LCD and settings. `modes.js` handles advanced mode workflows. `core.js`, `algorithms.js` and `catalog.js` implement the calculations.
- Calculations run locally. There are no calculation requests to external services. Local storage retains calculator settings and memories; the CLR menu clears them. It does not store personal information or send tracking events.
- The embedded tool is marked `noindex`. The site page keeps the searchable title, canonical address and links.
- `npm test` also runs `tools/trademark-guard.test.cjs`, which fails if a brand or model name reappears in these calculator files.

## Function coverage

- All eight mode families: COMP, CMPLX, STAT, BASE-N, EQN, MATRIX, TABLE and VECTOR.
- SHIFT, ALPHA, MODE/SETUP, replay/editing, ON/OFF, insertion/deletion, Ans, variables A–F/X/Y/M, STO/RCL and M+/M−.
- Natural fraction/root/power templates, mixed fractions, fraction/decimal toggle, π, e, logarithms, trigonometric and inverse functions, hyperbolic functions, factorials, combinations, permutations, percentages, random values and RanInt#.
- DEG/RAD/GRA, Fix/Sci/Norm, decimal separators, engineering notation, DMS, coordinate conversions and screen contrast.
- CALC, SOLVE, finite sums, numerical derivatives and integrals; 40 CODATA 2014 constants and 40 conversion codes.
- Frequency statistics, seven regression models plus one-variable statistics, normal-distribution functions, means/sums/deviations and predictions.
- Systems with two or three unknowns, quadratic/cubic equations, matrices up to 3×3, vectors in two or three dimensions, signed BASE-N arithmetic/logic and tables up to 30 rows.

## Compatibility limits

This is not a firmware emulator, and bit-for-bit equivalence with any physical calculator is not asserted.

- Browser MathML and fonts approximate a dot-matrix display. LCD layout adapts to the browser.
- Numeric evaluation uses IEEE-754 binary64 rather than decimal arithmetic. Last-digit rounding, cancellation, extreme domains and underflow behavior can differ from a handheld unit.
- Exact output supports bounded rational, radical, π and complex algebra. More complicated nested radicals and exact polar forms can fall back to decimal output.
- Numerical calculations use bounded independent algorithms: sums up to 100,001 terms, integration up to 100,000 evaluations/22 subdivision levels, derivatives up to 20 refinements, and SOLVE up to 75 Newton iterations followed by bounded bracketing. SOLVE reports one solution according to its initial guess.

## References and licensing

Constant values follow the public NIST CODATA 2014 archive. Conversion factors follow NIST SP 811 (2008). Math.js 15.2.0 and bundled dependencies retain their license files alongside the public HTML.

Automated tests cover numerical references and boundary conditions, expression safety, key sequences, settings/memories and advanced mode families.
