import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getTeacherGenerationMinimumQuestionCount, getTeacherGenerationTopic, getTeacherGenerationTopics,
  parseTeacherGenerationCurriculum, validateTeacherGenerationIntake, type TeacherGenerationIntake,
} from '../src/lib/teacherGenerationContract';

const json = readFileSync(new URL('../public/teachers/generation-curriculum.json', import.meta.url), 'utf8');
const curriculum = parseTeacherGenerationCurriculum(JSON.parse(json));
const valid = (changes: Record<string, unknown> = {}) => ({
  version: 1, gradeNumber: 3, topicId: 'ג10', level: 'b', lessonGoal: 'practice',
  lastLesson: 'סיימנו חילוק בתחום לוח הכפל', alreadyLearned: ['כפל בתחום לוח הכפל'],
  minutes: 45, questionCount: 12, explicitShortSheet: false, ...changes,
});
const check = (changes: Record<string, unknown> = {}) => validateTeacherGenerationIntake(valid(changes), curriculum);
function rejects(changes: Record<string, unknown>, code: string) {
  const result = check(changes);
  assert.equal(result.ok, false, JSON.stringify(changes));
  if (!result.ok) assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues));
}

test('pinned planning catalog covers grades1–9 and preserves Hebrew source ids and both grade9 tracks', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, index) => getTeacherGenerationTopics(index + 1, curriculum).length),
    [21, 26, 25, 30, 31, 27, 13, 17, 42]);
  const division = getTeacherGenerationTopic(3, 'ג10', curriculum)!;
  assert.equal(division.sourceTopicId, 'ג10');
  assert.equal(division.order, 57);
  assert.equal(division.title, 'חילוק והקשר ההפוך לכפל');
  assert.equal(division.skillVersion, '1.0.5-noam');
  const equation = getTeacherGenerationTopic(7, 'g7:equations', curriculum)!;
  assert.equal(equation.sourceTopicId, 'equations');
  assert.equal(equation.sourceTrack, 'ז');
  assert.equal(equation.order, 11, 'chronology comes from curriculum_tools, not the topic array/calendar');
  assert.equal(equation.skillVersion, '7.2.0-noam');
  assert.equal(getTeacherGenerationTopic(9, 'g9m:equations', curriculum)?.sourceTrack, 'ט_מצומצמת');
  assert.equal(getTeacherGenerationTopic(9, 'g9r:alg_technique', curriculum)?.sourceTrack, 'ט_רגילה');
  assert.equal(getTeacherGenerationTopic(4, 'ג10', curriculum), null);
  assert.deepEqual(getTeacherGenerationTopics(10, curriculum), []);
});

test('catalog retains provenance without asserting official months/hours or renderer support', () => {
  assert.equal(curriculum.officialCalendarVerified, false);
  assert.match(curriculum.sources.middle.basis, /לא קובץ של משרד החינוך/);
  assert.match(curriculum.provenanceNote, /אינו אימות/);
  assert.ok(!json.includes('"months"') && !json.includes('"hours"'));
  assert.ok(!json.includes('rendererSupported'));
  assert.ok(curriculum.elementaryForbiddenByGrade['א'].includes('כפל'));
  assert.ok(curriculum.middleExcludedByTrack.g9m.includes('פירוק לגורמים'));
  assert.ok(getTeacherGenerationTopic(7, 'g7:pythagoras', curriculum)!.allowedConcepts.includes('משפט פיתגורס'));
});

test('curriculum decoder rejects unsupported sources, malformed rows, duplicates, and calendar claims', () => {
  const mutations = [
    (x: any) => { x.version = 2; },
    (x: any) => { x.officialCalendarVerified = true; },
    (x: any) => { x.sources.elementary.skillVersion = 'unreviewed'; },
    (x: any) => { x.tracks.g9m.gradeNumber = 8; },
    (x: any) => { x.topics[1][0] = x.topics[0][0]; },
    (x: any) => { x.topics[0][4] = '<b>not an array</b>'; },
    (x: any) => { x.topics[0][0] = 'g10:equations'; },
  ];
  for (const mutate of mutations) { const candidate = JSON.parse(json); mutate(candidate); assert.throws(() => parseTeacherGenerationCurriculum(candidate)); }
  assert.throws(() => parseTeacherGenerationCurriculum(null));
  assert.ok(Object.isFrozen(curriculum.topics[0].allowedConcepts));
});

test('valid intake returns clean text and canonical values without guessing ids, grade, or levels', () => {
  const result = check({ lastLesson: '  סיימנו חילוק  ', classLabel: ' ג׳ 2 ', alreadyLearned: ['כפל', ' כפל '] });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lastLesson, 'סיימנו חילוק');
    assert.equal(result.value.classLabel, 'ג׳ 2');
    assert.deepEqual(result.value.alreadyLearned, ['כפל']);
    assert.equal(result.topic.topicId, result.value.topicId);
  }
  for (const topicId of ['ג99', ' ג10', 'ג10 ', 'g7:nonexistent', 'equations', 'ג\u202e10']) rejects({ topicId }, 'UNKNOWN_TOPIC');
  rejects({ gradeNumber: 4 }, 'GRADE_TOPIC_MISMATCH');
  rejects({ gradeNumber: '3' }, 'INVALID_GRADE');
  rejects({ gradeNumber: 10 }, 'INVALID_GRADE');
  rejects({ version: '1' }, 'UNSUPPORTED_VERSION');
  rejects({ level: 'c' }, 'INVALID_LEVEL');
  rejects({ ownerUserId: 'client-may-not-add-authority' }, 'UNKNOWN_FIELD');
});

