import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const root = process.cwd();
const pilot = JSON.parse(readFileSync(resolve(root,'src/data/worksheet-second-ten.v1.json'),'utf8'));
const read = (path: string) => readFileSync(resolve(root,path),'utf8');
test('second ten packages bind all 30 versions to their exact native items and figures', () => {
  assert.equal(pilot.sheets.length,30);
  let items=0;
  for (const s of pilot.sheets) {
    assert.ok(typeof s.title === "string" && s.title.trim());
    const local=read('public/noam-ai/manifests/'+s.pdfId+'.json');
    assert.equal(local,read('../../noam-ai/manifests/'+s.pdfId+'.json'));
    const m=JSON.parse(local), n=JSON.parse(read('public'+s.nativeExport));
    assert.equal(m.sourceSha256,s.pdfSha256);
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
  assert.equal(items,2458);
  assert.equal(new Set(pilot.sheets.map((s:any)=>s.package)).size,10);
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
