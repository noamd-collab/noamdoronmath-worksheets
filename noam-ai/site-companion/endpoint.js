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
  QWEN_TIMEOUT_MS,
  resolveQwenTarget,
  RAMZI_TEXT,
  handleCompanionTurn,
  isWorksheetSolveRequest,
} from "./companion.js";
import { resolveDeterministicTurn } from "./guide-flow.js";
import { createTeacherStepUpChallenge, stepUpConfigured, verifyTeacherStepUp } from "./teacher-step-up.js";
import {
  corsHeadersFor,
  guardCompanionRequest,
  isAllowedOrigin,
  isHeadlessPreviewHost,
  isOutboundTimeout,
  OutboundTimeoutError,
  takeCompanionRate,
} from "./bot-guard.js";
import {
  classifyTeacherRequest,
  describePicks,
  hrefForSheet,
  logTeacherSelection,
  recoverTeacherPickFromPlan,
  requestedPickCount,
  validateExactTeacherPrimary,
  selectTeacherPicks,
  selectTeacherPlans,
  teacherCorrectionEligible,
} from "./teacher-pick.js";

export const QWEN_SECRET_NAME = "QWEN_API_KEY";
export const QWEN_BASE_URL_NAME = "QWEN_BASE_URL";
export const QWEN_MODEL_NAME = "QWEN_MODEL";
export const NOAM_RECAPTCHA_SECRET_NAME = "NOAM_RECAPTCHA_SECRET_KEY";
export const NOAM_RECAPTCHA_V2_SITE_KEY_NAME = "NOAM_RECAPTCHA_V2_SITE_KEY";
export const NOAM_RECAPTCHA_V2_SECRET_NAME = "NOAM_RECAPTCHA_V2_SECRET_KEY";
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

