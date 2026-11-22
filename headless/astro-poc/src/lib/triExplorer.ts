import { sitePrefersReducedMotion } from './motionPreference.js';
/**
 * KIMI-LOOPS-K3 — engine for the triangle-area explorer (topic page).
 *
 * The apex slides along a line parallel to the base; base and height stay
 * fixed, so S = a·h/2 stays 12 — the learner feels the invariant.
 *
 * Input, three equal routes: pointer drag on the SVG handle
 * (setPointerCapture, touch-action: none), the three 44px buttons under the
 * drawing, and the keyboard — arrow keys, Home and End on the focused handle,
 * or the synced <input type="range">. A short auto demo (≤3 s, once per
 * session, in-view only) shows the glide first.
 * Reduced motion / html.noam-a11y-motion: no demo, drag keeps working.
 */
import { EASE, lerp, ph } from './conceptLoops';

type TriRoot = HTMLElement & { __tri?: { setApex: (u: number) => void; state: () => number } };

const U = 40; // px per unit
const BASE_X0 = 150;
const TOP_Y = 92; // apex rail
const BASE_Y = 252;
const U_MIN = -1.5;
const U_MAX = 8;
const U_HOME = 3;

const q = (root: HTMLElement, name: string) => root.querySelector(`[data-el="${name}"]`);

function motionOff(): boolean {
  return (
    sitePrefersReducedMotion() ||
    document.documentElement.classList.contains('noam-a11y-motion')
  );
}

