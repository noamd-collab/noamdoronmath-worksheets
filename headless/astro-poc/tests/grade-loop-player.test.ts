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
  buildGradeLoopPool,
  gradeLoopMap,
} from '../src/lib/gradeLoopPools.ts';
import {
  GRADE_LOOP_DWELL_MS,
  createGradeLoopRotation,
  type GradeLoopState,
} from '../src/lib/gradeLoopRotation.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const player = read('src/components/GradeLoopPlayer.astro');
const hubPage = read('src/components/GradeHubPage.astro');

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

  it('server-renders the default label and link, with an accessible next control', () => {
    assert.match(player, /data-grade-loop-text aria-live="polite"/);
    assert.match(player, /data-grade-loop-label>\{defaultEntry\.label\}</);
    assert.match(player, /href=\{defaultEntry\.href\}/);
    assert.match(player, /<button\s+type="button"[\s\S]*?data-grade-loop-next[\s\S]*?aria-label="מעבר להמחשה הבאה"[\s\S]*?hidden\s*>/);
    assert.match(player, /isCatalog \? 'למאגר התרגול ←' : 'לדף הנושא ←'/);
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
  type Fake = GradeLoopState & { paused: boolean };

  function setup(variants = ['a', 'b', 'c']) {
    const loops = new Map<string, Fake>(
      variants.map((v) => [v, { playing: true, done: false, static: false, paused: false }])
    );
    const env = { inView: true, hidden: false };
    const mounts: Array<[string, boolean]> = [];
    const rotation = createGradeLoopRotation(
      {
        inView: () => env.inView,
        pageHidden: () => env.hidden,
        state: (v) => loops.get(v),
        manuallyPaused: (v) => loops.get(v)?.paused ?? false,
        mount: (v, first) => mounts.push([v, first]),
      },
      variants,
      variants[0]
    );
    mock.timers.enable({ apis: ['setInterval'] });
    const timer = setInterval(() => rotation.tick(500), 500);
    const advance = (ms: number) => mock.timers.tick(ms);
    const done = () => {
      clearInterval(timer);
      mock.timers.reset();
    };
    return { loops, env, mounts, rotation, advance, done };
  }

  it('advances only after the loop parks and the dwell time elapses', () => {
    const t = setup();
    try {
      t.advance(GRADE_LOOP_DWELL_MS * 2);
      assert.equal(t.rotation.current(), 'a', 'a playing loop is never cut mid-lap');
      t.loops.get('a')!.done = true;
      t.loops.get('a')!.playing = false;
      t.advance(500);
      assert.equal(t.rotation.current(), 'b');
      assert.deepEqual(t.mounts, [['b', true]]);
      t.loops.get('b')!.done = true;
      t.advance(GRADE_LOOP_DWELL_MS - 500);
      assert.equal(t.rotation.current(), 'b', 'parked early, still waits out the dwell');
      t.advance(500);
      assert.equal(t.rotation.current(), 'c');
    } finally {
      t.done();
    }
  });

  it('a manual pause freezes rotation; the next control still works', () => {
    const t = setup();
    try {
      Object.assign(t.loops.get('a')!, { paused: true, playing: false, done: true });
      t.advance(GRADE_LOOP_DWELL_MS * 3);
      assert.equal(t.rotation.current(), 'a');
      assert.equal(t.rotation.elapsed(), 0);
      assert.equal(t.rotation.next(), true);
      assert.equal(t.rotation.current(), 'b');
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
      for (let i = 0; i < 7; i++) t.rotation.next();
      assert.deepEqual(t.mounts, [
        ['b', true], ['c', true], ['a', false], ['b', false], ['c', false], ['a', false], ['b', false],
      ]);
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
