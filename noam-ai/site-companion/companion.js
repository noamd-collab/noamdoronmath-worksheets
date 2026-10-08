/**
 * Site companion for Noam AI. Separate role from Ramzi.
 * Retrieval is limited to the verified catalog. The model may only rank and explain those records.
 * qwen3.8-flash is called server-side. This module never reads a key from the browser.
 */
import { retrieveRecords } from "./retrieve.js";

export const QWEN_CHAT_URL =
  "https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions";
export const QWEN_MODEL = "qwen3.8-flash";
export const MAX_OUTPUT_TOKENS = 800;

export const FALLBACK_TEXT =
  "נועם AI לא זמין כרגע. לא הצגתי הצעה מומצאת. נסו שוב בעוד רגע.";
export const MISSING_TEXT =
  "לא מצאתי חומר תואם בקטלוג המאומת של האתר. לא המצאתי דף או שאלה.";
export const RAMZI_TEXT =
  "עזרה בפתרון השאלה שייכת לרמזי, עוזר הלמידה בדף העבודה. לחצו על «עזרה מרמזי». נועם AI מכוון באתר ולא נותן רמז לפתרון.";
export const EXPORT_NOTE =
  "סימון וחיתוך של דף המקור עדיין לא ממומשים. אין כאן ייצוא מזויף.";
export const QUESTION_GAP =
  "אין בקטלוג המאומת פירוט של שאלות בתוך הדף, ולכן אי אפשר לסמן כאן אילו שאלות חיוניות. הקישור הוא לדף הקיים.";

export const SYSTEM_PROMPT = [
  "אתה נועם AI, המלווה של האתר. אתה לא רמזי.",
  "רמזי נותן רמזים ושרטוט לשאלה בדף עבודה. אסור לך לתת רמז, פתרון, תשובה סופית או שרטוט.",
  "התפקיד שלך: להבין צורך, לבחור רק מתוך הרשומות שסופקו, להסביר איפה ללחוץ, ולכוון לדפים קיימים.",
  "אסור להמציא דף, שאלה, מספר סעיף או כתובת. אם אין רשומה מתאימה, אמור שהנתון חסר.",
  "החזר JSON בלבד בלי טקסט מסביב:",
  '{"text":"עברית קצרה","optionRecordIds":["id"],"linkRecordIds":["id"]}',
  "עד שלושה optionRecordIds. בלי כתובות URL. אל תמציא סעיפים חיוניים.",
].join("\n");

const SOLVE_REQUEST =
  /רמז|לפתור|תפתור|פתרון|מה התשובה|איך פותרים|הדרך לפתרון|\bhint\b|\bsolve\b|the answer/i;

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
  return Object.assign(
    {
      ok: source !== "fallback",
      source,
      model: null,
      text,
      options: [],
      links: [],
      essential: [],
      essentialNote: input && input.page && input.page.kind === "teachers" ? QUESTION_GAP : "",
      exportNote: exportNoteFor(input),
    },
    extra || {}
  );
}

export function buildUserPrompt(input, records) {
  const page = (input && input.page) || {};
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
    "בקשת המשתמש: " + String((input && input.message) || ""),
    "הקשר מורה: " + teacherQuery(input),
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

export function groundModelPayload(parsed, records, input) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const allowed = new Set(records.map((record) => record.href));
  const optionIds = Array.isArray(parsed.optionRecordIds) ? parsed.optionRecordIds : [];
  const linkIds = Array.isArray(parsed.linkRecordIds) ? parsed.linkRecordIds : optionIds;
  const options = [];
  for (const id of optionIds) {
    const record = byId.get(String(id));
    if (!record || options.length >= 3) continue;
    options.push({
      id: record.id,
      label: record.gradeLabel + " · " + record.title,
      href: record.href,
    });
  }
  const links = [];
  const seen = new Set();
  for (const id of linkIds) {
    const record = byId.get(String(id));
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    links.push(linkOf(record));
  }
  return {
    ok: true,
    source: "model",
    model: QWEN_MODEL,
    text: stripUnknownUrls(parsed.text, allowed).trim() || "אלה הדפים שנמצאו בקטלוג. לחצו על הקישור.",
    options,
    links,
    essential: [],
    essentialNote: input && input.page && input.page.kind === "teachers" ? QUESTION_GAP : "",
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
  const pageKind = input && input.page && input.page.kind;
  const message = String((input && input.message) || "");
  if (isWorksheetSolveRequest(pageKind, message)) {
    return emptyResult("ramzi-redirect", RAMZI_TEXT, input);
  }
  const query = teacherQuery(input) || (input && input.page && input.page.title) || "";
  const records = retrieveRecords(settings.catalog, query, 6);
  if (!records.length) {
    return emptyResult("catalog-gap", MISSING_TEXT, input);
  }
  if (!settings.apiKey) {
    return emptyResult("fallback", FALLBACK_TEXT, input, { ok: false });
  }
  const fetcher = settings.fetch;
  if (typeof fetcher !== "function") {
    return emptyResult("fallback", FALLBACK_TEXT, input, { ok: false });
  }
  try {
    const response = await fetcher(QWEN_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + settings.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(qwenRequestBody(input, records)),
    });
    if (!response || !response.ok) throw new Error("QWEN_HTTP");
    const data = await response.json();
    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    return groundModelPayload(parseModelJson(content), records, input);
  } catch (error) {
    return emptyResult("fallback", FALLBACK_TEXT, input, { ok: false });
  }
}
