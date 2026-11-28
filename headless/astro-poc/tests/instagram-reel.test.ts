/**
 * Homepage Instagram reel sits where the game promo cards were.
 * The cat explainer is the Instagram reel DgOvjmyF-U9. The 39MB mp4 stays
 * out of public/ and out of the worker. Removed reels are not embedded.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CAT_FILM_AI_NOTE,
  CAT_FILM_POSTER,
  CAT_FILM_TITLE,
  INSTAGRAM_FEATURED_REEL_URL,
  INSTAGRAM_PROFILE_URL,
  featuredReelUrl,
  instagramPermalink,
} from '../src/lib/instagramReel.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REMOVED_REELS = ['DgOJVFihduS', 'DgKT5HMOfTy'];

describe('featured Instagram reel permalink', () => {
  it('embeds the cat reel and rejects the removed reels', () => {
    assert.equal(INSTAGRAM_FEATURED_REEL_URL, 'https://www.instagram.com/reel/DgOvjmyF-U9/');
    assert.equal(featuredReelUrl(), 'https://www.instagram.com/reel/DgOvjmyF-U9/');
    assert.equal(INSTAGRAM_PROFILE_URL, 'https://www.instagram.com/noamdoronmath/');
    assert.equal(CAT_FILM_TITLE, 'איך מחשב מזהה חתול? רק עם מתמטיקה של חטיבה');
    assert.equal(CAT_FILM_AI_NOTE, 'הסרטון נוצר באמצעות AI');
    assert.equal(CAT_FILM_POSTER, '/films/cat-recognition/poster.jpg');
    assert.equal(instagramPermalink(''), null);
    assert.equal(instagramPermalink('TODO'), null);
    assert.equal(instagramPermalink('https://www.instagram.com/noamdoronmath/'), null);
    assert.equal(instagramPermalink('http://www.instagram.com/reel/AbC123/'), null);
    assert.equal(instagramPermalink('https://instagram.com/reel/AbC123/'), null);
    assert.equal(instagramPermalink('javascript:alert(1)'), null);
    const lib = readFileSync(join(root, 'src/lib/instagramReel.ts'), 'utf8');
    const card = readFileSync(join(root, 'src/components/InstagramFeaturedReel.astro'), 'utf8');
    for (const code of REMOVED_REELS) {
      assert.equal(lib.includes(code), false, code);
      assert.equal(card.includes(code), false, code);
      assert.equal(INSTAGRAM_FEATURED_REEL_URL.includes(code), false, code);
    }
  });

  it('accepts a reel, post, or TV permalink only', () => {
    const reel = 'https://www.instagram.com/reel/AbC123_-/';
    assert.equal(instagramPermalink(`  ${reel}  `), reel);
    assert.equal(
      instagramPermalink('https://www.instagram.com/p/AbC123/?img_index=1'),
      'https://www.instagram.com/p/AbC123/?img_index=1',
    );
    assert.equal(instagramPermalink('https://www.instagram.com/tv/AbC123'), 'https://www.instagram.com/tv/AbC123');
    assert.equal(instagramPermalink('https://www.instagram.com/reel/AbC123/extra'), null);
  });
});

describe('homepage placement', () => {
  it('replaces the removed game promo slot, between the hero and the grades', () => {
    const home = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    const hero = home.indexOf('<section class="exact-hero">');
    const reel = home.indexOf('<InstagramFeaturedReel />');
    const grades = home.indexOf('id="choose-grade"');
    assert.ok(hero > 0 && reel > hero && grades > reel);
    assert.equal(home.includes('GamePromoCard'), false);
    assert.equal(home.includes('exact-game-promo'), false);
  });

  it('renders the cat heading, the profile link, and a lazy official embed', () => {
    const card = readFileSync(join(root, 'src/components/InstagramFeaturedReel.astro'), 'utf8');
    const lib = readFileSync(join(root, 'src/lib/instagramReel.ts'), 'utf8');
    assert.match(card, /נועם דורון <\/span><span class="ig-feature__line">מתמטיקה<\/span><span class="ig-feature__sep"> - <\/span>/);
    assert.match(card, /לא משננים, מבינים\./);
    assert.match(card, /<h2 id="ig-feature-title"/);
    assert.match(card, /\{CAT_FILM_TITLE\}/);
    assert.match(card, /\{CAT_FILM_AI_NOTE\}/);
    assert.match(lib, /איך מחשב מזהה חתול\? רק עם מתמטיקה של חטיבה/);
    assert.match(lib, /הסרטון נוצר באמצעות AI/);
    assert.match(card, /dir="rtl"/);
    assert.match(card, /lang="he"/);
    assert.match(card, /href=\{INSTAGRAM_PROFILE_URL\}[^>]*target="_blank"[^>]*rel="noopener"/);
    assert.match(card, /לעמוד האינסטגרם שלנו/);
    assert.match(card, /data-ig-state=\{reelUrl \? 'reel' : 'fallback'\}/);
    assert.match(card, /class="instagram-media"/);
    assert.match(card, /data-instgrm-permalink=\{reelUrl\}/);
    assert.match(card, /https:\/\/www\.instagram\.com\/embed\.js/);
    assert.match(card, /script\.async = true/);
    assert.match(card, /IntersectionObserver/);
    assert.match(card, /width: min\(100%, 36em\)/);
    assert.match(card, /max-width: 340px/);
    assert.match(card, /loading="lazy"/);
    assert.match(card, /cat-film__poster/);
    assert.equal(card.includes('autoplay'), false);
    assert.equal(card.includes('.mp4'), false);
    assert.ok(card.indexOf('reelUrl ?') < card.indexOf('class="instagram-media"'));
    assert.ok(card.indexOf('class="instagram-media"') < card.indexOf('ig-feature__card'));
    assert.match(lib, /export const INSTAGRAM_FEATURED_REEL_URL = 'https:\/\/www\.instagram\.com\/reel\/DgOvjmyF-U9\/'/);
    assert.match(lib, /25 MiB/);
    assert.match(lib, /19,500,000/);
  });

  it('keeps the poster in public and the 39MB mp4 out of static assets', () => {
    const poster = join(root, 'public/films/cat-recognition/poster.jpg');
    assert.ok(existsSync(poster));
    const size = statSync(poster).size;
    assert.ok(size > 10_000 && size < 1_000_000, `poster size ${size}`);
    assert.equal(existsSync(join(root, 'public/films/cat-recognition/cat.mp4')), false);
    assert.equal(existsSync(join(root, 'public/films/cat-recognition/cat_final.mp4')), false);
    const cloudflareAssetCap = 25 * 1024 * 1024;
    function walk(dir: string) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, name.name);
        if (name.isDirectory()) walk(path);
        else if (name.name === 'cat_final.mp4' || name.name === 'cat.mp4' || statSync(path).size > cloudflareAssetCap) {
          assert.fail(`static asset over the Cloudflare 25 MiB cap or the cat mp4: ${path}`);
        }
      }
    }
    walk(join(root, 'public'));
  });
});
