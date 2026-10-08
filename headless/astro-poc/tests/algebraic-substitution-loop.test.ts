/**
 * The grade-7 substitution lesson replaces only that page's area-model loop.
 * Embed mode hides the lesson chrome. It does not play on load.
 * Each of the four sequences is about 6.5 seconds.
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

describe('algebraic substitution grade 7 film', () => {
  const film = read('public/loops/algebraic-substitution-grade-7.html');
  const shell = read('src/components/AlgebraicSubstitutionLoop.astro');
  const topic = read('src/components/TopicPage.astro');
  const worksheets = read('src/pages/worksheets.astro');

  it('stands alone, paces slowly, and does not play on load', () => {
    assert.equal(film.includes('ממשיכים מהסרטון'), false);
    assert.equal(film.includes('מהסרטון'), false);
    assert.match(film, /<strong>פתיחה וכינוס<\/strong><small>שלושה מופעים של x<\/small>/);
    assert.match(film, /title: 'פתיחת סוגריים וכינוס'/);
    assert.match(film, /stepTimes: \[0, 7\.2, 13\.8, 20\.4\]/);
    assert.match(film, /time < 6\.5 \? 0 : time < 13 \? 1 : time < 19\.5 \? 2 : 3/);
    assert.match(film, /duration: 5\.2, ease: 'none'\}, 20\.8\)/);
    assert.match(film, /selectExample\(0, false\)/);
    assert.match(film, /function motionOff\(\)/);
    assert.match(film, /nd-motion-off/);
    assert.match(film, /noam-a11y-motion/);
    assert.match(film, /prefers-reduced-motion: reduce/);
    assert.equal(/<audio\b|<video\b/i.test(film), false);
  });

  it('hides masthead, title, conclusions, checks, and footer in embed mode', () => {
    assert.match(film, /body\.embed \.page-header,body\.embed \.learning-grid,body\.embed \.insight,body\.embed \.history,body\.embed \.page-footer\{display:none\}/);
    assert.match(film, /get\('embed'\)==='1'\)document\.body\.classList\.add\('embed'\)/);
    assert.match(film, /class="masthead"/);
    assert.match(film, /class="page-footer"/);
    assert.match(film, /בס״ד/);
    assert.match(film, /id="play"/);
  });

  it('mounts only on the grade-7 algebraic-expressions topic page', () => {
    assert.deepEqual(topicLandingLoop(loadTopicPage('algebraic-expressions-grade-7')), {
      kind: 'film',
      marker: 'algebraic-substitution-grade-7',
      src: '/loops/algebraic-substitution-grade-7.html',
    });
    assert.equal(topicLandingLoop(loadTopicPage('distributive-law-grade-9')).variant, 'area-model');
    assert.match(topic, /AlgebraicSubstitutionLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\}/);
    assert.match(shell, /\$\{src\}\?embed=1/);
    assert.match(shell, /height: 800px/);
    assert.match(shell, /height: 560px/);
    assert.match(shell, /substitutionLesson\?\.pause/);
    assert.equal(shell.includes('capture=1'), false);
    assert.equal(worksheets.includes('algebraic-substitution-grade-7'), false);
  });
});
