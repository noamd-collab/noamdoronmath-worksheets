// ElevenLabs narration path, with the network mocked: request shape, PCM in/out,
// credits from the response header, error handling, secrecy, cost and estimates.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import fs from 'node:fs';
import { readConfig, ensureDir, p } from '../src/paths.mjs';
import { speakChunk, isRetryable } from '../src/tts.mjs';
import { actualCostUsd, estimateForChars } from '../src/cost.mjs';
import { redact } from '../src/secret.mjs';
import { audioSignature, addSpend } from '../src/store.mjs';

const KEY = 'sk_' + '0123456789abcdef'.repeat(3);
const cfg = readConfig();
const realFetch = globalThis.fetch;
let calls;

const pcm = (samples) => Buffer.alloc(samples * 2, 1);
const reply = (status, body, headers = {}) => new Response(body, { status, headers });
const run = (over = {}) => speakChunk({
  text: 'שלום עולם', provider: cfg.tts.provider, elevenlabs: cfg.tts.elevenlabs, model: cfg.tts.model,
  voice: cfg.tts.voice, language: cfg.tts.language, timeoutMs: 2000, ...over,
});

beforeEach(() => { calls = []; process.env.ELEVENLABS_API_KEY = KEY; });
afterEach(() => { globalThis.fetch = realFetch; });

describe('config', () => {
  it('selects ElevenLabs with a Hebrew-capable model and a priced entry', () => {
    assert.equal(cfg.tts.provider, 'elevenlabs');
    assert.equal(cfg.tts.model, 'eleven_v4');
    assert.equal(cfg.tts.language, 'heb');
    assert.ok(cfg.pricing[cfg.tts.model].usdPer1kChars > 0);
    assert.equal(cfg.audio.pcmSampleRate, 24000);
    assert.equal(cfg.tts.elevenlabs.outputFormat, 'pcm_24000');
    assert.ok(cfg.tts.chunkMaxChars <= 10000, 'under the 10,000-character eleven_v4 request limit');
  });
});

describe('speakChunk (ElevenLabs)', () => {
  it('posts to the voice endpoint with pcm_24000, key header and Hebrew settings; returns the PCM', async () => {
    globalThis.fetch = async (url, init) => { calls.push({ url, init }); return reply(200, pcm(24000), { 'character-cost': '9' }); };
    const r = await run();
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, `https://api.elevenlabs.io/v1/text-to-speech/${cfg.tts.voice}?output_format=pcm_24000`);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['xi-api-key'], KEY);
    const body = JSON.parse(init.body);
    assert.equal(body.text, 'שלום עולם');
    assert.equal(body.model_id, 'eleven_v4');
    assert.equal(body.language_code, 'heb');
    assert.deepEqual(body.voice_settings, { stability: 0.5, similarity_boost: 0.8 });
    assert.ok(!('style' in body) && !JSON.stringify(body).includes('הקרא את הטקסט'), 'no style instruction is sent');
    assert.equal(r.pcm.length, 48000);
    assert.equal(r.sampleRate, 24000);
    assert.equal(r.channels, 1);
    assert.equal(r.usage.characters, 9);
  });

  it('falls back to the text length when the credit header is missing', async () => {
    globalThis.fetch = async () => reply(200, pcm(100));
    assert.equal((await run({ text: 'abcde' })).usage.characters, 5);
  });

  it('rejects empty text and truncated audio', async () => {
    globalThis.fetch = async () => reply(200, pcm(10));
    await assert.rejects(() => run({ text: '  ' }), /empty chunk/);
    globalThis.fetch = async () => reply(200, Buffer.alloc(7));
    await assert.rejects(() => run(), /whole 16-bit samples/);
  });

  it('retries rate limits and server faults, never auth, quota or validation errors', async () => {
    for (const [status, retry] of [[429, true], [500, true], [503, true], [401, false], [402, false], [403, false], [422, false]]) {
      globalThis.fetch = async () => reply(status, JSON.stringify({ detail: { message: 'nope' } }));
      const err = await run().catch((e) => e);
      assert.equal(err.status, status);
      assert.equal(isRetryable(err), retry, String(status));
    }
  });

  it('never puts the key in an error, even if the server echoes it', async () => {
    globalThis.fetch = async () => reply(401, `invalid key ${KEY} xi-api-key: ${KEY}`);
    const err = await run().catch((e) => e);
    assert.ok(!err.message.includes(KEY), err.message);
    assert.ok(!redact(`x ${KEY}`).includes(KEY));
  });

  it('times out as a retryable error', async () => {
    globalThis.fetch = (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    const err = await run({ timeoutMs: 20 }).catch((e) => e);
    assert.match(err.message, /timed out/);
    assert.ok(isRetryable(err));
  });

  it('keeps the timeout through the body read and treats that abort as retryable', async () => {
    globalThis.fetch = (url, init) => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get() { return null; } },
      arrayBuffer() {
        return new Promise((_, rej) => {
          const fail = () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          if (init.signal.aborted) fail();
          else init.signal.addEventListener('abort', fail, { once: true });
        });
      },
    });
    const err = await run({ timeoutMs: 30 }).catch((e) => e);
    assert.match(err.message, /timed out/);
    assert.ok(isRetryable(err));
    assert.equal(err.status, undefined);
  });

  it('fails clearly without a key and sends nothing', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    globalThis.fetch = async () => { calls.push(1); return reply(200, pcm(1)); };
    await assert.rejects(() => run(), /ELEVENLABS_API_KEY/);
    assert.equal(calls.length, 0);
  });
});

describe('cost and ledger', () => {
  it('prices by credits and estimates by characters', () => {
    const usd = actualCostUsd(cfg, cfg.tts.model, { characters: 1000 });
    assert.equal(usd, cfg.pricing[cfg.tts.model].usdPer1kChars);
    const est = estimateForChars(cfg, 6000, { chunks: 4 });
    assert.equal(est.estCredits, 6000);
    assert.equal(est.estUsd, Number((6 * cfg.pricing[cfg.tts.model].usdPer1kChars).toFixed(4)));
    assert.ok(est.estSeconds > 0);
  });

  it('Gemini pricing still works for the optional provider', () => {
    const usd = actualCostUsd(cfg, 'gemini-3.1-flash-tts-preview', { inputTextTokens: 1e6, outputAudioTokens: 1e6 });
    assert.equal(usd, 21);
  });

  it('signature changes with provider, model and voice so old chunks are never reused', () => {
    const base = audioSignature({ postId: 'p', script: 's', cfg });
    const gem = structuredClone(cfg); gem.tts.provider = 'gemini-api';
    const voice = structuredClone(cfg); voice.tts.voice = 'other';
    assert.notEqual(base, audioSignature({ postId: 'p', script: 's', cfg: gem }));
    assert.notEqual(base, audioSignature({ postId: 'p', script: 's', cfg: voice }));
    assert.equal(base, audioSignature({ postId: 'p', script: 's', cfg }));
  });

  it('addSpend records characters per model', () => {
    ensureDir(p('state'));
    const f = p('state', 'ledger.json');
    const had = fs.existsSync(f) ? fs.readFileSync(f) : null;
    try {
      const l = addSpend({ model: 'eleven_v3-test', characters: 120, usd: 0.036 });
      assert.equal(l.byModel['eleven_v3-test'].characters, 120);
    } finally {
      if (had) fs.writeFileSync(f, had); else fs.rmSync(f, { force: true });
    }
  });
});
