/**
 * Per-grade ConceptLoop pools for the grade-hub rotating player.
 *
 * Source of truth: LOOPS_MAP_73_v2.csv (NOAM-CLAUDE-DESIGN-ASSETS-2026-09-28/
 * 05_MAPPING_AND_QA). A variant belongs to grade N only when both columns agree:
 *   - the landing grade: "הצעת דף ל־hero-only" (/grade-N or a *-grade-N topic
 *     page), or for loops already on a hub, the /grade-N in "מופיע היום באתר";
 *   - the "כיתה" column (ranges and "באתר …" / "וגם …" notes included).
 * `topic` is set only when the map names an existing topic page for that same
 * grade; otherwise the link falls back to /worksheets?grade=N. No page is
 * invented. Labels are the short QA'd chips from ExactHeroControls.astro.
 */
import type { GradeHubGrade } from './gradeHubs';

export interface GradeLoopEntry {
  variant: string;
  label: string;
  href: string;
  domain: string;
  /** Completed-frame time in seconds; see GRADE_LOOP_HOLD_S. */
  hold?: number;
}

interface MappedLoop {
  /** Row id in LOOPS_MAP_73_v2.csv ("ישן" rows use the variant). */
  source: string;
  variant: string;
  grade: GradeHubGrade;
  label: string;
  topic?: string;
}

/** The fixed one-loop-per-grade mapping GradeHubPage has always rendered. */
export const GRADE_LOOP_DEFAULTS: Record<GradeHubGrade, string> = {
  1: 'tenframes',
  2: 'sticks',
  3: 'bars',
  4: 'numberline',
  5: 'balance',
  6: 'pattern',
  7: 'triangle',
  8: 'pythagoras',
  9: 'area-model',
};

/** Variants the map does not place clearly in one grade. Kept out of every pool. */
export const EXCLUDED_GRADE_LOOPS: Record<string, string> = {
  array: 'כיתה "א׳, ב׳, ד׳, ה׳" but landing /grade-3',
  'pct-25': 'כיתה "ו׳–ז׳" but landing /percentage-problems-grade-8',
  'tri-sort': 'כיתה "ו׳–ז׳" but landing /triangle-sides-angles-grade-9',
  'topic-card': 'כיתה "לא ברור"; mapping decision still open',
};

