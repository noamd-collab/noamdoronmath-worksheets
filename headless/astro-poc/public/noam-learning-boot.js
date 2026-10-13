/* Cloud auth is optional: guest learning never waits for the Google SDK.
   Supabase loads only for an existing session, an OAuth return, or a later
   Google click (window.NoamEnsureSupabase). רמזי does not use this file. */
(function () {
  'use strict';
  var started = false;
  function start() {
    if (started) return;
    started = true;
    var s = document.createElement('script');
    s.src = 'noam-learning.js?v=20261002-lazy-supabase';
    document.body.append(s);
  }
  function loadLearning() {
    var auth = document.createElement('script');
    auth.src = 'noam-learning-auth-redirect.js?v=20260924-m35-1';
    auth.onload = start;
    auth.onerror = start;
    document.body.append(auth);
  }
  function needsSupabaseNow() {
    var cfg = window.NOAM_LEARNING_CONFIG;
    if (!cfg || !cfg.googleEnabled || window.self !== window.top) return false;
    var url;
    try { url = new URL(location.href); } catch (e) { return false; }
    if (url.searchParams.has('code') || url.searchParams.has('error') || url.searchParams.get('signin') === 'google') return true;
    if (/access_token=|error=/.test(location.hash)) return true;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i) || '';
        if (key.indexOf('noam-learning-auth-v1') !== -1) return true;
      }
    } catch (e) {}
    return false;
  }
  window.NoamEnsureSupabase = function (done) {
    if (window.supabase) { done(); return; }
    var sdk = document.createElement('script');
    sdk.src = 'vendor/supabase-2.116.0.js';
    sdk.onload = function () { done(); };
    sdk.onerror = function () { done(); };
    document.body.append(sdk);
  };
  if (
    !window.NOAM_LEARNING_CONFIG ||
    !window.NOAM_LEARNING_CONFIG.googleEnabled ||
    window.self !== window.top
  ) {
    loadLearning();
    return;
  }
  if (needsSupabaseNow()) {
    window.NoamEnsureSupabase(loadLearning);
    setTimeout(loadLearning, 7000);
    return;
  }
  loadLearning();
})();
