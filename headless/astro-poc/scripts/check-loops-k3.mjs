#!/usr/bin/env node
/**
 * KIMI-LOOPS-K3 verification — headless Chrome via CDP (no dependencies;
 * uses Node's built-in fetch + WebSocket and the installed Google Chrome).
 *
 *   node scripts/check-loops-k3.mjs                 # bbox + behaviour, all widths
 *   node scripts/check-loops-k3.mjs --shots         # + report screenshots
 *
 * Checks (per page × width 1440/1280/1024/768/390):
 *   1. no overlap between .concept-loop / .tri-explorer cards and any
 *      text / heading / button / link / logo outside them
 *   2. inside a card, the SVG never covers the formula/caption rows
 *   3. the card stays inside the viewport horizontally
 *   4. loop engine: playing in view; reduced-motion → static completed frame
 *   5. explorer: pointer drag + keyboard move update the apex
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://127.0.0.1:4400';
const SHOTS = process.argv.includes('--shots');
const OUT = join(homedir(), 'Downloads', 'kimi-loops-k3-shots');
mkdirSync(OUT, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9337;
const WIDTHS = [1440, 1280, 1024, 768, 390];
const PAGES = [
  ['home', '/'],
  ['grade-7', '/grade-7'],
  ['grade-8', '/grade-8'],
  ['grade-9', '/grade-9'],
  ['topic-triangle-area', '/triangle-area-grade-7'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ——— minimal CDP client ——— */
let msgId = 0;
const pending = new Map();
const listeners = new Map();
let ws;

function onEvent(method, fn) {
  if (!listeners.has(method)) listeners.set(method, []);
  listeners.get(method).push(fn);
}
function send(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      ws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = rej;
      });
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) {
          const { resolve, reject } = pending.get(m.id);
          pending.delete(m.id);
          m.error ? reject(new Error(m.error.message)) : resolve(m.result);
        } else if (m.method && listeners.has(m.method)) {
          listeners.get(m.method).forEach((fn) => fn(m.params, m.sessionId));
        }
      };
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('cannot connect to Chrome CDP');
}

/* ——— page model ——— */
async function openPage() {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  return { targetId, sessionId };
}

async function goto(pg, url, width, height = 900) {
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: width <= 500 },
    pg.sessionId
  );
  const loaded = new Promise((res) => onEvent('Page.loadEventFired', res));
  await send('Page.navigate', { url }, pg.sessionId);
  await Promise.race([loaded, sleep(12000)]);
  await sleep(1600); // fonts, JS init, demo start
  // dismiss the production entry gate (it overlays the whole viewport and
  // would false-positive every overlap check); persist acceptance per origin
  await evaljs(
    pg,
    `localStorage.setItem('nd_gate_accepted_v1', new Date().toISOString());
     document.getElementById('ndGateOverlay')?.remove(); 'ok'`
  );
}

