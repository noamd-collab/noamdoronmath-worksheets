import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createNativeSvgResponder, resolveNativeSvgPublicOrigin } from '../src/lib/nativeSvgResponse';
import { collectNativeSvg, generateNativeSvg, finalizeNativeSvg, filesBelow, matchesRoute, narrowNativeRoutes, baselineRoutesFromManifest, removeBundledSvgAssetRegistrations, projectRoot, sha256 } from '../scripts/bundle-native-svg.mjs';

const originalRoutes = { version: 1, include: ['/*'], exclude: ['/_astro/*', '/noam-ai/*', '/fonts/*', '/_wix/pages.json'] };

test('all native SVG endpoint responses retain the exact tracked bytes and hash', async () => {
  const generated = await generateNativeSvg();
  const entries = await collectNativeSvg();
  const { GET } = await import('../src/pages/noam-ai/native/[...asset]');
  const descriptor = JSON.parse(await readFile(join(projectRoot, 'src/generated/native-svg-bundle.json'), 'utf8'));
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async (url, options) => {
    fetches++;
    assert.equal(String(url), `https://www.noamdoronmath.co.il${descriptor.bundlePath}`);
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.credentials, 'omit');
    return new Response(await readFile(join(projectRoot, 'public', descriptor.bundlePath)));
  };
  try {
  assert.equal(generated.count, Object.keys(entries).length);
  for (const [asset, entry] of Object.entries(entries) as [string, { body: string; bytes: number; sha256: string }][]) {
    const response = await GET({ params: { asset }, request: new Request('https://www.noamdoronmath.co.il/noam-ai/native/' + asset) } as any);
    assert.equal(response.status, 200, asset);
    assert.equal(response.headers.get('Content-Type'), 'image/svg+xml; charset=utf-8');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, entry.bytes, asset);
    assert.equal(sha256(bytes), entry.sha256, asset);
    assert.deepEqual(bytes, await readFile(join(projectRoot, 'public/noam-ai/native', asset)), asset);
  }
  assert.equal(fetches, 1);
  console.log(`Verified ${generated.count} endpoint bodies / ${generated.sourceBytes} exact source bytes / one same-origin static fetch`);
  } finally { globalThis.fetch = originalFetch; }
});

test('unknown, traversal, encoded, and non-SVG keys return 404; UTF-8 BOM and CRLF survive', async () => {
  const body = '\uFEFF<svg>עברית\r\n</svg>';
  const asset = 'G9-T40/a/figures/a.svg';
  const json = JSON.stringify({ [asset]: { body, bytes: Buffer.byteLength(body), sha256: sha256(body) } });
  const publicBytes = Buffer.from(JSON.stringify({ gzipBase64: gzipSync(json).toString('base64') }));
  const bundleSha256 = sha256(publicBytes);
  const descriptor = { bundlePath: `/noam-ai/native-svg-bundle.${bundleSha256}.json`, bundleSha256, bundleBytes: publicBytes.length, sha256: sha256(json) };
  const respond = createNativeSvgResponder(descriptor, async () => new Response(publicBytes));
  assert.deepEqual(Buffer.from(await (await respond(asset, 'https://www.noamdoronmath.co.il/')).arrayBuffer()), Buffer.from(body));
  for (const invalid of [undefined, '', '__proto__', 'constructor', '../a.svg', '/G9-T40/a/figures/a.svg', 'G9-T40/a/../figures/a.svg', 'G9-T40/a/%2e%2e/a.svg', 'G9-T40/a/figures/missing.svg', 'G9-T40/a/noam-ai.json', 'G9-T40/a/figures/a.svg/', 'G9-T40/a/figures/a.svg?x=1', 'G9-T40/a/figures/a.svg%00', 'G9-T40\\a\\figures\\a.svg']) {
    assert.equal((await respond(invalid, 'https://www.noamdoronmath.co.il/')).status, 404, invalid);
  }
});

