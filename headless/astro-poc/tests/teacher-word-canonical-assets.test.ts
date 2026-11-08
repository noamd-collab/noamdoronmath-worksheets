import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DOMParser } from 'linkedom';
import { validateCanonicalWordSource } from '../scripts/build-teacher-word-bank.mjs';
import { selectWordQuestions } from '../src/lib/teacherWordSelection';
import { createTeacherDocx } from '../../../demos/teacher-word-export.js';

const hash = (v: Buffer|string) => createHash('sha256').update(v).digest('hex');
function fixture(name: string) {
  const base = new URL('./fixtures/word-assets/'+name+'/', import.meta.url);
  const identity = JSON.parse(readFileSync(new URL('fixture.json',base),'utf8'));
  assert.equal(identity.testOnly,true);assert.equal(identity.publishable,false);
  for(const [path,sha] of Object.entries(identity.files))assert.equal(hash(readFileSync(new URL(path,base))),sha);
  const draft=JSON.parse(readFileSync(new URL('draft.json',base),'utf8'));
  const measured=JSON.parse(readFileSync(new URL('./fixtures/measured-v1/'+name+'/draft.json',import.meta.url),'utf8'));
  // The SHA-bound measured fixture independently supplies source/question/item identities.
  assert.equal(draft.binding.canonicalSourceSha256,measured.binding.canonicalSourceSha256);
  assert.equal(draft.binding.pdfSha256,measured.binding.pdfSha256);
  const sheet=draft.wordSource,pdfId=identity.syntheticMediaId;
  const readAsset=(url:string)=>readFileSync(new URL(url.split('/').pop()!,base));
  validateCanonicalWordSource(pdfId,sheet,measured.teacherSheetDraft,readAsset);
  return {sheet,pdfId,original:measured.teacherSheetDraft,readAsset};
}
function unzip(bytes:Uint8Array){
 const b=Buffer.from(bytes),out:Record<string,Buffer>={};let at=0;
 while(b.readUInt32LE(at)===0x04034b50){const size=b.readUInt32LE(at+18),n=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28),start=at+30+n+extra;
 out[b.subarray(at+30,at+30+n).toString()]=b.subarray(start,start+size);at=start+size;}
 return out;
}
const choose=(f:any,q:number)=>({pdfId:f.pdfId,q,sourceSha256:f.sheet.sourceSha256});
const contextHash=(sheet:any,text:string)=>{sheet.worksheetInstructions=text;sheet.worksheetInstructionsSha256=hash(text);};

test('canonical Word fixtures retain original source/PDF bindings and immutable PNG ownership',()=>{
 for(const name of ['a05-B','b28-E']){const f=fixture(name);assert.equal(f.sheet.sourceFormat,'noam-canonical-word-source-v1');}
});

test('canonical item writing space equals the bound source, including every geometry subpart',()=>{
 for(const name of ['a05-B','b28-E']){
  const f=fixture(name),source=JSON.parse(readFileSync(new URL('./fixtures/measured-v1/'+name+'/worksheet-source.json',import.meta.url),'utf8'));
  for(const question of source.questions){
   const actual=f.sheet.questions[String(question.n)].items;
   assert.deepEqual(actual.map((i:any)=>[i.canonicalItemId,i.answerLines]),question.items.map((i:any)=>[i.id,i.answerLines ?? 0]));
  }
 }
});

test('canonical compiler and exporter reject invalid writing-space counts and grade',async()=>{
 const f=fixture('a05-B');
 for(const bad of [-1,4,1.5,true,null,'2',Infinity]){
  const sheet=structuredClone(f.sheet);sheet.questions['1'].items[0].answerLines=bad;
  assert.throws(()=>validateCanonicalWordSource(f.pdfId,sheet,f.original,f.readAsset),/answerLines/);
  const selected=selectWordQuestions({sheets:{[f.pdfId]:sheet}},[choose(f,1)]);
  await assert.rejects(createTeacherDocx({questions:selected.questions}),/WORD_ANSWER_LINES/);
 }
 const sheet=structuredClone(f.sheet);sheet.questions['1'].grade=0;
 assert.throws(()=>validateCanonicalWordSource(f.pdfId,sheet,f.original,f.readAsset),/grade/);
 await assert.rejects(createTeacherDocx({questions:selectWordQuestions({sheets:{[f.pdfId]:sheet}},[choose(f,1)]).questions}),/WORD_CANONICAL_GRADE/);
});

