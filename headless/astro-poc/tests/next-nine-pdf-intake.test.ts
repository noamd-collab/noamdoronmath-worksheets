import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';
import { loadTopicPage, extractJsonLdFaq, synthesizeBodyFlow } from '../src/lib/topicPages';
import { loadGradeHub } from '../src/lib/gradeHubs';
import { topicLandingLoop } from '../src/lib/landingLoops';
import { LESSON_LOOPS } from '../src/lib/lessonLoops';
import { beforeEqnSgnFacCatalog } from './fixtures/eqn-sgn-fac-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const additions = [
  { grade: 9, topicId: 48, slug: 'median-to-hypotenuse-grade-9', editionId: undefined,
    receipt: 'docs/g9-med01-pdf-first-20261115.json',
    pdfs: ['eb99b4fb3e4d47f5b96e4f2dcfb10bf2', '703b2b73edb949e4a06efa8a02d7476e', 'ce41b853212749c09efc3d466a8e9ddf'] },
  { grade: 7, topicId: 27, slug: 'relative-frequency-experiments-grade-7', editionId: 'ms-20261115-prb-01-r1',
    receipt: 'docs/g7-prb01-pdf-first-20261115.json',
    pdfs: ['763682ee83fd45fb97d463ad89dfebcc', '152537d8312b4902a23b53d68e21004a', '3fce9fe16ea24b419abc6e25b987e066'] },
  { grade: 9, topicId: 11, slug: 'rectangle-grade-9', editionId: 'ms-20261115-rec-01-r1',
    receipt: 'docs/g9-rec01-pdf-first-20261115.json',
    pdfs: ['d9db352e798e4dc78df2602580adef0b', 'ea3bd0b483644b61bb001e56b8bba09d', 'e5c9abeff29046cd87e733db0b4debc9'] },
];
const catalog = loadCatalog();
const previous = structuredClone(catalog);
previous.grades.find(g => g.grade === 9)!.topics = previous.grades.find(g => g.grade === 9)!.topics.filter(t => t.id !== 48);
delete previous.searchTerms['9']['48'];
for (const a of additions.filter(a => a.editionId)) {
  const topic = previous.grades.find(g => g.grade === a.grade)!.topics.find(t => t.id === a.topicId)!;
  delete topic.editions; delete topic.defaultEditionId;
}
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = { ...registry, editions: registry.editions.filter((e: any) => !additions.some(a => a.editionId === e.editionId)) };

test('the nine exact PDF additions reverse to the complete preceding catalog, including RAT47 and FRQ', () => {
  const rawPrevious = beforeEqnSgnFacCatalog(read('headless/astro-poc/src/data/catalog.v1.json'));
  const parallelogram = rawPrevious.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 7);
  const t90 = parallelogram.editions.filter((e: any) => e.editionId === 'ms-20261113-par-04-r1');
  assert.equal(t90.length, 1);
  assert.equal(createHash('sha256').update(JSON.stringify(t90[0])).digest('hex'),
    'aa6d8b18e75c1af716d4ae06b059831fc27c397cf4fd70bb992afea991a03ed9');
  parallelogram.editions = parallelogram.editions.filter((e: any) => e.editionId !== 'ms-20261113-par-04-r1');
  rawPrevious.grades.find((g: any) => g.grade === 9).topics = rawPrevious.grades.find((g: any) => g.grade === 9).topics.filter((t: any) => t.id !== 48);
  delete rawPrevious.searchTerms['9']['48'];
  for (const [grade, id] of [[7, 27], [9, 11]]) {
    const t = rawPrevious.grades.find((g: any) => g.grade === grade).topics.find((t: any) => t.id === id);
    delete t.editions; delete t.defaultEditionId;
  }
  assert.equal(createHash('sha256').update(JSON.stringify(rawPrevious, null, 2) + '\n').digest('hex'),
    '86726f83e3717b7dc15c0740c88b89472dca101f6fe34f19ea07df18e2beedf3');
  assert.equal(new Set(additions.flatMap(a => a.pdfs)).size, 9);
  const receipts = additions.map(a => read(a.receipt));
  assert.equal(receipts.reduce((n, r) => n + r.review.reviewedPages, 0), 56);
  assert.equal(receipts.reduce((n, r) => n + r.review.reviewedSubitems, 0), 180);
  for (const a of additions) {
    const topic = catalog.grades.find(g => g.grade === a.grade)!.topics.find(t => t.id === a.topicId)!;
    const groups = topicWorksheetEditionLinks(catalog, a.grade, a.topicId, `/worksheets?grade=${a.grade}&topic=${a.topicId}`);
    const selected = a.editionId ? topic.editions!.find(e => e.editionId === a.editionId)! : topic;
    assert.equal(selected.publicationMode, 'pdf-only');
    assert.equal(selected.routing.usesViewer, false); assert.equal(selected.routing.aiHintShown, false);
    assert.deepEqual(selected.levels.map(l => l.pdfId), a.pdfs);
    const group = groups.find(g => g.editionId === (a.editionId ?? 'legacy'))!;
    assert.ok(group); assert.deepEqual(group.levels.map(l => l.href), a.pdfs.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    for (const level of selected.levels) {
      assert.equal(buildWorksheetHref({ catalog, grade: a.grade, topic, editionId: a.editionId, levelKey: level.key }), `${catalog.config.pdfBase}${level.pdfId}.pdf`);
      assert.equal(Object.hasOwn(level, 'ramzi'), false);
    }
    if (a.editionId) {
      assert.equal(topic.defaultEditionId, 'legacy');
      assert.deepEqual(groups.map(g => g.editionId), ['legacy', a.editionId]);
      assert.deepEqual(groups[0], topicWorksheetEditionLinks(previous, a.grade, a.topicId, `/worksheets?grade=${a.grade}&topic=${a.topicId}`)[0]);
    } else {
      assert.equal(groups.length, 1); assert.equal(topic.noamTopicId, undefined);
      assert.equal(topic.routing.resolvedNoamPrefix, null);
    }
    const receipt = read(a.receipt);
    assert.deepEqual(receipt.levels.map((l: any) => l.pdfId), a.pdfs);
    for (const level of receipt.levels) {
      assert.equal(level.downloadChecks.length, 3);
      assert.ok(level.downloadChecks.every((d: any) => d.sha256 === level.pdfSha256));
    }
    assert.equal(receipt.sourceProvenanceOnly, true); assert.equal(receipt.review.wholePackagePass, false);
  }
});

