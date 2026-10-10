/* Teacher picker for every catalog sheet.
   Grades 7–9: choose existing exercises across sheets.
   Grades 1–6: choose a sheet by topic and level.
   Print reuses the pilot path: marks on the original PDF page, or a short
   sheet cropped from that page, plus the teacher note. */
'use strict';

const CATALOG_URL = new URL('./teacher-catalog.json', import.meta.url);
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const FACTORING_PDF = '6a37fe7160324a17ad107b3dbe43c1db';

const SCENARIOS = {
  first: {
    label: 'מפגש ראשון',
    title: 'מתחילים מגורם משותף',
    summary: 'רצף קצר מתחילת הדף: זיהוי גורם משותף, בלי לדלג קדימה.',
    rationale: 'שאלות 1 ו־2 הן תחילת דף המקור. אין כאן שאלות שאינן על הדף.',
    details: 'הסימון בהדפסה יושב על דף המקור המלא, על הסעיפים שנבחרו.',
    selected: ['1א', '1ב', '1ג', '2א', '2ב', '2ג'],
    essential: ['1א', '1ג', '2א'],
    deepen: ['2ד', '4א'],
    suggestion: '2ד',
    suggestionText: 'סעיף 2ד כבר נמצא על אותו עמוד, אחרי הסעיפים שנבחרו.',
  },
  spiral: {
    label: 'חזרה ספירלית',
    title: 'חוזרים לכמה סעיפים מהדף',
    summary: 'מבחר קצר מתוך אותו דף, לא דף חדש.',
    rationale: 'רק סעיפים שקיימים בדף רמה א׳.',
    details: 'ההדפסה עדיין מציגה את עמודי המקור המלאים, עם סימון.',
    selected: ['1א', '3א', '5א', '8א', '12א'],
    essential: ['1א', '5א'],
    deepen: ['12א'],
    suggestion: '5ב',
    suggestionText: 'סעיף 5ב נמצא ליד 5א באותו עמוד.',
  },
  practice: {
    label: 'תרגול וביסוס',
    title: 'מתרגלים הוצאת גורם',
    summary: 'סעיפי תרגול מתוך שאלות 2, 4 ו־5.',
    rationale: 'כל הסעיפים האלה מופיעים בדף המקור.',
    details: 'אפשר להוריד או להוסיף סעיף לפני ההדפסה.',
    selected: ['2א', '2ב', '2ג', '2ד', '4א', '4ב', '5א', '5ב', '5ג', '5ד'],
    essential: ['2א', '4א', '5א'],
    deepen: ['5ד'],
    suggestion: '4ג',
    suggestionText: 'סעיף 4ג משלים את שאלה 4 על אותו עמוד.',
  },
  exam: {
    label: 'לקראת מבחן',
    title: 'מבחר לקראת מבחן',
    summary: 'כמה סעיפים מאוחרים יותר מאותו דף.',
    rationale: 'אין שאלות חדשות. אלה סעיפים שכבר מודפסים במקור.',
    details: 'הדף המודפס הוא עמוד המקור, לא רשימת קישורים.',
    selected: ['8א', '10א', '12א', '15א', '18א'],
    essential: ['8א', '10א'],
    deepen: ['18א'],
    suggestion: '10ב',
    suggestionText: 'סעיף 10ב נמצא באותה שאלה.',
  },
};

const STYLES = {
  scaffold: { label: 'מדורגת', help: 'מתחילים יחד, ואז עוברים בהדרגה לעבודה עצמאית.', plan: 'דרך עבודה מדורגת: קודם יחד, אחר כך עצמאית.' },
  creative: { label: 'יצירתית', help: 'בוחרים דוגמה אחת ומשאירים מקום להסבר של התלמידים.', plan: 'דרך עבודה יצירתית: דוגמה אחת, ואז הסבר של התלמידים.' },
  blended: { label: 'משולבת', help: 'חלק מהסעיפים בכיתה, והשאר לתרגול עצמאי.', plan: 'דרך עבודה משולבת: חלק בכיתה וחלק עצמאי.' },
};

const TIERS = { essential: 'חיוני', deepen: 'העמקה', extra: 'נוסף' };
const PRINT_UNPREPARED = '<p class="print-unprepared">כדי להדפיס, פותחים קודם את תצוגת ההדפסה.</p>';

const $ = (id) => document.getElementById(id);

let CATALOG = null;
let SOURCE = null;
const byPdf = new Map();
const sheets = new Map();
const library = new Map();
const pdfDocs = new Map();
const pageBitmaps = new Map();
let state = {
  scenario: 'first',
  style: 'scaffold',
  selected: [],
  filter: 'all',
  expanded: false,
  grade: '9',
  topic: '2',
  level: 'all',
  query: '',
};
let history = [];
let rendering = false;
let printMode = 'marked';
let printOpener = null;
let loadToken = 0;

function exKey(pdfId, id) {
  return 'ex:' + pdfId + ':' + id;
}

function sheetKey(pdfId) {
  return 'sheet:' + pdfId;
}

const TEACHER_SUGGEST_ENDPOINT = '/api/noamSiteCompanion';
const TEACHER_QUIET = 'נועם AI עוד לא פעיל. אפשר להמשיך לבחור ולהדפיס.';
const TEACHER_QUIET_RESULT = { enabled: false, exerciseIds: [], sheetIds: [], answer: '' };
let teacherBotPromise = null;

function suggestPayload(message) {
  const grade = gradeRecord(state.grade);
  const topic = currentTopic();
  return {
    message: String(message || '').slice(0, 700),
    page: { kind: 'teachers', path: location.pathname, title: document.title },
    teacher: {
      grade: state.grade,
      gradeLabel: grade ? grade.label : '',
      topic: state.topic,
      topicLabel: topic ? topic.title : '',
      level: state.level,
      note: $('teacher-note') ? $('teacher-note').value : '',
    },
  };
}

function loadNoamBotClient() {
  if (window.NoamBotClient && typeof window.NoamBotClient.create === 'function') {
    return Promise.resolve(window.NoamBotClient);
  }
  if (!loadNoamBotClient.pending) {
    loadNoamBotClient.pending = new Promise((resolve, reject) => {
      const loader = document.createElement('script');
      loader.src = '/noam-bot-client.js';
      loader.async = true;
      loader.onload = () => {
        if (window.NoamBotClient && typeof window.NoamBotClient.create === 'function') resolve(window.NoamBotClient);
        else reject(new Error('BOT_CLIENT_UNAVAILABLE'));
      };
      loader.onerror = () => reject(new Error('BOT_CLIENT_UNAVAILABLE'));
      document.head.appendChild(loader);
    }).catch((error) => {
      loadNoamBotClient.pending = null;
      throw error;
    });
  }
  return loadNoamBotClient.pending;
}

function teacherBot() {
  if (!teacherBotPromise) {
    teacherBotPromise = loadNoamBotClient().then((Bot) => Bot.create({
      api: '/api',
      enabled: true,
      modelTimeoutMs: 10000,
    })).catch((error) => {
      teacherBotPromise = null;
      throw error;
    });
  }
  return teacherBotPromise;
}

function quietSuggest(error) {
  const reason = (error && (error.code || error.message)) || 'UNKNOWN';
  if (typeof console !== 'undefined' && console.warn) console.warn('NOAM_TEACHER_SUGGEST_FAILED', String(reason).slice(0, 160));
  return TEACHER_QUIET_RESULT;
}

function installSuggest() {
  window.NoamTeacherSuggest = {
    enabled: false,
    classifier: 'qwen-flash',
    endpoint: TEACHER_SUGGEST_ENDPOINT,
    async classifyRequest() {
      return { enabled: false, intent: null };
    },
    async suggest(message) {
      try {
        const client = await teacherBot();
        const data = await client.postJson(TEACHER_SUGGEST_ENDPOINT, suggestPayload(message));
        if (!data || data.ok === false || data.active === false || data.code === 'NOT_ACTIVE') return TEACHER_QUIET_RESULT;
        return normalizeSuggest(data);
      } catch (error) {
        return quietSuggest(error);
      }
    },
  };
  const status = $('ai-suggest-status');
  if (status) status.textContent = 'הצעות נועם AI כבויות. ההערה נכנסת להדפסה בלבד.';
}

function gradeRecord(grade) {
  if (!CATALOG) return null;
  return CATALOG.grades.find((item) => String(item.grade) === String(grade)) || null;
}

function currentTopic() {
  const grade = gradeRecord(state.grade);
  if (!grade) return null;
  return grade.topics.find((topic) => String(topic.id) === String(state.topic)) || null;
}

function band() {
  const grade = gradeRecord(state.grade);
  return grade ? grade.band : 'middle';
}

function pilotOn() {
  return band() === 'middle' && String(state.grade) === '9' && String(state.topic) === '2' && sheets.has(FACTORING_PDF);
}

function topicSheets() {
  const topic = currentTopic();
  if (!topic) return [];
  return topic.sheets.filter((sheet) => state.level === 'all' || sheet.level === state.level);
}

function visibleSelectionKeys() {
  if (band() === 'elementary') return topicSheets().map((meta) => sheetKey(meta.pdfId));
  return currentExercises().map((question) => exKey(question.source.pdfId, question.id));
}

function keepVisible(selected, visible) {
  const allow = new Set(visible);
  return selected.filter((key) => allow.has(key));
}

function currentExercises() {
  const list = [];
  topicSheets().forEach((meta) => {
    const source = sheets.get(meta.pdfId);
    if (!source) return;
    source.questions.forEach((question) => list.push(question));
  });
  return list;
}

function available() {
  const topic = currentTopic();
  return !!(topic && topic.sheets.length);
}

function tier(question) {
  if (!question || state.scenario === 'other' || !pilotOn() || !question.source || question.source.pdfId !== FACTORING_PDF) return 'extra';
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  if (cfg.essential.includes(question.id)) return 'essential';
  if (cfg.deepen.includes(question.id)) return 'deepen';
  return 'extra';
}

