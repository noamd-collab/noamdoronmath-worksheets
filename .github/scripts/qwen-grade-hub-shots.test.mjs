import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { shouldCaptureGradeHubTopics } from './qwen-grade-hub-shots.mjs';

describe('shouldCaptureGradeHubTopics', () => {
  it('runs for the grade hub nav, not for an unrelated page', () => {
    assert.equal(shouldCaptureGradeHubTopics(['headless/astro-poc/src/components/GradeHubPage.astro']), true);
    assert.equal(shouldCaptureGradeHubTopics(['headless/astro-poc/src/lib/elementaryTopicNav.ts']), true);
    assert.equal(shouldCaptureGradeHubTopics(['headless/astro-poc/src/styles/exact-grade.css']), true);
    assert.equal(shouldCaptureGradeHubTopics(['headless/astro-poc/src/pages/index.astro']), false);
    assert.equal(shouldCaptureGradeHubTopics(['headless/astro-poc/src/components/ConceptLoop.astro']), false);
  });

  it('scrolls the topic list into the 390 and 1280 viewports', () => {
    const source = readFileSync(new URL('./qwen-grade-hub-shots.mjs', import.meta.url), 'utf8');
    assert.match(source, /width: 390/);
    assert.match(source, /width: 1280/);
    assert.match(source, /\[data-elementary-topics\]/);
    assert.match(source, /scrollHeight > frame\.clientHeight/);
    assert.match(source, /\/grade-1/);
    assert.match(source, /\/grade-6/);
  });
});
