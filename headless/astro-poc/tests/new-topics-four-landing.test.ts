import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage, extractJsonLdFaq } from '../src/lib/topicPages.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { LESSON_LOOPS } from '../src/lib/lessonLoops.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { parseWorksheetsUrlState } from '../src/lib/worksheetsUrlState.ts';
import { beforeNew4Catalog, reviewedNew4 } from './fixtures/new4-pdf.ts';
import { beforeBatch09Catalog, reviewedBatch09 } from './fixtures/batch09-pdf.ts';
import { beforeBatch10Catalog } from './fixtures/batch10-pdf.ts';

const plain = (text: string) => text.replace(/[⁦-⁩]/g, '');

/** Reviewed PDFs (media ids) and the exact per-level scope read from each package's catalog entry and PDFs. */
const TOPICS = [
  {
    grade: 8, topicId: 68, slug: 'isometric-transformations-grade-8', sheet: 'trf01',
    title: 'טרנספורמציות איזומטריות וצורות חופפות', group: 'geo',
    h1: 'טרנספורמציות איזומטריות וצורות חופפות לכיתה ח׳',
    pdfIds: ['afaa5abcd06844629f6916203a910dce', '3910adaab83f48698e496177a24a3416', '4f585164428346d8972abf102c1f61a7'],
    counts: ['רמה א׳: שמונה שאלות ובהן שלושים ושניים סעיפים', 'רמה ב׳: שמונה שאלות ובהן שלושים ושניים סעיפים', 'מצוינות: שמונה שאלות ובהן שלושים ושניים סעיפים'],
    required: [/הזזה/, /שיקוף/, /סיבוב/, /שומרות על אורכי קטעים ועל גדלי זוויות/, /חופפת/, /מערכת צירים/, /משפט פיתגורס/],
    lesson: 'rotation-90-origin', hubSection: 'משולשים והוכחות',
    related: ['/grade-8', '/triangle-congruence-grade-8', '/congruence-theorems-grade-8', '/pythagorean-theorem-grade-8', '/congruent-polygons-transformations-grade-7'],
  },
  {
    grade: 9, topicId: 50, slug: 'parallel-lines-angles-grade-9', sheet: 'pln01',
    title: 'ישרים מקבילים — זוויות מתאימות ומתחלפות', group: 'geopar',
    h1: 'ישרים מקבילים: זוויות מתאימות ומתחלפות לכיתה ט׳',
    pdfIds: ['221e8bbea775437bbe4ab68b4ef870fd', 'c273ce799c22473ea9baaf67404e0803', 'c68c316690dd4ea485e0b24bdbd677fb'],
    counts: ['רמה א׳: אחת־עשרה שאלות ובהן שלושים ושלושה סעיפים', 'רמה ב׳: אחת־עשרה שאלות ובהן שלושים ושלושה סעיפים', 'מצוינות: אחת־עשרה שאלות ובהן שלושים ושלושה סעיפים'],
    required: [/זוויות מתאימות/, /זוויות מתחלפות/, /המשפט ההפוך/, /תנאים להקבלה/, /ולא לפי מראה הסרטוט/, /מערכת צירים/],
    lesson: 'corresponding-converse', hubSection: 'ישרים מקבילים וזוויות',
    related: ['/grade-9', '/co-interior-angles-grade-9', '/parallel-lines-angles-grade-8', '/parallelogram-grade-9', '/trapezoid-grade-9'],
  },
  {
    grade: 9, topicId: 51, slug: 'co-interior-angles-grade-9', sheet: 'coi01',
    title: 'זוויות חד־צדדיות בין ישרים מקבילים', group: 'geopar',
    h1: 'זוויות חד־צדדיות בין ישרים מקבילים לכיתה ט׳',
    pdfIds: ['69f6ddca043f42a4bfba28ebb4914b35', 'dc02a54d258e4e55990640ca1b850193', 'a808a520c70c499e94d0d1654b4c4692'],
    counts: ['רמה א׳: חמש שאלות ובהן עשרים סעיפים', 'רמה ב׳: חמש שאלות ובהן עשרים סעיפים', 'מצוינות: חמש שאלות ובהן עשרים סעיפים'],
    required: [/זוויות חד־צדדיות/, /180°/, /בעזרת x/, /סקיצה/, /מערכת צירים/],
    lesson: 'co-interior-sum', hubSection: 'ישרים מקבילים וזוויות',
    related: ['/grade-9', '/parallel-lines-angles-grade-9', '/parallel-lines-angles-grade-8', '/trapezoid-grade-9', '/parallelogram-grade-9'],
  },
  {
    grade: 9, topicId: 52, slug: 'math-literacy-tasks-grade-9', sheet: 'lit01',
    title: 'משימות אוריינות — מודל מתמטי בהקשר מציאותי', group: 'stat',
    h1: 'משימות אוריינות במתמטיקה לכיתה ט׳',
    pdfIds: ['4b17f470a73c4aa481c37ed580475f64', '19fe882096f24455b25d132832048557', '956a9a595952409ab7c5bc92aba46515'],
    counts: ['רמה א׳: שש שאלות ובהן שמונה־עשר סעיפים', 'רמה ב׳: שש שאלות ובהן שמונה־עשר סעיפים', 'מצוינות: שש שאלות ובהן שמונה־עשר סעיפים'],
    required: [/משימות אוריינות|משימת אוריינות/, /מודל מתמטי/, /הצעות מחיר/, /משוואה ריבועית/, /משפט פיתגורס/, /טרפז/, /פוסלים אורך שלילי/],
    lesson: 'compare-offers', hubSection: 'סטטיסטיקה, הסתברות והמשך הלמידה',
    related: ['/grade-9', '/word-problems-grade-9', '/quadratic-equations-grade-9', '/pythagoras-applications-grade-9', '/composite-polygons-area-grade-9'],
  },
] as const;

