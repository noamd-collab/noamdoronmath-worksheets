/**
 * OPEN-07 — narration audio for blog posts on the Headless POC.
 *
 * The audio itself is produced by the live-site pipeline (GitHub Actions + Gemini,
 * MP3 files on GitHub Pages, rows in the classic site's BlogPostAudio collection).
 * This module only asks the classic site's public `blogAudioInfo` endpoint whether a
 * post has audio. It never generates audio and never needs a secret.
 *
 * Why a server-side call and not the browser:
 *  - `blogAudioInfo` sends no Access-Control-Allow-Origin header and answers OPTIONS
 *    with 404, so a browser on any origin other than the classic site cannot read it.
 *  - After the domain moves to Headless, `www.noamdoronmath.co.il/_functions/*` is
 *    served by the Headless project, which has no Velo code. The classic site keeps
 *    answering at its free wixsite.com address, so that is the default base.
 */

/** Classic Wix site (36dd9544-…), free address — independent of the custom domain. */
export const DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE = 'https://amiramnoam.wixsite.com/my-site/_functions';

/** Hosts an audio `src` may point at. Anything else is dropped, never played. */
const AUDIO_HOSTS = new Set([
  'noamd-collab.github.io',
  'static.wixstatic.com',
  'video.wixstatic.com',
  'music.wixstatic.com',
]);

const OK_TTL_MS = 5 * 60_000;
const MISS_TTL_MS = 60_000;
const CACHE_MAX = 300;

export type BlogAudioInfo =
  | {
      available: true;
      slug: string;
      src: string;
      download: string;
      durationSec: number;
      voice?: string;
      model?: string;
      renderedAt?: string;
      stale?: boolean;
    }
  | { available: false; slug: string; reason: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function blogAudioFunctionsBase(env: Record<string, string | undefined> = readEnv()): string {
  const raw = (env.BLOG_AUDIO_FUNCTIONS_BASE || '').trim();
  if (!raw) return DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE;
  }
  if (u.protocol !== 'https:' || !/\/_functions(-dev)?\/?$/.test(u.pathname)) return DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE;
  return u.origin + u.pathname.replace(/\/$/, '');
}

function readEnv(): Record<string, string | undefined> {
  const fromImportMeta = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const fromProcess = proc?.env || {};
  return { ...fromProcess, ...fromImportMeta };
}

/** Post slugs are what the live site uses in `/post/<slug>`: Hebrew allowed, no separators. */
export function isValidAudioSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length > 0 && slug.length <= 300 && !/[\s/?#\\<>"']/.test(slug);
}

export function isAllowedAudioUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && AUDIO_HOSTS.has(u.hostname) && /\.mp3$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Reduces the upstream answer to fields the player needs; rejects anything unexpected. */
export function sanitizeBlogAudioInfo(slug: string, body: unknown): BlogAudioInfo {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (b.available !== true) {
    return { available: false, slug, reason: typeof b.reason === 'string' ? b.reason.slice(0, 80) : 'no audio' };
  }
  if (!isAllowedAudioUrl(b.src)) return { available: false, slug, reason: 'audio host not allowed' };
  const download = isAllowedAudioUrl(b.download) ? b.download : b.src;
  const durationSec = Number(b.durationSec);
  return {
    available: true,
    slug,
    src: b.src,
    download,
    durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0,
    voice: typeof b.voice === 'string' ? b.voice.slice(0, 40) : undefined,
    model: typeof b.model === 'string' ? b.model.slice(0, 80) : undefined,
    renderedAt: typeof b.renderedAt === 'string' ? b.renderedAt.slice(0, 40) : undefined,
    stale: b.stale === true,
  };
}

const cache = new Map<string, { at: number; info: BlogAudioInfo }>();

export function clearBlogAudioCache() {
  cache.clear();
}

/**
 * Never throws: any failure (timeout, 5xx, bad JSON, disallowed host) is reported
 * as `available: false`, so a post page always renders.
 */
export async function fetchBlogAudioInfo(
  slug: string,
  opts: { fetch?: FetchLike; base?: string; timeoutMs?: number; now?: () => number } = {},
): Promise<BlogAudioInfo> {
  if (!isValidAudioSlug(slug)) return { available: false, slug: String(slug ?? ''), reason: 'invalid slug' };
  const now = opts.now || Date.now;
  const hit = cache.get(slug);
  if (hit && now() - hit.at < (hit.info.available ? OK_TTL_MS : MISS_TTL_MS)) return hit.info;

  const base = opts.base || blogAudioFunctionsBase();
  const doFetch: FetchLike = opts.fetch || ((i, init) => fetch(i, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 2500);
  let info: BlogAudioInfo;
  let cacheable = true;
  try {
    const r = await doFetch(`${base}/blogAudioInfo?slug=${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      redirect: 'follow',
    });
    if (!r.ok) {
      info = { available: false, slug, reason: `upstream ${r.status}` };
      cacheable = r.status < 500;
    } else {
      info = sanitizeBlogAudioInfo(slug, await r.json());
    }
  } catch {
    info = { available: false, slug, reason: 'upstream unreachable' };
    cacheable = false;
  } finally {
    clearTimeout(timer);
  }
  if (cacheable) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(slug, { at: now(), info });
  }
  return info;
}
