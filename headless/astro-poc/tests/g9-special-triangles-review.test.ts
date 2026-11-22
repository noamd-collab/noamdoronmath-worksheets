/**
 * Grade 9 topic 21 has its own landing. The equilateral page keeps the
 * worksheet link that was added with the catalog topic.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage, TOPIC_PAGE_SLUGS } from '../src/lib/topicPages.ts';

describe('grade 9 special triangles review', () => {
  it('every grade 9 catalog topic has its own primary landing, 53 in all', () => {
    const topics = loadCatalog().grades.find((grade) => grade.grade === 9)!.topics;
    assert.equal(topics.length, 53);
    const owners = new Map<number, string>();
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      if (page.grade !== 9) continue;
      const id = page.catalogCtas[0].catalogTopicId!;
      assert.equal(owners.has(id), false, `${slug} repeats topic ${id}`);
      owners.set(id, slug);
    }
    assert.equal(owners.size, 53);
    assert.equal(owners.get(21), 'special-triangles-review-grade-9');
    const page = loadTopicPage('special-triangles-review-grade-9');
    assert.equal(page.catalogCta.href, '/worksheets?grade=9&topic=21');
    assert.equal(page.catalogCta.catalogTopicTitle, 'משולשים מיוחדים — חזרה מכיתה ז׳');
    assert.equal(topicLandingLoop(page).variant, 'isosceles');
    const hub = loadGradeHub(9);
    assert.ok(hub.topicLinks.some((link) => link.path === page.path));
    const equilateral = loadTopicPage('equilateral-triangle-grade-9');
    assert.ok(equilateral.catalogCtas.some((cta) => cta.href === '/worksheets?grade=9&topic=21')
      || (equilateral.bodyFlow ?? []).some((item) => item.type === 'cta' && item.href === '/worksheets?grade=9&topic=21'));
    assert.ok(equilateral.relatedTopics.some((link) => link.path === page.path));
  });
});
