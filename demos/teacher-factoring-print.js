import {
  blankBrief,
  confirmChips,
  describeSelection,
  editChips,
  nextTeacherQuestion,
  readTeacherBrief,
  selectByBrief,
} from './teacher-brief.js';

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
const cropManifests = new Map();

async function loadCropManifest(pdfId) {
  if (!pdfId) return null;
  if (cropManifests.has(pdfId)) return cropManifests.get(pdfId);
  try {
    const response = await fetch(new URL('./crop-manifest/' + pdfId + '.json', import.meta.url));
    if (!response.ok) {
      cropManifests.set(pdfId, null);
      return null;
    }
    const data = await response.json();
    cropManifests.set(pdfId, data);
    return data;
  } catch (error) {
    cropManifests.set(pdfId, null);
    return null;
  }
}
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
  if (status) status.textContent = 'השיחה עם נועם AI היא בפאנל. הבחירה רק מתוך השאלות שכבר בדף.';
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
  const linePx = Math.max(8, Math.round((question.line || 0.02) * bitmapHeight));
  list.forEach((other) => {
    if (!other || other === question) return;
    thumbRowsOf(other).forEach((otherRow) => {
      if ((otherRow.page || other.page) !== page) return;
      const top = Math.floor((otherRow.y || 0) * bitmapHeight);
      const bot = Math.ceil(((otherRow.y || 0) + (otherRow.h || 0)) * bitmapHeight);
      if (bot <= thisTop && bot > above) above = bot;
      if (top >= thisBot && top < below) below = top;
    });
    const pin = other.box;
    if (!pin || (pin.page || other.page) !== page) return;
    const pinTop = Math.floor((pin.y || 0) * bitmapHeight);
    // The stored row can start inside the next label. Stop at the label pin when the overlap is only a sliver.
    if (pinTop > thisTop + linePx && pinTop < below && thisBot - pinTop < linePx * 1.4) below = pinTop;
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
  const linePxEarly = Math.max(8, Math.round(lineFrac * bitmap.height));
  let unionLeft = best.x;
  let unionRight = best.x + best.w;
  let unionTop = best.top;
  let unionBot = best.bot;
  clusters.forEach((cluster) => {
    if (cluster === best || cluster.top < 0 || cluster.n < 8) return;
    const overlap = Math.min(cluster.bot, best.bot) - Math.max(cluster.top, best.top);
    const above = best.top - cluster.bot < linePxEarly && cluster.bot >= best.top - linePxEarly * 2.4;
    const labelSide = cluster.x > rw * 0.62;
    if (overlap <= 3 && !above && !labelSide) return;
    unionLeft = Math.min(unionLeft, cluster.x);
    unionRight = Math.max(unionRight, cluster.x + cluster.w);
    unionTop = Math.min(unionTop, cluster.top);
    unionBot = Math.max(unionBot, cluster.bot);
  });
  best = { x: unionLeft, w: unionRight - unionLeft, top: unionTop, bot: unionBot, n: best.n, span: best.span };
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
  const bandWidth = (band) => {
    let maxSpan = 0;
    for (let y = band.y; y < band.y + band.h; y += 1) {
      let left = -1;
      let right = -1;
      for (let x = best.x; x < best.x + best.w; x += 1) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) {
          if (left < 0) left = x;
          right = x;
        }
      }
      if (left >= 0) maxSpan = Math.max(maxSpan, right - left + 1);
    }
    return maxSpan;
  };
  const tall = bands.filter((band) => band.h >= minBand);
  const kept = tall.length ? bands.filter((band) => band.h >= minBand || tall.some((item) => Math.abs(band.y - (item.y + item.h)) < gapY || Math.abs(item.y - (band.y + band.h)) < gapY) || (band.h >= 1 && bandWidth(band) > best.w * 0.22 && tall.some((item) => Math.abs(band.y - (item.y + item.h)) < linePxEarly))) : [bands.reduce((bestBand, band) => (band.h > bestBand.h ? band : bestBand))];
  while (kept.length > 1) {
    const first = kept[0];
    const second = kept[1];
    const topGap = second.y - (first.y + first.h);
    // The bottom of the previous line, not this part.
    if (topGap > 2 && first.h < linePxEarly * 0.55 && bandWidth(first) < best.w * 0.35) {
      kept.shift();
      continue;
    }
    break;
  }
  while (kept.length > 1) {
    const last = kept[kept.length - 1];
    const prev = kept[kept.length - 2];
    const gap = last.y - (prev.y + prev.h);
    // A distant short line under a tall crop is the closing greeting, not the drawing.
    if (gap > linePxEarly * 1.4 && last.h < linePxEarly && windowRect.srcH > bitmap.height * 0.22) {
      kept.pop();
      continue;
    }
    if (last.h < prev.h * 0.75 && gap > 1 && bandWidth(last) < best.w * 0.45) {
      kept.pop();
      continue;
    }
    // A short band at the bottom, separated from the drawing, is a sliced neighbour letter.
    if (gap > 2 && last.h < linePxEarly * 0.55 && bandWidth(last) < best.w * 0.62) {
      kept.pop();
      continue;
    }
    break;
  }
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
  });
  // The part letter and a leading blank sit on the right. A full-width rule must not pull the left edge out.
  rowStats.forEach((row) => {
    if (row.right > right) right = row.right;
  });
  if (right < left) return windowRect;
  const line = question.line > 0 ? question.line : 0.02;
  const pad = Math.max(3, Math.min(10, Math.round(line * bitmap.height * 0.18)));
  const limits = thumbNeighborY(question, row, bitmap.height);
  const srcX = Math.max(0, windowRect.srcX + left - pad);
  const srcX2 = Math.min(bitmap.width, windowRect.srcX + right + 1 + pad);
  // Pad through white only. Entering the line above or below slices a letter.
  const whiteRun = (absEdge, dir) => {
    const span = Math.max(1, srcX2 - srcX);
    let used = 0;
    for (let step = 1; step <= pad; step += 1) {
      const y = absEdge + dir * step;
      if (y < 0 || y >= bitmap.height) break;
      let n = 0;
      let rowData = null;
      try {
        const rowImage = ctx.getImageData(srcX, y, span, 1);
        rowData = rowImage && rowImage.data;
      } catch (error) {
        break;
      }
      if (!rowData) break;
      if (rowData.length <= span * 4 + 8) {
        for (let i = 0; i < rowData.length; i += 4) {
          if (rowData[i] < 242 || rowData[i + 1] < 242 || rowData[i + 2] < 242) n += 1;
        }
      } else if (rowData.length >= bitmap.width * bitmap.height * 4) {
        for (let x = srcX; x < srcX2 && x < bitmap.width; x += 1) {
          const i = (y * bitmap.width + x) * 4;
          if (rowData[i] < 242 || rowData[i + 1] < 242 || rowData[i + 2] < 242) n += 1;
        }
      } else break;
      if (n > 2) break;
      used = step;
    }
    return used;
  };
  const topAbs = windowRect.srcY + top;
  const botAbs = windowRect.srcY + bot;
  const srcY = Math.max(limits.above, topAbs - whiteRun(topAbs, -1));
  // Stop short of the next row so a sliver of its first line is not in the card.
  const belowLimit = limits.below < bitmap.height ? Math.max(srcY + 4, limits.below - 2) : limits.below;
  const srcY2 = Math.min(belowLimit, botAbs + whiteRun(botAbs, 1));
  return { srcX, srcY, srcW: Math.max(1, srcX2 - srcX), srcH: Math.max(1, srcY2 - srcY), page: windowRect.page };
}

async function clipThumbRow(question, row) {
  let y2 = (row.y || 0) + (row.h || 0.03);
  if (y2 > 0.958) y2 = 0.958;
  try {
    const items = await pageTextItems(row.page || question.page, question.source);
    items.forEach((item) => {
      if (!String(item.str || '').includes('בהצלחה')) return;
      if (item.y > (row.y || 0) + 0.008 && item.y < y2) y2 = Math.min(y2, item.y - 0.006);
    });
  } catch (error) {}
  const cap = 0.34;
  if (y2 - (row.y || 0) > cap) y2 = (row.y || 0) + cap;
  return { ...row, h: Math.max(0.02, y2 - (row.y || 0)) };
}

function wordGapCut(bitmap, slice, loose) {
  let image;
  try {
    image = bitmap.getContext('2d').getImageData(slice.srcX, slice.srcY, slice.srcW, slice.srcH);
  } catch (error) {
    return null;
  }
  const data = image.data;
  const rw = slice.srcW;
  const rh = slice.srcH;
  const col = new Uint16Array(rw);
  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const i = (y * rw + x) * 4;
      if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) col[x] += 1;
    }
  }
  let best = null;
  let run = 0;
  const mid = rw / 2;
  const fromFrac = loose ? 0.12 : 0.28;
  const toFrac = loose ? 0.88 : 0.72;
  for (let x = Math.floor(rw * fromFrac); x <= Math.ceil(rw * toFrac); x += 1) {
    if (x < rw && col[x] === 0) {
      run += 1;
    } else if (run >= 3) {
      const gapX = x - run;
      const center = gapX + run / 2;
      const score = Math.abs(center - mid);
      if (!best || score < best.score) best = { x: gapX, w: run, score };
      run = 0;
    } else {
      run = 0;
    }
  }
  if (!best || best.w < 4) return null;
  return best.x + Math.floor(best.w / 2);
}

function captionSplit(bitmap, slice) {
  if (!slice || slice.srcH < 40 || slice.srcW < 40) return null;
  let image;
  try {
    image = bitmap.getContext('2d').getImageData(slice.srcX, slice.srcY, slice.srcW, slice.srcH);
  } catch (error) {
    return null;
  }
  const data = image.data;
  const rw = slice.srcW;
  const rh = slice.srcH;
  const bands = [];
  let start = -1;
  let blank = 0;
  const gap = Math.max(3, Math.round(rh * 0.015));
  for (let y = 0; y <= rh; y += 1) {
    let n = 0;
    if (y < rh) {
      for (let x = 0; x < rw; x += 4) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) n += 1;
      }
    }
    if (n > 1) {
      if (start < 0) start = y;
      blank = 0;
    } else if (start >= 0) {
      blank += 1;
      if (y === rh || blank > gap) {
        bands.push({ y: start, h: y - blank - start + 1 });
        start = -1;
        blank = 0;
      }
    }
  }
  if (bands.length < 2) return null;
  const lineCap = Math.max(14, Math.round(rh * 0.16));
  let textEnd = 0;
  while (textEnd < bands.length && bands[textEnd].h <= lineCap) textEnd += 1;
  if (!textEnd || textEnd >= bands.length) return null;
  const draw = bands[textEnd];
  if (draw.h < rh * 0.32 || draw.h < bands[0].h * 2) return null;
  const textTop = Math.max(0, bands[0].y - 2);
  const textBot = bands[textEnd - 1].y + bands[textEnd - 1].h + 2;
  const drawTop = Math.max(0, draw.y - 2);
  const drawBot = Math.min(rh, bands[bands.length - 1].y + bands[bands.length - 1].h + 2);
  if (textBot >= drawTop || textBot - textTop < 6 || drawBot - drawTop < 20) return null;
  return {
    text: { ...slice, srcY: slice.srcY + textTop, srcH: Math.max(1, textBot - textTop) },
    drawing: { ...slice, srcY: slice.srcY + drawTop, srcH: Math.max(1, drawBot - drawTop) },
  };
}

function besideSplit(bitmap, slice) {
  if (!slice || slice.srcH < 36 || slice.srcW < 80) return null;
  let image;
  try {
    image = bitmap.getContext('2d').getImageData(slice.srcX, slice.srcY, slice.srcW, slice.srcH);
  } catch (error) {
    return null;
  }
  const data = image.data;
  const rw = slice.srcW;
  const rh = slice.srcH;
  const col = new Uint16Array(rw);
  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const i = (y * rw + x) * 4;
      if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) col[x] += 1;
    }
  }
  let gapStart = -1;
  let bestGap = null;
  const from = Math.floor(rw * 0.16);
  const to = Math.floor(rw * 0.88);
  for (let x = from; x <= to; x += 1) {
    if (x < rw && col[x] === 0) {
      if (gapStart < 0) gapStart = x;
    } else if (gapStart >= 0) {
      const width = x - gapStart;
      if (width >= 6 && (!bestGap || width > bestGap.w)) bestGap = { x: gapStart, w: width };
      gapStart = -1;
    }
  }
  if (!bestGap) {
    // Text can sit beside a drawing with no empty column. The right columns are only a line tall.
    const span = new Int16Array(rw);
    const topOf = new Int16Array(rw);
    topOf.fill(-1);
    for (let y = 0; y < rh; y += 1) {
      for (let x = 0; x < rw; x += 1) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) {
          if (topOf[x] < 0) topOf[x] = y;
          span[x] = y;
        }
      }
    }
    let boundary = rw;
    for (let x = rw - 1; x >= Math.floor(rw * 0.28); x -= 1) {
      const height = topOf[x] < 0 ? 0 : span[x] - topOf[x] + 1;
      if (height > rh * 0.42) {
        boundary = x + 1;
        break;
      }
    }
    if (boundary < rw - 20 && boundary > rw * 0.28) {
      let leftTall = 0;
      for (let x = 0; x < boundary; x += 1) {
        const height = topOf[x] < 0 ? 0 : span[x] - topOf[x] + 1;
        if (height > leftTall) leftTall = height;
      }
      if (leftTall > rh * 0.45) bestGap = { x: boundary, w: 0 };
    }
  }
  if (!bestGap) return null;
  const cut = bestGap.x + Math.floor(bestGap.w / 2);
  if (cut < 24 || rw - cut < 16) return null;
  const inkSpan = (x0, x1) => {
    let top = -1;
    let bot = -1;
    for (let y = 0; y < rh; y += 1) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) {
          if (top < 0) top = y;
          bot = y;
          break;
        }
      }
    }
    return top < 0 ? 0 : bot - top + 1;
  };
  const textH = inkSpan(cut, rw);
  const drawH = inkSpan(0, cut);
  if (textH < 8 || drawH < rh * 0.35) return null;
  // A wide empty column is the gutter between the sentence and the figure.
  // A narrow gap is inside the figure unless the right side is only the caption.
  if (bestGap.w < 32 && textH > drawH * 0.72) return null;
  const trimY = (x0, x1) => {
    let top = rh;
    let bot = 0;
    for (let y = 0; y < rh; y += 1) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) {
          if (y < top) top = y;
          if (y > bot) bot = y;
          break;
        }
      }
    }
    if (bot < top) return { y: 0, h: rh };
    return { y: Math.max(0, top - 2), h: Math.max(1, Math.min(rh, bot + 3) - Math.max(0, top - 2)) };
  };
  const textBand = trimY(cut, rw);
  const drawBand = trimY(0, cut);
  return {
    text: { ...slice, srcX: slice.srcX + cut, srcY: slice.srcY + textBand.y, srcW: rw - cut, srcH: textBand.h },
    drawing: { ...slice, srcY: slice.srcY + drawBand.y, srcW: cut, srcH: drawBand.h },
  };
}

function topLineSplit(bitmap, slice) {
  if (!slice || slice.srcH < 36 || slice.srcW < 40) return null;
  let image;
  try {
    image = bitmap.getContext('2d').getImageData(slice.srcX, slice.srcY, slice.srcW, slice.srcH);
  } catch (error) {
    return null;
  }
  const data = image.data;
  const rw = slice.srcW;
  const rh = slice.srcH;
  const bands = [];
  let start = -1;
  let blank = 0;
  for (let y = 0; y <= rh; y += 1) {
    let n = 0;
    if (y < rh) {
      for (let x = 0; x < rw; x += 3) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) n += 1;
      }
    }
    if (n > 1) {
      if (start < 0) start = y;
      blank = 0;
    } else if (start >= 0) {
      blank += 1;
      if (y === rh || blank > 3) {
        bands.push({ y: start, h: y - blank - start + 1 });
        start = -1;
        blank = 0;
      }
    }
  }
  if (bands.length < 2 || bands[0].h > rh * 0.22) return null;
  let textEnd = 1;
  const lineCap = Math.max(bands[0].h + 2, 12);
  while (textEnd < bands.length && bands[textEnd].h <= lineCap) {
    const gap = bands[textEnd].y - (bands[textEnd - 1].y + bands[textEnd - 1].h);
    if (gap > Math.max(6, bands[0].h)) break;
    textEnd += 1;
  }
  if (textEnd >= bands.length) return null;
  const gap = bands[textEnd].y - (bands[textEnd - 1].y + bands[textEnd - 1].h);
  const restH = bands[bands.length - 1].y + bands[bands.length - 1].h - bands[textEnd].y;
  if (gap < 4 || restH < bands[0].h * 2) return null;
  const textTop = Math.max(0, bands[0].y - 1);
  const textBot = bands[textEnd - 1].y + bands[textEnd - 1].h + 1;
  const drawTop = Math.max(0, bands[textEnd].y - 1);
  const drawBot = Math.min(rh, bands[bands.length - 1].y + bands[bands.length - 1].h + 2);
  return {
    text: { ...slice, srcY: slice.srcY + textTop, srcH: Math.max(1, textBot - textTop) },
    drawing: { ...slice, srcY: slice.srcY + drawTop, srcH: Math.max(1, drawBot - drawTop) },
  };
}

