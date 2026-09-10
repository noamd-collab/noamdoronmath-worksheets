/*
 * backend/blog-audio.js
 *
 * Narration audio for blog posts: the site-side half of the pipeline.
 *
 * Everything here is read-mostly. The audio itself is produced by the local worker
 * (Desktop/noam-blog-audio), which authenticates with the NOAM_AUDIO_WORKER_TOKEN
 * secret. No Gemini key ever reaches this file, and no audio is generated while a
 * visitor is on the page.
 *
 * Public endpoints (no token):
 *   GET  /_functions/blogAudioInfo?slug=...   player metadata, published posts only
 *   GET  /_functions/blogAudio?slug=...       302 to the MP3, published posts only
 *
 * Worker endpoints (Bearer NOAM_AUDIO_WORKER_TOKEN):
 *   GET  /_functions/blogAudioPosts           every published post
 *   GET  /_functions/blogAudioPost?postId=    one post as narration-ready text
 *   GET  /_functions/blogAudioQueue           posts with missing or stale audio
 *   POST /_functions/blogAudioUploadUrl       Media Manager upload URL (wix-media storage)
 *   POST /_functions/blogAudioRegister        record a finished render
 *
 * Scheduled (jobs.config):
 *   sweepBlogAudio()                          marks stale/missing audio, retires withdrawn posts
 */

import { ok, badRequest, forbidden, notFound, serverError, response } from 'wix-http-functions';
import { posts } from 'wix-blog-backend';
import wixData from 'wix-data';
import { getSecret } from 'wix-secrets-backend';
import { mediaManager } from 'wix-media-backend';

const COLLECTION = 'BlogPostAudio';
const AUTH = { suppressAuth: true };
const PAGE_LIMIT = 100;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/* ------------------------------------------------------------------ helpers */

// Constant-time-ish comparison so a wrong token cannot be probed byte by byte.
function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function requireWorker(request) {
  const header = (request.headers && (request.headers.authorization || request.headers.Authorization)) || '';
  const presented = header.replace(/^Bearer\s+/i, '').trim();
  if (!presented) return false;
  const expected = await getSecret('NOAM_AUDIO_WORKER_TOKEN');
  return tokensMatch(presented, expected);
}

function json(body, status) {
  return response({ status: status || 200, headers: JSON_HEADERS, body: JSON.stringify(body) });
}

// Small non-cryptographic content fingerprint. It only decides whether a post is
// worth re-rendering; the worker computes the authoritative SHA-256 signature.
function sourceHash(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = (h1 + ((h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24))) >>> 0;
    h2 = (((h2 << 5) - h2) + c) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}-${text.length}`;
}

/* -------------------------------------------------- rich content to plain text */

const SKIP_NODES = [
  'IMAGE', 'VIDEO', 'GIF', 'EMBED', 'HTML', 'DIVIDER', 'FILE', 'GALLERY',
  'AUDIO', 'MAP', 'APP_EMBED', 'CODE_BLOCK', 'BUTTON', 'LINK_PREVIEW', 'POLL',
];

function nodeText(nodes) {
  return (nodes || []).map((n) => (n.type === 'TEXT' ? (n.textData && n.textData.text) || '' : nodeText(n.nodes))).join('');
}

// Walks the Ricos document in reading order and keeps only what a narrator reads:
// headings, paragraphs, quotes, list items and table rows. Layout and embeds go.
function richContentToText(rc) {
  if (!rc || !Array.isArray(rc.nodes)) return '';
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (SKIP_NODES.indexOf(n.type) !== -1) continue;
      if (n.type === 'PARAGRAPH' || n.type === 'HEADING' || n.type === 'BLOCKQUOTE') {
        const t = nodeText(n.nodes).trim();
        if (t) out.push(t);
      } else if (n.type === 'BULLETED_LIST' || n.type === 'ORDERED_LIST') {
        for (const li of n.nodes || []) {
          const t = nodeText(li.nodes).trim();
          if (t) out.push(t);
        }
      } else if (n.type === 'TABLE') {
        for (const row of n.nodes || []) {
          const cells = (row.nodes || []).map((c) => nodeText(c.nodes).trim()).filter(Boolean);
          if (cells.length) out.push(cells.join(', ') + '.');
        }
      } else {
        walk(n.nodes);
      }
    }
  };
  walk(rc.nodes);
  return out.join('\n\n');
}

/* ------------------------------------------------------------ blog data access */

async function listAllPublishedPosts(fieldsets) {
  const all = [];
  let offset = 0;
  for (;;) {
    const res = await posts.listPosts({
      paging: { limit: PAGE_LIMIT, offset },
      fieldsets: fieldsets || ['URL'],
    });
    const batch = (res && res.posts) || [];
    all.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
    offset += batch.length;
    if (offset > 5000) break;
  }
  return all;
}

function postUrl(post) {
  if (post.url && post.url.base) return `${post.url.base}${post.url.path || ''}`;
  return post.slug ? `https://www.noamdoronmath.co.il/post/${post.slug}` : null;
}

