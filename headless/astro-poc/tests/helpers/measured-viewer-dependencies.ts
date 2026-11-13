import assert from 'node:assert/strict';

/** Load the real owner-script dependencies into legacy sliced-VM fixtures.
 * No predicates/bridge calls are stubbed: legacy manifests must take the real
 * non-measured branch. The positive measured path is covered by
 * edition-native-question-card.test.ts, including both complete IIFE scopes.
 */
export function measuredViewerDependencies(source: string): string {
  const startMarker = '// BEGIN MEASURED QUESTION CARD: original source only, never answer AST.';
  const endMarker = '// END MEASURED QUESTION CARD';
  assert.equal(source.split(startMarker).length, 2);
  assert.equal(source.split(endMarker).length, 2);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start) + endMarker.length;
  assert.ok(end > start);
  return source.slice(start, end) + '\n';
}
