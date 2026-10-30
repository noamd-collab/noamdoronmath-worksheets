import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const demo = readFileSync(new URL('../../../demos/teacher-factoring-print.js', import.meta.url), 'utf8');
const pageHtml = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');

const SHEET_IDS = {
  a: '4aba762b64b54af098827d1f386bcf68',
  b: '9c95b48e57124721b4c2b56d79cf72ba',
  c: '871fe90d52a04673a7d30fc039e4bf2e',
};
const PICK = ['1א', '2א', '2', '3ב', '4א', '5א', '6ד', '6', '7א', '8ד', '10א', '12א', '12', '15א', '19ד'];
const ARTIFACTS = process.env.TEACHER_PRINT_ARTIFACTS || join(tmpdir(), 'teacher-print');

function layoutApi(source) {
  const start = printer.indexOf('function boxEnd');
  const end = printer.indexOf('async function measureSlices');
  return new Function('SOURCE', `${printer.slice(start, end)}
    return { shortSlices, packShort, orderPrintQuestions, batchesOf, levelPrintName, answerCropsFromLines, answerHeadingBox, pageInkFromPixels, textItemBox, contentHeight, fittedScale, fittedHeight, sheetContentLimit, worksheetTitle, SHEET_PAGE_H, SHEET_BASAD_H, SHEET_TITLE_H };
  `)(source);
}

function loadSheet(id) {
  return JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${id}.json`, import.meta.url), 'utf8'));
}

function ensurePdf(id) {
  const dir = '/tmp/teacher-pdfs';
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/${id}.pdf`;
  if (!existsSync(path)) {
    const fetched = spawnSync('curl', ['-fsSL', '-o', path, `https://static.wixstatic.com/ugd/d8e7ad_${id}.pdf`], { encoding: 'utf8' });
    if (fetched.status !== 0) throw new Error(fetched.stderr || `download failed ${id}`);
  }
  return path;
}

