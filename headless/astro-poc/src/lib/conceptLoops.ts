/**
 * KIMI-LOOPS-K3 — engine for the ConceptLoop film loops.
 *
 * Vanilla JS, no libraries. One rAF clock per card; every element's state
 * is a pure function of the loop time t, so pause/resume/off-screen freeze
 * is exact and the loop seam (end state == start state) has no jump.
 *
 * Motion language (from REPORT_KIMI_COMPUTER_LOOPS.md + Brilliant guide):
 *   - moves last 0.3–0.8 s, eased with cubic-bezier(.16,1,.3,1)
 *   - 0.5–1.5 s still holds between moves
 *   - green is reserved for the "correct" result, once per lap
 *   - after 4 laps the loop parks on the completed state
 *   - explicit site a11y (html.nd-motion-off / html.noam-a11y-motion):
 *     completed state, fully static, toggle hidden. OS
 *     prefers-reduced-motion does not park the loop.
 */

type LoopRoot = HTMLElement & { __loop?: LoopDebug };

interface LoopDebug {
  seek: (t: number) => void;
  pause: () => void;
  play: () => void;
  state: () => { t: number; playing: boolean; laps: number; done: boolean; static: boolean };
}

/* ——— easing: exact cubic-bezier(.16,1,.3,1) via Newton–Raphson ——— */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const sd = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = sd(t);
      if (Math.abs(d) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - err / d));
    }
    return sy(t);
  };
}
const EASE = cubicBezier(0.16, 1, 0.3, 1);
export { EASE };

/** eased progress of t inside [a,b] */
const ph = (t: number, a: number, b: number) => EASE(Math.min(1, Math.max(0, (t - a) / (b - a))));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export { ph, lerp };
const r2 = (n: number) => Math.round(n * 100) / 100;

type El = SVGElement | HTMLElement;
const q = (root: LoopRoot, name: string) =>
  root.querySelector(`[data-el="${name}"]`) as El;
const qa = (root: LoopRoot, sel: string) =>
  Array.from(root.querySelectorAll(sel)) as El[];

const op = (el: El | null, v: number) => {
  if (el) el.style.opacity = String(r2(Math.min(1, Math.max(0, v))));
};
const draw = (el: El | null, p: number) => {
  if (el) el.style.strokeDashoffset = String(r2(1 - Math.min(1, Math.max(0, p))));
};
const move = (el: El | null, x: number, y: number, rot = 0) => {
  if (el) el.setAttribute('transform', `translate(${r2(x)} ${r2(y)}) rotate(${r2(rot)})`);
};
const shift = (el: El | null, dx: number, dy: number) => {
  if (el) el.setAttribute('transform', `translate(${r2(dx)} ${r2(dy)})`);
};

/* ═══════════════ variant A — triangle area (D = 10 s) ═══════════════
   corrected script (Noam, K3 fix): the 6×4 rectangle is 24, a diagonal
   cut shows the triangle is exactly HALF → 6·4/2 = 12; then the apex
   slides along a dashed line parallel to the base (beyond the base's
   width too) while 12 stays on screen — same base, same height, same
   area. Green + check only at the very end, next to "אותו שטח: 12". */

function renderTriangle(root: LoopRoot, t: number) {
  const OUT = ph(t, 8.8, 9.4); // formula/caption outro
  const keep = 1 - OUT;
  const TRI_OUT = 1 - ph(t, 8.6, 9.2); // triangle pieces outro

  // apex x on the rail: corner → left inside → beyond the right edge → settle
  const ax =
    t < 4.4
      ? 408
      : t < 5.4
        ? lerp(408, 170, ph(t, 4.4, 5.4))
        : t < 6.2
          ? lerp(170, 452, ph(t, 5.4, 6.2))
          : lerp(452, 290, ph(t, 6.2, 6.8));

  // the half story: "6·4 = 24" in the rectangle, then the diagonal cut
  op(q(root, 'lbl24'), ph(t, 0.8, 1.1) * (1 - ph(t, 2.6, 3.0)));
  const dg = q(root, 'diag');
  op(dg, ph(t, 1.3, 1.5) * (1 - ph(t, 4.4, 4.9)));
  draw(dg, ph(t, 1.4, 2.0));

  // the triangle: right half of the rectangle, then shears along the rail
  const fill = q(root, 'tri-fill');
  const ll = q(root, 'tri-line-l');
  const lr = q(root, 'tri-line-r');
  fill.setAttribute('d', `M132 262 L408 262 L${r2(ax)} 78 Z`);
  ll.setAttribute('x2', String(r2(ax)));
  lr.setAttribute('x2', String(r2(ax)));
  op(fill, ph(t, 2.3, 2.7) * TRI_OUT);
  op(ll, ph(t, 2.0, 2.2) * TRI_OUT);
  draw(ll, ph(t, 2.0, 2.6));
  op(lr, ph(t, 2.0, 2.2) * TRI_OUT);
  draw(lr, ph(t, 2.0, 2.6));

  // base-line extension guide + apex dot appear for the slide
  op(q(root, 'basext'), ph(t, 4.4, 4.8) * TRI_OUT);
  const ad = q(root, 'apex-dot');
  ad.setAttribute('cx', String(r2(ax)));
  op(ad, ph(t, 4.3, 4.6) * TRI_OUT);

  // height follows the apex (also outside the base's width); it parks back
  // at its home corner while invisible, so the loop seam has no jump
  const h = q(root, 'height');
  const lh = q(root, 'lbl-h');
  const hx = t < 9.15 ? ax : 408;
  const hop = t < 8.6 ? 1 : t < 9.2 ? 1 - ph(t, 8.6, 9.2) : ph(t, 9.3, 9.8);
  h.setAttribute('x1', String(r2(hx)));
  h.setAttribute('x2', String(r2(hx)));
  lh.setAttribute('x', String(r2(hx + 12)));
  op(h, hop);
  op(lh, hop);

  // formula S = a·h/2 = 6·4/2 = 12 — constant through the slide
  const fxT = [2.6, 3.0, 3.4];
  qa(root, '[data-fx]').forEach((el, i) => {
    const p = ph(t, fxT[i] ?? 9, (fxT[i] ?? 9) + 0.3);
    op(el, p * keep);
    (el as HTMLElement).style.transform = `translateY(${r2((1 - p) * 5)}px)`;
  });

  // green + check only at the very end
  op(q(root, 'caption'), ph(t, 7.0, 7.5) * keep);
  const ck = q(root, 'check') as HTMLElement;
  const cp = ph(t, 7.3, 7.7);
  op(ck, cp * keep);
  if (ck) ck.style.transform = `scale(${r2(0.5 + 0.5 * cp)})`;
}
const TRI_HOLD = 7.8;

/* ═══════════════ variant B — pythagoras (D = 10 s) ═══════════════ */

function tileFlight(el: El, t: number, popAt: number, flyAt: number, retAt: number) {
  const home = (el.getAttribute('data-home') || '0,0').split(',').map(Number);
  const target = (el.getAttribute('data-target') || '0,0').split(',').map(Number);
  const rot = Number(el.getAttribute('data-rot') || 0);
  const FLY = 0.5;
  const RET = 0.45;

  const vis = ph(t, popAt, popAt + 0.25) * (1 - ph(t, retAt + RET, retAt + RET + 0.15));
  let x: number, y: number, r: number;
  if (t < flyAt) {
    [x, y, r] = [home[0], home[1], 0];
  } else if (t < retAt) {
    const p = ph(t, flyAt, flyAt + FLY);
    [x, y, r] = [lerp(home[0], target[0], p), lerp(home[1], target[1], p), rot * p];
  } else {
    const p = ph(t, retAt, retAt + RET);
    [x, y, r] = [lerp(target[0], home[0], p), lerp(target[1], home[1], p), rot * (1 - p)];
  }
  op(el, vis);
  move(el, x, y, r);
}

function renderPythagoras(root: LoopRoot, t: number) {
  const SQ_OUT = 1 - ph(t, 9.3, 9.9);
  const FX_OUT = 1 - ph(t, 8.9, 9.5);

  // squares on the legs + dashed target square on the hypotenuse
  const sqA = q(root, 'sq-a');
  op(sqA, ph(t, 0.5, 0.7) * SQ_OUT);
  draw(sqA, ph(t, 0.6, 1.0));
  const sqB = q(root, 'sq-b');
  op(sqB, ph(t, 1.8, 2.0) * SQ_OUT);
  draw(sqB, ph(t, 1.9, 2.3));
  const sqC = q(root, 'sq-c');
  // dashed target square: fades in (a dash-draw would fight its dashed style)
  op(sqC, ph(t, 3.3, 3.9) * SQ_OUT);

  // tiles: 9 blue then 16 purple migrate into the c-square
  qa(root, '[data-el="tiles-a"] rect').forEach((el, k) =>
    tileFlight(el, t, 1.2 + k * 0.055, 4.0 + k * 0.09, 8.4 + k * 0.05)
  );
  qa(root, '[data-el="tiles-b"] rect').forEach((el, k) =>
    tileFlight(el, t, 2.5 + k * 0.04, 5.1 + k * 0.06, 8.9 + k * 0.04)
  );

  // c label: "c = ?" → green "c = 5" once the equation completes
  const lc = q(root, 'lbl-c');
  const solved = t >= 7.05 && t < 9.3;
  const want = solved ? 'c = 5' : 'c = ?';
  if (lc.textContent !== want) lc.textContent = want;
  lc.classList.toggle('cl-ok', solved);
  op(lc, ph(t, 3.3, 3.5) * SQ_OUT);

  // formula c² = 9 + 16 = 25, caption "ולכן c = 5" + check
  const fxT = [6.4, 6.6, 6.8];
  qa(root, '[data-fx]').forEach((el, i) => {
    const p = ph(t, fxT[i] ?? 9, (fxT[i] ?? 9) + 0.25);
    op(el, p * FX_OUT);
    (el as HTMLElement).style.transform = `translateY(${r2((1 - p) * 5)}px)`;
  });
  op(q(root, 'caption'), ph(t, 7.1, 7.5) * FX_OUT);
  const ck = q(root, 'check') as HTMLElement;
  const cp = ph(t, 7.3, 7.7);
  op(ck, cp * FX_OUT);
  if (ck) ck.style.transform = `scale(${r2(0.5 + 0.5 * cp)})`;
}
const PYT_HOLD = 7.6;

/* ═══════════════ variant C — area model (D = 11 s) ═══════════════ */

function renderAreaModel(root: LoopRoot, t: number) {
  const out = (a: number, b: number) => 1 - ph(t, a, b);

  // split lines draw in
  const sv = q(root, 'split-v');
  op(sv, ph(t, 0.5, 0.7) * out(10.5, 11.0));
  draw(sv, ph(t, 0.6, 1.0));
  const sh = q(root, 'split-h');
  op(sh, ph(t, 1.1, 1.3) * out(10.5, 11.0));
  draw(sh, ph(t, 1.2, 1.6));

  // four cells fill (x² blue, 2x purple, 3x orange, 6 gray + minis)
  op(q(root, 'cell-x2'), ph(t, 1.8, 2.2) * out(10.5, 10.9));
  op(q(root, 'term-x2'), ph(t, 2.0, 2.3) * out(10.5, 10.9));
  op(q(root, 'cell-2x'), ph(t, 2.5, 2.9) * out(10.0, 10.4));
  op(q(root, 'cell-3x'), ph(t, 3.1, 3.5) * out(9.5, 9.9));
  op(q(root, 'cell-6'), ph(t, 3.7, 4.0) * out(9.0, 9.4));
  qa(root, '[data-el="minis"] rect').forEach((el, k) =>
    // minis count in, then dim so the big "6" reads clearly on top
    op(el, ph(t, 3.8 + k * 0.1, 4.0 + k * 0.1) * (1 - 0.68 * ph(t, 4.5, 4.8)) * out(9.0, 9.3))
  );
  op(q(root, 'term-6'), ph(t, 4.2, 4.5) * out(9.0, 9.4));

  // merge: 2x and 3x labels converge and become 5x
  const m = ph(t, 5.8, 6.3);
  const t2 = q(root, 'term-2x');
  const t3 = q(root, 'term-3x');
  op(t2, ph(t, 2.7, 3.0) * (1 - ph(t, 6.2, 6.5)));
  op(t3, ph(t, 3.3, 3.6) * (1 - ph(t, 6.2, 6.5)));
  shift(t2, lerp(0, -47, m), lerp(0, 56, m)); // (318,122) → (271,178)
  shift(t3, lerp(0, 46, m), lerp(0, -56, m)); // (225,234) → (271,178)
  op(q(root, 'hl-2x'), ph(t, 5.6, 5.9) * (1 - ph(t, 6.4, 6.8)));
  op(q(root, 'hl-3x'), ph(t, 5.6, 5.9) * (1 - ph(t, 6.4, 6.8)));
  const m5 = ph(t, 6.3, 6.6) * out(9.7, 10.1);
  op(q(root, 'chip-5x'), m5);
  op(q(root, 'term-5x'), m5);

  // formula: full expansion, then collapses to the final result + check
  const fxT = [4.5, 4.7, 4.9, 5.1, 5.3];
  qa(root, '[data-fx]').forEach((el, i) => {
    let o: number;
    if (i <= 4) {
      o = ph(t, fxT[i], fxT[i] + 0.25);
      if (i >= 1 && i <= 4) o *= 1 - ph(t, 6.6, 7.0); // expansion steps fade for the result
    } else if (i === 5) {
      o = ph(t, 6.8, 7.2);
    } else {
      o = ph(t, 7.1, 7.5); // check
    }
    op(el, o * out(10.4, 10.9));
  });
  op(q(root, 'caption'), ph(t, 6.0, 6.4) * out(10.4, 10.9));
}
const AREA_HOLD = 7.5;

