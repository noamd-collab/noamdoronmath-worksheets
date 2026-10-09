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
