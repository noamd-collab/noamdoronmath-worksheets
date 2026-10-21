/**
 * Percent-of-quantity and fraction-division pages: fractions are stored as
 * ⟨n¦d⟩ markers and drawn with a bar, never written as "a/b".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { splitFractionMarkers, spokenFraction, visibleMathLength } from '../src/lib/topicFractionMarkers';
import { cleanText } from '../src/lib/parity/topicParity';
import { isolateMathRuns } from '../src/lib/mathDirection';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLUGS = [
  'percent-of-quantity-grade-6',
  'fraction-division-meaning-grade-6',
  'fraction-division-algorithm-grade-6',
];

function visibleStrings(slug: string): string[] {
  const page = JSON.parse(readFileSync(join(root, 'src/data/topic-pages', `${slug}.json`), 'utf8'));
  const out: string[] = [];
  for (const section of page.sections || []) {
    for (const block of section.blocks || []) {
      if (block.type === 'paragraph') out.push(block.text);
      if (block.type === 'list') out.push(...block.items);
    }
  }
  for (const item of page.bodyFlow || []) {
    if (item.type === 'paragraph' || item.type === 'heading') out.push(item.text);
    if (item.type === 'list') out.push(...item.items);
  }
  return out;
}

describe('topic fraction bar markers', () => {
  it('splits a marker into a stacked fraction', () => {
    assert.deepEqual(splitFractionMarkers('כי ⟨20¦100⟩ × 150'), [
      { kind: 'text', text: 'כי ' },
      { kind: 'frac', n: '20', d: '100' },
      { kind: 'text', text: ' × 150' },
    ]);
    assert.equal(spokenFraction('3', '4'), '3 חלקי 4');
    assert.equal(visibleMathLength('⟨1¦2⟩ : ⟨1¦4⟩'), '1/2 : 1/4'.length);
  });

  it('keeps the marker inside one left-to-right math isolate', () => {
    const out = isolateMathRuns('דוגמה: 45% מתוך 200 זה ⟨45¦100⟩ × 200 = 90.');
    assert.match(out, /\u2066[^\u2069]*⟨45¦100⟩ × 200 = 90[^\u2069]*\u2069/);
  });

  it('expands markers for production-fixture parity', () => {
    assert.equal(cleanText('⟨3¦4⟩ : ⟨1¦2⟩'), '3/4 : 1/2');
  });

  for (const slug of SLUGS) {
    it(`${slug}: no ASCII slash fraction in visible text, markers only in paragraphs`, () => {
      const strings = visibleStrings(slug);
      assert.ok(strings.length > 0);
      for (const text of strings) {
        assert.doesNotMatch(text, /[0-9a-zA-Z)] ?\/ ?[0-9a-zA-Z(]/, `slash fraction in: ${text}`);
      }
      assert.ok(strings.some((t) => /⟨[^¦⟩]+¦[^⟩]+⟩/.test(t)), 'page keeps its fractions as markers');
    });
  }
});
