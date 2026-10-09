#!/usr/bin/env node
// One short Hebrew sentence through the real ElevenLabs path, written to a local
// MP3. Spends about 60 credits and publishes nothing. Use it to hear the voice
// and confirm the key, model and output format work before the pipeline renders.
//
//   node bin/eleven-sample.mjs [--text="..."] [--out=sample.mp3]
//
// Needs ELEVENLABS_API_KEY (Keychain item or environment variable) and ffmpeg.

import fs from 'node:fs';
import path from 'node:path';
import { readConfig } from '../src/paths.mjs';
import { speakChunk } from '../src/tts.mjs';
import { encodePcmToMp3, pcmDurationSec, requireFfmpeg } from '../src/mp3.mjs';
import { parseArgs, log, fail } from '../src/cli.mjs';

const args = parseArgs();
const cfg = readConfig();
if (cfg.tts.provider !== 'elevenlabs') fail('config.tts.provider is not "elevenlabs"');
requireFfmpeg();

const text = String(args.text || 'שלום! זו בדיקת הקראה בעברית. המשוואה שתיים איקס ועוד שלוש שווה אחת עשרה, ולכן איקס שווה ארבע.');
const res = await speakChunk({
  text,
  provider: cfg.tts.provider,
  elevenlabs: cfg.tts.elevenlabs,
  model: cfg.tts.model,
  voice: cfg.tts.voice,
  language: cfg.tts.language,
  timeoutMs: cfg.limits.requestTimeoutMs,
});
const secs = pcmDurationSec(res.pcm.length, { sampleRate: 24000, channels: 1, bytesPerSample: 2 });
const out = path.resolve(String(args.out || 'eleven-sample.mp3'));
encodePcmToMp3(res.pcm, out, cfg.audio);
log(`\n${cfg.tts.model} / voice ${cfg.tts.voice}: ${secs.toFixed(1)}s, ${res.usage.characters} credits -> ${out}\n`);
