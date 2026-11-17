/**
 * Canonical and robots for /worksheets catalog URLs (SEO-1).
 *
 * Every /worksheets?grade=N&topic=M URL used to be index,follow with a canonical
 * to itself, so hundreds of thin, JavaScript-drawn catalog URLs competed with the
 * server-rendered topic landing pages. A catalog URL now names the page that
 * should rank instead:
 *   - a known topic with one landing page  -> that landing page
 *   - a sub-topic without its own landing  -> its parent topic's landing page
 *   - any other known topic                -> the grade hub /grade-N
 *   - ?grade=N without a topic             -> the grade hub /grade-N
 *   - an unknown topic id (?topic=999)     -> noindex,follow (no rival, links still followed)
 *   - bare /worksheets (no valid grade)    -> unchanged (self canonical, in the sitemap)
 *
 * The page's JSON-LD (BreadcrumbList and LearningResource) names the same target
 * as rel=canonical; see worksheetsStructuredData below.
 */
import type { CatalogTopic } from './catalog/types';
import { worksheetsDocumentTitle } from './seoTitles';
import type { Crumb } from './structuredData';

export function gradeHubPath(grade: number): string {
  return `/grade-${grade}`;
}

export interface WorksheetsSeoInput {
  grade: number;
  /** True only when ?grade= named a valid grade (not defaulted from level or absence). */
  gradeExplicit: boolean;
  topics: readonly Pick<CatalogTopic, 'id' | 'title' | 'parent'>[];
  /** Parsed ?topic= id, or null when absent or not a number. */
  topicId: number | null;
  /** topicPageHrefByCatalogTopic(): 'grade:topicId' -> landing path, only when unique. */
  topicPageHrefs: Readonly<Record<string, string>>;
}

export interface WorksheetsSeo {
  /** Production path for rel=canonical and og:url. Undefined keeps the layout default. */
  canonicalPath?: string;
  /** True for an unknown topic id: noindex,follow. */
  noindexFollow: boolean;
  /** Title of the named catalog topic, when it exists in this grade. */
  topicTitle?: string;
  /**
   * Title of the topic whose landing page the canonical names: the topic itself,
   * or its parent for a sub-topic. Undefined when the canonical names the grade hub.
   */
  landingTopicTitle?: string;
}

export function worksheetsSeo(input: WorksheetsSeoInput): WorksheetsSeo {
  const { grade, gradeExplicit, topics, topicId, topicPageHrefs } = input;
  if (topicId != null) {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic) return { noindexFollow: true };
    const ownLanding = topicPageHrefs[`${grade}:${topic.id}`];
    if (ownLanding) {
      return { canonicalPath: ownLanding, noindexFollow: false, topicTitle: topic.title, landingTopicTitle: topic.title };
    }
    const parentLanding = topic.parent != null ? topicPageHrefs[`${grade}:${topic.parent}`] : undefined;
    if (parentLanding) {
      const parent = topics.find((item) => item.id === topic.parent);
      return {
        canonicalPath: parentLanding,
        noindexFollow: false,
        topicTitle: topic.title,
        landingTopicTitle: parent?.title ?? topic.title,
      };
    }
    return { canonicalPath: gradeHubPath(grade), noindexFollow: false, topicTitle: topic.title };
  }
  if (gradeExplicit) return { canonicalPath: gradeHubPath(grade), noindexFollow: false };
  return { noindexFollow: false };
}

export interface WorksheetsStructuredData {
  /** BreadcrumbList trail for BaseLayout. */
  crumbs: Crumb[];
  /** Name and path of the LearningResource node. */
  resource: { name: string; path: string };
}

/**
 * JSON-LD targets for a /worksheets catalog URL. The BreadcrumbList and the
 * LearningResource name the same page as rel=canonical, never a
 * /worksheets?grade=N URL that canonicalizes away:
 *   - the grade crumb names the grade hub /grade-N (the canonical of ?grade=N);
 *   - when the canonical names a topic landing, a last crumb names that landing;
 *   - the LearningResource describes the last crumb.
 * So on every URL with a canonical override, the last crumb, the
 * LearningResource url and rel=canonical are one URL. An unknown topic id
 * (noindex,follow, self canonical) and bare /worksheets describe the grade hub,
 * because the page shows that grade's catalog.
 */
export function worksheetsStructuredData(input: {
  grade: number;
  gradeLabel: string;
  seo: WorksheetsSeo;
}): WorksheetsStructuredData {
  const { grade, gradeLabel, seo } = input;
  const crumbs: Crumb[] = [
    { name: 'בית', path: '/' },
    { name: 'דפי עבודה', path: '/worksheets' },
    { name: gradeLabel, path: gradeHubPath(grade) },
  ];
  if (seo.canonicalPath && seo.landingTopicTitle) {
    crumbs.push({ name: seo.landingTopicTitle, path: seo.canonicalPath });
  }
  const last = crumbs[crumbs.length - 1];
  return {
    crumbs,
    resource: { name: worksheetsDocumentTitle(gradeLabel, seo.landingTopicTitle), path: last.path },
  };
}
