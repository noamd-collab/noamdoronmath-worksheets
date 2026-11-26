#!/usr/bin/env node
// Applies one SQL migration to the hosted Supabase project through the
// Management API, then verifies what landed. Needs a personal access token:
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node tools/security/apply-supabase-migration.mjs \
//     supabase/migrations/20261126020000_teacher_entitlements.sql
//
// The token is never written to disk. The script refuses to apply a migration
// whose first object already exists, so a re-run cannot half-install it.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ouzquolkeuceektfihss';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const API = 'https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query';

const file = process.argv[2];
if (!file) {
  console.error('usage: apply-supabase-migration.mjs <migration.sql>');
  process.exit(64);
}
if (!TOKEN) {
  console.error('MISSING_SUPABASE_ACCESS_TOKEN');
  console.error('Set SUPABASE_ACCESS_TOKEN (a personal access token starting with sbp_).');
  console.error('Create one at https://supabase.com/dashboard/account/tokens');
  process.exit(65);
}

const sql = await readFile(path.resolve(file), 'utf8');

async function query(statement) {
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: statement }),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body && body.message ? body.message : text;
    throw new Error('HTTP ' + response.status + ': ' + String(message).slice(0, 500));
  }
  return body;
}

const installed = await query(
  "select to_regclass('noam_teacher_access.entitlements') is not null as installed"
);
if (installed?.[0]?.installed === true) {
  console.log(JSON.stringify({ applied: false, reason: 'ALREADY_INSTALLED' }));
} else {
  console.log(JSON.stringify({ applying: true, bytes: sql.length, project: PROJECT_REF }));
  await query(sql);
  console.log(JSON.stringify({ applied: true }));
}

const verification = await query(`
  select
    to_regclass('noam_teacher_access.entitlements') is not null as table_exists,
    (select relrowsecurity from pg_class where oid = 'noam_teacher_access.entitlements'::regclass) as rls_enabled,
    (select count(*)::int from noam_teacher_access.grant_secret) as secrets,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'noam_teacher_access') as private_functions,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'noam_teacher_access%') as public_rpcs
`);
console.log(JSON.stringify({ verification: verification?.[0] ?? verification }, null, 2));

const row = verification?.[0] ?? {};
const ok = row.table_exists === true && row.rls_enabled === true && row.public_rpcs === 4;
console.log(ok ? 'INSTALL_OK' : 'INSTALL_INCOMPLETE');
process.exit(ok ? 0 : 1);
