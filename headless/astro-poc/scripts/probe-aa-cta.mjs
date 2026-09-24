import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.goto('https://www.noamdoronmath.co.il/triangle-similarity-aa-grade-9', {
  waitUntil: 'networkidle2',
  timeout: 90000,
});
await new Promise((r) => setTimeout(r, 2500));
const info = await page.evaluate(() => {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const h1 = document.querySelector('h1');
  const faq = [...document.querySelectorAll('h2')].find((h) => clean(h.textContent) === 'שאלות נפוצות');
  const related = [...document.querySelectorAll('h2')].find((h) => clean(h.textContent) === 'נושאים קשורים');
  const ctas = [...document.querySelectorAll('a[href*="github.io"]')]
    .filter((a) => a.href.includes('topic=') && a.href.includes('worksheets'))
    .map((a) => {
      const r = a.getBoundingClientRect();
      const afterH1 = h1 ? !!(h1.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
      const beforeFaq = faq ? !!(a.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
      return {
        href: a.href,
        label: clean(a.textContent),
        y: Math.round(r.top + scrollY),
        afterH1,
        beforeFaq,
        display: getComputedStyle(a).display,
        visibility: getComputedStyle(a).visibility,
        opacity: getComputedStyle(a).opacity,
      };
    });
  const h2ys = [...document.querySelectorAll('h2')].map((h) => ({
    t: clean(h.textContent),
    y: Math.round(h.getBoundingClientRect().top + scrollY),
  }));
  return { ctas, h2ys, h1y: h1 ? Math.round(h1.getBoundingClientRect().top + scrollY) : null };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
