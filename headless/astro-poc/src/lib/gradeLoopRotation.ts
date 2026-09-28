/**
 * Rotation policy for GradeLoopPlayer, free of DOM so it can be unit-tested.
 * The player advances only while in view, after the dwell time has elapsed
 * and the engine has parked the current loop (4 laps, state().done), so a
 * loop is never cut mid-lap. A manual session pause (k3-pause:<variant>),
 * any other paused state, a static frame (reduced motion / nd-motion-off)
 * or a hidden tab freezes the dwell clock.
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
}

export const GRADE_LOOP_DWELL_MS = 45_000;

export function createGradeLoopRotation(
  host: GradeLoopRotationHost,
  variants: readonly string[],
  initial: string,
  dwellMs: number = GRADE_LOOP_DWELL_MS
) {
  let index = Math.max(0, variants.indexOf(initial));
  let elapsed = 0;
  const visited = new Set<string>([variants[index]]);

  function advance(): boolean {
    if (variants.length < 2) return false;
    index = (index + 1) % variants.length;
    const variant = variants[index];
    const firstVisit = !visited.has(variant);
    visited.add(variant);
    elapsed = 0;
    host.mount(variant, firstVisit);
    return true;
  }

  function tick(dtMs: number): boolean {
    const variant = variants[index];
    const state = host.state(variant);
    if (!state || state.static || host.pageHidden() || !host.inView()) return false;
    if (host.manuallyPaused(variant) || (!state.playing && !state.done)) return false;
    elapsed += dtMs;
    return elapsed >= dwellMs && state.done ? advance() : false;
  }

  return {
    tick,
    next: advance,
    current: () => variants[index],
    elapsed: () => elapsed,
  };
}
