/**
 * Navigation from grade hubs and the worksheets catalog to elementary topic pages.
 * Labels and group headings come from topic-page and catalog data. No invented copy.
 */
import { loadCatalog } from './catalog/loadCatalog';
import {
  TOPIC_PAGE_AUTHORED_SLUGS,
  loadAllTopicPages,
  loadTopicPage,
  type TopicPageContent,
} from './topicPages';

export interface ElementaryTopicLink {
  href: string;
  label: string;
  slug: string;
}

export interface ElementaryTopicSection {
  heading: string;
  links: ElementaryTopicLink[];
}

function catalogTitle(page: TopicPageContent): { id: number; label: string } {
  const id = page.catalogCta?.catalogTopicId;
  const label = page.catalogCta?.catalogTopicTitle?.trim() ?? '';
  if (id == null || !label) {
    throw new Error(`${page.slug}: missing catalog topic id or title`);
  }
  return { id, label };
}

/** Grade-hub sections for one elementary grade, in catalog group order. */
export function elementaryTopicSections(grade: number): ElementaryTopicSection[] {
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) return [];
  const entry = loadCatalog().grades.find((g) => g.grade === grade);
  if (!entry) throw new Error(`missing catalog grade ${grade}`);

  const pages = TOPIC_PAGE_AUTHORED_SLUGS.map((slug) => loadTopicPage(slug)).filter(
    (page) => page.grade === grade
  );
  const byTopic = new Map<number, TopicPageContent[]>();
  for (const page of pages) {
    const { id } = catalogTitle(page);
    const topic = entry.topics.find((item) => item.id === id);
    if (!topic) throw new Error(`${page.slug}: catalog topic ${id} is not in grade ${grade}`);
    const list = byTopic.get(id) ?? [];
    list.push(page);
    byTopic.set(id, list);
  }
  for (const [id, list] of byTopic) {
    if (list.length > 1) {
      throw new Error(
        `grade ${grade} topic ${id} maps to more than one page: ${list.map((page) => page.slug).join(', ')}`
      );
    }
  }

  const linked = new Set<string>();
  const sections = entry.groups
    .map((group) => {
      const links = entry.topics
        .filter((topic) => topic.group === group.key)
        .flatMap((topic) => byTopic.get(topic.id) ?? [])
        .map((page) => {
          linked.add(page.slug);
          const { label } = catalogTitle(page);
          return { href: page.path, label, slug: page.slug };
        });
      return { heading: group.label, links };
    })
    .filter((section) => section.links.length > 0);

  for (const page of pages) {
    if (!linked.has(page.slug)) {
      throw new Error(`${page.slug} is not in a grade ${grade} topic group`);
    }
  }
  return sections;
}

/**
 * Unique catalog topic → topic page. A grade+topic with two pages is omitted
 * so a worksheet card title is not pointed at an arbitrary page.
 */
export function topicPageHrefByCatalogTopic(): Record<string, string> {
  const groups = new Map<string, string[]>();
  for (const page of loadAllTopicPages()) {
    const id = page.catalogCta?.catalogTopicId;
    if (id == null || !page.path.startsWith('/')) continue;
    const key = `${page.grade}:${id}`;
    const list = groups.get(key) ?? [];
    list.push(page.path);
    groups.set(key, list);
  }
  const out: Record<string, string> = {};
  for (const [key, paths] of groups) {
    const unique = [...new Set(paths)];
    if (unique.length === 1) out[key] = unique[0];
  }
  return out;
}
