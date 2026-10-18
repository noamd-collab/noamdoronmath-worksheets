/**
 * Home-hero rotation. ConceptLoop variants, plus the angle-sum
 * vertex-descent film (not an engine drawing).
 *
 * Every entry has a topic page that is already served, and the film matches
 * that page's topic and grade. Pairings the animation audit marked
 * wrong-topic or wrong-grade stay off this list. Grades א׳–ו׳ are included
 * only where a real topic page matches the film.
 * Panel colors follow the FINAL design: ז׳/ח׳/ט׳ mint, else peach.
 *
 * Play order is not this array. Triangle stays first in the array because it
 * is the server-rendered first paint. createHeroRotation shuffles the rest.
 * Every film here plays in full: nothing longer than the 25 s homepage cap.
 *
 * Held out until PR 169 mounts the matching film on the destination page
 * (audit comment 6251087305, WRONG-TOPIC / WRONG-GRADE / GENERIC):
 * birds-sub, neighbors, place-123, odd-pair, coins-12, two-diag.
 * kite-construct stays out: the film is 100 s, so a 25 s cut would hide
 * the formula and the construction.
 */
import { shuffleLoops } from './gradeLoopRotation';

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
  entry('tenframes', 'א׳', 1, 'מסגרת עשר', '/making-20-via-10-grade-1'),
  entry('add-within', 'א׳', 1, 'חיבור בתחום העשר', '/addition-to-10-grade-1'),
  entry('clock-3', 'א׳', 1, 'קריאת שעון · שעה שלמה', '/reading-clock-grade-1'),
  entry('polygon', 'א׳', 1, 'צורות ומצולעים', '/polygons-grade-1'),
  entry('balance', 'א׳', 1, 'משוואות ומאזניים', '/equality-missing-number-grade-1'),
  entry('sticks', 'ב׳', 2, 'עשרות ויחידות', '/tens-and-ones-grade-2'),
  entry('baseten', 'ב׳', 2, 'חיבור רב־ספרתי', '/addition-two-digit-carrying-grade-2'),
  entry('numberline', 'ב׳', 2, 'ישר המספרים · עיגול', '/order-compare-numberline-grade-2'),
  entry('clock-span', 'ב׳', 2, 'חישוב משך זמן', '/clock-duration-grade-2'),
  entry('share-12', 'ב׳', 2, 'חילוק לקבוצות שוות', '/multiplication-division-family-grade-2'),
  entry('array', 'ב׳', 2, 'כפל במערך', '/multiplication-equal-groups-grade-2'),
  entry('bars', 'ג׳', 3, 'בעיות מילוליות · מודל פסים', '/word-problems-grade-3'),
  entry('ruler', 'ג׳', 3, 'מדידה ויחידות', '/measuring-length-cm-m-grade-3'),
  entry('fraction', 'ד׳', 4, 'שבר כחלק משלם', '/fraction-names-equivalent-grade-4'),
  entry('equiv-half', 'ד׳', 4, 'שברים שווים על הישר', '/equivalent-fractions-grade-4'),
  entry('order-ops', 'ד׳', 4, 'סדר פעולות חשבון', '/order-of-operations-grade-4'),
  entry('prime-rect', 'ד׳', 4, 'מספרים ראשוניים', '/prime-composite-grade-4'),
  entry('cookies', 'ד׳', 4, 'חילוק עם שארית', '/long-division-remainder-grade-4'),
  entry('distributive-area-model-grade-4', 'ד׳', 4, 'חוק הפילוג', '/distributive-area-model-grade-4'),
  entry('grade-4-summary', 'ד׳', 4, 'סיכום אינטגרטיבי', '/grade-4-summary'),
  entry('tenth-cell', 'ה׳', 5, 'עשיריות ומאיות', '/decimal-place-value-grade-5'),
  entry('pattern', 'ו׳', 6, 'חוקיות', '/patterns-multistep-grade-6'),
  entry('frac-product', 'ו׳', 6, 'כפל שברים', '/fraction-times-fraction-grade-6'),
  entry('ratio-beads', 'ו׳', 6, 'יחס', '/ratio-grade-6'),
  entry('map-scale', 'ו׳', 6, 'קנה מידה', '/scale-maps-grade-6'),
  entry('fraction-division-meaning-grade-6', 'ו׳', 6, 'חילוק שברים', '/fraction-division-meaning-grade-6'),
  entry('measurement-geometry-synthesis-grade-6', 'ו׳', 6, 'מדידות וגאומטריה', '/measurement-geometry-synthesis-grade-6'),
  entry('angle-sum', 'ז׳', 7, 'סכום זוויות במשולש', '/triangle-quadrilateral-angle-sum-grade-7'),
  entry('para-rect', 'ז׳', 7, 'שטח מקבילית', '/area-parallelogram-trapezoid-composite-grade-7'),
  entry('trap-area', 'ז׳', 7, 'שטח טרפז', '/area-parallelogram-trapezoid-composite-grade-7'),
  entry('l-split', 'ז׳', 7, 'שטח צורה מורכבת', '/area-parallelogram-trapezoid-composite-grade-7'),
  entry('peri-rect', 'ז׳', 7, 'היקף מלבן', '/area-rectangle-perimeter-grade-7'),
  entry('rect-count', 'ז׳', 7, 'שטח והיקף מלבן', '/area-rectangle-perimeter-grade-7'),
  entry('angle-kinds', 'ז׳', 7, 'סוגי זוויות', '/angles-introduction-measurement-grade-7'),
  entry('sup-angles', 'ז׳', 7, 'זוויות צמודות', '/adjacent-vertical-angles-grade-7'),
  entry('coord-walk', 'ז׳', 7, 'נקודה במערכת הצירים', '/coordinate-plane-quadrants-grade-7'),
  entry('cube-8', 'ז׳', 7, 'חזקה שלישית', '/solids-box-cube-prism-grade-7'),
  entry('box-vol', 'ז׳', 7, 'נפח תיבה', '/solids-box-cube-prism-grade-7'),
  entry('signed-ops', 'ז׳', 7, 'סדר פעולות במספרים מכוונים', '/order-of-operations-signed-numbers-grade-7'),
  entry('pythagoras', 'ח׳', 8, 'משפט פיתגורס', '/pythagorean-theorem-grade-8'),
  entry('exterior', 'ח׳', 8, 'זווית חיצונית למשולש', '/exterior-angle-triangle-grade-8'),
  entry('slope', 'ח׳', 8, 'שיפוע', '/linear-function-grade-8'),
  entry('mean-cols', 'ח׳', 8, 'ממוצע', '/statistics-grade-8'),
  entry('circ-unroll', 'ח׳', 8, 'היקף מעגל', '/circle-area-circumference-grade-8'),
  entry('corr-angles', 'ח׳', 8, 'זוויות בין מקבילים', '/parallel-lines-angles-grade-8'),
  entry('sas-snap', 'ח׳', 8, 'חפיפה · צלע־זווית־צלע', '/triangle-congruence-grade-8'),
  entry('similar', 'ח׳', 8, 'דמיון משולשים', '/similar-triangles-grade-8'),
  entry('cyl-stack', 'ח׳', 8, 'נפח גליל', '/cylinder-volume-grade-8'),
  entry('area-model', 'ט׳', 9, 'כפל ביטויים ופתיחת סוגריים', '/distributive-law-grade-9'),
  entry('diff-sq', 'ט׳', 9, 'הפרש ריבועים', '/difference-of-squares-grade-9'),
  entry('transform', 'ט׳', 9, 'שיקוף, סיבוב והזזה', '/congruent-polygons-transformations-grade-9'),
  entry('quad-tree', 'ט׳', 9, 'משפחת המרובעים', '/square-grade-9'),
  entry('area-x4', 'ט׳', 9, 'הגדלה ושטח', '/rectangle-square-area-grade-9'),
  entry('two-coins', 'ט׳', 9, 'הסתברות · שני מטבעות', '/probability-grade-9'),
  entry('parab', 'ט׳', 9, 'קודקוד הפרבולה', '/quadratic-function-grade-9'),
  entry('half-eq', 'ט׳', 9, 'משולש 30°–60°–90°', '/triangle-30-60-90-grade-9'),
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
  tenframes: 10,
  'add-within': 10,
  'clock-3': 10,
  polygon: 10,
  balance: 11,
  sticks: 10,
  baseten: 10,
  numberline: 10,
  'clock-span': 10,
  'share-12': 10,
  array: 10,
  bars: 11,
  ruler: 10,
  fraction: 10,
  'equiv-half': 10,
  'order-ops': 10,
  'prime-rect': 10,
  cookies: 10,
  'distributive-area-model-grade-4': 13,
  'grade-4-summary': 15,
  'tenth-cell': 10,
  pattern: 11,
  'frac-product': 10,
  'ratio-beads': 10,
  'map-scale': 10,
  'fraction-division-meaning-grade-6': 15,
  'measurement-geometry-synthesis-grade-6': 16,
  'angle-sum': 20,
  'para-rect': 10,
  'trap-area': 10,
  'l-split': 10,
  'peri-rect': 10,
  'rect-count': 10,
  'angle-kinds': 10,
  'sup-angles': 10,
  'coord-walk': 10,
  'cube-8': 10,
  'box-vol': 10,
  'signed-ops': 10,
  pythagoras: 10,
  exterior: 10,
  slope: 10,
  'mean-cols': 10,
  'circ-unroll': 10,
  'corr-angles': 10,
  'sas-snap': 10,
  similar: 10,
  'cyl-stack': 10,
  'area-model': 11,
  'diff-sq': 22,
  transform: 11,
  'quad-tree': 10,
  'area-x4': 10,
  'two-coins': 10,
  parab: 10,
  'half-eq': 10,
};

