/**
 * Grow payment verification and IPN handling — contract-first draft.
 *
 * Grow has not yet handed over the merchant API contract (the exact IPN field
 * names, the signature scheme and the approval endpoint). Everything that
 * depends on that contract lives in GROW_CONTRACT below, so onboarding changes
 * one object and one function, not the routes.
 *
 * Assumptions, all marked with `ASSUMPTION` and covered by tests:
 *  - the IPN is a JSON POST carrying the charged sum in shekels;
 *  - it is signed with HMAC-SHA256 over `${timestamp}.${rawBody}` in hex,
 *    carried in a header, with a five-minute replay window;
 *  - the amount alone identifies the plan, because the price is fixed
 *    server-side and never taken from the browser.
 */
import { PLANS, type PlanId } from './checkout';

export type GrowStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export const GROW_CONTRACT = {
  /** ASSUMPTION: header names to be confirmed with Grow at onboarding. */
  signatureHeader: 'x-grow-signature',
  timestampHeader: 'x-grow-timestamp',
  /** ASSUMPTION: IPN body field names. */
  fields: {
    transactionId: 'transactionId',
    status: 'status',
    amount: 'sum',
    currency: 'currency',
    email: 'payerEmail',
  },
  /** ASSUMPTION: status vocabulary. Anything unmatched is rejected, not granted. */
  statuses: {
    paid: ['paid', 'success', 'approved', 'completed'],
    pending: ['pending', 'processing', '3ds'],
    failed: ['failed', 'error', 'declined'],
    refunded: ['refunded', 'chargeback'],
  },
  /** ASSUMPTION: Grow sends shekels with two decimals, not agorot. */
  amountUnit: 'shekel' as 'shekel' | 'agorot',
  /** Reject notifications whose timestamp is older than this. */
  toleranceSeconds: 300,
} as const;

export type GrowNotification = {
  transactionId: string;
  status: GrowStatus;
  amountAgorot: number;
  plan: PlanId;
  days: number;
  email: string | null;
};

export type ParseResult =
  | { ok: true; value: GrowNotification }
  | { ok: false; code: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** Shekels (or agorot) as sent by the provider, converted to integer agorot. */
export function toAgorot(value: unknown, unit: 'shekel' | 'agorot' = GROW_CONTRACT.amountUnit): number | null {
  const raw = typeof value === 'number' ? String(value) : text(value);
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s₪]/g, '');
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const agorot = unit === 'shekel' ? Math.round(amount * 100) : Math.round(amount);
  return agorot > 0 ? agorot : null;
}

export function resolveStatus(value: unknown): GrowStatus | null {
  const needle = text(value).toLowerCase();
  if (!needle) return null;
  for (const [status, words] of Object.entries(GROW_CONTRACT.statuses)) {
    if ((words as readonly string[]).includes(needle)) return status as GrowStatus;
  }
  return null;
}

/** The price is the plan identity: the browser never sends an amount. */
export function planForAmount(amountAgorot: number): { plan: PlanId; days: number } | null {
  for (const plan of Object.values(PLANS)) {
    if (Math.round(plan.price * 100) === amountAgorot) {
      return { plan: plan.id, days: plan.days };
    }
  }
  return null;
}

export function normalizeGrowNotification(
  payload: unknown,
  contract: typeof GROW_CONTRACT = GROW_CONTRACT
): ParseResult {
  const body = asRecord(payload);
  if (!body) return { ok: false, code: 'INVALID_BODY' };
  const transactionId = text(body[contract.fields.transactionId]);
  if (transactionId.length < 6 || transactionId.length > 128) {
    return { ok: false, code: 'INVALID_PAYMENT_ID' };
  }
  const status = resolveStatus(body[contract.fields.status]);
  if (!status) return { ok: false, code: 'UNKNOWN_STATUS' };
  const amountAgorot = toAgorot(body[contract.fields.amount], contract.amountUnit);
  if (amountAgorot === null) return { ok: false, code: 'INVALID_AMOUNT' };
  const plan = planForAmount(amountAgorot);
  if (!plan) return { ok: false, code: 'AMOUNT_NOT_A_PLAN' };
  const emailRaw = text(body[contract.fields.email]);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw) ? emailRaw.toLowerCase() : null;
  return {
    ok: true,
    value: { transactionId, status, amountAgorot, plan: plan.plan, days: plan.days, email },
  };
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time compare, so a wrong signature leaks no timing information. */
export function safeEqual(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left.length !== right.length || left.length === 0) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(signature);
}

export async function signGrowPayload(rawBody: string, timestamp: string, secret: string): Promise<string> {
  return hmacHex(secret, `${timestamp}.${rawBody}`);
}