test('canonical writing lines are exact, end keepNext chains, and never enter the answer key',async()=>{
 const f=fixture('a05-B'),sheet=structuredClone(f.sheet),q=sheet.questions['1'];
 q.items=q.items.slice(0,4);q.items.forEach((item:any,i:number)=>{item.answerLines=i;});
 const questions=selectWordQuestions({sheets:{[f.pdfId]:sheet}},[choose(f,1)]).questions;
 const xml=unzip(await createTeacherDocx({questions}))['word/document.xml'].toString();
 const doc=new DOMParser().parseFromString(xml,'text/xml');
 const lines=Array.from(doc.getElementsByTagName('w:p')).filter((p:any)=>p.textContent==='_______________________________________________'+'_');
 assert.equal(lines.length,6);
 assert.deepEqual((lines as any[]).map(p=>p.getElementsByTagName('w:keepNext').length),[0,1,0,1,1,0]);
 assert.ok(!xml.split('תשובות סופיות')[1].includes('________________________________________________'));
 delete q.items[0].answerLines;
 const missing=selectWordQuestions({sheets:{[f.pdfId]:sheet}},[choose(f,1)]).questions;
 assert.equal(unzip(await createTeacherDocx({questions:missing}))['word/document.xml'].toString(),xml);
});

test('grades one and two use 16pt text and math including tables, while canonical grade three keeps its size',async()=>{
 const f=fixture('a05-B');
 for(const grade of [1,2,3]){
  const sheet=structuredClone(f.sheet);sheet.questions['4'].grade=grade;
  const questions=selectWordQuestions({sheets:{[f.pdfId]:sheet}},[choose(f,4)]).questions;
  const xml=unzip(await createTeacherDocx({questions}))['word/document.xml'].toString();
  const body=xml.split('תשובות סופיות')[0],doc=new DOMParser().parseFromString(body+'</w:body></w:document>','text/xml');
  const table=doc.getElementsByTagName('w:tbl')[0];assert.ok(table);
  const math=Array.from(table.getElementsByTagName('m:r')) as any[];assert.ok(math.length);
  for(const run of math)assert.equal(run.getElementsByTagName('w:sz')[0]?.getAttribute('w:val'),grade<=2?'32':undefined);
  const runs=Array.from(table.getElementsByTagName('w:r')) as any[];
  for(const run of runs)assert.equal(run.getElementsByTagName('w:sz')[0].getAttribute('w:val'),grade<=2?'32':'24');
  assert.ok(body.includes('הנחיות ·'));assert.ok(!body.includes('הנחיות לדף המקור'));
 }
});

test('legacy Word bytes remain identical even for a grade-one question and incidental answerLines',async()=>{
 const questions=[{id:'a'.repeat(32)+':1',q:1,grade:1,topic:'בדיקת מורשת',levelLabel:'רמה ב׳',text:'פתרו $4 + 3 = ___$.',items:[{label:'א',text:'חשבו $8 - 2$.',answer:'$6$',answerLines:3},{label:'ב',text:'קראו.',table:{head:['א','ב'],rows:[['$1$','$2$']]},answer:'$2$'}]}];
 assert.equal(hash(Buffer.from(await createTeacherDocx({questions}))),'bc1462482b64f6ee2f1c1ca261feebff3f40e1335812c5e823c9e47ebbeabda9');
});

