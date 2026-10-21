/**
 * Lesson films for topic pages that have no old ConceptLoop.
 * Same card, easing, and lap rules as the protected engine. The engine file
 * itself stays byte-identical; this module only imports its easing.
 */
import { ph, lerp } from './conceptLoops';

type Root = HTMLElement & {
  __loop?: {
    seek: (t: number) => void;
    pause: () => void;
    play: () => void;
    state: () => { t: number; playing: boolean; laps: number; done: boolean; static: boolean };
  };
};

type Spec = { duration: number; hold: number; render: (root: Root, t: number) => void };

const q = (root: Root, name: string) => root.querySelector(`[data-el="${name}"]`) as SVGElement | HTMLElement | null;
const r2 = (n: number) => Math.round(n * 100) / 100;
const op = (el: Element | null, v: number) => {
  if (el) (el as HTMLElement).style.opacity = String(r2(Math.min(1, Math.max(0, v))));
};
const draw = (el: Element | null, p: number) => {
  if (el) (el as HTMLElement).style.strokeDashoffset = String(r2(1 - Math.min(1, Math.max(0, p))));
};
const attr = (el: Element | null, name: string, value: number | string) => {
  if (el) el.setAttribute(name, typeof value === 'number' ? String(r2(value)) : value);
};
const move = (el: Element | null, x: number, y: number) => {
  if (el) el.setAttribute('transform', `translate(${r2(x)} ${r2(y)})`);
};
const text = (el: Element | null, value: string) => {
  if (el && el.textContent !== value) el.textContent = value;
};
const lin = (t: number, a: number, b: number) => {
  if (!(b > a)) return t >= a ? 1 : 0;
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
};

/** Opacity plus visibility, so a hidden line cannot paint over the next one. */
function setShown(el: Element | null, value: number) {
  if (!el) return;
  const v = value <= 0.004 ? 0 : value >= 0.996 ? 1 : Math.min(1, Math.max(0, value));
  const node = el as HTMLElement;
  node.style.opacity = String(r2(v));
  node.style.visibility = v <= 0 ? 'hidden' : 'visible';
}

/** Minor arc centered on (cx, cy). Screen angles: 0 is +x, clockwise positive. */
export function arcD(cx: number, cy: number, r: number, a0: number, a1: number): string {
  let sweep = a1 - a0;
  while (sweep <= -Math.PI) sweep += Math.PI * 2;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  const end = a0 + sweep;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(end);
  const y1 = cy + r * Math.sin(end);
  const large = Math.abs(sweep) > Math.PI ? 1 : 0;
  const flag = sweep >= 0 ? 1 : 0;
  return `M ${r2(x0)} ${r2(y0)} A ${r} ${r} 0 ${large} ${flag} ${r2(x1)} ${r2(y1)}`;
}

function putArc(el: Element | null, cx: number, cy: number, radius: number, a0: number, a1: number) {
  if (!el) return;
  el.setAttribute('d', arcD(cx, cy, radius, a0, a1));
}

