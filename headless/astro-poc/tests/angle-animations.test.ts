/**
 * Grade-7 angle animations:
 *  - measure (angles-introduction-measurement-grade-7): the arc is centred on
 *    the vertex and always spans exactly the ray's current opening.
 *  - adjacent / vertical explorer (adjacent-vertical-angles-grade-7).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AV_FIXED_HALF,
  AV_MAX,
  AV_MIN,
  AV_SECTOR_R,
  AV_STRAIGHT_R,
  AV_START,
  AV_TURN_HALF,
  AV_VERTEX,
  AV_VIEW,
  angleSpan,
  angleValues,
  avAnnouncement,
  avFrame,
  chapterTheta,
  degreeText,
  ghostTurn,
  labelBox,
  labelPoint,
  polar,
  AV_CHAPTER_SECONDS,
  AV_GHOST_SECONDS,
} from '../src/lib/adjacentVerticalAngles.ts';
import {
  COMPONENT_LANDING_LOOPS,
  LANDING_LOOP_ANCHORS,
  topicLandingLoop,
} from '../src/lib/landingLoops.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

/**
 * Centre of an SVG elliptical-arc command (circle case), per SVG 2 F.6.5.
 * Screen coordinates (y down).
 */
function arcCentre(x1: number, y1: number, r: number, large: number, sweep: number, x2: number, y2: number) {
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const d2 = dx * dx + dy * dy;
  let k = Math.sqrt(Math.max(0, (r * r - d2) / d2));
  if (large === sweep) k = -k;
  const cx = k * dy + (x1 + x2) / 2;
  const cy = -k * dx + (y1 + y2) / 2;
  return { cx, cy };
}

function parseArc(d: string) {
  const m = d.match(/M\s*([\d.-]+)[ ,]([\d.-]+)\s*A\s*([\d.-]+)[ ,]([\d.-]+)\s+0\s+([01])\s+([01])\s+([\d.-]+)[ ,]([\d.-]+)/);
  assert.ok(m, `arc path ${d}`);
  const [, x1, y1, r, , large, sweep, x2, y2] = m.map(Number) as number[];
  return { x1, y1, r, large, sweep, x2, y2 };
}

/** Screen angle (counter-clockwise, degrees) of p around c. */
const screenDeg = (c: { cx: number; cy: number }, x: number, y: number) =>
  ((Math.atan2(c.cy - y, x - c.cx) * 180) / Math.PI + 360) % 360;