test('a canonical figure group never links its final response line to the next selected question',async()=>{
 const b=fixture('b28-E');
 const questions=selectWordQuestions({sheets:{[b.pdfId]:b.sheet}},[choose(b,1),choose(b,2)]).questions;
 const files=unzip(await createTeacherDocx({questions},async(f:any)=>({bytes:new Uint8Array(b.readAsset(f.url)),width:600,height:116})));
 const doc=new DOMParser().parseFromString(files['word/document.xml'].toString(),'text/xml');
 const body=doc.getElementsByTagName('w:body')[0],nodes=Array.from(body.children) as any[];
 const next=nodes.findIndex(n=>n.tagName==='w:p' && n.textContent.startsWith('שאלה 2'));
 assert.ok(next>0);assert.equal(nodes[next-1].textContent,'_'.repeat(48));
 assert.equal(nodes[next-1].getElementsByTagName('w:keepNext').length,0);
 const lines=nodes.slice(0,next).filter(n=>n.textContent==='_'.repeat(48));
 assert.equal(lines.length,5);assert.ok(lines.slice(0,-1).every(n=>n.getElementsByTagName('w:keepNext').length===1));
 // A final item figure without writing lines must also end the chain.
 const first:any=questions[0],last=first.items.at(-1);
 last.answerLines=0;last.figure=structuredClone(first.figure);last.figure.binding.itemId=last.canonicalItemId;
 delete first.figure;
 const second=unzip(await createTeacherDocx({questions},async(f:any)=>({bytes:new Uint8Array(b.readAsset(f.url)),width:600,height:116})));
 const dom=new DOMParser().parseFromString(second['word/document.xml'].toString(),'text/xml');
 const ds=Array.from(dom.getElementsByTagName('w:body')[0].children) as any[];
 const at=ds.findIndex(n=>n.tagName==='w:p' && n.textContent.startsWith('שאלה 2'));
 assert.equal(ds[at-1].getElementsByTagName('w:drawing').length,1);
 assert.equal(ds[at-1].getElementsByTagName('w:keepNext').length,0);
});

test('canonical compiler rejects stale source, instruction hash, crop owner, missing occurrence and wrong image bytes',()=>{
 const f=fixture('b28-E');
 const mutations=[
  (s:any)=>{s.canonicalSourceSha256='0'.repeat(64);},
  (s:any)=>{s.sourceSha256='0'.repeat(64);},
  (s:any)=>{s.worksheetInstructions+=' changed';},
  (s:any)=>{s.questions['1'].figure.binding.questionId=s.questions['2'].canonicalQuestionId;},
  (s:any)=>{s.questions['1'].figure.binding.itemId=s.questions['1'].items[0].canonicalItemId;},
  (s:any)=>{s.questions['1'].items[0].canonicalItemId='another';},
  (s:any)=>{s.figureAssets.figures[0].occurrences=[];},
  (s:any)=>{s.figureAssets.figures.push(s.figureAssets.figures[0]);},
  (s:any)=>{s.questions['1'].figure.url='https://example.com/image.png';},
  (s:any)=>{s.figureAssets.figures[0].widthPx++;},
  (s:any)=>{s.figureAssets.worksheetId='another';},
  (s:any)=>{s.figureAssets.revision++;},
  (s:any)=>{delete s.figureAssets.renderer.weasyprint;},
  (s:any)=>{delete s.figureAssets.renderer.fontSha256;},
 ];
 for(const mutate of mutations){const s=structuredClone(f.sheet);mutate(s);assert.throws(()=>validateCanonicalWordSource(f.pdfId,s,f.original,f.readAsset));}
 assert.throws(()=>validateCanonicalWordSource(f.pdfId,f.sheet,f.original,()=>Buffer.from('changed')),/PNG changed/);
});

test('selection carries only chosen source instructions, cannot accept caller text, and does not mutate the bank',()=>{
 const a=fixture('a05-B'),b=fixture('b28-E'),bank={sheets:{[a.pdfId]:a.sheet,[b.pdfId]:b.sheet}},before=JSON.stringify(bank);
 const r=selectWordQuestions(bank,[{...choose(a,1),instructions:'injected'},choose(a,4)]);
 assert.equal(r.questions.length,2);
 for(const q of r.questions as any[]){assert.equal(q.worksheetSource.instructions,a.sheet.worksheetInstructions);assert.equal(q.worksheetSource.pdfId,a.pdfId);assert.equal(q.figureAssets,undefined);}
 assert.ok(!JSON.stringify(r).includes(b.sheet.worksheetInstructions));assert.equal(JSON.stringify(bank),before);
});

test('instructions and dependency references require explicit selection in the same PDF',async()=>{
 const a=fixture('a05-B'),b=fixture('b28-E');const sheet=structuredClone(a.sheet);
 sheet.questions['4'].requiredQuestions=[1];const bank={sheets:{[a.pdfId]:sheet,[b.pdfId]:b.sheet}};
 const incomplete=selectWordQuestions(bank,[choose(a,4),choose(b,1)]);
 assert.deepEqual(incomplete.questions,[]);assert.equal(incomplete.required[0].pdfId,a.pdfId);assert.equal(incomplete.required[0].q,1);
 contextHash(sheet,'היעזרו בשאלה 4.');sheet.questions['4'].requiredQuestions=[];
 const missing=selectWordQuestions(bank,[choose(a,1)]);assert.equal(missing.required[0].q,4);assert.deepEqual(missing.questions,[]);
 const selected=selectWordQuestions(bank,[choose(a,4),choose(a,1)]);
 const xml=unzip(await createTeacherDocx({questions:selected.questions}))['word/document.xml'].toString();
 assert.ok(xml.includes('היעזרו בשאלה 1.'));assert.ok(!xml.includes('היעזרו בשאלה 4.'));
});

