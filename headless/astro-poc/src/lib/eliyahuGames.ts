/**
 * The games corner.
 *
 * Every game is one self-contained HTML document built from the shared engine
 * in src/games/engine plus a spec in src/games/specs. The wrapper page at
 * /games/<slug> is the canonical, indexable page; /games/<slug>/play serves the
 * raw document for the iframe and stays out of the index.
 *
 * The two older games (eliyahu-pythagoras, kefel-mekutsar-2) keep their own
 * hand-written files and routes; they are listed here so the corner shows them.
 */
export type GameTheme = {
  ink: string;
  main: string;
  mainDark: string;
  mainSoft: string;
  mainLine: string;
  bgA: string;
  bgB: string;
  bgC: string;
};

export type GameLink = { href: string; label: string };

/**
 * A catalog topic the game teaches: `grade` and `topic` are the grade and the
 * topic id in src/data/catalog.v1.json, the same pair a worksheet link carries
 * (`/worksheets?grade=…&topic=…`).
 *
 * `full` means the game's scenes and questions reach every part of the topic
 * as the catalog describes it. `partial` means it teaches one route through a
 * wider topic, so the topic still needs more routes before it counts as
 * covered. A link alone never makes a topic covered.
 */
export type GameTopicRef = { grade: number; topic: number; coverage: 'full' | 'partial' };

export type EliyahuGame = {
  /** Last path segment under /games. */
  slug: string;
  /** Browser title of the wrapper page. */
  title: string;
  /** H1 of the wrapper page and of the game document. */
  h1: string;
  /** Meta description, shared by the page and the document. */
  description: string;
  /** One line on the corner card. */
  short: string;
  /** Hebrew grade band shown on the card. */
  grade: string;
  /** Sort key for the corner: the first grade the game fits. */
  gradeOrder: number;
  /** Card emoji. */
  emoji: string;
  /** Worksheet pages this game belongs to. */
  links: GameLink[];
  /** Catalog topics this game teaches; drives the coverage map in gameCoverage.ts. */
  topics: GameTopicRef[];
  /** Palette, injected as custom properties into the document. */
  theme: GameTheme;
  /**
   * `engine` games are composed from src/games/specs/<slug>.js.
   * `legacy` games keep their own route and HTML file.
   */
  kind: 'engine' | 'legacy';
  /** Path of the playable document. */
  playPath: string;
  /** Short label kept on the corner card, such as (beta). */
  badge?: string;
};

const INDIGO: GameTheme = {
  ink: '#1e1b4b', main: '#4338ca', mainDark: '#312e81', mainSoft: '#ecebfe',
  mainLine: '#b9b2ee', bgA: '#edecfd', bgB: '#f6f5f1', bgC: '#fdeee4'
};
const TEAL: GameTheme = {
  ink: '#10302e', main: '#1a8a80', mainDark: '#0f5f58', mainSoft: '#dff5f2',
  mainLine: '#8fd3cb', bgA: '#e6f5f2', bgB: '#f6f5f1', bgC: '#fdf3e4'
};
const PLUM: GameTheme = {
  ink: '#3b1142', main: '#9333ea', mainDark: '#6b21a8', mainSoft: '#f4e8ff',
  mainLine: '#d5b0f5', bgA: '#f6edfd', bgB: '#f7f5f2', bgC: '#fdeef4'
};
const EMBER: GameTheme = {
  ink: '#431407', main: '#c2410c', mainDark: '#7c2d12', mainSoft: '#ffe9dd',
  mainLine: '#f6b795', bgA: '#fdeee4', bgB: '#f7f5f1', bgC: '#fdf6e5'
};
const OCEAN: GameTheme = {
  ink: '#0c2340', main: '#1d4ed8', mainDark: '#1e3a8a', mainSoft: '#e2ecff',
  mainLine: '#a3c0f5', bgA: '#e8f0fe', bgB: '#f6f6f2', bgC: '#eef7f4'
};
const FOREST: GameTheme = {
  ink: '#14321f', main: '#15803d', mainDark: '#14532d', mainSoft: '#ddf6e5',
  mainLine: '#8fd6a8', bgA: '#e8f7ec', bgB: '#f7f6f1', bgC: '#fdf3e6'
};
const ROSE: GameTheme = {
  ink: '#4c0519', main: '#be123c', mainDark: '#881337', mainSoft: '#ffe4ec',
  mainLine: '#f6a8c0', bgA: '#fdeaf1', bgB: '#f8f5f2', bgC: '#fdf5e6'
};
const SLATE: GameTheme = {
  ink: '#1e293b', main: '#475569', mainDark: '#334155', mainSoft: '#e8edf5',
  mainLine: '#b3c0d4', bgA: '#eef2f8', bgB: '#f7f6f3', bgC: '#f3f0ea'
};
const AMBER: GameTheme = {
  ink: '#422006', main: '#b45309', mainDark: '#78350f', mainSoft: '#fdf0d8',
  mainLine: '#eeca8e', bgA: '#fdf4e3', bgB: '#f7f5f0', bgC: '#f1f7ef'
};
const CYAN: GameTheme = {
  ink: '#083344', main: '#0e7490', mainDark: '#164e63', mainSoft: '#ddf2f8',
  mainLine: '#8ed2e4', bgA: '#e6f4f9', bgB: '#f6f6f2', bgC: '#fdf1ea'
};

