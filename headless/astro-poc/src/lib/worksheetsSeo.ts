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
 */
import type { CatalogTopic } from './catalog/types';

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
}

export function worksheetsSeo(input: WorksheetsSeoInput): WorksheetsSeo {
  const { grade, gradeExplicit, topics, topicId, topicPageHrefs } = input;
  if (topicId != null) {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic) return { noindexFollow: true };
    const parentLanding = topic.parent != null ? topicPageHrefs[`${grade}:${topic.parent}`] : undefined;
    return {
      canonicalPath: topicPageHrefs[`${grade}:${topic.id}`] ?? parentLanding ?? gradeHubPath(grade),
      noindexFollow: false,
      topicTitle: topic.title,
    };
  }
  if (gradeExplicit) return { canonicalPath: gradeHubPath(grade), noindexFollow: false };
  return { noindexFollow: false };
}