test('the four reviewed topics are PDF-only base topics with exactly their reviewed PDFs', () => {
  const catalog = loadCatalog();
  assert.deepEqual(reviewedNew4.topics.map(t => [t.grade, t.topicId, t.slug]), TOPICS.map(t => [t.grade, t.topicId, t.slug]));
  for (const t of TOPICS) {
    const grade = catalog.grades.find(g => g.grade === t.grade)!;
    const topic = grade.topics.find(item => item.id === t.topicId)!;
    assert.equal(topic.title, t.title);
    assert.equal(topic.group, t.group);
    assert.equal(topic.publicationMode, 'pdf-only');
    assert.equal(topic.noamTopicId, undefined, `${t.slug}: a PDF-only topic has no Noam prefix`);
    assert.equal(topic.editions, undefined, `${t.slug}: no editions`);
    assert.deepEqual(topic.levels.map(level => [level.key, level.pdfId]), [['a', t.pdfIds[0]], ['b', t.pdfIds[1]], ['c', t.pdfIds[2]]]);
    assert.deepEqual(reviewedNew4.topics.find(r => r.topicId === t.topicId && r.grade === t.grade)!.pdfIds, t.pdfIds);
    assert.equal(topic.routing.usesViewer, false);
    assert.equal(topic.routing.aiHintShown, false);
    const page = loadTopicPage(t.slug);
    const state = parseWorksheetsUrlState(new URLSearchParams(page.catalogCta.href.split('?')[1]));
    assert.equal(state.grade, t.grade);
    assert.equal(state.topic, t.topicId);
  }
  // One regular group for the two parallel-lines topics, before the quadrilaterals; no month or track group
  // (r9nov arrives later, with topic 9/53 in batch 10).
  const grade9 = catalog.grades.find(g => g.grade === 9)!;
  assert.deepEqual(grade9.groups.filter(group => group.reducedProgram).map(group => group.key), ['r9sep', 'r9oct', 'r9nov', 'r9jan']);
  assert.deepEqual(grade9.groups.slice(0, 4).map(group => [group.key, group.label]), [['alg', 'אלגברה'], ['fun', 'פונקציות וגרפים'],
    ['geopar', 'גיאומטריה — ישרים מקבילים וזוויות'], ['geo', 'גיאומטריה — מרובעים ומשולשים']]);
  assert.deepEqual(grade9.topics.filter(topic => topic.group === 'geopar').map(topic => topic.id), [50, 51]);
});