async function evaljs(pg, expression) {
  const r = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    pg.sessionId
  );
  if (r.exceptionDetails) throw new Error('page JS: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

async function shot(pg, file, clip) {
  const { data } = await send(
    'Page.captureScreenshot',
    clip ? { format: 'png', clip: { ...clip, scale: 1 } } : { format: 'png' },
    pg.sessionId
  );
  writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
}

/* ——— the bbox audit injected into the page ——— */
const BBOX_JS = `(() => {
  const CARD = '.concept-loop, .tri-explorer';
  const cards = [...document.querySelectorAll(CARD)];
  const rect = (el) => el.getBoundingClientRect();
  const inter = (a, b) =>
    a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const violations = [];
  const vw = window.innerWidth;

  // visible text/interactive elements OUTSIDE the cards
  const textSel = 'h1,h2,h3,h4,p,li,a,button,summary,[role="heading"]';
  const textEls = [...document.querySelectorAll(textSel)].filter((el) => {
    if (el.closest(CARD)) return false;
    const r = rect(el);
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  });

  for (const card of cards) {
    const cr = rect(card);
    for (const t of textEls) {
      const tr = rect(t);
      if (inter(cr, tr)) {
        violations.push({
          kind: 'card-over-text',
          card: card.className,
          text: (t.textContent || '').trim().slice(0, 40),
          tag: t.tagName,
        });
      }
    }
    if (cr.left < -0.5 || cr.right > vw + 0.5) {
      violations.push({ kind: 'card-out-of-viewport', left: cr.left, right: cr.right, vw });
    }
    // inside the card: svg must not cover the formula/caption/readout rows
    const svg = card.querySelector('svg');
    const rows = card.querySelectorAll('.concept-loop__formula, .concept-loop__caption, .tri-explorer__readout, .tri-explorer__hint, .te-slider');
    if (svg) {
      const sr = rect(svg);
      rows.forEach((row) => {
        const rr = rect(row);
        if (rr.height > 0 && inter(sr, rr)) {
          violations.push({ kind: 'svg-over-text-row', row: row.className });
        }
      });
    }
  }

  // decorative strips must not cover text either (iron rule).
  // .hero-draw paths are measured individually — their rects hug the
  // painted stroke, unlike the full-hero overlay svg.
  const decos = [...document.querySelectorAll('.line-art-box, .notebook-doodle, .hero-draw')];
  for (const d of decos) {
    const dr = rect(d);
    if (dr.width === 0) continue;
    for (const t of textEls) {
      const tr = rect(t);
      if (inter(dr, tr)) {
        violations.push({
          kind: 'deco-over-text',
          deco: d.className,
          text: (t.textContent || '').trim().slice(0, 40),
        });
      }
    }
  }
  return { violations, cardCount: cards.length };
})()`;

const LOOP_STATE_JS = `[...document.querySelectorAll('[data-loop]')].map((el) => ({
  variant: el.dataset.loop,
  ...(el.__loop ? el.__loop.state() : { missing: true }),
  formulaOpacity: getComputedStyle(el.querySelector('[data-fx="0"]')).opacity,
}))`;

const EXPLORER_STATE_JS = `(() => {
  const el = document.querySelector('[data-tri-explorer]');
  if (!el) return { missing: true };
  return { u: el.__tri ? el.__tri.state() : null,
           hintOn: el.querySelector('[data-el="hint"]').classList.contains('is-on') };
})()`;

/* ——— main ——— */
const results = [];
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--disable-gpu',
  '--hide-scrollbars',
  '--user-data-dir=/tmp/k3-chrome-profile',
  'about:blank',
]);
process.on('exit', () => chrome.kill('SIGKILL'));

