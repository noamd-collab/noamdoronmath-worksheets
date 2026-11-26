/**
 * Local-only verification harness for Eliyahu engine games. Never committed.
 *
 *   node shots.mjs <slug> [--vp=phone,desktop] [--steps=all|0,2,5] [--script=flow.mjs]
 *
 * Builds a standalone page from the worktree's engine + spec (file:// URLs, so
 * edits are picked up on every run), opens it in headless Microsoft Edge at a
 * phone and a desktop viewport, jumps to every step with __lesson.goStep(i),
 * screenshots it and runs layout checks. Prints a JSON summary and writes it to
 * shots/<slug>/summary.json. Screenshots: shots/<slug>/<vp>-<step>.png.
 *
 * --script=flow.mjs: a module whose default export is
 *   async (page, { vp, shot, wait, log }) => {}
 * run once per viewport after load, for a scripted play-through. `shot(name)`
 * saves shots/<slug>/<vp>-<name>.png.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP_DIR ? resolve(process.env.APP_DIR)
  : resolve(HERE, '../eliyahu-b5-games/headless/astro-poc');
const require = createRequire(join(APP, 'package.json'));
const puppeteer = require('puppeteer-core');
const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
if (!slug) { console.error('usage: node shots.mjs <slug> [--vp=phone,desktop] [--steps=all]'); process.exit(2); }
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const vps = opt('vp', 'phone,desktop').split(',');
const stepsArg = opt('steps', 'all');
const flowPath = opt('script', '');

const VIEWPORTS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1280, height: 860, deviceScaleFactor: 1 }
};

function themeFor(gameSlug) {
  const src = readFileSync(join(APP, 'src/lib/eliyahuGames.ts'), 'utf8');
  const at = src.indexOf(`slug: '${gameSlug}'`);
  if (at < 0) throw new Error(`${gameSlug} is not in eliyahuGames.ts`);
  const name = src.slice(at).match(/theme:\s*([A-Z]+)/)[1];
  const block = src.match(new RegExp(`const ${name}: GameTheme = \\{([^}]+)\\}`))[1];
  const get = (k) => block.match(new RegExp(`${k}: '(#[0-9a-f]{6})'`))[1];
  return [
    `--ink:${get('ink')}`, `--main:${get('main')}`, `--main-dark:${get('mainDark')}`,
    `--main-soft:${get('mainSoft')}`, `--main-line:${get('mainLine')}`,
    `--bg-a:${get('bgA')}`, `--bg-b:${get('bgB')}`, `--bg-c:${get('bgC')}`
  ].join(';');
}

function buildPage(gameSlug) {
  const eng = join(APP, 'src/games/engine');
  const bust = `?v=${Date.now()}`;
  const fonts = readFileSync(join(eng, 'fonts.css'), 'utf8')
    .replace(/url\('\.\/fonts\/([^']+)'\)/g, (_, f) => `url('${pathToFileURL(join(eng, 'fonts', f)).href}')`)
    .replace(/url\('\/fonts\/([^']+)'\)/g, (_, f) => `url('${pathToFileURL(join(APP, 'public/fonts', f)).href}')`);
  const mascot = readFileSync(join(eng, 'mascot.html'), 'utf8');
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${gameSlug}</title>
<style>${fonts}</style>
<link rel="stylesheet" href="${pathToFileURL(join(eng, 'engine.css')).href}${bust}">
<style>:root{${themeFor(gameSlug)}}</style>
</head><body>
<div id="app" dir="rtl" lang="he"></div>
${mascot}
<script src="${pathToFileURL(join(eng, 'engine.js')).href}${bust}"></script>
<script src="${pathToFileURL(join(APP, 'src/games/specs', `${gameSlug}.js`)).href}${bust}"></script>
</body></html>`;
  const dir = join(HERE, 'pages');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${gameSlug}.html`);
  writeFileSync(file, html);
  return pathToFileURL(file).href;
}

/** Runs inside the page: layout problems on the current step. */
function checksInPage() {
  const out = { overflowX: 0, smallTargets: [], svgTextOutside: [], controls: 0, keyboardHandles: 0, mode: '' };
  const L = window.__lesson;
  const S = L.steps[L.state.idx];
  out.mode = S.mode;
  out.overflowX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hidden) return false;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  };
  document.querySelectorAll('#card button, #card input, #card select, #card [role="button"], #sceneSvg [tabindex]').forEach((el) => {
    if (!visible(el)) return;
    if (el.closest('#float')) return;
    const r = el.getBoundingClientRect();
    const isRange = el.tagName === 'INPUT' && el.type === 'range';
    const h = isRange ? 44 : r.height;
    if (h < 43.5 || r.width < 43.5) {
      out.smallTargets.push(`${el.tagName.toLowerCase()}#${el.id || ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  });
  const svg = document.getElementById('sceneSvg');
  if (svg && visible(svg)) {
    const vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
    svg.querySelectorAll('text').forEach((t) => {
      if (!t.textContent.trim()) return;
      let b;
      try { b = t.getBBox(); } catch (e) { return; }
      if (!b.width) return;
      const ctm = t.getCTM();
      const svgCtm = svg.getCTM();
      // Map the bbox corners into the root viewBox space.
      const pts = [[b.x, b.y], [b.x + b.width, b.y + b.height]].map(([x, y]) => {
        const p = svg.createSVGPoint(); p.x = x; p.y = y;
        const q = p.matrixTransform(ctm).matrixTransform(svgCtm.inverse());
        return q;
      });
      const minX = Math.min(pts[0].x, pts[1].x), maxX = Math.max(pts[0].x, pts[1].x);
      const minY = Math.min(pts[0].y, pts[1].y), maxY = Math.max(pts[0].y, pts[1].y);
      if (minX < vb[0] - 2 || minY < vb[1] - 2 || maxX > vb[0] + vb[2] + 2 || maxY > vb[1] + vb[3] + 2) {
        out.svgTextOutside.push(`"${t.textContent.trim().slice(0, 20)}" [${Math.round(minX)},${Math.round(minY)}..${Math.round(maxX)},${Math.round(maxY)}]`);
      }
    });
    out.keyboardHandles = svg.querySelectorAll('[tabindex]').length;
  }
  out.controls = document.querySelectorAll('#sceneRow button, #sceneExtra button, #sceneExtra input, #sceneExtra select').length;
  return out;
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check', '--disable-extensions']
});
const shotDir = join(HERE, 'shots', slug);
mkdirSync(shotDir, { recursive: true });
const summary = { slug, at: new Date().toISOString(), viewports: {} };
try {
  const url = buildPage(slug);
  for (const vp of vps) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS[vp]);
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); });
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url().slice(-80)} ${r.failure() && r.failure().errorText}`));
    await page.goto(url, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 900));
    const count = await page.evaluate(() => (window.__lesson ? window.__lesson.steps.length : 0));
    if (!count) { summary.viewports[vp] = { errors: errors.concat('engine did not boot') }; continue; }
    const steps = stepsArg === 'all' ? [...Array(count).keys()] : stepsArg.split(',').map(Number);
    const rows = [];
    for (const i of steps) {
      await page.evaluate((k) => window.__lesson.goStep(k), i);
      await new Promise((r) => setTimeout(r, 1400));
      const c = await page.evaluate(checksInPage);
      await page.screenshot({ path: join(shotDir, `${vp}-${String(i).padStart(2, '0')}.png`), fullPage: true });
      rows.push({ step: i, ...c });
    }
    if (flowPath) {
      const flow = (await import(pathToFileURL(resolve(flowPath)).href + `?v=${Date.now()}`)).default;
      const log = [];
      await page.evaluate(() => window.__lesson.goStep(0));
      await flow(page, {
        vp,
        wait: (ms) => new Promise((r) => setTimeout(r, ms)),
        shot: (name) => page.screenshot({ path: join(shotDir, `${vp}-${name}.png`), fullPage: true }),
        log: (msg) => log.push(String(msg))
      });
      rows.push({ flow: flowPath, log });
    }
    summary.viewports[vp] = { errors, steps: rows };
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(shotDir, 'summary.json'), JSON.stringify(summary, null, 2));
const compact = {};
for (const [vp, v] of Object.entries(summary.viewports)) {
  compact[vp] = {
    errors: v.errors,
    problems: (v.steps || []).filter((s) => s.step !== undefined).map((s) => {
      const p = [];
      if (s.overflowX) p.push(`overflowX ${s.overflowX}px`);
      if (s.smallTargets.length) p.push(`small: ${s.smallTargets.join('; ')}`);
      if (s.svgTextOutside.length) p.push(`svg text outside: ${s.svgTextOutside.join('; ')}`);
      if (s.mode === 'scene' && !s.controls && !s.keyboardHandles) p.push('scene has no button/keyboard control');
      return p.length ? `step ${s.step} (${s.mode}): ${p.join(' | ')}` : null;
    }).filter(Boolean),
    flow: (v.steps || []).filter((s) => s.flow).map((s) => s.log)
  };
}
console.log(JSON.stringify(compact, null, 2));
console.log(`screenshots: ${shotDir}`);