test('Word renders instructions once per selected source and keeps RTL, OMML and original table direction',async()=>{
 const a=fixture('a05-B');const selected=selectWordQuestions({sheets:{[a.pdfId]:a.sheet}},[choose(a,1),choose(a,4)]);
 const files=unzip(await createTeacherDocx({questions:selected.questions},()=>{throw Error('unexpected image');}));
 const xml=files['word/document.xml'].toString();assert.equal(xml.split(a.sheet.worksheetInstructions).length-1,1);
 assert.ok(xml.includes('<m:oMath>'));assert.ok(xml.includes('<w:bidi/>'));assert.ok(xml.includes('<w:tbl>'));
 const doc=new DOMParser().parseFromString(xml,'text/xml');assert.equal(doc.getElementsByTagName('w:tbl')[0].getElementsByTagName('w:bidiVisual')[0].getAttribute('w:val'),'1');
 assert.equal(Object.keys(files).some(p=>p.startsWith('word/media/')),false);
});

test('only selected figure owners load images; same source figure is never taken from an unselected question',async()=>{
 const b=fixture('b28-E'),bank={sheets:{[b.pdfId]:b.sheet}};let loads=0;
 // No geometry asset should be requested for question 2 merely because the bank contains question 1.
 const unfigured=selectWordQuestions(bank,[choose(b,2)]);
 await createTeacherDocx({questions:unfigured.questions},()=>{throw Error('unselected figure leaked');});
 const selected=selectWordQuestions(bank,[choose(b,1)]);
 const bytes=await createTeacherDocx({questions:selected.questions},async(f:any)=>{loads++;return {bytes:new Uint8Array(b.readAsset(f.url)),width:600,height:116};});
 const files=unzip(bytes);assert.equal(loads,1);assert.equal(Object.keys(files).filter(p=>p.startsWith('word/media/')).length,1);
 const xml=files['word/document.xml'].toString();assert.ok(xml.includes('<w:drawing>'));assert.ok(xml.includes('descr='));
});

test('browser exporter rejects stale instructions and incorrect source/question/item ownership before loading',async()=>{
 const b=fixture('b28-E'),r=selectWordQuestions({sheets:{[b.pdfId]:b.sheet}},[choose(b,1)]);
 for(const mutate of [
  (q:any)=>{q.worksheetSource.instructions+='changed';},
  (q:any)=>{q.figure.binding.canonicalSourceSha256='0'.repeat(64);},
  (q:any)=>{q.figure.binding.questionId='other';},
  (q:any)=>{q.figure.binding.itemId=q.items[0].canonicalItemId;},
  (q:any)=>{delete q.figure.binding;},
 ]){const questions=structuredClone(r.questions);mutate(questions[0]);await assert.rejects(createTeacherDocx({questions},()=>{throw Error('must not load');}),/WORD_(INSTRUCTIONS|FIGURE)/);}
});

test('a shared figure occurrence is embedded once per selected question without conflating different figure IDs',async()=>{
 const b=fixture('b28-E'),r=selectWordQuestions({sheets:{[b.pdfId]:b.sheet}},[choose(b,1)]);
 const q:any=structuredClone(r.questions[0]);
 q.items[0].figure=structuredClone(q.figure);q.items[0].figure.binding.itemId=q.items[0].canonicalItemId;
 let loads=0;const loader=async(f:any)=>{loads++;return {bytes:new Uint8Array(b.readAsset(f.url)),width:600,height:116};};
 let files=unzip(await createTeacherDocx({questions:[q]},loader));
 assert.equal(loads,1);assert.equal(Object.keys(files).filter(p=>p.startsWith('word/media/')).length,1);
 q.items[0].figure.binding.figureId='synthetic-distinct-figure';loads=0;
 files=unzip(await createTeacherDocx({questions:[q]},loader));
 assert.equal(loads,2);assert.equal(Object.keys(files).filter(p=>p.startsWith('word/media/')).length,2);
});
