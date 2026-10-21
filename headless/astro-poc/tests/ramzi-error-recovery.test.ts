import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const viewer = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
const section = (name: string, next: string) => viewer.slice(viewer.indexOf(`  function ${name}(`), viewer.indexOf(`  function ${next}(`));
const functions = section('rowText', 'inferCheckIntent') +
  section('preserveFailedReplies', 'userContent') +
  section('submitUnderstanding', 'hasPendingMath');

test('security failure stays an error with its retry action through repeated decoration and understanding clicks', () => {
  const { document } = parseHTML(`<html><body><div id="panel"><div id="noamTranscript">
    <div class="noam-row user"><div class="noam-bubble"><span class="noam-kind">רמז 1</span><span>אפשר רמז 1?</span></div></div>
    <div class="noam-row assistant exact-hint"><div class="noam-bubble"><div class="exact-hint-head">רמז 1 מתוך 3</div><span class="noam-sr-only">נועם AI:</span><span id="reason">לא הצלחנו לאמת את הבקשה. נסו שוב בעוד רגע.</span><button class="noam-retry-action">נסו שוב את בדיקת האבטחה</button></div></div>
  </div></div></body></html>`);
  const retry = document.querySelector('.noam-retry-action')! as any;
  let focusCount = 0;
  retry.focus = () => { focusCount++; };
  const api = runInNewContext(functions + '\n({decorateConversation,submitUnderstanding})', {
    document, window: {}, panelBody: document.querySelector('#panel'), pendingCheckFocus: false,
    schedule() {}, veilStudentPrompts() {}, replayLocalChecks() {}, prefixRetryLead() {}, isolateMath() {}, shapeReading() {},
    currentExerciseId() { throw new Error('failed reply must not advance or request a new explanation'); },
  });
  for (let i = 0; i < 3; i++) {
    api.decorateConversation();
    api.submitUnderstanding('not-understood');
    api.submitUnderstanding('understood');
  }
  assert.equal(document.querySelector('#reason')!.textContent, 'לא הצלחנו לאמת את הבקשה. נסו שוב בעוד רגע.');
  assert.strictEqual(document.querySelector('.noam-retry-action'), retry);
  assert.equal(document.querySelectorAll('.exact-hint-head').length, 0);
  assert.equal(document.querySelectorAll('.exact-error-title').length, 1);
  assert.equal(document.querySelector('.noam-row.assistant')!.getAttribute('role'), 'alert');
  assert.equal(document.querySelectorAll('.ramzi-check').length, 1);
  assert.equal(document.querySelectorAll('.ramzi-check button').length, 2);
  assert.equal(document.querySelectorAll('.noam-row').length, 2);
  assert.equal(focusCount, 6);
  const row = document.querySelector('.noam-row.assistant')!;
  row.classList.add('is-dismissed');
  api.submitUnderstanding('not-understood');
  assert.equal(row.classList.contains('is-dismissed'), false, 'retry must be visible before focusing it');
  assert.equal(focusCount, 7);
});

test('a successful geometry hint exposes drawing without special user wording; failure and existing drawings do not', () => {
  const start = viewer.indexOf('function noamCanOfferDrawing(');
  const end = viewer.indexOf('function noamConstructedVisual(');
  const api = runInNewContext(viewer.slice(start, end) + '\n({noamCanOfferDrawing})', {
    window: { NoamLocalVisual: { wantsVisualSupport: () => false } },
    ttl: 'דלתון', localVisualExerciseSource: () => 'מרובע וצלעות', noamRecentThreadText: () => '',
    noamGeometryContext: (text: string) => /דלתון/.test(text),
    noamNativeFocusUrl: () => null,
    noamRenderAiDiagram: () => ({}), noamRenderGeometryGuide: () => ({}),
  });
  const user = { role: 'user', kind: 'רמז 1', text: 'אפשר רמז 1?' };
  const answer = { role: 'assistant', text: 'באילו קודקודים נפגשות שתי צלעות השוות זו לזו?' };
  const thread = { messages: [user, answer], history: [] };
  assert.equal(api.noamCanOfferDrawing({ id: 'kite' }, thread, answer), true);
  assert.equal(api.noamCanOfferDrawing({ id: 'kite' }, thread, { ...answer, answerError: true }), false);
  assert.equal(api.noamCanOfferDrawing({ id: 'kite' }, thread, { ...answer, visual: { type: 'ai-diagram' } }), false);
  assert.equal(api.noamCanOfferDrawing({ id: 'kite' }, { messages: [{ ...user, kind: '', text: 'שלום' }, answer] }, answer), false);
});

test('decorating stable hint and overview failures does not retrigger the class MutationObserver', async () => {
  for (const kind of ['רמז 1', 'הסבר כללי']) {
    const { document, window } = parseHTML(`<html><body><div id="panel"><div id="noamTranscript">
      <div class="noam-row user"><div class="noam-bubble"><span class="noam-kind">${kind}</span></div></div>
      <div class="noam-row assistant" data-ramzi-confirmed="1"><div class="noam-bubble"><span>בדיקת האבטחה נכשלה</span><button class="noam-retry-action">נסו שוב</button></div></div>
    </div></div></body></html>`);
    const api = runInNewContext(functions + '\n({decorateConversation})', {
      document, window: {}, panelBody: document.querySelector('#panel'), pendingCheckFocus: false,
      schedule() {}, veilStudentPrompts() {}, replayLocalChecks() {}, prefixRetryLead() {}, isolateMath() {}, shapeReading() {},
    });
    api.decorateConversation();
    const mutations: any[] = [];
    const observer = new window.MutationObserver(records => mutations.push(...records));
    observer.observe(document.querySelector('#panel')!, { attributes: true, subtree: true, attributeFilter: ['class'], childList: true });
    api.decorateConversation(); api.decorateConversation();
    await new Promise(resolve => setImmediate(resolve));
    mutations.push(...observer.takeRecords()); observer.disconnect();
    assert.equal(mutations.length, 0, kind + ': stable decoration must not schedule another sync');
  }
});
