/** Local-only DOCX integration QA. No fixture or asset is registered/published. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium.ts';
import { validateCanonicalWordSource } from '../scripts/build-teacher-word-bank.mjs';
import { selectWordQuestions } from '../src/lib/teacherWordSelection.ts';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.argv[2] || join(app,'reports/word-assets'));
mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const assets=new Map(),sheets={},fixtures={};
for(const name of ['a05-B','b28-E']){
  const root=join(app,'tests/fixtures/word-assets',name);
  const record=JSON.parse(readFileSync(join(root,'fixture.json')));
  assert.equal(record.testOnly,true);assert.equal(record.publishable,false);
  for(const [file,sha] of Object.entries(record.files))assert.equal(hash(readFileSync(join(root,file))),sha);
  const draft=JSON.parse(readFileSync(join(root,'draft.json')));
  const measuredRoot=join(app,'tests/fixtures/measured-v1',name);
  const measuredIdentity=JSON.parse(readFileSync(join(measuredRoot,'fixture.json')));
  for(const [file,sha] of Object.entries(measuredIdentity.files))assert.equal(hash(readFileSync(join(measuredRoot,file))),sha);
  const original=JSON.parse(readFileSync(join(measuredRoot,'draft.json'))).teacherSheetDraft;
  const sheet=draft.wordSource,pdfId=record.syntheticMediaId;
  const readAsset=url=>readFileSync(join(root,url.split('/').pop()));
  validateCanonicalWordSource(pdfId,sheet,original,readAsset);
  for(const figure of sheet.figureAssets?.figures || [])assets.set(figure.url,readAsset(figure.url));
  sheets[pdfId]=sheet;fixtures[name]={sheet,pdfId};
}
const choose=(name,q)=>({pdfId:fixtures[name].pdfId,q,sourceSha256:fixtures[name].sheet.sourceSha256});
const cases={
  'a05-selected':[choose('a05-B',1),choose('a05-B',4)],
  'b28-selected':[choose('b28-E',1)],
  'mixed-selected':[choose('a05-B',1),choose('b28-E',1)],
};
for(const [name,requests] of Object.entries(cases)){
  const selected=selectWordQuestions({sheets},requests);
  assert.equal(selected.missing.length,0);assert.equal(selected.required.length,0);
  cases[name]=selected.questions;
}
const exporter=readFileSync(resolve(app,'../../demos/teacher-word-export.js'));
const html=`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>בדיקת Word מקומית</title><script type="module">
import {createTeacherDocx,loadWordFigure} from '/teacher-word-export.js';
window.make=async questions=>{const loaded=[];const bytes=await createTeacherDocx({questions,title:'דף עבודה במתמטיקה — בדיקת יצוא'},async figure=>{loaded.push(figure.url);return loadWordFigure(figure);});return {bytes:Array.from(bytes),loaded};};
window.testLoad=async figure=>{try{await loadWordFigure(figure);return 'unexpected success';}catch(error){return error.message;}};
</script></html>`;
let corrupt=false;const requests=[];
const server=createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}
  else if(req.url==='/teacher-word-export.js'){res.setHeader('Content-Type','text/javascript');res.end(exporter);}
  else if(assets.has(req.url)){requests.push(req.url);res.setHeader('Content-Type','image/png');res.end(corrupt?Buffer.from('modified'):assets.get(req.url));}
  else {res.statusCode=404;res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN || resolveTestBrowser(),headless:true});
const evidence={testOnly:true,publishable:false,productionExporterSha256:hash(exporter),cases:[],negative:[],errors:[]};
try{
  const page=await browser.newPage();page.on('pageerror',error=>evidence.errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.make);
  for(const [name,questions] of Object.entries(cases)){
    const start=requests.length;
    const result=await page.evaluate(questions=>window.make(questions),questions);
    const bytes=Buffer.from(result.bytes);writeFileSync(join(out,name+'.docx'),bytes);
    assert.equal(result.loaded.length,name==='a05-selected'?0:1);
    assert.deepEqual(requests.slice(start),result.loaded);
    evidence.cases.push({name,docxSha256:hash(bytes),loaded:result.loaded,selected:questions.map(q=>({pdfId:q.worksheetSource.pdfId,q:q.q,sourceSha256:q.worksheetSource.sourceSha256,canonicalSourceSha256:q.worksheetSource.canonicalSourceSha256}))});
  }
  const figure=fixtures['b28-E'].sheet.questions['1'].figure;
  corrupt=true;
  assert.equal(await page.evaluate(f=>window.testLoad(f),figure),'WORD_FIGURE_CHANGED');
  evidence.negative.push('Changed PNG bytes rejected by production browser SHA check');
  corrupt=false;
  const before=requests.length;
  assert.equal(await page.evaluate(f=>window.testLoad(f),{...figure,url:'https://example.com/untrusted.png'}),'WORD_FIGURE_SOURCE');
  assert.equal(requests.length,before);
  evidence.negative.push('External URL rejected before fetch');
  assert.deepEqual(evidence.errors,[]);
}finally{await browser.close();await new Promise(done=>server.close(done));}
writeFileSync(join(out,'browser-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({out,cases:evidence.cases.map(c=>c.name),negative:evidence.negative,errors:evidence.errors}));
