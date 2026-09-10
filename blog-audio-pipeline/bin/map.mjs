#!/usr/bin/env node
// Maps every published post, measures the narration script, and prints the cost
// estimate. Makes no audio-generation calls whatsoever.
//
//   node bin/map.mjs                      # sitemap + server-rendered pages
//   node bin/map.mjs --source=wix         # via the site's own backend (better text)
//   node bin/map.mjs --json               # machine-readable

import fs from 'node:fs';
import { readConfig, p } from '../src/paths.mjs';
import { listPosts, getPost } from '../src/wix.mjs';
import { buildScript, chunkScript } from '../src/text.mjs';
import { estimateForChars, fmtUsd, fmtDuration } from '../src/cost.mjs';
import { readState, audioSignature } from '../src/store.mjs';
import { parseArgs, log } from '../src/cli.mjs';

const args = parseArgs();
const cfg = readConfig();
const source = args.source || 'sitemap';

const posts = await listPosts(cfg, { source, dev: !!args.dev });
const rows = [];

for (const post of posts) {
  const full = await getPost(cfg, post, { source, dev: !!args.dev });
  const script = buildScript({ title: full.title, body: full.body || full.contentText || '' });
  const chunks = chunkScript(script, cfg.tts);
  const est = estimateForChars(cfg, script.length, { chunks: chunks.length });
  const sig = audioSignature({ postId: full.id || full.slug, script, cfg });
  const st = readState(full.id || full.slug);
  rows.push({
    slug: full.slug,
    title: full.title,
    url: full.url,
    firstPublishedDate: full.firstPublishedDate,
    lastPublishedDate: full.lastPublishedDate,
    contentSource: full.contentSource,
    scriptChars: script.length,
    scriptWords: script.split(/\s+/).filter(Boolean).length,
    chunks: chunks.length,
    estSeconds: est.estSeconds,
    estUsd: est.estUsd,
    signature: sig.slice(0, 16),
    state: st ? (st.signature === sig && st.completed ? 'done' : st.completed ? 'stale' : st.status || 'partial') : 'missing',
  });
  if (!args.json) log(`  ${String(rows.length).padStart(2)}. ${fmtDuration(est.estSeconds).padStart(5)}  ${String(rows[rows.length - 1].scriptChars).padStart(5)} ch  ${String(rows[rows.length - 1].chunks).padStart(2)} chunks  ${fmtUsd(est.estUsd)}  [${rows[rows.length - 1].state}]  ${full.title}`);
}

const totalChars = rows.reduce((a, r) => a + r.scriptChars, 0);
const totalChunks = rows.reduce((a, r) => a + r.chunks, 0);
const total = estimateForChars(cfg, totalChars, { chunks: totalChunks });
const pending = rows.filter((r) => r.state !== 'done');
const pendingTotal = estimateForChars(cfg, pending.reduce((a, r) => a + r.scriptChars, 0), { chunks: pending.reduce((a, r) => a + r.chunks, 0) });
const retryAllowance = 0.2;

const summary = {
  generatedAt: new Date().toISOString(),
  source,
  posts: rows.length,
  totalScriptChars: totalChars,
  totalChunks,
  model: cfg.tts.model,
  voice: cfg.tts.voice,
  estTotalMinutes: Number((total.estSeconds / 60).toFixed(1)),
  estTotalUsd: total.estUsd,
  estTotalUsdWithRetries: Number((total.estUsd * (1 + retryAllowance)).toFixed(2)),
  estPendingUsd: pendingTotal.estUsd,
  estPendingUsdWithRetries: Number((pendingTotal.estUsd * (1 + retryAllowance)).toFixed(2)),
  spendLimitUsd: cfg.limits.spendLimitUsd,
  assumptions: {
    hebrewCharsPerSecond: cfg.pricing.assumedHebrewCharsPerSecond,
    audioTokensPerSecond: cfg.pricing.assumedAudioTokensPerSecond,
    hebrewCharsPerToken: cfg.pricing.assumedHebrewCharsPerToken,
    retryAllowance,
  },
  posts_detail: rows,
};

const outFile = p('reports', `mapping-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outFile, JSON.stringify(summary, null, 1));

if (args.json) {
  log(JSON.stringify(summary, null, 1));
} else {
  log('');
  log(`  posts                 ${summary.posts}`);
  log(`  narration characters  ${summary.totalScriptChars.toLocaleString('en-US')}`);
  log(`  chunks                ${summary.totalChunks}`);
  log(`  estimated audio       ${summary.estTotalMinutes} min`);
  log(`  model / voice         ${summary.model} / ${summary.voice}`);
  log(`  estimated cost        ${fmtUsd(summary.estTotalUsd)}  (${fmtUsd(summary.estTotalUsdWithRetries)} with a ${retryAllowance * 100}% retry allowance)`);
  log(`  still to render       ${pending.length} posts, ${fmtUsd(summary.estPendingUsdWithRetries)}`);
  log(`  spend limit in config ${fmtUsd(summary.spendLimitUsd)}`);
  log(`  report written to     ${outFile}`);
  log('');
}
