// @ts-check
import { groupWholeQuestions } from './teacher-question-pick.js';

/** @typedef {{ pdfId?: string, topic?: string, [key: string]: unknown }} ReviewSource */
/** @typedef {{ id?: string | number, q?: string | number, part?: string, source?: ReviewSource, [key: string]: unknown }} ReviewQuestion */
/** @typedef {{ title?: string, kindLabel?: string, questions: ReviewQuestion[] }} ReviewInputSection */
/** @typedef {{ title: string, kindLabel: string, grades: string[], levels: string[], questionCount: number, partCount: number }} ReviewSection */
/** @typedef {{ grades: string[], questionCount: number, partCount: number, sections: ReviewSection[], scenario: string, style: string, note: string }} TeacherReview */

/** @param {unknown} value */
function text(value) {
  return value == null ? '' : String(value);
}

/** @param {string[]} values */
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Snapshot the resolved print sections. The caller has already excluded current
 * choices present in saved sections and supplied their actual print order.
 * @param {{ sections: ReviewInputSection[], scenario?: string, style?: string, note?: string }} input
 * @param {(source: ReviewSource) => { grade?: unknown, topic?: unknown, level?: unknown }} describeSource
 * @returns {TeacherReview}
 */
export function buildTeacherReview({ sections, scenario, style, note }, describeSource) {
  /** @type {ReviewSection[]} */
  const reviewed = [];
  for (const section of sections) {
    const questions = section.questions.filter(Boolean);
    if (!questions.length) continue;
    const descriptions = questions.map(question => {
      const description = describeSource(question.source || {});
      return { grade: text(description.grade), topic: text(description.topic), level: text(description.level) };
    });
    const groups = groupWholeQuestions(questions);
    const partCount = groups.reduce((total, group) => {
      // Match questionCard: standalone numeric IDs have no separate subparts.
      // A repeated legacy source region must not count its part label twice.
      const labels = new Set(group.questions.map((/** @type {ReviewQuestion} */ question) => (
        text(question.part || text(question.id).replace(/^\d+/, ''))
      )).filter(Boolean));
      return total + labels.size;
    }, 0);
    reviewed.push({
      title: text(section.title).trim() || unique(descriptions.map(item => item.topic)).join(' · '),
      kindLabel: text(section.kindLabel),
      grades: unique(descriptions.map(item => item.grade)),
      levels: unique(descriptions.map(item => item.level)),
      questionCount: groups.length,
      partCount,
    });
  }
  return {
    grades: unique(reviewed.flatMap(section => section.grades)),
    questionCount: reviewed.reduce((total, section) => total + section.questionCount, 0),
    partCount: reviewed.reduce((total, section) => total + section.partCount, 0),
    sections: reviewed,
    scenario: text(scenario),
    style: text(style),
    note: text(note).trim(),
  };
}

/** @param {number} count */
function questionsLabel(count) {
  return count === 1 ? 'שאלה אחת' : `${count} שאלות`;
}

/** @param {number} count */
function partsLabel(count) {
  return count === 0 ? 'ללא סעיפים נפרדים' : count === 1 ? 'סעיף אחד' : `${count} סעיפים`;
}

/**
 * Render only the textual review. Navigation and the preview stay owned by the
 * existing wizard, and no summary content is copied into the printed worksheet.
 * @param {HTMLElement} container
 * @param {TeacherReview} review
 */
export function renderTeacherReview(container, review) {
  const document = container.ownerDocument;
  const fragment = document.createDocumentFragment();
  const facts = document.createElement('dl');
  facts.className = 'teacher-review-facts';
  const rows = [
    [review.grades.length > 1 ? 'כיתות' : 'כיתה', review.grades.join(' · ')],
    ['שאלות', questionsLabel(review.questionCount)],
    ['סעיפים', partsLabel(review.partCount)],
    ['מטרה', review.scenario],
    ['גישה', review.style],
  ];
  rows.forEach(([label, value]) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    facts.append(term, detail);
  });
  const sections = document.createElement('ol');
  sections.className = 'teacher-review-sections';
  review.sections.forEach(section => {
    const item = document.createElement('li');
    item.className = 'teacher-review-section';
    const title = document.createElement('h4');
    title.className = 'teacher-review-section-title';
    title.textContent = section.title;
    const details = document.createElement('p');
    details.className = 'teacher-review-section-meta';
    details.textContent = [section.kindLabel, ...section.grades, ...section.levels,
      questionsLabel(section.questionCount), partsLabel(section.partCount)].filter(Boolean).join(' · ');
    item.append(title, details);
    sections.appendChild(item);
  });
  const note = document.createElement('section');
  note.className = 'teacher-review-note-block';
  const noteHeading = document.createElement('h4');
  noteHeading.textContent = 'ההוראות שיודפסו';
  const noteText = document.createElement('p');
  noteText.className = 'teacher-review-note';
  noteText.textContent = review.note || 'לא נוספו הוראות לתלמיד';
  note.append(noteHeading, noteText);
  fragment.append(facts, sections, note);
  container.replaceChildren(fragment);
}

/**
 * Count only pages prepared for printing, after all questions, answers and notes
 * have rendered. Omitting printArea clears a previous result during edits/load.
 * @param {HTMLElement | null} container
 * @param {ParentNode} [printArea]
 */
export function renderTeacherPageCount(container, printArea) {
  if (!container) return;
  container.hidden = true;
  container.textContent = '';
  if (!printArea) return;
  const categories = [
    { count: printArea.querySelectorAll('.crop-sheet[data-answers="0"]').length, one: 'עמוד שאלות אחד', many: 'עמודי שאלות' },
    { count: printArea.querySelectorAll('.source-sheet').length, one: 'עמוד מקור אחד', many: 'עמודי מקור' },
    { count: printArea.querySelectorAll('.crop-sheet[data-answers="1"]').length, one: 'עמוד תשובות אחד', many: 'עמודי תשובות' },
  ];
  const total = categories.reduce((sum, item) => sum + item.count, 0);
  if (!total) return;
  const parts = categories.filter(item => item.count > 0).map(item => item.count === 1 ? item.one : `${item.count} ${item.many}`);
  container.textContent = `${parts.join(' + ')} — ${total === 1 ? 'עמוד אחד' : `${total} עמודים`} בסך הכול`;
  container.hidden = false;
}
