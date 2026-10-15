/** Navigation over public, build-verified site records. No model or credentials. */
import { isRoleQuestion } from './companion.js';
import { suggestTopicGroup } from './topic-order.js';
const MARKS = 'אבגדהוזחט';
const STOP = new Set('אני אנחנו רוצה רוצים צריך צריכה צריכים אפשר בבקשה איפה היכן יש את לי על של עם לכיתה כיתה בכיתה כיתות דף דפים דפי עבודה תרגול לתרגול תרגילים מתמטיקה במתמטיקה ללמוד למצוא מחפש מחפשת תמצא תראה תן קח תעביר פתח תפתח לנו אותי באתר נושא בנושא בנושא יש לכם האם איך מגיעים להגיע עבור'.split(' '));
const ROUTES = [
  [/בלוג|פוסטים|מאמרים/, '/blog'],
  [/מחשבון|כלים למתמטיקה/, '/math-tools'],
  [/משחק/, '/games/kefel-mekutsar-2'],
  [/אודות|מי זה נועם|מי נועם/, '/aboutus'],
  [/וואטסאפ|ווטסאפ/, 'page-whatsapp'],
  [/הלמידה שלי|התקדמות|להתחבר|התחברות/, '/learning.html'],
  [/למורים|בניית דף|בונה דפים|להכין שיעור|לבנות שיעור/, '/teachers'],
  [/פרטיות/, '/accessibilityadaptation#privacy-policy'],
  [/נגישות/, '/accessibilityadaptation'],
  [/דף הבית|לעמוד הבית|עמוד ראשי/, '/'],
];
function normal(value) {
  return String(value || '').toLowerCase().replace(/[\u0591-\u05c7]/g, '').replace(/[׳״'"?!.،,]/g, '').replace(/\s+/g, ' ').trim();
}
function words(value) { return normal(value).split(/[^\p{L}\p{N}-]+/u).filter(Boolean); }
function gradeOf(message) {
  const text = normal(message);
  const m = text.match(/(?:^|\s)(?:[בל]?כיתה|grade)\s*([1-9אבגדהוזחט])(?=\s|$)/i) || text.match(/^([1-9אבגדהוזחט])$/);
  return m ? (Number(m[1]) || MARKS.indexOf(m[1]) + 1) : null;
}
function validHref(href) {
  return typeof href === 'string' && (/^\/(?!\/)[^\\\s]*$/.test(href) || /^https:\/\/static\.wixstatic\.com\/ugd\/[\w.-]+\.pdf$/.test(href) || /^https:\/\/chat\.whatsapp\.com\/[\w/?=&-]+$/.test(href));
}
function result(answer, rows, source = 'site-navigation') {
  const seen = new Set();
  const links = rows.filter(r => validHref(r.href) && !seen.has(r.href) && seen.add(r.href)).slice(0, 4)
    .map(r => ({id:r.id, label:[r.grade && !gradeOf(r.title) ? 'כיתה ' + MARKS[r.grade - 1] + '׳' : '', r.title, r.levelLabel].filter(Boolean).join(' · '), href:r.href}));
  return {ok:true, source, model:null, answer, text:answer, details:answer, primary:links[0] || null, chips:links.slice(1), links};
}
export function navigationHelp(guide, offline = false) {
  const records = guide.records || [];
  return result(offline ? 'אפשר להמשיך דרך דפי האתר. בחרו קישור, או כתבו כיתה ונושא לחיפוש.' : 'לאן תרצו להגיע? אפשר לכתוב כיתה ונושא, או לבחור דפי עבודה, בלוג או כלים למתמטיקה.',
    ['/worksheets', '/blog', '/math-tools', '/teachers'].map(path => records.find(r => r.href === path)).filter(Boolean));
}
export function navigateSite(input, guide, previousMessage = '') {
  const records = (guide && guide.records || []).filter(r => validHref(r.href));
  const raw = String(input.message || '').slice(0, 700);
  const text = normal(raw);
  const page = input.page || {};
  // Teacher selections and exercise help keep their existing guarded flows.
  if (page.kind === 'teachers' || /רמז|תפתור|לפתור|מה התשובה|איך פותרים|\bsolve\b|\bhint\b/i.test(text)) return null;
  if (isRoleQuestion(raw)) return navigationHelp(guide);
  if (/^(?:הי|היי|שלום|מה אתה עושה|מי אתה|במה אתה יכול לעזור(?: לי)?|מה יש באתר|עזרה|אני רוצה ללמוד)$/.test(text)) return navigationHelp(guide);
  const exact = records.filter(r => r.type === 'topic' && normal(r.title) === text);
  if (exact.length) return {...result('מצאתי את דף הנושא. בחרו קישור לפתיחה.', exact), needsGrade: false};
  // Group expansion must not steal a specific subject (e.g. linear functions).
  if (/הנושא הבא|הנושא הקודם|מה אחרי|מה לפני|מה הלאה|מרובעים/.test(text)) {
    const ordered = suggestTopicGroup(input, guide.catalog, guide);
    if (ordered) return ordered;
  }
  const explicitGrade = gradeOf(raw);
  let query = text;
  if (explicitGrade && /^(?:(?:[בל]?כיתה|grade)\s*)?[1-9אבגדהוזחט]$/.test(text) && previousMessage) query = normal(previousMessage) + ' ' + text;
  const pageGrade = Number((String(page.path || '').match(/(?:grade-|[?&](?:grade|g)=)([1-9])(?:\D|$)/) || [])[1]) || null;
  const grade = explicitGrade || gradeOf(query) || pageGrade;
  const useful = words(query.replace(/(?:[בל]?כיתה|grade)\s*[1-9אבגדהוזחט](?=\s|$)/g, '')).filter(w => w.length > 1 && !STOP.has(w));
  const generic = useful.length === 0;
  if (generic && (explicitGrade || /(?:^|\s)(?:דף|דפים|דפי עבודה|דפי תרגול|תרגול|תרגילים)(?:\s|$)/.test(text))) {
    const path = grade ? '/worksheets?grade=' + grade : '/worksheets';
    return result('בחרו נושא במאגר דפי העבודה' + (grade ? ' לכיתה ' + MARKS[grade-1] + '׳' : '') + '.', records.filter(r => r.href === path));
  }
  // Direct sections are matched only from the visitor's current request.
  for (const [pattern, path] of ROUTES) {
    if (!pattern.test(text)) continue;
    const row = records.find(r => r.href === path || r.id === path);
    if (row) return result('כאן אפשר לפתוח את ' + row.title + '.', [row]);
  }
  if (!useful.length) return null;
  const matches = records.filter(r => ['topic','worksheet','blog'].includes(r.type) && (!grade || !r.grade || r.grade === grade))
    .map(r => {
      const title = words([r.title, r.topic].filter(Boolean).join(' '));
      const terms = words(r.terms);
      const bare = (w) => w.length > 3 ? w.replace(/^ה/, '') : w;
      const hit = (w, list) => list.some(t => bare(t) === bare(w) || (w.length > 3 && /^[בלמהו]/.test(w) && bare(w.slice(1)) === bare(t)));
      const hits = useful.filter(w => hit(w, title));
      const extras = useful.filter(w => hit(w, terms));
      return {r, score:hits.length * 10 + extras.length * 2 + (r.type === 'topic' ? 3 : 0), hits:hits.length + extras.length};
    }).filter(x => x.hits > 0 && x.hits >= Math.ceil(useful.length / 2)).sort((a,b) => b.score - a.score);
  if (!matches.length) {
    return result('לא מצאתי התאמה ברורה. כתבו את שם הנושא והכיתה, או בחרו נושא במאגר דפי העבודה.', records.filter(r => r.href === (grade ? '/worksheets?grade=' + grade : '/worksheets')), 'navigation-clarify');
  }
  const best = matches[0];
  const top = matches.filter(x => x.score >= best.score - 3).map(x => x.r);
  const grades = new Set(top.map(r => r.grade).filter(Boolean));
  const rows = [];
  const topics = new Set();
  for (const r of top) {
    const key = r.grade + ':' + (r.topic || r.title);
    if (topics.has(key)) continue;
    topics.add(key); rows.push(r);
  }
  const answer = !grade && grades.size > 1 ? 'באיזו כיתה? מצאתי דפים בנושא בכמה כיתות — בחרו קישור או כתבו את הכיתה.' : 'מצאתי דפים מתאימים באתר. בחרו קישור לפתיחה.';
  return {...result(answer, rows), needsGrade: !grade && grades.size > 1};
}
