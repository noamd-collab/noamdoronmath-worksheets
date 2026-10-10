/**
 * Site companion for Noam AI. Separate role from Ramzi.
 * Retrieval is limited to the verified catalog. The model may only rank and explain those records.
 * qwen3.8-flash is called server-side. This module never reads a key from the browser.
 */
import { fetchWithTimeout } from "./bot-guard.js";
import { retrieveRecords } from "./retrieve.js";

export const QWEN_CHAT_URL =
  "https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions";
export const QWEN_MODEL = "qwen3.8-flash";
export const MAX_OUTPUT_TOKENS = 800;
export const QWEN_TIMEOUT_MS = 12_000;

export const FALLBACK_TEXT =
  "נועם AI לא זמין כרגע. לא הצגתי הצעה מומצאת. נסו שוב בעוד רגע.";
export const MISSING_TEXT =
  "לא מצאתי חומר תואם בקטלוג המאומת של האתר. לא המצאתי דף או שאלה.";
export const RAMZI_TEXT =
  "עזרה בפתרון השאלה שייכת לרמזי, עוזר הלמידה בדף העבודה. לחצו על «עזרה מרמזי». נועם AI מכוון באתר ולא נותן רמז לפתרון.";
export const EXPORT_NOTE =
  "במקרה פירוק לגורמים לכיתה ט׳ רמה א׳, אפשר לסמן את השאלות שנבחרו על דף המקור המלא, או להדפיס דף מצומצם שנחתך מאותו מקור עם ההוראה והנוסח המקוריים.";
export const QUESTION_GAP =
  "נועם AI לא בוחר סעיפים בעצמו ולא ממציא שאלות. הבחירה היא מתוך השאלות שכבר קיימות בדף.";

export const SYSTEM_PROMPT = [
  "אתה נועם AI, המלווה של האתר. אתה לא רמזי.",
  "רמזי נותן רמזים ושרטוט לשאלה בדף עבודה. אסור לך לתת רמז, פתרון, תשובה סופית או שרטוט.",
  "התפקיד שלך: להבין צורך, לבחור רק מתוך הרשומות שסופקו, להסביר איפה ללחוץ, ולכוון לדפים קיימים.",
  "אסור להמציא דף, שאלה, מספר סעיף או כתובת. אם אין רשומה מתאימה, אמור שהנתון חסר.",
  "החזר JSON בלבד בלי טקסט מסביב:",
  '{"answer":"משפט קצר","details":"פירוט קצר","primaryRecordId":"id","chipRecordIds":["id"]}',
  "answer הוא משפט ניווט אחד. chipRecordIds מכיל לכל היותר שניים. בלי כתובות URL. אל תמציא סעיפים חיוניים.",
].join("\n");

export const SOLVE_REQUEST_SOURCE =
  "רמז|לפתור|תפתור|מה התשובה|איך פותרים|הדרך לפתרון|\\bhint\\b|\\bsolve\\b|the answer";
const SOLVE_REQUEST = new RegExp(SOLVE_REQUEST_SOURCE, "i");

export const MAX_PAGE_TITLE_CHARS = 120;
export const MAX_PAGE_PATH_CHARS = 200;
export const MAX_TEACHER_NOTE_CHARS = 400;
export const MAX_TEACHER_FIELD_CHARS = 80;
const MAX_PROMPT_MESSAGE_CHARS = 700;

function clip(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max) : text;
}

export function boundCompanionInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const page = source.page && typeof source.page === "object" ? source.page : {};
  const teacher = source.teacher && typeof source.teacher === "object" ? source.teacher : null;
  return {
    message: clip(source.message, MAX_PROMPT_MESSAGE_CHARS),
    page: {
      kind: clip(page.kind, 32),
      path: clip(page.path, MAX_PAGE_PATH_CHARS),
      title: clip(page.title, MAX_PAGE_TITLE_CHARS),
    },
    teacher: teacher
      ? {
          grade: clip(teacher.grade, 8),
          gradeLabel: clip(teacher.gradeLabel, MAX_TEACHER_FIELD_CHARS),
          topic: clip(teacher.topic, MAX_TEACHER_FIELD_CHARS),
          topicLabel: clip(teacher.topicLabel, MAX_TEACHER_FIELD_CHARS),
          goal: clip(teacher.goal, 32),
          goalLabel: clip(teacher.goalLabel, MAX_TEACHER_FIELD_CHARS),
          style: clip(teacher.style, 32),
          styleLabel: clip(teacher.styleLabel, MAX_TEACHER_FIELD_CHARS),
          note: clip(teacher.note, MAX_TEACHER_NOTE_CHARS),
        }
      : null,
  };
}

export function isWorksheetSolveRequest(pageKind, message) {
  return pageKind === "worksheet" && SOLVE_REQUEST.test(String(message || ""));
}

function teacherQuery(input) {
  const teacher = (input && input.teacher) || {};
  return [
    teacher.gradeLabel,
    teacher.topicLabel,
    teacher.goalLabel,
    teacher.styleLabel,
    teacher.note,
    input && input.message,
  ]
    .filter(Boolean)
    .join(" ");
}

function exportNoteFor(input) {
  return input && input.page && input.page.kind === "teachers" ? EXPORT_NOTE : "";
}

function linkOf(record) {
  return {
    recordId: record.id,
    title: record.gradeLabel + " · " + record.title + " · " + record.levelLabel,
    href: record.href,
    grade: record.grade,
    level: record.levelKey,
  };
}

