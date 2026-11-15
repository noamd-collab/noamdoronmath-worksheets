import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicEditions, worksheetTopicHintLabel } from '../src/lib/catalog/editions';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { worksheetHref } from '../../../noam-ai/site-companion/retrieve.js';

const require = createRequire(import.meta.url);
const { loadIndexCatalog, buildCatalog, validateCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { learningOutputs } = require('../../../tools/catalog-audit.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const media = ['04786c9d5ed04b30a67480e192b4706f', '54ed203698a141cda131ccf08f274a2c', '1bbc10333cf74e6fa251ed34575e6320'];
const registry = JSON.parse(readFileSync(join(root, 'headless/catalog/worksheet-editions.v1.json'), 'utf8'));
const activation = loadRamziActivationEvidence(join(root, 'headless/catalog'), join(root, 'headless/astro-poc/public'));
const raw = loadIndexCatalog();
const withoutNewTopic = structuredClone(raw);
withoutNewTopic.DATA[9].topics = withoutNewTopic.DATA[9].topics.filter((topic: any) => topic.id !== 47);
delete withoutNewTopic.DATA[9].links[47];
delete withoutNewTopic.SEARCH_TERMS[9][47];

test('RAT01 is one new real topic with three PDF actions and no viewer or hint claim', () => {
  const catalog = loadCatalog();
  const grade = catalog.grades.find(grade => grade.grade === 9)!;
  const topic = grade.topics.find(topic => topic.id === 47)!;
  assert.equal(topic.title, 'משוואות רציונליות');
  assert.equal(topic.publicationMode, 'pdf-only');
  assert.deepEqual(topic.levels.map(level => level.pdfId), media);
  assert.equal(topic.noamTopicId, undefined);
  assert.equal(topic.routing.resolvedNoamPrefix, null);
  assert.equal(topic.routing.usesViewer, false);
  assert.equal(worksheetTopicHintLabel(topic), null);
  assert.equal(topicEditions(topic).length, 1, 'single base group, no old-edition choice');
  const groups = topicWorksheetEditionLinks(catalog, 9, 47, '/worksheets?grade=9&topic=47');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].levels.length, 3);
  for (const [i, level] of topic.levels.entries()) {
    const expected = `https://static.wixstatic.com/ugd/d8e7ad_${media[i]}.pdf`;
    assert.equal(buildWorksheetHref({ catalog, grade: 9, topic, levelKey: level.key }), expected);
    assert.equal(worksheetHref(catalog, grade, topic, level), expected, 'Noam guide navigates to the actual PDF');
    assert.equal(groups[0].levels[i].href, expected);
  }
  assert.equal(registry.editions.some((row: any) => row.grade === 9 && row.topicId === 47), false);
});

test('full future teacher regeneration and the live picker both omit the unmeasured base PDFs', () => {
  const catalog = loadCatalog();
  const teacher = buildTeacherCatalog(catalog);
  const landing = buildTeacherLandingCatalog(catalog);
  assert.equal(teacher.grades.find((grade: any) => grade.grade === 9).topics.some((topic: any) => topic.id === 47), false);
  assert.equal(landing.grades.find(grade => grade.grade === 9)!.topics.some(topic => topic.id === 47), false);
  assert.equal(getTeacherLandingScope({ grade: 9, topic: 47 }, landing), null, 'explicit unsupported teacher scope cannot silently select another topic');
  const before = structuredClone(catalog);
  before.grades.find(grade => grade.grade === 9)!.topics = before.grades.find(grade => grade.grade === 9)!.topics.filter(topic => topic.id !== 47);
  assert.deepEqual(teacher, buildTeacherCatalog(before), 'every old teacher source stays exact');
  assert.deepEqual(landing, buildTeacherLandingCatalog(before), 'every old picker choice stays exact');
  assert.ok(!JSON.stringify(teacher).includes(media[0]));
});

test('future learning catalog regeneration emits no new account IDs or seed candidates', () => {
  const after = buildLearningCatalog(raw, registry, activation);
  const before = buildLearningCatalog(withoutNewTopic, registry, activation);
  assert.deepEqual(after, before, 'all old IDs, rows and order stay exact');
  assert.equal(after.some((row: any) => row.g === 9 && row.t === 47), false);
  assert.equal(after.some((row: any) => media.includes(row.pdf)), false);
  const audit = learningOutputs(raw, registry, activation);
  assert.deepEqual(audit.items, after, 'offline audit and production generator agree on PDF-only eligibility');
  assert.deepEqual(audit, learningOutputs(withoutNewTopic, registry, activation), 'audit preserves every old seed row and generated byte');
});

test('export keeps the explicit marker and preserves all previous catalog fields', () => {
  const catalog = buildCatalog(raw);
  assert.equal(validateCatalog(catalog, raw).ok, true);
  const topic = catalog.grades.find((grade: any) => grade.grade === 9).topics.find((topic: any) => topic.id === 47);
  delete topic.publicationMode;
  assert.ok(validateCatalog(catalog, raw).errors.some((message: string) => message.includes('publicationMode mismatch')));
  const current = buildCatalog(raw);
  current.grades.find((grade: any) => grade.grade === 9).topics = current.grades.find((grade: any) => grade.grade === 9).topics.filter((topic: any) => topic.id !== 47);
  delete current.searchTerms[9][47];
  assert.deepEqual(current, buildCatalog(withoutNewTopic));
});

test('malformed publication modes and implied native activation fail before independent generators run', () => {
  const changes = [
    (r: any, t: any) => { t.publicationMode = 'ready'; },
    (r: any, t: any) => { t.x = 'G9-T93'; },
    (r: any) => { r.NOAM_PREFIX_FALLBACK[9][47] = 'G9-T93'; },
    (r: any) => { delete r.DATA[9].links[47].c; },
    (r: any) => { r.DATA[1].topics[0].publicationMode = 'pdf-only'; },
  ];
  for (const change of changes) {
    const bad = structuredClone(raw);
    change(bad, bad.DATA[9].topics.find((topic: any) => topic.id === 47));
    assert.throws(() => buildCatalog(bad), /publicationMode|pdf-only/);
    assert.throws(() => buildLearningCatalog(bad, registry, activation), /publicationMode|pdf-only/);
  }
});

test('the source validator rejects adding native activation to a PDF-only topic', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rat01-publication-'));
  try {
    const input = readFileSync(join(root, 'index.html'), 'utf8');
    const needle = '{ id:47, ic:"frac", g:"alg", t:"משוואות רציונליות", publicationMode:"pdf-only",';
    assert.equal(input.split(needle).length, 2);
    const file = join(dir, 'index.html');
    writeFileSync(file, input.replace(needle, needle.replace('ic:', 'x:"G9-T93", ic:')));
    assert.throws(() => execFileSync(process.execPath, [join(root, 'tools/validate.js'), file], { stdio: 'pipe' }),
      (error: any) => error.status === 1 && String(error.stdout).includes('cannot declare native/viewer/hint routing'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
