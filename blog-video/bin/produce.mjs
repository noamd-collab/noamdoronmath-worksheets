#!/usr/bin/env node
// HeyGen production, explicit and gated. Default is a dry run that changes nothing.
//
//   node blog-video/bin/produce.mjs plan [--id <postId--variant>]
//   node blog-video/bin/produce.mjs dry-run --id <id> [--contract <file>] [--out <file>]
//   node blog-video/bin/produce.mjs generate --id <id> --confirm
//   node blog-video/bin/produce.mjs status --id <id>
//   node blog-video/bin/produce.mjs compare-subtitles --id <id> --file <subtitles.srt|vtt>
//   node blog-video/bin/produce.mjs record-publish --id <id> --network instagram|facebook|youtubeShorts --url <url> --confirmed-by <name>
//
// generate refuses unless every gate in lib/produce.mjs passes (Noam's approval, sample-video
// approval, his own avatar/voice IDs, quota checked, contract filled from official docs, no
// existing job). There is no publish command: publishing is done by a person, and
// record-publish only records a post that person has verified.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VIDEO_ROOT } from '../lib/source.mjs';
import { MAX_ATTEMPTS, blockers, compareTranscript, fillTemplate, getPath, jobKey } from '../lib/produce.mjs';
import { stripNiqqud } from '../lib/hebrew.mjs';

