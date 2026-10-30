import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLiveArchiveSnapshotReader, fetchLiveArchiveCardIndex } from '../scripts/lib/blog-archive-ssr.mjs';

const html = '<main data-blog-archive="blog-index"><section data-blog-archive-list><article data-blog-archive-card><h2><a data-blog-archive-card-link href="/post/example">כותרת בדיקה</a></h2></article></section></main>';
const success = () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });

test('one run shares the identical live snapshot across concurrent and sequential assertions, separately per path', async () => {
  const requests: string[] = [];
  const reader = createLiveArchiveSnapshotReader({ fetchImpl: async (url: string, options: RequestInit) => {
    requests.push(url);
    assert.equal((options.headers as Record<string, string>)['user-agent'], 'Mozilla/5.0 (compatible; m26-ssr-gate)');
    assert.ok(options.signal instanceof AbortSignal);
    return success();
  } });
  const [first, second] = await Promise.all([reader('/blog'), reader('/blog')]);
  assert.strictEqual(first, second);
  assert.strictEqual(await reader('/blog'), first);
  assert.equal(first.count, 1);
  assert.equal(requests.length, 1);
  await reader('/blog/categories/elementary-math');
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith('/blog/categories/elementary-math'));
});

test('a failed snapshot stays failed for every assertion without another GET or fixture fallback', async () => {
  let requests = 0;
  const reader = createLiveArchiveSnapshotReader({ fetchImpl: async () => {
    requests++;
    return new Response('rate-limited', { status: 429 });
  } });
  const first = reader('/blog');
  const second = reader('/blog');
  assert.strictEqual(second, first);
  const results = await Promise.allSettled([first, second]);
  assert.ok(results.every(result => result.status === 'rejected'));
  await assert.rejects(reader('/blog'), /HTTP 429.*no further retry/);
  assert.equal(requests, 1);
});

test('429 waits for server-directed Retry-After seconds or HTTP date before its single allowed retry', async () => {
  const now = Date.parse('Fri, 30 Oct 2026 12:00:00 GMT');
  for (const retryAfter of ['2', 'Fri, 30 Oct 2026 12:00:02 GMT']) {
    const events: string[] = [];
    const live = await fetchLiveArchiveCardIndex('/blog', {
      now: () => now,
      fetchImpl: async () => {
        events.push('GET');
        return events.length === 1
          ? new Response('rate-limited', { status: 429, headers: { 'retry-after': retryAfter } })
          : success();
      },
      sleep: async (ms: number) => { events.push(`wait:${ms}`); },
    });
    assert.deepEqual(events, ['GET', 'wait:2000', 'GET']);
    assert.equal(live.http.attempt, 2);
  }
});

test('missing, invalid, zero, past or excessive Retry-After never causes an immediate or early retry', async () => {
  for (const retryAfter of [null, 'not-a-delay-private-value', '0', '-1', '1.5', '31', 'Fri, 30 Oct 2026 11:59:00 GMT', '999999999999999999999999999']) {
    let requests = 0;
    let sleeps = 0;
    await assert.rejects(fetchLiveArchiveCardIndex('/blog', {
      now: () => Date.parse('Fri, 30 Oct 2026 12:00:00 GMT'),
      fetchImpl: async () => {
        requests++;
        return new Response('private error body', { status: 429, headers: retryAfter === null ? {} : { 'retry-after': retryAfter } });
      },
      sleep: async () => { sleeps++; },
    }), (error: Error & { http?: { status: number } }) => {
      assert.match(error.message, /HTTP 429.*no further retry/);
      assert.doesNotMatch(error.message, /private/);
      assert.equal(error.http?.status, 429);
      return true;
    });
    assert.equal(requests, 1, String(retryAfter));
    assert.equal(sleeps, 0, String(retryAfter));
  }
});

test('persistent 429 is capped at two requests even if a caller asks for more attempts', async () => {
  let requests = 0;
  let sleeps = 0;
  await assert.rejects(fetchLiveArchiveCardIndex('/blog', {
    attempts: 10,
    fetchImpl: async () => {
      requests++;
      return new Response('rate-limited', { status: 429, headers: { 'retry-after': '1' } });
    },
    sleep: async (ms: number) => { assert.equal(ms, 1000); sleeps++; },
  }), /HTTP 429.*"attempt":2/);
  assert.equal(requests, 2);
  assert.equal(sleeps, 1);
});

test('network, non-429 HTTP, non-HTML and empty archive failures are never retried or accepted', async () => {
  const cases: Array<[() => Promise<Response>, RegExp]> = [
    [async () => { throw new Error('network unavailable'); }, /network unavailable/],
    [async () => new Response('unavailable', { status: 503, headers: { 'retry-after': '1' } }), /HTTP 503/],
    [async () => new Response('{}', { headers: { 'content-type': 'application/json' } }), /content-type/],
    [async () => new Response(new Uint8Array([1])), /content-type/],
    [async () => new Response('<section data-blog-archive-list></section>', { headers: { 'content-type': 'text/html' } }), /Parsed 0 SSR cards/],
  ];
  for (const [respond, message] of cases) {
    let requests = 0;
    await assert.rejects(fetchLiveArchiveCardIndex('/blog', {
      fetchImpl: async () => { requests++; return respond(); },
      sleep: async () => { assert.fail('must not retry'); },
    }), message);
    assert.equal(requests, 1);
  }
});


test('snapshot reads pace distinct paths and retain a refusal for the rest of the run', async () => {
  let now = 10000;
  const events: string[] = [];
  const reader = createLiveArchiveSnapshotReader({
    minIntervalMs: 5000,
    now: () => now,
    sleep: async (ms: number) => { events.push(`wait:${ms}`); now += ms; },
    fetchImpl: async (url: string) => { events.push(url); return success(); },
  });
  await Promise.all([reader('/blog'), reader('/blog/categories/elementary-math')]);
  assert.equal(events.length, 3);
  assert.equal(events[1], 'wait:5000');
  assert.ok(events[0].endsWith('/blog'));
  assert.ok(events[2].endsWith('/elementary-math'));
  let requests = 0;
  const refused = createLiveArchiveSnapshotReader({ fetchImpl: async () => {
    requests++;
    return new Response('rate limited', { status: 429 });
  } });
  await assert.rejects(refused('/blog'), /HTTP 429/);
  await assert.rejects(refused('/blog/categories/elementary-math'), /HTTP 429/);
  assert.equal(requests, 1);
});
