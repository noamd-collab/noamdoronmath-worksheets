/* Cloud auth is optional: guest learning never waits for the Google SDK. */
(function () {
  'use strict';
  var started = false;
  function start() {
    if (started) return;
    started = true;
    var s = document.createElement('script');
    s.src = 'noam-learning.js?v=20260925-level-iso-1';
    document.body.append(s);
  }
  function loadLearning() {
    var auth = document.createElement('script');
    auth.src = 'noam-learning-auth-redirect.js?v=20260925-level-iso-1';
    auth.onload = start;
    auth.onerror = start;
    document.body.append(auth);
  }
  if (
    !window.NOAM_LEARNING_CONFIG ||
    !window.NOAM_LEARNING_CONFIG.googleEnabled ||
    window.self !== window.top
  ) {
    loadLearning();
    return;
  }
  var sdk = document.createElement('script');
  sdk.src = 'vendor/supabase-2.116.0.js';
  sdk.onload = loadLearning;
  sdk.onerror = loadLearning;
  document.body.append(sdk);
  setTimeout(loadLearning, 7000);
})();
