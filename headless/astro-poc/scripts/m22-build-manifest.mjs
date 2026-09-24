import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const PROD = 'https://www.noamdoronmath.co.il';
const pagesDir = 'src/pages';
const migrated = new Set(
  readdirSync(pagesDir)
    .filter((f) => f.endsWith('-grade-7.astro') || f.endsWith('-grade-8.astro') || f.endsWith('-grade-9.astro'))
    .map((f) => f.replace(/\.astro$/, ''))
);
// Also exclude known unmigrated inconsistent
const EXCLUDE = new Set([...migrated, 'triangle-area-grade-7']);
console.log('Already migrated page modules:', migrated.size);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

async function hubTopics(grade) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const url = `${PROD}/grade-${grade}`;
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));
  const links = await page.evaluate((g) => {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      let path = '';
      try {
        const u = new URL(a.href, location.origin);
        if (!u.hostname.includes('noamdoronmath')) continue;
        path = u.pathname.replace(/\/$/, '');
      } catch {
        continue;
      }
      if (!path.endsWith(`-grade-${g}`)) continue;
      if (path === `/grade-${g}`) continue;
      const slug = path.replace(/^\//, '');
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, href: a.href, label: (a.textContent || '').replace(/\s+/g, ' ').trim() });
    }
    return out;
  }, grade);
  // Check redirects for candidates we might pick
  await page.close();
  return { status: resp?.status(), links };
}

const byGrade = {};
for (const g of [7, 8, 9]) {
  byGrade[g] = await hubTopics(g);
  console.log(`\nG${g} hub links:`, byGrade[g].links.length, 'status', byGrade[g].status);
}

// Pick next 8 unmigrated non-excluded per grade in hub order
async function isRedirect(slug) {
  const page = await browser.newPage();
  const resp = await page.goto(`${PROD}/${slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const finalUrl = page.url();
  const status = resp?.status();
  const redirected = !finalUrl.replace(/\/$/, '').endsWith(`/${slug}`);
  await page.close();
  return { status, redirected, finalUrl };
}

const picked = { 7: [], 8: [], 9: [] };
const skipped = [];

for (const g of [7, 8, 9]) {
  for (const link of byGrade[g].links) {
    if (picked[g].length >= 8) break;
    if (EXCLUDE.has(link.slug)) continue;
    const check = await isRedirect(link.slug);
    if (check.redirected || check.status !== 200) {
      skipped.push({ slug: link.slug, reason: check.redirected ? `redirect→${check.finalUrl}` : `HTTP ${check.status}` });
      console.log(' skip', link.slug, check.redirected ? 'redirect' : check.status);
      continue;
    }
    picked[g].push(link.slug);
    console.log(` pick G${g}`, picked[g].length, link.slug);
  }
}

await browser.close();

const manifest = [...picked[7], ...picked[8], ...picked[9]];
console.log('\nMANIFEST', manifest.length);
console.log(manifest.join('\n'));
console.log('\nSKIPPED during pick', skipped.length, skipped);

writeFileSync(
  'reports/m22-slug-manifest.txt',
  [
    '# M22 slug manifest (live hub order; 8/grade; excl migrated+triangle-area; no fill)',
    ...manifest,
    '',
  ].join('\n')
);
writeFileSync(
  'reports/m22-manifest-meta.json',
  JSON.stringify({ picked, skipped, migratedCount: migrated.size, generatedAt: new Date().toISOString() }, null, 2)
);
