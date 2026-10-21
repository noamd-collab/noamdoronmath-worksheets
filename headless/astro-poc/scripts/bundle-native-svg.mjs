import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile, unlink, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const prefix = 'noam-ai/native/';
export const staticNoamRules = [
  '/noam-ai/manifests/*',
  '/noam-ai/sync-provenance.json',
  '/noam-ai/native/*/noam-ai.json',
];
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function filesBelow(root, relative = '') {
  const files = [];
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesBelow(root, name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unsupported non-regular asset: ${name}`);
  }
  return files.sort();
}

export async function collectNativeSvg(root = projectRoot) {
  const sourceDir = join(root, 'public', prefix);
  const entries = {};
  for (const path of (await filesBelow(sourceDir)).filter((path) => path.endsWith('.svg'))) {
    if (!/^[A-Za-z0-9_-]+\/[abc]\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.svg$/.test(path)
      || path.split('/').some((part) => part === '.' || part === '..')) {
      throw new Error(`Unsupported SVG path: ${path}`);
    }
    const bytes = await readFile(join(sourceDir, path));
    const body = bytes.toString('utf8');
    if (!Buffer.from(body, 'utf8').equals(bytes)) throw new Error(`SVG is not exact UTF-8: ${path}`);
    entries[path] = { body, sha256: sha256(bytes), bytes: bytes.length };
  }
  if (!Object.keys(entries).length) throw new Error('No native SVG assets found');
  return entries;
}

export async function generateNativeSvg(root = projectRoot) {
  const entries = await collectNativeSvg(root);
  const json = Buffer.from(JSON.stringify(entries));
  const bundle = {
    version: 1,
    count: Object.keys(entries).length,
    sourceBytes: Object.values(entries).reduce((sum, entry) => sum + entry.bytes, 0),
    sha256: sha256(json),
    gzipBase64: gzipSync(json, { level: 9 }).toString('base64'),
  };
  const publicBytes = Buffer.from(JSON.stringify(bundle) + '\n');
  const bundleSha256 = sha256(publicBytes);
  const bundlePath = `/noam-ai/native-svg-bundle.${bundleSha256}.json`;
  const publicDirectory = join(root, 'public/noam-ai');
  // Only our ignored generated artifacts may be replaced; originals stay put.
  for (const name of await readdir(publicDirectory)) {
    if (/^native-svg-bundle\.[a-f0-9]{64}\.json$/.test(name) && name !== bundlePath.split('/').at(-1)) await unlink(join(publicDirectory, name));
  }
  await writeFile(join(root, 'public', bundlePath), publicBytes);
  const descriptor = { version: 1, count: bundle.count, sourceBytes: bundle.sourceBytes, sha256: bundle.sha256, bundlePath, bundleSha256, bundleBytes: publicBytes.length };
  const path = join(root, 'src/generated/native-svg-bundle.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(descriptor) + '\n');
  return { count: bundle.count, sourceBytes: bundle.sourceBytes, compressedBytes: Buffer.from(bundle.gzipBase64, 'base64').length, sha256: bundle.sha256 };
}

// Cloudflare _routes.json '*' spans any number of path segments, including '/'.
export function matchesRoute(pattern, path) {
  return new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(path);
}

export function narrowNativeRoutes(routes, bundlePath) {
  if (routes.version !== 1 || !Array.isArray(routes.include) || !Array.isArray(routes.exclude)) {
    throw new Error('Unsupported adapter route configuration');
  }
  // The adapter may emit /noam-ai/* or detailed native exclusions once this
  // endpoint exists. Replace that subtree only; preserve every other rule.
  const exclude = routes.exclude.filter((path) => !path.startsWith('/noam-ai/'));
  exclude.push(...staticNoamRules);
  if (bundlePath) {
    if (!/^\/noam-ai\/native-svg-bundle\.[a-f0-9]{64}\.json$/.test(bundlePath)) throw new Error('Invalid static SVG bundle path');
    exclude.push(bundlePath);
  }
  if (routes.include.length + exclude.length > 100) throw new Error('Too many adapter route rules');
  return { ...routes, exclude };
}

// The Cloudflare adapter truncates its auto-generated exclusions at 99 rules.
// Our new endpoint makes it enumerate thousands of SVG files, so narrowing the
// truncated file would silently lose unrelated static rules. Run the installed
// adapter's same generator with only this endpoint omitted, then narrow noam-ai.
export async function baselineRoutesFromManifest(manifest, root) {
  const { createRoutesFile } = await import(new URL('./utils/generate-routes-json.js', import.meta.resolve('@astrojs/cloudflare')));
  const temporary = await mkdtemp(join(tmpdir(), 'native-svg-routes-'));
  try {
    const routes = manifest.routes
      .filter(({ routeData }) => routeData.route !== '/noam-ai/native/[...asset]')
      .map(({ routeData }) => ({ ...routeData, isPrerendered: routeData.prerender }));
    await createRoutesFile({
      base: manifest.base,
      publicDir: pathToFileURL(join(root, 'public') + '/'),
      outDir: pathToFileURL(temporary + '/'),
      build: { assets: '_astro' },
    }, console, routes, [], []);
    return JSON.parse(await readFile(join(temporary, '_routes.json'), 'utf8'));
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

// Astro App.match and the Cloudflare handler both consult manifest.assets
// before matching an endpoint. Pruned SVG copies must leave this Set as well.
// Replace only the serialized assets array; preserve all other manifest bytes.
export function removeBundledSvgAssetRegistrations(source, svgPaths) {
  const declarations = [...source.matchAll(/const manifest = deserializeManifest\((\{[^\n]+\})\);/g)];
  if (declarations.length !== 1) throw new Error('Unsupported built Astro manifest serialization');
  const serialized = JSON.parse(declarations[0][1]);
  if (!Array.isArray(serialized.assets)) throw new Error('Built Astro manifest has no assets array');
  const remove = new Set(svgPaths.map((path) => '/' + path));
  if (remove.size !== svgPaths.length || [...remove].some((path) => !path.startsWith('/noam-ai/native/') || !path.endsWith('.svg'))) throw new Error('Invalid SVG asset registration removal set');
  const removed = serialized.assets.filter((path) => remove.has(path));
  if (removed.length !== remove.size || new Set(removed).size !== remove.size) throw new Error('Built Astro SVG asset registration inventory mismatch');
  const assets = serialized.assets.filter((path) => !remove.has(path));
  const oldToken = '"assets":' + JSON.stringify(serialized.assets);
  const newToken = '"assets":' + JSON.stringify(assets);
  if (source.split(oldToken).length !== 2) throw new Error('Ambiguous built Astro asset array');
  return { source: source.replace(oldToken, newToken), assets, removed: removed.length };
}

export async function finalizeNativeSvg(root = projectRoot) {
  const dist = join(root, 'dist');
  const descriptor = JSON.parse(await readFile(join(root, 'src/generated/native-svg-bundle.json'), 'utf8'));
  if (!/^\/noam-ai\/native-svg-bundle\.[a-f0-9]{64}\.json$/.test(descriptor.bundlePath)) throw new Error('Invalid static SVG bundle path');
  const publicBytes = await readFile(join(root, 'public', descriptor.bundlePath));
  if (publicBytes.length !== descriptor.bundleBytes || sha256(publicBytes) !== descriptor.bundleSha256) throw new Error('Static SVG bundle changed');
  const builtBytes = await readFile(join(dist, descriptor.bundlePath));
  if (!builtBytes.equals(publicBytes)) throw new Error('Built static SVG bundle changed');
  const bundle = JSON.parse(publicBytes);
  const json = gunzipSync(Buffer.from(bundle.gzipBase64, 'base64'));
  if (sha256(json) !== bundle.sha256 || bundle.sha256 !== descriptor.sha256) throw new Error('Generated SVG bundle hash mismatch');
  const entries = JSON.parse(json);
  const current = await collectNativeSvg(root);
  if (JSON.stringify(current) !== json.toString('utf8')) throw new Error('SVG sources changed after generation');
  const files = await filesBelow(dist);
  const svgPaths = Object.keys(entries).map((path) => prefix + path);
  const svgSet = new Set(svgPaths);
  const actualSvgPaths = files.filter((path) => path.startsWith(prefix) && path.endsWith('.svg'));
  if (JSON.stringify(actualSvgPaths) !== JSON.stringify([...svgPaths].sort())) throw new Error('Built SVG inventory mismatch');
  // Require this exact static bundle binding in the worker; no payload is embedded.
  let embedded = false;
  for (const path of files.filter((path) => path.startsWith('_worker.js/') && /\.[cm]?js$/.test(path))) {
    const code = await readFile(join(dist, path), 'utf8');
    if (code.includes(descriptor.bundlePath) && code.includes(descriptor.bundleSha256) && code.includes(descriptor.sha256)) { embedded = true; break; }
  }
  if (!embedded) throw new Error('Exact SVG bundle absent from built worker');
  const manifestFiles = files.filter((path) => /^_worker\.js\/manifest_[^/]+\.mjs$/.test(path));
  if (manifestFiles.length !== 1) throw new Error('Expected one built Astro manifest');
  const { manifest } = await import(pathToFileURL(join(dist, manifestFiles[0])).href);
  if (!manifest.routes.some(({ routeData }) => routeData.route === '/noam-ai/native/[...asset]' && routeData.prerender === false)) {
    throw new Error('Native SVG server endpoint absent from built Astro manifest');
  }
  const manifestPath = join(dist, manifestFiles[0]);
  const registration = removeBundledSvgAssetRegistrations(await readFile(manifestPath, 'utf8'), svgPaths);
  const remainingAssets = new Set(registration.assets);
  const { App } = await import('astro/app');
  const app = new App({ ...manifest, assets: remainingAssets });
  for (const path of svgPaths) {
    if (remainingAssets.has('/' + path) || app.match(new Request('https://native-svg-build.invalid/' + path))?.route !== '/noam-ai/native/[...asset]') throw new Error(`Pruned SVG still blocked before endpoint: ${path}`);
  }
  const originalRoutes = JSON.parse(await readFile(join(dist, '_routes.json'), 'utf8'));
  const routes = narrowNativeRoutes(await baselineRoutesFromManifest(manifest, root), descriptor.bundlePath);
  // Preserve any adapter/custom rule outside our subtree. A future adapter or
  // configuration change must fail visibly rather than lose an exclusion.
  for (const rule of originalRoutes.exclude.filter((rule) => !rule.startsWith('/noam-ai/'))) {
    if (!routes.exclude.includes(rule)) throw new Error(`Unrelated route exclusion changed: ${rule}`);
  }
  if (JSON.stringify(routes.include) !== JSON.stringify(originalRoutes.include)) throw new Error('Unrelated route includes changed');
  const excluded = (path) => routes.exclude.some((rule) => matchesRoute(rule, '/' + path));
  for (const path of svgPaths) {
    const bytes = await readFile(join(dist, path));
    if (sha256(bytes) !== entries[path.slice(prefix.length)].sha256) throw new Error(`Built SVG changed: ${path}`);
    if (excluded(path) || !routes.include.some((rule) => matchesRoute(rule, '/' + path))) throw new Error(`SVG does not reach server: ${path}`);
  }
  for (const path of files.filter((path) => path.startsWith('noam-ai/') && !svgSet.has(path))) {
    if (!excluded(path)) throw new Error(`Retained noam-ai asset lost static route: ${path}`);
  }
  const remaining = files.filter((path) => !svgSet.has(path));
  const staticCount = remaining.filter((path) => !path.startsWith('_worker.js/')).length;
  if (staticCount >= 5000) throw new Error(`Static deployment still has ${staticCount} files`);
  // All checks precede mutation. Only these verified SVG copies and _routes.json
  // plus the exact SVG manifest.assets entries are touched; originals stay put.
  for (const path of svgPaths) await unlink(join(dist, path));
  await writeFile(manifestPath, registration.source);
  await writeFile(join(dist, '_routes.json'), JSON.stringify(routes, null, 2));
  return { removedSvg: svgPaths.length, removedAssetRegistrations: registration.removed, staticCount, sourceBytes: bundle.sourceBytes, bundleSha256: bundle.sha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode !== 'generate' && mode !== 'finalize') throw new Error('Usage: bundle-native-svg.mjs generate|finalize');
  console.log(JSON.stringify(await (mode === 'generate' ? generateNativeSvg() : finalizeNativeSvg())));
}
