/**
 * Homepage Instagram reel sits where the game promo cards were.
 * The permalink stays in INSTAGRAM_FEATURED_REEL_URL; an unset value
 * renders the profile card instead of a blockquote embed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  INSTAGRAM_FEATURED_REEL_URL,
  INSTAGRAM_PROFILE_URL,
  featuredReelUrl,
  instagramPermalink,
} from '../src/lib/instagramReel.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('featured Instagram reel permalink', () => {
  it('keeps the unset permalink in one constant and falls back', () => {
    assert.equal(INSTAGRAM_FEATURED_REEL_URL, '');
    assert.equal(featuredReelUrl(), null);
    assert.equal(INSTAGRAM_PROFILE_URL, 'https://www.instagram.com/noamdoronmath/');
    assert.equal(instagramPermalink(''), null);
    assert.equal(instagramPermalink('TODO'), null);
    assert.equal(instagramPermalink('https://www.instagram.com/noamdoronmath/'), null);
    assert.equal(instagramPermalink('http://www.instagram.com/reel/AbC123/'), null);
    assert.equal(instagramPermalink('https://instagram.com/reel/AbC123/'), null);
    assert.equal(instagramPermalink('javascript:alert(1)'), null);
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

  it('renders the heading, profile link, and a lazy official embed only for a real permalink', () => {
    const card = readFileSync(join(root, 'src/components/InstagramFeaturedReel.astro'), 'utf8');
    assert.match(card, /נועם דורון <\/span><span class="ig-feature__line">מתמטיקה<\/span><span class="ig-feature__sep"> - <\/span>/);
    assert.match(card, /לא משננים, מבינים\./);
    assert.match(card, /<h2 id="ig-feature-title"/);
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
    assert.match(card, /width: min\(100%, 480px\)/);
    assert.match(card, /max-width: 540px/);
    assert.ok(card.indexOf('reelUrl ?') < card.indexOf('class="instagram-media"'));
    assert.ok(card.indexOf('class="instagram-media"') < card.indexOf('ig-feature__card'));
    const lib = readFileSync(join(root, 'src/lib/instagramReel.ts'), 'utf8');
    assert.match(lib, /export const INSTAGRAM_FEATURED_REEL_URL/);
    assert.match(lib, /TODO/);
  });
});