async function paintThumb(canvas) {
  const question = library.get(canvas.dataset.thumb);
  if (!question || !question.row || !levelAllows(question.source)) return;
  const rows = questionRows(question);
  let pieces = [];
  for (let index = 0; index < rows.length; index++) {
    const row = await clipThumbRow(question, rows[index]);
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
  const laid = [];
  pieces.forEach((piece) => {
    const split = besideSplit(piece.bitmap, piece.slice) || captionSplit(piece.bitmap, piece.slice) || topLineSplit(piece.bitmap, piece.slice);
    if (!split) laid.push(piece);
    else {
      laid.push({ bitmap: piece.bitmap, slice: split.text, role: 'text' });
      laid.push({ bitmap: piece.bitmap, slice: split.drawing, role: 'drawing' });
    }
  });
  const fitted = [];
  const wrapPiece = (piece, depth) => {
    const slice = piece.slice;
    const target = cardW - edge * 2;
    const fit = target / Math.max(1, slice.srcW);
    const displayH = slice.srcH * fit;
    const textTooSmall = piece.role === 'text' && displayH < 16;
    // The figure stays one piece. Only a short text line may break on a word gap.
    if (piece.role === 'drawing' || (!textTooSmall && displayH >= 22) || slice.srcW < slice.srcH * 8 || depth > 3) {
      fitted.push(piece);
      return;
    }
    const cut = wordGapCut(piece.bitmap, slice, piece.role === 'text');
    if (cut == null || cut < 8 || slice.srcW - cut < 8) {
      fitted.push(piece);
      return;
    }
    const rightW = slice.srcW - cut;
    wrapPiece({ bitmap: piece.bitmap, slice: { ...slice, srcX: slice.srcX + cut, srcW: rightW }, role: piece.role }, depth + 1);
    wrapPiece({ bitmap: piece.bitmap, slice: { ...slice, srcW: cut }, role: piece.role }, depth + 1);
  };
  laid.forEach((piece) => wrapPiece(piece, 0));
  pieces = fitted;
  const target = cardW - edge * 2;
  const scales = pieces.map((piece) => Math.min(1.5, target / Math.max(1, piece.slice.srcW)));
  const gaps = gutter * Math.max(0, pieces.length - 1);
  const limit = maxH - gaps - edge * 2;
  let body = pieces.reduce((sum, piece, index) => sum + piece.slice.srcH * scales[index], 0);
  if (body > limit && body > 0) {
    let over = body - limit;
    const drawingIdx = [];
    pieces.forEach((piece, index) => { if (piece.role === 'drawing') drawingIdx.push(index); });
    (drawingIdx.length ? drawingIdx : pieces.map((_, index) => index)).forEach((index) => {
      if (over <= 0) return;
      const height = pieces[index].slice.srcH * scales[index];
      const floor = Math.min(height, pieces[index].slice.srcH * 0.35);
      const cut = Math.min(over, Math.max(0, height - floor));
      if (height > cut) scales[index] *= (height - cut) / height;
      over -= cut;
    });
    if (over > 0) {
      pieces.forEach((piece, index) => {
        if (over <= 0 || piece.role === 'text') return;
        const height = piece.slice.srcH * scales[index];
        const floor = Math.min(height, 24);
        const cut = Math.min(over, Math.max(0, height - floor));
        if (height > cut && height > 0) scales[index] *= (height - cut) / height;
        over -= cut;
      });
    }
    if (over > 0) {
      const nextBody = pieces.reduce((sum, piece, index) => sum + piece.slice.srcH * scales[index], 0);
      const factor = limit / Math.max(1, nextBody);
      scales.forEach((_, index) => { scales[index] *= factor; });
    }
  }
  const dpr = window.devicePixelRatio || 1;
  let dh = edge * 2 + gaps;
  const drawn = pieces.map((piece, index) => {
    const sw = Math.max(1, Math.round(piece.slice.srcW * scales[index]));
    const sh = Math.max(1, Math.round(piece.slice.srcH * scales[index]));
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

const PDF_DOC_LIMIT = 4;

function rememberPdfDoc(cache, id, doc, limit) {
  const store = cache || pdfDocs;
  const cap = limit > 0 ? limit : PDF_DOC_LIMIT;
  if (store.has(id)) store.delete(id);
  store.set(id, doc);
  const dropped = [];
  while (store.size > cap) {
    const oldest = store.keys().next().value;
    dropped.push(store.get(oldest));
    store.delete(oldest);
  }
  dropped.forEach((old) => {
    if (old && typeof old.destroy === 'function') {
      try { old.destroy(); } catch (error) {}
    }
  });
  return doc;
}

async function loadPdf(source) {
  const active = source || SOURCE;
  if (!active || !active.pdfUrl) throw new Error('PDF_LIB');
  if (pdfDocs.has(active.pdfId)) {
    const cached = pdfDocs.get(active.pdfId);
    rememberPdfDoc(pdfDocs, active.pdfId, cached, PDF_DOC_LIMIT);
    return cached;
  }
  if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') throw new Error('PDF_LIB');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await window.pdfjsLib.getDocument({ url: active.pdfUrl || SOURCE.pdfUrl, withCredentials: false, isEvalSupported: false }).promise;
  rememberPdfDoc(pdfDocs, active.pdfId, doc, PDF_DOC_LIMIT);
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

const PRINT_DPI = 300;
const A4_WIDTH_PT = 595.276;

function sourceClip(source, page, segment) {
  const active = source || {};
  return {
    pdfUrl: active.pdfUrl || '',
    pdfId: active.pdfId || '',
    page: page || 0,
    segment: segment || '',
  };
}

function printCanvasScale(bitmapWidth) {
  if (bitmapWidth > 0) return bitmapWidth / 1000;
  return (PRINT_DPI / 72) * A4_WIDTH_PT / 1000;
}

async function pageBitmap(pageNumber, source, purpose) {
  const active = source || SOURCE;
  const print = purpose === 'print';
  const key = active.pdfId + ':' + pageNumber + (print ? ':print' : '');
  if (pageBitmaps.has(key)) return pageBitmaps.get(key);
  const pdf = await loadPdf(active);
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  // Print crops are a pdf.js render of the card's own PDF. The picker preview stays lighter.
  const scale = print ? PRINT_DPI / 72 : 1100 / base.width;
  const viewport = page.getViewport({ scale });
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
 * Question sentences sit to the right of a figure. A tagged figure's right
 * edge is the boundary; otherwise the text column starts just past the drawing.
 */
function textColumnX(question, page) {
  let edge = 0.36;
  (SOURCE.questions || []).forEach((item) => {
    const figure = item && item.figure;
    if (!figure || item.q !== question.q || item.page !== page) return;
    if (figure.x1 > 0.25 && figure.x1 < 0.72) edge = Math.max(edge, figure.x1 + 0.008);
  });
  return edge;
}

function addRightMask(question, box, y0, y1, role) {
  const height = box.h;
  if (!(height > 0)) return box;
  const top = Math.max(y0, box.y);
  const bot = Math.min(y1, box.y + height);
  if (bot - top < 0.01) return box;
  const x = textColumnX(question, box.page || question.page);
  const mask = {
    x,
    w: Math.max(0.05, 1 - x),
    y: (top - box.y) / height,
    h: (bot - top) / height,
    role,
  };
  return { ...box, masks: (box.masks || []).concat([mask]) };
}

/**
 * Lines of an earlier question that fall inside this crop are covered.
 * A shared drawing on the left stays. This question's own rows stay.
 */
function maskForeignBands(question, box) {
  const page = box.page || question.page;
  const top = box.y;
  const bot = top + box.h;
  const own = questionRows(question)
    .filter((row) => row && (row.page || question.page) === page)
    .map((row) => [row.y, row.y + row.h]);
  const spans = [];
  (SOURCE.questions || []).forEach((item) => {
    if (!item || !(item.q < question.q)) return;
    const bands = [];
    if (item.stem && item.stem.h > 0.008 && (item.stem.page || item.page) === page) {
      bands.push([item.stem.y, item.stem.y + item.stem.h]);
    }
    questionRows(item).forEach((row) => {
      if (row && (row.page || item.page) === page) bands.push([row.y, row.y + row.h]);
    });
    bands.forEach(([y0, y1]) => {
      let pieces = [[Math.max(top, y0), Math.min(bot, y1)]];
      own.forEach(([start, finish]) => {
        pieces = pieces.reduce((list, piece) => {
          const [low, high] = piece;
          if (high - low < 0.008 || high <= start || low >= finish) {
            if (high - low >= 0.008) list.push(piece);
            return list;
          }
          if (low < start - 0.004) list.push([low, start]);
          if (high > finish + 0.004) list.push([finish, high]);
          return list;
        }, []);
      });
      pieces.forEach((piece) => spans.push(piece));
    });
  });
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  spans.forEach(([low, high]) => {
    if (high - low < 0.008) return;
    const last = merged[merged.length - 1];
    if (last && low <= last[1] + 0.008) last[1] = Math.max(last[1], high);
    else merged.push([low, high]);
  });
  let next = box;
  merged.forEach(([low, high]) => {
    next = addRightMask(question, next, low, high, 'swallowed');
  });
  return next;
}

/**
 * An expanded shared figure may contain the other parts' lines. Those lines
 * stay out of the crop; the drawing on the left stays.
 */
function maskSiblingLines(question, box) {
  const page = box.page || question.page;
  const top = box.y;
  const bot = top + box.h;
  const own = questionRows(question)
    .filter((row) => row && (row.page || question.page) === page)
    .map((row) => [row.y, row.y + row.h]);
  let next = box;
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q || item.id === question.id) return;
    questionRows(item).forEach((row) => {
      if (!row || (row.page || item.page) !== page) return;
      let pieces = [[Math.max(top, row.y), Math.min(bot, row.y + row.h)]];
      own.forEach(([start, finish]) => {
        pieces = pieces.reduce((list, piece) => {
          const [low, high] = piece;
          if (high - low < 0.01 || high <= start || low >= finish) {
            if (high - low >= 0.01) list.push(piece);
            return list;
          }
          if (low < start - 0.004) list.push([low, start]);
          if (high > finish + 0.004) list.push([finish, high]);
          return list;
        }, []);
      });
      pieces.forEach(([low, high]) => {
        if (high - low >= 0.01) next = addRightMask(question, next, low, high, 'sibling');
      });
    });
  });
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
 * A part printed alone keeps its own label. An earlier row that happens to
 * overlap is not pulled in: that overlap is how the previous part was reprinted.
 * A tagged shared figure (the house) still expands to the whole drawing.
 * figure.y0 can sit halfway through the first label, so the top may rise by
 * one line onto that label's white row, and no further.
 */
function coverSharedFigure(question, box, laterSelected) {
  const page = box.page || question.page;
  const originalEnd = boxEnd(box);
  const line = question.line > 0 ? question.line : 0.026;
  let top = box.y;
  let end = originalEnd;
  const masks = [];
  const ownMask = absoluteMask(box);
  if (ownMask) masks.push(ownMask);
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q || item.id === question.id) return;
    questionRows(item).forEach((other) => {
      if (!other || (other.page || item.page) !== page) return;
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
  let lineTop = top;
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q) return;
    questionRows(item).forEach((other) => {
      if (!other || (other.page || item.page) !== page) return;
      if (other.y < top - 0.0004 && top - other.y <= line && boxEnd(other) > top + 0.001) lineTop = Math.min(lineTop, other.y);
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

function nextPartLabel(question, page, y) {
  let best = null;
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item === question || item.q !== question.q) return;
    const marks = [];
    if (item.box && (item.box.page || item.page) === page) marks.push(item.box.y);
    if (item.labelLine && (item.labelLine.page || item.page) === page) marks.push(item.labelLine.y);
    marks.forEach((boundary) => {
      if (boundary <= y + 0.008) return;
      if (best == null || boundary < best) best = boundary;
    });
  });
  return best;
}

/**
 * A measured row can start inside its own label and run through the next one.
 * Lift the top to the pin when that pin still sits on this label, and stop at
 * the next part's label. The pin of the next part can sit inside this drawing,
 * so the label line is the boundary, not the pin.
 */
function alignLabelCrop(question, box) {
  const page = box.page || question.page;
  const mark = question.box;
  const line = question.line > 0 ? question.line : 0.026;
  let y = box.y;
  let end = box.y + box.h;
  if (mark && (mark.page || question.page) === page && mark.y < y && y - mark.y <= line * 0.65) y = mark.y;
  const nextLabel = nextPartLabel(question, page, y);
  if (nextLabel != null && nextLabel > y + 0.012 && nextLabel < end) end = nextLabel;
  if (end - y < 0.012) return box;
  return end === box.y + box.h && y === box.y ? box : { ...box, y, h: end - y };
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
      const stem = question.stem;
      const line = question.line > 0 ? question.line : 0.026;
      // A stem shorter than half a line is the clipped top of the first label, not the question text.
      if (stem && stem.h >= line * 0.5) {
        const stemBox = maskForeignBands(question, { ...stem, page: stem.page || question.page });
        slices.push({ page: stemBox.page, box: stemBox, gap: 10, block, kind: 'stem' });
      }
      lastQuestion = question.q;
    }
    const rows = question.rows && question.rows.length ? question.rows : [question.row];
    rows.forEach((box) => {
      const page = box.page || question.page;
      let next = alignLabelCrop(question, { ...box, page });
      const prev = previousQuestionRow(slices, block, page);
      const laterSelected = ordered.some((other) => (
        other !== question && other.q === question.q && other.row
        && (other.row.page || other.page) === page && other.row.y > box.y + 0.004
      ));
      // The first selected part of this question can still own a shared drawing.
      if (!prev) next = coverSharedFigure(question, next, laterSelected);
      next = maskSiblingLines(question, maskForeignBands(question, next));
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
      if (!dup) slices.push({ page, box: clearDrawingStroke(question, next), gap, block, kind: 'row', partId: question.id });
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

// The label text keeps its size, so a scaled answer still needs room for it.
function scaleAnswerCell(cell, factor) {
  const imageW = Math.max(1, Math.round(cell.imageW * factor));
  const imageH = Math.max(1, Math.round(cell.imageH * factor));
  const labelW = cell.labelW || 0;
  const labelBaseline = cell.labelBaseline || 16;
  const imageY = cell.stack ? 0 : Math.round((cell.imageY || 0) * factor);
  const dh = cell.stack
    ? Math.max(18, 18 + imageH)
    : Math.max(18, labelBaseline + 4, imageY + imageH);
  const dw = cell.stack ? Math.max(labelW, imageW) : labelW + 8 + imageW;
  return {
    ...cell,
    imageW,
    imageH,
    imageY,
    answerScale: (cell.answerScale || 1) * factor,
    dw,
    dh,
  };
}

function scalePlaced(item, factor) {
  const next = {
    ...item,
    dh: Math.max(1, Math.round(item.dh * factor)),
    slice: { ...item.slice, gap: scaledGap(item.slice.gap, factor) },
  };
  if (item.dw) {
    next.dw = Math.max(1, Math.round(item.dw * factor));
    next.dx = Math.round((item.dx || 0) * factor);
  }
  if (factor !== 1 && item.cells) {
    next.cells = item.cells.map((cell) => (cell.imageH ? scaleAnswerCell(cell, factor) : cell));
    next.dh = Math.max(next.dh, ...next.cells.map((cell) => cell.dh));
  } else if (factor !== 1 && item.imageH) {
    const cell = scaleAnswerCell(item, factor);
    Object.assign(next, { imageW: cell.imageW, imageH: cell.imageH, imageY: cell.imageY, answerScale: cell.answerScale });
    next.dw = cell.dw;
    next.dh = Math.max(next.dh, cell.dh);
  }
  return next;
}

function shrinkTo(items, limit) {
  const height = contentHeight(items);
  if (height <= limit) return items;
  const factor = limit / height;
  const scaled = items.map((item) => scalePlaced(item, factor));
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
    const bitmap = await pageBitmap(slice.page, SOURCE, 'print');
    const sw = slice.box.w * bitmap.width;
    const sh = slice.box.h * bitmap.height;
    measured.push({ slice, bitmap, sw, sh, dh: Math.max(1, Math.round(OUT_W * sh / sw)) });
  }
  bakeMeasuredClips(measured);
  releasePageBitmaps();
  const packs = packShort(measured);
  root.innerHTML = packs.map((_, index) => (
    `<figure class="crop-sheet"><canvas></canvas><figcaption>דף מצומצם ${index + 1} מתוך ${packs.length} · ${escapeHTML(SOURCE.title)}</figcaption></figure>`
  )).join('');
  const canvases = root.querySelectorAll('canvas');
  packs.forEach((items, index) => {
    let height = 0;
    items.forEach((item, itemIndex) => { height += (itemIndex ? item.slice.gap : 0) + item.dh; });
    const canvas = canvases[index];
    const sample = items.find((item) => item.bitmap && item.bitmap.width);
    const scale = printCanvasScale(sample ? (sample.originalPageWidth || sample.bitmap.width) : 0);
    canvas.width = Math.round(OUT_W * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT_W, height);
    let y = 0;
    items.forEach((item, itemIndex) => {
      if (itemIndex) y += item.slice.gap;
      const sx = item.baked ? 0 : item.slice.box.x * item.bitmap.width;
      const sy = item.baked ? 0 : item.slice.box.y * item.bitmap.height;
      const sw = item.baked ? item.bitmap.width : item.sw;
      const sh = item.baked ? item.bitmap.height : item.sh;
      ctx.drawImage(item.bitmap, sx, sy, sw, sh, 0, y, OUT_W, item.dh);
      fillSliceMasks(ctx, item.slice.box, y, item.dh, OUT_W);
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
  /**
   * A part whose first line is only a word or two continues on the next line.
   * That next line is still this part until another part label or the next question.
   */
  function wrappedAnswerLines(label, left, right, bottom, nextMarker) {
    const width = right - left;
    const onLine = (items || []).filter((item) => {
      const y = item.y || 0;
      if (Math.abs(y - label.y) > 6) return false;
      const x = item.x || 0;
      // A neighbour that only grazes the slot is the next part's text, not this answer.
      const overlap = Math.min(x + (item.w || 0), right - 1) - Math.max(x, left + 1);
      return overlap >= 8;
    });
    const text = onLine.map((item) => String(item.str || '').trim()).join(' ').replace(/[·•]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text.split(' ').filter((word) => word && !/^[אבגדהו]\.?$/.test(word) && word !== '.');
    if (width > 90 && words.length > 3) return null;
    if (words.length > 4) return null;
    const line = Math.max(label.h || 12, 12);
    const floor = nextMarker ? nextMarker.y + Math.max(nextMarker.h || 0, 10) + 2 : label.y - line * 4;
    const following = (items || []).filter((item) => {
      const y = item.y || 0;
      if (y > label.y - line * 0.55) return false;
      if (y < floor) return false;
      return true;
    }).sort((a, b) => b.y - a.y);
    if (!following.length) return null;
    const taken = [];
    let cursor = label.y;
    following.forEach((item) => {
      if (item.y < cursor - line * 1.6) return;
      // A rotated margin line is taller than the text and is not the next answer line.
      if ((item.h || 0) > line * 2.5) return;
      const token = String(item.str || '');
      // "ד. הוכחה" on the next line is the next part, not this answer's continuation.
      if (/[·•]\s*[אבגדהו]\./.test(token) || /^[אבגדהו]\./.test(token.trim()) || /^[אבגדהו]\.?$/.test(token.trim()) || /^\(\d{1,2}\)$/.test(token.trim()) || /^\d{1,2}\.$/.test(token.trim())) return;
      taken.push(item);
      cursor = Math.min(cursor, item.y);
    });
    if (!taken.length) return null;
    let nextLeft = left;
    let nextRight = right;
    let nextBottom = bottom;
    let nextTop = label.y;
    taken.forEach((item) => {
      const x = item.x || 0;
      const y = item.y || 0;
      nextLeft = Math.min(nextLeft, x);
      nextRight = Math.max(nextRight, x + Math.max(item.w || 0, 8));
      nextBottom = Math.min(nextBottom, y - 2);
      nextTop = Math.max(nextTop, y + Math.max(item.h || 0, 10));
    });
    if (nextRight - nextLeft < width + 8 && nextBottom > bottom - 4) return null;
    return { left: nextLeft, right: nextRight, bottom: nextBottom, top: nextTop };
  }

  const markers = [];
  items.forEach((item) => {
    const n = markerNumber(item, items);
    if (n == null) return;
    markers.push(item);
  });
  if (!markers.length) return null;
  const rightEdge = Math.max.apply(null, markers.map((item) => item.x || 0));
  const column = markers.filter((item) => (item.x || 0) >= rightEdge - 36);
  const marker = column.find((item) => markerNumber(item, items) === Number(questionNumber));
  if (!marker) return null;
  const sameSheet = (item) => item.page == null || marker.page == null || item.page === marker.page;
  const next = column
    .filter((item) => sameSheet(item) && item !== marker && item.y < marker.y - 4)
    .sort((a, b) => b.y - a.y)[0];
  const bandTop = marker.y + 8;
  const bandBottom = next ? next.y + 8 : marker.y - 40;
  const labels = [];
  items.forEach((item) => {
    if (!sameSheet(item) || item.y > bandTop || item.y < bandBottom) return;
    const foundLabels = answerLabels(item);
    const found = foundLabels.length ? foundLabels : [answerPart(item, items)].filter(Boolean).map((one) => ({
      ...one,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      page: item.page,
    }));
    found.forEach((label) => {
      if (labels.some((have) => have.part === label.part && Math.abs(have.y - (label.y || item.y)) <= 4)) return;
      labels.push({
        str: label.part + '.',
        x: label.x,
        y: label.y,
        w: label.w,
        h: label.h,
        page: label.page,
        part: label.part,
        rest: label.rest,
        embedded: !!label.embedded,
        markX: label.markX,
        markW: label.markW,
      });
    });
  });
  labels.sort((a, b) => (Math.abs(a.y - b.y) > 4 ? b.y - a.y : b.x - a.x));
  // PDF y grows upward. Stop above the next glyph top so the next row is not in the window.
  const aboveGlyphs = (token) => token.y + Math.max(token.h || 0, 11) + 2;
  let left = 28;
  let right = marker.x - 4;
  let top = marker.y + Math.max(marker.h || 0, 12) + 4;
  let bottom = next ? aboveGlyphs(next) : marker.y - 28;
  let slot = null;
  if (part) {
    const index = labels.findIndex((item) => item.part === part);
    if (index >= 0) {
      const label = labels[index];
      const follower = labels[index + 1];
      const nextOnLine = follower && Math.abs(follower.y - label.y) <= 6 ? follower : null;
      const owned = label.markX != null;
      const markLeft = owned ? label.markX : label.x;
      // The answer sits to the left of its own "· ד." marker. The previous part's
      // unit ("ס״מ", "אחוזים") sits to the right of that marker and is not this item.
      if (owned && label.rest) right = markLeft + 2;
      else if (owned) right = markLeft - 1;
      else if (label.rest) right = label.x + Math.max(label.w || 0, 4) + 2;
      else right = label.x - 1;
      if (nextOnLine && nextOnLine.markX != null) {
        left = nextOnLine.markX + (nextOnLine.markW || 8) + 1.2;
      } else if (nextOnLine) left = nextOnLine.x + Math.max(nextOnLine.w || 0, 8) + 2;
      else if (owned && label.rest) left = label.x;
      else left = 28;
      if (owned && label.rest) {
        const padded = label.x - 4;
        if (padded < right - 6) left = Math.min(left, padded);
        else left = Math.min(left, label.x);
      }
      if (left > right - 6 && label.rest) left = Math.min(left, owned ? label.x : right - 8);
      top = label.y + Math.max(label.h || 0, 12) + 3;
      const slotLeft0 = left;
      const slotRight0 = right;
      (items || []).forEach((glyph) => {
        const gy = glyph.y || 0;
        if (Math.abs(gy - label.y) > 5) return;
        const gx = glyph.x || 0;
        const gw = glyph.w || 0;
        const overlap = Math.min(gx + gw, slotRight0) - Math.max(gx, slotLeft0);
        if (overlap < 4) return;
        // A "·" between answers is the next item's separator, not this answer.
        const token = String(glyph.str || '').trim();
        if (/^[·•.]+$/.test(token) || /^[·•]\s*[אבגדהו]\.?\s*$/.test(token)) return;
        top = Math.max(top, gy + Math.max(glyph.h || 0, 12) + 2);
        // A digit the marker only grazes still belongs to this answer. The next part does not.
        if (gx >= slotLeft0 - 6) left = Math.min(left, gx - 1);
        if (gx + gw <= slotRight0 + 6) right = Math.max(right, gx + gw + 1);
      });
      const nextInk = nextOnLine ? null : (follower ? aboveGlyphs(follower) : (next ? aboveGlyphs(next) : null));
      if (nextOnLine) bottom = label.y - 6;
      else if (nextInk != null) bottom = nextInk;
      else bottom = label.y - 28;
      // Keep the label's own ink, but do not step down into the next part.
      if (bottom > label.y - 4) bottom = nextInk != null ? Math.max(label.y - 6, nextInk) : label.y - 6;
      const slotLeft = left;
      const slotRight = right;
      // A neighbour on this line already bounds the slot. The line below a short
      // middle answer belongs to the part that runs out to the margin.
      const wrapped = nextOnLine ? null : wrappedAnswerLines(label, left, right, bottom, next);
      if (wrapped) {
        left = Math.min(left, wrapped.left);
        right = Math.max(right, wrapped.right);
        bottom = Math.min(bottom, wrapped.bottom);
        top = Math.max(top, wrapped.top);
        // The rest of the line belongs to the other parts. Keep only this part's slot there.
        if (right > slotRight + 8 || left < slotLeft - 8) {
          slot = {
            left: slotLeft,
            right: slotRight,
            lineBottom: label.y - 1,
            lineTop: label.y + Math.max(label.h || 0, 11) + 2,
          };
        }
        // "· ד. כל" leaves כל to the left of the part letter. Cover the whole label line.
        // The sentence that continues under it stays, and the part name is redrawn.
        if (String(label.rest || '').trim() === 'כל') {
          // wrapped.top starts at the label baseline, so it is not the next line.
          // The dots under «כל» sit about two points under that baseline, and the
          // continuation's em top is a little lower still.
          const descent = Math.max(4, (label.h || 11) * 0.4);
          let continuationTop = label.y - (label.h || 11);
          (items || []).forEach((glyph) => {
            const gy = glyph.y || 0;
            if (gy >= label.y - 4 || gy < label.y - 28) return;
            const top = gy + Math.max(glyph.h || 0, 10);
            if (top < label.y - 1 && top > continuationTop) continuationTop = top;
          });
          slot = {
            left: 0,
            right: 0,
            lineBottom: Math.max(label.y - descent, continuationTop + 1.2),
            lineTop: label.y + Math.max(label.h || 0, 11) + 2,
          };
        }
      } else {
        // A one-word answer has no second line. Do not keep a blank band under it.
        const inkBelow = (items || []).some((glyph) => {
          const gy = glyph.y || 0;
          if (gy >= label.y - 4 || gy <= bottom + 1) return false;
          const gx = glyph.x || 0;
          const gw = glyph.w || 0;
          return gx + gw > left + 2 && gx < right - 2;
        });
        if (!inkBelow && bottom < label.y - 6) bottom = label.y - 6;
        if (!nextOnLine && left <= 30) {
          let inkLeft = right;
          (items || []).forEach((glyph) => {
            const gy = glyph.y || 0;
            if (Math.abs(gy - label.y) > 5) return;
            const gx = glyph.x || 0;
            const gw = glyph.w || 0;
            if (gx + gw < left + 4 || gx >= right - 1) return;
            if (gx < inkLeft) inkLeft = gx;
          });
          if (inkLeft < right - 6) left = Math.max(0, inkLeft - 2);
        }
      }
    } else if (labels.length) {
      const mentioned = items.some((item) => (
        sameSheet(item)
        && item.y <= bandTop
        && item.y >= bandBottom
        && new RegExp('(?:^|[\\s·•.])' + part + '(?:$|[\\s.·•—])').test(String(item.str || ''))
      ));
      if (!mentioned) return null;
    }
  }
  if (top - bottom < 8 || right - left < 6) return null;
  const box = { page: marker.page, x: left, y: bottom, w: right - left, h: top - bottom };
  if (slot) box.slot = slot;
  return box;
}

function markerNumber(item, items) {
  const text = String(item.str || '').trim();
  let match = text.match(/^\((\d{1,2})\)$/) || text.match(/^\)(\d{1,2})\($/);
  if (match) return Number(match[1]);
  match = text.match(/^(\d{1,2})\.$/);
  if (match) return Number(match[1]);
  if (!/^\d{1,2}$/.test(text)) return null;
  const dotted = items.some((other) => (
    other !== item
    && String(other.str || '').trim() === '.'
    && Math.abs((other.y || 0) - (item.y || 0)) <= 3
    && other.x < item.x
    && item.x - other.x <= 16
  ));
  return dotted ? Number(text) : null;
}

function measureAnswerUnits(text) {
  let n = 0;
  const value = String(text || '');
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (/[\u0590-\u05FF]/.test(ch)) n += 1;
    else if (/[0-9A-Za-z]/.test(ch)) n += 0.56;
    else n += 0.32;
  }
  return n;
}

function answerSliceBox(item, start, end) {
  const text = String(item.str || '');
  const width = item.w || 0;
  const total = Math.max(measureAnswerUnits(text), 0.01);
  const rtl = item.dir !== 'ltr' || /[\u0590-\u05FF]/.test(text);
  const span = Math.max(measureAnswerUnits(text.slice(start, end)), 0.2);
  if (!rtl || !(width > 0)) {
    const from = measureAnswerUnits(text.slice(0, start));
    return { x: (item.x || 0) + (from / total) * width, w: Math.max(4, (span / total) * width) };
  }
  const rightEdge = (item.x || 0) + width - (measureAnswerUnits(text.slice(0, start)) / total) * width;
  const leftEdge = rightEdge - (span / total) * width;
  return { x: leftEdge, w: Math.max(4, rightEdge - leftEdge) };
}

function answerLabels(item) {
  const text = String(item.str || '');
  const marks = [];
  // "· ד. הוכחה" and "· ג56" are both this part. A dot is not required when a digit follows.
  const re = /(?:^|[·•])\s*([אבגדהו])(?:\.|(?=\d)|(?=\s*$))/g;
  let match;
  while ((match = re.exec(text))) {
    const embedded = match.index > 0 || text[match.index] === '·' || text[match.index] === '•';
    marks.push({ part: match[1], index: match.index, end: match.index + match[0].length, embedded });
  }
  if (!marks.length) return [];
  return marks.map((mark, index) => {
    const next = marks[index + 1];
    const restEnd = next ? next.index : text.length;
    const rest = text.slice(mark.end, restEnd).trim();
    const markBox = answerSliceBox(item, mark.index, mark.end);
    const foreign = text.slice(0, mark.index).replace(/[\s.·•]/g, '');
    // A token that is only this part keeps its full width. A shared token keeps this part's words.
    const sole = marks.length === 1 && !foreign;
    const own = sole ? { x: item.x, w: Math.max(item.w || 0, 8) } : (rest ? answerSliceBox(item, mark.end, restEnd) : markBox);
    return {
      part: mark.part,
      rest,
      embedded: mark.embedded || marks.length > 1,
      x: own.x,
      y: item.y,
      w: own.w,
      h: item.h,
      page: item.page,
      markX: sole ? undefined : markBox.x,
      markW: sole ? undefined : markBox.w,
    };
  });
}

function answerPart(item, items) {
  const text = String(item.str || '').trim();
  const combined = text.match(/^([אבגדהו])\.\s*(.*)$/) || text.match(/^\.\s*([אבגדהו])\s*(.*)$/);
  if (combined) return { part: combined[1], rest: combined[2], embedded: false };
  const embedded = text.match(/[·•]\s*([אבגדהו])\.\s*(.*)$/);
  if (embedded) return { part: embedded[1], rest: embedded[2], embedded: true };
  if (/^[אבגדהו]$/.test(text)) {
    const dot = items.some((other) => (
      other !== item
      && String(other.str || '').trim() === '.'
      && Math.abs((other.y || 0) - (item.y || 0)) <= 3
      && Math.abs((other.x || 0) - (item.x || 0)) <= 16
    ));
    if (dot) return { part: text, rest: '' };
  }
  return null;
}

function answerRegions(pages) {
  const found = [];
  let open = false;
  (pages || []).forEach((sheet) => {
    const items = sheet.items || [];
    const title = items.find((item) => String(item.str || '').includes('תשובות סופיות'));
    if (title) {
      open = true;
      found.push({ ...sheet, items: items.filter((item) => (item.y || 0) <= title.y + 12) });
    } else if (open) found.push(sheet);
  });
  return found;
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
      if (groups.length > 1 && entry.source && printedLevelLabel(entry.source)) {
        slices.push({ kind: 'level', text: printedLevelLabel(entry.source), gap: index ? 18 : 8, block: 'level-' + entry.source.pdfId, source: entry.source });
      }
      SOURCE = entry.source;
      shortSlices(entry.questions).forEach((slice) => {
        if (slice.kind === 'header' || slice.kind === 'footer') return;
        const box = slice.box;
        // A continuation page stores the running header as its own row.
        if (box && box.y < 0.05 && box.y + box.h < 0.075) return;
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
      dir: item.dir || '',
      page: number,
    }));
    const viewport = page.getViewport({ scale: 1 });
    found.push({ page: number, width: viewport.width, height: viewport.height, items });
  }
  return answerRegions(found);
}

function partLabelToken(text) {
  const token = String(text || '').trim();
  if (/^[אבגדהו]\.?$/.test(token) || /^\.[אבגדהו]$/.test(token)) return true;
  if (/^\(\d{1,2}\)$/.test(token) || /^\)\d{1,2}\($/.test(token) || /^\d{1,2}\.$/.test(token)) return true;
  return false;
}

function clipForeignLabels(items, box, part) {
  let x0 = box.x;
  let y0 = box.y;
  let x1 = box.x + box.w;
  let y1 = box.y + box.h;
  (items || []).forEach((item) => {
    const token = String(item.str || '').trim();
    const match = token.match(/^([אבגדהו])\.$/) || token.match(/^\.([אבגדהו])$/);
    if (!match || match[1] === part) return;
    const gx = item.x || 0;
    const gy = item.y || 0;
    const right = gx + Math.max(item.w || 0, 6);
    const top = gy + Math.max(item.h || 0, 8);
    const overlapX = Math.min(x1, right) - Math.max(x0, gx);
    const overlapY = Math.min(y1, top) - Math.max(y0, gy);
    if (overlapX < 0.4 || overlapY < 0.4) return;
    const sameLine = gy >= y1 - 18;
    if (sameLine && right < x1 - 4) x0 = Math.max(x0, right + 1.2);
    else if (sameLine && gx > x0 + 8 && gx < x1) x1 = Math.min(x1, gx - 1.2);
    else if (!sameLine && top < y1 - 4) y0 = Math.max(y0, top + 1.2);
  });
  if (x1 - x0 < 4 || y1 - y0 < 6) return box;
  return { ...box, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function manifestAnswerList(pages, question) {
  const found = [];
  (pages || []).forEach((sheet) => {
    const manifest = sheet && sheet.manifest;
    const entry = manifest && manifest.pages && manifest.pages[String(sheet.page)];
    (entry && entry.answers || []).forEach((box) => {
      if (Number(box.q) !== Number(question.q) || !box.part) return;
      found.push({
        page: sheet.page,
        part: box.part,
        box: { x: box.x, y: box.y, w: box.w, h: box.h, locked: true },
      });
    });
  });
  return found;
}

function manifestAnswer(pages, question) {
  const part = question.part || '';
  if (!part) return null;
  for (let index = 0; index < pages.length; index += 1) {
    const sheet = pages[index];
    const manifest = sheet && sheet.manifest;
    const entry = manifest && manifest.pages && manifest.pages[String(sheet.page)];
    if (!entry || !entry.answers) continue;
    const hit = entry.answers.find((box) => Number(box.q) === Number(question.q) && box.part === part);
    if (!hit) continue;
    return {
      page: sheet.page,
      box: { x: hit.x, y: hit.y, w: hit.w, h: hit.h, locked: true },
    };
  }
  return null;
}

function answerSliceFor(pages, question) {
  const fromManifest = manifestAnswer(pages, question);
  if (fromManifest) return fromManifest;
  const part = question.part || '';
  for (let index = 0; index < pages.length; index += 1) {
    const sheet = pages[index];
    const all = sheet.items || [];
    const title = all.find((item) => String(item.str || '').includes('תשובות סופיות'));
    // The question that introduces the key can share the page. Its number is not an answer.
    const items = title ? all.filter((item) => (item.y || 0) <= title.y + 12) : all;
    const raw = answerBox(items, question.q, part);
    if (!raw || raw.page !== sheet.page) continue;
    // A wrapped line runs under the other parts. Masks hide those parts; clipping would cut the line.
    // A whole-question answer owns every part label in its band.
    const box = raw.slot || !part ? raw : clipForeignLabels(items, raw, part);
    const pad = 2;
    const gap = 1.2;
    let x0 = Math.max(0, box.x - pad);
    let y0 = Math.max(0, box.y - pad);
    let x1 = Math.min(sheet.width, box.x + box.w + pad);
    let y1 = Math.min(sheet.height, box.y + box.h + pad);
    items.forEach((item) => {
      if (!partLabelToken(item.str)) return;
      const gx = item.x || 0;
      const gy = item.y || 0;
      const gw = Math.max(item.w || 0, 6);
      const gh = Math.max(item.h || 0, 8);
      const right = gx + gw;
      const top = gy + gh;
      const crossesY = top > y0 && gy < y1;
      const crossesX = right > x0 && gx < x1;
      // The next part sits to the left in RTL. Do not pad across its label.
      if (crossesY && right <= box.x + 0.8) x0 = Math.max(x0, Math.min(box.x, right + gap));
      if (crossesY && gx >= box.x + box.w - 0.8) x1 = Math.min(x1, Math.max(box.x + box.w, gx - gap));
      if (crossesX && gy >= box.y + box.h - 0.8) y1 = Math.min(y1, Math.max(box.y + box.h, gy - gap));
      if (crossesX && top <= box.y + 0.8) y0 = Math.max(y0, Math.min(box.y, top + gap));
    });
    if (x1 - x0 < 4 || y1 - y0 < 6) {
      x0 = box.x;
      y0 = box.y;
      x1 = box.x + box.w;
      y1 = box.y + box.h;
    }
    // The rotated copyright sits in the left margin. It is not part of the answer.
    if (x0 < 24) x0 = 24;
    const masks = [];
    const slot = raw.slot;
    if (slot && x1 - x0 > 4 && y1 - y0 > 4) {
      const cover = (mx0, mx1) => {
        const leftEdge = Math.max(mx0, x0);
        const rightEdge = Math.min(mx1, x1);
        const low = Math.max(slot.lineBottom, y0);
        const high = Math.min(slot.lineTop, y1);
        if (rightEdge - leftEdge < 4 || high - low < 3) return;
        masks.push({
          x: (leftEdge - x0) / (x1 - x0),
          y: (y1 - high) / (y1 - y0),
          w: (rightEdge - leftEdge) / (x1 - x0),
          h: (high - low) / (y1 - y0),
          role: 'answer-sibling',
        });
      };
      if (x1 > slot.right + 4) cover(slot.right, x1);
      if (slot.left > x0 + 4) cover(x0, slot.left);
    }
    return {
      page: sheet.page,
      box: {
        x: x0 / sheet.width,
        y: (sheet.height - y1) / sheet.height,
        w: (x1 - x0) / sheet.width,
        h: (y1 - y0) / sheet.height,
        wrap: masks.length > 0,
        masks: masks.length ? masks : undefined,
      },
    };
  }
  return null;
}

function answerRowGap(prev) {
  if (!prev) return 10;
  // The heading must clear the first answer. A two-line answer needs air above the next label.
  if (prev.kind === 'answers-head') return 26;
  const height = prev.box && prev.box.h;
  if (height > 0.022) return 16;
  return 10;
}

async function answerSlices(chosen) {
  const ordered = worksheetOrder(chosen);
  const slices = [{ kind: 'answers-head', text: 'תשובות', gap: 20, block: 'answers' }];
  const missing = [];
  const cache = new Map();
  for (let index = 0; index < ordered.length; index += 1) {
    const question = ordered[index];
    const source = question.source;
    const levelName = printedLevelLabel(source);
    const label = (levelName ? levelName + ' · ' : '') + (question.label || ('שאלה ' + question.q));
    let pages = source ? cache.get(source.pdfId) : [];
    if (source && !cache.has(source.pdfId)) {
      pages = await answerPages(source);
      const manifest = await loadCropManifest(source.pdfId);
      (pages || []).forEach((sheet) => {
        sheet.manifest = manifest;
      });
      cache.set(source.pdfId, pages);
    }
    // A question with no part letter still has א ב ג ד on the key. Each one is its own row.
    const listed = !question.part && pages && pages.length ? manifestAnswerList(pages, question) : [];
    if (listed.length > 1) {
      listed.forEach((hit) => {
        slices.push({
          kind: 'answer',
          text: label + ' סעיף ' + hit.part,
          page: hit.page,
          box: hit.box,
          gap: answerRowGap(slices[slices.length - 1]),
          block: 'answers',
          source,
          questionId: String(question.q) + hit.part,
          clip: sourceClip(source, hit.page, 'answer'),
        });
      });
      continue;
    }
    const found = pages && pages.length ? answerSliceFor(pages, question) : null;
    if (!found) {
      missing.push(label);
      const pageNo = pages && pages.length ? pages[0].page : 0;
      const note = pageNo
        ? label + ' — ראו דף התשובות במקור, עמוד ' + pageNo
        : label + ' — אין תשובה במקור';
      slices.push({ kind: 'missing', text: note, gap: 6, block: 'answers', source });
    } else {
      slices.push({
        kind: 'answer',
        text: label,
        page: found.page,
        box: found.box,
        gap: answerRowGap(slices[slices.length - 1]),
        block: 'answers',
        source,
        questionId: question.id,
        clip: sourceClip(source, found.page, 'answer'),
      });
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

function printedLevelLabel(source) {
  const level = source && source.level;
  if (level === 'a') return 'רמה א׳';
  if (level === 'b') return 'רמה ב׳';
  if (level === 'c') return 'מצוינות';
  const label = source && source.levelLabel ? String(source.levelLabel) : '';
  return label.replace('רמת מצוינות', 'מצוינות');
}

function sheetTitle(chosen) {
  const topics = [];
  const levels = [];
  chosen.forEach((question) => {
    const source = question.source;
    if (!source) return;
    const topic = source.topic || '';
    if (topic && topics.indexOf(topic) < 0) topics.push(topic);
    const level = printedLevelLabel(source);
    if (level && levels.indexOf(level) < 0) levels.push(level);
  });
  const topic = topics.join(' · ') || 'דף תרגול';
  if (levels.length === 1) return topic + ' · ' + levels[0];
  return topic;
}

const pageTextCache = new Map();

async function pageTextItems(pageNumber, source) {
  const active = source || SOURCE;
  const key = (active && active.pdfId ? active.pdfId : '') + ':' + pageNumber;
  if (pageTextCache.has(key)) return pageTextCache.get(key);
  const pdf = await loadPdf(active);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const text = await page.getTextContent();
  const items = text.items.filter((item) => item.str && String(item.str).trim()).map((item) => {
    const height = item.height || Math.abs(item.transform[3]) || 8;
    return {
      str: String(item.str),
      x: item.transform[4] / viewport.width,
      y: (viewport.height - item.transform[5] - height) / viewport.height,
      w: (item.width || 0) / viewport.width,
      h: height / viewport.height,
    };
  });
  pageTextCache.set(key, items);
  return items;
}

function trailingSheetHeader(text) {
  const value = String(text || '');
  if (value.includes('בהצלחה')) return true;
  // "חלק ב׳ — הקניה" is the next section. "החלק שהוסר" and "פיתגורס חלק 2" are not.
  return /חלק\s*[אבגדהו]\s*[׳'״"]/.test(value) || /חלק\s*[אבגדהו]\s*[—–-]/.test(value);
}

function clipBoxAboveSheetHeader(box, items) {
  if (!box) return box;
  let cut = box.y + box.h;
  const lines = [];
  (items || []).forEach((item) => {
    const y = item.y || 0;
    if (y <= box.y + 0.008 || y >= box.y + box.h) return;
    const text = String(item.str || '');
    const line = lines.find((have) => Math.abs(have.y - y) <= 0.006);
    if (line) {
      line.text += ' ' + text;
      line.y = Math.min(line.y, y);
    } else lines.push({ y, text });
  });
  lines.forEach((line) => {
    if (!trailingSheetHeader(line.text)) return;
    cut = Math.min(cut, line.y - 0.004);
  });
  if (cut >= box.y + box.h - 0.0005) return box;
  return { ...box, h: Math.max(0.004, cut - box.y) };
}

async function clipClosingLine(slice) {
  const box = slice.box;
  if (!box || slice.kind === 'answer') return slice;
  let items = [];
  try {
    items = await pageTextItems(slice.page, slice.source);
  } catch (error) {
    return slice;
  }
  const next = clipBoxAboveSheetHeader(box, items);
  if (next === box || (next.y === box.y && Math.abs(next.h - box.h) < 0.0005)) return slice;
  return { ...slice, box: next };
}

function sliceInkRows(bitmap, box) {
  const width = bitmap.width;
  const height = bitmap.height;
  const x0 = Math.max(0, Math.floor(box.x * width));
  const y0 = Math.max(0, Math.floor(box.y * height));
  const x1 = Math.min(width, Math.ceil((box.x + box.w) * width));
  const y1 = Math.min(height, Math.ceil((box.y + box.h) * height));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  let image;
  try {
    image = bitmap.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0);
  } catch (error) {
    return null;
  }
  const data = image.data;
  const rw = x1 - x0;
  const rh = y1 - y0;
  const bands = [];
  let start = -1;
  let blank = 0;
  let minX = rw;
  let maxX = 0;
  let bandMin = rw;
  let bandMax = 0;
  for (let y = 0; y <= rh; y += 1) {
    let n = 0;
    let rowMin = rw;
    let rowMax = 0;
    if (y < rh) {
      for (let x = 0; x < rw; x += 1) {
        const i = (y * rw + x) * 4;
        if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) {
          n += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (x < rowMin) rowMin = x;
          if (x > rowMax) rowMax = x;
        }
      }
    }
    if (n > 2) {
      if (start < 0) {
        start = y;
        bandMin = rowMin;
        bandMax = rowMax;
      } else {
        if (rowMin < bandMin) bandMin = rowMin;
        if (rowMax > bandMax) bandMax = rowMax;
      }
      blank = 0;
    } else if (start >= 0) {
      blank += 1;
      if (y === rh || blank > 2) {
        const end = y - blank;
        bands.push({ y: start, h: end - start + 1, minX: bandMin, maxX: bandMax });
        start = -1;
        blank = 0;
      }
    }
  }
  return { bands, y0, height, x0, minX, maxX, width, rh };
}

function remapOneMask(box, mask, y, h) {
  if (!mask || !(box.h > 0)) return null;
  const absTop = box.y + mask.y * box.h;
  const absBot = absTop + mask.h * box.h;
  const maskTop = Math.max(absTop, y);
  const maskBot = Math.min(absBot, y + h);
  if (maskBot - maskTop < 0.0015) return null;
  const next = { x: mask.x, w: mask.w, y: (maskTop - y) / h, h: (maskBot - maskTop) / h };
  if (mask.role) next.role = mask.role;
  return next;
}

function placedBox(box, y, h) {
  const next = { ...box, y, h };
  if (box.mask) {
    const mask = remapOneMask(box, box.mask, y, h);
    if (mask) next.mask = mask;
    else delete next.mask;
  }
  if (box.masks && box.masks.length) {
    const masks = box.masks.map((mask) => remapOneMask(box, mask, y, h)).filter(Boolean);
    if (masks.length) next.masks = masks;
    else delete next.masks;
  }
  return next;
}

function answerEdgeSpan(bitmap, box, yTop, yBot) {
  const width = bitmap.width;
  const height = bitmap.height;
  const x0 = Math.max(0, Math.floor(box.x * width));
  const y0 = Math.max(0, Math.floor(box.y * height));
  const x1 = Math.min(width, Math.ceil((box.x + box.w) * width));
  const y1 = Math.min(height, Math.ceil((box.y + box.h) * height));
  const rw = x1 - x0;
  const rh = y1 - y0;
  if (rw < 4 || rh < 2) return null;
  let image;
  try {
    image = bitmap.getContext('2d').getImageData(x0, y0, rw, rh);
  } catch (error) {
    return null;
  }
  const data = image.data;
  if (!data || data.length < rw * rh * 4) return null;
  const top = Math.max(0, yTop - y0);
  const bot = Math.min(rh, yBot - y0);
  const cols = new Uint16Array(rw);
  for (let y = top; y < bot; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const i = (y * rw + x) * 4;
      if (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242) cols[x] += 1;
    }
  }
  const clusters = [];
  let start = -1;
  let blank = 0;
  for (let x = 0; x <= rw; x += 1) {
    if (x < rw && cols[x]) {
      if (start < 0) start = x;
      blank = 0;
    } else if (start >= 0) {
      blank += 1;
      if (x === rw || blank >= 3) {
        clusters.push({ x: start, w: x - blank - start + 1 });
        start = -1;
        blank = 0;
      }
    }
  }
  if (clusters.length < 2) return null;
  // Keep a trailing "·" or "X." that sits on the edge of the answer. Dropping
  // that narrow cluster was cutting the mark off the crop.
  const use = clusters;
  let minX = use[0].x;
  let maxX = use[0].x + use[0].w;
  use.forEach((cluster) => {
    if (cluster.x < minX) minX = cluster.x;
    if (cluster.x + cluster.w > maxX) maxX = cluster.x + cluster.w;
  });
  return { minX, maxX };
}

function trimPieceBox(slice, bitmap) {
  const box = slice.box;
  if (!box || !bitmap) return slice;
  // A manifest box is already the part's own glyphs and drawings.
  if (box.locked || box.whole) return slice;
  let y = box.y;
  let y2 = box.y + box.h;
  const source = slice.source;
  const header = source && source.headerCrop;
  if (slice.kind !== 'answer') {
    // The source footer repeats on every page. footerCrop.page is only the page it was measured on.
    const footerTop = sourceFooterTop(source, null);
    if (y2 > footerTop && y < footerTop - 0.008) y2 = footerTop;
    // A part box that starts in the page-1 title block still holds the name line. Begin under it.
    if (header && Number(header.page) === Number(slice.page)) {
      const headerBottom = (header.y || 0) + (header.h || 0);
      if (y < 0.12 && y < headerBottom - 0.008 && y2 > headerBottom + 0.012) y = headerBottom;
    }
    // Running header (בס״ד) sits in the top margin on every page.
    if (y < 0.046 && y2 > y + 0.03) y = 0.046;
  }
  if (y2 - y < 0.004) return slice;
  const clipped = y === box.y && Math.abs(y2 - (box.y + box.h)) < 0.0001 ? box : placedBox(box, y, y2 - y);
  const ink = sliceInkRows(bitmap, clipped);
  if (!ink || !ink.bands.length) return { ...slice, box: clipped };
  const pageH = ink.height;
  const pad = Math.max(2, Math.round(pageH * 0.003));
  if (slice.kind === 'answer') {
    const winTop = ink.y0;
    const winBot = Math.min(pageH, ink.y0 + (ink.rh || 0));
    const mid = (winTop + winBot) / 2;
    // A neighbour that leaked in touches an edge and does not cross this label's midline.
    const inner = ink.bands.filter((band) => {
      const topPx = ink.y0 + band.y;
      const botPx = topPx + band.h;
      const touches = topPx <= winTop + 1 || botPx >= winBot - 1;
      const ownsLine = topPx <= mid && botPx >= mid;
      // A wrapped answer puts its next line on the bottom edge on purpose.
      if (touches && !ownsLine && !clipped.wrap) return false;
      return true;
    });
    const bands = inner.length ? inner : ink.bands;
    const top = Math.max(0, ink.y0 + bands[0].y - pad);
    const bot = Math.min(pageH, ink.y0 + bands[bands.length - 1].y + bands[bands.length - 1].h + pad);
    const pageW = ink.width;
    let inkMin = bands[0].minX == null ? ink.minX : bands[0].minX;
    let inkMax = bands[0].maxX == null ? ink.maxX : bands[0].maxX;
    bands.forEach((band) => {
      if (band.minX == null) return;
      if (band.minX < inkMin) inkMin = band.minX;
      if (band.maxX > inkMax) inkMax = band.maxX;
    });
    const edge = answerEdgeSpan(bitmap, clipped, top, bot);
    if (edge) {
      inkMin = edge.minX;
      inkMax = edge.maxX;
    }
    // One pixel of antialiasing. Do not grow back across the label the window already excluded.
    const hPad = 1;
    const boundLeft = Math.max(0, Math.floor(clipped.x * pageW));
    const boundRight = Math.min(pageW, Math.ceil((clipped.x + clipped.w) * pageW));
    const left = Math.max(boundLeft, ink.x0 + inkMin - hPad);
    const right = Math.min(boundRight, ink.x0 + inkMax + 1 + hPad);
    const next = placedBox(clipped, top / pageH, Math.max(0.004, (bot - top) / pageH));
    if (right - left > 4) {
      const kept = [];
      const remember = (mask) => {
        if (!mask) return;
        kept.push({
          role: mask.role,
          absX: next.x + mask.x * next.w,
          absW: mask.w * next.w,
          y: mask.y,
          h: mask.h,
        });
      };
      if (next.mask) remember(next.mask);
      (next.masks || []).forEach(remember);
      next.x = left / pageW;
      next.w = (right - left) / pageW;
      const masks = kept.map((mask) => {
        const x = (mask.absX - next.x) / next.w;
        const w = mask.absW / next.w;
        const clippedX = Math.max(0, x);
        const clippedRight = Math.min(1, x + w);
        if (clippedRight - clippedX < 0.002) return null;
        const out = { x: clippedX, w: clippedRight - clippedX, y: mask.y, h: mask.h };
        if (mask.role) out.role = mask.role;
        return out;
      }).filter(Boolean);
      delete next.mask;
      if (masks.length) next.masks = masks;
      else delete next.masks;
    }
    return { ...slice, box: next };
  }
  // Keep the original writing space. Cut only past one third of a page below the last ink.
  const last = ink.bands[ink.bands.length - 1];
  const inkBot = ink.y0 + last.y + last.h + pad;
  const origBot = Math.min(pageH, (clipped.y + clipped.h) * pageH);
  const capped = Math.min(origBot, inkBot + pageH / 3);
  if (capped >= origBot - 1) return { ...slice, box: clipped };
  return { ...slice, box: placedBox(clipped, clipped.y, Math.max(0.004, capped / pageH - clipped.y)) };
}

function syncSliceMetrics(item) {
  const box = item && item.slice && item.slice.box;
  const bitmap = item && item.bitmap;
  if (!box || !bitmap || !(bitmap.width > 0)) return;
  item.sw = box.w * bitmap.width;
  item.sh = box.h * bitmap.height;
  if (item.slice.kind === 'answer') return;
  // A full page width maps to 1000px. A figure keeps its own width instead of being stretched.
  const scale = 1000;
  item.dx = Math.max(0, Math.round(scale * (box.x || 0)));
  item.dw = Math.max(1, Math.round(scale * (box.w || 1)));
  item.dh = Math.max(1, Math.round(scale * (box.h || 0) * bitmap.height / Math.max(1, bitmap.width)));
}

function fillSliceMasks(ctx, box, top, dh, width) {
  if (!box) return;
  const list = [];
  if (box.mask) list.push(box.mask);
  (box.masks || []).forEach((mask) => {
    if (mask) list.push(mask);
  });
  if (!list.length) return;
  ctx.fillStyle = '#fff';
  list.forEach((mask) => {
    ctx.fillRect(mask.x * width, top + mask.y * dh, mask.w * width, mask.h * dh);
  });
}

/**
 * A drawing that starts inside a part can continue past the dashed writing
 * line: the rectangle's bottom edge and its label. Follow that ink, including
 * a short label in the same columns, and stop before the next question.
 */
function extendDrawingBox(bitmap, box, limitY) {
  if (!bitmap || !box || !(box.h > 0) || typeof bitmap.getContext !== 'function') return null;
  const width = bitmap.width;
  const height = bitmap.height;
  if (!(width > 8) || !(height > 8)) return null;
  let data;
  try {
    data = bitmap.getContext('2d').getImageData(0, 0, width, height).data;
  } catch (error) {
    return null;
  }
  if (!data || data.length < width * height * 4) return null;
  const end = box.y + box.h;
  const limit = Math.min(0.945, typeof limitY === 'number' ? limitY - 0.004 : end + 0.08);
  if (!(limit > end + 0.008)) return null;
  const y0 = Math.max(0, Math.floor(box.y * height));
  const y1 = Math.min(height - 1, Math.round(end * height));
  const yLimit = Math.min(height - 1, Math.round(limit * height));
  if (y1 - y0 < 4 || yLimit <= y1 + 2) return null;
  // The copyright stamp sits at x<0.055 and question text begins near x=0.35.
  // A drawing is the left-side shape between them.
  const xSkip = Math.max(1, Math.floor(width * 0.055));
  const xLimit = Math.max(xSkip + 2, Math.floor(width * 0.34));
  // A diagonal only inks a few pixels in each column. A letter-height threshold
  // drops those sides and the question text wins the span.
  const minTall = Math.max(3, Math.round(height * 0.0018));
  const dark = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242;
  };
  const colInk = new Uint16Array(xLimit);
  for (let y = y0; y < y1; y += 1) {
    for (let x = xSkip; x < xLimit; x += 1) {
      if (dark(x, y)) colInk[x] += 1;
    }
  }
  const gapX = Math.max(2, Math.round(width * 0.08));
  let bestL = -1;
  let bestR = -1;
  let runL = -1;
  let runR = -1;
  for (let x = xSkip; x <= xLimit; x += 1) {
    if (x < xLimit && colInk[x] >= minTall) {
      if (runL < 0) runL = x;
      runR = x;
    } else if (runL >= 0 && (x === xLimit || x > runR + gapX)) {
      if (runR - runL > bestR - bestL) {
        bestL = runL;
        bestR = runR;
      }
      runL = -1;
    }
  }
  if (bestL < 0 || bestL > width * 0.22 || bestR - bestL < width * 0.05) return null;
  // A text line is only ~0.015 tall. A drawing fills a taller block of rows.
  let inkRows = 0;
  for (let y = y0; y < y1; y += 1) {
    let n = 0;
    for (let x = bestL; x <= bestR; x += 1) {
      if (dark(x, y)) n += 1;
      if (n >= 3) break;
    }
    if (n >= 3) inkRows += 1;
  }
  if (inkRows < height * 0.035) return null;
  let minX = bestL;
  let maxX = bestR;
  const gapLimit = Math.max(2, Math.round(height * 0.016));
  const grow = Math.max(2, Math.round(width * 0.04));
  let last = y1 - 1;
  let gap = 0;
  let extra = false;
  for (let y = y1; y <= yLimit; y += 1) {
    let n = 0;
    let rowL = maxX;
    let rowR = minX;
    const lookL = Math.max(xSkip, minX - grow);
    const lookR = Math.min(xLimit - 1, maxX + grow);
    for (let x = lookL; x <= lookR; x += 1) {
      if (!dark(x, y)) continue;
      n += 1;
      if (x < rowL) rowL = x;
      if (x > rowR) rowR = x;
    }
    let rule = 0;
    const ruleLeft = Math.floor(width * 0.05);
    const ruleRight = Math.floor(width * 0.92);
    for (let x = ruleLeft; x < ruleRight; x += 1) {
      if (dark(x, y)) rule += 1;
    }
    if (rule > (ruleRight - ruleLeft) * 0.55) n = 0;
    // A row that is mostly the question sentence, with only a letter spilling
    // into the drawing's columns, is not the drawing.
    let right = 0;
    const rightL = Math.floor(width * 0.5);
    const rightR = Math.floor(width * 0.92);
    for (let x = rightL; x < rightR; x += 1) {
      if (dark(x, y)) right += 1;
    }
    if (right > 20 && n < Math.max(8, (lookR - lookL) * 0.15)) n = 0;
    if (n >= 3) {
      if (rowL < minX) minX = rowL;
      if (rowR > maxX) maxX = rowR;
      last = y;
      gap = 0;
      extra = true;
    } else {
      gap += 1;
      if (gap > gapLimit) break;
    }
  }
  if (!extra || last <= y1 + 1) return null;
  const bottom = Math.min(limit, (last + 2) / height);
  if (!(bottom > end + 0.004)) return null;
  return bottom;
}

function slicePdf(item) {
  return (item && item.slice && item.slice.source && item.slice.source.pdfId) || '';
}

/**
 * The next part or question on the source sheet, picked or not.
 * The label line is the stop. A pin can sit inside the drawing, so the pin is not the stop.
 */
function sourceStopY(slice) {
  const questions = (slice.source && slice.source.questions) || [];
  const box = slice.box;
  const end = box.y + box.h;
  const page = slice.page;
  let limit = 0.945;
  const take = (y, itemPage) => {
    if (typeof y !== 'number' || itemPage !== page) return;
    if (y < end - 0.002) return;
    if (y < limit) limit = y;
  };
  questions.forEach((item) => {
    if (!item) return;
    const line = item.labelLine;
    if (line && typeof line.y === 'number') take(line.y, line.page || item.page);
    else if (item.row) take(item.row.y, item.row.page || item.page);
    (item.rows || []).forEach((row) => {
      if (row) take(row.y, row.page || item.page);
    });
    if (item.stem) take(item.stem.y, item.stem.page || item.page);
  });
  return limit;
}

function claimDrawingTails(measured) {
  measured.forEach((item) => {
    const slice = item && item.slice;
    if (!slice || slice.kind !== 'row' || !slice.box || !item.bitmap) return;
    const laterPart = measured.some((other) => (
      other !== item
      && other.slice
      && other.slice.kind === 'row'
      && other.slice.block === slice.block
      && other.slice.page === slice.page
      && slicePdf(other) === slicePdf(item)
      && other.slice.box
      && other.slice.box.y > slice.box.y + 0.008
    ));
    if (laterPart) return;
    const end = slice.box.y + slice.box.h;
    let limit = sourceStopY(slice);
    measured.forEach((other) => {
      if (other === item || !other.slice || !other.slice.box) return;
      if (other.slice.page !== slice.page || slicePdf(other) !== slicePdf(item)) return;
      if (other.slice.kind !== 'row' && other.slice.kind !== 'stem') return;
      const y = other.slice.box.y;
      if (y < end - 0.008) return;
      if (y < limit) limit = y;
    });
    const bottom = extendDrawingBox(item.bitmap, slice.box, limit);
    if (!(bottom > end + 0.004)) return;
    item.slice = { ...slice, box: placedBox(slice.box, slice.box.y, bottom - slice.box.y) };
    syncSliceMetrics(item);
  });
}

function leftDrawingRun(bitmap, y0, y1) {
  if (!bitmap || typeof bitmap.getContext !== 'function') return 0;
  const width = bitmap.width;
  const height = bitmap.height;
  if (!(width > 8) || !(height > 8)) return 0;
  let data;
  try {
    data = bitmap.getContext('2d').getImageData(0, 0, width, height).data;
  } catch (error) {
    return 0;
  }
  const top = Math.max(0, Math.floor(y0 * height));
  const bot = Math.min(height - 1, Math.ceil(y1 * height));
  const x0 = Math.max(1, Math.floor(width * 0.06));
  const x1 = Math.max(x0 + 2, Math.floor(width * 0.34));
  const wide = Math.max(4, Math.round(width * 0.05));
  let run = 0;
  let best = 0;
  const dark = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242;
  };
  for (let y = top; y <= bot; y += 1) {
    let n = 0;
    let left = x1;
    let right = x0;
    for (let x = x0; x < x1; x += 1) {
      if (!dark(x, y)) continue;
      n += 1;
      if (x < left) left = x;
      if (x > right) right = x;
    }
    if (n >= 2 && right - left >= wide) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best / height;
}

/**
 * A stem that swallowed the previous question keeps that band only when a
 * drawing occupies the left side. Otherwise the band is the previous question's
 * text and drops off the crop.
 */
function dropBlankForeign(measured) {
  measured.forEach((item) => {
    const slice = item && item.slice;
    const box = slice && slice.box;
    const bitmap = item && item.bitmap;
    if (!box || !bitmap || !box.masks) return;
    const swallowed = box.masks.filter((mask) => mask && mask.role === 'swallowed').sort((a, b) => a.y - b.y);
    const prefix = swallowed[0];
    if (!prefix || prefix.y > 0.04) return;
    let cover = prefix.y + prefix.h;
    swallowed.slice(1).forEach((mask) => {
      if (mask.y <= cover + 0.02) cover = Math.max(cover, mask.y + mask.h);
    });
    const absTop = box.y + prefix.y * box.h;
    const absBot = box.y + cover * box.h;
    if (leftDrawingRun(bitmap, absTop, absBot) >= 0.022) return;
    const newH = box.y + box.h - absBot;
    if (newH < 0.012) return;
    item.slice = { ...slice, box: placedBox(box, absBot, newH) };
    syncSliceMetrics(item);
  });
}

function sealOverlaps(measured) {
  for (let i = 0; i < measured.length; i += 1) {
    const earlier = measured[i];
    if (!earlier.slice || (earlier.slice.kind !== 'row' && earlier.slice.kind !== 'stem')) continue;
    const earlierPdf = earlier.slice.source && earlier.slice.source.pdfId;
    for (let j = i + 1; j < measured.length; j += 1) {
      const later = measured[j];
      const box = earlier.slice.box;
      const other = later.slice && later.slice.box;
      if (!box || !other || later.slice.page !== earlier.slice.page) continue;
      if (later.slice.kind !== 'row' && later.slice.kind !== 'stem') continue;
      const laterPdf = later.slice.source && later.slice.source.pdfId;
      // Page 1 of two worksheets is not the same page. Never white out either part.
      if (!earlierPdf || earlierPdf !== laterPdf) continue;
      const top = Math.max(box.y, other.y);
      const bot = Math.min(box.y + box.h, other.y + other.h);
      if (bot - top < 0.016) continue;
      const laterEnd = other.y + other.h;
      const newY = Math.max(other.y, box.y + box.h);
      const newH = laterEnd - newY;
      // Leave the later part alone when the trim would eat its own first line.
      if (newH < 0.016) continue;
      later.slice = { ...later.slice, box: placedBox(other, newY, newH) };
      syncSliceMetrics(later);
    }
  }
}

function answerDisplayScale(naturalW, naturalH) {
  const maxW = 1000 - 56;
  let scale = 1;
  if (naturalW > maxW) scale = maxW / naturalW;
  if (naturalH > maxW) scale = Math.min(scale, 1);
  // Source scale: the same size as the question body. Wider than the page still fits.
  return Math.min(1, Math.max(0.05, scale));
}

function answerCellSize(text, naturalW, naturalH) {
  const scale = answerDisplayScale(naturalW, naturalH);
  const imageW = Math.max(1, Math.round(naturalW * scale));
  const imageH = Math.max(1, Math.round(naturalH * scale));
  let labelW = Math.min(420, Math.ceil(String(text || '').length * 7.5));
  if (typeof document !== 'undefined') {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = '15px Heebo, Arial, sans-serif';
      labelW = Math.ceil(ctx.measureText(String(text || '')).width);
    } catch (error) {}
  }
  const maxW = 1000 - 56;
  const gap = 8;
  const baseline = 16;
  let imageY = 0;
  let labelBaseline = baseline;
  if (imageH <= 36) {
    // One line. Its bottom meets the label, including a crop a little taller than 15px.
    const base = Math.max(baseline, imageH - 2);
    imageY = Math.max(0, base + 2 - imageH);
    labelBaseline = imageY + imageH - 2;
  } else {
    labelBaseline = Math.min(baseline, Math.max(12, Math.round(Math.min(imageH, 22) - 2)));
  }
  let stack = false;
  let dw = labelW + gap + imageW;
  let dh = Math.max(18, labelBaseline + 4, imageY + imageH);
  if (dw > maxW) {
    stack = true;
    dw = maxW;
    dh = Math.max(dh, 18 + imageH);
  }
  return { scale, imageW, imageH, imageY, labelBaseline, labelW, dw, dh, stack };
}

/**
 * A left-side drawing is a column whose ink spans a tall range.
 * A writing dash is only a few pixels tall, so it does not count.
 */
function leftFigureBoxes(bitmap, y0, y1) {
  if (!bitmap || typeof bitmap.getContext !== 'function') return [];
  const width = bitmap.width;
  const height = bitmap.height;
  if (!(width > 8) || !(height > 8)) return [];
  let data;
  try {
    data = bitmap.getContext('2d').getImageData(0, 0, width, height).data;
  } catch (error) {
    return [];
  }
  const top = Math.max(0, Math.floor(Math.min(y0, y1) * height));
  const bot = Math.min(height - 1, Math.ceil(Math.max(y0, y1) * height));
  const xStart = Math.max(1, Math.floor(width * 0.04));
  const xStop = Math.max(xStart + 2, Math.floor(width * 0.33));
  const tallMin = height * 0.03;
  const dark = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242;
  };
  const tall = [];
  for (let x = xStart; x < xStop; x += 1) {
    let min = bot;
    let max = top;
    let n = 0;
    for (let y = top; y <= bot; y += 1) {
      if (!dark(x, y)) continue;
      n += 1;
      if (y < min) min = y;
      if (y > max) max = y;
    }
    if (n >= 2 && max - min > tallMin) tall.push(x);
  }
  if (!tall.length) return [];
  const rowHit = new Uint8Array(bot - top + 1);
  tall.forEach((x) => {
    for (let y = top; y <= bot; y += 1) {
      if (dark(x, y)) rowHit[y - top] = 1;
    }
  });
  const clusters = [];
  let start = -1;
  let prev = -1;
  const gapLim = Math.max(2, Math.round(height * 0.018));
  for (let y = top; y <= bot + 1; y += 1) {
    const hit = y <= bot && rowHit[y - top];
    if (hit) {
      if (start < 0) start = y;
      prev = y;
    } else if (start >= 0 && (y > bot || y - prev > gapLim)) {
      clusters.push([start, prev]);
      start = -1;
    }
  }
  const boxes = [];
  const barPad = Math.max(2, Math.round(height * 0.005));
  const barAt = (y) => {
    let n = 0;
    let samples = 0;
    const left = Math.floor(width * 0.12);
    const right = Math.floor(width * 0.9);
    for (let x = left; x < right; x += 3) {
      samples += 1;
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      // A section bar is a full-width grey or black band. The raster is often light grey.
      if (mx - mn < 18 && mx < 248 && (mx < 80 || mn > 160)) n += 1;
    }
    return samples > 0 && n / samples > 0.72;
  };
  // A writing line is one or two rows of short dashes across the text column.
  // A graph axis is one long stroke, and a sentence is many rows tall. Following
  // the dashes pulls the drawing over the sentence ("המקורי.").
  const dashLeft = Math.floor(width * 0.4);
  const dashRight = Math.floor(width * 0.9);
  const dashLike = new Uint8Array(height);
  const ruleRow = new Uint8Array(height);
  for (let y = 0; y < height; y += 1) {
    let n = 0;
    let longest = 0;
    let run = 0;
    let gaps = 0;
    let prev = false;
    for (let x = dashLeft; x < dashRight; x += 1) {
      if (dark(x, y)) {
        n += 1;
        run += 1;
        if (run > longest) longest = run;
        prev = true;
      } else if (prev) {
        gaps += 1;
        run = 0;
        prev = false;
      } else {
        run = 0;
      }
    }
    const span = dashRight - dashLeft;
    const frac = span ? n / span : 0;
    if (frac >= 0.45 && frac <= 0.78 && longest < width * 0.02 && gaps >= 20) dashLike[y] = 1;
  }
  for (let y = 1; y < height - 1; y += 1) {
    if (!dashLike[y]) continue;
    const up = dashLike[y - 1] === 1;
    const down = dashLike[y + 1] === 1;
    if (up && down) continue;
    const above = y - (up ? 2 : 1);
    const below = y + (down ? 2 : 1);
    if (above >= 0 && dashLike[above]) continue;
    if (below < height && dashLike[below]) continue;
    ruleRow[y] = 1;
  }
  const ruleAt = (y) => y > 0 && y < height && ruleRow[y] === 1;
  const pushBox = (low, high) => {
    if ((high - low) / height < 0.025) return;
    let minX = xStop;
    let maxX = xStart;
    tall.forEach((x) => {
      for (let y = low; y <= high; y += 1) {
        if (!dark(x, y)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        break;
      }
    });
    if (maxX <= minX) return;
    // The rightmost tall column may be the writing line, not the drawing.
    while (maxX > minX) {
      let ink = false;
      for (let y = low; y <= high; y += 1) {
        if (barRow[y - top] || ruleAt(y)) continue;
        if (dark(maxX, y)) {
          ink = true;
          break;
        }
      }
      if (ink) break;
      maxX -= 1;
    }
    if (maxX <= minX) return;
    // The left-column scan stops at 0.33. Follow the same stroke past that edge.
    const gapPx = Math.max(4, Math.round(width * 0.016));
    const limitX = Math.min(width - 2, Math.floor(width * 0.45));
    const link = 3;
    let seeds = [];
    for (let y = low; y <= high; y += 1) {
      if (barRow[y - top] || ruleAt(y)) continue;
      if (dark(maxX, y)) seeds.push(y);
    }
    let last = maxX;
    let miss = 0;
    for (let x = maxX + 1; x <= limitX && seeds.length; x += 1) {
      const next = [];
      for (let y = low; y <= high; y += 1) {
        if (barRow[y - top] || ruleAt(y) || !dark(x, y)) continue;
        if (seeds.some((seed) => Math.abs(seed - y) <= link)) next.push(y);
      }
      if (next.length) {
        seeds = next;
        last = x;
        miss = 0;
      } else if (++miss > gapPx) break;
    }
    maxX = last;
    boxes.push({
      x0: minX / width,
      x1: (maxX + 1) / width,
      y0: low / height,
      y1: (high + 1) / height,
    });
  };
  const barRow = new Uint8Array(bot - top + 1);
  for (let y = top; y <= bot; y += 1) {
    if (!barAt(y)) continue;
    const end = Math.min(bot, y + barPad);
    for (let k = y; k <= end; k += 1) barRow[k - top] = 1;
  }
  clusters.forEach(([low, high]) => {
    // Split a title bar or a full-width writing band out of the drawing.
    // The bar's dark edge sits a few pixels below the grey fill.
    let sub = -1;
    let prev = -1;
    for (let y = low; y <= high + 1; y += 1) {
      const bar = y <= high && barRow[y - top];
      const hit = y <= high && rowHit[y - top] && !bar;
      if (hit) {
        if (sub < 0) sub = y;
        prev = y;
      } else if (sub >= 0 && (y > high || bar || y - prev > gapLim)) {
        pushBox(sub, prev);
        sub = -1;
      }
    }
  });
  return boxes;
}

function partMarks(items) {
  const marks = [];
  (items || []).forEach((item) => {
    const text = String(item.str || '').trim();
    const match = text.match(/^\.?([אבגדהו])\.?$/);
    if (!match) return;
    if ((item.x || 0) < 0.72) return;
    marks.push({ part: match[1], y: item.y, x: item.x });
  });
  return marks;
}

/**
 * Question numbers on the source sheet. Both "(9)" and "9." occur, and a
 * star can sit beside "9.". A bare digit counts only when its dot is a
 * separate glyph on the same line.
 */
function questionNumberOf(item, items) {
  const text = String(item.str || '').replace(/★/g, '').trim();
  let match = text.match(/^\((\d{1,2})\)$/) || text.match(/^\)(\d{1,2})\($/);
  if (match) return Number(match[1]);
  match = text.match(/^(\d{1,2})\.$/);
  if (match) return Number(match[1]);
  if (!/^\d{1,2}$/.test(text)) return null;
  const y = item.y || 0;
  const x = item.x || 0;
  const dotted = (items || []).some((other) => {
    if (other === item) return false;
    if (String(other.str || '').trim() !== '.') return false;
    if (Math.abs((other.y || 0) - y) > 0.008) return false;
    const ox = other.x || 0;
    return ox < x && x - ox < 0.04;
  });
  return dotted ? Number(text) : null;
}

function questionMarks(items) {
  const marks = [];
  (items || []).forEach((item) => {
    const n = questionNumberOf(item, items);
    if (n == null) return;
    if ((item.x || 0) < 0.75) return;
    marks.push({
      n,
      y: item.y || 0,
      x: item.x || 0,
      w: item.w || 0.02,
      h: Math.max(item.h || 0.016, 0.012),
    });
  });
  if (marks.length < 2) return marks;
  // A guided example numbers (1) (2) (3) to the left of the question numbers.
  const right = marks.reduce((max, mark) => Math.max(max, mark.x), 0);
  return marks.filter((mark) => mark.x >= right - 0.045);
}

function rowPart(text) {
  const value = String(text || '').replace(/\s+/g, '');
  if (!value) return null;
  let match = value.match(/^[·.•]*([אבגדהו])\.?$/);
  if (match) return match[1];
  match = value.match(/[·.•]([אבגדהו])$/);
  if (match) return match[1];
  // ".ד? ..." is the part letter glued to the front of the line.
  match = value.match(/^[.·•]+([אבגדהו])(?![א-ת])/);
  if (match) return match[1];
  match = value.match(/^([אבגדהו])\./);
  return match ? match[1] : null;
}

function textRows(items) {
  const rows = [];
  (items || []).forEach((item) => {
    const text = String(item.str || '').trim();
    if (!text) return;
    const y = item.y || 0;
    const ix = item.x || 0;
    const iw = item.w || 0;
    let row = null;
    rows.forEach((one) => {
      if (Math.abs(one.y - y) > 0.007) return;
      // A figure letter and the question text share a height. They are not one line.
      const gap = ix >= one.x + one.w - 0.002 ? ix - (one.x + one.w) : one.x - (ix + iw);
      if (gap > 0.07) return;
      row = one;
    });
    if (!row) {
      rows.push({ y, h: Math.max(item.h || 0.014, 0.01), x: item.x || 0, w: item.w || 0, text });
      return;
    }
    const left = Math.min(row.x, item.x || 0);
    const right = Math.max(row.x + row.w, (item.x || 0) + (item.w || 0));
    row.x = left;
    row.w = right - left;
    row.h = Math.max(row.h, item.h || 0);
    row.y = Math.min(row.y, y);
    row.text += text;
  });
  return rows;
}

/**
 * A long sentence that merely runs into the left column is not a drawing.
 * Figure letters stay, because they do not continue into the text column.
 */
function figureIsSentence(figure, rows) {
  if (!figure || !rows || !rows.length) return false;
  const height = figure.y1 - figure.y0;
  if (!(height > 0.01)) return false;
  let covered = 0;
  rows.forEach((row) => {
    const overlap = Math.min(row.y + row.h, figure.y1) - Math.max(row.y, figure.y0);
    if (overlap < 0.004) return;
    const right = row.x + row.w;
    if (right < 0.42) return;
    if (row.x > figure.x1 - 0.012) return;
    if (right < figure.x0 + 0.02) return;
    // One line that begins inside the blob and keeps going across the page is a sentence.
    if (overlap >= 0.006 && right > 0.55 && row.x < Math.min(figure.x1 - 0.02, 0.28)) {
      covered += height;
      return;
    }
    covered += overlap;
  });
  return covered > height * 0.55;
}

function expandedFigures(figures, pad) {
  const gap = pad == null ? 0.02 : pad;
  return (figures || []).filter((figure) => figure && figure.x1 > figure.x0 + 0.008 && figure.y1 > figure.y0 + 0.012).map((figure) => ({
    x0: Math.max(0, figure.x0 - gap),
    x1: Math.min(1, figure.x1 + gap),
    y0: Math.max(0, figure.y0 - gap),
    y1: Math.min(1, figure.y1 + gap),
  }));
}

function figureLabel(item, figures) {
  const text = String(item && item.str || '').trim();
  if (!text || text.length > 14) return false;
  const w = item.w || 0;
  if (w > 0.1) return false;
  const cx = (item.x || 0) + w * 0.5;
  const cy = (item.y || 0) + Math.max(item.h || 0.012, 0.008) * 0.45;
  return expandedFigures(figures).some((figure) => {
    const gapX = cx < figure.x0 ? figure.x0 - cx : cx > figure.x1 ? cx - figure.x1 : 0;
    const gapY = cy < figure.y0 ? figure.y0 - cy : cy > figure.y1 ? cy - figure.y1 : 0;
    return gapX < 0.03 && gapY < 0.022;
  });
}

/**
 * A white band may cross a drawing. Keep the drawing: split the band into the
 * pieces that sit above, below, and to either side of each figure.
 * The previous question's house is not in this list, so its digit stays covered.
 */
function carveMasks(masks, box, figures) {
  const regions = expandedFigures(figures, 0.034);
  if (!box || !(box.h > 0) || !regions.length) return (masks || []).filter(Boolean);
  const bw = box.w || 1;
  const bx = box.x || 0;
  let pieces = (masks || []).filter(Boolean);
  regions.forEach((figure) => {
    const next = [];
    pieces.forEach((mask) => {
      if (!mask) return;
      const abs = {
        x0: bx + mask.x * bw,
        x1: bx + (mask.x + mask.w) * bw,
        y0: box.y + mask.y * box.h,
        y1: box.y + (mask.y + mask.h) * box.h,
      };
      const overlapX = Math.min(abs.x1, figure.x1) - Math.max(abs.x0, figure.x0);
      const overlapY = Math.min(abs.y1, figure.y1) - Math.max(abs.y0, figure.y0);
      if (overlapX < 0.004 || overlapY < 0.003) {
        next.push(mask);
        return;
      }
      const push = (x0, x1, y0, y1) => {
        if (x1 - x0 < 0.008 || y1 - y0 < 0.003) return;
        const rx = (x0 - bx) / bw;
        const rw = (x1 - x0) / bw;
        const ry = (y0 - box.y) / box.h;
        const rh = (y1 - y0) / box.h;
        if (rw < 0.004 || rh < 0.002) return;
        next.push({
          ...mask,
          x: Math.max(0, rx),
          w: Math.min(1 - Math.max(0, rx), rw),
          y: Math.max(0, ry),
          h: Math.min(1 - Math.max(0, ry), rh),
        });
      };
      if (figure.y0 - abs.y0 > 0.003) push(abs.x0, abs.x1, abs.y0, Math.min(abs.y1, figure.y0));
      if (abs.y1 - figure.y1 > 0.003) push(abs.x0, abs.x1, Math.max(abs.y0, figure.y1), abs.y1);
      const midY0 = Math.max(abs.y0, figure.y0);
      const midY1 = Math.min(abs.y1, figure.y1);
      if (figure.x0 - abs.x0 > 0.008) push(abs.x0, Math.min(abs.x1, figure.x0), midY0, midY1);
      if (abs.x1 - figure.x1 > 0.008) push(Math.max(abs.x0, figure.x1), abs.x1, midY0, midY1);
    });
    pieces = next;
  });
  return pieces;
}

function lineMasksFor(box, rows, hideSpans, figures, items) {
  const masks = [];
  if (!box || !(box.h > 0) || !rows || !hideSpans) return masks;
  const x0 = box.x || 0;
  const bw = box.w || 1;
  const regions = expandedFigures(figures);
  const pushMask = (left, right, top, bot) => {
    left = Math.max(x0, left);
    right = Math.min(x0 + bw, right);
    top = Math.max(box.y, top);
    bot = Math.min(box.y + box.h, bot);
    if (right - left < 0.012 || bot - top < 0.006) return;
    masks.push({
      x: (left - x0) / bw,
      w: (right - left) / bw,
      y: (top - box.y) / box.h,
      h: (bot - top) / box.h,
      role: 'line',
    });
  };
  rows.forEach((row) => {
    const mid = row.y + row.h * 0.45;
    if (mid < box.y + 0.002 || mid > box.y + box.h - 0.002) return;
    if (!hideSpans.some(([low, high]) => mid >= low - 0.002 && mid < high + 0.002)) return;
    const top = row.y - 0.002;
    const bot = row.y + Math.max(row.h, 0.012) + 0.003;
    const hits = regions.some((figure) => {
      const overlapY = Math.min(bot, figure.y1) - Math.max(top, figure.y0);
      if (overlapY < 0.004) return false;
      const overlapX = Math.min(row.x + row.w, figure.x1) - Math.max(row.x, figure.x0);
      return overlapX > 0.004;
    });
    const onRow = (item) => {
      const iy = item.y || 0;
      const ih = Math.max(item.h || 0.012, 0.008);
      if (iy > row.y + Math.max(row.h, 0.012) + 0.006) return false;
      if (iy + ih < row.y - 0.006) return false;
      const ix = item.x || 0;
      const iw = Math.max(item.w || 0, 0.008);
      return !(ix + iw < row.x - 0.012 || ix > row.x + row.w + 0.012);
    };
    const keepsLabel = items && items.some((item) => onRow(item) && figureLabel(item, figures));
    if ((!hits && !keepsLabel) || !items || !items.length) {
      pushMask(row.x - 0.008, row.x + row.w + 0.01, top, bot);
      return;
    }
    items.forEach((item) => {
      const text = String(item.str || '').trim();
      if (!text) return;
      if (!onRow(item)) return;
      const ix = item.x || 0;
      const iw = Math.max(item.w || 0, 0.008);
      if (ix + iw < row.x - 0.012 || ix > row.x + row.w + 0.012) return;
      if (figureLabel(item, figures)) return;
      pushMask(ix - 0.004, ix + iw + 0.006, Math.min(top, (item.y || row.y) - 0.002), Math.max(bot, (item.y || row.y) + Math.max(item.h || row.h, 0.012) + 0.003));
    });
  });
  return masks;
}

function punchMasks(masks, box, y0, y1) {
  const out = [];
  (masks || []).forEach((mask) => {
    if (!mask || !(box.h > 0)) return;
    const top = box.y + mask.y * box.h;
    const bot = top + mask.h * box.h;
    const cut0 = Math.max(top, y0);
    const cut1 = Math.min(bot, y1);
    if (cut1 - cut0 < 0.004) {
      out.push(mask);
      return;
    }
    if (cut0 - top > 0.004) out.push({ ...mask, h: (cut0 - top) / box.h });
    if (bot - cut1 > 0.004) out.push({ ...mask, y: (cut1 - box.y) / box.h, h: (bot - cut1) / box.h });
  });
  return out;
}

/**
 * Dashed writing lines are a few pixels tall and run across the text column.
 * The mask is the full width here; carveMasks then keeps the part that crosses a drawing.
 */
function maskWritingRules(bitmap, box, spans) {
  if (!bitmap || !box || !(box.h > 0) || !spans || !spans.length || typeof bitmap.getContext !== 'function') return [];
  const width = bitmap.width;
  const height = bitmap.height;
  if (!(width > 8) || !(height > 8)) return [];
  let data;
  try {
    data = bitmap.getContext('2d').getImageData(0, 0, width, height).data;
  } catch (error) {
    return [];
  }
  const dark = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i] < 210 || data[i + 1] < 210 || data[i + 2] < 210;
  };
  const masks = [];
  const xL = Math.floor(width * 0.42);
  const xR = Math.floor(width * 0.92);
  spans.forEach(([low, high]) => {
    const top = Math.max(box.y, low);
    const bot = Math.min(box.y + box.h, high);
    if (bot - top < 0.004) return;
    const yA = Math.max(0, Math.floor(top * height));
    const yB = Math.min(height - 1, Math.ceil(bot * height));
    let run = 0;
    let runStart = yA;
    const flush = (end) => {
      if (run >= 1 && run <= 3) {
        const absY = runStart / height;
        const absH = Math.max(1, end - runStart) / height;
        masks.push({
          x: 0.03,
          w: 0.94,
          y: Math.max(0, (absY - box.y) / box.h),
          h: Math.min(1, absH / box.h),
          role: 'rule',
        });
      }
      run = 0;
    };
    for (let y = yA; y <= yB + 1; y += 1) {
      let n = 0;
      let samples = 0;
      if (y <= yB) {
        for (let x = xL; x < xR; x += 2) {
          samples += 1;
          if (dark(x, y)) n += 1;
        }
      }
      const frac = samples ? n / samples : 0;
      if (y <= yB && frac > 0.1 && frac < 0.78) {
        if (!run) runStart = y;
        run += 1;
      } else flush(y);
    }
  });
  return masks;
}

/**
 * A writing bar sometimes leaves a short grey tick in the left margin.
 * Whiten that tick. A stroke inside a figure is carved back out afterwards.
 */
function maskMarginTicks(bitmap, box) {
  if (!bitmap || !box || !(box.h > 0) || typeof bitmap.getContext !== 'function') return [];
  const width = bitmap.width;
  const height = bitmap.height;
  if (!(width > 8) || !(height > 8)) return [];
  let data;
  try {
    data = bitmap.getContext('2d').getImageData(0, 0, width, height).data;
  } catch (error) {
    return [];
  }
  const yA = Math.max(0, Math.floor(box.y * height));
  const yB = Math.min(height - 1, Math.ceil((box.y + box.h) * height));
  const xL = Math.floor(width * 0.05);
  const xR = Math.floor(width * 0.12);
  if (xR - xL < 4) return [];
  const grey = (x, y) => {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    return mx < 230 && mx - mn < 24;
  };
  const masks = [];
  let run = 0;
  let runStart = yA;
  const flush = (end) => {
    if (run >= 1 && run <= 3) {
      const absY = runStart / height;
      const absH = Math.max(1, end - runStart) / height;
      masks.push({
        x: 0.04,
        w: 0.09,
        y: Math.max(0, (absY - box.y) / box.h),
        h: Math.min(1, (absH + 0.001) / box.h),
        role: 'margin',
      });
    }
    run = 0;
  };
  for (let y = yA; y <= yB + 1; y += 1) {
    let n = 0;
    let samples = 0;
    if (y <= yB) {
      for (let x = xL; x < xR; x += 1) {
        samples += 1;
        if (grey(x, y)) n += 1;
      }
    }
    if (y <= yB && samples && n / samples > 0.35) {
      if (!run) runStart = y;
      run += 1;
    } else flush(y);
  }
  return masks;
}

/**
 * The source sheet footer ("עמוד 1 מתוך 6", the copyright line under it) repeats
 * on every page. footerCrop records that band on one page only. No clip may
 * cross the top of the band, the same way none may cross headerBottom.
 */
function sourceFooterTop(source, items) {
  let top = 1;
  (items || []).forEach((item) => {
    const y = item.y || 0;
    if (y < 0.85) return;
    const text = String(item.str || item.text || '');
    if (/עמוד\s*\d|מתוך\s*\d|מתמטיקה\s*·\s*נועם|כל הזכויות שמורות/.test(text)) top = Math.min(top, y - 0.004);
  });
  const hinted = source && source.footerCrop && source.footerCrop.y;
  if (typeof hinted === 'number' && hinted > 0.8) top = top < 1 ? Math.min(top, hinted) : hinted;
  if (!(top < 1)) top = 0.945;
  return top;
}

/**
 * A picked part is printed as separate pieces, stacked in source order:
 * the stem lines, each figure (its strokes plus the labels that sit on it),
 * and that part's own lines through its writing space. Nothing is painted
 * white over the source. Another part's line, a section header, and the next
 * question are simply not pieces.
 */
function layoutQuestionCrops(model) {
  const page = model.page;
  const parts = (model.parts || []).filter((part) => part && part.row && (part.row.page || part.page) === page);
  const pickedIds = model.picked || [];
  const picked = parts.filter((part) => pickedIds.indexOf(part.id) >= 0);
  if (!picked.length) return [];
  const spanTop = Math.min.apply(null, parts.map((part) => {
    const stem = part.stem && (part.stem.page || part.page) === page ? part.stem.y : part.row.y;
    return Math.min(stem, part.row.y);
  }));
  const spanBot = Math.max.apply(null, parts.map((part) => part.row.y + part.row.h));
  const headerBottom = typeof model.headerBottom === 'number' ? model.headerBottom : 0;
  const footerTop = typeof model.footerTop === 'number' ? model.footerTop : 1;
  const questionTop = typeof model.questionTop === 'number' ? model.questionTop : null;
  const questionBot = typeof model.questionBot === 'number' ? model.questionBot : null;
  const labelY = (part) => {
    let guess = part.labelLine && (part.labelLine.page || part.page) === page ? part.labelLine.y : part.row.y;
    // A catalog pin inside the title block, or above this question's number, is not the part letter.
    if (headerBottom && guess < headerBottom - 0.004) guess = headerBottom;
    if (questionTop != null && guess < questionTop - 0.004) guess = questionTop;
    let best = null;
    (model.labels || []).forEach((mark) => {
      if (!mark || mark.part !== part.part) return;
      if (headerBottom && mark.y < headerBottom - 0.004) return;
      if (mark.y < spanTop - 0.03 || mark.y > spanBot + 0.08) return;
      const dist = Math.abs(mark.y - guess);
      if (dist > 0.2) return;
      if (!best || dist < best.dist) best = { y: mark.y, dist };
    });
    // ".…א" glued to the sentence is not a separate margin label.
    if (!best) {
      const floor = questionTop != null ? questionTop - 0.01 : guess - 0.02;
      (model.rows || []).forEach((row) => {
        if (!row || rowPart(String(row.text || '')) !== part.part) return;
        if (row.y < floor) return;
        if (questionBot != null && row.y > questionBot - 0.004) return;
        if (!best || row.y < best.y) best = { y: row.y, dist: Math.abs(row.y - guess) };
      });
    }
    return best ? best.y : guess;
  };
  const ordered = parts.slice().sort((a, b) => labelY(a) - labelY(b));
  const firstLabel = labelY(ordered[0]);
  const earlierEnd = model.earlierEnd || 0;
  const qMatch = String((parts[0] && parts[0].id) || '').match(/^(\d+)/);
  const qNum = qMatch ? Number(qMatch[1]) : null;
  const items = model.items || [];
  const rows = model.rows || [];
  // A section title is "פרק ב׳" or "חלק ב׳". "פרק זמן", "פרקו", and "החלק שהוסר" are question wording.
  const headerText = (text) => {
    const value = String(text || '');
    return /(?:^|[\s·•])פרק\s*[אבגדהו]\s*[׳'״"]/.test(value)
      || /חלק\s*[אבגדהו]\s*[׳'״"]/.test(value)
      || /חלק\s*[אבגדהו]\s*[—–-]/.test(value);
  };
  let ceiling = questionBot == null ? 1 : questionBot;
  const noteHeader = (y, text) => {
    if (!headerText(text) || !(y > 0)) return;
    const floor = (questionTop == null ? stemTop : questionTop) + 0.015;
    if (y < floor || y >= ceiling) return;
    ceiling = y - 0.004;
  };
  let stemTop = firstLabel;
  parts.forEach((part) => {
    if (part.stem && (part.stem.page || part.page) === page) stemTop = Math.min(stemTop, part.stem.y);
    stemTop = Math.min(stemTop, part.row.y);
  });
  if (questionTop != null && questionTop < stemTop + 0.004) stemTop = Math.min(stemTop, questionTop);
  const numberAboveEarlier = questionTop != null && questionTop < earlierEnd - 0.008;
  if (!numberAboveEarlier && earlierEnd > stemTop + 0.004 && earlierEnd < firstLabel - 0.004) stemTop = earlierEnd;
  if (headerBottom && stemTop < headerBottom) stemTop = headerBottom;
  // The catalog row can start in the previous question. This question begins at its number.
  if (questionTop != null && stemTop < questionTop - 0.008) stemTop = questionTop;
  rows.forEach((row) => noteHeader(row.y, row.text));
  items.forEach((item) => noteHeader(item.y, item.str));
  const keepFigure = (figure) => {
    if (!figure) return false;
    const minH = figure.whole ? 0.004 : 0.018;
    const minW = figure.whole ? 0.012 : 0.02;
    if (figure.y1 - figure.y0 < minH || figure.x1 - figure.x0 < minW) return false;
    if (headerBottom && figure.y1 < headerBottom + 0.008) return false;
    // A drawing that ends in the previous question is that question's, not a shared figure.
    if (earlierEnd > 0.02 && figure.y1 <= earlierEnd + 0.008) return false;
    if (earlierEnd > 0.02 && figure.y0 < earlierEnd - 0.012) {
      const height = figure.y1 - figure.y0;
      if (figure.y1 - earlierEnd < height * 0.55) return false;
    }
    if (questionTop == null) return true;
    if (figure.y0 < questionTop - 0.018 && figure.y1 < questionTop + 0.045 && figure.y0 < earlierEnd - 0.008) return false;
    return figure.y1 > stemTop - 0.02;
  };
  const figures = [];
  (model.figures || []).forEach((figure) => {
    if (!keepFigure(figure)) return;
    const dup = figures.some((have) => {
      const overlapX = Math.min(have.x1, figure.x1) - Math.max(have.x0, figure.x0);
      const overlapY = Math.min(have.y1, figure.y1) - Math.max(have.y0, figure.y0);
      return overlapX > 0.015 && overlapY > 0.015;
    });
    if (!dup) figures.push(figure);
  });
  // ~6mm on an A4 page. Labels whose centers fall in this ring belong to the figure.
  const reach = 0.022;
  const lineText = (item) => String(item.text != null ? item.text : (item.str || ''));
  // A running copyright stamp is one tall glyph in the margin. It is not a line of the question.
  const furniture = (item) => (item.h || 0) > 0.04 || /נועם|זכויות|©|בהצלחה|בס״ד|בס"ד/.test(lineText(item));
  const otherNumber = (item) => {
    const n = questionNumberOf(item, items);
    if (n == null || (item.x || 0) < 0.7) return false;
    return qNum == null || n !== qNum;
  };
  const figureHit = (item, figure) => {
    if (furniture(item)) return false;
    const text = String(item.str || item.text || '').trim();
    if (!text || headerText(text) || otherNumber(item)) return false;
    if (text.length > 14) return false;
    const w = item.w || 0;
    if (w > 0.12) return false;
    const h = Math.max(item.h || 0.012, 0.008);
    const cx = (item.x || 0) + w * 0.5;
    const cy = (item.y || 0) + h * 0.45;
    // A short piece of a sentence in the text column is not a vertex label.
    // An axis letter just left of that sentence still belongs to the drawing.
    // A sentence that runs beside the drawing is not a vertex label, even when
    // a short piece of it sits inside the drawing's x range.
    const onSentence = rows.some((row) => {
      if (Math.abs(row.y - (item.y || 0)) > 0.008) return false;
      if ((row.w || 0) < 0.18) return false;
      return (row.x || 0) + (row.w || 0) > figure.x1 + 0.02;
    });
    if (onSentence) return false;
    return cx >= figure.x0 - reach && cx <= figure.x1 + reach && cy >= figure.y0 - reach && cy <= figure.y1 + reach;
  };
  const onFigure = (item) => figures.some((figure) => figureHit(item, figure));
  const segments = [];
  const pushBox = (segment, x, y, w, h, figure) => {
    if (!(w > 0.012) || !(h > 0.008)) return;
    let y0 = Math.max(0, y);
    let y1 = y0 + h;
    // The next question's number can sit beside a drawing. Clip the text, not the ink.
    const beside = segment === 'figure' && y0 < ceiling - 0.008 && y1 > ceiling + 0.006;
    // A manifest drawing is already one object. Clipping it to the next question
    // number opens the shape and leaves the cut piece as a floating stub.
    if (!beside && !(figure && figure.whole)) y1 = Math.min(ceiling, y1);
    // Running בס״ד sits in the top margin. A tall crop must not start inside it.
    if (!(figure && figure.whole) && y0 < 0.046 && y1 > 0.08) y0 = 0.046;
    if (headerBottom && y0 < headerBottom) {
      // Padding above a drawing must not pull in the title bar under the header.
      if (y1 < headerBottom + 0.012) return;
      y0 = headerBottom;
    }
    if (footerTop < 1 && y1 > footerTop) {
      if (y0 >= footerTop - 0.006) return;
      y1 = footerTop;
    }
    if (y1 - y0 < (figure && figure.whole ? 0.004 : 0.008)) return;
    let x0 = Math.max(0, x);
    let width = w;
    if (segment !== 'figure' && x0 < 0.05) {
      width -= 0.05 - x0;
      x0 = 0.05;
    }
    // A part line must not reach back into the drawing and reprint its edge labels.
    if (segment !== 'figure') {
      let fence = 0;
      figures.forEach((figure) => {
        const overlap = Math.min(y1, figure.y1) - Math.max(y0, figure.y0);
        if (overlap < 0.006) return;
        if (figure.x1 < 0.52 && figure.x1 > fence) fence = figure.x1;
      });
      if (fence > x0 + 0.02) {
        // A sentence that already starts in the text column stays. Only the drawing's edge labels are cut.
        const limit = x0 >= 0.30 ? x0 : 0.32;
        const cut = Math.min(fence + 0.012, limit);
        if (cut > x0 + 0.02 && x0 + width - cut > 0.12) {
          width -= cut - x0;
          x0 = cut;
        }
      }
    }
    if (width < 0.012) return;
    const box = {
      x: x0,
      y: y0,
      w: Math.min(1 - x0, width),
      h: y1 - y0,
      segment,
    };
    if (figure) box.figure = figure;
    if (figure && figure.whole) box.whole = true;
    const kind = segment === 'stem' ? 'stem' : 'row';
    segments.push({ kind, page, box, figures });
  };
  // A table row ends before the question column. It belongs to the drawing.
  // A sentence that keeps going (19ד "המקורי.") is cut later, not here.
  const tableBands = [];
  figures.forEach((figure) => {
    let edge = 0;
    const ys = [];
    rows.forEach((row) => {
      if ((row.w || 0) < 0.18) return;
      const overlap = Math.min(row.y + (row.h || 0.014), figure.y1) - Math.max(row.y, figure.y0);
      if (overlap < 0.006) return;
      if ((row.x || 0) + (row.w || 0) < figure.x1 + 0.01) return;
      const sentence = /[א-ת]{4,}/.test(String(row.text || '')) && (row.w || 0) >= 0.2;
      if (!sentence || (row.x || 0) + (row.w || 0) >= 0.72) return;
      if (!ys.some((y) => Math.abs(y - row.y) <= 0.01)) ys.push(row.y);
      edge = Math.max(edge, (row.x || 0) + (row.w || 0));
      items.forEach((item) => {
        if (Math.abs((item.y || 0) - row.y) > 0.01) return;
        const right = (item.x || 0) + (item.w || 0);
        if ((item.x || 0) >= 0.78 || right > 0.80) return;
        if (right > edge) edge = right;
      });
    });
    // One short line beside a drawing is still the question. A stack of them is a table.
    if (ys.length >= 3 && edge > figure.x1) {
      items.forEach((item) => {
        const iy = item.y || 0;
        if (iy < figure.y0 - 0.008 || iy > figure.y1 + 0.008) return;
        const right = (item.x || 0) + (item.w || 0);
        // Part letters sit at the right margin. Column headers stop before them.
        if ((item.x || 0) >= 0.83 || right > 0.845) return;
        if (right > edge) edge = right;
      });
      tableBands.push({ y0: figure.y0, y1: figure.y1, x1: Math.min(0.84, edge) });
    }
  });
  const stemSpans = [];
  const takeStem = (item) => {
    const y = item.y || 0;
    const h = Math.max(item.h || 0.014, 0.01);
    if (furniture(item)) return;
    if (tableBands.some((band) => y >= band.y0 - 0.004 && y < band.y1 - 0.004 && (item.x || 0) < band.x1 - 0.004)) return;
    if (headerBottom && y < headerBottom - 0.006) return;
    if (y >= footerTop - 0.002) return;
    if (y + h < stemTop - 0.006 || y >= ceiling) return;
    if (questionTop != null && y < questionTop - 0.01) return;
    const text = item.text != null ? item.text : item.str;
    if (headerText(text) || otherNumber(item)) return;
    if (onFigure(item)) return;
    const letter = rowPart(String(text || ''));
    // A line that starts above the first part letter is the stem. The part letter's
    // own line keeps the margin question number and not that part's sentence.
    // Later lines are parts, including a worked-example (2) that is not the question number.
    if (y >= firstLabel - 0.006) {
      const n = questionNumberOf(item, items);
      const onPartLine = y < firstLabel + 0.012;
      if (!(onPartLine && n != null && (qNum == null || n === qNum) && (item.x || 0) >= 0.75)) return;
    }
    if (letter && questionTop != null && y > questionTop + 0.02) return;
    if (letter && questionTop == null && y > stemTop + 0.024) return;
    // A lone glyph in the left column belongs to the drawing. The left end of a
    // sentence (6·4·10 = 240) shares the line with the text column and stays.
    if ((item.x || 0) + (item.w || 0) < 0.42 && !letter && String(text || '').trim()) {
      const rightEdge = (item.x || 0) + (item.w || 0);
      // Joined to the sentence: the next glyph is within a word-gap, not a drawing away.
      const shares = items.some((other) => {
        if (other === item) return false;
        if (Math.abs((other.y || 0) - y) > 0.008) return false;
        const otherText = String(other.str || other.text || '').trim();
        if (otherText.length < 1) return false;
        const gap = (other.x || 0) - rightEdge;
        return gap >= 0.002 && gap < 0.14;
      });
      if (!shares) return;
    }
    stemSpans.push(item);
  };
  rows.forEach(takeStem);
  items.forEach(takeStem);
  const pushLines = (segment, spans, padBelow, maxBottom) => {
    const lines = [];
    spans.forEach((span) => {
      const y = span.y || 0;
      let line = null;
      let best = 0.011;
      lines.forEach((one) => {
        const dist = Math.abs(one.y - y);
        if (dist <= 0.01 && dist < best) {
          line = one;
          best = dist;
        }
      });
      if (!line) {
        line = { y, em: 0.012, spans: [] };
        lines.push(line);
      }
      line.y = Math.min(line.y, y);
      line.em = Math.max(line.em, span.h || 0.012, 0.012);
      line.spans.push(span);
    });
    lines.sort((a, b) => a.y - b.y);
    for (let i = 1; i < lines.length;) {
      if (lines[i].y - lines[i - 1].y <= 0.01) {
        const prev = lines[i - 1];
        prev.spans = prev.spans.concat(lines[i].spans);
        prev.em = Math.max(prev.em, lines[i].em);
        prev.y = Math.min(prev.y, lines[i].y);
        lines.splice(i, 1);
      } else i += 1;
    }
    const bands = [];
    lines.forEach((line) => {
      const last = bands[bands.length - 1];
      const gap = last ? line.y - (last.bot) : 1;
      const crossesFigure = last && figures.some((figure) => figure.y0 < line.y - 0.004 && figure.y1 > last.y + 0.01 && figure.x1 > 0.08);
      if (!last || gap > 0.04 || crossesFigure) bands.push({ y: line.y, bot: line.y, em: line.em, spans: line.spans.slice() });
      else {
        last.spans = last.spans.concat(line.spans);
        last.bot = line.y;
        last.em = Math.max(last.em, line.em);
      }
    });
    bands.forEach((band, index) => {
      let x0 = 1;
      let y0 = 1;
      let x1 = 0;
      let baseline = 0;
      let em = band.em || 0.012;
      band.spans.forEach((span) => {
        const spanEm = Math.max(span.h || 0.014, 0.012);
        x0 = Math.min(x0, span.x || 0);
        y0 = Math.min(y0, span.y || 0);
        x1 = Math.max(x1, (span.x || 0) + (span.w || 0));
        baseline = Math.max(baseline, (span.y || 0) + spanEm);
        if (spanEm > em) em = spanEm;
      });
      // PDF.js ends the box on the baseline. The line box continues above that top
      // (ascenders, nikud, geresh) and below it (ן ץ ך ף ק). Never stop on the tight ink.
      // A tall parenthesis must not set the pad: 0.006 is enough above the em top.
      const ascent = Math.max(0.004, Math.min(0.006, em * 0.3));
      const descent = Math.max(0.008, em * 0.55);
      let limit = baseline + descent;
      const nextBand = bands[index + 1];
      let nextInk = null;
      if (nextBand) {
        const nextEm = Math.max(nextBand.em || 0.012, 0.012);
        nextInk = nextBand.y - Math.max(0.004, Math.min(0.006, nextEm * 0.3));
      } else if (typeof maxBottom === 'number') nextInk = maxBottom;
      // A label beside this line shares its height. It must not erase the line.
      const beside = nextBand && nextBand.y <= baseline - 0.004;
      if (!beside && nextInk != null && nextInk - 0.002 < limit) limit = nextInk - 0.002;
      // A close next line must not steal this line's descenders. The floor stops
      // at that line, and at maxBottom, so a stem does not swallow the next part.
      const descentFloor = baseline + Math.min(descent, 0.004);
      if (limit < descentFloor) {
        let floor = descentFloor;
        if (nextBand) floor = Math.min(floor, nextBand.y - 0.002);
        if (typeof maxBottom === 'number') floor = Math.min(floor, maxBottom - 0.004);
        if (floor > limit) limit = floor;
      }
      if (index === bands.length - 1 && (padBelow || 0) > 0) {
        let room = baseline + padBelow;
        if (typeof maxBottom === 'number') room = Math.min(room, maxBottom - 0.004);
        if (nextInk != null) room = Math.min(room, nextInk - 0.002);
        if (room > limit) limit = room;
      }
      // Ending above the em top would leave a sliced stub of the next part's line.
      if (limit < y0 + Math.min(em, 0.012) * 0.72) return;
      const boxTop = y0 - ascent;
      const boxH = limit - boxTop;
      pushBox(segment, x0 - 0.008, boxTop, Math.max(0.04, x1 - x0 + 0.016), boxH);
    });
  };
  if (stemSpans.length) {
    const numberOnly = stemSpans.every((item) => questionNumberOf(item, items) != null);
    const firstPart = ordered[0];
    const firstPicked = firstPart && picked.some((part) => part.id === firstPart.id);
    // Capping the number at the first part's line slices the glyph and leaves a stray mark.
    // A later part printed alone still needs that number, at its full height.
    if (numberOnly && !firstPicked) pushLines('stem', stemSpans, 0.008, null);
    else if (!numberOnly) pushLines('stem', stemSpans, 0.008, firstLabel + 0.002);
  }
  else if (Math.min(firstLabel, ceiling) - stemTop > 0.012 && Math.min(firstLabel, ceiling) - stemTop < 0.14) {
    pushBox('stem', 0.34, stemTop, 0.64, Math.min(firstLabel, ceiling) - stemTop);
  }
  const drawnFigures = [];
  figures.forEach((figure) => {
    if (figure.whole) {
      drawnFigures.push(figure);
      pushBox('figure', Math.max(0, figure.x0 - 0.004), Math.max(0, figure.y0 - 0.006), figure.x1 - figure.x0 + 0.008, figure.y1 - figure.y0 + 0.012, figure);
      return;
    }
    // A long line that starts inside a blob and keeps going is the question, not the drawing.
    let drawnRight = figure.x1;
    let contentRight = figure.x1;
    let cutBySentence = false;
    rows.forEach((row) => {
      if ((row.w || 0) < 0.18) return;
      const overlap = Math.min(row.y + (row.h || 0.014), figure.y1) - Math.max(row.y, figure.y0);
      if (overlap < 0.006) return;
      if (row.x + row.w < figure.x1 + 0.01) return;
      // Only a line that begins in the text column can cut the drawing. A scale or axis reaches further left.
      // "המקורי." starts at 0.414, so a sentence may cut a little left of the 0.42 column.
      const sentence = /[א-ת]{4,}/.test(String(row.text || '')) && (row.w || 0) >= 0.2;
      // A table cell stops mid-page. Keep its rules and words in the drawing.
      if (sentence && row.x + row.w < 0.72) {
        let held = false;
        tableBands.forEach((band) => {
          if (row.y < band.y0 - 0.01 || row.y > band.y1 + 0.01) return;
          held = true;
          if (band.x1 > contentRight) contentRight = band.x1;
        });
        if (held) return;
      }
      if (row.x < (sentence ? 0.40 : 0.42) || row.x > figure.x1) return;
      drawnRight = Math.min(drawnRight, row.x - 0.006);
      cutBySentence = true;
    });
    const xLimit = cutBySentence ? drawnRight : Math.max(drawnRight, contentRight);
    const drawn = xLimit > figure.x0 + 0.02 ? { ...figure, x1: xLimit } : figure;
    drawnFigures.push(drawn);
    let x0 = drawn.x0;
    let y0 = drawn.y0;
    let x1 = drawn.x1;
    let y1 = drawn.y1;
    items.forEach((item) => {
      if (!figureHit(item, drawn)) return;
      x0 = Math.min(x0, item.x || 0);
      y0 = Math.min(y0, item.y || 0);
      x1 = Math.max(x1, (item.x || 0) + (item.w || 0));
      y1 = Math.max(y1, (item.y || 0) + Math.max(item.h || 0.01, 0.008));
    });
    const left = x0 < 0.04 ? 0.04 : x0 - 0.008;
    // A sentence cut must stay cut. Padding back across it reprints "י." from "המקורי.".
    // A short number sitting on that cut (the 4 in a table) is still part of the drawing.
    if (cutBySentence) {
      x1 = Math.min(x1, drawn.x1);
      items.forEach((item) => {
        const text = String(item.str || item.text || '').trim();
        if (!text || text.length > 3 || (item.w || 0) > 0.03 || /[א-ת]/.test(text)) return;
        const ix = item.x || 0;
        const right = ix + (item.w || 0);
        const iy = item.y || 0;
        if (iy < drawn.y0 - 0.012 || iy > drawn.y1 + 0.004) return;
        if (ix > drawn.x1 + 0.02 || right < drawn.x1 - 0.01) return;
        if (right > x1) x1 = right;
      });
    }
    // Ink sits 0.01 outside the stroke box. Once a label has already stretched the box, a full pad would swallow the next line.
    const padTop = y0 < drawn.y0 - 0.004 ? 0.004 : 0.014;
    const padBot = y1 > drawn.y1 + 0.004 ? 0.004 : 0.012;
    const padRight = cutBySentence ? 0.002 : (x1 > drawn.x1 + 0.004 ? 0.006 : 0.016);
    const top = y0 - padTop;
    pushBox('figure', left, top, x1 - left + padRight, y1 + padBot - top, drawn);
  });
  if (drawnFigures.length) {
    segments.forEach((entry) => {
      entry.figures = entry.box.segment === 'figure' ? drawnFigures : [];
    });
  }
  picked.forEach((part) => {
    const y0 = labelY(part);
    const next = ordered.find((other) => labelY(other) > y0 + 0.008);
    let y1 = part.row.y + part.row.h;
    if (next && labelY(next) < y1) y1 = labelY(next);
    y1 = Math.min(y1, ceiling, footerTop);
    if (y1 - y0 < 0.01) return;
    const spans = [];
    const takePart = (item) => {
      const y = item.y || 0;
      const h = Math.max(item.h || 0.012, 0.01);
      if (furniture(item)) return;
      if (headerBottom && y < headerBottom - 0.006) return;
      if (y >= footerTop - 0.002) return;
      const text = item.text != null ? item.text : item.str;
      const token = String(text || '').trim();
      // 10, 6, 16 beside the L are the drawing's edge labels, not the part sentence.
      if (/^[\d?]{1,3}$/.test(token) && (item.x || 0) < 0.48 && figures.some((figure) => {
        const cy = y + h * 0.4;
        return cy >= figure.y0 - 0.03 && cy <= figure.y1 + 0.03 && (item.x || 0) < figure.x1 + 0.16;
      })) return;
      if (headerText(text) || otherNumber(item)) return;
      // A numerator sits just above the part letter. A whole line that ends above it is the previous part.
      const above = y < y0 - 0.008;
      if (y + h < y0 - 0.004 || y < y0 - 0.024) return;
      if (above && ((item.w || 0) > 0.08 || String(text || '').trim().length > 4)) return;
      // The em box starts above the next part's label. The baseline is that next line.
      if (y + h > y1 + 0.002) return;
      if (y >= y1 - 0.002 || y >= ceiling) return;
      if (onFigure(item)) return;
      const letter = rowPart(String(text || ''));
      if (letter && letter !== part.part) return;
      spans.push(item);
    };
    rows.forEach(takePart);
    items.forEach(takePart);
    if (!spans.length) {
      const height = Math.min(y1, ceiling) - y0;
      // A catalog row that runs to the bottom of the page is blank paper. Keep one writing line.
      if (height > 0.012) pushBox('part', 0.32, y0, 0.66, Math.min(height, 0.12));
      return;
    }
    pushLines('part', spans, 0.028, Math.min(y1, ceiling));
  });
  segments.sort((a, b) => a.box.y - b.box.y || b.box.x - a.box.x);
  return segments;
}

function manifestPage(manifests, source, page) {
  if (!manifests || !source || !source.pdfId) return null;
  const manifest = manifests.get(source.pdfId);
  if (!manifest || !manifest.pages) return null;
  return manifest.pages[String(page)] || null;
}

function rebuildQuestionGroup(group, texts, manifests) {
  const sample = group[0];
  const slice = sample && sample.slice;
  if (!slice || !slice.source || !sample.bitmap) return null;
  const questions = slice.source.questions || [];
  const q = Number(String(slice.block || '').replace(/^q/, ''));
  if (!(q > 0)) return null;
  const page = slice.page;
  const parts = questions.filter((item) => item && item.q === q);
  if (!parts.length) return null;
  const onPage = parts.filter((item) => item.row && (item.row.page || item.page) === page);
  if (!onPage.length) return null;
  const picked = [];
  group.forEach((item) => {
    const piece = item.slice;
    const box = piece && piece.box;
    // The slice is the part the teacher picked. A shared figure may stretch the box over a later part.
    if (!box || piece.kind === 'stem') return;
    if (piece.partId) {
      if (picked.indexOf(piece.partId) < 0) picked.push(piece.partId);
      return;
    }
    let best = null;
    onPage.forEach((part) => {
      const label = part.labelLine && (part.labelLine.page || part.page) === page ? part.labelLine.y : part.row.y;
      if (label < box.y - 0.008 || label > box.y + box.h - 0.012) return;
      if (!best || label > best.label) best = { id: part.id, label };
    });
    if (best && picked.indexOf(best.id) < 0) picked.push(best.id);
  });
  if (!picked.length) return null;
  const earlier = questions.filter((item) => item && item.q < q && item.row && (item.row.page || item.page) === page);
  const earlierEnd = earlier.reduce((max, item) => Math.max(max, item.row.y + item.row.h), 0);
  const swallowed = earlier.length && group.some((item) => {
    const box = item.slice.box;
    return earlier.some((itemBefore) => {
      const y = itemBefore.labelLine ? itemBefore.labelLine.y : itemBefore.row.y;
      return box.y + 0.012 < y && y < box.y + box.h - 0.012;
    });
  });
  let searchTop = 1;
  let searchBot = 0;
  group.forEach((item) => {
    const box = item.slice.box;
    searchTop = Math.min(searchTop, box.y);
    searchBot = Math.max(searchBot, box.y + box.h);
  });
  onPage.forEach((part) => {
    if (part.stem && (part.stem.page || part.page) === page) searchTop = Math.min(searchTop, part.stem.y);
    searchTop = Math.min(searchTop, part.row.y);
    searchBot = Math.max(searchBot, part.row.y + part.row.h);
  });
  const textKey = slicePdf(sample) + ':' + page;
  const pageItems = texts && texts.get(textKey);
  const rows = textRows(pageItems);
  const marks = questionMarks(pageItems);
  let questionMark = null;
  marks.forEach((mark) => {
    if (mark.n !== q) return;
    if (mark.y < searchTop - 0.3 || mark.y > searchBot + 0.04) return;
    if (!questionMark || mark.y < questionMark.y) questionMark = mark;
  });
  let nextMark = null;
  marks.forEach((mark) => {
    const after = questionMark ? questionMark.y + 0.015 : searchTop + 0.02;
    if (mark.y < after) return;
    if (!nextMark || mark.y < nextMark.y) nextMark = mark;
  });
  let ownTop = 1;
  onPage.forEach((part) => {
    ownTop = Math.min(ownTop, part.row.y);
    if (part.stem && (part.stem.page || part.page) === page) ownTop = Math.min(ownTop, part.stem.y);
  });
  let catalogNext = null;
  questions.forEach((item) => {
    if (!item || item.q <= q || !item.row || (item.row.page || item.page) !== page) return;
    const top = item.row.y;
    // A higher question number can sit above this one. Only a row below this question cuts it.
    if (top < ownTop + 0.02) return;
    if (catalogNext == null || top < catalogNext) catalogNext = top;
  });
  // The next question number cuts the crop. When the page has no such number, the next catalog row does.
  const questionCut = nextMark ? nextMark.y - 0.004 : (catalogNext == null ? null : catalogNext - 0.008);
  // The next number can sit beside a drawing. Scan far enough to see that drawing's own bottom.
  const figureScanBot = Math.min(0.96, searchBot + 0.012);
  if (questionCut != null) searchBot = Math.min(searchBot, questionCut);
  if (questionMark) searchTop = Math.min(searchTop, questionMark.y - 0.008);
  const header = slice.source && slice.source.headerCrop;
  const headerBottom = header && Number(header.page) === Number(page) ? (header.y || 0) + (header.h || 0) : 0;
  const footerTop = sourceFooterTop(slice.source, pageItems);
  if (searchBot > footerTop) searchBot = footerTop;
  const manifestEntry = manifestPage(manifests, slice.source, page);
  const manifestFigures = manifestEntry
    ? (manifestEntry.figures || []).concat(manifestEntry.callouts || []).filter((figure) => Number(figure.q) === q).map((figure) => ({
      x0: figure.x,
      x1: figure.x + figure.w,
      y0: figure.y,
      y1: figure.y + figure.h,
      whole: true,
    }))
    : null;
  const figures = manifestFigures || leftFigureBoxes(sample.bitmap, Math.max(0, searchTop - 0.008), Math.min(figureScanBot, footerTop))
    .filter((figure) => !figureIsSentence(figure, rows))
    .filter((figure) => {
      if (earlierEnd > 0.02 && figure.y1 <= earlierEnd + 0.008) return false;
      if (earlierEnd > 0.02 && figure.y0 < earlierEnd - 0.012) {
        const height = figure.y1 - figure.y0;
        if (figure.y1 - earlierEnd < height * 0.55) return false;
      }
      return true;
    })
    .map((figure) => {
      // A previous house that only sticks a tail past this question's number is dropped.
      // A drawing this question owns keeps its own bottom when the next number sits beside it.
      const above = questionMark && figure.y1 < questionMark.y - 0.01;
      const beside = questionCut != null && figure.y0 < questionCut - 0.01 && figure.y1 > questionCut + 0.006;
      const y1 = questionCut != null && !beside && !above ? Math.min(figure.y1, questionCut) : figure.y1;
      const clipY = !above && !beside && questionMark ? Math.max(figure.y0, questionMark.y - 0.002) : figure.y0;
      const original = figure.y1 - figure.y0;
      const tail = !above && !beside && questionMark && figure.y0 < questionMark.y - 0.02 && (y1 - clipY) < original * 0.45;
      const yCap = Math.min(y1, footerTop);
      return tail || yCap - figure.y0 < 0.02 ? null : { ...figure, y0: figure.y0, y1: yCap };
    })
    .filter((figure) => figure && figure.y1 - figure.y0 >= 0.02);
  if (!manifestFigures) {
    onPage.forEach((part) => {
      const fig = part.figure;
      if (!fig || !(fig.y1 > fig.y0 + 0.018) || !(fig.x1 > fig.x0 + 0.02)) return;
      let replaced = false;
      figures.forEach((have, index) => {
        const overlapX = Math.min(have.x1, fig.x1) - Math.max(have.x0, fig.x0);
        const overlapY = Math.min(have.y1, fig.y1) - Math.max(have.y0, fig.y0);
        if (!(overlapX > 0.015 && overlapY > 0.015)) return;
        replaced = true;
        // The tagged box is the drawing. Keep a bottom the next question's number had cut off.
        if (fig.y1 > have.y1 + 0.006) figures[index] = { ...have, y1: fig.y1, y0: Math.min(have.y0, fig.y0) };
      });
      if (!replaced) figures.push({ x0: fig.x0, x1: fig.x1, y0: fig.y0, y1: fig.y1 });
    });
  }
  const labels = partMarks(pageItems);
  const boxes = layoutQuestionCrops({
    page,
    parts: onPage,
    picked,
    labels,
    figures,
    rows,
    items: pageItems,
    questionTop: questionMark ? questionMark.y - 0.006 : null,
    questionBot: questionCut,
    earlierEnd,
    headerBottom,
    footerTop,
  });
  if (!boxes.length) return null;
  boxes.forEach((entry) => {
    entry.figures = figures;
    if (entry.box) delete entry.box.masks;
    if (entry.box) delete entry.box.mask;
  });
  const lead = group[0].slice.gap;
  return boxes.map((entry, index) => {
    const nextSlice = {
      ...group[0].slice,
      kind: entry.kind,
      page: entry.page,
      gap: index ? 8 : lead,
      box: entry.box,
      figures: entry.figures || figures,
      clip: sourceClip(group[0].slice.source, entry.page, entry.box.segment || entry.kind),
    };
    const made = { slice: nextSlice, bitmap: sample.bitmap };
    syncSliceMetrics(made);
    return made;
  });
}

/**
 * A right-column mask hides only the start of a Hebrew line. Lines that
 * continue to the left are covered too. The line that carries this question's
 * number stays visible, and the crop stops at the next question's number.
 */
function polishQuestionSlice(item, items) {
  const slice = item && item.slice;
  const box = slice && slice.box;
  if (!box || !(box.h > 0) || !items || !items.length) return item;
  // Assembled pieces already omit the other lines. Painting white over them cuts labels.
  if (box.segment) return item;
  const q = Number(String(slice.block || '').replace(/^q/, ''));
  if (!(q > 0)) return item;
  const marks = questionMarks(items);
  let mine = null;
  marks.forEach((mark) => {
    if (mark.n !== q) return;
    if (mark.y < box.y - 0.004 || mark.y > box.y + box.h + 0.02) return;
    if (!mine || mark.y < mine.y) mine = mark;
  });
  let next = null;
  marks.forEach((mark) => {
    const after = mine ? mine.y + 0.015 : box.y + 0.02;
    if (mark.y < after) return;
    if (mark.y > box.y + box.h + 0.04) return;
    if (!next || mark.y < next.y) next = mark;
  });
  let nextBox = { ...box, masks: (box.masks || []).slice() };
  if (box.mask) nextBox.masks.push(box.mask);
  delete nextBox.mask;
  const cutBox = (cut) => {
    if (!(cut > nextBox.y + 0.012) || !(cut < nextBox.y + nextBox.h - 0.003)) return;
    const kept = nextBox.h;
    const oldY = nextBox.y;
    nextBox.h = cut - nextBox.y;
    nextBox.masks = nextBox.masks.map((mask) => {
      const top = oldY + mask.y * kept;
      const bot = top + mask.h * kept;
      if (top >= cut - 0.002) return null;
      const low = Math.max(top, nextBox.y);
      const high = Math.min(bot, cut);
      if (high - low < 0.004) return null;
      return { ...mask, y: (low - nextBox.y) / nextBox.h, h: (high - low) / nextBox.h };
    }).filter(Boolean);
  };
  if (next && next.y > nextBox.y + 0.016 && next.y < nextBox.y + nextBox.h - 0.004) cutBox(next.y - 0.004);
  // A stem that runs into the first part's writing line leaves a grey stub in the margin.
  if (slice.kind === 'stem' && mine) {
    const rows = textRows(items);
    const partRow = rows.filter((row) => rowPart(row.text) && row.y > mine.y + 0.008).sort((a, b) => a.y - b.y)[0];
    if (partRow && partRow.y < nextBox.y + nextBox.h + 0.002 && partRow.y > nextBox.y + nextBox.h - 0.02) {
      let textBottom = nextBox.y;
      rows.forEach((row) => {
        const bot = row.y + Math.max(row.h, 0.01);
        if (bot < partRow.y - 0.002 && row.y < nextBox.y + nextBox.h && bot > textBottom) textBottom = bot;
      });
      // A drawing under the wording is taller than this. Only the grey stub above the first part goes.
      if (textBottom > nextBox.y + 0.008 && nextBox.y + nextBox.h - textBottom < 0.02) {
        cutBox(Math.min(partRow.y - 0.003, textBottom + 0.004));
      }
    }
  }
  if (mine && mine.y > nextBox.y + 0.004 && mine.y < nextBox.y + nextBox.h - 0.004) {
    const lineTop = mine.y - 0.003;
    const lineBot = mine.y + mine.h + 0.008;
    const covered = nextBox.masks.some((mask) => {
      if ((mask.role !== 'swallowed' && mask.role !== 'sibling') || mask.x > 0.5) return false;
      const top = nextBox.y + mask.y * nextBox.h;
      const bot = top + mask.h * nextBox.h;
      return lineTop < bot - 0.004 && lineBot > top + 0.004;
    });
    if (covered) {
      nextBox.masks = punchMasks(nextBox.masks, nextBox, lineTop, lineBot);
      nextBox.masks.push({
        x: 0,
        w: 0.38,
        y: 0,
        h: Math.min(1, (Math.min(nextBox.y + nextBox.h, lineBot) - nextBox.y) / nextBox.h),
        role: 'prev-figure',
      });
    }
  }
  const hide = [];
  (nextBox.masks || []).forEach((mask) => {
    if (mask.role !== 'sibling' && mask.role !== 'swallowed') return;
    hide.push([nextBox.y + mask.y * nextBox.h, nextBox.y + (mask.y + mask.h) * nextBox.h]);
  });
  if (next) hide.push([next.y - 0.002, 1]);
  if (mine) hide.push([0, mine.y - 0.004]);
  // A stem box sometimes ends on the first part's line. That line is not the stem.
  if (slice.kind === 'stem' && mine) {
    const partRow = textRows(items).filter((row) => rowPart(row.text) && row.x + row.w > 0.8 && row.y > mine.y + 0.01).sort((a, b) => a.y - b.y)[0];
    if (partRow && partRow.y > nextBox.y + 0.008 && partRow.y < nextBox.y + nextBox.h - 0.002) {
      hide.push([partRow.y - 0.003, Math.min(nextBox.y + nextBox.h, partRow.y + Math.max(partRow.h, 0.012) + 0.004)]);
    }
  }
  const rows = textRows(items);
  let figures = slice.figures || [];
  if (!figures.length && item.bitmap) {
    figures = leftFigureBoxes(item.bitmap, Math.max(0, nextBox.y - 0.012), Math.min(1, nextBox.y + nextBox.h + 0.012))
      .filter((figure) => !figureIsSentence(figure, rows));
  }
  if (rows.length) lineMasksFor(nextBox, rows, hide, figures, items).forEach((mask) => nextBox.masks.push(mask));
  const rules = maskWritingRules(item.bitmap, nextBox, hide).concat(maskMarginTicks(item.bitmap, nextBox));
  nextBox.masks = carveMasks(nextBox.masks.concat(rules), nextBox, figures);
  if (!nextBox.masks.length) delete nextBox.masks;
  return { ...item, slice: { ...slice, box: nextBox, figures } };
}

function polishQuestionCrops(measured, texts) {
  return measured.map((item) => {
    const slice = item && item.slice;
    if (!slice || (slice.kind !== 'stem' && slice.kind !== 'row') || !slice.page) return item;
    const key = slicePdf(item) + ':' + slice.page;
    return polishQuestionSlice(item, texts && texts.get(key));
  });
}

function enrichQuestionCrops(measured, texts, manifests) {
  const out = [];
  let index = 0;
  while (index < measured.length) {
    const item = measured[index];
    const slice = item && item.slice;
    const drawable = slice && (slice.kind === 'stem' || slice.kind === 'row') && slice.block && item.bitmap;
    if (!drawable) {
      out.push(item);
      index += 1;
      continue;
    }
    const pdf = slicePdf(item);
    let end = index + 1;
    while (end < measured.length) {
      const other = measured[end];
      const next = other && other.slice;
      if (!next || next.block !== slice.block || next.page !== slice.page || slicePdf(other) !== pdf) break;
      if (next.kind !== 'stem' && next.kind !== 'row') break;
      end += 1;
    }
    const group = measured.slice(index, end);
    const replaced = rebuildQuestionGroup(group, texts, manifests);
    if (replaced) replaced.forEach((made) => out.push(made));
    else group.forEach((made) => out.push(made));
    index = end;
  }
  return dedupeSharedFigures(out);
}

function dedupeSharedFigures(measured) {
  const kept = [];
  measured.forEach((item) => {
    const box = item && item.slice && item.slice.box;
    if (!box || box.segment !== 'figure') {
      kept.push(item);
      return;
    }
    const dup = kept.some((prev) => {
      const other = prev.slice && prev.slice.box;
      if (!other || other.segment !== 'figure') return false;
      if (prev.slice.page !== item.slice.page) return false;
      if (slicePdf(prev) !== slicePdf(item)) return false;
      const overlapX = Math.min(other.x + other.w, box.x + box.w) - Math.max(other.x, box.x);
      const overlapY = Math.min(other.y + other.h, box.y + box.h) - Math.max(other.y, box.y);
      if (!(overlapX > 0.02) || !(overlapY > 0.02)) return false;
      const inter = overlapX * overlapY;
      const area = Math.min(other.w * other.h, box.w * box.h);
      return area > 0 && inter / area > 0.72;
    });
    if (!dup) kept.push(item);
  });
  return kept;
}

async function measureWorksheet(slices) {
  const OUT_W = 1000;
  const measured = [];
  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index];
    if (slice.kind === 'level' || slice.kind === 'answers-head') {
      measured.push({ slice, dh: slice.kind === 'answers-head' ? 46 : 34 });
    } else if (slice.kind === 'missing') {
      measured.push({ slice, dh: 26 });
    } else if (slice.kind === 'answer' || slice.kind === 'row' || slice.kind === 'stem') {
      const bitmap = await pageBitmap(slice.page, slice.source, 'print');
      const piece = trimPieceBox(await clipClosingLine(slice), bitmap);
      if (!piece.clip) piece.clip = sourceClip(piece.source || slice.source, piece.page, (piece.box && piece.box.segment) || piece.kind);
      const sw = piece.box.w * bitmap.width;
      const sh = piece.box.h * bitmap.height;
      const imageH = Math.max(1, Math.round(OUT_W * sh / Math.max(1, sw)));
      if (piece.kind === 'answer') {
        const naturalW = Math.max(1, OUT_W * piece.box.w);
        const naturalH = Math.max(1, naturalW * sh / Math.max(1, sw));
        const cell = answerCellSize(piece.text, naturalW, naturalH);
        measured.push({
          slice: piece,
          bitmap,
          sw,
          sh,
          dw: cell.dw,
          dh: cell.dh,
          imageW: cell.imageW,
          imageH: cell.imageH,
          imageY: cell.imageY,
          labelBaseline: cell.labelBaseline,
          answerScale: cell.scale,
          labelW: cell.labelW,
          stack: cell.stack,
        });
      } else {
        measured.push({ slice: piece, bitmap, sw, sh, dh: imageH });
      }
    }
  }
  claimDrawingTails(measured);
  sealOverlaps(measured);
  dropBlankForeign(measured);
  const texts = new Map();
  for (let index = 0; index < measured.length; index += 1) {
    const slice = measured[index].slice;
    if (!slice || !slice.page || (slice.kind !== 'stem' && slice.kind !== 'row')) continue;
    const key = slicePdf(measured[index]) + ':' + slice.page;
    if (texts.has(key)) continue;
    try {
      texts.set(key, await pageTextItems(slice.page, slice.source));
    } catch (error) {
      texts.set(key, []);
    }
  }
  const manifests = new Map();
  for (let index = 0; index < measured.length; index += 1) {
    const source = measured[index] && measured[index].slice && measured[index].slice.source;
    if (!source || !source.pdfId || manifests.has(source.pdfId)) continue;
    manifests.set(source.pdfId, await loadCropManifest(source.pdfId));
  }
  const polished = polishQuestionCrops(enrichQuestionCrops(measured, texts, manifests), texts);
  bakeMeasuredClips(polished);
  releasePageBitmaps();
  return polished;
}

function writingDashRows(data, width, height) {
  const rows = [];
  if (!data || !(width > 8) || !(height > 8)) return rows;
  const lumAt = (x, y) => {
    const i = (y * width + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  const dark = (x, y) => lumAt(x, y) < 210;
  // A letter cap is a short-run row with the letter body just under it.
  // A writing dash has blank paper there. 0.10 sits above a real dash
  // (about 0.04) and below an answer-key cap (about 0.12).
  const inkBelow = (y) => {
    let body = 0;
    const bx0 = Math.floor(width * 0.06);
    const bx1 = Math.floor(width * 0.94);
    const samples = Math.ceil(Math.max(1, bx1 - bx0) / 2);
    for (let dy = 4; dy <= 14; dy += 1) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      let n = 0;
      for (let x = bx0; x < bx1; x += 2) if (lumAt(x, yy) < 232) n += 1;
      const fracBelow = n / samples;
      if (fracBelow > body) body = fracBelow;
    }
    return body;
  };
  const xL = Math.floor(width * 0.38);
  const xR = Math.floor(width * 0.92);
  const span = Math.max(1, xR - xL);
  const seen = new Set();
  const keep = (y) => {
    if (seen.has(y)) return;
    seen.add(y);
    rows.push(y);
  };
  for (let y = 1; y < height - 1; y += 1) {
    let n = 0;
    let longest = 0;
    let run = 0;
    let gaps = 0;
    let prev = false;
    for (let x = xL; x < xR; x += 1) {
      if (dark(x, y)) {
        n += 1;
        run += 1;
        if (run > longest) longest = run;
        prev = true;
      } else if (prev) {
        gaps += 1;
        run = 0;
        prev = false;
      } else run = 0;
    }
    const frac = n / span;
    if (frac < 0.45 || frac > 0.78 || longest >= width * 0.02 || gaps < 20) continue;
    if (inkBelow(y) > 0.10) continue;
    keep(y);
  }
  // A writing rule under a line of text has long letter runs, so the test above misses it.
  // Count only the short dashes, and only when they show on both sides of the page.
  // A diagram dash that stays inside the figure (the divider through "12") does not.
  const x0 = Math.floor(width * 0.06);
  const x1 = Math.floor(width * 0.94);
  const mid = Math.floor(width * 0.5);
  const shortMax = Math.max(4, Math.round(width * 0.016));
  const wide = Math.max(1, x1 - x0);
  for (let y = 2; y < height - 2; y += 1) {
    if (seen.has(y)) continue;
    let left = 0;
    let right = 0;
    let gaps = 0;
    let run = 0;
    let runStart = 0;
    let prev = false;
    const close = (x) => {
      if (!prev) return;
      if (run > 0 && run <= shortMax) {
        const mark = (at) => {
          if (at < mid) left += 1;
          else right += 1;
        };
        for (let at = runStart; at < x; at += 1) mark(at);
        gaps += 1;
      }
      run = 0;
      prev = false;
    };
    for (let x = x0; x < x1; x += 1) {
      if (lumAt(x, y) < 232) {
        if (!prev) runStart = x;
        run += 1;
        prev = true;
      } else close(x);
    }
    close(x1);
    if (left < 4 || right < 4 || gaps < 12) continue;
    const frac = (left + right) / wide;
    if (frac < 0.06 || frac > 0.62) continue;
    const quiet = (dy) => {
      const yy = y + dy;
      if (yy < 0 || yy >= height) return true;
      let n = 0;
      for (let x = x0; x < x1; x += 3) if (lumAt(x, yy) < 232) n += 1;
      return n / Math.ceil(wide / 3) < frac * 0.55;
    };
    if (!quiet(-3) || !quiet(3)) continue;
    // The flat tops of a Hebrew line are short runs with white just above them.
    if (inkBelow(y) > 0.10) continue;
    keep(y);
  }
  return rows;
}

function eraseWritingDashes(data, width, height, rows, srcY) {
  if (!data || !rows || !rows.length) return;
  const lumAt = (x, y) => {
    if (y < 0 || y >= height || x < 0 || x >= width) return 255;
    const i = (y * width + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  // A writing dash is a few gray pixels. A separate line a few pixels away does not
  // save it. Keep real dark ink (a diagonal, a letter, a triangle edge) and a gray
  // stroke that continues well above and below (an axis). Paint the rest pure white,
  // including the near-white halo a lighter mask used to leave.
  const keepStroke = (x, y) => {
    const lum = lumAt(x, y);
    if (lum < 100) return true;
    if (lum >= 210) return false;
    let above = 0;
    for (let yy = y - 1; yy >= 0 && lumAt(x, yy) < 210; yy -= 1) {
      above += 1;
      if (above >= 4) break;
    }
    if (above < 4) return false;
    let below = 0;
    for (let yy = y + 1; yy < height && lumAt(x, yy) < 210; yy += 1) {
      below += 1;
      if (below >= 4) break;
    }
    return below >= 4;
  };
  rows.forEach((absY) => {
    const y = absY - srcY;
    if (y < 0 || y >= height) return;
    for (let x = 0; x < width; x += 1) {
      if (lumAt(x, y) >= 253) continue;
      if (keepStroke(x, y)) continue;
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
  });
}

function bakeMeasuredClips(measured) {
  const dashCache = new Map();
  (measured || []).forEach((item) => {
    const bitmap = item && item.bitmap;
    const box = item && item.slice && item.slice.box;
    if (!bitmap || !box || !(bitmap.width > 8) || item.baked) return;
    const sx = Math.max(0, Math.floor(box.x * bitmap.width));
    const sy = Math.max(0, Math.floor(box.y * bitmap.height));
    const sw = Math.max(1, Math.min(bitmap.width - sx, Math.ceil(box.w * bitmap.width)));
    const sh = Math.max(1, Math.min(bitmap.height - sy, Math.ceil(box.h * bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    if (bitmap.getContext && !box.locked && !box.whole) {
      let dashes = dashCache.get(bitmap);
      if (!dashes) {
        try {
          const page = bitmap.getContext('2d').getImageData(0, 0, bitmap.width, bitmap.height);
          dashes = writingDashRows(page.data, bitmap.width, bitmap.height);
        } catch (error) {
          dashes = [];
        }
        dashCache.set(bitmap, dashes);
      }
      if (dashes.length) {
        const image = ctx.getImageData(0, 0, sw, sh);
        eraseWritingDashes(image.data, sw, sh, dashes, sy);
        ctx.putImageData(image, 0, 0);
      }
    }
    item.originalPageWidth = bitmap.width;
    item.bitmap = canvas;
    item.sw = sw;
    item.sh = sh;
    item.baked = true;
  });
}

function releasePageBitmaps() {
  pageBitmaps.forEach((canvas) => {
    canvas.width = 0;
    canvas.height = 0;
  });
  pageBitmaps.clear();
}

function measureNote(note) {
  const text = String(note || '').trim();
  if (!text) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const maxW = 1000 - 56;
  ctx.font = '16px Heebo, Arial, sans-serif';
  const lines = [];
  text.split(/\n/).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      return;
    }
    let line = '';
    words.forEach((word) => {
      const trial = line ? line + ' ' + word : word;
      if (line && ctx.measureText(trial).width > maxW) {
        lines.push(line);
        line = word;
      } else line = trial;
    });
    if (line) lines.push(line);
  });
  const lineH = 22;
  return { lines, lineH, height: 36 + lines.length * lineH };
}

function flowAnswers(items) {
  const out = [];
  items.forEach((item) => {
    if (!item.slice || item.slice.kind !== 'answer' || !(item.dw > 0)) {
      out.push(item);
      return;
    }
    // Each answer keeps its own key line. A 3px gap on an ink-tight crop is
    // about 56–60 device pixels at 300 DPI, so a short leftover fits the page above.
    out.push({
      slice: { kind: 'answer-row', gap: 3, block: 'answers' },
      dh: item.dh,
      cells: [item],
    });
  });
  return out;
}

function packWorksheet(measured, noteHeight) {
  measured = flowAnswers(measured);
  const PAGE_H = 1440;
  const FOOT = 36;
  const FIRST_TOP = 118 + Math.max(0, noteHeight || 0);
  const CONT_TOP = 48;
  const heading = (item) => item && (item.slice.kind === 'stem' || item.slice.kind === 'level' || item.slice.kind === 'answers-head');
  const heightOf = (items, top) => top + FOOT + contentHeight(items);
  const pieceKey = (item) => {
    const slice = item && item.slice;
    if (!slice || (slice.kind !== 'stem' && slice.kind !== 'row') || !slice.block) return '';
    const pdf = slice.source && slice.source.pdfId ? String(slice.source.pdfId) : '';
    return pdf + '\n' + slice.block;
  };
  const scalePiece = (items, limit) => {
    const height = contentHeight(items);
    if (height <= limit || height <= 0) return items;
    const factor = limit / height;
    const scaled = items.map((item) => scalePlaced(item, factor));
    const extra = contentHeight(scaled) - limit;
    if (extra > 0) scaled[scaled.length - 1].dh = Math.max(1, scaled[scaled.length - 1].dh - extra);
    return scaled;
  };
  const groups = [];
  measured.forEach((item) => {
    const key = pieceKey(item);
    const last = groups[groups.length - 1];
    if (key && last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  });
  const fits = (items, chunk, at) => heightOf(items.concat(chunk), at) <= PAGE_H;
  const pages = [];
  let page = [];
  let top = FIRST_TOP;
  groups.forEach((group) => {
    let chunk = group.items;
    if (page.length && !fits(page, chunk, top)) {
      const last = page[page.length - 1];
      const carry = heading(last);
      if (carry) page.pop();
      if (page.length) pages.push({ top, items: page });
      page = carry ? [last] : [];
      top = CONT_TOP;
    }
    if (!page.length && top > CONT_TOP && !fits(page, chunk, top) && fits(page, chunk, CONT_TOP)) top = CONT_TOP;
    if (!fits(page, chunk, top)) {
      const answerChunk = chunk.length && chunk.every((item) => item.slice && (item.slice.kind === 'answer' || item.slice.kind === 'answer-row' || item.slice.kind === 'missing' || item.slice.kind === 'answers-head'));
      if (answerChunk) {
        if (page.length) pages.push({ top, items: page });
        page = [];
        top = CONT_TOP;
      } else {
        const lead = page.length && chunk.length ? (chunk[0].slice.gap || 0) : 0;
        const room = PAGE_H - top - FOOT - contentHeight(page) - lead;
        chunk = scalePiece(chunk, Math.max(1, room));
      }
    }
    page = page.concat(chunk);
  });
  if (page.length) pages.push({ top, items: page });
  if (!pages.length) pages.push({ top: FIRST_TOP, items: [] });
  // A leftover answer page goes back onto the previous page only when it fits
  // unscaled: the key crop is drawn at its own size, so a shorter row would let
  // the next row paint over it.
  while (pages.length > 1) {
    const last = pages[pages.length - 1];
    const answerish = (item) => item.slice && (item.slice.kind === 'answer' || item.slice.kind === 'missing' || item.slice.kind === 'answers-head' || item.slice.kind === 'answer-row');
    const answerCount = (item) => {
      if (!item.slice) return 0;
      if (item.slice.kind === 'answer-row') return (item.cells || []).length;
      if (item.slice.kind === 'answer' || item.slice.kind === 'missing') return 1;
      return 0;
    };
    if (!last.items.length || !last.items.every(answerish)) break;
    const count = last.items.reduce((sum, item) => sum + answerCount(item), 0);
    const prev = pages[pages.length - 2];
    const room = PAGE_H - heightOf(prev.items, prev.top);
    if (room < 36) break;
    const extra = last.items.map((item) => ({ ...item, slice: { ...item.slice } }));
    const leadGap = extra.length ? Math.max(0, extra[0].slice.gap || 0) : 0;
    if (leadGap + contentHeight(extra) > room) break;
    prev.items = prev.items.concat(extra);
    pages.pop();
  }
  // A short last page (an answer tail under 40%, anything else under a quarter)
  // joins the previous page at full size. Only the whitespace between pieces
  // gives way, down to half and never under 4px; no crop is ever scaled, so
  // every row keeps the height of what is drawn in it.
  while (pages.length > 1) {
    const last = pages[pages.length - 1];
    const prev = pages[pages.length - 2];
    if (!last.items.length) {
      pages.pop();
      continue;
    }
    const answerTail = last.items.every((item) => item.slice && (item.slice.kind === 'answer' || item.slice.kind === 'missing' || item.slice.kind === 'answers-head' || item.slice.kind === 'answer-row'));
    const cap = answerTail ? PAGE_H * 0.4 : PAGE_H * 0.25;
    if (contentHeight(last.items) >= cap) break;
    const combined = prev.items.concat(last.items).map((item) => ({ ...item, slice: { ...item.slice } }));
    const sample = combined.find((item) => item.bitmap && item.bitmap.width);
    const device = sample ? (sample.originalPageWidth || sample.bitmap.width) / 1000 : 0;
    let over = heightOf(combined, prev.top) - PAGE_H;
    for (let index = combined.length - 1; index > 0 && over > 1e-6; index -= 1) {
      const gap = combined[index].slice.gap || 0;
      if (gap <= 4) continue;
      // Whole device pixels only: a fractional shift resamples every crop below
      // it onto a new subpixel phase and thins its one-pixel rules.
      const most = gap - Math.max(4, Math.ceil(gap / 2));
      const want = Math.min(over, most);
      const up = device ? Math.ceil(want * device) / device : want;
      const take = up <= most ? up : Math.floor(want * device) / device;
      combined[index].slice.gap = gap - take;
      over -= take;
    }
    if (over > 1e-6) break;
    prev.items = combined;
    pages.pop();
  }
  return pages;
}

function clearGreyRules(ctx, width, height) {
  let image;
  try {
    image = ctx.getImageData(0, 0, width, height);
  } catch (error) {
    return;
  }
  const data = image && image.data;
  if (!data || data.length < width * height * 4) return;
  const rule = new Uint8Array(height);
  for (let y = 0; y < height; y += 1) {
    let grey = 0;
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const lum = (r + g + b) / 3;
      if (max - min < 28 && lum >= 145 && lum <= 242) grey += 1;
      else if (lum < 90) dark += 1;
    }
    if (grey > width * 0.45 && dark < Math.max(3, width * 0.12)) rule[y] = 1;
  }
  let changed = false;
  for (let y = 0; y < height; y += 1) {
    if (!rule[y]) continue;
    let run = 0;
    for (let row = y; row < height && rule[row]; row += 1) run += 1;
    if (run > 3) {
      y += run - 1;
      continue;
    }
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const lum = (r + g + b) / 3;
      if (max - min < 28 && lum >= 145 && lum <= 242) {
        data[i] = data[i + 1] = data[i + 2] = 255;
        changed = true;
      }
    }
  }
  // A highlight box around one value is a short grey stroke, not a full-width rule.
  const whiteAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    const i = (y * width + x) * 4;
    return data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238;
  };
  const greyAt = (x, y) => {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const lum = (r + g + b) / 3;
    return max - min < 28 && lum >= 145 && lum <= 242;
  };
  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      if (!greyAt(x, y)) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < width && greyAt(x, y)) x += 1;
      if (x - start < 14) continue;
      let open = 0;
      for (let k = start; k < x; k += 2) {
        if (whiteAt(k, y - 1) && whiteAt(k, y + 1)) open += 1;
      }
      const samples = Math.ceil((x - start) / 2);
      if (samples && open / samples < 0.7) continue;
      for (let k = start; k < x; k += 1) {
        const i = (y * width + k) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        changed = true;
      }
    }
  }
  if (changed) ctx.putImageData(image, 0, 0);
}

function coverWholeFigures(ctx, item, destX, destY, destW, destH) {
  const box = item && item.slice && item.slice.box;
  const figures = item && item.slice && item.slice.figures;
  if (!box || box.segment === 'figure' || !figures || !figures.length || !(box.w > 0) || !(box.h > 0)) return;
  ctx.fillStyle = '#fff';
  figures.forEach((figure) => {
    if (!figure || !figure.whole) return;
    const x0 = Math.max(box.x, figure.x0);
    const y0 = Math.max(box.y, figure.y0);
    const x1 = Math.min(box.x + box.w, figure.x1);
    const y1 = Math.min(box.y + box.h, figure.y1);
    if (x1 - x0 < 0.004 || y1 - y0 < 0.004) return;
    ctx.fillRect(
      destX + ((x0 - box.x) / box.w) * destW,
      destY + ((y0 - box.y) / box.h) * destH,
      ((x1 - x0) / box.w) * destW,
      ((y1 - y0) / box.h) * destH,
    );
  });
}

function answerInkCanvas(bitmap, sx, sy, sw, sh, box) {
  const w = Math.max(1, Math.ceil(sw));
  const h = Math.max(1, Math.ceil(sh));
  const cut = document.createElement('canvas');
  cut.width = w;
  cut.height = h;
  const ctx = cut.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  clearGreyRules(ctx, w, h);
  if (box) fillSliceMasks(ctx, box, 0, h, w);
  return cut;
}

function printTraceReset() {
  if (typeof window === 'undefined') return;
  window.__printTrace = [];
}

function printTracePush(entry) {
  if (typeof window === 'undefined') return;
  const list = window.__printTrace || (window.__printTrace = []);
  list.push(entry);
}

function printElementId(slice) {
  if (!slice) return null;
  const pdf = (slice.source && slice.source.pdfId) || (slice.clip && slice.clip.pdfId) || '';
  const box = slice.box || {};
  const srcPage = slice.page || 0;
  const block = slice.block || '';
  const seg = box.segment || slice.kind || '';
  const source = {
    page: srcPage,
    x: Math.round((box.x || 0) * 1000) / 1000,
    y: Math.round((box.y || 0) * 1000) / 1000,
    w: Math.round((box.w || 0) * 1000) / 1000,
    h: Math.round((box.h || 0) * 1000) / 1000,
  };
  if (slice.kind === 'answer') {
    const who = slice.questionId || slice.partId || String(slice.text || '');
    return { kind: 'answer', id: pdf + '|answer|' + who, source };
  }
  if (seg === 'figure') {
    const yk = Math.round((box.y || 0) * 200);
    const xk = Math.round((box.x || 0) * 200);
    return { kind: 'figure', id: pdf + '|figure|' + block + '|' + srcPage + '|' + yk + '|' + xk, source };
  }
  if (slice.kind === 'stem' || seg === 'stem') {
    return { kind: 'stem', id: pdf + '|stem|' + block + '|' + srcPage, source };
  }
  if (slice.kind === 'row') {
    const who = slice.partId || (block + '@' + Math.round((box.y || 0) * 200));
    return { kind: 'part', id: pdf + '|part|' + who + '|' + srcPage, source };
  }
  return null;
}

function printTraceElement(slice, pageIndex, dx, dy, dw, dh, sw, sh) {
  const el = printElementId(slice);
  if (!el || !(dw > 0) || !(dh > 0)) return;
  const scale = Math.sqrt((dw / Math.max(1, sw)) * (dh / Math.max(1, sh)));
  const x = Math.floor(dx);
  const y = Math.floor(dy);
  printTracePush({
    kind: el.kind,
    id: el.id,
    page: pageIndex,
    x,
    y,
    w: Math.max(1, Math.ceil(dx + dw) - x),
    h: Math.max(1, Math.ceil(dy + dh) - y),
    scale: Math.round(scale * 10000) / 10000,
    source: el.source,
  });
}

function printTraceChrome(pageIndex, x, y, w, h) {
  if (!(w > 0) || !(h > 0)) return;
  printTracePush({
    kind: 'chrome',
    id: '',
    page: pageIndex,
    x: Math.round(x),
    y: Math.round(y),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
    scale: 1,
    source: null,
  });
}

function paintWorksheetPage(canvas, page, index, count, title, note) {
  const OUT_W = 1000;
  const PAGE_H = 1440;
  const sample = page.items.find((item) => item.bitmap && item.bitmap.width);
  const scale = printCanvasScale(sample ? (sample.originalPageWidth || sample.bitmap.width) : 0);
  canvas.width = Math.round(OUT_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  printTraceChrome(index, 0, 0, canvas.width, Math.max(1, Math.round(page.top * scale)));
  const footTop = Math.round((PAGE_H - 36) * scale);
  printTraceChrome(index, 0, footTop, canvas.width, Math.max(1, canvas.height - footTop));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
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
    if (note && note.lines && note.lines.length) {
      ctx.font = '700 16px Heebo, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText('הערת המורה', OUT_W - 28, 128);
      ctx.font = '16px Heebo, Arial, sans-serif';
      note.lines.forEach((line, lineIndex) => {
        ctx.fillText(line, OUT_W - 28, 128 + 22 + lineIndex * (note.lineH || 22));
      });
    }
  }
  let y = page.top;
  page.items.forEach((item, itemIndex) => {
    if (itemIndex) y += item.slice.gap;
    const kind = item.slice.kind;
    if (kind === 'level' || kind === 'answers-head') {
      printTraceChrome(index, 0, y * scale, canvas.width, Math.max(1, item.dh * scale));
      ctx.fillStyle = '#1a2744';
      ctx.font = kind === 'answers-head' ? '700 24px Heebo, Arial, sans-serif' : '700 18px Heebo, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText(item.slice.text, OUT_W - 28, y + (kind === 'answers-head' ? 26 : 24));
    } else if (kind === 'missing') {
      printTraceChrome(index, 0, y * scale, canvas.width, Math.max(1, item.dh * scale));
      ctx.fillStyle = '#1a2744';
      ctx.font = '16px Heebo, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillText(item.slice.text, OUT_W - 28, y + 18);
    } else if (kind === 'answer' || kind === 'answer-row') {
      const cells = kind === 'answer-row' ? item.cells : [item];
      let right = OUT_W - 28;
      // The crop is already at print resolution. Copy it onto whole device pixels.
      // Smoothing a one-pixel Hebrew cap onto a fractional destination turns it
      // into a hollow gray bar, and nearest-neighbor on that fraction drops it.
      const paintAnswer = (ink, logicalX, logicalY, logicalW, logicalH, natural) => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        const dx = Math.round(logicalX * scale);
        const dy = Math.round(logicalY * scale);
        // A natural-size answer is already one source pixel per device pixel.
        if (natural) ctx.drawImage(ink, dx, dy);
        else ctx.drawImage(ink, dx, dy, Math.max(1, Math.round(logicalW * scale)), Math.max(1, Math.round(logicalH * scale)));
        ctx.restore();
      };
      cells.forEach((cell) => {
        const labelW = cell.labelW || 0;
        const imageW = cell.imageW || Math.max(1, (cell.dw || 40) - labelW - 8);
        const imageH = cell.imageH || Math.max(1, cell.dh - (cell.stack ? 18 : 2));
        ctx.fillStyle = '#1a2744';
        ctx.font = '15px Heebo, Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.direction = 'rtl';
        const sx = cell.baked ? 0 : cell.slice.box.x * cell.bitmap.width;
        const sy = cell.baked ? 0 : cell.slice.box.y * cell.bitmap.height;
        const sw = cell.baked ? cell.bitmap.width : cell.sw;
        const sh = cell.baked ? cell.bitmap.height : cell.sh;
        const ink = answerInkCanvas(cell.bitmap, sx, sy, sw, sh, cell.slice.box);
        const natural = cell.answerScale === 1;
        let imageX;
        let imageY;
        if (cell.stack) {
          ctx.fillText(cell.slice.text, right, y + 14);
          printTraceChrome(index, (right - labelW) * scale, y * scale, Math.max(1, labelW * scale), Math.max(1, 18 * scale));
          imageX = right - imageW;
          imageY = y + 18;
        } else {
          const textY = y + (cell.labelBaseline || Math.max(14, Math.round((item.dh + 10) / 2)));
          ctx.fillText(cell.slice.text, right, textY);
          const drawnLabel = Math.ceil(ctx.measureText(String(cell.slice.text || '')).width);
          const labelSpan = Math.max(labelW, drawnLabel);
          printTraceChrome(index, (right - labelSpan) * scale, y * scale, Math.max(1, labelSpan * scale), Math.max(1, item.dh * scale));
          imageX = right - labelSpan - 8 - imageW;
          imageY = y + (cell.imageY == null ? Math.max(0, Math.round((item.dh - imageH) / 2)) : cell.imageY);
        }
        paintAnswer(ink, imageX, imageY, imageW, imageH, natural);
        const drawW = natural ? ink.width : Math.max(1, Math.round(imageW * scale));
        const drawH = natural ? ink.height : Math.max(1, Math.round(imageH * scale));
        printTraceElement(
          cell.slice,
          index,
          Math.round(imageX * scale),
          Math.round(imageY * scale),
          drawW,
          drawH,
          ink.width,
          ink.height,
        );
        right -= (cell.dw || imageW) + 14;
      });
    } else {
      const sx = item.baked ? 0 : item.slice.box.x * item.bitmap.width;
      const sy = item.baked ? 0 : item.slice.box.y * item.bitmap.height;
      const sw = item.baked ? item.bitmap.width : item.sw;
      const sh = item.baked ? item.bitmap.height : item.sh;
      const destW = item.dw || OUT_W;
      const destX = item.dx || 0;
      ctx.drawImage(item.bitmap, sx, sy, sw, sh, destX, y, destW, item.dh);
      printTraceElement(item.slice, index, destX * scale, y * scale, destW * scale, item.dh * scale, sw, sh);
      if (!item.slice.box.segment) fillSliceMasks(ctx, item.slice.box, y, item.dh, destW);
      coverWholeFigures(ctx, item, destX, y, destW, item.dh);
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

async function paintWorksheet(root, chosen, note) {
  if (document.fonts && document.fonts.load) {
    try {
      await document.fonts.load('700 28px Heebo');
      await document.fonts.load('18px Heebo');
      await document.fonts.load('16px Heebo');
    } catch (error) {}
  }
  const exercises = exerciseSlices(chosen);
  const answers = await answerSlices(chosen);
  const noteBox = measureNote(note);
  const measured = await measureWorksheet(exercises.concat(answers.slices));
  const pages = packWorksheet(measured, noteBox ? noteBox.height : 0);
  const title = sheetTitle(chosen);
  root.dataset.missingAnswers = answers.missing.join(' | ');
  root.innerHTML = pages.map(() => '<figure class="crop-sheet"><canvas></canvas></figure>').join('');
  const canvases = root.querySelectorAll('canvas');
  printTraceReset();
  pages.forEach((page, index) => paintWorksheetPage(canvases[index], page, index, pages.length, title, noteBox));
}

async function paintAllShort(root, chosen, note) {
  if (chosen.length && chosen.every((question) => question.source && question.source.mode === 'sheet')) {
    await paintGroupedShort(root, chosen);
    await attachTeacherNote(root, note);
    return;
  }
  await paintWorksheet(root, chosen.filter((question) => !question.source || question.source.mode !== 'sheet'), note);
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
    const level = printedLevelLabel(source);
    if (level) levels.add(level);
  });
  const scenarioName = state.scenario === 'other' ? 'אחר' : cfg.label;
  return `<div class="plan-meta"><span>${escapeHTML([...grades].filter(Boolean).join(' · '))}</span><span>${escapeHTML([...topics].filter(Boolean).join(' · '))}</span><span>${escapeHTML([...levels].join(' · '))}</span><span>${escapeHTML(scenarioName)}</span></div>`;
}

async function updateShortPrint(plan, printArea, chosen, note, cfg) {
  const head = `<p class="plan-notice">דף מצומצם אחד. הסעיפים לפי רמה ומספר, והתשובות הסופיות בסוף.</p>${metaHTML(chosen, cfg)}`;
  const foot = `<p class="print-source">מקור: ${escapeHTML(chosen.map((question) => question.source && question.source.title).filter((title, index, all) => title && all.indexOf(title) === index).join(' · '))}</p><p class="plan-notes">${escapeHTML(STYLES[state.style].plan)}</p>${note ? `<div class="plan-notes"><strong>הערת המורה</strong><br>${escapeHTML(note)}</div>` : ''}`;
  plan.innerHTML = head + '<div class="crop-preview"></div>' + foot;
  printArea.innerHTML = '';
  await paintAllShort(plan.querySelector('.crop-preview'), chosen, note);
  await paintAllShort(printArea, chosen, note);
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
    if (!input || !SCENARIOS[goal]) return;
    input.checked = true;
    state.scenario = goal;
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

function aiConfirmLanding(model) {
  const next = wizardReduce(model, { type: 'jump', step: 'pick' });
  return {
    route: 'guided',
    step: next.step,
    how: 'push',
    grade: next.grade,
    topic: next.topic,
    level: next.level,
    selected: next.selected.slice(),
    output: next.output,
  };
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

const GOAL_LABELS = { 'מפגש ראשון': 'first', 'תרגול וביסוס': 'practice', 'אחר': 'other' };
const EDIT_SLOTS = { 'המספר': 'count', 'הרמה': 'level', 'הכיתה': 'strength', 'הזמן': 'duration', 'הדירוג': 'progressive', 'סוג הדף': 'output' };
let teacherChat = { text: '', hold: {}, phase: 'ask', pick: null, brief: null };

function formBrief() {
  const level = state.level === 'a' || state.level === 'b' || state.level === 'c' ? [state.level] : [];
  return { grade: Number(state.grade) || null, topicId: String(state.topic || ''), levels: level };
}

function chatBrief() {
  const brief = readTeacherBrief(teacherChat.text, formBrief());
  if (teacherChat.hold.count) {
    brief.minParts = null;
    brief.minQuestions = null;
  }
  if (teacherChat.hold.level) brief.levels = [];
  if (teacherChat.hold.strength) brief.strength = null;
  if (teacherChat.hold.duration) brief.duration = null;
  if (teacherChat.hold.progressive) brief.progressive = null;
  if (teacherChat.hold.output) brief.output = null;
  return brief;
}

function chatIndex() {
  const topic = currentTopic();
  if (!topic) return [];
  const grade = gradeRecord(state.grade);
  return topic.sheets.map((meta) => {
    const source = sheets.get(meta.pdfId);
    return {
      pdfId: meta.pdfId,
      grade: Number(state.grade),
      gradeLabel: grade ? grade.label : '',
      band: band(),
      topicId: String(state.topic),
      topic: topic.title,
      level: meta.level,
      levelLabel: meta.levelLabel || (source && source.levelLabel) || '',
      questions: source && source.questions ? source.questions.map((question) => question.id) : [],
    };
  });
}

function showChat(result) {
  const panel = window.NoamSiteCompanion;
  if (panel && typeof panel.show === 'function') panel.show(result);
}

function releaseHold(message) {
  const piece = readTeacherBrief(message, blankBrief());
  if (piece.minParts != null || piece.minQuestions != null) delete teacherChat.hold.count;
  if (piece.levels.length) delete teacherChat.hold.level;
  if (piece.strength) delete teacherChat.hold.strength;
  if (piece.duration) delete teacherChat.hold.duration;
  if (piece.progressive != null) delete teacherChat.hold.progressive;
  if (piece.output) delete teacherChat.hold.output;
}

function confirmLevel(brief, pick) {
  const named = brief && Array.isArray(brief.levels) ? brief.levels.filter((level) => level === 'a' || level === 'b' || level === 'c') : [];
  if (named.length === 1) return named[0];
  if (named.length > 1) return 'all';
  const found = [];
  ((pick && pick.sheets) || []).forEach((sheet) => {
    const level = sheet && sheet.level;
    if ((level === 'a' || level === 'b' || level === 'c') && found.indexOf(level) === -1) found.push(level);
  });
  return found.length === 1 ? found[0] : 'all';
}

function confirmTeacherPick() {
  const pick = teacherChat.pick;
  const brief = teacherChat.brief || chatBrief();
  if (!pick) return;
  if (brief.output === 'short' || brief.output === 'marked') {
    printMode = brief.output;
    document.querySelectorAll('[data-output]').forEach((btn) => {
      const on = btn.dataset.output === printMode;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  state.level = confirmLevel(brief, pick);
  document.querySelectorAll('[name=level]').forEach((el) => { el.checked = el.value === state.level; });
  const applied = applySuggestIds((pick.exerciseIds || []).concat(pick.sheetIds || []));
  teacherChat.phase = 'ask';
  showChat({
    answer: applied
      ? 'סומן על הדף. אפשר לשנות את הסימון לפני ההדפסה.'
      : 'השאלות האלה לא נטענו בדף הזה. בחרו את הנושא במסך ונמשיך.',
    details: '',
    chips: [],
  });
  if (applied) openRoute('guided', 'push', aiConfirmLanding(currentWizardModel()).step);
}

function teacherChatTurn(message) {
  const text = String(message || '').trim();
  if (!text) return;
  if (GOAL_LABELS[text]) {
    state.scenario = GOAL_LABELS[text];
    const input = document.querySelector('input[name="scenario"][value="' + GOAL_LABELS[text] + '"]');
    if (input) input.checked = true;
  }
  if (teacherChat.phase === 'confirm' && text === 'לאשר') {
    confirmTeacherPick();
    return;
  }
  if (teacherChat.phase === 'confirm' && text === 'לשנות') {
    teacherChat.phase = 'edit';
    showChat({ answer: 'מה לשנות?', details: '', chips: editChips() });
    return;
  }
  if (teacherChat.phase === 'edit' && EDIT_SLOTS[text]) {
    teacherChat.hold[EDIT_SLOTS[text]] = true;
    teacherChat.phase = 'ask';
    teacherChat.pick = null;
    const again = nextTeacherQuestion(chatBrief());
    showChat({ answer: again ? again.prompt : 'מה לשנות?', details: '', chips: again ? again.chips : editChips() });
    return;
  }
  releaseHold(text);
  teacherChat.text = (teacherChat.text + ' ' + text).trim();
  teacherChat.phase = 'ask';
  const brief = chatBrief();
  teacherChat.brief = brief;
  const question = nextTeacherQuestion(brief);
  if (question) {
    const lead = GOAL_LABELS[text] ? text + '. ' : '';
    showChat({ answer: lead + question.prompt, details: '', chips: question.chips });
    return;
  }
  const pick = selectByBrief(chatIndex(), brief);
  if (!pick.sheets.length) {
    showChat({
      answer: 'ברמה הזו אין שאלות בקטלוג. איזו רמה כן?',
      details: '',
      chips: [{ label: 'רמה א׳', reply: true }, { label: 'רמה ב׳', reply: true }],
    });
    return;
  }
  teacherChat.phase = 'confirm';
  teacherChat.pick = pick;
  showChat({ answer: describeSelection(brief, pick), details: '', chips: confirmChips() });
}

window.NoamTeacherChat = { turn: teacherChatTurn };

function askTeacherNeed(message) {
  const status = $('teacher-need-status');
  if (status) status.textContent = '';
  const field = $('teacher-need-text');
  if (field) field.value = '';
  teacherChatTurn(message);
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
