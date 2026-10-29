import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { captureDiffStream, pullRequestDiff, runDeepSeekReview } from './deepseek-review.mjs';

test('drains more than 64MiB while retaining only the bounded prefix', async () => {
  const header = Buffer.from('diff --git a/source.mjs b/source.mjs\n');
  const chunk = Buffer.alloc(1024 * 1024, 'x');
  let drained = 0;
  async function* chunks() {
    yield header;
    for (let i = 0; i < 66; i++) { drained++; yield chunk; }
  }
  const result = await captureDiffStream(Readable.from(chunks()));
  assert.equal(drained, 66);
  assert.equal(result.characters, header.length + 66 * chunk.length);
  assert.equal(result.bytes, result.characters);
  assert.equal(result.prefix.length, 100_000);
  assert.ok(result.prefix.startsWith(header.toString()));
  assert.equal(result.truncated, true);
});

test('counts UTF8 across chunk boundaries and preserves diffText dry runs', async () => {
  const raw = Buffer.from('אב😀\n');
  const result = await captureDiffStream(Readable.from([...raw].map((byte) => Buffer.from([byte]))));
  assert.equal(result.prefix, 'אב😀\n');
  assert.equal(result.characters, 'אב😀\n'.length);
  assert.equal(result.bytes, raw.length);
  assert.equal(result.truncated, false);
  const dry = await runDeepSeekReview({ diffText: 'x'.repeat(100_001), dryRun: true });
  assert.equal(dry.characters, 100_001);
  assert.equal(dry.retainedCharacters, 100_000);
  assert.equal(dry.truncated, true);
});

test('orders code ahead of large earlier-named data without dropping the data', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'deepseek-stream-test-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  try {
    git('init', '-q');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'base');
    const base = git('rev-parse', 'HEAD').trim();
    mkdirSync(join(cwd, 'A-generated'));
    writeFileSync(join(cwd, 'A-generated/native.json'), JSON.stringify({ payload: 'x'.repeat(2 * 1024 * 1024) }) + '\n');
    writeFileSync(join(cwd, 'z-viewer.mjs'), 'export const verified = true;\n');
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'changes');
    const actual = await pullRequestDiff({ base, cwd, limit: 1_000 });
    assert.ok(actual.prefix.indexOf('z-viewer.mjs') < actual.prefix.indexOf('A-generated/native.json'));
    assert.ok(actual.prefix.includes('export const verified = true;'));
    const complete = git('diff', '--no-color', '--find-renames', base, 'HEAD');
    assert.equal(actual.characters, complete.length);
    assert.equal(actual.bytes, Buffer.byteLength(complete));
    assert.equal(actual.prefix.length, 1_000);
    assert.equal(actual.truncated, true);
    await assert.rejects(pullRequestDiff({ base: 'missing-ref', cwd }), /git diff exited/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
