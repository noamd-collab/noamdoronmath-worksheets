import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { resolveEdition } from '../src/lib/catalog/editions';
import { prepareIndex, search } from '../src/lib/siteSearch/engine';
import type { SearchIndex } from '../src/lib/siteSearch/types';
import { loadTopicPage } from '../src/lib/topicPages';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { findCatalogTopic, topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';

type PrintFileGroup = { grade: number; topicId: number; slug: string; levels: Record<string, string> };
const files: PrintFileGroup[] = JSON.parse(readFileSync(new URL('../src/data/elementary-print-worksheets.json', import.meta.url), 'utf8'));
const catalog = loadCatalog();
const publicRoot = new URL('../public/worksheet-pdfs/elementary/', import.meta.url);
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

test('the 107 reviewed PDFs retain their exact file bytes and grade, topic and level assignments', () => {
  const assignments: string[] = [];
  const uniqueFiles = new Set<string>();
  const expectedPaths = new Set<string>();
  assert.equal(files.length, 39);
  assert.equal(new Set(files.map(row => row.grade + ':' + row.topicId)).size, files.length);
  assert.equal(new Set(files.map(row => row.slug)).size, files.length);
  for (const row of files) {
    const page = loadTopicPage(row.slug);
    assert.equal(page.grade, row.grade, row.slug);
    assert.ok(topicPageCatalogTopicIds(page).includes(row.topicId), row.slug);
    for (const [level, reviewedHash] of Object.entries(row.levels)) {
      assert.match(level, /^[abc]$/);
      const path = row.slug + '/level-' + level + '.pdf';
      const body = readFileSync(new URL(path, publicRoot));
      assert.equal(body.subarray(0, 5).toString(), '%PDF-', path);
      assert.equal(sha256(body), reviewedHash, path);
      uniqueFiles.add(reviewedHash);
      assignments.push([row.grade, row.topicId, level, reviewedHash].join(':'));
      expectedPaths.add(path);
    }
  }
  assert.equal(uniqueFiles.size, 107);
  assert.equal(assignments.length, 107);
  // Fingerprint from the independently reviewed release manifests. It detects a level
  // swap even if both the deployed filenames and their catalog digests are changed.
  assert.equal(sha256(assignments.sort().join('\n') + '\n'), 'f99c51a761b2e6335456bd64fadc56a52fc2af1d19b67ef72e0f88b45798b1a1');
  const pdfsOnDisk = readdirSync(publicRoot, { recursive: true }).filter(name => name.endsWith('.pdf'));
  assert.deepEqual(new Set(pdfsOnDisk), expectedPaths);
});

test('landing pages and search open each reviewed level, with the other editions still reachable', () => {
  const previousCatalog = { ...catalog, elementaryPrintTopics: [] };
  const snapshot: SearchIndex = JSON.parse(readFileSync(new URL('../src/data/search-index.v1.json', import.meta.url), 'utf8'));
  const index = prepareIndex(snapshot);
  for (const row of files) {
    const topic = findCatalogTopic(catalog, row.grade, row.topicId);
    assert.ok(topic, row.slug);
    const back = '/topics/' + row.slug;
    const [newEdition, ...earlier] = topicWorksheetEditionLinks(catalog, row.grade, row.topicId, back);
    assert.deepEqual(earlier, topicWorksheetEditionLinks(previousCatalog, row.grade, row.topicId, back));
    assert.ok(earlier.length && newEdition.pdfOnly, row.slug);
    const hrefs = Object.keys(row.levels).sort().map(key => '/worksheet-pdfs/elementary/' + row.slug + '/level-' + key + '.pdf');
    assert.deepEqual(newEdition.levels.map(l => l.href), hrefs);
    const parts = topicPagePdfParts(catalog, row.grade, [row.topicId]).parts;
    assert.deepEqual(parts.slice(0, hrefs.length).map(p => p.contentUrl), hrefs.map(href => 'https://www.noamdoronmath.co.il' + href));
    const hit = search(index, topic.title, { grade: row.grade, limit: 1000 }).results.find(result => result.key === 'topic:' + row.grade + ':' + row.topicId);
    assert.ok(hit, row.slug);
    const selected = resolveEdition(topic);
    for (const level of selected.levels) {
      const selectedHref = newEdition.levels.find(link => link.key === level.key)?.href ??
        buildWorksheetHref({ catalog, grade: row.grade, topic, levelKey: level.key, editionId: selected.editionId });
      assert.equal(hit.levels.find(link => link.key === level.key && !link.of)?.href, selectedHref, row.slug + ' ' + level.key);
    }
  }
});
