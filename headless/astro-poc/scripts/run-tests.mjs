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
if ((onlyUnit && onlyLive) || [...args].some(arg => !['--unit', '--live-ssr'].includes(arg))) {
  console.error('Use no flag for the full suite, or exactly one of --unit and --live-ssr.');
  process.exit(2);
}
const outDir = join(root, 'reports', 'test-suites');
mkdirSync(outDir, { recursive: true });

const LIVE_SSR_FILES = new Set(['blog-archive-ssr-gate.test.ts', 'blog-posts-live-sitemap.test.ts']);
const DRAWING_HINT_FILE = 'drawing-hint-topic.test.ts';

function listTests(kind) {
  const all = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.ts'));
  if (kind === 'live-ssr') return all.filter((f) => LIVE_SSR_FILES.has(f));
  return all.filter((f) => !LIVE_SSR_FILES.has(f) && f !== DRAWING_HINT_FILE);
}

function runSuite(name, files) {
  if (!files.length) {
    return { name, ok: false, skipped: 0, tests: 0, pass: 0, fail: 0, cancelled: 0, output: 'Required suite has no test files; no passing suite is claimed' };
  }
  const patterns = files.map((f) => `tests/${f}`);
  // Keep the drawing harness isolated and cap every test process. Running the
  // full inventory at CPU-count concurrency previously exhausted host memory.
  const nodeOptions = [process.env.NODE_OPTIONS || '', '--max-old-space-size=2048'].filter(Boolean).join(' ');
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-reporter=tap', '--test-concurrency=1', ...patterns], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30 * 60 * 1000,
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  const logPath = join(outDir, `${name}.tap.log`);
  writeFileSync(logPath, output);
  const passMatch = output.match(/^# pass (\d+)$/m);
  const failMatch = output.match(/^# fail (\d+)$/m);
  const testsMatch = output.match(/^# tests (\d+)$/m);
  const skippedMatch = output.match(/^# skipped (\d+)$/m);
  const cancelledMatch = output.match(/^# cancelled (\d+)$/m);
  const completeSummary = Boolean(testsMatch && passMatch && failMatch && skippedMatch && cancelledMatch);
  return {
    name,
    files: patterns,
    nodeHeapLimitMiB: 2048,
    testConcurrency: 1,
    ok: r.status === 0 && !r.error && completeSummary && Number(failMatch[1]) === 0 && Number(cancelledMatch[1]) === 0,
    exitCode: r.status,
    tests: testsMatch ? Number(testsMatch[1]) : null,
    pass: passMatch ? Number(passMatch[1]) : null,
    fail: failMatch ? Number(failMatch[1]) : null,
    skipped: skippedMatch ? Number(skippedMatch[1]) : null,
    cancelled: cancelledMatch ? Number(cancelledMatch[1]) : null,
    completeSummary,
    processError: r.error ? { name: r.error.name, code: r.error.code } : null,
    logPath,
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
  const drawing = runSuite('drawing-hint-isolated', [DRAWING_HINT_FILE]);
  report.suites.push(drawing);
  if (!drawing.ok) report.ok = false;
  console.log('\n=== DRAWING HINTS (ISOLATED, 2 GiB HEAP) ===');
  console.log(drawing.ok ? 'PASS' : 'FAIL', `tests=${drawing.tests} pass=${drawing.pass} fail=${drawing.fail}`);
  if (!drawing.ok) console.log(drawing.outputTail);
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
const outPath = join(outDir, 'latest.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log('\n=== SUMMARY ===');
for (const s of report.suites) {
  console.log(`- ${s.name}: ${s.ok ? 'PASS' : 'FAIL'} (pass=${s.pass} fail=${s.fail} skipped=${s.skipped})`);
}
console.log('report:', outPath);
process.exit(report.ok ? 0 : 1);
