/**
 * Which catalog topics have a landing page. A topic is covered when a topic
 * page of its grade links its worksheets (catalog CTA or body CTA), or when it
 * is a child topic rendered inside a covered parent's worksheet card.
 */
import { loadCatalog } from './catalog/loadCatalog';
import { TOPIC_PAGE_SLUGS, loadTopicPage } from './topicPages';

export interface CatalogTopicCoverage {
  grade: number;
  topicId: number;
  title: string;
  slugs: string[];
  coveredByParent: number | null;
}

function worksheetTopic(href: string | undefined): { grade: number; topicId: number } | null {
  if (!href) return null;
  const match = /^\/worksheets\?grade=(\d+)&topic=(\d+)$/.exec(href);
  return match ? { grade: Number(match[1]), topicId: Number(match[2]) } : null;
}

function pagesByTopic(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const slug of TOPIC_PAGE_SLUGS) {
    const page = loadTopicPage(slug);
    const hrefs = [
      ...(page.catalogCtas ?? []).map((cta) => cta.href),
      ...(page.preH1Ctas ?? []).map((cta) => cta.href),
      ...(page.bodyFlow ?? []).flatMap((item) => (item.type === 'cta' ? [item.href] : [])),
    ];
    for (const href of hrefs) {
      const topic = worksheetTopic(href);
      if (!topic || topic.grade !== page.grade) continue;
      const key = `${topic.grade}-${topic.topicId}`;
      if (!out.has(key)) out.set(key, new Set());
      out.get(key)!.add(slug);
    }
  }
  return out;
}

export function catalogLandingCoverage(grade: number): CatalogTopicCoverage[] {
  const catalogGrade = loadCatalog().grades.find((g) => g.grade === grade);
  if (!catalogGrade) throw new Error(`No catalog grade ${grade}`);
  const byTopic = pagesByTopic();
  return catalogGrade.topics.map((topic) => {
    const slugs = [...(byTopic.get(`${grade}-${topic.id}`) ?? [])].sort();
    const parent = (topic as { parent?: number | null }).parent ?? null;
    const parentCovered = parent != null && (byTopic.get(`${grade}-${parent}`)?.size ?? 0) > 0;
    return {
      grade,
      topicId: topic.id,
      title: topic.title,
      slugs,
      coveredByParent: slugs.length === 0 && parentCovered ? parent : null,
    };
  });
}

export function uncoveredCatalogTopics(grade: number): CatalogTopicCoverage[] {
  return catalogLandingCoverage(grade).filter((row) => row.slugs.length === 0 && row.coveredByParent == null);
}
