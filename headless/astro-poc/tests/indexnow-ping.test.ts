/**
 * SEO-6 IndexNow: key file, request body, changed-landing diff and CLI.
 * No test touches the network: every fetch is a local fake, and the one
 * subprocess run replaces fetch with a function that throws.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it } from 'node:test';
import {
  INDEXNOW_ENDPOINT,
  MAX_URLS_PER_REQUEST,
  SITE_HOST,
  STATE_PATHS,
  buildPayloads,
  changedLandingUrls,
  collectLandingState,
  directoryReader,
  gitReader,
  keyLocation,
  main,
  normalizeUrl,
  normalizeUrls,
  parseUrlList,
  readIndexNowKey,
} from '../scripts/indexnow-ping.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appDir, '../..');
const publicDir = path.join(appDir, 'public');
const script = path.join(appDir, 'scripts/indexnow-ping.mjs');
const ORIGIN = `https://${SITE_HOST}`;

const dirs: string[] = [];
function tempDir(prefix: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ fixtures

type Page = { grade?: number; topic?: number | null; extra?: string; viaId?: boolean; path?: string };
type State = {
  pages?: Record<string, Page>;
  routes?: Record<string, string>;
  hubs?: Record<string, string>;
  catalog?: Record<string, string>;
  editions?: Array<{ grade: number; topicId: number; editionId: string; status: string }>;
};

function pageJson(slug: string, page: Page) {
  const grade = page.grade ?? 8;
  const cta = page.topic == null ? null : page.viaId
    ? { label: 'x', href: '/worksheets', catalogTopicId: page.topic }
    : { label: 'x', href: `/worksheets?grade=${grade}&topic=${page.topic}`, catalogTopicId: page.topic };
  return JSON.stringify({ slug, path: page.path ?? `/${slug}`, grade, catalogCta: cta, catalogCtas: cta ? [cta] : [], h1: page.extra ?? slug }, null, 1);
}

/** Write one repository-root state in the real layout (STATE_PATHS). */
function writeState(root: string, state: State) {
  const file = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  for (const dir of [STATE_PATHS.topicPages, STATE_PATHS.routes, STATE_PATHS.gradeHubs]) mkdirSync(path.join(root, dir), { recursive: true });
  for (const [slug, page] of Object.entries(state.pages ?? {})) {
    file(`${STATE_PATHS.topicPages}/${slug}.json`, pageJson(slug, page));
    file(`${STATE_PATHS.routes}/${slug}.astro`, state.routes?.[slug] ?? `<TopicPage slug="${slug}" />\n`);
  }
  for (const [slug, route] of Object.entries(state.routes ?? {})) file(`${STATE_PATHS.routes}/${slug}.astro`, route);
  for (const [grade, text] of Object.entries(state.hubs ?? {})) file(`${STATE_PATHS.gradeHubs}/${grade}.json`, text);
  const grades = new Map<number, Array<{ id: number; title: string }>>();
  for (const [key, title] of Object.entries(state.catalog ?? {})) {
    const [grade, id] = key.split(':').map(Number);
    grades.set(grade, [...(grades.get(grade) ?? []), { id, title }]);
  }
  file(STATE_PATHS.catalog, JSON.stringify({ grades: [...grades].map(([grade, topics]) => ({ grade, topics })) }, null, 1));
  file(STATE_PATHS.editions, JSON.stringify({ version: 1, editions: state.editions ?? [] }, null, 1));
}

const BASE: State = {
  pages: {
    'powers-grade-7': { grade: 7, topic: 6 },
    'systems-of-equations-grade-8': { grade: 8, topic: 47 },
    'pythagoras-in-space-grade-8': { grade: 8, topic: 54, viaId: true },
    'kite-grade-9': { grade: 9, topic: 3 },
  },
  hubs: { 7: '{"grade":7}', 8: '{"grade":8}', 9: '{"grade":9}' },
  catalog: { '7:6': 'חזקות', '8:47': 'מערכות', '8:54': 'פיתגורס במרחב', '9:3': 'דלתון', '9:30': 'נושא בלי דף נחיתה' },
  editions: [{ grade: 8, topicId: 47, editionId: 'ms-a-r1', status: 'published' }],
};

