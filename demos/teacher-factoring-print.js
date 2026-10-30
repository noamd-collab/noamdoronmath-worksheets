import { requestTeacherHumanVerification } from './teacher-human-verification.js';
import { wizardPrefillFromSearch } from './wizard-prefill.js';
import { expandToWholeQuestionKeys, groupWholeQuestions, mulberry32, pickWholeQuestions, randomSeed } from './teacher-question-pick.js';
import { PICK_HEADING, SECTION_KINDS, needsSectionHeadings, pointsLabel, scoreLabel, sectionKind, sectionTitle, shouldAskMoreTopic, testPoints, TEST_TOTAL_POINTS } from './teacher-page-sections.js';

/* Teacher picker for every catalog sheet, grades 1–9.
   Choose complete source questions across topic and level sheets.
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
const previewManifests = new Map();
let previewObserver = null;
const previewQueue = [];
let previewRunning = false;
let state = {
  scenario: 'first',
  style: 'scaffold',
  selected: [],
  filter: 'all',
  expanded: false,
  grade: '9',
  topic: '2',
  level: 'all',
  wizard: 'grade',
  lastQuestionCount: 5,
  lastAiPickCount: 0,
  pickMode: 'manual',
  pickNote: '',
  blocks: [],
  sectionKind: 'review',
  moreDismissed: false,
};
let history = [];
let rendering = false;
let printMode = 'marked';
let printOpener = null;
let loadToken = 0;
let topicLoadPromise = null;
let aiPickPending = 0;
let teacherBotClientPromise = null;
let teacherAiPlanCache = null;
function exKey(pdfId, id) {
  return 'ex:' + pdfId + ':' + id;
}

function ensureTeacherBotClient() {
  if (teacherBotClientPromise) return teacherBotClientPromise;
  teacherBotClientPromise = new Promise((resolve, reject) => {
    function finish(ok) {
      if (ok && window.NoamBotClient && window.NoamBotClient.version === '20261030-human-stepup' && typeof window.NoamBotClient.create === 'function') {
        resolve(window.NoamBotClient.create({ api: '/api', enabled: true, modelTimeoutMs: 25000 }));
        return;
      }
      reject(new Error('BOT_CLIENT_UNAVAILABLE'));
    }
    if (window.NoamBotClient && window.NoamBotClient.version === '20261030-human-stepup') {
      finish(true);
      return;
    }
    const loader = document.createElement('script');
    loader.src = '/noam-bot-client.js?v=20261030-human-stepup';
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

function questionPreviewGroup(group) {
  if (group.parts && group.source && group.q != null) return group;
  const parts = group.questions || [];
  return { ...group, q: group.number, source: parts[0] && parts[0].source,
    parts, keys: [...new Set(parts.map((question) => exKey(question.source.pdfId, question.id)))], index: group.order };
}

function currentQuestions() {
  const groups = groupWholeQuestions(currentExercises()).map(questionPreviewGroup);
  const perSheet = new Map();
  groups.forEach((group) => {
    if (!perSheet.has(group.pdfId)) perSheet.set(group.pdfId, []);
    perSheet.get(group.pdfId).push(group);
  });
  perSheet.forEach((list) => list.forEach((group, rank) => {
    const at = rank / list.length;
    group.role = at < 1 / 3 ? 'basis' : at < 2 / 3 ? 'review' : 'creative';
  }));
  return groups;
}

function keysOfQuestions(keys, groups) {
  const wanted = new Set(keys);
  return [...new Set(groups.filter((group) => wanted.has(group.key)).flatMap((group) => group.keys))];
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

function teacherAiNote() {
  return $('teacher-note') ? String($('teacher-note').value || '').trim().slice(0, 400) : '';
}

function teacherAiContext(groups, saved) {
  return JSON.stringify({
    grade: String(state.grade), topic: String(state.topic), level: String(state.level || 'all'),
    goal: String(state.scenario), style: String(state.style), note: teacherAiNote(),
    candidates: planOrder(groups, state.scenario, state.style).map((group) => ({
      id: (/^(?:[abc]|c2)$/.test(String(group.source && group.source.level)) ? group.source.level + ':' : '') + group.parts[0].id,
      key: group.key, keys: group.keys, role: group.role,
      pdfId: group.pdfId, level: group.source && group.source.level,
      sourceSha256: group.source && group.source.sourceSha256 || '',
    })),
    blocks: state.blocks, excluded: [...saved].sort(),
  });
}

// A reusable plan must contain one explicit, valid model choice per whole
// question. Never turn a larger plan, partial result or local fill into a plan.
function verifiedTeacherPlan(plan, groups, count) {
  const target = Math.min(count, groups.length);
  if (!plan || plan.source !== 'classifier' || typeof plan.model !== 'string' || !plan.model.trim()) return null;
  const ids = plan.exerciseIds, modelIds = plan.modelExerciseIds;
  if (!Array.isArray(ids) || !Array.isArray(modelIds) || ids.length !== target || modelIds.length !== target || !target) return null;
  if (ids.some((id) => typeof id !== 'string') || modelIds.some((id) => typeof id !== 'string')) return null;
  const declared = new Set(ids);
  if (declared.size !== target || new Set(modelIds).size !== target || modelIds.some((id) => !declared.has(id))) return null;
  const owner = new Map();
  groups.forEach((group) => group.keys.forEach((key) => owner.set(key, group.key)));
  const questionKeys = modelIds.map((id) => owner.get(id));
  if (questionKeys.some((key) => !key) || new Set(questionKeys).size !== target) return null;
  return { source: 'classifier', model: plan.model, exerciseIds: ids.slice(), modelExerciseIds: modelIds.slice(), questionKeys };
}

function rememberTeacherPlans(result, context, groups) {
  if (!result || result.source !== 'classifier' || !result.model || !result.teacherPlans || typeof result.teacherPlans !== 'object') return;
  if (!teacherAiPlanCache || teacherAiPlanCache.context !== context) teacherAiPlanCache = { context, plans: {} };
  AI_QUESTION_COUNTS.forEach((count) => {
    const verified = verifiedTeacherPlan(result.teacherPlans[String(count)], groups, count);
    if (verified) teacherAiPlanCache.plans[String(count)] = verified;
  });
}

async function pickWithAi(rawCount) {
  const count = Number(rawCount);
  if (!AI_QUESTION_COUNTS.includes(count) || aiPickPending) return [];
  const saved = carriedKeys();
  const groups = currentQuestions().filter((group) => !group.keys.some((key) => saved.has(key)));
  if (!groups.length) return [];
  const target = Math.min(count, groups.length);
  const context = teacherAiContext(groups, saved);
  if (teacherAiPlanCache && teacherAiPlanCache.context !== context) teacherAiPlanCache = null;
  const preparedPlan = teacherAiPlanCache && verifiedTeacherPlan(teacherAiPlanCache.plans[String(count)], groups, count);
  const beforeRequest = selectionKey();
  const beforeBlocks = JSON.stringify(state.blocks);
  aiPickPending = count;
  paintAiPickButtons();
  const status = $('ai-suggest-status');
  if (status) status.textContent = preparedPlan ? 'מיישמים את בחירת ה-AI שהוכנה…' : `נועם AI בוחר ${target} שאלות…`;
  const gradeEl = $('grade');
  const topicEl = $('topic');
  const payload = {
    message: `בחר ${target} שאלות שלמות עם AI. כל מזהה ברשימה הוא שאלה שלמה עם כל הסעיפים שלה. בכל רמה: ביסוס בהתחלה, חזרה באמצע, שאלות יצירתיות בסוף.`,
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
      note: teacherAiNote(),
      count: target,
      planCounts: AI_QUESTION_COUNTS.slice(),
      // Include every available question; ordering guides the lesson without excluding candidates.
      candidates: planOrder(groups, state.scenario, state.style).map((group) => ({
        id: (/^(?:[abc]|c2)$/.test(String(group.source && group.source.level)) ? group.source.level + ':' : '') + group.parts[0].id,
        label: group.parts[0].id,
        text: [QUESTION_ROLES[group.role], group.source.levelLabel, 'שאלה ' + group.q, group.keys.length + ' סעיפים'].filter(Boolean).join(' · ').slice(0, 80),
      })),
    },
  };
  let seedKeys = [];
  let fromModel = false;
  let result = preparedPlan;
  let requestError = null, awaitingHuman = false, humanWaitStartedAt = 0, humanWaitMs = 0;
  const requestStillCurrent = () => {
    const savedNow = carriedKeys();
    const groupsNow = currentQuestions().filter((group) => !group.keys.some((key) => savedNow.has(key)));
    return teacherAiContext(groupsNow, savedNow) === context && selectionKey() === beforeRequest && JSON.stringify(state.blocks) === beforeBlocks;
  };
  const startedAt = Date.now();
  const timer = preparedPlan ? null : globalThis.setInterval(() => {
    if (status && !awaitingHuman) status.textContent = `נועם AI בוחר ${target} שאלות… (${Math.floor((Date.now() - startedAt - humanWaitMs) / 1000)} שניות)`;
  }, 1000);
  try {
    if (!preparedPlan) {
      const client = await ensureTeacherBotClient();
      result = await client.postJson('/api/noamSiteCompanion', payload, {
        onChallenge: (challenge) => {
          awaitingHuman = true;
          humanWaitStartedAt = Date.now();
          if (status) status.textContent = 'נדרש אימות אנושי. הבחירה שלכם נשמרה.';
          return requestTeacherHumanVerification({
            challenge, client, anchor: status, isCurrent: requestStillCurrent,
            onSubmitting: () => {
              humanWaitMs += Date.now() - humanWaitStartedAt;
              awaitingHuman = false;
              if (status) status.textContent = 'האימות הושלם. נועם AI בוחר שאלות…';
            },
          });
        },
      });
    }
    fromModel = Boolean(result && ['classifier', 'mixed'].includes(result.source) && result.model);
    const modelIds = result && (Array.isArray(result.modelExerciseIds) ? result.modelExerciseIds : result.source === 'classifier' ? result.exerciseIds : []);
    if (fromModel && Array.isArray(modelIds) && modelIds.length) {
      // The teacher's note may deliberately request another part of the sheet.
      // Preserve valid model choices; never silently replace them with a role preset.
      const owner = new Map();
      groups.forEach((group) => group.keys.forEach((key) => owner.set(key, group)));
      seedKeys = Array.from(new Set(modelIds.map((key) => owner.get(key)).filter(Boolean).map((group) => group.key))).slice(0, target);
    }
  } catch (error) {
    requestError = error;
    seedKeys = [];
  } finally {
    if (timer !== null) globalThis.clearInterval(timer);
    aiPickPending = 0;
  }
  const nowSaved = carriedKeys();
  const nowGroups = currentQuestions().filter((group) => !group.keys.some((key) => nowSaved.has(key)));
  if (teacherAiContext(nowGroups, nowSaved) !== context || selectionKey() !== beforeRequest || JSON.stringify(state.blocks) !== beforeBlocks) {
    paintAiPickButtons();
    if (status) status.textContent = 'הנושא או הבחירה השתנו בזמן שה-AI עבד. הבחירה שלכם נשמרה; אפשר לבקש שוב.';
    return [];
  }
  if (requestError) {
    paintAiPickButtons();
    const code = String(requestError.code || '');
    const message = code === 'BOT_STEP_UP_REQUIRED'
      ? 'נדרש אימות אנושי, אך הוא לא זמין כרגע. הבחירה שלכם נשמרה ואפשר להמשיך לבחור ידנית.'
      : code === 'BOT_CHALLENGE_CANCELLED' || code === 'BOT_CHALLENGE_EXPIRED' || code === 'BOT_CHALLENGE_CONTEXT_CHANGED'
        ? requestError.message
        : requestError.status === 429 || requestError.httpStatus === 429
          ? 'יש כרגע הגבלת בקשות. הבחירה שלכם נשמרה; נסו שוב מאוחר יותר.'
          : requestError.status === 403 || requestError.httpStatus === 403 || /^BOT_/.test(code)
            ? 'בדיקת האבטחה לא אישרה את בקשת ה-AI. הבחירה שלכם נשמרה ואפשר להמשיך לבחור ידנית.'
            : 'לא התקבלה בחירת AI. הבחירה שלכם נשמרה; אפשר לנסות שוב או לבחור ידנית.';
    if (status) status.textContent = message;
    announce(message);
    return [];
  }
  if (!fromModel || !seedKeys.length) {
    paintAiPickButtons();
    const message = 'לא התקבלה בחירת שאלות מה-AI. הבחירה שלכם נשמרה ואפשר לבחור ידנית.';
    if (status) status.textContent = message;
    announce(message);
    return [];
  }
  if (!preparedPlan) rememberTeacherPlans(result, context, groups);
  const exactPlan = teacherAiPlanCache && verifiedTeacherPlan(teacherAiPlanCache.plans[String(count)], groups, count);
  if (exactPlan) {
    seedKeys = exactPlan.questionKeys;
    fromModel = true;
  }
  const pickedGroups = smartQuestionPick(groups, target, state.scenario, state.style, seedKeys);
  const finalPicked = keysOfQuestions(pickedGroups, groups);
  const before = selectionKey();
  snapshot();
  state.selected = finalPicked;
  state.pickMode = 'manual';
  state.filter = 'all';
  state.pickNote = groups.length < count ? `התבקשו ${count} שאלות, אך בנושא וברמה האלה זמינות רק ${groups.length}; כולן נבחרו.` : '';
  $('filter-all').setAttribute('aria-pressed', 'true');
  $('filter-selected').setAttribute('aria-pressed', 'false');
  state.lastAiPickCount = count;
  state.expanded = true;
  if (selectionKey() !== before) clearPreparedPrint();
  render();
  const what = `${pickedGroups.length} שאלות (${finalPicked.length} סעיפים)`;
  const modelCount = fromModel ? seedKeys.length : 0;
  const outcome = modelCount === pickedGroups.length
    ? `נבחרו ${what} עם AI.`
    : modelCount > 0
      ? `נבחרו ${what}: ${modelCount} עם AI, והשאר הושלמו בבחירה מקומית.`
      : `נבחרו ${what} בבחירה אוטומטית מקומית. לא התקבלה בחירה מתאימה מה-AI.`;
  const msg = outcome + (preparedPlan ? ' זו הבחירה שהוכנה בבקשת ה-AI הקודמת.' : '') + (state.pickNote ? ' ' + state.pickNote : '');
  if (status) status.textContent = msg;
  announce(msg);
  return finalPicked;
}

function paintAiPickButtons() {
  const group = $('ai-pick-group');
  if (!group) return;
  group.hidden = false;
  const status = $('ai-suggest-status');
  if (status) status.hidden = false;
  const saved = carriedKeys();
  const groups = currentQuestions().filter((item) => !item.keys.some((key) => saved.has(key)));
  const total = groups.length;
  const availability = $('ai-available-note');
  if (availability) {
    availability.hidden = total >= 15 || total === 0;
    availability.textContent = total > 0 && total < 15
      ? `בנושא וברמה האלה זמינות ${total} שאלות לבחירה. בקשה לכמות גדולה יותר תבחר את כולן.` : '';
  }
  const picked = groups.filter((item) => item.keys.every((key) => state.selected.includes(key))).length;
  group.querySelectorAll('[data-ai-pick]').forEach((btn) => {
    const count = Number(btn.dataset.aiPick);
    const busy = aiPickPending === count;
    const baseLabel = count === AI_QUESTION_COUNTS[0] ? `בחר ${count} שאלות עם AI` : `בחר ${count}`;
    btn.textContent = busy ? `בוחר ${count}…` : baseLabel;
    btn.disabled = total === 0 || aiPickPending > 0;
    btn.title = total > 0 && total < count ? `זמינות ${total} שאלות; כולן ייבחרו.` : `בחירת ${count} שאלות עם AI`;
    const active = total > 0 && state.lastAiPickCount === count && picked === Math.min(count, total);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (busy) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
  });
}

function assignWholeQuestions(count, random) {
  const result = pickWholeQuestions(currentExercises(), count, random || Math.random);
  state.lastQuestionCount = count;
  state.pickNote = result.note;
  return result.keys;
}

function pickQuestionCount(count) {
  const result = pickWholeQuestions(currentExercises(), count, mulberry32(randomSeed()));
  const before = selectionKey();
  snapshot();
  state.selected = result.keys;
  state.lastQuestionCount = count;
  state.pickNote = result.note;
  state.expanded = true;
  if (selectionKey() !== before) clearPreparedPrint();
  render();
  const msg = result.note || `נבחרו ${result.questionCount} שאלות שלמות.`;
  announce(msg);
  return result.keys;
}

function paintQuestionCountButtons() {
  const manual = state.pickMode === 'manual';
  const modes = $('pick-mode-group');
  if (modes) {
    modes.hidden = false;
    modes.querySelectorAll('[data-pick-mode]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.pickMode === state.pickMode ? 'true' : 'false');
    });
  }
  const group = $('question-count-group');
  if (group) group.hidden = manual;
  const browseAll = document.getElementById('filter-all');
  const browse = browseAll && browseAll.parentElement;
  if (browse) browse.hidden = false;
  const heading = document.querySelector('.list-header > span');
  if (heading) heading.textContent = PICK_HEADING;
  const note = $('pick-shortfall');
  if (note) {
    note.hidden = !state.pickNote;
    note.textContent = state.pickNote || '';
  }
  if (!group) return;
  const total = groupWholeQuestions(currentExercises()).length;
  group.querySelectorAll('[data-question-count]').forEach((btn) => {
    const count = Number(btn.dataset.questionCount);
    btn.disabled = manual || total === 0;
    const active = !manual && state.lastQuestionCount === count && state.selected.length > 0;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function allSelectedKeys() {
  const keys = [];
  state.blocks.forEach((block) => block.keys.forEach((key) => { if (!keys.includes(key)) keys.push(key); }));
  state.selected.forEach((key) => { if (!keys.includes(key)) keys.push(key); });
  return keys;
}

function blockQuestionCount(keys) {
  return groupWholeQuestions(keys.map((key) => library.get(key)).filter(Boolean)).length;
}

function sectionToggleHTML(kind, attr) {
  return Object.entries(SECTION_KINDS).map(([value, info]) => (
    `<button type="button" class="question-count-btn section-kind-btn" ${attr}="${value}" aria-pressed="${kind === value ? 'true' : 'false'}">${escapeHTML(info.label)}</button>`
  )).join('');
}

function questionCountText(count) {
  return count === 1 ? 'שאלה אחת' : `${count} שאלות`;
}

function paintPageBuilder() {
  const group = $('section-kind-group');
  if (group) {
    group.hidden = false;
    group.querySelectorAll('[data-section-kind]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.sectionKind === state.sectionKind ? 'true' : 'false');
    });
    const help = $('section-kind-help');
    if (help) help.textContent = SECTION_KINDS[sectionKind(state.sectionKind)].help;
  }
  const prompt = $('more-topic');
  if (prompt) prompt.hidden = !shouldAskMoreTopic(blockQuestionCount(state.selected), state.moreDismissed);
  const list = $('page-blocks');
  if (!list) return;
  list.hidden = !state.blocks.length;
  list.innerHTML = state.blocks.map((block, index) => (
    `<div class="page-block" data-page-block="${index}"><strong>${escapeHTML(block.title)} · ${questionCountText(blockQuestionCount(block.keys))}</strong>${sectionToggleHTML(block.kind, 'data-block-kind')}<button type="button" class="text-btn" data-block-remove aria-label="${escapeHTML('הסרת ' + block.title + ' מהדף')}">הסרה מהדף</button></div>`
  )).join('');
}

function addAnotherTopic() {
  const saved = carriedKeys();
  state.selected = state.selected.filter((key) => !saved.has(key));
  if (!state.selected.length) return;
  const topic = currentTopic();
  state.blocks.push({
    grade: state.grade,
    topic: state.topic,
    title: topic ? topic.title : '',
    kind: sectionKind(state.sectionKind),
    keys: state.selected.slice(),
  });
  state.selected = [];
  state.moreDismissed = false;
  state.pickNote = '';
  history = [];
  clearPreparedPrint();
  state.wizard = 'topic';
  render();
  announce('השאלות נשמרו בדף. בוחרים נושא נוסף.');
  const select = $('topic');
  if (select && select.focus) select.focus();
}

function pageNeedsSections() {
  return state.blocks.length > 0 || state.sectionKind === 'test';
}

function pageBlocks() {
  const blocks = state.blocks.map((block) => ({
    kind: sectionKind(block.kind),
    title: block.title,
    questions: questionsForKeys(block.keys, block),
  }));
  return blocks;
}

function carriedKeys() {
  return new Set(state.blocks.flatMap((block) => block.keys));
}

function toggleWholeQuestion(groupKey, on) {
  const group = groupWholeQuestions(currentExercises()).find((item) => item.key === groupKey);
  if (!group) return;
  const keys = group.questions.map((question) => exKey(question.source.pdfId, question.id));
  if (on && keys.some((key) => carriedKeys().has(key))) {
    announce('השאלה כבר בדף, בנושא שנשמר קודם.');
    render();
    return;
  }
  const before = selectionKey();
  snapshot();
  state.pickNote = '';
  state.lastAiPickCount = 0;
  if ($('ai-suggest-status')) $('ai-suggest-status').textContent = 'הבחירה עודכנה ידנית. אפשר לתת ל-AI לבחור מחדש.';
  if (on) {
    keys.forEach((key) => {
      if (!state.selected.includes(key)) state.selected.push(key);
    });
  } else {
    const drop = new Set(keys);
    state.selected = state.selected.filter((key) => !drop.has(key));
  }
  if (selectionKey() !== before) clearPreparedPrint();
  render();
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
  if (status) status.textContent = 'בחרו ידנית או תנו ל-AI לבחור 5, 10 או 15 שאלות. אפשר לשנות את הבחירה גם אחר כך.';
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
  const matching = topic.sheets.filter((sheet) => sheet.level === state.level || (state.level === 'c' && sheet.level === 'c2'));
  return matching.length ? matching : topic.sheets;
}

function syncLevels() {
  const topic = currentTopic();
  const levels = new Set((topic ? topic.sheets : []).map((sheet) => sheet.level === 'c2' ? 'c' : sheet.level));
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
  return [...new Set(currentExercises().map((question) => exKey(question.source.pdfId, question.id)))];
}

function keepVisible(selected, visible) {
  const allow = new Set(visible);
  return [...new Set(selected.filter((key) => allow.has(key)))];
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
  syncLevels();
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

function questionCard(group, picked) {
  group = questionPreviewGroup(group);
  const parts = [...new Set(group.parts.map((question) => question.part || String(question.id).replace(/^\d+/, '')).filter(Boolean))];
  const partsText = parts.length > 1 ? `${parts.length} סעיפים (${parts.join(', ')})` : (parts.length === 1 ? 'סעיף אחד' : 'בלי סעיפים');
  const pages = Array.from(new Set(group.parts.flatMap((question) => [question.page, ...(question.rows || []).map((row) => row.page || question.page)]).filter(Boolean))).sort((a, b) => a - b);
  const pageText = pages.length > 1 ? `עמודים ${pages[0]}–${pages[pages.length - 1]}` : (pages.length ? `עמוד ${pages[0]}` : '');
  const levelLabel = group.source.levelLabel || '';
  const manifest = previewManifests.get(group.source.pdfId);
  const contextQuestions = [...new Set((manifest && manifest.exercises || []).filter((item) => String(item.q) === String(group.q)).flatMap((item) => item.contextQuestionNumbers || []))];
  const contextLabel = contextQuestions.length ? 'כולל נתונים משאלה ' + contextQuestions.join(', ') : '';
  const meta = [levelLabel, partsText, pageText, contextLabel].filter(Boolean).join(' · ');
  const role = QUESTION_ROLES[group.role] || '';
  // Reserve the full A4 crop height before its bitmap loads, so scrolling to a
  // checkbox does not move it when earlier questions finish rendering.
  let previewHeight = 140;
  if (manifest && manifest.exercises) {
    try {
      const slices = questionPreviewSlices(group, manifest);
      previewHeight = slices.reduce((height, slice, index) => height + Math.round(1000 * Math.SQRT2 * slice.box.h / slice.box.w) + (index ? slice.gap : 0), 0) || previewHeight;
    } catch (error) { /* The preview supplies a retry and source link. */ }
  }
  return `<article class="q-card q-card-whole q-card-pick q-group"><label class="q-select"><input type="checkbox" data-whole-question="${escapeHTML(group.key)}" ${picked ? 'checked' : ''} aria-label="בחירת שאלה ${escapeHTML(group.q)}${levelLabel ? ' ' + escapeHTML(levelLabel) : ''}"><span class="q-content"><span class="q-title-line"><span class="q-title">שאלה ${escapeHTML(group.q)}</span>${role ? `<span class="badge role-${group.role}">${role}</span>` : ''}</span><span class="q-page" style="display:block">${escapeHTML(meta)}</span></span></label><div class="q-preview" data-preview-key="${escapeHTML(group.key)}" aria-busy="true"><div class="q-preview-scroll q-preview-placeholder" style="aspect-ratio:1000/${previewHeight}"><p class="q-preview-loading">טוענים את השאלה המלאה מדף המקור…</p></div><button type="button" class="q-preview-zoom" disabled>הגדלת השאלה</button><a class="q-source-link" href="${escapeHTML(group.source.pdfUrl)}#page=${group.parts[0].page}" target="_blank" rel="noopener">פתיחת דף המקור</a></div></article>`;
}

