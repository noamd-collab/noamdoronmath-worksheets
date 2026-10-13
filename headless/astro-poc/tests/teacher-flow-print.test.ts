import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The continuous teacher worksheet: geometry of each exercise block, the
 * answer key, and page filling. Functions are taken from the served print
 * script, the same way the other teacher print tests do it.
 */
const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const demo = readFileSync(new URL('../../../demos/teacher-factoring-print.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');

type Box = { page?: number; x: number; y: number; w: number; h: number };
type Mask = { x0: number; x1: number; y0: number; y1: number };
type Piece = { page: number; y0: number; y1: number; masks: Mask[]; erase: { y: number }[] };
type Block = { kind: string; group: string; height: number; keepWithNext?: boolean; key: string; pulled?: boolean; scale?: number };

const geometry = printer.slice(printer.indexOf('const FLOW = {'), printer.indexOf('async function measurePieces'));
const pagination = printer.slice(printer.indexOf('function paginate'), printer.indexOf('function eraseRule'));
const engine = new Function(`${geometry}\n${pagination}\nreturn { FLOW, questionPieces, answerPieces, paginate, partRanges, clampBand };`)() as {
  FLOW: { PAGE_H: number; GAP: number; X0: number; X1: number; PULL_BELOW: number; LOOKAHEAD: number };
  questionPieces: (source: unknown, layout: unknown, q: number, picked: Set<string>) => Piece[];
  answerPieces: (source: unknown, layout: unknown, q: number, picked: Set<string>) => Piece[] | null;
  paginate: (blocks: Block[]) => { items: { block: Block; y: number }[]; used: number }[];
};
const { FLOW, questionPieces, answerPieces, paginate } = engine;

function sheet(pdfId: string) {
  const source = JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${pdfId}.json`, import.meta.url), 'utf8'));
  source.questions.forEach((question: { source?: unknown }) => { question.source = source; });
  const layout = JSON.parse(readFileSync(new URL(`../public/teachers/print-layout/${pdfId}.json`, import.meta.url), 'utf8'));
  const byId = Object.fromEntries(source.questions.map((question: { id: string }) => [question.id, question]));
  return { source, layout, byId };
}

/** Is source point (x, y) printed? Inside a piece and not under a white mask. */
function shown(pieces: Piece[], pageNumber: number, x: number, y: number) {
  return pieces.some((piece) => piece.page === pageNumber && y > piece.y0 && y < piece.y1
    && !piece.masks.some((mask) => x > mask.x0 && x < mask.x1 && y > mask.y0 && y < mask.y1));
}

describe('continuous teacher worksheet: exercise blocks', () => {
  it('keeps the whole house drawing with 8ד and prints none of 8א–8ג', () => {
    const { source, layout, byId } = sheet('871fe90d52a04673a7d30fc039e4bf2e');
    const pieces = questionPieces(source, layout, 8, new Set(['8ד']));
    const figure = byId['8ד'].figure;
    const house = layout.figures.find((item: { page: number; x0: number; y0: number; y1: number }) => item.page === 3 && item.y0 < figure.y0 + 0.01 && item.y1 > figure.y1 - 0.01);
    assert.ok(house, 'measured house drawing');
    // Every point of the drawing is printed (no cut, no mask over it).
    for (let y = house.y0 + 0.004; y < house.y1 - 0.004; y += 0.005) {
      for (let x = house.x0 + 0.01; x < house.x1 - 0.01; x += 0.03) assert.ok(shown(pieces, 3, x, y), `house ${x} ${y}`);
    }
    // The stem and 8ד's own text are printed full width.
    const stem = byId['8א'].stem;
    assert.ok(shown(pieces, 3, 0.7, stem.y + stem.h / 2));
    assert.ok(shown(pieces, 3, 0.7, byId['8ד'].row.y + 0.008));
    // The text of 8א, 8ב and 8ג is not.
    for (const id of ['8א', '8ב', '8ג']) {
      const row = byId[id].row;
      assert.equal(shown(pieces, 3, 0.7, row.y + Math.min(row.h, 0.03) / 2), false, id);
    }
    // One block: the drawing is never split into two pieces.
    assert.equal(pieces.filter((piece) => piece.y0 <= house.y0 + 0.001 && piece.y1 >= house.y1 - 0.001).length, 1);
  });

  it('keeps the dashed roof line inside the house (not a writing rule)', () => {
    const { layout } = sheet('871fe90d52a04673a7d30fc039e4bf2e');
    const house = layout.figures.find((item: { page: number; y0: number }) => item.page === 3 && item.y0 < 0.09);
    for (const rule of layout.rules.filter((item: { page: number }) => item.page === 3)) {
      const inside = rule.y > house.y0 && rule.y < house.y1 && rule.x0 >= house.x0 - 0.01 && rule.x1 <= house.x1 + 0.01;
      assert.equal(inside, false, JSON.stringify(rule));
    }
  });

  it('prints 3ב with its question number and without 3א', () => {
    const { source, layout, byId } = sheet('f4e2bea04e5a4e7382733a7be67c5e46');
    const pieces = questionPieces(source, layout, 3, new Set(['3ב']));
    const marker = layout.markers['3'];
    assert.ok(marker, 'question number measured');
    assert.ok(shown(pieces, marker.page, (marker.x0 + marker.x1) / 2, (marker.y0 + marker.y1) / 2), 'number 3 printed');
    const bet = byId['3ב'].row;
    assert.ok(shown(pieces, 2, 0.6, bet.y + 0.012), '3ב printed');
    const aleph = byId['3א'].row;
    for (let x = 0.1; x < marker.x0 - 0.01; x += 0.05) {
      assert.equal(shown(pieces, 2, x, aleph.y + aleph.h * 0.6), false, `3א text at ${x}`);
    }
  });

  it('prints 19ד with the stem and the whole triangle, and lifts the other parts’ rules', () => {
    const { source, layout, byId } = sheet('b7a76fde760d4c2e9252a933ed40a6c5');
    const pieces = questionPieces(source, layout, 19, new Set(['19ד']));
    const triangle = layout.figures.find((item: { page: number; y0: number; x1: number }) => item.page === 7 && item.y0 < 0.06 && item.x1 < 0.3);
    assert.ok(triangle);
    assert.equal(pieces.filter((piece) => piece.y0 <= triangle.y0 + 0.001 && piece.y1 >= triangle.y1 - 0.001).length, 1);
    assert.ok(shown(pieces, 7, 0.6, 0.056), 'stem line');
    assert.ok(shown(pieces, 7, 0.6, byId['19ד'].row.y + 0.01), '19ד');
    for (const id of ['19א', '19ב', '19ג']) assert.equal(shown(pieces, 7, 0.6, byId[id].box.y + byId[id].box.h / 2), false, id);
    const lifted = pieces.flatMap((piece) => piece.erase.map((rule) => rule.y));
    assert.ok(lifted.length >= 2, 'rules under hidden parts are lifted out of the drawing column');
  });

  it('never prints the sheet header with a first question', () => {
    const { source, layout } = sheet('050b9cc226cd4326931adfb3c0775a05');
    assert.ok(layout.headerEnd && layout.headerEnd.y > 0.2);
    const pieces = questionPieces(source, layout, 1, new Set(['1א', '1ב']));
    assert.ok(pieces.length > 0);
    for (const piece of pieces.filter((item) => item.page === 1)) assert.ok(piece.y0 >= layout.headerEnd.y - 0.0005, `${piece.y0}-${piece.y1}`);
  });

  it('stops 6ד above the next section bar and keeps its letter tops', () => {
    const { source, layout, byId } = sheet('871fe90d52a04673a7d30fc039e4bf2e');
    const pieces = questionPieces(source, layout, 6, new Set(['6ד']));
    const bar = layout.sections.find((item: { page: number; y0: number }) => item.page === byId['6ד'].page && item.y0 > byId['6ד'].row.y);
    assert.ok(bar);
    for (const piece of pieces) assert.ok(piece.y1 <= bar.y0 + 0.0005, `${piece.y0}-${piece.y1}`);
    const label = byId['6ד'].row;
    assert.ok(pieces.some((piece) => piece.y0 <= label.y + 0.0005), '6ד starts at its measured label top');
  });

  it('never prints the running footer under a last part (7ד)', () => {
    const { source, layout, byId } = sheet('871fe90d52a04673a7d30fc039e4bf2e');
    const row = byId['7ד'].row;
    const margin = layout.margins[String(row.page)];
    assert.ok(margin && margin[1] < 0.97);
    const pieces = questionPieces(source, layout, 7, new Set(['7ד']));
    for (const piece of pieces) assert.ok(piece.y1 <= margin[1] + 0.0005, `${piece.y0}-${piece.y1}`);
  });

  it('prints each part of a shared drawing once, in source order, without overlapping pieces', () => {
    const { source, layout, byId } = sheet('0d548ce76eb74a1ab10385cdaf1f77ca');
    for (const ids of [['9א', '9ב'], ['9א', '9ב', '9ג'], ['9ב'], ['9א']]) {
      const pieces = questionPieces(source, layout, 9, new Set(ids));
      const onPage = pieces.filter((piece) => piece.page === 4).sort((a, b) => a.y0 - b.y0);
      for (let index = 1; index < onPage.length; index += 1) assert.ok(onPage[index - 1].y1 <= onPage[index].y0 + 0.0005, ids.join());
      for (const id of ids) assert.ok(shown(pieces, byId[id].page, 0.7, byId[id].box.y + byId[id].box.h / 2), `${ids.join()} shows ${id}`);
      for (const id of ['9א', '9ב', '9ג'].filter((item) => !ids.includes(item))) {
        assert.equal(shown(pieces, byId[id].page, 0.7, byId[id].box.y + byId[id].box.h / 2), false, `${ids.join()} hides ${id}`);
      }
    }
  });

  it('keeps the 9ג sketch that runs past 9ד, and hides 9ד', () => {
    const { source, layout, byId } = sheet('2056de6d71e14c98aa5efe856d2e1bcf');
    const pieces = questionPieces(source, layout, 9, new Set(['9ג']));
    assert.ok(shown(pieces, 4, 0.7, byId['9ג'].box.y + byId['9ג'].box.h / 2));
    assert.equal(shown(pieces, 4, 0.7, byId['9ד'].box.y + byId['9ד'].box.h / 2), false);
    const sketch = layout.figures.find((item: { page: number; y0: number; y1: number }) => item.page === 4
      && item.y0 < byId['9ד'].row.y && item.y1 > byId['9ג'].row.y);
    if (sketch) assert.ok(shown(pieces, 4, (sketch.x0 + sketch.x1) / 2, (sketch.y0 + sketch.y1) / 2), 'sketch printed');
  });

  it('measures layout for every middle-school sheet, from the original PDFs only', () => {
    const sheets = readdirSync(new URL('../public/teachers/sheets/', import.meta.url)).filter((name) => name.endsWith('.json'));
    let withAnswers = 0;
    for (const name of sheets) {
      const file = new URL(`../public/teachers/print-layout/${name}`, import.meta.url);
      assert.ok(existsSync(file), name);
      const layout = JSON.parse(readFileSync(file, 'utf8'));
      assert.equal(layout.pdfId + '.json', name);
      assert.ok(Array.isArray(layout.figures) && Array.isArray(layout.rules));
      if (layout.answers) withAnswers += 1;
      // Boxes only: nothing re-typed.
      assert.equal(JSON.stringify(layout).includes('"text"'), false, name);
    }
    assert.ok(withAnswers / sheets.length > 0.95, `answers on ${withAnswers} of ${sheets.length}`);
    assert.ok(existsSync(new URL('../scripts/measure-print-layout.py', import.meta.url)));
  });
});

describe('continuous teacher worksheet: answer key', () => {
  it('keeps the number and 19ד, and masks the answers of 19א–19ג', () => {
    const { source, layout } = sheet('b7a76fde760d4c2e9252a933ed40a6c5');
    const record = layout.answers.questions['19'];
    const pieces = answerPieces(source, layout, 19, new Set(['19ד']))!;
    assert.ok(pieces && pieces.length);
    const first = record.lines[0];
    assert.ok(shown(pieces, first.page, (record.num.x0 + FLOW.X1) / 2, first.y + first.h / 2), 'number');
    for (const letter of ['א', 'ב', 'ג']) {
      for (const box of record.parts[letter]) assert.equal(shown(pieces, box.page, box.x + box.w / 2, box.y + box.h / 2), false, letter);
    }
    for (const box of record.parts['ד']) assert.ok(shown(pieces, box.page, box.x + box.w / 2, box.y + box.h / 2), 'ד');
    // The "·" before ד sits between a hidden and a shown part: masked, no stray dot.
    const sep = record.seps['ד'];
    if (sep) assert.equal(shown(pieces, sep.page, sep.x + sep.w / 2, sep.y + sep.h / 2), false, 'separator');
  });

  it('prints the whole source lines when every part is picked', () => {
    const { source, layout } = sheet('871fe90d52a04673a7d30fc039e4bf2e');
    const all = new Set(['2א', '2ב', '2ג', '2ד']);
    const pieces = answerPieces(source, layout, 2, all)!;
    assert.ok(pieces.every((piece) => piece.masks.length === 0));
    const lines = layout.answers.questions['2'].lines;
    assert.ok(Math.abs(pieces[0].y0 - lines[0].y) < 1e-9);
  });
});

describe('continuous teacher worksheet: pages', () => {
  function blocks(heights: number[], group = 'g') {
    return heights.map((height, index) => ({ kind: 'question', group, height, key: `${group}:${index}` }));
  }

  it('never splits a block and keeps every page but the last well filled', () => {
    let seed = 7;
    const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    for (let run = 0; run < 200; run += 1) {
      const list = blocks(Array.from({ length: 4 + Math.floor(random() * 20) }, () => 80 + Math.floor(random() * 700)));
      const pages = paginate(list.map((block) => ({ ...block })));
      const placed = pages.flatMap((item) => item.items.map((entry) => entry.block.key));
      assert.deepEqual(placed.slice().sort(), list.map((block) => block.key).sort());
      pages.forEach((item, index) => {
        assert.ok(item.used <= FLOW.PAGE_H + 0.5);
        if (index === pages.length - 1) return;
        // A page is closed only when the next block in print order did not fit.
        const next = pages[index + 1].items[0].block;
        assert.ok(item.used + FLOW.GAP + next.height > FLOW.PAGE_H || item.used / FLOW.PAGE_H >= 0.6, `run ${run} page ${index + 1}`);
      });
    }
  });

  it('pulls a smaller exercise up only from the same sheet, a few places ahead', () => {
    const list = [
      ...blocks([700, 900, 300], 'a'),
      { kind: 'title', group: 'b', height: 80, keepWithNext: true, key: 'b:title' },
      ...blocks([200], 'b'),
    ];
    const pages = paginate(list);
    const first = pages[0].items.map((entry) => entry.block.key);
    assert.deepEqual(first, ['a:0', 'a:2']);
    assert.equal(pages[0].items[1].block.pulled, true);
    assert.ok(!first.includes('b:0'));
  });

  it('keeps a sheet title with its first exercise', () => {
    const list = [
      ...blocks([1300], 'a'),
      { kind: 'title', group: 'b', height: 80, keepWithNext: true, key: 'b:title' },
      ...blocks([400], 'b'),
    ];
    const pages = paginate(list);
    assert.deepEqual(pages[1].items.map((entry) => entry.block.key), ['b:title', 'b:0']);
  });

  it('gives a block taller than a page a page of its own, scaled', () => {
    const pages = paginate(blocks([300, 2400, 300]));
    const tall = pages.find((item) => item.items.some((entry) => entry.block.key === 'g:1'))!;
    assert.equal(tall.items.length, 1);
    assert.ok(tall.items[0].block.scale! < 1);
  });
});

describe('continuous teacher worksheet: page shell', () => {
  it('prints בס״ד on every page and starts the answer key after the questions', () => {
    assert.equal(demo, printer);
    assert.match(printer, /<div class="flow-basad" dir="rtl">בס״ד<\/div>/);
    assert.match(printer, /name: 'questions', pages: paginate\(questions\)/);
    assert.match(printer, /name: 'answers', pages: answers\.length \? paginate\(answers\) : \[\]/);
    assert.match(page, /\.print-area \.flow-page\{[^}]*height:281mm[^}]*break-inside:avoid[^}]*break-after:page/);
    assert.match(page, /\.print-area \.flow-basad\{/);
    assert.match(printer, /async function hasBasad/);
    assert.match(page, /id="clear-selection"/);
  });
});
