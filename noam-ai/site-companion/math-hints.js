/**
 * Deterministic step-by-step math hints for Noam AI.
 * Guides students through solving an exercise without revealing the final answer.
 * Never uses slash fractions (uses ÷ or : and horizontal fraction bars).
 */

const LRI = "\u2066";
const PDI = "\u2069";

function isolateLtr(expr) {
  return LRI + String(expr || "").trim() + PDI;
}

function normalizeMathText(raw) {
  return String(raw || "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSigned(n) {
  return n < 0 ? "(−" + Math.abs(n) + ")" : String(n);
}

function makeHintResult(answer, primary, chips) {
  const safeChips = Array.isArray(chips) ? chips : [];
  const links = [];
  if (primary && primary.href) {
    links.push({
      recordId: primary.id || "math-hint-primary",
      title: primary.label,
      href: primary.href,
      grade: primary.grade || null,
      level: null,
    });
  }
  for (const chip of safeChips) {
    if (chip && chip.href) {
      links.push({
        recordId: chip.id || "math-hint-chip",
        title: chip.label,
        href: chip.href,
        grade: chip.grade || null,
        level: null,
      });
    }
  }
  return {
    ok: true,
    active: true,
    source: "math-hint",
    model: null,
    answer,
    text: answer,
    details: answer,
    primary: primary || null,
    chips: safeChips,
    options: safeChips,
    links,
    essential: [],
    essentialNote: "",
    exportNote: "",
    exerciseIds: [],
    sheetIds: [],
    intake: null,
    wizard: null,
  };
}

/**
 * Returns a deterministic step-by-step hint object if the message asks about
 * a math exercise or expression, or null if it is a navigation/catalog query.
 */
export function buildMathExerciseHint(message, page) {
  const clean = normalizeMathText(message);
  if (!clean) return null;

  // Exclude 30-60-90 triangle queries which have their own topic handler
  if (/30\s*-\s*60\s*-\s*90/.test(clean)) return null;

  // Exclude pure grade/topic/catalog navigation phrases that happen to have a number
  if (/^(?:כיתה|דף|דפים|דפי עבודה|שאלה|סעיף)\s*\d+$/i.test(clean)) return null;
  if (/\d+\s*(?:דקות|תרגילים|שאלות|סעיפים|פריטים)/.test(clean)) return null;

  // 1. Binary multiplication or division (signed or unsigned): e.g. (-12)÷3, (-12):3, -12/3, (-4)×(-5)
  const mulDivMatch = clean.match(
    /(?:^|[^\dA-Za-z])\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*([÷:×·*/])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)(?=$|[^\dA-Za-z])|(?:^|[^\dA-Za-z])\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*([÷:×·*/])\s*(-?\d+(?:\.\d+)?)(?=$|[^\dA-Za-z])|(?:^|[^\dA-Za-z])(-?\d+(?:\.\d+)?)\s*([÷:×·*/])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)(?=$|[^\dA-Za-z])|(?:^|[^\dA-Za-z])(-?\d+(?:\.\d+)?)\s*([÷:×·*/])\s*(-?\d+(?:\.\d+)?)(?=$|[^\dA-Za-z])/
  );
  if (mulDivMatch) {
    const aStr = mulDivMatch[1] ?? mulDivMatch[4] ?? mulDivMatch[7] ?? mulDivMatch[10];
    const opRaw = mulDivMatch[2] ?? mulDivMatch[5] ?? mulDivMatch[8] ?? mulDivMatch[11];
    const bStr = mulDivMatch[3] ?? mulDivMatch[6] ?? mulDivMatch[9] ?? mulDivMatch[12];
    const a = Number(aStr);
    const b = Number(bStr);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const isDiv = opRaw === "÷" || opRaw === ":" || opRaw === "/";
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      const dispOp = isDiv ? "÷" : "×";
      const expr = isolateLtr(formatSigned(a) + " " + dispOp + " " + formatSigned(b));
      const absExpr = isolateLtr(absA + " " + dispOp + " " + absB);

      if (isDiv && b === 0) {
        return makeHintResult(
          "שימו לב: בתרגיל " + expr + " המכנה או המחלק הוא 0, ובמתמטיקה חילוק ב־0 אינו מוגדר.",
          { id: "topic-dividing-signed-numbers-grade-7", label: "כיתה ז׳ · חילוק מספרים מכוונים", href: "/dividing-signed-numbers-grade-7", grade: 7 },
          [{ id: "ws-dividing-signed-7", label: "דפי עבודה בחילוק מספרים מכוונים", href: "/worksheets?grade=7&topic=4", grade: 7 }]
        );
      }

      if (a < 0 || b < 0) {
        const sameSign = (a < 0 && b < 0) || (a > 0 && b > 0);
        const actionWord = isDiv ? "חילוק" : "כפל";
        const verbWord = isDiv ? "חלקו" : "כפלו";
        const signStep = sameSign
          ? "שני המספרים בעלי אותו סימן, ולכן ב" + actionWord + " סימן התוצאה הוא חיובי (+)."
          : "אחד המספרים שלילי והשני חיובי (סימנים מנוגדים), ולכן ב" + actionWord + " סימן התוצאה הוא שלילי (−).";
        const answer = [
          "כדי לפתור את התרגיל " + expr + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
          "1. קביעת הסימן: " + signStep,
          "2. חישוב הערך המוחלט: " + verbWord + " את הערכים המוחלטים ללא הסימנים — כמה הם " + absExpr + "?",
          "3. חיבור השלבים: צרפו את הסימן שמצאתם בשלב 1 לתוצאה מחישוב שלב 2.",
        ].join("\n");
        const primary = isDiv
          ? { id: "topic-dividing-signed-numbers-grade-7", label: "כיתה ז׳ · חילוק מספרים מכוונים", href: "/dividing-signed-numbers-grade-7", grade: 7 }
          : { id: "topic-multiplying-signed-numbers-grade-7", label: "כיתה ז׳ · כפל מספרים מכוונים", href: "/multiplying-signed-numbers-grade-7", grade: 7 };
        const chips = isDiv
          ? [{ id: "ws-dividing-signed-7", label: "דפי עבודה בחילוק מספרים מכוונים", href: "/worksheets?grade=7&topic=4", grade: 7 }]
          : [{ id: "ws-multiplying-signed-7", label: "דפי עבודה בכפל מספרים מכוונים", href: "/worksheets?grade=7&topic=3", grade: 7 }];
        return makeHintResult(answer, primary, chips);
      }

      const answer = isDiv
        ? [
            "כדי לפתור את התרגיל " + expr + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
            "1. משמעות החילוק: בדקו כמה פעמים " + absB + " נכנס בתוך " + absA + " (כלומר איזה מספר כפול " + absB + " נותן " + absA + ").",
            "2. פירוק נוח: אם המספר גדול, אפשר לפרק את " + absA + " לסכום של כפולות נוחות של " + absB + " ולחלק כל חלק בנפרד.",
            "3. בדיקה: הכפילו את התוצאה שקיבלתם ב־" + absB + " וודאו שמתקבל " + absA + ".",
          ].join("\n")
        : [
            "כדי לפתור את התרגיל " + expr + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
            "1. פירוק לפי ערך המקום: אפשר לפרק את אחד המספרים לעשרות וליחידות (חוק הפילוג).",
            "2. כפל חלקים: כפלו כל חלק בנפרד ב־" + absB + ".",
            "3. חיבור: חברו את המכפלות החלקיות לקבלת התוצאה.",
          ].join("\n");
      return makeHintResult(
        answer,
        { id: "worksheets-catalog", label: "דפי עבודה במתמטיקה", href: "/worksheets" },
        []
      );
    }
  }

  // 2. Binary addition or subtraction (with signed numbers or negative result): e.g. (-12)+3, -7-4, (-3)-(-5)
  const addSubMatch = clean.match(
    /(?:^|[^\dA-Za-z])(?:\(\s*(-?\d+(?:\.\d+)?)\s*\)|(-?\d+(?:\.\d+)?))\s*([+-])\s*(?:\(\s*(-?\d+(?:\.\d+)?)\s*\)|(-?\d+(?:\.\d+)?))(?=$|[^\dA-Za-z])/
  );
  if (addSubMatch) {
    const a = Number(addSubMatch[1] ?? addSubMatch[2]);
    const op = addSubMatch[3];
    const b = Number(addSubMatch[4] ?? addSubMatch[5]);
    if (Number.isFinite(a) && Number.isFinite(b) && (a < 0 || b < 0 || (op === "-" && a < b))) {
      const effectiveB = op === "-" ? -b : b;
      const absA = Math.abs(a);
      const absB = Math.abs(effectiveB);
      const sameSign = (a < 0 && effectiveB < 0) || (a > 0 && effectiveB > 0);
      const expr = isolateLtr(formatSigned(a) + " " + (op === "-" ? "−" : "+") + " " + formatSigned(b));
      const step1 =
        op === "-" && b < 0
          ? "1. הפיכת חיסור לחיבור הנגדי: חיסור מספר שלילי שווה לחיבור המספר הנגדי החיובי (" + isolateLtr(formatSigned(a) + " + " + Math.abs(b)) + ")."
          : op === "-"
            ? "1. כיוון על ישר המספרים: מתחילים ב־" + isolateLtr(String(a)) + " וזזים " + absB + " צעדים שמאלה."
            : "1. בדיקת סימנים: מחברים שני מספרים בעלי סימנים " + (sameSign ? "זהים." : "מנוגדים.");
      const step2 = sameSign
        ? "2. חישוב הגודל: מאחר שהסימנים באותו כיוון, חברו את הערכים המוחלטים (" + isolateLtr(absA + " + " + absB) + ") והשאירו את הסימן המשותף."
        : "2. השוואת ערכים מוחלטים: השוו בין " + absA + " לבין " + absB + ". סימן התוצאה יהיה כסימן המספר בעל הערך המוחלט הגדול יותר, והגודל הוא ההפרש ביניהם (" + isolateLtr(Math.max(absA, absB) + " − " + Math.min(absA, absB)) + ").";
      const answer = [
        "כדי לפתור את התרגיל " + expr + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
        step1,
        step2,
        "3. בדיקה: בדקו על ישר המספרים אם התוצאה נמצאת בצד החיובי או השלילי.",
      ].join("\n");
      return makeHintResult(
        answer,
        { id: "topic-signed-numbers-grade-7", label: "כיתה ז׳ · חיבור וחיסור מספרים מכוונים", href: "/signed-numbers-grade-7", grade: 7 },
        [{ id: "ws-signed-7", label: "דפי עבודה במספרים מכוונים", href: "/worksheets?grade=7&topic=2", grade: 7 }]
      );
    }
  }

  // 3. Binomial square / difference of squares: e.g. (x-4)^2, (a+b)², x^2-49
  if (/\([^()]+\)\s*(?:²|\^2)/.test(clean)) {
    const answer = [
      "כדי לפתח ביטוי מהצורה " + isolateLtr("(a ± b)²") + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. האיבר הראשון בריבוע: העלו בריבוע את האיבר הראשון בסוגריים (" + isolateLtr("a²") + ").",
      "2. האיבר האמצעי: כפלו את שני האיברים זה בזה והכפילו ב־2 (" + isolateLtr("±2ab") + ") — שימו לב לסימן שבין האיברים.",
      "3. האיבר השני בריבוע: הוסיפו את ריבוע האיבר השני (" + isolateLtr("+ b²") + ", שהוא תמיד חיובי).",
    ].join("\n");
    return makeHintResult(
      answer,
      { id: "topic-binomial-square-grade-9", label: "כיתה ט׳ · דו־איבר בריבוע", href: "/binomial-square-grade-9", grade: 9 },
      [{ id: "ws-binomial-9", label: "דפי עבודה בדו־איבר בריבוע", href: "/worksheets?grade=9&topic=44", grade: 9 }]
    );
  }

  // 4. Linear equation in x: e.g. 2x + 5 = 11, 3(x-2) = 9
  if (/[xX]\s*[+\-=]|=\s*[^=]*[xX]|\d\s*[xX]/.test(clean) && clean.includes("=")) {
    const answer = [
      "כדי לפתור את המשוואה צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. פישוט אגפים: אם יש סוגריים פתחו אותם בעזרת חוק הפילוג, וכנסו איברים דומים בכל אגף.",
      "2. הפרדת נעלמים ומספרים: בצעו פעולה הפוכה בשני האגפים כך שכל איברי הנעלם יהיו באגף אחד והמספרים החופשיים באגף השני.",
      "3. בידוד הנעלם ובדיקה: חלקו את שני האגפים במקדם של הנעלם, והציבו את התוצאה במשוואה המקורית לבדיקה.",
    ].join("\n");
    return makeHintResult(
      answer,
      { id: "topic-equations-basics-grade-7", label: "כיתה ז׳ · משוואות", href: "/equations-basics-grade-7", grade: 7 },
      [{ id: "ws-equations-7", label: "דפי עבודה במשוואות", href: "/worksheets?grade=7&topic=34", grade: 7 }]
    );
  }

  // 5. Powers or roots: e.g. (-3)^2, 2^4, √36, שורש 49
  if (/√\s*\d+|שורש\s+(?:ריבועי\s+)?(?:של\s+)?\d+/.test(clean)) {
    const answer = [
      "כדי לחשב שורש ריבועי צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. משמעות השורש: שאלו — איזה מספר אי־שלילי, אם נכפול אותו בעצמו, ייתן את המספר שמתחת לשורש?",
      "2. בדיקה באמצעות חזקה: העלו את המספר שחשבתם עליו בריבוע ובדקו אם מתקבל המספר הנתון.",
    ].join("\n");
    return makeHintResult(
      answer,
      { id: "topic-square-root-grade-7", label: "כיתה ז׳ · שורש ריבועי", href: "/square-root-grade-7", grade: 7 },
      [{ id: "ws-sqrt-7", label: "דפי עבודה בשורש ריבועי", href: "/worksheets?grade=7&topic=7", grade: 7 }]
    );
  }

  return null;
}
