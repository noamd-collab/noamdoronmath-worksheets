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
import { beforeBatch04Catalog, beforeBatch04Registry, beforeBatch04Copy,
  reviewedBatch04 as reviewed, reviewedBatch04Ids as ids } from './fixtures/batch04-pdf';
import { beforeBatch05Registry } from './fixtures/batch05-pdf';
import { beforeBatch08Copy } from './fixtures/batch08-pdf';
import { beforeLandingCorrections } from './fixtures/landing-corrections-20261118';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch04Catalog(raw) as ReturnType<typeof loadCatalog>;
// Same SSR normalization as loadCatalog (Wix media CDN) so direct-PDF links compare like for like.
const previousSsr = { ...previous, config: { ...previous.config, pdfBase: 'https://static.wixstatic.com/ugd/d8e7ad_' } };
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeBatch04Registry(registry);
const batch04Registry = beforeBatch05Registry(registry);
const receipt = read('docs/batch04-pdf-first-20261117.json');
const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');

// Pinned independently from the manager's pdfs.json and the batch-04 media read-back.
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261117-kte-01-r1': [
    ['e6d9fd16fec044bd98993bd67673cd08', 'afd952fc2baaebb2ec2ec8b06b477be190aa2abe6c80e71360a59f477e71c1b9'],
    ['9fe7e16d054b47b3996916115fc1fedd', '088d3eefdbd3db17d070ff7da6bec94d5470fbf34680ce242d336554563cff74'],
    ['ab74337f273443acac12e0b1597d6d30', '52af5b7744cb6393dd5dccf50e6a888c7e000e61a8377effe50fc36b7253930d']],
  'ms-20261117-r30-01-r1': [
    ['b3032891143c474684bf9dceb1c2aad2', '427a076f8b26895ce469c172895e641346d2926e551b261ec3b23b3575d89655'],
    ['8480cdc35cd442c5b5a1565fce5c708d', '3499319782baffccffdef12d7804bba5316ac4a1500e2308b1b578b017e5ea0d'],
    ['2a8c4de26b774d5e98f0874fbd305f5e', '293ca1b4db3e20fe4452c48e12d7e542bb366d5d00dbfbfe029b7b6e52c3dbfe']],
  'ms-20261117-prs-01-r1': [
    ['591b47b0dee64085af5d995ea326f94a', 'd4c30a7fe8da8444bd4b4c6328277c3fa05053bc91bed134725c6697e8873efd'],
    ['3e4d1d72f4f74b4ca12b2e602dd46453', 'dd7ccc1b2e5fc1ab313a8e59674c0617eeabf0c896416e0e46998bf60daafae7'],
    ['a194d9e6f4c24e588b8069af66fea49d', '2d71c67e2ad26bfab74902e21be3da553dcddc0545461928e4b04b9acf7c14e7']],
  'ms-20261117-g8-sim-01-r1': [
    ['690f5fcdce364f288c27a9326ef9a0cc', '986de8f01ce92e5e35a5711f40ecd2c22cbd38187870e7f6f24dfd7d4d8990f5'],
    ['6218e14b0d1c4a2db2f893ce92a50d74', 'e513c9580aee77b040b03043be7560c857e6e1d2ae9251dbfb50dda6c2dd3f5e'],
    ['3d030557d6ed444dafd26b25552a9eb2', '6c24e2cac1c7c25738347c01c62b04a2ebcedb41744527888df492c53eb6d33b']],
};

