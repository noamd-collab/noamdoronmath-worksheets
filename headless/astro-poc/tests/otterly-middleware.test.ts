import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

it('the merged middleware emits exactly one Otterly event per crawler page request', async () => {
  const mocks: Record<string, string> = {
    'astro:middleware': 'export const defineMiddleware = (handler) => handler;',
    'astro:env/server': 'export const OTTERLY_API_KEY = "test-key";',
    './lib/wixMedia': 'export const redirectTargetForSiteUgdPath = () => null;',
    './lib/redirects': 'export const resolveRedirect = () => null;',
    './lib/publicHtmlShells': 'export const PUBLIC_HTML_SHELLS = {"/viewer.html": "<html>viewer</html>"};',
  };
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/middleware.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    plugins: [{
      name: 'middleware-dependencies',
      setup(plugin) {
        plugin.onResolve({ filter: /.*/ }, (args) =>
          args.path in mocks ? { path: args.path, namespace: 'test-mock' } : undefined);
        plugin.onLoad({ filter: /.*/, namespace: 'test-mock' }, (args) => ({
          contents: mocks[args.path], loader: 'js',
        }));
      },
    }],
  });
  const { onRequest } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const originalFetch = globalThis.fetch;
  const posts: Array<{ url: string; events: Array<{ requestUrl: string }> }> = [];
  globalThis.fetch = async (url, init) => {
    posts.push({ url: String(url), events: JSON.parse(String(init?.body)) });
    return new Response(null, { status: 202 });
  };
  try {
    for (const path of ['/grade-7', '/viewer.html?worksheet=1']) {
      const jobs: Array<Promise<unknown>> = [];
      const url = new URL(path, 'https://www.noamdoronmath.co.il');
      const request = new Request(url, { headers: { 'user-agent': 'Perplexity-User/1.0' } });
      const before = posts.length;
      const response = await onRequest({
        request, url, locals: { runtime: { ctx: { waitUntil: (job: Promise<unknown>) => jobs.push(job) } } },
      }, async () => new Response('page'));
      await Promise.all(jobs);
      assert.equal(response.status, 200);
      assert.equal(jobs.length, 1);
      assert.equal(posts.length - before, 1, 'only the full implementation may send a webhook');
      assert.equal(posts.at(-1)?.url, 'https://analytics.otterly.ai/logs');
      assert.deepEqual(posts.at(-1)?.events.map((event) => event.requestUrl), [url.href]);
    }
    for (const [path, userAgent] of [['/grade-7', 'Mozilla/5.0 Chrome'], ['/_astro/app.js', 'GPTBot']]) {
      const url = new URL(path, 'https://www.noamdoronmath.co.il');
      const before = posts.length;
      await onRequest({ request: new Request(url, { headers: { 'user-agent': userAgent } }), url, locals: {} },
        async () => new Response('page'));
      assert.equal(posts.length, before, 'ordinary visitors and assets must not create events');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
