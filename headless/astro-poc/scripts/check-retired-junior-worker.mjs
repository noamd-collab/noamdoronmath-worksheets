#!/usr/bin/env node
/**
 * The retired-sheet 301 has to be inside the worker bundle. Middleware never
 * sees /_files or the static viewer, because the asset handler answers first.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'X-Noam-Retired-Sheet';

export async function workerBundleHasRetiredSheetGuard(serverDir) {
  const root = path.resolve(serverDir);
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (await walk(absolute)) return true;
      } else if (entry.isFile()) {
        const text = await readFile(absolute, 'utf8');
        if (text.includes(MARKER)) return true;
      }
    }
    return false;
  }
  return walk(root);
}

async function main() {
  const projectRoot = process.cwd();
  const metadata = JSON.parse(await readFile(path.join(projectRoot, '.wix/build-metadata.json'), 'utf8'));
  const serverDir = path.resolve(projectRoot, metadata.serverDir);
  if (!(await workerBundleHasRetiredSheetGuard(serverDir))) {
    console.error('Retired junior sheet guard is missing from the worker bundle.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Retired junior worker check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
