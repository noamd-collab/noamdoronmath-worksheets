import { sitePrefersReducedMotion } from './motionPreference.js';
/**
 * Engine for the fraction add / subtract explorer on two grade-5 topic pages
 * (component: ../components/FractionAddSubExplorer.astro).
 *
 *   add-subtract-fractions-grade-5  opens on 1/2 + 1/3 = 5/6, the page's self-check
 *   common-denominator-grade-5      opens on 1/6 + 1/8, the page's "6 and 8 give 24" example
 *
 * Two fraction strips, each split into its own denominator. Both strips are
 * re-divided into the least common denominator L, then the parts are put
 * together (addition) or taken away from the first strip (subtraction). The
 * result is reduced, and written as a mixed number when it is more than one.
 * Subtraction never goes below zero: a step or the − toggle that would make
 * the second fraction larger than the first is disabled, with a sentence.
 *
 * scene() returns plain shapes for one state. The component renders the first
 * frame from it on the server; the client rebuilds the same shapes on every
 * change, so both frames agree. Each shape carries the phase it appears in:
 *   0 the two strips   1 re-divided into L   2 parts combined   3 result named
 * Reduced motion / html.noam-a11y-motion: every change jumps to phase 3.
 *
 * No slash anywhere a reader or a screen reader meets: fractions are stacked
 * in the drawing and in the readout, and spoken as "n חלקי m".
 */

export type Op = 'add' | 'sub';
export interface Values {
  a: number;
  b: number;
  c: number;
  d: number;
}

export const LIMITS = { num: [1, 8], den: [2, 8] } as const;

/** Each page opens on its own example. */
export const START: Record<string, Values> = {
  'add-subtract-fractions-grade-5': { a: 1, b: 2, c: 1, d: 3 },
  'common-denominator-grade-5': { a: 1, b: 6, c: 1, d: 8 },
};
export const DEFAULT_START: Values = START['add-subtract-fractions-grade-5'];

export const MINUS = '−';

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

export interface Combined {
  L: number; // least common denominator
  an: number; // a/b written over L
  cn: number; // c/d written over L
  n: number; // result numerator over L (an + cn or an − cn)
  rn: number; // reduced result
  rm: number;
  whole: number; // mixed number from the reduced result: whole + pn/pm
  pn: number;
  pm: number;
  belowZero: boolean; // subtraction asked for more than the first strip holds
  smallerThanProduct: boolean; // L is smaller than b·d, the "multiply the denominators" choice
}

export function combine(v: Values, op: Op): Combined {
  const L = lcm(v.b, v.d);
  const an = v.a * (L / v.b);
  const cn = v.c * (L / v.d);
  const raw = op === 'add' ? an + cn : an - cn;
  const belowZero = raw < 0;
  const n = Math.max(0, raw);
  const g = n === 0 ? L : gcd(n, L);
  const rn = n / g;
  const rm = L / g;
  const whole = Math.floor(rn / rm);
  return {
    L,
    an,
    cn,
    n,
    rn,
    rm,
    whole,
    pn: rn - whole * rm,
    pm: rm,
    belowZero,
    smallerThanProduct: v.b !== v.d && L < v.b * v.d,
  };
}

/** Spoken fraction for screen readers, never a slash: "2 חלקי 3". */
export function sayFraction(n: number, m: number): string {
  return `${n} חלקי ${m}`;
}

/* ——— Hebrew words ——— */

