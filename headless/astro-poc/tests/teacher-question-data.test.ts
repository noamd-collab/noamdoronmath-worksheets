import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code=readFileSync(new URL('../../../demos/teacher-factoring-print.js',import.meta.url),'utf8');
function definition(name:string){const start=code.indexOf('function '+name+'(');assert.ok(start>=0);return code.slice(start,code.indexOf('\n}',start)+2);}
const helpers=['questionDataSlices','answerDocumentSource','wholeQuestionSlices','originalShortSlices','shortSlices'].map(definition).join('\n');
const bundle=JSON.parse(readFileSync(new URL('../src/data/teacher-question-supplements.json',import.meta.url),'utf8'));
test('all approved G6 data stays beside its selected question exactly once and uses a verified separate document',()=>{
 let count=0;
 for(const [id,addition]of Object.entries(bundle.supplements)as[string,any][]){
  const source=JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${id}.json`,import.meta.url),'utf8'));
  source.questions.forEach((q:any)=>q.source=source);
  const slices=new Function('SOURCE',helpers+';return shortSlices;')(source);
  for(const extra of addition.questions){
   const selected=source.questions.filter((q:any)=>q.q===extra.q);
   const result=slices(selected),data=result.filter((s:any)=>s.source?.expectedSha256===extra.answerDocument.sha256);
   assert.equal(data.length,extra.crops.length);assert.equal(result.at(-1).source.expectedSha256,extra.answerDocument.sha256);
   assert.ok(data.every((s:any)=>s.block===id+':q'+extra.q));
   assert.ok(!result.some((s:any)=>s.source&&s.source.expectedSha256!==extra.answerDocument.sha256));count++;
  }
  const other=source.questions.find((q:any)=>!addition.questions.some((a:any)=>a.q===q.q));
  assert.ok(other);assert.equal(slices([other]).filter((s:any)=>s.source).length,0);
 }
 assert.equal(count,10);
});
test('question data rejects changed source identity and invalid asset geometry',()=>{
 const add=structuredClone(Object.values(bundle.supplements)[0])as any;
 const source={pdfId:'test',sourceSha256:add.sourceSha256,questionSupplements:add};
 const get=new Function(definition('answerDocumentSource')+definition('questionDataSlices')+';return questionDataSlices;')();
 assert.ok(get(source,add.questions[0].q,'q').length);
 source.sourceSha256='f'.repeat(64);assert.throws(()=>get(source,add.questions[0].q,'q'),/QUESTION_DATA_SOURCE/);
 source.sourceSha256=add.sourceSha256;add.questions[0].crops[0].h=2;assert.throws(()=>get(source,add.questions[0].q,'q'),/QUESTION_DATA_BOUNDS/);
});
