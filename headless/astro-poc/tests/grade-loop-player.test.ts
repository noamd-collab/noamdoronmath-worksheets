/**
 * Grade-hub rotating loop player: pool contract, render contract and rotation
 * policy. Deterministic, no browser: rotation runs the real policy module
 * under node:test mock timers; the DOM adapter is checked as a source contract.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GRADE_HUB_GRADES, type GradeHubGrade } from '../src/lib/gradeHubs.ts';
import {
  EXCLUDED_GRADE_LOOPS,
  GRADE_LOOP_COPY,
  GRADE_LOOP_DEFAULTS,
  GRADE_LOOP_HOLD_S,
  buildGradeLoopPool,
  gradeLoopCopy,
  gradeLoopDomain,
  gradeLoopMap,
  gradeLoopMathParts,
} from '../src/lib/gradeLoopPools.ts';
import { splitSupFractions } from '../src/lib/stackedFraction.ts';
import {
  GRADE_LOOP_DWELL_MS,
  GRADE_LOOP_FALLBACK_END_S,
  GRADE_LOOP_SLOWDOWN,
  createGradeLoopRotation,
  createGradeLoopSlowClock,
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
      (m) => {
        const hold = consts.get(m[2]);
        assert.ok(hold !== undefined, `${m[1]}: hold constant ${m[2]} is not defined`);
        return [m[1], hold];
      }
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

/** LOOPS_MAP_73_v2.csv rows by key; quoted fields may hold commas. */
function loopsMap(file: string): Map<string, Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...body] = rows;
  return new Map(body.map((cells) => {
    const record = Object.fromEntries(header.map((name, i) => [name, cells[i] ?? '']));
    return [record['מפתח (key)'], record] as const;
  }));
}

