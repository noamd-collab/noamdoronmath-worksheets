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
 *
 * Text block copy (GRADE_LOOP_COPY) follows Claude's 4-line template. Topic
 * and claim come from the map's "נושא" and "שאלה/כותרת" columns; the math line
 * and the steps come from the loop card itself (its formula strip and
 * ariaLabels in ConceptLoop.astro), so no content is invented.
 */
import type { GradeHubGrade } from './gradeHubs';

export interface GradeLoopCopy {
  /** Line 1: "תחום · נושא". */
  domain: string;
  /** Line 2 (Secular One): the loop's claim in one sentence. */
  claim: string;
  /** Line 3: one action in short; its formula runs render dir="ltr" (gradeLoopMathParts). */
  mathLine: string;
  /** Line 4: 2–3 sentences in the order of the animation, ending with the result. */
  explain: string;
}

export interface GradeLoopEntry extends GradeLoopCopy {
  variant: string;
  label: string;
  href: string;
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

/**
 * The player's 4-line text block per pooled loop. Signed numbers and
 * formulas stay out of `explain` (plain RTL prose); they live in `mathLine`,
 * where each formula run is isolated LTR.
 */
export const GRADE_LOOP_COPY: Record<string, GradeLoopCopy> = {
  // ── grade 1 ──
  tenframes: {
    domain: 'חיבור בתוך 20 · השלמה לעשר',
    claim: 'משלימים לעשר, ואז מוסיפים את השאר',
    mathLine: '7 + 5 = 7 + 3 + 2 = 10 + 2 = 12',
    explain: 'במסגרת העשר יש 7 נקודות, ומגיעות עוד 5. שלוש מהן משלימות את המסגרת לעשר, ושתיים עוברות למסגרת השנייה. עשר ועוד שתיים הם 12.',
  },
  'add-within': {
    domain: 'חיבור בתוך 10 · צירוף קבוצות',
    claim: 'מצרפים שתי קבוצות וסופרים את כולן',
    mathLine: '3 + 4 = 7',
    explain: 'יש קבוצה של 3 וקבוצה של 4. הקבוצה של 3 מצטרפת לקבוצה של 4. יחד יש 7.',
  },
  'apples-5': {
    domain: 'חיבור בתוך 10 · חילופיות',
    claim: 'סדר המחוברים לא משנה את הסכום',
    mathLine: '2 + 3 = 3 + 2 = 5',
    explain: 'שני תפוחים ושלושה תפוחים עומדים זה לצד זה. הקבוצות מחליפות מקום, והסדר משתנה. הסכום נשאר 5.',
  },
  'birds-sub': {
    domain: 'חיסור בתוך 10 · מה נשאר',
    claim: 'בחיסור בודקים כמה נשארו',
    mathLine: '6 − 2 = 4',
    explain: 'יש 6 ציפורים. 2 מהן עפות משם. נשארות 4 ציפורים.',
  },
  neighbors: {
    domain: 'סדר מספרים · שכנים בישר',
    claim: 'לכל מספר יש שכן לפניו ושכן אחריו',
    mathLine: '7 < 8 < 9',
    explain: 'המספר 8 מסומן על ישר המספרים. לידו מסומנים שני השכנים שלו: 7 לפניו ו־9 אחריו. השכנים של 8 הם 7 ו־9.',
  },
  'clock-3': {
    domain: 'שעון · שעה שלמה',
    claim: 'בשעה שלמה המחוג הגדול מצביע על 12',
    mathLine: '3:00',
    explain: 'המחוגים של השעון זזים ונעצרים. המחוג הגדול מצביע על 12 והמחוג הקטן על 3. השעה היא 3:00, שעה שלמה.',
  },
  // ── grade 2 ──
  sticks: {
    domain: 'מקום וספרות · אגודות עשר',
    claim: 'כל עשרה מקלות הם עשרת אחת',
    mathLine: '34 = 30 + 4',
    explain: 'יש 34 מקלות מפוזרים. הם נאספים לשלוש אגודות של עשר, וארבעה נשארים בודדים. 34 הם 30 ועוד 4.',
  },
  'coins-12': {
    domain: 'פירוק מספר · מטבעות',
    claim: 'מטבע של 10 ושני מטבעות של 1 הם 12',
    mathLine: '10 + 1 + 1 = 12',
    explain: 'מופיע מטבע של 10. אחריו מצטרפים שני מטבעות של 1. יחד הם שווים 12.',
  },
  polygon: {
    domain: 'מצולעים · צלעות וקודקודים',
    claim: 'במצולע יש אותו מספר צלעות וקודקודים',
    mathLine: 'מחומש: 5 צלעות, 5 קודקודים',
    explain: 'מחומש נבנה צלע אחר צלע. בכל צלע חדשה המונים של הצלעות ושל הקודקודים עולים יחד. בסוף יש 5 צלעות ו־5 קודקודים.',
  },
  'odd-pair': {
    domain: 'זוגי ואי־זוגי · סידור בזוגות',
    claim: 'אם נשארת נקודה בלי זוג, המספר אי־זוגי',
    mathLine: '7 = 3 × 2 + 1',
    explain: 'שבע נקודות נכנסות לזוגות. נוצרים 3 זוגות, ונקודה אחת נשארת לבד. לכן 7 הוא מספר אי־זוגי.',
  },
  baseten: {
    domain: 'חיבור רב־ספרתי · חציית עשר',
    claim: 'עשר יחידות מתאחדות לעשרת אחת',
    mathLine: '38 + 25 = 60 + 3 = 63',
    explain: '38 ו־25 מוצגים בקוביות בסיס עשר. 8 ועוד 5 הם 13 יחידות, ועשר מהן מתאחדות למוט של עשרת. מתקבל 63.',
  },
  'place-123': {
    domain: 'מקום וספרות · מאות, עשרות ויחידות',
    claim: 'כל ספרה אומרת כמה יש מכל סוג',
    mathLine: '100 + 20 + 3 = 123',
    explain: 'מופיעה מאה אחת. אחריה מצטרפות שתי עשרות ושלוש יחידות. יחד הן מרכיבות את 123.',
  },
  // ── grade 3 ──
  bars: {
    domain: 'בעיות מילוליות · מודל פסים',
    claim: 'פס לכל ילד מראה מה מחברים',
    mathLine: '12 + 5 = 17 → 12 + 17 = 29',
    explain: 'לדנה יש פס של 12 מדבקות. לרון יש פס של 12 ועוד 5, כלומר 17. יחד יש להם 29 מדבקות.',
  },
  ruler: {
    domain: 'מדידה ויחידות · מטר וסנטימטר',
    claim: 'במטר אחד יש 100 סנטימטרים',
    mathLine: '1 מטר = 100 ס״מ',
    explain: 'מופיע סרגל באורך מטר אחד. הוא מתחלק לעשרה קטעים של 10 ס״מ כל אחד. עשרה קטעים של 10 ס״מ הם 100 ס״מ.',
  },
  'clock-span': {
    domain: 'שעון · פרק זמן',
    claim: 'משך הזמן הוא ההפרש בין שתי השעות',
    mathLine: 'מ־2:00 עד 4:00 עברו שעתיים',
    explain: 'השעון מראה את השעה 2. המחוגים זזים עד השעה 4. עברו שעתיים.',
  },
  cookies: {
    domain: 'חילוק · חילוק עם שארית',
    claim: 'מה שלא מתחלק שווה נשאר כשארית',
    mathLine: '14 = 4 × 3 + 2',
    explain: '14 עוגיות מחולקות ל־4 צלחות, אחת לכל צלחת בתורה. כל צלחת מקבלת 3 עוגיות, ו־2 עוגיות נשארות. זו השארית.',
  },
  'share-12': {
    domain: 'חילוק · חלוקה שווה',
    claim: 'בחלוקה שווה כל קבוצה מקבלת אותו מספר',
    mathLine: '12 = 3 × 4',
    explain: 'יש 12 עצמים. הם נכנסים שווה בשווה ל־3 קבוצות. בכל קבוצה יש 4.',
  },
  'jumps-4': {
    domain: 'כפל · קפיצות שוות בישר',
    claim: 'כפל הוא קפיצות שוות על הישר',
    mathLine: '4 × 3 = 12',
    explain: 'על ישר המספרים קופצים ארבע קפיצות שוות. כל קפיצה באורך 3. מגיעים אל 12.',
  },
  'unit-frac': {
    domain: 'שברים יסודיים · השוואה',
    claim: 'ככל שהמכנה גדול יותר, החלק קטן יותר',
    mathLine: '½ > ⅓ > ¼',
    explain: 'חצי, שליש ורבע מוצגים זה לצד זה. ככל שמחלקים את השלם ליותר חלקים, כל חלק קטן יותר. החצי הוא החלק הגדול ביותר.',
  },
  // ── grade 4 ──
  numberline: {
    domain: 'ישר המספרים · השוואה ועיגול',
    claim: 'מעגלים לעשרת הקרובה יותר',
    mathLine: '47 < 52 → 47 ≈ 50',
    explain: '47 ו־52 מסומנים על ישר המספרים, ו־47 קטן מ־52. 47 רחוק 3 מ־50 ו־7 מ־40. לכן 47 מעוגל ל־50.',
  },
  data: {
    domain: 'נתונים · שלושה ייצוגים',
    claim: 'אותם נתונים בטבלה, בעמודות ובעוגה',
    mathLine: '8 + 5 + 3 = 16',
    explain: 'סימני ספירה בטבלה סופרים 8 תפוחים, 5 בננות ו־3 ענבים. הם הופכים לעמודות ואחר כך לדיאגרמת עוגה. בכל שלושת הייצוגים יש אותם 16 נתונים.',
  },
  fraction: {
    domain: 'שברים · שבר כחלק משלם',
    claim: 'רבע הוא חלק אחד מארבעה חלקים שווים',
    mathLine: 'אותו רבע בשלוש צורות: ¼',
    explain: 'עוגה נחתכת לארבעה חלקים שווים, וחלק אחד נצבע. אותו רבע מופיע גם על פס וגם על ישר המספרים. החלק הצבוע הוא רבע.',
  },
  'mark-250': {
    domain: 'ישר המספרים · מיקום עד 1000',
    claim: '250 נמצא באמצע בין 200 ל־300',
    mathLine: '200 < 250 < 300',
    explain: 'על ישר המספרים מסומנים 200 ו־300. הנקודה 250 מסומנת ביניהם. 250 גדול מ־200 וקטן מ־300.',
  },
  'equiv-half': {
    domain: 'שברים שקולים · חצי על הישר',
    claim: 'חצי, שני רבעים ושלוש שישיות',
    mathLine: 'אותו מקום על הישר: ½ = ²⁄₄ = ³⁄₆',
    explain: 'חצי, שני רבעים ושלוש שישיות מסומנים על ישר המספרים. שלושתם יושבים על אותה נקודה. לכן הם שברים שקולים.',
  },
  'quad-gate': {
    domain: 'סיווג מצולעים · מרובע מול משולש',
    claim: 'מרובע הוא צורה עם 4 צלעות',
    mathLine: '4 צלעות — מרובע',
    explain: 'צורה עם 4 צלעות נכנסת לסל המרובעים. משולש, עם 3 צלעות בלבד, נשאר בחוץ. רק הצורה עם 4 הצלעות היא מרובע.',
  },
  // ── grade 5 ──
  balance: {
    domain: 'משוואה פשוטה · מאזניים',
    claim: 'מה שמורידים מצד אחד מורידים גם מהשני',
    mathLine: '□ = 8 − 3 = 5',
    explain: 'על המאזניים 3 ועוד ריבוע ריק מול 8. מורידים 3 משני הצדדים, והמאזניים מתייצבים. בריבוע יש 5.',
  },
  'quarter-12': {
    domain: 'שברים · שבר של מספר',
    claim: 'רבע מכמות הוא חלק אחד מארבעה',
    mathLine: '¼ × 12 = 3',
    explain: 'יש 12 נקודות. רבע מהן מסומנות — חלק אחד מתוך ארבעה חלקים שווים. רבע מ־12 הוא 3.',
  },
  'tenth-cell': {
    domain: 'שברים עשרוניים · עשירית ומאית',
    claim: 'עשירית אחת היא עשר מאיות',
    mathLine: '¹⁄₁₀ = 10 × ¹⁄₁₀₀',
    explain: 'פס אחד מסומן, והוא עשירית מהשלם. משבצת אחת בתוך הפס היא מאית. בעשירית אחת יש 10 מאיות.',
  },
  // ── grade 6 ──
  pattern: {
    domain: 'תבניות וסדרות · גדילה קבועה',
    claim: 'בכל שלב נוספים 3 ריבועים',
    mathLine: '11 + 3 = 14',
    explain: 'בשלבים הראשונים יש 2, 5, 8 ו־11 ריבועים. בכל שלב נוספת עמודה של 3 ריבועים. בשלב החמישי יש 14 ריבועים.',
  },
  'two-diag': {
    domain: 'מרובעים · אלכסונים',
    claim: 'במרובע יש שני אלכסונים',
    mathLine: '2 אלכסונים',
    explain: 'אלכסון ראשון נמתח בין שני קודקודים נגדיים. אחר כך נמתח האלכסון השני. במרובע יש 2 אלכסונים.',
  },
  'frac-product': {
    domain: 'שברים · כפל שברים',
    claim: 'חצי של שליש הוא שישית',
    mathLine: '½ × ⅓ = ⅙',
    explain: 'שליש וחצי נצבעים על אותו שלם, זה על זה. החפיפה ביניהם היא חצי מהשליש. זה חלק אחד מתוך שישה — שישית.',
  },
  'prime-rect': {
    domain: 'מספרים ראשוניים · סידור במלבן',
    claim: 'מספר ראשוני אי אפשר לסדר במלבן',
    mathLine: '2 × 3 = 6, ול־7 אין מלבן',
    explain: '6 נקודות מסתדרות במלבן של 2 על 3. 7 נקודות לא נכנסות לשום מלבן. לכן 7 הוא מספר ראשוני.',
  },
  // ── grade 7 ──
  triangle: {
    domain: 'שטח משולש · חצי מלבן',
    claim: 'שטח משולש הוא חצי מהמלבן שסביבו',
    mathLine: 'S = (a · h) : 2 = (6 × 4) : 2 = 12',
    explain: 'מלבן 6 על 4 שטחו 24, ואלכסון מראה שהמשולש הוא חצי ממנו. הקודקוד מחליק על קו מקביל לבסיס, והגובה לא משתנה. השטח נשאר 12.',
  },
  'order-ops': {
    domain: 'סדר פעולות חשבון · כפל לפני חיבור',
    claim: 'קודם כפל, אחר כך חיבור',
    mathLine: 'קודם כפל: 3 × 4 = 12, ואז 2 + 12 = 14',
    explain: 'בתרגיל מחשבים קודם את הכפל: 3 כפול 4 הם 12. אחר כך מוסיפים 2 ומקבלים 14. עם סוגריים סביב החיבור היה יוצא 20, ולכן התשובה היא 14.',
  },
  'peri-rect': {
    domain: 'היקף · היקף מלבן',
    claim: 'היקף הוא סכום כל הצלעות',
    mathLine: '6 + 4 + 6 + 4 = 20',
    explain: 'הולכים לאורך השפה של מלבן 6 על 4. כל צלע שעוברים נוספת לסכום. ההיקף הוא 20.',
  },
  'obtuse-ht': {
    domain: 'משולשים · גובה במשולש קהה־זווית',
    claim: 'במשולש קהה הגובה יכול ליפול מחוץ לו',
    mathLine: 'הגובה פוגש את המשך הבסיס ב־90°',
    explain: 'במשולש קהה־זווית יורד גובה אל הבסיס. הגובה עובר מחוץ לצורה. הוא פוגש את המשך הבסיס בזווית ישרה.',
  },
  'sup-angles': {
    domain: 'זוויות · זוויות צמודות',
    claim: 'זוויות צמודות משלימות ל־180°',
    mathLine: '60° + 120° = 180°',
    explain: 'זווית של 60° וזווית של 120° נצמדות זו לזו. יחד הן יוצרות קו ישר. הסכום שלהן 180°.',
  },
  'ratio-beads': {
    domain: 'יחס · הכפלה בשלם',
    claim: 'הכפלת שני חלקי היחס שומרת עליו',
    mathLine: '2 : 3 = 4 : 6',
    explain: 'יש 2 חרוזים מול 3 חרוזים. שני הצדדים מוכפלים פי 2, ומתקבלים 4 מול 6. היחס נשאר אותו יחס.',
  },
  'signed-jump': {
    domain: 'מספרים מכוונים · חיבור על הישר',
    claim: 'חיבור מספר חיובי הוא קפיצה ימינה',
    mathLine: '−2 + 5 = 3',
    explain: 'מתחילים במינוס 2 על ישר המספרים. קופצים 5 צעדים ימינה ועוברים דרך 0. מגיעים אל 3.',
  },
  'coord-walk': {
    domain: 'מערכת צירים · קואורדינטות',
    claim: 'קודם צועדים לאורך x, אחר כך לאורך y',
    mathLine: '(3, 2)',
    explain: 'נקודה יוצאת מראשית הצירים. היא צועדת 3 יחידות ימינה ואז 2 יחידות למעלה. היא מגיעה לנקודה שבה x הוא 3 ו־y הוא 2.',
  },
  'cube-8': {
    domain: 'נפח קובייה · חזקה שלישית',
    claim: 'קובייה שצלעה 2 בנויה מ־8 קוביות',
    mathLine: '2³ = 2 × 2 × 2 = 8',
    explain: 'קובייה שצלעה 2 נבנית מקוביות יחידה. בכל שכבה 2 על 2 קוביות, ויש 2 שכבות. יחד 8 קוביות.',
  },
  'box-vol': {
    domain: 'נפח · תיבה בקוביות יחידה',
    claim: 'נפח תיבה הוא אורך כפול רוחב כפול גובה',
    mathLine: '3 × 2 × 2 = 12',
    explain: 'קוביות יחידה ממלאות תיבה באורך 3, ברוחב 2 ובגובה 2. סופרים את כל הקוביות. נפח התיבה הוא 12.',
  },
  'signed-ops': {
    domain: 'סדר פעולות · מספרים מכוונים',
    claim: 'גם עם מספרים שליליים — כפל לפני חיבור',
    mathLine: 'קודם כפל: 2 × 4 = 8, ואז (−3) + 8 = 5',
    explain: 'גם כאן מחשבים קודם את הכפל: 2 כפול 4 הם 8. אחר כך מחברים מינוס 3 ועוד 8. התוצאה היא 5.',
  },
  'angle-sum': {
    domain: 'זוויות · סכום זוויות במשולש',
    claim: 'סכום הזוויות במשולש הוא 180°',
    mathLine: '∠ + ∠ + ∠ = 180°',
    explain: 'הבסיס נשאר קבוע והקודקוד יורד. זווית הקודקוד גדלה, ושתי זוויות הבסיס קטנות. הסכום נשאר 180°.',
  },
  'map-scale': {
    domain: 'קנה מידה · מהמפה למציאות',
    claim: 'מכפילים את האורך במפה בקנה המידה',
    mathLine: '4 × 5 = 20',
    explain: 'על המפה מסומן קטע באורך 4. הוא מוכפל לפי קנה המידה, פי 5. האורך במציאות הוא 20.',
  },
  'sq-stretch': {
    domain: 'מרובעים · ריבוע ומלבן',
    claim: 'ריבוע שנמתח למלבן נשאר עם 4 צלעות',
    mathLine: '4 צלעות',
    explain: 'ריבוע נמתח והופך למלבן. הצלעות משנות אורך, אבל אף צלע לא נוספת ולא נעלמת. למלבן יש 4 צלעות, כמו לריבוע.',
  },
  'rect-count': {
    domain: 'שטח והיקף · מלבן',
    claim: 'שטח סופרים בפנים, היקף סופרים על השפה',
    mathLine: 'S = 4 × 3 = 12, P = 2 × (4 + 3) = 14',
    explain: 'במלבן 4 על 3 סופרים את המשבצות שבפנים: יש 12, וזה השטח. אחר כך סופרים את השפה סביבו: 14 יחידות, וזה ההיקף.',
  },
  'l-split': {
    domain: 'שטח · צורה מורכבת',
    claim: 'מפרקים צורה מורכבת למלבנים ומחברים',
    mathLine: '12 + 4 = 16',
    explain: 'צורת L נפרדת לשני מלבנים, של 12 ושל 4. החלקים חוזרים למקומם. השטח של כל הצורה הוא 16.',
  },
  'trap-area': {
    domain: 'שטח · טרפז',
    claim: 'שטח טרפז: ממוצע הבסיסים כפול הגובה',
    mathLine: 'S = (6 + 2) : 2 × 3 = 12',
    explain: 'לטרפז בסיסים 6 ו־2 וגובה 3. קטע האמצעים שווה לממוצע הבסיסים, 4. כשכופלים אותו בגובה 3 מתקבל שטח 12.',
  },
  'para-rect': {
    domain: 'שטח · מקבילית ומלבן',
    claim: 'מקבילית שהופכת למלבן שומרת על שטחה',
    mathLine: 'הבסיס והגובה לא משתנים, ולכן השטח לא משתנה',
    explain: 'מקבילית נמתחת והופכת למלבן. הגובה שלה נשאר אותו גובה. לכן השטח לא משתנה.',
  },
  'angle-kinds': {
    domain: 'זוויות · חדה, ישרה וקהה',
    claim: 'ב־90° הזווית ישרה, ומעבר לזה קהה',
    mathLine: 'חדה: פחות מ־90°, ישרה: 90°, קהה: יותר מ־90°',
    explain: 'זווית חדה מתחילה להיפתח. ב־90° מופיע סימן הריבוע, וזו זווית ישרה. הפתיחה ממשיכה, והזווית הופכת לקהה.',
  },
  // ── grade 8 ──
  pythagoras: {
    domain: 'משפט פיתגורס · ריבועי הצלעות',
    claim: 'ריבועי הניצבים ממלאים את ריבוע היתר',
    mathLine: 'c² = 3² + 4² = 9 + 16 = 25, c = 5',
    explain: 'על הניצבים 3 ו־4 של משולש ישר־זווית בנויים ריבועים של 9 ו־16 משבצות. המשבצות עוברות וממלאות בדיוק את הריבוע שעל היתר. יש בו 25 משבצות, ולכן היתר הוא 5.',
  },
  'mean-cols': {
    domain: 'סטטיסטיקה · ממוצע',
    claim: 'הממוצע הוא הגובה שבו העמודות מתאזנות',
    mathLine: '(2 + 4 + 6) : 3 = 4',
    explain: 'יש שלוש עמודות בגובה 2, 4 ו־6. העמודות מתאזנות — מה שעודף בגבוהה עובר לנמוכה. כל אחת נעצרת על 4, הממוצע.',
  },
  'circ-unroll': {
    domain: 'מעגל · היקף',
    claim: 'היקף המעגל הוא קצת יותר משלושה קטרים',
    mathLine: 'P = πd ≈ 3.14d',
    explain: 'היקף המעגל נפרש לקו ישר. משווים את הקו לקוטר. הקו ארוך קצת משלושה קטרים — פי פאי.',
  },
  'corr-angles': {
    domain: 'ישרים מקבילים · זוויות מתאימות',
    claim: 'זוויות מתאימות בין ישרים מקבילים שוות',
    mathLine: 'זוויות מתאימות שוות',
    explain: 'חותך עובר דרך שני ישרים מקבילים. בכל נקודת חיתוך מסומנת זווית באותו מקום. שתי הזוויות המתאימות שוות.',
  },
  exterior: {
    domain: 'משולשים · זווית חיצונית',
    claim: 'זווית חיצונית שווה לשתי הפנימיות הרחוקות',
    mathLine: '90° + 60° = 150°',
    explain: 'המשך של צלע יוצר זווית חיצונית למשולש. שתי הזוויות הפנימיות שאינן צמודות לה הן 90° ו־60°. הזווית החיצונית שווה לסכומן, 150°.',
  },
  'sas-snap': {
    domain: 'חפיפת משולשים · צלע־זווית־צלע',
    claim: 'שתי צלעות והזווית שביניהן קובעות משולש',
    mathLine: 'צלע־זווית־צלע',
    explain: 'בשני משולשים מסומנות אותן שתי צלעות ואותה זווית שביניהן. משולש אחד זז ונצמד לשני. הם מתלכדים, ולכן המשולשים חופפים.',
  },
  'para-perp': {
    domain: 'ישרים · מקבילים ומאונכים',
    claim: 'מקבילים לא נפגשים, מאונכים נפגשים ב־90°',
    mathLine: 'מרחק שווה, זווית של 90°',
    explain: 'שני ישרים נשארים באותו מרחק זה מזה, ולכן הם מקבילים. שני ישרים אחרים נפגשים בזווית ישרה. הם מאונכים.',
  },
  similar: {
    domain: 'דמיון משולשים · הכפלת צלעות',
    claim: 'במשולשים דומים הזוויות נשארות שוות',
    mathLine: 'הצלעות גדלו פי 2, הזוויות לא השתנו',
    explain: 'משולש גדל פי 2, וכל הצלעות שלו מוכפלות. סימני הזוויות נשארים זהים. המשולשים דומים.',
  },
  'cyl-stack': {
    domain: 'נפח · גליל בשכבות',
    claim: 'נפח גליל הוא שטח הבסיס כפול הגובה',
    mathLine: 'V = B·h = 4B',
    explain: 'ארבע שכבות שוות נערמות וממלאות את הגליל. כל שכבה בגובה יחידה אחת, והגובה של הגליל הוא 4. הנפח הוא 4 פעמים שטח הבסיס.',
  },
  slope: {
    domain: 'פונקציה קווית · שיפוע',
    claim: 'שיפוע הוא כמה עולים בכל צעד ימינה',
    mathLine: 'm = 2 : 1 = 2',
    explain: 'על הישר עושים צעד אחד ימינה ושניים למעלה. אותו צעד חוזר לאורך הישר. השיפוע הוא 2.',
  },
  // ── grade 9 ──
  'area-model': {
    domain: 'כפל אלגברי · מודל שטח',
    claim: 'כל איבר כפול כל איבר — ארבעה תאים',
    mathLine: '(x+3)(x+2) = x² + 5x + 6',
    explain: 'מלבן שצלעותיו x ועוד 3 ו־x ועוד 2 מתחלק לארבעה תאים: x בריבוע, 2x, 3x ו־6. מאחדים את 2x ו־3x ל־5x. מתקבל x בריבוע ועוד 5x ועוד 6.',
  },
  'quad-tree': {
    domain: 'מרובעים · משפחת המרובעים',
    claim: 'ריבוע הוא גם מלבן וגם מעוין',
    mathLine: 'ריבוע הוא גם מלבן וגם מעוין',
    explain: 'לריבוע יש ארבע זוויות ישרות, כמו למלבן, וארבע צלעות שוות, כמו למעוין. לכן ריבוע הוא גם מלבן וגם מעוין.',
  },
  transform: {
    domain: 'טרנספורמציות · שיקוף, סיבוב והזזה',
    claim: 'שיקוף, סיבוב והזזה לא משנים את הצורה',
    mathLine: 'שיקוף, סיבוב ב־90° והזזה',
    explain: 'משולש משתקף סביב ישר. אחר כך הוא מסתובב 90° סביב נקודה, ולבסוף מוזז. בכל שלב הצורה נשארת חופפת למקור.',
  },
  'area-x4': {
    domain: 'שטח · הגדלה פי 2',
    claim: 'צלע כפולה נותנת שטח גדול פי 4',
    mathLine: 'צלע × 2, שטח × 4',
    explain: 'הצלע של הריבוע מוכפלת. בריבוע הגדול נכנסים ארבעה ריבועים כמו המקורי. השטח גדל פי 4.',
  },
  'two-coins': {
    domain: 'הסתברות · מרחב מדגם',
    claim: 'לשתי הטלות מטבע יש ארבע תוצאות שוות',
    // "4 = ¼" as one LTR run sits with the fraction beside מתוך. The word between them keeps reading order 4 then the fraction.
    mathLine: 'עץ־עץ: 1 מתוך 4 שווה ¼',
    explain: 'מטילים מטבע הוגן פעמיים. יש ארבע תוצאות שוות־הסתברות, ועץ־עץ היא אחת מהן. ההסתברות לשני עצים היא רבע.',
  },
  'diff-sq': {
    domain: 'אלגברה · הפרש ריבועים',
    claim: 'הפרש ריבועים מתפרק למכפלה של סכום והפרש',
    mathLine: 'x² − y² = (x − y) · (x + y)',
    explain: 'מריבוע שהצלע שלו x מורידים ריבוע שהצלע שלו y. החלק שנשאר נחתך ומסודר מחדש למלבן אחד. אורכו הוא סכום הצלעות, ורוחבו הוא ההפרש ביניהן.',
  },
  parab: {
    domain: 'פונקציה ריבועית · הזזה אנכית',
    claim: 'המספר שמוסיפים ל־x² מזיז את הקודקוד',
    mathLine: 'y = x² + 3',
    explain: 'הפרבולה זזה לאורך ציר y, והקודקוד זז איתה. המספר שליד הקודקוד מראה את הגובה שלו. כשמוסיפים 3, ה־y של הקודקוד הוא 3.',
  },
  'half-eq': {
    domain: 'משולשים מיוחדים · 30°–60°–90°',
    claim: 'מול זווית של 30° נמצא חצי מהיתר',
    mathLine: '80 = 160 : 2',
    explain: 'משולש שווה־צלעות נחצה לשניים. כל חצי הוא משולש של 30°, 60° ו־90°. הצלע שמול 30° היא חצי מהיתר: 80 מתוך 160.',
  },
};

const FALLBACK_COPY: GradeLoopCopy = {
  domain: 'הדגמה מתמטית',
  claim: 'הדגמה מתמטית',
  mathLine: '',
  explain: 'הדגמה קצרה של רעיון מרכזי בנושא, מתוך דפי העבודה במאגר.',
};

export function gradeLoopCopy(variant: string): GradeLoopCopy {
  return GRADE_LOOP_COPY[variant] ?? FALLBACK_COPY;
}

export function gradeLoopDomain(variant: string): string {
  return gradeLoopCopy(variant).domain;
}

/**
 * A formula run: starts and ends on a number, fraction, symbol or Latin letter,
 * never on Hebrew. Vulgar fractions and superscript/subscript digits count as
 * numbers, so a neutral-only string like "½ × ⅓ = ⅙" stays one LTR isolate
 * instead of taking the paragraph's RTL order.
 */
const MATH_ATOM = '\\d\\u00b9\\u00b2\\u00b3\\u00bc-\\u00be\\u2070\\u2074-\\u2079\\u2080-\\u2089\\u2150-\\u215e';
const MATH_RUN = new RegExp(
  `[${MATH_ATOM}(−\\-a-zA-Z□∠√π][${MATH_ATOM}\\sa-zA-Z×÷+\\-−=<>≈≠·.,/()°□∠√π:→%\\u2044]*[${MATH_ATOM})a-zA-Z°□%]|[${MATH_ATOM}]`,
  'g',
);

/**
 * Splits a caption into prose and formula runs. Formula runs render as
 * dir="ltr" isolates, so a Hebrew caption keeps RTL order and each formula
 * keeps its own order.
 */
export function gradeLoopMathParts(line: string): Array<{ text: string; math: boolean }> {
  const parts: Array<{ text: string; math: boolean }> = [];
  let at = 0;
  for (const match of line.matchAll(MATH_RUN)) {
    const start = match.index ?? 0;
    if (start > at) parts.push({ text: line.slice(at, start), math: false });
    parts.push({ text: match[0], math: true });
    at = start + match[0].length;
  }
  if (at < line.length) parts.push({ text: line.slice(at), math: false });
  return parts;
}

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
  'area-model': 7.5, 'quad-tree': 5.4, transform: 6.8, 'area-x4': 5.2, 'two-coins': 5.2, 'diff-sq': 20.5,
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
    ...gradeLoopCopy(loop.variant),
    hold: GRADE_LOOP_HOLD_S[loop.variant],
  }));
  const defaultVariant = GRADE_LOOP_DEFAULTS[grade];
  return [
    ...pool.filter((entry) => entry.variant === defaultVariant),
    ...pool.filter((entry) => entry.variant !== defaultVariant),
  ];
}
