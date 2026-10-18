/**
 * Hidden grade-7 angles practice page: reachable only by its direct URL.
 * Guards: not in the catalog, the page sitemap, llms.txt, the site guide or the
 * teacher pages; noindex in markup and header; manifests and PDFs line up.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const hidden = JSON.parse(read('src/data/hidden-practice.v1.json')) as {
  page: string;
  sheets: Array<{ pdfId: string; x: string; grade: number; level: string; title: string; questions: number }>;
};
const slug = hidden.page.split('/').pop() as string;
const pageFile = 'src/pages/practice-private/[slug].astro';

describe('hidden practice page', () => {
  it('is a dynamic [slug] route in a sub-folder, so neither the repo glob nor the Wix pages-sitemap lists it', () => {
    assert.ok(existsSync(join(root, pageFile)));
    assert.equal(read(pageFile).includes('Astro.url.pathname'), true);
    assert.equal(read(pageFile).includes(slug), false, 'the slug lives only in hidden-practice.v1.json');
    assert.ok(read('src/pages/sitemap-pages.xml.ts').includes("import.meta.glob('./*.astro')"));
    assert.equal(readdirSync(join(root, 'src/pages')).some((f) => f.includes(slug)), false);
  });

  it('is noindex in the markup and in the header, with no canonical', () => {
    const src = read(pageFile);
    assert.ok(src.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />'));
    assert.ok(src.includes("'X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet'"));
    assert.ok(src.includes('export const prerender = false'));
    assert.equal(src.includes('rel="canonical"'), false);
    assert.equal(src.includes('BaseLayout'), false);
  });

  it('is mentioned in no public index, catalog, guide, llms file or teacher page', () => {
    const needles = [slug, 'practice-private', ...hidden.sheets.map((s) => s.pdfId), 'G7-T91', 'G7-T92'];
    const publicFiles = [
      'src/data/catalog.v1.json',
      'src/data/site-guide.v1.json',
      'public/llms.txt',
      'public/robots.txt',
      'src/data/redirects.json',
    ];
    for (const f of publicFiles) {
      if (!existsSync(join(root, f))) continue;
      const text = read(f);
      for (const n of needles) assert.equal(text.includes(n), false, `${f} mentions ${n}`);
    }
    for (const f of readdirSync(join(root, 'src/pages'))) {
      if (!f.endsWith('.astro') && !f.endsWith('.ts')) continue;
      const text = read(`src/pages/${f}`);
      assert.equal(text.includes(slug), false, `src/pages/${f} links the hidden page`);
    }
    for (const dir of ['src/components', 'src/lib', 'src/layouts']) {
      for (const f of readdirSync(join(root, dir))) {
        if (!/\.(astro|ts|tsx)$/.test(f)) continue;
        assert.equal(read(`${dir}/${f}`).includes(slug), false, `${dir}/${f} links the hidden page`);
      }
    }
  });

  it('opens each worksheet in the standard viewer with a synced Noam AI manifest', () => {
    assert.equal(hidden.sheets.length, 2);
    for (const s of hidden.sheets) {
      assert.match(s.pdfId, /^[0-9a-f]{32}$/);
      assert.match(s.x, /^G7-T\d{2}$/);
      for (const dir of ['public/noam-ai/manifests', '../../noam-ai/manifests']) {
        const p = join(root, dir, `${s.pdfId}.json`);
        assert.equal(existsSync(p), true, `missing ${dir}/${s.pdfId}.json`);
        const m = JSON.parse(readFileSync(p, 'utf8'));
        assert.equal(m.schemaVersion, 2);
        assert.equal(m.pdfHash, s.pdfId);
        assert.equal(m.prefix, s.x);
        assert.equal(m.questionCount, s.questions);
        assert.equal(m.reviewRequired, false);
        assert.deepEqual(m.issues, []);
      }
    }
  });

  it('keeps manifests and provenance in sync (no fraction written with a slash)', () => {
    const prov = JSON.parse(read('public/noam-ai/sync-provenance.json'));
    for (const s of hidden.sheets) assert.ok(prov.files[s.pdfId], `provenance missing ${s.pdfId}`);
    const page = read(pageFile);
    assert.equal(/\d\s*\/\s*\d/.test(page), false);
  });
});
