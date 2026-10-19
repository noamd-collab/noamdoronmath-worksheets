import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import vm from 'node:vm';

const root = join(import.meta.dirname, '..');
// public/ sits under "type":"module", so these UMD browser files cannot be
// require()d directly. Evaluate them as CommonJS in a sandbox instead.
function loadUmd(file: string, deps: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  // Same realm as the test, so plain test objects keep Object.prototype.
  const run = vm.compileFunction(readFileSync(join(root, 'public', file), 'utf8'), ['module', 'exports', 'require'], { filename: file });
  run(module, module.exports, (name: string) => deps[name]);
  return module.exports;
}
const Geometry = loadUmd('noam-geometry.js');
const Plan = loadUmd('noam-diagram-plan.js', { './noam-geometry.js': Geometry });
void createRequire;
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

function documentStub() {
  function create(name: string): any {
    return { name, attributes: {} as Record<string, string>, children: [] as any[], className: '', textContent: '',
      appendChild(node: any) { this.children.push(node); return node; },
      setAttribute(key: string, value: string) { this.attributes[key] = String(value); if (key === 'class') this.className = String(value); } };
  }
  return { createElementNS: (_ns: string, name: string) => create(name), createElement: create, createTextNode: (t: string) => ({ name: '#text', textContent: t, children: [] }) };
}
const nodes = (n: any): any[] => (n ? [n].concat((n.children || []).flatMap(nodes)) : []);
const tickMarks = (svg: any) => nodes(svg).filter((n) => (n.className || n.attributes?.class) === 'noam-geometry-equality-mark').length;

describe('source given-data marks are guaranteed from the package, not the model', () => {
  const withSource = () => ({ ...fixture.context, sourceGivens: fixture.sourceGivens });
  it('the model omits equalGroups: the drawing still carries the source ticks (1+1+2+2 marks)', () => {
    const p = clone(fixture.plan); p.equalGroups = []; p.evidence = [];
    const r = Plan.inspect(p, withSource());
    assert.equal(r.ok, true, r.reason);
    assert.deepEqual(ticks(r.scene), [[1, ['PQ', 'PS']], [2, ['QR', 'RS']]]);
    assert.deepEqual(r.scene.highlights.map((h: any) => h.from + h.to), ['PQ', 'QR']);
    assert.equal(tickMarks(Plan.render(documentStub(), p, withSource())), 6);
  });
  it('without source givens the same plan renders no ticks (the old behaviour)', () => {
    const p = clone(fixture.plan); p.equalGroups = []; p.evidence = [];
    assert.equal(tickMarks(Plan.render(documentStub(), p, fixture.context)), 0);
  });
  it('the source tick count wins over a model count for the same pair', () => {
    const p = clone(fixture.plan); p.equalGroups = [{ segments: [['Q', 'R'], ['R', 'S']], count: 3, color: 'teal' }];
    p.evidence = [{ mark: 'equalGroups.0', source: 'question', quote: 'QR=RS' }];
    const r = Plan.inspect(p, withSource());
    assert.equal(r.ok, true, r.reason);
    assert.deepEqual(ticks(r.scene).sort(), [[1, ['PQ', 'PS']], [2, ['QR', 'RS']]]);
  });
  it('source givens alone never count as the current focus', () => {
    const p = clone(fixture.plan); p.highlights = []; p.equalGroups = []; p.evidence = [];
    assert.equal(Plan.inspect(p, withSource()).reason, 'missing_focus');
  });
  it('a source given on an undrawn segment is skipped, not invented', () => {
    const p = clone(fixture.plan); p.segments = [['P', 'Q'], ['Q', 'R'], ['R', 'S']]; p.equalGroups = []; p.evidence = [];
    const r = Plan.inspect(p, withSource());
    assert.equal(r.ok, true, r.reason);
    assert.deepEqual(ticks(r.scene), [[2, ['QR', 'RS']]]);
  });
  it('drawn coordinates that contradict a source given are rejected', () => {
    const p = clone(fixture.plan); p.points.S = [3, 3]; p.equalGroups = []; p.evidence = [];
    assert.equal(Plan.inspect(p, withSource()).reason, 'source_coordinate_contradiction');
  });
  it('malformed source givens add nothing', () => {
    const p = clone(fixture.plan); p.equalGroups = []; p.evidence = [];
    const bad = [{ segments: [['P', 'Q'], ['P', 'X']], count: 1 }, { segments: [['P', 'Q']], count: 1 }, { segments: [['P', 'Q'], ['P', 'S']], count: 4 }];
    const r = Plan.inspect(p, { ...fixture.context, sourceGivens: bad });
    assert.equal(r.ok, true, r.reason); assert.deepEqual(r.scene.equalGroups, []);
  });
});