function putLabel(el: Element | null, cx: number, cy: number, radius: number, a0: number, a1: number) {
  if (!el) return;
  let sweep = a1 - a0;
  while (sweep <= -Math.PI) sweep += Math.PI * 2;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  const mid = a0 + sweep / 2;
  attr(el, 'x', cx + radius * Math.cos(mid));
  attr(el, 'y', cy + radius * Math.sin(mid));
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const ray = (v: { x: number; y: number }, p: { x: number; y: number }) => Math.atan2(p.y - v.y, p.x - v.x);
function corner(v: { x: number; y: number }, p: { x: number; y: number }, o: { x: number; y: number }) {
  const a = ray(v, p);
  const b = ray(v, o);
  let d = Math.abs(b - a);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return (d * 180) / Math.PI;
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function show(root: Root, name: string, t: number, a: number, b: number, c: number, d: number, alive = 1) {
  op(q(root, name), ph(t, a, b) * (1 - ph(t, c, d)) * alive);
}

/**
 * One question at a time. The outgoing line reaches opacity 0 and
 * visibility:hidden before the next line starts. The loop seam does the
 * same: the last line is gone, then the first line fades back in.
 */
function captions(root: Root, t: number, names: string[], cuts: number[], seam: [number, number]) {
  const fade = 0.2;
  const gap = 0.14;
  const values = names.map((_, i) => {
    const in0 = i === 0 ? -10 : cuts[i - 1] + fade + gap;
    const out0 = i < cuts.length ? cuts[i] : seam[0];
    let v = 0;
    if (t >= in0 && t < out0) v = i === 0 ? 1 : lin(t, in0, in0 + fade);
    else if (t >= out0 && t < out0 + fade) v = 1 - lin(t, out0, out0 + fade);
    if (i === 0 && t >= seam[0] + fade + gap) {
      const back = seam[0] + fade + gap;
      v = lin(t, back, back + fade);
    }
    return v;
  });
  let winner = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[winner]) winner = i;
  names.forEach((name, i) => setShown(q(root, name), i === winner && values[i] > 0 ? values[i] : 0));
}

function renderRoots(root: Root, t: number) {
  const alive = 1 - ph(t, 11.6, 12.6);
  for (let i = 0; i < 9; i++) op(q(root, `cell-${i}`), ph(t, 0.7 + i * 0.38, 1.05 + i * 0.38) * alive);
  op(q(root, 'side'), ph(t, 4.2, 4.7) * alive);
  op(q(root, 'eq-sq'), ph(t, 4.6, 5.2) * alive);
  op(q(root, 'rad'), ph(t, 6.2, 6.6) * alive);
  draw(q(root, 'rad-path'), ph(t, 6.3, 7.3));
  op(q(root, 'eq-root'), ph(t, 7.5, 8.2) * alive);
  captions(root, t, ['top0', 'top1'], [5.6], [12.0, 12.7]);
}

function renderIneq(root: Root, t: number) {
  const alive = 1 - ph(t, 10.4, 11.4);
  const pulse = 0.5 + 0.5 * Math.sin(t * 5.5);
  const hole = q(root, 'hole');
  op(hole, ph(t, 0.4, 0.9) * alive);
  if (hole) {
    attr(hole, 'r', 11 + pulse * 2.2);
    hole.style.strokeWidth = String(r2(2.4 + pulse * 1.6));
  }
  op(q(root, 'note'), ph(t, 1.1, 1.7) * alive);
  op(q(root, 'ray'), ph(t, 2.2, 2.6) * alive);
  draw(q(root, 'ray'), ph(t, 2.3, 3.6));
  op(q(root, 'head'), ph(t, 3.4, 3.8) * alive);
  op(q(root, 'eq'), ph(t, 4.2, 4.8) * alive);
}

function renderExp(root: Root, t: number) {
  const alive = 1 - ph(t, 12.8, 13.6);
  // 2² is the cobalt pair, 2³ is the purple triple. They start apart,
  // then slide into one product 2 × 2 × 2 × 2 × 2.
  const start = [108, 176, 360, 428, 496];
  const end = [112, 184, 256, 328, 400];
  const y = 148;
  const expand = lin(t, 1.4, 2.6);
  const slide = lin(t, 3.4, 5.0);
  const paren = expand * (1 - lin(t, 3.4, 4.05));
  op(q(root, 'powL'), (1 - expand) * alive);
  op(q(root, 'powR'), (1 - expand) * alive);
  for (let i = 0; i < 5; i++) {
    op(q(root, `f${i}`), expand * alive);
    move(q(root, `f${i}`), lerp(start[i], end[i], slide), y);
    op(q(root, `c${i}`), lin(t, 5.25 + i * 0.28, 5.5 + i * 0.28) * alive);
    move(q(root, `c${i}`), end[i], 98);
  }
  for (let i = 0; i < 4; i++) {
    const x0 = lerp(start[i], end[i], slide);
    const x1 = lerp(start[i + 1], end[i + 1], slide);
    move(q(root, `m${i}`), (x0 + x1) / 2, y);
    // The × between the two groups appears only as the groups meet.
    op(q(root, `m${i}`), expand * (i === 1 ? slide : 1) * alive);
  }
  const parens: Array<[string, number, number]> = [
    ['pL0', start[0] - 34, end[0] - 34],
    ['pL1', start[1] + 34, end[1] + 34],
    ['pR0', start[2] - 34, end[2] - 34],
    ['pR1', start[4] + 34, end[4] + 34],
  ];
  for (const [name, from, to] of parens) {
    move(q(root, name), lerp(from, to, slide), y);
    op(q(root, name), paren * alive);
  }
  op(q(root, 'plus'), lin(t, 6.9, 7.3) * alive);
  op(q(root, 'result'), lin(t, 8.15, 8.6) * alive);
  captions(root, t, ['top0', 'top1', 'top2'], [3.15, 6.7], [12.8, 13.6]);
}

function renderPowers(root: Root, t: number) {
  const alive = 1 - ph(t, 14.6, 15.5);
  const rows = [
    [0.4, 2.2],
    [4.6, 6.4],
    [8.8, 10.6],
  ];
  for (let i = 0; i < 3; i++) {
    const [a, b] = rows[i];
    op(q(root, `row-${i}`), ph(t, a, a + 0.45) * alive);
    op(q(root, `ex-${i}`), ph(t, a + 0.7, a + 1.15) * alive);
    op(q(root, `ans-${i}`), ph(t, b, b + 0.45) * alive);
  }
  captions(root, t, ['top0', 'top1', 'top2'], [4.2, 8.4], [14.6, 15.5]);
}

function renderMedian(root: Root, t: number) {
  const alive = 1 - ph(t, 14.6, 15.6);
  op(q(root, 'ticks'), ph(t, 0.5, 1.0) * alive);
  op(q(root, 'm-dot'), ph(t, 0.8, 1.2) * alive);
  op(q(root, 'med-a'), ph(t, 1.6, 2.0) * alive);
  draw(q(root, 'med-a'), ph(t, 1.7, 2.8));
  op(q(root, 'area1'), ph(t, 3.2, 3.8) * alive);
  op(q(root, 'area2'), ph(t, 3.6, 4.2) * alive);
  op(q(root, 'same'), ph(t, 4.3, 4.8) * alive);
  op(q(root, 'med-b'), ph(t, 6.2, 6.6) * alive);
  draw(q(root, 'med-b'), ph(t, 6.3, 7.3));
  op(q(root, 'med-c'), ph(t, 7.0, 7.4) * alive);
  draw(q(root, 'med-c'), ph(t, 7.1, 8.1));
  op(q(root, 'g-dot'), ph(t, 8.3, 8.7) * alive);
  op(q(root, 'ratio'), ph(t, 9.0, 9.6) * alive);
  captions(root, t, ['top0', 'top1', 'top2'], [3.0, 5.8], [14.6, 15.6]);
}

function renderCoord(root: Root, t: number) {
  const alive = 1 - ph(t, 13.4, 14.4);
  op(q(root, 'ptA'), ph(t, 0.4, 0.8) * alive);
  op(q(root, 'lblA'), ph(t, 0.5, 0.9) * alive);
  op(q(root, 'ptB'), ph(t, 1.2, 1.6) * alive);
  op(q(root, 'lblB'), ph(t, 1.3, 1.7) * alive);
  op(q(root, 'ab'), ph(t, 1.8, 2.1) * alive);
  draw(q(root, 'ab'), ph(t, 1.9, 2.8));
  for (let i = 1; i <= 5; i++) {
    const count = ph(t, 2.2 + i * 0.28, 2.45 + i * 0.28);
    op(q(root, `ab-${i}`), count * (1 - ph(t, 3.65, 4.05)) * alive);
  }
  op(q(root, 'lenAB'), ph(t, 3.8, 4.3) * alive);
  op(q(root, 'ptC'), ph(t, 4.6, 5.0) * alive);
  op(q(root, 'lblC'), ph(t, 4.7, 5.1) * alive);
  op(q(root, 'bc'), ph(t, 5.2, 5.5) * alive);
  draw(q(root, 'bc'), ph(t, 5.3, 6.0));
  for (let i = 1; i <= 3; i++) {
    const count = ph(t, 5.5 + i * 0.28, 5.75 + i * 0.28);
    op(q(root, `bc-${i}`), count * (1 - ph(t, 6.45, 6.85)) * alive);
  }
  op(q(root, 'lenBC'), ph(t, 6.6, 7.1) * alive);
  op(q(root, 'ca'), ph(t, 7.2, 7.6) * alive);
  draw(q(root, 'ca'), ph(t, 7.3, 8.1));
  op(q(root, 'area'), ph(t, 8.4, 9.0) * alive);
  captions(root, t, ['top0', 'top1', 'top2'], [1.6, 7.8], [13.7, 14.55]);
}

function ride(hours: number) {
  if (hours <= 2) return { d: 15 * hours, v: '15' };
  if (hours <= 3) return { d: 30, v: '0' };
  return { d: Math.max(0, 30 - 15 * (hours - 3)), v: '15' };
}

function trailPortion(hours: number) {
  const climb = Math.hypot(112, 90);
  const flat = 56;
  const total = climb * 2 + flat;
  let walked = 0;
  if (hours <= 2) walked = (hours / 2) * climb;
  else if (hours <= 3) walked = climb + (hours - 2) * flat;
  else walked = climb + flat + ((hours - 3) / 2) * climb;
  return Math.min(1, Math.max(0, walked / total));
}

function renderRead(root: Root, t: number) {
  const alive = 1 - ph(t, 16.6, 17.6);
  let hours = lin(t, 0.25, 4.7) * 5;
  if (t >= 4.75 && t < 8.05) hours = lerp(5, 1, lin(t, 4.75, 5.35));
  else if (t >= 8.05 && t < 11.2) hours = lerp(1, 2.5, lin(t, 8.05, 8.6));
  else if (t >= 11.2) hours = 5;
  const { d } = ride(hours);
  const gx = 62 + hours * 56;
  const gy = 246 - d * 3;
  move(q(root, 'rider'), 44 + (d / 30) * 284, 50);
  attr(q(root, 'gdot'), 'cx', gx);
  attr(q(root, 'gdot'), 'cy', gy);
  op(q(root, 'rider'), alive);
  op(q(root, 'gdot'), alive);
  draw(q(root, 'trail'), t < 0.25 ? 0 : t < 4.7 ? trailPortion(hours) : 1);

  const readOn = ph(t, 5.35, 5.75) * (1 - ph(t, 7.7, 8.15)) * alive;
  op(q(root, 'dashv'), readOn);
  op(q(root, 'dashh'), readOn);
  op(q(root, 'read15'), readOn);
  setShown(q(root, 'ans1'), readOn);

  const stopOn = ph(t, 8.45, 8.9) * (1 - ph(t, 10.85, 11.25)) * alive;
  op(q(root, 'segStop'), stopOn);
  op(q(root, 'stopLbl'), stopOn);
  setShown(q(root, 'ans2'), stopOn);

  const speedOn = ph(t, 11.45, 11.9) * alive;
  op(q(root, 'spd0'), speedOn);
  op(q(root, 'spd1'), speedOn);
  op(q(root, 'spd2'), speedOn);
  setShown(q(root, 'ans3'), speedOn * (1 - ph(t, 14.15, 14.55)));

  const trendOn = ph(t, 14.45, 14.95) * alive;
  op(q(root, 'tr0'), trendOn);
  op(q(root, 'tr1'), trendOn);
  op(q(root, 'tr2'), trendOn);
  setShown(q(root, 'ans4'), trendOn);
  captions(root, t, ['top0', 'top1', 'top2', 'top3', 'top4'], [4.7, 8.0, 11.2, 14.2], [16.4, 17.5]);
}

function renderSystems(root: Root, t: number) {
  const alive = 1 - ph(t, 12.4, 13.4);
  op(q(root, 'l1'), ph(t, 0.4, 0.7) * alive);
  draw(q(root, 'l1'), ph(t, 0.5, 1.8));
  op(q(root, 'l2'), ph(t, 1.8, 2.1) * alive);
  draw(q(root, 'l2'), ph(t, 1.9, 3.2));
  op(q(root, 'pt'), ph(t, 3.4, 3.9) * alive);
  op(q(root, 'pname'), ph(t, 3.6, 4.1) * alive);
  op(q(root, 'chk1'), ph(t, 4.8, 5.4) * alive);
  op(q(root, 'chk2'), ph(t, 6.0, 6.6) * alive);
  captions(root, t, ['top0', 'top1'], [4.4], [13.0, 13.75]);
}

function renderCone(root: Root, t: number) {
  const alive = 1 - ph(t, 12.4, 13.4);
  const grow = ph(t, 1.2, 3.2);
  attr(q(root, 'pour'), 'height', lerp(0, 52, grow));
  attr(q(root, 'pour'), 'y', lerp(230, 178, grow));
  op(q(root, 'third'), ph(t, 3.2, 3.7) * alive);
  op(q(root, 'formula'), ph(t, 4.0, 4.6) * alive);
  const net = ph(t, 6.2, 8.4);
  op(q(root, 'base'), net * alive);
  move(q(root, 'base'), lerp(40, 250, net), lerp(0, -10, net));
  op(q(root, 'sector'), ph(t, 7.4, 8.0) * alive);
  draw(q(root, 'sector'), ph(t, 7.5, 8.8));
  op(q(root, 'net-lbl'), ph(t, 8.8, 9.3) * alive);
  captions(root, t, ['top0', 'top1'], [5.8], [13.0, 13.75]);
}

function renderCyl(root: Root, t: number) {
  const alive = 1 - ph(t, 12.4, 13.4);
  const w = lerp(8, 176, ph(t, 1.4, 4.2));
  attr(q(root, 'sheet'), 'width', w);
  op(q(root, 'sheet'), ph(t, 1.2, 1.6) * alive);
  op(q(root, 'wlab'), ph(t, 3.6, 4.2) * alive);
  op(q(root, 'hlab'), ph(t, 3.6, 4.2) * alive);
  const slide = ph(t, 5.0, 7.2);
  attr(q(root, 'c1'), 'cx', lerp(125, 430, slide));
  attr(q(root, 'c1'), 'cy', lerp(88, 118, slide));
  attr(q(root, 'c2'), 'cx', lerp(125, 430, slide));
  attr(q(root, 'c2'), 'cy', lerp(228, 210, slide));
  op(q(root, 'c1'), alive);
  op(q(root, 'c2'), alive);
  op(q(root, 'formula'), ph(t, 7.8, 8.4) * alive);
  captions(root, t, ['top0', 'top1'], [4.6], [13.0, 13.75]);
}

function renderPrism(root: Root, t: number) {
  const alive = 1 - ph(t, 13.4, 14.4);
  const p = ph(t, 0.8, 3.6);
  const faces: Array<[string, number, number]> = [
    ['f0', 70, 30],
    ['f1', 0, 40],
    ['f2', -80, 20],
    ['f3', 20, -70],
    ['f4', 10, 80],
  ];
  for (const [name, x, y] of faces) move(q(root, name), lerp(x, 0, p), lerp(y, 0, p));
  op(q(root, 'area'), ph(t, 4.2, 4.8) * alive);
  op(q(root, 'vol'), ph(t, 6.4, 7.1) * alive);
  captions(root, t, ['top0', 'top1', 'top2'], [3.8, 6.0], [13.7, 14.55]);
}

const XN = (n: number) => 270 + n * 30;

function renderSignedMul(root: Root, t: number) {
  const alive = 1 - ph(t, 12.6, 13.6);
  const left = [0, -2, -4, -6];
  const right = [0, 2, 4, 6];
  const scene2 = ph(t, 6.4, 6.8);
  for (let i = 0; i < 3; i++) {
    const a = 1.1 + i * 0.85;
    op(q(root, `j${i}`), ph(t, a, a + 0.15) * (1 - scene2) * alive);
    draw(q(root, `j${i}`), ph(t, a, a + 0.6));
    const b = 7.0 + i * 0.85;
    op(q(root, `k${i}`), ph(t, b, b + 0.15) * alive);
    draw(q(root, `k${i}`), ph(t, b, b + 0.6));
  }
  let x = XN(0);
  for (let i = 0; i < 3; i++) {
    const a = 1.1 + i * 0.85;
    if (t < 6.4 && t >= a) x = lerp(XN(left[i]), XN(left[i + 1]), ph(t, a, a + 0.6));
    const b = 7.0 + i * 0.85;
    if (t >= 6.6 && t >= b) x = lerp(XN(right[i]), XN(right[i + 1]), ph(t, b, b + 0.6));
  }
  if (t >= 6.6 && t < 7.0) x = XN(0);
  attr(q(root, 'bead'), 'cx', x);
  op(q(root, 'bead'), ph(t, 0.6, 1.0) * alive);
  op(q(root, 'eq1'), ph(t, 3.8, 4.4) * (1 - ph(t, 6.2, 6.42)) * alive);
  op(q(root, 'eq2'), ph(t, 9.7, 10.3) * alive);
  captions(root, t, ['top0', 'top1'], [6.2], [12.6, 13.6]);
}

function renderSignedDiv(root: Root, t: number) {
  const alive = 1 - ph(t, 12.6, 13.6);
  const scene2 = ph(t, 6.5, 7.0);
  for (let i = 0; i < 4; i++) {
    const a = 0.9 + i * 0.7;
    op(q(root, `d${i}`), ph(t, a, a + 0.12) * (1 - scene2) * alive);
    draw(q(root, `d${i}`), ph(t, a, a + 0.5));
    const b = 7.2 + i * 0.7;
    op(q(root, `e${i}`), ph(t, b, b + 0.12) * alive);
    draw(q(root, `e${i}`), ph(t, b, b + 0.5));
  }
  const stops = [0, -2, -4, -6, -8];
  let x = XN(0);
  for (let i = 0; i < 4; i++) {
    const a = 0.9 + i * 0.7;
    if (t < 6.5 && t >= a) x = lerp(XN(stops[i]), XN(stops[i + 1]), ph(t, a, a + 0.5));
    const b = 7.2 + i * 0.7;
    if (t >= 6.8 && t >= b) x = lerp(XN(stops[i]), XN(stops[i + 1]), ph(t, b, b + 0.5));
  }
  if (t >= 6.8 && t < 7.2) x = XN(0);
  attr(q(root, 'bead'), 'cx', x);
  op(q(root, 'bead'), ph(t, 0.4, 0.8) * alive);
  op(q(root, 'eq1'), ph(t, 3.9, 4.5) * (1 - ph(t, 6.3, 6.52)) * alive);
  op(q(root, 'eq2'), ph(t, 10.2, 10.8) * alive);
  captions(root, t, ['top0', 'top1'], [6.2], [12.6, 13.6]);
}

function renderQuad(root: Root, t: number) {
  const alive = 1 - ph(t, 13.4, 14.4);
  op(q(root, 'para'), ph(t, 0.3, 0.6) * alive);
  draw(q(root, 'para'), ph(t, 0.4, 2.4));
  op(q(root, 'r2'), ph(t, 2.8, 3.3) * alive);
  op(q(root, 'r3'), ph(t, 3.2, 3.7) * alive);
  op(q(root, 'roots'), ph(t, 3.6, 4.2) * alive);
  op(q(root, 'fact'), ph(t, 5.4, 6.1) * alive);
  op(q(root, 'solve'), ph(t, 7.2, 7.9) * alive);
  captions(root, t, ['top0', 'top1'], [5.0], [13.7, 14.55]);
}

function renderQuadIneq(root: Root, t: number) {
  const alive = 1 - ph(t, 12.4, 13.4);
  op(q(root, 'para'), ph(t, 0.3, 0.6) * alive);
  draw(q(root, 'para'), ph(t, 0.4, 2.2));
  op(q(root, 'y9'), ph(t, 2.4, 2.9) * alive);
  op(q(root, 'rL'), ph(t, 3.2, 3.7) * alive);
  op(q(root, 'rR'), ph(t, 3.5, 4.0) * alive);
  op(q(root, 'shadeL'), ph(t, 4.6, 5.2) * alive);
  op(q(root, 'shadeR'), ph(t, 5.0, 5.6) * alive);
  op(q(root, 'mid'), ph(t, 5.8, 6.3) * alive);
  op(q(root, 'answer'), ph(t, 6.8, 7.5) * alive);
  captions(root, t, ['top0', 'top1'], [4.2], [13.0, 13.75]);
}

function renderRect(root: Root, t: number) {
  const alive = 1 - ph(t, 11.4, 12.4);
  op(q(root, 'box'), ph(t, 0.3, 0.6) * alive);
  draw(q(root, 'box'), ph(t, 0.4, 1.6));
  for (let i = 0; i < 4; i++) op(q(root, `ang-${i}`), ph(t, 1.8 + i * 0.35, 2.15 + i * 0.35) * alive);
  op(q(root, 'd1'), ph(t, 3.6, 4.0) * alive);
  draw(q(root, 'd1'), ph(t, 3.7, 4.6));
  op(q(root, 'd2'), ph(t, 4.6, 5.0) * alive);
  draw(q(root, 'd2'), ph(t, 4.7, 5.6));
  op(q(root, 'eq'), ph(t, 5.8, 6.4) * alive);
  captions(root, t, ['top0', 'top1'], [3.3], [12.05, 12.75]);
}

function renderTriangles(root: Root, t: number) {
  const alive = 1 - ph(t, 13.05, 13.75);
  // Apex descends toward the base across the loop, so γ opens to ~170°.
  const u = Math.min(1, Math.max(0, (t - 0.35) / 8.85));
  const A = { x: 280, y: lerp(34, 221, u) };
  const B = { x: 110, y: 236 };
  const C = { x: 450, y: 236 };
  const poly = q(root, 'tri');
  if (poly) poly.setAttribute('points', `${r2(A.x)},${r2(A.y)} ${B.x},${B.y} ${C.x},${C.y}`);
  const altitude = C.y - A.y;
  putArc(q(root, 'arcA'), A.x, A.y, Math.min(34, Math.max(14, altitude * 0.45)), ray(A, B), ray(A, C));
  putArc(q(root, 'arcB'), B.x, B.y, 40, ray(B, C), ray(B, A));
  putArc(q(root, 'arcC'), C.x, C.y, 40, ray(C, A), ray(C, B));
  const gamma = Math.round(corner(A, B, C));
  const alpha = Math.round(corner(B, A, C));
  const beta = 180 - gamma - alpha;
  text(q(root, 'degA'), `γ ${gamma}°`);
  text(q(root, 'degB'), `α ${alpha}°`);
  text(q(root, 'degC'), `β ${beta}°`);
  attr(q(root, 'degA'), 'x', A.x);
  attr(q(root, 'degA'), 'y', altitude > 50 ? A.y + Math.min(40, altitude * 0.32) : A.y - 18);
  putLabel(q(root, 'degB'), B.x, B.y, 56, ray(B, C), ray(B, A));
  putLabel(q(root, 'degC'), C.x, C.y, 56, ray(C, A), ray(C, B));
  for (const el of [q(root, 'degB'), q(root, 'degC')]) {
    if (!el) continue;
    if (Number(el.getAttribute('y')) > B.y - 10) attr(el, 'y', B.y + 22);
  }
  text(q(root, 'sum'), `α ${alpha}° + β ${beta}° + γ ${gamma}° = 180°`);
  op(q(root, 'sum'), ph(t, 0.4, 0.8) * alive);
  op(q(root, 'tri'), alive);
  op(q(root, 'arcA'), alive);
  op(q(root, 'arcB'), alive);
  op(q(root, 'arcC'), alive);
  op(q(root, 'degA'), alive);
  op(q(root, 'degB'), alive);
  op(q(root, 'degC'), alive);
}

function renderSide(root: Root, t: number) {
  const alive = 1 - ph(t, 12.4, 13.4);
  const p = ph(t, 0.6, 8.8);
  const A = { x: 200, y: 56 };
  const B = { x: 80, y: 230 };
  const C = { x: lerp(230, 470, p), y: lerp(230, 188, p) };
  const poly = q(root, 'tri');
  if (poly) poly.setAttribute('points', `${A.x},${A.y} ${r2(B.x)},${B.y} ${r2(C.x)},${r2(C.y)}`);
  putArc(q(root, 'arcA'), A.x, A.y, 30, ray(A, B), ray(A, C));
  putArc(q(root, 'arcC'), C.x, C.y, 26, ray(C, A), ray(C, B));
  const angA = corner(A, B, C);
  const angC = corner(C, A, B);
  const lenBC = dist(B, C) / 28;
  const lenAB = dist(A, B) / 28;
  text(q(root, 'degA'), `${angA.toFixed(0)}°`);
  text(q(root, 'degC'), `${angC.toFixed(0)}°`);
  text(q(root, 'lenBC'), lenBC.toFixed(1));
  text(q(root, 'lenAB'), lenAB.toFixed(1));
  putLabel(q(root, 'degA'), A.x, A.y, 48, ray(A, B), ray(A, C));
  putLabel(q(root, 'degC'), C.x, C.y, 42, ray(C, A), ray(C, B));
  const bcMid = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 + 18 };
  const abMid = { x: (A.x + B.x) / 2 - 28, y: (A.y + B.y) / 2 };
  attr(q(root, 'lenBC'), 'x', bcMid.x);
  attr(q(root, 'lenBC'), 'y', bcMid.y);
  attr(q(root, 'lenAB'), 'x', abMid.x);
  attr(q(root, 'lenAB'), 'y', abMid.y);
  attr(q(root, 'lblC'), 'x', C.x + 14);
  attr(q(root, 'lblC'), 'y', C.y + 22);
  op(q(root, 'claim'), (angA > angC + 2 ? 1 : 0) * ph(t, 2.2, 2.6) * alive);
  op(q(root, 'tri'), alive);
  for (const name of ['arcA', 'arcC', 'degA', 'degC', 'lenBC', 'lenAB']) op(q(root, name), alive);
}

