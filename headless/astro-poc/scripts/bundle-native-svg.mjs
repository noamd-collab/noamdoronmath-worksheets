/**
 * Pack public/noam-ai/native figure SVGs into three grade bundles.
 * The browser still requests /noam-ai/native/.../figures/*.svg.
 * A server route reads the bundle and returns the original bytes.
 *
 *   node scripts/bundle-native-svg.mjs generate
 *   node scripts/bundle-native-svg.mjs finalize
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const repoNative = fileURLToPath(new URL('../../../noam-ai/native/', import.meta.url));
const publicNative = join(projectRoot, 'public/noam-ai/native');
const publicNoam = join(projectRoot, 'public/noam-ai');
export const descriptorPath = join(projectRoot, 'src/generated/native-svg-bundles.json');

const SVG_REL = /^[A-Za-z0-9_-]+\/[abc]\/figures\/[A-Za-z0-9_-]+\.svg$/;
export const staticNoamRules = [
  '/noam-ai/manifests/*',
  '/noam-ai/sync-provenance.json',
  '/noam-ai/catalog-migrations.js',
  '/noam-ai/native/*/noam-ai.json',
  '/noam-ai/native-svg/*',
];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function filesBelow(root, relativeDir = '') {
  if (!existsSync(join(root, relativeDir))) return [];
  const files = [];
  for (const entry of await readdir(join(root, relativeDir), { withFileTypes: true })) {
    const name = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesBelow(root, name));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

function gradeOf(rel) {
  const grade = rel.slice(0, 2);
  if (grade !== 'G7' && grade !== 'G8' && grade !== 'G9') throw new Error(`Unsupported SVG grade: ${rel}`);
  return grade;
}

async function collectSvg(dir) {
  const entries = {};
  for (const rel of (await filesBelow(dir)).filter((path) => path.endsWith('.svg'))) {
    if (!SVG_REL.test(rel) || rel.split('/').some((part) => part === '.' || part === '..')) {
      throw new Error(`Unsupported SVG path: ${rel}`);
    }
    const bytes = await readFile(join(dir, rel));
    const body = bytes.toString('utf8');
    if (!Buffer.from(body, 'utf8').equals(bytes)) throw new Error(`SVG is not exact UTF-8: ${rel}`);
    entries[rel] = { body, sha256: sha256(bytes), bytes: bytes.length };
  }
  return entries;
}

function bundleFile(grade, entries) {
  const json = Buffer.from(JSON.stringify(entries));
  const decodedSha = sha256(json);
  const gzipBase64 = gzipSync(json, { level: 9 }).toString('base64');
  const payload = {
    version: 1,
    grade,
    count: Object.keys(entries).length,
    sha256: decodedSha,
    gzipBase64,
  };
  const publicBytes = Buffer.from(JSON.stringify(payload));
  const bundleSha256 = sha256(publicBytes);
  return {
    payload,
    publicBytes,
    bundleSha256,
    bundleBytes: publicBytes.length,
    sha256: decodedSha,
    count: payload.count,
  };
}

export async function generateNativeSvg(root = projectRoot) {
  const nativeDir = join(root, 'public/noam-ai/native');
  const fromPublic = await collectSvg(nativeDir);
  const source = Object.keys(fromPublic).length ? fromPublic : await collectSvg(repoNative);
  if (!Object.keys(source).length) throw new Error('No native SVG assets found');
  if (Object.keys(fromPublic).length) {
    const canonical = await collectSvg(repoNative);
    for (const [rel, entry] of Object.entries(source)) {
      if (!canonical[rel] || canonical[rel].sha256 !== entry.sha256) {
        throw new Error(`Public SVG does not match repo source: ${rel}`);
      }
    }
  }
  const byGrade = { G7: {}, G8: {}, G9: {} };
  for (const [rel, entry] of Object.entries(source)) byGrade[gradeOf(rel)][rel] = entry;

  const outDir = join(root, 'public/noam-ai/native-svg');
  await mkdir(outDir, { recursive: true });
  for (const name of await readdir(outDir)) {
    if (/^G[789]\.[a-f0-9]{64}\.json$/.test(name)) await rm(join(outDir, name));
  }

  const bundles = {};
  const files = {};
  for (const grade of ['G7', 'G8', 'G9']) {
    const built = bundleFile(grade, byGrade[grade]);
    const filename = `${grade}.${built.bundleSha256}.json`;
    await writeFile(join(outDir, filename), built.publicBytes);
    const bundlePath = `/noam-ai/native-svg/${filename}`;
    bundles[grade] = {
      bundlePath,
      bundleSha256: built.bundleSha256,
      bundleBytes: built.bundleBytes,
      sha256: built.sha256,
      count: built.count,
    };
    for (const rel of Object.keys(byGrade[grade])) files[rel] = grade;
  }
  const descriptor = { version: 1, bundles, files };
  const descriptorFile = join(root, 'src/generated/native-svg-bundles.json');
  await mkdir(dirname(descriptorFile), { recursive: true });
  await writeFile(descriptorFile, JSON.stringify(descriptor));

  const roundTrip = loadDescriptor(descriptor);
  for (const [rel, entry] of Object.entries(source)) {
    const got = roundTrip(rel);
    if (!got || sha256(Buffer.from(got, 'utf8')) !== entry.sha256 || Buffer.byteLength(got) !== entry.bytes) {
      throw new Error(`Bundle round-trip mismatch: ${rel}`);
    }
  }

  if (nativeDir === publicNative || resolve(nativeDir) === resolve(publicNative)) {
    for (const rel of Object.keys(source)) await rm(join(nativeDir, rel), { force: true });
  }
  return {
    count: Object.keys(source).length,
    grades: Object.fromEntries(Object.entries(bundles).map(([grade, spec]) => [grade, spec.count])),
    bundleBytes: Object.values(bundles).reduce((sum, spec) => sum + spec.bundleBytes, 0),
  };
}

function loadDescriptor(descriptor) {
  const cache = new Map();
  return (rel) => {
    const grade = descriptor.files[rel];
    if (!grade || !Object.hasOwn(descriptor.files, rel)) return undefined;
    let entries = cache.get(grade);
    if (!entries) {
      const spec = descriptor.bundles[grade];
      const file = join(projectRoot, 'public', spec.bundlePath);
      const publicBytes = readFileSync(file);
      if (publicBytes.length !== spec.bundleBytes || sha256(publicBytes) !== spec.bundleSha256) {
        throw new Error(`Native SVG bundle changed: ${spec.bundlePath}`);
      }
      const payload = JSON.parse(publicBytes.toString('utf8'));
      const json = gunzipSync(Buffer.from(payload.gzipBase64, 'base64'));
      if (sha256(json) !== spec.sha256) throw new Error(`Native SVG bundle digest mismatch: ${grade}`);
      entries = JSON.parse(json.toString('utf8'));
      cache.set(grade, entries);
    }
    return Object.hasOwn(entries, rel) ? entries[rel].body : undefined;
  };
}

let bundledReader;
export function readBundledNativeSvg(absPath) {
  const norm = String(absPath).replaceAll('\\', '/');
  const marker = '/noam-ai/native/';
  const at = norm.lastIndexOf(marker);
  if (at < 0 || !norm.endsWith('.svg')) return undefined;
  const rel = norm.slice(at + marker.length);
  if (!SVG_REL.test(rel)) return undefined;
  if (!existsSync(descriptorPath)) return undefined;
  bundledReader ??= loadDescriptor(JSON.parse(readFileSync(descriptorPath, 'utf8')));
  return bundledReader(rel);
}

export function matchesRoute(pattern, path) {
  return new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(path);
}

export function narrowNativeRoutes(routes) {
  if (routes.version !== 1 || !Array.isArray(routes.include) || !Array.isArray(routes.exclude)) {
    throw new Error('Unsupported adapter route configuration');
  }
  const exclude = routes.exclude.filter((path) => !path.startsWith('/noam-ai/'));
  for (const rule of staticNoamRules) if (!exclude.includes(rule)) exclude.push(rule);
  if (routes.include.length + exclude.length > 100) {
    throw new Error(`Too many adapter route rules: ${routes.include.length + exclude.length}`);
  }
  return { ...routes, exclude };
}

async function findRoutesFile(root) {
  const candidates = [
    join(root, 'dist/_routes.json'),
    join(root, 'dist/client/_routes.json'),
  ];
  for (const path of candidates) if (existsSync(path)) return path;
  const dist = join(root, 'dist');
  if (!existsSync(dist)) return undefined;
  for (const name of await readdir(dist, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const nested = join(dist, name.name, '_routes.json');
    if (existsSync(nested)) return nested;
  }
  return undefined;
}

export async function finalizeNativeSvg(root = projectRoot) {
  const routesPath = await findRoutesFile(root);
  if (!routesPath) throw new Error('Built _routes.json was not found. Wix hosting did not emit Cloudflare routes.');
  const original = JSON.parse(await readFile(routesPath, 'utf8'));
  const routes = narrowNativeRoutes(original);
  const descriptor = JSON.parse(await readFile(join(root, 'src/generated/native-svg-bundles.json'), 'utf8'));
  const probe = Object.keys(descriptor.files).find((rel) => rel.startsWith('G7-')) 
    || Object.keys(descriptor.files)[0];
  const figurePath = `/noam-ai/native/${probe}`;
  const jsonPath = figurePath.replace(/\/figures\/[^/]+\.svg$/, '/noam-ai.json');
  if (routes.exclude.some((rule) => matchesRoute(rule, figurePath))) {
    throw new Error(`Native SVG would stay on the static CDN: ${figurePath}`);
  }
  if (!routes.exclude.some((rule) => matchesRoute(rule, jsonPath))) {
    throw new Error(`Native JSON lost its static route: ${jsonPath}`);
  }
  for (const spec of Object.values(descriptor.bundles)) {
    if (!routes.exclude.some((rule) => matchesRoute(rule, spec.bundlePath))) {
      throw new Error(`SVG bundle is not static: ${spec.bundlePath}`);
    }
    const built = join(root, 'dist/client', spec.bundlePath);
    const distFile = existsSync(built) ? built : join(root, 'dist', spec.bundlePath);
    if (!existsSync(distFile)) throw new Error(`Built SVG bundle missing: ${spec.bundlePath}`);
  }
  const publicCount = (await filesBelow(join(root, 'public'))).length;
  const distFiles = await filesBelow(join(root, 'dist'));
  const clientCount = distFiles.filter((path) => !path.startsWith('_worker.js/') && path !== '_worker.js').length;
  const straySvg = distFiles.filter((path) => /noam-ai\/native\/.*\.svg$/.test(path));
  if (straySvg.length) throw new Error(`Built output still has ${straySvg.length} native SVG files`);
  const staticCount = clientCount || publicCount;
  if (staticCount >= 4800) throw new Error(`Static deployment still has ${staticCount} files`);
  await writeFile(routesPath, JSON.stringify(routes, null, 2));
  return { routesPath: relative(root, routesPath), publicCount, clientCount, staticCount, rules: routes.include.length + routes.exclude.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode !== 'generate' && mode !== 'finalize') throw new Error('Usage: bundle-native-svg.mjs generate|finalize');
  console.log(JSON.stringify(await (mode === 'generate' ? generateNativeSvg() : finalizeNativeSvg())));
}
