/**
 * Landing-page loop coverage.
 *
 * Topic/grade/marketing landings must expose one looping animation.
 * Pages that already mount a ConceptLoop keep that film (protected engine).
 * Every other landing gets a CSS/SVG variant from LandingLoop.astro.
 * triangle-area-grade-7 keeps its explorer; the explorer glides once, so it
 * still needs a real loop.
 */
import topicFamilies from '../data/topicFamilies.json';
import type { TopicPageContent } from './topicPages';

/** Same mount list TopicPage used before this change (F01–F06, F21, F26, F38). */
export const FAMILY_CONCEPT_LOOP = {
  F01: 'sticks',
  F02: 'numberline',
  F03: 'tenframes',
  F04: 'balance',
  F05: 'pattern',
  F06: 'bars',
  F21: 'area-model',
  F26: 'triangle',
  F38: 'pythagoras',
} as const;

export type ConceptLoopVariant = (typeof FAMILY_CONCEPT_LOOP)[keyof typeof FAMILY_CONCEPT_LOOP];

/** CSS/SVG loops. Transform and opacity only. */
export const CSS_LOOP_VARIANTS = [
  'powers',
  'exp-rules',
  'roots',
  'signed',
  'signed-mul',
  'signed-div',
  'absolute',
  'order',
  'percent',
  'angles',
  'measure',
  'parallel',
  'area',
  'area-para',
  'area-split',
  'quads',
  'rect',
  'rhombus',
  'square',
  'trapezoid',
  'circle',
  'round-solid',
  'cone',
  'cyl-area',
  'solids',
  'prism-area',
  'prism-vol',
  'coords',
  'pattern-graph',
  'scale',
  'distance',
  'linear',
  'parabola',
  'quad-eq',
  'quad-factor',
  'read-graph',
  'systems',
  'ineq',
  'quad-ineq',
  'stats',
  'probability',
  'transform',
  'triangle-area',
  'triangles',
  'exterior',
  'isosceles',
  'median',
  't306090',
  'side-angle',
  'congruence',
  'proof',
  'similar',
  'similar-area',
  'similar-aa',
  'tools',
] as const;

export type CssLoopVariant = (typeof CSS_LOOP_VARIANTS)[number];

const FAMILY_CSS_LOOP: Record<string, CssLoopVariant> = {
  F10: 'stats',
  F14: 'transform',
  F15: 'coords',
  F16: 'angles',
  F17: 'area',
  F18: 'triangles',
  F19: 'quads',
  F20: 'order',
  F28: 'stats',
  F29: 'probability',
  F31: 'solids',
  F32: 'percent',
  F34: 'similar',
  F35: 'coords',
  F36: 'signed',
  F37: 'powers',
  F39: 'circle',
  F40: 'parabola',
  F41: 'linear',
  F42: 'congruence',
  F43: 'systems',
};

/** Finer than the family when the page's own idea is narrower. */
const SLUG_CSS_OVERRIDE: Record<string, CssLoopVariant> = {
  'triangle-area-grade-7': 'triangle-area',
  'square-root-grade-7': 'roots',
  'square-roots-grade-9': 'roots',
  'cylinder-volume-grade-8': 'round-solid',
  'transition-to-high-school-grade-9': 'quad-factor',
  'geometric-proof-grade-8': 'proof',
  'exponent-rules-grade-9': 'exp-rules',
  'multiplying-signed-numbers-grade-7': 'signed-mul',
  'dividing-signed-numbers-grade-7': 'signed-div',
  'number-line-absolute-value-grade-7': 'absolute',
  'angles-introduction-measurement-grade-7': 'measure',
  'parallel-lines-angles-grade-8': 'parallel',
  'area-parallelogram-trapezoid-composite-grade-7': 'area-para',
  'composite-polygons-area-grade-9': 'area-split',
  'rectangle-grade-9': 'rect',
  'rhombus-grade-9': 'rhombus',
  'square-grade-9': 'square',
  'trapezoid-grade-9': 'trapezoid',
  'cone-grade-8': 'cone',
  'cylinder-surface-area-grade-8': 'cyl-area',
  'triangular-prism-surface-area-grade-9': 'prism-area',
  'triangular-prism-volume-grade-9': 'prism-vol',
  'patterns-and-graphs-grade-7': 'pattern-graph',
  'coordinate-plane-scale-grade-7': 'scale',
  'analytic-geometry-grade-9': 'distance',
  'coordinate-plane-applications-grade-7': 'distance',
  'coordinate-plane-applications-grade-9': 'distance',
  'quadratic-equations-grade-9': 'quad-eq',
  'reading-graphs-grade-9': 'read-graph',
  'inequalities-grade-8': 'ineq',
  'quadratic-inequalities-systems-grade-9': 'quad-ineq',
  'isosceles-triangle-grade-8': 'isosceles',
  'isosceles-triangle-grade-9': 'isosceles',
  'isosceles-triangle-properties-grade-8': 'isosceles',
  'special-triangles-grade-7-new': 'isosceles',
  'exterior-angle-triangle-grade-8': 'exterior',
  'triangle-30-60-90-grade-9': 't306090',
  'triangle-median-grade-8': 'median',
  'triangle-sides-angles-grade-9': 'side-angle',
  'similar-triangles-area-ratio-grade-8': 'similar-area',
  'triangle-similarity-aa-grade-9': 'similar-aa',
  'triangle-similarity-proof-grade-8': 'similar-aa',
};

