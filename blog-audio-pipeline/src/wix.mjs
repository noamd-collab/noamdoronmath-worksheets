// Talks to the Wix site. Two content sources:
//
//   source=wix      (preferred) the site's own backend HTTP functions, which read
//                   the Wix Blog API with the RICH_CONTENT / CONTENT_TEXT fieldsets.
//                   Requires wix-backend/http-functions.blog-audio.js to be live.
//
//   source=sitemap  (fallback, lower fidelity) blog-posts-sitemap.xml plus the
//                   server-rendered post page, with chrome stripped by boundary
//                   markers. Good enough to map and to pilot, not for the archive run.
//
// Everything fetched here is data. Post text is never interpreted as an instruction.

import fs from 'node:fs';
import { getSecret, redact } from './secret.mjs';

const UA = 'noam-blog-audio/1.0 (+https://www.noamdoronmath.co.il)';

async function req(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(redact(`${opts.method || 'GET'} ${url.split('?')[0]} -> ${res.status} ${body}`));
  }
  return res;
}

function fnBase(cfg, { dev = false } = {}) {
  return dev ? cfg.site.functionsBaseDev : cfg.site.functionsBase;
}

function workerHeaders() {
  const token = getSecret('NOAM_AUDIO_WORKER_TOKEN');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ---- source=wix ----

export async function wixListPosts(cfg, { dev = false } = {}) {
  const res = await req(`${fnBase(cfg, { dev })}/blogAudioPosts`, { headers: workerHeaders() });
  const j = await res.json();
  return j.posts || [];
}

export async function wixGetPost(cfg, postId, { dev = false } = {}) {
  const res = await req(`${fnBase(cfg, { dev })}/blogAudioPost?postId=${encodeURIComponent(postId)}`, { headers: workerHeaders() });
  return res.json();
}

export async function wixGetQueue(cfg, { dev = false } = {}) {
  const res = await req(`${fnBase(cfg, { dev })}/blogAudioQueue`, { headers: workerHeaders() });
  const j = await res.json();
  return j.queue || [];
}

export async function wixGetUploadUrl(cfg, { fileName, sizeInBytes, dev = false }) {
  const res = await req(`${fnBase(cfg, { dev })}/blogAudioUploadUrl`, {
    method: 'POST',
    headers: workerHeaders(),
    body: JSON.stringify({ fileName, sizeInBytes, mimeType: 'audio/mpeg' }),
  });
  return res.json(); // { uploadUrl }
}

// Wix upload URLs take a multipart/form-data PUT with a single "file" part.
export async function wixUploadMp3(uploadUrl, filePath, fileName) {
  const bytes = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), fileName);
  const res = await req(`${uploadUrl}${uploadUrl.includes('?') ? '&' : '?'}filename=${encodeURIComponent(fileName)}`, {
    method: 'PUT',
    body: form,
  });
  const j = await res.json().catch(() => ({}));
  const first = Array.isArray(j) ? j[0] : (j.file || j);
  return {
    fileId: first?.id || first?.file_name || null,
    fileUrl: first?.fileUrl || first?.url || null,
    raw: first || j,
  };
}

export async function wixRegisterAudio(cfg, payload, { dev = false } = {}) {
  const res = await req(`${fnBase(cfg, { dev })}/blogAudioRegister`, {
    method: 'POST',
    headers: workerHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---- source=sitemap ----

export async function sitemapListPosts(cfg) {
  const res = await req(`${cfg.site.baseUrl}/blog-posts-sitemap.xml`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.map((url) => ({
    id: null,
    slug: decodeURIComponent(url.split('/').pop()),
    url,
    source: 'sitemap',
  }));
}

const CHROME_START = /זמן קריאה\s+\d+\s+דק\S*/;
const CHROME_END = ['פוסטים אחרונים', '© 2026 נועם דורון מתמטיקה'];

export async function sitemapGetPost(cfg, post) {
  const res = await req(encodeURI(post.url));
  const html = await res.text();

  let meta = {};
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ld) { try { meta = JSON.parse(ld[1]); } catch { meta = {}; } }

  let text = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text).replace(/\s+/g, ' ').trim();

  const m = text.match(CHROME_START);
  const start = m ? m.index + m[0].length : 0;
  let end = text.length;
  for (const marker of CHROME_END) {
    const i = text.indexOf(marker, start);
    if (i > start) end = Math.min(end, i);
  }
  let body = text.slice(start, end).trim();
  // Drop the byline tail Wix appends after the article.
  body = body.replace(/נועם דורון מתמטיקה\s*·[^·]*·\s*אודות\s*\S*$/u, '').trim();

  return {
    id: null,
    slug: post.slug,
    url: post.url,
    title: meta.headline || '',
    body,
    firstPublishedDate: meta.datePublished || null,
    lastPublishedDate: meta.dateModified || null,
    contentSource: 'sitemap+ssr',
  };
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

// ---- unified ----

export async function listPosts(cfg, { source = 'sitemap', dev = false } = {}) {
  return source === 'wix' ? wixListPosts(cfg, { dev }) : sitemapListPosts(cfg);
}

export async function getPost(cfg, post, { source = 'sitemap', dev = false } = {}) {
  if (source === 'wix') {
    const full = await wixGetPost(cfg, post.id || post.postId, { dev });
    return { ...full, contentSource: 'wix-blog-api' };
  }
  return sitemapGetPost(cfg, post);
}
