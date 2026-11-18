import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';
import { loadTopicPage, extractJsonLdFaq, synthesizeBodyFlow } from '../src/lib/topicPages';
import { beforeBatch06Catalog, beforeBatch06Copy, beforeBatch06Registry,
  reviewedBatch06 as reviewed, reviewedBatch06Ids as ids } from './fixtures/batch06-pdf';
import { createRequire } from 'node:module';
import { beforeBatch07Copy, beforeBatch07Registry } from './fixtures/batch07-pdf';
import { reviewedBatch10 } from './fixtures/batch10-pdf';
import { reviewedBatch11 } from './fixtures/batch11-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch06Catalog(raw) as ReturnType<typeof loadCatalog>;
const previousSsr: any = structuredClone(catalog);
for (const addition of reviewed.additions) {
  const topic = previousSsr.grades.find((g: any) => g.grade === addition.grade)
    .topics.find((t: any) => t.id === addition.topicId);
  topic.editions = topic.editions?.filter((e: any) => !ids.includes(e.editionId));
  if (!topic.editions?.length) {
    delete topic.editions;
    delete topic.defaultEditionId;
  }
}
// Batch 10 (18.11) adds a later edition on topic 9/5 (G9-QSH-01, after G9-QVL-01); batch 11 one on 9/6 (G9-QFR-01).
for (const addition of [...reviewedBatch10.additions, ...reviewedBatch11.additions]) {
  const topic = previousSsr.grades.find((g: any) => g.grade === addition.grade)
    .topics.find((t: any) => t.id === addition.topicId);
  topic.editions = topic.editions?.filter((e: any) => e.editionId !== addition.editionId);
  if (!topic.editions?.length) {
    delete topic.editions;
    delete topic.defaultEditionId;
  }
}
const registry = read('headless/catalog/worksheet-editions.v1.json');
const batch06Registry = beforeBatch07Registry(registry);
const priorRegistry = beforeBatch06Registry(registry);
const receipt = read('docs/batch06-pdf-first-20261117.json');
const expectedIds = ['alg-02', 'alg-04', 'crd-01', 'ine-01', 'fpr-01', 'fsh-01',
  'grd-01', 'pbm-01', 'qfm-01', 'qvl-01', 'smm-01'].map(key => `ms-20261117-${key}-r1`);
