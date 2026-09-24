import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  SITE_PAGE_M24_SLUGS,
  SITE_PAGE_M24_REDIRECTS,
  SITE_PAGE_POLICY_SLUGS,
  loadSitePage,
  localizeSiteHref,
} from '../src/lib/sitePages';

describe('M24 site / policy pages', () => {
  it('manifest has 6 migrated exact pages + 2 redirects', () => {
    assert.equal(SITE_PAGE_M24_SLUGS.length, 6);
    assert.equal(SITE_PAGE_M24_REDIRECTS.length, 2);
    assert.deepEqual(
      SITE_PAGE_M24_REDIRECTS.map((r) => r.from).sort(),
      ['high-school-math-1', 'page'].sort()
    );
  });

  it('conditionforfreeworksheets is classified as policy (not topic SEO)', () => {
    assert.ok((SITE_PAGE_POLICY_SLUGS as readonly string[]).includes('conditionforfreeworksheets'));
    assert.ok((SITE_PAGE_M24_SLUGS as readonly string[]).includes('conditionforfreeworksheets'));
  });

  it('each migrated slug has Astro route + JSON with title/h1/blocks', () => {
    for (const slug of SITE_PAGE_M24_SLUGS) {
      assert.ok(existsSync(`src/pages/${slug}.astro`), slug);
      assert.ok(existsSync(`src/data/site-pages/${slug}.json`), slug);
      const page = loadSitePage(slug);
      assert.ok(page.title.length > 5, slug);
      assert.ok(page.description.length > 10, slug);
      assert.ok(page.h1.length > 2, slug);
      assert.ok(page.blocks.length >= 1, slug);
    }
  });

  it('aboutus preserves bio and wires dry-run contact form (no live Wix submit)', () => {
    const page = loadSitePage('aboutus');
    assert.equal(page.formSkipped, false);
    const bio = page.blocks.find((b) => b.type === 'p' && b.text.includes('שמי נועם דורון'));
    assert.ok(bio);
    const contact = page.blocks.find((b) => b.type === 'contact');
    assert.ok(contact && contact.type === 'contact');
    if (contact && contact.type === 'contact') {
      assert.equal(contact.mailto, 'mailto:noamd@noamdoronmath.co.il');
      assert.ok(contact.fieldsShownAsLabels.includes('שם פרטי'));
      assert.equal(contact.wixForm?.submitMode, 'dry-run');
      assert.equal(contact.wixForm?.formId, 'b8f7e551-c9bd-44a1-8371-45c115344b8f');
      assert.equal(contact.wixForm?.componentId, 'comp-mrxgdvcl');
    }
    const tpl = readFileSync('src/components/SitePage.astro', 'utf8');
    assert.ok(tpl.includes('data-contact-form'));
    assert.ok(tpl.includes('nd-contact-form.js'));
    assert.ok(existsSync('public/nd-contact-form.js'));
    // Client POSTs to /api/contact-form (server dry-run); copy must not claim "no server send".
    assert.ok(tpl.includes('מצב בדיקה בלבד וההודעה אינה נמסרת לבעל האתר'));
    assert.ok(!tpl.includes('אינו שולח הודעה לשרת'));
    const client = readFileSync('public/nd-contact-form.js', 'utf8');
    assert.ok(client.includes("fetch('/api/contact-form'"));
    assert.ok(client.includes('ההודעה לא נמסרה לבעל האתר'));
  });

  it('site entry gate uses production copy with combined privacy href', () => {
    assert.ok(existsSync('public/nd-site-gate.js'));
    const gate = readFileSync('public/nd-site-gate.js', 'utf8');
    assert.ok(gate.includes("STORAGE_KEY = 'nd_gate_accepted_v1'"));
    assert.ok(gate.includes('הבהרה'));
    assert.ok(gate.includes('אישור וכניסה לאתר'));
    assert.ok(gate.includes('/accessibilityadaptation#privacy-policy'));
    assert.ok(gate.includes('/terms'));
    assert.ok(!gate.includes("PRIVACY_URL = '/privacy'"));
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.ok(layout.includes('nd-site-gate.js'));
  });

  it('terms serves code-owned legal body from authoritative HTML (no filesusr iframe)', () => {
    const page = loadSitePage('terms');
    // Provenance retained, but rendered body must not depend on iframe
    assert.ok(page.legalIframeSrc?.includes('filesusr.com'));
    assert.ok((page.legalBlocks?.length || 0) >= 10);
    assert.ok(!page.blocks.some((b) => b.type === 'iframe'));
    const service = page.blocks.find(
      (b) => (b.type === 'h2' || b.type === 'h3') && 'text' in b && /1\.\s*השירות/.test(b.text)
    );
    assert.ok(service);
    const privacy = page.blocks.find(
      (b) => b.type === 'p' && b.segments?.some((s) => s.type === 'a' && s.href.includes('accessibilityadaptation'))
    );
    assert.ok(privacy);
    const contact = page.blocks.find(
      (b) => b.type === 'p' && b.segments?.some((s) => s.type === 'a' && s.href.startsWith('mailto:'))
    );
    assert.ok(contact);
    const html = readFileSync('src/data/site-pages/authoritative/terms-legal.html', 'utf8');
    assert.ok(html.includes('1. השירות'));
    assert.ok(html.includes('noamd@noamdoronmath.co.il'));
  });

  it('accessibilityadaptation is a combined a11y+privacy page (existence only; not legal rewrite)', () => {
    const page = loadSitePage('accessibilityadaptation');
    assert.match(page.h1, /נגישות.*פרטיות|פרטיות.*נגישות/);
    const privacyH2 = page.blocks.find((b) => b.type === 'h2' && b.text === 'מדיניות פרטיות');
    assert.ok(privacyH2);
    for (const h3 of [
      'איזה מידע נאסף באתר?',
      'הגנה על קטינים',
      'כיצד אנו משתמשים במידע?',
      'אחסון המידע (Wix)',
      'שימוש בעוגיות (Cookies)',
      'זכויותיכם ופרטי קשר',
    ]) {
      assert.ok(
        page.blocks.some((b) => b.type === 'h3' && b.text === h3),
        `missing privacy H3: ${h3}`
      );
    }
    const sitePage = readFileSync('src/components/SitePage.astro', 'utf8');
    assert.ok(sitePage.includes("id = block.text === 'מדיניות פרטיות' ? 'privacy-policy'"));
  });


  it('conditionforfreeworksheets preserves full תקנון wording', () => {
    const page = loadSitePage('conditionforfreeworksheets');
    const body = page.blocks.find((b) => b.type === 'p');
    assert.ok(body && body.type === 'p');
    if (body && body.type === 'p') {
      assert.ok(body.text.includes('נועם דורון - מתמטיקה'));
      assert.ok(body.text.includes('שימוש מסחרי'));
      assert.ok(body.text.length > 400);
    }
  });

  it('math-tools preserves calculator iframes and inline archive links', () => {
    const page = loadSitePage('math-tools');
    const iframes = page.blocks.filter((b) => b.type === 'iframe');
    assert.ok(iframes.length >= 1);
    const archive = page.blocks.find(
      (b) => b.type === 'p' && b.text.includes('ארכיון דפי העבודה')
    );
    assert.ok(archive && archive.type === 'p' && archive.segments?.some((s) => s.type === 'a'));
    const preview = page.blocks.filter((b) => b.region === 'calculator-preview');
    assert.ok(preview.length >= 1);
    assert.ok(preview.some((b) => b.type === 'iframe'));
    assert.equal(
      page.blocks.some((b) => b.type === 'p' && b.text.trim() === '3/4'),
      false
    );
    assert.ok(page.source.removedOrphans?.some((item) => item.text === '3/4'));
    const formula = page.blocks.find((b) => b.type === 'p' && b.text.includes('√72'));
    assert.ok(formula && formula.type === 'p');
    if (formula && formula.type === 'p') {
      assert.equal(formula.text, '√72 = 6√2');
      assert.equal(formula.dir, 'ltr');
    }
  });

  it('high-school-math has ordered H2 sections without duplicate bagrut heading', () => {
    const page = loadSitePage('high-school-math');
    const h2s = page.blocks.filter((b) => b.type === 'h2').map((b) => (b.type === 'h2' ? b.text : ''));
    assert.ok(h2s.includes('בוחרים רמת לימוד'));
    assert.ok(h2s.includes('בגרויות משנים קודמות — לפי שאלון'));
    assert.equal(h2s.filter((t) => t.includes('בגרויות משנים')).length, 1);
  });

  it('localizeSiteHref maps production site URLs to local paths', () => {
    assert.equal(
      localizeSiteHref('https://www.noamdoronmath.co.il/aboutus'),
      '/aboutus'
    );
    assert.equal(
      localizeSiteHref('https://www.noamdoronmath.co.il/conditionforfreeworksheets'),
      '/conditionforfreeworksheets'
    );
    assert.equal(localizeSiteHref('mailto:noamd@noamdoronmath.co.il'), 'mailto:noamd@noamdoronmath.co.il');
    assert.ok(localizeSiteHref('https://www.geekhero.co.il/x').startsWith('https://'));
  });

  it('SitePage template and redirect routes exist', () => {
    const tpl = readFileSync('src/components/SitePage.astro', 'utf8');
    assert.ok(tpl.includes('data-site-body'));
    assert.ok(tpl.includes('data-contact-fallback'));
    assert.ok(existsSync('src/pages/high-school-math-1.astro'));
    assert.ok(existsSync('src/pages/page.astro'));
    const r1 = readFileSync('src/pages/high-school-math-1.astro', 'utf8');
    const r2 = readFileSync('src/pages/page.astro', 'utf8');
    assert.ok(r1.includes("redirect('/high-school-math'"));
    assert.ok(r2.includes("redirect('/terms'"));
  });

  it('audit classifier treats conditionforfreeworksheets as policy before worksheet keyword', () => {
    const src = readFileSync('scripts/audit-production-routes.mjs', 'utf8');
    assert.ok(src.includes('POLICY_PATHS'));
    assert.ok(src.includes('hasExactSitePageRoute'));
    assert.ok(src.includes("'/conditionforfreeworksheets'"));
    // policy check appears before worksheet topic-seo branch
    const policyIdx = src.indexOf('POLICY_PATHS.has(pathname)');
    const worksheetIdx = src.indexOf("pathname.includes('worksheet')");
    assert.ok(policyIdx > 0 && worksheetIdx > policyIdx);
  });
});
