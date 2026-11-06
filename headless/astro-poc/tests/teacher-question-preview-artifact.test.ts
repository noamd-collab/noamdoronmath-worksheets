import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { verifyQuestionPreviewArtifact } from '../scripts/lib/question-preview-artifact.mjs';

const previews = {
  source: {
    sourceSha256: 'a'.repeat(64),
    exercises: [{ q: 1, crop: { page: 1, x: 20, y: 30, width: 400, height: 100 } }],
  },
};
const artifact = (payload: Buffer) => JSON.stringify({ version: 1, sheets: 1, gzipBase64: payload.toString('base64') });

test('preview check accepts distinct gzip encodings of the complete source geometry', () => {
  const source = JSON.stringify(previews);
  const fast = gzipSync(source, { level: 1 });
  const dense = gzipSync(source, { level: 9 });
  dense[9] = 3; // Linux and macOS can encode a different gzip OS header.
  assert.notDeepEqual(fast, dense);
  assert.doesNotThrow(() => verifyQuestionPreviewArtifact(artifact(fast), previews));
  assert.doesNotThrow(() => verifyQuestionPreviewArtifact(artifact(dense), previews));
});

test('preview check rejects changed geometry, provenance, missing exercises and metadata', () => {
  const valid = artifact(gzipSync(JSON.stringify(previews)));
  const changedCrop = structuredClone(previews);
  changedCrop.source.exercises[0].crop.y += 1;
  const changedSource = structuredClone(previews);
  changedSource.source.sourceSha256 = 'b'.repeat(64);
  const missingExercise = structuredClone(previews);
  missingExercise.source.exercises = [];
  for (const changed of [changedCrop, changedSource, missingExercise]) {
    assert.throws(() => verifyQuestionPreviewArtifact(valid, changed), /geometry is stale/);
  }
  assert.throws(() => verifyQuestionPreviewArtifact(valid.replace('"version":1', '"version":2'), previews), /version is stale/);
  assert.throws(() => verifyQuestionPreviewArtifact(valid.replace('"sheets":1', '"sheets":2'), previews), /sheet count is stale/);
  assert.throws(() => verifyQuestionPreviewArtifact('{"version":1,"sheets":1}', previews), /payload is missing/);
  assert.throws(() => verifyQuestionPreviewArtifact(artifact(Buffer.from('broken')), previews));
});
