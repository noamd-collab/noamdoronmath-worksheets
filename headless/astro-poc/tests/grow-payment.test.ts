/**
 * Grow payment verification: the amount identifies the plan, the signature
 * gates the write, and a duplicate notification must not create a second
 * entitlement.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createReturnToken,
  grantGrowEntitlement,
  normalizeGrowNotification,
  planForAmount,
  resolveStatus,
  revokeGrowEntitlement,
  safeEqual,
  signGrowPayload,
  toAgorot,
  verifyGrowSignature,
  verifyReturnToken,
  type GrowNotification,
} from '../src/lib/growPayment';

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  NOAM_TEACHER_GRANT_SECRET: 'grant-secret',
};

const PAID = {
  transactionId: 'grow-txn-123456',
  status: 'paid',
  sum: '18.00',
  currency: 'ILS',
  payerEmail: 'Buyer@Example.com',
};

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> };

function stubFetch(reply: unknown, status = 200): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('amount and plan', () => {
  it('converts shekels to integer agorot', () => {
    assert.equal(toAgorot('18.00'), 1800);
    assert.equal(toAgorot('180'), 18000);
    assert.equal(toAgorot('1,234.50'), 123450);
    assert.equal(toAgorot('₪ 18'), 1800);
  });

  it('rejects amounts that are not positive numbers', () => {
    assert.equal(toAgorot(''), null);
    assert.equal(toAgorot('abc'), null);
    assert.equal(toAgorot('0'), null);
    assert.equal(toAgorot('-18'), null);
  });

  it('reads agorot directly when the contract says so', () => {
    assert.equal(toAgorot('1800', 'agorot'), 1800);
  });

  it('maps the price to the only two plans', () => {
    assert.deepEqual(planForAmount(1800), { plan: 'monthly', days: 30 });
    assert.deepEqual(planForAmount(18000), { plan: 'yearly', days: 365 });
    assert.equal(planForAmount(500), null);
  });
});

describe('notification normalisation', () => {
  it('accepts a paid monthly notification', () => {
    const parsed = normalizeGrowNotification(PAID);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.plan, 'monthly');
    assert.equal(parsed.value.days, 30);
    assert.equal(parsed.value.amountAgorot, 1800);
    assert.equal(parsed.value.email, 'buyer@example.com');
  });

  it('maps every status word to one of four states', () => {
    assert.equal(resolveStatus('PAID'), 'paid');
    assert.equal(resolveStatus('processing'), 'pending');
    assert.equal(resolveStatus('declined'), 'failed');
    assert.equal(resolveStatus('chargeback'), 'refunded');
    assert.equal(resolveStatus('whatever'), null);
  });

  it('refuses an unknown status instead of granting', () => {
    const parsed = normalizeGrowNotification({ ...PAID, status: 'maybe' });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, 'UNKNOWN_STATUS');
  });

  it('refuses an amount that matches no plan', () => {
    const parsed = normalizeGrowNotification({ ...PAID, sum: '12.50' });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, 'AMOUNT_NOT_A_PLAN');
  });

  it('refuses a payment id that is too short to be a transaction', () => {
    const parsed = normalizeGrowNotification({ ...PAID, transactionId: 'abc' });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, 'INVALID_PAYMENT_ID');
  });

  it('keeps a bad email out of the database instead of failing the payment', () => {
    const parsed = normalizeGrowNotification({ ...PAID, payerEmail: 'not-an-email' });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value.email, null);
  });
});

describe('signature', () => {
  const body = JSON.stringify(PAID);

  it('accepts the exact body Grow signed', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signGrowPayload(body, timestamp, 'ipn-secret');
    const ok = await verifyGrowSignature({ rawBody: body, signature, timestamp, secret: 'ipn-secret' });
    assert.equal(ok, true);
  });

  it('rejects a body that changed by one character', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signGrowPayload(body, timestamp, 'ipn-secret');
    const ok = await verifyGrowSignature({
      rawBody: body.replace('18.00', '1800.00'),
      signature,
      timestamp,
      secret: 'ipn-secret',
    });
    assert.equal(ok, false);
  });

  it('rejects a stale notification, so a captured one cannot be replayed', async () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = await signGrowPayload(body, old, 'ipn-secret');
    const ok = await verifyGrowSignature({ rawBody: body, signature, timestamp: old, secret: 'ipn-secret' });
    assert.equal(ok, false);
  });

  it('rejects a signature made with another secret', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signGrowPayload(body, timestamp, 'other-secret');
    const ok = await verifyGrowSignature({ rawBody: body, signature, timestamp, secret: 'ipn-secret' });
    assert.equal(ok, false);
  });

  it('compares in constant time without accepting prefixes', () => {
    assert.equal(safeEqual('abcdef', 'abcdef'), true);
    assert.equal(safeEqual('abcdef', 'abcde'), false);
    assert.equal(safeEqual('', ''), false);
  });
});

describe('grant', () => {
  const notification: GrowNotification = {
    transactionId: 'grow-txn-123456',
    status: 'paid',
    amountAgorot: 1800,
    plan: 'monthly',
    days: 30,
    email: 'buyer@example.com',
  };

  it('calls the grant RPC with the secret and the server-side plan', async () => {
    const { fetchImpl, calls } = stubFetch({ ok: true, status: 'active', created: true });
    const result = await grantGrowEntitlement({ notification, env: ENV, fetchImpl });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/noam_teacher_access_grant');
    assert.deepEqual(calls[0].body, {
      p_secret: 'grant-secret',
      p_payment_id: 'grow-txn-123456',
      p_email: 'buyer@example.com',
      p_plan: 'monthly',
      p_days: 30,
      p_amount_agorot: 1800,
    });
    assert.equal(calls[0].headers.apikey, 'anon-key');
  });

  it('reports a duplicate instead of pretending a new grant was created', async () => {
    const { fetchImpl } = stubFetch({ ok: true, status: 'active', created: false });
    const result = await grantGrowEntitlement({ notification, env: ENV, fetchImpl });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.alreadyGranted, true);
  });

  it('surfaces a rejection from the RPC', async () => {
    const { fetchImpl } = stubFetch({ ok: false, code: 'AMOUNT_MISMATCH' });
    const result = await grantGrowEntitlement({ notification, env: ENV, fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'AMOUNT_MISMATCH');
  });

  it('fails loudly when the environment is incomplete', async () => {
    const { fetchImpl, calls } = stubFetch({ ok: true });
    const result = await grantGrowEntitlement({ notification, env: { SUPABASE_URL: 'https://x.supabase.co' }, fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'NOT_CONFIGURED');
    assert.equal(calls.length, 0);
  });

  it('turns a provider error into a retryable code', async () => {
    const { fetchImpl } = stubFetch({ message: 'boom' }, 500);
    const result = await grantGrowEntitlement({ notification, env: ENV, fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'RPC_500');
  });

  it('revokes with the refund reason, never a free-text one', async () => {
    const { fetchImpl, calls } = stubFetch({ ok: true });
    const result = await revokeGrowEntitlement({
      paymentId: 'grow-txn-123456',
      reason: 'refunded',
      env: ENV,
      fetchImpl,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls[0].body, {
      p_secret: 'grant-secret',
      p_payment_id: 'grow-txn-123456',
      p_reason: 'refunded',
    });
  });
});

describe('return token', () => {
  it('round-trips a payment id', async () => {
    const token = await createReturnToken('grow-txn-123456', 'ipn-secret');
    const verified = await verifyReturnToken(token, 'ipn-secret');
    assert.equal(verified.ok, true);
    if (verified.ok) assert.equal(verified.paymentId, 'grow-txn-123456');
  });

  it('rejects a token signed with another secret', async () => {
    const token = await createReturnToken('grow-txn-123456', 'other-secret');
    const verified = await verifyReturnToken(token, 'ipn-secret');
    assert.equal(verified.ok, false);
  });

  it('rejects an expired token', async () => {
    const token = await createReturnToken('grow-txn-123456', 'ipn-secret', 60);
    const later = Date.now() + 120_000;
    const verified = await verifyReturnToken(token, 'ipn-secret', later);
    assert.equal(verified.ok, false);
    if (!verified.ok) assert.equal(verified.code, 'EXPIRED');
  });
});
