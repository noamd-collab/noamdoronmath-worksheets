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

function renderRoots(root: Root, t: number) {
  const alive = 1 - ph(t, 11.6, 12.6);
  for (let i = 0; i < 9; i++) op(q(root, `cell-${i}`), ph(t, 0.7 + i * 0.38, 1.05 + i * 0.38) * alive);
  op(q(root, 'side'), ph(t, 4.2, 4.7) * alive);
  op(q(root, 'eq-sq'), ph(t, 4.6, 5.2) * alive);
  op(q(root, 'rad'), ph(t, 6.2, 6.6) * alive);
  draw(q(root, 'rad-path'), ph(t, 6.3, 7.3));
  op(q(root, 'eq-root'), ph(t, 7.5, 8.2) * alive);
  op(q(root, 'top0'), (1 - ph(t, 5.8, 6.3)) * alive + ph(t, 11.6, 12.6));
  op(q(root, 'top1'), ph(t, 6.0, 6.5) * alive);
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
  const alive = 1 - ph(t, 12.4, 13.4);
  op(q(root, 'expr'), (1 - ph(t, 2.2, 2.8)) * alive);
  const slide = ph(t, 3.4, 5.2);
  const start = [78, 142, 250, 322, 394];
  const end = [92, 164, 236, 308, 380];
  for (let i = 0; i < 5; i++) {
    const born = ph(t, 2.3 + (i < 2 ? 0 : 0.35), 2.8 + (i < 2 ? 0 : 0.35));
    op(q(root, `f${i}`), born * alive);
    move(q(root, `f${i}`), lerp(start[i], end[i], slide), 150);
    op(q(root, `c${i}`), ph(t, 5.6 + i * 0.32, 5.9 + i * 0.32) * alive);
    move(q(root, `c${i}`), end[i], 108);
  }
  op(q(root, 'plus'), ph(t, 7.6, 8.2) * alive);
  op(q(root, 'result'), ph(t, 8.5, 9.2) * alive);
  op(q(root, 'top0'), (1 - ph(t, 2.0, 2.5)) * alive + ph(t, 12.4, 13.4));
  op(q(root, 'top1'), ph(t, 2.2, 2.7) * (1 - ph(t, 7.3, 7.8)) * alive);
  op(q(root, 'top2'), ph(t, 7.5, 8.0) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 4.2, 4.7)) * alive + ph(t, 14.6, 15.5));
  op(q(root, 'top1'), ph(t, 4.4, 4.9) * (1 - ph(t, 8.4, 8.9)) * alive);
  op(q(root, 'top2'), ph(t, 8.6, 9.1) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 3.0, 3.5)) * alive + ph(t, 14.6, 15.6));
  op(q(root, 'top1'), ph(t, 3.2, 3.7) * (1 - ph(t, 5.8, 6.3)) * alive);
  op(q(root, 'top2'), ph(t, 6.0, 6.5) * alive);
}

function renderCoord(root: Root, t: number) {
  const alive = 1 - ph(t, 13.4, 14.4);
  op(q(root, 'ptA'), ph(t, 0.4, 0.8) * alive);
  op(q(root, 'lblA'), ph(t, 0.5, 0.9) * alive);
  op(q(root, 'ptB'), ph(t, 1.2, 1.6) * alive);
  op(q(root, 'lblB'), ph(t, 1.3, 1.7) * alive);
  op(q(root, 'ab'), ph(t, 1.8, 2.1) * alive);
  draw(q(root, 'ab'), ph(t, 1.9, 2.8));
  for (let i = 1; i <= 5; i++) op(q(root, `ab-${i}`), ph(t, 2.2 + i * 0.28, 2.45 + i * 0.28) * alive);
  op(q(root, 'lenAB'), ph(t, 3.8, 4.3) * alive);
  op(q(root, 'ptC'), ph(t, 4.6, 5.0) * alive);
  op(q(root, 'lblC'), ph(t, 4.7, 5.1) * alive);
  op(q(root, 'bc'), ph(t, 5.2, 5.5) * alive);
  draw(q(root, 'bc'), ph(t, 5.3, 6.0));
  for (let i = 1; i <= 3; i++) op(q(root, `bc-${i}`), ph(t, 5.5 + i * 0.28, 5.75 + i * 0.28) * alive);
  op(q(root, 'lenBC'), ph(t, 6.6, 7.1) * alive);
  op(q(root, 'ca'), ph(t, 7.2, 7.6) * alive);
  draw(q(root, 'ca'), ph(t, 7.3, 8.1));
  op(q(root, 'area'), ph(t, 8.4, 9.0) * alive);
  op(q(root, 'top0'), (1 - ph(t, 1.6, 2.1)) * alive + ph(t, 13.4, 14.4));
  op(q(root, 'top1'), ph(t, 1.8, 2.3) * (1 - ph(t, 8.0, 8.5)) * alive);
  op(q(root, 'top2'), ph(t, 8.2, 8.7) * alive);
}

