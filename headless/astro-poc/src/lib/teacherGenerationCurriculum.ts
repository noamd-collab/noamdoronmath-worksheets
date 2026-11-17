import { parseTeacherGenerationCurriculum, type TeacherGenerationCurriculum } from './teacherGenerationContract';
export const GENERATION_CURRICULUM_SHA256 = '57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b';
let cached: TeacherGenerationCurriculum | undefined;
/** Curriculum is a static, non-personal asset. Its exact hash pins the server
 * validation without putting the full catalog in the size-limited Wix worker. */
export async function loadGenerationCurriculum(origin: string, fetcher: typeof fetch = fetch): Promise<TeacherGenerationCurriculum> {
  if(cached) return cached;
  const response=await fetcher(new URL('/teachers/generation-curriculum.json',origin),{
    credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000),
  });
  if(!response.ok || !response.body) throw new Error('CURRICULUM_UNAVAILABLE');
  const reader=response.body.getReader(), chunks:Uint8Array[]=[];let length=0;
  try {for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>100000)throw new Error('CURRICULUM_SIZE');chunks.push(r.value);}}
  finally {void reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==GENERATION_CURRICULUM_SHA256)throw new Error('CURRICULUM_HASH_MISMATCH');
  cached=parseTeacherGenerationCurriculum(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  return cached;
}
