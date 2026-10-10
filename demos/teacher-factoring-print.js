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

function exerciseCard(question) {
  const key = exKey(question.source.pdfId, question.id);
  const level = question.source.levelLabel ? `<span class="q-page" style="display:block">${escapeHTML(question.source.levelLabel)} · עמוד ${question.page}</span>` : `<span class="q-page" style="display:block">עמוד ${question.page} בדף המקור</span>`;
  const badge = pilotOn() ? `<span class="badge ${tier(question)}">${TIERS[tier(question)]}</span>` : '';
  const body = labelOnly(question)
    ? `<canvas class="q-thumb" data-thumb="${escapeHTML(key)}" width="320" height="72" aria-hidden="true"></canvas>`
    : `<span class="q-desc" style="display:block">${questionTextHTML(question.text)}</span>`;
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
async function paintThumbs() {
  const token = ++thumbToken;
  const canvases = [...document.querySelectorAll('.q-thumb')];
  for (const canvas of canvases) {
    if (token !== thumbToken) return;
    const question = library.get(canvas.dataset.thumb);
    const row = question && question.row;
    if (!row) continue;
    try {
      const bitmap = await pageBitmap(row.page || question.page, question.source);
      if (token !== thumbToken) return;
      const sw = Math.max(1, row.w * bitmap.width);
      const sh = Math.max(1, row.h * bitmap.height);
      const dw = 320;
      const dh = Math.max(36, Math.min(96, Math.round(dw * sh / sw)));
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, dw, dh);
      ctx.drawImage(bitmap, row.x * bitmap.width, row.y * bitmap.height, sw, sh, 0, 0, dw, dh);
    } catch (error) {}
  }
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
      const prev = slices[slices.length - 1];
      const dup = prev && prev.kind === 'row' && prev.page === page && prev.box.x === box.x && prev.box.y === box.y && prev.box.w === box.w && prev.box.h === box.h;
      if (!dup) slices.push({ page, box, gap: 4, block, kind: 'row' });
    });
  });
  slices.push({ page: SOURCE.footerCrop.page, box: SOURCE.footerCrop, gap: 16, block: 'footer', kind: 'footer' });
  return slices;
}

function contentHeight(items) {
  return items.reduce((sum, item, index) => sum + (index ? item.slice.gap : 0) + item.dh, 0);
}

function shrinkTo(items, limit) {
  const height = contentHeight(items);
  if (height <= limit) return items;
  const factor = limit / height;
  const scaled = items.map((item) => ({
    ...item,
    dh: Math.max(1, Math.round(item.dh * factor)),
    slice: { ...item.slice, gap: Math.max(1, Math.round(item.slice.gap * factor)) },
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
  $('teacher-note').addEventListener('input', () => clearPreparedPrint());
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
