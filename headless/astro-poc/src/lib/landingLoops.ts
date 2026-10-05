/**
 * Landing-page loop coverage.
 *
 * Topic/grade/marketing landings must expose one looping animation.
 * Pages that already mount a ConceptLoop keep that film (protected engine).
 * Every other landing gets a CSS/SVG variant from LandingLoop.astro.
 * triangle-area-grade-7 keeps its explorer; the explorer glides once, so it
 * still needs a real loop.
 */
import topicFamilies from '../data/topicFamilies.json';
import type { TopicPageContent } from './topicPages';

/** Same mount list TopicPage used before this change (F01–F06, F21, F26, F38). */
export const FAMILY_CONCEPT_LOOP = {
  F01: 'sticks',
  F02: 'numberline',
  F03: 'tenframes',
  F04: 'balance',
  F05: 'pattern',
  F06: 'bars',
  F21: 'area-model',
  F26: 'triangle',
  F38: 'pythagoras',
} as const;

export type ConceptLoopVariant = (typeof FAMILY_CONCEPT_LOOP)[keyof typeof FAMILY_CONCEPT_LOOP];

/** CSS/SVG loops. Transform and opacity only. */
export const CSS_LOOP_VARIANTS = [
  'powers',
  'roots',
  'signed',
  'order',
  'percent',
  'angles',
  'area',
  'quads',
  'triangles',
  'similar',
  'congruence',
  'circle',
  'round-solid',
  'solids',
  'coords',
  'linear',
  'parabola',
  'systems',
  'stats',
  'probability',
  'transform',
  'triangle-area',
  'tools',
] as const;

export type CssLoopVariant = (typeof CSS_LOOP_VARIANTS)[number];

const FAMILY_CSS_LOOP: Record<string, CssLoopVariant> = {
  F10: 'stats',
  F14: 'transform',
  F15: 'coords',
  F16: 'angles',
  F17: 'area',
  F18: 'triangles',
  F19: 'quads',
  F20: 'order',
  F28: 'stats',
  F29: 'probability',
  F31: 'solids',
  F32: 'percent',
  F34: 'similar',
  F35: 'coords',
  F36: 'signed',
  F37: 'powers',
  F39: 'circle',
  F40: 'parabola',
  F41: 'linear',
  F42: 'congruence',
  F43: 'systems',
};

/** Finer than the family when the page's own idea is narrower. */
const SLUG_CSS_OVERRIDE: Record<string, CssLoopVariant> = {
  'triangle-area-grade-7': 'triangle-area',
  'square-root-grade-7': 'roots',
  'square-roots-grade-9': 'roots',
  'cone-grade-8': 'round-solid',
  'cylinder-surface-area-grade-8': 'round-solid',
  'cylinder-volume-grade-8': 'round-solid',
  'transition-to-high-school-grade-9': 'parabola',
};

export const GRADE_CONCEPT_LOOP = {
  1: 'tenframes',
  2: 'sticks',
  3: 'bars',
  4: 'numberline',
  5: 'balance',
  6: 'pattern',
  7: 'triangle',
  8: 'pythagoras',
  9: 'area-model',
} as const;

export const MARKETING_LANDING_LOOPS = {
  'high-school-math': 'parabola',
  'math-tools': 'tools',
} as const satisfies Record<string, CssLoopVariant>;

/** Site pages that are policy/contact, not marketing landings. */
export const NON_LANDING_SITE_SLUGS = [
  'aboutus',
  'accessibilityadaptation',
  'terms',
  'conditionforfreeworksheets',
] as const;

export type LandingLoop =
  | { kind: 'concept'; variant: ConceptLoopVariant; marker: string }
  | { kind: 'css'; variant: CssLoopVariant; marker: string };

function familyOf(page: Pick<TopicPageContent, 'grade' | 'catalogCta'>): string | undefined {
  const topicId = page.catalogCta?.catalogTopicId ?? null;
  if (topicId == null) return undefined;
  return (topicFamilies as Record<string, string>)[`g${page.grade}-t${topicId}`];
}

export function topicLandingLoop(page: Pick<TopicPageContent, 'slug' | 'grade' | 'catalogCta'>): LandingLoop {
  const override = SLUG_CSS_OVERRIDE[page.slug];
  if (override) return { kind: 'css', variant: override, marker: override };
  const family = familyOf(page);
  const concept = family ? FAMILY_CONCEPT_LOOP[family as keyof typeof FAMILY_CONCEPT_LOOP] : undefined;
  if (concept) return { kind: 'concept', variant: concept, marker: `concept-${concept}` };
  const css = family ? FAMILY_CSS_LOOP[family] : undefined;
  if (!css) {
    throw new Error(`No landing loop for ${page.slug} (family ${family ?? 'none'})`);
  }
  return { kind: 'css', variant: css, marker: css };
}

export function marketingLandingLoop(slug: string): CssLoopVariant | undefined {
  return MARKETING_LANDING_LOOPS[slug as keyof typeof MARKETING_LANDING_LOOPS];
}
