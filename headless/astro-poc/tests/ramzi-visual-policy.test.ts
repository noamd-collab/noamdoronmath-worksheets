import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
const root = new URL('../../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const report = JSON.parse(read('docs/ramzi-visual-policy-classification-20261029.json'));
const source = read('noam-visual-policy.js');
function load(commonJs = false) { const c: any = commonJs ? { module: { exports: {} } } : {}; runInNewContext(source, c); return c; }
const policy = load().NoamVisualPolicy;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
it('pure policy exports identical global/CommonJS APIs without DOM, with exact mirrored bytes', () => {
  const c = load(true); assert.equal(c.module.exports, c.NoamVisualPolicy);
  assert.equal(policy.version, '20261029-geometry-only-v1'); assert.ok(Object.isFrozen(policy));
  assert.equal(read('headless/astro-poc/public/noam-visual-policy.js'), source);
  assert.equal(hash(source), report.policySha256);
});
it('approved geometry and Cartesian/function worksheets include reviewed boundaries', () => {
  for (const prefix of ['G7-T08','G7-T48','G8-T05','G8-T06','G8-T11','G8-T16','G8-T25','G8-T61','G8-T65','G9-T06','G9-T07','G9-T36','G9-T39']) {
    assert.equal(policy.allowsWorksheet({grade:Number(prefix[1]),prefix}),true,prefix);
    assert.equal(policy.allowsExerciseId(prefix+'-A-Q01א'),true,prefix);
  }
});
it('arithmetic, algebra, statistics, motion, review and number-line pages remain denied despite graphic prompts', () => {
  for(const prefix of ['G7-T01','G7-T21','G7-T24','G7-T28','G7-T36','G7-T49','G7-T50','G8-T03','G8-T04','G8-T09','G8-T10','G8-T28','G8-T32','G8-T48','G8-T64','G8-T66','G8-TWOSRC','G9-T02','G9-T13','G9-T31','G9-T44']) {
    assert.equal(policy.allowsWorksheet({grade:Number(prefix[1]),prefix,title:'geometry',studentMessage:'שרטט משולש וגרף y=x^2',nativeFigure:true}),false,prefix);
    assert.equal(policy.allowsExerciseId(prefix+'-B-Q02ב'),false,prefix);
  }
});
it('catalog reuse and native aliases require exactly the reviewed compatible exercise prefix', () => {
  for(const [alias,target] of Object.entries({...report.definitions.aliasTargets,...report.definitions.named})) {
    const meta={grade:Number(alias[1]),prefix:alias,exerciseId:target+'-B-Q04א'};
    assert.equal(policy.allowsWorksheet(meta),true,alias+' -> '+target);
    assert.equal(policy.allowsWorksheet({...meta,exerciseId:'G8-T15-B-Q04א'}),false,alias+' cross-topic');
  }
  assert.equal(policy.allowsWorksheet({grade:9,prefix:'G9-T40',exerciseId:'G9-T32-B-Q04א'}),true);
  assert.equal(policy.allowsWorksheet({grade:7,prefix:'G9-T29',exerciseId:'G7-T48-B-Q20א'}),false);
  assert.equal(policy.allowsWorksheet({grade:9,prefix:'G9-T29',exerciseId:'G7-T47-B-Q20א'}),false);
  assert.equal(policy.allowsExerciseId('G9-TRAP-B-Q01א'),false);
});
it('missing, unknown, malformed, inherited or conflicting metadata fail closed', () => {
  for(const m of [null,undefined,[],{},{grade:7},{prefix:'G7-T08'},{grade:8,prefix:'G7-T08'},
    {grade:7.5,prefix:'G7-T08'},{grade:true,prefix:'G7-T08'},{grade:' 7',prefix:'G7-T08'},
    {grade:'07',prefix:'G7-T08'},{grade:7,prefix:'G7-T99'},{grade:7,prefix:'g7-t08'},
    {grade:7,prefix:'G7-T08 '},{grade:6,prefix:'G6-T08'},{grade:7,prefix:'G7-T08',exerciseId:undefined},
    {grade:7,prefix:'G7-T08',exerciseId:'G7-T09-A-Q01א'},Object.create({grade:7,prefix:'G7-T08'}),
    Object.assign(Object.create({exerciseId:'G7-T09-A-Q01א'}),{grade:7,prefix:'G7-T08'})])
    assert.equal(policy.allowsWorksheet(m),false,JSON.stringify(m));
  assert.equal(policy.allowsWorksheet({grade:'7',prefix:'G7-T08'}),true);
});
it('exercise syntax is strict, retaining existing legacy subsection suffixes', () => {
  for(const id of [null,7,{},'','G7-T08-A-Q00א','G7-T08-A-Q01א ','G7-T08-A-Q01א/extra',
    'G7-T08-C-Q01א','G7-T08-a-Q01א','G7-T08-A-Q01ab','G7-T08-A-Q01אב','G7-T08-A-Q01א123',
    'G6-T08-A-Q01א','G7-T08-A-Q01א\n','G9-T99-A-Q01א']) assert.equal(policy.allowsExerciseId(id),false,String(id));
  for(const id of ['G7-T08-A-Q01','G7-T08-E-Q01א','G8-T45-E2-Q09ב','G7-T08-A-Q01א5']) assert.equal(policy.allowsExerciseId(id),true,id);
});
it('all 412 native packages match reviewed classification and source hashes', () => {
  assert.equal(report.nativePackages.length,412);
  assert.equal(report.nativePackages.filter((r:any)=>r.allowed).length,214);
  for(const r of report.nativePackages) {
    const path='noam-ai/manifests/'+r.pdfId+'.json', m=JSON.parse(read(path));
    assert.equal(hash(read(path)),r.manifestSha256); assert.equal(hash(read(r.nativePath)),r.nativeSha256);
    assert.equal(policy.allowsWorksheet(m),r.allowed,r.pdfId);
    for(const e of m.exercises) {
      assert.equal(policy.allowsWorksheet({grade:m.grade,prefix:m.prefix,exerciseId:e.id}),r.allowed,e.id);
      assert.equal(policy.allowsExerciseId(e.id),r.allowed,e.id);
    }
  }
});
it('all actual catalog routes and 440 historical migrations agree with resolved manifests', () => {
  assert.equal(report.counts.middleSchoolCatalog.levelRoutes,457);
  assert.equal(report.counts.middleSchoolCatalog.allowedLevelRoutes,250); assert.equal(report.migrations.length,440);
  for(const t of report.catalogTopics) {
    assert.equal(policy.allowsWorksheet({grade:t.grade,prefix:t.prefix}),t.allowed,t.title);
    for(const l of t.levels) {
      assert.equal(l.allowed,t.allowed,t.title+':'+l.level); if(t.grade<7)continue;
      const m=JSON.parse(read('noam-ai/manifests/'+l.resolvedPdfId+'.json'));
      assert.equal(policy.allowsWorksheet(m),t.allowed);
      for(const e of m.exercises) assert.equal(policy.allowsWorksheet({grade:t.grade,prefix:t.prefix,exerciseId:e.id}),t.allowed,e.id);
    }
  }
  for(const r of report.migrations) {
    assert.equal(policy.allowsWorksheet(r.original),r.allowed);
    assert.equal(policy.allowsWorksheet(JSON.parse(read('noam-ai/manifests/'+r.resolvedPdfId+'.json'))),r.allowed);
  }
});
it('all 2048 legacy/current manifests retain coherent identities with fail-closed unknown scope', () => {
  const files=readdirSync(new URL('noam-ai/manifests/',root)).filter(f=>f.endsWith('.json'));
  assert.equal(files.length,2048); let allowed=0;
  for(const file of files) {
    const m=JSON.parse(read('noam-ai/manifests/'+file)), expected=report.definitions.entries[m.prefix]?.grade===Number(m.grade);
    if(expected)allowed++; assert.equal(policy.allowsWorksheet(m),expected,m.prefix);
    for(const e of m.exercises) assert.equal(policy.allowsWorksheet({grade:m.grade,prefix:m.prefix,exerciseId:e.id}),expected,e.id);
  }
  assert.equal(allowed,1089);
});
