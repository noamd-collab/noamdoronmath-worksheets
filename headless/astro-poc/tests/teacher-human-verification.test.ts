import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { dismissTeacherHumanVerification, requestTeacherHumanVerification } from '../public/teachers/teacher-human-verification.js';

// Real UI module, simulated Google client: no live verification or AI requests.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function page(expiresAt = Date.now() + 10000) {
  const { document, window } = parseHTML('<html><head></head><body><button id="opener">AI</button><p id="status"></p><button id="manual">שאלה 1</button></body></html>');
  window.AbortController = AbortController;
  let focused: unknown = document.getElementById('opener');
  Object.defineProperty(document, 'activeElement', { get: () => focused });
  window.HTMLElement.prototype.focus = function () { focused = this; };
  let current = true, calls = 0, submits = 0;
  let complete: (token: string) => void = () => { throw new Error('Not opened'); };
  let reject: (error: Error) => void = () => { throw new Error('Not opened'); };
  let signal: AbortSignal | undefined;
  let dispose: () => void = () => {};
  const config = {
    challenge: { provider: 'recaptcha-v2', siteKey: 'synthetic-site-key', requestToken: 'synthetic-ticket', expiresAt },
    anchor: document.getElementById('status'), isCurrent: () => current,
    onSubmitting: () => { submits += 1; },
    client: { completeChallenge(_challenge: unknown, container: HTMLElement, options: { signal: AbortSignal; onDispose: () => void }) {
      calls += 1; signal = options.signal;
      dispose = options.onDispose;
      assert.equal(container.hidden, false);
      const ownerDetails = document.createElement('p');
      ownerDetails.className = 'synthetic-google-owner-details';
      ownerDetails.textContent = 'Synthetic provider details, not a diagnosed cause';
      container.append(ownerDetails);
      return new Promise<string>((resolve, fail) => { complete = resolve; reject = fail; });
    } },
  };
  const promise = requestTeacherHumanVerification(config);
  return { document, window, promise, calls: () => calls, submits: () => submits, signal: () => signal,
    restart: () => requestTeacherHumanVerification(config), disposer: () => dispose,
    complete: (token: string) => complete(token), reject: (error: Error) => reject(error), changeContext: () => { current = false; },
    open: () => document.querySelector<HTMLButtonElement>('.teacher-human-verification-actions button')!.click(),
    cancel: () => document.querySelector<HTMLButtonElement>('.teacher-human-verification-actions button:last-child')!.click(),
  };
}

test('the challenge module mirrors are identical', () => {
  assert.equal(readFileSync(new URL('../../../demos/teacher-human-verification.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../public/teachers/teacher-human-verification.js', import.meta.url), 'utf8'));
});

test('human verification requires the explicit visible button and sends no request of its own', async () => {
  const p = page();
  assert.equal(p.calls(), 0);
  const panel = p.document.querySelector('.teacher-human-verification')!;
  assert.equal(panel.getAttribute('role'), 'region');
  assert.equal(panel.getAttribute('dir'), 'rtl');
  assert.match(panel.textContent!, /אימות אנושי והמשך בחירת AI/);
  assert.equal(p.document.activeElement, panel.querySelector('button'));
  p.open(); p.open(); await flush();
  assert.equal(p.calls(), 1, 'Duplicate activation cannot open another widget');
  assert.equal(p.submits(), 0);
  p.complete('synthetic-human-token');
  assert.equal(await p.promise, 'synthetic-human-token');
  assert.equal(p.submits(), 1); assert.equal(p.signal()!.aborted, true);
  assert.equal(p.document.querySelector('.teacher-human-verification'), null);
  assert.equal(p.document.activeElement, p.document.getElementById('opener'));
});

test('cancellation before opening never loads a widget', async () => {
  const p = page();
  const result = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_CANCELLED' });
  p.cancel(); await result;
  assert.equal(p.calls(), 0); assert.equal(p.submits(), 0);
  assert.equal(p.document.querySelector('.teacher-human-verification'), null);
});

test('Escape aborts the visible widget and a late callback cannot resume the request', async () => {
  const p = page();
  const result = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_CANCELLED' });
  p.open(); await flush();
  const event = new p.window.Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'key', { value: 'Escape' });
  p.document.querySelector('.teacher-human-verification-widget')!.dispatchEvent(event);
  await result;
  assert.equal(p.signal()!.aborted, true); assert.equal(event.defaultPrevented, true);
  p.complete('too-late'); await flush(); assert.equal(p.submits(), 0);
});