const args = process.argv.slice(2);
const cmd = args[0] || 'plan';
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const manifestPath = join(VIDEO_ROOT, 'manifest.json');
const logPath = join(VIDEO_ROOT, 'state/production-log.jsonl');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const contractPath = join(VIDEO_ROOT, 'heygen.contract.json');
const contract = existsSync(contractPath) ? JSON.parse(readFileSync(contractPath, 'utf8')) : null;
const log = (e) => appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...e })}\n`);
const save = () => writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const pick = (id) => { const v = manifest.videos.find((x) => x.id === id); if (!v) { console.error(`no video ${id}`); process.exit(2); } return v; };

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { [contract.auth.header]: process.env.HEYGEN_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, json, text: text.slice(0, 500) };
}

if (cmd === 'plan') {
  const list = opt('--id') ? [pick(opt('--id'))] : manifest.videos;
  for (const v of list) {
    const b = blockers(v, manifest, contract);
    console.log(`${v.id}  ${b.length ? 'BLOCKED' : 'READY'}  est ${v.estSeconds.mid}s  job ${jobKey(v, manifest.heygen || {})}`);
    for (const r of b) console.log(`   - ${r}`);
  }
  console.log('\nDry run: nothing was sent and nothing was changed.');
} else if (cmd === 'dry-run') {
  // Shows the exact request that generate would send, from a contract file (the verified one,
  // or --contract <draft>). Missing IDs stay visibly missing. Nothing is sent.
  const v = pick(opt('--id'));
  const c = opt('--contract') ? JSON.parse(readFileSync(opt('--contract'), 'utf8')) : contract;
  if (!c?.create?.body) { console.error('no contract body to render'); process.exit(1); }
  const h = manifest.heygen || {};
  const pointed = readFileSync(join(VIDEO_ROOT, 'packages', v.postId, v.variant, 'narration.he.niqqud.txt'), 'utf8').trim();
  const narration = h.narrationText === 'unpointed' ? stripNiqqud(pointed) : pointed;
  const body = fillTemplate(c.create.body, {
    avatarId: h.avatarId ?? 'MISSING: Noam\'s own avatar look ID',
    voiceId: h.voiceId ?? 'MISSING: Noam\'s own voice ID',
    narration, title: v.id, callbackId: jobKey(v, h), brandGlossaryId: h.brandGlossaryId ?? 'MISSING',
  });
  const out = { dryRun: true, sent: false, contractVerified: c.verifiedFromDocs === true, narrationText: h.narrationText ?? 'niqqud (default for dry run; not decided)', request: { method: c.create.method, url: c.create.url, headers: { [c.auth.header]: '<HEYGEN_API_KEY from environment, never stored>', 'content-type': 'application/json' }, body }, blockers: blockers(v, manifest, c) };
  const outPath = opt('--out');
  if (outPath) writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  else console.log(JSON.stringify(out, null, 2));
} else if (cmd === 'generate') {
  const v = pick(opt('--id'));
  if (!args.includes('--confirm')) { console.error('generate needs --confirm'); process.exit(2); }
  const b = blockers(v, manifest, contract, { needKey: true, env: process.env });
  if (b.length) { console.error(`refused:\n - ${b.join('\n - ')}`); process.exit(1); }
  const key = jobKey(v, manifest.heygen);
  // The spoken text, pointed or not. Captions are never sent: they hold digits and symbols.
  const pointed = readFileSync(join(VIDEO_ROOT, 'packages', v.postId, v.variant, 'narration.he.niqqud.txt'), 'utf8').trim();
  const narration = manifest.heygen.narrationText === 'niqqud' ? pointed : stripNiqqud(pointed);
  const body = fillTemplate(contract.create.body, { avatarId: manifest.heygen.avatarId, voiceId: manifest.heygen.voiceId, narration, title: v.id, callbackId: key, brandGlossaryId: manifest.heygen.brandGlossaryId ?? '' });
  v.production = { ...(v.production || {}), jobKey: key, attempts: (v.production?.jobKey === key ? v.production.attempts || 0 : 0) + 1, status: 'submitting' };
  save();
  let r;
  try { r = await call(contract.create.method, contract.create.url, body); } catch (e) { r = { status: 0, text: String(e.message) }; }
  const jobId = r.json ? getPath(r.json, contract.create.idPath) : undefined;
  if (r.status >= 200 && r.status < 300 && jobId) {
    v.production = { ...v.production, status: 'submitted', jobId, videoId: null, submittedAt: new Date().toISOString() };
    log({ id: v.id, jobKey: key, event: 'submitted', jobId });
    console.log(`submitted ${v.id}: job ${jobId}. Generation is asynchronous; run status later.`);
  } else {
    v.production = { ...v.production, status: 'failed', lastError: `HTTP ${r.status}: ${r.text}` };
    log({ id: v.id, jobKey: key, event: 'failed', httpStatus: r.status });
    console.error(`failed (attempt ${v.production.attempts}/${MAX_ATTEMPTS}): HTTP ${r.status}`);
  }
  save();
} else if (cmd === 'status') {
  const v = pick(opt('--id'));
  if (!v.production?.jobId && !v.production?.videoId) { console.error('no job recorded'); process.exit(1); }
  if (!contract?.verifiedFromDocs || !process.env.HEYGEN_API_KEY) { console.error('contract not verified or HEYGEN_API_KEY not set'); process.exit(1); }
  if (!v.production.videoId && contract.resolve?.url) {
    const s1 = await call(contract.resolve.method, contract.resolve.url.replace('{{jobId}}', encodeURIComponent(v.production.jobId)));
    const vid = s1.json ? getPath(s1.json, contract.resolve.videoIdPath) : undefined;
    if (!vid) { v.production.status = 'processing'; save(); console.log(`${v.id}: job ${v.production.jobId} has no video yet`); process.exit(0); }
    v.production.videoId = vid;
  }
  const r = await call(contract.status.method, contract.status.url.replace('{{videoId}}', encodeURIComponent(v.production.videoId)));
  const st = getPath(r.json, contract.status.statusPath);
  const dur = getPath(r.json, contract.status.durationPath);
  if ((contract.status.doneValues || []).includes(st)) v.production.status = 'rendered';
  else if ((contract.status.failedValues || []).includes(st)) v.production.status = 'render-failed';
  else v.production.status = 'processing';
  if (Number.isFinite(Number(dur)) && dur !== null) v.measuredSeconds = Number(dur);
  for (const k of ['videoUrl', 'captionedVideoUrl', 'subtitleUrl']) {
    const val = getPath(r.json, contract.status[`${k}Path`]);
    if (val) v.production[k] = val;
  }
  log({ id: v.id, event: 'status', status: v.production.status, rawStatus: st ?? null, measuredSeconds: v.measuredSeconds ?? null });
  save();
  console.log(`${v.id}: ${v.production.status} (${st ?? 'no status field'})${v.measuredSeconds ? `, ${v.measuredSeconds}s measured` : ''}`);
} else if (cmd === 'compare-subtitles') {
  // Checks that what was spoken is the reviewed script: compares a downloaded subtitle
  // file (SRT/VTT, e.g. from subtitle_url) with the script's unpointed spoken text.
  const v = pick(opt('--id'));
  const file = opt('--file');
  if (!file) { console.error('need --file <downloaded subtitles>'); process.exit(2); }
  const spoken = stripNiqqud(readFileSync(join(VIDEO_ROOT, 'packages', v.postId, v.variant, 'narration.he.niqqud.txt'), 'utf8'));
  const res = compareTranscript(spoken, readFileSync(file, 'utf8'));
  console.log(`${v.id}: ${(res.ratio * 100).toFixed(1)}% of script words matched in order; ${res.missing.length} missing, ${res.extra.length} extra`);
  if (res.missing.length) console.log(`missing: ${res.missing.slice(0, 40).join(' ')}`);
  if (res.extra.length) console.log(`extra: ${res.extra.slice(0, 40).join(' ')}`);
  v.production.subtitleCheck = { ratio: +res.ratio.toFixed(3), missing: res.missing.length, extra: res.extra.length, at: new Date().toISOString() };
  log({ id: v.id, event: 'subtitle-check', ...v.production.subtitleCheck });
  save();
  console.log('Digits in subtitles where the script has number words count as differences; read the list before deciding.');
} else if (cmd === 'record-publish') {
  const v = pick(opt('--id'));
  const net = opt('--network');
  const url = opt('--url');
  const by = opt('--confirmed-by');
  if (!['instagram', 'facebook', 'youtubeShorts'].includes(net) || !/^https:\/\//.test(url || '') || !by) { console.error('need --network, an https --url of the live post, and --confirmed-by'); process.exit(2); }
  if (v.production?.status !== 'rendered') { console.error('video is not rendered; nothing to record'); process.exit(1); }
  if (v.publish[net]?.status === 'published') { console.error(`already recorded as published on ${net}: ${v.publish[net].url}`); process.exit(1); }
  v.publish[net] = { status: 'published', url, confirmedBy: by, at: new Date().toISOString() };
  log({ id: v.id, event: 'publish-recorded', network: net, url, confirmedBy: by });
  save();
  console.log(`recorded ${v.id} on ${net}`);
} else {
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}