// The manifest's crops enclose the WHOLE question, including its instruction,
// drawing and every continuation. Per-part print rows can end inside a final
// wrapped sentence, so they must never be used for the selection preview.
function questionPreviewSlices(group, manifest) {
  group = questionPreviewGroup(group);
  const pages = new Map();
  const exactWhole = Boolean(manifest.wholeQuestionGeometry || group.source.wholeQuestionGeometry);
  const exactSlices = [];
  const exercises = (manifest.exercises || []).filter((item) => String(item.q) === String(group.q));
  const cropsOf = (item) => item.crops && item.crops.length ? item.crops : (item.crop ? [item.crop] : []);
  const crops = exercises.flatMap(cropsOf);
  const pins = exercises.map((item) => item.pin).filter(Boolean);
  const context = new Set(exercises.flatMap((item) => item.contextQuestionNumbers || []).map(Number));
  const covers = (crop, pin) => crop.page === pin.page && pin.x >= crop.x && pin.x <= crop.x + crop.w && pin.y >= crop.y && pin.y <= crop.y + crop.h;
  const sameCrop = (a, b) => a.page === b.page && ['x', 'y', 'w', 'h'].every((key) => Math.abs(a[key] - b[key]) < 0.000001);
  const earlier = (manifest.exercises || []).filter((item) => Number(item.q) < Number(group.q) && !context.has(Number(item.q)) && item.pin);
  // Some legacy manifests prepend an unrelated previous question. Drop only
  // an exact copy owned by that earlier question; preserve requested context,
  // unlabelled diagrams/instructions and all crops needed by current parts.
  const ownCrops = crops.filter((crop) => pins.some((pin) => covers(crop, pin))
    || !earlier.some((item) => covers(crop, item.pin) && cropsOf(item).some((other) => sameCrop(crop, other))));
  const complete = pins.length && pins.every((pin) => ownCrops.some((crop) => covers(crop, pin)));
  for (const crop of exactWhole ? crops : complete ? ownCrops : crops) {
      const { page, x, y, w, h } = crop;
      if (!Number.isInteger(page) || page < 1 || ![x, y, w, h].every(Number.isFinite)
        || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) {
        throw new Error('QUESTION_PREVIEW_BOUNDS');
      }
      if (exactWhole) {
        // A shared legend and the question can be separated by other questions
        // on the same page. Keep their exact crops instead of enclosing the gap.
        if (!exactSlices.some((slice) => sameCrop({ ...slice.box, page: slice.page }, crop))) {
          exactSlices.push({ page, pdfId: group.source.pdfId, block: group.key, kind: 'row', gap: 12, box: { x, y, w, h } });
        }
        continue;
      }
      const previous = pages.get(page);
      pages.set(page, previous ? {
        x: Math.min(previous.x, x), y: Math.min(previous.y, y),
        right: Math.max(previous.right, x + w), bottom: Math.max(previous.bottom, y + h),
      } : { x, y, right: x + w, bottom: y + h });
  }
  if (exactWhole) return exactSlices;
  return [...pages].sort(([a], [b]) => a - b).map(([page, box]) => ({
    page, pdfId: group.source.pdfId, block: group.key, kind: 'row', gap: 12,
    box: { x: box.x, y: box.y, w: Math.min(1, box.right) - box.x, h: Math.min(1, box.bottom) - box.y },
  }));
}

