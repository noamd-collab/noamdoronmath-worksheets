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
