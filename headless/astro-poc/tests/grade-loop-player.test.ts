/**
 * Grade-hub rotating loop player: pool contract, render contract and rotation
 * policy. Deterministic, no browser: rotation runs the real policy module
 * under node:test mock timers; the DOM adapter is checked as a source contract.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GRADE_HUB_GRADES, type GradeHubGrade } from '../src/lib/gradeHubs.ts';
import {
  EXCLUDED_GRADE_LOOPS,
  GRADE_LOOP_DEFAULTS,
  GRADE_LOOP_HOLD_S,
  buildGradeLoopPool,
  gradeLoopDomain,
  gradeLoopMap,
} from '../src/lib/gradeLoopPools.ts';
import {
  GRADE_LOOP_DWELL_MS,
  GRADE_LOOP_HOLD_AT_MS,
  createGradeLoopRotation,
  shuffleLoops,
  type GradeLoopRotationOptions,
  type GradeLoopState,
} from '../src/lib/gradeLoopRotation.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const player = read('src/components/GradeLoopPlayer.astro');
const hubPage = read('src/components/GradeHubPage.astro');
const gradeCss = read('src/styles/exact-grade.css');

function engineHolds(): Record<string, number> {
  const source = read('src/lib/conceptLoops.ts');
  const consts = new Map(
    [...source.matchAll(/^const ([A-Z0-9_]+_HOLD) = ([\d.]+);$/gm)].map((m) => [m[1], Number(m[2])])
  );
  return Object.fromEntries(
    [...source.matchAll(/^\s+'?([a-z0-9-]+)'?:\s*\{ duration: [\d.]+, hold: ([A-Z0-9_]+), render/gm)].map(
      (m) => [m[1], consts.get(m[2])]
    )
  );
}

/** Deterministic PRNG (mulberry32) so shuffles are reproducible. */
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

