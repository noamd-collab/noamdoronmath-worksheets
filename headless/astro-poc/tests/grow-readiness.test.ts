/**
 * Grow merchant review: the site must publish the dealer identity, the age
 * limit, cancellation, delivery and warranty terms, and a checkout page with
 * the five customer fields and a terms checkbox that links to the terms.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import business from '../src/data/business.json';
import { loadSitePage } from '../src/lib/sitePages';
import {
  PLANS,
  buildPaymentRedirect,
  normalizePhone,
  validateCheckout,
} from '../src/lib/checkout';

function pageText(slug: string): string {
  const page = loadSitePage(slug);
  return page.blocks
    .map((block) => {
      if (block.type === 'ul' || block.type === 'ol') return block.items.map((i) => i.text).join('\n');
      return 'text' in block ? block.text : '';
    })
    .join('\n');
}

describe('Grow readiness — dealer identity', () => {
  it('publishes the business name, dealer number, address, phone and email', () => {
    assert.ok(business.name.length > 2, 'business name');
    assert.match(business.businessId, /^\d{9}$/, 'dealer number must be 9 digits');
    assert.ok(business.phone.replace(/\D/g, '').length >= 9, 'phone');
    assert.match(business.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'email');
    assert.ok(
      business.address.trim().length > 5,
      'business.address is empty: Grow rejects a site without a dealer address, and a placeholder must never be published'
    );
  });

  it('renders the identity in the footer on every page', () => {
    const footer = readFileSync('src/components/SiteFooter.astro', 'utf8');
    assert.ok(footer.includes('data-business-identity'));
    assert.ok(footer.includes('business.businessId'));
    assert.ok(footer.includes('business.address'));
    assert.ok(footer.includes('business.phone'));
  });

  it('shows the address and phone in the terms and in the purchase terms', () => {
    for (const slug of ['terms', 'purchase-terms', 'delivery']) {
      const text = pageText(slug);
      assert.ok(text.includes(business.businessId), `${slug}: dealer number`);
      assert.ok(text.includes(business.phone), `${slug}: phone`);
      assert.ok(text.includes(business.address), `${slug}: address`);
    }
  });
});

describe('Grow readiness — required legal sections', () => {
  it('terms include age limit, cancellation, delivery and warranty', () => {
    const text = pageText('terms');
    for (const needle of [
      '18',
      'גיל הרשאה לרכישה',
      'ביטול עסקה והחזר',
      'מסירת השירות ואספקה',
      'אחריות',
      'מספר עוסק',
      '14 יום',
      '7 ימי עסקים',
      'לא מתחדש אוטומטית',
    ]) {
      assert.ok(text.includes(needle), `terms missing: ${needle}`);
    }
  });

  it('cancellation page explains how to cancel, the 14-day rule and the pro-rata formula', () => {
    const text = pageText('cancellation');
    for (const needle of ['איך מבטלים', '14 יום', 'החזר יחסי', 'דמי ביטול', '7 ימי עסקים', 'אין חיוב חוזר']) {
      assert.ok(text.includes(needle), `cancellation missing: ${needle}`);
    }
  });

  it('delivery page explains that the service is digital and when access opens', () => {
    const text = pageText('delivery');
    for (const needle of ['שירות דיגיטלי', '24 שעות', 'אין משלוח', 'מסמך מס']) {
      assert.ok(text.includes(needle), `delivery missing: ${needle}`);
    }
  });

  it('privacy covers payment data, Grow and the seven-year retention', () => {
    const text = pageText('privacy');
    for (const needle of ['Grow', 'רכישה בתשלום', '7 שנים', 'אינם נשמרים אצלנו']) {
      assert.ok(text.includes(needle), `privacy missing: ${needle}`);
    }
  });

  it('the new pages are registered, routed and linked from the footer', () => {
    const home = readFileSync('src/data/home-page.json', 'utf8');
    for (const slug of ['purchase-terms', 'cancellation', 'delivery']) {
      assert.ok(existsSync(`src/pages/${slug}.astro`), `${slug}.astro`);
      assert.ok(existsSync(`src/data/site-pages/${slug}.json`), `${slug}.json`);
      assert.ok(home.includes(`"/${slug}"`), `footer link /${slug}`);
      const page = loadSitePage(slug);
      assert.ok(page.title.length > 5);
      assert.ok(page.blocks.length > 3);
    }
  });

  it('no legal page ships an unresolved placeholder', () => {
    const placeholders = ['[[', 'TODO', 'XXX', 'PLACEHOLDER', 'תושלם', 'להשלים'];
    const html = readFileSync('src/data/site-pages/authoritative/terms-legal.html', 'utf8');
    for (const slug of ['terms', 'privacy', 'purchase-terms', 'cancellation', 'delivery']) {
      const raw = readFileSync(`src/data/site-pages/${slug}.json`, 'utf8');
      for (const token of placeholders) {
        assert.ok(!raw.includes(token), `${slug} contains ${token}`);
        assert.ok(!html.includes(token), `terms-legal.html contains ${token}`);
      }
    }
  });
});

describe('Grow readiness — checkout page', () => {
  const page = readFileSync('src/pages/checkout.astro', 'utf8');

  it('collects the five fields Grow requires', () => {
    for (const field of ['firstName', 'lastName', 'phone', 'country', 'email']) {
      assert.ok(page.includes(`name="${field}"`), `checkout missing field: ${field}`);
    }
    assert.ok(page.includes('טלפון (ללא קידומת)'), 'phone label must say without the prefix');
    assert.ok(page.includes('co-phone__prefix'), 'the leading zero is added by the page, not typed');
  });

  it('has a required terms checkbox that links to the terms and the cancellation policy', () => {
    assert.ok(page.includes('name="terms"'));
    assert.ok(page.includes('required'));
    assert.ok(page.includes('href="/purchase-terms"'));
    assert.ok(page.includes('href="/cancellation"'));
    assert.ok(page.includes('href="/privacy"'));
    assert.ok(!page.includes('קראתי והבנתי'), 'do not use "I have read and understood"');
  });

  it('states the one-time payment and the price on the page', () => {
    assert.ok(page.includes('לא מתחדש אוטומטית'));
    assert.ok(page.includes('18'));
    assert.ok(page.includes('180'));
    assert.ok(page.includes('Grow'));
  });
});

describe('Grow readiness — checkout validation', () => {
  const valid = {
    plan: 'yearly',
    firstName: 'נועם',
    lastName: 'דורון',
    phone: '507746289',
    country: 'ישראל',
    email: 'noamd@noamdoronmath.co.il',
    terms: true,
  };

  it('accepts a phone without the prefix and stores it both ways', () => {
    const result = validateCheckout(valid);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.phoneNational, '507746289');
      assert.equal(result.value.phone, '0507746289');
      assert.equal(result.value.plan, 'yearly');
      assert.equal(PLANS.yearly.price, 180);
    }
  });

  it('accepts a phone typed with the leading zero', () => {
    const result = validateCheckout({ ...valid, phone: '050-774-6289' });
    assert.equal(result.ok, true);
  });

  it('rejects a short phone, a landline and a missing prefix', () => {
    assert.equal(normalizePhone('12345').ok, false);
    assert.equal(normalizePhone('02-1234567').ok, false);
    assert.equal(normalizePhone('').ok, false);
  });

  it('rejects a missing terms consent', () => {
    const result = validateCheckout({ ...valid, terms: false });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'TERMS_NOT_ACCEPTED');
  });

  it('rejects an invalid email and an unknown plan', () => {
    assert.equal(validateCheckout({ ...valid, email: 'noam@' }).ok, false);
    assert.equal(validateCheckout({ ...valid, plan: 'weekly' }).ok, false);
  });

  it('builds a Grow redirect only when the link is configured', () => {
    assert.equal(buildPaymentRedirect(validateCheckout(valid).ok ? (validateCheckout(valid) as any).value : null, {}), null);
    const url = buildPaymentRedirect(
      (validateCheckout(valid) as any).value,
      { GROW_PAYMENT_URL_YEARLY: 'https://pay.grow.business/example' }
    );
    assert.ok(url?.startsWith('https://pay.grow.business/example?'));
    assert.ok(url?.includes('sum=180'));
    assert.ok(url?.includes('phone=507746289'));
  });
});
