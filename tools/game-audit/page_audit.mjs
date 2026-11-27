/**
 * page_audit.mjs — device-readiness audit for one or more pages.
 *
 *   node page_audit.mjs <url-or-file> [...] [options]
 *
 * Options
 *   --vp=phone,desktop        viewports (phone, tablet, desktop)
 *   --shots=DIR               save full-page screenshots
 *   --steps=N                 drive N states with --step-js before auditing each
 *   --step-js='EXPR'          JS run with the variable i (0-based), e.g. 'window.__lesson.goStep(i)'
 *   --flow=FILE               module: export default async (page, {vp, shot, wait, log}) => {}
 *   --min-target=44           minimum tap target in CSS px
 *   --wait=900                ms to settle after each navigation or step
 *   --json=FILE               write the full report
 *   --quiet                   only print the summary
 *
 * Reports per page, viewport and state:
 *   errors            page errors and console errors
 *   overflowX         horizontal scroll in px
 *   smallTargets      interactive elements below --min-target
 *   svgTextOutside    <text> drawn outside its own viewBox
 *   dragOnlyHandles   drag handles (touch-action none, cursor grab/move) with no keyboard access
 *   controls          visible buttons and focusable elements, so a state with none is obvious
 *
 * Exits 1 when any problem is found, so it can gate a commit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, toUrl, parseArgs, VIEWPORTS } from './_browser.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2));
if (!positional.length) {
  console.error('usage: node page_audit.mjs <url-or-file> [...] [--vp=] [--shots=] [--steps= --step-js=] [--flow=] [--min-target=] [--json=]');
  process.exit(2);
}
const vps = String(flags.vp || 'phone,desktop').split(',');
const minTarget = Number(flags['min-target'] || 44);
const settle = Number(flags.wait || 900);
const steps = Number(flags.steps || 0);
const stepJs = flags['step-js'] || '';
const shotsDir = flags.shots ? resolve(String(flags.shots)) : '';
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

/** Runs inside the page. Keep it self-contained: it is serialized. */
function audit(minPx) {
  const out = { overflowX: 0, smallTargets: [], svgTextOutside: [], dragOnlyHandles: [], buttons: 0, focusable: 0 };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hidden) return false;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    }
    return true;
  };
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}"`;

  out.overflowX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);

  document.querySelectorAll('button, [role="button"], [role="slider"], [role="spinbutton"], a[href], input, select, summary').forEach((el) => {
    if (!visible(el)) return;
    if (el.tagName === 'BUTTON') out.buttons += 1;
    const r = el.getBoundingClientRect();
    const isRange = el.tagName === 'INPUT' && el.type === 'range';
    const h = isRange ? Math.max(r.height, minPx) : r.height;
    if (h < minPx - 0.5 || r.width < minPx - 0.5) out.smallTargets.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  });

  out.focusable = Array.from(document.querySelectorAll('[tabindex]:not([tabindex="-1"])')).filter(visible).length;

  document.querySelectorAll('svg[viewBox]').forEach((svg) => {
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const slackX = Math.max(2, vw * 0.08); // glyph boxes stick out a little by design
    const slackY = Math.max(2, vh * 0.08);
    svg.querySelectorAll('text').forEach((t) => {
      if (!visible(t)) return;
      let b;
      try { b = t.getBBox(); } catch (e) { return; }
      const escapesX = Math.max(vx - b.x, b.x + b.width - (vx + vw)) > slackX;
      const escapesY = Math.max(vy - b.y, b.y + b.height - (vy + vh)) > slackY;
      if (escapesX || escapesY) {
        out.svgTextOutside.push(`${(t.textContent || '').trim().slice(0, 20)} @ ${Math.round(b.x)},${Math.round(b.y)}`);
      }
    });
  });

  // A drag handle usually opts out of browser gestures or shows a grab cursor.
  // cursor is inherited, so only the outermost element carrying the style counts.
  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  document.querySelectorAll('*').forEach((el) => {
    if (el === document.body || el === document.documentElement) return;
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    const grabby = /grab|grabbing|move|ns-resize|ew-resize|nwse-resize/.test(cs.cursor);
    const noTouch = cs.touchAction === 'none';
    if (!grabby && !noTouch) return;
    if (el.closest('svg') === null && !grabby) return; // plain touch-action:none containers are not handles
    const parent = el.parentElement;
    if (parent && parent !== document.documentElement) {
      const ps = getComputedStyle(parent);
      if (ps.cursor === cs.cursor && ps.touchAction === cs.touchAction) return; // inherited, not the handle
    }
    const focusable = el.matches(FOCUSABLE) || !!el.querySelector(FOCUSABLE) || !!el.closest(FOCUSABLE);
    if (!focusable) out.dragOnlyHandles.push(name(el));
  });

  return out;
}

const browser = await launch();
const report = { at: new Date().toISOString(), minTarget, pages: {} };
let problems = 0;
try {
  for (const target of positional) {
    const url = toUrl(target);
    for (const vp of vps) {
      const page = await browser.newPage();
      await page.setViewport(VIEWPORTS[vp] || VIEWPORTS.desktop);
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise((r) => setTimeout(r, settle));

      const states = [];
      const run = async (label, index) => {
        const data = await page.evaluate(audit, minTarget);
        const flat = [
          ...data.smallTargets.map((t) => `tap target below ${minTarget}px: ${t}`),
          ...data.svgTextOutside.map((t) => `svg text outside viewBox: ${t}`),
          ...data.dragOnlyHandles.map((t) => `drag handle without keyboard access: ${t}`),
          ...(data.overflowX > 0 ? [`horizontal overflow: ${data.overflowX}px`] : []),
          ...(data.buttons === 0 && data.focusable === 0 ? ['state has no button and nothing focusable'] : [])
        ];
        problems += flat.length;
        states.push({ state: label, problems: flat, buttons: data.buttons, focusable: data.focusable });
        if (shotsDir) {
          const safe = target.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(-40);
          await page.screenshot({ path: join(shotsDir, `${safe}-${vp}-${String(index).padStart(2, '0')}.png`), fullPage: true });
        }
      };

      if (steps > 0 && stepJs) {
        for (let i = 0; i < steps; i += 1) {
          await page.evaluate(new Function('i', stepJs), i);
          await new Promise((r) => setTimeout(r, settle));
          await run(`step ${i}`, i);
        }
      } else {
        await run('loaded', 0);
      }

      let flowLog = [];
      if (flags.flow) {
        const mod = await import(pathToFileURL(resolve(String(flags.flow))).href + `?v=${Date.now()}`);
        await mod.default(page, {
          vp,
          wait: (ms) => new Promise((r) => setTimeout(r, ms)),
          shot: (n) => (shotsDir ? page.screenshot({ path: join(shotsDir, `${vp}-${n}.png`), fullPage: true }) : Promise.resolve()),
          log: (m) => flowLog.push(String(m))
        });
      }

      problems += errors.length;
      report.pages[`${target} ${vp}`] = { errors, states, flowLog };
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (flags.json) writeFileSync(resolve(String(flags.json)), JSON.stringify(report, null, 2));
if (!flags.quiet) console.log(JSON.stringify(report, null, 2));
for (const [key, val] of Object.entries(report.pages)) {
  const n = val.errors.length + val.states.reduce((s, st) => s + st.problems.length, 0);
  console.log(`${n === 0 ? 'OK  ' : 'FAIL'} ${key}: errors=${val.errors.length} problems=${val.states.reduce((s, st) => s + st.problems.length, 0)}`);
}
process.exit(problems === 0 ? 0 : 1);
