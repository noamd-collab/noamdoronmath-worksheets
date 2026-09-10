#!/usr/bin/env node
// Proves a rendered MP3 actually contains the whole article. Length alone is not
// evidence, so this transcribes the finished file and aligns the transcript against
// the narration script.
//
//   node bin/verify-audio.mjs --post=<slug>
//   node bin/verify-audio.mjs --all
//   node bin/verify-audio.mjs --post=<slug> --no-asr   # format and pace checks only
//
// Checks: MP3 is a real mono 24 kHz file; pace is plausible; no two chunks produced
// byte-identical audio; word coverage against the script; no inserted speech; the
// style instruction was not read aloud.

import fs from 'node:fs';
import { readConfig, p } from '../src/paths.mjs';
import { listPosts, getPost } from '../src/wix.mjs';
import { buildScript } from '../src/text.mjs';
import { probeMp3 } from '../src/mp3.mjs';
import { readState, listStates } from '../src/store.mjs';
import { transcribeMp3, compareCoverage, styleLeak, duplicateChunks } from '../src/asr.mjs';
import { fmtDuration } from '../src/cost.mjs';
import { parseArgs, log, fail } from '../src/cli.mjs';

const args = parseArgs();
const cfg = readConfig();
const source = args.source || 'sitemap';

let states = listStates().filter((s) => s.completed && s.audio?.file);
if (args.post) {
  const want = String(args.post);
  states = states.filter((s) => s.slug === want || s.postId === want);
}
if (!states.length) fail('no completed renders to verify (run bin/generate.mjs first)');

let failures = 0;

for (const st of states) {
  log(`\n=== ${st.title}`);
  const problems = [];
  const notes = [];

  if (!fs.existsSync(st.audio.file)) { problems.push(`missing file ${st.audio.file}`); }
  else {
    const probe = probeMp3(st.audio.file);
    notes.push(`file: ${fmtDuration(probe.durationSec)}, ${(probe.bytes / 1024).toFixed(0)} KB, ${probe.codec} ${probe.sampleRate}Hz/${probe.channels}ch ${Math.round((probe.bitrate || 0) / 1000)}kbps`);
    if (probe.codec !== 'mp3') problems.push(`not an mp3 (${probe.codec})`);
    if (probe.channels !== cfg.audio.mp3Channels) problems.push(`channels ${probe.channels}, expected ${cfg.audio.mp3Channels}`);
    if (probe.sampleRate !== cfg.audio.mp3SampleRate) problems.push(`sample rate ${probe.sampleRate}, expected ${cfg.audio.mp3SampleRate}`);

    const cps = st.scriptChars / probe.durationSec;
    const [lo, hi] = cfg.verify.charsPerSecondRange;
    notes.push(`pace: ${cps.toFixed(1)} chars/s (allowed ${lo}-${hi})`);
    if (cps < lo || cps > hi) problems.push(`pace out of range: ${cps.toFixed(1)} chars/s`);
  }

  const dups = duplicateChunks(st.audio?.chunkPcmSha256 || []);
  if (dups.length) problems.push(`identical audio for chunk pairs ${JSON.stringify(dups)} - a chunk was read twice`);

  if (!args['no-asr']) {
    // Re-derive the script from the live post so the check is independent of state.
    const posts = await listPosts(cfg, { source, dev: !!args.dev });
    const stub = posts.find((x) => x.slug === st.slug) || { slug: st.slug, url: st.url };
    const full = await getPost(cfg, stub, { source, dev: !!args.dev });
    const script = buildScript({ title: full.title, body: full.body || full.contentText || '' });

    const { text: transcript, usage } = await transcribeMp3(st.audio.file, { model: cfg.verify.asrModel });
    const cov = compareCoverage(script, transcript);
    const leak = styleLeak(cfg.tts.styleInstruction, transcript);

    notes.push(`coverage: ${(cov.coverage * 100).toFixed(1)}% of ${cov.scriptWords} script words (min ${(cfg.verify.minCoverage * 100).toFixed(0)}%)`);
    notes.push(`inserted speech: ${(cov.extraRatio * 100).toFixed(1)}% of transcript (max ${(cfg.verify.maxExtraRatio * 100).toFixed(0)}%)`);
    notes.push(`asr tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`);

    if (cov.coverage < cfg.verify.minCoverage) problems.push(`coverage too low: ${(cov.coverage * 100).toFixed(1)}%`);
    if (cov.extraRatio > cfg.verify.maxExtraRatio) problems.push(`too much speech that is not in the script: ${(cov.extraRatio * 100).toFixed(1)}%`);
    if (leak.leaked) problems.push(`style instruction was read aloud: ${JSON.stringify(leak.hits.slice(0, 1))}`);
    if (cov.missingRuns.length) notes.push(`longest unread stretch: "${cov.missingRuns[0].slice(0, 120)}"`);

    const reportFile = p('reports', `verify-${st.slug.slice(0, 60)}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({ post: st.slug, coverage: cov, leak, transcript }, null, 1));
    notes.push(`transcript and alignment saved to ${reportFile}`);
  }

  for (const n of notes) log(`  · ${n}`);
  if (problems.length) {
    failures++;
    log('  ✗ problems:');
    for (const x of problems) log(`     - ${x}`);
  } else {
    log('  ✓ passed');
  }
}

log(`\n${failures ? `✗ ${failures} of ${states.length} failed verification` : `✓ all ${states.length} verified`}\n`);
process.exit(failures ? 1 : 0);
