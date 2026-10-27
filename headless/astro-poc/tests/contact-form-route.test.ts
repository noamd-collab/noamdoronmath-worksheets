/**
 * /api/contact-form route: POST stays dry-run by default and returns only what
 * the client reads; GET no longer exposes the live-submit configuration.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { GET, POST } from '../src/pages/api/contact-form';

const call = (fn: unknown, request?: Request) =>
  (fn as (ctx: { request: Request }) => Promise<Response>)({
    request: request || new Request('http://127.0.0.1/api/contact-form'),
  });

describe('contact form route', () => {
  it('answers GET with 405 and no body', async () => {
    const res = await call(GET);
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'POST');
    assert.equal(await res.text(), '');
  });

  it('POST in dry-run returns ok/mode only, without credential status or site IDs', async () => {
    const res = await call(
      POST,
      new Request('http://127.0.0.1/api/contact-form', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName: 'א', lastName: 'ב', email: 'a@b.co', message: 'שלום', company: '' }),
      }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'dry-run');
    const text = JSON.stringify(body);
    for (const leak of ['liveSubmit', 'credential', 'apiKey', 'siteIds', 'exactAction', 'metaSite']) {
      assert.ok(!text.includes(leak), leak);
    }
  });

  it('the client still reads only ok, mode and error', () => {
    const client = readFileSync('public/nd-contact-form.js', 'utf8');
    assert.doesNotMatch(client, /liveSubmit/);
    assert.ok(client.includes("method: 'POST'"));
  });
});