function orderedQuestions() {
  const pool = currentExercises();
  if (!pilotOn() || state.scenario === 'other') return pool;
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  const rank = new Map();
  cfg.selected.forEach((id, index) => rank.set(id, index));
  return pool.slice().sort((a, b) => {
    const ar = a.source && a.source.pdfId === FACTORING_PDF && rank.has(a.id) ? rank.get(a.id) : 1000;
    const br = b.source && b.source.pdfId === FACTORING_PDF && rank.has(b.id) ? rank.get(b.id) : 1000;
    if (ar !== br) return ar - br;
    return pool.indexOf(a) - pool.indexOf(b);
  });
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function questionTextHTML(text) {
  return String(text || '').split(/([^\u0590-\u05FF]+)/).map((part) => {
    if (!part) return '';
    if (/[\u0590-\u05FF]/.test(part) || !/[A-Za-z0-9]/.test(part)) return escapeHTML(part);
    const [, lead, core, tail] = part.match(/^([\s.,?!:;]*)([\s\S]*?)([\s.,?!:;]*)$/);
    return escapeHTML(lead) + `<bdi dir="ltr" class="math">${escapeHTML(core)}</bdi>` + escapeHTML(tail);
  }).join('');
}

function selectionKey() {
  return state.selected.join('\n');
}

function snapshot() {
  history.push(state.selected.slice());
  if (history.length > 30) history.shift();
}

function announce(text) {
  const toast = $('toast');
  toast.hidden = false;
  toast.textContent = text;
  window.clearTimeout(announce.timer);
  announce.timer = window.setTimeout(() => { toast.hidden = true; }, 2400);
}

function fillGrades() {
  $('grade').innerHTML = CATALOG.grades.map((grade) => `<option value="${grade.grade}">${escapeHTML(grade.label)}</option>`).join('');
  $('grade').value = String(state.grade);
}

function fillTopics() {
  const grade = gradeRecord(state.grade);
  const topics = grade ? grade.topics : [];
  if (!topics.some((topic) => String(topic.id) === String(state.topic))) {
    state.topic = topics.length ? String(topics[0].id) : '';
  }
  $('topic').innerHTML = topics.map((topic) => `<option value="${topic.id}">${escapeHTML(topic.title)}</option>`).join('');
  if (state.topic) $('topic').value = String(state.topic);
}

function shownQuestions(pool) {
  if (state.expanded || state.filter === 'selected') return pool;
  const picked = pool.filter((question) => state.selected.includes(exKey(question.source.pdfId, question.id)));
  const rest = pool.filter((question) => !state.selected.includes(exKey(question.source.pdfId, question.id)));
  const room = Math.max(0, 8 - picked.length);
  const shown = new Set(picked.concat(rest.slice(0, room)).map((question) => exKey(question.source.pdfId, question.id)));
  return pool.filter((question) => shown.has(exKey(question.source.pdfId, question.id)));
}

function labelOnly(question) {
  const text = String(question.text || '').trim();
  return !text || /^שאלה\s+\d+/.test(text);
}

function needsThumb(question) {
  return labelOnly(question) || question.scrambled === true;
}

function thumbAria(question) {
  if (question.scrambled) return question.label;
  return String(question.text || question.label || '');
}

function exerciseCard(question) {
  const key = exKey(question.source.pdfId, question.id);
  const level = question.source.levelLabel ? `<span class="q-page" style="display:block">${escapeHTML(question.source.levelLabel)} · עמוד ${question.page}</span>` : `<span class="q-page" style="display:block">עמוד ${question.page} בדף המקור</span>`;
  const badge = pilotOn() ? `<span class="badge ${tier(question)}">${TIERS[tier(question)]}</span>` : '';
  const body = needsThumb(question)
    ? `<canvas class="q-thumb" width="1" height="1" data-thumb="${escapeHTML(key)}" aria-label="${escapeHTML(thumbAria(question))}"></canvas>`
    : `<span class="q-desc" dir="rtl">${questionTextHTML(question.text)}</span>`;
  return `<label class="q-card"><input type="checkbox" data-question="${escapeHTML(key)}" ${state.selected.includes(key) ? 'checked' : ''} aria-label="בחירת ${escapeHTML(question.label)}"><span class="q-content"><span class="q-title-line"><span class="q-title">${escapeHTML(question.label)}</span>${badge}</span>${body}${level}</span></label>`;
}

function sheetCard(meta) {
  const key = sheetKey(meta.pdfId);
  const topicName = meta.topic || (currentTopic() ? currentTopic().title : meta.title);
  return `<label class="q-card"><input type="checkbox" data-sheet="${escapeHTML(key)}" ${state.selected.includes(key) ? 'checked' : ''} aria-label="בחירת ${escapeHTML(topicName + ' ' + meta.levelLabel)}"><span class="q-content"><span class="q-title-line"><span class="q-title">${escapeHTML(meta.levelLabel)}</span><span class="badge extra">דף</span></span><span class="q-desc" style="display:block">${escapeHTML(topicName)}</span><span class="q-page" style="display:block">הדף המלא מהמקור</span></span></label>`;
}

function render() {
  const ok = available();
  $('available-content').hidden = !ok;
  $('unavailable').hidden = ok;
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  const elementary = band() === 'elementary';
  $('result-title').textContent = ok ? (state.scenario === 'other' ? 'מרכיבים את הבחירה שלכם' : (pilotOn() ? cfg.title : cfg.label)) : 'בוחרים כיתה ונושא';
  $('result-summary').textContent = ok
    ? (pilotOn() ? cfg.summary : (elementary ? 'בחירה לפי דף, נושא ורמה. ההדפסה מציגה את עמודי המקור כמו שהם.' : 'סעיפים שכבר קיימים בדפי הנושא. אפשר לבחור מכמה דפים.'))
    : 'בוחרים כיתה ונושא מתוך הקטלוג.';
  $('rationale').textContent = ok ? (pilotOn() ? cfg.rationale : (elementary ? 'ביסודי בוחרים דף שלם לפי נושא ורמה.' : 'בחטיבה בוחרים סעיפים מתוך הדפים שכבר באתר.')) : '';
  $('pedagogy-details').textContent = ok ? (pilotOn() ? cfg.details : (elementary ? 'ההדפסה מציגה את עמודי המקור, בלי מסגרת על הכותרת.' : 'ההדפסה מסמנת על עמוד המקור, או חותכת ממנו דף מצומצם. לא מנוסח דף חדש.')) : '';
  $('style-help').textContent = STYLES[state.style].help;
  $('other-banner').hidden = state.scenario !== 'other';
  $('grade').value = String(state.grade);
  if ($('topic').value !== String(state.topic) && state.topic) $('topic').value = String(state.topic);
  document.querySelectorAll('[name=scenario]').forEach((el) => { el.checked = el.value === state.scenario; });
  document.querySelectorAll('[name=style]').forEach((el) => { el.checked = el.value === state.style; });
  document.querySelectorAll('[name=level]').forEach((el) => { el.checked = el.value === state.level; });
  const hint = $('scope-hint');
  if (hint && ok) {
    const topic = currentTopic();
    hint.textContent = elementary
      ? `${gradeRecord(state.grade).label} · ${topic.title}. בוחרים דף לפי רמה.`
      : `${gradeRecord(state.grade).label} · ${topic.title}. ${currentExercises().length} סעיפים בדפי הנושא.`;
  }
  const shortBtn = $('prepare-short');
  if (shortBtn) shortBtn.hidden = elementary;
  const prepareHint = $('prepare-hint');
  if (prepareHint) prepareHint.textContent = elementary ? 'הדף המלא מהמקור, בלי סימון.' : 'דף מלא עם סימון, או דף מצומצם שנחתך מהמקור';
  if (!ok) {
    paintSourceLine();
    syncWizardChrome();
    rememberWizard();
    return;
  }
  if (elementary) {
    let pool = state.filter === 'selected'
      ? state.selected.filter((key) => key.startsWith('sheet:')).map((key) => byPdf.get(key.slice(6))).filter(Boolean)
      : topicSheets();
    if (queryLimitsList()) pool = pool.filter((meta) => matchesQuery([meta.title, meta.topic, meta.levelLabel]));
    $('available-count').textContent = topicSheets().length + ' דפים';
    $('questions').innerHTML = pool.length
      ? pool.map(sheetCard).join('')
      : (queryLimitsList() && state.selected.length
        ? '<p class="empty">אין התאמה בחיפוש. מה שנבחר ולא מופיע כאן נשאר להדפסה.</p>'
        : '<p class="empty">אין דף ברמה הזו. אפשר לחזור ל״הכל״.</p>');
    $('show-more').hidden = true;
    $('suggestion').hidden = true;
  } else {
    let ordered = state.filter === 'selected'
      ? state.selected.map((key) => library.get(key)).filter(Boolean)
      : orderedQuestions();
    if (queryLimitsList()) ordered = ordered.filter((question) => matchesQuery([question.label, question.text, question.id]));
    const visible = shownQuestions(ordered);
    $('available-count').textContent = currentExercises().length + ' סעיפים בדפי הנושא';
    $('questions').innerHTML = visible.length
      ? visible.map(exerciseCard).join('')
      : (queryLimitsList() && state.selected.length
        ? '<p class="empty">אין התאמה בחיפוש. מה שנבחר ולא מופיע כאן נשאר להדפסה.</p>'
        : '<p class="empty">עדיין לא נבחרו שאלות. אפשר לעבור ל״כל ההצעות״ ולסמן.</p>');
    const hidden = Math.max(0, ordered.length - visible.length);
    $('show-more').hidden = hidden === 0;
    $('more-count').textContent = hidden ? String(hidden) : '';
    const suggestionId = pilotOn() && state.scenario !== 'other' ? cfg.suggestion : '';
    const suggestion = suggestionId ? library.get(exKey(FACTORING_PDF, suggestionId)) : null;
    const showSuggestion = !!(suggestion && !state.selected.includes(exKey(FACTORING_PDF, suggestionId)));
    $('suggestion').hidden = !showSuggestion;
    $('suggestion-text').textContent = showSuggestion ? `${suggestion.label}: ${cfg.suggestionText}` : '';
  }
  const hiddenBySearch = searchHiddenSelected();
  $('selection-count').textContent = state.selected.length + ' נבחרו';
  const pdfs = new Set(state.selected.map((key) => key.split(':')[1]).filter(Boolean));
  let composition = pdfs.size ? 'מתוך ' + pdfs.size + (pdfs.size === 1 ? ' דף מקור' : ' דפי מקור') : '';
  if (hiddenBySearch.length) {
    const aside = hiddenBySearch.length + ' לא מופיעים בחיפוש וייכנסו להדפסה';
    composition = composition ? aside + ' · ' + composition : aside;
  }
  $('selection-composition').textContent = composition;
  $('undo').disabled = history.length === 0;
  paintSourceLine();
  if (!elementary) paintThumbs();
  syncWizardChrome();
  rememberWizard();
}

function paintSourceLine() {
  const line = document.querySelector('.source-line');
  if (!line) return;
  const chosen = [];
  const seen = new Set();
  const pool = state.selected.length
    ? state.selected.map((key) => byPdf.get(key.split(':')[1])).filter(Boolean)
    : topicSheets();
  pool.forEach((meta) => {
    if (!meta || seen.has(meta.pdfId)) return;
    seen.add(meta.pdfId);
    chosen.push(meta);
  });
  if (!chosen.length) {
    line.hidden = true;
    return;
  }
  line.hidden = false;
  const grade = gradeRecord(state.grade);
  const topic = currentTopic();
  const levels = [...new Set(chosen.map((meta) => meta.levelLabel))].join(' · ');
  const title = `${topic ? topic.title : ''} · ${grade ? grade.label : ''} · ${levels}`;
  const links = chosen.map((meta) => `<a href="${escapeHTML(meta.pdfUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(chosen.length > 1 ? meta.levelLabel : 'פתיחת דף המקור')} ↗</a>`).join('');
  line.innerHTML = `<span>${escapeHTML(title)}</span>${links}`;
}

let thumbToken = 0;
let thumbObserver = null;

async function mapPool(items, limit, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index]);
    }
  });
  await Promise.all(workers);
}

function paintThumbs() {
  const token = ++thumbToken;
  const nodes = [...document.querySelectorAll('.q-thumb')];
  if (typeof IntersectionObserver !== 'function') {
    paintSeen(nodes, token);
    return;
  }
  if (thumbObserver) thumbObserver.disconnect();
  thumbObserver = new IntersectionObserver((entries) => {
    const seen = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
    paintSeen(seen, token);
  }, { rootMargin: '240px' });
  nodes.forEach((node) => thumbObserver.observe(node));
}

function paintSeen(nodes, token) {
  const pending = nodes.filter((node) => node.dataset.painted !== '1' && node.dataset.painting !== '1');
  pending.forEach((node) => { node.dataset.painting = '1'; });
  mapPool(pending, 4, async (node) => {
    if (token !== thumbToken) return;
    try {
      await paintThumb(node);
      if (token === thumbToken) node.dataset.painted = '1';
    } catch (error) {
      node.dataset.painting = '';
    }
  });
}

function thumbSlice(question, bitmap) {
  const row = question.row || {};
  const width = bitmap.width;
  const height = bitmap.height;
  const srcX = Math.max(0, Math.floor((row.x || 0) * width));
  const srcY = Math.max(0, Math.floor((row.y || 0) * height));
  const srcW = Math.max(1, Math.min(width - srcX, Math.ceil((row.w || 1) * width)));
  const srcH = Math.max(1, Math.min(height - srcY, Math.ceil((row.h || 0.03) * height)));
  return { srcX, srcY, srcW, srcH, page: row.page || question.page };
}

function thumbRowsOf(item) {
  if (!item) return [];
  return item.rows && item.rows.length ? item.rows : (item.row ? [item.row] : []);
}

function thumbNeighborY(question, row, bitmapHeight) {
  const page = row.page || question.page;
  let above = 0;
  let below = bitmapHeight;
  const list = question.source && question.source.questions;
  if (!list) return { above, below };
  const thisTop = Math.floor((row.y || 0) * bitmapHeight);
  const thisBot = Math.ceil(((row.y || 0) + (row.h || 0)) * bitmapHeight);
  list.forEach((other) => {
    if (!other || other === question) return;
    thumbRowsOf(other).forEach((otherRow) => {
      if ((otherRow.page || other.page) !== page) return;
      const top = Math.floor((otherRow.y || 0) * bitmapHeight);
      const bot = Math.ceil(((otherRow.y || 0) + (otherRow.h || 0)) * bitmapHeight);
      if (bot <= thisTop && bot > above) above = bot;
      if (top >= thisBot && top < below) below = top;
    });
  });
  return { above, below };
}

