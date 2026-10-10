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

const TEACHER_SUGGEST_ENDPOINT = 'https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion';

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
        const response = await fetch(TEACHER_SUGGEST_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: String(message || '').slice(0, 700),
            page: { kind: 'teachers', path: location.pathname, title: document.title },
            teacher: { grade: state.grade, topic: state.topic, level: state.level, note: $('teacher-note') ? $('teacher-note').value : '' },
          }),
        });
        if (!response.ok) return { enabled: false, exerciseIds: [], sheetIds: [], answer: '' };
        return normalizeSuggest(await response.json());
      } catch (error) {
        return { enabled: false, exerciseIds: [], sheetIds: [], answer: '' };
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
    ? `<canvas class="q-thumb" data-thumb="${escapeHTML(key)}" aria-label="${escapeHTML(thumbAria(question))}"></canvas>`
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
      : '<p class="empty">אין דף ברמה הזו. אפשר לחזור ל״הכל״.</p>';
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
      : '<p class="empty">עדיין לא נבחרו שאלות. אפשר לעבור ל״כל ההצעות״ ולסמן.</p>';
    const hidden = Math.max(0, ordered.length - visible.length);
    $('show-more').hidden = hidden === 0;
    $('more-count').textContent = hidden ? String(hidden) : '';
    const suggestionId = pilotOn() && state.scenario !== 'other' ? cfg.suggestion : '';
    const suggestion = suggestionId ? library.get(exKey(FACTORING_PDF, suggestionId)) : null;
    const showSuggestion = !!(suggestion && !state.selected.includes(exKey(FACTORING_PDF, suggestionId)));
    $('suggestion').hidden = !showSuggestion;
    $('suggestion-text').textContent = showSuggestion ? `${suggestion.label}: ${cfg.suggestionText}` : '';
  }
  $('selection-count').textContent = state.selected.length + ' נבחרו';
  const pdfs = new Set(state.selected.map((key) => key.split(':')[1]).filter(Boolean));
  $('selection-composition').textContent = pdfs.size ? 'מתוך ' + pdfs.size + (pdfs.size === 1 ? ' דף מקור' : ' דפי מקור') : '';
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
  const row = question.row;
  const line = question.line > 0 ? question.line : Math.min(row.h || 0.03, 0.03);
  const glyph = Math.max(8, line * 0.52 * bitmap.height);
  const right = Math.min(0.98, (row.x || 0) + (row.w || 1));
  const left = Math.max(row.x || 0, Math.min(0.45, right - 0.12));
  const srcX = left * bitmap.width;
  const srcW = Math.max(8, (right - left) * bitmap.width);
  const band = Math.max(line * 1.8, line * 0.7 * 5.2);
  const shown = Math.min(row.h, band);
  const padTop = row.h > band ? line * 0.2 : Math.min(line * 0.08, 0.0015);
  const padBottom = line * 0.2;
  const y0 = Math.max(0, row.y - padTop);
  const y1 = Math.min(1, row.y + shown + padBottom);
  const srcY = y0 * bitmap.height;
  const srcH = Math.max(8, (y1 - y0) * bitmap.height);
  return { glyph, srcX, srcY, srcW, srcH };
}

async function paintThumb(canvas) {
  const question = library.get(canvas.dataset.thumb);
  const row = question && question.row;
  if (!row || !levelAllows(question.source)) return;
  const bitmap = await pageBitmap(row.page || question.page, question.source);
  const slice = thumbSlice(question, bitmap);
  const card = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  const cardW = Math.max(180, Math.min(card || 320, 520));
  let scale = cardW / slice.srcW;
  if (slice.srcH * scale > 120) scale = 120 / slice.srcH;
  const dpr = window.devicePixelRatio || 1;
  const dw = Math.max(1, Math.round(slice.srcW * scale));
  const dh = Math.max(1, Math.round(slice.srcH * scale));
  canvas.width = Math.max(1, Math.round(dw * dpr));
  canvas.height = Math.max(1, Math.round(dh * dpr));
  canvas.style.width = dw + 'px';
  canvas.style.height = dh + 'px';
  canvas.style.maxWidth = '100%';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(bitmap, slice.srcX, slice.srcY, slice.srcW, slice.srcH, 0, 0, dw, dh);
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

async function paintAllShort(root, chosen) {
  const holder = document.createElement('div');
  for (const group of groupsOf(chosen)) {
    SOURCE = group.source;
    const part = document.createElement('div');
    await paintShort(part, shortSlices(group.questions));
    while (part.firstChild) holder.appendChild(part.firstChild);
  }
  root.replaceChildren(...holder.childNodes);
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
  const head = `<p class="plan-notice">דף מצומצם. כל קטע נחתך מדף המקור, עם ההוראה, הנוסח והתרשים המקוריים.</p>${metaHTML(chosen, cfg)}`;
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
      ? 'קטעים שנחתכו מדף המקור, עם ההוראה והנוסח המקוריים.'
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
  initWizard();
}

start().catch(() => {
  $('result-summary').textContent = 'רשימת דפי הקטלוג לא נטענה.';
});

// Wizard navigation. `history` above is the undo stack, so browser history is window.history.
let wizardStepId = 'grade';
let wizardRoute = 'gate';
let wizardDepth = 0;
let wizardBound = false;

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
    next.hidden = wizardRoute !== 'guided';
    next.textContent = onSummary ? (printMode === 'short' ? 'הצגת הדף המצומצם' : 'הצגת הדף המסומן') : 'המשך';
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
  document.querySelectorAll('[data-open-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.openRoute;
      if (route === 'guided' && btn.id === 'route-guided') openRoute('guided', 'push', 'grade');
      else openRoute(route, 'push');
    });
  });
  const search = $('fast-search');
  if (search) search.addEventListener('input', () => {
    state.query = search.value;
    render();
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
      if (status) status.textContent = 'נועם AI לא זמין כרגע. אפשר להמשיך לבחור ולהדפיס.';
      return;
    }
    if (status) status.textContent = 'ההצעה סומנה. אפשר לשנות אותה לפני ההדפסה.';
  } catch (error) {
    if (status) status.textContent = 'נועם AI לא זמין כרגע. אפשר להמשיך לבחור ולהדפיס.';
  } finally {
    if (button) button.disabled = false;
  }
}
