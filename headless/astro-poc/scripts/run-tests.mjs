#!/usr/bin/env node
/**
 * Split test runner: deterministic unit suite vs external live-SSR parity.
 * Never conflates the two into a single silent "all green".
 *
 * Usage:
 *   node scripts/run-tests.mjs           # both, separate summaries; exit 1 if either fails
 *   node scripts/run-tests.mjs --unit
 *   node scripts/run-tests.mjs --live-ssr
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const onlyUnit = args.has('--unit');
const onlyLive = args.has('--live-ssr');

const LIVE_SSR_FILES = new Set(['blog-archive-ssr-gate.test.ts']);

function listTests(kind) {
  const all = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.ts'));
  if (kind === 'live-ssr') return all.filter((f) => LIVE_SSR_FILES.has(f));
  return all.filter((f) => !LIVE_SSR_FILES.has(f));
}

function runSuite(name, files) {
  if (!files.length) {
    return { name, ok: true, skipped: true, output: 'no files' };
  }
  const patterns = files.map((f) => `tests/${f}`);
  const r = spawnSync('npx', ['tsx', '--test', ...patterns], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  const passMatch = output.match(/# pass (\d+)/);
  const failMatch = output.match(/# fail (\d+)/);
  const testsMatch = output.match(/# tests (\d+)/);
  return {
    name,
    ok: r.status === 0,
    exitCode: r.status,
    tests: testsMatch ? Number(testsMatch[1]) : null,
    pass: passMatch ? Number(passMatch[1]) : null,
    fail: failMatch ? Number(failMatch[1]) : null,
    outputTail: output.trim().split('\n').slice(-30).join('\n'),
  };
}

const report = {
  startedAt: new Date().toISOString(),
  suites: [],
  ok: true,
  note:
    'Deterministic unit suite must not be reported green when only live-SSR external checks fail, and vice versa. Live-SSR hits production network.',
};

if (!onlyLive) {
  const unit = runSuite('deterministic-unit', listTests('unit'));
  report.suites.push(unit);
  if (!unit.ok) report.ok = false;
  console.log('\n=== DETERMINISTIC UNIT ===');
  console.log(
    unit.ok ? 'PASS' : 'FAIL',
    `tests=${unit.tests} pass=${unit.pass} fail=${unit.fail}`
  );
  if (!unit.ok) console.log(unit.outputTail);
}

if (!onlyUnit) {
  const live = runSuite('live-ssr-external', listTests('live-ssr'));
  report.suites.push({
    ...live,
    kind: 'external-network',
    dependency: 'https://www.noamdoronmath.co.il blog archive HTML',
  });
  if (!live.ok) report.ok = false;
  console.log('\n=== LIVE-SSR EXTERNAL PARITY ===');
  console.log(
    live.ok ? 'PASS' : 'FAIL',
    `tests=${live.tests} pass=${live.pass} fail=${live.fail}`
  );
  if (!live.ok) console.log(live.outputTail);
}

report.finishedAt = new Date().toISOString();
const outDir = join(root, 'reports', 'test-suites');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'latest.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log('\n=== SUMMARY ===');
for (const s of report.suites) {
  console.log(`- ${s.name}: ${s.ok ? 'PASS' : 'FAIL'} (pass=${s.pass} fail=${s.fail})`);
}
console.log('report:', outPath);
process.exit(report.ok ? 0 : 1);
