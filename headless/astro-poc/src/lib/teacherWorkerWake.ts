/** Server-only wake transport. A wake acknowledgement is never worker readiness. */
export type TeacherWorkerWakeResult = 'accepted' | 'pending' | 'unavailable';
export type TeacherWorkerWake = () => Promise<TeacherWorkerWakeResult>;
const MAX_WAKE_MS = 2500;

export function createTeacherWorkerWake(
  config: { url?: string; secret?: string },
  transport: typeof fetch = globalThis.fetch,
  timeoutMs = MAX_WAKE_MS,
): TeacherWorkerWake | undefined {
  // Both unset preserves the existing local-worker installation. Partial or
  // malformed cloud configuration must never silently fall back to it.
  if (!config.url && !config.secret) return undefined;
  const origin = config.url;
  const secret = config.secret;
  const valid = typeof origin === 'string' &&
    /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onrender\.com\/?$/.test(origin) &&
    typeof secret === 'string' && /^[a-f0-9]{64}$/.test(secret);
  return async () => {
    if (!valid) return 'unavailable';
    const controller = new AbortController();
    const deadline = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(MAX_WAKE_MS, timeoutMs)) : MAX_WAKE_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async (): Promise<TeacherWorkerWakeResult> => {
          try {
            const response = await transport(origin!.replace(/\/$/, '') + '/wake', {
              method: 'POST', headers: { Authorization: 'Bearer ' + secret }, body: new Uint8Array(0),
              redirect: 'error', credentials: 'omit', cache: 'no-store',
              referrerPolicy: 'no-referrer', signal: controller.signal,
            });
            void response.body?.cancel().catch(() => {});
            return response.status === 202 ? 'accepted' : 'unavailable';
          } catch { return 'unavailable'; }
        })(),
        new Promise<TeacherWorkerWakeResult>(resolve => {
          timer = setTimeout(() => {
            // A cold host may have accepted the request before it can answer.
            // This permits bounded health polling, never an online claim.
            resolve('pending'); controller.abort();
          }, deadline);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
    }
  };
}
