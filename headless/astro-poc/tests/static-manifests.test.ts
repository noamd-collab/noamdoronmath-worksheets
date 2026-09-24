/**
 * HEADLESS-MIGRATION-13 — same-origin static manifest sync gates.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const provenancePath = join(pub, 'noam-ai', 'sync-provenance.json');

describe('same-origin static manifests (HEADLESS-MIGRATION-13)', () => {
  it('viewer prefers local manifests with easy GitHub rollback flag', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    assert.ok(html.includes('HEADLESS_USE_LOCAL_MANIFESTS = true'));
    assert.ok(html.includes('"./noam-ai/manifests/"'));
    assert.ok(html.includes('HEADLESS_LEGACY_INDEX'));
    assert.ok(html.includes('"./legacy-github/index.html"'));
  });

  it('provenance exists and sample G7/G8/G9 manifests are present', () => {
    assert.equal(existsSync(provenancePath), true);
    const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
    assert.ok(provenance.selection.count >= 400);
    assert.equal(typeof provenance.aggregateSha256, 'string');
    assert.equal(provenance.aggregateSha256.length, 64);
    assert.ok(provenance.sourceOfTruth.path.includes('noam-ai/manifests'));
    // Representative ids from prior migration samples / catalog.
    for (const id of [
      '91def8012efb44c9bdd092522fa576d6', // G7-T08 a
      '2c47f33e99f44174a32f7f4cfb3b5e3e', // G8-T02 a
      '8896327abb7a4d4fa8ed20aac2863dd2', // G9-T02 a
    ]) {
      assert.ok(provenance.files[id], 'missing provenance entry ' + id);
      assert.equal(existsSync(join(pub, 'noam-ai', 'manifests', id + '.json')), true);
    }
    assert.equal(existsSync(join(pub, 'legacy-github', 'index.html')), true);
  });
});
