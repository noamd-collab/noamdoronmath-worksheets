// PCM -> MP3. Gemini TTS returns headerless signed 16-bit little-endian PCM at
// 24 kHz mono; chunks are concatenated as PCM (with a short silence between them)
// and the joined stream is encoded once, so no MP3 frames are ever spliced.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

export function ffmpegPath() {
  for (const c of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']) {
    if (fs.existsSync(c)) return c;
  }
  try {
    return execFileSync('/usr/bin/which', ['ffmpeg'], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

export function requireFfmpeg() {
  const bin = ffmpegPath();
  if (!bin) {
    throw new Error('ffmpeg not found. Install it once with:  brew install ffmpeg');
  }
  return bin;
}

export function silencePcm(ms, { sampleRate, channels, bytesPerSample }) {
  const frames = Math.round((sampleRate * ms) / 1000);
  return Buffer.alloc(frames * channels * bytesPerSample, 0);
}

export function pcmDurationSec(byteLength, { sampleRate, channels, bytesPerSample }) {
  return byteLength / (sampleRate * channels * bytesPerSample);
}

export function encodePcmToMp3(pcmBuffer, outPath, audioCfg) {
  const bin = requireFfmpeg();
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', `s${audioCfg.pcmBytesPerSample * 8}le`,
    '-ar', String(audioCfg.pcmSampleRate),
    '-ac', String(audioCfg.pcmChannels),
    '-i', 'pipe:0',
    '-ar', String(audioCfg.mp3SampleRate),
    '-ac', String(audioCfg.mp3Channels),
    '-c:a', 'libmp3lame',
    '-b:a', audioCfg.mp3Bitrate,
    '-write_xing', '1',
    outPath,
  ];
  const res = spawnSync(bin, args, { input: pcmBuffer, maxBuffer: 1024 * 1024 * 512 });
  if (res.status !== 0) {
    throw new Error(`ffmpeg failed (${res.status}): ${String(res.stderr || '').slice(0, 500)}`);
  }
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1024) {
    throw new Error(`ffmpeg produced no usable file at ${outPath}`);
  }
  return outPath;
}

// Reads back the finished MP3 and reports what it actually is, so the pipeline
// never trusts its own intent about format or length.
export function probeMp3(file) {
  const bin = ffmpegPath();
  if (bin) {
    const probe = bin.replace(/ffmpeg$/, 'ffprobe');
    if (fs.existsSync(probe)) {
      const r = spawnSync(probe, [
        '-v', 'error', '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate:format=duration,size',
        '-of', 'json', file,
      ], { encoding: 'utf8' });
      if (r.status === 0) {
        const j = JSON.parse(r.stdout);
        const st = j.streams?.[0] || {};
        return {
          via: 'ffprobe',
          codec: st.codec_name,
          sampleRate: Number(st.sample_rate) || null,
          channels: Number(st.channels) || null,
          bitrate: Number(st.bit_rate) || null,
          durationSec: Number(j.format?.duration) || null,
          bytes: Number(j.format?.size) || fs.statSync(file).size,
        };
      }
    }
  }
  // macOS fallback: afinfo is always present.
  const r = spawnSync('/usr/bin/afinfo', [file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('cannot probe MP3: install ffmpeg or use macOS afinfo');
  const out = r.stdout;
  const num = (re) => { const m = out.match(re); return m ? Number(m[1]) : null; };
  return {
    via: 'afinfo',
    codec: /\.mp3/.test(out) ? 'mp3' : null,
    sampleRate: num(/([\d.]+)\s*Hz/),
    channels: num(/(\d+)\s*ch/),
    bitrate: num(/bit rate:\s*(\d+)\s*bits per second/),
    durationSec: num(/estimated duration:\s*([\d.]+)\s*sec/),
    bytes: fs.statSync(file).size,
  };
}
