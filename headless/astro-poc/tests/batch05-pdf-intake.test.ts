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
import { beforeBatch05Catalog, beforeBatch05Copy, beforeBatch05Registry,
  reviewedBatch05 as reviewed, reviewedBatch05Ids as ids } from './fixtures/batch05-pdf';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch05Catalog(raw) as ReturnType<typeof loadCatalog>;
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
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeBatch05Registry(registry);
const receipt = read('docs/batch05-pdf-first-20261117.json');
const expectedIds = ['dat-01', 'wpm-01', 'fnc-01', 'int-01', 'pct-01', 'pyt-01',
  'dis-01', 'eqd-01', 'par-05', 'pow-02', 'wqp-01'].map(key => `ms-20261117-${key}-r1`);
const mappings: Array<[number, number, string]> = [
  [7, 24, 'data-collection-reading-grade-7'], [7, 41, 'equations-both-sides-word-problems-grade-7'],
  [8, 21, 'function-representations-grade-8'], [8, 61, 'interpolation-extrapolation-grade-8'],
  [8, 7, 'percentage-problems-grade-8'], [8, 11, 'pythagorean-theorem-grade-8'],
  [9, 1, 'distributive-law-grade-9'], [9, 1, 'distributive-law-grade-9'],
  [9, 7, 'parallelogram-grade-9'], [9, 16, 'exponent-rules-grade-9'],
  [9, 18, 'word-problems-grade-9'],
];
const baselineCatalogSha256 = 'e15fc362fb5be246aa818ed0dc61f5767ea6870ac2724070f8166fc114c90d9e';
const baselineRegistrySha256 = '2a7de9e198df120e34a09f36c23ddb98678686623305e27e73372760be6d881d';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261117-dat-01-r1': [
    ['33727d26b4144b479d4d1747021a6748', 'fdf62835b078dd20ae1644da10a63c408275af710d20451f3909eb26348f83ea'],
    ['16327a5ffa004c64a8e30e7464844218', 'd3cddbf99e1b7a1190c098591a023b34f4b87db42de62e6df1a9e6e03f44f252'],
    ['40c7eaf9fe8f41f5a10731918f71a41b', '2639db5fdf4f9f9a729e2e228e883af60df709e7a8bd0705d25b6368284d2d70']],
  'ms-20261117-wpm-01-r1': [
    ['ef42d8c3dfcf4047bc337462b9e4c581', '4f1184579d19a772dbdf16a1a55beee5c56b0f72f7bd46674f8290162379e76e'],
    ['0e3cfcbf03e3436cbc418295df22abee', '224e3c0c93b26d10db6a09821ea06f5bd7db5a92710976874ff48b146bcda821'],
    ['e268ac6cb491411592789892e0e71a7a', '5ec5ad5aa6ee9a5c396c65a53ce2ec9b8db57bb89e794416c1372d6fbfca695e']],
  'ms-20261117-fnc-01-r1': [
    ['e3f8f303adc34e16a148529378f16122', 'fc36863110cb86ec4767daa59621dc1b6f335605a5e7e59acf035f4acf6d8bfa'],
    ['d0ac8a2c97c24d9e8677a585a9834dcb', '4cb62f14efc061bfc391d01adef7b8f8b5a9cc84c2237b144ba73c5a6ffadfb8'],
    ['11658ff1c4e0449a88c7b559bb4170b5', 'bd4b2995b5ef918af24385abce7141b30373e07593637d6aec72f5282ffb8ddd']],
  'ms-20261117-int-01-r1': [
    ['be21a80fa34a4c2ea450778d5e5e877e', '55e712f84418b2bcf2cecb33557c185f8891295c27b4a6cfc9335cbb298bfb23'],
    ['b8aef22e17ac4b6da111c62ca177cd61', '7bc1831a5037db6e4cb16aed08ea9cc80e50f20539352081a7567ddb1a14fe04'],
    ['79ca1ac0534f45d496139fdaf8ba5d6b', 'b948568fd26696a1b372b8d5195ad5758bd01d11a572ed95afa951ee25d544ac']],
  'ms-20261117-pct-01-r1': [
    ['25ac5e70e90641f68cc0ca93530d6b46', 'f00a8f45446982a77278b064b3724b96619b80a53f73e9099a183378f82f4ba7'],
    ['b868caa405744f8bba0cc69fe30689ea', 'c5622e3edc989aef92269470cba7e30990ae7abbc8bccd1eb2c699e26abae11d'],
    ['436166eb0471404782ff94f35f271e00', '726a44bf8825eb5b491f30831d5d3c1f73f75f98dc1927385bd00aa678714c9b']],
  'ms-20261117-pyt-01-r1': [
    ['40df0cb01a9242b08d930b6f99b0c34e', 'e567dbbfdbc80a84b6ceeacd757ea203535d0ad9ef33cfb313122c31f4a61484'],
    ['8601eb6c92d5443cbc282d779364fc12', 'b620690ae52ea4355ef26b3e09200f27b038c09e8da780dfc1aded0dbe4ff328'],
    ['4f59222ee84542d6a8cb624fc773aead', 'ecbd641564d5e497bed516f620466d73919a48fbe6b8d89ed72fc2b98833722f']],
  'ms-20261117-dis-01-r1': [
    ['ee0d4dd0533b40a19e17386af8eb696d', 'afadfcceb2aebc1c6b26745c682de3bcc98d0aa42c8ccd6ab3633b02880792c3'],
    ['14733102c72e4181a70fca521b03de33', '355037762e9367e7f22af5f74a085417ed49c18cb465b47693125e8ae94dbfee'],
    ['fd98c6b97b67462ead004e3ee3e7382b', 'cfb2eaa4548659ebfd6ef606e065dd15f89bfcbcdd3389b2e615f4b392f9ca73']],
  'ms-20261117-eqd-01-r1': [
    ['04049669705e4accba05aacc57da85ac', 'a4c12a8d3aa48ba64cf75afdec8821fee4130c9e1e4b9489243b69d69d48abe3'],
    ['f67c9eadb024400db0a4e1c5f838d7f5', '3b6c524850e2efa4e40414bd4ba0928214fed408edc338bf63785841a4865ec2'],
    ['c2c9ce16e9b54f0d8a84a9f56ed55662', '2367a1e7e5812498ef78b944b96b0a156e956ea18964a64fadfa831383784a7a']],
  'ms-20261117-par-05-r1': [
    ['3cc25c74bd3649199f23d393ab730e23', '67737c262dceea87ca9a1b017ad0ed8937828cf1d4956d7814abf3d61fad3495'],
    ['6c55dbbd84a341268eb31531946e8ba9', 'f03e6f89a562608744b4034b31368592583468e19364fc41fc8fa3b5e73bb1f7'],
    ['150e84e1a72945ac84e63db02f75a858', 'f4bcfa215b7083a32dbaa7f23a6ba9c644e6fa746653c24fb20f393a5e6df07d']],
  'ms-20261117-pow-02-r1': [
    ['91341f0388e140279c8b632040afbc22', 'ed7804764d77c4de954e4dbbc45af3b6ea168bc5ffcc6633a033719a18cc9d54'],
    ['a065c8ee1eb94643b7f09f62b38b1edc', '6e1c6ef8a49413b50f52a5bf66ef3029bdd8bff86cf7b780a1e5ea03298cc318'],
    ['44e647c10a0b44aca8af3fea3d6d1e7a', 'b225afe4f8e49354d6558d01ab1a9921a7bc4e134f8870592db85b9243daf871']],
  'ms-20261117-wqp-01-r1': [
    ['eb6695a5ebce4205a09335873dec58b0', 'be8942a6c199c41225cdf8a216dcaa019282de33489a82eb6ebd6537c10414f1'],
    ['80c58693aaf84ddc967da555f8c2f8b2', '1ee3b6b18c8447dad4c7dfa9f1d0edb19711ea6515bde86a24735397361cc3a8'],
    ['421ed812b2364810983e4fbb3b433a7f', 'd6ba39e50bda88eca806a4cdc26a605efcaef8bf4a2abd1f0bc30714d9264858']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G7-DAT-01': ['81eb21cdc130fe44d3591d9f8faded88af77f95bb6b6e47a46227b7e0f4ec310', '13e4e3c1cb704adc75f2e748d8baf6bd1ad5ec06ded89d82b78451e7037f727a', '5c2321436cc7120af678d836b25c9f0c4a647b339d9e8642158e47ee08db4bf8'],
  'G7-WPM-01': ['266df3172353a88f5d6ebe3b3368d7d8967e91c39a8fab4be5526b064bc34bda', '14d0178ca8423b964a46190dd5735c83d1c619cf9ae9ea2956aae78f634f9797', 'dcb0d3e2bbfc6980e41e9d417bd8814040c2f5562fb3f4386494afcb66243cab'],
  'G8-FNC-01': ['b897d29e6359dd2b7acb4381ddcea61da33ec86992199f15bbef7e8ec40c9849', 'f56d193e18d71738b4146b3414b0c85286ac4a1e64af471853b6f262afc20e57', 'a7c44350fcde876884ea384767de703cda5fdd153120ae9e8fad01f0a7aa8e0d'],
  'G8-INT-01': ['e613e77b3a20a2778e6408764d76102f437076c3ea71037e946a8e89942ee836', '74b8c16cd9e5873c3ae2c7cdbd72ce868d4691c791cf675be476beed9711ff25', 'f0b4491829806395f5b8279310a1ba59a9962d4b2bcec78151bd1a7130bc0700'],
  'G8-PCT-01': ['bed63293e3e02a9ec4789cca891b3ef9e9c52e4841f570490bb680f4f0709a0c', '3b868f72aaf706da41e5bf70dd61b38de56cf5966912e762e62afd2f95215fbb', '259378d45e1e3f05bdc5b97dd07eeab104445795f74f44802db4072ad4172391'],
  'G8-PYT-01': ['7c285d528a1631d08a8dedde6f0d6e75d46e36a85c6b02bdd63ab967cb9a3590', '9eaadb17d2928cb74fb72d62eedd17bcce85ce445a2f5ef85802e0e07d67217b', '7e1e3174d7656c7b9ee685480e1aac2f3403625fedc4b81d8f6deba30aeded34'],
  'G9-DIS-01': ['0915d33c01f7d49a5d4f2b3e108c049b21fc7188dfef265379c64af12729a4ba', 'af146be5ae872fc6ec36c72fbc5e043751aecd66531dbb90df2cf3a0be25c847', 'de829402ded52e48b3defdb4f29f5481c02ca738eb23ce28024d6b51b2ea8548'],
  'G9-EQD-01': ['ccff1ba984ca1c1b33a3cc1ba91a2c1dfff3b07dd6d820f13bb4da08d2edb485', '9af8968114bf86cd451934f651a6fae84cd65924b8babe62e373431cbfe45e80', '987aa3eb3cc44d72f763c36a9f39ad0b60924f78e36753372de7bf9e105a04c1'],
  'G9-PAR-05': ['d0042b39371b0310a3fa633dd93fd0bc0d03852ffe77dafbbaa75440891cb85e', '77b489f35b9b1c2c13918b058e4cb7e30893bc70b0d542fe25b164bfdb2c4779', '85db6971042fa6eeb95871f6355c281e6d02aa75866f7b0ad2dfbe095d7c8587'],
  'G9-POW-02': ['2a4ba9f8cc12bfcee2a5703f1f8ed9543837678c0eaa40dec6a46d8114988d32', 'd1d2b6cbe227c409d2784d84fddf2c418237a1186e12a4eaace0027de960728d', 'b92819a71e5173128a616f4ca329738f3faa765527bc9080b0ed132300c97f56'],
  'G9-WQP-01': ['934f4782ff1187e90ff7251bf98948ee16eb9d39e897667ea625f8e2a1d78810', 'ce331ac8cf8890afefc9f327dd17df350e58477be67f79a3204867e03cff514f', '1c5e9b8aaeec810d75abeb7ac8e6ec259ba8c0fc4170496c67a9c7a6c2b553dc'],
};

