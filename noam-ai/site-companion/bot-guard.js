/**
 * Same trust decisions as the existing worksheet AI routes: an exact site
 * allowlist, reCAPTCHA v3, a message cap, and a rate limit.
 * No wildcard origin. No browser key.
 *
 * SITE_ORIGINS and RECAPTCHA_SECRET_NAME must match the private
 * noamDiagramPlan / noamBotConfig backend. See docs/noam-ai-golive-checklist.md.
 */
export const SITE_ORIGINS = [
  "https://www.noamdoronmath.co.il",
  "https://noamdoronmath.co.il",
];

export const RECAPTCHA_SECRET_NAME = "RECAPTCHA_SECRET_KEY";
export const RECAPTCHA_ACTION = "noam_site_companion";
export const RECAPTCHA_MIN_SCORE = 0.5;
/** Teachers type on a school network. A slightly lower floor still rejects bots. */
export const RECAPTCHA_MIN_SCORE_TEACHERS = 0.3;
export const RECAPTCHA_TIMEOUT_MS = 5_000;
export const MAX_MESSAGE_CHARS = 700;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 12;
/**
 * Used only when the visitor IP is missing. A shared 12/min bucket would
 * throttle the whole site together. Each reCAPTCHA token gets its own
 * 12/min bucket, and this higher cap is the per-isolate ceiling.
 */
export const RATE_LIMIT_NO_IP_GLOBAL_MAX = 120;
export const NO_IP_GLOBAL_KEY = "global:no-ip";

const SITEVERIFY = "https://www.google.com/recaptcha/api/siteverify";
const PREVIEW_HOST = /^[a-z0-9-]+-noam-math-astro-poc-amiramnoam-130a\.wix-site-host\.com$/;

export class OutboundTimeoutError extends Error {
  constructor() {
    super("OUTBOUND_TIMEOUT");
    this.name = "OutboundTimeoutError";
    this.code = "OUTBOUND_TIMEOUT";
  }
}

export function isOutboundTimeout(error) {
  return !!(error && (error.code === "OUTBOUND_TIMEOUT" || error.name === "AbortError" || error.name === "TimeoutError"));
}

