/**
 * Grade 8 statistics film: silent in every mode, including a direct open.
 * Animation clock, no audio markup and no narration file, one pause/resume control.
 * It does not loop. Stop Animations still pauses it.
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
    assert.equal(topicLandingLoop(loadTopicPage('parallel-lines-angles-grade-8')).src === '/loops/statistics-frequency.html', false);
    assert.match(topic, /landingLoop\.marker === 'statistics-frequency' && \(\s*<StatisticsFrequencyLoop/);
    assert.match(shell, /\$\{src\}\?embed=1/);
    assert.match(shell, /loading="eager"/);
    assert.equal(shell.includes('allowfullscreen'), false);
    assert.equal(topic.includes('<StatisticsFrequencyLoop'), true);
    assert.equal(topic.split('<StatisticsFrequencyLoop').length, 2);
  });

  it('keeps a single Hebrew pause/resume toggle and no other controls', () => {
    assert.match(film, /<html lang="he" dir="rtl">/);
    assert.match(film, /<button id="play" type="button" aria-label="הפעלת האנימציה" aria-pressed="false">▶ הפעלה<\/button>/);
    assert.match(film, /aria-label','השהיית האנימציה'/);
    assert.match(film, /aria-label','המשך האנימציה'/);
    assert.match(film, /min-height:44px/);
    assert.match(film, /touch-action:manipulation/);
    assert.match(film, /#controls\{display:flex;justify-content:center;padding:8px 0 2px;background:transparent/);
    assert.match(film, /#play\{[^}]*width:auto/);
    assert.match(film, /border-radius:999px/);
    assert.equal(film.includes('#play{width:100%'), false);
    assert.equal(film.includes('min-width:8.5rem'), false);
    for (const id of ['restart', 'chapters', 'mute', 'seek', 'transcript', 'fullscreen', 'usage']) {
      assert.equal(film.includes(`id="${id}"`), false, id);
    }
    assert.equal(/<audio\b/i.test(film), false);
    assert.equal(/<video\b/i.test(film), false);
    assert.equal(/<(input|select)\b/i.test(film), false);
    assert.equal((film.match(/<button\b/g) || []).length, 1);
  });

  it('autoplays in silence and does not loop or request the narration', () => {
    assert.match(film, /function startSilentAutoplay\(\)/);
    assert.match(film, /window\.__statsFilm=\{silent:true,loop:false,audio:false/);
    for (const token of ['<audio', '.mp3', 'narration.', 'mute']) {
      assert.equal(film.includes(token), false, token);
    }
    assert.equal(existsSync(join(root, 'public/loops/statistics-frequency/narration.ee7f390cbe.mp3')), false);
    assert.equal(/\bautoplay\b/.test(film.replace('startSilentAutoplay', '')), false);
    assert.equal(film.includes(';base64,'), false, 'assets are files, not inline base64');
    assert.ok(Buffer.byteLength(film) < 200_000);
    for (const [, path] of film.matchAll(/"(\/loops\/statistics-frequency\/[^"]+)"/g)) {
      assert.ok(existsSync(join(root, 'public', path)), path);
    }
    for (const [, path] of film.matchAll(/url\((\/loops\/statistics-frequency\/[^)]+)\)/g)) {
      assert.ok(statSync(join(root, 'public', path)).size > 0, path);
    }
  });

  it('widens this film on a phone and leaves other films alone', () => {
    assert.match(shell, /@media \(max-width: 767px\)[\s\S]*exact-topic-demo--stats-film[\s\S]*width: calc\(100% \+ 120px\)/);
    assert.match(topic, /landingLoop\.marker === 'statistics-frequency' && 'exact-topic-demo--stats-film'/);
    assert.equal(read('src/components/ParallelCointeriorLoop.astro').includes('100vw'), false);
    assert.equal(read('src/components/TriangleAngleSumLoop.astro').includes('exact-topic-demo--stats-film'), false);
  });

  it('hides the duplicate header in embed mode and honours Stop Animations', () => {
    assert.match(film, /get\('embed'\)==='1'\)document\.body\.classList\.add\('embed'\)/);
    assert.match(film, /body\.embed #player-top\{display:none\}/);
    assert.match(film, /nd-motion-off/);
    assert.match(film, /noam-a11y-motion/);
    assert.match(film, /function motionOff\(\)/);
    assert.match(film, /if\(motionOff\(\)\|\|document\.hidden\)\{stopPlayback\(\);return;\}/);
  });
});
