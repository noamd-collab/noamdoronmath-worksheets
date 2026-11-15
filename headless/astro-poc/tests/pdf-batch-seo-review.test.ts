import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage } from '../src/lib/topicPages';
import { classifyTopicFamily, familyRelatedTopics } from '../src/lib/topicFamilies';
import { LESSON_LOOPS } from '../src/lib/lessonLoops';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('MED renders its authored prerequisites and applications, with one reciprocal rectangle link', () => {
  const med = loadTopicPage('median-to-hypotenuse-grade-9');
  assert.equal(classifyTopicFamily(med.slug), 'geometry');
  assert.deepEqual(med.relatedTopics.map(r => r.path), [
    '/grade-9', '/triangle-median-grade-8', '/rectangle-grade-9', '/analytic-geometry-grade-9',
  ]);
  const rectangle = loadTopicPage('rectangle-grade-9');
  assert.deepEqual(rectangle.relatedTopics.map(r => r.path), [
    ...familyRelatedTopics(rectangle.slug, 9).map(r => r.path), '/median-to-hypotenuse-grade-9',
  ]);
});

test('new PDF additions show their real update date in visible text and structured data', () => {
  for (const slug of ['rectangle-grade-9', 'relative-frequency-experiments-grade-7']) {
    const page = loadTopicPage(slug);
    assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 15.11.2026');
    const graph = page.jsonLd['@graph'] as Record<string, unknown>[];
    const dated = graph.filter(n => ['WebPage', 'LearningResource'].includes(String(n['@type'])));
    assert.equal(dated.length, 2);
    assert.ok(dated.every(n => n.dateModified === '2026-11-15'));
  }
});

test('MED worked examples use different givens from the worksheet examples and stay consistent with the animation', () => {
  const page = JSON.parse(read('../src/data/topic-pages/median-to-hypotenuse-grade-9.json'));
  const text = page.sections.flatMap((s: any) => s.blocks.map((b: any) => b.text)).join('\n');
  assert.match(text, /BC הוא 16 ס״מ/);
  assert.match(text, /אורכו 8 ס״מ/);
  assert.match(text, /ליתר הוא 11 ס״מ/);
  assert.match(text, /אורכו 22 ס״מ/);
  assert.doesNotMatch(text, /BC הוא 10 ס״מ|ליתר הוא 7 ס״מ/);
  const steps = LESSON_LOOPS['hypotenuse-median'].steps;
  assert.equal(steps[0].math, '∠A = 90°; BC = 16');
  assert.equal(steps[2].math, 'AM = 8');
  assert.equal(16 / 2, 8); assert.equal(2 * 11, 22);
});

test('the public legacy catalog retains the exact corrected MED title from the root catalog', () => {
  const root = read('../../../index.html');
  const legacy = read('../public/legacy-github/index.html');
  assert.match(legacy, /id:48, ic:"tritick", g:"geo", t:"משולש ישר־זווית — התיכון ליתר"/);
  assert.equal(legacy, root);
});
