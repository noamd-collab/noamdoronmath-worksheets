/**
 * SEO-5: scripts/check-live-robots.mjs, the post-release report on the
 * robots.txt that production (Wix) serves. No test here touches the network:
 * fetch is faked, and the CLI runs against a loopback server.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_SITEMAP_LINE,
  EXPECTED_SITEMAP_URL,
  LIVE_ROBOTS_URL,
  checkLiveRobots,
  exitCodeFor,
  formatReport,
  hasSitemapIndexLine,
  parseArgs,
  sitemapUrls,
} from '../scripts/check-live-robots.mjs';
import { SITE_CANONICAL_ORIGIN, renderRobotsTxt } from '../src/lib/siteSeo';

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

/** Live https://www.noamdoronmath.co.il/robots.txt as Wix served it on 17 Nov 2026. */
const WIX_ROBOTS_20261117 = [
  'User-agent: *',
  'Allow: /',
  'Disallow: *?lightbox=',
  '',
  '# Optimization for Google Ads Bot',
  'User-agent: AdsBot-Google-Mobile',
  'User-agent: AdsBot-Google',
  'Disallow: /_partials*',
  'Disallow: /pro-gallery-webapp/v1/galleries/*',
  '',
  '# Block PetalBot',
  'User-agent: PetalBot',
  'Disallow: /',
  '',
  '# Crawl delay for overly enthusiastic bots',
  'User-agent: dotbot',
  'Crawl-delay: 10',
  'User-agent: AhrefsBot',
  'Crawl-delay: 10',
  '',
  'Sitemap: https://www.noamdoronmath.co.il/sitemap.xml',
  '',
  '# Auto generated, go to SEO Tools > Robots.txt Editor to change this',
  '',
].join('\n');

/** The same file after Noam adds the line in SEO > Robots.txt Editor. */
const WIX_ROBOTS_WITH_INDEX = WIX_ROBOTS_20261117.replace(
  'Sitemap: https://www.noamdoronmath.co.il/sitemap.xml\n',
  `Sitemap: https://www.noamdoronmath.co.il/sitemap.xml\n${EXPECTED_SITEMAP_LINE}\n`,
);

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

describe('robots.txt sitemap line parsing', () => {
  it('expects exactly the line the repo robots.txt body declares', () => {
    assert.equal(EXPECTED_SITEMAP_URL, `${SITE_CANONICAL_ORIGIN}/sitemap-index.xml`);
    assert.equal(EXPECTED_SITEMAP_LINE, `Sitemap: ${SITE_CANONICAL_ORIGIN}/sitemap-index.xml`);
    assert.equal(LIVE_ROBOTS_URL, `${SITE_CANONICAL_ORIGIN}/robots.txt`);
    for (const indexable of [true, false]) {
      assert.ok(renderRobotsTxt(indexable).split('\n').includes(EXPECTED_SITEMAP_LINE));
      assert.equal(hasSitemapIndexLine(renderRobotsTxt(indexable)), true);
    }
  });

  it('the live Wix file of 17 Nov 2026 lacks the line; adding it is enough', () => {
    assert.deepEqual(sitemapUrls(WIX_ROBOTS_20261117), ['https://www.noamdoronmath.co.il/sitemap.xml']);
    assert.equal(hasSitemapIndexLine(WIX_ROBOTS_20261117), false);
    assert.deepEqual(sitemapUrls(WIX_ROBOTS_WITH_INDEX), [
      'https://www.noamdoronmath.co.il/sitemap.xml',
      EXPECTED_SITEMAP_URL,
    ]);
    assert.equal(hasSitemapIndexLine(WIX_ROBOTS_WITH_INDEX), true);
  });

  it('reads the field like a crawler: any case, spacing, CRLF; comments do not count', () => {
    assert.equal(hasSitemapIndexLine(`sitemap:${EXPECTED_SITEMAP_URL}`), true);
    assert.equal(hasSitemapIndexLine(`  SITEMAP :  ${EXPECTED_SITEMAP_URL}  \r\nUser-agent: *\r\n`), true);
    assert.equal(hasSitemapIndexLine(`${EXPECTED_SITEMAP_LINE} # added by Noam`), true);
    assert.equal(hasSitemapIndexLine(`# ${EXPECTED_SITEMAP_LINE}`), false);
    assert.equal(hasSitemapIndexLine('# see https://www.noamdoronmath.co.il/sitemap-index.xml'), false);
    assert.equal(hasSitemapIndexLine(''), false);
  });

  it('only the exact production URL counts', () => {
    for (const url of [
      'http://www.noamdoronmath.co.il/sitemap-index.xml',
      'https://noamdoronmath.co.il/sitemap-index.xml',
      'https://www.noamdoronmath.co.il/sitemap-index.xml/',
      'https://www.noamdoronmath.co.il/sitemap.xml',
      'https://www.noamdoronmath.co.il/sitemap-pages.xml',
      'https://preview.wix-site-host.com/sitemap-index.xml',
    ]) {
      assert.equal(hasSitemapIndexLine(`Sitemap: ${url}`), false, url);
    }
  });
});