/* ═══════════════ F01 — sticks: 34 = 30 + 4 (D = 10 s) ═══════════════ */

function renderSticks(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.5, 8.1);

  qa(root, '[data-stick]').forEach((el) => {
    const i = Number(el.getAttribute('data-stick'));
    const home = (el.getAttribute('data-h') || '0,0,0,0').split(',').map(Number);
    const target = (el.getAttribute('data-t') || '0,0,0,0').split(',').map(Number);
    const grp = i < 30 ? Math.floor(i / 10) : 3; // bundles 0–2, singles 3
    const j = i % 10;
    const hlAt = grp < 3 ? 0.6 + grp * 1.0 : 3.6; // highlight beat in the grid
    const flyStart = grp < 3 ? 0.7 + grp * 1.0 + j * 0.04 : 3.7 + (i - 30) * 0.05;
    const flyDur = grp < 3 ? 0.7 : 0.5;
    const retStart = grp < 3 ? 8.0 + grp * 0.3 + j * 0.03 : 8.6 + (i - 30) * 0.05;

    let p: number; // 0 = grid home, 1 = bundle/ones target
    if (t < flyStart) p = 0;
    else if (t < retStart) p = ph(t, flyStart, flyStart + flyDur);
    else p = 1 - ph(t, retStart, retStart + 0.7);

    const se = el as SVGRectElement;
    se.setAttribute('x', String(r2(lerp(home[0], target[0], p))));
    se.setAttribute('y', String(r2(lerp(home[1], target[1], p))));
    se.setAttribute('width', String(r2(lerp(home[2], target[2], p))));
    se.setAttribute('height', String(r2(lerp(home[3], target[3], p))));
    // colour: navy at rest, accent blue in bundles, purple singles (CSS smooths fill)
    const fill =
      t < hlAt || t >= retStart ? 'var(--navy)' : grp < 3 ? 'var(--cobalt)' : '#7c3aed';
    if (se.style.fill !== fill) se.style.fill = fill;
  });

  for (let k = 0; k < 3; k++) {
    op(q(root, `band-${k}`), ph(t, 1.5 + k, 1.8 + k) * (1 - ph(t, 7.9 + k * 0.15, 8.3 + k * 0.15)));
    op(q(root, `blbl-${k}`), ph(t, 1.6 + k, 1.9 + k) * (1 - ph(t, 7.9, 8.3)));
  }
  op(q(root, 'digit-4'), ph(t, 3.9, 4.2) * (1 - ph(t, 7.8, 8.4)));
  op(q(root, 'digit-3'), ph(t, 4.4, 4.8) * (1 - ph(t, 7.8, 8.4)));

  const fxT = [5.0, 5.3, 5.6];
  qa(root, '[data-fx]').forEach((el, i) => op(el, ph(t, fxT[i] ?? 9, (fxT[i] ?? 9) + 0.3) * OUT));
}
const STICKS_HOLD = 6.5;

/* ═══════════════ F02 — number line: 47 < 52, 47 ≈ 50 (D = 10 s) ═══════════════ */

function renderNumberline(root: LoopRoot, t: number) {
  const X47 = 266.8;
  const X50 = 280;

  // blue point: drops onto 47, later slides to 50 (0.6 s), comes back
  const pt = q(root, 'pt47');
  const cy = lerp(108, 150, ph(t, 0.6, 1.2));
  const cx = t < 3.8 ? X47 : t < 8.0 ? lerp(X47, X50, ph(t, 3.8, 4.4)) : lerp(X50, X47, ph(t, 8.0, 8.6));
  pt.setAttribute('cx', String(r2(cx)));
  pt.setAttribute('cy', String(r2(cy)));
  op(pt, ph(t, 0.6, 0.9) * (1 - ph(t, 8.8, 9.4)));
  const l47 = q(root, 'lbl47');
  l47.setAttribute('x', String(r2(cx)));
  op(l47, ph(t, 0.9, 1.2) * (1 - ph(t, 8.8, 9.4)));
  op(q(root, 'tick47'), ph(t, 0.6, 0.8) * (1 - ph(t, 8.8, 9.2)));

  // purple point on 52: drops, later fades to an outline; its label retires
  // once the rounding story begins (it would crowd the sliding 47 label)
  const p52 = q(root, 'pt52');
  p52.setAttribute('cy', String(r2(lerp(108, 150, ph(t, 1.4, 2.0)))));
  (p52 as SVGElement).style.fillOpacity = String(r2(1 - ph(t, 3.0, 3.8)));
  op(p52, ph(t, 1.4, 1.7) * (1 - ph(t, 8.2, 8.8)));
  op(q(root, 'lbl52'), ph(t, 1.7, 2.0) * (1 - ph(t, 3.6, 4.0)));

  // the top question follows the phase: comparison first, then rounding
  op(q(root, 'topa'), 1 - ph(t, 3.6, 4.0));
  op(q(root, 'topb'), ph(t, 3.6, 4.0));

  // the comparison scene (arrow, then distance arcs) closes as the slide
  // to 50 begins — keeps the area around 50 uncluttered
  op(q(root, 'arrow'), ph(t, 2.2, 2.6) * (1 - ph(t, 3.7, 4.2)));
  ['arc40', 'arc50', 'd40', 'd50'].forEach((n) =>
    op(q(root, n), ph(t, 3.0, 3.4) * (1 - ph(t, 3.8, 4.3)))
  );

  // bottom bar: "47 < 52" gives way to "47 ≈ 50" + ✓
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 2.6, 3.0) * (1 - ph(t, 3.9, 4.3)));
  op(fxs[1], ph(t, 4.8, 5.2) * (1 - ph(t, 7.4, 8.0)));
  op(fxs[2], ph(t, 5.1, 5.5) * (1 - ph(t, 7.4, 8.0)));
}
const NL_HOLD = 6.5;

/* ═══════════════ F03 — ten frames: 7 + 5 = 12 (D = 10 s) ═══════════════ */

function renderTenframes(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.4, 8.0);
  const GONE = 1 - ph(t, 9.0, 9.6);

  qa(root, '[data-blue]').forEach((el) => {
    const i = Number(el.getAttribute('data-blue'));
    op(el, ph(t, 0.6 + i * 0.08, 0.85 + i * 0.08) * GONE);
    el.setAttribute('r', String(r2(lerp(6, 12, ph(t, 0.6 + i * 0.08, 0.9 + i * 0.08)))));
  });

  qa(root, '[data-purp]').forEach((el) => {
    const k = Number(el.getAttribute('data-purp'));
    const home = (el.getAttribute('data-h') || '0,0').split(',').map(Number);
    const target = (el.getAttribute('data-t') || '0,0').split(',').map(Number);
    const flyStart = k < 3 ? 2.2 + k * 0.12 : 3.2 + (k - 3) * 0.12;
    const retStart = 7.8 + k * 0.08;
    let cx: number, cyv: number;
    if (t < flyStart) [cx, cyv] = home;
    else if (t < retStart) {
      const p = ph(t, flyStart, flyStart + 0.5);
      [cx, cyv] = [lerp(home[0], target[0], p), lerp(home[1], target[1], p)];
    } else {
      const p = ph(t, retStart, retStart + 0.6);
      [cx, cyv] = [lerp(target[0], home[0], p), lerp(target[1], home[1], p)];
    }
    el.setAttribute('cx', String(r2(cx)));
    el.setAttribute('cy', String(r2(cyv)));
    op(el, ph(t, 1.4 + k * 0.08, 1.6 + k * 0.08) * GONE);
  });

  op(q(root, 'lbl7'), ph(t, 1.0, 1.3) * (1 - ph(t, 2.9, 3.2)));
  op(q(root, 'lbl10'), ph(t, 2.9, 3.2) * (1 - ph(t, 8.8, 9.3)));
  op(q(root, 'lbl2'), ph(t, 3.7, 4.0) * (1 - ph(t, 8.8, 9.3)));
  op(q(root, 'lbl5'), ph(t, 1.8, 2.1) * (1 - ph(t, 4.0, 4.4))); // the outside row empties once the 5 move in

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.0, 4.4) * OUT);
  op(fxs[1], ph(t, 4.8, 5.2) * OUT);
  op(fxs[2], ph(t, 5.1, 5.5) * OUT);
}
const TF_HOLD = 6.5;

/* ═══════════════ F04 — balance: 3 + □ = 8 (D = 11 s) ═══════════════ */

function renderBalance(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.2, 7.8);

  // beam tips 5° right when the left 3 cubes leave, level again when the
  // right 3 leave too (both pans give up the same weight)
  const deg = 5 * (ph(t, 1.8, 2.1) - ph(t, 3.0, 3.4));
  q(root, 'beam').setAttribute('transform', `rotate(${r2(deg)} 280 150)`);

  const riseL = q(root, 'rise-l');
  riseL.setAttribute('transform', `translate(0 ${r2(-34 * (ph(t, 1.5, 2.0) - ph(t, 8.2, 8.8)))})`);
  op(riseL, 1 - ph(t, 1.9, 2.3) + ph(t, 7.8, 8.2));
  const oll = q(root, 'oll');
  oll.setAttribute('transform', `translate(0 ${r2(-34 * (ph(t, 1.5, 2.0) - ph(t, 8.2, 8.8)))})`);
  op(oll, ph(t, 0.6, 0.9) * (1 - ph(t, 1.8, 2.1)));

  const riseR = q(root, 'rise-r');
  riseR.setAttribute('transform', `translate(0 ${r2(-34 * (ph(t, 2.7, 3.2) - ph(t, 9.2, 9.8)))})`);
  op(riseR, 1 - ph(t, 3.0, 3.4) + ph(t, 8.8, 9.2));
  const olr = q(root, 'olr');
  olr.setAttribute('transform', `translate(0 ${r2(-34 * (ph(t, 2.7, 3.2) - ph(t, 9.2, 9.8)))})`);
  op(olr, ph(t, 2.4, 2.7) * (1 - ph(t, 3.1, 3.4)));

  // the unknown box turns transparent: 5 cubes inside
  (q(root, 'box') as SVGElement).style.fillOpacity = String(r2(1 - 0.75 * ph(t, 4.2, 4.8) + 0.75 * ph(t, 7.0, 7.6)));
  op(q(root, 'boxq'), 1 - ph(t, 4.2, 4.6) + ph(t, 7.2, 7.6));
  qa(root, '[data-mini2]').forEach((el) => op(el, ph(t, 4.2, 4.6) * (1 - ph(t, 7.0, 7.5))));

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.4, 3.8) * (1 - ph(t, 4.6, 5.0)));
  op(fxs[1], ph(t, 4.9, 5.3) * OUT);
  op(fxs[2], ph(t, 5.1, 5.5) * OUT);
}
const BAL_HOLD = 6.0;

/* ═══════════════ F05 — pattern: 2, 5, 8, 11, 14 (D = 11 s) ═══════════════ */

function renderPattern(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.0, 7.6);

  for (let k = 2; k <= 4; k++) {
    op(q(root, `hl${k}`), ph(t, 0.6 + (k - 2) * 0.8, 0.9 + (k - 2) * 0.8) * (1 - ph(t, 7.6, 8.1)));
  }
  for (let k = 1; k <= 3; k++) {
    const o = ph(t, 0.9 + (k - 1) * 0.8, 1.2 + (k - 1) * 0.8) * (1 - ph(t, 7.4, 7.9));
    op(q(root, `arc${k}`), o);
    op(q(root, `arcl${k}`), o);
  }

  // stage 5: copy of stage 4 slides into the dashed slot; orange column grows
  const s5 = q(root, 's5copy');
  s5.setAttribute('transform', `translate(${r2(100 * (ph(t, 3.0, 3.6) - ph(t, 8.6, 9.2)))} 0)`);
  op(s5, ph(t, 3.0, 3.3) * (1 - ph(t, 8.4, 9.0)));
  const s5n = q(root, 's5new');
  s5n.setAttribute('transform', `translate(0 ${r2(18 * (1 - ph(t, 3.6, 4.2)) + 18 * ph(t, 7.2, 7.8))})`);
  op(s5n, ph(t, 3.6, 3.9) * (1 - ph(t, 7.2, 7.8)));

  op(q(root, 'q5'), 1 - ph(t, 4.2, 4.6) + ph(t, 7.0, 7.4));
  op(q(root, 'n14'), ph(t, 4.4, 4.8) * (1 - ph(t, 7.0, 7.5)));

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.4, 4.8) * OUT);
  op(fxs[1], ph(t, 4.8, 5.2) * OUT);
}
const PAT_HOLD = 6.0;

