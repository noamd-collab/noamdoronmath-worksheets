import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './landing-corrections-20261118.json';

export { reviewed as reviewedLandingCorrections };
export const reviewedLandingCorrectionSlugs = reviewed.pages.map(page => page.slug);
const ISOLATES = /[⁦-⁩]/g;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

function mapStrings(value: any, fn: (text: string) => string): any {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map(item => mapStrings(item, fn));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)]));
  return value;
}
function occurrences(value: any, needle: string): number {
  let n = 0;
  mapStrings(value, text => { n += text.replace(ISOLATES, '').split(needle).length - 1; return text; });
  return n;
}

/**
 * 18 Nov 2026 corrections of live landing copy, after the independent Antigravity landing audit.
 * Reverse exactly these replacements (corrected text back to the reviewed original) before
 * every older landing fence. A page must carry every corrected text exactly as often as
 * recorded; a page that already carries every original text exactly as often (an older
 * fence was reached by another path) passes unchanged. Anything else fails.
 */
export function beforeLandingCorrections<T>(slug: string, page: T): T {
  const entry = reviewed.pages.find(item => item.slug === slug);
  if (!entry) return page;
  const corrected = entry.replacements.every(r => occurrences(page, r.after) === r.count);
  if (!corrected) {
    const reversed = entry.replacements.every(r => occurrences(page, r.before) === r.beforeCount);
    assert.ok(reversed, `${slug}: landing corrections are neither fully applied nor fully reversed`);
    return page;
  }
  let restored: any = structuredClone(page);
  for (const r of [...entry.replacements].reverse()) {
    restored = mapStrings(restored, text => {
      const plain = text.replace(ISOLATES, '');
      return plain.includes(r.after) ? plain.split(r.after).join(r.before) : text;
    });
  }
  return restored;
}

/** Apply this page's corrections to one text of an older reviewed fixture (original -> corrected). */
export function afterLandingCorrections(slug: string, text: string): string {
  const entry = reviewed.pages.find(item => item.slug === slug);
  if (!entry) return text;
  return entry.replacements.reduce((out, r) => out.split(r.before).join(r.after), text);
}

/** The raw committed page must be exactly the reviewed corrected page. */
export function assertCorrectedRawPage(slug: string, raw: unknown) {
  const entry = reviewed.pages.find(item => item.slug === slug);
  if (!entry) return;
  assert.equal(digest(raw), entry.correctedSha256, `${slug}: exact corrected page`);
  assert.equal(digest(beforeLandingCorrections(slug, raw)), entry.baselineSha256, `${slug}: exact page before the corrections`);
}
