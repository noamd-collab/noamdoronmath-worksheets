/**
 * Teacher requests: Qwen Flash only classifies the words the teacher used.
 * The ids and links that go back are taken from the site catalog after that.
 * Question choices in every grade are grounded in the mapped source exercises.
 */
import { QWEN_MODEL, callQwen } from "./companion.js";
import { resolveNavigationIntent } from "./intent.js";
import { buildCatalogRecords } from "./retrieve.js";

export const CLASSIFIER_MAX_TOKENS = 300;
export const BATCH_CLASSIFIER_MAX_TOKENS = 600;
export const MAX_PICKED_EXERCISES = 6;
export const MAX_BATCH_PICK_EXERCISES = 60;
export const BATCH_PICK_COUNTS = [15, 30, 45];
export const MAX_PICKED_SHEETS = 3;
export const DEFAULT_MIDDLE_EXERCISES = 4;

export const CLASSIFIER_SYSTEM = [
  "אתה מסווג בקשה של מורה. אתה לא רמזי ולא פותר תרגיל.",
  "אל תמציא כיתה, נושא, רמה או מספר שאלה.",
  "החזר JSON בלבד, בלי טקסט מסביב:",
  '{"grade":null,"topicQuery":"","level":null,"exerciseLabels":[],"wantsSheet":false}',
  "grade הוא מספר מ־1 עד 9, או null אם המורה לא אמר כיתה.",
  "level הוא a או b או c, או null.",
  "exerciseLabels הם מזהים מהרשימה בלבד: 1 או 16 לשאלה בלי סעיפים, 1א או 2ב לשאלה עם סעיפים, או a:16, b:1א ו־c2:1א כאשר המזהה כולל רמה. העתק את המזהה בדיוק כפי שהוא ברשימה.",
  "אם צוינה כמות מבוקשת לבחירה, בחר בדיוק את הכמות המבוקשת מתוך רשימת השאלות הקיימות, בהתאם למטרת השיעור, לסגנון ההוראה ולהערת המורה. כל מזהה שניתן לך מייצג שאלה שלמה; אין לבחור מזהה שאינו ברשימה.",
  "כאשר הערת המורה מבקשת שאלות מסוימות שקיימות ברשימה, כבד את הבחירה המפורשת ולא רק את סדר השאלות או סגנון השיעור.",
  "wantsSheet הוא true כשהמורה ביקש דף, נושא או רמה בלי סעיף מסוים.",
].join("\n");

const LABEL_RE = /(\d{1,2})\s*([\u05D0-\u05EA])(?![\u05D0-\u05EA])/g;
const BATCH_COUNT_RE = /(?:בחר|בחרי|לבחור|תבחר)\s*(\d{1,2})(?![\s'׳]*[\u05D0-\u05EA](?![\u05D0-\u05EA]))/;

function clip(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max) : text;
}

function sanitizeCandidates(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = normalizeScopedLabel(item.id || item.label);
    const label = normalizeLabel(id);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label,
      text: clip(item.text, 80),
    });
  }
  return out;
}

function teacherOf(input) {
  const teacher = input && input.teacher && typeof input.teacher === "object" ? input.teacher : {};
  const rawCount = Number(teacher.count);
  const count = Number.isInteger(rawCount) && rawCount > 0 ? Math.min(rawCount, MAX_BATCH_PICK_EXERCISES) : 0;
  return {
    grade: clip(teacher.grade, 8),
    gradeLabel: clip(teacher.gradeLabel, 80),
    topic: clip(teacher.topic, 80),
    topicLabel: clip(teacher.topicLabel, 80),
    level: clip(teacher.level, 8),
    goal: clip(teacher.goal, 32),
    goalLabel: clip(teacher.goalLabel, 80),
    style: clip(teacher.style, 32),
    styleLabel: clip(teacher.styleLabel, 80),
    note: clip(teacher.note, 400),
    count,
    candidates: sanitizeCandidates(teacher.candidates),
  };
}

function messageOf(input) {
  return clip(input && input.message, 700);
}

