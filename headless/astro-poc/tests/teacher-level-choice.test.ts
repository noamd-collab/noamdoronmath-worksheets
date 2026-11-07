import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { expandToWholeQuestionKeys, groupWholeQuestions } from '../public/teachers/teacher-question-pick.js';
import { replaceWizardScopeUrl, wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const printer = read('../public/teachers/teacher-factoring-print.js');
const catalog = JSON.parse(read('../public/teachers/teacher-catalog.json'));
const sheets = new Map<string, any>();
for (const grade of catalog.grades) for (const topic of grade.topics) for (const meta of topic.sheets) {
  if (sheets.has(meta.pdfId)) continue;
  const source = JSON.parse(read(`../public/teachers/sheets/${meta.pdfId}.json`));
  source.questions.forEach((question: any) => { question.source = source; });
  sheets.set(meta.pdfId, source);
}

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, name);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return (end < 0 ? tail : tail.slice(0, end)).split('\nstart().catch')[0];
}

// Catalog loading is local; handlers, state defaults, filtering and URL updates
// are the shipped functions. No model, provider, PDF or live-site request runs.
function picker(href = 'https://www.noamdoronmath.co.il/teachers?tag=keep#questions') {
  const initial = printer.match(/let state = (\{[\s\S]*?\n\});/);
  assert.ok(initial, 'use the real initial state rather than recreating its defaults');
  const historyState = { route: 'retained' };
  const writes: string[] = [];
  const window = {
    confirm: () => true,
    location: { href },
    history: { state: historyState, replaceState(value: unknown, _title: string, next: string) {
      assert.equal(value, historyState); writes.push(next); window.location.href = next;
    } },
  };
  return new Function('window', 'catalog', 'sheets', 'expandToWholeQuestionKeys', 'groupWholeQuestions', 'replaceWizardScopeUrl', 'wizardPrefillFromSearch', 'writes', `
    let appState = 'ready', appBound = false, startupComplete = false, retryTeacherLoad = null, appLoadId = 0;
    let state = ${initial[1]}, history = [], CATALOG = catalog, topicLoadPromise = null;
    const elements = new Map(), levels = ['all','a','b','c'].map(value => ({value,checked:false,disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}}));
    const topicSearch = null;
    const $ = id => {if(!elements.has(id))elements.set(id,{value:'',dataset:{},handlers:{},setAttribute(){},removeAttribute(){},focus(){},addEventListener(type,fn){this.handlers[type]=fn;},classList:{toggle(){}}});return elements.get(id);};
    const document = {activeElement:null,body:{dataset:{}},querySelectorAll(selector){return selector==='[name=level]'?levels:[];},querySelector(){return null;},addEventListener(){}};
    const SCENARIOS={first:{label:'ראשון'},other:{label:'אחר'}}, STYLES={scaffold:{help:''},blended:{help:''}};
    const available=()=>false,paintSourceLine=()=>{},applyWizard=()=>{},clearPreparedPrint=()=>{},announce=()=>{},escapeHTML=value=>String(value);
    const loads=[], loadCurrentTopic=async()=>{loads.push({grade:state.grade,topic:state.topic,level:state.level});};
    const applyScenario=()=>render(),assignWholeQuestions=()=>{throw new Error('Choosing a level must not auto-select questions');};
    const CATALOG_URL='/local-test-catalog',location={get search(){return new URL(window.location.href).search;}};
    const fetch=async url=>{if(url!==CATALOG_URL)throw new Error('Unexpected network');return {ok:true,json:async()=>catalog};};
    const installSuggest=()=>{},indexCatalog=()=>{},ensureTeacherBotClient=async()=>({prepare:async()=>{},postJson:()=>{throw new Error('Unexpected AI');}});
    ${['setTeacherAppState','reloadTeacherTopic','confirmTeacherReplacement','changeTeacherScope','gradeRecord','currentTopic','topicLevelChoices','resolveTopicLevel','syncLevels','syncWizardUrl','topicSheets','currentExercises','exKey','visibleSelectionKeys','keepVisible','selectionKey','snapshot','carriedKeys','toggleWholeQuestion','fillGrades','fillTopics','render','bind','applyWizardPrefill','start','levelAllows'].map(definition).join('\n')}
    bind();
    return {state,levels,loads,writes,window,render,start,applyWizardPrefill,topicSheets,currentExercises,levelAllows,resolveTopicLevel,topicLevelChoices,toggleWholeQuestion,
      undo(){return $('undo').handlers.click();},
      async changeGrade(value){$('grade').value=String(value);await $('grade').handlers.change();},
      async changeTopic(value){$('topic').value=String(value);await $('topic').handlers.change();},
      async changeLevel(value){levels.forEach(el=>el.checked=el.value===value);await levels.find(el=>el.value===value).handlers.change();}};
  `)(window, catalog, sheets, expandToWholeQuestionKeys, groupWholeQuestions, replaceWizardScopeUrl, wizardPrefillFromSearch, writes);
}

