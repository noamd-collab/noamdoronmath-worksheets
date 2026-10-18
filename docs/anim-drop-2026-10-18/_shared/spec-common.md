You are writing ONE self-contained film file `film.js` for the Hebrew math-teaching site noamdoronmath.co.il. It is a "ConceptLoop" film: a short looping SVG animation inside a white card (same engine as the site's ~80 existing films). You output ONLY the JavaScript file in one ```js fenced block, nothing else.

## File contract (exact)
```js
window.FILM = {
  slug: '<slug>',
  duration: <seconds, 10..16>,     // loop length; render(0) and render(duration) must look IDENTICAL (clean seam: everything faded out / reset by the end)
  hold: <seconds>,                 // the time inside the loop where the COMPLETED, fully-readable state is shown (used for reduced-motion static frame and after 4 laps)
  viewBox: '0 0 560 340',          // or another 560-wide box, e.g. '0 0 560 380'
  top: { text: '<fixed Hebrew question strip, shown above the SVG, never moves>', ltr: false|true },
  ariaLabel: '<Hebrew sentence describing the whole film>',
  svgMarkup: `<...svg inner markup (no outer <svg>)...>`,
  formulaHTML: `<p class="concept-loop__formula cl-num" dir="ltr"><span data-fx="0">...</span><span data-fx="1">...</span>...<span data-fx="N" class="cl-check" aria-hidden="true">✓</span></p>`,
  render(root, t) { const {ph,lerp,op,q,qa,draw,move,shift,r2} = LoopHelpers; /* pure function of t */ }
};
```
## Engine helpers (global `LoopHelpers`, identical to the site's)
- `ph(t,a,b)`: eased 0→1 progress of t inside [a,b] (cubic-bezier .16,1,.3,1). `lerp(a,b,p)`.
- `q(root,'name')` -> element with `data-el="name"`; `qa(root,selector)` -> array.
- `op(el,v)` sets opacity (clamped 0..1). `draw(el,p)` sets strokeDashoffset for paths that have `pathLength="1"` (CSS gives them dasharray 1). `move(el,x,y,rot)` / `shift(el,dx,dy)` set SVG transform. `r2` rounds to 2 decimals.
- render(root,t) is a PURE function of t: every element's opacity/position is computed from t each frame (no accumulated state, no CSS transitions, no timers). Elements that should start hidden need `style="opacity:0"` in the markup. `[data-fx]` and `[data-el="caption"]` start at opacity 0 via CSS; reveal formula chunks with `op(qa(root,'[data-fx]')[i], ...)`.
- Motion language: moves last 0.3–0.8 s using ph() easing; 0.5–1.5 s still holds between beats; fade the whole thing out near the end (about the last 1–1.5 s) so the loop restarts clean. Green (see trap A below) ONLY for the final correct result, once per lap.

## Site visual style (CSS classes already defined — use them, add inline attributes for anything else; do NOT include <style>)
Palette: navy #22305a (text/lines), teal "cobalt" #2a7c7a, blue fill rgba(30,136,229,.4), purple rgba(124,58,237,.35), orange #ea580c / rgba(234,88,12,.35), green #2e9d57, grey #9ca3af, white card, warm panel. Hand-made "notebook / toy brick" feeling: flat fills, 1.5–2.5px navy outlines, rounded corners (rx 3–8), no gradients, no shadows, no external images/fonts/URLs.
Classes: `cl-t` (SVG text: Assistant 15px/600 navy — ALWAYS put on every <text>. CRITICAL: the CSS rule `.cl-t{font-size:15px}` BEATS the SVG font-size attribute, so set sizes ONLY with an inline style: `style="font-size:32px"` — a `font-size="32"` attribute is silently ignored and the text stays 15 units = 6.9px on a phone), `cl-num` (direction:ltr isolate — for numbers/equations), `cl-num cl-rtl` (RTL isolate — for mixed Hebrew + number labels like "10 ס״מ"), `cl-ok` (green text), `cl-line` (2px navy stroke, fill none), `cl-line-thin`, `cl-dash`, `cl-dash-strong`, `cl-fill-a` (blue tint) `cl-fill-b` (purple tint) `cl-fill-c` (orange tint) `cl-fill-d` (grey), `cl-stroke-a` (teal 2.5px) `cl-stroke-b` (purple 2.5px), `cl-tile cl-tile-a/b`, `cl-rod cl-rod-b cl-rod-new`, `cl-one cl-one-a/b`, `cl-ol` (orange outline), `cl-hl cl-hl-b cl-hl-c`, `cl-slot` (dashed empty slot), `cl-bar-a/b/c`, `cl-frame2`, `cl-grid`, `cl-ghost`, `cl-chip`. Formula row: `.concept-loop__formula` (HTML, 1.1rem bold, LTR; each [data-fx] chunk is an inline-block LTR isolate that wraps onto the next line when the row is full).
Stacked fraction in SVG: a <g> with numerator <text>, a <line class="cl-line-thin"> bar, denominator <text>, all text-anchor="middle". Stacked fraction in HTML formula: `<span class="cl-frac"><span class="cl-frac__n">3</span><span class="cl-frac__d">4</span></span>`.

## Hard requirements (a reviewer will check each)
1. Hebrew, RTL page. The question strip `top` is Hebrew (or an LTR equation with ltr:true). Math expressions and numbers are LTR. Division is written with a colon ":" (Israeli school notation), multiplication "×", minus "−" (U+2212). Hebrew unit labels: ס״מ (use the gershayim character ״ U+05F4), סמ״ר. Use `cl-rtl` on any SVG <text> that mixes Hebrew and digits.
2. MOBILE LEGIBILITY IS THE #1 RULE. On a 390px phone the SVG is only ~258px wide, i.e. scale ≈ 0.46 of the 560-unit viewBox. Therefore every SVG number/label must be font-size ≥ 30 (set style="font-size:32px" / 34px / 36px on the <text>; big result numbers 40+); Hebrew words in SVG ≥ 28. NO text under 28 units anywhere in the SVG. Keep the number of simultaneously visible labels small (≤ 6) and spaced so nothing overlaps at that size. Formula chunks (HTML) ≤ ~22 characters each so they wrap cleanly.
3. Nothing cut off: all content inside the viewBox with ≥ 12 units margin (text-anchor aware: estimate text width ≈ 0.55 × font-size × characters). No overlapping text/shapes at any time t.
4. MATH MUST BE EXACTLY CORRECT at every frame: every shape's proportions match the numbers (e.g. a 12-wide rectangle drawn as 12 unit-columns), every count matches (draw the actual number of objects), every equation true.
5. Loops smoothly (clean seam). Total 10–16 s. At t = hold the completed picture + full formula row must be on screen and readable.
6. Self-contained: no network, no external assets, no <image>, no <foreignObject>, no CSS transitions/animations, no secrets, no eval.
7. Use unique data-el names; every `q(root,'x')` you call must exist in svgMarkup. Defensive: render must not throw if an element is missing.
8. Teach the topic below in clear visual steps; the picture must carry the idea (not just text). Keep it to ONE main idea, calm pacing for 9–11 year olds / 11–12 year olds.


## Two CSS traps found in review rounds (obey exactly)
A. GREEN: `.concept-loop .cl-t{fill:navy}` OUTRANKS the class `cl-ok`, so `class="cl-ok"` on an SVG <text> stays navy. To make SVG text green set it inline: `style="fill:#2e9d57"` (toggle it in render via `el.style.fill = '#2e9d57'` only when the result is revealed, or put it in the markup style and fade the element in). Same for SVG strokes/fills of the final-result chip. HTML formula spans may use class `cl-ok` (that works for HTML `color`).
B. BIDI: every SVG <text> whose content is an equation, digits or math symbols MUST carry `cl-num` (forces LTR), otherwise the page's RTL direction reverses it (e.g. "40 + 8 = 48" renders as "48 = 8 + 40"). Text mixing Hebrew + digits uses `cl-num cl-rtl`. Pure Hebrew words need only `cl-t`.
C. `draw()` only works on elements with `pathLength="1"` and NO custom stroke-dasharray of your own; a dashed look and a draw-in effect cannot be combined on one element — for dashed outlines fade opacity in instead. Keep every label fully inside the viewBox (text-anchor end/start labels need ≥ 12 units margin counting ~0.6 × font-size per character).

## Existing film for reference (same engine; note size/format only — yours must obey the larger-text rule above, the old one is too small on phones)
Markup (l-split): `<rect class="cl-fill-a cl-stroke-a" x="150" y="70" width="88" height="66"/><text class="cl-t cl-num" data-el="n12" x="194" y="108" text-anchor="middle" style="opacity:0">12</text><g data-el="part4"><rect class="cl-fill-c cl-line" x="150" y="136" width="44" height="44"/>...</g>` with formula `<p class="concept-loop__formula cl-num" dir="ltr"><span data-fx="0">12 + 4 = 16</span><span data-fx="1" class="cl-check" aria-hidden="true">✓</span></p>`.
Render (l-split):
```ts
function renderLSplit(root, t) {
  const split = ph(t, 1.2, 2.4) - ph(t, 8.2, 9.3);
  const part = q(root, 'part4');
  if (part) part.setAttribute('transform', `translate(${r2(130 * split)} ${r2(8 * split)})`);
  const show = ph(t, 2.5, 2.9) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'n12'), show); op(q(root, 'n4'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6)));
}  // duration 10, hold 5.0
```
Render (baseten, F11 38+25=63, duration 10, hold 6.2) uses staged fades, ones flying with lerp between home/gather/target positions, an orange outline (`cl-ol`) around the groups that merge, a new orange rod (`cl-rod-new`), and the result label fading in, then everything flying back / fading before t=10.
