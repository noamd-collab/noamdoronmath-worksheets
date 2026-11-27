/**
 * Homepage film slot. It is the place that held Eliyahu's game promo cards
 * (removed in PR 625). PR 654 put the Instagram block here.
 *
 * The approved cat explainer is cat_final.mp4 (39,286,198 bytes,
 * md5 d3369b4ff03472654049d02025397d3a, 1080×1920, 136.6s). It is not in this
 * repo. Hosting it the way the grade-8 statistics film is hosted would copy
 * it from public/ into the Astro build. @wix/astro-wix-hosting-adapter serves
 * those files as Cloudflare static assets, and Cloudflare's per-file cap is
 * 25 MiB. The Wix worker payload budget is 19,500,000 bytes, so the mp4 must
 * not be imported into a server module either. Wix Media Manager accepts a
 * video this size, and uploading there needs site credentials, which this
 * change does not use. Until that upload exists, the slot embeds the same
 * reel: https://www.instagram.com/reel/DgOvjmyF-U9/
 * Reels the owner already deleted stay unset.
 */
export const INSTAGRAM_FEATURED_REEL_URL = 'https://www.instagram.com/reel/DgOvjmyF-U9/';

export const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/noamdoronmath/';

/** Approved still of the cat explainer. Small enough for public/. */
export const CAT_FILM_POSTER = '/films/cat-recognition/poster.jpg';

export const CAT_FILM_TITLE = 'איך מחשב מזהה חתול? רק עם מתמטיקה של חטיבה';

export const CAT_FILM_AI_NOTE = 'הסרטון נוצר באמצעות AI';

const REEL_PERMALINK =
  /^https:\/\/www\.instagram\.com\/(?:reel|p|tv)\/[A-Za-z0-9_-]+\/?(?:\?[^#\s]*)?$/;

/** A permalink embed.js can load, or null when the constant is still unset. */
export function instagramPermalink(value: string): string | null {
  const url = value.trim();
  return REEL_PERMALINK.test(url) ? url : null;
}

export function featuredReelUrl(): string | null {
  return instagramPermalink(INSTAGRAM_FEATURED_REEL_URL);
}
