/**
 * DOODLES-44 — homepage-only visual QA at 390/768/1024/1440.
 * Usage: PREVIEW_BASE=https://… node scripts/check-doodles44-home.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('PREVIEW_BASE required');
  process.exit(2);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'doodles-44');
const shotDir = join(outDir, 'shots');
mkdirSync(shotDir, { recursive: true });
const mediaDir =
  process.env.DOODLES_MEDIA_DIR ||
  '/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/media/doodles-44';
mkdirSync(mediaDir, { recursive: true });

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';

const report = {
  base: BASE,
  checks: [],
  ok: true,
  gateBlocked: false,
  shots: [],
  viewports: {},
};

function note(name, pass, detail = '') {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
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
    { name: '768', width: 768, height: 1024 },
    { name: '1024', width: 1024, height: 768 },
    { name: '1440', width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage();
    await page.setViewport(size);
    await page.setCacheEnabled(false);
    const url = `${BASE}/?cb=${Date.now()}`;
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    const status = res?.status() ?? 0;
    note(`${size.name} status`, status === 200 || status === 304, `HTTP ${status}`);

    // Clear terms gate via the real UI accept path (checkbox + button), not a silent
    // storage forge. After accept, homepage content is visible for doodle QA.
    const gateBefore = await page.evaluate(() => {
      const overlay = document.getElementById('ndGateOverlay');
      const hasTitle = /הבהרה/.test(document.body?.innerText || '');
      const hasBtn = !!document.getElementById('ndGateBtn');
      return { present: !!(overlay || (hasTitle && hasBtn)) };
    });
    if (gateBefore.present) {
      await page.evaluate(() => {
        const check = document.getElementById('ndGateCheck');
        if (check && !check.checked) {
          check.checked = true;
          check.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await page.click('#ndGateBtn');
      await page.waitForFunction(() => !document.getElementById('ndGateOverlay'), {
        timeout: 10000,
      });
      note(`${size.name} terms-gate`, true, 'cleared via UI accept (checkbox+button)');
    } else {
      note(`${size.name} terms-gate`, true, 'absent');
    }
    // Confirm homepage hero is visible (not still gated)
    const stillGated = await page.evaluate(() => !!document.getElementById('ndGateOverlay'));
    if (stillGated) {
      report.gateBlocked = true;
      note(`${size.name} hero-visible`, false, 'gate still present after accept');
      await page.close();
      continue;
    }
    note(`${size.name} hero-visible`, true, 'ndGateOverlay gone');

    const info = await page.evaluate(() => {
      const pick = (sel) => document.querySelector(sel);
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top: r.top,
          left: r.left,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const basad = pick('[data-basad], .basad');
      const logo =
        pick('.site-header img, header img, .brand img, .nl-brand__logo') ||
        [...document.querySelectorAll('img')].find((i) => /logo|brand/i.test(i.src || i.alt || ''));
      const h1 = pick('h1');
      const heroCopy = pick('.home-hero__copy') || pick('.home-hero') || h1?.parentElement;
      const doodles = [...document.querySelectorAll('.notebook-doodle')].map((el) => ({
        className: el.className,
        box: box(el),
        bg: getComputedStyle(el).backgroundImage,
      }));
      const art = pick('.notebook-art');
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({
        href: a.getAttribute('href'),
        text: (a.textContent || '').trim().slice(0, 80),
      }));
      const overflow = {
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      };
      // Text nodes that might collide with doodles (hero headline + CTA group)
      const textEls = [
        h1,
        pick('.home-hero__copy p'),
        pick('.home-hero__cta'),
        pick('.home-hero__actions'),
        ...[...document.querySelectorAll('.home-hero a, .home-hero button')].slice(0, 6),
      ].filter(Boolean);
      const textBoxes = textEls.map((el) => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 60),
        box: box(el),
      }));
      const logoCs = logo ? getComputedStyle(logo) : null;
      return {
        basad: basad
          ? { text: (basad.textContent || '').trim(), box: box(basad) }
          : null,
        logo: logo
          ? {
              src: logo.getAttribute('src') || logo.src || '',
              box: box(logo),
              bg: logoCs?.backgroundColor,
              radius: logoCs?.borderRadius,
              shadow: logoCs?.boxShadow,
            }
          : null,
        h1: h1 ? { text: (h1.textContent || '').trim(), box: box(h1) } : null,
        heroCopy: box(heroCopy),
        doodles,
        artPresent: !!art,
        links,
        overflow,
        textBoxes,
        title: document.title,
      };
    });

    report.viewports[size.name] = {
      basad: info.basad,
      logo: info.logo
        ? {
            src: info.logo.src,
            bg: info.logo.bg,
            radius: info.logo.radius,
            shadow: info.logo.shadow,
            box: info.logo.box,
          }
        : null,
      doodleCount: info.doodles.length,
      overflow: info.overflow,
      h1: info.h1?.text,
    };

    note(`${size.name} doodles present`, info.doodles.length >= 2, `count=${info.doodles.length}`);
    note(
      `${size.name} doodle asset`,
      info.doodles.every((d) => /notebook-doodles-v1\.webp/.test(d.bg || '')),
      info.doodles.map((d) => d.bg).join(' | ').slice(0, 120)
    );

    // basad upper-right
    if (!info.basad?.box) {
      note(`${size.name} basad`, false, 'missing');
    } else {
      const b = info.basad.box;
      const nearTop = b.top >= 0 && b.top < 80;
      const nearRight = b.right > size.width * 0.7 && size.width - b.right < 80;
      note(
        `${size.name} basad upper-right`,
        nearTop && nearRight,
        `top=${b.top.toFixed(1)} rightGap=${(size.width - b.right).toFixed(1)} text=${info.basad.text}`
      );
    }

    // logo transparent (no white card)
    if (!info.logo) {
      note(`${size.name} logo`, false, 'missing');
    } else {
      const bg = (info.logo.bg || '').replace(/\s/g, '');
      const transparent =
        !bg ||
        bg === 'transparent' ||
        bg === 'rgba(0,0,0,0)' ||
        bg === 'rgba(0,0,0,0.0)';
      const noCard =
        transparent &&
        (!info.logo.radius || info.logo.radius === '0px') &&
        (!info.logo.shadow || info.logo.shadow === 'none');
      note(`${size.name} logo transparent`, noCard, `bg=${info.logo.bg} radius=${info.logo.radius}`);
    }

    // no horizontal overflow
    note(
      `${size.name} no-h-overflow`,
      info.overflow.sw <= info.overflow.cw + 2,
      `sw=${info.overflow.sw} cw=${info.overflow.cw}`
    );

    // doodle vs hero text overlap
    let overlapFail = false;
    for (const d of info.doodles) {
      if (!d.box || d.box.width < 2) continue;
      for (const t of info.textBoxes) {
        if (!t.box || t.box.width < 2 || !(t.text || '').trim()) continue;
        if (rectsOverlap(d.box, t.box, -2)) {
          overlapFail = true;
          note(
            `${size.name} overlap`,
            false,
            `doodle ${d.className} vs ${t.tag} "${t.text}"`
          );
        }
      }
      if (info.basad?.box && rectsOverlap(d.box, info.basad.box, -2)) {
        overlapFail = true;
        note(`${size.name} overlap-basad`, false, `doodle vs basad`);
      }
    }
    if (!overlapFail) note(`${size.name} no-text-overlap`, true, 'hero text clear of doodles');

    // preserve key home links
    const hrefs = info.links.map((l) => l.href || '');
    const need = ['/worksheets', '/learning', '/grade-', '/math-tools'];
    for (const n of need) {
      note(
        `${size.name} link ${n}`,
        hrefs.some((h) => h.includes(n)),
        ''
      );
    }

    const shotPath = join(shotDir, `home-${size.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    report.shots.push(shotPath);
    try {
      copyFileSync(shotPath, join(mediaDir, `home-${size.name}.png`));
    } catch {
      /* media copy best-effort */
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const outPath = join(outDir, 'doodles-44-qa.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log('report:', outPath);
console.log(report.ok ? 'DOODLES44_QA: PASS' : 'DOODLES44_QA: FAIL');
process.exit(report.ok ? 0 : 1);
