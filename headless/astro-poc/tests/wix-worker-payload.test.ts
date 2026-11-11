import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it } from 'node:test';
import { measureWorkerPayload, checkWixWorkerPayload, PROJECT_PAYLOAD_BUDGET_BYTES, DEPLOYMENT_METADATA_ALLOWANCE_BYTES } from '../scripts/check-wix-worker-payload.mjs';

const dirs: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'wix-worker-payload-'));
  dirs.push(root);
  const worker = path.join(root, 'dist/_worker.js');
  mkdirSync(worker, { recursive: true });
  mkdirSync(path.join(root, '.wix'));
  const manifest = path.join(worker, 'manifest.json');
  writeFileSync(manifest, '{"notAWorkerFile":true}');
  writeFileSync(path.join(root, '.wix/build-metadata.json'), JSON.stringify({ serverDir: 'dist/_worker.js', appManifestPath: 'dist/_worker.js/manifest.json' }));
  return { root, worker, manifest };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('Wix worker deployment payload budget', () => {
  it('counts the exact CLI base64 JSON shape, UTF-8 paths, padding and excluded files', async () => {
    const f = fixture();
    const inputs = [
      { path: 'entry.mjs', bytes: Buffer.from('export default 1;') },
      { path: 'nested/א"ב.bin', bytes: Buffer.from([0, 1]) },
      { path: 'one.bin', bytes: Buffer.from([255]) },
      { path: 'three.bin', bytes: Buffer.from([1, 2, 3]) },
    ].sort((a, b) => a.path.localeCompare(b.path));
    mkdirSync(path.join(f.worker, 'nested'));
    mkdirSync(path.join(f.worker, '.private'));
    writeFileSync(path.join(f.worker, '.private/secret'), 'not deployed');
    writeFileSync(path.join(f.worker, '.ignored'), 'not deployed');
    for (const item of inputs) writeFileSync(path.join(f.worker, item.path), item.bytes);
    const actual = await checkWixWorkerPayload(f.root);
    const files = inputs.map(item => ({ path: item.path, content: item.bytes.toString('base64') }));
    const exactBody = Buffer.byteLength(JSON.stringify({ appDeployment: { files } }), 'utf8');
    assert.equal(actual.fileCount, 4);
    assert.equal(actual.rawBytes, inputs.reduce((sum, item) => sum + item.bytes.length, 0));
    assert.equal(actual.base64Bytes, files.reduce((sum, item) => sum + item.content.length, 0));
    assert.equal(actual.filesJsonBytes, Buffer.byteLength(JSON.stringify(files), 'utf8'));
    assert.equal(actual.payloadBodyBytes, exactBody);
    assert.equal(actual.budgetedPayloadBytes, exactBody + DEPLOYMENT_METADATA_ALLOWANCE_BYTES);
    assert.equal(actual.projectBudgetBytes, PROJECT_PAYLOAD_BUDGET_BYTES);
    assert.equal(actual.ok, true);
  });

  it('accepts the exact budget and rejects a one-byte overrun', async () => {
    const f = fixture();
    writeFileSync(path.join(f.worker, 'entry.mjs'), 'export default "שלום";');
    const options = { serverDir: f.worker, appManifestPath: f.manifest };
    const measured = await measureWorkerPayload(options);
    assert.equal((await measureWorkerPayload({ ...options, budgetBytes: measured.budgetedPayloadBytes })).ok, true);
    assert.equal((await measureWorkerPayload({ ...options, budgetBytes: measured.budgetedPayloadBytes - 1 })).ok, false);
    await assert.rejects(measureWorkerPayload({ ...options, budgetBytes: 0 }), /Invalid project payload budget/);
  });

  it('fails closed on missing/empty output, invalid metadata and symlinks', async () => {
    const f = fixture();
    await assert.rejects(checkWixWorkerPayload(f.root), /no deployable files/);
    await assert.rejects(measureWorkerPayload({ serverDir: path.join(f.root, 'missing'), appManifestPath: f.manifest }), /missing or unreadable/);
    writeFileSync(path.join(f.root, '.wix/build-metadata.json'), 'sensitive text that must not be echoed');
    await assert.rejects(checkWixWorkerPayload(f.root), error => {
      assert.match(error.message, /metadata is missing, unreadable, or invalid/);
      assert.doesNotMatch(error.message, /sensitive text/);
      return true;
    });
    writeFileSync(path.join(f.root, '.wix/build-metadata.json'), '{}');
    await assert.rejects(checkWixWorkerPayload(f.root), /does not identify the worker output/);
    symlinkSync(path.join(f.root, 'missing-target'), path.join(f.worker, 'linked.mjs'));
    await assert.rejects(measureWorkerPayload({ serverDir: f.worker, appManifestPath: f.manifest }), /symbolic link/);
  });

  it('rejects the alternate Wix loader rather than counting the wrong file set', async () => {
    const f = fixture();
    writeFileSync(path.join(f.root, '.wix/build-metadata.json'), JSON.stringify({ serverDir: f.worker, appManifestPath: f.manifest, metaDataSource: 'WIX_CONFIG' }));
    await assert.rejects(checkWixWorkerPayload(f.root), /file selection is unsupported/);
  });

  it('exits nonzero on the real default budget without logging source or base64', () => {
    const f = fixture();
    writeFileSync(path.join(f.worker, 'large.mjs'), Buffer.alloc(14_700_000, 'x'));
    const script = fileURLToPath(new URL('../scripts/check-wix-worker-payload.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd: f.root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.fileCount, 1);
    assert.equal(report.rawBytes, 14_700_000);
    assert.equal(report.base64Bytes, 19_600_000);
    assert.equal(report.ok, false);
    assert.match(result.stderr, /exceeds the project deployment budget/);
    assert.ok(result.stdout.length < 500, 'only numeric accounting is logged');
    assert.doesNotMatch(result.stdout + result.stderr, /eHh4|xxxxxxxx|large\.mjs/);
  });
});
