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
import { beforeProbabilityNineCatalog, beforeProbabilityNineRegistry, beforeProbabilityNineCopy,
  reviewedProbabilityNine as reviewed, probabilityNineIds as ids } from './fixtures/probability-nine-pdf';
import { beforeBatch04Registry } from './fixtures/batch04-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeProbabilityNineCatalog(raw) as ReturnType<typeof loadCatalog>;
// Same SSR normalization as loadCatalog (Wix media CDN) so direct-PDF links compare like for like.
const previousSsr = { ...previous, config: { ...previous.config, pdfBase: 'https://static.wixstatic.com/ugd/d8e7ad_' } };
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeProbabilityNineRegistry(registry);
const receipt = read('docs/probability-nine-pdf-first-20261117.json');
const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');
const SLUG = 'probability-grade-9';

// Pinned independently from the takeover's pdfs.json and its two-route media read-back; the same
// pdfIds and PDF bytes as draft PR #500 (4724dd65), which this branch supersedes.
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261116-prc-01-r1': [
    ['fc3d4dccf1af451bbb9ad46581480ee6', 'a0b6c63f37db8d2f47c86ed14ba2b4498ef52a45f1c9fdeb48784054b39338b2'],
    ['86662699e40146c4b8e1f48c1f6dbfc6', '411cbad93315815e274779239903873ebb3876fd6cd27e548c0558e8691f1604'],
    ['3af3ed8d30b54e41ac7fad49c7d090f6', '153857a5c4c63ea5de77e26f78d055108b56036bb640ac0d37f9415c30b099a2']],
  'ms-20261116-prt-01-r1': [
    ['f8358246328743b29a01dbe0ad7d45bb', 'ef825ffc16f2cbf24d25ff372996be504af6df277b6507cc70eba67b57552521'],
    ['894406739f3c4a87b8e07acb228fec68', 'a49b342f92f31065f70acc87e39143ece9a3a5bd932ac5ca42e8751995c408c4'],
    ['742baf66b75245ef8593c5b50b343cde', '052983455218329ba53c5d39ec927d3a307796a4a8bb4e63a57cca3638d5d0f7']],
  'ms-20261116-prw-01-r1': [
    ['3e1dbd50ab9c40debde8d01b2c93c3cf', '43272f5b49ef2acbef8fa1df646dd2b06e60c33c69c5fa00affc4b360cf6d810'],
    ['07c2a60830574f41aa54d49296e89111', '3be00b17a0865d90c95ba11de6083c6273a3260106cf27044373d38c719bb3d6'],
    ['0daf689cd1014571ab478c659af2b08c', '5efc5fc4e0b907ce36d5176efe7fb188e0fabc86c0e0168f1f4d82eb17f6f38a']],
};
// Astra (Codex gpt-6-astra) receipts, by exact SHA-256; each binds the three PDF hashes above.
const RECEIPTS: Record<string, string> = {
  'ms-20261116-prc-01-r1': '3f7c6f204f414acc967e671460d689dc556f1df274fb916cde8fac0eb1095cd0',
  'ms-20261116-prt-01-r1': 'b8b700cd357a8ca1b3e6c425887ee5bd0d0e49d17a0f8c78ea8df18ddba52530',
  'ms-20261116-prw-01-r1': '49ecbd19c35123afb1ad583b9e79a7d9f44e95dbaac0216993fdd061a2a6faa7',
};