/* ═══════════════ F06 — bar model: 12 + 17 = 29 (D = 11 s) ═══════════════ */

function renderBars(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.2, 7.8);

  // Dana's bar grows right→left (width 0→192), shrinks back on the seam
  const wd = Math.max(0, 192 * (ph(t, 0.6, 1.4) - ph(t, 9.2, 10.0)));
  const bd = q(root, 'bar-d');
  bd.setAttribute('width', String(r2(wd)));
  bd.setAttribute('x', String(r2(460 - wd)));
  op(q(root, 'ld1'), ph(t, 1.2, 1.5) * (1 - ph(t, 9.0, 9.5)));

  // Ron's bar: a copy of Dana's slides down from her row
  const br = q(root, 'bar-r');
  br.setAttribute('transform', `translate(0 ${r2(-70 * (1 - ph(t, 1.4, 2.0)) - 70 * ph(t, 8.6, 9.2))})`);
  op(br, ph(t, 1.4, 1.7) * (1 - ph(t, 8.6, 9.2)));
  op(q(root, 'lr1'), ph(t, 1.8, 2.1) * (1 - ph(t, 8.4, 8.9)));

  // orange +5 extension continues Ron's bar
  const we = Math.max(0, 80 * (ph(t, 2.0, 2.6) - ph(t, 8.0, 8.6)));
  const be = q(root, 'bar-ext');
  be.setAttribute('width', String(r2(we)));
  be.setAttribute('x', String(r2(268 - we)));
  op(q(root, 'l5'), ph(t, 2.4, 2.7) * (1 - ph(t, 7.8, 8.3)));

  // brackets + their labels
  const brk = q(root, 'brk');
  op(brk, ph(t, 2.5, 2.7) * (1 - ph(t, 7.6, 8.1)));
  draw(brk, ph(t, 2.6, 3.2));
  op(q(root, 'lbl17'), ph(t, 3.0, 3.4) * (1 - ph(t, 7.6, 8.1)));
  const bv = q(root, 'brkv');
  op(bv, ph(t, 3.3, 3.5) * (1 - ph(t, 7.4, 7.9)));
  draw(bv, ph(t, 3.4, 4.0));
  op(q(root, 'q29'), ph(t, 3.8, 4.1) * (1 - ph(t, 4.4, 4.8)));

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.4, 4.8) * OUT);
  op(fxs[1], ph(t, 4.8, 5.2) * OUT);
}
const BARS_HOLD = 6.2;

/* ═══════════════ F07 — ruler: 1 m = 100 cm (D = 10 s) ═══════════════ */

function renderRuler(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 6.4, 7.0);

  for (let i = 0; i < 9; i++) {
    const d = q(root, `div-${i}`);
    op(d, ph(t, 1.2 + i * 0.12, 1.35 + i * 0.12) * (1 - ph(t, 7.2, 7.8)));
    draw(d, ph(t, 1.2 + i * 0.12, 1.5 + i * 0.12));
  }
  for (let i = 0; i < 10; i++) {
    op(q(root, `rcnt-${i}`), ph(t, 1.4 + i * 0.12, 1.7 + i * 0.12) * (1 - ph(t, 6.8, 7.4)));
  }
  const br = q(root, 'brace');
  op(br, ph(t, 2.5, 2.7) * (1 - ph(t, 6.6, 7.0)));
  draw(br, ph(t, 2.6, 3.0));
  op(q(root, 'ten'), ph(t, 2.8, 3.1) * (1 - ph(t, 6.6, 7.0)));

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.4, 3.7) * OUT);
  op(fxs[1], ph(t, 3.8, 4.2) * OUT);
  op(fxs[2], ph(t, 4.0, 4.4) * OUT);
}
const RULER_HOLD = 5.0;

/* ═══════════════ F08 — array: 4 × 3 = 3 × 4 = 12 (D = 10 s) ═══════════════ */

function renderArray(root: LoopRoot, t: number) {
  // the whole array group rotates 90° about its centre, then back
  const deg = 90 * (ph(t, 3.4, 4.0) - ph(t, 7.0, 7.6));
  q(root, 'arrgroup').setAttribute('transform', `rotate(${r2(deg)} 251 258)`);

  qa(root, '[data-arr]').forEach((el) => {
    const i = Number(el.getAttribute('data-arr'));
    const home = (el.getAttribute('data-h') || '0,0').split(',').map(Number);
    const target = (el.getAttribute('data-t') || '0,0').split(',').map(Number);
    const popAt = 0.6 + Math.floor(i / 3) * 0.15;
    const flyAt = 1.7 + i * 0.06;
    const retAt = 7.8 + i * 0.05;
    let x: number, y: number;
    if (t < flyAt) [x, y] = home;
    else if (t < retAt) {
      const p = ph(t, flyAt, flyAt + 0.5);
      [x, y] = [lerp(home[0], target[0], p), lerp(home[1], target[1], p)];
    } else {
      const p = ph(t, retAt, retAt + 0.5);
      [x, y] = [lerp(target[0], home[0], p), lerp(target[1], home[1], p)];
    }
    el.setAttribute('cx', String(r2(x)));
    el.setAttribute('cy', String(r2(y)));
    op(el, ph(t, popAt, popAt + 0.2));
  });
  for (let k = 0; k < 4; k++) {
    op(q(root, `clbl-${k}`), ph(t, 0.8 + k * 0.15, 1.1 + k * 0.15) * (1 - ph(t, 1.7, 2.1)) + ph(t, 8.6, 9.0));
  }

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 2.8, 3.2) * (1 - ph(t, 3.6, 4.0)));
  op(fxs[1], ph(t, 4.2, 4.6) * (1 - ph(t, 6.6, 7.2)));
  op(fxs[2], ph(t, 4.6, 5.0) * (1 - ph(t, 6.6, 7.2)));
}
const ARRAY_HOLD = 6.4;

/* ═══════════════ F09 — polygon: sides = vertices (D = 10 s) ═══════════════ */

function renderPolygon(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 6.6, 7.0);

  // side i completes at 1.4+i*0.7; sides fade (reverse order) at 7.4+(4-i)*0.24
  let sides = 0;
  let verts = t >= 0.7 ? 1 : 0;
  for (let i = 0; i < 5; i++) {
    const built = t >= 1.4 + i * 0.7;
    const gone = t >= 7.4 + (4 - i) * 0.24 + 0.2;
    if (built && !gone) sides++;
    if (i < 4 && built && !gone) verts++; // closing side adds no new vertex
    const s = q(root, `side-${i}`);
    op(s, ph(t, 0.9 + i * 0.7, 1.0 + i * 0.7) * (1 - ph(t, 7.4 + (4 - i) * 0.24, 7.4 + (4 - i) * 0.24 + 0.3)));
    draw(s, ph(t, 0.9 + i * 0.7, 1.4 + i * 0.7));
    const v = q(root, `vert-${i}`);
    const vBuilt = i === 0 ? t >= 0.7 : t >= 1.4 + (i - 1) * 0.7;
    const vGone = t >= 8.2 + (5 - i) * 0.12;
    op(v, vBuilt ? (vGone ? 1 - ph(t, 8.2 + (5 - i) * 0.12, 8.2 + (5 - i) * 0.12 + 0.2) : 1) : 0);
  }
  op(q(root, 'pent-fill'), ph(t, 4.2, 4.7) * (1 - ph(t, 7.0, 7.5)));

  const cs = q(root, 'cnt-side');
  const cv = q(root, 'cnt-vert');
  const sideTxt = String(sides);
  const vertTxt = String(verts);
  if (cs.textContent !== sideTxt) cs.textContent = sideTxt;
  if (cv.textContent !== vertTxt) cv.textContent = vertTxt;
  const done = t >= 4.8 && t < 6.8;
  cs.classList.toggle('cl-ok', done);
  cv.classList.toggle('cl-ok', done);

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.8, 5.2) * OUT);
  op(fxs[1], ph(t, 5.0, 5.4) * OUT);
}
const POLY_HOLD = 5.2;

/* ═══════════════ F10 — data: tally → bars → pie (D = 11 s) ═══════════════ */

function renderData(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.6, 8.2);

  // top question per representation phase
  op(q(root, 'top0'), 1 - ph(t, 2.4, 2.8));
  op(q(root, 'top1'), ph(t, 2.4, 2.8) * (1 - ph(t, 3.8, 4.2)));
  op(q(root, 'top2'), ph(t, 3.8, 4.2));

  const vals = [8, 5, 3];
  qa(root, '[data-tally]').forEach((el) => {
    const [ri, m] = (el.getAttribute('data-tally') || '0-0').split('-').map(Number);
    op(el, ph(t, 0.6 + ri * 0.3 + m * 0.1, 0.8 + ri * 0.3 + m * 0.1) * (1 - ph(t, 9.4, 10.0)));
  });
  qa(root, '[data-bar]').forEach((el) => {
    const ri = Number(el.getAttribute('data-bar'));
    const p = ph(t, 2.2 + ri * 0.3, 2.9 + ri * 0.3) - ph(t, 8.8 + ri * 0.15, 9.3 + ri * 0.15);
    const h = Math.max(0, vals[ri] * 18 * p);
    el.setAttribute('height', String(r2(h)));
    el.setAttribute('y', String(r2(260 - h)));
    op(el, ph(t, 2.2 + ri * 0.3, 2.4 + ri * 0.3) * (1 - ph(t, 9.0 + ri * 0.15, 9.4 + ri * 0.15)));
  });
  qa(root, '[data-barlbl]').forEach((el, i) =>
    op(el, ph(t, 2.7 + i * 0.3, 3.0 + i * 0.3) * (1 - ph(t, 8.6, 9.2)))
  );
  qa(root, '[data-slice]').forEach((el, i) =>
    op(el, ph(t, 3.6 + i * 0.3, 4.0 + i * 0.3) * (1 - ph(t, 8.2, 8.8)))
  );
  qa(root, '[data-slicelbl]').forEach((el, i) =>
    op(el, ph(t, 4.2 + i * 0.3, 4.5 + i * 0.3) * (1 - ph(t, 8.2, 8.8)))
  );

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 5.4, 5.8) * OUT);
  op(fxs[1], ph(t, 5.8, 6.2) * OUT);
  op(fxs[2], ph(t, 6.0, 6.4) * OUT);
}
const DATA_HOLD = 7.0;

/* ═══════════════ F11 — base-ten: 38 + 25 = 63 (D = 10 s) ═══════════════ */

function renderBaseten(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.2, 7.6);
  const GONE = 1 - ph(t, 9.4, 9.9);
  const ROD = { x: 340, y: 150 }; // merge target (new rod)
  const rodCx = ROD.x + 7;
  const rodCy = ROD.y + 45;

  qa(root, '[data-rod38]').forEach((el, i) => op(el, ph(t, 0.6 + i * 0.12, 0.85 + i * 0.12) * (1 - ph(t, 9.2, 9.7))));
  qa(root, '[data-rod25]').forEach((el, i) => op(el, ph(t, 1.4 + i * 0.12, 1.65 + i * 0.12) * (1 - ph(t, 9.2, 9.7))));
  op(q(root, 'lbl38'), ph(t, 1.0, 1.3) * (1 - ph(t, 9.2, 9.7)));
  op(q(root, 'lbl25'), ph(t, 1.8, 2.1) * (1 - ph(t, 9.2, 9.7)));

  const flyOne = (el: El, k: number, merged: boolean, appearAt: number, flyAt: number) => {
    const home = (el.getAttribute('data-h') || '0,0').split(',').map(Number);
    const gather = (el.getAttribute('data-t') || '0,0').split(',').map(Number);
    let x = home[0], y = home[1], vis = ph(t, appearAt, appearAt + 0.2) * GONE;
    if (merged) {
      if (t < flyAt) [x, y] = home;
      else if (t < 3.4) {
        const p = ph(t, flyAt, flyAt + 0.5);
        [x, y] = [lerp(home[0], gather[0], p), lerp(home[1], gather[1], p)];
      } else if (t < 3.9) {
        const p = ph(t, 3.4, 3.9);
        [x, y] = [lerp(gather[0], rodCx - 7.5, p), lerp(gather[1], rodCy - 7.5, p)];
        vis *= 1 - ph(t, 3.7, 3.9);
      } else if (t < 7.8) {
        vis = 0; // consumed into the rod
        [x, y] = [rodCx - 7.5, rodCy - 7.5];
      } else if (t < 8.3) {
        [x, y] = [rodCx - 7.5, rodCy - 7.5];
        vis = ph(t, 7.8, 8.3) * GONE;
      } else if (t < 8.8) {
        const p = ph(t, 8.3, 8.8);
        [x, y] = [lerp(rodCx - 7.5, gather[0], p), lerp(rodCy - 7.5, gather[1], p)];
      } else if (t < 9.4) {
        const p = ph(t, 8.8, 9.4);
        [x, y] = [lerp(gather[0], home[0], p), lerp(gather[1], home[1], p)];
      }
    } else {
      if (t < flyAt) [x, y] = home;
      else if (t < 8.8) {
        const p = ph(t, flyAt, flyAt + 0.5);
        [x, y] = [lerp(home[0], gather[0], p), lerp(home[1], gather[1], p)];
      } else {
        const p = ph(t, 8.8, 9.4);
        [x, y] = [lerp(gather[0], home[0], p), lerp(gather[1], home[1], p)];
      }
    }
    el.setAttribute('x', String(r2(x)));
    el.setAttribute('y', String(r2(y)));
    op(el, vis);
  };
  qa(root, '[data-one38]').forEach((el) => {
    const i = Number(el.getAttribute('data-one38'));
    flyOne(el, i, true, 0.8 + i * 0.06, 2.2 + i * 0.05);
  });
  qa(root, '[data-one25]').forEach((el) => {
    const i = Number(el.getAttribute('data-one25'));
    flyOne(el, i, i < 2, 1.6 + i * 0.06, 2.5 + i * 0.05);
  });

  op(q(root, 'merge-ol-a'), ph(t, 3.0, 3.3) * (1 - ph(t, 3.7, 4.0)));
  op(q(root, 'merge-ol-b'), ph(t, 3.0, 3.3) * (1 - ph(t, 3.7, 4.0)));
  op(q(root, 'newrod'), ph(t, 3.9, 4.4) * (1 - ph(t, 7.8, 8.3)));
  op(q(root, 'lbl63'), ph(t, 4.4, 4.7) * (1 - ph(t, 7.8, 8.2)));

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.6, 5.0) * OUT);
  op(fxs[1], ph(t, 5.0, 5.4) * OUT);
  op(fxs[2], ph(t, 5.2, 5.6) * OUT);
}
const BT_HOLD = 6.2;

