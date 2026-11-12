import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/teachers/auth.js', import.meta.url), 'utf8');
const origin = 'https://teachers.example.test';
const authStorageKey = 'noam-learning-auth-v1';
type Session = { access_token: string } | null;
type SessionResult = { data: { session: Session }; error: Error | null };
type AuthListener = (event: string, session: Session) => void;
type FetchCall = { url: string; init: RequestInit; body: Record<string, unknown> | null };
type HarnessOptions = {
  mode?: 'login' | 'workspace';
  href?: string;
  returnTo?: string;
  session?: Session;
  initialize?: () => Promise<{ error: Error | null }>;
  getSession?: () => Promise<SessionResult>;
  sdk?: 'missing' | 'throws';
  oauthError?: Error;
  signOut?: () => Promise<{ error: Error | null }>;
  fetch?: (call: FetchCall) => Promise<Response>;
  storageThrows?: boolean;
};

class Element {
  textContent = '';
  disabled = true;
  submissions = 0;
  listeners = new Map<string, (event: { currentTarget: Element | null; preventDefault(): void }) => unknown>();
  addEventListener(type: string, callback: (event: { currentTarget: Element | null; preventDefault(): void }) => unknown) {
    this.listeners.set(type, callback);
  }
  submit() { this.submissions++; }
  dispatch(type: string) {
    const callback = this.listeners.get(type);
    assert.ok(callback, `Expected ${type} listener`);
    const event = { currentTarget: this as Element | null, prevented: false, preventDefault() { this.prevented = true; } };
    const completion = callback(event);
    // DOM event.currentTarget is only valid during dispatch, not after await.
    event.currentTarget = null;
    return { event, completion: Promise.resolve(completion) };
  }
}

async function settle() {
  // The production promises run normally; auth-listener timers are explicit below.
  await new Promise<void>(resolve => setImmediate(resolve));
}

function harness(options: HarnessOptions = {}) {
  const mode = options.mode ?? 'login';
  const current = new URL(options.href ?? `${origin}/teachers/${mode === 'login' ? 'login' : 'app?grade=8&topic=linear'}`);
  const button = new Element(), status = new Element(), logoutButton = new Element();
  const requests: FetchCall[] = [], navigations: string[] = [], histories: string[] = [];
  const oauth: Record<string, unknown>[] = [], signOutCalls: unknown[] = [], removedKeys: string[] = [];
  const clientOptions: unknown[] = [], timers: Array<() => unknown> = [];
  let sessionReads = 0;
  let authListener: AuthListener | undefined;
  const root = { getAttribute(name: string) {
    return name === 'data-teacher-auth' ? mode : name === 'data-return-to' ? options.returnTo ?? '/teachers/start' : null;
  } };
  const location = {
    get href() { return current.href; }, get origin() { return current.origin; },
    get pathname() { return current.pathname; }, get search() { return current.search; },
    replace(path: string) { navigations.push(path); },
  };
  const client = { auth: {
    initialize: options.initialize ?? (async () => ({ error: null })),
    async getSession() {
      sessionReads++;
      return options.getSession ? options.getSession() : { data: { session: options.session ?? null }, error: null };
    },
    onAuthStateChange(callback: AuthListener) { authListener = callback; },
    async signInWithOAuth(settings: Record<string, unknown>) {
      oauth.push(JSON.parse(JSON.stringify(settings)));
      return { error: options.oauthError ?? null };
    },
    async signOut(settings: unknown) {
      signOutCalls.push(JSON.parse(JSON.stringify(settings)));
      // Real signOut may emit synchronously before its promise settles.
      authListener?.('SIGNED_OUT', null);
      return options.signOut ? options.signOut() : { error: null };
    },
  } };
  const window: Record<string, unknown> = {
    NOAM_LEARNING_CONFIG: { googleEnabled: true, url: 'https://auth.example.test', key: 'synthetic-public-key' },
  };
  window.self = window; window.top = window;
  if (options.sdk !== 'missing') window.supabase = { createClient(_url: string, _key: string, settings: unknown) {
    if (options.sdk === 'throws') throw new Error('SDK_INIT_FAILED');
    clientOptions.push(JSON.parse(JSON.stringify(settings)));
    return client;
  } };
  vm.runInNewContext(source, {
    window, URL, URLSearchParams, location,
    document: {
      querySelector: (selector: string) => selector === '[data-teacher-auth]' ? root : null,
      querySelectorAll: (selector: string) => selector === '[data-teacher-logout]' ? [logoutButton] : [],
      getElementById: (id: string) => id === 'teacher-auth-status' ? status : id === 'teacher-google-sign-in' && mode === 'login' ? button : null,
    },
    history: { replaceState(_state: unknown, _title: string, path: string) {
      histories.push(path);
      current.href = new URL(path, current).href;
    } },
    localStorage: { removeItem(key: string) {
      removedKeys.push(key);
      if (options.storageThrows) throw new Error('STORAGE_BLOCKED');
    } },
    setTimeout(callback: () => unknown) { timers.push(callback); return timers.length; },
    async fetch(url: string, init: RequestInit = {}) {
      const call = { url: String(url), init, body: init.body ? JSON.parse(String(init.body)) : null };
      requests.push(call);
      if (options.fetch) return options.fetch(call);
      if (call.body?.action === 'logout') return Response.json({ ok: true });
      if (call.body?.action === 'start') return Response.json({ redirectTo: origin + '/teachers/login' });
      return Response.json({ returnTo: '/teachers/start' });
    },
  }, { filename: 'teachers/auth.js', timeout: 1000 });
  return {
    button, status, logoutButton, requests, navigations, histories, oauth, signOutCalls, removedKeys, clientOptions,
    get sessionReads() { return sessionReads; },
    emit(event: string, session: Session) {
      assert.ok(authListener, 'Expected SDK auth-state subscription');
      authListener(event, session);
    },
    async runTimers() {
      while (timers.length) { await timers.shift()!(); await settle(); }
    },
  };
}

