#!/usr/bin/env node
/**
 * Run a zero-pointer flow module against one live page, at one or both viewports.
 *
 *   PUPPETEER_ROOT=<app> node live_flow.mjs <url> --flow=flows/<slug>.mjs \
 *     [--vp=phone,desktop] [--expect=320] [--shots=<dir>] [--wait=900]
 *
 * The flow module exports `default async (page, { vp, shot, wait, log })`, exactly
 * like the harness flows, so the same file runs locally and in CI. This runner only
 * supplies the browser, the viewport, the screenshot helper and the final assertion;
 * all game knowledge stays in the flow.
 *
 * Exit status: 0 when every viewport reaches the expected score, 1 otherwise.
 * No secrets, no repository writes: screenshots go to --shots (default ./shots-live).
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
if (!url) {
  console.error('usage: node live_flow.mjs <url> --flow=flows/<slug>.mjs [--vp=phone,desktop] [--expect=320]');
  process.exit(2);
}
const flowPath = flag('flow');
if (!flowPath) {
  console.error('live_flow: --flow is required');
  process.exit(2);
}
const viewports = String(flag('vp', 'phone,desktop')).split(',');
const expect = Number(flag('expect', '320'));
const shotsRoot = resolve(flag('shots', 'shots-live'));
const settle = Number(flag('wait', '900'));

const VIEWPORTS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1280, height: 860, deviceScaleFactor: 1 },
};

function findUp(name, from) {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, 'node_modules', name))) return join(dir, 'node_modules', name);
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
function loadPuppeteer() {
  for (const root of [process.env.PUPPETEER_ROOT, process.cwd()].filter(Boolean)) {
    const hit = findUp('puppeteer-core', root);
    if (hit) return createRequire(join(hit, 'package.json'))('puppeteer-core');
  }
  throw new Error('puppeteer-core not found: set PUPPETEER_ROOT to the app that owns node_modules');
}
const BROWSERS = [
  process.env.BROWSER_PATH,
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
function browserPath() {
  const hit = BROWSERS.find((p) => p && existsSync(p));
  if (!hit) throw new Error('No Chromium-family browser found: set BROWSER_PATH');
  return hit;
}

const mod = await import(pathToFileURL(resolve(flowPath)).href);
const flow = mod.default;
if (typeof flow !== 'function') {
  console.error(`live_flow: ${flowPath} does not export a default function`);
  process.exit(2);
}

const puppeteer = loadPuppeteer();
let failed = false;
for (const name of viewports) {
  const vp = VIEWPORTS[name];
  if (!vp) {
    console.error(`live_flow: unknown viewport ${name}`);
    failed = true;
    continue;
  }
  const browser = await puppeteer.launch({
    executablePath: browserPath(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport(vp);
  const lines = [];
  const log = (m) => {
    lines.push(m);
    console.log(`[${name}] ${m}`);
  };
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction('window.__lesson && window.__lesson.state', { timeout: 30000 });
    const dir = join(shotsRoot, `${name}`);
    mkdirSync(dir, { recursive: true });
    const shot = async (label) => {
      await page.screenshot({ path: join(dir, `${label}.png`) });
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await flow(page, { vp: name, shot, wait, log });
    await wait(settle);
    const total = await page.evaluate(() => window.__lesson.report().total);
    if (total !== expect) {
      failed = true;
      log(`FAIL total ${total}, expected ${expect}`);
    } else {
      log(`OK total ${total}`);
    }
  } catch (error) {
    failed = true;
    log(`FAIL ${error.message}`);
  } finally {
    await browser.close();
  }
}
process.exit(failed ? 1 : 0);
