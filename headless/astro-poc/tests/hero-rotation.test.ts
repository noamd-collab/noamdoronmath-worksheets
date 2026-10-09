/**
 * Home hero rotation: existing loops, real topic pages, design chip and panel.
 * Source and data checks only — the browser check is the preview.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { HERO_DEFAULT, HERO_ROTATION, heroChip, heroPanel, heroRotationVariant } from '../src/lib/heroRotation.ts';
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
});
