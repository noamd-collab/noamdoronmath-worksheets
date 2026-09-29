/**
 * Server-side cleanup of duplicate SEO tags in the raw HTML <head>.
 *
 * Wix's main-page injection adds a parallel set of tags marked
 * wix-seo-tag="true" (title, canonical, og:title, og:site_name, twitter:title,
 * sometimes a WebSite JSON-LD) that carry the project name "Noam Math Astro POC".
 * When those tags pass through the Astro response, this removes them so a
 * crawler sees exactly one of each. Tags injected by the edge after Astro are
 * out of reach here; BaseLayout's stripWixSeoDupes stays as the client net.
 */
import { WIX_POC_SITE_NAME } from './siteSeo';

const TAG_RE =
  /<title\b[^>]*>[\s\S]*?<\/title>|<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>|<link\b[^>]*>|<meta\b[^>]*>/gi;

/** One of each is allowed. og:image is excluded: several images are valid Open Graph. */
const SINGLE_PROPERTIES = new Set(['og:title', 'og:url', 'og:site_name', 'og:description', 'og:type', 'og:locale']);
const SINGLE_NAMES = new Set(['description', 'robots', 'twitter:title', 'twitter:description', 'twitter:card']);
/** Removed whenever they carry the POC project name, even when single. */
const POC_KEYS = new Set(['p:og:site_name', 'n:twitter:title']);

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

function keyOf(tag: string): string | null {
  if (/^<title/i.test(tag)) return 'title';
  if (/^<script/i.test(tag)) return null;
  if (/^<link/i.test(tag)) return (attr(tag, 'rel') || '').toLowerCase() === 'canonical' ? 'canonical' : null;
  const property = (attr(tag, 'property') || '').toLowerCase();
  if (SINGLE_PROPERTIES.has(property)) return `p:${property}`;
  const name = (attr(tag, 'name') || '').toLowerCase();
  if (SINGLE_NAMES.has(name)) return `n:${name}`;
  return null;
}

type HeadTag = { start: number; end: number; text: string; key: string | null; wix: boolean };

/** Returns the HTML with duplicate / POC-branded SEO tags removed from <head>. */
export function dedupeHeadSeoTags(html: string): string {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd < 0) return html;
  const head = html.slice(0, headEnd);

  const tags: HeadTag[] = [];
  for (const m of head.matchAll(TAG_RE)) {
    const text = m[0];
    tags.push({
      start: m.index!,
      end: m.index! + text.length,
      text,
      key: keyOf(text),
      wix: /\swix-seo-tag\s*=/i.test(text),
    });
  }

  const drop = new Set<HeadTag>();
  for (const tag of tags) {
    if (/^<script/i.test(tag.text) && tag.text.includes(WIX_POC_SITE_NAME)) drop.add(tag);
    if (tag.key && POC_KEYS.has(tag.key) && tag.text.includes(WIX_POC_SITE_NAME)) drop.add(tag);
  }

  const byKey = new Map<string, HeadTag[]>();
  for (const tag of tags) {
    if (!tag.key || drop.has(tag)) continue;
    const list = byKey.get(tag.key) || [];
    list.push(tag);
    byKey.set(tag.key, list);
  }
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    const keep = list.find((t) => !t.wix) || list[0];
    for (const t of list) if (t !== keep) drop.add(t);
  }

  if (!drop.size) return html;
  let out = '';
  let cursor = 0;
  for (const tag of tags) {
    if (!drop.has(tag)) continue;
    out += head.slice(cursor, tag.start);
    cursor = tag.end;
  }
  return out + head.slice(cursor) + html.slice(headEnd);
}
