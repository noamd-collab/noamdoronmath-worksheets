import type { APIRoute } from 'astro';
import { buildPaymentRedirect, validateCheckout, type CheckoutInput } from '../../lib/checkout';
import { allowPaymentTesting } from '../../lib/paymentAccess';
import { runtimeProcessEnv } from '../../lib/runtimeEnv';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/**
 * Checkout handoff. Validates the customer details server-side and returns the
 * Grow hosted-payment URL. No card data ever reaches this endpoint, and no
 * personal details are written to logs.
 */
const closed = () =>
  json(
    { ok: false, code: 'PAYMENT_CLOSED', message: 'התשלום עדיין לא נפתח.' },
    403
  );

export const POST: APIRoute = async ({ request }) => {
  if (!(await allowPaymentTesting(request))) return closed();

  let body: CheckoutInput = {};
  try {
    body = (await request.json()) as CheckoutInput;
  } catch {
    return json({ ok: false, code: 'INVALID_JSON', message: 'הבקשה לא תקינה.' }, 400);
  }

  const result = validateCheckout(body);
  if (!result.ok) {
    return json({ ok: false, code: result.code, message: result.message }, 400);
  }

  const redirectUrl = buildPaymentRedirect(result.value, runtimeProcessEnv());
  if (!redirectUrl) {
    return json(
      {
        ok: false,
        code: 'PAYMENT_NOT_CONFIGURED',
        message:
          'דף התשלום טרם חובר. אפשר לפנות בדוא״ל ונעדכן כשהוא ייפתח — בינתיים לא בוצע שום חיוב.',
      },
      503
    );
  }

  return json({ ok: true, plan: result.value.plan, redirectUrl });
};

export const GET: APIRoute = async ({ request }) => {
  if (!(await allowPaymentTesting(request))) return closed();
  return json({
    ok: true,
    configured: Boolean(runtimeProcessEnv().GROW_PAYMENT_URL_MONTHLY || runtimeProcessEnv().GROW_PAYMENT_URL_YEARLY),
    plans: ['monthly', 'yearly'],
  });
};
