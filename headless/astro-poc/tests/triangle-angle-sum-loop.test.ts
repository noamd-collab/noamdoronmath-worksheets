/**
 * The grade-7 angle-sum film stays the provided geometry,
 * with display rounding, a live sum, embed mode, and a 20s clock.
 * It mounts only on the triangle/quadrilateral angle-sum topic page.
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

  it('keeps the film readouts, controls, live sum, and the 20s clock', () => {
    assert.match(film, /<title>הקודקוד יורד והזוויות משתנות \| נועם דורון מתמטיקה<\/title>/);
    assert.match(film, /<h1>סכום זוויות במשולש: <bdi dir="ltr">180°<\/bdi><\/h1>/);
    assert.match(film, /const DURATION=20/);
    assert.match(film, /else h=18\*Math\.exp\(Math\.log\(G\.endH\/18\)\*smooth\(\(t-16\)\/4\)\)/);
    assert.match(film, /const d=current>=19\?/);
    assert.equal(film.includes('const DURATION=24'), false);
    assert.equal(film.includes('מתוך 24'), false);
    assert.match(film, /max="20"/);
    assert.match(film, /00:20/);
    assert.match(film, /id="a-value"/);
    assert.match(film, /id="b-value"/);
    assert.match(film, /id="c-value"/);
    assert.match(film, /id="sum-value"/);
    assert.match(film, /סכום הזוויות כרגע:/);
    assert.match(film, /const aD=a\.toFixed\(precision\),bD=b\.toFixed\(precision\),cD=\(180-Number\(aD\)-Number\(bD\)\)\.toFixed\(precision\)/);
    assert.match(film, /el\['a-arc'\]\.setAttribute\('d',arc\(G\.ax,G\.baseY,78,-ar,0\)\)/);
    assert.match(film, /body\.embed \.heading,body\.embed \.footnote\{display:none\}/);
    assert.match(film, /get\('embed'\)==='1'\)document\.body\.classList\.add\('embed'\)/);
    assert.match(film, /id="play"/);
    assert.match(film, /id="restart"/);
    assert.match(film, /id="seek"/);
    assert.match(film, /lang="he" dir="rtl"/);
    assert.equal(/<audio\b|<video\b/i.test(film), false);
  });

  it('shows angles and a live sum that add to exactly 180 at every 0.01s', () => {
    const DURATION = 20;
    const G = { ax: 128, bx: 1608, cx: 708, baseY: 442, startH: 420, endH: 0.122 };
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const smooth = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
    function mathAt(t) {
      t = clamp(t, 0, DURATION);
      let h;
      if (t < 2.5) h = G.startH;
      else if (t < 16) h = G.startH - 402 * smooth((t - 2.5) / 13.5);
      else h = 18 * Math.exp(Math.log(G.endH / 18) * smooth((t - 16) / 4));
      const ar = Math.atan2(h, G.cx - G.ax);
      const br = Math.atan2(h, G.bx - G.cx);
      return {
        a: (ar * 180) / Math.PI,
        b: (br * 180) / Math.PI,
        c: ((Math.PI - ar - br) * 180) / Math.PI,
        precision: t >= 17 ? 3 : 2,
      };
    }
    let prevA = Infinity;
    let prevB = Infinity;
    let prevC = -Infinity;
    for (let i = 0; i <= 2000; i++) {
      const t = i / 100;
      const { a, b, c, precision } = mathAt(t);
      assert.ok(Math.abs(a + b + c - 180) < 1e-9, `geometry ${t}`);
      const aD = a.toFixed(precision);
      const bD = b.toFixed(precision);
      const cD = (180 - Number(aD) - Number(bD)).toFixed(precision);
      const shown = Number(aD) + Number(bD) + Number(cD);
      const sumText = shown.toFixed(precision);
      assert.equal(sumText, precision === 3 ? '180.000' : '180.00', `t=${t} ${aD}+${bD}+${cD}`);
      assert.ok(Math.abs(shown - 180) < 1e-9, `numeric sum t=${t}`);
      if (i > 0) {
        assert.ok(a <= prevA + 1e-9, `A rose at ${t}`);
        assert.ok(b <= prevB + 1e-9, `B rose at ${t}`);
        assert.ok(c >= prevC - 1e-9, `C fell at ${t}`);
      }
      prevA = a;
      prevB = b;
      prevC = c;
    }
  });

  it('mounts that file only on the grade-7 angle-sum topic page', () => {
    const loop = topicLandingLoop(loadTopicPage('triangle-quadrilateral-angle-sum-grade-7'));
    assert.deepEqual(loop, {
      kind: 'film',
      marker: 'triangle-angle-sum-vertex-descent',
      src: '/loops/triangle-angle-sum-vertex-descent.html',
    });
    for (const slug of [
      'angles-introduction-measurement-grade-7',
      'adjacent-vertical-angles-grade-7',
      'triangle-area-grade-7',
    ]) {
      assert.notEqual(topicLandingLoop(loadTopicPage(slug)).kind, 'film', slug);
    }
    assert.match(topic, /TriangleAngleSumLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\}/);
    assert.match(shell, /\$\{src\}\?embed=1/);
    assert.equal(shell.includes('capture=1'), false);
    assert.equal(shell.includes('display:none'), false);
    assert.equal(shell.includes('.controls'), false);
  });
});
