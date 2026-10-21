/**
 * Home hero rotation: existing loops, real topic pages, design chip and panel.
 * Source and data checks only — the browser check is the preview.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gradeLoopDwellMs, shuffleLoops } from '../src/lib/gradeLoopRotation.ts';
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
  heroReturnVariant,
  heroRotationVariant,
  type HeroRotationHost,
} from '../src/lib/heroRotation.ts';
import { TOPIC_PAGE_SLUGS, loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

function heroPool(): string[] {
  const hero = read('src/components/HeroLoop.astro');
  const block = hero.match(/const HERO_POOL = \[([\s\S]*?)\] as const/);
  const extra = hero.match(/const TOPIC_FILMS = \[([\s\S]*?)\] as const/);
  assert.ok(block);
  assert.ok(extra);
  return [...`${block[1]}\n${extra[1]}`.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);
}

/**
 * Audit comment 6251087305 partitions topic pages into MATCH and the three
 * lists in the fixture. The 174-row MATCH table is only in REPORT.md.
 * 162 MATCH topic pages = every served topic slug outside those lists.
 */
function auditMatchSlugs(): Set<string> {
  const audit = JSON.parse(read('tests/fixtures/audit-6251087305-non-match.json')) as {
    wrong_topic: string[];
    wrong_grade: string[];
    generic_thin: string[];
  };
  const excluded = new Set([...audit.wrong_topic, ...audit.wrong_grade, ...audit.generic_thin]);
  assert.equal(excluded.size, 102);
  const match = new Set(TOPIC_PAGE_SLUGS.filter((slug) => !excluded.has(slug)));
  assert.equal(match.size, 162);
  return match;
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

  it('rotates existing loops across grades, each with a real topic page', () => {
    assert.equal(HERO_ROTATION.length, 57);
    assert.equal(new Set(HERO_ROTATION.map((entry) => entry.variant)).size, HERO_ROTATION.length);
    const grades = new Set(HERO_ROTATION.map((entry) => entry.gradeNum));
    for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.ok(grades.has(grade), `grade ${grade}`);
    const hrefOf = (variant: string) => HERO_ROTATION.find((entry) => entry.variant === variant)?.href;
    assert.equal(hrefOf('distributive-area-model-grade-4'), '/distributive-area-model-grade-4');
    assert.equal(hrefOf('fraction-division-meaning-grade-6'), '/fraction-division-meaning-grade-6');
    assert.equal(hrefOf('grade-4-summary'), '/grade-4-summary');
    assert.equal(hrefOf('measurement-geometry-synthesis-grade-6'), '/measurement-geometry-synthesis-grade-6');
    // Re-add once PR 169 mounts the matching film. Audit comment 6251087305
    // marks these pages WRONG-TOPIC, WRONG-GRADE, or GENERIC on main.
    const heldForPr169: Array<[string, string]> = [
      ['birds-sub', '/subtraction-to-10-grade-1'],
      ['neighbors', '/number-neighbors-grade-1'],
      ['place-123', '/hundreds-tens-ones-grade-2'],
      ['odd-pair', '/even-odd-sequences-a-grade-2'],
      ['coins-12', '/money-grade-3'],
      ['two-diag', '/quadrilateral-diagonals-grade-5'],
    ];
    for (const [variant, href] of heldForPr169) {
      assert.equal(hrefOf(variant), undefined, `${variant} stays out until PR 169`);
      assert.equal(HERO_ROTATION.some((entry) => entry.href === href), false, href);
    }
    assert.equal(hrefOf('kite-construct'), undefined, '100 s kite film cannot play in full');
    const blocked: Array<[string, string]> = [
      ['tenframes', '/subtraction-to-10-grade-1'],
      ['area-model', '/algebraic-fractions-grade-9'],
      ['area-model', '/equations-advanced-grade-7'],
      ['balance', '/linear-equations-grade-8'],
      ['sticks', '/hundreds-tens-ones-grade-2'],
      ['obtuse-ht', '/triangle-area-grade-7'],
      ['signed-jump', '/number-line-absolute-value-grade-7'],
      ['sq-stretch', '/area-rectangle-perimeter-grade-7'],
      ['para-perp', '/parallel-lines-angles-grade-8'],
    ];
    for (const [variant, href] of blocked) {
      assert.equal(hrefOf(variant) === href, false, `${variant} must not open ${href}`);
    }
    for (const entry of HERO_ROTATION) {
      assert.ok(pool.includes(entry.variant), `${entry.variant} is not an existing hero loop`);
      if (entry.variant === 'angle-sum') {
        assert.equal(specs.has(entry.variant), false, 'angle-sum is the vertex-descent film, not an engine drawing');
      } else {
        assert.ok(specs.has(entry.variant), `${entry.variant} is not in the engine`);
      }
      assert.equal(entry.panel, heroPanel(entry.gradeNum));
      assert.equal(heroChip(entry), `כיתה ${entry.grade} · ${entry.label}`);
      assert.equal(entry.label.includes('/'), false, `${entry.variant}: a fraction in a chip uses a fraction bar, not a slash`);
      assert.match(entry.href, /^\/[a-z0-9-]+$/);
      const slug = entry.href.slice(1);
      assert.equal(existsSync(join(root, 'src/pages', `${slug}.astro`)), true, `${slug} page`);
      assert.equal(loadTopicPage(slug).slug, slug);
      assert.equal(auditMatchSlugs().has(slug), true, `${slug} is not in the audit MATCH set`);
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
    const topicFilmS = (variant: string) => {
      const source = read(`src/lib/topicFilms/${variant}.ts`);
      const duration = Number(source.match(/duration:\s*(\d+(?:\.\d+)?)/)?.[1]);
      assert.ok(duration > 0, `${variant}: topic film duration`);
      return duration;
    };
    assert.equal(Object.keys(HERO_PLAY_S).length, HERO_ROTATION.length);
    for (const entry of HERO_ROTATION) {
      const playS = HERO_PLAY_S[entry.variant];
      assert.equal(typeof playS, 'number', `${entry.variant}: missing play length`);
      if (entry.variant === 'angle-sum') {
        assert.equal(playS, filmDuration);
      } else if (entry.variant.includes('grade-')) {
        assert.equal(playS, topicFilmS(entry.variant), `${entry.variant}: play length drifted from the film`);
      } else {
        const row = engine.match(new RegExp(`^\\s+'?${entry.variant}'?:\\s*\\{\\s*duration:\\s*(\\d+)`, 'm'));
        assert.ok(row, `${entry.variant}: duration missing from the engine`);
        assert.equal(playS, Number(row[1]), `${entry.variant}: play length drifted from the film`);
      }
      const raw = Math.round(playS * 1000);
      assert.ok(raw <= HERO_DWELL_CAP_MS, `${entry.variant}: ${playS}s is longer than the homepage cap`);
      assert.ok(raw >= HERO_DWELL_MIN_MS, `${entry.variant}: ${playS}s is shorter than one readable play`);
      assert.equal(heroDwellMs(playS), raw, `${entry.variant}: the homepage must play the film in full`);
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

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('homepage hero clock', () => {
  // random() === 0 swaps each index with 0, so the first cycle is known:
  // triangle, para-rect, pythagoras, diff-sq, angle-sum.
  const order = ['triangle', 'angle-sum', 'para-rect', 'pythagoras', 'diff-sq'];
  const dwells: Record<string, number> = {
    triangle: 10_000,
    'angle-sum': 20_000,
    'para-rect': 10_000,
    pythagoras: 10_000,
    'diff-sq': 22_000,
  };

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
    const rotation = createHeroRotation(host, order, order[0], (variant) => dwells[variant] ?? 10_000, {
      random: () => 0,
    });
    const advance = (ms: number) => {
      for (let left = ms; left > 0; left -= 500) rotation.tick(Math.min(500, left));
    };
    return { env, shown, rotation, advance };
  }

  it('plays the server film first, then a shuffle, without an end event or a pause flag', () => {
    const t = setup();
    assert.equal(t.rotation.current(), 'triangle');
    assert.equal(t.rotation.dwell(), 10_000);
    t.advance(10_000 - 500);
    assert.equal(t.rotation.current(), 'triangle');
    assert.deepEqual(t.shown, []);
    t.advance(500);
    assert.equal(t.rotation.current(), 'para-rect');
    assert.deepEqual(t.shown, ['para-rect']);
    t.advance(10_000);
    assert.equal(t.rotation.current(), 'pythagoras');
    t.advance(10_000);
    assert.equal(t.rotation.current(), 'diff-sq');
    assert.equal(t.rotation.dwell(), 22_000);
    t.advance(22_000);
    assert.equal(t.rotation.current(), 'angle-sum');
    t.advance(20_000);
    assert.notEqual(t.rotation.current(), 'angle-sum', 'a new cycle does not repeat the film just shown');
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
    assert.equal(t.rotation.current(), 'para-rect');

    t.advance(5_000);
    t.env.inView = false;
    t.advance(60_000);
    assert.equal(t.rotation.current(), 'para-rect');
    assert.equal(t.rotation.elapsed(), 5_000);
    t.env.inView = true;
    t.advance(5_000);
    assert.equal(t.rotation.current(), 'pythagoras');

    t.advance(2_000);
    t.env.busy = true;
    t.advance(60_000);
    assert.equal(t.rotation.current(), 'pythagoras');
    assert.equal(t.rotation.elapsed(), 2_000);
    t.env.busy = false;
    t.advance(8_000);
    assert.equal(t.rotation.current(), 'diff-sq');
  });

  it('returns to the film still on screen when a swap fails, then tries again', () => {
    const t = setup({ fail: true });
    t.advance(10_000);
    assert.equal(t.rotation.current(), 'triangle');
    assert.deepEqual(t.shown, []);
    t.advance(10_000);
    assert.equal(t.rotation.current(), 'para-rect');
    assert.deepEqual(t.shown, ['para-rect']);
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
    assert.equal(t.rotation.current(), 'angle-sum');
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
    assert.match(controls, /activeLoop\(\)\?\.dataset\.loop \|\| rotation\[0\]\?\.variant \|\| 'triangle'/);
    assert.match(controls, /heroDwellMs\(HERO_PLAY_S\[variant\]\)/);
    assert.match(controls, /HERO_RETURN_KEY/);
    assert.match(controls, /heroReturnVariant\(pool, opener \|\| showing\)/);
    assert.match(controls, /window\.setTimeout\(\(\) => \{\s*if \(reducedMotion\(\) \|\| busy\) return;\s*swapTo\(opener\);/);
    assert.match(controls, /window\.clearTimeout\(returnTimer\)/);
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
    assert.doesNotMatch(controls, /fetch\('\/hero-loops\/'[\s\S]{0,80}document\.body/);
    assert.doesNotMatch(controls, /gradeLoopDwellMs/);
    assert.doesNotMatch(controls, /manuallyPaused\([^)]*\)[\s\S]{0,80}cycle\.tick/);
    assert.match(controls, /userHeldPause = false;\s*rememberPause\(next, false\)/);
    assert.match(controls, /if \(!event\.isTrusted\) return/);
    assert.match(controls, /rememberPause\(prior, false\)/);
  });
});

describe('homepage hero shuffle', () => {
  function host(): HeroRotationHost {
    return {
      inView: () => true,
      pageHidden: () => false,
      busy: () => false,
      mount() {},
    };
  }

  it('shuffles (Fisher–Yates): the server film is first, then a random order of the rest', () => {
    const variants = ['d', 'a', 'b', 'c', 'e', 'f'];
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const shown: string[] = [];
      const rotation = createHeroRotation(
        { ...host(), mount: (variant) => shown.push(variant) },
        variants,
        'd',
        () => 1000,
        { random: seeded(seed) },
      );
      assert.equal(rotation.current(), 'd', 'the server-rendered default plays first');
      for (let i = 0; i < variants.length - 1; i++) rotation.tick(1000);
      assert.deepEqual([...shown].sort(), ['a', 'b', 'c', 'e', 'f'], 'first cycle shows every other film once');
      orders.add(shown.join());
    }
    assert.ok(orders.size > 10, `order must vary between loads (${orders.size} distinct)`);
    const counts = new Map<string, number>();
    const rand = seeded(3);
    for (let i = 0; i < 6000; i++) {
      const key = shuffleLoops(['a', 'b', 'c'], rand).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    assert.equal(counts.size, 6);
    for (const [key, n] of counts) assert.ok(n > 800 && n < 1200, `${key}: ${n} — biased shuffle`);
  });

  it('reshuffles every cycle and never shows the same film twice in a row', () => {
    for (const pool of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e', 'f', 'g']]) {
      for (let seed = 1; seed <= 24; seed++) {
        const shown: string[] = [pool[0]];
        const rotation = createHeroRotation(
          { ...host(), mount: (variant) => shown.push(variant) },
          pool,
          pool[0],
          () => 1000,
          { random: seeded(seed) },
        );
        for (let i = 0; i < pool.length * 8; i++) rotation.tick(1000);
        for (let i = 1; i < shown.length; i++) {
          assert.notEqual(shown[i], shown[i - 1], `seed ${seed}: ${shown.join(' ')}`);
        }
        assert.deepEqual(shown.slice(0, pool.length).sort(), [...pool].sort(), 'the first cycle is a permutation');
        for (let c = pool.length; c + pool.length <= shown.length; c += pool.length) {
          assert.deepEqual(shown.slice(c, c + pool.length).sort(), [...pool].sort(), 'each later cycle is a permutation');
        }
      }
    }
  });

  it('picks a different film for a returning visitor, and never the one on screen', () => {
    const pool = HERO_ROTATION.map((entry) => entry.variant);
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 200; seed++) {
      const next = heroReturnVariant(pool, 'triangle', seeded(seed));
      assert.ok(next);
      assert.notEqual(next, 'triangle');
      assert.ok(pool.includes(next));
      counts.set(next, (counts.get(next) ?? 0) + 1);
    }
    assert.ok(counts.size > 10, 'returning visitors do not all get the same opener');
    assert.equal(heroReturnVariant(['only'], 'only'), undefined);
  });
});