async function audioRowForPost(match) {
  const res = await wixData.query(COLLECTION)
    .eq(match.field, match.value)
    .limit(1)
    .find(AUTH);
  return res.items[0] || null;
}

// getPostBySlug does not answer for this site's Hebrew slugs, so a miss falls back
// to scanning the published list. Eighteen posts, one call, and it is the same data.
async function publishedPostBySlug(slug, fieldsets) {
  try {
    const res = await posts.getPostBySlug(slug, { fieldsets: fieldsets || ['URL'] });
    if (res && res.post) return res.post;
  } catch (e) {
    // fall through to the scan
  }
  try {
    const all = await listAllPublishedPosts(fieldsets || ['URL']);
    return all.find((p) => p.slug === slug) || null;
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------ public endpoints */

// Player metadata. Answers only for a post that is published right now; a post that
// has been unpublished stops advertising its audio immediately, before any sweep runs.
export async function get_blogAudioInfo(request) {
  try {
    const slug = request.query && request.query.slug;
    if (!slug) return json({ error: 'slug is required' }, 400);

    const post = await publishedPostBySlug(slug);
    if (!post) return json({ available: false, reason: 'post not published' }, 200);

    const row = await audioRowForPost({ field: 'postId', value: post._id })
      || await audioRowForPost({ field: 'slug', value: slug });

    if (!row || row.active === false || !row.fileUrl) {
      return json({ available: false, reason: 'no audio yet' }, 200);
    }

    return json({
      available: true,
      slug,
      title: post.title,
      durationSec: row.durationSec,
      bytes: row.bytes,
      src: row.fileUrl,
      download: row.fileUrl,
      voice: row.voice,
      model: row.model,
      renderedAt: row.renderedAt,
      stale: row.needsAudio === true,
    }, 200);
  } catch (e) {
    return json({ error: 'blogAudioInfo failed', detail: String(e.message || e).slice(0, 200) }, 500);
  }
}

// Redirects to the MP3, but only while the post is published. The player can point
// at this instead of the raw file when you want every play to re-check publication.
export async function get_blogAudio(request) {
  try {
    const slug = request.query && request.query.slug;
    if (!slug) return badRequest({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'slug is required' }) });

    const post = await publishedPostBySlug(slug);
    if (!post) return notFound({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'post not published' }) });

    const row = await audioRowForPost({ field: 'postId', value: post._id })
      || await audioRowForPost({ field: 'slug', value: slug });
    if (!row || row.active === false || !row.fileUrl) {
      return notFound({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'no audio for this post' }) });
    }

    return response({ status: 302, headers: { Location: row.fileUrl, 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    return serverError({ headers: JSON_HEADERS, body: JSON.stringify({ error: String(e.message || e).slice(0, 200) }) });
  }
}

/* ------------------------------------------------------------ worker endpoints */

export async function get_blogAudioPosts(request) {
  if (!(await requireWorker(request))) return forbidden({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'worker token required' }) });
  try {
    const all = await listAllPublishedPosts(['URL', 'CONTENT_TEXT']);
    return json({
      posts: all.map((p) => ({
        id: p._id,
        slug: p.slug,
        url: postUrl(p),
        title: p.title,
        firstPublishedDate: p.firstPublishedDate,
        lastPublishedDate: p.lastPublishedDate,
        contentChars: (p.contentText || '').length,
        sourceHash: sourceHash(`${p.title || ''}\n\n${p.contentText || ''}`),
      })),
    }, 200);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
}