export const GRADE_CONCEPT_LOOP = {
  1: 'tenframes',
  2: 'sticks',
  3: 'bars',
  4: 'numberline',
  5: 'balance',
  6: 'pattern',
  7: 'triangle',
  8: 'pythagoras',
  9: 'area-model',
} as const;

export const MARKETING_LANDING_LOOPS = {
  'high-school-math': 'parabola',
  'math-tools': 'tools',
} as const satisfies Record<string, CssLoopVariant>;

/** Site pages that are policy/contact, not marketing landings. */
export const NON_LANDING_SITE_SLUGS = [
  'aboutus',
  'accessibilityadaptation',
  'terms',
  'conditionforfreeworksheets',
] as const;

export type LandingLoop =
  | { kind: 'concept'; variant: ConceptLoopVariant; marker: string }
  | { kind: 'css'; variant: CssLoopVariant; marker: string };

function familyOf(page: Pick<TopicPageContent, 'grade' | 'catalogCta'>): string | undefined {
  const topicId = page.catalogCta?.catalogTopicId ?? null;
  if (topicId == null) return undefined;
  return (topicFamilies as Record<string, string>)[`g${page.grade}-t${topicId}`];
}

export function topicLandingLoop(page: Pick<TopicPageContent, 'slug' | 'grade' | 'catalogCta'>): LandingLoop {
  const override = SLUG_CSS_OVERRIDE[page.slug];
  if (override) return { kind: 'css', variant: override, marker: override };
  const family = familyOf(page);
  const concept = family ? FAMILY_CONCEPT_LOOP[family as keyof typeof FAMILY_CONCEPT_LOOP] : undefined;
  if (concept) return { kind: 'concept', variant: concept, marker: `concept-${concept}` };
  const css = family ? FAMILY_CSS_LOOP[family] : undefined;
  if (!css) {
    throw new Error(`No landing loop for ${page.slug} (family ${family ?? 'none'})`);
  }
  return { kind: 'css', variant: css, marker: css };
}

export function marketingLandingLoop(slug: string): CssLoopVariant | undefined {
  return MARKETING_LANDING_LOOPS[slug as keyof typeof MARKETING_LANDING_LOOPS];
}

/** Unicode minus. Hyphen-minus reads as a dash and sits too wide in these formulas. */
export const MINUS = '\u2212';

export function signedLabel(n: number): string {
  return n < 0 ? `${MINUS}${Math.abs(n)}` : String(n);
}

/** One powers comparison. `<sup>` is glued to `base` with no whitespace. */
export type PowerRow = {
  base: string;
  sup: string;
  result: string;
  expand: string;
  caption: string;
  hi: 'parens' | 'sign';
};

export const POWERS_ROWS: readonly PowerRow[] = [
  {
    base: `(${MINUS}3)`,
    sup: '2',
    result: '9',
    expand: `(${MINUS}3) × (${MINUS}3)`,
    caption: 'המינוס בתוך הסוגריים',
    hi: 'parens',
  },
  {
    base: `${MINUS}3`,
    sup: '2',
    result: `${MINUS}9`,
    expand: `${MINUS}(3 × 3)`,
    caption: 'בלי סוגריים: קודם החזקה',
    hi: 'sign',
  },
  {
    base: `(${MINUS}3)`,
    sup: '3',
    result: `${MINUS}27`,
    expand: `(${MINUS}3) × (${MINUS}3) × (${MINUS}3)`,
    caption: 'חזקה אי־זוגית: הסימן נשאר',
    hi: 'parens',
  },
];

/** `(−3)<sup>2</sup> = 9` with the exponent tag hard against the base. */
export function powerMarkup(row: PowerRow): string {
  return `${row.base}<sup>${row.sup}</sup> = ${row.result}`;
}

/**
 * The one idea each new loop teaches. One Hebrew line, shown on the card
 * and listed in the pull request.
 */
