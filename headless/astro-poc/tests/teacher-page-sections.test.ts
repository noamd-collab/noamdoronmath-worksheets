import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MORE_TOPIC_QUESTION,
  SECTION_KINDS,
  TEST_TOTAL_POINTS,
  needsSectionHeadings,
  pointsLabel,
  scoreLabel,
  sectionKind,
  sectionTitle,
  shouldAskMoreTopic,
  testPoints,
} from '../public/teachers/teacher-page-sections.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../public/teachers/index.html');
const printer = read('../public/teachers/teacher-factoring-print.js');
const sections = read('../public/teachers/teacher-page-sections.js');

const q = (n: number) => n;
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);

describe('teacher page sections', () => {
  it('asks exactly the follow-up question after the teacher ticks a question', () => {
    assert.equal(MORE_TOPIC_QUESTION, 'האם תרצה לבחור עוד נושא לדף שלך?');
    assert.match(html, /<p id="more-topic-q">האם תרצה לבחור עוד נושא לדף שלך\?<\/p>/);
    assert.match(html, /id="more-topic-yes"[^>]*>כן, בוחרים נושא נוסף<\/button>/);
    assert.match(html, /id="more-topic-no"[^>]*>לא, ממשיכים<\/button>/);
    assert.equal(shouldAskMoreTopic(0, false), false);
    assert.equal(shouldAskMoreTopic(1, false), true);
    assert.equal(shouldAskMoreTopic(17, false), true);
    assert.equal(shouldAskMoreTopic(3, true), false);
  });

  it('names the two section types as Noam asked and never as a test without points', () => {
    assert.equal(SECTION_KINDS.test.label, 'קטע מבחן');
    assert.equal(SECTION_KINDS.review.label, 'בניית דף חזרה על חומר');
    assert.match(html, /id="section-kind-test"[^>]*data-section-kind="test"[^>]*>קטע מבחן<\/button>/);
    assert.match(html, /id="section-kind-review"[^>]*data-section-kind="review"[^>]*>בניית דף חזרה על חומר<\/button>/);
    for (const text of [html, printer, sections]) assert.equal(text.includes('מבחן בלי ניקוד'), false);
    assert.equal(sectionKind('test'), 'test');
    assert.equal(sectionKind('review'), 'review');
    assert.equal(sectionKind(undefined), 'review');
  });

  it('spreads 100 points over every test question on a mixed page and none over review questions', () => {
    const blocks = [
      { kind: 'test', questions: q(2) },
      { kind: 'review', questions: q(2) },
      { kind: 'test', questions: q(5) },
      { kind: 'review', questions: q(10) },
    ];
    const points = testPoints(blocks);
    assert.equal(points.length, 4);
    assert.deepEqual(points[1], []);
    assert.deepEqual(points[3], []);
    assert.equal(points[0].length, 2);
    assert.equal(points[2].length, 5);
    assert.equal(sum([...points[0], ...points[2]]), TEST_TOTAL_POINTS);
    assert.deepEqual([...points[0], ...points[2]], [15, 15, 14, 14, 14, 14, 14]);
    assert.equal(sum(testPoints([{ kind: 'test', questions: q(17) }])[0]), 100);
    assert.equal(sum(testPoints([{ kind: 'test', questions: q(3) }])[0]), 100);
  });

  it('adds section headings when the page has a test section or more than one topic', () => {
    assert.equal(needsSectionHeadings([{ kind: 'review', questions: q(4) }]), false);
    assert.equal(needsSectionHeadings([{ kind: 'test', questions: q(4) }]), true);
    assert.equal(needsSectionHeadings([{ kind: 'review', questions: q(1) }, { kind: 'review', questions: q(1) }]), true);
    assert.equal(sectionTitle('test', 'פירוק לגורמים'), 'מבחן · פירוק לגורמים');
    assert.equal(sectionTitle('review', 'חוק הפילוג המורחב'), 'חזרה על חומר · חוק הפילוג המורחב');
    assert.equal(pointsLabel(2, 33), 'שאלה 2 · 33 נק׳');
    assert.equal(scoreLabel(100), 'ציון: ______ מתוך 100');
  });

  it('prints a test section with date, class, score and points, and a review section with questions only', () => {
    assert.match(printer, /function paintSectionHeading\(ctx, slice, x0, drawW, y, fit\)/);
    assert.match(printer, /'תאריך:'/);
    assert.match(printer, /'כיתה:'/);
    assert.match(printer, /scoreLabel\(/);
    assert.match(printer, /pointsLabel\(/);
    assert.match(printer, /testPoints\(/);
    assert.match(printer, /'שם:'/);
  });

  it('keeps earlier topics on the same page and lets each one be a test or review section', () => {
    assert.match(printer, /function addAnotherTopic\(\)/);
    assert.match(printer, /state\.blocks\.push\(/);
    assert.match(printer, /state\.wizard = 'topic'/);
    assert.match(printer, /data-block-kind/);
    assert.match(html, /id="page-blocks"/);
    assert.match(printer, /data-block-remove/);
    assert.match(printer, /function carriedKeys\(\)/);
    assert.match(printer, /השאלה כבר בדף, בנושא שנשמר קודם\./);
    assert.match(printer, /const saved = carriedKeys\(\);\s*state\.selected = state\.selected\.filter\(\(key\) => !saved\.has\(key\)\);/);
    assert.match(printer, /\.filter\(\(key\) => !saved\.has\(key\)\);\s*state\.pickNote = '';/);
  });

  it('keeps the new page-builder styles out of <head>', () => {
    const [head, body] = html.split('</head>');
    for (const rule of ['.section-kind-group{', '.more-topic{', '.page-block{', '.q-preview{']) {
      assert.equal(head.includes(rule), false, rule);
      assert.ok(body.includes(rule), rule);
    }
  });

  it('keeps the demo copy of the sections module in step with the site', () => {
    assert.equal(read('../../../demos/teacher-page-sections.js'), sections);
  });
});
