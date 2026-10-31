import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { replaceWizardScopeUrl, wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const pdf = 'a'.repeat(32), pick = `ex:${pdf}:1`;
const base = `https://www.noamdoronmath.co.il/teachers?grade=8&topic=43&level=all&pick=${encodeURIComponent(pick)}&minutes=45&tag=one&tag=two#questions`;
function browserAt(href = base) {
  const state = { router: { index: 7 }, retained: ['value'] };
  const calls: { state: unknown; url: string }[] = [];
  const browser = {
    location: { href, assign() { assert.fail('URL sync must not navigate'); }, reload() { assert.fail('URL sync must not reload'); } },
    history: { state, pushState() { assert.fail('URL sync must not add history entries'); }, replaceState(saved: unknown, _title: string, url: string) {
      assert.equal(saved, state, 'preserve the actual existing history.state');
      calls.push({ state: saved, url }); browser.location.href = url;
    } },
  };
  return { browser, calls, state };
}

for (const level of ['a', 'b', 'c', 'all']) {
  test(`level ${level} replaces only scope parameters and reloads the selected level`, () => {
    const app = browserAt(base.replace('level=all', 'level=invalid'));
    const scope = { grade: '8', topic: '43', level, selected: [pick], blocks: [{ keys: [pick] }] };
    const before = structuredClone(scope);
    assert.equal(replaceWizardScopeUrl(app.browser, scope), true);
    const url = new URL(app.browser.location.href);
    assert.equal(url.pathname, '/teachers'); assert.equal(url.hash, '#questions');
    assert.deepEqual(url.searchParams.getAll('tag'), ['one', 'two']);
    assert.equal(url.searchParams.get('minutes'), '45'); assert.equal(url.searchParams.get('pick'), pick);
    assert.equal(wizardPrefillFromSearch(url.search).level, level);
    assert.deepEqual(wizardPrefillFromSearch(url.search).exerciseIds, [pick]);
    assert.deepEqual(scope, before, 'synchronization cannot mutate selection or saved sections');
    assert.equal(app.calls.length, 1);
    assert.equal(replaceWizardScopeUrl(app.browser, scope), false);
    assert.equal(app.calls.length, 1, 'manual rerenders must not rewrite history');
  });
}

test('a fresh scope-only link reloads without inventing a selected question', () => {
  const app = browserAt('https://preview.example/teachers/?source=guide#pick');
  assert.equal(replaceWizardScopeUrl(app.browser, { grade: 1, topic: 11, level: 'b' }), true);
  const url = new URL(app.browser.location.href);
  assert.equal(url.pathname, '/teachers/'); assert.equal(url.hash, '#pick');
  assert.equal(url.searchParams.get('source'), 'guide'); assert.equal(url.searchParams.has('pick'), false);
  assert.deepEqual(wizardPrefillFromSearch(url.search), { grade: '1', topic: '11', level: 'b', minutes: null, exerciseIds: [] });
});

test('changing grade or topic drops stale owned picks but preserves unrelated context', () => {
  for (const scope of [{ grade: '9', topic: '43', level: 'all' }, { grade: '8', topic: '54', level: 'all' }]) {
    const app = browserAt();
    assert.equal(replaceWizardScopeUrl(app.browser, scope), true);
    const url = new URL(app.browser.location.href);
    assert.equal(url.searchParams.has('pick'), false, 'shared source IDs must not restore a previous scope selection');
    assert.equal(url.searchParams.get('minutes'), '45'); assert.deepEqual(url.searchParams.getAll('tag'), ['one', 'two']);
    assert.deepEqual(wizardPrefillFromSearch(url.search).exerciseIds, []);
  }
});

test('invalid scopes and unavailable history cannot break manual selection', () => {
  for (const scope of [{ grade: '10', topic: '1', level: 'a' }, { grade: '8', topic: '', level: 'all' }, { grade: '8', topic: '1', level: 'c2' }]) {
    const app = browserAt(); assert.equal(replaceWizardScopeUrl(app.browser, scope), false); assert.equal(app.calls.length, 0);
  }
  const app = browserAt(); app.browser.history.replaceState = () => { throw new Error('embedded history unavailable'); };
  assert.doesNotThrow(() => assert.equal(replaceWizardScopeUrl(app.browser, { grade: '8', topic: '43', level: 'b' }), false));
  assert.equal(app.browser.location.href, base);
});

test('scope-only parsing keeps existing invalid-handoff and ID-filtering rules', () => {
  for (const search of ['?grade=10&topic=1&level=a', '?grade=8&topic=1&level=c2', '?grade=8&topic=1&level=a&pick=', '?grade=8&topic=1&level=a&pick=invalid']) assert.equal(wizardPrefillFromSearch(search), null);
  assert.deepEqual(wizardPrefillFromSearch(`?grade=8&topic=1&level=a&pick=invalid,${pick}`).exerciseIds, [pick]);
});

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, name);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return (end < 0 ? tail : tail.slice(0, end)).split('\nstart().catch')[0];
}