function thumbContent(bitmap, question, row) {
  const windowRect = thumbSlice({ row, page: row.page || question.page, line: question.line }, bitmap);
  const ctx = bitmap.getContext('2d');
  let image;
  try {
    image = ctx.getImageData(windowRect.srcX, windowRect.srcY, windowRect.srcW, windowRect.srcH);
  } catch (error) {
    return windowRect;
  }
  const data = image.data;
  const rw = windowRect.srcW;
  const rh = windowRect.srcH;
  const col = new Uint32Array(rw);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const i = (y * rw + x) * 4;
      if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) col[x] += 1;
    }
  }
  const gapX = Math.max(8, Math.round(bitmap.width * 0.03));
  const clusters = [];
  let start = -1;
  let blank = 0;
  for (let x = 0; x <= rw; x++) {
    if (x < rw && col[x]) {
      if (start < 0) start = x;
      blank = 0;
    } else if (start >= 0) {
      blank += 1;
      if (x === rw || blank > gapX) {
        const end = x - blank;
        clusters.push({ x: start, w: end - start + 1 });
        start = -1;
        blank = 0;
      }
    }
  }
  if (!clusters.length) return windowRect;
  let best = null;
  clusters.forEach((cluster) => {
    let top = -1;
    let bot = -1;
    let n = 0;
    for (let y = 0; y < rh; y++) {
      for (let x = cluster.x; x < cluster.x + cluster.w; x++) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) {
          n += 1;
          if (top < 0) top = y;
          bot = y;
        }
      }
    }
    cluster.top = top;
    cluster.bot = bot;
    cluster.n = n;
    cluster.span = bot - top;
    if (!best || cluster.span > best.span || (cluster.span === best.span && cluster.n > best.n)) best = cluster;
  });
  const lineFrac = question.line > 0 ? question.line : 0.02;
  const gapY = Math.max(4, Math.round(lineFrac * bitmap.height * 0.28));
  const minBand = Math.max(5, Math.round(bitmap.height * 0.0035));
  const bands = [];
  let bandStart = -1;
  let bandBlank = 0;
  for (let y = best.top; y <= best.bot + 1; y++) {
    let n = 0;
    if (y <= best.bot) {
      for (let x = best.x; x < best.x + best.w; x++) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) n += 1;
      }
    }
    if (n) {
      if (bandStart < 0) bandStart = y;
      bandBlank = 0;
    } else if (bandStart >= 0) {
      bandBlank += 1;
      if (y > best.bot || bandBlank > gapY) {
        const end = y - bandBlank;
        bands.push({ y: bandStart, h: end - bandStart + 1 });
        bandStart = -1;
        bandBlank = 0;
      }
    }
  }
  const tall = bands.filter((band) => band.h >= minBand);
  const kept = tall.length ? bands.filter((band) => band.h >= minBand || tall.some((item) => Math.abs(band.y - (item.y + item.h)) < gapY || Math.abs(item.y - (band.y + band.h)) < gapY)) : [bands.reduce((bestBand, band) => (band.h > bestBand.h ? band : bestBand))];
  if (!kept.length) return windowRect;
  let top = kept[0].y;
  let bot = kept[0].y + kept[0].h;
  kept.forEach((band) => {
    top = Math.min(top, band.y);
    bot = Math.max(bot, band.y + band.h);
  });
  const rowStats = [];
  for (let y = top; y < bot; y++) {
    let n = 0;
    let rowLeft = best.x + best.w;
    let rowRight = best.x - 1;
    for (let x = best.x; x < best.x + best.w; x++) {
      const i = (y * rw + x) * 4;
      if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) {
        n += 1;
        if (x < rowLeft) rowLeft = x;
        if (x > rowRight) rowRight = x;
      }
    }
    if (n) rowStats.push({ left: rowLeft, right: rowRight, span: rowRight - rowLeft + 1 });
  }
  const spans = rowStats.map((row) => row.span).sort((a, b) => a - b);
  const median = spans.length ? spans[Math.floor(spans.length / 2)] : 0;
  const contentRows = rowStats.filter((row) => row.span <= median * 1.5 + 12);
  const usedRows = contentRows.length ? contentRows : rowStats;
  let left = best.x + best.w;
  let right = best.x;
  usedRows.forEach((row) => {
    if (row.left < left) left = row.left;
    if (row.right > right) right = row.right;
  });
  if (right < left) return windowRect;
  const line = question.line > 0 ? question.line : 0.02;
  const pad = Math.max(3, Math.min(10, Math.round(line * bitmap.height * 0.18)));
  const limits = thumbNeighborY(question, row, bitmap.height);
  const srcX = Math.max(0, windowRect.srcX + left - pad);
  const srcY = Math.max(limits.above, windowRect.srcY + top - pad);
  const srcX2 = Math.min(bitmap.width, windowRect.srcX + right + 1 + pad);
  const srcY2 = Math.min(limits.below, windowRect.srcY + bot + pad);
  return { srcX, srcY, srcW: Math.max(1, srcX2 - srcX), srcH: Math.max(1, srcY2 - srcY), page: windowRect.page };
}

async function paintThumb(canvas) {
  const question = library.get(canvas.dataset.thumb);
  if (!question || !question.row || !levelAllows(question.source)) return;
  const rows = questionRows(question);
  const pieces = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const bitmap = await pageBitmap(row.page || question.page, question.source);
    const slice = thumbContent(bitmap, question, row);
    if (slice && slice.srcW > 2 && slice.srcH > 2) pieces.push({ bitmap, slice });
  }
  if (!pieces.length) return;
  const card = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  const cardW = Math.max(180, Math.min(card || 320, 520));
  const edge = 8;
  const gutter = 6;
  const maxH = 180;
  let scale = cardW - edge * 2;
  pieces.forEach((piece) => { scale = Math.min(scale, (cardW - edge * 2) / piece.slice.srcW); });
  let body = pieces.reduce((sum, piece) => sum + piece.slice.srcH * scale, 0);
  const gaps = gutter * Math.max(0, pieces.length - 1);
  if (body + gaps + edge * 2 > maxH) scale *= (maxH - gaps - edge * 2) / body;
  const dpr = window.devicePixelRatio || 1;
  let dh = edge * 2 + gaps;
  const drawn = pieces.map((piece) => {
    const sw = Math.max(1, Math.round(piece.slice.srcW * scale));
    const sh = Math.max(1, Math.round(piece.slice.srcH * scale));
    return { piece, sw, sh };
  });
  drawn.forEach((item) => { dh += item.sh; });
  const usedW = drawn.reduce((max, item) => Math.max(max, item.sw), 1) + edge * 2;
  const dw = Math.max(1, Math.min(cardW, Math.round(usedW)));
  canvas.width = Math.max(1, Math.round(dw * dpr));
  canvas.height = Math.max(1, Math.round(dh * dpr));
  canvas.style.width = dw + 'px';
  canvas.style.height = dh + 'px';
  canvas.style.maxWidth = '100%';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dw, dh);
  let y = edge;
  drawn.forEach((item, index) => {
    if (index) y += gutter;
    const x = Math.max(edge, Math.round((dw - item.sw) / 2));
    ctx.drawImage(item.piece.bitmap, item.piece.slice.srcX, item.piece.slice.srcY, item.piece.slice.srcW, item.piece.slice.srcH, x, y, item.sw, item.sh);
    y += item.sh;
  });
}

function levelAllows(source) {
  if (!source) return true;
  if (state.level === 'all') return true;
  return !source.level || source.level === state.level;
}

function clearPreparedPrint() {
  const area = $('print-area');
  if (!area || area.querySelector('.print-unprepared')) return;
  area.innerHTML = PRINT_UNPREPARED;
}

function selectionChipLabel(key) {
  const question = library.get(key);
  if (question && question.label) return question.label;
  if (String(key).startsWith('sheet:')) {
    const meta = byPdf.get(String(key).slice(6));
    if (meta) return meta.levelLabel || meta.title || key;
  }
  return String(key);
}

let searchHiddenCache = [];
let searchHiddenKey = '';

function searchHiddenSelected() {
  const key = [queryText(), state.selected.join('\n'), state.grade, state.topic, state.level, sheets.size, catalogReady ? 1 : 0].join('\u0001');
  if (key === searchHiddenKey) return searchHiddenCache;
  searchHiddenKey = key;
  if (!queryLimitsList()) {
    searchHiddenCache = [];
    return searchHiddenCache;
  }
  const shown = new Set();
  if (band() === 'elementary') {
    topicSheets().forEach((meta) => {
      if (matchesQuery([meta.title, meta.topic, meta.levelLabel])) shown.add(sheetKey(meta.pdfId));
    });
  } else {
    currentExercises().forEach((question) => {
      if (matchesQuery([question.label, question.text, question.id])) shown.add(exKey(question.source.pdfId, question.id));
    });
  }
  searchHiddenCache = state.selected.filter((item) => !shown.has(item));
  return searchHiddenCache;
}

function paintSearchKept() {
  const box = $('fast-selected');
  if (!box) return;
  const hidden = searchHiddenSelected();
  const stamp = hidden.map((item) => item + '\t' + selectionChipLabel(item)).join('\n');
  if (box.dataset.stamp === stamp) return;
  box.dataset.stamp = stamp;
  if (!hidden.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `<p>${hidden.length} נבחרו ולא מופיעים בחיפוש. הם ייכנסו להדפסה.</p><div class="fast-selected-row">${hidden.map((item) => {
    const label = selectionChipLabel(item);
    return `<button type="button" data-keep-key="${escapeHTML(item)}" aria-label="הסרת ${escapeHTML(label)} מההדפסה">${escapeHTML(label)}<span class="chip-x">×</span></button>`;
  }).join('')}</div>`;
}

function selectKey(key, on) {
  if (!key) return;
  const before = selectionKey();
  snapshot();
  if (on && !state.selected.includes(key)) state.selected.push(key);
  if (!on) state.selected = state.selected.filter((item) => item !== key);
  if (selectionKey() !== before) clearPreparedPrint();
  render();
}

async function loadPdf(source) {
  const active = source || SOURCE;
  if (!active || !active.pdfUrl) throw new Error('PDF_LIB');
  if (pdfDocs.has(active.pdfId)) return pdfDocs.get(active.pdfId);
  if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') throw new Error('PDF_LIB');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await window.pdfjsLib.getDocument({ url: active.pdfUrl || SOURCE.pdfUrl, withCredentials: false, isEvalSupported: false }).promise;
  pdfDocs.set(active.pdfId, doc);
  return doc;
}

function teacherNoteHTML(note) {
  const text = String(note || '').trim();
  if (!text) return '';
  return `<aside class="teacher-print-note" dir="rtl"><strong>הערת המורה</strong><p>${escapeHTML(text)}</p></aside>`;
}

async function noteBandMm(note) {
  const text = String(note || '').trim();
  if (!text) return 0;
  if (document.fonts && document.fonts.load) {
    try {
      await document.fonts.load('11px Heebo');
      await document.fonts.load('12px Heebo');
    } catch (error) {}
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;inset-inline-start:0;top:0;visibility:hidden;box-sizing:border-box;width:180mm;font:11px/1.35 Heebo,Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;direction:rtl';
  probe.innerHTML = `<strong style="display:block;font-size:12px;margin:0 0 1mm">הערת המורה</strong><p style="margin:0">${escapeHTML(text)}</p>`;
  document.body.appendChild(probe);
  const mm = probe.getBoundingClientRect().height * 25.4 / 96;
  probe.remove();
  return Math.min(78, Math.ceil(mm + 4));
}

async function attachTeacherNote(root, note) {
  const html = teacherNoteHTML(note);
  if (!html) return;
  const sheet = root.querySelector('.crop-sheet:last-of-type') || root.querySelector('.source-sheet:last-of-type');
  if (!sheet) return;
  sheet.classList.add('has-teacher-note');
  sheet.style.setProperty('--note-h', (await noteBandMm(note)) + 'mm');
  sheet.insertAdjacentHTML('beforeend', html);
}

function sheetHTML(pageNumber, questions) {
  const marked = questions.filter((question) => question.box);
  const marks = marked.map((question) => {
    const box = question.box;
    return `<span class="source-mark" data-question="${escapeHTML(question.id)}" style="left:${box.x * 100}%;top:${box.y * 100}%;width:${box.w * 100}%;height:${box.h * 100}%" title="${escapeHTML(question.label)}"></span>`;
  }).join('');
  const names = marked.map((question) => question.label).join(' · ');
  const caption = names
    ? `עמוד ${pageNumber} מתוך ${SOURCE.pageCount} · ${SOURCE.title} · מסומנים: ${names}`
    : `עמוד ${pageNumber} מתוך ${SOURCE.pageCount} · ${SOURCE.title}`;
  return `<figure class="source-sheet"><div class="source-stage" data-pdf="${escapeHTML(SOURCE.pdfId)}" data-page="${pageNumber}"><canvas></canvas>${marks}</div><figcaption>${escapeHTML(caption)}</figcaption></figure>`;
}

function bakeMarks(canvas, stage) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  stage.querySelectorAll('.source-mark').forEach((mark) => {
    const x = (parseFloat(mark.style.left) / 100) * width;
    const y = (parseFloat(mark.style.top) / 100) * height;
    const w = (parseFloat(mark.style.width) / 100) * width;
    const h = (parseFloat(mark.style.height) / 100) * height;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(255,214,90,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#c47d00';
    ctx.lineWidth = Math.max(2, width * 0.0025);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  });
}

async function paintSheets(root, bake) {
  const stages = root.querySelectorAll('.source-stage');
  for (const stage of stages) {
    const source = sheets.get(stage.dataset.pdf) || SOURCE;
    const pdf = await loadPdf(source);
    const pageNumber = Number(stage.dataset.page);
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1100 / base.width });
    const canvas = stage.querySelector('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (bake) bakeMarks(canvas, stage);
  }
}

async function pageBitmap(pageNumber, source) {
  const active = source || SOURCE;
  const key = active.pdfId + ':' + pageNumber;
  if (pageBitmaps.has(key)) return pageBitmaps.get(key);
  const pdf = await loadPdf(active);
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1100 / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  pageBitmaps.set(key, canvas);
  return canvas;
}

function boxEnd(box) {
  return box.y + box.h;
}

function previousQuestionRow(slices, block, page) {
  for (let index = slices.length - 1; index >= 0; index -= 1) {
    const slice = slices[index];
    if (slice.kind !== 'row') continue;
    if (slice.block === block && slice.page === page) return slice;
    return null;
  }
  return null;
}

function questionRows(item) {
  if (!item) return [];
  return item.rows && item.rows.length ? item.rows : (item.row ? [item.row] : []);
}

function absoluteMask(box) {
  if (!box || !box.mask || !(box.h > 0)) return null;
  return {
    x: box.mask.x,
    w: box.mask.w,
    y: box.y + box.mask.y * box.h,
    y2: box.y + (box.mask.y + box.mask.h) * box.h,
  };
}

function withSpan(box, y, end, masks) {
  const height = Math.max(0.004, end - y);
  const next = { ...box, y, h: height };
  let best = null;
  (masks || []).forEach((mask) => {
    if (!mask) return;
    const top = Math.max(mask.y, y);
    const bot = Math.min(mask.y2, y + height);
    const span = bot - top;
    if (span < 0.0015) return;
    if (!best || span > best.span) best = { mask, top, bot, span };
  });
  if (!best) {
    delete next.mask;
    return next;
  }
  next.mask = {
    x: best.mask.x,
    w: best.mask.w,
    y: (best.top - y) / height,
    h: (best.bot - best.top) / height,
  };
  return next;
}

/**
 * A right-column mask is stored on the figure's right edge, which is the
 * wall stroke itself. Move it just past that stroke so the line stays.
 */
function clearDrawingStroke(question, box) {
  if (!box || !box.mask) return box;
  const page = box.page || question.page;
  const figures = [];
  (SOURCE.questions || []).forEach((item) => {
    if (item && item.q === question.q && item.figure && item.page === page) figures.push(item.figure);
  });
  let mask = box.mask;
  figures.forEach((figure) => {
    if (Math.abs(mask.x - figure.x1) < 0.01 && mask.w > 0.15) {
      const shift = 0.008;
      mask = { ...mask, x: mask.x + shift, w: Math.max(0.05, mask.w - shift) };
    }
  });
  return mask === box.mask ? box : { ...box, mask };
}

/**
 * A part printed alone still includes the whole shared drawing: an earlier
 * overlapping crop, or a figure whose top sits above this part (the house roof).
 * The crop starts on a white row, so a label beside the roof is not cut in half.
 * A drawing that sticks a little past the next label stays, and that label is masked.
 */
function coverSharedFigure(question, box, laterSelected) {
  const page = box.page || question.page;
  const originalEnd = boxEnd(box);
  let top = box.y;
  let end = originalEnd;
  const masks = [];
  const ownMask = absoluteMask(box);
  if (ownMask) masks.push(ownMask);
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q || item.id === question.id) return;
    questionRows(item).forEach((other) => {
      if (!other || (other.page || item.page) !== page) return;
      const otherEnd = boxEnd(other);
      if (other.y < top - 0.003 && otherEnd > top + 0.003) {
        top = Math.min(top, other.y);
        end = Math.max(end, otherEnd);
      }
      const mask = absoluteMask(other);
      if (mask) masks.push(mask);
    });
    const figure = item.figure;
    if (!figure || item.page !== page) return;
    const covers = figure.y1 > box.y + 0.003 && figure.y0 < originalEnd - 0.003;
    if (!covers) return;
    if (figure.y0 < top - 0.003) top = figure.y0;
    if (!laterSelected && figure.y1 > end - 0.003 && item.row) end = Math.max(end, boxEnd(item.row));
  });
  const ownFigure = question.figure;
  if (ownFigure && question.page === page && ownFigure.y1 > box.y + 0.003 && ownFigure.y0 < originalEnd + 0.02) {
    if (ownFigure.y0 < top - 0.003) top = ownFigure.y0;
  }
  // figure.y0 can sit halfway through the first part's label. Start on that part's white row.
  let lineTop = top;
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q) return;
    questionRows(item).forEach((other) => {
      if (!other || (other.page || item.page) !== page) return;
      if (other.y < top - 0.0004 && boxEnd(other) > top + 0.001) lineTop = Math.min(lineTop, other.y);
    });
  });
  top = lineTop;
  if (end > originalEnd + 0.0005) {
    let nextTop = null;
    (SOURCE.questions || []).forEach((item) => {
      if (!item || item.q !== question.q || item.id === question.id || !item.row) return;
      if ((item.row.page || item.page) !== page) return;
      if (item.row.y >= originalEnd - 0.004 && (nextTop == null || item.row.y < nextTop)) nextTop = item.row.y;
    });
    // A small step past the next label is the rest of the drawing, plus that label's text.
    if (nextTop != null && end > nextTop - 0.001 && end - nextTop < 0.008) {
      masks.push({ x: 0.45, w: 0.55, y: nextTop, y2: Math.max(end, nextTop + 0.004) });
    }
  }
  if (Math.abs(top - box.y) < 0.0001 && Math.abs(end - originalEnd) < 0.0001 && masks.length === (ownMask ? 1 : 0)) return box;
  return withSpan({ ...box, page }, top, end, masks);
}