test('teacher Google login uses the exact same-origin SSR callback and starts only once', async () => {
  const h = harness({ returnTo: '/teachers/app?grade=8&topic=linear' });
  await settle();
  assert.equal(h.button.disabled, false);
  const first = h.button.dispatch('click');
  await h.button.dispatch('click').completion;
  await first.completion;
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/teacherSession');
  assert.equal(h.requests[0].init.method, 'POST');
  assert.equal(h.requests[0].init.credentials, 'same-origin');
  assert.equal(h.requests[0].init.cache, 'no-store');
  assert.deepEqual(h.requests[0].body, { action: 'start', returnTo: '/teachers/app?grade=8&topic=linear' });
  assert.deepEqual(h.oauth, [{ provider: 'google', options: {
    redirectTo: origin + '/teachers/login', queryParams: { prompt: 'select_account' },
  } }]);
  assert.equal(h.button.disabled, true);
  assert.deepEqual(h.navigations, []);
});

test('invalid callback destinations never reach OAuth and a failed OAuth attempt is retryable', async () => {
  for (const redirectTo of ['https://other.example.test/teachers/login', origin + '/teachers/app',
    origin + '/teachers/login?next=1', origin + '/teachers/login#token', origin + '/learning.html', 'not-a-url']) {
    const h = harness({ fetch: async () => Response.json({ redirectTo }) });
    await settle();
    await h.button.dispatch('click').completion;
    assert.deepEqual(h.oauth, [], redirectTo);
    assert.deepEqual(h.navigations, [], redirectTo);
    assert.equal(h.button.disabled, false, redirectTo);
    assert.match(h.status.textContent, /לא הצלחנו/);
  }
  const h = harness({ oauthError: new Error('OAUTH_FAILED') });
  await settle();
  await h.button.dispatch('click').completion;
  assert.equal(h.button.disabled, false);
  await h.button.dispatch('click').completion;
  assert.equal(h.oauth.length, 2, 'An error must clear the pending-login flag');
  assert.deepEqual(h.navigations, []);
});

test('successful callback bridges the token only in a POST body before following the server-approved teacher path', async () => {
  const token = 'synthetic-access-token-not-for-a-url';
  const h = harness({ session: { access_token: token }, href: origin + '/teachers/login?code=one-time-code',
    returnTo: '/teachers/app?grade=8',
    fetch: async () => Response.json({ returnTo: '/teachers/app?grade=8&topic=linear' }),
  });
  await settle();
  assert.deepEqual(h.histories, ['/teachers/login']);
  assert.equal(h.requests.length, 1);
  const call = h.requests[0];
  assert.equal(call.url, '/api/teacherSession');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.credentials, 'same-origin');
  assert.equal(call.init.cache, 'no-store');
  assert.equal(new Headers(call.init.headers).get('content-type'), 'application/json');
  assert.deepEqual(call.body, { accessToken: token, returnTo: '/teachers/app?grade=8' });
  assert.deepEqual(h.navigations, ['/teachers/app?grade=8&topic=linear']);
  assert.ok([...h.histories, ...h.navigations, ...h.requests.map(request => request.url)].every(url => !url.includes(token)));
});