test('volume floors require explicit short-sheet intent and never waive absolute bounds', () => {
  assert.deepEqual([1, 3, 5, 7].map(getTeacherGenerationMinimumQuestionCount), [8, 12, 14, 20]);
  rejects({ questionCount: 11 }, 'SHORT_SHEET_REQUIRES_EXPLICIT_REQUEST');
  assert.equal(check({ questionCount: 4, explicitShortSheet: true }).ok, true);
  rejects({ questionCount: 3, explicitShortSheet: true }, 'INVALID_QUESTION_COUNT');
  rejects({ questionCount: 31, explicitShortSheet: true }, 'INVALID_QUESTION_COUNT');
  rejects({ questionCount: 12.5 }, 'INVALID_QUESTION_COUNT');
  rejects({ explicitShortSheet: 'true' }, 'INVALID_SHORT_SHEET_CHOICE');
  rejects({ explicitShortSheet: undefined }, 'INVALID_SHORT_SHEET_CHOICE');
  assert.equal(check({ questionCount: 30, minutes: 120 }).ok, true);
  assert.equal(check({ minutes: 10 }).ok, true);
  rejects({ minutes: 9 }, 'INVALID_MINUTES');
  rejects({ minutes: 121 }, 'INVALID_MINUTES');
});

test('progress cannot reference a different grade/track or a future topic', () => {
  assert.equal(check({ taughtThroughTopicId: 'ג10' }).ok, true);
  rejects({ taughtThroughTopicId: 'ג11' }, 'FUTURE_PROGRESS_TOPIC');
  rejects({ taughtThroughTopicId: 'ד01' }, 'PROGRESS_TRACK_MISMATCH');
  rejects({ taughtThroughTopicId: 'not-found' }, 'UNKNOWN_PROGRESS_TOPIC');
  rejects({ taughtThroughTopicId: 'ג09' }, 'TOPIC_NOT_LEARNED');
  assert.equal(check({ taughtThroughTopicId: 'ג09', lessonGoal: 'introduce' }).ok, true);
  rejects({ gradeNumber: 9, topicId: 'g9m:equations', level: 'b', questionCount: 20,
    taughtThroughTopicId: 'g9r:alg_technique' }, 'PROGRESS_TRACK_MISMATCH');
});

test('free-text context cannot opt known future topics and forbidden concepts into the curriculum', () => {
  rejects({ alreadyLearned: ['ג11'] }, 'FUTURE_OR_OTHER_TRACK_TOPIC');
  rejects({ alreadyLearned: ['ו18'] }, 'FUTURE_OR_OTHER_TRACK_TOPIC');
  rejects({ gradeNumber: 1, topicId: 'א01', questionCount: 8, alreadyLearned: ['כפל'] }, 'FORBIDDEN_CONCEPT');
  rejects({ gradeNumber: 7, topicId: 'g7:angles', questionCount: 20,
    alreadyLearned: ['משפט פיתגורס'] }, 'FUTURE_CONCEPT');
  rejects({ gradeNumber: 9, topicId: 'g9m:equations', questionCount: 20,
    alreadyLearned: ['פירוק לגורמים'] }, 'FORBIDDEN_CONCEPT');
  assert.equal(check({ gradeNumber: 8, topicId: 'g8:pythagoras', questionCount: 20,
    alreadyLearned: ['משפט פיתגורס'] }).ok, true, 'earlier-grade knowledge does not become future merely because a topic recurs');
});

test('grade9 levels must match the explicitly selected track instead of silently switching it', () => {
  rejects({ gradeNumber: 9, topicId: 'g9r:alg_technique', level: 'b', questionCount: 20 }, 'LEVEL_TRACK_MISMATCH');
  rejects({ gradeNumber: 9, topicId: 'g9m:equations', level: 'e', questionCount: 20 }, 'LEVEL_TRACK_MISMATCH');
  assert.equal(check({ gradeNumber: 9, topicId: 'g9r:alg_technique', level: 'a', questionCount: 20 }).ok, true);
  assert.equal(check({ gradeNumber: 9, topicId: 'g9m:equations', level: 'b', questionCount: 20 }).ok, true);
});

test('context fields are bounded and class label excludes contact details and display controls', () => {
  rejects({ lastLesson: ' ' }, 'INVALID_LAST_LESSON');
  rejects({ lastLesson: 'א'.repeat(1001) }, 'INVALID_LAST_LESSON');
  rejects({ alreadyLearned: [null] }, 'INVALID_LEARNED_CONTEXT');
  assert.equal(check({ alreadyLearned: ['א'.repeat(120)] }).ok, true);
  rejects({ alreadyLearned: ['א'.repeat(121)] }, 'INVALID_LEARNED_CONTEXT');
  rejects({ alreadyLearned: Array(41).fill('חיבור') }, 'INVALID_LEARNED_CONTEXT');
  for (const classLabel of ['student@example.test', '050-1234567', 'ג\u202e2', '']) rejects({ classLabel }, 'INVALID_CLASS_LABEL');
  assert.equal(check({ classLabel: undefined, alreadyLearned: [] }).ok, true);
  assert.equal(validateTeacherGenerationIntake(null, curriculum).ok, false);
});

test('server contract does not bundle the public curriculum or invoke filesystem/process APIs', () => {
  const source = readFileSync(new URL('../src/lib/teacherGenerationContract.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import[\s\S]*?from\s+['"][^'"]*generation-curriculum\.json/);
  assert.doesNotMatch(source, /(?:from\s+['"]node:|process\.|require\()/);
  const payload: TeacherGenerationIntake = valid() as TeacherGenerationIntake;
  assert.equal(validateTeacherGenerationIntake(payload, curriculum).ok, true);
});
