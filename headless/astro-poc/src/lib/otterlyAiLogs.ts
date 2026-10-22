/**
 * Forward one AI-crawler page view to OtterlyAI Agent Analytics.
 * The API key is supplied by the caller (Wix Secrets Manager / env).
 * This module never reads, prints, or embeds the key itself.
 *
 * Webhook: POST https://analytics.otterly.ai/logs
 * Body: JSON array of 1–500 events, under 256 KB.
 */

export const OTTERLY_LOGS_URL = 'https://analytics.otterly.ai/logs';
export const OTTERLY_API_KEY_NAME = 'OTTERLY_API_KEY';
export const OTTERLY_MAX_EVENTS = 500;
export const OTTERLY_MAX_BODY_BYTES = 256 * 1024;

/** Substring tokens, matched case-insensitively. Add a new bot name here. */
export const AI_CRAWLER_TOKENS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Google-Extended',
  'Bytespider',
] as const;

const APPROVED_HOST =
  /^(?:www\.noamdoronmath\.co\.il|noamdoronmath\.co\.il|[a-z0-9]{6}-noam-math-astro-poc-amiramnoam-130a\.wix-site-host\.com)$/;

const STATIC_EXTENSION =
  /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|pdf|mp3|mp4|webmanifest)$/i;

export type OtterlyEvent = {
  requestUrl: string;
  userAgent: string;
  timestamp: string;
  referer?: string;
  clientIp?: string;
};

export type OtterlyScheduleInput = {
  method: string;
  pathname: string;
  search: string;
  requestUrl: string;
  forwardedUrl?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  clientIp?: string | null;
  secFetchDest?: string | null;
  apiKey?: string | null;
  locals?: unknown;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
};

type WaitUntil = (promise: Promise<unknown>) => void;

export function isAiCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const haystack = userAgent.toLowerCase();
  return AI_CRAWLER_TOKENS.some((token) => haystack.includes(token.toLowerCase()));
}

export function isOtterlyPageRequest(pathname: string, method: string, secFetchDest?: string | null): boolean {
  const verb = method.toUpperCase();
  if (verb !== 'GET' && verb !== 'HEAD') return false;
  if (secFetchDest) {
    const dest = secFetchDest.toLowerCase();
    if (dest !== 'document' && dest !== 'empty' && dest !== 'iframe') return false;
  }
  if (pathname.startsWith('/_') || pathname.startsWith('/api/')) return false;
  if (STATIC_EXTENSION.test(pathname)) return false;
  return true;
}

