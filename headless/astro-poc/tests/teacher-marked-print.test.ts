import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
    assert.equal(printer.split('attachTeacherNote(printArea, note)').length - 1, 2);
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
    assert.match(html, /\.q-thumb\{[^}]*max-height:120px/);
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
    const thumbSlice = new Function(`${preview.slice(preview.indexOf('function thumbSlice'), preview.indexOf('async function paintThumb'))} return thumbSlice;`)() as (question: { row: { x: number; y: number; w: number; h: number }; line: number }, bitmap: { width: number; height: number }) => { srcY: number; srcH: number };
    const fraction = thumbSlice({ row: { x: 0, y: 0.397, w: 1, h: 0.2128 }, line: 0.0131 }, { width: 1000, height: 1000 });
    assert.ok(fraction.srcY / 1000 < 0.397);
    assert.ok(fraction.srcY / 1000 + fraction.srcH / 1000 > 0.44);
    assert.ok(fraction.srcY / 1000 + fraction.srcH / 1000 < 0.47);
    const tight = thumbSlice({ row: { x: 0, y: 0.5, w: 1, h: 0.02 }, line: 0.025 }, { width: 1000, height: 1000 });
    assert.ok(0.5 - tight.srcY / 1000 < 0.002);
    const css = readFileSync(new URL('../src/styles/exact-site.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(min-width: 900px\) \{\s*\.exact-header \{height:90px/);
    assert.match(css, /\.exact-header nav\[data-nav-panel\] \{flex-wrap:nowrap!important/);
    assert.match(css, /@media \(min-width: 900px\) and \(max-width: 1279px\)/);
    assert.match(css, /@media \(max-width: 899\.98px\)/);
    assert.match(css, /@media \(min-width: 900px\) and \(max-width: 1023\.98px\)[\s\S]*?font-size:12px!important/);
    assert.match(html, /@media\(min-width:900px\) and \(max-width:1023\.98px\)\{[\s\S]*?font-size:12px/);
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
    const pair = rowsOf(['9א', '9ב']);
    disjoint(pair);
    assert.equal(covered(pair, aleph.row.y + 0.01), 1);
    assert.equal(covered(pair, bet.row.y + 0.01), 1);
    assert.equal(pair.length, 1);
    const triple = rowsOf(['9א', '9ב', '9ג']);
    disjoint(triple);
    assert.equal(covered(triple, bet.row.y + 0.01), 1);
    assert.equal(covered(triple, gimel.row.y + gimel.row.h * 0.5), 1);
    assert.ok(triple.some((slice) => slice.box.y + slice.box.h >= gimel.row.y + gimel.row.h - 0.004));
    const onlyBet = rowsOf(['9ב']);
    assert.equal(onlyBet.length, 1);
    assert.ok(onlyBet[0].box.y <= aleph.row.y + 0.002, JSON.stringify(onlyBet[0].box));
    assert.ok(onlyBet[0].box.y + onlyBet[0].box.h >= aleph.row.y + aleph.row.h - 0.004, JSON.stringify(onlyBet[0].box));
    const onlyAleph = rowsOf(['9א']);
    assert.equal(onlyAleph.length, 1);
    assert.ok(Math.abs(onlyAleph[0].box.y - aleph.row.y) < 0.0001);
    assert.ok(Math.abs(onlyAleph[0].box.h - aleph.row.h) < 0.0001);
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

  it('leaves Noam AI exercise suggestions disabled', () => {
    assert.match(printer, /NoamTeacherSuggest/);
    assert.match(printer, /enabled:\s*false/);
    assert.match(printer, /classifier:\s*'qwen-flash'/);
    assert.equal(/fetch\([^)]*(qwen|dashscope|compatible-mode)/.test(printer), false);
    assert.match(page, /data-noam-teacher-suggest="off"/);
    assert.match(page, /הצעות נועם AI כבויות/);
    assert.equal(printer.includes('worksheet-viewer-noam'), false);
  });
});
