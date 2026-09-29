/**
 * SEO closure: render-time H1/title fixes for topic pages. The topic JSON stays
 * equal to the production parity fixtures (tests/topic-parity-gate.test.ts), so
 * these are applied where the page is rendered (TopicPage, llms.txt).
 *
 * OPEN (Noam): if angles-grade-7 / adjacent-vertical-angles-grade-7 or
 * isosceles-triangle-properties-grade-8 / isosceles-triangle-grade-8 turn out
 * to be full duplicates, 301 the first to the second (that also removes the
 * page file). Until then they are kept apart by distinct H1s.
 * OPEN (Noam): special-triangles-grade-7-new stays the served slug; the old
 * /special-triangles-grade-7 already 301s to it (src/data/redirects.json).
 */
import type { TopicPageContent } from './topicPages';

export const TOPIC_H1_OVERRIDES: Readonly<Record<string, string>> = {
  'angles-grade-7': 'זוויות לכיתה ז׳',
  'isosceles-triangle-properties-grade-8': 'תכונות משולש שווה שוקיים לכיתה ח׳',
};

/** Production title is broken ("מפשטים ואז פותרים לכיתה ז – שטח משולש"). */
export const TOPIC_TITLE_OVERRIDES: Readonly<Record<string, string>> = {
  'triangle-area-grade-7': 'שטח משולש לכיתה ז׳',
};

export function topicH1(page: Pick<TopicPageContent, 'slug' | 'h1'>): string {
  return TOPIC_H1_OVERRIDES[page.slug] ?? page.h1;
}

export function topicTitle(page: Pick<TopicPageContent, 'slug' | 'title'>): string {
  return TOPIC_TITLE_OVERRIDES[page.slug] ?? TOPIC_H1_OVERRIDES[page.slug] ?? page.title;
}
