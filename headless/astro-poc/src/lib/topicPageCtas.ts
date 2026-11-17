/**
 * The worksheet CTA walk of a topic page: how the body flow splits into the
 * demo hero and the body, and which catalog topic each CTA's level buttons
 * come from. TopicPage.astro renders from this walk and the JSON-LD hasPart
 * list (topicStructuredData.ts) reads the same walk, so the PDFs the schema
 * names are the PDFs the page links.
 */
import { landingLoopHasDemo, topicLandingLoop } from './landingLoops';
import type { TopicBodyFlowItem, TopicPageContent } from './topicPages';

export type TopicCtaItem = Extract<TopicBodyFlowItem, { type: 'cta' }>;
type TopicTextBlock = Extract<TopicBodyFlowItem, { type: 'paragraph' | 'list' }>;

/** Group flow so H2 sections nest following paragraphs/lists; CTAs stay ordered siblings. */
export type TopicBodyUnit =
  | { kind: 'intro'; text: string }
  | { kind: 'cta'; item: TopicCtaItem }
  | {
      kind: 'section';
      heading: string;
      /** Optional section anchor from the page data, rendered as the H2 id (SEO-2). */
      anchor?: string;
      blocks: TopicTextBlock[];
    }
  | { kind: 'orphan'; item: TopicTextBlock };

export function groupTopicBodyFlow(flow: readonly TopicBodyFlowItem[]): TopicBodyUnit[] {
  const units: TopicBodyUnit[] = [];
  let current: { heading: string; anchor?: string; blocks: TopicTextBlock[] } | null = null;
  const flush = () => {
    if (current) {
      units.push({ kind: 'section', heading: current.heading, anchor: current.anchor, blocks: current.blocks });
      current = null;
    }
  };
  for (const b of flow) {
    if (b.type === 'paragraph' && b.role === 'intro') {
      flush();
      units.push({ kind: 'intro', text: b.text });
      continue;
    }
    if (b.type === 'cta') {
      flush();
      units.push({ kind: 'cta', item: b });
      continue;
    }
    if (b.type === 'heading') {
      flush();
      current = { heading: b.text, anchor: b.anchor, blocks: [] };
      continue;
    }
    if (b.type === 'paragraph' || b.type === 'list') {
      if (current) current.blocks.push(b);
      else units.push({ kind: 'orphan', item: b });
    }
  }
  flush();
  return units;
}

/** A CTA links its own catalog topic, or the page's main topic when it names none. */
export function ctaCatalogTopicId(
  cta: { catalogTopicId?: number | null },
  topicId: number | null,
): number | null {
  return cta.catalogTopicId ?? topicId;
}

/** One level-button group in the demo hero. */
export interface TopicHeroCtaGroup {
  topicId: number | null;
  targetId: string;
  /** Index in heroUnits of the group's first CTA; -1 when the hero has no CTA. */
  firstUnit: number;
  /** Catalog href the group's worksheet links return to. */
  href: string | undefined;
}

export interface TopicPageCtaWalk {
  /** The page's main catalog topic. */
  topicId: number | null;
  hasDemo: boolean;
  bodyUnits: TopicBodyUnit[];
  /** Leading intro and CTA units shown beside the demo (empty without a demo). */
  heroUnits: TopicBodyUnit[];
  flowUnits: TopicBodyUnit[];
  /** A hero may offer several topics: one group per topic, or the main topic when the hero has no CTA. */
  heroGroups: TopicHeroCtaGroup[];
}

export function topicPageCtaWalk(
  page: Pick<TopicPageContent, 'slug' | 'grade' | 'catalogCta'>,
  bodyFlow: readonly TopicBodyFlowItem[],
  hasDemo: boolean = landingLoopHasDemo(topicLandingLoop(page)),
): TopicPageCtaWalk {
  const topicId = page.catalogCta?.catalogTopicId ?? null;
  const bodyUnits = groupTopicBodyFlow(bodyFlow);
  const bodyStart = bodyUnits.findIndex((unit) => unit.kind !== 'intro' && unit.kind !== 'cta');
  const heroEnd = bodyStart === -1 ? bodyUnits.length : bodyStart;
  const heroUnits = hasDemo ? bodyUnits.slice(0, heroEnd) : [];
  const flowUnits = hasDemo ? bodyUnits.slice(heroEnd) : bodyUnits;
  const heroGroups: TopicHeroCtaGroup[] = [];
  heroUnits.forEach((unit, index) => {
    if (unit.kind !== 'cta') return;
    const id = ctaCatalogTopicId(unit.item, topicId);
    if (heroGroups.some((group) => group.topicId === id)) return;
    heroGroups.push({ topicId: id, firstUnit: index,
      targetId: id === topicId ? 'topic-levels' : `topic-levels-hero-${id}`,
      href: unit.item.href });
  });
  if (!heroGroups.length) {
    heroGroups.push({ topicId, targetId: 'topic-levels', firstUnit: -1, href: page.catalogCta?.href });
  }
  return { topicId, hasDemo, bodyUnits, heroUnits, flowUnits, heroGroups };
}

/**
 * Catalog topics whose level buttons the page renders, in page order: the
 * pre-H1 CTAs, the demo hero, then the CTAs in the body. Once per topic.
 */
export function topicPageCtaTopicIds(
  page: Pick<TopicPageContent, 'preH1Ctas'>,
  walk: TopicPageCtaWalk,
): number[] {
  const ids: number[] = [];
  const add = (id: number | null) => {
    if (id != null && !ids.includes(id)) ids.push(id);
  };
  for (const cta of page.preH1Ctas || []) add(ctaCatalogTopicId(cta, walk.topicId));
  if (walk.hasDemo) for (const group of walk.heroGroups) add(group.topicId);
  for (const unit of walk.flowUnits) if (unit.kind === 'cta') add(ctaCatalogTopicId(unit.item, walk.topicId));
  return ids;
}
