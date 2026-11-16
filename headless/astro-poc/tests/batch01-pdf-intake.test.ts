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
import { beforeBatch01Catalog, beforeBatch01Registry, beforeBatch01Copy,
  reviewedBatch01 as reviewed, reviewedBatch01Ids as ids } from './fixtures/batch01-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch01Catalog(raw) as ReturnType<typeof loadCatalog>;
// Same SSR normalization as loadCatalog (Wix media CDN) so direct-PDF links compare like for like.
const previousSsr = { ...previous, config: { ...previous.config, pdfBase: 'https://static.wixstatic.com/ugd/d8e7ad_' } };
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeBatch01Registry(registry);
const receipt = read('docs/batch01-pdf-first-20261116.json');
const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');

// Pinned independently from the manager's media read-back (media-cdn-readback.json) and pdfs.json.
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261116-sys-01-r1': [
    ['9f34fe91d16048e4a01182a4225ef8dd', '2c4d7593f268f48155ea093c8661334fb56e9b34bbb601ec40673cb542c6f354'],
    ['99d49eb57b3f44c1b9da694de64dd784', '7220fb8cf22ddf3794860d946c01038fb6d884f4f77693ed52f5773d3bb9c7cb'],
    ['0da4a3b18ac542cba22c8d6ef261f14a', '47a3e6ed6c094a237274ed358940363a52b0ed6d0499f24771dbf12fe8be66ae']],
  'ms-20261116-sys-02-r1': [
    ['41331d06b2fd4252b9ba4ca4d821c1bc', 'efb4faed8e122809e9079acdbf52d3f8166d8a0eaa69090f96daa1eea9cbf64a'],
    ['8fd491d30fb94f34b8b360e72940b8cf', '985a85bc6cbd939ba3f03d00373b274b53eb0cbc84941eab71b66efe5cc1122d'],
    ['3cd341ef5c2f4f029ef2cb18de0a482f', 'bfd27c6279ec62a2c1e963e73ef7597f2d5f85df31bea9a67a6eececc8430a39']],
  'ms-20261116-tri-03-r1': [
    ['5644fcd61f6147b5a5b951933aae2484', '5dc990973034bcb88f31723af700e29046de61ecf77dc4fba9a1ce24915d6d31'],
    ['aba931d4fa104724861715f6371ea6a8', '83ec5a5f73a90a614aed3c9be05a49a38a926f196300a3d2693b6bcad9f9b767'],
    ['1cd7f1fd17dd452b9cfbf9ac67ced3e2', '33c04186f533db3e2fa0c2a384f7445130cb92bb00140dbd4c41bf161f035f5b']],
  'ms-20261116-p3d-01-r1': [
    ['72aa12ad8cc14765b5d5e0b6b8f14d2d', '3c1a868fb763de1b55e1979e5cca0188e92be0fb245b5aa25d1b37c455fb5320'],
    ['f28834f3cb914480a03d0ea1ece2b8de', '0607feb15c41a69e7b4f3d04bf975123bcc1a09f2f41212dc36229fedf8d1a77'],
    ['7f03347f55494219ac80d1f98bda317b', 'c0f0f305265db3dacf1ab2f93ca2ecc5b2811bf6c0adaf93f976c98628b31f5c']],
  'ms-20261116-par-05-r1': [
    ['60948665263c479689c0caef30639347', '67737c262dceea87ca9a1b017ad0ed8937828cf1d4956d7814abf3d61fad3495'],
    ['3c148a618bc741f6aa4de867a1f7ac4e', 'f03e6f89a562608744b4034b31368592583468e19364fc41fc8fa3b5e73bb1f7'],
    ['3bbdde3be7664df2bd415ed258d7813e', '9c2a8060ae8a03b8776da057e61d4e16d62d78bbf870c1961541edccdc84ff4c']],
};

