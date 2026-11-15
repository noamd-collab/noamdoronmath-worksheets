import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const id = 'ms-20261115-frq-01-r1';
const pdfs = ['941793a9b6614849bd5b7465c894ba87', '6cdddaac6d8c472580f2be5b4bdd0323', '659db2eb8dab43aaae976e9a669d503b'];
const hashes = ['b2aea9500e62220cd66322cb775b4db49b52234bbaa18a80680c257c33514a75', '5f411b0cb2ceaa8ddab056a3ce12ed20afa6fa4b152261372892a0d31601f351', '6ab22a1ee2a572ca44ac2c827ae2339b431b716ee4e534d1fff22ec78bc616f9'];
const catalog = loadCatalog();
const topic = catalog.grades.find(g => g.grade === 7)!.topics.find(t => t.id === 26)!;
const before = structuredClone(catalog);
const priorTopic = before.grades.find(g => g.grade === 7)!.topics.find(t => t.id === 26)!;
delete priorTopic.editions;
delete priorTopic.defaultEditionId;
const registry = JSON.parse(read('headless/catalog/worksheet-editions.v1.json'));
const priorRegistry = { ...registry, editions: registry.editions.filter((e: any) => e.editionId !== id) };

test('FRQ adds exact reviewed PDFs while preserving the legacy default and every preceding catalog field', () => {
  const edition = topic.editions!.find(e => e.editionId === id)!;
  assert.equal(topic.defaultEditionId, 'legacy');
  assert.equal(edition.label, 'טבלאות שכיחות ושכיחות יחסית — PDF');
  assert.equal(edition.publicationMode, 'pdf-only');
  assert.equal(edition.routing.usesViewer, false);
  assert.equal(edition.routing.aiHintShown, false);
  assert.deepEqual(edition.levels.map(l => l.pdfId), pdfs);
  assert.deepEqual(edition.levels.map(l => l.pdfSha256), hashes);
  assert.ok(edition.levels.every(l => !l.ramzi));
  const groups = topicWorksheetEditionLinks(catalog, 7, 26, '/worksheets?grade=7&topic=26');
  assert.deepEqual(groups.map(g => g.editionId), ['legacy', id]);
  assert.deepEqual(groups[1].levels.map(l => l.href), pdfs.map(pdf => `${catalog.config.pdfBase}${pdf}.pdf`));
  for (const level of topic.levels) {
    assert.equal(buildWorksheetHref({ catalog, grade: 7, topic, levelKey: level.key }),
      buildWorksheetHref({ catalog: before, grade: 7, topic: priorTopic, levelKey: level.key }));
  }
  const snapshot = JSON.parse(read('headless/astro-poc/src/data/catalog.v1.json'));
  // Later MED/PRB/REC additions have their own exact preservation fence. Remove
  // only those additions before checking the historical pre-FRQ snapshot.
  const g9 = snapshot.grades.find((g: any) => g.grade === 9);
  g9.topics = g9.topics.filter((topic: any) => topic.id !== 48);
  delete snapshot.searchTerms['9']['48'];
  for (const [grade, topicId] of [[7, 27], [9, 11]]) {
    const later = snapshot.grades.find((g: any) => g.grade === grade).topics.find((t: any) => t.id === topicId);
    delete later.editions; delete later.defaultEditionId;
  }
  const t = snapshot.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 26);
  delete t.editions; delete t.defaultEditionId;
  assert.equal(createHash('sha256').update(JSON.stringify(snapshot, null, 2) + '\n').digest('hex'),
    'cfdc4b6540e799581c8bc6e0cc968ba66f5c71424328964a1671a6888a8b1992', 'entire prior RAT+ALG catalog remains exact');
});

test('FRQ cannot enter teacher choices, future progress rows, or viewer manifest selection', () => {
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(before));
  const picker = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(picker, buildTeacherLandingCatalog(before));
  assert.equal(getTeacherLandingScope({ grade: 7, topic: 26, edition: id }, picker), null);
  assert.ok(getTeacherLandingScope({ grade: 7, topic: 26 }, picker));
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(before));
  assert.ok(pdfs.every(pdf => !collectViewerPdfIds(catalog).includes(pdf)));
  const raw = loadIndexCatalog();
  const evidence = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname,
    new URL('headless/astro-poc/public/', root).pathname);
  const learning = buildLearningCatalog(raw, registry, evidence);
  assert.deepEqual(learning, buildLearningCatalog(raw, priorRegistry, evidence));
  assert.ok(learning.every((row: any) => row.editionId !== id && !pdfs.includes(row.pdf)));
});
