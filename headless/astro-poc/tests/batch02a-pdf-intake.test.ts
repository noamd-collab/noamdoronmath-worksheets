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
import { beforeBatch02aCatalog, beforeBatch02aRegistry, beforeBatch02aCopy,
  reviewedBatch02a as reviewed, reviewedBatch02aIds as ids } from './fixtures/batch02a-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch02aCatalog(raw) as ReturnType<typeof loadCatalog>;
// Same SSR normalization as loadCatalog (Wix media CDN) so direct-PDF links compare like for like.
const previousSsr = { ...previous, config: { ...previous.config, pdfBase: 'https://static.wixstatic.com/ugd/d8e7ad_' } };
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeBatch02aRegistry(registry);
const receipt = read('docs/batch02a-pdf-first-20261117.json');
const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');

// Pinned independently from the manager's pdfs.json and the batch-02a media read-back.
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261117-sqr-01-r1': [
    ['dd8c477df8bb48aca792b115348f5b8d', '8e6b0f915946b03e9f02acb6915d3fc16fc61337008b62f9a9d915e4c242ec1b'],
    ['820c881f7c534d7e9b1f2d6f2eae31d8', '2a2b2d4a9948915256d666411952ffb3b9bbaae4e5bf7d0725fda7a307241487'],
    ['9892c8b4456341319b4672f10f5994f2', '457ef2a181f4f4a4682776403a1f433a4e73e5e9176e81ae3c0df558f6f3522f']],
  'ms-20261117-rhb-01-r1': [
    ['3bae45c8b0cf41f090e5066503ae9d7b', '71a47b061aa0d5e723150645ec4fbc72a5b5bdf790177c2dc305272ba948d467'],
    ['f711290629a749cbbbef938f10380d6d', 'e031f319c64fe623461326c6c407fd0e494a16a14c4d1dfbe6792971eaa05870'],
    ['2cc0c3f0b6f74dc4957d82ff3110dc26', 'dafcf51f84032cb2689043775615e85df353d28bc92f7bd1f77a9abe744d3290']],
  'ms-20261117-iso-01-r1': [
    ['bf547a4101f24b4e883f89e376e4298d', 'a739232cbb50f41bfe8be72efeda53d10494b8d1fae6dfbc72f898db6bf4427d'],
    ['5e0757ec18454cc8b2ba09b393a0cef0', '1676571a4cc104809592e7fbcf983b48de8bfb3289e25e73826e2159cb16f5ba'],
    ['c7e32410da0c44b2a27f93442cff1028', 'a960be5568c8b01a83decab0d5614bc9b6e719a65791e6f8fa3437df1eb81bc7']],
  'ms-20261117-pow-01-r1': [
    ['504f6d5a4dcc452d82040acd4022f08f', '7ae4bbc78fb6817a4e15239fae5ec50d1a6c13be5278b33d74b4f84289bdfec2'],
    ['71679d07b2424f9f8acea50fca7f5a13', 'd65bac9e898b8656238118cf2bae6747779a4a5c754caa37935c0d9329851883'],
    ['5e3746f315124a4eab2a8625c4f56d98', 'a8d7e9e2ed87ed22b2cd385326418db3fea33ca413e4be14428b0ccc9c10c59f']],
  'ms-20261117-mpl-01-r1': [
    ['118a99e943454534aad8a32f3a7daad3', '74e19c3324d254a8a95071b341ca0ca4209912e00c99b304efd74cadf7156d97'],
    ['43f0bdb4cef24ec28d411ef45e6e52f2', 'cfcd5469216b74e3e505be56b806e350054f481c17234f600fdb17e38bacfd83'],
    ['a8020d798acd4627833ae91d5a7c4277', '6fee2e6d4d124ef78bf685c735c31484b48464f5c6300626fd03f118fdef1c07']],
  'ms-20261117-pyd-01-r1': [
    ['ec44659ece3945bc94a604f77665b05a', '3e915a3d928440b085a737000b84f68278549b7064fb4661644e2ab4a8819eb5'],
    ['a317e2762ae4467c955c1948503e5762', '817f18bbaf419f05655cb1b584e1b7bb8a0271f9b6278dfa0ef3d8b2b8e90b8e'],
    ['68b2dd7cc098442c9be31941e4b257d1', 'efcf52deb1e30f420e4dcd7f4cf7e7a9f86278a07dea9733696e5e04eb78c2fb']],
  'ms-20261117-tri-01-r1': [
    ['719986b02f9641a78106efbb18ef2cf8', 'ee3c30cc81cdf61c90c6325734062934d468098491e5caeab3c2afba82a9991c'],
    ['f03bf993fba243ef987a4802b6b45f36', '6865e97a08ae41bc6d405e96da31b5587db7dcb9ef62efd27c068e2b83abf486'],
    ['0d51bacd6d7045b2bc4b9db284502dbc', 'fc0de590a2b66a5d33b43b2e03be0a208abce51169dc3056f4a21af14067643b']],
  'ms-20261117-tri-02-r1': [
    ['640b11e5b8954fa1ab05c37df5983647', 'd1e70e8e64da9d57e650a388a9ab5f5b34cc8b28bca29cea0da39ac56bf844ff'],
    ['0d31d5116c6949b0833007add8f03713', 'c4eed0d385c6a1b39dd0cbe8ed32017ba5be4d5471f2b784d254c310960eeae0'],
    ['3903e1ae817d4b4299f76ccc6294c579', 'd07b7a4417c834e0fe0819f5f07afac6ffe640656299cf009055ae6f1beb881f']],
  'ms-20261117-wpe-01-r1': [
    ['4ff03af80d80446aa3c5a407ebf69289', 'bd71d7bc515e52cd6289f6bb6105245aa967f0c6f448073e39702b4c42a5bf56'],
    ['f3995a46448942abb3b33b69f9de1b4f', 'e0ad31e9ea3b320f4ed7c3e87f52635eefbce0aa52be64c4fbf12d8c42f54e2e'],
    ['2ea6a51139ec4535a122c2f24d459ae3', '97108c458e654486d561233dcd2289c1357f9c55ae29bc7677445e3f2340a14c']],
  'ms-20261117-wpe-02-r1': [
    ['1f03234e661245f9ad63b541b5e79cc9', '1adee090afd3b2dbeff5b938e6b1dab1d6b14d70b9d15750e76dc71ce5f05c8d'],
    ['e0f46b7c1499441da318de6ce2a96e40', '7c9e97ba850eaae9608b8720f531447f9b3c75863c2e11f80ac935fb51c042d0'],
    ['7c0ca323926146c79e789b614e4e2ba3', 'a1105ea26af3784bdbabf2c155901542b9d28be19b9571ca1c378ab1796c9dd0']],
  'ms-20261117-dat-02-r1': [
    ['9a0910f39e494fd18838681f78b9937a', 'd42fccba7532f8133ffbad59858e36374310a13c5bae05219fec1db8fd492444'],
    ['e920c6c108bb4c2e8b3b096f6bbdcbab', '8dd9611a2e1d901ac229b24f13f6639b5a280ece5d52e54cce6180bfb28d355c'],
    ['b4558ba9a8ed46269633ab777436f531', 'ec3f6a1f95951a2eb93ba8b9334d3f183948fc11c41551c6809ec1e81b2db2fe']],
  'ms-20261117-slp-01-r1': [
    ['0cbfb20a8169407a81d72bde23dddf86', '253ea6436b9e302a9ccd1d9f548a65de948fbbf074ef2c264ece18940dafd813'],
    ['981a6fff293544fb8b83a7a82c4d04ea', 'e88eab4f9ac7e220374b5aba9e5f837b7f27bce5a6d065fd0860e6531c23b584'],
    ['6b98e84bf83541919843e8c52ca9109a', '4333856bf50a39d6a9f97f87d4adbeb02a6f8ce5fd8a9482a28df3974bc05185']],
  'ms-20261117-prb-01-r1': [
    ['4568e4125edf487f85294aee82015e20', 'd7bfb439817c23e8cb2d75323d1d35625ac1bc942068e2071d8e475d75f8f8b6'],
    ['28821bec9d0841a2b33ef41b8c45b3be', 'd53885b236f9a919ebb19004a9ec9d8a6c4dd932a6f8d413eb298763438c2ce6'],
    ['28b77f244b6745aaa5c98110779299cf', 'a854fdd777627f590299169b97af3676f9e6a332fed6604f0164a79d2aaeb5f6']],
  'ms-20261117-q1c-01-r1': [
    ['2f071c99ad174ee3920a91913fd434cf', '92d438e7520657c348b8e60f0f8c07c7beac3d81c25231697492e5575b39d02f'],
    ['5f23963c723d41eb80388c93c27e6dc8', '340ed4e2fc1481ec5bc9db7936132635b436ccabb4442d903d81513a23a41bbe'],
    ['b8021eec9ef4442d91cbee655eafe1d0', '29d14a95e9ea336671506fd5e1b72c3e003bc951a92947b7fd1911f776edaf09']],
  'ms-20261117-mul-01-r1': [
    ['e7efb95a61ad4640ab080f10bb136240', '9a4ec7385a76278796127088417f0c69091ca6d6782873ee16c39676aac9db74'],
    ['b45c4d505e824ff68b829af6b5231301', '6d8ad32a67bc9dd9a939017afaf7945ab4f78e70a299a3e988893fc8b90e8d79'],
    ['470f0fb5870f44adab9a13d94271011a', 'bb19d1a57dab1ba5dd9bdba89e534bf9f43d66cf090b942dd014a3d5c322b732']],
  'ms-20261117-eqn-02-r1': [
    ['df64c68547334bebabe877f8865ffb46', '3cbd9d5ca954af38c55308758544e826de7fe74d1924438105a2846dec532ad1'],
    ['e3dd565c64454e6da1c007521f13e593', 'd701c635ea8d028d95a5f95f01e8a6f801291ee46d69175402a89d659d7a2606'],
    ['b21c3a81a1de4ea68b1e3881aa84dd5e', '51d9ad41fa03f3892f76cde9250a6140563a0d383745757367d1e72f087ba0eb']],
};

