#!/usr/bin/env node
// Renders narration MP3s. This is the only script that spends money.
//
//   node bin/generate.mjs --post=<slug>            # one post (the pilot)
//   node bin/generate.mjs --all --limit=5          # a stoppable batch
//   node bin/generate.mjs --from-queue             # whatever the site says is outstanding
//   node bin/generate.mjs --retry-failed           # only posts whose last run failed
//   node bin/generate.mjs --all --dry-run          # plan and cost, no API calls
//   node bin/generate.mjs --post=<slug> --no-upload  # keep the MP3 local
//
// Flags: --source=wix|sitemap  --dev  --model=<id>  --force  --out=<dir>
//
// Safety: a kill switch file (config.limits.killSwitchFile) stops the run before
// every paid call, and the ledger in state/ledger.json enforces the spend limit.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readConfig, p, ensureDir } from '../src/paths.mjs';
import { listPosts, getPost, wixRegisterAudio, wixGetQueue } from '../src/wix.mjs';
import { publishAudio, storageBackend } from '../src/storage.mjs';
import { buildScript, chunkScript } from '../src/text.mjs';
import { speakChunk, isRetryable } from '../src/tts.mjs';
import { encodePcmToMp3, probeMp3, silencePcm, pcmDurationSec, requireFfmpeg } from '../src/mp3.mjs';
import {
  audioSignature, readState, writeState, readChunk, writeChunk, clearWork,
  acquireLock, addSpend, readLedger, assertCanSpend, sha256,
} from '../src/store.mjs';
import { actualCostUsd, estimateForChars, fmtUsd, fmtDuration } from '../src/cost.mjs';
import { parseArgs, log, fail } from '../src/cli.mjs';

const args = parseArgs();
const cfg = readConfig();
if (args.model) cfg.tts.model = String(args.model);
const source = args.source || 'sitemap';
const dev = !!args.dev;
const dryRun = !!args['dry-run'];
const outDir = ensureDir(args.out ? path.resolve(String(args.out)) : p('out'));

if (!dryRun) requireFfmpeg();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- select posts ----
let posts = await listPosts(cfg, { source, dev });
if (args.post) {
  const want = String(args.post);
  posts = posts.filter((x) => x.slug === want || x.id === want || decodeURIComponent(x.slug) === want);
  if (!posts.length) fail(`no published post matches --post=${want}`);
}
if (args['from-queue']) {
  // The site decides what is outstanding: posts with no audio, or whose text changed.
  const queue = await wixGetQueue(cfg, { dev });
  const wanted = new Set(queue.map((q) => q.slug));
  posts = posts.filter((x) => wanted.has(x.slug));
  log(`queue from site: ${queue.length} post(s) outstanding`);
  if (!posts.length) { log('\nnothing outstanding\n'); process.exit(0); }
}
if (args['retry-failed']) {
  posts = posts.filter((x) => {
    const st = readState(x.id || x.slug);
    return st && !st.completed;
  });
  if (!posts.length) { log('\nnothing to retry - no failed posts in state/\n'); process.exit(0); }
}
if (args.limit) posts = posts.slice(0, Number(args.limit));

log(`\nmodel ${cfg.tts.model}  voice ${cfg.tts.voice}  source ${source}  storage ${storageBackend(cfg)}  posts ${posts.length}${dryRun ? '  [DRY RUN]' : ''}`);
log(`ledger so far: ${fmtUsd(readLedger().spentUsd)} of ${fmtUsd(cfg.limits.spendLimitUsd)} limit\n`);

const results = { done: [], skipped: [], failed: [] };

