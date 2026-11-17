/**
 * Topic-page JSON-LD (SEO-4). The stored graph (WebPage, LearningResource,
 * Person, FAQPage) is kept; the LearningResource is tied to the official
 * curriculum unit, its PDF files and the site publisher.
 *
 * Curriculum units: src/data/curriculum-alignment.v1.json, built from the
 * official unit list all-units.csv (path and sha256 inside the file).
 */
import curriculumAlignment from '../data/curriculum-alignment.v1.json';
import type { CatalogV1 } from './catalog/types';
import { synthesizeBodyFlow, updatedLineIsoDate, type TopicPageContent } from './topicPages';
import { topicPageCtaTopicIds, topicPageCtaWalk, type TopicPageCtaWalk } from './topicPageCtas';
import { findCatalogTopic, topicEditionsSelectedFirst } from './topicWorksheetEditions';
import {
  educationalLevelForGrade,
  enrichLearningResourceJsonLd,
  jsonLdTypes,
  learningResourceJsonLd,
  type CurriculumAlignmentType,
} from './structuredData';

export interface CurriculumUnit {
  id: string;
  name: string;
  track: string;
  trackLabel: string;
  alignmentType: CurriculumAlignmentType;
}

type AlignmentFile = {
  tracks: Record<string, string>;
  units: Record<string, { track: string; name: string }>;
  pages: Record<string, Array<{ unit: string; alignmentType: CurriculumAlignmentType }>>;
};
const ALIGNMENT = curriculumAlignment as AlignmentFile;

/** Official units for a topic page, in file order. Empty when none is known. */
export function curriculumUnitsForTopicPage(slug: string): CurriculumUnit[] {
  return (ALIGNMENT.pages[slug] || []).map(({ unit, alignmentType }) => {
    const row = ALIGNMENT.units[unit];
    if (!row) throw new Error(`curriculum-alignment: unknown unit ${unit} on ${slug}`);
    return {
      id: unit,
      name: row.name,
      track: row.track,
      trackLabel: ALIGNMENT.tracks[row.track] || row.track,
      alignmentType,
    };
  });
}

/** Catalog topics whose worksheet links the page renders, by the walk TopicPage.astro renders from. */
export function topicPageCatalogTopicIds(
  page: TopicPageContent,
  walk: TopicPageCtaWalk = topicPageCtaWalk(page, synthesizeBodyFlow(page)),
): number[] {
  return topicPageCtaTopicIds(page, walk);
}

const PDF_SUFFIX = /\s*[·—-]\s*PDF$/;

/**
 * The PDF files behind the page's level buttons, in the order the page shows
 * them (selected edition first), once per file.
 */
export function topicPagePdfParts(
  catalog: CatalogV1,
  grade: number,
  topicIds: readonly number[],
): { topicTitles: string[]; parts: Array<{ name: string; contentUrl: string }> } {
  const topicTitles: string[] = [];
  const parts: Array<{ name: string; contentUrl: string }> = [];
  for (const id of topicIds) {
    const topic = findCatalogTopic(catalog, grade, id);
    if (!topic) continue;
    if (!topicTitles.includes(topic.title)) topicTitles.push(topic.title);
    // The edition order of the page's edition lists (topicWorksheetEditionLinks).
    for (const edition of topicEditionsSelectedFirst(topic)) {
      const editionName = edition.editionId === 'legacy' ? '' : edition.label.replace(PDF_SUFFIX, '');
      for (const level of edition.levels) {
        const contentUrl = `${catalog.config.pdfBase}${level.pdfId}.pdf`;
        if (parts.some((part) => part.contentUrl === contentUrl)) continue;
        parts.push({
          name: [topic.title, editionName, level.label].filter(Boolean).join(' · '),
          contentUrl,
        });
      }
    }
  }
  return { topicTitles, parts };
}

/** Every JSON-LD block TopicPage emits, in order. */
export function topicPageJsonLdBlocks(
  page: TopicPageContent,
  catalog: CatalogV1,
  walk: TopicPageCtaWalk = topicPageCtaWalk(page, synthesizeBodyFlow(page)),
): Record<string, unknown>[] {
  const educationalLevel = educationalLevelForGrade(page.grade);
  const stored = page.jsonLd;
  const blocks = jsonLdTypes(stored).includes('LearningResource')
    ? [stored]
    : [
        stored,
        learningResourceJsonLd({
          name: page.h1,
          path: page.path,
          description: page.description,
          educationalLevel,
          dateModified: updatedLineIsoDate(page.updatedLine),
        }),
      ];
  const units = curriculumUnitsForTopicPage(page.slug);
  const { topicTitles, parts } = topicPagePdfParts(catalog, page.grade, topicPageCatalogTopicIds(page, walk));
  const taught = units.filter((unit) => unit.alignmentType === 'teaches').map((unit) => unit.name);
  return enrichLearningResourceJsonLd(blocks, {
    educationalLevel,
    alignment: units.map((unit) => ({
      targetName: unit.name,
      alignmentType: unit.alignmentType,
      targetDescription: unit.trackLabel,
    })),
    teaches: [...new Set(taught)],
    teachesFallback: topicTitles,
    pdfParts: parts,
  });
}
