/**
 * DESIGN-40 served QA — fail closed if terms gate present (no bypass).
 * Usage: PREVIEW_BASE=https://… node scripts/check-design40-served.mjs
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

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'design-40');
const shotDir = join(outDir, 'shots');
mkdirSync(shotDir, { recursive: true });
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';

const PATHS = [
  { id: 'home', path: '/' },
  { id: 'grade7', path: '/grade-7' },
  { id: 'grade1', path: '/grade-1' },
  { id: 'math-tools', path: '/math-tools' },
  { id: 'topic', path: '/equations-basics-grade-7' },
  { id: 'learning', path: '/learning.html' },
];

const report = {
  base: BASE,
  checks: [],
  ok: true,
  gateBlocked: false,
  shots: [],
  supervisorActionRequired: null,
};

function note(name, pass, detail = '') {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
}

function luminance(r, g, b) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function parseRgb(s) {
  const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function contrastRatio(fg, bg) {
  const L1 = luminance(...fg);
  const L2 = luminance(...bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
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
    await page.setCacheEnabled(false);

    for (const route of PATHS) {
      const label = `${size.name} ${route.id}`;
      const res = await page.goto(BASE + route.path + (route.path.includes('?') ? '&' : '?') + 'cb=' + Date.now(), {
        waitUntil: 'networkidle2',
        timeout: 90000,
      });
      const status = res?.status() ?? 0;
      note(`${label} status`, status === 200 || status === 304, `HTTP ${status}`);

      const gate = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        const hasTitle = /הבהרה/.test(text);
        const hasBtn = [...document.querySelectorAll('button')].some((b) =>
          /אישור וכניסה/.test(b.textContent || '')
        );
        const h1 = (document.querySelector('h1')?.textContent || '').trim();
        return { hasTitle, hasBtn, h1LooksLikeGate: h1 === 'הבהרה' || hasTitle && hasBtn };
      });

      if (gate.hasTitle && gate.hasBtn) {
        report.gateBlocked = true;
        report.supervisorActionRequired =
          'Terms gate present on DESIGN-40 preview. User/supervisor must accept terms on this isolated host before unobscured visual QA. Do not auto-bypass.';
        note(`${label} terms-gate`, false, 'GATE_PRESENT — supervisor action required');
        const shotPath = join(shotDir, `${route.id}-${size.name}-GATED.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        report.shots.push(shotPath);
        continue;
      }

      const info = await page.evaluate(() => {
        const overflow = {
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        };
        const logo = document.querySelector(
          'img.site-brand__logo, img.nl-brand__logo, header img[src*="logo"]'
        );
        const brand = document.querySelector('.site-brand, .nl-brand');
        let brandStyle = null;
        if (brand) {
          const cs = getComputedStyle(brand);
          brandStyle = {
            background: cs.backgroundColor,
            boxShadow: cs.boxShadow,
            src: logo?.getAttribute('src') || '',
          };
        }
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
        const header = document.querySelector('.site-header');
        const headerBg = header ? getComputedStyle(header).backgroundColor : null;
        const headerAfter = header
          ? getComputedStyle(header, '::after').content
          : null;

        const crumbs = [...document.querySelectorAll('.topic-page__crumbs, .site-page__crumbs')];
        const crumbInfo = crumbs.map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            text: (el.textContent || '').trim().slice(0, 80),
            top: r.top,
            visible: r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0',
            color: cs.color,
          };
        });

        const ctaRows = [...document.querySelectorAll('.topic-page__cta-row')];
        const ctaGaps = [];
        for (let i = 1; i < ctaRows.length; i++) {
          const a = ctaRows[i - 1].getBoundingClientRect();
          const b = ctaRows[i].getBoundingClientRect();
          ctaGaps.push(Math.round(b.top - a.bottom));
        }
        const ctaBtns = [...document.querySelectorAll('.topic-page__cta-row a.cta, .site-page__body a.cta')];
        const ctaStyles = ctaBtns.slice(0, 4).map((a) => {
          const cs = getComputedStyle(a);
          return { color: cs.color, background: cs.backgroundColor, text: (a.textContent || '').trim().slice(0, 40) };
        });

        // math-tools formula
        let formula = null;
        const fold = document.querySelector('details.site-page__fold');
        if (fold) {
          // do not open yet — just locate
          const span = fold.querySelector('span[dir="ltr"]');
          const p = [...fold.querySelectorAll('p')].find((el) => /√72/.test(el.textContent || ''));
          formula = {
            hasLtrSpan: !!span && /√72/.test(span.textContent || ''),
            text: (span || p)?.textContent?.trim() || null,
          };
        }

        return {
          overflow,
          brandStyle,
          basadRect,
          headerBg,
          headerAfter,
          crumbInfo,
          ctaGaps,
          ctaStyles,
          formula,
          h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 80),
        };
      });

      note(
        `${label} overflow`,
        info.overflow.sw <= info.overflow.cw + 2,
        JSON.stringify(info.overflow)
      );

      if (info.brandStyle) {
        const bg = info.brandStyle.background || '';
        const noCard =
          /transparent|rgba\(0,\s*0,\s*0,\s*0\)/.test(bg) || bg === 'rgba(0, 0, 0, 0)';
        const noShadow =
          !info.brandStyle.boxShadow ||
          info.brandStyle.boxShadow === 'none';
        note(
          `${label} logo no white card`,
          noCard && noShadow,
          JSON.stringify(info.brandStyle)
        );
      }

      if (route.id === 'learning' || route.id === 'home') {
        // basad on learning; home may also have site basad
        if (info.basadRect) {
          const b = info.basadRect;
          const margin = size.width <= 400 ? 16 : 24;
          const nearRight = b.right >= b.vw - margin;
          const inRightHalf = b.left > b.vw / 2;
          const nearTop = b.top >= 0 && b.top <= 28;
          note(
            `${label} basad`,
            nearRight && inRightHalf && nearTop && /בס/.test(b.text),
            JSON.stringify(b)
          );
        } else if (route.id === 'learning') {
          note(`${label} basad`, false, 'missing');
        }
      }

      if (route.id === 'home' || route.id === 'topic' || route.id === 'math-tools') {
        // header should be transparent (no paper wash / gradient fade)
        const transparent =
          !info.headerBg ||
          /transparent|rgba\(0,\s*0,\s*0,\s*0\)/.test(info.headerBg);
        note(`${label} header transparent`, transparent, `bg=${info.headerBg} after=${info.headerAfter}`);
      }

      if (route.id === 'topic' || route.id === 'math-tools') {
        if (info.crumbInfo.length) {
          note(
            `${label} breadcrumb visible`,
            info.crumbInfo.every((c) => c.visible),
            JSON.stringify(info.crumbInfo)
          );
        }
      }

      if (route.id === 'topic') {
        const gapsOk = info.ctaGaps.length === 0 || info.ctaGaps.every((g) => g >= 8);
        note(`${label} CTA row separation`, gapsOk, `gaps=${JSON.stringify(info.ctaGaps)}`);
        for (const [i, st] of info.ctaStyles.entries()) {
          const fg = parseRgb(st.color);
          const bg = parseRgb(st.background);
          if (!fg || !bg) {
            note(`${label} CTA contrast[${i}]`, false, JSON.stringify(st));
            continue;
          }
          const ratio = contrastRatio(fg, bg);
          // white on blue should be high; catch blue-on-blue (~1)
          note(
            `${label} CTA contrast[${i}]`,
            ratio >= 3,
            `ratio=${ratio.toFixed(2)} ${JSON.stringify(st)}`
          );
        }
      }

      if (route.id === 'math-tools') {
        // open fold via keyboard
        const hasSummary = await page.$('details.site-page__fold > summary');
        if (hasSummary) {
          await page.focus('details.site-page__fold > summary');
          await page.keyboard.press('Enter');
          const opened = await page.evaluate(() => {
            const d = document.querySelector('details.site-page__fold');
            const span = d?.querySelector('span[dir="ltr"]');
            const text = (span?.textContent || '').trim();
            const cta = d
              ? null
              : null;
            const bodyCta = document.querySelector('.site-page__body a.cta');
            let ctaStyle = null;
            if (bodyCta) {
              const cs = getComputedStyle(bodyCta);
              ctaStyle = { color: cs.color, background: cs.backgroundColor };
            }
            return {
              open: !!d?.open,
              formula: text,
              formulaOk: text === '√72 = 6√2',
              ctaStyle,
            };
          });
          note(
            `${label} keyboard fold + sqrt LTR`,
            opened.open && opened.formulaOk,
            JSON.stringify(opened)
          );
          if (opened.ctaStyle) {
            const fg = parseRgb(opened.ctaStyle.color);
            const bg = parseRgb(opened.ctaStyle.background);
            const ratio = fg && bg ? contrastRatio(fg, bg) : 0;
            note(
              `${label} math CTA contrast`,
              ratio >= 3,
              `ratio=${ratio.toFixed(2)} ${JSON.stringify(opened.ctaStyle)}`
            );
          }
        } else {
          note(`${label} preview fold`, false, 'missing');
        }
      }

      if (route.id === 'grade7') {
        const g7 = await page.evaluate(() => {
          const links = document.querySelectorAll('.grade-hub__topic-list a').length;
          const fold = document.querySelector('details.grade-hub__intro-fold');
          return { links, hasFold: !!fold };
        });
        note(`${label} topics`, g7.links >= 28, `links=${g7.links}`);
        if (g7.hasFold) {
          await page.focus('details.grade-hub__intro-fold > summary');
          await page.keyboard.press('Enter');
          const opened = await page.evaluate(() => {
            const d = document.querySelector('details.grade-hub__intro-fold');
            return {
              open: !!d?.open,
              introLen: (d?.querySelector('.grade-hub__intro')?.textContent || '').trim().length,
            };
          });
          note(`${label} keyboard intro`, opened.open && opened.introLen > 40, JSON.stringify(opened));
        }
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
if (report.gateBlocked) {
  console.log('DESIGN40_QA_GATE_BLOCKED');
  console.log(report.supervisorActionRequired);
  process.exit(2);
}
console.log(report.ok ? 'DESIGN40_QA_PASS' : 'DESIGN40_QA_FAIL');
process.exit(report.ok ? 0 : 1);
