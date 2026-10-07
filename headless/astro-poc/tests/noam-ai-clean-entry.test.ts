/**
 * Worksheet viewer opens on the clean printable page. The side panel stays off
 * until "פתרו באמצעות Noam AI". Question pins stay visible in that clean view.
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

  it('shows Ramzi and report pins in the clean view and keeps the side panel closed', () => {
    const pinRule = viewer.match(
      /\.exact-viewer:not\(\.noam-ai-on\) \.pdf-page \.noam-exercise-pin,\s*\.exact-viewer:not\(\.noam-ai-on\) \.pdf-page \.noam-report-pin\{[^}]+\}/
    );
    assert.ok(pinRule, 'clean-view pin rule');
    assert.match(pinRule[0], /visibility:\s*visible/);
    assert.match(pinRule[0], /pointer-events:\s*auto/);
    assert.doesNotMatch(pinRule[0], /visibility:\s*hidden/);
    const chromeRule = viewer.match(
      /\.exact-viewer:not\(\.noam-ai-on\) \.fab,\s*\.exact-viewer:not\(\.noam-ai-on\) \.panel,[\s\S]*?\{[^}]+\}/
    );
    assert.ok(chromeRule, 'clean-view panel rule');
    assert.match(chromeRule[0], /display:\s*none\s*!important/);
    assert.match(viewer, /@media print\{[\s\S]*\.noam-print-arrow[\s\S]*\.noam-print-primary[\s\S]*\.noam-ai-toggle/);
    assert.match(viewer, /חזרה לדף הנקי/);
  });

  it('names a merged phone pin by its questions and keeps report focus on the band', () => {
    assert.ok(adapter);
    const fn = adapter.match(/function questionHitName\(pin\)\{[\s\S]*?\n  \}/)?.[0];
    assert.ok(fn, 'questionHitName');
    const context: { result?: string[] } = {};
    vm.createContext(context);
    vm.runInContext(
      `${fn}\nresult = [\n` +
        `questionHitName({dataset:{label:'שאלות 1, 2 · בחירת שאלה וסעיף · נועם AI'}}),\n` +
        `questionHitName({dataset:{label:'שאלה 1 · סעיף א · העזר בנועם AI'}}),\n` +
        `questionHitName({dataset:{label:'שאלה 3 · בחירת שאלה וסעיף · נועם AI'}})\n` +
        `];`,
      context
    );
    assert.deepEqual(JSON.parse(JSON.stringify(context.result)), [
      'פתיחת רמזי לשאלות 1, 2',
      'פתיחת רמזי לשאלה 1 סעיף א',
      'פתיחת רמזי לשאלה 3',
    ]);
    assert.match(adapter, /button\.hidden=!document\.querySelector\('\.noam-exercise-pin\.is-active'\)/);
    assert.match(adapter, /selectManifestExercise=function\(exercise,pin\)/);
    assert.match(adapter, /feedbackDialog\.addEventListener\('close'/);
    assert.match(adapter, /restoreQuestionFocus\(\)/);
  });

  it('uses one named question stop, a dark focus ring, and no page-wide touch-action lock', () => {
    assert.ok(adapter);
    assert.match(adapter, /פתיחת רמזי לשאלה/);
    assert.match(adapter, /pin\.tabIndex=-1/);
    assert.match(adapter, /event\.detail!==0/);
    assert.match(adapter, /pointerType==='mouse'&&!event\.buttons/);
    assert.match(viewer, /outline:3px solid #22305a/);
    assert.doesNotMatch(viewer, /touch-action:\s*manipulation/);
    assert.doesNotMatch(viewer, /touch-action:\s*pan-x/);
    assert.match(adapter, /className='noam-link-button exact-report'/);
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
