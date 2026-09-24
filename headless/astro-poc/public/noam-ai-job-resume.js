/**
 * Persist Noam AI long-job refs across refresh/navigation (sessionStorage).
 * Does not invent a backend — stores start/status contract ids only.
 * Browser + Node (tests). No secrets.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NoamAiJobResume = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var STORAGE_KEY = 'noam-ai-pending-job-v1';
  var MAX_AGE_MS = 8 * 60 * 1000;

  function now() {
    return Date.now();
  }

  /**
   * @param {object} rec
   * @returns {object|null} sanitized record or null
   */
  function normalize(rec) {
    if (!rec || typeof rec !== 'object') return null;
    var jobId = typeof rec.jobId === 'string' ? rec.jobId.trim() : '';
    var kind = typeof rec.kind === 'string' ? rec.kind.trim() : '';
    var ownerKey = typeof rec.ownerKey === 'string' ? rec.ownerKey.trim() : '';
    var cacheKey = typeof rec.cacheKey === 'string' ? rec.cacheKey : '';
    var startedAt = Number(rec.startedAt) || 0;
    if (!jobId || !kind || !ownerKey || !startedAt) return null;
    if (jobId.length > 200 || kind.length > 40 || ownerKey.length > 200) return null;
    return {
      jobId: jobId,
      kind: kind,
      ownerKey: ownerKey,
      cacheKey: cacheKey,
      startedAt: startedAt,
      exerciseId: typeof rec.exerciseId === 'string' ? rec.exerciseId.slice(0, 80) : '',
      g: Number(rec.g) || 0,
      x: typeof rec.x === 'string' ? rec.x.slice(0, 40) : '',
      pdf: typeof rec.pdf === 'string' ? rec.pdf.slice(0, 64) : '',
    };
  }

  function readStore(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function writeStore(storage, rec) {
    var n = normalize(rec);
    if (!n) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(n));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearStore(storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  /**
   * Save a newly accepted long job (replaces any prior pending of any kind).
   */
  function savePending(storage, rec) {
    var n = normalize(
      Object.assign({}, rec, { startedAt: rec.startedAt || now() })
    );
    if (!n) return false;
    return writeStore(storage, n);
  }

  /**
   * Load pending job if still fresh and matches optional scope.
   * @param {Storage} storage
   * @param {{ ownerKey?: string, kind?: string, g?: number, x?: string, pdf?: string, nowMs?: number }} [scope]
   */
  function loadPending(storage, scope) {
    scope = scope || {};
    var rec = readStore(storage);
    if (!rec) return null;
    var t = typeof scope.nowMs === 'number' ? scope.nowMs : now();
    if (t - rec.startedAt > MAX_AGE_MS) {
      clearStore(storage);
      return null;
    }
    if (scope.ownerKey && scope.ownerKey !== rec.ownerKey) return null;
    if (scope.kind && scope.kind !== rec.kind) return null;
    if (scope.g && Number(scope.g) !== rec.g) return null;
    if (scope.x && scope.x !== rec.x) return null;
    if (scope.pdf && scope.pdf !== rec.pdf) return null;
    return rec;
  }

  /** Clear only if jobId matches (avoid wiping a newer job). */
  function clearIfJob(storage, jobId) {
    var rec = readStore(storage);
    if (rec && jobId && rec.jobId === jobId) clearStore(storage);
    else if (!jobId) clearStore(storage);
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    MAX_AGE_MS: MAX_AGE_MS,
    normalize: normalize,
    savePending: savePending,
    loadPending: loadPending,
    clearIfJob: clearIfJob,
    clear: clearStore,
  };
});
