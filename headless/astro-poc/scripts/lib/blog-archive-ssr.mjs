/**
 * Shared live-SSR blog archive card index (source of truth for M26 gates).
 * Parse the deployed Astro cards and the legacy Wix post-list-item markup.
 * Read server HTML so browser gallery virtualization cannot hide source cards.
 */
import { parseHTML } from 'linkedom';

export const PROD = 'https://www.noamdoronmath.co.il';

export const ARCHIVE_PATHS = [
  { path: '/blog', fileSlug: 'blog-index', kind: 'index' },
  {
    path: '/blog/categories/elementary-math',
    fileSlug: 'category-elementary-math',
    kind: 'category',
    categorySlug: 'elementary-math',
  },
  {
    path: '/blog/categories/middle-school-math',
    fileSlug: 'category-middle-school-math',
    kind: 'category',
    categorySlug: 'middle-school-math',
  },
  {
    path: '/blog/categories/teachers-and-parents',
    fileSlug: 'category-teachers-and-parents',
    kind: 'category',
    categorySlug: 'teachers-and-parents',
  },
];

export function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

export function decodeHtml(s) {
  return clean(
    s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  );
}

export function stripTags(s) {
  return decodeHtml(s.replace(/<[^>]+>/g, ' '));
}

export function normHref(href) {
  try {
    const u = new URL(href, PROD);
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return href;
  }
}

export function pathnameOf(href) {
  try {
    return new URL(href, PROD).pathname.replace(/\/$/, '') || '/';
  } catch {
    return href;
  }
}

function parseAstroSsrCards(html) {
  const { document } = parseHTML(html);
  return [...document.querySelectorAll('[data-blog-archive-list] [data-blog-archive-card]')].flatMap((card) => {
    const link = card.querySelector('[data-blog-archive-card-link]');
    const title = clean(link?.textContent);
    let href;
    try {
      const url = new URL(link?.getAttribute('href') || '', PROD);
      if (url.origin !== PROD || !url.pathname.startsWith('/post/')) return [];
      href = normHref(url.href);
    } catch {
      return [];
    }
    if (title.length < 3) return [];
    const text = (selector) => clean(card.querySelector(selector)?.textContent);
    const avatar = card.querySelector('.blog-archive__card-avatar');
    const categories = [...card.querySelectorAll('.blog-archive__card-cats a[href]')].map((item) => ({
      text: clean(item.textContent), href: normHref(item.getAttribute('href')),
    }));
    return [{
      title, href, excerpt: text('[data-blog-archive-card-excerpt]'),
      authorAvatar: avatar?.getAttribute('src') ? { src: avatar.getAttribute('src'), alt: avatar.getAttribute('alt') || '' } : undefined,
      author: text('[data-blog-archive-card-author]') || undefined,
      date: text('[data-blog-archive-card-date]') || undefined,
      categories: categories.length ? categories : undefined,
    }];
  });
}

