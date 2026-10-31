import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const viewer = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
const section = (name: string, next: string) => viewer.slice(viewer.indexOf(`function ${name}(`), viewer.indexOf(`function ${next}(`));

test('a failed chat keeps the original question and source figure accessible, with opt-in text zoom', () => {
  const { document, window } = parseHTML('<html><body><button id="back"></button><div id="panel"></div></body></html>');
  const panelBody = document.querySelector('#panel')!;
  const selectedExercise = { id: 'g7-t19-a-q1b', q: 1, part: 'ב', text: 'העבירו גובה במשולש', crop: {} };
  const thread = { messages: [{ role: 'assistant', text: 'בדיקת האבטחה נכשלה', answerError: true }], history: [], hintIndex: 0 };
  const api = runInNewContext(section('showExercisePreview', 'renderExercisePreview') + section('renderNoamChat', 'localVisualExerciseSource') + `
    function renderExercisePreview(exercise){showExercisePreview(exercise,'data:image/png;base64,original-question');}
    ({renderNoamChat})`, {
    document, window, panelBody, selectedExercise, panelBack: document.querySelector('#back'),
    activeGlossaryEntryId: null, mathKeyboardOpen: false, noamDrafts: {}, busy: false,
    hideNoamGlossaryPopover() {}, exerciseThread: () => thread, noamLatestDrawingAnswer: () => null,
    exerciseLabel: () => 'שאלה 1 · סעיף ב', esc: (text: string) => text,
    noamManifestOcrUnreliable: () => false,
    noamNativeFigure() {
      const figure = document.createElement('figure');
      figure.innerHTML = '<img src="/noam-ai/native/G7-T19/a/figures/q1b.svg" alt="השרטוט של סעיף ב">';
      return figure;
    },
    noamAddDiagramExpansion() {}, renderNoamAttachments() {},
    addTranscriptBubble(transcript: any, role: string, text: string) {
      const row = document.createElement('div'); row.className = 'noam-row ' + role;
      row.textContent = text; transcript.appendChild(row); return row;
    },
    locateSelectedExercise() {}, setNoamBusy() {}, renderPanelMath() {}, enhanceNoamGlossary() {}, restoreNoamChatFocus() {},
  });
  api.renderNoamChat();
  const toggle = document.getElementById('noamPreviewToggle')!;
  assert.ok(toggle, 'error must not remove question access');
  toggle.click();
  assert.equal(panelBody.classList.contains('is-previewing'), true);
  const crop = document.querySelector('.noam-question-crop')!;
  assert.equal(crop.classList.contains('is-zoomed'), false, 'show the whole width first');
  assert.equal(crop.querySelector('img')!.getAttribute('src'), 'data:image/png;base64,original-question');
  const source = document.querySelector('#noamPickedPreview details img')!;
  assert.equal(source.getAttribute('src'), '/noam-ai/native/G7-T19/a/figures/q1b.svg');
  const zoom = document.querySelector('.noam-preview-zoom')!;
  zoom.click();
  assert.equal(crop.classList.contains('is-zoomed'), true);
  assert.equal(zoom.getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('.noam-preview-pan-help')!.hidden, false);
  zoom.click();
  assert.equal(crop.classList.contains('is-zoomed'), false);
  assert.equal(document.querySelector('.noam-preview-pan-help')!.hidden, true);
  toggle.click();
  assert.equal(panelBody.classList.contains('is-previewing'), false);
  assert.equal(document.querySelector('#noamTranscript')!.textContent, 'בדיקת האבטחה נכשלה');
  assert.equal(thread.messages.length, 1, 'preview is not a new request or reset');
  assert.match(viewer, /\.panel-body\.is-previewing \.noam-question-crop>img\{[^}]*width:100%;max-width:100%/);
  assert.doesNotMatch(viewer, /\.panel-body\.is-previewing \.noam-picked-preview img\{width:720px/);
});

test('switching parts clears the previous announcement and cancels its queued live update', () => {
  const { document } = parseHTML('<html><body><div id="noamAnnouncements">שאלה 1 סעיף א: שגיאה</div><div id="panel"></div></body></html>');
  const pending = new Map<number, () => void>();
  let nextTimer = 0;
  const api = runInNewContext(section('clearNoamAnnouncement', 'restoreNoamChatFocus') + section('selectManifestExercise', 'renderExercisePicker') + '\n({announceNoam,selectManifestExercise})', {
    document, noamAnnouncementTimer: null, selectedExercise: { id: 'q1a' }, selectedPin: null,
    panelBody: document.getElementById('panel'), exerciseThread() {}, openNoamPanel() {}, renderNoamChat() {},
    setTimeout(fn: () => void) { const id = ++nextTimer; pending.set(id, fn); return id; },
    clearTimeout(id: number) { pending.delete(id); },
  });
  api.announceNoam('שאלה 1 סעיף א: הבקשה נכשלה');
  assert.equal(pending.size, 1);
  api.selectManifestExercise({ id: 'q1b' }, null);
  assert.equal(pending.size, 0);
  assert.equal(document.getElementById('noamAnnouncements')!.textContent, '');
});

test('a late answer or failure does not announce the old part after the student switches', async () => {
  for (const fail of [false, true]) {
    const announcements: string[] = [];
    const sourceHints: any[] = [];
    const requestedParts: string[] = [];
    let finishAnalysis: (value: object) => void = () => {};
    const thread = { hintIndex: 0, messages: [] as any[], history: [] as any[] };
    const context: any = {
      document: { activeElement: null }, panelBody: { contains: () => false },
      selectedExercise: { id: 'q1a' }, busy: false, noamDrafts: {}, exerciseThread: () => thread,
      saveNoamState() {}, setNoamBusy() {}, renderNoamChat() {}, restoreNoamChatFocus() {},
      announceNoam: (text: string) => announcements.push(text), exerciseLabel: (e: any) => e.id,
      noamDidacticGuide: () => null, noamDidacticPrompt: () => '', noamDidacticResponse: () => null,
      getExerciseAnalysis: () => new Promise(resolve => { finishAnalysis = resolve; }),
      noamEnrichSourceAnalysis: async (_exercise: any, analysis: any) => analysis,
      noamSolverMessage: () => '', postJson: (_url: string, payload: any) => {
        requestedParts.push(payload.exerciseId);
        return fail ? Promise.reject(new Error('security failure')) : Promise.resolve({ ok: true, answer: 'an additional explanation for q1a' });
      },
      noamGuardGeometryResult: (result: any) => result, noamGuardSignedAddResult: (result: any) => result,
      noamClarifySignedAddLanguage: (answer: string) => answer, noamResponseVisual: () => null,
      noamVisualAnswer: (_message: string, answer: string) => answer,
      // Additional questions keep their requested section's identity; source
      // drawings require a separate explicit action covered by the native suite.
      noamAttachSourceHint: (...args: any[]) => { sourceHints.push(args); return Promise.resolve(null); },
      ttl: '', g: 7, lv: 'a', LEVEL: { a: 'א׳' }, API: '/test', MIN_WAIT: 0,
      setTimeout: (fn: () => void, ms: number) => { if (ms < 25000) fn(); return 0; },
    };
    runInNewContext(section('askNoam', 'noamRetryActionLabel') + '\naskNoam("free_question", "אפשר להסביר את הנתונים בסעיף הזה?");', context);
    context.selectedExercise = { id: 'q1b' };
    await Promise.resolve(); // The additional-question reader starts on the next microtask.
    finishAnalysis({ readable: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(thread.messages.length, 2, 'the old part still receives its own response');
    assert.equal(Boolean(thread.messages[1].answerError), fail);
    assert.deepEqual(requestedParts, ['q1a'], 'the solve remains bound to the originally requested part');
    assert.equal(sourceHints.length, 0, 'additional questions do not automatically attach a source drawing');
    if (!fail) {
      assert.equal(thread.messages[1].text, 'an additional explanation for q1a');
    }
    assert.equal(thread.hintIndex, 0, 'late additional replies do not consume a prepared hint');
    assert.equal(announcements.length, 1, 'only the initial request was announced before switching');
  }
});
