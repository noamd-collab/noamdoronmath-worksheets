import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const shipped = readFileSync(new URL('../public/teachers/generation.js', import.meta.url), 'utf8');
const topic = { topicId: 'ג10', gradeNumber: 3, title: 'חילוק', enabled: true, e2eVerified: true, levels: ['b'], questionCounts: [12] };
const middle = { ...topic, topicId: 'g7:equations', gradeNumber: 7, title: 'משוואות', questionCounts: [20] };
const disabled = { ...topic, topicId: 'candidate', gradeNumber: 3, enabled: false };
type Reply = { ok?: boolean; body?: any; error?: Error };

function harness(options: { online?: boolean; jobs?: any[]; captcha?: boolean } = {}) {
  const { document, window } = parseHTML(`<!doctype html><html><head></head><body>
    <p id="generator-availability"></p><form id="generation-form">
      <select name="gradeNumber" required><option value="">בחרו</option><option value="3">כיתה ג׳</option><option value="7">כיתה ז׳</option><option value="8">כיתה ח׳</option></select>
      <select name="topicId" required disabled><option value="">בחרו</option></select>
      <select name="level"><option value="b">רמה ב׳</option><option value="a">רמה א׳</option><option value="e">מצוינות</option></select>
      <select name="lessonGoal"><option value="practice">תרגול</option><option value="review">חזרה</option></select>
      <textarea name="lastLesson" required>חילוק בתחום לוח הכפל</textarea><textarea name="alreadyLearned">כפל; חילוק\nמספרים</textarea>
      <input name="minutes" type="number" value="30" min="10" max="120" required>
      <input name="questionCount" type="number" value="12" min="8" max="30" required>
      <p id="volume-help"></p><button id="plan-button" type="submit" disabled>תכנון</button>
    </form>
    <section id="generation-plan" hidden><h2 id="plan-title"></h2><dl id="plan-details"></dl><button id="create-button">יצירה</button><button id="edit-plan">שינוי</button></section>
    <p id="generation-status"></p><p id="history-empty"></p><div id="generation-jobs"></div>
  </body></html>`);
  const form = document.getElementById('generation-form') as any;
  const fields = new Map(Array.from(form.querySelectorAll('[name]')).map((el: any) => [el.getAttribute('name'), el]));
  Object.defineProperty(form, 'elements', { value: { namedItem: (name: string) => fields.get(name) } });
  // Browser properties absent/incomplete in linkedom; user handlers remain unmodified.
  for (const select of form.querySelectorAll('select') as any) {
    let selected = select.querySelector('option')?.getAttribute('value') || '';
    Object.defineProperty(select, 'options', { get: () => Array.from(select.querySelectorAll('option')) });
    Object.defineProperty(select, 'value', {
      get: () => select.options.some((o: any) => o.value === selected) ? selected : select.options[0]?.value || '',
      set: (value: string) => { selected = String(value); },
    });
    Object.defineProperty(select, 'selectedOptions', { get: () => select.options.filter((o: any) => o.value === select.value) });
  }
  form.reportValidity = () => [...fields.values()].every((el: any) => {
    if (el.disabled) return true;
    if (el.hasAttribute('required') && !el.value) return false;
    return el.type !== 'number' || (Number(el.value) >= Number(el.min || '-Infinity') && Number(el.value) <= Number(el.max || 'Infinity'));
  });
  for (const el of document.querySelectorAll('[id]') as any) el.focus = () => {};
  Object.defineProperty(document, 'hidden', { value: false });
  let online = options.online ?? true, jobs = options.jobs || [], uuid = 0, timer = 0;
  const timers = new Map<number, { callback: () => unknown; delay: number }>();
  const calls: { url: string; init: any }[] = [], posts: any[] = [], pendingReplies: Reply[] = [], pendingReads: Reply[] = [];
  let tokenPromise: Promise<string> | null = null;
  const verification = { ready: (cb: () => void) => cb(), execute: () => tokenPromise || Promise.resolve('local-verification-token') };
  (window as any).grecaptcha = options.captcha !== false ? verification : undefined;
  const fetchLocal = async (url: string, init: any = {}) => {
    calls.push({ url, init });
    if (url === '/api/noamBotConfig') return { ok: true, json: async () => ({ ok: true, active: true, siteKey: 'K'.repeat(40) }) };
    assert.equal(url, '/api/teacherGeneration', 'all requests are intercepted locally');
    if (init.method === 'POST') {
      posts.push(JSON.parse(init.body));
      const reply = pendingReplies.shift() || {};
      if (reply.error) throw reply.error;
      return { ok: reply.ok ?? true, json: async () => reply.body || { ok: true } };
    }
    const reply = pendingReads.shift() || {};
    if (reply.error) throw reply.error;
    return { ok: reply.ok ?? true, json: async () => reply.body || ({ ok: true, online, jobs: structuredClone(jobs), capabilities: { topics: [topic, middle, disabled] } }) };
  };
  vm.runInNewContext(shipped, {
    document, window, fetch: fetchLocal, crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
    AbortSignal: { timeout: () => undefined }, Date, console,
    setTimeout: (callback: () => unknown, delay: number) => { timers.set(++timer, { callback, delay }); return timer; },
    clearTimeout: (id: number) => timers.delete(id), setInterval: () => ++timer, clearInterval: () => {},
  });
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
  const element = (id: string) => document.getElementById(id) as any;
  const field = (name: string) => fields.get(name) as any;
  const dispatch = async (el: any, type: string) => { el.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true })); await flush(); };
  return { document, window, form, field, element, calls, posts, pendingReplies, pendingReads, timers, flush,
    setOnline(value: boolean) { online = value; }, setJobs(value: any[]) { jobs = value; },
    holdToken(value: Promise<string>) { tokenPromise = value; },
    async choose(grade = '3', id = 'ג10') { field('gradeNumber').value = grade; await dispatch(field('gradeNumber'), 'change'); field('topicId').value = id; await dispatch(field('topicId'), 'change'); },
    submit: () => dispatch(form, 'submit'), click: (id: string) => dispatch(element(id), 'click'),
    visible: () => dispatch(document, 'visibilitychange'),
    async poll() { const selected = [...timers].find(([, task]) => task.delay === 4000); assert.ok(selected, 'poll scheduled'); timers.delete(selected[0]); await selected[1].callback(); await flush(); },
    async nextRetry() { const selected = [...timers][0]; assert.ok(selected, 'retry scheduled'); timers.delete(selected[0]); await selected[1].callback(); await flush(); return selected[1].delay; },
  };
}

