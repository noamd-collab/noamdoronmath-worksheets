import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

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
  });

  it('shows every picked item and does not leave a bare digit after a letter', () => {
    assert.match(printer, /function shownQuestions/);
    const byId = Object.fromEntries(source.questions.map((question: { id: string; text: string }) => [question.id, question.text]));
    assert.equal(byId['2ב'], 'x² + 5x');
    assert.equal(byId['2ג'], '8a³ − 12a²');
    assert.equal(byId['4א'], 'נכון או לא נכון? בדקו בפתיחת סוגריים, ותקנו את השגוי. 6x + 8 = 2(3x + 4)');
    assert.equal(byId['12א'], '37 × 12 + 37 × 8');
    assert.match(printer, /<bdi dir="ltr" class="math">/);
    assert.match(page, /\.q-desc bdi\.math\{white-space:nowrap\}/);
    const previewJs = readFileSync(new URL('../public/teachers-demo-preview/teacher-factoring-print.js', import.meta.url), 'utf8');
    const previewPage = readFileSync(new URL('../public/teachers-demo-preview/index.html', import.meta.url), 'utf8');
    assert.equal(previewJs, printer);
    assert.match(previewPage, /\.q-desc bdi\.math\{white-space:nowrap\}/);
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
    const publicSource = JSON.parse(readFileSync(new URL('../public/teachers-demo-preview/factoring-grade-9-a-source.json', import.meta.url), 'utf8'));
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

  it('serves a noindex preview route that is outside the page sitemap', () => {
    const route = readFileSync(new URL('../src/pages/teachers-demo-preview.ts', import.meta.url), 'utf8');
    const preview = readFileSync(new URL('../public/teachers-demo-preview/index.html', import.meta.url), 'utf8');
    const sitemap = readFileSync(new URL('../src/pages/sitemap-pages.xml.ts', import.meta.url), 'utf8');
    assert.match(route, /x-robots-tag': 'noindex, nofollow'/);
    assert.match(preview, /noindex, nofollow/);
    assert.match(preview, /\/teachers-demo-preview\/teacher-factoring-print\.js/);
    assert.match(sitemap, /import\.meta\.glob\('\.\/\*\.astro'\)/);
    assert.equal(route.includes('src/pages/teachers-demo-preview.astro'), false);
  });
});
