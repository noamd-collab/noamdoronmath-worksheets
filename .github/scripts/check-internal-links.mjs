/**
 * Crawl a locally served Astro build and fail when an internal URL is broken.
 *
 *   node .github/scripts/check-internal-links.mjs \
 *     --base http://127.0.0.1:4321 \
 *     --pages headless/astro-poc/src/pages
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE_FILE = /\.(astro|ts|tsx|js|mjs)$/;
const SOFT_API_STATUSES = new Set([400, 401, 403, 405, 415]);

export function routesFromPagesDir(pagesDir) {
  const routes = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('_')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === 'api' && dir === pagesDir) continue;
        walk(full);
        continue;
      }
      const rel = relative(pagesDir, full).split(sep).join('/');
      if (rel.split('/').some((part) => part.includes('['))) continue;
      if (!PAGE_FILE.test(rel)) continue;
      let route = rel.replace(PAGE_FILE, '');
      if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
      else if (route === 'index') route = '';
      routes.push(route === '' ? '/' : `/${route}`);
    }
  }
  walk(pagesDir);
  return routes;
}

export function resolveInternal(raw, from, origin) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || text.startsWith('#')) return null;
  if (/[\s<>"'`;(){}]/.test(text)) return null;
  const lower = text.toLowerCase();
  if (
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:')
  ) {
    return null;
  }
  let url;
  try {
    url = new URL(text, from);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.href;
}

export function extractReferences(html) {
  const documentHtml = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const found = [];
  const attr = /\b(?:href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  const srcset = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match;
  while ((match = attr.exec(documentHtml))) found.push(match[1] ?? match[2] ?? match[3] ?? '');
  while ((match = srcset.exec(documentHtml))) {
    const value = match[1] ?? match[2] ?? '';
    for (const part of value.split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url) found.push(url);
    }
  }
  return found;
}

export function isBrokenStatus(url, status) {
  if (status >= 200 && status < 400) return false;
  const path = new URL(url).pathname;
  if (path === '/api' || path.startsWith('/api/')) return !SOFT_API_STATUSES.has(status);
  return true;
}

export async function checkInternalLinks({
  base,
  seeds,
  maxUrls = 2000,
  concurrency = 6,
  fetchImpl = globalThis.fetch,
  timeoutMs = 20000,
}) {
  const origin = new URL(base).origin;
  const queue = [];
  const seen = new Set();
  const linkedFromDocument = new Set();
  const failures = [];
  let checked = 0;
  let active = 0;
  let capped = false;

  function enqueue(raw, from, fromDocument) {
    const abs = resolveInternal(raw, from || base, origin);
    if (!abs) return;
    if (fromDocument) linkedFromDocument.add(abs);
    if (seen.has(abs)) return;
    if (seen.size >= maxUrls) {
      capped = true;
      return;
    }
    seen.add(abs);
    queue.push(abs);
  }

  for (const seed of seeds) enqueue(seed, base, false);

  async function visit(url) {
    checked += 1;
    let response;
    try {
      response = await fetchImpl(url, {
        redirect: 'follow',
        headers: { accept: 'text/html,application/xhtml+xml,*/*', 'user-agent': 'astro-poc-link-check' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      broken.push({ url, status: 0, error: error instanceof Error ? error.message : 'request failed' });
      return;
    }
    const status = response.status;
    if (isBrokenStatus(url, status)) failures.push({ url, status });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('application/xhtml')) {
      try {
        await response.body?.cancel();
      } catch {
        /* ignore */
      }
      return;
    }
    const html = await response.text();
    const finalUrl = response.url || url;
    for (const ref of extractReferences(html)) enqueue(ref, finalUrl, true);
  }

  await new Promise((resolve) => {
    function pump() {
      while (active < concurrency && queue.length > 0) {
        const url = queue.shift();
        active += 1;
        visit(url)
          .catch((error) => {
            failures.push({ url, status: 0, error: error instanceof Error ? error.message : 'request failed' });
          })
          .finally(() => {
            active -= 1;
            if (queue.length === 0 && active === 0) resolve();
            else pump();
          });
      }
      if (queue.length === 0 && active === 0) resolve();
    }
    if (queue.length === 0) resolve();
    else pump();
  });

  const broken = failures.filter((item) => item.status !== 404 || linkedFromDocument.has(item.url));
  return { checked, broken, capped, discovered: seen.size };
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`missing ${name}`);
  }
  return process.argv[index + 1];
}

async function main() {
  const base = argValue('--base');
  const pages = argValue('--pages');
  const reportPath = process.argv.includes('--report') ? argValue('--report') : '';
  const seeds = [...new Set([...routesFromPagesDir(pages), '/', '/grade-9', '/worksheets?grade=9'])];
  console.log(`link check: ${seeds.length} seed routes on ${base}`);
  const result = await checkInternalLinks({ base, seeds });
  const summary = {
    seeds: seeds.length,
    checked: result.checked,
    discovered: result.discovered,
    broken: result.broken.length,
    capped: result.capped,
    failures: result.broken.slice(0, 50),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (reportPath) writeFileSync(reportPath, JSON.stringify({ ...summary, failures: result.broken }, null, 2));
  if (result.capped) {
    console.error(`link check hit the ${result.discovered} URL cap before finishing`);
    process.exit(1);
  }
  if (result.broken.length > 0) {
    console.error(`broken internal links: ${result.broken.length}`);
    process.exit(1);
  }
  console.log('internal links ok');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'link check failed');
    process.exit(1);
  });
}
