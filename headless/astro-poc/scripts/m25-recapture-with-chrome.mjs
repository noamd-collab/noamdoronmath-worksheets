import puppeteer from 'puppeteer-core';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { BLOG_CHROME_EXTRACTOR } from './lib/blog-chrome-extractor.js';

const PROD = 'https://www.noamdoronmath.co.il';
const files = readdirSync('src/data/blog-posts').filter((f) => f.endsWith('.json'));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

for (const file of files) {
  const path = `src/data/blog-posts/${file}`;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1800 });
  await page.goto(PROD + data.path, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1200));
  try {
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))?.click();
    });
  } catch {}
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) {
      window.scrollBy(0, 700);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await new Promise((r) => setTimeout(r, 900));

  const chrome = await page.evaluate(BLOG_CHROME_EXTRACTOR);
  data.readingTime = chrome.readingTime || undefined;
  data.authorAvatar = chrome.authorAvatar || undefined;
  data.authorEditor = chrome.authorEditor || undefined;
  data.faq = chrome.faq || undefined;
  data.whatsapp = chrome.whatsapp || undefined;
  data.postCategory = chrome.category || undefined;
  data.recentPosts = chrome.recentPosts || undefined;
  if (chrome.authorEditor?.relatedLinks?.length) {
    data.related = chrome.authorEditor.relatedLinks;
  }

  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(
    data.fileSlug,
    '| read', !!data.readingTime,
    '| avatar', !!data.authorAvatar,
    '| author', !!data.authorEditor,
    '| faq', data.faq?.items?.length || 0,
    '| wa', !!data.whatsapp,
    '| cat', data.postCategory?.text || '-',
    '| recent', data.recentPosts?.items?.length || 0,
  );
  await page.close();
}
await browser.close();
