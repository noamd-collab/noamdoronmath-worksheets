#!/usr/bin/env node
// What is done, what is pending, what failed, and how much has been spent.

import { readConfig } from '../src/paths.mjs';
import { listStates, readLedger, killSwitchEngaged } from '../src/store.mjs';
import { fmtUsd, fmtDuration } from '../src/cost.mjs';
import { log } from '../src/cli.mjs';

const cfg = readConfig();
const states = listStates();
const done = states.filter((s) => s.completed);
const failed = states.filter((s) => !s.completed && s.status === 'failed');
const running = states.filter((s) => s.status === 'running' && !s.completed);
const l = readLedger();

log('');
log(`completed  ${done.length}`);
log(`failed     ${failed.length}`);
log(`in flight  ${running.length}`);
log(`spent      ${fmtUsd(l.spentUsd)} of ${fmtUsd(cfg.limits.spendLimitUsd)} limit, ${l.calls} calls, ${l.retries} retries`);
log(`kill switch ${killSwitchEngaged(cfg) ? 'ENGAGED - runs are blocked' : 'off'}`);

if (done.length) {
  log('\ncompleted:');
  for (const s of done) log(`  ${fmtDuration(s.audio?.durationSec || 0).padStart(6)}  ${fmtUsd(s.usage?.usd || 0)}  ${s.title}`);
}
if (failed.length) {
  log('\nfailed:');
  for (const s of failed) log(`  ${s.slug}\n     ${String(s.error).slice(0, 160)}`);
  log('\nre-run only these:  node bin/generate.mjs --retry-failed');
}
log('');
