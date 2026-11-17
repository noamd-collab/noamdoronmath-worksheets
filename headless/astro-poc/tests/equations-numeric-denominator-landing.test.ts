import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage, extractJsonLdFaq } from '../src/lib/topicPages.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { LESSON_LOOPS } from '../src/lib/lessonLoops.ts';
import { lessonMathParts } from '../src/lib/lessonMath.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { parseWorksheetsUrlState, trackForPinnedTopic } from '../src/lib/worksheetsUrlState.ts';

const slug = 'equations-numeric-denominator-grade-9';
const plain = (text: string) => text.replace(/[⁦-⁩]/g, '');
const page = loadTopicPage(slug);
// Reviewed EQM01 PDFs (Antigravity PASS_STUDENT_PDF_ESSENTIALS, bound to these files' SHA-256).
const PDF_IDS = ['53fb5318e99546a6a6b12c06e118ba59', 'f5d9e89adee948768e456876b8e087cf', '038d9928b68942ca91f3a17ac6cf92b3'];

test('topic 49 opens the new reduced-track month group with exactly the three reviewed PDFs', () => {
  const grade9 = loadCatalog().grades.find(grade => grade.grade === 9)!;
  const topic = grade9.topics.find(item => item.id === 49)!;
  assert.equal(topic.title, 'משוואות עם מכנה מספרי');
  assert.equal(topic.group, 'r9jan');
  assert.equal(topic.publicationMode, 'pdf-only');
  assert.equal(topic.noamTopicId, undefined, 'a PDF-only topic has no Noam prefix');
  assert.deepEqual(topic.levels.map(level => [level.key, level.pdfId]), [['a', PDF_IDS[0]], ['b', PDF_IDS[1]], ['c', PDF_IDS[2]]]);
  assert.equal(topic.routing.usesViewer, false);
  assert.equal(topic.routing.aiHintShown, false);
  const reduced = grade9.groups.filter(group => group.reducedProgram);
  assert.deepEqual(reduced.map(group => [group.key, group.label]), [['r9sep', 'ספטמבר'], ['r9oct', 'אוקטובר'], ['r9jan', 'ינואר']]);
  // The landing CTA needs no &track: the pinned topic opens the reduced track.
  const state = parseWorksheetsUrlState(new URLSearchParams(page.catalogCta.href.split('?')[1]));
  assert.equal(state.topic, 49);
  assert.equal(trackForPinnedTopic(state, grade9), 'red');
});

