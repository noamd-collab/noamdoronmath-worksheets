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
export const MAX_MESSAGE_CHARS = 700;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 12;

const SITEVERIFY = "https://www.google.com/recaptcha/api/siteverify";

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

export function pruneRateStore(store, now) {
  const when = typeof now === "number" ? now : Date.now();
  for (const [key, bucket] of store) {
    const fresh = (bucket || []).filter((stamp) => when - stamp < RATE_LIMIT_WINDOW_MS);
    if (!fresh.length) store.delete(key);
    else if (fresh.length !== (bucket || []).length) store.set(key, fresh);
  }
}

export function takeRateSlot(key, now, store) {
  const when = typeof now === "number" ? now : Date.now();
  pruneRateStore(store, when);
  const bucket = store.get(key) || [];
  if (bucket.length >= RATE_LIMIT_MAX) return false;
  bucket.push(when);
  store.set(key, bucket);
  return true;
}

export async function verifyRecaptcha({ token, secret, fetch, action }) {
  if (!secret || typeof token !== "string" || !token || token.length > 8192) return false;
  const body = new URLSearchParams({ secret: secret, response: token });
  const response = await fetch(SITEVERIFY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response || !response.ok) return false;
  const data = await response.json();
  if (!data || data.success !== true) return false;
  if (data.action !== (action || RECAPTCHA_ACTION)) return false;
  if (typeof data.score !== "number" || data.score < RECAPTCHA_MIN_SCORE) return false;
  return true;
}

export async function guardCompanionRequest(input, deps) {
  const origin = input && input.origin ? String(input.origin) : "";
  if (!isAllowedOrigin(origin)) {
    return { ok: false, status: 403, code: "ORIGIN_NOT_ALLOWED" };
  }
  const store = deps && deps.store;
  if (!store || typeof store.get !== "function") {
    return { ok: false, status: 403, code: "BOT_VERIFICATION_FAILED" };
  }
  const allowed = takeRateSlot(
    clientKey(input.clientIp),
    typeof input.now === "number" ? input.now : Date.now(),
    store
  );
  if (!allowed) return { ok: false, status: 429, code: "RATE_LIMIT" };
  const message = input.message;
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, status: 400, code: "MESSAGE_LENGTH" };
  }
  const verification = input.botVerification || {};
  const token = verification.provider === "recaptcha-v3" ? verification.token : "";
  const passed = await verifyRecaptcha({
    token: token,
    secret: deps.secret,
    fetch: deps.fetch,
    action: RECAPTCHA_ACTION,
  });
  if (!passed) return { ok: false, status: 403, code: "BOT_VERIFICATION_FAILED" };
  return { ok: true, status: 200 };
}
