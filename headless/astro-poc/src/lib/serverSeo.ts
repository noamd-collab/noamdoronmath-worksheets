/**
 * Keep the site's authored metadata when Wix adds its dashboard defaults.
 * @wix/astro registers HTML embeds as post middleware, so application middleware
 * sees its injected response after `await next()`. Only the head is buffered;
 * the document body and non-HTML responses are passed through unchanged.
 */
const MAX_HEAD_BYTES = 256 * 1024;
const encoder = new TextEncoder();
// Keep a UTF-8 BOM in the decoded prefix so character-to-byte accounting includes it.
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });

type HeadTag = { start: number; end: number; key: string; owned: boolean; wix: boolean };

function tagEnd(html: string, start: number): number {
  let quote = '';
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') return i + 1;
  }
  return -1;
}

function attributes(openingTag: string): Map<string, string> {
  const values = new Map<string, string>();
  const source = openingTag.replace(/^<\/?[\w:-]+/, '').replace(/\/?\s*>$/, '');
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    values.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return values;
}

/** Read complete HTML tokens, skipping comments and raw-text script/style/title. */
function scanHead(html: string): { end: number; tags: HeadTag[] } | undefined {
  let cursor = 0;
  let inHead = false;
  const tags: HeadTag[] = [];
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) return undefined;
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end < 0) return undefined;
      cursor = end + 3;
      continue;
    }
    const openingEnd = tagEnd(html, start + 1);
    if (openingEnd < 0) return undefined;
    const openingTag = html.slice(start, openingEnd);
    const nameMatch = /^<(\/?)([a-z][\w:-]*)\b/i.exec(openingTag);
    cursor = openingEnd;
    if (!nameMatch) continue;
    const closing = nameMatch[1] === '/';
    const name = nameMatch[2].toLowerCase();
    if (name === 'head') {
      if (closing && inHead) return { end: openingEnd, tags };
      inHead = !closing;
      continue;
    }
    if (closing) continue;
    if (name === 'script' || name === 'style' || name === 'title') {
      const close = new RegExp(`</${name}\\s*>`, 'gi');
      close.lastIndex = openingEnd;
      const match = close.exec(html);
      if (!match) return undefined;
      cursor = match.index + match[0].length;
    }
    if (!inHead || !['title', 'meta', 'link'].includes(name)) continue;
    const attrs = attributes(openingTag);
    const key = name === 'title'
      ? 'title'
      : name === 'link'
        ? (attrs.get('rel')?.toLowerCase().split(/\s+/).includes('canonical') ? 'canonical' : '')
        : `meta:${(attrs.get('name') || attrs.get('property') || '').toLowerCase()}`;
    if (!key || key === 'meta:') continue;
    tags.push({
      start, end: cursor, key,
      owned: attrs.has('data-noam-seo'),
      wix: attrs.get('wix-seo-tag')?.toLowerCase() === 'true',
    });
  }
  return undefined;
}

function removeDuplicates(head: string, tags: HeadTag[]): string {
  const owned = new Set(tags.filter((tag) => tag.owned && !tag.wix).map((tag) => tag.key));
  let result = head;
  // Work backwards so original token offsets remain valid.
  for (const tag of [...tags].reverse()) {
    if (tag.wix && owned.has(tag.key)) result = result.slice(0, tag.start) + result.slice(tag.end);
  }
  return result;
}

export function deduplicateSeoResponse(response: Response): Response {
  if (!response.body || !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
    return response;
  }
  // Wix injects into the uncompressed stream. Never interpret encoded bytes.
  const encoding = response.headers.get('content-encoding');
  if (encoding && encoding !== 'identity') return response;
  let pending = new Uint8Array(0);
  let done = false;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (done) {
        controller.enqueue(chunk);
        return;
      }
      const combined = new Uint8Array(pending.length + chunk.length);
      combined.set(pending);
      combined.set(chunk, pending.length);
      pending = combined;
      const html = decoder.decode(pending.subarray(0, MAX_HEAD_BYTES));
      const head = scanHead(html);
      if (head) {
        const original = html.slice(0, head.end);
        // A non-UTF-8 head cannot be safely mapped back to byte offsets.
        if (original.includes('\uFFFD')) {
          controller.enqueue(pending);
          pending = new Uint8Array(0);
          done = true;
          return;
        }
        const headByteLength = encoder.encode(original).length;
        const cleaned = removeDuplicates(original, head.tags);
        controller.enqueue(encoder.encode(cleaned));
        // Preserve every byte after </head>, including binary/invalid UTF-8 bytes.
        if (pending.length > headByteLength) controller.enqueue(pending.subarray(headByteLength));
        pending = new Uint8Array(0);
        done = true;
      } else if (pending.length >= MAX_HEAD_BYTES) {
        // Unexpected/malformed/very large heads fail open, without truncation.
        controller.enqueue(pending);
        pending = new Uint8Array(0);
        done = true;
      }
    },
    flush(controller) {
      if (pending.length) controller.enqueue(pending);
    },
  });
  const headers = new Headers(response.headers);
  // These validators describe the pre-transform payload; other headers survive.
  for (const name of ['content-length', 'etag', 'content-md5', 'digest']) headers.delete(name);
  return new Response(response.body.pipeThrough(stream), {
    status: response.status, statusText: response.statusText, headers,
  });
}