function shortSlices(chosen) {
  const ordered = chosen.slice().sort((a, b) => (
    a.page - b.page || SOURCE.questions.indexOf(a) - SOURCE.questions.indexOf(b)
  ));
  const slices = [{ page: SOURCE.headerCrop.page, box: SOURCE.headerCrop, gap: 14, block: 'header', kind: 'header' }];
  let lastQuestion = null;
  ordered.forEach((question) => {
    const block = 'q' + question.q;
    if (question.q !== lastQuestion) {
      if (question.stem) slices.push({ page: question.stem.page || question.page, box: question.stem, gap: 10, block, kind: 'stem' });
      lastQuestion = question.q;
    }
    const rows = question.rows && question.rows.length ? question.rows : [question.row];
    rows.forEach((box) => {
      const page = box.page || question.page;
      let next = { ...box, page };
      const prev = previousQuestionRow(slices, block, page);
      const laterSelected = ordered.some((other) => (
        other !== question && other.q === question.q && other.row
        && (other.row.page || other.page) === page && other.row.y > box.y + 0.004
      ));
      // The first selected part of this question can still own a shared drawing.
      if (!prev) next = coverSharedFigure(question, next, laterSelected);
      if (prev && next.y < boxEnd(prev.box) - 0.003) {
        const prevEnd = boxEnd(prev.box);
        // Fully covered by the previous part: printing it again repeats its text.
        if (boxEnd(next) <= prevEnd + 0.004) return;
        const height = boxEnd(next) - prevEnd;
        if (height < 0.004) return;
        next = { ...next, y: prevEnd, h: height };
      }
      const last = slices[slices.length - 1];
      const dup = last && last.kind === 'row' && last.page === page && last.box.x === next.x && last.box.y === next.y && last.box.w === next.w && last.box.h === next.h;
      // Abutting rows overlap by 2px so the join is not a white seam.
      const gap = prev && next.y <= boxEnd(prev.box) + 0.006 ? -2 : 4;
      if (!dup) slices.push({ page, box: clearDrawingStroke(question, next), gap, block, kind: 'row' });
    });
  });
  slices.push({ page: SOURCE.footerCrop.page, box: SOURCE.footerCrop, gap: 16, block: 'footer', kind: 'footer' });
  return slices;
}

function contentHeight(items) {
  return items.reduce((sum, item, index) => sum + (index ? item.slice.gap : 0) + item.dh, 0);
}

function scaledGap(gap, factor) {
  const next = Math.round(gap * factor);
  // A negative gap is the 2px overlap that hides the seam; scaling must not turn it into a gap.
  return gap < 0 ? Math.min(-1, next) : Math.max(1, next);
}

function shrinkTo(items, limit) {
  const height = contentHeight(items);
  if (height <= limit) return items;
  const factor = limit / height;
  const scaled = items.map((item) => ({
    ...item,
    dh: Math.max(1, Math.round(item.dh * factor)),
    slice: { ...item.slice, gap: scaledGap(item.slice.gap, factor) },
  }));
  const extra = contentHeight(scaled) - limit;
  if (extra > 0) scaled[scaled.length - 1].dh = Math.max(1, scaled[scaled.length - 1].dh - extra);
  return scaled;
}

function splitQuestion(items, limit) {
  const stem = items.filter((item) => item.slice.kind === 'stem');
  const rows = items.filter((item) => item.slice.kind === 'row');
  if (rows.length < 2) return [shrinkTo(items, limit)];
  const chunks = [];
  let current = [];
  rows.forEach((row) => {
    const trial = stem.concat(current, [row]);
    if (current.length >= 2 && contentHeight(trial) > limit) {
      chunks.push(stem.concat(current));
      current = [row];
    } else {
      current.push(row);
    }
  });
  if (current.length === 1 && chunks.length) chunks[chunks.length - 1].push(current[0]);
  else if (current.length) chunks.push(stem.concat(current));
  return chunks.map((chunk) => (contentHeight(chunk) > limit ? shrinkTo(chunk, limit) : chunk));
}

function packShort(measured) {
  const PAGE_H = 1440;
  if (contentHeight(measured) <= PAGE_H || PAGE_H / contentHeight(measured) >= 0.85) {
    return [shrinkTo(measured, PAGE_H)];
  }
  const blocks = [];
  measured.forEach((item) => {
    if (item.slice.block === 'footer') return;
    const last = blocks[blocks.length - 1];
    if (last && last.id === item.slice.block) last.items.push(item);
    else blocks.push({ id: item.slice.block, items: [item] });
  });
  const pages = [];
  let page = [];
  blocks.forEach((block) => {
    const parts = contentHeight(block.items) > PAGE_H ? splitQuestion(block.items, PAGE_H) : [block.items];
    parts.forEach((part) => {
      if (page.length && contentHeight(page.concat(part)) > PAGE_H) {
        pages.push(page);
        page = [];
      }
      page = page.concat(part);
    });
  });
  if (page.length) pages.push(page);
  const footer = measured.filter((item) => item.slice.block === 'footer');
  if (!pages.length) pages.push([]);
  pages[pages.length - 1] = shrinkTo(pages[pages.length - 1].concat(footer), PAGE_H);
  return pages;
}

async function paintShort(root, slices) {
  const OUT_W = 1000;
  const measured = [];
  for (const slice of slices) {
    const bitmap = await pageBitmap(slice.page);
    const sw = slice.box.w * bitmap.width;
    const sh = slice.box.h * bitmap.height;
    measured.push({ slice, bitmap, sw, sh, dh: Math.max(1, Math.round(OUT_W * sh / sw)) });
  }
  const packs = packShort(measured);
  root.innerHTML = packs.map((_, index) => (
    `<figure class="crop-sheet"><canvas></canvas><figcaption>דף מצומצם ${index + 1} מתוך ${packs.length} · ${escapeHTML(SOURCE.title)}</figcaption></figure>`
  )).join('');
  const canvases = root.querySelectorAll('canvas');
  packs.forEach((items, index) => {
    let height = 0;
    items.forEach((item, itemIndex) => { height += (itemIndex ? item.slice.gap : 0) + item.dh; });
    const canvas = canvases[index];
    canvas.width = OUT_W;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT_W, height);
    let y = 0;
    items.forEach((item, itemIndex) => {
      if (itemIndex) y += item.slice.gap;
      const sx = item.slice.box.x * item.bitmap.width;
      const sy = item.slice.box.y * item.bitmap.height;
      ctx.drawImage(item.bitmap, sx, sy, item.sw, item.sh, 0, y, OUT_W, item.dh);
      const mask = item.slice.box.mask;
      if (mask) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(mask.x * OUT_W, y + mask.y * item.dh, mask.w * OUT_W, mask.h * item.dh);
      }
      y += item.dh;
    });
  });
}

function worksheetOrder(chosen) {
  const PART_ORDER = { '': 0, 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9 };
  const LEVEL_ORDER = { a: 0, b: 1, c: 2, one: 3 };
  return chosen.slice().sort((a, b) => {
    const levelA = LEVEL_ORDER[a.source && a.source.level] ?? 9;
    const levelB = LEVEL_ORDER[b.source && b.source.level] ?? 9;
    const partA = PART_ORDER[a.part || ''] ?? 20;
    const partB = PART_ORDER[b.part || ''] ?? 20;
    return levelA - levelB || (Number(a.q) || 0) - (Number(b.q) || 0) || partA - partB || String(a.id || '').localeCompare(String(b.id || ''), 'he');
  });
}

function answerBox(items, questionNumber, part) {
  const marker = items.find((item) => String(item.str || '').trim() === '(' + questionNumber + ')');
  if (!marker) return null;
  const sameSheet = (item) => item.page == null || marker.page == null || item.page === marker.page;
  const next = items
    .filter((item) => sameSheet(item) && /^\(\d+\)$/.test(String(item.str || '').trim()) && item.y < marker.y - 4)
    .sort((a, b) => b.y - a.y)[0];
  const bandTop = marker.y + 8;
  const bandBottom = next ? next.y + 8 : marker.y - 40;
  const labels = items
    .filter((item) => sameSheet(item) && /^[אבגדהו]\.$/.test(String(item.str || '').trim()) && item.y <= bandTop && item.y >= bandBottom)
    .sort((a, b) => b.y - a.y || b.x - a.x);
  let left = 28;
  let right = marker.x - 4;
  let top = marker.y + 16;
  let bottom = next ? next.y + 8 : marker.y - 16;
  if (part) {
    const index = labels.findIndex((item) => String(item.str).trim().startsWith(part));
    if (index < 0) return null;
    const label = labels[index];
    const follower = labels[index + 1];
    const nextOnLine = follower && Math.abs(follower.y - label.y) <= 6 ? follower : null;
    right = label.x - 1;
    left = nextOnLine ? nextOnLine.x + Math.max(nextOnLine.w || 0, 8) + 2 : 28;
    top = label.y + 16;
    if (nextOnLine) bottom = label.y - 12;
    else if (follower) bottom = follower.y + 12;
    else bottom = next ? Math.max(next.y + 8, label.y - 30) : label.y - 14;
  }
  if (top - bottom < 8) return null;
  const glyphs = items.filter((item) => (
    sameSheet(item)
    && item.y <= top
    && item.y >= bottom - 2
    && item.x >= left - 1
    && item.x < right
    && !/^[אבגדהו]\.$/.test(String(item.str || '').trim())
    && !/^\(\d+\)$/.test(String(item.str || '').trim())
  ));
  if (!glyphs.length) return null;
  const glyphLeft = Math.min.apply(null, glyphs.map((item) => item.x)) - 3;
  const glyphRight = Math.max.apply(null, glyphs.map((item) => item.x + Math.max(item.w || 0, 4))) + 3;
  const glyphTop = Math.max.apply(null, glyphs.map((item) => item.y + Math.max(item.h || 8, 8))) + 2;
  const glyphBottom = Math.min.apply(null, glyphs.map((item) => item.y)) - 3;
  left = Math.max(left, glyphLeft);
  right = Math.min(right, glyphRight);
  top = Math.min(top, glyphTop);
  bottom = Math.max(bottom, glyphBottom);
  if (right - left < 6) return null;
  return { page: marker.page, x: left, y: bottom, w: right - left, h: top - bottom };
}

