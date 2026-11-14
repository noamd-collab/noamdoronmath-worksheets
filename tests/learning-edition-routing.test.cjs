'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function functions(source,catalog){
 const start=source.indexOf(' function openPdf(item){'),end=source.indexOf(' function controls(item)',start);
 assert(start>=0&&end>start,'actual local functions must exist');
 return vm.runInNewContext(source.slice(start,end)+';({openPdf,viewerLearningItem:typeof viewerLearningItem===\'function\'?viewerLearningItem:null})',
  {catalog,URL,location:{href:'https://www.noamdoronmath.co.il/learning.html'}});
}
function fixture(){return [undefined,'edition-one','edition-two'].flatMap(editionId=>['a','b','c'].map(l=>({id:`g9-t7-${l}${editionId?'-e-'+editionId:''}`,g:9,t:7,parent:7,title:'מקבילית',label:l,l,viewerLevel:l,pdf:(editionId||'legacy')+'-'+l,x:editionId==='edition-one'?'G9-T85':editionId==='edition-two'?'G9-T88':'G9-T17',...(editionId?{editionId}:{})})));}
for(const rel of ['noam-learning.js','headless/astro-poc/public/noam-learning.js']){
 const source=fs.readFileSync(path.join(root,rel),'utf8');
 test(rel+': new edition carries its exact identity and only its own siblings',()=>{
  const rows=fixture(),f=functions(source,rows);
  for(const row of rows.filter(r=>r.editionId)){
   const q=new URL(f.openPdf(row)).searchParams;
   assert.equal(q.get('edition'),row.editionId);assert.equal(q.get('x'),row.x);
   for(const l of ['a','b','c'])assert.equal(q.get('p'+l),row.editionId+'-'+l);
   assert.equal(f.viewerLearningItem(q).id,row.id);
  }
 });
 test(rel+': missing/empty/wrong edition and swapped PDF/prefix/level/grade cannot select new progress',()=>{
  const rows=fixture(),f=functions(source,rows),row=rows.find(r=>r.editionId==='edition-one'&&r.l==='a');
  const q=new URL(f.openPdf(row)).searchParams;
  for(const [key,value]of [['edition',null],['edition',''],['edition','legacy'],['edition','edition-two'],['edition','unknown'],['x','G9-T17'],['pdf','legacy-a'],['lv','b'],['g','8']]){
   const bad=new URLSearchParams(q);if(value===null)bad.delete(key);else bad.set(key,value);
   assert.equal(f.viewerLearningItem(bad),undefined,key+'='+value);
  }
 });
 test(rel+': legacy selection and siblings stay legacy even with two active additions',()=>{
  const rows=fixture(),f=functions(source,rows);
  for(const row of rows.filter(r=>!r.editionId)){
   const q=new URL(f.openPdf(row)).searchParams;assert.equal(q.has('edition'),false);
   for(const l of ['a','b','c'])assert.equal(q.get('p'+l),'legacy-'+l);
   assert.equal(f.viewerLearningItem(q).id,row.id);
   q.set('edition','legacy');assert.equal(f.viewerLearningItem(q).id,row.id);
   q.set('edition','edition-one');assert.equal(f.viewerLearningItem(q),undefined);
  }
 });
 test(rel+': every existing learning row preserves its baseline open URL',()=>{
  const script=fs.readFileSync(path.join(root,'noam-learning-catalog.js'),'utf8');const env={window:{}};vm.runInNewContext(script,env);const current=env.window.NOAM_LEARNING_CATALOG;
  const baselineEnv={window:{}};vm.runInNewContext(cp.execFileSync('git',['show','36910380:noam-learning-catalog.js'],{cwd:root,encoding:'utf8'}),baselineEnv);
  const rows=baselineEnv.window.NOAM_LEARNING_CATALOG;
  assert.equal(rows.length,967);assert.equal(new Set(rows.map(r=>r.id)).size,967);
  assert.equal(JSON.stringify(current.slice(0,rows.length)),JSON.stringify(rows),'all pre-activation catalog rows stay exact');
  const extras=current.slice(rows.length);assert([0,12].includes(extras.length));
  if(extras.length){const approved=new Set(['ms-20261113-trn-r1','ms-20261113-cyl-r1','ms-20261113-con-r1','ms-20261113-par-r1']);assert(extras.every(r=>approved.has(r.editionId)));assert.equal(new Set(extras.map(r=>r.id)).size,12);}
  const before=cp.execFileSync('git',['show','36910380:'+rel],{cwd:root,encoding:'utf8'});
  const old=functions(before,rows),now=functions(source,current);
  for(const row of rows)assert.equal(now.openPdf(row),old.openPdf(row),row.id);
 });
}
test('unknown learning ID cannot write guest or account progress',async()=>{
 const Core=require('../noam-learning-core.js');let writes=0;
 const engine=Core.create({catalog:fixture(),storage:{getItem:()=>null,setItem:()=>{writes++;},removeItem:()=>{writes++;}},client:{from:()=>{writes++;throw Error('unexpected DB access');}}});
 await assert.rejects(engine.change('g9-t7-a-e-unknown','started'),/INVALID_PROGRESS/);assert.equal(writes,0);
});

test('viewer and learning entry points refresh catalog, boot and client as one cache generation',()=>{
 const versions=[];
 for(const rel of ['worksheet-viewer-noam.html','headless/astro-poc/public/worksheet-viewer-noam.html','learning.html','headless/astro-poc/public/learning.html']){
  const text=fs.readFileSync(path.join(root,rel),'utf8');
  for(const stem of ['noam-learning-catalog.js','noam-learning-boot.js']){
   const matches=[...text.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/g)].map(m=>m[1]).filter(src=>src.startsWith(stem+'?v='));
   assert.equal(matches.length,1,rel+' '+stem);versions.push(matches[0].split('?v=')[1]);
  }
 }
 for(const rel of ['noam-learning-boot.js','headless/astro-poc/public/noam-learning-boot.js']){
  const text=fs.readFileSync(path.join(root,rel),'utf8'),matches=[...text.matchAll(/noam-learning\.js\?v=([A-Za-z0-9._-]+)/g)];
  assert.equal(matches.length,1,rel);versions.push(matches[0][1]);
 }
 assert.deepEqual([...new Set(versions)],['20261114-edition-learning1']);
});
