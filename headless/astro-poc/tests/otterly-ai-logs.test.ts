import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  AI_CRAWLER_TOKENS,
  OTTERLY_LOGS_URL,
  buildOtterlyEvent,
  clientIpForDedup,
  isAiCrawlerUserAgent,
  isOtterlyPageRequest,
  otterlyLogsBody,
  otterlyTimestamp,
  resolveOtterlyRequestUrl,
  safeOtterlyError,
  scheduleOtterlyPageLog,
} from '../src/lib/otterlyAiLogs.ts';

const NOW = new Date('2026-10-22T10:00:00.123Z');

function page(over: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    pathname: '/grade-7',
    search: '',
    requestUrl: 'http://internal.example/grade-7',
    forwardedUrl: 'https://www.noamdoronmath.co.il/grade-7',
    userAgent: 'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)',
    referer: 'https://www.google.com/search?q=math',
    clientIp: '192.0.2.10',
    apiKey: 'test-key',
    now: () => NOW,
    log: () => undefined,
    ...over,
  };
}

describe('Otterly AI crawler matching', () => {
  for (const token of AI_CRAWLER_TOKENS) {
    it(`matches ${token} regardless of case`, () => {
      assert.equal(isAiCrawlerUserAgent(`Mozilla/5.0 (${token}/1.0)`), true);
      assert.equal(isAiCrawlerUserAgent(`prefix ${token.toLowerCase()} suffix`), true);
    });
  }

  it('ignores ordinary browsers and nearby bot names', () => {
    assert.equal(isAiCrawlerUserAgent('Mozilla/5.0 Chrome/120.0.0.0'), false);
    assert.equal(isAiCrawlerUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), false);
    assert.equal(isAiCrawlerUserAgent('GoogleOther'), false);
    assert.equal(isAiCrawlerUserAgent(''), false);
    assert.equal(isAiCrawlerUserAgent(null), false);
  });
});

describe('Otterly payload shape', () => {
  it('builds one event with the required fields and optional dedup fields', () => {
    const event = buildOtterlyEvent({
      requestUrl: 'https://www.noamdoronmath.co.il/grade-7?utm_source=chatgpt.com',
      userAgent: 'GPTBot/1.1',
      timestamp: otterlyTimestamp(NOW),
      referer: 'https://www.google.com/',
      clientIp: '192.0.2.10',
    });
    assert.deepEqual(event, {
      requestUrl: 'https://www.noamdoronmath.co.il/grade-7?utm_source=chatgpt.com',
      userAgent: 'GPTBot/1.1',
      timestamp: '2026-10-22T10:00:00Z',
      referer: 'https://www.google.com/',
      clientIp: '192.0.2.10',
    });
    const body = otterlyLogsBody([event!]);
    const parsed = JSON.parse(body) as unknown[];
    assert.equal(parsed.length, 1);
    assert.ok(new TextEncoder().encode(body).byteLength < 256 * 1024);
  });

  it('omits a relative referer and a non-IP client address', () => {
    const event = buildOtterlyEvent({
      requestUrl: 'https://noamdoronmath.co.il/worksheets',
      userAgent: 'ClaudeBot/1.0',
      timestamp: '2026-10-22T10:00:00Z',
      referer: '/local',
      clientIp: 'unknown',
    });
    assert.deepEqual(Object.keys(event ?? {}), ['requestUrl', 'userAgent', 'timestamp']);
    assert.equal(clientIpForDedup('192.0.2.10, 10.0.0.1'), '192.0.2.10');
    assert.equal(clientIpForDedup('2001:db8::1'), '2001:db8::1');
    assert.equal(clientIpForDedup('999.1.1.1'), undefined);
  });

  it('rejects a relative request URL, an empty batch, and an oversized batch', () => {
    assert.equal(
      buildOtterlyEvent({ requestUrl: '/grade-7', userAgent: 'GPTBot', timestamp: '2026-10-22T10:00:00Z' }),
      null,
    );
    assert.throws(() => otterlyLogsBody([]), /1 to 500/);
    const one = buildOtterlyEvent({
      requestUrl: 'https://www.noamdoronmath.co.il/',
      userAgent: 'GPTBot',
      timestamp: '2026-10-22T10:00:00Z',
    })!;
    assert.throws(() => otterlyLogsBody(Array.from({ length: 501 }, () => one)), /1 to 500/);
  });

  it('uses the public forwarded URL and ignores an internal request URL', () => {
    assert.equal(
      resolveOtterlyRequestUrl({
        requestUrl: 'http://127.0.0.1:4321/grade-7',
        forwardedUrl: 'https://www.noamdoronmath.co.il/grade-7?a=1',
        pathname: '/grade-7',
        search: '?a=1',
      }),
      'https://www.noamdoronmath.co.il/grade-7?a=1',
    );
    assert.equal(
      resolveOtterlyRequestUrl({
        requestUrl: 'http://internal/grade-7',
        forwardedUrl: 'https://www.noamdoronmath.co.il',
        pathname: '/grade-7',
        search: '',
      }),
      'https://www.noamdoronmath.co.il/grade-7',
    );
    assert.equal(
      resolveOtterlyRequestUrl({
        requestUrl: 'http://127.0.0.1/grade-7',
        forwardedUrl: null,
        pathname: '/grade-7',
        search: '',
      }),
      null,
    );
  });
});

