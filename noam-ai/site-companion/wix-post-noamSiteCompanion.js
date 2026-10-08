/**
 * Deploy source for the teachers-page and site-wide Noam AI companion.
 * Do not run `wix release` from the agent. Copy this file into the private
 * Wix backend and append the two exports to backend/http-functions.js.
 *
 * Secret: Wix Secrets name QWEN_API_KEY. Use the same QwenCloud key the private
 * noamDiagramPlan planner already uses. The existing secret's name is not in
 * this repo. Do not put the key in client code and do not commit it.
 *
 * Catalog: copy headless/astro-poc/src/data/catalog.v1.json beside this module
 * as backend/noam-site-catalog.v1.json. The import below expects that copy.
 *
 * Same host pattern as noamDiagramPlan:
 *   POST https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion
 * Model: qwen3.8-flash, thinking disabled, max 800 output tokens.
 * Also put this route behind the same bot guard as noamDiagramPlan before it is public.
 */
import { response } from "wix-http-functions";
import { getSecret } from "wix-secrets-backend";
import { handleCompanionTurn, FALLBACK_TEXT } from "./companion.js";
import catalog from "./noam-site-catalog.v1.json";

const CORS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(status, body) {
  return response({ status, headers: CORS, body: JSON.stringify(body) });
}

export function options_noamSiteCompanion() {
  return response({ status: 204, headers: CORS });
}

export async function post_noamSiteCompanion(request) {
  let payload = {};
  try {
    payload = await request.body.json();
  } catch (error) {
    return send(400, { ok: false, source: "fallback", text: FALLBACK_TEXT, options: [], links: [], essential: [] });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return send(400, { ok: false, source: "fallback", text: FALLBACK_TEXT, options: [], links: [], essential: [] });
  }
  let apiKey = "";
  try {
    apiKey = await getSecret("QWEN_API_KEY");
  } catch (error) {
    apiKey = "";
  }
  const result = await handleCompanionTurn(payload, {
    catalog,
    apiKey,
    fetch,
  });
  return send(200, result);
}
