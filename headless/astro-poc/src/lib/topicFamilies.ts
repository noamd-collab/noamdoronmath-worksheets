/**
 * Topic-family classifier for related-topic blocks.
 *
 * Mirrors the live GEO script's keyword order (graphs, then geometry, then
 * algebra, else default), except algebra identity terms are decided first.
 * Otherwise "square" inside binomial-square / difference-of-squares classifies
 * the page as geometry.
 */
import { gradeHubLabel, isGradeHubGrade } from './gradeHubs';

export type TopicFamily = 'algebra' | 'geometry' | 'graphs' | 'default';

export type FamilyRelatedTopic = {
  path: string;
  label: string;
  productionHref: string;
};

/** Checked before geometry's "square" (and before graphs). */
const ALGEBRA_PRIORITY =
  /(?:^|[/-])(?:binomial|square-of-sum|difference-of-squares|expansion)(?:[/-]|$)/;

const GRAPHS = /coordinate|graph|function|statistic|probability|precalculus/;
const GEOMETRY =
  /triangle|angle|pythag|rectangle|square|rhombus|trapezoid|parallelogram|polygon|circle|cylinder|cone|prism|congru|similar|geometric|area|volume/;
const ALGEBRA =
  /equation|algebra|factor|power|exponent|root|signed|inequal|binomial|distributive|word-problem|percentage/;

const PROD = 'https://www.noamdoronmath.co.il';

/** Canonical related targets from the live GEO block, keyed by grade then family. */
const LINKS: Record<number, Record<TopicFamily, readonly (readonly [string, string])[]>> = {
  7: {
    algebra: [
      ['/signed-numbers-grade-7', 'מספרים מכוונים'],
      ['/powers-grade-7', 'חזקות'],
      ['/algebraic-expressions-grade-7', 'ביטויים אלגבריים'],
      ['/equations-basics-grade-7', 'משוואות'],
    ],
    geometry: [
      ['/angles-introduction-measurement-grade-7', 'זוויות'],
      ['/triangle-area-grade-7', 'שטח משולש'],
      ['/pythagorean-theorem-grade-7', 'משפט פיתגורס'],
      ['/area-parallelogram-trapezoid-composite-grade-7', 'שטחים'],
    ],
    graphs: [
      ['/coordinate-plane-scale-grade-7', 'מערכת צירים'],
      ['/coordinate-plane-applications-grade-7', 'יישומים במערכת צירים'],
      ['/patterns-and-graphs-grade-7', 'חוקיות וגרפים'],
    ],
    default: [
      ['/grade-7', 'כל דפי כיתה ז׳'],
      ['/signed-numbers-grade-7', 'מספרים מכוונים'],
      ['/angles-introduction-measurement-grade-7', 'זוויות'],
    ],
  },
  8: {
    algebra: [
      ['/linear-equations-grade-8', 'משוואות ליניאריות'],
      ['/systems-of-equations-grade-8', 'מערכות משוואות'],
      ['/linear-function-grade-8', 'פונקציה קווית'],
      ['/inequalities-grade-8', 'אי־שוויונות'],
    ],
    geometry: [
      ['/triangle-congruence-grade-8', 'חפיפת משולשים'],
      ['/similar-triangles-grade-8', 'דמיון משולשים'],
      ['/pythagorean-theorem-grade-8', 'משפט פיתגורס'],
      ['/geometric-proof-grade-8', 'הוכחה גאומטרית'],
    ],
    graphs: [
      ['/coordinate-plane-grade-8', 'מערכת צירים'],
      ['/linear-function-grade-8', 'פונקציה קווית'],
      ['/statistics-grade-8', 'סטטיסטיקה'],
    ],
    default: [
      ['/grade-8', 'כל דפי כיתה ח׳'],
      ['/linear-equations-grade-8', 'משוואות'],
      ['/triangle-congruence-grade-8', 'גאומטריה'],
    ],
  },
  9: {
    algebra: [
      ['/factoring-grade-9', 'פירוק לגורמים'],
      ['/quadratic-equations-grade-9', 'משוואות ריבועיות'],
      ['/quadratic-function-grade-9', 'הפונקציה הריבועית'],
      ['/algebraic-fractions-grade-9', 'שברים אלגבריים'],
    ],
    geometry: [
      ['/similar-triangles-grade-9', 'דמיון משולשים'],
      ['/pythagorean-theorem-grade-9', 'משפט פיתגורס'],
      ['/rectangle-grade-9', 'מלבן'],
      ['/square-grade-9', 'ריבוע'],
    ],
    graphs: [
      ['/linear-function-grade-9', 'פונקציה קווית'],
      ['/quadratic-function-grade-9', 'הפונקציה הריבועית'],
      ['/analytic-geometry-grade-9', 'גאומטריה אנליטית'],
      ['/statistics-grade-9', 'סטטיסטיקה'],
    ],
    default: [
      ['/grade-9', 'כל דפי כיתה ט׳'],
      ['/factoring-grade-9', 'אלגברה'],
      ['/similar-triangles-grade-9', 'גאומטריה'],
    ],
  },
};

export function topicPath(slugOrPath: string): string {
  const raw = slugOrPath.startsWith('/') ? slugOrPath : `/${slugOrPath}`;
  return raw.replace(/\/+$/, '') || '/';
}

export function classifyTopicFamily(slugOrPath: string): TopicFamily {
  const path = topicPath(slugOrPath);
  if (ALGEBRA_PRIORITY.test(path)) return 'algebra';
  if (GRAPHS.test(path)) return 'graphs';
  if (GEOMETRY.test(path)) return 'geometry';
  if (ALGEBRA.test(path)) return 'algebra';
  return 'default';
}

function toRelated(pair: readonly [string, string]): FamilyRelatedTopic {
  return {
    path: pair[0],
    label: pair[1],
    productionHref: `${PROD}${pair[0]}`,
  };
}

export function gradeHubRelatedTopic(grade: number): FamilyRelatedTopic {
  const heb = isGradeHubGrade(grade) ? gradeHubLabel(grade) : String(grade);
  const path = `/grade-${grade}`;
  return {
    path,
    label: `כל דפי כיתה ${heb}`,
    productionHref: `${PROD}${path}`,
  };
}

/**
 * Related topics for a page, same selection as the live GEO script:
 * family list, drop the current path, keep three.
 * Grade-hub links for algebra/geometry/graphs are added separately.
 */
export function familyRelatedTopics(slugOrPath: string, grade: number): FamilyRelatedTopic[] {
  const path = topicPath(slugOrPath);
  const family = classifyTopicFamily(path);
  const table = LINKS[grade];
  if (!table) return [];
  return (table[family] || table.default)
    .filter(([href]) => href !== path)
    .slice(0, 3)
    .map(toRelated);
}