export const CSS_LOOP_IDEAS = {
  powers: `סוגריים קובעים את הסימן: (${MINUS}3)² = 9, בלי סוגריים ${MINUS}3² = ${MINUS}9, וחזקה אי־זוגית (${MINUS}3)³ = ${MINUS}27`,
  'exp-rules': 'בכפל חזקות עם אותו בסיס מחברים מעריכים: 2³ × 2² = 2⁵',
  roots: 'השורש שואל איזה מספר בריבוע נותן את זה: 3² = 9 ולכן √9 = 3',
  signed: `על ישר המספרים מתחילים ב־${MINUS}2 ומוסיפים 5 ימינה, ומגיעים ל־3`,
  'signed-mul': 'מינוס כפול מינוס נותן פלוס, ומינוס כפול פלוס נותן מינוס',
  'signed-div': 'בחילוק, סימנים זהים נותנים פלוס וסימנים שונים נותנים מינוס',
  absolute: `ערך מוחלט הוא המרחק מאפס, ולכן |${MINUS}4| ו־|4| שניהם 4`,
  order: `קודם כופלים 3 × (${MINUS}4), ורק אחר כך מחברים ל־${MINUS}2`,
  percent: 'רבע מהשלם הוא 25%, והחלק הצבוע הוא אחד מארבעה',
  angles: 'זוויות קודקודיות שוות, וצמודות משלימות ל־180°',
  measure: 'מודדים זווית לפי פתיחת הקרן: כאן הקרן נפתחת עד 60°',
  parallel: 'חותך בין ישרים מקבילים יוצר זוויות מתאימות שוות',
  area: 'שטח המלבן הוא מספר המשבצות: 5 שורות של 3, כלומר 15',
  'area-para': 'שטח מקבילית הוא בסיס כפול הגובה המאונך, לא הצלע האלכסונית',
  'area-split': 'מצולע מורכב נחתך למלבנים, והשטחים מחוברים',
  quads: 'גזירת מלבן נותנת מקבילית בלי לשנות את השטח',
  rect: 'במלבן כל הזוויות ישרות, והאלכסונים שווים זה לזה',
  rhombus: 'במעוין כל ארבע הצלעות שוות',
  square: 'בריבוע כל הצלעות שוות ויש זווית ישרה',
  trapezoid: 'בטרפז יש בדיוק זוג אחד של צלעות מקבילות',
  circle: 'הקוטר הוא שני רדיוסים, ההיקף 2πr והשטח πr²',
  'round-solid': 'נפח גליל: עיגול הבסיס נערם לגובה, V = πr²h',
  cone: 'נפח חרוט הוא שליש מנפח גליל עם אותו בסיס ואותו גובה',
  'cyl-area': 'מעטפת הגליל נפרסת למלבן שרוחבו היקף הבסיס',
  solids: 'נפח תיבה מתקבל מאורך כפול רוחב כפול גובה',
  'prism-area': 'שטח פנים של מנסרה: שני בסיסים משולשים ועוד שלושה מלבנים',
  'prism-vol': 'נפח מנסרה הוא שטח בסיס המשולש כפול האורך',
  coords: 'הנקודה עוברת בין הרביעים, ובכל רביע סימני x ו־y מתחלפים',
  'pattern-graph': 'הנקודות על הגרף מקיימות את אותה חוקיות, כאן y = 2x',
  scale: 'יחידה אחת על הציר מייצגת 5, ולכן שתי יחידות הן 10',
  distance: 'המרחק בין שתי נקודות הוא אלכסון של הפרש ה־x והפרש ה־y',
  linear: 'שיפוע 2: על כל צעד ימינה עולים שני צעדים',
  parabola: `לפרבולה y = x² יש סימטריה: ל־x ול־${MINUS}x אותו y`,
  'quad-eq': 'פתרונות המשוואה הריבועית הם נקודות החיתוך עם ציר x',
  'quad-factor': `מפרקים x² ${MINUS} 5x + 6 ל־(x ${MINUS} 2) × (x ${MINUS} 3) = 0, ולכן x = 2 או x = 3`,
  'read-graph': 'קוראים מהגרף: ב־x = 2 מתקבל y = 4',
  systems: 'נקודת החיתוך מקיימת את שתי המשוואות יחד',
  ineq: 'אי־שוויון x > 2 הוא קרן פתוחה ימינה על ישר המספרים',
  'quad-ineq': `x² > 9 מתקיים מחוץ לשורשים: x < ${MINUS}3 או x > 3`,
  stats: 'הממוצע של 4, 6 ו־8 הוא 6: השמונה נותנת 2 לארבע, והכול מתיישר',
  probability: 'למטבע שתי תוצאות שוות סיכוי, ולכן ההסתברות לחצי',
  transform: 'הזזה מזיזה את המשולש בלי לשנות את גודלו או את צורתו',
  'triangle-area': 'משולש עם אותו בסיס וגובה הוא חצי מהמלבן',
  triangles: 'שלוש זוויות המשולש נפרסות לקו ישר, ולכן סכומן 180°',
  exterior: 'הזווית החיצונית שווה לסכום שתי הזוויות הפנימיות הרחוקות',
  isosceles: 'במשולש שווה־שוקיים זוויות הבסיס שוות',
  median: 'התיכון יוצא מהקודקוד וחוצה את הצלע שמולו לשני חלקים שווים',
  t306090: 'במשולש 30, 60, 90 הצלע שמול 30 היא חצי מהיתר',
  'side-angle': 'מול הצלע הארוכה יותר נמצאת הזווית הגדולה יותר',
  congruence: 'התאמת צלעות וזוויות מביאה את שני המשולשים לחפיפה',
  proof: 'בהוכחה: נתון שצמודות שוות, הנימוק הוא זוויות צמודות ולכן הסכום 180°, וכל אחת 90°',
  similar: 'בדמיון הזוויות נשמרות והצלעות גדלות באותו יחס',
  'similar-area': 'כשהצלעות גדלות פי 2, השטח גדל פי 4',
  'similar-aa': 'שתי זוויות שוות מספיקות כדי לקבוע דמיון',
  tools: 'המחשבון פותח קודם סוגריים: 2 × (3 + 1) הופך ל־2 × 4 = 8',
} as const satisfies Record<CssLoopVariant, string>;

