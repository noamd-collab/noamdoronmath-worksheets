/**
 * Teacher brief: read the counts and limits the teacher already said,
 * ask for one missing fact at a time, then pick only catalog questions.
 * No model, no invented exercises.
 */

export const MAX_PICKED_PARTS = 48;

const LEVEL_CHAR = { a: "a", b: "b", c: "c", א: "a", ב: "b", ג: "c" };
const LEVEL_LABEL = { a: "א׳", b: "ב׳", c: "ג׳" };
const PART_RE = /(\d{1,2})\s*([אבגדהו])(?![\u0590-\u05FF])/g;

export function blankBrief() {
  return {
    minParts: null,
    minQuestions: null,
    levels: [],
    excludeExcellence: false,
    strength: null,
    duration: null,
    progressive: null,
    output: null,
    grade: null,
    topicId: "",
  };
}

export function partLabelsInText(value) {
  const found = [];
  const seen = new Set();
  const source = String(value || "");
  for (const match of source.matchAll(PART_RE)) {
    const label = match[1] + match[2];
    if (seen.has(label)) continue;
    seen.add(label);
    found.push(label);
  }
  return found;
}

function takeMax(current, next) {
  const value = Number(next);
  if (!value) return current;
  return Math.max(current || 0, value);
}

function addLevel(brief, letter) {
  const level = LEVEL_CHAR[String(letter || "").toLowerCase()] || LEVEL_CHAR[letter];
  if (!level || brief.levels.indexOf(level) !== -1) return;
  brief.levels.push(level);
}

