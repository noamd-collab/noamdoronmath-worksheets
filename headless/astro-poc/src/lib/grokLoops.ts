/**
 * Grok L01–L56 landing map — from loops-b7@02b33ab handoff manifest.
 * Do not invent landings; keep in sync with media/grok-animations-56-source/manifest.json.
 */

export type GrokLoopVariant = string;

export type GrokLoopEntry = {
  id: string;
  variant: string;
  topic: string;
  landing: string;
  name: string;
  gradeLabel: string;
  slug?: string;
};

export const GROK_SOURCE_COMMIT = "02b33ab22deec35cbac24bcf432ec8975c9f3ad8";

/** All 56 after QA fixes — none gated off production. */
export const GROK_BLOCKED_IDS: ReadonlySet<string> = new Set();

export const GROK_TOPIC_LOOPS: readonly GrokLoopEntry[] = [
  {
    "id": "L01",
    "variant": "angle-sum",
    "topic": "סכום הזוויות במשולש ובמרובע",
    "landing": "/triangle-quadrilateral-angle-sum-grade-7",
    "name": "L01 סכום זוויות במשולש",
    "gradeLabel": "ז׳",
    "slug": "triangle-quadrilateral-angle-sum-grade-7"
  },
  {
    "id": "L05",
    "variant": "slope",
    "topic": "פונקציה קווית",
    "landing": "/linear-function-grade-8",
    "name": "L05 שיפוע",
    "gradeLabel": "ח׳",
    "slug": "linear-function-grade-8"
  },
  {
    "id": "L07",
    "variant": "similar",
    "topic": "דמיון משולשים",
    "landing": "/similar-triangles-grade-9",
    "name": "L07 דמיון משולשים",
    "gradeLabel": "ט׳",
    "slug": "similar-triangles-grade-9"
  },
  {
    "id": "L09",
    "variant": "sup-angles",
    "topic": "זוויות חלק 2 — יחסים ופעולות",
    "landing": "/angles-grade-7",
    "name": "L09 זוויות צמודות לקו ישר",
    "gradeLabel": "ז׳",
    "slug": "angles-grade-7"
  },
  {
    "id": "L11",
    "variant": "corr-angles",
    "topic": "זוויות בין ישרים מקבילים",
    "landing": "/parallel-lines-angles-grade-8",
    "name": "L11 זוויות בין מקבילים",
    "gradeLabel": "ח׳",
    "slug": "parallel-lines-angles-grade-8"
  },
  {
    "id": "L14",
    "variant": "diff-sq",
    "topic": "הפרש ריבועים",
    "landing": "/difference-of-squares-grade-9",
    "name": "L14 הפרש ריבועים",
    "gradeLabel": "ט׳",
    "slug": "difference-of-squares-grade-9"
  },
  {
    "id": "L17",
    "variant": "signed-jump",
    "topic": "מספרים מכוונים — ישר המספרים וערך מוחלט",
    "landing": "/number-line-absolute-value-grade-7",
    "name": "L17 קפיצה מ־2−",
    "gradeLabel": "ז׳",
    "slug": "number-line-absolute-value-grade-7"
  },
  {
    "id": "L19",
    "variant": "sas-snap",
    "topic": "חפיפת משולשים",
    "landing": "/triangle-congruence-grade-8",
    "name": "L19 חפיפה צלע־זווית־צלע",
    "gradeLabel": "ח׳",
    "slug": "triangle-congruence-grade-8"
  },
  {
    "id": "L22",
    "variant": "trap-area",
    "topic": "הטרפז",
    "landing": "/trapezoid-grade-9",
    "name": "L22 שטח טרפז",
    "gradeLabel": "ט׳",
    "slug": "trapezoid-grade-9"
  },
  {
    "id": "L25",
    "variant": "circ-unroll",
    "topic": "מעגל ועיגול — היקף ושטח",
    "landing": "/circle-area-circumference-grade-8",
    "name": "L25 היקף כשלושה קטרים",
    "gradeLabel": "ח׳",
    "slug": "circle-area-circumference-grade-8"
  },
  {
    "id": "L27",
    "variant": "l-split",
    "topic": "שטחים ב׳ חלק 2 — מצולעים מורכבים",
    "landing": "/area-parallelogram-trapezoid-composite-grade-7",
    "name": "L27 צורת L",
    "gradeLabel": "ז׳",
    "slug": "area-parallelogram-trapezoid-composite-grade-7"
  },
  {
    "id": "L30",
    "variant": "parab",
    "topic": "הפונקציה הריבועית",
    "landing": "/quadratic-function-grade-9",
    "name": "L30 קודקוד פרבולה",
    "gradeLabel": "ט׳",
    "slug": "quadratic-function-grade-9"
  },
  {
    "id": "L33",
    "variant": "signed-ops",
    "topic": "סדר פעולות החשבון במספרים מכוונים",
    "landing": "/order-of-operations-signed-numbers-grade-7",
    "name": "L33 סדר פעולות מכוון",
    "gradeLabel": "ז׳",
    "slug": "order-of-operations-signed-numbers-grade-7"
  },
  {
    "id": "L35",
    "variant": "exterior",
    "topic": "זווית חיצונית",
    "landing": "/exterior-angle-triangle-grade-8",
    "name": "L35 זווית חיצונית",
    "gradeLabel": "ח׳",
    "slug": "exterior-angle-triangle-grade-8"
  },
  {
    "id": "L38",
    "variant": "two-coins",
    "topic": "הסתברות",
    "landing": "/probability-grade-9",
    "name": "L38 שני מטבעות",
    "gradeLabel": "ט׳",
    "slug": "probability-grade-9"
  },
  {
    "id": "L41",
    "variant": "coord-walk",
    "topic": "מערכת צירים — היכרות וקנה מידה",
    "landing": "/coordinate-plane-scale-grade-7",
    "name": "L41 נקודה (3,2)",
    "gradeLabel": "ז׳",
    "slug": "coordinate-plane-scale-grade-7"
  },
  {
    "id": "L43",
    "variant": "cyl-stack",
    "topic": "גליל — נפח",
    "landing": "/cylinder-volume-grade-8",
    "name": "L43 גליל בשכבות",
    "gradeLabel": "ח׳",
    "slug": "cylinder-volume-grade-8"
  },
  {
    "id": "L46",
    "variant": "half-eq",
    "topic": "משולש ישר זווית 30-60-90",
    "landing": "/triangle-30-60-90-grade-9",
    "name": "L46 חציית שווה צלעות",
    "gradeLabel": "ט׳",
    "slug": "triangle-30-60-90-grade-9"
  },
  {
    "id": "L49",
    "variant": "cube-8",
    "topic": "חזקות עם מעריך טבעי",
    "landing": "/powers-grade-7",
    "name": "L49 שתיים בשלישית",
    "gradeLabel": "ז׳",
    "slug": "powers-grade-7"
  },
  {
    "id": "L53",
    "variant": "topic-card",
    "topic": "מעבר לחטיבה העליונה",
    "landing": "/transition-to-high-school-grade-9",
    "name": "L53 כרטיס נושא",
    "gradeLabel": "ט׳",
    "slug": "transition-to-high-school-grade-9"
  }
] as const;