// Execute the actual event handlers, normalization, render scope updates and
// startup/prefill functions. Only source loading and unrelated print UI are stubbed.
function wizard(options: { href?: string; load?: () => Promise<void>; historyFails?: boolean; prefillKeys?: string[] } = {}) {
  const app = browserAt(options.href || base);
  if (options.historyFails) app.browser.history.replaceState = () => { throw new Error('blocked'); };
  return new Function('window', 'replaceWizardScopeUrl', 'wizardPrefillFromSearch', 'load', 'calls', 'prefillKeys', `
    let state = { grade:'8', topic:'43', level:'all', scenario:'other', style:'blended', selected:['a:first','b:last'], blocks:[], pickMode:'manual', wizard:'pick' };
    let history = [], CATALOG = { grades:[
      {grade:8,label:'כיתה ח׳',topics:[{id:43,title:'ראשון',sheets:[{level:'a'},{level:'b'},{level:'c2'}]},{id:56,title:'דף יחיד',sheets:[{level:'one'}]}]},
      {grade:9,label:'כיתה ט׳',topics:[{id:2,title:'פירוק',sheets:[{level:'a'},{level:'b'},{level:'c'}]}]}
    ] };
    const elements = new Map(), levels=['all','a','b','c'].map(value=>({value,checked:value==='all',disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}}));
    function $(id){if(!elements.has(id))elements.set(id,{value:'',dataset:{},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},classList:{toggle(){}}});return elements.get(id);}
    const document={activeElement:null,body:{dataset:{}},querySelectorAll(selector){return selector==='[name=level]'?levels:[];},querySelector(){return null;},addEventListener(){}};
    const SCENARIOS={other:{label:'אחר',title:'אחר'},first:{label:'ראשון'}},STYLES={blended:{help:''}};
    const escapeHTML=value=>String(value),available=()=>false,paintSourceLine=()=>{},applyWizard=()=>{};
    const events=[], CATALOG_URL='/catalog',location={get search(){return new URL(window.location.href).search;}};
    const fetch=async url=>{if(url!==CATALOG_URL)throw new Error('unexpected network');events.push('catalog');return {ok:true,json:async()=>CATALOG};};
    const installSuggest=()=>{},indexCatalog=()=>{},ensureTeacherBotClient=async()=>({prepare:async()=>events.push('prepare'),postJson:()=>{throw new Error('unexpected AI');}});
    const clearPreparedPrint=()=>events.push('clear'),snapshot=()=>history.push([...state.selected]);
    const visibleSelectionKeys=()=>prefillKeys|| (state.level==='all'?['a:first','b:last']:state.level==='a'?['a:first']:state.level==='b'?['b:last']:[]);
    const currentExercises=()=>[],expandToWholeQuestionKeys=(_pool,ids)=>ids,selectionKey=()=>state.selected.join('\\n');
    const assignWholeQuestions=()=>{throw new Error('manual selection must not be assigned');},carriedKeys=()=>new Set();
    const announce=message=>events.push(message),loadCurrentTopic=()=>load(),applyScenario=()=>render();
    ${['gradeRecord','currentTopic','syncLevels','syncWizardUrl','keepVisible','fillGrades','fillTopics','render','bind','applyWizardPrefill','start'].map(definition).join('\n')}
    bind();
    return {state,events,levels,elements,calls,window,render,applyWizardPrefill,start,
      async changeLevel(value){for(const el of levels)el.checked=el.value===value;await levels.find(el=>el.value===value).handlers.change();},
      async changeGrade(value){$('grade').value=value;return $('grade').handlers.change();},
      async changeTopic(value){$('topic').value=value;return $('topic').handlers.change();},
      async returnDemo(){return $('return-demo').handlers.click();}};
  `)(app.browser, replaceWizardScopeUrl, wizardPrefillFromSearch, options.load || (async () => {}), app.calls, options.prefillKeys);
}

test('real level handler preserves its existing manual reconciliation while updating the URL', async () => {
  for (const historyFails of [false, true]) {
    const app = wizard({ historyFails });
    await app.changeLevel('b');
    assert.deepEqual(app.state.selected, ['b:last']);
    assert.equal(app.state.level, 'b');
    assert.equal(new URL(app.window.location.href).searchParams.get('level'), historyFails ? 'all' : 'b');
    const count = app.calls.length; app.render(); assert.equal(app.calls.length, count);
    assert.equal(app.events.filter((x: string) => x === 'clear').length, 1);
  }
});

