import { wizardPrefillFromSearch } from './wizard-prefill.js';

/* Teacher picker for every catalog sheet.
   Grades 7–9: choose whole questions across sheets; every section of a
   chosen question comes with it. The teacher's own picks are never dropped
   by changing level, topic, goal or style, so one printed sheet can mix
   topics; automatic suggestions are replaced until the teacher picks.
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
  expanded: true,
  addingTopic: false,
  touched: false,
  grade: '9',
  topic: '2',
  level: 'all',
  wizard: 'grade',
  lastAiPickCount: 0,
};
let history = [];
let rendering = false;
let printMode = 'marked';
let printOpener = null;
let loadToken = 0;
let topicLoadPromise = null;
let aiPickPending = 0;
let teacherBotClientPromise = null;

function exKey(pdfId, id) {
  return 'ex:' + pdfId + ':' + id;
}

function sheetKey(pdfId) {
  return 'sheet:' + pdfId;
}

function ensureTeacherBotClient() {
  if (teacherBotClientPromise) return teacherBotClientPromise;
  teacherBotClientPromise = new Promise((resolve, reject) => {
    function finish(ok) {
      if (ok && window.NoamBotClient && typeof window.NoamBotClient.create === 'function') {
        resolve(window.NoamBotClient.create({ api: '/api', enabled: true, modelTimeoutMs: 25000 }));
        return;
      }
      reject(new Error('BOT_CLIENT_UNAVAILABLE'));
    }
    if (window.NoamBotClient) {
      finish(true);
      return;
    }
    const loader = document.createElement('script');
    loader.src = '/noam-bot-client.js?v=20261025-execute-ready-guard';
    loader.async = true;
    loader.onload = () => finish(true);
    loader.onerror = () => finish(false);
    document.head.appendChild(loader);
  }).catch((error) => {
    teacherBotClientPromise = null;
    throw error;
  });
  return teacherBotClientPromise;
}

const QUESTION_ROLES = { basis: 'ביסוס', review: 'חזרה', creative: 'יצירתית' };
const AI_QUESTION_COUNTS = [5, 10, 15];
const AI_CANDIDATE_LIMIT = 90;

function questionKey(pdfId, number) {
  return 'q:' + pdfId + ':' + number;
}

function questionNumber(question) {
  const number = Number(question.q);
  if (Number.isInteger(number) && number > 0) return number;
  const match = String(question.id || '').match(/^(\d{1,3})/);
  return match ? Number(match[1]) : String(question.id || '');
}

/* Whole questions, in sheet order. Each level sheet is graded: ביסוס at the
   start, חזרה in the middle, creative questions at the end. */
function questionGroups(pool) {
  const groups = [];
  const byKey = new Map();
  (pool || []).forEach((question) => {
    const pdfId = question.source.pdfId;
    const number = questionNumber(question);
    const key = questionKey(pdfId, number);
    let group = byKey.get(key);
    if (!group) {
      group = { key, pdfId, q: number, source: question.source, parts: [], keys: [], index: groups.length };
      byKey.set(key, group);
      groups.push(group);
    }
    group.parts.push(question);
    group.keys.push(exKey(pdfId, question.id));
  });
  const perSheet = new Map();
  groups.forEach((group) => {
    if (!perSheet.has(group.pdfId)) perSheet.set(group.pdfId, []);
    perSheet.get(group.pdfId).push(group);
  });
  perSheet.forEach((list) => {
    list.forEach((group, rank) => {
      const at = rank / list.length;
      group.role = at < 1 / 3 ? 'basis' : at < 2 / 3 ? 'review' : 'creative';
    });
  });
  return groups;
}

function rolePlan(scenario, style) {
  if (style === 'creative') return ['creative', 'review', 'basis'];
  if (style === 'blended' || scenario === 'other') return ['mix'];
  if (scenario === 'spiral') return ['review', 'basis', 'creative'];
  if (scenario === 'exam') return ['review', 'creative', 'basis'];
  return ['basis', 'review', 'creative'];
}

function interleaveSheets(list) {
  const lanes = new Map();
  list.forEach((group) => {
    if (!lanes.has(group.pdfId)) lanes.set(group.pdfId, []);
    lanes.get(group.pdfId).push(group);
  });
  const queues = Array.from(lanes.values());
  const out = [];
  for (let round = 0; out.length < list.length; round += 1) {
    queues.forEach((queue) => { if (round < queue.length) out.push(queue[round]); });
  }
  return out;
}

// Every question, most wanted first for this lesson goal and style.
function planOrder(groups, scenario, style) {
  const plan = rolePlan(scenario, style);
  const lane = (role) => interleaveSheets(groups.filter((group) => group.role === role));
  if (plan[0] !== 'mix') return plan.flatMap(lane);
  const lanes = ['basis', 'review', 'creative'].map(lane);
  const out = [];
  for (let round = 0; lanes.some((list) => round < list.length); round += 1) {
    lanes.forEach((list) => { if (round < list.length) out.push(list[round]); });
  }
  return out;
}

function smartQuestionPick(groups, count, scenario, style, seedKeys) {
  if (!Array.isArray(groups) || !groups.length) return [];
  const target = Math.min(Math.max(1, Number(count) || 5), groups.length);
  const byKey = new Map(groups.map((group) => [group.key, group]));
  const chosen = [];
  const used = new Set();
  const addGroup = (group) => {
    if (!group || used.has(group.key) || chosen.length >= target) return;
    used.add(group.key);
    chosen.push(group);
  };
  (seedKeys || []).forEach((key) => addGroup(byKey.get(key)));
  const plan = rolePlan(scenario, style);
  const lane = (role) => interleaveSheets(groups.filter((group) => group.role === role && !used.has(group.key)));
  if (plan[0] === 'mix') {
    const lanes = ['basis', 'review', 'creative'].map(lane);
    for (let round = 0; chosen.length < target && lanes.some((list) => round < list.length); round += 1) {
      lanes.forEach((list) => addGroup(list[round]));
    }
  } else {
    plan.forEach((role) => lane(role).forEach(addGroup));
  }
  groups.forEach(addGroup);
  chosen.sort((a, b) => a.index - b.index);
  return chosen.map((group) => group.key);
}

async function pickWithAi(rawCount) {
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count <= 0 || band() === 'elementary' || aiPickPending) return [];
  const groups = currentQuestions();
  if (!groups.length) return [];
  const target = Math.min(count, groups.length);
  const scope = [state.grade, state.topic, state.level].join('|');
  aiPickPending = count;
  paintAiPickButtons();
  const status = $('ai-suggest-status');
  if (status) status.textContent = `נועם AI בוחר ${target} שאלות…`;
  const gradeEl = $('grade');
  const topicEl = $('topic');
  const payload = {
    message: `בחר ${count} שאלות שלמות עם AI. כל מזהה ברשימה הוא שאלה שלמה עם כל הסעיפים שלה. בכל רמה: ביסוס בהתחלה, חזרה באמצע, שאלות יצירתיות בסוף.`,
    page: { kind: 'teachers', path: location.pathname + location.search, title: document.title },
    teacher: {
      grade: String(state.grade),
      gradeLabel: gradeEl && gradeEl.selectedOptions[0] ? gradeEl.selectedOptions[0].textContent.trim() : '',
      topic: String(state.topic),
      topicLabel: topicEl && topicEl.selectedOptions[0] ? topicEl.selectedOptions[0].textContent.trim() : '',
      level: String(state.level || 'all'),
      goal: String(state.scenario),
      goalLabel: (SCENARIOS[state.scenario] && SCENARIOS[state.scenario].label) || 'אחר',
      style: String(state.style),
      styleLabel: (STYLES[state.style] && STYLES[state.style].label) || '',
      note: $('teacher-note') ? String($('teacher-note').value || '').trim().slice(0, 400) : '',
      count,
      // The model prompt lists at most 90 candidates; the most wanted questions go first.
      candidates: planOrder(groups, state.scenario, state.style).slice(0, AI_CANDIDATE_LIMIT).map((group) => ({
        id: (/^[abc]$/.test(String(group.source && group.source.level)) ? group.source.level + ':' : '') + group.parts[0].id,
        label: group.parts[0].id,
        text: [QUESTION_ROLES[group.role], group.source.levelLabel, 'שאלה ' + group.q, group.parts.length + ' סעיפים'].filter(Boolean).join(' · ').slice(0, 80),
      })),
    },
  };
  let seedKeys = [];
  let fromModel = false;
  try {
    const client = await ensureTeacherBotClient();
    const result = await client.postJson('/api/noamSiteCompanion', payload);
    fromModel = Boolean(result && result.source === 'classifier' && result.model);
    if (fromModel && Array.isArray(result.exerciseIds) && result.exerciseIds.length) {
      // The server pads short answers with sections by position. Keep only questions that fit the
      // lesson plan, so padding never pushes ביסוס into a creative lesson.
      const owner = new Map();
      groups.forEach((group) => group.keys.forEach((key) => owner.set(key, group)));
      const plan = rolePlan(state.scenario, state.style);
      const fits = (group) => plan[0] === 'mix' || group.role === plan[0];
      seedKeys = Array.from(new Set(result.exerciseIds.map((key) => owner.get(key)).filter((group) => group && fits(group)).map((group) => group.key)));
    }
  } catch (error) {
    seedKeys = [];
  } finally {
    aiPickPending = 0;
  }
  if ([state.grade, state.topic, state.level].join('|') !== scope) {
    paintAiPickButtons();
    if (status) status.textContent = 'הנושא או הרמה השתנו בזמן הבחירה. אפשר לבקש שוב.';
    return [];
  }
  const pickedGroups = smartQuestionPick(groups, target, state.scenario, state.style, seedKeys);
  const finalPicked = keysOfQuestions(pickedGroups, groups);
  const before = selectionKey();
  snapshot();
  state.selected = hiddenKeys().concat(finalPicked);
  state.touched = true;
  state.lastAiPickCount = count;
  state.expanded = true;
  if (selectionKey() !== before) clearPreparedPrint();
  render();
  const what = `${pickedGroups.length} שאלות (${finalPicked.length} סעיפים)`;
  const msg = fromModel && seedKeys.length ? `נבחרו ${what} עם AI.` : `נבחרו ${what} מתוך הדפים.`;
  if (status) status.textContent = msg;
  announce(msg);
  return finalPicked;
}

