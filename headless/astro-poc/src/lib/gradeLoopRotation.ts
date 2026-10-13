/**
 * Rotation policy for GradeLoopPlayer, free of DOM so it can be unit-tested.
 *
 * Order: the server-rendered default plays first (no flash on load); the rest
 * of the pool follows in a Fisher–Yates order drawn on every page load, and
 * every later cycle is reshuffled so that its first loop is never the one that
 * was just shown.
 *
 * Pace: a loop is shown for GRADE_LOOP_DWELL_MS, then the player swaps.
 * When the slowed animation reaches the completed frame, the grade player
 * rests there briefly and restarts the same loop from zero, so the answer
 * does not stay frozen until the swap. hold() is still a one-shot freeze
 * (seek to the completed frame, then pause) for a host that wants it.
 * The clock runs only while the player is in view in a visible tab; a manual
 * session pause (k3-pause:<variant>), any other paused state, or a static
 * frame (reduced motion / nd-motion-off / noam-a11y-motion) freezes it, and
 * a static frame never rotates.
 *
 * Slowdown (×1.8): the engine (conceptLoops.ts, protected) has no speed
 * option, only __loop.seek(t). createGradeLoopSlowClock maps player time to
 * engine time, t_engine = t_real / GRADE_LOOP_SLOWDOWN, and the host seeks the
 * engine to it every frame.
 */
export interface GradeLoopState {
  playing: boolean;
  done: boolean;
  static: boolean;
}

export interface GradeLoopRotationHost {
  inView(): boolean;
  pageHidden(): boolean;
  state(variant: string): GradeLoopState | undefined;
  manuallyPaused(variant: string): boolean;
  /** Swap the player to `variant`; `firstVisit` is true only for its first mount. */
  mount(variant: string, firstVisit: boolean): void;
  /** Freeze `variant` on its completed frame until the swap. */
  hold(variant: string): void;
}

export interface GradeLoopRotationOptions {
  dwellMs?: number;
  /** Per-variant dwell; defaults to dwellMs for every variant. */
  dwellFor?: (variant: string) => number;
  random?: () => number;
}

/** Calibration range 8–45 s per loop. */
export const GRADE_LOOP_DWELL_MS = 15_000;
/** Real seconds per engine second. */
export const GRADE_LOOP_SLOWDOWN = 1.8;
/**
 * End point when a loop's completed-frame time is unknown: every engine lap
 * is 10–11 s, so ×1.8 never reaches it within the dwell and the loop swaps at
 * 15 s with no hold phase (the approved v2 fallback).
 */
export const GRADE_LOOP_FALLBACK_END_S = 10;
/** Rest on the completed frame before the swap, for a film longer than the dwell. */
export const GRADE_LOOP_LONG_REST_MS = 3_000;

/**
 * Dwell for one loop: the standard 15 s, or, for a long film (L14 diff-sq,
 * 22 s engine lap) whose slowed completed frame lands after 15 s, long
 * enough to reach that frame and rest on it before the swap.
 */
export function gradeLoopDwellMs(holdS: number | undefined, slowdown = GRADE_LOOP_SLOWDOWN): number {
  if (typeof holdS !== 'number') return GRADE_LOOP_DWELL_MS;
  const slowedMs = holdS * slowdown * 1000;
  if (slowedMs < GRADE_LOOP_DWELL_MS) return GRADE_LOOP_DWELL_MS;
  return Math.round(slowedMs) + GRADE_LOOP_LONG_REST_MS;
}

/** Same cap as the engine's own frame step, so a stalled frame never jumps. */
const MAX_FRAME_MS = 50;

export interface GradeLoopSlowClockHost {
  /** The engine is playing the current loop (in view, not paused, not static, not held). */
  running(): boolean;
  seek(t: number): void;
  /** The slowed loop reached its end point. */
  ended(): void;
}

export function createGradeLoopSlowClock(host: GradeLoopSlowClockHost, slowdown = GRADE_LOOP_SLOWDOWN) {
  let realMs = 0;
  let endS = GRADE_LOOP_FALLBACK_END_S;
  let ended = false;
  const engineTime = () => Math.min(realMs / 1000 / slowdown, endS);

  return {
    /** Start a (re)mounted loop from zero; `end` is its completed-frame time. */
    reset(end: number = GRADE_LOOP_FALLBACK_END_S) {
      realMs = 0;
      endS = end;
      ended = false;
    },
    frame(dtMs: number) {
      if (ended || !host.running()) return;
      realMs += Math.min(MAX_FRAME_MS, Math.max(0, dtMs));
      const t = engineTime();
      host.seek(t);
      if (t >= endS) {
        ended = true;
        host.ended();
      }
    },
    engineTime,
    ended: () => ended,
  };
}

export function shuffleLoops<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createGradeLoopRotation(
  host: GradeLoopRotationHost,
  variants: readonly string[],
  initial: string,
  options: GradeLoopRotationOptions = {}
) {
  const dwellMs = options.dwellMs ?? GRADE_LOOP_DWELL_MS;
  const dwellOf = (variant: string) => options.dwellFor?.(variant) ?? dwellMs;
  const random = options.random ?? Math.random;
  const first = variants.includes(initial) ? initial : variants[0];

  let order = [first, ...shuffleLoops(variants.filter((v) => v !== first), random)];
  let index = 0;
  let elapsed = 0;
  let held = false;
  const visited = new Set<string>([first]);

  function nextCycle(last: string): string[] {
    const cycle = shuffleLoops(variants, random);
    if (cycle.length > 1 && cycle[0] === last) {
      const j = 1 + Math.floor(random() * (cycle.length - 1));
      [cycle[0], cycle[j]] = [cycle[j], cycle[0]];
    }
    return cycle;
  }

  function advance(): boolean {
    if (variants.length < 2) return false;
    index += 1;
    if (index >= order.length) {
      order = nextCycle(order[order.length - 1]);
      index = 0;
    }
    const variant = order[index];
    const firstVisit = !visited.has(variant);
    visited.add(variant);
    elapsed = 0;
    held = false;
    host.mount(variant, firstVisit);
    return true;
  }

  function tick(dtMs: number): boolean {
    if (variants.length < 2) return false;
    const variant = order[index];
    const state = host.state(variant);
    if (!state || state.static || host.pageHidden() || !host.inView()) return false;
    if (host.manuallyPaused(variant)) return false;
    // A held loop is paused on purpose; any other pause stops the clock.
    if (!held && !state.playing && !state.done) return false;
    elapsed += dtMs;
    return elapsed >= dwellOf(variant) ? advance() : false;
  }

  /** Freeze the current loop on its completed frame until the swap, once. */
  function hold(): void {
    if (held || variants.length < 2) return;
    held = true;
    host.hold(order[index]);
  }

  return {
    tick,
    hold,
    next: advance,
    current: () => order[index],
    elapsed: () => elapsed,
    held: () => held,
    progress: () => Math.min(1, elapsed / dwellOf(order[index])),
  };
}
