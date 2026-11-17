import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Noam, 17 Nov 2026: G9-EQM-01 opens the reduced-track month group r9jan ('ינואר')
 * as base PDF-only topic 49. Bound to the independently reviewed PDFs
 * (Antigravity PASS_STUDENT_PDF_ESSENTIALS, receipt 8a00cd8b…) by their media ids.
 */
export const reviewedEqm49 = {
  grade: 9,
  topicId: 49,
  slug: 'equations-numeric-denominator-grade-9',
  receipt: 'docs/g9-eqm01-pdf-first-20261117.json',
  pdfIds: ['53fb5318e99546a6a6b12c06e118ba59', 'f5d9e89adee948768e456876b8e087cf', '038d9928b68942ca91f3a17ac6cf92b3'],
  topicSha256: 'febc4d09d0196d53cc7a55ad45c55cbff8758fb0426708d73df2574ca03492a0',
  neighbours: [36, 37],
  group: { key: 'r9jan', label: 'ינואר', reducedProgram: true },
  trackGroups: ['r9jan', 'r9oct', 'r9sep'],
  previousTrackGroups: ['r9oct', 'r9sep'],
  searchTerms: 'משוואות מכנה מספרי מכנים מספריים מכנה משותף משוואות עם שברים כפל במכנה המשותף משוואה ממעלה ראשונה סימן חיסור לפני שבר משוואות מיוחדות ט מצומצמת מסלול מצומצם ינואר',
} as const;

/**
 * Reverse exactly this addition (topic 49, its search terms, the r9jan group and its
 * trackGroups entry) before every older catalog fence. Any other change must fail.
 */
export function beforeEqm49Catalog<T>(catalog: T): T {
  const restored: any = structuredClone(catalog);
  const grade = restored.grades.find((g: any) => g.grade === reviewedEqm49.grade);
  assert.equal(grade.topics.filter((t: any) => t.id === reviewedEqm49.topicId).length, 1, 'EQM49: exactly one topic 49');
  const index = grade.topics.findIndex((t: any) => t.id === reviewedEqm49.topicId);
  assert.deepEqual([grade.topics[index - 1].id, grade.topics[index + 1].id], reviewedEqm49.neighbours, 'EQM49: reviewed position');
  assert.deepEqual(grade.topics[index].levels.map((l: any) => l.pdfId), reviewedEqm49.pdfIds, 'EQM49: reviewed PDFs');
  assert.equal(sha(grade.topics[index]), reviewedEqm49.topicSha256, 'EQM49: exact base topic');
  assert.equal(restored.searchTerms['9']['49'], reviewedEqm49.searchTerms, 'EQM49: exact search terms');
  assert.deepEqual(grade.groups.at(-1), reviewedEqm49.group, 'EQM49: r9jan is the last group');
  assert.equal(grade.groups.filter((g: any) => g.key === reviewedEqm49.group.key).length, 1, 'EQM49: one r9jan group');
  assert.deepEqual(restored.config.trackGroups, reviewedEqm49.trackGroups, 'EQM49: exact trackGroups');
  grade.topics.splice(index, 1);
  grade.groups.pop();
  restored.config.trackGroups = [...reviewedEqm49.previousTrackGroups];
  delete restored.searchTerms['9']['49'];
  return restored;
}
