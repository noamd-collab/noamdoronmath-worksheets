import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const root = process.cwd();
const pilot = JSON.parse(readFileSync(resolve(root,'src/data/worksheet-next-ten.v1.json'),'utf8'));
const read = (path: string) => readFileSync(resolve(root,path),'utf8');
test('next ten packages bind all 18 versions to their exact native items and figures', () => {
  assert.equal(pilot.sheets.length,18);
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
  assert.equal(items,1352);
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
test('single worksheets display a generic label while the diagnostic keeps its name', () => {
  for (const path of ['public/worksheet-viewer-noam.html','../../worksheet-viewer-noam.html']) {
    const source=read(path);
    const names=source.slice(source.indexOf('var LEVEL_NAME ='),source.indexOf('/* R504-DEV'));
    const override=source.match(/if \(x === "G8-T26"\) LEVEL_NAME.one = "דף אבחון";/)![0];
    for (const [x,expected] of [['G8-T35','דף יחיד'],['G8-T56','דף יחיד'],['G8-T26','דף אבחון']]) {
      const ctx=vm.createContext({x}); vm.runInContext(names+override,ctx);
      assert.equal(ctx.LEVEL_NAME.one,expected);
    }
  }
});

test('both viewers return only to exact authorized pilot paths with pilot=1', () => {
  const allowed = ['/worksheet-pilot/approved-three-20261019', pilot.page, '/worksheet-pilot/second-ten-20261019', '/worksheet-pilot/third-ten-20261019', '/worksheet-pilot/fourth-ten-20261019', '/worksheet-pilot/remaining-101-20261019'];
  for (const path of ['public/worksheet-viewer-noam.html','../../worksheet-viewer-noam.html']) {
    const source = read(path);
    const navigation = source.slice(source.indexOf('/* BACK —'),source.indexOf('var panel ='));
    assert.ok(navigation.includes('var navigationParams'));
    const run = (back: string, mode: string | null) => {
      const {document} = parseHTML('<html><body><a id="backBtn">חזרה</a></body></html>');
      const location = new URL('https://www.noamdoronmath.co.il/worksheet-viewer-noam.html');
      location.searchParams.set('back',back);
      if (mode !== null) location.searchParams.set('pilot',mode);
      vm.runInContext(navigation,vm.createContext({document,location,URL,okGrade:true,g:8,
        HEADLESS_LEGACY_PAGES:'https://noamd-collab.github.io/noamdoronmath-worksheets/'}));
      return document.getElementById('backBtn')!.getAttribute('href');
    };
    for (const back of allowed) {
      assert.equal(run(back,'1'),back);
      assert.equal(run(back,null),'/worksheets?grade=8');
      assert.equal(run(back,'0'),'/worksheets?grade=8');
    }
    for (const back of [
      'https://evil.test/worksheet-pilot/next-ten-20261019',
      '//evil.test/worksheet-pilot/next-ten-20261019',
      '/worksheet-pilot/../worksheet-pilot/next-ten-20261019',
      '/worksheet-pilot/next-ten-20261019/../approved-three-20261019',
      '/worksheet-pilot/next-ten-20261019/extra',
      '/worksheet-pilot/next-ten-20261019?external=1',
    ]) assert.equal(run(back,'1'),'/worksheets?grade=8');
  }
});
