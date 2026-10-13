/**
 * Lesson builder for Noam AI.
 * Asks for count, level, lesson length, grade, and topic, then returns
 * exactly that many questions that already exist on a worksheet.
 * Levels are רמה א׳, רמה ב׳, and מצוינות. There is no רמה ג׳.
 */
import { pageGrade } from "./retrieve.js";
import { dedupeActions } from "./topic-order.js";

export const LEVELS = [
  { key: "a", label: "רמה א׳" },
  { key: "b", label: "רמה ב׳" },
  { key: "c", label: "מצוינות" },
];

const PICK_INTENT =
  /להרכיב שיעור|הרכיב שיעור|תבחר|בחרו לי|לבחור תרגיל|לבחור שאלה|לבחור סעיף|תכין לי שיעור|תכין שיעור|כמה (?:תרגיל|שאלה|סעיף|פריט)|תרגילים לשיעור|שאלות לשיעור/;
const FORBIDDEN_LEVEL = /רמה\s*ג/;
const COUNT_WORD = {
  אחד: 1,
  אחת: 1,
  שניים: 2,
  שתיים: 2,
  שלוש: 3,
  שלושה: 3,
  ארבע: 4,
  ארבעה: 4,
  חמש: 5,
  חמישה: 5,
  שש: 6,
  שישה: 6,
  שבע: 7,
  שבעה: 7,
  שמונה: 8,
  תשע: 9,
  עשר: 10,
  עשרה: 10,
};
const GRADE_MARK = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9 };

