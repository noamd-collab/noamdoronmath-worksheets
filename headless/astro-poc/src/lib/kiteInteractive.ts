/**
 * Kite interactive (JSXGraph) — controller + board for /kite-grade-9.
 *
 * The board opens only after the kite-construct film parks (its engine hook
 * reports done), or on demand under reduced motion / static mode. Replay
 * forwards to the engine's own toggle, so the film's state machine stays
 * engine-owned and ConceptLoop.astro / conceptLoops.ts stay untouched.
 *
 * Figure mirrors the film: symmetry axis vertical, A top / C bottom on the
 * axis, B and its mirror D across it. Teal sides from A, coral sides from C,
 * navy diagonals, yellow vertices, double teal ticks and triple coral ticks.
 * Units are cm with a 0.5 snap, so the default 8 × 6 kite shows S = 24.
 */

import { sitePrefersReducedMotion } from './motionPreference.js';

interface LoopState {
  t: number;
  playing: boolean;
  laps: number;
  done: boolean;
  static: boolean;
}
interface LoopHook {
  state: () => LoopState;
}
type LoopRoot = HTMLElement & { __loop?: LoopHook };

/** Minimal JSXGraph surface this file uses (the package ships full types). */
interface IxPoint {
  X(): number;
  Y(): number;
  moveTo(coords: [number, number] | number[], where?: number): unknown;
  on(event: string, handler: () => void): unknown;
}
interface IxBoard {
  create(kind: string, parents: unknown[], attrs?: Record<string, unknown>): any;
  on(event: string, handler: () => void): unknown;
  update(): unknown;
  resizeContainer(width: number, height: number): unknown;
}
type JxgModule = {
  JSXGraph: { initBoard(el: HTMLElement, attrs: Record<string, unknown>): IxBoard };
};

const NAVY = '#22305a';
const TEAL = '#2a7c7a';
const TEAL_DARK = '#1e605e';
const CORAL = '#e5735c';
const CORAL_DARK = '#a84434';
const YELLOW = '#e6a534';
const KITE_FILL = '#7c3aed1f';
const PAPER = '#fbfaf5';