test('adapter narrowing retains unrelated rules and keeps manifests/native JSON static', () => {
  const result = narrowNativeRoutes(originalRoutes);
  assert.deepEqual(result.include, originalRoutes.include);
  assert.deepEqual(result.exclude.filter((rule: string) => !rule.startsWith('/noam-ai/')), originalRoutes.exclude.filter((rule) => !rule.startsWith('/noam-ai/')));
  for (const path of ['/noam-ai/native/G9-T40/a/noam-ai.json', '/noam-ai/native/G7-ASSESS1/c/noam-ai.json', '/noam-ai/manifests/123.json', '/noam-ai/sync-provenance.json']) {
    assert.ok(result.exclude.some((rule: string) => matchesRoute(rule, path)), path);
  }
  assert.ok(!result.exclude.some((rule: string) => matchesRoute(rule, '/noam-ai/native/G9-T40/a/figures/fig1.svg')));
  assert.deepEqual(narrowNativeRoutes({ ...originalRoutes, exclude: ['/_astro/*', '/noam-ai/native/G9-T40/a/figures/fig1.svg', '/noam-ai/manifests/*', '/fonts/*', '/_wix/pages.json'] }), result);
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'native-svg-build-test-'));
  const source = join(root, 'public/noam-ai/native/G9-T40/a/figures');
  await mkdir(source, { recursive: true });
  await writeFile(join(source, 'fig1.svg'), '<svg>\r\nשלום</svg>');
  await generateNativeSvg(root);
  await mkdir(join(root, 'dist/noam-ai/native/G9-T40/a/figures'), { recursive: true });
  await copyFile(join(source, 'fig1.svg'), join(root, 'dist/noam-ai/native/G9-T40/a/figures/fig1.svg'));
  await writeFile(join(root, 'dist/noam-ai/native/G9-T40/a/noam-ai.json'), '{"unchanged":true}');
  await writeFile(join(root, 'dist/keep.txt'), 'keep exact bytes\r\n');
  const endpoint = { routeData: { route: '/noam-ai/native/[...asset]', type: 'endpoint', prerender: false, segments: [[{ content: 'noam-ai', dynamic: false }], [{ content: 'native', dynamic: false }], [{ content: '...asset', dynamic: true, spread: true }]] } };
  const manifest = { base: '/', routes: [endpoint], assets: ['/noam-ai/native/G9-T40/a/figures/fig1.svg', '/noam-ai/native/G9-T40/a/noam-ai.json', '/keep.txt'], renderers: [], entryModules: {}, adapterName: 'test', hrefRoot: 'file:///tmp/native-svg-test/' };
  const baseline = await baselineRoutesFromManifest(manifest, root);
  await writeFile(join(root, 'dist/_routes.json'), JSON.stringify(baseline));
  await mkdir(join(root, 'dist/_worker.js'), { recursive: true });
  await writeFile(join(root, 'dist/_worker.js/manifest_test.mjs'), `function deserializeManifest(value) { value.assets = new Set(value.assets); value.routes[0].routeData.pattern = new RegExp('^/noam-ai/native/(.+)$'); return value; }\nconst manifest = deserializeManifest(${JSON.stringify(manifest)});\nexport { manifest };`);
  const bundle = JSON.parse(await readFile(join(root, 'src/generated/native-svg-bundle.json'), 'utf8'));
  await copyFile(join(root, 'public', bundle.bundlePath), join(root, 'dist', bundle.bundlePath));
  await writeFile(join(root, 'dist/_worker.js/native.mjs'), `export default ${JSON.stringify(bundle)};`);
  return root;
}

