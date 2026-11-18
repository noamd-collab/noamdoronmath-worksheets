import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './ramzi-activation-copy-20261119.json';

export { reviewed as reviewedRamziActivationCopy };
const ISOLATES = /[⁦-⁩]/g;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
type Path = Array<string | number>;

function holder(page: any, path: Path): { parent: any; key: string | number } | null {
  let node = page;
  for (const key of path.slice(0, -1)) {
    if (node == null || !(key in Object(node))) return null;
    node = node[key];
  }
  const key = path[path.length - 1];
  return node != null && typeof node[key] === 'string' ? { parent: node, key } : null;
}
const plainAt = (page: any, path: Path) => {
  const h = holder(page, path);
  return h ? String(h.parent[h.key]).replace(ISOLATES, '') : null;
};

/**
 * 19 Nov 2026: landing copy after the additional reviewed Ramzi activation. Reverse exactly
 * these field replacements (corrected text back to the earlier text) before every older
 * landing fence. A page must carry every corrected text exactly once in its recorded field;
 * a page that carries none of them (already reversed, or an older fence was reached by
 * another path) passes unchanged; a page that carries only some of them fails. The exact
 * committed pages are pinned separately by assertRamziActivationCopyRawPage.
 */
export function beforeRamziActivationCopy<T>(slug: string, page: T): T {
  const entry = reviewed.pages.find(item => item.slug === slug);
  if (!entry) return page;
  const present = entry.replacements.filter(r => plainAt(page, r.path as Path) !== null);
  assert.ok(present.length > 0, `${slug}: no recorded Ramzi activation copy field is present`);
  const carries = present.map(r => plainAt(page, r.path as Path)!.split(r.after).length - 1);
  if (carries.every(n => n === 0)) {
    // Already reversed, or an older fence already unwound the text these fields replaced
    // (older layers that wrote the earlier text are reversed by their own fences).
    return page;
  }
  assert.ok(carries.every(n => n === 1), `${slug}: Ramzi activation copy is neither fully applied nor fully reversed`);
  const restored: any = structuredClone(page);
  for (const r of [...present].reverse()) {
    const h = holder(restored, r.path as Path)!;
    h.parent[h.key] = String(h.parent[h.key]).replace(ISOLATES, '').split(r.after).join(r.before);
  }
  return restored;
}

/** Apply this page's corrections to one text of an older reviewed fixture (earlier -> corrected). */
export function afterRamziActivationCopy(slug: string, text: string): string {
  const entry = reviewed.pages.find(item => item.slug === slug);
  if (!entry) return text;
  return entry.replacements.reduce((out, r) => out.split(r.before).join(r.after), text);
}

/** The raw committed page must be exactly the reviewed corrected page. */
export function assertRamziActivationCopyRawPage(slug: string, raw: unknown) {
  const entry = reviewed.pages.find(item => item.slug === slug);
  if (!entry) return;
  assert.equal(digest(raw), entry.correctedSha256, `${slug}: exact corrected page`);
  assert.equal(digest(beforeRamziActivationCopy(slug, raw)), entry.baselineSha256, `${slug}: exact page before the correction`);
}
