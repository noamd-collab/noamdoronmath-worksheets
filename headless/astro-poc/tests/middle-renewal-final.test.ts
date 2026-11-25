import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mergeWorksheetEditions } from '../../../scripts/lib/worksheet-editions.cjs';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { catalogBeforePackages, copyBeforeRelease, finalRenew, registryBeforeRelease } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const hash = /^[0-9a-f]{64}$/;
const scope = [
  [103, 'G9-T129', 9,30, 21, [8,8,8]],
  [104, 'G9-T130', 9,31, 18, [7,7,7]],
  [107, 'G9-T133', 9,23, 24, [8,8,8]],
  [108, 'G8-T154', 8,1, 60, [12,13,14]],
  [109, 'G8-T155', 8,34, 60, [13,13,14]],
  [111, 'G8-T157', 8,56, 60, [14,14,16]],
  [112, 'G8-T158', 8,57, 60, [13,14,14]],
  [113, 'G8-T159', 8,58, 60, [13,13,14]],
  [114, 'G8-T160', 8,59, 42, [9,10,10]],
  [115, 'G8-T161', 8,60, 42, [10,11,12]],
  [116, 'G8-T162', 8,64, 42, [10,10,11]],
  [117, 'G7-T140', 7,49, 60, [12,13,14]],
] as const;

