/**
 * M35 — OAuth redirect / return-origin / guest-merge unit tests.
 * Does not perform real Google login.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { createRequire as cr } from 'node:module';

const require = createRequire(import.meta.url);
const Auth = require('../public/noam-learning-auth-redirect.js');
const Core = require('../public/noam-learning-core.js');

describe('M35 learning auth same-origin callback', () => {
  it('same-origin redirectTo uses current origin learning.html (PKCE-safe)', () => {
    const r = Auth.resolveAuthRedirectTo(
      { authCallbackMode: 'same-origin', authAllowedOrigins: [] },
      'https://pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/learning.html?signin=google'
    );
    assert.equal(r.ok, true);
    assert.equal(
      r.redirectTo,
      'https://pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/learning.html'
    );
  });

  it('rejects wildcard allowlists', () => {
    const r = Auth.resolveAuthRedirectTo(
      {
        authCallbackMode: 'same-origin',
        authAllowedOrigins: ['https://*.wix-site-host.com'],
      },
      'https://pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/learning.html'
    );
    assert.equal(r.ok, false);
    assert.equal(r.error, 'WILDCARD_ORIGIN_FORBIDDEN');
  });

  it('rejects return origin mismatch vs expected Headless origin', () => {
    const loc =
      'https://pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/learning.html';
    const bad = Auth.validateReturnOrigin(
      { authCallbackMode: 'same-origin' },
      'https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html?code=abc',
      loc
    );
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'RETURN_ORIGIN_MISMATCH');
    const good = Auth.validateReturnOrigin(
      { authCallbackMode: 'same-origin' },
      'https://pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/learning.html?code=abc',
      loc
    );
    assert.equal(good.ok, true);
  });

  it('fixed mode requires exact authFixedOrigin (no wildcard)', () => {
    const bad = Auth.resolveAuthRedirectTo(
      { authCallbackMode: 'fixed', authFixedOrigin: 'https://*.example.com' },
      'https://pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/x'
    );
    assert.equal(bad.ok, false);
    const good = Auth.resolveAuthRedirectTo(
      {
        authCallbackMode: 'fixed',
        authFixedOrigin: 'https://example-headless.example',
        authAllowedOrigins: ['https://example-headless.example'],
      },
      'https://pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/x'
    );
    assert.equal(good.ok, true);
    assert.equal(good.redirectTo, 'https://example-headless.example/learning.html');
  });

  it('config declares same-origin mode; learning.js no longer hardcodes GitHub redirectTo', () => {
    const cfg = readFileSync('public/noam-learning-config.js', 'utf8');
    assert.match(cfg, /authCallbackMode:\s*'same-origin'/);
    const js = readFileSync('public/noam-learning.js', 'utf8');
    assert.ok(js.includes('resolveAuthRedirectTo'));
    assert.ok(!js.includes("redirectTo:base+'learning.html'"));
    assert.ok(existsSync('public/noam-learning-auth-redirect.js'));
  });

  it('guest progress merge fills missing account rows without overwrite', async () => {
    const mem = {
      data: {
        'noam-learning-guest-v1': JSON.stringify({
          a: { status: 'started', updated_at: '2026-01-01T00:00:00.000Z' },
          b: { status: 'completed', updated_at: '2026-01-02T00:00:00.000Z' },
        }),
      },
      getItem(k) {
        return this.data[k] || null;
      },
      setItem(k, v) {
        this.data[k] = String(v);
      },
      removeItem(k) {
        delete this.data[k];
      },
    };
    const cloudRows = {
      b: { worksheet_id: 'b', status: 'review', updated_at: '2026-01-03T00:00:00.000Z' },
    };
    const upserted = [];
    const client = {
      from() {
        const api = {
          select() {
            return api;
          },
          eq() {
            return api;
          },
          limit() {
            return Promise.resolve({
              data: Object.values(cloudRows),
              error: null,
            });
          },
          upsert(rows, opts) {
            upserted.push({ rows, opts });
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: rows[0], error: null });
                  },
                };
              },
              then(resolve) {
                resolve({ data: null, error: null });
              },
            };
          },
          delete() {
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
        return api;
      },
    };
    const engine = Core.create({
      catalog: [
        { id: 'a', title: 'A', g: 7, t: 1, l: 'one', label: 'א' },
        { id: 'b', title: 'B', g: 7, t: 2, l: 'one', label: 'ב' },
      ],
      storage: mem,
      client,
    });
    await engine.setUser({ id: 'user-1', email: 't@example.com' });
    // After setUser refresh, cloud has b only
    assert.equal(engine.snapshot().cloudReady, true);
    assert.ok(engine.snapshot().rows.b);
    assert.equal(engine.snapshot().guestCount, 2);
    await engine.importGuest();
    // Only missing guest row `a` should upsert; `b` already in cloud → not overwritten
    assert.ok(upserted.length >= 1);
    const last = upserted[upserted.length - 1];
    assert.equal(last.opts.ignoreDuplicates, true);
    const ids = last.rows.map((r) => r.worksheet_id);
    assert.ok(ids.includes('a'));
    assert.ok(!ids.includes('b'));
  });
});
