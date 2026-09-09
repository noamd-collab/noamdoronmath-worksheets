# Scientific calculator — physical ES PLUS layout

Independent educational browser implementation for Noam Doron Math. The reference is the **fx-991ES PLUS, 2nd edition**, matching the photograph supplied by the site owner. No Casio firmware, ROM, photograph or proprietary software is included. Casio branding in the physical reference does not imply affiliation.

## Use and maintenance

- Public host: `https://noamd-collab.github.io/noamdoronmath-worksheets/tools/scientific-calculator/`
- Site page: `https://www.noamdoronmath.co.il/math-tools`
- `index.html` is a self-contained calculator; `preview.html` is a lightweight static rendering of the same shell for the Wix card.
- Sources and tests are in `src/` in the published repository. From that directory, run `npm ci`, `npm test`, then `npm run build`. Building regenerates the two HTML files in the parent directory.
- `make-ui.cjs` and `device.css` define the physical shell. `device.js` handles the keys, editable LCD and settings. `modes.js` handles advanced mode workflows. `core.js`, `algorithms.js` and `catalog.js` implement the calculations.
- Calculations run locally. There are no calculation requests to external services. Local storage retains calculator settings and memories; the CLR menu clears them. It does not store personal information or send tracking events.
- The embedded tool is marked `noindex`; the Wix page retains the searchable native content, title, canonical address and links.

## Function coverage

- All eight mode families: COMP, CMPLX, STAT, BASE-N, EQN, MATRIX, TABLE and VECTOR.
- Physical SHIFT, ALPHA, MODE/SETUP, replay/editing, ON/OFF, insertion/deletion, Ans, variables A–F/X/Y/M, STO/RCL and M+/M−.
- Natural fraction/root/power templates, mixed fractions, S⇔D, π, e, logarithms, trigonometric and inverse functions, hyperbolic functions, factorials, combinations, permutations, percentages, random values and RanInt#.
- DEG/RAD/GRA, Fix/Sci/Norm, decimal separators, engineering notation, DMS, coordinate conversions and screen contrast.
- CALC, SOLVE, finite sums, numerical derivatives and integrals; 40 CODATA 2014 constants and 40 device conversion codes.
- Frequency statistics, seven regression models plus one-variable statistics, normal-distribution functions, means/sums/deviations and predictions.
- Systems with two or three unknowns, quadratic/cubic equations, matrices up to 3×3, vectors in two or three dimensions, signed BASE-N arithmetic/logic and tables up to 30 rows.

## Compatibility limits

This is not an emulator of Casio firmware, and bit-for-bit equivalence is not asserted.

- Browser MathML and fonts approximate the hardware's dot-matrix display. Editing and LCD menu layout adapt to the browser rather than reproducing every screen pixel and firmware state.
- Numeric evaluation uses IEEE-754 binary64 rather than Casio's internal decimal arithmetic. Last-digit rounding, cancellation, extreme domains and underflow behavior can differ.
- Exact output supports bounded rational, radical, π and complex algebra. More complicated nested radicals, symbolic provenance of stored values and exact polar forms can fall back to decimal output.
- Numerical calculations use bounded independent algorithms: sums up to 100,001 terms, integration up to 100,000 evaluations/22 subdivision levels, derivatives up to 20 refinements, and SOLVE up to 75 Newton iterations followed by bounded bracketing. Difficult cases may reach an error at a different point from the physical calculator. SOLVE reports one solution according to its initial guess.

## References and licensing

- [Official PLUS user guide](https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/)
- [Official English PDF](https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-en/f/fx-570ESPLUS_991ESPLUS_EN.pdf)
- Math.js 15.2.0 and bundled dependencies retain their license files alongside the public HTML.

Automated tests cover numerical references and boundary conditions, expression safety, physical key sequences, settings/memories and all advanced mode families. Browser verification additionally covers the reference integral, fractions, equation entry and responsive rendering at 320/360px and the 230px card preview.
