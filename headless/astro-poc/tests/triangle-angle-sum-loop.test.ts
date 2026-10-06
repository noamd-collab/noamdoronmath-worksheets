/**
 * The grade-7 angle-sum film is the provided HTML, unchanged,
 * mounted only on the triangle/quadrilateral angle-sum topic page.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('triangle angle-sum vertex descent film', () => {
  const film = read('public/loops/triangle-angle-sum-vertex-descent.html');
  const shell = read('src/components/TriangleAngleSumLoop.astro');
  const topic = read('src/components/TopicPage.astro');

  it('keeps the provided film, including readouts, controls, and the 24s clock', () => {
    assert.match(film, /<title>הקודקוד יורד והזוויות משתנות \| נועם דורון מתמטיקה<\/title>/);
    assert.match(film, /<h1>סכום זוויות במשולש: <bdi dir="ltr">180°<\/bdi><\/h1>/);
    assert.match(film, /const DURATION=24/);
    assert.match(film, /id="a-value"/);
    assert.match(film, /id="b-value"/);
    assert.match(film, /id="c-value"/);
    assert.match(film, /id="play"/);
    assert.match(film, /id="restart"/);
    assert.match(film, /id="seek"/);
    assert.match(film, /lang="he" dir="rtl"/);
    assert.equal(/<audio\b|<video\b/i.test(film), false);
  });

  it('mounts that file only on the grade-7 angle-sum topic page', () => {
    const loop = topicLandingLoop(loadTopicPage('triangle-quadrilateral-angle-sum-grade-7'));
    assert.deepEqual(loop, {
      kind: 'film',
      marker: 'triangle-angle-sum-vertex-descent',
      src: '/loops/triangle-angle-sum-vertex-descent.html',
    });
    for (const slug of [
      'angles-grade-7',
      'angles-introduction-measurement-grade-7',
      'adjacent-vertical-angles-grade-7',
      'triangle-area-grade-7',
    ]) {
      assert.notEqual(topicLandingLoop(loadTopicPage(slug)).kind, 'film', slug);
    }
    assert.match(topic, /TriangleAngleSumLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\}/);
    assert.match(shell, /src=\{src\}/);
    assert.equal(shell.includes('capture=1'), false);
    assert.equal(shell.includes('display:none'), false);
    assert.equal(shell.includes('.controls'), false);
  });
});