const mappings: Array<[number, number, string]> = [
  [7, 29, 'combining-like-terms-grade-7'], [7, 29, 'combining-like-terms-grade-7'],
  [7, 9, 'coordinate-plane-four-quadrants-grade-7'], [8, 52, 'inequalities-grade-8'],
  [9, 12, 'precalculus-functions-graphs-grade-9'], [9, 12, 'precalculus-functions-graphs-grade-9'],
  [9, 36, 'reading-graphs-grade-9'], [9, 10, 'probability-grade-9'],
  [9, 6, 'quadratic-equations-grade-9'], [9, 5, 'quadratic-function-grade-9'],
  [9, 40, 'triangle-similarity-aa-grade-9'],
];
const baselineCatalogSha256 = 'cd0cb98fd2ed0539ad2f337a4b655f6e0e8e62be7874e3e5512ed9b46b5a9195';
const baselineRegistrySha256 = '56e634d84fca3f7ac168ad710b1f499608fed68bec711b33b003ee65d10168f4';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261117-alg-02-r1': [
    ['319c5231e7934fa9b025150f23c373b0', '6ef29e63964fdca04e90f3fd72c97ee3f532ecec14f0240c2e8c644e5d8e1786'],
    ['86e1d6f0c0fd46e98e7338617d68e7b1', 'f37e7bcfa73d9d10bd27cf3b20faaee2fa08dd8d708bba4a197e4c86bb535569'],
    ['c9038f10d45b49b4b6bb4fe3465f0a52', '341f100054527c94b9e8f853ac11b575a02fe8b2b42cf79f21f7a4548875fa48']],
  'ms-20261117-alg-04-r1': [
    ['ad7e74e374e64f9a8ce3c2e324246cec', '8bf85637db62d64004c1fc1540bff03936e6e878b92245f0d11b81014913c461'],
    ['5cc5e48809ab464fb6f18c00815b322a', '1ed1a7a8efb3405b4f80c1fb9ea8ea5207bf67e15d3ff92317cd226b25e2507b'],
    ['7fbc776112514266baabbd208a35a9bc', 'd424c3e7cc04521978f8cb6abc5cd719a6371288ca1da8c047bc00da1d5f267a']],
  'ms-20261117-crd-01-r1': [
    ['b5d0cd4f1bba4f40b2460025c87649df', 'cb5306dcd465f6d24bf4195d550c3fc375fafb1bf2b391a76ea633280fe2b0be'],
    ['5515f70f1f724488923aae8e2c0940f0', '1be1b3c43d3469ec32e858d4cfc0a073bf26cd0d039ff9f3de42dccde1475108'],
    ['16f6f1731e154dfa87c0b330004190ac', '5e4eb21d45d328fe9a4a011171507495a814f5f2ac6fe5b34a6e8617e8b5e423']],
  'ms-20261117-ine-01-r1': [
    ['cb7a38ef2d2d494ca0bdf66e1ccb553b', '6505aae6701ae59e2a034c9dbfd10ca2ff9f41a86afa2db772bdeeaa19eeed0d'],
    ['a9ba7290085f465886db52ab7275d4d7', 'a4d15d45878a29124379f81bcffe99a680fccdf0f1c332bccac37b34510eb8ad'],
    ['2452329a2569498e84ad314abde23ded', 'a2bdebf5a44103f90420965ec48a24bfd9722c6d942a3e3c91320b7f967658a4']],
  'ms-20261117-fpr-01-r1': [
    ['4ec2d0fc517b4e02a084dcf0fec826d6', '9ef54b029ede051a5c3af400c4f34ac5a514a431934993b62e931453bddef091'],
    ['e08f4dadf35a4106965429c87b48d47a', 'ef14bb4fb7b6d7fa497d5744ac25b2e23d8aa46edf5b878ee380533a101ce045'],
    ['574ba05d059a429e8037b951c7999b1b', 'a82d0ad76335adcfcfe0f5ebb157deb0fa6765bacfbab4eb8507fc76019ebacb']],
  'ms-20261117-fsh-01-r1': [
    ['b0dcc3089dc246ef95cd9eae149f6715', 'a98232310474fbd50db64043950ceb6474578ae55a2cdc12ee962b91b93a110d'],
    ['98b790911c1f4797af701b6eff8fef1d', '670f581ebb7a8b549508f2ed3e4c52ff81b8f59cb903f3f25b802fad9423efd1'],
    ['eaec8f2655ee4e0b939da7db4ffa24a1', '5bf17a2f77d07f91a7b6534feb9ca6163802f2af5082242d22c1decb3c07eab4']],
  'ms-20261117-grd-01-r1': [
    ['21ac94bcaf98499cb1c192a8ad2416f8', '6b081daf76e59e4cd638e5db7979193fdec888f93add0933ab05352308295806'],
    ['a851d59d7f4f4f36be6f3cd175007e77', '8a753ce9f12377e05af22fba91367f1eea5ac26d01c3e8cb78c5646c64f8611f'],
    ['2cc74a5904b940e0ba9a83e786fa8a79', 'cf77ca6506c38ac5861a04de604e0361b83d46324591644ae4ad79730af41113']],
  'ms-20261117-pbm-01-r1': [
    ['c834ab4638b84375ac5545359e97e7b4', 'ce95f7fe95dd021c245829d3e0264ca764527eb627d222accb50143db1226bec'],
    ['2a2b25b20e5b41bfa500c2c0cc8e4c32', '700104e21e69197e036e48dcc4621fa00aa09a3122fafc2b3b98ea2fe6ae0440'],
    ['4ddf1fe5d627446495c8de4df39dc0e5', '8ac9e78d9771576b83ffd21fad141675e4976acedb8afcb1f3a7cc00b80346f3']],
  'ms-20261117-qfm-01-r1': [
    ['e0202eeef7fc4a8ca70f389ad7600526', 'acfbad95c50907726daa372b0136ec02b4b4670714ba07e3aed777ad10778f6b'],
    ['a26c512b7d3e4fbd8106fdcadbb34b67', '04b06beecbc0a65f7f2e7cd3b0b68a50ff7eba907d30778cdf81fbf73cbc578b'],
    ['0a4a1329a3854deca1ea69bc83e825fc', 'c6a50f61463487b0ba00fc5d4bf8f1fe67a7a8b83fac7017c82af7300d9b8660']],
  'ms-20261117-qvl-01-r1': [
    ['58827e72995b40858899d498dfdcad43', '9e4153e70fa1897e47d9977e64f0a604119d86aea961f67edb9ab7039aa6b5a1'],
    ['b50ec3a847e3450b8334c972182e0204', 'ac9cdd0801e8b9aa310aeb9cd18b7c06ff8a4a153c5db072c13010f12a750784'],
    ['3edfc4d4b1b84f5fbe8e5d9fbd9171c0', 'f45edfb3c2a8aa0f5c1aa02cb00400e1653462ed6e0c6507c23b86186977bb31']],
  'ms-20261117-smm-01-r1': [
    ['6ee45ad9771a46e49841fbf312cf9dd5', '544dc0fd90c343b4e07e57b97f543bc18b3e5beba1be1fa970f5bdca9dd8fc36'],
    ['291828fdd1584690a912586c9c08c8fc', '876c454e90707196438f3e78511837564e916cf98fccea3b3ba75fe15eba50df'],
    ['31ce1cff833245b48a1ce3480688c8c6', '47adf5db2dc223243be950432eae446897f867c9415db0ae9d6ef6e4874f303e']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G7-ALG-02': ['8955035674f8adeb5aec92c48be0e262bd19aebec7f899aaad7b7c4210bcc2bf', '3ac6e3fe63a1e7e8351f7c754786b6bae9175ebd6311cecde0ea848b7b0c29cc'],
  'G7-ALG-04': ['b81237158a32d12b7d8084dda6dbce74431caf1ae72c23afe5ef4944fc48a373', 'a31e5b9187bf8d27f5f123482aba95c93394edced335d430b7fc580eca32c13e'],
  'G7-CRD-01': ['f11f5089040501818928e11e520eae56037ad11f0a6e2190b0b99a75145c647b', 'd1a47891d48f07a466c39227a1d99351be5adcb4eda4b446eac6d3fb28d2507f'],
  'G8-INE-01': ['04502802b2d0e13ef96d2c6b1d957ef7bc2c9d4378e0fe35f4e5262c53c2e180', '85beab06674d61a0eb4d23ac102300dd3e605681aa091741a34a8292b0943200'],
  'G9-FPR-01': ['c752e62a44d1b40a73f31f5ccf23941096de9664eca44fd78ff7fe7ef799ef21', '88bf09aab4bc14f33249459c4dbb686e0abcc87cf9995e37972187d578b1715c'],
  'G9-FSH-01': ['1d4ed123de3db6a10116ed1c515914c70f29ae5571880be24ca916ded13884c1', '8c3c7833e929c43a6f28d30862c0abefa5fa810ff18e5f42edb3bc1a4c0fa8d3'],
  'G9-GRD-01': ['4ae77df7ede7a3c15ea8aa02daa9b7b62b72f797dc5f33d5425d3ec70b3f3709', '66d09b6c8578b3320c9e14e1261037df4aafb00a7877888fd3d3284bc11b6425'],
  'G9-PBM-01': ['9a5596764d0e04d9a0071e43fd125f9de9e177d91ece3da3aa5a4c420cf8dbb7'],
  'G9-QFM-01': ['67c59548c5846fabc4063f3c53b349e1b1972863d538587629ab5cde5f98e683'],
  'G9-QVL-01': ['a081d7d6cdaa25ff76ff522781ce70fa1583bbc3021201f7dcf95f79cae54051', 'fab077a72d2b4117600ac73b7dea472f1bc5c28e49998f64ff2f7f79f69820bb'],
  'G9-SMM-01': ['bdd39d220be4171678b19e9828582a30c451f0c1283d67b72bf02dd6a2de5af1', 'd57c56734ec988ca4cc73dfe7f4e4585b5ce41c9cdd99e813f151ecc07756ed3'],
};

