/**
 * Checkout validation for the teacher-area access plans.
 *
 * The five customer fields are the ones Grow requires on a checkout page:
 * first name, last name, phone without the leading prefix, country, email.
 * Nothing here talks to a payment provider; the redirect URL comes from the
 * server environment so no key or link is ever shipped to the browser bundle.
 */

export type PlanId = 'monthly' | 'yearly';

export type CheckoutInput = {
  plan?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  country?: unknown;
  email?: unknown;
  terms?: unknown;
  reminder?: unknown;
};

export type NormalizedCheckout = {
  plan: PlanId;
  firstName: string;
  lastName: string;
  /** Local Israeli format: 0XXXXXXXXX */
  phone: string;
  /** Digits without the leading zero, as Grow stores it. */
  phoneNational: string;
  country: string;
  email: string;
  reminder: boolean;
};

export const PLANS: Record<PlanId, { id: PlanId; days: number; price: number; label: string }> = {
  monthly: { id: 'monthly', days: 30, price: 18, label: 'חודשי' },
  yearly: { id: 'yearly', days: 365, price: 180, label: 'שנתי' },
};

export function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'yearly';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Accepts 9 digits, or 10 digits that start with 0, with optional dashes/spaces. */
export function normalizePhone(value: unknown): { ok: true; national: string; local: string } | { ok: false } {
  const digits = text(value).replace(/[^\d]/g, '');
  if (!digits) return { ok: false };
  const withoutPrefix = digits.startsWith('0') ? digits.slice(1) : digits;
  if (withoutPrefix.length !== 9) return { ok: false };
  if (!withoutPrefix.startsWith('5')) return { ok: false };
  return { ok: true, national: withoutPrefix, local: `0${withoutPrefix}` };
}

export type ValidationResult =
  | { ok: true; value: NormalizedCheckout }
  | { ok: false; code: string; message: string };

export function validateCheckout(input: CheckoutInput): ValidationResult {
  const plan = isPlanId(input.plan) ? input.plan : null;
  if (!plan) {
    return { ok: false, code: 'INVALID_PLAN', message: 'צריך לבחור מסלול תשלום.' };
  }
  const firstName = text(input.firstName);
  if (firstName.length < 2) {
    return { ok: false, code: 'INVALID_FIRST_NAME', message: 'צריך למלא שם פרטי.' };
  }
  const lastName = text(input.lastName);
  if (lastName.length < 2) {
    return { ok: false, code: 'INVALID_LAST_NAME', message: 'צריך למלא שם משפחה.' };
  }
  const phone = normalizePhone(input.phone);
  if (!phone.ok) {
    return {
      ok: false,
      code: 'INVALID_PHONE',
      message: 'מספר הטלפון לא תקין. צריך 9 ספרות בלי הקידומת, למשל 5X-XXX-XXXX.',
    };
  }
  const country = text(input.country);
  if (country.length < 2) {
    return { ok: false, code: 'INVALID_COUNTRY', message: 'צריך למלא מדינה.' };
  }
  const email = text(input.email);
  if (!EMAIL.test(email)) {
    return { ok: false, code: 'INVALID_EMAIL', message: 'כתובת הדוא״ל לא תקינה.' };
  }
  if (input.terms !== true) {
    return {
      ok: false,
      code: 'TERMS_NOT_ACCEPTED',
      message: 'צריך לאשר את תנאי הרכישה ומדיניות הביטול כדי להמשיך.',
    };
  }
  return {
    ok: true,
    value: {
      plan,
      firstName,
      lastName,
      phone: phone.local,
      phoneNational: phone.national,
      country,
      email,
      reminder: input.reminder === true,
    },
  };
}

/**
 * Grow's hosted payment page link, one per plan.
 * Set GROW_PAYMENT_URL_MONTHLY and GROW_PAYMENT_URL_YEARLY in the site
 * environment. Never hard-code a link in the repository.
 */
export function paymentUrlFor(plan: PlanId, env: Record<string, string | undefined>): string | null {
  const key = plan === 'monthly' ? 'GROW_PAYMENT_URL_MONTHLY' : 'GROW_PAYMENT_URL_YEARLY';
  const url = env[key]?.trim();
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}

export function buildPaymentRedirect(
  value: NormalizedCheckout,
  env: Record<string, string | undefined>
): string | null {
  const base = paymentUrlFor(value.plan, env);
  if (!base) return null;
  const url = new URL(base);
  // Grow pre-fills what it can; the plan price is fixed server-side.
  url.searchParams.set('sum', String(PLANS[value.plan].price));
  url.searchParams.set('description', `גישה לאזור המורים — ${PLANS[value.plan].days} יום`);
  url.searchParams.set('fullName', `${value.firstName} ${value.lastName}`);
  url.searchParams.set('phone', value.phoneNational);
  url.searchParams.set('email', value.email);
  url.searchParams.set('country', value.country);
  return url.toString();
}
