/**
 * Wix hosting serves the site from Cloudflare Workers: no node:fs, no process.cwd(),
 * and no guaranteed `process.env`. Server code under src/ must stay portable;
 * scripts/ and tests/ run in Node and are not checked here.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { runtimeProcessEnv } from '../src/lib/runtimeEnv.ts';

const SRC = join(import.meta.dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|astro|mjs|js)$/.test(name) ? [path] : [];
  });
}

/** Code only: block and line comments removed so documentation may name the rules. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

describe('runtime portability of src/ (Cloudflare Workers)', () => {
  const files = sourceFiles(SRC).map((path) => ({ rel: relative(SRC, path), body: code(readFileSync(path, 'utf8')) }));

  it('scans the source tree', () => {
    assert.ok(files.length > 50, `only ${files.length} files found under src/`);
  });

  it('imports no node: built-ins', () => {
    const offenders = files.filter((f) => /from\s+['"]node:|import\(\s*['"]node:|require\(\s*['"]node:/.test(f.body));
    assert.deepEqual(offenders.map((f) => f.rel), []);
  });

  it('never reads a bare `process` (use runtimeProcessEnv or astro:env)', () => {
    const offenders = files.filter((f) => f.rel !== join('lib', 'runtimeEnv.ts') && /(?<![\w$.])process\s*\./.test(f.body));
    assert.deepEqual(offenders.map((f) => f.rel), []);
  });
});

describe('runtimeProcessEnv', () => {
  it('returns process.env where Node provides it', () => {
    assert.equal(runtimeProcessEnv(), process.env);
  });

  it('returns an empty object when the runtime has no process', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'process');
    assert.ok(original);
    Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true, writable: true });
    let env: Record<string, string | undefined>;
    try {
      env = runtimeProcessEnv();
    } finally {
      Object.defineProperty(globalThis, 'process', original);
    }
    assert.deepEqual(env, {});
  });
});