function expectedLevel(topic: any) {
  if (topic.sheets.some((sheet: any) => sheet.level === 'a')) return 'a';
  if (topic.sheets.some((sheet: any) => sheet.level === 'b')) return 'b';
  if (topic.sheets.some((sheet: any) => sheet.level === 'c' || sheet.level === 'c2')) return 'c';
  return 'all';
}

test('fresh startup and all real grade/topic handlers choose one available level without selecting questions', async (t) => {
  const app = picker(); await app.start();
  assert.equal(app.state.level, 'a'); assert.deepEqual(app.state.selected, []);
  const saved = [{grade:'1',topic:'1',kind:'review',title:'Saved',keys:['ex:saved:1']}];
  app.state.blocks = structuredClone(saved);
  let topics = 0, sheetEntries = 0;
  for (const grade of catalog.grades) {
    app.state.level = 'all';
    await app.changeGrade(grade.grade);
    assert.equal(app.state.level, expectedLevel(grade.topics[0]), `grade ${grade.grade}`);
    assert.deepEqual(app.state.blocks, [], 'Accepted grade changes reset the complete page');
    const sameGradeSaved = [{ ...saved[0], grade: String(grade.grade) }];
    app.state.blocks = structuredClone(sameGradeSaved);
    for (const topic of grade.topics) {
      if (String(app.state.topic) !== String(topic.id)) {
        app.state.level = 'all'; app.state.selected = ['stale-selection'];
        await app.changeTopic(topic.id);
      }
      const level = expectedLevel(topic), label = `${grade.grade}:${topic.id}`;
      assert.equal(app.state.level, level, label);
      assert.deepEqual(app.state.selected, [], label);
      assert.deepEqual(app.state.blocks, sameGradeSaved, 'Changing topic retains saved sections in the same grade');
      const selected = topic.sheets.filter((sheet: any) => level === 'all' || sheet.level === level || (level === 'c' && sheet.level === 'c2'));
      assert.deepEqual(app.topicSheets().map((sheet: any) => sheet.pdfId), selected.map((sheet: any) => sheet.pdfId), label);
      const url = new URL(app.window.location.href);
      assert.deepEqual(['grade','topic','level'].map(key=>url.searchParams.get(key)), [String(grade.grade),String(topic.id),level], label);
      assert.equal(url.searchParams.get('tag'), 'keep'); assert.equal(url.hash, '#questions');
      assert.equal(url.searchParams.has('pick'), false);
      topics += 1; sheetEntries += topic.sheets.length;
    }
  }
  assert.equal(topics, 330); assert.equal(sheetEntries - catalog.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.sheets.filter((s: any) => s.editionId))).length, 964);
  t.diagnostic(`Real handlers checked ${topics} topics and ${sheetEntries} catalog sheet entries.`);
});

