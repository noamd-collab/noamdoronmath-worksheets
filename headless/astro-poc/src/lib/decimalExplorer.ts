/**
 * Engines for two decimal explorers on topic pages.
 *
 *   divide-decimals-grade-6: a 0–1 number line in tenths. The dividend is a
 *   bar from 0; jumps of the divisor are drawn along it, so 0.8 : 0.2 is
 *   "how many jumps of 0.2 reach 0.8" = 8 : 2 = 4.
 *
 *   decimal-place-value-grade-5: a 10 × 10 grid of hundredths. A value is
 *   shown as full columns (tenths) plus single squares (hundredths), so
 *   0.25 = 2 tenths and 5 hundredths.
 *
 * Reduced motion: nothing animates; the sliders keep working.
 */

const NS = 'http://www.w3.org/2000/svg';

/** x : y for tenths x10, y10 (1–10): jumps, remainder (in tenths) and quotient. */
export function decimalQuotient(x10: number, y10: number) {
  const jumps = Math.floor(x10 / y10);
  const rem = x10 - jumps * y10;
  const exact = x10 / y10;
  const rounded = Math.round(exact * 100) / 100;
  return { jumps, rem, quotient: rounded, approx: Math.abs(rounded - exact) > 1e-9 };
}

/** "= 4" or "≈ 3.33": the sign belongs to the answer. */
export function quotientText(x10: number, y10: number): string {
  const { quotient, approx } = decimalQuotient(x10, y10);
  return `${approx ? '≈' : '='} ${quotient}`;
}

/** The sentence under the readout, e.g. "… 2 קפיצות שלמות, ונשאר עוד 0.1." */
export function divideHint(x10: number, y10: number): string {
  const { jumps, rem } = decimalQuotient(x10, y10);
  const tail = rem > 0 ? `, ונשאר עוד ${tenths(rem)}` : '';
  return `בעשיריות: ${x10} עשיריות לחלק ל־${y10} עשיריות. ${jumps} קפיצות שלמות${tail}.`;
}

/** Hundredths h (0–100) as tenths and hundredths: 25 → 2 tenths, 5 hundredths. */
export function placeValue(h: number) {
  return { tenths: Math.floor(h / 10), hundredths: h % 10 };
}

/** The sentence at 100 hundredths, instead of "1 הם 10 עשיריות ו־0 מאיות". */
export const placeWholeText = '1 הוא 10 עשיריות, שהן 100 מאיות';

/** Tenths count as a decimal string: 8 → "0.8", 10 → "1". */
export function tenths(n: number): string {
  return String(n / 10);
}

/** Hundredths count as a decimal string: 25 → "0.25", 100 → "1". */
export function hundredths(n: number): string {
  return String(Number((n / 100).toFixed(2)));
}

/* number line geometry, shared with the component's first frame */
export const LINE = { x0: 20, x1: 280, y: 92 } as const;
export const at = (t: number) => LINE.x0 + ((LINE.x1 - LINE.x0) * t) / 10;

/** Arc path for jump k of size y10 tenths. */
export function jumpPath(k: number, y10: number): string {
  const a = at(k * y10);
  const b = at((k + 1) * y10);
  const h = Math.min(46, 14 + y10 * 7);
  return `M${a} ${LINE.y} Q${(a + b) / 2} ${LINE.y - h * 2} ${b} ${LINE.y}`;
}

const q = (root: HTMLElement, name: string) => root.querySelector(`[data-el="${name}"]`) as HTMLElement | null;

function setText(root: HTMLElement, name: string, text: string) {
  root.querySelectorAll(`[data-el="${name}"]`).forEach((el) => {
    el.textContent = text;
  });
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

function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function setupDivide(root: HTMLElement) {
  const layer = q(root, 'layer');
  const rx = q(root, 'rx') as HTMLInputElement | null;
  const ry = q(root, 'ry') as HTMLInputElement | null;
  if (!layer || !rx || !ry) return;

  function draw(say: boolean) {
    const x10 = Math.round(Number(rx!.value));
    const y10 = Math.round(Number(ry!.value));
    const { jumps, rem, quotient } = decimalQuotient(x10, y10);
    layer!.replaceChildren();
    layer!.append(el('rect', { x: at(0), y: LINE.y + 6, width: at(x10) - at(0), height: 10, rx: 3, class: 'de-bar' }));
    for (let k = 0; k < jumps; k += 1) layer!.append(el('path', { d: jumpPath(k, y10), class: 'de-jump' }));
    if (rem > 0) {
      layer!.append(
        el('rect', { x: at(jumps * y10), y: LINE.y + 6, width: at(x10) - at(jumps * y10), height: 10, class: 'de-rem' }),
      );
    }
    for (let k = 0; k < jumps; k += 1) {
      const t = el('text', { x: (at(k * y10) + at((k + 1) * y10)) / 2, y: LINE.y - Math.min(46, 14 + y10 * 7) - 6, class: 'de-n', 'text-anchor': 'middle' });
      t.textContent = String(k + 1);
      layer!.append(t);
    }

    setText(root, 'x', tenths(x10));
    setText(root, 'y', tenths(y10));
    setText(root, 'x10', String(x10));
    setText(root, 'y10', String(y10));
    setText(root, 'q', quotientText(x10, y10));
    setText(root, 'hint', divideHint(x10, y10));
    rx!.setAttribute('aria-valuetext', tenths(x10));
    ry!.setAttribute('aria-valuetext', tenths(y10));
    if (say) announce(root, `${tenths(x10)} לחלק ל־${tenths(y10)} שווה ${quotient}`);
  }

  rx.addEventListener('input', () => draw(true));
  ry.addEventListener('input', () => draw(true));
  draw(false);
}

function setupPlace(root: HTMLElement) {
  const range = q(root, 'range') as HTMLInputElement | null;
  const grid = q(root, 'grid');
  if (!range || !grid) return;
  const cells = Array.from(grid.children) as HTMLElement[];

  function draw(say: boolean) {
    const h = Math.round(Number(range!.value));
    const { tenths: t, hundredths: u } = placeValue(h);
    cells.forEach((c, i) => {
      const col = Number(c.dataset.col);
      const row = Number(c.dataset.row);
      c.classList.toggle('is-tenth', col < t);
      c.classList.toggle('is-hundredth', col === t && row < u);
    });
    setText(root, 'v', hundredths(h));
    setText(root, 't', String(t));
    setText(root, 'u', String(u));
    setText(root, 'h', String(h));
    const whole = h === 100;
    const parts = q(root, 'parts');
    if (parts) parts.hidden = whole;
    const wholeEl = q(root, 'whole');
    if (wholeEl) wholeEl.hidden = !whole;
    range!.setAttribute('aria-valuetext', whole ? placeWholeText : `${hundredths(h)}: ${t} עשיריות ו־${u} מאיות`);
    if (say) announce(root, whole ? placeWholeText : `${hundredths(h)} הם ${t} עשיריות ו־${u} מאיות`);
  }

  range.addEventListener('input', () => draw(true));
  draw(false);
}

export function initDecimalExplorers() {
  document.querySelectorAll<HTMLElement & { __de?: true }>('[data-decimal-explorer]').forEach((root) => {
    if (root.__de) return;
    root.__de = true;
    if (root.dataset.decimalExplorer === 'divide') setupDivide(root);
    else setupPlace(root);
  });
}
