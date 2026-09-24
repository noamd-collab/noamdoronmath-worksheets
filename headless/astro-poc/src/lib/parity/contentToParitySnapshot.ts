/**
 * Project TopicPageContent → TopicParitySnapshot for offline SOURCE↔content checks.
 * Preview DOM snapshots use the capture script; this maps migrated JSON to the same shape.
 */
import type { TopicPageContent } from '../topicPages.ts';
import type { TopicParitySnapshot } from './topicParity.ts';
import { extractJsonLdFaq, synthesizeBodyFlow } from '../topicPages.ts';

export function contentToParitySnapshot(
  page: TopicPageContent,
  source: 'production' | 'preview' = 'preview'
): TopicParitySnapshot {
  const graph = (page.jsonLd['@graph'] as Record<string, unknown>[] | undefined) || [];
  const types: string[] = [];
  for (const node of graph) {
    const t = node['@type'];
    if (typeof t === 'string') types.push(t);
    if (Array.isArray(t)) types.push(...t.map(String));
  }
  const ctas = (page.catalogCtas?.length ? page.catalogCtas : [page.catalogCta]).map((c) => ({
    href: c.href,
    label: c.label,
  }));
  const bodyFlow = synthesizeBodyFlow(page).map((b) => {
    if (b.type === 'cta') {
      return {
        type: 'cta' as const,
        label: b.label,
        href: b.href,
        catalogTopicId: b.catalogTopicId ?? null,
      };
    }
    if (b.type === 'paragraph') {
      return { type: 'paragraph' as const, text: b.text, role: b.role };
    }
    if (b.type === 'heading') return { type: 'heading' as const, text: b.text };
    return { type: 'list' as const, ordered: !!b.ordered, items: b.items };
  });
  return {
    slug: String(page.slug),
    source,
    url: page.sourceUrl,
    capturedAt: page.fetchedAt,
    title: page.title,
    description: page.description,
    h1: page.h1,
    intro: page.intro,
    updatedLine: page.updatedLine || null,
    authorLine: page.author.text,
    authorAboutHref: page.author.links.find((l) => l.href.includes('aboutus'))?.href || null,
    sections: page.sections.map((s) => ({
      heading: s.heading || '',
      paragraphs: s.blocks.filter((b) => b.type === 'paragraph' && b.text).map((b) => b.text!),
      listItems: s.blocks.filter((b) => b.type === 'list').flatMap((b) => b.items || []),
    })),
    bodyFlow,
    faqGroups: page.faqGroups.map((g) => ({
      heading: g.heading,
      items: g.items.map((i) => ({ question: i.question, answer: i.answer })),
    })),
    relatedLinks: page.relatedTopics.map((r) => ({
      href: r.productionHref,
      label: r.label,
    })),
    catalogCta: ctas[0] || null,
    catalogCtas: ctas,
    images: (page.images || [])
      .filter((i) => i.role === 'content-candidate' || i.role === 'og')
      .map((i) => ({ src: i.src, alt: i.alt })),
    jsonLd: {
      types,
      faq: extractJsonLdFaq(page.jsonLd),
    },
  };
}
