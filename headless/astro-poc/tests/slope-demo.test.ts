/**
 * The home/grade slope card draws a real coordinate system,
 * not two bare axes and unlabeled steps.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const film = readFileSync(join(root, 'src/components/ConceptLoop.astro'), 'utf8');

function slopeSvg(): string {
  const start = film.indexOf("variant === 'slope' && (");
  const end = film.indexOf("variant === 'add-within'");
  assert.ok(start > 0 && end > start);
  return film.slice(start, end);
}

describe('slope coordinate demo', () => {
  const svg = slopeSvg();

  it('draws a square grid, arrowed axes, and integer ticks with origin 0', () => {
    assert.match(svg, /stroke="#d5dce8"/);
    assert.equal((svg.match(/<polygon points="/g) || []).length, 2);
    assert.match(svg, /text-anchor="end">0<\/text>/);
    for (const n of [1, 2, 3]) assert.match(svg, new RegExp(`text-anchor="middle">${n}<\\/text>`));
    assert.match(svg, /\[1, 2, 3, 4, 5\]\.map/);
  });

  it('labels the grid points with left-to-right ordered pairs', () => {
    for (const pair of ['(0,1)', '(1,3)', '(2,5)']) {
      assert.match(svg, new RegExp(`dir="ltr"[^>]*>${pair.replace(/[()]/g, '\\$&')}<\\/text>`));
    }
    assert.match(svg, /d="M176 246 L222 246 L222 154"/);
    assert.match(svg, /d="M222 154 L268 154 L268 62"/);
  });

  it('states the slope as 2/1 = 2', () => {
    assert.match(svg, />2\/1 = 2</);
    assert.match(film, /שיפוע<\/span> = 2\/1 = 2/);
  });
});
