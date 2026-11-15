import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const viewer = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
function section(start: string, end: string) {
  const from = viewer.indexOf(start), to = viewer.indexOf(end, from);
  assert(from >= 0 && to > from, 'production observer functions must exist');
  return viewer.slice(from, to);
}
const reportControl = section('  function ensureReportControl(){', '  function layoutQuestionHits(){');
const scheduling = section('  function schedule(){', "  fab.addEventListener('click',function(){initialWideOpened=true;});");
const observation = section('  observer.observe(panel,{', '  observer.observe(fab,{');
const drain = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture(active: boolean) {
  const { document, window } = parseHTML(`<html><body>
    <button id="fab"></button>
    <button class="noam-exercise-pin${active ? ' is-active' : ''}" data-exercise-id="G9-T85-B-Q01א"></button>
    <button class="noam-report-pin" data-exercise-id="G9-T85-B-Q01א"></button>
    <div id="panel"><div class="noam-thread-tools"></div><span class="noam-picked-label">סעיף א</span></div>
  </body></html>`);
  const panel = document.querySelector('#panel')!;
  let reportClicks = 0;
  document.querySelector('.noam-report-pin')!.addEventListener('click', () => reportClicks++);
  // Use the production control, schedule(), callback and observation options.
  // The bounded wrapper only prevents a regressed microtask loop from hanging CI.
  const api = runInNewContext(reportControl + scheduling + `
    var scheduled=false, helpReadyObserved=false, calls=0, capped=false, changes=[];
    function sync(){scheduled=false;ensureReportControl();}
    var observer=new MutationObserver(function(records){
      calls++;
      changes.push(...records.map(function(r){return {attribute:r.attributeName,target:r.target.className};}));
      if(calls>=32){capped=true;observer.disconnect();return;}
      observeHelpAvailability(records);
    });
    ` + observation + `
    ({ensureReportControl,disconnect:()=>observer.disconnect(),
      stats:()=>({calls,capped,changes:changes.slice()})});`, {
    document, panel, panelBody: panel, fab: document.querySelector('#fab'),
    MutationObserver: window.MutationObserver, queueMicrotask,
  });
  return { document, api, reportClicks: () => reportClicks };
}

test('the DOM observer reports repeated hidden=true writes, including unchanged values', async () => {
  const { document, window } = parseHTML('<button hidden></button>');
  const button = document.querySelector('button')!;
  const changes: string[] = [];
  const observer = new window.MutationObserver(records => changes.push(...records.map(r => r.attributeName!)));
  observer.observe(button, { attributes: true, attributeFilter: ['hidden'] });
  try {
    button.hidden = true; button.hidden = true;
    await drain();
    assert.deepEqual(changes, ['hidden', 'hidden'], 'the regression must exercise real repeated attribute notifications');
  } finally { observer.disconnect(); }
});

test('a report control without an active PDF pin settles instead of rescheduling forever', async () => {
  const { document, api } = fixture(false);
  try {
    api.ensureReportControl();
    await drain();
    assert.equal(api.stats().capped, false, 'hidden report control entered a MutationObserver loop');
    assert(api.stats().calls <= 2, 'creation must converge after its initial mutation delivery');
    assert.equal((document.querySelector('.exact-report') as HTMLButtonElement).hidden, true);
    const settled = api.stats().calls;
    api.ensureReportControl(); api.ensureReportControl();
    await drain();
    assert.equal(api.stats().calls, settled, 'stable hidden control must not write hidden again');
    assert.equal(document.querySelectorAll('.exact-report').length, 1);
  } finally { api.disconnect(); }
});

test('switching א to ד without a PDF pin hides once and switching back restores reporting', async () => {
  const { document, api, reportClicks } = fixture(true);
  try {
    api.ensureReportControl();
    await drain();
    const button = document.querySelector('.exact-report') as HTMLButtonElement;
    assert.equal(button.hidden, false);
    const before = api.stats().calls;
    document.querySelector('.noam-exercise-pin')!.classList.remove('is-active');
    document.querySelector('.noam-picked-label')!.textContent = 'סעיף ד';
    await drain();
    assert.equal(api.stats().capped, false, 'subitem transition entered a MutationObserver loop');
    assert.equal(button.hidden, true);
    assert(api.stats().calls - before <= 2, 'selection change and hide must converge');
    const settled = api.stats().calls;
    api.ensureReportControl(); api.ensureReportControl();
    await drain();
    assert.equal(api.stats().calls, settled);
    document.querySelector('.noam-exercise-pin')!.classList.add('is-active');
    document.querySelector('.noam-picked-label')!.textContent = 'סעיף א';
    await drain();
    assert.equal(api.stats().capped, false);
    assert.equal(button.hidden, false);
    button.click();
    assert.equal(reportClicks(), 1, 'the original report action still targets the active exercise');
    assert.strictEqual(document.querySelector('.exact-report'), button);
    assert.equal(document.querySelectorAll('.exact-report').length, 1);
  } finally { api.disconnect(); }
});
