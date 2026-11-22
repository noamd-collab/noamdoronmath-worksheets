import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createContext, runInContext } from 'node:vm';

const excellence = { exercises: [{ id: 'G7-T15-E-Q01א' }] };
const standard = { exercises: [{ id: 'G7-T15-B-Q01א' }] };
const viewers = [
  ['Headless', '../public/worksheet-viewer-noam.html'],
  ['portable', '../../../worksheet-viewer-noam.html'],
];
type ManifestRequest = (url: string, options: RequestInit) => Promise<Response>;

function openViewer(t: TestContext, source: string, fetchResponse: ManifestRequest) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requests: string[] = [];
  const effects: string[] = [];
  const classes = new Set(['hidden']);
  const context = createContext({
    location: { search: '?g=7&x=G7-T15&lv=c&topic=21' },
    MANIFEST_PATH: 'excellence.json', aiReady: true, editionRequested: false,
    manifest: null, manifestReady: false, g: 7, x: 'G7-T15', lv: 'c', LEVEL: { b: 'B', c: 'E' },
    editionId: 'example', pdf: '1'.repeat(32),
    fab: { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } },
    renderManifestPins() { effects.push('pins'); },
    NoamCuratedHints: {
      async prefetch() { effects.push('hints'); },
      async validateViewerBinding() { effects.push('validate'); return false; },
    },
    noamPdfEngineReady: Promise.resolve(),
    async ensurePdfDocumentForCrop() { return { getData: async () => new Uint8Array([1]) }; },
    fetch(url: string, options: RequestInit) { requests.push(url); return fetchResponse(url, options); },
    setTimeout, clearTimeout, AbortController, TypeError, SyntaxError, console: { warn() {} },
  });
  context.window = context;
  const start = source.indexOf('var noamManifestLoadVersion=');
  const end = source.indexOf('/* Resolve pins', start);
  assert.ok(start >= 0 && end > start, 'extract the actual runtime loader');
  runInContext(source.slice(start, end), context);
  async function advance(ms: number) {
    await setImmediate();
    t.mock.timers.tick(ms);
    await setImmediate();
  }
  return { context, requests, effects, classes, advance };
}

for (const [name, path] of viewers) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');

  test(name + ' recovers initial transport failure followed by HTTP 503 on the same first open', async t => {
    let attempt = 0;
    const view = openViewer(t, source, async () => {
      attempt++;
      if (attempt === 1) throw new TypeError('Failed to fetch');
      if (attempt === 2) return new Response(null, { status: 503 });
      return Response.json(excellence);
    });
    const pending = view.context.loadStaticManifest();
    await view.advance(299);
    assert.equal(view.requests.length, 1);
    await view.advance(1);
    assert.equal(view.requests.length, 2);
    await view.advance(899);
    assert.equal(view.requests.length, 2);
    await view.advance(1);
    assert.deepEqual(await pending, excellence);
    assert.deepEqual(view.requests, Array(3).fill('excellence.json'));
    assert.equal(view.context.manifestReady, true);
    assert.equal(view.classes.has('hidden'), false);
    assert.deepEqual(view.effects, ['pins', 'hints']);
  });

  test(name + ' aborts a stalled manifest body and recovers on its next request', async t => {
    let firstSignal: AbortSignal | null | undefined;
    const view = openViewer(t, source, async (_url, options) => {
      if (firstSignal) return Response.json(excellence);
      firstSignal = options.signal;
      const body = new ReadableStream({
        start(controller) {
          firstSignal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
        },
      });
      return new Response(body);
    });
    const pending = view.context.loadStaticManifest();
    await view.advance(14_999);
    assert.equal(firstSignal?.aborted, false);
    await view.advance(1);
    assert.equal(firstSignal?.aborted, true);
    await view.advance(300);
    assert.deepEqual(await pending, excellence);
    assert.equal(view.requests.length, 2);
    assert.deepEqual(view.effects, ['pins', 'hints']);
  });

  test(name + ' stops after three transient failures without exposing unbound hints', async t => {
    const view = openViewer(t, source, async () => new Response(null, { status: 503 }));
    const pending = view.context.loadStaticManifest();
    await view.advance(300);
    await view.advance(900);
    await view.advance(60_000);
    assert.equal(await pending, null);
    assert.equal(view.requests.length, 3);
    assert.equal(view.context.manifestReady, false);
    assert.equal(view.classes.has('hidden'), true);
    assert.deepEqual(view.effects, []);
  });

  for (const error of ['404', 'invalid JSON', 'binding mismatch']) {
    test(name + ' leaves ' + error + ' closed after one request', async t => {
      const view = openViewer(t, source, async () => {
        if (error === '404') return new Response(null, { status: 404 });
        if (error === 'invalid JSON') return new Response('{');
        return Response.json({ ...excellence, editionId: 'example' });
      });
      const pending = view.context.loadStaticManifest();
      await view.advance(300);
      await view.advance(900);
      assert.equal(await pending, null);
      assert.equal(view.requests.length, 1);
      assert.equal(view.context.manifest, null);
      assert.equal(view.context.manifestReady, false);
      assert.equal(view.classes.has('hidden'), true);
      assert.deepEqual(view.effects, error === 'binding mismatch' ? ['validate'] : []);
    });
  }

  test(name + ' never retries or clears a newer level after being superseded during backoff', async t => {
    const view = openViewer(t, source, async url => {
      if (url === 'excellence.json') throw new TypeError('connection reset');
      return Response.json(standard);
    });
    const older = view.context.loadStaticManifest();
    await view.advance(299);
    view.context.location.search = '?g=7&x=G7-T15&lv=b&topic=21';
    view.context.lv = 'b';
    view.context.MANIFEST_PATH = 'standard.json';
    assert.deepEqual(await view.context.loadStaticManifest(), standard);
    await view.advance(1);
    await view.advance(900);
    assert.equal(await older, null);
    assert.deepEqual(view.requests, ['excellence.json', 'standard.json']);
    assert.deepEqual(view.context.manifest, standard);
    assert.equal(view.context.manifestReady, true);
    assert.equal(view.classes.has('hidden'), false);
    assert.deepEqual(view.effects, ['pins', 'hints']);
  });
}
