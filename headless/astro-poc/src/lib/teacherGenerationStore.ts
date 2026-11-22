import { TEACHER_ACCESS_CONFIG } from './teacherAccessConfig';
import { TEACHER_SESSION_COOKIE } from './teacherAccess';
import { GENERAL_GENERATION_PROFILE, GENERATION_CURRICULUM_SHA256 } from './teacherGenerationContract';

export const GENERATION_BUCKET = 'teacher-generation-private';
export const GENERATION_STATES = ['queued', 'running', 'needs_review', 'failed'] as const;
/** A fresh heartbeat alone is not enough during an intake-contract rollout. */
export function workerAcceptsCurrentIntake(capabilities: any): boolean {
  return Array.isArray(capabilities?.acceptedIntakeVersions) &&
    (capabilities.acceptedIntakeVersions.includes(2) || workerAcceptsCurriculumIntake(capabilities));
}
export function workerAcceptsCurriculumIntake(capabilities: any): boolean {
  return capabilities?.profile === GENERAL_GENERATION_PROFILE && capabilities.curriculumSha256 === GENERATION_CURRICULUM_SHA256 &&
    Array.isArray(capabilities.acceptedIntakeVersions) && capabilities.acceptedIntakeVersions.includes(3);
}
export type GenerationState = typeof GENERATION_STATES[number];
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
export class GenerationStoreError extends Error {
  constructor(public readonly code: 'GENERATION_UNAVAILABLE' | 'GENERATION_ACTIVE' | 'GENERATION_LIMIT' | 'REQUEST_CONFLICT', public readonly status = 503) { super(code); }
}

async function readBoundedText(response: Response, maximum: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (!Number.isFinite(declared) || declared > maximum) throw new GenerationStoreError('GENERATION_UNAVAILABLE');
  if (!response.body) throw new GenerationStoreError('GENERATION_UNAVAILABLE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > maximum) throw new GenerationStoreError('GENERATION_UNAVAILABLE');
      chunks.push(part.value);
    }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Only called after the fixed project's Auth server has authorized this request.
 * No cookie is returned in an API body or persisted in a job. */
export function generationSessionToken(request: Request): string {
  const values = (request.headers.get('cookie') || '').split(';').map(p => p.trim())
    .filter(p => p.startsWith(TEACHER_SESSION_COOKIE + '='));
  if (values.length !== 1) throw new GenerationStoreError('GENERATION_UNAVAILABLE');
  return values[0].slice(TEACHER_SESSION_COOKIE.length + 1);
}

export function createGenerationStore(token: string, fetcher: typeof fetch = fetch, enqueueKey?: string) {
  const config = TEACHER_ACCESS_CONFIG;
  async function request(path: string, init: RequestInit = {}, privileged = false) {
    const headers = new Headers(init.headers);
    if (privileged && !enqueueKey) throw new GenerationStoreError('GENERATION_UNAVAILABLE');
    headers.set('apikey', privileged ? enqueueKey! : config.supabaseAnonKey);
    headers.set('authorization', 'Bearer ' + (privileged ? enqueueKey! : token));
    headers.set('accept', 'application/json');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetcher(config.supabaseUrl + path, {
        ...init, headers, signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
      });
      if (!response.ok) {
        // Never return provider SQL details, cookies or request data to the browser.
        if (privileged && response.status === 409) throw new GenerationStoreError('REQUEST_CONFLICT', 409);
        if (privileged && response.status === 423) throw new GenerationStoreError('GENERATION_ACTIVE', 423);
        if (privileged && response.status === 429) {
          // A gateway may itself throttle requests. Only the database's exact
          // quota exception means the teacher has used five creations.
          const text = await readBoundedText(response, 2048);
          let providerError: { code?: string; message?: string } | null = null;
          try { providerError = JSON.parse(text); } catch { /* Not the database quota response. */ }
          if (providerError?.code === 'PT429' && providerError.message === 'GENERATION_LIMIT')
            throw new GenerationStoreError('GENERATION_LIMIT', 429);
        }
        throw new GenerationStoreError('GENERATION_UNAVAILABLE');
      }
      return JSON.parse(await readBoundedText(response, 256000));
    } catch (error) {
      if (error instanceof GenerationStoreError) throw error;
      throw new GenerationStoreError('GENERATION_UNAVAILABLE');
    } finally { clearTimeout(timer); }
  }
  const columns = 'id,request_key,request_hash,lesson,status,phase,result,error_code,created_at,updated_at';
  return {
    async health() {
      const rows = await request('/rest/v1/noam_teacher_generation_workers?id=eq.primary&select=updated_at,capabilities&limit=1');
      const row = Array.isArray(rows) ? rows[0] : null;
      const age = Date.now() - Date.parse(row?.updated_at);
      return { online: Number.isFinite(age) && age >= -10000 && age < 90000 && workerAcceptsCurrentIntake(row?.capabilities), capabilities: row?.capabilities ?? null };
    },
    async quota(): Promise<{ dailyLimit: 5 | null; remainingToday: number | null; resetsAt: string }> {
      const quota = await request('/rest/v1/rpc/noam_teacher_generation_quota_status', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      });
      const validCount = quota?.dailyLimit === null ? quota.remainingToday === null :
        quota?.dailyLimit === 5 && Number.isInteger(quota.remainingToday) && quota.remainingToday >= 0 && quota.remainingToday <= 5;
      if (!validCount || typeof quota.resetsAt !== 'string' || !Number.isFinite(Date.parse(quota.resetsAt)))
        throw new GenerationStoreError('GENERATION_UNAVAILABLE');
      return { dailyLimit: quota.dailyLimit, remainingToday: quota.remainingToday, resetsAt: quota.resetsAt };
    },
    async list() { return request('/rest/v1/noam_teacher_generation_jobs?select=' + columns + '&order=created_at.desc&limit=20'); },
    async createdWorksheets() {
      return request('/rest/v1/rpc/noam_teacher_created_worksheets', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      });
    },
    async get(id: string) {
      if (!uuid(id)) return null;
      const rows = await request('/rest/v1/noam_teacher_generation_jobs?id=eq.' + id + '&select=' + columns + '&limit=1');
      return Array.isArray(rows) ? rows[0] ?? null : null;
    },
    async findRequest(key: string) {
      if (!uuid(key)) return null;
      const rows = await request('/rest/v1/noam_teacher_generation_jobs?request_key=eq.' + key + '&select=' + columns + '&limit=1');
      return Array.isArray(rows) ? rows[0] ?? null : null;
    },
    async enqueue(row: Record<string, unknown>) {
      const rows = await request('/rest/v1/noam_teacher_generation_jobs?select=' + columns, {
        method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row),
      }, true);
      if (!Array.isArray(rows) || rows.length !== 1) throw new GenerationStoreError('GENERATION_UNAVAILABLE');
      return rows[0];
    },
    async download(ownerId: string, id: string, kind: 'pdf' | 'docx') {
      if (!uuid(ownerId) || !uuid(id)) throw new GenerationStoreError('GENERATION_UNAVAILABLE');
      // The only downloadable paths are constructed here, never accepted from model or browser.
      return fetcher(config.supabaseUrl + '/storage/v1/object/authenticated/' + GENERATION_BUCKET + '/' + ownerId + '/' + id + '/sheet.' + kind, {
        headers: { apikey: config.supabaseAnonKey, authorization: 'Bearer ' + token },
        redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
    },
  };
}
