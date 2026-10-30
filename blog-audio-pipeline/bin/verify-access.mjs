#!/usr/bin/env node
// Checks every access this pipeline needs, without generating any audio and
// without ever printing the key. Run this first, and after any key rotation.

import { readConfig } from '../src/paths.mjs';
import { getSecret } from '../src/secret.mjs';
import { listAvailableModels } from '../src/tts.mjs';
import { ffmpegPath } from '../src/mp3.mjs';
import { parseArgs, log } from '../src/cli.mjs';

const args = parseArgs();
const cfg = readConfig();
let problems = 0;
const ok = (m) => log(`  ✓ ${m}`);
const bad = (m) => { problems++; log(`  ✗ ${m}`); };

function presentSecret(name, options) {
  try {
    const value = getSecret(name, options);
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

log('\n== 1. Secrets ==');
const key = presentSecret('GEMINI_API_KEY');
const token = presentSecret('NOAM_AUDIO_WORKER_TOKEN', { required: false });
// Absent secrets must not fail the scheduled job and must not reach a paid call.
// A present but wrong key still runs the checks below and still exits 1.
if (!key || !token) {
  log('blog-audio: secrets not configured, skipping');
  process.exit(0);
}
ok(`GEMINI_API_KEY found (length ${key.length}, value not shown)`);
ok('NOAM_AUDIO_WORKER_TOKEN found (value not shown)');

log('\n== 2. Local tooling ==');
const ff = ffmpegPath();
ff ? ok(`ffmpeg at ${ff}`) : bad('ffmpeg missing - run:  brew install ffmpeg');

log('\n== 3. Gemini account: which API and which models ==');
if (key) {
  try {
    const models = await listAvailableModels();
    ok(`Gemini API (generativelanguage.googleapis.com) answered: ${models.length} models visible for this key`);
    const wanted = [cfg.tts.model, ...cfg.tts.modelAlternatives, cfg.verify.asrModel];
    for (const w of wanted) {
      const hit = models.find((m) => m.name === w);
      hit ? ok(`${w} available`) : bad(`${w} NOT available to this key`);
    }
    const tts = models.filter((m) => /tts/i.test(m.name)).map((m) => m.name);
    log(`     all TTS-capable models on this key: ${tts.join(', ') || '(none)'}`);
  } catch (e) {
    bad(`model list failed: ${e.message.slice(0, 200)}`);
    log('     A 403 here usually means the key belongs to a Vertex AI project rather than');
    log('     the Gemini API. See README, section "Gemini API מול Vertex AI".');
  }
} else {
  log('  - skipped (no key)');
}

log('\n== 4. Wix site endpoints ==');
const base = args.dev ? cfg.site.functionsBaseDev : cfg.site.functionsBase;
for (const fnName of ['blogAudioPosts', 'blogAudioInfo']) {
  try {
    const res = await fetch(`${base}/${fnName}?probe=1`, { method: 'GET' });
    if (res.status === 401 || res.status === 403) ok(`${fnName} deployed and refusing unauthenticated calls (${res.status})`);
    else if (res.status === 200) ok(`${fnName} deployed and answering (200)`);
    // A 400 is the function itself rejecting a probe that carries no slug, which
    // proves it is deployed just as clearly as a 403 does.
    else if (res.status === 400) ok(`${fnName} deployed and rejecting the incomplete probe (400)`);
    else bad(`${fnName} answered HTTP ${res.status}. On this site every /_functions/<name> answers 500 with an empty body, so a 500 does not tell missing code from a broken module - check Wix Site Monitoring. If the code really is absent, append wix-backend/http-functions.SNIPPET.js to the site backend/http-functions.js`);
  } catch (e) {
    bad(`${fnName} unreachable: ${e.message.slice(0, 120)}`);
  }
}
try {
  const res = await fetch(`${cfg.site.baseUrl}/blog-posts-sitemap.xml`);
  const xml = await res.text();
  const n = (xml.match(/<loc>/g) || []).length;
  ok(`blog sitemap reachable, ${n} published posts listed`);
} catch (e) { bad(`blog sitemap unreachable: ${e.message.slice(0, 120)}`); }

log(`\n${problems === 0 ? '✓ all checks passed' : `✗ ${problems} problem(s) above`}\n`);
process.exit(problems === 0 ? 0 : 1);