/** Default kite: AC = 8, BD = 6 → S = 24 (the page's own worked example). */
const HOME = { A: [0, 4] as const, B: [3, 0] as const, C: [0, -4] as const };
const SNAP = 0.5;
const LIMITS = {
  A: { min: 1.5, max: 4.2 },
  C: { min: -4.2, max: -1.5 },
  B: { xMin: 0.5, xMax: 5, yMin: -3.5, yMax: 3.5 },
};

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
function fmt(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const LABEL = {
  display: 'internal',
  fontSize: 17,
  fontWeight: 800,
  strokeColor: NAVY,
  highlightStrokeColor: NAVY,
} as const;

function vertex(board: IxBoard, name: string, coords: unknown[], offset: [number, number]): IxPoint {
  return board.create('point', coords, {
    name,
    size: 5,
    face: 'o',
    fixed: false,
    fillColor: YELLOW,
    strokeColor: '#ffffff',
    strokeWidth: 2,
    showInfobox: false,
    withLabel: true,
    label: { ...LABEL, offset },
  }) as IxPoint;
}

/** Fixed helper point that follows a coordinate expression. */
function ghost(board: IxBoard, fx: () => number, fy: () => number): IxPoint {
  return board.create('point', [() => fx(), () => fy()], {
    visible: false,
    fixed: true,
    needsUpdate: true,
  }) as IxPoint;
}

function segment(
  board: IxBoard,
  p1: IxPoint,
  p2: IxPoint,
  color: string,
  width: number,
  dash = 0
): void {
  board.create('segment', [p1, p2], {
    strokeColor: color,
    strokeWidth: width,
    dash,
    fixed: true,
    highlight: false,
  });
}

/** n congruence tick marks across the segment's midpoint. */
function ticks(board: IxBoard, p1: IxPoint, p2: IxPoint, n: number, color: string): void {
  const HALF = 0.17; // tick half-length, board units
  const GAP = 0.09; // spacing between parallel ticks
  for (let i = 0; i < n; i += 1) {
    const shift = (i - (n - 1) / 2) * GAP;
    const mx = () => (p1.X() + p2.X()) / 2;
    const my = () => (p1.Y() + p2.Y()) / 2;
    const ux = () => {
      const dx = p2.X() - p1.X();
      const dy = p2.Y() - p1.Y();
      const len = Math.hypot(dx, dy) || 1;
      return dx / len;
    };
    const uy = () => {
      const dx = p2.X() - p1.X();
      const dy = p2.Y() - p1.Y();
      const len = Math.hypot(dx, dy) || 1;
      return dy / len;
    };
    // perpendicular unit vector
    const px = () => -uy();
    const py = () => ux();
    const a = ghost(
      board,
      () => mx() + ux() * shift + px() * HALF,
      () => my() + uy() * shift + py() * HALF
    );
    const b = ghost(
      board,
      () => mx() + ux() * shift - px() * HALF,
      () => my() + uy() * shift - py() * HALF
    );
    segment(board, a, b, color, 2);
  }
}

async function buildBoard(el: HTMLElement, readout: HTMLElement): Promise<{ reset: () => void }> {
  const mod = (await import('jsxgraph')) as unknown as JxgModule & { default?: JxgModule };
  const JXG = mod.JSXGraph ? mod : (mod.default as JxgModule);
  const board = JXG.JSXGraph.initBoard(el, {
    boundingbox: [-5.9, 5.1, 5.9, -5.1],
    keepaspectratio: true,
    axis: false,
    grid: false,
    showNavigation: false,
    showCopyright: true,
    pan: { enabled: false },
    zoom: { enabled: false },
    drag: { enabled: true },
  });

  const axisTop = ghost(board, () => 0, () => 6);
  const axisBottom = ghost(board, () => 0, () => -6);

  const A = vertex(board, 'A', [...HOME.A], [12, 8]);
  const C = vertex(board, 'C', [...HOME.C], [12, -18]);
  const B = vertex(board, 'B', [...HOME.B], [12, -6]);
  // D is B's mirror across the symmetry axis — computed, never draggable.
  const D = board.create('point', [() => -B.X(), () => B.Y()], {
    name: 'D',
    size: 5,
    face: 'o',
    fixed: true,
    fillColor: YELLOW,
    strokeColor: '#ffffff',
    strokeWidth: 2,
    showInfobox: false,
    withLabel: true,
    label: { ...LABEL, offset: [-26, -6] },
  }) as IxPoint;

  A.on('drag', () => A.moveTo([0, clamp(snap(A.Y()), LIMITS.A.min, LIMITS.A.max)]));
  C.on('drag', () => C.moveTo([0, clamp(snap(C.Y()), LIMITS.C.min, LIMITS.C.max)]));
  B.on('drag', () =>
    B.moveTo([
      clamp(snap(B.X()), LIMITS.B.xMin, LIMITS.B.xMax),
      clamp(snap(B.Y()), LIMITS.B.yMin, LIMITS.B.yMax),
    ])
  );

  // Kite body, then sides in the film's colors, then diagonals.
  board.create('polygon', [A, B, C, D], {
    fillColor: KITE_FILL,
    fillOpacity: 1,
    borders: { strokeColor: NAVY, strokeWidth: 2 },
    vertices: { visible: false, fixed: true },
    fixed: true,
    highlight: false,
  });
  segment(board, A, B, TEAL, 4);
  segment(board, A, D, TEAL, 4);
  segment(board, C, B, CORAL, 4);
  segment(board, C, D, CORAL, 4);
  segment(board, A, C, NAVY, 2);
  segment(board, B, D, NAVY, 2);

  // Right-angle marker where the diagonals cross: O = (0, B.Y()).
  const O = ghost(board, () => 0, () => B.Y());
  const sqA = ghost(board, () => 0.3, () => B.Y());
  const sqB = ghost(board, () => 0.3, () => B.Y() + 0.3);
  const sqC = ghost(board, () => 0, () => B.Y() + 0.3);
  segment(board, O, sqA, NAVY, 1.5);
  segment(board, sqA, sqB, NAVY, 1.5);
  segment(board, sqB, sqC, NAVY, 1.5);

  // Congruence ticks like the film: double teal on the A pair, triple coral on the C pair.
  ticks(board, A, B, 2, TEAL_DARK);
  ticks(board, A, D, 2, TEAL_DARK);
  ticks(board, C, B, 3, CORAL_DARK);
  ticks(board, C, D, 3, CORAL_DARK);

  // Symmetry axis, faint, slightly past the kite.
  board.create('segment', [axisTop, axisBottom], {
    strokeColor: NAVY,
    strokeWidth: 1,
    strokeOpacity: 0.25,
    dash: 2,
    fixed: true,
    highlight: false,
  });

  function render(): void {
    const ac = A.Y() - C.Y();
    const bd = 2 * B.X();
    const area = (ac * bd) / 2;
    readout.innerHTML =
      `<bdi dir="ltr" class="kite-ix-math">AC = ${fmt(ac)}</bdi> · ` +
      `<bdi dir="ltr" class="kite-ix-math">BD = ${fmt(bd)}</bdi> — ` +
      `<bdi dir="ltr" class="kite-ix-math">S = (${fmt(ac)} · ${fmt(bd)}) : 2 = ${fmt(area)}</bdi> סמ״ר`;
  }
  board.on('update', render);
  render();

  // deterministic hook for automated checks (mirrors the loop's own __loop)
  (el as HTMLElement & { __kiteIx?: unknown }).__kiteIx = {
    points: { A, B, C, D },
    screenOf(p: IxPoint): [number, number] {
      const scr = (p as unknown as { coords: { scrCoords: number[] } }).coords.scrCoords;
      return [scr[1], scr[2]];
    },
  };

  function reset(): void {
    A.moveTo([...HOME.A]);
    B.moveTo([...HOME.B]);
    C.moveTo([...HOME.C]);
    board.update();
  }

  const onResize = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w > 0 && h > 0) board.resizeContainer(w, h);
  };
  window.addEventListener('resize', onResize);

  return { reset };
}

