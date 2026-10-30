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

const LIVE_SSR_FILES = new Set(['blog-archive-ssr-gate.test.ts', 'blog-posts-live-sitemap.test.ts']);

function listTests(kind) {
  const all = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.ts'));
  if (kind === 'live-ssr') return all.filter((f) => LIVE_SSR_FILES.has(f));
  return all.filter((f) => !LIVE_SSR_FILES.has(f));
}

function runSuite(name, files) {
  if (!files.length) {
    return { name, ok: false, skipped: true, tests: 0, pass: 0, fail: 0, skippedTests: 0, output: 'Required suite has no test files; no passing suite is claimed' };
  }
  const patterns = files.map((f) => `tests/${f}`);
  const r = spawnSync('npx', ['tsx', '--test', '--test-reporter=tap', ...patterns], {
    cwd: root,
    encoding: 'utf8',
    // Keep large failure diffs intact instead of terminating the child at the
    // spawnSync default buffer limit. TAP is stable across supported Node versions.
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  const logDir = join(root, 'reports', 'test-suites');
  mkdirSync(logDir, { recursive: true });
  const outputLog = join(logDir, `${name}.tap`);
  writeFileSync(outputLog, output);
  const passMatch = output.match(/^# pass (\d+)$/m);
  const failMatch = output.match(/^# fail (\d+)$/m);
  const testsMatch = output.match(/^# tests (\d+)$/m);
  const skippedMatch = output.match(/^# skipped (\d+)$/m);
  const summaryFound = !!(passMatch && failMatch && testsMatch);
  return {
    name,
    ok: r.status === 0 && !r.error && summaryFound,
    ...(r.error ? { executionError: { name: r.error.name, code: r.error.code || null } } : {}),
    ...(!summaryFound ? { summaryError: 'TAP summary missing; no passing suite is claimed' } : {}),
    exitCode: r.status,
    outputLog,
    tests: testsMatch ? Number(testsMatch[1]) : null,
    pass: passMatch ? Number(passMatch[1]) : null,
    fail: failMatch ? Number(failMatch[1]) : null,
    skippedTests: skippedMatch ? Number(skippedMatch[1]) : null,
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
    `tests=${unit.tests} pass=${unit.pass} fail=${unit.fail} skipped=${unit.skippedTests}`
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
    `tests=${live.tests} pass=${live.pass} fail=${live.fail} skipped=${live.skippedTests}`
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
  console.log(`- ${s.name}: ${s.ok ? 'PASS' : 'FAIL'} (pass=${s.pass} fail=${s.fail} skipped=${s.skippedTests})`);
}
console.log('report:', outPath);
process.exit(report.ok ? 0 : 1);
