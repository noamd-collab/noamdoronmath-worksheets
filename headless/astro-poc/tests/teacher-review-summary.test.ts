import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { buildTeacherReview, renderTeacherPageCount, renderTeacherReview } from '../public/teachers/teacher-review-summary.js';

type Source = { pdfId: string; gradeLabel: string; topic: string; levelLabel: string };
const source = (pdfId: string, gradeLabel = 'כיתה ט׳', levelLabel = 'רמה א׳', topic = 'אי־שוויונות') => ({ pdfId, gradeLabel, levelLabel, topic });
const question = (source: Source, id: string, q: number, part = '', page = 1) => ({ id, q, part, page, source });
const describe = (source: { [key: string]: unknown }) => ({ grade: source.gradeLabel, topic: source.topic, level: source.levelLabel });

test('saved and current sections retain their own source scopes, actual levels and print order', () => {
  const savedB = source('saved-b', 'כיתה ז׳', 'רמה ב׳', 'משולשים');
  const savedC = source('saved-c', 'כיתה ז׳', 'מצוינות', 'משולשים');
  const current = source('current-a');
  const review = buildTeacherReview({
    sections: [
      { title: 'נושא שמור', kindLabel: 'חזרה על חומר', questions: [question(savedB, '1א', 1, 'א'), question(savedB, '1ב', 1, 'ב'), question(savedC, '1', 1)] },
      { title: 'נושא נוכחי', kindLabel: 'מבחן', questions: [question(current, '2ג', 2), question(current, '3', 3)] },
    ], scenario: 'תרגול וביסוס', style: 'משולבת', note: 'הוראות לכיתה',
  }, describe);
  assert.deepEqual(review, {
    grades: ['כיתה ז׳', 'כיתה ט׳'], questionCount: 4, partCount: 3,
    sections: [
      { title: 'נושא שמור', kindLabel: 'חזרה על חומר', grades: ['כיתה ז׳'], levels: ['רמה ב׳', 'מצוינות'], questionCount: 2, partCount: 2 },
      { title: 'נושא נוכחי', kindLabel: 'מבחן', grades: ['כיתה ט׳'], levels: ['רמה א׳'], questionCount: 2, partCount: 1 },
    ], scenario: 'תרגול וביסוס', style: 'משולבת', note: 'הוראות לכיתה',
  });
});

test('duplicate legacy regions and duplicate labels do not inflate subparts of a whole question', () => {
  const original = source('legacy');
  const review = buildTeacherReview({ sections: [{ kindLabel: 'חזרה על חומר', questions: [
    question(original, '13א', 13, 'א', 1), question(original, '13א', 13, 'א', 2),
    question(original, '13א-region', 13, 'א', 2), question(original, '13ב', 13, '', 2),
    question(original, '14', 14),
  ] }] }, describe);
  assert.equal(review.questionCount, 2);
  assert.equal(review.partCount, 2);
  assert.equal(review.sections[0].title, original.topic, 'An untitled section uses its actual source topic');
});

test('equal question numbers in different PDFs remain separate whole questions and part scopes', () => {
  const review = buildTeacherReview({ sections: [{ questions: [
    question(source('a'), '1א', 1, 'א'), question(source('b'), '1א', 1, 'א'),
    question(source('a'), '2א', 2, 'א'),
  ] }] }, describe);
  assert.equal(review.questionCount, 3);
  assert.equal(review.partCount, 3);
});

test('separate printed sections are counted separately without global deduplication', () => {
  const shared = source('shared');
  const questions = [question(shared, '1א', 1, 'א'), question(shared, '1ב', 1, 'ב')];
  const review = buildTeacherReview({ sections: [
    { title: 'ראשון', kindLabel: 'חזרה על חומר', questions },
    { title: 'שני', kindLabel: 'מבחן', questions },
  ] }, describe);
  assert.deepEqual(review.sections.map(section => section.title), ['ראשון', 'שני']);
  assert.deepEqual(review.sections.map(section => section.questionCount), [1, 1]);
  assert.equal(review.questionCount, 2);
  assert.equal(review.partCount, 4);
});

