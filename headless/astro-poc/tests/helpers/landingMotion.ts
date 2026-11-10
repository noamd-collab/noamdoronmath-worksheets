/**
 * Frame-diff the "after" side of a /review/landing-loops-* gallery.
 *
 * Each card is sampled at fixed loop times (ConceptLoop via __loop.seek, CSS
 * loops via Animation.currentTime), so the result does not depend on timers.
 * The gallery is served by `astro dev` with the local preview config, the same
 * loopback server AGENTS.md documents; no build and no Wix secrets.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp from 'sharp';
import { resolveTestBrowser } from './chromium.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface CardMotion {
  slug: string;
  width: number;
  /** ConceptLoop film, or CSS loop. */
  engine: 'film' | 'css' | 'none';
  /** Running before sampling (the loop starts by itself in view). */
  started: boolean;
  /** Drawn shapes (not text) that move, resize, or draw their stroke on between samples:
   *  box change over 2px, or dash offset change over 2px (2% of a unit pathLength). */
  movingShapes: number;
  /** CSS only: animations whose keyframes change transform, on non-text elements. */
  transformAnimations: number;
  /** Share of the picture's pixels that change between samples, in %. */
  changedPct: number;
  /** Share of the picture covered by the box around all changes, in %. */
  changedBoxPct: number;
  /** The card keeps one height through the loop (no layout shift). */
  stableHeight: boolean;
  /** Page wider than the viewport. */
  overflowX: boolean;
  /** CSS animations still running after html.nd-motion-off. */
  runningAfterStop: number;
  /** ConceptLoop playing after html.nd-motion-off. */
  filmPlayingAfterStop: boolean;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === 'object' && addr ? resolve(addr.port) : reject(new Error('no port'))));
    });
  });
}

export interface ReviewServer {
  origin: string;
  stop: () => void;
}

/**
 * `probePath` must be a page that renders under `astro dev`: Vite shows an
 * earlier SSR error as an overlay on every page it serves afterwards.
 */
