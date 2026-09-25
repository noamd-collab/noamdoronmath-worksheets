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
 *  - twitter:image, when there is an image.
 * canonical, og:url and og:type are deliberately NOT emitted here: Wix injects them
 * per path, and after the domain moves its canonical is https://www.noamdoronmath.co.il/…
 * A second canonical from code would be worse than none.
 */

export type SeoMetaTag = { property?: string; name?: string; content: string };

export type BlogSeoInput = {
  description?: string;
  /** Image BaseLayout received as ogImage (post.ogImage || post.coverImage, archive.ogImage). */
  image?: string;
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

/** Tags that complete the blog <head> without duplicating BaseLayout or the Wix injection. */
export function buildBlogSeoComplement(input: BlogSeoInput): SeoMetaTag[] {
  const description = clean(input.description);
  const image = isHttpsUrl(input.image) ? input.image : undefined;
  const tags: SeoMetaTag[] = [];
  if (description && !image) tags.push({ property: 'og:description', content: description });
  if (description) tags.push({ name: 'twitter:description', content: description });
  if (image) tags.push({ name: 'twitter:image', content: image });
  return tags;
}
