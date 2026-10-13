/**
 * The grade-9 common-factor file is the fourth full player film,
 * beside the three films that were already mounted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FILM_LANDING_LOOPS, topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('common-factor grade 9 film', () => {
  const film = read('public/loops/common-factor-minus-parentheses-grade-9.html');
  const shell = read('src/components/FactoringFilmLoop.astro');
  const topic = read('src/components/TopicPage.astro');
  const worksheets = read('src/pages/worksheets.astro');

  it('uses a live relative post link, 1.5×, and the play/pause icon fix', () => {
    assert.match(film, /href="\/post\/common-factor-and-minus-parentheses-grade-7"/);
    assert.equal(film.includes('wix-site-host'), false);
    assert.match(film, /<option value="1\.5" selected>1\.5×<\/option>/);
    assert.equal(film.includes('<option value="1" selected>'), false);
    assert.match(film, /byId\('play-icon'\)\.toggleAttribute\('hidden', playing\)/);
    assert.match(film, /byId\('pause-icon'\)\.toggleAttribute\('hidden', !playing\)/);
    assert.equal(film.includes("play-icon').hidden"), false);
    assert.equal(film.includes("pause-icon').hidden"), false);
    assert.match(film, /function motionOff\(\)/);
    assert.match(film, /nd-motion-off/);
    assert.match(film, /noam-a11y-motion/);
    assert.equal(/<audio\b|<video\b/i.test(film), false);
  });

  it('adds the embed hook and keeps phone captions at a readable size', () => {
    assert.match(film, /body\.embed \.masthead,body\.embed \.footer-note\{display:none\}/);
    assert.match(film, /body\.embed\{min-height:0\}/);
    assert.match(film, /get\('embed'\)==='1'\)document\.body\.classList\.add\('embed'\)/);
    assert.match(film, /id="live-caption" class="live-caption"/);
    assert.match(film, /\.live-caption\{[^}]*font-size:16px/);
    assert.match(film, /\.live-caption\{[^}]*min-height:calc\(16px \* 1\.45\)/);
    assert.match(film, /@media\(max-width:520px\)\{\.live-caption\{min-height:calc\(16px \* 1\.45 \* 2\)\}\}/);
    assert.equal(film.includes('.live-caption:empty'), false);
    assert.match(film, /const floor = isNote \? 13 : 15/);
    assert.match(film, /@media\(max-width:410px\)/);
    assert.match(film, /\.clock\{font-size:13px/);
    assert.match(film, /\.chapter-button\{min-height:62px;padding:10px 12px;font-size:14px\}/);
    assert.equal(film.includes('font-size:10px'), false);
    assert.equal(film.includes('font-size:11px'), false);
  });

  it('follows the visible caption instead of the first .caption', () => {
    assert.equal(film.includes("querySelector('.caption')"), false);
    assert.match(film, /doc\.querySelectorAll\('\.caption'\)/);
    assert.match(film, /doc\.querySelectorAll\('\.caption-stage'\)/);
    assert.match(film, /let best = 0\.05/);
    assert.match(film, /if \(opacity > best\)/);
    assert.match(film, /function scheduledCaption\(doc, time\)/);
    assert.match(film, /doc\.defaultView\.algebraLesson/);
    assert.match(film, /if \(time < list\[0\]\[0\]\) return nodes\[0\]/);
    assert.match(film, /const cap = scheduled \|\| active \|\| \(Number\.isFinite\(time\) && time < 0\.8 \? null : shownCaption\)/);
    assert.match(film, /bar\.dataset\.text !== cap\.textContent/);
    assert.match(film, /function tick\(\) \{[\s\S]*?fitReadability\(\)/);
    assert.match(film, /stageEl\.style\.visibility = tooSmall \? 'hidden' : ''/);
    assert.match(film, /node\.style\.visibility = tooSmall \? 'hidden' : ''/);
    assert.match(film, /api\.seek\(0\);\n\s*fitReadability\(\)/);
    assert.match(film, /api\.seek\(time\);\n\s*fitReadability\(\)/);
    assert.match(film, /api\.seek\(t\);\n\s*fitReadability\(\)/);
    assert.match(film, /api\.seek\(0\); fitReadability\(\)/);
  });

  it('mounts as the fourth full player, only on the factoring topic page', () => {
    assert.equal(Object.keys(FILM_LANDING_LOOPS).length, 5);
    assert.deepEqual(topicLandingLoop(loadTopicPage('factoring-grade-9')), {
      kind: 'film',
      marker: 'common-factor-minus-parentheses',
      src: '/loops/common-factor-minus-parentheses-grade-9.html',
    });
    assert.notEqual(topicLandingLoop(loadTopicPage('parallel-lines-angles-grade-8')).marker, 'common-factor-minus-parentheses');
    assert.equal(topicLandingLoop(loadTopicPage('distributive-law-grade-9')).kind, 'concept');
    assert.match(topic, /FactoringFilmLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\}/);
    assert.match(shell, /\$\{src\}\?embed=1/);
    assert.match(shell, /title="גורם משותף ומינוס לפני סוגריים"/);
    assert.match(shell, /s\?\.isPlaying\?\.\(\)\) s\.pause\(\)/);
    assert.equal(worksheets.includes('common-factor-minus-parentheses'), false);
  });
});
