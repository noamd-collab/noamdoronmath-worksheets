/**
 * Noam AI on the headless site. Astro API routes call this.
 * Secrets are passed in by the route (Wix env / Secrets Manager). This file
 * has no secret values. Missing secrets return "not active" and do not call Qwen.
 */
import {
  EXPORT_NOTE,
  FALLBACK_TEXT,
  MISSING_TEXT,
  QUESTION_GAP,
  QWEN_MODEL,
  RAMZI_TEXT,
  handleCompanionTurn,
  isWorksheetSolveRequest,
} from "./companion.js";
import {
  corsHeadersFor,
  guardCompanionRequest,
  isAllowedOrigin,
  isHeadlessPreviewHost,
  isOutboundTimeout,
} from "./bot-guard.js";
import {
  classifyTeacherRequest,
  describePicks,
  hrefForSheet,
  selectTeacherPicks,
} from "./teacher-pick.js";

export const QWEN_SECRET_NAME = "QWEN_API_KEY";
export const NOAM_RECAPTCHA_SECRET_NAME = "NOAM_RECAPTCHA_SECRET_KEY";
/** Public site key already served by the live bot config. Not a secret. */
export const PUBLIC_RECAPTCHA_SITE_KEY = "6LdPhawtAAAAAIqCGLcShp8J1XO16Z9lVGTYuwgq";
export const NOT_ACTIVE_TEXT = "נועם AI לא פעיל כרגע.";

const defaultStore = new Map();

export function secretsReady(qwenKey, recaptchaSecret) {
  return typeof qwenKey === "string" && qwenKey.trim().length > 0 &&
    typeof recaptchaSecret === "string" && recaptchaSecret.trim().length > 0;
}

function inactiveBody() {
  return {
    ok: false,
    active: false,
    code: "NOT_ACTIVE",
    source: "inactive",
    error: NOT_ACTIVE_TEXT,
    text: NOT_ACTIVE_TEXT,
    answer: NOT_ACTIVE_TEXT,
    details: NOT_ACTIVE_TEXT,
    model: null,
    primary: null,
    chips: [],
    options: [],
    links: [],
    essential: [],
    exerciseIds: [],
    sheetIds: [],
  };
}

export function botConfigBody(qwenKey, recaptchaSecret) {
  if (!secretsReady(qwenKey, recaptchaSecret)) return inactiveBody();
  return {
    ok: true,
    active: true,
    provider: "recaptcha-v3",
    siteKey: PUBLIC_RECAPTCHA_SITE_KEY,
    mode: "enforce",
  };
}

function withIds(result, exerciseIds, sheetIds) {
  return Object.assign({}, result, {
    exerciseIds: exerciseIds || [],
    sheetIds: sheetIds || [],
  });
}

function teacherAnswer(pick, catalog) {
  const links = [];
  const chips = [];
  for (const sheet of pick.sheets || []) {
    const href = hrefForSheet(sheet, catalog);
    if (!href || links.some((link) => link.href === href)) continue;
    const title = [sheet.gradeLabel, sheet.topic, sheet.levelLabel].filter(Boolean).join(" · ");
    links.push({
      recordId: sheet.pdfId,
      title,
      href,
      grade: sheet.grade,
      level: sheet.level,
    });
    if (chips.length < 2) chips.push({ id: sheet.pdfId, label: title, href });
  }
  const answer = describePicks(pick);
  const primary = links[0]
    ? { id: links[0].recordId, label: links[0].title, href: links[0].href }
    : null;
  return {
    ok: true,
    active: true,
    source: "classifier",
    model: QWEN_MODEL,
    answer,
    text: answer,
    details: [answer, QUESTION_GAP, EXPORT_NOTE].filter(Boolean).join("\n"),
    primary,
    chips,
    options: chips,
    links,
    essential: [],
    essentialNote: QUESTION_GAP,
    exportNote: EXPORT_NOTE,
    exerciseIds: pick.exerciseIds,
    sheetIds: pick.sheetIds,
  };
}

function missingTeacher() {
  return withIds(
    {
      ok: true,
      active: true,
      source: "catalog-gap",
      model: null,
      answer: MISSING_TEXT,
      text: MISSING_TEXT,
      details: [MISSING_TEXT, QUESTION_GAP, EXPORT_NOTE].join("\n"),
      primary: null,
      chips: [],
      options: [],
      links: [],
      essential: [],
      essentialNote: QUESTION_GAP,
      exportNote: EXPORT_NOTE,
    },
    [],
    []
  );
}

export async function runCompanionTurn(payload, deps) {
  const settings = deps || {};
  const page = payload && payload.page && typeof payload.page === "object" ? payload.page : {};
  const message = String((payload && payload.message) || "");
  if (isWorksheetSolveRequest("worksheet", message)) {
    const text = page.kind === "worksheet" ? RAMZI_TEXT : "נועם AI לא פותר שאלה ולא ממציא תרגיל. הבחירה היא רק מתוך מה שכבר קיים באתר.";
    return withIds(
      {
        ok: true,
        active: true,
        source: page.kind === "worksheet" ? "ramzi-redirect" : "no-solution",
        model: null,
        answer: text,
        text,
        details: text,
        primary: page.kind === "worksheet" ? { label: "עזרה מרמזי", action: "ramzi" } : null,
        chips: [],
        options: [],
        links: [],
        essential: [],
      },
      [],
      []
    );
  }
  if (page.kind === "teachers") {
    let classification = null;
    try {
      classification = await classifyTeacherRequest(payload, {
        apiKey: settings.qwenKey,
        fetch: settings.fetch,
        timeoutMs: settings.qwenTimeoutMs,
      });
    } catch (error) {
      if (isOutboundTimeout(error)) throw error;
      classification = null;
    }
    const pick = selectTeacherPicks(settings.teacherIndex, payload, classification);
    if (!pick.sheets.length) return missingTeacher();
    const body = teacherAnswer(pick, settings.catalog);
    if (!classification) {
      body.model = null;
      body.source = "catalog";
    }
    return body;
  }
  const result = await handleCompanionTurn(payload, {
    catalog: settings.catalog,
    apiKey: settings.qwenKey,
    fetch: settings.fetch,
    timeoutMs: settings.qwenTimeoutMs,
  });
  return withIds(Object.assign({ active: true }, result), [], []);
}