for (const t of TOPICS) {
  test(`${t.slug}: the landing describes only the reviewed PDF scope, without unavailable tools`, () => {
    const page = loadTopicPage(t.slug);
    assert.equal(page.h1, t.h1);
    assert.equal(page.title, `${t.h1} — דפי עבודה עם תשובות | נועם דורון`);
    assert.equal(page.verifiedVia, `authored-catalog-gap-${t.sheet}-pdf-review-20261118`);
    assert.equal(page.catalogCta.href, `/worksheets?grade=${t.grade}&topic=${t.topicId}`);
    assert.equal(page.catalogCta.catalogTopicTitle, t.title);
    assert.deepEqual(page.catalogCtas, [page.catalogCta]);
    assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 18.11.2026');
    assert.equal(page.gradeHubHref, `/grade-${t.grade}`);
    const visible = plain([page.h1, page.intro, page.description,
      ...page.sections.flatMap(section => [section.heading ?? '', ...section.blocks.map(block => block.text ?? '')]),
      ...page.faq.flatMap(item => [item.question, item.answer])].join('\n'));
    for (const required of [...t.required, /PDF/, /תשובות סופיות/, /רמה א׳/, /רמה ב׳/, /מצוינות/]) assert.match(visible, required);
    for (const count of t.counts) assert.ok(visible.includes(count), `${t.slug}: ${count}`);
    assert.match(plain(page.intro), /עם תשובות סופיות בסוף כל קובץ\.$/);
    assert.match(visible, /בתחילת כל קובץ יש תזכורת, ובסופו עמוד תשובות סופיות\./);
    // Only level א׳ has a worked example in each of the four packages.
    assert.equal((visible.match(/דוגמה פתורה|דוגמאות פתורות/g) ?? []).length - 1, 1, `${t.slug}: one level-א׳ worked-example claim`);
    assert.doesNotMatch(visible, /רמה ג׳|רמזי|רמזים|נועם AI|\bWord\b|פתרונות מלאים|פתרון מלא|בסוף כל דף/);
    assert.doesNotMatch(visible, /\d\s*\/\s*[\d(x]|x\s*\/\s*\d/);
    assert.deepEqual(extractJsonLdFaq(page.jsonLd), page.faqGroups.flatMap(group => group.items));
    assert.deepEqual(page.faq, page.faqGroups.flatMap(group => group.items));
    const graph = page.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const web = graph.find(item => item['@type'] === 'WebPage')!;
    const resource = graph.find(item => item['@type'] === 'LearningResource')!;
    assert.equal(web.url, `https://www.noamdoronmath.co.il/${t.slug}`);
    assert.equal(web.name, page.title);
    assert.equal(web.description, page.description);
    assert.equal(resource.description, page.description);
    assert.equal(resource.name, t.h1);
    assert.equal(resource.educationalLevel, t.grade === 8 ? 'כיתה ח׳' : 'כיתה ט׳');
    assert.equal(web.dateModified, '2026-11-18');
  });

  test(`${t.slug}: only self-check answers sit behind the reveal button`, () => {
    const page = loadTopicPage(t.slug);
    const isCheck = (heading: string) => /בדקו|בדיקה/.test(heading) || /\?$/.test(heading) || /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(heading);
    const checks = page.sections.filter(section => isCheck(section.heading ?? ''));
    assert.deepEqual(checks.map(section => section.heading), ['בדקו את עצמכם']);
    const texts = checks[0].blocks.map(block => plain(block.text ?? ''));
    assert.equal(texts.length, 4);
    texts.forEach((text, i) => assert.equal(/^התשובה/.test(text), i % 2 === 1, text));
  });

  test(`${t.slug}: the lesson is a calculation scene and the related links follow the grade hub`, () => {
    const page = loadTopicPage(t.slug);
    assert.deepEqual(topicLandingLoop(page), { kind: 'css', variant: t.lesson, marker: t.lesson });
    const lesson = LESSON_LOOPS[t.lesson];
    assert.equal(lesson.picture, 'calculation', 'a landing scene, never a drawing');
    assert.equal(lesson.steps.length, 3);
    for (const step of lesson.steps) {
      assert.doesNotMatch(step.text, /[A-Za-z]/, step.text);
      assert.ok(!step.math.includes('/'), step.math);
    }
    assert.deepEqual(page.relatedTopics.map(rel => rel.path), t.related);
    for (const rel of page.relatedTopics) assert.equal(rel.productionHref, `https://www.noamdoronmath.co.il${rel.path}`);
    for (const rel of page.relatedTopics.slice(1)) assert.ok(loadTopicPage(rel.path.slice(1)), `${rel.path} exists`);
  });

  test(`${t.slug}: the grade hub links the new topic once, in its section`, () => {
    const hub = loadGradeHub(t.grade);
    for (const links of [hub.topicLinks, hub.topicSections.flatMap(section => section.links)]) {
      assert.equal(links.filter(link => link.path === `/${t.slug}`).length, 1);
    }
    const section = hub.topicSections.find(item => item.heading === t.hubSection)!;
    assert.ok(section.links.some(link => link.path === `/${t.slug}`));
  });
}

test('worked examples, common mistakes and self-checks compute correctly', () => {
  const text = (slug: string) => plain(loadTopicPage(slug).sections.flatMap(section => section.blocks.map(block => block.text ?? '')).join('\n'));
  // Rotation by 90° counter-clockwise about the origin: (x, y) -> (−y, x).
  const rot90 = ([x, y]: number[]) => [-y, x];
  assert.deepEqual(rot90([7, 3]), [-3, 7]);
  assert.deepEqual(rot90([7, 8]), [-8, 7]);
  assert.equal(8 - 3, 5);
  assert.equal(-3 - -8, 5);
  const trf = text('isometric-transformations-grade-8');
  assert.ok(trf.includes('P עוברת אל (−3, 7) ו־Q עוברת אל (−8, 7)'));
  // Translation 4 left and 2 up of an 8-15-17 right triangle.
  const moved = [[10, 1], [18, 1], [10, 16]].map(([x, y]) => [x - 4, y + 2]);
  assert.deepEqual(moved, [[6, 3], [14, 3], [6, 18]]);
  assert.equal(Math.hypot(14 - 6, 18 - 3), 17);
  assert.ok(trf.includes('(6, 3), (14, 3) ו־(6, 18)') && trf.includes('היתר הוא 17'));
  // Rotation by 180° about the origin flips both signs.
  assert.ok(trf.includes('אל (2, −6)'));

  const pln = text('parallel-lines-angles-grade-9');
  assert.equal(180 - 68, 112);
  assert.equal(180 - 47, 133);
  const x = (21 + 9) / (6 - 4);
  assert.equal(x, 15);
  assert.equal(4 * x + 9, 6 * x - 21);
  assert.equal(4 * x + 9, 69);
  assert.ok(pln.includes('(4x + 9)° ו־(6x − 21)°') && pln.includes('x = 15') && pln.includes('69°'));
  assert.notEqual(80, 100, 'corresponding angles of 80° and 100° are not equal, so the lines are not parallel');

  const coi = text('co-interior-angles-grade-9');
  const y = (180 - 20) / 8;
  assert.equal(y, 20);
  assert.equal(5 * y + 4 + 3 * y + 16, 180);
  assert.deepEqual([5 * y + 4, 3 * y + 16], [104, 76]);
  assert.ok(coi.includes('(5x + 4)° ו־(3x + 16)°') && coi.includes('104° ו־76°'));
  assert.equal(180 - 57, 123);
  assert.equal(97 + 81, 178);
  assert.ok(coi.includes('הסכום הוא 178°'));

  const lit = text('math-literacy-tasks-grade-9');
  const hours = 50 / (6 - 4);
  assert.equal(hours, 25);
  assert.deepEqual([50 + 4 * 10, 6 * 10], [90, 60]);
  assert.ok(lit.includes('50 + 4t = 6t, כלומר t = 25'));
  assert.equal(8 * (8 - 3), 40);
  assert.equal((-8) * (-8 + 3), 40, 'x = −8 also solves x(x + 3) = 40, and is rejected as a width');
  assert.equal(Math.ceil(10 / 3), 4);
  assert.ok(lit.includes('8 מטרים על 5 מטרים') && lit.includes('4 פחיות'));
});

test('the NEW4 fence reverses exactly the four topics and rejects substitutions, moves, duplicates and edits', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
  const gradeOf = (cat: any, grade: number) => cat.grades.find((g: any) => g.grade === grade);
  const topicOf = (cat: any, grade: number, id: number) => gradeOf(cat, grade).topics.find((t: any) => t.id === id);
  const tampered = (change: (cat: any) => void) => { const cat = structuredClone(raw); change(cat); return cat; };
  const named = (message: string) => (error: unknown) => error instanceof assert.AssertionError && error.message.startsWith(message);
  const rejects = (change: (cat: any) => void, message: string) =>
    assert.throws(() => beforeNew4Catalog(tampered(change)), named(message), message);

  const pristine = structuredClone(raw);
  const restored: any = beforeNew4Catalog(raw);
  assert.deepEqual(raw, pristine, 'the fence works on a copy');
  // Batch 10 (topic 9/53 and its editions) is newer than NEW4, so the fence reverses it too.
  const expected: any = structuredClone(beforeBatch10Catalog(raw));
  for (const t of TOPICS) {
    gradeOf(expected, t.grade).topics = gradeOf(expected, t.grade).topics.filter((item: any) => item.id !== t.topicId);
    delete expected.searchTerms[String(t.grade)][String(t.topicId)];
  }
  gradeOf(expected, 9).groups = gradeOf(expected, 9).groups.filter((g: any) => g.key !== 'geopar');
  assert.deepEqual(restored, expected);
  assert.equal(restored.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length,
    raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length - 12 - 3);
  // With NEW4 reversed first, the batch-09 fence recovers its independently pinned baseline.
  assert.equal(digest(beforeBatch09Catalog(raw)), reviewedBatch09.baselineCatalogSha256);

  rejects(cat => { topicOf(cat, 8, 68).levels[0].pdfId = 'f8e4149d737746489f3866c6e9bfa807'; }, 'NEW4: reviewed PDFs of 8/68');
  rejects(cat => { topicOf(cat, 9, 50).levels.reverse(); }, 'NEW4: reviewed PDFs of 9/50');
  rejects(cat => { topicOf(cat, 9, 51).levels.pop(); }, 'NEW4: reviewed PDFs of 9/51');
  rejects(cat => { topicOf(cat, 9, 52).title = 'משימות'; }, 'NEW4: exact base topic 9/52');
  rejects(cat => { topicOf(cat, 9, 50).noamTopicId = 'G9-T77'; }, 'NEW4: exact base topic 9/50');
  rejects(cat => { topicOf(cat, 8, 68).routing.usesViewer = true; }, 'NEW4: exact base topic 8/68');
  rejects(cat => { delete topicOf(cat, 9, 51).publicationMode; }, 'NEW4: exact base topic 9/51');
  rejects(cat => { topicOf(cat, 9, 52).editions = [{ editionId: 'ms-unreviewed-r1' }]; }, 'NEW4: exact base topic 9/52');
  rejects(cat => {
    const topics = gradeOf(cat, 9).topics, at = topics.findIndex((t: any) => t.id === 52);
    [topics[at], topics[at + 1]] = [topics[at + 1], topics[at]];
  }, 'NEW4: reviewed position of 9/52');
  rejects(cat => { gradeOf(cat, 8).topics.push(structuredClone(topicOf(cat, 8, 68))); }, 'NEW4: exactly one topic 8/68');
  rejects(cat => { gradeOf(cat, 9).topics = gradeOf(cat, 9).topics.filter((t: any) => t.id !== 51); }, 'NEW4: reviewed position of 9/50');
  rejects(cat => { cat.searchTerms['9']['50'] += ' רמזי'; }, 'NEW4: exact search terms 9/50');
  rejects(cat => { delete cat.searchTerms['8']['68']; }, 'NEW4: exact search terms 8/68');
  rejects(cat => { gradeOf(cat, 9).groups.find((g: any) => g.key === 'geopar').label = 'ישרים'; }, 'NEW4: exact geopar group');
  rejects(cat => { const gs = gradeOf(cat, 9).groups, at = gs.findIndex((g: any) => g.key === 'geopar'); [gs[at], gs[at + 1]] = [gs[at + 1], gs[at]]; }, 'NEW4: reviewed group position');
  rejects(cat => { gradeOf(cat, 9).groups.push(structuredClone(gradeOf(cat, 9).groups.find((g: any) => g.key === 'geopar'))); }, 'NEW4: exactly one geopar group');
  // A second call stops at the newest fence of the chain (PCM53, reversed by batch 10 first) ...
  assert.throws(() => beforeNew4Catalog(restored), named('PCM53: exactly one topic 53'), 'never reverses twice');
  // ... and NEW4 itself refuses a catalog whose four topics are already gone while batch 10 is still in place.
  const new4Gone: any = structuredClone(raw);
  for (const t of TOPICS) {
    gradeOf(new4Gone, t.grade).topics = gradeOf(new4Gone, t.grade).topics.filter((item: any) => item.id !== t.topicId);
    delete new4Gone.searchTerms[String(t.grade)][String(t.topicId)];
  }
  gradeOf(new4Gone, 9).groups = gradeOf(new4Gone, 9).groups.filter((g: any) => g.key !== 'geopar');
  assert.throws(() => beforeNew4Catalog(new4Gone), named('NEW4: exactly one topic 8/68'), 'NEW4 never reverses twice');

  // A change anywhere else passes through NEW4, so the older batch-09 fence rejects it.
  for (const change of [
    (cat: any) => { topicOf(cat, 9, 48).levels[0].pdfId = 'old-link-changed'; },
    (cat: any) => { topicOf(cat, 8, 62).group = 'alg'; },
    (cat: any) => { cat.searchTerms['9']['49'] += ' מקבילים'; },
  ]) {
    const cat = tampered(change);
    let recovered: string | null = null;
    try { recovered = digest(beforeBatch09Catalog(cat)); } catch { /* an older fence threw: rejected */ }
    assert.notEqual(recovered, reviewedBatch09.baselineCatalogSha256);
  }
});