const PARA = [
  { a: [190, 108, 30, 0, 45], b: [310, 228, 30, 0, 45], da: '45°', db: '45°', pair: '45° = 45°' },
  { a: [190, 108, 30, 0, 45], b: [310, 228, 30, 180, 225], da: '45°', db: '45°', pair: '45° = 45°' },
  { a: [190, 108, 36, 180, 225], b: [310, 228, 36, 0, 45], da: '45°', db: '45°', pair: '45° = 45°' },
  { a: [190, 108, 28, 0, 45], b: [310, 228, 42, 225, 360], da: '45°', db: '135°', pair: '45° + 135° = 180°' },
  { a: [190, 108, 26, 0, 45], b: [190, 108, 42, 180, 225], da: '45°', db: '45°', pair: '45° = 45°' },
  { a: [190, 108, 26, 0, 45], b: [190, 108, 42, 45, 180], da: '45°', db: '135°', pair: '45° + 135° = 180°' },
];

function renderParallel(root: Root, t: number) {
  const alive = 1 - ph(t, 16.6, 17.6);
  const step = Math.min(5, Math.max(0, Math.floor(t / 3)));
  const spec = PARA[step];
  op(q(root, 'arcA'), alive);
  op(q(root, 'arcB'), alive);
  op(q(root, 'degA'), alive);
  op(q(root, 'degB'), alive);
  putArc(q(root, 'arcA'), spec.a[0], spec.a[1], spec.a[2], rad(spec.a[3]), rad(spec.a[4]));
  putArc(q(root, 'arcB'), spec.b[0], spec.b[1], spec.b[2], rad(spec.b[3]), rad(spec.b[4]));
  text(q(root, 'degA'), spec.da);
  text(q(root, 'degB'), spec.db);
  putLabel(q(root, 'degA'), spec.a[0], spec.a[1], spec.a[2] + 18, rad(spec.a[3]), rad(spec.a[4]));
  putLabel(q(root, 'degB'), spec.b[0], spec.b[1], spec.b[2] + 18, rad(spec.b[3]), rad(spec.b[4]));
  for (let i = 0; i < 6; i++) setShown(q(root, `cap${i}`), i === step ? alive : 0);
  text(q(root, 'sumline'), spec.pair);
  setShown(q(root, 'sumline'), alive);
}