export function otterlyTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function absoluteReferer(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (url.username || url.password) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function clientIpForDedup(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(',')[0]?.trim() ?? '';
  if (!first || first.length > 45) return undefined;
  if (isIpv4(first) || isIpv6(first)) return first;
  return undefined;
}

export function resolveOtterlyRequestUrl(input: {
  requestUrl: string;
  forwardedUrl?: string | null;
  pathname: string;
  search: string;
}): string | null {
  const search = input.search ? (input.search.startsWith('?') ? input.search : `?${input.search}`) : '';
  const path = input.pathname.startsWith('/') ? input.pathname : `/${input.pathname}`;
  for (const candidate of [input.forwardedUrl, input.requestUrl]) {
    const resolved = publicUrlFromCandidate(candidate, path, search);
    if (resolved) return resolved;
  }
  return null;
}

export function buildOtterlyEvent(input: {
  requestUrl: string;
  userAgent: string;
  timestamp: string;
  referer?: string | null;
  clientIp?: string | null;
}): OtterlyEvent | null {
  const requestUrl = absoluteApprovedUrl(input.requestUrl);
  const userAgent = input.userAgent.trim();
  if (!requestUrl || !userAgent || !isRfc3339Utc(input.timestamp)) return null;
  const event: OtterlyEvent = {
    requestUrl,
    userAgent,
    timestamp: input.timestamp,
  };
  const referer = absoluteReferer(input.referer);
  if (referer) event.referer = referer;
  const clientIp = clientIpForDedup(input.clientIp);
  if (clientIp) event.clientIp = clientIp;
  return event;
}

export function otterlyLogsBody(events: readonly OtterlyEvent[]): string {
  if (events.length < 1 || events.length > OTTERLY_MAX_EVENTS) {
    throw new Error('Otterly batch must contain 1 to 500 events');
  }
  const body = JSON.stringify(events);
  if (new TextEncoder().encode(body).byteLength > OTTERLY_MAX_BODY_BYTES) {
    throw new Error('Otterly batch exceeds 256 KB');
  }
  return body;
}

export function safeOtterlyError(error: unknown, apiKey?: string | null): string {
  const raw = error instanceof Error ? error.message : 'Otterly AI log failed';
  let text = raw;
  const key = apiKey?.trim();
  if (key) text = text.split(key).join('[redacted]');
  text = text.replace(/authorization\s*:\s*\S+/gi, '[redacted]');
  text = text.replace(/\bauthorization\b/gi, '[redacted]');
  text = text.replace(/Bearer\s+\S+/gi, '[redacted]');
  text = text.replace(/oai_live_[A-Za-z0-9_-]+/g, '[redacted]');
  return text.slice(0, 240);
}

export async function postOtterlyLogs(
  events: readonly OtterlyEvent[],
  options: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<number> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error('OTTERLY_API_KEY is not set');
  const body = otterlyLogsBody(events);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(OTTERLY_LOGS_URL, {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  await response.body?.cancel().catch(() => undefined);
  return response.status;
}

export function sampleOtterlyEvent(now = new Date()): OtterlyEvent {
  return {
    requestUrl: 'https://www.noamdoronmath.co.il/',
    userAgent: 'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)',
    timestamp: otterlyTimestamp(now),
  };
}

/** Start the webhook without awaiting it. Never throws. */
export function scheduleOtterlyPageLog(input: OtterlyScheduleInput): void {
  const log = input.log ?? ((message: string) => console.error(message));
  let job: Promise<void>;
  try {
    job = deliverOtterlyPageLog(input, log);
  } catch (error) {
    log(safeOtterlyError(error, input.apiKey));
    return;
  }
  const waitUntil = readWaitUntil(input.locals);
  if (waitUntil) {
    try {
      waitUntil(job);
      return;
    } catch (error) {
      log(safeOtterlyError(error, input.apiKey));
    }
  }
  void job;
}

async function deliverOtterlyPageLog(input: OtterlyScheduleInput, log: (message: string) => void): Promise<void> {
  const apiKey = input.apiKey?.trim() ?? '';
  try {
    if (!isOtterlyPageRequest(input.pathname, input.method, input.secFetchDest)) return;
    if (!isAiCrawlerUserAgent(input.userAgent)) return;
    const requestUrl = resolveOtterlyRequestUrl(input);
    if (!requestUrl) {
      log('Otterly AI log skipped: no public request URL');
      return;
    }
    const event = buildOtterlyEvent({
      requestUrl,
      userAgent: input.userAgent ?? '',
      timestamp: otterlyTimestamp((input.now ?? (() => new Date()))()),
      referer: input.referer,
      clientIp: input.clientIp,
    });
    if (!event) {
      log('Otterly AI log skipped: invalid event');
      return;
    }
    if (!apiKey) {
      log('Otterly AI log skipped: OTTERLY_API_KEY is not set');
      return;
    }
    const status = await postOtterlyLogs([event], { apiKey, fetchImpl: input.fetchImpl });
    if (status < 200 || status >= 300) log(`Otterly AI log failed: HTTP ${status}`);
  } catch (error) {
    log(`Otterly AI log failed: ${safeOtterlyError(error, apiKey)}`);
  }
}

function publicUrlFromCandidate(candidate: string | null | undefined, pathname: string, search: string): string | null {
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (!APPROVED_HOST.test(url.hostname)) return null;
  if (url.pathname === '/' && !url.search && (pathname !== '/' || search)) {
    return absoluteApprovedUrl(`${url.origin}${pathname}${search}`);
  }
  url.hash = '';
  return url.toString();
}

function absoluteApprovedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!APPROVED_HOST.test(url.hostname)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isRfc3339Utc(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value);
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isIpv6(value: string): boolean {
  if (!value.includes(':')) return false;
  return /^[0-9a-fA-F:.]+$/.test(value) && !value.includes('..');
}

function readWaitUntil(locals: unknown): WaitUntil | undefined {
  if (!locals || typeof locals !== 'object') return undefined;
  const ctx = (locals as { runtime?: { ctx?: { waitUntil?: unknown } } }).runtime?.ctx;
  return typeof ctx?.waitUntil === 'function' ? (ctx.waitUntil as WaitUntil) : undefined;
}
