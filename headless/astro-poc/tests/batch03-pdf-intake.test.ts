import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';
import { loadTopicPage, extractJsonLdFaq, synthesizeBodyFlow } from '../src/lib/topicPages';
import { beforeBatch03Catalog, beforeBatch03Registry, beforeBatch03Copy,
  reviewedBatch03 as reviewed, reviewedBatch03Ids as ids } from './fixtures/batch03-pdf';
import { beforeProbabilityNineRegistry } from './fixtures/probability-nine-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch03Catalog(raw) as ReturnType<typeof loadCatalog>;
// Same SSR normalization as loadCatalog (Wix media CDN) so direct-PDF links compare like for like.
const previousSsr = { ...previous, config: { ...previous.config, pdfBase: 'https://static.wixstatic.com/ugd/d8e7ad_' } };
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeBatch03Registry(registry);
const receipt = read('docs/batch03-pdf-first-20261117.json');
const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');
const sameTopic = (a: { grade: number, topicId: number }) =>
  reviewed.additions.filter(x => x.grade === a.grade && x.topicId === a.topicId).map(x => x.editionId);

// Pinned independently from the manager's pdfs.json and the batch-03 media read-back.
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261117-alg-03-r1': [
    ['f8e4149d737746489f3866c6e9bfa807', 'c4a3fda219a4a3a361277889d0d6d3186eb1908d9ee767f7179ad15e5d8eaa22'],
    ['54f64a4bda964c9d940858a150e05f9e', '8a00250f6779da6f6915be9bc5d34ae1118e24b0e49561795c2a44ed7d69dec0'],
    ['55bae24cc20746aa8375617301ab29f0', 'b825b13f45fa3f76d15695d7b8755042abff144e0ba1adc797d07fb0918ede6d']],
  'ms-20261117-g7-pow-01-r1': [
    ['f43aebdaa54b401b98f36fbe412b26ed', '9e6b17c13764f34b296bab09932b2510bdd60520d6234e1b95ec2420ab06668b'],
    ['513043959765491587c1142fd5df11c0', '4aea1b8020af9a78c7fe5f5ca21eb83c190364a011fd0e17ad45a561552b92b7'],
    ['78e939c9b053490e8407b107784ed450', '2aef3a40d17833187b11b49a7a946dfbe046f3d451296e659eeac2a1d92f0deb']],
  'ms-20261117-root-01-r1': [
    ['f83235f7496948fdb9c010dcffd2df7c', '1dc82e652005d216501c766dff90592668966f92b89f0b1dbee4e9a61c89cfc4'],
    ['485502f803114ead8e73dfb13acb1091', 'c6ec451b834d397354c57f22fba7e0235665b6e69c12c5ba9972cf08a88ed2c2'],
    ['3f599b5c72284e42959eb866c4d23a6c', 'e9cea85908b13771759ce56cd466e9952ec1416b89dab5618ecda9468446cfdc']],
  'ms-20261117-ine-02-r1': [
    ['3de9d153f03a45a9937b717a590193cc', '37128fa7e31086824033afe803faba06830affda50e131d9aeff39853eb07f36'],
    ['f3d9fbce56624504aa11393d7075d6f8', '0fb5f0fe5fc835987f1ce8d5ed88a9195e2b3ecb30b3ccf1e480f60436aaeb6f'],
    ['f6305df3ca714857adae73d608f9c068', '467bdf2fed331d508f3b7976005571e6ed892056cf6a11c3898f78154a369189']],
  'ms-20261117-qap-01-r1': [
    ['36b97eae7e154b91b8731fb723f0d4db', '524110151470dc2fca496901a4cce3ac5275ea9af948ae7fda323a06b841fdab'],
    ['5c29cd897daa488fa2b12f1eb24da62a', 'dfe4c7d1c622b87372200cf96efb86f0d8744043cc66d98c327b4d5f550e0048'],
    ['715ce5ea427f494a8c32811a2bb6396f', '9c58af4f7c1682f95bbf417d0db6fa13ed49d0bc4ef9aa362f0158dc58c1b4d1']],
  'ms-20261117-qin-01-r1': [
    ['dd065333b62f4aa88957c1c2b4fbd2cc', 'a13659058f8cd979641b9bdbf47daf34e965acf81541a5ab1d8635c51b53db87'],
    ['14a156148aae41878e3f3c13aeca0893', '695b6d85b686385fbd3a6f3e25aca135981137407606c5f4775e60a973b045d5'],
    ['3805bd63ad5d4ef0a6989b4c7fa338d5', 'e5b88bfc19200f9c1cc0900e67c2d1c27fd7424498681bb1b4624af1308f336f']],
  'ms-20261117-syq-01-r1': [
    ['5d4484deaaa24c6a98c11f6c7cbe1cc2', '5ff4fd344f749f474c21bf99072ed57d18804c8ae357e8f77871c19ee64ac9b7'],
    ['82bca8eff07b4b75ac760ff0e0c17b19', '164a24b84627d19582fc802f57e88193a6bd77803c53a0efe4d71135a67e3311'],
    ['a60abdb5575d471eb794d8507e28b0ed', 'b1915099e66df294845b88d9b939bc0d8ad38c42dc797a18146fc46488275688']],
  'ms-20261117-itp-01-r1': [
    ['9a344ae17e4843d486c19d180b654a66', 'ff40fc5991f20f275805744fa8ac72cd3ede9470ef5433679030b800ac77069a'],
    ['15faa528161e4b54af250a9f70f82cd9', 'be74b0aeb6de959ef7c9bc4d2dc485c21dd8bfa7270ec6fcd94586fd1bc2e433'],
    ['9c96ce7f46f34701befcb5b993330902', '211f55c2ca6af96ae55dbe97fe8675a3ded7a96b77f26a74cece1b3db66f4a29']],
};