function specsKeys(): Set<string> {
  const source = read('src/lib/conceptLoops.ts');
  const block = source.match(/\nconst SPECS = \{([\s\S]*?)\n\} as const;/);
  assert.ok(block, 'SPECS block must be readable');
  return new Set([...block[1].matchAll(/^\s+'?([a-z0-9-]+)'?:\s*\{/gm)].map((m) => m[1]));
}

function heroPool(): string[] {
  const block = read('src/components/HeroLoop.astro').match(/const HERO_POOL = \[([\s\S]*?)\] as const/);
  assert.ok(block);
  return [...block[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
}

function heroLabels(): Record<string, string> {
  const block = read('src/components/ExactHeroControls.astro').match(/const topics = \{([\s\S]*?)\n\};/);
  assert.ok(block);
  return Object.fromEntries(
    [...block[1].matchAll(/^\s+'?([a-z0-9-]+)'?:\s*\['([^']+)'/gm)].map((m) => [m[1], m[2]])
  );
}

describe('grade loop pools (LOOPS_MAP_73_v2)', () => {
  const specs = specsKeys();

  for (const grade of GRADE_HUB_GRADES) {
    it(`grade ${grade}: non-empty, default first, every variant in SPECS`, () => {
      const pool = buildGradeLoopPool(grade);
      assert.ok(pool.length >= 2, `grade ${grade} needs at least two loops to rotate`);
      assert.equal(pool[0].variant, GRADE_LOOP_DEFAULTS[grade]);
      assert.equal(new Set(pool.map((entry) => entry.variant)).size, pool.length);
      for (const entry of pool) {
        assert.ok(specs.has(entry.variant), `${entry.variant}: unknown to the engine`);
        assert.ok(entry.label.trim().length > 0 && entry.label.length <= 32);
      }
    });

    it(`grade ${grade}: links are a same-grade topic page or the grade catalog`, () => {
      for (const { variant, href } of buildGradeLoopPool(grade)) {
        if (href.startsWith('/worksheets')) {
          assert.equal(href, `/worksheets?grade=${grade}`, `${variant}: catalog must be filtered to the grade`);
        } else {
          const slug = href.slice(1);
          assert.equal(loadTopicPage(slug).slug, slug, `${variant}: topic page must be served`);
          assert.match(slug, new RegExp(`-grade-${grade}(?:-|$)`), `${variant}: topic page from another grade`);
        }
      }
    });
  }

  it('covers all 73 hero variants exactly once: mapped to one grade or explicitly excluded', () => {
    const mapped = gradeLoopMap().map((loop) => loop.variant);
    const excluded = Object.keys(EXCLUDED_GRADE_LOOPS);
    assert.equal(new Set(mapped).size, mapped.length, 'a variant is in two pools');
    assert.deepEqual([...mapped, ...excluded].sort(), heroPool().sort());
    assert.deepEqual(excluded.sort(), ['array', 'pct-25', 'topic-card', 'tri-sort']);
    const total = GRADE_HUB_GRADES.reduce((sum, grade) => sum + buildGradeLoopPool(grade).length, 0);
    assert.equal(total, 69);
  });

  it('reuses the QA’d hero chip labels', () => {
    const labels = heroLabels();
    for (const loop of gradeLoopMap()) assert.equal(loop.label, labels[loop.variant], loop.variant);
  });

  it('every pooled loop has a curriculum domain for the text block', () => {
    for (const loop of gradeLoopMap()) {
      assert.notEqual(gradeLoopDomain(loop.variant), 'הדגמה מתמטית', `${loop.variant}: no domain`);
    }
    for (const grade of GRADE_HUB_GRADES) {
      for (const entry of buildGradeLoopPool(grade)) assert.equal(entry.domain, gradeLoopDomain(entry.variant));
    }
  });

  it('hold times mirror the engine SPECS exactly (completed frame, before the 12 s hold)', () => {
    const holds = engineHolds();
    assert.equal(Object.keys(GRADE_LOOP_HOLD_S).length, gradeLoopMap().length);
    for (const loop of gradeLoopMap()) {
      assert.equal(GRADE_LOOP_HOLD_S[loop.variant], holds[loop.variant], `${loop.variant}: hold drifted from engine`);
      assert.ok(holds[loop.variant]! < GRADE_LOOP_HOLD_AT_MS / 1000);
    }
    for (const grade of GRADE_HUB_GRADES) {
      for (const entry of buildGradeLoopPool(grade)) assert.equal(entry.hold, holds[entry.variant]);
    }
  });

  it('defaults match the fixed mapping GradeHubPage renders today', () => {
    for (const grade of GRADE_HUB_GRADES) {
      const match = hubPage.match(new RegExp(`grade === ${grade}\\s*\\?\\s*'([a-z-]+)'`));
      assert.ok(match, `grade ${grade} missing from loopVariant`);
      assert.equal(match[1], GRADE_LOOP_DEFAULTS[grade as GradeHubGrade]);
    }
  });
});

describe('GradeLoopPlayer render contract', () => {
  it('renders the default loop live and one template per other pool variant', () => {
    assert.match(player, /<div data-grade-loop-current>\s*<ConceptLoop variant=\{defaultVariant as Variant\} \/>\s*<\/div>/);
    assert.match(player, /others\.map\(\(entry\) => \(\s*<template data-grade-loop-variant=\{entry\.variant\}>\s*<ConceptLoop variant=\{entry\.variant as Variant\} \/>\s*<\/template>/);
    assert.match(player, /const others = pool\.filter\(\(entry\) => entry\.variant !== defaultVariant\)/);
    for (const grade of GRADE_HUB_GRADES) {
      const pool = buildGradeLoopPool(grade);
      const templates = pool.filter((entry) => entry.variant !== GRADE_LOOP_DEFAULTS[grade]);
      assert.equal(templates.length, pool.length - 1, `grade ${grade}: default must not be templated`);
    }
  });

  it('no-JS default render is unchanged: the fixed grade loop is live, nothing else is', () => {
    assert.match(player, /<div data-grade-loop-current>\s*<ConceptLoop variant=\{defaultVariant as Variant\} \/>\s*<\/div>/);
    assert.equal((player.match(/<ConceptLoop /g) || []).length, 2, 'one live default + one inside <template>');
    assert.match(hubPage, /defaultVariant=\{loopVariant\}/);
    // JS-only chrome ships hidden, so the no-JS page gains no empty bar or dead buttons.
    assert.match(player, /data-grade-loop-progress aria-hidden="true" hidden>/);
    assert.match(player, /data-grade-loop-pause[\s\S]*?hidden\s*>/);
    assert.match(player, /data-grade-loop-next[\s\S]*?hidden\s*>/);
  });

  it('shows the static grade tag above the card, also in the accessible name', () => {
    assert.match(player, /const gradeTag = `הדגמה · כיתה \$\{gradeLabel\}`/);
    assert.match(player, /const gradeLabel = gradeHubLabel\(grade\)/);
    assert.match(player, /<div class="grade-loop" data-grade-loop role="group" aria-label=\{gradeTag\}>\s*<p class="grade-loop__grade" data-grade-loop-grade>\{gradeTag\}<\/p>\s*<div data-grade-loop-current>/);
    assert.doesNotMatch(player.split('<script>')[1], /data-grade-loop-grade/, 'the tag is static, never rewritten');
  });

  it('server-renders the 4-line text block, with accessible controls', () => {
    assert.match(player, /data-grade-loop-text aria-live="polite"/);
    assert.match(
      player,
      /data-grade-loop-domain>\{defaultEntry\.domain\}<\/p>\s*<p class="grade-loop__title" data-grade-loop-label>\{defaultEntry\.label\}<\/p>\s*<p class="grade-loop__explain">\{GRADE_LOOP_EXPLANATION\}<\/p>\s*<a/
    );
    assert.match(player, /href=\{defaultEntry\.href\}[\s\S]*?>\s*לדפי העבודה בנושא ←\s*<\/a>/);
    assert.match(player, /<button\s+type="button"[\s\S]*?data-grade-loop-next[\s\S]*?aria-label="ללולאה הבאה"/);
    assert.match(player, /data-grade-loop-pause[\s\S]*?aria-label="השהיית ההדגמות"/);
    assert.match(player, /event\.key !== 'ArrowLeft'/);
  });

  it('styles follow the final design decisions', () => {
    const css = player.split('<style>')[1];
    const rule = (selector: string) => {
      const m = css.match(new RegExp(`\\n  ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
      assert.ok(m, `${selector} rule`);
      return m[1];
    };
    assert.match(rule('.grade-loop__progress-fill'), /background: #2a7c7a;/);
    assert.match(rule('.grade-loop__progress-fill'), /transform-origin: right center;/);
    const button = rule('.grade-loop__pause,\n  .grade-loop__next');
    assert.match(button, /min-block-size: 44px;/);
    assert.match(button, /border: 2px solid #22305a;/);
    assert.match(button, /border-radius: 12px;/);
    assert.match(rule('.grade-loop__pause'), /inline-size: 44px;/);
    assert.match(rule('.grade-loop__domain'), /font-size: 14px;[\s\S]*color: #5a6588;/);
    assert.match(rule('.grade-loop__title'), /font-family: 'Secular One'[\s\S]*font-size: clamp\(26px, 2\.6vw, 32px\);/);
    assert.match(rule('.grade-loop__explain'), /font-size: 19px;/);
    assert.match(rule('.grade-loop__link'), /min-block-size: 44px;[\s\S]*color: #1e605e;/);
    assert.match(rule('.grade-loop__link:hover'), /color: #e5735c;/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.grade-loop__progress-fill \{\s*transition: none;/);
    assert.doesNotMatch(css, /\b(margin|padding)-(left|right)\b|\b(left|right):/, 'logical properties only');
  });

  it('mobile puts the diagram first and its text after; desktop grid is untouched', () => {
    const mobile = gradeCss.split('@media (max-width: 851.98px)')[1];
    assert.ok(mobile);
    assert.match(mobile, /concept-loop__svg \{ order: 0; \}/);
    assert.match(mobile, /concept-loop__top \{ order: 1; \}/);
    assert.match(mobile, /concept-loop__formula \{ order: 2; \}/);
    assert.match(mobile, /concept-loop__caption \{ order: 3; \}/);
    assert.match(gradeCss.split('@media')[0], /\.concept-loop__svg \{\s*grid-column: 2;\s*grid-row: 1 \/ 4;/);
  });

  it('hold phase freezes on the engine completed frame via __loop.seek + pause', () => {
    assert.match(
      player,
      /hold\(variant\) \{\s*const loop = mounted\.get\(variant\);\s*const hold = entries\.get\(variant\)\?\.hold;\s*if \(!loop\?\.__loop \|\| typeof hold !== 'number'\) return;\s*loop\.__loop\.seek\(hold\);\s*loop\.__loop\.pause\(\);/
    );
    assert.match(player, /approved fallback/);
    assert.match(read('src/lib/gradeLoopRotation.ts'), /future speed option in the engine/);
  });

  it('is mounted inside the existing player shell with the grade pool', () => {
    assert.match(hubPage, /const gradePool = buildGradeLoopPool\(grade\)/);
    assert.match(
      hubPage,
      /<article class="exact-grade__player"[^>]*>\s*<GradeLoopPlayer grade=\{grade\} pool=\{gradePool\} defaultVariant=\{loopVariant\} \/>\s*<\/article>/
    );
    assert.match(hubPage, /exact-grade__pencil/);
    assert.doesNotMatch(hubPage, /<ConceptLoop\b/);
  });

  it('swaps like ExactHeroControls: cached nodes, one init per variant, one timer', () => {
    assert.match(player, /prior\?\.__loop\?\.pause\(\);\s*if \(prior\) cache\.append\(prior\);\s*current\.append\(next\)/);
    assert.match(player, /if \(firstVisit\) initConceptLoops\(\)/);
    assert.equal((player.match(/initConceptLoops\(\)/g) || []).length, 1);
    assert.match(player, /cache\.hidden = true/);
    assert.doesNotMatch(player, /replaceChildren|prior\??\.remove\(/);
    assert.equal((player.match(/window\.setInterval\(/g) || []).length, 1);
    assert.match(player, /k3-pause:/);
    assert.match(player, /!adapted\.has\(loop\)/);
    assert.match(player, /event\.key === 'Enter' \|\| event\.key === ' ' \|\| event\.key === 'Spacebar'/);
    assert.match(player, /new IntersectionObserver\(/);
  });
});

describe('grade loop rotation policy', () => {
  type Fake = GradeLoopState & { paused: boolean; t: number };

  function setup(variants = ['a', 'b', 'c'], options: GradeLoopRotationOptions = {}) {
    const loops = new Map<string, Fake>(
      variants.map((v) => [v, { playing: true, done: false, static: false, paused: false, t: 0 }])
    );
    const env = { inView: true, hidden: false };
    const mounts: Array<[string, boolean]> = [];
    const calls: string[] = [];
    // Mirrors the player's hold(): the engine hook's seek then pause.
    const hook = (v: string) => ({
      seek: (tt: number) => { calls.push(`${v}:seek(${tt})`); loops.get(v)!.t = tt; },
      pause: () => { calls.push(`${v}:pause`); loops.get(v)!.playing = false; },
    });
    const rotation = createGradeLoopRotation(
      {
        inView: () => env.inView,
        pageHidden: () => env.hidden,
        state: (v) => loops.get(v),
        manuallyPaused: (v) => loops.get(v)?.paused ?? false,
        mount: (v, first) => {
          mounts.push([v, first]);
          loops.get(v)!.playing = true;
        },
        hold: (v) => {
          hook(v).seek(GRADE_LOOP_HOLD_S[v] ?? 5);
          hook(v).pause();
        },
      },
      variants,
      variants[0],
      { random: seeded(7), ...options }
    );
    mock.timers.enable({ apis: ['setInterval'] });
    const timer = setInterval(() => rotation.tick(500), 500);
    const advance = (ms: number) => mock.timers.tick(ms);
    const done = () => {
      clearInterval(timer);
      mock.timers.reset();
    };
    return { loops, env, mounts, calls, rotation, advance, done };
  }

  it('swaps every 15 s (calibration 8–45 s), without waiting for the 4-lap park', () => {
    assert.equal(GRADE_LOOP_DWELL_MS, 15_000);
    assert.equal(GRADE_LOOP_HOLD_AT_MS, 12_000);
    assert.match(read('src/lib/gradeLoopRotation.ts'), /Calibration range 8–45 s per loop/);
    const t = setup();
    try {
      const first = t.rotation.current();
      t.advance(GRADE_LOOP_DWELL_MS - 500);
      assert.equal(t.rotation.current(), first);
      t.advance(500);
      assert.notEqual(t.rotation.current(), first);
      assert.equal(t.mounts.length, 1);
      assert.equal(t.rotation.elapsed(), 0);
      t.advance(GRADE_LOOP_DWELL_MS);
      assert.equal(t.mounts.length, 2);
    } finally {
      t.done();
    }
  });

  it('at 12 s holds the completed frame (seek + pause) until the 15 s swap', () => {
    const t = setup();
    try {
      t.advance(GRADE_LOOP_HOLD_AT_MS - 500);
      assert.deepEqual(t.calls, []);
      assert.equal(t.rotation.held(), false);
      t.advance(500);
      assert.deepEqual(t.calls, [`a:seek(${GRADE_LOOP_HOLD_S.a ?? 5})`, 'a:pause']);
      assert.equal(t.rotation.held(), true);
      // The held loop is paused, yet the clock keeps running to the swap.
      t.advance(GRADE_LOOP_DWELL_MS - GRADE_LOOP_HOLD_AT_MS - 500);
      assert.equal(t.rotation.current(), 'a');
      assert.equal(t.calls.length, 2, 'hold is applied once');
      t.advance(500);
      assert.notEqual(t.rotation.current(), 'a');
      assert.equal(t.rotation.held(), false);
      assert.equal(t.rotation.progress(), 0);
    } finally {
      t.done();
    }
  });

  it('approved fallback: holdAtMs null swaps at 15 s with no hold phase', () => {
    const t = setup(['a', 'b', 'c'], { holdAtMs: null });
    try {
      t.advance(GRADE_LOOP_DWELL_MS);
      assert.deepEqual(t.calls, []);
      assert.equal(t.mounts.length, 1);
    } finally {
      t.done();
    }
  });

  it('progress fills 0 → 1 over the dwell and freezes while paused', () => {
    const t = setup();
    try {
      t.advance(GRADE_LOOP_DWELL_MS / 2);
      assert.equal(t.rotation.progress(), 0.5);
      t.loops.get('a')!.paused = true;
      t.advance(5_000);
      assert.equal(t.rotation.progress(), 0.5);
    } finally {
      t.done();
    }
  });

  it('shuffles (Fisher–Yates): default first on load, then a random order of the rest', () => {
    const variants = ['d', 'a', 'b', 'c', 'e', 'f'];
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const seen: string[] = [];
      const rotation = createGradeLoopRotation(
        {
          inView: () => true,
          pageHidden: () => false,
          state: () => ({ playing: true, done: false, static: false }),
          manuallyPaused: () => false,
          mount: (v) => seen.push(v),
          hold: () => {},
        },
        variants,
        'd',
        { random: seeded(seed) }
      );
      assert.equal(rotation.current(), 'd', 'the server-rendered default plays first');
      for (let i = 0; i < variants.length - 1; i++) rotation.next();
      assert.deepEqual([...seen].sort(), ['a', 'b', 'c', 'e', 'f'], 'first cycle shows every loop once');
      orders.add(seen.join());
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

  it('reshuffles every cycle and never shows the same loop twice in a row', () => {
    for (const pool of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e', 'f', 'g']]) {
      for (let seed = 1; seed <= 30; seed++) {
        const shown: string[] = [pool[0]];
        const rotation = createGradeLoopRotation(
          {
            inView: () => true,
            pageHidden: () => false,
            state: () => ({ playing: true, done: false, static: false }),
            manuallyPaused: () => false,
            mount: (v) => shown.push(v),
            hold: () => {},
          },
          pool,
          pool[0],
          { random: seeded(seed) }
        );
        for (let i = 0; i < pool.length * 12; i++) rotation.next();
        for (let i = 1; i < shown.length; i++) {
          assert.notEqual(shown[i], shown[i - 1], `seed ${seed}: ${shown.join(' ')}`);
        }
        for (let c = 0; c + pool.length <= shown.length; c += pool.length) {
          assert.deepEqual(shown.slice(c, c + pool.length).sort(), [...pool].sort(), 'each cycle is a permutation');
        }
      }
    }
  });

  it('a manual pause freezes rotation; the next control still works', () => {
    const t = setup();
    try {
      Object.assign(t.loops.get('a')!, { paused: true, playing: false, done: true });
      t.advance(GRADE_LOOP_DWELL_MS * 3);
      assert.equal(t.rotation.current(), 'a');
      assert.equal(t.rotation.elapsed(), 0);
      assert.deepEqual(t.calls, [], 'a paused loop is never held');
      assert.equal(t.rotation.next(), true);
      assert.notEqual(t.rotation.current(), 'a');
    } finally {
      t.done();
    }
  });

  it('does not count time off-screen, in a hidden tab, while paused, or on a static frame', () => {
    const t = setup();
    try {
      const a = t.loops.get('a')!;
      a.done = true;
      t.env.inView = false;
      t.advance(GRADE_LOOP_DWELL_MS);
      t.env.inView = true;
      t.env.hidden = true;
      t.advance(GRADE_LOOP_DWELL_MS);
      t.env.hidden = false;
      a.static = true;
      t.advance(GRADE_LOOP_DWELL_MS);
      a.static = false;
      a.done = false;
      a.playing = false;
      t.advance(GRADE_LOOP_DWELL_MS);
      assert.equal(t.rotation.elapsed(), 0);
      assert.equal(t.rotation.current(), 'a');
      assert.deepEqual(t.mounts, []);
    } finally {
      t.done();
    }
  });

  it('initializes each variant once across repeated cycles', () => {
    const t = setup();
    try {
      for (let i = 0; i < 9; i++) t.rotation.next();
      const seen = new Set(['a']);
      for (const [variant, firstVisit] of t.mounts) {
        assert.equal(firstVisit, !seen.has(variant), `${variant}: init exactly once`);
        seen.add(variant);
      }
      assert.deepEqual([...seen].sort(), ['a', 'b', 'c']);
    } finally {
      t.done();
    }
  });

  it('never rotates a single-variant pool', () => {
    const t = setup(['only']);
    try {
      t.loops.get('only')!.done = true;
      t.advance(GRADE_LOOP_DWELL_MS * 2);
      assert.equal(t.rotation.next(), false);
      assert.deepEqual(t.mounts, []);
    } finally {
      t.done();
    }
  });
});