function paintAiPickButtons() {
  const group = $('ai-pick-group');
  if (!group) return;
  const elementary = band() === 'elementary';
  group.hidden = elementary;
  const groups = elementary ? [] : currentQuestions();
  const total = groups.length;
  const picked = pickedQuestions(groups).length;
  group.querySelectorAll('[data-ai-pick]').forEach((btn) => {
    const count = Number(btn.dataset.aiPick);
    const busy = aiPickPending === count;
    const baseLabel = count === AI_QUESTION_COUNTS[0] ? `בחר ${count} שאלות עם AI` : `בחר ${count}`;
    btn.textContent = busy ? `בוחר ${count}…` : baseLabel;
    btn.disabled = elementary || total === 0 || aiPickPending > 0;
    const active = !elementary && total > 0 && state.lastAiPickCount === count && picked === Math.min(count, total);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (busy) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
  });
}

function installSuggest() {
  window.NoamTeacherSuggest = {
    enabled: false,
    batchPick: true,
    model: 'qwen3.8-flash',
    classifier: 'qwen-flash',
    pickCount: pickWithAi,
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
  return band() === 'middle' && String(state.grade) === '9' && String(state.topic) === '2' && (state.level === 'all' || state.level === 'a') && sheets.has(FACTORING_PDF);
}

function topicSheets() {
  const topic = currentTopic();
  if (!topic) return [];
  if (state.level === 'all') return topic.sheets;
  const matching = topic.sheets.filter((sheet) => sheet.level === state.level);
  return matching.length ? matching : topic.sheets;
}

function syncLevels() {
  const topic = currentTopic();
  const levels = new Set((topic ? topic.sheets : []).map((sheet) => sheet.level));
  const hasSpecific = ['a', 'b', 'c'].some((lvl) => levels.has(lvl));
  if (state.level !== 'all' && (!hasSpecific || !levels.has(state.level))) {
    state.level = 'all';
  }
  document.querySelectorAll('[name=level]').forEach((el) => {
    if (el.value === 'all') {
      el.disabled = false;
      return;
    }
    el.disabled = !hasSpecific || !levels.has(el.value);
  });
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

function currentQuestions() {
  return questionGroups(currentExercises());
}

function pickedQuestions(groups) {
  const chosen = new Set(state.selected);
  return groups.filter((group) => group.keys.some((key) => chosen.has(key)));
}

function keysOfQuestions(questionKeys, groups) {
  const wanted = new Set(questionKeys);
  return groups.filter((group) => wanted.has(group.key)).flatMap((group) => group.keys);
}

function keySheet(key) {
  return String(key).split(':')[1] || '';
}

// Picks outside the current view (other topics, grades or levels); they stay until the teacher removes them.
function hiddenKeys() {
  const visible = new Set(visibleSelectionKeys());
  return sameBand(state.selected).filter((key) => !visible.has(key));
}

function sameBand(keys) {
  const current = band();
  return keys.filter((key) => {
    const meta = byPdf.get(keySheet(key));
    return !meta || meta.band === current;
  });
}

// Whole questions for any loaded sheet that has a pick, with roles from the full sheet.
function pickedGroupsAll() {
  const chosen = new Set(state.selected);
  const pdfs = Array.from(new Set(state.selected.map(keySheet)));
  const pool = [];
  pdfs.forEach((pdfId) => { const source = sheets.get(pdfId); if (source) source.questions.forEach((question) => pool.push(question)); });
  return questionGroups(pool).filter((group) => group.keys.some((key) => chosen.has(key)));
}

function questionCountOf(keys) {
  const seen = new Set();
  keys.forEach((key) => {
    const question = library.get(key);
    seen.add(question ? keySheet(key) + ':' + questionNumber(question) : key);
  });
  return seen.size;
}

// A question is never split: any chosen section brings the whole question.
function wholeQuestions(keys) {
  if (band() === 'elementary') return keys;
  const chosen = new Set(keys);
  return currentQuestions().filter((group) => group.keys.some((key) => chosen.has(key))).flatMap((group) => group.keys);
}

function available() {
  const topic = currentTopic();
  return !!(topic && topic.sheets.length);
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
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
  syncLevels();
}

function questionCard(group, picked) {
  const parts = group.parts.map((question) => question.part || String(question.id).replace(/^\d+/, '')).filter(Boolean);
  const partsText = parts.length > 1 ? `${parts.length} סעיפים (${parts.join(', ')})` : (parts.length === 1 ? 'סעיף אחד' : 'בלי סעיפים');
  const pages = Array.from(new Set(group.parts.map((question) => question.page).filter(Boolean)));
  const pageText = pages.length > 1 ? `עמודים ${pages[0]}–${pages[pages.length - 1]}` : (pages.length ? `עמוד ${pages[0]}` : '');
  const levelLabel = group.source.levelLabel || '';
  const meta = [levelLabel, partsText, pageText].filter(Boolean).join(' · ');
  const role = QUESTION_ROLES[group.role] || '';
  return `<label class="q-card q-group"><input type="checkbox" data-question="${escapeHTML(group.key)}" ${picked ? 'checked' : ''} aria-label="בחירת שאלה ${escapeHTML(group.q)}${levelLabel ? ' ' + escapeHTML(levelLabel) : ''}"><span class="q-content"><span class="q-title-line"><span class="q-title">שאלה ${escapeHTML(group.q)}</span>${role ? `<span class="badge role-${group.role}">${role}</span>` : ''}</span><span class="q-page" style="display:block">${escapeHTML(meta)}</span></span></label>`;
}

function shownGroups(list, picked) {
  if (state.expanded || state.filter === 'selected') return list;
  const chosen = list.filter((group) => picked.has(group.key));
  const rest = list.filter((group) => !picked.has(group.key));
  const room = Math.max(0, 12 - chosen.length);
  const shown = new Set(chosen.concat(rest.slice(0, room)).map((group) => group.key));
  return list.filter((group) => shown.has(group.key));
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
    ? (pilotOn() ? cfg.summary : (elementary ? 'בחירה לפי דף, נושא ורמה. ההדפסה מציגה את עמודי המקור כמו שהם.' : 'שאלות שכבר קיימות בדפי הנושא. בכל רמה: ביסוס בהתחלה, חזרה באמצע, שאלות יצירתיות בסוף.'))
    : 'בוחרים כיתה ונושא מתוך הקטלוג.';
  $('rationale').textContent = ok ? (pilotOn() ? cfg.rationale : (elementary ? 'ביסודי בוחרים דף שלם לפי נושא ורמה.' : 'בחטיבה בוחרים שאלות. כל הסעיפים של שאלה נכנסים איתה לדף.')) : '';
  $('pedagogy-details').textContent = ok ? (pilotOn() ? cfg.details : (elementary ? 'ההדפסה מציגה את עמודי המקור, בלי מסגרת על הכותרת.' : 'ההדפסה מסמנת על עמוד המקור, או חותכת ממנו דף מצומצם. לא מנוסח דף חדש.')) : '';
  $('style-help').textContent = STYLES[state.style].help;
  $('other-banner').hidden = state.scenario !== 'other';
  $('grade').value = String(state.grade);
  if ($('topic').value !== String(state.topic) && state.topic) $('topic').value = String(state.topic);
  syncLevels();
  document.querySelectorAll('[name=scenario]').forEach((el) => { el.checked = el.value === state.scenario; });
  document.querySelectorAll('[name=style]').forEach((el) => { el.checked = el.value === state.style; });
  document.querySelectorAll('[name=level]').forEach((el) => { el.checked = el.value === state.level; });
  const hint = $('scope-hint');
  if (hint && ok) {
    const topic = currentTopic();
    hint.textContent = elementary
      ? `${gradeRecord(state.grade).label} · ${topic.title}. בוחרים דף לפי רמה.`
      : `${gradeRecord(state.grade).label} · ${topic.title}. ${currentQuestions().length} שאלות בדפי הנושא.`;
  }
  const shortBtn = $('prepare-short');
  if (shortBtn) shortBtn.hidden = elementary;
  const prepareHint = $('prepare-hint');
  if (prepareHint) prepareHint.textContent = elementary ? 'הדף המלא מהמקור, בלי סימון.' : 'דף מלא עם סימון, או דף מצומצם שנחתך מהמקור';
  if (!ok) {
    paintSourceLine();
    applyWizard();
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
    const groups = currentQuestions();
    const pickedAll = state.filter === 'selected' ? pickedGroupsAll() : [];
    const picked = new Set(pickedQuestions(groups).map((group) => group.key).concat(pickedAll.map((group) => group.key)));
    const list = state.filter === 'selected' ? pickedAll : groups;
    const visible = shownGroups(list, picked);
    const multiSheet = new Set(visible.map((group) => group.pdfId)).size > 1;
    const multiTopic = new Set(visible.map((group) => group.source.topic)).size > 1;
    $('available-count').textContent = groups.length + ' שאלות בדפי הנושא';
    $('questions').innerHTML = visible.length
      ? visible.map((group, index) => {
        const head = multiSheet && (index === 0 || visible[index - 1].pdfId !== group.pdfId)
          ? `<h4 class="level-head">${escapeHTML((multiTopic ? [group.source.topic, group.source.levelLabel] : [group.source.levelLabel || group.source.title]).filter(Boolean).join(' · '))}</h4>`
          : '';
        return head + questionCard(group, picked.has(group.key));
      }).join('')
      : '<p class="empty">עדיין לא נבחרו שאלות. אפשר לעבור ל״כל ההצעות״ ולסמן.</p>';
    const hidden = Math.max(0, list.length - visible.length);
    $('show-more').hidden = hidden === 0;
    $('more-count').textContent = hidden ? String(hidden) : '';
    $('suggestion').hidden = true;
  }
  const pdfs = new Set(state.selected.map((key) => key.split(':')[1]).filter(Boolean));
  const fromSheets = pdfs.size ? 'מתוך ' + pdfs.size + (pdfs.size === 1 ? ' דף מקור' : ' דפי מקור') : '';
  if (elementary) {
    $('selection-count').textContent = state.selected.length + ' נבחרו';
    $('selection-composition').textContent = fromSheets;
  } else {
    const kept = sameBand(state.selected);
    const chosenGroups = questionCountOf(kept);
    const topics = new Set(kept.map((key) => byPdf.get(keySheet(key))).filter(Boolean).map((meta) => meta.grade + ':' + meta.topicId));
    $('selection-count').textContent = chosenGroups === 1 ? 'נבחרה שאלה אחת' : chosenGroups + ' שאלות נבחרו';
    $('selection-composition').textContent = kept.length
      ? [kept.length + ' סעיפים', topics.size > 1 ? 'מ־' + topics.size + ' נושאים' : fromSheets].filter(Boolean).join(' · ')
      : '';
  }
  $('undo').disabled = history.length === 0;
  paintAiPickButtons();
  paintSourceLine();
  applyWizard();
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
  const topics = [...new Set(chosen.map((meta) => meta.topic).filter(Boolean))];
  const grades = [...new Set(chosen.map((meta) => meta.gradeLabel).filter(Boolean))];
  const mixed = topics.length > 1;
  const levels = [...new Set(chosen.map((meta) => levelPrintName(meta.level, meta.levelLabel)))].join(' · ');
  const title = mixed
    ? `${topics.join(' · ')} · ${grades.join(' · ')}`
    : `${topic ? topic.title : ''} · ${grade ? grade.label : ''} · ${levels}`;
  const linkName = (meta) => {
    if (chosen.length === 1) return 'פתיחת דף המקור';
    const level = levelPrintName(meta.level, meta.levelLabel);
    return mixed ? [meta.topic, level].filter(Boolean).join(' · ') : level;
  };
  const links = chosen.map((meta) => `<a href="${escapeHTML(meta.pdfUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(linkName(meta))} ↗</a>`).join('');
  line.innerHTML = `<span>${escapeHTML(title)}</span>${links}`;
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
  state.touched = true;
  state.lastAiPickCount = 0;
  if (on && !state.selected.includes(key)) state.selected.push(key);
  if (!on) state.selected = state.selected.filter((item) => item !== key);
  if (selectionKey() !== before) clearPreparedPrint();
  render();
}

function selectQuestion(key, on) {
  const group = currentQuestions().find((item) => item.key === key) || pickedGroupsAll().find((item) => item.key === key);
  if (!group) return;
  const before = selectionKey();
  snapshot();
  state.touched = true;
  state.lastAiPickCount = 0;
  if (on) group.keys.forEach((item) => { if (!state.selected.includes(item)) state.selected.push(item); });
  else state.selected = state.selected.filter((item) => !group.keys.includes(item));
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

function selectionMarkBox(question) {
  const box = question.box;
  if (!box || ![box.x, box.y, box.w, box.h].every(Number.isFinite)
      || box.x < 0 || box.y < 0 || box.w <= 0 || box.h <= 0) return null;
  // The old selection rectangle includes the start of the sentence. Put a
  // small check beside its right edge, never over the original PDF text.
  const x = box.x + box.w + 0.006;
  const w = Math.min(0.014, 0.995 - x);
  if (w < 0.006) return null;
  const line = question.labelLine;
  const lineCenter = line && line.page === question.page
    && Number.isFinite(line.y) && Number.isFinite(line.h) && line.h > 0
    ? line.y + line.h / 2 : NaN;
  const center = lineCenter >= box.y && lineCenter <= box.y + box.h
    ? lineCenter : box.y + box.h / 2;
  const h = Math.min(0.01, box.h * 0.5);
  return { x, y: Math.max(0, Math.min(1 - h, center - h / 2)), w, h };
}

function sheetHTML(pageNumber, questions) {
  const marked = questions.filter((question) => question.box);
  const marks = marked.map((question) => {
    const box = selectionMarkBox(question);
    if (!box) return '';
    return `<span class="source-mark" data-question="${escapeHTML(question.id)}" style="left:${box.x * 100}%;top:${box.y * 100}%;width:${box.w * 100}%;height:${box.h * 100}%" role="img" aria-label="${escapeHTML(question.label)} — נבחר" title="${escapeHTML(question.label)}"><svg viewBox="0 0 16 16" preserveAspectRatio="none" aria-hidden="true"><path d="M 2 8 L 6 12 L 14 3"/></svg></span>`;
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
    ctx.strokeStyle = '#21645f';
    ctx.lineWidth = Math.min(w, h) * 0.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 2 / 16, y + h * 8 / 16);
    ctx.lineTo(x + w * 6 / 16, y + h * 12 / 16);
    ctx.lineTo(x + w * 14 / 16, y + h * 3 / 16);
    ctx.stroke();
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
  const masks = absoluteMasks(box);
  return masks.length ? masks[0] : null;
}

function absoluteMasks(box) {
  if (!box || !(box.h > 0)) return [];
  const list = box.masks && box.masks.length ? box.masks : (box.mask ? [box.mask] : []);
  return list.map((mask) => ({
    x: mask.x,
    w: mask.w,
    y: box.y + mask.y * box.h,
    y2: box.y + (mask.y + mask.h) * box.h,
  }));
}

function boxWithMasks(box, y, end, absoluteList) {
  const height = Math.max(0.004, end - y);
  const next = { ...box, y, h: height };
  const rel = [];
  (absoluteList || []).forEach((mask) => {
    if (!mask || !(mask.w > 0)) return;
    const top = Math.max(mask.y, y);
    const bot = Math.min(mask.y2, y + height);
    if (bot - top < 0.0015) return;
    rel.push({
      x: mask.x,
      w: mask.w,
      y: (top - y) / height,
      h: (bot - top) / height,
    });
  });
  delete next.mask;
  delete next.masks;
  if (!rel.length) return next;
  rel.sort((a, b) => (b.y + b.h) - (a.y + a.h));
  next.masks = rel;
  next.mask = rel[0];
  return next;
}

function withSpan(box, y, end, masks) {
  return boxWithMasks(box, y, end, masks && masks.length ? masks : absoluteMasks(box));
}

function questionFigure(question) {
  const page = question.page;
  let fig = null;
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q || !item.figure) return;
    if ((item.page || page) !== page) return;
    const f = item.figure;
    if (!fig) fig = { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 };
    else {
      fig.x0 = Math.min(fig.x0, f.x0);
      fig.y0 = Math.min(fig.y0, f.y0);
      fig.x1 = Math.max(fig.x1, f.x1);
      fig.y1 = Math.max(fig.y1, f.y1);
    }
  });
  return fig;
}

function rangesOverlap(a0, a1, b0, b1, pad) {
  const gap = pad == null ? 0.004 : pad;
  return a0 < b1 + gap && b0 < a1 + gap;
}

/**
 * A right-column mask is stored on the figure's right edge, which is the
 * wall stroke itself. Move it just past that stroke so the line stays.
 */
function shiftMask(question, mask, page) {
  if (!mask) return mask;
  let next = mask;
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q || !item.figure || item.page !== page) return;
    if (Math.abs(next.x - item.figure.x1) < 0.01 && next.w > 0.15) {
      const shift = 0.008;
      next = { ...next, x: next.x + shift, w: Math.max(0.05, next.w - shift) };
    }
  });
  return next;
}

