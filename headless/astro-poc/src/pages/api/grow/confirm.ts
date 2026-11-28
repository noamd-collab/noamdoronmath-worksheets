import type { APIRoute } from 'astro';
import { GROW_IPN_SECRET } from 'astro:env/server';
import { verifyReturnToken } from '../../../lib/growPayment';
import { secretFromEnv } from '../../../lib/noamSecrets';
import { runtimeProcessEnv } from '../../../lib/runtimeEnv';

export const prerender = false;

/**
 * Where Grow sends the buyer back after paying.
 *
 * This route never trusts the query string as proof of payment: it only checks
 * that we minted the return link ourselves. The actual entitlement is written
 * by the IPN, so a buyer who lands here before the IPN arrives still sees the
 * teacher area closed until the server confirms.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const env = {
    ...runtimeProcessEnv(),
    GROW_IPN_SECRET: secretFromEnv('GROW_IPN_SECRET', GROW_IPN_SECRET),
  };
  const secret = env.GROW_IPN_SECRET || '';
  const token = url.searchParams.get('t') || '';
  const fallback = new URL('/payment', url);

  if (!secret || !token) {
    fallback.searchParams.set('access', 'invalid');
    return new Response(null, { status: 302, headers: { location: fallback.toString() } });
  }

  const verified = await verifyReturnToken(token, secret);
  if (!verified.ok) {
    fallback.searchParams.set('access', 'invalid');
    return new Response(null, { status: 302, headers: { location: fallback.toString() } });
  }

  const target = new URL('/teachers', url);
  target.searchParams.set('access', 'confirmed');
  return new Response(null, {
    status: 302,
    headers: { location: target.toString(), 'cache-control': 'no-store' },
  });
};