describe('measure loop: angle arc', () => {
  const sketch = read('src/components/LoopSketch.astro');
  const block = sketch.slice(sketch.indexOf("{variant === 'measure'"), sketch.indexOf("{variant === 'parallel'"));

  it('centres the arc on the vertex and ends it on the 60° ray', () => {
    const d = block.match(/data-measure-arc d="([^"]+)"/)?.[1];
    assert.ok(d);
    const a = parseArc(d);
    const c = arcCentre(a.x1, a.y1, a.r, a.large, a.sweep, a.x2, a.y2);
    assert.ok(Math.abs(c.cx - 90) < 0.05 && Math.abs(c.cy - 190) < 0.05, `centre ${c.cx},${c.cy}`);
    assert.ok(Math.abs(screenDeg(c, a.x1, a.y1) - 0) < 0.1);
    assert.ok(Math.abs(screenDeg(c, a.x2, a.y2) - 60) < 0.1);
    // The small counter-clockwise arc: it bulges away from the vertex, inside the opening.
    assert.equal(a.sweep, 0);
    assert.equal(a.large, 0);
    assert.doesNotMatch(block, /A60 60 0 0 1/);
  });

  it('turns the ray about the vertex, counter-clockwise, to 60°', () => {
    assert.match(block, /class="sk-sweep" style="--ox:18\.75%;--oy:67\.86%"/);
    assert.equal(0.1875 * 480, 90);
    assert.ok(Math.abs(0.6786 * 280 - 190) < 0.01);
    assert.match(block, /data-measure-ray x1="90" y1="190" x2="250" y2="190"/);
    assert.match(sketch, /@keyframes sk-sweep \{\s*0%, 100% \{ transform: rotate\(0deg\); \}\s*48%, 76% \{ transform: rotate\(-60deg\); \}/);
    assert.match(sketch, /\.sk-sweep \{ transform-origin: var\(--ox\) var\(--oy\); transform: rotate\(-60deg\); \}/);
  });

  it('hides the arc beyond the ray at every moment with a cover that turns with it', () => {
    const groups = block.match(/<g class="sk-sweep"[\s\S]*?<\/g>/g) ?? [];
    assert.equal(groups.length, 2, 'cover and ray share the same sweep');
    assert.match(groups[0]!, /sk-measure-cover" fill="#fff" d="M90 190 L166 190 A76 76 0 0 0 14 190 Z"/);
    // The cover is the half disc above the unturned ray (screen angles 0…180).
    const cover = parseArc('M166 190 A76 76 0 0 0 14 190');
    const c = arcCentre(cover.x1, cover.y1, cover.r, cover.large, cover.sweep, cover.x2, cover.y2);
    assert.ok(Math.abs(c.cx - 90) < 0.01 && Math.abs(c.cy - 190) < 0.01);
    assert.ok(76 > 60 + 2, 'cover reaches past the arc stroke');
    assert.match(read('src/components/LandingLoop.astro'), /background: #fff;/);
    // Painting order: arc, cover, base line, ray.
    const order = ['data-measure-arc', 'sk-measure-cover', 'class="sk-ink" x1="90"', 'data-measure-ray'].map((s) => block.indexOf(s));
    assert.deepEqual([...order].sort((x, y) => x - y), order);
    // At turn φ the cover spans φ…φ+180, so the visible arc is 0…min(φ, 60).
    for (let phi = 0; phi <= 60; phi += 0.5) {
      for (let a = 0; a <= 60; a += 0.5) {
        const covered = a > phi && a < phi + 180;
        assert.equal(!covered, a <= phi, `φ=${phi} a=${a}`);
      }
    }
  });

  it('shows the 60° reading only while the ray rests at 60°, on the same clock', () => {
    assert.match(sketch, /\.sk \.sk-sweep \{ animation: sk-sweep 6\.5s ease-in-out infinite; \}/);
    assert.match(sketch, /\.sk \.sk-measure-label \{ animation: sk-measure-label 6\.5s ease-in-out infinite; \}/);
    const kf = sketch.match(/@keyframes sk-measure-label \{([\s\S]*?)\n  \}/)?.[1] ?? '';
    assert.match(kf, /0%, 48% \{ opacity: 0; \}/);
    assert.match(kf, /54%, 72% \{ opacity: 1; \}/);
    assert.match(kf, /76%, 100% \{ opacity: 0; \}/);
    assert.doesNotMatch(block, /\bsk-in\b(?!k)/);
    // The reading sits inside the opening, clear of the arc and the ray.
    const x = 168, y = 168;
    const r = Math.hypot(x - 90, 190 - y);
    const deg = (Math.atan2(190 - y, x - 90) * 180) / Math.PI;
    assert.ok(r > 70 && deg > 5 && deg < 55);
  });
});

describe('adjacent / vertical explorer geometry', () => {
  const thetas: number[] = [];
  for (let t = AV_MIN; t <= AV_MAX; t += 0.25) thetas.push(t);

  it('adjacent readouts always sum to 180 and vertical ones are equal', () => {
    for (const t of thetas) {
      const { alpha, beta } = angleValues(t);
      assert.equal(alpha + beta, 180, `θ=${t}`);
      assert.ok(Number.isInteger(alpha) && Number.isInteger(beta));
      const f = avFrame('vertical', t);
      assert.equal(f.alpha, alpha);
      const a1 = angleSpan('alpha', t);
      const a2 = angleSpan('alpha2', t);
      const b1 = angleSpan('beta', t);
      const b2 = angleSpan('beta2', t);
      assert.equal(a1.to - a1.from, a2.to - a2.from);
      assert.equal(b1.to - b1.from, b2.to - b2.from);
      assert.equal(a1.to - a1.from + (b1.to - b1.from), 180);
      // Adjacent: alpha and beta share the turning arm θ, their outer arms are 0° and 180°.
      assert.equal(a1.to, b1.from);
      assert.equal(b1.to - a1.from, 180);
      // Vertical: alpha2 is alpha turned by a half turn.
      assert.equal(a2.from, a1.from + 180);
      assert.equal(a2.to, a1.to + 180);
    }
  });

  it('draws every arc centred on the vertex, counter-clockwise, ending on the arms', () => {
    for (const t of [AV_MIN, 45, AV_START, 90, 120, AV_MAX]) {
      const f = avFrame('adjacent', t);
      for (const key of ['alpha', 'beta', 'alpha2', 'beta2'] as const) {
        const a = parseArc(f.arcs[key]);
        const c = arcCentre(a.x1, a.y1, a.r, a.large, a.sweep, a.x2, a.y2);
        assert.ok(Math.abs(c.cx - AV_VERTEX.x) < 0.05 && Math.abs(c.cy - AV_VERTEX.y) < 0.05, `${key} θ=${t}`);
        const { from, to } = angleSpan(key, t);
        const near = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180) < 0.1;
        assert.ok(near(screenDeg(c, a.x1, a.y1), from), `${key} start θ=${t}`);
        assert.ok(near(screenDeg(c, a.x2, a.y2), to), `${key} end θ=${t}`);
        assert.equal(a.sweep, 0);
        assert.equal(a.large, to - from > 180 ? 1 : 0);
        assert.ok(f.sectors[key].startsWith(`M${AV_VERTEX.x} ${AV_VERTEX.y} L`));
      }
      const s = parseArc(f.straight.path);
      const sc = arcCentre(s.x1, s.y1, s.r, s.large, s.sweep, s.x2, s.y2);
      assert.ok(Math.abs(sc.cx - AV_VERTEX.x) < 0.05 && Math.abs(sc.cy - AV_VERTEX.y) < 0.05);
      assert.ok(Math.abs(screenDeg(sc, s.x1, s.y1)) < 0.1);
      assert.ok(Math.abs(screenDeg(sc, s.x2, s.y2) - 180) < 0.1);
      // The half turn goes over the top: its midpoint is above the vertex.
      const top = polar(90, AV_STRAIGHT_R);
      assert.ok(top.y < AV_VERTEX.y);
    }
  });

  it('keeps every shown label inside the board, inside its angle, and clear of arms and other labels', () => {
    const dist = (p: { x: number; y: number }, deg: number) => {
      const ux = Math.cos((deg * Math.PI) / 180);
      const uy = -Math.sin((deg * Math.PI) / 180);
      const vx = p.x - AV_VERTEX.x;
      const vy = p.y - AV_VERTEX.y;
      const along = vx * ux + vy * uy;
      if (along < 0) return Math.hypot(vx, vy);
      return Math.abs(vx * uy - vy * ux);
    };
    const boxClear = (box: ReturnType<typeof labelBox>, deg: number, gap: number) => {
      const corners = [
        { x: box.x1, y: box.y1 }, { x: box.x2, y: box.y1 },
        { x: box.x1, y: box.y2 }, { x: box.x2, y: box.y2 },
        { x: (box.x1 + box.x2) / 2, y: box.y1 }, { x: (box.x1 + box.x2) / 2, y: box.y2 },
        { x: box.x1, y: (box.y1 + box.y2) / 2 }, { x: box.x2, y: (box.y1 + box.y2) / 2 },
      ];
      return corners.every((p) => dist(p, deg) > gap);
    };
    const overlap = (a: ReturnType<typeof labelBox>, b: ReturnType<typeof labelBox>) =>
      a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

    for (const mode of ['adjacent', 'vertical'] as const) {
      for (const t of thetas) {
        const f = avFrame(mode, t);
        const boxes: ReturnType<typeof labelBox>[] = [];
        for (const key of ['alpha', 'beta', 'alpha2', 'beta2'] as const) {
          if (!f.labelled[key]) continue;
          const text = degreeText(key.startsWith('alpha') ? f.alpha : f.beta);
          const box = labelBox(text, f.labels[key]);
          assert.ok(box.x1 > 0 && box.x2 < AV_VIEW.width && box.y1 > 0 && box.y2 < AV_VIEW.height, `${mode} ${key} θ=${t}`);
          const { from, to } = angleSpan(key, f.theta);
          for (const arm of [from, to, 0, 180, f.theta, f.theta + 180]) {
            assert.ok(boxClear(box, arm % 360, 2), `${mode} ${key} θ=${t} touches arm ${arm}`);
          }
          const r = Math.hypot(f.labels[key].x - AV_VERTEX.x, f.labels[key].y - AV_VERTEX.y);
          assert.ok(r > AV_SECTOR_R + 12, `${mode} ${key} label sits on its arc`);
          if (mode === 'adjacent') {
            const far = Math.max(
              ...[[box.x1, box.y1], [box.x2, box.y1], [box.x1, box.y2], [box.x2, box.y2]].map(([x, y]) =>
                Math.hypot(x! - AV_VERTEX.x, y! - AV_VERTEX.y)),
            );
            assert.ok(far < AV_STRAIGHT_R - 2, `${key} label crosses the half-turn arc at θ=${t}`);
          }
          for (const other of boxes) assert.equal(overlap(box, other), false, `${mode} θ=${t} labels collide`);
          boxes.push(box);
        }
        if (mode === 'adjacent') {
          const box = labelBox('180°', f.straight.label);
          for (const arm of [0, 180, f.theta, f.theta + 180]) {
            assert.ok(boxClear(box, arm % 360, 2), `180° label touches arm ${arm} at θ=${t}`);
          }
          for (const other of boxes) assert.equal(overlap(box, other), false);
        }
      }
    }
  });

  it('keeps both lines on the board for every angle', () => {
    assert.ok(AV_VERTEX.x - AV_FIXED_HALF >= 0 && AV_VERTEX.x + AV_FIXED_HALF <= AV_VIEW.width);
    for (const t of thetas) {
      const f = avFrame('vertical', t);
      for (const p of [f.turnA, f.turnB]) {
        assert.ok(p.x >= 0 && p.x <= AV_VIEW.width && p.y >= 0 && p.y <= AV_VIEW.height, `θ=${t}`);
        assert.ok(Math.abs(Math.hypot(p.x - AV_VERTEX.x, p.y - AV_VERTEX.y) - AV_TURN_HALF) < 0.05);
      }
    }
  });

  it('shows the right angles in each chapter', () => {
    const adj = avFrame('adjacent', 70);
    assert.deepEqual(adj.shown, { alpha: 'strong', beta: 'strong', alpha2: 'off', beta2: 'off' });
    assert.deepEqual(adj.labelled, { alpha: true, beta: true, alpha2: false, beta2: false });
    assert.equal(adj.straight.visible, true);
    const ver = avFrame('vertical', 70);
    assert.deepEqual(ver.shown, { alpha: 'strong', beta: 'faint', alpha2: 'strong', beta2: 'faint' });
    assert.deepEqual(ver.labelled, { alpha: true, beta: false, alpha2: true, beta2: false });
    assert.equal(ver.straight.visible, false);
    assert.equal(avAnnouncement('adjacent', 65), 'זוויות צמודות: 65 מעלות ועוד 115 מעלות שווה 180 מעלות.');
    assert.equal(avAnnouncement('vertical', 65), 'זוויות קודקודיות: 65 מעלות שווה 65 מעלות.');
  });

  it('autoplay stays in range, is continuous, and starts and ends at the still frame', () => {
    for (const mode of ['adjacent', 'vertical'] as const) {
      const T = AV_CHAPTER_SECONDS[mode];
      assert.equal(chapterTheta(mode, 0), AV_START);
      assert.equal(chapterTheta(mode, T), AV_START);
      let prev = chapterTheta(mode, 0);
      for (let i = 1; i <= T * 100; i++) {
        const v = chapterTheta(mode, i / 100);
        assert.ok(v >= AV_MIN && v <= AV_MAX);
        assert.ok(Math.abs(v - prev) < 1, `${mode} jumps at ${i / 100}s`);
        prev = v;
      }
    }
    assert.equal(ghostTurn(0), 0);
    assert.equal(ghostTurn(AV_GHOST_SECONDS), 180);
    for (let t = 0; t < 2.5; t += 0.01) assert.equal(chapterTheta('vertical', t), AV_START, 'angle holds while the copy turns');
  });
});

describe('adjacent / vertical explorer wiring', () => {
  const comp = read('src/components/AdjacentVerticalAnglesLoop.astro');
  const topic = read('src/components/TopicPage.astro');

  it('mounts only on the adjacent / vertical landing and keeps its stated idea', () => {
    assert.deepEqual(COMPONENT_LANDING_LOOPS, { 'adjacent-vertical-angles-grade-7': 'adjacent-vertical-angles' });
    assert.deepEqual(topicLandingLoop(loadTopicPage('adjacent-vertical-angles-grade-7')), {
      kind: 'css', variant: 'angles', marker: 'angles',
    });
    assert.deepEqual(topicLandingLoop(loadTopicPage('angles-introduction-measurement-grade-7')), {
      kind: 'css', variant: 'measure', marker: 'measure',
    });
    assert.match(topic, /const cssVariant = landingLoop\.kind === 'css' && !componentLoop \? landingLoop\.variant : undefined;/);
    assert.match(topic, /componentLoop === 'adjacent-vertical-angles' && <AdjacentVerticalAnglesLoop marker=\{componentLoop\} \/>/);
    assert.match(comp, /data-landing-loop=\{marker\}/);
  });

  it('gives both demo cards a stable anchor', () => {
    assert.deepEqual(LANDING_LOOP_ANCHORS, {
      'angles-introduction-measurement-grade-7': 'angle-measure-animation',
      'adjacent-vertical-angles-grade-7': 'adjacent-vertical-angles-animation',
    });
    assert.match(topic, /id=\{demoAnchor\}/);
    assert.match(read('src/styles/exact-topic.css'), /\.exact-topic \.exact-topic-demo \{[^}]*scroll-margin-top: 120px;/);
  });

  it('has labelled, keyboard-reachable controls and honours the site motion switch', () => {
    assert.match(comp, /role="group" aria-label="סוג הזוויות"/);
    assert.match(comp, /data-av-mode="adjacent" aria-pressed="true">זוויות צמודות</);
    assert.match(comp, /data-av-mode="vertical" aria-pressed="false">זוויות קודקודיות</);
    assert.match(comp, /<span>גודל הזווית<\/span>/);
    assert.match(comp, /type="range"/);
    assert.match(comp, /role="status" aria-live="polite"/);
    assert.match(comp, /min-height: 44px/);
    assert.match(comp, /:focus-visible/);
    assert.match(comp, /sitePrefersReducedMotion\(\)/);
    assert.match(comp, /nd-motion-off/);
    assert.match(comp, /noam-a11y-motion/);
    assert.match(comp, /document\.visibilityState !== 'hidden'/);
    assert.match(comp, /IntersectionObserver/);
    assert.doesNotMatch(comp, /רמה ג/);
    assert.match(comp, /<p class="avx__eq" dir="ltr">/);
  });
});
