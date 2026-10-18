/**
 * Shared ConceptLoop helpers. Topic films import this bag as `LoopHelpers`
 * (same names as the standalone player). The clock stays in conceptLoops.ts.
 */

type Root = ParentNode;
type El = SVGElement | HTMLElement;

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

export const EASE = cubicBezier(0.16, 1, 0.3, 1);

/** eased progress of t inside [a,b] */
export const ph = (t: number, a: number, b: number) => EASE(Math.min(1, Math.max(0, (t - a) / (b - a))));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const r2 = (n: number) => Math.round(n * 100) / 100;

export const q = (root: Root, name: string) => root.querySelector(`[data-el="${name}"]`) as El;
export const qa = (root: Root, sel: string) => Array.from(root.querySelectorAll(sel)) as El[];

export const op = (el: El | null, v: number) => {
  if (el) el.style.opacity = String(r2(Math.min(1, Math.max(0, v))));
};
export const draw = (el: El | null, p: number) => {
  if (el) el.style.strokeDashoffset = String(r2(1 - Math.min(1, Math.max(0, p))));
};
export const move = (el: El | null, x: number, y: number, rot = 0) => {
  if (el) el.setAttribute('transform', `translate(${r2(x)} ${r2(y)}) rotate(${r2(rot)})`);
};
export const shift = (el: El | null, dx: number, dy: number) => {
  if (el) el.setAttribute('transform', `translate(${r2(dx)} ${r2(dy)})`);
};

export const LoopHelpers = { EASE, ph, lerp, r2, q, qa, op, draw, move, shift };
