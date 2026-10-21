#!/usr/bin/env node
/**
 * Browser user journeys against a served build.
 *
 *   npx astro build --config astro.config.preview.mjs   # once
 *   CHROME_PATH=/path/to/chrome npm run test:journeys
 *
 * JOURNEY_BASE_URL=http://host:port reuses a running server instead of starting
 * dist/server/entry.mjs. External hosts (Wix media, CDNs, Google) are never
 * contacted: the journeys stub them and say so in their assertions.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not answer at ${url}`);
}

let base = process.env.JOURNEY_BASE_URL;
let server;
if (!base) {
  const entry = join(root, 'dist/server/entry.mjs');
  if (!existsSync(entry)) {
    console.error('dist/server/entry.mjs missing: run `npx astro build --config astro.config.preview.mjs` first');
    process.exit(2);
  }
  const port = await freePort();
  server = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });
  base = `http://127.0.0.1:${port}`;
  await waitFor(`${base}/`);
}

const files = readdirSync(join(root, 'tests/journeys'))
  .filter((f) => f.endsWith('.journey.ts'))
  .map((f) => `tests/journeys/${f}`);
const r = spawnSync('npx', ['tsx', '--test', '--test-concurrency=1', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, JOURNEY_BASE_URL: base },
});
server?.kill();
process.exit(r.status ?? 1);