test('five fixed mappings add fifteen frozen PDFs and recover the independently pinned 92bb57b5e baseline', () => {
  // Read from the exact baseline git blobs before implementation.
  const baselineCatalog = '17bedac54256640c2de45a4d311af4cd7c1d56e7fe7473313d30ef19f6dc4ce8';
  const baselineRegistry = '1dfb2f600477fb79ee6ce10ce9a6a2b8d1e6d26499c97b9a1548ea5fff9c1143';
  assert.equal(reviewed.baselineCommit, '92bb57b5ee9acbca4032837c93690e3cec7e03db');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalog);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistry);
  assert.equal(digest(previous), baselineCatalog);
  assert.equal(digest(priorRegistry), baselineRegistry);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), [
    [8, 47, 'systems-of-equations-grade-8'], [8, 48, 'systems-algebraic-solution-grade-8'],
    [8, 39, 'exterior-angle-triangle-grade-8'], [8, 54, 'pythagoras-in-space-grade-8'], [9, 7, 'parallelogram-grade-9']]);
  assert.deepEqual(ids, ['sys-01', 'sys-02', 'tri-03', 'p3d-01', 'par-05'].map(key => `ms-20261116-${key}-r1`));
  assert.deepEqual(reviewed.additions.map(a => a.nativePrefix), ['G8-T76', 'G8-T77', 'G8-T74', 'G8-T90', 'G9-T66']);
  assert.deepEqual(Object.keys(PINS), ids);
  for (const addition of reviewed.additions) {
    assert.deepEqual(addition.edition.levels.map(l => [l.pdfId, l.pdfSha256]), PINS[addition.editionId]);
    const sheetId = receipt.packages.find((p: any) => p.editionId === addition.editionId).sheetId;
    assert.deepEqual(addition.edition.levels.map(l => l.worksheetId), ['a', 'b', 'c'].map(k => `ms-${sheetId.toLowerCase()}-${k}-r1`));
    assert.match(addition.edition.label, / · PDF$/);
  }
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 15);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 15);
  assert.equal(registry.editions.length, 40);
  assert.equal(registry.editions.flatMap((e: any) => e.levels).length, 120);
  assert.equal(priorRegistry.editions.length, 35);
  assert.equal(priorRegistry.editions.flatMap((e: any) => e.levels).length, 105);
  assert.deepEqual(registry.editions.slice(0, 35), priorRegistry.editions);
  assert.deepEqual(registry.editions.slice(35), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 973);
  assert.deepEqual(receipt.scope, { packages: 5, pdfs: 15, pages: 101, subitems: 468, landingRoutes: 5 });
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.equal(receipt.review.allGatesPass, false);
  assert.equal(receipt.review.nativeOrHintsAcceptance, false);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
});

