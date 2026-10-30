/**
 * Same-origin Noam AI endpoint for the headless site.
 * POST /api/noamSiteCompanion
 * Secrets QWEN_API_KEY and NOAM_RECAPTCHA_SECRET_KEY are optional at build time.
 * When either is missing the response is "not active" and Qwen is not called.
 */
import type { APIRoute } from 'astro';
import { NOAM_RECAPTCHA_SECRET_KEY, NOAM_RECAPTCHA_V2_SITE_KEY, NOAM_RECAPTCHA_V2_SECRET_KEY, QWEN_API_KEY, QWEN_BASE_URL, QWEN_MODEL } from 'astro:env/server';
import catalog from '../../data/catalog.v1.json';
import guide from '../../data/site-guide.v1.json';
import teacherIndex from '../../data/teacher-pick-index.json';
import {
  NOAM_RECAPTCHA_SECRET_NAME,
  NOAM_RECAPTCHA_V2_SITE_KEY_NAME,
  NOAM_RECAPTCHA_V2_SECRET_NAME,
  QWEN_BASE_URL_NAME,
  QWEN_MODEL_NAME,
  QWEN_SECRET_NAME,
  handleNoamSiteCompanion,
  visitorIpFrom,
} from '../../../../../noam-ai/site-companion/endpoint.js';
import { publicRequestHost, recaptchaBypassFromEnv } from '../../../../../noam-ai/site-companion/bot-guard.js';
import { secretFromEnv } from '../../lib/noamSecrets';
import { runtimeProcessEnv } from '../../lib/runtimeEnv';
import { createWixRateBackend } from '../../lib/noamRateStore';
import { createWixCaptchaUseStore } from '../../lib/noamCaptchaUses';

export const prerender = false;

const sharedRate = createWixRateBackend();
const captchaUses = createWixCaptchaUseStore();

function keys() {
  return {
    qwenKey: secretFromEnv(QWEN_SECRET_NAME, QWEN_API_KEY),
    qwenBaseUrl: secretFromEnv(QWEN_BASE_URL_NAME, QWEN_BASE_URL),
    qwenModel: secretFromEnv(QWEN_MODEL_NAME, QWEN_MODEL),
    recaptchaSecret: secretFromEnv(NOAM_RECAPTCHA_SECRET_NAME, NOAM_RECAPTCHA_SECRET_KEY),
    recaptchaV2SiteKey: secretFromEnv(NOAM_RECAPTCHA_V2_SITE_KEY_NAME, NOAM_RECAPTCHA_V2_SITE_KEY),
    recaptchaV2Secret: secretFromEnv(NOAM_RECAPTCHA_V2_SECRET_NAME, NOAM_RECAPTCHA_V2_SECRET_KEY),
  };
}

function clientIpOf(context: { request: Request }): string {
  return visitorIpFrom(context.request.headers);
}

function send(result: { status: number; headers: Record<string, string>; body: unknown }): Response {
  const body = result.body === '' || result.body == null ? '' : JSON.stringify(result.body);
  return new Response(body, { status: result.status, headers: result.headers });
}

function requestHostOf(request: Request): string {
  return publicRequestHost(
    request.url,
    request.headers.get('x-forwarded-host') || '',
    request.headers.get('host') || '',
  );
}

async function respond(context: Parameters<APIRoute>[0]): Promise<Response> {
  const requestHost = requestHostOf(context.request);
  const result = await handleNoamSiteCompanion(context.request, {
    ...keys(),
    origin: context.request.headers.get('origin') || '',
    requestHost,
    clientIp: clientIpOf(context),
    catalog,
    guide,
    teacherIndex,
    fetch: globalThis.fetch.bind(globalThis),
    recaptchaBypass: recaptchaBypassFromEnv(runtimeProcessEnv(), requestHost),
    rateBackend: sharedRate,
    captchaUses,
  });
  return send(result);
}

export const POST: APIRoute = (context) => respond(context);
export const OPTIONS: APIRoute = (context) => respond(context);
