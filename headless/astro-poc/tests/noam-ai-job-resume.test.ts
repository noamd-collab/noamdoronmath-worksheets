/**
 * HEADLESS-URGENT-46 — Noam AI job resume storage contract.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LEGACY_GITHUB_CATALOG, viewerBackHref } from './viewer-back-href.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Resume = require(join(root, 'public/noam-ai-job-resume.js'));

function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      m.set(k, String(v));
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

describe('NoamAiJobResume', () => {
  it('saves and loads a pending diagram job for the same owner/scope', () => {
    const s = memStore();
    const ok = Resume.savePending(s, {
      jobId: 'job-abc',
      kind: 'diagram',
      ownerKey: 'owner-123456789012',
      cacheKey: '["diagram-v1"]',
      g: 7,
      x: 'G7-T08',
      pdf: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      startedAt: Date.now(),
    });
    assert.equal(ok, true);
    const loaded = Resume.loadPending(s, {
      ownerKey: 'owner-123456789012',
      kind: 'diagram',
      g: 7,
      x: 'G7-T08',
    });
    assert.ok(loaded);
    assert.equal(loaded.jobId, 'job-abc');
  });

  it('rejects foreign owner and expired jobs', () => {
    const s = memStore();
    Resume.savePending(s, {
      jobId: 'job-abc',
      kind: 'diagram',
      ownerKey: 'owner-aaaaaaaaaaaa',
      startedAt: Date.now() - Resume.MAX_AGE_MS - 1000,
      g: 7,
    });
    assert.equal(Resume.loadPending(s, { ownerKey: 'owner-aaaaaaaaaaaa', kind: 'diagram' }), null);
    Resume.savePending(s, {
      jobId: 'job-2',
      kind: 'diagram',
      ownerKey: 'owner-bbbbbbbbbbbb',
      startedAt: Date.now(),
      g: 7,
    });
    assert.equal(
      Resume.loadPending(s, { ownerKey: 'owner-cccccccccccc', kind: 'diagram' }),
      null
    );
  });

  it('clearIfJob only clears matching id (no duplicate wipe of newer job)', () => {
    const s = memStore();
    Resume.savePending(s, {
      jobId: 'old',
      kind: 'diagram',
      ownerKey: 'owner-123456789012',
      startedAt: Date.now(),
    });
    Resume.savePending(s, {
      jobId: 'new',
      kind: 'diagram',
      ownerKey: 'owner-123456789012',
      startedAt: Date.now(),
    });
    Resume.clearIfJob(s, 'old');
    assert.equal(Resume.loadPending(s, { ownerKey: 'owner-123456789012' }).jobId, 'new');
    Resume.clearIfJob(s, 'new');
    assert.equal(Resume.loadPending(s, { ownerKey: 'owner-123456789012' }), null);
  });

  it('viewer wires resume helpers and same-origin Headless back (no github.io on host)', () => {
    const html = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');
    assert.ok(html.includes('noam-ai-job-resume.js'));
    assert.ok(html.includes('noamSavePendingJob'));
    assert.ok(html.includes('noamClearPendingJob'));
    assert.ok(html.includes('isHeadlessHost'));
    assert.ok(html.includes('!isHeadlessHost'));
    assert.ok(html.includes('noamSavePendingJob({\n          jobId:start.jobId'));
    for (const hostname of ['www.noamdoronmath.co.il', 'noamdoronmath.co.il']) {
      const href = viewerBackHref(html, { hostname, back: LEGACY_GITHUB_CATALOG });
      assert.ok(!href.includes('github.io'), `${hostname} followed ${href}`);
      assert.equal(href, '/worksheets?grade=7');
    }
  });
});