type KiteIxHook = {
  points: { A: IxPoint; B: IxPoint; C: IxPoint; D: IxPoint };
  screenOf: (p: IxPoint) => [number, number];
};

/** One-shot attention cue: pulse + nudge on B, gone on first touch or end. */
function showCueOnce(boardEl: HTMLElement, cueEl: HTMLElement | null): void {
  if (!cueEl) return;
  if (sitePrefersReducedMotion()) return;
  const hook = (boardEl as HTMLElement & { __kiteIx?: KiteIxHook }).__kiteIx;
  if (!hook) return;
  const [bx, by] = hook.screenOf(hook.points.B);
  cueEl.style.transform = `translate(${boardEl.offsetLeft + bx}px, ${boardEl.offsetTop + by}px)`;
  cueEl.hidden = false;
  const stop = () => {
    cueEl.hidden = true;
  };
  boardEl.addEventListener('pointerdown', stop, { once: true });
  cueEl.querySelector('.kite-ix__cue-finger')?.addEventListener('animationend', stop, { once: true });
  setTimeout(stop, 3200);
}

function ready(fn: () => void): void {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

export function initKiteInteractive(): void {
  ready(() => {
    document
      .querySelectorAll<HTMLElement>('[data-interactive="kite-diagonals"]:not([data-ix-init])')
      .forEach((ix) => {
        ix.setAttribute('data-ix-init', '1');
        const demo = ix.closest<HTMLElement>('.exact-topic-demo');
        const loopRoot = demo?.querySelector<LoopRoot>('[data-loop="kite-construct"]') ?? null;
        const openWrap = demo?.querySelector<HTMLElement>('[data-ix-open-wrap]') ?? null;
        const openBtn = openWrap?.querySelector<HTMLButtonElement>('[data-ix-open]') ?? null;
        const boardEl = ix.querySelector<HTMLElement>('[data-ix-board]');
        const readout = ix.querySelector<HTMLElement>('[data-ix-readout]');
        const replayBtn = ix.querySelector<HTMLButtonElement>('[data-ix-replay]');
        const resetBtn = ix.querySelector<HTMLButtonElement>('[data-ix-reset]');
        const cueEl = ix.querySelector<HTMLElement>('[data-ix-cue]');
        if (!demo || !loopRoot || !boardEl || !readout || !replayBtn || !resetBtn) return;

        let board: { reset: () => void } | null = null;
        let open = false;
        let cueDone = false;

        const hook = (): LoopHook | null => loopRoot.__loop ?? null;
        const isStatic = (): boolean => hook()?.state().static ?? false;

        const openBoard = async (): Promise<void> => {
          if (open) return;
          open = true;
          loopRoot.style.display = 'none';
          ix.hidden = false;
          requestAnimationFrame(() => ix.classList.add('is-on'));
          if (!board) {
            board = await buildBoard(boardEl, readout);
          }
          if (!cueDone) {
            cueDone = true;
            // No cue when the engine is static (OS reduce or the site motion menu).
            if (!isStatic()) showCueOnce(boardEl, cueEl);
          }
          if (isStatic() && replayBtn) replayBtn.textContent = 'חזרה להדגמה';
        };

        const closeBoard = (replay: boolean): void => {
          if (!open) return;
          open = false;
          ix.classList.remove('is-on');
          ix.hidden = true;
          loopRoot.style.display = '';
          // A static film never parks, so the open button is the only way back.
          if (isStatic() && openWrap) openWrap.hidden = false;
          if (!replay) return;
          const h = hook();
          if (!h || h.state().static) return;
          if (h.state().done) {
            // Engine-owned replay: the toggle resets laps and replays from t=0.
            const toggle = loopRoot.querySelector<HTMLButtonElement>('[data-el="toggle"]');
            toggle?.click();
          }
        };

        // Auto handoff: the moment the film parks, the board takes the card.
        setInterval(() => {
          const h = hook();
          if (!open && h && h.state().done && !h.state().static) void openBoard();
        }, 400);

        // Reduced motion / static frame: no auto handoff, offer the board instead.
        const staticWatch = setInterval(() => {
          if (isStatic() && openWrap && openBtn && !open) {
            openWrap.hidden = false;
            clearInterval(staticWatch);
          }
        }, 400);
        openBtn?.addEventListener('click', () => {
          if (openWrap) openWrap.hidden = true;
          void openBoard();
        });

        replayBtn.addEventListener('click', () => closeBoard(true));
        resetBtn.addEventListener('click', () => board?.reset());
      });
  });
}