function fold(value) {
  return String(value || "")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[׳״"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clipState(prior) {
  const source = prior && typeof prior === "object" ? prior : {};
  const count = Number(source.count);
  const minutes = Number(source.minutes);
  const grade = Number(source.grade);
  const level = String(source.level || "");
  return {
    active: source.active === true,
    waiting: String(source.waiting || ""),
    count: count >= 1 && count <= 30 ? count : null,
    level: level === "a" || level === "b" || level === "c" ? level : null,
    minutes: minutes >= 5 && minutes <= 180 ? minutes : null,
    grade: grade >= 1 && grade <= 9 ? grade : null,
    topicId: /^\d{1,6}$/.test(String(source.topicId || "")) ? String(source.topicId) : "",
    topicLabel: String(source.topicLabel || "").slice(0, 80),
    gapKey: String(source.gapKey || "").slice(0, 40),
    gapAsks: Number(source.gapAsks) > 0 ? Number(source.gapAsks) : 0,
  };
}

export function isExercisePickRequest(message, intake) {
  const state = clipState(intake);
  if (state.active) return true;
  return PICK_INTENT.test(String(message || ""));
}

function levelFrom(text) {
  const folded = fold(text);
  if (/מצוינות/.test(folded)) return "c";
  if (/רמה\s*א(?!\S)/.test(folded) || /רמה א\b/.test(text)) return "a";
  if (/רמה\s*ב(?!\S)/.test(folded)) return "b";
  if (folded === "a" || folded === "b" || folded === "c") return folded;
  return "";
}

function gradeFrom(text) {
  const match = String(text || "").match(/כיתה\s*([1-9אבגדהוזחט])/);
  if (!match) return null;
  const mark = match[1];
  if (/[1-9]/.test(mark)) return Number(mark);
  return GRADE_MARK[mark] || null;
}

function bareGrade(text) {
  const folded = fold(text);
  if (/^[1-9]$/.test(folded)) return Number(folded);
  if (GRADE_MARK[folded]) return GRADE_MARK[folded];
  const named = folded.match(/^כיתה\s*([1-9אבגדהוזחט])$/);
  if (!named) return null;
  return /[1-9]/.test(named[1]) ? Number(named[1]) : GRADE_MARK[named[1]] || null;
}

function countFrom(text) {
  const numbered = String(text || "").match(/(\d{1,2})\s*(?:תרגילים|שאלות|סעיפים|פריטים|תרגיל|שאלה|סעיף|פריט)/);
  if (numbered) {
    const count = Number(numbered[1]);
    if (count >= 1 && count <= 30) return count;
  }
  const folded = fold(text);
  const tails = ["תרגילים", "תרגיל", "שאלות", "שאלה", "סעיפים", "סעיף", "פריטים", "פריט"];
  for (const word of Object.keys(COUNT_WORD)) {
    for (const tail of tails) {
      if (folded.includes(word + " " + tail)) return COUNT_WORD[word];
    }
  }
  return null;
}

function minutesFrom(text) {
  const source = String(text || "");
  const numbered = source.match(/(\d{1,3})\s*דקות/);
  if (numbered) {
    const minutes = Number(numbered[1]);
    if (minutes >= 5 && minutes <= 180) return minutes;
  }
  const folded = fold(source);
  if (folded.includes("חצי שעה")) return 30;
  if (folded.includes("שעה וחצי")) return 90;
  if (folded.includes("שעה")) return 60;
  return null;
}

function topicsFor(index, grade) {
  const seen = new Set();
  const topics = [];
  for (const sheet of index || []) {
    if (grade && Number(sheet.grade) !== Number(grade)) continue;
    const id = String(sheet.topicId || "");
    if (!id || seen.has(Number(sheet.grade) + ":" + id)) continue;
    seen.add(Number(sheet.grade) + ":" + id);
    topics.push({
      grade: Number(sheet.grade),
      topicId: id,
      topic: String(sheet.topic || ""),
      gradeLabel: String(sheet.gradeLabel || ""),
    });
  }
  return topics;
}

function gradeLabelFor(index, grade) {
  const sheet = (index || []).find((item) => Number(item.grade) === Number(grade));
  return sheet ? (sheet.gradeLabel || "כיתה " + sheet.grade) : "";
}

function gradeHasExercises(index, grade) {
  return (index || []).some((sheet) => {
    return Number(sheet.grade) === Number(grade) && (sheet.questions || []).length > 0;
  });
}

function topicHasExercises(index, grade, topicId, level) {
  return (index || []).some((sheet) => {
    if (Number(sheet.grade) !== Number(grade)) return false;
    if (String(sheet.topicId) !== String(topicId)) return false;
    if (level && String(sheet.level) !== String(level)) return false;
    return (sheet.questions || []).length > 0;
  });
}

function topicsWithExercises(index, grade, level) {
  return topicsFor(index, grade).filter((topic) => topicHasExercises(index, grade, topic.topicId, level));
}

function worksheetChip(grade) {
  return { label: "דפי עבודה", href: grade ? "/worksheets?grade=" + grade : "/worksheets" };
}

function exercisableTopicHits(index, query) {
  const wanted = fold(query);
  if (wanted.length < 2 || /^\d+$/.test(wanted)) return [];
  const exact = [];
  const loose = [];
  const seen = new Set();
  for (const sheet of index || []) {
    if (!(sheet.questions || []).length) continue;
    const name = fold(sheet.topic);
    const id = String(sheet.grade) + ":" + String(sheet.topicId);
    if (seen.has(id)) continue;
    if (name === wanted) {
      seen.add(id);
      exact.push(sheet);
    } else if (name.includes(wanted)) {
      seen.add(id);
      loose.push(sheet);
    }
  }
  return exact.length ? exact : loose;
}

function matchTopics(index, grade, query) {
  const wanted = fold(query);
  if (wanted.length < 2) return [];
  const pool = topicsFor(index, grade).filter((topic) => topicHasExercises(index, grade, topic.topicId, ""));
  const exact = pool.filter((topic) => fold(topic.topic) === wanted);
  if (exact.length) return exact;
  // "30" must not match "30-60-90". Digits are a count or a lesson length.
  if (/^\d+$/.test(wanted)) return [];
  return pool.filter((topic) => {
    const name = fold(topic.topic);
    if (name.length < 2) return false;
    return name.includes(wanted) || wanted.includes(name);
  });
}

function fillsWaiting(message, state) {
  const text = String(message || "").trim();
  if (!text) return false;
  if (FORBIDDEN_LEVEL.test(text) || levelFrom(text) || gradeFrom(text) || countFrom(text) || minutesFrom(text)) return true;
  if (state.waiting === "count" && /^([1-9]|[12]\d|30)$/.test(text)) return true;
  if (state.waiting === "minutes" && /^\d{1,3}$/.test(text)) return true;
  if (state.waiting === "grade" && bareGrade(text)) return true;
  if (state.waiting === "level" && levelFrom(text)) return true;
  if (state.waiting === "topicId" && fold(text).length >= 2) return true;
  return false;
}

export function continuesIntake(message, intake) {
  const state = clipState(intake);
  if (state.active) return true;
  return isExercisePickRequest(message, null);
}

function option(label, send) {
  return { label, send: send || label };
}

function levelOptions() {
  return LEVELS.map((level) => option(level.label));
}

function ask(state, waiting, answer, options, gapKey) {
  const next = Object.assign({}, state, { active: true, waiting });
  if (gapKey) {
    next.gapAsks = state.gapKey === gapKey ? state.gapAsks + 1 : 1;
    next.gapKey = gapKey;
  }
  const chips = dedupeActions(options || []).slice(0, 12);
  return {
    ok: true,
    active: true,
    source: "exercise-intake",
    model: null,
    answer,
    text: answer,
    details: answer,
    primary: null,
    chips,
    options: chips,
    links: [],
    essential: [],
    essentialNote: "",
    exportNote: "",
    exerciseIds: [],
    sheetIds: [],
    intake: {
      active: true,
      waiting,
      count: next.count,
      level: next.level,
      minutes: next.minutes,
      grade: next.grade,
      topicId: next.topicId,
      topicLabel: next.topicLabel,
      gapKey: next.gapKey,
      gapAsks: next.gapAsks,
    },
    wizard: null,
  };
}

function absorb(state, message, index) {
  const text = String(message || "").trim();
  if (FORBIDDEN_LEVEL.test(text)) {
    state.level = null;
    state.levelRejected = true;
  } else {
    const level = levelFrom(text);
    if (level) state.level = level;
  }
  const count = countFrom(text);
  if (count) state.count = count;
  const minutes = minutesFrom(text);
  if (minutes) state.minutes = minutes;
  const grade = gradeFrom(text) || (state.waiting === "grade" ? bareGrade(text) : null);
  if (grade) state.grade = grade;
  if (!state.count && state.waiting === "count" && /^([1-9]|[12]\d|30)$/.test(text)) state.count = Number(text);
  if (!state.minutes && state.waiting === "minutes" && /^\d{1,3}$/.test(text)) {
    const value = Number(text);
    if (value >= 5 && value <= 180) state.minutes = value;
  }
  // Topic search runs only while the builder is waiting for a topic.
  // A lesson length such as 30 must not select "30-60-90".
  if (state.waiting === "topicId") {
    const matches = matchTopics(index, state.grade, fold(text));
    if (matches.length === 1) {
      state.topicId = matches[0].topicId;
      state.topicLabel = matches[0].topic;
    } else if (matches.length > 1) {
      state.topicMatches = matches;
    }
  }
}

function topicChoices(matches) {
  return dedupeActions(
    matches.slice(0, 8).map((topic) => option(topic.topic))
  );
}

function questionsFor(index, state) {
  const sheets = (index || []).filter((sheet) => {
    return Number(sheet.grade) === Number(state.grade) &&
      String(sheet.topicId) === String(state.topicId) &&
      String(sheet.level) === state.level;
  });
  const questions = [];
  const seen = new Set();
  for (const sheet of sheets) {
    for (const label of sheet.questions || []) {
      const id = "ex:" + sheet.pdfId + ":" + label;
      if (seen.has(id)) continue;
      if (!/^[0-9a-f]{32}$/i.test(String(sheet.pdfId || ""))) continue;
      if (!/^(\d{1,2}[\u05D0-\u05EA])$/.test(String(label || ""))) continue;
      seen.add(id);
      questions.push(id);
    }
  }
  return questions;
}

function wizardHref(state, exerciseIds) {
  const params = new URLSearchParams();
  params.set("grade", String(state.grade));
  params.set("topic", String(state.topicId));
  params.set("level", state.level);
  params.set("minutes", String(state.minutes));
  params.set("pick", exerciseIds.join(","));
  return "/teachers?" + params.toString();
}

function levelLabel(level) {
  const found = LEVELS.find((item) => item.key === level);
  return found ? found.label : "";
}

function pickedAnswer(state, exerciseIds) {
  const labels = exerciseIds.map((id) => id.split(":").pop()).join(", ");
  return (
    "בחרתי " +
    exerciseIds.length +
    " סעיפים שכבר קיימים בדף " +
    state.topicLabel +
    ", " +
    (state.gradeLabel || "כיתה " + state.grade) +
    ", " +
    levelLabel(state.level) +
    ", לשיעור של " +
    state.minutes +
    " דקות: " +
    labels +
    ". עמוד המורים הוא אשף: הכיתה, הנושא והסעיפים האלה כבר מסומנים, ואפשר להדפיס את דף המקור עם סימון או דף מצומצם שנחתך ממנו."
  );
}

function gradeRows(index) {
  const grades = [];
  const seen = new Set();
  for (const sheet of index || []) {
    if (seen.has(sheet.grade)) continue;
    seen.add(sheet.grade);
    grades.push(sheet);
  }
  grades.sort((a, b) => Number(a.grade) - Number(b.grade));
  return grades;
}

export function advanceExerciseIntake(message, prior, index, page) {
  const state = clipState(prior);
  state.active = true;
  state.levelRejected = false;
  state.topicMatches = [];
  absorb(state, message, index);
  if (state.grade && !gradeHasExercises(index, state.grade)) {
    state.emptyGrade = state.grade;
    state.grade = null;
  }
  if (state.levelRejected) {
    const repeated = state.gapKey === "level";
    const answer = repeated
      ? "בחרו רמה א׳, רמה ב׳ או מצוינות. אלה הרמות של הדפים."
      : "הרמות באתר הן רמה א׳, רמה ב׳ ומצוינות. איזו רמה לשיעור?";
    return ask(state, "level", answer, levelOptions(), "level");
  }
  if (!state.count) {
    return ask(state, "count", "כמה סעיפים צריך לשיעור?", [4, 6, 8].map((count) => option(String(count) + " סעיפים", String(count))));
  }
  if (!state.level) {
    return ask(state, "level", "איזו רמה? רמה א׳, רמה ב׳ או מצוינות.", levelOptions());
  }
  if (!state.minutes) {
    return ask(state, "minutes", "כמה דקות אורך השיעור?", [30, 45, 60].map((minutes) => option(minutes + " דקות", String(minutes))));
  }
  if (!state.grade) {
    const named = state.waiting === "grade" ? exercisableTopicHits(index, message) : [];
    if (named.length === 1) {
      state.grade = Number(named[0].grade);
      state.topicId = String(named[0].topicId);
      state.topicLabel = named[0].topic;
    }
  }
  if (!state.grade) {
    const grades = gradeRows(index).filter((sheet) => gradeHasExercises(index, sheet.grade));
    const namedGrades = state.waiting === "grade" ? exercisableTopicHits(index, message) : [];
    const preferred = state.emptyGrade || pageGrade(page);
    const home = grades.find((sheet) => Number(sheet.grade) === Number(preferred));
    const offered = namedGrades.length
      ? grades.filter((sheet) => namedGrades.some((hit) => Number(hit.grade) === Number(sheet.grade)))
      : grades;
    const ordered = home && offered.some((sheet) => sheet === home)
      ? [home].concat(offered.filter((sheet) => sheet !== home))
      : offered;
    const chips = ordered.map((sheet) => option(sheet.gradeLabel || "כיתה " + sheet.grade));
    const typedTopic = state.waiting === "grade" && fold(message).length >= 2 && !gradeFrom(message) && !bareGrade(message);
    if (typedTopic && !namedGrades.length) {
      const topicName = fold(message).slice(0, 40);
      const answer = "בנושא " + topicName + " אין סעיפים קיימים לבחירה. בחרו כיתה שיש בה סעיפים, או פתחו את דפי העבודה.";
      chips.push(worksheetChip(preferred || pageGrade(page)));
      return ask(state, "grade", answer, chips, "no-exercises");
    }
    if (preferred && !home) {
      const label = gradeLabelFor(index, preferred) || "כיתה " + preferred;
      const repeated = state.gapKey === "no-exercises";
      const answer = repeated
        ? "ב" + label + " אין סעיפים קיימים. בחרו כיתה מהכפתורים, או פתחו את דפי העבודה."
        : "ב" + label + " אין סעיפים קיימים לבחירה. בחרו כיתה שיש בה סעיפים, או פתחו את דפי העבודה.";
      chips.push(worksheetChip(preferred));
      return ask(state, "grade", answer, chips, "no-exercises");
    }
    const homeLabel = home ? (home.gradeLabel || "כיתה " + home.grade) : "";
    const answer = homeLabel
      ? "לאיזו כיתה השיעור? ברירת המחדל היא " + homeLabel + "."
      : "לאיזו כיתה השיעור?";
    return ask(state, "grade", answer, chips);
  }
  if (!state.topicId) {
    const available = topicsWithExercises(index, state.grade, state.level);
    const searched = state.topicMatches && state.topicMatches.length ? state.topicMatches : [];
    const matches = searched.length ? searched : available;
    const repeated = state.gapKey === "topic";
    const answer = matches.length
      ? repeated
        ? "יש כמה דפים עם השם הזה. בחרו את הנושא המדויק מהכפתורים."
        : searched.length
          ? "איזה מהנושאים האלה מתאים לשיעור?"
          : "איזה נושא לשיעור? בחרו נושא שיש בו סעיפים."
      : repeated
        ? "כתבו את שם הנושא כפי שהוא מופיע בדפי הכיתה, למשל דלתון."
        : "איזה נושא לשיעור? אפשר לכתוב שם, למשל דלתון או פירוק לגורמים.";
    return ask(state, "topicId", answer, topicChoices(matches), "topic");
  }
  const gradeLabel = ((index || []).find((sheet) => Number(sheet.grade) === Number(state.grade)) || {}).gradeLabel;
  state.gradeLabel = gradeLabel || "";
  const questions = questionsFor(index, state);
  if (!questions.length) {
    const otherLevels = LEVELS.filter((level) => {
      return level.key !== state.level && topicHasExercises(index, state.grade, state.topicId, level.key);
    });
    if (otherLevels.length) {
      const repeated = state.gapKey === "none";
      const answer = repeated
        ? "ברמה הזו אין סעיפים. בחרו רמה אחרת מהכפתורים."
        : "בנושא הזה אין סעיפים ב" + levelLabel(state.level) + ". בחרו רמה שיש בה סעיפים.";
      return ask(state, "level", answer, otherLevels.map((level) => option(level.label)), "none");
    }
    const repeated = state.gapKey === "none";
    const answer = repeated
      ? "עדיין אין סעיפים בנושא הזה. בחרו נושא אחר, או פתחו את דפי העבודה."
      : "בנושא הזה אין סעיפים קיימים. בחרו נושא שיש בו סעיפים, או פתחו את דפי העבודה.";
    state.topicId = "";
    state.topicLabel = "";
    const chips = topicChoices(topicsWithExercises(index, state.grade, state.level)).slice(0, 7);
    chips.push(worksheetChip(state.grade));
    return ask(state, "topicId", answer, chips, "none");
  }
  if (questions.length < state.count) {
    const repeated = state.gapKey === "short";
    const answer = repeated
      ? "אפשר לבחור רק מתוך " + questions.length + " הסעיפים שכבר בדף. איזה מספר עד " + questions.length + " מתאים?"
      : "בנושא הזה יש " + questions.length + " סעיפים קיימים ברמה הזו. כמה מהם לקחת?";
    const choices = [];
    const offer = Math.min(questions.length, 3);
    for (let step = questions.length; step > 0 && choices.length < offer; step -= 1) {
      choices.push(option(String(step) + " סעיפים", String(step)));
    }
    state.count = null;
    return ask(state, "count", answer, choices, "short");
  }
  const exerciseIds = questions.slice(0, state.count);
  const answer = pickedAnswer(state, exerciseIds);
  const href = wizardHref(state, exerciseIds);
  const primary = { id: "teachers-wizard", label: "פתיחת האשף", href };
  return {
    ok: true,
    active: true,
    source: "exercise-intake",
    model: null,
    answer,
    text: answer,
    details: answer,
    primary,
    chips: [],
    options: [],
    links: [{ recordId: "teachers", title: "עמוד המורים", href, grade: state.grade, level: state.level }],
    essential: [],
    essentialNote: "",
    exportNote: "",
    exerciseIds,
    sheetIds: [],
    intake: null,
    wizard: {
      href,
      grade: String(state.grade),
      topic: String(state.topicId),
      level: state.level,
      minutes: state.minutes,
      count: exerciseIds.length,
      exerciseIds,
    },
  };
}