test('eleven additive editions recover the pinned baseline after batch 5 (4db6f5e3) without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, '4db6f5e3af9401629c5ecd47cd4cb096ae5fbece');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalogSha256);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistrySha256);
  assert.equal(digest(previous), baselineCatalogSha256);
  assert.equal(digest(priorRegistry), baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.deepEqual(Object.keys(PINS), ids);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 33);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 33);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages:  11, pdfs:  33, pages:  241, subitems:  880, landingRoutes:  9 });
  assert.equal(batch06Registry.editions.length, priorRegistry.editions.length + 11);
  assert.deepEqual(batch06Registry.editions.slice(0, -11), priorRegistry.editions);
  assert.deepEqual(batch06Registry.editions.slice(-11), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991); // NEW4 (18.11): four later base topics, +12 levels; batch 10 topic 9/53, +3
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);

  for (const [index, addition] of reviewed.additions.entries()) {
    const topic = catalog.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const oldTopic = previous.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === addition.editionId)!;
    assert.equal(topic.defaultEditionId ?? 'legacy', oldTopic.defaultEditionId ?? 'legacy',
      `${addition.editionId}: prior default remains`);
    assert.deepEqual(topic.levels, oldTopic.levels, `${addition.editionId}: original levels remain`);
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.equal(edition.status, 'published');
    assert.equal(edition.routing.resolvedNoamPrefix, addition.nativePrefix);
    assert.equal(addition.edition.isDefault, false);
    assert.deepEqual(addition.edition.levels.map(l => [l.pdfId, l.pdfSha256]), PINS[addition.editionId]);
    assert.deepEqual(edition.levels.map(l => [l.key, l.viewerLevel]), [['a', 'A'], ['b', 'B'], ['c', 'E']]);
    assert.deepEqual(edition.levels.map(l => l.worksheetId),
      ['a', 'b', 'c'].map(key => `ms-${addition.sheetId.toLowerCase()}-${key}-r1`));
    assert.equal(new Set(edition.levels.map(l => l.pdfId)).size, 3);
    assert.ok(edition.levels.every(l => !Object.hasOwn(l, 'ramzi')));
    const proof = receipt.packages[index];
    assert.equal(proof.sheetId, addition.sheetId);
    assert.equal(proof.editionId, addition.editionId);
    assert.equal(proof.isDefault, false);
    assert.equal(proof.reviewVerdict, 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.equal(proof.author, 'Claude (Anthropic)');
    assert.match(proof.originalReviewer, /Google Antigravity/);
    assert.ok(proof.reviewReceipts.every((r: any) => new RegExp(`^reports/ANTIGRAVITY-(INDEPENDENT|DELTA)-${proof.sheetId}-2026111[67]/review\\.json$`).test(r.path)));
    assert.match(proof.reviewReceipts[0].role, /^original independent review \(Google Antigravity; verdict /);
    assert.match(proof.reviewReceipts.at(-1).role, /verdict PASS_STUDENT_PDF_ESSENTIALS\)$/);
    assert.deepEqual(proof.reviewReceipts.map((r: any) => r.sha256), RECEIPT_SHA256S[proof.sheetId]);
    assert.deepEqual(proof.levels.map((l: any) => [l.key, l.pdfId, l.pdfSha256]),
      addition.edition.levels.map(l => [l.key, l.pdfId, l.pdfSha256]));
    for (const level of edition.levels) {
      const downloads = proof.levels.find((p: any) => p.key === level.key).downloadChecks;
      assert.equal(downloads.length, 2);
      assert.ok(downloads.every((d: any) => d.status === 200 && d.matchesFrozenPdf && d.sha256 === level.pdfSha256));
      assert.equal(buildWorksheetHref({ catalog, grade: addition.grade, topic, editionId: addition.editionId, levelKey: level.key }),
        `${catalog.config.pdfBase}${level.pdfId}.pdf`);
    }
    const back = `/worksheets?grade=${addition.grade}&topic=${addition.topicId}`;
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, back);
    const oldIds = addition.baselineEditionIds;
    const selectedId = oldTopic.defaultEditionId ?? 'legacy';
    const topicAdditions = reviewed.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId);
    assert.deepEqual(groups.map(g => g.editionId),
      [selectedId, ...oldIds.filter(id => id !== selectedId), ...topicAdditions.map(a => a.editionId),
        ...reviewedBatch10.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId),
        ...reviewedBatch11.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId)]);
    const oldGroupCount = oldIds.length + 1;
    assert.deepEqual(groups.slice(0, oldGroupCount), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    assert.deepEqual(groups.find(g => g.editionId === addition.editionId)!.levels.map(l => l.key), ['a', 'b', 'c']);
  }
});