/** Short films stay up long enough to read. Nothing on the homepage stays for minutes. */
export const HERO_DWELL_MIN_MS = 8_000;
export const HERO_DWELL_CAP_MS = 25_000;
/** Used when a variant has no known play length. Still inside the 8–25 s window. */
export const HERO_DWELL_FALLBACK_MS = 10_000;

/**
 * How long the homepage shows one variant: one full play, at least ~8 s,
 * and never more than ~25 s. The pool only includes films inside that window,
 * so each one finishes. The cap is a guard, not a cut used by a pool film.
 * This is not the grade-hub dwell.
 */
export function heroDwellMs(playS: number | undefined): number {
  if (typeof playS !== 'number' || !Number.isFinite(playS) || playS <= 0) return HERO_DWELL_FALLBACK_MS;
  return Math.round(Math.min(HERO_DWELL_CAP_MS, Math.max(HERO_DWELL_MIN_MS, playS * 1000)));
}

/** sessionStorage key: the film a returning visitor should open on, after first paint. */
export const HERO_RETURN_KEY = 'nd_hero_return';

/**
 * A film for the next visit, never the one on screen now.
 * The homepage still paints the server default first; this is only a later swap.
 */
export function heroReturnVariant(
  pool: readonly string[],
  showing: string,
  random: () => number = Math.random,
): string | undefined {
  const choices = pool.filter((variant) => variant && variant !== showing);
  if (!choices.length) return undefined;
  const index = Math.floor(random() * choices.length);
  return choices[Math.min(choices.length - 1, Math.max(0, index))];
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

export interface HeroRotationOptions {
  /** Injectable so the shuffle can be unit-tested. Defaults to Math.random. */
  random?: () => number;
}

/**
 * Homepage rotation. The server-rendered film plays first. The rest of that
 * visit is a Fisher–Yates shuffle, and every later cycle is reshuffled so
 * its first film is never the one just shown.
 *
 * The clock does not wait for a film "ended" event, a playing flag, or an
 * empty session pause key: a parked film, a stored k3-pause, or a loop that
 * never finishes must not freeze the hero. Time does not accumulate while
 * the tab is hidden, the hero is off-screen, or a swap is in flight; it
 * resumes from the same elapsed time.
 */
export function createHeroRotation(
  host: HeroRotationHost,
  variants: readonly string[],
  initial: string,
  dwellFor: (variant: string) => number = (variant) => heroDwellMs(HERO_PLAY_S[variant]),
  options: HeroRotationOptions = {},
) {
  const random = options.random ?? Math.random;
  const list = variants.filter((variant) => variant);
  const first = list.includes(initial) ? initial : list[0];
  let order = [first, ...shuffleLoops(list.filter((variant) => variant !== first), random)].filter(
    (variant): variant is string => Boolean(variant),
  );
  let index = 0;
  let elapsed = 0;

  function dwellOf(variant: string | undefined): number {
    const ms = variant ? dwellFor(variant) : HERO_DWELL_FALLBACK_MS;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return HERO_DWELL_FALLBACK_MS;
    return ms;
  }

  function nextCycle(last: string): string[] {
    const cycle = shuffleLoops(list, random);
    if (cycle.length > 1 && cycle[0] === last) {
      const j = 1 + Math.floor(random() * (cycle.length - 1));
      [cycle[0], cycle[j]] = [cycle[j], cycle[0]];
    }
    return cycle;
  }

  function tick(dtMs: number): boolean {
    if (list.length < 2) return false;
    if (host.pageHidden() || !host.inView() || host.busy()) return false;
    elapsed += Math.min(1_000, Math.max(0, dtMs));
    const current = order[index];
    if (elapsed < dwellOf(current)) return false;
    const fromOrder = order;
    const from = index;
    let nextOrder = order;
    let nextIndex = index + 1;
    if (nextIndex >= order.length) {
      nextOrder = nextCycle(order[order.length - 1] ?? '');
      nextIndex = 0;
    }
    const next = nextOrder[nextIndex];
    if (!next) return false;
    order = nextOrder;
    index = nextIndex;
    elapsed = 0;
    let failed = false;
    host.mount(next, () => {
      if (failed) return;
      failed = true;
      order = fromOrder;
      index = from;
      elapsed = 0;
    });
    return !failed;
  }

  /** The shuffle button showed `variant`. Start its dwell from zero. */
  function jump(variant: string) {
    const at = order.indexOf(variant);
    if (at < 0) return;
    index = at;
    elapsed = 0;
  }

  /** The tab came back. Start this film's dwell over instead of adding a tick. */
  function reset() {
    elapsed = 0;
  }

  return {
    tick,
    jump,
    reset,
    current: () => order[index],
    elapsed: () => elapsed,
    dwell: () => dwellOf(order[index]),
  };
}
