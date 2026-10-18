/**
 * Engines for the two area-model explorers on topic pages.
 *
 *   fraction-times-fraction-grade-6: a unit square split into b columns
 *   (a of them shaded) and d rows (c of them shaded). The overlap is
 *   a·c cells out of b·d, so a/b × c/d = ac/bd. Steppers change a, b, c, d.
 *
 *   multiply-decimals-grade-6: a unit square with a 10 × 10 grid. Width x
 *   (tenths) and height y (hundredths) give the overlap x·y, read as
 *   x × tenths(y) + x × hundredths(y), the page's split into parts.
 *
 * Reduced motion / html.noam-a11y-motion: nothing animates; the controls
 * keep working.
 */

const SIZE = 240; // unit square side in SVG units
const PAD = 30; // room for the axis labels
const NS = 'http://www.w3.org/2000/svg';

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function fractionProduct(a: number, b: number, c: number, d: number) {
  const n = a * c;
  const m = b * d;
  const g = gcd(n, m);
  return { n, m, rn: n / g, rm: m / g };
}

/** Round to k decimals and drop trailing zeros: 0.56, 0.016, 0.576. */
export function dec(n: number, k = 3): string {
  return String(Number(n.toFixed(k)));
}

/** x × y split into x × (tenths of y) + x × (hundredths of y). */
export function decimalProduct(x: number, y: number) {
  const yt = Math.floor(Math.round(y * 100) / 10) / 10;
  const yh = Number((y - yt).toFixed(2));
  return {
    yt,
    yh,
    p1: Number((x * yt).toFixed(3)),
    p2: Number((x * yh).toFixed(3)),
    ans: Number((x * y).toFixed(4)),
  };
}

const q = (root: HTMLElement, name: string) => root.querySelector(`[data-el="${name}"]`) as HTMLElement | null;

function setText(root: HTMLElement, name: string, text: string) {
  root.querySelectorAll(`[data-el="${name}"]`).forEach((el) => {
    el.textContent = text;
  });
}

function rect(x: number, y: number, w: number, h: number, cls: string): SVGRectElement {
  const r = document.createElementNS(NS, 'rect');
  r.setAttribute('x', String(x));
  r.setAttribute('y', String(y));
  r.setAttribute('width', String(Math.max(0, w)));
  r.setAttribute('height', String(Math.max(0, h)));
  r.setAttribute('class', cls);
  return r;
}

function line(x1: number, y1: number, x2: number, y2: number, cls: string): SVGLineElement {
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', String(x1));
  l.setAttribute('y1', String(y1));
  l.setAttribute('x2', String(x2));
  l.setAttribute('y2', String(y2));
  l.setAttribute('class', cls);
  return l;
}

function announce(root: HTMLElement, text: string) {
  const live = q(root, 'live');
  if (!live) return;
  const r = root as HTMLElement & { __liveT?: number };
  window.clearTimeout(r.__liveT);
  r.__liveT = window.setTimeout(() => {
    live.textContent = text;
  }, 250);
}

/* ——— fraction × fraction ——— */

const LIMITS = { a: [1, 6], b: [2, 6], c: [1, 6], d: [2, 6] } as const;
type Key = keyof typeof LIMITS;