function setup(root: TriRoot) {
  const poly = q(root, 'poly') as unknown as SVGPolygonElement;
  const polyFill = q(root, 'poly-fill') as unknown as SVGPolygonElement;
  const height = q(root, 'height') as unknown as SVGLineElement;
  const ra = q(root, 'ra') as unknown as SVGPathElement;
  const lblH = q(root, 'lbl-h') as unknown as SVGTextElement;
  const hit = q(root, 'hit') as unknown as SVGCircleElement;
  const handle = q(root, 'handle') as unknown as SVGCircleElement;
  const range = q(root, 'range') as HTMLInputElement;
  const hint = q(root, 'hint') as HTMLElement;
  const live = q(root, 'live') as HTMLElement;
  const btnLeft = q(root, 'left') as HTMLButtonElement | null;
  const btnRight = q(root, 'right') as HTMLButtonElement | null;
  const btnHome = q(root, 'home') as HTMLButtonElement | null;
  if (!poly || !hit || !range) return;

  let u = U_HOME;
  let demoRaf = 0;
  let demoDone = false;

  function axOf(uVal: number) {
    return BASE_X0 + uVal * U;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;

  function setApex(uVal: number, announce = false) {
    u = Math.min(U_MAX, Math.max(U_MIN, uVal));
    const ax = r2(axOf(u));
    const pts = `150,${BASE_Y} 390,${BASE_Y} ${ax},${TOP_Y}`;
    poly.setAttribute('points', pts);
    polyFill.setAttribute('points', pts);
    height.setAttribute('x1', String(ax));
    height.setAttribute('x2', String(ax));
    ra.setAttribute('d', `M${ax} ${BASE_Y - 12} L${ax + 12} ${BASE_Y - 12} L${ax + 12} ${BASE_Y}`);
    lblH.setAttribute('x', String(ax + 18));
    hit.setAttribute('cx', String(ax));
    handle.setAttribute('cx', String(ax));
    if (range.value !== String(u)) range.value = String(r2(u));
    range.setAttribute('aria-valuetext', `קודקוד במיקום ${u.toFixed(1)}, שטח המשולש 12`);
    hit.setAttribute('aria-valuenow', String(r2(u)));
    hit.setAttribute('aria-valuetext', `קודקוד במיקום ${u.toFixed(1)}, שטח המשולש 12`);
    if (announce && live) {
      live.textContent = '';
      // re-announce on consecutive identical positions too
      // A timer, not a frame: Stop Animations holds requestAnimationFrame, and a
      // held callback would silence the screen reader exactly for the readers who
      // turned motion off.
      window.setTimeout(() => {
        live.textContent = `הקודקוד זז, ושטח המשולש נשאר 12`;
      }, 60);
    }
  }

  function showHint() {
    hint?.classList.add('is-on');
  }

  /* ——— the ≤3 s auto demo: glide right, glide left, settle home ——— */
  function runDemo() {
    if (demoDone) return;
    demoDone = true;
    try {
      sessionStorage.setItem('k3-tri-demo', '1');
    } catch {
      /* private mode — demo simply runs again next load */
    }
    const segs: Array<[number, number, number]> = [
      [U_HOME, 5.6, 0.9],
      [5.6, 1.1, 1.0],
      [1.1, U_HOME, 0.85],
    ];
    const t0 = performance.now();
    const total = segs.reduce((s, seg) => s + seg[2], 0);
    const step = (now: number) => {
      const el = (now - t0) / 1000;
      if (el >= total) {
        setApex(U_HOME);
        showHint();
        demoRaf = 0;
        return;
      }
      let acc = 0;
      for (const [from, to, dur] of segs) {
        if (el < acc + dur) {
          setApex(lerp(from, to, EASE(ph(el, acc, acc + dur))));
          break;
        }
        acc += dur;
      }
      demoRaf = requestAnimationFrame(step);
    };
    demoRaf = requestAnimationFrame(step);
  }

  /* ——— pointer drag ——— */
  let dragging = false;
  hit.addEventListener('pointerdown', (ev) => {
    dragging = true;
    demoDone = true;
    hit.setPointerCapture(ev.pointerId);
    handle.classList.add('is-held');
    if (demoRaf) {
      cancelAnimationFrame(demoRaf);
      demoRaf = 0;
      demoDone = true;
      showHint();
    }
    ev.preventDefault();
  });
  hit.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const svg = hit.ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    const svgX = ((ev.clientX - rect.left) / rect.width) * 560;
    setApex((svgX - BASE_X0) / U);
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('is-held');
    setApex(u, true);
  };
  hit.addEventListener('pointerup', endDrag);
  hit.addEventListener('pointercancel', endDrag);

  /* ——— keyboard / SR: the synced range input ——— */
  range.addEventListener('input', () => {
    demoDone = true;
    if (demoRaf) cancelAnimationFrame(demoRaf);
    demoRaf = 0;
    setApex(parseFloat(range.value));
  });
  range.addEventListener('change', () => setApex(u, true));

  /* ——— buttons and arrow keys: the same state, without a pointer ——— */
  function stopDemo() {
    demoDone = true;
    if (demoRaf) cancelAnimationFrame(demoRaf);
    demoRaf = 0;
    showHint();
  }
  function nudge(delta: number) {
    stopDemo();
    setApex(u + delta, true);
  }
  btnLeft?.addEventListener('click', () => nudge(-0.5));
  btnRight?.addEventListener('click', () => nudge(0.5));
  btnHome?.addEventListener('click', () => {
    stopDemo();
    setApex(U_HOME, true);
  });
  hit.addEventListener('keydown', (ev: Event) => {
    const e = ev as KeyboardEvent;
    let next = u;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = u - 0.5;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = u + 0.5;
    else if (e.key === 'PageDown') next = u - 2;
    else if (e.key === 'PageUp') next = u + 2;
    else if (e.key === 'Home') next = U_MIN;
    else if (e.key === 'End') next = U_MAX;
    else return;
    e.preventDefault();
    stopDemo();
    setApex(next, true);
  });

  /* ——— demo trigger: once per session, in view, motion allowed ——— */
  let seen = false;
  try {
    seen = sessionStorage.getItem('k3-tri-demo') === '1';
  } catch {
    seen = false;
  }
  demoDone = seen;
  let inView = !('IntersectionObserver' in window);
  function syncDemo() {
    if (motionOff()) {
      if (demoRaf) {
        cancelAnimationFrame(demoRaf);
        demoRaf = 0;
        demoDone = false;
      }
      showHint();
    } else if (inView && !demoDone) runDemo();
  }
  if (seen) showHint();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      syncDemo();
    }, { threshold: 0.5 });
    io.observe(root);
  }
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncDemo);
  new MutationObserver(syncDemo).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class', 'data-nd-motion'],
  });
  syncDemo();

  setApex(u);
  root.__tri = { setApex, state: () => u };
}

export function initTriExplorers() {
  const boot = () =>
    document.querySelectorAll<TriRoot>('[data-tri-explorer]').forEach((root) => {
      if (!root.__tri) setup(root);
    });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