export async function startReviewServer(probePath: string): Promise<ReviewServer> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    process.execPath,
    [join(root, 'node_modules/astro/astro.js'), 'dev', '--config', 'astro.config.preview.mjs', '--host', '127.0.0.1', '--port', String(port)],
    { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', BROWSER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let log = '';
  child.stdout?.on('data', (d) => (log += d));
  child.stderr?.on('data', (d) => (log += d));
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  for (;;) {
    if (child.exitCode != null) throw new Error(`astro dev exited ${child.exitCode}\n${log.slice(-2000)}`);
    let status = 0;
    try {
      status = (await fetch(`${origin}${probePath}`, { signal: AbortSignal.timeout(30_000) })).status;
    } catch {
      /* not up yet */
    }
    if (status === 200) break;
    if (status >= 500 || Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error(`astro dev did not serve ${probePath} (${status})\n${log.slice(-2000)}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { origin, stop: () => child.kill('SIGTERM') };
}

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: resolveTestBrowser(),
    headless: true,
    args: ['--no-sandbox', '--hide-scrollbars', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
}

/** Screenshot times, as a share of one loop. */
const SAMPLES = [0.12, 0.3, 0.48, 0.66, 0.84];
/** Shape reads are cheap, so they sample the loop densely. */
const SHAPE_SAMPLES = Array.from({ length: 24 }, (_, i) => (i + 0.5) / 24);

/** Runs in the page: park the card's loop at `frac` of one lap. */
function seekCard(el: Element, frac: number) {
  const film = el.querySelector('[data-loop]') as (HTMLElement & { __loop?: { pause: () => void; seek: (t: number) => void; state: () => { duration?: number } } }) | null;
  if (film?.__loop) {
    film.__loop.pause();
    film.__loop.seek(frac * (film.__loop.state().duration || 10));
    return;
  }
  for (const a of el.getAnimations({ subtree: true })) {
    a.pause();
    const timing = a.effect?.getComputedTiming();
    a.currentTime = Math.max(0, Number(timing?.delay) || 0) + frac * (Number(timing?.duration) || 0);
  }
}

/** Runs in the page: box and stroke dash offset of every visible drawn shape, in DOM order.
 *  No inner named functions: tsx would add a `__name` helper the page lacks. */
function shapeBoxes(card: Element): (number[] | null)[] {
  const shapes = card.querySelectorAll('svg path, svg line, svg rect, svg circle, svg ellipse, svg polygon, svg polyline');
  return [...shapes].map((shape) => {
    if (shape.closest('button') || shape.classList.contains('sk-stage')) return null;
    const own = getComputedStyle(shape);
    const blank = /^(none|transparent|rgba\(0, 0, 0, 0\))$/;
    if (blank.test(own.fill) && blank.test(own.stroke)) return null;
    let opacity = 1;
    for (let node: Element | null = shape; node && node !== card; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      opacity *= Number(style.opacity);
    }
    if (opacity < 0.05) return null;
    const r = shape.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    const length = Number(shape.getAttribute('pathLength')) || 0;
    const drawn = own.strokeDasharray === 'none' ? 0 : parseFloat(own.strokeDashoffset) * (length ? 100 / length : 1);
    return [r.x, r.y, r.width, r.height, drawn].map((v) => Math.round(v));
  });
}
const THRESH = 40;

async function rgb(png: Uint8Array) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/**
 * Measure every card of one gallery at one viewport width. A fresh dev server
 * may reload the page once while Vite optimizes dependencies; the pass is then
 * repeated on the reloaded page.
 */
export async function measureGallery(browser: Browser, url: string, width: number, side: 'before' | 'after' = 'after'): Promise<CardMotion[]> {
  for (let attempt = 0; ; attempt++) {
    const result = await measureOnce(browser, url, width, side);
    if (result || attempt >= 2) {
      if (!result) throw new Error(`${url} kept reloading during the measurement`);
      return result;
    }
  }
}

async function measureOnce(browser: Browser, url: string, width: number, side: 'before' | 'after'): Promise<CardMotion[] | null> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
    const res = await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    if (!res || res.status() !== 200) throw new Error(`${url} → ${res?.status()}`);
    await page.evaluate(() => ((window as unknown as { __measured?: boolean }).__measured = true));
    await new Promise((r) => setTimeout(r, 500));
    if (await page.$('vite-error-overlay')) throw new Error(`${url} shows a Vite error overlay`);
    const slugs: string[] = await page.$$eval('[data-review-slug]', (els) => els.map((e) => e.getAttribute('data-review-slug') || ''));
    const out: CardMotion[] = [];
    for (const slug of slugs) {
      const sel = `[data-review-slug="${slug}"] [data-review-side="${side}"] .exact-topic-demo`;
      await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
      await new Promise((r) => setTimeout(r, 700));
      const info = await page.$eval(sel, (el) => {
        const root = el.querySelector('[data-loop]') as (HTMLElement & { __loop?: { state: () => { playing?: boolean } } }) | null;
        const text = /^(p|span|sup|sub|text|tspan|bdi)$/;
        const anims = el.getAnimations({ subtree: true });
        const moving = anims.filter((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
          if (!t || text.test(t.tagName.toLowerCase())) return false;
          const kf = (a.effect as KeyframeEffect).getKeyframes();
          return new Set(kf.map((k) => String(k.transform ?? ''))).size > 1;
        });
        return {
          engine: root ? 'film' : anims.length ? 'css' : 'none',
          started: root ? Boolean(root.__loop?.state?.().playing) : anims.some((a) => a.playState === 'running'),
          transformAnimations: moving.length,
        } as const;
      });
      const frames = [] as Awaited<ReturnType<typeof rgb>>[];
      const heights: number[] = [];
      const boxes: (number[] | null)[][] = [];
      for (const f of SHAPE_SAMPLES) {
        await page.$eval(sel, seekCard, f);
        boxes.push(await page.$eval(sel, shapeBoxes));
      }
      for (const f of SAMPLES) {
        await page.$eval(sel, seekCard, f);
        await new Promise((r) => setTimeout(r, 120));
        const handle = await page.$(sel);
        const box = await handle!.boundingBox();
        heights.push(Math.round(box!.height));
        const png = await handle!.screenshot({ type: 'png' });
        if (process.env.LANDING_MOTION_FRAMES) {
          mkdirSync(process.env.LANDING_MOTION_FRAMES, { recursive: true });
          writeFileSync(join(process.env.LANDING_MOTION_FRAMES, `${slug}-${width}-${f}.png`), png);
        }
        frames.push(await rgb(png));
      }
      const w = frames[0].w;
      const h = frames[0].h;
      const union = new Uint8Array(w * h);
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1].data;
        const b = frames[i].data;
        const n = Math.min(a.length, b.length) / 3;
        for (let p = 0; p < n; p++) {
          const j = p * 3;
          if (Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]) > THRESH) union[p] = 1;
        }
      }
      let changed = 0;
      let minx = w, miny = h, maxx = -1, maxy = -1;
      for (let p = 0; p < union.length; p++) {
        if (!union[p]) continue;
        changed++;
        const x = p % w;
        const y = (p / w) | 0;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
      let movingShapes = 0;
      for (let i = 0; i < boxes[0].length; i++) {
        const seen = boxes.map((b) => b[i]).filter((b): b is number[] => b != null);
        if (seen.some((b) => b.some((v, k) => Math.abs(v - seen[0][k]) > 2))) movingShapes++;
      }
      await page.evaluate(() => document.documentElement.classList.add('nd-motion-off'));
      await new Promise((r) => setTimeout(r, 80));
      const stop = await page.$eval(sel, (el) => {
        const running = el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length;
        const root = el.querySelector('[data-loop]') as (HTMLElement & { __loop?: { play: () => void; state: () => { playing?: boolean } } }) | null;
        root?.__loop?.play();
        const filmPlaying = Boolean(root?.__loop?.state?.().playing);
        return { running, filmPlaying };
      });
      await page.evaluate(() => document.documentElement.classList.remove('nd-motion-off'));
      await new Promise((r) => setTimeout(r, 80));
      out.push({
        slug,
        width,
        engine: info.engine,
        started: info.started,
        movingShapes,
        transformAnimations: info.transformAnimations,
        changedPct: +((100 * changed) / (w * h)).toFixed(3),
        changedBoxPct: maxx < 0 ? 0 : +((100 * (maxx - minx + 1) * (maxy - miny + 1)) / (w * h)).toFixed(1),
        stableHeight: new Set(heights).size === 1,
        overflowX: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
        runningAfterStop: stop.running,
        filmPlayingAfterStop: stop.filmPlaying,
      });
    }
    const sameDocument = await page.evaluate(() => (window as unknown as { __measured?: boolean }).__measured === true);
    return sameDocument ? out : null;
  } finally {
    await page.close();
  }
}