export async function verifyGrowSignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: number;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const { rawBody, signature, timestamp, secret } = input;
  if (!signature || !timestamp || !secret) return false;
  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  const tolerance = input.toleranceSeconds ?? GROW_CONTRACT.toleranceSeconds;
  if (Math.abs(nowSeconds - sent) > tolerance) return false;
  const expected = await signGrowPayload(rawBody, timestamp, secret);
  return safeEqual(expected, signature.trim());
}

/* ------------------------------------------------------------------ *
 * Return token: what we append to the success URL Grow sends the buyer
 * back to. It only proves we created the link; it grants nothing.
 * ------------------------------------------------------------------ */

function base64url(value: string): string {
  const bytes = encoder.encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export async function createReturnToken(
  paymentId: string,
  secret: string,
  ttlSeconds = 60 * 60 * 24
): Promise<string> {
  const payload = base64url(JSON.stringify({ p: paymentId, e: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const signature = await hmacHex(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifyReturnToken(
  token: string,
  secret: string,
  now = Date.now()
): Promise<{ ok: true; paymentId: string } | { ok: false; code: string }> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return { ok: false, code: 'MALFORMED' };
  const expected = await hmacHex(secret, payload);
  if (!safeEqual(expected, signature)) return { ok: false, code: 'BAD_SIGNATURE' };
  const decoded = fromBase64url(payload);
  if (!decoded) return { ok: false, code: 'MALFORMED' };
  try {
    const parsed = JSON.parse(decoded) as { p?: unknown; e?: unknown };
    if (typeof parsed.p !== 'string' || typeof parsed.e !== 'number') return { ok: false, code: 'MALFORMED' };
    if (parsed.e * 1000 < now) return { ok: false, code: 'EXPIRED' };
    return { ok: true, paymentId: parsed.p };
  } catch {
    return { ok: false, code: 'MALFORMED' };
  }
}

/* ------------------------------------------------------------------ *
 * Server-side writes. The browser never calls these.
 * ------------------------------------------------------------------ */

type Env = Record<string, string | undefined>;

export type GrantResult =
  | { ok: true; status: string; alreadyGranted: boolean }
  | { ok: false; code: string };

export function supabaseConfig(env: Env): { url: string; key: string; secret: string } | null {
  const url = (env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || '';
  const secret = env.NOAM_TEACHER_GRANT_SECRET || '';
  if (!url || !key || !secret) return null;
  return { url, key, secret };
}

async function callRpc(
  env: Env,
  fn: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch
): Promise<{ ok: true; data: unknown } | { ok: false; code: string }> {
  const config = supabaseConfig(env);
  if (!config) return { ok: false, code: 'NOT_CONFIGURED' };
  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        'cache-control': 'no-store',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { ok: false, code: `RPC_${response.status}` };
    return { ok: true, data: await response.json().catch(() => null) };
  } catch {
    return { ok: false, code: 'RPC_UNREACHABLE' };
  }
}

export async function grantGrowEntitlement(input: {
  notification: GrowNotification;
  env: Env;
  fetchImpl?: typeof fetch;
}): Promise<GrantResult> {
  const { notification, env } = input;
  const fetchImpl = input.fetchImpl ?? fetch;
  const config = supabaseConfig(env);
  if (!config) return { ok: false, code: 'NOT_CONFIGURED' };
  const result = await callRpc(
    env,
    'noam_teacher_access_grant',
    {
      p_secret: config.secret,
      p_payment_id: notification.transactionId,
      p_email: notification.email,
      p_plan: notification.plan,
      p_days: notification.days,
      p_amount_agorot: notification.amountAgorot,
    },
    fetchImpl
  );
  if (!result.ok) return result;
  const data = asRecord(result.data);
  if (!data) return { ok: false, code: 'EMPTY_RPC_RESULT' };
  if (data.ok === false) return { ok: false, code: String(data.code ?? 'GRANT_REJECTED') };
  return {
    ok: true,
    status: String(data.status ?? 'active'),
    // The RPC answers {granted, duplicate, expiresAt}: a retried payment id
    // returns the existing row with granted=false, duplicate=true.
    alreadyGranted: data.duplicate === true || data.granted === false,
  };
}

export async function revokeGrowEntitlement(input: {
  paymentId: string;
  reason: 'refunded' | 'cancelled';
  env: Env;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const config = supabaseConfig(input.env);
  if (!config) return { ok: false, code: 'NOT_CONFIGURED' };
  const result = await callRpc(
    input.env,
    'noam_teacher_access_revoke',
    { p_secret: config.secret, p_payment_id: input.paymentId, p_reason: input.reason },
    input.fetchImpl ?? fetch
  );
  return result.ok ? { ok: true } : result;
}
