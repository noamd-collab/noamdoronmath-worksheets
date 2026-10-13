/**
 * DOODLES-45 served QA — home + grade + topic + blog + about/terms.
 * Usage: PREVIEW_BASE=https://… node scripts/check-doodles45-served.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
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
mkdirSync(shotDir, { recursive: true });
const mediaDir =
  process.env.DOODLES_MEDIA_DIR ||
  '/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/media/doodles-45';
mkdirSync(mediaDir, { recursive: true });

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const manifest = JSON.parse(readFileSync(join(root, 'src/data/doodles.manifest.json'), 'utf8'));
const motifIds = new Set((manifest.motifs || []).map((m) => m.id));

const ROUTES = [
  { id: 'home', path: '/' },
  { id: 'grade7', path: '/grade-7' },
  { id: 'topic', path: '/equations-basics-grade-7' },
  { id: 'blog', path: '/blog' },
  { id: 'about', path: '/aboutus' },
  { id: 'terms', path: '/terms' },
];

const report = { base: BASE, ok: true, checks: [], routes: {}, shots: [] };

function note(name, pass, detail = '') {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
}

async function clearGate(page) {
  const present = await page.evaluate(() => !!document.getElementById('ndGateOverlay'));
  if (!present) return 'absent';
  await page.evaluate(() => {
    const check = document.getElementById('ndGateCheck');
    if (check && !check.checked) {
      check.checked = true;
      check.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.click('#ndGateBtn');
  await page.waitForFunction(() => !document.getElementById('ndGateOverlay'), { timeout: 10000 });
  return 'cleared-ui';
}

function rectsOverlap(a, b, pad = 0) {
  return !(
    a.right + pad <= b.left ||
    b.right + pad <= a.left ||
    a.bottom + pad <= b.top ||
    b.bottom + pad <= a.top
  );
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const size of [
    { name: '390', width: 390, height: 844 },
    { name: '1440', width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage();
    await page.setViewport(size);
    await page.setCacheEnabled(false);

    for (const route of ROUTES) {
      const label = `${size.name} ${route.id}`;
      const res = await page.goto(`${BASE}${route.path}?cb=${Date.now()}`, {
        waitUntil: 'networkidle2',
        timeout: 90000,
      });
      note(`${label} status`, (res?.status() ?? 0) === 200 || (res?.status() ?? 0) === 304, `HTTP ${res?.status()}`);
      const gate = await clearGate(page);
      note(`${label} gate`, true, gate);

      const info = await page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        const doodles = [...document.querySelectorAll('[data-site-doodles] img.site-doodle')].map((img) => ({
          id: img.getAttribute('data-doodle-id'),
          src: img.getAttribute('src'),
          visible: (() => {
            const cs = getComputedStyle(img);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
          })(),
          box: box(img),
        }));
        const hero = [...document.querySelectorAll('.notebook-doodle')].length;
        const basad = document.querySelector('[data-basad], .basad');
        const logo = document.querySelector('img.site-brand__logo');
        const interactive = [
          ...document.querySelectorAll('a.cta, button, .home-hero__cta a, h1, h2, .site-nav a'),
        ]
          .slice(0, 40)
          .map((el) => ({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40), box: box(el) }))
          .filter((t) => t.box && t.box.width > 2);
        const logoCs = logo ? getComputedStyle(logo) : null;
        return {
          doodles,
          heroClusters: hero,
          basad: basad ? { text: (basad.textContent || '').trim(), box: box(basad) } : null,
          logo: logo
            ? { src: logo.getAttribute('src'), bg: logoCs.backgroundColor, radius: logoCs.borderRadius }
            : null,
          interactive,
          overflow: {
            sw: document.documentElement.scrollWidth,
            cw: document.documentElement.clientWidth,
          },
          allImgSrcs: [...document.querySelectorAll('img')].map((i) => i.getAttribute('src') || ''),
        };
      });

      report.routes[`${size.name}:${route.id}`] = {
        doodleIds: info.doodles.map((d) => d.id),
        visibleCount: info.doodles.filter((d) => d.visible).length,
        heroClusters: info.heroClusters,
      };

      if (route.id === 'home') {
        note(`${label} no-site-doodles`, info.doodles.length === 0, `count=${info.doodles.length}`);
        note(`${label} hero-clusters`, info.heroClusters >= 2, `clusters=${info.heroClusters}`);
      } else {
        const visible = info.doodles.filter((d) => d.visible);
        const max = size.name === '390' ? 2 : 3;
        const min = size.name === '390' ? 1 : 2;
        note(
          `${label} motif-count`,
          visible.length >= min && visible.length <= max,
          `visible=${visible.length} total=${info.doodles.length}`
        );
        const ids = info.doodles.map((d) => d.id);
        note(`${label} no-dup-ids`, new Set(ids).size === ids.length, ids.join(','));
        note(
          `${label} known-ids`,
          ids.every((id) => motifIds.has(id)),
          ids.join(',')
        );
        // Only selected URLs loaded (no bulk of all 10)
        const doodleSrcs = info.allImgSrcs.filter((s) => s.includes('/brand/doodles/'));
        note(
          `${label} selected-only`,
          doodleSrcs.length <= 3 && doodleSrcs.length === info.doodles.length,
          `srcs=${doodleSrcs.length}`
        );

        let overlap = false;
        for (const d of visible) {
          if (!d.box) continue;
          for (const t of info.interactive) {
            if (rectsOverlap(d.box, t.box, -4)) {
              overlap = true;
              note(`${label} overlap`, false, `${d.id} vs ${t.tag} ${t.text}`);
            }
          }
          if (info.basad?.box && rectsOverlap(d.box, info.basad.box, -2)) {
            overlap = true;
            note(`${label} overlap-basad`, false, d.id);
          }
        }
        if (!overlap) note(`${label} no-overlap`, true, '');
      }

      if (info.basad?.box) {
        const b = info.basad.box;
        note(
          `${label} basad-ur`,
          b.top < 80 && size.width - b.right < 80,
          `top=${b.top.toFixed(0)} rightGap=${(size.width - b.right).toFixed(0)}`
        );
      } else note(`${label} basad-ur`, false, 'missing');

      if (info.logo) {
        const transparent =
          !info.logo.bg ||
          info.logo.bg.replace(/\s/g, '') === 'rgba(0,0,0,0)' ||
          info.logo.bg === 'transparent';
        note(`${label} logo-transparent`, transparent && info.logo.radius === '0px', info.logo.bg);
      }

      note(
        `${label} no-h-overflow`,
        info.overflow.sw <= info.overflow.cw + 2,
        `sw=${info.overflow.sw}`
      );

      const shot = join(shotDir, `${route.id}-${size.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      report.shots.push(shot);
      try {
        copyFileSync(shot, join(mediaDir, `${route.id}-${size.name}.png`));
      } catch {
        /* best-effort */
      }
    }
    await page.close();
  }

  // Route variation: grade vs topic vs blog should not be identical id sets
  const g = report.routes['1440:grade7']?.doodleIds || [];
  const t = report.routes['1440:topic']?.doodleIds || [];
  const b = report.routes['1440:blog']?.doodleIds || [];
  const setEq = (a, c) => [...a].sort().join() === [...c].sort().join();
  note(
    'route-variation',
    !(setEq(g, t) && setEq(t, b)),
    `grade=[${g}] topic=[${t}] blog=[${b}]`
  );
} finally {
  await browser.close();
}

const outPath = join(outDir, 'doodles-45-qa.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log('report:', outPath);
console.log(report.ok ? 'DOODLES45_QA: PASS' : 'DOODLES45_QA: FAIL');
process.exit(report.ok ? 0 : 1);
