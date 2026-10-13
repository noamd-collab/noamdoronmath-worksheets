/**
 * HEADLESS-MIGRATION-32 — served DOM: migrated internal links stay on Headless origin.
 * Usage: PREVIEW_BASE=https://… node scripts/check-m32-nav-local.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('PREVIEW_BASE required');
  process.exit(2);
}

const PROD = 'https://www.noamdoronmath.co.il';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'm32-nav');
mkdirSync(outDir, { recursive: true });

const paths = ['/', '/grade-7', '/equations-basics-grade-7', '/blog', '/post/assessment-1-grade-7'];

const report = { base: BASE, pages: [], ok: true };

function classify(href, pageUrl) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return { kind: 'skip' };
  }
  let u;
  try {
    u = new URL(href, pageUrl);
  } catch {
    return { kind: 'bad', href };
  }
  const host = u.hostname;
  if (
    host.includes('wixstatic.com') ||
    host.includes('filesusr.com') ||
    host.includes('parastorage.com') ||
    host.includes('github.io') ||
    u.pathname.includes('/_files/') ||
    u.pathname.endsWith('.pdf')
  ) {
    return { kind: 'media', href: u.href };
  }
  if (host === 'www.noamdoronmath.co.il' || host === 'noamdoronmath.co.il') {
    return { kind: 'prod-escape', href: u.href, path: u.pathname };
  }
  // same preview host or relative — local
  return { kind: 'local', href: u.pathname + u.search + u.hash };
}

for (const p of paths) {
  const url = BASE + p;
  let status = 0;
  let html = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { redirect: 'follow' });
    status = r.status;
    html = await r.text();
    if (status === 200) break;
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const escapes = [];
  const locals = [];
  for (const h of hrefs) {
    const c = classify(h, url);
    if (c.kind === 'prod-escape') {
      // Only flag if we believe path is locally served (grade hubs / topics / site)
      const path = (c.path || '').replace(/\/$/, '') || '/';
      const looksMigrated =
        path === '/' ||
        /^\/grade-[1-9]$/.test(path) ||
        path.startsWith('/worksheets') ||
        path.startsWith('/blog') ||
        path.startsWith('/post/') ||
        /grade-[1-9]$/.test(path) ||
        ['/aboutus', '/terms', '/math-tools', '/accessibilityadaptation'].includes(path);
      if (looksMigrated) escapes.push(c.href);
    } else if (c.kind === 'local') locals.push(c.href);
  }
  const pageOk = status === 200 && escapes.length === 0;
  if (!pageOk) report.ok = false;
  report.pages.push({
    path: p,
    status,
    escapeCount: escapes.length,
    sampleEscapes: escapes.slice(0, 8),
    localSample: locals.filter((x) => x.includes('grade-7') || x.includes('equations')).slice(0, 5),
  });
  console.log(pageOk ? 'OK' : 'FAIL', status, p, 'escapes=', escapes.length);
}

writeFileSync(join(outDir, 'nav-gate.json'), JSON.stringify(report, null, 2));
console.log('wrote', join(outDir, 'nav-gate.json'));
process.exit(report.ok ? 0 : 1);