function exerciseSlices(chosen) {
  const ordered = worksheetOrder(chosen);
  const groups = [];
  ordered.forEach((question) => {
    const source = question.source;
    const last = groups[groups.length - 1];
    if (last && source && last.source.pdfId === source.pdfId) last.questions.push(question);
    else groups.push({ source, questions: [question] });
  });
  const saved = SOURCE;
  const slices = [];
  try {
    groups.forEach((entry, index) => {
      if (groups.length > 1 && entry.source && entry.source.levelLabel) {
        slices.push({ kind: 'level', text: entry.source.levelLabel, gap: index ? 18 : 8, block: 'level-' + entry.source.pdfId, source: entry.source });
      }
      SOURCE = entry.source;
      shortSlices(entry.questions).forEach((slice) => {
        if (slice.kind === 'header' || slice.kind === 'footer') return;
        slices.push({ ...slice, source: entry.source });
      });
    });
  } finally {
    SOURCE = saved;
  }
  return slices;
}

async function answerPages(source) {
  const pdf = await loadPdf(source);
  const found = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const text = await page.getTextContent();
    const items = text.items.filter((item) => item.str && String(item.str).trim()).map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      w: item.width || 0,
      h: item.height || 0,
      page: number,
    }));
    if (!items.some((item) => item.str.includes('תשובות סופיות'))) continue;
    const viewport = page.getViewport({ scale: 1 });
    found.push({ page: number, width: viewport.width, height: viewport.height, items });
  }
  return found;
}

function answerSliceFor(pages, question) {
  const part = question.part || '';
  for (let index = 0; index < pages.length; index += 1) {
    const sheet = pages[index];
    const box = answerBox(sheet.items, question.q, part);
    if (!box || box.page !== sheet.page) continue;
    const pad = 2;
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    const w = Math.min(sheet.width - x, box.w + pad * 2);
    const h = Math.min(sheet.height - y, box.h + pad * 2);
    return {
      page: sheet.page,
      box: {
        x: x / sheet.width,
        y: (sheet.height - y - h) / sheet.height,
        w: w / sheet.width,
        h: h / sheet.height,
      },
    };
  }
  return null;
}

async function answerSlices(chosen) {
  const ordered = worksheetOrder(chosen);
  const slices = [{ kind: 'answers-head', text: 'תשובות', gap: 20, block: 'answers' }];
  const missing = [];
  const cache = new Map();
  for (let index = 0; index < ordered.length; index += 1) {
    const question = ordered[index];
    const source = question.source;
    const label = (source && source.levelLabel ? source.levelLabel + ' · ' : '') + (question.label || ('שאלה ' + question.q));
    let pages = source ? cache.get(source.pdfId) : [];
    if (source && !cache.has(source.pdfId)) {
      pages = await answerPages(source);
      cache.set(source.pdfId, pages);
    }
    const found = pages && pages.length ? answerSliceFor(pages, question) : null;
    if (!found) {
      missing.push(label);
      slices.push({ kind: 'missing', text: label + ' — אין תשובה במקור', gap: 6, block: 'answers', source });
    } else {
      slices.push({ kind: 'answer', text: label, page: found.page, box: found.box, gap: 8, block: 'answers', source });
    }
  }
  return { slices, missing };
}

function groupsOf(chosen) {
  const groups = [];
  chosen.forEach((question) => {
    const source = question.source;
    if (!source) return;
    const last = groups[groups.length - 1];
    if (last && last.source.pdfId === source.pdfId) last.questions.push(question);
    else groups.push({ source, questions: [question] });
  });
  return groups;
}

async function paintGroupedShort(root, chosen) {
  const holder = document.createElement('div');
  const saved = SOURCE;
  try {
    for (const group of groupsOf(chosen)) {
      SOURCE = group.source;
      const part = document.createElement('div');
      await paintShort(part, shortSlices(group.questions));
      while (part.firstChild) holder.appendChild(part.firstChild);
    }
  } finally {
    SOURCE = saved;
  }
  root.replaceChildren(...holder.childNodes);
}

function sheetTitle(chosen) {
  const topics = [];
  const levels = [];
  chosen.forEach((question) => {
    const source = question.source;
    if (!source) return;
    const topic = source.topic || '';
    if (topic && topics.indexOf(topic) < 0) topics.push(topic);
    if (source.levelLabel && levels.indexOf(source.levelLabel) < 0) levels.push(source.levelLabel);
  });
  const topic = topics.join(' · ') || 'דף תרגול';
  if (levels.length === 1) return topic + ' · ' + levels[0];
  return topic;
}

async function measureWorksheet(slices) {
  const OUT_W = 1000;
  const measured = [];
  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index];
    if (slice.kind === 'level' || slice.kind === 'answers-head') {
      measured.push({ slice, dh: 34 });
    } else if (slice.kind === 'missing') {
      measured.push({ slice, dh: 26 });
    } else if (slice.kind === 'answer' || slice.kind === 'row' || slice.kind === 'stem') {
      const bitmap = await pageBitmap(slice.page, slice.source);
      const sw = slice.box.w * bitmap.width;
      const sh = slice.box.h * bitmap.height;
      const imageH = Math.max(1, Math.round(OUT_W * sh / sw));
      if (slice.kind === 'answer') {
        const naturalW = Math.max(1, OUT_W * slice.box.w);
        const naturalH = Math.max(1, naturalW * sh / sw);
        const maxW = OUT_W - 56;
        let scale = 72 / naturalH;
        if (naturalW * scale > maxW) scale = maxW / naturalW;
        scale = Math.max(1, scale);
        const dw = Math.max(48, Math.round(naturalW * scale));
        const dh = Math.round(naturalH * scale) + 24;
        measured.push({ slice, bitmap, sw, sh, dw, dh });
      } else {
        measured.push({ slice, bitmap, sw, sh, dh: imageH });
      }
    }
  }
  return measured;
}

function packWorksheet(measured) {
  const PAGE_H = 1440;
  const FOOT = 36;
  const FIRST_TOP = 118;
  const CONT_TOP = 48;
  const heading = (item) => item && (item.slice.kind === 'stem' || item.slice.kind === 'level' || item.slice.kind === 'answers-head');
  const heightOf = (items, top) => top + FOOT + contentHeight(items);
  const pages = [];
  let page = [];
  let top = FIRST_TOP;
  measured.forEach((item) => {
    const body = PAGE_H - top - FOOT;
    let next = item;
    if (next.dh > body && !page.length) {
      const factor = body / next.dh;
      next = { ...next, dh: Math.max(1, Math.round(next.dh * factor)), slice: { ...next.slice, gap: scaledGap(next.slice.gap, factor) } };
    }
    if (page.length && heightOf(page.concat([next]), top) > PAGE_H) {
      const last = page[page.length - 1];
      if (heading(last)) page.pop();
      if (page.length) pages.push({ top, items: page });
      page = heading(last) && last !== next ? [last] : [];
      top = CONT_TOP;
      const room = PAGE_H - top - FOOT;
      if (next.dh > room) {
        const factor = room / next.dh;
        next = { ...next, dh: Math.max(1, Math.round(next.dh * factor)), slice: { ...next.slice, gap: scaledGap(next.slice.gap, factor) } };
      }
    }
    page.push(next);
  });
  if (page.length) pages.push({ top, items: page });
  if (!pages.length) pages.push({ top: FIRST_TOP, items: [] });
  return pages;
}

function paintWorksheetPage(canvas, page, index, count, title) {
  const OUT_W = 1000;
  const PAGE_H = 1440;
  canvas.width = OUT_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, OUT_W, PAGE_H);
  ctx.fillStyle = '#1a2744';
  ctx.direction = 'rtl';
  ctx.font = '700 22px Heebo, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('בס״ד', OUT_W - 28, 32);
  if (index === 0) {
    ctx.font = '700 28px Heebo, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, OUT_W / 2, 70);
    ctx.font = '18px Heebo, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('שם ______________    כיתה ________    תאריך __________', OUT_W - 28, 104);
  }
  let y = page.top;
  page.items.forEach((item, itemIndex) => {
    if (itemIndex) y += item.slice.gap;
    const kind = item.slice.kind;
    if (kind === 'level' || kind === 'answers-head') {
      ctx.fillStyle = '#1a2744';
      ctx.font = kind === 'answers-head' ? '700 24px Heebo, Arial, sans-serif' : '700 18px Heebo, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText(item.slice.text, OUT_W - 28, y + (kind === 'answers-head' ? 26 : 24));
    } else if (kind === 'missing') {
      ctx.fillStyle = '#1a2744';
      ctx.font = '16px Heebo, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText(item.slice.text, OUT_W - 28, y + 18);
    } else if (kind === 'answer') {
      ctx.fillStyle = '#1a2744';
      ctx.font = '15px Heebo, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText(item.slice.text, OUT_W - 28, y + 16);
      const imageY = y + 22;
      const imageH = item.dh - 22;
      const imageW = item.dw || Math.min(OUT_W - 56, imageH * item.sw / item.sh);
      const sx = item.slice.box.x * item.bitmap.width;
      const sy = item.slice.box.y * item.bitmap.height;
      ctx.drawImage(item.bitmap, sx, sy, item.sw, item.sh, OUT_W - 28 - imageW, imageY, imageW, imageH);
    } else {
      const sx = item.slice.box.x * item.bitmap.width;
      const sy = item.slice.box.y * item.bitmap.height;
      ctx.drawImage(item.bitmap, sx, sy, item.sw, item.sh, 0, y, OUT_W, item.dh);
      const mask = item.slice.box.mask;
      if (mask) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(mask.x * OUT_W, y + mask.y * item.dh, mask.w * OUT_W, mask.h * item.dh);
      }
    }
    y += item.dh;
  });
  ctx.strokeStyle = '#d5dae5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, PAGE_H - 28);
  ctx.lineTo(OUT_W - 28, PAGE_H - 28);
  ctx.stroke();
  ctx.fillStyle = '#1a2744';
  ctx.font = '14px Heebo, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText('עמוד ' + (index + 1) + ' מתוך ' + count, OUT_W / 2, PAGE_H - 12);
}

async function paintWorksheet(root, chosen) {
  if (document.fonts && document.fonts.load) {
    try {
      await document.fonts.load('700 28px Heebo');
      await document.fonts.load('18px Heebo');
      await document.fonts.load('16px Heebo');
    } catch (error) {}
  }
  const exercises = exerciseSlices(chosen);
  const answers = await answerSlices(chosen);
  const measured = await measureWorksheet(exercises.concat(answers.slices));
  const pages = packWorksheet(measured);
  const title = sheetTitle(chosen);
  root.dataset.missingAnswers = answers.missing.join(' | ');
  root.innerHTML = pages.map((_, index) => (
    `<figure class="crop-sheet"><canvas></canvas><figcaption>דף מצומצם ${index + 1} מתוך ${pages.length}</figcaption></figure>`
  )).join('');
  const canvases = root.querySelectorAll('canvas');
  pages.forEach((page, index) => paintWorksheetPage(canvases[index], page, index, pages.length, title));
}

async function paintAllShort(root, chosen) {
  if (chosen.length && chosen.every((question) => question.source && question.source.mode === 'sheet')) {
    await paintGroupedShort(root, chosen);
    return;
  }
  await paintWorksheet(root, chosen.filter((question) => !question.source || question.source.mode !== 'sheet'));
}

function markedHTML(chosen) {
  return groupsOf(chosen).map((group) => {
    SOURCE = group.source;
    const byPage = new Map();
    group.questions.forEach((question) => {
      if (!byPage.has(question.page)) byPage.set(question.page, []);
      byPage.get(question.page).push(question);
    });
    return [...byPage.keys()].sort((a, b) => a - b).map((page) => sheetHTML(page, byPage.get(page))).join('');
  }).join('');
}

function metaHTML(chosen, cfg) {
  const grades = new Set();
  const topics = new Set();
  const levels = new Set();
  chosen.forEach((question) => {
    const source = question.source;
    if (!source) return;
    grades.add(source.gradeLabel || (gradeRecord(source.grade) || {}).label || '');
    topics.add(source.topic || source.title || '');
    if (source.levelLabel) levels.add(source.levelLabel);
  });
  const scenarioName = state.scenario === 'other' ? 'אחר' : cfg.label;
  return `<div class="plan-meta"><span>${escapeHTML([...grades].filter(Boolean).join(' · '))}</span><span>${escapeHTML([...topics].filter(Boolean).join(' · '))}</span><span>${escapeHTML([...levels].join(' · '))}</span><span>${escapeHTML(scenarioName)}</span></div>`;
}

async function updateShortPrint(plan, printArea, chosen, note, cfg) {
  const head = `<p class="plan-notice">דף מצומצם אחד. הסעיפים לפי רמה ומספר, והתשובות הסופיות בסוף.</p>${metaHTML(chosen, cfg)}`;
  const foot = `<p class="print-source">מקור: ${escapeHTML(chosen.map((question) => question.source && question.source.title).filter((title, index, all) => title && all.indexOf(title) === index).join(' · '))}</p><p class="plan-notes">${escapeHTML(STYLES[state.style].plan)}</p>${note ? `<div class="plan-notes"><strong>הערת המורה</strong><br>${escapeHTML(note)}</div>` : ''}`;
  plan.innerHTML = head + '<div class="crop-preview"></div>' + foot;
  printArea.innerHTML = '';
  await paintAllShort(plan.querySelector('.crop-preview'), chosen);
  await paintAllShort(printArea, chosen);
  await attachTeacherNote(printArea, note);
}

