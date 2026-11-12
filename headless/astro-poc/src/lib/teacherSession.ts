import type { AstroCookies } from 'astro';
import { TEACHER_SESSION_COOKIE, TEACHER_PRIVATE_HEADERS, TEACHER_SESSION_COOKIE_OPTIONS, sanitizeTeacherReturnTo, teacherAccessFailure, verifyGoogleTeacherToken } from './teacherAccess';
import { resolveNativeSvgPublicOrigin } from './nativeSvgResponse';

export const TEACHER_RETURN_COOKIE = '__Host-noam_teacher_return';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...TEACHER_PRIVATE_HEADERS, 'content-type': 'application/json; charset=utf-8' },
});

/** A cross-origin site may neither establish nor replace this browser's session. */
export function sameOriginTeacherMutation(request: Request): boolean {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  const publicOrigin = resolveNativeSvgPublicOrigin(request.url, request.headers.get('x-wix-forwarded-url'));
  return !!publicOrigin && origin === publicOrigin && (!site || site === 'same-origin');
}

export function clearTeacherSession(cookies: AstroCookies): void {
  cookies.delete(TEACHER_SESSION_COOKIE, TEACHER_SESSION_COOKIE_OPTIONS);
  cookies.delete(TEACHER_RETURN_COOKIE, TEACHER_SESSION_COOKIE_OPTIONS);
}

export async function createTeacherSession(request: Request, cookies: AstroCookies): Promise<Response> {
  if (!sameOriginTeacherMutation(request)) return json({ code: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ code: 'INVALID_REQUEST' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 16000) return json({ code: 'INVALID_REQUEST' }, 413);
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 16000) return json({ code: 'INVALID_REQUEST' }, 413);
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ code: 'INVALID_REQUEST' }, 400);
  } catch { return json({ code: 'INVALID_REQUEST' }, 400); }
  // Wix rejects DELETE before the route runs. Keep logout on its supported
  // JSON POST path, under the same origin and request validation as sign-in.
  if (body.action === 'logout') {
    clearTeacherSession(cookies);
    return json({ ok: true });
  }
  if (body.action === 'start') {
    clearTeacherSession(cookies);
    cookies.set(TEACHER_RETURN_COOKIE, sanitizeTeacherReturnTo(body.returnTo), {
      ...TEACHER_SESSION_COOKIE_OPTIONS, maxAge: 600,
    });
    // A dedicated SSR route avoids static learning.html shadowing the callback.
    const origin = resolveNativeSvgPublicOrigin(request.url, request.headers.get('x-wix-forwarded-url'))!;
    return json({ redirectTo: new URL('/teachers/login', origin).href });
  }
  const token = typeof body.accessToken === 'string' ? body.accessToken : '';
  const access = await verifyGoogleTeacherToken(token);
  if (!access.ok) {
    clearTeacherSession(cookies);
    return teacherAccessFailure(access);
  }
  const returnTo = sanitizeTeacherReturnTo(cookies.get(TEACHER_RETURN_COOKIE)?.value || body.returnTo);
  cookies.set(TEACHER_SESSION_COOKIE, token, {
    ...TEACHER_SESSION_COOKIE_OPTIONS,
    expires: new Date(access.expiresAt * 1000),
    maxAge: Math.max(0, Math.floor(access.expiresAt - Date.now() / 1000)),
  });
  cookies.delete(TEACHER_RETURN_COOKIE, TEACHER_SESSION_COOKIE_OPTIONS);
  return json({ ok: true, returnTo });
}
