import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.goto('https://www.noamdoronmath.co.il/post/annual-review-grade-7', {
  waitUntil: 'networkidle2',
});
await new Promise((r) => setTimeout(r, 1500));
const info = await page.evaluate(() => {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const root = document.querySelector('[data-hook="post-description"]');
  const interesting = [...document.querySelectorAll('a[href]')].map((a) => ({
    text: clean(a.textContent).slice(0, 50),
    href: a.getAttribute('href') || '',
    inRoot: !!(root && root.contains(a)),
    hook: a.closest('[data-hook]')?.getAttribute('data-hook') || '',
    sectionText: clean(a.closest('section')?.innerText || '').slice(0, 80),
  }));
  const relatedish = interesting.filter(
    (a) =>
      /grade-7|signed-numbers|angles|כל דפי|מספרים מכוונים|זוויות/.test(a.text + a.href) &&
      !a.href.includes('/post/')
  );
  // Also look for CTA "פתיחת דפי העבודה"
  const ctas = interesting.filter((a) => /פתיחת דפי|דפי העבודה/.test(a.text));
  let cover = null;
  try {
    const ld = JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || '{}');
    cover = { ldImage: ld.image, og: document.querySelector('meta[property="og:image"]')?.content };
  } catch (e) {
    cover = { err: String(e) };
  }
  // body end text
  const bodyEnd = clean(root?.innerText || '').slice(-300);
  return { relatedish, ctas, cover, bodyEnd, blockAs: [...root.querySelectorAll('a')].map((a) => ({ text: clean(a.textContent), href: a.getAttribute('href') })) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