test('nine landing routes add only reviewed PDF copy and preserve their complete batch 5 data', () => {
  assert.equal(reviewed.landingDeltas.length, 9);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch06Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.equal(page.h1, restored.h1);
    assert.equal(page.title, restored.title);
    assert.deepEqual(page.catalogCta, restored.catalogCta);
    assert.deepEqual(page.catalogCtas, restored.catalogCtas);
    // Later batches may append their own section after this one (batch 10 on quadratic-function-grade-9).
    assert.deepEqual((beforeBatch07Copy(slug, page) as any).sections.at(-1), delta.appendedSection);
    const loaded = loadTopicPage(slug)!;
    const sections = loaded.sections.filter(section => section.heading === delta.appendedSection.heading);
    assert.equal(sections.length, 1);
    assert.ok(sections[0].blocks.some(block => /רמה א׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /רמה ב׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /מצוינות/.test(block.text ?? '')));
    const hintScope = 'בדפים הקודמים שנפתחים עם רמזי אפשר לקבל רמזים';
    assert.ok(sections[0].blocks.every(block => !/רמה ג׳|פתרונות מפורטים|רמז/.test((block.text ?? '').replace(hintScope, ''))));
    assert.ok(!/בדקו|בדיקה/.test(delta.appendedSection.heading) && !/\?$/.test(delta.appendedSection.heading)
      && !/^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(delta.appendedSection.heading), `${slug}: heading stays visible`);
    const flow = synthesizeBodyFlow(loaded);
    assert.equal(flow.filter(block => block.type === 'heading' && block.text?.replace(/[⁦-⁩]/g, '') === delta.appendedSection.heading).length, 1);
    for (const block of delta.appendedSection.blocks) {
      assert.equal(flow.filter(item => item.type === 'paragraph' && item.text?.replace(/[⁦-⁩]/g, '') === block.text).length, 1);
    }
    const faq = extractJsonLdFaq(loaded.jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    assert.deepEqual(faq, page.faq);
    for (const text of [page.description, page.intro, delta.appendedSection.heading,
      ...delta.appendedSection.blocks.map(block => block.text), ...page.faq.slice(-2).flatMap((f: any) => [f.question, f.answer])]) {
      assert.ok(!text.includes('/'), `${slug}: no slash fraction`);
      assert.ok(!text.includes('רמה ג׳'), `${slug}: no level ג׳`);
    }
    for (const text of [delta.appendedSection.heading, ...delta.appendedSection.blocks.map(block => block.text)]) {
      for (const banned of ['פתרון מלא', 'פתרונות מלאים', 'דוגמה פתורה', 'דוגמאות פתורות', 'רמז מנועם', 'נועם AI']) {
        assert.ok(!text.includes(banned), `${slug}: ${banned}`);
      }
    }
  }
  const reduced = reviewed.additions.filter(a =>
    ['G9-GRD-01', 'G9-PBM-01', 'G9-QFM-01', 'G9-QVL-01', 'G9-SMM-01'].includes(a.sheetId));
  assert.equal(reduced.length, 5);
  assert.ok(reduced.every(a => a.track === 'ט_מצומצמת' && a.edition.label.includes('ט׳ מצומצמת')));
  for (const addition of reduced) {
    const page = loadTopicPage(addition.slug)!;
    const section = page.sections.find(item => item.heading === reviewed.landingDeltas.find(d => d.slug === addition.slug)!.appendedSection.heading)!;
    assert.match(section.heading ?? '', /ט׳ מצומצמת/, `${addition.sheetId}: reduced-track section is labelled`);
  }
  assert.ok(reviewed.additions.every(a => !/העשרה/.test(a.edition.label)));
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
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation),
    buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
  assert.deepEqual(raw.ramziActivation, (previous as any).ramziActivation);
});

test('preservation fences reject catalog, registry and landing substitutions and misplaced shared-topic editions', () => {
  const badCatalog = structuredClone(raw);
  badCatalog.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 9).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch06Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 9)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch06Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch06Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.find((e: any) => e.editionId === ids.at(-1)).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch06Registry(registryAltered));
  for (const destinationId of [8, 10]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 7);
    const source = grade.topics.find((t: any) => t.id === 9);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.pop();
    assert.equal(misplaced.editionId, 'ms-20261117-crd-01-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch06Catalog(moved), `CRD-01 must not move from 7/9 to 7/${destinationId}`);
  }
  const page = read('headless/astro-poc/src/data/topic-pages/coordinate-plane-four-quadrants-grade-7.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch06Copy('coordinate-plane-four-quadrants-grade-7', page));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