// One post, reduced to exactly what should be read aloud.
export async function get_blogAudioPost(request) {
  if (!(await requireWorker(request))) return forbidden({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'worker token required' }) });
  try {
    const postId = request.query && request.query.postId;
    if (!postId) return json({ error: 'postId is required' }, 400);

    const res = await posts.getPost(postId, { fieldsets: ['URL', 'CONTENT_TEXT', 'RICH_CONTENT'] });
    const post = res && res.post;
    if (!post) return json({ error: 'post not found or not published' }, 404);

    const fromRich = richContentToText(post.richContent);
    const body = fromRich && fromRich.length > 200 ? fromRich : (post.contentText || '');

    return json({
      id: post._id,
      slug: post.slug,
      url: postUrl(post),
      title: post.title,
      body,
      bodySource: fromRich && fromRich.length > 200 ? 'richContent' : 'contentText',
      firstPublishedDate: post.firstPublishedDate,
      lastPublishedDate: post.lastPublishedDate,
      sourceHash: sourceHash(`${post.title || ''}\n\n${post.contentText || ''}`),
    }, 200);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
}

// Posts the worker still owes audio for: never rendered, or the text has changed.
export async function get_blogAudioQueue(request) {
  if (!(await requireWorker(request))) return forbidden({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'worker token required' }) });
  try {
    const all = await listAllPublishedPosts(['URL', 'CONTENT_TEXT']);
    const rows = await wixData.query(COLLECTION).limit(1000).find(AUTH);
    const byPost = {};
    for (const r of rows.items) byPost[r.postId || r.slug] = r;

    const queue = [];
    for (const p of all) {
      const row = byPost[p._id] || byPost[p.slug];
      const hash = sourceHash(`${p.title || ''}\n\n${p.contentText || ''}`);
      if (!row) queue.push({ id: p._id, slug: p.slug, url: postUrl(p), reason: 'no audio' });
      else if (row.active === false) queue.push({ id: p._id, slug: p.slug, url: postUrl(p), reason: 'audio retired' });
      else if (row.sourceHash !== hash) queue.push({ id: p._id, slug: p.slug, url: postUrl(p), reason: 'text changed' });
    }
    return json({ queue, publishedPosts: all.length, audioRows: rows.items.length }, 200);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
}

// Only needed when config.storage.backend is "wix-media".
export async function post_blogAudioUploadUrl(request) {
  if (!(await requireWorker(request))) return forbidden({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'worker token required' }) });
  try {
    const body = await request.body.json();
    if (!body.fileName) return json({ error: 'fileName is required' }, 400);
    const res = await mediaManager.getUploadUrl('/blog-audio', {
      mediaOptions: { mimeType: body.mimeType || 'audio/mpeg', mediaType: 'audio' },
      metadataOptions: { isPrivate: false, isVisitorUpload: false, context: { source: 'noam-blog-audio' } },
    });
    return json({ uploadUrl: res.uploadUrl, uploadToken: res.uploadToken }, 200);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
}

