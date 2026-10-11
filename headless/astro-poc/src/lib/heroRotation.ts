/**
 * Home-hero rotation. ConceptLoop variants, plus the angle-sum
 * vertex-descent film (not an engine drawing).
 *
 * Every entry has a topic page that is already served. Grades א׳–ו׳ have
 * working loops (tenframes, sticks, bars, numberline, balance, pattern, …)
 * but no topic page, so they stay off this list until there is a real
 * destination. Panel colors follow the FINAL design: ז׳/ח׳/ט׳ mint, else peach.
 */
export interface HeroRotationEntry {
  variant: string;
  /** Hebrew grade with geresh, as in the design chip (ז׳). */
  grade: string;
  gradeNum: number;
  /** Short topic name. The chip is `כיתה ${grade} · ${label}`. */
  label: string;
  /** Existing topic page for this loop. */
  href: string;
  panel: '#e3f1ec' | '#f8ebe0';
}

export function heroPanel(gradeNum: number): HeroRotationEntry['panel'] {
  return gradeNum >= 7 ? '#e3f1ec' : '#f8ebe0';
}

export function heroChip(entry: Pick<HeroRotationEntry, 'grade' | 'label'>): string {
  return `כיתה ${entry.grade} · ${entry.label}`;
}

function entry(
  variant: string,
  grade: string,
  gradeNum: number,
  label: string,
  href: string,
): HeroRotationEntry {
  return { variant, grade, gradeNum, label, href, panel: heroPanel(gradeNum) };
}

/** Triangle stays first: it is the no-JS / first-paint loop. */
export const HERO_ROTATION: readonly HeroRotationEntry[] = [
  entry('triangle', 'ז׳', 7, 'שטח משולש', '/triangle-area-grade-7'),
  entry('angle-sum', 'ז׳', 7, 'סכום זוויות במשולש', '/triangle-quadrilateral-angle-sum-grade-7'),
  entry('para-rect', 'ז׳', 7, 'שטח מקבילית', '/area-parallelogram-trapezoid-composite-grade-7'),
  entry('pythagoras', 'ח׳', 8, 'משפט פיתגורס', '/pythagorean-theorem-grade-8'),
  entry('exterior', 'ח׳', 8, 'זווית חיצונית למשולש', '/exterior-angle-triangle-grade-8'),
  entry('slope', 'ח׳', 8, 'שיפוע', '/linear-function-grade-8'),
  entry('area-model', 'ט׳', 9, 'כפל ביטויים ופתיחת סוגריים', '/distributive-law-grade-9'),
  entry('diff-sq', 'ט׳', 9, 'הפרש ריבועים', '/difference-of-squares-grade-9'),
  entry('transform', 'ט׳', 9, 'שיקוף, סיבוב והזזה', '/congruent-polygons-transformations-grade-9'),
];

export const HERO_DEFAULT = HERO_ROTATION[0];

const variants = new Set(HERO_ROTATION.map((item) => item.variant));

export function heroRotationVariant(value: string | undefined): string | undefined {
  if (!value || !variants.has(value)) return undefined;
  return value;
}

/**
 * One full play of each homepage film, in seconds.
 * Concept-loop values are SPECS.duration (one lap, not the 4-lap park).
 * angle-sum is the vertex-descent film's DURATION, not an engine lap.
 * The grade hub keeps its own clock (gradeLoopDwellMs, ×1.8); this map is
 * only the homepage hero.
 */
export const HERO_PLAY_S: Readonly<Record<string, number>> = {
  triangle: 10,
  'angle-sum': 20,
  'para-rect': 10,
  pythagoras: 10,
  exterior: 10,
  slope: 10,
  'area-model': 11,
  'diff-sq': 22,
  transform: 11,
};

/** Short films stay up long enough to read. Nothing on the homepage stays for minutes. */
export const HERO_DWELL_MIN_MS = 8_000;
export const HERO_DWELL_CAP_MS = 25_000;
/** Used when a variant has no known play length. Still inside the 8–25 s window. */
export const HERO_DWELL_FALLBACK_MS = 10_000;

/**
 * How long the homepage shows one variant: one full play, at least ~8 s,
 * and never more than ~25 s. A 22 s film (diff-sq) plays once. This is not
 * the grade-hub dwell (15 s, or ~39.9 s for the slowed diff-sq film).
 */
export function heroDwellMs(playS: number | undefined): number {
  if (typeof playS !== 'number' || !Number.isFinite(playS) || playS <= 0) return HERO_DWELL_FALLBACK_MS;
  return Math.round(Math.min(HERO_DWELL_CAP_MS, Math.max(HERO_DWELL_MIN_MS, playS * 1000)));
}

export interface HeroRotationHost {
  /** False only after an observer has reported the hero off-screen. */
  inView(): boolean;
  pageHidden(): boolean;
  /** True while a swap is already in flight. The clock waits, then continues. */
  busy(): boolean;
  /**
   * Show `variant`. Call `fail` if it could not be shown so the clock
   * returns to the film that is actually on screen.
   */
  mount(variant: string, fail: () => void): void;
}

/**
 * Homepage rotation. The clock does not wait for a film "ended" event,
 * a playing flag, or an empty session pause key: a parked film, a stored
 * k3-pause, or a loop that never finishes must not freeze the hero.
 * Time does not accumulate while the tab is hidden, the hero is off-screen,
 * or a swap is in flight; it resumes from the same elapsed time.
 */
export function createHeroRotation(
  host: HeroRotationHost,
  variants: readonly string[],
  initial: string,
  dwellFor: (variant: string) => number = (variant) => heroDwellMs(HERO_PLAY_S[variant]),
) {
  const list = variants.filter((variant) => variant);
  const first = list.includes(initial) ? initial : list[0];
  let index = Math.max(0, list.indexOf(first ?? ''));
  let elapsed = 0;

  function dwellOf(variant: string | undefined): number {
    const ms = variant ? dwellFor(variant) : HERO_DWELL_FALLBACK_MS;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return HERO_DWELL_FALLBACK_MS;
    return ms;
  }

  function tick(dtMs: number): boolean {
    if (list.length < 2) return false;
    if (host.pageHidden() || !host.inView() || host.busy()) return false;
    elapsed += Math.min(1_000, Math.max(0, dtMs));
    const current = list[index];
    if (elapsed < dwellOf(current)) return false;
    const from = index;
    const next = list[(index + 1) % list.length];
    index = (index + 1) % list.length;
    elapsed = 0;
    let failed = false;
    host.mount(next, () => {
      if (failed) return;
      failed = true;
      index = from;
      elapsed = 0;
    });
    return !failed;
  }

  /** The shuffle button showed `variant`. Start its dwell from zero. */
  function jump(variant: string) {
    const at = list.indexOf(variant);
    if (at < 0) return;
    index = at;
    elapsed = 0;
  }

  return {
    tick,
    jump,
    current: () => list[index],
    elapsed: () => elapsed,
    dwell: () => dwellOf(list[index]),
  };
}