function clearDrawingStroke(question, box) {
  if (!box) return box;
  const list = box.masks && box.masks.length ? box.masks : (box.mask ? [box.mask] : []);
  if (!list.length) return box;
  const page = box.page || question.page;
  const shifted = list.map((mask) => shiftMask(question, mask, page));
  return { ...box, masks: shifted, mask: shifted[0] };
}

function partRank(part) {
  const order = 'אבגדהוזחטיכלמנסעפצקרשת';
  const index = order.indexOf(part || '');
  return index < 0 ? 99 : index;
}

function bandsOutside(y, y2, cutY, cutY2) {
  if (y2 <= cutY + 0.002 || y >= cutY2 - 0.002) return [[y, y2]];
  const out = [];
  if (y < cutY - 0.001) out.push([y, cutY]);
  if (y2 > cutY2 + 0.001) out.push([cutY2, y2]);
  return out;
}

/**
 * A part printed alone keeps the whole shared drawing (the house, the polygon
 * beside question 19) and the question number. Unpicked parts of that question
 * are covered on the text side of the drawing, so their words are not printed.
 * A later selected part is left for its own row. The crop starts on a white row.
 */
function coverSharedFigure(question, box, laterSelected, selectedIds) {
  const page = box.page || question.page;
  const originalEnd = boxEnd(box);
  let top = box.y;
  let end = originalEnd;
  const masks = [];
  const ownMasks = absoluteMasks(box);
  ownMasks.forEach((mask) => masks.push(mask));
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q || item.id === question.id) return;
    questionRows(item).forEach((other) => {
      if (!other || (other.page || item.page) !== page) return;
      const otherEnd = boxEnd(other);
      if (other.y < top - 0.003 && otherEnd > top + 0.003) {
        const adjacent = Math.abs(partRank(item.part) - partRank(question.part)) === 1;
        // Only an adjacent part may pull the crop up into its text. A drawing
        // that continues to the bottom of a later part still extends the end.
        if (adjacent) top = Math.min(top, other.y);
        if (otherEnd > end) end = otherEnd;
      }
      absoluteMasks(other).forEach((mask) => masks.push(mask));
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
  // Only after the crop was already lifted. A tall earlier row (19א) must not
  // swallow a later part that was never pulled upward.
  if (top < box.y - 0.0004) {
    let lineTop = top;
    (SOURCE.questions || []).forEach((item) => {
      if (!item || item.q !== question.q) return;
      questionRows(item).forEach((other) => {
        if (!other || (other.page || item.page) !== page) return;
        if (other.y < top - 0.0004 && boxEnd(other) > top + 0.001) lineTop = Math.min(lineTop, other.y);
      });
    });
    top = lineTop;
  }
  const fig = questionFigure(question);
  if (fig && !laterSelected) {
    top = Math.min(top, fig.y0);
    end = Math.max(end, fig.y1 + 0.002);
    const stem = question.stem;
    if (stem && rangesOverlap(stem.y, stem.y + stem.h, fig.y0, fig.y1)) top = Math.min(top, stem.y);
  }
  if (end > originalEnd + 0.0005) {
    let nextTop = null;
    (SOURCE.questions || []).forEach((item) => {
      if (!item || item.q !== question.q || item.id === question.id || !item.row) return;
      if ((item.row.page || item.page) !== page) return;
      if (selectedIds && selectedIds.has(item.id)) return;
      if (item.row.y >= originalEnd - 0.004 && (nextTop == null || item.row.y < nextTop)) nextTop = item.row.y;
    });
    // A small step past the next label is the rest of the drawing, plus that label's text.
    if (nextTop != null && end > nextTop - 0.001 && end - nextTop < 0.008) {
      masks.push({ x: 0.45, w: 0.55, y: nextTop, y2: Math.max(end, nextTop + 0.004) });
    }
  }
  if (fig && !laterSelected) {
    const textX = fig.x1;
    const textW = Math.max(0.05, 0.98 - textX);
    const stemEnd = question.stem ? question.stem.y + question.stem.h : null;
    const pickedY = question.row ? question.row.y : top;
    const pickedY2 = question.row ? boxEnd(question.row) : end;
    (SOURCE.questions || []).forEach((item) => {
      if (!item || item.q !== question.q || item.id === question.id || !item.row) return;
      if ((item.row.page || item.page) !== page) return;
      if (selectedIds && selectedIds.has(item.id)) return;
      let y = item.row.y;
      const y2 = boxEnd(item.row);
      if (stemEnd != null && y < stemEnd) y = stemEnd;
      if (y2 - y < 0.008) return;
      bandsOutside(y, y2, pickedY, pickedY2).forEach((band) => {
        const lo = Math.max(band[0], top);
        const hi = Math.min(band[1], end);
        if (hi - lo >= 0.008) masks.push({ x: textX, w: textW, y: lo, y2: hi });
      });
    });
  }
  // A tall earlier part can contain a later part that was not picked (1א holds 1ב).
  // Cover that part wherever it sits, and leave the drawing on the left.
  const textX = fig ? fig.x1 : 0.46;
  const textW = Math.max(0.04, 0.98 - textX);
  (SOURCE.questions || []).forEach((item) => {
    if (!item || item.q !== question.q || item.id === question.id || !item.row) return;
    if ((item.row.page || item.page) !== page) return;
    if (selectedIds && selectedIds.has(item.id)) return;
    const lo = Math.max(item.row.y, top);
    const hi = Math.min(boxEnd(item.row), end);
    if (hi - lo < 0.008) return;
    masks.push({ x: textX, w: textW, y: lo, y2: hi });
  });
  if (Math.abs(top - box.y) < 0.0001 && Math.abs(end - originalEnd) < 0.0001 && masks.length === ownMasks.length) return box;
  return boxWithMasks({ ...box, page }, top, end, masks);
}

function shortSlices(chosen) {
  const ordered = chosen.slice().sort((a, b) => (
    a.page - b.page || (a.q - b.q) || partRank(a.part) - partRank(b.part) || SOURCE.questions.indexOf(a) - SOURCE.questions.indexOf(b)
  ));
  const slices = [];
  let lastQuestion = null;
  const selectedIds = new Set(ordered.map((item) => item.id));
  const GLYPH_PAD = 0.0035;
  ordered.forEach((question) => {
    const block = (question.source && question.source.pdfId ? question.source.pdfId + ':' : '') + 'q' + question.q;
    if (question.q !== lastQuestion) {
      const fig = questionFigure(question);
      const stem = question.stem;
      const stemInFigure = stem && fig && rangesOverlap(stem.y, stem.y + stem.h, fig.y0, fig.y1);
      // The number sits on the drawing: one crop keeps them together.
      if (stem && !stemInFigure) slices.push({ page: stem.page || question.page, box: stem, gap: 10, block, kind: 'stem', pdfId: SOURCE && SOURCE.pdfId });
      lastQuestion = question.q;
    }
    const rows = question.rows && question.rows.length ? question.rows : [question.row];
    rows.forEach((box) => {
      if (!box) return;
      const page = box.page || question.page;
      let next = { ...box, page };
      const prev = previousQuestionRow(slices, block, page);
      const laterSelected = ordered.some((other) => (
        other !== question && other.q === question.q && other.row
        && (other.row.page || other.page) === page && other.row.y > box.y + 0.004
      ));
      // The first selected part of this question can still own a shared drawing.
      if (!prev) next = coverSharedFigure(question, next, laterSelected, selectedIds);
      const originalTop = box.y;
      // A measured row can start inside the letter tops (6ד). Lift a short row
      // onto the white gap above it. Rows already expanded to a drawing stay put.
      const clipsInk = question.inkTop != null && Math.abs(question.inkTop - originalTop) < 0.002;
      if (clipsInk && !(next.y < originalTop - 0.001) && next.h < 0.08) {
        const lifted = Math.max(0, next.y - GLYPH_PAD);
        const end = boxEnd(next);
        next = next.mask ? withSpan(next, lifted, end, absoluteMasks(next)) : { ...next, y: lifted, h: end - lifted };
      }
      if (prev && next.y < boxEnd(prev.box) - 0.008) {
        const prevEnd = boxEnd(prev.box);
        // Fully covered by the previous part: printing it again repeats its text.
        if (boxEnd(next) <= prevEnd + 0.004) return;
        const height = boxEnd(next) - prevEnd;
        if (height < 0.004) return;
        next = { ...next, y: prevEnd, h: height };
      }
      // Running source footers (page number, site line) sit at about y 0.949.
      // A last part measured to the page bottom must not take them with it.
      const FOOTER_LIMIT = 0.94;
      if (boxEnd(next) > FOOTER_LIMIT) {
        const kept = FOOTER_LIMIT - next.y;
        if (kept < 0.004) return;
        const end = FOOTER_LIMIT;
        next = next.mask ? withSpan(next, next.y, end, absoluteMasks(next)) : { ...next, h: end - next.y };
      }
      const last = slices[slices.length - 1];
      const dup = last && last.kind === 'row' && last.page === page && last.box.x === next.x && last.box.y === next.y && last.box.w === next.w && last.box.h === next.h;
      // Abutting rows overlap by 2px so the join is not a white seam.
      const gap = prev && next.y <= boxEnd(prev.box) + 0.006 ? -2 : 4;
      if (!dup) slices.push({ page, box: clearDrawingStroke(question, next), gap, block, kind: 'row', pdfId: SOURCE && SOURCE.pdfId });
    });
  });
  return slices;
}

function contentHeight(items) {
  return items.reduce((sum, item, index) => sum + (index ? item.slice.gap : 0) + item.dh, 0);
}

function gapSize(gap, scale) {
  if (!gap) return 0;
  const next = Math.round(gap * scale);
  // A negative gap is the 2px overlap that hides the seam; scaling must not turn it into a gap.
  return gap < 0 ? Math.min(-1, next) : Math.max(1, next);
}

function fittedHeight(items, scale) {
  let cursor = 0;
  items.forEach((item, index) => {
    if (index) cursor += gapSize(item.slice.gap, scale);
    cursor += Math.max(1, Math.round(item.dh * scale));
  });
  return cursor;
}

function fittedScale(items, room) {
  const natural = contentHeight(items);
  if (!(natural > room) || room <= 0) return 1;
  let scale = room / natural;
  let placed = fittedHeight(items, scale);
  for (let pass = 0; pass < 4 && placed > room; pass += 1) {
    scale *= room / placed;
    placed = fittedHeight(items, scale);
  }
  return scale;
}

function splitQuestion(items, limit) {
  const stem = items.filter((item) => item.slice.kind === 'stem');
  const rows = items.filter((item) => item.slice.kind === 'row');
  if (rows.length < 2) return [items];
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
  return chunks;
}

const SHEET_PAGE_H = 1440;
const SHEET_BASAD_H = 40;
const SHEET_TITLE_H = 86;

function sheetContentLimit(pageIndex, reserveTitle) {
  return SHEET_PAGE_H - SHEET_BASAD_H - (reserveTitle && pageIndex === 0 ? SHEET_TITLE_H : 0);
}

function levelPrintName(level, label) {
  if (level === 'a') return 'רמה א׳';
  if (level === 'b') return 'רמה ב׳';
  if (level === 'c' || String(label || '').includes('מצוינות')) return 'מצוינות';
  return label || '';
}

function orderPrintQuestions(chosen) {
  // Topics print in the order the teacher picked them; inside a topic, by level and question.
  const topicRank = new Map();
  chosen.forEach((question) => {
    const source = question.source || {};
    const topic = String(source.grade || '') + ':' + String(source.topicId || source.topic || '');
    if (!topicRank.has(topic)) topicRank.set(topic, topicRank.size);
  });
  const topicOf = (source) => topicRank.get(String(source.grade || '') + ':' + String(source.topicId || source.topic || '')) || 0;
  return chosen.slice().sort((a, b) => {
    const rank = { a: 0, b: 1, c: 2, one: 3 };
    const sa = a.source || {};
    const sb = b.source || {};
    const tr = topicOf(sa) - topicOf(sb);
    if (tr) return tr;
    const lr = (rank[sa.level] ?? 9) - (rank[sb.level] ?? 9);
    if (lr) return lr;
    const qr = (Number(a.q) || 0) - (Number(b.q) || 0);
    if (qr) return qr;
    const pr = partRank(a.part) - partRank(b.part);
    if (pr) return pr;
    return String(a.id || '').localeCompare(String(b.id || ''), 'he');
  });
}

function batchesOf(chosen) {
  const batches = [];
  orderPrintQuestions(chosen).forEach((question) => {
    const source = question.source || {};
    const last = batches[batches.length - 1];
    if (last && last.sourceId === source.pdfId && last.q === question.q) last.questions.push(question);
    else batches.push({ sourceId: source.pdfId, q: question.q, questions: [question] });
  });
  return batches;
}

function packShort(measured, options) {
  const reserveTitle = !(options && options.answers);
  const blocks = [];
  measured.forEach((item) => {
    if (!item || !item.slice) return;
    if (item.slice.kind === 'header' || item.slice.kind === 'footer') return;
    if (item.slice.block === 'header' || item.slice.block === 'footer') return;
    const last = blocks[blocks.length - 1];
    if (last && last.id === item.slice.block) last.items.push(item);
    else blocks.push({ id: item.slice.block, items: [item] });
  });
  const pages = [];
  let page = [];
  blocks.forEach((block) => {
    const items = block.items;
    const limitHere = sheetContentLimit(pages.length, reserveTitle);
    const joined = page.concat(items);
    if (page.length && contentHeight(joined) > limitHere && limitHere / contentHeight(joined) < 0.85) {
      pages.push(page);
      page = [];
    }
    page = page.concat(items);
  });
  if (page.length) pages.push(page);
  if (!pages.length) pages.push([]);
  return pages;
}

function textItemBox(item, width, height) {
  const baseline = item.transform[5];
  const fontSize = item.height || Math.abs(item.transform[3]) || 8;
  // pdf.js font size sits above PyMuPDF's glyph top. 0.78 lines the two up.
  const ascent = fontSize * 0.78;
  const x = item.transform[4] / width;
  const w = (item.width || 0) / width;
  return {
    x,
    x2: x + w,
    y: 1 - (baseline + ascent) / height,
    y2: 1 - baseline / height,
    text: item.str,
  };
}

function isAnswerHeading(line) {
  const text = String(line.text || '').replace(/\s/g, '');
  return text.startsWith('תשובות') && text.length < 24;
}

function answerNumberValue(line) {
  const match = String(line.text || '').trim().match(/^(?:\((\d{1,2})\)|(\d{1,2})\.)$/);
  return match ? (match[1] || match[2]) : null;
}

function isAnswerNumber(line) {
  if (!answerNumberValue(line)) return false;
  if (line.y > 0.9) return false;
  if (line.x != null && line.x < 0.85) return false;
  return true;
}

function answerHeadingBox(head) {
  if (!head) return null;
  const y = Math.max(0.04, (head.y || 0) - 0.006);
  const y2 = Math.min(0.14, Math.max(y + 0.022, (head.y2 || y + 0.02) + 0.008));
  const x = head.x != null ? Math.max(0.02, head.x - 0.02) : 0.62;
  const x2 = head.x2 != null ? Math.min(0.98, head.x2 + 0.02) : 0.97;
  return { x, y, w: Math.max(0.08, x2 - x), h: Math.max(0.018, y2 - y) };
}

function wantedAnswerSpecs(wanted) {
  const byQ = new Map();
  (wanted || []).forEach((item) => {
    const spec = item && typeof item === 'object' ? { q: String(item.q), part: item.part || '' } : { q: String(item), part: '' };
    if (!byQ.has(spec.q)) byQ.set(spec.q, new Set());
    byQ.get(spec.q).add(spec.part);
  });
  return byQ;
}

function charWeight(ch) {
  if (/[\u0590-\u05FF]/.test(ch)) return 1;
  if (/[0-9]/.test(ch)) return 0.55;
  if (ch === ' ' || ch === '\u00a0') return 0.33;
  if ('·∙•.,'.includes(ch)) return 0.35;
  if (ch === '״' || ch === '-') return 0.3;
  return 0.6;
}

const ANSWER_PARTS = 'אבגדהוזחטי';
const ANSWER_GAP = 0.014;
const ANSWER_RIGHT = 0.948;

function answerGlyphs(item) {
  if (item.chars && item.chars.length) {
    return item.chars.map((glyph) => ({
      c: glyph.c,
      x: glyph.x,
      x2: glyph.x2,
      y: glyph.y == null ? item.y : glyph.y,
      y2: glyph.y2 == null ? (item.y2 || item.y) : glyph.y2,
      exact: true,
    }));
  }
  const text = String(item.text || '');
  const chars = Array.from(text);
  if (!chars.length || item.x == null) return [];
  const x0 = item.x;
  const x1 = item.x2 == null ? item.x : item.x2;
  const weights = chars.map(charWeight);
  const sum = weights.reduce((total, weight) => total + weight, 0) || 1;
  const width = Math.max(0, x1 - x0);
  const rtl = /[\u0590-\u05FF]/.test(text);
  const y2 = item.y2 == null ? item.y + 0.012 : item.y2;
  let used = 0;
  return chars.map((ch, index) => {
    const span = weights[index] / sum * width;
    const left = rtl ? x1 - used - span : x0 + used;
    used += span;
    return { c: ch, x: left, x2: left + span, y: item.y, y2, exact: false };
  });
}

function answerLabels(glyphs) {
  const ordered = glyphs.slice().sort((a, b) => b.x2 - a.x2 || b.x - a.x);
  const hasSeparators = ordered.some((glyph) => '·∙•'.includes(glyph.c));
  const found = [];
  ordered.forEach((glyph, index) => {
    if (!ANSWER_PARTS.includes(glyph.c)) return;
    let dot = index + 1;
    while (dot < ordered.length && !String(ordered[dot].c).trim()) dot += 1;
    if (dot >= ordered.length || ordered[dot].c !== '.') return;
    let prev = index - 1;
    while (prev >= 0 && !String(ordered[prev].c).trim()) prev -= 1;
    if (hasSeparators) {
      if (prev >= 0 && !'·∙•'.includes(ordered[prev].c)) return;
    } else if (prev >= 0 && ordered[prev].x - glyph.x2 < 0.01) {
      return;
    }
    found.push({ part: glyph.c, x: glyph.x, x2: glyph.x2 });
  });
  return found.sort((a, b) => b.x2 - a.x2);
}

function answerClusters(glyphs) {
  const sorted = glyphs.slice().sort((a, b) => a.y - b.y || b.x2 - a.x2);
  const clusters = [];
  sorted.forEach((glyph) => {
    const last = clusters[clusters.length - 1];
    if (!last || glyph.y - last.y > 0.01) clusters.push({ y: glyph.y, glyphs: [glyph] });
    else last.glyphs.push(glyph);
  });
  return clusters;
}

function answerPartBox(glyphs, left, right, y, y2) {
  const owned = glyphs.filter((glyph) => glyph.x2 > left + 0.001 && glyph.x < right - 0.001 && !'·∙•'.includes(glyph.c));
  if (!owned.length) return null;
  let x = Math.min(...owned.map((glyph) => glyph.x)) - 0.0015;
  let x2 = Math.min(right, Math.max(...owned.map((glyph) => glyph.x2)) + 0.002);
  // A separator sits in the gap beside a part. Pull the nearer edge off it so
  // an individually cropped answer does not keep the dot.
  const midBox = (x + x2) / 2;
  glyphs.forEach((glyph) => {
    if (!'·∙•'.includes(glyph.c) || glyph.x >= x2 || glyph.x2 <= x) return;
    const mid = (glyph.x + glyph.x2) / 2;
    if (mid >= midBox) x2 = Math.min(x2, glyph.x - 0.001);
    else x = Math.max(x, glyph.x2 + 0.001);
  });
  if (x2 - x < 0.008) return null;
  return { x: Math.max(0.02, x), y, w: x2 - Math.max(0.02, x), h: Math.max(0.012, y2 - y) };
}

// Each picked part is its own crop, placed just to the left of the question
// number. The full answer line is not masked.
function answerPieces(pageLines, mark, nextY, parts) {
  if (!parts || parts.has('')) return null;
  const band = pageLines.filter((line) => (
    line.y >= mark.y - 0.008
    && line.y < nextY - 0.004
    && !(line.x != null && line.x >= 0.85 && isAnswerNumber(line))
  ));
  const glyphs = band.flatMap(answerGlyphs).filter((glyph) => glyph.x < 0.90);
  const clusters = answerClusters(glyphs);
  if (!clusters.length) return null;
  const exact = glyphs.some((glyph) => glyph.exact);
  const pad = exact ? 0.003 : 0.008;
  const owned = [];
  let carry = null;
  clusters.forEach((cluster) => {
    const labels = answerLabels(cluster.glyphs);
    if (!labels.length) {
      if (!carry || !parts.has(carry.part)) return;
      const y = Math.min(...cluster.glyphs.map((glyph) => glyph.y)) - 0.002;
      const y2 = Math.max(...cluster.glyphs.map((glyph) => glyph.y2)) + 0.002;
      const box = answerPartBox(cluster.glyphs, 0.02, 0.90, y, y2);
      if (box) owned.push({ part: carry.part, box });
      return;
    }
    labels.forEach((label, index) => {
      const next = labels[index + 1];
      const seps = cluster.glyphs.filter((glyph) => (
        '·∙•'.includes(glyph.c) && glyph.x2 < label.x + 0.002 && (!next || glyph.x > next.x - 0.004)
      ));
      const sep = seps.sort((a, b) => b.x2 - a.x2)[0];
      const left = sep ? sep.x2 + pad : (next ? next.x2 + pad + 0.006 : 0.02);
      const y = Math.min(...cluster.glyphs.map((glyph) => glyph.y)) - 0.002;
      const y2 = Math.max(...cluster.glyphs.map((glyph) => glyph.y2)) + 0.002;
      if (parts.has(label.part)) {
        const box = answerPartBox(cluster.glyphs, left, Math.min(0.90, label.x2 + 0.004), y, y2);
        if (box) owned.push({ part: label.part, box });
      }
    });
    carry = labels[labels.length - 1];
  });
  if (!owned.length) return null;
  const rank = {};
  Array.from(ANSWER_PARTS).forEach((letter, index) => { rank[letter] = index; });
  owned.sort((a, b) => a.box.y - b.box.y || (rank[a.part] || 0) - (rank[b.part] || 0));
  const lines = [];
  owned.forEach((item) => {
    const last = lines[lines.length - 1];
    if (!last || item.box.y - last.y > 0.01) lines.push({ y: item.box.y, items: [item] });
    else last.items.push(item);
  });
  const number = pageLines.find((line) => isAnswerNumber(line) && Math.abs(line.y - mark.y) < 0.008 && answerNumberValue(line) === mark.n);
  const pieces = [];
  lines.forEach((line, lineIndex) => {
    const y = Math.min(...line.items.map((item) => item.box.y));
    const y2 = Math.max(...line.items.map((item) => item.box.y + item.box.h));
    let cursor = ANSWER_RIGHT;
    const place = (box) => {
      const width = Math.min(box.w, Math.max(0.012, cursor - 0.02));
      cursor -= width;
      const at = Math.max(0.02, cursor);
      cursor -= ANSWER_GAP;
      pieces.push({ box: { ...box, y, w: width, h: Math.max(0.012, y2 - y) }, at });
    };
    if (lineIndex === 0 && number) {
      const nx = Math.max(0.88, (number.x || mark.x) - 0.002);
      const nx2 = Math.min(0.98, (number.x2 || nx + 0.02) + 0.003);
      place({ x: nx, y, w: Math.max(0.012, nx2 - nx), h: y2 - y });
    }
    line.items.forEach((item) => place(item.box));
  });
  const rowY = Math.max(0.04, Math.min(...pieces.map((piece) => piece.box.y)));
  const rowY2 = Math.max(...pieces.map((piece) => piece.box.y + piece.box.h));
  const rowH = Math.max(0.014, rowY2 - rowY);
  pieces.forEach((piece) => { piece.dy = (piece.box.y - rowY) / rowH; });
  return { box: { x: 0, y: rowY, w: 1, h: rowH }, pieces };
}

function answerCropsFromLines(lines, wanted) {
  const want = wantedAnswerSpecs(wanted);
  const pages = new Map();
  (lines || []).forEach((line) => {
    if (!pages.has(line.page)) pages.set(line.page, []);
    pages.get(line.page).push(line);
  });
  const crops = [];
  const FOOTER = 0.93;
  pages.forEach((pageLines, page) => {
    // The answer page opens with the heading "תשובות סופיות". A question that
    // merely mentions התשובות is not that page.
    if (!pageLines.some(isAnswerHeading)) return;
    const byNumber = new Map();
    pageLines.forEach((line) => {
      if (!isAnswerNumber(line)) return;
      const n = answerNumberValue(line);
      const prev = byNumber.get(n);
      if (!prev || (line.x || 0) > (prev.x || 0)) byNumber.set(n, { n, y: line.y, y2: line.y2, x: line.x || 0, x2: line.x2 || 0 });
    });
    const marks = [...byNumber.values()].sort((a, b) => a.y - b.y);
    marks.forEach((mark, index) => {
      if (!want.has(mark.n)) return;
      const next = marks[index + 1];
      const nextY = next ? next.y : FOOTER;
      const laid = answerPieces(pageLines, mark, nextY, want.get(mark.n));
      if (laid) {
        crops.push({ page, q: Number(mark.n), box: laid.box, pieces: laid.pieces });
        return;
      }
      const y = Math.max(0.04, mark.y - 0.004);
      let y2 = next ? Math.min(next.y - 0.004, FOOTER) : FOOTER;
      if (y2 - y < 0.012) y2 = Math.min(FOOTER, y + 0.02);
      crops.push({ page, q: Number(mark.n), box: { x: 0.02, y, w: 0.96, h: Math.max(0.012, y2 - y) } });
    });
  });
  return crops;
}

function worksheetTitle(chosen) {
  const topics = [];
  chosen.forEach((question) => {
    const topic = question.source && (question.source.topic || question.source.title);
    if (topic && !topics.includes(topic)) topics.push(topic);
  });
  if (topics.length > 2) return topics.slice(0, 2).join(' · ') + ' ועוד';
  if (topics.length === 2) return topics.join(' · ');
  return topics[0] || (SOURCE && SOURCE.topic) || 'דף תרגול';
}

async function measureSlices(slices) {
  const OUT_W = 1000;
  const measured = [];
  for (const slice of slices) {
    if (slice.kind === 'level') {
      measured.push({ slice, bitmap: null, sw: OUT_W, sh: 36, dh: 36 });
      continue;
    }
    const bitmap = await pageBitmap(slice.page, sheets.get(slice.pdfId) || SOURCE);
    const sw = Math.max(1, slice.box.w * bitmap.width);
    const sh = Math.max(1, slice.box.h * bitmap.height);
    const dw = slice.box.w < 0.5 ? slice.box.w * OUT_W : OUT_W;
    measured.push({ slice, bitmap, sw, sh, dh: Math.max(1, Math.round(dw * sh / sw)) });
  }
  return measured;
}

function paintPageChrome(ctx, width, pageIndex, pageCount, title) {
  ctx.fillStyle = '#22305a';
  ctx.font = '22px Heebo, Arial, sans-serif';
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillText('בס״ד', width - 28, 28);
  if (pageIndex !== 0) return SHEET_BASAD_H;
  let titleSize = 28;
  ctx.font = titleSize + 'px Heebo, Arial, sans-serif';
  while (titleSize > 16 && ctx.measureText(title).width > width - 56) {
    titleSize -= 2;
    ctx.font = titleSize + 'px Heebo, Arial, sans-serif';
  }
  ctx.fillText(title, width - 28, 68);
  ctx.font = '20px Heebo, Arial, sans-serif';
  ctx.fillText('שם:', width - 28, 108);
  ctx.strokeStyle = '#22305a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(28, 112);
  ctx.lineTo(width - 90, 112);
  ctx.stroke();
  return SHEET_BASAD_H + SHEET_TITLE_H;
}

function paintMeasuredPage(ctx, items, top, scale) {
  const fit = scale || 1;
  const fullW = ctx.canvas.width;
  const drawW = Math.max(1, Math.round(fullW * fit));
  const x0 = Math.floor((fullW - drawW) / 2);
  let y = top;
  items.forEach((item, itemIndex) => {
    if (itemIndex) y += gapSize(item.slice.gap, fit);
    const dh = Math.max(1, Math.round(item.dh * fit));
    if (item.slice.kind === 'level') {
      ctx.fillStyle = '#22305a';
      ctx.font = Math.max(12, Math.round(22 * fit)) + 'px Heebo, Arial, sans-serif';
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillText(item.slice.label || '', x0 + drawW - 28, y + Math.round(26 * fit));
      y += dh;
      return;
    }
    const pieces = item.slice.pieces && item.slice.pieces.length ? item.slice.pieces : null;
    if (pieces) {
      const rowH = item.slice.box.h || 0.02;
      pieces.forEach((piece) => {
        const box = piece.box;
        const sx = box.x * item.bitmap.width;
        const sy = box.y * item.bitmap.height;
        const sw = Math.max(1, box.w * item.bitmap.width);
        const sh = Math.max(1, box.h * item.bitmap.height);
        const dw = box.w * drawW;
        const ph = (box.h / rowH) * dh;
        const dy = (piece.dy || 0) * dh;
        ctx.drawImage(item.bitmap, sx, sy, sw, sh, x0 + piece.at * drawW, y + dy, dw, ph);
      });
    } else {
      const sx = item.slice.box.x * item.bitmap.width;
      const sy = item.slice.box.y * item.bitmap.height;
      const narrow = item.slice.box.w < 0.5;
      const dx = x0 + (narrow ? item.slice.box.x * drawW : 0);
      const dw = narrow ? item.slice.box.w * drawW : drawW;
      ctx.drawImage(item.bitmap, sx, sy, item.sw, item.sh, dx, y, dw, dh);
      const masks = item.slice.box.masks && item.slice.box.masks.length ? item.slice.box.masks : (item.slice.box.mask ? [item.slice.box.mask] : []);
      masks.forEach((mask) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x0 + mask.x * drawW, y + mask.y * dh, mask.w * drawW, mask.h * dh);
      });
    }
    y += dh;
  });
}