describe('checkLiveRobots (fetch faked)', () => {
  it('sends one plain GET with a timeout to production /robots.txt', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await checkLiveRobots({
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return textResponse(WIX_ROBOTS_20261117);
      }) as typeof fetch,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://www.noamdoronmath.co.il/robots.txt');
    assert.equal(calls[0].init.method, undefined, 'GET');
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.equal(calls[0].init.credentials, undefined);
    assert.deepEqual(result, {
      url: LIVE_ROBOTS_URL,
      status: 'missing',
      httpStatus: 200,
      sitemaps: ['https://www.noamdoronmath.co.il/sitemap.xml'],
      wixGenerated: true,
      error: null,
    });
  });

  it('reports found once the line is live', async () => {
    const result = await checkLiveRobots({ fetchImpl: (async () => textResponse(WIX_ROBOTS_WITH_INDEX)) as typeof fetch });
    assert.equal(result.status, 'found');
    assert.equal(result.sitemaps.includes(EXPECTED_SITEMAP_URL), true);
  });

  it('never throws: HTTP errors and network failures are "unreachable"', async () => {
    const http = await checkLiveRobots({ fetchImpl: (async () => textResponse('busy', 503)) as typeof fetch });
    assert.equal(http.status, 'unreachable');
    assert.equal(http.httpStatus, 503);
    assert.equal(http.error, 'HTTP 503');

    const network = await checkLiveRobots({
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
    });
    assert.equal(network.status, 'unreachable');
    assert.equal(network.httpStatus, null);
    assert.match(network.error || '', /fetch failed/);
  });
});

describe('report-only exit codes and output', () => {
  const base = { url: LIVE_ROBOTS_URL, httpStatus: 200, sitemaps: [], wixGenerated: true, error: null };

  it('report-only always exits 0; strict exits 0, 1, 2', () => {
    for (const status of ['found', 'missing', 'unreachable'] as const) {
      assert.equal(exitCodeFor({ ...base, status }, false), 0, `report-only ${status}`);
    }
    assert.equal(exitCodeFor({ ...base, status: 'found' }, true), 0);
    assert.equal(exitCodeFor({ ...base, status: 'missing' }, true), 1);
    assert.equal(exitCodeFor({ ...base, status: 'unreachable', httpStatus: null }, true), 2);
  });

  it('a missing line tells where to add it and says the release is not failed', () => {
    const lines = formatReport({ ...base, status: 'missing' }, { githubActions: true });
    assert.equal(lines[0], `LIVE_ROBOTS=missing (report-only) ${LIVE_ROBOTS_URL}`);
    const text = lines.join('\n');
    assert.match(text, /SEO > Robots\.txt Editor/);
    assert.ok(text.includes(EXPECTED_SITEMAP_LINE));
    assert.match(text, /does not fail the release/);
    assert.match(text, /^::warning title=Live robots\.txt::/m);

    const strict = formatReport({ ...base, status: 'missing' }, { strict: true, githubActions: true }).join('\n');
    assert.match(strict, /^::error title=Live robots\.txt::/m);
    assert.doesNotMatch(strict, /does not fail the release/);

    const found = formatReport({ ...base, status: 'found', sitemaps: [EXPECTED_SITEMAP_URL] }).join('\n');
    assert.match(found, /^LIVE_ROBOTS=found/);
    assert.doesNotMatch(found, /::warning|::error/);
  });

  it('parses --strict, --json and --url; rejects anything else', () => {
    assert.deepEqual(parseArgs([]), { strict: false, json: false, url: LIVE_ROBOTS_URL });
    assert.deepEqual(parseArgs(['--strict', '--json', '--url', 'http://127.0.0.1:1/robots.txt']), {
      strict: true,
      json: true,
      url: 'http://127.0.0.1:1/robots.txt',
    });
    assert.throws(() => parseArgs(['--url']), /Unknown argument/);
    assert.throws(() => parseArgs(['--fail']), /Unknown argument/);
  });
});