for (const stub of posts) {
  const full = await getPost(cfg, stub, { source, dev });
  const postId = full.id || full.slug;
  const script = buildScript({ title: full.title, body: full.body || full.contentText || '' });
  const chunks = chunkScript(script, cfg.tts);
  const signature = audioSignature({ postId, script, cfg });
  const est = estimateForChars(cfg, script.length, { chunks: chunks.length });

  const prior = readState(postId);
  if (prior && prior.completed && prior.signature === signature && !args.force) {
    log(`= skip  ${full.title}  (already rendered, signature ${signature.slice(0, 12)})`);
    results.skipped.push({ postId, slug: full.slug, reason: 'signature unchanged' });
    continue;
  }

  if (dryRun) {
    log(`~ plan  ${full.title}\n         ${chunks.length} chunks, ${script.length} chars, est ${fmtDuration(est.estSeconds)}, est ${fmtUsd(est.estUsd)}, signature ${signature.slice(0, 12)}`);
    results.done.push({ postId, slug: full.slug, planned: true });
    continue;
  }

  const lock = acquireLock(postId, cfg.limits.lockStaleMinutes);
  if (!lock) {
    log(`= skip  ${full.title}  (another run holds the lock)`);
    results.skipped.push({ postId, slug: full.slug, reason: 'locked' });
    continue;
  }

  const state = {
    postId,
    slug: full.slug,
    title: full.title,
    url: full.url,
    signature,
    model: cfg.tts.model,
    voice: cfg.tts.voice,
    language: cfg.tts.language ?? null,
    contentSource: full.contentSource,
    scriptChars: script.length,
    scriptSha256: sha256(script),
    totalChunks: chunks.length,
    completedChunks: prior && prior.signature === signature ? (prior.completedChunks || []) : [],
    status: 'running',
    completed: false,
    startedAt: new Date().toISOString(),
    attempts: ((prior && prior.signature === signature ? prior.attempts : 0) || 0) + 1,
    usage: { inputTextTokens: 0, outputAudioTokens: 0, usd: 0, retries: 0 },
    error: null,
  };
  writeState(postId, state);

  try {
    assertCanSpend(cfg, est.estUsd);
    log(`> render ${full.title}\n         ${chunks.length} chunks, ${script.length} chars, est ${fmtUsd(est.estUsd)}`);

    const pcmParts = [];
    const chunkHashes = [];
    const gap = silencePcm(cfg.tts.interChunkSilenceMs, {
      sampleRate: cfg.audio.pcmSampleRate,
      channels: cfg.audio.pcmChannels,
      bytesPerSample: cfg.audio.pcmBytesPerSample,
    });

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      let pcm = readChunk(signature, i, text);

      if (pcm) {
        log(`         [${i + 1}/${chunks.length}] cached`);
      } else {
        let lastErr = null;
        for (let attempt = 1; attempt <= cfg.limits.maxRetriesPerChunk + 1; attempt++) {
          assertCanSpend(cfg, 0);
          try {
            const res = await speakChunk({
              text,
              model: cfg.tts.model,
              voice: cfg.tts.voice,
              language: cfg.tts.language,
              styleInstruction: cfg.tts.styleInstruction,
              timeoutMs: cfg.limits.requestTimeoutMs,
            });

            if (res.sampleRate !== cfg.audio.pcmSampleRate || res.channels !== cfg.audio.pcmChannels) {
              throw new Error(`unexpected audio format ${res.sampleRate}Hz/${res.channels}ch (expected ${cfg.audio.pcmSampleRate}Hz/${cfg.audio.pcmChannels}ch)`);
            }
            const secs = pcmDurationSec(res.pcm.length, {
              sampleRate: cfg.audio.pcmSampleRate,
              channels: cfg.audio.pcmChannels,
              bytesPerSample: cfg.audio.pcmBytesPerSample,
            });
            const cps = text.length / Math.max(secs, 0.001);
            const [lo, hi] = cfg.verify.charsPerSecondRange;
            if (secs < 0.5 || cps < lo || cps > hi) {
              throw new Error(`chunk audio implausible: ${text.length} chars in ${secs.toFixed(1)}s (${cps.toFixed(1)} chars/s, allowed ${lo}-${hi})`);
            }

            const usd = actualCostUsd(cfg, cfg.tts.model, res.usage);
            addSpend({ model: cfg.tts.model, ...res.usage, usd, retry: attempt > 1 });
            state.usage.inputTextTokens += res.usage.inputTextTokens;
            state.usage.outputAudioTokens += res.usage.outputAudioTokens;
            state.usage.usd = Number((state.usage.usd + usd).toFixed(6));
            if (attempt > 1) state.usage.retries += attempt - 1;

            pcm = res.pcm;
            writeChunk(signature, i, text, pcm);
            log(`         [${i + 1}/${chunks.length}] ${fmtDuration(secs)}  ${res.usage.outputAudioTokens} audio tokens  ${fmtUsd(usd)}${attempt > 1 ? `  (attempt ${attempt})` : ''}`);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            const retryable = isRetryable(e) || /implausible/.test(String(e.message));
            if (!retryable || attempt > cfg.limits.maxRetriesPerChunk) break;
            const wait = cfg.limits.retryBaseDelayMs * attempt;
            log(`         [${i + 1}/${chunks.length}] attempt ${attempt} failed (${String(e.message).slice(0, 110)}) - retrying in ${wait}ms`);
            await sleep(wait);
          }
        }
        if (lastErr) throw lastErr;
        await sleep(cfg.limits.minDelayBetweenRequestsMs);
      }

      chunkHashes.push(crypto.createHash('sha256').update(pcm).digest('hex'));
      pcmParts.push(pcm);
      if (i < chunks.length - 1) pcmParts.push(gap);
      if (!state.completedChunks.includes(i)) state.completedChunks.push(i);
      writeState(postId, state);
    }

    const joined = Buffer.concat(pcmParts);
    const mp3Path = path.join(outDir, `${safeName(full.slug)}.mp3`);
    encodePcmToMp3(joined, mp3Path, cfg.audio);
    const probe = probeMp3(mp3Path);

    if (probe.codec !== 'mp3' || probe.channels !== cfg.audio.mp3Channels || probe.sampleRate !== cfg.audio.mp3SampleRate) {
      throw new Error(`encoded file is not ${cfg.audio.mp3Channels}ch/${cfg.audio.mp3SampleRate}Hz mp3: ${JSON.stringify(probe)}`);
    }
    const cps = script.length / probe.durationSec;
    const [lo, hi] = cfg.verify.charsPerSecondRange;
    if (cps < lo || cps > hi) {
      throw new Error(`whole-file pace implausible: ${cps.toFixed(1)} chars/s (allowed ${lo}-${hi}) - likely a skipped or repeated section`);
    }

    state.audio = {
      file: mp3Path,
      bytes: probe.bytes,
      durationSec: Number(probe.durationSec.toFixed(3)),
      sampleRate: probe.sampleRate,
      channels: probe.channels,
      bitrate: probe.bitrate,
      chunkPcmSha256: chunkHashes,
      charsPerSecond: Number(cps.toFixed(2)),
    };
    log(`         encoded ${fmtDuration(probe.durationSec)}  ${(probe.bytes / 1024).toFixed(0)} KB  ${probe.sampleRate}Hz/${probe.channels}ch  ${Math.round((probe.bitrate || 0) / 1000)}kbps`);

    if (!args['no-upload']) {
      const fileName = `${safeName(full.slug)}.mp3`;
      const uploaded = await publishAudio(cfg, { mp3Path, fileName, dev });
      const registered = await wixRegisterAudio(cfg, {
        postId: full.id || null,
        slug: full.slug,
        signature,
        model: cfg.tts.model,
        voice: cfg.tts.voice,
        language: cfg.tts.language ?? null,
        styleHash: sha256(cfg.tts.styleInstruction).slice(0, 16),
        scriptSha256: state.scriptSha256,
        scriptChars: script.length,
        durationSec: state.audio.durationSec,
        bytes: probe.bytes,
        storageBackend: uploaded.backend,
        fileId: uploaded.fileId,
        fileUrl: uploaded.url,
        renderedAt: new Date().toISOString(),
      }, { dev });
      state.published = { backend: uploaded.backend, fileId: uploaded.fileId, fileUrl: uploaded.url, registered: registered?.ok !== false };
      log(`         stored via ${uploaded.backend}: ${uploaded.url}`);
    } else {
      log('         --no-upload: file kept locally only');
    }

    state.status = 'completed';
    state.completed = true;
    state.finishedAt = new Date().toISOString();
    writeState(postId, state);
    clearWork(signature);
    results.done.push({ postId, slug: full.slug, durationSec: state.audio.durationSec, usd: state.usage.usd });
  } catch (e) {
    state.status = 'failed';
    state.completed = false;
    state.error = String(e.message || e).slice(0, 600);
    state.finishedAt = new Date().toISOString();
    writeState(postId, state);
    log(`✗ failed ${full.title}\n         ${state.error}`);
    results.failed.push({ postId, slug: full.slug, error: state.error });
    if (/kill switch|spend limit/.test(state.error)) { lock.release(); break; }
  } finally {
    lock.release();
  }
}

function safeName(s) {
  return String(s).normalize('NFC').replace(/[\/\\?%*:|"<>\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

const l = readLedger();
log('');
log(`done ${results.done.length}   skipped ${results.skipped.length}   failed ${results.failed.length}`);
log(`spent this ledger: ${fmtUsd(l.spentUsd)} over ${l.calls} calls (${l.retries} retries)`);
if (results.failed.length) {
  log('\nfailed posts:');
  for (const f of results.failed) log(`  - ${f.slug}: ${f.error.slice(0, 140)}`);
  log('\nre-run only the failures with:\n  node bin/generate.mjs --retry-failed\n');
}
process.exit(results.failed.length ? 1 : 0);
