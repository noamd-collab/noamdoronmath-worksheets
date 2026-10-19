import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const root = process.cwd();
const pilot = JSON.parse(readFileSync(resolve(root,'src/data/worksheet-remaining-101.v1.json'),'utf8'));
const read = (path: string) => readFileSync(resolve(root,path),'utf8');
test('remaining 101 packages bind all 299 versions to their exact native items and figures', () => {
  assert.equal(pilot.sheets.length,299);
  let items=0;
  for (const s of pilot.sheets) {
    assert.ok(typeof s.title === "string" && s.title.trim());
    const local=read('public/noam-ai/manifests/'+s.pdfId+'.json');
    assert.equal(local,read('../../noam-ai/manifests/'+s.pdfId+'.json'));
    const m=JSON.parse(local), n=JSON.parse(read('public'+s.nativeExport));
    assert.equal(m.sourceSha256,s.pdfSha256);
    assert.equal(createHash('sha256').update(read('public'+s.nativeExport)).digest('hex'),s.nativeExportSha256);
    assert.equal(m.nativeExportUrl,s.nativeExport);
    assert.match(s.x,/^G[789]-T[0-9]{2}$/);
    assert.ok(s.x.startsWith('G'+s.grade+'-'));
    assert.equal(new URL(s.pdfUrl).pathname.split('_').at(-1),s.pdfId+'.pdf');
    assert.equal(m.exercises.length,s.items);
    const expected=n.questions.flatMap((q:any)=>q.items.map((i:any)=>[q.id,i.id]));
    assert.deepEqual(m.exercises.map((e:any)=>[e.nativeQuestionId,e.nativeItemId]),expected);
    for (const e of m.exercises) {
      assert.ok(e.text && e.prompt.includes(e.text));
      assert.ok(e.crops.every((c:any)=>c.page>=1 && c.page<=s.pages && c.y>=0 && c.y+c.h<=1.001));
      if(e.nativeFigureUrl) assert.ok(existsSync(resolve(root,'public'+e.nativeFigureUrl)));
    }
    items+=s.items;
  }
  assert.equal(items,22241);
  assert.equal(new Set(pilot.sheets.map((s:any)=>s.package)).size,101);
  for (const s of pilot.sheets) {
    const u=new URL(s.viewerUrl);
    assert.equal(u.searchParams.get('pdf'),s.pdfId);
    assert.equal(u.searchParams.get('lv'),s.level);
    assert.equal(u.searchParams.get('back'),pilot.page);
    const siblings=pilot.sheets.filter((x:any)=>x.package===s.package);
    if (s.level==='one') {
      assert.equal(siblings.length,1);
      assert.ok(!['a','b','c'].some(l=>u.searchParams.has('p'+l)));
    } else {
      assert.equal(siblings.length,3);
      for(const sibling of siblings) assert.equal(u.searchParams.get('p'+sibling.level),sibling.pdfId);
    }
  }
});

test('remaining package IDs and sibling links stay isolated from all earlier live packages', () => {
  const earlier=['worksheet-pilot','worksheet-next-ten','worksheet-second-ten','worksheet-third-ten','worksheet-fourth-ten'].flatMap(name=>JSON.parse(read('src/data/'+name+'.v1.json')).sheets);
  const all=[...earlier,...pilot.sheets];
  assert.equal(all.length,412);
  assert.equal(new Set(all.map((s:any)=>s.pdfId)).size,412);
  assert.equal(new Set(all.map((s:any)=>s.package)).size,144);
  assert.deepEqual(pilot.sheets.filter((s:any)=>s.level==='one').map((s:any)=>s.key).sort(),['G7-T16-a','G8-T27-a']);
  for(const s of pilot.sheets.filter((s:any)=>s.package==='G9-T40')) {
    const m=JSON.parse(read('public/noam-ai/manifests/'+s.pdfId+'.json'));
    assert.equal(s.x,'G9-T40');
    assert.equal(m.prefix,'G9-T32');
    assert.ok(s.nativeExport.startsWith('/noam-ai/native/G9-T40/'));
    const actual32=earlier.filter((x:any)=>x.package==='G9-T32');
    assert.equal(actual32.length,3);
    assert.ok(actual32.every((x:any)=>x.pdfId!==s.pdfId && x.nativeExport!==s.nativeExport));
  }
});
