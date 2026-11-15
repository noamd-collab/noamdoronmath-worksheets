import packed from '../data/companion-worker-data.json';
import { createCompanionPackLoader } from './packedCompanionData';
const guide = createCompanionPackLoader(packed.guide);
const teacherIndex = createCompanionPackLoader(packed.teacherIndex);
export async function loadCompanionWorkerData() {
  const values = await Promise.all([guide(), teacherIndex()]);
  return { guide: values[0], teacherIndex: values[1] };
}
