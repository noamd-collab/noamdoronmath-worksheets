/* Grade 9 factoring, level A: pick questions that exist on the published
   worksheet, then print the original page with those questions marked.
   Cropping a short sheet is not part of this case. */
'use strict';

const SOURCE_URL = new URL('./factoring-grade-9-a-source.json', import.meta.url);
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

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

const $ = (id) => document.getElementById(id);

let SOURCE = null;
let pdfDoc = null;
let state = {
  scenario: 'first',
  style: 'scaffold',
  selected: SCENARIOS.first.selected.slice(),
  filter: 'all',
  expanded: false,
  grade: '9',
  topic: 'factoring',
};
let history = [];
let rendering = false;

function available() {
  return state.grade === '9' && state.topic === 'factoring' && SOURCE;
}

function byId(id) {
  return SOURCE.questions.find((question) => question.id === id) || null;
}

function tier(id) {
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  if (state.scenario === 'other') return 'extra';
  if (cfg.essential.includes(id)) return 'essential';
  if (cfg.deepen.includes(id)) return 'deepen';
  return 'extra';
}

function orderedQuestions() {
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  const rank = new Map();
  const preferred = state.scenario === 'other' ? state.selected : cfg.selected;
  preferred.forEach((id, index) => rank.set(id, index));
  return SOURCE.questions.slice().sort((a, b) => {
    const ar = rank.has(a.id) ? rank.get(a.id) : 1000;
    const br = rank.has(b.id) ? rank.get(b.id) : 1000;
    if (ar !== br) return ar - br;
    return SOURCE.questions.indexOf(a) - SOURCE.questions.indexOf(b);
  });
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
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

function render() {
  const ok = available();
  $('available-content').hidden = !ok;
  $('unavailable').hidden = ok;
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  $('result-title').textContent = ok ? (state.scenario === 'other' ? 'מרכיבים את הבחירה שלכם' : cfg.title) : 'בוחרים כיתה ונושא';
  $('result-summary').textContent = ok ? cfg.summary : 'המקרה הזה הוא פירוק לגורמים לכיתה ט׳, רמה א׳.';
  $('rationale').textContent = ok ? cfg.rationale : '';
  $('pedagogy-details').textContent = ok ? cfg.details : '';
  $('style-help').textContent = STYLES[state.style].help;
  $('other-field').hidden = state.scenario !== 'other';
  $('other-banner').hidden = state.scenario !== 'other';
  $('grade').value = state.grade;
  $('topic').value = state.topic;
  document.querySelectorAll('[name=scenario]').forEach((el) => { el.checked = el.value === state.scenario; });
  document.querySelectorAll('[name=style]').forEach((el) => { el.checked = el.value === state.style; });
  if (!ok) return;
  const ordered = orderedQuestions();
  const visiblePool = state.filter === 'selected'
    ? ordered.filter((question) => state.selected.includes(question.id))
    : ordered;
  const limit = state.expanded || state.filter === 'selected' ? visiblePool.length : 8;
  const visible = visiblePool.slice(0, limit);
  $('available-count').textContent = SOURCE.questions.length + ' סעיפים בדף';
  $('questions').innerHTML = visible.length
    ? visible.map((question) => `<label class="q-card"><input type="checkbox" data-question="${escapeHTML(question.id)}" ${state.selected.includes(question.id) ? 'checked' : ''} aria-label="בחירת ${escapeHTML(question.label)}"><span class="q-content"><span class="q-title-line"><span class="q-title">${escapeHTML(question.label)}</span><span class="badge ${tier(question.id)}">${TIERS[tier(question.id)]}</span></span><span class="q-desc" style="display:block">${escapeHTML(question.text)}</span><span class="q-page" style="display:block">עמוד ${question.page} בדף המקור</span></span></label>`).join('')
    : '<p class="empty">עדיין לא נבחרו שאלות. אפשר לעבור ל״כל ההצעות״ ולסמן.</p>';
  const hidden = Math.max(0, visiblePool.length - visible.length);
  $('show-more').hidden = hidden === 0;
  $('more-count').textContent = hidden ? String(hidden) : '';
  const suggestion = byId(cfg.suggestion);
  const showSuggestion = state.scenario !== 'other' && suggestion && !state.selected.includes(suggestion.id);
  $('suggestion').hidden = !showSuggestion;
  $('suggestion-text').textContent = showSuggestion ? `${suggestion.label}: ${cfg.suggestionText}` : '';
  $('selection-count').textContent = state.selected.length + ' נבחרו';
  const pages = new Set(state.selected.map((id) => (byId(id) || {}).page).filter(Boolean));
  $('selection-composition').textContent = pages.size ? 'על ' + pages.size + (pages.size === 1 ? ' עמוד במקור' : ' עמודים במקור') : '';
  $('undo').disabled = history.length === 0;
}

function selectQuestion(id, on) {
  if (!byId(id)) return;
  snapshot();
  if (on && !state.selected.includes(id)) state.selected.push(id);
  if (!on) state.selected = state.selected.filter((item) => item !== id);
  render();
}

async function loadPdf() {
  if (pdfDoc) return pdfDoc;
  if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
    throw new Error('PDF_LIB');
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  pdfDoc = await window.pdfjsLib.getDocument({ url: SOURCE.pdfUrl, withCredentials: false }).promise;
  return pdfDoc;
}

function sheetHTML(pageNumber, questions) {
  const marks = questions.map((question) => {
    const box = question.box;
    return `<span class="source-mark" data-question="${escapeHTML(question.id)}" style="left:${box.x * 100}%;top:${box.y * 100}%;width:${box.w * 100}%;height:${box.h * 100}%" title="${escapeHTML(question.label)}"></span>`;
  }).join('');
  const names = questions.map((question) => question.label).join(' · ');
  return `<figure class="source-sheet"><div class="source-stage" data-page="${pageNumber}"><canvas></canvas>${marks}</div><figcaption>עמוד ${pageNumber} מתוך ${SOURCE.pageCount} · מסומנים: ${escapeHTML(names)}</figcaption></figure>`;
}

async function paintSheets(root) {
  const pdf = await loadPdf();
  const stages = root.querySelectorAll('.source-stage');
  for (const stage of stages) {
    const pageNumber = Number(stage.dataset.page);
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1100 / base.width });
    const canvas = stage.querySelector('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}

async function updatePrint() {
  const plan = $('dialog-plan');
  const printArea = $('print-area');
  if (!available()) {
    const empty = '<p>אין דף מקור להדפסה. בוחרים כיתה ט׳ ופירוק לגורמים.</p>';
    plan.innerHTML = empty;
    printArea.innerHTML = empty;
    return;
  }
  const chosen = state.selected.map(byId).filter(Boolean);
  if (!chosen.length) {
    const empty = '<p>עדיין לא נבחרו שאלות מתוך הדף.</p>';
    plan.innerHTML = empty;
    printArea.innerHTML = empty;
    return;
  }
  const byPage = new Map();
  chosen.forEach((question) => {
    if (!byPage.has(question.page)) byPage.set(question.page, []);
    byPage.get(question.page).push(question);
  });
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  const note = state.scenario === 'other' ? $('teacher-note').value.trim() : '';
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  const head = `<p class="plan-notice">דף המקור המלא. השאלות שנבחרו מסומנות על העמוד. זה אינו דף חתוך.</p><div class="plan-meta"><span>כיתה ט׳</span><span>פירוק לגורמים</span><span>רמה א׳</span><span>${state.scenario === 'other' ? 'אחר' : escapeHTML(cfg.label)}</span></div>`;
  const sheets = pages.map((page) => sheetHTML(page, byPage.get(page))).join('');
  const foot = `<p class="print-source">מקור: ${escapeHTML(SOURCE.title)} · ${escapeHTML(SOURCE.pdfUrl)}</p><p class="plan-notes">${escapeHTML(STYLES[state.style].plan)}</p>${note ? `<div class="plan-notes"><strong>הערת המורה</strong><br>${escapeHTML(note)}</div>` : ''}`;
  const html = head + sheets + foot;
  plan.innerHTML = html;
  printArea.innerHTML = `<h1>דף מקור מסומן</h1><p class="print-subtitle">${chosen.length} סעיפים סומנו על ${pages.length} עמודים</p>` + html;
  await paintSheets(plan);
  await paintSheets(printArea);
}

async function prepare() {
  if (rendering) return;
  if (!state.selected.length) {
    announce('עדיין לא נבחרו שאלות.');
    return;
  }
  rendering = true;
  $('prepare').disabled = true;
  try {
    await updatePrint();
    if (!$('dialog-plan').querySelector('.source-mark')) {
      announce('לא נוצר סימון. לא הוצגה רשימת קישורים במקום.');
      return;
    }
    $('print-dialog').showModal();
  } catch (error) {
    $('dialog-plan').innerHTML = '<p>דף המקור לא נטען, ולכן אין סימון. לא הוצג דף חלופי.</p>';
    announce('דף המקור לא נטען.');
  } finally {
    rendering = false;
    $('prepare').disabled = false;
  }
}

function applyScenario(value) {
  snapshot();
  state.scenario = value;
  state.expanded = false;
  state.filter = 'all';
  if (value !== 'other' && SCENARIOS[value]) state.selected = SCENARIOS[value].selected.slice();
  render();
  announce(value === 'other' ? 'אפשר להוסיף הערה ולבחור סעיפים מהדף.' : 'הוצגו סעיפים קיימים מתוך הדף.');
  if (value === 'other') $('teacher-note').focus();
}

async function start() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error('SOURCE');
  SOURCE = await response.json();
  const known = new Set(SOURCE.questions.map((question) => question.id));
  Object.values(SCENARIOS).forEach((cfg) => {
    [...cfg.selected, ...cfg.essential, ...cfg.deepen, cfg.suggestion].forEach((id) => {
      if (!known.has(id)) throw new Error('MISSING_' + id);
    });
  });
  $('questions').addEventListener('change', (event) => {
    if (event.target.matches('[data-question]')) selectQuestion(event.target.dataset.question, event.target.checked);
  });
  document.querySelectorAll('[name=scenario]').forEach((el) => el.addEventListener('change', () => {
    if (el.checked) applyScenario(el.value);
  }));
  document.querySelectorAll('[name=style]').forEach((el) => el.addEventListener('change', () => {
    if (!el.checked) return;
    state.style = el.value;
    render();
  }));
  $('grade').addEventListener('change', () => { state.grade = $('grade').value; render(); });
  $('topic').addEventListener('change', () => { state.topic = $('topic').value; render(); });
  $('filter-all').addEventListener('click', () => { state.filter = 'all'; $('filter-all').setAttribute('aria-pressed', 'true'); $('filter-selected').setAttribute('aria-pressed', 'false'); render(); });
  $('filter-selected').addEventListener('click', () => { state.filter = 'selected'; $('filter-selected').setAttribute('aria-pressed', 'true'); $('filter-all').setAttribute('aria-pressed', 'false'); render(); });
  $('show-more').addEventListener('click', () => { state.expanded = true; render(); });
  $('undo').addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    state.selected = previous;
    render();
  });
  $('add-suggestion').addEventListener('click', () => {
    const cfg = SCENARIOS[state.scenario];
    if (cfg && cfg.suggestion) selectQuestion(cfg.suggestion, true);
  });
  $('return-demo').addEventListener('click', () => { state.grade = '9'; state.topic = 'factoring'; render(); });
  $('prepare').addEventListener('click', prepare);
  ['close-dialog', 'back-edit'].forEach((id) => $(id).addEventListener('click', () => { $('print-dialog').close(); $('prepare').focus(); }));
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
  render();
}

start().catch(() => {
  $('result-summary').textContent = 'רשימת השאלות של הדף לא נטענה.';
});
