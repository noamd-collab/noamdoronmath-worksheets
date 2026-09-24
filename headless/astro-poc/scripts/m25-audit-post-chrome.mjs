import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';
const posts = readdirSync('src/data/blog-posts')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`src/data/blog-posts/${f}`, 'utf8')));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const rows = [];
for (const post of posts) {
  const page = await browser.newPage();
  await page.goto(PROD + post.path, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
  } catch {}

  const info = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const article = document.querySelector('[data-hook="post"]') || document.querySelector('article');
    const desc = document.querySelector('[data-hook="post-description"]');

    // Reading time
    const readingCandidates = [...document.querySelectorAll('[data-hook], time, span, p')]
      .map((el) => ({
        hook: el.getAttribute('data-hook') || '',
        text: clean(el.textContent),
      }))
      .filter((x) => /דק|min|reading|קריאה|דק׳|דקות/.test(x.text) && x.text.length < 40);

    // Author/editor block after body
    const authorBlocks = [];
    for (const el of document.querySelectorAll('a[href*="aboutus"], [data-hook*="author"], [data-hook*="writer"], [class*="author"]')) {
      const box = el.closest('section, div, aside') || el;
      const text = clean(box.innerText || '');
      if (text.length > 20 && text.length < 1200) {
        authorBlocks.push({
          text: text.slice(0, 400),
          href: el.getAttribute('href') || el.querySelector?.('a')?.getAttribute('href') || '',
          hook: box.getAttribute?.('data-hook') || '',
        });
      }
    }

    // FAQ: look for Q&A patterns / details / h3 questions after description
    const faqItems = [];
    // schema
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
      .filter(Boolean);
    const flat = [];
    for (const j of jsonLd) {
      if (Array.isArray(j)) flat.push(...j);
      else if (j['@graph']) flat.push(...j['@graph'], j);
      else flat.push(j);
    }
    const faqLd = flat.find((j) => j['@type'] === 'FAQPage');
    if (faqLd?.mainEntity) {
      for (const e of faqLd.mainEntity) {
        faqItems.push({
          question: e.name || '',
          answer: e.acceptedAnswer?.text || '',
          source: 'jsonld',
        });
      }
    }
    // visible FAQ heuristics in article but outside description
    const afterBodyNodes = [];
    if (article && desc) {
      for (const el of article.querySelectorAll('h2, h3, p, details, button')) {
        if (desc.contains(el)) continue;
        const t = clean(el.textContent);
        if (!t) continue;
        afterBodyNodes.push({ tag: el.tagName.toLowerCase(), text: t.slice(0, 120), hook: el.getAttribute('data-hook') || '' });
      }
    }

    // WhatsApp
    const wa = [...document.querySelectorAll('a[href*="whatsapp"], a[href*="chat.whatsapp"]')].map((a) => ({
      text: clean(a.textContent),
      href: a.getAttribute('href') || '',
      section: clean(a.closest('section, aside, div')?.innerText || '').slice(0, 250),
    }));

    // Categories
    const categories = [...document.querySelectorAll('a[href*="/blog/categories/"]')].map((a) => ({
      text: clean(a.textContent),
      href: a.getAttribute('href') || '',
      inDesc: !!(desc && desc.contains(a)),
    }));

    // Recent posts
    const recent = [];
    const recentRoots = [...document.querySelectorAll('[data-hook*="recent"], [data-hook*="RelatedPosts"], [class*="recent"], [aria-label*="פוסט"]')];
    for (const root of recentRoots.length ? recentRoots : []) {
      for (const a of root.querySelectorAll('a[href*="/post/"]')) {
        const card = a.closest('article, li, div') || a;
        recent.push({
          text: clean(a.textContent),
          href: a.getAttribute('href') || '',
          card: clean(card.innerText).slice(0, 200),
          hook: root.getAttribute('data-hook') || root.className?.toString?.().slice(0, 40) || '',
        });
      }
    }
    // fallback: post cards after body with /post/ links not in desc
    if (!recent.length && article) {
      for (const a of article.querySelectorAll('a[href*="/post/"]')) {
        if (desc && desc.contains(a)) continue;
        const card = a.closest('[data-hook], article, li, div') || a;
        const cardText = clean(card.innerText);
        if (cardText.length < 30) continue;
        recent.push({
          text: clean(a.textContent),
          href: a.getAttribute('href') || '',
          card: cardText.slice(0, 220),
          hook: card.getAttribute?.('data-hook') || '',
        });
      }
    }

    // Full article text sections after description
    let afterText = '';
    if (article && desc) {
      // clone article text and subtract description? simpler: take article.innerText and note markers
      afterText = clean(article.innerText).slice(0, 3500);
    }

    // meta line near h1
    const headerArea = document.querySelector('h1')?.parentElement;
    const headerText = clean(headerArea?.innerText || '').slice(0, 300);

    return {
      headerText,
      readingCandidates: readingCandidates.slice(0, 8),
      authorBlocks: authorBlocks.slice(0, 4),
      faqLdCount: faqItems.length,
      faqItems: faqItems.slice(0, 5),
      afterBodyNodes: afterBodyNodes.slice(0, 30),
      whatsapp: wa.slice(0, 3),
      categories,
      recent: recent.slice(0, 8),
      articleLen: clean(article?.innerText || '').length,
      descLen: clean(desc?.innerText || '').length,
      afterSample: afterText.slice(0, 800),
    };
  });

  rows.push({ path: post.path, fileSlug: post.fileSlug, h1: post.h1, ...info });
  console.log('\n====', post.fileSlug);
  console.log('header:', info.headerText.slice(0, 120));
  console.log('reading:', info.readingCandidates.map((r) => r.text).join(' | '));
  console.log('author blocks:', info.authorBlocks.length, info.authorBlocks[0]?.text?.slice(0, 80));
  console.log('faqLd', info.faqLdCount, info.faqItems.map((f) => f.question.slice(0, 40)));
  console.log('wa', info.whatsapp[0]?.section?.slice(0, 100));
  console.log('cats', info.categories.map((c) => c.text + (c.inDesc ? '(in)' : '')));
  console.log('recent', info.recent.length, info.recent.map((r) => r.text.slice(0, 30)));
  console.log('after nodes', info.afterBodyNodes.slice(0, 12));
  await page.close();
}
await browser.close();
writeFileSync('reports/m25-blog/post-chrome-audit.json', JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + '\n');
console.log('\nWrote post-chrome-audit.json');
