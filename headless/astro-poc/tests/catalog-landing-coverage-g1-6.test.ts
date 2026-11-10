/**
 * Grades 1–6: every catalog topic has a landing page.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { uncoveredCatalogTopics } from '../src/lib/catalogLandingCoverage.ts';

describe('grades 1–6 catalog landing coverage', () => {
  for (const grade of [1, 2, 3, 4, 5, 6]) {
    it(`grade ${grade}: every catalog topic has a landing page`, () => {
      assert.deepEqual(
        uncoveredCatalogTopics(grade).map((row) => `t${row.topicId} ${row.title}`),
        [],
      );
    });
  }
});