export const FORMULA_LOOP_VARIANTS = [
  'powers',
  'exp-rules',
  'roots',
  'order',
  'signed-mul',
  'signed-div',
  'tools',
  'proof',
  'quad-factor',
] as const satisfies readonly CssLoopVariant[];

/**
 * Why a shared picture stays on a page that is not that one topic.
 * The card still shows the variant's idea. The pull-request table adds this note.
 */
export const LOOP_TABLE_NOTES = {
  'high-school-math': 'עמוד קישורים לחומרי תיכון בלי תרגיל אחד, ולכן נשארת סימטריית הפרבולה',
} as const satisfies Record<string, string>;

export function cssLoopIdea(variant: CssLoopVariant): string {
  return CSS_LOOP_IDEAS[variant];
}

const CAPTION_CORE = /[0-9A-Za-z⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₀₁₂₃₄₅₆₇₈₉π°]/;
const CAPTION_OPERATORS = '−+×÷=≠<>≤≥±√∞%*';
const CAPTION_MARKS = '()[]{}|∥⊥∠^/~·∙′″⁄–—+';

function captionIsCore(ch: string): boolean {
  return CAPTION_CORE.test(ch) || CAPTION_OPERATORS.includes(ch);
}

function captionIsSymbol(ch: string): boolean {
  return captionIsCore(ch) || CAPTION_MARKS.includes(ch) || ch === '-';
}

function captionIsGlue(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\u00a0' || ch === ',';
}

function captionIsDecimalPoint(text: string, i: number): boolean {
  return (
    text[i] === '.' &&
    i > 0 &&
    i + 1 < text.length &&
    /[0-9]/.test(text[i - 1]!) &&
    /[0-9]/.test(text[i + 1]!)
  );
}

function captionIsMathAt(text: string, i: number): boolean {
  return captionIsSymbol(text[i]!) || captionIsDecimalPoint(text, i);
}

function captionSpanEnd(text: string, start: number): number {
  let j = start;
  while (j < text.length) {
    if (captionIsMathAt(text, j)) {
      j += 1;
      continue;
    }
    if (captionIsGlue(text[j]!) || text[j] === ':') {
      let k = j;
      while (k < text.length && (captionIsGlue(text[k]!) || text[k] === ':')) k += 1;
      if (k < text.length && captionIsMathAt(text, k)) {
        j = k;
        continue;
      }
    }
    break;
  }
  return j;
}

function captionEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wrap every math fragment of a Hebrew caption in an LTR isolate.
 * A prefix such as ל־ or ב־ stays outside the isolate; the number that
 * follows it is inside. The isolate is unbreakable via `.ll-math`.
 */
export function captionMathHtml(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    if (!captionIsMathAt(input, i)) {
      out += captionEscape(input[i]!);
      i += 1;
      continue;
    }
    const end = captionSpanEnd(input, i);
    const slice = input.slice(i, end);
    const escaped = captionEscape(slice);
    if ([...slice].some(captionIsCore)) {
      out += `<bdi dir="ltr" class="ll-math">${escaped}</bdi>`;
    } else {
      out += escaped;
    }
    i = end;
  }
  return out;
}
