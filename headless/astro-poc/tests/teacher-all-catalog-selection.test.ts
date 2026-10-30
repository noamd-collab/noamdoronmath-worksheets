import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { expandToWholeQuestionKeys, groupWholeQuestions, mulberry32, pickWholeQuestions } from '../public/teachers/teacher-question-pick.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = JSON.parse(read('../public/teachers/teacher-catalog.json'));
const printer = read('../public/teachers/teacher-factoring-print.js');
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, name);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

const appFor = new Function('pool', 'scope', 'groupWholeQuestions', `
  let state = { ...scope, selected: [], blocks: [], scenario: 'first', style: 'scaffold', filter: 'all', pickMode: 'manual' };
  let history = [], aiPickPending = 0;
  const currentExercises = () => pool;
  const previewManifests = new Map();
  const status = { textContent: '' }, requests = [];
  const $ = id => id === 'ai-suggest-status' ? status : id === 'teacher-note' ? { value: 'בחר שאלות מסוף המאגר' } : { setAttribute() {}, selectedOptions: [] };
  const document = { title: 'Teacher picker' }, location = { pathname: '/teachers', search: '' };
  const render = () => {}, announce = () => {}, clearPreparedPrint = () => {}, paintAiPickButtons = () => {};
  const SCENARIOS = { first: { label: 'היכרות' } }, STYLES = { scaffold: { label: 'מדורגת' } };
  const QUESTION_ROLES = { basis: 'ביסוס', review: 'חזרה', creative: 'יצירתית' }, AI_QUESTION_COUNTS = [5, 10, 15];
  const ensureTeacherBotClient = async () => ({ postJson: async (path, payload) => {
    requests.push(payload);
    const chosen = currentQuestions().slice(-payload.teacher.count).map(group => group.keys[0]);
    return { source: 'classifier', model: 'test-model', exerciseIds: chosen, modelExerciseIds: chosen };
  } });
  ${['exKey', 'questionPreviewGroup', 'currentQuestions', 'keysOfQuestions', 'rolePlan', 'interleaveSheets', 'planOrder', 'smartQuestionPick', 'carriedKeys', 'selectionKey', 'snapshot', 'escapeHTML', 'questionCard', 'wholeQuestionPickCards', 'pickWithAi'].map(definition).join('\n')}
  return { groups: currentQuestions(), requests, status, state, pick: pickWithAi, cards: () => wholeQuestionPickCards(currentQuestions()) };
`);

test('every catalog grade/topic/level exposes all source questions and supports manual and AI 5/10/15', async (t) => {
  let sheetsChecked = 0, scopesChecked = 0, questionsChecked = 0;
  for (const grade of catalog.grades) {
    for (const topic of grade.topics) {
      const sources = topic.sheets.map((meta: { pdfId: string; mode: string; level: string }) => {
        assert.equal(meta.mode, 'exercise', `Missing question data for grade ${grade.grade}, topic ${topic.id}, level ${meta.level}`);
        const source = JSON.parse(read(`../public/teachers/sheets/${meta.pdfId}.json`));
        assert.ok(source.questions.length > 0, meta.pdfId);
        assert.equal(source.pdfId, meta.pdfId);
        assert.equal(source.level, meta.level);
        source.questions.forEach((question: { source: unknown }) => { question.source = source; });
        sheetsChecked += 1;
        return source;
      });
      const levels = ['all', ...new Set(sources.map((source: { level: string }) => source.level))];
      for (const level of levels) {
        const pool = sources.filter((source: { level: string }) => level === 'all' || source.level === level).flatMap((source: { questions: unknown[] }) => source.questions);
        const label = `${grade.grade}:${topic.id}:${level}`;
        const app = appFor(pool, { grade: String(grade.grade), topic: String(topic.id), level }, groupWholeQuestions);
        const html = app.cards();
        assert.equal((html.match(/data-whole-question=/g) || []).length, app.groups.length, label);
        assert.equal((html.match(/data-preview-key=/g) || []).length, app.groups.length, label);
        for (const group of app.groups) {
          assert.deepEqual(expandToWholeQuestionKeys(pool, [group.keys[0]]), group.keys, `Manual whole-question selection ${label}:${group.q}`);
        }
        for (const count of [5, 10, 15]) {
          const target = Math.min(count, app.groups.length);
          const local = pickWholeQuestions(pool, count, mulberry32(123));
          assert.equal(local.questionCount, target, label);
          assert.equal(new Set(local.keys).size, local.keys.length, label);
          const picked = await app.pick(count);
          assert.deepEqual(picked, app.groups.slice(-target).flatMap((group: { keys: string[] }) => group.keys), `AI whole questions ${label}, count ${count}`);
          assert.equal(new Set(picked).size, picked.length, label);
          const request = app.requests.at(-1);
          assert.equal(request.teacher.candidates.length, app.groups.length, label);
          assert.equal(request.teacher.count, target, label);
          assert.match(app.status.textContent, /עם AI\./, label);
          if (target < count) assert.match(app.status.textContent, new RegExp(`התבקשו ${count} שאלות.*זמינות רק ${target}`), label);
        }
        scopesChecked += 1;
        questionsChecked += app.groups.length;
      }
    }
  }
  assert.deepEqual(catalog.grades.map((grade: { grade: number }) => grade.grade), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  t.diagnostic(`Checked ${sheetsChecked} source sheets, ${scopesChecked} grade/topic/level scopes and ${questionsChecked} whole-question appearances.`);
});