export function isHeadlessPreviewOrigin(origin) {
  if (typeof origin !== "string" || !origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && isHeadlessPreviewHost(url.hostname);
  } catch (error) {
    return false;
  }
}

/**
 * Visitor IP for the rate limit.
 * Probed on the live Wix preview (2026-10-10): Wix does not set
 * cf-connecting-ip, and a client-supplied value is forwarded unchanged.
 * Astro context.clientAddress throws on that host, so callers must not read it.
 * true-client-ip is written by the Wix edge, which replaces a spoofed value.
 * x-real-ip is forwarded from the client. x-forwarded-for is replaced by the
 * edge too, and is still not a key. Only true-client-ip is.
 * An empty result means no visitor IP: the guard keys by the reCAPTCHA token
 * and a higher per-isolate cap, not one shared 12/min bucket.
 */
export function visitorIpFrom(headers) {
  return oneAddress(readHeader(headers, "true-client-ip"));
}

function readHeader(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const value = headers[name] || headers[name.toLowerCase()] || "";
  return Array.isArray(value) ? value[0] : String(value || "");
}

function oneAddress(value) {
  const ip = String(value || "").trim();
  if (!ip || ip === "null" || ip.length > 64 || /[\s,]/.test(ip)) return "";
  return ip;
}

function unavailableBody() {
  return withIds(
    {
      ok: false,
      active: true,
      code: "UNAVAILABLE",
      source: "fallback",
      error: FALLBACK_TEXT,
      text: FALLBACK_TEXT,
      answer: FALLBACK_TEXT,
      details: FALLBACK_TEXT,
      model: null,
      primary: null,
      chips: [],
      options: [],
      links: [],
      essential: [],
    },
    [],
    []
  );
}

function responseHeaders(origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", Vary: "Origin" };
  const cors = corsHeadersFor(origin);
  if (cors) return Object.assign(headers, cors);
  if (isHeadlessPreviewOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return headers;
}

function jsonResponse(status, body, origin) {
  return { status, headers: responseHeaders(origin), body };
}

function readJson(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload;
}

export async function handleNoamBotConfig(deps) {
  const settings = deps || {};
  const body = botConfigBody(settings.qwenKey, settings.recaptchaSecret);
  return jsonResponse(200, body, settings.origin || "");
}

export async function handleNoamSiteCompanion(request, deps) {
  const settings = deps || {};
  const origin = settings.origin || "";
  const method = String((request && request.method) || "POST").toUpperCase();
  if (method === "OPTIONS") {
    if (!isAllowedOrigin(origin) && !isHeadlessPreviewOrigin(origin)) {
      return { status: 403, headers: { Vary: "Origin" }, body: "" };
    }
    return { status: 204, headers: responseHeaders(origin), body: "" };
  }
  if (!secretsReady(settings.qwenKey, settings.recaptchaSecret)) {
    return jsonResponse(200, inactiveBody(), origin);
  }
  let payload = readJson(settings.payload);
  if (settings.payload === undefined && request && typeof request.json === "function") {
    try {
      payload = readJson(await request.json());
    } catch (error) {
      payload = {};
    }
  }
  const guard = await guardCompanionRequest(
    {
      origin,
      clientIp: settings.clientIp,
      message: payload.message,
      botVerification: payload.botVerification,
      now: settings.now,
    },
    {
      store: settings.store || defaultStore,
      secret: settings.recaptchaSecret,
      fetch: settings.fetch,
      extraOrigins: isHeadlessPreviewOrigin(origin) ? [origin] : [],
      recaptchaTimeoutMs: settings.recaptchaTimeoutMs,
      noIpGlobalMax: settings.noIpGlobalMax,
    }
  );
  if (!guard.ok && guard.code === "UNAVAILABLE") {
    return jsonResponse(200, unavailableBody(), origin);
  }
  if (!guard.ok) {
    const fail = withIds(
      {
        ok: false,
        active: true,
        code: guard.code,
        source: "fallback",
        error: FALLBACK_TEXT,
        text: FALLBACK_TEXT,
        answer: FALLBACK_TEXT,
        options: [],
        links: [],
        essential: [],
      },
      [],
      []
    );
    const cors = corsHeadersFor(origin);
    if (!cors) return { status: 403, headers: { Vary: "Origin" }, body: "" };
    return { status: guard.status, headers: cors, body: fail };
  }
  try {
    const result = await runCompanionTurn(payload, settings);
    return jsonResponse(200, result, origin);
  } catch (error) {
    if (!isOutboundTimeout(error)) throw error;
    return jsonResponse(200, unavailableBody(), origin);
  }
}

