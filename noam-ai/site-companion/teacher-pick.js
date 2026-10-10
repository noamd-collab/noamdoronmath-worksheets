/**
 * Teacher requests: Qwen Flash only classifies the words the teacher used.
 * The ids and links that go back are taken from the site catalog after that.
 * Middle school (grades 7–9) returns individual exercises that already exist.
 * Elementary returns the matching sheet, topic, and level — not single items.
 */
import { QWEN_CHAT_URL, QWEN_MODEL } from "./companion.js";
import { buildCatalogRecords } from "./retrieve.js";

export const CLASSIFIER_MAX_TOKENS = 300;
export const MAX_PICKED_EXERCISES = 6;
export const MAX_PICKED_SHEETS = 3;
export const DEFAULT_MIDDLE_EXERCISES = 4;

export const CLASSIFIER_SYSTEM = [
  "אתה מסווג בקשה של מורה. אתה לא רמזי ולא פותר תרגיל.",
  "אל תמציא כיתה, נושא, רמה או מספר שאלה.",
  "החזר JSON בלבד, בלי טקסט מסביב:",
  '{"grade":null,"topicQuery":"","level":null,"exerciseLabels":[],"wantsSheet":false}',
  "grade הוא מספר מ־1 עד 9, או null אם המורה לא אמר כיתה.",
  "level הוא a או b או c, או null.",
  "exerciseLabels רק מספרים שהמורה כתב, בצורת 1א או 2ב.",
  "wantsSheet הוא true כשהמורה ביקש דף, נושא או רמה בלי סעיף מסוים.",
].join("\n");

const LABEL_RE = /(\d{1,2})\s*([\u05D0-\u05EA])/g;

function clip(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max) : text;
}

function teacherOf(input) {
  const teacher = input && input.teacher && typeof input.teacher === "object" ? input.teacher : {};
  return {
    grade: clip(teacher.grade, 8),
    gradeLabel: clip(teacher.gradeLabel, 80),
    topic: clip(teacher.topic, 80),
    topicLabel: clip(teacher.topicLabel, 80),
    level: clip(teacher.level, 8),
    note: clip(teacher.note, 400),
  };
}

function messageOf(input) {
  return clip(input && input.message, 700);
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
  const match = text.match(/^(\d{1,2})([\u05D0-\u05EA])$/);
  return match ? match[1] + match[2] : "";
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
      level: level === "a" || level === "b" || level === "c" ? level : null,
      exerciseLabels: labels.map(normalizeLabel).filter(Boolean).slice(0, 12),
      wantsSheet: parsed.wantsSheet === true,
    };
  } catch (error) {
    return null;
  }
}

export function classifierRequestBody(input) {
  const teacher = teacherOf(input);
  const page = input && input.page && typeof input.page === "object" ? input.page : {};
  return {
    model: QWEN_MODEL,
    stream: false,
    enable_thinking: false,
    max_tokens: CLASSIFIER_MAX_TOKENS,
    messages: [
      { role: "system", content: CLASSIFIER_SYSTEM },
      {
        role: "user",
        content: [
          "עמוד: " + clip(page.kind, 32) + " " + clip(page.path, 200),
          "בקשה: " + messageOf(input),
          "כיתה בטופס: " + teacher.grade + " " + teacher.gradeLabel,
          "נושא בטופס: " + teacher.topic + " " + teacher.topicLabel,
          "רמה בטופס: " + teacher.level,
          "הערת מורה: " + teacher.note,
        ].join("\n"),
      },
    ],
  };
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
  return level === "a" || level === "b" || level === "c" ? level : "";
}

function sheetScore(sheet, queryTokens) {
  const hay = (sheet.topic + " " + sheet.title + " " + sheet.gradeLabel + " " + sheet.levelLabel).toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (hay.includes(token)) score += token.length > 3 ? 3 : 1;
  }
  return score;
}

export function selectTeacherPicks(index, input, classification) {
  const rows = Array.isArray(index) ? index : [];
  const teacher = teacherOf(input);
  const classified = classification || {};
  const grade = numberOrNull(teacher.grade) || numberOrNull(classified.grade);
  const topicId = /^\d{1,6}$/.test(teacher.topic) ? String(teacher.topic) : "";
  const level = levelOrEmpty(teacher.level) || levelOrEmpty(classified.level);
  const queryTokens = tokens(
    [messageOf(input), teacher.topicLabel, teacher.note, teacher.gradeLabel, classified.topicQuery].join(" ")
  );
  let pool = rows.filter((sheet) => {
    if (grade && Number(sheet.grade) !== grade) return false;
    if (topicId && String(sheet.topicId) !== topicId) return false;
    if (level && String(sheet.level) !== level) return false;
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
  if (band === "elementary") {
    const chosenSheets = pool.slice(0, MAX_PICKED_SHEETS);
    return {
      band,
      exerciseIds: [],
      sheetIds: chosenSheets.map((sheet) => "sheet:" + sheet.pdfId),
      sheets: chosenSheets,
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
  const viewer = records.find((record) => record.pdfId === sheet.pdfId);
  if (viewer && viewer.href) return viewer.href;
  return sheet.pdfUrl || "";
}

export function describePicks(pick) {
  const sheets = pick.sheets || [];
  if (!sheets.length) return "";
  const place = sheets
    .map((sheet) => [sheet.gradeLabel, sheet.topic, sheet.levelLabel].filter(Boolean).join(" · "))
    .join(" ; ");
  if (pick.band === "elementary") {
    return "הדף שכבר קיים באתר: " + place + ".";
  }
  const labels = (pick.exerciseIds || []).map((id) => String(id).split(":").pop()).join(", ");
  return "שאלות שכבר קיימות בדף " + place + ": " + labels + ".";
}

export async function classifyTeacherRequest(input, options) {
  const settings = options || {};
  const fetcher = settings.fetch;
  if (!settings.apiKey || typeof fetcher !== "function") return null;
  const response = await fetcher(QWEN_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + settings.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(classifierRequestBody(input)),
  });
  if (!response || !response.ok) throw new Error("QWEN_HTTP");
  const data = await response.json();
  const content =
    data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return parseClassifier(content);
}
