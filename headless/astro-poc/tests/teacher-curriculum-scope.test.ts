import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CurriculumScopeError, loadTeacherCurriculumScope, validateTeacherCurriculumScope } from '../src/lib/teacherCurriculumScope';

const path = fileURLToPath(new URL('../public/teachers/generation-curriculum.json', import.meta.url));
const bytes = readFileSync(path), pin = '57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b';
const catalog = await loadTeacherCurriculumScope(path, pin, exactPath => readFileSync(exactPath));
const boundary = (topicId = 'g8:congruence', conceptIds: unknown[] = [`${topicId}#0`]) =>
  ({ version: 1, kind: 'curriculum_scope', curriculumSha256: pin, conceptIds });
const hasCode = (code: string) => (error: unknown) => error instanceof CurriculumScopeError && error.code === code;
const resolve = (grade: unknown, topic: unknown, value: unknown) => validateTeacherCurriculumScope(catalog, grade, topic, value);

test('all232 pinned topics expose selected source concepts and separate grade9 levels without enabling renderers', () => {
  const counts = Array(9).fill(0);
  let concepts = 0;
  for (const topic of catalog.topics) {
    counts[topic.gradeNumber - 1]++;
    const ids = topic.concepts.map(row => row.id), result = resolve(topic.gradeNumber, topic.topicId, boundary(topic.topicId, [...ids].reverse()));
    assert.deepEqual(result.boundary.conceptIds, ids, 'selection is canonicalized to source order');
    assert.deepEqual(result.selectedConcepts.map(row => row.id), ids);
    assert.deepEqual(result.excludedConcepts, []);
    assert.equal(result.topic.sourceTrack, topic.sourceTrack);
    assert.equal(result.source.skillVersion, topic.skillVersion);
    assert.equal(result.curriculum.officialCalendarVerified, false);
    assert.equal('enabled' in result, false);
    assert.equal('e2eVerified' in result, false);
    assert.deepEqual(result.levels, topic.topicId.startsWith('g9m:') ? ['b'] : topic.topicId.startsWith('g9r:') ? ['a', 'e'] : ['b', 'a', 'e']);
    concepts += topic.concepts.length;
  }
  assert.deepEqual(counts, [21, 26, 25, 30, 31, 27, 13, 17, 42]);
  assert.equal(concepts, 879);
});

test('grade8 scope derives text from the pinned catalog and returns independent copies', () => {
  const scope = resolve(8, 'g8:congruence', boundary());
  assert.deepEqual(scope.selectedConcepts, [{ id: 'g8:congruence#0', text: 'חפיפה' }]);
  assert.equal(scope.excludedConcepts.length, 19);
  scope.selectedConcepts[0].text = 'cannot rewrite source';
  scope.source.files['SKILL.md'] = 'cannot rewrite pin';
  assert.equal(resolve(8, 'g8:congruence', boundary()).selectedConcepts[0].text, 'חפיפה');
  assert.equal(resolve(8, 'g8:congruence', boundary()).source.files['SKILL.md'].length, 64);
  assert.ok(Object.isFrozen(catalog.topics[0].concepts[0]));
  assert.match(scope.source.basis, /לא קובץ של משרד החינוך/);
});

const invalidCases: { grade: unknown; topic: unknown; boundary: unknown; code: string }[] = [
  { grade: true, topic: 'g8:congruence', boundary: boundary(), code: 'INVALID_GRADE' },
  { grade: '8', topic: 'g8:congruence', boundary: boundary(), code: 'INVALID_GRADE' },
  { grade: 10, topic: 'g8:congruence', boundary: boundary(), code: 'INVALID_GRADE' },
  { grade: 7, topic: 'g8:congruence', boundary: boundary(), code: 'GRADE_TOPIC_MISMATCH' },
  { grade: 8, topic: 'congruence', boundary: boundary(), code: 'UNKNOWN_TOPIC' },
  ...[
    { boundary: null, code: 'INVALID_CURRICULUM_SCOPE' },
    { boundary: { ...boundary(), version: true }, code: 'INVALID_CURRICULUM_SCOPE' },
    { boundary: { ...boundary(), conceptText: 'client assertion' }, code: 'INVALID_CURRICULUM_SCOPE' },
    { boundary: { ...boundary(), kind: 'linear_equations' }, code: 'INVALID_CURRICULUM_SCOPE' },
    { boundary: { ...boundary(), curriculumSha256: '0'.repeat(64) }, code: 'CURRICULUM_SCOPE_HASH_MISMATCH' },
    { boundary: boundary('g8:congruence', []), code: 'INVALID_CONCEPT_SELECTION' },
    { boundary: boundary('g8:congruence', ['g8:congruence#0', 'g8:congruence#0']), code: 'INVALID_CONCEPT_SELECTION' },
    { boundary: boundary('g8:congruence', [0]), code: 'INVALID_CONCEPT_SELECTION' },
    { boundary: boundary('g8:congruence', ['g8:congruence#01']), code: 'UNKNOWN_CONCEPT' },
    { boundary: boundary('g8:congruence', ['g8:congruence#999']), code: 'UNKNOWN_CONCEPT' },
    { boundary: boundary('g8:congruence', ['g7:equations#0']), code: 'UNKNOWN_CONCEPT' },
  ].map(value => ({ grade: 8, topic: 'g8:congruence', ...value })),
  { grade: 9, topic: 'g9m:equations', boundary: boundary('g9m:equations', ['g9r:alg_technique#0']), code: 'UNKNOWN_CONCEPT' },
];

