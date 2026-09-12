'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const viewer=fs.readFileSync(path.join(root,'worksheet-viewer-noam.html'),'utf8');
const ids={a:'9abda6035afd5a017011b08a5b7da28b',b:'4ed1b334808faaf5fe56fc1804d9dc6a',c:'c6c6d3120b6da57c86a9e7fffaf47dd1'};
function fn(src,name){const start=src.indexOf('function '+name+'(');assert.ok(start>=0);return src.slice(start,src.indexOf('\n}',start)+2);}
const ctx={BASE:'https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_'};vm.createContext(ctx);vm.runInContext(fn(index,'url')+'\n'+fn(viewer,'noamWorksheetPdfUrl'),ctx);
test('catalog and AI viewer resolve each approved grade 8 topic 41 file identically',()=>{
 for(const [level,id] of Object.entries(ids)){
  const expected='./worksheets/grade8/topic41/'+id+'.pdf';assert.equal(ctx.url(id),expected);assert.equal(ctx.noamWorksheetPdfUrl(id),expected);
  const bytes=fs.readFileSync(path.resolve(root,expected));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const m=JSON.parse(fs.readFileSync(path.join(root,'noam-ai/manifests',id+'.json')));
  assert.equal(m.sourceSha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.equal(m.pdfHash,id);assert.equal(m.level,level);assert.equal(m.grade,8);assert.equal(m.topicId,41);
 }
});
test('new AI maps cover all 20 questions, both real subparts, and exclude answer pages',()=>{
 for(const id of Object.values(ids)){
  const m=JSON.parse(fs.readFileSync(path.join(root,'noam-ai/manifests',id+'.json')));assert.equal(m.exercises.length,22);assert.equal(new Set(m.exercises.map(e=>e.id)).size,22);
  assert.deepEqual([...new Set(m.exercises.map(e=>e.q))],Array.from({length:20},(_,i)=>i+1));
  for(const e of m.exercises){
   assert.equal(e.requiresVision,true);assert.equal(e.pin.page,e.crop.page);assert.ok(e.pin.page<=m.pageCount-2);
   assert.ok(e.crop.y<=e.pin.y && e.pin.y<e.crop.y+e.crop.h);assert.ok(e.crop.x>=0 && e.crop.x+e.crop.w<=1);assert.ok(e.crop.y>=0 && e.crop.y+e.crop.h<=1);
   assert.equal(e.part!== '',e.q===8||e.q===16);
  }
 }
});
test('unrelated Wix PDF routing remains intact',()=>{
 const old='7b7e8140483b4b45bb06aaaf8acbc698';assert.equal(ctx.noamWorksheetPdfUrl(old),ctx.BASE+old+'.pdf');assert.equal(ctx.url(old),ctx.BASE+old+'.pdf');assert.equal(ctx.url(''),'');assert.equal(ctx.url('https://example.org/test.pdf'),'https://example.org/test.pdf');
});
test('all inline viewer scripts remain syntactically valid',()=>{for(const m of viewer.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(m[1].trim())new vm.Script(m[1]);}});
