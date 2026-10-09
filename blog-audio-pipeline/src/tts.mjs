// Gemini API text-to-speech, via the official @google/genai SDK Interactions API.
// Request shape follows https://ai.google.dev/gemini-api/docs/speech-generation
// (Interactions: model / input / response_format / generation_config.speech_config).
// No other Gemini surface is mixed into this module; the ASR verification pass
// lives in src/asr.mjs and uses its own documented shape.

import { GoogleGenAI } from '@google/genai';
import { getSecret, redact } from './secret.mjs';

let client = null;
function ai() {
  if (!client) client = new GoogleGenAI({ apiKey: getSecret('GEMINI_API_KEY') });
  return client;
}

export const TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-pro-preview-tts',
  'gemini-2.5-flash-preview-tts',
];

export async function listAvailableModels() {
  const out = [];
  const pager = await ai().models.list();
  for await (const m of pager) {
    out.push({
      name: String(m.name || '').replace(/^models\//, ''),
      displayName: m.displayName,
      actions: m.supportedActions || m.supportedGenerationMethods || [],
    });
  }
  return out;
}

function modalityTokens(list, modality) {
  if (!Array.isArray(list)) return 0;
  const hit = list.find((x) => String(x.modality || '').toUpperCase() === modality);
  return Number(hit?.token_count ?? hit?.tokenCount ?? 0) || 0;
}

/**
 * Speaks one chunk. Returns raw PCM plus the real token usage reported by the API.
 * @returns {Promise<{pcm: Buffer, sampleRate: number, channels: number, mimeType: string,
 *                    usage: {inputTextTokens:number, outputAudioTokens:number, totalInput:number, totalOutput:number}}>}
 */
export async function speakChunk(opts) {
  if (opts.provider === 'elevenlabs') return speakChunkEleven(opts);
  return speakChunkGemini(opts);
}

const ELEVEN_BASE = 'https://api.elevenlabs.io';

/**
 * ElevenLabs Text to Speech (POST /v1/text-to-speech/{voice_id}), raw PCM out.
 * https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 * eleven_v4 is a Text to Speech model (same endpoint, same output_format query).
 * The models page lists Hebrew as heb; language_code is sent as configured.
 * The convert schema still calls the similarity control similarity_boost.
 *  - auth: xi-api-key header, key from ELEVENLABS_API_KEY (never logged);
 *  - output_format=pcm_24000 returns headerless signed 16-bit mono PCM at 24 kHz,
 *    the same format the rest of the pipeline already stitches and encodes;
 *  - the response header `character-cost` carries the credits actually used.
 * There is no style instruction: the model reads exactly the text it is given.
 * The abort timer covers the response body as well as the headers.
 */
async function speakChunkEleven({ text, model, voice, language, elevenlabs = {}, timeoutMs }) {
  if (!text || !text.trim()) throw new Error('empty chunk');
  const key = getSecret('ELEVENLABS_API_KEY');
  const format = elevenlabs.outputFormat || 'pcm_24000';
  const body = {
    text,
    model_id: model,
    voice_settings: {
      stability: elevenlabs.stability ?? 0.5,
      similarity_boost: elevenlabs.similarityBoost ?? 0.8,
    },
  };
  if (language) body.language_code = language;

  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const timedOut = (e) => controller.signal.aborted || e?.name === 'AbortError';
  try {
    let res;
    try {
      res = await fetch(`${ELEVEN_BASE}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${encodeURIComponent(format)}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'application/octet-stream' },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'error',
      });
    } catch (e) {
      if (timedOut(e)) throw new Error(`tts request timed out after ${timeoutMs}ms`);
      throw new Error(redact(`fetch failed: ${e.message}`));
    }

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 300); } catch (e) {
        if (timedOut(e)) throw new Error(`tts request timed out after ${timeoutMs}ms`);
      }
      const err = new Error(redact(`ElevenLabs HTTP ${res.status}: ${detail}`));
      err.status = res.status;
      throw err;
    }

    let pcm;
    try {
      pcm = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (timedOut(e)) throw new Error(`tts request timed out after ${timeoutMs}ms`);
      throw new Error(redact(`fetch failed: ${e.message}`));
    }
    if (!pcm.length || pcm.length % 2) throw new Error(`ElevenLabs returned ${pcm.length} bytes, not whole 16-bit samples`);
    const credits = Number(res.headers.get('character-cost'));
    return {
      pcm,
      sampleRate: 24000,
      channels: 1,
      mimeType: `audio/${format}`,
      usage: {
        inputTextTokens: 0,
        outputAudioTokens: 0,
        totalInput: 0,
        totalOutput: 0,
        characters: Number.isFinite(credits) && credits > 0 ? credits : text.length,
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function speakChunkGemini({ text, model, voice, language, styleInstruction, timeoutMs }) {
  if (!text || !text.trim()) throw new Error('empty chunk');

  // The style instruction is prepended, never mixed into the article text, and it
  // explicitly tells the model not to read it out.
  const input = `${styleInstruction}\n\n${text}`;

  const speech = { voice };
  if (language) speech.language = language;

  const req = {
    model,
    input,
    response_format: { type: 'audio' },
    generation_config: { speech_config: [speech] },
  };

  const interaction = await withTimeout(ai().interactions.create(req), timeoutMs, 'tts request');

  const audio = interaction?.output_audio;
  const b64 = audio?.data;
  if (!b64) {
    const status = interaction?.status || 'unknown';
    const errs = JSON.stringify(interaction?.errors || []).slice(0, 400);
    throw new Error(redact(`no audio returned (status=${status}) ${errs}`));
  }

  const usage = interaction?.usage || {};
  return {
    pcm: Buffer.from(b64, 'base64'),
    sampleRate: Number(audio.sample_rate || 24000),
    channels: Number(audio.channels || 1),
    mimeType: String(audio.mime_type || 'audio/pcm'),
    usage: {
      inputTextTokens: modalityTokens(usage.input_tokens_by_modality, 'TEXT') || Number(usage.total_input_tokens || 0),
      outputAudioTokens: modalityTokens(usage.output_tokens_by_modality, 'AUDIO') || Number(usage.total_output_tokens || 0),
      totalInput: Number(usage.total_input_tokens || 0),
      totalOutput: Number(usage.total_output_tokens || 0),
    },
  };
}

function withTimeout(promise, ms, label) {
  if (!ms) return promise;
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms); }),
  ]);
}

// Errors worth retrying: rate limits, transient server faults, network resets.
export function isRetryable(err) {
  const s = String(err?.message || err);
  if (/timed out/i.test(s)) return true;
  // ElevenLabs: 429 is also "too many concurrent requests"; 401/402/403/422 are not transient.
  const code = Number(err?.status || err?.code || (s.match(/\b(4\d\d|5\d\d)\b/) || [])[1]);
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(code)) return true;
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test(s);
}
