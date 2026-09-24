/**
 * Headless learning logo survives a viewer-asset sync, without running it.
 * The fixture is the upstream shell before injection. The transform must be
 * idempotent and must not duplicate בס״ד or the logo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ensureHeadlessLearningChrome } from '../scripts/sync-viewer-assets.mjs';

const upstream = `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><title>הלמידה שלי</title></head>
<body class="nl-page"><div class="nl-shell"><header class="nl-header"><a class="nl-brand" href="/">נועם דורון מתמטיקה</a><a href="/worksheets">לכל דפי העבודה — ללא כניסה</a></header>
<main><div id="learning-app"></div></main></div></body></html>`;

function count(html: string, needle: string) {
  return html.split(needle).length - 1;
}

describe('learning brand sync transform', () => {
  it('injects בס״ד and one logo, then stays unchanged on a second run', () => {
    const once = ensureHeadlessLearningChrome(upstream);
    const twice = ensureHeadlessLearningChrome(once);
    assert.equal(twice, once);
    assert.equal(count(once, 'data-basad'), 1);
    assert.equal(count(once, 'id="nl-basad-headless"'), 1);
    assert.equal(count(once, '<img class="nl-brand__logo"'), 1);
    assert.ok(once.includes('src="/brand/noam-doron-math-logo-cropped.png"'));
    assert.ok(once.includes('right:12px'));
    assert.ok(once.includes('.nl-brand__logo{'));
    assert.ok(!once.includes('נועם דורון מתמטיקה</a>'));
    assert.ok(once.includes('href="/worksheets"'));
  });

  it('does not add a second logo when the shell already has one', () => {
    const once = ensureHeadlessLearningChrome(upstream);
    const twice = ensureHeadlessLearningChrome(once);
    const thrice = ensureHeadlessLearningChrome(twice);
    assert.equal(count(thrice, '<img class="nl-brand__logo"'), 1);
    assert.equal(count(thrice, 'id="nl-basad-headless"'), 1);
    assert.equal(count(thrice, '<div class="nl-basad"'), 1);
  });
});