const numbers = (text: string): string[] => text.match(/\d+/g) ?? [];

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

  it('copy covers exactly the pooled loops (no copy for excluded variants)', () => {
    assert.deepEqual(
      Object.keys(GRADE_LOOP_COPY).sort(),
      gradeLoopMap().map((loop) => loop.variant).sort()
    );
  });

  for (const grade of GRADE_HUB_GRADES) {
    it(`grade ${grade}: every variant has the 4-line copy (domain, claim, mathLine, explain)`, () => {
      for (const entry of buildGradeLoopPool(grade)) {
        const { variant, domain, claim, mathLine, explain } = entry;
        assert.deepEqual({ domain, claim, mathLine, explain }, GRADE_LOOP_COPY[variant], `${variant}: pool copy`);
        assert.equal(domain, gradeLoopDomain(variant));
        // 1. "תחום · נושא"
        assert.match(domain, /^[^·]+ · [^·]+$/, `${variant}: domain must be "תחום · נושא"`);
        assert.ok(domain.length <= 40, `${variant}: domain too long`);
        // 2. the claim in one sentence
        assert.ok(claim.length >= 8 && claim.length <= 44, `${variant}: claim length ${claim.length}`);
        assert.doesNotMatch(claim, /[.?!]/, `${variant}: claim is one sentence, no end punctuation`);
        // 3. one short action; formula runs isolated LTR
        assert.ok(mathLine.trim().length > 0 && mathLine.length <= 48, `${variant}: mathLine length`);
        // 4. 2–3 sentences, ending on the result
        const sentences = explain.split(/(?<=\.)\s+/);
        assert.ok(sentences.length >= 2 && sentences.length <= 3, `${variant}: ${sentences.length} sentences`);
        assert.ok(sentences.every((s) => s.endsWith('.')), `${variant}: each sentence ends with a period`);
        assert.doesNotMatch(explain, /[−=×÷]/, `${variant}: signed numbers and formulas belong in mathLine`);
        assert.notEqual(claim, domain.split(' · ')[0], `${variant}: claim must say more than the domain`);
      }
    });
  }

  it("uses Claude's binding examples verbatim (L08, L45)", () => {
    const l08 = gradeLoopCopy('order-ops');
    assert.equal(l08.domain, 'סדר פעולות חשבון · כפל לפני חיבור');
    assert.equal(l08.claim, 'קודם כפל, אחר כך חיבור');
    assert.equal(l08.mathLine, 'קודם כפל: 3 × 4 = 12, ואז 2 + 12 = 14');
    assert.match(l08.explain, /14\.$/, 'the explanation ends on the result');
    const l45 = gradeLoopCopy('equiv-half');
    assert.match(l45.domain, /^שברים שקולים · /);
    assert.equal(l45.claim, 'חצי, שני רבעים ושלוש שישיות');
    assert.equal(l45.mathLine, 'אותו מקום על הישר: ½ = ²⁄₄ = ³⁄₆');
  });

  const mapCsv = join(root, '..', '..', 'LOOPS_MAP_73_v2.csv');
  it('copy follows the map: every loop is a map row, and an equation question keeps its numbers', {
    skip: !existsSync(mapCsv) && 'LOOPS_MAP_73_v2.csv is not in this checkout',
  }, () => {
    const map = loopsMap(mapCsv);
    for (const loop of gradeLoopMap()) {
      const row = map.get(loop.variant);
      assert.ok(row, `${loop.variant}: missing from LOOPS_MAP_73_v2.csv`);
      assert.equal(row['מספר'] === 'ישן' ? loop.variant : row['מספר'], loop.source, `${loop.variant}: map row id`);
      const question = row['שאלה/כותרת (מהקוד)'];
      if (!/^[\d(−□].*(= \?|= \d+)$/.test(question)) continue;
      const shown = numbers(GRADE_LOOP_COPY[loop.variant].mathLine);
      for (const n of numbers(question)) {
        assert.ok(shown.includes(n), `${loop.variant}: "${question}" but mathLine lacks ${n}`);
      }
    }
  });

  it('math line splits into RTL prose and isolated LTR formula runs', () => {
    assert.deepEqual(gradeLoopMathParts('קודם כפל: 3 × 4 = 12, ואז 2 + 12 = 14'), [
      { text: 'קודם כפל: ', math: false },
      { text: '3 × 4 = 12', math: true },
      { text: ', ואז ', math: false },
      { text: '2 + 12 = 14', math: true },
    ]);
    assert.deepEqual(gradeLoopMathParts('(−3) + 8 = 5'), [{ text: '(−3) + 8 = 5', math: true }]);
    assert.deepEqual(gradeLoopMathParts('(3, 2)'), [{ text: '(3, 2)', math: true }]);
    assert.deepEqual(gradeLoopMathParts('½ × ⅓ = ⅙'), [{ text: '½ × ⅓ = ⅙', math: true }]);
    assert.deepEqual(gradeLoopMathParts('½ > ⅓ > ¼'), [{ text: '½ > ⅓ > ¼', math: true }]);
    assert.deepEqual(gradeLoopMathParts('¹⁄₁₀ = 10 × ¹⁄₁₀₀'), [{ text: '¹⁄₁₀ = 10 × ¹⁄₁₀₀', math: true }]);
    assert.deepEqual(gradeLoopMathParts('¼ × 12 = 3'), [{ text: '¼ × 12 = 3', math: true }]);
    assert.deepEqual(gradeLoopMathParts('אותו מקום על הישר: ½ = ²⁄₄ = ³⁄₆'), [
      { text: 'אותו מקום על הישר: ', math: false },
      { text: '½ = ²⁄₄ = ³⁄₆', math: true },
    ]);
    assert.deepEqual(gradeLoopMathParts('מרחק שווה, זווית של 90°'), [
      { text: 'מרחק שווה, זווית של ', math: false },
      { text: '90°', math: true },
    ]);
    // "4 = ¼" must not be one LTR run: that paints the fraction beside מתוך.
    assert.deepEqual(gradeLoopMathParts('עץ־עץ: 1 מתוך 4 שווה ¼'), [
      { text: 'עץ־עץ: ', math: false },
      { text: '1', math: true },
      { text: ' מתוך ', math: false },
      { text: '4', math: true },
      { text: ' שווה ', math: false },
      { text: '¼', math: true },
    ]);
    assert.deepEqual(splitSupFractions('½ = ²⁄₄ = ³⁄₆'), [
      { kind: 'frac', n: '1', d: '2' },
      { kind: 'text', text: ' = ' },
      { kind: 'frac', n: '2', d: '4' },
      { kind: 'text', text: ' = ' },
      { kind: 'frac', n: '3', d: '6' },
    ]);
    assert.deepEqual(splitSupFractions('½ × ⅓ = ⅙'), [
      { kind: 'frac', n: '1', d: '2' },
      { kind: 'text', text: ' × ' },
      { kind: 'frac', n: '1', d: '3' },
      { kind: 'text', text: ' = ' },
      { kind: 'frac', n: '1', d: '6' },
    ]);
    for (const [variant, { mathLine }] of Object.entries(GRADE_LOOP_COPY)) {
      const parts = gradeLoopMathParts(mathLine);
      assert.equal(parts.map((p) => p.text).join(''), mathLine, `${variant}: split must be lossless`);
      for (const part of parts) {
        if (part.math) assert.doesNotMatch(part.text, /[\u0590-\u05ff]/, `${variant}: Hebrew inside an LTR run`);
        else assert.doesNotMatch(part.text, /\d/, `${variant}: a number outside its LTR run`);
      }
    }
  });

  it('hold times mirror the engine SPECS exactly; slowed ×1.8 they still land before the 15 s swap', () => {
    const holds = engineHolds();
    assert.equal(Object.keys(GRADE_LOOP_HOLD_S).length, gradeLoopMap().length);
    for (const loop of gradeLoopMap()) {
      assert.equal(GRADE_LOOP_HOLD_S[loop.variant], holds[loop.variant], `${loop.variant}: hold drifted from engine`);
      assert.ok(holds[loop.variant]! * GRADE_LOOP_SLOWDOWN < GRADE_LOOP_DWELL_MS / 1000, `${loop.variant}: never holds`);
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
    assert.match(player, /data-grade-loop-domain>\{defaultEntry\.domain\}<\/p>/);
    assert.match(player, /data-grade-loop-math/);
    assert.match(player, /<bdi dir="ltr">/);
    assert.match(player, /splitSupFractions\(part\.text\)/);
    assert.match(player, /const mathParts = gradeLoopMathParts\(defaultEntry\.mathLine\)/);
    // A swap rewrites all four lines from the pool entry.
    const script = player.split('<script>')[1];
    assert.match(script, /domain\.textContent = entry\.domain/);
    assert.match(script, /label\.textContent = entry\.claim/);
    assert.match(script, /gradeLoopMathParts\(entry\.mathLine\)[\s\S]*?createElement\('bdi'\)[\s\S]*?run\.dir = 'ltr'/);
    assert.match(script, /splitSupFractions\(part\.text\)/);
    assert.match(script, /explain\.textContent = entry\.explain/);
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
    assert.match(rule('.grade-loop__math :global(bdi)'), /unicode-bidi: isolate;/);
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

  it('reduced motion hides ▶ (engine toggle and pause button) in player CSS only; next stays', () => {
    const css = player.split('<style>')[1];
    assert.match(
      css,
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.grade-loop :global\(\[data-el='toggle'\]\),\s*\.grade-loop__pause \{\s*display: none !important;\s*\}\s*\}/
    );
    for (const motionOff of ['nd-motion-off', 'noam-a11y-motion']) {
      assert.match(css, new RegExp(`:global\\(html\\.${motionOff}\\) \\.grade-loop :global\\(\\[data-el='toggle'\\]\\)`));
      assert.match(css, new RegExp(`:global\\(html\\.${motionOff}\\) \\.grade-loop__pause`));
    }
    // Hidden only under motion-off: every toggle-hiding selector is inside the media query or behind an html class.
    const hides = [...css.matchAll(/^\s*(.*):global\(\[data-el='toggle'\]\)/gm)].map((m) => m[1]);
    assert.equal(hides.length, 3);
    assert.equal(hides.filter((prefix) => /html\.(nd-motion-off|noam-a11y-motion)/.test(prefix)).length, 2);
    assert.doesNotMatch(css, /grade-loop__next(?!\[hidden\])[^{]*\{[^}]*display: none/, 'ללולאה הבאה stays visible');
    assert.match(player, /"▶ פעם אחת" is deferred until the engine supports it/);
    assert.doesNotMatch(css.split('@media')[0], /\.grade-loop__pause \{[^}]*display: none/);
  });

  it('hold phase freezes on the engine completed frame via __loop.seek + pause', () => {
    assert.match(
      player,
      /hold\(variant\) \{\s*const loop = mounted\.get\(variant\);\s*const hold = entries\.get\(variant\)\?\.hold;\s*if \(!loop\?\.__loop \|\| typeof hold !== 'number'\) return;\s*loop\.__loop\.seek\(hold\);\s*loop\.__loop\.pause\(\);/
    );
    assert.match(player, /approved fallback/);
  });

  it('slows the unchanged engine ×1.8 from the player: frame loop + __loop.seek, pause at the end', () => {
    assert.match(read('src/lib/gradeLoopRotation.ts'), /t_engine = t_real \/ GRADE_LOOP_SLOWDOWN/);
    assert.doesNotMatch(read('src/lib/conceptLoops.ts'), /slowdown|GRADE_LOOP|speed/i, 'engine untouched');
    const script = player.split('<script>')[1];
    assert.match(script, /const slow = createGradeLoopSlowClock\(\{/);
    assert.match(script, /state\.playing && !state\.static && !rotation\.held\(\) && !manuallyPaused\(loop\)/);
    assert.match(script, /seek: \(t\) => activeLoop\(\)\?\.__loop\?\.seek\(t\)/);
    assert.match(script, /ended: \(\) => rotation\.hold\(\)/);
    assert.match(script, /entries\.get\(variant\)\?\.hold \?\? GRADE_LOOP_FALLBACK_END_S/);
    assert.match(script, /slow\.reset\(endOf\(variant\)\);\s*wasStatic\.set/, 'each mount restarts the slow clock');
    // Reduced motion: no frame loop and no seek.
    assert.match(script, /function slowFrame\(now: number\) \{\s*const state = activeLoop\(\)\?\.__loop\?\.state\(\);\s*if \(!state \|\| state\.static\) \{\s*frameId = 0;/);
    assert.match(script, /function runSlowClock\(\) \{\s*const state = activeLoop\(\)\?\.__loop\?\.state\(\);\s*if \(frameId \|\| !state \|\| state\.static\) return;/);
    assert.equal((script.match(/requestAnimationFrame\(slowFrame\)/g) || []).length, 2);
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

  it('hold() freezes the completed frame (seek + pause) once, until the 15 s swap', () => {
    const t = setup();
    try {
      t.advance(10_000);
      assert.deepEqual(t.calls, [], 'no fixed-time hold any more');
      t.rotation.hold();
      assert.deepEqual(t.calls, [`a:seek(${GRADE_LOOP_HOLD_S.a ?? 5})`, 'a:pause']);
      assert.equal(t.rotation.held(), true);
      t.rotation.hold();
      assert.equal(t.calls.length, 2, 'hold is applied once');
      // The held loop is paused, yet the clock keeps running to the swap.
      t.advance(GRADE_LOOP_DWELL_MS - 10_000 - 500);
      assert.equal(t.rotation.current(), 'a');
      t.advance(500);
      assert.notEqual(t.rotation.current(), 'a');
      assert.equal(t.rotation.held(), false);
      assert.equal(t.rotation.progress(), 0);
    } finally {
      t.done();
    }
  });

  it('approved fallback: with no hold() (unknown completed frame) it swaps at 15 s with no hold phase', () => {
    const t = setup();
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

  it('×1.8 end to end: the slowed loop reaches its completed frame, pauses, and holds to the 15 s swap', () => {
    const t = setup(['triangle', 'pythagoras', 'area-model']);
    const seeks: number[] = [];
    const slow = createGradeLoopSlowClock({
      running: () => {
        const s = t.loops.get(t.rotation.current())!;
        return s.playing && !s.static && !s.paused && !t.rotation.held();
      },
      seek: (tt) => seeks.push(tt),
      ended: () => t.rotation.hold(),
    });
    const endS = GRADE_LOOP_HOLD_S.triangle;
    slow.reset(endS);
    const frames = setInterval(() => slow.frame(20), 20);
    try {
      const endMs = Math.round(endS * GRADE_LOOP_SLOWDOWN * 1000); // 14 040 ms
      t.advance(endMs - 40);
      assert.equal(t.rotation.held(), false);
      assert.ok(Math.abs(seeks.at(-1)! - (endMs - 40) / 1000 / GRADE_LOOP_SLOWDOWN) < 1e-9, 'engine time = real / 1.8');
      t.advance(80);
      assert.equal(t.rotation.held(), true);
      assert.equal(seeks.at(-1), endS, 'never seeks past the completed frame');
      assert.deepEqual(t.calls, [`triangle:seek(${endS})`, 'triangle:pause']);
      const seekCount = seeks.length;
      t.advance(GRADE_LOOP_DWELL_MS - endMs - 60);
      assert.equal(t.rotation.current(), 'triangle', 'held until the swap');
      assert.equal(seeks.length, seekCount, 'no seeks while held');
      t.advance(40);
      assert.notEqual(t.rotation.current(), 'triangle');
    } finally {
      clearInterval(frames);
      t.done();
    }
  });
});

describe('×1.8 slow clock (player time → engine time via __loop.seek)', () => {
  function setupClock(endS?: number) {
    const env = { running: true };
    const seeks: number[] = [];
    let ended = 0;
    const slow = createGradeLoopSlowClock({
      running: () => env.running,
      seek: (t) => seeks.push(t),
      ended: () => { ended += 1; },
    });
    slow.reset(endS);
    mock.timers.enable({ apis: ['setInterval'] });
    const timer = setInterval(() => slow.frame(16), 16);
    return {
      env,
      seeks,
      slow,
      ended: () => ended,
      advance: (ms: number) => mock.timers.tick(ms),
      done: () => {
        clearInterval(timer);
        mock.timers.reset();
      },
    };
  }
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  it('feeds the engine t_real / 1.8, frame by frame', () => {
    assert.equal(GRADE_LOOP_SLOWDOWN, 1.8);
    const c = setupClock(7.8);
    try {
      c.advance(1600);
      assert.ok(near(c.slow.engineTime(), 1.6 / 1.8));
      assert.ok(near(c.seeks.at(-1)!, 1.6 / 1.8));
      assert.equal(c.seeks.length, 100);
      assert.ok(c.seeks.every((t, i) => i === 0 || t > c.seeks[i - 1]), 'monotonic');
      c.advance(8000);
      assert.ok(near(c.slow.engineTime(), 9.6 / 1.8), 'the same step takes 1.8× as long');
    } finally {
      c.done();
    }
  });

  it('stops at the completed frame and reports the end once', () => {
    const c = setupClock(5);
    try {
      c.advance(8_960); // 8.96 s real = 4.978 s engine
      assert.equal(c.ended(), 0);
      c.advance(64);
      assert.equal(c.ended(), 1);
      assert.equal(c.seeks.at(-1), 5);
      const n = c.seeks.length;
      c.advance(5_000);
      assert.equal(c.seeks.length, n, 'frozen after the end');
      assert.equal(c.ended(), 1);
    } finally {
      c.done();
    }
  });

  it('freezes while the engine is not running (user pause, off-screen) and resumes from the same point', () => {
    const c = setupClock(7.8);
    try {
      c.advance(1_600);
      const at = c.slow.engineTime();
      c.env.running = false;
      c.advance(5_000);
      assert.equal(c.slow.engineTime(), at);
      c.env.running = true;
      c.advance(16);
      assert.ok(near(c.slow.engineTime(), at + 0.016 / 1.8));
    } finally {
      c.done();
    }
  });

  it('caps a stalled frame at 50 ms and restarts from zero on reset', () => {
    const seeks: number[] = [];
    const slow = createGradeLoopSlowClock({ running: () => true, seek: (t) => seeks.push(t), ended: () => {} });
    slow.reset(7.8);
    slow.frame(2_000);
    assert.ok(near(seeks[0], 0.05 / 1.8));
    slow.frame(-10);
    assert.ok(near(seeks[1], 0.05 / 1.8), 'negative steps never rewind');
    slow.reset(5.2);
    assert.equal(slow.engineTime(), 0);
    assert.equal(slow.ended(), false);
  });

  it('fallback end (10 s) is never reached inside the 15 s dwell: no hold, swap at 15 s', () => {
    assert.equal(GRADE_LOOP_FALLBACK_END_S, 10);
    const c = setupClock();
    try {
      c.advance(GRADE_LOOP_DWELL_MS);
      assert.equal(c.ended(), 0);
      assert.ok(c.slow.engineTime() < GRADE_LOOP_FALLBACK_END_S);
    } finally {
      c.done();
    }
  });
});