async function paintPacked(root, exerciseMeasured, answerMeasured, title) {
  const OUT_W = 1000;
  const exercisePages = packShort(exerciseMeasured);
  const answerPages = answerMeasured.length ? packShort(answerMeasured, { answers: true }) : [];
  const packs = exercisePages.concat(answerPages);
  const answerStart = exercisePages.length;
  root.innerHTML = packs.map((_, index) => (
    `<figure class="crop-sheet" data-sheet-page="${index + 1}" data-answers="${index >= answerStart ? '1' : '0'}"><canvas></canvas><figcaption>${index >= answerStart ? 'תשובות' : 'דף תרגול'} ${index + 1} מתוך ${packs.length}</figcaption></figure>`
  )).join('');
  const canvases = root.querySelectorAll('canvas');
  if (document.fonts && document.fonts.load) {
    try { await document.fonts.load('28px Heebo'); } catch (error) {}
  }
  packs.forEach((items, index) => {
    const answers = index >= answerStart;
    const room = sheetContentLimit(answers ? 1 : index, !answers);
    const scale = fittedScale(items, room);
    const body = fittedHeight(items, scale);
    const chrome = answers ? SHEET_BASAD_H : (index === 0 ? SHEET_BASAD_H + SHEET_TITLE_H : SHEET_BASAD_H);
    const canvas = canvases[index];
    canvas.width = OUT_W;
    canvas.height = Math.max(chrome + body, 1);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT_W, canvas.height);
    const usedChrome = paintPageChrome(ctx, OUT_W, answers ? 1 : index, packs.length, answers ? 'תשובות' : title);
    paintMeasuredPage(ctx, items, usedChrome, scale);
  });
}