function runPack(plan) {
  const script = fileURLToPath(new URL('../scripts/render-teacher-pack.py', import.meta.url));
  const result = spawnSync('python3', [script], {
    input: JSON.stringify(plan),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

describe('teacher short worksheet pack', () => {
  it('keeps the public printer identical to the demo copy', () => {
    assert.equal(printer, demo);
  });

  it('scales a crowded short sheet on both axes and keeps the question together', () => {
    const api = layoutApi({});
    const room = api.sheetContentLimit(0, true);
    const crowded = [
      { dh: 700, slice: { gap: 10, block: 'q5', kind: 'stem' } },
      { dh: 400, slice: { gap: 4, block: 'q5', kind: 'row' } },
      { dh: 400, slice: { gap: 4, block: 'q5', kind: 'row' } },
    ];
    assert.ok(api.contentHeight(crowded) > room);
    const pages = api.packShort(crowded);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].some((item) => item.slice.kind === 'stem'), true);
    const scale = api.fittedScale(pages[0], room);
    assert.ok(scale < 1);
    assert.ok(api.fittedHeight(pages[0], scale) <= room);
    const drawW = Math.round(1000 * scale);
    const sample = pages[0][0];
    const dh = Math.max(1, Math.round(sample.dh * scale));
    assert.ok(Math.abs(dh / sample.dh - drawW / 1000) < 0.03);

    const slight = [
      { dh: room - 20, slice: { gap: 8, block: 'q1', kind: 'row' } },
      { dh: 80, slice: { gap: 8, block: 'q2', kind: 'stem' } },
    ];
    assert.ok(api.contentHeight(slight) > room);
    assert.ok(room / api.contentHeight(slight) >= 0.85);
    assert.equal(api.packShort(slight).length, 1);

    const heavy = [
      { dh: 900, slice: { gap: 8, block: 'q1', kind: 'row' } },
      { dh: 200, slice: { gap: 10, block: 'q2', kind: 'stem' } },
      { dh: 900, slice: { gap: 4, block: 'q2', kind: 'row' } },
    ];
    const split = api.packShort(heavy);
    assert.ok(split.length >= 2);
    assert.equal(split[1].some((item) => item.slice.kind === 'stem'), true);
    assert.equal(split[1].some((item) => item.slice.kind === 'footer'), false);
  });

  it('shows one wizard choice at a time, with back, and the sheet at the end', () => {
    assert.match(pageHtml, /<body[^>]*data-wizard="grade"/);
    assert.match(pageHtml, /id="wizard-back"[^>]*hidden/);
    assert.match(pageHtml, /id="wizard-next"/);
    assert.match(pageHtml, /id="wizard-result"/);
    assert.match(pageHtml, /id="wizard-print"/);
    for (const step of ['topic', 'level', 'scenario', 'style', 'pick', 'result']) {
      assert.match(pageHtml, new RegExp(`wiz-off[^>]*data-wiz="${step}"|data-wiz="${step}"[^>]*wiz-off`));
    }
    assert.match(printer, /WIZARD_ORDER = \['grade', 'topic', 'level', 'scenario', 'style', 'pick', 'result'\]/);
    assert.match(printer, /levelPrintName/);
    assert.equal(layoutApi({}).levelPrintName('c', 'רמת מצוינות'), 'מצוינות');
    assert.equal(layoutApi({}).levelPrintName('a', 'רמה א׳'), 'רמה א׳');
    assert.equal(layoutApi({}).levelPrintName('b', 'רמה ב׳'), 'רמה ב׳');
  });

  it('packs the polygon sample without a sparse page and keeps the house regressions', (t) => {
    const probe = spawnSync('python3', ['-c', 'import pymupdf, numpy'], { encoding: 'utf8' });
    if (probe.status !== 0) {
      t.skip('pymupdf is not installed');
      return;
    }

    const sheets = {
      a: loadSheet(SHEET_IDS.a),
      b: loadSheet(SHEET_IDS.b),
      c: loadSheet(SHEET_IDS.c),
    };
    const pdfs = {};
    for (const id of Object.values(SHEET_IDS)) pdfs[id] = ensurePdf(id);
    const SOURCE = {};
    const api = layoutApi(SOURCE);
    const chosen = [];
    for (const level of ['a', 'b', 'c']) {
      const byId = Object.fromEntries(sheets[level].questions.map((question) => [question.id, question]));
      for (const id of PICK) {
        if (!byId[id]) continue;
        chosen.push({ ...byId[id], source: sheets[level] });
      }
    }
    const ordered = api.orderPrintQuestions(chosen);
    const levelOrder = ordered.map((question) => question.source.level + ':' + question.q);
    const sorted = levelOrder.slice().sort((left, right) => {
      const rank = { a: 0, b: 1, c: 2 };
      const [la, qa] = left.split(':');
      const [lb, qb] = right.split(':');
      return (rank[la] - rank[lb]) || (Number(qa) - Number(qb));
    });
    assert.deepEqual(levelOrder, sorted);

    const measuredLines = runPack({ cmd: 'lines', pdfs });
    const pageW = measuredLines.pageSize[0];
    const pageH = measuredLines.pageSize[1];
    const dhOf = (box) => {
      const sw = Math.max(1, box.w * pageW);
      const sh = Math.max(1, box.h * pageH);
      const dw = box.w < 0.5 ? box.w * 1000 : 1000;
      return Math.max(1, Math.round(dw * sh / sw));
    };

    const slices = [];
    let lastLevel = null;
    for (const question of ordered) {
      for (const key of Object.keys(SOURCE)) delete SOURCE[key];
      Object.assign(SOURCE, question.source);
      const part = api.shortSlices([question]);
      assert.ok(part.length, question.id);
      assert.equal(part.some((slice) => slice.kind === 'header' || slice.kind === 'footer'), false, question.id);
      if (question.source.level !== lastLevel) {
        slices.push({
          page: part[0].page,
          pdfId: question.source.pdfId,
          box: { x: 0, y: 0, w: 1, h: 0.02 },
          gap: 8,
          block: part[0].block,
          kind: 'level',
          label: api.levelPrintName(question.source.level, question.source.levelLabel),
        });
        lastLevel = question.source.level;
      }
      slices.push(...part);
    }
    assert.deepEqual(
      slices.filter((slice) => slice.kind === 'level').map((slice) => slice.label),
      ['רמה א׳', 'רמה ב׳', 'מצוינות'],
    );

    const cId = SHEET_IDS.c;
    const block = (q) => slices.filter((slice) => slice.block === `${cId}:q${q}`);
    const house = sheets.c.questions.find((question) => question.id === '8ד');
    const houseRows = block(8).filter((slice) => slice.kind === 'row');
    assert.equal(houseRows.length, 1);
    const houseBox = houseRows[0].box;
    assert.ok(houseBox.y <= house.figure.y0 + 0.004, String(houseBox.y));
    assert.ok(houseBox.y + houseBox.h >= house.figure.y1 - 0.01, String(houseBox.y + houseBox.h));
    assert.ok(houseBox.mask && houseBox.mask.x >= 0.4, JSON.stringify(houseBox.mask));

    const q3 = block(3);
    assert.equal(q3.filter((slice) => slice.kind === 'stem').length, 1);
    assert.equal(q3.filter((slice) => slice.kind === 'row').length, 1);
    const stem = q3.find((slice) => slice.kind === 'stem').box;
    const row3 = q3.find((slice) => slice.kind === 'row').box;
    const partA = sheets.c.questions.find((question) => question.id === '3א');
    assert.ok(stem.y + stem.h <= 0.82, String(stem.y + stem.h));
    assert.ok(row3.y > partA.row.y + 0.02, String(row3.y));
    assert.equal(slices.some((slice) => slice.kind === 'row' && slice.block === `${cId}:q3` && Math.abs(slice.box.y - partA.row.y) < 0.01), false);

    const q6 = block(6).find((slice) => slice.kind === 'row');
    assert.ok(q6.box.y <= 0.4818, String(q6.box.y));
    assert.ok(q6.box.y + q6.box.h >= 0.4955, String(q6.box.y + q6.box.h));

    const q19 = block(19).find((slice) => slice.kind === 'row');
    const partD = sheets.c.questions.find((question) => question.id === '19ד');
    const partA19 = sheets.c.questions.find((question) => question.id === '19א');
    assert.equal(block(19).filter((slice) => slice.kind === 'stem').length, 0);
    assert.ok(q19.box.y <= 0.385, '19 number ' + q19.box.y);
    assert.ok(q19.box.y + q19.box.h >= partA19.figure.y1 - 0.004, '19 drawing ' + (q19.box.y + q19.box.h));
    assert.ok(q19.box.y + q19.box.h >= partD.row.y + partD.row.h - 0.004);
    const masksAt = (box: { y: number; h: number; mask?: { x: number; y: number; w: number; h: number }; masks?: { x: number; y: number; w: number; h: number }[] }, y: number, x: number) => {
      const list = box.masks && box.masks.length ? box.masks : (box.mask ? [box.mask] : []);
      return list.some((mask) => {
        const top = box.y + mask.y * box.h;
        const bot = top + mask.h * box.h;
        return y >= top - 0.003 && y <= bot + 0.003 && x >= mask.x - 0.01 && x <= mask.x + mask.w + 0.01;
      });
    };
    assert.equal(masksAt(q19.box, 0.39, 0.8), false);
    assert.ok(masksAt(q19.box, partA19.row.y + 0.008, 0.8), JSON.stringify(q19.box.masks || q19.box.mask));

    for (const slice of slices) {
      if (slice.kind === 'level') continue;
      assert.ok(slice.box.y >= 0.02, JSON.stringify(slice.box));
      assert.ok(slice.box.y + slice.box.h <= 0.941, JSON.stringify(slice.box));
    }

    const exerciseMeasured = slices.map((slice) => ({
      slice,
      dh: slice.kind === 'level' ? 36 : dhOf(slice.box),
    }));
    const exercisePages = api.packShort(exerciseMeasured);
    assert.ok(exercisePages.length >= 2, String(exercisePages.length));

    const pageOf = (questionNumber) => exercisePages.findIndex((items) => items.some((item) => item.slice.block === `${cId}:q${questionNumber}`));
    const housePage = pageOf(8);
    assert.ok(housePage >= 0);
    assert.equal(exercisePages[housePage].filter((item) => item.slice.block === `${cId}:q${8}`).length, block(8).length);
    assert.equal(pageOf(3), exercisePages.findIndex((items) => items.some((item) => item.slice.block === `${cId}:q3` && item.slice.kind === 'stem')));

    for (let index = 0; index < exercisePages.length - 1; index += 1) {
      const items = exercisePages[index];
      const chrome = index === 0 ? api.SHEET_BASAD_H + api.SHEET_TITLE_H : api.SHEET_BASAD_H;
      const fill = (chrome + api.contentHeight(items)) / api.SHEET_PAGE_H;
      const next = exercisePages[index + 1];
      const nextId = next[0].slice.block;
      const nextBlock = [];
      for (const item of next) {
        if (item.slice.block !== nextId) break;
        nextBlock.push(item);
      }
      const limit = api.sheetContentLimit(index, true);
      const wouldFit = api.contentHeight(items.concat(nextBlock)) <= limit;
      assert.equal(wouldFit, false, `page ${index + 1} left room for the next exercise`);
      assert.equal(fill < 0.4 && wouldFit, false, `page ${index + 1} is ${fill.toFixed(2)} full`);
    }

    const answerSlices = [];
    for (const level of ['a', 'b', 'c']) {
      const specs = ordered.filter((question) => question.source.level === level).map((question) => ({ q: question.q, part: question.part || '' }));
      const wanted = [...new Set(specs.map((spec) => spec.q))];
      const crops = api.answerCropsFromLines(measuredLines.lines[SHEET_IDS[level]], specs);
      const numbers = crops.map((crop) => crop.q);
      assert.ok(numbers.includes(19), level + ' ' + numbers.join(','));
      assert.equal(new Set(numbers).size, numbers.length, level + ' duplicate ' + numbers.join(','));
      assert.equal(numbers.includes(9), false, level);
      assert.equal(numbers.includes(11), false, level);
      for (const crop of crops) {
        assert.ok(wanted.includes(crop.q));
        assert.ok(crop.box.y >= 0.04, JSON.stringify(crop.box));
        assert.ok(crop.box.y + crop.box.h <= 0.941, JSON.stringify(crop.box));
      }
      const head = measuredLines.lines[SHEET_IDS[level]].find((line) => {
        const text = String(line.text).replace(/\s/g, '');
        return text.startsWith('תשובות') && text.length < 24;
      });
      if (head) {
        answerSlices.push({
          page: head.page,
          pdfId: SHEET_IDS[level],
          box: { x: 0, y: 0, w: 1, h: 0.02 },
          gap: 8,
          block: 'answers-head:' + SHEET_IDS[level],
          kind: 'level',
          label: api.levelPrintName(level, sheets[level].levelLabel),
        });
        const headBox = api.answerHeadingBox(head);
        assert.ok(headBox.x <= 0.78 && headBox.x + headBox.w >= 0.93, JSON.stringify(headBox));
        answerSlices.push({
          page: head.page,
          pdfId: SHEET_IDS[level],
          box: headBox,
          gap: 6,
          block: 'answers-head:' + SHEET_IDS[level],
          kind: 'answer',
          probe: level === 'c' ? 'answers-head' : undefined,
        });
      }
      crops.forEach((crop) => {
        answerSlices.push({
          page: crop.page,
          pdfId: SHEET_IDS[level],
          box: crop.box,
          pieces: crop.pieces,
          gap: 6,
          block: 'answer:' + SHEET_IDS[level] + ':' + crop.q,
          kind: 'answer',
          probe: level === 'c' && crop.q === 19 ? 'answer-19' : undefined,
        });
      });
    }
    const answer19 = answerSlices.find((slice) => slice.probe === 'answer-19');
    assert.ok(answer19);
    assert.ok(answer19.box.y > 0.61 && answer19.box.y < 0.62, String(answer19.box.y));

    const answerMeasured = answerSlices.map((slice) => ({ slice, dh: dhOf(slice.box) }));
    const answerPages = api.packShort(answerMeasured, { answers: true });
    assert.ok(answerPages.length >= 1);

    const tag = (items) => items.map((item) => ({
      kind: item.slice.kind,
      pdfId: item.slice.pdfId,
      page: item.slice.page,
      box: item.slice.box,
      gap: item.slice.gap,
      dh: item.dh,
      label: item.slice.label,
      pieces: item.slice.pieces,
      probe: item.slice.block === `${cId}:q8` && item.slice.kind === 'row' ? '8d'
        : item.slice.block === `${cId}:q3` && item.slice.kind === 'stem' ? '3b-stem'
        : item.slice.block === `${cId}:q3` && item.slice.kind === 'row' ? '3b'
        : item.slice.block === `${cId}:q6` && item.slice.kind === 'row' ? '6d'
        : item.slice.block === `${cId}:q19` && item.slice.kind === 'row' ? '19d'
        : item.slice.probe,
    }));

    const scratch = '/tmp/teacher-print-render';
    mkdirSync(scratch, { recursive: true });
    const rendered = runPack({
      title: api.worksheetTitle(ordered),
      pdfs,
      exercisePages: exercisePages.map(tag),
      answerPages: answerPages.map(tag),
      outPdf: `${scratch}/worksheet.pdf`,
      outDir: scratch,
      sourceProbes: [
        { id: '6d-pad', pdfId: cId, page: q6.page, y0: q6.box.y, y1: 0.4816, x0: 0.4, x1: 0.98 },
        { id: '6d-ink', pdfId: cId, page: q6.page, y0: 0.4818, y1: 0.4955, x0: 0.4, x1: 0.98 },
        { id: '19d-number', pdfId: cId, page: q19.page, y0: q19.box.y, y1: Math.min(q19.box.y + 0.02, 0.405), x0: 0.86, x1: 0.96 },
        { id: '19d-draw', pdfId: cId, page: q19.page, y0: partA19.figure.y0 + 0.02, y1: partA19.figure.y0 + 0.08, x0: partA19.figure.x0 + 0.02, x1: partA19.figure.x1 - 0.02 },
        { id: 'answer-gap', pdfId: cId, page: answer19.page, y0: answer19.box.y, y1: Math.min(answer19.box.y + 0.003, 0.6175), x0: 0.03, x1: 0.97 },
        { id: 'answer-body', pdfId: cId, page: answer19.page, y0: 0.619, y1: 0.632, x0: 0.03, x1: 0.97 },
      ],
    });

    const sourceDark = Object.fromEntries(rendered.sourceProbes.map((item) => [item.id, item.dark]));
    assert.equal(sourceDark['6d-pad'], 0, JSON.stringify(sourceDark));
    assert.ok(sourceDark['6d-ink'] > 20, JSON.stringify(sourceDark));
    assert.ok(sourceDark['19d-number'] > 10, JSON.stringify(sourceDark));
    assert.ok(sourceDark['19d-draw'] > 20, JSON.stringify(sourceDark));
    assert.equal(sourceDark['answer-gap'], 0, JSON.stringify(sourceDark));
    assert.ok(sourceDark['answer-body'] > 20, JSON.stringify(sourceDark));
    assert.ok(rendered.pages.length >= exercisePages.length + 1);
    for (const painted of rendered.pages) {
      assert.ok(painted.basadDark > 0, JSON.stringify(painted));
    }
    const crops = rendered.pages.flatMap((painted) => painted.cropDark || []);
    for (const id of ['8d', '3b-stem', '3b', '6d', '19d', 'answer-19']) {
      const crop = crops.find((item) => item.id === id);
      assert.ok(crop, id);
      assert.ok(existsSync(crop.png), crop.png);
      assert.ok(crop.bodyDark > 20, id + ' ' + JSON.stringify(crop));
    }
    const six = crops.find((item) => item.id === '6d');
    const answer = crops.find((item) => item.id === 'answer-19');
    assert.equal(six.topDark, 0, JSON.stringify(six));
    assert.equal(answer.topDark, 0, JSON.stringify(answer));
    mkdirSync(ARTIFACTS, { recursive: true });
    const copied = spawnSync('bash', ['-c', `cp -f ${scratch}/* ${ARTIFACTS}/`], { encoding: 'utf8' });
    assert.equal(copied.status, 0, copied.stderr);
    assert.ok(existsSync(`${ARTIFACTS}/worksheet.pdf`));
  });

  it('keeps the result preview full width and the phone choice above the intro', () => {
    assert.match(pageHtml, /\.wizard-result\{grid-column:1 \/ -1;margin-top:16px;min-width:0;padding:22px 24px\}/);
    assert.match(pageHtml, /#wizard-preview\{max-width:820px;margin-inline:auto\}/);
    assert.match(pageHtml, /scroll-margin-top:96px/);
    assert.match(pageHtml, /@media\(min-width:900px\)\{\s*\.wizard-bar,\.wizard-result\{scroll-margin-top:110px\}/);
    assert.match(pageHtml, /@media\(max-width:767\.98px\)\{[\s\S]*?\.workspace\{order:2\}[\s\S]*?\.intro\{order:3\}/);
    assert.match(printer, /step === 'result' \? \$\('wizard-result'\) : \$\('wizard-bar'\)/);
    assert.match(printer, /scrollIntoView\(\{ block: 'start'/);
  });

  it('keeps MuPDF warnings off the JSON stdout', (t) => {
    const probe = spawnSync('python3', ['-c', 'import pymupdf'], { encoding: 'utf8' });
    if (probe.status !== 0) {
      t.skip('pymupdf is not installed');
      return;
    }
    const script = fileURLToPath(new URL('../scripts/render-teacher-pack.py', import.meta.url));
    const result = spawnSync('python3', [script], {
      input: JSON.stringify({ cmd: 'warn-probe' }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ok: true });
    assert.match(result.stderr, /MuPDF warning: probe/);
    assert.equal(result.stdout.includes('MuPDF'), false);
  });

  it('lines pdf.js text up with PyMuPDF and ignores body numbers on the answer page', () => {
    const api = layoutApi({});
    const pageH = 841.89;
    const pageW = 595.28;
    const oneBaseline = (1 - 0.1206) * pageH;
    const one = api.textItemBox({
      str: '1.',
      height: 10.4,
      width: 12,
      transform: [10.4, 0, 0, 10.4, pageW * 0.91, oneBaseline],
    }, pageW, pageH);
    assert.ok(Math.abs(one.y - 0.1110) < 0.0015, String(one.y));
    assert.ok(Math.abs(one.y2 - 0.1206) < 0.0001, String(one.y2));

    const headFont = 15;
    const headBaseline = (1 - 0.0472) * pageH - headFont;
    const head = api.textItemBox({
      str: 'תשובות סופיות',
      height: headFont,
      width: pageW * (0.9333 - 0.7798),
      transform: [headFont, 0, 0, headFont, pageW * 0.7798, headBaseline],
    }, pageW, pageH);
    assert.ok(Math.abs(head.y - 0.0511) < 0.0015, String(head.y));
    const headBox = api.answerHeadingBox({ ...head, page: 6 });
    assert.ok(headBox.x <= 0.78 && headBox.x + headBox.w >= 0.93, JSON.stringify(headBox));

    const lines = [
      { page: 6, y: 0.0511, y2: 0.069, x: 0.780, x2: 0.933, text: 'תשובות סופיות' },
      { page: 6, y: 0.1110, y2: 0.122, x: 0.919, x2: 0.945, text: '1.' },
      { page: 6, y: 0.2040, y2: 0.216, x: 0.919, x2: 0.945, text: '5.' },
      { page: 6, y: 0.2060, y2: 0.214, x: 0.860, x2: 0.880, text: '5.' },
      { page: 6, y: 0.2273, y2: 0.239, x: 0.919, x2: 0.945, text: '6.' },
      { page: 6, y: 0.2300, y2: 0.238, x: 0.40, x2: 0.43, text: '6' },
      { page: 6, y: 0.3203, y2: 0.332, x: 0.910, x2: 0.945, text: '10.' },
      { page: 6, y: 0.3600, y2: 0.372, x: 0.30, x2: 0.34, text: '5' },
      { page: 6, y: 0.4000, y2: 0.412, x: 0.35, x2: 0.39, text: '6' },
      { page: 6, y: 0.4400, y2: 0.452, x: 0.38, x2: 0.42, text: '10' },
      { page: 6, y: 0.5000, y2: 0.512, x: 0.40, x2: 0.44, text: '6.' },
      { page: 6, y: 0.5600, y2: 0.572, x: 0.910, x2: 0.945, text: '11.' },
      { page: 6, y: 0.9470, y2: 0.958, x: 0.40, x2: 0.43, text: '6' },
      { page: 6, y: 0.9470, y2: 0.958, x: 0.44, x2: 0.47, text: '6' },
      { page: 6, y: 0.9492, y2: 0.960, x: 0.42, x2: 0.55, text: 'עמוד 6 מתוך 6' },
    ];
    const crops = api.answerCropsFromLines(lines, [5, 6, 10]);
    const numbers = crops.map((crop) => crop.q);
    assert.deepEqual(numbers, [5, 6, 10]);
    for (const crop of crops) {
      assert.ok(crop.box.y <= 0.9, JSON.stringify(crop));
      assert.ok(crop.box.y + crop.box.h <= 0.93, JSON.stringify(crop));
      assert.ok(crop.box.x <= 0.05 && crop.box.x + crop.box.w >= 0.95, JSON.stringify(crop.box));
    }
    const ten = crops.find((crop) => crop.q === 10);
    assert.ok(ten.box.y < 0.33, String(ten.box.y));
    assert.ok(ten.box.y + ten.box.h > 0.55, 'long answer cut at ' + (ten.box.y + ten.box.h));
    assert.equal(crops.some((crop) => crop.q === 1), false);

    const parenLines = [
      { page: 4, y: 0.065, y2: 0.080, x: 0.794, x2: 0.912, text: 'תשובות סופיות' },
      { page: 4, y: 0.128, y2: 0.138, x: 0.907, x2: 0.929, text: '(1)' },
      { page: 4, y: 0.128, y2: 0.138, x: 0.865, x2: 0.881, text: 'א.' },
      { page: 4, y: 0.128, y2: 0.138, x: 0.854, x2: 0.862, text: '6' },
      { page: 4, y: 0.128, y2: 0.138, x: 0.822, x2: 0.835, text: 'ב.' },
      { page: 4, y: 0.128, y2: 0.138, x: 0.810, x2: 0.818, text: '5' },
      { page: 4, y: 0.152, y2: 0.162, x: 0.907, x2: 0.929, text: '(2)' },
    ];
    const parenCrops = api.answerCropsFromLines(parenLines, [{ q: 1, part: 'א' }]);
    assert.equal(parenCrops.length, 1);
    assert.equal(parenCrops[0].q, 1);
    assert.equal(parenCrops[0].pieces.length, 2);
  });

  it('keeps a stacked fraction answer line whole, on one row, between its neighbours', () => {
    const api = layoutApi({});
    const H = 1000;
    // A rendered answer page: dark rectangles [y0, y1, x0, x1], painted by hand.
    const page = (...blocks: [number, number, number, number][]) => {
      const pixels = new Uint8ClampedArray(1000 * H * 4).fill(255);
      blocks.forEach(([y0, y1, x0, x1]) => {
        for (let r = Math.floor(y0 * H); r < Math.ceil(y1 * H); r += 1) {
          for (let c = Math.floor(x0 * 1000); c < Math.ceil(x1 * 1000); c += 1) pixels.set([0, 0, 0, 255], (r * 1000 + c) * 4);
        }
      });
      return api.pageInkFromPixels(pixels, 1000, H);
    };
    const item = (y: number, y2: number, x: number, x2: number, text: string) => ({ page: 8, y, y2, x, x2, text });
    const head = item(0.0511, 0.069, 0.780, 0.933, 'תשובות סופיות');
    const lines = [
      head,
      item(0.2980, 0.3100, 0.907, 0.929, '(18)'),
      item(0.2980, 0.3100, 0.865, 0.881, 'א.'),
      item(0.2980, 0.3100, 0.840, 0.856, '36'),
      item(0.3400, 0.3500, 0.907, 0.929, '(19)'),
      item(0.3400, 0.3500, 0.865, 0.881, 'א.'),
      item(0.3300, 0.3370, 0.840, 0.848, '1'),
      item(0.3500, 0.3570, 0.832, 0.856, '100'),
      item(0.3400, 0.3500, 0.820, 0.825, '·'),
      item(0.3400, 0.3500, 0.800, 0.815, 'ב.'),
      item(0.3300, 0.3370, 0.775, 0.783, '1'),
      item(0.3500, 0.3570, 0.760, 0.797, '10,000'),
      item(0.3800, 0.3900, 0.907, 0.929, '(20)'),
      item(0.3800, 0.3900, 0.865, 0.881, 'א.'),
      item(0.3800, 0.3900, 0.840, 0.856, '50'),
    ];
    // The fraction line's ink reaches above and below the text boxes of (19).
    const blocks: [number, number, number, number][] = [
      [0.05, 0.07, 0.78, 0.93], [0.296, 0.312, 0.84, 0.93], [0.3285, 0.3585, 0.76, 0.93], [0.378, 0.392, 0.84, 0.93],
    ];
    const inside = (box: { y: number; h: number }) => {
      assert.ok(box.y <= 0.3285, 'top cut ' + box.y);
      assert.ok(box.y + box.h >= 0.3585, 'bottom cut ' + (box.y + box.h));
      assert.ok(box.y > 0.312, 'took (18) ' + box.y);
      assert.ok(box.y + box.h < 0.378, 'took (20) ' + (box.y + box.h));
    };
    // A frame down the page, outside the answer text, changes nothing.
    for (const frame of [[], [[0.02, 0.98, 0.03, 0.032], [0.02, 0.98, 0.968, 0.97]]] as [number, number, number, number][][]) {
      const ink = new Map([[8, page(...blocks, ...frame)]]);
      const [parts] = api.answerCropsFromLines(lines, [{ q: 19, part: 'א' }, { q: 19, part: 'ב' }], ink);
      assert.equal(parts.q, 19);
      assert.equal(parts.pieces.length, 3, JSON.stringify(parts.pieces));
      assert.equal(new Set(parts.pieces.map((piece) => piece.box.y)).size, 1, 'fraction split over rows');
      parts.pieces.forEach((piece) => inside(piece.box));
      inside(parts.box);
      const [whole] = api.answerCropsFromLines(lines, [19], ink);
      inside(whole.box);
      const [first] = api.answerCropsFromLines(lines, [18], ink);
      assert.ok(first.box.y <= 0.296 && first.box.y > 0.07, JSON.stringify(first.box));
      assert.ok(first.box.y + first.box.h >= 0.312 && first.box.y + first.box.h < 0.3285, JSON.stringify(first.box));
    }

    // (3) wraps onto a second line. (4) opens with a tall fraction whose
    // numerator comes close to that line. The line stays with (3).
    const wrapped = [
      head,
      item(0.140, 0.150, 0.907, 0.929, '(3)'),
      item(0.140, 0.150, 0.865, 0.881, 'א.'),
      item(0.140, 0.150, 0.840, 0.856, '12'),
      item(0.140, 0.150, 0.820, 0.825, '·'),
      item(0.140, 0.150, 0.800, 0.815, 'ב.'),
      item(0.140, 0.150, 0.780, 0.790, '7'),
      item(0.162, 0.172, 0.865, 0.881, 'ג.'),
      item(0.162, 0.172, 0.820, 0.860, 'נכונה'),
      item(0.162, 0.172, 0.800, 0.805, '·'),
      item(0.162, 0.172, 0.780, 0.795, 'ד.'),
      item(0.162, 0.172, 0.760, 0.775, '30'),
      item(0.192, 0.202, 0.907, 0.929, '(4)'),
      item(0.192, 0.202, 0.865, 0.881, 'א.'),
      item(0.183, 0.190, 0.840, 0.848, '1'),
      item(0.203, 0.210, 0.832, 0.856, '100'),
    ];
    const wrappedInk = new Map([[8, page(
      [0.05, 0.07, 0.78, 0.93], [0.138, 0.152, 0.78, 0.93], [0.160, 0.174, 0.76, 0.88],
      // (4): numerator, fraction bar, denominator, label and number.
      [0.1785, 0.190, 0.840, 0.848], [0.1975, 0.199, 0.830, 0.858], [0.201, 0.2115, 0.832, 0.856],
      [0.192, 0.202, 0.865, 0.881], [0.192, 0.202, 0.907, 0.929],
    )]]);
    const [three] = api.answerCropsFromLines(wrapped, [3], wrappedInk);
    assert.ok(three.box.y <= 0.138 && three.box.y + three.box.h >= 0.174, JSON.stringify(three.box));
    assert.ok(three.box.y + three.box.h <= 0.1785, JSON.stringify(three.box));
    const [threeParts] = api.answerCropsFromLines(wrapped, ['א', 'ב', 'ג', 'ד'].map((part) => ({ q: 3, part })), wrappedInk);
    assert.equal(threeParts.pieces.length, 5, JSON.stringify(threeParts.pieces));
    assert.equal(new Set(threeParts.pieces.map((piece) => piece.box.y)).size, 2);
    const [four] = api.answerCropsFromLines(wrapped, [{ q: 4, part: 'א' }], wrappedInk);
    assert.equal(four.pieces.length, 2, JSON.stringify(four.pieces));
    four.pieces.forEach((piece) => {
      assert.ok(piece.box.y >= 0.174 && piece.box.y <= 0.1785, JSON.stringify(piece.box));
      assert.ok(piece.box.y + piece.box.h >= 0.2115, JSON.stringify(piece.box));
    });

    // Two lines of one answer whose ink touches keep their own part labels.
    const touching = [
      head,
      item(0.240, 0.250, 0.907, 0.929, '(6)'),
      item(0.240, 0.250, 0.865, 0.881, 'א.'),
      item(0.240, 0.250, 0.840, 0.850, '5'),
      item(0.240, 0.250, 0.820, 0.825, '·'),
      item(0.240, 0.250, 0.800, 0.815, 'ב.'),
      item(0.240, 0.250, 0.780, 0.790, '6'),
      item(0.258, 0.268, 0.865, 0.881, 'ג.'),
      item(0.258, 0.268, 0.840, 0.850, '7'),
      item(0.258, 0.268, 0.820, 0.825, '·'),
      item(0.258, 0.268, 0.800, 0.815, 'ד.'),
      item(0.258, 0.268, 0.780, 0.790, '8'),
    ];
    const touchingInk = new Map([[8, page([0.05, 0.07, 0.78, 0.93], [0.236, 0.253, 0.78, 0.93], [0.253, 0.255, 0.85, 0.86], [0.255, 0.272, 0.78, 0.88])]]);
    const [six] = api.answerCropsFromLines(touching, ['א', 'ב', 'ג', 'ד'].map((part) => ({ q: 6, part })), touchingInk);
    assert.equal(six.pieces.length, 5, JSON.stringify(six.pieces));
    const sixRows = [...new Set(six.pieces.map((piece) => piece.box.y))].sort();
    assert.equal(sixRows.length, 2);
    assert.ok(sixRows[0] <= 0.236 && sixRows[1] >= 0.252 && sixRows[1] <= 0.256, sixRows.join(','));

    // A rule under the note stays out of answer (1).
    const ruled = [
      head,
      item(0.075, 0.085, 0.700, 0.930, 'התשובות הסופיות בלבד.'),
      item(0.110, 0.120, 0.907, 0.929, '(1)'),
      item(0.110, 0.120, 0.840, 0.856, '5'),
    ];
    const ruledInk = new Map([[8, page([0.05, 0.07, 0.78, 0.93], [0.074, 0.087, 0.70, 0.93], [0.100, 0.1015, 0.05, 0.95], [0.107, 0.123, 0.84, 0.93])]]);
    const [one] = api.answerCropsFromLines(ruled, [1], ruledInk);
    assert.ok(one.box.y > 0.1015 && one.box.y <= 0.107, JSON.stringify(one.box));
    assert.ok(one.box.y + one.box.h >= 0.123, JSON.stringify(one.box));

    const width = 50;
    const pixels = new Uint8ClampedArray(width * 10 * 4).fill(255);
    const dark = (x: number, y: number, alpha = 255) => {
      const at = (y * width + x) * 4;
      pixels.set([0, 0, 0, alpha], at);
    };
    [10, 11, 12].forEach((x) => dark(x, 2));
    dark(0, 5);
    dark(20, 5, 0);
    pixels.set([255, 242, 204, 255], (7 * width + 30) * 4);
    const counted = api.pageInkFromPixels(pixels, width, 10);
    const perRow = Array.from({ length: 10 }, (_, r) => counted.dark.slice(r * width, (r + 1) * width).reduce((sum, value) => sum + value, 0));
    assert.deepEqual(perRow, [0, 0, 3, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('keeps house answer rows whole: lower baselines, a multiplication dot, a nested numerator, a star', () => {
    const api = layoutApi({});
    const H = 1000;
    const page = (...blocks: [number, number, number, number][]) => {
      const pixels = new Uint8ClampedArray(1000 * H * 4).fill(255);
      blocks.forEach(([y0, y1, x0, x1]) => {
        for (let r = Math.floor(y0 * H); r < Math.ceil(y1 * H); r += 1) {
          for (let c = Math.floor(x0 * 1000); c < Math.ceil(x1 * 1000); c += 1) pixels.set([0, 0, 0, 255], (r * 1000 + c) * 4);
        }
      });
      return api.pageInkFromPixels(pixels, 1000, H);
    };
    const item = (y: number, y2: number, x: number, x2: number, text: string) => ({ page: 8, y, y2, x, x2, text });
    const head = item(0.0511, 0.069, 0.780, 0.933, 'תשובות סופיות');
    const headInk: [number, number, number, number] = [0.05, 0.07, 0.78, 0.93];

    // (2) A dot inside an answer is multiplication, not a part separator.
    const dotted = [
      head,
      item(0.200, 0.210, 0.907, 0.929, '(2)'),
      item(0.200, 0.210, 0.865, 0.881, 'א.'),
      item(0.200, 0.210, 0.800, 0.855, '5 · 10'),
      item(0.198, 0.204, 0.795, 0.800, '6'),
      item(0.200, 0.210, 0.760, 0.775, 'ב.'),
      item(0.200, 0.210, 0.740, 0.750, '7'),
    ];
    const dottedInk = new Map([[8, page(headInk, [0.198, 0.210, 0.740, 0.929])]]);
    for (const ink of [undefined, dottedInk]) {
      const [two] = api.answerCropsFromLines(dotted, [{ q: 2, part: 'א' }, { q: 2, part: 'ב' }], ink);
      assert.equal(two.pieces.length, 3, JSON.stringify(two.pieces));
      assert.ok(two.pieces[1].box.x <= 0.800, JSON.stringify(two.pieces[1].box));
    }

    // (7) Parts of one row are top-aligned: ב holds a fraction and sits on a
    // lower baseline. Its numerator, bar and denominator stay in one row.
    const row = [
      head,
      item(0.300, 0.310, 0.907, 0.929, '(7)'),
      item(0.300, 0.310, 0.865, 0.881, 'א.'),
      item(0.300, 0.310, 0.840, 0.856, '12'),
      item(0.3115, 0.3215, 0.800, 0.815, 'ב.'),
      item(0.300, 0.307, 0.775, 0.783, '1'),
      item(0.316, 0.323, 0.775, 0.783, '4'),
      item(0.360, 0.370, 0.907, 0.929, '(8)'),
      item(0.360, 0.370, 0.865, 0.881, 'א.'),
      item(0.360, 0.370, 0.840, 0.856, '30'),
    ];
    const rowInk = new Map([[8, page(
      headInk, [0.301, 0.310, 0.907, 0.929], [0.301, 0.310, 0.840, 0.881], [0.312, 0.3215, 0.800, 0.815],
      [0.3005, 0.307, 0.775, 0.783], [0.310, 0.3115, 0.770, 0.788], [0.3145, 0.323, 0.775, 0.783],
      [0.361, 0.370, 0.840, 0.929],
    )]]);
    const [seven] = api.answerCropsFromLines(row, [{ q: 7, part: 'א' }, { q: 7, part: 'ב' }], rowInk);
    assert.equal(seven.pieces.length, 3, JSON.stringify(seven.pieces));
    assert.equal(new Set(seven.pieces.map((piece) => piece.box.y)).size, 1, 'row split');
    seven.pieces.forEach((piece) => assert.ok(piece.box.y <= 0.3005 && piece.box.y + piece.box.h >= 0.323, JSON.stringify(piece.box)));
    assert.ok(seven.pieces[2].box.x <= 0.770 && seven.pieces[2].box.x + seven.pieces[2].box.w >= 0.815, JSON.stringify(seven.pieces[2].box));
    assert.ok(seven.pieces[1].box.x > 0.788, 'part ב in part א ' + JSON.stringify(seven.pieces[1].box));

    // (5) A fraction inside a numerator: 1 over 2, all over 3. Its top stays in.
    const nested = [
      head,
      item(0.440, 0.450, 0.907, 0.929, '(4)'),
      item(0.440, 0.450, 0.865, 0.881, 'א.'),
      item(0.440, 0.450, 0.840, 0.856, '9'),
      item(0.500, 0.510, 0.907, 0.929, '(5)'),
      item(0.500, 0.510, 0.865, 0.881, 'א.'),
      item(0.480, 0.487, 0.840, 0.848, '1'),
      item(0.493, 0.500, 0.840, 0.848, '2'),
      item(0.512, 0.519, 0.840, 0.848, '3'),
    ];
    const nestedInk = new Map([[8, page(
      headInk, [0.441, 0.450, 0.840, 0.929],
      [0.4805, 0.487, 0.840, 0.848], [0.4895, 0.4905, 0.838, 0.850], [0.4925, 0.500, 0.840, 0.848],
      [0.5035, 0.505, 0.835, 0.853], [0.5075, 0.519, 0.840, 0.848], [0.501, 0.510, 0.865, 0.881], [0.501, 0.510, 0.907, 0.929],
    )]]);
    const [five] = api.answerCropsFromLines(nested, [5], nestedInk);
    assert.ok(five.box.y <= 0.4805 && five.box.y > 0.450, JSON.stringify(five.box));
    const [four] = api.answerCropsFromLines(nested, [4], nestedInk);
    assert.ok(four.box.y + four.box.h <= 0.4805, JSON.stringify(four.box));

    // (9) A star between the number and the first label stays with the number.
    // (10) sits past 0.9, too low to crop, but (9) still ends where it starts.
    const starred = [
      head,
      item(0.880, 0.890, 0.907, 0.929, '(9)'),
      item(0.881, 0.889, 0.888, 0.900, '★'),
      item(0.880, 0.890, 0.865, 0.881, 'א.'),
      item(0.880, 0.890, 0.845, 0.855, '5'),
      item(0.905, 0.915, 0.907, 0.932, '(10)'),
      item(0.905, 0.915, 0.865, 0.881, 'א.'),
      item(0.905, 0.915, 0.845, 0.855, '7'),
    ];
    const starredInk = new Map([[8, page(headInk, [0.881, 0.890, 0.845, 0.929], [0.906, 0.915, 0.845, 0.932])]]);
    const [nine] = api.answerCropsFromLines(starred, [{ q: 9, part: 'א' }], starredInk);
    assert.equal(nine.pieces.length, 2, JSON.stringify(nine.pieces));
    assert.ok(nine.pieces[0].box.x <= 0.888, JSON.stringify(nine.pieces[0].box));
    nine.pieces.forEach((piece) => assert.ok(piece.box.y + piece.box.h <= 0.905, JSON.stringify(piece.box)));
  });

  it('prints only the picked part, keeps 19 with its drawing, and groups parts of one question', (t) => {
    const probe = spawnSync('python3', ['-c', 'import pymupdf, numpy'], { encoding: 'utf8' });
    if (probe.status !== 0) {
      t.skip('pymupdf is not installed');
      return;
    }
    const sheets = {
      a: loadSheet(SHEET_IDS.a),
      b: loadSheet(SHEET_IDS.b),
      c: loadSheet(SHEET_IDS.c),
    };
    const holder = {};
    const api = layoutApi(holder);
    const masksAt = (box, y, x) => {
      const list = box.masks && box.masks.length ? box.masks : (box.mask ? [box.mask] : []);
      return list.some((mask) => {
        const top = box.y + mask.y * box.h;
        const bot = top + mask.h * box.h;
        return y >= top - 0.003 && y <= bot + 0.003 && x >= mask.x - 0.01 && x <= mask.x + mask.w + 0.01;
      });
    };
    const take = (level, ids) => {
      const sheet = sheets[level];
      Object.keys(holder).forEach((key) => delete holder[key]);
      Object.assign(holder, sheet);
      const byId = Object.fromEntries(sheet.questions.map((question) => [question.id, question]));
      const chosen = ids.map((id) => ({ ...byId[id], source: sheet }));
      const batches = api.batchesOf(chosen);
      const slices = batches.flatMap((batch) => api.shortSlices(batch.questions));
      return { byId, chosen, batches, slices };
    };
    const block = (slices, level, q) => slices.filter((slice) => slice.block === `${SHEET_IDS[level]}:q${q}`);

    for (const level of ['a', 'b', 'c']) {
      const only8 = take(level, ['8ד']);
      const house = block(only8.slices, level, 8);
      const houseRows = house.filter((slice) => slice.kind === 'row');
      const figure = only8.byId['8ד'].figure;
      assert.equal(house.filter((slice) => slice.kind === 'stem').length, 1, level);
      assert.equal(houseRows.length, 1, level);
      const box = houseRows[0].box;
      assert.ok(box.y <= figure.y0 + 0.004, level + ' ' + box.y);
      assert.ok(box.y + box.h >= figure.y1 - 0.004, level + ' end ' + (box.y + box.h));
      assert.ok(box.h > 0.1, level + ' house fragment ' + box.h);
      for (const id of ['8א', '8ב', '8ג']) {
        const row = only8.byId[id].row;
        assert.equal(masksAt(box, row.y + 0.008, 0.8), true, level + ' ' + id);
      }
      assert.equal(masksAt(box, only8.byId['8ד'].row.y + 0.008, 0.8), false, level + ' hid 8ד');
    }

    for (const level of ['a', 'b']) {
      const only10 = take(level, ['10א']);
      const rows = block(only10.slices, level, 10).filter((slice) => slice.kind === 'row');
      const figure = only10.byId['10א'].figure;
      assert.equal(block(only10.slices, level, 10).filter((slice) => slice.kind === 'stem').length, 1, level);
      assert.equal(rows.length, 1, level);
      const box = rows[0].box;
      assert.ok(box.y <= figure.y0 + 0.004, level + ' roof ' + box.y);
      assert.ok(box.y + box.h >= figure.y1 - 0.004, level + ' base ' + (box.y + box.h));
      assert.ok(box.h > only10.byId['10א'].row.h * 3, level + ' ' + box.h);
      assert.equal(masksAt(box, only10.byId['10א'].row.y + 0.008, 0.8), false, level + ' hid 10א');
      assert.equal(masksAt(box, only10.byId['10ב'].row.y + 0.008, 0.8), true, level + ' showed 10ב');
      assert.equal(masksAt(box, only10.byId['10א'].stem.y + 0.008, 0.8), false, level + ' hid the stem');
    }

    for (const level of ['a', 'c']) {
      const only19 = take(level, ['19ד']);
      const q19 = block(only19.slices, level, 19);
      const row = q19.find((slice) => slice.kind === 'row');
      const figure = only19.byId['19א'].figure;
      const stem = only19.byId['19ד'].stem;
      assert.equal(q19.filter((slice) => slice.kind === 'stem').length, 0, level);
      assert.ok(row.box.y <= stem.y + 0.002, level + ' number ' + row.box.y);
      assert.ok(row.box.y + row.box.h >= figure.y1 - 0.004, level + ' drawing ' + (row.box.y + row.box.h));
      assert.equal(masksAt(row.box, stem.y + 0.008, 0.9), false, level + ' covered the number');
      assert.equal(masksAt(row.box, only19.byId['19א'].row.y + 0.008, 0.8), true, level + ' showed 19א');
      assert.equal(masksAt(row.box, only19.byId['19ד'].row.y + 0.006, 0.8), false, level + ' hid 19ד');
    }
    const levelB19 = take('b', ['19ד']);
    const b19 = block(levelB19.slices, 'b', 19);
    const bFigure = levelB19.byId['19א'].figure;
    const bRow = b19.find((slice) => slice.kind === 'row');
    assert.equal(b19.filter((slice) => slice.kind === 'stem').length, 1);
    assert.ok(bRow.box.y <= bFigure.y0 + 0.004, String(bRow.box.y));
    assert.ok(bRow.box.y + bRow.box.h >= bFigure.y1 - 0.004, String(bRow.box.y + bRow.box.h));

    const four = take('a', ['1ד', '1א', '1ג', '1ב']);
    assert.equal(four.batches.length, 1);
    assert.equal(four.batches[0].questions.length, 4);
    const q1 = block(four.slices, 'a', 1);
    assert.equal(q1.filter((slice) => slice.kind === 'stem').length, 1);
    const coversAll = q1.filter((slice) => (
      slice.kind === 'row'
      && slice.box.y <= four.byId['1א'].row.y + 0.01
      && slice.box.y + slice.box.h >= four.byId['1ד'].row.y + 0.01
    ));
    assert.ok(coversAll.length <= 1, 'Q1 repeated ' + coversAll.length);
    for (const id of ['1א', '1ב', '1ג', '1ד']) {
      const row = four.byId[id].row;
      const mid = row.y + Math.min(row.h * 0.5, 0.008);
      assert.ok(q1.some((slice) => slice.kind === 'row' && mid >= slice.box.y - 0.004 && mid <= slice.box.y + slice.box.h + 0.004), id);
    }

    const tenIds = ['1ג', '1א', '1ב', '3ב', '4א', '5א', '7א', '8ד', '10א', '19ד'];
    const ten = take('a', tenIds);
    assert.equal(ten.chosen.length, 10);
    assert.equal(ten.batches.filter((batch) => batch.q === 1).length, 1);
    assert.equal(ten.batches.find((batch) => batch.q === 1).questions.length, 3);
    assert.equal(block(ten.slices, 'a', 1).filter((slice) => slice.kind === 'stem').length, 1);

    const mixedIds = {
      a: ['1א', '1ב', '1ג', '1ד', '3ב', '5א', '8ד', '10א', '15א', '19ד'],
      b: ['3ב', '6ד', '8ד'],
      c: ['6ד', '19ד'],
    };
    const mixed = [];
    for (const level of ['c', 'a', 'b']) {
      mixed.push(...mixedIds[level].map((id) => ({ ...sheets[level].questions.find((question) => question.id === id), source: sheets[level] })));
    }
    assert.equal(mixed.length, 15);
    const mixedBatches = api.batchesOf(mixed);
    const q1Batches = mixedBatches.filter((batch) => batch.q === 1);
    assert.equal(q1Batches.length, 1);
    assert.equal(q1Batches[0].questions.length, 4);
    Object.assign(holder, sheets.a);
    const mixedQ1 = api.shortSlices(q1Batches[0].questions).filter((slice) => slice.kind === 'stem');
    assert.equal(mixedQ1.length, 1);

    const pdfs = {};
    for (const id of Object.values(SHEET_IDS)) pdfs[id] = ensurePdf(id);
    const measuredLines = runPack({ cmd: 'lines', pdfs });
    for (const level of ['a', 'b', 'c']) {
      const lines = measuredLines.lines[SHEET_IDS[level]];
      const head = lines.find((line) => String(line.text).replace(/\s/g, '') === 'תשובותסופיות');
      const headBox = api.answerHeadingBox(head);
      assert.ok(headBox.x <= 0.78 && headBox.x + headBox.w >= 0.93, level + ' ' + JSON.stringify(headBox));
      const long = api.answerCropsFromLines(lines, [13]);
      assert.equal(long.length, 1, level);
      assert.ok(long[0].box.h > 0.018, level + ' long answer ' + long[0].box.h);
      if (level !== 'b') assert.ok(long[0].box.y + long[0].box.h > 0.425, level + ' cut ' + (long[0].box.y + long[0].box.h));
      assert.ok(long[0].box.x <= 0.05 && long[0].box.x + long[0].box.w >= 0.95, JSON.stringify(long[0].box));
      const picked = api.answerCropsFromLines(lines, [3, 6, 8, 19]);
      assert.deepEqual(picked.map((crop) => crop.q), [3, 6, 8, 19]);
      assert.equal(picked.some((crop) => crop.box.y > 0.9), false);
    }

    const pageW = measuredLines.pageSize[0];
    const pageH = measuredLines.pageSize[1];
    const packChosen = (groups) => {
      const slices = [];
      let lastLevel = null;
      const ordered = api.orderPrintQuestions(groups.flatMap((group) => group.ids.map((id) => {
        const sheet = sheets[group.level];
        return { ...sheet.questions.find((question) => question.id === id), source: sheet };
      })));
      for (const batch of api.batchesOf(ordered)) {
        const question = batch.questions[0];
        Object.keys(holder).forEach((key) => delete holder[key]);
        Object.assign(holder, question.source);
        const part = api.shortSlices(batch.questions);
        if (question.source.level !== lastLevel) {
          slices.push({
            page: part[0].page,
            pdfId: question.source.pdfId,
            box: { x: 0, y: 0, w: 1, h: 0.02 },
            gap: 8,
            block: part[0].block,
            kind: 'level',
            label: api.levelPrintName(question.source.level, question.source.levelLabel),
          });
          lastLevel = question.source.level;
        }
        slices.push(...part);
      }
      const dhOf = (box) => {
        const sw = Math.max(1, box.w * pageW);
        const sh = Math.max(1, box.h * pageH);
        const dw = box.w < 0.5 ? box.w * 1000 : 1000;
        return Math.max(1, Math.round(dw * sh / sw));
      };
      const exerciseMeasured = slices.map((slice) => ({
        slice,
        dh: slice.kind === 'level' ? 36 : dhOf(slice.box),
      }));
      return { ordered, pages: api.packShort(exerciseMeasured) };
    };
    const regress = packChosen([
      { level: 'c', ids: ['3ב', '6ד', '8ד', '19ד'] },
      { level: 'a', ids: ['10א', '19ד'] },
      { level: 'b', ids: ['10א', '19ד'] },
    ]);
    const answerSlices = [];
    const answerLevels = [];
    for (const question of regress.ordered) {
      const level = question.source.level;
      if (!answerLevels.includes(level)) answerLevels.push(level);
    }
    assert.deepEqual(answerLevels, ['a', 'b', 'c']);
    for (const level of answerLevels) {
      const specs = regress.ordered.filter((question) => question.source.level === level).map((question) => ({ q: question.q, part: question.part || '' }));
      const wanted = [...new Set(specs.map((spec) => spec.q))];
      const crops = api.answerCropsFromLines(measuredLines.lines[SHEET_IDS[level]], specs);
      assert.equal(crops.some((crop) => crop.q === 1), false, level + ' printed unpicked Q1');
      assert.equal(new Set(crops.map((crop) => crop.q)).size, crops.length, level);
      const head = measuredLines.lines[SHEET_IDS[level]].find((line) => String(line.text).replace(/\s/g, '') === 'תשובותסופיות');
      answerSlices.push({
        page: head.page,
        pdfId: SHEET_IDS[level],
        box: { x: 0, y: 0, w: 1, h: 0.02 },
        gap: 8,
        block: 'answers-head:' + SHEET_IDS[level],
        kind: 'level',
        label: api.levelPrintName(level, sheets[level].levelLabel),
        probe: 'level-' + level,
      });
      answerSlices.push({
        page: head.page,
        pdfId: SHEET_IDS[level],
        box: api.answerHeadingBox(head),
        gap: 6,
        block: 'answers-head:' + SHEET_IDS[level],
        kind: 'answer',
        probe: 'head-' + level,
      });
      crops.forEach((crop) => {
        answerSlices.push({
          page: crop.page,
          pdfId: SHEET_IDS[level],
          box: crop.box,
          pieces: crop.pieces,
          gap: 6,
          block: 'answer:' + SHEET_IDS[level] + ':' + crop.q,
          kind: 'answer',
          probe: 'ans-' + level + '-' + crop.q,
        });
      });
    }
    const tag = (items) => items.map((item) => ({
      kind: item.slice.kind,
      pdfId: item.slice.pdfId,
      page: item.slice.page,
      box: item.slice.box,
      gap: item.slice.gap,
      dh: item.dh,
      label: item.slice.label,
      pieces: item.slice.pieces,
      probe: item.slice.probe || (
        item.slice.kind === 'row' && item.slice.block.endsWith(':q8') ? 'row-8d-' + item.slice.pdfId.slice(0, 4)
          : item.slice.kind === 'row' && item.slice.block.endsWith(':q10') ? 'row-10a-' + item.slice.pdfId.slice(0, 4)
            : item.slice.kind === 'row' && item.slice.block.endsWith(':q19') ? 'row-19d-' + item.slice.pdfId.slice(0, 4)
              : item.slice.kind === 'row' && item.slice.block.endsWith(':q3') ? 'row-3b'
                : item.slice.kind === 'row' && item.slice.block.endsWith(':q6') ? 'row-6d'
                  : undefined
      ),
    }));
    const scratch = '/tmp/teacher-print-regress';
    mkdirSync(scratch, { recursive: true });
    const dhOfAns = (box) => {
      const sw = Math.max(1, box.w * pageW);
      const sh = Math.max(1, box.h * pageH);
      const dw = box.w < 0.5 ? box.w * 1000 : 1000;
      return Math.max(1, Math.round(dw * sh / sw));
    };
    const answerMeasured = answerSlices.map((slice) => ({
      slice,
      dh: slice.kind === 'level' ? 36 : dhOfAns(slice.box),
    }));
    const answerPages = api.packShort(answerMeasured, { answers: true });
    assert.deepEqual(
      answerPages.flat().filter((item) => item.slice.kind === 'level').map((item) => item.slice.label),
      ['רמה א׳', 'רמה ב׳', 'מצוינות'],
    );
    const rendered = runPack({
      title: 'מצולעים',
      pdfs,
      exercisePages: regress.pages.map(tag),
      answerPages: answerPages.map(tag),
      outPdf: `${scratch}/regression.pdf`,
      outDir: scratch,
    });
    for (const painted of rendered.pages) assert.ok(painted.basadDark > 0, JSON.stringify(painted));
    assert.equal(rendered.pages.length, 3, 'regression trailing page');
    assert.equal(rendered.pages.filter((page) => page.kind === 'exercise').length, 2);
    assert.equal(rendered.pages.filter((page) => page.kind === 'answer').length, 1);
    const region = (png, y0, y1, x0, x1) => {
      const result = spawnSync('python3', ['-c', `
import sys, pymupdf, numpy as np
doc = pymupdf.open(sys.argv[1])
page = doc[0]
w, h = page.rect.width, page.rect.height
clip = pymupdf.Rect(float(sys.argv[4]) * w, float(sys.argv[2]) * h, float(sys.argv[5]) * w, float(sys.argv[3]) * h)
pix = page.get_pixmap(clip=clip, alpha=False)
arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
print(int(np.any(arr < 80, axis=2).sum()))
`, png, String(y0), String(y1), String(x0), String(x1)], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return Number(result.stdout.trim());
    };
    const crop = (id) => rendered.pages.flatMap((page) => page.cropDark || []).find((item) => item.id === id);
    const c8 = crop('row-8d-' + SHEET_IDS.c.slice(0, 4));
    const c19 = crop('row-19d-' + SHEET_IDS.c.slice(0, 4));
    const a10 = crop('row-10a-' + SHEET_IDS.a.slice(0, 4));
    const b10 = crop('row-10a-' + SHEET_IDS.b.slice(0, 4));
    assert.ok(c8 && c19 && a10 && b10);
    assert.ok(region(c8.png, 0.02, 0.18, 0.55, 0.98) < 12, '8א text still visible');
    assert.ok(region(c8.png, 0.02, 0.18, 0.05, 0.35) > 20, '8 house roof missing');
    assert.ok(region(c8.png, 0.72, 0.98, 0.05, 0.35) > 20, '8 house base missing');
    assert.ok(region(c19.png, 0.0, 0.12, 0.7, 0.98) > 15, '19 number missing');
    assert.ok(region(c19.png, 0.36, 0.55, 0.55, 0.98) < 12, '19א text still visible');
    assert.ok(region(c19.png, 0.62, 0.88, 0.55, 0.98) > 15, '19ד text missing');
    assert.ok(region(c19.png, 0.2, 0.45, 0.05, 0.4) > 20, '19 drawing missing');
    assert.ok(region(c19.png, 0.75, 0.98, 0.05, 0.4) > 15, '19 drawing cut');
    for (const house of [a10, b10]) {
      assert.ok(region(house.png, 0.15, 0.4, 0.05, 0.32) > 20, house.id + ' roof');
      assert.ok(region(house.png, 0.7, 0.98, 0.05, 0.32) > 15, house.id + ' base');
      assert.ok(region(house.png, 0.35, 0.55, 0.6, 0.98) < 15, house.id + ' next part');
    }
    const headA = crop('head-a');
    assert.ok(region(headA.png, 0.2, 0.85, 0.05, 0.45) > 10, 'heading left clipped');
    assert.ok(region(headA.png, 0.2, 0.85, 0.55, 0.98) > 10, 'heading right clipped');

    const fifteen = packChosen([
      { level: 'a', ids: mixedIds.a },
      { level: 'b', ids: mixedIds.b },
      { level: 'c', ids: mixedIds.c },
    ]);
    const fifteenQ1 = fifteen.pages.flatMap((items, index) => items
      .filter((item) => item.slice.block === `${SHEET_IDS.a}:q1`)
      .map((item) => index));
    assert.equal(new Set(fifteenQ1).size, 1, 'Q1 split across pages');
    assert.equal(fifteen.pages.flat().filter((item) => item.slice.kind === 'stem' && item.slice.block === `${SHEET_IDS.a}:q1`).length, 1);
    const levelATen = packChosen([{ level: 'a', ids: tenIds }]);
    assert.equal(levelATen.pages.flat().filter((item) => item.slice.kind === 'stem' && item.slice.block === `${SHEET_IDS.a}:q1`).length, 1);
    const answerPack = (groups) => {
      const slices = [];
      for (const group of groups) {
        const specs = group.ids.map((id) => {
          const question = sheets[group.level].questions.find((item) => item.id === id);
          return { q: question.q, part: question.part || '' };
        });
        const lines = measuredLines.lines[SHEET_IDS[group.level]];
        const crops = api.answerCropsFromLines(lines, specs);
        const head = lines.find((line) => String(line.text).replace(/\s/g, '') === 'תשובותסופיות');
        slices.push({
          page: head.page, pdfId: SHEET_IDS[group.level], box: { x: 0, y: 0, w: 1, h: 0.02 }, gap: 8, kind: 'level',
          label: api.levelPrintName(group.level, sheets[group.level].levelLabel), block: 'answers-head:' + group.level,
        });
        slices.push({
          page: head.page, pdfId: SHEET_IDS[group.level], box: api.answerHeadingBox(head), gap: 6, kind: 'answer',
          block: 'answers-head:' + group.level,
        });
        crops.forEach((crop) => slices.push({
          page: crop.page, pdfId: SHEET_IDS[group.level], box: crop.box, pieces: crop.pieces, gap: 6, kind: 'answer',
          block: 'answer:' + group.level + ':' + crop.q, probe: 'ans-' + group.level + '-' + crop.q,
        }));
      }
      return api.packShort(slices.map((slice) => ({
        slice,
        dh: slice.kind === 'level' ? 36 : dhOfAns(slice.box),
      })), { answers: true });
    };
    for (const [name, packed, answers] of [
      ['multipart-15', fifteen, answerPack([
        { level: 'a', ids: mixedIds.a },
        { level: 'b', ids: mixedIds.b },
        { level: 'c', ids: mixedIds.c },
      ])],
      ['level-a-10', levelATen, []],
    ]) {
      const dir = `${scratch}/${name}`;
      mkdirSync(dir, { recursive: true });
      const painted = runPack({
        title: 'מצולעים',
        pdfs,
        exercisePages: packed.pages.map(tag),
        answerPages: answers.map(tag),
        outPdf: `${scratch}/${name}.pdf`,
        outDir: dir,
      });
      for (const page of painted.pages) assert.ok(page.basadDark > 0, name);
      assert.equal(painted.pages.length, name === 'level-a-10' ? 2 : 3, name + ' trailing page');
    }
    mkdirSync(ARTIFACTS, { recursive: true });
    const copied = spawnSync('bash', ['-c', `rm -rf ${ARTIFACTS}/regress && mkdir -p ${ARTIFACTS}/regress/multipart-15 ${ARTIFACTS}/regress/level-a-10 && cp -f ${scratch}/*.pdf ${scratch}/*.png ${ARTIFACTS}/regress/ && cp -f ${scratch}/multipart-15/* ${ARTIFACTS}/regress/multipart-15/ && cp -f ${scratch}/level-a-10/* ${ARTIFACTS}/regress/level-a-10/`], { encoding: 'utf8' });
    assert.equal(copied.status, 0, copied.stderr);
  });

  it('hides an unpicked middle part and keeps only the picked answer labels', (t) => {
    const probe = spawnSync('python3', ['-c', 'import pymupdf, numpy'], { encoding: 'utf8' });
    if (probe.status !== 0) {
      t.skip('pymupdf is not installed');
      return;
    }
    const sheets = {
      a: loadSheet(SHEET_IDS.a),
      c: loadSheet(SHEET_IDS.c),
    };
    const holder = {};
    const api = layoutApi(holder);
    const masksAt = (box, y, x) => {
      const list = box.masks && box.masks.length ? box.masks : (box.mask ? [box.mask] : []);
      return list.some((mask) => {
        const top = box.y + mask.y * box.h;
        const bot = top + mask.h * box.h;
        return y >= top - 0.003 && y <= bot + 0.003 && x >= mask.x - 0.01 && x <= mask.x + mask.w + 0.01;
      });
    };
    const take = (level, ids) => {
      const sheet = sheets[level];
      Object.keys(holder).forEach((key) => delete holder[key]);
      Object.assign(holder, sheet);
      const byId = Object.fromEntries(sheet.questions.map((question) => [question.id, question]));
      const chosen = ids.map((id) => ({ ...byId[id], source: sheet }));
      const slices = api.batchesOf(chosen).flatMap((batch) => api.shortSlices(batch.questions));
      return { byId, slices };
    };
    for (const level of ['a', 'c']) {
      const picked = take(level, ['1א', '1ג', '1ד']);
      const rows = picked.slices.filter((slice) => slice.kind === 'row' && slice.block === `${SHEET_IDS[level]}:q1`);
      const box = rows[0].box;
      const bet = picked.byId['1ב'].row;
      assert.equal(picked.slices.filter((slice) => slice.kind === 'stem' && slice.block.endsWith(':q1')).length, 1, level);
      assert.equal(masksAt(box, bet.y + 0.006, 0.8), true, level + ' showed 1ב');
      assert.equal(masksAt(box, bet.y + 0.006, 0.25), false, level + ' covered the drawing');
      assert.equal(masksAt(box, picked.byId['1א'].row.y + 0.02, 0.8), false, level + ' hid 1א');
      assert.equal(masksAt(box, picked.byId['1ג'].row.y + 0.006, 0.8), false, level + ' hid 1ג');
      assert.equal(masksAt(box, picked.byId['1ד'].row.y + 0.006, 0.8), false, level + ' hid 1ד');
    }

    const pdfs = {};
    for (const id of Object.values(SHEET_IDS)) pdfs[id] = ensurePdf(id);
    const measured = runPack({ cmd: 'lines', pdfs });
    const gapsOf = (crop) => {
      const row = (crop.pieces || []).filter((piece) => (piece.dy || 0) < 0.15);
      const ordered = row.slice().sort((a, b) => (b.at + b.box.w) - (a.at + a.box.w));
      const gaps = [];
      for (let index = 0; index < ordered.length - 1; index += 1) {
        gaps.push(ordered[index].at - (ordered[index + 1].at + ordered[index + 1].box.w));
      }
      return gaps;
    };
    const partPiece = (crop) => (crop.pieces || []).filter((piece) => piece.box.x < 0.88);
    const covers = (piece, x) => x >= piece.box.x - 0.002 && x <= piece.box.x + piece.box.w + 0.002;
    const one = (lines, spec) => api.answerCropsFromLines(lines, [spec])[0];
    for (const level of ['a', 'b', 'c']) {
      const lines = measured.lines[SHEET_IDS[level]];
      const whole = api.answerCropsFromLines(lines, [3]);
      assert.equal(whole[0].pieces, undefined, level + ' whole answer was split');
      assert.ok(whole[0].box.w > 0.9, level);
      for (const spec of [
        { q: 3, part: 'ב' },
        { q: 8, part: 'ד' },
        { q: 19, part: 'ד' },
      ]) {
        const crop = one(lines, spec);
        assert.ok(crop.pieces && crop.pieces.length >= 2, level + ' ' + spec.q + spec.part);
        assert.equal(crop.box.masks, undefined);
        for (const gap of gapsOf(crop)) assert.ok(gap > 0.008 && gap < 0.03, level + ' gap ' + gap);
        assert.equal(partPiece(crop).some((piece) => covers(piece, 0.87)), false, level + ' q' + spec.q + ' kept א');
      }
      for (const spec of [
        { q: 1, part: 'א' },
        { q: 3, part: 'א' },
        { q: 15, part: 'א' },
      ]) {
        const crop = one(lines, spec);
        const dots = lines.flatMap((line) => (line.chars || []).filter((glyph) => '·∙•'.includes(glyph.c)).map((glyph) => ({ ...glyph, y: glyph.y == null ? line.y : glyph.y })));
        const hit = partPiece(crop).some((piece) => dots.some((dot) => (
          dot.y >= piece.box.y && dot.y < piece.box.y + piece.box.h - 0.001
          && dot.x >= piece.box.x - 0.001 && dot.x2 <= piece.box.x + piece.box.w + 0.001
        )));
        assert.equal(hit, false, level + ' ' + spec.q + spec.part + ' kept a separator');
        const later = dots.filter((dot) => dot.x < 0.86);
        if (spec.q === 15) {
          assert.equal(partPiece(crop).some((piece) => covers(piece, 0.52)), false, level + ' 15א kept אחוזים');
          assert.ok(later.length, level + ' 15 separators');
        }
        for (const gap of gapsOf(crop)) assert.ok(gap > 0.008 && gap < 0.03, level + ' gap ' + gap);
      }
    }
    const linesA = measured.lines[SHEET_IDS.a];
    const first = api.answerCropsFromLines(linesA, [
      { q: 1, part: 'א' },
      { q: 1, part: 'ג' },
      { q: 1, part: 'ד' },
    ]);
    assert.equal(first.length, 1);
    assert.equal(partPiece(first[0]).some((piece) => covers(piece, 0.75)), false, '1ב still in the crop');
    for (const gap of gapsOf(first[0])) assert.ok(gap > 0.008 && gap < 0.03, 'wide gap ' + gap);
    const dotsOf = (lines) => lines.flatMap((line) => (line.chars || []).filter((glyph) => '·∙•'.includes(glyph.c)).map((glyph) => ({
      ...glyph,
      y: glyph.y == null ? line.y : glyph.y,
    })));
    const overlapsDot = (piece, dot) => (
      dot.y >= piece.box.y && dot.y < piece.box.y + piece.box.h - 0.001
      && dot.x < piece.box.x + piece.box.w && dot.x2 > piece.box.x
    );
    const rowDots = dotsOf(linesA).filter((dot) => overlapsDot({ box: first[0].box }, dot));
    assert.ok(rowDots.some((dot) => dot.x < 0.5), 'question 1 has a separator before ד');
    assert.equal(partPiece(first[0]).some((piece) => rowDots.some((dot) => overlapsDot(piece, dot))), false, 'separator beside a picked part');
    const whole1 = api.answerCropsFromLines(linesA, [1]);
    assert.equal(whole1[0].pieces, undefined, 'a whole question was split');
    assert.ok(rowDots.every((dot) => dot.x >= whole1[0].box.x && dot.x2 <= whole1[0].box.x + whole1[0].box.w), 'a whole question dropped its separators');
    for (const level of ['b', 'c']) {
      const six = one(measured.lines[SHEET_IDS[level]], { q: 6, part: 'ד' });
      assert.ok(six.pieces.length >= 2, level);
      assert.equal(partPiece(six).some((piece) => covers(piece, 0.87)), false, level + ' 6ד kept א');
      for (const gap of gapsOf(six)) assert.ok(gap < 0.03, level + ' 6ד gap ' + gap);
    }

    const pageW = measured.pageSize[0];
    const pageH = measured.pageSize[1];
    const chosen = ['1א', '1ג', '1ד', '3ב', '8ד', '19ד'].map((id) => ({ ...sheets.a.questions.find((question) => question.id === id), source: sheets.a }));
    Object.assign(holder, sheets.a);
    const slices = [];
    api.batchesOf(api.orderPrintQuestions(chosen)).forEach((batch) => {
      slices.push(...api.shortSlices(batch.questions));
    });
    slices.unshift({
      page: slices[0].page,
      pdfId: SHEET_IDS.a,
      box: { x: 0, y: 0, w: 1, h: 0.02 },
      gap: 8,
      block: slices[0].block,
      kind: 'level',
      label: 'רמה א׳',
    });
    const dhOf = (box) => {
      const sw = Math.max(1, box.w * pageW);
      const sh = Math.max(1, box.h * pageH);
      const dw = box.w < 0.5 ? box.w * 1000 : 1000;
      return Math.max(1, Math.round(dw * sh / sw));
    };
    const exerciseMeasured = slices.map((slice) => ({
      slice,
      dh: slice.kind === 'level' ? 36 : dhOf(slice.box),
    }));
    const answerSpecs = chosen.map((question) => ({ q: question.q, part: question.part || '' })).concat([{ q: 15, part: 'א' }]);
    const answerCrops = api.answerCropsFromLines(measured.lines[SHEET_IDS.a], answerSpecs);
    const head = measured.lines[SHEET_IDS.a].find((line) => String(line.text).replace(/\s/g, '') === 'תשובותסופיות');
    const answerSlices = [
      {
        page: head.page,
        pdfId: SHEET_IDS.a,
        box: { x: 0, y: 0, w: 1, h: 0.02 },
        gap: 8,
        kind: 'level',
        label: 'רמה א׳',
        block: 'answers-head',
      },
      {
        page: head.page,
        pdfId: SHEET_IDS.a,
        box: api.answerHeadingBox(head),
        gap: 6,
        kind: 'answer',
        block: 'answers-head',
        probe: 'head',
      },
      ...answerCrops.map((crop) => ({
        page: crop.page,
        pdfId: SHEET_IDS.a,
        box: crop.box,
        pieces: crop.pieces,
        gap: 6,
        kind: 'answer',
        block: 'answer-' + crop.q,
        probe: 'ans-' + crop.q,
      })),
    ];
    const tag = (items) => items.map((item) => ({
      kind: item.slice.kind,
      pdfId: item.slice.pdfId || SHEET_IDS.a,
      page: item.slice.page,
      box: item.slice.box,
      gap: item.slice.gap,
      dh: item.dh,
      label: item.slice.label,
      pieces: item.slice.pieces,
      probe: item.slice.probe || (item.slice.kind === 'row' && item.slice.block.endsWith(':q1') ? 'q1' : undefined),
    }));
    const scratch = join(tmpdir(), 'teacher-print-parts');
    mkdirSync(scratch, { recursive: true });
    const rendered = runPack({
      title: 'מצולעים',
      pdfs,
      exercisePages: api.packShort(exerciseMeasured).map(tag),
      answerPages: api.packShort(answerSlices.map((slice) => ({
        slice,
        dh: slice.kind === 'level' ? 36 : dhOf(slice.box),
      })), { answers: true }).map(tag),
      outPdf: join(scratch, 'parts.pdf'),
      outDir: scratch,
    });
    for (const page of rendered.pages) assert.ok(page.basadDark > 0);
    assert.equal(rendered.pages.length, 2, 'parts trailing page');
    assert.equal(rendered.pages.filter((page) => page.kind === 'answer').length, 1);
    const q1 = rendered.pages.flatMap((page) => page.cropDark || []).find((item) => item.id === 'q1');
    const ans3 = rendered.pages.flatMap((page) => page.cropDark || []).find((item) => item.id === 'ans-3');
    assert.ok(q1 && ans3);
    const row = slices.find((slice) => slice.kind === 'row' && slice.block.endsWith(':q1'));
    const bet = sheets.a.questions.find((question) => question.id === '1ב').row;
    const gimel = sheets.a.questions.find((question) => question.id === '1ג').row;
    const rel = (y) => (y - row.box.y) / row.box.h;
    const region = (png, y0, y1, x0, x1) => {
      const result = spawnSync('python3', ['-c', `
import sys, pymupdf, numpy as np
doc = pymupdf.open(sys.argv[1])
page = doc[0]
w, h = page.rect.width, page.rect.height
clip = pymupdf.Rect(float(sys.argv[4]) * w, float(sys.argv[2]) * h, float(sys.argv[5]) * w, float(sys.argv[3]) * h)
pix = page.get_pixmap(clip=clip, alpha=False)
arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
print(int(np.any(arr < 80, axis=2).sum()))
`, png, String(y0), String(y1), String(x0), String(x1)], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return Number(result.stdout.trim());
    };
    const betRel = rel(bet.y + 0.006);
    assert.ok(region(q1.png, betRel - 0.04, betRel + 0.06, 0.62, 0.95) < 12, '1ב text printed');
    assert.ok(region(q1.png, betRel - 0.04, betRel + 0.06, 0.08, 0.36) > 15, 'drawing beside 1ב missing');
    assert.ok(region(q1.png, rel(gimel.y + 0.008), rel(gimel.y + 0.02), 0.55, 0.95) > 15, '1ג text missing');
    const ink = (png) => {
      const result = spawnSync('python3', ['-c', `
import sys, pymupdf, numpy as np
doc = pymupdf.open(sys.argv[1])
page = doc[0]
pix = page.get_pixmap(alpha=False)
arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
dark = np.any(arr < 80, axis=2)
cols = dark.any(axis=0)
idx = np.flatnonzero(cols)
if idx.size == 0:
    print('0 1 0 0')
else:
    span = (idx[-1] - idx[0] + 1) / cols.size
    gaps = np.diff(idx)
    max_gap = ((gaps.max() - 1) / cols.size) if gaps.size else 0
    quiet = int(dark[:, :int(cols.size * 0.62)].sum())
    print(f'{span:.4f} {max_gap:.4f} {int(dark.sum())} {quiet}')
`, png], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const [span, maxGap, dark, quiet] = result.stdout.trim().split(/\s+/).map(Number);
      return { span, maxGap, dark, quiet };
    };
    for (const id of ['ans-1', 'ans-3', 'ans-8', 'ans-15', 'ans-19']) {
      const row = ink(rendered.pages.flatMap((page) => page.cropDark || []).find((item) => item.id === id).png);
      assert.ok(row.dark > 20, id + ' empty');
      assert.ok(row.maxGap < 0.04, id + ' wide gap ' + row.maxGap);
      assert.ok(row.span < 0.55, id + ' still the full line ' + row.span);
      if (id !== 'ans-1') assert.equal(row.quiet, 0, id + ' leftover ink ' + row.quiet);
    }
    mkdirSync(ARTIFACTS, { recursive: true });
    const copied = spawnSync('bash', ['-c', `mkdir -p ${ARTIFACTS}/parts && cp -f ${scratch}/* ${ARTIFACTS}/parts/`], { encoding: 'utf8' });
    assert.equal(copied.status, 0, copied.stderr);
  });
});