export function botConfigBody(qwenKey, recaptchaSecret, settings = {}) {
  if (!secretsReady(qwenKey, recaptchaSecret)) return inactiveBody();
  return {
    ok: true,
    active: true,
    provider: "recaptcha-v3",
    siteKey: PUBLIC_RECAPTCHA_SITE_KEY,
    mode: "enforce",
    ...(stepUpConfigured(settings) ? { stepUp: { provider: "recaptcha-v2", siteKey: settings.recaptchaV2SiteKey } } : {}),
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
    modelExerciseIds: pick.modelExerciseIds || [],
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

function failedTeacherSelection(catalog, code, selectionError) {
  const answer = selectionError
    ? "לא התקבלה בחירת שאלות תקינה שמשלבת את כל הרמות. אפשר לנסות שוב או לבחור שאלות ידנית."
    : "לא התקבלה בחירת שאלות מה-AI. אפשר לנסות שוב או לבחור שאלות ידנית.";
  return Object.assign(teacherAnswer({ sheets: [], exerciseIds: [], modelExerciseIds: [], sheetIds: [] }, catalog), {
    source: "fallback", model: null, code, ...(selectionError ? { selectionError } : {}), answer, text: answer, details: answer,
  });
}

export async function runCompanionTurn(payload, deps) {
  const settings = deps || {};
  const guided = resolveDeterministicTurn(payload, settings);
  if (guided) return guided;
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
    let classificationFailure = "MODEL_RESPONSE_FAILED";
    const modelNow = typeof settings.modelNow === "function" ? settings.modelNow : Date.now;
    const budget = Number.isFinite(settings.qwenTimeoutMs) ? Math.max(0, Math.min(QWEN_TIMEOUT_MS, settings.qwenTimeoutMs)) : QWEN_TIMEOUT_MS;
    const modelSettings = {
      apiKey: settings.qwenKey, baseUrl: settings.qwenBaseUrl, model: settings.qwenModel,
      fetch: settings.fetch, timeoutMs: budget, deadlineMs: modelNow() + budget, now: modelNow,
      log: settings.log, teacherIndex: settings.teacherIndex,
    };
    const remainingMs = () => Math.max(0, Math.floor(modelSettings.deadlineMs - modelNow()));
    try {
      classification = await classifyTeacherRequest(payload, modelSettings);
    } catch (error) {
      if (isOutboundTimeout(error)) throw error;
      classification = null;
      classificationFailure = ["MODEL_AUTH_FAILED", "MODEL_HTTP", "QWEN_CONFIG_REJECTED"].includes(error.code) ? error.code : "MODEL_RESPONSE_FAILED";
      if (error instanceof SyntaxError) logTeacherSelection(settings, { code: "MODEL_RESPONSE_INVALID", reason: "invalid-json",
        requestedCount: requestedPickCount(payload) });
    }
    const model = classification ? resolveQwenTarget({ model: settings.qwenModel, baseUrl: settings.qwenBaseUrl }).model : null;
    const plans = classification ? selectTeacherPlans(settings.teacherIndex, payload, classification, model) : {};
    let pick = selectTeacherPicks(settings.teacherIndex, payload, classification);
    const recovered = classification ? recoverTeacherPickFromPlan(settings.teacherIndex, payload, pick, plans) : null;
    if (recovered) {
      logTeacherSelection(settings, { code: "MODEL_SELECTION_RECOVERED", reason: "requested-plan",
        requestedCount: requestedPickCount(payload), primaryCount: classification.scopedExerciseLabels.length,
        planCount: Object.keys(plans).length });
      pick = recovered;
    }
    if (teacherCorrectionEligible(settings.teacherIndex, payload, classification, pick, plans)) {
      const reason = pick.selectionError === "MODEL_LEVEL_COVERAGE_MISSING" ? "level-coverage" : "primary-invalid";
      const diagnostic = () => ({ requestedCount: requestedPickCount(payload), remainingMs: remainingMs(), planCount: Object.keys(plans).length });
      if (!remainingMs()) {
        logTeacherSelection(settings, { ...diagnostic(), code: "MODEL_CORRECTION_REJECTED", reason: "deadline" });
        throw new OutboundTimeoutError();
      }
      logTeacherSelection(settings, { ...diagnostic(), code: "MODEL_CORRECTION_ATTEMPTED", reason });
      let corrected;
      try {
        corrected = await classifyTeacherRequest(payload, { ...modelSettings, correctionReason: reason });
      } catch (error) {
        logTeacherSelection(settings, { ...diagnostic(), code: "MODEL_CORRECTION_REJECTED", reason: isOutboundTimeout(error) ? "deadline" : "provider-failure" });
        if (isOutboundTimeout(error)) throw error;
        const code = ["MODEL_AUTH_FAILED", "MODEL_HTTP", "QWEN_CONFIG_REJECTED"].includes(error && error.code) ? error.code : "MODEL_RESPONSE_FAILED";
        return failedTeacherSelection(settings.catalog, code);
      }
      const validation = validateExactTeacherPrimary(settings.teacherIndex, payload, corrected);
      const exact = validation.pick;
      if (!exact) {
        const reason = !corrected ? "invalid-json" : validation.selectionError === "MODEL_LEVEL_COVERAGE_MISSING" ? "level-coverage" : "primary-invalid";
        logTeacherSelection(settings, { ...diagnostic(), code: "MODEL_CORRECTION_REJECTED", reason });
        const code = corrected ? validation.selectionError : "MODEL_RESPONSE_FAILED";
        return failedTeacherSelection(settings.catalog, code, corrected && pick.selectionError ? code : undefined);
      }
      // Retain only already-validated original plans. The correction supplies a
      // new primary choice, never a locally derived plan for a different count.
      pick = exact;
      classification = corrected;
      logTeacherSelection(settings, { ...diagnostic(), code: "MODEL_CORRECTION_SUCCEEDED", reason: "exact-primary", primaryCount: exact.modelExerciseIds.length });
    }
    if (pick.selectionError === "MODEL_LEVEL_COVERAGE_MISSING" || pick.selectionError === "MODEL_SELECTION_INVALID") {
      const code = classification ? pick.selectionError : classificationFailure;
      if (classification) logTeacherSelection(settings, { code: "MODEL_SELECTION_REJECTED",
        reason: pick.selectionError === "MODEL_LEVEL_COVERAGE_MISSING" ? "level-coverage" : "primary-invalid",
        requestedCount: requestedPickCount(payload), primaryCount: classification.scopedExerciseLabels.length,
        planCount: Object.keys(plans).length });
      return failedTeacherSelection(settings.catalog, code, classification ? code : undefined);
    }
    if (!pick.sheets.length) {
      const missing = missingTeacher();
      return classification ? missing : Object.assign(missing, { source: "fallback", model: null, code: classificationFailure });
    }
    const body = teacherAnswer(pick, settings.catalog);
    if (classification) body.model = model;
    if (classification && pick.selectionSource) body.source = pick.selectionSource;
    if (!classification || pick.selectionSource === "fallback") {
      body.model = null;
      body.source = "fallback";
      body.code = classification ? "MODEL_SELECTION_INVALID" : classificationFailure;
      body.answer = (classification
        ? "לא התקבלה מהמודל בחירה תקינה של שאלות. הנה בחירה בסיסית מהמאגר: "
        : "החיבור למודל לא הצליח. הנה בחירה בסיסית מהמאגר: ") + body.answer;
      body.text = body.answer;
      body.details = [body.answer, QUESTION_GAP, EXPORT_NOTE].filter(Boolean).join("\n");
    } else if (pick.selectionSource === "mixed") {
      body.code = "MODEL_SELECTION_PARTIAL";
      body.answer = "המודל בחר חלק מהשאלות, והבחירה הושלמה מקומית: " + body.answer;
      body.text = body.answer;
      body.details = [body.answer, QUESTION_GAP, EXPORT_NOTE].filter(Boolean).join("\n");
    }
    if (Object.keys(plans).length) body.teacherPlans = plans;
    return body;
  }
  const result = await handleCompanionTurn(payload, {
    catalog: settings.catalog,
    guide: settings.guide,
    apiKey: settings.qwenKey,
    baseUrl: settings.qwenBaseUrl,
    model: settings.qwenModel,
    fetch: settings.fetch,
    timeoutMs: settings.qwenTimeoutMs,
    log: settings.log,
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

function requestHostFrom(request, settings) {
  if (settings && settings.requestHost) return String(settings.requestHost).trim();
  const raw = request && typeof request.url === "string" ? request.url : "";
  try {
    return new URL(raw).hostname;
  } catch (error) {
    return "";
  }
}

function denied(guard, origin) {
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
  if (guard.code === "BOT_VERIFICATION_FAILED" && guard.siteverify) {
    fail.siteverify = guard.siteverify;
  }
  return { status: guard.status || 403, headers: responseHeaders(origin), body: fail };
}

function readJson(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload;
}

export async function handleNoamBotConfig(deps) {
  const settings = deps || {};
  const body = botConfigBody(settings.qwenKey, settings.recaptchaSecret, settings);
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
  const originAllowed = isAllowedOrigin(origin) || isHeadlessPreviewOrigin(origin);
  if (!originAllowed) {
    return { status: 403, headers: { Vary: "Origin" }, body: "" };
  }
  const requestHost = requestHostFrom(request, settings);
  const stepUpSettings = { ...settings, requestHost, cookieHeader: request?.headers?.get?.("cookie") || "" };
  const store = settings.store || defaultStore;
  // Fixed answers skip reCAPTCHA. They still take the same 12/min slot.
  const limited = await takeCompanionRate(
    {
      clientIp: settings.clientIp,
      botVerification: payload.botVerification,
      now: settings.now,
    },
    { store, noIpGlobalMax: settings.noIpGlobalMax, rateBackend: settings.rateBackend }
  );
  if (!limited.ok) {
    const fail = denied(limited, origin);
    if (payload.rateProbe === true && isHeadlessPreviewHost(requestHost) && fail.body && typeof fail.body === "object") {
      fail.body.backend = limited.backend || "memory";
      if (limited.wixError) fail.body.wixError = String(limited.wixError).slice(0, 300);
    }
    return fail;
  }
  const isStepUp = payload.botVerification?.provider === "recaptcha-v2";
  if (payload.rateProbe === true && !isStepUp) {
    const probe = { ok: true, active: true, probe: true, code: "RATE_OK" };
    if (isHeadlessPreviewHost(requestHost)) {
      probe.backend = limited.backend || "memory";
      if (limited.wixError) probe.wixError = String(limited.wixError).slice(0, 300);
    }
    return jsonResponse(200, probe, origin);
  }
  // Guide, topic order, and lesson picking do not call the model.
  // Answer them before reCAPTCHA so a failed check does not block a real visitor.
  const guided = isStepUp ? null : resolveDeterministicTurn(payload, settings);
  if (guided) return jsonResponse(200, guided, origin);
  const guard = isStepUp ? await verifyTeacherStepUp(payload, stepUpSettings) : await guardCompanionRequest(
    {
      origin,
      requestHost,
      clientIp: settings.clientIp,
      message: payload.message,
      botVerification: payload.botVerification,
      now: settings.now,
    },
    {
      store,
      skipRateLimit: true,
      secret: settings.recaptchaSecret,
      fetch: settings.fetch,
      extraOrigins: isHeadlessPreviewOrigin(origin) ? [origin] : [],
      recaptchaTimeoutMs: settings.recaptchaTimeoutMs,
      noIpGlobalMax: settings.noIpGlobalMax,
      recaptchaBypass: settings.recaptchaBypass,
    }
  );
  if (!guard.ok && guard.code === "UNAVAILABLE") {
    return jsonResponse(200, unavailableBody(), origin);
  }
  if (!guard.ok) {
    if (guard.stepUpEligible === true && guard.siteverify?.hostname === requestHost) {
      const stepUp = createTeacherStepUpChallenge(payload, stepUpSettings);
      if (stepUp) {
        const result = denied({ ...guard, code: "BOT_STEP_UP_REQUIRED" }, origin);
        result.body.challenge = stepUp.challenge;
        result.headers["Cache-Control"] = "no-store";
        if (stepUp.sessionCookie) result.headers["Set-Cookie"] = stepUp.sessionCookie;
        return result;
      }
    }
    return denied(guard, origin);
  }
  try {
    const result = await runCompanionTurn(payload, settings);
    return jsonResponse(200, result, origin);
  } catch (error) {
    if (!isOutboundTimeout(error)) throw error;
    return jsonResponse(200, unavailableBody(), origin);
  }
}

