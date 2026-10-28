/**
 * Writes noam-ai/site-companion/DEPLOY_WIX/backend for a copy into Wix.
 * Noam does not run this. The folder in git is the paste-ready result.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const out = join(here, "DEPLOY_WIX/backend");
mkdirSync(out, { recursive: true });

const core = readFileSync(join(here, "companion.js"), "utf8").replace(
  'from "./retrieve.js"',
  "from 'backend/noam-site-companion-retrieve'"
);
if (core.includes("./")) {
  throw new Error("companion copy still has a relative import");
}
writeFileSync(join(out, "noam-site-companion-core.js"), core);
writeFileSync(join(out, "noam-site-companion-retrieve.js"), readFileSync(join(here, "retrieve.js")));
writeFileSync(join(out, "noam-site-companion-guard.js"), readFileSync(join(here, "bot-guard.js")));

const catalog = readFileSync(join(root, "headless/astro-poc/src/data/catalog.v1.json"), "utf8");
JSON.parse(catalog);
writeFileSync(
  join(out, "noam-site-catalog.js"),
  "/** Verified page catalog. Do not replace this object with an empty list. */\nexport const catalog = " +
    catalog.trim() +
    ";\n"
);

const handler = `/**
 * backend/noam-site-companion.js
 *
 * Copy this file into the Wix backend as-is.
 * It uses backend/ imports, wix-fetch, and the platform IP (request.ip).
 * A caller cannot change request.ip by sending a header.
 */
import { response } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { handleCompanionTurn, FALLBACK_TEXT } from 'backend/noam-site-companion-core';
import { catalog } from 'backend/noam-site-catalog';
import {
  RECAPTCHA_SECRET_NAME,
  corsHeadersFor,
  guardCompanionRequest,
} from 'backend/noam-site-companion-guard';

const rateStore = new Map();
const QWEN_SECRET_NAME = 'QWEN_API_KEY';

function headerValue(request, name) {
  const headers = request && request.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || '';
  return headers[name] || headers[name.toLowerCase()] || '';
}

function originOf(request) {
  return headerValue(request, 'Origin');
}

function clientIp(request) {
  const ip = request && request.ip;
  return typeof ip === 'string' ? ip : '';
}

function send(origin, status, body) {
  const headers = corsHeadersFor(origin);
  if (!headers) {
    return response({ status: 403, headers: { Vary: 'Origin' }, body: '' });
  }
  return response({ status, headers, body: body ? JSON.stringify(body) : '' });
}

async function readSecret(name) {
  try {
    return await getSecret(name);
  } catch (error) {
    return '';
  }
}

export function options_noamSiteCompanion(request) {
  const origin = originOf(request);
  const headers = corsHeadersFor(origin);
  if (!headers) return response({ status: 403, headers: { Vary: 'Origin' }, body: '' });
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
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
  const guard = await guardCompanionRequest(
    {
      origin,
      clientIp: clientIp(request),
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
      source: 'fallback',
      text: FALLBACK_TEXT,
      answer: FALLBACK_TEXT,
      options: [],
      links: [],
      essential: [],
    });
  }
  const result = await handleCompanionTurn(payload, {
    catalog,
    apiKey: await readSecret(QWEN_SECRET_NAME),
    fetch,
  });
  return send(origin, 200, result);
}
`;
writeFileSync(join(out, "noam-site-companion.js"), handler);

const paste = `/*
 * Paste this whole file at the BOTTOM of the existing backend/http-functions.js.
 * Do not delete or replace anything that is already in that file.
 * These wrappers are explicit, same as blog-audio-pipeline/DEPLOY_WIX/backend/http-functions.js.
 */
import * as noamSiteCompanion from 'backend/noam-site-companion';

export function options_noamSiteCompanion(request) {
  return noamSiteCompanion.options_noamSiteCompanion(request);
}

export function post_noamSiteCompanion(request) {
  return noamSiteCompanion.post_noamSiteCompanion(request);
}
`;
writeFileSync(join(out, "PASTE-AT-END-OF-http-functions.js"), paste);
console.log("wrote", out);
