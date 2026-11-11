/** Existing teacher wizard. Assets retain their /teachers/ URLs. */
import type { APIRoute } from 'astro';
import page from '../../teacher-pages/wizard.html?raw';
import { authorizeTeacherRequest, TEACHER_PRIVATE_HEADERS, sanitizeTeacherReturnTo } from '../../lib/teacherAccess';

export const prerender = false;

const ownerChrome = '<link rel="stylesheet" href="/teachers/auth.css"><div class="teacher-private-access" data-teacher-auth="workspace"><a href="/teachers/start">אזור המורים · בדיקות פרטיות</a><form method="post" action="/api/teacherLogout"><button type="submit" data-teacher-logout>התנתקות</button></form></div>';
const authScripts = '<script src="/noam-learning-config.js" defer></script><script src="/vendor/supabase-2.116.0.js" defer></script><script src="/teachers/auth.js" defer></script>';
export const GET: APIRoute = async ({ request, url }) => {
  const access = await authorizeTeacherRequest(request);
  if (!access.ok) return new Response(null, { status: 303, headers: {
    ...TEACHER_PRIVATE_HEADERS,
    location: `/teachers/login?returnTo=${encodeURIComponent(sanitizeTeacherReturnTo(url.pathname + url.search))}`,
  } });
  const privatePage = page.replace(/(<body\b[^>]*>)/i, `$1${ownerChrome}`).replace('</body>', `${authScripts}</body>`);
  return new Response(privatePage, { headers: {
    ...TEACHER_PRIVATE_HEADERS, 'content-type': 'text/html; charset=utf-8',
  } });
};
