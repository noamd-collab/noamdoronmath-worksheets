import type { APIRoute } from 'astro';
import { submitContactForm } from '../../lib/wixContactForm';

export const prerender = false;

/** Contact form endpoint — dry-run default; never logs secrets or message bodies. */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'INVALID_JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await submitContactForm({
    firstName: String(body.firstName || ''),
    lastName: String(body.lastName || ''),
    email: String(body.email || ''),
    message: String(body.message || ''),
    company: String(body.company || body.website || ''),
  });

  if (!result.ok) {
    const status =
      result.error === 'SPAM_REJECTED'
        ? 400
        : result.error === 'LIVE_SUBMIT_NOT_AUTHORIZED' || result.error === 'FORMS_API_KEY_INVALID'
          ? 503
          : 400;
    return new Response(JSON.stringify(result), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  // The client reads only ok, mode and error. Credential flags, site IDs and
  // setup instructions stay on the server (formsLiveSubmitBlocker in tests/CLI).
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

/** POST only. A public GET used to expose the live-submit configuration. */
export const GET: APIRoute = async () =>
  new Response(null, { status: 405, headers: { allow: 'POST' } });
