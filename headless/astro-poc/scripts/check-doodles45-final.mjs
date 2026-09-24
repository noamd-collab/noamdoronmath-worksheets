/**
 * DOODLES-45 final viewport QA — no content/control overlap.
 * Strip mode ≤1200; gutters >1200. Home keeps hero (no site doodles).
 *
 * Usage: PREVIEW_BASE=https://… node scripts/check-doodles45-final.mjs
 */
import puppeteer from 'puppeteer-core';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('PREVIEW_BASE required');
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'reports', 'doodles-45');
const shotDir = join(outDir, 'shots');
const mediaDir =
  '/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/media/doodles-45';
mkdirSync(shotDir, { recursive: true });

const motifIds = JSON.parse(
  readFileSync(join(root, 'src/data/doodles.manifest.json'), 'utf8')
).motifs.map((m) => m.id);

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
];

const ROUTES = [
  { id: 'home', path: '/' },
  { id: 'grade7', path: '/grade-7' },
  { id: 'worksheets', path: '/worksheets' },
  { id: 'topic', path: '/equations-basics-grade-7' },
  { id: 'blog', path: '/blog' },
  { id: 'about', path: '/aboutus' },
];

const report = { base: BASE, ok: true, checks: [], assets: {}, routes: {} };

function note(name, pass, detail = '') {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
}

function overlap(a, b, pad = 2) {
  return !(
    a.right + pad <= b.left ||
    b.right + pad <= a.left ||
    a.bottom + pad <= b.top ||
    b.bottom + pad <= a.top
  );
}

async function clearGate(page) {
  await page.evaluate(() => {
    const check = document.getElementById('ndGateCheck');
    if (check && !check.checked) {
      check.checked = true;
      check.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  if (await page.$('#ndGateBtn')) {
    await page.click('#ndGateBtn');
    await page
      .waitForFunction(() => !document.getElementById('ndGateOverlay'), { timeout: 10000 })
      .catch(() => {});
  }
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  // Asset reachability
  const page0 = await browser.newPage();
  for (const id of motifIds) {
    const url = `${BASE}/brand/doodles/${id}.webp`;
    const res = await page0.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    const status = res?.status() ?? 0;
    const buf = await page0.content().then(() => null);
    const ok = status === 200;
    note(`asset ${id}`, ok, `HTTP ${status}`);
    report.assets[id] = { url, status, ok };
  }
  await page0.close();

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    for (const route of ROUTES) {
      const label = `${vp.name} ${route.id}`;
      await page.goto(`${BASE}${route.path}?cb=${Date.now()}`, {
        waitUntil: 'networkidle2',
        timeout: 90000,
      });
      await clearGate(page);

      const info = await page.evaluate(() => {
        const layer = document.querySelector('[data-site-doodles]');
        const lcs = layer ? getComputedStyle(layer) : null;
        const doodles = [...document.querySelectorAll('.site-doodle')]
          .filter((img) => getComputedStyle(img).display !== 'none')
          .map((img) => {
            const r = img.getBoundingClientRect();
            return {
              id: img.dataset.doodleId,
              src: img.getAttribute('src'),
              stripSide: img.dataset.stripSide || null,
              rect: {
                top: r.top,
                left: r.left,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
              },
            };
          });
        // Interactive / text — exclude full-page MAIN wrappers
        const targets = [
          ...document.querySelectorAll(
            'a.cta, button, h1, h2, .site-nav a, .home-hero__cta a, .home-grade, [role="button"]'
          ),
        ]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              text: (el.textContent || '').trim().slice(0, 40),
              rect: {
                top: r.top,
                left: r.left,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
              },
            };
          })
          .filter((t) => t.rect.width > 10 && t.rect.height > 10 && t.rect.width < 900);
        const fab = [...document.querySelectorAll('body *')].find((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return (
            s.position === 'fixed' &&
            r.width >= 40 &&
            r.width <= 90 &&
            r.bottom > window.innerHeight - 100 &&
            r.right > window.innerWidth - 80
          );
        });
        const fabRect = fab
          ? (() => {
              const r = fab.getBoundingClientRect();
              return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
            })()
          : null;
        return {
          layerPos: lcs?.position || null,
          layerH: lcs?.height || null,
          hero: document.querySelectorAll('.notebook-doodle').length,
          doodles,
          targets,
          fabRect,
          basad: (() => {
            const el = document.querySelector('[data-basad], .basad');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, right: r.right, text: (el.textContent || '').trim() };
          })(),
        };
      });

      report.routes[`${vp.name}:${route.id}`] = {
        layerPos: info.layerPos,
        ids: info.doodles.map((d) => d.id),
        count: info.doodles.length,
        hero: info.hero,
      };

      if (route.id === 'home') {
        note(`${label} no-site-doodles`, info.doodles.length === 0, `n=${info.doodles.length}`);
        note(`${label} hero-kept`, info.hero >= 2, `clusters=${info.hero}`);
      } else {
        const expectStrip = vp.width <= 1200;
        if (expectStrip) {
          note(`${label} strip-mode`, info.layerPos === 'relative', info.layerPos);
          note(
            `${label} strip-count`,
            info.doodles.length >= 1 && info.doodles.length <= 2,
            `n=${info.doodles.length}`
          );
          if (info.doodles.length === 2) {
            const sides = new Set(info.doodles.map((d) => d.stripSide));
            note(`${label} L/R`, sides.has('start') && sides.has('end'), [...sides].join(','));
          }
        } else {
          note(`${label} gutter-mode`, info.layerPos === 'fixed', info.layerPos);
          note(
            `${label} gutter-count`,
            info.doodles.length >= 2 && info.doodles.length <= 3,
            `n=${info.doodles.length}`
          );
        }
        note(
          `${label} selected-only`,
          info.doodles.length <= 3 &&
            info.doodles.every((d) => (d.src || '').includes('/brand/doodles/')),
          info.doodles.map((d) => d.id).join(',')
        );

        let hit = false;
        for (const d of info.doodles) {
          for (const t of info.targets) {
            if (overlap(d.rect, t.rect)) {
              hit = true;
              note(`${label} overlap`, false, `${d.id} vs ${t.tag} ${t.text}`);
            }
          }
          if (info.fabRect && overlap(d.rect, info.fabRect)) {
            hit = true;
            note(`${label} fab-overlap`, false, d.id);
          }
          if (info.basad) {
            const b = {
              top: info.basad.top,
              left: info.basad.right - 40,
              right: info.basad.right,
              bottom: info.basad.top + 24,
            };
            if (overlap(d.rect, b)) {
              hit = true;
              note(`${label} basad-overlap`, false, d.id);
            }
          }
        }
        if (!hit) note(`${label} no-overlap`, true, '');
      }

      if (info.basad) {
        note(
          `${label} basad-ur`,
          info.basad.top < 80 && vp.width - info.basad.right < 80,
          `top=${info.basad.top.toFixed(0)}`
        );
      }

      const shot = join(shotDir, `${route.id}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      try {
        copyFileSync(shot, join(mediaDir, `${route.id}-${vp.name}.png`));
      } catch {
        /* best-effort */
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'final-qa.json'), JSON.stringify(report, null, 2) + '\n');
try {
  copyFileSync(join(outDir, 'final-qa.json'), join(mediaDir, 'final-qa.json'));
} catch {
  /* */
}
console.log(report.ok ? 'DOODLES45_FINAL: PASS' : 'DOODLES45_FINAL: FAIL');
process.exit(report.ok ? 0 : 1);
