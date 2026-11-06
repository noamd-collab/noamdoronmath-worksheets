import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

// Node/zlib versions can encode identical geometry to different gzip bytes.
// Check the entire decoded payload and its metadata without rewriting the
// committed artifact; missing or changed source geometry must still fail.
export function verifyQuestionPreviewArtifact(content, previews) {
  const artifact = JSON.parse(content);
  assert.equal(artifact.version, 1, 'Teacher question preview version is stale');
  assert.equal(artifact.sheets, Object.keys(previews).length, 'Teacher question preview sheet count is stale');
  assert.equal(typeof artifact.gzipBase64, 'string', 'Teacher question preview payload is missing');
  const decoded = gunzipSync(Buffer.from(artifact.gzipBase64, 'base64')).toString('utf8');
  assert.ok(decoded === JSON.stringify(previews), 'Teacher question preview geometry is stale');
  return artifact;
}
