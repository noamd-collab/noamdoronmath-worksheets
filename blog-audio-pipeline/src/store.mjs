// Job state, deduplication, locking and the spend ledger.
//
// Identity of an audio version = sha256 over the post id, the exact narration
// script, the model, the voice, the language, the style instruction and the audio
// format. Any change to any of those produces a new signature and therefore a new
// render; nothing else does. A completed signature is never rendered twice.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { p, ensureDir } from './paths.mjs';

const STATE_DIR = () => ensureDir(p('state'));
const WORK_DIR = () => ensureDir(p('work'));
const LEDGER = () => p('state', 'ledger.json');

export function sha256(x) {
  return crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
}

export function audioSignature({ postId, script, cfg }) {
  return sha256({
    v: 1,
    postId,
    script,
    model: cfg.tts.model,
    voice: cfg.tts.voice,
    language: cfg.tts.language ?? null,
    style: cfg.tts.styleInstruction,
    chunkTargetChars: cfg.tts.chunkTargetChars,
    chunkMaxChars: cfg.tts.chunkMaxChars,
    silenceMs: cfg.tts.interChunkSilenceMs,
    audio: cfg.audio,
  });
}

const safe = (s) => String(s).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);

export function statePath(postId) {
  return path.join(STATE_DIR(), `${safe(postId)}.json`);
}

export function readState(postId) {
  const f = statePath(postId);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

export function writeState(postId, state) {
  const f = statePath(postId);
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1));
  fs.renameSync(tmp, f);
  return state;
}

export function listStates() {
  return fs.readdirSync(STATE_DIR())
    .filter((f) => f.endsWith('.json') && f !== 'ledger.json')
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(STATE_DIR(), f), 'utf8')); } catch { return null; }
    })
    .filter(Boolean);
}

// ---- chunk cache: resume after a crash without re-paying for finished chunks ----

export function chunkDir(signature) {
  return ensureDir(path.join(WORK_DIR(), signature));
}

export function chunkFile(signature, index, chunkText) {
  const id = sha256(`${signature}:${index}:${chunkText}`).slice(0, 16);
  return path.join(chunkDir(signature), `${String(index).padStart(3, '0')}-${id}.pcm`);
}

export function readChunk(signature, index, chunkText) {
  const f = chunkFile(signature, index, chunkText);
  if (!fs.existsSync(f) || fs.statSync(f).size === 0) return null;
  return fs.readFileSync(f);
}

export function writeChunk(signature, index, chunkText, pcm) {
  const f = chunkFile(signature, index, chunkText);
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, pcm);
  fs.renameSync(tmp, f);
  return f;
}

export function clearWork(signature) {
  const d = path.join(WORK_DIR(), signature);
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
}

// ---- locking: one worker per post, stale locks reclaimed ----

export function acquireLock(postId, staleMinutes = 30) {
  const f = path.join(STATE_DIR(), `${safe(postId)}.lock`);
  const payload = JSON.stringify({ pid: process.pid, host: process.env.HOST || '', at: new Date().toISOString() });
  try {
    fs.writeFileSync(f, payload, { flag: 'wx' });
    return { file: f, release: () => { try { fs.unlinkSync(f); } catch {} } };
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const ageMin = (Date.now() - fs.statSync(f).mtimeMs) / 60000;
    let alive = false;
    try {
      const owner = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (owner.pid) { try { process.kill(owner.pid, 0); alive = true; } catch { alive = false; } }
    } catch {}
    if (alive || ageMin < staleMinutes) return null;
    fs.unlinkSync(f);
    return acquireLock(postId, staleMinutes);
  }
}

// ---- spend ledger and kill switch ----

export function readLedger() {
  const f = LEDGER();
  if (!fs.existsSync(f)) return { spentUsd: 0, calls: 0, retries: 0, byModel: {}, updated: null };
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { spentUsd: 0, calls: 0, retries: 0, byModel: {}, updated: null }; }
}

export function addSpend({ model, inputTextTokens = 0, outputAudioTokens = 0, usd, retry = false }) {
  const l = readLedger();
  l.spentUsd = Number(((l.spentUsd || 0) + usd).toFixed(6));
  l.calls = (l.calls || 0) + 1;
  if (retry) l.retries = (l.retries || 0) + 1;
  const m = (l.byModel[model] = l.byModel[model] || { calls: 0, inputTextTokens: 0, outputAudioTokens: 0, usd: 0 });
  m.calls += 1;
  m.inputTextTokens += inputTextTokens;
  m.outputAudioTokens += outputAudioTokens;
  m.usd = Number((m.usd + usd).toFixed(6));
  l.updated = new Date().toISOString();
  const tmp = `${LEDGER()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(l, null, 1));
  fs.renameSync(tmp, LEDGER());
  return l;
}

export function killSwitchEngaged(cfg) {
  return fs.existsSync(p(cfg.limits.killSwitchFile));
}

export function assertCanSpend(cfg, aboutToSpendUsd = 0) {
  if (killSwitchEngaged(cfg)) {
    throw new Error(`kill switch engaged (file ${cfg.limits.killSwitchFile} exists) - remove it to resume`);
  }
  const l = readLedger();
  const projected = (l.spentUsd || 0) + aboutToSpendUsd;
  if (projected > cfg.limits.spendLimitUsd) {
    throw new Error(
      `spend limit reached: ledger $${(l.spentUsd || 0).toFixed(2)} + $${aboutToSpendUsd.toFixed(2)} > limit $${cfg.limits.spendLimitUsd.toFixed(2)}. ` +
      `Raise limits.spendLimitUsd in config.json to continue.`
    );
  }
  return l;
}
