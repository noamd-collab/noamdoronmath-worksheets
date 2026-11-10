/**
 * Frame-diff the "after" side of a /review/landing-loops-* gallery.
 *
 * Each card is sampled at fixed loop times (ConceptLoop via __loop.seek, CSS
 * loops via Animation.currentTime), so the result does not depend on timers.
 * The gallery is served by `astro dev` with the local preview config, the same
 * loopback server AGENTS.md documents; no build and no Wix secrets.
 */
import { spawn, type ChildProcess } from 'node:child_process';
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
  /** CSS only: animations whose transform changes, on non-text elements. */
  movingShapes: number;
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

export async function startReviewServer(): Promise<ReviewServer> {
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
    try {
      const res = await fetch(`${origin}/review/`, { signal: AbortSignal.timeout(2000) });
      if (res.status > 0) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error(`astro dev did not start\n${log.slice(-2000)}`);
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

const SAMPLES = [0.12, 0.3, 0.48, 0.66, 0.84];
const THRESH = 40;

async function rgb(png: Uint8Array) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Measure every card of one gallery at one viewport width. */
export async function measureGallery(browser: Browser, url: string, width: number): Promise<CardMotion[]> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
    const res = await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    if (!res || res.status() !== 200) throw new Error(`${url} → ${res?.status()}`);
    const slugs: string[] = await page.$$eval('[data-review-slug]', (els) => els.map((e) => e.getAttribute('data-review-slug') || ''));
    const out: CardMotion[] = [];
    for (const slug of slugs) {
      const sel = `[data-review-slug="${slug}"] [data-review-side="after"] .exact-topic-demo`;
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
          movingShapes: moving.length,
        } as const;
      });
      const frames = [] as Awaited<ReturnType<typeof rgb>>[];
      const heights: number[] = [];
      for (const f of SAMPLES) {
        await page.$eval(
          sel,
          (el, frac) => {
            const root = el.querySelector('[data-loop]') as (HTMLElement & { __loop?: { pause: () => void; seek: (t: number) => void } }) | null;
            if (root?.__loop) {
              root.__loop.pause();
              const dur = Number(root.getAttribute('data-duration')) || 10;
              root.__loop.seek(frac * dur);
              return;
            }
            for (const a of el.getAnimations({ subtree: true })) {
              a.pause();
              const timing = a.effect?.getComputedTiming();
              const iter = Number(timing?.duration) || 0;
              const delay = Number(timing?.delay) || 0;
              a.currentTime = Math.max(0, delay) + frac * iter;
            }
          },
          f,
        );
        await new Promise((r) => setTimeout(r, 120));
        const handle = await page.$(sel);
        const box = await handle!.boundingBox();
        heights.push(Math.round(box!.height));
        frames.push(await rgb(await handle!.screenshot({ type: 'png' })));
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
        movingShapes: info.movingShapes,
        changedPct: +((100 * changed) / (w * h)).toFixed(3),
        changedBoxPct: maxx < 0 ? 0 : +((100 * (maxx - minx + 1) * (maxy - miny + 1)) / (w * h)).toFixed(1),
        stableHeight: new Set(heights).size === 1,
        overflowX: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
        runningAfterStop: stop.running,
        filmPlayingAfterStop: stop.filmPlaying,
      });
    }
    return out;
  } finally {
    await page.close();
  }
}