describe('viewer reads source givens from the approved package data', () => {
  const html = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');
  const fn = html.match(/var noamSourceGivensCache=\{\};\nfunction noamSourceGivens\(exercise\)\{[\s\S]*?\n\}\n/)?.[0];
  function run(url: string, qid: string) {
    assert.ok(fn, 'noamSourceGivens');
    const sandbox: any = { fetch: async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync(join(root, 'public', u), 'utf8')) }) };
    vm.runInNewContext(fn + '\nresult=noamSourceGivens({nativeFigureUrl:' + JSON.stringify(url) + ',nativeQuestionId:' + JSON.stringify(qid) + '});', sandbox);
    return sandbox.result;
  }
  it('G9-T46 A q1: PQ=PS one tick, RQ=RS two ticks', async () => {
    assert.deepEqual(JSON.parse(JSON.stringify(await run('/noam-ai/native/G9-KITE/a/figures/q1_head.svg', 'q1'))),
      [{ segments: [['P', 'Q'], ['P', 'S']], count: 1 }, { segments: [['R', 'Q'], ['R', 'S']], count: 2 }]);
  });
  it('G8-T39 A q1: AC=AD and BC=BD with their source tick counts', async () => {
    const r = JSON.parse(JSON.stringify(await run('/noam-ai/native/G8-T39/a/figures/q1_head.svg', 'q1')));
    assert.deepEqual(r.map((g: any) => g.segments.map((s: string[]) => s.join(''))), [['AC', 'AD'], ['BC', 'BD']]);
    assert.ok(r.every((g: any) => [1, 2, 3].includes(g.count)));
  });
  it('an unapproved figure URL yields no marks', async () => {
    assert.deepEqual(JSON.parse(JSON.stringify(await run('/noam-ai/native/../x/a/figures/q1_head.svg', 'q1'))), []);
  });
});

describe('evidence source spoofing', () => {
  it('rejects a hint-only equality labelled source "question" (grounded against the question text only)', () => {
    const p = clone(fixture.plan);
    p.equalGroups = [{ segments: [['P', 'S'], ['R', 'S']], count: 1, color: 'teal' }];
    p.evidence = [{ mark: 'equalGroups.0', source: 'question', quote: 'PS=RS' }];
    const r = Plan.inspect(p, { ...fixture.context, hintText: fixture.context.hintText + ' PS=RS.' });
    assert.equal(r.reason, 'unproven_evidence');
  });
});