const SPECS: Record<string, Spec> = {
  roots: { duration: 13, hold: 10.2, render: renderRoots },
  ineq: { duration: 12, hold: 8.6, render: renderIneq },
  'exp-rules': { duration: 14, hold: 11.2, render: renderExp },
  powers: { duration: 16, hold: 13.2, render: renderPowers },
  median: { duration: 16, hold: 13.0, render: renderMedian },
  'coord-app': { duration: 15, hold: 12.0, render: renderCoord },
  'read-graph': { duration: 18, hold: 15.6, render: renderRead },
  systems: { duration: 14, hold: 11.0, render: renderSystems },
  cone: { duration: 14, hold: 11.0, render: renderCone },
  'cyl-area': { duration: 14, hold: 11.0, render: renderCyl },
  'prism-area': { duration: 15, hold: 12.0, render: renderPrism },
  'prism-vol': { duration: 15, hold: 12.0, render: renderPrism },
  'signed-mul': { duration: 14, hold: 11.2, render: renderSignedMul },
  'signed-div': { duration: 14, hold: 11.4, render: renderSignedDiv },
  'quad-eq': { duration: 15, hold: 12.0, render: renderQuad },
  'quad-factor': { duration: 15, hold: 12.0, render: renderQuad },
  'quad-ineq': { duration: 14, hold: 11.0, render: renderQuadIneq },
  rect: { duration: 13, hold: 10.0, render: renderRect },
  triangles: { duration: 14, hold: 9.6, render: renderTriangles },
  'side-angle': { duration: 14, hold: 10.2, render: renderSide },
  'parallel-more': { duration: 18, hold: 15.2, render: renderParallel },
};

