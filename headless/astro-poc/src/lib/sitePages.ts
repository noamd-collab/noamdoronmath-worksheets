import aboutus from '../data/site-pages/aboutus.json';
import mathTools from '../data/site-pages/math-tools.json';
import accessibilityadaptation from '../data/site-pages/accessibilityadaptation.json';
import terms from '../data/site-pages/terms.json';
import conditionforfreeworksheets from '../data/site-pages/conditionforfreeworksheets.json';
import highSchoolMath from '../data/site-pages/high-school-math.json';

/** Explicit fold id. Renderers must key off this, not visible copy. */
export type SitePageRegion = 'calculator-preview';

type RegionMark = { region?: SitePageRegion };

/** Ordered content blocks for non-topic site / policy pages (M24). */
export type SitePageBlock =
  | ({ type: 'h2' | 'h3' | 'h4'; text: string } & RegionMark)
  | ({
      type: 'p';
      text: string;
      /** Isolate a math run so RTL does not reorder its symbols. */
      dir?: 'ltr';
      segments?: Array<{ type: 'text'; text: string } | { type: 'a'; text: string; href: string }>;
    } & RegionMark)
  | ({
      type: 'ul' | 'ol';
      items: Array<{ text: string; href?: string; linkText?: string }>;
    } & RegionMark)
  | ({ type: 'a'; text: string; href: string } & RegionMark)
  | ({ type: 'img'; src: string; alt: string } & RegionMark)
  | ({ type: 'iframe'; src: string; title?: string } & RegionMark)
  | ({
      type: 'contact';
      note: string;
      mailto: string;
      mailtoLabel: string;
      fieldsShownAsLabels: string[];
      /** Production Wix Forms evidence (read-only). Live submit not wired. */
      wixForm?: {
        formId: string;
        componentId?: string;
        metaSiteId?: string;
        siteId?: string;
        submitMode: 'dry-run' | 'mock' | 'live-blocked';
      };
    } & RegionMark);

export type SitePageContent = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  blocks: SitePageBlock[];
  jsonLd?: unknown[];
  legalIframeSrc?: string;
  legalBlocks?: SitePageBlock[];
  formSkipped?: boolean;
  source: {
    liveUrl: string;
    capturedAt: string;
    /** Paragraphs dropped on purpose, kept here so a later sync can see why. */
    removedOrphans?: Array<{ text: string; reason: string }>;
  };
};

export const SITE_PAGE_M24_SLUGS = [
  'aboutus',
  'math-tools',
  'accessibilityadaptation',
  'terms',
  'conditionforfreeworksheets',
  'high-school-math',
] as const;

/** Production redirects, served by the middleware from src/data/redirects.json (OPEN-15). */
export const SITE_PAGE_M24_REDIRECTS: ReadonlyArray<{ from: string; to: string }> = [
  { from: 'high-school-math-1', to: '/high-school-math' },
  { from: 'page', to: '/terms' },
];

/** Policy slugs (including former topic-seo misbucket). */
export const SITE_PAGE_POLICY_SLUGS = [
  'accessibilityadaptation',
  'terms',
  'conditionforfreeworksheets',
] as const;

export const SITE_PAGE_M24_UNMIGRATED: readonly string[] = [];

const BY_SLUG: Record<string, SitePageContent> = {
  aboutus: aboutus as SitePageContent,
  'math-tools': mathTools as SitePageContent,
  accessibilityadaptation: accessibilityadaptation as SitePageContent,
  terms: terms as SitePageContent,
  conditionforfreeworksheets: conditionforfreeworksheets as SitePageContent,
  'high-school-math': highSchoolMath as SitePageContent,
};

export function loadSitePage(slug: string): SitePageContent {
  const page = BY_SLUG[slug];
  if (!page) throw new Error(`Unknown site page slug: ${slug}`);
  return page;
}

import { resolveSiteHrefString } from './resolveSiteHref';

/** Map production absolute URLs for this site to local preview paths when served. */
export function localizeSiteHref(href: string): string {
  return resolveSiteHrefString(href);
}