const MAPPINGS: Array<[number, number, string, string]> = [
  [7, 29, 'combining-like-terms-grade-7', 'G7-T96'], [7, 6, 'powers-grade-7', 'G7-T79'],
  [7, 7, 'square-root-grade-7', 'G7-T78'], [8, 52, 'inequalities-grade-8', 'G8-T79'],
  [9, 6, 'quadratic-equations-grade-9', 'G9-T48'], [9, 8, 'quadratic-inequalities-systems-grade-9', 'G9-T49'],
  [9, 8, 'quadratic-inequalities-systems-grade-9', 'G9-T55'], [9, 39, 'trapezoid-grade-9', 'G9-T80'],
];
// Topics that already carried an edition keep it before the new one.
const BASELINE_EDITIONS: Record<string, string[]> = {
  'ms-20261117-g7-pow-01-r1': ['ms-20261115-grw-01-r1'], 'ms-20261117-itp-01-r1': ['ms-20261115-trp-01-r1'],
};

test('eight fixed mappings add twenty-four frozen PDFs and recover the independently pinned 7bccd5f5 baseline', () => {
  // Read from the exact baseline git blobs (claude/batch02a-pdf-20261117 at 7bccd5f5) before implementation.
  const baselineCatalog = '907d855f00fec11c41b159842c73bdc94be867ad7e9b8e1d8b1d29e22e1bcf93';
  const baselineRegistry = '6c3fa7e3523155d885a15450b1327c9aefe853bdaf7bdae009aeb6593f8575a9';
  assert.equal(reviewed.baselineCommit, '7bccd5f587726234367154538b342cb5fd464c9f');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalog);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistry);
  assert.equal(digest(previous), baselineCatalog);
  assert.equal(digest(priorRegistry), baselineRegistry);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug, a.nativePrefix]), MAPPINGS);
  // G7-POW-01 takes a grade prefix: ms-20261117-pow-01-r1 is batch 02a's G9-POW-01.
  assert.deepEqual(ids, ['alg-03', 'g7-pow-01', 'root-01', 'ine-02', 'qap-01', 'qin-01', 'syq-01', 'itp-01']
    .map(key => `ms-20261117-${key}-r1`));
  assert.ok(priorRegistry.editions.some((e: any) => e.editionId === 'ms-20261117-pow-01-r1' && e.grade === 9));
  for (const addition of reviewed.additions) assert.deepEqual(addition.baselineEditionIds, BASELINE_EDITIONS[addition.editionId] || []);
  assert.deepEqual(Object.keys(PINS), ids);
  for (const addition of reviewed.additions) {
    assert.deepEqual(addition.edition.levels.map(l => [l.pdfId, l.pdfSha256]), PINS[addition.editionId]);
    const sheetId = receipt.packages.find((p: any) => p.editionId === addition.editionId).sheetId;
    assert.deepEqual(addition.edition.levels.map(l => l.worksheetId), ['a', 'b', 'c'].map(k => `ms-${sheetId.toLowerCase()}-${k}-r1`));
    assert.match(addition.edition.label, / · PDF$/);
    assert.doesNotMatch(addition.edition.label, /מצומצמת/);
  }
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 24);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 24);
  // The grade-9 probability series (tests/probability-nine-pdf-intake.test.ts) are appended after batch 03.
  const afterBatch03Registry = beforeProbabilityNineRegistry(registry);
  assert.equal(afterBatch03Registry.editions.length, 63);
  assert.equal(afterBatch03Registry.editions.flatMap((e: any) => e.levels).length, 189);
  assert.equal(priorRegistry.editions.length, 55);
  assert.equal(priorRegistry.editions.flatMap((e: any) => e.levels).length, 165);
  assert.deepEqual(afterBatch03Registry.editions.slice(0, 55), priorRegistry.editions);
  assert.deepEqual(afterBatch03Registry.editions.slice(55), reviewed.additions.map(a => a.edition));
  // Editions never add base levels; EQM49 (17.11) is the only later base topic (+3 levels).
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 973);
  assert.deepEqual(receipt.scope, { packages: 8, pdfs: 24, pages: 142, subitems: 588, landingRoutes: 7 });
  assert.deepEqual(receipt.packages.map((p: any) => p.editionId), ids);
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.equal(receipt.review.allGatesPass, false);
  assert.equal(receipt.review.nativeOrHintsAcceptance, false);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
});

