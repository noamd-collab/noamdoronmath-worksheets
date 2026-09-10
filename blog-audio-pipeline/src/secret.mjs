// Secret loading. The Gemini API key is never printed, never written to state,
// never passed on a command line and never sent anywhere except generativelanguage.googleapis.com.
//
// Resolution order:
//   1. macOS Keychain item  service="noam-blog-audio"  account="GEMINI_API_KEY"
//   2. Environment variable GEMINI_API_KEY
//   3. File <project>/.env  (chmod 600, gitignored) with a line GEMINI_API_KEY=...
//
// See README.md, section "הזנת המפתח".

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { p } from './paths.mjs';

const KEYCHAIN_SERVICE = 'noam-blog-audio';

function fromKeychain(account) {
  try {
    const out = execFileSync(
      '/usr/bin/security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return out.trim() || null;
  } catch {
    return null;
  }
}

function fromEnvFile(name) {
  const f = p('.env');
  if (!fs.existsSync(f)) return null;
  const st = fs.statSync(f);
  if ((st.mode & 0o077) !== 0) {
    throw new Error(`.env is group/world readable. Run: chmod 600 ${f}`);
  }
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '') || null;
  }
  return null;
}

export function getSecret(name, { required = true } = {}) {
  const value = fromKeychain(name) || process.env[name] || fromEnvFile(name);
  if (!value && required) {
    throw new Error(
      `Missing secret ${name}. Store it in the macOS Keychain:\n` +
      `  security add-generic-password -s ${KEYCHAIN_SERVICE} -a ${name} -w\n` +
      `(the command prompts for the value; nothing is echoed and nothing reaches the shell history)`
    );
  }
  return value || null;
}

// Redacts anything that looks like a key before a message is logged.
export function redact(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[REDACTED_KEY]')
    .replace(/(key=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/(x-goog-api-key\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/g, '$1[REDACTED]');
}

export const KEYCHAIN = { service: KEYCHAIN_SERVICE };
