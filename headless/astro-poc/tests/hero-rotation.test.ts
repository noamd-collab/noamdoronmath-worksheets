/**
 * Home hero rotation: existing loops, real topic pages, design chip and panel.
 * Source and data checks only — the browser check is the preview.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gradeLoopDwellMs } from '../src/lib/gradeLoopRotation.ts';
import { GRADE_LOOP_HOLD_S } from '../src/lib/gradeLoopPools.ts';
import {
  HERO_DEFAULT,
  HERO_DWELL_CAP_MS,
  HERO_DWELL_FALLBACK_MS,
  HERO_DWELL_MIN_MS,
  HERO_PLAY_S,
  HERO_ROTATION,
  createHeroRotation,
  heroChip,
  heroDwellMs,
  heroPanel,
  heroRotationVariant,
  type HeroRotationHost,
} from '../src/lib/heroRotation.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

function heroPool(): string[] {
  const block = read('src/components/HeroLoop.astro').match(/const HERO_POOL = \[([\s\S]*?)\] as const/);
  assert.ok(block);
  return [...block[1].matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);
}

function specsKeys(): Set<string> {
  const source = read('src/lib/conceptLoops.ts');
  const block = source.match(/\nconst SPECS = \{([\s\S]*?)\n\} as const;/);
  assert.ok(block, 'SPECS block must be readable');
  return new Set([...block[1].matchAll(/^\s+'?([a-z0-9-]+)'?:\s*\{/gm)].map((match) => match[1]));
}

describe('home hero rotation', () => {
  const pool = heroPool();
  const specs = specsKeys();

  it('starts on triangle and chips it as כיתה ז׳ · שטח משולש', () => {
    assert.equal(HERO_DEFAULT.variant, 'triangle');
    assert.equal(heroChip(HERO_DEFAULT), 'כיתה ז׳ · שטח משולש');
    assert.equal(HERO_DEFAULT.href, '/triangle-area-grade-7');
    assert.equal(HERO_DEFAULT.panel, '#e3f1ec');
    assert.equal(heroPanel(7), '#e3f1ec');
    assert.equal(heroPanel(6), '#f8ebe0');
  });

  it('rotates a short set of existing loops, each with a real topic page', () => {
    assert.ok(HERO_ROTATION.length >= 6 && HERO_ROTATION.length <= 12);
    assert.equal(new Set(HERO_ROTATION.map((entry) => entry.variant)).size, HERO_ROTATION.length);
    const grades = new Set(HERO_ROTATION.map((entry) => entry.gradeNum));
    assert.ok(grades.has(7) && grades.has(8) && grades.has(9));
    for (const entry of HERO_ROTATION) {
      assert.ok(pool.includes(entry.variant), `${entry.variant} is not an existing hero loop`);
      if (entry.variant === 'angle-sum') {
        assert.equal(specs.has(entry.variant), false, 'angle-sum is the vertex-descent film, not an engine drawing');
      } else {
        assert.ok(specs.has(entry.variant), `${entry.variant} is not in the engine`);
      }
      assert.equal(entry.panel, heroPanel(entry.gradeNum));
      assert.equal(heroChip(entry), `כיתה ${entry.grade} · ${entry.label}`);
      assert.match(entry.href, /^\/[a-z0-9-]+$/);
      assert.equal(loadTopicPage(entry.href.slice(1)).slug, entry.href.slice(1));
      assert.equal(heroRotationVariant(entry.variant), entry.variant);
    }
    assert.equal(heroRotationVariant('not-a-loop'), undefined);
    assert.equal(heroRotationVariant('../triangle'), undefined);
  });

  it('does not inline the unshown loops, and the hero CTAs stay the real catalog URLs', () => {
    const hero = read('src/components/HeroLoop.astro');
    const home = read('src/pages/index.astro');
    const endpoint = read('src/pages/hero-loops/[variant].astro');
    assert.equal((hero.match(/<ConceptLoop\b/g) || []).length, 1);
    assert.doesNotMatch(hero, /<template/);
    assert.match(home, /data-exact-hero-panel/);
    assert.match(home, /href=\{home\.hero\.searchCta\.href\}/);
    assert.match(home, /href="\/worksheets\?grade=1"/);
    assert.match(home, /href="\/worksheets\?grade=7"/);
    assert.doesNotMatch(home, /goGrade3|goGrade7/);
    assert.match(endpoint, /heroRotationVariant/);
    assert.match(endpoint, /x-robots-tag': 'noindex'/);
    assert.doesNotMatch(endpoint, /BaseLayout/);
    assert.match(endpoint, /variant === 'angle-sum'[\s\S]*TriangleAngleSumLoop[\s\S]*src="\/loops\/triangle-angle-sum-vertex-descent\.html"[\s\S]*marker="triangle-angle-sum-vertex-descent"/);
    assert.doesNotMatch(endpoint, /reel\.mp4/);
    assert.equal(read('src/lib/conceptLoops.ts').includes('HERO_ROTATION'), false);
  });

  it('shows each homepage film for one play (8–25 s), not the grade-hub dwell', () => {
    const engine = read('src/lib/conceptLoops.ts');
    const film = read('public/loops/triangle-angle-sum-vertex-descent.html');
    const filmDuration = Number(film.match(/const DURATION=(\d+)/)?.[1]);
    assert.equal(filmDuration, 20);
    for (const entry of HERO_ROTATION) {
      const playS = HERO_PLAY_S[entry.variant];
      assert.equal(typeof playS, 'number', `${entry.variant}: missing play length`);
      if (entry.variant === 'angle-sum') {
        assert.equal(playS, filmDuration);
      } else {
        const row = engine.match(new RegExp(`^\\s+'?${entry.variant}'?:\\s*\\{\\s*duration:\\s*(\\d+)`, 'm'));
        assert.ok(row, `${entry.variant}: duration missing from the engine`);
        assert.equal(playS, Number(row[1]), `${entry.variant}: play length drifted from the film`);
      }
      const dwell = heroDwellMs(playS);
      assert.ok(dwell >= HERO_DWELL_MIN_MS && dwell <= HERO_DWELL_CAP_MS);
      assert.equal(dwell, Math.round(playS * 1000), `${entry.variant}: one play is inside 8–25 s, so it is not shortened or stretched`);
    }
    assert.equal(heroDwellMs(HERO_PLAY_S['diff-sq']), 22_000);
    assert.equal(heroDwellMs(5), HERO_DWELL_MIN_MS);
    assert.equal(heroDwellMs(40), HERO_DWELL_CAP_MS);
    assert.equal(heroDwellMs(undefined), HERO_DWELL_FALLBACK_MS);
    // Grade hub still waits out the slowed diff-sq film. The homepage must not.
    assert.equal(gradeLoopDwellMs(GRADE_LOOP_HOLD_S['diff-sq']), 39_900);
    assert.notEqual(heroDwellMs(HERO_PLAY_S['diff-sq']), gradeLoopDwellMs(GRADE_LOOP_HOLD_S['diff-sq']));
  });
});

describe('homepage hero clock', () => {
  const order = HERO_ROTATION.map((entry) => entry.variant);

  function setup(options: { fail?: boolean } = {}) {
    const env = { inView: true, hidden: false, busy: false };
    const shown: string[] = [];
    let failOnce = options.fail ?? false;
    const host: HeroRotationHost = {
      inView: () => env.inView,
      pageHidden: () => env.hidden,
      busy: () => env.busy,
      mount(variant, fail) {
        if (failOnce) {
          failOnce = false;
          fail();
          return;
        }
        shown.push(variant);
      },
    };
    const rotation = createHeroRotation(host, order, order[0], (variant) => heroDwellMs(HERO_PLAY_S[variant]));
    const advance = (ms: number) => {
      for (let left = ms; left > 0; left -= 500) rotation.tick(Math.min(500, left));
    };
    return { env, shown, rotation, advance };
  }

  it('cycles in HERO_ROTATION order after one play, without an end event or a pause flag', () => {
    const t = setup();
    assert.equal(t.rotation.current(), 'triangle');
    assert.equal(t.rotation.dwell(), 10_000);
    t.advance(10_000 - 500);
    assert.equal(t.rotation.current(), 'triangle');
    assert.deepEqual(t.shown, []);
    t.advance(500);
    assert.equal(t.rotation.current(), 'angle-sum');
    assert.deepEqual(t.shown, ['angle-sum']);
    t.advance(20_000);
    assert.equal(t.rotation.current(), 'para-rect');
    t.advance(10_000 * 4);
    assert.equal(t.rotation.current(), 'area-model');
    t.advance(11_000);
    assert.equal(t.rotation.current(), 'diff-sq');
    assert.equal(t.rotation.dwell(), 22_000);
    t.advance(22_000);
    assert.equal(t.rotation.current(), 'transform');
    t.advance(11_000);
    assert.equal(t.rotation.current(), 'triangle', 'the list wraps');
  });

  it('does not freeze when the tab is hidden, the hero leaves view, or a swap is busy', () => {
    const t = setup();
    t.advance(4_000);
    t.env.hidden = true;
    t.advance(60_000);
    assert.equal(t.rotation.current(), 'triangle');
    assert.equal(t.rotation.elapsed(), 4_000);
    t.env.hidden = false;
    t.advance(6_000);
    assert.equal(t.rotation.current(), 'angle-sum');

    t.advance(5_000);
    t.env.inView = false;
    t.advance(60_000);
    assert.equal(t.rotation.current(), 'angle-sum');
    assert.equal(t.rotation.elapsed(), 5_000);
    t.env.inView = true;
    t.advance(15_000);
    assert.equal(t.rotation.current(), 'para-rect');

    t.advance(2_000);
    t.env.busy = true;
    t.advance(60_000);
    assert.equal(t.rotation.current(), 'para-rect');
    assert.equal(t.rotation.elapsed(), 2_000);
    t.env.busy = false;
    t.advance(8_000);
    assert.equal(t.rotation.current(), 'pythagoras');
  });

  it('returns to the film still on screen when a swap fails, then tries again', () => {
    const t = setup({ fail: true });
    t.advance(10_000);
    assert.equal(t.rotation.current(), 'triangle');
    assert.deepEqual(t.shown, []);
    t.advance(10_000);
    assert.equal(t.rotation.current(), 'angle-sum');
    assert.deepEqual(t.shown, ['angle-sum']);
  });

  it('a shuffle jump starts that film’s dwell over, and a stored pause is not a clock input', () => {
    const t = setup();
    t.advance(9_000);
    t.rotation.jump('diff-sq');
    assert.equal(t.rotation.current(), 'diff-sq');
    assert.equal(t.rotation.elapsed(), 0);
    t.advance(22_000 - 500);
    assert.equal(t.rotation.current(), 'diff-sq');
    t.advance(500);
    assert.equal(t.rotation.current(), 'transform');
  });

  it('a visible tab starts the current dwell over and does not add a tick', () => {
    const t = setup();
    t.advance(4_000);
    assert.equal(t.rotation.elapsed(), 4_000);
    t.rotation.reset();
    assert.equal(t.rotation.current(), 'triangle');
    assert.equal(t.rotation.elapsed(), 0);
    t.advance(10_000 - 500);
    assert.equal(t.rotation.current(), 'triangle');
  });

  it('the homepage clock resumes by resetting, and reduced motion does not press play', () => {
    const controls = read('src/components/ExactHeroControls.astro');
    assert.match(controls, /createHeroRotation\(/);
    assert.match(controls, /heroDwellMs\(HERO_PLAY_S\[variant\]\)/);
    assert.match(controls, /pageHidden: \(\) => document\.hidden/);
    assert.match(controls, /let inView = true/);
    assert.match(controls, /visibilitychange/);
    assert.match(controls, /if \(document\.hidden \|\| reducedMotion\(\)\) return;\s*cycle\.reset\(\)/);
    assert.doesNotMatch(controls, /onVisible[\s\S]{0,160}cycle\.tick/);
    assert.match(controls, /if \(!reducedMotion\(\) && !userHeldPause && inView && !document\.hidden\) startFilm/);
    assert.match(controls, /threshold: 0/);
    assert.match(controls, /if \(!reducedMotion\(\)\) cycle\.tick\(TICK_MS\)/);
    assert.match(controls, /prefers-reduced-motion: reduce/);
    assert.match(controls, /noam-a11y-motion/);
    assert.match(controls, /\.catch\(\(\) => fail\(\)\)/);
    assert.match(controls, /if \(heroTicker\) return/);
    assert.match(controls, /window\.clearInterval\(heroTicker\)/);
    assert.match(controls, /astro:before-swap/);
    assert.match(controls, /astro:page-load/);
    assert.match(controls, /pagehide/);
    assert.match(controls, /if \(event\.persisted\) return/);
    assert.doesNotMatch(controls, /addEventListener\('pageshow'/);
    assert.equal((controls.match(/window\.setInterval\(/g) || []).length, 1);
    assert.doesNotMatch(controls, /gradeLoopDwellMs/);
    assert.doesNotMatch(controls, /manuallyPaused\([^)]*\)[\s\S]{0,80}cycle\.tick/);
    assert.match(controls, /userHeldPause = false;\s*rememberPause\(next, false\)/);
    assert.match(controls, /if \(!event\.isTrusted\) return/);
    assert.match(controls, /rememberPause\(prior, false\)/);
  });
});
