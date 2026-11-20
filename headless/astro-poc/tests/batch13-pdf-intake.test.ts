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
import { beforeBatch13Catalog, beforeBatch13Copy, beforeBatch13Registry,
  reviewedBatch13 as reviewed, reviewedBatch13Ids as ids } from './fixtures/batch13-pdf';
import { beforeBatch12Catalog } from './fixtures/batch12-pdf';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
// Batch 13 is newer than the additional reviewed Ramzi activation (19.11): its baseline keeps that activation.
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch13Catalog(raw) as ReturnType<typeof loadCatalog>;
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
const priorRegistry = beforeBatch13Registry(registry);
const receipt = read('docs/batch13-pdf-first-20261119.json');
const expectedIds = ["ms-20261119-prp-01-r1", "ms-20261119-pch-01-r1", "ms-20261119-spc-01-r1", "ms-20261119-g8-sqr-01-r1", "ms-20261119-fcn-01-r1", "ms-20261119-fnt-01-r1", "ms-20261119-roc-01-r1", "ms-20261119-slo-01-r1", "ms-20261119-axi-01-r1", "ms-20261119-eql-01-r1"];
const mappings: Array<[number, number, string]> = [
  [8, 6, 'percent-representations-grade-8'],
  [8, 8, 'percent-change-grade-8'],
  [8, 9, 'successive-percent-changes-grade-8'],
  [8, 10, 'square-root-grade-8'],
  [8, 19, 'function-concept-grade-8'],
  [8, 20, 'function-notation-grade-8'],
  [8, 27, 'rate-of-change-grade-8'],
  [8, 28, 'slope-line-through-origin-grade-8'],
  [8, 30, 'axis-intercepts-grade-8'],
  [8, 31, 'equation-of-a-line-grade-8'],
];
const baselineCatalogSha256 = '38a2752b896ffaf0ca23c2aede4dce4b9d95dba87f0ce58b110d629eb6a2b118';
const baselineRegistrySha256 = '1854e7162ece63b7e8a67ab3fc9f1229e321f9a8ccd71179cfbdd77b53a505ef';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261119-prp-01-r1': [
    ['1e28316f67af410d998cc45597fa7db7', 'd889ecfe852c4c2a7e3be1a0809b6093cc0efdb15e49f8bca718efbda7a2fdaa'],
    ['cc8bd95bc004435b88c227280b25fac1', 'b8ef3b7e7344c26acaa5221168d53f1482579364b47db4c69a31d0e11c171925'],
    ['dbc84ab5251c4b9f8e75493f664f7e9d', '6de5da34c4e57d9426c6afa9cc147e25fd1ab371094969512542202c541dbebd']],
  'ms-20261119-pch-01-r1': [
    ['8f43dd5c101f426d9ed4feb998af1b0c', 'd76b0bd34b91ce58c888ad9157bda979099de9e58248733ee340c86b54f21e17'],
    ['d1de7b88fec54888a6a9ed437cde2e04', '94292de5894eceac6e182bdb7597a7dbbce7f4d248f2d3b74a36009566842bb7'],
    ['7151a0cbf8324f148aca828bd7a39d72', '782eb8e7fd73fdf273c270ecc62e9c04fdf87b50749b7d40fd3656de7444c9b7']],
  'ms-20261119-spc-01-r1': [
    ['4c8e26d4b4ba4e1e8b0130b463949cb9', 'c5c9cbcd8a55f892477557ec4138a608720de6773181fa07b10afeb2a0e59614'],
    ['258b984315d646b8a8b124148d0bb339', '8a5ef195c7a88bbd7e65d0c2301f32b85030c81683984af9bcd3296d92d66fd8'],
    ['f3bbc77cd34542949eb6dedea60dc41e', '7c76f8617129f115668979367b1e744947433226f2f457a25206426eed2800d9']],
  'ms-20261119-g8-sqr-01-r1': [
    ['5d5734b7529b4e2189919c59e6db7fa3', '996fd42594cca6b0d541a649fd93cb46828438c7c8ce4c369886e288dc1dabae'],
    ['471888d922744ae28c27430977f56ca3', 'a5fadf4673ceadc9da68750b8a0baa87a0bc4cd40c4214e8ae36a6032c4aa860'],
    ['3ea6f3dc9fc341f68c73a66d15998195', '6e6af201bc43eefbdf2c9d7f74465adeff0142eccef753598be2b60ae5da8fca']],
  'ms-20261119-fcn-01-r1': [
    ['9d5f7c0bb9304c058786dfd028703bdc', '206112c00ccbc5a4065d270027dec26da7f954faefba0dfea07da13ea47ea055'],
    ['1f9ada791ad84cac9647921e03314f56', 'b7194e69392e26b5cbbb1ad98f92c65f41f64fb2ee51a2cfe30ee9d55df72049'],
    ['1d08e6ab67f84475b75b165d6b001098', '303a6f0fe4779cf508ab2201898f2a20cee737d2a2af7d8d41b92a680a7a3e5a']],
  'ms-20261119-fnt-01-r1': [
    ['ee71facd8acc4906870339ad17786217', 'd196d21b3bbb99ba4718cb371771ef27c7079e40016fd732ff7121d9d8e1919f'],
    ['d39496f7752440e9b58ddb3465e3db2d', 'a65b55eb41005b897c7d2a660856dc415a61cf1127a8724fa6769842f5df8459'],
    ['151f734aa99443b9964a25079cebd3de', '2cc065831248f0ef089f651e35fb4ab54d7efab0c5972311c3f5273151d5d6f0']],
  'ms-20261119-roc-01-r1': [
    ['ad5170003410480b98489ff7967a3f92', '1a12e3cb37e5da10163891ba81b18c7926fad94f44df537bbe6b266452976eb1'],
    ['9b597d180a3745bbb929cdfba06c4557', '37f3829035f4188596dd7786e3b4463ce414009497d8ed00e09790ac365b0ff6'],
    ['314fb7586ab34ae6a3923279434104cd', '9366f221748a874f8683931180e100b9ca86bdfc2d23b2b5ae1f8439e85eb1de']],
  'ms-20261119-slo-01-r1': [
    ['a4530cc5013a48ddace0448e2006bc15', '337ee2a7367cdbb6df608f5f98f8dc06db8ca1b8449d050dc1e349cb186841f4'],
    ['6290d714f59943bfbfa4bb66afe7d110', '891fa72acd0df86b170706dc8038c07a58b6b189aa34f6cefb3353869a6dfd49'],
    ['c36c8fd8c3a64b958dd217f25b3854d0', 'd704bfd444e9bb1fa7384d5a9354d942e2cc8cf1930475b8ade9dc9ae26b48db']],
  'ms-20261119-axi-01-r1': [
    ['ab6f44cc731940abb0f0923c8cb08c06', 'b15af3efca685918302dca71908d86428b96c23f1223b10aa9f5597270cbe53d'],
    ['fe812d051f10433ca01889d1cafda4f8', 'ac50fe0fb79e58a70f8297397e3d670ef27b5e4b57592161797c31ba5d067b91'],
    ['8fe99f247e854e3cab2ba3c5c5590695', 'bd2353480c3d886c50135eba540c5ce34a19a9fbc2f0c729c565f4bad197b066']],
  'ms-20261119-eql-01-r1': [
    ['214dac653b9745b38483d1fdeb35c7ac', '789e2eb9f6a76dded77c0399baab15b8120779992814161cc986dd7d0be2eae8'],
    ['3eefe9bcc1184374bee5a62ce6c80c3d', 'ae30c1d23df9da04cac9f5729c7c0ee63497d33434216a82a5ecf39978e591ff'],
    ['b0ebca48fe3943f4bf717d3973317657', 'a9a8aee06071a44e673b85fa2c593bb7e8bcd29833e1a34a664d5588d61eae08']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G8-PRP-01': ['39b30f4d05131007965c30c0e0c7f94cf7073a5e7985b4f412f36ef6f879789b', 'ac3f7ae8094ee18fc86f344f04767f250bf340d9383a5034d49d8551b8713b64'],
  'G8-PCH-01': ['26803e31992fbd3ab1dd88fb905fed8c4c3b43a7b329e8633a189f376b38d96b', '589950a084c3c980d1f89258cbbb7959def522e2aac5b21754cc4247672d5797'],
  'G8-SPC-01': ['3ee8afc97f7c0457ddc904e0ed59ea2a99f7b235f53253c118184d8e433da3a7', '77a9305c92d0891d30a1086557bc3bed1156e7a8dde8281651dcaa9c6e7e4f31'],
  'G8-SQR-01': ['2bd0c83f950cb0e62e2ea2d0fa92df79caa149d7cfced3829ebe27ef5438aa18', 'ce35dd47326103c813f1c3cf8edd358d9347b1df6ee5859d2856ef7d0290c100'],
  'G8-FCN-01': ['82f26d81f3a6d3902c030e61f0453e68501ae8458ceed68a47db8956dda409b4', 'bb6908b998e5b2edd53c4a428c3b6a2871a05c6bcc045f361ea82290cc1e9c3f'],
  'G8-FNT-01': ['6b589e343369896331d8bb4582f05ddd3bd20adff8286dddd731d41db1bf84cd', '454291f335c59fa132fba486dde9705b29f0a13bbdb83d7f5c3abf725e95a437'],
  'G8-ROC-01': ['b7743593b66ef2850019868faf210c8fa3b6f14cb89e622bd078d97a17be9568', 'ed72c799650c78bb2e1b17aea931b869d34b169ad102acb7179f08e4ab5caa25'],
  'G8-SLO-01': ['f9daded988486b009a76df05cbff0d23ca40e6a56baf4cffbab80022fc6754f1', 'd617f67018bde9cd7f5d31647bbd0155803dfc31730be46d74985b0d8253e75a'],
  'G8-AXI-01': ['d88e26bcf2de2325ceca1976f36999007e6d1df75611594b51312ece0b129a0b', '69dc3f52b58da701740ff37ce3322d5a53cd85de8462130877ad9711ffd43cc3'],
  'G8-EQL-01': ['6b22eba51b1129fc401b32495c8bca02dee5a3ce3ecb51f4cde9e7bc18a9e4f8', '26e2120278da2d01d5c45e62d08dc92dd9ef1b860bc85414493834fc9de4c819'],
};
const NOTE = 'שלושה קובצי PDF להורדה ולהדפסה: רמה א׳, רמה ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף; בדפים הקודמים שנפתחים עם רמזי אפשר לקבל רמזים.';

