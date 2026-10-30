/** Teacher-only human verification. Tickets are not permission to call the model. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { clientKey, fetchWithTimeout, isAllowedOrigin, isHeadlessPreviewHost, MAX_MESSAGE_CHARS, RECAPTCHA_TIMEOUT_MS } from "./bot-guard.js";

export const STEP_UP_TTL_MS = 120_000;
const TICKET_CONTEXT = "noam-teacher-captcha-step-up-v1";
const SITEVERIFY = "https://www.google.com/recaptcha/api/siteverify";
const SESSION_COOKIE = "__Secure-noam-teacher-captcha";

function clock(settings) {
  return typeof settings.now === "number" ? settings.now : Date.now();
}

function sessionValue(cookieHeader) {
  if (typeof cookieHeader !== "string" || cookieHeader.length > 16_384) return "";
  const matches = cookieHeader.split(";").map(part => part.trim()).filter(part => part.startsWith(SESSION_COOKIE + "="));
  return matches.length === 1 ? matches[0].slice(SESSION_COOKIE.length + 1) : "";
}

function sessionMac(encoded, settings) {
  return createHmac("sha256", settings.recaptchaV2Secret).update(TICKET_CONTEXT + ".session." + encoded).digest();
}

function verifiedSession(settings) {
  const value = sessionValue(settings.cookieHeader);
  if (value.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return null;
  const [encoded, signed] = value.split(".");
  const expected = sessionMac(encoded, settings);
  const mac = Buffer.from(signed, "base64url");
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (session.v !== 1 || !/^[0-9a-f-]{36}$/.test(session.id) || !Number.isSafeInteger(session.expiresAt) ||
      session.expiresAt <= clock(settings) || session.expiresAt > clock(settings) + STEP_UP_TTL_MS) return null;
  return session;
}

function createSession(settings) {
  let previous = null;
  try { previous = verifiedSession(settings); } catch { /* Replace malformed cookies only after a valid low-score v3. */ }
  const session = { v: 1, id: previous?.id || randomUUID(), expiresAt: clock(settings) + STEP_UP_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");
  const pair = SESSION_COOKIE + "=" + encoded + "." + sessionMac(encoded, settings).toString("base64url");
  return { header: pair + "; Path=/api/noamSiteCompanion; Max-Age=120; HttpOnly; Secure; SameSite=Strict", pair };
}

export function stepUpConfigured(settings = {}) {
  return typeof settings.recaptchaV2SiteKey === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(settings.recaptchaV2SiteKey) &&
    typeof settings.recaptchaV2Secret === "string" && settings.recaptchaV2Secret.trim().length >= 20;
}

export function isTeacherStepUpRequest(payload) {
  const teacher = payload && payload.teacher;
  return payload?.page?.kind === "teachers" && typeof payload.message === "string" &&
    payload.message.trim().length > 0 && payload.message.length <= MAX_MESSAGE_CHARS &&
    /^[1-9]$/.test(String(teacher?.grade)) && /^\d{1,6}$/.test(String(teacher?.topic)) &&
    ["all", "a", "b", "c", "c2", "one"].includes(teacher?.level) &&
    Number.isInteger(teacher?.count) && teacher.count > 0 && teacher.count <= 15 &&
    Array.isArray(teacher.candidates) && teacher.candidates.length > 0;
}

function canonical(value, depth = 0) {
  if (depth > 32) throw new Error("STEP_UP_PAYLOAD_INVALID");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(item => canonical(item, depth + 1)).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical(value[key], depth + 1)).join(",") + "}";
  }
  throw new Error("STEP_UP_PAYLOAD_INVALID");
}

function binding(payload, settings) {
  const ip = clientKey(settings.clientIp);
  const originUrl = new URL(settings.origin);
  const allowedPreview = originUrl.protocol === "https:" && originUrl.origin === settings.origin &&
    !originUrl.port && isHeadlessPreviewHost(originUrl.hostname);
  if (!isAllowedOrigin(settings.origin) && !allowedPreview) return null;
  // Keep the existing no-IP rate limit, but do not use one shared ticket identity.
  const identity = ip !== "untrusted" ? "ip:" + ip : "session:" + (verifiedSession(settings)?.id || "");
  if (identity === "session:") return null;
  const host = originUrl.hostname;
  if (settings.requestHost !== host || !isTeacherStepUpRequest(payload)) return null;
  const { botVerification: _verification, ...request } = payload;
  const serialized = canonical(request);
  if (Buffer.byteLength(serialized) > 256 * 1024) return null;
  return createHash("sha256").update(canonical({
    route: "/api/noamSiteCompanion", origin: settings.origin, host,
    identity: createHash("sha256").update(identity).digest("hex"), request: serialized,
  })).digest("hex");
}