function clone(state: State): State {
  return JSON.parse(JSON.stringify(state));
}

function diffDirs(before: State, after: State) {
  const a = tempDir('indexnow-before-');
  const b = tempDir('indexnow-after-');
  writeState(a, before);
  writeState(b, after);
  return changedLandingUrls(directoryReader(a), directoryReader(b));
}

const url = (p: string) => `${ORIGIN}${p}`;

// --------------------------------------------------------------------- tests

describe('IndexNow key file', () => {
  it('ships exactly one public <32 hex>.txt whose whole content is its own name', () => {
    const keyFiles = readdirSync(publicDir).filter(name => /^[0-9a-f]{32}\.txt$/.test(name));
    assert.equal(keyFiles.length, 1);
    const key = readIndexNowKey(publicDir);
    assert.match(key, /^[0-9a-f]{32}$/);
    assert.equal(keyFiles[0], `${key}.txt`);
    assert.equal(readFileSync(path.join(publicDir, keyFiles[0])).toString('utf8'), key, 'no newline, BOM or spaces');
    assert.equal(keyLocation(key), `${ORIGIN}/${key}.txt`);
  });

  it('refuses a key file with a newline, another value, or a second key', () => {
    const key = 'a'.repeat(32);
    const newline = tempDir('indexnow-key-');
    writeFileSync(path.join(newline, `${key}.txt`), `${key}\n`);
    assert.throws(() => readIndexNowKey(newline), /no spaces or newline/);
    const other = tempDir('indexnow-key-');
    writeFileSync(path.join(other, `${key}.txt`), 'b'.repeat(32));
    assert.throws(() => readIndexNowKey(other), /must contain exactly/);
    const two = tempDir('indexnow-key-');
    writeFileSync(path.join(two, `${key}.txt`), key);
    writeFileSync(path.join(two, `${'c'.repeat(32)}.txt`), 'c'.repeat(32));
    assert.throws(() => readIndexNowKey(two), /exactly one IndexNow key file/);
    assert.throws(() => readIndexNowKey(tempDir('indexnow-key-')), /found 0/);
  });
});

describe('IndexNow URLs and request body', () => {
  it('turns site paths into site URLs, drops fragments and keeps queries', () => {
    assert.equal(normalizeUrl('/powers-grade-7'), url('/powers-grade-7'));
    assert.equal(normalizeUrl(' https://WWW.noamdoronmath.co.il/grade-9#faq '), url('/grade-9'));
    assert.equal(normalizeUrl(`${ORIGIN}:443/a?b=1`), url('/a?b=1'));
    assert.deepEqual(normalizeUrls(['/a', url('/a'), '/b', '/a#x']), [url('/a'), url('/b')]);
  });

  it('rejects URLs IndexNow would refuse for this host', () => {
    for (const bad of [
      'http://www.noamdoronmath.co.il/a',
      'https://noamdoronmath.co.il/a',
      'https://noamdoronmath.wixsite.com/a',
      '//www.noamdoronmath.co.il/a',
      'https://user:pw@www.noamdoronmath.co.il/a',
      'powers-grade-7',
      '',
    ]) {
      assert.throws(() => normalizeUrl(bad), undefined, bad);
    }
  });

  it('reads one URL per line and skips blank lines and comments', () => {
    assert.deepEqual(parseUrlList('# changed\n/powers-grade-7\r\n\n  https://www.noamdoronmath.co.il/grade-7  \n#/skip\n'),
      ['/powers-grade-7', 'https://www.noamdoronmath.co.il/grade-7']);
  });

  it('builds the IndexNow body with host, key, keyLocation and urlList', () => {
    const key = '0123456789abcdef0123456789abcdef';
    const [payload, ...rest] = buildPayloads(['/powers-grade-7', '/grade-7'], key);
    assert.equal(rest.length, 0);
    assert.deepEqual(payload, {
      host: 'www.noamdoronmath.co.il',
      key,
      keyLocation: `https://www.noamdoronmath.co.il/${key}.txt`,
      urlList: ['https://www.noamdoronmath.co.il/powers-grade-7', 'https://www.noamdoronmath.co.il/grade-7'],
    });
    assert.deepEqual(buildPayloads([], key), []);
    assert.throws(() => buildPayloads(['/a'], 'not-a-key'), /32 lowercase hex/);
  });

  it('never puts more than 10,000 URLs in one request', () => {
    assert.equal(MAX_URLS_PER_REQUEST, 10_000);
    const urls = Array.from({ length: 10_001 }, (_, i) => `/page-${i}`);
    const payloads = buildPayloads(urls, 'f'.repeat(32));
    assert.deepEqual(payloads.map(p => p.urlList.length), [10_000, 1]);
    assert.equal(payloads[1].urlList[0], url('/page-10000'));
  });
});

