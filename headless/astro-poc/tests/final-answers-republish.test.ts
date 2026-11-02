/**
 * Noam, 2026-11-02: grade 7-9 sheets that had no final-answers page were
 * republished as new Wix PDFs that repeat the same question pages and add the
 * final answers. Each new manifest is the original manifest with only the PDF
 * id, the page count and questionPagesIdenticalTo changed, the catalog points
 * at the new PDF, and the original id redirects to it.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';

const pub = new URL('../public/', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, pub), 'utf8'));
const catalogText = readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8');
const migrations = json('noam-ai/catalog-migrations.json').byPdf;
const republished = readdirSync(new URL('noam-ai/manifests/', pub))
  .map((file) => json('noam-ai/manifests/' + file))
  .filter((m) => m.questionPagesIdenticalTo);

describe('sheets republished with final answers', () => {
  it('each new manifest repeats its original except id, page count and the question-page link', () => {
    assert.equal(republished.length, 401);
    for (const m of republished) {
      assert.equal(m.questionPagesIdenticalTo.length, 1, m.pdfHash);
      const [old] = m.questionPagesIdenticalTo;
      assert.notEqual(old, m.pdfHash);
      const original = json('noam-ai/manifests/' + old + '.json');
      assert.equal(original.pdfHash, old);
      assert.ok(m.pageCount > original.pageCount, m.pdfHash + ' adds answer pages');
      const strip = (x: any) => {
        const { pdfHash, pageCount, questionPagesIdenticalTo, ...rest } = x;
        return rest;
      };
      assert.deepEqual(strip(m), strip(original), m.pdfHash);
      // Root canonical copy and public mirror stay byte-identical.
      assert.equal(
        readFileSync(new URL('noam-ai/manifests/' + m.pdfHash + '.json', pub), 'utf8'),
        readFileSync(new URL('../../../noam-ai/manifests/' + m.pdfHash + '.json', import.meta.url), 'utf8'),
      );
    }
  });

  it('the catalog shows only the new PDFs, and each original id resolves to its replacement', () => {
    for (const m of republished) {
      const [old] = m.questionPagesIdenticalTo;
      assert.ok(catalogText.includes(m.pdfHash), m.pdfHash);
      assert.equal(catalogText.includes(old), false, old);
      assert.equal(migrations[old]?.pdfId, m.pdfHash, old);
      assert.ok(existsSync(new URL('teachers/sheets/' + m.pdfHash + '.json', pub)), 'teacher sheet ' + m.pdfHash);
    }
  });

  it('prepared Ramzi hints bound to the original PDF still load on the republished sheet', async () => {
    const code = readFileSync(new URL('noam-curated-hints.js', pub), 'utf8');
    const m = republished.find((x) => x.prefix && x.exercises?.length && /^(?:[ABE]|E2)$/.test(x.levelCode));
    assert.ok(m);
    const id = m.exercises.map((e: any) => e.id).find((x: string) => new RegExp('^' + m.prefix + '-(?:[ABE]|E2)-Q\\d{2}').test(x));
    const c: any = { Promise, AbortController, setTimeout, clearTimeout, NOAM_LEARNING_CONFIG: { url: 'https://example123.supabase.co', key: 'k' } };
    runInNewContext(code, c);
    const row = { exercise_id: id, hint_1: 'א', hint_2: 'ב', hint_3: 'ג', source_pdf_hash: m.questionPagesIdenticalTo[0], source_native_sha256: m.nativeExportSha256 || null };
    const fetch = async () => ({ ok: true, json: async () => [row] });
    assert.equal(await c.NoamCuratedHints.prefetch(m, { fetch }), 1);
  });

  it('approved source crops still apply to a republished sheet and keep cropping the original PDF', () => {
    const c: any = {};
    runInNewContext(readFileSync(new URL('noam-source-panels.js', pub), 'utf8'), c);
    const api = c.NoamSourcePanels;
    let checked = 0;
    for (const m of republished) {
      const original = json('noam-ai/manifests/' + m.questionPagesIdenticalTo[0] + '.json');
      for (const e of original.exercises || []) {
        if (!api.isReviewed(e)) continue;
        const before = api.approvedCrop(original, e);
        if (!before) continue;
        const after = api.approvedCrop(m, e);
        assert.ok(after, e.id);
        assert.equal(after.pdfId, original.pdfHash);
        assert.equal(after.pageCount, before.pageCount);
        checked++;
      }
    }
    assert.ok(checked > 0);
    // A page count equal to the original is not a republished sheet.
    const m = republished.find((x) => (json('noam-ai/manifests/' + x.questionPagesIdenticalTo[0] + '.json').exercises || []).some((e: any) => api.isReviewed(e)));
    const original = json('noam-ai/manifests/' + m.questionPagesIdenticalTo[0] + '.json');
    const e = original.exercises.find((x: any) => api.isReviewed(x) && api.approvedCrop(original, x));
    assert.equal(api.approvedCrop({ ...m, pageCount: original.pageCount }, e), null);
    assert.equal(api.approvedCrop({ ...m, questionPagesIdenticalTo: [] }, e), null);
  });
});
