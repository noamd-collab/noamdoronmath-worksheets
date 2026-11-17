import { continuesIntake } from '../../../../noam-ai/site-companion/exercise-intake.js';

/** Selection can enter through the public guide as well as the teacher page. */
export function isTeacherToolRequest(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const value = payload as Record<string, any>;
  return value.page?.kind === 'teachers' || value.teacher != null || value.intake != null ||
    continuesIntake(String(value.message || ''), value.intake);
}