test('normalization exposes c2 as c and resets a single-source topic to all', async () => {
  const app = wizard(); await app.changeLevel('c');
  assert.equal(app.state.level, 'c'); assert.equal(new URL(app.window.location.href).searchParams.get('level'), 'c');
  await app.changeTopic('56');
  assert.equal(app.state.level, 'all'); assert.equal(new URL(app.window.location.href).searchParams.get('level'), 'all');
  assert.equal(app.levels.find((x: any) => x.value === 'c').disabled, true);
  app.state.level = 'b'; app.render();
  assert.equal(app.state.level, 'all'); assert.equal(new URL(app.window.location.href).searchParams.get('level'), 'all');
});

test('grade, topic and demo changes sync their final valid scope before pending source loads', async () => {
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  const app = wizard({ load: () => pending });
  const gradeChange = app.changeGrade('9');
  let url = new URL(app.window.location.href);
  assert.equal(url.searchParams.get('grade'), '9'); assert.equal(url.searchParams.get('topic'), '2'); assert.equal(url.searchParams.get('level'), 'all');
  assert.equal(url.searchParams.has('pick'), false); assert.deepEqual(app.state.selected, []);
  const topicChange = app.changeTopic('2');
  release(); await Promise.all([gradeChange, topicChange]);
  assert.equal(new URL(app.window.location.href).searchParams.get('topic'), '2');
  app.state.grade='8'; app.state.topic='56'; app.state.level='all'; app.render();
  await app.returnDemo(); url=new URL(app.window.location.href);
  assert.deepEqual(['grade','topic','level'].map(k=>url.searchParams.get(k)), ['9','2','all']);
});

test('startup reads a scope-only deep link before any URL write and reloads it with no invented selection', async () => {
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  const href='https://www.noamdoronmath.co.il/teachers?grade=8&topic=43&level=c&minutes=30#pick';
  const app=wizard({href,load:()=>pending}); const boot=app.start();
  for(let i=0;i<5;i++)await Promise.resolve();
  assert.equal(app.state.level,'c'); assert.equal(app.calls.length,0); assert.equal(app.window.location.href,href);
  release(); await boot;
  assert.equal(app.state.level,'c'); assert.deepEqual(app.state.selected,[]);
  assert.equal(app.state.wizard,'pick'); assert.equal(app.calls.length,0);
  assert.equal(app.events.includes('הבחירה מנועם AI נטענה לאשף.'),false);
  assert.ok(app.events.includes('הכיתה, הנושא והרמה נטענו לאשף.'));
});

test('existing selected-question deep links survive startup before and after source loading', async () => {
  const href=base.replace('level=all','level=b');
  const app=wizard({href,prefillKeys:[pick]});
  await app.start();
  assert.equal(app.window.location.href,href); assert.equal(app.calls.length,0);
  assert.equal(app.state.grade,'8'); assert.equal(app.state.topic,'43'); assert.equal(app.state.level,'b');
  assert.deepEqual(app.state.selected,[pick]);
  assert.ok(app.events.includes('הבחירה מנועם AI נטענה לאשף.'));
});

test('late completion of an earlier grade load cannot restore its old URL scope', async () => {
  const complete: (() => void)[]=[];
  const app=wizard({load:()=>new Promise<void>(resolve=>complete.push(resolve))});
  const earlier=app.changeGrade('9');
  assert.equal(new URL(app.window.location.href).searchParams.get('grade'),'9');
  const later=app.changeGrade('8');
  const latestUrl=app.window.location.href;
  assert.equal(new URL(latestUrl).searchParams.get('grade'),'8');
  assert.equal(new URL(latestUrl).searchParams.get('topic'),'43');
  complete[1](); await later;
  complete[0](); await earlier;
  assert.equal(app.window.location.href,latestUrl);
  assert.deepEqual(app.state.selected,[]);
  assert.equal(app.calls.length,2,'late rendering reads current scope and makes no new history write');
});

test('the deployed teacher module and URL helper invalidate their own caches while the URL helper retains its own version', () => {
  assert.equal(printer,readFileSync(new URL('../../../demos/teacher-factoring-print.js',import.meta.url),'utf8'));
  assert.equal(readFileSync(new URL('../public/teachers/wizard-prefill.js',import.meta.url),'utf8'),readFileSync(new URL('../../../demos/wizard-prefill.js',import.meta.url),'utf8'));
  assert.match(printer,/wizard-prefill\.js\?v=20261031-level-url/);
  for(const file of ['../public/teachers/index.html','../../../demos/teacher-practice-picker-site-style.html']) assert.match(readFileSync(new URL(file,import.meta.url),'utf8'),/teacher-factoring-print\.js\?v=20261031-browser-error/);
  assert.match(printer,/NoamBotClient\.version === '20261031-browser-error'/);
});
