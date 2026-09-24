import type { APIRoute } from 'astro';
import { submitContactForm, formsLiveSubmitBlocker } from '../../lib/wixContactForm';

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

  const result = await submitContactForm(
    {
      firstName: String(body.firstName || ''),
      lastName: String(body.lastName || ''),
      email: String(body.email || ''),
      message: String(body.message || ''),
    },
    { mode: 'dry-run' }
  );

  if (!result.ok) {
    return new Response(JSON.stringify(result), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ...result,
      liveSubmit: formsLiveSubmitBlocker(),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      mode: 'dry-run',
      liveSubmit: formsLiveSubmitBlocker(),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
};
