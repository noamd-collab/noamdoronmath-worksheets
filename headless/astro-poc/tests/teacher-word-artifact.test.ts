import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { verifyWordBankArtifact } from '../scripts/lib/word-bank-artifact.mjs';

const bank = { version: 1, sheets: { source: { questions: { 1: { text: 'שאלה', answer: 'תשובה' } } } } };
const artifact = (bytes: Buffer) => JSON.stringify({ version: 1, sheets: 1, questions: 1, gzipBase64: bytes.toString('base64') });

test('portable Word check accepts distinct gzip headers and compression with identical complete content', () => {
  const payload = JSON.stringify(bank);
  const fast = gzipSync(payload, { level: 1 }), dense = gzipSync(payload, { level: 9 });
  dense[9] = 3; // Unix OS header; the committed macOS/Node artifact can use another value.
  assert.notDeepEqual(fast, dense);
  assert.doesNotThrow(() => verifyWordBankArtifact(artifact(fast), bank));
  assert.doesNotThrow(() => verifyWordBankArtifact(artifact(dense), bank));
});

test('portable Word check still rejects stale questions, answers, counts and corrupt gzip', () => {
  const valid = artifact(gzipSync(JSON.stringify(bank)));
  for (const replacement of ['שאלה אחרת', 'תשובה אחרת']) {
    const changed = JSON.parse(JSON.stringify(bank));
    changed.sheets.source.questions[1][replacement.startsWith('שאלה') ? 'text' : 'answer'] = replacement;
    assert.throws(() => verifyWordBankArtifact(valid, changed), /content is stale/);
  }
  assert.throws(() => verifyWordBankArtifact(valid.replace('"questions":1', '"questions":2'), bank), /count is stale/);
  assert.throws(() => verifyWordBankArtifact(artifact(Buffer.from('broken')), bank));
});