test('SDK absence, initialization failure, cancelled callbacks and session errors stay on login', async () => {
  const cases: HarnessOptions[] = [
    { sdk: 'missing' }, { sdk: 'throws' },
    { href: origin + '/teachers/login?error=access_denied', session: { access_token: 'existing-session' } },
    { href: origin + '/teachers/login#error=access_denied&error_description=Cancelled', session: { access_token: 'existing-session' } },
    { href: origin + '/teachers/login#error_description=Cancelled', session: { access_token: 'existing-session' } },
    { href: origin + '/teachers/login?code=failed-code', getSession: async () => ({ data: { session: { access_token: 'stale-session' } }, error: new Error('EXCHANGE_FAILED') }) },
    { initialize: async () => { throw new Error('SDK_INITIALIZATION_FAILED'); } },
    { getSession: async () => { throw new Error('SDK_SESSION_FAILED'); } },
  ];
  for (const options of cases) {
    const h = harness(options);
    await settle();
    assert.deepEqual(h.navigations, []);
    assert.ok(h.requests.every(call => call.body?.action === 'logout'), 'A failed or cancelled callback cannot bridge a leftover session');
    assert.ok(h.status.textContent.length > 0, 'Failure must be visible to the user');
    if (options.sdk) assert.equal(h.button.disabled, true);
    if (options.href) assert.deepEqual(h.histories, ['/teachers/login']);
    if (options.href?.includes('error')) {
      assert.equal(h.sessionReads, 0, 'Cancellation must not reuse an existing session');
      assert.equal(h.requests.length, 1, 'Cancellation also clears the server session cookie');
    }
  }
});

test('PKCE initialization must succeed before reading or bridging a previously stored owner session', async () => {
  let finish: (result: { error: Error | null }) => void = () => { throw new Error('No pending initialization'); };
  const h = harness({ href: origin + '/teachers/login?code=failed-pkce-code',
    session: { access_token: 'previously-stored-owner-token' },
    initialize: () => new Promise(resolve => { finish = resolve; }),
  });
  await settle();
  assert.equal(h.sessionReads, 0);
  assert.equal(h.requests.length, 0);
  assert.deepEqual(h.histories, [], 'Keep the code available until PKCE initialization settles');
  finish({ error: new Error('PKCE_VERIFIER_MISMATCH') });
  await settle();
  assert.equal(h.sessionReads, 0, 'A failed PKCE exchange cannot fall back to a stored owner session');
  assert.deepEqual(h.histories, ['/teachers/login']);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/teacherSession');
  assert.equal(h.requests[0].init.method, 'POST');
  assert.deepEqual(h.navigations, []);
  assert.match(h.status.textContent, /לא הושלמה/);
});

test('server denial never opens the tool even when a browser has a valid-looking Google session', async () => {
  for (const status of [401, 403, 503]) {
    const h = harness({ session: { access_token: 'non-owner-token' },
      fetch: async () => Response.json({ returnTo: '/teachers/app', error: 'ACCESS_DENIED' }, { status }),
    });
    await settle();
    assert.equal(h.requests.length, 1);
    assert.deepEqual(h.navigations, [], String(status));
    assert.equal(h.button.disabled, false);
    assert.match(h.status.textContent, status === 403 ? /אינו מורשה/ : /לא ניתן לאמת/);
  }
});

test('even successful session responses cannot redirect outside the teacher allowlist', async () => {
  for (const returnTo of ['https://other.example.test/teachers/app', '//other.example.test/teachers/start', '/account', '/teachers/app/other']) {
    const h = harness({ session: { access_token: 'owner-token' }, fetch: async () => Response.json({ returnTo }) });
    await settle();
    assert.deepEqual(h.navigations, [], returnTo);
    assert.match(h.status.textContent, /לא ניתן להשלים/);
  }
});

test('workspace token refresh bridges outside the synchronous SDK listener without navigating away', async () => {
  const h = harness({ mode: 'workspace', session: { access_token: 'initial-token' } });
  await settle();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.navigations, []);
  h.emit('TOKEN_REFRESHED', { access_token: 'refreshed-token' });
  assert.equal(h.requests.length, 1, 'Network work must not run inside the SDK callback');
  await h.runTimers();
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.requests[1].body, { accessToken: 'refreshed-token', returnTo: '/teachers/app?grade=8&topic=linear' });
  assert.equal(h.status.textContent, '', 'Successful background refresh must clear its verification message');
  assert.deepEqual(h.navigations, []);
});

test('a rejected refreshed session sends the workspace back to login with its tool context', async () => {
  let bridges = 0;
  const h = harness({ mode: 'workspace', session: { access_token: 'initial-token' }, fetch: async () => {
    bridges++;
    return Response.json({ returnTo: '/teachers/app' }, { status: bridges === 1 ? 200 : 403 });
  } });
  await settle();
  h.emit('TOKEN_REFRESHED', { access_token: 'revoked-token' });
  await h.runTimers();
  assert.deepEqual(h.navigations, ['/teachers/login?returnTo=' + encodeURIComponent('/teachers/app?grade=8&topic=linear')]);
});