async function paintShort(root, slices) {
  const measured = await measureSlices(slices);
  await paintPacked(root, measured, [], worksheetTitle([]));
}

// One group per source sheet, in first-pick order, so a page never prints twice.
function groupsOf(chosen) {
  const groups = [];
  const bySheet = new Map();
  chosen.forEach((question) => {
    const source = question.source;
    if (!source) return;
    let group = bySheet.get(source.pdfId);
    if (!group) {
      group = { source, questions: [] };
      bySheet.set(source.pdfId, group);
      groups.push(group);
    }
    group.questions.push(question);
  });
  return groups;
}

async function sheetTextLines(source) {
  const pdf = await loadPdf(source);
  const lines = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    content.items.forEach((item) => {
      if (!item.str || !String(item.str).trim()) return;
      const box = textItemBox(item, viewport.width, viewport.height);
      lines.push({
        page: pageNumber,
        y: box.y,
        y2: box.y2,
        x: box.x,
        x2: box.x2,
        text: box.text,
      });
    });
  }
  return lines;
}

async function answerMeasured(groups) {
  const slices = [];
  for (const group of groups) {
    let lines = [];
    try {
      lines = await sheetTextLines(group.source);
    } catch (error) {
      continue;
    }
    const wanted = group.questions.map((question) => ({ q: question.q, part: question.part || '' }));
    const crops = answerCropsFromLines(lines, wanted);
    if (!crops.length) continue;
    const head = lines.find((line) => {
      const text = String(line.text).replace(/\s/g, '');
      return text.startsWith('תשובות') && text.length < 24;
    });
    if (head) {
      slices.push({
        page: head.page,
        pdfId: group.source.pdfId,
        box: { x: 0, y: 0, w: 1, h: 0.02 },
        gap: 8,
        block: 'answers-head:' + group.source.pdfId,
        kind: 'level',
        label: levelPrintName(group.source.level, group.source.levelLabel),
      });
      slices.push({
        page: head.page,
        pdfId: group.source.pdfId,
        box: answerHeadingBox(head),
        gap: 6,
        block: 'answers-head:' + group.source.pdfId,
        kind: 'answer',
      });
    }
    crops.forEach((crop) => {
      slices.push({
        page: crop.page,
        pdfId: group.source.pdfId,
        box: crop.box,
        pieces: crop.pieces,
        gap: 6,
        block: 'answer:' + group.source.pdfId + ':' + crop.q,
        kind: 'answer',
      });
    });
  }
  return measureSlices(slices);
}

