#!/usr/bin/env node
// Read-only integration check against the hosted project, using the public
// publishable key that already ships in the site. It never writes a row:
// a wrong secret is expected to be refused before any insert.
//
//   node tools/security/verify-teacher-entitlements-live.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = readFileSync(
  path.join(root, 'headless/astro-poc/src/lib/teacherAccessConfig.ts'),
  'utf8'
);
const url = /supabaseUrl:\s*"([^"]+)"/.exec(config)?.[1];
const key = /supabaseAnonKey:\s*"([^"]+)"/.exec(config)?.[1];
if (!url || !key) {
  console.error('CONFIG_NOT_FOUND');
  process.exit(64);
}

async function call(pathname, init = {}) {
  const response = await fetch(url + pathname, {
    ...init,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  return { status: response.status, body: text.slice(0, 300) };
}

const checks = [];

const grant = await call('/rest/v1/rpc/noam_teacher_access_grant', {
  method: 'POST',
  body: JSON.stringify({
    p_secret: 'deliberately-wrong-secret',
    p_payment_id: 'INTEGRATION-CHECK',
    p_email: 'integration@example.invalid',
    p_plan: 'monthly',
    p_days: 30,
    p_amount_agorot: 1800,
  }),
});
checks.push({
  name: 'grant refuses a wrong secret',
  pass: grant.status >= 400 && /GRANT_SECRET|42501|does not exist/i.test(grant.body),
  detail: grant.status + ' ' + grant.body.replace(/\s+/g, ' ').slice(0, 120),
});

const status = await call('/rest/v1/rpc/noam_teacher_access_status', {
  method: 'POST',
  body: '{}',
});
checks.push({
  name: 'status requires a signed-in user',
  pass: status.status === 401 || status.status === 403 || /SIGN_IN_REQUIRED|42501/i.test(status.body),
  detail: status.status + ' ' + status.body.replace(/\s+/g, ' ').slice(0, 120),
});

const table = await call('/rest/v1/noam_teacher_access_entitlements?select=id&limit=1');
checks.push({
  name: 'the table is not exposed to clients',
  pass: table.status >= 400,
  detail: table.status + ' ' + table.body.replace(/\s+/g, ' ').slice(0, 120),
});

for (const check of checks) {
  console.log((check.pass ? 'PASS ' : 'FAIL ') + check.name + ' :: ' + check.detail);
}
const all = checks.every((check) => check.pass);
console.log(all ? 'LIVE_OK' : 'LIVE_NOT_READY');
process.exit(all ? 0 : 1);
