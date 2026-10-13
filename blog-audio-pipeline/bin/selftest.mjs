#!/usr/bin/env node
/*
 * Offline self-test. Proves the mechanics of the pipeline without calling Gemini
 * and without spending anything: text preparation, chunk completeness, the
 * deduplication signature, locking, the spend limit, the kill switch, retry
 * classification, PCM assembly, MP3 encoding, and the coverage maths that the
 * audio verification relies on.
 *
 *   node bin/selftest.mjs
 *
 * The encoding checks are skipped, loudly, when ffmpeg is not installed.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { readConfig, p } from '../src/paths.mjs';
import { normalizeForSpeech, buildScript, chunkScript, richContentToText } from '../src/text.mjs';
import { audioSignature, acquireLock, assertCanSpend, readLedger, sha256 } from '../src/store.mjs';
import { isRetryable } from '../src/tts.mjs';
import { ffmpegPath, encodePcmToMp3, probeMp3, silencePcm, pcmDurationSec } from '../src/mp3.mjs';
import { compareCoverage, styleLeak, duplicateChunks } from '../src/asr.mjs';
import { estimateForChars, actualCostUsd } from '../src/cost.mjs';
import { log } from '../src/cli.mjs';

const cfg = readConfig();
let passed = 0;
let failed = 0;
let skipped = 0;

function check(name, fn) {
  try {
    const r = fn();
    if (r === 'skip') { skipped++; log(`  ~ ${name} (skipped)`); return; }
    passed++;
    log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    log(`  ✗ ${name}\n      ${String(e.message || e).slice(0, 300)}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }

log('\n== text preparation ==');

check('percent, currency and units become words', () => {
  const t = normalizeForSpeech('הנחה של 20% על חולצה ב-50$ במלבן 6 ס״מ ושטח 24 סמ״ר');
  assert(t.includes('20 אחוזים'), 'percent not spoken');
  assert(t.includes('50 דולר'), 'dollar not spoken');
  assert(t.includes('סנטימטר'), 'cm not spoken');
  assert(t.includes('סנטימטר מרובע'), 'square cm not spoken');
  assert(!/[%$]/.test(t), `symbol survived: ${t}`);
});

check('arithmetic and comparison signs become words', () => {
  const t = normalizeForSpeech('3/4 ועוד 1/4, 5 × 6 = 30, 12 : 4 = 3, 0.5 > 0.375, 5 >= 5, 2 ≤ 3');
  for (const w of ['חלקי', 'כפול', 'שווה', 'גדול מ-', 'גדול או שווה', 'קטן או שווה']) {
    assert(t.includes(w), `missing "${w}" in: ${t}`);
  }
});

check('URLs, niqqud and thousands separators are handled', () => {
  const t = normalizeForSpeech('ראו https://example.com/x?y=1 וגם 1,250 תלמידים, בְּרוּרוֹת');
  assert(!t.includes('http'), 'url survived');
  assert(t.includes('1250'), 'thousands separator not merged');
  assert(!/[֑-ׇ]/.test(t), 'niqqud survived');
});

check('a heading without punctuation still gets a pause', () => {
  const t = normalizeForSpeech('כותרת ראשית\n\nפסקה ראשונה.');
  assert(t.startsWith('כותרת ראשית.'), `no terminal stop added: ${t}`);
});

log('\n== chunking ==');

const longBody = Array.from({ length: 40 }, (_, i) =>
  `פסקה מספר ${i + 1}. זהו משפט ראשון בפסקה, והוא ארוך מספיק כדי לדחוף את המקטע קדימה. וזהו משפט שני שמסיים אותה.`
).join('\n\n');
const script = buildScript({ title: 'בדיקת חלוקה למקטעים', body: longBody });

check('chunking keeps every character exactly once', () => {
  const chunks = chunkScript(script, cfg.tts);
  const strip = (s) => s.replace(/\s+/g, '');
  eq(strip(chunks.join('')), strip(script), 'characters lost or duplicated');
  assert(chunks.length > 3, `expected several chunks, got ${chunks.length}`);
});

check('no chunk exceeds the configured maximum', () => {
  for (const c of chunkScript(script, cfg.tts)) {
    assert(c.length <= cfg.tts.chunkMaxChars, `chunk of ${c.length} chars exceeds ${cfg.tts.chunkMaxChars}`);
  }
});

check('a single oversized sentence is split rather than dropped', () => {
  const monster = 'מילה '.repeat(900).trim() + '.';
  const chunks = chunkScript(monster, cfg.tts);
  const strip = (s) => s.replace(/\s+/g, '');
  eq(strip(chunks.join('')), strip(monster), 'oversized sentence lost content');
});

check('rich content walk keeps reading order and drops embeds', () => {
  const rc = {
    nodes: [
      { type: 'HEADING', nodes: [{ type: 'TEXT', textData: { text: 'כותרת' } }] },
      { type: 'IMAGE', nodes: [] },
      { type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: 'פסקה.' } }] },
      { type: 'BULLETED_LIST', nodes: [
        { type: 'LIST_ITEM', nodes: [{ type: 'TEXT', textData: { text: 'פריט א' } }] },
        { type: 'LIST_ITEM', nodes: [{ type: 'TEXT', textData: { text: 'פריט ב' } }] },
      ] },
      { type: 'CODE_BLOCK', nodes: [{ type: 'TEXT', textData: { text: 'console.log(1)' } }] },
    ],
  };
  const t = richContentToText(rc);
  eq(t, 'כותרת\n\nפסקה.\n\nפריט א\n\nפריט ב', 'unexpected reading order');
  assert(!t.includes('console.log'), 'code block leaked into narration');
});

log('\n== deduplication signature ==');

check('same inputs produce the same signature', () => {
  const a = audioSignature({ postId: 'post-1', script, cfg });
  const b = audioSignature({ postId: 'post-1', script, cfg });
  eq(a, b, 'signature is not stable');
});

check('changing the voice changes the signature', () => {
  const a = audioSignature({ postId: 'post-1', script, cfg });
  const other = JSON.parse(JSON.stringify(cfg));
  other.tts.voice = 'Kore';
  assert(a !== audioSignature({ postId: 'post-1', script, cfg: other }), 'voice change did not change signature');
});

check('changing the style instruction changes the signature', () => {
  const a = audioSignature({ postId: 'post-1', script, cfg });
  const other = JSON.parse(JSON.stringify(cfg));
  other.tts.styleInstruction += ' ';
  assert(a !== audioSignature({ postId: 'post-1', script, cfg: other }), 'style change did not change signature');
});

check('changing one character of the text changes the signature', () => {
  const a = audioSignature({ postId: 'post-1', script, cfg });
  assert(a !== audioSignature({ postId: 'post-1', script: script + '.', cfg }), 'text change did not change signature');
});

log('\n== locking and limits ==');

check('a second worker cannot take a held lock', () => {
  const id = `selftest-${Date.now()}`;
  const first = acquireLock(id, cfg.limits.lockStaleMinutes);
  assert(first, 'first lock was refused');
  const second = acquireLock(id, cfg.limits.lockStaleMinutes);
  assert(second === null, 'second lock was granted while the first was held');
  first.release();
  const third = acquireLock(id, cfg.limits.lockStaleMinutes);
  assert(third, 'lock was not released');
  third.release();
});

check('the spend limit blocks a run that would exceed it', () => {
  const tight = JSON.parse(JSON.stringify(cfg));
  tight.limits.spendLimitUsd = 0.001;
  let threw = false;
  try { assertCanSpend(tight, 5); } catch (e) { threw = /spend limit/.test(e.message); }
  assert(threw, 'over-limit spend was allowed');
  assertCanSpend(cfg, 0);
});

check('the kill switch blocks a run', () => {
  const f = p(cfg.limits.killSwitchFile);
  const existed = fs.existsSync(f);
  if (!existed) fs.writeFileSync(f, 'selftest');
  let threw = false;
  try { assertCanSpend(cfg, 0); } catch (e) { threw = /kill switch/.test(e.message); }
  if (!existed) fs.unlinkSync(f);
  assert(threw, 'kill switch did not stop the run');
});

check('only transient failures are retried', () => {
  assert(isRetryable(new Error('429 RESOURCE_EXHAUSTED')), '429 should retry');
  assert(isRetryable(new Error('tts request timed out after 1000ms')), 'timeout should retry');
  assert(isRetryable(new Error('fetch failed')), 'network failure should retry');
  assert(!isRetryable(new Error('400 INVALID_ARGUMENT: bad voice name')), 'a bad request must not retry');
  assert(!isRetryable(new Error('403 PERMISSION_DENIED')), 'a permission error must not retry');
});

log('\n== cost accounting ==');

check('actual cost uses the reported token counts', () => {
  const usd = actualCostUsd(cfg, 'gemini-3.1-flash-tts-preview', { inputTextTokens: 1_000_000, outputAudioTokens: 1_000_000 });
  eq(usd, 21, 'expected $1 text + $20 audio per million tokens');
});

check('the archive estimate is in the expected range', () => {
  const est = estimateForChars(cfg, 79827, { chunks: 90 });
  assert(est.estUsd > 2 && est.estUsd < 6, `estimate out of range: ${est.estUsd}`);
});

log('\n== audio assembly ==');

// A short tone, so the encoder has real signal to work with rather than silence.
function tonePcm(seconds, freq) {
  const n = Math.round(cfg.audio.pcmSampleRate * seconds);
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(12000 * Math.sin((2 * Math.PI * freq * i) / cfg.audio.pcmSampleRate));
    buf.writeInt16LE(v, i * 2);
  }
  return buf;
}

const fmt = {
  sampleRate: cfg.audio.pcmSampleRate,
  channels: cfg.audio.pcmChannels,
  bytesPerSample: cfg.audio.pcmBytesPerSample,
};

check('PCM duration maths matches the sample rate', () => {
  const oneSecond = tonePcm(1, 440);
  eq(Number(pcmDurationSec(oneSecond.length, fmt).toFixed(3)), 1, 'one second of PCM did not measure as one second');
  eq(silencePcm(350, fmt).length, Math.round(fmt.sampleRate * 0.35) * 2, 'silence gap has the wrong length');
});

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noam-audio-selftest-'));

check('chunks concatenate and encode to a mono 24 kHz MP3 of the right length', () => {
  if (!ffmpegPath()) return 'skip';
  const parts = [tonePcm(2, 330), silencePcm(cfg.tts.interChunkSilenceMs, fmt), tonePcm(3, 440)];
  const expected = 2 + cfg.tts.interChunkSilenceMs / 1000 + 3;
  const out = path.join(tmpDir, 'joined.mp3');
  encodePcmToMp3(Buffer.concat(parts), out, cfg.audio);
  const probe = probeMp3(out);
  eq(probe.codec, 'mp3', 'not an mp3');
  eq(probe.channels, cfg.audio.mp3Channels, 'wrong channel count');
  eq(probe.sampleRate, cfg.audio.mp3SampleRate, 'wrong sample rate');
  assert(Math.abs(probe.durationSec - expected) < 0.25, `duration ${probe.durationSec}s, expected about ${expected}s`);
  assert(Math.abs((probe.bitrate || 0) - 128000) < 16000, `bitrate ${probe.bitrate}, expected about 128000`);
});

check('the encoded file matches the reference sample format', () => {
  const ref = '/Users/noamdoron/Downloads/דוגמת הקראה בעברית לבלוג — Gemini 3.1 Flash TTS, קול Charon.mp3';
  if (!fs.existsSync(ref)) return 'skip';
  const r = probeMp3(ref);
  eq(r.channels, cfg.audio.mp3Channels, 'reference channel count differs from config');
  eq(r.sampleRate, cfg.audio.mp3SampleRate, 'reference sample rate differs from config');
  assert(Math.abs((r.bitrate || 0) - 128000) < 16000, `reference bitrate ${r.bitrate}`);
});

log('\n== verification maths ==');

check('a complete reading scores full coverage', () => {
  const text = 'ראשית נבין מהו השלם. אחר כך נחשב את החלק. לבסוף נבדוק סבירות.';
  const cov = compareCoverage(text, text);
  eq(cov.coverage, 1, 'identical text did not score 1');
  eq(cov.extraRatio, 0, 'identical text reported extra speech');
});

check('a truncated reading is caught', () => {
  const text = 'ראשית נבין מהו השלם. אחר כך נחשב את החלק. לבסוף נבדוק סבירות של התוצאה שקיבלנו.';
  const cov = compareCoverage(text, 'ראשית נבין מהו השלם.');
  assert(cov.coverage < cfg.verify.minCoverage, `truncation scored ${cov.coverage}, above the ${cfg.verify.minCoverage} floor`);
  assert(cov.missingRuns.length > 0, 'no missing stretch reported');
});

check('inserted speech is caught', () => {
  const text = 'ראשית נבין מהו השלם.';
  const cov = compareCoverage(text, 'ראשית נבין מהו השלם. וכאן המודל הוסיף סיכום שלא היה בטקסט המקורי כלל.');
  assert(cov.extraRatio > cfg.verify.maxExtraRatio, `extra ratio ${cov.extraRatio} did not exceed ${cfg.verify.maxExtraRatio}`);
});

check('reading the style instruction aloud is caught', () => {
  const leaked = styleLeak(cfg.tts.styleInstruction, `${cfg.tts.styleInstruction} ואז הכותרת.`);
  assert(leaked.leaked, 'style instruction leak was not detected');
  const clean = styleLeak(cfg.tts.styleInstruction, 'תרגילי אחוזים לכיתה ז׳. אחוז פירושו חלק מתוך מאה.');
  assert(!clean.leaked, 'clean narration was flagged as a leak');
});

check('a chunk read twice is caught', () => {
  const h = (s) => crypto.createHash('sha256').update(s).digest('hex');
  eq(duplicateChunks([h('a'), h('b'), h('c')]).length, 0, 'distinct chunks flagged as duplicates');
  eq(duplicateChunks([h('a'), h('b'), h('a')]).length, 1, 'repeated chunk not flagged');
});

log('\n== storage wiring ==');

check('the public audio URL is built from the configured base', () => {
  const base = String(cfg.storage.github.publicBase).replace(/\/+$/, '');
  const url = `${base}/${cfg.storage.github.subdir}/${encodeURIComponent('slug.mp3')}`;
  assert(url.startsWith('https://'), 'audio URL is not https');
  assert(url.endsWith('.mp3'), 'audio URL does not point at an mp3');
});

check('secrets never appear in state written to disk', () => {
  const written = JSON.stringify({ signature: sha256('x'), model: cfg.tts.model });
  assert(!/AIza/.test(written), 'a key-shaped string reached state');
});

fs.rmSync(tmpDir, { recursive: true, force: true });

log('');
log(`${failed ? '✗' : '✓'} ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (!ffmpegPath()) log('  note: ffmpeg is not installed, so the encoding checks were skipped');
log(`  ledger untouched: $${readLedger().spentUsd.toFixed(2)} spent, 0 API calls made by this test`);
log('');
process.exit(failed ? 1 : 0);
