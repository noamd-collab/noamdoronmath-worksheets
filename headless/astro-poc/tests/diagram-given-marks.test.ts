import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, '..');
const Plan = require(join(root, 'public/noam-diagram-plan.js'));
const fixture = JSON.parse(readFileSync(join(root, 'tests/fixtures/diagram-given-marks/g9-t46-a-q1b.json'), 'utf8'));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ctx = (extra: Record<string, string> = {}) => ({ ...fixture.context, ...extra });
const ticks = (scene: any) => scene.equalGroups.map((g: any) => [g.count, g.segments.map((s: string[]) => s.join(''))]);

describe('preserved given data is separate from focus (G9-T46 A Q1b)', () => {
  it('before: without the source equalities the drawing passes but carries no ticks', () => {
    const p = clone(fixture.plan); p.equalGroups = []; p.evidence = [];
    const r = Plan.inspect(p, ctx());
    assert.equal(r.ok, true, r.reason);
    assert.deepEqual(r.scene.equalGroups, []);
  });

  it('after: the source ticks PQ=PS and QR=RS are kept while PQ and QR stay the focus', () => {
    const p = clone(fixture.plan), copy = clone(p);
    const r = Plan.inspect(p, ctx());
    assert.equal(r.ok, true, r.reason);
    assert.deepEqual(ticks(r.scene), [[1, ['PQ', 'PS']], [2, ['QR', 'RS']]]);
    assert.deepEqual(r.scene.highlights.map((h: any) => h.from + h.to), ['PQ', 'QR'], 'focus highlighting is unchanged');
    assert.deepEqual(p, copy, 'the wire plan is not mutated');
  });

  it('after, with a structured focus contract (PQ, QR only): question givens still keep their ticks', () => {
    const facts = { visible_points: ['P', 'Q', 'R', 'S'], strokes: [['P', 'Q'], ['Q', 'R'], ['R', 'S'], ['S', 'P']] };
    const focus = { version: 1, status: 'ok', mode: 'locate', objects: [{ kind: 'segment', points: ['P', 'Q'], color: 'blue' }, { kind: 'segment', points: ['Q', 'R'], color: 'orange' }] };
    const questionText = 'PQ=PS. QR=RS.\nDIAGRAM_FACTS_JSON:' + JSON.stringify(facts) + '\nPEDAGOGICAL_FOCUS_JSON:' + JSON.stringify(focus);
    const r = Plan.inspect(clone(fixture.plan), { questionText, hintText: fixture.context.hintText, studentMessage: '' });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.scene.equalGroups.length, 2);
  });

  it('different tick counts do not imply inequality', () => {
    const p = { version: 1, status: 'ok', points: { A: [0, 0], B: [4, 0], C: [4, 4], D: [0, 4] },
      segments: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']], highlights: [{ from: 'A', to: 'B', color: 'blue', label: 'AB' }],
      angles: [], rightAngles: [], equalGroups: [
        { segments: [['A', 'B'], ['A', 'D']], count: 1, color: 'teal' },
        { segments: [['C', 'B'], ['C', 'D']], count: 2, color: 'teal' }],
      evidence: [{ mark: 'equalGroups.0', source: 'question', quote: 'AB=AD' }, { mark: 'equalGroups.1', source: 'question', quote: 'CB=CD' }] };
    const r = Plan.inspect(p, { questionText: 'AB=AD. CB=CD.', hintText: 'התבוננו בצלע AB.', studentMessage: '' });
    assert.equal(r.ok, true, r.reason);
  });
});

describe('marks that are not given in the data stay blocked', () => {
  it('an equality cited only from the hint is still limited to the current focus', () => {
    const p = clone(fixture.plan); p.equalGroups = [p.equalGroups[0]];
    p.evidence = [{ mark: 'equalGroups.0', source: 'hint', quote: 'PQ=PS' }];
    // Structured focus: only PQ and QR are in scope; PS is not.
    const facts = { visible_points: ['P', 'Q', 'R', 'S'], strokes: [['P', 'Q'], ['Q', 'R'], ['R', 'S'], ['S', 'P']] };
    const focus = { version: 1, status: 'ok', mode: 'locate', objects: [{ kind: 'segment', points: ['P', 'Q'], color: 'blue' }, { kind: 'segment', points: ['Q', 'R'], color: 'orange' }] };
    const questionText = 'במרובע PQRS.\nDIAGRAM_FACTS_JSON:' + JSON.stringify(facts) + '\nPEDAGOGICAL_FOCUS_JSON:' + JSON.stringify(focus);
    const r = Plan.inspect(p, { questionText, hintText: 'התבוננו בצלעות PQ ו־QR. PQ=PS.', studentMessage: '' });
    assert.equal(r.ok, false); assert.equal(r.reason, 'outside_current_focus');
  });

  it('an equality without evidence is rejected', () => {
    const p = clone(fixture.plan); p.evidence = [];
    assert.equal(Plan.inspect(p, ctx()).ok, false);
  });

  it('a question quote that does not state the drawn equality is rejected', () => {
    const p = clone(fixture.plan); p.equalGroups = [{ segments: [['P', 'Q'], ['Q', 'R']], count: 1, color: 'teal' }];
    p.evidence = [{ mark: 'equalGroups.0', source: 'question', quote: 'PQ=PS' }];
    const r = Plan.inspect(p, ctx());
    assert.equal(r.ok, false); assert.equal(r.reason, 'ungrounded_mark');
  });

  it('a claim the question asks about (not a given) cannot become a tick', () => {
    const p = clone(fixture.plan); p.equalGroups = [{ segments: [['P', 'Q'], ['Q', 'R']], count: 1, color: 'teal' }];
    p.evidence = [{ mark: 'equalGroups.0', source: 'question', quote: 'האם PQ=QR?' }];
    const r = Plan.inspect(p, ctx({ questionText: 'PQ=PS. QR=RS. האם PQ=QR?' }));
    assert.equal(r.ok, false);
  });

  it('given ticks that contradict the drawn coordinates are rejected', () => {
    const p = clone(fixture.plan); p.points.S = [3, 3];
    const r = Plan.inspect(p, ctx());
    assert.equal(r.ok, false); assert.match(String(r.reason), /contradiction/);
  });

  it('a given equality on an undrawn segment is rejected', () => {
    const p = clone(fixture.plan); p.segments = [['P', 'Q'], ['Q', 'R'], ['R', 'S']];
    const r = Plan.inspect(p, ctx());
    assert.equal(r.ok, false); assert.equal(r.reason, 'undrawn_mark');
  });
});