test('three fixed probability editions add nine frozen PDFs and recover the independently pinned 6039c61c baseline', () => {
  // Read from the exact baseline git blobs (headless/astro-poc-baseline after #505, #507 and #509, batch 3), not from the regenerated tree.
  const baselineCatalog = '59a5df29034a43fab667fa8fc45abf81c91bb501e807272eab0c0ab0cdda5a1f';
  const baselineRegistry = 'a34a79f54037fb5b30a647c29badac28ac2e602860545dd9cb5ccd3578c7151e';
  assert.equal(reviewed.baselineCommit, '6039c61cb6b7c606c2aca0a453907a1908503431');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalog);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistry);
  assert.deepEqual(reviewed.supersedesDraft, { pr: 500, head: '4724dd654153858cb3963ea3d6a5041aa6f810b2' });
  assert.equal(digest(previous), baselineCatalog);
  assert.equal(digest(priorRegistry), baselineRegistry);
  assert.deepEqual(ids, ['prc', 'prt', 'prw'].map(key => `ms-20261116-${key}-01-r1`));
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug, a.nativePrefix]),
    [[9, 10, SLUG, 'G9-T60'], [9, 10, SLUG, 'G9-T61'], [9, 10, SLUG, 'G9-T62']]);
  // Topic 9/10 had no edition before; the three series are appended in registry order.
  assert.ok(reviewed.additions.every(a => a.baselineEditionIds.length === 0));
  assert.deepEqual(Object.keys(PINS), ids);
  for (const addition of reviewed.additions) {
    assert.deepEqual(addition.edition.levels.map(l => [l.pdfId, l.pdfSha256]), PINS[addition.editionId]);
    const sheetId = receipt.packages.find((p: any) => p.editionId === addition.editionId).sheetId;
    assert.deepEqual(addition.edition.levels.map(l => l.worksheetId), ['a', 'b', 'c'].map(k => `ms-${sheetId.toLowerCase()}-${k}-r1`));
    assert.match(addition.edition.label, / · PDF$/);
  }
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 9);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 9);
  // Batch 04 (tests/batch04-pdf-intake.test.ts) is appended after the probability series.
  const afterProbabilityNineRegistry = beforeBatch04Registry(registry);
  assert.equal(afterProbabilityNineRegistry.editions.length, 66);
  assert.equal(afterProbabilityNineRegistry.editions.flatMap((e: any) => e.levels).length, 198);
  assert.equal(priorRegistry.editions.length, 63);
  assert.equal(priorRegistry.editions.flatMap((e: any) => e.levels).length, 189);
  assert.deepEqual(afterProbabilityNineRegistry.editions.slice(0, 63), priorRegistry.editions);
  assert.deepEqual(afterProbabilityNineRegistry.editions.slice(63), reviewed.additions.map(a => a.edition));
  assert.deepEqual(registry.editions.slice(0, 66), afterProbabilityNineRegistry.editions);
  // Editions never add base levels; EQM49 (17.11) is the only later base topic (+3 levels).
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 973);
  assert.deepEqual(receipt.scope, { packages: 3, pdfs: 9, pages: 47, subitems: 169, landingRoutes: 1 });
  assert.deepEqual(receipt.packages.map((p: any) => p.editionId), ids);
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.equal(receipt.supersedes.pr, 500);
  assert.equal(receipt.review.allGatesPass, false);
  assert.equal(receipt.review.nativeOrHintsAcceptance, false);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
});

