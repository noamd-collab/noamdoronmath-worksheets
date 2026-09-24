import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, readdirSync } from 'fs';

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
  await page.goto(PROD + data.path, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1000));
  try {
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))?.click();
    });
  } catch {}

  const extra = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const desc = document.querySelector('[data-hook="post-description"]');
    const post = document.querySelector('[data-hook="post"]') || document.querySelector('article');
    const related = [];
    if (post) {
      for (const a of post.querySelectorAll('a[href]')) {
        if (desc && desc.contains(a)) continue;
        const href = a.getAttribute('href') || '';
        const text = clean(a.textContent);
        if (!text || !href) continue;
        // skip share / social / category nav chrome
        if (/facebook|twitter|whatsapp|linkedin|pinterest|mailto:/i.test(href)) continue;
        if (/^\/blog\/categories\//.test(href) || href.includes('/blog/categories/')) continue;
        if (text === 'כל הפוסטים' || text === 'יסודי' || text === 'חטיבת הביניים' || text === 'מורים והורים') continue;
        // keep internal topic/grade related chips and similar
        related.push({ text, href });
      }
    }
    // dedupe
    const seen = new Set();
    const dedup = [];
    for (const r of related) {
      const k = r.href + '|' + r.text;
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(r);
    }
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    return { related: dedup, ogImage };
  });

  data.related = extra.related;
  if (!data.coverImage && extra.ogImage && !/googleusercontent|s96-c/.test(extra.ogImage)) {
    data.coverImage = extra.ogImage;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(file, 'related', data.related.length, data.related.map((r) => r.text).join(' | '), 'cover', !!(data.coverImage));
  await page.close();
}
await browser.close();