test('all twenty-four additions open their own reviewed PDF directly while every previous choice remains', () => {
  for (const addition of reviewed.additions) {
    const topic = catalog.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === addition.editionId)!;
    assert.equal(topic.defaultEditionId, 'legacy');
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.deepEqual(edition.routing, {
      resolvedNoamPrefix: addition.nativePrefix, aiHintShown: false, usesViewer: false,
      viewerPath: 'worksheet-viewer-noam.html',
      siblingPdfQuery: { pa: addition.pdfIds[0], pb: addition.pdfIds[1], pc: addition.pdfIds[2] },
    });
    const back = `/worksheets?grade=${addition.grade}&topic=${addition.topicId}`;
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, back);
    // Topic 9/8 gains two editions, QIN then SYQ, after the legacy links.
    assert.deepEqual(groups.map(g => g.editionId), ['legacy', ...addition.baselineEditionIds, ...sameTopic(addition)]);
    assert.deepEqual(groups.slice(0, 1 + addition.baselineEditionIds.length),
      topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    const group = groups.find(g => g.editionId === addition.editionId)!;
    assert.deepEqual(group.levels.map(l => [l.key, l.label]), [['a', 'רמה א׳'], ['b', 'רמה ב׳'], ['c', 'מצוינות']]);
    assert.equal(group.note, 'קובצי PDF להדפסה');
    assert.deepEqual(topic.levels.map(l => l.key), ['a', 'b', 'c']);
    const proof = receipt.packages.find((p: any) => p.editionId === addition.editionId);
    assert.ok(proof, `${addition.editionId}: public frozen evidence`);
    assert.equal(proof.producerPackage, addition.nativePrefix);
    assert.match(proof.reviewReceiptSha256, /^[0-9a-f]{64}$/);
    // Claude authored every set; Google Antigravity, a non-Claude agent, reviewed every set.
    assert.equal(proof.author, 'Claude (Anthropic), Claude Opus 5.5');
    assert.match(proof.reviewer, /^Google Antigravity/);
    assert.equal(proof.reviewVerdict, 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.equal(proof.reviewReceipts[0].sha256, proof.reviewReceiptSha256);
    assert.match(proof.reviewReceipts[0].path, new RegExp(`^reports/ANTIGRAVITY-INDEPENDENT-${proof.sheetId}-20261116/review\\.json$`));
    assert.equal(proof.track, { 7: 'ז', 8: 'ח', 9: 'ט_רגילה' }[addition.grade as 7 | 8 | 9]);
    for (const [index, level] of edition.levels.entries()) {
      const href = buildWorksheetHref({ catalog, grade: addition.grade, topic, editionId: addition.editionId, levelKey: level.key });
      assert.equal(href, `https://static.wixstatic.com/ugd/d8e7ad_${PINS[addition.editionId][index][0]}.pdf`);
      assert.equal(Object.hasOwn(level, 'ramzi'), false);
      for (const forbidden of ['canonicalSourceSha256', 'manifestSha256', 'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256']) {
        assert.equal(Object.hasOwn(level, forbidden), false);
      }
      const pin = proof.levels.find((p: any) => p.key === level.key);
      for (const field of ['pdfId', 'pdfSha256', 'sourceSha256', 'nativeExportSha256', 'worksheetId', 'revision']) {
        assert.equal(pin[field], (level as any)[field]);
      }
      assert.deepEqual(pin.downloadChecks.map((d: any) => d.url), [
        `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`,
        `https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_${level.pdfId}.pdf`]);
      assert.ok(pin.downloadChecks.every((d: any) => d.status === 200 && d.sha256 === (level as any).pdfSha256 && d.matchesFrozenPdf));
    }
  }
});

