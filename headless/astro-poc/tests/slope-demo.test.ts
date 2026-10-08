/**
 * The slope card is a coordinate graph: y = 1 + 2x through (0,1), (1,3), (2,5).
 * Screen y grows downward, so one grid step right and two up is (U, -2U).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const film = readFileSync(join(root, 'src/components/ConceptLoop.astro'), 'utf8');
const engine = readFileSync(join(root, 'src/lib/conceptLoops.ts'), 'utf8');

const U = 46;
const OX = 210;
const OY = 296;
const PAIRS = [[0, 1], [1, 3], [2, 5]] as const;

function slopeSvg(): string {
  const start = film.indexOf("variant === 'slope' && (");
  const end = film.indexOf("variant === 'add-within'");
  assert.ok(start > 0 && end > start);
  return film.slice(start, end);
}

function screen(x: number, y: number): [number, number] {
  return [OX + x * U, OY - y * U];
}

function onLine(x: number, y: number, a: [number, number], b: [number, number]): boolean {
  const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
  return Math.abs(cross) < 0.6;
}

describe('slope coordinate demo', () => {
  const svg = slopeSvg();
  const points = PAIRS.map(([x, y]) => screen(x, y));

  it('draws a square grid, arrowed axes, and evenly spaced integer ticks', () => {
    assert.match(svg, /stroke="#c5d0e2"/);
    assert.equal((svg.match(/<polygon points="/g) || []).length, 2);
    assert.match(svg, /\[1, 2, 3, 4, 5\]\.map/);
    assert.match(svg, new RegExp(`${OY} - n \\* ${U}`));
    assert.match(svg, new RegExp(`${OX} \\+ n \\* ${U}`));
    for (const n of [0, 1, 2]) {
      assert.match(svg, new RegExp(`x="${OX + n * U}" y="326" text-anchor="middle">${n}</text>`));
    }
    for (const n of [1, 2, 3, 4, 5]) {
      const y = OY - n * U;
      assert.equal(y - (OY - (n - 1) * U), -U);
    }
  });

  it('puts every labeled point on a grid intersection and on y = 1 + 2x', () => {
    for (const [x, y] of PAIRS) {
      assert.equal(y, 1 + 2 * x);
      const [sx, sy] = screen(x, y);
      assert.match(svg, new RegExp(`cx="${sx}" cy="${sy}"`));
    }
    const line = svg.match(/data-el="line" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/);
    assert.ok(line);
    const [, x1, y1, x2, y2] = line.map(Number);
    const a: [number, number] = [x1, y1];
    const b: [number, number] = [x2, y2];
    for (const pt of points) assert.equal(onLine(pt[0], pt[1], a, b), true);
    const rise = points[2][1] - points[0][1];
    const run = points[2][0] - points[0][0];
    assert.equal(rise / run, -2);
  });

  it('draws each step exactly between consecutive labeled points', () => {
    const [a, b, c] = points;
    assert.match(svg, new RegExp(`d="M${a[0]} ${a[1]} L${b[0]} ${a[1]} L${b[0]} ${b[1]}"`));
    assert.match(svg, new RegExp(`d="M${b[0]} ${b[1]} L${c[0]} ${b[1]} L${c[0]} ${c[1]}"`));
    assert.equal(b[0] - a[0], U);
    assert.equal(a[1] - b[1], 2 * U);
    assert.equal(c[0] - b[0], U);
    assert.equal(b[1] - c[1], 2 * U);
    const run1 = svg.indexOf('data-el="run1"');
    const rise1 = svg.indexOf('data-el="rise1"');
    assert.match(svg.slice(run1, run1 + 80), />1</);
    assert.match(svg.slice(rise1, rise1 + 80), />2</);
  });

  it('keeps ordered pairs left-to-right and states the slope as 2/1 = 2', () => {
    for (const pair of ['(0,1)', '(1,3)', '(2,5)']) {
      assert.match(svg, new RegExp(`dir="ltr"[^>]*>${pair.replace(/[()]/g, '\\$&')}</text>`));
    }
    assert.match(svg, />2\/1 = 2</);
    assert.match(film, /שיפוע<\/span> = 2\/1 = 2/);
  });

  it('teaches grid, then points, then the line, then the steps, then the slope', () => {
    const body = engine.slice(engine.indexOf('function renderSlope'), engine.indexOf('const SLOPE_HOLD'));
    const at = (needle: string) => body.indexOf(needle);
    assert.ok(at("q(root, 'pts')") < at("q(root, 'line')"));
    assert.ok(at("q(root, 'pairs')") < at('draw(line'));
    assert.ok(at('draw(line') < at("q(root, 'tri1')"));
    assert.ok(at("q(root, 'tri1')") < at("q(root, 'run1')"));
    assert.ok(at("q(root, 'rise1')") < at("q(root, 'tri2')"));
    assert.ok(at("q(root, 'tri2')") < at("q(root, 'lbl2')"));
    assert.match(body, /ph\(t, 0\.45, 1\.15\)/);
    assert.match(body, /ph\(t, 1\.55, 2\.75\)/);
    assert.match(body, /ph\(t, 5\.15, 5\.55\)/);
    assert.match(engine, /slope: \{ duration: 10, hold: SLOPE_HOLD/);
  });
});
