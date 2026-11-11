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
  /** Palette, injected as custom properties into the document. */
  theme: GameTheme;
  /**
   * `engine` games are composed from src/games/specs/<slug>.js.
   * `legacy` games keep their own route and HTML file.
   */
  kind: 'engine' | 'legacy';
  /** Path of the playable document. */
  playPath: string;
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
    theme: SLATE,
    kind: 'engine',
    playPath: '/games/misparim-shliliim/play'
  },
  {
    slug: 'shipua-kavi',
    title: 'משחק השיפוע של הפונקציה הקווית עם אליהו | נועם דורון',
    h1: 'משחק השיפוע של הפונקציה הקווית עם אליהו',
    description: 'שיעור קצר עם אליהו: גוררים ישר ורואים מה עושים m ו־b לגרף.',
    short: 'גוררים את הישר, והנוסחה משתנה איתו.',
    grade: 'כיתה ח׳',
    gradeOrder: 8,
    emoji: '📈',
    links: [
      { href: '/linear-function-grade-8', label: 'הפונקציה הקווית לכיתה ח׳' },
      { href: '/linear-function-grade-9', label: 'הפונקציה הקווית לכיתה ט׳' }
    ],
    theme: INDIGO,
    kind: 'engine',
    playPath: '/games/shipua-kavi/play'
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
    theme: TEAL,
    kind: 'legacy',
    playPath: '/games/kefel-mekutsar-2'
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
