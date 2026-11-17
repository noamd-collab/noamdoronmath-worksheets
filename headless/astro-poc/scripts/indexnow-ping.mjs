#!/usr/bin/env node
/**
 * SEO-6: IndexNow ping for https://www.noamdoronmath.co.il.
 *
 * IndexNow tells Bing (whose index also feeds ChatGPT search and Copilot),
 * Yandex, Seznam, Naver and the other IndexNow engines which URLs changed, so
 * they recrawl them now instead of waiting for the next crawl.
 *
 * Dry run is the default: the script prints the request it would send and
 * makes no network call. Only --submit sends. --submit first fetches
 * https://www.noamdoronmath.co.il/<key>.txt and stops unless that file is live
 * and contains the key, so the first ping can only happen after a release
 * that serves public/<key>.txt.
 *
 * The key file public/<32 hex>.txt is public by design: IndexNow proves site
 * ownership by fetching it. It is not a secret. To rotate the key, replace the
 * file with a new random one (same rules: the name without .txt is the whole
 * content, no newline), release it, then ping.
 *
 * Usage (from headless/astro-poc):
 *   node scripts/indexnow-ping.mjs /powers-grade-7 https://www.noamdoronmath.co.il/grade-7
 *   node scripts/indexnow-ping.mjs --urls-file changed-urls.txt
 *   node scripts/indexnow-ping.mjs --from <old commit> --to <new commit>
 *   node scripts/indexnow-ping.mjs --before-dir <old checkout> --after-dir <new checkout>
 *   node scripts/indexnow-ping.mjs --check-key
 * Add --submit to any of the first four to send the request.
 *
 * --from/--to and --before-dir/--after-dir compare two states of the site
 * data and list the landing URLs that changed: topic landing pages (their
 * JSON or route), grade hubs, and the landing pages linked to a catalog topic
 * whose catalog entry or published worksheet editions changed. Catalog query
 * URLs (/worksheets?...) are never listed; the landing page is the URL that
 * should rank.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SITE_HOST = 'www.noamdoronmath.co.il';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
/** IndexNow accepts at most 10,000 URLs in one POST. */
export const MAX_URLS_PER_REQUEST = 10_000;
export const KEY_PATTERN = /^[0-9a-f]{32}$/;
const KEY_FILE_PATTERN = /^[0-9a-f]{32}\.txt$/;

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_PUBLIC_DIR = join(APP_DIR, 'public');

/** Repository-relative paths that make up one landing state. */
export const STATE_PATHS = Object.freeze({
  topicPages: 'headless/astro-poc/src/data/topic-pages',
  routes: 'headless/astro-poc/src/pages',
  gradeHubs: 'headless/astro-poc/src/data/grade-hubs',
  catalog: 'headless/astro-poc/src/data/catalog.v1.json',
  editions: 'headless/catalog/worksheet-editions.v1.json',
});

const STATUS_MEANING = {
  400: 'bad request: invalid format',
  403: 'forbidden: the key file was not found or does not contain the key',
  422: 'unprocessable: a URL is outside the host, or the key does not match the protocol',
  429: 'too many requests: try again later',
};

// ---------------------------------------------------------------- key file

/** Read the one public/<32 hex>.txt key file and check that it holds exactly its own name. */
export function readIndexNowKey(publicDir = DEFAULT_PUBLIC_DIR) {
  const files = readdirSync(publicDir).filter(name => KEY_FILE_PATTERN.test(name));
  if (files.length !== 1) {
    throw new Error(`Expected exactly one IndexNow key file (<32 hex>.txt) in ${publicDir}, found ${files.length}.`);
  }
  const key = files[0].slice(0, -'.txt'.length);
  const body = readFileSync(join(publicDir, files[0]), 'utf8');
  if (body !== key) {
    throw new Error(`${files[0]} must contain exactly ${key}, with no spaces or newline.`);
  }
  return key;
}

export function keyLocation(key) {
  return `${SITE_ORIGIN}/${key}.txt`;
}

// --------------------------------------------------------------------- URLs

