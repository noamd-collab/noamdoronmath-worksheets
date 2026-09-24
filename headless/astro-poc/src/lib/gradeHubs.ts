/**
 * HEADLESS-MIGRATION-16/17 — production grade-hub content (1–9) as code-managed
 * JSON baselines. Topic SEO paths stay on production until migrated.
 *
 * Do NOT invent SEO copy. Refresh from production HTML / visible DOM only.
 */
import grade1 from '../data/grade-hubs/1.json';
import grade2 from '../data/grade-hubs/2.json';
import grade3 from '../data/grade-hubs/3.json';
import grade4 from '../data/grade-hubs/4.json';
import grade5 from '../data/grade-hubs/5.json';
import grade6 from '../data/grade-hubs/6.json';
import grade7 from '../data/grade-hubs/7.json';
import grade8 from '../data/grade-hubs/8.json';
import grade9 from '../data/grade-hubs/9.json';

export const GRADE_HUB_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const ELEMENTARY_GRADE_HUBS = [1, 2, 3, 4, 5, 6] as const;
export const MIDDLE_GRADE_HUBS = [7, 8, 9] as const;
export type GradeHubGrade = (typeof GRADE_HUB_GRADES)[number];

export interface GradeHubTopicLink {
  path: string;
  label: string;
  /** Unported topic SEO — keep absolute production URL. */
  productionHref: string;
}

export interface GradeHubTopicSection {
  heading: string | null;
  links: GradeHubTopicLink[];
}

export interface GradeHubFaqItem {
  question: string;
  answer: string;
}

export interface GradeHubCatalogCta {
  label: string;
  href: string;
  source: string;
  note?: string;
}

export interface GradeHubFooterLink {
  label: string;
  href: string;
}

export interface GradeHubWhatsapp {
  heading: string;
  body: string;
  ctaLabel: string;
  href: string;
  hrefSource?: string;
}

export interface GradeHubContent {
  grade: GradeHubGrade;
  path: string;
  sourceUrl: string;
  fetchedAt: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Short line shown before the full intro. Full intro stays on the page. */
  lead?: string;
  topicSections: GradeHubTopicSection[];
  topicLinks: GradeHubTopicLink[];
  topicLinksNote?: string;
  catalogCta: GradeHubCatalogCta | null;
  faqHeading: string | null;
  faq: GradeHubFaqItem[];
  faqNote?: string;
  whatsapp?: GradeHubWhatsapp | null;
  terms: { label: string; href: string };
  footerLinks?: GradeHubFooterLink[];
  contactLine?: string;
}

const BY_GRADE: Record<GradeHubGrade, GradeHubContent> = {
  1: grade1 as GradeHubContent,
  2: grade2 as GradeHubContent,
  3: grade3 as GradeHubContent,
  4: grade4 as GradeHubContent,
  5: grade5 as GradeHubContent,
  6: grade6 as GradeHubContent,
  7: grade7 as GradeHubContent,
  8: grade8 as GradeHubContent,
  9: grade9 as GradeHubContent,
};

const LABELS: Record<GradeHubGrade, string> = {
  1: 'א׳',
  2: 'ב׳',
  3: 'ג׳',
  4: 'ד׳',
  5: 'ה׳',
  6: 'ו׳',
  7: 'ז׳',
  8: 'ח׳',
  9: 'ט׳',
};

export function isGradeHubGrade(n: number): n is GradeHubGrade {
  return (GRADE_HUB_GRADES as readonly number[]).includes(n);
}

export function gradeHubFamily(grade: GradeHubGrade): readonly GradeHubGrade[] {
  return grade <= 6 ? ELEMENTARY_GRADE_HUBS : MIDDLE_GRADE_HUBS;
}

function assertHub(grade: GradeHubGrade, data: GradeHubContent): GradeHubContent {
  if (data.grade !== grade) {
    throw new Error(`Grade hub JSON grade mismatch: expected ${grade}, got ${data.grade}`);
  }
  if (!data.h1 || !data.title || !data.description || !data.intro) {
    throw new Error(`Grade hub ${grade}: missing required SEO/copy fields`);
  }
  if (!Array.isArray(data.faq)) {
    throw new Error(`Grade hub ${grade}: faq must be an array`);
  }
  if (!Array.isArray(data.topicLinks)) {
    throw new Error(`Grade hub ${grade}: topicLinks must be an array`);
  }
  // Middle-school hubs (7–9) ship topic SEO lists + FAQ from production.
  // Elementary hubs (1–6) verified live: no topic SEO list and no FAQ — catalog CTA only.
  if (grade >= 7) {
    if (data.faq.length === 0) {
      throw new Error(`Grade hub ${grade}: missing FAQ`);
    }
    if (data.topicLinks.length === 0) {
      throw new Error(`Grade hub ${grade}: missing topic links`);
    }
  } else if (!data.catalogCta) {
    throw new Error(`Grade hub ${grade}: elementary hub requires catalog CTA`);
  }
  for (const link of data.topicLinks) {
    if (!link.productionHref.startsWith('https://www.noamdoronmath.co.il/')) {
      throw new Error(`Grade hub ${grade}: topic link not production: ${link.path}`);
    }
  }
  if (data.catalogCta && !data.catalogCta.href.startsWith('/worksheets?grade=')) {
    throw new Error(`Grade hub ${grade}: catalog CTA must be same-origin worksheets`);
  }
  return data;
}

export function loadGradeHub(grade: GradeHubGrade): GradeHubContent {
  return assertHub(grade, BY_GRADE[grade]);
}

export function loadAllGradeHubs(): GradeHubContent[] {
  return GRADE_HUB_GRADES.map(loadGradeHub);
}

/** Sibling grade hub paths for in-page navigation (exact /grade-N routes). */
export function siblingGradeHubLinks(
  grade: GradeHubGrade
): { grade: GradeHubGrade; href: string; label: string }[] {
  return gradeHubFamily(grade).map((g) => ({
    grade: g,
    href: `/grade-${g}`,
    label: LABELS[g],
  }));
}

export function gradeHubLabel(grade: GradeHubGrade): string {
  return LABELS[grade];
}
