import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const root = process.cwd();
const pilot = JSON.parse(readFileSync(resolve(root,'src/data/worksheet-pilot.v1.json'),'utf8'));
const read = (path: string) => readFileSync(resolve(root,path),'utf8');
test('seven approved versions preserve every native item, figure and mirrored manifest', () => {
  assert.equal(pilot.sheets.length,7);
  let items=0;
  for (const s of pilot.sheets) {
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
  assert.equal(items,603);
  const a=pilot.sheets.find((s:any)=>s.key==='G8-T49-a');
  const m=JSON.parse(read('public/noam-ai/manifests/'+a.pdfId+'.json'));
  assert.ok(m.exercises.some((e:any)=>e.q===8 && e.part==='ה'));
});
test('native figure consumer uses approved local SVG and rejects external or traversal URLs', () => {
  const source=read('public/worksheet-viewer-noam.html');
  const fn=source.slice(source.indexOf('function noamNativeFigure('),source.indexOf('function showExercisePreview('));
  const {document}=parseHTML('<html><body></body></html>');
  const ctx=vm.createContext({document,exerciseLabel:()=> 'שאלה 8'});
  vm.runInContext(fn,ctx);
  const render=(url:string)=>ctx.noamNativeFigure({nativeFigureUrl:url});
  assert.equal(render('https://evil.test/a.svg'),null);
  assert.equal(render('/noam-ai/native/G8-T49/a/../../a.svg'),null);
  assert.equal(render('/noam-ai/native/G8-T49/a/a.svg?x=1'),null);
  const fig=render('/noam-ai/native/G8-T49/a/figures/q8.svg');
  assert.equal(fig.querySelector('img').getAttribute('src'),'/noam-ai/native/G8-T49/a/figures/q8.svg');
  assert.match(fig.textContent,/השרטוט המקורי/);
});

test('single diagnostic enables AI without discovering or displaying sibling levels', () => {
  const source=read('public/worksheet-viewer-noam.html');
  const config=source.slice(source.indexOf('var LEVEL ='),source.indexOf('var MIN_WAIT'));
  const discover=source.slice(source.indexOf('function discoverSiblingLevels(){'),source.indexOf('renderLevelSwitch(true);'));
  let rendered=0;
  const ctx=vm.createContext({lv:'one',renderLevelSwitch:()=>{rendered++;}});
  vm.runInContext(config+discover+';discoverSiblingLevels();',ctx);
  assert.equal(ctx.LEVEL.one,'B');
  assert.equal(rendered,1); // Would throw on unbound fetch/okX if public lookup runs.
});