function ride(hours: number) {
  if (hours <= 2) return { d: 15 * hours, v: '15' };
  if (hours <= 3) return { d: 30, v: '0' };
  return { d: Math.max(0, 30 - 15 * (hours - 3)), v: '15' };
}

function renderRead(root: Root, t: number) {
  const alive = 1 - ph(t, 12.6, 13.5);
  const hours = lerp(0, 5, ph(t, 0.5, 10.5));
  const { d, v } = ride(Math.min(5, hours));
  const gx = 78 + hours * 74;
  const gy = 268 - d * 3.6;
  const rx = 64 + (d / 30) * 420;
  attr(q(root, 'rider'), 'cx', rx);
  attr(q(root, 'gdot'), 'cx', gx);
  attr(q(root, 'gdot'), 'cy', gy);
  attr(q(root, 'dashv'), 'x1', gx);
  attr(q(root, 'dashv'), 'x2', gx);
  attr(q(root, 'dashv'), 'y1', gy);
  attr(q(root, 'dashh'), 'y1', gy);
  attr(q(root, 'dashh'), 'y2', gy);
  attr(q(root, 'dashh'), 'x2', gx);
  op(q(root, 'dashv'), ph(t, 0.8, 1.2) * alive);
  op(q(root, 'dashh'), ph(t, 0.8, 1.2) * alive);
  op(q(root, 'rider'), alive);
  op(q(root, 'gdot'), ph(t, 0.4, 0.8) * alive);
  draw(q(root, 'trail'), ph(t, 0.5, 10.5));
  text(q(root, 'speed'), `${v} קמ״ש`);
  text(q(root, 'clock'), `${hours.toFixed(1)} שע׳`);
  text(q(root, 'dist'), `${d.toFixed(0)} ק״מ`);
  op(q(root, 'readout'), ph(t, 0.8, 1.2) * alive);
  op(q(root, 'sum'), ph(t, 10.6, 11.2) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 4.4, 4.9)) * alive + ph(t, 12.4, 13.4));
  op(q(root, 'top1'), ph(t, 4.6, 5.1) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 5.8, 6.3)) * alive + ph(t, 12.4, 13.4));
  op(q(root, 'top1'), ph(t, 6.0, 6.5) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 4.6, 5.1)) * alive + ph(t, 12.4, 13.4));
  op(q(root, 'top1'), ph(t, 4.8, 5.3) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 3.8, 4.3)) * alive + ph(t, 13.4, 14.4));
  op(q(root, 'top1'), ph(t, 4.0, 4.5) * (1 - ph(t, 6.0, 6.5)) * alive);
  op(q(root, 'top2'), ph(t, 6.2, 6.7) * alive);
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
  op(q(root, 'eq1'), ph(t, 3.8, 4.4) * (1 - scene2) * alive);
  op(q(root, 'eq2'), ph(t, 9.7, 10.3) * alive);
  op(q(root, 'top0'), (1 - ph(t, 6.2, 6.7)) * alive + ph(t, 12.6, 13.6));
  op(q(root, 'top1'), ph(t, 6.4, 6.9) * alive);
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
  op(q(root, 'eq1'), ph(t, 3.9, 4.5) * (1 - scene2) * alive);
  op(q(root, 'eq2'), ph(t, 10.2, 10.8) * alive);
  op(q(root, 'top0'), (1 - ph(t, 6.2, 6.7)) * alive + ph(t, 12.6, 13.6));
  op(q(root, 'top1'), ph(t, 6.4, 6.9) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 5.0, 5.5)) * alive + ph(t, 13.4, 14.4));
  op(q(root, 'top1'), ph(t, 5.2, 5.7) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 4.2, 4.7)) * alive + ph(t, 12.4, 13.4));
  op(q(root, 'top1'), ph(t, 4.4, 4.9) * alive);
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
  op(q(root, 'top0'), (1 - ph(t, 3.3, 3.8)) * alive + ph(t, 11.4, 12.4));
  op(q(root, 'top1'), ph(t, 3.5, 4.0) * alive);
}

