/**
 * GEO related-topic families. Algebra identity terms beat geometry's "square".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadAllTopicPages, loadTopicPage } from '../src/lib/topicPages.ts';
import { classifyTopicFamily } from '../src/lib/topicFamilies.ts';
import { resolveSiteHrefString } from '../src/lib/resolveSiteHref.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('topic family classification', () => {
  it('prefers algebra identity terms over geometry square', () => {
    assert.equal(classifyTopicFamily('binomial-square-grade-9'), 'algebra');
    assert.equal(classifyTopicFamily('/binomial-square-grade-9'), 'algebra');
    assert.equal(classifyTopicFamily('difference-of-squares-grade-9'), 'algebra');
    assert.equal(classifyTopicFamily('square-of-sum-grade-9'), 'algebra');
    assert.equal(classifyTopicFamily('expansion-grade-8'), 'algebra');
    assert.equal(classifyTopicFamily('square-grade-9'), 'geometry');
    assert.equal(classifyTopicFamily('square-root-grade-7'), 'geometry');
    assert.equal(classifyTopicFamily('quadratic-function-grade-9'), 'graphs');
    assert.equal(classifyTopicFamily('signed-numbers-grade-7'), 'algebra');
    assert.equal(classifyTopicFamily('percentage-problems-grade-8'), 'algebra');
    assert.equal(classifyTopicFamily('transition-to-high-school-grade-9'), 'default');
  });

  it('binomial-square renders algebra related topics and a crawlable grade-9 link', () => {
    const page = loadTopicPage('binomial-square-grade-9');
    assert.equal(classifyTopicFamily(page.slug), 'algebra');
    assert.deepEqual(
      page.relatedTopics.map((r) => r.path),
      [
        '/grade-9',
        '/factoring-grade-9',
        '/quadratic-equations-grade-9',
        '/quadratic-function-grade-9',
      ]
    );
    assert.ok(
      page.relatedTopics.every((r) => r.path !== '/similar-triangles-grade-9'),
      'geometry related topics must not win'
    );
    assert.equal(page.gradeHubHref, '/grade-9');
    const topicPage = readFileSync(join(root, 'src', 'components', 'TopicPage.astro'), 'utf8');
    assert.match(topicPage, /<a href=\{page\.gradeHubHref\}>/);
    assert.equal(page.sourceRelatedTopics?.[0]?.path, '/similar-triangles-grade-9');
  });

  it('every topic page related block links to its grade hub', () => {
    const pages = loadAllTopicPages();
    assert.ok(pages.length >= 90);
    for (const page of pages) {
      const hrefs = page.relatedTopics.map((rel) =>
        resolveSiteHrefString(rel.productionHref || rel.path)
      );
      const hub = `/grade-${page.grade}`;
      assert.ok(hrefs.includes(hub), `${page.slug} related block missing ${hub}`);
      assert.equal(page.gradeHubHref, hub);
      assert.equal(
        hrefs.filter((href) => href === hub).length,
        1,
        `${page.slug} duplicates ${hub}`
      );
    }
    const algebra = loadTopicPage('factoring-grade-9');
    const geometry = loadTopicPage('square-grade-9');
    const graphs = loadTopicPage('reading-graphs-grade-9');
    assert.equal(algebra.relatedTopics[0].path, '/grade-9');
    assert.equal(geometry.relatedTopics[0].path, '/grade-9');
    assert.equal(graphs.relatedTopics[0].path, '/grade-9');
    assert.equal(loadTopicPage('transition-to-high-school-grade-9').relatedTopics[0].path, '/grade-9');
  });

  it('difference-of-squares is algebra, not the square geometry set', () => {
    const page = loadTopicPage('difference-of-squares-grade-9');
    assert.deepEqual(
      page.relatedTopics.map((r) => r.path),
      [
        '/grade-9',
        '/factoring-grade-9',
        '/quadratic-equations-grade-9',
        '/quadratic-function-grade-9',
      ]
    );
  });
});