export const GROK_GRADE_LOOPS: Record<number, GrokLoopEntry[]> = {
  1: [{"id": "L06", "variant": "add-within", "topic": "חיבור בתחום 10", "landing": "/grade-1", "name": "L06 3+4 בתחום 10", "gradeLabel": "א׳"}, {"id": "L15", "variant": "clock-3", "topic": "שעה שלמה", "landing": "/grade-1", "name": "L15 שעה שלמה", "gradeLabel": "א׳"}, {"id": "L24", "variant": "birds-sub", "topic": "חיסור בתחום 10", "landing": "/grade-1", "name": "L24 6−2 ציפורים", "gradeLabel": "א׳"}, {"id": "L32", "variant": "neighbors", "topic": "סדר שכנים והשוואה", "landing": "/grade-1", "name": "L32 שכנים של 8", "gradeLabel": "א׳"}, {"id": "L47", "variant": "sq-stretch", "topic": "ריבוע ומלבן", "landing": "/grade-1", "name": "L47 ריבוע למלבן", "gradeLabel": "א׳"}, {"id": "L52", "variant": "apples-5", "topic": "בעיות מילוליות בציור ובמספר", "landing": "/grade-1", "name": "L52 תפוחים", "gradeLabel": "א׳"}],
  2: [{"id": "L10", "variant": "share-12", "topic": "חילוק לחלקים שווים", "landing": "/grade-2", "name": "L10 חילוק שווה", "gradeLabel": "ב׳"}, {"id": "L23", "variant": "odd-pair", "topic": "זוגי אי זוגי וסדרות א", "landing": "/grade-2", "name": "L23 אי־זוגי", "gradeLabel": "ב׳"}, {"id": "L34", "variant": "clock-span", "topic": "שעון ומשך זמן", "landing": "/grade-2", "name": "L34 משעתיים", "gradeLabel": "ב׳"}, {"id": "L42", "variant": "coins-12", "topic": "בעיות מילוליות וכסף פשוט", "landing": "/grade-2", "name": "L42 מטבעות ל־12", "gradeLabel": "ב׳"}, {"id": "L50", "variant": "place-123", "topic": "מאות עשרות ויחידות", "landing": "/grade-2", "name": "L50 מאה עשרות יחידות", "gradeLabel": "ב׳"}, {"id": "L54", "variant": "mark-250", "topic": "סדר השוואה וישר מספרים", "landing": "/grade-2", "name": "L54 250 על הישר", "gradeLabel": "ב׳"}],
  3: [{"id": "L03", "variant": "angle-kinds", "topic": "זווית וסוגי זוויות", "landing": "/grade-3", "name": "L03 סוגי זוויות", "gradeLabel": "ג׳"}, {"id": "L16", "variant": "peri-rect", "topic": "היקף מצולעים", "landing": "/grade-3", "name": "L16 היקף מלבן", "gradeLabel": "ג׳"}, {"id": "L29", "variant": "tri-sort", "topic": "מיון משולשים", "landing": "/grade-3", "name": "L29 מיון משולשים", "gradeLabel": "ג׳"}, {"id": "L40", "variant": "unit-frac", "topic": "שברי יחידה וחלק משלם", "landing": "/grade-3", "name": "L40 חצי שליש רבע", "gradeLabel": "ג׳"}, {"id": "L51", "variant": "jumps-4", "topic": "כפל עובדות ומבנים", "landing": "/grade-3", "name": "L51 ארבע קפיצות", "gradeLabel": "ג׳"}, {"id": "L55", "variant": "quad-gate", "topic": "מרובעים לפי תכונות", "landing": "/grade-3", "name": "L55 סל מרובעים", "gradeLabel": "ג׳"}],
  4: [{"id": "L08", "variant": "order-ops", "topic": "סדר פעולות חשבון", "landing": "/grade-4", "name": "L08 סדר פעולות", "gradeLabel": "ד׳"}, {"id": "L18", "variant": "prime-rect", "topic": "מספרים ראשוניים ופריקים", "landing": "/grade-4", "name": "L18 6 מלבן, 7 לא", "gradeLabel": "ד׳"}, {"id": "L26", "variant": "rect-count", "topic": "שטח והיקף של מלבן וריבוע", "landing": "/grade-4", "name": "L26 שטח והיקף", "gradeLabel": "ד׳"}, {"id": "L36", "variant": "para-perp", "topic": "מקבילים ומאונכים בצורות", "landing": "/grade-4", "name": "L36 מקביל ומאונך", "gradeLabel": "ד׳"}, {"id": "L45", "variant": "equiv-half", "topic": "שברים שקולים ייצוגים השוואה וישר מספרים", "landing": "/grade-4", "name": "L45 חצי על הישר", "gradeLabel": "ד׳"}, {"id": "L56", "variant": "two-diag", "topic": "מצולעים ואלכסונים", "landing": "/grade-4", "name": "L56 שני אלכסונים", "gradeLabel": "ד׳"}],
  5: [{"id": "L02", "variant": "para-rect", "topic": "שטח מקבילית והקשר למלבן", "landing": "/grade-5", "name": "L02 מקבילית למלבן", "gradeLabel": "ה׳"}, {"id": "L12", "variant": "mean-cols", "topic": "ממוצע וחקר נתונים", "landing": "/grade-5", "name": "L12 ממוצע", "gradeLabel": "ה׳"}, {"id": "L20", "variant": "obtuse-ht", "topic": "גובה במשולש קהה ובמקבילית", "landing": "/grade-5", "name": "L20 גובה מחוץ למשולש", "gradeLabel": "ה׳"}, {"id": "L28", "variant": "quad-tree", "topic": "משפחת המרובעים ויחסי הכלה", "landing": "/grade-5", "name": "L28 עץ מרובעים", "gradeLabel": "ה׳"}, {"id": "L37", "variant": "quarter-12", "topic": "חלק מכמות", "landing": "/grade-5", "name": "L37 רבע מ־12", "gradeLabel": "ה׳"}, {"id": "L44", "variant": "tenth-cell", "topic": "מספרים עשרוניים ערך מקום וייצוגים", "landing": "/grade-5", "name": "L44 עשירית ומאית", "gradeLabel": "ה׳"}],
  6: [{"id": "L04", "variant": "frac-product", "topic": "כפל שבר בשבר", "landing": "/grade-6", "name": "L04 חצי של שליש", "gradeLabel": "ו׳"}, {"id": "L13", "variant": "pct-25", "topic": "אחוז כחלק מכמות", "landing": "/grade-6", "name": "L13 25 אחוז", "gradeLabel": "ו׳"}, {"id": "L21", "variant": "box-vol", "topic": "נפח תיבה ומבנים", "landing": "/grade-6", "name": "L21 נפח תיבה", "gradeLabel": "ו׳"}, {"id": "L31", "variant": "ratio-beads", "topic": "יחס משמעות ייצוג ויחסים שקולים", "landing": "/grade-6", "name": "L31 יחס 2:3", "gradeLabel": "ו׳"}, {"id": "L39", "variant": "map-scale", "topic": "קנה מידה במפות ובשרטוטים", "landing": "/grade-6", "name": "L39 קנה מידה", "gradeLabel": "ו׳"}, {"id": "L48", "variant": "area-x4", "topic": "שינוי ממדים מה קורה להיקף לשטח ולנפח", "landing": "/grade-6", "name": "L48 צלע כפולה", "gradeLabel": "ו׳"}],
};

export function grokLoopForTopicSlug(slug: string): GrokLoopEntry | undefined {
  return GROK_TOPIC_LOOPS.find((e) => e.slug === slug || e.landing === `/${slug}`);
}

export function grokLoopsForGrade(grade: number): GrokLoopEntry[] {
  return GROK_GRADE_LOOPS[grade] ?? [];
}

export function isGrokLoopBlocked(id: string): boolean {
  return GROK_BLOCKED_IDS.has(id);
}

export function visibleGrokLoops(entries: readonly GrokLoopEntry[]): GrokLoopEntry[] {
  return entries.filter((e) => !isGrokLoopBlocked(e.id));
}
