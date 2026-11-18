import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Noam, 18 Nov 2026: G9-PCM-01 (percentages, ט׳ מצומצמת) opens the reduced-track month group
 * r9nov ('נובמבר', between r9oct and r9jan) as base PDF-only topic 53, in batch 10.
 */
export const reviewedPcm53 = {
  "grade": 9,
  "topicId": 53,
  "slug": "percentages-grade-9",
  "receipt": "docs/batch10-pdf-first-20261118.json",
  "pdfIds": [
    "51d9de626e314f26b2f6652b63424aea",
    "afdc0fde19884fb99efcee39eca6758a",
    "6a1f274d04494ab1ac5393811845c7ac"
  ],
  "topicSha256": "b4f9e09351d38d82cee65aa83fba67dfa62efe87a68e1dfa76a709374bb6ce81",
  "neighbours": [
    36,
    49
  ],
  "group": {
    "key": "r9nov",
    "label": "נובמבר",
    "reducedProgram": true
  },
  "groupNeighbours": [
    "r9oct",
    "r9jan"
  ],
  "trackGroups": [
    "r9jan",
    "r9nov",
    "r9oct",
    "r9sep"
  ],
  "previousTrackGroups": [
    "r9jan",
    "r9oct",
    "r9sep"
  ],
  "searchTerms": "אחוזים אחוז ערך האחוז חלק מהשלם החלק היחסי השלם מהחלק טבלת אחוזים הגדלה באחוזים הקטנה באחוזים הנחה התייקרות אחוז שינוי מכפיל מע״מ שינויים עוקבים הנחות עוקבות מחיר מקורי אחוזים בחיי היומיום ט מצומצמת מסלול מצומצם נובמבר"
} as const;

/**
 * Reverse exactly topic 53, its search terms, the r9nov group and its trackGroups entry before every
 * older catalog fence. Any other change must fail.
 */
export function beforePcm53Catalog<T>(catalog: T): T {
  const restored: any = structuredClone(catalog);
  const grade = restored.grades.find((g: any) => g.grade === reviewedPcm53.grade);
  assert.equal(grade.topics.filter((t: any) => t.id === reviewedPcm53.topicId).length, 1, 'PCM53: exactly one topic 53');
  const index = grade.topics.findIndex((t: any) => t.id === reviewedPcm53.topicId);
  assert.deepEqual([grade.topics[index - 1]?.id, grade.topics[index + 1]?.id], reviewedPcm53.neighbours, 'PCM53: reviewed position');
  assert.deepEqual(grade.topics[index].levels.map((l: any) => l.pdfId), reviewedPcm53.pdfIds, 'PCM53: reviewed PDFs');
  assert.equal(sha(grade.topics[index]), reviewedPcm53.topicSha256, 'PCM53: exact base topic');
  assert.equal(restored.searchTerms['9']['53'], reviewedPcm53.searchTerms, 'PCM53: exact search terms');
  assert.equal(grade.groups.filter((g: any) => g.key === reviewedPcm53.group.key).length, 1, 'PCM53: one r9nov group');
  const gi = grade.groups.findIndex((g: any) => g.key === reviewedPcm53.group.key);
  assert.deepEqual([grade.groups[gi - 1]?.key, grade.groups[gi + 1]?.key], reviewedPcm53.groupNeighbours, 'PCM53: r9nov between r9oct and r9jan');
  assert.deepEqual(grade.groups[gi], reviewedPcm53.group, 'PCM53: exact r9nov group');
  assert.deepEqual(restored.config.trackGroups, reviewedPcm53.trackGroups, 'PCM53: exact trackGroups');
  grade.topics.splice(index, 1);
  grade.groups.splice(gi, 1);
  restored.config.trackGroups = [...reviewedPcm53.previousTrackGroups];
  delete restored.searchTerms['9']['53'];
  return restored;
}
