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
    // Representative active native releases for the same G7/G8/G9 identities.
    for (const id of [
      'b6b9bf5985484191b71c0c864fd04c31', // G7-T08 a
      'd5efea6959f4415a913565dec0994063', // G8-T02 a
      'fa1bf558e210495e98750875aa9b2d8a', // G9-T02 a
    ]) {
      assert.ok(provenance.files[id], 'missing provenance entry ' + id);
      assert.equal(existsSync(join(pub, 'noam-ai', 'manifests', id + '.json')), true);
    }
    assert.equal(existsSync(join(pub, 'legacy-github', 'index.html')), true);
  });
});