export function requestedPickCount(input) {
  const teacher = teacherOf(input);
  if (teacher.count > 0) return teacher.count;
  const match = messageOf(input).match(BATCH_COUNT_RE);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_BATCH_PICK_EXERCISES) : 0;
}

export function labelsInText(value) {
  const found = [];
  const seen = new Set();
  const source = String(value || "");
  for (const match of source.matchAll(LABEL_RE)) {
    const label = match[1] + match[2];
    if (seen.has(label)) continue;
    seen.add(label);
    found.push(label);
  }
  return found;
}

export function normalizeLabel(value) {
  const text = String(value || "").replace(/\s+/g, "").replace(/['׳]/g, "");
  const scoped = text.match(/^(?:(?:[abc]|c2):)?([1-9]\d{0,2})([\u05D0-\u05EA]?)$/i);
  return scoped ? scoped[1] + scoped[2] : "";
}

function normalizeScopedLabel(value) {
  const text = String(value || "").replace(/\s+/g, "").replace(/['׳]/g, "");
  const match = text.match(/^([abc]|c2):([1-9]\d{0,2})([\u05D0-\u05EA]?)$/i);
  if (match) return match[1].toLowerCase() + ":" + match[2] + match[3];
  const plain = normalizeLabel(text);
  return plain;
}

export function parseClassifier(content) {
  const raw = String(content || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const grade = Number(parsed.grade);
    const level = String(parsed.level || "").toLowerCase();
    const labels = Array.isArray(parsed.exerciseLabels) ? parsed.exerciseLabels : [];
    return {
      grade: grade >= 1 && grade <= 9 ? grade : null,
      topicQuery: clip(parsed.topicQuery, 80),
      level: level === "a" || level === "b" || level === "c" || level === "c2" ? level : null,
      exerciseLabels: labels.map(normalizeLabel).filter(Boolean).slice(0, MAX_BATCH_PICK_EXERCISES),
      scopedExerciseLabels: labels.map(normalizeScopedLabel).filter(Boolean).slice(0, MAX_BATCH_PICK_EXERCISES),
      wantsSheet: parsed.wantsSheet === true,
    };
  } catch (error) {
    return null;
  }
}

export function classifierRequestBody(input, index) {
  const teacher = teacherOf(input);
  const count = requestedPickCount(input);
  const page = input && input.page && typeof input.page === "object" ? input.page : {};
  const lines = [
    "עמוד: " + clip(page.kind, 32) + " " + clip(page.path, 200),
    "בקשה: " + messageOf(input),
    "כיתה בטופס: " + teacher.grade + " " + teacher.gradeLabel,
    "נושא בטופס: " + teacher.topic + " " + teacher.topicLabel,
    "רמה בטופס: " + teacher.level,
    "מטרת השיעור: " + teacher.goal + " " + teacher.goalLabel,
    "סגנון הוראה: " + teacher.style + " " + teacher.styleLabel,
    "הערת מורה: " + teacher.note,
  ];
  if (count > 0) {
    lines.push("כמות מבוקשת לבחירה: " + count);
    const matching = matchingTeacherSheets(index, teacher);
    const knownIds = new Set();
    for (const sheet of matching) {
      for (const rawLabel of sheet.questions || []) {
        const label = normalizeLabel(rawLabel);
        if (!label) continue;
        knownIds.add(label);
        if (/^(?:[abc]|c2)$/.test(sheet.level)) knownIds.add(sheet.level + ":" + label);
      }
    }
    const candidates = Array.isArray(index)
      ? teacher.candidates.filter((candidate) => knownIds.has(candidate.id))
      : teacher.candidates;
    if (candidates.length) {
      lines.push(
        "שאלות קיימות בדף לבחירה: " +
          candidates
            .map((item) => (item.text ? `${item.id} (${item.text})` : item.id))
            .join(" | ")
      );
    } else if (Array.isArray(index) && index.length) {
      const availableLabels = [];
      const seen = new Set();
      for (const sheet of matching) {
        const prefix = matching.length > 1 && /^(?:[abc]|c2)$/.test(sheet.level) ? sheet.level + ":" : "";
        for (const q of sheet.questions || []) {
          const label = normalizeLabel(q);
          const id = prefix + label;
          if (!label || seen.has(id)) continue;
          seen.add(id);
          availableLabels.push(id);
        }
      }
      if (availableLabels.length) {
        lines.push("סעיפים קיימים בדף לבחירה: " + availableLabels.join(", "));
      }
    }
  }
  return {
    model: QWEN_MODEL,
    stream: false,
    enable_thinking: false,
    max_tokens: count > 6 ? BATCH_CLASSIFIER_MAX_TOKENS : CLASSIFIER_MAX_TOKENS,
    messages: [
      { role: "system", content: CLASSIFIER_SYSTEM },
      {
        role: "user",
        content: lines.join("\n"),
      },
    ],
  };
}

function matchingTeacherSheets(index, teacher) {
  const grade = numberOrNull(teacher.grade);
  const topic = /^\d{1,6}$/.test(teacher.topic) ? String(teacher.topic) : "";
  const level = levelOrEmpty(teacher.level);
  // A page picker always identifies its grade and topic. An open-ended chat
  // request is classified first; do not send the entire site as its candidate pool.
  if (!grade || !topic) return [];
  return (Array.isArray(index) ? index : []).filter((sheet) => {
    if (grade && Number(sheet.grade) !== grade) return false;
    if (topic && String(sheet.topicId) !== topic) return false;
    if (!matchesTeacherLevel(sheet, level)) return false;
    return Array.isArray(sheet.questions) && sheet.questions.length > 0;
  });
}

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length >= 2);
}

function numberOrNull(value) {
  const grade = Number(value);
  return grade >= 1 && grade <= 9 ? grade : null;
}

function levelOrEmpty(value) {
  const level = String(value || "").toLowerCase();
  return level === "a" || level === "b" || level === "c" || level === "c2" ? level : "";
}

function matchesTeacherLevel(sheet, level) {
  return !level || String(sheet.level) === level || sheet.level === "one" ||
    (level === "c" && sheet.level === "c2");
}

function sheetScore(sheet, queryTokens) {
  const hay = (sheet.topic + " " + sheet.title + " " + sheet.gradeLabel + " " + sheet.levelLabel).toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (hay.includes(token)) score += token.length > 3 ? 3 : 1;
  }
  return score;
}

function orderPoolByGoal(available, goal) {
  if (!available.length) return [];
  const total = available.length;
  if (goal === "spiral") {
    const step = Math.max(1, Math.floor(total / 15));
    const ordered = [];
    for (let offset = 0; offset < step; offset += 1) {
      for (let i = offset; i < total; i += step) ordered.push(available[i]);
    }
    return ordered;
  }
  if (goal === "exam") {
    const start = Math.floor(total * 0.25);
    return available.slice(start).concat(available.slice(0, start));
  }
  if (goal === "practice") {
    const start = Math.min(Math.floor(total * 0.08), 4);
    return available.slice(start).concat(available.slice(0, start));
  }
  return available.slice();
}

export function selectBatchExercises(pool, count, goal, classified, candidates) {
  const available = [];
  const knownKeys = new Set();
  const allowed = Array.isArray(candidates) && candidates.length
    ? new Set(candidates.map((item) => item.id))
    : null;
  let orderIndex = 0;
  for (const sheet of pool) {
    for (const rawLabel of sheet.questions || []) {
      const label = String(rawLabel);
      const key = "ex:" + sheet.pdfId + ":" + label;
      const scoped = /^(?:[abc]|c2)$/.test(String(sheet.level)) ? sheet.level + ":" + label : label;
      if (knownKeys.has(key) || (allowed && !allowed.has(scoped) && !allowed.has(label))) continue;
      knownKeys.add(key);
      available.push({
        key,
        sheet,
        label,
        scoped,
        orderIndex: orderIndex++,
      });
    }
  }
  if (!available.length) return { exerciseIds: [], modelExerciseIds: [], sheets: [], selectionSource: "fallback" };
  const target = Math.min(count, available.length);
  const chosen = [];
  const used = new Set();
  const addItem = (item) => {
    if (!item || used.has(item.key) || chosen.length >= target) return;
    used.add(item.key);
    chosen.push(item);
  };
  const scopedLabels = Array.isArray(classified && classified.scopedExerciseLabels)
    ? classified.scopedExerciseLabels
    : Array.isArray(classified && classified.exerciseLabels)
      ? classified.exerciseLabels
      : [];
  for (const raw of scopedLabels) {
    const token = String(raw || "");
    const matches = available.filter((item) => token.includes(":")
      ? item.scoped === token
      : item.label === token);
    // A missing level must not silently become a choice of the first level.
    // Match before excluding used keys so repeated labels cannot consume a
    // different source question and be reported as additional model choices.
    const match = matches.length === 1 ? matches[0] : null;
    if (match) addItem(match);
    if (chosen.length >= target) break;
  }
  const modelExerciseIds = chosen.map((item) => item.key);
  if (chosen.length < target) {
    const ordered = orderPoolByGoal(available, goal);
    const remaining = ordered.filter((item) => !used.has(item.key));
    const needed = target - chosen.length;
    if (remaining.length <= needed) {
      remaining.forEach(addItem);
    } else if (goal === "spiral" || goal === "other") {
      for (let i = 0; i < needed; i += 1) {
        const idx = Math.min(remaining.length - 1, Math.floor((i * remaining.length) / needed));
        addItem(remaining[idx]);
      }
      remaining.forEach(addItem);
    } else {
      remaining.slice(0, needed).forEach(addItem);
    }
  }
  chosen.sort((a, b) => a.orderIndex - b.orderIndex);
  const exerciseIds = chosen.map((item) => item.key);
  const pickedSheets = pool.filter((sheet) =>
    exerciseIds.some((id) => id.startsWith("ex:" + sheet.pdfId + ":"))
  );
  const selectionSource = modelExerciseIds.length === target ? "classifier" : modelExerciseIds.length ? "mixed" : "fallback";
  return { exerciseIds, modelExerciseIds, sheets: pickedSheets, selectionSource };
}

export function selectTeacherPicks(index, input, classification) {
  const rows = Array.isArray(index) ? index : [];
  const teacher = teacherOf(input);
  const classified = classification || {};
  const local = resolveNavigationIntent(input);
  const grade = numberOrNull(teacher.grade) || numberOrNull(classified.grade) || local.grade;
  const topicId = /^\d{1,6}$/.test(teacher.topic) ? String(teacher.topic) : "";
  const batchCount = requestedPickCount(input);
  const explicitAllLevels = batchCount > 0 && String(teacher.level || "").toLowerCase() === "all";
  const level = explicitAllLevels
    ? ""
    : levelOrEmpty(teacher.level) || levelOrEmpty(classified.level) || (batchCount > 0 ? "" : local.level);
  const queryTokens = tokens(
    [messageOf(input), teacher.topicLabel, teacher.note, teacher.gradeLabel, classified.topicQuery, local.subject].join(" ")
  );
  let pool = rows.filter((sheet) => {
    if (grade && Number(sheet.grade) !== grade) return false;
    if (topicId && String(sheet.topicId) !== topicId) return false;
    if (!matchesTeacherLevel(sheet, level)) return false;
    return true;
  });
  if (!topicId) {
    const ranked = pool
      .map((sheet) => ({ sheet, score: sheetScore(sheet, queryTokens) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.sheet.grade - b.sheet.grade);
    pool = ranked.map((row) => row.sheet);
  }
  if (!pool.length) {
    return { band: grade && grade <= 6 ? "elementary" : "middle", exerciseIds: [], sheetIds: [], sheets: [] };
  }
  const band = pool[0].band === "elementary" || Number(pool[0].grade) <= 6 ? "elementary" : "middle";
  if (band === "elementary" && !batchCount && !pool.some((sheet) => sheet.mode === "exercise" && sheet.questions?.length)) {
    const chosenSheets = pool.slice(0, MAX_PICKED_SHEETS);
    return {
      band,
      exerciseIds: [],
      sheetIds: chosenSheets.map((sheet) => "sheet:" + sheet.pdfId),
      sheets: chosenSheets,
    };
  }
  if (batchCount > 0) {
    const picked = selectBatchExercises(pool, batchCount, teacher.goal || "first", classified, teacher.candidates);
    return {
      band,
      exerciseIds: picked.exerciseIds,
      modelExerciseIds: picked.modelExerciseIds,
      selectionSource: picked.selectionSource,
      sheetIds: [],
      sheets: picked.sheets,
    };
  }
  const asked = labelsInText(messageOf(input) + " " + teacher.note);
  if (asked.length) {
    const exerciseIds = [];
    const used = new Set();
    for (const sheet of pool) {
      const existing = new Set((sheet.questions || []).map(String));
      for (const label of asked) {
        if (!existing.has(label) || used.has(sheet.pdfId + ":" + label)) continue;
        used.add(sheet.pdfId + ":" + label);
        exerciseIds.push("ex:" + sheet.pdfId + ":" + label);
        if (exerciseIds.length >= MAX_PICKED_EXERCISES) break;
      }
      if (exerciseIds.length >= MAX_PICKED_EXERCISES) break;
    }
    const pickedSheets = pool.filter((sheet) =>
      exerciseIds.some((id) => id.startsWith("ex:" + sheet.pdfId + ":"))
    );
    return { band, exerciseIds, sheetIds: [], sheets: pickedSheets };
  }
  const sheet = pool[0];
  const labels = (sheet.questions || []).slice(0, DEFAULT_MIDDLE_EXERCISES);
  if (!labels.length) return { band, exerciseIds: [], sheetIds: [], sheets: [] };
  return {
    band,
    exerciseIds: labels.map((label) => "ex:" + sheet.pdfId + ":" + label),
    sheetIds: [],
    sheets: [sheet],
  };
}

export function hrefForSheet(sheet, catalog) {
  const records = buildCatalogRecords(catalog || {});
  // The same original PDF can serve topics in more than one grade. Keep the
  // requested catalog context; its viewer still uses the original source g/x.
  const matching = records.filter((record) => record.pdfId === sheet.pdfId &&
    (sheet.grade == null || Number(record.grade) === Number(sheet.grade)));
  const sameTopic = matching.filter((record) => sheet.topicId == null || String(record.topicId) === String(sheet.topicId));
  const viewer = sameTopic.find((record) => record.levelKey === sheet.level) || sameTopic[0] || matching[0];
  if (viewer && viewer.href) return viewer.href;
  return sheet.pdfUrl || "";
}

export function describePicks(pick) {
  const sheets = pick.sheets || [];
  if (!sheets.length) return "";
  const place = sheets
    .map((sheet) => [sheet.gradeLabel, sheet.topic, sheet.levelLabel].filter(Boolean).join(" · "))
    .join(" ; ");
  if (!(pick.exerciseIds || []).length && (pick.sheetIds || []).length) {
    return "הדף שכבר קיים באתר: " + place + ".";
  }
  const allLabels = (pick.exerciseIds || []).map((id) => String(id).split(":").pop());
  const labels = allLabels.length > 10
    ? allLabels.slice(0, 8).join(", ") + ` ועוד ${allLabels.length - 8} סעיפים (${allLabels.length} סה״כ)`
    : allLabels.join(", ");
  return "שאלות שכבר קיימות בדף " + place + ": " + labels + ".";
}

export async function classifyTeacherRequest(input, options) {
  const settings = options || {};
  const fetcher = settings.fetch;
  if (!settings.apiKey || typeof fetcher !== "function") return null;
  const called = await callQwen(settings, classifierRequestBody(input, settings.teacherIndex));
  const data = called.data;
  const content =
    data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return parseClassifier(content);
}
