/**
 * The home page gets a short silent co-interior picture.
 * It is not the grade-8 player, and that topic page stays on the merged film.
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

describe('home co-interior teaser', () => {
  const home = read('src/pages/index.astro');
  const loop = read('src/components/HomeCointeriorLoop.astro');
  const worksheets = read('src/pages/worksheets.astro');

  it('is a light linked picture, not an iframe and not a paragraph', () => {
    assert.match(home, /<HomeCointeriorLoop \/>/);
    assert.match(loop, /href="\/parallel-lines-angles-grade-8"/);
    assert.match(loop, /data-home-cointerior/);
    assert.match(loop, /prefers-reduced-motion:\s*reduce/);
    assert.match(loop, /html\.nd-motion-off/);
    assert.match(loop, /html\.noam-a11y-motion/);
    assert.match(loop, /animation-play-state:\s*paused/);
    assert.match(loop, /IntersectionObserver/);
    assert.equal(loop.includes('<iframe'), false);
    assert.equal(/<p[\s>]/.test(loop), false);
    assert.equal(/<audio\b|<video\b/i.test(loop), false);
    assert.equal(worksheets.includes('HomeCointeriorLoop'), false);
    assert.equal(worksheets.includes('home-cointerior'), false);
  });

  it('does not replace the merged parallel-lines film', () => {
    assert.deepEqual(topicLandingLoop(loadTopicPage('parallel-lines-angles-grade-8')), {
      kind: 'film',
      marker: 'parallel-cointerior-angles',
      src: '/loops/parallel-cointerior-angles.html',
    });
    const film = read('public/loops/parallel-cointerior-angles.html');
    assert.match(film, /let duration = 90/);
    assert.match(film, /byId\('play-icon'\)\.toggleAttribute\('hidden', playing\)/);
  });
});