/** Accept a site path (/powers-grade-7) or an https URL on the site host; return the absolute URL. */
export function normalizeUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('Empty URL.');
  let url;
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    url = new URL(raw, SITE_ORIGIN);
  } else {
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Not a URL or a site path: ${raw}`);
    }
  }
  if (url.protocol !== 'https:' || url.host !== SITE_HOST || url.username || url.password) {
    throw new Error(`Only ${SITE_ORIGIN} URLs can be sent with this key: ${raw}`);
  }
  url.hash = '';
  return url.href;
}

/** Normalize and de-duplicate, keeping the first occurrence order. */
export function normalizeUrls(inputs) {
  const seen = new Set();
  const out = [];
  for (const input of inputs) {
    const href = normalizeUrl(input);
    if (!seen.has(href)) {
      seen.add(href);
      out.push(href);
    }
  }
  return out;
}

/** One URL or site path per line; blank lines and # comments are ignored. */
export function parseUrlList(text) {
  return String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

/** Build the IndexNow JSON bodies, at most MAX_URLS_PER_REQUEST URLs each. */
export function buildPayloads(urls, key) {
  if (!KEY_PATTERN.test(key || '')) throw new Error('The IndexNow key must be 32 lowercase hex characters.');
  const urlList = normalizeUrls(urls);
  const payloads = [];
  for (let i = 0; i < urlList.length; i += MAX_URLS_PER_REQUEST) {
    payloads.push({
      host: SITE_HOST,
      key,
      keyLocation: keyLocation(key),
      urlList: urlList.slice(i, i + MAX_URLS_PER_REQUEST),
    });
  }
  return payloads;
}

// ------------------------------------------------------------ state readers

/** Git's blob id, so directory and git states compare by the same identity. */
function gitBlobId(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/** A state read from a checkout on disk (a repository root). */
export function directoryReader(root) {
  const base = resolve(root);
  if (!existsSync(base) || !statSync(base).isDirectory()) throw new Error(`Not a directory: ${root}`);
  const read = path => {
    const abs = join(base, path);
    return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null;
  };
  return {
    label: base,
    list(dir) {
      const abs = join(base, dir);
      const entries = new Map();
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return entries;
      for (const name of readdirSync(abs).sort()) {
        const file = join(abs, name);
        if (statSync(file).isFile()) entries.set(name, gitBlobId(readFileSync(file)));
      }
      return entries;
    },
    read,
    readMany(paths) {
      return new Map(paths.map(path => [path, read(path)]));
    },
  };
}

function git(repoDir, args, input) {
  const result = spawnSync('git', ['-C', repoDir, ...args], {
    input,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

/** A state read from one commit of a git repository, without touching the working tree. */
export function gitReader(repoDir, revision) {
  if (!revision || String(revision).startsWith('-')) throw new Error(`Not a git revision: ${revision}`);
  const resolved = git(repoDir, ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`]);
  const commit = resolved.status === 0 ? resolved.stdout.toString().trim() : '';
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`Unknown commit in ${repoDir}: ${revision}`);
  const readMany = paths => {
    const out = new Map();
    if (!paths.length) return out;
    const result = git(repoDir, ['cat-file', '--batch'], paths.map(path => `${commit}:${path}\n`).join(''));
    if (result.status !== 0) throw new Error(`git cat-file failed: ${result.stderr.toString().trim()}`);
    const buf = result.stdout;
    let offset = 0;
    for (const path of paths) {
      const lineEnd = buf.indexOf(0x0a, offset);
      if (lineEnd < 0) throw new Error('Truncated git cat-file output.');
      const header = buf.subarray(offset, lineEnd).toString();
      offset = lineEnd + 1;
      if (header.endsWith(' missing')) {
        out.set(path, null);
        continue;
      }
      const match = header.match(/^[0-9a-f]{40} (\w+) (\d+)$/);
      if (!match) throw new Error(`Unexpected git cat-file header: ${header}`);
      const size = Number(match[2]);
      out.set(path, match[1] === 'blob' ? buf.subarray(offset, offset + size).toString('utf8') : null);
      offset += size + 1;
    }
    return out;
  };
  return {
    label: `${revision} (${commit.slice(0, 12)})`,
    commit,
    list(dir) {
      const entries = new Map();
      const result = git(repoDir, ['ls-tree', '-z', `${commit}:${dir}`]);
      if (result.status !== 0) return entries; // the directory does not exist in this commit
      for (const row of result.stdout.toString('utf8').split('\0')) {
        const match = row.match(/^\d+ blob ([0-9a-f]{40})\t(.+)$/);
        if (match) entries.set(match[2], match[1]);
      }
      return entries;
    },
    read: path => readMany([path]).get(path),
    readMany,
  };
}