/** The engine games, in corner order. */
export const ENGINE_GAMES: EliyahuGame[] = [
  {
    slug: 'luach-hakefel',
    title: 'משחק סוד לוח הכפל עם אליהו | נועם דורון',
    h1: 'משחק סוד לוח הכפל עם אליהו',
    description: 'שיעור קצר עם אליהו: רואים את הכפל כשטח, ומפרקים תרגיל קשה לשניים קלים.',
    short: 'רואים כפל כמלבן, ומפרקים תרגיל קשה לשניים קלים.',
    grade: 'כיתות ג׳–ד׳',
    gradeOrder: 3,
    emoji: '🟦',
    links: [
      { href: '/multiplication-facts-arrays-grade-3', label: 'עובדות הכפל והמערכים לכיתה ג׳' },
      { href: '/multiplication-multi-digit-grade-4', label: 'כפל רב־ספרתי לכיתה ד׳' }
    ],
    topics: [{ grade: 3, topic: 9, coverage: 'partial' }, { grade: 4, topic: 9, coverage: 'partial' }],
    theme: OCEAN,
    kind: 'engine',
    playPath: '/games/luach-hakefel/play'
  },
  {
    slug: 'shivrim-shkulim',
    title: 'משחק שברים שקולים עם אליהו | נועם דורון',
    h1: 'משחק שברים שקולים עם אליהו',
    description: 'שיעור קצר עם אליהו: למה חצי ושני רבעים הם אותו דבר — ואיך משווים שברים בלי לטעות.',
    short: 'חותכים את הפס לחתיכות קטנות יותר, והשבר נשאר אותו שבר.',
    grade: 'כיתות ד׳–ה׳',
    gradeOrder: 4,
    emoji: '🍫',
    links: [
      { href: '/equivalent-fractions-grade-4', label: 'שברים שקולים לכיתה ד׳' },
      { href: '/compare-fractions-decimals-grade-5', label: 'השוואת שברים לכיתה ה׳' }
    ],
    topics: [{ grade: 4, topic: 13, coverage: 'partial' }, { grade: 5, topic: 29, coverage: 'partial' }],
    theme: PLUM,
    kind: 'engine',
    playPath: '/games/shivrim-shkulim/play'
  },
  {
    slug: 'shetach-vehekef',
    title: 'משחק שטח והיקף עם אליהו | נועם דורון',
    h1: 'משחק שטח והיקף עם אליהו',
    description: 'שיעור קצר עם אליהו: בונים מלבנים על רשת ומגלים ששטח זהה לא אומר היקף זהה.',
    short: 'אותו שטח, היקף אחר. בונים על הרשת ורואים.',
    grade: 'כיתות ד׳–ה׳',
    gradeOrder: 4,
    emoji: '📏',
    links: [
      { href: '/area-perimeter-rectangle-grade-4', label: 'שטח והיקף המלבן לכיתה ד׳' },
      { href: '/area-perimeter-rectangles-grade-5', label: 'שטח והיקף לכיתה ה׳' }
    ],
    topics: [{ grade: 4, topic: 22, coverage: 'partial' }, { grade: 5, topic: 25, coverage: 'partial' }],
    theme: FOREST,
    kind: 'engine',
    playPath: '/games/shetach-vehekef/play'
  },
  {
    slug: 'erech-hamakom',
    title: 'משחק ערך המקום והמספר העשרוני עם אליהו | נועם דורון',
    h1: 'משחק ערך המקום והמספר העשרוני עם אליהו',
    description: 'שיעור קצר עם אליהו: מה באמת קורה לספרות כשכופלים ומחלקים ב־10.',
    short: 'הספרות זזות, הנקודה נשארת. כפל וחילוק בעשר בעיניים.',
    grade: 'כיתה ה׳',
    gradeOrder: 5,
    emoji: '🔢',
    links: [
      { href: '/decimal-place-value-grade-5', label: 'ערך המקום במספר עשרוני לכיתה ה׳' },
      { href: '/add-subtract-decimals-grade-5', label: 'חיבור וחיסור עשרוניים לכיתה ה׳' }
    ],
    topics: [{ grade: 5, topic: 28, coverage: 'partial' }, { grade: 5, topic: 30, coverage: 'partial' }],
    theme: CYAN,
    kind: 'engine',
    playPath: '/games/erech-hamakom/play'
  },
  {
    slug: 'nefach-tevah',
    title: 'משחק נפח ושטח פנים של תיבה עם אליהו | נועם דורון',
    h1: 'משחק נפח ושטח פנים של תיבה עם אליהו',
    description: 'שיעור קצר עם אליהו: פותחים את התיבה לפריסה ורואים מאיפה מגיעים הנפח ושטח הפנים.',
    short: 'התיבה נפתחת לפריסה — ושטח הפנים פתאום ברור.',
    grade: 'כיתה ו׳',
    gradeOrder: 6,
    emoji: '📦',
    links: [
      { href: '/box-volume-grade-6', label: 'נפח התיבה לכיתה ו׳' },
      { href: '/box-surface-area-grade-6', label: 'שטח פנים של תיבה לכיתה ו׳' }
    ],
    topics: [{ grade: 6, topic: 14, coverage: 'partial' }, { grade: 6, topic: 13, coverage: 'partial' }],
    theme: AMBER,
    kind: 'engine',
    playPath: '/games/nefach-tevah/play'
  },
  {
    slug: 'achuzim',
    title: 'משחק אחוזים בחיים עם אליהו | נועם דורון',
    h1: 'משחק אחוזים בחיים עם אליהו',
    description: 'שיעור קצר עם אליהו: רשת של מאה משבצות שמסבירה הנחות, מע״מ ואחוז מתוך כמות.',
    short: 'מאה משבצות שמסבירות כל הנחה בחנות.',
    grade: 'כיתות ו׳–ז׳',
    gradeOrder: 6,
    emoji: '🏷️',
    links: [
      { href: '/percent-of-quantity-grade-6', label: 'אחוז מתוך כמות לכיתה ו׳' },
      { href: '/fraction-decimal-percent-grade-6', label: 'שבר, עשרוני ואחוז לכיתה ו׳' }
    ],
    topics: [{ grade: 6, topic: 19, coverage: 'partial' }, { grade: 6, topic: 18, coverage: 'partial' }],
    theme: ROSE,
    kind: 'engine',
    playPath: '/games/achuzim/play'
  },
  {
    slug: 'maznayim',
    title: 'משחק משוואות על מאזניים עם אליהו | נועם דורון',
    h1: 'משחק משוואות על מאזניים עם אליהו',
    description: 'שיעור קצר עם אליהו: כל פעולה במשוואה היא פעולה על שתי הכפות. רואים את זה על מאזניים.',
    short: 'מה שעושים לצד אחד — עושים לשני. אחרת המאזניים נופלים.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '⚖️',
    links: [
      { href: '/equations-basics-grade-7', label: 'יסודות המשוואה לכיתה ז׳' },
      { href: '/equations-advanced-grade-7', label: 'משוואות מתקדמות לכיתה ז׳' }
    ],
    topics: [{ grade: 7, topic: 34, coverage: 'partial' }],
    theme: TEAL,
    kind: 'engine',
    playPath: '/games/maznayim/play'
  },
  {
    slug: 'tzayid-hazaviyot',
    title: 'משחק ציד הזוויות עם אליהו | נועם דורון',
    h1: 'משחק ציד הזוויות עם אליהו',
    description: 'שיעור קצר עם אליהו: זוויות צמודות, קודקודיות ומתאימות — ואיך מוצאים זווית בלי מד־זווית.',
    short: 'זווית אחת ידועה. כל השאר מתגלות בשרשרת.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '📐',
    links: [
      { href: '/adjacent-vertical-angles-grade-7', label: 'זוויות צמודות וקודקודיות לכיתה ז׳' },
      { href: '/parallel-lines-angles-grade-8', label: 'זוויות במקבילים לכיתה ח׳' }
    ],
    topics: [{ grade: 7, topic: 12, coverage: 'partial' }, { grade: 8, topic: 62, coverage: 'partial' }],
    theme: EMBER,
    kind: 'engine',
    playPath: '/games/tzayid-hazaviyot/play'
  },
  {
    slug: 'misparim-shliliim',
    title: 'משחק מספרים שליליים עם אליהו | נועם דורון',
    h1: 'משחק מספרים שליליים עם אליהו',
    description: 'שיעור קצר עם אליהו: ציר המספרים כמעלית — חיבור וחיסור של שליליים בלי בלבול.',
    short: 'מעלית שעולה ויורדת. מינוס מינוס סוף סוף מובן.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '🛗',
    links: [
      { href: '/signed-numbers-grade-7', label: 'מספרים מכוונים לכיתה ז׳' },
      { href: '/number-line-absolute-value-grade-7', label: 'ציר המספרים וערך מוחלט לכיתה ז׳' }
    ],
    topics: [{ grade: 7, topic: 2, coverage: 'partial' }, { grade: 7, topic: 1, coverage: 'partial' }],
    theme: SLATE,
    kind: 'engine',
    playPath: '/games/misparim-shliliim/play'
  },
  {
    slug: 'shipua-kavi',
    title: 'משחק השיפוע של הפונקציה הקווית עם אליהו | נועם דורון',
    h1: 'משחק השיפוע של הפונקציה הקווית עם אליהו',
    description: 'שיעור קצר עם אליהו: מזיזים ישר בגרירה, בכפתורים או בחיצים, ורואים מה עושים m ו־b לגרף.',
    short: 'מזיזים את הישר בגרירה, בכפתורים או בחיצים, והנוסחה משתנה איתו.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '📈',
    links: [
      { href: '/linear-function-grade-8', label: 'הפונקציה הקווית לכיתה ח׳' },
      { href: '/linear-function-grade-9', label: 'הפונקציה הקווית לכיתה ט׳' }
    ],
    topics: [{ grade: 8, topic: 29, coverage: 'partial' }, { grade: 9, topic: 34, coverage: 'partial' }],
    theme: INDIGO,
    kind: 'engine',
    playPath: '/games/shipua-kavi/play'
  },
  {
    slug: 'mapat-hatsirim',
    title: 'משחק מפת הצירים וקנה המידה עם אליהו | נועם דורון',
    h1: 'משחק מפת הצירים וקנה המידה עם אליהו',
    description: 'שיעור קצר עם אליהו: מזיזים נקודה על מערכת צירים בגרירה, בכפתורים או בחיצים, קוראים את שיעוריה ובוחרים קנה מידה שמכניס את כל הנקודות למפה.',
    short: 'בוחרים קנה מידה, וכל הנקודות נכנסות למפה.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '🗺️',
    links: [{ href: '/coordinate-plane-scale-grade-7', label: 'מערכת צירים וקנה מידה לכיתה ז׳' }],
    topics: [{ grade: 7, topic: 8, coverage: 'full' }],
    theme: OCEAN,
    kind: 'engine',
    playPath: '/games/mapat-hatsirim/play'
  },
  {
    slug: 'bituyim-shkulim',
    title: 'משחק כינוס איברים וחוק הפילוג עם אליהו | נועם דורון',
    h1: 'משחק כינוס איברים וחוק הפילוג עם אליהו',
    description: 'שיעור קצר עם אליהו: פותחים סוגריים, ממיינים איברים דומים ומגלים מתי שני ביטויים שקולים באמת.',
    short: 'פותחים חבילות, ממיינים כרטיסים ומקבלים ביטוי שקול.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '🧪',
    links: [{ href: '/combining-like-terms-grade-7', label: 'כינוס איברים וחוק הפילוג לכיתה ז׳' }],
    topics: [{ grade: 7, topic: 29, coverage: 'full' }],
    theme: PLUM,
    kind: 'engine',
    playPath: '/games/bituyim-shkulim/play'
  },
  {
    slug: 'sadnat-hayachasim',
    title: 'משחק יחס ופרופורציה עם אליהו | נועם דורון',
    h1: 'משחק יחס ופרופורציה עם אליהו',
    description: 'שיעור קצר עם אליהו: משכפלים חבילות של אסימונים, מחלקים כמות לפי יחס ומבחינים בין פרופורציה ישרה להפוכה.',
    short: 'חבילה אחת של יחס, משוכפלת עד שהכמות מתחלקת.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '🧮',
    links: [{ href: '/ratio-proportion-grade-8', label: 'יחס ופרופורציה לכיתה ח׳' }],
    topics: [{ grade: 8, topic: 4, coverage: 'full' }],
    theme: AMBER,
    kind: 'engine',
    playPath: '/games/sadnat-hayachasim/play'
  },
  {
    slug: 'chatsiyon',
    title: 'משחק החציון עם אליהו | נועם דורון',
    h1: 'משחק החציון עם אליהו',
    description: 'שיעור קצר עם אליהו: מסדרים כרטיסי נתונים, מוצאים את האמצע ומשווים בין החציון לממוצע כשמופיע ערך קיצוני.',
    short: 'מסדרים את הכרטיסים, והאמצע מתגלה.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '🎯',
    links: [{ href: '/median-grade-8', label: 'החציון לכיתה ח׳' }],
    topics: [{ grade: 8, topic: 24, coverage: 'full' }],
    theme: ROSE,
    kind: 'engine',
    playPath: '/games/chatsiyon/play'
  },
  {
    slug: 'sadnat-hagormim',
    title: 'משחק פירוק לגורמים עם אליהו | נועם דורון',
    h1: 'משחק פירוק לגורמים עם אליהו',
    description: 'שיעור קצר עם אליהו: מוציאים גורם משותף, מפרקים טרינום למכפלה ופותרים משוואה עם שבר אלגברי בלי לאבד את תחום ההגדרה.',
    short: 'הופכים סכום למכפלה, ופותחים בחזרה כדי לבדוק.',
    grade: 'כיתה ט׳',
    gradeOrder: 9,
    emoji: '🔧',
    links: [{ href: '/factoring-grade-9', label: 'פירוק לגורמים לכיתה ט׳' }],
    topics: [
      { grade: 9, topic: 2, coverage: 'partial' },
      { grade: 9, topic: 41, coverage: 'partial' },
      { grade: 9, topic: 42, coverage: 'partial' },
      { grade: 9, topic: 43, coverage: 'partial' }
    ],
    theme: FOREST,
    kind: 'engine',
    playPath: '/games/sadnat-hagormim/play'
  },
  {
    slug: 'maabadat-haparabolot',
    title: 'משחק הפונקציה הריבועית עם אליהו | נועם דורון',
    h1: 'משחק הפונקציה הריבועית עם אליהו',
    description: 'שיעור קצר עם אליהו: מזיזים את קודקוד הפרבולה בגרירה, בכפתורים או בחיצים, מוצאים אפסים וציר סימטריה ובודקים איפה ישר חותך את הגרף.',
    short: 'מזיזים את הקודקוד בגרירה, בכפתורים או בחיצים, והנוסחה זזה איתו.',
    grade: 'כיתה ט׳',
    gradeOrder: 9,
    emoji: '🎢',
    links: [{ href: '/quadratic-function-grade-9', label: 'הפונקציה הריבועית לכיתה ט׳' }],
    topics: [{ grade: 9, topic: 5, coverage: 'partial' }],
    theme: INDIGO,
    kind: 'engine',
    playPath: '/games/maabadat-haparabolot/play'
  },
  {
    slug: 'chok-hasimanim',
    title: 'משחק חוק הסימנים עם אליהו | נועם דורון',
    h1: 'משחק חוק הסימנים עם אליהו',
    description: 'שיעור קצר עם אליהו: למה מינוס כפול מינוס יוצא פלוס, איך סופרים סימנים במכפלה ובחילוק ומה קורה בביטוי עם סוגריים.',
    short: 'סופרים כמה מינוסים יש, ויודעים מראש מה הסימן.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '➖',
    links: [
      { href: '/multiplying-signed-numbers-grade-7', label: 'כפל מספרים מכוונים לכיתה ז׳' },
      { href: '/dividing-signed-numbers-grade-7', label: 'חילוק מספרים מכוונים לכיתה ז׳' },
      { href: '/order-of-operations-signed-numbers-grade-7', label: 'סדר פעולות במספרים מכוונים לכיתה ז׳' }
    ],
    topics: [
      { grade: 7, topic: 3, coverage: 'full' },
      { grade: 7, topic: 4, coverage: 'full' },
      { grade: 7, topic: 5, coverage: 'partial' }
    ],
    theme: EMBER,
    kind: 'engine',
    playPath: '/games/chok-hasimanim/play'
  },
  {
    slug: 'migdal-hechezkot',
    title: 'משחק החזקות והשורש הריבועי עם אליהו | נועם דורון',
    h1: 'משחק החזקות והשורש הריבועי עם אליהו',
    description: 'שיעור קצר עם אליהו: בונים ריבוע מאריחים, רואים מה עושה המעריך, ולומדים איך השורש הריבועי מחזיר אותנו אל הצלע.',
    short: 'בונים ריבוע מאריחים, וחוזרים ממנו אל הצלע.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '🧱',
    links: [
      { href: '/powers-grade-7', label: 'חזקות לכיתה ז׳' },
      { href: '/square-root-grade-7', label: 'שורש ריבועי לכיתה ז׳' }
    ],
    topics: [
      { grade: 7, topic: 6, coverage: 'full' },
      { grade: 7, topic: 7, coverage: 'full' }
    ],
    theme: AMBER,
    kind: 'engine',
    playPath: '/games/migdal-hechezkot/play'
  },
  {
    slug: 'schum-hazaviyot',
    title: 'משחק סכום הזוויות במשולש ובמרובע עם אליהו | נועם דורון',
    h1: 'משחק סכום הזוויות במשולש ובמרובע עם אליהו',
    description: 'שיעור קצר עם אליהו: מצמידים את שלוש פינות המשולש לקו ישר, מגלים את הזווית החיצונית ומחלקים מרובע לשני משולשים.',
    short: 'שלוש הפינות של המשולש מתיישרות לקו אחד.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '📐',
    links: [{ href: '/triangle-quadrilateral-angle-sum-grade-7', label: 'סכום הזוויות במשולש ובמרובע לכיתה ז׳' }],
    topics: [{ grade: 7, topic: 14, coverage: 'full' }],
    theme: TEAL,
    kind: 'engine',
    playPath: '/games/schum-hazaviyot/play'
  },
  {
    slug: 'maznayim-2',
    title: 'משחק המשוואות בשני שלבים עם אליהו | נועם דורון',
    h1: 'משחק המשוואות בשני שלבים עם אליהו',
    description: 'שיעור קצר עם אליהו: מורידים את אותו דבר משני הצדדים, מבודדים את הנעלם גם כשהוא בשני האגפים, ובודקים את הפתרון.',
    short: 'אותו דבר משני הצדדים, עד ש־x נשאר לבד.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '⚖️',
    links: [
      { href: '/two-step-equations-grade-7', label: 'משוואות דו־שלביות לכיתה ז׳' },
      { href: '/equations-both-sides-word-problems-grade-7', label: 'הנעלם בשני האגפים לכיתה ז׳' }
    ],
    topics: [
      { grade: 7, topic: 35, coverage: 'full' },
      { grade: 7, topic: 39, coverage: 'full' }
    ],
    theme: OCEAN,
    kind: 'engine',
    playPath: '/games/maznayim-2/play'
  },
  {
    slug: 'maabadat-hakubiyot',
    title: 'משחק ההסתברות והקובייה עם אליהו | נועם דורון',
    h1: 'משחק ההסתברות והקובייה עם אליהו',
    description: 'שיעור קצר עם אליהו: בונים את מרחב התוצאות, מטילים קובייה שוב ושוב ורואים איך השכיחות היחסית מתקרבת אל ההסתברות.',
    short: 'מטילים הרבה פעמים, והמספרים מתיישבים.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '🎲',
    links: [
      { href: '/probability-introduction-grade-7', label: 'הסתברות לכיתה ז׳' },
      { href: '/relative-frequency-experiments-grade-7', label: 'שכיחות יחסית וניסויים לכיתה ז׳' }
    ],
    topics: [
      { grade: 7, topic: 28, coverage: 'full' },
      { grade: 7, topic: 27, coverage: 'full' },
      { grade: 7, topic: 26, coverage: 'partial' }
    ],
    theme: CYAN,
    kind: 'engine',
    playPath: '/games/maabadat-hakubiyot/play'
  },
  {
    slug: 'mechonat-hapunktsiyot',
    title: 'משחק מכונת הפונקציות עם אליהו | נועם דורון',
    h1: 'משחק מכונת הפונקציות עם אליהו',
    description: 'שיעור קצר עם אליהו: מכניסים מספר למכונה, מגלים את הכלל, כותבים אותו בסימון f(x) ובודקים מה כן פונקציה ומה לא.',
    short: 'מכניסים מספר, מקבלים תוצאה, ומגלים את הכלל.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '⚙️',
    links: [
      { href: '/function-concept-grade-8', label: 'מושג הפונקציה לכיתה ח׳' },
      { href: '/function-notation-grade-8', label: 'סימון פונקציה לכיתה ח׳' }
    ],
    topics: [
      { grade: 8, topic: 19, coverage: 'full' },
      { grade: 8, topic: 20, coverage: 'full' }
    ],
    theme: PLUM,
    kind: 'engine',
    playPath: '/games/mechonat-hapunktsiyot/play'
  },
  {
    slug: 'shnei-yesharim',
    title: 'משחק מערכת שתי המשוואות עם אליהו | נועם דורון',
    h1: 'משחק מערכת שתי המשוואות עם אליהו',
    description: 'שיעור קצר עם אליהו: מזיזים שני ישרים עד שהם נפגשים, קוראים את נקודת החיתוך ומוצאים אותה שוב בדרך האלגברית.',
    short: 'שני ישרים, נקודה אחת שמתאימה לשניהם.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '🎯',
    links: [
      { href: '/systems-of-equations-grade-8', label: 'מערכת משוואות לכיתה ח׳' },
      { href: '/systems-algebraic-solution-grade-8', label: 'פתרון אלגברי של מערכת לכיתה ח׳' }
    ],
    topics: [
      { grade: 8, topic: 47, coverage: 'full' },
      { grade: 8, topic: 48, coverage: 'partial' }
    ],
    theme: SLATE,
    kind: 'engine',
    playPath: '/games/shnei-yesharim/play'
  },
  {
    slug: 'nuschat-hashorashim',
    title: 'משחק המשוואה הריבועית ונוסחת השורשים עם אליהו | נועם דורון',
    h1: 'משחק המשוואה הריבועית ונוסחת השורשים עם אליהו',
    description: 'שיעור קצר עם אליהו: רואים איפה הפרבולה חותכת את הציר, מציבים בנוסחת השורשים ובודקים מה הדיסקרימיננטה מספרת.',
    short: 'הדיסקרימיננטה מגלה כמה פתרונות יש, עוד לפני החישוב.',
    grade: 'כיתה ט׳',
    gradeOrder: 9,
    emoji: '🔎',
    links: [{ href: '/quadratic-equations-grade-9', label: 'משוואות ריבועיות לכיתה ט׳' }],
    topics: [{ grade: 9, topic: 6, coverage: 'full' }],
    theme: ROSE,
    kind: 'engine',
    playPath: '/games/nuschat-hashorashim/play'
  },
  {
    slug: 'gozrim-umadbikim',
    title: 'משחק שטח המקבילית, הטרפז והמצולע המורכב עם אליהו | נועם דורון',
    h1: 'משחק שטח המקבילית, הטרפז והמצולע המורכב עם אליהו',
    description: 'שיעור קצר עם אליהו: גוזרים משולש מהמקבילית והופכים אותה למלבן, מצמידים שני טרפזים למקבילית, ומפרקים מצולע מורכב לצורות מוכרות.',
    short: 'גוזרים, מזיזים ומדביקים — והנוסחה של השטח מתגלה לבד.',
    grade: 'כיתות ז׳–ט׳',
    gradeOrder: 7,
    emoji: '✂️',
    links: [
      { href: '/area-parallelogram-trapezoid-composite-grade-7', label: 'שטח מקבילית, טרפז ומצולע מורכב לכיתה ז׳' },
      { href: '/parallelogram-trapezoid-area-grade-9', label: 'שטח מקבילית וטרפז לכיתה ט׳' },
      { href: '/composite-polygons-area-grade-9', label: 'שטח מצולעים מורכבים לכיתה ט׳' }
    ],
    topics: [
      { grade: 7, topic: 45, coverage: 'full' },
      { grade: 7, topic: 46, coverage: 'full' },
      { grade: 9, topic: 28, coverage: 'partial' },
      { grade: 9, topic: 29, coverage: 'partial' }
    ],
    theme: AMBER,
    kind: 'engine',
    playPath: '/games/gozrim-umadbikim/play'
  },
  {
    slug: 'bonim-minsara',
    title: 'משחק התיבה והמנסרה המשולשת עם אליהו | נועם דורון',
    h1: 'משחק התיבה והמנסרה המשולשת עם אליהו',
    description: 'שיעור קצר עם אליהו: ממלאים תיבה בשכבות של קוביות, חוצים אותה למנסרה משולשת, ופורסים את המנסרה כדי לחשב את שטח הפנים.',
    short: 'שטח הבסיס כפול הגובה — בתיבה ובמנסרה.',
    grade: 'כיתות ז׳–ט׳',
    gradeOrder: 7,
    emoji: '🧊',
    links: [
      { href: '/box-and-cube-grade-7', label: 'תיבה וקובייה לכיתה ז׳' },
      { href: '/solids-box-cube-prism-grade-7', label: 'מנסרה משולשת לכיתה ז׳' },
      { href: '/triangular-prism-volume-grade-9', label: 'נפח המנסרה המשולשת לכיתה ט׳' },
      { href: '/triangular-prism-surface-area-grade-9', label: 'שטח הפנים של המנסרה לכיתה ט׳' }
    ],
    topics: [
      { grade: 7, topic: 20, coverage: 'partial' },
      { grade: 7, topic: 47, coverage: 'full' },
      { grade: 7, topic: 48, coverage: 'full' },
      { grade: 9, topic: 30, coverage: 'partial' },
      { grade: 9, topic: 31, coverage: 'partial' }
    ],
    theme: CYAN,
    kind: 'engine',
    playPath: '/games/bonim-minsara/play'
  },
  {
    slug: 'shinui-baachuzim',
    title: 'משחק שינוי באחוזים ושינויים עוקבים עם אליהו | נועם דורון',
    h1: 'משחק שינוי באחוזים ושינויים עוקבים עם אליהו',
    description: 'שיעור קצר עם אליהו: הופכים עלייה וירידה באחוזים לכפל, מחשבים אחוז שינוי, ומגלים למה עלייה וירידה של 10% לא מחזירות לאותו מחיר.',
    short: 'עלייה של 20% היא כפל ב־1.2 — וכך גם שני שינויים ברצף.',
    grade: 'כיתות ח׳–ט׳',
    gradeOrder: 8,
    emoji: '🏷️',
    links: [
      { href: '/percent-change-grade-8', label: 'שינוי באחוזים לכיתה ח׳' },
      { href: '/successive-percent-changes-grade-8', label: 'שינויים עוקבים לכיתה ח׳' },
      { href: '/percentage-problems-grade-8', label: 'בעיות אחוזים לכיתה ח׳' },
      { href: '/percentages-grade-9', label: 'אחוזים לכיתה ט׳' }
    ],
    topics: [
      { grade: 8, topic: 6, coverage: 'partial' },
      { grade: 8, topic: 7, coverage: 'partial' },
      { grade: 8, topic: 8, coverage: 'full' },
      { grade: 8, topic: 9, coverage: 'full' },
      { grade: 9, topic: 53, coverage: 'full' }
    ],
    theme: ROSE,
    kind: 'engine',
    playPath: '/games/shinui-baachuzim/play'
  },
  {
    slug: 'maazan-hamemutsa',
    title: 'משחק הממוצע, הטווח ובחירת המדד עם אליהו | נועם דורון',
    h1: 'משחק הממוצע, הטווח ובחירת המדד עם אליהו',
    description: 'שיעור קצר עם אליהו: מיישרים מגדלי קוביות כדי לראות מהו ממוצע, מוצאים נתון חסר, משווים פיזור בעזרת הטווח ובוחרים את המדד המתאים.',
    short: 'מיישרים את המגדלים — והממוצע מופיע.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '📊',
    links: [
      { href: '/mean-grade-8', label: 'הממוצע לכיתה ח׳' },
      { href: '/data-range-grade-8', label: 'טווח הנתונים לכיתה ח׳' },
      { href: '/choosing-measure-of-center-grade-8', label: 'בחירת מדד לכיתה ח׳' }
    ],
    topics: [
      { grade: 8, topic: 22, coverage: 'full' },
      { grade: 8, topic: 23, coverage: 'full' },
      { grade: 8, topic: 25, coverage: 'partial' }
    ],
    theme: FOREST,
    kind: 'engine',
    playPath: '/games/maazan-hamemutsa/play'
  },
  {
    slug: 'galgal-haigul',
    title: 'משחק העיגול והגליל עם אליהו | נועם דורון',
    h1: 'משחק העיגול והגליל עם אליהו',
    description: 'שיעור קצר עם אליהו: מגלגלים גלגל כדי למצוא את ההיקף, מסדרים גזרות של עיגול למלבן כדי למצוא את השטח, ופורסים גליל לשטח פנים ונפח.',
    short: 'גלגל אחד מסתובב — ו־π מופיע על הסרגל.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '🛞',
    links: [
      { href: '/circle-area-circumference-grade-8', label: 'מעגל ועיגול לכיתה ח׳' },
      { href: '/cylinder-surface-area-grade-8', label: 'שטח הפנים של הגליל לכיתה ח׳' },
      { href: '/cylinder-volume-grade-8', label: 'נפח הגליל לכיתה ח׳' }
    ],
    topics: [
      { grade: 8, topic: 63, coverage: 'full' },
      { grade: 8, topic: 13, coverage: 'full' },
      { grade: 8, topic: 14, coverage: 'full' }
    ],
    theme: OCEAN,
    kind: 'engine',
    playPath: '/games/galgal-haigul/play'
  },
  {
    slug: 'zchuchit-hamagdelet',
    title: 'משחק דמיון משולשים עם אליהו | נועם דורון',
    h1: 'משחק דמיון משולשים עם אליהו',
    description: 'שיעור קצר עם אליהו: מגדילים משולש ורואים שהצלעות מוכפלות והזוויות נשמרות, מגלים ששתי זוויות מספיקות, ולמה השטח גדל פי k בריבוע.',
    short: 'מגדילים פי 2 — והשטח גדל פי 4.',
    grade: 'כיתות ח׳–ט׳',
    gradeOrder: 8,
    emoji: '🔍',
    links: [
      { href: '/similar-triangles-grade-8', label: 'דמיון משולשים לכיתה ח׳' },
      { href: '/similar-triangles-area-ratio-grade-8', label: 'יחס שטחים לכיתה ח׳' },
      { href: '/similar-triangles-grade-9', label: 'דמיון משולשים לכיתה ט׳' },
      { href: '/triangle-similarity-aa-grade-9', label: 'משפט ז.ז לכיתה ט׳' }
    ],
    topics: [
      { grade: 8, topic: 43, coverage: 'full' },
      { grade: 8, topic: 45, coverage: 'full' },
      { grade: 9, topic: 19, coverage: 'full' },
      { grade: 9, topic: 40, coverage: 'full' }
    ],
    theme: PLUM,
    kind: 'engine',
    playPath: '/games/zchuchit-hamagdelet/play'
  },
  {
    slug: 'motsim-et-hayashar',
    title: 'משחק משוואת הישר וחיתוך הצירים עם אליהו | נועם דורון',
    h1: 'משחק משוואת הישר וחיתוך הצירים עם אליהו',
    description: 'שיעור קצר עם אליהו: מוצאים איפה הישר חותך את הצירים, בונים משוואת ישר משתי נקודות ומכירים את הישרים המקבילים לצירים.',
    short: 'שתי נקודות מספיקות כדי לכתוב את משוואת הישר.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '📍',
    links: [
      { href: '/axis-intercepts-grade-8', label: 'חיתוך צירים לכיתה ח׳' },
      { href: '/equation-of-a-line-grade-8', label: 'משוואת ישר לכיתה ח׳' },
      { href: '/lines-parallel-to-axes-grade-8', label: 'ישרים מקבילים לצירים לכיתה ח׳' }
    ],
    topics: [
      { grade: 8, topic: 30, coverage: 'full' },
      { grade: 8, topic: 31, coverage: 'full' },
      { grade: 8, topic: 32, coverage: 'full' }
    ],
    theme: SLATE,
    kind: 'engine',
    playPath: '/games/motsim-et-hayashar/play'
  },
  {
    slug: 'mishpachat-hamerubaim',
    title: 'משחק משפחת המרובעים עם אליהו | נועם דורון',
    h1: 'משחק משפחת המרובעים עם אליהו',
    description: 'שיעור קצר עם אליהו: בונים מרובע משני אלכסונים, מגלים מתי הוא מקבילית, מלבן, מעוין, ריבוע או דלתון, ומחשבים שטח לפי האלכסונים.',
    short: 'האלכסונים מגלים איזה מרובע לפניך.',
    grade: 'כיתה ט׳',
    gradeOrder: 9,
    emoji: '🪁',
    links: [
      { href: '/parallelogram-grade-9', label: 'המקבילית לכיתה ט׳' },
      { href: '/rectangle-grade-9', label: 'המלבן לכיתה ט׳' },
      { href: '/rhombus-grade-9', label: 'המעוין לכיתה ט׳' },
      { href: '/square-grade-9', label: 'הריבוע לכיתה ט׳' },
      { href: '/trapezoid-grade-9', label: 'הטרפז לכיתה ט׳' },
      { href: '/kite-grade-9', label: 'הדלתון לכיתה ט׳' }
    ],
    topics: [
      { grade: 9, topic: 7, coverage: 'partial' },
      { grade: 9, topic: 11, coverage: 'partial' },
      { grade: 9, topic: 13, coverage: 'partial' },
      { grade: 9, topic: 14, coverage: 'partial' },
      { grade: 9, topic: 39, coverage: 'partial' },
      { grade: 9, topic: 46, coverage: 'partial' }
    ],
    theme: TEAL,
    kind: 'engine',
    playPath: '/games/mishpachat-hamerubaim/play'
  },
  {
    slug: 'mad-hazavit',
    title: 'משחק מד הזווית עם אליהו | נועם דורון',
    h1: 'משחק מד הזווית עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: מודדים זוויות במד זווית, מסווגים אותן ומשלימים ל־90° ול־180°. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'מודדים זוויות במד זווית, מסווגים אותן ומשלימים ל־90° ול־180°.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '📐',
    links: [{ href: '/angles-introduction-measurement-grade-7', label: 'זוויות לכיתה ז׳' }, { href: '/angles-review-grade-7', label: 'זוויות — דף חזרה לכיתה ז׳' }],
    topics: [{ grade: 7, topic: 11, coverage: 'partial' }, { grade: 7, topic: 13, coverage: 'partial' }],
    theme: INDIGO,
    kind: 'engine',
    playPath: '/games/mad-hazavit/play'
  },
  {
    slug: 'chukiyot-vedfusim',
    title: 'משחק ציידי החוקיות עם אליהו | נועם דורון',
    h1: 'משחק ציידי החוקיות עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: מגלים את הכלל שמאחורי סדרת ציורים ומספרים ובונים ביטוי לאיבר הכללי. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'מגלים את הכלל שמאחורי סדרת ציורים ומספרים ובונים ביטוי לאיבר הכללי.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '🔁',
    links: [{ href: '/number-patterns-grade-7', label: 'חוקיות לכיתה ז׳' }, { href: '/patterns-and-graphs-grade-7', label: 'חוקיות וגרפים לכיתה ז׳' }],
    topics: [{ grade: 7, topic: 21, coverage: 'partial' }],
    theme: FOREST,
    kind: 'engine',
    playPath: '/games/chukiyot-vedfusim/play'
  },
  {
    slug: 'mechonat-hahatsava',
    title: 'משחק מכונת ההצבה עם אליהו | נועם דורון',
    h1: 'משחק מכונת ההצבה עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: מתרגמים סיפור לביטוי אלגברי ומציבים בו מספרים, גם שליליים. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'מתרגמים סיפור לביטוי אלגברי ומציבים בו מספרים, גם שליליים.',
    grade: 'כיתה ז׳',
    gradeOrder: 7,
    emoji: '⚙️',
    links: [{ href: '/algebraic-expressions-grade-7', label: 'ביטויים אלגבריים לכיתה ז׳' }, { href: '/algebraic-language-grade-7', label: 'שפה אלגברית לכיתה ז׳' }],
    topics: [{ grade: 7, topic: 22, coverage: 'partial' }, { grade: 7, topic: 23, coverage: 'partial' }],
    theme: AMBER,
    kind: 'engine',
    playPath: '/games/mechonat-hahatsava/play'
  },
  {
    slug: 'model-hashetach',
    title: 'משחק מודל השטח עם אליהו | נועם דורון',
    h1: 'משחק מודל השטח עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: חותכים מלבן לחלקים ורואים למה a(b+c)=ab+ac — עד מכפלת שני סוגריים. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'חותכים מלבן לחלקים ורואים למה a(b+c)=ab+ac — עד מכפלת שני סוגריים.',
    grade: 'כיתות ז׳–ט׳',
    gradeOrder: 7,
    emoji: '🧱',
    links: [{ href: '/equations-advanced-grade-7', label: 'סוגריים וחוק הפילוג לכיתה ז׳' }, { href: '/distributive-law-grade-9', label: 'חוק הפילוג המורחב לכיתה ט׳' }],
    topics: [{ grade: 7, topic: 38, coverage: 'partial' }, { grade: 9, topic: 1, coverage: 'partial' }],
    theme: EMBER,
    kind: 'engine',
    playPath: '/games/model-hashetach/play'
  },
  {
    slug: 'tavlat-hashkichut',
    title: 'משחק טבלת השכיחות עם אליהו | נועם דורון',
    h1: 'משחק טבלת השכיחות עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: אוספים נתונים גולמיים, בונים טבלת שכיחות ועמודות שמספרות את האמת. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'אוספים נתונים גולמיים, בונים טבלת שכיחות ועמודות שמספרות את האמת.',
    grade: 'כיתות ז׳–ח׳',
    gradeOrder: 7,
    emoji: '📊',
    links: [{ href: '/data-collection-reading-grade-7', label: 'איסוף וקריאת מידע לכיתה ז׳' }, { href: '/frequency-grade-7', label: 'שכיחות לכיתה ז׳' }, { href: '/bar-charts-pictograms-grade-8', label: 'עמודות ופיקטוגרמות לכיתה ח׳' }],
    topics: [{ grade: 7, topic: 24, coverage: 'partial' }, { grade: 7, topic: 25, coverage: 'partial' }, { grade: 8, topic: 17, coverage: 'partial' }],
    theme: CYAN,
    kind: 'engine',
    playPath: '/games/tavlat-hashkichut/play'
  },
  {
    slug: 'diagramat-haouga',
    title: 'משחק דיאגרמת העוגה עם אליהו | נועם דורון',
    h1: 'משחק דיאגרמת העוגה עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: מתרגמים אחוזים למעלות וחותכים עוגה שמסכמת בדיוק ל־100%. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'מתרגמים אחוזים למעלות וחותכים עוגה שמסכמת בדיוק ל־100%.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '🥧',
    links: [{ href: '/pie-charts-grade-8', label: 'דיאגרמת עוגה לכיתה ח׳' }],
    topics: [{ grade: 8, topic: 18, coverage: 'partial' }],
    theme: ROSE,
    kind: 'engine',
    playPath: '/games/diagramat-haouga/play'
  },
  {
    slug: 'merchav-hatotsaot',
    title: 'משחק מרחב התוצאות עם אליהו | נועם דורון',
    h1: 'משחק מרחב התוצאות עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: בונים את כל התוצאות האפשריות ומחשבים הסתברות של אירוע. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'בונים את כל התוצאות האפשריות ומחשבים הסתברות של אירוע.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '🎲',
    links: [{ href: '/probability-sample-space-grade-8', label: 'מרחב תוצאות לכיתה ח׳' }, { href: '/probability-experiments-fairness-grade-8', label: 'ניסוי והוגנות לכיתה ח׳' }],
    topics: [{ grade: 8, topic: 50, coverage: 'partial' }, { grade: 8, topic: 51, coverage: 'partial' }],
    theme: PLUM,
    kind: 'engine',
    playPath: '/games/merchav-hatotsaot/play'
  },
  {
    slug: 'ee-shivyon-batsir',
    title: 'משחק אי־שוויון על הציר עם אליהו | נועם דורון',
    h1: 'משחק אי־שוויון על הציר עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: פותרים אי־שוויון, מסמנים אותו על הציר וזוכרים מתי הסימן מתהפך. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'פותרים אי־שוויון, מסמנים אותו על הציר וזוכרים מתי הסימן מתהפך.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '↔️',
    links: [{ href: '/inequalities-grade-8', label: 'אי־שוויון לכיתה ח׳' }, { href: '/graphical-inequalities-grade-8', label: 'אי־שוויון גרפי לכיתה ח׳' }],
    topics: [{ grade: 8, topic: 52, coverage: 'partial' }, { grade: 8, topic: 53, coverage: 'partial' }],
    theme: OCEAN,
    kind: 'engine',
    playPath: '/games/ee-shivyon-batsir/play'
  },
  {
    slug: 'chafifat-meshulashim',
    title: 'משחק חפיפת משולשים עם אליהו | נועם דורון',
    h1: 'משחק חפיפת משולשים עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: מתאימים צלעות וזוויות ובודקים איזה משפט חפיפה באמת מספיק. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'מתאימים צלעות וזוויות ובודקים איזה משפט חפיפה באמת מספיק.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '🔺',
    links: [{ href: '/triangle-congruence-grade-8', label: 'חפיפת משולשים לכיתה ח׳' }, { href: '/congruence-theorems-grade-8', label: 'משפטי חפיפה לכיתה ח׳' }],
    topics: [{ grade: 8, topic: 36, coverage: 'partial' }, { grade: 8, topic: 37, coverage: 'partial' }],
    theme: SLATE,
    kind: 'engine',
    playPath: '/games/chafifat-meshulashim/play'
  },
  {
    slug: 'yesharim-makbilim',
    title: 'משחק ישרים מקבילים עם אליהו | נועם דורון',
    h1: 'משחק ישרים מקבילים עם אליהו',
    description: 'שיעור אינטראקטיבי בעברית עם אליהו: גוררים חותך בין שני מקבילים ומגלים אילו זוויות שוות ואילו משלימות ל־180°. משחקים בגרירה, בכפתורים או במקלדת.',
    short: 'גוררים חותך בין שני מקבילים ומגלים אילו זוויות שוות ואילו משלימות ל־180°.',
    grade: 'כיתה ט׳',
    gradeOrder: 9,
    emoji: '🛤️',
    links: [{ href: '/parallel-lines-angles-grade-9', label: 'זוויות בין מקבילים לכיתה ט׳' }, { href: '/co-interior-angles-grade-9', label: 'זוויות חד־צדדיות לכיתה ט׳' }],
    topics: [{ grade: 9, topic: 50, coverage: 'partial' }, { grade: 9, topic: 51, coverage: 'partial' }],
    theme: TEAL,
    kind: 'engine',
    playPath: '/games/yesharim-makbilim/play'
  }
];

