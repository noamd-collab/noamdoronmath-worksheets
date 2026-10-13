/**
 * HEADLESS-MIGRATION-33 — terms legal body parity vs authoritative HTML file.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { loadSitePage } from '../src/lib/sitePages.ts';

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

describe('terms legal body parity (M33)', () => {
  it('every authoritative sheet paragraph/heading/list item appears in rendered blocks', () => {
    const html = readFileSync('src/data/site-pages/authoritative/terms-legal.html', 'utf8');
    const sheet = html.match(/<div class="sheet">([\s\S]*)<\/div>\s*<\/body>/)?.[1] || '';
    assert.ok(sheet.length > 500);

    const page = loadSitePage('terms');
    const flat = page.blocks
      .map((b) => {
        if (b.type === 'ul' || b.type === 'ol') return b.items.map((i) => i.text).join('\n');
        if ('text' in b) return b.text;
        return '';
      })
      .join('\n');

    const headings = [...sheet.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)].map((m) =>
      stripTags(m[1])
    );
    for (const h of headings) {
      assert.ok(flat.includes(h), `missing heading: ${h}`);
    }

    const paras = [...sheet.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
    for (const p of paras) {
      assert.ok(p.length > 0);
      // Allow minor whitespace; require substantial prefix
      const needle = p.slice(0, Math.min(48, p.length));
      assert.ok(flat.includes(needle), `missing para: ${needle}`);
    }

    const lis = [...sheet.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1]));
    for (const li of lis) {
      assert.ok(flat.includes(li), `missing li: ${li.slice(0, 40)}`);
    }

    // Links preserved
    const hrefs = [...sheet.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h.includes('fonts.'));
    for (const href of hrefs) {
      const found = page.blocks.some(
        (b) => b.type === 'p' && b.segments?.some((s) => s.type === 'a' && s.href === href)
      );
      assert.ok(found, `missing link ${href}`);
    }

    assert.equal(
      page.blocks.some((b) => b.type === 'iframe'),
      false,
      'iframe must not remain in rendered blocks'
    );
  });
});
