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
export async function speakChunk({ text, model, voice, language, styleInstruction, timeoutMs }) {
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
  const code = Number(err?.status || err?.code || (s.match(/\b(4\d\d|5\d\d)\b/) || [])[1]);
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(code)) return true;
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test(s);
}
