/**
 * The slope card keeps the original line and the 1 / 2 steps.
 * The added grid uses that step as one square: (0,0), (1,2), (2,4), so y = 2x.
 * Screen y grows downward, so one square right and two up is (U, -2U).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const film = readFileSync(join(root, 'src/components/ConceptLoop.astro'), 'utf8');
const engine = readFileSync(join(root, 'src/lib/conceptLoops.ts'), 'utf8');

const U = 60;
const OX = 150;
const OY = 280;
const PAIRS = [[0, 0], [1, 2], [2, 4]] as const;

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

  it('keeps the original line, axes, steps, and slope label', () => {
    assert.match(svg, /class="cl-line-thin" x1="80" y1="300" x2="500" y2="300"/);
    assert.match(svg, /class="cl-line-thin" x1="120" y1="320" x2="120" y2="40"/);
    assert.match(svg, /data-el="line" x1="150" y1="280" x2="270" y2="40"/);
    assert.match(svg, /data-el="tri1" d="M150 280 L210 280 L210 160"/);
    assert.match(svg, /data-el="tri2" d="M210 160 L270 160 L270 40"/);
    assert.match(svg, /data-el="run1" x="168" y="296"[^>]*>1</);
    assert.match(svg, /data-el="rise1" x="218" y="226"[^>]*>2</);
    assert.match(svg, /data-el="run2" x="228" y="176"[^>]*>1</);
    assert.match(svg, /data-el="rise2" x="278" y="106"[^>]*>2</);
    assert.match(svg, /data-el="lbl2" x="300" y="70"[^>]*>2</);
    assert.match(film, /m = 2 : 1 = 2/);
  });

  it('draws a square grid whose ticks match the step', () => {
    assert.match(svg, /stroke="#c5d0e2"/);
    for (const n of [0, 1, 2]) {
      assert.match(svg, new RegExp(`x1="${OX + n * U}" y1="40" x2="${OX + n * U}" y2="300"`));
      assert.match(svg, new RegExp(`x="${OX + n * U}" y="322" text-anchor="middle">${n}</text>`));
    }
    for (const n of [0, 1, 2, 3, 4]) {
      const y = OY - n * U;
      assert.equal(y - (OY - (n - 1) * U), -U);
      assert.match(svg, new RegExp(`y1="${y}"`));
    }
  });

  it('puts every labeled point on a grid intersection and on y = 2x', () => {
    for (const [x, y] of PAIRS) {
      assert.equal(y, 2 * x);
      const [sx, sy] = screen(x, y);
      assert.match(svg, new RegExp(`cx="${sx}" cy="${sy}"`));
    }
    const line = svg.match(/data-el="line" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/);
    assert.ok(line);
    const [, x1, y1, x2, y2] = line.map(Number);
    const a: [number, number] = [x1, y1];
    const b: [number, number] = [x2, y2];
    for (const pt of points) assert.equal(onLine(pt[0], pt[1], a, b), true);
    assert.equal((points[1][1] - points[0][1]) / (points[1][0] - points[0][0]), -2);
    assert.equal(points[1][0] - points[0][0], U);
    assert.equal(points[0][1] - points[1][1], 2 * U);
  });

  it('draws each step exactly between consecutive labeled points', () => {
    const [a, b, c] = points;
    assert.match(svg, new RegExp(`d="M${a[0]} ${a[1]} L${b[0]} ${a[1]} L${b[0]} ${b[1]}"`));
    assert.match(svg, new RegExp(`d="M${b[0]} ${b[1]} L${c[0]} ${b[1]} L${c[0]} ${c[1]}"`));
    for (const pair of ['(0,0)', '(1,2)', '(2,4)']) {
      assert.match(svg, new RegExp(`dir="ltr"[^>]*>${pair.replace(/[()]/g, '\\$&')}</text>`));
    }
  });

  it('keeps the original animation order and only fades the added points with it', () => {
    const body = engine.slice(engine.indexOf('function renderSlope'), engine.indexOf('const SLOPE_HOLD'));
    const at = (needle: string) => body.indexOf(needle);
    assert.ok(at("q(root, 'line')") < at('draw(line'));
    assert.ok(at('draw(line') < at("q(root, 'tri1')"));
    assert.ok(at("q(root, 'tri1')") < at("q(root, 'run1')"));
    assert.ok(at("q(root, 'rise1')") < at("q(root, 'tri2')"));
    assert.ok(at("q(root, 'tri2')") < at("q(root, 'lbl2')"));
    assert.ok(at("q(root, 'lbl2')") < at("q(root, 'pts')"));
    assert.match(body, /ph\(t, 0\.5, 0\.8\)/);
    assert.match(body, /ph\(t, 0\.6, 1\.8\)/);
    assert.match(body, /ph\(t, 2\.0, 2\.6\)/);
    assert.match(body, /ph\(t, 4\.3, 4\.7\)/);
    assert.match(engine, /slope: \{ duration: 10, hold: SLOPE_HOLD/);
  });
});