test('the resolved pipeline contract excludes saved choices from current before building the summary', () => {
  const sheet = source('same-pdf');
  const saved = question(sheet, '1', 1);
  const current = question(sheet, '2', 2);
  const review = buildTeacherReview({ sections: [
    { title: 'שמור', questions: [saved] },
    { title: 'נוכחי', questions: [current] },
  ] }, describe);
  assert.equal(review.questionCount, 2);
  assert.equal(review.partCount, 0, 'Standalone questions have no separately labeled subparts');
  assert.deepEqual(review.sections.map(section => section.questionCount), [1, 1]);
});

test('empty sections are omitted without changing the order of the remaining sections', () => {
  const sheet = source('one');
  const review = buildTeacherReview({ sections: [
    { title: 'ריק ראשון', questions: [] }, { title: 'ב', questions: [question(sheet, '2', 2)] },
    { title: 'ריק באמצע', questions: [] }, { title: 'א', questions: [question(sheet, '1', 1)] },
  ] }, describe);
  assert.deepEqual(review.sections.map(section => section.title), ['ב', 'א']);
  assert.equal(review.questionCount, 2);
  assert.deepEqual(buildTeacherReview({ sections: [] }, describe), {
    grades: [], sections: [], questionCount: 0, partCount: 0, scenario: '', style: '', note: '',
  });
});

test('the printed note retains all 600 characters and interior whitespace instead of the AI 400-character truncation', () => {
  const note = 'א'.repeat(450) + '\n  ' + 'ב'.repeat(147);
  assert.equal(note.length, 600);
  const review = buildTeacherReview({ sections: [], note: ` \n${note}\n  ` }, describe);
  assert.equal(review.note, note);
  assert.equal(review.note.length, 600);
  assert.ok(review.note.includes('\n  '));
});

test('a completed review is an independent snapshot of source labels, input choices and note', () => {
  const sheet = source('snapshot');
  const input = { sections: [{ title: 'מקורי', kindLabel: 'מבחן', questions: [question(sheet, '1א', 1, 'א')] }],
    scenario: 'תרגול וביסוס', style: 'משולבת', note: 'הערה\n  בשתי שורות' };
  const review = buildTeacherReview(input, describe);
  const before = structuredClone(review);
  sheet.gradeLabel = 'כיתה אחרת';
  sheet.levelLabel = 'רמה אחרת';
  input.sections[0].title = 'שונה';
  input.sections[0].questions.push(question(sheet, '2ב', 2, 'ב'));
  input.scenario = 'מטרה אחרת';
  input.style = 'גישה אחרת';
  input.note = 'הוחלף';
  assert.deepEqual(review, before);
});

test('semantic rendering escapes titles and notes, preserves their newlines, and does not duplicate content on update', () => {
  const { document } = parseHTML('<html><body><div id="summary"></div></body></html>');
  const container = document.getElementById('summary')!;
  const title = '<img src=x onerror=alert(1)> & נושא';
  const note = '<script>alert(1)</script>\n  שורה שנייה';
  const review = buildTeacherReview({ sections: [{ title, kindLabel: 'חזרה על חומר', questions: [question(source('escaped'), '1', 1)] }],
    scenario: 'תרגול וביסוס', style: 'משולבת', note }, describe);
  renderTeacherReview(container, review);
  assert.equal(container.querySelector('.teacher-review-section-title')?.textContent, title);
  assert.equal(container.querySelector('.teacher-review-note')?.textContent, note);
  assert.equal(container.querySelector('script, img'), null);
  assert.equal(container.querySelectorAll('dl dt').length, 5);
  assert.equal(container.querySelectorAll('dl dd').length, 5);
  assert.equal(container.querySelectorAll('ol > li').length, 1);
  assert.match(container.textContent!, /ללא סעיפים נפרדים/);
  assert.match(container.textContent!, /ההוראות שיודפסו/);
  assert.equal(container.querySelector('button, input, select, textarea, a'), null, 'The renderer does not add navigation or editable controls');
  renderTeacherReview(container, { ...review, note: '' });
  assert.equal(container.querySelectorAll('.teacher-review-facts').length, 1);
  assert.equal(container.querySelectorAll('.teacher-review-note').length, 1);
  assert.equal(container.querySelector('.teacher-review-note')?.textContent, 'לא נוספו הוראות לתלמיד');
});

