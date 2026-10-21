# Fraction add / subtract explorer — 19.10.2026

Local check of `FractionAddSubExplorer.astro` on the two grade-5 topic pages,
served with `astro dev --config astro.config.preview.mjs` (the CI Node adapter,
no Wix integration).

- `phone.png` — `/add-subtract-fractions-grade-5` at 390 px: controls, strips,
  readout and the Hebrew sentence fit without horizontal scroll.
- `desktop.png` — the same page at 1280 px.
- `common-denominator-desktop.png` — `/common-denominator-grade-5` at 1280 px,
  opening on 1/6 + 1/8 with the "24, not 48" hint.

The three captures were taken with `html.noam-a11y-motion` set, so they show
the final frame. Without it the emulated-viewport capture in the desktop app
kept landing mid-transition, although the page itself had reached
`data-phase="3"` with opacity 1 (checked from the console each time).

Checked by hand in the browser on the dev server:

- Opens on 1/2 + 1/3 = 5/6 with "חצי ועוד שליש שווה חמש שישיות".
- 1/2 + 2/3 gives two result rows, 7/6, and "שלם אחד ושישית"; the − toggle is
  disabled and the below-zero sentence is shown.
- 1/2 − 1/3 crosses out two sixths and reads "חצי פחות שליש שווה שישית"; the
  step to 2/3 is disabled.
- With `html.noam-a11y-motion` a change lands on the final frame at once
  (`data-phase="3"`); without it the frame starts at phase 0 and reaches 3
  after about two seconds.
- The live region reads words and "n חלקי m", never a slash.
- No console errors on either page.