function elementarySource(meta, pageCount) {
  const questions = [];
  for (let page = 1; page <= pageCount; page += 1) {
    questions.push({
      id: 'p' + page,
      q: page,
      part: '',
      page,
      label: meta.levelLabel + ' · עמוד ' + page,
      text: meta.title,
      box: null,
      row: { page, x: 0.03, y: 0.04, w: 0.94, h: 0.92 },
    });
  }
  const source = {
    ...meta,
    mode: 'sheet',
    pageCount,
    headerCrop: { page: 1, x: 0.04, y: 0.012, w: 0.92, h: 0.036 },
    footerCrop: { page: pageCount, x: 0.04, y: 0.955, w: 0.92, h: 0.03 },
    questions,
  };
  questions.forEach((question) => { question.source = source; });
  return source;
}

async function materializeElementary(pdfId) {
  const cached = sheets.get(pdfId);
  if (cached && cached.questions && cached.questions.length) return cached;
  const meta = byPdf.get(pdfId);
  if (!meta) return null;
  const pdf = await loadPdf(meta);
  const source = elementarySource(meta, pdf.numPages);
  sheets.set(pdfId, source);
  return source;
}

async function resolveChosen() {
  const chosen = [];
  const allow = new Set(visibleSelectionKeys());
  for (const key of state.selected) {
    if (!allow.has(key)) continue;
    if (key.startsWith('sheet:')) {
      const source = await materializeElementary(key.slice(6));
      if (source) source.questions.forEach((question) => chosen.push(question));
    } else {
      const question = library.get(key);
      if (question) chosen.push(question);
    }
  }
  return chosen;
}

async function updatePrint() {
  const plan = $('dialog-plan');
  const printArea = $('print-area');
  if (!available()) {
    plan.innerHTML = '<p>אין דף מקור להדפסה. בוחרים כיתה ונושא מהקטלוג.</p>';
    printArea.innerHTML = PRINT_UNPREPARED;
    return;
  }
  const chosen = await resolveChosen();
  if (!chosen.length) {
    plan.innerHTML = '<p>עדיין לא נבחרו שאלות או דפים מתוך הקטלוג.</p>';
    printArea.innerHTML = PRINT_UNPREPARED;
    return;
  }
  const note = $('teacher-note').value.trim();
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  if (printMode === 'short') {
    await updateShortPrint(plan, printArea, chosen, note, cfg);
    return;
  }
  const head = `<p class="plan-notice">דף המקור המלא. מה שנבחר מסומן על העמוד.</p>${metaHTML(chosen, cfg)}`;
  const sheetsHtml = markedHTML(chosen);
  const titles = chosen.map((question) => question.source && question.source.pdfUrl).filter((url, index, all) => url && all.indexOf(url) === index);
  const foot = `<p class="print-source">מקור: ${escapeHTML(titles.join(' · '))}</p><p class="plan-notes">${escapeHTML(STYLES[state.style].plan)}</p>${note ? `<div class="plan-notes"><strong>הערת המורה</strong><br>${escapeHTML(note)}</div>` : ''}`;
  plan.innerHTML = head + sheetsHtml + foot;
  printArea.innerHTML = sheetsHtml;
  await paintSheets(plan, false);
  await paintSheets(printArea, true);
  await attachTeacherNote(printArea, note);
}

async function prepare(mode) {
  if (rendering) return;
  if (mode === 'short' && band() === 'elementary') return;
  if (!state.selected.length) {
    announce(band() === 'elementary' ? 'עדיין לא נבחר דף.' : 'עדיין לא נבחרו שאלות.');
    return;
  }
  printMode = mode;
  rendering = true;
  $('prepare').disabled = true;
  if ($('prepare-short')) $('prepare-short').disabled = true;
  try {
    await updatePrint();
    const ready = mode === 'short'
      ? $('dialog-plan').querySelector('.crop-sheet canvas')
      : $('dialog-plan').querySelector('.source-stage canvas');
    if (!ready) {
      announce(mode === 'short' ? 'לא נוצר דף מצומצם. לא הוצגה רשימת קישורים במקום.' : 'לא נוצר סימון. לא הוצגה רשימת קישורים במקום.');
      return;
    }
    $('print-title').textContent = mode === 'short' ? 'דף מצומצם מהמקור' : 'דף המקור עם סימון';
    $('print-lead').textContent = mode === 'short'
      ? 'דף אחד: כותרת אחת, הסעיפים לפי רמה ומספר, ותשובות סופיות בסוף.'
      : 'העמוד המלא, ומה שנבחר מסומן עליו.';
    $('print').lastChild.textContent = mode === 'short' ? 'הדפסת הדף המצומצם' : 'הדפסת הדף המסומן';
    printOpener = mode === 'short' ? $('prepare-short') : $('prepare');
    $('print-dialog').showModal();
  } catch (error) {
    $('dialog-plan').innerHTML = '<p>דף המקור לא נטען, ולכן אין הדפסה. לא הוצג דף חלופי.</p>';
    announce('דף המקור לא נטען.');
  } finally {
    rendering = false;
    $('prepare').disabled = false;
    if ($('prepare-short')) $('prepare-short').disabled = false;
  }
}

function exercisePreset(value) {
  const list = currentExercises();
  if (!list.length) return [];
  let picked = list.slice(0, 6);
  if (value === 'spiral') picked = list.filter((_, index) => index % 4 === 0).slice(0, 5);
  if (value === 'practice') picked = list.slice(0, 10);
  if (value === 'exam') picked = list.slice(-5);
  return picked.map((question) => exKey(question.source.pdfId, question.id));
}

function elementaryPreset(value) {
  const sheetsHere = topicSheets();
  const want = { first: ['a', 'one'], spiral: ['a', 'b'], practice: ['b'], exam: ['c'] }[value] || ['a', 'one'];
  const picked = sheetsHere.filter((sheet) => want.includes(sheet.level));
  const list = picked.length ? picked : sheetsHere.slice(0, 1);
  return list.map((sheet) => sheetKey(sheet.pdfId));
}

function applyScenario(value, options) {
  const quiet = options && options.quiet;
  const before = selectionKey();
  if (!quiet) snapshot();
  state.scenario = value;
  state.expanded = false;
  state.filter = 'all';
  if (value !== 'other') {
    if (pilotOn() && SCENARIOS[value]) state.selected = SCENARIOS[value].selected.map((id) => exKey(FACTORING_PDF, id));
    else if (band() === 'elementary') state.selected = elementaryPreset(value);
    else state.selected = exercisePreset(value);
  }
  if (selectionKey() !== before) clearPreparedPrint();
  render();
  if (!quiet) announce(value === 'other' ? 'אפשר להוסיף הערה ולבחור מהקטלוג.' : 'הוצגו פריטים שכבר קיימים בקטלוג.');
  if (!quiet && value === 'other') $('teacher-note').focus();
}

async function loadExerciseSheet(pdfId) {
  if (sheets.has(pdfId)) return sheets.get(pdfId);
  const response = await fetch(new URL('./sheets/' + pdfId + '.json', import.meta.url));
  if (!response.ok) throw new Error('SHEET_' + pdfId);
  const source = await response.json();
  source.mode = source.mode || 'exercise';
  const meta = byPdf.get(pdfId);
  if (meta) {
    source.gradeLabel = meta.gradeLabel;
    source.topic = source.topic || meta.topic;
    source.levelLabel = source.levelLabel || meta.levelLabel;
    source.title = source.title || meta.title;
  }
  source.questions.forEach((question) => {
    question.source = source;
    library.set(exKey(source.pdfId, question.id), question);
  });
  sheets.set(pdfId, source);
  if (source.pdfId === FACTORING_PDF) SOURCE = source;
  return source;
}

function indexCatalog() {
  byPdf.clear();
  CATALOG.grades.forEach((grade) => {
    grade.topics.forEach((topic) => {
      topic.sheets.forEach((sheet) => {
        byPdf.set(sheet.pdfId, {
          ...sheet,
          grade: grade.grade,
          gradeLabel: grade.label,
          band: grade.band,
          topicId: topic.id,
          topic: topic.title,
        });
      });
    });
  });
}

async function loadCurrentTopic() {
  const token = ++loadToken;
  const topic = currentTopic();
  if (!topic) return;
  if (band() === 'middle') {
    await Promise.all(topic.sheets.filter((sheet) => sheet.mode === 'exercise').map((sheet) => loadExerciseSheet(sheet.pdfId)));
  }
  if (token !== loadToken) return;
  if (sheets.has(FACTORING_PDF)) {
    const known = new Set(sheets.get(FACTORING_PDF).questions.map((question) => question.id));
    Object.values(SCENARIOS).forEach((cfg) => {
      [...cfg.selected, ...cfg.essential, ...cfg.deepen, cfg.suggestion].forEach((id) => {
        if (!known.has(id)) throw new Error('MISSING_' + id);
      });
    });
  }
}

function bind() {
  $('questions').addEventListener('change', (event) => {
    const box = event.target;
    if (box.matches('[data-question]')) selectKey(box.dataset.question, box.checked);
    if (box.matches('[data-sheet]')) selectKey(box.dataset.sheet, box.checked);
  });
  document.querySelectorAll('[name=scenario]').forEach((el) => el.addEventListener('change', () => {
    if (el.checked) applyScenario(el.value);
  }));
  document.querySelectorAll('[name=style]').forEach((el) => el.addEventListener('change', () => {
    if (!el.checked) return;
    state.style = el.value;
    render();
  }));
  document.querySelectorAll('[name=level]').forEach((el) => el.addEventListener('change', () => {
    if (!el.checked) return;
    state.level = el.value;
    state.expanded = false;
    const next = keepVisible(state.selected, visibleSelectionKeys());
    if (next.join('\n') !== selectionKey()) {
      snapshot();
      state.selected = next;
      clearPreparedPrint();
    }
    render();
  }));
  $('grade').addEventListener('change', async () => {
    state.grade = $('grade').value;
    state.level = 'all';
    state.expanded = false;
    state.selected = [];
    state.topic = '';
    history = [];
    clearPreparedPrint();
    fillTopics();
    await loadCurrentTopic();
    applyScenario(state.scenario === 'other' ? 'first' : state.scenario);
    document.dispatchEvent(new CustomEvent('teachers-grade-ready'));
  });
  $('topic').addEventListener('change', async () => {
    state.topic = $('topic').value;
    state.expanded = false;
    state.selected = [];
    history = [];
    clearPreparedPrint();
    await loadCurrentTopic();
    if (state.scenario === 'other') render();
    else applyScenario(state.scenario, { quiet: true });
  });
  $('filter-all').addEventListener('click', () => { state.filter = 'all'; $('filter-all').setAttribute('aria-pressed', 'true'); $('filter-selected').setAttribute('aria-pressed', 'false'); render(); });
  $('filter-selected').addEventListener('click', () => { state.filter = 'selected'; $('filter-selected').setAttribute('aria-pressed', 'true'); $('filter-all').setAttribute('aria-pressed', 'false'); render(); });
  $('show-more').addEventListener('click', () => { state.expanded = true; render(); });
  $('undo').addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    const before = selectionKey();
    state.selected = previous;
    if (selectionKey() !== before) clearPreparedPrint();
    render();
  });
  $('add-suggestion').addEventListener('click', () => {
    const cfg = SCENARIOS[state.scenario];
    if (pilotOn() && cfg && cfg.suggestion) selectKey(exKey(FACTORING_PDF, cfg.suggestion), true);
  });
  $('return-demo').addEventListener('click', async () => {
    state.grade = '9';
    state.topic = '2';
    state.level = 'all';
    fillGrades();
    fillTopics();
    await loadCurrentTopic();
    applyScenario('first');
  });
  $('teacher-note').addEventListener('input', () => {
    clearPreparedPrint();
    rememberWizard();
  });
  $('prepare').addEventListener('click', () => prepare('marked'));
  $('prepare-short').addEventListener('click', () => prepare('short'));
  $('print-dialog').addEventListener('close', () => {
    const opener = printOpener;
    if (!opener) return;
    window.setTimeout(() => opener.focus(), 0);
  });
  ['close-dialog', 'back-edit'].forEach((id) => $(id).addEventListener('click', () => $('print-dialog').close()));
  $('print').addEventListener('click', async () => {
    try { await updatePrint(); } catch (error) { announce('דף המקור לא נטען.'); return; }
    window.print();
  });
  document.addEventListener('noam-teacher-option', (event) => {
    const goal = event.detail && event.detail.goal;
    const input = document.querySelector('input[name="scenario"][value="' + goal + '"]');
    if (!input) return;
    input.checked = true;
    applyScenario(goal);
  });
}

const WIZARD_SESSION_KEY = 'teachers-wizard';
let wizardPersist = false;