test('expiry aborts the widget and preserves focus when the user has returned to manual selection', async () => {
  const p = page(Date.now() + 50);
  const result = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_EXPIRED' });
  p.open(); await flush();
  p.document.getElementById('manual')!.focus();
  await result;
  assert.equal(p.signal()!.aborted, true); assert.equal(p.submits(), 0);
  assert.equal(p.document.activeElement, p.document.getElementById('manual'));
});

test('changing a topic or selection while the widget waits cancels it without submitting', async () => {
  const p = page();
  const result = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_CONTEXT_CHANGED' });
  p.open(); await flush(); p.changeContext();
  await result;
  assert.equal(p.signal()!.aborted, true); assert.equal(p.submits(), 0);
  assert.equal(p.document.querySelector('.teacher-human-verification'), null);
});

test('a manual change just before the human callback cannot race the context timer', async () => {
  const p = page();
  const result = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_CONTEXT_CHANGED' });
  p.open(); await flush(); p.changeContext(); p.complete('synthetic-human-token');
  await result; assert.equal(p.submits(), 0);
});

test('a widget load error rejects the request but retains Google details until explicit close', async () => {
  const p = page();
  const result = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_UNAVAILABLE' });
  p.open(); await flush();
  const providerDetails = p.document.querySelector('.synthetic-google-owner-details');
  p.reject(Object.assign(new Error('The widget did not load'), { code: 'BOT_CHALLENGE_UNAVAILABLE' }));
  await result;
  assert.equal(p.document.querySelector('.synthetic-google-owner-details'), providerDetails);
  assert.match(p.document.querySelector('[role="alert"]')!.textContent!, /Google לא נטענה/);
  assert.equal(p.signal()!.aborted, false); assert.equal(p.submits(), 0);
  p.cancel();
  assert.equal(p.document.querySelector('.teacher-human-verification'), null);
  assert.equal(p.signal()!.aborted, true); assert.equal(p.submits(), 0);
});

test('a failed provider surface survives ticket expiry and context changes until the user closes it', async () => {
  const p = page(Date.now() + 80);
  const rejected = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_UNAVAILABLE' });
  p.open(); await flush();
  p.reject(Object.assign(new Error('Load failed'), { code: 'BOT_CHALLENGE_UNAVAILABLE' })); await rejected;
  p.changeContext();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.ok(p.document.querySelector('.synthetic-google-owner-details'));
  assert.equal(p.signal()!.aborted, false); assert.equal(p.submits(), 0);
  dismissTeacherHumanVerification(p.document);
  assert.equal(p.signal()!.aborted, true); assert.equal(p.document.querySelector('.teacher-human-verification'), null);
});

test('a new attempt replaces one failed panel and an old disposer cannot remove the newer panel', async () => {
  const p = page();
  const rejected = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_UNAVAILABLE' });
  p.open(); await flush(); const oldDispose = p.disposer(), oldSignal = p.signal()!;
  p.reject(Object.assign(new Error('Load failed'), { code: 'BOT_CHALLENGE_UNAVAILABLE' })); await rejected;
  const next = p.restart();
  const cancelled = assert.rejects(next, { code: 'BOT_CHALLENGE_CANCELLED' });
  assert.equal(oldSignal.aborted, true);
  assert.equal(p.document.querySelectorAll('.teacher-human-verification').length, 1);
  oldDispose();
  assert.equal(p.document.querySelectorAll('.teacher-human-verification').length, 1);
  p.cancel(); await cancelled;
  assert.equal(p.document.querySelector('.teacher-human-verification'), null);
});

test('an explicit action from another client removes only the matching retained error panel', async () => {
  const p = page();
  const rejected = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_UNAVAILABLE' });
  p.open(); await flush();
  p.reject(Object.assign(new Error('Load failed'), { code: 'BOT_CHALLENGE_UNAVAILABLE' })); await rejected;
  p.disposer()(); p.disposer()();
  assert.equal(p.document.querySelector('.teacher-human-verification'), null);
  assert.equal(p.signal()!.aborted, true); assert.equal(p.submits(), 0);
});

test('an expired challenge cannot create UI or execute Google', async () => {
  const p = page(Date.now() - 1);
  await assert.rejects(p.promise, { code: 'BOT_CHALLENGE_EXPIRED' });
  assert.equal(p.document.querySelector('.teacher-human-verification'), null); assert.equal(p.calls(), 0);
});