const LOOPS: readonly MappedLoop[] = [
  { source: 'tenframes', variant: 'tenframes', grade: 1, label: 'מסגרת עשר' },
  { source: 'L06', variant: 'add-within', grade: 1, label: 'חיבור בתחום העשר' },
  { source: 'L52', variant: 'apples-5', grade: 1, label: 'חילופיות בחיבור' },
  { source: 'L24', variant: 'birds-sub', grade: 1, label: 'חיסור בתחום העשר' },
  { source: 'L32', variant: 'neighbors', grade: 1, label: 'מספרים שכנים' },
  { source: 'L15', variant: 'clock-3', grade: 1, label: 'קריאת שעון · שעה שלמה' },

  { source: 'sticks', variant: 'sticks', grade: 2, label: 'עשרות ויחידות' },
  { source: 'L42', variant: 'coins-12', grade: 2, label: 'מטבעות וסכומים' },
  { source: 'polygon', variant: 'polygon', grade: 2, label: 'צורות ומצולעים' },
  { source: 'L23', variant: 'odd-pair', grade: 2, label: 'מספרים זוגיים ואי־זוגיים' },
  { source: 'baseten', variant: 'baseten', grade: 2, label: 'חיבור רב־ספרתי' },
  { source: 'L50', variant: 'place-123', grade: 2, label: 'מאות, עשרות ויחידות' },

  { source: 'bars', variant: 'bars', grade: 3, label: 'בעיות מילוליות · מודל פסים' },
  { source: 'ruler', variant: 'ruler', grade: 3, label: 'מדידה ויחידות' },
  { source: 'L34', variant: 'clock-span', grade: 3, label: 'חישוב משך זמן' },
  { source: 'cookies', variant: 'cookies', grade: 3, label: 'חילוק עם שארית' },
  { source: 'L10', variant: 'share-12', grade: 3, label: 'חילוק לקבוצות שוות' },
  { source: 'L51', variant: 'jumps-4', grade: 3, label: 'כפל כקפיצות שוות' },
  { source: 'L40', variant: 'unit-frac', grade: 3, label: 'השוואת שברי יחידה' },

  { source: 'numberline', variant: 'numberline', grade: 4, label: 'ישר המספרים · עיגול' },
  { source: 'data', variant: 'data', grade: 4, label: 'הצגת נתונים' },
  { source: 'fraction', variant: 'fraction', grade: 4, label: 'שבר כחלק משלם' },
  { source: 'L54', variant: 'mark-250', grade: 4, label: 'מספרים על הישר' },
  { source: 'L45', variant: 'equiv-half', grade: 4, label: 'שברים שווים על הישר' },
  { source: 'L55', variant: 'quad-gate', grade: 4, label: 'זיהוי מרובעים' },

  { source: 'balance', variant: 'balance', grade: 5, label: 'משוואות ומאזניים' },
  { source: 'L37', variant: 'quarter-12', grade: 5, label: 'חלק מכמות' },
  { source: 'L44', variant: 'tenth-cell', grade: 5, label: 'עשיריות ומאיות' },

  { source: 'pattern', variant: 'pattern', grade: 6, label: 'חוקיות' },
  { source: 'L56', variant: 'two-diag', grade: 6, label: 'אלכסונים במרובע' },
  { source: 'L04', variant: 'frac-product', grade: 6, label: 'כפל שברים' },
  { source: 'L18', variant: 'prime-rect', grade: 6, label: 'מספרים ראשוניים' },

  // The map lists no grade-7 topic page for triangle (only grade-9 pages).
  { source: 'triangle', variant: 'triangle', grade: 7, label: 'שטח משולש' },
  { source: 'L08', variant: 'order-ops', grade: 7, label: 'סדר פעולות חשבון', topic: '/order-of-operations-signed-numbers-grade-7' },
  { source: 'L16', variant: 'peri-rect', grade: 7, label: 'היקף מלבן', topic: '/area-rectangle-perimeter-grade-7' },
  { source: 'L20', variant: 'obtuse-ht', grade: 7, label: 'גובה מחוץ למשולש', topic: '/triangle-area-grade-7' },
  { source: 'L09', variant: 'sup-angles', grade: 7, label: 'זוויות צמודות', topic: '/adjacent-vertical-angles-grade-7' },
  // The map marks its page as only a partial match ("קרוב חלקית").
  { source: 'L31', variant: 'ratio-beads', grade: 7, label: 'יחס' },
  { source: 'L17', variant: 'signed-jump', grade: 7, label: 'חיבור מספרים מכוונים', topic: '/number-line-absolute-value-grade-7' },
  { source: 'L41', variant: 'coord-walk', grade: 7, label: 'נקודה במערכת הצירים', topic: '/coordinate-plane-quadrants-grade-7' },
  { source: 'L49', variant: 'cube-8', grade: 7, label: 'חזקה שלישית', topic: '/solids-box-cube-prism-grade-7' },
  { source: 'L21', variant: 'box-vol', grade: 7, label: 'נפח תיבה', topic: '/solids-box-cube-prism-grade-7' },
  { source: 'L33', variant: 'signed-ops', grade: 7, label: 'סדר פעולות במספרים מכוונים', topic: '/order-of-operations-signed-numbers-grade-7' },
  { source: 'L01', variant: 'angle-sum', grade: 7, label: 'סכום זוויות במשולש', topic: '/triangle-quadrilateral-angle-sum-grade-7' },
  { source: 'L39', variant: 'map-scale', grade: 7, label: 'קנה מידה', topic: '/coordinate-plane-scale-grade-7' },
  { source: 'L47', variant: 'sq-stretch', grade: 7, label: 'ריבוע ומלבן', topic: '/area-rectangle-perimeter-grade-7' },
  { source: 'L26', variant: 'rect-count', grade: 7, label: 'שטח והיקף מלבן', topic: '/area-rectangle-perimeter-grade-7' },
  { source: 'L27', variant: 'l-split', grade: 7, label: 'שטח צורה מורכבת', topic: '/area-parallelogram-trapezoid-composite-grade-7' },
  { source: 'L22', variant: 'trap-area', grade: 7, label: 'שטח טרפז', topic: '/area-parallelogram-trapezoid-composite-grade-7' },
  { source: 'L02', variant: 'para-rect', grade: 7, label: 'שטח מקבילית', topic: '/area-parallelogram-trapezoid-composite-grade-7' },
  { source: 'L03', variant: 'angle-kinds', grade: 7, label: 'סוגי זוויות', topic: '/angles-introduction-measurement-grade-7' },

  { source: 'pythagoras', variant: 'pythagoras', grade: 8, label: 'משפט פיתגורס', topic: '/pythagorean-theorem-grade-8' },
  { source: 'L12', variant: 'mean-cols', grade: 8, label: 'ממוצע', topic: '/statistics-grade-8' },
  { source: 'L25', variant: 'circ-unroll', grade: 8, label: 'היקף מעגל', topic: '/circle-area-circumference-grade-8' },
  { source: 'L11', variant: 'corr-angles', grade: 8, label: 'זוויות בין מקבילים', topic: '/parallel-lines-angles-grade-8' },
  { source: 'L35', variant: 'exterior', grade: 8, label: 'זווית חיצונית למשולש', topic: '/exterior-angle-triangle-grade-8' },
  { source: 'L19', variant: 'sas-snap', grade: 8, label: 'חפיפה · צלע־זווית־צלע', topic: '/triangle-congruence-grade-8' },
  { source: 'L36', variant: 'para-perp', grade: 8, label: 'מקבילים ומאונכים', topic: '/parallel-lines-angles-grade-8' },
  { source: 'L07', variant: 'similar', grade: 8, label: 'דמיון משולשים', topic: '/similar-triangles-grade-8' },
  { source: 'L43', variant: 'cyl-stack', grade: 8, label: 'נפח גליל', topic: '/cylinder-volume-grade-8' },
  { source: 'L05', variant: 'slope', grade: 8, label: 'שיפוע', topic: '/linear-function-grade-8' },

  { source: 'area-model', variant: 'area-model', grade: 9, label: 'כפל ביטויים ופתיחת סוגריים', topic: '/distributive-law-grade-9' },
  { source: 'L28', variant: 'quad-tree', grade: 9, label: 'משפחת המרובעים', topic: '/square-grade-9' },
  { source: 'transform', variant: 'transform', grade: 9, label: 'שיקוף, סיבוב והזזה', topic: '/congruent-polygons-transformations-grade-9' },
  { source: 'L48', variant: 'area-x4', grade: 9, label: 'הגדלה ושטח', topic: '/rectangle-square-area-grade-9' },
  { source: 'L38', variant: 'two-coins', grade: 9, label: 'הסתברות · שני מטבעות', topic: '/probability-grade-9' },
  { source: 'L14', variant: 'diff-sq', grade: 9, label: 'הפרש ריבועים', topic: '/difference-of-squares-grade-9' },
  { source: 'L30', variant: 'parab', grade: 9, label: 'קודקוד הפרבולה', topic: '/quadratic-function-grade-9' },
  { source: 'L46', variant: 'half-eq', grade: 9, label: 'משולש 30°–60°–90°', topic: '/triangle-30-60-90-grade-9' },
];