async function paintAllShort(root, chosen) {
  const ordered = orderPrintQuestions(chosen.filter((question) => question && question.source));
  const slices = [];
  const groups = [];
  const topicKey = (source) => String(source.grade || '') + ':' + String(source.topicId || source.topic || '');
  const multiTopic = new Set(ordered.map((question) => topicKey(question.source))).size > 1;
  let lastLevel = null;
  batchesOf(ordered).forEach((batch) => {
    const question = batch.questions[0];
    SOURCE = question.source;
    const part = shortSlices(batch.questions);
    if (!part.length) return;
    const known = groups.find((group) => group.source.pdfId === question.source.pdfId);
    if (known) batch.questions.forEach((item) => known.questions.push(item));
    else groups.push({ source: question.source, questions: batch.questions.slice() });
    const heading = topicKey(question.source) + '|' + question.source.level;
    if (heading !== lastLevel) {
      slices.push({
        page: part[0].page,
        pdfId: question.source.pdfId,
        box: { x: 0, y: 0, w: 1, h: 0.02 },
        gap: 8,
        block: part[0].block,
        kind: 'level',
        label: [multiTopic ? question.source.topic : '', levelPrintName(question.source.level, question.source.levelLabel)].filter(Boolean).join(' · '),
      });
      lastLevel = heading;
    }
    part.forEach((slice) => {
      slice.pdfId = slice.pdfId || question.source.pdfId;
      slices.push(slice);
    });
  });
  const exerciseMeasured = await measureSlices(slices);
  const answers = await answerMeasured(groups);
  await paintPacked(root, exerciseMeasured, answers, worksheetTitle(ordered));
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
    const levelName = levelPrintName(source.level, source.levelLabel);
    if (levelName) levels.add(levelName);
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
  const allow = new Set(sameBand(state.selected));
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
  const groups = currentQuestions();
  if (!groups.length) return [];
  return keysOfQuestions(smartQuestionPick(groups, AI_QUESTION_COUNTS[0], value, state.style, []), groups);
}

