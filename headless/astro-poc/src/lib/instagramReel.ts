/**
 * Homepage Instagram reel, in the slot that held the game promo cards.
 *
 * TODO: set INSTAGRAM_FEATURED_REEL_URL to the next reel permalink once it
 * is published, for example https://www.instagram.com/reel/SHORTCODE/
 * The previous reel was removed by its owner. Until this is a real reel,
 * post, or TV permalink, the homepage shows the profile card.
 */
export const INSTAGRAM_FEATURED_REEL_URL = '';

export const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/noamdoronmath/';

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