// Review receipts and the published PDF bytes they bind (SHA-256), pinned.
const RECEIPT_SHA256S: Record<string, string[]> = {
  "G8-TRF-01": [
    "e1aac882f10757dcf737e0ba3c3337df0036fdf8eadaf5c5dc2cee996200e7bb"
  ],
  "G9-PLN-01": [
    "d205d68748d0e2e204d0ac75aea9bd65e60351251bd7f68296d249d52d7225e4"
  ],
  "G9-COI-01": [
    "5562648fbeda37365cc6ed8d0bfeeede7f069de2e7da93298362f0be75556a94",
    "da4c332df6575d98849f98029f0573b0bc29dd49a884090e6a0b03daee2a8882"
  ],
  "G9-LIT-01": [
    "ac66dadba2b153928c45a26c560227fa361ac78b2efba92068eecbaf362b7249",
    "9d595e6906b4297c15cc3387dd91b495a2f5b585e9468f1d67e1c647f5f3b989"
  ]
};
const PDF_SHA256S: Record<string, string[]> = {
  "G8-TRF-01": [
    "c7b1df630cd848c22ac2a96a253a585d05907ba1ffe08b16786ac46bf973bf60",
    "ac3a210c616226e1f13620cb964a5d641c74daaef26fdc39f43ae58bf4423c1c",
    "d9e443f973b71f09115a2c8ad4a6f090a78bd14ad9ee07cf2c553eb50e555d37"
  ],
  "G9-PLN-01": [
    "bf616485ceece90f1601593ca7ce47deda6ca9244143a4e15583f5580fffd0cb",
    "372de38f86cd3d1672552d64e84378139bb52419f95f43f12e73c231132d15a5",
    "e623a33a29b39ac056877e783ebfb9e1dfc1b60ea00e3519702c3332db82a5fb"
  ],
  "G9-COI-01": [
    "9cfc4ce31f702bbe2e3308c92d426dd9a461c0171b95723a3ab9da8949bbdd1b",
    "017797ce5340c26b0ce2b7d23caf7d10e676f2d9ea64a892c898c655bb1df726",
    "ecc65d8486b14a59f15b1d7272bec1b142a63e51da1c17e2fd5729436eee5173"
  ],
  "G9-LIT-01": [
    "6d4d914d455b11454906e6974ec1904dc67be43b4289eb8d90a7bedc29696fd0",
    "263ae131db0f93fbf4d1c5210e8fb29252ba1ef6bcb80dcd58adabadfd5db6df",
    "3c20f58c6fc977b2a9b432a7ad65e71a7ac4054a6ffd09e1a98f0e9e1d967075"
  ]
};

