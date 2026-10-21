import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  checkInternalLinks,
  extractReferences,
  isBrokenStatus,
  resolveInternal,
  routesFromPagesDir,
} from './check-internal-links.mjs';

describe('resolveInternal', () => {
  const origin = 'http://127.0.0.1:4321';
  const from = `${origin}/grade-9`;

  it('keeps same-origin links and drops the hash', () => {
    assert.equal(resolveInternal('/worksheets?grade=9#top', from, origin), `${origin}/worksheets?grade=9`);
    assert.equal(resolveInternal('terms', from, origin), `${origin}/terms`);
  });

  it('ignores external, mail, and empty links', () => {
    assert.equal(resolveInternal('https://example.com/a', from, origin), null);
    assert.equal(resolveInternal('mailto:a@b.c', from, origin), null);
    assert.equal(resolveInternal('#section', from, origin), null);
    assert.equal(resolveInternal('//cdn.example/x', from, origin), null);
  });
});

describe('extractReferences', () => {
  it('reads href, src, and srcset urls', () => {
    const html = `<a href="/grade-9">ג</a><img src="/a.webp" srcset="/a.webp 1x, /b.webp 2x"><link href='/site.css'>`;
    assert.deepEqual(extractReferences(html), ['/grade-9', '/a.webp', '/site.css', '/a.webp', '/b.webp']);
  });

  it('ignores urls that appear only inside scripts', () => {
    const html = `<a href="/real">ok</a><script>link.href=pdfUrl; location.href='/not-a-link';</script>`;
    assert.deepEqual(extractReferences(html), ['/real']);
  });
});

describe('isBrokenStatus', () => {
  it('accepts redirects and soft API responses, rejects 404', () => {
    assert.equal(isBrokenStatus('http://127.0.0.1/grade-9', 200), false);
    assert.equal(isBrokenStatus('http://127.0.0.1/old', 301), false);
    assert.equal(isBrokenStatus('http://127.0.0.1/missing', 404), true);
    assert.equal(isBrokenStatus('http://127.0.0.1/api/contact-form', 405), false);
    assert.equal(isBrokenStatus('http://127.0.0.1/api/missing', 404), true);
  });
});

describe('routesFromPagesDir', () => {
  it('maps page files and skips dynamic and api routes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pages-'));
    mkdirSync(join(dir, 'blog'));
    mkdirSync(join(dir, 'api'));
    mkdirSync(join(dir, 'post'));
    writeFileSync(join(dir, 'index.astro'), '');
    writeFileSync(join(dir, 'grade-9.astro'), '');
    writeFileSync(join(dir, 'blog', 'index.astro'), '');
    writeFileSync(join(dir, 'api', 'contact-form.ts'), '');
    writeFileSync(join(dir, 'post', '[...slug].astro'), '');
    assert.deepEqual(routesFromPagesDir(dir).sort(), ['/', '/blog', '/grade-9']);
  });
});

describe('checkInternalLinks', () => {
  it('fails on a broken internal link and ignores external urls', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/') {
        res.setHeader('content-type', 'text/html');
        res.end('<a href="/ok">ok</a><a href="/missing">no</a><a href="https://example.com/out">out</a>');
        return;
      }
      if (req.url === '/ok') {
        res.setHeader('content-type', 'text/html');
        res.end('<img src="/pixel.png">');
        return;
      }
      if (req.url === '/pixel.png') {
        res.setHeader('content-type', 'image/png');
        res.end('x');
        return;
      }
      res.statusCode = 404;
      res.end('missing');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    try {
      const result = await checkInternalLinks({ base, seeds: ['/'] });
      assert.equal(result.broken.length, 1);
      assert.equal(new URL(result.broken[0].url).pathname, '/missing');
      assert.equal(result.checked >= 3, true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('does not fail an unlinked seed that is intentionally not found', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/') {
        res.setHeader('content-type', 'text/html');
        res.end('<a href="/ok">ok</a>');
        return;
      }
      if (req.url === '/ok') {
        res.setHeader('content-type', 'text/html');
        res.end('ok');
        return;
      }
      res.statusCode = 404;
      res.end('missing');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      const result = await checkInternalLinks({
        base: `http://127.0.0.1:${port}`,
        seeds: ['/', '/dev-loops'],
      });
      assert.deepEqual(result.broken, []);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
