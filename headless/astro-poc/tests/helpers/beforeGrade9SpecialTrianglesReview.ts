import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Remove the Nov 22 grade-9 review only when its complete catalog entry and search terms
 * match PR 566. Earlier worksheet-intake fixtures pin the catalog before that placement. */
export function beforeGrade9SpecialTrianglesReview<T>(input: T): T {
  const catalog: any = structuredClone(input);
  const grade = catalog.grades.find((entry: any) => entry.grade === 9);
  const topics = grade?.topics ?? [];
  const matches = topics.filter((topic: any) => topic.id === 21);
  const terms = catalog.searchTerms?.['9'];
  if (!matches.length && !Object.hasOwn(terms ?? {}, '21')) return catalog;
  assert.equal(matches.length, 1, 'expected one grade-9 special triangles placement');
  const topic = matches[0];
  const position = topics.indexOf(topic);
  assert.deepEqual([topics[position - 1]?.id, topics[position + 1]?.id], [20, 22],
    'grade-9 special triangles position changed');
  assert.equal(createHash('sha256').update(JSON.stringify(topic)).digest('hex'),
    '78281e211fc930d6d3e83eeff3e98c3b7950801232a8dbf0ee325104e05a2be3',
    'grade-9 special triangles placement or source changed');
  assert.equal(terms?.['21'], 'משולש משולשים מיוחדים שווה שוקיים שווה צלעות ישר זווית גיאומטריה חזרה מכיתה ז',
    'grade-9 special triangles search terms changed');
  topics.splice(position, 1);
  delete terms['21'];
  return catalog;
}
