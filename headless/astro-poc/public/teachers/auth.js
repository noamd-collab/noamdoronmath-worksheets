/* Google establishes identity; the server alone decides teacher access. */
(function () {
  'use strict';
  var root = document.querySelector('[data-teacher-auth]');
  if (!root) return;
  var mode = root.getAttribute('data-teacher-auth');
  var status = document.getElementById('teacher-auth-status');
  var button = document.getElementById('teacher-google-sign-in');
  var cfg = window.NOAM_LEARNING_CONFIG || {};
  var client, pending = false, leaving = false;
  var sessionMutation = Promise.resolve();
  function tell(text) { if (status) status.textContent = text; }
  function returnPath() {
    if (mode === 'workspace') return location.pathname + location.search;
    return root.getAttribute('data-return-to') || '/teachers/start';
  }
  function loginPath() { return '/teachers/login?returnTo=' + encodeURIComponent(returnPath()); }
  function postSession(body) {
    // Finish any earlier refresh bridge before clearing the cookie on logout.
    var operation = sessionMutation.catch(function () {}).then(function () { return fetch('/api/teacherSession', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }); });
    sessionMutation = operation;
    return operation;
  }
  async function clearCookie() {
    var response = await postSession({ action: 'logout' });
    if (!response.ok) throw new Error('SESSION_CLEAR_FAILED');
  }
  async function bridge(session, navigate) {
    if (leaving) return;
    if (!session || !session.access_token) {
      if (mode === 'workspace') { leaving = true; location.replace(loginPath()); }
      else tell('יש להתחבר עם חשבון Google כדי להשתמש בכלי המורים.');
      return;
    }
    tell('מאמתים את החשבון ואת הרשאת הכניסה…');
    var response = await postSession({ accessToken: session.access_token, returnTo: returnPath() });
    var result = await response.json();
    if (leaving) return;
    if (!response.ok) {
      if (mode === 'workspace') { leaving = true; location.replace(loginPath()); return; }
      tell(response.status === 403 ? 'נדרש חשבון Google מאומת כדי להשתמש בכלי המורים. אפשר לבחור חשבון Google אחר.' : 'לא ניתן לאמת את הכניסה כרגע. נסו להתחבר שוב.');
      if (button) button.textContent = 'בחירת חשבון Google אחר';
      return;
    }
    tell('');
    if (navigate) {
      // The server returns only an allowlisted same-origin teacher path.
      var destination = new URL(result.returnTo, location.origin);
      if (destination.origin !== location.origin || !/^\/teachers\/(start|app|generate)$/.test(destination.pathname)) throw new Error('INVALID_RETURN');
      leaving = true;
      location.replace(destination.pathname + destination.search);
    }
  }
  async function googleSignIn() {
    if (pending || !client) return;
    pending = true; button.disabled = true;
    tell('פותחים את ההתחברות עם Google…');
    try {
      var start = await postSession({ action: 'start', returnTo: returnPath() });
      if (!start.ok) throw new Error('START_FAILED');
      var body = await start.json();
      var redirectTo = new URL(body.redirectTo);
      if (redirectTo.origin !== location.origin || redirectTo.pathname !== '/teachers/login' || redirectTo.search || redirectTo.hash) throw new Error('INVALID_CALLBACK');
      var result = await client.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: redirectTo.href, queryParams: { prompt: 'select_account' } },
      });
      if (result.error) throw result.error;
    } catch (_) {
      pending = false; button.disabled = false;
      tell('לא הצלחנו לפתוח את ההתחברות. אפשר לנסות שוב.');
    }
  }
  async function logout(event) {
    var control = event && event.currentTarget;
    if (event) event.preventDefault();
    if (leaving) return;
    leaving = true;
    if (control) control.disabled = true;
    try {
      await clearCookie();
    } catch (_) {
      leaving = false;
      if (control) control.disabled = false;
      tell('לא ניתן להשלים את ההתנתקות כרגע. נסו שוב.');
      return;
    }
    try {
      if (client) {
        var result = await client.auth.signOut({ scope: 'local' });
        if (result.error) throw result.error;
      }
    } catch (_) {
      // Server access is already cleared. Remove a retained browser session
      // even when the provider sign-out request cannot finish.
      try { localStorage.removeItem('noam-learning-auth-v1'); } catch (_) {}
    }
    location.replace('/teachers');
  }
  document.querySelectorAll('[data-teacher-logout]').forEach(function (control) { control.addEventListener('click', logout); });
  if (!cfg.googleEnabled || !cfg.url || !cfg.key || !window.supabase || window.self !== window.top) {
    tell('ההתחברות אינה זמינה כרגע. רעננו את הדף ונסו שוב.');
    return;
  }
  try {
    client = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { flowType: 'pkce', storageKey: 'noam-learning-auth-v1', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
  } catch (_) { tell('לא ניתן לטעון את ההתחברות. נסו לרענן.'); return; }
  if (button) { button.disabled = false; button.addEventListener('click', googleSignIn); }
  client.auth.onAuthStateChange(function (event, session) {
    // Supabase calls the listener synchronously; run network work outside it.
    if (mode !== 'workspace' || leaving) return;
    if (event === 'TOKEN_REFRESHED') setTimeout(function () { bridge(session, false).catch(function () { location.replace(loginPath()); }); }, 0);
    if (event === 'SIGNED_OUT') setTimeout(function () { clearCookie().then(function () { location.replace('/teachers'); }).catch(function () { location.replace(loginPath()); }); }, 0);
  });
  client.auth.initialize().then(async function (initialization) {
    var entry = new URL(location.href);
    var fragment = new URLSearchParams(entry.hash.slice(1));
    var cancelled = entry.searchParams.has('error') || fragment.has('error') || fragment.has('error_description');
    var callback = entry.searchParams.has('code') || cancelled || fragment.has('access_token');
    // PKCE exchange has completed before removing its one-time code from the URL.
    if (callback) history.replaceState(null, '', '/teachers/login');
    if (cancelled || initialization.error) {
      if (callback) await clearCookie();
      tell('ההתחברות לא הושלמה. נסו להתחבר שוב עם Google.'); return;
    }
    var result = await client.auth.getSession();
    if (result.error) { tell('לא ניתן לאמת את החיבור לחשבון. נסו להתחבר שוב.'); return; }
    await bridge(result.data && result.data.session, mode === 'login');
  }).catch(function () { tell('לא ניתן להשלים את הכניסה כרגע. נסו שוב.'); });
})();