function signature(encoded, secret) {
  return createHmac("sha256", secret).update(TICKET_CONTEXT + "." + encoded).digest();
}

export function createTeacherStepUpChallenge(payload, settings) {
  if (!stepUpConfigured(settings) || typeof settings.captchaUses?.consume !== "function") return null;
  try {
    const session = clientKey(settings.clientIp) === "untrusted" ? createSession(settings) : null;
    const bound = binding(payload, session ? { ...settings, cookieHeader: session.pair } : settings);
    if (!bound) return null;
    const now = clock(settings);
    const expiresAt = now + STEP_UP_TTL_MS;
    const encoded = Buffer.from(JSON.stringify({ v: 1, nonce: randomUUID(), issuedAt: now, expiresAt, bound })).toString("base64url");
    const requestToken = encoded + "." + signature(encoded, settings.recaptchaV2Secret).toString("base64url");
    return { challenge: { provider: "recaptcha-v2", siteKey: settings.recaptchaV2SiteKey, requestToken, expiresAt }, sessionCookie: session?.header || "" };
  } catch {
    return null;
  }
}

function verifiedTicket(payload, settings) {
  const token = payload?.botVerification?.requestToken;
  if (typeof token !== "string" || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  const [encoded, signed] = token.split(".");
  const mac = Buffer.from(signed, "base64url");
  const expected = signature(encoded, settings.recaptchaV2Secret);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  const ticket = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  const now = clock(settings);
  if (ticket.v !== 1 || typeof ticket.nonce !== "string" || !/^[0-9a-f-]{36}$/.test(ticket.nonce) ||
      !Number.isSafeInteger(ticket.issuedAt) || !Number.isSafeInteger(ticket.expiresAt) ||
      ticket.issuedAt > now || ticket.expiresAt <= now || ticket.expiresAt - ticket.issuedAt !== STEP_UP_TTL_MS ||
      ticket.bound !== binding(payload, settings)) return null;
  return ticket;
}

/** A fresh v2 success AND an atomic persistent nonce insert are both required. */
export async function verifyTeacherStepUp(payload, settings) {
  const fail = { ok: false, status: 403, code: "BOT_VERIFICATION_FAILED" };
  if (!stepUpConfigured(settings) || typeof settings.captchaUses?.consume !== "function" ||
      payload?.botVerification?.provider !== "recaptcha-v2") return fail;
  try {
    const ticket = verifiedTicket(payload, settings);
    const token = payload.botVerification.token;
    if (!ticket || typeof token !== "string" || !token || token.length > 8192) return fail;
    // Keep the same deadline through body parsing; receiving headers alone is
    // not a completed verification, and an unresponsive JSON stream must abort.
    const assessment = await fetchWithTimeout(async (url, init) => {
      const response = await settings.fetch(url, init);
      return response?.ok ? response.json() : null;
    }, SITEVERIFY, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: settings.recaptchaV2Secret, response: token }).toString(),
    }, RECAPTCHA_TIMEOUT_MS);
    const now = clock(settings);
    const issuedAt = typeof assessment?.challenge_ts === "string" ? Date.parse(assessment.challenge_ts) : NaN;
    // Classic v2 has no score/action. Never treat a v3 assessment as a human
    // challenge, even if an operator accidentally configured the wrong key type.
    if (assessment?.success !== true || assessment.score !== undefined || assessment.action !== undefined ||
        assessment.hostname !== new URL(settings.origin).hostname ||
        !Number.isFinite(issuedAt) || issuedAt > now || issuedAt < ticket.issuedAt - 1000 || now - issuedAt > STEP_UP_TTL_MS ||
        ticket.expiresAt <= now || (assessment["error-codes"] !== undefined &&
          (!Array.isArray(assessment["error-codes"]) || assessment["error-codes"].length))) return fail;
    if (await settings.captchaUses.consume(ticket.nonce, ticket.expiresAt) !== true) return fail;
    if (ticket.expiresAt <= clock(settings)) return fail;
    return { ok: true, status: 200 };
  } catch {
    // Provider/network/store errors never allow a model call and never expose tokens.
    return fail;
  }
}
