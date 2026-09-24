/**
 * HEADLESS-MIGRATION-31 — homepage Harmony content/interaction parity gates.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { homePageRequiredHrefs, loadHomePage } from '../src/lib/homePage.ts';

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

  it('index page wires fixture sections and does not invent privacy URL /privacy', () => {
    const index = readFileSync(join(root, 'src', 'pages', 'index.astro'), 'utf8');
    assert.ok(index.includes('data-home-dev-notice'));
    assert.ok(index.includes('data-home-search-cta'));
    assert.ok(index.includes('data-home-grades'));
    assert.ok(index.includes('data-home-learning'));
    assert.ok(index.includes('data-home-values'));
    assert.ok(index.includes('data-home-whatsapp'));
    assert.ok(index.includes('SiteFooter'));
    assert.ok(!index.includes('href="/privacy"'));
  });

  it('SiteHeader exposes Harmony primary nav destinations', () => {
    const html = readFileSync(join(root, 'src', 'components', 'SiteHeader.astro'), 'utf8');
    for (const needle of [
      'href="/"',
      'href="/aboutus"',
      'href="/worksheets"',
      'href="/blog"',
      'href="/math-tools"',
      'href="/high-school-math-1"',
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
    assert.ok(hrefs.includes('/high-school-math-1'));
    assert.ok(hrefs.includes('/accessibilityadaptation'));
    assert.ok(hrefs.includes('/accessibilityadaptation#privacy-policy'));
    assert.ok(hrefs.includes('mailto:noamd@noamdoronmath.co.il'));
  });
});

