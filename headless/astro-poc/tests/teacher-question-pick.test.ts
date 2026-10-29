import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  QUESTION_COUNTS,
  expandToWholeQuestionKeys,
  groupWholeQuestions,
  mulberry32,
  pickWholeQuestions,
  shortfallNote,
} from '../public/teachers/teacher-question-pick.js';

const source = JSON.parse(readFileSync(new URL('../public/teachers/factoring-grade-9-a-source.json', import.meta.url), 'utf8'));

function withSource(questions: { id: string; q?: number; part?: string; page?: number }[], pdfId = source.pdfId) {
  return questions.map((question) => ({ ...question, source: { pdfId } }));
}

function questionIds(keys: string[]) {
  return keys.map((key) => key.split(':').slice(2).join(':'));
}

function assertWhole(pool: { id: string; q?: number; source: { pdfId: string } }[], keys: string[]) {
  const picked = new Set(keys);
  const groups = groupWholeQuestions(pool);
  for (const group of groups) {
    const groupKeys = group.questions.map((question) => `ex:${question.source.pdfId}:${question.id}`);
    const hits = groupKeys.filter((key) => picked.has(key));
    assert.ok(hits.length === 0 || hits.length === groupKeys.length, group.key);
  }
}

describe('whole-question picker', () => {
  const pool = withSource(source.questions);

  it('offers counts 5, 15 and 20', () => {
    assert.deepEqual(QUESTION_COUNTS, [5, 10, 15, 20]);
  });

  it('picks that many whole questions and keeps every sub-part', () => {
    for (const count of QUESTION_COUNTS) {
      const result = pickWholeQuestions(pool, count, mulberry32(7));
      assert.equal(result.questionCount, count);
      assert.equal(result.shortfall, false);
      assert.equal(result.note, '');
      assert.equal(groupWholeQuestions(pool.filter((question) => result.keys.includes(`ex:${source.pdfId}:${question.id}`))).length, count);
      assertWhole(pool, result.keys);
      for (const id of questionIds(result.keys)) {
        const question = source.questions.find((item: { id: string }) => item.id === id);
        const mates = source.questions.filter((item: { q: number }) => item.q === question.q);
        for (const mate of mates) assert.ok(result.keys.includes(`ex:${source.pdfId}:${mate.id}`), mate.id);
      }
    }
  });

  it('changes the set when the seed changes and does not always start at question 1', () => {
    const first = pickWholeQuestions(pool, 5, mulberry32(1)).keys.join('\n');
    const second = pickWholeQuestions(pool, 5, mulberry32(2)).keys.join('\n');
    assert.notEqual(first, second);
    const pages = new Set<number>();
    for (const key of pickWholeQuestions(pool, 5, mulberry32(3)).keys) {
      const id = key.split(':').slice(2).join(':');
      pages.add(source.questions.find((item: { id: string }) => item.id === id).page);
    }
    assert.ok(pages.size > 1, [...pages].join(','));
    const lead = questionIds(pickWholeQuestions(pool, 5, mulberry32(11)).keys);
    assert.equal(lead.every((id) => id.startsWith('1')), false);
  });

  it('spreads a small request across pages', () => {
    const spread = withSource([
      { id: '1א', q: 1, part: 'א', page: 1 },
      { id: '1ב', q: 1, part: 'ב', page: 1 },
      { id: '2א', q: 2, part: 'א', page: 2 },
      { id: '3א', q: 3, part: 'א', page: 3 },
    ]);
    const result = pickWholeQuestions(spread, 3, mulberry32(4));
    assert.equal(result.questionCount, 3);
    assert.deepEqual(questionIds(result.keys).sort(), ['1א', '1ב', '2א', '3א']);
    const pages = new Set(result.keys.map((key) => spread.find((question) => key.endsWith(':' + question.id))!.page));
    assert.equal(pages.size, 3);
  });

  it('never returns a partial question', () => {
    const partial = withSource([
      { id: '1א', q: 1, part: 'א', page: 1 },
      { id: '1ב', q: 1, part: 'ב', page: 1 },
      { id: '2א', q: 2, part: 'א', page: 2 },
    ]);
    for (let seed = 1; seed <= 12; seed += 1) {
      const result = pickWholeQuestions(partial, 1, mulberry32(seed));
      const ids = questionIds(result.keys).sort();
      assert.ok(ids.join(',') === '1א,1ב' || ids.join(',') === '2א', ids.join(','));
    }
  });

  it('uses every available question and explains the shortfall in Hebrew', () => {
    const few = withSource([
      { id: '4א', q: 4, part: 'א', page: 1 },
      { id: '8א', q: 8, part: 'א', page: 2 },
      { id: '9א', q: 9, part: 'א', page: 3 },
    ]);
    const result = pickWholeQuestions(few, 20, mulberry32(9));
    assert.equal(result.questionCount, 3);
    assert.equal(result.shortfall, true);
    assert.equal(result.note, shortfallNote(3));
    assert.match(result.note, /נבחרו כל 3 השאלות הזמינות/);
    assert.deepEqual(questionIds(result.keys).sort(), ['4א', '8א', '9א']);
  });

  it('expands a single sub-part to the whole question', () => {
    const keys = expandToWholeQuestionKeys(pool, [`ex:${source.pdfId}:1א`]);
    assert.deepEqual(questionIds(keys), source.questions.filter((item: { q: number }) => item.q === 1).map((item: { id: string }) => item.id));
  });
});
