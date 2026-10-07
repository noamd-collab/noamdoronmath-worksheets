/**
 * The grade-8 co-interior film stays the approved player:
 * 90 seconds, play/restart/speed, and a 0–45° explore slider.
 * Embed mode only hides the film's own header and footer note.
 * It mounts only on the parallel-lines topic page.
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

describe('parallel co-interior angles film', () => {
  const film = read('public/loops/parallel-cointerior-angles.html');
  const shell = read('src/components/ParallelCointeriorLoop.astro');
  const topic = read('src/components/TopicPage.astro');

  it('keeps the 90s player, explore slider, labels, and live status', () => {
    assert.match(film, /<title>הקבלה וסכום זוויות · נועם דורון<\/title>/);
    assert.match(film, /<h1 class="lesson-name">הקבלה וסכום זוויות<\/h1>/);
    assert.match(film, /let duration = 90/);
    assert.match(film, /max="90"/);
    assert.match(film, /max="45"/);
    assert.match(film, /id="play"/);
    assert.match(film, /id="replay"/);
    assert.match(film, /id="speed"/);
    assert.match(film, /<option value="1\.5" selected>1\.5×<\/option>/);
    assert.equal(film.includes('<option value="1" selected>'), false);
    assert.match(film, /<option value="0\.5">0\.5×<\/option>/);
    assert.match(film, /<option value="0\.75">0\.75×<\/option>/);
    assert.match(film, /<option value="1">1×<\/option>/);
    assert.match(film, /<option value="1\.25">1\.25×<\/option>/);
    assert.match(film, /id="seek"/);
    assert.match(film, /id="explore"/);
    assert.match(film, /id="tilt"/);
    assert.match(film, /aria-label="מיקום בסרטון"/);
    assert.match(film, /aria-label="מהירות נגינה"/);
    assert.match(film, /aria-label="הטיית הישר, מאפס עד ארבעים וחמש מעלות"/);
    assert.match(film, /id="announcement" class="sr-only" role="status" aria-live="polite"/);
    assert.match(film, /lang="he" dir="rtl"/);
    assert.match(film, /stage\.clientWidth \/ 1920/);
    assert.match(film, /aspect-ratio:16\/9/);
    assert.match(film, /@media\(max-width:700px\)/);
    assert.match(film, /@media\(max-width:410px\)/);
    assert.match(film, /frame\.srcdoc/);
    assert.equal(/<audio\b|<video\b/i.test(film), false);
  });

  it('hides only the page header and footer note in embed mode', () => {
    assert.match(film, /body\.embed \.masthead,body\.embed \.footer-note\{display:none\}/);
    assert.match(film, /body\.embed\{min-height:0\}/);
    assert.match(
      film,
      /get\('embed'\)==='1'\)document\.body\.classList\.add\('embed'\)/,
    );
    assert.match(film, /id="play"/);
    assert.match(film, /id="announcement"/);
    assert.equal(film.includes('body.embed .control-panel'), false);
    assert.equal(film.includes('body.embed .player'), false);
    assert.equal(film.includes('body.embed #explore'), false);
  });

  it('mounts that file only on the grade-8 parallel-lines topic page', () => {
    const loop = topicLandingLoop(loadTopicPage('parallel-lines-angles-grade-8'));
    assert.deepEqual(loop, {
      kind: 'film',
      marker: 'parallel-cointerior-angles',
      src: '/loops/parallel-cointerior-angles.html',
    });
    for (const slug of [
      'triangle-quadrilateral-angle-sum-grade-7',
      'exterior-angle-triangle-grade-8',
      'geometric-proof-grade-8',
      'isosceles-triangle-grade-8',
      'angles-grade-7',
    ]) {
      assert.notEqual(topicLandingLoop(loadTopicPage(slug)).marker, 'parallel-cointerior-angles', slug);
    }
    assert.match(topic, /ParallelCointeriorLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\}/);
    assert.match(topic, /marker === 'parallel-cointerior-angles'/);
    assert.match(shell, /\$\{src\}\?embed=1/);
    assert.match(shell, /loading="lazy"/);
    assert.match(shell, /min-width:\s*0/);
    assert.match(shell, /width:\s*100%/);
    assert.match(shell, /title="הקבלה וסכום זוויות"/);
    assert.match(shell, /scrolling="no"/);
    assert.match(shell, /calc\(\(100cqi - 26px\) \* 9 \/ 16 \+ 140px\)/);
    assert.match(shell, /@container \(width > 700px\)/);
    assert.match(shell, /calc\(\(100cqi - 26px\) \* 9 \/ 16 \+ 144px\)/);
    assert.match(shell, /@container \(max-width: 354px\)/);
    assert.match(shell, /@container \(410px < width < 428px\)/);
    assert.match(shell, /player\?\.mathScene/);
    assert.match(shell, /getElementById\('film'\)/);
    assert.match(shell, /s\?\.isPlaying\?\.\(\)\) s\.pause\(\)/);
    assert.equal(shell.includes('השהי'), false);
    assert.equal(shell.includes('display:none'), false);
    assert.equal(shell.includes('.controls'), false);
    assert.equal(shell.includes('capture=1'), false);
  });
});
