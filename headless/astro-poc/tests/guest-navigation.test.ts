/**
 * HEADLESS-MIGRATION-14 — guest navigation / routing regression gates.
 * Ensures catalog→viewer→learning→home links stay on the isolated preview.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import {
  buildWorksheetHref,
  PUBLIC_USE_HEADLESS_VIEWER,
  PUBLIC_WORKSHEETS_BASE,
} from '../src/lib/worksheetLinks.ts';
import { LEGACY_GITHUB_CATALOG, viewerBackHref } from './viewer-back-href.ts';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const catalog = loadCatalog();

function topicByPrefix(grade: number, prefix: string) {
  const g = catalog.grades.find((x) => x.grade === grade)!;
  const topic = g.topics.find((t) => t.routing?.resolvedNoamPrefix === prefix);
  assert.ok(topic, `missing ${prefix}`);
  return topic!;
}

describe('guest navigation routing (HEADLESS-MIGRATION-14)', () => {
  it('learning.html brand/home points at preview root, catalog at /worksheets', () => {
    const html = readFileSync(join(pub, 'learning.html'), 'utf8');
    assert.ok(html.includes('class="nl-brand" href="/"'));
    assert.ok(!html.includes('class="nl-brand" href="https://www.noamdoronmath.co.il/"'));
    assert.ok(html.includes('href="/worksheets">לכל דפי העבודה'));
    // Policy mailto / accessibility may remain production; brand must not.
  });

  it('viewer accepts back=/learning.html and back=/ for same-origin return', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    assert.ok(html.includes('catalogReturn.pathname === "/learning.html"'));
    assert.ok(html.includes('catalogReturn.pathname === "/"'));
    assert.ok(html.includes('catalogReturn.pathname === "/worksheets"'));
    // URGENT-46: managed hosts must not follow github.io legacy back=
    assert.ok(html.includes('isHeadlessHost'));
    assert.ok(html.includes('!isHeadlessHost'));
    assert.ok(html.includes('isManagedViewerHost'));
  });

  it('rejects github.io back= on production, apex, Headless preview, and localhost', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    const hosts = [
      'www.noamdoronmath.co.il',
      'noamdoronmath.co.il',
      'pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com',
      'localhost',
      '127.0.0.1',
    ];
    for (const hostname of hosts) {
      const href = viewerBackHref(html, { hostname, back: LEGACY_GITHUB_CATALOG });
      assert.ok(!href.includes('github.io'), `${hostname} followed ${href}`);
      assert.equal(href, '/worksheets?grade=7');
    }
  });

  it('rejects legacy /noamdoronmath-worksheets and protocol-relative github.io backs on production', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    const backs = [
      '/noamdoronmath-worksheets/?grade=7',
      '//noamd-collab.github.io/noamdoronmath-worksheets/?grade=7',
      'https://evil.noamdoronmath.co.il/worksheets?grade=7',
      'https://www.noamdoronmath.co.il.evil/worksheets?grade=7',
    ];
    for (const back of backs) {
      for (const hostname of ['www.noamdoronmath.co.il', 'noamdoronmath.co.il']) {
        const href = viewerBackHref(html, { hostname, back });
        assert.ok(!href.includes('github.io'), `${hostname} ${back} -> ${href}`);
        assert.ok(!href.includes('evil'), `${hostname} ${back} -> ${href}`);
        assert.equal(href, '/worksheets?grade=7');
      }
    }
  });

  it('keeps same-site catalog returns and allowlisted cross-host returns', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    const www = 'www.noamdoronmath.co.il';
    assert.equal(
      viewerBackHref(html, { hostname: www, back: '/worksheets?grade=7&q=alg' }),
      'https://www.noamdoronmath.co.il/worksheets?grade=7&q=alg'
    );
    assert.equal(
      viewerBackHref(html, { hostname: www, back: '/learning.html' }),
      'https://www.noamdoronmath.co.il/learning.html'
    );
    assert.equal(
      viewerBackHref(html, { hostname: www, back: '/' }),
      'https://www.noamdoronmath.co.il/'
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: www,
        back: 'https://noamdoronmath.co.il/worksheets?grade=8',
        g: 8,
      }),
      'https://noamdoronmath.co.il/worksheets?grade=8'
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: 'preview.wix-site-host.com',
        back: 'https://www.noamdoronmath.co.il/worksheets?grade=7',
      }),
      'https://www.noamdoronmath.co.il/worksheets?grade=7'
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: 'noamdoronmath.co.il',
        back: 'https://www.noamdoronmath.co.il/worksheets?grade=7',
      }),
      'https://www.noamdoronmath.co.il/worksheets?grade=7'
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: www,
        back: 'https://noamdoronmath.co.il/worksheets/grade-7',
      }),
      'https://noamdoronmath.co.il/worksheets/grade-7'
    );
    // Viewer served from GitHub Pages itself: same-origin catalog return stays.
    assert.ok(
      viewerBackHref(html, {
        hostname: 'noamd-collab.github.io',
        pathname: '/noamdoronmath-worksheets/worksheet-viewer-noam.html',
        back: '/noamdoronmath-worksheets/?grade=7',
      }).includes('github.io')
    );
    // Hosts outside the allowlist keep the legacy catalog branch (rollback).
    assert.ok(
      viewerBackHref(html, {
        hostname: 'notnoamdoronmath.co.il',
        back: LEGACY_GITHUB_CATALOG,
      }).includes('github.io')
    );
  });

  it('wix preview back= allows only the production pair or the same host', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    const preview = 'pqdrcz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
    const other = 'preview.wix-site-host.com';
    assert.equal(
      viewerBackHref(html, {
        hostname: preview,
        back: 'https://www.noamdoronmath.co.il/worksheets?grade=7',
      }),
      'https://www.noamdoronmath.co.il/worksheets?grade=7'
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: preview,
        back: 'https://noamdoronmath.co.il/worksheets?grade=8',
        g: 8,
      }),
      'https://noamdoronmath.co.il/worksheets?grade=8'
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: preview,
        back: `https://${preview}/worksheets?grade=7&q=alg`,
      }),
      `https://${preview}/worksheets?grade=7&q=alg`
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: preview,
        back: `http://${preview}/worksheets?grade=7`,
      }),
      `http://${preview}/worksheets?grade=7`
    );
    assert.equal(
      viewerBackHref(html, {
        hostname: preview,
        back: `https://${preview.toUpperCase()}/worksheets/grade-7`,
      }),
      `https://${preview}/worksheets/grade-7`
    );
    const rejected = [
      `https://${other}/worksheets?grade=7`,
      'https://other.wix-site-host.com/worksheets',
      'http://localhost/worksheets',
      'https://127.0.0.1/worksheets?grade=7',
      LEGACY_GITHUB_CATALOG,
      '/worksheetsEvil',
    ];
    for (const back of rejected) {
      const href = viewerBackHref(html, { hostname: preview, back });
      assert.equal(href, '/worksheets?grade=7', `${back} -> ${href}`);
      assert.ok(!href.includes('github.io'), href);
    }
    assert.equal(
      viewerBackHref(html, {
        hostname: 'localhost',
        back: 'https://www.noamdoronmath.co.il/worksheets?grade=7',
      }),
      'https://www.noamdoronmath.co.il/worksheets?grade=7'
    );
  });

  it('www and apex reject wix-site-host, localhost, and /worksheetsEvil as back=', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    const rejected = [
      'https://anything.wix-site-host.com/worksheets',
      'https://preview.wix-site-host.com/worksheets?grade=7',
      'http://localhost/worksheets',
      'https://localhost/worksheets?grade=7',
      'http://127.0.0.1/worksheets',
      'https://www.noamdoronmath.co.il/worksheetsEvil',
      'https://noamdoronmath.co.il/worksheetsEvil?grade=7',
      '/worksheetsEvil',
    ];
    for (const hostname of ['www.noamdoronmath.co.il', 'noamdoronmath.co.il']) {
      for (const back of rejected) {
        const href = viewerBackHref(html, { hostname, back });
        assert.equal(href, '/worksheets?grade=7', `${hostname} ${back} -> ${href}`);
      }
    }
  });

  it('classic Wix viewer still accepts only same-origin catalog returns', () => {
    const classic = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'worksheet-viewer-noam.html'),
      'utf8'
    );
    assert.ok(classic.includes('catalogReturn.origin === location.origin'));
    assert.ok(!classic.includes('isManagedViewerHost'));
    assert.ok(!classic.includes('HEADLESS_LEGACY_PAGES'));
  });

  it('representative G7/G8/G9 viewer prefixes remain catalog-routable', () => {
    for (const [grade, prefix] of [
      [7, 'G7-T08'],
      [8, 'G8-T38'],
      [9, 'G9-T20'],
    ] as const) {
      const topic = topicByPrefix(grade, prefix);
      assert.equal(topic.routing.usesViewer, true);
      const level = topic.levels.find((l) => l.key === 'a') || topic.levels[0];
      const href = buildWorksheetHref({
        catalog,
        grade,
        topic,
        levelKey: level.key,
      });
      // Default test env keeps rollback OFF (GitHub). Preview build flips the flag.
      if (PUBLIC_USE_HEADLESS_VIEWER) {
        assert.ok(
          href.startsWith('/worksheet-viewer-noam.html') ||
            href.includes('/worksheet-viewer-noam.html')
        );
      } else {
        assert.ok(href.startsWith(PUBLIC_WORKSHEETS_BASE));
      }
      const u = new URL(href, 'https://headless-viewer.local/');
      assert.equal(u.searchParams.get('g'), String(grade));
      assert.equal(u.searchParams.get('x'), prefix);
      assert.ok(u.searchParams.get('pdf'));
      assert.ok(u.searchParams.get('back'));
    }
  });

  it('elementary grade links stay on Wix Media PDF (not viewer)', () => {
    const g1 = catalog.grades.find((x) => x.grade === 1)!;
    const topic = g1.topics.find((t) => !t.routing.usesViewer && t.levels[0])!;
    const href = buildWorksheetHref({
      catalog,
      grade: 1,
      topic,
      levelKey: topic.levels[0].key,
    });
    assert.ok(href.startsWith('https://static.wixstatic.com/ugd/'));
    assert.ok(!href.includes('noamdoronmath.co.il/_files/'));
    assert.ok(href.endsWith('.pdf'));
    assert.ok(!href.includes('worksheet-viewer-noam.html'));
  });
});
