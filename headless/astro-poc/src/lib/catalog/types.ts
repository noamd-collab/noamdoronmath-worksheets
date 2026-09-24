/**
 * Typed shape for headless/catalog/catalog.v1.json (contract version 1).
 * Kept intentionally close to the generated document — replaceable later for CMS.
 */

export type CatalogLevelKey = 'a' | 'b' | 'c' | 'one';

export interface CatalogLevel {
  key: CatalogLevelKey;
  label: string;
  pdfId: string;
  labelSource: string;
}

export interface CatalogRouting {
  resolvedNoamPrefix: string | null;
  aiHintShown: boolean;
  usesViewer: boolean;
  viewerPath: string | null;
  siblingPdfQuery: Record<string, string>;
}

export interface CatalogTopic {
  id: number;
  title: string;
  description?: string;
  note?: string;
  group: string;
  icon: string;
  parent?: number;
  noamTopicId?: string;
  levels: CatalogLevel[];
  routing: CatalogRouting;
}

export interface CatalogGroup {
  key: string;
  label: string;
  reducedProgram: boolean;
}

export interface CatalogGrade {
  grade: number;
  label: string;
  emoji?: string;
  groups: CatalogGroup[];
  topics: CatalogTopic[];
}

export interface CatalogV1 {
  contractVersion: number;
  sourceOfTruth: { path: string; authoritative: boolean; note?: string };
  config: {
    pdfBase: string;
    viewer: { enabled: boolean; path: string };
    levels: Array<{ key: string; label: string; cssClass: string }>;
    defaults: { oneLabel: string };
    elementaryGrades: number[];
    middleGrades: number[];
    gradeNames: Record<string, string>;
    gradeEmojis: Record<string, string>;
    trackGroups: string[];
    noamPrefixFallback: Record<string, Record<string, string>>;
  };
  icons: Record<string, string>;
  searchTerms: Record<string, Record<string, string>>;
  grades: CatalogGrade[];
}