const MAPPINGS: Array<[number, number, string, string]> = [
  [9, 14, 'square-grade-9', 'G9-T99'], [9, 13, 'rhombus-grade-9', 'G9-T98'],
  [9, 4, 'isosceles-triangle-grade-9', 'G9-T97'], [9, 16, 'exponent-rules-grade-9', 'G9-T91'],
  [9, 18, 'word-problems-grade-9', 'G9-T76'], [9, 35, 'pythagorean-theorem-grade-9', 'G9-T69'],
  [8, 42, 'triangle-median-grade-8', 'G8-T72'], [8, 40, 'isosceles-triangle-properties-grade-8', 'G8-T73'],
  [8, 3, 'equations-with-fractions-grade-8', 'G8-T70'], [8, 46, 'word-problems-choosing-unknowns-grade-8', 'G8-T71'],
  [8, 66, 'two-data-sources-grade-8', 'G8-T97'], [8, 29, 'linear-function-grade-8', 'G8-T78'],
  [8, 50, 'probability-sample-space-grade-8', 'G8-T88'], [7, 8, 'coordinate-plane-scale-grade-7', 'G7-T72'],
  [7, 3, 'multiplying-signed-numbers-grade-7', 'G7-T93'], [7, 37, 'equations-advanced-grade-7', 'G7-T94'],
];

