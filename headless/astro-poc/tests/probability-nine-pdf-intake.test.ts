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
  probabilityNineIds as ids, reviewedProbabilityNine as reviewed } from './fixtures/probability-nine-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeProbabilityNineCatalog(raw);
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeProbabilityNineRegistry(registry);
const receipt = read('docs/probability-nine-pdf-first-20261116.json');
const topic = catalog.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 10)!;
const page = read('headless/astro-poc/src/data/topic-pages/probability-grade-9.json');
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, '');

test('nine frozen probability PDFs are the only additions to the independently pinned live catalog', () => {
  assert.equal(reviewed.baselineCommit, '58f2892dfcefcb2795689d16e9414ad085f471fb');
  assert.equal(reviewed.baselineCatalogSha256, '17bedac54256640c2de45a4d311af4cd7c1d56e7fe7473313d30ef19f6dc4ce8');
  assert.equal(digest(previous), reviewed.baselineCatalogSha256);
  assert.equal(digest(priorRegistry), reviewed.baselineRegistrySha256);
  assert.equal(registry.editions.length, 38);
  assert.equal(registry.editions.flatMap((e: any) => e.levels).length, 114);
  assert.equal(priorRegistry.editions.length, 35);
  assert.deepEqual(ids, ['prc', 'prt', 'prw'].map(x => `ms-20261116-${x}-01-r1`));
  assert.deepEqual(reviewed.additions.map(x => x.nativePrefix), ['G9-T60', 'G9-T61', 'G9-T62']);
  assert.deepEqual(receipt.scope, { packages: 3, pdfs: 9, pages: 47, subitems: 169 });
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.equal(receipt.review.wholePackagePass, false);
  assert.equal(receipt.review.fullIndependentPdfReviewReused, 47);
  assert.equal(receipt.review.controllerSupplementaryPagesViewed, 18);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
  assert.equal(new Set(receipt.packages.flatMap((p: any) => p.levels.map((l: any) => l.pdfSha256))).size, 9);
});

test('all four probability choices coexist, and new links download exact reviewed PDFs with no viewer or hint claims', () => {
  assert.equal(topic.defaultEditionId, 'legacy');
  const groups = topicWorksheetEditionLinks(catalog, 9, 10, '/worksheets?grade=9&topic=10');
  assert.deepEqual(groups.map(g => g.editionId), ['legacy', ...ids]);
  assert.deepEqual(groups[0], topicWorksheetEditionLinks(previous, 9, 10, '/worksheets?grade=9&topic=10')[0]);
  for (const edition of topic.editions!) {
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.deepEqual(edition.routing, {
      usesViewer: false, aiHintShown: false,
      resolvedNoamPrefix: reviewed.additions.find(a => a.editionId === edition.editionId)!.nativePrefix,
      viewerPath: 'worksheet-viewer-noam.html', siblingPdfQuery: {
        pa: edition.levels[0].pdfId, pb: edition.levels[1].pdfId, pc: edition.levels[2].pdfId,
      },
    });
    const proof = receipt.packages.find((p: any) => p.editionId === edition.editionId);
    for (const level of edition.levels) {
      const pin = proof.levels.find((p: any) => p.key === level.key);
      for (const field of ['pdfId','pdfSha256','sourceSha256','nativeExportSha256','worksheetId','revision']) assert.equal(pin[field], (level as any)[field]);
      assert.equal(Object.hasOwn(level, 'ramzi'), false);
      assert.equal(pin.downloadChecks.length, 1);
      assert.deepEqual(pin.downloadChecks[0], {url:`https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`,status:200,sha256:(level as any).pdfSha256});
      assert.equal(buildWorksheetHref({catalog,grade:9,topic,editionId:edition.editionId,levelKey:level.key}), pin.downloadChecks[0].url);
      assert.ok(!collectViewerPdfIds(catalog).includes(level.pdfId));
    }
  }
});

test('the nine PDFs leave every teacher, learning, viewer and existing hint source unchanged', () => {
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const id of ids) assert.equal(getTeacherLandingScope({grade:9,topic:10,edition:id},teacher), null);
  assert.ok(getTeacherLandingScope({grade:9,topic:10},teacher));
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/',root).pathname, new URL('headless/astro-poc/public/',root).pathname);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation), buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
  assert.deepEqual(raw.ramziActivation, previous.ramziActivation);
  assert.equal(Object.hasOwn(raw,'ramziHintCorrection'), false);
});

test('probability landing names the actual three scopes with synchronized visible copy and FAQ schema', () => {
  const restored = beforeProbabilityNineCopy('probability-grade-9', page);
  assert.equal(digest(restored), reviewed.baselineLandingSha256);
  assert.deepEqual(page.catalogCtas, restored.catalogCtas);
  assert.deepEqual(page.catalogCta, restored.catalogCta);
  assert.equal(page.h1, restored.h1);
  assert.equal(page.title, restored.title);
  for (const term of ['חד־שלבי','שכיחות יחסית','מאורע משלים','עם החזרה','בלי החזרה']) assert.ok(page.description.includes(term));
  assert.match(page.intro,/בדפים שנפתחים עם רמזי/);
  assert.match(page.intro,/ה־PDF הנוספים מיועדים להורדה ולהדפסה/);
  const loaded = loadTopicPage('probability-grade-9');
  const flow = synthesizeBodyFlow(loaded);
  for (const block of page.sections.at(-1).blocks) assert.equal(flow.filter(b => b.type==='paragraph' && plain(b.text || '')===block.text).length,1);
  const faq = extractJsonLdFaq(loaded.jsonLd).map(f=>({question:plain(f.question),answer:plain(f.answer)}));
  assert.deepEqual(faq, page.faq);
  assert.deepEqual(page.faqGroups[0].items, page.faq);
  for (const node of page.jsonLd['@graph'].filter((n:any)=>['WebPage','LearningResource'].includes(n['@type']))) assert.equal(node.description,page.description);
});

for (const [name, mutate] of [
  ['wrong PDF', (t:any)=>{t.editions[0].levels[0].pdfId='wrong'}],
  ['wrong topic prefix', (t:any)=>{t.editions[0].nativePrefix='G9-T99'}],
  ['unexpected viewer activation', (t:any)=>{t.editions[0].routing.usesViewer=true}],
  ['duplicate overlay', (t:any)=>{t.editions.push(t.editions[0])}],
  ['missing overlay', (t:any)=>{t.editions.pop()}],
  ['replaced legacy link', (t:any)=>{t.levels[0].pdfId='wrong'}],
  ['changed default', (t:any)=>{t.defaultEditionId=ids[0]}],
] as const) test(`historical projection rejects ${name}`,()=>{
  const bad=structuredClone(raw);
  mutate(bad.grades.find((g:any)=>g.grade===9).topics.find((t:any)=>t.id===10));
  assert.throws(()=>beforeProbabilityNineCatalog(bad));
});
test('registry duplicates and unreviewed landing promises cannot be hidden by a historical projection',()=>{
  const bad=structuredClone(registry);bad.editions.push(bad.editions.at(-1));
  assert.throws(()=>beforeProbabilityNineRegistry(bad));
  const copy=structuredClone(page);copy.intro+=' בכל PDF יש רמזי';
  assert.throws(()=>beforeProbabilityNineCopy('probability-grade-9',copy));
});