async function loadQuestionPreviewManifest(source) {
  if (previewManifests.has(source.pdfId)) return previewManifests.get(source.pdfId);
  const loading = (async () => {
    const response = await fetch('/api/teacherQuestionManifest?pdfId=' + encodeURIComponent(source.pdfId));
    if (!response.ok) throw new Error('QUESTION_PREVIEW_MANIFEST');
    const manifest = await response.json();
    if (source.sourceSha256 && manifest.sourceSha256 && source.sourceSha256 !== manifest.sourceSha256) {
      throw new Error('QUESTION_PREVIEW_SOURCE_MISMATCH');
    }
    return manifest;
  })();
  previewManifests.set(source.pdfId, loading);
  try {
    const manifest = await loading;
    previewManifests.set(source.pdfId, manifest);
    return manifest;
  } catch (error) {
    previewManifests.delete(source.pdfId);
    throw error;
  }
}

async function questionPreviewCanvas(group) {
  group = questionPreviewGroup(group);
  const manifest = await loadQuestionPreviewManifest(group.source);
  const slices = questionPreviewSlices(group, manifest);
  if (!slices.length) throw new Error('QUESTION_PREVIEW_EMPTY');
  const measured = await measureSlices(slices, { fullWidth: true });
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = Math.max(1, fittedHeight(measured, 1));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paintMeasuredPage(ctx, measured, 0, 1);
  return canvas;
}

function previewSourceLink(group) {
  const link = document.createElement('a');
  link.className = 'q-source-link';
  link.href = group.source.pdfUrl + '#page=' + group.parts[0].page;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'פתיחת דף המקור';
  return link;
}

async function runPreviewQueue() {
  if (previewRunning) return;
  previewRunning = true;
  try {
    while (previewQueue.length) {
      const { group, target } = previewQueue.shift();
      if (!target.isConnected) continue;
      try {
        const canvas = await questionPreviewCanvas(group);
        if (!target.isConnected) continue;
        canvas.className = 'q-preview-page';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `שאלה ${group.q}, ${group.source.levelLabel || ''}, מתוך דף המקור, כולל כל הסעיפים`);
        const scroll = document.createElement('div');
        scroll.className = 'q-preview-scroll';
        scroll.tabIndex = 0;
        scroll.setAttribute('role', 'region');
        scroll.setAttribute('aria-label', `תוכן שאלה ${group.q}`);
        scroll.append(canvas);
        const zoom = document.createElement('button');
        zoom.type = 'button';
        zoom.className = 'q-preview-zoom';
        zoom.dataset.previewZoom = group.key;
        zoom.setAttribute('aria-pressed', 'false');
        zoom.textContent = 'הגדלת השאלה';
        target.replaceChildren(scroll, zoom, previewSourceLink(group));
        target.dataset.previewState = 'ready';
      } catch (error) {
        if (!target.isConnected) continue;
        const message = document.createElement('p');
        message.className = 'q-preview-error';
        message.textContent = 'תצוגת השאלה לא נטענה. אפשר לנסות שוב או לפתוח את דף המקור.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'q-preview-retry';
        retry.dataset.previewRetry = group.key;
        retry.textContent = 'ניסיון נוסף';
        target.replaceChildren(message, retry, previewSourceLink(group));
        target.dataset.previewState = 'error';
      } finally {
        target.setAttribute('aria-busy', 'false');
      }
    }
  } finally {
    previewRunning = false;
  }
}

function queueQuestionPreview(group, target) {
  if (target.dataset.previewState === 'queued' || target.dataset.previewState === 'ready') return;
  target.dataset.previewState = 'queued';
  target.setAttribute('aria-busy', 'true');
  previewQueue.push({ group, target });
  void runPreviewQueue();
}

function mountQuestionPreviews(groups, previous) {
  if (previewObserver) previewObserver.disconnect();
  const byKey = new Map(groups.map((group) => [group.key, group]));
  previewObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        previewObserver.unobserve(entry.target);
        const group = byKey.get(entry.target.dataset.previewKey);
        if (group) queueQuestionPreview(group, entry.target);
      });
    }, { rootMargin: '600px 0px' })
    : null;
  $('questions').querySelectorAll('[data-preview-key]').forEach((placeholder) => {
    const key = placeholder.dataset.previewKey;
    // Keep rendered canvases and in-flight targets when a checkbox or AI pick
    // changes. Selecting a question must not blank all the other questions.
    const target = previous.get(key) || placeholder;
    if (target !== placeholder) placeholder.replaceWith(target);
    if (target.dataset.previewState === 'ready' || target.dataset.previewState === 'queued' || target.dataset.previewState === 'error') return;
    if (previewObserver) previewObserver.observe(target);
    else queueQuestionPreview(byKey.get(key), target);
  });
}

function wholeQuestionMarkup(group, control) {
  const question = group.questions[0];
  const parts = group.questions.map((part) => part.part || part.id).join(' · ');
  const pages = [...new Set(group.questions.map((part) => part.page).filter(Boolean))];
  const pageLabel = pages.length ? (pages.length === 1 ? 'עמוד ' + pages[0] : 'עמודים ' + pages.join(', ')) : '';
  const level = question.source && question.source.levelLabel ? question.source.levelLabel : '';
  const meta = [level, pageLabel].filter(Boolean).join(' · ');
  const thumb = control
    ? `<canvas class="q-preview" data-preview="${escapeHTML(group.key)}" aria-label="${escapeHTML('שאלה ' + group.number + ' כפי שהיא בדף המקור')}"></canvas>`
    : (needsThumb(question)
      ? `<canvas class="q-thumb" data-thumb="${escapeHTML(exKey(question.source.pdfId, question.id))}" aria-label="${escapeHTML(thumbAria(question))}"></canvas>`
      : '');
  return `${control}<span class="q-content"><span class="q-title-line"><span class="q-title">שאלה ${escapeHTML(String(group.number))}</span><span class="badge extra">שאלה שלמה</span></span>${thumb}<span class="q-desc" dir="rtl">חלקים: ${escapeHTML(parts)}</span><span class="q-page" style="display:block">${escapeHTML(meta)}</span></span>`;
}

function wholeQuestionCards(keys) {
  const items = questionsForKeys(keys);
  return groupWholeQuestions(items).map((group) => `<article class="q-card q-card-whole">${wholeQuestionMarkup(group, '')}</article>`).join('');
}

function wholeQuestionPickCards(pool) {
  const selected = new Set(state.selected);
  const groups = state.filter === 'selected'
    ? pool.filter((group) => group.questions.some((question) => selected.has(exKey(question.source.pdfId, question.id))))
    : pool;
  if (!groups.length) return '<p class="empty">עדיין אין שאלות מסומנות. סמנו שאלה שלמה מהרשימה.</p>';
  return groups.map((group) => {
    const keys = group.questions.map((question) => exKey(question.source.pdfId, question.id));
    return questionCard(group, keys.length > 0 && keys.every((key) => selected.has(key)));
  }).join('');
}