// ------------------------------------------------------------- state diff

/** Routed topic landings (JSON + route file) and grade hubs, by content identity. */
export function collectLandingState(reader) {
  const routes = reader.list(STATE_PATHS.routes);
  const pages = new Map();
  for (const [name, id] of reader.list(STATE_PATHS.topicPages)) {
    if (!name.endsWith('.json')) continue;
    const slug = name.slice(0, -'.json'.length);
    const route = routes.get(`${slug}.astro`);
    // A topic JSON without a route (a redirected legacy slug) is not a live landing.
    if (!route) continue;
    pages.set(slug, { identity: `${id}:${route}`, file: `${STATE_PATHS.topicPages}/${name}` });
  }
  const hubs = new Map();
  for (const [name, id] of reader.list(STATE_PATHS.gradeHubs)) {
    const match = name.match(/^([1-9])\.json$/);
    if (match) hubs.set(Number(match[1]), id);
  }
  return { reader, pages, hubs };
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function pagePath(slug, text) {
  const page = text == null ? {} : parseJson(text, `${slug}.json`);
  return typeof page.path === 'string' && page.path.startsWith('/') ? page.path : `/${slug}`;
}

/** Catalog keys "<grade>:<topic id>" that a landing page links to. */
function pageCatalogKeys(slug, text) {
  const page = parseJson(text, `${slug}.json`);
  const keys = new Set();
  for (const cta of [page.catalogCta, ...(Array.isArray(page.catalogCtas) ? page.catalogCtas : [])]) {
    if (!cta || typeof cta !== 'object') continue;
    let grade = null;
    let topic = null;
    if (typeof cta.href === 'string' && URL.canParse(cta.href, SITE_ORIGIN)) {
      const url = new URL(cta.href, SITE_ORIGIN);
      if (url.pathname === '/worksheets') {
        grade = url.searchParams.get('grade');
        topic = url.searchParams.get('topic');
      }
    }
    if (topic == null && Number.isInteger(cta.catalogTopicId)) topic = String(cta.catalogTopicId);
    if (grade == null && Number.isInteger(page.grade)) grade = String(page.grade);
    if (/^\d+$/.test(grade || '') && /^\d+$/.test(topic || '')) keys.add(`${Number(grade)}:${Number(topic)}`);
  }
  return keys;
}

function catalogTopics(text) {
  const topics = new Map();
  if (text == null) return topics;
  for (const grade of parseJson(text, STATE_PATHS.catalog).grades ?? []) {
    for (const topic of grade.topics ?? []) topics.set(`${grade.grade}:${topic.id}`, JSON.stringify(topic));
  }
  return topics;
}

/** Only published editions reach the public catalog; drafts change nothing on a landing. */
function publishedEditions(text) {
  const grouped = new Map();
  if (text == null) return grouped;
  for (const row of parseJson(text, STATE_PATHS.editions).editions ?? []) {
    if (row?.status !== 'published') continue;
    const key = `${row.grade}:${row.topicId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), JSON.stringify(row)]);
  }
  return new Map([...grouped].map(([key, rows]) => [key, rows.join('\n')]));
}

function changedKeys(before, after) {
  const keys = new Set();
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(key) !== after.get(key)) keys.add(key);
  }
  return keys;
}

/** Landing URLs that differ between two states, sorted. */
export function diffLandingStates(before, after) {
  const paths = new Set();
  const afterTexts = after.reader.readMany([...after.pages.values()].map(page => page.file));

  for (const [slug, page] of after.pages) {
    if (before.pages.get(slug)?.identity !== page.identity) paths.add(pagePath(slug, afterTexts.get(page.file)));
  }
  const removed = [...before.pages].filter(([slug]) => !after.pages.has(slug));
  if (removed.length) {
    // Engines should also learn that a landing is gone (404 or redirect).
    const beforeTexts = before.reader.readMany(removed.map(([, page]) => page.file));
    for (const [slug, page] of removed) paths.add(pagePath(slug, beforeTexts.get(page.file)));
  }

  for (const grade of new Set([...before.hubs.keys(), ...after.hubs.keys()])) {
    if (before.hubs.get(grade) !== after.hubs.get(grade)) paths.add(`/grade-${grade}`);
  }

  const [beforeCatalog, beforeEditions] = [STATE_PATHS.catalog, STATE_PATHS.editions].map(p => before.reader.read(p));
  const [afterCatalog, afterEditions] = [STATE_PATHS.catalog, STATE_PATHS.editions].map(p => after.reader.read(p));
  if (beforeCatalog !== afterCatalog || beforeEditions !== afterEditions) {
    const keys = new Set([
      ...changedKeys(catalogTopics(beforeCatalog), catalogTopics(afterCatalog)),
      ...changedKeys(publishedEditions(beforeEditions), publishedEditions(afterEditions)),
    ]);
    if (keys.size) {
      for (const [slug, page] of after.pages) {
        const text = afterTexts.get(page.file);
        if ([...pageCatalogKeys(slug, text)].some(key => keys.has(key))) paths.add(pagePath(slug, text));
      }
    }
  }

  return [...paths].sort((a, b) => a.localeCompare(b)).map(normalizeUrl);
}

export function changedLandingUrls(beforeReader, afterReader) {
  return diffLandingStates(collectLandingState(beforeReader), collectLandingState(afterReader));
}

// ------------------------------------------------------------------ network

/** Fail unless https://www.noamdoronmath.co.il/<key>.txt is served directly and holds the key. */
export async function checkKeyFileLive(key, { fetchImpl = globalThis.fetch } = {}) {
  const url = keyLocation(key);
  let response;
  try {
    response = await fetchImpl(url, { method: 'GET', redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
  } catch (error) {
    throw new Error(`Could not fetch ${url}: ${error.message}`);
  }
  if (response.status !== 200) {
    throw new Error(`${url} answered HTTP ${response.status}. Publish a release that serves public/${key}.txt before the first ping.`);
  }
  const body = (await response.text()).trim();
  if (body !== key) throw new Error(`${url} is live but does not contain the key. Nothing was sent.`);
  return url;
}

/** POST each payload; 200 (submitted) and 202 (received, key check pending) are success. */
export async function submitPayloads(payloads, { fetchImpl = globalThis.fetch } = {}) {
  const results = [];
  for (const [index, payload] of payloads.entries()) {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (response.status !== 200 && response.status !== 202) {
      let detail = '';
      try {
        detail = (await response.text()).trim().slice(0, 300);
      } catch {
        // The status alone is enough to report.
      }
      const sent = results.reduce((sum, r) => sum + r.urls, 0);
      throw new Error(
        `IndexNow answered HTTP ${response.status} (${STATUS_MEANING[response.status] ?? 'unexpected response'}) ` +
          `for request ${index + 1} of ${payloads.length}; ${sent} URL(s) were sent before it.` +
          (detail ? ` Response: ${detail}` : ''),
      );
    }
    results.push({ status: response.status, urls: payload.urlList.length });
  }
  return results;
}

// ---------------------------------------------------------------------- CLI

const USAGE = `Usage: node scripts/indexnow-ping.mjs [options] [url-or-path ...]

Sources (explicit URLs and a file may be combined with one diff):
  <url-or-path> ...                     ${SITE_ORIGIN}/... URLs or site paths such as /powers-grade-7
  --urls-file <file>                    one URL or path per line; blank lines and # comments are ignored
  --from <rev> --to <rev>               landing URLs changed between two commits of this repository
  --before-dir <dir> --after-dir <dir>  landing URLs changed between two checkouts (repository roots)

Options:
  --repo <dir>        repository for --from/--to (default: the one that holds this script)
  --public-dir <dir>  folder with the <key>.txt file (default: headless/astro-poc/public)
  --submit            send the request (default: dry run, nothing is sent)
  --check-key         only check that ${SITE_ORIGIN}/<key>.txt serves the key
  -h, --help          show this help

Exit codes: 0 done (or nothing to send), 1 failed, 2 wrong arguments.`;

class UsageError extends Error {}

export function parseArgs(argv) {
  const options = { urls: [], urlsFiles: [], submit: false, checkKey: false, help: false };
  const valued = new Set(['--urls-file', '--from', '--to', '--before-dir', '--after-dir', '--repo', '--public-dir']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--submit') options.submit = true;
    else if (arg === '--dry-run') options.submit = false;
    else if (arg === '--check-key') options.checkKey = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else if (valued.has(arg)) {
      const value = argv[++i];
      if (value == null || value.startsWith('--')) throw new UsageError(`${arg} needs a value.`);
      if (arg === '--urls-file') options.urlsFiles.push(value);
      else options[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    } else if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}`);
    else options.urls.push(arg);
  }
  if (options.help) return options;
  if (Boolean(options.from) !== Boolean(options.to)) throw new UsageError('--from and --to go together.');
  if (Boolean(options.beforeDir) !== Boolean(options.afterDir)) throw new UsageError('--before-dir and --after-dir go together.');
  if (options.from && options.beforeDir) throw new UsageError('Use one diff: --from/--to or --before-dir/--after-dir.');
  const hasSource = options.urls.length || options.urlsFiles.length || options.from || options.beforeDir;
  if (options.checkKey && (hasSource || options.submit)) throw new UsageError('--check-key takes no URLs and no --submit.');
  if (!options.checkKey && !hasSource) throw new UsageError('Give URLs, --urls-file, --from/--to or --before-dir/--after-dir.');
  return options;
}

