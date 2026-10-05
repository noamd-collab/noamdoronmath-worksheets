/**
 * Worksheet viewer opens on the clean printable page. Noam AI (Ramzi, report
 * pins, side panel) stays off until "פתרו באמצעות Noam AI".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viewer = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');
const adapter = viewer.match(/<script id="exact-viewer-adapter">([\s\S]*?)<\/script>/)?.[1];

describe('clean worksheet before Noam AI', () => {
  it('starts without AI mode and offers the exact entry label', () => {
    assert.match(viewer, /<body class="exact-viewer">/);
    assert.doesNotMatch(viewer, /<body[^>]*noam-ai-on/);
    const labels = viewer.match(/פתרו באמצעות Noam AI/g) || [];
    assert.equal(labels.length, 2, 'visible label plus the script restore string');
    assert.match(viewer, /id="noamAiToggle"[^>]*>פתרו באמצעות Noam AI</);
    assert.match(viewer, /aria-pressed="false"/);
  });

  it('keeps Ramzi and report pins out of the clean view, print, and the side panel', () => {
    assert.match(viewer, /\.exact-viewer:not\(\.noam-ai-on\) \.pdf-page \.noam-exercise-pin/);
    assert.match(viewer, /\.exact-viewer:not\(\.noam-ai-on\) \.pdf-page \.noam-report-pin/);
    assert.match(viewer, /\.exact-viewer:not\(\.noam-ai-on\) \.panel/);
    assert.match(viewer, /\.exact-viewer:not\(\.noam-ai-on\) \.fab/);
    assert.match(viewer, /@media print\{[\s\S]*\.noam-exercise-pin[\s\S]*\.noam-report-pin[\s\S]*\.noam-ai-entry/);
    assert.match(viewer, /חזרה לדף הנקי/);
  });

  it('does not auto-open the help panel before the teacher opts in', () => {
    assert.ok(adapter);
    assert.match(
      adapter,
      /body\.classList\.contains\('noam-ai-on'\)&&!narrow&&!initialWideOpened&&helpReadyObserved&&!helpTab\.disabled/
    );
    assert.match(adapter, /initialWideOpened=true/);
    new vm.Script(adapter);
  });
});
