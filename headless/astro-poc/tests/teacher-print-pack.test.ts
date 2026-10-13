import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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
const ARTIFACTS = '/opt/cursor/artifacts/teacher-print';

function layoutApi(source) {
  const start = printer.indexOf('function boxEnd');
  const end = printer.indexOf('async function measureSlices');
  return new Function('SOURCE', `${printer.slice(start, end)}
    return { shortSlices, packShort, orderPrintQuestions, levelPrintName, answerCropsFromLines, contentHeight, sheetContentLimit, worksheetTitle, SHEET_PAGE_H, SHEET_BASAD_H, SHEET_TITLE_H };
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
      return Math.max(1, Math.round(1000 * sh / sw));
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
    assert.ok(q19.box.y > partA19.row.y + 0.1, String(q19.box.y));
    assert.ok(q19.box.y <= 0.5438, String(q19.box.y));
    assert.ok(q19.box.y + q19.box.h >= 0.5775, String(q19.box.y + q19.box.h));
    assert.ok(q19.box.y > 0.53, String(q19.box.y));

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
      const wanted = [...new Set(ordered.filter((question) => question.source.level === level).map((question) => question.q))];
      const crops = api.answerCropsFromLines(measuredLines.lines[SHEET_IDS[level]], wanted);
      const numbers = crops.map((crop) => crop.q);
      assert.ok(numbers.includes(19), level + ' ' + numbers.join(','));
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
          box: { x: 0.18, y: Math.max(0.04, head.y - 0.008), w: 0.64, h: 0.028 },
          gap: 8,
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
        { id: '19d-gutter', pdfId: cId, page: q19.page, y0: q19.box.y, y1: partD.row.y + partD.row.h, x0: 0.45, x1: 0.55 },
        { id: 'answer-gap', pdfId: cId, page: answer19.page, y0: answer19.box.y, y1: Math.min(answer19.box.y + 0.003, 0.6175), x0: 0.03, x1: 0.97 },
        { id: 'answer-body', pdfId: cId, page: answer19.page, y0: 0.619, y1: 0.632, x0: 0.03, x1: 0.97 },
      ],
    });

    const sourceDark = Object.fromEntries(rendered.sourceProbes.map((item) => [item.id, item.dark]));
    assert.equal(sourceDark['6d-pad'], 0, JSON.stringify(sourceDark));
    assert.ok(sourceDark['6d-ink'] > 20, JSON.stringify(sourceDark));
    assert.equal(sourceDark['19d-gutter'], 0, JSON.stringify(sourceDark));
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
});