const PART: Record<number, readonly [string, string, 'm' | 'f']> = {
  2: ['חצי', 'חצאים', 'm'],
  3: ['שליש', 'שלישים', 'm'],
  4: ['רבע', 'רבעים', 'm'],
  5: ['חמישית', 'חמישיות', 'f'],
  6: ['שישית', 'שישיות', 'f'],
  7: ['שביעית', 'שביעיות', 'f'],
  8: ['שמינית', 'שמיניות', 'f'],
  9: ['תשיעית', 'תשיעיות', 'f'],
  10: ['עשירית', 'עשיריות', 'f'],
};
const NUM_M = ['', 'אחד', 'שני', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה'];
const NUM_F = ['', 'אחת', 'שתי', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];

/** n parts of L in words: חצי, שני שלישים, חמש שישיות; "7 חלקים מתוך 24" past the named parts. */
export function sayParts(n: number, L: number): string {
  if (n === 0) return 'אפס';
  const part = PART[L];
  if (!part || n > 10) return n === 1 ? `חלק אחד מתוך ${L}` : `${n} חלקים מתוך ${L}`;
  if (n === 1) return part[0];
  const words = part[2] === 'm' ? NUM_M : NUM_F;
  return `${words[n]} ${part[1]}`;
}

/** The mixed number in words: שלם אחד ושליש. */
export function sayMixed(whole: number, pn: number, pm: number): string {
  const wholes = whole === 0 ? '' : whole === 1 ? 'שלם אחד' : whole === 2 ? 'שני שלמים' : `${whole} שלמים`;
  if (pn === 0) return wholes || 'אפס';
  if (!wholes) return sayParts(pn, pm);
  const parts = sayParts(pn, pm);
  return `${wholes} ו${/^\d/.test(parts) ? '־' : ''}${parts}`; // ו־5 חלקים, never ו5
}

/** "נחלק לשישיות" / "נחלק ל־24 חלקים" — the re-division step, written on the drawing. */
export function splitLabel(L: number): string {
  const part = PART[L];
  return part ? `נחלק ל${part[1]}` : `נחלק ל־${L} חלקים`;
}

/** The whole sum or difference in words: "חצי ועוד שליש שווה חמש שישיות". */
export function sentence(v: Values, op: Op, r: Combined): string {
  const left = `${sayParts(v.a, v.b)} ${op === 'add' ? 'ועוד' : 'פחות'} ${sayParts(v.c, v.d)}`;
  return `${left} שווה ${sayMixed(r.whole, r.pn, r.pm)}`;
}

/** Short sentence for the blocked control in subtraction. */
export const BELOW_ZERO_TEXT = 'בחיסור לא יורדים מתחת לאפס, ולכן השבר השני אינו יכול להיות גדול מהראשון. הכפתור חסום.';

/** The hint beside the step: the least common denominator is smaller than the product. */
export function smallestHint(v: Values, r: Combined): string {
  return `המכנה המשותף הקטן ביותר של ${v.b} ו־${v.d} הוא ${r.L}, לא ${v.b * v.d}.`;
}

/** What the live region reads after a change: words, then the numbers, no slash. */
export function liveText(v: Values, op: Op, r: Combined): string {
  const sign = op === 'add' ? 'ועוד' : 'פחות';
  const numbers = `${sayFraction(r.an, r.L)} ${sign} ${sayFraction(r.cn, r.L)} שווה ${sayFraction(r.n, r.L)}`;
  const reduced = r.rn !== r.n ? `, כלומר ${sayFraction(r.rn, r.rm)}` : '';
  return `${sentence(v, op, r)}. ${numbers}${reduced}`;
}

/* ——— steps and their limits ——— */

export type Key = keyof Values;
export const STEPS: ReadonlyArray<readonly [Key, 1 | -1]> = [
  ['a', -1], ['a', 1], ['b', -1], ['b', 1], ['c', -1], ['c', 1], ['d', -1], ['d', 1],
];

export function withinLimits(t: Values): boolean {
  const [nLo, nHi] = LIMITS.num;
  const [dLo, dHi] = LIMITS.den;
  if (t.b < dLo || t.b > dHi || t.d < dLo || t.d > dHi) return false;
  if (t.a < nLo || t.a > nHi || t.c < nLo || t.c > nHi) return false;
  return t.a <= t.b && t.c <= t.d; // never more than one whole per strip
}

export function secondLarger(t: Values): boolean {
  return t.a * t.d < t.c * t.b;
}

/** A step is allowed when it stays in range and, in subtraction, keeps the result at zero or above. */
export function canStep(v: Values, op: Op, k: Key, dir: 1 | -1): boolean {
  const t = { ...v, [k]: v[k] + dir } as Values;
  return withinLimits(t) && !(op === 'sub' && secondLarger(t));
}

/** True when some control is disabled only by the below-zero rule, or the − toggle is. */
export function belowZeroBlocks(v: Values, op: Op): boolean {
  if (secondLarger(v)) return true; // the − toggle itself
  if (op !== 'sub') return false;
  return STEPS.some(([k, dir]) => {
    const t = { ...v, [k]: v[k] + dir } as Values;
    return withinLimits(t) && secondLarger(t);
  });
}

/* ——— the drawing ——— */

export const SW = 240; // strip width in viewBox units
export const SH = 26; // strip height
export const X0 = 12; // strips start here; the labels sit to their right
export const LX = 288; // centre of the label column
export const VW = 320; // viewBox width
const Y_A = 12;
const Y_B = Y_A + SH + 20;
const Y_STEP = Y_B + SH + 22; // baseline of the "נחלק ל…" line
const Y_R1 = Y_STEP + 14;
const Y_R2 = Y_R1 + SH + 8;
const FONT = 14;

export type Shape =
  | { k: 'rect'; x: number; y: number; w: number; h: number; cls: string }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; cls: string }
  | { k: 'text'; x: number; y: number; text: string; cls: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

function rect(x: number, y: number, w: number, h: number, cls: string): Shape {
  return { k: 'rect', x: r2(x), y: r2(y), w: r2(Math.max(0, w)), h: r2(h), cls };
}
function line(x1: number, y1: number, x2: number, y2: number, cls: string): Shape {
  return { k: 'line', x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), cls };
}
function text(x: number, y: number, t: string, cls: string): Shape {
  return { k: 'text', x: r2(x), y: r2(y), text: t, cls };
}