/* ═══════════════ F12 — cookies: 14 = 4 × 3 + 2 (D = 10 s) ═══════════════ */

function renderCookies(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 6.8, 7.4);

  qa(root, '[data-cookie]').forEach((el) => {
    const i = Number(el.getAttribute('data-cookie'));
    const home = (el.getAttribute('data-h') || '0,0').split(',').map(Number);
    const target = (el.getAttribute('data-t') || '0,0').split(',').map(Number);
    const flyAt = 1.3 + i * 0.16;
    const retAt = 7.6 + i * 0.1;
    let x = home[0], y = home[1];
    if (i < 12) {
      if (t < flyAt) [x, y] = home;
      else if (t < retAt) {
        const p = ph(t, flyAt, flyAt + 0.45);
        [x, y] = [lerp(home[0], target[0], p), lerp(home[1], target[1], p)];
      } else {
        const p = ph(t, retAt, retAt + 0.5);
        [x, y] = [lerp(target[0], home[0], p), lerp(target[1], home[1], p)];
      }
    }
    el.setAttribute('cx', String(r2(x)));
    el.setAttribute('cy', String(r2(y)));
    op(el, ph(t, 0.6 + i * 0.05, 0.8 + i * 0.05));
  });

  op(q(root, 'left-12'), ph(t, 3.4, 3.8) * (1 - ph(t, 7.2, 7.6)));
  op(q(root, 'left-13'), ph(t, 3.4, 3.8) * (1 - ph(t, 7.2, 7.6)));
  op(q(root, 'lbl-left'), ph(t, 3.6, 4.0) * (1 - ph(t, 7.2, 7.6)));

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.0, 4.4) * OUT);
  op(fxs[1], ph(t, 4.4, 4.8) * OUT);
}
const CK_HOLD = 6.2;

/* ═══════════════ F13 — fraction: 1/4 three ways (D = 10 s) ═══════════════ */

function renderFraction(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.4, 8.0);
  const FADE = 1 - ph(t, 8.2, 8.8);

  const cv = q(root, 'cut-v');
  op(cv, ph(t, 0.9, 1.1) * FADE);
  draw(cv, ph(t, 1.0, 1.4));
  const ch = q(root, 'cut-h');
  op(ch, ph(t, 1.1, 1.3) * FADE);
  draw(ch, ph(t, 1.2, 1.6));
  op(q(root, 'q-shade'), ph(t, 1.5, 2.0) * (1 - ph(t, 8.0, 8.6)));
  op(q(root, 'q-lbl'), ph(t, 2.0, 2.4) * (1 - ph(t, 8.0, 8.5)));

  const bo = q(root, 'bar-o');
  op(bo, ph(t, 2.5, 2.7) * (1 - ph(t, 8.0, 8.5)));
  draw(bo, ph(t, 2.6, 3.1));
  for (let k = 1; k <= 3; k++) {
    const d = q(root, `bar-d${k}`);
    op(d, ph(t, 3.1, 3.3) * (1 - ph(t, 8.0, 8.5)));
    draw(d, ph(t, 3.1 + k * 0.06, 3.35 + k * 0.06));
  }
  op(q(root, 'bar-shade'), ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.5)));
  op(q(root, 'bar-lbl'), ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.5)));

  const nl = q(root, 'nl');
  op(nl, ph(t, 3.5, 3.7) * (1 - ph(t, 8.0, 8.5)));
  draw(nl, ph(t, 3.6, 4.0));
  op(q(root, 'nl0'), ph(t, 3.8, 4.0) * (1 - ph(t, 8.0, 8.5)));
  op(q(root, 'nl1'), ph(t, 3.8, 4.0) * (1 - ph(t, 8.0, 8.5)));
  op(q(root, 'nl-pt'), ph(t, 4.0, 4.4) * (1 - ph(t, 8.0, 8.5)));
  op(q(root, 'nl-lbl'), ph(t, 4.2, 4.6) * (1 - ph(t, 8.0, 8.5)));

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.6, 5.0) * OUT);
  op(fxs[1], ph(t, 5.0, 5.4) * OUT);
}
const FRAC_HOLD = 6.4;

/* ═══════════════ F14 — transform: reflect, rotate, translate (D = 11 s) ═══════════════ */

function renderTransform(root: LoopRoot, t: number) {
  const OUT = 1 - ph(t, 7.2, 7.8);

  // top question per phase
  op(q(root, 'top0'), 1 - ph(t, 2.2, 2.5));
  op(q(root, 'top1'), ph(t, 2.2, 2.5) * (1 - ph(t, 3.6, 3.9)));
  op(q(root, 'top2'), ph(t, 3.6, 3.9));

  const AXIS = 260;
  const PIV = { x: 400, y: 90 };
  const MOVE = { dx: 40, dy: 60 };
  const GHOST = [
    { x: 120, y: 90 },
    { x: 60, y: 190 },
    { x: 190, y: 190 },
  ];

  const rp = ph(t, 1.1, 2.1) - ph(t, 9.2, 9.8); // reflect
  const th = (Math.PI / 2) * (ph(t, 2.5, 3.5) - ph(t, 8.6, 9.2)); // rotate 90° cw
  const tp = ph(t, 3.6, 4.2) - ph(t, 8.0, 8.6); // translate
  const cos = Math.cos(th);
  const sin = Math.sin(th);

  const pts = GHOST.map((v) => {
    const mx = lerp(v.x, 2 * AXIS - v.x, rp); // mirror across the axis
    const my = v.y;
    const dx = mx - PIV.x;
    const dy = my - PIV.y;
    const rx = PIV.x + dx * cos + dy * sin; // cw in screen coords
    const ry = PIV.y - dx * sin + dy * cos;
    return `${r2(rx + MOVE.dx * tp)},${r2(ry + MOVE.dy * tp)}`;
  }).join(' ');

  const cp = q(root, 'copy');
  cp.setAttribute('points', pts);
  op(cp, ph(t, 0.6, 0.8) * (1 - ph(t, 9.8, 10.2)));
  const cf = q(root, 'copy-fill');
  cf.setAttribute('points', pts);
  op(cf, ph(t, 0.7, 1.0) * (1 - ph(t, 9.8, 10.2)));

  op(q(root, 'axis'), ph(t, 0.8, 1.0) * (1 - ph(t, 9.6, 10.0)));
  op(q(root, 'pivot'), ph(t, 2.2, 2.5) * (1 - ph(t, 8.4, 8.9)));

  // translation vector from the rotated position to the final one
  const vec = q(root, 'vec');
  const vh = q(root, 'vec-head');
  if (t >= 3.6 && t < 9.2) {
    const cx = 466.7 + MOVE.dx * tp;
    const cy = 93.3 + MOVE.dy * tp;
    const fx2 = 466.7 + MOVE.dx;
    const fy2 = 93.3 + MOVE.dy;
    vec.setAttribute('x1', String(r2(cx)));
    vec.setAttribute('y1', String(r2(cy)));
    vec.setAttribute('x2', String(r2(fx2)));
    vec.setAttribute('y2', String(r2(fy2)));
    vh.setAttribute('d', `M${r2(fx2)} ${r2(fy2)} l -10 -1 l 4 9 Z`);
  }
  const vecOp = ph(t, 3.6, 3.9) * (1 - ph(t, 4.6, 5.0));
  op(vec, vecOp);
  op(vh, vecOp);

  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.6, 5.0) * OUT);
  op(fxs[1], ph(t, 5.0, 5.4) * OUT);
}
const TRANS_HOLD = 6.8;

/* ═══════════════ L01 — angle-sum: three wedges join a straight line (D = 10 s) ═══════════════ */

function renderAngleSum(root: LoopRoot, t: number) {
  const moveP = ph(t, 2.0, 3.5) - ph(t, 8.2, 9.4);
  const homes = [
    { x: 168, y: 236 },
    { x: 392, y: 236 },
    { x: 280, y: 118 },
  ];
  const targets = [
    { x: 168, y: 300 },
    { x: 248, y: 300 },
    { x: 328, y: 300 },
  ];
  for (let i = 0; i < 3; i++) {
    const g = q(root, `ang${i}`);
    const x = lerp(homes[i].x, targets[i].x, moveP);
    const y = lerp(homes[i].y, targets[i].y, moveP);
    if (g) g.setAttribute('transform', `translate(${r2(x)} ${r2(y)})`);
    op(g, ph(t, 0.7, 1.1) * (1 - ph(t, 9.4, 9.8)));
  }
  const line = q(root, 'straight');
  op(line, ph(t, 3.2, 3.6) * (1 - ph(t, 8.4, 9.0)));
  draw(line, ph(t, 3.3, 4.0));
  op(q(root, 'lbl180'), ph(t, 4.0, 4.4) * (1 - ph(t, 8.2, 8.8)));
  const fxs = qa(root, '[data-fx]');
  const show = ph(t, 4.5, 4.9) * (1 - ph(t, 8.0, 8.6));
  op(fxs[0], show);
  op(fxs[1], ph(t, 4.9, 5.3) * (1 - ph(t, 8.0, 8.6)));
}
const ANGLE_SUM_HOLD = 6.2;

/* ═══════════════ L02 — para-rect: parallelogram shears into a rectangle (D = 10 s) ═══════════════ */

function renderParaRect(root: LoopRoot, t: number) {
  const flat = ph(t, 1.3, 2.7) - ph(t, 8.1, 9.3);
  const s = 72 * (1 - flat);
  const shape = q(root, 'shape');
  if (shape) shape.setAttribute('points', `160,240 400,240 ${r2(400 + s)},128 ${r2(160 + s)},128`);
  op(q(root, 'height'), 1);
  op(q(root, 'lbl-h'), ph(t, 0.6, 1.0));
  op(q(root, 'lbl-same'), ph(t, 2.8, 3.3) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.7, 4.1) * (1 - ph(t, 8.0, 8.6)));
}
const PARA_RECT_HOLD = 5.4;

/* ═══════════════ L03 — angle-kinds: acute, right, obtuse (D = 10 s) ═══════════════ */

function renderAngleKinds(root: LoopRoot, t: number) {
  const toAcute = ph(t, 0.5, 1.5);
  const toRight = ph(t, 2.1, 3.1);
  const toObtuse = ph(t, 3.7, 4.8);
  const back = ph(t, 8.2, 9.4);
  let deg = lerp(26, 42, toAcute);
  deg = lerp(deg, 90, toRight);
  deg = lerp(deg, 128, toObtuse);
  deg = lerp(deg, 26, back);
  const rad = (deg * Math.PI) / 180;
  const ray = q(root, 'ray');
  if (ray) {
    ray.setAttribute('x2', String(r2(180 + 160 * Math.cos(rad))));
    ray.setAttribute('y2', String(r2(230 - 160 * Math.sin(rad))));
  }
  const nearRight = deg > 78 && deg < 102 && back < 0.15 ? 1 : 0;
  op(q(root, 'square'), nearRight * (1 - toObtuse));
  op(q(root, 'lbl-acute'), (deg < 70 && toRight < 0.4 && back < 0.2 ? 1 : 0));
  op(q(root, 'lbl-right'), nearRight * (1 - ph(t, 3.5, 3.9)));
  op(q(root, 'lbl-obtuse'), (deg > 108 && back < 0.25 ? 1 : 0) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.9, 5.3) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 5.3, 5.7) * (1 - ph(t, 8.0, 8.6)));
}
const ANGLE_KINDS_HOLD = 6.2;

