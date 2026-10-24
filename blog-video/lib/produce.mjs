// Production gates and request building for HeyGen. Pure functions; I/O is in bin/produce.mjs.
//
// No endpoint, header or field name is hard-coded here. They come from heygen.contract.json,
// which a person fills in from HeyGen's official, current documentation and marks
// verifiedFromDocs: true. Until then every generate call is refused.
import { sha256 } from './source.mjs';

export const MAX_ATTEMPTS = 2;

export function jobKey(video, heygen) {
  return sha256([video.id, video.scriptHash, video.narrationHash, heygen.avatarId ?? '', heygen.voiceId ?? '', heygen.narrationText ?? ''].join('|')).slice(0, 16);
}

/** Reasons a video may not be generated now. Empty list = allowed. */
export function blockers(video, manifest, contract, { needKey = false, env = {} } = {}) {
  const b = [];
  const h = manifest.heygen || {};
  if (video.qa?.errors) b.push(`QA has ${video.qa.errors} error(s)`);
  if (video.review !== 'current') b.push(`script review is not current (${video.review})`);
  if (video.contentStatus !== 'noam-approved') b.push(`content not approved by Noam (status: ${video.contentStatus})`);
  const pilot = manifest.pilot || {};
  const inPilot = (pilot.videos || []).includes(video.id);
  if (!pilot.sampleVideoApproved) {
    if (!inPilot) b.push('series is on hold until Noam approves a sample video; this video is not in pilot.videos');
  } else if (manifest.format?.decision !== video.variant) b.push(`format decision is "${manifest.format?.decision ?? 'none'}", not "${video.variant}"`);
  if (!h.avatarId || h.avatarOwnerConfirmed !== true) b.push('Noam\'s own avatar ID is missing or not confirmed as his (heygen.avatarId + avatarOwnerConfirmed)');
  if (!h.voiceId || h.voiceOwnerConfirmed !== true) b.push('Noam\'s own voice ID is missing or not confirmed as his (heygen.voiceId + voiceOwnerConfirmed)');
  if (!['niqqud', 'unpointed'].includes(h.narrationText)) b.push('heygen.narrationText not chosen ("niqqud" or "unpointed"); decide after a listening test');
  if (h.quotaChecked !== true) b.push('HeyGen quota/cost not checked (heygen.quotaChecked)');
  if (!contract || contract.verifiedFromDocs !== true) b.push('heygen.contract.json is not filled from official docs (verifiedFromDocs !== true)');
  const p = video.production || {};
  const key = jobKey(video, h);
  if (p.videoId && p.jobKey === key) b.push(`already generated for this exact script/voice/avatar (videoId ${p.videoId})`);
  if (['submitted', 'processing'].includes(p.status) && p.jobKey === key) b.push(`a job is already ${p.status}`);
  if ((p.attempts || 0) >= MAX_ATTEMPTS && p.jobKey === key) b.push(`attempt limit reached (${MAX_ATTEMPTS}) for this job`);
  if (needKey && !env.HEYGEN_API_KEY) b.push('HEYGEN_API_KEY is not set in the environment');
  return b;
}

/** Fills {{placeholders}} in a JSON template; values are inserted as JSON strings/numbers. */
export function fillTemplate(template, values) {
  const walk = (v) => {
    if (typeof v === 'string') {
      const whole = v.match(/^\{\{(\w+)\}\}$/);
      if (whole) { if (!(whole[1] in values)) throw new Error(`no value for {{${whole[1]}}}`); return values[whole[1]]; }
      return v.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in values)) throw new Error(`no value for {{${k}}}`); return String(values[k]); });
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(template);
}

export const getPath = (obj, path) => (path || '').split('.').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Word-level comparison of spoken script and subtitles (order-aware, LCS). */
export function compareTranscript(script, subtitles) {
  const norm = (t) => t
    .replace(/^\d+\s*$/gm, ' ')
    .replace(/^\s*[\d:.,]+\s*-->.*$/gm, ' ')
    .replace(/^WEBVTT.*$/gm, ' ')
    .replace(/[\u0591-\u05C7\u2066-\u2069]/g, (c) => (c === '\u05BE' ? ' ' : ''))
    .replace(/[^\u05D0-\u05EA\d\s]/g, ' ')
    .split(/\s+/).filter(Boolean);
  const a = norm(script), b = norm(subtitles);
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const missing = [], extra = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) missing.push(a[i++]); else extra.push(b[j++]);
  }
  missing.push(...a.slice(i)); extra.push(...b.slice(j));
  return { ratio: a.length ? dp[0][0] / a.length : 0, missing, extra };
}
