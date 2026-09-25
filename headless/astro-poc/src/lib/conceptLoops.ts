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
 *   - prefers-reduced-motion / html.noam-a11y-motion: completed state,
 *     fully static, toggle hidden
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

  op(q(root, 'arrow'), ph(t, 2.2, 2.6) * (1 - ph(t, 7.6, 8.1)));
  ['arc40', 'arc50', 'd40', 'd50'].forEach((n) =>
    op(q(root, n), ph(t, 3.0, 3.4) * (1 - ph(t, 7.4, 7.9)))
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
} as const;

const MAX_LAPS = 4;

function motionOff(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('noam-a11y-motion')
  );
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

  // react to OS-level changes and to the site's accessibility menu toggle
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotionPrefs);
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