test('all nine additions open their own reviewed PDF directly while the legacy choice remains first', () => {
  const topic = catalog.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 10)!;
  assert.equal(topic.defaultEditionId, 'legacy');
  const back = '/worksheets?grade=9&topic=10';
  const groups = topicWorksheetEditionLinks(catalog, 9, 10, back);
  assert.deepEqual(groups.map(g => g.editionId), ['legacy', ...ids]);
  assert.deepEqual(groups.slice(0, 1), topicWorksheetEditionLinks(previousSsr, 9, 10, back));
  assert.deepEqual(topic.levels.map(l => l.key), ['a', 'b', 'c']);
  for (const [index, addition] of reviewed.additions.entries()) {
    const edition = topic.editions!.find(e => e.editionId === addition.editionId)!;
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.deepEqual(edition.routing, {
      resolvedNoamPrefix: addition.nativePrefix, aiHintShown: false, usesViewer: false,
      viewerPath: 'worksheet-viewer-noam.html',
      siblingPdfQuery: { pa: addition.pdfIds[0], pb: addition.pdfIds[1], pc: addition.pdfIds[2] },
    });
    const group = groups[index + 1];
    assert.deepEqual(group.levels.map(l => [l.key, l.label]), [['a', 'רמה א׳'], ['b', 'רמה ב׳'], ['c', 'מצוינות']]);
    assert.equal(group.note, 'קובצי PDF להדפסה');
    const proof = receipt.packages.find((p: any) => p.editionId === addition.editionId);
    assert.ok(proof, `${addition.editionId}: public frozen evidence`);
    assert.equal(proof.producerPackage, addition.nativePrefix);
    assert.equal(proof.reviewReceiptSha256, RECEIPTS[addition.editionId]);
    assert.equal(proof.reviewVerdict, 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.equal(proof.reviewReceipts[0].sha256, proof.reviewReceiptSha256);
    assert.match(proof.reviewer, /^Astra \(Codex gpt-6-astra\)/);
    for (const [i, level] of edition.levels.entries()) {
      const href = buildWorksheetHref({ catalog, grade: 9, topic, editionId: addition.editionId, levelKey: level.key });
      assert.equal(href, `https://static.wixstatic.com/ugd/d8e7ad_${PINS[addition.editionId][i][0]}.pdf`);
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

test('the nine PDFs cannot enter teacher, learning, viewer or Ramzi banks', () => {
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const id of ids) assert.equal(getTeacherLandingScope({ grade: 9, topic: 10, edition: id }, teacher), null);
  assert.ok(getTeacherLandingScope({ grade: 9, topic: 10 }, teacher));
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  for (const id of reviewed.additions.flatMap(a => a.pdfIds)) assert.ok(!collectViewerPdfIds(catalog).includes(id));
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation), buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
  assert.deepEqual(raw.ramziActivation, (previous as any).ramziActivation);
});

test('the probability landing keeps title, H1 and CTA and describes the three series in synchronized copy and FAQ schema', () => {
  assert.equal(reviewed.landingDeltas.length, 1);
  const [delta] = reviewed.landingDeltas;
  assert.equal(delta.slug, SLUG);
  assert.deepEqual(delta.editionIds, ids);
  const pageRaw = read(`headless/astro-poc/src/data/topic-pages/${SLUG}.json`);
  const restored = beforeProbabilityNineCopy(SLUG, pageRaw) as any;
  assert.equal(digest(restored), delta.baselineSha256);
  assert.equal(delta.baselineSha256, '96b802d9e0a2adbaa1a11f6dac9711ab4a2ffa7b428a67150c69cd8d097bd042');
  assert.equal(pageRaw.h1, restored.h1); assert.equal(pageRaw.title, restored.title);
  assert.deepEqual(pageRaw.catalogCta, restored.catalogCta);
  assert.deepEqual(pageRaw.catalogCtas, restored.catalogCtas);
  assert.deepEqual(Object.keys(pageRaw), Object.keys(restored));
  assert.equal(pageRaw.updatedLine, 'נועם דורון מתמטיקה · עודכן 17.11.2026');
  assert.equal(pageRaw.updatedLinePlacement, 'after-sections');
  assert.ok([...pageRaw.description].length <= 155);
  for (const term of ['חד־שלבי', 'שכיחות יחסית', 'מאורע משלים', 'עם החזרה', 'בלי החזרה']) assert.ok(pageRaw.description.includes(term), term);
  assert.match(pageRaw.intro, /^לומדים לתאר מרחב תוצאות, לחשב הסתברות של מאורע ולבדוק תשובות\. /);
  assert.match(pageRaw.intro, /בדפים שנפתחים עם רמזי אפשר לקבל רמזים; קובצי ה־PDF הנוספים מיועדים להורדה ולהדפסה\.$/);
  const added: any = pageRaw.sections.at(-1);
  assert.deepEqual(added, delta.appendedSection as any);
  assert.deepEqual(pageRaw.sections.slice(0, -1), restored.sections);
  assert.equal(added.blocks.length, 4);
  assert.ok(added.blocks[0].text.startsWith('בסדרה על ניסוי חד־שלבי'));
  assert.ok(added.blocks[1].text.startsWith('בסדרה על ניסוי דו־שלבי עם החזרה'));
  assert.ok(added.blocks[2].text.startsWith('בסדרה על ניסוי דו־שלבי בלי החזרה'));
  assert.equal(added.blocks.at(-1).text, 'לכל סדרה שלושה קובצי PDF ברמות א׳, ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף.');
  // TopicPage's setupSelfCheckReveal() hides the second paragraph of a section whose heading
  // looks like a self-check; the new section is plain copy and must stay fully visible.
  assert.ok(!/בדקו|בדיקה/.test(added.heading) && !/\?$/.test(added.heading)
    && !/^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(added.heading), 'heading would hide copy behind הצג תשובה');
  for (const text of [pageRaw.description, pageRaw.intro, added.heading, ...added.blocks.map((b: any) => b.text),
    ...pageRaw.faq.slice(-2).flatMap((f: any) => [f.question, f.answer])]) {
    assert.ok(!text.includes('/'), 'no slash fractions');
    assert.ok(!text.includes('רמה ג׳'), 'level names');
    for (const banned of ['פתרון מלא', 'פתרונות מלאים', 'דוגמה פתורה', 'דוגמאות פתורות', 'רמז מנועם', 'נועם AI']) {
      assert.ok(!text.includes(banned), banned);
    }
  }
  const page = loadTopicPage(SLUG), flow = synthesizeBodyFlow(page);
  assert.equal(flow.filter(b => b.type === 'heading' && plain(b.text || '') === added.heading).length, 1);
  for (const block of added.blocks) assert.equal(flow.filter(b => b.type === 'paragraph' && plain(b.text || '') === block.text).length, 1);
  const faq = extractJsonLdFaq(page.jsonLd).map(f => ({ question: plain(f.question), answer: plain(f.answer) }));
  assert.deepEqual(faq, pageRaw.faq);
  assert.deepEqual(pageRaw.faqGroups[0].items, pageRaw.faq);
  assert.equal(pageRaw.faq.length, restored.faq.length + 2);
  assert.deepEqual(pageRaw.faq.slice(-2).map((f: any) => f.question), ['מה כוללים קובצי ה־PDF הנוספים?', 'האם קובצי ה־PDF הנוספים כוללים רמזי?']);
  for (const node of (page.jsonLd['@graph'] as any[]).filter((n: any) => ['WebPage', 'LearningResource'].includes(n['@type']))) {
    assert.equal(node.description, page.description);
    assert.equal(node.dateModified, '2026-11-17');
  }
});

test('preservation fences reject changed old links, substitutions, reordering, duplicates and unsupported landing claims', () => {
  const topicOf = (cat: any) => cat.grades.find((x: any) => x.grade === 9).topics.find((x: any) => x.id === 10);
  for (const [name, mutate] of [
    ['changed legacy link', (t: any) => { t.levels[0].pdfId = 'old-link-changed'; }],
    ['wrong PDF', (t: any) => { t.editions[0].levels[0].pdfId = 'wrong'; }],
    ['wrong producer prefix', (t: any) => { t.editions[1].nativePrefix = 'G9-T99'; }],
    ['changed provenance', (t: any) => { t.editions[2].levels[2].sourceSha256 = '0'.repeat(64); }],
    ['unexpected viewer activation', (t: any) => { t.editions[0].routing.usesViewer = true; }],
    ['reordered series', (t: any) => { t.editions.reverse(); }],
    ['duplicate overlay', (t: any) => { t.editions.push(structuredClone(t.editions[0])); }],
    ['missing overlay', (t: any) => { t.editions.pop(); }],
    ['unreviewed insert', (t: any) => { t.editions.unshift({ ...structuredClone(t.editions[0]), editionId: 'ms-unreviewed-r1' }); }],
    ['reordered legacy levels', (t: any) => { t.levels.reverse(); }],
    ['changed default', (t: any) => { t.defaultEditionId = ids[0]; }],
  ] as const) {
    const bad = structuredClone(raw);
    mutate(topicOf(bad));
    assert.throws(() => beforeProbabilityNineCatalog(bad), name);
  }
  const duplicate = structuredClone(registry);
  duplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeProbabilityNineRegistry(duplicate));
  const registryDefault = structuredClone(registry);
  registryDefault.editions.find((e: any) => e.editionId === ids[2]).isDefault = true;
  assert.throws(() => beforeProbabilityNineRegistry(registryDefault));
  const page = read(`headless/astro-poc/src/data/topic-pages/${SLUG}.json`);
  page.intro += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeProbabilityNineCopy(SLUG, page));
  const section = read(`headless/astro-poc/src/data/topic-pages/${SLUG}.json`);
  section.sections.at(-1).blocks[1].text += ' עם דוגמה פתורה';
  assert.throws(() => beforeProbabilityNineCopy(SLUG, section));
});
