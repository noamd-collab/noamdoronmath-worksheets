/** Shapes of the site search index (src/data/search-index.v1.json) and its answers. */

export type SearchKind = 'topic' | 'page' | 'post';

export interface IndexLevel {
  key: string;
  label: string;
  pdfId: string;
}

export interface IndexRouting {
  resolvedNoamPrefix: string | null;
  usesViewer: boolean;
  siblingPdfQuery: Record<string, string>;
}

export interface IndexTopic {
  id: number;
  levels: IndexLevel[];
  routing: IndexRouting;
  /** Grade 9 reduced-program (3 יח״ל) track. */
  reduced?: boolean;
  /** Sub-topics shown inside this card, as on the catalog page. */
  children?: Array<{ id: number; title: string; levels: IndexLevel[]; routing: IndexRouting }>;
}

export interface SearchDoc {
  /** topic:G:T, page:/path or post:fileSlug */
  key: string;
  kind: SearchKind;
  grade: number | null;
  title: string;
  description?: string;
  href: string;
  /** Catalog group label (topics). */
  group?: string;
  topic?: IndexTopic;
  /** Verified catalog topic this page or post explains (see buildIndex). */
  topicKey?: string;
  /** Normalised text per field: t = title, c = sub-topics, s = search terms, g = group, d = description. */
  f: { t: string; c?: string; s?: string; g?: string; d?: string };
  order: number;
}

export interface SearchIndex {
  version: 1;
  /** Catalog config needed to build worksheet links (buildWorksheetHref). */
  config: { pdfBase: string; viewer: { enabled: boolean; path: string }; middleGrades: number[] };
  gradeLabels: Record<string, string>;
  docs: SearchDoc[];
}

export interface TitlePart {
  text: string;
  hit: boolean;
}

export interface LevelLink {
  label: string;
  href: string;
  /** Sub-topic title when the card bundles sub-topics. */
  of?: string;
}

export interface SearchResult {
  key: string;
  /** Every benchmark key this card stands for (topic + its explainer page + posts). */
  keys: string[];
  kind: SearchKind;
  grade: number | null;
  gradeLabel: string | null;
  title: string;
  titleParts: TitlePart[];
  description?: string;
  href: string;
  group?: string;
  reduced?: boolean;
  levels: LevelLink[];
  explainers: Array<{ title: string; href: string }>;
  posts: Array<{ title: string; href: string }>;
  score: number;
}

export interface SearchResponse {
  query: string;
  /** Binding grade and where it came from. */
  grade: number | null;
  gradeSource: 'query' | 'selected' | null;
  /** Query text without grade words (for links that drop the grade). */
  textWithoutGrade: string;
  /** Spelling guesses used for words the site does not contain. Shown as a guess. */
  corrections: Array<{ from: string; to: string }>;
  results: SearchResult[];
  /** When a grade is binding: matches in other grades (not shown as results). */
  otherGrades: Array<{ grade: number; label: string; count: number }>;
  /** When nothing matches: narrower queries that do (one per word). */
  suggestions: Array<{ query: string; count: number }>;
  /** Query had no searchable words. */
  empty: boolean;
}
