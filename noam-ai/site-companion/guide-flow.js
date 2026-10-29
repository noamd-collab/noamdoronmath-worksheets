/**
 * Deterministic site guide: one question at a time, an explanation of the
 * page, then a link. Exercise picking is the intake. Topic order stays in
 * the catalog, including kite = grade 9.
 */
import { isRoleQuestion, isWorksheetSolveRequest, RAMZI_TEXT, roleAnswer } from "./companion.js";
import { advanceExerciseIntake, continuesIntake } from "./exercise-intake.js";
import { suggestTopicGroup } from "./topic-order.js";

export const VAGUE_TEXT =
  "מה תרצו לעשות עכשיו? אפשר לפתוח דף עבודה לפי נושא, להבין איך עובד עמוד המורים, או להרכיב שיעור מסעיפים שכבר קיימים.";
export const TEACHERS_TEXT =
  "עמוד המורים הוא אשף בחירה. קודם בוחרים כיתה ונושא, אחר כך את מטרת השיעור, ואז מסמנים רק סעיפים או דפים שכבר קיימים באתר. ההדפסה מסמנת על דף המקור, או חותכת ממנו דף מצומצם עם ההוראה המקורית. ביסודי בוחרים דף לפי רמה. בחטיבה בוחרים סעיפים.";
export const WORKSHEETS_TEXT =
  "דפי העבודה מסודרים לפי כיתה ואז לפי סדר הלימוד. בוחרים כיתה, נכנסים לנושא, ופותחים דף שכבר קיים באתר. אין כאן דף חדש.";

const VAGUE = /^(?:היי |הי |שלום )?(?:אני רוצה עזרה|רוצה עזרה|מה אפשר|מה עושים כאן|לאן|תכוון אותי|עזור לי באתר)(?:\s+באתר)?[?.!\s]*$/;
const TEACHERS = /עמוד המורים|דף המורים|אשף המורים|מה יש בעמוד המורים|איך עובד עמוד המורים/;
const WORKSHEETS = /^(?:דף עבודה|דפי עבודה|איפה הדפים|איך מוצאים דף)[?.!\s]*$/;

function guideResult(answer, primary, chips) {
  return {
    ok: true,
    active: true,
    source: "site-guide",
    model: null,
    answer,
    text: answer,
    details: answer,
    primary: primary || null,
    chips: chips || [],
    options: chips || [],
    links: primary && primary.href ? [{ recordId: primary.id || "guide", title: primary.label, href: primary.href, grade: null, level: null }] : [],
    essential: [],
    essentialNote: "",
    exportNote: "",
    exerciseIds: [],
    sheetIds: [],
    intake: null,
    wizard: null,
  };
}

function sendOption(label) {
  return { label, send: label };
}

export function resolveDeterministicTurn(payload, deps) {
  const settings = deps || {};
  const message = String((payload && payload.message) || "");
  const page = payload && payload.page && typeof payload.page === "object" ? payload.page : {};
  const teacher = payload && payload.teacher;
  const pickCount = Number(teacher && teacher.count);
  // The picker supplies an explicit request and its candidates. Do not interpret
  // words in its prompt as a navigation question; the endpoint still applies its
  // normal rate limit and bot verification before calling the teacher classifier.
  if (page.kind === "teachers" && Number.isInteger(pickCount) && pickCount > 0 &&
      Array.isArray(teacher && teacher.candidates) && teacher.candidates.length > 0) {
    return null;
  }
  if (isRoleQuestion(message)) {
    return Object.assign({ active: true, exerciseIds: [], sheetIds: [], intake: null, wizard: null }, roleAnswer(payload));
  }
  if (isWorksheetSolveRequest(page.kind, message)) {
    return {
      ok: true,
      active: true,
      source: "ramzi-redirect",
      model: null,
      answer: RAMZI_TEXT,
      text: RAMZI_TEXT,
      details: RAMZI_TEXT,
      primary: { label: "עזרה מרמזי", action: "ramzi" },
      chips: [],
      options: [],
      links: [],
      essential: [],
      exerciseIds: [],
      sheetIds: [],
      intake: null,
      wizard: null,
    };
  }
  if (continuesIntake(message, payload && payload.intake)) {
    return advanceExerciseIntake(message, payload && payload.intake, settings.teacherIndex, page);
  }
  if (/מה זה|איך(?![\u0590-\u05FF])|למה(?![\u0590-\u05FF])/.test(message) && /30\s*[-–—]\s*60\s*[-–—]\s*90/.test(message)) {
    return guideResult(
      "משולש ישר זווית 30-60-90 הוא נושא בכיתה ט׳. הדף באתר מסביר את המשולש, ואפשר לפתוח ממנו את התרגול שכבר קיים.",
      { id: "triangle-30-60-90-grade-9", label: "משולש 30-60-90", href: "/triangle-30-60-90-grade-9" },
      []
    );
  }
  if (VAGUE.test(message.trim())) {
    return guideResult(VAGUE_TEXT, null, [
      sendOption("דפי עבודה"),
      sendOption("עמוד המורים"),
      sendOption("להרכיב שיעור"),
    ]);
  }
  if (TEACHERS.test(message)) {
    return guideResult(TEACHERS_TEXT, { id: "teachers", label: "עמוד המורים", href: "/teachers" }, []);
  }
  if (WORKSHEETS.test(message.trim())) {
    return guideResult(WORKSHEETS_TEXT, { id: "worksheets", label: "דפי עבודה", href: "/worksheets" }, []);
  }
  const ordered = suggestTopicGroup(payload, settings.catalog, settings.guide);
  if (ordered) return Object.assign({ exerciseIds: [], sheetIds: [], intake: null, wizard: null, active: true }, ordered);
  return null;
}
