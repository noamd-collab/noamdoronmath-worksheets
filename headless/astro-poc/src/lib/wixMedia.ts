/**
 * Wix Media UGD helpers (HEADLESS-MIGRATION-36).
 *
 * Production historically served PDFs at:
 *   https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_<id>.pdf
 * The durable CDN equivalent (same bytes) is:
 *   https://static.wixstatic.com/ugd/d8e7ad_<id>.pdf
 *
 * Security: never trust substring matches (lookalike hosts / userinfo).
 * Parse with URL; allow only exact protocol+hostname+path conventions;
 * unrecognized input → fixed canonical CDN base (never echo raw).
 *
 * Never copy PDF bytes into the repo. No per-file ID exceptions.
 */

/** Site media library prefix embedded in every ugd filename for this brand. */
export const WIX_UGD_MEDIA_PREFIX = 'd8e7ad_';

/** Domain-independent Wix Media CDN base (includes media prefix, no trailing file). */
export const WIX_UGD_CDN_BASE = `https://static.wixstatic.com/ugd/${WIX_UGD_MEDIA_PREFIX}`;

/** Legacy site-relative path prefix (same media prefix). */
export const WIX_UGD_SITE_PATH_PREFIX = `/_files/ugd/${WIX_UGD_MEDIA_PREFIX}`;

/** Historical production absolute base (Studio frontend). */
export const WIX_UGD_LEGACY_SITE_BASE = `https://www.noamdoronmath.co.il${WIX_UGD_SITE_PATH_PREFIX}`;

const CDN_HOST = 'static.wixstatic.com';
const LEGACY_HOSTS = new Set(['www.noamdoronmath.co.il', 'noamdoronmath.co.il']);

/** 32-hex pdfId (catalog form, no media prefix). */
const PDF_ID_RE = /^[a-f0-9]{32}$/i;

/** CDN path: /ugd/d8e7ad_<32hex>.pdf */
const CDN_PDF_PATH_RE = new RegExp(
  `^/ugd/${WIX_UGD_MEDIA_PREFIX}([a-f0-9]{32})\\.pdf$`,
  'i'
);

/** Legacy site path: /_files/ugd/d8e7ad_<32hex>.pdf */
const SITE_PDF_PATH_RE = new RegExp(
  `^/_files/ugd/${WIX_UGD_MEDIA_PREFIX}([a-f0-9]{32})\\.pdf$`,
  'i'
);

/** Allowed pdfBase path forms (trailing media prefix, no file yet). */
const CDN_BASE_PATH = `/ugd/${WIX_UGD_MEDIA_PREFIX}`;
const SITE_BASE_PATH = `/_files/ugd/${WIX_UGD_MEDIA_PREFIX}`;

function hasUserinfo(u: URL): boolean {
  return u.username !== '' || u.password !== '';
}

function isDefaultHttpsPort(u: URL): boolean {
  return u.port === '' || u.port === '443';
}

function isSafeHttpsUrl(u: URL): boolean {
  return u.protocol === 'https:' && !hasUserinfo(u) && isDefaultHttpsPort(u);
}

/**
 * Build absolute PDF URL on Wix Media CDN from a catalog pdfId (32-hex, no prefix).
 * Optional search/hash preserved for download-style links.
 */
export function wixUgdPdfUrl(
  pdfId: string,
  queryAndHash: { search?: string; hash?: string } = {}
): string {
  const id = String(pdfId || '').replace(/\.pdf$/i, '').trim();
  if (!PDF_ID_RE.test(id)) {
    throw new Error(`Invalid pdfId for Wix UGD media: ${pdfId}`);
  }
  const u = new URL(`${WIX_UGD_CDN_BASE}${id}.pdf`);
  if (queryAndHash.search) {
    u.search = queryAndHash.search.startsWith('?')
      ? queryAndHash.search
      : `?${queryAndHash.search}`;
  }
  if (queryAndHash.hash) {
    u.hash = queryAndHash.hash.startsWith('#')
      ? queryAndHash.hash
      : `#${queryAndHash.hash}`;
  }
  return u.href;
}

/**
 * Normalize any known pdfBase shape to the fixed CDN base (cutover-safe).
 * Accepts exact:
 *   - https://static.wixstatic.com/ugd/d8e7ad_
 *   - https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_
 *   - https://noamdoronmath.co.il/_files/ugd/d8e7ad_
 *   - /_files/ugd/d8e7ad_
 * Never returns the input string. Lookalikes / junk → fixed canonical base.
 */