describe('source-constrained kite geometry (reported rectangle)', () => {
  const context = () => ({ ...fixture.context, sourceGivens: clone(fixture.sourceGivens) });
  function rectangle() {
    const p = clone(fixture.plan); p.equalGroups = []; p.evidence = [];
    p.points = { P: [0, 0], Q: [0, 4], R: [3, 4], S: [3, 0] };
    return p;
  }
  function verify(original: any, repaired: any, c: any) {
    assert.ok(repaired);
    assert.equal(Plan.inspect(repaired, c).ok, true);
    assert.deepEqual({ ...repaired, points: original.points }, original, 'coordinates only');
    const length = (a: string, b: string) => Math.hypot(repaired.points[a][0] - repaired.points[b][0], repaired.points[a][1] - repaired.points[b][1]);
    assert.ok(Math.abs(length('P', 'Q') - length('P', 'S')) < 1e-10);
    assert.ok(Math.abs(length('R', 'Q') - length('R', 'S')) < 1e-10);
    assert.equal(tickMarks(Plan.render(documentStub(), repaired, c)), 6);
    for (const [a, b, d] of [['P', 'Q', 'R'], ['Q', 'R', 'S'], ['R', 'S', 'P'], ['S', 'P', 'Q']]) {
      const v = (n: string) => [repaired.points[n][0] - repaired.points[b][0], repaired.points[n][1] - repaired.points[b][1]];
      assert.ok(Math.abs(v(a)[0] * v(d)[0] + v(a)[1] * v(d)[1]) > 1e-5, 'no accidental right angle');
    }
    assert.deepEqual(repaired.angles, []); assert.deepEqual(repaired.rightAngles, []);
  }
  it('repairs the reported tall rectangle without adding a proof or changing focus', () => {
    const p = rectangle(), before = clone(p), c = context();
    assert.equal(Plan.inspect(p, c).reason, 'source_coordinate_contradiction');
    verify(p, Plan.repairSourceKiteCoordinates(p, c), c); assert.deepEqual(p, before);
  });
  it('repairs coordinates captured in the actual 19:03:16 UTC diagram job', () => {
    const p = rectangle(); p.points = { Q: [0, 3], R: [4, 3], P: [-2, -1], S: [2, -1] };
    verify(p, Plan.repairSourceKiteCoordinates(p, context()), context());
  });
  it('keeps already valid kites and a valid square unchanged (no inequality assumption)', () => {
    assert.equal(Plan.repairSourceKiteCoordinates(clone(fixture.plan), context()), null);
    const p = rectangle(); p.points.R = [4, 4]; p.points.S = [4, 0];
    assert.equal(Plan.inspect(p, context()).ok, true);
    assert.equal(Plan.repairSourceKiteCoordinates(p, context()), null);
  });
  it('does not repair from missing, malformed, opposite or incomplete source pairs', () => {
    const p = rectangle();
    for (const sourceGivens of [[], [fixture.sourceGivens[0]],
      [{ segments: [['P', 'Q'], ['R', 'S']], count: 1 }, { segments: [['P', 'S'], ['Q', 'R']], count: 2 }],
      [{ segments: [['P', 'Q'], ['P', 'X']], count: 1 }, fixture.sourceGivens[1]],
      fixture.sourceGivens.map((g: any) => ({ ...g, count: 1 }))]) {
      assert.equal(Plan.repairSourceKiteCoordinates(p, { ...context(), sourceGivens }), null);
    }
  });
  it('does not invent missing edges or reshape a larger diagram', () => {
    for (const alter of [(p: any) => p.segments.pop(), (p: any) => p.segments.push(['P', 'R']),
      (p: any) => { p.points.X = [2, 2]; }, (p: any) => { p.points.S = [-3, 2]; }]) {
      const p = rectangle(); alter(p); assert.equal(Plan.repairSourceKiteCoordinates(p, context()), null);
    }
  });
  it('does not bypass conflicting explicit facts or forged proof evidence', () => {
    const p = rectangle(), c = context();
    assert.equal(Plan.repairSourceKiteCoordinates(p, { ...c, questionText: c.questionText + ' PQ∥RS.' }), null);
    p.evidence = [{ mark: 'equalGroups.0', source: 'question', quote: 'PS=RS' }];
    p.equalGroups = [{ segments: [['P', 'S'], ['R', 'S']], count: 1, color: 'teal' }];
    assert.equal(Plan.repairSourceKiteCoordinates(p, c), null);
  });
  it('declines metric data the general validator does not fully parse', () => {
    for (const given of ['PQ=4.', 'PQ=4 ס״מ.', 'אורך PQ הוא ארבע.', 'היחס PQ:QR הוא שתיים לשלוש.', 'הזווית P חדה.']) {
      const c = context(); c.questionText += ' ' + given;
      assert.equal(Plan.repairSourceKiteCoordinates(rectangle(), c), null, given);
    }
  });
});