function elementaryPreset(value) {
  const sheetsHere = topicSheets();
  const want = { first: ['a', 'one'], spiral: ['a', 'b'], practice: ['b'], exam: ['c'] }[value] || ['a', 'one'];
  const picked = sheetsHere.filter((sheet) => want.includes(sheet.level));
  const list = picked.length ? picked : sheetsHere.slice(0, 1);
  return list.map((sheet) => sheetKey(sheet.pdfId));
}

function presetFor(value) {
  if (pilotOn() && SCENARIOS[value]) return wholeQuestions(SCENARIOS[value].selected.map((id) => exKey(FACTORING_PDF, id)));
  if (band() === 'elementary') return elementaryPreset(value);
  return exercisePreset(value);
}

function setFilter(value) {
  state.filter = value;
  ['all', 'selected'].forEach((name) => $('filter-' + name).setAttribute('aria-pressed', value === name ? 'true' : 'false'));
}

function applyScenario(value, options) {
  const quiet = options && options.quiet;
  const before = selectionKey();
  if (!quiet) snapshot();
  state.scenario = value;
  state.lastAiPickCount = 0;
  state.expanded = true;
  setFilter('all');
  // Suggestions follow the lesson goal until the teacher picks; after that the picks are theirs.
  if (value !== 'other' && !state.touched) state.selected = presetFor(value);
  if (selectionKey() !== before) clearPreparedPrint();
  render();
  if (!quiet) announce(value === 'other' ? 'אפשר להוסיף הערה ולבחור מהקטלוג.' : (state.touched ? 'הבחירה שלכם נשמרה.' : 'הוצגו פריטים שכבר קיימים בקטלוג.'));
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
  const run = (async () => {
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
  })();
  topicLoadPromise = run;
  await run;
}

const WIZARD_ORDER = ['grade', 'topic', 'level', 'scenario', 'style', 'pick', 'result'];

