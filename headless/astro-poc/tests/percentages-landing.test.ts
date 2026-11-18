import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage, extractJsonLdFaq } from '../src/lib/topicPages.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { LESSON_LOOPS } from '../src/lib/lessonLoops.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { parseWorksheetsUrlState, trackForPinnedTopic } from '../src/lib/worksheetsUrlState.ts';
import { beforePcm53Catalog, reviewedPcm53 } from './fixtures/pcm53-pdf.ts';

const slug = 'percentages-grade-9';
const plain = (text: string) => text.replace(/[⁦-⁩]/g, '');
const page = loadTopicPage(slug);
// Reviewed PCM01 r02 PDFs (Antigravity full and blind-numbers reviews PASS, bound to these files' SHA-256).
const PDF_IDS = ['51d9de626e314f26b2f6652b63424aea', 'afdc0fde19884fb99efcee39eca6758a', '6a1f274d04494ab1ac5393811845c7ac'];

test('topic 53 opens the reduced-track month group נובמבר with exactly the three reviewed PDFs', () => {
  const grade9 = loadCatalog().grades.find(grade => grade.grade === 9)!;
  const topic = grade9.topics.find(item => item.id === 53)!;
  assert.equal(topic.title, 'אחוזים: חלק מהשלם, הגדלה והקטנה');
  assert.equal(topic.group, 'r9nov');
  assert.equal(topic.publicationMode, 'pdf-only');
  assert.equal(topic.noamTopicId, undefined, 'a PDF-only topic has no Noam prefix');
  assert.deepEqual(topic.levels.map(level => [level.key, level.pdfId]), [['a', PDF_IDS[0]], ['b', PDF_IDS[1]], ['c', PDF_IDS[2]]]);
  assert.deepEqual(reviewedPcm53.pdfIds, PDF_IDS);
  assert.equal(topic.routing.usesViewer, false);
  assert.equal(topic.routing.aiHintShown, false);
  const reduced = grade9.groups.filter(group => group.reducedProgram);
  assert.deepEqual(reduced.map(group => [group.key, group.label]), [['r9sep', 'ספטמבר'], ['r9oct', 'אוקטובר'], ['r9nov', 'נובמבר'], ['r9jan', 'ינואר']]);
  assert.deepEqual(grade9.topics.filter(item => item.group === 'r9nov').map(item => item.id), [53]);
  const state = parseWorksheetsUrlState(new URLSearchParams(page.catalogCta.href.split('?')[1]));
  assert.equal(state.topic, 53);
  assert.equal(trackForPinnedTopic(state, grade9), 'red');
});