/** The two hand-written games that already live on the site. */
export const LEGACY_GAMES: EliyahuGame[] = [
  {
    slug: 'kefel-mekutsar-2',
    title: 'משחק נוסחה כפל מקוצר שנייה | נועם דורון',
    h1: 'משחק נוסחאות הכפל המקוצר עם אליהו',
    description: 'שיעור קצר עם אליהו: מגלים למה (a + b)² = a² + 2ab + b².',
    short: 'הטעות הכי נפוצה באלגברה, מפורקת לריבועים.',
    grade: 'כיתות ח׳–ט׳',
    gradeOrder: 8,
    emoji: '🧩',
    links: [{ href: '/binomial-square-grade-9', label: 'נוסחאות כפל מקוצר לכיתה ט׳' }],
    topics: [{ grade: 9, topic: 44, coverage: 'partial' }],
    theme: TEAL,
    kind: 'legacy',
    playPath: '/games/kefel-mekutsar-2',
    badge: '(beta)'
  },
  {
    slug: 'eliyahu-pythagoras',
    title: 'משחק משפט פיתגורס עם אליהו | נועם דורון',
    h1: 'משחק משפט פיתגורס עם אליהו',
    description: 'שיעור קצר עם אליהו: מוכיחים בעיניים למה a² + b² = c² — ומייצרים שלשות פיתגורסיות.',
    short: 'ההוכחה הקלאסית, צעד אחר צעד, עם מכונת שלשות.',
    grade: 'כיתות ח׳–ט׳',
    gradeOrder: 8,
    emoji: '📐',
    links: [
      { href: '/pythagorean-theorem-grade-8', label: 'משפט פיתגורס לכיתה ח׳' },
      { href: '/pythagorean-theorem-grade-9', label: 'משפט פיתגורס לכיתה ט׳' }
    ],
    topics: [{ grade: 8, topic: 11, coverage: 'partial' }, { grade: 9, topic: 35, coverage: 'partial' }],
    theme: INDIGO,
    kind: 'legacy',
    playPath: '/games/eliyahu-pythagoras/play'
  }
];

