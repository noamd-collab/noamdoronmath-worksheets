/** Local-only visual regression. Uses the production slicer, PDF SHA verifier,
 * canvas painter and packer; test PDFs never enter the public catalog. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium.ts';
import { prepareMeasuredManifestDraft, measuredSheetFromManifest } from '../scripts/lib/measured-worksheet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const out = resolve(process.argv[2] || join(app, 'reports/measured-v1'));
mkdirSync(out, { recursive: true });
const printer = readFileSync(resolve(app, '../../demos/teacher-factoring-print.js'), 'utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const names = ['escapeHTML', 'pdfCacheKey', 'loadPdf', 'pageBitmap', 'measuredFragmentSlices',
  'measuredSourceLabels', 'measuredSourceDescription', 'measuredQuestionHeading', 'measuredShortSlices',
  'selectedAnswerCrops', 'measuredAnswerCrops', 'answerMeasured', 'levelPrintName', 'measureSlices', 'contentHeight',
  'gapSize', 'fittedHeight', 'fittedScale', 'sheetContentLimit', 'packShort', 'paintPageChrome', 'paintSectionHeading',
  'paintMeasuredPage', 'paintPacked', 'paintAllShort', 'orderPrintQuestions', 'partRank',
  'batchesOf', 'shortSlices', 'originalShortSlices', 'questionDataSlices', 'worksheetTitle'];
const definitions = names.map(name => {
  const at = printer.search(new RegExp(`(?:^|\n)(?:async )?function ${name}\\(`));
  assert.ok(at >= 0, name);
  const tail = printer.slice(at + (printer[at] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}).join('\n');
const files = new Map([
  ['/teacher-page-sections.js', [resolve(app, '../../demos/teacher-page-sections.js'), 'text/javascript']],
  ['/pdf.js', [resolve(app, 'node_modules/pdfjs-dist/build/pdf.min.js'), 'text/javascript']],
  ['/pdf.worker.js', [resolve(app, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'), 'text/javascript']],
  ['/font-he.ttf', [resolve(app, 'public/fonts/heebo-hebrew.f1f7cfae.woff2'), 'font/woff2']],
  ['/font-en.ttf', [resolve(app, 'public/fonts/heebo-latin.50dae2e1.woff2'), 'font/woff2']],
]);
const sheets = {};
for (const [index, name] of ['a05-B', 'b28-E', 'synthetic-dependency', 'synthetic-split'].entries()) {
  const root = resolve(here, 'fixtures/measured-v1', name);
  const record = JSON.parse(readFileSync(join(root, 'fixture.json')));
  for (const [file, sha] of Object.entries(record.files)) assert.equal(hash(readFileSync(join(root, file))), sha);
  const draft = JSON.parse(readFileSync(join(root, 'draft.json')));
  const pdfId = 'abcd'[index].repeat(32);
  const manifest = prepareMeasuredManifestDraft(draft, readFileSync(join(root, 'layout.json')), {
    pdfId, url: `https://static.wixstatic.com/ugd/d8e7ad_${pdfId}.pdf`,
    downloadedSha256: draft.binding.pdfSha256, syntheticTestFixture: true,
  });
  const sheet = measuredSheetFromManifest({ pdfId, title: name }, manifest, { allowDraft: true });
  // Only the harness routes test bytes locally. The production contract stays Wix-only.
  sheet.pdfUrl = '/' + name + '.pdf';
  files.set(sheet.pdfUrl, [join(root, 'sheet.pdf'), 'application/pdf']);
  sheets[name] = sheet;
}
const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>@font-face{font-family:Heebo;src:url('/font-he.ttf')}@font-face{font-family:Heebo;src:url('/font-en.ttf');unicode-range:U+0000-00FF}*{box-sizing:border-box}body{margin:0;background:#edf1f6;color:#22305a;font:16px Heebo,Arial,sans-serif}header{padding:16px;max-width:900px;margin:auto}h1{font-size:24px;margin:0 0 8px}nav{display:flex;flex-wrap:wrap;gap:8px}button{min-height:44px;padding:8px 14px;border:1px solid #64748b;background:white;border-radius:7px;color:inherit;font:inherit}button[aria-pressed=true]{background:#22305a;color:white}#status{min-height:24px}.crop-sheet{background:white;max-width:850px;margin:18px auto;padding:12px;box-shadow:0 2px 12px #0002}.crop-sheet canvas{display:block;width:100%;height:auto}figcaption{text-align:center;padding:8px;font-size:13px}@media(max-width:500px){h1{font-size:21px}.crop-sheet{margin:10px 6px;padding:3px}header{padding:12px}}</style>
<header><h1>בדיקת בחירת סעיפים</h1><p>תצוגה מקומית לבדיקה בלבד</p><nav><button data-case="table">סעיפים מטבלה</button><button data-case="figure">שני סעיפים ואיור משותף</button><button data-case="dependency">סעיף שנסמך על שאלה קודמת</button><button data-case="split">שאלה שממשיכה בעמוד נוסף</button></nav><p id="status" role="status"></p></header><main id="output"></main><script src="/pdf.js"></script><script type="module">
import { needsSectionHeadings, pointsLabel, scoreLabel, sectionKind, sectionTitle, testPoints, TEST_TOTAL_POINTS } from "/teacher-page-sections.js";
const FIXTURES=${JSON.stringify(sheets)};
let SOURCE; const sheets = new Map(Object.values(FIXTURES).map(s=>[s.pdfId,s]));
const pdfDocs=new Map(),pageBitmaps=new Map(),PDFJS_WORKER='/pdf.worker.js';
const SHEET_PAGE_H=1440,SHEET_BASAD_H=40,SHEET_TITLE_H=86;
${definitions}
const productionPaintPacked=paintPacked;
let capture;
paintPacked=async (root,measured,answers,title)=>{capture={measured,answers};return productionPaintPacked(root,measured,answers,title);};
window.renderCase = async name => {
  window.finished = false;
  const spec = {table:['a05-B',4,2,'חיבור — רמה ב׳'],figure:['b28-E',1,2,'מרובעים — מצוינות'],dependency:['synthetic-dependency',2,1,'תלות בשאלה קודמת — בדיקה'],split:['synthetic-split',1,2,'המשך בין עמודים — בדיקה']}[name];
  const choose=(name,q,count)=>{const source=FIXTURES[name];return source.questions.filter(item=>item.q===q).slice(0,count).map(item=>({...item,source}));};
  const selected=name==='two-questions'?[...choose('a05-B',1,1),...choose('a05-B',4,1)]
    :name==='two-sources'?[...choose('a05-B',1,1),...choose('b28-E',1,1)]
    :choose(spec[0],spec[1],spec[2]);
  SOURCE=selected[0].source;
  const groups=[...new Set(selected.map(q=>q.source))].map(source=>({source,questions:selected.filter(q=>q.source===source)}));
  await paintAllShort(document.getElementById('output'),selected);
  const {measured,answers}=capture, slices=measured.map(item=>item.slice);
  document.querySelectorAll('[data-case]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.case===name)));
  document.getElementById('status').textContent='נבחרו: '+selected.map(q=>q.id).join(', ')+' · התשובות בסוף';
  const pages=packShort(measured);
  const headings=slices.filter(s=>s.measuredQuestionHeading).map(s=>({label:s.label,note:s.note,question:s.questionNumber,owner:s.canonicalQuestionId}));
  window.result={name,sources:groups.map(({source})=>({pdfId:source.pdfId,pdfSha256:source.sourceSha256,layoutSha256:source.layoutSha256})),selected:selected.map(q=>q.canonicalItemId),fragments:slices.filter(s=>s.fragmentRef).map(s=>s.fragmentRef),headings,
    figures:slices.filter(s=>s.fragmentRole==='figure').map(s=>({ref:s.fragmentRef,owner:s.questionId})),
    dependencies:selected.flatMap(q=>q.dependencyFragmentRefs),pageFills:pages.map((items,i)=>({fill:contentHeight(items)/sheetContentLimit(i,true),scale:fittedScale(items,sheetContentLimit(i,true)),refs:items.map(item=>item.slice.fragmentRef).filter(Boolean),headings:items.filter(item=>item.slice.measuredQuestionHeading).map(item=>({label:item.slice.label,note:item.slice.note}))})),
    answerHeadings:answers.filter(item=>item.slice.kind==='answer-heading').map(item=>({label:item.slice.label,note:item.slice.note})),
    answerFragments:answers.filter(item=>item.slice.kind==='answer').map(item=>item.slice.fragmentRef),canvases:document.querySelectorAll('canvas').length,
    overflow:document.documentElement.scrollWidth>window.innerWidth};
  window.finished=true; return window.result;
};
document.querySelectorAll('[data-case]').forEach(button=>button.onclick=()=>window.renderCase(button.dataset.case));
</script></html>`;
const server = createServer((req, res) => {
  const item = files.get(req.url);
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }
  else if (item) { res.setHeader('Content-Type', item[1]); res.end(readFileSync(item[0])); }
  else { res.statusCode=404; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || resolveTestBrowser(), headless:true });
const evidence = { productionPrinterSha256: hash(Buffer.from(printer)), productionEntryPoint: 'paintAllShort', cases:[], errors:[] };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  for (const viewport of [{width:1280,height:1000},{width:390,height:844}]) {
    await page.setViewport(viewport);
    await page.goto('http://127.0.0.1:'+server.address().port, {waitUntil:'networkidle0'});
    for (const name of ['table','figure','dependency','split','two-questions','two-sources']) {
      await page.setViewport(viewport);
      await page.evaluate(() => { window.scrollTo(0,0); });
      const result = await page.evaluate(name=>window.renderCase(name),name);
      assert.equal(result.overflow,false);
      if(name==='figure') assert.equal(result.figures.length,1);
      if(name==='dependency') for(const ref of result.dependencies) assert.ok(result.fragments.includes(ref));
      if(name==='split') assert.ok(result.pageFills.length>1);
      if(name==='two-questions') {
        assert.deepEqual(result.headings.map(h=>h.label),['שאלה 1','שאלה 4']);
        assert.equal(result.pageFills.length,1);
      }
      if(name==='two-sources') {
        assert.deepEqual(result.headings.map(h=>h.label),['שאלה 1','שאלה 1']);
        assert.notEqual(result.headings[0].note,result.headings[1].note);
        assert.deepEqual(result.answerHeadings.map(h=>h.note),result.headings.map(h=>h.note));
      }
      for(const page of result.pageFills) assert.ok(page.scale>=0.84, 'Measured content excessively shrunk');
      const filename=name+'-'+viewport.width+'.png';
      // Full-page Chromium screenshots can temporarily resize the RTL mobile
      // viewport. Phone evidence uses the actual viewport, desktop shows all pages.
      await page.screenshot({path:join(out,filename),fullPage:viewport.width>600});
      evidence.cases.push({...result,viewport,screenshot:filename});
    }
  }
  assert.deepEqual(evidence.errors,[]);
  writeFileSync(join(out,'visual-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({output:out,cases:evidence.cases.length,errors:evidence.errors}));
} finally {await browser.close(); await new Promise(resolve=>server.close(resolve));}