export function readTeacherBrief(text, base) {
  const brief = Object.assign(blankBrief(), base || {});
  brief.levels = (brief.levels || []).slice();
  const source = String(text || "");
  for (const match of source.matchAll(/(?:לפחות\s*)?(\d{1,2})\s*סעיפים|(?:at least\s*)?(\d{1,2})\s*parts/gi)) {
    brief.minParts = takeMax(brief.minParts, match[1] || match[2]);
  }
  for (const match of source.matchAll(/(?:לפחות\s*)?(\d{1,2})\s*שאלות|(?:at least\s*)?(\d{1,2})\s*questions/gi)) {
    brief.minQuestions = takeMax(brief.minQuestions, match[1] || match[2]);
  }
  for (const match of source.matchAll(/רמה\s*([אבגabc])(?:׳|'|’)?|level\s*([abc])/gi)) {
    addLevel(brief, match[1] || match[2]);
  }
  if (/לא\s*מצוינות|לא\s*הצטיינות|not excellence/i.test(source)) brief.excludeExcellence = true;
  if (/חלש|weak/i.test(source)) brief.strength = "weak";
  else if (/מעורב|בינונ|mixed/i.test(source)) brief.strength = "mixed";
  else if (/כיתה חזקה|תלמידים חזקים|strong class/i.test(source)) brief.strength = "strong";
  if (/שיעור כפול|שיעור ארוך|double/i.test(source)) brief.duration = "double";
  else if (/רבע שעה|15 דקות|short lesson/i.test(source)) brief.duration = "short";
  else if (/שיעור(?! כפול)/.test(source) || /\blesson\b/i.test(source)) brief.duration = "lesson";
  if (/לא מדורג|בלי דירוג|not progressive/i.test(source)) brief.progressive = false;
  else if (/מדורג|קושי עולה|מהקל|progressive/i.test(source)) brief.progressive = true;
  if (/דף מצומצם|דף קצר|short sheet/i.test(source)) brief.output = "short";
  else if (/דף מלא|דף המקור|דף מקור|full sheet/i.test(source)) brief.output = "marked";
  if (brief.excludeExcellence) brief.levels = brief.levels.filter((level) => level !== "c");
  return brief;
}

function chip(label) {
  return { label: label, reply: true };
}

export function nextTeacherQuestion(brief) {
  const fact = brief || blankBrief();
  if (fact.minParts == null && fact.minQuestions == null) {
    return {
      id: "count",
      prompt: "כמה סעיפים או שאלות לשים בדף?",
      chips: [chip("8 סעיפים"), chip("16 סעיפים"), chip("4 שאלות"), chip("8 שאלות")],
    };
  }
  if (!fact.levels.length) {
    const levels = [chip("רמה א׳"), chip("רמה ב׳")];
    if (!fact.excludeExcellence) levels.push(chip("רמה ג׳"));
    return { id: "level", prompt: "באיזו רמה?", chips: levels };
  }
  if (!fact.strength) {
    return {
      id: "strength",
      prompt: "איך הכיתה?",
      chips: [chip("כיתה חלשה"), chip("כיתה מעורבת"), chip("כיתה חזקה")],
    };
  }
  if (!fact.duration) {
    return {
      id: "duration",
      prompt: "כמה זמן יש לשיעור?",
      chips: [chip("רבע שעה"), chip("שיעור"), chip("שיעור כפול")],
    };
  }
  if (fact.progressive == null) {
    return {
      id: "progressive",
      prompt: "לסדר את השאלות מהקל לכבד?",
      chips: [chip("כן, מהקל לכבד"), chip("לא מדורג")],
    };
  }
  if (!fact.output) {
    return {
      id: "output",
      prompt: "דף מקור מלא או דף מצומצם?",
      chips: [chip("דף מלא"), chip("דף מצומצם")],
    };
  }
  return null;
}

export function confirmChips() {
  return [chip("לאשר"), chip("לשנות")];
}

export function editChips() {
  return [chip("המספר"), chip("הרמה"), chip("הכיתה"), chip("הזמן"), chip("הדירוג"), chip("סוג הדף")];
}

function labelRank(label) {
  const match = String(label || "").match(/^(\d{1,2})([אבגדהו])?/);
  const number = match ? Number(match[1]) : 999;
  const letter = match && match[2] ? "אבגדהו".indexOf(match[2]) : 0;
  return number * 10 + (letter < 0 ? 0 : letter);
}

function questionKey(label) {
  const match = String(label || "").match(/^(\d{1,2})/);
  return match ? match[1] : label;
}

function poolFor(index, brief) {
  const rows = Array.isArray(index) ? index : [];
  let pool = rows.filter((sheet) => {
    if (brief.grade && Number(sheet.grade) !== Number(brief.grade)) return false;
    if (brief.topicId && String(sheet.topicId) !== String(brief.topicId)) return false;
    if (brief.excludeExcellence && String(sheet.level) === "c") return false;
    if (brief.levels.length && brief.levels.indexOf(String(sheet.level)) === -1) return false;
    return true;
  });
  if (!brief.levels.length && brief.strength === "weak") {
    const easier = pool.filter((sheet) => String(sheet.level) === "a");
    if (easier.length) pool = easier;
  }
  return pool;
}

export function clarifyTeacherQuestion(index, brief) {
  const fact = brief || blankBrief();
  const wider = poolFor(index, Object.assign({}, fact, { levels: [], excludeExcellence: false }));
  const levels = [];
  wider.forEach((sheet) => {
    const level = String(sheet.level || "");
    if (!level || levels.indexOf(level) !== -1) return;
    if (fact.excludeExcellence && level === "c") return;
    levels.push(level);
  });
  if (levels.length) {
    return {
      id: "level",
      prompt: "ברמה הזו אין שאלות בקטלוג. איזו רמה כן?",
      chips: levels.map((level) => chip("רמה " + (LEVEL_LABEL[level] || level))),
    };
  }
  return {
    id: "topic",
    prompt: "איזה נושא לכיתה הזו? אפשר לבחור נושא במסך, ואז להמשיך כאן.",
    chips: [chip("רמה א׳"), chip("רמה ב׳")],
  };
}

export function selectByBrief(index, brief) {
  const fact = brief || blankBrief();
  const pool = poolFor(index, fact);
  if (!pool.length) {
    return { band: "", exerciseIds: [], sheetIds: [], sheets: [], shortfall: true };
  }
  const band = pool[0].band === "elementary" || Number(pool[0].grade) <= 6 ? "elementary" : "middle";
  if (band === "elementary") {
    const chosen = pool.slice(0, 3);
    return {
      band,
      exerciseIds: [],
      sheetIds: chosen.map((sheet) => "sheet:" + sheet.pdfId),
      sheets: chosen,
      shortfall: false,
    };
  }
  const items = [];
  pool.forEach((sheet) => {
    (sheet.questions || []).forEach((label) => {
      items.push({ sheet: sheet, label: String(label), q: questionKey(label) });
    });
  });
  if (fact.progressive !== false) items.sort((a, b) => labelRank(a.label) - labelRank(b.label));
  const chosen = [];
  const questions = new Set();
  for (let i = 0; i < items.length && chosen.length < MAX_PICKED_PARTS; i += 1) {
    const item = items[i];
    const partsDone = !fact.minParts || chosen.length >= fact.minParts;
    const questionsDone = !fact.minQuestions || questions.size >= fact.minQuestions;
    if (chosen.length && partsDone && questionsDone && !questions.has(item.q)) break;
    chosen.push(item);
    questions.add(item.q);
  }
  const sheets = [];
  const exerciseIds = [];
  chosen.forEach((item) => {
    exerciseIds.push("ex:" + item.sheet.pdfId + ":" + item.label);
    if (!sheets.some((sheet) => sheet.pdfId === item.sheet.pdfId)) sheets.push(item.sheet);
  });
  const shortfall = (fact.minParts && exerciseIds.length < fact.minParts) ||
    (fact.minQuestions && questions.size < fact.minQuestions);
  return { band, exerciseIds, sheetIds: [], sheets, shortfall: !!shortfall };
}

export function describeSelection(brief, pick) {
  const fact = brief || blankBrief();
  const sheets = (pick && pick.sheets) || [];
  if (!sheets.length) return "";
  if (pick.band === "elementary") {
    const place = sheets.map((sheet) => [sheet.gradeLabel, sheet.topic, sheet.levelLabel].filter(Boolean).join(" · ")).join(" ; ");
    return "הדף שכבר קיים באתר: " + place + ". אפשר לאשר או לשנות.";
  }
  const labels = (pick.exerciseIds || []).map((id) => String(id).split(":").pop());
  const questions = new Set(labels.map(questionKey));
  const levels = (fact.levels.length ? fact.levels : sheets.map((sheet) => sheet.level))
    .filter((level, index, list) => level && list.indexOf(level) === index)
    .map((level) => LEVEL_LABEL[level] || level)
    .join(" ו");
  const strength = { weak: "כיתה חלשה", mixed: "כיתה מעורבת", strong: "כיתה חזקה" }[fact.strength] || "";
  const duration = { short: "רבע שעה", lesson: "שיעור", double: "שיעור כפול" }[fact.duration] || "";
  const output = fact.output === "short" ? "דף מצומצם" : "דף מלא";
  const order = fact.progressive ? "מהקל לכבד" : "בלי דירוג";
  const bits = [
    labels.length + " סעיפים ב־" + questions.size + " שאלות",
    levels ? "רמה " + levels : "",
    strength,
    duration,
    order,
    output,
  ].filter(Boolean);
  let text = "סיכום: " + bits.join(", ") + ".";
  if (pick.shortfall) text += " בקטלוג אין יותר מזה ברמה הזו, בלי להמציא שאלות.";
  text += " אפשר לאשר או לשנות לפני הסימון.";
  return text;
}