/** A stacked fraction in the drawing: numerator, bar, denominator, centred on (x, yc). */
export function fracShapes(x: number, yc: number, n: number, d: number, cls: string): Shape[] {
  const width = Math.max(String(n).length, String(d).length) * FONT * 0.62 + 6;
  return [
    text(x, yc - 3, String(n), `fs-t ${cls}`),
    line(x - width / 2, yc, x + width / 2, yc, `fs-bar ${cls}`),
    text(x, yc + FONT - 1, String(d), `fs-t ${cls}`),
  ];
}

function strip(y: number, num: number, den: number, L: number, fill: string, phaseFine: string): Shape[] {
  const out: Shape[] = [rect(X0, y, (num * SW) / den, SH, fill)];
  for (let j = 1; j < L; j += 1) {
    if ((j * den) % L === 0) continue; // a coarse line sits here already
    out.push(line(X0 + (j * SW) / L, y, X0 + (j * SW) / L, y + SH, `fs-fine ${phaseFine}`));
  }
  for (let i = 1; i < den; i += 1) out.push(line(X0 + (i * SW) / den, y, X0 + (i * SW) / den, y + SH, 'fs-grid'));
  out.push(rect(X0, y, SW, SH, 'fs-frame'));
  return out;
}

function resultRow(y: number, cells: Array<'a' | 'b' | 'gone'>, L: number, resultCells: number): Shape[] {
  const u = SW / L;
  const out: Shape[] = [];
  cells.forEach((kind, i) => {
    out.push(rect(X0 + i * u, y, u, SH, kind === 'b' ? 'fs-b ph2' : 'fs-a ph2'));
    if (kind === 'gone') {
      out.push(rect(X0 + i * u, y, u, SH, 'fs-gone ph2'));
      out.push(line(X0 + i * u + 1.5, y + 1.5, X0 + (i + 1) * u - 1.5, y + SH - 1.5, 'fs-x ph2'));
      out.push(line(X0 + (i + 1) * u - 1.5, y + 1.5, X0 + i * u + 1.5, y + SH - 1.5, 'fs-x ph2'));
    }
  });
  for (let j = 1; j < L; j += 1) out.push(line(X0 + j * u, y, X0 + j * u, y + SH, 'fs-fine ph2'));
  out.push(rect(X0, y, SW, SH, 'fs-frame ph2'));
  if (resultCells > 0) out.push(rect(X0, y, resultCells * u, SH, 'fs-result ph3'));
  return out;
}