test('the page count describes prepared question and answer pages without counting preview copies or notes twice', () => {
  const { document } = parseHTML(`<html><body><p id="count" hidden></p>
    <div id="preview"><figure class="crop-sheet" data-answers="0"><canvas></canvas></figure></div>
    <div id="print-area"><div class="section">
      <figure class="crop-sheet" data-sheet-page="1" data-answers="0"><canvas></canvas></figure>
      <figure class="crop-sheet" data-sheet-page="2" data-answers="0"><canvas></canvas></figure>
    </div><figure class="crop-sheet has-teacher-note" data-sheet-page="3" data-answers="1">
      <canvas></canvas><aside class="teacher-print-note">הוראות לתלמיד</aside>
    </figure></div></body></html>`);
  const count = document.getElementById('count')!, area = document.getElementById('print-area')!;
  const prepared = area.innerHTML;
  renderTeacherPageCount(count, area);
  assert.equal(count.hidden, false);
  assert.equal(count.textContent, '2 עמודי שאלות + עמוד תשובות אחד — 3 עמודים בסך הכול');
  assert.equal(area.innerHTML, prepared, 'Counting does not rewrite the prepared worksheet');
});

test('marked source pages and nested answer pages retain separate actual counts', () => {
  const { document } = parseHTML(`<html><body><p id="count"></p><div id="print-area">
    <figure class="source-sheet"><div data-page="4"><canvas></canvas></div><figcaption>עמוד 4 מתוך 27</figcaption></figure>
    <figure class="source-sheet"><div data-page="9"><canvas></canvas></div></figure>
    <div class="marked-answers"><figure class="crop-sheet" data-answers="1"><canvas></canvas></figure>
      <figure class="crop-sheet" data-answers="1"><canvas></canvas></figure></div>
    </div></body></html>`);
  const count = document.getElementById('count')!, area = document.getElementById('print-area')!;
  renderTeacherPageCount(count, area);
  assert.equal(count.textContent, '2 עמודי מקור + 2 עמודי תשובות — 4 עמודים בסך הכול');
});

test('single-page labels are singular and unprepared or invalidated output clears the previous count', () => {
  const { document } = parseHTML('<html><body><p id="count"></p><div id="print-area"></div></body></html>');
  const count = document.getElementById('count')!, area = document.getElementById('print-area')!;
  for (const [page, expected] of [
    ['<figure class="source-sheet"><canvas></canvas></figure>', 'עמוד מקור אחד'],
    ['<figure class="crop-sheet" data-answers="0"><canvas></canvas></figure>', 'עמוד שאלות אחד'],
    ['<figure class="crop-sheet" data-answers="1"><canvas></canvas></figure>', 'עמוד תשובות אחד'],
  ]) {
    area.innerHTML = page;
    renderTeacherPageCount(count, area);
    assert.equal(count.hidden, false);
    assert.equal(count.textContent, `${expected} — עמוד אחד בסך הכול`);
  }
  renderTeacherPageCount(count);
  assert.equal(count.hidden, true);
  assert.equal(count.textContent, '');
  renderTeacherPageCount(count, area);
  area.innerHTML = '<p class="print-unprepared">יש להכין את הדף</p><canvas></canvas>';
  renderTeacherPageCount(count, area);
  assert.equal(count.hidden, true, 'An error message or unrelated canvas is not a prepared page');
  assert.equal(count.textContent, '');
});

test('the public review module is identical to its demo copy', () => {
  assert.equal(readFileSync(new URL('../public/teachers/teacher-review-summary.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../../../demos/teacher-review-summary.js', import.meta.url), 'utf8'));
});
