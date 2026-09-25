/**
 * Blog SEO (post + archive pages) on Wix-managed Headless.
 *
 * What already fills the <head> of these pages:
 *  - BaseLayout (code): <title>, meta description, and og:image/og:title/og:description
 *    only when the page has an image.
 *  - Wix's request-time main-page injection (tags marked wix-seo-tag="true"; every
 *    route in /_wix/pages.json gets it, observed on the 4awuw0 preview): a second
 *    <title>, canonical, og:title, og:url, og:type, og:site_name, twitter:card,
 *    twitter:title. It can't be switched off from code.
 *
 * So this module adds only what neither source provides, which keeps every tag single:
 *  - og:description, when BaseLayout skipped it (no image);
 *  - twitter:description, always;
 *  - twitter:image, when there is an image;
 *  - og:image:width and og:image:height, only when the blog JSON stores both on the
 *    ImageObject for that image. Neither BaseLayout nor the Wix injection emits them.
 *    If the JSON has no dimensions, those two tags are skipped. The `w_…,h_…` segment
 *    of a Wix media URL is a resize transform, not a stored size, and is never parsed.
 * canonical, og:url and og:type are deliberately NOT emitted here: Wix injects them
 * per path, and after the domain moves its canonical is https://www.noamdoronmath.co.il/…
 * A second canonical from code would be worse than none.
 */

export type SeoMetaTag = { property?: string; name?: string; content: string };

export type BlogSeoInput = {
  description?: string;
  /** Image BaseLayout received as ogImage (post.ogImage || post.coverImage, archive.ogImage). */
  image?: string;
  /**
   * Blog JSON-LD (post.jsonLd / archive.jsonLd). Image dimensions are read only
   * from a stored ImageObject whose url is `image`. Absent dimensions are skipped.
   */
  jsonLd?: unknown;
};

const clean = (s: string | undefined) => (s || '').replace(/\s+/g, ' ').trim();

export function isHttpsUrl(v: string | undefined): v is string {
  if (!v) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

/** Positive pixel count stored as a JSON number or digit string. Never parsed from a URL. */
function storedPixels(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string' && /^[1-9]\d{0,5}$/.test(v)) return Number(v);
  return undefined;
}

/**
 * Width and height only when the blog JSON stores both on the ImageObject for `image`.
 * Returns undefined when the JSON has no dimensions — callers then skip og:image:width
 * and og:image:height. A Wix `w_…,h_…` URL transform is not a stored size and is ignored.
 */
export function storedImageDimensions(
  jsonLd: unknown,
  image: string | undefined,
): { width: number; height: number } | undefined {
  if (!image) return undefined;
  const blocks = Array.isArray(jsonLd) ? jsonLd : [];
  for (const block of blocks) {
    const rec = asRecord(block);
    if (!rec) continue;
    const images = Array.isArray(rec.image) ? rec.image : rec.image ? [rec.image] : [];
    for (const item of images) {
      const img = asRecord(item);
      if (!img || img.url !== image) continue;
      const width = storedPixels(img.width);
      const height = storedPixels(img.height);
      if (width === undefined || height === undefined) return undefined;
      return { width, height };
    }
  }
  return undefined;
}

/** Tags that complete the blog <head> without duplicating BaseLayout or the Wix injection. */
export function buildBlogSeoComplement(input: BlogSeoInput): SeoMetaTag[] {
  const description = clean(input.description);
  const image = isHttpsUrl(input.image) ? input.image : undefined;
  const tags: SeoMetaTag[] = [];
  if (description && !image) tags.push({ property: 'og:description', content: description });
  if (description) tags.push({ name: 'twitter:description', content: description });
  if (image) tags.push({ name: 'twitter:image', content: image });
  const size = image ? storedImageDimensions(input.jsonLd, image) : undefined;
  if (size) {
    tags.push({ property: 'og:image:width', content: String(size.width) });
    tags.push({ property: 'og:image:height', content: String(size.height) });
  }
  return tags;
}