function applyWizard() {
  if (!$('wizard-bar')) return;
  const step = WIZARD_ORDER.includes(state.wizard) ? state.wizard : 'grade';
  state.wizard = step;
  document.body.dataset.wizard = step;
  document.querySelectorAll('[data-wiz]').forEach((el) => {
    el.classList.toggle('wiz-off', el.dataset.wiz !== step);
  });
  const setup = $('setup-panel');
  if (setup) setup.classList.toggle('wiz-off', step === 'pick' || step === 'result');
  const labels = {
    grade: 'כיתה',
    topic: 'נושא',
    level: 'רמה',
    scenario: 'מה קורה בשיעור?',
    style: 'איך ניגשים לתרגול?',
    pick: 'בחירת שאלות',
    result: 'הדף להדפסה',
  };
  $('wizard-label').textContent = labels[step];
  $('wizard-back').hidden = WIZARD_ORDER.indexOf(step) <= 0;
  $('wizard-next').hidden = step === 'result';
  $('wizard-next').textContent = step === 'pick' ? 'אל הדף' : 'המשך';
  const anchor = step === 'result' ? $('wizard-result') : $('wizard-bar');
  if (anchor && anchor.scrollIntoView) anchor.scrollIntoView({ block: 'start', inline: 'nearest' });
}

function copyCanvases(from, to) {
  to.replaceChildren();
  from.querySelectorAll('canvas').forEach((canvas) => {
    const figure = document.createElement('figure');
    figure.className = 'crop-sheet';
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext('2d').drawImage(canvas, 0, 0);
    figure.appendChild(copy);
    to.appendChild(figure);
  });
}

async function showWizardResult() {
  const preview = $('wizard-preview');
  if (!preview) return;
  if (!state.selected.length) {
    announce(band() === 'elementary' ? 'עדיין לא נבחר דף.' : 'עדיין לא נבחרו שאלות.');
    state.wizard = 'pick';
    applyWizard();
    return;
  }
  preview.textContent = 'מכינים את הדף…';
  printMode = band() === 'elementary' ? 'marked' : 'short';
  try {
    await updatePrint();
    copyCanvases($('print-area'), preview);
    const anchor = $('wizard-result');
    if (anchor && anchor.scrollIntoView) anchor.scrollIntoView({ block: 'start', inline: 'nearest' });
  } catch (error) {
    preview.textContent = 'דף המקור לא נטען, ולכן אין הדפסה.';
  }
}

function bind() {
  $('questions').addEventListener('change', (event) => {
    const box = event.target;
    if (box.matches('[data-question]')) selectQuestion(box.dataset.question, box.checked);
    if (box.matches('[data-sheet]')) selectKey(box.dataset.sheet, box.checked);
  });
  document.querySelectorAll('[name=scenario]').forEach((el) => el.addEventListener('change', () => {
    if (el.checked) applyScenario(el.value);
  }));
  document.querySelectorAll('[name=style]').forEach((el) => el.addEventListener('change', () => {
    if (!el.checked) return;
    state.style = el.value;
    if (!state.touched && band() === 'middle' && state.scenario !== 'other') applyScenario(state.scenario, { quiet: true });
    else render();
  }));
  document.querySelectorAll('[name=level]').forEach((el) => el.addEventListener('change', () => {
    if (!el.checked) return;
    state.level = el.value;
    state.expanded = true;
    // The level only changes what is shown. Picks the teacher made stay, and still print.
    if (state.touched) {
      render();
      return;
    }
    let next = wholeQuestions(keepVisible(state.selected, visibleSelectionKeys()));
    if (!next.length && state.scenario !== 'other') {
      if (pilotOn() && SCENARIOS[state.scenario]) next = wholeQuestions(SCENARIOS[state.scenario].selected.map((id) => exKey(FACTORING_PDF, id)));
      else if (band() === 'elementary') next = elementaryPreset(state.scenario);
      else next = exercisePreset(state.scenario);
    }
    if (next.join('\n') !== selectionKey()) {
      snapshot();
      state.selected = next;
      state.lastAiPickCount = 0;
      clearPreparedPrint();
    }
    render();
  }));
  $('grade').addEventListener('change', async () => {
    const before = band();
    state.grade = $('grade').value;
    state.level = 'all';
    state.expanded = true;
    // Elementary sheets and middle-school questions print differently, so they never share one sheet.
    if (band() !== before) {
      state.selected = [];
      state.touched = false;
      state.addingTopic = false;
      history = [];
    } else if (!state.touched && !state.addingTopic) {
      state.selected = [];
      history = [];
    }
    setFilter('all');
    state.topic = '';
    clearPreparedPrint();
    fillTopics();
    await loadCurrentTopic();
    if (state.selected.length) render();
    else applyScenario(state.scenario === 'other' ? 'first' : state.scenario);
  });
  $('topic').addEventListener('change', async () => {
    state.topic = $('topic').value;
    state.level = 'all';
    state.expanded = true;
    if (!state.touched && !state.addingTopic) {
      state.selected = [];
      history = [];
    }
    setFilter('all');
    clearPreparedPrint();
    syncLevels();
    await loadCurrentTopic();
    if (state.scenario === 'other' || state.selected.length) render();
    else applyScenario(state.scenario, { quiet: true });
  });
  if ($('add-topic')) $('add-topic').addEventListener('click', () => {
    state.addingTopic = true;
    state.touched = true;
    setFilter('all');
    state.wizard = 'topic';
    applyWizard();
    announce('הבחירה נשמרת. בוחרים נושא נוסף.');
  });
  $('filter-all').addEventListener('click', () => { setFilter('all'); render(); });
  $('filter-selected').addEventListener('click', () => { setFilter('selected'); render(); });
  if ($('clear-sheet')) $('clear-sheet').addEventListener('click', () => {
    if (!state.selected.length) return;
    snapshot();
    state.selected = [];
    state.touched = false;
    state.lastAiPickCount = 0;
    clearPreparedPrint();
    render();
    announce('הבחירה נוקתה. אפשר להתחיל דף חדש, וגם לבטל.');
  });
  document.querySelectorAll('[data-ai-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pickWithAi(Number(btn.dataset.aiPick));
    });
  });
  $('show-more').addEventListener('click', () => { state.expanded = true; render(); });
  $('undo').addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    const before = selectionKey();
    state.selected = sameBand(previous);
    state.touched = true;
    state.lastAiPickCount = 0;
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
  if ($('wizard-next')) $('wizard-next').addEventListener('click', async () => {
    const index = WIZARD_ORDER.indexOf(state.wizard || 'grade');
    state.wizard = WIZARD_ORDER[Math.min(WIZARD_ORDER.length - 1, index + 1)];
    if (state.addingTopic && (state.wizard === 'scenario' || state.wizard === 'style')) state.wizard = 'pick';
    if (state.wizard === 'pick') {
      state.addingTopic = false;
      if (topicLoadPromise) await topicLoadPromise;
      if (!state.selected.length && state.scenario !== 'other') {
        applyScenario(state.scenario, { quiet: true });
        return;
      }
      render();
    }
    applyWizard();
    if (state.wizard === 'result') await showWizardResult();
  });
  if ($('wizard-back')) $('wizard-back').addEventListener('click', () => {
    const index = WIZARD_ORDER.indexOf(state.wizard || 'grade');
    state.wizard = WIZARD_ORDER[Math.max(0, index - 1)];
    applyWizard();
  });
  if ($('wizard-print')) $('wizard-print').addEventListener('click', async () => {
    try { await updatePrint(); } catch (error) { announce('דף המקור לא נטען.'); return; }
    window.print();
  });
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
  document.addEventListener('noam-teacher-prefill', (event) => {
    const detail = event.detail || {};
    const prefill = detail.exerciseIds ? detail : wizardPrefillFromSearch(detail.href || '');
    applyWizardPrefill(prefill);
  });
}

function applyWizardPrefill(prefill) {
  if (!prefill || !prefill.grade || !prefill.topic) return;
  const beforeBand = CATALOG ? band() : '';
  if (state.selected.length) snapshot();
  state.grade = String(prefill.grade);
  state.topic = String(prefill.topic);
  state.level = prefill.level || 'all';
  state.scenario = 'other';
  state.expanded = true;
  fillGrades();
  fillTopics();
  return loadCurrentTopic().then(() => {
    const allow = new Set(visibleSelectionKeys());
    const ids = prefill.exerciseIds || [];
    if (beforeBand && band() !== beforeBand) history = [];
    state.selected = wholeQuestions(ids.filter((id) => allow.has(id)));
    state.touched = true;
    state.addingTopic = false;
    state.lastAiPickCount = 0;
    const note = $('teacher-note');
    if (note && prefill.minutes && !note.value) note.value = 'אורך שיעור: ' + prefill.minutes + ' דקות';
    render();
    state.wizard = 'pick';
    applyWizard();
    announce('הבחירה מנועם AI נטענה לאשף.');
    const picked = document.querySelector('#questions input:checked');
    const card = picked && picked.closest('.q-card');
    if (card && typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({ block: 'start', inline: 'nearest' });
    }
  });
}

async function start() {
  installSuggest();
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error('CATALOG');
  CATALOG = await response.json();
  indexCatalog();
  bind();
  const prefill = wizardPrefillFromSearch(location.search);
  if (prefill) {
    await applyWizardPrefill(prefill);
    return;
  }
  fillGrades();
  fillTopics();
  await loadCurrentTopic();
  applyScenario(state.scenario, { quiet: true });
}

start().catch(() => {
  $('result-summary').textContent = 'רשימת דפי הקטלוג לא נטענה.';
});