function defaultRepo() {
  const result = git(APP_DIR, ['rev-parse', '--show-toplevel']);
  if (result.status !== 0) throw new Error(`${APP_DIR} is not inside a git repository; pass --repo.`);
  return result.stdout.toString().trim();
}

/** Run the CLI. Returns the exit code; never calls process.exit (tests call it directly). */
export async function main(argv, { fetchImpl = globalThis.fetch, out = console.log, err = console.error } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    err(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    out(USAGE);
    return 0;
  }
  try {
    const key = readIndexNowKey(options.publicDir ?? DEFAULT_PUBLIC_DIR);
    if (options.checkKey) {
      out(`IndexNow key file is live: ${await checkKeyFileLive(key, { fetchImpl })}`);
      return 0;
    }

    const inputs = [...options.urls];
    for (const file of options.urlsFiles) inputs.push(...parseUrlList(readFileSync(file, 'utf8')));
    let diffLabel = null;
    if (options.from) {
      const repo = options.repo ?? defaultRepo();
      const before = gitReader(repo, options.from);
      const after = gitReader(repo, options.to);
      diffLabel = `${before.label} -> ${after.label}`;
      inputs.push(...changedLandingUrls(before, after));
    } else if (options.beforeDir) {
      const before = directoryReader(options.beforeDir);
      const after = directoryReader(options.afterDir);
      diffLabel = `${before.label} -> ${after.label}`;
      inputs.push(...changedLandingUrls(before, after));
    }

    const payloads = buildPayloads(inputs, key);
    const total = payloads.reduce((sum, payload) => sum + payload.urlList.length, 0);
    if (diffLabel) out(`Compared ${diffLabel}.`);
    if (!total) {
      out('No landing URL changed; nothing to send.');
      return 0;
    }
    if (!options.submit) {
      out(`IndexNow dry run: nothing was sent. Add --submit to send ${total} URL(s).`);
      out(`POST ${INDEXNOW_ENDPOINT}`);
      for (const [index, payload] of payloads.entries()) {
        out(`Request ${index + 1} of ${payloads.length} (${payload.urlList.length} URL(s)):`);
        out(JSON.stringify(payload, null, 2));
      }
      return 0;
    }

    await checkKeyFileLive(key, { fetchImpl });
    const results = await submitPayloads(payloads, { fetchImpl });
    for (const [index, result] of results.entries()) {
      const meaning = result.status === 200 ? 'submitted' : 'received, key validation pending';
      out(`IndexNow request ${index + 1} of ${results.length}: HTTP ${result.status} (${meaning}), ${result.urls} URL(s).`);
    }
    for (const payload of payloads) for (const url of payload.urlList) out(`  ${url}`);
    return 0;
  } catch (error) {
    err(`IndexNow: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
