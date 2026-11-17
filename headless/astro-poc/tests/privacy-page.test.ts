/**
 * Legal audit 2026-11-15: standalone privacy policy, accessibility-only statement,
 * and privacy notices at each point where the site collects data.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { SITE_PAGE_M24_SLUGS, SITE_PAGE_POLICY_SLUGS, loadSitePage } from '../src/lib/sitePages';
import { resolveRedirect } from '../src/lib/redirects';

function pageText(slug: string) {
  return loadSitePage(slug)
    .blocks.map((b) => {
      if (b.type === 'ul' || b.type === 'ol') return b.items.map((i) => i.text).join('\n');
      return 'text' in b ? b.text : '';
    })
    .join('\n');
}

describe('privacy policy page (/privacy)', () => {
  it('is a registered policy page with its own route and no redirect', () => {
    assert.ok((SITE_PAGE_M24_SLUGS as readonly string[]).includes('privacy'));
    assert.ok((SITE_PAGE_POLICY_SLUGS as readonly string[]).includes('privacy'));
    assert.ok(existsSync('src/pages/privacy.astro'));
    assert.equal(resolveRedirect('/privacy'), null);
    const page = loadSitePage('privacy');
    assert.equal(page.h1, 'מדיניות פרטיות');
    assert.match(page.title, /מדיניות פרטיות/);
  });

  it('covers the Section 11 items: controller, data, purpose, recipients, abroad, rights', () => {
    const text = pageText('privacy');
    for (const needle of [
      'נועם דורון',
      'איזה מידע נאסף ולמה',
      'למי מועבר המידע',
      'העברת מידע לחו"ל',
      'כמה זמן שומרים',
      'הזכויות שלכם',
      'סעיף 13',
      'סעיף 14',
      'Supabase',
      'בריטניה',
      'Alibaba Cloud',
      'Wix',
      'reCAPTCHA',
      'מתחת לגיל 13',
      'noamd@noamdoronmath.co.il',
    ]) {
      assert.ok(text.includes(needle), `missing: ${needle}`);
    }
  });

  it('has a stable #ai anchor for the AI notices', () => {
    const ai = loadSitePage('privacy').blocks.find((b) => b.type === 'h2' && 'id' in b && b.id === 'ai');
    assert.ok(ai, 'h2 with id "ai"');
  });

  it('does not use a slash fraction in visible text', () => {
    assert.equal(/\d\s*\/\s*\d/.test(pageText('privacy')), false);
  });
});

describe('links point to /privacy instead of the old combined anchor', () => {
  it('footers, learning page and grade hubs', () => {
    const files = [
      'src/data/home-page.json',
      'public/learning.html',
      ...readdirSync('src/data/grade-hubs').map((f) => `src/data/grade-hubs/${f}`),
    ];
    for (const f of files) {
      assert.ok(!readFileSync(f, 'utf8').includes('accessibilityadaptation#privacy-policy'), f);
    }
    assert.ok(readFileSync('public/learning.html', 'utf8').includes('href="/privacy"'));
    const sitePage = readFileSync('src/components/SitePage.astro', 'utf8');
    assert.ok(sitePage.includes("{ href: '/privacy', label: 'מדיניות פרטיות' }"));
  });
});

describe('notices at the point of collection', () => {
  it('contact form explains purpose, storage, rights and the under-13 rule before submit', () => {
    const tpl = readFileSync('src/components/SitePage.astro', 'utf8');
    const notice = tpl.indexOf('data-contact-privacy');
    const submit = tpl.indexOf('<button type="submit">שליחה</button>');
    assert.ok(notice > 0 && submit > notice, 'notice sits before the submit button');
    const chunk = tpl.slice(notice, submit);
    assert.ok(chunk.includes('רשות'));
    assert.ok(chunk.includes('Wix'));
    assert.ok(chunk.includes('מתחת לגיל 13'));
    assert.ok(chunk.includes('href="/privacy"'));
  });

  it('Ramzi compose area shows an AI privacy note that is not hidden on phones', () => {
    const viewer = readFileSync('public/worksheet-viewer-noam.html', 'utf8');
    assert.ok(viewer.includes('id="noamPrivacyNote" data-ai-privacy-note'));
    assert.ok(viewer.includes('href="/privacy#ai"'));
    assert.ok(!/\.noam-privacy-note\s*\{[^}]*display\s*:\s*none/.test(viewer));
    assert.ok(/\.noam-privacy-note a\{[^}]*min-height:44px/.test(viewer), 'tap target at least 44px');
  });

  it('Noam AI companion shows the note outside compact mode', () => {
    const client = readFileSync('public/noam-site-companion.js', 'utf8');
    assert.ok(client.includes('id=\\"noam-site-companion-privacy\\"') || client.includes('id="noam-site-companion-privacy"'));
    assert.ok(client.includes('/privacy#ai'));
    assert.ok(client.includes('#noam-site-companion-privacy a{display:inline-flex;align-items:center;min-height:44px'));
  });

  it('teacher AI note warns not to include student names', () => {
    const wizard = readFileSync('src/teacher-pages/wizard.html', 'utf8');
    assert.ok(wizard.includes('לא לכתוב שמות של תלמידים או פרטים מזהים'));
  });

  it('learning sign-in explains the under-13 rule', () => {
    assert.ok(readFileSync('public/learning.html', 'utf8').includes('מתחת לגיל 13'));
  });
});

describe('terms no longer claim that nothing identifying is stored', () => {
  it('rendered blocks, legal blocks and the authoritative HTML agree', () => {
    const terms = loadSitePage('terms');
    const all = JSON.stringify([terms.blocks, terms.legalBlocks]);
    const html = readFileSync('src/data/site-pages/authoritative/terms-legal.html', 'utf8');
    for (const src of [all, html]) {
      assert.ok(!src.includes('לא נשמרים פרטים מזהים'));
      assert.ok(src.includes('Alibaba Cloud'));
      assert.ok(src.includes('https://www.noamdoronmath.co.il/privacy'));
    }
  });
});