test('offline state blocks planning and emits no creation or verification request', async () => {
  const app = harness({ online: false }); await app.flush(); await app.choose(); await app.submit(); await app.click('create-button');
  assert.equal(app.element('plan-button').disabled, true);
  assert.equal(app.form.hidden, false);
  assert.equal(app.posts.length, 0);
  assert.equal(app.calls.some(c => c.url === '/api/noamBotConfig'), false);
});

test('planning uses enabled exact topic/level/count and makes no billed request', async () => {
  const app = harness(); await app.flush(); await app.choose();
  assert.deepEqual(Array.from(app.field('topicId').options, (o: any) => o.value), ['', 'ג10']);
  assert.equal(app.field('questionCount').value, '12'); assert.equal(app.field('questionCount').readOnly, true);
  assert.equal(app.field('level').options.find((o: any) => o.value === 'a').disabled, true);
  assert.equal(app.field('level').options.find((o: any) => o.value === 'e').disabled, true);
  await app.submit(); assert.equal(app.form.hidden, true); assert.equal(app.element('generation-plan').hidden, false);
  assert.match(app.element('plan-details').textContent, /12 שאלות/); assert.equal(app.posts.length, 0);
  await app.click('edit-plan'); await app.choose('7', 'g7:equations');
  assert.equal(app.field('questionCount').value, '20'); assert.equal(app.field('questionCount').min, '20'); assert.equal(app.field('questionCount').max, '20');
});

