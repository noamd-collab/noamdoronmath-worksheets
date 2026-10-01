/**
 * HTML shells for the unlisted lesson route.
 * The interactive lesson itself is the standalone file lesson.html (imported raw).
 * Inactive / missing shells contain no lesson body.
 */
import { ROBOTS_VALUE, SECRET_LESSON_TOKEN, type LessonPhase } from './secretLesson';

const FONT = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=Secular+One&display=swap';

function shell(title: string, heading: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${ROBOTS_VALUE}">
<meta name="googlebot" content="${ROBOTS_VALUE}">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT}" rel="stylesheet">
<style>
  body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Heebo,system-ui,sans-serif;color:#17233f;background:linear-gradient(160deg,#eef6f4,#f5f4ef 55%,#f7f0ea)}
  main{max-width:440px;background:#fff;border-radius:24px;box-shadow:0 16px 40px rgba(23,35,63,.1);padding:28px 24px;text-align:center}
  h1{margin:0 0 10px;font-family:"Secular One",sans-serif;font-weight:400;font-size:26px}
  p{margin:0 0 18px;color:#475569;font-size:16px;line-height:1.6}
  a{display:inline-block;background:#1a8a80;color:#fff;text-decoration:none;border-radius:50px;padding:12px 22px;font-family:"Secular One",sans-serif}
</style>
</head>
<body>
<main>
  <h1>${heading}</h1>
  <p>${body}</p>
  <a href="https://www.noamdoronmath.co.il/">לאתר של נועם דורון</a>
</main>
</body>
</html>`;
}

export function renderGatePage(phase: Exclude<LessonPhase, 'live'>): string {
  if (phase === 'expired') {
    return shell(
      'הקישור כבר לא פעיל',
      'הקישור כבר לא פעיל',
      'השיעור הזה היה פתוח ל־72 שעות, והזמן נגמר.'
    );
  }
  return shell(
    'הקישור עדיין לא פעיל',
    'הקישור עדיין לא פעיל',
    'השיעור ייפתח כשהקישור יפורסם.'
  );
}

export function renderNotFoundPage(): string {
  return shell('העמוד לא נמצא', 'העמוד לא נמצא', 'אין עמוד בכתובת הזו.');
}

export function lessonPageUrl(origin: string, token: string = SECRET_LESSON_TOKEN): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/l/${token}`;
}

export function previewImageUrl(origin: string, token: string = SECRET_LESSON_TOKEN): string {
  return `${lessonPageUrl(origin, token)}/preview.png`;
}

/** Fill absolute social URLs. Lesson markup is otherwise unchanged. */
export function withSocialUrls(lessonHtml: string, origin: string, token: string = SECRET_LESSON_TOKEN): string {
  const page = lessonPageUrl(origin, token);
  const image = previewImageUrl(origin, token);
  return lessonHtml.replaceAll('__OG_URL__', page).replaceAll('__OG_IMAGE__', image);
}

export function decodeBase64Bytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
