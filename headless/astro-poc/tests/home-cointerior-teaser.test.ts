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

describe('home co-interior teaser removed per Noam', () => {
  const home = read('src/pages/index.astro');
  const worksheets = read('src/pages/worksheets.astro');

  it('keeps the co-interior teaser off the home page and worksheets page', () => {
    assert.equal(home.includes('HomeCointeriorLoop'), false);
    assert.equal(home.includes('home-cointerior'), false);
    assert.equal(worksheets.includes('HomeCointeriorLoop'), false);
    assert.equal(worksheets.includes('home-cointerior'), false);
  });

  it('keeps the merged parallel-lines film on its topic page', () => {
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