const MAPPINGS: Array<[number, number, string, string]> = [
  [9, 46, 'kite-grade-9', 'G9-T96'], [9, 37, 'triangle-30-60-90-grade-9', 'G9-T75'],
  [7, 48, 'solids-box-cube-prism-grade-7', 'G7-T73'], [8, 43, 'similar-triangles-grade-8', 'G8-T99'],
];
// Review receipts and gate waivers, pinned from the files the manager decided on (17.11.2026).
const RECEIPTS: Record<string, { review: string, waiver: string, reviewer: RegExp }> = {
  'G9-KTE-01': { review: 'bab859f3f62aa14364444b9a727a99898ad7dfe7c1427e6c5a643cdb35080a7e',
    waiver: 'f14b26269d0fc4a7899c10da3a94539916e49f42bc15da4e195dc872c79bc4f6', reviewer: /^Claude Opus 5\.5 / },
  'G9-R30-01': { review: 'eea132d428344abe6463e3a29e635c0b3a08ad002b9b8b2b1c5cdfd59855208a',
    waiver: '70f97b2b2c120ae9fec0162001a72256e166518b34651ba76ab938161feaac90', reviewer: /^Claude Fable 5\.2 / },
  'G7-PRS-01': { review: '6d0c92bdeba6bb0ad2223ab35ba762b5e47df5c8fa2619437e1bfaa29611eba7',
    waiver: '0a5ad66e1547cbfa924fc0218821690402308d4466c3d3cf69c25251d7b9048b', reviewer: /^Claude Fable 5\.2 / },
  'G8-SIM-01': { review: 'd5e34037bec9dad716eda159cf8657d029d411839fcb8bfe55bebef96e57c8b5',
    waiver: 'ccd985d0aff0b45bbe79f56228c673ea07c32b0cbe8be477aadbd47851f37187', reviewer: /^Claude Opus 5\.5 / },
};
const ADDENDUM = 'e239cce36e327825b3aadd538043a366b9458d748b22274cce71873fdb0b6dc8';
// Topic 8/43 keeps its four legacy levels; the reviewed edition supplies a, b and c only (as 8/54 in batch 01).
const legacyKeys = (a: { grade: number, topicId: number }) => a.grade === 8 && a.topicId === 43 ? ['a', 'b', 'c', 'c2'] : ['a', 'b', 'c'];