/** Parse every SSR archive card in document order, without rendering JavaScript. */
export function parseSsrCards(html) {
  // The custom Astro archive replaced Wix's gallery when the site went live.
  // Keep its semantic hooks distinct from unrelated article/recent-post links.
  if (/data-blog-archive-list\b/i.test(html)) return parseAstroSsrCards(html);
  const cards = [];
  const parts = html.split(/data-hook="post-list-item"/i);
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i].slice(0, 12000);
    const hrefMatch = chunk.match(
      /href="(https:\/\/www\.noamdoronmath\.co\.il\/post\/[^"]+|\/post\/[^"]+)"/
    );
    if (!hrefMatch) continue;
    const href = normHref(hrefMatch[1]);
    const titleMatch =
      chunk.match(/data-hook="post-title"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
      chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    if (!title || title.length < 3) continue;
    const excerptMatch =
      chunk.match(
        /data-hook="post-description"[^>]*>[\s\S]*?<div class="BOlnTh"[^>]*>([\s\S]*?)<\/div>/i
      ) ||
      chunk.match(/data-hook="post-description"[^>]*>([\s\S]*?)data-hook="profile-link"/i);
    const excerpt = excerptMatch ? stripTags(excerptMatch[1]) : '';
    const authorMatch = chunk.match(/data-hook="user-name"[^>]*>([\s\S]*?)<\//i);
    const author = authorMatch ? stripTags(authorMatch[1]) : undefined;
    const dateMatch =
      chunk.match(/data-hook="time-ago"[^>]*>([\s\S]*?)<\//i) ||
      chunk.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    const date = dateMatch ? stripTags(dateMatch[1]) : undefined;
    let authorAvatar;
    const infoMatch = chunk.match(/data-image-info="([^"]+)"/);
    const altMatch = chunk.match(/alt="(תמונת הסופר[^"]*)"/);
    if (infoMatch) {
      try {
        const info = JSON.parse(infoMatch[1].replace(/&quot;/g, '"'));
        const uri = info?.imageData?.uri || info?.uri;
        if (uri) {
          authorAvatar = {
            src: uri.startsWith('http') ? uri : `https://static.wixstatic.com/media/${uri}`,
            alt: altMatch ? decodeHtml(altMatch[1]) : 'תמונת הסופר/ת',
          };
        }
      } catch {
        /* ignore */
      }
    }
    if (!authorAvatar && altMatch) {
      const srcMatch = chunk.match(/src="(https:\/\/lh3\.googleusercontent\.com[^"]+)"/);
      if (srcMatch) authorAvatar = { src: srcMatch[1], alt: decodeHtml(altMatch[1]) };
    }
    const categories = [];
    for (const m of chunk.matchAll(
      /href="(https:\/\/www\.noamdoronmath\.co\.il\/blog\/categories\/[^"]+|\/blog\/categories\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    )) {
      const text = stripTags(m[2]);
      if (text && text.length < 40) categories.push({ text, href: normHref(m[1]) });
    }
    cards.push({
      title,
      href,
      excerpt,
      authorAvatar,
      author,
      date,
      categories: categories.length ? categories : undefined,
    });
  }
  const seen = new Set();
  return cards.filter((c) => {
    if (seen.has(c.href)) return false;
    seen.add(c.href);
    return true;
  });
}

export function parseArchiveMeta(html) {
  const title = stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description =
    decodeHtml(
      (html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ||
        html.match(/<meta[^>]+content="([^"]*)"[^>]+name="description"/i) ||
        [])[1] || ''
    ) ||
    decodeHtml(
      (html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i) ||
        html.match(/<meta[^>]+content="([^"]*)"[^>]+property="og:description"/i) ||
        [])[1] || ''
    );
  const ogTitle = decodeHtml(
    (html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i) ||
      html.match(/<meta[^>]+content="([^"]*)"[^>]+property="og:title"/i) ||
      [])[1] || ''
  );
  const ogImage = decodeHtml(
    (html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i) ||
      html.match(/<meta[^>]+content="([^"]*)"[^>]+property="og:image"/i) ||
      [])[1] || ''
  );
  const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');

  const nav = [];
  const navChunkMatch = html.match(/data-hook="blog-desktop-header-container"[\s\S]*?<\/nav>/i);
  const navHtml = navChunkMatch ? navChunkMatch[0] : '';
  for (const m of navHtml.matchAll(/<a([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = `${m[1]} ${m[3]}`;
    const href = normHref(m[2]);
    const text = stripTags(m[4]);
    if (!text || !/blog/.test(href)) continue;
    if (!/\/blog$|\/blog\/categories\//.test(new URL(href, PROD).pathname)) continue;
    nav.push({
      text,
      href,
      current: /aria-current="page"|navigation-link-active/i.test(attrs),
    });
  }
  const seenNav = new Set();
  const navFinal = nav.filter((n) => {
    if (seenNav.has(n.href)) return false;
    seenNav.add(n.href);
    return true;
  });

  const hasLoadMore = /טען עוד|הצג עוד|Load more|עוד פוסטים/i.test(html);
  const hasPagination = /data-hook="[^"]*pagination/i.test(html);

  return {
    title,
    description,
    ogTitle: ogTitle || undefined,
    ogImage: ogImage || undefined,
    h1,
    nav: navFinal,
    loadMore: hasLoadMore ? { label: 'טען עוד' } : null,
    pagination: hasPagination ? [] : null,
  };
}

/** Retry-After is delay-seconds or an HTTP date (RFC 9110 section 10.2.3). */
function retryAfterDelay(value, now) {
  if (!value) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const delay = Number(text) * 1000;
    return Number.isSafeInteger(delay) ? delay : null;
  }
  // Do not let Date.parse reinterpret malformed numeric delays as calendar dates.
  if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), /i.test(text)) return null;
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

