/**
 * Homepage Instagram reel, in the slot that held the game promo cards.
 * A non-permalink value still shows the profile card instead of an embed.
 */
export const INSTAGRAM_FEATURED_REEL_URL = 'https://www.instagram.com/reel/DgKT5HMOfTy/';

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