test('exact scope fields, grade, track, hash and concept IDs reject untrusted additions', () => {
  for (const value of invalidCases) assert.throws(() => resolve(value.grade, value.topic, value.boundary), hasCode(value.code));
});

test('loader reads one exact trusted path and rejects hash drift, read errors and oversized assets', async () => {
  const reads: string[] = [];
  await loadTeacherCurriculumScope(path, pin, exactPath => { reads.push(exactPath); return bytes; });
  assert.deepEqual(reads, [path]);
  await assert.rejects(loadTeacherCurriculumScope(path, 'bad', () => { assert.fail('bad pin cannot trigger read'); }), hasCode('INVALID_CURRICULUM_PIN'));
  await assert.rejects(loadTeacherCurriculumScope(path, pin + '\n', () => bytes), hasCode('INVALID_CURRICULUM_PIN'));
  await assert.rejects(loadTeacherCurriculumScope(path, '0'.repeat(64), () => bytes), hasCode('CURRICULUM_HASH_MISMATCH'));
  await assert.rejects(loadTeacherCurriculumScope(path, pin, () => { throw new Error('not found'); }), hasCode('CURRICULUM_READ_FAILED'));
  await assert.rejects(loadTeacherCurriculumScope(path, pin, () => new Uint8Array(100_001)), hasCode('CURRICULUM_SIZE'));
  await assert.rejects(loadTeacherCurriculumScope(path, pin, () => Buffer.concat([bytes, Buffer.from(' ')])), hasCode('CURRICULUM_HASH_MISMATCH'));
});

test('a newly pinned malformed catalog cannot redefine scope structure or grade9 track', async () => {
  const mutations = [
    (value: any) => { value.officialCalendarVerified = true; },
    (value: any) => { value.version = true; },
    (value: any) => { value.topics.pop(); },
    (value: any) => { value.topics[0][4] = []; },
    (value: any) => { value.topics[0][0] = 'g8:missing#0'; },
    (value: any) => { value.topics[0][0] = 'א01\n'; },
    (value: any) => { value.topics[1][0] = value.topics[0][0]; },
    (value: any) => { value.tracks.g9m.gradeNumber = 8; },
    (value: any) => { value.sources.elementary.skillVersion = 'unreviewed'; },
  ];
  for (const mutate of mutations) {
    const data = JSON.parse(bytes.toString('utf8')); mutate(data);
    const changed = Buffer.from(JSON.stringify(data)), digest = createHash('sha256').update(changed).digest('hex');
    await assert.rejects(loadTeacherCurriculumScope(path, digest, () => changed), hasCode('INVALID_CURRICULUM'));
  }
});

test('Python and TypeScript resolve identical scope fixtures for every topic and reject the same invalid input', () => {
  const fixtures = catalog.topics.flatMap(topic => [
    { grade: topic.gradeNumber, topic: topic.topicId, boundary: boundary(topic.topicId, topic.concepts.map(row => row.id).reverse()) },
    { grade: topic.gradeNumber, topic: topic.topicId, boundary: boundary(topic.topicId, [topic.concepts.at(-1)!.id]) },
  ]);
  const code = `
import json, sys
sys.path.insert(0, sys.argv[1])
from curriculum_scope import load_curriculum_scope, validate_curriculum_scope, CurriculumScopeError
catalog = load_curriculum_scope(sys.argv[2], sys.argv[3])
data = json.load(sys.stdin)
out = []
for case in data:
    try:
        out.append({'ok': validate_curriculum_scope(catalog, case['grade'], case['topic'], case['boundary'])})
    except CurriculumScopeError as error:
        out.append({'error': error.code})
print(json.dumps(out, ensure_ascii=False))
`;
  const pythonRoot = fileURLToPath(new URL('../../../tools/teacher-generation/', import.meta.url));
  const cases = [...fixtures, ...invalidCases];
  const result = spawnSync('python3', ['-I', '-c', code, pythonRoot, path, pin], { input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const expected = cases.map(value => {
    try { return { ok: resolve(value.grade, value.topic, value.boundary) }; }
    catch (error) { assert.ok(error instanceof CurriculumScopeError); return { error: error.code }; }
  });
  assert.deepEqual(JSON.parse(result.stdout), expected);
});
