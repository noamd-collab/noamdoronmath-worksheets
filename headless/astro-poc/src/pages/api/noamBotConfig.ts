/**
 * Public reCAPTCHA config for Noam AI. GET /api/noamBotConfig
 * The site key is public. The secret is never returned.
 * Without both secrets the body says the companion is not active.
 */
import type { APIRoute } from 'astro';
import { NOAM_RECAPTCHA_SECRET_KEY, QWEN_API_KEY } from 'astro:env/server';
import {
  NOAM_RECAPTCHA_SECRET_NAME,
  QWEN_SECRET_NAME,
  handleNoamBotConfig,
} from '../../../../../noam-ai/site-companion/endpoint.js';
import { secretFromEnv } from '../../lib/noamSecrets';

export const prerender = false;

export const GET: APIRoute = (context) => {
  return handleNoamBotConfig({
    qwenKey: secretFromEnv(QWEN_SECRET_NAME, QWEN_API_KEY),
    recaptchaSecret: secretFromEnv(NOAM_RECAPTCHA_SECRET_NAME, NOAM_RECAPTCHA_SECRET_KEY),
    origin: context.request.headers.get('origin') || '',
  }).then((result) => {
    const body = result.body === '' || result.body == null ? '' : JSON.stringify(result.body);
    return new Response(body, { status: result.status, headers: result.headers });
  });
};