/** Curriculum domain shown above each loop's title in the player text block. */
const DOMAINS: Record<string, readonly string[]> = {
  'מספרים ופעולות': [
    'tenframes', 'add-within', 'apples-5', 'birds-sub', 'neighbors',
    'sticks', 'coins-12', 'odd-pair', 'baseten', 'place-123',
    'bars', 'cookies', 'share-12', 'jumps-4', 'numberline', 'mark-250',
    'prime-rect', 'order-ops', 'signed-jump', 'signed-ops', 'cube-8',
  ],
  'שברים ועשרוניים': ['unit-frac', 'fraction', 'equiv-half', 'quarter-12', 'tenth-cell', 'frac-product'],
  'מדידה וזמן': ['clock-3', 'ruler', 'clock-span'],
  'גאומטריה': [
    'polygon', 'quad-gate', 'two-diag',
    'triangle', 'peri-rect', 'obtuse-ht', 'sup-angles', 'box-vol', 'angle-sum',
    'sq-stretch', 'rect-count', 'l-split', 'trap-area', 'para-rect', 'angle-kinds',
    'pythagoras', 'circ-unroll', 'corr-angles', 'exterior', 'sas-snap', 'para-perp',
    'similar', 'cyl-stack', 'quad-tree', 'transform', 'area-x4', 'half-eq',
  ],
  'אלגברה': ['balance', 'pattern', 'coord-walk', 'slope', 'area-model', 'diff-sq', 'parab'],
  'יחס וקנה מידה': ['ratio-beads', 'map-scale'],
  'נתונים והסתברות': ['data', 'mean-cols', 'two-coins'],
};