/** Live SSR ordered title+href index; at most one server-directed, bounded retry. */
export async function fetchLiveArchiveCardIndex(path, opts = {}) {
  const attempts = Math.min(2, Math.max(1, Number(opts.attempts) || 2));
  const fetchImpl = opts.fetchImpl || fetch;
  const sleep = opts.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = opts.now || Date.now;
  const ua = opts.userAgent || 'Mozilla/5.0 (compatible; m26-ssr-gate)';
  for (let i = 0; i < attempts; i++) {
    const res = await fetchImpl(PROD + path, {
      headers: { 'user-agent': ua, accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    const finalUrl = res.url || PROD + path;
    const contentType = res.headers.get('content-type') || '';
    const status = res.status;
    if (!res.ok) {
      const retryAfter = res.headers.get('retry-after');
      const delay = retryAfterDelay(retryAfter, now());
      // Record normalized delay/status only, never arbitrary header or error-page text.
      const retryMeta = { status, retryAfterMs: delay, retryAfterPresent: retryAfter !== null, attempt: i + 1 };
      await res.body?.cancel();
      if (status === 429 && delay !== null && delay > 0 && delay <= 30000 && i + 1 < attempts) {
        await sleep(delay);
        continue;
      }
      const error = new Error(`HTTP ${status} for ${path}; no further retry; metadata=${JSON.stringify(retryMeta)}`);
      error.http = retryMeta;
      throw error;
    }
    if (!/text\/html/i.test(contentType)) {
      await res.body?.cancel();
      throw new Error(`Unexpected or missing HTML content-type for ${path}; status=${status}`);
    }
    const html = await res.text();
    const cards = parseSsrCards(html);
    if (cards.length === 0) {
      const diag = {
        status, bytes: html.length,
        hasDoctype: /<!doctype html/i.test(html.slice(0, 200)),
        postListItem: (html.match(/data-hook="post-list-item"/gi) || []).length,
        astroCards: (html.match(/data-blog-archive-card(?:[\s=>])/gi) || []).length,
      };
      throw new Error(`Parsed 0 SSR cards for ${path}. diag=${JSON.stringify(diag)}`);
    }
    return {
      path,
      cards: cards.map((c) => ({ title: c.title, href: c.href, pathname: pathnameOf(c.href) })),
      titles: cards.map((c) => c.title),
      hrefs: cards.map((c) => c.href),
      pathnames: cards.map((c) => pathnameOf(c.href)),
      count: cards.length,
      loadMore: /טען עוד|הצג עוד|Load more|עוד פוסטים/i.test(html),
      pagination: /data-hook="[^"]*pagination/i.test(html),
      http: { status, finalUrl, contentType, bytes: html.length, attempt: i + 1 },
    };
  }
}

/** One exact live snapshot per path and test run, including unavailable results. */
export function createLiveArchiveSnapshotReader(opts = {}) {
  const snapshots = new Map();
  return (path) => {
    if (!snapshots.has(path)) snapshots.set(path, fetchLiveArchiveCardIndex(path, opts));
    return snapshots.get(path);
  };
}

/**
 * Compare live SSR card title+pathname order to served/fixture cards.
 * Returns issue strings (empty = pass).
 */
export function diffArchiveCardOrder(liveIndex, servedCards, label = 'served') {
  const issues = [];
  const served = servedCards.map((c) => ({
    title: clean(c.title),
    pathname: pathnameOf(c.href),
  }));
  if (served.length !== liveIndex.count) {
    issues.push(
      `${label} card count ${served.length} != live SSR ${liveIndex.count} on ${liveIndex.path}`
    );
  }
  const n = Math.max(served.length, liveIndex.cards.length);
  for (let i = 0; i < n; i++) {
    const live = liveIndex.cards[i];
    const got = served[i];
    if (!live) {
      issues.push(`${label} extra card[${i}] ${got?.title?.slice(0, 40)}`);
      continue;
    }
    if (!got) {
      issues.push(`missing live SSR card[${i}] ${live.title.slice(0, 50)}`);
      continue;
    }
    if (got.title !== live.title) {
      issues.push(
        `title order[${i}] ${label}=${got.title.slice(0, 35)} live=${live.title.slice(0, 35)}`
      );
    }
    if (got.pathname !== live.pathname) {
      issues.push(`href order[${i}] ${label}=${got.pathname} live=${live.pathname}`);
    }
  }
  // set completeness (catches omissions even if counts accidentally match via dupes)
  const liveSet = new Set(liveIndex.pathnames);
  const servedSet = new Set(served.map((c) => c.pathname));
  for (const p of liveSet) {
    if (!servedSet.has(p)) issues.push(`omitted live href ${p}`);
  }
  for (const p of servedSet) {
    if (!liveSet.has(p)) issues.push(`unexpected ${label} href ${p}`);
  }
  return issues;
}