/* ═══════════════ L04 — frac-product: half of a third is a sixth (D = 10 s) ═══════════════ */

function renderFracProduct(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'half'), ph(t, 0.8, 1.4) * fade);
  op(q(root, 'third'), ph(t, 1.8, 2.4) * fade);
  op(q(root, 'overlap'), ph(t, 2.8, 3.4) * fade);
  op(q(root, 'lbl-half'), ph(t, 1.2, 1.6) * fade);
  op(q(root, 'lbl-third'), ph(t, 2.2, 2.6) * fade);
  op(q(root, 'lbl-sixth'), ph(t, 3.3, 3.8) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.8, 4.2) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 4.2, 4.6) * (1 - ph(t, 8.0, 8.6)));
}
const FRAC_PRODUCT_HOLD = 5.8;

/* ═══════════════ L05 — slope: rise 2, run 1, twice (D = 10 s) ═══════════════ */

function renderSlope(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const line = q(root, 'line');
  op(line, ph(t, 0.5, 0.8) * fade);
  draw(line, ph(t, 0.6, 1.8));
  op(q(root, 'tri1'), ph(t, 2.0, 2.6) * fade);
  op(q(root, 'run1'), ph(t, 2.2, 2.6) * fade);
  op(q(root, 'rise1'), ph(t, 2.6, 3.1) * fade);
  op(q(root, 'tri2'), ph(t, 3.3, 3.9) * fade);
  op(q(root, 'run2'), ph(t, 3.5, 3.9) * fade);
  op(q(root, 'rise2'), ph(t, 3.9, 4.3) * fade);
  op(q(root, 'lbl2'), ph(t, 4.3, 4.7) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.6, 5.0) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 5.0, 5.4) * (1 - ph(t, 8.0, 8.6)));
  // Grid, ticks, dots and pairs are added on the existing drawing.
  // They are on screen from the start and leave with the same fade.
  op(q(root, 'pts'), fade);
  op(q(root, 'pairs'), fade);
}
const SLOPE_HOLD = 6.2;

/* ═══════════════ L06 — add-within: 3 dots join 4 dots (D = 10 s) ═══════════════ */

function renderAddWithin(root: LoopRoot, t: number) {
  const slide = ph(t, 1.2, 2.4) - ph(t, 8.2, 9.3);
  const g = q(root, 'group3');
  if (g) g.setAttribute('transform', `translate(${r2(96 * slide)} 0)`);
  op(q(root, 'lbl3'), ph(t, 0.4, 0.8) * (1 - ph(t, 2.2, 2.6)));
  op(q(root, 'lbl4'), ph(t, 0.5, 0.9) * (1 - ph(t, 2.4, 2.8)));
  op(q(root, 'lbl7'), ph(t, 2.6, 3.1) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.1, 3.5) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.5, 3.9) * (1 - ph(t, 8.0, 8.6)));
}
const ADD_WITHIN_HOLD = 5.2;

/* ═══════════════ L07 — similar: triangle doubles, angles stay (D = 10 s) ═══════════════ */

function renderSimilar(root: LoopRoot, t: number) {
  const grow = ph(t, 1.2, 2.6) - ph(t, 8.2, 9.4);
  const big = q(root, 'big');
  const bx = lerp(240, 320, grow);
  const cy = lerp(190, 130, grow);
  if (big) big.setAttribute('points', `160,250 ${r2(bx)},250 160,${r2(cy)}`);
  const vis = ph(t, 0.8, 1.2) * (1 - ph(t, 9.2, 9.7));
  op(big, vis);
  op(q(root, 'lbl-leg'), vis);
  op(q(root, 'lbl-ht'), vis);
  op(q(root, 'arc-big'), ph(t, 2.4, 2.9) * (1 - ph(t, 8.4, 9.0)));
  const leg = q(root, 'lbl-leg');
  const ht = q(root, 'lbl-ht');
  if (leg) {
    leg.textContent = grow > 0.85 ? '8' : '4';
    leg.setAttribute('x', String(r2((160 + bx) / 2)));
    leg.setAttribute('y', '268');
  }
  if (ht) {
    ht.textContent = grow > 0.85 ? '6' : '3';
    ht.setAttribute('x', '142');
    ht.setAttribute('y', String(r2((250 + cy) / 2 + 5)));
  }
  op(q(root, 'lbl-same'), ph(t, 3.0, 3.5) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.8, 4.2) * (1 - ph(t, 8.0, 8.6)));
}
const SIMILAR_HOLD = 5.4;

/* ═══════════════ L08 — order-ops: 2+3×4 = 14, (2+3)×4 = 20 (D = 10 s) ═══════════════ */

function renderOrderOps(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.3, 9.1);
  op(q(root, 'box-mul'), ph(t, 0.8, 1.2) * (1 - ph(t, 2.6, 3.0)) * fade);
  op(q(root, 'eq14'), ph(t, 1.6, 2.1) * fade);
  op(q(root, 'row2'), ph(t, 2.8, 3.2) * fade);
  op(q(root, 'box-par'), ph(t, 3.2, 3.6) * (1 - ph(t, 4.4, 4.8)) * fade);
  op(q(root, 'eq20'), ph(t, 4.0, 4.5) * fade);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.6, 5.0) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 5.0, 5.4) * (1 - ph(t, 8.0, 8.6)));
}
const ORDER_OPS_HOLD = 6.2;

/* ═══════════════ L09 — sup-angles: 60° + 120° = 180° (D = 10 s) ═══════════════
   The approved list wrote 60+30 on a straight line. 60+30 is 90, so the card
   uses 120° next to 60° and the hold frame shows both wedges filling the line. */

function renderSupAngles(root: LoopRoot, t: number) {
  const lock = ph(t, 1.1, 2.5) - ph(t, 8.2, 9.3);
  const fade = ph(t, 0.4, 0.9) * (1 - ph(t, 9.2, 9.7));
  const w60 = q(root, 'w60');
  const w120 = q(root, 'w120');
  if (w60) w60.setAttribute('transform', `translate(${r2(-70 * (1 - lock))} ${r2(-48 * (1 - lock))})`);
  if (w120) w120.setAttribute('transform', `translate(${r2(64 * (1 - lock))} ${r2(-40 * (1 - lock))})`);
  op(w60, fade);
  op(w120, fade);
  const labels = ph(t, 2.6, 3.1) * (1 - ph(t, 8.2, 8.8));
  op(q(root, 'lbl60'), labels);
  op(q(root, 'lbl120'), labels);
  op(q(root, 'lbl180'), labels);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
}
const SUP_ANGLES_HOLD = 5.4;

/* ═══════════════ L10 — share-12: 12 into 3 equal groups, no remainder (D = 10 s) ═══════════════ */

function renderShare12(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.1);
  const plates = [130, 280, 430];
  for (let i = 0; i < 12; i++) {
    const dot = q(root, `d${i}`);
    const plate = Math.floor(i / 4);
    const seat = i % 4;
    const hx = 64 + (i % 6) * 36;
    const hy = i < 6 ? 72 : 108;
    const tx = plates[plate] + (seat - 1.5) * 18;
    const ty = 196;
    const p = ph(t, 1.0 + plate * 0.45, 1.7 + plate * 0.45) - ph(t, 8.2, 9.1);
    if (dot) {
      dot.setAttribute('cx', String(r2(lerp(hx, tx, p))));
      dot.setAttribute('cy', String(r2(lerp(hy, ty, p))));
    }
  }
  const shown = ph(t, 3.2, 3.6) * fade;
  op(q(root, 'c0'), shown);
  op(q(root, 'c1'), shown);
  op(q(root, 'c2'), shown);
  op(q(root, 'none-left'), ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 4.0, 4.4) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 4.4, 4.8) * (1 - ph(t, 8.0, 8.6)));
}
const SHARE12_HOLD = 5.8;

/* ═══════════════ L11 — corr-angles: matching angles on parallel lines (D = 10 s) ═══════════════ */

function renderCorrAngles(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const trav = q(root, 'trav');
  op(trav, ph(t, 0.6, 0.9) * fade);
  draw(trav, ph(t, 0.7, 1.6));
  const marks = ph(t, 2.0, 2.6) * fade;
  op(q(root, 'ang-top'), marks);
  op(q(root, 'ang-bot'), marks);
  op(q(root, 'deg-top'), ph(t, 2.6, 3.0) * fade);
  op(q(root, 'deg-bot'), ph(t, 2.8, 3.2) * fade);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.8, 4.2) * (1 - ph(t, 8.0, 8.6)));
}
const CORR_ANGLES_HOLD = 5.6;

/* ═══════════════ L12 — mean-cols: 2, 4, 6 level to 4 (D = 10 s) ═══════════════ */

function renderMeanCols(root: LoopRoot, t: number) {
  const p = ph(t, 1.4, 2.8) - ph(t, 8.2, 9.2);
  const starts = [44, 88, 132];
  const xs = [150, 250, 350];
  for (let i = 0; i < 3; i++) {
    const h = lerp(starts[i], 88, p);
    const bar = q(root, `bar${i}`);
    if (bar) {
      bar.setAttribute('y', String(r2(250 - h)));
      bar.setAttribute('height', String(r2(h)));
    }
    op(q(root, `n${i}`), ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6)));
  }
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.7, 4.1) * (1 - ph(t, 8.0, 8.6)));
}
const MEAN_COLS_HOLD = 5.2;

/* ═══════════════ L13 — pct-25: 25 of 100 cells (D = 10 s) ═══════════════ */

function renderPct25(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.3, 9.1);
  for (let i = 0; i < 25; i++) {
    const start = 0.5 + (i / 25) * 2.4;
    op(q(root, `pc${i}`), ph(t, start, start + 0.2) * fade);
  }
  op(q(root, 'lbl25'), ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 4.0, 4.4) * (1 - ph(t, 8.0, 8.6)));
}
const PCT25_HOLD = 5.6;

/* ═══════════════ L14 — diff-sq: 25 − 9 unfolds to a rectangle of 16 (D = 10 s) ═══════════════ */

function renderDiffSq(root: LoopRoot, t: number) {
  const slide = ph(t, 1.6, 2.8) - ph(t, 8.2, 9.2);
  const rect = q(root, 'rect16');
  if (rect) rect.setAttribute('transform', `translate(${r2(-170 * (1 - slide))} 0)`);
  op(rect, ph(t, 1.4, 1.9) * (1 - ph(t, 9.0, 9.6)));
  op(q(root, 'lbl16'), ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.7, 4.1) * (1 - ph(t, 8.0, 8.6)));
}
const DIFF_SQ_HOLD = 5.4;

/* ═══════════════ L15 — clock-3: hour on 3, minute on 12 (D = 10 s) ═══════════════ */

function renderClock3(root: LoopRoot, t: number) {
  const p = ph(t, 0.8, 2.4) - ph(t, 8.2, 9.3);
  const ang = p * (Math.PI / 2);
  const hour = q(root, 'hour');
  if (hour) {
    hour.setAttribute('x2', String(r2(280 + 52 * Math.sin(ang))));
    hour.setAttribute('y2', String(r2(168 - 52 * Math.cos(ang))));
  }
  op(q(root, 'lbl-time'), ph(t, 2.6, 3.1) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.1, 3.5) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.5, 3.9) * (1 - ph(t, 8.0, 8.6)));
}
const CLOCK3_HOLD = 5.2;

/* ═══════════════ L16 — peri-rect: walk 6+4+6+4 = 20 (D = 10 s) ═══════════════ */

function renderPeriRect(root: LoopRoot, t: number) {
  const back = ph(t, 8.2, 9.3);
  const steps = (ph(t, 0.7, 4.4) - back) * 4;
  const s = Math.max(0, steps);
  const corners = [
    { x: 150, y: 230 },
    { x: 390, y: 230 },
    { x: 390, y: 90 },
    { x: 150, y: 90 },
  ];
  const seg = Math.min(3, Math.floor(s));
  const f = s - seg;
  const a = corners[seg];
  const b = corners[(seg + 1) % 4];
  const dot = q(root, 'dot');
  if (dot) {
    dot.setAttribute('cx', String(r2(lerp(a.x, b.x, Math.min(1, f)))));
    dot.setAttribute('cy', String(r2(lerp(a.y, b.y, Math.min(1, f)))));
  }
  for (let i = 0; i < 4; i++) {
    const on = s >= i + 1 ? 1 : 0;
    op(q(root, `side${i}`), on * (1 - back));
  }
  op(q(root, 'total'), (s >= 4 ? 1 : 0) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], (s >= 4 ? 1 : 0) * ph(t, 4.6, 5.0) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 5.0, 5.4) * (1 - ph(t, 8.0, 8.6)));
}
const PERI_RECT_HOLD = 6.2;