test('sixteen fixed mappings add forty-eight frozen PDFs and recover the independently pinned 37213b1c baseline', () => {
  // Read from the exact baseline git blobs (headless/astro-poc-baseline after #505) before implementation.
  const baselineCatalog = '1325042ee886bae39b8b17e8c69cb582d70898daa69844c66dc0c8096c697b94';
  const baselineRegistry = '69cfc71cca1e1693cdcd43b71bf14941acc9c5368785bce7a39db28bada74c74';
  assert.equal(reviewed.baselineCommit, '37213b1c3f240c07b8594637333a965fc5d83511');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalog);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistry);
  assert.equal(digest(previous), baselineCatalog);
  assert.equal(digest(priorRegistry), baselineRegistry);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug, a.nativePrefix]), MAPPINGS);
  assert.deepEqual(ids, ['sqr-01', 'rhb-01', 'iso-01', 'pow-01', 'mpl-01', 'pyd-01', 'tri-01', 'tri-02', 'wpe-01',
    'wpe-02', 'dat-02', 'slp-01', 'prb-01', 'q1c-01', 'mul-01', 'eqn-02'].map(key => `ms-20261117-${key}-r1`));
  // Every batch-02a topic had no edition before; each gains exactly one.
  assert.ok(reviewed.additions.every(a => a.baselineEditionIds.length === 0));
  assert.deepEqual(Object.keys(PINS), ids);
  for (const addition of reviewed.additions) {
    assert.deepEqual(addition.edition.levels.map(l => [l.pdfId, l.pdfSha256]), PINS[addition.editionId]);
    const sheetId = receipt.packages.find((p: any) => p.editionId === addition.editionId).sheetId;
    assert.deepEqual(addition.edition.levels.map(l => l.worksheetId), ['a', 'b', 'c'].map(k => `ms-${sheetId.toLowerCase()}-${k}-r1`));
    assert.match(addition.edition.label, / · PDF$/);
  }
  assert.match(reviewed.additions.find(a => a.slug === 'pythagorean-theorem-grade-9')!.edition.label, /תוכנית מצומצמת/);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 48);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 48);
  assert.equal(registry.editions.length, 55);
  assert.equal(registry.editions.flatMap((e: any) => e.levels).length, 165);
  assert.equal(priorRegistry.editions.length, 39);
  assert.equal(priorRegistry.editions.flatMap((e: any) => e.levels).length, 117);
  assert.deepEqual(registry.editions.slice(0, 39), priorRegistry.editions);
  assert.deepEqual(registry.editions.slice(39), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 973);
  assert.deepEqual(receipt.scope, { packages: 16, pdfs: 48, pages: 385, subitems: 1431, landingRoutes: 16 });
  assert.deepEqual(receipt.packages.map((p: any) => p.editionId), ids);
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.equal(receipt.review.allGatesPass, false);
  assert.equal(receipt.review.nativeOrHintsAcceptance, false);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
});