export interface Scene {
  shapes: Shape[];
  height: number;
  twoRows: boolean;
}

export function scene(v: Values, op: Op): Scene {
  const r = combine(v, op);
  const { L } = r;
  const shapes: Shape[] = [];
  shapes.push(...strip(Y_A, v.a, v.b, L, 'fs-a', 'ph1'));
  shapes.push(...strip(Y_B, v.c, v.d, L, 'fs-b', 'ph1'));
  shapes.push(...fracShapes(LX, Y_A + SH / 2, v.a, v.b, 'fs-la'));
  shapes.push(text(LX, Y_B - 4, op === 'add' ? '+' : MINUS, 'fs-op'));
  shapes.push(...fracShapes(LX, Y_B + SH / 2, v.c, v.d, 'fs-lb'));
  shapes.push(text(X0 + SW / 2, Y_STEP, splitLabel(L), 'fs-step ph1'));
  shapes.push(text(LX, Y_STEP, '=', 'fs-op ph2'));

  const twoRows = r.n > L;
  if (op === 'add') {
    const row1: Array<'a' | 'b'> = [];
    for (let i = 0; i < Math.min(r.n, L); i += 1) row1.push(i < r.an ? 'a' : 'b');
    shapes.push(...resultRow(Y_R1, row1, L, twoRows ? L : r.n));
    if (twoRows) {
      const row2: Array<'b'> = Array.from({ length: r.n - L }, () => 'b');
      shapes.push(...resultRow(Y_R2, row2, L, r.n - L));
    }
  } else {
    const row1: Array<'a' | 'gone'> = [];
    for (let i = 0; i < r.an; i += 1) row1.push(i < r.n ? 'a' : 'gone');
    shapes.push(...resultRow(Y_R1, row1, L, r.n));
  }
  shapes.push(...fracShapes(LX, Y_R1 + SH / 2, r.n, L, 'fs-lr ph3'));
  const yWords = (twoRows ? Y_R2 : Y_R1) + SH + 22;
  shapes.push(text(X0 + SW / 2, yWords, sayMixed(r.whole, r.pn, r.pm), 'fs-words ph3'));
  return { shapes, height: yWords + 8, twoRows };
}

/* ——— client ——— */

const NS = 'http://www.w3.org/2000/svg';
const q = (root: HTMLElement, name: string) => root.querySelector(`[data-el="${name}"]`) as HTMLElement | null;

function setText(root: HTMLElement, name: string, value: string) {
  root.querySelectorAll(`[data-el="${name}"]`).forEach((el) => {
    el.textContent = value;
  });
}

function announce(root: HTMLElement, value: string) {
  const live = q(root, 'live');
  if (!live) return;
  const r = root as HTMLElement & { __liveT?: number };
  window.clearTimeout(r.__liveT);
  r.__liveT = window.setTimeout(() => {
    live.textContent = value;
  }, 250);
}

function reducedMotion(): boolean {
  return (
    sitePrefersReducedMotion() ||
    document.documentElement.classList.contains('noam-a11y-motion')
  );
}

export function renderShapes(layer: SVGGElement, shapes: Shape[]) {
  layer.replaceChildren();
  for (const s of shapes) {
    if (s.k === 'rect') {
      const el = document.createElementNS(NS, 'rect');
      el.setAttribute('x', String(s.x));
      el.setAttribute('y', String(s.y));
      el.setAttribute('width', String(s.w));
      el.setAttribute('height', String(s.h));
      el.setAttribute('class', s.cls);
      layer.append(el);
    } else if (s.k === 'line') {
      const el = document.createElementNS(NS, 'line');
      el.setAttribute('x1', String(s.x1));
      el.setAttribute('y1', String(s.y1));
      el.setAttribute('x2', String(s.x2));
      el.setAttribute('y2', String(s.y2));
      el.setAttribute('class', s.cls);
      layer.append(el);
    } else {
      const el = document.createElementNS(NS, 'text');
      el.setAttribute('x', String(s.x));
      el.setAttribute('y', String(s.y));
      el.setAttribute('text-anchor', 'middle');
      el.setAttribute('class', s.cls);
      el.textContent = s.text;
      layer.append(el);
    }
  }
}

