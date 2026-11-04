import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

// gzip output varies with the Node/zlib platform. Validate the full decoded
// content and metadata, while serving the exact reviewed, hash-pinned artifact.
export function verifyWordBankArtifact(content, bank) {
  const artifact = JSON.parse(content);
  assert.equal(artifact.version, bank.version, 'Word bank version is stale');
  assert.equal(artifact.sheets, Object.keys(bank.sheets).length, 'Word bank sheet count is stale');
  const questions = Object.values(bank.sheets).reduce((n, sheet) => n + Object.keys(sheet.questions).length, 0);
  assert.equal(artifact.questions, questions, 'Word bank question count is stale');
  assert.equal(typeof artifact.gzipBase64, 'string', 'Word bank payload is missing');
  const decoded = gunzipSync(Buffer.from(artifact.gzipBase64, 'base64')).toString('utf8');
  assert.ok(decoded === JSON.stringify(bank), 'Word bank content is stale');
  return artifact;
}