test('twelve reviewed topics retain their previous catalog and offer all 36 student downloads', () => {
  // This overlay follows the independently reviewed r06 correction to 081.
  assert.equal(finalRenew.baseline, 'd5f309f12c3509f14749332ce7a978240c8128e6');
  const { packages } = finalRenew;
  const catalog = loadCatalog();
  assert.deepEqual(packages.map(p => [p.number, p.producerPackage, p.grade, p.topicId, p.studentFiles[0].items,
    p.studentFiles.map(file => file.pages)]), scope);
  const previous = catalogBeforePackages(read('headless/catalog/catalog.v1.json'), packages);
  assert.equal(digest(previous), finalRenew.baselineCatalogSha256);
  const registry = read('headless/catalog/worksheet-editions.v1.json');
  assert.equal(digest(registryBeforeRelease(registry, packages.map(p => p.edition))), finalRenew.baselineRegistrySha256);
  const media = new Set<string>();
  for (const [index, pack] of packages.entries()) {
    const { edition } = pack;
    const page = read('headless/astro-poc/src/data/topic-pages/' + pack.slug + '.json');
    assert.equal(digest(copyBeforeRelease(pack.slug, page, finalRenew)), pack.priorPageSha256, pack.slug);
    assert.ok(topicPageCatalogTopicIds(loadTopicPage(pack.slug)).includes(pack.topicId), pack.slug);
    if (pack.number === 116) {
      assert.equal(page.title, 'תרגול לקראת משימת ההערכה הראשונה לכיתה ח׳ | דפי עבודה חינם');
      assert.equal(page.h1, 'תרגול לקראת משימת ההערכה הראשונה לכיתה ח׳: פיתגורס, אחוזים, מעגל וזוויות');
      assert.equal(page.description, 'תרגול לקראת משימת ההערכה הראשונה בכיתה ח׳. שאלות בפיתגורס, יחס, אחוזים, מעגל וזוויות בשלוש רמות, עם תשובות להדפסה.');
    }
    if (pack.number === 103 || pack.number === 104) {
      const priorHints = 'בדף העבודה של המהדורה הקודמת, שנפתחת עם רמזי, אפשר לקרוא רמז לצד סעיף שמופיע בו כפתור רמז.';
      const block = pack.number === 103 ? 1 : 2;
      assert.equal(page.sections[2].blocks[block].text, priorHints);
      assert.equal(page.bodyFlow[pack.number === 103 ? 8 : 9].text, priorHints);
    }
    assert.equal(pack.skillVersion, pack.number === 111 ? '7.3.4-dev' : '7.3.3');
    assert.equal(edition.isDefault, false);
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.equal(edition.nativePrefix, pack.producerPackage);
    assert.equal(edition.grade, pack.grade);
    assert.equal(edition.topicId, pack.topicId);
    assert.ok(pack.reviewReceipts.length && pack.reviewReceipts.every(r => hash.test(r.sha256)));
    if (pack.number === 111) {
      assert.equal(edition.studentPrintEvidence, undefined);
      assert.ok(edition.levels.every(level => hash.test(level.nativeExportSha256 ?? '')));
    } else {
      const evidence = edition.studentPrintEvidence;
      assert.ok(evidence, pack.slug);
      assert.equal(evidence.kind, 'reviewed-student-print');
      assert.equal(evidence.freezeSha256, pack.producerFreezeSha256);
      assert.ok(pack.reviewReceipts.some(receipt => receipt.sha256 === evidence.independentReviewSha256));
      assert.ok(edition.levels.every(level => !Object.hasOwn(level, 'nativeExportSha256')));
    }
    const groups = topicWorksheetEditionLinks(catalog, pack.grade, pack.topicId, '/' + pack.slug);
    assert.deepEqual(groups.map(group => group.editionId), [...pack.priorEditionIds, edition.editionId]);
    const added = groups.at(-1)!;
    assert.equal(added.pdfOnly, true);
    const parts = topicPagePdfParts(catalog, pack.grade, [pack.topicId]).parts;
    assert.deepEqual(edition.levels.map(level => [level.key, level.viewerLevel]), [['a','A'], ['b','B'], ['c','E']]);
    for (const [i, level] of edition.levels.entries()) {
      const file = pack.studentFiles[i];
      assert.equal(file.items, scope[index][4]);
      assert.equal(file.key, level.key);
      assert.ok(file.bytes > 0 && hash.test(level.sourceSha256) && hash.test(level.pdfSha256));
      assert.equal(file.sha256, level.pdfSha256);
      assert.deepEqual(file.downloads.map(d => new URL(d.url).hostname), ['static.wixstatic.com', 'www.noamdoronmath.co.il']);
      for (const download of file.downloads) {
        assert.equal(download.status, 200);
        assert.equal(download.match, true);
        assert.equal(download.sha256, level.pdfSha256);
        assert.ok(new URL(download.url).pathname.endsWith('_' + level.pdfId + '.pdf'));
      }
      assert.equal(added.levels[i].href, file.downloads[0].url);
      if (pack.number === 111) {
        assert.equal(added.levels[i].partialHints?.href, '/ramzi-partial?pdf=' + level.pdfId);
        assert.equal(added.levels[i].partialHints?.label, 'רמזי ל־60 סעיפים');
      } else {
        assert.equal(added.levels[i].partialHints, undefined);
      }
      assert.ok(parts.some(part => part.contentUrl === file.downloads[0].url));
      media.add(level.pdfId);
    }
  }
  assert.equal(media.size, 36);
});

test('a different level source and a different edition review cannot authenticate a student PDF', () => {
  const catalog = loadCatalog();
  const { ramziActivation, ramziHintCorrection, ...base } = catalog;
  const legacy = { ...base, grades: catalog.grades.map(grade => ({ ...grade, topics: grade.topics.map(topic => {
    const { editions, defaultEditionId, ...original } = topic;
    return original;
  }) })) };
  const [first, second] = finalRenew.packages;
  const valid = { version: 1, editions: [first.edition] };
  assert.doesNotThrow(() => mergeWorksheetEditions(legacy, valid));
  const wrongLevel = structuredClone(valid);
  wrongLevel.editions[0].levels[0].sourceSha256 = first.edition.levels[1].sourceSha256;
  assert.throws(() => mergeWorksheetEditions(legacy, wrongLevel), /print PDF differs from its signed source/);
  const wrongReview = structuredClone(valid);
  wrongReview.editions[0].studentPrintEvidence = structuredClone(second.edition.studentPrintEvidence);
  assert.throws(() => mergeWorksheetEditions(legacy, wrongReview), /must match its reviewed source and signed scope/);
});
