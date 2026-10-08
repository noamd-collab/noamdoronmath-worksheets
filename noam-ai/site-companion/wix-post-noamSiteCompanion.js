/**
 * Deploy source for the site-wide Noam AI companion.
 * Do not run `wix release` from an agent. Noam copies this into the private
 * my-site-2 backend. Steps: docs/noam-ai-golive-checklist.md.
 *
 * Secret QWEN_API_KEY: use the same Wix secret name the private noamDiagramPlan
 * planner already uses. Do not create a second key and do not commit a key.
 * RECAPTCHA_SECRET_NAME in bot-guard.js must be the secret that existing AI
 * routes already use for reCAPTCHA. Do not invent a new one.
 *
 * Catalog: copy headless/astro-poc/src/data/catalog.v1.json beside this module
 * as backend/noam-site-catalog.v1.json.
 *
 * POST https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion
 * Model: qwen3.8-flash, thinking disabled, max 800 output tokens.
 * Origins are an exact allowlist. There is no Access-Control-Allow-Origin: *.
 */
import { response } from "wix-http-functions";
import { getSecret } from "wix-secrets-backend";
import { handleCompanionTurn, FALLBACK_TEXT } from "./companion.js";
import catalog from "./noam-site-catalog.v1.json";
import {
  RECAPTCHA_SECRET_NAME,
  corsHeadersFor,
  guardCompanionRequest,
} from "./bot-guard.js";

const rateStore = new Map();

function headerValue(request, name) {
  const headers = request && request.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || headers.get(name.toLowerCase()) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

function originOf(request) {
  return headerValue(request, "Origin");
}

function send(origin, status, body) {
  const headers = corsHeadersFor(origin);
  if (!headers) {
    return response({ status: 403, headers: { Vary: "Origin" }, body: "" });
  }
  return response({ status, headers, body: body ? JSON.stringify(body) : "" });
}

export function options_noamSiteCompanion(request) {
  const origin = originOf(request);
  const headers = corsHeadersFor(origin);
  if (!headers) return response({ status: 403, headers: { Vary: "Origin" }, body: "" });
  return response({ status: 204, headers });
}

export async function post_noamSiteCompanion(request) {
  const origin = originOf(request);
  let payload = {};
  try {
    payload = await request.body.json();
  } catch (error) {
    payload = {};
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = {};
  const guard = await guardCompanionRequest(
    {
      origin,
      forwardedFor: headerValue(request, "X-Forwarded-For"),
      message: payload.message,
      botVerification: payload.botVerification,
    },
    {
      store: rateStore,
      secret: await readSecret(RECAPTCHA_SECRET_NAME),
      fetch,
    }
  );
  if (!guard.ok) {
    return send(origin, guard.status, {
      ok: false,
      code: guard.code,
      source: "fallback",
      text: FALLBACK_TEXT,
      answer: FALLBACK_TEXT,
      options: [],
      links: [],
      essential: [],
    });
  }
  const result = await handleCompanionTurn(payload, {
    catalog,
    apiKey: await readSecret("QWEN_API_KEY"),
    fetch,
  });
  return send(origin, 200, result);
}

async function readSecret(name) {
  try {
    return await getSecret(name);
  } catch (error) {
    return "";
  }
}