export function normalizePdfBase(pdfBase: string): string {
  const raw = String(pdfBase || '').trim();
  if (!raw) return WIX_UGD_CDN_BASE;

  // Exact relative legacy site base
  if (raw === SITE_BASE_PATH) return WIX_UGD_CDN_BASE;

  let u: URL;
  try {
    if (raw.startsWith('/')) {
      // Only the exact site base path is a supported relative convention
      u = new URL(raw, 'https://www.noamdoronmath.co.il');
      if (
        isSafeHttpsUrl(u) &&
        u.pathname === SITE_BASE_PATH &&
        u.search === '' &&
        u.hash === ''
      ) {
        return WIX_UGD_CDN_BASE;
      }
      return WIX_UGD_CDN_BASE;
    }
    u = new URL(raw);
  } catch {
    return WIX_UGD_CDN_BASE;
  }

  if (!isSafeHttpsUrl(u)) return WIX_UGD_CDN_BASE;

  // pdfBase must be path-only prefix (no query/hash, no extra segments)
  if (u.search !== '' || u.hash !== '') return WIX_UGD_CDN_BASE;

  const host = u.hostname.toLowerCase();
  if (host === CDN_HOST && u.pathname === CDN_BASE_PATH) {
    return WIX_UGD_CDN_BASE;
  }
  if (LEGACY_HOSTS.has(host) && u.pathname === SITE_BASE_PATH) {
    return WIX_UGD_CDN_BASE;
  }

  // Unrecognized — including lookalike hosts with CDN string in the path
  return WIX_UGD_CDN_BASE;
}

/**
 * Rewrite a full UGD PDF href to the canonical CDN URL.
 * Preserves query string and fragment when present.
 * Returns null if the href is not a supported UGD PDF convention.
 */
export function canonicalizeUgdPdfHref(href: string): string | null {
  const raw = String(href || '').trim();
  if (!raw) return null;

  // Reject traversal / encoded separators before URL normalizes them away
  if (/%2f|%5c|%2e|\.\.|\\/i.test(raw)) return null;

  const relative = raw.startsWith('/');
  let u: URL;
  try {
    u = relative ? new URL(raw, 'https://www.noamdoronmath.co.il') : new URL(raw);
  } catch {
    return null;
  }

  if (!isSafeHttpsUrl(u)) return null;

  const host = u.hostname.toLowerCase();
  let id: string | null = null;

  if (!relative && host === CDN_HOST) {
    // Exact CDN path only (URL.pathname is already decoded; still require clean raw)
    const m = u.pathname.match(CDN_PDF_PATH_RE);
    if (m) id = m[1];
  } else if (relative || LEGACY_HOSTS.has(host)) {
    // For relative: require raw path (pre-query) to match exactly — blocks /%2e%2e/… collapse
    if (relative) {
      const rawPath = raw.split(/[?#]/, 1)[0];
      const m = rawPath.match(SITE_PDF_PATH_RE);
      if (m) id = m[1];
    } else {
      const m = u.pathname.match(SITE_PDF_PATH_RE);
      if (m) id = m[1];
    }
  }

  if (!id) return null;

  const out = new URL(`${WIX_UGD_CDN_BASE}${id}.pdf`);
  out.search = u.search;
  out.hash = u.hash;
  return out.href;
}

/**
 * Map a request pathname (+ optional search) like `/_files/ugd/d8e7ad_<id>.pdf` → CDN URL.
 * Returns null if the path is not a compatible UGD PDF path.
 * Preserves query string when provided (e.g. download flags).
 */
export function redirectTargetForSiteUgdPath(
  pathname: string,
  search: string = ''
): string | null {
  const path = String(pathname || '');
  // Reject encoded separators / traversal / encoded dots before decode games
  if (/%2f|%5c|%2e|\.\.|\\/i.test(path)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (decoded !== path && /\/\/|\.\.|\\|%2f|%5c/i.test(decoded)) return null;

  const m = path.match(SITE_PDF_PATH_RE);
  if (!m) return null;

  const out = new URL(`${WIX_UGD_CDN_BASE}${m[1]}.pdf`);
  if (search) {
    out.search = search.startsWith('?') ? search : `?${search}`;
  }
  return out.href;
}
