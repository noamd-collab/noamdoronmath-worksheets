import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { deduplicateSeoResponse } from '../src/lib/serverSeo';
import { canonicalUrl, robotsContent } from '../src/lib/siteSeo';

const encoder = new TextEncoder();
const document = (head: string, body = 'תוכן הדף') => `<!doctype html><html lang="he"><head>${head}</head><body>${body}</body></html>`;

function streamedResponse(bytes: Uint8Array, chunkSize = 29, headers: HeadersInit = {}): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
      controller.close();
    },
  }), { headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
}

async function clean(html: string, chunkSize = 29): Promise<string> {
  return deduplicateSeoResponse(streamedResponse(encoder.encode(html), chunkSize)).text();
}

describe('server SEO owns metadata before delivery', () => {
  it('removes only Wix duplicates, including split Hebrew title bytes', async () => {
    const owned = '<title data-noam-seo>מונים בלי לפספס לכיתה א׳</title>' +
      '<meta data-noam-seo name="description" content="תרגול ספירה">' +
      '<link data-noam-seo rel="canonical" href="https://www.noamdoronmath.co.il/counting-grade-1">' +
      '<meta data-noam-seo property="og:title" content="מונים בלי לפספס">';
    const duplicates = '<title wix-seo-tag="true">Counting-grade-1 | נועם דורון מתמטיקה</title>' +
      '<meta content="default" name="description" wix-seo-tag="true">' +
      "<link href='/default' rel='canonical' wix-seo-tag='true'>" +
      '<meta property=og:title content=default wix-seo-tag=true>';
    const retained = '<meta name="google-site-verification" content="keep" wix-seo-tag="true">' +
      '<script src="/analytics.js"></script>';
    for (const chunkSize of [1, 11, 1024]) {
      assert.equal(await clean(document(owned + duplicates + retained), chunkSize), document(owned + retained));
    }
  });

  it('retains preview noindex and the production query canonical', async () => {
    const canonical = canonicalUrl('/worksheets', '?topic=1&grade=1&utm_source=test');
    const robots = robotsContent('preview.wix-site-host.com', { SITE_INDEXABLE: 'true' });
    const authored = `<meta data-noam-seo name="robots" content="${robots}">` +
      `<link data-noam-seo rel="canonical" href="${canonical}">`;
    const output = await clean(document(authored + '<meta wix-seo-tag="true" name="robots" content="index,follow">' +
      '<link wix-seo-tag="true" rel="canonical" href="https://preview.wix-site-host.com/worksheets">'));
    assert.equal(output, document(authored));
    assert.match(output, /noindex,nofollow/);
    assert.match(output, /https:\/\/www\.noamdoronmath\.co\.il\/worksheets\?grade=1&topic=1/);
  });

  it('preserves a split UTF-8 BOM and the exact body boundary', async () => {
    const owned = '<title data-noam-seo>שלום</title>';
    const duplicate = '<title wix-seo-tag="true">default</title>';
    const original = encoder.encode('\uFEFF' + document(owned + duplicate));
    const expected = encoder.encode('\uFEFF' + document(owned));
    for (const chunkSize of [1, 2, 1024]) {
      const result = deduplicateSeoResponse(streamedResponse(original, chunkSize));
      assert.deepEqual(new Uint8Array(await result.arrayBuffer()), expected);
    }
  });

  it('retains article type, authored image dimensions, and unrelated Wix metadata', async () => {
    const owned = '<meta data-noam-seo property="og:type" content="article">' +
      '<meta data-noam-seo property="og:image:width" content="1200">' +
      '<meta data-noam-seo property="og:image:height" content="630">';
    const unique = '<meta wix-seo-tag="true" property="article:published_time" content="2026-11-10">';
    const wix = '<meta wix-seo-tag="true" property="og:type" content="website">' +
      '<meta wix-seo-tag="true" property="og:image:width" content="600">';
    assert.equal(await clean(document(owned + unique + wix)), document(owned + unique));
  });

  it('does not interpret markup in scripts, styles, comments, or body content', async () => {
    const owned = '<title data-noam-seo>Authored &gt; title</title>';
    const untouched = '<!-- <title wix-seo-tag="true">comment</title> </head> -->' +
      '<script type="application/ld+json">{"text":"</head><title wix-seo-tag=\"true\">example</title>"}</script>' +
      '<script>const sample = "</head>";</script>' +
      '<style>.x::after {content:"</head>"}</style>';
    const duplicate = '<title wix-seo-tag="true">default</title>';
    const body = '<pre><title wix-seo-tag="true">body example</title></pre>';
    assert.equal(await clean(document(owned + untouched + duplicate, body), 7), document(owned + untouched, body));
  });

  it('preserves all body bytes and response metadata except stale payload validators', async () => {
    const owned = '<title data-noam-seo>עברית</title>';
    const originalHead = `<html><head>${owned}<title wix-seo-tag="true">Default</title></head>`;
    const expectedHead = `<html><head>${owned}</head>`;
    const body = new Uint8Array([0x3c, 0x62, 0x3e, 0xff, 0xfe, 0x00, 0xd7, 0x90]);
    const all = new Uint8Array(encoder.encode(originalHead).length + body.length);
    all.set(encoder.encode(originalHead)); all.set(body, encoder.encode(originalHead).length);
    const original = streamedResponse(all, 17, {
      'cache-control': 'public, max-age=60', 'etag': 'old', 'content-length': String(all.length),
      'x-custom': 'kept', 'set-cookie': 'session=example; Secure; HttpOnly',
    });
    const result = deduplicateSeoResponse(original);
    const bytes = new Uint8Array(await result.arrayBuffer());
    assert.deepEqual(bytes.slice(encoder.encode(expectedHead).length), body);
    assert.equal(new TextDecoder().decode(bytes.slice(0, encoder.encode(expectedHead).length)), expectedHead);
    assert.equal(result.status, original.status);
    assert.equal(result.headers.get('cache-control'), 'public, max-age=60');
    assert.equal(result.headers.get('x-custom'), 'kept');
    assert.equal(result.headers.get('set-cookie'), original.headers.get('set-cookie'));
    assert.equal(result.headers.has('content-length'), false);
    assert.equal(result.headers.has('etag'), false);
  });

  it('passes foreign, incomplete, and oversized HTML through without truncation', async () => {
    const foreign = document('<title wix-seo-tag="true">Wix owns this page</title>');
    assert.equal(await clean(foreign), foreign);
    const incomplete = '<head><title data-noam-seo>Unfinished';
    assert.equal(await clean(incomplete), incomplete);
    const oversized = document('<title data-noam-seo>Local</title>' + ' '.repeat(262144) + '<title wix-seo-tag="true">Default</title>');
    assert.equal(await clean(oversized, 4096), oversized);
  });

  it('does not consume PDFs, redirects without bodies, or compressed responses', () => {
    for (const input of [
      new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
      Response.redirect('https://example.com', 301),
      new Response('compressed bytes', { headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } }),
    ]) assert.equal(deduplicateSeoResponse(input), input);
  });

  it('propagates cancellation to the source stream', async () => {
    let reason: unknown;
    const source = new ReadableStream<Uint8Array>({ cancel(value) { reason = value; } });
    const result = deduplicateSeoResponse(new Response(source, { headers: { 'content-type': 'text/html' } }));
    await result.body!.cancel('navigation cancelled');
    // pipeThrough propagates cancellation asynchronously to the underlying source.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(reason, 'navigation cancelled');
  });

  it('wires the response transform after downstream middleware and removes client cleanup', () => {
    const middleware = readFileSync('src/middleware.ts', 'utf8');
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.ok(middleware.indexOf('deduplicateSeoResponse(response)') > middleware.indexOf('await next()'));
    assert.match(layout, /<title data-noam-seo>\{resolvedTitle\}<\/title>/);
    assert.doesNotMatch(layout, /stripWixSeoDupes|MutationObserver/);
  });
});
