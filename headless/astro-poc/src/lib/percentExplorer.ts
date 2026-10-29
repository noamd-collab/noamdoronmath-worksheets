import { sitePrefersReducedMotion } from './motionPreference.js';
/**
 * Engine for the percent-of-quantity explorer (topic page).
 *
 * The quantity Q is split into 100 squares, so one square is 1% = Q : 100.
 * Colouring P squares gives P% = P × (Q : 100). Drag across the grid, use
 * the synced range input, or pick Q from the chips. A short fill demo
 * (once, in view only) runs 0 → 45 first. Reduced motion: no demo.
 */

type PctRoot = HTMLElement & { __pct?: true };

const DEMO_MS = 1800;

const q = (root: HTMLElement, name: string) => root.querySelector(`[data-el="${name}"]`) as HTMLElement | null;

function motionOff(): boolean {
  return (
    sitePrefersReducedMotion() ||
    document.documentElement.classList.contains('noam-a11y-motion')
  );
}

/** Up to 2 decimals, no trailing zeros: 2, 1.5, 0.8, 67.5. */
export function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function percentOf(p: number, quantity: number): { one: number; ans: number } {
  const one = quantity / 100;
  return { one, ans: Math.round(p * one * 100) / 100 };
}

function setup(root: PctRoot) {
  const grid = q(root, 'grid');
  const range = q(root, 'range') as HTMLInputElement | null;
  if (!grid || !range) return;
  const cells = Array.from(grid.children) as HTMLElement[];
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('.pct-chip'));
  const live = q(root, 'live');

  let quantity = Number(root.dataset.q) || 200;
  let p = Number(root.dataset.p) || 0;
  let demoRaf = 0;
  let demoDone = false;
  let liveTimer = 0;

  function render(announce: boolean) {
    const { one, ans } = percentOf(p, quantity);
    cells.forEach((c, i) => c.classList.toggle('is-on', i < p));
    if (range!.value !== String(p)) range!.value = String(p);
    const set = (name: string, text: string) => {
      const el = q(root, name);
      if (el) el.textContent = text;
    };
    set('ask-p', `${p}%`);
    set('ask-q', String(quantity));
    set('q', String(quantity));
    set('one', fmt(one));
    set('one2', fmt(one));
    set('p', String(p));
    set('p2', String(p));
    set('ans', fmt(ans));
    range!.setAttribute('aria-valuetext', `${p}% מתוך ${quantity} הם ${fmt(ans)}`);
    if (announce && live) {
      window.clearTimeout(liveTimer);
      liveTimer = window.setTimeout(() => {
        live.textContent = `${p}% מתוך ${quantity} הם ${fmt(ans)}`;
      }, 250);
    }
  }

  function stopDemo() {
    demoDone = true;
    if (demoRaf) cancelAnimationFrame(demoRaf);
    demoRaf = 0;
  }

  function setP(next: number, announce = true) {
    p = Math.min(100, Math.max(0, Math.round(next)));
    render(announce);
  }

  /* grid cells run right-to-left, top to bottom (the page is RTL) */
  function pFromPointer(e: PointerEvent): number {
    const r = grid!.getBoundingClientRect();
    const col = Math.min(9, Math.max(0, Math.floor(((r.right - e.clientX) / r.width) * 10)));
    const row = Math.min(9, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * 10)));
    return row * 10 + col + 1;
  }

  let dragging = false;
  grid.addEventListener('pointerdown', (e) => {
    stopDemo();
    dragging = true;
    grid.setPointerCapture(e.pointerId);
    setP(pFromPointer(e));
  });
  grid.addEventListener('pointermove', (e) => {
    if (dragging) setP(pFromPointer(e));
  });
  const end = () => {
    dragging = false;
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);

  range.addEventListener('input', () => {
    stopDemo();
    setP(Number(range.value));
  });

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      stopDemo();
      quantity = Number(chip.dataset.q) || quantity;
      chips.forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
      render(true);
    }),
  );

  render(false);

  if (!('IntersectionObserver' in window)) return;
  const target = p;
  let inView = false;
  function syncDemo() {
    if (motionOff()) {
      if (demoRaf) {
        cancelAnimationFrame(demoRaf);
        demoRaf = 0;
        demoDone = false;
        setP(target, false);
      }
      return;
    }
    if (!inView || demoDone) return;
    demoDone = true;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / DEMO_MS));
      const eased = 1 - (1 - t) ** 3;
      setP(target * eased, false);
      demoRaf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    setP(0, false);
    demoRaf = requestAnimationFrame(step);
  }
  const io = new IntersectionObserver((entries) => {
    inView = entries.some((en) => en.isIntersecting);
    syncDemo();
  }, { threshold: 0.5 });
  io.observe(root);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncDemo);
  new MutationObserver(syncDemo).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class', 'data-nd-motion'],
  });

}

export function initPercentExplorers() {
  document.querySelectorAll<PctRoot>('[data-pct-explorer]').forEach((root) => {
    if (root.__pct) return;
    root.__pct = true;
    setup(root);
  });
}