test('four fixed mappings add twelve frozen PDFs and recover the independently pinned 74449462 baseline', () => {
  // Read from the exact baseline git blobs (headless/astro-poc-baseline at 74449462, after #509, #511 and #513),
  // not from the regenerated tree. The branch was reviewed on 5464497f (the head of PR #509); the content
  // train merged it onto the moved baseline, after the three probability editions of #511, and re-pinned
  // these three values. Every per-edition and per-landing pin of the fixture is unchanged.
  const baselineCatalog = '7532e3beacc2db98a148bea7112f29530131f28b20dd27ddf0e8fac53de4d63f';
  const baselineRegistry = '770a7f3a6a8db67c55c03edd3efa93f70604954ae5aecc70af5acecf45e50513';
  assert.equal(reviewed.baselineCommit, '7444946269cf053b3789b7e67e7968a7c1d597b0');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalog);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistry);
  assert.equal(digest(previous), baselineCatalog);
  assert.equal(digest(priorRegistry), baselineRegistry);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug, a.nativePrefix]), MAPPINGS);
  // G8-SIM-01 takes a grade prefix: ms-20261115-sim9-01-r1 (worksheets ms-g9-sim-01-*) is G9-SIM-01.
  assert.deepEqual(ids, ['kte-01', 'r30-01', 'prs-01', 'g8-sim-01'].map(key => `ms-20261117-${key}-r1`));
  const sim9 = priorRegistry.editions.find((e: any) => e.editionId === 'ms-20261115-sim9-01-r1');
  assert.ok(sim9 && sim9.grade === 9 && sim9.levels[0].worksheetId === 'ms-g9-sim-01-a-r1');
  // None of the four topics had an edition before.
  for (const addition of reviewed.additions) assert.deepEqual(addition.baselineEditionIds, []);
  // The prism series joins topic 7/48 only; its landing keeps the three hero topics 48, 47 and 20.
  assert.deepEqual(reviewed.additions.map(a => a.ctaTopics), [[46], [37], [48, 47, 20], [43]]);
  assert.deepEqual(Object.keys(PINS), ids);
  for (const addition of reviewed.additions) {
    assert.deepEqual(addition.edition.levels.map(l => [l.pdfId, l.pdfSha256]), PINS[addition.editionId]);
    const sheetId = receipt.packages.find((p: any) => p.editionId === addition.editionId).sheetId;
    assert.deepEqual(addition.edition.levels.map(l => l.worksheetId), ['a', 'b', 'c'].map(k => `ms-${sheetId.toLowerCase()}-${k}-r1`));
    assert.deepEqual(addition.edition.levels.map(l => l.viewerLevel), ['A', 'B', 'E']);
    assert.equal(addition.edition.isDefault, false);
    assert.equal(addition.edition.status, 'published');
    assert.match(addition.edition.label, / · PDF$/);
    assert.doesNotMatch(addition.edition.label, /מצומצמת/);
  }
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 12);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 12);
  assert.equal(batch04Registry.editions.length, 70);
  assert.equal(batch04Registry.editions.flatMap((e: any) => e.levels).length, 210);
  assert.equal(priorRegistry.editions.length, 66);
  assert.equal(priorRegistry.editions.flatMap((e: any) => e.levels).length, 198);
  assert.deepEqual(batch04Registry.editions.slice(0, 66), priorRegistry.editions);
  assert.deepEqual(batch04Registry.editions.slice(66), reviewed.additions.map(a => a.edition));
  // Editions never add base levels; EQM49 (17.11, +3 levels) and NEW4 (18.11, +12 levels) are the later base topics.
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 988); // NEW4 (18.11): four later base topics, +12 levels
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 973);
  assert.deepEqual(receipt.scope, { packages: 4, pdfs: 12, pages: 114, subitems: 342, landingRoutes: 4 });
  assert.deepEqual(receipt.packages.map((p: any) => p.editionId), ids);
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.equal(receipt.review.allGatesPass, false);
  assert.equal(receipt.review.nativeOrHintsAcceptance, false);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
});

