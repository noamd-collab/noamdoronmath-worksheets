/**
 * The grade-9 distance film is the attached animation, unchanged,
 * with playback owned by the embed wrapper.
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

describe('distance-between-points film', () => {
  const film = read('public/loops/distance-between-points.html');
  const shell = read('src/components/DistancePointsLoop.astro');

  it('keeps the attached film, including its own controls and 19s clock', () => {
    assert.match(film, /<title>המרחק בין שתי נקודות — אנימציה רציפה<\/title>/);
    assert.match(film, /const DURATION=19;/);
    assert.match(film, /id="playButton"/);
    assert.match(film, /id="replayButton"/);
    assert.match(film, /id="seek"/);
    assert.match(film, /No autoplay or network request/);
    assert.match(film, /\.capture \.controls\{display:none\}/);
    assert.equal(/<audio\b|<video\b/i.test(film), false);
    assert.equal(film.includes('analytic-geometry'), false);
  });

  it('mounts that file only on the grade-9 analytic geometry landing', () => {
    const loop = topicLandingLoop(loadTopicPage('analytic-geometry-grade-9'));
    assert.deepEqual(loop, {
      kind: 'film',
      marker: 'distance-between-points',
      src: '/loops/distance-between-points.html',
    });
    assert.equal(topicLandingLoop(loadTopicPage('coordinate-plane-applications-grade-9')).kind, 'css');
    assert.match(read('src/components/TopicPage.astro'), /DistancePointsLoop/);
    assert.match(shell, /src=\{frameSrc\}/);
    assert.match(shell, /capture=1&t=0/);
  });

  it('auto-starts, loops, pauses off-screen, and keeps a single pause control', () => {
    assert.match(shell, /playButton/);
    assert.match(shell, /replayButton/);
    assert.match(shell, /IntersectionObserver/);
    assert.match(shell, /prefers-reduced-motion:\s*reduce/);
    assert.match(shell, /html\.nd-motion-off/);
    assert.match(shell, /html\.noam-a11y-motion/);
    assert.match(shell, /animationDuration/);
    assert.match(shell, /data-distance-pause/);
    assert.match(shell, /השהיית הנפשה/);
    assert.match(shell, /הפעלת הנפשה/);
    assert.equal(shell.includes('id="replayButton"'), false);
    assert.equal(shell.includes('type="range"'), false);
    assert.match(shell, /max-width:\s*720px/);
    assert.match(shell, /aspect-ratio:\s*16 \/ 9/);
  });
});