function setupFraction(root: HTMLElement) {
  const svg = root.querySelector('svg');
  const layer = q(root, 'layer');
  if (!svg || !layer) return;
  const v: Record<Key, number> = {
    a: Number(root.dataset.a) || 2,
    b: Number(root.dataset.b) || 3,
    c: Number(root.dataset.c) || 3,
    d: Number(root.dataset.d) || 4,
  };

  function draw(say: boolean) {
    const { a, b, c, d } = v;
    const cw = SIZE / b;
    const rh = SIZE / d;
    layer!.replaceChildren();
    layer!.append(rect(PAD, PAD, a * cw, SIZE, 'ae-a'));
    layer!.append(rect(PAD, PAD + SIZE - c * rh, SIZE, c * rh, 'ae-b'));
    layer!.append(rect(PAD, PAD + SIZE - c * rh, a * cw, c * rh, 'ae-both'));
    for (let i = 1; i < b; i += 1) layer!.append(line(PAD + i * cw, PAD, PAD + i * cw, PAD + SIZE, 'ae-grid'));
    for (let j = 1; j < d; j += 1) layer!.append(line(PAD, PAD + j * rh, PAD + SIZE, PAD + j * rh, 'ae-grid'));
    layer!.append(rect(PAD, PAD, SIZE, SIZE, 'ae-frame'));

    const { n, m, rn, rm } = fractionProduct(a, b, c, d);
    (['a', 'b', 'c', 'd'] as Key[]).forEach((k) => setText(root, k, String(v[k])));
    setText(root, 'n', String(n));
    setText(root, 'm', String(m));
    setText(root, 'rn', String(rn));
    setText(root, 'rm', String(rm));
    const reduced = q(root, 'reduced');
    if (reduced) reduced.hidden = rn === n;
    setText(root, 'cells', `${n} מתוך ${m}`);
    root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((btn) => {
      const [k, dir] = btn.dataset.step!.split(':') as [Key, string];
      const next = v[k] + Number(dir);
      const [lo, hi] = LIMITS[k];
      const max = k === 'a' ? v.b : k === 'c' ? v.d : hi;
      const min = k === 'b' ? Math.max(lo, v.a) : k === 'd' ? Math.max(lo, v.c) : lo;
      btn.disabled = next < min || next > max;
    });
    if (say) announce(root, `${a}/${b} כפול ${c}/${d} שווה ${n}/${m}${rn !== n ? `, כלומר ${rn}/${rm}` : ''}`);
  }

  root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const [k, dir] = btn.dataset.step!.split(':') as [Key, string];
      v[k] += Number(dir);
      draw(true);
    }),
  );
  draw(false);
}

/* ——— decimal × decimal ——— */

function setupDecimal(root: HTMLElement) {
  const layer = q(root, 'layer');
  const rx = q(root, 'rx') as HTMLInputElement | null;
  const ry = q(root, 'ry') as HTMLInputElement | null;
  if (!layer || !rx || !ry) return;

  function draw(say: boolean) {
    const x = Number(Number(rx!.value).toFixed(1));
    const y = Number(Number(ry!.value).toFixed(2));
    const { yt, yh, p1, p2, ans } = decimalProduct(x, y);
    const top = PAD + SIZE;
    layer!.replaceChildren();
    layer!.append(rect(PAD, PAD, x * SIZE, SIZE, 'ae-a'));
    layer!.append(rect(PAD, top - y * SIZE, SIZE, y * SIZE, 'ae-b'));
    layer!.append(rect(PAD, top - yt * SIZE, x * SIZE, yt * SIZE, 'ae-both'));
    layer!.append(rect(PAD, top - y * SIZE, x * SIZE, yh * SIZE, 'ae-both2'));
    for (let i = 1; i < 10; i += 1) {
      layer!.append(line(PAD + i * SIZE / 10, PAD, PAD + i * SIZE / 10, top, 'ae-grid'));
      layer!.append(line(PAD, PAD + i * SIZE / 10, PAD + SIZE, PAD + i * SIZE / 10, 'ae-grid'));
    }
    layer!.append(rect(PAD, PAD, SIZE, SIZE, 'ae-frame'));

    setText(root, 'x', dec(x, 1));
    setText(root, 'y', dec(y, 2));
    setText(root, 'yt', dec(yt, 1));
    setText(root, 'yh', dec(yh, 2));
    setText(root, 'p1', dec(p1));
    setText(root, 'p2', dec(p2));
    setText(root, 'ans', dec(ans, 4));
    const isSplit = yh > 0 && yt > 0;
    const split = q(root, 'split');
    if (split) split.hidden = !isSplit;
    const direct = q(root, 'direct');
    if (direct) direct.hidden = isSplit;
    const smaller = q(root, 'smaller');
    if (smaller) smaller.hidden = x === 1 || y === 1;
    rx!.setAttribute('aria-valuetext', dec(x, 1));
    ry!.setAttribute('aria-valuetext', dec(y, 2));
    if (say) announce(root, `${dec(x, 1)} כפול ${dec(y, 2)} שווה ${dec(ans, 4)}`);
  }

  rx.addEventListener('input', () => draw(true));
  ry.addEventListener('input', () => draw(true));
  draw(false);
}

export function initAreaExplorers() {
  document.querySelectorAll<HTMLElement & { __ae?: true }>('[data-area-explorer]').forEach((root) => {
    if (root.__ae) return;
    root.__ae = true;
    if (root.dataset.areaExplorer === 'fraction') setupFraction(root);
    else setupDecimal(root);
  });
}