const DOMAIN_BY_VARIANT = new Map(
  Object.entries(DOMAINS).flatMap(([domain, variants]) => variants.map((v) => [v, domain] as const))
);

export function gradeLoopDomain(variant: string): string {
  return DOMAIN_BY_VARIANT.get(variant) ?? 'הדגמה מתמטית';
}

/** The fixed explanation line under each title; no per-loop copy is invented. */
export const GRADE_LOOP_EXPLANATION = 'הדגמה קצרה של רעיון מרכזי בנושא, מתוך דפי העבודה במאגר.';

/**
 * Completed-frame time in seconds (SPECS[variant].hold in conceptLoops.ts):
 * the frame the engine parks on and shows for reduced motion. The protected
 * engine does not expose it, so it is mirrored here; a test keeps it in sync.
 */
export const GRADE_LOOP_HOLD_S: Record<string, number> = {
  tenframes: 6.5, 'add-within': 5.2, 'apples-5': 5.0, 'birds-sub': 5.0, neighbors: 4.8, 'clock-3': 5.2,
  sticks: 6.5, 'coins-12': 5.0, polygon: 5.2, 'odd-pair': 5.4, baseten: 6.2, 'place-123': 5.2,
  bars: 6.2, ruler: 5.0, 'clock-span': 5.0, cookies: 6.2, 'share-12': 5.8, 'jumps-4': 5.0, 'unit-frac': 5.0,
  numberline: 6.5, data: 7.0, fraction: 6.4, 'mark-250': 4.8, 'equiv-half': 5.2, 'quad-gate': 5.0,
  balance: 6.0, 'quarter-12': 4.8, 'tenth-cell': 5.0,
  pattern: 6.0, 'two-diag': 5.2, 'frac-product': 5.8, 'prime-rect': 5.4,
  triangle: 7.8, 'order-ops': 6.2, 'peri-rect': 6.2, 'obtuse-ht': 5.2, 'sup-angles': 5.4, 'ratio-beads': 5.2,
  'signed-jump': 5.2, 'coord-walk': 5.2, 'cube-8': 5.2, 'box-vol': 5.6, 'signed-ops': 5.2, 'angle-sum': 6.2,
  'map-scale': 5.2, 'sq-stretch': 5.0, 'rect-count': 5.8, 'l-split': 5.0, 'trap-area': 5.2, 'para-rect': 5.4,
  'angle-kinds': 6.2,
  pythagoras: 7.6, 'mean-cols': 5.2, 'circ-unroll': 5.4, 'corr-angles': 5.6, exterior: 5.2, 'sas-snap': 5.2,
  'para-perp': 5.2, similar: 5.4, 'cyl-stack': 5.2, slope: 6.2,
  'area-model': 7.5, 'quad-tree': 5.4, transform: 6.8, 'area-x4': 5.2, 'two-coins': 5.2, 'diff-sq': 5.4,
  parab: 5.2, 'half-eq': 5.2,
};

export function gradeLoopMap(): readonly MappedLoop[] {
  return LOOPS;
}

/** Pool for one grade hub, the existing default variant first. */
export function buildGradeLoopPool(grade: GradeHubGrade): GradeLoopEntry[] {
  const fallback = `/worksheets?grade=${grade}`;
  const pool = LOOPS.filter((loop) => loop.grade === grade).map((loop) => ({
    variant: loop.variant,
    label: loop.label,
    href: loop.topic ?? fallback,
    domain: gradeLoopDomain(loop.variant),
    hold: GRADE_LOOP_HOLD_S[loop.variant],
  }));
  const defaultVariant = GRADE_LOOP_DEFAULTS[grade];
  return [
    ...pool.filter((entry) => entry.variant === defaultVariant),
    ...pool.filter((entry) => entry.variant !== defaultVariant),
  ];
}