/* ═══════════════ L17 — signed-jump: −2 + 5 = 3, through 0 (D = 10 s) ═══════════════ */

function renderSignedJump(root: LoopRoot, t: number) {
  const p = ph(t, 1.1, 2.8) - ph(t, 8.2, 9.3);
  const x = lerp(200, 400, p);
  const pt = q(root, 'pt');
  if (pt) pt.setAttribute('cx', String(r2(x)));
  const arc = q(root, 'arc');
  if (arc) {
    const mid = (200 + x) / 2;
    arc.setAttribute('d', `M200 196 Q${r2(mid)} 120 ${r2(x)} 196`);
  }
  op(arc, ph(t, 1.2, 1.6) * (1 - ph(t, 8.4, 9.0)));
  const v = lerp(-2, 3, p);
  const yTop = 220 - (v + 2) * 22;
  const merc = q(root, 'merc');
  if (merc) {
    merc.setAttribute('y', String(r2(yTop)));
    merc.setAttribute('height', String(r2(240 - yTop)));
  }
  const show = ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'plus5'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
}
const SIGNED_JUMP_HOLD = 5.2;

/* ═══════════════ L18 — prime-rect: 6 fits a rectangle, 7 does not (D = 10 s) ═══════════════ */

function renderPrimeRect(root: LoopRoot, t: number) {
  const p = ph(t, 1.0, 2.4) - ph(t, 8.2, 9.2);
  const six = [
    [150, 150], [186, 150], [222, 150],
    [150, 186], [186, 186], [222, 186],
  ];
  for (let i = 0; i < 6; i++) {
    const dot = q(root, `s${i}`);
    const hx = 70 + (i % 3) * 28;
    const hy = 80 + Math.floor(i / 3) * 28;
    if (dot) {
      dot.setAttribute('cx', String(r2(lerp(hx, six[i][0], p))));
      dot.setAttribute('cy', String(r2(lerp(hy, six[i][1], p))));
    }
  }
  const seven = [
    [360, 150], [396, 150], [432, 150],
    [360, 186], [396, 186], [432, 186],
    [470, 110],
  ];
  for (let i = 0; i < 7; i++) {
    const dot = q(root, `p${i}`);
    const hx = 340 + (i % 4) * 26;
    const hy = 70 + Math.floor(i / 4) * 26;
    if (dot) {
      dot.setAttribute('cx', String(r2(lerp(hx, seven[i][0], p))));
      dot.setAttribute('cy', String(r2(lerp(hy, seven[i][1], p))));
    }
  }
  const box = q(root, 'fit');
  op(box, ph(t, 2.2, 2.6) * (1 - ph(t, 8.2, 8.8)));
  draw(box, ph(t, 2.3, 2.9));
  const miss = q(root, 'miss');
  op(miss, ph(t, 2.4, 2.8) * (1 - ph(t, 8.2, 8.8)));
  draw(miss, ph(t, 2.5, 3.2));
  const show = ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'ok6'), show);
  op(q(root, 'no7'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
}
const PRIME_RECT_HOLD = 5.4;

/* ═══════════════ L19 — sas-snap: two marked triangles coincide (D = 10 s) ═══════════════ */

function renderSasSnap(root: LoopRoot, t: number) {
  const p = ph(t, 1.2, 2.6) - ph(t, 8.2, 9.3);
  const g = q(root, 'copy');
  if (g) g.setAttribute('transform', `translate(${r2(190 * (1 - p))} ${r2(-16 * (1 - p))})`);
  op(q(root, 'ghost'), (1 - p) * (1 - ph(t, 8.6, 9.2)));
  const show = ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'same'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const SAS_SNAP_HOLD = 5.2;

/* ═══════════════ L20 — obtuse-ht: height meets the base extension (D = 10 s) ═══════════════ */

function renderObtuseHt(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const ext = q(root, 'ext');
  op(ext, ph(t, 0.8, 1.1) * fade);
  draw(ext, ph(t, 0.9, 1.5));
  const ht = q(root, 'ht');
  op(ht, ph(t, 1.6, 1.9) * fade);
  draw(ht, ph(t, 1.7, 2.5));
  op(q(root, 'sq'), ph(t, 2.5, 2.9) * fade);
  op(q(root, 'lbl-h'), ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6)));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.1, 3.5) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.5, 3.9) * (1 - ph(t, 8.0, 8.6)));
}
const OBTUSE_HT_HOLD = 5.2;

/* ═══════════════ L21 — box-vol: 3×2×2 cubes = 12 (D = 10 s) ═══════════════ */

function renderBoxVol(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.3, 9.1);
  for (let i = 0; i < 12; i++) {
    const start = 0.6 + (i / 12) * 2.6;
    op(q(root, `k${i}`), ph(t, start, start + 0.25) * fade);
  }
  const show = ph(t, 3.5, 3.9) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'dims'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.9, 4.3) * (1 - ph(t, 8.0, 8.6)));
}
const BOX_VOL_HOLD = 5.6;

/* ═══════════════ L22 — trap-area: (6+2)/2 × 3 = 12 (D = 10 s) ═══════════════ */

function renderTrapArea(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const mid = q(root, 'mid');
  op(mid, ph(t, 1.4, 1.8) * fade);
  draw(mid, ph(t, 1.5, 2.3));
  op(q(root, 'lbl-m'), ph(t, 2.3, 2.7) * fade);
  const show = ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'lbl-h'), 1);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
}
const TRAP_AREA_HOLD = 5.2;

/* ═══════════════ L23 — odd-pair: 7 dots, one left over (D = 10 s) ═══════════════ */

function renderOddPair(root: LoopRoot, t: number) {
  const p = ph(t, 1.1, 2.5) - ph(t, 8.2, 9.2);
  const targets = [
    [110, 168], [148, 168],
    [230, 168], [268, 168],
    [350, 168], [388, 168],
    [470, 188],
  ];
  for (let i = 0; i < 7; i++) {
    const dot = q(root, `o${i}`);
    const hx = 80 + i * 58;
    if (dot) {
      dot.setAttribute('cx', String(r2(lerp(hx, targets[i][0], p))));
      dot.setAttribute('cy', String(r2(lerp(150, targets[i][1], p))));
    }
  }
  const show = ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'pairs'), show);
  op(q(root, 'left'), show);
  op(q(root, 'odd'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
}
const ODD_PAIR_HOLD = 5.4;

/* ═══════════════ L24 — birds-sub: 6 − 2 = 4 (D = 10 s) ═══════════════ */

function renderBirdsSub(root: LoopRoot, t: number) {
  const p = ph(t, 1.2, 2.4) - ph(t, 8.2, 9.2);
  const fly = [
    { id: 'b4', x: 380, y: 200, dx: 36 },
    { id: 'b5', x: 450, y: 200, dx: 50 },
  ];
  for (const bird of fly) {
    const g = q(root, bird.id);
    if (g) g.setAttribute('transform', `translate(${r2(bird.x + bird.dx * p)} ${r2(bird.y - 78 * p)})`);
  }
  const show = ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'stay'), show);
  op(q(root, 'gone'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.0, 3.4) * (1 - ph(t, 8.0, 8.6)));
}
const BIRDS_SUB_HOLD = 5.0;

/* ═══════════════ L25 — circ-unroll: circumference = πd (D = 10 s) ═══════════════
   Scale: diameter = 70 px. Three full diameters are 210 px, then πd − 3d ≈ 9.9 px. */

function renderCircUnroll(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  for (let i = 0; i < 3; i++) {
    const seg = q(root, `seg${i}`);
    op(seg, ph(t, 1.0 + i * 0.55, 1.3 + i * 0.55) * fade);
    draw(seg, ph(t, 1.1 + i * 0.55, 1.7 + i * 0.55));
    op(q(root, `sd${i}`), ph(t, 1.6 + i * 0.55, 2.0 + i * 0.55) * fade);
  }
  const extra = q(root, 'extra');
  op(extra, ph(t, 2.6, 3.0) * fade);
  draw(extra, ph(t, 2.7, 3.1));
  op(q(root, 'extra-lbl'), ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
}
const CIRC_UNROLL_HOLD = 5.4;

/* ═══════════════ L26 — rect-count: 4×3 cells = 12, perimeter = 14 (D = 10 s) ═══════════════
   Scale: 32 px per unit. Grid is 4×32 by 3×32. */

function renderRectCount(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.3, 9.1);
  for (let i = 0; i < 12; i++) {
    const start = 0.5 + (i / 12) * 1.8;
    op(q(root, `cell${i}`), ph(t, start, start + 0.2) * fade);
  }
  op(q(root, 'area'), ph(t, 2.5, 2.9) * fade);
  op(q(root, 'rim'), ph(t, 3.1, 3.5) * fade);
  op(q(root, 'side4'), ph(t, 3.3, 3.6) * fade);
  op(q(root, 'side3'), ph(t, 3.4, 3.7) * fade);
  const show = ph(t, 3.8, 4.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 4.2, 4.6) * (1 - ph(t, 8.0, 8.6)));
}
const RECT_COUNT_HOLD = 5.8;

/* ═══════════════ L27 — l-split: 4×3 and 2×2 leave the L, then return (D = 10 s) ═══════════════
   Scale: 22 px per unit. 4×3 = 88×66 (area 12). 2×2 = 44×44 (area 4). */

function renderLSplit(root: LoopRoot, t: number) {
  const split = ph(t, 1.2, 2.4) - ph(t, 8.2, 9.3);
  const part = q(root, 'part4');
  if (part) part.setAttribute('transform', `translate(${r2(130 * split)} ${r2(8 * split)})`);
  const show = ph(t, 2.5, 2.9) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'n12'), show);
  op(q(root, 'n4'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6)));
}
const L_SPLIT_HOLD = 5.0;

/* ═══════════════ L28 — quad-tree: parallelogram → rectangle and rhombus → square (D = 10 s) ═══════════════ */

function renderQuadTree(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'arms'), ph(t, 1.0, 1.4) * fade);
  op(q(root, 'kids'), ph(t, 1.4, 1.9) * fade);
  op(q(root, 'down'), ph(t, 2.2, 2.6) * fade);
  op(q(root, 'sq'), ph(t, 2.6, 3.1) * fade);
  const show = ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
}
const QUAD_TREE_HOLD = 5.4;

/* ═══════════════ L29 — tri-sort: three triangles drop into labeled baskets (D = 10 s) ═══════════════ */

function renderTriSort(root: LoopRoot, t: number) {
  const drop = ph(t, 1.1, 2.6) - ph(t, 8.2, 9.3);
  for (let i = 0; i < 3; i++) {
    const g = q(root, `tri${i}`);
    if (g) g.setAttribute('transform', `translate(0 ${r2(-150 * (1 - drop))})`);
  }
  const show = ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const TRI_SORT_HOLD = 5.2;

/* ═══════════════ L30 — parab: vertex rises 3 units, shape stays (D = 10 s) ═══════════════
   Scale: 26 px per unit. Vertex moves from y=0 to y=3. */

function renderParab(root: LoopRoot, t: number) {
  const p = ph(t, 1.1, 2.8) - ph(t, 8.2, 9.3);
  const g = q(root, 'curve');
  if (g) g.setAttribute('transform', `translate(0 ${r2(-78 * p)})`);
  const yv = Math.round(p * 3);
  const lab = q(root, 'yval');
  if (lab) {
    lab.textContent = `y = ${yv}`;
    lab.setAttribute('y', String(r2(246 - 78 * p)));
  }
  const show = ph(t, 3.0, 3.4) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.6)));
}
const PARAB_HOLD = 5.2;

/* ═══════════════ L31 — ratio-beads: 2:3 doubles to 4:6 (D = 10 s) ═══════════════
   Bead step 36 px, radius 12. Second row is a copy, not a recolor. */

function renderRatioBeads(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'row2'), ph(t, 1.3, 2.2) * fade);
  op(q(root, 'tag2'), ph(t, 2.2, 2.6) * fade);
  const show = ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const RATIO_BEADS_HOLD = 5.2;

/* ═══════════════ L32 — neighbors: 8 lights up between 7 and 9 (D = 10 s) ═══════════════
   Ticks at x = 160, 280, 400. Spacing 120 px. */

function renderNeighbors(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const on = ph(t, 1.2, 1.8) * fade;
  op(q(root, 'glow'), on);
  op(q(root, 'nbr'), ph(t, 1.8, 2.3) * fade);
  const show = ph(t, 2.5, 2.9) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6)));
}
const NEIGHBORS_HOLD = 4.8;

/* ═══════════════ L33 — signed-ops: (−3) + 2×4 = 5 (D = 10 s) ═══════════════ */

function renderSignedOps(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'box'), ph(t, 0.7, 1.1) * fade);
  op(q(root, 'eight'), ph(t, 1.5, 2.1) * (1 - ph(t, 8.0, 8.6)));
  op(q(root, 'sum'), ph(t, 2.6, 3.2) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
}
const SIGNED_OPS_HOLD = 5.2;

