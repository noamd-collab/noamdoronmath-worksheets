/**
 * Grade 8 statistics film (Noam, 2026-11-09): a narrated player that starts
 * only on a click, loads its narration on demand, hides its own header in
 * embed mode, and pauses for the site's Stop Animations control.
 * It mounts only on the statistics-data-frequency-grade-8 landing page.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('grade 8 statistics film', () => {
  const film = read('public/loops/statistics-frequency.html');
  const shell = read('src/components/StatisticsFrequencyLoop.astro');
  const topic = read('src/components/TopicPage.astro');

  it('is the landing film of the new statistics page only', () => {
    assert.deepEqual(topicLandingLoop(loadTopicPage('statistics-data-frequency-grade-8')), {
      kind: 'film',
      marker: 'statistics-frequency',
      src: '/loops/statistics-frequency.html',
    });
    assert.equal(topicLandingLoop(loadTopicPage('statistics-grade-8')).kind === 'film', false);
    assert.match(topic, /landingLoop\.marker === 'statistics-frequency' && \(\s*<StatisticsFrequencyLoop/);
    assert.match(shell, /\$\{src\}\?embed=1/);
    assert.match(shell, /loading="lazy"/);
  });

  it('keeps the player controls, chapters and transcript in Hebrew RTL', () => {
    assert.match(film, /<html lang="he" dir="rtl">/);
    for (const id of ['play', 'restart', 'chapters', 'mute', 'seek', 'transcript']) {
      assert.match(film, new RegExp(`id="${id}"`), id);
    }
    assert.match(film, /<option value="41\.073">שכיחות יחסית<\/option>/);
    assert.match(film, /min-height:44px/);
  });

  it('never autoplays and loads the narration only on play', () => {
    assert.equal(/\bautoplay\b/.test(film), false);
    assert.match(film, /<audio id="narration" preload="none" src="\/loops\/statistics-frequency\/narration\.[0-9a-f]{10}\.mp3"/);
    assert.equal(film.includes(';base64,'), false, 'assets are files, not inline base64');
    assert.ok(Buffer.byteLength(film) < 200_000);
    for (const [, path] of film.matchAll(/"(\/loops\/statistics-frequency\/[^"]+)"/g)) {
      assert.ok(existsSync(join(root, 'public', path)), path);
    }
    for (const [, path] of film.matchAll(/url\((\/loops\/statistics-frequency\/[^)]+)\)/g)) {
      assert.ok(statSync(join(root, 'public', path)).size > 0, path);
    }
  });

  it('hides the duplicate header in embed mode and honours Stop Animations', () => {
    assert.match(film, /get\('embed'\)==='1'\)document\.body\.classList\.add\('embed'\)/);
    assert.match(film, /body\.embed #player-top,body\.embed #usage\{display:none\}/);
    assert.match(film, /nd-motion-off/);
    assert.match(film, /noam-a11y-motion/);
    assert.match(film, /track\.pause\(\)/);
  });
});