test('eleven additive editions recover the pinned 46765664 baseline without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, '46765664bc70feedadf430c0ba82df5829588a0f');
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
  assert.deepEqual(receipt.scope, { packages: 11, pdfs: 33, pages: 231, subitems: 976, landingRoutes: 10 });
  assert.equal(registry.editions.length, priorRegistry.editions.length + 11);
  assert.deepEqual(registry.editions.slice(0, -11), priorRegistry.editions);
  assert.deepEqual(registry.editions.slice(-11), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);
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
    assert.equal(proof.deltaVerdict, 'PASS_DELTA');
    assert.ok(proof.originalReviewer);
    assert.match(proof.deltaReviewer, /Google Antigravity/);
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
      [selectedId, ...oldIds.filter(id => id !== selectedId), ...topicAdditions.map(a => a.editionId)]);
    const oldGroupCount = oldIds.length + 1;
    assert.deepEqual(groups.slice(0, oldGroupCount), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    assert.deepEqual(groups.find(g => g.editionId === addition.editionId)!.levels.map(l => l.key), ['a', 'b', 'c']);
  }
});

test('ten landing routes add only reviewed PDF copy and preserve their complete baseline data', () => {
  assert.equal(reviewed.landingDeltas.length, 10);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch05Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.equal(page.h1, restored.h1);
    assert.equal(page.title, restored.title);
    assert.deepEqual(page.catalogCta, restored.catalogCta);
    assert.deepEqual(page.catalogCtas, restored.catalogCtas);
    assert.deepEqual(page.sections.at(-1), delta.appendedSection);
    const loaded = loadTopicPage(slug)!;
    const sections = loaded.sections.filter(section => section.heading === delta.appendedSection.heading);
    assert.equal(sections.length, 1);
    assert.ok(sections[0].blocks.some(block => /רמה א׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /רמה ב׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /מצוינות/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.every(block => !/רמה ג׳|פתרונות מפורטים|רמזים/.test(block.text ?? '')));
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
      for (const banned of ['פתרון מלא', 'פתרונות מלאים', 'דוגמה פתורה', 'דוגמאות פתורות', 'רמז מנועם']) {
        assert.ok(!text.includes(banned), `${slug}: ${banned}`);
      }
    }
  }
  const reduced = reviewed.additions.filter(a => ['G9-DIS-01', 'G9-EQD-01'].includes(a.sheetId));
  assert.equal(reduced.length, 2);
  assert.ok(reduced.every(a => a.track === 'ט_מצומצמת' && a.edition.label.includes('ט׳ מצומצמת')));
  const enrichment = reviewed.additions.find(a => a.sheetId === 'G9-POW-02')!;
  assert.match(enrichment.edition.label, /העשרה/);
  const powersSlug = enrichment.slug;
  if (!powersSlug) throw new Error('G9-POW-02 landing slug missing');
  const powers = loadTopicPage(powersSlug)!;
  assert.ok(powers.sections.some(section => typeof section.heading === 'string' && /PDF/.test(section.heading)
    && section.blocks.some(block => /העשרה/.test(block.text ?? ''))));
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
  badCatalog.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 24).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch05Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 24)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch05Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch05Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.at(-1).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch05Registry(registryAltered));
  for (const destinationId of [40, 39]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 7);
    const source = grade.topics.find((t: any) => t.id === 41);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.pop();
    assert.equal(misplaced.editionId, 'ms-20261117-wpm-01-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch05Catalog(moved), `WPM-01 must not move from 7/41 to 7/${destinationId}`);
  }
  const page = read('headless/astro-poc/src/data/topic-pages/data-collection-reading-grade-7.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch05Copy('data-collection-reading-grade-7', page));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