test('the proof binds every PDF to its reviewed bytes, two matching media readbacks and real receipts', () => {
  const proof = JSON.parse(readFileSync(new URL('../../../docs/new-topics-four-pdf-first-20261118.json', import.meta.url), 'utf8'));
  assert.equal(proof.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(proof.sitePublicationClaimed, false);
  assert.deepEqual(proof.scope, { topics: 4, pdfs: 12, pages: 102, landingRoutes: 4 });
  assert.equal(proof.approval.by, 'Noam');
  assert.deepEqual(proof.topics.map((t: any) => [t.grade, t.topicId, t.landing]), TOPICS.map(t => [t.grade, t.topicId, `/${t.slug}`]));
  for (const [i, topic] of proof.topics.entries()) {
    assert.equal(topic.publicationMode, 'pdf-only');
    assert.deepEqual(topic.levels.map((l: any) => l.pdfId), TOPICS[i].pdfIds);
    assert.deepEqual(topic.levels.map((l: any) => l.pdfSha256), PDF_SHA256S[topic.sourceSheetId]);
    assert.deepEqual(topic.levels.map((l: any) => l.label), ['רמה א׳', 'רמה ב׳', 'מצוינות']);
    for (const level of topic.levels) {
      assert.equal(level.downloadChecks.length, 2);
      assert.ok(level.downloadChecks.every((c: any) => c.status === 200 && c.matchesFrozenPdf && c.sha256 === level.pdfSha256
        && c.url.endsWith(`d8e7ad_${level.pdfId}.pdf`)));
    }
    assert.deepEqual(topic.reviewReceipts.map((r: any) => r.sha256), RECEIPT_SHA256S[topic.sourceSheetId]);
    assert.ok(topic.reviewReceipts.every((r: any) => /^reports\/(KIMI|ANTIGRAVITY)-(INDEPENDENT|DELTA)-[A-Za-z0-9-]+-2026111[678]\/review\.json$/.test(r.path)));
    assert.match(topic.reviewReceipts.at(-1).role, /verdict (PASS_STUDENT_PDF_ESSENTIALS|PASS_DELTA)\)$/);
  }
  const text = JSON.stringify(proof);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!text.includes(path), path);
  assert.equal(reviewedNew4.receipt, 'docs/new-topics-four-pdf-first-20261118.json');
});
