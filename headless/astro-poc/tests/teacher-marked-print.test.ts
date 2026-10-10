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
    assert.equal(packed.length, 1);
    assert.equal(packed[0].items.filter((item) => item.slice.kind === 'answer').length, 1);
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

  it('prints only the picked part label on every middle-school sheet', () => {
    const preview = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
    const body = preview.slice(preview.indexOf('function boxEnd'), preview.indexOf('function contentHeight'));
    const dir = new URL('../public/teachers/sheets/', import.meta.url);
    let parts = 0;
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
      const sheet = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
      if (!sheet || !(sheet.grade >= 7) || !Array.isArray(sheet.questions)) continue;
      const shortSlices = new Function('SOURCE', `${body} return shortSlices;`)(sheet) as (chosen: { id: string }[]) => { kind: string; page: number; box: { y: number; h: number } }[];
      const byId = Object.fromEntries(sheet.questions.map((question: { id: string }) => [question.id, question]));
      for (const question of sheet.questions) {
        if (!question.row) continue;
        parts += 1;
        const rows = shortSlices([byId[question.id]]).filter((slice) => slice.kind === 'row');
        const labelY = question.labelLine ? question.labelLine.y : question.row.y;
        const owns = rows.some((slice) => slice.page === (question.row.page || question.page) && slice.box.y <= labelY + 0.008 && slice.box.y + slice.box.h > labelY + 0.004);
        assert.ok(owns, `${file} ${question.id} misses its own label`);
        for (const other of sheet.questions) {
          if (other === question || other.q !== question.q || !other.row) continue;
          const y = other.labelLine ? other.labelLine.y : other.row.y;
          const page = other.row.page || other.page;
          const inside = rows.some((slice) => slice.page === page && slice.box.y + 0.004 < y && y < slice.box.y + slice.box.h - 0.004);
          if (!inside) continue;
          const figure = sheet.questions.find((item: { q: number; figure?: { y0: number; y1: number } }) => item.q === question.q && item.figure);
          const sharedFigure = Boolean(figure && figure.figure && y >= figure.figure.y0 - 0.004 && y <= figure.figure.y1 + 0.004);
          assert.ok(sharedFigure, `${file} ${question.id} also prints ${other.id}`);
        }
      }
    }
    assert.ok(parts > 20000, String(parts));
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
    assert.match(page, /הצעות נועם AI כבויות/);
    assert.equal(printer.includes('worksheet-viewer-noam'), false);
  });
});
