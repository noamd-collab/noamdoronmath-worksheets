/**
 * HEADLESS-MIGRATION-31 — homepage Harmony content/interaction parity gates.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { homePageJsonLd, homePageRequiredHrefs, loadHomePage } from '../src/lib/homePage.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const home = loadHomePage();

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
    assert.ok(index.includes('data-home-dev-notice'));
    assert.ok(index.includes('data-home-search-cta'));
    assert.ok(index.includes('data-home-grades'));
    assert.ok(index.includes('data-home-learning'));
    assert.ok(index.includes('data-home-values'));
    assert.ok(index.includes('data-home-whatsapp'));
    assert.ok(!index.includes('SiteFooter')); // footer moved to BaseLayout (every page)
    assert.ok(!index.includes('href="/privacy"'));
  });

  it('BaseLayout renders the shared footer exactly once per page', () => {
    const layout = readFileSync(join(root, 'src', 'layouts', 'BaseLayout.astro'), 'utf8');
    assert.ok(layout.includes('SiteFooter'));
    assert.strictEqual(layout.split('<SiteFooter').length - 1, 1);
  });

  it('SiteHeader exposes Harmony primary nav destinations', () => {
    const html = readFileSync(join(root, 'src', 'components', 'SiteHeader.astro'), 'utf8');
    for (const needle of [
      'href="/"',
      'href="/aboutus"',
      'href="/worksheets"',
      'href="/blog"',
      'href="/math-tools"',
      'href="/high-school-math"',
      'href="/learning.html"',
      'תוספים',
      'מתמטיקה לתיכון (חיצוני)',
    ]) {
      assert.ok(html.includes(needle), `missing ${needle}`);
    }
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

