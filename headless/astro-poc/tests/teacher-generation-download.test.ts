import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import { handleTeacherGeneration, type GenerationDependencies } from '../src/lib/teacherGeneration';
import { TEACHER_ACCESS_CONFIG } from '../src/lib/teacherAccessConfig';
import { resolveTestBrowser } from './helpers/chromium';

test('isolated Chromium downloads both private attachments from ordinary links', { timeout: 30000 }, async t => {
  const id = '22222222-2222-4222-8222-222222222222';
  const owner = TEACHER_ACCESS_CONFIG.ownerUserId;
  const bytes = { pdf: Buffer.from('%PDF-1.4\nlocal attachment fixture\n%%EOF'), docx: Buffer.from('local DOCX transport fixture') };
  const calls: string[] = [];
  // Only in-process auth/storage substitutes: no credentials, model, CAPTCHA,
  // Supabase, served application bypass, or user browser profile is involved.
  const deps: GenerationDependencies = {
    authorize: async () => { calls.push('auth'); return { ok: true, userId: owner, expiresAt: 2e9 }; },
    store: {
      get: async received => { assert.equal(received, id); calls.push('get'); return { status: 'needs_review', result: { automatedChecksPassed: true } }; },
      download: async (user, received, kind) => {
        assert.equal(user, owner); assert.equal(received, id); calls.push('download:' + kind);
        return new Response(bytes[kind], { headers: { 'content-length': String(bytes[kind].length) } });
      },
    } as GenerationDependencies['store'],
    loadCurriculum: async () => { throw Error('unexpected curriculum access'); },
    verifyBot: async () => { throw Error('unexpected CAPTCHA access'); },
  };
  const directory = await mkdtemp(join(tmpdir(), 'teacher-download-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let origin = '';
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      if (request.url === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><a id="pdf" href="/api/teacherGeneration?id=' + id + '&file=pdf">PDF</a><a id="docx" href="/api/teacherGeneration?id=' + id + '&file=docx">Word</a>');
        return;
      }
      if (!request.url?.startsWith('/api/teacherGeneration?')) { response.writeHead(404).end(); return; }
      const result = await handleTeacherGeneration(new Request(origin + request.url), deps);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch { response.writeHead(500).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  const browser = await puppeteer.launch({ executablePath: resolveTestBrowser(), headless: true });
  t.after(() => browser.close());
  t.diagnostic(await browser.version());
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => { void (new URL(request.url()).origin === origin ? request.continue() : request.abort()); });
  const session = await browser.target().createCDPSession();
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory, eventsEnabled: true });
  await page.goto(origin, { waitUntil: 'load' });
  for (const kind of ['pdf', 'docx'] as const) {
    const completed = new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); session.off('Browser.downloadProgress', onProgress); };
      const onProgress = (event: { state: string }) => {
        if (event.state === 'completed') { cleanup(); resolve(); }
        if (event.state === 'canceled') { cleanup(); reject(Error('attachment download canceled')); }
      };
      const timer = setTimeout(() => { cleanup(); reject(Error('attachment download did not complete')); }, 8000);
      session.on('Browser.downloadProgress', onProgress);
    });
    await Promise.all([completed, page.click('#' + kind)]);
    assert.deepEqual(await readFile(join(directory, `worksheet-${id}.${kind}`)), bytes[kind]);
    assert.equal(page.url(), origin + '/', 'attachment leaves the teacher page in place');
  }
  assert.deepEqual(calls, ['auth', 'get', 'download:pdf', 'auth', 'get', 'download:docx']);
});
