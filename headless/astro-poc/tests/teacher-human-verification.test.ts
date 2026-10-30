import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { requestTeacherHumanVerification } from '../public/teachers/teacher-human-verification.js';

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
  const promise = requestTeacherHumanVerification({
    challenge: { provider: 'recaptcha-v2', siteKey: 'synthetic-site-key', requestToken: 'synthetic-ticket', expiresAt },
    anchor: document.getElementById('status'), isCurrent: () => current,
    onSubmitting: () => { submits += 1; },
    client: { completeChallenge(_challenge: unknown, container: HTMLElement, options: { signal: AbortSignal }) {
      calls += 1; signal = options.signal;
      assert.equal(container.hidden, false);
      return new Promise<string>((resolve, fail) => { complete = resolve; reject = fail; });
    } },
  });
  return { document, window, promise, calls: () => calls, submits: () => submits, signal: () => signal,
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

test('a widget error is returned visibly to the caller and cleans up all UI', async () => {
  const p = page();
  const result = assert.rejects(p.promise, { code: 'BOT_CHALLENGE_UNAVAILABLE' });
  p.open(); await flush();
  p.reject(Object.assign(new Error('The widget did not load'), { code: 'BOT_CHALLENGE_UNAVAILABLE' }));
  await result;
  assert.equal(p.document.querySelector('.teacher-human-verification'), null); assert.equal(p.submits(), 0);
});

test('an expired challenge cannot create UI or execute Google', async () => {
  const p = page(Date.now() - 1);
  await assert.rejects(p.promise, { code: 'BOT_CHALLENGE_EXPIRED' });
  assert.equal(p.document.querySelector('.teacher-human-verification'), null); assert.equal(p.calls(), 0);
});