export async function fetchWithTimeout(fetcher, url, init, ms) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new OutboundTimeoutError());
    }, ms);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => fetcher(url, Object.assign({}, init || {}, { signal: controller.signal }))),
      timeout,
    ]);
  } catch (error) {
    if (controller.signal.aborted || isOutboundTimeout(error)) throw new OutboundTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function isAllowedOrigin(origin) {
  return typeof origin === "string" && SITE_ORIGINS.indexOf(origin) !== -1;
}

export function corsHeadersFor(origin) {
  if (!isAllowedOrigin(origin)) return null;
  return {
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function clientKey(clientIp) {
  const ip = String(clientIp || "").trim();
  if (!ip || ip.length > 64 || /[\s,]/.test(ip)) return "untrusted";
  return ip;
}

export function isProductionRecaptchaHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "www.noamdoronmath.co.il" || host === "noamdoronmath.co.il";
}

/** Preview hosts on this headless project only. The random prefix varies. */
export function isHeadlessPreviewHost(hostname) {
  return PREVIEW_HOST.test(String(hostname || "").trim().toLowerCase());
}

export function isAllowedRecaptchaHostname(hostname) {
  return isProductionRecaptchaHost(hostname) || isHeadlessPreviewHost(hostname);
}

/**
 * Rate-limit identity.
 * A real visitor IP (one address, no spaces or commas) is its own 12/min key.
 * The headless route passes only the true-client-ip header. Wix's edge
 * overwrites that header. cf-connecting-ip and x-real-ip are not keys.
 * When the IP is missing, the key is a hash of the reCAPTCHA token plus the
 * higher global cap above. "untrusted" is not used as a shared bucket.
 */
export function tokenRateKey(token) {
  const value = typeof token === "string" ? token : "";
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return "token:" + (hash >>> 0).toString(16);
}

export function rateIdentity(clientIp, token) {
  const key = clientKey(clientIp);
  if (key !== "untrusted") return { mode: "ip", key };
  return { mode: "no-ip", key: tokenRateKey(token) };
}

export function pruneRateStore(store, now) {
  const when = typeof now === "number" ? now : Date.now();
  for (const [key, bucket] of store) {
    const fresh = (bucket || []).filter((stamp) => when - stamp < RATE_LIMIT_WINDOW_MS);
    if (!fresh.length) store.delete(key);
    else if (fresh.length !== (bucket || []).length) store.set(key, fresh);
  }
}

export function takeRateSlot(key, now, store, max) {
  const when = typeof now === "number" ? now : Date.now();
  const limit = typeof max === "number" ? max : RATE_LIMIT_MAX;
  pruneRateStore(store, when);
  const bucket = store.get(key) || [];
  if (bucket.length >= limit) return false;
  bucket.push(when);
  store.set(key, bucket);
  return true;
}

export async function verifyRecaptcha({ token, secret, fetch, action, timeoutMs, minScore }) {
  if (!secret) return { ok: false, code: "SECRET_MISMATCH" };
  if (typeof token !== "string" || !token || token.length > 8192) return { ok: false, code: "BOT_VERIFICATION_FAILED" };
  const body = new URLSearchParams({ secret: secret, response: token });
  let response;
  try {
    response = await fetchWithTimeout(fetch, SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }, typeof timeoutMs === "number" ? timeoutMs : RECAPTCHA_TIMEOUT_MS);
  } catch (error) {
    if (isOutboundTimeout(error)) throw error;
    return { ok: false, code: "BOT_VERIFICATION_FAILED" };
  }
  if (!response || !response.ok) return { ok: false, code: "BOT_VERIFICATION_FAILED" };
  const data = await response.json();
  const errors = data && Array.isArray(data["error-codes"]) ? data["error-codes"] : [];
  if (!data || data.success !== true) {
    if (errors.indexOf("invalid-input-secret") !== -1 || errors.indexOf("missing-input-secret") !== -1) {
      return { ok: false, code: "SECRET_MISMATCH" };
    }
    return { ok: false, code: "BOT_VERIFICATION_FAILED" };
  }
  if (data.action !== (action || RECAPTCHA_ACTION)) return { ok: false, code: "BOT_VERIFICATION_FAILED" };
  const floor = typeof minScore === "number" ? minScore : RECAPTCHA_MIN_SCORE;
  if (typeof data.score !== "number" || data.score < floor) return { ok: false, code: "LOW_SCORE" };
  if (!isAllowedRecaptchaHostname(data.hostname)) return { ok: false, code: "BOT_VERIFICATION_FAILED" };
  return { ok: true, code: "" };
}

export async function guardCompanionRequest(input, deps) {
  const origin = input && input.origin ? String(input.origin) : "";
  const extra = deps && Array.isArray(deps.extraOrigins) ? deps.extraOrigins : [];
  if (!isAllowedOrigin(origin) && extra.indexOf(origin) === -1) {
    return { ok: false, status: 403, code: "ORIGIN_NOT_ALLOWED" };
  }
  const store = deps && deps.store;
  if (!store || typeof store.get !== "function") {
    return { ok: false, status: 403, code: "BOT_VERIFICATION_FAILED" };
  }
  const verification = input.botVerification || {};
  const token = verification.provider === "recaptcha-v3" ? verification.token : "";
  const identity = rateIdentity(input.clientIp, token);
  const now = typeof input.now === "number" ? input.now : Date.now();
  const globalMax = deps && typeof deps.noIpGlobalMax === "number" ? deps.noIpGlobalMax : RATE_LIMIT_NO_IP_GLOBAL_MAX;
  if (identity.mode === "ip") {
    if (!takeRateSlot(identity.key, now, store)) return { ok: false, status: 429, code: "RATE_LIMIT" };
  } else if (!takeRateSlot(identity.key, now, store) || !takeRateSlot(NO_IP_GLOBAL_KEY, now, store, globalMax)) {
    return { ok: false, status: 429, code: "RATE_LIMIT" };
  }
  const message = input.message;
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, status: 400, code: "MESSAGE_LENGTH" };
  }
  let verdict = { ok: false, code: "BOT_VERIFICATION_FAILED" };
  try {
    verdict = await verifyRecaptcha({
      token: token,
      secret: deps.secret,
      fetch: deps.fetch,
      action: RECAPTCHA_ACTION,
      timeoutMs: deps.recaptchaTimeoutMs,
      minScore: deps.minScore,
    });
  } catch (error) {
    if (isOutboundTimeout(error)) return { ok: false, status: 200, code: "UNAVAILABLE" };
    return { ok: false, status: 403, code: "BOT_VERIFICATION_FAILED" };
  }
  if (!verdict.ok) return { ok: false, status: 403, code: verdict.code || "BOT_VERIFICATION_FAILED" };
  return { ok: true, status: 200 };
}
