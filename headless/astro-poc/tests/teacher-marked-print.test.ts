import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { labelAscent, labelLineBox, labelLineHeight, sheetFromManifest } from '../scripts/build-teacher-catalog.mjs';

function servedGaps(questions: { id: string; inkTop: number | null; inkBottom?: number }[]) {
  return Object.fromEntries(questions.map((question) => (
    question.inkBottom == null
      ? [question.id, question.inkTop]
      : [question.id, { y: question.inkTop, bottom: question.inkBottom }]
  )));
}

const source = JSON.parse(readFileSync(new URL('../../../demos/factoring-grade-9-a-source.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/6a37fe7160324a17ad107b3dbe43c1db.json', import.meta.url), 'utf8'));
const page = readFileSync(new URL('../../../demos/teacher-practice-picker-site-style.html', import.meta.url), 'utf8');
const printer = readFileSync(new URL('../../../demos/teacher-factoring-print.js', import.meta.url), 'utf8');

describe('grade 9 factoring marked source', () => {
  it('lists only exercises that already exist on the level A worksheet', () => {
    const ids = manifest.exercises.map((exercise: { q: number; part: string }) => String(exercise.q) + (exercise.part || ''));
    assert.equal(source.pdfId, '6a37fe7160324a17ad107b3dbe43c1db');
    assert.equal(source.questions.length, ids.length);
    assert.deepEqual(source.questions.map((question: { id: string }) => question.id), ids);
    for (const question of source.questions) {
      assert.ok(question.page >= 1 && question.page <= manifest.pageCount);
      assert.ok(question.box.w > 0 && question.box.h > 0);
      assert.ok(question.box.x >= 0 && question.box.y >= 0);
      assert.ok(question.box.x + question.box.w <= 1.001);
      assert.ok(question.box.y + question.box.h <= 1.001);
    }
  });

  it('prints marks on the original page and does not offer a link plan as the print', () => {
    assert.match(page, /6a37fe7160324a17ad107b3dbe43c1db\.pdf/);
    assert.match(page, /הצגת הדף המסומן/);
    assert.match(page, /הדפסת הדף המסומן/);
    assert.equal(page.includes('תוכנית בחירה'), false);
    assert.equal(page.includes('mishbetzet'), false);
    assert.match(printer, /source-mark/);
    assert.match(printer, /SOURCE\.pdfUrl/);
    assert.match(printer, /isEvalSupported:\s*false/);
    assert.match(printer, /bakeMarks/);
    assert.equal(printer.includes('plan-list'), false);
    assert.match(page, /print-color-adjust:\s*exact/);
    assert.match(page, /-webkit-print-color-adjust:\s*exact/);
    assert.match(page, /integrity="sha384-/);
    assert.match(page, /\.print-area \.source-mark\{[^}]*background:\s*transparent/);
    assert.match(printer, /globalCompositeOperation = 'multiply'/);
    assert.match(printer, /clearPreparedPrint/);
    assert.match(page, /print-unprepared/);
    assert.match(page, /כדי להדפיס, פותחים קודם את תצוגת ההדפסה/);
    assert.match(page, /הצגת הדף המצומצם/);
    assert.match(printer, /crop-sheet/);
    assert.match(printer, /drawImage/);
    assert.equal(page.includes('עדיין לא ממומש'), false);
    for (const question of source.questions) {
      assert.ok(question.row && question.row.w > 0.5 && question.row.h > 0);
      assert.ok(question.box.y >= question.row.y - 0.02);
      assert.ok(question.box.y + question.box.h <= question.row.y + question.row.h + 0.02);
      if (question.stem) assert.ok(question.stem.y + question.stem.h <= question.row.y + 0.02);
    }
    assert.equal(source.headerCrop.page, 1);
    assert.equal(source.footerCrop.page, 1);
    assert.ok(source.headerCrop.mask && source.headerCrop.mask.h > 0);
    assert.ok(source.footerCrop.mask && source.footerCrop.mask.w > 0);
    assert.match(printer, /printOpener/);
    assert.match(printer, /packShort/);
    assert.match(page, /rel="icon"/);
    assert.match(readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8'), /rel="icon"/);
  });

  it('shows every picked item and does not leave a bare digit after a letter', () => {
    assert.match(printer, /function shownQuestions/);
    const byId = Object.fromEntries(source.questions.map((question: { id: string; text: string }) => [question.id, question.text]));
    assert.equal(byId['2ב'], 'x² + 5x');
    assert.equal(byId['2ג'], '8a³ − 12a²');
    assert.equal(byId['4א'], 'נכון או לא נכון? בדקו בפתיחת סוגריים, ותקנו את השגוי. 6x + 8 = 2(3x + 4)');
    assert.equal(byId['12א'], '37 × 12 + 37 × 8');
    assert.match(printer, /<bdi dir="ltr" class="math">/);
    assert.match(page, /\.q-desc bdi\.math\{white-space:nowrap/);
    const previewJs = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const previewPage = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
    assert.equal(previewJs, printer);
    assert.match(previewPage, /\.q-desc bdi\.math\{white-space:nowrap/);
    const questionTextHTML = new Function(
      `${printer.slice(printer.indexOf('function escapeHTML'), printer.indexOf('function selectionKey'))} return questionTextHTML;`,
    )() as (text: string) => string;
    for (const question of source.questions) {
      assert.equal(/[a-z]\d/.test(question.text), false, question.id + ' ' + question.text);
      const html = questionTextHTML(question.text);
      assert.equal(html.replace(/<[^>]+>/g, ''), question.text, question.id);
      for (const inner of html.matchAll(/<bdi dir="ltr" class="math">([^<]*)<\/bdi>/g)) {
        assert.match(inner[1], /[A-Za-z0-9]/, question.id);
        assert.equal(/^[\s.,?!:;]|[\s.,?!:;]$/.test(inner[1]), false, question.id + ' ' + inner[1]);
      }
    }
    const card4 = questionTextHTML(byId['4א']);
    assert.match(card4, /נכון\? בדקו/);
    assert.match(card4, /סוגריים, ותקנו/);
    assert.match(card4, /השגוי\. <bdi dir="ltr" class="math">6x \+ 8 = 2\(3x \+ 4\)<\/bdi>/);
    assert.equal(card4.includes('<bdi dir="ltr" class="math">?'), false);
    assert.equal(card4.includes('<bdi dir="ltr" class="math">,'), false);
    assert.equal(card4.includes('<bdi dir="ltr" class="math">.'), false);
  });

  it('keeps the original question instruction on the true/false and partial-factor cards', () => {
    const publicSource = JSON.parse(readFileSync(new URL('../public/teachers/factoring-grade-9-a-source.json', import.meta.url), 'utf8'));
    assert.deepEqual(publicSource, source);
    const byId = Object.fromEntries(source.questions.map((question: { id: string; text: string }) => [question.id, question.text]));
    const q4Stem = 'נכון או לא נכון? בדקו בפתיחת סוגריים, ותקנו את השגוי.';
    const q14Stem = 'בכל סעיף הוצאו גורם משותף חלקי בלבד. פרקו מחדש והוציאו את הגורם המשותף הגדול ביותר.';
    const equations: Record<string, string> = {
      '4א': '6x + 8 = 2(3x + 4)',
      '4ב': '5a² − 10a = 5a(a − 10)',
      '4ג': '12y − 18 = 6(2y − 3)',
      '14א': '12x² + 18x = 2(6x² + 9x)',
      '14ב': '20a³ − 30a² = 5(4a³ − 6a²)',
      '14ג': '16m⁴ + 24m² = 4(4m⁴ + 6m²)',
    };
    for (const id of ['4א', '4ב', '4ג']) {
      assert.equal(byId[id].includes('נכון או לא נכון'), true, id);
      assert.equal(byId[id], q4Stem + ' ' + equations[id]);
    }
    for (const id of ['14א', '14ב', '14ג']) {
      assert.equal(byId[id].includes('נכון או לא נכון'), false, id + ' is a partial-factor item, not a true/false item');
      assert.equal(byId[id], q14Stem + ' ' + equations[id]);
    }
  });

  it('serves /teachers and does not keep the temporary demo preview route', () => {
    assert.equal(existsSync(new URL('../src/pages/teachers-demo-preview.ts', import.meta.url)), false);
    assert.equal(existsSync(new URL('../public/teachers-demo-preview/index.html', import.meta.url)), false);
    const route = readFileSync(new URL('../src/pages/teachers.ts', import.meta.url), 'utf8');
    const preview = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
    const sitemap = readFileSync(new URL('../src/pages/sitemap-pages.xml.ts', import.meta.url), 'utf8');
    const sitemapLib = readFileSync(new URL('../src/lib/siteSitemaps.ts', import.meta.url), 'utf8');
    assert.match(route, /x-robots-tag': 'noindex, nofollow'/);
    assert.match(preview, /noindex, nofollow/);
    assert.match(preview, /\/teachers\/teacher-factoring-print\.js/);
    assert.equal(preview.includes('teachers-demo-preview'), false);
    assert.equal(route.includes('teachers-demo-preview'), false);
    assert.equal(sitemap.includes('teachers-demo-preview'), false);
    assert.equal(sitemapLib.includes('teachers-demo-preview'), false);
    assert.match(sitemap, /import\.meta\.glob\('\.\/\*\.astro'\)/);
    assert.equal(route.includes('teachers.astro'), false);
  });

  it('includes the teacher note in print and keeps the short sheet on one A4', () => {
    assert.match(printer, /function attachTeacherNote/);
    assert.match(printer, /class="teacher-print-note" dir="rtl"/);
    assert.equal(printer.split('attachTeacherNote(printArea, note)').length - 1, 1);
    assert.match(printer, /paintAllShort\(printArea, chosen, note\)/);
    const worksheetPaint = printer.slice(printer.indexOf('async function paintWorksheet'), printer.indexOf('async function paintAllShort'));
    assert.equal(worksheetPaint.includes('figcaption'), false);
    assert.match(worksheetPaint, /measureNote\(note\)/);
    assert.match(printer, /הערת המורה/);
    assert.match(page, /\.print-area \.teacher-print-note\{[^}]*direction:rtl[^}]*break-inside:avoid;page-break-inside:avoid/);
    assert.match(page, /ההערה מודפסת על הדף/);
    assert.match(printer, /fonts\.load\('11px Heebo'\)/);
    assert.match(page, /\.plan-notes\{display:none!important\}/);
    assert.match(page, /\.print-area \.crop-sheet\.has-teacher-note\{[^}]*height:281mm[^}]*overflow:hidden/);
    assert.match(page, /\.print-area \.crop-sheet\.has-teacher-note canvas\{width:auto;height:auto;max-width:180mm;max-height:calc\(246mm - var\(--note-h, 0mm\)\)/);
    assert.match(page, /\.print-area \.source-sheet\.has-teacher-note\{[^}]*overflow:visible/);
    assert.match(page, /\.print-area \.source-sheet\{[^}]*height:281mm/);
    const served = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
    assert.match(served, /\.print-area \.teacher-print-note\{[^}]*direction:rtl[^}]*break-inside:avoid;page-break-inside:avoid/);
    assert.match(served, /ההערה מודפסת על הדף/);
    assert.match(served, /\.print-area \.crop-sheet\.has-teacher-note canvas\{width:auto;height:auto;max-width:180mm/);
    assert.match(served, /\.print-area \.crop-sheet\.has-teacher-note\{[^}]*height:281mm[^}]*overflow:hidden/);
  });
});

describe('teacher catalog picker', () => {
  const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
  const index = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
  const page = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
  const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');

  function catalogSheets() {
    const sheets = [];
    for (const grade of catalog.grades) {
      for (const topic of grade.topics) {
        for (const level of topic.levels) {
          sheets.push({ grade: grade.grade, topicId: topic.id, pdfId: level.pdfId, level: level.key });
        }
      }
    }
    return sheets;
  }

  function indexSheets() {
    const sheets = [];
    for (const grade of index.grades) {
      for (const topic of grade.topics) {
        for (const sheet of topic.sheets) {
          sheets.push({ grade: grade.grade, topicId: topic.id, pdfId: sheet.pdfId, level: sheet.level, mode: sheet.mode, band: grade.band });
        }
      }
    }
    return sheets;
  }

  it('reaches every catalog sheet for every grade in the picker', () => {
    const fromCatalog = catalogSheets();
    const fromPicker = indexSheets();
    assert.deepEqual(fromPicker.map((sheet) => [sheet.grade, sheet.topicId, sheet.level, sheet.pdfId]), fromCatalog.map((sheet) => [sheet.grade, sheet.topicId, sheet.level, sheet.pdfId]));
    assert.deepEqual(index.grades.map((grade) => grade.grade), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const grade of [1, 2, 3, 4, 5, 6]) {
      assert.equal(index.grades.find((item) => item.grade === grade).band, 'elementary');
    }
    for (const grade of [7, 8, 9]) {
      assert.equal(index.grades.find((item) => item.grade === grade).band, 'middle');
    }
    for (const sheet of fromPicker) {
      if (sheet.grade <= 6) assert.equal(sheet.mode, 'sheet');
      else assert.equal(sheet.mode, 'exercise');
    }
    assert.match(page, /<option value="1">כיתה א׳<\/option>/);
    assert.match(page, /<option value="2">כיתה ב׳<\/option>/);
    assert.match(page, /<option value="8">כיתה ח׳<\/option>/);
    assert.match(page, /<option value="9" selected>כיתה ט׳<\/option>/);
    assert.match(page, /name="level" value="a"/);
    assert.match(page, /name="level" value="b"/);
    assert.match(page, /name="level" value="c"/);
    assert.match(printer, /teacher-catalog\.json/);
    assert.match(printer, /CATALOG\.grades/);
    assert.match(printer, /data-sheet/);
    assert.match(printer, /data-question/);
    assert.equal(page.includes('teachers-demo-preview'), false);
  });

  it('keeps middle-school exercise files inside the existing manifests', () => {
    const rich = JSON.parse(readFileSync(new URL('../public/teachers/factoring-grade-9-a-source.json', import.meta.url), 'utf8'));
    const copied = JSON.parse(readFileSync(new URL('../public/teachers/sheets/' + rich.pdfId + '.json', import.meta.url), 'utf8'));
    assert.deepEqual(copied, rich);
    for (const sheet of indexSheets()) {
      if (sheet.mode !== 'exercise') {
        assert.equal(existsSync(new URL('../public/teachers/sheets/' + sheet.pdfId + '.json', import.meta.url)), false);
        continue;
      }
      const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + sheet.pdfId + '.json', import.meta.url), 'utf8'));
      const source = JSON.parse(readFileSync(new URL('../public/teachers/sheets/' + sheet.pdfId + '.json', import.meta.url), 'utf8'));
      assert.equal(source.pdfId, sheet.pdfId);
      assert.equal(source.questions.length, manifest.exercises.length);
      const manifestIds = manifest.exercises.map((exercise: { q: number; part: string }) => String(exercise.q) + (exercise.part || ''));
      assert.deepEqual(source.questions.map((question: { id: string }) => question.id), manifestIds);
      for (const question of source.questions) {
        assert.ok(question.box.w > 0 && question.box.h > 0);
        assert.ok(question.row.w > 0 && question.row.h > 0);
      }
    }
  });

  it('crops each middle-school part from its pin to the next pin on the pin page', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/22303ba02b3b46c3ae2529e347cbce2b.json', import.meta.url), 'utf8'));
    const built = sheetFromManifest({
      grade: 7, topicId: 1, level: 'a', levelLabel: 'רמה א׳', pdfId: manifest.pdfHash, pdfUrl: 'https://example.invalid/a.pdf', title: 'מספרים מכוונים', topic: 'מספרים מכוונים',
    }, manifest);
    const byId = Object.fromEntries(built.questions.map((question: { id: string }) => [question.id, question]));
    const partB = byId['3ב'];
    const partA = byId['3א'];
    const partC = byId['3ג'];
    const line = labelLineHeight(manifest.exercises);
    const pinB = manifest.exercises.find((exercise: { q: number; part: string }) => exercise.q === 3 && exercise.part === 'ב').pin;
    const pinC = manifest.exercises.find((exercise: { q: number; part: string }) => exercise.q === 3 && exercise.part === 'ג').pin;
    const lineB = labelLineBox(pinB, line);
    const lineC = labelLineBox(pinC, line);
    assert.equal(partB.page, 2);
    assert.equal(partB.row.page, 2);
    assert.ok(partB.row.y < pinB.y, JSON.stringify({ row: partB.row, pin: pinB, line }));
    assert.ok(Math.abs(partB.row.y - lineB.y) < 0.002, JSON.stringify({ row: partB.row, line: lineB }));
    assert.ok(Math.abs((pinB.y - lineB.y) - labelAscent(line)) < 0.0001);
    assert.ok(labelAscent(line) > 0.008);
    assert.equal(partB.inkTop, null);
    assert.ok(partB.row.y + partB.row.h <= lineC.y + 0.002, JSON.stringify(partB.row));
    assert.equal(partB.rows.some((row: { page: number }) => row.page === 1), false);
    assert.ok(partB.row.y + partB.row.h <= partC.row.y + 0.002);
    assert.equal(partA.rows[0].page, 1);
    if (partA.rows[1]) {
      assert.equal(partA.rows[1].page, 2);
      assert.ok(partA.rows[1].y + partA.rows[1].h <= partB.row.y + 0.002);
    }
    const oneB = byId['1ב'];
    const oneA = byId['1א'];
    const oneC = byId['1ג'];
    assert.equal(oneB.row.page, 1);
    assert.ok(oneB.row.y >= oneA.row.y + oneA.row.h - 0.002);
    assert.ok(oneB.row.y + oneB.row.h <= oneC.row.y + 0.002);
    assert.ok(built.headerCrop.h > 0.2 && built.headerCrop.h < 0.3);
    const served = JSON.parse(readFileSync(new URL('../public/teachers/sheets/22303ba02b3b46c3ae2529e347cbce2b.json', import.meta.url), 'utf8'));
    const gaps = servedGaps(served.questions);
    const measured = sheetFromManifest({
      grade: 7, topicId: 1, level: 'a', levelLabel: 'רמה א׳', pdfId: manifest.pdfHash, pdfUrl: 'https://example.invalid/a.pdf', title: 'מספרים מכוונים', topic: 'מספרים מכוונים',
    }, manifest, gaps);
    const measuredB = measured.questions.find((question: { id: string }) => question.id === '3ב');
    const measuredA = measured.questions.find((question: { id: string }) => question.id === '3א');
    assert.deepEqual(served.questions.find((question: { id: string }) => question.id === '3ב').row, measuredB.row);
    assert.deepEqual(served.questions.find((question: { id: string }) => question.id === '3א').rows, measuredA.rows);
    assert.ok(measuredB.inkTop < pinB.y - 0.0045, JSON.stringify(measuredB));
    assert.ok(measuredB.inkTop > pinB.y - line * 0.65, JSON.stringify(measuredB));
    assert.ok(measuredB.row.y + measuredB.row.h <= measured.questions.find((question: { id: string }) => question.id === '3ג').row.y + 0.0001);
  });

  it('stops a grade-8 last part before the next section header and images only scrambled manifest text', () => {
    const average = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/82a5285c2446440f8ab8ef4aad7b6cd3.json', import.meta.url), 'utf8'));
    const servedAverage = JSON.parse(readFileSync(new URL('../public/teachers/sheets/82a5285c2446440f8ab8ef4aad7b6cd3.json', import.meta.url), 'utf8'));
    const averageGaps = servedGaps(servedAverage.questions);
    const built = sheetFromManifest({
      grade: 8, topicId: 23, level: 'b', levelLabel: 'רמה ב׳', pdfId: average.pdfHash, pdfUrl: 'https://example.invalid/a.pdf', title: 'הממוצע', topic: 'הממוצע',
    }, average, averageGaps);
    const part = built.questions.find((question: { id: string }) => question.id === '4ד');
    const exercise = average.exercises.find((item: { q: number; part: string }) => item.q === 4 && item.part === 'ד');
    const cropBottom = exercise.crop.y + exercise.crop.h;
    assert.ok(part.row.y < exercise.pin.y);
    assert.ok(part.row.y + part.row.h <= cropBottom - 0.05, JSON.stringify({ row: part.row, cropBottom }));
    assert.ok(part.row.y + part.row.h > exercise.pin.y + 0.02);
    assert.equal(part.scrambled, undefined);
    assert.deepEqual(servedAverage.questions.find((question: { id: string }) => question.id === '4ד').row, part.row);
    const diagnosis = JSON.parse(readFileSync(new URL('../public/teachers/sheets/114ce88ff3514961b13a830c90608953.json', import.meta.url), 'utf8'));
    const fraction = diagnosis.questions.find((question: { id: string }) => question.id === '2א');
    assert.equal(fraction.scrambled, true);
    for (const question of source.questions) assert.equal(question.scrambled, undefined);
    const hebrew = source.questions.find((question: { text?: string }) => /[\u0590-\u05FF]/.test(String(question.text || '')));
    assert.ok(hebrew);
  });

  it('prints only the checked part crops and drops hidden selections', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const shortSlices = new Function('SOURCE', `${preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'))} return shortSlices;`)({
      headerCrop: { page: 1, x: 0, y: 0, w: 1, h: 0.2 },
      footerCrop: { page: 2, x: 0, y: 0.96, w: 1, h: 0.03 },
      questions: [],
    });
    const chosen = [
      { id: '3ב', q: 3, page: 2, row: { page: 2, x: 0, y: 0.0662, w: 1, h: 0.0648 }, rows: [{ page: 2, x: 0, y: 0.0662, w: 1, h: 0.0648 }] },
    ];
    const slices = shortSlices(chosen).filter((slice: { kind: string }) => slice.kind === 'row');
    assert.deepEqual(slices.map((slice: { page: number }) => slice.page), [2]);
    assert.equal(slices[0].box.y, 0.0662);
    const keepVisible = new Function(`${preview.slice(preview.indexOf('function keepVisible'), preview.indexOf('function currentExercises'))} return keepVisible;`)() as (selected: string[], visible: string[]) => string[];
    assert.deepEqual(keepVisible(['ex:a:1ב', 'ex:b:3ב', 'sheet:c'], ['ex:b:3ב']), ['ex:b:3ב']);
    const topicHandler = preview.slice(preview.indexOf("$('topic').addEventListener"), preview.indexOf("$('filter-all')"));
    assert.match(topicHandler, /state\.selected = \[\]/);
    assert.match(topicHandler, /applyScenario/);
    const levelHandler = preview.slice(preview.indexOf("document.querySelectorAll('[name=level]')"), preview.indexOf("$('grade').addEventListener"));
    assert.match(levelHandler, /keepVisible\(state\.selected, visibleSelectionKeys\(\)\)/);
    const resolve = preview.slice(preview.indexOf('async function resolveChosen'), preview.indexOf('async function updatePrint'));
    assert.match(resolve, /if \(!allow\.has\(key\)\) continue/);
    assert.match(preview, /box: null/);
    assert.match(preview, /mode === 'short' && band\(\) === 'elementary'/);
    assert.match(preview, /question\.rows && question\.rows\.length \? question\.rows : \[question\.row\]/);
    const html = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
    assert.match(html, /\.skip\{display:none!important\}/);
    assert.match(html, /\.q-thumb\{[^}]*max-height:180px/);
    assert.match(html, /unicode-bidi:isolate/);
    assert.match(preview, /function needsThumb/);
    assert.match(preview, /function levelAllows/);
    assert.match(preview, /question\.scrambled === true/);
    assert.match(preview, /aria-label="\$\{escapeHTML\(thumbAria\(question\)\)\}"/);
    assert.equal(preview.includes('aria-hidden="true"'), false);
    assert.equal(preview.includes('function readingOrder'), false);
    assert.equal(preview.includes('function paintExtract'), false);
    assert.equal(preview.includes('function hasHebrew'), false);
    assert.match(html, /@media\(min-width:900px\)\{\s*\.topbar\{height:90px/);
    assert.match(html, /@media\(min-width:900px\) and \(max-width:1279px\)/);
    assert.match(html, /@media\(max-width:899\.98px\)/);
    assert.match(preview, /class="q-thumb"/);
    assert.match(preview, /paintSourceLine/);
    assert.match(preview, /IntersectionObserver/);
    assert.match(preview, /dir="rtl"/);
    assert.match(preview, /mapPool/);
    const thumbApi = new Function(`${preview.slice(preview.indexOf('function thumbSlice'), preview.indexOf('async function paintThumb'))} return { thumbSlice, thumbContent };`)() as {
      thumbSlice: (question: { row: { x: number; y: number; w: number; h: number; page?: number }; line?: number; page?: number }, bitmap: { width: number; height: number }) => { srcX: number; srcY: number; srcW: number; srcH: number };
      thumbContent: (bitmap: { width: number; height: number; getContext: (kind: string) => { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } } }, question: { line?: number; source?: { questions: unknown[] } }, row: { x: number; y: number; w: number; h: number }) => { srcX: number; srcY: number; srcW: number; srcH: number };
    };
    const fraction = thumbApi.thumbSlice({ row: { x: 0, y: 0.397, w: 1, h: 0.2128 }, line: 0.0131 }, { width: 1000, height: 1000 });
    assert.equal(fraction.srcX, 0);
    assert.equal(fraction.srcY, 397);
    assert.equal(fraction.srcW, 1000);
    assert.equal(fraction.srcH, 213);
    const tight = thumbApi.thumbSlice({ row: { x: 0, y: 0.5, w: 1, h: 0.02 }, line: 0.025 }, { width: 1000, height: 1000 });
    assert.equal(tight.srcY, 500);
    assert.equal(tight.srcH, 20);
    const width = 200;
    const height = 80;
    const data = new Uint8ClampedArray(width * height * 4);
    data.fill(255);
    const dot = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
      data[i + 3] = 255;
    };
    for (let y = 10; y < 28; y++) for (let x = 140; x < 175; x++) dot(x, y);
    for (let x = 10; x < 190; x++) dot(x, 36);
    for (let x = 120; x < 190; x++) dot(x, 60);
    dot(4, 20);
    const bitmap = { width, height, getContext: () => ({ getImageData: () => ({ data }) }) };
    const cropped = thumbApi.thumbContent(bitmap, { line: 0.2, source: { questions: [] } }, { x: 0, y: 0, w: 1, h: 1 });
    assert.ok(cropped.srcX > 100);
    assert.ok(cropped.srcX < 145);
    assert.ok(cropped.srcY < 10);
    assert.ok(cropped.srcY + cropped.srcH < 50);
    assert.equal(preview.includes('Math.min(0.45'), false);
    const css = readFileSync(new URL('../src/styles/exact-site.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(min-width: 900px\) \{\s*\.exact-header \{height:90px/);
    assert.match(css, /\.exact-header nav\[data-nav-panel\] \{flex-wrap:nowrap!important/);
    assert.match(css, /@media \(min-width: 900px\) and \(max-width: 1279px\)/);
    assert.match(css, /@media \(max-width: 899\.98px\)/);
    assert.match(css, /@media \(min-width: 900px\) and \(max-width: 1023\.98px\)[\s\S]*?font-size:12px!important/);
    assert.match(html, /@media\(min-width:900px\) and \(max-width:1023\.98px\)\{[\s\S]*?font-size:12px/);
  });

  it('orders a mixed short sheet by level and reads the answer line', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const worksheetOrder = new Function(`${preview.slice(preview.indexOf('function worksheetOrder'), preview.indexOf('function answerBox'))} return worksheetOrder;`)() as (chosen: { id: string; q: number; part: string; source: { level: string } }[]) => { id: string; source: { level: string } }[];
    const ordered = worksheetOrder([
      { id: '20ב', q: 20, part: 'ב', source: { level: 'a' } },
      { id: '1א', q: 1, part: 'א', source: { level: 'b' } },
      { id: '18א', q: 18, part: 'א', source: { level: 'a' } },
      { id: '19ב', q: 19, part: 'ב', source: { level: 'a' } },
    ]);
    assert.deepEqual(ordered.map((question) => question.source.level + question.id), ['a18א', 'a19ב', 'a20ב', 'b1א']);
    const answerBox = new Function(`${preview.slice(preview.indexOf('function answerBox'), preview.indexOf('function exerciseSlices'))} return answerBox;`)() as (items: { str: string; x: number; y: number; w: number }[], questionNumber: number, part: string) => { x: number; w: number } | null;
    const box = answerBox([
      { str: '(1)', x: 540, y: 727, w: 16 },
      { str: 'א.', x: 515, y: 727, w: 12 },
      { str: '6', x: 508, y: 727, w: 8 },
      { str: 'ב.', x: 489, y: 727, w: 12 },
      { str: '5', x: 482, y: 727, w: 8 },
      { str: '(2)', x: 540, y: 706, w: 16 },
    ], 1, 'א');
    assert.ok(box);
    assert.ok(box.x < 510 && box.x + box.w > 508);
    assert.ok(box.x > 489);
    const wrapped = answerBox([
      { str: '(19)', x: 535, y: 357, w: 18 },
      { str: 'א.', x: 515, y: 358, w: 12 },
      { str: '5(2n + 3)', x: 430, y: 358, w: 70 },
      { str: 'ג.', x: 500, y: 340, w: 12 },
      { str: 'מכפלה', x: 430, y: 340, w: 40 },
      { str: '(20)', x: 535, y: 319, w: 18 },
    ], 19, 'ג');
    assert.ok(wrapped);
    assert.ok(wrapped.x < 440 && wrapped.x + wrapped.w > 430);
    assert.ok(wrapped.y < 342 && wrapped.y + wrapped.h > 340);
    assert.equal(answerBox([{ str: '(3)', x: 100, y: 40, w: 12 }], 9, 'א'), null);
    const split = answerBox([
      { str: '(5)', x: 720, y: 261.4, w: 16 },
      { str: 'א', x: 680, y: 261.4, w: 8 },
      { str: '.', x: 680, y: 261.4, w: 4 },
      { str: '3', x: 640, y: 261.4, w: 8 },
      { str: 'ו', x: 235.4, y: 261.4, w: 8 },
      { str: '.', x: 235.4, y: 261.4, w: 4 },
      { str: '−7 = −7.0', x: 177.3, y: 261.4, w: 50 },
      { str: 'ב', x: 500, y: 263.1, w: 8 },
      { str: '.', x: 500, y: 263.1, w: 4 },
      { str: '4', x: 470, y: 261.4, w: 8 },
    ], 5, 'ו');
    assert.ok(split);
    assert.ok(split.x < 180 && split.x + split.w > 177);
    assert.ok(split.x + split.w < 235);
    const combined = answerBox([
      { str: '(5)', x: 720, y: 261.4, w: 16 },
      { str: 'ו. −7 = −7.0', x: 177.3, y: 261.4, w: 70 },
    ], 5, 'ו');
    assert.ok(combined);
    assert.ok(combined.x < 180 && combined.x + combined.w > 240);
    const dotted = answerBox([
      { str: '8.', x: 540, y: 400, w: 16 },
      { str: 'א.', x: 510, y: 400, w: 12 },
      { str: '12', x: 470, y: 400, w: 16 },
      { str: '9.', x: 540, y: 370, w: 16 },
    ], 8, 'א');
    assert.ok(dotted);
    assert.ok(dotted.x <= 482 && dotted.x + dotted.w >= 486);
    assert.ok(dotted.x + dotted.w < 510);
    const symbolOnly = answerBox([
      { str: '(4)', x: 540, y: 500, w: 16 },
      { str: 'ב.', x: 500, y: 500, w: 12 },
      { str: 'א.', x: 200, y: 500, w: 12 },
      { str: '(5)', x: 540, y: 470, w: 16 },
    ], 4, 'ב');
    assert.ok(symbolOnly);
    assert.ok(symbolOnly.x > 200 && symbolOnly.x < 230);
    assert.ok(symbolOnly.x + symbolOnly.w > 490 && symbolOnly.x + symbolOnly.w < 500);
    const glued = 'א. )1( אינה נכונה; )2( אינה נכונה · ב. לדוגמה הפרשים';
    const gluedBet = answerBox([
      { str: '2.', x: 547.7, y: 294, w: 7.9 },
      { str: glued, x: 307.8, y: 294, w: 215.8, dir: 'rtl' },
      { str: '1', x: 300.5, y: 294, w: 5.2 },
      { str: '3.', x: 547.7, y: 244, w: 7.9 },
    ], 2, 'ב');
    assert.ok(gluedBet, 'part ב inside one answer token');
    assert.ok(gluedBet.x < 305, JSON.stringify(gluedBet));
    assert.ok(gluedBet.x + gluedBet.w < 470, JSON.stringify(gluedBet));
    const gluedAlef = answerBox([
      { str: '2.', x: 547.7, y: 294, w: 7.9 },
      { str: glued, x: 307.8, y: 294, w: 215.8, dir: 'rtl' },
      { str: '3.', x: 547.7, y: 244, w: 7.9 },
    ], 2, 'א');
    assert.ok(gluedAlef);
    assert.ok(gluedAlef.x > 370, JSON.stringify(gluedAlef));
    assert.ok(gluedAlef.x + gluedAlef.w > 500 && gluedAlef.x + gluedAlef.w < 548, JSON.stringify(gluedAlef));
    const unlabeled = answerBox([
      { str: '(1)', x: 540, y: 711, w: 16 },
      { str: 'f(x) = (x + 2)(x - 6)', x: 300, y: 710, w: 180 },
      { str: '(2)', x: 540, y: 690, w: 16 },
    ], 1, 'א');
    assert.ok(unlabeled, 'a part letter is optional when the answer line has none');
    assert.ok(unlabeled.x < 320 && unlabeled.x + unlabeled.w > 470);
    const answerRegions = new Function(`${preview.slice(preview.indexOf('function answerBox'), preview.indexOf('function exerciseSlices'))} return answerRegions;`)() as (pages: { page: number; items: { str: string; y: number }[] }[]) => { page: number; items: { str: string }[] }[];
    const regions = answerRegions([
      { page: 3, items: [{ str: '1.', y: 700 }] },
      { page: 7, items: [{ str: '19.', y: 791 }, { str: 'תשובות סופיות', y: 379 }, { str: '1.', y: 327 }] },
      { page: 8, items: [{ str: '8.', y: 790 }] },
    ]);
    assert.deepEqual(regions.map((region) => region.page), [7, 8]);
    assert.equal(regions[0].items.some((item) => item.str === '19.'), false);
    assert.equal(regions[0].items.some((item) => item.str === '1.'), true);
    const reversed = answerBox([
      { str: '13.', x: 528, y: 507, w: 12 },
      { str: 'שטח 36 · ג. 6 אפשרויות · ד— 8 · ב .א', x: 150, y: 507, w: 360, dir: 'ltr' },
      { str: '14.', x: 528, y: 470, w: 12 },
    ], 13, 'א') as { y: number; h: number } | null;
    assert.ok(reversed, 'a mentioned part letter still uses the question band');
    assert.ok(reversed.y > 478, JSON.stringify(reversed));
    const nextRow = answerBox([
      { str: '(4)', x: 540, y: 500, w: 16, h: 12 },
      { str: 'א.', x: 500, y: 500, w: 14, h: 12 },
      { str: '∡PKQ', x: 420, y: 500, w: 60, h: 12 },
      { str: '(5)', x: 540, y: 482, w: 16, h: 12 },
      { str: 'ב.', x: 500, y: 482, w: 14, h: 12 },
      { str: '∡ABC', x: 400, y: 482, w: 70, h: 12 },
    ], 4, 'א') as { x: number; y: number; w: number; h: number } | null;
    assert.ok(nextRow);
    assert.ok(nextRow.y > 494, JSON.stringify(nextRow));
    assert.ok(nextRow.y + nextRow.h > 500, JSON.stringify(nextRow));
    assert.ok(nextRow.x + nextRow.w < 510, JSON.stringify(nextRow));
    const noSuchPart = answerBox([
      { str: '10.', x: 540, y: 720, w: 12 },
      { str: 'א. יתר 40 · ב. כן · ג. 19.2', x: 200, y: 720, w: 300, dir: 'rtl' },
      { str: '11.', x: 540, y: 680, w: 12 },
    ], 10, 'ד');
    assert.equal(noSuchPart, null);
    const wrappedDalet = answerBox([
      { str: '19.', x: 530, y: 400, w: 22, h: 12 },
      { str: '324 + 6400 = 6724', x: 150, y: 360, w: 140, h: 12 },
      { str: '· ד. כל', x: 40, y: 360, w: 70, h: 12 },
      { str: 'צלע מוכפלת ב־k, ולכן גם סכומן — ההיקף — מוכפל ב־k', x: 250, y: 344, w: 280, h: 12 },
      { str: '20.', x: 530, y: 300, w: 22, h: 12 },
    ], 19, 'ד') as { x: number; y: number; w: number; h: number } | null;
    assert.ok(wrappedDalet, 'part ד keeps the rest of a wrapped answer');
    assert.ok(wrappedDalet.x < 80, JSON.stringify(wrappedDalet));
    assert.ok(wrappedDalet.x + wrappedDalet.w > 500, JSON.stringify(wrappedDalet));
    assert.ok(wrappedDalet.y < 346 && wrappedDalet.y + wrappedDalet.h > 360, JSON.stringify(wrappedDalet));
    const answerSliceFor = new Function(`${preview.slice(preview.indexOf('function answerBox'), preview.indexOf('function groupsOf'))} return answerSliceFor;`)() as (pages: { page: number; width: number; height: number; items: { str: string; x: number; y: number; w: number; h: number; page: number }[] }[], question: { q: number; part: string }) => { box: { x: number; y: number; w: number; h: number; wrap?: boolean; masks?: { x: number; y: number; w: number; h: number; role?: string }[] } } | null;
    const wrappedSlice = answerSliceFor([{
      page: 8,
      width: 595,
      height: 842,
      items: [
        { str: '19.', x: 530, y: 400, w: 22, h: 12, page: 8 },
        { str: '324 + 6400 = 6724', x: 150, y: 360, w: 140, h: 12, page: 8 },
        { str: '· ד. כל', x: 40, y: 360, w: 70, h: 12, page: 8 },
        { str: 'צלע מוכפלת ב־k, ולכן גם סכומן — ההיקף — מוכפל ב־k', x: 250, y: 344, w: 280, h: 12, page: 8 },
        { str: '20.', x: 530, y: 300, w: 22, h: 12, page: 8 },
      ],
    }], { q: 19, part: 'ד' });
    assert.ok(wrappedSlice && wrappedSlice.box.wrap, 'a wrapped answer keeps the following line');
    assert.ok(wrappedSlice.box.h > 0.02, JSON.stringify(wrappedSlice.box));
    const contY = (842 - (344 + 6)) / 842;
    const contIn = wrappedSlice.box.y < contY && contY < wrappedSlice.box.y + wrappedSlice.box.h;
    assert.ok(contIn, JSON.stringify(wrappedSlice.box));
    const maskedCont = (wrappedSlice.box.masks || []).some((mask) => {
      const top = wrappedSlice.box.y + mask.y * wrappedSlice.box.h;
      const bot = top + mask.h * wrappedSlice.box.h;
      return contY >= top && contY <= bot;
    });
    assert.equal(maskedCont, false);
    const kolY = (842 - (360 + 6)) / 842;
    const kolX = (40 + 20) / 595;
    const kolMasked = (wrappedSlice.box.masks || []).some((mask) => {
      const top = wrappedSlice.box.y + mask.y * wrappedSlice.box.h;
      const bot = top + mask.h * wrappedSlice.box.h;
      const left = wrappedSlice.box.x + mask.x * wrappedSlice.box.w;
      const right = left + mask.w * wrappedSlice.box.w;
      return kolY >= top - 0.002 && kolY <= bot + 0.002 && kolX >= left - 0.01 && kolX <= right + 0.01;
    });
    assert.ok(kolMasked, 'the stranded כל on the label line is covered ' + JSON.stringify(wrappedSlice.box));
    const trimApi = new Function(`${preview.slice(preview.indexOf('function sliceInkRows'), preview.indexOf('async function measureWorksheet'))} return { trimPieceBox };`)() as {
      trimPieceBox: (slice: { kind: string; page: number; box: { x: number; y: number; w: number; h: number }; source?: { footerCrop?: { page: number; y: number }; headerCrop?: { page: number; y: number; h: number } } }, bitmap: { width: number; height: number; getContext: (kind: string) => { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } } }) => { box: { y: number; h: number } };
    };
    const trimW = 40;
    const trimH = 400;
    const trimData = new Uint8ClampedArray(trimW * trimH * 4);
    trimData.fill(255);
    const ink = (x0: number, x1: number, y0: number, y1: number) => {
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * trimW + x) * 4;
          trimData[i] = trimData[i + 1] = trimData[i + 2] = 0;
          trimData[i + 3] = 255;
        }
      }
    };
    ink(4, 36, 30, 48);
    const trimBitmap = { width: trimW, height: trimH, getContext: () => ({ getImageData: () => ({ data: trimData }) }) };
    const kept = trimApi.trimPieceBox({ kind: 'row', page: 2, box: { x: 0, y: 0, w: 1, h: 0.15 }, source: { footerCrop: { page: 10, y: 0.9667 } } }, trimBitmap);
    assert.ok(kept.box.y < 0.05, String(kept.box.y));
    assert.ok(kept.box.y + kept.box.h > 0.14, String(kept.box.y + kept.box.h));
    const capped = trimApi.trimPieceBox({ kind: 'row', page: 11, box: { x: 0, y: 0, w: 1, h: 1 }, source: { footerCrop: { page: 10, y: 0.9667 } } }, trimBitmap);
    assert.ok(capped.box.y < 0.06, String(capped.box.y));
    const capEnd = capped.box.y + capped.box.h;
    assert.ok(capEnd > 0.4 && capEnd < 0.55, String(capEnd));
    ink(4, 36, 4, 8);
    const answerTrim = trimApi.trimPieceBox({ kind: 'answer', page: 12, box: { x: 0, y: 0, w: 1, h: 0.2 } }, trimBitmap);
    assert.ok(answerTrim.box.y < 0.03, String(answerTrim.box.y));
    const answerEnd = answerTrim.box.y + answerTrim.box.h;
    assert.ok(answerEnd > 0.1 && answerEnd < 0.16, String(answerEnd));
    ink(4, 36, 74, 80);
    const edgeTrim = trimApi.trimPieceBox({ kind: 'answer', page: 12, box: { x: 0, y: 0, w: 1, h: 0.2 } }, trimBitmap);
    const edgeEnd = edgeTrim.box.y + edgeTrim.box.h;
    assert.ok(edgeTrim.box.y < 0.03, String(edgeTrim.box.y));
    assert.ok(edgeEnd < 0.17, String(edgeEnd));
    const headerTrim = trimApi.trimPieceBox({
      kind: 'row',
      page: 1,
      box: { x: 0, y: 0.04, w: 1, h: 0.38 },
      source: { headerCrop: { page: 1, y: 0, h: 0.27 }, footerCrop: { page: 9, y: 0.97 } },
    }, trimBitmap);
    assert.ok(headerTrim.box.y >= 0.26 && headerTrim.box.y < 0.32, String(headerTrim.box.y));
    const edgeData = new Uint8ClampedArray(trimW * trimH * 4);
    edgeData.fill(255);
    const edgeInk = (x0: number, x1: number, y0: number, y1: number) => {
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * trimW + x) * 4;
          edgeData[i] = edgeData[i + 1] = edgeData[i + 2] = 0;
          edgeData[i + 3] = 255;
        }
      }
    };
    edgeInk(0, 5, 30, 46);
    edgeInk(14, 36, 30, 46);
    const edgeBitmap = { width: trimW, height: trimH, getContext: () => ({ getImageData: () => ({ data: edgeData }) }) };
    const noLetter = trimApi.trimPieceBox({ kind: 'answer', page: 12, box: { x: 0, y: 0, w: 1, h: 0.2 } }, edgeBitmap);
    assert.ok(noLetter.box.x > 0.1, String(noLetter.box.x));
    const sheet = preview.slice(preview.indexOf('async function paintAllShort'), preview.indexOf('function markedHTML'));
    assert.equal(sheet.includes('headerCrop'), false);
    assert.match(sheet, /paintWorksheet/);
    assert.match(preview, /בס״ד/);
    assert.match(preview, /תשובות/);
    const sliceApi = new Function(`${preview.slice(preview.indexOf('function answerBox'), preview.indexOf('async function answerSlices'))} return { answerSliceFor };`)() as {
      answerSliceFor: (pages: { page: number; width: number; height: number; items: { str: string; x: number; y: number; w: number; h: number; page: number }[] }[], question: { q: number; part: string }) => { box: { x: number; y: number; w: number; h: number } } | null;
    };
    const answerSheet = {
      page: 8,
      width: 595,
      height: 842,
      items: [
        { str: '(2)', x: 540, y: 720, w: 16, h: 12, page: 8 },
        { str: 'א.', x: 515, y: 706, w: 12, h: 12, page: 8 },
        { str: '3', x: 508, y: 706, w: 5, h: 12, page: 8 },
        { str: 'ב.', x: 489, y: 706, w: 8, h: 12, page: 8 },
        { str: '(3)', x: 540, y: 680, w: 16, h: 12, page: 8 },
      ],
    };
    const aleph = sliceApi.answerSliceFor([answerSheet], { q: 2, part: 'א' });
    assert.ok(aleph);
    const cropLeft = aleph.box.x * answerSheet.width;
    const cropRight = cropLeft + aleph.box.w * answerSheet.width;
    assert.ok(cropLeft > 497, `2א starts ${cropLeft} on top of ב.`);
    assert.ok(cropLeft < 508 && cropRight > 508);
    const clearGreyRules = new Function(`${preview.slice(preview.indexOf('function clearGreyRules'), preview.indexOf('function answerInkCanvas'))} return clearGreyRules;`)() as (ctx: { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray }; putImageData: (image: { data: Uint8ClampedArray }, x: number, y: number) => void }, width: number, height: number) => void;
    const ruleW = 40;
    const ruleH = 10;
    const ruleData = new Uint8ClampedArray(ruleW * ruleH * 4);
    ruleData.fill(255);
    for (let x = 4; x < 24; x += 1) {
      const i = (5 * ruleW + x) * 4;
      ruleData[i] = ruleData[i + 1] = ruleData[i + 2] = 0;
    }
    for (let x = 0; x < ruleW; x += 1) {
      const i = (6 * ruleW + x) * 4;
      ruleData[i] = ruleData[i + 1] = ruleData[i + 2] = 190;
    }
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < ruleW; x += 1) {
        const i = (y * ruleW + x) * 4;
        ruleData[i] = ruleData[i + 1] = ruleData[i + 2] = 180;
      }
    }
    clearGreyRules({ getImageData: () => ({ data: ruleData }), putImageData: () => {} }, ruleW, ruleH);
    assert.equal(ruleData[(5 * ruleW + 8) * 4], 0);
    assert.equal(ruleData[(6 * ruleW + 8) * 4], 255);
    assert.equal(ruleData[(1 * ruleW + 8) * 4], 180);
  });

  it('keeps every picked part\'s ink and packs a lone answer', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const overlapApi = new Function(`${preview.slice(preview.indexOf('function sliceInkRows'), preview.indexOf('async function measureWorksheet'))} return { sealOverlaps };`)() as {
      sealOverlaps: (measured: { slice: { kind: string; page: number; source: { pdfId: string }; box: { x: number; y: number; w: number; h: number; mask?: { x: number; y: number; w: number; h: number } } } }[]) => void;
    };
    const mix = [
      { slice: { kind: 'row', page: 1, source: { pdfId: 'level-a' }, box: { x: 0, y: 0.29, w: 1, h: 0.11 } } },
      { slice: { kind: 'row', page: 1, source: { pdfId: 'level-b' }, box: { x: 0, y: 0.35, w: 1, h: 0.06 } } },
    ];
    overlapApi.sealOverlaps(mix);
    assert.equal(mix[0].slice.box.mask, undefined);
    assert.equal(mix[0].slice.box.y, 0.29);
    assert.equal(mix[0].slice.box.h, 0.11);
    assert.equal(mix[1].slice.box.y, 0.35);
    assert.equal(mix[1].slice.box.h, 0.06);
    const same = [
      { slice: { kind: 'row', page: 1, source: { pdfId: 'one' }, box: { x: 0, y: 0.1, w: 1, h: 0.2 } } },
      { slice: { kind: 'row', page: 1, source: { pdfId: 'one' }, box: { x: 0, y: 0.2, w: 1, h: 0.2 } } },
    ];
    overlapApi.sealOverlaps(same);
    assert.equal(same[0].slice.box.mask, undefined);
    assert.equal(same[0].slice.box.y, 0.1);
    assert.ok(Math.abs(same[1].slice.box.y - 0.3) < 0.001, String(same[1].slice.box.y));
    assert.ok(Math.abs(same[1].slice.box.h - 0.1) < 0.001, String(same[1].slice.box.h));
    const house = [
      { slice: { kind: 'row', page: 3, source: { pdfId: 'house' }, box: { x: 0, y: 0.076, w: 1, h: 0.1957 } } },
      { slice: { kind: 'row', page: 3, source: { pdfId: 'house' }, box: { x: 0, y: 0.2634, w: 1, h: 0.0305 } } },
    ];
    overlapApi.sealOverlaps(house);
    assert.equal(house[1].slice.box.y, 0.2634);
    assert.ok(Math.abs(house[1].slice.box.h - 0.0305) < 0.0001);
    const pack = new Function(`${preview.slice(preview.indexOf('function contentHeight'), preview.indexOf('function scaledGap'))}${preview.slice(preview.indexOf('function scaledGap'), preview.indexOf('function shrinkTo'))}${preview.slice(preview.indexOf('function flowAnswers'), preview.indexOf('function paintWorksheetPage'))} return { packWorksheet, flowAnswers, answerDisplayScale: (typeof answerDisplayScale === 'function' ? answerDisplayScale : null) };`)() as { packWorksheet: (measured: { dh: number; dw?: number; slice: { kind: string; gap: number } }[], noteHeight: number) => { items: { slice: { kind: string }; cells?: unknown[]; dh: number }[] }[]; flowAnswers: (items: { dh: number; dw?: number; slice: { kind: string } }[]) => { slice: { kind: string }; cells?: { dw: number }[]; dh: number }[] };
    const packed = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4 }, dh: 1100 },
      { slice: { kind: 'answer', gap: 8 }, dh: 400 },
    ], 0);
    // A lone answer that would shrink below 0.6 stays on the next page.
    assert.equal(packed.length, 2);
    const readable = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4 }, dh: 1100 },
      { slice: { kind: 'answer', gap: 8 }, dh: 280 },
    ], 0);
    assert.equal(readable.length, 1);
    assert.equal(readable[0].items.filter((item) => item.slice.kind === 'answer').length, 1);
    const scale = new Function(`${preview.slice(preview.indexOf('function answerDisplayScale'), preview.indexOf('function answerCellSize'))} return answerDisplayScale;`)() as (naturalW: number, naturalH: number) => number;
    assert.equal(scale(180, 16), 1);
    assert.ok(scale(2000, 40) < 1, String(scale(2000, 40)));
    assert.ok(scale(40, 12) <= 1.3);
    assert.ok(Math.abs(scale(40, 12) - 72 / 12) > 1);
    const flowed = pack.flowAnswers([
      { slice: { kind: 'answer' }, dh: 28, dw: 220 },
      { slice: { kind: 'answer' }, dh: 30, dw: 240 },
      { slice: { kind: 'answer' }, dh: 26, dw: 200 },
      { slice: { kind: 'answer' }, dh: 40, dw: 800 },
    ]);
    assert.equal(flowed[0].slice.kind, 'answer-row');
    assert.equal(flowed[0].cells && flowed[0].cells.length, 3);
    assert.equal(flowed[0].dh, 30);
    assert.equal(flowed[1].cells && flowed[1].cells.length, 1);
    const natural = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4 }, dh: 1200 },
      { slice: { kind: 'answers-head', gap: 8 }, dh: 34 },
      { slice: { kind: 'answer', gap: 4 }, dh: 28, dw: 220 },
      { slice: { kind: 'answer', gap: 4 }, dh: 30, dw: 240 },
      { slice: { kind: 'answer', gap: 4 }, dh: 26, dw: 200 },
    ], 0);
    assert.equal(natural.length, 1);
    const row = natural[0].items.find((item) => item.slice.kind === 'answer-row');
    assert.ok(row && row.cells && row.cells.length === 3);
    // A short answer key joins the previous page when it still fits at a readable size.
    const pulled = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4 }, dh: 1000 },
      { slice: { kind: 'answers-head', gap: 16 }, dh: 34 },
      { slice: { kind: 'answer', gap: 8 }, dh: 80, dw: 800 },
      { slice: { kind: 'answer', gap: 8 }, dh: 80, dw: 800 },
      { slice: { kind: 'answer', gap: 8 }, dh: 80, dw: 800 },
    ], 0);
    assert.equal(pulled.length, 1);
    // The heading fits, and the answer that is left needs about 0.67. The old 0.72 floor left it behind.
    const pulledAtSix = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4 }, dh: 1100 },
      { slice: { kind: 'answers-head', gap: 16 }, dh: 34 },
      { slice: { kind: 'answer', gap: 8 }, dh: 200, dw: 800 },
    ], 0);
    assert.equal(pulledAtSix.length, 1);
    // A key that would have to shrink below 0.6 stays on its own page.
    const leftBehind = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4 }, dh: 1100 },
      { slice: { kind: 'answers-head', gap: 16 }, dh: 34 },
      { slice: { kind: 'answer', gap: 8 }, dh: 80, dw: 800 },
      { slice: { kind: 'answer', gap: 8 }, dh: 80, dw: 800 },
      { slice: { kind: 'answer', gap: 8 }, dh: 80, dw: 800 },
      { slice: { kind: 'answer', gap: 8 }, dh: 80, dw: 800 },
    ], 0);
    assert.equal(leftBehind.length, 2);
    const moved = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4, block: 'other' }, dh: 1100 },
      { slice: { kind: 'row', gap: 4, block: 'q6', source: { pdfId: 'pythagoras' } }, dh: 160 },
      { slice: { kind: 'row', gap: -2, block: 'q6', source: { pdfId: 'pythagoras' } }, dh: 80 },
    ], 0);
    assert.equal(moved.length, 2);
    assert.equal(moved[0].items.length, 1);
    assert.equal(moved[1].items.length, 2);
    assert.equal(moved[1].items[0].slice.block, 'q6');
    assert.equal(moved[1].items[1].slice.block, 'q6');
    const tall = pack.packWorksheet([
      { slice: { kind: 'stem', gap: 10, block: 'q7', source: { pdfId: 'pythagoras' } }, dh: 2000 },
      { slice: { kind: 'row', gap: 4, block: 'q7', source: { pdfId: 'pythagoras' } }, dh: 800 },
    ], 0);
    assert.equal(tall.length, 1);
    assert.equal(tall[0].items.length, 2);
    assert.ok(tall[0].items[0].dh < 2000);
    assert.ok(tall[0].items[1].dh < 800);
    const together = pack.packWorksheet([
      { slice: { kind: 'row', gap: 4, block: 'q1', source: { pdfId: 'a' } }, dh: 400 },
      { slice: { kind: 'row', gap: 4, block: 'q2', source: { pdfId: 'a' } }, dh: 100 },
      { slice: { kind: 'row', gap: -2, block: 'q2', source: { pdfId: 'a' } }, dh: 40 },
    ], 0);
    assert.equal(together.length, 1);
    for (const file of ['0d548ce76eb74a1ab10385cdaf1f77ca.json', '050b9cc226cd4326931adfb3c0775a05.json']) {
      const sheet = JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${file}`, import.meta.url), 'utf8'));
      const shortSlices = new Function('SOURCE', `${preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'))} return shortSlices;`)(sheet) as (chosen: { id: string }[]) => { kind: string; page: number; box: { y: number; h: number } }[];
      const byId = Object.fromEntries(sheet.questions.map((question: { id: string; box?: { y: number }; row: { page?: number; y: number; h: number } }) => [question.id, question]));
      const rows = shortSlices(['3א', '3ב', '3ג'].map((id) => byId[id])).filter((slice) => slice.kind === 'row');
      const ids = ['3א', '3ב', '3ג'];
      ids.forEach((id, index) => {
        const question = byId[id];
        const pin = question.box ? question.box.y : question.row.y;
        const hit = rows.find((slice) => slice.box.y <= pin + 0.004 && slice.box.y + slice.box.h > pin + 0.008);
        assert.ok(hit, `${file} ${id}`);
        const next = byId[ids[index + 1]];
        if (next) {
          const bound = next.labelLine ? next.labelLine.y : (next.box ? next.box.y : next.row.y);
          assert.ok(hit.box.y + hit.box.h <= bound + 0.004, `${file} ${id} spills ${hit.box.y + hit.box.h} into ${bound}`);
        }
      });
    }
  });

  it('keeps each packed piece on one page across middle-school sheets', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const demo = readFileSync(new URL('../../../demos/teacher-factoring-print.js', import.meta.url), 'utf8');
    assert.equal(demo, preview);
    const body = preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'));
    const pack = new Function(`${preview.slice(preview.indexOf('function contentHeight'), preview.indexOf('function scaledGap'))}${preview.slice(preview.indexOf('function scaledGap'), preview.indexOf('function shrinkTo'))}${preview.slice(preview.indexOf('function flowAnswers'), preview.indexOf('function paintWorksheetPage'))} return packWorksheet;`)() as (measured: { dh: number; slice: { kind: string; gap: number; block?: string; page?: number; source?: { pdfId: string }; box?: { y: number; h: number; w: number } } }[], noteHeight: number) => { top: number; items: { dh: number; slice: { kind: string; gap: number; block?: string; source?: { pdfId: string } } }[] }[];
    const aspect = 842 / 595;
    const dhOf = (box: { h: number; w?: number }) => Math.max(1, Math.round(1000 * (box.h * aspect) / (box.w && box.w > 0 ? box.w : 1)));
    const PAGE_LIMIT = 1440 - 36;
    let packs = 0;
    let seed = 0xC0FFEE;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const dir = new URL('../public/teachers/sheets/', import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
    const sheets = files.map((file) => JSON.parse(readFileSync(new URL(file, dir), 'utf8'))).filter((sheet) => sheet && sheet.grade >= 7 && Array.isArray(sheet.questions) && sheet.questions.length);
    const slicesFor = (sheet: { pdfId: string; questions: { id: string; q: number; rows?: { page?: number }[] }[] }, ids: string[]) => {
      const byId = Object.fromEntries(sheet.questions.map((question: { id: string }) => [question.id, question]));
      const shortSlices = new Function('SOURCE', `${body} return shortSlices;`)(sheet) as (chosen: { id: string }[]) => { kind: string; gap: number; block?: string; page: number; box?: { y: number; h: number; w: number } }[];
      return shortSlices(ids.map((id) => byId[id])).flatMap((slice) => {
        if (slice.kind !== 'stem' && slice.kind !== 'row') return [];
        const box = slice.box;
        if (!box) return [];
        if (box.y < 0.05 && box.y + box.h < 0.075) return [];
        return [{ slice: { ...slice, source: { pdfId: sheet.pdfId } }, dh: dhOf(box) }];
      });
    };
    const assertOnePage = (measured: { dh: number; slice: { kind: string; gap: number; block?: string; source?: { pdfId: string } } }[], label: string) => {
      const pages = pack(measured, 0);
      packs += 1;
      const seen = new Map<string, number>();
      pages.forEach((page, pageIndex) => {
        let y = page.top;
        page.items.forEach((item, index) => {
          if (index) y += item.slice.gap || 0;
          const end = y + item.dh;
          assert.ok(end <= PAGE_LIMIT + 0.01, `${label} page ${pageIndex} ends at ${end}`);
          if ((item.slice.kind === 'stem' || item.slice.kind === 'row') && item.slice.block) {
            const key = (item.slice.source && item.slice.source.pdfId ? item.slice.source.pdfId : '') + ':' + item.slice.block;
            const previous = seen.get(key);
            if (previous == null) seen.set(key, pageIndex);
            else assert.equal(previous, pageIndex, `${label} ${key} crosses pages`);
          }
          y = end;
        });
      });
    };
    sheets.forEach((sheet, sheetIndex) => {
      const ids = sheet.questions.map((question: { id: string }) => question.id);
      const windows = [ids.slice(0, Math.min(6, ids.length))];
      if (ids.length > 6) {
        const start = Math.floor(rnd() * (ids.length - 5));
        windows.push(ids.slice(start, start + 5));
      }
      const crossing = sheet.questions.find((question: { id: string; rows?: { page?: number }[] }) => {
        const pages = new Set((question.rows || []).map((row) => row.page).filter(Boolean));
        return pages.size > 1;
      });
      if (crossing) {
        const at = ids.indexOf(crossing.id);
        windows.push(ids.slice(Math.max(0, at - 1), at + 2));
      }
      windows.forEach((window, windowIndex) => {
        if (!window.length) return;
        assertOnePage(slicesFor(sheet, window), `${sheet.pdfId} ${windowIndex}`);
      });
      const other = sheets[(sheetIndex + 17) % sheets.length];
      if (other && other.pdfId !== sheet.pdfId) {
        const mixed = slicesFor(sheet, ids.slice(0, 3)).concat(slicesFor(other, other.questions.slice(0, 3).map((question: { id: string }) => question.id)));
        assertOnePage(mixed, `${sheet.pdfId}+${other.pdfId}`);
      }
    });
    assert.ok(packs > 400, String(packs));
  });

  it('prints only the picked part label on every middle-school sheet', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const body = preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'));
    const dir = new URL('../public/teachers/sheets/', import.meta.url);
    let parts = 0;
    let pairs = 0;
    const rightMasks = (box: { y: number; h: number; mask?: { x: number; y: number; w: number; h: number }; masks?: { x: number; y: number; w: number; h: number }[] }) => {
      const list = [];
      if (box.mask) list.push(box.mask);
      (box.masks || []).forEach((mask) => list.push(mask));
      return list.filter((mask) => mask.x <= 0.55 && mask.x + mask.w >= 0.85);
    };
    const masked = (box: { y: number; h: number; mask?: { x: number; y: number; w: number; h: number }; masks?: { x: number; y: number; w: number; h: number }[] }, y: number) => (
      rightMasks(box).some((mask) => {
        const top = box.y + mask.y * box.h;
        const bot = top + mask.h * box.h;
        return y >= top - 0.003 && y <= bot + 0.003;
      })
    );
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
      const sheet = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
      if (!sheet || !(sheet.grade >= 7) || !Array.isArray(sheet.questions)) continue;
      const shortSlices = new Function('SOURCE', `${body} return shortSlices;`)(sheet) as (chosen: { id: string }[]) => { kind: string; page: number; box: { y: number; h: number; mask?: { x: number; y: number; w: number; h: number }; masks?: { x: number; y: number; w: number; h: number }[] } }[];
      const byId = Object.fromEntries(sheet.questions.map((question: { id: string }) => [question.id, question]));
      const ids = sheet.questions.filter((question: { row?: unknown }) => question.row).map((question: { id: string }) => question.id);
      const exposed = (crops: { page: number; box: { y: number; h: number; mask?: { x: number; y: number; w: number; h: number }; masks?: { x: number; y: number; w: number; h: number }[] } }[], page: number, y: number) => (
        crops.some((slice) => slice.page === page && slice.box.y + 0.004 < y && y < slice.box.y + slice.box.h - 0.004 && !masked(slice.box, y))
      );
      const assertHidden = (picked: string[], label: string) => {
        const crops = shortSlices(picked.map((id) => byId[id])).filter((slice) => slice.kind === 'row' || slice.kind === 'stem');
        const pickedSet = new Set(picked);
        for (const other of sheet.questions) {
          if (!other.row || pickedSet.has(other.id)) continue;
          const page = other.row.page || other.page;
          const labelY = other.labelLine ? other.labelLine.y : other.row.y;
          const mid = other.row.y + Math.min(other.row.h * 0.5, 0.02);
          assert.ok(!exposed(crops, page, labelY), `${file} ${label} shows ${other.id} label`);
          assert.ok(!exposed(crops, page, mid), `${file} ${label} shows ${other.id} line`);
        }
      };
      for (const question of sheet.questions) {
        if (!question.row) continue;
        parts += 1;
        const rows = shortSlices([byId[question.id]]).filter((slice) => slice.kind === 'row');
        const labelY = question.labelLine ? question.labelLine.y : question.row.y;
        const owns = rows.some((slice) => slice.page === (question.row.page || question.page) && slice.box.y <= labelY + 0.008 && slice.box.y + slice.box.h > labelY + 0.004);
        assert.ok(owns, `${file} ${question.id} misses its own label`);
        assertHidden([question.id], question.id);
      }
      for (let index = 0; index < ids.length - 2; index += 1) {
        pairs += 1;
        assertHidden([ids[index], ids[index + 2]], `${ids[index]}+${ids[index + 2]}`);
      }
    }
    assert.ok(parts > 20000, String(parts));
    assert.ok(pairs > 20000, String(pairs));
  });

  it('prints one crop when consecutive parts share a drawing', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const sheet = JSON.parse(readFileSync(new URL('../public/teachers/sheets/0d548ce76eb74a1ab10385cdaf1f77ca.json', import.meta.url), 'utf8'));
    const shortSlices = new Function('SOURCE', `${preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'))} return shortSlices;`)(sheet) as (chosen: { id: string }[]) => { kind: string; page: number; box: { y: number; h: number } }[];
    const byId = Object.fromEntries(sheet.questions.map((question: { id: string; row: { y: number; h: number } }) => [question.id, question]));
    const rowsOf = (ids: string[]) => shortSlices(ids.map((id) => byId[id])).filter((slice) => slice.kind === 'row' && slice.page === 4);
    const covered = (rows: { box: { y: number; h: number } }[], y: number) => rows.filter((slice) => slice.box.y <= y && slice.box.y + slice.box.h > y).length;
    const disjoint = (rows: { box: { y: number; h: number } }[]) => {
      const ordered = rows.slice().sort((a, b) => a.box.y - b.box.y);
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1].box;
        assert.ok(previous.y + previous.h <= ordered[index].box.y + 0.004, JSON.stringify(ordered.map((slice) => slice.box)));
      }
    };
    const aleph = byId['9א'];
    const bet = byId['9ב'];
    const gimel = byId['9ג'];
    const labelOf = (question: { labelLine?: { y: number }; row: { y: number } }) => question.labelLine ? question.labelLine.y : question.row.y;
    const pair = rowsOf(['9א', '9ב']);
    disjoint(pair);
    assert.equal(covered(pair, labelOf(aleph) + 0.004), 1);
    assert.equal(covered(pair, labelOf(bet) + 0.004), 1);
    assert.equal(pair.length, 2);
    const triple = rowsOf(['9א', '9ב', '9ג']);
    disjoint(triple);
    assert.equal(covered(triple, labelOf(bet) + 0.004), 1);
    assert.equal(covered(triple, labelOf(gimel) + 0.004), 1);
    assert.ok(triple.some((slice) => slice.box.y + slice.box.h >= gimel.row.y + gimel.row.h - 0.004));
    const onlyBet = rowsOf(['9ב']);
    assert.equal(onlyBet.length, 1);
    assert.ok(onlyBet[0].box.y <= labelOf(bet) + 0.002, JSON.stringify(onlyBet[0].box));
    assert.ok(onlyBet[0].box.y > labelOf(aleph) + 0.02, JSON.stringify(onlyBet[0].box));
    assert.ok(onlyBet[0].box.y + onlyBet[0].box.h <= labelOf(gimel) + 0.004, JSON.stringify(onlyBet[0].box));
    const onlyAleph = rowsOf(['9א']);
    assert.equal(onlyAleph.length, 1);
    assert.ok(Math.abs(onlyAleph[0].box.y - aleph.row.y) < 0.0001);
    assert.ok(onlyAleph[0].box.y + onlyAleph[0].box.h <= labelOf(bet) + 0.004, JSON.stringify(onlyAleph[0].box));
    assert.ok(onlyAleph[0].box.y + onlyAleph[0].box.h > labelOf(aleph) + 0.02);
  });

  it('assigns the grade-9 house drawing to question 8', () => {
    const sheet = JSON.parse(readFileSync(new URL('../public/teachers/sheets/871fe90d52a04673a7d30fc039e4bf2e.json', import.meta.url), 'utf8'));
    const last = sheet.questions.find((question: { id: string }) => question.id === '8ד');
    const next = sheet.questions.find((question: { id: string }) => question.id === '9א');
    const end = last.row.y + last.row.h;
    assert.ok(last.row.y < 0.2, JSON.stringify(last.row));
    assert.ok(end >= 0.268 && end <= 0.28, JSON.stringify(last.row));
    assert.ok(last.row.mask && last.row.mask.x >= 0.35 && last.row.mask.y > 0.3 && last.row.mask.w > 0.4);
    assert.ok(next.stem && next.stem.mask && next.stem.mask.x === 0 && next.stem.mask.w > 0.3 && next.stem.mask.w < 0.55);
    assert.ok(next.row.mask && next.row.mask.x === 0 && next.row.mask.h < 0.5 && next.row.mask.w < 0.55);
    assert.ok(next.row.y < 0.27, JSON.stringify(next.row));
  });

  it('prints a lone house part from the top of the whole drawing', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const files = [
      '871fe90d52a04673a7d30fc039e4bf2e.json',
      '4aba762b64b54af098827d1f386bcf68.json',
      '9c95b48e57124721b4c2b56d79cf72ba.json',
    ];
    for (const file of files) {
      const sheet = JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${file}`, import.meta.url), 'utf8'));
      const shortSlices = new Function('SOURCE', `${preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'))} return shortSlices;`)(sheet) as (chosen: { id: string }[]) => { kind: string; gap: number; box: { y: number; h: number; mask?: { x: number; y: number; h: number } } }[];
      const byId = Object.fromEntries(sheet.questions.map((question: { id: string }) => [question.id, question]));
      const rowsOf = (ids: string[]) => shortSlices(ids.map((id) => byId[id])).filter((slice) => slice.kind === 'row');
      const figure = byId['8ד'].figure;
      const storedMask = byId['8ד'].row.mask;
      assert.ok(figure && figure.y0 < 0.09 && figure.y1 > 0.2, file);
      for (const id of ['8ד', '8ג']) {
        const rows = rowsOf([id]);
        assert.equal(rows.length, 1, `${file} ${id}`);
        const box = rows[0].box;
        const end = box.y + box.h;
        assert.ok(box.y <= figure.y0 + 0.004, `${file} ${id} top ${JSON.stringify(box)}`);
        assert.ok(end >= figure.y1 - 0.01, `${file} ${id} end ${JSON.stringify(box)}`);
        assert.ok(box.y <= byId['8א'].row.y + 0.0001, `${file} ${id} half line ${JSON.stringify(box)}`);
        assert.ok(box.mask && box.mask.x >= storedMask.x + 0.004 && box.mask.x <= storedMask.x + 0.012, `${file} ${id} mask ${JSON.stringify(box.mask)}`);
        const maskBottom = box.y + (box.mask.y + box.mask.h) * box.h;
        assert.ok(maskBottom >= end - 0.004, `${file} ${id} mask bottom ${maskBottom}`);
      }
      const all = rowsOf(['8א', '8ב', '8ג', '8ד']);
      assert.equal(all.length, 4, file);
      const ordered = all.slice().sort((a, b) => a.box.y - b.box.y);
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1].box;
        assert.ok(previous.y + previous.h <= ordered[index].box.y + 0.004, file);
        assert.equal(ordered[index].gap, -2, file);
      }
      const roof = figure.y0 + 0.005;
      assert.equal(all.filter((slice) => slice.box.y <= roof && slice.box.y + slice.box.h > roof).length, 1, file);
    }
  });

  it('keeps the grade-9 9ג sketch and hides the next line when printed alone', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const sheet = JSON.parse(readFileSync(new URL('../public/teachers/sheets/2056de6d71e14c98aa5efe856d2e1bcf.json', import.meta.url), 'utf8'));
    const shortSlices = new Function('SOURCE', `${preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'))} return shortSlices;`)(sheet) as (chosen: { id: string }[]) => { kind: string; page: number; box: { y: number; h: number; mask?: { x: number; y: number; h: number } } }[];
    const byId = Object.fromEntries(sheet.questions.map((question: { id: string }) => [question.id, question]));
    const rows = shortSlices([byId['9ג']]).filter((slice) => slice.kind === 'row' && slice.page === 4);
    assert.equal(rows.length, 1);
    const box = rows[0].box;
    const end = box.y + box.h;
    // The rectangle sketch fills 9ג and stops before 9ד. The next pin sits inside the last line of the sketch.
    assert.ok(end >= 0.30, String(end));
    assert.ok(end > byId['9ג'].row.y + 0.03, String(end));
    assert.ok(box.y <= byId['9ג'].row.y);
    const dalet = byId['9ד'].labelLine ? byId['9ד'].labelLine.y : byId['9ד'].row.y;
    assert.ok(end <= dalet + 0.004, `${end} includes ${dalet}`);
  });

  it('extends a crop through a drawing that starts inside it', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const api = new Function(`${preview.slice(preview.indexOf('function sliceInkRows'), preview.indexOf('async function measureWorksheet'))} return { extendDrawingBox, claimDrawingTails, sealOverlaps };`)() as {
      extendDrawingBox: (bitmap: { width: number; height: number; getContext: () => { getImageData: () => { data: Uint8ClampedArray } } }, box: { x: number; y: number; w: number; h: number }, limitY: number) => number | null;
      claimDrawingTails: (measured: { bitmap?: { width: number; height: number; getContext: () => { getImageData: () => { data: Uint8ClampedArray } } }; slice: { kind: string; block?: string; page: number; source: { pdfId: string }; box: { x: number; y: number; w: number; h: number } } }[]) => void;
      sealOverlaps: (measured: { bitmap?: { width: number; height: number }; slice: { kind: string; page: number; source: { pdfId: string }; box: { y: number; h: number } } }[]) => void;
    };
    const width = 400;
    const height = 900;
    const data = new Uint8ClampedArray(width * height * 4);
    data.fill(255);
    const ink = (x0: number, x1: number, y0: number, y1: number) => {
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const i = (y * width + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    };
    // Rectangle on the left, continuing below the crop, with a short label under it.
    ink(45, 110, 200, 202);
    ink(45, 47, 200, 340);
    ink(108, 110, 200, 340);
    ink(45, 110, 338, 340);
    ink(70, 84, 355, 368);
    // The next question's sentence is on the right and must stay out of the crop.
    ink(220, 360, 400, 414);
    const bitmap = { width, height, getContext: () => ({ getImageData: () => ({ data }) }) };
    const box = { x: 0, y: 0.2, w: 1, h: 0.12 };
    const bottom = api.extendDrawingBox(bitmap, box, 0.7);
    assert.ok(bottom != null && bottom > 368 / height && bottom < 390 / height, String(bottom));
    assert.equal(api.extendDrawingBox(bitmap, box, 0.325), null);
    const measured = [
      { bitmap, slice: { kind: 'row', block: 'q7', page: 3, source: { pdfId: 'pythagoras' }, box: { ...box } } },
      { bitmap, slice: { kind: 'stem', block: 'q8', page: 3, source: { pdfId: 'pythagoras' }, box: { x: 0, y: 0.1, w: 1, h: 0.5 } } },
      { bitmap, slice: { kind: 'row', block: 'q8', page: 3, source: { pdfId: 'pythagoras' }, box: { x: 0, y: 0.62, w: 1, h: 0.08 } } },
    ];
    api.claimDrawingTails(measured);
    api.sealOverlaps(measured);
    const extended = measured[0].slice.box.y + measured[0].slice.box.h;
    assert.ok(Math.abs(extended - (bottom as number)) < 0.001, String(extended));
    assert.ok(Math.abs(measured[1].slice.box.y - extended) < 0.001, String(measured[1].slice.box.y));
    assert.ok(measured[1].slice.box.h > 0.05, String(measured[1].slice.box.h));
    const house = [
      { bitmap, slice: { kind: 'row', block: 'q8', page: 3, source: { pdfId: 'house' }, box: { x: 0, y: 0.2, w: 1, h: 0.12 } } },
      { bitmap, slice: { kind: 'row', block: 'q8', page: 3, source: { pdfId: 'house' }, box: { x: 0, y: 0.4, w: 1, h: 0.05 } } },
    ];
    api.claimDrawingTails(house);
    assert.equal(house[0].slice.box.h, 0.12);
    // The next part's sentence crosses into the drawing columns. It is not a full-width rule.
    // It is not picked, and the extension still stops at that part's label on the source sheet.
    ink(30, 180, 372, 390);
    const stopped = [{
      bitmap,
      slice: {
        kind: 'row',
        block: 'q2',
        page: 1,
        source: {
          pdfId: 'parallelogram',
          questions: [
            { q: 2, page: 1, row: { y: 0.2, h: 0.12 }, labelLine: { y: 0.2 } },
            { q: 2, page: 1, id: '2ב', row: { y: 0.43, h: 0.04 }, labelLine: { y: 0.409 } },
          ],
        },
        box: { x: 0, y: 0.2, w: 1, h: 0.12 },
      },
    }];
    api.claimDrawingTails(stopped);
    const stoppedEnd = stopped[0].slice.box.y + stopped[0].slice.box.h;
    assert.ok(stoppedEnd <= 0.409, String(stoppedEnd));
    assert.ok(stoppedEnd < 372 / height, String(stoppedEnd));
    const open = [{
      bitmap,
      slice: {
        kind: 'row',
        block: 'q2',
        page: 1,
        source: { pdfId: 'parallelogram', questions: [] },
        box: { x: 0, y: 0.2, w: 1, h: 0.12 },
      },
    }];
    api.claimDrawingTails(open);
    const openEnd = open[0].slice.box.y + open[0].slice.box.h;
    assert.ok(openEnd > 372 / height, String(openEnd));
  });

  it('keeps the question stem and its drawings when a later part is picked alone', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const layoutQuestionCrops = new Function(`${preview.slice(preview.indexOf('function leftFigureBoxes'), preview.indexOf('async function measureWorksheet'))} return layoutQuestionCrops;`)() as (model: {
      page: number;
      parts: { id: string; part: string; page: number; stem?: { y: number; h: number; page?: number }; row: { y: number; h: number; page?: number }; labelLine?: { y: number; page?: number } }[];
      picked: string[];
      labels: { part: string; y: number }[];
      figures: { x0: number; x1: number; y0: number; y1: number }[];
      earlierEnd: number;
    }) => { kind: string; box: { x?: number; y: number; w?: number; h: number; segment?: string; masks?: { x: number; y: number; h: number; w: number; role?: string }[] } }[];
    const covers = (boxes: { box: { x?: number; y: number; w?: number; h: number; masks?: { x: number; y: number; h: number; w: number }[] } }[], y: number, rightText: boolean) => boxes.some((entry) => {
      const box = entry.box;
      if (y < box.y + 0.004 || y > box.y + box.h - 0.004) return false;
      const right = (box.x || 0) + (box.w == null ? 1 : box.w);
      if (rightText && right < 0.55) return false;
      if (!rightText) return true;
      return !(box.masks || []).some((mask) => {
        if (mask.x > 0.5 || mask.x + mask.w < 0.85) return false;
        const top = box.y + mask.y * box.h;
        const bot = top + mask.h * box.h;
        return y >= top - 0.003 && y <= bot + 0.003;
      });
    });
    const rhombus = layoutQuestionCrops({
      page: 6,
      earlierEnd: 0,
      picked: ['14ב'],
      labels: [{ part: 'א', y: 0.222 }, { part: 'ב', y: 0.289 }, { part: 'ג', y: 0.358 }],
      figures: [{ x0: 0.086, x1: 0.284, y0: 0.138, y1: 0.237 }],
      parts: [
        { id: '14א', part: 'א', page: 6, stem: { y: 0.1217, h: 0.0303, page: 6 }, row: { y: 0.152, h: 0.1378, page: 6 }, labelLine: { y: 0.152, page: 6 } },
        { id: '14ב', part: 'ב', page: 6, stem: { y: 0.1217, h: 0.0303, page: 6 }, row: { y: 0.2898, h: 0.0695, page: 6 }, labelLine: { y: 0.2898, page: 6 } },
        { id: '14ג', part: 'ג', page: 6, stem: { y: 0.1217, h: 0.0303, page: 6 }, row: { y: 0.3593, h: 0.0627, page: 6 }, labelLine: { y: 0.3593, page: 6 } },
      ],
    });
    assert.ok(covers(rhombus, 0.14, true), 'rhombus stem ' + JSON.stringify(rhombus));
    assert.ok(covers(rhombus, 0.19, true), 'rhombus figure');
    assert.ok(covers(rhombus, 0.30, true), 'rhombus 14ב');
    assert.ok(!covers(rhombus, 0.23, true), 'rhombus hides 14א');
    assert.ok(!covers(rhombus, 0.37, true), 'rhombus hides 14ג');
    const tallest = Math.max.apply(null, rhombus.map((entry) => entry.box.h));
    assert.ok(tallest < 0.2, 'rhombus does not keep 14א as a blank band ' + tallest);

    const similarity = layoutQuestionCrops({
      page: 2,
      earlierEnd: 0.799,
      picked: ['4א'],
      labels: [{ part: 'א', y: 0.832 }],
      figures: [
        { x0: 0.082, x1: 0.299, y0: 0.346, y1: 0.446 },
        { x0: 0.082, x1: 0.299, y0: 0.814, y1: 0.914 },
      ],
      parts: [
        { id: '4א', part: 'א', page: 2, stem: { y: 0.3316, h: 0.4727, page: 2 }, row: { y: 0.8043, h: 0.12, page: 2 }, labelLine: { y: 0.8043, page: 2 } },
      ],
    });
    assert.equal(similarity.some((entry) => entry.box.y < 0.7), false, 'question 3 figure stays out ' + JSON.stringify(similarity));
    assert.ok(similarity.some((entry) => entry.box.segment === 'figure' && entry.box.y > 0.75), JSON.stringify(similarity));
    assert.ok(!covers(similarity, 0.55, true), 'similarity drops question 3 text');
    assert.ok(covers(similarity, 0.86, true), 'similarity keeps question 4');

    const pythagoras = layoutQuestionCrops({
      page: 7,
      earlierEnd: 0,
      picked: ['19ד'],
      labels: [{ part: 'א', y: 0.071 }, { part: 'ב', y: 0.12 }, { part: 'ג', y: 0.169 }, { part: 'ד', y: 0.218 }],
      figures: [{ x0: 0.067, x1: 0.328, y0: 0.056, y1: 0.293 }],
      parts: [
        { id: '19א', part: 'א', page: 7, row: { y: 0.05, h: 0.07, page: 7 }, labelLine: { y: 0.05, page: 7 } },
        { id: '19ב', part: 'ב', page: 7, row: { y: 0.12, h: 0.049, page: 7 }, labelLine: { y: 0.12, page: 7 } },
        { id: '19ג', part: 'ג', page: 7, row: { y: 0.169, h: 0.048, page: 7 }, labelLine: { y: 0.169, page: 7 } },
        { id: '19ד', part: 'ד', page: 7, row: { y: 0.217, h: 0.033, page: 7 }, labelLine: { y: 0.218, page: 7 } },
      ],
    });
    assert.ok(covers(pythagoras, 0.055, true), 'pythagoras stem ' + JSON.stringify(pythagoras));
    assert.ok(covers(pythagoras, 0.18, false), 'pythagoras figure');
    assert.ok(!covers(pythagoras, 0.08, true), 'pythagoras hides 19א');
    assert.ok(covers(pythagoras, 0.225, true), 'pythagoras 19ד');
  });

  it('covers a hidden line from both sides and keeps a 9. stem', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const api = new Function(`${preview.slice(preview.indexOf('function leftFigureBoxes'), preview.indexOf('async function measureWorksheet'))} return { layoutQuestionCrops, polishQuestionSlice, questionNumberOf, figureIsSentence };`)() as {
      layoutQuestionCrops: (model: object) => { box: { x?: number; y: number; w?: number; h: number; segment?: string; masks?: { x: number; w: number; y: number; h: number; role?: string }[] } }[];
      polishQuestionSlice: (item: object, items: object[]) => { slice: { box: { y: number; h: number; masks?: { x: number; w: number; y: number; h: number; role?: string }[] } } };
      questionNumberOf: (item: { str: string; x?: number; y?: number }, items?: object[]) => number | null;
      figureIsSentence: (figure: object, rows: object[]) => boolean;
    };
    assert.equal(api.questionNumberOf({ str: '(16)', x: 0.9, y: 0.1 }, []), 16);
    assert.equal(api.questionNumberOf({ str: '9.', x: 0.91, y: 0.2 }, []), 9);
    assert.equal(api.questionNumberOf({ str: ' 19.', x: 0.9, y: 0.05 }, []), 19);
    assert.equal(api.questionNumberOf({ str: '9', x: 0.2, y: 0.2 }, []), null);
    const hidden = api.layoutQuestionCrops({
      page: 1,
      earlierEnd: 0,
      picked: ['ב'],
      labels: [{ part: 'א', y: 0.2 }, { part: 'ב', y: 0.32 }],
      figures: [{ x0: 0.07, x1: 0.28, y0: 0.2, y1: 0.3 }],
      questionTop: 0.1,
      questionBot: 0.5,
      rows: [
        { y: 0.11, h: 0.016, x: 0.4, w: 0.48, text: 'מצולע המורכב ממלבן' },
        { y: 0.21, h: 0.016, x: 0.1, w: 0.72, text: 'שורה שנמשכת שמאלה.א' },
        { y: 0.33, h: 0.016, x: 0.5, w: 0.32, text: 'הסעיף שלי.ב' },
        { y: 0.52, h: 0.016, x: 0.2, w: 0.6, text: 'השאלה הבאה לגמרי' },
      ],
      items: [
        { str: '40', x: 0.12, y: 0.21, w: 0.03, h: 0.014 },
        { str: 'A', x: 0.16, y: 0.212, w: 0.02, h: 0.012 },
        { str: 'שורה שנמשכת שמאלה', x: 0.4, y: 0.21, w: 0.42, h: 0.014 },
      ],
      parts: [
        { id: 'א', part: 'א', page: 1, stem: { y: 0.1, h: 0.04, page: 1 }, row: { y: 0.2, h: 0.08, page: 1 }, labelLine: { y: 0.2, page: 1 } },
        { id: 'ב', part: 'ב', page: 1, stem: { y: 0.1, h: 0.04, page: 1 }, row: { y: 0.32, h: 0.06, page: 1 }, labelLine: { y: 0.32, page: 1 } },
      ],
    });
    const holds = (x: number, y: number) => hidden.some((entry) => {
      const box = entry.box;
      const left = box.x || 0;
      const right = left + (box.w == null ? 1 : box.w);
      return y >= box.y - 0.002 && y <= box.y + box.h + 0.002 && x >= left - 0.01 && x <= right + 0.01;
    });
    const inside = (y: number) => hidden.some((entry) => y > entry.box.y && y < entry.box.y + entry.box.h);
    assert.equal(inside(0.52), false, 'next question ' + JSON.stringify(hidden));
    assert.ok(inside(0.25), 'the drawing beside the hidden line stays');
    assert.ok(holds(0.12, 0.218), 'a figure label stays ' + JSON.stringify(hidden));
    assert.ok(holds(0.17, 0.218), 'a vertex letter stays');
    assert.equal(holds(0.7, 0.218), false, 'the hidden line is not a piece ' + JSON.stringify(hidden));
    const tail = api.layoutQuestionCrops({
      page: 5,
      earlierEnd: 0,
      picked: ['12ב'],
      labels: [{ part: 'א', y: 0.563 }, { part: 'ב', y: 0.613 }],
      figures: [{ x0: 0.07, x1: 0.45, y0: 0.505, y1: 0.547 }],
      questionTop: 0.12,
      questionBot: 0.72,
      rows: [
        { y: 0.563, h: 0.014, x: 0.4, w: 0.45, text: 'סמנו במערכת הצירים את הנקודות.א' },
        { y: 0.612, h: 0.014, x: 0.29, w: 0.55, text: 'באיזה יום.ב' },
      ],
      items: [
        { str: '- ו5', x: 0.408, y: 0.563, w: 0.028, h: 0.014 },
        { str: '4', x: 0.436, y: 0.563, w: 0.01, h: 0.014 },
      ],
      parts: [
        { id: '12א', part: 'א', page: 5, stem: { y: 0.12, h: 0.4, page: 5 }, row: { y: 0.563, h: 0.05, page: 5 }, labelLine: { y: 0.563, page: 5 } },
        { id: '12ב', part: 'ב', page: 5, stem: { y: 0.12, h: 0.4, page: 5 }, row: { y: 0.613, h: 0.05, page: 5 }, labelLine: { y: 0.613, page: 5 } },
      ],
    });
    const tailFig = tail.find((entry) => entry.box.segment === 'figure');
    assert.ok(tailFig && tailFig.box.y + tailFig.box.h < 0.57, 'a sentence tail is not part of the figure ' + JSON.stringify(tailFig && tailFig.box));
    assert.ok(holds(0.6, 0.118), 'stem stays visible');
    const glued = api.layoutQuestionCrops({
      page: 2,
      earlierEnd: 0,
      picked: ['3ג'],
      labels: [{ part: 'א', y: 0.05 }, { part: 'ב', y: 0.099 }, { part: 'ג', y: 0.148 }],
      figures: [],
      questionTop: 0.044,
      questionBot: 0.25,
      rows: [
        { y: 0.05, h: 0.014, x: 0.515, w: 0.42, text: '.אבמשולש שניצביו3.' },
        { y: 0.098, h: 0.014, x: 0.548, w: 0.33, text: 'ב.חשבו את הגובה' },
        { y: 0.147, h: 0.014, x: 0.562, w: 0.31, text: 'ג.נסחו כלל' },
      ],
      parts: [
        { id: '3א', part: 'א', page: 2, stem: { y: 0.042, h: 0.008, page: 2 }, row: { y: 0.0505, h: 0.049, page: 2 }, labelLine: { y: 0.0505, page: 2 } },
        { id: '3ב', part: 'ב', page: 2, stem: { y: 0.042, h: 0.008, page: 2 }, row: { y: 0.099, h: 0.049, page: 2 }, labelLine: { y: 0.099, page: 2 } },
        { id: '3ג', part: 'ג', page: 2, stem: { y: 0.042, h: 0.008, page: 2 }, row: { y: 0.148, h: 0.049, page: 2 }, labelLine: { y: 0.148, page: 2 } },
      ],
    });
    const gluedHit = (y) => glued.some((entry) => y > entry.box.y + 0.002 && y < entry.box.y + entry.box.h - 0.002);
    const gluedCovered = (x, y) => glued.some((entry) => {
      const box = entry.box;
      if (y < box.y || y > box.y + box.h) return false;
      return (box.masks || []).some((mask) => y >= box.y + mask.y * box.h - 0.004 && y <= box.y + (mask.y + mask.h) * box.h + 0.004 && x >= mask.x - 0.02 && x <= mask.x + mask.w + 0.02);
    });
    assert.equal(gluedHit(0.056), false, 'the first part is not reprinted ' + JSON.stringify(glued));
    assert.equal(gluedCovered(0.7, 0.056), false, 'stem words stay visible');
    assert.equal(gluedHit(0.105), false, 'the part between the stem and the pick stays out');
    assert.ok(gluedHit(0.15), 'the picked part stays');
    const raised = api.layoutQuestionCrops({
      page: 8,
      earlierEnd: 0,
      picked: ['23ב'],
      labels: [{ part: 'א', y: 0.775 }, { part: 'ב', y: 0.834 }],
      figures: [],
      questionTop: 0.691,
      questionBot: null,
      rows: [
        { y: 0.697, h: 0.014, x: 0.4, w: 0.48, text: 'השוקיים-במשולש שווה' },
        { y: 0.774, h: 0.014, x: 0.32, w: 0.53, text: 'הוכיחו.א' },
        { y: 0.833, h: 0.014, x: 0.5, w: 0.35, text: 'ב.מה מיוחד' },
      ],
      parts: [
        { id: '23א', part: 'א', page: 8, row: { y: 0.775, h: 0.06, page: 8 }, labelLine: { y: 0.775, page: 8 } },
        { id: '23ב', part: 'ב', page: 8, row: { y: 0.834, h: 0.13, page: 8 }, labelLine: { y: 0.834, page: 8 } },
      ],
    });
    assert.ok(raised.some((entry) => entry.box.y < 0.71 && entry.box.y + entry.box.h > 0.71), 'stem above the first catalog row ' + JSON.stringify(raised));
    const stem = api.polishQuestionSlice({
      slice: {
        kind: 'stem',
        block: 'q9',
        page: 1,
        box: { x: 0, y: 0.19, w: 1, h: 0.033, mask: { x: 0.36, w: 0.64, y: 0, h: 0.9, role: 'swallowed' } },
      },
    }, [
      { str: '9.', x: 0.917, y: 0.198, w: 0.016, h: 0.013 },
      { str: 'מצולע המורכב ממלבן', x: 0.45, y: 0.198, w: 0.42, h: 0.013 },
      { str: '9', x: 0.2, y: 0.196, w: 0.012, h: 0.013 },
    ]);
    const masks = stem.slice.box.masks || [];
    const hits = (x, y) => masks.some((mask) => {
      const top = stem.slice.box.y + mask.y * stem.slice.box.h;
      const bot = top + mask.h * stem.slice.box.h;
      return y >= top - 0.003 && y <= bot + 0.003 && x >= mask.x - 0.01 && x <= mask.x + mask.w + 0.01;
    });
    assert.equal(hits(0.55, 0.204), false, 'dotted stem wording ' + JSON.stringify(masks));
    assert.ok(hits(0.2, 0.202), 'house digit on the stem line');
    assert.equal(api.figureIsSentence(
      { x0: 0.07, x1: 0.33, y0: 0.43, y1: 0.48 },
      [{ y: 0.444, h: 0.014, x: 0.104, w: 0.7 }],
    ), true);
    assert.equal(api.figureIsSentence(
      { x0: 0.08, x1: 0.29, y0: 0.14, y1: 0.24 },
      [{ y: 0.17, h: 0.014, x: 0.37, w: 0.48 }, { y: 0.18, h: 0.012, x: 0.16, w: 0.02 }],
    ), false);
  });

  it('takes each crop from the card source PDF, not a page screenshot', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    assert.match(preview, /const PRINT_DPI = 300/);
    assert.match(preview, /getDocument\(\{ url: active\.pdfUrl/);
    assert.match(preview, /page\.render\(\{ canvasContext: canvas\.getContext\('2d'\), viewport \}\)/);
    assert.equal(/html2canvas|drawWindow/.test(preview), false);
    const bitmapFn = preview.slice(preview.indexOf('async function pageBitmap'), preview.indexOf('function boxEnd'));
    assert.match(bitmapFn, /purpose === 'print'/);
    assert.match(bitmapFn, /PRINT_DPI \/ 72/);
    assert.match(preview, /pageBitmap\(slice\.page, slice\.source, 'print'\)/);
    assert.match(preview, /clip: sourceClip\(/);
    const sourceClip = new Function(`${preview.slice(preview.indexOf('function sourceClip'), preview.indexOf('function printCanvasScale'))} return sourceClip;`)() as (source: { pdfUrl?: string; pdfId?: string }, page: number, segment: string) => { pdfUrl: string; pdfId: string; page: number; segment: string };
    const clip = sourceClip({ pdfUrl: 'https://static.wixstatic.com/ugd/d8e7ad_abc.pdf', pdfId: 'abc' }, 4, 'figure');
    assert.equal(clip.pdfUrl, 'https://static.wixstatic.com/ugd/d8e7ad_abc.pdf');
    assert.equal(clip.pdfId, 'abc');
    assert.equal(clip.page, 4);
    assert.equal(clip.segment, 'figure');
    const layoutQuestionCrops = new Function(`${preview.slice(preview.indexOf('function leftFigureBoxes'), preview.indexOf('async function measureWorksheet'))} return layoutQuestionCrops;`)() as (model: object) => { box: { x?: number; y: number; w?: number; h: number; segment?: string } }[];
    const boxes = layoutQuestionCrops({
      page: 3,
      earlierEnd: 0,
      picked: ['8ג'],
      labels: [{ part: 'א', y: 0.335 }, { part: 'ב', y: 0.384 }, { part: 'ג', y: 0.433 }, { part: 'ד', y: 0.481 }],
      figures: [],
      questionTop: 0.307,
      questionBot: 0.533,
      rows: [
        { y: 0.313, h: 0.014, x: 0.57, w: 0.32, text: 'בטרפז ישר־זווית' },
        { y: 0.384, h: 0.16, x: 0.026, w: 0.01, text: '© כל הזכויות שמורות לנועם דורון' },
        { y: 0.384, h: 0.014, x: 0.665, w: 0.197, text: 'ב.מה אורך השוק האלכסונית?' },
        { y: 0.433, h: 0.014, x: 0.742, w: 0.124, text: 'ג.מה היקף הטרפז?' },
      ],
      items: [
        { str: '8.', x: 0.919, y: 0.313, w: 0.014, h: 0.013 },
        { str: '© כל הזכויות שמורות לנועם דורון', x: 0.026, y: 0.384, w: 0.01, h: 0.16 },
        { str: 'מה אורך השוק האלכסונית?', x: 0.665, y: 0.384, w: 0.197, h: 0.014 },
        { str: 'ג.', x: 0.865, y: 0.433, w: 0.011, h: 0.013 },
        { str: 'מה היקף הטרפז?', x: 0.742, y: 0.433, w: 0.124, h: 0.014 },
      ],
      parts: [
        { id: '8א', part: 'א', page: 3, stem: { y: 0.306, h: 0.03, page: 3 }, row: { y: 0.336, h: 0.049, page: 3 }, labelLine: { y: 0.336, page: 3 } },
        { id: '8ב', part: 'ב', page: 3, stem: { y: 0.306, h: 0.03, page: 3 }, row: { y: 0.385, h: 0.049, page: 3 }, labelLine: { y: 0.385, page: 3 } },
        { id: '8ג', part: 'ג', page: 3, stem: { y: 0.306, h: 0.03, page: 3 }, row: { y: 0.434, h: 0.048, page: 3 }, labelLine: { y: 0.434, page: 3 } },
        { id: '8ד', part: 'ד', page: 3, stem: { y: 0.306, h: 0.03, page: 3 }, row: { y: 0.482, h: 0.047, page: 3 }, labelLine: { y: 0.482, page: 3 } },
      ],
    });
    const part = boxes.find((entry) => entry.box.segment === 'part');
    assert.ok(part && part.box.y > 0.42, 'part crop stays on its own label ' + JSON.stringify(boxes));
    const showsPrevious = boxes.some((entry) => {
      const box = entry.box;
      const left = box.x || 0;
      const right = left + (box.w == null ? 1 : box.w);
      return 0.39 > box.y && 0.39 < box.y + box.h && 0.7 >= left && 0.7 <= right;
    });
    assert.equal(showsPrevious, false, 'previous part stays out ' + JSON.stringify(boxes));
  });

  it('keeps a פרק זמן line and stops before the next section title', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const layoutQuestionCrops = new Function(`${preview.slice(preview.indexOf('function leftFigureBoxes'), preview.indexOf('async function measureWorksheet'))} return layoutQuestionCrops;`)() as (model: object) => { box: { x?: number; y: number; w?: number; h: number; segment?: string } }[];
    const boxes = layoutQuestionCrops({
      page: 2,
      earlierEnd: 0,
      picked: ['4א'],
      labels: [{ part: 'א', y: 0.264 }],
      figures: [],
      questionTop: 0.21,
      questionBot: null,
      rows: [
        { y: 0.238, h: 0.014, x: 0.33, w: 0.4, text: 'השינוי בכל פרק זמן הוא מספר שלם' },
        { y: 0.264, h: 0.014, x: 0.14, w: 0.67, text: '.מצאו את כל האפשרויות.א' },
        { y: 0.4, h: 0.016, x: 0.45, w: 0.4, text: 'פרק ב׳ · אלכסונים' },
      ],
      items: [
        { str: '.א', x: 0.836, y: 0.264, w: 0.019, h: 0.014 },
        { str: 'פרק ב׳ · אלכסונים', x: 0.5, y: 0.4, w: 0.35, h: 0.016 },
      ],
      parts: [
        { id: '4א', part: 'א', page: 2, stem: { y: 0.208, h: 0.05, page: 2 }, row: { y: 0.264, h: 0.16, page: 2 }, labelLine: { y: 0.265, page: 2 } },
      ],
    });
    const holds = (x: number, y: number) => boxes.some((entry) => {
      const box = entry.box;
      const left = box.x || 0;
      const right = left + (box.w == null ? 1 : box.w);
      return y >= box.y - 0.004 && y <= box.y + box.h + 0.004 && x >= left - 0.01 && x <= right + 0.01;
    });
    assert.ok(holds(0.84, 0.27), 'the part letter stays ' + JSON.stringify(boxes));
    assert.equal(holds(0.6, 0.408), false, 'the next section title stays out ' + JSON.stringify(boxes));
    const fraction = layoutQuestionCrops({
      page: 1,
      earlierEnd: 0,
      picked: ['2א'],
      labels: [{ part: 'א', y: 0.415 }],
      figures: [],
      questionTop: 0.364,
      questionBot: 0.61,
      rows: [
        { y: 0.37, h: 0.014, x: 0.7, w: 0.16, text: '.פתרו' },
        { y: 0.415, h: 0.014, x: 0.82, w: 0.05, text: 'א.= 3' },
      ],
      items: [
        { str: 'x', x: 0.8, y: 0.398, w: 0.01, h: 0.014 },
        { str: 'א.', x: 0.848, y: 0.415, w: 0.023, h: 0.014 },
        { str: '= 3', x: 0.821, y: 0.415, w: 0.027, h: 0.014 },
        { str: '4', x: 0.8, y: 0.423, w: 0.01, h: 0.014 },
      ],
      parts: [
        { id: '2א', part: 'א', page: 1, stem: { y: 0.36, h: 0.04, page: 1 }, row: { y: 0.4, h: 0.16, page: 1 }, labelLine: { y: 0.401, page: 1 } },
      ],
    });
    const inPart = (x: number, y: number) => fraction.some((entry) => {
      const box = entry.box;
      if (entry.box.segment !== 'part') return false;
      const left = box.x || 0;
      const right = left + (box.w == null ? 1 : box.w);
      return y >= box.y - 0.004 && y <= box.y + box.h + 0.004 && x >= left - 0.01 && x <= right + 0.01;
    });
    assert.ok(inPart(0.805, 0.404), 'the numerator stays on the part line ' + JSON.stringify(fraction));
    assert.equal(inPart(0.75, 0.376), false, 'the line above stays out');
  });

  it('keeps the stem, the drawing, and the whole answer when each part is picked alone', (t) => {
    const probe = spawnSync('python3', ['-c', 'import pymupdf, numpy'], { encoding: 'utf8' });
    const pdfDir = '/tmp/sheets';
    if (probe.status !== 0 || !existsSync(`${pdfDir}/e091562d859a4059abca94dfddc17bfa.pdf`)) {
      t.skip('worksheet pdfs or pymupdf are not available');
      return;
    }
    const sheets = fileURLToPath(new URL('../public/teachers/sheets/', import.meta.url));
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const body = preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'));
    const cropApi = new Function(`${preview.slice(preview.indexOf('function leftFigureBoxes'), preview.indexOf('async function measureWorksheet'))} return { layoutQuestionCrops, polishQuestionSlice, questionMarks, textRows, figureIsSentence, questionNumberOf, rowPart, carveMasks, maskWritingRules };`)() as {
      layoutQuestionCrops: (model: { page: number; parts: { id: string; part: string; page: number; row: { y: number; h: number; page?: number }; stem?: { y: number; h: number; page?: number }; labelLine?: { y: number; page?: number } }[]; picked: string[]; labels: { part: string; y: number }[]; figures: { x0: number; x1: number; y0: number; y1: number }[]; earlierEnd: number; rows?: { y: number; h: number; x: number; w: number; text: string }[]; items?: { str: string; x: number; y: number; w: number; h: number }[]; questionTop?: number | null; questionBot?: number | null }) => { kind?: string; page?: number; figures?: { x0: number; x1: number; y0: number; y1: number }[]; box: { y: number; h: number; masks?: { x: number; w: number; y: number; h: number; role?: string }[] } }[];
      polishQuestionSlice: (item: { slice: { kind: string; block: string; page: number; figures?: { x0: number; x1: number; y0: number; y1: number }[]; box: { x?: number; y: number; w?: number; h: number; mask?: { x: number; w: number; y: number; h: number; role?: string }; masks?: { x: number; w: number; y: number; h: number; role?: string }[] } }; bitmap?: { width: number; height: number; getContext: () => { getImageData: () => { data: Uint8ClampedArray } } } | null }, items: { str: string; x: number; y: number; w: number; h: number }[]) => { slice: { box: { y: number; h: number; masks?: { x: number; w: number; y: number; h: number; role?: string }[] } } };
      carveMasks: (masks: { x: number; w: number; y: number; h: number; role?: string }[], box: { x?: number; y: number; w?: number; h: number }, figures: { x0: number; x1: number; y0: number; y1: number }[]) => { x: number; w: number; y: number; h: number; role?: string }[];
      maskWritingRules: (bitmap: { width: number; height: number; getContext: () => { getImageData: () => { data: Uint8ClampedArray } } } | null, box: { y: number; h: number }, spans: number[][]) => { x: number; w: number; y: number; h: number; role?: string }[];
      questionMarks: (items: { str: string; x: number; y: number; w: number; h: number }[]) => { n: number; y: number; h: number; x: number }[];
      textRows: (items: { str: string; x: number; y: number; w: number; h: number }[]) => { y: number; h: number; x: number; w: number; text: string }[];
      figureIsSentence: (figure: { x0: number; x1: number; y0: number; y1: number }, rows: { y: number; h: number; x: number; w: number }[]) => boolean;
      questionNumberOf: (item: { str: string; x: number; y: number }, items: { str: string; x: number; y: number }[]) => number | null;
      rowPart: (text: string) => string | null;
    };
    const layoutQuestionCrops = cropApi.layoutQuestionCrops;
    const answerApi = new Function(`${preview.slice(preview.indexOf('function answerBox'), preview.indexOf('function groupsOf'))} return { answerBox, answerSliceFor };`)() as {
      answerBox: (items: { str: string; x: number; y: number; w: number; h: number; page: number }[], questionNumber: number, part: string) => { x: number; y: number; w: number; h: number; page: number; slot?: { lineBottom: number; lineTop: number } } | null;
      answerSliceFor: (pages: { page: number; width: number; height: number; items: { str: string; x: number; y: number; w: number; h: number; page: number }[] }[], question: { q: number; part: string }) => { box: { x: number; y: number; w: number; h: number } } | null;
    };
    const answerBox = answerApi.answerBox;
    const answerSliceFor = answerApi.answerSliceFor;
    const pythonSource = `import json, re
from pathlib import Path
import numpy as np
import pymupdf

sheets = Path('__SHEETS__')
pdfs = Path('__PDFS__')
scale = 700 / 595.276
part_re = re.compile(r'^\\.?([אבגדהו])\\.?$')
out = {}
used = 0
for path in sorted(sheets.glob('*.json')):
    data = json.loads(path.read_text())
    if (data.get('grade') or 0) < 7:
        continue
    pdf_path = pdfs / f"{data.get('pdfId')}.pdf"
    if not pdf_path.exists():
        continue
    pages_needed = set()
    for q in data.get('questions') or []:
        if isinstance(q.get('page'), int):
            pages_needed.add(q['page'])
        for row in q.get('rows') or []:
            if isinstance(row.get('page'), int):
                pages_needed.add(row['page'])
        stem = q.get('stem') or {}
        if isinstance(stem.get('page'), int):
            pages_needed.add(stem['page'])
    doc = pymupdf.open(pdf_path)
    page_out = {}
    answer_pages = []
    open_answers = False
    for number in range(1, doc.page_count + 1):
        page = doc[number - 1]
        text = page.get_text('dict')
        title = False
        items = []
        labels = []
        text_items = []
        width = page.rect.width
        height = page.rect.height
        for block in text.get('blocks') or []:
            if block.get('type') != 0:
                continue
            for line in block.get('lines') or []:
                for span in line.get('spans') or []:
                    raw = span.get('text') or ''
                    token = raw.strip()
                    if not token:
                        continue
                    x0, y0, x1, y1 = span['bbox']
                    if 'תשובות סופיות' in token or 'תשובות סופיות' in raw:
                        title = True
                    if number in pages_needed:
                        match = part_re.match(token)
                        if match and (x0 / width) >= 0.72:
                            labels.append([match.group(1), round(y0 / height, 4)])
                        text_items.append([
                            token,
                            round(x0 / width, 4),
                            round(y0 / height, 4),
                            round(max(0.004, (x1 - x0) / width), 4),
                            round(max(0.008, (y1 - y0) / height), 4),
                        ])
                    if open_answers or title:
                        items.append([
                            token,
                            round(x0, 2),
                            round(height - y1, 2),
                            round(x1 - x0, 2),
                            round(max(1.0, y1 - y0), 2),
                        ])
        if title:
            open_answers = True
        if open_answers and items:
            answer_pages.append({'page': number, 'w': round(width, 2), 'h': round(height, 2), 'items': items})
        if number not in pages_needed:
            continue
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        h, w = img.shape[:2]
        dark = (img[:, :, 0] < 242) | (img[:, :, 1] < 242) | (img[:, :, 2] < 242)
        x_start = max(1, int(w * 0.04))
        x_stop = max(x_start + 2, int(w * 0.33))
        tall_min = h * 0.03
        tall = []
        view = dark[:, x_start:x_stop]
        for local, col in enumerate(view.T):
            ys = np.flatnonzero(col)
            if ys.size >= 2 and int(ys[-1] - ys[0]) > tall_min:
                tall.append(x_start + local)
        figures = []
        if tall:
            row_hit = dark[:, tall].any(axis=1)
            gap_lim = max(2, int(round(h * 0.018)))
            clusters = []
            start = None
            prev = None
            for y in range(h + 1):
                hit = y < h and bool(row_hit[y])
                if hit:
                    if start is None:
                        start = y
                    prev = y
                elif start is not None and (y >= h or y - prev > gap_lim):
                    clusters.append((start, prev))
                    start = None
            x0b, x1b = int(w * 0.12), int(w * 0.90)
            slab = img[:, x0b:x1b]
            mx = slab.max(axis=2)
            mn = slab.min(axis=2)
            bar_frac = (((mx - mn) < 18) & (mx < 248) & ((mx < 80) | (mn > 160))).mean(axis=1) > 0.72
            # A title bar's dark edge sits a few pixels below the grey fill.
            pad = max(2, int(round(h * 0.005)))
            dilated = bar_frac.copy()
            for shift in range(1, pad + 1):
                dilated[shift:] |= bar_frac[:-shift]
            # A full-width grey or black band is a section title, not part of the drawing.
            drawn = row_hit.copy()
            drawn[dilated] = False
            # A writing line is short dashes. A graph axis is one long stroke.
            band = dark[:, int(w * 0.40):int(w * 0.90)]
            frac = band.mean(axis=1) if band.size else None
            rule = np.zeros(h, dtype=bool)
            if frac is not None:
                dash_like = np.zeros(h, dtype=bool)
                x0d, x1d = int(w * 0.40), int(w * 0.90)
                candidates = np.flatnonzero((frac >= 0.45) & (frac <= 0.78))
                for yy in candidates:
                    row = dark[yy, x0d:x1d]
                    longest = run = gaps = 0
                    prev = False
                    for value in row:
                        if value:
                            run += 1
                            if run > longest:
                                longest = run
                            prev = True
                        elif prev:
                            gaps += 1
                            run = 0
                            prev = False
                        else:
                            run = 0
                    if longest < w * 0.02 and gaps >= 20:
                        dash_like[yy] = True
                for yy in np.flatnonzero(dash_like):
                    up = bool(dash_like[yy - 1]) if yy else False
                    down = bool(dash_like[yy + 1]) if yy + 1 < h else False
                    if up and down:
                        continue
                    above = yy - (2 if up else 1)
                    below = yy + (2 if down else 1)
                    if above >= 0 and dash_like[above]:
                        continue
                    if below < h and dash_like[below]:
                        continue
                    rule[yy] = True
            ys = np.flatnonzero(drawn)
            if ys.size:
                splits = np.flatnonzero(np.diff(ys) > gap_lim)
                bounds = np.concatenate([[0], splits + 1, [ys.size]])
                for i in range(bounds.size - 1):
                    low = int(ys[bounds[i]])
                    high = int(ys[bounds[i + 1] - 1])
                    if (high - low) / h < 0.025:
                        continue
                    xs = [x for x in tall if dark[low:high + 1, x].any()]
                    if not xs:
                        continue
                    # The left-column scan stops at 0.33. Follow the same stroke past that edge.
                    x1 = xs[-1]
                    gap_px = max(4, int(round(w * 0.016)))
                    limit = min(w - 2, int(w * 0.45))
                    link = 3
                    while x1 > xs[0]:
                        col = dark[low:high + 1, x1] & ~dilated[low:high + 1] & ~rule[low:high + 1]
                        if col.any():
                            break
                        x1 -= 1
                    seed = dark[low:high + 1, x1] & ~dilated[low:high + 1] & ~rule[low:high + 1]
                    miss = 0
                    for x in range(x1 + 1, limit + 1):
                        if not seed.any():
                            break
                        near = seed.copy()
                        near[link:] |= seed[:-link]
                        near[:-link] |= seed[link:]
                        col = dark[low:high + 1, x] & ~dilated[low:high + 1] & ~rule[low:high + 1]
                        hit = col & near
                        if hit.any():
                            seed = hit
                            x1 = x
                            miss = 0
                        else:
                            miss += 1
                            if miss > gap_px:
                                break
                    figures.append([
                        round(xs[0] / w, 4),
                        round((x1 + 1) / w, 4),
                        round(low / h, 4),
                        round((high + 1) / h, 4),
                    ])
        shapes = []
        inks = []
        rule_ys = []
        raw_rects = []
        for drawing in page.get_drawings():
            rect = drawing.get('rect')
            if rect is None:
                continue
            fw = rect.width / width
            fh = rect.height / height
            if fw > 0.45 and fh < 0.12:
                continue
            if fw > 0.7 and fh < 0.08:
                continue
            if fw < 0.004 and fh < 0.004:
                continue
            raw_rects.append((rect.x0 / width, rect.y0 / height, rect.x1 / width, rect.y1 / height))
            for item in drawing.get('items') or []:
                kind = item[0]
                if kind == 'l' and len(item) >= 3:
                    p1, p2 = item[1], item[2]
                    inks.append((((p1.x + p2.x) / 2) / width, ((p1.y + p2.y) / 2) / height))
                elif kind == 'c' and len(item) >= 5:
                    p0, p1, p2, p3 = item[1], item[2], item[3], item[4]
                    t = 0.5
                    u = 1 - t
                    x = (u ** 3) * p0.x + 3 * (u ** 2) * t * p1.x + 3 * u * (t ** 2) * p2.x + (t ** 3) * p3.x
                    y = (u ** 3) * p0.y + 3 * (u ** 2) * t * p1.y + 3 * u * (t ** 2) * p2.y + (t ** 3) * p3.y
                    inks.append((x / width, y / height))
                elif kind == 're' and len(item) >= 2:
                    rr = item[1]
                    inks.append((((rr.x0 + rr.x1) / 2) / width, ((rr.y0 + rr.y1) / 2) / height))
        parent = list(range(len(raw_rects)))
        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        for i, a in enumerate(raw_rects):
            for j in range(i):
                b = raw_rects[j]
                if a[2] + 0.015 < b[0] - 0.015 or b[2] + 0.015 < a[0] - 0.015:
                    continue
                if a[3] + 0.015 < b[1] - 0.015 or b[3] + 0.015 < a[1] - 0.015:
                    continue
                ra, rb = find(i), find(j)
                if ra != rb:
                    parent[rb] = ra
        groups = {}
        for i, rect in enumerate(raw_rects):
            groups.setdefault(find(i), []).append(rect)
        shape_bounds = []
        for group in groups.values():
            x0 = min(rect[0] for rect in group)
            y0 = min(rect[1] for rect in group)
            x1 = max(rect[2] for rect in group)
            y1 = max(rect[3] for rect in group)
            if x1 - x0 > 0.5 and y1 - y0 < 0.14:
                continue
            if x1 - x0 > 0.72:
                continue
            if y1 - y0 < 0.018 or x1 - x0 < 0.012:
                continue
            shape_bounds.append((x0, x1, y0, y1))
        shape_bounds = shape_bounds[:24]
        kept_inks = []
        for x, y in inks:
            hit = None
            for index, (x0, x1, y0, y1) in enumerate(shape_bounds):
                if x0 - 0.008 <= x <= x1 + 0.008 and y0 - 0.008 <= y <= y1 + 0.008:
                    hit = index
                    break
            if hit is None:
                continue
            kept_inks.append((round(x, 4), round(y, 4), hit))
        # A dashed writing line is a one-pixel run across the text column.
        if number in pages_needed:
            rule_view = dark[:, int(w * 0.42):int(w * 0.92)]
            frac = rule_view.mean(axis=1) if rule_view.size else None
            if frac is not None:
                run = 0
                for y, value in enumerate(list(frac) + [0]):
                    if y < h and 0.1 < value < 0.78:
                        run += 1
                    else:
                        if 1 <= run <= 3:
                            rule_ys.append(round((y - run) / h, 4))
                        run = 0
        page_out[str(number)] = {
            'figures': figures,
            'labels': labels,
            'items': text_items,
            'shapes': [[round(x0, 4), round(x1, 4), round(y0, 4), round(y1, 4)] for x0, x1, y0, y1 in shape_bounds],
            'inks': kept_inks[:80],
            'rules': rule_ys[:40],
        }
    doc.close()
    out[data['pdfId']] = {'file': path.name, 'pages': page_out, 'answers': answer_pages}
    used += 1
    if used % 40 == 0:
        print('scanned', used, file=__import__('sys').stderr, flush=True)
import sys
sys.stdout.write(json.dumps(out))
`;
    const extracted = spawnSync('python3', ['-'], {
      input: pythonSource.replaceAll('__SHEETS__', sheets).replaceAll('__PDFS__', pdfDir),
      encoding: 'utf8',
      maxBuffer: 80 * 1024 * 1024,
    });
    assert.equal(extracted.status, 0, extracted.stderr ? extracted.stderr.slice(-800) : '');
    const scan = JSON.parse(extracted.stdout) as Record<string, { pages: Record<string, { figures: number[][]; labels: [string, number][]; items?: [string, number, number, number, number][]; shapes?: number[][]; inks?: number[][]; rules?: number[] }>; answers: { page: number; w?: number; h?: number; items: [string, number, number, number, number][] }[] }>;
    const dir = sheets.endsWith('/') ? sheets : sheets + '/';
    const failures: string[] = [];
    const counts: Record<string, number> = {};
    const push = (kind: string, msg: string) => {
      counts[kind] = (counts[kind] || 0) + 1;
      if (failures.filter((line) => line.startsWith(kind)).length < 12) failures.push(kind + ' ' + msg);
    };
    const focusIds: Record<string, string[]> = {
      e091562d859a4059abca94dfddc17bfa: ['14ב'],
      '831390f8e9504f2db0958e01d8d5fe71': ['4א'],
      '882bc55c1c8748e1bf7f416c6d2cbd19': ['16ג'],
      b7a76fde760d4c2e9252a933ed40a6c5: ['19ד'],
      '9c95b48e57124721b4c2b56d79cf72ba': ['9ד'],
      '050b9cc226cd4326931adfb3c0775a05': ['1א'],
      '871fe90d52a04673a7d30fc039e4bf2e': ['8ד'],
      f4e2bea04e5a4e7382733a7be67c5e46: ['3ב'],
      '4bd841f8e6594fc9bd30ac2ab3e138e2': ['11ב'],
      fe59996ff67f4f56970e4dad5d87d4bc: ['20ד'],
      adef6cf437894f559832c4b28583a695: ['16ב'],
      '129976246ab548809e8decb9905dfd1a': ['15ב'],
      '5acb785125b341b4864f326b110e5c14': ['14ב'],
    };
    const styles = { paren: 0, dot: 0, bare: 0, star: 0 };
    const seenStyle = new Set<string>();
    const watched: { id: string; crops: { x: number; y: number; w: number; h: number; segment: string; masks: number }[] }[] = [];
    let parts = 0;
    let rebuilt = 0;
    let answers = 0;
    let withFigure = 0;
    const covers = (boxes, y, rightText, onlyPage) => boxes.some((entry) => {
      if (onlyPage && entry.page && entry.page !== onlyPage) return false;
      const box = entry.box;
      if (y < box.y + 0.004 || y > box.y + box.h - 0.004) return false;
      const rightEdge = (box.x || 0) + (box.w == null ? 1 : box.w);
      if (rightText && rightEdge < 0.55) return false;
      if (!rightText) return true;
      const masks = [];
      if (box.mask) masks.push(box.mask);
      (box.masks || []).forEach((mask) => masks.push(mask));
      return !masks.some((mask) => {
        if (mask.x > 0.5 || mask.x + mask.w < 0.85) return false;
        const top = box.y + mask.y * box.h;
        const bot = top + mask.h * box.h;
        return y >= top - 0.003 && y <= bot + 0.003;
      });
    });
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
      const sheet = JSON.parse(readFileSync(dir + file, 'utf8'));
      if (!sheet || !(sheet.grade >= 7) || !Array.isArray(sheet.questions)) continue;
      const info = scan[sheet.pdfId];
      if (!info) continue;
      const shortSlices = new Function('SOURCE', `${body} return shortSlices;`)(sheet);
      const byQ = new Map();
      sheet.questions.forEach((question) => {
        if (!byQ.has(question.q)) byQ.set(question.q, []);
        byQ.get(question.q).push(question);
      });
      const pageOf = (box, question) => (box && (box.page || question.page)) || question.page;
      const ruleBitmaps = new Map();
      const ruleBitmap = (pageNo, ruleYs) => {
        const key = String(pageNo);
        if (ruleBitmaps.has(key)) return ruleBitmaps.get(key);
        const width = 160;
        const height = 420;
        const data = new Uint8ClampedArray(width * height * 4);
        data.fill(255);
        (ruleYs || []).forEach((y) => {
          const py = Math.max(0, Math.min(height - 1, Math.round(Number(y) * height)));
          for (let x = Math.floor(width * 0.42); x < Math.floor(width * 0.92); x += 1) {
            const i = (py * width + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = 30;
          }
        });
        const bitmap = { width, height, getContext: () => ({ getImageData: () => ({ data }) }) };
        ruleBitmaps.set(key, bitmap);
        return bitmap;
      };
      const pointMasked = (box, masks, x, y) => (masks || []).some((mask) => {
        const top = box.y + mask.y * box.h;
        const bot = top + mask.h * box.h;
        if (y < top - 0.002 || y > bot + 0.002) return false;
        return x >= mask.x - 0.003 && x <= mask.x + mask.w + 0.003;
      });
      const guardFigures = (cropList, tag) => {
        const seen = new Set();
        cropList.forEach((entry) => {
          const pg = entry.page;
          if (!pg || seen.has(pg)) return;
          seen.add(pg);
          const pageInfo = (info.pages || {})[String(pg)] || {};
          const shapes = (pageInfo.shapes || []).map(([x0, x1, y0, y1]) => ({ x0, x1, y0, y1 }));
          const onPage = cropList.filter((crop) => (crop.page || pg) === pg);
          const included = shapes.map((shape, index) => ({ shape, index })).filter(({ shape }) => {
            const inCrop = onPage.some((crop) => crop.box.y <= shape.y0 + 0.01 && crop.box.y + crop.box.h >= shape.y1 - 0.01);
            if (!inCrop) return false;
            return onPage.some((crop) => (crop.figures || []).some((figure) => {
              const overlapX = Math.min(shape.x1, figure.x1) - Math.max(shape.x0, figure.x0);
              const overlapY = Math.min(shape.y1, figure.y1) - Math.max(shape.y0, figure.y0);
              return overlapX > 0.01 && overlapY > 0.012;
            }));
          });
          if (!included.length) return;
          const bitmap = ruleBitmap(pg, pageInfo.rules || []);
          const painted = onPage.map((crop) => {
            const figures = crop.figures || [];
            if (crop.box && crop.box.segment) return { box: crop.box, masks: [] };
            const rules = (pageInfo.rules || []).length ? cropApi.maskWritingRules(bitmap, crop.box, [[crop.box.y, crop.box.y + crop.box.h]]) : [];
            const masks = cropApi.carveMasks((crop.box.masks || []).concat(rules), crop.box, figures);
            return { box: crop.box, masks };
          });
          const visible = (x, y) => painted.some((crop) => {
            if (y <= crop.box.y + 0.002 || y >= crop.box.y + crop.box.h - 0.002) return false;
            const left = crop.box.x || 0;
            const right = left + (crop.box.w == null ? 1 : crop.box.w);
            if (x < left - 0.006 || x > right + 0.006) return false;
            return !pointMasked(crop.box, crop.masks, x, y);
          });
          const labelRows = cropApi.textRows((pageInfo.items || []).map(([str, x, y, w, h]) => ({ str, x, y, w, h })));
          included.forEach(({ shape }) => {
            onPage.forEach((crop) => {
              (crop.figures || []).forEach((figure) => {
                const overlapX = Math.min(shape.x1, figure.x1) - Math.max(shape.x0, figure.x0);
                const overlapY = Math.min(shape.y1, figure.y1) - Math.max(shape.y0, figure.y0);
                if (overlapX < 0.01 || overlapY < 0.012) return;
                (pageInfo.items || []).forEach((item) => {
                  const text = String(item[0] || '').trim();
                  if (!text || text.length > 14 || item[3] > 0.1) return;
                  if (/נועם|מתמטיקה|זכויות|עמוד/.test(text)) return;
                  const cx = item[1] + item[3] * 0.5;
                  const cy = item[2] + item[4] * 0.45;
                  const onSentence = labelRows.some((row) => Math.abs(row.y - item[2]) <= 0.008 && (row.w || 0) > 0.18 && (row.x || 0) + (row.w || 0) > figure.x1 + 0.04);
                  if (onSentence && cx > 0.34) return;
                  if (cx < figure.x0 - 0.02 || cx > figure.x1 + 0.02 || cy < figure.y0 - 0.016 || cy > figure.y1 + 0.016) return;
                  if (cy <= crop.box.y + 0.002 || cy >= crop.box.y + crop.box.h - 0.002) return;
                  if (!visible(cx, cy)) push('fig-text', `${file.slice(0, 8)} ${tag} "${text.slice(0, 16)}" y=${cy.toFixed(3)}`);
                });
              });
            });
          });
          (pageInfo.inks || []).forEach((sample) => {
            const shape = shapes[sample[2]];
            if (!shape) return;
            if (!included.some((one) => one.shape === shape)) return;
            const x = sample[0];
            const y = sample[1];
            const inFigure = onPage.some((crop) => (crop.figures || []).some((figure) => x >= figure.x0 - 0.01 && x <= figure.x1 + 0.01 && y >= figure.y0 - 0.01 && y <= figure.y1 + 0.01));
            if (!inFigure) return;
            if (!onPage.some((crop) => y > crop.box.y + 0.002 && y < crop.box.y + crop.box.h - 0.002)) return;
            if (!visible(x, y)) push('fig-ink', `${file.slice(0, 8)} ${tag} x=${x.toFixed(3)} y=${y.toFixed(3)}`);
          });
        });
      };
      Object.values(info.pages || {}).forEach((pageInfo) => {
        (pageInfo.items || []).forEach((item) => {
          if (item[1] < 0.75) return;
          const raw = String(item[0] || '');
          if (raw.includes('★')) styles.star += 1;
          const text = raw.replace(/★/g, '').trim();
          if (/^\(\d{1,2}\)$/.test(text) || /^\)\d{1,2}\($/.test(text)) styles.paren += 1;
          else if (/^\d{1,2}\.$/.test(text)) styles.dot += 1;
          else if (cropApi.questionNumberOf({ str: raw, x: item[1], y: item[2] }, (pageInfo.items || []).map(([str, x, y]) => ({ str, x, y })))) styles.bare += 1;
        });
      });
      for (const question of sheet.questions) {
        if (!question.row) continue;
        parts += 1;
        const watch = focusIds[sheet.pdfId] && focusIds[sheet.pdfId].indexOf(question.id) >= 0;
        const siblings = byQ.get(question.q) || [question];
        const tagged = siblings.some((item) => item.figure);
        const slices = shortSlices([question]).filter((slice) => {
          if (slice.kind !== 'stem' && slice.kind !== 'row') return false;
          const box = slice.box;
          // The printer drops the running בס״ד row. It is not a piece of the question.
          if (box && box.y < 0.05 && box.y + box.h < 0.075) return false;
          return true;
        });
        const groups = [];
        slices.forEach((slice) => {
          const last = groups[groups.length - 1];
          if (last && last.page === slice.page) last.slices.push(slice);
          else groups.push({ page: slice.page, slices: [slice] });
        });
        const crops = [];
        const pageFigures = new Map();
        groups.forEach((group) => {
          const page = group.page;
          const pageInfo = (info.pages && info.pages[String(page)]) || { figures: [], labels: [] };
          const figures = (pageInfo.figures || []).map(([x0, x1, y0, y1]) => ({ x0, x1, y0, y1 }));
          const labels = (pageInfo.labels || []).map(([part, y]) => ({ part, y }));
          const pageItems = (pageInfo.items || []).map(([str, x, y, w, h]) => ({ str, x, y, w, h }));
          const rows = cropApi.textRows(pageItems);
          const marks = cropApi.questionMarks(pageItems);
          pageFigures.set(page, figures);
          const onPage = siblings.filter((item) => item.row && pageOf(item.row, item) === page);
          onPage.forEach((part) => {
            const fig = part.figure;
            if (!fig || !(fig.x1 > fig.x0) || !(fig.y1 > fig.y0)) return;
            const dup = figures.some((have) => {
              const overlapX = Math.min(have.x1, fig.x1) - Math.max(have.x0, fig.x0);
              const overlapY = Math.min(have.y1, fig.y1) - Math.max(have.y0, fig.y0);
              return overlapX > 0.015 && overlapY > 0.015;
            });
            if (!dup) figures.push({ x0: fig.x0, x1: fig.x1, y0: fig.y0, y1: fig.y1 });
          });
          if (!onPage.length) {
            group.slices.forEach((slice) => crops.push(slice));
            return;
          }
          const picked = [];
          group.slices.forEach((slice) => {
            if (slice.kind === 'stem') return;
            if (slice.partId) {
              if (picked.indexOf(slice.partId) < 0) picked.push(slice.partId);
              return;
            }
            let best = null;
            onPage.forEach((part) => {
              const label = part.labelLine && pageOf(part.labelLine, part) === page ? part.labelLine.y : part.row.y;
              if (label < slice.box.y - 0.008 || label > slice.box.y + slice.box.h - 0.012) return;
              if (!best || label > best.label) best = { id: part.id, label };
            });
            if (best && picked.indexOf(best.id) < 0) picked.push(best.id);
          });
          const earlier = sheet.questions.filter((item) => item && item.q < question.q && item.row && pageOf(item.row, item) === page);
          const earlierEnd = earlier.reduce((max, item) => Math.max(max, item.row.y + item.row.h), 0);
          const swallowed = earlier.length && group.slices.some((slice) => earlier.some((item) => {
            const y = item.labelLine ? item.labelLine.y : item.row.y;
            return slice.box.y + 0.012 < y && y < slice.box.y + slice.box.h - 0.012;
          }));
          const first = onPage.slice().sort((a, b) => a.row.y - b.row.y)[0];
          const laterPick = picked.some((id) => id !== first.id);
          let nextStart = 0.98;
          sheet.questions.forEach((item) => {
            if (!item || item.q <= question.q || !item.row || pageOf(item.row, item) !== page) return;
            if (item.row.y > 0.02 && item.row.y < nextStart) nextStart = item.row.y;
          });
          let spanTop = 1;
          let spanBot = 0;
          onPage.forEach((part) => {
            if (part.stem && (part.stem.page || part.page) === page) spanTop = Math.min(spanTop, part.stem.y);
            spanTop = Math.min(spanTop, part.row.y);
            spanBot = Math.max(spanBot, part.row.y + part.row.h);
          });
          let questionMark = null;
          marks.forEach((mark) => {
            if (mark.n !== question.q) return;
            if (mark.y < spanTop - 0.3 || mark.y > spanBot + 0.04) return;
            if (!questionMark || mark.y < questionMark.y) questionMark = mark;
          });
          let nextMark = null;
          marks.forEach((mark) => {
            const after = questionMark ? questionMark.y + 0.015 : spanTop + 0.02;
            if (mark.y < after) return;
            if (!nextMark || mark.y < nextMark.y) nextMark = mark;
          });
          const questionBot = nextMark ? nextMark.y - 0.004 : (nextStart > spanTop + 0.02 && nextStart < 0.98 ? nextStart - 0.008 : null);
          const header = sheet.headerCrop;
          const headerBottom = header && Number(header.page) === Number(page) ? (header.y || 0) + (header.h || 0) : 0;
          const relevant = figures.filter((figure) => {
            if (cropApi.figureIsSentence(figure, rows)) return false;
            const center = (figure.y0 + figure.y1) / 2;
            if (questionBot != null && center >= questionBot) return false;
            if (center < spanTop - 0.02 || center > spanBot + 0.02) return false;
            if (center >= nextStart - 0.004) return false;
            if (center >= earlierEnd - 0.008) return true;
            return swallowed && group.slices.some((slice) => slice.box.y < center && center < slice.box.y + slice.box.h);
          }).map((figure) => {
            const above = questionMark && figure.y1 < questionMark.y - 0.01;
            const beside = questionBot != null && figure.y0 < questionBot - 0.01 && figure.y1 > questionBot + 0.006;
            const y1 = questionBot != null && !beside && !above ? Math.min(figure.y1, questionBot) : figure.y1;
            const clipY = !above && !beside && questionMark ? Math.max(figure.y0, questionMark.y - 0.002) : figure.y0;
            const tail = !above && !beside && questionMark && figure.y0 < questionMark.y - 0.02 && (y1 - clipY) < (figure.y1 - figure.y0) * 0.45;
            return tail ? null : { ...figure, y0: figure.y0, y1 };
          }).filter((figure) => figure && figure.y1 - figure.y0 >= 0.02);
          const own = relevant.filter((figure) => (figure.y0 + figure.y1) / 2 >= earlierEnd - 0.008);
          const uncovered = laterPick && own.some((figure) => !group.slices.some((slice) => {
            const box = slice.box;
            return box.y <= figure.y0 + 0.006 && box.y + box.h >= figure.y1 - 0.006;
          }));
          const numberIn = questionMark && group.slices.some((slice) => {
            const box = slice.box;
            return box.y <= questionMark.y + 0.004 && box.y + box.h >= questionMark.y + (questionMark.h || 0.012) - 0.004;
          });
          const polishSlice = (slice) => {
            if (!pageItems.length) return slice;
            const polished = cropApi.polishQuestionSlice({
              slice: { kind: slice.kind || 'row', block: 'q' + question.q, page, box: slice.box, figures: slice.figures || relevant },
              bitmap: null,
            }, pageItems);
            return { ...slice, box: polished.slice.box, figures: slice.figures || relevant };
          };
          if (!picked.length) {
            group.slices.forEach((slice) => crops.push(polishSlice(slice)));
            return;
          }
          rebuilt += 1;
          const boxes = layoutQuestionCrops({
            page,
            parts: onPage,
            picked,
            labels,
            figures: relevant,
            rows,
            items: pageItems,
            questionTop: questionMark ? questionMark.y - 0.006 : null,
            questionBot,
            earlierEnd,
            headerBottom,
          });
          if (!boxes.length) group.slices.forEach((slice) => crops.push(polishSlice(slice)));
          else boxes.forEach((entry) => crops.push(polishSlice(entry)));
          if (swallowed) {
            const early = boxes.filter((entry) => entry.box.y + entry.box.h < earlierEnd - 0.008);
            early.forEach((entry) => {
              if (entry.box.segment === 'figure' && (entry.box.x || 0) + (entry.box.w == null ? 1 : entry.box.w) < 0.55) return;
              const drawn = relevant.filter((figure) => figure.y1 > entry.box.y + 0.01 && figure.y0 < entry.box.y + entry.box.h - 0.01);
              const drawnH = drawn.reduce((max, figure) => Math.max(max, figure.y1 - figure.y0), 0);
              if (entry.box.h > drawnH + 0.05) push('gap', `${file.slice(0, 8)} ${question.id} h=${entry.box.h.toFixed(3)} drawn=${drawnH.toFixed(3)}`);
            });
            earlier.forEach((item) => {
              const y = (item.labelLine ? item.labelLine.y : item.row.y) + 0.01;
              if (covers(boxes, y, true)) push('foreign', `${file.slice(0, 8)} ${question.id} shows ${item.id}`);
            });
          }
          if (question.id === siblings[0].id && onPage.length >= 3) {
            const pair = [onPage[0].id, onPage[onPage.length - 1].id];
            const multiBoxes = layoutQuestionCrops({
              page,
              parts: onPage,
              picked: pair,
              labels,
              figures: relevant,
              rows,
              items: pageItems,
              questionTop: questionMark ? questionMark.y - 0.006 : null,
              questionBot,
              earlierEnd,
              headerBottom,
            });
            const multiCrops = (multiBoxes.length ? multiBoxes : group.slices).map((entry) => polishSlice(entry));
            guardFigures(multiCrops, question.id + '+');
          }
        });
        guardFigures(crops, question.id);
        const page = pageOf(question.row, question);
        const line = question.line > 0 ? question.line : 0.026;
        const stem = question.stem;
        if (stem && stem.h >= line * 0.5 && pageOf(stem, question) === page) {
          const earlier = sheet.questions.filter((item) => item && item.q < question.q && item.row && pageOf(item.row, item) === page);
          const earlierEnd = earlier.reduce((max, item) => Math.max(max, item.row.y + item.row.h), 0);
          let y = stem.y + Math.min(stem.h * 0.4, 0.015);
          if (earlierEnd > stem.y + 0.01 && earlierEnd < stem.y + stem.h - 0.01) y = Math.min(stem.y + stem.h - 0.008, earlierEnd + 0.012);
          if (!covers(crops, y, true, page)) push('stem', `${file.slice(0, 8)} ${question.id} y=${y.toFixed(3)} crops=${crops.map((c) => c.box.y.toFixed(2) + '+' + c.box.h.toFixed(2)).join(',')}`);
        }
        const labelY = question.labelLine && pageOf(question.labelLine, question) === page ? question.labelLine.y : question.row.y;
        const marks = (((info.pages || {})[String(page)] || {}).labels || []).filter((mark) => mark[0] === question.part);
        let realLabel = labelY;
        marks.forEach((mark) => {
          if (Math.abs(mark[1] - labelY) < Math.abs(realLabel - labelY)) realLabel = mark[1];
        });
        if (question.part && !covers(crops, realLabel + 0.004, true, page)) push('label', `${file.slice(0, 8)} ${question.id} y=${realLabel.toFixed(3)}`);
        const figures = pageFigures.get(page) || [];
        const figureItems = (((info.pages || {})[String(page)] || {}).items || []).map(([str, x, y, w, h]) => ({ str, x, y, w, h }));
        const figureRows = cropApi.textRows(figureItems);
        const earlier = sheet.questions.filter((item) => item && item.q < question.q && item.row && pageOf(item.row, item) === page);
        const earlierEnd = earlier.reduce((max, item) => Math.max(max, item.row.y + item.row.h), 0);
        let nextStart = 0.98;
        sheet.questions.forEach((item) => {
          if (!item || item.q <= question.q) return;
          const row = item.row && pageOf(item.row, item) === page ? item.row.y : null;
          if (row != null && row < nextStart) nextStart = row;
        });
        let spanTop = question.row.y;
        let spanBot = question.row.y + question.row.h;
        siblings.forEach((item) => {
          if (item.stem && pageOf(item.stem, item) === page) spanTop = Math.min(spanTop, item.stem.y);
          if (item.row && pageOf(item.row, item) === page) {
            spanTop = Math.min(spanTop, item.row.y);
            spanBot = Math.max(spanBot, item.row.y + item.row.h);
          }
        });
        const ownTop = Math.max(spanTop, earlierEnd > spanTop ? earlierEnd : spanTop);
        const header = sheet.headerCrop;
        const headerBottom = header && Number(header.page) === Number(page) ? (header.y || 0) + (header.h || 0) : 0;
        const numberMarks = cropApi.questionMarks(figureItems);
        let questionNumber = null;
        numberMarks.forEach((mark) => {
          if (mark.n !== question.q) return;
          if (mark.y < spanTop - 0.3 || mark.y > spanBot + 0.05) return;
          if (!questionNumber || mark.y < questionNumber.y) questionNumber = mark;
        });
        figures.forEach((figure) => {
          if (cropApi.figureIsSentence(figure, figureRows)) return;
          // A logo inside the title block, or a drawing that ends before this question's number, is not this question's figure.
          if (headerBottom && figure.y1 < headerBottom + 0.008) return;
          if (questionNumber && figure.y1 < questionNumber.y - 0.012) return;
          const center = (figure.y0 + figure.y1) / 2;
          if (center < ownTop - 0.008 || center > spanBot + 0.008) return;
          if (center > nextStart - 0.008) return;
          withFigure += 1;
          const y0 = Math.max(figure.y0 + 0.006, ownTop + 0.004);
          const y1 = Math.min(figure.y1 - 0.006, spanBot - 0.004);
          const topIn = covers(crops, y0, false, page);
          const midIn = covers(crops, Math.min(Math.max(center, y0), y1), false, page);
          const botIn = y1 - y0 < 0.012 ? true : covers(crops, y1, false, page);
          const laterFigure = siblings[0] && question.id !== siblings.slice().sort((a, b) => a.row.y - b.row.y)[0].id && center < question.row.y - 0.01;
          if (laterFigure && (!topIn || !midIn)) push('later-figure', `${file.slice(0, 8)} ${question.id} fig=${figure.y0.toFixed(3)}-${figure.y1.toFixed(3)} top=${topIn} mid=${midIn} bot=${botIn}`);
          else if (!topIn || !midIn || !botIn) push('figure', `${file.slice(0, 8)} ${question.id} fig=${figure.y0.toFixed(3)}-${figure.y1.toFixed(3)} need=${y0.toFixed(3)}-${y1.toFixed(3)} top=${topIn} mid=${midIn} bot=${botIn}`);
        });
        if (tagged && question.figure && question.page === page) {
          const figure = question.figure;
          const center = (figure.y0 + figure.y1) / 2;
          if (!covers(crops, center, false, page)) push('tagged', `${file.slice(0, 8)} ${question.id}`);
        }
        const orderedSiblings = siblings.filter((item) => item.row && pageOf(item.row, item) === page).slice().sort((a, b) => a.row.y - b.row.y);
        const firstPart = orderedSiblings[0];
        if (firstPart && question.id !== firstPart.id && question.part) {
          const textPage = (info.pages || {})[String(page)] || { items: [], labels: [] };
          const pageItems = (textPage.items || []).map(([str, x, y, w, h]) => ({ str, x, y, w, h }));
          const numberMarks = cropApi.questionMarks(pageItems);
          let mine = null;
          numberMarks.forEach((mark) => {
            if (mark.n !== question.q) return;
            if (mark.y < spanTop - 0.3 || mark.y > spanBot + 0.05) return;
            if (!mine || mark.y < mine.y) mine = mark;
          });
          let nextNumber = null;
          numberMarks.forEach((mark) => {
            if (!mine || mark.y < mine.y + 0.015) return;
            if (!nextNumber || mark.y < nextNumber.y) nextNumber = mark;
          });
          const shownAt = (x, y) => crops.some((entry) => {
            if (entry.page && entry.page !== page) return false;
            const box = entry.box;
            if (y < box.y + 0.002 || y > box.y + box.h - 0.002) return false;
            const leftEdge = box.x || 0;
            const rightEdge = leftEdge + (box.w == null ? 1 : box.w);
            if (x < leftEdge - 0.012 || x > rightEdge + 0.012) return false;
            const masks = [];
            if (box.mask) masks.push(box.mask);
            (box.masks || []).forEach((mask) => masks.push(mask));
            return !masks.some((mask) => {
              const top = box.y + mask.y * box.h;
              const bot = top + mask.h * box.h;
              if (y < top - 0.003 || y > bot + 0.003) return false;
              return x >= mask.x - 0.012 && x <= mask.x + mask.w + 0.012;
            });
          });
          const partYs = (textPage.labels || []).map((mark) => mark[1]).filter((y) => mine && y > mine.y + 0.008).sort((a, b) => a - b);
          const partLine = cropApi.textRows(pageItems)
            .filter((row) => cropApi.rowPart(row.text) && row.x + row.w > 0.8 && mine && row.y > mine.y + 0.012)
            .sort((a, b) => a.y - b.y)[0];
          const stemBot = partLine ? partLine.y : (partYs.length ? partYs[0] : (firstPart.labelLine ? firstPart.labelLine.y : firstPart.row.y));
          // "3. א. …" is the first part, not a stem the later parts must reprint.
          const firstOnNumber = mine && (textPage.labels || []).some((mark) => mark[0] === firstPart.part && Math.abs(mark[1] - mine.y) <= 0.012);
          const stemItems = pageItems.filter((item) => {
            const text = String(item.str || '').trim();
            if (text.length < 3 || firstOnNumber) return false;
            if (mine && Math.abs(item.y - mine.y) <= 0.012 && item.x < mine.x - 0.02) return true;
            if (mine && item.y > mine.y + 0.004 && item.y < stemBot - 0.004 && item.x > 0.35) return true;
            return false;
          });
          if (mine && stemItems.length && !stemItems.some((item) => shownAt(Math.min(item.x + item.w * 0.55, item.x + item.w - 0.01), item.y + item.h * 0.45))) {
            push('stem-text', `${file.slice(0, 8)} ${question.id} missing "${String(stemItems[0].str).slice(0, 24)}"`);
          }
          const labelTop = question.labelLine && pageOf(question.labelLine, question) === page ? question.labelLine.y : question.row.y;
          const ownTopY = Math.min(question.row.y, labelTop) - 0.006;
          const ownBotY = question.row.y + question.row.h + 0.008;
          pageItems.forEach((item) => {
            const text = String(item.str || '').trim();
            const numberToken = /^\(\d{1,2}\)$/.test(text) || /^\)\d{1,2}\($/.test(text) || /^\d{1,2}\.$/.test(text);
            if (text.length < 4 && !numberToken) return;
            // A short label inside the drawing is not another part's sentence.
            if (!numberToken && item.x + (item.w || 0) < 0.42) return;
            if (/נועם|מתמטיקה|בס״ד|בס\"ד|זכויות|עמוד|בהצלחה/.test(text)) return;
            const mid = item.y + (item.h || 0.012) * 0.45;
            if (mine && mid >= mine.y - 0.008 && mid < stemBot) return;
            if (mid >= ownTopY && mid < ownBotY) return;
            const left = item.x + Math.min(0.012, (item.w || 0.02) * 0.25);
            const host = (pageFigures.get(page) || []).find((figure) => left >= figure.x0 - 0.028 && left <= figure.x1 + 0.028 && mid >= figure.y0 - 0.02 && mid <= figure.y1 + 0.02);
            const past = host ? host.x1 + 0.04 : left;
            const leaked = host ? item.x + (item.w || 0) > past + 0.008 && shownAt(past, mid) : shownAt(left, mid);
            if (leaked) push('leak', `${file.slice(0, 8)} ${question.id} shows "${text.slice(0, 28)}" y=${mid.toFixed(3)}`);
          });
        }
        const spanInside = (box, item) => {
          const left = box.x || 0;
          const right = left + (box.w == null ? 1 : box.w);
          return item.y >= box.y - 0.008 && item.y + (item.h || 0) <= box.y + box.h + 0.01
            && item.x >= left - 0.01 && item.x + (item.w || 0) <= right + 0.012;
        };
        const pointIn = (x, y) => crops.some((crop) => {
          if (crop.page && crop.page !== page) return false;
          const box = crop.box;
          const left = box.x || 0;
          const right = left + (box.w == null ? 1 : box.w);
          return y >= box.y - 0.004 && y <= box.y + box.h + 0.004 && x >= left - 0.01 && x <= right + 0.01;
        });
        crops.forEach((crop) => {
          const figure = crop.box && crop.box.figure;
          if (!figure || crop.box.segment !== 'figure' || (crop.page && crop.page !== page)) return;
          figureItems.forEach((item) => {
            const text = String(item.str || '').trim();
            if (!text || text.length > 14 || (item.w || 0) > 0.12) return;
            if (/נועם|מתמטיקה|זכויות|עמוד|פרק|בהצלחה/.test(text)) return;
            const onSentence = figureRows.some((row) => Math.abs(row.y - item.y) <= 0.008 && (row.w || 0) > 0.18 && (row.x || 0) + (row.w || 0) > figure.x1 + 0.04);
            if (onSentence) return;
            const cx = item.x + (item.w || 0) * 0.5;
            const cy = item.y + Math.max(item.h || 0.012, 0.008) * 0.45;
            if (cx < figure.x0 - 0.022 || cx > figure.x1 + 0.022 || cy < figure.y0 - 0.022 || cy > figure.y1 + 0.022) return;
            // The crop stops at the next question. A label of that question is not missing from this one.
            if (cy > crop.box.y + crop.box.h + 0.004) return;
            if (!spanInside(crop.box, item)) push('fig-span', `${file.slice(0, 8)} ${question.id} "${text.slice(0, 12)}" y=${cy.toFixed(3)}`);
          });
        });
        if (question.part) {
          figureItems.forEach((item) => {
            if (Math.abs(item.y - realLabel) > 0.01) return;
            const text = String(item.str || '').trim();
            if (!text || (item.x || 0) < 0.32) return;
            if (headerBottom && item.y < headerBottom - 0.004) return;
            if (questionNumber && item.y < questionNumber.y - 0.008) return;
            if (/נועם|מתמטיקה|רמת מצוינות|רמה\s*[אב]/.test(text)) return;
            // A one-letter axis mark in the drawing column is a figure label, not the part sentence.
            if (text.length <= 2 && (item.x || 0) + (item.w || 0) < 0.42 && !cropApi.rowPart(text)) return;
            if (!crops.some((crop) => (!crop.page || crop.page === page) && spanInside(crop.box, item))) {
              push('part-line', `${file.slice(0, 8)} ${question.id} "${text.slice(0, 18)}" x=${Number(item.x).toFixed(3)}`);
            }
          });
        }
        const pageMarks = cropApi.questionMarks(figureItems);
        figureItems.forEach((item) => {
          const text = String(item.str || '');
          if (/(?:^|[\s·•])פרק\s*[אבגדהו]\s*[׳'״"]/.test(text)) {
            const cx = item.x + (item.w || 0) * 0.5;
            const cy = item.y + (item.h || 0.012) * 0.45;
            if (pointIn(cx, cy)) push('header', `${file.slice(0, 8)} ${question.id} "${text.slice(0, 24)}"`);
          }
          const n = cropApi.questionNumberOf(item, figureItems);
          if (n == null || n === question.q) return;
          // (1) (2) (3) of a worked example sit left of the real question numbers.
          const onMargin = pageMarks.some((mark) => mark.n === n && Math.abs(mark.y - item.y) < 0.01 && Math.abs(mark.x - (item.x || 0)) < 0.02);
          if (!onMargin) return;
          if (pointIn(item.x + (item.w || 0) * 0.5, item.y + (item.h || 0.012) * 0.45)) push('other-q', `${file.slice(0, 8)} ${question.id} shows ${n}`);
        });
        if (watch) {
          watched.push({
            id: sheet.pdfId.slice(0, 8) + ' ' + question.id,
            crops: crops.map((entry) => ({
              x: Math.round((entry.box.x || 0) * 1000) / 1000,
              y: Math.round(entry.box.y * 1000) / 1000,
              w: Math.round((entry.box.w == null ? 1 : entry.box.w) * 1000) / 1000,
              h: Math.round(entry.box.h * 1000) / 1000,
              segment: entry.box.segment || '',
              masks: (entry.box.masks || []).length,
            })),
          });
        }
        const pages = (info.answers || []).map((sheetPage) => {
          const title = (sheetPage.items || []).find((item) => String(item[0]).includes('תשובות סופיות'));
          if (!title) return sheetPage;
          return { ...sheetPage, items: sheetPage.items.filter((item) => item[2] <= title[2] + 12) };
        });
        if (pages.length && question.part) {
          const items = [];
          pages.forEach((sheetPage) => {
            (sheetPage.items || []).forEach((item) => {
              items.push({ str: item[0], x: item[1], y: item[2], w: item[3], h: item[4], page: sheetPage.page });
            });
          });
          // answerBox searches one page's items. Try each page via a combined list only if markers share pages.
          let raw = null;
          for (const sheetPage of pages) {
            const pageItems = (sheetPage.items || []).map((item) => ({ str: item[0], x: item[1], y: item[2], w: item[3], h: item[4], page: sheetPage.page }));
            raw = answerBox(pageItems, question.q, question.part);
            if (raw) break;
          }
          if (raw) {
            answers += 1;
            const pageItems = items.filter((item) => item.page === raw.page);
            const labelItem = pageItems.find((item) => new RegExp('(?:^|[·•\\s])' + question.part + '\\.').test(String(item.str || '')) && Math.abs((item.y || 0) - (raw.slot ? raw.slot.lineBottom + 1 : raw.y + raw.h - 14)) < 18);
            const labelY = labelItem ? labelItem.y : (raw.slot ? raw.slot.lineBottom + 1 : null);
            if (labelY != null) {
              const markerToken = (text) => /^\d{1,2}\.$/.test(text) || /^\(\d{1,2}\)$/.test(text) || /^\)\d{1,2}\($/.test(text);
              const nextMark = pageItems
                .filter((item) => item.y < labelY - 8 && (item.x || 0) > 360 && markerToken(String(item.str || '').trim()))
                .sort((a, b) => b.y - a.y)[0];
              const floor = Math.max(nextMark ? nextMark.y + (nextMark.h || 10) + 2 : labelY - 16, labelY - 16);
              const more = pageItems.filter((item) => {
                if ((item.h || 0) > 28) return false;
                if (item.y > labelY - 8 || item.y < floor) return false;
                const token = String(item.str || '').trim();
                if (!token || token.length < 3) return false;
                if (/נועם|מתמטיקה|בס״ד|בס\"ד|זכויות|עמוד|תשובות/.test(token)) return false;
                if (/^[אבגדהו]\./.test(token)) return false;
                if (/^[אבגדהו]\.?$/.test(token) || /^\d{1,2}\.$/.test(token) || /^\(\d{1,2}\)$/.test(token)) return false;
                if (/[·•]\s*[אבגדהו]/.test(token)) return false;
                return true;
              });
              const onLabel = pageItems.filter((item) => Math.abs(item.y - labelY) <= 6 && (item.h || 0) < 28);
              const labelWords = onLabel.map((item) => String(item.str || '')).join(' ').replace(/[·•]/g, ' ').split(/\s+/).filter((word) => word && !/^[אבגדהו]\.?$/.test(word) && word !== '.' && !/^\d{1,2}\.$/.test(word));
              const words = more.map((item) => item.str).join(' ').split(/\s+/).filter((word) => word && word !== '·').length;
              if (labelWords.length <= 2 && words > 2) {
                const missed = more.filter((item) => {
                  const cy = item.y + (item.h || 0) / 2;
                  const cx = item.x + Math.min(item.w || 0, 40) / 2;
                  return !(cx >= raw.x - 4 && cx <= raw.x + raw.w + 4 && cy >= raw.y - 3 && cy <= raw.y + raw.h + 3);
                });
                if (missed.length) push('answer', `${file.slice(0, 8)} q${question.q}${question.part} misses "${missed[0].str.slice(0, 30)}" words=${words}`);
              }
            }
          }
        }
      }
    }

    const ofKind = (kind: string) => failures.filter((line) => line.startsWith(kind)).join('\n');
    assert.equal(counts['later-figure'] || 0, 0, ofKind('later-figure'));
    assert.equal(counts.answer || 0, 0, ofKind('answer'));
    assert.equal(counts.gap || 0, 0, ofKind('gap'));
    assert.equal(counts.foreign || 0, 0, ofKind('foreign'));
    assert.equal(counts.leak || 0, 0, JSON.stringify(counts) + '\n' + ofKind('leak') + '\n' + ofKind('stem-text') + '\n' + ofKind('part-line'));
    assert.equal(counts['stem-text'] || 0, 0, ofKind('stem-text') + '\n' + ofKind('part-line'));
    assert.equal(counts['fig-text'] || 0, 0, ofKind('fig-text'));
    assert.equal(counts['fig-ink'] || 0, 0, ofKind('fig-ink'));
    assert.equal(counts['fig-span'] || 0, 0, ofKind('fig-span'));
    assert.equal(counts['part-line'] || 0, 0, ofKind('part-line'));
    assert.equal(counts.header || 0, 0, ofKind('header'));
    assert.equal(counts['other-q'] || 0, 0, ofKind('other-q'));
    assert.ok(styles.paren > 500, 'question numbers (N) ' + JSON.stringify(styles));
    assert.ok(styles.dot > 100, 'question numbers N. ' + JSON.stringify(styles));
    assert.ok(parts > 20000, String(parts));
    assert.ok(rebuilt > 1000, String(rebuilt));
    assert.ok(answers > 20000, String(answers));
    assert.ok(withFigure > 5000, String(withFigure));
    const found = Object.fromEntries(watched.map((item) => [item.id, item.crops]));
    const rhombus = found['e091562d 14ב'];
    assert.ok(rhombus && rhombus.some((crop) => crop.y < 0.15 && crop.y + crop.h > 0.2 && crop.h < 0.2), JSON.stringify(rhombus));
    assert.ok(rhombus.some((crop) => crop.y > 0.26 && crop.y < 0.32 && crop.h > 0.04));
    const similarity = found['831390f8 4א'];
    assert.ok(similarity && similarity.every((crop) => crop.y > 0.7), JSON.stringify(similarity));
    assert.ok(similarity.some((crop) => crop.y < 0.86 && crop.y + crop.h > 0.88), JSON.stringify(similarity));
    assert.ok(similarity.some((crop) => crop.y > 0.75 && crop.y < 0.86));
    assert.equal(similarity.some((crop) => crop.y < 0.6 && crop.h > 0.25), false, JSON.stringify(similarity));
    const gimel = found['882bc55c 16ג'];
    assert.ok(gimel && gimel.some((crop) => crop.y < 0.2 && crop.y + crop.h > 0.26), JSON.stringify(gimel));
    assert.ok(gimel.some((crop) => crop.y > 0.4 && crop.y < 0.45));
    const dalet = found['b7a76fde 19ד'];
    assert.ok(dalet && dalet.some((crop) => crop.y < 0.08 && crop.y + crop.h > 0.27), JSON.stringify(dalet));
    assert.ok(dalet.every((crop) => crop.segment !== 'figure' || crop.x + crop.w < 0.36), JSON.stringify(dalet));
    const daletSheet = scan.b7a76fde760d4c2e9252a933ed40a6c5;
    let daletBox: { h: number; w: number; slot?: { lineBottom: number } } | null = null;
    (daletSheet.answers || []).forEach((sheetPage) => {
      const title = (sheetPage.items || []).find((item) => String(item[0]).includes('תשובות סופיות'));
      const kept = title ? sheetPage.items.filter((item) => item[2] <= title[2] + 12) : sheetPage.items;
      const pageItems = kept.map((item) => ({ str: item[0], x: item[1], y: item[2], w: item[3], h: item[4], page: sheetPage.page }));
      const raw = answerBox(pageItems, 19, 'ד');
      if (raw && raw.slot) daletBox = raw;
    });
    assert.ok(daletBox && daletBox.slot && daletBox.h > 24 && daletBox.w > 200, JSON.stringify(daletBox));
    const answerPages = (daletSheet.answers || []).map((sheetPage) => ({
      page: sheetPage.page,
      width: sheetPage.w || 595,
      height: sheetPage.h || 842,
      items: (sheetPage.items || []).map((item) => ({ str: item[0], x: item[1], y: item[2], w: item[3], h: item[4], page: sheetPage.page })),
    }));
    const daletSlice = answerSliceFor(answerPages, { q: 19, part: 'ד' });
    assert.ok(daletSlice && daletSlice.box.x >= 24 / (answerPages[0] ? answerPages[0].width : 595) - 0.002, JSON.stringify(daletSlice));
    assert.ok(daletSlice && daletSlice.box.x < 0.12 && daletSlice.box.x + daletSlice.box.w > 0.7, JSON.stringify(daletSlice));
    const areas = found['9c95b48e 9ד'];
    assert.ok(areas && areas.some((crop) => crop.y < 0.21 && crop.y + crop.h > 0.205), JSON.stringify(areas));
    assert.ok(areas.some((crop) => crop.y > 0.3 && crop.y < 0.33));
    assert.equal(areas.some((crop) => crop.x < 0.28 && crop.y < 0.22 && crop.y + crop.h > 0.19), false, JSON.stringify(areas));
    const pythagorasHeader = found['050b9cc2 1א'];
    assert.ok(pythagorasHeader && pythagorasHeader.length && pythagorasHeader.every((crop) => crop.y >= 0.27), JSON.stringify(pythagorasHeader));
    const house = found['871fe90d 8ד'];
    assert.ok(house && house.some((crop) => crop.segment === 'figure' && crop.y + crop.h > 0.26), JSON.stringify(house));
    const onlyBet = found['f4e2bea0 3ב'];
    assert.ok(onlyBet && onlyBet.every((crop) => crop.y > 0.07 || crop.w < 0.12), JSON.stringify(onlyBet));
    const prism = found['4bd841f8 11ב'];
    assert.ok(prism && prism.some((crop) => crop.segment === 'stem' && crop.x < 0.12 && crop.x + crop.w > 0.5), JSON.stringify(prism));
    const closing = found['fe59996f 20ד'];
    // The stem sits mid-page on the previous page. The part is one line, and בהצלחה stays out.
    assert.ok(closing && closing.every((crop) => crop.h < 0.2), JSON.stringify(closing));
    assert.ok(closing.some((crop) => crop.segment === 'part' && crop.h < 0.08 && crop.y + crop.h < 0.14), JSON.stringify(closing));
    assert.equal(closing.some((crop) => crop.y < 0.2 && crop.y + crop.h > 0.14), false, JSON.stringify(closing));
    const expressions = found['adef6cf4 16ב'];
    assert.ok(expressions && expressions.every((crop) => crop.y + crop.h < 0.42), JSON.stringify(expressions));
    const data = found['12997624 15ב'];
    assert.ok(data && data.every((crop) => crop.y > 0.08) && data.every((crop) => crop.y > 0.2 || crop.y + crop.h < 0.3), JSON.stringify(data));
    const margin = found['5acb7851 14ב'];
    assert.ok(margin && margin.some((crop) => crop.y < 0.66 && crop.y + crop.h < 0.682 && crop.y + crop.h > 0.66), JSON.stringify(margin));
  });

  it('keeps every middle-school drawing inside the crop that owns it', (t) => {
    const probe = spawnSync('python3', ['-c', 'import pymupdf, numpy'], { encoding: 'utf8' });
    const pdfDir = '/tmp/sheets';
    if (probe.status !== 0 || !existsSync(`${pdfDir}/cffd33bdee5e402bac3150c0e5ff7922.pdf`)) {
      t.skip('worksheet pdfs or pymupdf are not available');
      return;
    }
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const extendDrawingBox = new Function(`${preview.slice(preview.indexOf('function sliceInkRows'), preview.indexOf('async function measureWorksheet'))} return extendDrawingBox;`)() as (
      bitmap: { width: number; height: number; getContext: () => { getImageData: () => { data: Uint8ClampedArray } } },
      box: { y: number; h: number },
      limitY: number,
    ) => number | null;
    const script = fileURLToPath(new URL('../scripts/measure-label-gaps.py', import.meta.url));
    const sheets = fileURLToPath(new URL('../public/teachers/sheets/', import.meta.url));
    const scan = spawnSync('python3', ['-'], {
      input: `
import json, math, os
from pathlib import Path
import numpy as np, pymupdf, importlib.util
spec = importlib.util.spec_from_file_location('gaps', ${JSON.stringify(script)})
gaps = importlib.util.module_from_spec(spec); spec.loader.exec_module(gaps)
sheets = Path(${JSON.stringify(sheets)})
pdfs = Path(${JSON.stringify(pdfDir)})
out = Path('/tmp/draw-crop-cases')
out.mkdir(exist_ok=True)
scale = 1100 / 595.276
cases = []
scanned = 0
for path in sorted(sheets.glob('*.json')):
    data = json.loads(path.read_text())
    if (data.get('grade') or 0) < 7: continue
    pdf = pdfs / f"{data.get('pdfId')}.pdf"
    if not pdf.exists(): continue
    scanned += 1
    doc = pymupdf.open(pdf)
    by_page = {}
    for q in data.get('questions') or []:
        by_page.setdefault(q.get('page'), []).append(q)
    cache = {}
    for page_no, qs in by_page.items():
        if not isinstance(page_no, int) or page_no < 1 or page_no > doc.page_count: continue
        groups = {}
        for q in qs: groups.setdefault(q.get('q'), []).append(q)
        page = doc[page_no - 1]
        figures = gaps.page_figures(page)
        for parts in groups.values():
            parts.sort(key=lambda item: (item.get('row') or {}).get('y') or 0)
            last = parts[-1]
            row = last.get('row') or {}
            if 'y' not in row or 'h' not in row: continue
            end = row['y'] + row['h']
            limit = 0.945
            for other in qs:
                if other is last: continue
                for key in ('row', 'stem'):
                    y = (other.get(key) or {}).get('y')
                    if isinstance(y, (int, float)) and y >= end - 0.008 and y < limit: limit = y
            owned = []
            for fig in figures:
                x0, y0, x1, y1 = fig
                if x1 > 0.42 or (x1 - x0) < 0.06 or (y1 - y0) < 0.025: continue
                if not (row['y'] - 0.004 <= y0 < end - 0.01): continue
                owned.append(fig)
            if not owned: continue
            if page_no not in cache:
                pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
                image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                raw = out / f"{data['pdfId']}-{page_no}.raw"
                rgba = np.empty((pix.height, pix.width, 4), dtype=np.uint8)
                rgba[:, :, :3] = image[:, :, :3]
                rgba[:, :, 3] = 255
                rgba.tofile(raw)
                cache[page_no] = (str(raw), pix.width, pix.height, image)
            raw, width, height, image = cache[page_no]
            for fig in owned:
                x0 = max(0, math.floor(fig[0] * width)); x1 = min(width, math.ceil(fig[2] * width))
                iy0 = max(0, math.floor(fig[1] * height)); iy1 = min(height - 1, math.ceil((fig[3] + 0.015) * height))
                region = (image[iy0:iy1 + 1, x0:x1, :3] < 242).any(axis=2)
                rows = np.flatnonzero(region.any(axis=1))
                ink = ((iy0 + int(rows[-1]) + 1) / height) if rows.size else end
                if ink <= end + 0.008 or ink >= limit - 0.004: continue
                cases.append({'sheet': path.name[:8], 'id': last.get('id'), 'raw': raw, 'width': width, 'height': height, 'y': row['y'], 'h': row['h'], 'limit': limit, 'ink': ink, 'end': end})
    doc.close()
print(json.dumps({'scanned': scanned, 'cases': cases}))
`,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(scan.status, 0, scan.stderr);
    const report = JSON.parse(scan.stdout) as { scanned: number; cases: { sheet: string; id: string; raw: string; width: number; height: number; y: number; h: number; limit: number; ink: number; end: number }[] };
    assert.ok(report.scanned >= 200, String(report.scanned));
    assert.ok(report.cases.length >= 10, String(report.cases.length));
    const bitmaps = new Map<string, { width: number; height: number; getContext: () => { getImageData: () => { data: Uint8ClampedArray } } }>();
    for (const item of report.cases) {
      let bitmap = bitmaps.get(item.raw);
      if (!bitmap) {
        const raw = readFileSync(item.raw);
        const data = new Uint8ClampedArray(raw.byteLength);
        data.set(raw);
        bitmap = { width: item.width, height: item.height, getContext: () => ({ getImageData: () => ({ data }) }) };
        bitmaps.set(item.raw, bitmap);
      }
      const bottom = extendDrawingBox(bitmap, { y: item.y, h: item.h }, item.limit);
      assert.ok(bottom != null && bottom + 1e-6 >= item.ink - 0.008 && bottom <= item.limit + 1e-6, `${item.sheet} ${item.id} ink ${item.ink} ext ${bottom} limit ${item.limit}`);
    }
    const rectangle = report.cases.find((item) => item.sheet === 'cffd33bd' && item.id === '7א');
    assert.ok(rectangle, 'Pythagoras 7א');
    const rectangleBitmap = bitmaps.get(rectangle.raw);
    assert.ok(rectangleBitmap);
    const rectangleBottom = extendDrawingBox(rectangleBitmap, { y: rectangle.y, h: rectangle.h }, rectangle.limit);
    assert.ok(rectangleBottom != null && rectangleBottom > 0.22 && rectangleBottom < 0.27, String(rectangleBottom));
  });

  it('measures a committed label page without downloading a worksheet', (t) => {
    const probe = spawnSync('python3', ['-c', 'import pymupdf, numpy'], { encoding: 'utf8' });
    if (probe.status !== 0) {
      t.skip('pymupdf is not installed');
      return;
    }
    const pdfPath = fileURLToPath(new URL('./fixtures/label-gap-page.pdf', import.meta.url));
    const script = fileURLToPath(new URL('../scripts/measure-label-gaps.py', import.meta.url));
    const measured = spawnSync('python3', [script], {
      input: JSON.stringify([{
        id: 'fixture',
        pdf: pdfPath,
        pages: [{ page: 1, pins: [
          { id: '1ב', y: 0.545, line: 0.0675, q: 1 },
          { id: '1ג', y: 0.680, line: 0.0675, q: 1 },
        ] }],
      }]),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(measured.status, 0, measured.stderr);
    const gaps = JSON.parse(measured.stdout)[0].gaps;
    const top = gaps['1ב'];
    const next = gaps['1ג'];
    assert.equal(typeof top, 'number');
    assert.equal(typeof next, 'number');
    // Above the dashed rule (y 0.356) and above the triangle (y 0.416), so the whole triangle is inside.
    assert.ok(top > 0.37 && top < 0.416, String(top));
    // Just above the next label ink (y 0.665), so that label stays out.
    assert.ok(next > 0.64 && next < 0.665, String(next));
    const edges = spawnSync('python3', [script], {
      input: JSON.stringify({
        cmd: 'edges',
        pdf: pdfPath,
        crops: [{ id: '1ב', page: 1, y: top, h: next - top }],
      }),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(edges.status, 0, edges.stderr);
    const edge = JSON.parse(edges.stdout)[0];
    assert.equal(edge.topDark, 0, JSON.stringify(edge));
    assert.equal(edge.botDark, 0, JSON.stringify(edge));
    assert.ok(edge.midDark > 20, JSON.stringify(edge));
  });

  it('moves one wizard step at a time and keeps the choice when going back', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const demo = readFileSync(new URL('../../../demos/teacher-factoring-print.js', import.meta.url), 'utf8');
    assert.equal(demo, preview);
    const src = preview.slice(preview.indexOf('function wizardSteps'), preview.indexOf('function wizardPaint'));
    const api = new Function(`${src} return { wizardSteps, wizardIndex, wizardNeighbor, wizardStepFromHash, wizardHash, wizardReduce, wizardHandle, settleRouteTap, routeFromHash, routeReduce, suggestOutcome, topicHits };`)() as {
      wizardSteps: () => string[];
      wizardIndex: (step: string) => number;
      wizardNeighbor: (step: string, delta: number) => string;
      wizardStepFromHash: (hash: string) => string;
      wizardHash: (step: string) => string;
      wizardReduce: (model: { step: string; grade: string; topic: string; level: string; selected: string[]; output: string }, action: { type: string; hash?: string; step?: string; grade?: string; topic?: string; level?: string; selected?: string[]; output?: string }) => { step: string; grade: string; topic: string; level: string; selected: string[]; output: string };
      wizardHandle: (model: { step: string; grade: string; topic: string; level: string; selected: string[]; output: string }, action: { type: string; step?: string }) => { step: string; how: string; selected: string[] };
      settleRouteTap: (ready: boolean, pending: { route: string; step?: string } | null, request: { route: string; step?: string } | null) => { pending: { route: string; step?: string } | null; opened: { route: string; step?: string } | null };
      routeFromHash: (hash: string) => string;
      routeReduce: (model: { route: string; step: string; grade: string; topic: string; level: string; selected: string[]; output: string }, action: { type: string; route?: string; step?: string; hash?: string }) => { route: string; step: string; grade: string; topic: string; level: string; selected: string[]; output: string };
      suggestOutcome: (result: { enabled?: boolean; exerciseIds?: string[]; sheetIds?: string[] } | null) => { apply: boolean; ids: string[] };
      topicHits: (catalog: { grades: { grade: number; label: string; topics: { id: number; title: string }[] }[] }, query: string) => { grade: string; topic: string; title: string }[];
    };
    assert.deepEqual(api.wizardSteps(), ['grade', 'topic', 'level', 'pick', 'output', 'summary']);
    assert.equal(api.wizardNeighbor('grade', -1), 'grade');
    assert.equal(api.wizardNeighbor('grade', 1), 'topic');
    assert.equal(api.wizardNeighbor('summary', 1), 'summary');
    assert.equal(api.wizardStepFromHash('#pick'), 'pick');
    assert.equal(api.wizardStepFromHash('#selection'), 'pick');
    assert.equal(api.wizardStepFromHash(''), 'grade');
    assert.equal(api.wizardHash('topic'), '#topic');
    assert.equal(api.wizardHash('missing'), '#grade');
    const model = { step: 'summary', grade: '9', topic: '2', level: 'a', selected: ['ex:sheet:1א', 'ex:sheet:1ב'], output: 'marked' };
    const back = api.wizardReduce(model, { type: 'back' });
    assert.equal(back.step, 'output');
    assert.equal(back.grade, '9');
    assert.equal(back.topic, '2');
    assert.equal(back.level, 'a');
    assert.equal(back.output, 'marked');
    assert.deepEqual(back.selected, model.selected);
    model.selected.push('ex:sheet:1ג');
    assert.deepEqual(back.selected, ['ex:sheet:1א', 'ex:sheet:1ב']);
    const viaHash = api.wizardReduce(back, { type: 'hash', hash: '#grade' });
    assert.equal(viaHash.step, 'grade');
    assert.deepEqual(viaHash.selected, back.selected);
    assert.equal(viaHash.level, 'a');
    const jumped = api.wizardReduce(viaHash, { type: 'jump', step: 'pick' });
    assert.equal(jumped.step, 'pick');
    assert.equal(jumped.grade, '9');
    const edited = api.wizardReduce(jumped, { type: 'set', level: 'c', selected: ['ex:sheet:3א'] });
    assert.equal(edited.step, 'pick');
    assert.equal(edited.level, 'c');
    assert.deepEqual(edited.selected, ['ex:sheet:3א']);
    assert.equal(edited.topic, '2');
    const forward = api.wizardReduce(edited, { type: 'next' });
    assert.equal(forward.step, 'output');
    assert.deepEqual(forward.selected, edited.selected);
    const jumpedBack = api.wizardReduce(api.wizardReduce(model, { type: 'jump', step: 'topic' }), { type: 'back' });
    assert.equal(jumpedBack.step, 'grade');
    assert.deepEqual(jumpedBack.selected, ['ex:sheet:1א', 'ex:sheet:1ב', 'ex:sheet:1ג']);
    const summary = { step: 'summary', grade: '9', topic: '2', level: 'a', selected: ['ex:sheet:1א', 'ex:sheet:1ב'], output: 'marked' };
    const chipped = api.wizardHandle(summary, { type: 'chip', step: 'topic' });
    assert.equal(chipped.step, 'topic');
    assert.equal(chipped.how, 'replace');
    assert.deepEqual(chipped.selected, ['ex:sheet:1א', 'ex:sheet:1ב']);
    summary.selected.push('ex:sheet:1ג');
    assert.deepEqual(chipped.selected, ['ex:sheet:1א', 'ex:sheet:1ב']);
    const afterChip = api.wizardHandle({ step: 'topic', grade: '9', topic: '2', level: 'a', selected: chipped.selected, output: 'marked' }, { type: 'back' });
    assert.equal(afterChip.step, 'grade');
    assert.notEqual(afterChip.step, 'summary');
    assert.equal(afterChip.how, 'push');
    assert.deepEqual(afterChip.selected, chipped.selected);
    assert.equal(api.wizardNeighbor('topic', -1), afterChip.step);
    assert.equal(api.routeFromHash(''), 'gate');
    assert.equal(api.routeFromHash('#fast'), 'fast');
    assert.equal(api.routeFromHash('#grade'), 'guided');
    assert.equal(api.routeFromHash('#selection'), 'guided');
    const routed = {
      route: 'guided',
      step: 'summary',
      grade: model.grade,
      topic: model.topic,
      level: model.level,
      selected: model.selected.slice(0, 2),
      output: 'marked',
    };
    const toFast = api.routeReduce(routed, { type: 'route', route: 'fast' });
    assert.equal(toFast.route, 'fast');
    assert.equal(toFast.step, 'summary');
    assert.deepEqual(toFast.selected, routed.selected);
    routed.selected.push('ex:sheet:9א');
    assert.deepEqual(toFast.selected, ['ex:sheet:1א', 'ex:sheet:1ב']);
    const backToGuided = api.routeReduce(toFast, { type: 'route', route: 'guided' });
    assert.equal(backToGuided.route, 'guided');
    assert.equal(backToGuided.step, 'summary');
    assert.deepEqual(backToGuided.selected, toFast.selected);
    const viaGate = api.routeReduce(toFast, { type: 'hash', hash: '' });
    assert.equal(viaGate.route, 'gate');
    assert.deepEqual(viaGate.selected, toFast.selected);
    assert.deepEqual(api.suggestOutcome(null), { apply: false, ids: [] });
    assert.deepEqual(api.suggestOutcome({ enabled: false, exerciseIds: ['1א'], sheetIds: [] }), { apply: false, ids: [] });
    assert.deepEqual(api.suggestOutcome({ enabled: true, exerciseIds: [], sheetIds: [] }), { apply: false, ids: [] });
    const suggested = api.suggestOutcome({ enabled: true, exerciseIds: ['1א'], sheetIds: ['sheet:a'] });
    assert.equal(suggested.apply, true);
    assert.deepEqual(suggested.ids, ['1א', 'sheet:a']);
    const hits = api.topicHits({ grades: [{ grade: 9, label: 'כיתה ט׳', topics: [{ id: 2, title: 'פירוק לגורמים' }, { id: 1, title: 'חוק הפילוג המורחב' }] }] }, 'פירוק');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].topic, '2');
    assert.equal(api.topicHits({ grades: [] }, 'פ').length, 0);
    const queued = api.settleRouteTap(false, null, { route: 'fast' });
    assert.equal(queued.opened, null);
    assert.equal(queued.pending && queued.pending.route, 'fast');
    const replaced = api.settleRouteTap(false, queued.pending, { route: 'guided', step: 'grade' });
    assert.equal(replaced.opened, null);
    assert.equal(replaced.pending && replaced.pending.route, 'guided');
    assert.equal(replaced.pending && replaced.pending.step, 'grade');
    const flushed = api.settleRouteTap(true, replaced.pending, null);
    assert.equal(flushed.pending, null);
    assert.equal(flushed.opened && flushed.opened.route, 'guided');
    assert.equal(flushed.opened && flushed.opened.step, 'grade');
    const direct = api.settleRouteTap(true, null, { route: 'fast' });
    assert.equal(direct.pending, null);
    assert.equal(direct.opened && direct.opened.route, 'fast');
    assert.match(preview, /modelTimeoutMs: 10000/);
    assert.match(preview, /NoamBotClient/);
    assert.equal(preview.includes('new AbortController()'), false);
    assert.match(preview, /לא מופיעים בחיפוש וייכנסו להדפסה/);
    assert.match(preview, /נבחרו ולא מופיעים בחיפוש/);
    assert.match(preview, /class="chip-x">×</);
    assert.match(preview, /if \(key === searchHiddenKey\) return searchHiddenCache/);
    assert.match(preview, /window\.history\.pushState/);
    assert.match(preview, /addEventListener\('popstate'/);
    assert.match(preview, /printMode = btn\.dataset\.output/);
    assert.match(preview, /wizardReduce\(model, \{ type: 'back' \}\)/);
    assert.match(preview, /sessionStorage/);
    const boot = preview.slice(preview.indexOf('async function start'), preview.indexOf('start().catch'));
    assert.ok(boot.indexOf('applyScenario') >= 0 && boot.indexOf('applyScenario') < boot.indexOf('restoreWizardSelection'));
    assert.match(boot, /settleRouteTap\(true, pendingRoute, null\)/);
    assert.ok(boot.indexOf('initWizard') < boot.indexOf('settleRouteTap'));
    assert.match(preview, /if \(!catalogReady\)/);
    const backHandler = preview.slice(preview.indexOf("$('wizard-back').addEventListener"), preview.indexOf("$('wizard-next').addEventListener"));
    assert.equal(backHandler.includes('history.back'), false);
    assert.match(backHandler, /wizardHandle\(currentWizardModel\(\), \{ type: 'back' \}\)/);
    assert.match(backHandler, /wizardGo\(handled\.step, handled\.how\)/);
    const jumpSrc = preview.slice(preview.indexOf('function jumpWizard'), preview.indexOf('function placeTeacherNeed'));
    assert.match(jumpSrc, /wizardHandle\(currentWizardModel\(\), \{ type: 'chip', step \}\)/);
    assert.match(jumpSrc, /wizardGo\(handled\.step, handled\.how\)/);
    assert.equal(/wizardGo\(step,\s*'push'\)/.test(jumpSrc), false);
    const page = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
    const demoPage = readFileSync(new URL('../../../demos/teacher-practice-picker-site-style.html', import.meta.url), 'utf8');
    for (const step of api.wizardSteps()) {
      assert.match(page, new RegExp('data-wizard-step="' + step + '"'));
      assert.match(demoPage, new RegExp('data-wizard-step="' + step + '"'));
    }
    assert.match(page, /id="wizard-back"/);
    assert.match(page, /id="wizard-next"/);
    assert.match(page, /id="wizard-chips"/);
    assert.match(page, /id="output-short"/);
    assert.match(page, /אני יודע מה אני מחפש/);
    assert.match(page, /עזרו לי לבחור/);
    assert.match(page, /חיפוש מהיר וכל הסינונים במסך אחד/);
    assert.match(page, /שאלה אחת בכל מסך, ובסוף דף מוכן להדפסה/);
    assert.match(demoPage, /חיפוש מהיר וכל הסינונים במסך אחד/);
    assert.match(demoPage, /שאלה אחת בכל מסך, ובסוף דף מוכן להדפסה/);
    assert.equal(page.includes('mini-ui'), false);
    assert.equal(demoPage.includes('mini-ui'), false);
    assert.equal(page.includes('route-preview'), false);
    assert.match(page, /id="fast-search"/);
    assert.match(page, /id="teacher-need"/);
    assert.match(page, /id="route-fast"/);
    assert.match(page, /id="route-guided"/);
    assert.match(page, /prefers-reduced-motion:reduce/);
    assert.match(demoPage, /אני יודע מה אני מחפש/);
    assert.match(demoPage, /id="fast-search"/);
    assert.match(demoPage, /id="teacher-need"/);
    assert.match(page, /id="topic-filter"/);
    assert.match(demoPage, /id="topic-filter"/);
    assert.match(page, /bottom:132px/);
    assert.match(page, /is-summary .summary-actions button/);
    assert.match(page, /\.route-gate\{padding:22px 18px 12px\}/);
    assert.match(demoPage, /\.route-gate\{padding:22px 18px 12px\}/);
    assert.match(page, /id="route-loading"/);
    assert.match(demoPage, /id="route-loading"/);
    assert.match(page, /id="fast-selected"/);
    assert.match(demoPage, /id="fast-selected"/);
    assert.match(page, /\.fast-selected button \.chip-x/);
    assert.match(demoPage, /\.fast-selected button \.chip-x/);
    const landingApi = new Function(`${src} return { aiConfirmLanding, wizardReduce };`)() as {
      aiConfirmLanding: (model: { step: string; grade: string; topic: string; level: string; selected: string[]; output: string }) => { route: string; step: string; how: string; grade: string; topic: string; level: string; selected: string[]; output: string };
      wizardReduce: (model: { step: string; grade: string; topic: string; level: string; selected: string[]; output: string }, action: { type: string }) => { step: string; grade: string; topic: string; level: string; selected: string[]; output: string };
    };
    const filled = { step: 'grade', grade: '9', topic: '12', level: 'b', selected: ['ex:pythagoras:7א'], output: 'short' };
    const landed = landingApi.aiConfirmLanding(filled);
    assert.equal(landed.route, 'guided');
    assert.equal(landed.step, 'pick');
    assert.equal(landed.how, 'push');
    assert.equal(landed.grade, '9');
    assert.equal(landed.topic, '12');
    assert.equal(landed.level, 'b');
    assert.equal(landed.output, 'short');
    assert.deepEqual(landed.selected, ['ex:pythagoras:7א']);
    filled.selected.push('ex:pythagoras:7ב');
    assert.deepEqual(landed.selected, ['ex:pythagoras:7א']);
    const atLevel = landingApi.wizardReduce(landed, { type: 'back' });
    assert.equal(atLevel.step, 'level');
    assert.equal(atLevel.level, 'b');
    assert.equal(atLevel.grade, '9');
    assert.deepEqual(atLevel.selected, ['ex:pythagoras:7א']);
    const atTopic = landingApi.wizardReduce(atLevel, { type: 'back' });
    assert.equal(atTopic.step, 'topic');
    assert.equal(atTopic.topic, '12');
    const atGrade = landingApi.wizardReduce(atTopic, { type: 'back' });
    assert.equal(atGrade.step, 'grade');
    assert.equal(atGrade.grade, '9');
    assert.deepEqual(atGrade.selected, ['ex:pythagoras:7א']);
    const confirmSrc = preview.slice(preview.indexOf('function confirmTeacherPick'), preview.indexOf('function teacherChatTurn'));
    assert.ok(confirmSrc.indexOf('state.level = confirmLevel') < confirmSrc.indexOf('applySuggestIds'));
    assert.match(confirmSrc, /openRoute\('guided', 'push', aiConfirmLanding\(currentWizardModel\(\)\)\.step\)/);
    assert.match(page, /#wizard\.is-fast #wizard-next\{display:flex\}/);
    assert.match(demoPage, /#wizard\.is-fast #wizard-next\{display:flex\}/);
  });

  it('leaves Noam AI exercise suggestions disabled', () => {
    assert.match(printer, /NoamTeacherSuggest/);
    assert.match(printer, /enabled:\s*false/);
    assert.match(printer, /classifier:\s*'qwen-flash'/);
    assert.match(printer, /TEACHER_SUGGEST_ENDPOINT = '\/api\/noamSiteCompanion'/);
    assert.equal(printer.includes('my-site-2'), false);
    assert.match(printer, /postJson\(TEACHER_SUGGEST_ENDPOINT/);
    assert.match(printer, /api: '\/api'/);
    assert.match(printer, /נועם AI עוד לא פעיל. אפשר להמשיך לבחור ולהדפיס./);
    assert.equal(printer.includes('נועם AI לא זמין כרגע. אפשר להמשיך לבחור ולהדפיס.'), false);
    assert.equal(/fetch\([^)]*(qwen|dashscope|compatible-mode)/.test(printer), false);
    assert.match(page, /data-noam-teacher-suggest="off"/);
    assert.match(page, /השיחה עם נועם AI היא בפאנל/);
    assert.equal(printer.includes('worksheet-viewer-noam'), false);
  });
});