function motionOff() {
  const root = document.documentElement;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    root.classList.contains('nd-motion-off') ||
    root.classList.contains('noam-a11y-motion')
  );
}

function setup(root: Root, spec: Spec) {
  if (root.__loop) return;
  root.dataset.hold = String(spec.hold);
  const card = root.querySelector('[data-pause-card]') as HTMLElement | null;
  const toggle = q(root, 'toggle') as HTMLElement | null;
  const icPlay = q(root, 'ic-play') as SVGElement | null;
  const icPause = q(root, 'ic-pause') as SVGElement | null;
  let t = 0;
  let lap = 1;
  let playing = false;
  let userPaused = false;
  let done = false;
  let inView = false;
  let isStatic = false;
  let raf = 0;
  let last = 0;

  const setToggle = (label: string, showPlay: boolean) => {
    card?.setAttribute('aria-label', label);
    if (icPlay) icPlay.style.display = showPlay ? '' : 'none';
    if (icPause) icPause.style.display = showPlay ? 'none' : '';
    card?.setAttribute('aria-pressed', playing ? 'true' : 'false');
  };
  const tick = (now: number) => {
    if (!playing) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    t += dt;
    if (t >= spec.duration) {
      t -= spec.duration;
      lap += 1;
    }
    if (lap >= 4 && t >= spec.hold) {
      t = spec.hold;
      spec.render(root, t);
      playing = false;
      done = true;
      setToggle('הפעלת ההדגמה מחדש', true);
      return;
    }
    spec.render(root, t);
    raf = requestAnimationFrame(tick);
  };
  const play = () => {
    if (playing || isStatic) return;
    playing = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
    setToggle('השהיית הנפשה', false);
  };
  const pause = () => {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (!isStatic) setToggle(done ? 'הפעלת ההדגמה מחדש' : 'הפעלת ההדגמה', true);
  };
  const applyMotion = () => {
    if (motionOff()) {
      isStatic = true;
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      t = spec.hold;
      spec.render(root, t);
      if (toggle) toggle.style.display = 'none';
    } else if (isStatic) {
      isStatic = false;
      t = 0;
      lap = 1;
      done = false;
      userPaused = false;
      spec.render(root, 0);
      if (toggle) toggle.style.display = '';
      if (inView) play();
      else setToggle('הפעלת ההדגמה', true);
    }
  };
  spec.render(root, 0);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        if (isStatic) return;
        if (inView && !userPaused && !done) play();
        else if (!inView && playing) pause();
      },
      { threshold: 0.35 },
    );
    io.observe(root);
  }
  const onToggle = () => {
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
  };
  card?.addEventListener('click', onToggle);
  card?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  });
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotion);
  new MutationObserver(applyMotion).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  applyMotion();
  if (!isStatic && !playing) setToggle('הפעלת ההדגמה', true);
  root.__loop = {
    seek(tt: number) {
      t = Math.min(Math.max(tt, 0), spec.duration);
      spec.render(root, t);
    },
    pause,
    play,
    state: () => ({ t, playing, laps: lap, done, static: isStatic }),
  };
}

export function initLessonFilms(doc: ParentNode = document) {
  doc.querySelectorAll<Root>('[data-lesson]').forEach((node) => {
    const spec = SPECS[node.dataset.lesson || ''];
    if (!spec) return;
    delete node.__loop;
    setup(node, spec);
  });
}
