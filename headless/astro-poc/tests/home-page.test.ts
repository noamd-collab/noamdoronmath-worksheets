/**
 * HEADLESS-MIGRATION-31 — homepage Harmony content/interaction parity gates.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { homePageJsonLd, homePageRequiredHrefs, loadHomePage } from '../src/lib/homePage.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const home = loadHomePage();

function webpDimensions(path: string): [number, number] {
  const image = readFileSync(path);
  assert.equal(image.subarray(0, 4).toString('ascii'), 'RIFF', `not a WebP: ${path}`);
  assert.equal(image.subarray(8, 12).toString('ascii'), 'WEBP', `not a WebP: ${path}`);
  for (let offset = 12; offset + 8 <= image.length;) {
    const chunk = image.subarray(offset, offset + 4).toString('ascii');
    const length = image.readUInt32LE(offset + 4);
    if (chunk === 'VP8X') {
      return [
        1 + image.readUIntLE(offset + 12, 3),
        1 + image.readUIntLE(offset + 15, 3),
      ];
    }
    offset += 8 + length + (length % 2);
  }
  throw new Error(`missing VP8X dimensions: ${path}`);
}

describe('homepage Harmony parity (HEADLESS-MIGRATION-31)', () => {
  it('loads source-backed home fixture with grades 1–9 and AI on 7–9 only', () => {
    assert.equal(home.grades.length, 9);
    for (let g = 1; g <= 9; g++) {
      const row = home.grades.find((x) => x.grade === g);
      assert.ok(row, `missing grade ${g}`);
      assert.equal(row.href, `/grade-${g}`);
      assert.equal(row.ai, g >= 7);
    }
  });

  it('preserves search CTA, learning/Google, WhatsApp; privacy links to combined page', () => {
    assert.equal(home.hero.searchCta.label, 'למציאת משימת תרגול');
    assert.equal(home.hero.searchCta.href, '/worksheets');
    assert.equal(home.learning.googleHref, '/learning.html?signin=google');
    assert.equal(home.learning.learningHref, '/learning.html');
    assert.match(home.learning.learningLabel, /הלמידה שלי/);
    assert.equal(
      home.whatsapp.ctaHref,
      'https://chat.whatsapp.com/DOepmlK5bKxCBbbGMusLdF?mode=gi_t'
    );
    assert.match(home.whatsapp.note, /ההצטרפות לבחירתכם/);
    assert.equal(home.footer.email, 'noamd@noamdoronmath.co.il');

    const byLabel = Object.fromEntries(home.footer.legal.map((l) => [l.label, l]));
    assert.equal(byLabel['תקנון שימוש בדפי עבודה חינמיים'].href, '/conditionforfreeworksheets');
    assert.equal(byLabel['תנאי השימוש'].href, '/terms');
    assert.equal(byLabel['הצהרת נגישות'].href, '/accessibilityadaptation');
    // Combined accessibility+privacy page (verified); stable privacy-section anchor.
    assert.equal(byLabel['מדיניות פרטיות'].href, '/accessibilityadaptation#privacy-policy');
    assert.notEqual(byLabel['מדיניות פרטיות'].knownGap, true);
    assert.match(home.footer.privacyNote, /פרטיות/);
    assert.doesNotMatch(home.footer.privacyNote, /פער ידוע|אין יעד תקף|מסומן ולא כקישור/);
  });

  it('value sections keep live Hebrew titles', () => {
    const titles = home.valueSections.items.map((i) => i.title);
    assert.deepEqual(titles, ['חטיבת ביניים', 'יסודי ומוכנות', 'אתגר והעשרה']);
  });

  it('homepage JSON-LD keeps LocalBusiness and WebSite and adds EducationalOrganization', () => {
    const blocks = homePageJsonLd();
    const types = blocks.map((b) => b['@type']);
    assert.deepEqual(types, ['LocalBusiness', 'WebSite', 'EducationalOrganization']);

    const org = blocks.find((b) => b['@type'] === 'EducationalOrganization')!;
    assert.equal(org.name, 'נועם דורון');
    assert.equal(org.url, 'https://www.noamdoronmath.co.il/');
    assert.equal(org.logo, 'https://www.noamdoronmath.co.il/brand/noam-doron-math-logo-cropped.png');
    const about = org.subjectOf as { '@type': string; url: string };
    assert.equal(about['@type'], 'AboutPage');
    assert.equal(about.url, 'https://www.noamdoronmath.co.il/aboutus');
    assert.ok(
      existsSync(join(root, 'public', 'brand', 'noam-doron-math-logo-cropped.png')),
      'logo file missing from public/brand'
    );

    const local = blocks.find((b) => b['@type'] === 'LocalBusiness')!;
    assert.equal(local.name, 'נועם דורון מתמטיקה');
    assert.equal(local.url, 'https://www.noamdoronmath.co.il');
    const site = blocks.find((b) => b['@type'] === 'WebSite')!;
    assert.equal(site.url, 'https://www.noamdoronmath.co.il');

    const index = readFileSync(join(root, 'src', 'pages', 'index.astro'), 'utf8');
    assert.ok(index.includes('homePageJsonLd'));
    assert.ok(index.includes('application/ld+json'));
    const layout = readFileSync(join(root, 'src', 'layouts', 'BaseLayout.astro'), 'utf8');
    assert.ok(!layout.includes('EducationalOrganization'));
  });

  it('index page wires fixture sections and does not invent privacy URL /privacy', () => {
    const index = readFileSync(join(root, 'src', 'pages', 'index.astro'), 'utf8');
    assert.ok(!index.includes('data-home-dev-notice'));
    assert.ok(!index.includes('home-notice'));
    assert.ok(index.includes('data-home-search-cta'));
    assert.ok(index.includes('data-home-grades'));
    assert.ok(index.includes('data-home-learning'));
    assert.ok(index.includes('data-home-values'));
    assert.ok(index.includes('data-home-whatsapp'));
    assert.ok(!index.includes('SiteFooter')); // footer moved to BaseLayout (every page)
    assert.ok(!index.includes('href="/privacy"'));
  });

  it('right-sizes decorative homepage doodles without sacrificing 2x candidates or the original fallback', () => {
    const index = readFileSync(join(root, 'src', 'pages', 'index.astro'), 'utf8');
    const doodles = [
      'kite', 'snail', 'paper-boat', 'curious-cat',
      'geometry-fish', 'cube-plant', 'sleepy-owl', 'telescope',
    ];
    for (const name of doodles) {
      const original = join(root, 'public', 'design-exact', 'assets', 'doodles', `${name}.webp`);
      const responsive = join(root, 'public', 'design-exact', 'assets', 'doodles', `${name}-240.webp`);
      assert.deepEqual(webpDimensions(responsive), [240, 240], `${name} responsive dimensions`);
      assert.ok(statSync(responsive).size < statSync(original).size, `${name} responsive rendition is smaller`);
    }
    assert.match(index, /g\.img\.replace\('\.webp', '-240\.webp'\).*240w, \$\{g\.img\} 400w/,
      'all six grade-tile doodles share 240w and 400w candidates');
    for (const name of ['kite', 'snail', 'paper-boat', 'cube-plant', 'sleepy-owl', 'telescope']) {
      assert.ok(index.includes(`${name}-240.webp 240w`), `${name} has a direct 240w candidate`);
      assert.ok(index.includes(`${name}.webp 400w`), `${name} retains its direct 400w candidate`);
    }
    assert.ok(index.includes('sizes="112px"'), 'grade tiles declare their rendered width');
    assert.ok(index.includes('sizes="200px"'), 'large doodles retain a 400w/2x candidate');
    assert.ok(index.includes('fetchpriority="low"'), 'non-content hero doodles do not compete with the text LCP');
    assert.ok(!index.includes('fetchpriority="high"'), 'no decorative homepage image is promoted over content');
  });

  it('defers the below-the-fold game-promo image while preserving its explicit size and alt text', () => {
    const promo = readFileSync(join(root, 'src', 'components', 'GamePromoCard.astro'), 'utf8');
    assert.match(promo, /src="\/games\/kefel-mekutsar-card\.webp"/);
    assert.match(promo, /width="960"/);
    assert.match(promo, /height="508"/);
    assert.match(promo, /alt="ריבוע \(a\+b\) מהמשחק/);
    assert.match(promo, /loading="lazy"/);
    assert.match(promo, /decoding="async"/);
  });

  it('BaseLayout renders the shared footer exactly once per page', () => {
    const layout = readFileSync(join(root, 'src', 'layouts', 'BaseLayout.astro'), 'utf8');
    assert.ok(layout.includes('SiteFooter'));
    assert.strictEqual(layout.split('<SiteFooter').length - 1, 1);
  });

  it('SiteFooter exposes verified Instagram, Facebook, WhatsApp only (no invented networks)', () => {
    const html = readFileSync(join(root, 'src', 'components', 'SiteFooter.astro'), 'utf8');
    assert.ok(html.includes('https://www.instagram.com/noamdoronmath/'));
    assert.ok(html.includes('https://www.facebook.com/profile.php?id=61593749281930'));
    assert.ok(
      html.includes('https://chat.whatsapp.com/DOepmlK5bKxCBbbGMusLdF?mode=gi_t')
    );
    assert.ok(html.includes('target="_blank"'));
    assert.ok(html.includes('rel="noopener"'));
    assert.ok(html.includes('אינסטגרם של נועם דורון מתמטיקה'));
    assert.ok(html.includes('פייסבוק של נועם דורון מתמטיקה'));
    assert.ok(html.includes("network: 'instagram'"));
    assert.ok(html.includes("network: 'facebook'"));
    assert.ok(html.includes("network: 'whatsapp'"));
    assert.ok(html.includes('data-footer-social={item.network}'));
    assert.ok(html.includes('aria-label={item.label}'));
    assert.ok(!html.includes('tiktok.com'));
    // high-school third-party YouTube must not be treated as brand social
    assert.ok(!html.includes('youtube.com'));
  });

  it('SiteHeader exposes Harmony primary nav destinations', () => {
    const html = readFileSync(join(root, 'src', 'components', 'SiteHeader.astro'), 'utf8');
    for (const needle of [
      'href="/"',
      'href="/aboutus"',
      'href="/worksheets?level=ysodi"',
      'href="/worksheets?level=hatzava"',
      'דפי עבודה ליסודי',
      'דפי עבודה לחטיבת הביניים',
      'href="/blog"',
      'href="/math-tools"',
      'href="/high-school-math"',
      'href="/learning.html"',
      'תוספים',
      'מתמטיקה לתיכון',
      'href="/teachers"',
      'למורים',
      'aria-label="למורים, חדש"',
      'data-peek="teachers"',
      'חדש',
    ]) {
      assert.ok(html.includes(needle), `missing ${needle}`);
    }
    assert.match(html, /href="\/high-school-math"[^>]*>\s*מתמטיקה לתיכון\s*(?:↗|\(חיצוני\))\s*<\/a>/,
      'high-school destination retains its visible external indicator');
    assert.equal(html.includes('הביינים'), false, 'must use הביניים spelling');
    assert.doesNotMatch(html, /href="\/worksheets"[^>]*>\s*דפי עבודה\s*</,
      'single worksheets nav item must be split');
    assert.match(html, /<button[^>]*aria-controls="primary-nav"[^>]*data-nav-toggle/,
      'mobile menu button is present');
    assert.match(html, /<nav id="primary-nav"[^>]*data-nav-panel/);
  });

  it('required href set is complete for gate scripts', () => {
    const hrefs = homePageRequiredHrefs(home);
    for (const g of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      assert.ok(hrefs.includes(`/grade-${g}`));
    }
    assert.ok(hrefs.includes('/math-tools'));
    assert.ok(hrefs.includes('/high-school-math'));
    assert.ok(!hrefs.includes('/high-school-math-1'), 'link the target, not the 301');
    assert.ok(hrefs.includes('/accessibilityadaptation'));
    assert.ok(hrefs.includes('/accessibilityadaptation#privacy-policy'));
    assert.ok(hrefs.includes('mailto:noamd@noamdoronmath.co.il'));
  });
});
