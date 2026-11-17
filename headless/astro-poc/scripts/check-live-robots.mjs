#!/usr/bin/env node
/**
 * SEO-5: post-release check of the robots.txt that production serves.
 *
 * Wix, not this app, answers /robots.txt on www.noamdoronmath.co.il
 * (src/pages/robots.txt.ts never runs there). Crawlers find the Astro
 * sitemaps (pages, blog, games) only after Noam adds this line in the Wix
 * dashboard, SEO > Robots.txt Editor:
 *
 *   Sitemap: https://www.noamdoronmath.co.il/sitemap-index.xml
 *
 * Report-only by default: prints FOUND, MISSING or UNREACHABLE and exits 0,
 * so it never blocks a release. tools/release/release.sh runs it that way
 * after a successful release. Pass --strict (exit 1 when missing, 2 when
 * unreachable) only after the Wix line exists.
 *
 * Read-only: one GET, no cookies, no credentials.
 *
 * Usage:
 *   npm run check:live-robots
 *   node scripts/check-live-robots.mjs [--strict] [--json] [--url <robots.txt URL>]
 */
import { pathToFileURL } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://www.noamdoronmath.co.il';
export const LIVE_ROBOTS_URL = `${PRODUCTION_ORIGIN}/robots.txt`;
export const EXPECTED_SITEMAP_URL = `${PRODUCTION_ORIGIN}/sitemap-index.xml`;
export const EXPECTED_SITEMAP_LINE = `Sitemap: ${EXPECTED_SITEMAP_URL}`;
const USER_AGENT = 'Mozilla/5.0 (compatible; noamdoronmath-live-robots-check)';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Sitemap URLs a crawler reads from a robots.txt body. Field names are
 * case-insensitive and "#" starts a comment, so a commented-out line does
 * not count.
 * @param {string} text
 * @returns {string[]}
 */
export function sitemapUrls(text) {
  const urls = [];
  for (const raw of String(text || '').split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^sitemap\s*:\s*(\S+)\s*$/i.exec(line);
    if (m) urls.push(m[1]);
  }
  return urls;
}

/**
 * @param {string} text
 * @returns {boolean} true when robots.txt declares the production sitemap index
 */
export function hasSitemapIndexLine(text) {
  return sitemapUrls(text).includes(EXPECTED_SITEMAP_URL);
}

/**
 * @typedef {{
 *   status: 'found' | 'missing' | 'unreachable',
 *   url: string,
 *   httpStatus: number | null,
 *   sitemaps: string[],
 *   wixGenerated: boolean,
 *   error: string | null,
 * }} LiveRobotsResult
 */

/**
 * One GET of the live robots.txt. Never throws: network errors and non-200
 * answers come back as status "unreachable".
 * @param {{ url?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<LiveRobotsResult>}
 */
export async function checkLiveRobots({ url = LIVE_ROBOTS_URL, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const base = { url, httpStatus: null, sitemaps: [], wixGenerated: false, error: null };
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/plain' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return { ...base, status: 'unreachable', error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
  if (response.status !== 200) {
    return { ...base, status: 'unreachable', httpStatus: response.status, error: `HTTP ${response.status}` };
  }
  let text;
  try {
    text = await response.text();
  } catch (err) {
    return { ...base, status: 'unreachable', httpStatus: 200, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
  return {
    ...base,
    status: hasSitemapIndexLine(text) ? 'found' : 'missing',
    httpStatus: 200,
    sitemaps: sitemapUrls(text),
    wixGenerated: /Robots\.txt Editor/i.test(text),
  };
}

/**
 * Report-only always exits 0. Strict: found 0, missing 1, unreachable 2.
 * @param {LiveRobotsResult} result
 * @param {boolean} strict
 */
export function exitCodeFor(result, strict) {
  if (!strict) return 0;
  if (result.status === 'found') return 0;
  return result.status === 'missing' ? 1 : 2;
}

/**
 * @param {LiveRobotsResult} result
 * @param {{ strict?: boolean, githubActions?: boolean }} [options]
 * @returns {string[]}
 */
export function formatReport(result, { strict = false, githubActions = false } = {}) {
  const mode = strict ? 'strict' : 'report-only';
  const lines = [`LIVE_ROBOTS=${result.status} (${mode}) ${result.url}`];
  if (result.httpStatus !== null) lines.push(`  HTTP ${result.httpStatus}${result.wixGenerated ? ', Wix-generated file' : ''}`);
  lines.push(`  Sitemap lines: ${result.sitemaps.length ? result.sitemaps.join(', ') : '(none)'}`);
  if (result.status === 'found') {
    lines.push(`  OK: "${EXPECTED_SITEMAP_LINE}" is live.`);
    return lines;
  }
  const what =
    result.status === 'missing'
      ? `Missing "${EXPECTED_SITEMAP_LINE}". Add it in the Wix dashboard: SEO > Robots.txt Editor (keep the Wix lines).`
      : `Could not read the live robots.txt (${result.error || 'unknown error'}).`;
  lines.push(`  ${what}`);
  if (!strict) lines.push('  Report only: this does not fail the release.');
  if (githubActions) lines.push(`::${strict ? 'error' : 'warning'} title=Live robots.txt::${what}`);
  return lines;
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = { strict: false, json: false, url: LIVE_ROBOTS_URL };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') opts.strict = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--url' && argv[i + 1]) opts.url = argv[++i];
    else throw new Error(`Unknown argument: ${arg}. Use --strict, --json or --url <robots.txt URL>.`);
  }
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 64;
    return;
  }
  const result = await checkLiveRobots({ url: opts.url });
  if (opts.json) {
    console.log(JSON.stringify({ ...result, expected: EXPECTED_SITEMAP_LINE, strict: opts.strict }, null, 2));
  } else {
    for (const line of formatReport(result, { strict: opts.strict, githubActions: process.env.GITHUB_ACTIONS === 'true' })) {
      console.log(line);
    }
  }
  process.exitCode = exitCodeFor(result, opts.strict);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
