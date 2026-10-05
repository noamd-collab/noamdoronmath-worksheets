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
    assert.match(viewer, /@media print\{[\s\S]*\.noam-print-arrow[\s\S]*\.noam-print-primary[\s\S]*\.noam-ai-toggle/);
    assert.match(viewer, /חזרה לדף הנקי/);
  });

  it('makes download/print the primary clean-view action and points at it', () => {
    const entry = viewer.match(/<div class="noam-ai-entry"[\s\S]*?<\/div>\s*<main/)?.[0] || '';
    assert.match(entry, /id="pdfOpenFull"[\s\S]*הורדה \/ הדפסה/);
    assert.match(entry, /להדפסה/);
    assert.match(entry, /class="noam-print-arrow"/);
    const printAt = entry.indexOf('id="pdfOpenFull"');
    const aiAt = entry.indexOf('id="noamAiToggle"');
    assert.ok(printAt > -1 && aiAt > printAt, 'print action comes before the Noam AI button');
    assert.match(viewer, /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*\.noam-print-arrow-icon\{animation:none\}/);
    assert.match(viewer, /html\.nd-motion-off \.exact-viewer \.noam-print-arrow-icon/);
    assert.match(viewer, /background:#14213d;color:#fff/);
    assert.match(viewer, /\.exact-viewer \.noam-ai-toggle\{[\s\S]*background:#fff/);
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
