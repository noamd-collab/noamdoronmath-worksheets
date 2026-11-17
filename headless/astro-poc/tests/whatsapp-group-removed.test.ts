/**
 * Noam, 2026-11-15: the WhatsApp group was removed from the site.
 * Guard against it coming back through data, footer, home page or legal texts.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GROUP = /chat\.whatsapp\.com/i;
const HEBREW = /וואטסאפ|ווטסאפ|וואצאפ/;

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full, ext));
    else if (ext.test(name)) out.push(full);
  }
  return out;
}

describe('WhatsApp group removed', () => {
  it('no site data links to or mentions the WhatsApp group', () => {
    const hits = files(join(root, 'src', 'data'), /\.(json|html)$/)
      .filter((f) => !f.endsWith('companion-worker-data.json'))
      .filter((f) => {
        const text = readFileSync(f, 'utf8');
        return GROUP.test(text) || HEBREW.test(text) || /"whatsapp"\s*:/.test(text);
      })
      .map((f) => relative(root, f));
    assert.deepEqual(hits, []);
  });

  it('home page, shared footer and learning page have no WhatsApp group link', () => {
    for (const file of ['src/pages/index.astro', 'src/components/SiteFooter.astro', 'public/learning.html']) {
      const text = readFileSync(join(root, file), 'utf8');
      assert.ok(!GROUP.test(text), file);
      assert.ok(!HEBREW.test(text), file);
    }
  });

  it('the Noam AI site guide has no WhatsApp record', () => {
    const guide = JSON.parse(readFileSync(join(root, 'src', 'data', 'site-guide.v1.json'), 'utf8'));
    const records: Array<{ id?: string; href?: string }> = guide.records || [];
    assert.ok(records.length > 0);
    assert.ok(!records.some((r) => r.id === 'page-whatsapp' || GROUP.test(r.href || '')));
  });
});