test('all 330 topic deep links preserve explicit all and normalize a missing level before exposing candidates', async () => {
  const app = picker();
  for (const grade of catalog.grades) for (const topic of grade.topics) {
    await app.applyWizardPrefill({grade:grade.grade,topic:topic.id,level:'all',exerciseIds:[]});
    assert.equal(app.state.level, 'all');
    assert.deepEqual(app.topicSheets().map((sheet: any)=>sheet.pdfId), topic.sheets.map((sheet: any)=>sheet.pdfId));
    assert.deepEqual(app.state.selected, []);
    await app.applyWizardPrefill({grade:grade.grade,topic:topic.id,exerciseIds:[]});
    assert.equal(app.state.level, expectedLevel(topic), `${grade.grade}:${topic.id}`);
    assert.equal(new URL(app.window.location.href).searchParams.get('level'), expectedLevel(topic));
    assert.deepEqual(app.state.selected, []);
  }
});

test('specific unavailable levels never expose unrelated sheets, and c2 remains part of excellence', () => {
  const app = picker();
  for (const grade of catalog.grades) for (const topic of grade.topics) {
    app.state.grade = String(grade.grade); app.state.topic = String(topic.id);
    for (const level of ['a','b','c']) {
      app.state.level = level;
      const matches = topic.sheets.filter((sheet: any)=>sheet.level===level || (level==='c' && sheet.level==='c2'));
      assert.deepEqual(app.topicSheets().map((sheet: any)=>sheet.pdfId), matches.map((sheet: any)=>sheet.pdfId));
      for (const sheet of topic.sheets) {
        if (sheet.level !== 'one') assert.equal(app.levelAllows(sheet), matches.some((candidate: any)=>candidate.pdfId===sheet.pdfId));
      }
      app.render();
      assert.equal(app.state.level, matches.length ? level : expectedLevel(topic));
    }
  }
});

test('level changes keep matching manual questions and carried sections without inventing a new selection', async () => {
  const app = picker();
  await app.applyWizardPrefill({grade:'1',topic:'1',level:'all',exerciseIds:[]});
  const groups = groupWholeQuestions(app.currentExercises());
  const chosen = ['a','b','c'].map(level=>groups.find((group: any)=>group.questions[0].source.level===level)!);
  const keys = (group: any)=>group.questions.map((question: any)=>`ex:${question.source.pdfId}:${question.id}`);
  app.state.selected = chosen.flatMap(keys);
  app.state.blocks = [{grade:'9',topic:'2',kind:'test',title:'Previously saved',keys:['ex:previous:1']}];
  const saved = structuredClone(app.state.blocks);
  await app.changeLevel('b');
  assert.deepEqual(app.state.selected, keys(chosen[1])); assert.deepEqual(app.state.blocks, saved);
  await app.changeLevel('all');
  assert.deepEqual(app.state.selected, keys(chosen[1])); assert.deepEqual(app.state.blocks, saved);
  assert.equal(app.topicSheets().length, 3);
  assert.equal(new URL(app.window.location.href).searchParams.get('level'), 'all');
});

test('undo after narrowing a level cannot restore hidden questions or alter saved sections', async () => {
  const app = picker();
  await app.applyWizardPrefill({grade:'1',topic:'1',level:'all',exerciseIds:[]});
  const groups = groupWholeQuestions(app.currentExercises());
  const a = groups.find((group: any)=>group.questions[0].source.level==='a')!;
  const b = groups.filter((group: any)=>group.questions[0].source.level==='b');
  const keys = (group: any)=>group.questions.map((question: any)=>`ex:${question.source.pdfId}:${question.id}`);
  app.toggleWholeQuestion(a.key, true); app.toggleWholeQuestion(b[0].key, true);
  app.state.blocks = [{grade:'9',topic:'2',kind:'review',title:'Saved section',keys:['ex:saved:1']}];
  const saved = structuredClone(app.state.blocks);
  await app.changeLevel('b'); app.undo();
  assert.equal(app.state.level, 'b'); assert.deepEqual(app.state.selected, keys(b[0]));
  assert.deepEqual(app.state.blocks, saved);
  assert.equal(new URL(app.window.location.href).searchParams.get('level'), 'b');
  app.toggleWholeQuestion(b[1].key, true);
  assert.equal(app.state.selected.length, keys(b[0]).length + keys(b[1]).length);
  app.undo();
  assert.deepEqual(app.state.selected, keys(b[0]), 'Ordinary undo within the visible level still restores whole questions');
  assert.deepEqual(app.state.blocks, saved);
});

