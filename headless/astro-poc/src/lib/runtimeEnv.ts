/**
 * `process.env` where the runtime provides one (Node preview, unit tests) and an
 * empty object where it does not. Wix hosting runs on Cloudflare Workers, where a
 * bare `process` reference can throw a ReferenceError.
 */
export function runtimeProcessEnv(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env ?? {};
}
