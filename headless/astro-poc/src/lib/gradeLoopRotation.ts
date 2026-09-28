/**
 * Rotation policy for GradeLoopPlayer, free of DOM so it can be unit-tested.
 *
 * Order: the server-rendered default plays first (no flash on load); the rest
 * of the pool follows in a Fisher–Yates order drawn on every page load, and
 * every later cycle is reshuffled so that its first loop is never the one that
 * was just shown.
 *
 * Pace: a loop is shown for GRADE_LOOP_DWELL_MS. At GRADE_LOOP_HOLD_AT_MS the
 * host freezes it on its completed frame until the swap. The clock runs only
 * while the player is in view in a visible tab; a manual session pause
 * (k3-pause:<variant>), any other paused state, or a static frame (reduced
 * motion / nd-motion-off / noam-a11y-motion) freezes it, and a static frame
 * never rotates.
 *
 * Slowing the animation itself (×1.8) is not possible from here: the engine
 * (conceptLoops.ts, protected) has no playback-speed control. It needs a
 * future speed option in the engine.
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
  /** `null` swaps at the dwell time with no hold phase (approved fallback). */
  holdAtMs?: number | null;
  random?: () => number;
}

/** Calibration range 8–45 s per loop. */
export const GRADE_LOOP_DWELL_MS = 15_000;
export const GRADE_LOOP_HOLD_AT_MS = 12_000;

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
  const holdAtMs = options.holdAtMs === undefined ? GRADE_LOOP_HOLD_AT_MS : options.holdAtMs;
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
    if (!held && holdAtMs !== null && elapsed >= holdAtMs && elapsed < dwellMs) {
      held = true;
      host.hold(variant);
    }
    return elapsed >= dwellMs ? advance() : false;
  }

  return {
    tick,
    next: advance,
    current: () => order[index],
    elapsed: () => elapsed,
    held: () => held,
    progress: () => Math.min(1, elapsed / dwellMs),
  };
}
