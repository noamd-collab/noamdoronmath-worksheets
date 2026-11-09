/**
 * Grade 8 statistics film (Noam, 2026-11-09): the landing page plays the
 * animation with no controls and no narration. The narrated player and its
 * mp3 stay in the repo for a direct open of the file. Silent mode pauses
 * for the site's Stop Animations control.
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
    assert.match(shell, /\$\{src\}\?embed=1&silent=1/);
    assert.doesNotMatch(shell, /allowfullscreen|allow="fullscreen"/);
  });

  it('keeps the narrated player in the file and hides it on this page', () => {
    assert.match(film, /<html lang="he" dir="rtl">/);
    for (const id of ['play', 'restart', 'chapters', 'mute', 'seek', 'transcript']) {
      assert.match(film, new RegExp(`id="${id}"`), id);
    }
    assert.match(film, /<option value="41\.073">שכיחות יחסית<\/option>/);
    assert.match(film, /min-height:44px/);
    assert.match(film, /body\.silent #controls,body\.silent #transcript,body\.silent #usage,body\.silent #player-top\{display:none!important\}/);
    assert.match(film, /el\.hidden=true/);
  });

  it('autoplays the animation and never loads the narration in silent mode', () => {
    assert.equal(/<audio[^>]*\bautoplay\b/.test(film), false);
    assert.match(film, /<audio id="narration" preload="none" src="\/loops\/statistics-frequency\/narration\.[0-9a-f]{10}\.mp3"/);
    assert.match(film, /get\('silent'\)==='1'\)\{const t=document\.getElementById\('narration'\)/);
    assert.match(film, /t\.removeAttribute\('src'\)/);
    assert.match(film, /t\.muted=true/);
    assert.match(film, /t\.remove\(\)/);
    const silent = film.slice(film.indexOf("const silent="), film.indexOf('function draw(t)'));
    assert.match(silent, /requestAnimationFrame\(tick\)/);
    assert.equal(silent.includes('track.play'), false);
    assert.equal(silent.includes('muted=false'), false);
    assert.equal(film.includes(';base64,'), false, 'assets are files, not inline base64');
    assert.ok(Buffer.byteLength(film) < 220_000);
    const narration = join(root, 'public/loops/statistics-frequency/narration.ee7f390cbe.mp3');
    assert.ok(statSync(narration).size > 0, 'original narration stays in the repo');
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
    assert.match(film, /function motionOff\(\)/);
  });
});
