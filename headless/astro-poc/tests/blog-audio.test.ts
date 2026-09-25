/**
 * OPEN-07 — blog narration on the Headless POC: upstream lookup, sanitizing,
 * caching, failure behaviour, and parity of the player copy with the live player.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE,
  blogAudioFunctionsBase,
  clearBlogAudioCache,
  fetchBlogAudioInfo,
  handleBlogAudioInfoRequest,
  isAllowedAudioUrl,
  isValidAudioSlug,
  sanitizeBlogAudioInfo,
} from '../src/lib/blogAudio';

const MP3 = 'https://noamd-collab.github.io/noamdoronmath-worksheets/blog-audio/annual-review-grade-7.mp3';
const live = { available: true, slug: 'annual-review-grade-7', durationSec: 116.592, src: MP3, download: MP3, voice: 'Charon', model: 'gemini-2.5-flash-preview-tts' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

describe('OPEN-07 blog audio', () => {
  beforeEach(() => clearBlogAudioCache());

  it('defaults to the classic site free address, not the custom domain', () => {
    assert.equal(blogAudioFunctionsBase({}), DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE);
    assert.ok(!DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE.includes('noamdoronmath.co.il'));
    assert.equal(blogAudioFunctionsBase({ BLOG_AUDIO_FUNCTIONS_BASE: 'https://x.wixsite.com/s/_functions/' }), 'https://x.wixsite.com/s/_functions');
    for (const bad of ['http://x.com/_functions', 'https://evil.example/api', 'not a url'])
      assert.equal(blogAudioFunctionsBase({ BLOG_AUDIO_FUNCTIONS_BASE: bad }), DEFAULT_BLOG_AUDIO_FUNCTIONS_BASE);
  });

  it('accepts live Hebrew slugs and rejects path tricks', () => {
    assert.ok(isValidAudioSlug('תרגילי-חיבור-וחיסור-לכיתה-א'));
    for (const s of ['', 'a/b', 'a?b', 'a b', '<x>', 'x'.repeat(301), null]) assert.equal(isValidAudioSlug(s), false);
  });

  it('plays only https MP3 files from known hosts', () => {
    assert.ok(isAllowedAudioUrl(MP3));
    for (const u of ['http://noamd-collab.github.io/a.mp3', 'https://evil.example/a.mp3', 'https://noamd-collab.github.io/a.js', 'javascript:alert(1)'])
      assert.equal(isAllowedAudioUrl(u), false);
    assert.equal(sanitizeBlogAudioInfo('s', { ...live, src: 'https://evil.example/a.mp3' }).available, false);
  });

  it('builds the upstream URL and keeps only player fields', async () => {
    const urls: string[] = [];
    const info = await fetchBlogAudioInfo('annual-review-grade-7', { base: 'https://b.example/_functions', fetch: async (u) => { urls.push(u); return json({ ...live, secret: 'x', title: '<b>' }); } });
    assert.deepEqual(urls, ['https://b.example/_functions/blogAudioInfo?slug=annual-review-grade-7']);
    assert.equal(info.available, true);
    assert.ok(info.available && info.src === MP3 && info.durationSec === 116.592);
    assert.ok(!('secret' in info) && !('title' in info));
  });

  it('caches answers so a page view costs at most one upstream call per 5 minutes', async () => {
    let calls = 0;
    const f = async () => { calls++; return json(live); };
    await fetchBlogAudioInfo('annual-review-grade-7', { fetch: f });
    await fetchBlogAudioInfo('annual-review-grade-7', { fetch: f });
    assert.equal(calls, 1);
  });

  it('never throws: timeout, 5xx and bad JSON all mean no bar, and failures are not cached', async () => {
    let calls = 0;
    const hang = (_u: string, init?: RequestInit) => { calls++; return new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('abort')))); };
    assert.equal((await fetchBlogAudioInfo('p', { fetch: hang, timeoutMs: 20 })).available, false);
    assert.equal((await fetchBlogAudioInfo('p', { fetch: hang, timeoutMs: 20 })).available, false);
    assert.equal(calls, 2);
    assert.equal((await fetchBlogAudioInfo('q', { fetch: async () => json({}, 500) })).available, false);
    assert.equal((await fetchBlogAudioInfo('r', { fetch: async () => new Response('<html>') })).available, false);
    assert.equal((await fetchBlogAudioInfo('bad/slug', { fetch: async () => json(live) })).available, false);
  });

  it('never follows a redirect: the fetch asks for manual mode and a 3xx means no audio', async () => {
    const inits: RequestInit[] = [];
    const redirecting = async (_u: string, init?: RequestInit) => {
      inits.push(init || {});
      return new Response(null, { status: 301, headers: { location: 'https://www.noamdoronmath.co.il/_functions/blogAudioInfo' } });
    };
    const info = await fetchBlogAudioInfo('annual-review-grade-7', { fetch: redirecting });
    assert.equal(inits.length, 1);
    assert.equal(inits[0].redirect, 'manual');
    assert.deepEqual(info, { available: false, slug: 'annual-review-grade-7', reason: 'upstream 301' });
    // Not cached: a redirect during the DNS move may be transient.
    await fetchBlogAudioInfo('annual-review-grade-7', { fetch: redirecting });
    assert.equal(inits.length, 2);
    // An opaque redirect (status 0, as browsers report manual redirects) is also no audio.
    const opaque = await fetchBlogAudioInfo('x', { fetch: async () => ({ status: 0, ok: false, json: async () => live }) as unknown as Response });
    assert.equal(opaque.available, false);
  });

  it('proxy answers 400 to a slug with a path separator and calls nothing upstream', async () => {
    let calls = 0;
    const r = await handleBlogAudioInfoRequest(new URL('http://poc.local/api/blog-audio-info?slug=a/b'), { fetch: async () => { calls++; return json(live); } });
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: 'slug is required' });
    assert.equal(calls, 0);
    const missing = await handleBlogAudioInfoRequest(new URL('http://poc.local/api/blog-audio-info'), { fetch: async () => { calls++; return json(live); } });
    assert.equal(missing.status, 400);
    assert.equal(calls, 0);
  });

  it('proxy returns sanitized info with short caching for a valid slug', async () => {
    const r = await handleBlogAudioInfoRequest(new URL('http://poc.local/api/blog-audio-info?slug=annual-review-grade-7'), { fetch: async () => json(live) });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
    const body = await r.json();
    assert.equal(body.available, true);
    assert.equal(body.src, MP3);
  });

  it('public player is the live player with only the api override added', () => {
    const livePlayer = readFileSync(new URL('../../../blog-audio-pipeline/site/noam-audio-player.js', import.meta.url), 'utf8');
    const copy = readFileSync(new URL('../public/blog-audio/noam-audio-player.js', import.meta.url), 'utf8');
    const expected = livePlayer.replace(
      "    fetch(API + '?slug=' + encodeURIComponent(slug), { credentials: 'omit' })",
      "    // OPEN-07: an `api` attribute points the metadata call at a same-origin proxy\n    // (Headless POC); without it the player behaves exactly like the live site.\n    fetch((host.getAttribute('api') || API) + '?slug=' + encodeURIComponent(slug), { credentials: 'omit' })",
    );
    assert.notEqual(expected, livePlayer);
    assert.equal(copy, expected);
  });
});
