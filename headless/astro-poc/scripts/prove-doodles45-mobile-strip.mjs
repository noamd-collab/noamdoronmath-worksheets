import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('PREVIEW_BASE required');
  process.exit(2);
}

const outDir = join(process.cwd(), 'reports', 'doodles-45');
const shotDir = join(outDir, 'shots');
const mediaDir =
  '/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/media/doodles-45';
mkdirSync(shotDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

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

function overlap(a, b, pad = 0) {
  return !(
    a.right + pad <= b.left ||
    b.right + pad <= a.left ||
    a.bottom + pad <= b.top ||
    b.bottom + pad <= a.top
  );
}

const report = { base: BASE, ok: true, checks: [] };
function note(name, pass, detail = '') {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/grade-7?cb=${Date.now()}`, {
    waitUntil: 'networkidle2',
    timeout: 90000,
  });
  await clearGate(page);

  const info = await page.evaluate(() => {
    const layer = document.querySelector('[data-site-doodles]');
    const lcs = layer ? getComputedStyle(layer) : null;
    const fab = [...document.querySelectorAll('body *')].find((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        s.position === 'fixed' &&
        r.width >= 40 &&
        r.width <= 90 &&
        r.bottom > 760 &&
        r.right > 300
      );
    });
    const fabRect = fab
      ? {
          top: fab.getBoundingClientRect().top,
          left: fab.getBoundingClientRect().left,
          bottom: fab.getBoundingClientRect().bottom,
          right: fab.getBoundingClientRect().right,
        }
      : null;
    const doodles = [...document.querySelectorAll('.site-doodle')]
      .filter((img) => getComputedStyle(img).display !== 'none')
      .map((img) => {
        const r = img.getBoundingClientRect();
        return {
          id: img.dataset.doodleId,
          side: img.dataset.mobileSide || null,
          cls: img.className,
          rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom, w: r.width, h: r.height },
        };
      });
    return {
      layer: {
        pos: lcs?.position,
        height: lcs?.height,
        rect: layer
          ? {
              top: layer.getBoundingClientRect().top,
              bottom: layer.getBoundingClientRect().bottom,
              height: layer.getBoundingClientRect().height,
            }
          : null,
      },
      doodles,
      fabRect,
      heroHome: document.querySelectorAll('.notebook-doodle').length,
    };
  });

  note('strip-relative', info.layer.pos === 'relative', info.layer.pos);
  note(
    'strip-height',
    info.layer.rect && info.layer.rect.height >= 70,
    `h=${info.layer.rect?.height}`
  );
  note(
    'motif-count',
    info.doodles.length >= 1 && info.doodles.length <= 2,
    `n=${info.doodles.length}`
  );
  const sides = new Set(info.doodles.map((d) => d.side));
  if (info.doodles.length === 2) {
    note('left-right', sides.has('start') && sides.has('end'), [...sides].join(','));
  }
  note(
    'size-visible',
    info.doodles.every((d) => d.rect.w >= 60),
    info.doodles.map((d) => `${d.id}:${d.rect.w.toFixed(0)}`).join(',')
  );
  note(
    'in-strip',
    info.doodles.every(
      (d) =>
        d.rect.top >= info.layer.rect.top - 2 &&
        d.rect.bottom <= info.layer.rect.bottom + 2
    ),
    ''
  );
  if (info.fabRect) {
    const hit = info.doodles.some((d) => overlap(d.rect, info.fabRect, 4));
    note('clear-of-fab', !hit, hit ? 'overlap' : 'clear');
    note(
      'strip-above-fab',
      info.layer.rect.bottom < info.fabRect.top - 40,
      `stripBottom=${info.layer.rect.bottom.toFixed(0)} fabTop=${info.fabRect.top}`
    );
  } else {
    note('fab-present', false, 'no fab found — still ok if clear');
  }

  const shot = join(shotDir, 'grade7-390.png');
  await page.screenshot({ path: shot, fullPage: false });
  copyFileSync(shot, join(mediaDir, 'grade7-390.png'));
  copyFileSync(shot, join(mediaDir, 'grade7-390-strip-proof.png'));

  // also home + topic proofs
  for (const [id, path] of [
    ['home', '/'],
    ['topic', '/equations-basics-grade-7'],
    ['about', '/aboutus'],
  ]) {
    await page.goto(`${BASE}${path}?cb=${Date.now()}`, {
      waitUntil: 'networkidle2',
      timeout: 90000,
    });
    await clearGate(page);
    const p = join(shotDir, `${id}-390.png`);
    await page.screenshot({ path: p, fullPage: false });
    copyFileSync(p, join(mediaDir, `${id}-390.png`));
  }

  // desktop grade for comparison
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/grade-7?cb=${Date.now()}`, {
    waitUntil: 'networkidle2',
    timeout: 90000,
  });
  await clearGate(page);
  const g1440 = join(shotDir, 'grade7-1440.png');
  await page.screenshot({ path: g1440, fullPage: false });
  copyFileSync(g1440, join(mediaDir, 'grade7-1440.png'));

  const t1440 = join(shotDir, 'topic-1440.png');
  await page.goto(`${BASE}/equations-basics-grade-7?cb=${Date.now()}`, {
    waitUntil: 'networkidle2',
    timeout: 90000,
  });
  await clearGate(page);
  await page.screenshot({ path: t1440, fullPage: false });
  copyFileSync(t1440, join(mediaDir, 'topic-1440.png'));

  report.probe = info;
  writeFileSync(join(outDir, 'mobile-strip-proof.json'), JSON.stringify(report, null, 2) + '\n');
  copyFileSync(join(outDir, 'mobile-strip-proof.json'), join(mediaDir, 'mobile-strip-proof.json'));
  console.log(report.ok ? 'STRIP_PROOF: PASS' : 'STRIP_PROOF: FAIL');
  await page.close();
} finally {
  await browser.close();
}
process.exit(report.ok ? 0 : 1);