function readWizardSession() {
  try {
    const raw = sessionStorage.getItem(WIZARD_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch (error) {
    return null;
  }
}

function rememberWizard() {
  if (!wizardPersist) return;
  try {
    const note = $('teacher-note');
    sessionStorage.setItem(WIZARD_SESSION_KEY, JSON.stringify({
      grade: state.grade,
      topic: state.topic,
      level: state.level,
      scenario: state.scenario,
      style: state.style,
      selected: state.selected.slice(),
      output: printMode,
      query: state.query || '',
      note: note ? note.value : '',
    }));
  } catch (error) {
    return;
  }
}

function primeWizardSession(saved) {
  if (!saved || !CATALOG) return;
  const grades = CATALOG.grades.map((grade) => String(grade.grade));
  if (saved.grade != null && grades.includes(String(saved.grade))) state.grade = String(saved.grade);
  const grade = gradeRecord(state.grade);
  const topics = grade && grade.topics ? grade.topics.map((topic) => String(topic.id)) : [];
  if (saved.topic != null && topics.includes(String(saved.topic))) state.topic = String(saved.topic);
  if (saved.level === 'all' || saved.level === 'a' || saved.level === 'b' || saved.level === 'c') state.level = saved.level;
  if (saved.scenario && SCENARIOS[saved.scenario]) state.scenario = saved.scenario;
  if (saved.style && STYLES[saved.style]) state.style = saved.style;
  if (saved.output === 'marked' || saved.output === 'short') printMode = saved.output;
  if (typeof saved.query === 'string') state.query = saved.query.slice(0, 80);
}

function restoreWizardSelection(saved) {
  if (!saved || !Array.isArray(saved.selected)) return;
  state.selected = keepVisible(saved.selected.map((key) => String(key)), visibleSelectionKeys());
  const note = $('teacher-note');
  if (note && typeof saved.note === 'string') note.value = saved.note.slice(0, 600);
  const search = $('fast-search');
  if (search) search.value = state.query || '';
  render();
}

async function start() {
  installSuggest();
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error('CATALOG');
  CATALOG = await response.json();
  indexCatalog();
  const saved = readWizardSession();
  primeWizardSession(saved);
  fillGrades();
  fillTopics();
  bind();
  await loadCurrentTopic();
  applyScenario(state.scenario, { quiet: true });
  restoreWizardSelection(saved);
  wizardPersist = true;
  rememberWizard();
  catalogReady = true;
  initWizard();
  const settled = settleRouteTap(true, pendingRoute, null);
  pendingRoute = settled.pending;
  clearRouteWait();
  if (settled.opened) openRequestedRoute(settled.opened, 'push');
}

start().catch(() => {
  catalogReady = true;
  pendingRoute = null;
  const note = $('route-loading');
  if (note) {
    note.hidden = false;
    note.textContent = 'רשימת דפי הקטלוג לא נטענה.';
  }
  if ($('wizard')) $('wizard').removeAttribute('aria-busy');
  if ($('result-summary')) $('result-summary').textContent = 'רשימת דפי הקטלוג לא נטענה.';
});

// Wizard navigation. `history` above is the undo stack, so browser history is window.history.
let wizardStepId = 'grade';
let wizardRoute = 'gate';
let wizardDepth = 0;
let wizardBound = false;
let catalogReady = false;
let pendingRoute = null;

function wizardSteps() {
  return ['grade', 'topic', 'level', 'pick', 'output', 'summary'];
}

function wizardIndex(step) {
  const index = wizardSteps().indexOf(String(step || ''));
  return index < 0 ? 0 : index;
}

function wizardNeighbor(step, delta) {
  const steps = wizardSteps();
  const index = Math.min(steps.length - 1, Math.max(0, wizardIndex(step) + delta));
  return steps[index];
}

function wizardStepFromHash(hash) {
  const id = String(hash || '').replace(/^#/, '');
  if (id === 'selection') return 'pick';
  return wizardSteps().includes(id) ? id : 'grade';
}

function wizardHash(step) {
  return '#' + wizardSteps()[wizardIndex(step)];
}

function wizardReduce(model, action) {
  const next = {
    step: model.step,
    grade: model.grade,
    topic: model.topic,
    level: model.level,
    selected: model.selected.slice(),
    output: model.output,
  };
  if (action.type === 'next') next.step = wizardNeighbor(model.step, 1);
  else if (action.type === 'back') next.step = wizardNeighbor(model.step, -1);
  else if (action.type === 'hash') next.step = wizardStepFromHash(action.hash);
  else if (action.type === 'jump') next.step = wizardSteps().includes(action.step) ? action.step : model.step;
  else if (action.type === 'set') {
    if (action.grade != null) next.grade = action.grade;
    if (action.topic != null) next.topic = action.topic;
    if (action.level != null) next.level = action.level;
    if (action.selected) next.selected = action.selected.slice();
    if (action.output != null) next.output = action.output;
  }
  return next;
}

function routeFromHash(hash) {
  const id = String(hash || '').replace(/^#/, '');
  if (id === 'fast') return 'fast';
  if (id === 'gate' || id === 'start' || !id) return 'gate';
  return 'guided';
}

function routeReduce(model, action) {
  const next = {
    route: model.route,
    step: model.step,
    grade: model.grade,
    topic: model.topic,
    level: model.level,
    selected: model.selected.slice(),
    output: model.output,
  };
  if (action.type === 'route') {
    next.route = action.route === 'fast' || action.route === 'guided' || action.route === 'gate' ? action.route : model.route;
    if (next.route === 'guided' && action.step && wizardSteps().includes(action.step)) next.step = action.step;
  } else if (action.type === 'hash') {
    next.route = routeFromHash(action.hash);
    if (next.route === 'guided') next.step = wizardStepFromHash(action.hash);
  }
  return next;
}

function suggestOutcome(result) {
  if (!result || result.enabled === false) return { apply: false, ids: [] };
  const ids = []
    .concat(Array.isArray(result.exerciseIds) ? result.exerciseIds : [])
    .concat(Array.isArray(result.sheetIds) ? result.sheetIds : [])
    .map((id) => String(id))
    .filter(Boolean);
  if (!ids.length) return { apply: false, ids: [] };
  return { apply: true, ids: ids.slice() };
}

function normalizeSuggest(data) {
  const exerciseIds = Array.isArray(data && data.exerciseIds) ? data.exerciseIds.map((id) => String(id)) : [];
  const sheetIds = Array.isArray(data && data.sheetIds) ? data.sheetIds.map((id) => String(id)) : [];
  const answer = data && typeof data.answer === 'string' ? data.answer : '';
  return { enabled: exerciseIds.length + sheetIds.length > 0, exerciseIds, sheetIds, answer };
}

function topicHits(catalog, query) {
  const q = String(query || '').trim();
  if (q.length < 2 || !catalog || !catalog.grades) return [];
  const hits = [];
  catalog.grades.forEach((grade) => {
    (grade.topics || []).forEach((topic) => {
      if (String(topic.title || '').includes(q)) {
        hits.push({ grade: String(grade.grade), topic: String(topic.id), title: topic.title, gradeLabel: grade.label });
      }
    });
  });
  return hits.slice(0, 6);
}

function queryText() {
  return String(state.query || '').trim();
}

function matchesQuery(parts) {
  const q = queryText();
  if (!q) return true;
  return parts.filter(Boolean).join(' ').includes(q);
}

function queryLimitsList() {
  const q = queryText();
  if (!q) return false;
  const topic = currentTopic();
  if (topic && String(topic.title || '').includes(q)) return false;
  const grade = gradeRecord(state.grade);
  if (grade && String(grade.label || '').includes(q)) return false;
  return true;
}

const WIZARD_LABELS = {
  grade: 'כיתה',
  topic: 'נושא',
  level: 'רמה',
  pick: 'בחירה',
  output: 'הדפסה',
  summary: 'סיום',
};

function wizardCurrent() {
  return wizardSteps()[wizardIndex(wizardStepId)];
}

function topicFilterText() {
  const input = $('topic-filter');
  return input ? String(input.value || '').trim() : '';
}

function paintSelectCards(selectId, gridId) {
  const select = $(selectId);
  const grid = $(gridId);
  if (!select || !grid) return;
  const q = selectId === 'topic' ? topicFilterText() : '';
  const options = [...select.options].filter((opt) => !q || String(opt.textContent || '').includes(q));
  grid.innerHTML = options.map((opt) => {
    const on = opt.value === select.value;
    return `<button type="button" class="choice-card${on ? ' is-on' : ''}" data-value="${escapeHTML(opt.value)}" aria-pressed="${on ? 'true' : 'false'}">${escapeHTML(opt.textContent || '')}</button>`;
  }).join('');
  const meta = $('topic-filter-meta');
  const empty = $('topic-filter-empty');
  if (selectId === 'topic' && meta) meta.textContent = q ? options.length + ' מתוך ' + select.options.length : select.options.length + ' נושאים';
  if (selectId === 'topic' && empty) empty.hidden = !q || options.length > 0;
}

function wizardHandle(model, action) {
  const kind = action && action.type;
  if (kind === 'chip' || kind === 'jump') {
    const next = wizardReduce(model, { type: 'jump', step: action.step });
    return { step: next.step, how: 'replace', selected: next.selected };
  }
  if (kind === 'next') {
    const next = wizardReduce(model, { type: 'next' });
    return { step: next.step, how: 'push', selected: next.selected };
  }
  const next = wizardReduce(model, { type: 'back' });
  return { step: next.step, how: 'push', selected: next.selected };
}

function settleRouteTap(ready, pending, request) {
  if (!ready) return { pending: request, opened: null };
  return { pending: null, opened: request || pending || null };
}

function chipText(step) {
  if (step === 'grade') return $('grade') && $('grade').selectedOptions[0] ? $('grade').selectedOptions[0].textContent : '';
  if (step === 'topic') return $('topic') && $('topic').selectedOptions[0] ? $('topic').selectedOptions[0].textContent : '';
  if (step === 'level') {
    const picked = document.querySelector('[name=level]:checked');
    return picked ? picked.parentElement.textContent.trim() : '';
  }
  if (step === 'pick') return state.selected.length ? state.selected.length + ' נבחרו' : '';
  if (step === 'output') return printMode === 'short' ? 'דף מצומצם' : 'דף מסומן';
  return '';
}

function paintWizardChrome() {
  const steps = wizardSteps();
  const index = wizardIndex(wizardStepId);
  const count = $('wizard-count');
  if (count) count.textContent = 'שלב ' + (index + 1) + ' מתוך ' + steps.length;
  const meter = $('wizard-meter');
  if (meter) {
    meter.innerHTML = steps.map((step, stepIndex) => {
      const cls = stepIndex < index ? 'is-done' : (stepIndex === index ? 'is-on' : '');
      const disabled = stepIndex > index ? ' disabled' : '';
      return `<button type="button" class="${cls}" data-wizard-jump="${step}"${disabled} aria-current="${stepIndex === index ? 'step' : 'false'}" aria-label="שלב ${stepIndex + 1} מתוך ${steps.length}: ${WIZARD_LABELS[step]}"><i></i>${WIZARD_LABELS[step]}</button>`;
    }).join('');
  }
  const chips = $('wizard-chips');
  if (chips) {
    chips.innerHTML = steps.slice(0, index).map((step) => {
      const text = chipText(step);
      if (!text) return '';
      return `<button type="button" data-wizard-jump="${step}">${escapeHTML(text)}</button>`;
    }).join('');
  }
  const back = $('wizard-back');
  if (back) back.disabled = wizardRoute === 'gate';
  const next = $('wizard-next');
  if (next) {
    const onSummary = wizardRoute === 'guided' && wizardStepId === 'summary';
    const printing = onSummary || wizardRoute === 'fast';
    next.hidden = wizardRoute === 'gate';
    next.textContent = printing ? (printMode === 'short' ? 'הצגת הדף המצומצם' : 'הצגת הדף המסומן') : 'המשך';
  }
  const recap = $('wizard-recap');
  if (recap && wizardStepId === 'summary') {
    recap.innerHTML = steps.slice(0, 5).map((step) => {
      const text = chipText(step);
      if (!text) return '';
      return `<div><span>${WIZARD_LABELS[step]}</span><b>${escapeHTML(text)}</b></div>`;
    }).join('');
  }
}

function wizardPaint(step, how) {
  if (!$('wizard')) return;
  const id = wizardSteps()[wizardIndex(step)];
  const prevIndex = wizardIndex(wizardStepId);
  const nextIndex = wizardIndex(id);
  wizardStepId = id;
  const guided = wizardRoute === 'guided';
  document.querySelectorAll('[data-wizard-step]').forEach((el) => {
    const on = el.getAttribute('data-wizard-step') === id;
    el.classList.toggle('is-on', guided && on);
    el.hidden = guided ? !on : wizardRoute === 'gate';
  });
  const gate = $('route-gate');
  const fast = $('fast-screen');
  if (gate) gate.hidden = wizardRoute !== 'gate';
  if (fast) fast.hidden = wizardRoute !== 'fast';
  const need = $('teacher-need-wrap');
  if (need) {
    need.hidden = wizardRoute === 'gate';
    if (wizardRoute === 'fast') need.open = true;
  }
  placeTeacherNeed();
  $('wizard').classList.toggle('is-gate', wizardRoute === 'gate');
  $('wizard').classList.toggle('is-fast', wizardRoute === 'fast');
  $('wizard').classList.toggle('is-guided', wizardRoute === 'guided');
  $('wizard').classList.toggle('is-summary', guided && id === 'summary');
  const viewport = $('wizard-viewport');
  if (viewport && how !== 'init' && how !== 'silent') {
    viewport.dataset.dir = wizardRoute === 'guided' && nextIndex >= prevIndex ? 'forward' : 'back';
    viewport.classList.remove('is-sliding');
    void viewport.offsetWidth;
    viewport.classList.add('is-sliding');
    const active = viewport.querySelector('.wizard-step.is-on, #route-gate:not([hidden]), #fast-screen:not([hidden])');
    if (active) {
      active.classList.remove('is-on');
      void active.offsetWidth;
      active.classList.add('is-on');
    }
  }
  const elementary = band() === 'elementary';
  const pickTitle = $('pick-question');
  if (pickTitle) pickTitle.textContent = elementary ? 'איזה דף?' : 'אילו סעיפים?';
  const pickLead = $('pick-lead');
  if (pickLead) pickLead.textContent = elementary ? 'בוחרים דף שלם לפי הרמה.' : 'בוחרים סעיפים. אפשר מכמה דפים.';
  paintWizardChrome();
  paintFastHits();
  if (how !== 'silent' && how !== 'init') {
    const head = wizardRoute === 'gate' ? $('route-question')
      : wizardRoute === 'fast' ? $('fast-question')
      : document.querySelector('[data-wizard-step="' + id + '"] .wizard-question');
    if (head) {
      try { head.focus({ preventScroll: true }); }
      catch (error) { head.focus(); }
    }
    scrollWizardTop();
  }
}

function scrollWizardTop() {
  const node = $('wizard-progress') || $('wizard');
  if (!node || typeof node.getBoundingClientRect !== 'function') return;
  const bar = document.querySelector('.topbar');
  const offset = bar ? bar.getBoundingClientRect().height : 0;
  const top = window.scrollY + node.getBoundingClientRect().top - offset - 8;
  window.scrollTo(0, Math.max(0, top));
}

function currentWizardModel() {
  return {
    route: wizardRoute,
    step: wizardStepId,
    grade: state.grade,
    topic: state.topic,
    level: state.level,
    selected: state.selected,
    output: printMode,
  };
}

function writeWizardHistory(step, how) {
  const url = wizardRoute === 'fast' ? '#fast' : wizardRoute === 'guided' ? wizardHash(step) : '#gate';
  if (how === 'push') {
    wizardDepth += 1;
    window.history.pushState({ wizard: step, wizardDepth, route: wizardRoute }, '', url);
  } else if (how === 'replace') {
    window.history.replaceState({ wizard: step, wizardDepth, route: wizardRoute }, '', url);
  }
}

function wizardGo(step, how) {
  const jumped = wizardReduce(currentWizardModel(), { type: 'jump', step });
  const next = routeReduce(jumped, { type: 'route', route: 'guided', step: jumped.step });
  wizardRoute = next.route;
  writeWizardHistory(next.step, how);
  wizardPaint(next.step, how === 'replace' && wizardDepth === 0 ? 'init' : how);
}

function openRoute(route, how, step) {
  const next = routeReduce(currentWizardModel(), { type: 'route', route, step });
  const leavingFast = wizardRoute === 'fast' && next.route !== 'fast';
  wizardRoute = next.route;
  if (leavingFast && $('teacher-need-wrap')) $('teacher-need-wrap').open = false;
  writeWizardHistory(next.step, how);
  wizardPaint(next.route === 'guided' ? next.step : wizardStepId, how === 'replace' && wizardDepth === 0 ? 'init' : how);
}

function wizardOnHistory() {
  const next = routeReduce(currentWizardModel(), { type: 'hash', hash: location.hash });
  if (next.route === wizardRoute && (next.route !== 'guided' || next.step === wizardStepId)) return;
  const entry = window.history.state;
  wizardDepth = entry && Number.isFinite(entry.wizardDepth) ? entry.wizardDepth : Math.max(0, wizardDepth - 1);
  wizardRoute = next.route;
  wizardPaint(next.route === 'guided' ? next.step : wizardStepId, 'pop');
}

function syncWizardChrome() {
  if (!$('wizard')) return;
  paintSelectCards('grade', 'grade-choices');
  paintSelectCards('topic', 'topic-choices');
  if (band() === 'elementary' && printMode === 'short') printMode = 'marked';
  const elementary = band() === 'elementary';
  const shortChoice = $('output-short');
  if (shortChoice) shortChoice.hidden = elementary;
  document.querySelectorAll('[data-output]').forEach((btn) => {
    const on = btn.dataset.output === printMode;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const shortBtn = $('prepare-short');
  if (shortBtn) shortBtn.hidden = elementary || printMode !== 'short';
  const prepare = $('prepare');
  if (prepare) prepare.hidden = printMode === 'short' && !elementary;
  if (prepare) prepare.classList.toggle('primary', printMode !== 'short');
  if (shortBtn) {
    shortBtn.classList.toggle('primary', printMode === 'short' && !elementary);
    shortBtn.classList.toggle('text-btn', printMode !== 'short' || elementary);
  }
  const pickTitle = $('pick-question');
  if (pickTitle) pickTitle.textContent = elementary ? 'איזה דף?' : 'אילו סעיפים?';
  const pickLead = $('pick-lead');
  if (pickLead) pickLead.textContent = elementary ? 'בוחרים דף שלם לפי הרמה.' : 'בוחרים סעיפים. אפשר מכמה דפים.';
  paintFastHits();
  paintSearchKept();
  paintWizardChrome();
}

function initWizard() {
  if (!$('wizard') || wizardBound) return;
  wizardBound = true;
  const gradeGrid = $('grade-choices');
  const topicGrid = $('topic-choices');
  if (gradeGrid) gradeGrid.addEventListener('click', (event) => chooseSelectCard(event, 'grade', 'grade'));
  if (topicGrid) topicGrid.addEventListener('click', (event) => chooseSelectCard(event, 'topic', 'topic'));
  const levelFilter = $('level-filter');
  if (levelFilter) levelFilter.addEventListener('click', (event) => {
    const input = event.target.closest('label') && event.target.closest('label').querySelector('input');
    if (!input || wizardRoute !== 'guided' || wizardCurrent() !== 'level') return;
    window.setTimeout(() => {
      if (wizardRoute === 'guided' && wizardCurrent() === 'level') wizardGo(wizardNeighbor('level', 1), 'push');
    }, 0);
  });
  const outputChoices = $('output-choices');
  if (outputChoices) outputChoices.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-output]');
    if (!btn || btn.hidden) return;
    printMode = btn.dataset.output;
    syncWizardChrome();
    rememberWizard();
    if (wizardRoute === 'guided') wizardGo('summary', 'push');
  });
  const chips = $('wizard-chips');
  if (chips) chips.addEventListener('click', (event) => jumpWizard(event));
  const meter = $('wizard-meter');
  if (meter) meter.addEventListener('click', (event) => jumpWizard(event));
  const topicFilter = $('topic-filter');
  if (topicFilter) topicFilter.addEventListener('input', () => paintSelectCards('topic', 'topic-choices'));
  $('wizard-back').addEventListener('click', () => {
    if (wizardRoute === 'gate') return;
    if (wizardRoute !== 'guided' || wizardIndex(wizardCurrent()) === 0) {
      openRoute('gate', 'push');
      return;
    }
    const handled = wizardHandle(currentWizardModel(), { type: 'back' });
    wizardGo(handled.step, handled.how);
  });
  $('wizard-next').addEventListener('click', () => {
    if (wizardRoute === 'fast') {
      prepare(printMode);
      return;
    }
    const step = wizardCurrent();
    if (wizardRoute !== 'guided') return;
    if (step === 'summary') {
      prepare(printMode);
      return;
    }
    if (step === 'pick' && !state.selected.length) {
      announce(band() === 'elementary' ? 'עדיין לא נבחר דף.' : 'עדיין לא נבחרו שאלות.');
      return;
    }
    const following = wizardHandle(currentWizardModel(), { type: 'next' });
    wizardGo(following.step, following.how);
  });
  const search = $('fast-search');
  if (search) search.addEventListener('input', () => {
    state.query = search.value;
    render();
  });
  const kept = $('fast-selected');
  if (kept) kept.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-keep-key]');
    if (!btn) return;
    selectKey(btn.dataset.keepKey, false);
  });
  const hits = $('fast-hits');
  if (hits) hits.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-hit-topic]');
    if (!btn) return;
    chooseCatalogTopic(btn.dataset.hitGrade, btn.dataset.hitTopic);
  });
  const needForm = $('teacher-need');
  if (needForm) needForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('teacher-need-text') ? $('teacher-need-text').value.trim() : '';
    if (!text) return;
    askTeacherNeed(text);
  });
  window.addEventListener('popstate', wizardOnHistory);
  window.addEventListener('hashchange', wizardOnHistory);
  wizardDepth = 0;
  const opened = routeReduce(currentWizardModel(), { type: 'hash', hash: location.hash });
  wizardRoute = opened.route;
  if (opened.route === 'guided') wizardGo(opened.step, 'replace');
  else openRoute(opened.route, 'replace');
}

