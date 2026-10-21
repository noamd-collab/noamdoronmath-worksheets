/** Strip credential-shaped text before it is logged or sent to a model. */

const SECRET_ENV = ['CHINESE_MODELS_API_KEY', 'GITHUB_TOKEN', 'WIX_CLIENT_ID'];

export function redactSecrets(text) {
  let out = String(text ?? '');
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (value && value.length >= 6) out = out.split(value).join('[REDACTED]');
  }
  return out
    .replace(/sk-[A-Za-z0-9_\-]{8,}/g, 'sk-[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]{8,}/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*)(['"]?)[^\s'"]+\2/gi,
      '$1$2[REDACTED]$2',
    );
}