test('ten additive editions recover the pinned baseline after the games keyboard merge (6154334f) without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, '6154334fa6dfce9fe2e6feaf0aba9c48520d8230');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalogSha256);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistrySha256);
  assert.equal(digest(previous), baselineCatalogSha256);
  assert.equal(digest(priorRegistry), baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.deepEqual(Object.keys(PINS), ids);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 30);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 30);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages: 10, pdfs: 30, pages: 264, landingRoutes: 10 });
  assert.deepEqual(receipt.editions, reviewed.additions.map(a => a.edition));
  assert.deepEqual(receipt.landingDeltas, reviewed.landingDeltas);
  assert.equal(receipt.mediaReadback.sha256, reviewed.mediaReadbackSha256);
  assert.equal(receipt.mediaReadback.reads, 60);
  assert.equal(registry.editions.length, priorRegistry.editions.length + 10);
  assert.deepEqual(registry.editions.slice(0, -10), priorRegistry.editions);
  assert.deepEqual(registry.editions.slice(-10), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991); // batch 13 adds no base topic
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991);

  for (const [index, addition] of reviewed.additions.entries()) {
    const topic = catalog.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const oldTopic = previous.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === addition.editionId)!;
    // Every page of this batch had only its old worksheets: this is its first PDF edition.
    assert.deepEqual(addition.baselineEditionIds, [], `${addition.editionId}: first edition of the topic`);
    assert.equal(oldTopic.editions, undefined, `${addition.editionId}: no earlier edition`);
    assert.ok(oldTopic.noamTopicId, `${addition.editionId}: the topic has legacy Ramzi sheets`);
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
    assert.equal(proof.author, 'Claude production agent (skill 7.3.3)');
    assert.ok(proof.reviewReceipts.every((r: any) => /^reports\/ANTIGRAVITY-INDEPENDENT-[A-Za-z0-9-]+-20261119\/(review|numbers-blind)\.json$/.test(r.path) && /^[0-9a-f]{64}$/.test(r.sha256)));
    assert.match(proof.reviewReceipts[0].role, /^independent (full |numbers )?review/);
    assert.match(proof.reviewReceipts.at(-1).role, /verdict (PASS_STUDENT_PDF_ESSENTIALS|PASS_DELTA)\)$/);
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

