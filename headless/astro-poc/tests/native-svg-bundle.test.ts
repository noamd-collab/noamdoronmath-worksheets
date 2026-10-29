import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'node:test';
import { createNativeSvgResponder } from '../src/lib/nativeSvgResponse';
import { matchesRoute, narrowNativeRoutes, projectRoot, readBundledNativeSvg, sha256, staticNoamRules } from '../scripts/bundle-native-svg.mjs';

const descriptor = JSON.parse(readFileSync(new URL('../src/generated/native-svg-bundles.json', import.meta.url), 'utf8'));
const repoNative = new URL('../../../noam-ai/native/', import.meta.url);

it('every repo-root native SVG is served from a grade bundle with the same bytes', () => {
  const files = Object.keys(descriptor.files);
  assert.equal(files.length, 4011);
  assert.deepEqual(Object.keys(descriptor.bundles).sort(), ['G7', 'G8', 'G9']);
  let bytes = 0;
  for (const rel of files) {
    const disk = readFileSync(new URL(rel, repoNative));
    const bundled = readBundledNativeSvg(join(projectRoot, 'public/noam-ai/native', rel));
    assert.equal(bundled, disk.toString('utf8'), rel);
    assert.equal(createHash('sha256').update(disk).digest('hex'), sha256(disk), rel);
    bytes += disk.length;
  }
  assert.equal(bytes, 20673246);
  for (const spec of Object.values(descriptor.bundles) as { bundlePath: string; bundleSha256: string; bundleBytes: number }[]) {
    const file = readFileSync(new URL('../public' + spec.bundlePath, import.meta.url));
    assert.equal(file.length, spec.bundleBytes);
    assert.equal(sha256(file), spec.bundleSha256);
  }
});

it('public no longer stores one file per figure, and the unused favicon pngs are gone', () => {
  function count(dir: string): number {
    let n = 0;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) n += count(path);
      else n++;
    }
    return n;
  }
  const publicDir = join(projectRoot, 'public');
  const native = join(publicDir, 'noam-ai/native');
  let svg = 0;
  const stack = [native];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) stack.push(path);
      else if (name.endsWith('.svg')) svg++;
    }
  }
  assert.equal(svg, 0);
  const total = count(publicDir);
  assert.ok(total < 4000, `public has ${total} files`);
  assert.equal(existsSync(join(publicDir, 'favicon-16.png')), false);
  assert.equal(existsSync(join(publicDir, 'favicon-32.png')), false);
  assert.equal(existsSync(join(publicDir, 'favicon-48.png')), false);
});

it('the figure route returns the original SVG and rejects other paths', async () => {
  const asset = 'G8-T15/a/figures/q2a.svg';
  const expected = readFileSync(new URL(asset, repoNative));
  const respond = createNativeSvgResponder(descriptor, async (url) => {
    assert.equal(String(url), `https://www.noamdoronmath.co.il${descriptor.bundles.G8.bundlePath}`);
    return new Response(readFileSync(new URL('../public' + descriptor.bundles.G8.bundlePath, import.meta.url)));
  });
  const ok = await respond(asset, 'https://www.noamdoronmath.co.il/noam-ai/native/' + asset);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Content-Type'), 'image/svg+xml; charset=utf-8');
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), expected);
  for (const bad of ['../a.svg', 'G8-T15/a/noam-ai.json', 'G8-T15/a/figures/missing.svg', 'G8-T15/a/figures/q2a.svg/']) {
    assert.equal((await respond(bad, 'https://www.noamdoronmath.co.il/')).status, 404, bad);
  }
});

it('route narrowing keeps JSON and bundles static and lets figure URLs reach the server', () => {
  const original = { version: 1, include: ['/*'], exclude: ['/_astro/*', '/noam-ai/*', '/fonts/*', '/teachers/*'] };
  const routes = narrowNativeRoutes(original);
  assert.deepEqual(routes.include, original.include);
  assert.ok(routes.exclude.includes('/fonts/*'));
  assert.ok(routes.exclude.includes('/teachers/*'));
  assert.equal(routes.exclude.includes('/noam-ai/*'), false);
  for (const rule of staticNoamRules) assert.ok(routes.exclude.includes(rule), rule);
  const figure = '/noam-ai/native/G8-T15/a/figures/q2a.svg';
  const json = '/noam-ai/native/G8-T15/a/noam-ai.json';
  assert.equal(routes.exclude.some((rule: string) => matchesRoute(rule, figure)), false);
  assert.equal(routes.exclude.some((rule: string) => matchesRoute(rule, json)), true);
  assert.equal(routes.exclude.some((rule: string) => matchesRoute(rule, '/noam-ai/manifests/abc.json')), true);
  assert.equal(routes.exclude.some((rule: string) => matchesRoute(rule, descriptor.bundles.G7.bundlePath)), true);
  assert.ok(routes.include.length + routes.exclude.length <= 100);
});
