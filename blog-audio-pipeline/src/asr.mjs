// Verification-only speech recognition. This is a separate Gemini surface from the
// TTS module on purpose: it uses the documented generateContent shape with inline
// audio, and it is never used to produce site audio.

import { GoogleGenAI } from '@google/genai';
import { getSecret } from './secret.mjs';
import fs from 'node:fs';

let client = null;
function ai() {
  if (!client) client = new GoogleGenAI({ apiKey: getSecret('GEMINI_API_KEY') });
  return client;
}

export async function transcribeMp3(filePath, { model = 'gemini-2.5-flash' } = {}) {
  const data = fs.readFileSync(filePath).toString('base64');
  const res = await ai().models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { text: 'תמלל את קובץ השמע במלואו לעברית, מילה במילה, בלי לסכם, בלי להוסיף הערות ובלי חתימות זמן. החזר טקסט בלבד.' },
        { inlineData: { mimeType: 'audio/mp3', data } },
      ],
    }],
    config: { temperature: 0 },
  });
  return {
    text: res.text || '',
    usage: {
      inputTokens: Number(res.usageMetadata?.promptTokenCount || 0),
      outputTokens: Number(res.usageMetadata?.candidatesTokenCount || 0),
    },
  };
}

const strip = (s) => String(s || '')
  .replace(/[֑-ׇ]/g, '')
  .replace(/[.,;:!?"'׳״()\[\]{}\-–—…]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const words = (s) => strip(s).split(' ').filter(Boolean);

// Longest-common-subsequence coverage: what share of the script's words appear in
// the transcript, in order. Catches skipped passages and truncation; the extra
// ratio catches inserted or repeated speech.
export function compareCoverage(scriptText, transcriptText) {
  const a = words(scriptText);
  const b = words(transcriptText);
  const lcs = lcsLength(a, b);
  const coverage = a.length ? lcs / a.length : 0;
  const extraRatio = b.length ? (b.length - lcs) / b.length : 0;
  return {
    scriptWords: a.length,
    transcriptWords: b.length,
    matchedWords: lcs,
    coverage: Number(coverage.toFixed(4)),
    extraRatio: Number(extraRatio.toFixed(4)),
    missingRuns: missingRuns(a, b),
  };
}

function lcsLength(a, b) {
  // Hirschberg-style rolling rows; the texts here are a few thousand words.
  let prev = new Uint32Array(b.length + 1);
  let cur = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return prev[b.length];
}

// Reports the longest stretches of script words that never show up in the transcript.
function missingRuns(a, b) {
  const present = new Set(b);
  const runs = [];
  let run = [];
  for (const w of a) {
    if (present.has(w)) {
      if (run.length >= 6) runs.push(run.join(' '));
      run = [];
    } else {
      run.push(w);
    }
  }
  if (run.length >= 6) runs.push(run.join(' '));
  return runs.sort((x, y) => y.length - x.length).slice(0, 5);
}

// Did the model read the style instruction out loud?
export function styleLeak(styleInstruction, transcriptText) {
  const s = words(styleInstruction);
  const t = strip(transcriptText);
  const probes = [s.slice(0, 6).join(' '), s.slice(2, 8).join(' '), 'הוראות הסגנון', 'הקרא את הטקסט במלואו'];
  const hits = probes.filter((probe) => probe && t.includes(strip(probe)));
  return { leaked: hits.length > 0, hits };
}

// Identical PCM for two different chunks means the same audio was emitted twice.
export function duplicateChunks(hashes) {
  const seen = new Map();
  const dups = [];
  hashes.forEach((h, i) => {
    if (seen.has(h)) dups.push([seen.get(h), i]);
    else seen.set(h, i);
  });
  return dups;
}
