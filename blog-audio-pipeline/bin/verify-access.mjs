#!/usr/bin/env node
// Checks every access this pipeline needs, without generating any audio and
// without ever printing the key. Run this first, and after any key rotation.

import { readConfig } from '../src/paths.mjs';
import { getSecret, KEYCHAIN } from '../src/secret.mjs';
import { listAvailableModels } from '../src/tts.mjs';
import { ffmpegPath } from '../src/mp3.mjs';
import { parseArgs, log } from '../src/cli.mjs';

const args = parseArgs();
const cfg = readConfig();
let problems = 0;
const ok = (m) => log(`  ✓ ${m}`);
const bad = (m) => { problems++; log(`  ✗ ${m}`); };

const useEleven = cfg.tts.provider === 'elevenlabs';
log(`\n== 1. Secrets (tts provider: ${cfg.tts.provider || 'gemini-api'}) ==`);
let elevenKey = null;
if (useEleven) {
  try {
    elevenKey = getSecret('ELEVENLABS_API_KEY');
    ok(`ELEVENLABS_API_KEY found (length ${elevenKey.length}, value not shown)`);
  } catch (e) {
    bad(e.message.split('\n')[0]);
    log(`     store it with:  security add-generic-password -s ${KEYCHAIN.service} -a ELEVENLABS_API_KEY -w`);
  }
}
let key = null;
try {
  key = getSecret('GEMINI_API_KEY', { required: !useEleven });
  if (key) ok(`GEMINI_API_KEY found (length ${key.length}, value not shown)${useEleven ? ' - used only by the optional transcription check' : ''}`);
  else log('  - GEMINI_API_KEY not set: fine with ElevenLabs, only bin/verify-audio.mjs (transcription check) needs it');
} catch (e) {
  bad(e.message.split('\n')[0]);
  log(`     store it with:  security add-generic-password -s ${KEYCHAIN.service} -a GEMINI_API_KEY -w`);
}
try {
  const t = getSecret('NOAM_AUDIO_WORKER_TOKEN', { required: false });
  t ? ok('NOAM_AUDIO_WORKER_TOKEN found (value not shown)') : bad('NOAM_AUDIO_WORKER_TOKEN missing (needed only for upload/register to Wix)');
} catch (e) { bad(e.message.split('\n')[0]); }

log('\n== 2. Local tooling ==');
const ff = ffmpegPath();
ff ? ok(`ffmpeg at ${ff}`) : bad('ffmpeg missing - run:  brew install ffmpeg');

if (useEleven) {
  log('\n== 3a. ElevenLabs account: key, model, voice ==');
  if (elevenKey) {
    const headers = { 'xi-api-key': elevenKey };
    try {
      // Read-only calls: no speech is generated and no credits are spent.
      const m = await fetch('https://api.elevenlabs.io/v1/models', { headers });
      if (!m.ok) throw new Error(`HTTP ${m.status}`);
      const models = await m.json();
      const hit = models.find((x) => x.model_id === cfg.tts.model);
      hit ? ok(`${cfg.tts.model} available to this key (can_do_text_to_speech=${hit.can_do_text_to_speech})`) : bad(`${cfg.tts.model} NOT in this account's model list`);
      const hebrew = hit && (hit.languages || []).some((l) => ['he', 'heb', 'hebrew'].includes(String(l.language_id || l.name || l).toLowerCase()));
      hit && (hebrew ? ok('model lists Hebrew') : log('     (model list did not name Hebrew explicitly; the models page lists Hebrew as heb for eleven_v4)'));
      const v = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(cfg.tts.voice)}`, { headers });
      v.ok ? ok(`voice ${cfg.tts.voice} found in the account`) : bad(`voice ${cfg.tts.voice} not usable (HTTP ${v.status})`);
      const s = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers });
      if (s.ok) {
        const sub = await s.json();
        ok(`plan ${sub.tier}: ${sub.character_count} of ${sub.character_limit} credits used this period`);
      } else log(`     (subscription not readable: HTTP ${s.status}; the key may lack the user_read permission)`);
    } catch (e) {
      bad(`ElevenLabs check failed: ${String(e.message).slice(0, 160)}`);
    }
  } else {
    log('  - skipped (no key)');
  }
}

log(`\n== 3${useEleven ? 'b' : ''}. Gemini account: which API and which models ==`);
if (useEleven && !key) {
  log('  - skipped (optional with ElevenLabs)');
} else if (key) {
  try {
    const models = await listAvailableModels();
    ok(`Gemini API (generativelanguage.googleapis.com) answered: ${models.length} models visible for this key`);
    const wanted = useEleven ? [cfg.verify.asrModel] : [cfg.tts.model, ...cfg.tts.modelAlternatives, cfg.verify.asrModel];
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