/** Every game in the corner, ordered by the grade it opens. */
export const ALL_GAMES: EliyahuGame[] = [...ENGINE_GAMES, ...LEGACY_GAMES]
  .slice()
  .sort((a, b) => a.gradeOrder - b.gradeOrder || a.slug.localeCompare(b.slug));

export const GAMES_INDEX_PATH = '/games';
export const GAMES_INDEX_TITLE = 'פינת המשחקים של אליהו | נועם דורון';
export const GAMES_INDEX_H1 = 'פינת המשחקים של אליהו';
export const GAMES_INDEX_DESCRIPTION =
  'שיעורים קצרים ואינטראקטיביים עם אליהו: כל משחק מסביר רעיון אחד במתמטיקה בעיניים, מכיתה ג׳ ועד כיתה ט׳.';

export function gamePath(game: EliyahuGame): string {
  return `/games/${game.slug}`;
}

export function findEngineGame(slug: string): EliyahuGame | undefined {
  return ENGINE_GAMES.find((game) => game.slug === slug);
}

/** Engine slugs, used by the dynamic routes and by the sitemap. */
export const ENGINE_GAME_SLUGS: string[] = ENGINE_GAMES.map((game) => game.slug);

/** Every indexable games path, for the sitemap. */
export function listGamePaths(): string[] {
  return [GAMES_INDEX_PATH, ...ENGINE_GAMES.map((game) => gamePath(game))];
}