test('the landing describes only the reviewed PDF scope, for ט׳ מצומצמת, without unavailable tools', () => {
  assert.equal(page.h1, 'אחוזים: חלק מהשלם, הגדלה והקטנה לכיתה ט׳ מצומצמת');
  assert.equal(page.title, `${page.h1} — דפי עבודה עם תשובות | נועם דורון`);
  assert.equal(page.verifiedVia, 'authored-catalog-gap-pcm01-pdf-review-20261118');
  assert.equal(page.catalogCta.href, '/worksheets?grade=9&topic=53');
  assert.equal(page.catalogCta.catalogTopicTitle, 'אחוזים: חלק מהשלם, הגדלה והקטנה');
  assert.deepEqual(page.catalogCtas, [page.catalogCta]);
  assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 18.11.2026');
  const visible = plain([page.h1, page.intro, page.description,
    ...page.sections.flatMap(section => [section.heading ?? '', ...section.blocks.map(block => block.text ?? '')]),
    ...page.faq.flatMap(item => [item.question, item.answer])].join('\n'));
  for (const required of [/ט׳ מצומצמת/, /אחוז/, /הנחה/, /התייקרות/, /בנובמבר/, /PDF/, /תשובות סופיות/, /רמה א׳/, /רמה ב׳/, /מצוינות/]) {
    assert.match(visible, required);
  }
  assert.match(visible, /רמה א׳: עשר שאלות ובהן שלושים ואחד סעיפים/);
  assert.match(visible, /רמה ב׳: עשר שאלות ובהן שלושים סעיפים/);
  assert.match(visible, /מצוינות: עשר שאלות ובהן שלושים סעיפים/);
  assert.match(plain(page.intro), /עם תשובות סופיות בסוף כל קובץ\.$/);
  assert.match(visible, /בתחילת כל קובץ יש תזכורת, ובסופו עמוד תשובות סופיות\./);
  assert.doesNotMatch(visible, /רמה ג׳|רמזי|רמזים|נועם AI|\bWord\b|פתרונות מלאים|פתרון מלא|בסוף כל דף/);
  assert.doesNotMatch(visible, /\d\s*\/\s*[\d(x]|x\s*\/\s*\d/);
  assert.deepEqual(extractJsonLdFaq(page.jsonLd), page.faqGroups.flatMap(group => group.items));
  const graph = page.jsonLd['@graph'] as Array<Record<string, unknown>>;
  const web = graph.find(item => item['@type'] === 'WebPage')!;
  const resource = graph.find(item => item['@type'] === 'LearningResource')!;
  assert.equal(web.url, `https://www.noamdoronmath.co.il/${slug}`);
  assert.equal(web.name, page.title);
  assert.equal(web.description, page.description);
  assert.equal(resource.description, page.description);
  assert.equal(resource.name, page.h1);
  assert.equal(web.dateModified, '2026-11-18');
});

test('only self-check answers sit behind the reveal button; the lesson is a short calculation', () => {
  const isCheck = (heading: string) => /בדקו|בדיקה/.test(heading) || /\?$/.test(heading) || /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(heading);
  const checks = page.sections.filter(section => isCheck(section.heading ?? ''));
  assert.deepEqual(checks.map(section => section.heading), ['בדקו את עצמכם']);
  const texts = checks[0].blocks.map(block => plain(block.text ?? ''));
  assert.equal(texts.length, 4);
  texts.forEach((text, i) => assert.equal(/^התשובה/.test(text), i % 2 === 1, text));
  assert.deepEqual(topicLandingLoop(page), { kind: 'css', variant: 'percent-multiplier', marker: 'percent-multiplier' });
  const lesson = LESSON_LOOPS['percent-multiplier'];
  assert.equal(lesson.picture, 'calculation');
  for (const step of lesson.steps) {
    assert.doesNotMatch(step.text, /[A-Za-z]/, step.text);
    assert.ok(!step.math.includes('/'), step.math);
  }
  // 45% off leaves 55%; 260 × 0.55 = 143.
  assert.equal(Math.round(260 * 0.55 * 100) / 100, 143);
});

test('the grade hub links the new reduced-track topic once, in the algebra section', () => {
  const hub = loadGradeHub(9);
  for (const links of [hub.topicLinks, hub.topicSections.flatMap(section => section.links)]) {
    assert.equal(links.filter(link => link.path === `/${slug}`).length, 1);
    assert.match(plain(links.find(link => link.path === `/${slug}`)!.label), /ט׳ מצומצמת/);
  }
  assert.ok(hub.topicSections.find(section => section.heading === 'אלגברה ומשוואות')!.links.some(link => link.path === `/${slug}`));
  for (const rel of page.relatedTopics.slice(1)) assert.ok(loadTopicPage(rel.path.slice(1)), `${rel.path} exists`);
});

test('the PCM53 fence reverses exactly topic 53, its search terms, r9nov and its trackGroups entry', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
  const grade9 = (cat: any) => cat.grades.find((g: any) => g.grade === 9);
  const tampered = (change: (cat: any) => void) => { const cat = structuredClone(raw); change(cat); return cat; };
  const named = (message: string) => (error: unknown) => error instanceof assert.AssertionError && error.message.startsWith(message);
  const rejects = (change: (cat: any) => void, message: string) =>
    assert.throws(() => beforePcm53Catalog(tampered(change)), named(message), message);
  const pristine = structuredClone(raw);
  const restored: any = beforePcm53Catalog(raw);
  assert.deepEqual(raw, pristine, 'the fence works on a copy');
  const expected = structuredClone(raw);
  grade9(expected).topics = grade9(expected).topics.filter((t: any) => t.id !== 53);
  grade9(expected).groups = grade9(expected).groups.filter((g: any) => g.key !== 'r9nov');
  expected.config.trackGroups = expected.config.trackGroups.filter((k: string) => k !== 'r9nov');
  delete expected.searchTerms['9']['53'];
  assert.deepEqual(restored, expected);
  const topic53 = (cat: any) => grade9(cat).topics.find((t: any) => t.id === 53);
  rejects(cat => { topic53(cat).levels[0].pdfId = 'f8e4149d737746489f3866c6e9bfa807'; }, 'PCM53: reviewed PDFs');
  rejects(cat => { topic53(cat).title = 'אחוזים'; }, 'PCM53: exact base topic');
  rejects(cat => { topic53(cat).noamTopicId = 'G9-T65'; }, 'PCM53: exact base topic');
  rejects(cat => { grade9(cat).topics.push(structuredClone(topic53(cat))); }, 'PCM53: exactly one topic 53');
  rejects(cat => { cat.searchTerms['9']['53'] += ' רמזי'; }, 'PCM53: exact search terms');
  rejects(cat => { grade9(cat).groups.find((g: any) => g.key === 'r9nov').label = 'דצמבר'; }, 'PCM53: exact r9nov group');
  rejects(cat => { const gs = grade9(cat).groups, at = gs.findIndex((g: any) => g.key === 'r9nov'); [gs[at], gs[at + 1]] = [gs[at + 1], gs[at]]; }, 'PCM53: r9nov between r9oct and r9jan');
  rejects(cat => { cat.config.trackGroups = cat.config.trackGroups.filter((k: string) => k !== 'r9nov'); }, 'PCM53: exact trackGroups');
  assert.throws(() => beforePcm53Catalog(restored), named('PCM53: exactly one topic 53'), 'never reverses twice');
});
