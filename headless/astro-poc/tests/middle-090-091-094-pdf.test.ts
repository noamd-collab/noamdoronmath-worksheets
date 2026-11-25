import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { beforeNovember21Catalog, beforeNovember21Copy, beforeNovember21Registry, reviewed } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data, null, 2) + '\n').digest('hex');
const expected = [
  [90, 7, 25, 'G7-FRQ-02', 'G7-T136', 'frequency-grade-7', 'beeda59e4bd6f63293bac3907a4b7fbfbe2b552cce1a47a011f0520a58a7c5f1'],
  [91, 7, 28, 'G7-PRI-01', 'G7-T137', 'probability-introduction-grade-7', '5c727aa7f42c8591ae708bbf672a9da25d1f2d4b57c66285210f5314b8ccbc37'],
  [94, 9, 45, 'G9-DOS-01', 'G9-T120', 'difference-of-squares-grade-9', 'd2a1e510854a447b25462181028e53bbaa9b1ee8aec482ceacea4ff2be6f41f4'],
];

test('the nine reviewed student PDFs match the frozen inputs and both public media endpoints', () => {
  const catalog = loadCatalog();
  const raw = read('headless/catalog/catalog.v1.json');
  const registry = read('headless/catalog/worksheet-editions.v1.json');
  const previous = beforeNovember21Catalog(raw);
  const oldRegistry = beforeNovember21Registry(registry);
  assert.equal(hash(previous), reviewed.baselineCatalogSha256);
  assert.equal(hash(oldRegistry), reviewed.baselineRegistrySha256);
  assert.deepEqual(reviewed.packages.map(p => [p.number, p.grade, p.topicId, p.sheetId, p.producerPackage, p.slug, p.sourceBinding.sha256]), expected);
  const files = new Set<string>();
  for (const p of reviewed.packages) {
    assert.equal(p.studentRevision, p.number === 90 ? 'r04' : 'r02');
    assert.equal(p.skillVersion, '7.3.3');
    assert.ok(p.reviewReceipts.length >= 2);
    const edition = p.edition;
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.equal(edition.isDefault, false);
    const groups = topicWorksheetEditionLinks(catalog, p.grade, p.topicId, '/' + p.slug);
    assert.deepEqual(groups.map(g => g.editionId), [edition.editionId]);
    assert.deepEqual(edition.levels.map(l => [l.key, l.viewerLevel]), [['a', 'A'], ['b', 'B'], ['c', 'E']]);
    for (const [idx, level] of edition.levels.entries()) {
      const evidence = p.studentFiles[idx];
      assert.equal(evidence.key, level.key);
      assert.equal(evidence.sha256, level.pdfSha256);
      assert.equal(evidence.downloads.length, 2);
      assert.ok(evidence.downloads.every(d => d.status === 200 && d.match && d.sha256 === level.pdfSha256));
      assert.equal(groups[0].levels[idx].href, evidence.downloads[0].url);
      assert.deepEqual(evidence.downloads.map(d => new URL(d.url).host), ['static.wixstatic.com', 'www.noamdoronmath.co.il']);
      files.add(level.pdfId);
    }
    const page = read('headless/astro-poc/src/data/topic-pages/' + p.slug + '.json');
    const previousPage = beforeNovember21Copy(p.slug, page);
    assert.equal(hash(previousPage), p.priorPageSha256);
    assert.ok(page.sections.at(-1).blocks.at(-1).text.includes('התשובות הסופיות'));
  }
  assert.equal(files.size, 9);
  const frequency = reviewed.packages.find(p => p.number === 90)!;
  // Topic 25 practices absolute frequency. The older links to neighboring topic 26 stay intact.
  const frequencyCopy = [frequency.edition.label, frequency.section.heading, ...frequency.section.blocks.map(b => b.text)].join(' ');
  assert.equal(frequency.producerFreezeSha256, '7c6f304b46cb028eb29a9e04afe2f3a9ab75e3f59efee5a58ce204107a8fe57f');
  assert.equal(frequency.edition.editionId, 'ms-20261121-frq-02-r4');
  assert.equal(createHash('sha256').update(frequency.studentFiles.map(f => f.key + ':' + f.sha256 + '\n').join('')).digest('hex'), frequency.sourceBinding.sha256);
  assert.match(frequencyCopy, /דיאגרמת נקודות/);
  assert.doesNotMatch(frequencyCopy, /שכיחות יחסית|שכיחויות יחסיות/);
});