function wizardView() {
  const { document } = parseHTML(read('../public/teachers/index.html'));
  const state = {wizard:'setup',level:'b',selected:[] as string[],blocks:[] as {keys:string[]}[]};
  return new Function('document','state','groupWholeQuestions',`
    const topicSearch = null;
    let aiPickPending=0,wizardNavigating=false;
    const clearPreparedPrint=()=>{};
    const $=id=>document.getElementById(id),WIZARD_ORDER=['setup','purpose','pick','result'];
    const source={pdfId:'source'};
    const library=new Map([
      ['ex:source:1א',{id:'1א',q:1,source}],
      ['ex:source:1ב',{id:'1ב',q:1,source}],
      ['ex:source:2',{id:'2',q:2,source}],
    ]);
    ${['allSelectedKeys','blockQuestionCount','levelPrintName','applyWizard'].map(definition).join('\n')}
    return {document,state,apply:applyWizard,
      pending(value){aiPickPending=value;applyWizard();},
      navigating(value){wizardNavigating=value;applyWizard();}};
  `)(document,state,groupWholeQuestions);
}

test('one accessible level radio group stays in setup and picking shows its selected level without asking again', () => {
  const { document, state, apply } = wizardView();
  const field = document.getElementById('teacher-level-choice'); assert.ok(field);
  const group = document.getElementById('level-filter'); assert.ok(group);
  const inputs = [...group.querySelectorAll('input[name=level]')];
  assert.deepEqual(inputs.map(input=>input.getAttribute('value')), ['a','b','c']);
  const selected = inputs.find(input=>input.getAttribute('value')==='b') as any;
  selected.checked = true;
  for (const step of ['setup','pick','purpose','pick','result','setup']) {
    state.wizard = step; apply();
    assert.equal(field.parentElement?.id, 'wizard-level-home');
    assert.equal(document.querySelectorAll('#teacher-level-choice').length, 1);
    assert.equal(document.querySelectorAll('input[name=level]').length, 3);
    assert.equal(document.getElementById('level-filter'), group);
    assert.equal(selected.checked, true, 'Changing steps must not recreate or reset the level inputs');
    assert.equal(field.classList.contains('wiz-off'), step !== 'setup');
    if(step==='pick') {
      assert.equal(document.getElementById('pick-level-summary').textContent, 'הרמה שנבחרה: רמה ב׳');
      const edit = document.querySelector('.pick-level-summary [data-review-edit="setup"]');
      assert.ok(edit);
      assert.equal(edit.closest('.wiz-off'), null, 'The chosen level has an explicit route back to settings');
    }
  }
});

test('bottom navigation counts unique whole questions and sections and blocks an empty or pending pick', () => {
  const app = wizardView();
  const next = app.document.getElementById('wizard-next');
  const summary = app.document.getElementById('wizard-selection-summary');
  assert.equal(next.closest('#wizard-actions').id, 'wizard-actions');
  app.apply();
  assert.equal(next.disabled, false, 'Setup can continue before questions have been selected');
  app.state.wizard='pick'; app.apply();
  assert.equal(next.disabled, true);
  assert.equal(summary.textContent, 'עדיין לא נבחרו שאלות');
  app.state.blocks=[{keys:['ex:source:1א','ex:source:1ב']}];
  app.state.selected=['ex:source:1ב','ex:source:2']; app.apply();
  assert.equal(summary.textContent, '2 שאלות · 3 סעיפים', 'Saved and current choices are counted without duplicates');
  assert.equal(next.disabled, false);
  app.pending(5); assert.equal(next.disabled, true, 'A pending AI choice cannot be printed prematurely');
  app.pending(0); assert.equal(next.disabled, false);
  app.navigating(true); assert.equal(next.disabled, true, 'Repeated next actions cannot advance twice');
  app.navigating(false); assert.equal(next.disabled, false);
  app.state.selected=[]; app.apply();
  assert.equal(summary.textContent, 'שאלה אחת · 2 סעיפים');
  assert.equal(next.disabled, false, 'A saved topic alone remains printable');
  app.state.wizard='result'; app.apply();
  assert.equal(next.hidden, true);
});