test('one in-flight verification prevents double submit, including a visibility refresh', async () => {
  const app = harness(); await app.flush(); await app.choose(); await app.submit();
  let finish!: (token: string) => void;
  app.holdToken(new Promise(resolve => { finish = resolve; }));
  await app.click('create-button'); await app.visible(); await app.click('create-button');
  app.setJobs([{ id: 'job-one', status: 'queued', phase: 'queued', created_at: '2026-11-12T00:00:00Z', lesson: {} }]);
  finish('verified-token'); await app.flush();
  assert.equal(app.posts.length, 1); assert.equal(app.element('create-button').disabled, true);
  assert.equal(app.element('edit-plan').disabled, true);
});

test('network retry preserves idempotency, editing creates a new request key', async () => {
  const app = harness(); await app.flush(); await app.choose(); await app.submit();
  app.pendingReplies.push({ error: new Error('Temporary local transport failure') }); await app.click('create-button');
  assert.equal(app.element('edit-plan').disabled, false); assert.equal(app.posts.length, 1);
  await app.click('refresh-generation'); assert.equal(app.posts.length, 1, 'manual status check does not enqueue');
  await app.click('create-button'); assert.equal(app.posts.length, 2); assert.equal(app.posts[0].requestKey, app.posts[1].requestKey);
  assert.deepEqual(app.posts[1].lesson.alreadyLearned, ['כפל', 'חילוק', 'מספרים']);
  await app.click('edit-plan'); app.field('lastLesson').value = 'תרגול חדש בתוך אותו נושא'; await app.submit(); await app.click('create-button');
  assert.notEqual(app.posts[2].requestKey, app.posts[0].requestKey);
});

test('completed and failed requests need an explicit new-draft action before a fresh key is issued', async () => {
  for (const terminalStatus of ['needs_review', 'failed']) {
    const app = harness(); await app.flush(); await app.choose(); await app.submit();
    const active = { id: 'first-job', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: { topicId: 'ג10' } };
    app.pendingReplies.push({ body: { ok: true, job: { id: active.id } } }); app.setJobs([active]);
    await app.click('create-button'); assert.equal(app.posts.length, 1);
    app.setJobs([{ ...active, status: terminalStatus, phase: terminalStatus, result: { automatedChecksPassed: terminalStatus === 'needs_review' } }]);
    await app.poll();
    assert.equal(app.element('create-button').hidden, true); assert.equal(app.element('new-generation').hidden, false);
    await app.click('create-button'); assert.equal(app.posts.length, 1, 'old creation control cannot resubmit a terminal request');
    await app.click('new-generation'); assert.equal(app.form.hidden, false); assert.equal(app.element('generation-plan').hidden, true);
    await app.submit(); app.pendingReplies.push({ body: { ok: true, job: { id: 'second-job' } } });
    app.setJobs([{ ...active, id: 'second-job' }]); await app.click('create-button');
    assert.equal(app.posts.length, 2); assert.notEqual(app.posts[0].requestKey, app.posts[1].requestKey);
  }
});

test('one failed poll recovers with a bounded GET retry and never enqueues again', async () => {
  const active = { id: 'active', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: {} };
  const app = harness({ jobs: [active] }); await app.flush();
  app.pendingReads.push({ error: new Error('Transient local poll failure') }); await app.poll();
  assert.equal(app.element('refresh-generation').hidden, false); assert.equal(app.element('create-button').disabled, true);
  app.setJobs([{ ...active, status: 'needs_review', result: { automatedChecksPassed: true } }]);
  assert.equal(await app.nextRetry(), 2000);
  assert.equal(app.element('edit-plan').disabled, false); assert.equal(app.document.querySelectorAll('#generation-jobs a').length, 2);
  assert.equal(app.posts.length, 0);
});

