import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage, extractJsonLdFaq } from '../src/lib/topicPages.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { LESSON_LOOPS } from '../src/lib/lessonLoops.ts';
import { lessonMathParts } from '../src/lib/lessonMath.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';

const slug = 'rational-equations-grade-9';
const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');
const page = loadTopicPage(slug);

test('the authored rational-equation page describes the reviewed PDF scope without promising unavailable tools', () => {
  assert.equal(page.h1, 'משוואות רציונליות לכיתה ט׳');
  assert.match(page.verifiedVia ?? '', /^authored-catalog-gap-rat01-pdf-review-/);
  assert.equal(page.catalogCta.href, '/worksheets?grade=9&topic=47');
  assert.equal(page.catalogCta.catalogTopicTitle, 'משוואות רציונליות');
  const visible = [page.h1, page.intro, page.description,
    ...page.sections.flatMap(section => section.blocks.map(block => block.text ?? '')),
    ...page.faq.flatMap(item => [item.question, item.answer])].join('\n');
  assert.match(visible, /תחום הצבה/);
  assert.match(visible, /קבילות/);
  assert.match(visible, /תרגול ממוקדת/);
  assert.match(visible, /PDF/);
  assert.doesNotMatch(visible, /רמזי|נועם AI|\bWord\b|יחידה מלאה|כל יחידת/);
  assert.doesNotMatch(visible, /\d\s*\/\s*[\d(x]/);
  assert.deepEqual(extractJsonLdFaq(page.jsonLd), page.faqGroups.flatMap(group => group.items));
  const graph = page.jsonLd['@graph'] as Array<Record<string, unknown>>;
  const web = graph.find(item => item['@type'] === 'WebPage')!;
  assert.equal(web.url, 'https://www.noamdoronmath.co.il/rational-equations-grade-9');
  assert.equal(web.description, page.description);
});

test('the domain demonstration excludes the forbidden zero denominator and retains the actual solution', () => {
  const loop = topicLandingLoop(page);
  assert.deepEqual(loop, { kind: 'css', variant: 'rational-domain', marker: 'rational-domain' });
  const lesson = LESSON_LOOPS['rational-domain'];
  assert.equal(lesson.picture, 'calculation');
  const first = lessonMathParts(lesson.steps[0].math);
  const fraction = first.find(part => typeof part !== 'string');
  assert.deepEqual(fraction, { numerator: '(x²−16)', denominator: '(x−4)' });
  assert.match(lesson.steps[0].math, /x ≠ 4/);
  assert.ok(first.every(part => typeof part !== 'string' || !part.includes('⟨')));
  const candidates = [...lesson.steps[1].math.matchAll(/x = ([−-]?\d+)/g)]
    .map(match => Number(match[1].replace('−', '-')));
  const admissible = candidates.filter(x => x !== 4 && (x * x - 16) / (x - 4) === 0);
  const final = /^x = ([−-]?\d+)$/.exec(lesson.steps[2].math)!;
  assert.deepEqual(candidates, [-4, 4]);
  assert.deepEqual(admissible, [Number(final[1].replace('−', '-'))]);
  assert.deepEqual(admissible, [-4]);
  assert.equal(Number.isFinite((4 * 4 - 16) / (4 - 4)), false);
  assert.match(lesson.steps[2].text, /4 אסור/);
});

test('the grade hub links the new topic once while retaining the distinct fraction-reduction topic', () => {
  const hub = loadGradeHub(9);
  for (const links of [hub.topicLinks, hub.topicSections.flatMap(section => section.links)]) {
    assert.equal(links.filter(link => link.path === `/${slug}`).length, 1);
    assert.ok(links.some(link => link.path === '/algebraic-fractions-grade-9'));
    assert.ok(links.some(link => link.path === '/quadratic-equations-grade-9'));
  }
  assert.match(plain(hub.intro), /בדפים המחוברים לנועם AI/);
  const old = JSON.parse(readFileSync(new URL('../src/data/topic-pages/algebraic-fractions-grade-9.json', import.meta.url), 'utf8'));
  assert.equal(old.catalogCta.catalogTopicId, 3);
});