function emptyResult(source, text, input, extra) {
  const teacher = input && input.page && input.page.kind === "teachers";
  const details = [text, teacher ? QUESTION_GAP : "", teacher ? EXPORT_NOTE : ""].filter(Boolean).join("\n");
  return Object.assign(
    {
      ok: source !== "fallback",
      source,
      model: null,
      answer: text,
      text,
      details,
      primary: source === "ramzi-redirect" ? { label: "עזרה מרמזי", action: "ramzi" } : null,
      chips: [],
      options: [],
      links: [],
      essential: [],
      essentialNote: teacher ? QUESTION_GAP : "",
      exportNote: exportNoteFor(input),
    },
    extra || {}
  );
}

export function buildUserPrompt(input, records) {
  const safe = boundCompanionInput(input);
  const page = safe.page || {};
  const teacherInput = { message: safe.message, teacher: safe.teacher, page: safe.page };
  const lines = records.map((record) => {
    return (
      record.id +
      " | " +
      record.gradeLabel +
      " | " +
      record.title +
      " | " +
      record.levelLabel +
      " | " +
      (record.description || "")
    );
  });
  return [
    "עמוד נוכחי: " + (page.kind || "other") + " " + (page.path || "") + " " + (page.title || ""),
    "בקשת המשתמש: " + String(safe.message || ""),
    "הקשר מורה: " + teacherQuery(teacherInput),
    "רשומות מאומתות בלבד:",
    lines.join("\n"),
  ].join("\n");
}

function parseModelJson(content) {
  const raw = String(content || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("MODEL_JSON");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object") throw new Error("MODEL_JSON");
  return parsed;
}

function stripUnknownUrls(text, allowed) {
  return String(text || "").replace(/https?:\/\/[^\s)]+/g, (url) => {
    return allowed.has(url) ? url : "";
  });
}

function actionFrom(record) {
  return {
    id: record.id,
    label: record.gradeLabel + " · " + record.title,
    href: record.href,
  };
}

export function groundModelPayload(parsed, records, input) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const allowed = new Set(records.map((record) => record.href));
  const legacy = Array.isArray(parsed.optionRecordIds) ? parsed.optionRecordIds.map(String) : [];
  const primaryRecord = byId.get(String(parsed.primaryRecordId || legacy[0] || ""));
  const chipSource = Array.isArray(parsed.chipRecordIds) ? parsed.chipRecordIds : legacy.slice(1);
  const chips = [];
  for (const id of chipSource) {
    const record = byId.get(String(id));
    if (!record || chips.length >= 2) continue;
    if (primaryRecord && record.id === primaryRecord.id) continue;
    chips.push(actionFrom(record));
  }
  const teacher = input && input.page && input.page.kind === "teachers";
  const answer = stripUnknownUrls(parsed.answer || parsed.text, allowed).trim() || "אלה הדפים שנמצאו בקטלוג. לחצו על הקישור.";
  const detailBody = stripUnknownUrls(parsed.details || "", allowed).trim();
  const details = [detailBody, teacher ? QUESTION_GAP : "", teacher ? EXPORT_NOTE : ""].filter(Boolean).join("\n");
  const primary = primaryRecord ? actionFrom(primaryRecord) : null;
  const links = [];
  if (primary) links.push(linkOf(primaryRecord));
  for (const chip of chips) {
    const record = byId.get(chip.id);
    if (record) links.push(linkOf(record));
  }
  return {
    ok: true,
    source: "model",
    model: QWEN_MODEL,
    answer,
    text: answer,
    details,
    primary,
    chips,
    options: chips,
    links,
    essential: [],
    essentialNote: teacher ? QUESTION_GAP : "",
    exportNote: exportNoteFor(input),
  };
}

export function qwenRequestBody(input, records) {
  return {
    model: QWEN_MODEL,
    stream: false,
    enable_thinking: false,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input, records) },
    ],
  };
}

export async function handleCompanionTurn(input, options) {
  const settings = options || {};
  const safe = boundCompanionInput(input);
  const pageKind = safe.page && safe.page.kind;
  const message = String((input && input.message) || "");
  if (isWorksheetSolveRequest(pageKind, message)) {
    return emptyResult("ramzi-redirect", RAMZI_TEXT, safe);
  }
  const query = teacherQuery(safe) || (safe.page && safe.page.title) || "";
  const records = retrieveRecords(settings.catalog, query, 6);
  if (!records.length) {
    return emptyResult("catalog-gap", MISSING_TEXT, safe);
  }
  if (!settings.apiKey) {
    return emptyResult("fallback", FALLBACK_TEXT, safe, { ok: false, error: FALLBACK_TEXT });
  }
  const fetcher = settings.fetch;
  if (typeof fetcher !== "function") {
    return emptyResult("fallback", FALLBACK_TEXT, safe, { ok: false, error: FALLBACK_TEXT });
  }
  try {
    const response = await fetchWithTimeout(fetcher, QWEN_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + settings.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(qwenRequestBody(safe, records)),
    }, typeof settings.timeoutMs === "number" ? settings.timeoutMs : QWEN_TIMEOUT_MS);
    if (!response || !response.ok) throw new Error("QWEN_HTTP");
    const data = await response.json();
    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    return groundModelPayload(parseModelJson(content), records, safe);
  } catch (error) {
    return emptyResult("fallback", FALLBACK_TEXT, safe, { ok: false, error: FALLBACK_TEXT });
  }
}