const PHASE_MS = [0, 650, 1400, 2150];

function setup(root: HTMLElement) {
  const svg = root.querySelector('svg');
  const layer = root.querySelector('[data-el="layer"]') as SVGGElement | null;
  if (!svg || !layer) return;
  const start = START[root.dataset.slug || ''] ?? DEFAULT_START;
  const v: Values = { ...start };
  let op: Op = root.dataset.op === 'sub' ? 'sub' : 'add';
  const timers: number[] = [];

  function phase(p: number) {
    svg!.dataset.phase = String(p);
  }

  function play() {
    timers.splice(0).forEach((t) => window.clearTimeout(t));
    if (reducedMotion()) {
      phase(3);
      return;
    }
    phase(0);
    PHASE_MS.forEach((ms, p) => {
      if (p > 0) timers.push(window.setTimeout(() => phase(p), ms));
    });
  }

  function draw(say: boolean) {
    const r = combine(v, op);
    const sc = scene(v, op);
    renderShapes(layer!, sc.shapes);
    svg!.setAttribute('viewBox', `0 0 ${VW} ${sc.height}`);
    (['a', 'b', 'c', 'd'] as Key[]).forEach((k) => setText(root, k, String(v[k])));
    setText(root, 'an', String(r.an));
    setText(root, 'cn', String(r.cn));
    setText(root, 'L', String(r.L));
    setText(root, 'n', String(r.n));
    setText(root, 'rn', String(r.rn));
    setText(root, 'rm', String(r.rm));
    setText(root, 'whole', String(r.whole));
    setText(root, 'pn', String(r.pn));
    setText(root, 'pm', String(r.pm));
    setText(root, 'sign', op === 'add' ? '+' : MINUS);
    setText(root, 'words', sentence(v, op, r));
    setText(root, 'smallest', smallestHint(v, r));
    const reduced = q(root, 'reduced');
    if (reduced) reduced.hidden = r.rn === r.n || r.n === 0 || r.rm === 1; // a whole is written once, not as 1 over 1
    const mixed = q(root, 'mixed');
    if (mixed) mixed.hidden = r.whole === 0 || r.pn === 0;
    const wholeOnly = q(root, 'whole-only');
    if (wholeOnly) wholeOnly.hidden = !(r.whole > 0 && r.pn === 0);
    const smallest = q(root, 'smallest');
    if (smallest) smallest.hidden = !r.smallerThanProduct;
    const blocked = q(root, 'blocked');
    if (blocked) blocked.hidden = !belowZeroBlocks(v, op);
    root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((btn) => {
      const [k, dir] = btn.dataset.step!.split(':') as [Key, string];
      btn.disabled = !canStep(v, op, k, Number(dir) as 1 | -1);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-op]').forEach((btn) => {
      const mine = btn.dataset.op === op;
      btn.setAttribute('aria-pressed', mine ? 'true' : 'false');
      btn.disabled = btn.dataset.op === 'sub' && secondLarger(v);
    });
    root.dataset.op = op;
    if (say) announce(root, liveText(v, op, r));
    play();
  }

  root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const [k, dir] = btn.dataset.step!.split(':') as [Key, string];
      if (!canStep(v, op, k, Number(dir) as 1 | -1)) return;
      v[k] += Number(dir);
      draw(true);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-op]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const next = btn.dataset.op === 'sub' ? 'sub' : 'add';
      if (next === op || (next === 'sub' && secondLarger(v))) return;
      op = next;
      draw(true);
    }),
  );
  draw(false);
}

export function initFractionAddSubExplorers() {
  document.querySelectorAll<HTMLElement & { __fs?: true }>('[data-fraction-add-sub]').forEach((root) => {
    if (root.__fs) return;
    root.__fs = true;
    setup(root);
  });
}