test('new PDFs do not alter teacher selection, learning IDs, or viewer dependencies', () => {
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const a of additions) {
    assert.equal(getTeacherLandingScope({ grade: a.grade, topic: a.topicId, ...(a.editionId ? { edition: a.editionId } : {}) }, teacher), null);
    if (a.editionId) assert.ok(getTeacherLandingScope({ grade: a.grade, topic: a.topicId }, teacher));
  }
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  assert.ok(additions.flatMap(a => a.pdfs).every(pdf => !collectViewerPdfIds(catalog).includes(pdf)));
  const raw = loadIndexCatalog(); const before = structuredClone(raw);
  before.DATA[9].topics = before.DATA[9].topics.filter((t: any) => t.id !== 48);
  delete before.DATA[9].links[48]; delete before.SEARCH_TERMS[9][48];
  const evidence = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(raw, registry, evidence), buildLearningCatalog(before, priorRegistry, evidence));
});

test('the MED landing states the precise curriculum topic and a correct worked example without unsupported features', () => {
  const page = loadTopicPage('median-to-hypotenuse-grade-9');
  assert.equal(page.h1, 'משולש ישר זווית — התיכון ליתר לכיתה ט׳');
  assert.equal(page.catalogCta.catalogTopicId, 48);
  assert.equal(page.catalogCta.catalogTopicTitle, 'משולש ישר־זווית — התיכון ליתר');
  const visible = [page.title, page.description, page.intro, ...page.sections.flatMap(s => s.blocks.map(b => b.text ?? '')), ...page.faq.flatMap(f => [f.question, f.answer])].join('\n');
  assert.match(visible, /חבילת תרגול ממוקדת/);
  assert.doesNotMatch(visible, /נועם AI|רמזי|\bWord\b|יחידה מלאה|כל יחידת/);
  assert.deepEqual(extractJsonLdFaq(page.jsonLd), page.faqGroups.flatMap(g => g.items));
  assert.deepEqual(topicLandingLoop(page), { kind: 'css', variant: 'hypotenuse-median', marker: 'hypotenuse-median' });
  const lesson = LESSON_LOOPS['hypotenuse-median'];
  assert.match(lesson.steps[0].math, /∠A = 90°; BC = 16/);
  assert.match(lesson.steps[1].math, /AM = ⟨BC¦2⟩/);
  assert.equal(lesson.steps[2].math, 'AM = 8'); assert.equal(16 / 2, 8);
  const hub = loadGradeHub(9);
  for (const links of [hub.topicLinks, hub.topicSections.flatMap(s => s.links)]) {
    assert.equal(links.filter(l => l.path === page.path).length, 1);
    assert.ok(links.some(l => l.path === '/rational-equations-grade-9'));
    assert.ok(links.some(l => l.path === '/rectangle-grade-9'));
  }
});

// Pages with captured bodyFlow render that sequence rather than sections.
test('the added probability description is actually in the rendered body flow and all prior blocks remain', () => {
  const rawPage = read('headless/astro-poc/src/data/topic-pages/relative-frequency-experiments-grade-7.json');
  assert.equal(createHash('sha256').update(JSON.stringify(rawPage.bodyFlow.slice(0, -2))).digest('hex'), 'd658ef35d734156c795716d13120e52097ad98656b814c152b0361dfd8b22d8a');
  const page = loadTopicPage('relative-frequency-experiments-grade-7');
  const added = page.sections.at(-1)!;
  const flow = synthesizeBodyFlow(page);
  assert.equal(flow.filter(block => block.type === 'heading' && block.text === added.heading).length, 1);
  const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');
  assert.equal(flow.filter(block => block.type === 'paragraph' && plain(block.text) === plain(added.blocks[0].text!)).length, 1);
  assert.deepEqual(rawPage.bodyFlow.slice(-2).map((block: any) => block.type), ['heading', 'paragraph']);
});