describe('Otterly forwarding', () => {
  it('treats HTML routes as pages and skips assets and API calls', () => {
    assert.equal(isOtterlyPageRequest('/grade-7', 'GET', null), true);
    assert.equal(isOtterlyPageRequest('/worksheet-viewer-noam.html', 'HEAD', 'document'), true);
    assert.equal(isOtterlyPageRequest('/_astro/app.js', 'GET', null), false);
    assert.equal(isOtterlyPageRequest('/fonts/a.woff2', 'GET', null), false);
    assert.equal(isOtterlyPageRequest('/favicon.ico', 'GET', 'document'), false);
    assert.equal(isOtterlyPageRequest('/api/noamBotConfig', 'GET', null), false);
    assert.equal(isOtterlyPageRequest('/grade-7', 'POST', 'document'), false);
    assert.equal(isOtterlyPageRequest('/grade-7', 'GET', 'image'), false);
  });

  it('returns before the webhook finishes and sends one event', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const jobs: Array<Promise<unknown>> = [];
    let calls = 0;
    let seenBody = '';
    let seenAuth = '';
    let seenType = '';
    const started = Date.now();
    scheduleOtterlyPageLog(
      page({
        locals: { runtime: { ctx: { waitUntil: (job: Promise<unknown>) => jobs.push(job) } } },
        fetchImpl: async (_url, init) => {
          calls += 1;
          const headers = new Headers(init?.headers);
          seenType = headers.get('content-type') ?? '';
          seenAuth = headers.get('authorization') ?? '';
          seenBody = String(init?.body ?? '');
          await gate;
          return new Response(null, { status: 202 });
        },
      }),
    );
    assert.ok(Date.now() - started < 50);
    assert.equal(jobs.length, 1);
    assert.equal(calls, 1);
    release?.();
    await jobs[0];
    assert.equal(seenType, 'application/json');
    assert.equal(seenAuth, 'Bearer test-key');
    const body = JSON.parse(seenBody) as Array<Record<string, string>>;
    assert.equal(body.length, 1);
    assert.equal(body[0].requestUrl, 'https://www.noamdoronmath.co.il/grade-7');
    assert.equal(body[0].timestamp, '2026-10-22T10:00:00Z');
    assert.equal(body[0].referer, 'https://www.google.com/search?q=math');
    assert.equal(body[0].clientIp, '192.0.2.10');
  });

  it('does not call Otterly for a normal visitor', async () => {
    let calls = 0;
    scheduleOtterlyPageLog(page({ userAgent: 'Mozilla/5.0 Chrome', fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls, 0);
  });

  it('logs a missing key and a failed post without the key or headers', async () => {
    const messages: string[] = [];
    scheduleOtterlyPageLog(page({ apiKey: '', log: (message) => messages.push(message) }));
    scheduleOtterlyPageLog(
      page({
        apiKey: 'super-secret-key',
        log: (message) => messages.push(message),
        fetchImpl: async () => {
          throw new Error('network down super-secret-key Authorization: Bearer super-secret-key');
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(messages.join('\n'), /OTTERLY_API_KEY is not set/);
    assert.match(messages.join('\n'), /\[redacted\]/);
    assert.equal(messages.some((message) => message.includes('super-secret-key')), false);
    assert.equal(messages.some((message) => /authorization/i.test(message)), false);
    assert.match(safeOtterlyError(new Error('oai_live_abc123'), 'oai_live_abc123'), /\[redacted\]/);
  });

  it('hands the promise to waitUntil when the runtime provides it', async () => {
    const jobs: Array<Promise<unknown>> = [];
    let calls = 0;
    scheduleOtterlyPageLog(
      page({
        locals: { runtime: { ctx: { waitUntil: (job: Promise<unknown>) => jobs.push(job) } } },
        fetchImpl: async () => {
          calls += 1;
          return new Response(null, { status: 500 });
        },
        log: () => undefined,
      }),
    );
    assert.equal(jobs.length, 1);
    await jobs[0];
    assert.equal(calls, 1);
  });

  it('wires the middleware without awaiting the webhook', () => {
    const source = readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8');
    const script = readFileSync(new URL('../scripts/otterly-log-sample.ts', import.meta.url), 'utf8');
    assert.match(source, /scheduleOtterlyPageLog\(/);
    assert.equal(source.includes('await scheduleOtterlyPageLog'), false);
    assert.match(source, /OTTERLY_API_KEY/);
    assert.match(script, /process\.env\.OTTERLY_API_KEY/);
    assert.match(script, /console\.log\(String\(status\)\)/);
    assert.equal(script.includes('oai_live_'), false);
    assert.equal(OTTERLY_LOGS_URL, 'https://analytics.otterly.ai/logs');
  });
});