test('all twelve additions open their own reviewed PDF directly while every previous choice remains', () => {
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
    assert.deepEqual(groups.map(g => g.editionId), ['legacy', addition.editionId]);
    assert.deepEqual(groups.slice(0, 1), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    const group = groups.find(g => g.editionId === addition.editionId)!;
    assert.deepEqual(group.levels.map(l => [l.key, l.label]), [['a', 'רמה א׳'], ['b', 'רמה ב׳'], ['c', 'מצוינות']]);
    assert.equal(group.note, 'קובצי PDF להדפסה');
    assert.deepEqual(topic.levels.map(l => l.key), legacyKeys(addition));
    assert.deepEqual(groups[0].levels.map(l => l.key), legacyKeys(addition));
    assert.deepEqual(edition.levels.map(l => l.key), ['a', 'b', 'c']);
    const proof = receipt.packages.find((p: any) => p.editionId === addition.editionId);
    assert.ok(proof, `${addition.editionId}: public frozen evidence`);
    assert.equal(proof.producerPackage, addition.nativePrefix);
    // Astra (Codex) authored every set; Claude, which is not the author, reviewed every set.
    assert.equal(proof.author, 'Astra (Codex, gpt-6-astra)');
    assert.match(proof.reviewer, RECEIPTS[proof.sheetId].reviewer);
    assert.match(proof.reviewer, /not the author/);
    assert.equal(proof.reviewVerdict, 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.equal(proof.reviewReceiptSha256, RECEIPTS[proof.sheetId].review);
    assert.equal(proof.reviewReceipts[0].sha256, proof.reviewReceiptSha256);
    assert.match(proof.reviewReceipts[0].path, new RegExp(`^reports/CLAUDE-INDEPENDENT-${proof.sheetId}-2026111[67]/review\\.json$`));
    assert.equal(proof.reviewItemsChecked, proof.levels.reduce((n: number, l: any) => n + l.subitems, 0));
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

test('no producer report is PASS: every non-PASS gate carries a recorded waiver decision bound to the waiver files', () => {
  assert.equal(receipt.review.gateWaivers.addendum.sha256, ADDENDUM);
  assert.equal(receipt.review.gateWaivers.addendum.path, 'submissions/Claude/MANAGER-20261116/batch-04/waivers/ADDENDUM-20261117.json');
  assert.match(receipt.review.gateWaivers.authority, /^Noam, 17\.11\.2026/);
  const gatesOf = (sheetId: string) => receipt.packages.find((p: any) => p.sheetId === sheetId).gateWaivers.decisions.map((d: any) => d.gate);
  assert.deepEqual(gatesOf('G9-KTE-01'), ['check_didactic D11 q3c', 'check_didactic D12 q8b', 'G94-page-density']);
  assert.deepEqual(gatesOf('G9-R30-01'), ['check_didactic D4 q4', 'check_didactic D4 q7', 'check_didactic D8 q4', 'G94-page-density']);
  assert.deepEqual(gatesOf('G7-PRS-01'), ['G87-subtopic-chronology']);
  assert.deepEqual(gatesOf('G8-SIM-01'), ['G92-section-structure', 'G94-page-density']);
  for (const proof of receipt.packages) {
    const w = proof.gateWaivers;
    assert.deepEqual(w.waiver, { path: `submissions/Claude/MANAGER-20261116/batch-04/waivers/${proof.sheetId}.json`, sha256: RECEIPTS[proof.sheetId].waiver });
    assert.equal(w.addendum.sha256, ADDENDUM);
    assert.ok(w.producerReports.length >= 1);
    for (const report of w.producerReports) {
      assert.notEqual(report.result, 'PASS');
      assert.match(report.sha256, /^[0-9a-f]{64}$/);
      assert.equal(report.gates, 34);
      assert.ok(report.nonPassGates.length + report.nonPassSteps.length > 0);
    }
    // Every non-PASS gate row of the pinned build is named by a decision.
    const pinned = w.producerReports[0];
    assert.equal(pinned.role, 'pinned build');
    for (const row of pinned.nonPassGates) {
      assert.ok(w.decisions.some((d: any) => row.startsWith(d.gate + ' ')), `${proof.sheetId}: ${row}`);
    }
    for (const decision of w.decisions) {
      assert.ok(decision.decision.length > 0 && decision.basis.length > 40, `${proof.sheetId}: ${decision.gate}`);
      assert.ok(decision.levels.length >= 1);
    }
  }
  // G9-KTE-01 pins the export-fix rebuild, whose export passes D12; the released build is recorded beside it.
  const kte = receipt.packages.find((p: any) => p.sheetId === 'G9-KTE-01');
  assert.equal(kte.sourceBuild, 'export-fix-20261115/authoring/out');
  assert.equal(kte.gateWaivers.producerReports.length, 2);
  assert.ok(kte.gateWaivers.producerReports[1].nonPassSteps.includes('check_didactic.py FAIL'));
  assert.ok(kte.gateWaivers.producerReports[0].nonPassSteps.includes('check_didactic.py REVIEW'));
  // The G8-SIM-01 decision is the addendum's: a registry-text error, not a layout conflict.
  const sim = receipt.packages.find((p: any) => p.sheetId === 'G8-SIM-01').gateWaivers.decisions[0];
  assert.match(sim.decision, /skill registry text/);
  assert.match(sim.basis, /geometry_8\.pdf p75/);
  // Nothing private: no local paths in the public receipt.
  const text = JSON.stringify(receipt);
  for (const needle of ['/Users/', '/private/', '/root/']) assert.ok(!text.includes(needle), needle);
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

test('four landing updates keep titles and CTAs and describe the actual series in synchronized copy and FAQ schema', () => {
  assert.equal(reviewed.landingDeltas.length, 4);
  const scope: Record<string, string[]> = {
    'kite-grade-9': ['תכונות הזוויות', 'האלכסון הראשי', 'שטח דלתון'],
    'triangle-30-60-90-grade-9': ['מחצית היתר', 'המשפט ההפוך'],
    'solids-box-cube-prism-grade-7': ['תיבה, קובייה ומנסרה משולשת', 'מנסרה משולשת ישרה', 'פריסה'],
    'similar-triangles-grade-8': ['יחס הדמיון', 'לפי זוויות (ז.ז)', 'יחס שטחים'],
  };
  const ctaTopics: Record<string, number[]> = {
    'kite-grade-9': [46], 'triangle-30-60-90-grade-9': [37], 'solids-box-cube-prism-grade-7': [48, 47, 20], 'similar-triangles-grade-8': [43],
  };
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug), Object.keys(scope));
  assert.deepEqual(reviewed.landingDeltas.map(d => d.editionIds), ids.map(id => [id]));
  for (const delta of reviewed.landingDeltas) {
    const pageFile = (beforeLandingCorrections(delta.slug, read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`)) as any);
    const restored = beforeBatch04Copy(delta.slug, pageFile) as any;
    // Batch 8 later appends its own section to some of these pages; compare this batch's state.
    const pageRaw = beforeBatch08Copy(delta.slug, pageFile) as any;
    assert.equal(digest(restored), delta.baselineSha256);
    assert.equal(pageRaw.h1, restored.h1); assert.equal(pageRaw.title, restored.title);
    assert.deepEqual(pageRaw.catalogCta, restored.catalogCta);
    assert.deepEqual(pageRaw.catalogCtas, restored.catalogCtas);
    assert.deepEqual(pageRaw.catalogCtas.map((c: any) => c.catalogTopicId), ctaTopics[delta.slug]);
    assert.deepEqual(Object.keys(pageRaw), Object.keys(restored));
    assert.equal(pageRaw.updatedLine, 'נועם דורון מתמטיקה · עודכן 17.11.2026');
    assert.equal(pageRaw.updatedLinePlacement, 'after-sections');
    assert.ok([...pageRaw.description].length <= 155, delta.slug);
    for (const term of scope[delta.slug]) assert.ok(pageRaw.description.includes(term), `${delta.slug}: ${term}`);
    assert.match(pageRaw.intro, /בדפים שנפתחים עם רמזי אפשר לקבל רמזים; קובצי ה־PDF הנוספים מיועדים להורדה ולהדפסה\.$/);
    assert.match(pageRaw.intro, /נוספו קובצי PDF .*, ברמות א׳, ב׳ ומצוינות\. /);
    const added: any = pageRaw.sections.at(-1);
    assert.deepEqual(added, delta.appendedSection as any);
    // Every earlier section stays exactly as it was (box and cube content included on the shared landing).
    assert.deepEqual(pageRaw.sections.slice(0, -1), restored.sections);
    assert.equal(added.blocks.at(-1).text, 'שלושה קובצי PDF ברמות א׳, ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף.');
    const paragraphs = pageRaw.sections.flatMap((s: any) => s.blocks.filter((b: any) => b.type === 'paragraph').map((b: any) => b.text));
    assert.equal(new Set(paragraphs).size, paragraphs.length, `${delta.slug}: no paragraph repeated verbatim`);
    // TopicPage's setupSelfCheckReveal() hides the second paragraph of a section whose heading
    // looks like a self-check; the new sections are plain copy and must stay fully visible.
    assert.ok(!/בדקו|בדיקה/.test(added.heading) && !/\?$/.test(added.heading)
      && !/^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(added.heading), `${delta.slug}: heading would hide copy behind הצג תשובה`);
    assert.match(added.heading, / — דפי PDF נוספים$/);
    // None of these pages had a PDF series before, so the generic PDF questions are used.
    assert.deepEqual(pageRaw.faq.slice(-2).map((f: any) => f.question), ['מה כוללים קובצי ה־PDF הנוספים?', 'האם קובצי ה־PDF הנוספים כוללים רמזי?']);
    assert.equal(new Set(pageRaw.faq.map((f: any) => f.question)).size, pageRaw.faq.length, `${delta.slug}: unique FAQ questions`);
    for (const text of [pageRaw.description, pageRaw.intro, added.heading, ...added.blocks.map((b: any) => b.text),
      ...pageRaw.faq.slice(-2).flatMap((f: any) => [f.question, f.answer])]) {
      assert.ok(!text.includes('/'), `${delta.slug}: no slash fractions`);
      assert.ok(!text.includes('רמה ג׳'), `${delta.slug}: level names`);
      // Both grade-9 sets are regular-track; none may be described as the reduced track.
      assert.ok(!text.includes('מצומצמת'), `${delta.slug}: track`);
      // The PDFs carry questions and a final-answers page only: no worked solutions, no hints.
      for (const banned of ['פתרון מלא', 'פתרונות מלאים', 'דוגמה פתורה', 'דוגמאות פתורות', 'רמז מנועם', 'נועם AI']) {
        assert.ok(!text.includes(banned), `${delta.slug}: ${banned}`);
      }
      // Grade 8 teaches the AA similarity theorem only; no page here names SAS or SSS similarity.
      for (const banned of ['צ.ז.צ', 'צ.צ.צ']) assert.ok(!text.includes(banned), `${delta.slug}: ${banned}`);
    }
    const page = beforeLandingCorrections(delta.slug, loadTopicPage(delta.slug)), flow = synthesizeBodyFlow(page);
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
  const page = (slug: string) => beforeBatch08Copy(slug, (beforeLandingCorrections(slug, read(`headless/astro-poc/src/data/topic-pages/${slug}.json`)) as any)) as any;
  const text = (slug: string) => page(slug).sections.at(-1).blocks.map((b: any) => b.text).join(' ');
  // The official layout terms are used where the PDFs cover them.
  assert.ok(text('kite-grade-9').includes('תכונות הזוויות בדלתון') && text('kite-grade-9').includes('באלכסון הראשי בדלתון ובשטח דלתון'));
  assert.ok(page('triangle-30-60-90-grade-9').sections.at(-1).heading.startsWith('משולש ישר־זווית שזוויותיו 30°, 60°, 90° והמשפט ההפוך'));
  assert.ok(text('solids-box-cube-prism-grade-7').includes('מנסרה משולשת ישרה') && text('solids-box-cube-prism-grade-7').includes('שטח הפנים'));
  // Kite, questions 1-3: levels a and b are given both head angles and find the side angles;
  // only the excellence level finds the head angles there (review of 0e736a6d).
  assert.ok(text('kite-grade-9').includes('מוצאים זוויות צד, ובמצוינות גם את זוויות הראש,'));
  assert.ok(!JSON.stringify(page('kite-grade-9')).includes('מוצאים את זוויות הצד ואת זוויות הראש'));
  // One spelling inside the prism paragraph (משורטט, משרטטים).
  assert.ok(text('solids-box-cube-prism-grade-7').includes('בסיס משולש שמשורטט במערכת צירים'));
  assert.ok(!JSON.stringify(page('solids-box-cube-prism-grade-7')).includes('מסורטט'));
  // Grade 8: the similarity copy names the AA theorem and nothing else.
  assert.ok(text('similar-triangles-grade-8').includes('דמיון משולשים לפי זוויות (ז.ז)'));
  // The shared grade-7 landing keeps its box and cube sentences and gains a prism sentence.
  const solids = page('solids-box-cube-prism-grade-7');
  assert.ok(solids.intro.startsWith('מזהים מבנה ופריסה, מחשבים נפח ושטח פנים של תיבה, קובייה ומנסרה משולשת. בנושא מנסרה משולשת נוספו קובצי PDF'));
  assert.equal(solids.sections[0].blocks[1].text, 'תיבה 2×3×4: נפח 24. קובייה צלע 3: נפח 27.');
  // triangle-30-60-90-grade-9 had no update line before; it gains the dated line with this series.
  const r30 = reviewed.landingDeltas.find(d => d.slug === 'triangle-30-60-90-grade-9')!;
  assert.equal(r30.fields.find(f => f.path[0] === 'updatedLinePlacement')!.before, 'absent');
  assert.equal(r30.fields.find(f => f.path[0] === 'updatedLine')!.before, null);
});

test('preservation fences reject changed old links, substitutions, reordering, duplicates and unsupported landing claims', () => {
  const topicOf = (cat: any, g: number, t: number) => cat.grades.find((x: any) => x.grade === g).topics.find((x: any) => x.id === t);
  const old = structuredClone(raw);
  topicOf(old, 9, 46).levels[0].pdfId = 'old-link-changed';
  assert.throws(() => beforeBatch04Catalog(old));
  const fourth = structuredClone(raw);
  topicOf(fourth, 8, 43).levels[3].pdfId = 'old-link-changed';
  assert.throws(() => beforeBatch04Catalog(fourth));
  const inserted = structuredClone(raw);
  const r30 = topicOf(inserted, 9, 37);
  r30.editions.unshift({ ...structuredClone(r30.editions[0]), editionId: 'ms-unreviewed-r1' });
  assert.throws(() => beforeBatch04Catalog(inserted));
  const changed = structuredClone(raw);
  topicOf(changed, 7, 48).editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch04Catalog(changed));
  const reordered = structuredClone(raw);
  topicOf(reordered, 8, 43).levels.reverse();
  assert.throws(() => beforeBatch04Catalog(reordered));
  const swapped = structuredClone(raw);
  const [t46, t37] = [46, 37].map(id => topicOf(swapped, 9, id));
  [t46.editions, t37.editions] = [t37.editions, t46.editions];
  assert.throws(() => beforeBatch04Catalog(swapped));
  // The prism edition belongs to topic 7/48 only, not to the other two topics of its landing.
  const moved = structuredClone(raw);
  const [t48, t47] = [48, 47].map(id => topicOf(moved, 7, id));
  t47.editions = t48.editions; t47.defaultEditionId = 'legacy';
  delete t48.editions; delete t48.defaultEditionId;
  assert.throws(() => beforeBatch04Catalog(moved));
  const defaultFlip = structuredClone(raw);
  topicOf(defaultFlip, 9, 46).defaultEditionId = ids[0];
  assert.throws(() => beforeBatch04Catalog(defaultFlip));
  const duplicate = structuredClone(registry);
  duplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch04Registry(duplicate));
  const registryDefault = structuredClone(registry);
  registryDefault.editions.find((e: any) => e.editionId === ids[3]).isDefault = true;
  assert.throws(() => beforeBatch04Registry(registryDefault));
  const page = read('headless/astro-poc/src/data/topic-pages/kite-grade-9.json');
  page.intro += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch04Copy('kite-grade-9', page));
  const section = read('headless/astro-poc/src/data/topic-pages/similar-triangles-grade-8.json');
  section.sections.at(-1).blocks[0].text += ' וגם לפי צ.ז.צ';
  assert.throws(() => beforeBatch04Copy('similar-triangles-grade-8', section));
  const box = read('headless/astro-poc/src/data/topic-pages/solids-box-cube-prism-grade-7.json');
  box.sections[0].blocks[1].text = 'תיבה 2×3×4: נפח 25.';
  assert.throws(() => beforeBatch04Copy('solids-box-cube-prism-grade-7', box));
});