test('all forty-eight additions open their own reviewed PDF directly while every previous choice remains', () => {
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
    assert.deepEqual(topic.levels.map(l => l.key), ['a', 'b', 'c']);
    const proof = receipt.packages.find((p: any) => p.editionId === addition.editionId);
    assert.ok(proof, `${addition.editionId}: public frozen evidence`);
    assert.equal(proof.producerPackage, addition.nativePrefix);
    assert.match(proof.reviewReceiptSha256, /^[0-9a-f]{64}$/);
    // claude007's G7-EQN-02 receipt names its verdict PASS_PDF_ESSENTIALS; every other receipt PASS_STUDENT_PDF_ESSENTIALS.
    assert.equal(proof.reviewVerdict, addition.editionId === 'ms-20261117-eqn-02-r1' ? 'PASS_PDF_ESSENTIALS' : 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.equal(proof.reviewReceipts[0].sha256, proof.reviewReceiptSha256);
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

test('sixteen landing updates keep titles and CTAs and describe the actual series in synchronized copy and FAQ schema', () => {
  assert.equal(reviewed.landingDeltas.length, 16);
  const scope: Record<string, string[]> = {
    'square-grade-9': ['תכונות הצלעות, הזוויות והאלכסונים', 'משפטים הפוכים', 'מערכת צירים'],
    'rhombus-grade-9': ['תכונות הצלעות, הזוויות והאלכסונים', 'משפטים הפוכים'],
    'isosceles-triangle-grade-9': ['משפטים הפוכים', 'גובה, תיכון וחוצה זווית'],
    'exponent-rules-grade-9': ['מעריך טבעי ואפס', 'חוקי שורש ריבועי'],
    'word-problems-grade-9': ['שאלות תנועה, אחוזים והספק', 'ממעלה ראשונה או שנייה'],
    'pythagorean-theorem-grade-9': ['בצורות מורכבות', 'היקפים ושטחים', 'לתוכנית המצומצמת'],
    'triangle-median-grade-8': ['אי־שוויון המשולש', 'שווי שטח', 'מערכת צירים'],
    'isosceles-triangle-properties-grade-8': ['זוויות הבסיס', 'משפטים הפוכים', 'חפיפת משולשים'],
    'equations-with-fractions-grade-8': ['מכנה משותף', 'מינוס לפני שבר', 'משוואות מיוחדות'],
    'word-problems-choosing-unknowns-grade-8': ['בחירת נעלם', 'תנועה, אחוזים ויחס', 'טבלת תנועה'],
    'two-data-sources-grade-8': ['שכיחות יחסית', 'מדדי מרכז', 'קבוצות מאוחדות'],
    'linear-function-grade-8': ['קצב שינוי אחיד', 'שיפוע ישר משתי נקודות', 'ישרים מקבילים'],
    'probability-sample-space-grade-8': ['מרחב מדגם', 'מאורע משלים', 'הוגנות'],
    'coordinate-plane-scale-grade-7': ['לרביע הראשון', 'אורך קטע', 'קודקוד חסר במלבן'],
    'multiplying-signed-numbers-grade-7': ['חוקי הסימנים', 'בכפל ובחילוק מספרים מכוונים'],
    'equations-advanced-grade-7': ['חוק הפילוג', 'בפעולות שקולות', 'עם מכנים'],
  };
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug), Object.keys(scope));
  for (const delta of reviewed.landingDeltas) {
    const pageRaw = read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`);
    const restored = beforeBatch02aCopy(delta.slug, pageRaw) as any;
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
    assert.equal(added.blocks.at(-1).text, 'שלושה קובצי PDF ברמות א׳, ב׳ ומצוינות, עם תשובות סופיות בסוף כל דף.');
    // TopicPage's setupSelfCheckReveal() hides the second paragraph of a section whose heading
    // looks like a self-check; the new sections are plain copy and must stay fully visible.
    assert.ok(!/בדקו|בדיקה/.test(added.heading) && !/\?$/.test(added.heading)
      && !/^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(added.heading), `${delta.slug}: heading would hide copy behind הצג תשובה`);
    for (const text of [pageRaw.description, pageRaw.intro, added.heading, ...added.blocks.map((b: any) => b.text),
      ...pageRaw.faq.slice(-2).flatMap((f: any) => [f.question, f.answer])]) {
      assert.ok(!text.includes('/'), `${delta.slug}: no slash fractions`);
      assert.ok(!text.includes('רמה ג׳'), `${delta.slug}: level names`);
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
  // The reduced-track series says so; the reviewed copy corrections stay in place.
  const pyd = read('headless/astro-poc/src/data/topic-pages/pythagorean-theorem-grade-9.json');
  assert.match(pyd.intro, /סדרת PDF לתוכנית המצומצמת בכיתה ט׳/);
  const text = (slug: string) => read(`headless/astro-poc/src/data/topic-pages/${slug}.json`).sections.at(-1).blocks.map((b: any) => b.text).join(' ');
  assert.ok(text('linear-function-grade-8').includes('הייצוג האלגברי של פונקציה קווית'));
  assert.ok(text('triangle-median-grade-8').includes('אורכים שלמים אפשריים לתיכון'));
  assert.ok(text('word-problems-grade-9').startsWith('ברוב השאלות'));
  // Independent review of the first push: only the meeting question has a motion table, and several
  // denominators in one equation already appear at level b (several brackets only at excellence).
  const wpe02 = text('word-problems-choosing-unknowns-grade-8');
  assert.ok(wpe02.includes('בשאלת המפגש משלימים טבלה של מהירות, זמן ודרך לשניים שיוצאים זה לקראת זה; יש גם שאלת תנועה הלוך וחזור.'));
  assert.ok(!wpe02.includes('בשאלות התנועה משלימים טבלה'));
  const eqn02 = text('equations-advanced-grade-7');
  assert.ok(eqn02.includes('ברמה ב׳ יש גם מספרים עשרוניים ושברים ומשוואות עם כמה מכנים, ובמצוינות גם כמה סוגריים באותה משוואה.'));
  assert.ok(!eqn02.includes('כמה סוגריים או כמה מכנים'));
  // Second review: two equal adjacent sides make a parallelogram a rhombus, not any quadrilateral.
  const rhb = text('rhombus-grade-9');
  assert.ok(rhb.includes('מרובע שכל ארבע צלעותיו שוות, או מקבילית שיש בה שתי צלעות סמוכות שוות, אלכסונים מאונכים או אלכסון שחוצה זווית.'));
  assert.ok(!rhb.includes('מקבילית או מרובע הם מעוין: שתי צלעות סמוכות שוות'));
});

test('preservation fences reject changed old links, substitutions, reordering, duplicates and unsupported landing claims', () => {
  const topicOf = (cat: any, g: number, t: number) => cat.grades.find((x: any) => x.grade === g).topics.find((x: any) => x.id === t);
  const old = structuredClone(raw);
  topicOf(old, 9, 14).levels[0].pdfId = 'old-link-changed';
  assert.throws(() => beforeBatch02aCatalog(old));
  const inserted = structuredClone(raw);
  const square = topicOf(inserted, 9, 14);
  square.editions.unshift({ ...structuredClone(square.editions[0]), editionId: 'ms-unreviewed-r1' });
  assert.throws(() => beforeBatch02aCatalog(inserted));
  const changed = structuredClone(raw);
  topicOf(changed, 8, 29).editions[0].levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch02aCatalog(changed));
  const reordered = structuredClone(raw);
  topicOf(reordered, 7, 37).levels.reverse();
  assert.throws(() => beforeBatch02aCatalog(reordered));
  const swapped = structuredClone(raw);
  const [t14, t13] = [14, 13].map(id => topicOf(swapped, 9, id));
  [t14.editions, t13.editions] = [t13.editions, t14.editions];
  assert.throws(() => beforeBatch02aCatalog(swapped));
  const defaultFlip = structuredClone(raw);
  topicOf(defaultFlip, 9, 35).defaultEditionId = ids[5];
  assert.throws(() => beforeBatch02aCatalog(defaultFlip));
  const duplicate = structuredClone(registry);
  duplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch02aRegistry(duplicate));
  const registryDefault = structuredClone(registry);
  registryDefault.editions.find((e: any) => e.editionId === ids[15]).isDefault = true;
  assert.throws(() => beforeBatch02aRegistry(registryDefault));
  const page = read('headless/astro-poc/src/data/topic-pages/pythagorean-theorem-grade-9.json');
  page.intro += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch02aCopy('pythagorean-theorem-grade-9', page));
  const section = read('headless/astro-poc/src/data/topic-pages/equations-advanced-grade-7.json');
  section.sections.at(-1).blocks[0].text += ' עם דוגמה פתורה';
  assert.throws(() => beforeBatch02aCopy('equations-advanced-grade-7', section));
});
