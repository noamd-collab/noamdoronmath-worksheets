import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';

const context: any = {};
runInNewContext(readFileSync(new URL('../public/noam-native-visual.js', import.meta.url), 'utf8'), context);
const api = context.NoamNativeVisual;
const json = (path: string) => JSON.parse(readFileSync(new URL('../public/' + path, import.meta.url), 'utf8'));
const svgText = (url: string) => readFileSync(new URL('../public' + url, import.meta.url), 'utf8');
const labels = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].trim()).filter(Boolean);
const show = { studentMessage: 'הראה את השרטוט המקורי', helpKind: 'free_question' };

// Multi-panel questions export one SVG per panel, but every item used to point at the first one.
// These subsections name a single other panel in their printed text; each panel was checked
// against the rendered PDF page. `has`/`lacks` are that panel's own axis labels.
const remapped = [
  { pkg: 'G9-T13', level: 'a', pdf: 'e10786e0b31e4de894b0778da9d12495', q: 17, part: 'ב', panel: 'q17_head_2',
    text: /המערכת השנייה/, has: ['u', 'v'], lacks: ['f', 'g'], siblings: { 'א': 'q17_head', 'ג': 'q17_head' } },
  { pkg: 'G7-T24', level: 'a', pdf: '5a67514458aa434a9cbdf82ff70b5fd0', q: 20, part: 'ג', panel: 'q20_head_2',
    text: /בתרשים הימני/, has: ['45', '55'], lacks: ['0'], siblings: { 'א': 'q20_head', 'ב': 'q20_head' } },
  { pkg: 'G7-T24', level: 'a', pdf: '5a67514458aa434a9cbdf82ff70b5fd0', q: 20, part: 'ד', panel: 'q20_head_2',
    text: /התרשים הימני/, has: ['45', '55'], lacks: ['0'], siblings: {} },
  { pkg: 'G8-T29', level: 'c', pdf: 'c0bf9e333ab94edd907961bc85098ece', q: 20, part: 'א', panel: 'q20_head_2',
    text: /שהציר שלו מתחיל ב־\$50\$/, has: ['50', '70'], lacks: ['0'], siblings: { 'ב': 'q20_head', 'ד': 'q20_head' } },
  { pkg: 'G8-T29', level: 'c', pdf: 'c0bf9e333ab94edd907961bc85098ece', q: 20, part: 'ג', panel: 'q20_head_2',
    text: /ציר חתוך/, has: ['50', '70'], lacks: ['0'], siblings: {} },
  { pkg: 'G8-T35', level: 'a', pdf: '0b35039ff7184b488eb37f1c0e37b493', q: 7, part: 'ד', panel: 'q7_head_2',
    text: /הציר הקטום/, has: ['84'], lacks: ['0'], siblings: { 'א': 'q7_head', 'ב': 'q7_head', 'ג': 'q7_head', 'ה': 'q7_head' } },
];

function section(pdf: string, q: number, part: string) {
  const manifest = json(`noam-ai/manifests/${pdf}.json`);
  const exercise = manifest.exercises.find((e: any) => e.q === q && e.part === part);
  const data = json(manifest.nativeExportUrl.slice(1));
  const question = data.questions.find((x: any) => x.id === exercise.nativeQuestionId);
  const item = question.items.find((x: any) => x.id === exercise.nativeItemId);
  return { manifest, exercise, data, item };
}

it('a subsection that names one panel of a multi-panel question receives that panel, not the first', () => {
  for (const c of remapped) {
    const { exercise, data, item } = section(c.pdf, c.q, c.part), name = `${c.pkg}/${c.level} q${c.q}${c.part}`;
    assert.match(item.text, c.text, name + ' printed text names the panel');
    assert.equal(item.figure_id, c.panel, name + ' source item');
    assert.equal(exercise.nativeFigureId, c.panel, name + ' manifest figure');
    assert.equal(exercise.nativeFigureUrl, `/noam-ai/native/${c.pkg}/${c.level}/figures/${c.panel}.svg`, name + ' manifest url');
    const svg = svgText(exercise.nativeFigureUrl), seen = labels(svg);
    for (const label of c.has) assert.ok(seen.includes(label), `${name} panel shows ${label}`);
    for (const label of c.lacks) assert.ok(!seen.includes(label), `${name} panel has no ${label}`);
    assert.equal(api.resolve(data, exercise, show, svg)?.kind, 'source-context', name + ' passes the viewer source gate');
    assert.equal(api.authoredContext(data, exercise, svg)?.hasFigure, true, name + ' worker context keeps the figure');
    // The panel that was linked before must fail closed for this subsection.
    const first = data.questions.find((x: any) => x.id === exercise.nativeQuestionId).figure_id;
    const stale = { ...exercise, nativeFigureId: first, nativeFigureUrl: exercise.nativeFigureUrl.replace(c.panel, first) };
    assert.equal(api.resolve(data, stale, show, svgText(stale.nativeFigureUrl)), null, name + ' stale first panel rejected');
    for (const [part, panel] of Object.entries(c.siblings)) {
      const s = section(c.pdf, c.q, part);
      assert.equal(s.item.figure_id, panel, `${c.pkg} q${c.q}${part} keeps its own panel`);
      assert.equal(s.exercise.nativeFigureId, panel, `${c.pkg} q${c.q}${part} manifest keeps its own panel`);
    }
  }
});

it('secondary panels are reached only by reviewed subsections', () => {
  const allowed = new Set(remapped.map((c) => `${c.pkg}/${c.level}/${c.q}${c.part}`));
  const reached: string[] = [];
  for (const registry of ['pilot', 'next-ten', 'second-ten', 'third-ten', 'fourth-ten', 'remaining-101']) {
    for (const sheet of json(`../src/data/worksheet-${registry}.v1.json`).sheets) {
      const manifest = json(`noam-ai/manifests/${sheet.pdfId}.json`);
      for (const e of manifest.exercises) {
        if (/_head_\d+$/.test(e.nativeFigureId || '')) reached.push(`${sheet.package}/${sheet.nativeLevel}/${e.q}${e.part}`);
      }
    }
  }
  assert.deepEqual([...new Set(reached)].sort(), [...allowed].sort());
});

it('every catalog subsection that links a source SVG passes the viewer source gate', () => {
  const catalog = json('../src/data/catalog.v1.json'), packages = new Map(), failures: string[] = [];
  let checked = 0;
  for (const grade of catalog.grades) for (const topic of grade.topics) {
    if (!topic.routing?.usesViewer) continue;
    for (const level of topic.levels) {
      const manifest = json(`noam-ai/manifests/${level.pdfId}.json`);
      if (!manifest.nativeExportUrl) continue;
      if (!packages.has(manifest.nativeExportUrl)) packages.set(manifest.nativeExportUrl, json(manifest.nativeExportUrl.slice(1)));
      const data = packages.get(manifest.nativeExportUrl);
      for (const exercise of manifest.exercises) {
        if (!exercise.nativeFigureUrl) continue;
        checked++;
        if (api.resolve(data, exercise, show, svgText(exercise.nativeFigureUrl))?.kind !== 'source-context') failures.push(`${level.pdfId} ${exercise.id}`);
      }
    }
  }
  assert.ok(checked > 16000, 'covers the catalog source figures');
  assert.deepEqual(failures, []);
});
