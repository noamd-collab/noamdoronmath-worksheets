import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';
const MISSING = [
  '/angles-grade-7',
  '/area-parallelogram-trapezoid-composite-grade-7',
  '/area-rectangle-perimeter-grade-7',
  '/composite-polygons-area-grade-9',
  '/conditionforfreeworksheets',
  '/cone-grade-8',
  '/congruent-polygons-transformations-grade-9',
  '/cylinder-surface-area-grade-8',
  '/cylinder-volume-grade-8',
  '/equations-grade-7',
  '/isosceles-triangle-grade-9',
  '/parallelogram-trapezoid-area-grade-9',
  '/patterns-and-graphs-grade-7',
  '/probability-grade-9',
  '/pythagoras-applications-grade-9',
  '/pythagoras-basics-grade-9',
  '/pythagorean-theorem-grade-9',
  '/rectangle-square-area-grade-9',
  '/solids-box-cube-prism-grade-7',
  '/special-triangles-grade-7-new',
  '/statistics-grade-9',
  '/transition-to-high-school-grade-9',
  '/triangle-area-grade-7',
  '/triangle-area-grade-9',
  '/triangle-calculations-grade-9',
  '/triangle-sides-angles-grade-9',
  '/triangle-similarity-aa-grade-9',
  '/triangular-prism-surface-area-grade-9',
  '/triangular-prism-volume-grade-9',
];

const KNOWN_INCONSISTENT = {
  'triangle-area-grade-7': 'M20: FAQPage LD Q&A not in visible FAQ',
  'triangle-similarity-aa-grade-9': 'M22: worksheet CTA before H1 / absent from post-H1 bodyFlow',
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const rows = [];
for (const path of MISSING) {
  const slug = path.replace(/^\//, '');
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  let status = null;
  let finalUrl = '';
  let redirected = false;
  let title = '';
  let h1 = '';
  let ctaAfterH1 = false;
  let ctaCount = 0;
  let error = null;
  try {
    const resp = await page.goto(`${PROD}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = resp?.status() ?? null;
    finalUrl = page.url();
    const finalPath = new URL(finalUrl).pathname.replace(/\/$/, '') || '/';
    redirected = finalPath !== path;
    if (!redirected && status === 200) {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
      const info = await page.evaluate(() => {
        const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const h1el = document.querySelector('h1');
        const ctas = [...document.querySelectorAll('a[href*="github.io"]')].filter(
          (a) => a.href.includes('topic=') && a.href.includes('worksheets')
        );
        let after = 0;
        for (const a of ctas) {
          if (h1el && h1el.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) after++;
        }
        return {
          title: document.title || '',
          h1: clean(h1el?.textContent),
          ctaCount: ctas.length,
          ctaAfterH1: after > 0,
        };
      });
      title = info.title;
      h1 = info.h1;
      ctaCount = info.ctaCount;
      ctaAfterH1 = info.ctaAfterH1;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await page.close();

  let classification = 'live';
  let reason = '';
  if (KNOWN_INCONSISTENT[slug]) {
    classification = 'source-inconsistent';
    reason = KNOWN_INCONSISTENT[slug];
  } else if (path === '/conditionforfreeworksheets') {
    classification = 'not-topic-page';
    reason = 'policy/terms page misbucketed as topic-seo by audit classifier';
  } else if (redirected) {
    classification = 'redirect';
    reason = `redirects to ${finalUrl}`;
  } else if (status !== 200) {
    classification = 'http-error';
    reason = `HTTP ${status}`;
  } else if (!ctaAfterH1 && ctaCount === 0) {
    classification = 'ambiguous';
    reason = 'no worksheet CTA found';
  } else if (!ctaAfterH1 && ctaCount > 0) {
    classification = 'source-inconsistent';
    reason = 'worksheet CTA present but not after H1 (bodyFlow ambiguous)';
  } else if (!h1 || h1.length < 3) {
    classification = 'ambiguous';
    reason = 'missing H1';
  }

  const row = {
    path,
    slug,
    classification,
    reason,
    status,
    redirected,
    finalUrl,
    title,
    h1,
    ctaCount,
    ctaAfterH1,
    error,
  };
  rows.push(row);
  console.log(
    `${classification.padEnd(20)} ${path} ${reason || `ctaAfterH1=${ctaAfterH1} n=${ctaCount}`}`
  );
}

await browser.close();

const migrate = rows
  .filter((r) => r.classification === 'live')
  .map((r) => r.slug);
const skipped = rows.filter((r) => r.classification !== 'live');

mkdirSync('reports', { recursive: true });
writeFileSync(
  'reports/m23-slug-manifest.txt',
  [
    '# M23 — remaining audited topic-SEO gaps (29 from production-route-coverage)',
    '# Classifications in m23-classify.json',
    '# MIGRATE (live, CTA after H1):',
    ...migrate,
    '',
    '# SKIP:',
    ...skipped.map((r) => `# ${r.slug} — ${r.classification}: ${r.reason}`),
    '',
  ].join('\n')
);
writeFileSync(
  'reports/m23-classify.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), migrate, skipped, rows }, null, 2) + '\n'
);
console.log('\nMIGRATE', migrate.length);
console.log(migrate.join('\n'));
console.log('\nSKIP', skipped.length);
