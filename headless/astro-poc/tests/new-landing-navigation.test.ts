import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { conversationRecords, groundModelPayload } from '../../../noam-ai/site-companion/companion.js';
import { retrieveGuide } from '../../../noam-ai/site-companion/retrieve.js';
import { loadAllTopicPages, type TopicPageContent } from '../src/lib/topicPages';
import { prepareIndex, search } from '../src/lib/siteSearch/engine';
import type { SearchIndex } from '../src/lib/siteSearch/types';

type GuideRecord = { id: string; type: string; href: string; grade?: number; title: string };
type Guide = { counts: Record<string, number>; records: GuideRecord[] };
const data = new URL('../src/data/', import.meta.url);
const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, data), 'utf8'));
// Read the inventory independently of the route registry and generated indexes.
// A forgotten import or regeneration must not silently remove a landing page.
const pages = readdirSync(new URL('topic-pages/', data))
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => readJson<TopicPageContent>(`topic-pages/${name}`));
const redirects = readJson<{ rules: Array<{ from: string; to: string }> }>('redirects.json').rules;
const redirectedPaths = new Set(redirects.map((rule) => rule.from));
const canonicalPages = pages.filter((page) => !redirectedPaths.has(page.path));
const newPages = pages.filter((page) => page.verifiedVia?.startsWith('authored-catalog-gap'));
const guide = readJson<Guide>('site-guide.v1.json');
const index = readJson<SearchIndex>('search-index.v1.json');
const prepared = prepareIndex(index);

describe('landing-page navigation coverage', () => {
  it('registers every canonical topic-data page as a route', () => {
    assert.deepEqual(
      loadAllTopicPages().map((page) => page.path).sort(),
      canonicalPages.map((page) => page.path).sort(),
    );
  });

  it('includes every topic page exactly once in the committed Noam AI guide', () => {
    const topics = guide.records.filter((record) => record.type === 'topic');
    assert.equal(guide.counts.topic, pages.length);
    assert.deepEqual(topics.map((record) => record.href).sort(), pages.map((page) => page.path).sort());
    for (const page of pages) {
      const record = topics.find((row) => row.id === `topic-${page.slug}`);
      assert.ok(record, page.slug);
      assert.equal(record.href, page.path, page.slug);
      assert.equal(record.grade, page.grade, page.slug);
    }
  });

  it('includes every canonical landing page in the search index with its correct grade', () => {
    for (const page of canonicalPages) {
      const matches = index.docs.filter((doc) => doc.kind === 'page' && doc.href === page.path);
      assert.equal(matches.length, 1, page.slug);
      assert.equal(matches[0].key, `page:${page.path}`, page.slug);
      assert.equal(matches[0].grade, page.grade, page.slug);
    }
  });

  it('finds each new catalog-gap page through search and guide retrieval', () => {
    assert.ok(newPages.length > 0, 'the catalog-gap release must contain landing pages');
    for (const page of newPages) {
      const response = search(prepared, page.h1, { grade: page.grade });
      const links = response.results.flatMap((result) => [result.href, ...result.explainers.map((link) => link.href)]);
      assert.ok(links.includes(page.path), `search: ${page.slug}`);
      const retrieved = retrieveGuide(guide, page.h1, 8, { path: page.path, title: page.h1 });
      assert.ok(retrieved.some((record: GuideRecord) => record.href === page.path), `guide: ${page.slug}`);
      const indexed = index.docs.find((doc) => doc.key === `page:${page.path}`)!;
      assert.equal(indexed.topicKey, `topic:${page.grade}:${page.catalogCta!.catalogTopicId}`, page.slug);
    }
  });

  it('grounds new-page navigation in the guide and discards invented destinations', () => {
    const inventedId = 'topic-invented-landing-page';
    const inventedHref = 'https://invented.example/not-a-site-page';
    for (const page of newPages) {
      const input = { message: page.h1, page: { kind: 'topic', path: page.path, title: page.h1 } };
      const records = conversationRecords(guide, input);
      const result = groundModelPayload({
        answer: `פתיחת דף הנושא ${inventedHref}`,
        details: `קישור שלא קיים ${inventedHref}`,
        primaryRecordId: `topic-${page.slug}`,
        // Model-supplied hrefs must never override the canonical record.
        primary: { href: inventedHref },
        chipRecordIds: [inventedId, `topic-${page.slug}`],
      }, records, input);
      assert.equal(result.primary?.href, page.path, page.slug);
      assert.deepEqual(result.links.map((link: { href: string }) => link.href), [page.path], page.slug);
      assert.deepEqual(result.chips, [], page.slug);
      assert.equal(result.answer.includes(inventedHref), false, page.slug);
      assert.equal(result.details.includes(inventedHref), false, page.slug);
      const unknown = groundModelPayload({
        answer: 'דף שלא קיים', primaryRecordId: inventedId, chipRecordIds: [inventedId],
        primary: { href: inventedHref },
      }, records, input);
      assert.equal(unknown.primary, null, page.slug);
      assert.deepEqual(unknown.links, [], page.slug);
      assert.deepEqual(unknown.chips, [], page.slug);
    }
  });
});
