/**
 * Shared browser bootstrap for the audit scripts.
 * Resolves puppeteer-core from the project under test (it is rarely installed
 * next to the skill) and picks a Chromium-family executable.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const VIEWPORTS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1280, height: 860, deviceScaleFactor: 1 }
};

const BROWSERS = [
  process.env.BROWSER_PATH,
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

function findUp(name, from) {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, 'node_modules', name))) return join(dir, 'node_modules', name);
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export function loadPuppeteer() {
  const roots = [process.env.PUPPETEER_ROOT, process.cwd()].filter(Boolean);
  for (const root of roots) {
    const hit = findUp('puppeteer-core', root);
    if (hit) return createRequire(join(hit, 'package.json'))('puppeteer-core');
  }
  throw new Error(
    'puppeteer-core not found. Run these scripts from inside the project that has it, ' +
    'or set PUPPETEER_ROOT=/path/to/project (a directory whose node_modules contains puppeteer-core).'
  );
}

export function browserPath() {
  const hit = BROWSERS.find((p) => p && existsSync(p));
  if (!hit) throw new Error('No Chromium-family browser found. Set BROWSER_PATH to one.');
  return hit;
}

export async function launch(extraArgs = []) {
  const puppeteer = loadPuppeteer();
  return puppeteer.launch({
    executablePath: browserPath(),
    headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check', ...extraArgs]
  });
}

/** Accepts an http(s) URL or a filesystem path, returns a loadable URL. */
export function toUrl(target) {
  if (/^(https?|file):/.test(target)) return target;
  return 'file://' + resolve(target);
}

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, ...rest] = a.slice(2).split('=');
      flags[k] = rest.length ? rest.join('=') : true;
    } else positional.push(a);
  }
  return { positional, flags };
}