function render() {
  const focusedQuestion = document.activeElement && document.activeElement.dataset.wholeQuestion;
  const ok = available();
  $('available-content').hidden = !ok;
  $('unavailable').hidden = ok;
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  $('result-title').textContent = ok ? (state.scenario === 'other' ? 'מרכיבים את הבחירה שלכם' : (pilotOn() ? cfg.title : cfg.label)) : 'בוחרים כיתה ונושא';
  $('result-summary').textContent = ok
    ? 'רואים כל שאלה כפי שהיא בדף המקור ומסמנים את השאלות השלמות שמתאימות, בכל מספר. כל נושא בדף הוא קטע מבחן או בניית דף חזרה על חומר.'
    : 'בוחרים כיתה ונושא מתוך הקטלוג.';
  $('rationale').textContent = ok ? 'בוחרים שאלה שלמה עם כל הסעיפים שלה, בכל הכיתות.' : '';
  $('pedagogy-details').textContent = ok ? (pilotOn() ? cfg.details : 'ההדפסה מסמנת על עמוד המקור, או חותכת ממנו דף מצומצם. לא מנוסח דף חדש.') : '';
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
    hint.textContent = `${gradeRecord(state.grade).label} · ${topic.title}. ${groupWholeQuestions(currentExercises()).length} שאלות שלמות בדפי הנושא.`;
  }
  const shortBtn = $('prepare-short');
  if (shortBtn) shortBtn.hidden = false;
  const prepareHint = $('prepare-hint');
  if (prepareHint) prepareHint.textContent = 'דף מלא עם סימון, או דף מצומצם שנחתך מהמקור';
  if (!ok) {
    paintSourceLine();
    applyWizard();
    return;
  }
  const availableGroups = currentQuestions();
  const previousPreviews = new Map(Array.from($('questions').querySelectorAll('[data-preview-key]'), (node) => [node.dataset.previewKey, node]));
  $('available-count').textContent = availableGroups.length + ' שאלות שלמות בדפי הנושא';
  $('questions').innerHTML = wholeQuestionPickCards(availableGroups);
  mountQuestionPreviews(availableGroups, previousPreviews);
  $('show-more').hidden = true;
  $('more-count').textContent = '';
  if ($('suggestion')) $('suggestion').hidden = true;
  const pageKeys = allSelectedKeys();
  const chosenQuestions = blockQuestionCount(pageKeys);
  $('selection-count').textContent = chosenQuestions + ' שאלות';
  const pdfs = new Set(pageKeys.map((key) => key.split(':')[1]).filter(Boolean));
  $('selection-composition').textContent = pdfs.size ? 'מתוך ' + pdfs.size + (pdfs.size === 1 ? ' דף מקור' : ' דפי מקור') : '';
  $('undo').disabled = history.length === 0;
  paintQuestionCountButtons();
  paintAiPickButtons();
  paintPageBuilder();
  paintSourceLine();
  applyWizard();
  if (focusedQuestion) {
    const checkbox = Array.from($('questions').querySelectorAll('[data-whole-question]')).find((input) => input.dataset.wholeQuestion === focusedQuestion);
    if (checkbox) checkbox.focus({ preventScroll: true });
  }
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
  const levels = [...new Set(chosen.map((meta) => levelPrintName(meta.level, meta.levelLabel)))].join(' · ');
  const title = `${topic ? topic.title : ''} · ${grade ? grade.label : ''} · ${levels}`;
  const links = chosen.map((meta) => `<a href="${escapeHTML(meta.pdfUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(chosen.length > 1 ? levelPrintName(meta.level, meta.levelLabel) : 'פתיחת דף המקור')} ↗</a>`).join('');
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
  const nodes = [...document.querySelectorAll('.q-thumb, .q-preview')];
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

async function paintQuestionPreview(canvas) {
  const group = currentQuestions().find((item) => item.key === canvas.dataset.preview);
  if (!group || !levelAllows(group.source)) return;
  const preview = await questionPreviewCanvas(group);
  canvas.width = preview.width;
  canvas.height = preview.height;
  canvas.style.width = '100%';
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';
  canvas.getContext('2d').drawImage(preview, 0, 0);
}

async function paintThumb(canvas) {
  if (canvas.dataset.preview) {
    await paintQuestionPreview(canvas);
    return;
  }
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
  if (!source.level || source.level === 'one' || source.level === state.level || (state.level === 'c' && source.level === 'c2')) return true;
  const topic = currentTopic();
  return !(topic && topic.sheets.some((sheet) => sheet.level === state.level));
}

function clearPreparedPrint() {
  const area = $('print-area');
  if (!area || area.querySelector('.print-unprepared')) return;
  area.innerHTML = PRINT_UNPREPARED;
}

function selectKey(key, on) {
  if (!key) return;
  const keys = key.startsWith('ex:') ? expandToWholeQuestionKeys(currentExercises(), [key]) : [key];
  const before = selectionKey();
  snapshot();
  state.pickNote = '';
  state.lastAiPickCount = 0;
  if ($('ai-suggest-status')) $('ai-suggest-status').textContent = 'הבחירה עודכנה ידנית. אפשר לתת ל-AI לבחור מחדש.';
  if (on) {
    keys.forEach((item) => {
      if (!state.selected.includes(item)) state.selected.push(item);
    });
  } else {
    const drop = new Set(keys);
    state.selected = state.selected.filter((item) => !drop.has(item));
  }
  if (selectionKey() !== before) clearPreparedPrint();
  render();
}

