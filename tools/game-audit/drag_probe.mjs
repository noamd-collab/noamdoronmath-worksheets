/**
 * drag_probe.mjs — prove that the pointer drag still works after adding
 * keyboard and button routes. A regression here is silent otherwise, because
 * the new routes make every automated play-through pass.
 *
 *   node drag_probe.mjs <url-or-file> [options]
 *
 * Options
 *   --handles=SEL,SEL   handles to probe; omit to auto-discover them
 *   --before='EXPR'     JS evaluated before probing, e.g. 'window.__lesson.goStep(3)'
 *   --vp=desktop        viewport (phone, tablet, desktop)
 *   --dist=140          drag distance in px
 *   --wait=900          ms to settle after load and after --before
 *   --root=SEL          element whose markup is fingerprinted (default: #card or body)
 *   --json=FILE         write the report
 *
 * Auto-discovery picks visible focusable elements inside an svg, [role="slider"],
 * [draggable="true"], and anything with a grab cursor or touch-action: none.
 *
 * A handle counts as working when a real pointer drag changes the fingerprint
 * of the page (markup plus text). Do not require the scene to be solved: many
 * scenes need an exact value that a blind drag will not land on.
 *
 * Exits 1 when a probed handle does not react.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, toUrl, parseArgs, VIEWPORTS } from './_browser.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2));
if (!positional.length) {
  console.error('usage: node drag_probe.mjs <url-or-file> [--handles="#a,#b"] [--before=] [--vp=] [--dist=] [--json=]');
  process.exit(2);
}
const dist = Number(flags.dist || 140);
const settle = Number(flags.wait || 900);
const rootSel = flags.root ? String(flags.root) : '';

/** Runs inside the page: tags every plausible handle and returns its selector. */
function discover() {
  // A focusable element is not automatically a drag handle: an accessible game
  // gives many groups tabindex for the keyboard route, so only a real drag
  // affordance counts here. When a page drags without one, name the handles
  // yourself with --handles.
  const found = new Set(document.querySelectorAll('[role="slider"], [draggable="true"]'));
  document.querySelectorAll('svg *, [class], [style]').forEach((el) => {
    const cs = getComputedStyle(el);
    if (/grab|grabbing|move|ns-resize|ew-resize/.test(cs.cursor) || cs.touchAction === 'none') found.add(el);
  });
  const out = [];
  let i = 0;
  for (const el of found) {
    if (el === document.body || el === document.documentElement) continue;
    // The <svg> container is not a handle: probing it drags whatever sits
    // under the centre of the drawing and gives flaky results.
    if (el.tagName.toLowerCase() === 'svg') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) continue;
    if (!el.hasAttribute('data-probe')) el.setAttribute('data-probe', 'h' + i++);
    out.push({
      sel: `[data-probe="${el.getAttribute('data-probe')}"]`,
      label: el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase()
    });
  }
  return out;
}

function fingerprint(sel) {
  const el = (sel && document.querySelector(sel)) || document.querySelector('#card') || document.body;
  return el.innerHTML.length + '|' + el.innerHTML.slice(0, 6000);
}

const browser = await launch();
const out = { target: positional[0], handles: {}, errors: [] };
let inert = [];
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORTS[String(flags.vp || 'desktop')] || VIEWPORTS.desktop);
  page.on('pageerror', (e) => out.errors.push(String(e.message)));
  await page.goto(toUrl(positional[0]), { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, settle));
  if (flags.before) {
    await page.evaluate(new Function(String(flags.before)));
    await new Promise((r) => setTimeout(r, settle));
  }

  const handles = flags.handles
    ? String(flags.handles).split(',').map((s) => s.trim()).filter(Boolean).map((sel) => ({ sel, label: sel }))
    : await page.evaluate(discover);

  for (const { sel, label } of handles) {
    let reacted = false;
    const tried = [];
    for (const [dx, dy] of [[dist, 0], [-dist, 0], [0, dist], [0, -dist]]) {
      const box = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return null;
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, sel);
      if (!box) { tried.push('not visible'); continue; }
      const before = await page.evaluate(fingerprint, rootSel);
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x + dx / 2, box.y + dy / 2, { steps: 6 });
      await page.mouse.move(box.x + dx, box.y + dy, { steps: 6 });
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 220));
      const after = await page.evaluate(fingerprint, rootSel);
      tried.push(`${dx},${dy}:${after !== before ? 'changed' : 'same'}`);
      if (after !== before) { reacted = true; break; }
    }
    out.handles[label] = { sel, reacted, tried };
  }
  inert = Object.entries(out.handles).filter(([, v]) => !v.reacted).map(([k]) => k);
} finally {
  await browser.close();
}

if (flags.json) writeFileSync(resolve(String(flags.json)), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
const total = Object.keys(out.handles).length;
if (!total) {
  console.log('OK   no drag handle on this view');
  process.exit(0);
}
if (inert.length) {
  console.log(`FAIL pointer drag no longer moves: ${inert.join(', ')}`);
  process.exit(1);
}
console.log(`OK   pointer drag still moves ${total} handle(s)`);