test('ten landing routes add only reviewed PDF copy and preserve their complete earlier data', () => {
  assert.equal(reviewed.landingDeltas.length, 10);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  // None of these pages named Noam AI as the hint tool, so no legacy sentence was replaced.
  assert.deepEqual(receipt.legacyHintCopy.replaced, []);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch13Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.deepEqual(delta.fields.map(f => f.path[0]), ['sections', 'bodyFlow', 'updatedLine'], `${slug}: only the section, its body flow and the date`);
    assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 19.11.2026');
    assert.equal(page.h1, restored.h1);
    assert.equal(page.title, restored.title);
    assert.equal(page.description, restored.description);
    assert.equal(page.intro, restored.intro);
    assert.deepEqual(page.faq, restored.faq);
    assert.deepEqual(page.faqGroups, restored.faqGroups);
    assert.deepEqual(page.jsonLd, restored.jsonLd);
    assert.deepEqual(page.catalogCta, restored.catalogCta);
    assert.deepEqual(page.catalogCtas, restored.catalogCtas);
    assert.deepEqual(page.sections.slice(0, -1), restored.sections);
    assert.deepEqual(page.sections.at(-1), delta.appendedSection);
    assert.equal(delta.appendedSection.blocks.length, 3);
    assert.equal(delta.appendedSection.blocks[2].text, NOTE, `${slug}: the approved note for a topic with legacy Ramzi sheets`);
    const visible = JSON.stringify([page.intro, page.sections, page.bodyFlow, page.faq, page.faqGroups]);
    assert.ok(!visible.includes('נועם AI'), `${slug}: no Noam AI hint copy in the visible body`);
    const loaded = loadTopicPage(slug)!;
    const sections = loaded.sections.filter(section => section.heading === delta.appendedSection.heading);
    assert.equal(sections.length, 1);
    assert.ok(sections[0].blocks.some(block => /רמה א׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /רמה ב׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /מצוינות/.test(block.text ?? '')));
    const hintScope = 'בדפים הקודמים שנפתחים עם רמזי אפשר לקבל רמזים';
    // 'רמזור' (a traffic light, in the rate-of-change contexts) is not a hint.
    assert.ok(sections[0].blocks.every(block => !/רמה ג׳|פתרונות מפורטים|רמז/.test((block.text ?? '').replace(hintScope, '').replace(/רמזור/g, ''))));
    assert.ok(!/בדקו|בדיקה/.test(delta.appendedSection.heading) && !/\?$/.test(delta.appendedSection.heading)
      && !/^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(delta.appendedSection.heading), `${slug}: heading stays visible`);
    assert.ok(delta.appendedSection.heading.endsWith(' — דפי PDF נוספים'), `${slug}: heading names the extra PDFs`);
    const flow = synthesizeBodyFlow(loaded);
    assert.equal(flow.filter(block => block.type === 'heading' && block.text?.replace(/[⁦-⁩]/g, '') === delta.appendedSection.heading).length, 1);
    for (const block of delta.appendedSection.blocks) {
      assert.equal(flow.filter(item => item.type === 'paragraph' && item.text?.replace(/[⁦-⁩]/g, '') === block.text).length, 1);
    }
    const faq = extractJsonLdFaq(loaded.jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    const baselineFaq = extractJsonLdFaq((beforeBatch13Copy(slug, loaded) as any).jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    assert.deepEqual(faq, baselineFaq, `${slug}: FAQ schema unchanged by batch 13`);
    if (!page.faqGroups) assert.deepEqual(faq, page.faq, `${slug}: FAQ schema matches visible FAQ`);
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
  // No edition of this batch is for the reduced track.
  assert.ok(reviewed.additions.every(a => a.track === 'ח' && !a.edition.label.includes('מצומצמת')));
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
  assert.deepEqual(raw.reviewedRamziActivations, (previous as any).reviewedRamziActivations);
});

test('preservation fences reject catalog, registry and landing substitutions and misplaced editions', () => {
  const badCatalog = structuredClone(raw);
  badCatalog.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 10).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch13Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 28)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch13Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch13Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.find((e: any) => e.editionId === ids.at(-1)).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch13Registry(registryAltered));
  for (const [grade, sourceId, destinations, editionId] of [
    [8, 28, [27, 29], 'ms-20261119-slo-01-r1'],
    [8, 10, [9, 11], 'ms-20261119-g8-sqr-01-r1'],
  ] as const) {
    for (const destinationId of destinations) {
      const moved = structuredClone(raw);
      const g = moved.grades.find((x: any) => x.grade === grade);
      const source = g.topics.find((t: any) => t.id === sourceId);
      const destination = g.topics.find((t: any) => t.id === destinationId);
      const [misplaced] = source.editions.splice(source.editions.findIndex((e: any) => e.editionId === editionId), 1);
      assert.equal(misplaced.editionId, editionId);
      if (!source.editions.length) {
        delete source.editions;
        delete source.defaultEditionId;
      }
      destination.editions = [...(destination.editions || []), misplaced];
      assert.throws(() => beforeBatch13Catalog(moved), assert.AssertionError, `${editionId} must not move from ${grade}/${sourceId} to ${grade}/${destinationId}`);
    }
  }
  // The batch 12 fence calls this fence first, so it never reverses batch 13 twice; with batch 13
  // present, it still refuses a substitution in its own edition.
  assert.throws(() => beforeBatch12Catalog(previous), (error: any) => error instanceof assert.AssertionError
    && error.message.includes('ms-20261119-prp-01-r1: only reviewed appended editions'), 'never reverses twice');
  const batch12Substituted = structuredClone(raw);
  batch12Substituted.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 12)
    .editions.at(-1).levels[0].pdfSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch12Catalog(batch12Substituted), assert.AssertionError);
  const page = read('headless/astro-poc/src/data/topic-pages/square-root-grade-8.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch13Copy('square-root-grade-8', page));
  const metaChanged = read('headless/astro-poc/src/data/topic-pages/function-concept-grade-8.json');
  metaChanged.updatedLine = 'נועם דורון מתמטיקה · עודכן 20.11.2026';
  assert.throws(() => beforeBatch13Copy('function-concept-grade-8', metaChanged));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
