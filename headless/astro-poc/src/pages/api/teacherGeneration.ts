import type { APIRoute } from 'astro';
import { TEACHER_GENERATION_SERVICE_KEY, NOAM_RECAPTCHA_SECRET_KEY, WORKER_URL, WORKER_WAKE_SECRET } from 'astro:env/server';
import { handleTeacherGeneration } from '../../lib/teacherGeneration';
import { createTeacherWorkerWake } from '../../lib/teacherWorkerWake';
import { loadGenerationCurriculum } from '../../lib/teacherGenerationCurriculum';
import { resolveNativeSvgPublicOrigin } from '../../lib/nativeSvgResponse';
import { secretFromEnv } from '../../lib/noamSecrets';
import { verifyRecaptcha } from '../../../../../noam-ai/site-companion/bot-guard.js';
export const prerender = false;
const respond: APIRoute = ({request}) => handleTeacherGeneration(request, {
  enqueueKey: secretFromEnv('TEACHER_GENERATION_SERVICE_KEY',TEACHER_GENERATION_SERVICE_KEY),
  wake: createTeacherWorkerWake({url:secretFromEnv('WORKER_URL',WORKER_URL),secret:secretFromEnv('WORKER_WAKE_SECRET',WORKER_WAKE_SECRET)}),
  loadCurriculum: async()=>{
    const origin=resolveNativeSvgPublicOrigin(request.url,request.headers.get('x-wix-forwarded-url'));
    if(!origin)throw new Error('INVALID_ORIGIN');
    return loadGenerationCurriculum(origin);
  },
  verifyBot: async(token)=>{
    const check=await verifyRecaptcha({token,secret:secretFromEnv('NOAM_RECAPTCHA_SECRET_KEY',NOAM_RECAPTCHA_SECRET_KEY),
      fetch:globalThis.fetch,action:'teacher_worksheet_generate',timeoutMs:5000});
    return check.passed===true;
  },
});
export const GET=respond;
export const POST=respond;
