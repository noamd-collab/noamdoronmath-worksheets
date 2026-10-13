/**
 * Resolve OAuth redirectTo for learning Google sign-in.
 * Same-origin by default so PKCE verifier (localStorage on this origin)
 * matches the callback origin. Exact allowlists only — no wildcards.
 *
 * Browser + Node (tests). No secrets.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NoamLearningAuthRedirect = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function hasWildcard(origin) {
    return typeof origin === 'string' && origin.indexOf('*') !== -1;
  }

  /**
   * @param {object} cfg NOAM_LEARNING_CONFIG
   * @param {string} locationHref current page href
   * @returns {{ ok: true, redirectTo: string, mode: string, origin: string } | { ok: false, error: string }}
   */
  function resolveAuthRedirectTo(cfg, locationHref) {
    cfg = cfg || {};
    var mode = cfg.authCallbackMode || 'same-origin';
    var allowed = Array.isArray(cfg.authAllowedOrigins)
      ? cfg.authAllowedOrigins.filter(Boolean)
      : [];

    for (var i = 0; i < allowed.length; i++) {
      if (hasWildcard(allowed[i])) {
        return {
          ok: false,
          error: 'WILDCARD_ORIGIN_FORBIDDEN',
        };
      }
    }

    var loc;
    try {
      loc = new URL(locationHref);
    } catch (e) {
      return { ok: false, error: 'INVALID_LOCATION' };
    }

    var candidateHref;
    try {
      if (mode === 'fixed') {
        var fixed = (cfg.authFixedOrigin || '').replace(/\/$/, '');
        if (!fixed) return { ok: false, error: 'FIXED_ORIGIN_REQUIRED' };
        if (hasWildcard(fixed)) return { ok: false, error: 'WILDCARD_ORIGIN_FORBIDDEN' };
        candidateHref = new URL('/learning.html', fixed + '/').href;
      } else if (mode === 'same-origin') {
        candidateHref = new URL('learning.html', loc.href).href;
      } else {
        return { ok: false, error: 'UNKNOWN_MODE' };
      }
    } catch (e) {
      return { ok: false, error: 'INVALID_CANDIDATE' };
    }

    var cand;
    try {
      cand = new URL(candidateHref);
    } catch (e) {
      return { ok: false, error: 'INVALID_CANDIDATE' };
    }

    if (mode === 'same-origin' && cand.origin !== loc.origin) {
      return { ok: false, error: 'ORIGIN_MISMATCH' };
    }

    if (allowed.length && allowed.indexOf(cand.origin) === -1) {
      return { ok: false, error: 'ORIGIN_NOT_ALLOWED' };
    }

    // Reject hash fragments / tokens in redirect target construction
    if (cand.hash && /access_token|refresh_token|id_token/i.test(cand.hash)) {
      return { ok: false, error: 'TOKEN_IN_URL_FORBIDDEN' };
    }
    if (/access_token|refresh_token|id_token/i.test(cand.search)) {
      return { ok: false, error: 'TOKEN_IN_URL_FORBIDDEN' };
    }

    return {
      ok: true,
      redirectTo: cand.origin + cand.pathname,
      mode: mode,
      origin: cand.origin,
    };
  }

  /** Validate a return URL after OAuth (exact origin allowlist / same-origin). */
  function validateReturnOrigin(cfg, returnHref, expectedLocationHref) {
    var resolved = resolveAuthRedirectTo(cfg, expectedLocationHref);
    if (!resolved.ok) return resolved;
    var ret;
    try {
      ret = new URL(returnHref);
    } catch (e) {
      return { ok: false, error: 'INVALID_RETURN' };
    }
    if (ret.origin !== resolved.origin) {
      return { ok: false, error: 'RETURN_ORIGIN_MISMATCH' };
    }
    return { ok: true, origin: ret.origin };
  }

  return {
    resolveAuthRedirectTo: resolveAuthRedirectTo,
    validateReturnOrigin: validateReturnOrigin,
  };
});
