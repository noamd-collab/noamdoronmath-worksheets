/**
 * DESIGN-39 served QA — home, learning, grade7, grade1, math-tools, topic
 * at 1440 + 390: overflow, nav, basad, SEO links, keyboard fold.
 *
 * Usage: PREVIEW_BASE=https://… node scripts/check-design39-served.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('PREVIEW_BASE required');
  process.exit(2);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'design-39');
const shotDir = join(outDir, 'shots');
mkdirSync(shotDir, { recursive: true });

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const PATHS = [
  { id: 'home', path: '/' },
  { id: 'learning', path: '/learning.html' },
  { id: 'grade7', path: '/grade-7' },
  { id: 'grade1', path: '/grade-1' },
  { id: 'math-tools', path: '/math-tools' },
  { id: 'topic', path: '/equations-basics-grade-7' },
];

const report = { base: BASE, checks: [], ok: true, shots: [] };

function note(name, pass, detail = '') {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const size of [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage();
    await page.setViewport(size);

    for (const route of PATHS) {
      const label = `${size.name} ${route.id}`;
      const res = await page.goto(BASE + route.path, {
        waitUntil: 'networkidle2',
        timeout: 90000,
      });
      const status = res?.status() ?? 0;
      note(`${label} status`, status === 200 || status === 304, `HTTP ${status}`);

      const info = await page.evaluate(() => {
        const overflow = {
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        };
        const logo = document.querySelector(
          'img.nl-brand__logo, .site-brand img, header img[src*="logo"]'
        );
        const logoSrc = logo?.getAttribute('src') || '';
        const basad = document.querySelector('[data-basad], .nl-basad, .basad');
        let basadRect = null;
        if (basad) {
          const r = basad.getBoundingClientRect();
          basadRect = {
            left: r.left,
            right: r.right,
            top: r.top,
            vw: window.innerWidth,
            text: (basad.textContent || '').trim(),
          };
        }
        const navCurrent = [...document.querySelectorAll('[aria-current="page"]')].map(
          (el) => ({
            tag: el.tagName,
            href: el.getAttribute('href'),
            text: (el.textContent || '').trim().slice(0, 40),
          })
        );
        const crumbs = [...document.querySelectorAll('.topic-page__crumbs a, .grade-hub__siblings a, .site-page__crumbs a')].map(
          (a) => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })
        );
        const topicLinks = [...document.querySelectorAll('.grade-hub__topic-list a')].map(
          (a) => a.getAttribute('href')
        );
        const grade1Groups = [
          ...document.querySelectorAll('.grade-hub__topics[aria-label="קבוצות נושאים"] h3 a'),
        ].map((a) => (a.textContent || '').trim());
        const introFold = document.querySelector('details.grade-hub__intro-fold');
        const previewFold = document.querySelector('details.site-page__fold');
        const previewIframe = document.querySelector(
          'details.site-page__fold iframe[title*="תצוגה מקדימה"], details.site-page__fold iframe'
        );
        const h1 = (document.querySelector('h1')?.textContent || '').trim();
        const bodyLinks = [...document.querySelectorAll('main a[href]')].map((a) =>
          a.getAttribute('href')
        );
        return {
          overflow,
          logoSrc,
          basadRect,
          navCurrent,
          crumbs,
          topicLinks,
          grade1Groups,
          introFoldOpen: introFold ? introFold.open : null,
          introFoldPresent: !!introFold,
          previewFoldPresent: !!previewFold,
          previewFoldOpen: previewFold ? previewFold.open : null,
          previewIframeSrc: previewIframe?.getAttribute('src') || null,
          h1,
          bodyLinks,
          title: document.title,
        };
      });

      note(
        `${label} overflow`,
        info.overflow.sw <= info.overflow.cw + 2,
        JSON.stringify(info.overflow)
      );

      if (route.id === 'learning' || route.id === 'home') {
        const isCropped = /noam-doron-math-logo-cropped\.png/.test(info.logoSrc);
        if (route.id === 'learning') {
          note(`${label} cropped logo`, isCropped, info.logoSrc);
          const b = info.basadRect;
          if (!b) note(`${label} basad`, false, 'missing');
          else {
            const margin = size.width <= 400 ? 16 : 24;
            const nearRight = b.right >= b.vw - margin;
            const inRightHalf = b.left > b.vw / 2;
            const nearTop = b.top >= 0 && b.top <= 28;
            note(
              `${label} basad`,
              nearRight && inRightHalf && nearTop && /בס/.test(b.text),
              JSON.stringify(b)
            );
          }
        }
        if (route.id === 'home') {
          note(`${label} cropped logo`, isCropped, info.logoSrc);
        }
      }

      if (route.id === 'grade7') {
        note(
          `${label} topics before intro fold`,
          info.topicLinks.length >= 10 && info.introFoldPresent === true,
          `topics=${info.topicLinks.length} introFold=${info.introFoldPresent}`
        );
        // keyboard fold: open via click (summary is keyboard-activatable)
        if (info.introFoldPresent) {
          await page.focus('details.grade-hub__intro-fold > summary');
          await page.keyboard.press('Enter');
          const opened = await page.evaluate(() => {
            const d = document.querySelector('details.grade-hub__intro-fold');
            const intro = d?.querySelector('.grade-hub__intro');
            return {
              open: !!d?.open,
              introLen: (intro?.textContent || '').trim().length,
            };
          });
          note(
            `${label} keyboard intro fold`,
            opened.open && opened.introLen > 40,
            JSON.stringify(opened)
          );
        }
        // SEO topic links preserved (local paths)
        note(
          `${label} SEO topic links`,
          info.topicLinks.some((h) => h && h.includes('equations-basics-grade-7')),
          info.topicLinks.slice(0, 3).join(',')
        );
      }

      if (route.id === 'grade1') {
        note(
          `${label} catalog groups`,
          info.grade1Groups.length >= 1,
          JSON.stringify(info.grade1Groups.slice(0, 6))
        );
      }

      if (route.id === 'math-tools') {
        note(`${label} preview fold`, info.previewFoldPresent === true, '');
        if (info.previewFoldPresent) {
          await page.focus('details.site-page__fold > summary');
          await page.keyboard.press('Enter');
          const opened = await page.evaluate(() => {
            const d = document.querySelector('details.site-page__fold');
            const iframe = d?.querySelector('iframe');
            const texts = [...(d?.querySelectorAll('h3, p') || [])].map((el) =>
              (el.textContent || '').trim()
            );
            return {
              open: !!d?.open,
              iframeSrc: iframe?.getAttribute('src') || null,
              texts,
              hasOrphan34: texts.some((t) => t === '3/4'),
            };
          });
          note(
            `${label} keyboard preview fold`,
            opened.open && !!opened.iframeSrc && !opened.hasOrphan34,
            JSON.stringify({
              open: opened.open,
              iframe: opened.iframeSrc,
              orphan34: opened.hasOrphan34,
              sample: opened.texts.slice(0, 4),
            })
          );
        }
        // archive / CTA links still present outside fold
        note(
          `${label} archive/cta links`,
          info.bodyLinks.some((h) => h && h.includes('scientific-calculator')),
          info.bodyLinks.filter((h) => h && h.includes('calculator')).slice(0, 3).join(',')
        );
      }

      if (route.id === 'topic') {
        const heCrumb = info.crumbs.some((c) => /כיתה\s*ז׳/.test(c.text) || /כיתה ז/.test(c.text));
        note(`${label} Hebrew grade crumb`, heCrumb, JSON.stringify(info.crumbs));
      }

      const shotPath = join(shotDir, `${route.id}-${size.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      report.shots.push(shotPath);
    }
    await page.close();
  }
} catch (e) {
  report.ok = false;
  report.error = String(e && e.stack ? e.stack : e);
  console.error(report.error);
} finally {
  await browser.close();
}

const outPath = join(outDir, 'served-qa.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log('report:', outPath);
console.log(report.ok ? 'DESIGN39_QA_PASS' : 'DESIGN39_QA_FAIL');
process.exit(report.ok ? 0 : 1);