describe('changed landing URLs between two states', () => {
  it('finds nothing when the states are equal', () => {
    assert.deepEqual(diffDirs(BASE, clone(BASE)), []);
  });

  it('lists a landing whose JSON or route changed, and a new routed landing', () => {
    const after = clone(BASE);
    after.pages!['kite-grade-9'].extra = 'דלתון — עודכן';
    after.routes = { 'powers-grade-7': '<TopicPage slug="powers-grade-7" />\n<!-- changed -->\n' };
    after.pages!['new-topic-grade-9'] = { grade: 9, topic: 30 };
    assert.deepEqual(diffDirs(BASE, after), [url('/kite-grade-9'), url('/new-topic-grade-9'), url('/powers-grade-7')]);
  });

  it('ignores a topic JSON with no route, and lists a removed landing so engines learn it is gone', () => {
    const before = tempDir('indexnow-before-');
    const after = tempDir('indexnow-after-');
    writeState(before, BASE);
    writeState(after, BASE);
    writeFileSync(path.join(after, STATE_PATHS.topicPages, 'angles-grade-7.json'), pageJson('angles-grade-7', { grade: 7, topic: 6 }));
    assert.deepEqual(changedLandingUrls(directoryReader(before), directoryReader(after)), []);
    rmSync(path.join(after, STATE_PATHS.routes, 'kite-grade-9.astro'));
    assert.deepEqual(changedLandingUrls(directoryReader(before), directoryReader(after)), [url('/kite-grade-9')]);
  });

  it('lists the grade hub when its data changes', () => {
    const after = clone(BASE);
    after.hubs![9] = '{"grade":9,"sections":["new"]}';
    assert.deepEqual(diffDirs(BASE, after), [url('/grade-9')]);
  });

  it('maps a changed catalog topic to the landings that link to it, by href or by topic id', () => {
    const after = clone(BASE);
    after.catalog!['8:47'] = 'מערכות — חיתוך גרפי';
    after.catalog!['8:54'] = 'פיתגורס במרחב — עודכן';
    assert.deepEqual(diffDirs(BASE, after), [url('/pythagoras-in-space-grade-8'), url('/systems-of-equations-grade-8')]);
  });

  it('lists no URL for a catalog topic without a landing (catalog query URLs are never pinged)', () => {
    const after = clone(BASE);
    after.catalog!['9:30'] = 'שם חדש';
    after.catalog!['9:31'] = 'נושא חדש בלי דף נחיתה';
    assert.deepEqual(diffDirs(BASE, after), []);
  });

  it('maps a published worksheet edition to its landing and ignores drafts', () => {
    const draft = clone(BASE);
    draft.editions!.push({ grade: 7, topicId: 6, editionId: 'ms-b-r1', status: 'draft' });
    assert.deepEqual(diffDirs(BASE, draft), []);
    const published = clone(BASE);
    published.editions!.push({ grade: 7, topicId: 6, editionId: 'ms-b-r1', status: 'published' });
    assert.deepEqual(diffDirs(BASE, published), [url('/powers-grade-7')]);
  });

  it('reads the same answer from two git commits, and agrees with a checkout on disk', () => {
    const repo = tempDir('indexnow-git-');
    const gitRun = (...args: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.name=IndexNow test',
      '-c', 'user.email=indexnow@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();
    gitRun('init', '-q');
    writeState(repo, BASE);
    gitRun('add', '-A');
    gitRun('commit', '-qm', 'before');
    const before = gitRun('rev-parse', 'HEAD');
    const after = clone(BASE);
    after.pages!['kite-grade-9'].extra = 'changed';
    after.hubs![7] = '{"grade":7,"changed":true}';
    after.editions!.push({ grade: 8, topicId: 54, editionId: 'ms-c-r1', status: 'published' });
    writeState(repo, after);
    gitRun('add', '-A');
    gitRun('commit', '-qm', 'after');
    const expected = [url('/grade-7'), url('/kite-grade-9'), url('/pythagoras-in-space-grade-8')];
    assert.deepEqual(changedLandingUrls(gitReader(repo, before), gitReader(repo, 'HEAD')), expected);
    assert.deepEqual(changedLandingUrls(gitReader(repo, before), directoryReader(repo)), expected);
    assert.deepEqual(changedLandingUrls(gitReader(repo, 'HEAD'), directoryReader(repo)), []);
    assert.throws(() => gitReader(repo, 'no-such-commit'), /Unknown commit/);
    assert.throws(() => gitReader(repo, '--output=x'), /Not a git revision/);
  });

  it('understands the real site layout', () => {
    const state = collectLandingState(directoryReader(repoRoot));
    assert.ok(state.pages.size > 300, `routed topic landings: ${state.pages.size}`);
    assert.ok(state.pages.has('powers-grade-7'));
    assert.ok(!state.pages.has('angles-grade-7'), 'the unrouted legacy slug is not a live landing');
    assert.deepEqual([...state.hubs.keys()].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(changedLandingUrls(directoryReader(repoRoot), directoryReader(repoRoot)), []);
  });
});

describe('indexnow-ping CLI', () => {
  type Call = { url: string; init: { method?: string; headers?: Record<string, string>; body?: string } };
  function fakeFetch(responses: Array<{ status: number; body?: string }>) {
    const calls: Call[] = [];
    const fetchImpl = async (target: string, init: Call['init'] = {}) => {
      calls.push({ url: String(target), init });
      const next = responses.shift();
      assert.ok(next, `unexpected request to ${target}`);
      return new Response(next.body ?? '', { status: next.status });
    };
    return { calls, fetchImpl };
  }
  async function run(argv: string[], fetchImpl: unknown) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(argv, { fetchImpl, out: (s: string) => out.push(s), err: (s: string) => err.push(s) });
    return { code, out: out.join('\n'), err: err.join('\n') };
  }
  const key = readIndexNowKey(publicDir);

  it('is a dry run by default and sends nothing', async () => {
    const { calls, fetchImpl } = fakeFetch([]);
    const result = await run(['/powers-grade-7', `${ORIGIN}/grade-7`], fetchImpl);
    assert.equal(result.code, 0);
    assert.equal(calls.length, 0);
    assert.match(result.out, /dry run: nothing was sent/);
    assert.match(result.out, new RegExp(`"keyLocation": "${ORIGIN}/${key}\\.txt"`));
  });

  it('checks the live key file, then POSTs the JSON body to IndexNow', async () => {
    const { calls, fetchImpl } = fakeFetch([{ status: 200, body: `${key}\n` }, { status: 200 }]);
    const result = await run(['--submit', '/powers-grade-7', '/grade-7'], fetchImpl);
    assert.equal(result.code, 0, result.err);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, `${ORIGIN}/${key}.txt`);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[1].url, INDEXNOW_ENDPOINT);
    assert.equal(INDEXNOW_ENDPOINT, 'https://api.indexnow.org/indexnow');
    assert.equal(calls[1].init.method, 'POST');
    assert.equal(calls[1].init.headers?.['content-type'], 'application/json; charset=utf-8');
    assert.deepEqual(JSON.parse(calls[1].init.body ?? ''), {
      host: SITE_HOST, key, keyLocation: `${ORIGIN}/${key}.txt`,
      urlList: [`${ORIGIN}/powers-grade-7`, `${ORIGIN}/grade-7`],
    });
    assert.match(result.out, /HTTP 200 \(submitted\), 2 URL\(s\)/);
  });

  it('accepts 202 (key validation pending) as success', async () => {
    const { fetchImpl } = fakeFetch([{ status: 200, body: key }, { status: 202 }]);
    const result = await run(['--submit', '/grade-8'], fetchImpl);
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /HTTP 202 \(received, key validation pending\)/);
  });

  it('sends nothing until the key file is live and holds the key', async () => {
    for (const keyResponse of [{ status: 404, body: 'not found' }, { status: 301 }, { status: 200, body: 'other' }]) {
      const { calls, fetchImpl } = fakeFetch([keyResponse]);
      const result = await run(['--submit', '/grade-8'], fetchImpl);
      assert.equal(result.code, 1);
      assert.equal(calls.length, 1, 'no POST after a failed key check');
      assert.match(result.err, /Publish a release that serves|does not contain the key/);
    }
  });

  it('fails with the IndexNow meaning of an error status', async () => {
    const { fetchImpl } = fakeFetch([{ status: 200, body: key }, { status: 422, body: 'bad url' }]);
    const result = await run(['--submit', '/grade-8'], fetchImpl);
    assert.equal(result.code, 1);
    assert.match(result.err, /HTTP 422 \(unprocessable: a URL is outside the host/);
    const limited = fakeFetch([{ status: 200, body: key }, { status: 429 }]);
    assert.match((await run(['--submit', '/grade-8'], limited.fetchImpl)).err, /HTTP 429 \(too many requests/);
  });

  it('does not touch the network when a diff finds nothing, even with --submit', async () => {
    const { calls, fetchImpl } = fakeFetch([]);
    const result = await run(['--submit', '--before-dir', repoRoot, '--after-dir', repoRoot], fetchImpl);
    assert.equal(result.code, 0, result.err);
    assert.equal(calls.length, 0);
    assert.match(result.out, /nothing to send/);
  });

  it('reads --urls-file and checks only the key with --check-key', async () => {
    const file = path.join(tempDir('indexnow-list-'), 'urls.txt');
    writeFileSync(file, '# from the release\n/powers-grade-7\n/powers-grade-7\n');
    const dry = await run(['--urls-file', file], fakeFetch([]).fetchImpl);
    assert.equal(dry.code, 0);
    assert.match(dry.out, /send 1 URL\(s\)/);
    const { calls, fetchImpl } = fakeFetch([{ status: 200, body: key }]);
    const check = await run(['--check-key'], fetchImpl);
    assert.equal(check.code, 0, check.err);
    assert.equal(calls.length, 1);
    assert.match(check.out, /key file is live/);
  });

  it('rejects incomplete or conflicting arguments with exit code 2', async () => {
    for (const argv of [
      [],
      ['--from', 'HEAD'],
      ['--before-dir', repoRoot],
      ['--from', 'HEAD', '--to', 'HEAD', '--before-dir', repoRoot, '--after-dir', repoRoot],
      ['--check-key', '/grade-7'],
      ['--check-key', '--submit'],
      ['--unknown'],
      ['--urls-file'],
    ]) {
      const result = await run(argv, fakeFetch([]).fetchImpl);
      assert.equal(result.code, 2, argv.join(' '));
    }
  });

  it('runs as a command without any network call in dry-run mode', () => {
    const noNetwork = 'data:text/javascript,globalThis.fetch=()=>{throw new Error("network used")}';
    const result = spawnSync(process.execPath, ['--import', noNetwork, script, '/powers-grade-7'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /IndexNow dry run: nothing was sent/);
    assert.match(result.stdout, /"https:\/\/www\.noamdoronmath\.co\.il\/powers-grade-7"/);
  });
});