try {
  await connect();

  /* 1) bbox + loop state, all widths */
  for (const [name, path] of PAGES) {
    for (const w of WIDTHS) {
      const pg = await openPage();
      await goto(pg, BASE + path, w);
      const bbox = await evaljs(pg, BBOX_JS);
      const loops = await evaljs(pg, LOOP_STATE_JS);
      const ok = bbox.violations.length === 0;
      results.push({ page: name, width: w, ok, violations: bbox.violations, loops });
      console.log(
        `${ok ? 'PASS' : 'FAIL'} ${name} @${w}  cards=${bbox.cardCount} ` +
          `loops=${loops.map((l) => `${l.variant}:${l.playing ? 'play' : l.static ? 'static' : 'pause'}@t=${(l.t ?? -1).toFixed(1)}`).join(',')}`
      );
      bbox.violations.slice(0, 6).forEach((v) => console.log('   ⚠', JSON.stringify(v)));
      await send('Target.closeTarget', { targetId: pg.targetId });
    }
  }

  /* 2) reduced-motion: static completed frame, toggle hidden */
  {
    const pg = await openPage();
    await send(
      'Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
      pg.sessionId
    );
    await goto(pg, BASE + '/grade-7', 1280);
    const loops = await evaljs(pg, LOOP_STATE_JS);
    const l = loops[0];
    const pass = l && l.static === true && Number(l.formulaOpacity) === 1 && l.t > 6;
    results.push({ page: 'grade-7 reduced-motion', ok: !!pass, loops });
    console.log(`${pass ? 'PASS' : 'FAIL'} reduced-motion grade-7 → static=${l?.static} t=${l?.t} formulaOpacity=${l?.formulaOpacity}`);
    if (SHOTS) await shot(pg, 'rm-grade7-static.png');
    await send('Target.closeTarget', { targetId: pg.targetId });
  }

  /* 3) explorer: pointer drag + keyboard */
  {
    const pg = await openPage();
    await goto(pg, BASE + '/triangle-area-grade-7', 1280);
    await evaljs(pg, `sessionStorage.setItem('k3-tri-demo','1'); 'ok'`);
    await goto(pg, BASE + '/triangle-area-grade-7', 1280); // reload: skip demo
    const before = await evaljs(pg, EXPLORER_STATE_JS);
    // drag: press on the handle, move 120px left (LTR svg), release
    const hx = await evaljs(pg, `(() => {
      const r = document.querySelector('[data-el="hit"]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hx.x, y: hx.y, button: 'left', clickCount: 1 }, pg.sessionId);
    for (let i = 1; i <= 6; i++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx.x - i * 20, y: hx.y, button: 'left' }, pg.sessionId);
      await sleep(30);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hx.x - 120, y: hx.y, button: 'left', clickCount: 1 }, pg.sessionId);
    await sleep(200);
    const afterDrag = await evaljs(pg, EXPLORER_STATE_JS);
    // keyboard: focus range, ArrowLeft ×3
    await evaljs(pg, `document.querySelector('[data-el="range"]').focus(); 'ok'`);
    for (let i = 0; i < 3; i++) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }, pg.sessionId);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }, pg.sessionId);
      await sleep(60);
    }
    const afterKeys = await evaljs(pg, EXPLORER_STATE_JS);
    // note: the page is RTL, so ArrowLeft increments the range value
    const dragOk = before.u === 3 && afterDrag.u < 2.9 && afterDrag.u > -1.5;
    const keysOk = Math.abs(afterKeys.u - afterDrag.u) > 0.05;
    results.push({ page: 'topic drag+keys', ok: dragOk && keysOk, before, afterDrag, afterKeys });
    console.log(`${dragOk && keysOk ? 'PASS' : 'FAIL'} explorer: u ${before.u} →drag→ ${afterDrag.u} →keys→ ${afterKeys.u} (hint=${afterKeys.hintOn})`);
    if (SHOTS) {
      await shot(pg, 'topic-after-drag.png');
      await evaljs(pg, `document.querySelector('[data-tri-explorer]').__tri.setApex(3); 'ok'`);
    }
    await send('Target.closeTarget', { targetId: pg.targetId });
  }

  /* 4) report screenshots: 3 frames per loop + topic page */
  if (SHOTS) {
    const frames = {
      triangle: [2.5, 5.8, 7.8],
      pythagoras: [2.2, 5.5, 7.6],
      'area-model': [3.0, 6.2, 7.5],
    };
    for (const [page, variant] of [['/', 'triangle'], ['/grade-8', 'pythagoras'], ['/grade-9', 'area-model']]) {
      const pg = await openPage();
      await goto(pg, BASE + page, 1280);
      await evaljs(pg, `(() => { const el = document.querySelector('[data-loop="${variant}"]'); el.__loop.pause(); return 'ok'; })()`);
      const card = await evaljs(pg, `(() => {
        const r = document.querySelector('[data-loop="${variant}"] .concept-loop__card').getBoundingClientRect();
        return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top + window.scrollY - 8), width: r.width + 16, height: r.height + 16 };
      })()`);
      // clip is in page coordinates when captureBeyondViewport is used
      let fi = 0;
      for (const t of frames[variant]) {
        fi++;
        await evaljs(pg, `document.querySelector('[data-loop="${variant}"]').__loop.seek(${t}); 'ok'`);
        await sleep(120);
        const { data } = await send('Page.captureScreenshot', {
          format: 'png',
          clip: { x: card.x, y: card.y, width: card.width, height: card.height, scale: 1 },
          captureBeyondViewport: true,
        }, pg.sessionId);
        writeFileSync(join(OUT, `loop-${variant}-f${fi}.png`), Buffer.from(data, 'base64'));
      }
      // full page context shot at the completed frame
      await evaljs(pg, `document.querySelector('[data-loop="${variant}"]').__loop.seek(${frames[variant][2]}); 'ok'`);
      await sleep(120);
      await shot(pg, `page-${variant}-1280.png`);
      await send('Target.closeTarget', { targetId: pg.targetId });
      console.log(`SHOT loop-${variant} f1–f3 + page`);
    }
    // topic page: full-page shot after demo settled
    const pg = await openPage();
    await goto(pg, BASE + '/triangle-area-grade-7', 1280);
    await sleep(3400); // let the demo glide finish
    await shot(pg, 'topic-page-1280.png');
    // mobile shots
    await goto(pg, BASE + '/', 390, 844);
    await sleep(800);
    await shot(pg, 'home-390.png');
    await goto(pg, BASE + '/grade-7', 390, 844);
    await sleep(800);
    await shot(pg, 'grade7-390.png');
    await send('Target.closeTarget', { targetId: pg.targetId });
    console.log('SHOT topic-page-1280, home-390, grade7-390');
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n=== SUMMARY: ${results.length - fails.length}/${results.length} PASS ===`);
  writeFileSync(
    join(OUT, 'check-results.json'),
    JSON.stringify({ when: new Date().toISOString(), base: BASE, results }, null, 2)
  );
  process.exitCode = fails.length ? 1 : 0;
} finally {
  chrome.kill('SIGKILL');
}