function renderTriangles(root: Root, t: number) {
  const alive = 1 - ph(t, 12.4, 13.4);
  const p = ph(t, 0.8, 8.4);
  const A = { x: lerp(280, 360, p), y: lerp(48, 118, p) };
  const B = { x: 110, y: 236 };
  const C = { x: 450, y: 236 };
  const poly = q(root, 'tri');
  if (poly) poly.setAttribute('points', `${r2(A.x)},${r2(A.y)} ${B.x},${B.y} ${C.x},${C.y}`);
  putArc(q(root, 'arcA'), A.x, A.y, 28, ray(A, B), ray(A, C));
  putArc(q(root, 'arcB'), B.x, B.y, 26, ray(B, C), ray(B, A));
  putArc(q(root, 'arcC'), C.x, C.y, 26, ray(C, A), ray(C, B));
  const aDeg = Math.round(corner(A, B, C));
  const bDeg = Math.round(corner(B, A, C));
  const cDeg = 180 - aDeg - bDeg;
  text(q(root, 'degA'), `${aDeg}°`);
  text(q(root, 'degB'), `${bDeg}°`);
  text(q(root, 'degC'), `${cDeg}°`);
  putLabel(q(root, 'degA'), A.x, A.y, 46, ray(A, B), ray(A, C));
  putLabel(q(root, 'degB'), B.x, B.y, 44, ray(B, C), ray(B, A));
  putLabel(q(root, 'degC'), C.x, C.y, 44, ray(C, A), ray(C, B));
  text(q(root, 'sum'), `${aDeg}° + ${bDeg}° + ${cDeg}° = 180°`);
  op(q(root, 'sum'), ph(t, 1.2, 1.6) * alive);
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
  { name: 0, a: [190, 108, 30, 0, 45], b: [310, 228, 30, 180, 225], da: '45°', db: '45°', sum: 0 },
  { name: 1, a: [190, 108, 30, 180, 225], b: [310, 228, 30, 0, 45], da: '45°', db: '45°', sum: 0 },
  { name: 2, a: [190, 108, 28, 0, 45], b: [310, 228, 42, 225, 360], da: '45°', db: '135°', sum: 1 },
  { name: 3, a: [190, 108, 26, 0, 45], b: [190, 108, 42, 180, 225], da: '45°', db: '45°', sum: 0 },
  { name: 4, a: [190, 108, 26, 0, 45], b: [190, 108, 42, 45, 180], da: '45°', db: '135°', sum: 1 },
];

function renderParallel(root: Root, t: number) {
  const alive = 1 - ph(t, 16.6, 17.6);
  const step = Math.min(4, Math.max(0, Math.floor((t - 0.3) / 3.2)));
  const local = ph(t, 0.3 + step * 3.2, 0.9 + step * 3.2);
  const spec = PARA[step];
  op(q(root, 'arcA'), local * alive);
  op(q(root, 'arcB'), local * alive);
  op(q(root, 'degA'), local * alive);
  op(q(root, 'degB'), local * alive);
  putArc(q(root, 'arcA'), spec.a[0], spec.a[1], spec.a[2], rad(spec.a[3]), rad(spec.a[4]));
  putArc(q(root, 'arcB'), spec.b[0], spec.b[1], spec.b[2], rad(spec.b[3]), rad(spec.b[4]));
  text(q(root, 'degA'), spec.da);
  text(q(root, 'degB'), spec.db);
  putLabel(q(root, 'degA'), spec.a[0], spec.a[1], spec.a[2] + 18, rad(spec.a[3]), rad(spec.a[4]));
  putLabel(q(root, 'degB'), spec.b[0], spec.b[1], spec.b[2] + 18, rad(spec.b[3]), rad(spec.b[4]));
  for (let i = 0; i < 5; i++) op(q(root, `cap${i}`), (i === step ? local : 0) * alive);
  op(q(root, 'sumline'), spec.sum * local * alive);
  if (t < 0.3) {
    op(q(root, 'cap0'), alive);
  }
}

const SPECS: Record<string, Spec> = {
  roots: { duration: 13, hold: 10.2, render: renderRoots },
  ineq: { duration: 12, hold: 8.6, render: renderIneq },
  'exp-rules': { duration: 14, hold: 11.2, render: renderExp },
  powers: { duration: 16, hold: 13.2, render: renderPowers },
  median: { duration: 16, hold: 13.0, render: renderMedian },
  'coord-app': { duration: 15, hold: 12.0, render: renderCoord },
  'read-graph': { duration: 14, hold: 11.6, render: renderRead },
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
  triangles: { duration: 14, hold: 9.2, render: renderTriangles },
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