test('logout clears the server cookie then checks local SDK sign-out before leaving', async () => {
  let release: (response: Response) => void = () => { throw new Error('No pending logout'); };
  const h = harness({ mode: 'workspace', session: { access_token: 'owner-token' }, fetch: async call => {
    if (call.body?.action === 'logout') return new Promise<Response>(resolve => { release = resolve; });
    return Response.json({ returnTo: '/teachers/start' });
  } });
  await settle();
  const submission = h.logoutButton.dispatch('click');
  assert.equal(submission.event.prevented, true);
  assert.equal(submission.event.currentTarget, null);
  assert.deepEqual(h.signOutCalls, []);
  assert.deepEqual(h.navigations, []);
  await settle();
  const deletion = h.requests.at(-1)!;
  assert.equal(deletion.url, '/api/teacherSession');
  assert.equal(deletion.init.method, 'POST');
  assert.deepEqual(deletion.body, { action: 'logout' });
  assert.equal(new Headers(deletion.init.headers).get('content-type'), 'application/json');
  assert.equal(deletion.init.credentials, 'same-origin');
  assert.equal(deletion.init.cache, 'no-store');
  release(Response.json({ ok: true }));
  await submission.completion;
  await h.runTimers();
  assert.deepEqual(h.signOutCalls, [{ scope: 'local' }]);
  assert.deepEqual(h.navigations, ['/teachers']);
  assert.equal(h.logoutButton.submissions, 0);
  assert.equal(h.requests.filter(call => call.body?.action === 'logout').length, 1, 'SIGNED_OUT during logout must not trigger a second clear');
});

test('after server logout, SDK signOut errors clear local auth and return to the public page', async () => {
  const h = harness({ mode: 'workspace', session: { access_token: 'owner-token' },
    signOut: async () => ({ error: new Error('LOCAL_SIGNOUT_FAILED') }),
  });
  await settle();
  const submission = h.logoutButton.dispatch('click');
  assert.equal(submission.event.currentTarget, null);
  await submission.completion;
  assert.deepEqual(h.signOutCalls, [{ scope: 'local' }]);
  assert.deepEqual(h.navigations, ['/teachers'], 'Server access was removed before provider sign-out');
  assert.deepEqual(h.removedKeys, [authStorageKey]);
  assert.equal(h.logoutButton.submissions, 0, 'Never use the Wix-blocked native form path');
});

test('failed server logout stays private, shows a retry and never claims success or submits a native form', async () => {
  for (const storageThrows of [false, true]) {
    const h = harness({ mode: 'workspace', session: { access_token: 'owner-token' }, storageThrows,
      fetch: async call => call.body?.action === 'logout'
        ? new Response(null, { status: 503 }) : Response.json({ returnTo: '/teachers/start' }),
    });
    await settle();
    await h.logoutButton.dispatch('click').completion;
    assert.deepEqual(h.signOutCalls, [], 'Failed server logout must not be treated as a cleared session');
    assert.deepEqual(h.navigations, []);
    assert.deepEqual(h.removedKeys, []);
    assert.equal(h.logoutButton.submissions, 0);
    assert.equal(h.logoutButton.disabled, false);
    assert.match(h.status.textContent, /לא ניתן להשלים את ההתנתקות/);
  }
});

test('logout waits for an earlier token bridge and a queued refresh cannot restore the cleared cookie', async () => {
  let finishBridge: (response: Response) => void = () => { throw new Error('No bridge'); };
  const h = harness({ mode: 'workspace', session: { access_token: 'owner-token' },
    fetch: async call => call.body?.accessToken
      ? new Promise<Response>(resolve => { finishBridge = resolve; }) : Response.json({ ok: true }),
  });
  await settle();
  h.emit('TOKEN_REFRESHED', { access_token: 'late-refresh' });
  const logout = h.logoutButton.dispatch('click');
  await settle();
  assert.equal(h.requests.length, 1, 'Logout cannot overtake a pending Set-Cookie response');
  finishBridge(Response.json({ returnTo: '/teachers/app' }));
  await logout.completion;
  await h.runTimers();
  assert.deepEqual(h.requests.map(call => call.body), [
    { accessToken: 'owner-token', returnTo: '/teachers/app?grade=8&topic=linear' },
    { action: 'logout' },
  ]);
  assert.deepEqual(h.navigations, ['/teachers']);
});