test('all fifteen additions open their own reviewed PDF directly while every previous choice remains', () => {
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
    assert.deepEqual(groups.map(g => g.editionId), ['legacy', ...addition.baselineEditionIds, addition.editionId]);
    assert.deepEqual(groups.slice(0, -1), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    assert.deepEqual(groups.at(-1)!.levels.map(l => [l.key, l.label]), [['a', 'רמה א׳'], ['b', 'רמה ב׳'], ['c', 'מצוינות']]);
    assert.equal(groups.at(-1)!.note, 'קובצי PDF להדפסה');
    const proof = receipt.packages.find((p: any) => p.editionId === addition.editionId);
    assert.ok(proof, `${addition.editionId}: public frozen evidence`);
    assert.equal(proof.producerPackage, addition.nativePrefix);
    assert.match(proof.reviewReceiptSha256, /^[0-9a-f]{64}$/);
    assert.match(proof.reviewVerdict, /^PASS_STUDENT_PDF_ESSENTIALS$/);
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
  // Topic 8/54 keeps its four legacy levels; the reviewed edition supplies a, b and c only.
  const p3d = catalog.grades.find(g => g.grade === 8)!.topics.find(t => t.id === 54)!;
  assert.deepEqual(p3d.levels.map(l => l.key), ['a', 'b', 'c', 'c2']);
  assert.deepEqual(p3d.editions!.at(-1)!.levels.map(l => l.key), ['a', 'b', 'c']);
  const par = catalog.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 7)!;
  assert.deepEqual(par.editions!.map(e => e.editionId), ['ms-20261113-par-r1', 'ms-20261113-par-02-r1',
    'ms-20261113-par-03-r1', 'ms-20261113-par-04-r1', 'ms-20261116-par-05-r1']);
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

test('five landing updates keep titles and CTAs and describe the actual series in synchronized copy and FAQ schema', () => {
  assert.equal(reviewed.landingDeltas.length, 5);
  const scope: Record<string, string[]> = {
    'systems-of-equations-grade-8': ['נקודת החיתוך', 'ישרים מקבילים', 'מספר הפתרונות'],
    'systems-algebraic-solution-grade-8': ['השוואת מקדמים', 'מערכות מיוחדות', 'שאלות מילוליות'],
    'exterior-angle-triangle-grade-8': ['הזווית החיצונית', 'משוואות', 'מערכת צירים'],
    'pythagoras-in-space-grade-8': ['אלכסון מרחבי', 'בתיבה ובקובייה', 'במנסרה, בחרוט ובגליל'],
    'parallelogram-grade-9': ['בניית מקבילית בסרגל ובמחוגה'],
  };
  for (const delta of reviewed.landingDeltas) {
    const pageRaw = read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`);
    const restored = beforeBatch01Copy(delta.slug, pageRaw) as any;
    assert.equal(digest(restored), delta.baselineSha256);
    assert.equal(pageRaw.h1, restored.h1); assert.equal(pageRaw.title, restored.title);
    assert.deepEqual(pageRaw.catalogCta, restored.catalogCta);
    assert.deepEqual(pageRaw.catalogCtas, restored.catalogCtas);
    assert.equal(pageRaw.updatedLine, 'נועם דורון מתמטיקה · עודכן 16.11.2026');
    assert.equal(pageRaw.updatedLinePlacement, 'after-sections');
    assert.ok([...pageRaw.description].length <= 155, delta.slug);
    for (const term of scope[delta.slug]) assert.ok(pageRaw.description.includes(term), `${delta.slug}: ${term}`);
    assert.match(pageRaw.intro, /בדפים שנפתחים עם רמזי אפשר לקבל רמזים; קובצי ה־PDF הנוספים מיועדים להורדה ולהדפסה\.$/);
    const added: any = pageRaw.sections.at(-1);
    assert.deepEqual(added, delta.appendedSection as any);
    assert.equal(added.blocks.at(-1).text, 'שלושה קובצי PDF ברמות א׳, ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף.');
    for (const text of [pageRaw.description, pageRaw.intro, added.heading, ...added.blocks.map((b: any) => b.text),
      ...pageRaw.faq.slice(-2).flatMap((f: any) => [f.question, f.answer])]) {
      assert.ok(!text.includes('/'), `${delta.slug}: no slash fractions`);
      assert.ok(!text.includes('רמה ג׳'), `${delta.slug}: level names`);
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
      assert.equal(node.dateModified, '2026-11-16');
    }
  }
  // The parallelogram page keeps the earlier T90 section and names this series in its FAQ.
  const par = read('headless/astro-poc/src/data/topic-pages/parallelogram-grade-9.json');
  assert.equal(par.sections.filter((s: any) => s.heading === 'תרגול נוסף: טרפז שווה־שוקיים — תוצאות מתכונות המקבילית').length, 1);
  assert.deepEqual(par.faq.slice(-2).map((f: any) => f.question), ['מה כוללים דפי ה־PDF בבניית מקבילית?', 'האם דפי ה־PDF בבניית מקבילית כוללים רמזי?']);
});

test('preservation fences reject changed old links, substitutions, reordering, duplicates and unsupported landing claims', () => {
  const old = structuredClone(raw);
  old.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 54).levels[3].pdfId = 'old-link-changed';
  assert.throws(() => beforeBatch01Catalog(old));
  const earlier = structuredClone(raw);
  earlier.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 7).editions[0].levels[0].pdfId = 'f'.repeat(32);
  assert.throws(() => beforeBatch01Catalog(earlier));
  const changed = structuredClone(raw);
  changed.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 47).editions[0].levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch01Catalog(changed));
  const reordered = structuredClone(raw);
  const parTopic = reordered.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 7);
  parTopic.editions.unshift(parTopic.editions.pop());
  assert.throws(() => beforeBatch01Catalog(reordered));
  const defaultFlip = structuredClone(raw);
  defaultFlip.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 39).defaultEditionId = ids[2];
  assert.throws(() => beforeBatch01Catalog(defaultFlip));
  const duplicate = structuredClone(registry);
  duplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch01Registry(duplicate));
  const registryDefault = structuredClone(registry);
  registryDefault.editions.find((e: any) => e.editionId === ids[4]).isDefault = true;
  assert.throws(() => beforeBatch01Registry(registryDefault));
  const page = read('headless/astro-poc/src/data/topic-pages/pythagoras-in-space-grade-8.json');
  page.intro += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch01Copy('pythagoras-in-space-grade-8', page));
});
