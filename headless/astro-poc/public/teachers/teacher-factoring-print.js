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

function installSuggest() {
  window.NoamTeacherSuggest = {
    enabled: false,
    classifier: 'qwen-flash',
    async classifyRequest() {
      return { enabled: false, intent: null };
    },
    async suggest() {
      return { enabled: false, exerciseIds: [], sheetIds: [] };
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

/** Drops hidden picks of this topic. Exercises picked in other topics stay. */
function keepVisible(selected, visible, scope) {
  const allow = new Set(visible);
  const here = scope ? new Set(scope) : null;
  return selected.filter((key) => allow.has(key) || (here && key.startsWith('ex:') && !here.has(key.split(':')[1])));
}

function topicKeys() {
  const topic = currentTopic();
  return topic ? topic.sheets.map((sheet) => sheet.pdfId) : [];
}

/** Exercises picked so far, kept when the teacher moves to another topic or grade of the same band. */
function carriedPicks(previousBand) {
  if (previousBand !== band()) return [];
  return state.selected.filter((key) => key.startsWith('ex:') && library.has(key));
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
  const elsewhere = !topicKeys().includes(question.source.pdfId)
    ? [question.source.gradeLabel, question.source.topic].filter(Boolean).join(' · ') + ' · '
    : '';
  const level = question.source.levelLabel ? `<span class="q-page" style="display:block">${escapeHTML(elsewhere + question.source.levelLabel)} · עמוד ${question.page}</span>` : `<span class="q-page" style="display:block">${escapeHTML(elsewhere)}עמוד ${question.page} בדף המקור</span>`;
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
  // Middle school: the continuous worksheet is the main print; the marked source page is the second choice.
  const shortBtn = $('prepare-short');
  if (shortBtn) {
    shortBtn.hidden = elementary;
    shortBtn.className = elementary ? 'text-btn' : 'primary';
    $('prepare').className = elementary ? 'primary' : 'text-btn';
  }
  const prepareHint = $('prepare-hint');
  if (prepareHint) prepareHint.textContent = elementary ? 'הדף המלא מהמקור, בלי סימון.' : 'דף עבודה אחד ברצף, חתוך מהמקור, עם דף תשובות בסוף. אפשר לבחור סעיפים מכמה נושאים וכיתות.';
  if (!ok) {
    paintSourceLine();
    return;
  }
  if (elementary) {
    const pool = state.filter === 'selected'
      ? state.selected.filter((key) => key.startsWith('sheet:')).map((key) => byPdf.get(key.slice(6))).filter(Boolean)
      : topicSheets();
    $('available-count').textContent = topicSheets().length + ' דפים';
    $('questions').innerHTML = pool.length
      ? pool.map(sheetCard).join('')
      : '<p class="empty">אין דף ברמה הזו. אפשר לחזור ל״הכל״.</p>';
    $('show-more').hidden = true;
    $('suggestion').hidden = true;
  } else {
    const ordered = state.filter === 'selected'
      ? state.selected.map((key) => library.get(key)).filter(Boolean)
      : orderedQuestions();
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
  $('clear-selection').disabled = state.selected.length === 0;
  paintSourceLine();
  if (!elementary) paintThumbs();
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
    const figure = stage.closest('.source-sheet');
    if (figure && !figure.querySelector('.flow-basad') && !(await hasBasad(page))) {
      figure.insertAdjacentHTML('afterbegin', '<div class="flow-basad" dir="rtl">בס״ד</div>');
    }
  }
}

/** True when the top of a source page already prints בס״ד. */
async function hasBasad(page) {
  try {
    const text = await page.getTextContent();
    const height = page.getViewport({ scale: 1 }).height;
    return text.items.some((item) => /בס["״”]?ד|ד["״”]?סב/.test(item.str || '') && item.transform && item.transform[5] > height * 0.9);
  } catch (error) {
    return false;
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

/* ------------------------------------------------------------------
   One continuous worksheet.
   Every picked exercise is cut from its original PDF page and laid on
   A4 pages one after another, across sheets and grades. An exercise is
   one block: its stem, its question number, its picked parts and its
   drawing. A block is never split across pages; it moves whole to the
   next page. The answer key follows on its own pages, cut from each
   sheet's "תשובות סופיות" section, with the same flow rules.
   Boxes beyond sheets/*.json (title, drawings, writing rules, question
   numbers, answer lines) come from print-layout/<pdfId>.json, measured
   on the source PDFs by scripts/measure-print-layout.py.
   ------------------------------------------------------------------ */
const FLOW = {
  OUT_W: 1000, // canvas px across the 180mm print column
  X0: 0.05, // source window: right of the margin copyright line
  X1: 0.96, // and wide enough for the question number column
  PAGE_H: 1500, // canvas px under the בס״ד line on one A4 page (270mm)
  GAP: 24, // between blocks
  PIECE_GAP: 6, // between pieces of one block
  PULL_BELOW: 0.65, // pull a later exercise up only while the page stays this empty
  LOOKAHEAD: 3, // how far ahead an exercise may come from
  MIN_FIGURE_H: 0.03, // smaller boxes are inline marks, not drawings
};
const PX_PER_MM = FLOW.OUT_W / 180;
const layouts = new Map();

function rowsOf(question) {
  const rows = question.rows && question.rows.length ? question.rows : (question.row ? [question.row] : []);
  return rows.map((row) => ({ ...row, page: row.page || question.page }));
}

function rowOn(question, page) {
  return rowsOf(question).find((row) => row.page === page) || null;
}

function partsOf(source, q) {
  return source.questions.filter((item) => item.q === q);
}

function stemOf(parts) {
  const owner = parts.find((item) => item.stem);
  return owner ? { ...owner.stem, page: owner.stem.page || owner.page } : null;
}

/** Where question q starts on a page: its stem, or its first labelled part. */
function questionTop(source, q, page) {
  const parts = partsOf(source, q);
  let top = null;
  const stem = stemOf(parts);
  if (stem && stem.page === page) top = stem.y;
  parts.forEach((item) => {
    const row = rowOn(item, page);
    if (row && item.page === page) top = top == null ? row.y : Math.min(top, row.y);
  });
  return top;
}

function nextQuestionTop(source, q, page) {
  let next = null;
  const seen = new Set();
  source.questions.forEach((item) => {
    if (item.q === q || seen.has(item.q)) return;
    seen.add(item.q);
    if (source.questions.indexOf(item) < source.questions.findIndex((other) => other.q === q)) return;
    const top = questionTop(source, item.q, page);
    if (top != null && (next == null || top < next)) next = top;
  });
  return next;
}

/**
 * Each part's own lines on a page: from its label line to the next part's
 * label line, or to the next question. A first part without a stem keeps the
 * question text above its label as a stem of its own.
 */
function partRanges(source, q, page) {
  const parts = partsOf(source, q);
  const nextTop = nextQuestionTop(source, q, page);
  const stem = stemOf(parts);
  const ranges = new Map();
  let ownStem = null;
  const labelled = parts.filter((item) => item.page === page && rowOn(item, page));
  parts.forEach((item, index) => {
    const row = rowOn(item, page);
    if (!row) return;
    const line = item.line > 0 ? item.line : 0.024;
    let top = row.y;
    let end;
    if (item.page === page) {
      if (index === 0 && !(stem && stem.page === page) && item.box) {
        const labelTop = item.box.y + item.box.h / 2 - line * 0.6;
        if (labelTop > row.y + line * 0.5) {
          ownStem = [row.y, labelTop];
          top = labelTop;
        }
      }
      const later = labelled.filter((other) => parts.indexOf(other) > index && rowOn(other, page).y > row.y + 0.004);
      end = later.length ? rowOn(later[0], page).y : row.y + row.h;
      if (!later.length && nextTop != null && nextTop > top + line * 0.5) end = Math.min(end, nextTop);
    } else {
      end = row.y + row.h;
      if (nextTop != null && nextTop > top + 0.01) end = Math.min(end, nextTop);
    }
    ranges.set(item.id, [top, Math.max(end, top + 0.004)]);
  });
  return { ranges, ownStem };
}

function questionSpan(source, q, page) {
  const top = questionTop(source, q, page);
  let end = null;
  partsOf(source, q).forEach((item) => {
    const row = rowOn(item, page);
    if (row) end = end == null ? row.y + row.h : Math.max(end, row.y + row.h);
  });
  const next = nextQuestionTop(source, q, page);
  if (end != null && next != null && next > (top == null ? 0 : top)) end = Math.min(end, next);
  if (top == null && end == null) return null;
  return [top == null ? 0 : top, end == null ? top : end];
}

/** Drawings on a page with the question that owns each one (most vertical overlap). */
function pageFigures(source, layout, page) {
  const list = (layout.figures || [])
    .filter((figure) => figure.page === page && figure.y1 - figure.y0 >= FLOW.MIN_FIGURE_H)
    .map((figure) => ({ ...figure }));
  source.questions.forEach((item) => {
    if (item.figure && item.page === page) list.push({ page, ...item.figure, q: item.q });
  });
  const spans = new Map();
  source.questions.forEach((item) => {
    if (!spans.has(item.q)) spans.set(item.q, questionSpan(source, item.q, page));
  });
  list.forEach((figure) => {
    if (figure.q != null) return;
    let best = null;
    spans.forEach((span, q) => {
      if (!span) return;
      const overlap = Math.min(span[1], figure.y1) - Math.max(span[0], figure.y0);
      if (overlap > 0 && (!best || overlap > best.overlap)) best = { q, overlap };
    });
    figure.q = best ? best.q : null;
  });
  return list;
}

function overlaps(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0) > 0.0005;
}

/**
 * Keeps a band inside the page's running header and footer, below the sheet
 * header on page 1, and off a section bar
 * ("חלק ב׳ – …"): a bar low in the band ends it, a bar high in the band starts it.
 */
function clampBand(layout, page, band) {
  let [top, end] = band;
  const margin = layout.margins && layout.margins[String(page)];
  if (margin) {
    top = Math.max(top, margin[0]);
    // The footer's separator rule sits just above its text.
    end = Math.min(end, margin[1] < 0.99 ? margin[1] - 0.012 : margin[1]);
  }
  const header = layout.headerEnd;
  if (header && header.page === page && top < header.y) {
    if (end <= header.y + 0.004) return null;
    top = header.y;
  }
  (layout.sections || []).forEach((bar) => {
    if (bar.page !== page || !overlaps(top, end, bar.y0, bar.y1)) return;
    if (bar.y0 > top + 0.01) end = Math.min(end, bar.y0);
    else top = Math.max(top, bar.y1);
  });
  return end - top > 0.003 ? [top, end] : null;
}

/** Visible x ranges inside the window → white masks over everything else. */
function maskOutside(visible, y0, y1) {
  const spans = visible
    .map(([x0, x1]) => [Math.max(FLOW.X0, x0), Math.min(FLOW.X1, x1)])
    .filter(([x0, x1]) => x1 > x0)
    .sort((a, b) => a[0] - b[0]);
  const masks = [];
  let cursor = FLOW.X0;
  spans.forEach(([x0, x1]) => {
    if (x0 > cursor) masks.push({ x0: cursor, y0, x1: x0, y1 });
    cursor = Math.max(cursor, x1);
  });
  if (cursor < FLOW.X1) masks.push({ x0: cursor, y0, x1: FLOW.X1, y1 });
  return masks;
}

function absoluteMask(box) {
  if (!box || !box.mask || !(box.h > 0)) return null;
  return {
    x0: box.x + box.mask.x * box.w,
    x1: box.x + (box.mask.x + box.mask.w) * box.w,
    y0: box.y + box.mask.y * box.h,
    y1: box.y + (box.mask.y + box.mask.h) * box.h,
  };
}

/**
 * Pieces of one exercise on its source pages. Kept full width: the stem and
 * the picked parts. Kept beside them: the question number, and the whole
 * drawing the question owns. Everything else inside a kept band (unpicked
 * parts, the next question's text beside a tall drawing) is masked white,
 * and writing rules under hidden text are lifted out of the drawing column.
 */
function questionPieces(source, layout, q, picked) {
  const parts = partsOf(source, q);
  const stem = stemOf(parts);
  const pages = new Set();
  parts.forEach((item) => {
    if (picked.has(item.id)) rowsOf(item).forEach((row) => pages.add(row.page));
  });
  if (stem) pages.add(stem.page);
  const pieces = [];
  [...pages].sort((a, b) => a - b).forEach((page) => {
    const { ranges, ownStem } = partRanges(source, q, page);
    const full = [];
    if (stem && stem.page === page) full.push([stem.y, stem.y + stem.h]);
    let pickedHere = false;
    parts.forEach((item) => {
      if (!picked.has(item.id) || !ranges.has(item.id)) return;
      full.push(ranges.get(item.id));
      pickedHere = true;
    });
    if (!pickedHere && !(stem && stem.page === page && page === Math.min(...pages))) return;
    if (ownStem && pickedHere) full.push(ownStem);
    const bands = full.map((band) => clampBand(layout, page, band)).filter(Boolean);
    full.length = 0;
    full.push(...bands);
    if (!full.length) return;
    const marker = layout.markers && layout.markers[String(q)];
    const markerBand = marker && marker.page === page
      && !full.some(([y0, y1]) => (marker.y0 + marker.y1) / 2 > y0 && (marker.y0 + marker.y1) / 2 < y1)
      ? [marker.y0, marker.y1] : null;
    const figures = pageFigures(source, layout, page);
    const owned = figures.filter((figure) => figure.q === q);
    const touching = owned.filter((figure) => full.some(([y0, y1]) => overlaps(y0, y1, figure.y0, figure.y1)));
    const drawings = touching.length ? touching : owned;
    const bounds = new Set();
    full.forEach(([y0, y1]) => { bounds.add(y0); bounds.add(y1); });
    if (markerBand) { bounds.add(markerBand[0]); bounds.add(markerBand[1]); }
    drawings.forEach((figure) => { bounds.add(figure.y0); bounds.add(figure.y1); });
    const ys = [...bounds].map((y) => Math.max(0, Math.min(1, y))).sort((a, b) => a - b);
    const segments = [];
    for (let index = 0; index + 1 < ys.length; index += 1) {
      const y0 = ys[index];
      const y1 = ys[index + 1];
      if (y1 - y0 < 0.0002) continue;
      const mid = (y0 + y1) / 2;
      const isFull = full.some(([a, b]) => mid > a && mid < b);
      const inMarker = markerBand && mid > markerBand[0] && mid < markerBand[1];
      const figs = drawings.filter((figure) => mid > figure.y0 && mid < figure.y1);
      if (!isFull && !inMarker && !figs.length) continue;
      const visible = figs.map((figure) => [figure.x0, figure.x1]);
      if (inMarker) visible.push([marker.x0, FLOW.X1]);
      segments.push({ y0, y1, masks: isFull ? [] : maskOutside(visible, y0, y1), hidden: !isFull, full: isFull });
    }
    // Where hidden text meets kept text, the mask edge moves to the nearest white row.
    segments.forEach((segment, index) => {
      if (segment.full) return;
      const before = segments[index - 1];
      const after = segments[index + 1];
      const snapTop = before && before.full && segment.y0 - before.y1 < 0.002;
      const snapBottom = after && after.full && after.y0 - segment.y1 < 0.002;
      segment.masks.forEach((mask) => {
        if (snapTop) mask.snapTop = true;
        if (snapBottom) mask.snapBottom = true;
      });
    });
    // Contiguous segments make one piece.
    const groups = [];
    segments.forEach((segment) => {
      const last = groups[groups.length - 1];
      if (last && segment.y0 - last.y1 < 0.002) {
        last.y1 = segment.y1;
        last.masks.push(...segment.masks);
        if (segment.hidden) last.hidden.push([segment.y0, segment.y1]);
      } else {
        groups.push({ page, y0: segment.y0, y1: segment.y1, masks: segment.masks.slice(), hidden: segment.hidden ? [[segment.y0, segment.y1]] : [] });
      }
    });
    const ownMasks = [];
    if (stem && stem.page === page) ownMasks.push(absoluteMask(stem));
    parts.forEach((item) => {
      if (!picked.has(item.id)) return;
      const row = rowOn(item, page);
      if (row) ownMasks.push(absoluteMask(row));
    });
    const foreign = figures.filter((figure) => figure.q !== q && figure.q != null);
    groups.forEach((piece) => {
      ownMasks.filter(Boolean).forEach((mask) => {
        if (overlaps(piece.y0, piece.y1, mask.y0, mask.y1)) piece.masks.push({ ...mask, y0: Math.max(mask.y0, piece.y0), y1: Math.min(mask.y1, piece.y1) });
      });
      foreign.forEach((figure) => {
        if (overlaps(piece.y0, piece.y1, figure.y0, figure.y1)) {
          piece.masks.push({ x0: figure.x0, x1: figure.x1, y0: Math.max(figure.y0, piece.y0), y1: Math.min(figure.y1, piece.y1) });
        }
      });
      piece.erase = (layout.rules || [])
        .filter((rule) => rule.page === page && piece.hidden.some(([a, b]) => rule.y > a && rule.y < b))
        .map((rule) => ({ x0: rule.x0, x1: rule.x1, y: rule.y }));
      piece.source = source;
      pieces.push(piece);
    });
  });
  return pieces;
}

/** Answer lines of one question, with unpicked parts and their separators masked. */
function answerPieces(source, layout, q, picked) {
  const answers = layout.answers;
  const record = answers && answers.questions && answers.questions[String(q)];
  if (!record || !record.lines || !record.lines.length) return null;
  const letters = partsOf(source, q).map((item) => item.part).filter(Boolean);
  const chosen = new Set(partsOf(source, q).filter((item) => picked.has(item.id)).map((item) => item.part));
  const split = record.parts && letters.length && !letters.every((letter) => chosen.has(letter));
  const onLine = (box, line) => box.page === line.page && Math.abs(box.y - line.y) < 0.002;
  // On a split line only the number, the picked parts and the "·" between two picked parts stay.
  const lineMasks = record.lines.map((line, index) => {
    if (!split) return [];
    const keep = [];
    if (index === 0 && record.num) keep.push([record.num.x0, FLOW.X1]);
    Object.entries(record.parts).forEach(([letter, boxes]) => {
      if (!chosen.has(letter)) return;
      boxes.forEach((box) => { if (onLine(box, line)) keep.push([box.x, box.x + box.w]); });
    });
    Object.entries(record.seps || {}).forEach(([letter, box]) => {
      const previous = letters[letters.indexOf(letter) - 1];
      if (chosen.has(letter) && previous && chosen.has(previous) && onLine(box, line)) keep.push([box.x, box.x + box.w]);
    });
    return maskOutside(keep, line.y, line.y + line.h);
  });
  const visible = record.lines.map((line, index) => {
    if (!split || index === 0) return true;
    return Object.entries(record.parts).some(([letter, boxes]) => chosen.has(letter) && boxes.some((box) => onLine(box, line)));
  });
  const pieces = [];
  record.lines.forEach((line, index) => {
    if (!visible[index]) return;
    const last = pieces[pieces.length - 1];
    if (last && last.page === line.page && last.lastIndex === index - 1) {
      last.y1 = line.y + line.h;
      last.lastIndex = index;
      last.masks.push(...lineMasks[index]);
    } else {
      pieces.push({ page: line.page, y0: line.y, y1: line.y + line.h, lastIndex: index, masks: lineMasks[index].slice(), erase: [], source });
    }
  });
  return pieces;
}

function boxPiece(source, box) {
  if (!box) return null;
  return { page: box.page || 1, y0: box.y, y1: box.y + box.h, x0: box.x, x1: box.x + box.w, masks: [], erase: [], source };
}

async function measurePieces(pieces) {
  let height = 0;
  for (const piece of pieces) {
    piece.bitmap = await pageBitmap(piece.page, piece.source);
    const width = (FLOW.X1 - FLOW.X0) * piece.bitmap.width;
    piece.dh = Math.max(1, Math.round((piece.y1 - piece.y0) * piece.bitmap.height * FLOW.OUT_W / width));
  }
  pieces.forEach((piece, index) => { height += (index ? FLOW.PIECE_GAP : 0) + piece.dh; });
  return height;
}

async function loadLayout(pdfId) {
  if (layouts.has(pdfId)) return layouts.get(pdfId);
  let layout = { title: null, markers: {}, figures: [], rules: [], answers: null };
  try {
    const response = await fetch(new URL('./print-layout/' + pdfId + '.json', import.meta.url));
    if (response.ok) layout = { ...layout, ...(await response.json()) };
  } catch (error) {}
  layouts.set(pdfId, layout);
  return layout;
}

function sortedGroups(chosen) {
  const groups = [];
  chosen.forEach((question) => {
    const source = question.source;
    if (!source) return;
    let group = groups.find((item) => item.source.pdfId === source.pdfId);
    if (!group) {
      group = { source, questions: [] };
      groups.push(group);
    }
    if (!group.questions.includes(question)) group.questions.push(question);
  });
  groups.forEach((group) => {
    group.questions.sort((a, b) => group.source.questions.indexOf(a) - group.source.questions.indexOf(b));
  });
  return groups;
}

/** Blocks for both parts of the worksheet, in print order. */
async function flowBlocks(chosen) {
  const groups = sortedGroups(chosen);
  const questions = [];
  const answers = [];
  const missing = [];
  let head = null;
  for (const group of groups) {
    const source = group.source;
    const layout = await loadLayout(source.pdfId);
    const picked = new Set(group.questions.map((question) => question.id));
    const numbers = [...new Set(group.questions.map((question) => question.q))];
    const title = boxPiece(source, layout.title);
    if (title) questions.push({ kind: 'title', group: source.pdfId, pieces: [title], keepWithNext: true, key: source.pdfId + ':title' });
    numbers.forEach((q) => {
      const pieces = questionPieces(source, layout, q, picked);
      if (pieces.length) {
        questions.push({ kind: 'question', group: source.pdfId, q, pieces, key: source.pdfId + ':' + q, label: (source.levelLabel || '') + ' ' + q });
      }
    });
    const keyPieces = numbers.map((q) => ({ q, pieces: answerPieces(source, layout, q, picked) }));
    keyPieces.filter((item) => !item.pieces).forEach((item) => missing.push(source.pdfId + ':' + item.q));
    const found = keyPieces.filter((item) => item.pieces && item.pieces.length);
    if (!found.length) continue;
    if (!head && layout.answers && layout.answers.head) {
      head = { kind: 'answers-head', group: 'answers', pieces: [boxPiece(source, layout.answers.head)], keepWithNext: true, key: 'answers:head' };
    }
    if (groups.length > 1 && title) {
      answers.push({ kind: 'title', group: source.pdfId, pieces: [boxPiece(source, layout.title)], keepWithNext: true, key: source.pdfId + ':answers-title' });
    }
    found.forEach((item) => answers.push({ kind: 'answer', group: source.pdfId, q: item.q, pieces: item.pieces, key: source.pdfId + ':answer:' + item.q }));
  }
  if (head && answers.length) answers.unshift(head);
  for (const block of questions.concat(answers)) block.height = await measurePieces(block.pieces);
  return { questions, answers, missing };
}

/**
 * Fill pages in order. A block that does not fit moves whole to the next
 * page. While the page would stay below PULL_BELOW, a smaller exercise
 * from the next few blocks of the same sheet may come up into the gap.
 * Titles stay with the block after them. A block taller than a page gets
 * the page to itself, scaled to fit.
 */
function paginate(blocks) {
  const pages = [];
  const queue = blocks.slice();
  // A block taller than a page is scaled once, leaving room for a title glued to it.
  queue.forEach((block, index) => {
    const before = queue[index - 1];
    const room = FLOW.PAGE_H - (before && before.keepWithNext ? before.height + FLOW.GAP : 0);
    if (block.height > room && block.kind !== 'note') {
      block.scale = room / block.height;
      block.height = room;
    }
  });
  let page = { items: [], used: 0 };
  const need = (block) => (page.items.length ? FLOW.GAP : 0) + block.height;
  const nextAfter = (index) => queue[index + 1];
  const fits = (index) => {
    const block = queue[index];
    let total = need(block);
    if (block.keepWithNext && nextAfter(index)) total += FLOW.GAP + Math.min(nextAfter(index).height, FLOW.PAGE_H);
    return page.used + total <= FLOW.PAGE_H;
  };
  const place = (index) => {
    const [block] = queue.splice(index, 1);
    const y = page.items.length ? page.used + FLOW.GAP : 0;
    page.items.push({ block, y });
    page.used = y + block.height;
  };
  const close = (final) => {
    // A title never ends a page: it moves on with the block it belongs to.
    while (!final && page.items.length > 1 && page.items[page.items.length - 1].block.keepWithNext) {
      queue.unshift(page.items.pop().block);
      const last = page.items[page.items.length - 1];
      page.used = last.y + last.block.height;
    }
    if (page.items.length) pages.push(page);
    page = { items: [], used: 0 };
  };
  while (queue.length) {
    const block = queue[0];
    if (fits(0)) {
      place(0);
      continue;
    }
    if (!page.items.length) {
      place(0);
      continue;
    }
    if (page.used / FLOW.PAGE_H < FLOW.PULL_BELOW && block.kind !== 'title' && block.kind !== 'answers-head') {
      let pulled = false;
      for (let index = 1; index <= FLOW.LOOKAHEAD && index < queue.length; index += 1) {
        const later = queue[index];
        if (later.kind === 'title' || later.kind === 'answers-head' || later.group !== block.group) break;
        if (later.height < block.height && fits(index)) {
          later.pulled = true;
          place(index);
          pulled = true;
          break;
        }
      }
      if (pulled) continue;
    }
    close();
  }
  close(true);
  return pages;
}

/**
 * Lifts a writing rule out of a drawing column: inside the rule's strip, a
 * column is cleared only when the pixels just above and below the strip are
 * white, so a drawing stroke that crosses the rule stays whole.
 */
function eraseRule(ctx, x, y, w, h) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(1, Math.floor(y));
  const width = Math.min(ctx.canvas.width - left, Math.ceil(w));
  const height = Math.min(ctx.canvas.height - top - 1, Math.ceil(h));
  if (width <= 0 || height <= 0) return;
  const image = ctx.getImageData(left, top - 1, width, height + 2);
  const data = image.data;
  const lum = (index) => 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
  const crossed = (col) => {
    for (let near = Math.max(0, col - 2); near <= Math.min(width - 1, col + 2); near += 1) {
      if (lum(near * 4) < 200 || lum(((height + 1) * width + near) * 4) < 200) return true;
    }
    return false;
  };
  for (let col = 0; col < width; col += 1) {
    // Beside a crossing stroke only the light rule grey goes; the dark stroke stays.
    const near = crossed(col);
    for (let row = 1; row <= height; row += 1) {
      const index = (row * width + col) * 4;
      if (near && lum(index) < 135) continue;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
    }
  }
  ctx.putImageData(image, left, top - 1);
}

const bitmapPixels = new WeakMap();

function pixelsOf(bitmap) {
  if (!bitmapPixels.has(bitmap)) {
    bitmapPixels.set(bitmap, bitmap.getContext('2d').getImageData(0, 0, bitmap.width, bitmap.height));
  }
  return bitmapPixels.get(bitmap);
}

/** Moves a mask top up over faint glyph tops of hidden text, stopping at the first dark row. */
function liftOverFaint(bitmap, x0, x1, y) {
  const image = pixelsOf(bitmap);
  const from = Math.max(0, Math.floor(x0 * bitmap.width));
  const to = Math.min(bitmap.width, Math.ceil(x1 * bitmap.width));
  let row = Math.round(y * bitmap.height);
  const stop = Math.max(0, row - Math.round(0.007 * bitmap.height));
  let top = row;
  for (row -= 1; row >= stop; row -= 1) {
    let darkest = 255;
    for (let c = from; c < to; c += 1) {
      const index = (row * bitmap.width + c) * 4;
      darkest = Math.min(darkest, image.data[index], image.data[index + 1], image.data[index + 2]);
    }
    if (darkest < 200) break;
    if (darkest < 250) top = row;
  }
  return top / bitmap.height;
}

/** Nearest source row (either direction, within limit) with no ink between x0 and x1. */
function nearestWhiteRow(bitmap, x0, x1, y, limit) {
  const image = pixelsOf(bitmap);
  const from = Math.max(0, Math.floor(x0 * bitmap.width));
  const to = Math.min(bitmap.width, Math.ceil(x1 * bitmap.width));
  const row = Math.round(y * bitmap.height);
  const reach = Math.round(limit * bitmap.height);
  const white = (r) => {
    if (r < 0 || r >= bitmap.height) return false;
    for (let c = from; c < to; c += 1) {
      const index = (r * bitmap.width + c) * 4;
      if (image.data[index] < 245 || image.data[index + 1] < 245 || image.data[index + 2] < 245) return false;
    }
    return true;
  };
  for (let step = 0; step <= reach; step += 1) {
    if (white(row - step)) return (row - step) / bitmap.height;
    if (white(row + step)) return (row + step) / bitmap.height;
  }
  return null;
}

function drawBlock(ctx, block, top) {
  const scale = block.scale || 1;
  const width = FLOW.OUT_W * scale;
  const left = (FLOW.OUT_W - width) / 2;
  let y = top;
  block.pieces.forEach((piece, index) => {
    if (index) y += FLOW.PIECE_GAP * scale;
    const bitmap = piece.bitmap;
    const dh = piece.dh * scale;
    const span = FLOW.X1 - FLOW.X0;
    const px = (x) => left + (x - FLOW.X0) / span * width;
    const py = (yy) => y + (yy - piece.y0) / (piece.y1 - piece.y0) * dh;
    const x0 = piece.x0 == null ? FLOW.X0 : Math.max(FLOW.X0, piece.x0);
    const x1 = piece.x1 == null ? FLOW.X1 : Math.min(FLOW.X1, piece.x1);
    ctx.drawImage(
      bitmap,
      x0 * bitmap.width, piece.y0 * bitmap.height, (x1 - x0) * bitmap.width, (piece.y1 - piece.y0) * bitmap.height,
      px(x0), y, px(x1) - px(x0), dh,
    );
    ctx.fillStyle = '#fff';
    piece.masks.forEach((mask) => {
      const mx0 = Math.max(x0, mask.x0);
      const mx1 = Math.min(x1, mask.x1);
      if (mx1 <= mx0) return;
      let my0 = mask.y0;
      let my1 = mask.y1;
      if (mask.snapTop) my0 = liftOverFaint(bitmap, mx0, mx1, nearestWhiteRow(bitmap, mx0, mx1, my0, 0.008) ?? my0);
      if (mask.snapBottom) my1 = nearestWhiteRow(bitmap, mx0, mx1, my1, 0.008) ?? my1;
      my0 = Math.max(piece.y0, my0);
      my1 = Math.min(piece.y1, my1);
      if (my1 <= my0) return;
      ctx.fillRect(px(mx0), py(my0), px(mx1) - px(mx0), py(my1) - py(my0));
    });
    (piece.erase || []).forEach((rule) => {
      const half = Math.max(2, dh / (piece.y1 - piece.y0) * 0.0014);
      eraseRule(ctx, px(Math.max(x0, rule.x0)), py(rule.y) - half, px(Math.min(x1, rule.x1)) - px(Math.max(x0, rule.x0)), half * 2);
    });
    y += dh;
  });
}

function pageCanvas(page) {
  const canvas = document.createElement('canvas');
  canvas.width = FLOW.OUT_W;
  const drawn = page.items.filter((item) => item.block.kind !== 'note');
  canvas.height = Math.max(1, Math.ceil(Math.max(0, ...drawn.map((item) => item.y + item.block.height))));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  page.items.forEach((item) => {
    if (item.block.kind === 'note') return;
    drawBlock(ctx, item.block, item.y);
  });
  return canvas;
}

function flowPageHTML(page, part, index, total) {
  const note = page.items.find((item) => item.block.kind === 'note');
  const fill = Math.min(1, page.used / FLOW.PAGE_H);
  return `<section class="flow-page" data-part="${part}" data-fill="${fill.toFixed(3)}" aria-label="עמוד ${index + 1} מתוך ${total}"><div class="flow-basad" dir="rtl">בס״ד</div><div class="flow-canvas"></div>${note ? teacherNoteHTML(note.block.text) : ''}</section>`;
}

async function renderFlow(root, chosen, note) {
  const { questions, answers, missing } = await flowBlocks(chosen);
  if (note) {
    const height = (await noteBandMm(note)) * PX_PER_MM;
    questions.push({ kind: 'note', group: 'note', pieces: [], height, text: note, key: 'note' });
  }
  const parts = [
    { name: 'questions', pages: paginate(questions) },
    { name: 'answers', pages: answers.length ? paginate(answers) : [] },
  ];
  const all = parts.flatMap((part) => part.pages.map((page) => ({ part: part.name, page })));
  root.innerHTML = all.map((item, index) => flowPageHTML(item.page, item.part, index, all.length)).join('');
  const slots = root.querySelectorAll('.flow-canvas');
  all.forEach((item, index) => slots[index].appendChild(pageCanvas(item.page)));
  return {
    pages: all.map((item, index) => ({
      page: index + 1,
      part: item.part,
      fill: Number((item.page.used / FLOW.PAGE_H).toFixed(3)),
      blocks: item.page.items.map((entry) => entry.block.key + (entry.block.pulled ? ' (pulled up)' : '') + (entry.block.scale ? ' (scaled)' : '')),
    })),
    missingAnswers: missing,
  };
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

function copyPages(from, to) {
  to.innerHTML = from.innerHTML;
  const sources = from.querySelectorAll('.flow-canvas canvas');
  to.querySelectorAll('.flow-canvas').forEach((slot, index) => {
    slot.innerHTML = '';
    const source = sources[index];
    if (!source) return;
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext('2d').drawImage(source, 0, 0);
    slot.appendChild(copy);
  });
}

async function updateFlowPrint(plan, printArea, chosen, note, cfg) {
  const head = `<p class="plan-notice">דף עבודה אחד: כל הסעיפים שנבחרו ברצף, כל אחד חתוך מדף המקור עם ההוראה והשרטוט שלו. התשובות הסופיות בסוף.</p>${metaHTML(chosen, cfg)}`;
  const sources = chosen.map((question) => question.source && question.source.title).filter((title, index, all) => title && all.indexOf(title) === index);
  const foot = `<p class="print-source">מקור: ${escapeHTML(sources.join(' · '))}</p><p class="plan-notes">${escapeHTML(STYLES[state.style].plan)}</p>`;
  printArea.innerHTML = '';
  const stats = await renderFlow(printArea, chosen, note);
  plan.innerHTML = head + '<div class="flow-preview"></div>' + foot;
  copyPages(printArea, plan.querySelector('.flow-preview'));
  window.__teacherPrintStats = stats;
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
    // Exercises stay picked across topics and grades; whole sheets follow the visible topic.
    if (!allow.has(key) && !(key.startsWith('ex:') && library.has(key))) continue;
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
  if (printMode === 'flow') {
    await updateFlowPrint(plan, printArea, chosen, note, cfg);
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
  if (mode === 'flow' && band() === 'elementary') return;
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
    const ready = mode === 'flow'
      ? $('dialog-plan').querySelector('.flow-page canvas')
      : $('dialog-plan').querySelector('.source-stage canvas');
    if (!ready) {
      announce(mode === 'flow' ? 'לא נוצר דף עבודה. לא הוצגה רשימת קישורים במקום.' : 'לא נוצר סימון. לא הוצגה רשימת קישורים במקום.');
      return;
    }
    $('print-title').textContent = mode === 'flow' ? 'דף עבודה אחד מהמקור' : 'דף המקור עם סימון';
    $('print-lead').textContent = mode === 'flow'
      ? 'הסעיפים שנבחרו ברצף, כל אחד חתוך מדף המקור עם השרטוט שלו. דף התשובות בסוף.'
      : 'העמוד המלא, ומה שנבחר מסומן עליו.';
    $('print').lastChild.textContent = mode === 'flow' ? 'הדפסת דף העבודה' : 'הדפסת הדף המסומן';
    printOpener = mode === 'flow' ? $('prepare-short') : $('prepare');
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
    const next = keepVisible(state.selected, visibleSelectionKeys(), topicKeys());
    if (next.join('\n') !== selectionKey()) {
      snapshot();
      state.selected = next;
      clearPreparedPrint();
    }
    render();
  }));
  $('grade').addEventListener('change', async () => {
    const previousBand = band();
    state.grade = $('grade').value;
    state.level = 'all';
    state.expanded = false;
    const carried = carriedPicks(previousBand);
    state.selected = carried;
    state.topic = '';
    if (!carried.length) history = [];
    fillTopics();
    await loadCurrentTopic();
    if (carried.length) {
      render();
      announce('הבחירה נשמרה. אפשר להוסיף סעיפים מהכיתה הזו.');
    } else {
      clearPreparedPrint();
      applyScenario(state.scenario === 'other' ? 'first' : state.scenario);
    }
  });
  $('topic').addEventListener('change', async () => {
    state.topic = $('topic').value;
    state.expanded = false;
    const carried = carriedPicks(band());
    state.selected = carried;
    if (!carried.length) history = [];
    await loadCurrentTopic();
    if (carried.length || state.scenario === 'other') render();
    else {
      clearPreparedPrint();
      applyScenario(state.scenario, { quiet: true });
    }
  });
  $('clear-selection').addEventListener('click', () => {
    if (!state.selected.length) return;
    snapshot();
    state.selected = [];
    clearPreparedPrint();
    render();
    announce('הבחירה נוקתה.');
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
  $('teacher-note').addEventListener('input', () => clearPreparedPrint());
  $('prepare').addEventListener('click', () => prepare('marked'));
  $('prepare-short').addEventListener('click', () => prepare('flow'));
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

async function start() {
  installSuggest();
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error('CATALOG');
  CATALOG = await response.json();
  indexCatalog();
  fillGrades();
  fillTopics();
  bind();
  await loadCurrentTopic();
  applyScenario(state.scenario, { quiet: true });
}

start().catch(() => {
  $('result-summary').textContent = 'רשימת דפי הקטלוג לא נטענה.';
});
