import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createWordBankLoader } from '../src/lib/teacherWordBank';

const bank = { version: 1, sheets: {} };
const bytes = Buffer.from(JSON.stringify({ gzipBase64: gzipSync(JSON.stringify(bank)).toString('base64') }));
const hash = createHash('sha256').update(bytes).digest('hex');
const descriptor = { bundlePath: `/teachers/word-content.${hash}.json`, bundleSha256: hash, bundleBytes: bytes.length };

test('Word bank loads exact public bytes, caches successes and limits origins', async () => {
  let calls = 0;
  const load = createWordBankLoader(descriptor, async (url, options) => {
    calls++;
    assert.equal(String(url), 'https://www.noamdoronmath.co.il' + descriptor.bundlePath);
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.credentials, 'omit');
    return new Response(bytes);
  });
  assert.deepEqual(await load('http://internal.invalid/api', 'https://www.noamdoronmath.co.il/teachers'), bank);
  assert.deepEqual(await load('https://www.noamdoronmath.co.il/api'), bank);
  assert.equal(calls, 1);
  await assert.rejects(load('http://127.0.0.1:4347/api'));
  await assert.rejects(load('https://attacker.invalid/api'));
  assert.equal(calls, 1);
});

test('Word bank retries failed fetches, rejects changed bytes and permits loopback only in development', async () => {
  let calls = 0;
  const load = createWordBankLoader(descriptor, async () => {
    calls++;
    if (calls === 1) return new Response(null, { status: 503 });
    if (calls === 2) { const bad = Buffer.from(bytes); bad[3] ^= 1; return new Response(bad); }
    return new Response(bytes);
  }, true);
  await assert.rejects(load('http://127.0.0.1:4347/api'), /unavailable/);
  await assert.rejects(load('http://127.0.0.1:4347/api'), /hash/);
  assert.deepEqual(await load('http://127.0.0.1:4347/api'), bank);
  assert.equal(calls, 3);
  await assert.rejects(load('http://attacker.invalid/api'));
  assert.throws(() => createWordBankLoader({ ...descriptor, bundlePath: 'https://attacker.invalid/file' }));
});