function chooseSelectCard(event, selectId, step) {
  const btn = event.target.closest('[data-value]');
  if (!btn) return;
  const select = $(selectId);
  if (select && select.value !== btn.dataset.value) {
    select.value = btn.dataset.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (wizardRoute === 'guided') wizardGo(wizardNeighbor(step, 1), 'push');
}

function jumpWizard(event) {
  const btn = event.target.closest('[data-wizard-jump]');
  if (!btn || btn.disabled) return;
  const step = btn.dataset.wizardJump;
  if (wizardIndex(step) > wizardIndex(wizardCurrent())) return;
  const handled = wizardHandle(currentWizardModel(), { type: 'chip', step });
  wizardGo(handled.step, handled.how);
}

function placeTeacherNeed() {
  const wrap = $('teacher-need-wrap');
  if (!wrap) return;
  if (wizardRoute === 'fast') {
    const level = document.querySelector('[data-wizard-step="level"]');
    if (level && wrap.previousElementSibling !== level) level.insertAdjacentElement('afterend', wrap);
    return;
  }
  const row = document.querySelector('.route-switch-row');
  if (row && wrap.previousElementSibling !== row) row.insertAdjacentElement('afterend', wrap);
}

function paintFastHits() {
  const box = $('fast-hits');
  if (!box) return;
  const hits = topicHits(CATALOG, queryText());
  if (!hits.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = hits.map((hit) => `<button type="button" data-hit-grade="${escapeHTML(hit.grade)}" data-hit-topic="${escapeHTML(hit.topic)}">${escapeHTML(hit.title)} · ${escapeHTML(hit.gradeLabel)}</button>`).join('');
}

async function chooseCatalogTopic(grade, topic) {
  if (String(state.grade) !== String(grade)) {
    await new Promise((resolve) => {
      document.addEventListener('teachers-grade-ready', resolve, { once: true });
      $('grade').value = String(grade);
      $('grade').dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  if (String(state.topic) !== String(topic)) {
    $('topic').value = String(topic);
    $('topic').dispatchEvent(new Event('change', { bubbles: true }));
  }
  const search = $('fast-search');
  if (search) search.value = '';
  state.query = '';
  render();
}

function applySuggestIds(ids) {
  const keys = [];
  ids.forEach((id) => {
    if (library.has(id)) keys.push(id);
    else if (String(id).startsWith('sheet:') && byPdf.has(String(id).slice(6))) keys.push(String(id));
    else if (byPdf.has(id)) keys.push(sheetKey(id));
    else if (library.has(exKey(FACTORING_PDF, id))) keys.push(exKey(FACTORING_PDF, id));
  });
  const visible = keepVisible(keys, visibleSelectionKeys());
  if (!visible.length) return false;
  snapshot();
  state.selected = visible;
  clearPreparedPrint();
  render();
  return true;
}

async function askTeacherNeed(message) {
  const status = $('teacher-need-status');
  const button = document.querySelector('#teacher-need button');
  if (button) button.disabled = true;
  if (status) status.textContent = 'בודקים בקטלוג…';
  try {
    const api = window.NoamTeacherSuggest;
    const result = api && typeof api.suggest === 'function'
      ? await api.suggest(message)
      : { enabled: false, exerciseIds: [], sheetIds: [] };
    const outcome = suggestOutcome(result);
    if (!outcome.apply || !applySuggestIds(outcome.ids)) {
      if (status) status.textContent = TEACHER_QUIET;
      return;
    }
    if (status) status.textContent = 'ההצעה סומנה. אפשר לשנות אותה לפני ההדפסה.';
  } catch (error) {
    if (status) status.textContent = TEACHER_QUIET;
  } finally {
    if (button) button.disabled = false;
  }
}

function routeRequestFrom(btn) {
  const route = btn.dataset.openRoute;
  const step = route === 'guided' && btn.id === 'route-guided' ? 'grade' : undefined;
  return { route, step };
}

function showRouteWait(id) {
  const note = $('route-loading');
  if (note) {
    note.hidden = false;
    note.textContent = 'טוענים את הקטלוג…';
  }
  document.querySelectorAll('[data-open-route]').forEach((btn) => {
    btn.classList.toggle('is-waiting', btn.id === id);
  });
  if ($('wizard')) $('wizard').setAttribute('aria-busy', 'true');
}

function clearRouteWait() {
  const note = $('route-loading');
  if (note) note.hidden = true;
  document.querySelectorAll('[data-open-route]').forEach((btn) => btn.classList.remove('is-waiting'));
  if ($('wizard')) $('wizard').removeAttribute('aria-busy');
}

function openRequestedRoute(request, how) {
  if (!request || !request.route) return;
  if (request.route === 'guided' && request.step) openRoute('guided', how || 'push', request.step);
  else openRoute(request.route, how || 'push');
}

function bindRouteCards() {
  if (bindRouteCards.done || !$('wizard')) return;
  bindRouteCards.done = true;
  document.querySelectorAll('[data-open-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const request = routeRequestFrom(btn);
      const settled = settleRouteTap(catalogReady, pendingRoute, request);
      pendingRoute = settled.pending;
      if (!catalogReady) {
        showRouteWait(btn.id);
        return;
      }
      if (settled.opened) openRequestedRoute(settled.opened, 'push');
    });
  });
}

bindRouteCards();
