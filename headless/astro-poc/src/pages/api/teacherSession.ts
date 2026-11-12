import type { APIRoute } from 'astro';
import { createTeacherSession, clearTeacherSession, sameOriginTeacherMutation } from '../../lib/teacherSession';
import { TEACHER_PRIVATE_HEADERS } from '../../lib/teacherAccess';
export const prerender = false;
export const POST: APIRoute = ({ request, cookies }) => createTeacherSession(request, cookies);
export const DELETE: APIRoute = ({ request, cookies }) => {
  if (!sameOriginTeacherMutation(request)) return new Response(null, { status: 403, headers: TEACHER_PRIVATE_HEADERS });
  clearTeacherSession(cookies);
  return new Response(null, { status: 204, headers: TEACHER_PRIVATE_HEADERS });
};
