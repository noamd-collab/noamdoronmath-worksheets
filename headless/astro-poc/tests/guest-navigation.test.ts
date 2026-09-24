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
