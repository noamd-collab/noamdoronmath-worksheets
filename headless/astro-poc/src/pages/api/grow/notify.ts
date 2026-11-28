import type { APIRoute } from 'astro';
import { GROW_IPN_SECRET, NOAM_TEACHER_GRANT_SECRET } from 'astro:env/server';
import {
  GROW_CONTRACT,
  grantGrowEntitlement,
  normalizeGrowNotification,
  revokeGrowEntitlement,
  verifyGrowSignature,
} from '../../../lib/growPayment';
import { secretFromEnv } from '../../../lib/noamSecrets';
import { runtimeProcessEnv } from '../../../lib/runtimeEnv';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/**
 * Grow IPN endpoint.
 *
 * Order matters: read the raw body, verify the signature over exactly those
 * bytes, and only then parse. A notification that fails verification never
 * reaches the database, and nothing about the payer is written to logs.
 *
 * Grow retries a non-2xx response, so a handled notification always answers
 * 200 — including duplicates and statuses we deliberately ignore.
 */
export const POST: APIRoute = async ({ request }) => {
  // On Wix hosting the worker has no populated process.env; secrets arrive
  // through the Astro env schema, with process.env as the local/test fallback.
  const env = {
    ...runtimeProcessEnv(),
    GROW_IPN_SECRET: secretFromEnv('GROW_IPN_SECRET', GROW_IPN_SECRET),
    NOAM_TEACHER_GRANT_SECRET: secretFromEnv('NOAM_TEACHER_GRANT_SECRET', NOAM_TEACHER_GRANT_SECRET),
  };
  const secret = env.GROW_IPN_SECRET || '';
  if (!secret) {
    return json({ ok: false, code: 'NOT_CONFIGURED' }, 503);
  }

  const rawBody = await request.text();
  const verified = await verifyGrowSignature({
    rawBody,
    signature: request.headers.get(GROW_CONTRACT.signatureHeader),
    timestamp: request.headers.get(GROW_CONTRACT.timestampHeader),
    secret,
  });
  if (!verified) {
    return json({ ok: false, code: 'BAD_SIGNATURE' }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, code: 'INVALID_JSON' }, 400);
  }

  const parsed = normalizeGrowNotification(payload);
  if (!parsed.ok) {
    return json({ ok: false, code: parsed.code }, 400);
  }

  const notification = parsed.value;

  if (notification.status === 'refunded') {
    const revoked = await revokeGrowEntitlement({
      paymentId: notification.transactionId,
      reason: 'refunded',
      env,
    });
    if (!revoked.ok) {
      // A failed revoke must be retried by Grow, not silently swallowed.
      return json({ ok: false, code: revoked.code }, 500);
    }
    return json({ ok: true, handled: 'revoked' });
  }

  if (notification.status !== 'paid') {
    return json({ ok: true, handled: 'ignored', status: notification.status });
  }

  const granted = await grantGrowEntitlement({ notification, env });
  if (!granted.ok) {
    return json({ ok: false, code: granted.code }, 500);
  }
  return json({ ok: true, handled: 'granted', duplicate: granted.alreadyGranted });
};