// Records a finished render. Idempotent on (postId, signature): re-registering the
// same signature updates the row instead of creating a second one.
export async function post_blogAudioRegister(request) {
  if (!(await requireWorker(request))) return forbidden({ headers: JSON_HEADERS, body: JSON.stringify({ error: 'worker token required' }) });
  try {
    const b = await request.body.json();
    for (const required of ['slug', 'signature', 'durationSec', 'fileUrl']) {
      if (b[required] === undefined || b[required] === null) return json({ error: `${required} is required` }, 400);
    }

    const post = await publishedPostBySlug(b.slug, ['URL', 'CONTENT_TEXT']);
    if (!post) return json({ error: 'refusing to register audio for a post that is not published' }, 409);

    const existing = await audioRowForPost({ field: 'postId', value: post._id })
      || await audioRowForPost({ field: 'slug', value: b.slug });

    const row = {
      postId: post._id,
      slug: b.slug,
      title: post.title,
      storageBackend: b.storageBackend || 'github-pages',
      fileId: b.fileId || null,
      fileUrl: b.fileUrl,
      durationSec: Number(b.durationSec),
      bytes: Number(b.bytes) || null,
      signature: b.signature,
      scriptSha256: b.scriptSha256 || null,
      scriptChars: Number(b.scriptChars) || null,
      sourceHash: sourceHash(`${post.title || ''}\n\n${post.contentText || ''}`),
      model: b.model || null,
      voice: b.voice || null,
      language: b.language || null,
      styleHash: b.styleHash || null,
      active: true,
      needsAudio: false,
      renderedAt: b.renderedAt ? new Date(b.renderedAt) : new Date(),
      lastCheckedAt: new Date(),
    };

    let saved;
    if (existing) {
      saved = await wixData.update(COLLECTION, Object.assign({}, existing, row), AUTH);
    } else {
      saved = await wixData.insert(COLLECTION, row, AUTH);
    }
    return json({ ok: true, id: saved._id, slug: saved.slug, active: saved.active }, 200);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
}

/* ------------------------------------------------------------------ scheduled */

// Runs on a timer (see jobs.config). Marks audio stale when a post's text changed,
// and retires audio for posts that are no longer published. It never generates audio.
export async function sweepBlogAudio() {
  const all = await listAllPublishedPosts(['URL', 'CONTENT_TEXT']);
  const publishedById = {};
  for (const p of all) publishedById[p._id] = p;

  const rows = await wixData.query(COLLECTION).limit(1000).find(AUTH);
  let retired = 0;
  let marked = 0;

  for (const row of rows.items) {
    const post = publishedById[row.postId];
    if (!post) {
      if (row.active !== false) {
        await wixData.update(COLLECTION, Object.assign({}, row, { active: false, lastCheckedAt: new Date() }), AUTH);
        retired++;
      }
      continue;
    }
    const hash = sourceHash(`${post.title || ''}\n\n${post.contentText || ''}`);
    if (row.sourceHash !== hash && row.needsAudio !== true) {
      await wixData.update(COLLECTION, Object.assign({}, row, { needsAudio: true, lastCheckedAt: new Date() }), AUTH);
      marked++;
    }
  }

  const known = {};
  for (const r of rows.items) known[r.postId] = true;
  const missing = all.filter((p) => !known[p._id]).length;

  console.log(`sweepBlogAudio: ${all.length} published, ${missing} without audio, ${marked} marked stale, ${retired} retired`);
  return { published: all.length, missing, marked, retired };
}

/* ----------------------------------------------------------- event entry points */
// Called from backend/events.js - see events.SNIPPET.js.

export async function onPostPublishedOrUpdated(postId) {
  try {
    const res = await posts.getPost(postId, { fieldsets: ['CONTENT_TEXT'] });
    const post = res && res.post;
    if (!post) return;
    const hash = sourceHash(`${post.title || ''}\n\n${post.contentText || ''}`);
    const row = await audioRowForPost({ field: 'postId', value: postId });
    if (!row) return; // nothing recorded yet; the queue endpoint already reports it
    if (row.sourceHash !== hash || row.active === false) {
      await wixData.update(COLLECTION, Object.assign({}, row, {
        needsAudio: true,
        active: true,
        lastCheckedAt: new Date(),
      }), AUTH);
    }
  } catch (e) {
    console.error('onPostPublishedOrUpdated failed', String(e.message || e));
  }
}

export async function onPostRemoved(postId) {
  try {
    const row = await audioRowForPost({ field: 'postId', value: postId });
    if (!row || row.active === false) return;
    await wixData.update(COLLECTION, Object.assign({}, row, { active: false, lastCheckedAt: new Date() }), AUTH);
    // With wix-media storage the file can also be trashed here:
    // if (row.storageBackend === 'wix-media' && row.fileId) await mediaManager.moveFilesToTrash([row.fileId]);
  } catch (e) {
    console.error('onPostRemoved failed', String(e.message || e));
  }
}
