/**
 * Documented content corrections (src/data/content-corrections.json).
 * Production fixtures stay as captured; parity checks apply these corrections first,
 * so a reviewed correction passes and any other drift from production still fails.
 */
import corrections from '../../data/content-corrections.json';

export type ContentCorrection =
  | { before: string; after: string; kind?: string; reason: string }
  | { swap: [string, string]; reason: string };

type CorrectionFile = {
  topicPages: Record<string, ContentCorrection[]>;
  blogPosts: Record<string, ContentCorrection[]>;
};

const data = corrections as unknown as CorrectionFile;

export function topicPageCorrections(slug: string): ContentCorrection[] {
  return data.topicPages[slug] || [];
}

export function blogPostCorrections(fileSlug: string): ContentCorrection[] {
  return data.blogPosts[fileSlug] || [];
}

function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapStrings(v, fn);
    return out as T;
  }
  return value;
}

/** Apply corrections to every string in a snapshot (longest `before` first, swaps last). */
export function applyContentCorrections<T>(value: T, list: ContentCorrection[]): T {
  let out = value;
  const replaces = list
    .filter((c): c is Extract<ContentCorrection, { before: string }> => 'before' in c)
    .sort((a, b) => b.before.length - a.before.length);
  for (const c of replaces) out = mapStrings(out, (s) => s.split(c.before).join(c.after));
  for (const c of list) {
    if (!('swap' in c)) continue;
    const [a, b] = c.swap;
    const mark = '\u0000swap\u0000';
    out = mapStrings(out, (s) => s.split(a).join(mark).split(b).join(a).split(mark).join(b));
  }
  return out;
}