describe('CLI against a loopback robots.txt', () => {
  async function serve(status: number, body: string): Promise<{ server: Server; url: string }> {
    const server = createServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return { server, url: `http://127.0.0.1:${port}/robots.txt` };
  }

  function runCli(args: string[]): Promise<{ code: number | null; stdout: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fromTest('../scripts/check-live-robots.mjs'), ...args], {
        env: { ...process.env, GITHUB_ACTIONS: 'false' },
      });
      let stdout = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout }));
    });
  }

  it('report-only exits 0 when the line is missing; --strict exits 1', async () => {
    const { server, url } = await serve(200, WIX_ROBOTS_20261117);
    try {
      const report = await runCli(['--url', url]);
      assert.equal(report.code, 0);
      assert.match(report.stdout, /^LIVE_ROBOTS=missing \(report-only\)/m);
      const strict = await runCli(['--strict', '--url', url]);
      assert.equal(strict.code, 1);
      assert.match(strict.stdout, /^LIVE_ROBOTS=missing \(strict\)/m);
    } finally {
      server.close();
    }
  });

  it('--strict exits 0 once the line is live; --json prints the result', async () => {
    const { server, url } = await serve(200, WIX_ROBOTS_WITH_INDEX);
    try {
      const strict = await runCli(['--strict', '--url', url]);
      assert.equal(strict.code, 0);
      assert.match(strict.stdout, /^LIVE_ROBOTS=found \(strict\)/m);
      const json = await runCli(['--json', '--url', url]);
      assert.equal(json.code, 0);
      const parsed = JSON.parse(json.stdout);
      assert.equal(parsed.status, 'found');
      assert.equal(parsed.expected, EXPECTED_SITEMAP_LINE);
    } finally {
      server.close();
    }
  });

  it('a server error is reported, not fatal, unless --strict', async () => {
    const { server, url } = await serve(500, 'oops');
    try {
      assert.equal((await runCli(['--url', url])).code, 0);
      assert.equal((await runCli(['--strict', '--url', url])).code, 2);
    } finally {
      server.close();
    }
  });
});

describe('wiring: manual npm script and report-only step after a release', () => {
  it('package.json exposes npm run check:live-robots', () => {
    const pkg = JSON.parse(readFileSync(fromTest('../package.json'), 'utf8'));
    assert.equal(pkg.scripts['check:live-robots'], 'node scripts/check-live-robots.mjs');
  });

  it('release.sh runs it only after a successful release and keeps the release exit code', () => {
    const shell = readFileSync(fromTest('../../../tools/release/release.sh'), 'utf8');
    const release = shell.indexOf('run_release || release_rc=$?');
    const check = shell.indexOf('node scripts/check-live-robots.mjs');
    const exit = shell.lastIndexOf('exit "$release_rc"');
    assert.ok(release > 0 && check > release && exit > check, 'check runs after the release, before exit');
    const block = shell.slice(shell.lastIndexOf('if [ "$release_rc" -eq 0 ]; then', check), exit);
    assert.match(block, /^if \[ "\$release_rc" -eq 0 \]; then\n/, 'only after a successful release');
    assert.match(block, /check-live-robots\.mjs <\/dev\/null \|\| echo "LIVE_ROBOTS=not-run \(report only\)"/);
    assert.doesNotMatch(block, /--strict/, 'report-only: never strict inside the release');
    assert.doesNotMatch(block, /release_rc=/, 'the check never assigns the release exit code');
    assert.match(shell.trimEnd(), /echo "RELEASE_EXIT=\$release_rc"\nexit "\$release_rc"$/);
  });
});