async function loadPdf(source) {
  const active = source || SOURCE;
  if (!active || !active.pdfUrl) throw new Error('PDF_LIB');
  if (pdfDocs.has(active.pdfId)) return pdfDocs.get(active.pdfId);
  if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') throw new Error('PDF_LIB');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const loading = window.pdfjsLib.getDocument({ url: active.pdfUrl, withCredentials: false, isEvalSupported: false }).promise;
  pdfDocs.set(active.pdfId, loading);
  try {
    return await loading;
  } catch (error) {
    pdfDocs.delete(active.pdfId);
    throw error;
  }
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
  if (pageBitmaps.has(key)) {
    const cached = pageBitmaps.get(key);
    pageBitmaps.delete(key);
    pageBitmaps.set(key, cached);
    return cached;
  }
  const loading = (async () => {
    const pdf = await loadPdf(active);
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1100 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  })();
  pageBitmaps.set(key, loading);
  // A long topic may contain dozens of PDF pages. Keep a small shared LRU;
  // previews and print jobs retain their own bitmaps while painting.
  while (pageBitmaps.size > 8) pageBitmaps.delete(pageBitmaps.keys().next().value);
  try {
    return await loading;
  } catch (error) {
    pageBitmaps.delete(key);
    throw error;
  }
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

function wholeQuestionSlices(chosen) {
  const slices = [];
  const seen = new Set();
  chosen.forEach((question) => {
    const source = question.source || SOURCE;
    const block = source.pdfId + ':q' + question.q;
    (question.rows && question.rows.length ? question.rows : [question.row]).forEach((box) => {
      if (!box) return;
      const page = box.page || question.page;
      const key = [block, page, box.x, box.y, box.w, box.h].join(':');
      if (seen.has(key)) return;
      seen.add(key);
      slices.push({ page, box: { ...box }, gap: 8, block, kind: 'row', pdfId: source.pdfId });
    });
  });
  return slices;
}

function shortSlices(chosen) {
  // These rows already enclose a complete original question and its context.
  // Legacy per-part footer, ink and shared-drawing adjustments would clip them.
  if (SOURCE && SOURCE.wholeQuestionGeometry) return wholeQuestionSlices(chosen);
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
  return chosen.slice().sort((a, b) => {
    const rank = { a: 0, b: 1, c: 2, one: 3 };
    const sa = a.source || {};
    const sb = b.source || {};
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

// A dot between parts is followed by the next part's label; a dot inside
// an answer (5 · 10⁶) is multiplication.
function answerSeparators(glyphs) {
  const ordered = glyphs.slice().sort((a, b) => b.x2 - a.x2 || b.x - a.x);
  const after = (index) => {
    let at = index + 1;
    while (at < ordered.length && !String(ordered[at].c).trim()) at += 1;
    return at;
  };
  const seps = new Set();
  ordered.forEach((glyph, index) => {
    if (!'·∙•'.includes(glyph.c)) return;
    const letter = after(index);
    if (letter >= ordered.length || !ANSWER_PARTS.includes(ordered[letter].c)) return;
    const dot = after(letter);
    if (dot < ordered.length && ordered[dot].c === '.') seps.add(glyph);
  });
  return seps;
}

function answerLabels(glyphs) {
  const ordered = glyphs.slice().sort((a, b) => b.x2 - a.x2 || b.x - a.x);
  const seps = answerSeparators(glyphs);
  const hasSeparators = seps.size > 0;
  const found = [];
  ordered.forEach((glyph, index) => {
    if (!ANSWER_PARTS.includes(glyph.c)) return;
    let dot = index + 1;
    while (dot < ordered.length && !String(ordered[dot].c).trim()) dot += 1;
    if (dot >= ordered.length || ordered[dot].c !== '.') return;
    let prev = index - 1;
    // A star marking the question is not text before the label.
    while (prev >= 0 && (!String(ordered[prev].c).trim() || '★☆'.includes(ordered[prev].c))) prev -= 1;
    if (hasSeparators) {
      if (prev >= 0 && !seps.has(ordered[prev])) return;
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
  const seps = answerSeparators(glyphs);
  const owned = glyphs.filter((glyph) => glyph.x2 > left + 0.001 && glyph.x < right - 0.001 && !seps.has(glyph));
  if (!owned.length) return null;
  let x = Math.min(...owned.map((glyph) => glyph.x)) - 0.0015;
  let x2 = Math.min(right, Math.max(...owned.map((glyph) => glyph.x2)) + 0.002);
  // A separator sits in the gap beside a part. Pull the nearer edge off it so
  // an individually cropped answer does not keep the dot.
  const midBox = (x + x2) / 2;
  glyphs.forEach((glyph) => {
    if (!seps.has(glyph) || glyph.x >= x2 || glyph.x2 <= x) return;
    const mid = (glyph.x + glyph.x2) / 2;
    if (mid >= midBox) x2 = Math.min(x2, glyph.x - 0.001);
    else x = Math.max(x, glyph.x2 + 0.001);
  });
  if (x2 - x < 0.008) return null;
  return { x: Math.max(0.02, x), y, w: x2 - Math.max(0.02, x), h: Math.max(0.012, y2 - y) };
}

// Dark pixels of a rendered answer page. pdf.js gives text boxes only; a
// fraction's numerator and denominator, an exponent or a descender reach past
// them. A light tint or the grey rule under an answer row is not ink.
function answerPageInk(bitmap) {
  if (!bitmap || !bitmap.width || !bitmap.height || typeof bitmap.getContext !== 'function') return null;
  const data = bitmap.getContext('2d').getImageData(0, 0, bitmap.width, bitmap.height).data;
  return pageInkFromPixels(data, bitmap.width, bitmap.height);
}

function pageInkFromPixels(data, width, height) {
  const dark = new Uint8Array(width * height);
  for (let at = 0; at < width * height; at += 1) {
    const p = at * 4;
    if (data[p + 3] > 40 && Math.min(data[p], data[p + 1], data[p + 2]) < 180) dark[at] = 1;
  }
  // A frame side, a table rule or a page-wide line is not answer ink: no
  // glyph runs that far in one direction.
  const rule = new Uint8Array(width * height);
  const tall = Math.max(24, Math.round(height * 0.05));
  for (let c = 0; c < width; c += 1) {
    for (let r = 0; r < height;) {
      if (!dark[r * width + c]) { r += 1; continue; }
      let end = r;
      while (end < height && dark[end * width + c]) end += 1;
      if (end - r >= tall) for (let k = r; k < end; k += 1) rule[k * width + c] = 1;
      r = end;
    }
  }
  // A page-wide line still parts two answers: its rows are kept as ruled.
  const ruled = new Uint8Array(height);
  const wide = Math.max(40, Math.round(width * 0.3));
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width;) {
      if (!dark[r * width + c]) { c += 1; continue; }
      let end = c;
      while (end < width && dark[r * width + end]) end += 1;
      if (end - c >= wide) {
        for (let k = c; k < end; k += 1) rule[r * width + k] = 1;
        ruled[r] = 1;
      }
      c = end;
    }
  }
  for (let at = 0; at < width * height; at += 1) if (rule[at]) dark[at] = 0;
  return { width, height, dark, ruled };
}

// Dark pixels in one row, inside the columns of [x0, x1].
function inkInRow(ink, r, x0, x1) {
  const c0 = Math.max(0, Math.floor(x0 * ink.width));
  const c1 = Math.min(ink.width, Math.ceil(x1 * ink.width));
  let count = 0;
  for (let c = c0; c < c1; c += 1) count += ink.dark[r * ink.width + c];
  return count;
}

// The row with the least ink in [r0, r1], nearest the middle on ties.
function thinnestRow(ink, r0, r1, x0, x1) {
  const centre = (r0 + r1) / 2;
  let best = r0;
  let least = Infinity;
  for (let r = r0; r <= r1; r += 1) {
    const count = inkInRow(ink, r, x0, x1);
    if (count < least || (count === least && Math.abs(r - centre) < Math.abs(best - centre))) {
      best = r;
      least = count;
    }
  }
  return best;
}

function inkMiddle(item) {
  return (item.y + (item.y2 != null ? item.y2 : item.y)) / 2;
}

// A numerator printed on its own baseline: under its ink, within half an em,
// a fraction bar spans all its columns, with a blank row right under the bar.
// Returns the bar's row, or -1.
function inkBarBelow(ink, item, em) {
  const H = ink.height;
  const width = Math.floor(item.x2 * ink.width) - Math.ceil(item.x * ink.width);
  if (width < 2) return -1;
  const count = (r) => inkInRow(ink, r, item.x, item.x2);
  const end = Math.min(H - 2, Math.ceil((item.y2 + em * 0.5) * H));
  let r = Math.floor(item.y2 * H);
  while (r <= end && count(r) > 0) r += 1;
  while (r <= end && count(r) === 0) r += 1;
  if (r > end) return -1;
  const thick = Math.max(3, Math.round(em * H * 0.22));
  let bar = r;
  while (bar < H - 1 && bar - r < thick && count(bar) >= width * 0.95) bar += 1;
  if (bar === r || count(bar) > 0 || !inkLoneBar(ink, r, bar - 1, item.x) || inkRootStroke(ink, bar - 1, item.x, em)) return -1;
  return r;
}

// A fraction bar stands alone: the rows right above and below it are nearly
// blank along its whole length (a letter's top stroke has the letter under it).
function inkLoneBar(ink, top, bottom, x) {
  const W = ink.width;
  let a = Math.ceil(x * W);
  let b = a;
  while (a > 0 && ink.dark[bottom * W + a - 1]) a -= 1;
  while (b < W - 1 && ink.dark[bottom * W + b + 1]) b += 1;
  if (top < 1 || bottom + 1 >= ink.height) return false;
  const most = Math.max(1, Math.floor((b - a + 1) * 0.15));
  return inkInRow(ink, top - 1, a / W, (b + 1) / W) <= most && inkInRow(ink, bottom + 1, a / W, (b + 1) / W) <= most;
}

// A root's bar is not a fraction bar: an unbroken stroke runs down and to
// the left from its left end.
function inkRootStroke(ink, r, x, em) {
  const W = ink.width;
  let left = Math.ceil(x * W);
  while (left > 0 && ink.dark[r * W + left - 1]) left -= 1;
  const span = Math.max(3, Math.round(em * ink.height * 0.4));
  for (let k = 1; k <= span; k += 1) {
    if (r + k >= ink.height || !inkInRow(ink, r + k, (left - k - 1) / W, (left + 2) / W)) return false;
  }
  return true;
}

// A denominator under a numerator that has no text (a drawn root): right
// above its ink, within half an em, a fraction bar spans all its columns.
// Returns the bar's lowest row, or -1.
function inkBarAbove(ink, item, em) {
  const H = ink.height;
  const width = Math.floor(item.x2 * ink.width) - Math.ceil(item.x * ink.width);
  if (width < 2) return -1;
  const count = (r) => inkInRow(ink, r, item.x, item.x2);
  const end = Math.max(1, Math.floor((item.y - em * 0.5) * H));
  let r = Math.floor(((item.y + item.y2) / 2) * H);
  while (r >= end && count(r) > 0) r -= 1;
  while (r >= end && count(r) === 0) r -= 1;
  if (r < end) return -1;
  const thick = Math.max(3, Math.round(em * H * 0.22));
  let bar = r;
  while (bar > 0 && r - bar < thick && count(bar) >= width * 0.95) bar -= 1;
  if (bar === r || count(bar) > 0 || !inkLoneBar(ink, bar + 1, r, item.x) || inkRootStroke(ink, r, item.x, em)) return -1;
  return r;
}

// Where each answer starts on the page. From the middle of its number, go up
// through the ink of its first line (a numerator above it included) to the
// first blank row, but never past the baseline of the text line above or a
// ruled line; if that line's ink touches, part at the thinnest row. A thin
// bar drawn just over the first line (a repeating decimal, a root) and a
// fraction inside a numerator stay with it. The scan reaches an em left of
// the text, where a drawn root or a fraction bar ends.
function answerInkStarts(ink, pageLines, marks) {
  const H = ink.height;
  const row = (y) => Math.max(0, Math.min(H - 1, Math.floor(y * H)));
  const hebrew = (line) => /[֐-׿]/.test(String(line.text || ''));
  return marks.map((mark, index) => {
    const em = (mark.y2 - mark.y) / 0.78;
    const floor = index ? marks[index - 1].y2 : 0.02;
    let limit = floor;
    pageLines.forEach((line) => {
      const mid = inkMiddle(line);
      if (line.y2 != null && hebrew(line) && mid > floor && mid < mark.y - em * 0.45) limit = Math.max(limit, line.y2);
    });
    const near = pageLines.filter((line) => line.y2 != null && line.x != null && inkMiddle(line) > limit && line.y < mark.y2 + em);
    const x0 = Math.max(0.02, Math.min(mark.x, ...near.map((line) => line.x)) - em * H / ink.width);
    const x1 = Math.min(0.98, Math.max(mark.x2, ...near.map((line) => line.x2)));
    const stop = row(limit);
    const from = row(inkMiddle(mark));
    const ruled = (r) => Boolean(ink.ruled && ink.ruled[r]);
    const blank = (r) => !ruled(r) && inkInRow(ink, r, x0, x1) === 0;
    const climb = (at) => {
      let k = at;
      while (k > stop && !blank(k) && !ruled(k)) k -= 1;
      return k;
    };
    const numerators = near.filter((line) => !hebrew(line) && line !== mark && !isAnswerNumber(line));
    // With no blank row at all, part above the first line's own numerators:
    // those whose fraction bar runs through the first line.
    let reach = from;
    numerators.forEach((line) => {
      const bar = row(line.y2) < from ? inkBarBelow(ink, line, em) : -1;
      if (bar >= row(mark.y) && bar <= row(mark.y2) + Math.round(em * H * 0.3)) reach = Math.max(stop, Math.min(reach, row(line.y) + 2));
    });
    const most = Math.max(3, Math.round(em * H * 0.4));
    let r = climb(from);
    for (let moved = true; moved && r > stop && !ruled(r);) {
      moved = false;
      // A numerator of the first line can sit above a blank row of its own
      // fraction (a fraction inside a numerator).
      const up = numerators.find((line) => row(line.y2) <= r + 1 && row(inkMiddle(line)) > stop && row(inkMiddle(line)) < r && inkBarBelow(ink, line, em) > r);
      if (up) {
        reach = Math.max(stop, Math.min(reach, row(up.y)));
        r = climb(row(inkMiddle(up)));
        moved = true;
        continue;
      }
      // A thin bar over the first line: a short blank run (under half an
      // em), then at most 3 rows of ink with a blank row above.
      let top = r;
      while (top - 1 > stop && r - top < most - 1 && blank(top - 1)) top -= 1;
      let bar = top - 1;
      while (bar > stop && top - 1 - bar < 3 && !blank(bar) && !ruled(bar)) bar -= 1;
      if (bar > stop && bar < top - 1 && blank(bar)) {
        r = bar;
        moved = true;
      }
    }
    if (r > stop && ruled(r)) return Math.max(limit, (r + 1) / H);
    if (r <= stop) {
      // ... and below the denominators of the answer above (their bar is
      // above its baseline).
      let low = stop;
      pageLines.forEach((line) => {
        if (line.x == null || line.y2 == null || hebrew(line) || isAnswerNumber(line)) return;
        const mid = row(inkMiddle(line));
        if (mid <= stop || mid >= reach) return;
        const bar = inkBarAbove(ink, line, em);
        if (bar >= 0 && bar <= stop) low = Math.max(low, Math.min(reach, row(line.y2) + 1));
      });
      return Math.max(limit, thinnestRow(ink, low, reach, x0, x1) / H);
    }
    let gap = r;
    while (gap - 1 > stop && blank(gap - 1)) gap -= 1;
    return Math.max(limit, (r + 1 - Math.min(Math.round(H * 0.004), Math.floor((r - gap + 1) / 2))) / H);
  });
}

// Which answer each text line belongs to: the one whose rows hold its
// middle. Where two answers' fractions interleave, a numerator or a
// denominator goes with the answer that holds its fraction bar.
function answerInkOwners(ink, pageLines, starts, em) {
  const index = (y) => {
    let k = -1;
    starts.forEach((start, at) => { if (y >= start) k = at; });
    return k;
  };
  const owners = new Map();
  pageLines.forEach((line) => {
    if (line.y2 == null) return;
    let k = index(inkMiddle(line));
    if (line.x != null && line.x2 != null && !/[֐-׿]/.test(String(line.text || '')) && !isAnswerNumber(line)) {
      let bar = inkBarBelow(ink, line, em);
      if (bar < 0) bar = inkBarAbove(ink, line, em);
      if (bar >= 0 && index(bar / ink.height) >= 0) k = index(bar / ink.height);
    }
    owners.set(line, k);
  });
  return owners;
}

// A drawn fraction bar or root has no text box, and a glyph's place in a
// text box is only estimated. A part's crop reaches out to the ink beside it
// in its rows, across gaps narrower than a word space, inside the part's
// own columns.
function answerInkPartBox(ink, box, left, right) {
  if (!box) return box;
  const W = ink.width;
  const r0 = Math.max(0, Math.floor(box.y * ink.height));
  const r1 = Math.min(ink.height, Math.ceil((box.y + box.h) * ink.height));
  const used = (c) => {
    for (let r = r0; r < r1; r += 1) if (ink.dark[r * W + c]) return true;
    return false;
  };
  const gap = Math.round(W * 0.01);
  const c0 = Math.max(0, Math.ceil(Math.max(0.02, left) * W));
  const c1 = Math.min(W - 1, Math.floor(right * W) - 1);
  let x = Math.floor(box.x * W);
  for (let c = x - 1, blank = 0; c >= c0 && blank <= gap; c -= 1) {
    if (used(c)) { x = c; blank = 0; } else blank += 1;
  }
  let x2 = Math.ceil((box.x + box.w) * W);
  for (let c = x2, blank = 0; c <= c1 && blank <= gap; c += 1) {
    if (used(c)) { x2 = c + 1; blank = 0; } else blank += 1;
  }
  const nx = Math.min(box.x, Math.max(c0 / W, x / W - 0.0015));
  const nx2 = Math.max(box.x + box.w, Math.min((c1 + 1) / W, x2 / W + 0.002));
  return { ...box, x: nx, w: nx2 - nx };
}

// The text lines of one answer, as rows to crop. Parts of one row printed on
// different baselines join that row; a numerator or a denominator printed on
// its own baseline joins the line its fraction bar belongs to; an exponent
// joins the line it overlaps; math above the first labelled line belongs to
// that line. Labels are read from each line's own text. Each line then grows
// into the blank rows around it until its ink ends, never into the next
// line's text and never out of the answer. Inside the answer, a line never
// shrinks below its text boxes.
function answerInkClusters(region, clusters, number) {
  const { ink } = region;
  const H = ink.height;
  const em = region.em || 0.012;
  const row = (y) => Math.max(0, Math.min(H - 1, Math.floor(y * H)));
  const reach = em * H / ink.width;
  const box = (glyphs) => ({
    y: Math.min(...glyphs.map((glyph) => glyph.y)) - 0.002,
    y2: Math.max(...glyphs.map((glyph) => glyph.y2)) + 0.002,
    x: Math.min(...glyphs.map((glyph) => glyph.x)),
    x2: Math.max(...glyphs.map((glyph) => glyph.x2)),
  });
  // The lower line hangs under a fraction bar that runs under the upper one:
  // some glyph of it has a bar right above it, under the glyphs over it.
  const stacked = (upper, lower) => lower.glyphs.some((low) => {
    if (!String(low.c).trim()) return false;
    const over = upper.glyphs.filter((glyph) => Math.min(glyph.x2, low.x2) - Math.max(glyph.x, low.x) > 0.5 * Math.min(glyph.x2 - glyph.x, low.x2 - low.x));
    if (!over.length) {
      // Nothing printed over it (a drawn root): its bar runs through the upper line.
      const a = box(upper.glyphs);
      const bar = inkBarAbove(ink, low, em);
      return bar >= 0 && bar >= row(a.y) && bar <= row(a.y2) + 1;
    }
    // The bar spans the whole lower glyph, right above it.
    const bar = inkBarBelow(ink, { x: low.x, x2: low.x2, y2: Math.max(...over.map((glyph) => glyph.y2)) }, em);
    return bar >= 0 && bar <= row(low.y) + 1 && row(low.y) - bar <= Math.round(em * H * 0.5);
  });
  // An exponent or an index printed a little off the line's baseline.
  const overlapping = (upper, lower) => {
    const a = box(upper.glyphs);
    const b = box(lower.glyphs);
    const overlap = Math.min(a.y2, b.y2) - Math.max(a.y, b.y);
    return overlap > 0.4 * Math.min(a.y2 - a.y, b.y2 - b.y);
  };
  const lines = clusters.map((cluster) => ({ glyphs: cluster.glyphs.slice(), labelGlyphs: cluster.glyphs.slice(), labels: answerLabels(cluster.glyphs) }));
  const labelled = (line) => line.labels.length > 0;
  // Parts in one row are aligned at their tops, so a part holding a tall
  // fraction sits on a lower baseline than its neighbours. Every row starts
  // with a labelled line at the right edge; a labelled line further left
  // belongs to the row whose baseline is nearest, when its labels fit
  // between that row's labels.
  const baseline = (line) => Math.max(...line.labelGlyphs.map((glyph) => glyph.y2));
  const topOf = (line) => Math.min(...line.glyphs.map((glyph) => glyph.y));
  const labelledLines = lines.filter(labelled);
  if (labelledLines.length > 1) {
    const right = (line) => Math.max(...line.labels.map((label) => label.x2));
    const edge = Math.max(...labelledLines.map(right));
    const starts = labelledLines.filter((line) => right(line) >= edge - 0.01);
    labelledLines.forEach((line) => {
      if (starts.includes(line)) return;
      let best = null;
      starts.forEach((start) => {
        const gap = Math.abs(baseline(start) - baseline(line));
        const clash = line.labels.some((label) => start.labels.some((other) => label.x < other.x2 + 0.004 && other.x < label.x2 + 0.004));
        if (gap >= em * 3.5 || clash) return;
        if (!best || gap < Math.abs(baseline(best) - baseline(line))) best = start;
      });
      if (!best) return;
      best.glyphs.push(...line.glyphs);
      best.labelGlyphs.push(...line.labelGlyphs);
      best.labels = best.labels.concat(line.labels).sort((a, b) => b.x2 - a.x2);
      line.merged = true;
    });
    for (let k = lines.length - 1; k >= 0; k -= 1) if (lines[k].merged) lines.splice(k, 1);
    lines.sort((a, b) => topOf(a) - topOf(b));
  }
  for (let k = 0; k < lines.length;) {
    const free = !labelled(lines[k]);
    const math = free && !lines[k].labelGlyphs.some((glyph) => /[֐-׿]/.test(glyph.c));
    const up = free && k > 0 && (stacked(lines[k - 1], lines[k]) || (math && overlapping(lines[k - 1], lines[k])));
    const down = free && k + 1 < lines.length && (stacked(lines[k], lines[k + 1]) || (math && overlapping(lines[k], lines[k + 1])));
    if (!up && !down) {
      k += 1;
      continue;
    }
    let into = up ? k - 1 : k + 1;
    if (up && down) {
      const me = box(lines[k].glyphs);
      into = me.y - box(lines[k - 1].glyphs).y2 <= box(lines[k + 1].glyphs).y - me.y2 ? k - 1 : k + 1;
    }
    lines[into].glyphs.push(...lines[k].glyphs);
    lines.splice(k, 1);
    k = Math.min(into, k);
  }
  while (lines.length > 1 && !labelled(lines[0]) && !lines[0].labelGlyphs.some((glyph) => /[֐-׿]/.test(glyph.c))) {
    lines[1].glyphs.push(...lines[0].glyphs);
    lines.shift();
  }
  const boxes = lines.map((line) => box(line.glyphs));
  if (number && boxes.length) {
    boxes[0].y = Math.min(boxes[0].y, number.y - 0.002);
    boxes[0].y2 = Math.max(boxes[0].y2, number.y2 + 0.002);
    boxes[0].x = Math.min(boxes[0].x, number.x);
    boxes[0].x2 = Math.max(boxes[0].x2, number.x2);
  }
  const pad = Math.round(H * 0.002);
  const most = Math.max(3, Math.round(em * H * 0.4));
  const grown = boxes.map((b, k) => {
    // A numerator or a denominator printed past the answer's rows, but
    // given to it by its fraction bar, keeps its text box.
    const outside = (glyph, y) => (glyph.y + glyph.y2) / 2 < y;
    const floor = Math.min(region.y, ...lines[k].glyphs.filter((glyph) => outside(glyph, region.y)).map((glyph) => glyph.y));
    const ceiling = Math.max(region.y2, ...lines[k].glyphs.filter((glyph) => glyph.y2 > region.y2).map((glyph) => (
      outside(glyph, region.y2) ? glyph.y2 : glyph.y2 + 1.5 / H
    )));
    const lo = Math.max(floor, k ? boxes[k - 1].y2 : floor);
    const hi = Math.min(ceiling, k + 1 < boxes.length ? boxes[k + 1].y : region.y2);
    const x0 = Math.max(0.02, b.x - reach);
    const used = (r) => r >= row(lo) && inkInRow(ink, r, x0, b.x2) > 0;
    const ruled = (r) => Boolean(ink.ruled && ink.ruled[r]);
    let top = row(b.y);
    while (used(top - 1)) top -= 1;
    // A thin bar just over the line (a drawn root's bar) belongs to it.
    let bar = top - 1;
    while (bar >= row(lo) && top - bar <= most && !used(bar) && !ruled(bar)) bar -= 1;
    if (used(bar) && bar < top - 1) {
      let barTop = bar;
      while (bar - barTop < 2 && used(barTop - 1)) barTop -= 1;
      if (barTop - 1 >= row(lo) && !used(barTop - 1)) top = barTop;
    }
    let bottom = row(b.y2);
    while (bottom + 1 < row(hi) && inkInRow(ink, bottom + 1, x0, b.x2)) bottom += 1;
    let y2 = Math.max(b.y2, Math.min(hi, (bottom + 1 + pad) / H));
    if (!region.last) y2 = Math.min(ceiling, y2);
    let y = Math.max(floor, Math.min(b.y, Math.max(lo, (top - pad) / H)));
    // The padding never takes in a ruled line beside the text.
    for (let r = row(b.y + 0.002) - 1; r >= row(y); r -= 1) if (ruled(r)) { y = (r + 1) / H; break; }
    for (let r = row(b.y2 - 0.002) + 1; r < Math.ceil(y2 * H); r += 1) if (ruled(r)) { y2 = r / H; break; }
    return { y, y2 };
  });
  for (let k = 0; k + 1 < grown.length; k += 1) {
    if (grown[k].y2 <= grown[k + 1].y) continue;
    if (boxes[k].y2 < boxes[k + 1].y) {
      const x0 = Math.min(boxes[k].x, boxes[k + 1].x);
      const x1 = Math.max(boxes[k].x2, boxes[k + 1].x2);
      const cut = Math.max(boxes[k].y2, thinnestRow(ink, row(boxes[k].y2), row(boxes[k + 1].y), x0, x1) / H);
      grown[k].y2 = cut;
      grown[k + 1].y = cut;
    } else {
      // The padded text boxes meet: part between the glyphs themselves.
      const a = boxes[k].y2 - 0.002;
      const b = boxes[k + 1].y + 0.002;
      const x0 = Math.min(boxes[k].x, boxes[k + 1].x);
      const x1 = Math.max(boxes[k].x2, boxes[k + 1].x2);
      const cut = a < b ? thinnestRow(ink, row(a), row(b), x0, x1) / H : null;
      grown[k].y2 = cut != null ? cut : boxes[k].y2;
      grown[k + 1].y = cut != null ? cut : boxes[k + 1].y;
    }
  }
  return lines.map((line, k) => ({ glyphs: line.glyphs, labels: line.labels, top: grown[k].y, bottom: grown[k].y2, row: k }));
}

function clusterSpan(cluster) {
  if (cluster.top != null) return { y: cluster.top, y2: cluster.bottom };
  return {
    y: Math.min(...cluster.glyphs.map((glyph) => glyph.y)) - 0.002,
    y2: Math.max(...cluster.glyphs.map((glyph) => glyph.y2)) + 0.002,
  };
}

// Each picked part is its own crop, placed just to the left of the question
// number. The full answer line is not masked.
function answerPieces(pageLines, mark, nextY, parts, region) {
  if (!parts || parts.has('')) return null;
  const band = pageLines.filter((line) => {
    if (line.x != null && line.x >= 0.85 && isAnswerNumber(line)) return false;
    if (!region) return line.y >= mark.y - 0.008 && line.y < nextY - 0.004;
    if (region.lines) return region.lines.has(line) && (!region.last || line.y < region.y2 - 0.004);
    return inkMiddle(line) >= region.y && (region.last ? line.y < region.y2 - 0.004 : inkMiddle(line) < region.y2);
  });
  const glyphs = band.flatMap(answerGlyphs).filter((glyph) => glyph.x < 0.90);
  const number = pageLines.find((line) => isAnswerNumber(line) && Math.abs(line.y - mark.y) < 0.008 && answerNumberValue(line) === mark.n);
  let clusters = answerClusters(glyphs);
  if (region && clusters.length) clusters = answerInkClusters(region, clusters, number);
  if (!clusters.length) return null;
  const exact = glyphs.some((glyph) => glyph.exact);
  const pad = exact ? 0.003 : 0.008;
  const owned = [];
  let carry = null;
  let rightmost = 0;
  const partBox = (own, left, right, y, y2) => (
    region ? answerInkPartBox(region.ink, answerPartBox(own, left, right, y, y2), left, right) : answerPartBox(own, left, right, y, y2)
  );
  clusters.forEach((cluster) => {
    const labels = cluster.labels || answerLabels(cluster.glyphs);
    const { y, y2 } = clusterSpan(cluster);
    if (!labels.length) {
      if (!carry || !parts.has(carry.part)) return;
      const box = partBox(cluster.glyphs, 0.02, 0.90, y, y2);
      if (box) owned.push({ part: carry.part, box, row: cluster.row });
      return;
    }
    const dots = answerSeparators(cluster.glyphs);
    labels.forEach((label, index) => {
      const next = labels[index + 1];
      const seps = cluster.glyphs.filter((glyph) => (
        dots.has(glyph) && glyph.x2 < label.x + 0.002 && (!next || glyph.x > next.x - 0.004)
      ));
      const sep = seps.sort((a, b) => b.x2 - a.x2)[0];
      const left = sep ? sep.x2 + pad : (next ? next.x2 + pad + 0.006 : 0.02);
      if (parts.has(label.part)) {
        const box = partBox(cluster.glyphs, left, Math.min(0.90, label.x2 + 0.004), y, y2);
        if (box) owned.push({ part: label.part, box, row: cluster.row });
      }
    });
    carry = labels[labels.length - 1];
    rightmost = Math.max(rightmost, ...labels.map((label) => label.x2));
  });
  if (!owned.length) return null;
  const rank = {};
  Array.from(ANSWER_PARTS).forEach((letter, index) => { rank[letter] = index; });
  owned.sort((a, b) => a.box.y - b.box.y || (rank[a.part] || 0) - (rank[b.part] || 0));
  const lines = [];
  owned.forEach((item) => {
    const last = lines[lines.length - 1];
    if (!last || (item.row != null ? item.row !== last.row : item.box.y - last.y > 0.01)) lines.push({ y: item.box.y, row: item.row, items: [item] });
    else last.items.push(item);
  });
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
      // A star printed between the number and the first label stays with it.
      const star = glyphs.filter((glyph) => '★☆'.includes(glyph.c) && glyph.x > rightmost && glyph.x < nx && glyph.y < y2 && glyph.y2 > y);
      const sx = Math.min(nx, ...star.map((glyph) => glyph.x - 0.0015));
      place({ x: sx, y, w: Math.max(0.012, nx2 - sx), h: y2 - y });
    }
    line.items.forEach((item) => place(item.box));
  });
  const rowY = Math.max(0.04, Math.min(...pieces.map((piece) => piece.box.y)));
  const rowY2 = Math.max(...pieces.map((piece) => piece.box.y + piece.box.h));
  const rowH = Math.max(0.014, rowY2 - rowY);
  pieces.forEach((piece) => { piece.dy = (piece.box.y - rowY) / rowH; });
  return { box: { x: 0, y: rowY, w: 1, h: rowH }, pieces };
}

function answerCropsFromLines(lines, wanted, inkPages) {
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
    const ink = inkPages && inkPages.get(page);
    // The next answer's number can sit too low to be cropped (past 0.9); the
    // answer above it still ends where it starts.
    const tail = marks.length && pageLines.find((line) => (
      line.x != null && line.x >= 0.85 && line.y > marks[marks.length - 1].y && line.y < FOOTER
      && answerNumberValue(line) === String(Number(marks[marks.length - 1].n) + 1)
    ));
    const bounds = tail ? marks.concat([{ n: answerNumberValue(tail), y: tail.y, y2: tail.y2, x: tail.x || 0, x2: tail.x2 || 0 }]) : marks;
    const starts = ink && marks.length ? answerInkStarts(ink, pageLines, bounds) : null;
    const owners = starts ? answerInkOwners(ink, pageLines, starts, (marks[0].y2 - marks[0].y) / 0.78) : null;
    marks.forEach((mark, index) => {
      if (!want.has(mark.n)) return;
      const next = marks[index + 1];
      const nextY = next ? next.y : FOOTER;
      const end = starts && (bounds[index + 1] ? starts[index + 1] : FOOTER);
      const lines = owners && new Set(pageLines.filter((line) => owners.get(line) === index));
      const region = starts && end > starts[index] ? { ink, y: starts[index], y2: end, last: !bounds[index + 1], em: (mark.y2 - mark.y) / 0.78, lines } : null;
      const laid = answerPieces(pageLines, mark, nextY, want.get(mark.n), region);
      if (laid) {
        crops.push({ page, q: Number(mark.n), box: laid.box, pieces: laid.pieces });
        return;
      }
      if (region) {
        // A ruled line under the answer stays out of its crop.
        let y2 = region.y2;
        while (y2 - 1 / ink.height > region.y && ink.ruled && ink.ruled[Math.floor(y2 * ink.height) - 1]) y2 -= 1 / ink.height;
        crops.push({ page, q: Number(mark.n), box: { x: 0.02, y: region.y, w: 0.96, h: y2 - region.y } });
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
  return topics.join(' · ') || (SOURCE && SOURCE.topic) || 'דף תרגול';
}

async function measureSlices(slices, options) {
  const OUT_W = 1000;
  const fullWidth = Boolean(options && options.fullWidth);
  const measured = [];
  for (const slice of slices) {
    if (slice.kind === 'level' || slice.kind === 'section' || slice.kind === 'points') {
      const dh = slice.kind === 'section' ? (slice.test ? SECTION_TEST_H : SECTION_REVIEW_H) : (slice.kind === 'points' ? 30 : 36);
      measured.push({ slice, bitmap: null, sw: OUT_W, sh: dh, dh });
      continue;
    }
    const bitmap = await pageBitmap(slice.page, sheets.get(slice.pdfId) || SOURCE);
    const sw = Math.max(1, slice.box.w * bitmap.width);
    const sh = Math.max(1, slice.box.h * bitmap.height);
    const dw = !fullWidth && slice.box.w < 0.5 ? slice.box.w * OUT_W : OUT_W;
    measured.push({ slice, bitmap, sw, sh, dh: Math.max(1, Math.round(dw * sh / sw)), fullWidth });
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
  ctx.font = '28px Heebo, Arial, sans-serif';
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

const SECTION_TEST_H = 150;
const SECTION_REVIEW_H = 52;

function paintSectionHeading(ctx, slice, x0, drawW, y, fit) {
  const right = x0 + drawW - 28;
  const left = x0 + 28;
  const px = (n) => Math.max(10, Math.round(n * fit));
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#22305a';
  ctx.strokeStyle = '#22305a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y + px(4));
  ctx.lineTo(right, y + px(4));
  ctx.stroke();
  ctx.font = 'bold ' + px(24) + 'px Heebo, Arial, sans-serif';
  ctx.fillText(slice.label || '', right, y + px(36));
  if (slice.test) {
    ctx.font = px(20) + 'px Heebo, Arial, sans-serif';
    ctx.fillText('תאריך:', right, y + px(80));
    ctx.fillText('כיתה:', right - px(330), y + px(80));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(right - px(70), y + px(84));
    ctx.lineTo(right - px(300), y + px(84));
    ctx.moveTo(right - px(390), y + px(84));
    ctx.lineTo(right - px(560), y + px(84));
    ctx.stroke();
    const boxW = px(300);
    const boxH = px(60);
    const boxY = y + px(58);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(left, boxY, boxW, boxH);
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + px(20) + 'px Heebo, Arial, sans-serif';
    ctx.fillText(slice.score || '', left + boxW / 2, boxY + boxH / 2 + px(7));
    ctx.textAlign = 'right';
    ctx.font = px(16) + 'px Heebo, Arial, sans-serif';
    ctx.fillText(slice.note || '', right, y + px(126));
  }
  ctx.restore();
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
    if (item.slice.kind === 'section') {
      paintSectionHeading(ctx, item.slice, x0, drawW, y, fit);
      y += dh;
      return;
    }
    if (item.slice.kind === 'points') {
      ctx.fillStyle = '#22305a';
      ctx.font = 'bold ' + Math.max(11, Math.round(18 * fit)) + 'px Heebo, Arial, sans-serif';
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillText(item.slice.label || '', x0 + drawW - 28, y + Math.round(22 * fit));
      y += dh;
      return;
    }
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
      const narrow = !item.fullWidth && item.slice.box.w < 0.5;
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

function answerFallbackSlices(source) {
  const start = Number(source.answerStartPage);
  const end = Number(source.pageCount);
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || start > end) return [];
  const slices = [{
    page: start, pdfId: source.pdfId, gap: 8, kind: 'level',
    block: 'answers-head:' + source.pdfId,
    label: [levelPrintName(source.level, source.levelLabel), 'תשובות מדף המקור המלא'].filter(Boolean).join(' · '),
  }];
  for (let page = start; page <= end; page += 1) {
    slices.push({ page, pdfId: source.pdfId, box: { x: 0, y: 0, w: 1, h: 1 },
      gap: 6, block: 'answers-page:' + source.pdfId + ':' + page, kind: 'answer' });
  }
  return slices;
}

// The rendered answer pages, read for their ink.
async function answerInkPages(lines, source) {
  const inkPages = new Map();
  for (const page of new Set(lines.filter(isAnswerHeading).map((line) => line.page))) {
    try {
      inkPages.set(page, answerPageInk(await pageBitmap(page, source)));
    } catch (error) {
      // Without the page's ink, the text boxes alone still give the crop.
    }
  }
  return inkPages;
}

async function answerMeasured(groups) {
  const slices = [];
  for (const group of groups) {
    if (group.source.answerGeometry === 'full-pages') {
      // Outlined PDFs can contain a searchable overlay at unrelated positions.
      // Use the verified source answer pages instead of those text coordinates.
      slices.push(...answerFallbackSlices(group.source));
      continue;
    }
    let lines = [];
    try {
      lines = await sheetTextLines(group.source);
    } catch (error) {
      // Some source PDFs have an outline but no extractable answer text.
      // Their checked answer-page metadata preserves the original answers.
    }
    const wanted = group.questions.map((question) => ({ q: question.q, part: question.part || '' }));
    const inkPages = lines.length ? await answerInkPages(lines, group.source) : new Map();
    let crops;
    try {
      crops = answerCropsFromLines(lines, wanted, inkPages);
    } catch (error) {
      // A page whose ink cannot be read still gets the text-only crops.
      crops = answerCropsFromLines(lines, wanted);
    }
    if (!crops.length) {
      slices.push(...answerFallbackSlices(group.source));
      continue;
    }
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

async function paintAllShort(root, chosen, blocks) {
  const sections = blocks && blocks.length
    ? blocks.map((block) => ({ ...block, questions: orderPrintQuestions(block.questions.filter((question) => question && question.source)) }))
    : [{ kind: 'review', title: '', questions: orderPrintQuestions(chosen.filter((question) => question && question.source)) }];
  const headings = needsSectionHeadings(sections);
  const batched = sections.map((section) => batchesOf(section.questions).filter((batch) => {
    SOURCE = batch.questions[0].source;
    return shortSlices(batch.questions).length > 0;
  }));
  const points = testPoints(sections.map((section, index) => ({ kind: section.kind, questions: batched[index].length })));
  const ordered = sections.flatMap((section) => section.questions);
  const slices = [];
  const groups = [];
  sections.forEach((section, sectionIndex) => {
  let lastLevel = null;
  batched[sectionIndex].forEach((batch, batchIndex) => {
    const question = batch.questions[0];
    SOURCE = question.source;
    const part = shortSlices(batch.questions);
    if (!part.length) return;
    const known = groups.find((group) => group.source.pdfId === question.source.pdfId);
    if (known) batch.questions.forEach((item) => known.questions.push(item));
    else groups.push({ source: question.source, questions: batch.questions.slice() });
    const test = sectionKind(section.kind) === 'test';
    if (headings && batchIndex === 0) {
      const sectionTotal = points[sectionIndex].reduce((sum, value) => sum + value, 0);
      slices.push({
        page: part[0].page,
        pdfId: question.source.pdfId,
        box: { x: 0, y: 0, w: 1, h: 0.02 },
        gap: 14,
        block: part[0].block,
        kind: 'section',
        test,
        label: sectionTitle(section.kind, section.title || question.source.topic),
        score: test ? scoreLabel(sectionTotal) : '',
        note: test ? `${points[sectionIndex].length} שאלות · ${sectionTotal} נק׳ מתוך ${TEST_TOTAL_POINTS} בדף` : '',
      });
    }
    if (question.source.level !== lastLevel) {
      slices.push({
        page: part[0].page,
        pdfId: question.source.pdfId,
        box: { x: 0, y: 0, w: 1, h: 0.02 },
        gap: 8,
        block: part[0].block,
        kind: 'level',
        label: levelPrintName(question.source.level, question.source.levelLabel),
      });
      lastLevel = question.source.level;
    }
    if (sectionKind(section.kind) === 'test') {
      slices.push({
        page: part[0].page,
        pdfId: question.source.pdfId,
        box: { x: 0, y: 0, w: 1, h: 0.02 },
        gap: 6,
        block: part[0].block,
        kind: 'points',
        label: pointsLabel(question.q, points[sectionIndex][batchIndex]),
      });
    }
    part.forEach((slice) => {
      slice.pdfId = slice.pdfId || question.source.pdfId;
      slices.push(slice);
    });
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

async function updateShortPrint(plan, printArea, chosen, note, cfg, blocks) {
  const head = `<p class="plan-notice">דף מצומצם. כל קטע נחתך מדף המקור, עם ההוראה, הנוסח והתרשים המקוריים.</p>${metaHTML(chosen, cfg)}`;
  const foot = `<p class="print-source">מקור: ${escapeHTML(chosen.map((question) => question.source && question.source.title).filter((title, index, all) => title && all.indexOf(title) === index).join(' · '))}</p><p class="plan-notes">${escapeHTML(STYLES[state.style].plan)}</p>${note ? `<div class="plan-notes"><strong>הערת המורה</strong><br>${escapeHTML(note)}</div>` : ''}`;
  plan.innerHTML = head + '<div class="crop-preview"></div>' + foot;
  printArea.innerHTML = '';
  await paintAllShort(plan.querySelector('.crop-preview'), chosen, blocks);
  await paintAllShort(printArea, chosen, blocks);
  await attachTeacherNote(printArea, note);
}

function sourceForContext(source, context) {
  const grade = context && gradeRecord(context.grade);
  const topic = grade && grade.topics.find((item) => String(item.id) === String(context.topic));
  const meta = topic && topic.sheets.find((item) => item.pdfId === source.pdfId);
  if (!meta) return source;
  // PDF geometry is shared, but a saved section retains the grade/topic in which
  // its questions were chosen. Never rewrite the cached original for a new scope.
  const scoped = { ...source, ...meta, grade: grade.grade, gradeLabel: grade.label,
    topic: topic.title, title: meta.title || source.title };
  scoped.questions = source.questions.map((question) => ({ ...question, source: scoped }));
  return scoped;
}

function questionsForKeys(keys, context = state) {
  const wanted = new Set(keys || []);
  const pdfs = [...new Set([...wanted].map((key) => key.split(':')[1]))];
  // Repeated legacy part IDs can denote more than one source region. Keep all
  // source records for printing while the selected ID itself remains unique.
  return pdfs.flatMap((pdfId) => {
    const original = sheets.get(pdfId);
    const source = original && sourceForContext(original, context);
    return source ? source.questions.filter((question) => wanted.has(exKey(pdfId, question.id))) : [];
  });
}

async function resolveChosen() {
  const allow = new Set(visibleSelectionKeys());
  const keys = [];
  for (const key of state.selected) {
    if (!allow.has(key)) continue;
    keys.push(key);
  }
  return questionsForKeys(keys);
}

async function updatePrint() {
  const plan = $('dialog-plan');
  const printArea = $('print-area');
  if (!available()) {
    plan.innerHTML = '<p>אין דף מקור להדפסה. בוחרים כיתה ונושא מהקטלוג.</p>';
    printArea.innerHTML = PRINT_UNPREPARED;
    return;
  }
  const carried = pageBlocks();
  const savedQuestions = carried.flatMap((block) => block.questions);
  const onPage = new Set(savedQuestions.map((question) => exKey(question.source.pdfId, question.id)));
  const current = (await resolveChosen()).filter((question) => !onPage.has(exKey(question.source.pdfId, question.id)));
  const chosen = savedQuestions.concat(current);
  const blocks = carried.length || state.sectionKind === 'test'
    ? carried.concat(current.length ? [{ kind: sectionKind(state.sectionKind), title: currentTopic() ? currentTopic().title : '', questions: current }] : [])
    : null;
  if (!chosen.length) {
    plan.innerHTML = '<p>עדיין לא נבחרו שאלות מתוך הקטלוג.</p>';
    printArea.innerHTML = PRINT_UNPREPARED;
    return;
  }
  const note = $('teacher-note').value.trim();
  const cfg = SCENARIOS[state.scenario] || SCENARIOS.first;
  if (printMode === 'short') {
    await updateShortPrint(plan, printArea, chosen, note, cfg, blocks);
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
  if (!state.selected.length && !state.blocks.length) {
    announce('עדיין לא נבחרו שאלות.');
    return;
  }
  if (mode === 'marked' && pageNeedsSections()) {
    mode = 'short';
    announce('דף עם קטע מבחן או עם כמה נושאים נבנה כדף מצומצם מהמקור.');
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

function applyScenario(value, options) {
  const quiet = options && options.quiet;
  const before = selectionKey();
  if (!quiet) snapshot();
  state.scenario = value;
  state.expanded = false;
  state.filter = 'all';
    if (value !== 'other') {
    if (state.pickMode !== 'manual') state.selected = assignWholeQuestions(state.lastQuestionCount || 5);
    else state.pickNote = '';
  } else {
    state.pickNote = '';
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
  const run = (async () => {
    await Promise.all(topic.sheets.map(async (sheet) => {
      const source = await loadExerciseSheet(sheet.pdfId);
      await loadQuestionPreviewManifest(source).catch(() => null);
    }));
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
  const stepChanged = document.body.dataset.wizard !== step;
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
    pick: 'בוחרים שאלות',
    result: 'הדף להדפסה',
  };
  $('wizard-label').textContent = labels[step];
  $('wizard-back').hidden = WIZARD_ORDER.indexOf(step) <= 0;
  $('wizard-next').hidden = step === 'result';
  $('wizard-next').textContent = step === 'pick' ? 'אל הדף' : 'המשך';
  const anchor = step === 'result' ? $('wizard-result') : $('wizard-bar');
  if (stepChanged && anchor && anchor.scrollIntoView) anchor.scrollIntoView({ block: 'start', inline: 'nearest' });
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
  if (!state.selected.length && !state.blocks.length) {
    announce('עדיין לא נבחרו שאלות.');
    state.wizard = 'pick';
    applyWizard();
    return;
  }
  preview.textContent = 'מכינים את הדף…';
  printMode = 'short';
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
  document.querySelectorAll('[data-ai-pick]').forEach((btn) => {
    btn.addEventListener('click', () => { void pickWithAi(Number(btn.dataset.aiPick)); });
  });
  $('questions').addEventListener('click', (event) => {
    const zoom = event.target.closest('[data-preview-zoom]');
    if (zoom) {
      const preview = zoom.closest('[data-preview-key]');
      const expanded = preview.classList.toggle('is-zoomed');
      zoom.setAttribute('aria-pressed', expanded ? 'true' : 'false');
      zoom.textContent = expanded ? 'התאמה לרוחב' : 'הגדלת השאלה';
      return;
    }
    const retry = event.target.closest('[data-preview-retry]');
    if (retry) {
      const group = currentQuestions().find((item) => item.key === retry.dataset.previewRetry);
      const preview = retry.closest('[data-preview-key]');
      if (group && preview) queueQuestionPreview(group, preview);
    }
  });
  $('questions').addEventListener('change', (event) => {
    const box = event.target;
    if (box.matches('[data-whole-question]')) toggleWholeQuestion(box.dataset.wholeQuestion, box.checked);
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
    let next = keepVisible(state.selected, visibleSelectionKeys());
    if (!next.length && state.scenario !== 'other') {
      if (state.pickMode !== 'manual') next = assignWholeQuestions(state.lastQuestionCount || 5);
    } else {
      next = expandToWholeQuestionKeys(currentExercises(), next);
    }
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
    state.moreDismissed = false;
    state.topic = '';
    history = [];
    clearPreparedPrint();
    fillTopics();
    await loadCurrentTopic();
    applyScenario(state.scenario === 'other' ? 'first' : state.scenario);
  });
  $('topic').addEventListener('change', async () => {
    state.topic = $('topic').value;
    state.level = 'all';
    state.expanded = false;
    state.selected = [];
    state.moreDismissed = false;
    history = [];
    clearPreparedPrint();
    syncLevels();
    await loadCurrentTopic();
    if (state.scenario === 'other') render();
    else applyScenario(state.scenario, { quiet: true });
  });
  $('filter-all').addEventListener('click', () => { state.filter = 'all'; $('filter-all').setAttribute('aria-pressed', 'true'); $('filter-selected').setAttribute('aria-pressed', 'false'); render(); });
  $('filter-selected').addEventListener('click', () => { state.filter = 'selected'; $('filter-selected').setAttribute('aria-pressed', 'true'); $('filter-all').setAttribute('aria-pressed', 'false'); render(); });
  document.querySelectorAll('[data-pick-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.pickMode = btn.dataset.pickMode === 'manual' ? 'manual' : 'ai';
      if (state.pickMode === 'manual') state.pickNote = '';
      render();
    });
  });
  document.querySelectorAll('[data-section-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sectionKind = sectionKind(btn.dataset.sectionKind);
      clearPreparedPrint();
      render();
    });
  });
  if ($('page-blocks')) $('page-blocks').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-block-remove]');
    const btn = event.target.closest('[data-block-kind]');
    const row = (remove || btn) && (remove || btn).closest('[data-page-block]');
    if (!row) return;
    const index = Number(row.dataset.pageBlock);
    const block = state.blocks[index];
    if (!block) return;
    if (remove) {
      state.blocks.splice(index, 1);
      clearPreparedPrint();
      render();
      announce('הנושא הוסר מהדף.');
      return;
    }
    block.kind = sectionKind(btn.dataset.blockKind);
    clearPreparedPrint();
    render();
  });
  if ($('more-topic-yes')) $('more-topic-yes').addEventListener('click', () => addAnotherTopic());
  if ($('more-topic-no')) $('more-topic-no').addEventListener('click', () => {
    state.moreDismissed = true;
    render();
  });
  document.querySelectorAll('[data-question-count]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.pickMode = 'ai';
      pickQuestionCount(Number(btn.dataset.questionCount));
    });
  });
  $('show-more').addEventListener('click', () => { state.expanded = true; render(); });
  $('undo').addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    const before = selectionKey();
    state.selected = previous;
    state.pickNote = '';
    if (selectionKey() !== before) clearPreparedPrint();
    render();
  });
  if ($('add-suggestion')) $('add-suggestion').addEventListener('click', () => {
    announce('בוחרים שאלה שלמה, לא סעיף בודד.');
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
    if (state.wizard === 'pick') {
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
  state.grade = String(prefill.grade);
  state.topic = String(prefill.topic);
  state.level = prefill.level || 'all';
  state.scenario = 'other';
  state.expanded = true;
  fillGrades();
  fillTopics();
  return loadCurrentTopic().then(() => {
    const allow = new Set(visibleSelectionKeys());
    const ids = (prefill.exerciseIds || []).flatMap((id) => id.startsWith('sheet:')
      ? currentExercises().filter((question) => question.source.pdfId === id.slice(6)).map((question) => exKey(question.source.pdfId, question.id))
      : [id]);
    const saved = carriedKeys();
    state.selected = expandToWholeQuestionKeys(currentExercises(), ids.filter((id) => allow.has(id))).filter((key) => !saved.has(key));
    state.pickNote = '';
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
  // Load configuration and the SDK early. prepare() never creates a token or
  // submits a model request; postJson still performs fresh guarded verification.
  void ensureTeacherBotClient().then((client) => typeof client.prepare === 'function' ? client.prepare() : null).catch(() => {});
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