test('the landing describes only the reviewed PDF scope, for ט׳ מצומצמת, without unavailable tools', () => {
  assert.equal(page.h1, 'משוואות עם מכנה מספרי לכיתה ט׳ מצומצמת');
  assert.match(page.title, /^משוואות עם מכנה מספרי לכיתה ט׳ מצומצמת — /);
  assert.match(page.verifiedVia ?? '', /^authored-catalog-gap-eqm01-pdf-review-/);
  assert.equal(page.catalogCta.href, '/worksheets?grade=9&topic=49');
  assert.equal(page.catalogCta.catalogTopicTitle, 'משוואות עם מכנה מספרי');
  assert.deepEqual(page.catalogCtas, [page.catalogCta]);
  assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 17.11.2026');
  const visible = plain([page.h1, page.intro, page.description,
    ...page.sections.flatMap(section => [section.heading ?? '', ...section.blocks.map(block => block.text ?? '')]),
    ...page.faq.flatMap(item => [item.question, item.answer])].join('\n'));
  for (const required of [/ט׳ מצומצמת/, /מכנה מספרי/, /מכנים מספריים/, /משוואות עם שברים/, /מכנה משותף|המכנה המשותף/,
    /סימן חיסור לפני שבר/, /משוואות מיוחדות/, /PDF/, /תשובות סופיות/, /רמה א׳/, /רמה ב׳/, /מצוינות/]) {
    assert.match(visible, required);
  }
  // Exact per-level counts from the producer catalog entry and the review receipt (19 + 19 + 18).
  assert.match(visible, /רמה א׳: שש שאלות ובהן תשעה־עשר סעיפים/);
  assert.match(visible, /רמה ב׳: שש שאלות ובהן תשעה־עשר סעיפים/);
  assert.match(visible, /מצוינות: שש שאלות ובהן שמונה־עשר סעיפים/);
  assert.doesNotMatch(visible, /רמה ג׳|רמזי|רמזים|נועם AI|\bWord\b|יחידה מלאה|כל יחידת|פתרונות מלאים|פתרון מלא/);
  assert.doesNotMatch(visible, /\d\s*\/\s*[\d(x]|x\s*\/\s*\d/);
  assert.deepEqual(extractJsonLdFaq(page.jsonLd), page.faqGroups.flatMap(group => group.items));
  const graph = page.jsonLd['@graph'] as Array<Record<string, unknown>>;
  const web = graph.find(item => item['@type'] === 'WebPage')!;
  const resource = graph.find(item => item['@type'] === 'LearningResource')!;
  assert.equal(web.url, `https://www.noamdoronmath.co.il/${slug}`);
  assert.equal(web.name, page.title);
  assert.equal(web.description, page.description);
  assert.equal(resource.description, page.description);
  assert.equal(resource.name, 'משוואות עם מכנה מספרי לכיתה ט׳ מצומצמת');
  assert.equal(web.dateModified, '2026-11-17');
});

test('only self-check answers sit behind the reveal button; every scope paragraph stays visible', () => {
  // TopicPage hides paragraph 2 (and any paragraph opening with התשובה) in a section whose
  // heading has בדקו/בדיקה, ends with '?' or opens with חשבו/פתרו/מהו/באיזה/מצאו.
  const isCheck = (heading: string) => /בדקו|בדיקה/.test(heading) || /\?$/.test(heading) || /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(heading);
  const checks = page.sections.filter(section => isCheck(section.heading ?? ''));
  assert.deepEqual(checks.map(section => section.heading), ['בדקו את עצמכם']);
  const texts = checks[0].blocks.map(block => plain(block.text ?? ''));
  assert.equal(texts.length, 4);
  texts.forEach((text, i) => assert.equal(/^התשובה/.test(text), i % 2 === 1, text));
});

test('the worked example, self-check and lesson are correct and differ from the grade-8 page', () => {
  const text = page.sections.flatMap(section => section.blocks.map(block => block.text ?? '')).join('\n');
  // ⟨x¦3⟩ − ⟨(x − 2)¦4⟩ = 2 → 4x − 3(x − 2) = 24 → x = 18
  assert.match(text, /⟨x¦3⟩ − ⟨\(x − 2\)¦4⟩ = 2/);
  assert.equal(18 / 3 - (18 - 2) / 4, 2);
  assert.equal(4 * 18 - 3 * (18 - 2), 24);
  // ⟨(x + 4)¦5⟩ = ⟨x¦2⟩ − 1 → x = 6; ⟨2x¦4⟩ = ⟨x¦2⟩ + 1 has no solution.
  assert.match(text, /x = 6/);
  assert.equal((6 + 4) / 5, 6 / 2 - 1);
  for (const x of [-3, 0, 2, 7.5]) assert.notEqual((2 * x) / 4, x / 2 + 1);
  const grade8 = JSON.parse(readFileSync(new URL('../src/data/topic-pages/equations-with-fractions-grade-8.json', import.meta.url), 'utf8'));
  const grade8Text = JSON.stringify(grade8.sections);
  for (const equation of ['⟨x¦4⟩ + ⟨x¦6⟩ = 5', '⟨x¦2⟩ − ⟨x¦5⟩ = 6']) {
    assert.ok(grade8Text.includes(equation));
    assert.ok(!text.includes(equation), `grade-9 page reuses ${equation}`);
  }

  const loop = topicLandingLoop(page);
  assert.deepEqual(loop, { kind: 'css', variant: 'minus-before-fraction', marker: 'minus-before-fraction' });
  const lesson = LESSON_LOOPS['minus-before-fraction'];
  assert.equal(lesson.picture, 'calculation', 'an equations page gets a calculation, never a drawing');
  const fractions = lessonMathParts(lesson.steps[0].math).filter(part => typeof part !== 'string');
  assert.deepEqual(fractions, [{ numerator: 'x', denominator: '3' }, { numerator: '(x−2)', denominator: '4' }]);
  assert.equal(lesson.steps[1].math, '4x − 3(x − 2) = 24');
  assert.equal(lesson.steps[2].math, 'x + 6 = 24; x = 18');
  for (const step of lesson.steps) assert.ok(!step.math.includes('/'), step.math);
});

test('related links are the authored reduced-track and review pages, after the grade hub', () => {
  assert.deepEqual(page.relatedTopics.map(rel => rel.path), ['/grade-9', '/distributive-law-grade-9',
    '/linear-function-grade-9', '/word-problems-grade-9', '/equations-with-fractions-grade-8']);
  for (const rel of page.relatedTopics) assert.equal(rel.productionHref, `https://www.noamdoronmath.co.il${rel.path}`);
});

test('the grade hub links the new reduced-track topic once, beside the other equation pages', () => {
  const hub = loadGradeHub(9);
  for (const links of [hub.topicLinks, hub.topicSections.flatMap(section => section.links)]) {
    assert.equal(links.filter(link => link.path === `/${slug}`).length, 1);
    const at = links.findIndex(link => link.path === `/${slug}`);
    assert.equal(links[at + 1].path, '/rational-equations-grade-9');
    assert.match(plain(links[at].label), /ט׳ מצומצמת/);
  }
  const algebra = hub.topicSections.find(section => section.heading === 'אלגברה ומשוואות')!;
  assert.ok(algebra.links.some(link => link.path === `/${slug}`));
});