/* ═══════════════ L34 — clock-span: hour hand from 2 to 4 (D = 10 s) ═══════════════ */

function renderClockSpan(root: LoopRoot, t: number) {
  const p = ph(t, 1.0, 2.6) - ph(t, 8.2, 9.3);
  const rad = ((60 + 60 * p) * Math.PI) / 180;
  const hour = q(root, 'hour');
  if (hour) {
    hour.setAttribute('x2', String(r2(270 + 46 * Math.sin(rad))));
    hour.setAttribute('y2', String(r2(156 - 46 * Math.cos(rad))));
  }
  const show = ph(t, 2.7, 3.1) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'arc'), show);
  op(q(root, 'hrs'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.1, 3.5) * (1 - ph(t, 8.0, 8.6)));
}
const CLOCK_SPAN_HOLD = 5.0;

/* ═══════════════ L35 — exterior: 90° + 60° = 150° (D = 10 s) ═══════════════
   30-60-90 triangle. Exterior at the 30° vertex is exactly 150°. */

function renderExterior(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'w90'), ph(t, 1.2, 1.8) * fade);
  op(q(root, 'w60'), ph(t, 1.9, 2.5) * fade);
  op(q(root, 'a90'), ph(t, 1.5, 1.9) * fade);
  op(q(root, 'a60'), ph(t, 2.2, 2.6) * fade);
  op(q(root, 'a150'), ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const EXTERIOR_HOLD = 5.2;

/* ═══════════════ L36 — para-perp: equal gaps of 80, and a right angle (D = 10 s) ═══════════════ */

function renderParaPerp(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'gaps'), ph(t, 0.8, 1.4) * fade);
  op(q(root, 'cross'), ph(t, 1.8, 2.3) * fade);
  op(q(root, 'sq'), ph(t, 2.3, 2.7) * fade);
  const show = ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
}
const PARA_PERP_HOLD = 5.2;

/* ═══════════════ L37 — quarter-12: 1/4 of 12 is 3 (D = 10 s) ═══════════════
   12 dots, step 36 px, radius 11. The first three are one quarter. */

function renderQuarter12(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'mark'), ph(t, 1.2, 1.8) * fade);
  op(q(root, 'count'), ph(t, 1.8, 2.2) * fade);
  const show = ph(t, 2.4, 2.8) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6)));
}
const QUARTER12_HOLD = 4.8;

/* ═══════════════ L38 — two-coins: 4 equally likely outcomes (D = 10 s) ═══════════════ */

function renderTwoCoins(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'grid'), ph(t, 1.2, 1.8) * fade);
  op(q(root, 'pick'), ph(t, 2.2, 2.7) * fade);
  op(q(root, 'pick-lbl'), ph(t, 2.4, 2.8) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const TWO_COINS_HOLD = 5.2;

/* ═══════════════ L39 — map-scale: 4 × 5 = 20 (D = 10 s) ═══════════════
   Map bar is 40 px. Real bar is 5 copies, 200 px. */

function renderMapScale(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const bar = q(root, 'real');
  const grow = ph(t, 1.2, 2.6) * (1 - ph(t, 8.2, 9.0));
  if (bar) bar.setAttribute('width', String(r2(200 * grow)));
  op(bar, ph(t, 1.1, 1.3) * fade);
  op(q(root, 'ticks'), ph(t, 2.4, 2.8) * fade);
  op(q(root, 'real-lbl'), ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 3.0, 3.4) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.6)));
}
const MAP_SCALE_HOLD = 5.2;

/* ═══════════════ L40 — unit-frac: equal wholes, 1/2 > 1/3 > 1/4 (D = 10 s) ═══════════════
   Each bar is 180 px. Shaded widths are 90, 60 and 45. */

function renderUnitFrac(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'h'), ph(t, 0.6, 1.1) * fade);
  op(q(root, 't'), ph(t, 1.2, 1.7) * fade);
  op(q(root, 'q'), ph(t, 1.8, 2.3) * fade);
  op(q(root, 'labs'), ph(t, 2.2, 2.6) * fade);
  const show = ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const UNIT_FRAC_HOLD = 5.0;

/* ═══════════════ L41 — coord-walk: 3 right, then 2 up, to (3,2) ═══════════════
   Origin (170, 250). One unit is 36 px, so (3,2) is (278, 178). */

function renderCoordWalk(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const right = ph(t, 0.8, 2.2) - ph(t, 8.2, 9.0);
  const up = ph(t, 2.4, 3.6) - ph(t, 8.4, 9.2);
  const hseg = q(root, 'hseg');
  if (hseg) hseg.setAttribute('x2', String(r2(170 + 108 * right)));
  const vseg = q(root, 'vseg');
  if (vseg) vseg.setAttribute('y2', String(r2(250 - 72 * up)));
  op(vseg, ph(t, 2.3, 2.5) * fade);
  const pt = q(root, 'pt');
  if (pt) pt.setAttribute('transform', `translate(${r2(108 * right)} ${r2(-72 * up)})`);
  op(q(root, 'lbl'), ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 3.8, 4.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 4.2, 4.6) * (1 - ph(t, 8.0, 8.6)));
}
const COORD_WALK_HOLD = 5.2;

/* ═══════════════ L42 — coins-12: 10 + 1 + 1 = 12 ═══════════════ */

function renderCoins12(root: LoopRoot, t: number) {
  const p = ph(t, 1.0, 2.2) - ph(t, 8.2, 9.2);
  shift(q(root, 'c10'), 40 * p, 0);
  shift(q(root, 'c1a'), -44 * p, 0);
  shift(q(root, 'c1b'), -66 * p, 0);
  const show = ph(t, 2.5, 2.9) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'sum'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
}
const COINS12_HOLD = 5.0;

/* ═══════════════ L43 — cyl-stack: 4 unit layers, height = 4 ═══════════════
   Five boundaries at 28 px intervals enclose four equal layers. */

function renderCylStack(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  let slabs = 0;
  for (let i = 0; i < 5; i++) {
    const p = ph(t, 0.5 + i * 0.4, 0.85 + i * 0.4);
    op(q(root, `e${i}`), p * fade);
    if (i > 0) {
      op(q(root, `n${i - 1}`), p * fade);
      slabs += p;
    }
  }
  // Once the drawing has faded out, restore the collapsed geometry too. This
  // makes the restart frame identical to the initial frame, not merely blank.
  const y2 = r2(fade ? 250 - 28 * slabs : 250);
  const left = q(root, 'sideL');
  const right = q(root, 'sideR');
  if (left) left.setAttribute('y2', String(y2));
  if (right) right.setAttribute('y2', String(y2));
  const side = slabs > 0 ? fade : 0;
  op(left, side);
  op(right, side);
  const show = ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'base'), show);
  op(q(root, 'hlbl'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.0, 3.4) * (1 - ph(t, 8.0, 8.6)));
}
const CYL_STACK_HOLD = 5.2;

/* ═══════════════ L44 — tenth-cell: 10×10, one row, one cell ═══════════════ */

function renderTenthCell(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'row'), ph(t, 0.8, 1.4) * fade);
  const mark = ph(t, 1.8, 2.3) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'cell'), mark);
  op(q(root, 'hun'), mark);
  const show = ph(t, 2.5, 2.9) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6)));
}
const TENTH_CELL_HOLD = 5.0;

/* ═══════════════ L45 — equiv-half: 1/2 = 2/4 = 3/6 on one point ═══════════════
   The line is 360 px. Half, the second quarter and the third sixth are all x = 270. */

function renderEquivHalf(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const guide = ph(t, 0.7, 1.1) * fade;
  op(q(root, 'guide'), guide);
  op(q(root, 'h'), guide);
  op(q(root, 'quarters'), ph(t, 1.5, 2.0) * fade);
  op(q(root, 'q'), ph(t, 1.8, 2.2) * fade);
  op(q(root, 'sixths'), ph(t, 2.5, 3.0) * fade);
  op(q(root, 's'), ph(t, 2.8, 3.2) * fade);
  const show = ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.7, 4.1) * (1 - ph(t, 8.0, 8.6)));
}
const EQUIV_HALF_HOLD = 5.2;

/* ═══════════════ L46 — half-eq: equilateral cut, 80 opposite 30°, hypotenuse 160 ═══════════════ */

function renderHalfEq(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const cut = ph(t, 1.0, 1.6) * fade;
  op(q(root, 'alt'), cut);
  op(q(root, 'sq'), ph(t, 1.6, 2.0) * fade);
  op(q(root, 'a30'), ph(t, 1.8, 2.2) * fade);
  op(q(root, 'a30t'), ph(t, 1.8, 2.2) * fade);
  op(q(root, 'a60'), ph(t, 2.0, 2.4) * fade);
  op(q(root, 'a60t'), ph(t, 2.0, 2.4) * fade);
  op(q(root, 'dims'), ph(t, 2.3, 2.8) * fade);
  const show = ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
}
const HALF_EQ_HOLD = 5.2;

/* ═══════════════ L47 — sq-stretch: square 100×100 becomes a 180×100 rectangle ═══════════════ */

function renderSqStretch(root: LoopRoot, t: number) {
  const p = ph(t, 1.1, 2.5) - ph(t, 8.2, 9.3);
  const w = r2(100 + 80 * p);
  const box = q(root, 'box');
  if (box) box.setAttribute('width', String(w));
  const x = r2(280 + 80 * p);
  const c1 = q(root, 'c1');
  const c2 = q(root, 'c2');
  if (c1) c1.setAttribute('cx', String(x));
  if (c2) c2.setAttribute('cx', String(x));
  const show = ph(t, 2.7, 3.1) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'sides'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.1, 3.5) * (1 - ph(t, 8.0, 8.6)));
}
const SQ_STRETCH_HOLD = 5.0;

/* ═══════════════ L48 — area-x4: side 56 → 112, four equal 56×56 cells ═══════════════ */

function renderAreaX4(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const g = ph(t, 1.0, 2.4) - ph(t, 8.2, 9.2);
  const sq = q(root, 'sq');
  const s = r2(56 + 56 * g);
  if (sq) {
    sq.setAttribute('width', String(s));
    sq.setAttribute('height', String(s));
  }
  const grid = ph(t, 2.5, 2.9) * fade;
  op(q(root, 'mv'), grid);
  op(q(root, 'mh'), grid);
  op(q(root, 'n2'), grid);
  op(q(root, 'n3'), grid);
  op(q(root, 'n4'), grid);
  const show = ph(t, 3.0, 3.4) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.6)));
}
const AREA_X4_HOLD = 5.2;

/* ═══════════════ L49 — cube-8: two layers of 2×2, eight cells (D = 10 s) ═══════════════ */

function renderCube8(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'cube'), ph(t, 0.7, 1.6) * fade);
  op(q(root, 'edges'), ph(t, 1.8, 2.3) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 3.0, 3.4) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.4, 3.8) * (1 - ph(t, 8.0, 8.6)));
}
const CUBE8_HOLD = 5.2;

/* ═══════════════ L50 — place-123: 100 + two 10s + three 1s (D = 10 s) ═══════════════ */

function renderPlace123(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'flat'), ph(t, 0.6, 1.2) * fade);
  op(q(root, 'rods'), ph(t, 1.4, 2.0) * fade);
  op(q(root, 'ones'), ph(t, 2.2, 2.7) * fade);
  op(q(root, 'tot'), ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.6, 4.0) * (1 - ph(t, 8.0, 8.6)));
}
const PLACE123_HOLD = 5.2;

/* ═══════════════ L51 — jumps-4: four arcs of 3, landing on 12 (D = 10 s) ═══════════════
   Unit is 32 px. Each jump is 96 px: 70, 166, 262, 358, 454. */

function renderJumps4(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  for (let i = 0; i < 4; i++) op(q(root, `j${i}`), ph(t, 0.7 + i * 0.5, 1.1 + i * 0.5) * fade);
  const show = ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const JUMPS4_HOLD = 5.0;

/* ═══════════════ L52 — apples-5: 2 + 3 = 3 + 2 = 5 (D = 10 s) ═══════════════ */

function renderApples5(root: LoopRoot, t: number) {
  const p = ph(t, 1.0, 2.2) - ph(t, 8.2, 9.2);
  // The two groups swap places: order changes, but the total does not.
  shift(q(root, 'a2'), 204 * p, 0);
  shift(q(root, 'a3'), -206 * p, 0);
  const show = ph(t, 2.4, 2.8) * (1 - ph(t, 8.0, 8.6));
  op(q(root, 'five'), show);
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6)));
  op(fxs[1], ph(t, 3.2, 3.6) * (1 - ph(t, 8.0, 8.6)));
}
const APPLES5_HOLD = 5.0;

/* ═══════════════ L53 — topic-card: complete 2, 4, 6, 8 (D = 10 s) ═══════════════ */

function renderTopicCard(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'solid'), ph(t, 1.2, 1.8) * fade);
  op(q(root, 'ok'), ph(t, 1.8, 2.3) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 2.4, 2.8) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 2.8, 3.2) * (1 - ph(t, 8.0, 8.6)));
}
const TOPIC_CARD_HOLD = 4.8;