test('new PDFs cannot enter teacher, learning, viewer or Ramzi banks', () => {
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const addition of reviewed.additions) {
    assert.equal(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId, edition: addition.editionId }, teacher), null);
    assert.ok(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId }, teacher));
  }
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  for (const id of reviewed.additions.flatMap(a => a.pdfIds)) assert.ok(!collectViewerPdfIds(catalog).includes(id));
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation), buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
  assert.deepEqual(raw.ramziActivation, (previous as any).ramziActivation);
});

test('seven landing updates keep titles and CTAs and describe the actual series in synchronized copy and FAQ schema', () => {
  assert.equal(reviewed.landingDeltas.length, 7);
  const scope: Record<string, string[]> = {
    'combining-like-terms-grade-7': ['כינוס איברים דומים', 'בדיקה בהצבה', 'טעויות נפוצות'],
    'powers-grade-7': ['בסיס ומעריך', 'סדר פעולות חשבון', 'מספר מכוון', 'גדילה והקטנה'],
    'square-root-grade-7': ['ריבועים שלמים', 'אומדן שורש', 'שלמים עוקבים'],
    'inequalities-grade-8': ['ממעלה ראשונה', 'במספר שלילי', 'ציר המספרים'],
    'quadratic-equations-grade-9': ['צורה סטנדרטית', 'טכניקה אלגברית', 'נקודות חיתוך'],
    'quadratic-inequalities-systems-grade-9': ['סקיצה של פרבולה', 'מערכת של ישר ופרבולה', 'שתי סדרות'],
    'trapezoid-grade-9': ['טרפז שווה־שוקיים', 'זוויות הבסיס', 'המשפטים ההפוכים', 'שתי סדרות'],
  };
  // Pages that already carried the generic PDF questions name the new series instead.
  const faqNames: Record<string, [string, string]> = {
    'powers-grade-7': ['מה כוללים דפי ה־PDF על סדר פעולות ובסיס מכוון?', 'האם דפי ה־PDF על סדר פעולות ובסיס מכוון כוללים רמזי?'],
    'trapezoid-grade-9': ['מה כוללים דפי ה־PDF בטרפז שווה־שוקיים?', 'האם דפי ה־PDF בטרפז שווה־שוקיים כוללים רמזי?'],
  };
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug), Object.keys(scope));
  assert.deepEqual(reviewed.landingDeltas.map(d => d.editionIds), [[ids[0]], [ids[1]], [ids[2]], [ids[3]], [ids[4]], [ids[5], ids[6]], [ids[7]]]);
  for (const delta of reviewed.landingDeltas) {
    const pageRaw = read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`);
    const restored = beforeBatch03Copy(delta.slug, pageRaw) as any;
    assert.equal(digest(restored), delta.baselineSha256);
    assert.equal(pageRaw.h1, restored.h1); assert.equal(pageRaw.title, restored.title);
    assert.deepEqual(pageRaw.catalogCta, restored.catalogCta);
    assert.deepEqual(pageRaw.catalogCtas, restored.catalogCtas);
    assert.deepEqual(Object.keys(pageRaw), Object.keys(restored));
    assert.equal(pageRaw.updatedLine, 'נועם דורון מתמטיקה · עודכן 17.11.2026');
    assert.equal(pageRaw.updatedLinePlacement, 'after-sections');
    assert.ok([...pageRaw.description].length <= 155, delta.slug);
    for (const term of scope[delta.slug]) assert.ok(pageRaw.description.includes(term), `${delta.slug}: ${term}`);
    assert.match(pageRaw.intro, /בדפים שנפתחים עם רמזי אפשר לקבל רמזים; קובצי ה־PDF הנוספים מיועדים להורדה ולהדפסה\.$/);
    const added: any = pageRaw.sections.at(-1);
    assert.deepEqual(added, delta.appendedSection as any);
    assert.deepEqual(pageRaw.sections.slice(0, -1), restored.sections);
    // One landing describes two series (as next12 did on area-rectangle-perimeter-grade-7); on
    // powers-grade-7 the earlier GRW-01 section already ends with the standard sentence verbatim.
    assert.equal(added.blocks.at(-1).text, delta.editionIds.length === 2
      ? 'לכל סדרה שלושה קובצי PDF ברמות א׳, ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף.'
      : delta.slug === 'powers-grade-7'
        ? 'גם בסדרה זו שלושה קובצי PDF ברמות א׳, ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף.'
        : 'שלושה קובצי PDF ברמות א׳, ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף.');
    const paragraphs = pageRaw.sections.flatMap((s: any) => s.blocks.filter((b: any) => b.type === 'paragraph').map((b: any) => b.text));
    assert.equal(new Set(paragraphs).size, paragraphs.length, `${delta.slug}: no paragraph repeated verbatim`);
    // TopicPage's setupSelfCheckReveal() hides the second paragraph of a section whose heading
    // looks like a self-check; the new sections are plain copy and must stay fully visible.
    assert.ok(!/בדקו|בדיקה/.test(added.heading) && !/\?$/.test(added.heading)
      && !/^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(added.heading), `${delta.slug}: heading would hide copy behind הצג תשובה`);
    assert.deepEqual(pageRaw.faq.slice(-2).map((f: any) => f.question),
      faqNames[delta.slug] || ['מה כוללים קובצי ה־PDF הנוספים?', 'האם קובצי ה־PDF הנוספים כוללים רמזי?']);
    assert.equal(new Set(pageRaw.faq.map((f: any) => f.question)).size, pageRaw.faq.length, `${delta.slug}: unique FAQ questions`);
    for (const text of [pageRaw.description, pageRaw.intro, added.heading, ...added.blocks.map((b: any) => b.text),
      ...pageRaw.faq.slice(-2).flatMap((f: any) => [f.question, f.answer])]) {
      assert.ok(!text.includes('/'), `${delta.slug}: no slash fractions`);
      assert.ok(!text.includes('רמה ג׳'), `${delta.slug}: level names`);
      // Every grade-9 set here is regular-track; none may be described as the reduced track.
      assert.ok(!text.includes('מצומצמת'), `${delta.slug}: track`);
      for (const banned of ['פתרון מלא', 'פתרונות מלאים', 'דוגמה פתורה', 'רמז מנועם', 'נועם AI']) {
        assert.ok(!text.includes(banned), `${delta.slug}: ${banned}`);
      }
    }
    const page = loadTopicPage(delta.slug), flow = synthesizeBodyFlow(page);
    assert.equal(flow.filter(b => b.type === 'heading' && plain(b.text || '') === added.heading).length, 1);
    for (const block of added.blocks) assert.equal(flow.filter(b => b.type === 'paragraph' && plain(b.text || '') === block.text).length, 1);
    const faq = extractJsonLdFaq(page.jsonLd).map(f => ({ question: plain(f.question), answer: plain(f.answer) }));
    assert.deepEqual(faq, pageRaw.faq);
    assert.deepEqual(pageRaw.faqGroups[0].items, pageRaw.faq);
    assert.equal(pageRaw.faq.length, restored.faq.length + 2);
    for (const node of (page.jsonLd['@graph'] as any[]).filter((n: any) => ['WebPage', 'LearningResource'].includes(n['@type']))) {
      assert.equal(node.description, page.description);
      assert.equal(node.dateModified, '2026-11-17');
    }
  }
  // Pages with an earlier PDF series keep it and add the new one before the Ramzi sentence.
  const page = (slug: string) => read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
  assert.match(page('powers-grade-7').intro, /המתמקדים בגדילה ובהקטנה\. נוספה גם סדרת PDF על סימון חזקה/);
  assert.match(page('trapezoid-grade-9').intro, /והשוואת שטחים, ברמות א׳, ב׳ ומצוינות\. נוספו גם קובצי PDF לטרפז שווה־שוקיים/);
  assert.match(page('quadratic-inequalities-systems-grade-9').intro, /נוספו שתי סדרות PDF ברמות א׳, ב׳ ומצוינות/);
  // The reviewed copy corrections stay in place.
  const text = (slug: string) => page(slug).sections.at(-1).blocks.map((b: any) => b.text).join(' ');
  const root7 = text('square-root-grade-7');
  assert.ok(root7.includes('ובמצוינות אומדים שורש גם בדיוק של עשירית, ויש יותר שורשים של חזקות.'));
  assert.ok(!root7.includes('במצוינות מחשבים שורשים של חזקות'));
  const ine8 = text('inequalities-grade-8');
  assert.ok(ine8.includes('פותרים אי־שוויונות שיש בהם כמה מכנים,') && ine8.includes('וסופרים פתרונות שלמים.'));
  assert.ok(!ine8.includes('עם מכנים וסוגריים') && !ine8.includes('ומוצאים פתרונות שלמים'));
  // The independent review's wording fixes stay in place.
  assert.ok(text('quadratic-equations-grade-9').includes('מוצאים גם לאילו ערכי x שני ביטויים שווים.'));
  assert.ok(text('powers-grade-7').includes('ומבדילים בין חזקה של מספר שלילי בסוגריים') && !text('powers-grade-7').includes('ומבחינים בין חזקה'));
  assert.ok(text('quadratic-inequalities-systems-grade-9').includes('סקיצה שמסרטטים לבד') && !text('quadratic-inequalities-systems-grade-9').includes('בעצמכם'));
  // Per the pdfs.json mapping caution, QAP must not be claimed as covering the quadratic-formula unit; the new copy makes no formula claim.
  assert.ok(!text('quadratic-equations-grade-9').includes('נוסחת השורשים'));
});

test('preservation fences reject changed old links, substitutions, reordering, duplicates and unsupported landing claims', () => {
  const topicOf = (cat: any, g: number, t: number) => cat.grades.find((x: any) => x.grade === g).topics.find((x: any) => x.id === t);
  const old = structuredClone(raw);
  topicOf(old, 7, 29).levels[0].pdfId = 'old-link-changed';
  assert.throws(() => beforeBatch03Catalog(old));
  const inserted = structuredClone(raw);
  const roots = topicOf(inserted, 7, 7);
  roots.editions.unshift({ ...structuredClone(roots.editions[0]), editionId: 'ms-unreviewed-r1' });
  assert.throws(() => beforeBatch03Catalog(inserted));
  const changed = structuredClone(raw);
  topicOf(changed, 9, 39).editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch03Catalog(changed));
  const earlier = structuredClone(raw);
  topicOf(earlier, 7, 6).editions[0].label = 'changed earlier edition';
  assert.throws(() => beforeBatch03Catalog(earlier));
  const reordered = structuredClone(raw);
  topicOf(reordered, 8, 52).levels.reverse();
  assert.throws(() => beforeBatch03Catalog(reordered));
  const shared = structuredClone(raw);
  topicOf(shared, 9, 8).editions.reverse();
  assert.throws(() => beforeBatch03Catalog(shared));
  const swapped = structuredClone(raw);
  const [t6, t8] = [6, 8].map(id => topicOf(swapped, 9, id));
  [t6.editions, t8.editions] = [t8.editions, t6.editions];
  assert.throws(() => beforeBatch03Catalog(swapped));
  const defaultFlip = structuredClone(raw);
  topicOf(defaultFlip, 9, 6).defaultEditionId = ids[4];
  assert.throws(() => beforeBatch03Catalog(defaultFlip));
  const duplicate = structuredClone(registry);
  duplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch03Registry(duplicate));
  const registryDefault = structuredClone(registry);
  registryDefault.editions.find((e: any) => e.editionId === ids[7]).isDefault = true;
  assert.throws(() => beforeBatch03Registry(registryDefault));
  const page = read('headless/astro-poc/src/data/topic-pages/quadratic-equations-grade-9.json');
  page.intro += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch03Copy('quadratic-equations-grade-9', page));
  const section = read('headless/astro-poc/src/data/topic-pages/quadratic-inequalities-systems-grade-9.json');
  section.sections.at(-1).blocks[0].text += ' לתוכנית המצומצמת';
  assert.throws(() => beforeBatch03Copy('quadratic-inequalities-systems-grade-9', section));
});
