import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { shouldCaptureTeacherPrintShots } from './qwen-teacher-shots.mjs';

describe('shouldCaptureTeacherPrintShots', () => {
  it('runs for teacher page and print-pack files, not for an unrelated page', () => {
    assert.equal(shouldCaptureTeacherPrintShots(['headless/astro-poc/public/teachers/index.html']), true);
    assert.equal(shouldCaptureTeacherPrintShots(['headless/astro-poc/public/teachers/teacher-factoring-print.js']), true);
    assert.equal(shouldCaptureTeacherPrintShots(['headless/astro-poc/public/teachers/packs/factoring-9/4aba762b64b54af098827d1f386bcf68.json']), true);
    assert.equal(shouldCaptureTeacherPrintShots(['headless/astro-poc/scripts/render-teacher-pack.py']), true);
    assert.equal(shouldCaptureTeacherPrintShots(['headless/astro-poc/src/pages/index.astro']), false);
    assert.equal(shouldCaptureTeacherPrintShots(['headless/astro-poc/src/components/GradeHubPage.astro']), false);
  });

  it('captures printed worksheet crop sheets at 390 and 1280', () => {
    const source = readFileSync(new URL('./qwen-teacher-shots.mjs', import.meta.url), 'utf8');
    assert.match(source, /width: 390/);
    assert.match(source, /width: 1280/);
    assert.match(source, /#wizard-preview \.crop-sheet/);
    assert.match(source, /teachers-print-page-/);
  });
});
