/**
 * SEO-2 — can a layout unit link this topic page? Shared by the request-time
 * index (src/lib/prisaIndex.ts, which renders a refused target as plain text)
 * and the generator (scripts/build-prisa-units.ts, which fails instead).
 */
import { TOPIC_PAGE_SLUGS, loadTopicPage, synthesizeBodyFlow, type TopicPageContent } from './topicPages';

const SERVED_SLUGS = new Set<string>(TOPIC_PAGE_SLUGS);

export function isServedTopicSlug(slug: string): boolean {
  return SERVED_SLUGS.has(slug);
}

/** The section anchors a topic page renders as H2 ids. */
export function topicSectionAnchorIds(page: TopicPageContent): Set<string> {
  const anchors = new Set<string>();
  for (const item of synthesizeBodyFlow(page)) {
    if (item.type === 'heading' && item.anchor) anchors.add(item.anchor);
  }
  return anchors;
}

/**
 * Why `ref` (`slug` or `slug#anchor`) cannot be linked from a unit of
 * `grade`, or null when it can. Throws only if the page data itself is broken.
 */
export function prisaPageRefProblem(ref: string, grade: number): string | null {
  const [slug, anchor, extra] = ref.split('#');
  if (!slug || extra !== undefined) return `malformed page ref ${JSON.stringify(ref)}`;
  if (!SERVED_SLUGS.has(slug)) return `${slug} is not a served topic page`;
  const page = loadTopicPage(slug);
  if (page.grade !== grade) return `${slug} is grade ${page.grade}, expected ${grade}`;
  if (anchor !== undefined && !topicSectionAnchorIds(page).has(anchor)) {
    return `${slug} has no section anchor #${anchor}`;
  }
  return null;
}