test('poll failures stop after three automatic retries and visible manual refresh recovers', async () => {
  const active = { id: 'active', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: {} };
  const app = harness({ jobs: [active] }); await app.flush();
  app.pendingReads.push(...Array.from({ length: 4 }, () => ({ error: new Error('Offline fixture') })));
  await app.poll();
  for (const delay of [2000, 4000, 8000]) assert.equal(await app.nextRetry(), delay);
  assert.equal(app.timers.size, 0, 'automatic retries are bounded');
  assert.equal(app.element('refresh-generation').hidden, false); assert.equal(app.element('refresh-generation').disabled, false);
  assert.equal(app.element('create-button').disabled, true, 'unknown running state must not permit a fresh task');
  assert.match(app.element('generation-status').textContent, /רענון מצב היצירה/);
  app.setJobs([{ ...active, status: 'failed', phase: 'failed' }]); await app.click('refresh-generation');
  assert.equal(app.element('edit-plan').disabled, false); assert.equal(app.posts.length, 0);
});

test('knowledge context accepts120 characters and rejects121 before planning or CAPTCHA', async () => {
  const app = harness(); await app.flush(); await app.choose();
  app.field('alreadyLearned').value = 'א'.repeat(120); await app.submit(); assert.equal(app.form.hidden, true);
  await app.click('edit-plan'); app.field('alreadyLearned').value = 'א'.repeat(121); await app.submit();
  assert.equal(app.form.hidden, false); assert.equal(app.element('generation-plan').hidden, true);
  assert.match(app.element('generation-status').textContent, /120/);
  assert.equal(app.posts.length, 0); assert.equal(app.calls.some(call => call.url === '/api/noamBotConfig'), false);
});

test('completion unlocks editing and exposes only gated PDF/Word download links', async () => {
  const active = { id: 'job&one', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: { topicId: 'ג10', lastLesson: 'לוח הכפל' } };
  const app = harness({ jobs: [active] }); await app.flush();
  assert.equal(app.element('create-button').disabled, true);
  app.setJobs([{ ...active, status: 'needs_review', phase: 'needs_review', result: { automatedChecksPassed: true } }]); await app.poll();
  assert.equal(app.element('edit-plan').disabled, false);
  const links = [...app.document.querySelectorAll('#generation-jobs a')];
  assert.equal(links.length, 2); assert.equal(links[0].getAttribute('href'), '/api/teacherGeneration?id=job%26one&file=pdf');
  app.setJobs([{ ...active, status: 'needs_review', result: { automatedChecksPassed: false } }]); await app.visible();
  assert.equal(app.document.querySelectorAll('#generation-jobs a').length, 0);
});

test('history and plan treat model/user strings as text, never HTML', async () => {
  const attack = '<img src=x onerror="globalThis.pwned=true"><script>evil()</script>';
  const app = harness({ jobs: [{ id: 'safe', status: 'failed', created_at: '2026-11-12T00:00:00Z', lesson: { lastLesson: attack } }] });
  await app.flush(); await app.choose(); app.field('lastLesson').value = attack; await app.submit();
  assert.equal(app.document.querySelectorAll('img,script').length, 0);
  assert.ok(app.element('generation-jobs').textContent.includes(attack)); assert.ok(app.element('plan-details').textContent.includes(attack));
});

test('captcha script failure permits a fresh load on retry without creating a job', async () => {
  const app = harness({ captcha: false }); await app.flush(); await app.choose(); await app.submit(); await app.click('create-button');
  const first = app.document.querySelector('script') as any; assert.ok(first); first.onerror(); await app.flush();
  assert.equal(app.posts.length, 0); assert.equal(app.element('edit-plan').disabled, false);
  await app.click('create-button'); const second = app.document.querySelector('script') as any;
  assert.ok(second); assert.notEqual(second, first); second.onerror(); await app.flush();
  assert.equal(app.posts.length, 0);
});

test('unsupported grade cannot be planned through an implicit form submit', async () => {
  const app = harness(); await app.flush(); await app.choose('8', ''); await app.submit();
  assert.equal(app.form.hidden, false); assert.equal(app.element('generation-plan').hidden, true);
});