test('postbuild removes only exact bundled copies, preserves every other byte, and stays below the static limit', async () => {
  const root = await fixture();
  try {
    const before = new Map(await Promise.all((await filesBelow(join(root, 'dist'))).map(async (path: string) => [path, sha256(await readFile(join(root, 'dist', path)))])));
    const result = await finalizeNativeSvg(root);
    assert.equal(result.removedSvg, 1);
    assert.ok(result.staticCount < 5000);
    const after = await filesBelow(join(root, 'dist'));
    assert.deepEqual(after, [...before.keys()].filter((path) => !path.endsWith('.svg')));
    for (const path of after.filter((path: string) => path !== '_routes.json' && path !== '_worker.js/manifest_test.mjs')) assert.equal(sha256(await readFile(join(root, 'dist', path))), before.get(path));
    assert.equal(await readFile(join(root, 'public/noam-ai/native/G9-T40/a/figures/fig1.svg'), 'utf8'), '<svg>\r\nשלום</svg>');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('stale source, altered built SVG, or stale worker fails before any pruning', async () => {
  for (const mutation of ['source', 'built', 'worker']) {
    const root = await fixture();
    try {
      const path = mutation === 'worker' ? 'dist/_worker.js/native.mjs' : `${mutation === 'source' ? 'public' : 'dist'}/noam-ai/native/G9-T40/a/figures/fig1.svg`;
      await writeFile(join(root, path), 'changed');
      const original = await readFile(join(root, 'dist/_routes.json'));
      await assert.rejects(finalizeNativeSvg(root), /changed|absent/);
      assert.ok((await filesBelow(join(root, 'dist'))).some((file: string) => file.endsWith('.svg')));
      assert.deepEqual(await readFile(join(root, 'dist/_routes.json')), original);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test('installed adapter baseline avoids native SVG rule truncation without losing unrelated static routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-svg-route-limit-'));
  try {
    await mkdir(join(root, 'public/noam-ai/native/G9-T40/a/figures'), { recursive: true });
    for (let i = 0; i < 120; i++) await writeFile(join(root, `public/noam-ai/native/G9-T40/a/figures/fig${i}.svg`), '<svg/>');
    await mkdir(join(root, 'public/z-static'), { recursive: true });
    await writeFile(join(root, 'public/z-static/keep.txt'), 'keep');
    const manifest = { base: '/', routes: [{ routeData: { route: '/noam-ai/native/[...asset]', type: 'endpoint', prerender: false, segments: [[{ content: 'noam-ai', dynamic: false }], [{ content: 'native', dynamic: false }], [{ content: '...asset', dynamic: true, spread: true }]] } }] };
    const baseline = await baselineRoutesFromManifest(manifest, root);
    const routes = narrowNativeRoutes(baseline);
    assert.ok(routes.exclude.some((rule: string) => matchesRoute(rule, '/z-static/keep.txt')));
    assert.ok(routes.exclude.some((rule: string) => matchesRoute(rule, '/noam-ai/native/G9-T40/a/noam-ai.json')));
    for (let i = 0; i < 120; i++) assert.ok(!routes.exclude.some((rule: string) => matchesRoute(rule, `/noam-ai/native/G9-T40/a/figures/fig${i}.svg`)));
    assert.ok(routes.include.length + routes.exclude.length < 100);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('bundle load shares one promise, fails closed on HTTP/digest errors, and retries only on a later request', async () => {
  const asset = 'G9-T40/a/figures/a.svg';
  const body = '<svg/>';
  const json = JSON.stringify({ [asset]: { body, sha256: sha256(body), bytes: Buffer.byteLength(body) } });
  const bytes = Buffer.from(JSON.stringify({ gzipBase64: gzipSync(json).toString('base64') }));
  const digest = sha256(bytes);
  const descriptor = { bundlePath: `/noam-ai/native-svg-bundle.${digest}.json`, bundleSha256: digest, bundleBytes: bytes.length, sha256: sha256(json) };
  let calls = 0;
  const respond = createNativeSvgResponder(descriptor, async (url, options) => {
    calls++;
    assert.equal(String(url), `https://www.noamdoronmath.co.il${descriptor.bundlePath}`);
    assert.equal(options?.redirect, 'error');
    await Promise.resolve();
    return calls === 1 ? new Response(null, { status: 503 }) : new Response(bytes);
  });
  const first = await Promise.all([respond(asset, 'https://www.noamdoronmath.co.il/path?evil=https://elsewhere.test'), respond(asset, 'https://www.noamdoronmath.co.il/path')]);
  assert.equal(calls, 1);
  for (const response of first) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('X-Noam-Native-Svg-Error'), 'bundle-unavailable');
    assert.equal(response.headers.get('X-Noam-Native-Svg-Phase'), 'http');
    assert.equal(response.headers.get('X-Noam-Native-Svg-Upstream'), '503');
    assert.equal(response.headers.get('X-Noam-Native-Svg-Assets'), 'absent');
    assert.equal(await response.text(), '');
  }
  const retried = await Promise.all([respond(asset, 'https://www.noamdoronmath.co.il/path'), respond(asset, 'https://www.noamdoronmath.co.il/path')]);
  assert.equal(calls, 2);
  assert.ok(retried.every((response) => response.status === 200));
  const tampered = Buffer.from(bytes); tampered[10] ^= 1;
  for (const [data, expected] of [[tampered, descriptor], [bytes, { ...descriptor, sha256: '0'.repeat(64) }]] as const) {
    const invalid = createNativeSvgResponder(expected, async () => new Response(data));
    assert.equal((await invalid(asset, 'https://www.noamdoronmath.co.il/path')).status, 503);
  }
  const redirected = createNativeSvgResponder(descriptor, async (_url, options) => {
    assert.equal(options?.redirect, 'error'); throw new TypeError('redirect rejected');
  });
  const failedFetch = await redirected(asset, 'https://www.noamdoronmath.co.il/path', true);
  assert.equal(failedFetch.status, 503);
  assert.equal(failedFetch.headers.get('X-Noam-Native-Svg-Phase'), 'fetch');
  assert.equal(failedFetch.headers.get('X-Noam-Native-Svg-Upstream'), '0');
  assert.equal(failedFetch.headers.get('X-Noam-Native-Svg-Assets'), 'available');
  assert.ok(!JSON.stringify([...failedFetch.headers]).includes('www.noamdoronmath.co.il'));
  assert.throws(() => createNativeSvgResponder({ ...descriptor, bundlePath: 'https://elsewhere.test/file.json' }), /Invalid/);
  const routes = narrowNativeRoutes(originalRoutes, descriptor.bundlePath);
  assert.ok(routes.exclude.includes(descriptor.bundlePath));
  assert.ok(descriptor.bundlePath.length < 100);
  assert.ok(!routes.exclude.some((rule: string) => matchesRoute(rule, '/noam-ai/native-svg-bundle.unlisted.json')));
});

test('generation replaces only obsolete generated bundles and leaves retained public data unchanged', async () => {
  const root = await fixture();
  try {
    const original = JSON.parse(await readFile(join(root, 'src/generated/native-svg-bundle.json'), 'utf8'));
    await writeFile(join(root, 'public/noam-ai/sync-provenance.json'), '{"keep":true}');
    await writeFile(join(root, 'public/noam-ai/native/G9-T40/a/figures/fig1.svg'), '<svg>changed</svg>');
    await generateNativeSvg(root);
    const current = JSON.parse(await readFile(join(root, 'src/generated/native-svg-bundle.json'), 'utf8'));
    assert.notEqual(current.bundlePath, original.bundlePath);
    const bundles = (await filesBelow(join(root, 'public'))).filter((path: string) => path.includes('native-svg-bundle.'));
    assert.deepEqual(bundles, [current.bundlePath.slice(1)]);
    assert.equal(await readFile(join(root, 'public/noam-ai/sync-provenance.json'), 'utf8'), '{"keep":true}');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('only bundled SVG registrations leave Astro assets, allowing the real App.match endpoint', async () => {
  const { App } = await import('astro/app');
  const path = '/noam-ai/native/G7-ASSESS1/a/figures/q14_head.svg';
  const retained = ['/noam-ai/native/G7-ASSESS1/a/noam-ai.json', '/noam-ai/manifests/a.json', '/other.svg'];
  const routeData = { route: '/noam-ai/native/[...asset]', type: 'endpoint', pattern: /^\/noam-ai\/native\/(.+)$/, prerender: false };
  const manifest = { base: '/', routes: [{ routeData }], assets: new Set([path, ...retained]), renderers: [], entryModules: {}, adapterName: 'test', hrefRoot: 'file:///tmp/native-svg-test/' };
  const request = new Request('https://www.noamdoronmath.co.il' + path);
  assert.equal(new App(manifest as any).match(request), undefined);
  const serialized = { assets: [path, ...retained], unrelated: { keep: 'exact bytes' } };
  const source = `const manifest = deserializeManifest(${JSON.stringify(serialized)});\nexport { manifest };\n`;
  const patched = removeBundledSvgAssetRegistrations(source, [path.slice(1)]);
  assert.equal(patched.removed, 1);
  assert.deepEqual(patched.assets, retained);
  assert.equal(patched.source, source.replace(JSON.stringify(serialized.assets), JSON.stringify(retained)));
  const next = { ...manifest, assets: new Set(patched.assets) };
  assert.equal(new App(next as any).match(request)?.route, routeData.route);
  assert.equal(next.assets.has(path), false, 'Cloudflare early static-asset branch also bypassed');
  for (const asset of retained) assert.equal(next.assets.has(asset), true);
  assert.throws(() => removeBundledSvgAssetRegistrations(source, ['noam-ai/native/missing.svg']), /inventory mismatch/);
  assert.throws(() => removeBundledSvgAssetRegistrations('unknown serialization', [path.slice(1)]), /Unsupported/);
});

test('Wix edge public URL corrects internal HTTP without allowing arbitrary fetch hosts', async () => {
  const production = 'https://www.noamdoronmath.co.il';
  const preview = 'https://abcdef-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
  assert.equal(resolveNativeSvgPublicOrigin('http://internal.invalid/path', preview + '/path?ignored=1'), preview);
  assert.equal(resolveNativeSvgPublicOrigin('http://internal.invalid/path', production + '/path'), production);
  assert.equal(resolveNativeSvgPublicOrigin('https://noamdoronmath.co.il/path'), 'https://noamdoronmath.co.il');
  for (const rejected of ['http://www.noamdoronmath.co.il/path', 'https://www.noamdoronmath.co.il:444/path', 'https://user:pass@www.noamdoronmath.co.il/path', 'https://www.noamdoronmath.co.il.evil.test/path', 'https://evil.test/path', 'https://abcdef-other-site.wix-site-host.com/path', 'https://preview.wix-site-host.com/path', 'https://abcdef-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com.evil.test/path', '/relative', 'data:text/plain,test', 'https://127.0.0.1/path']) {
    assert.equal(resolveNativeSvgPublicOrigin('http://internal.invalid/path', rejected), undefined, rejected);
  }
  assert.equal(resolveNativeSvgPublicOrigin(production + '/path', 'https://evil.test'), production);
  const asset = 'G9-T40/a/figures/a.svg';
  const json = JSON.stringify({ [asset]: { body: '<svg/>', sha256: sha256('<svg/>'), bytes: 6 } });
  const bytes = Buffer.from(JSON.stringify({ gzipBase64: gzipSync(json).toString('base64') }));
  const digest = sha256(bytes);
  const descriptor = { bundlePath: `/noam-ai/native-svg-bundle.${digest}.json`, bundleSha256: digest, bundleBytes: bytes.length, sha256: sha256(json) };
  let calls = 0;
  const respond = createNativeSvgResponder(descriptor, async (url, options) => {
    calls++;
    assert.equal(String(url), preview + descriptor.bundlePath);
    assert.equal(options?.redirect, 'error');
    return new Response(bytes);
  });
  const bad = await respond(asset, 'http://internal.invalid/path', false, 'https://evil.test/path');
  assert.equal(bad.status, 503);
  assert.equal(bad.headers.get('X-Noam-Native-Svg-Phase'), 'origin');
  assert.equal(calls, 0);
  const good = await respond(asset, 'http://internal.invalid/path', false, preview + '/original-path?unrelated=1');
  assert.equal(good.status, 200);
  assert.equal(await good.text(), '<svg/>');
  assert.equal(calls, 1);
});