/* ═══════════════ L54 — mark-250: 250 is midway from 200 to 300 on a 0–1000 line ═══════════════
   400 px = 1000, so 250 is x = 160, exactly between 140 and 180. */

function renderMark250(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  const on = ph(t, 1.2, 1.8) * fade;
  op(q(root, 'dot'), on);
  op(q(root, 'lab'), ph(t, 1.6, 2.1) * (1 - ph(t, 8.0, 8.6)));
  const show = ph(t, 2.2, 2.6) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6)));
}
const MARK250_HOLD = 4.8;

/* ═══════════════ L55 — quad-gate: the 4-side square enters, the triangle stays out ═══════════════ */

function renderQuadGate(root: LoopRoot, t: number) {
  const p = ph(t, 1.1, 2.4) - ph(t, 8.2, 9.2);
  shift(q(root, 'sq'), lerp(340, 100, p), lerp(70, 190, p));
  const show = ph(t, 2.6, 3.0) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.0, 3.4) * (1 - ph(t, 8.0, 8.6)));
}
const QUAD_GATE_HOLD = 5.0;

/* ═══════════════ L56 — two-diag: a quadrilateral gets two diagonals (D = 10 s) ═══════════════ */

function renderTwoDiag(root: LoopRoot, t: number) {
  const fade = 1 - ph(t, 8.2, 9.0);
  op(q(root, 'd1'), ph(t, 0.8, 1.4) * fade);
  op(q(root, 'n1'), ph(t, 1.3, 1.7) * fade);
  op(q(root, 'd2'), ph(t, 1.9, 2.5) * fade);
  op(q(root, 'n2'), ph(t, 2.4, 2.8) * fade);
  const show = ph(t, 2.9, 3.3) * (1 - ph(t, 8.0, 8.6));
  const fxs = qa(root, '[data-fx]');
  op(fxs[0], show);
  op(fxs[1], ph(t, 3.3, 3.7) * (1 - ph(t, 8.0, 8.6)));
}
const TWO_DIAG_HOLD = 5.2;

/* ═══════════════ engine ═══════════════ */

const SPECS = {
  triangle: { duration: 10, hold: TRI_HOLD, render: renderTriangle },
  pythagoras: { duration: 10, hold: PYT_HOLD, render: renderPythagoras },
  'area-model': { duration: 11, hold: AREA_HOLD, render: renderAreaModel },
  sticks: { duration: 10, hold: STICKS_HOLD, render: renderSticks },
  numberline: { duration: 10, hold: NL_HOLD, render: renderNumberline },
  tenframes: { duration: 10, hold: TF_HOLD, render: renderTenframes },
  balance: { duration: 11, hold: BAL_HOLD, render: renderBalance },
  pattern: { duration: 11, hold: PAT_HOLD, render: renderPattern },
  bars: { duration: 11, hold: BARS_HOLD, render: renderBars },
  ruler: { duration: 10, hold: RULER_HOLD, render: renderRuler },
  array: { duration: 10, hold: ARRAY_HOLD, render: renderArray },
  polygon: { duration: 10, hold: POLY_HOLD, render: renderPolygon },
  data: { duration: 11, hold: DATA_HOLD, render: renderData },
  baseten: { duration: 10, hold: BT_HOLD, render: renderBaseten },
  cookies: { duration: 10, hold: CK_HOLD, render: renderCookies },
  fraction: { duration: 10, hold: FRAC_HOLD, render: renderFraction },
  transform: { duration: 11, hold: TRANS_HOLD, render: renderTransform },
  'angle-sum': { duration: 10, hold: ANGLE_SUM_HOLD, render: renderAngleSum },
  'para-rect': { duration: 10, hold: PARA_RECT_HOLD, render: renderParaRect },
  'angle-kinds': { duration: 10, hold: ANGLE_KINDS_HOLD, render: renderAngleKinds },
  'frac-product': { duration: 10, hold: FRAC_PRODUCT_HOLD, render: renderFracProduct },
  slope: { duration: 10, hold: SLOPE_HOLD, render: renderSlope },
  'add-within': { duration: 10, hold: ADD_WITHIN_HOLD, render: renderAddWithin },
  similar: { duration: 10, hold: SIMILAR_HOLD, render: renderSimilar },
  'order-ops': { duration: 10, hold: ORDER_OPS_HOLD, render: renderOrderOps },
  'sup-angles': { duration: 10, hold: SUP_ANGLES_HOLD, render: renderSupAngles },
  'share-12': { duration: 10, hold: SHARE12_HOLD, render: renderShare12 },
  'corr-angles': { duration: 10, hold: CORR_ANGLES_HOLD, render: renderCorrAngles },
  'mean-cols': { duration: 10, hold: MEAN_COLS_HOLD, render: renderMeanCols },
  'pct-25': { duration: 10, hold: PCT25_HOLD, render: renderPct25 },
  'diff-sq': { duration: 10, hold: DIFF_SQ_HOLD, render: renderDiffSq },
  'clock-3': { duration: 10, hold: CLOCK3_HOLD, render: renderClock3 },
  'peri-rect': { duration: 10, hold: PERI_RECT_HOLD, render: renderPeriRect },
  'signed-jump': { duration: 10, hold: SIGNED_JUMP_HOLD, render: renderSignedJump },
  'prime-rect': { duration: 10, hold: PRIME_RECT_HOLD, render: renderPrimeRect },
  'sas-snap': { duration: 10, hold: SAS_SNAP_HOLD, render: renderSasSnap },
  'obtuse-ht': { duration: 10, hold: OBTUSE_HT_HOLD, render: renderObtuseHt },
  'box-vol': { duration: 10, hold: BOX_VOL_HOLD, render: renderBoxVol },
  'trap-area': { duration: 10, hold: TRAP_AREA_HOLD, render: renderTrapArea },
  'odd-pair': { duration: 10, hold: ODD_PAIR_HOLD, render: renderOddPair },
  'birds-sub': { duration: 10, hold: BIRDS_SUB_HOLD, render: renderBirdsSub },
  'circ-unroll': { duration: 10, hold: CIRC_UNROLL_HOLD, render: renderCircUnroll },
  'rect-count': { duration: 10, hold: RECT_COUNT_HOLD, render: renderRectCount },
  'l-split': { duration: 10, hold: L_SPLIT_HOLD, render: renderLSplit },
  'quad-tree': { duration: 10, hold: QUAD_TREE_HOLD, render: renderQuadTree },
  'tri-sort': { duration: 10, hold: TRI_SORT_HOLD, render: renderTriSort },
  parab: { duration: 10, hold: PARAB_HOLD, render: renderParab },
  'ratio-beads': { duration: 10, hold: RATIO_BEADS_HOLD, render: renderRatioBeads },
  neighbors: { duration: 10, hold: NEIGHBORS_HOLD, render: renderNeighbors },
  'signed-ops': { duration: 10, hold: SIGNED_OPS_HOLD, render: renderSignedOps },
  'clock-span': { duration: 10, hold: CLOCK_SPAN_HOLD, render: renderClockSpan },
  exterior: { duration: 10, hold: EXTERIOR_HOLD, render: renderExterior },
  'para-perp': { duration: 10, hold: PARA_PERP_HOLD, render: renderParaPerp },
  'quarter-12': { duration: 10, hold: QUARTER12_HOLD, render: renderQuarter12 },
  'two-coins': { duration: 10, hold: TWO_COINS_HOLD, render: renderTwoCoins },
  'map-scale': { duration: 10, hold: MAP_SCALE_HOLD, render: renderMapScale },
  'unit-frac': { duration: 10, hold: UNIT_FRAC_HOLD, render: renderUnitFrac },
  'coord-walk': { duration: 10, hold: COORD_WALK_HOLD, render: renderCoordWalk },
  'coins-12': { duration: 10, hold: COINS12_HOLD, render: renderCoins12 },
  'cyl-stack': { duration: 10, hold: CYL_STACK_HOLD, render: renderCylStack },
  'tenth-cell': { duration: 10, hold: TENTH_CELL_HOLD, render: renderTenthCell },
  'equiv-half': { duration: 10, hold: EQUIV_HALF_HOLD, render: renderEquivHalf },
  'half-eq': { duration: 10, hold: HALF_EQ_HOLD, render: renderHalfEq },
  'sq-stretch': { duration: 10, hold: SQ_STRETCH_HOLD, render: renderSqStretch },
  'area-x4': { duration: 10, hold: AREA_X4_HOLD, render: renderAreaX4 },
  'cube-8': { duration: 10, hold: CUBE8_HOLD, render: renderCube8 },
  'place-123': { duration: 10, hold: PLACE123_HOLD, render: renderPlace123 },
  'jumps-4': { duration: 10, hold: JUMPS4_HOLD, render: renderJumps4 },
  'apples-5': { duration: 10, hold: APPLES5_HOLD, render: renderApples5 },
  'topic-card': { duration: 10, hold: TOPIC_CARD_HOLD, render: renderTopicCard },
  'mark-250': { duration: 10, hold: MARK250_HOLD, render: renderMark250 },
  'quad-gate': { duration: 10, hold: QUAD_GATE_HOLD, render: renderQuadGate },
  'two-diag': { duration: 10, hold: TWO_DIAG_HOLD, render: renderTwoDiag },
} as const;

const MAX_LAPS = 4;

function motionOff(): boolean {
  const html = document.documentElement;
  // Only an explicit menu choice parks the film. OS reduced motion used to
  // take this same path and left every grade demo on the final frame.
  return html.classList.contains('noam-a11y-motion') || html.classList.contains('nd-motion-off');
}

function setupLoop(root: LoopRoot) {
  const variant = root.dataset.loop as keyof typeof SPECS;
  const spec = SPECS[variant];
  if (!spec) return;

  const toggle = q(root, 'toggle') as HTMLButtonElement | null;
  const icPlay = q(root, 'ic-play') as unknown as SVGElement;
  const icPause = q(root, 'ic-pause') as unknown as SVGElement;

  let t = 0;
  let lap = 1;
  let playing = false;
  let userPaused = false;
  let done = false;
  let inView = false;
  let isStatic = false;
  let raf = 0;
  let last = 0;

  const drawFrame = () => spec.render(root, t);

  function setToggle(label: string, showPlay: boolean) {
    if (!toggle) return;
    toggle.setAttribute('aria-label', label);
    if (icPlay) icPlay.style.display = showPlay ? '' : 'none';
    if (icPause) icPause.style.display = showPlay ? 'none' : '';
  }

  function tick(now: number) {
    if (!playing) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    t += dt;
    if (t >= spec.duration) {
      t -= spec.duration;
      lap += 1;
    }
    if (lap >= MAX_LAPS && t >= spec.hold) {
      // park on the completed state after the 4th lap
      t = spec.hold;
      drawFrame();
      playing = false;
      done = true;
      setToggle('הפעלת ההדגמה מחדש', true);
      return;
    }
    drawFrame();
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing || isStatic) return;
    playing = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
    setToggle('השהיית ההדגמה', false);
  }

  function pause() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (!isStatic) setToggle(done ? 'הפעלת ההדגמה מחדש' : 'הפעלת ההדגמה', true);
  }

  function applyMotionPrefs() {
    if (motionOff()) {
      // static completed frame, no motion at all
      isStatic = true;
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      t = spec.hold;
      drawFrame();
      if (toggle) toggle.style.display = 'none';
    } else if (isStatic) {
      // motion re-enabled: reset to rest state, resume normal behaviour
      isStatic = false;
      t = 0;
      lap = 1;
      done = false;
      userPaused = false;
      drawFrame();
      if (toggle) toggle.style.display = '';
      if (inView) play();
      else setToggle('הפעלת ההדגמה', true);
    }
  }

  // in-view autoplay; off-screen pause (resume from the same point)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        if (isStatic) return;
        if (inView && !userPaused && !done) play();
        else if (!inView && playing) pause();
      },
      { threshold: 0.35 }
    );
    io.observe(root);
  }

  toggle?.addEventListener('click', () => {
    if (isStatic) return;
    if (done) {
      done = false;
      lap = 1;
      t = 0;
      userPaused = false;
      play();
    } else if (playing) {
      userPaused = true;
      pause();
    } else {
      userPaused = false;
      play();
    }
  });

  // react to the site's accessibility menu toggle (class on <html>)
  new MutationObserver(applyMotionPrefs).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  applyMotionPrefs();
  if (!isStatic) setToggle('השהיית ההדגמה', false);

  // deterministic hook for automated checks / report screenshots
  root.__loop = {
    seek(tt: number) {
      t = Math.min(Math.max(tt, 0), spec.duration);
      drawFrame();
    },
    pause,
    play,
    state: () => ({ t, playing, laps: lap, done, static: isStatic }),
  };
}

export function initConceptLoops() {
  const boot = () =>
    document.querySelectorAll<LoopRoot>('[data-loop]').forEach((root) => {
      if (!root.__loop) setupLoop(root);
    });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
