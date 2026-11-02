/**
 * Deterministic step-by-step math hints for Noam AI.
 * Guides students through solving an exercise without revealing the final answer.
 * Never uses slash fractions (uses ÷ or : and horizontal fraction bars).
 */

export function buildMathExerciseHint(message, page, siteHref) {
  if (page && page.kind === "worksheet") return null;
  var hrefFor = typeof siteHref === "function" ? siteHref : function (p) { return p; };
  var clean = String(message || "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  // Exclude 30-60-90 triangle queries which have their own topic handler
  if (/30\s*-\s*60\s*-\s*90/.test(clean)) return null;

  // Exclude navigation, grade/question/level/worksheet ranges, clock times, and fractions
  if (/\b(?:כיתה|כיתות|שאלות|שאלה|סעיפים|סעיף|רמה|רמות|דף|דפים|דפי|עמוד|עמודים|פרק|נושא|נושאים|מאגר)\b/.test(clean) && !/[=×÷√²³^]/.test(clean) && !/\(\s*-\d+\s*\)/.test(clean)) {
    return null;
  }
  if (/\d+\s*(?:דקות|שעות|שניות|תרגילים|שאלות|סעיפים|פריטים)/.test(clean)) return null;
  if (/(?:השעה|בשעה|שעה)\b/.test(clean) || /(?:^|[^\d:])(?:[01]?\d|2[0-3]):[0-5]\d(?=$|[^\d:])/.test(clean)) {
    return null;
  }
  if (/\bשבר(?:ים)?\b|\d+\s*\/\s*\d+/.test(clean)) {
    return null;
  }

  function iso(expr) {
    return "\u2066" + String(expr || "").trim() + "\u2069";
  }

  function fmt(n) {
    return n < 0 ? "(−" + Math.abs(n) + ")" : String(n);
  }

  function makeResult(answer, primary, chips) {
    var safeChips = Array.isArray(chips) ? chips.map(function (c) {
      return Object.assign({}, c, { href: hrefFor(c.href) });
    }) : [];
    var safePrimary = primary ? Object.assign({}, primary, { href: hrefFor(primary.href) }) : null;
    var links = [];
    if (safePrimary && safePrimary.href) {
      links.push({
        recordId: safePrimary.id || "math-hint-primary",
        title: safePrimary.label,
        href: safePrimary.href,
        grade: safePrimary.grade || null,
        level: null,
      });
    }
    for (var i = 0; i < safeChips.length; i++) {
      var chip = safeChips[i];
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
      answer: answer,
      text: answer,
      details: answer,
      primary: safePrimary,
      chips: safeChips,
      options: safeChips,
      links: links,
      essential: [],
      essentialNote: "",
      exportNote: "",
      exerciseIds: [],
      sheetIds: [],
      intake: null,
      wizard: null,
    };
  }

  // 1. Quadratic equation in x: e.g. x^2 - 5x + 6 = 0
  if (/(?:[xX]\s*(?:²|\^2)).*=|=\s*.*(?:[xX]\s*(?:²|\^2))/.test(clean)) {
    var quadAns = [
      "כדי לפתור משוואה ריבועית צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. סידור המשוואה: העבירו את כל האיברים לאגף אחד כך שהמשוואה תהיה מהצורה " + iso("ax² + bx + c = 0") + ".",
      "2. בחירת דרך פתרון: בדקו אם אפשר לפרק לגורמים (טרינום או הפרש ריבועים) או הציבו את המקדמים " + iso("a, b, c") + " בנוסחת השורשים.",
      "3. בדיקה: הציבו את הערכים שקיבלתם במשוואה המקורית וודאו ששני האגפים שווים."
    ].join("\n");
    return makeResult(
      quadAns,
      { id: "topic-quadratic-equations-grade-9", label: "כיתה ט׳ · משוואות ריבועיות", href: "/quadratic-equations-grade-9", grade: 9 },
      [{ id: "ws-quadratic-equations-9", label: "דפי עבודה במשוואות ריבועיות", href: "/worksheets?grade=9&topic=6", grade: 9 }]
    );
  }

  // 2. Linear equation in x: e.g. 2x + 5 = 11, 3(x-2) = 9
  if ((/[xX]\s*[+\-=]|=\s*[^=]*[xX]|\d\s*\(?\s*[xX]/.test(clean)) && clean.includes("=")) {
    var eqAns = [
      "כדי לפתור את המשוואה צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. פישוט אגפים: אם יש סוגריים פתחו אותם בעזרת חוק הפילוג, וכנסו איברים דומים בכל אגף.",
      "2. הפרדת נעלמים ומספרים: בצעו פעולה הפוכה בשני האגפים כך שכל איברי הנעלם יהיו באגף אחד והמספרים החופשיים באגף השני.",
      "3. בידוד הנעלם ובדיקה: חלקו את שני האגפים במקדם של הנעלם, והציבו את התוצאה במשוואה המקורית לבדיקה."
    ].join("\n");
    return makeResult(
      eqAns,
      { id: "topic-linear-equations-grade-8", label: "כיתה ח׳ · משוואות ליניאריות", href: "/linear-equations-grade-8", grade: 8 },
      [{ id: "ws-linear-equations-8", label: "דפי עבודה במשוואות ליניאריות", href: "/worksheets?grade=8&topic=2", grade: 8 }]
    );
  }

  // 3. Difference of squares: e.g. x^2-49, x² - 49, a^2 - b^2
  var diffSqMatch = clean.match(/([a-zA-Z])\s*(?:²|\^2)\s*-\s*(\d+|[a-zA-Z]\s*(?:²|\^2))/);
  if (diffSqMatch) {
    var vName = diffSqMatch[1];
    var rhs = diffSqMatch[2].replace(/\^2/g, "²");
    var diffExpr = iso(vName + "² − " + rhs);
    var diffAns = [
      "כדי לפרק את הביטוי " + diffExpr + " לפי נוסחת הפרש ריבועים צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. זיהוי התבנית: הביטוי מתאים לנוסחת הפרש ריבועים " + iso("a² − b² = (a − b)(a + b)") + ".",
      "2. מציאת הבסיסים: האיבר הראשון הוא ריבוע של " + iso(vName) + ". מצאו איזה מספר (או ביטוי) כשמעלים אותו בריבוע נותן " + iso(rhs) + ".",
      "3. הרכבת המכפלה: רשמו סוגריים ראשונים עם הפרש שני הבסיסים וסוגריים שניים עם סכומם."
    ].join("\n");
    return makeResult(
      diffAns,
      { id: "topic-difference-of-squares-grade-9", label: "כיתה ט׳ · הפרש ריבועים", href: "/difference-of-squares-grade-9", grade: 9 },
      [{ id: "ws-difference-of-squares-9", label: "דפי עבודה בהפרש ריבועים", href: "/worksheets?grade=9&topic=45", grade: 9 }]
    );
  }

  // 4. Binomial square: e.g. (x-4)^2, (a+b)² — must have two terms inside parentheses
  if (/\(\s*[a-zA-Z0-9]+\s*[+-]\s*[a-zA-Z0-9]+\s*\)\s*(?:²|\^2)/.test(clean)) {
    var binomAns = [
      "כדי לפתח ביטוי מהצורה " + iso("(a ± b)²") + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. האיבר הראשון בריבוע: העלו בריבוע את האיבר הראשון בסוגריים (" + iso("a²") + ").",
      "2. האיבר האמצעי: כפלו את שני האיברים זה בזה והכפילו ב־2 (" + iso("±2ab") + ") — שימו לב לסימן שבין האיברים.",
      "3. האיבר השני בריבוע: הוסיפו את ריבוע האיבר השני (" + iso("+ b²") + ", שהוא תמיד חיובי)."
    ].join("\n");
    return makeResult(
      binomAns,
      { id: "topic-binomial-square-grade-9", label: "כיתה ט׳ · דו־איבר בריבוע", href: "/binomial-square-grade-9", grade: 9 },
      [{ id: "ws-binomial-9", label: "דפי עבודה בדו־איבר בריבוע", href: "/worksheets?grade=9&topic=44", grade: 9 }]
    );
  }

  // 5. Numeric power / exponent: e.g. (-3)^2, (-3)², -3^2, 2^4
  var powMatch = clean.match(/(?:^|[^\dA-Za-z])(?:\(\s*(-?\d+)\s*\)|(-?\d+))\s*(?:(²|³)|\^\s*(\d+))(?=$|[^\dA-Za-z])/);
  if (powMatch) {
    var hasParens = powMatch[1] !== undefined;
    var baseNum = Number(powMatch[1] ?? powMatch[2]);
    var expNum = powMatch[3] === "²" ? 2 : powMatch[3] === "³" ? 3 : Number(powMatch[4]);
    if (Number.isFinite(baseNum) && Number.isFinite(expNum)) {
      var absBase = Math.abs(baseNum);
      var supStr = expNum === 2 ? "²" : expNum === 3 ? "³" : "^" + expNum;
      var powExpr = iso((hasParens && baseNum < 0 ? "(−" + absBase + ")" : baseNum < 0 ? "−" + absBase : String(absBase)) + supStr);
      var powSignStep = baseNum < 0
        ? (hasParens
          ? "המינוס נמצא בתוך הסוגריים, ולכן הבסיס הוא " + iso("−" + absBase) + ". מאחר שהמעריך " + expNum + " הוא " + (expNum % 2 === 0 ? "זוגי, תוצאת החזקה חיובית (+)." : "אי־זוגי, תוצאת החזקה שלילית (−).")
          : "אין סוגריים סביב המינוס, ולכן החזקה פועלת רק על " + absBase + " והסימן השלילי נשאר לפני התוצאה.")
        : "הבסיס חיובי (" + absBase + "), ולכן התוצאה חיובית.";
      var powAns = [
        "כדי לחשב את החזקה " + powExpr + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
        "1. זיהוי הבסיס והסימן: " + powSignStep,
        "2. משמעות המעריך: כפלו את הערך המוחלט " + absBase + " בעצמו " + expNum + " פעמים.",
        "3. חיבור השלבים: צרפו את הסימן משלב 1 לתוצאת הכפל משלב 2."
      ].join("\n");
      return makeResult(
        powAns,
        { id: "topic-powers-grade-7", label: "כיתה ז׳ · חזקות", href: "/powers-grade-7", grade: 7 },
        [{ id: "ws-powers-7", label: "דפי עבודה בחזקות", href: "/worksheets?grade=7&topic=6", grade: 7 }]
      );
    }
  }

  // 6. Square root: e.g. √36, שורש 49
  if (/√\s*\d+|שורש\s+(?:ריבועי\s+)?(?:של\s+)?\d+/.test(clean)) {
    var sqrtAns = [
      "כדי לחשב שורש ריבועי צעד אחר צעד (בלי לגלות את התשובה הסופית):",
      "1. משמעות השורש: שאלו — איזה מספר אי־שלילי, אם נכפול אותו בעצמו, ייתן את המספר שמתחת לשורש?",
      "2. בדיקה באמצעות חזקה: העלו את המספר שחשבתם עליו בריבוע ובדקו אם מתקבל המספר הנתון."
    ].join("\n");
    return makeResult(
      sqrtAns,
      { id: "topic-square-root-grade-7", label: "כיתה ז׳ · שורש ריבועי", href: "/square-root-grade-7", grade: 7 },
      [{ id: "ws-sqrt-7", label: "דפי עבודה בשורש ריבועי", href: "/worksheets?grade=7&topic=7", grade: 7 }]
    );
  }

  // 7. Binary multiplication or division (no slash '/'): e.g. (-12)÷3, (-12):3, (-4)×(-5)
  var mulDivMatch = clean.match(
    /(?:^|[^\dA-Za-z^²³])\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*([÷:×·*])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)(?=$|[^\dA-Za-z^²³])|(?:^|[^\dA-Za-z^²³])\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*([÷:×·*])\s*(-?\d+(?:\.\d+)?)(?=$|[^\dA-Za-z^²³])|(?:^|[^\dA-Za-z^²³])(-?\d+(?:\.\d+)?)\s*([÷:×·*])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)(?=$|[^\dA-Za-z^²³])|(?:^|[^\dA-Za-z^²³])(-?\d+(?:\.\d+)?)\s*([÷:×·*])\s*(-?\d+(?:\.\d+)?)(?=$|[^\dA-Za-z^²³])/
  );
  if (mulDivMatch) {
    var a = Number(mulDivMatch[1] ?? mulDivMatch[4] ?? mulDivMatch[7] ?? mulDivMatch[10]);
    var opRaw = mulDivMatch[2] ?? mulDivMatch[5] ?? mulDivMatch[8] ?? mulDivMatch[11];
    var b = Number(mulDivMatch[3] ?? mulDivMatch[6] ?? mulDivMatch[9] ?? mulDivMatch[12]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      var isDiv = opRaw === "÷" || opRaw === ":";
      var absA = Math.abs(a);
      var absB = Math.abs(b);
      var dispOp = isDiv ? "÷" : "×";
      var expr = iso(fmt(a) + " " + dispOp + " " + fmt(b));
      var absExpr = iso(absA + " " + dispOp + " " + absB);

      if (isDiv && b === 0) {
        return makeResult(
          "שימו לב: בתרגיל " + expr + " המחלק הוא 0, ובמתמטיקה חילוק ב־0 אינו מוגדר.",
          { id: "topic-dividing-signed-numbers-grade-7", label: "כיתה ז׳ · חילוק מספרים מכוונים", href: "/dividing-signed-numbers-grade-7", grade: 7 },
          [{ id: "ws-dividing-signed-7", label: "דפי עבודה בחילוק מספרים מכוונים", href: "/worksheets?grade=7&topic=4", grade: 7 }]
        );
      }

      if (a < 0 || b < 0) {
        var sameSign = (a < 0 && b < 0) || (a > 0 && b > 0);
        var actionWord = isDiv ? "חילוק" : "כפל";
        var verbWord = isDiv ? "חלקו" : "כפלו";
        var signStep = sameSign
          ? "שני המספרים בעלי אותו סימן, ולכן ב" + actionWord + " סימן התוצאה הוא חיובי (+)."
          : "אחד המספרים שלילי והשני חיובי (סימנים מנוגדים), ולכן ב" + actionWord + " סימן התוצאה הוא שלילי (−).";
        var signedAns = [
          "כדי לפתור את התרגיל " + expr + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
          "1. קביעת הסימן: " + signStep,
          "2. חישוב הערך המוחלט: " + verbWord + " את הערכים המוחלטים ללא הסימנים — כמה הם " + absExpr + "?",
          "3. חיבור השלבים: צרפו את הסימן שמצאתם בשלב 1 לתוצאה מחישוב שלב 2."
        ].join("\n");
        var primary = isDiv
          ? { id: "topic-dividing-signed-numbers-grade-7", label: "כיתה ז׳ · חילוק מספרים מכוונים", href: "/dividing-signed-numbers-grade-7", grade: 7 }
          : { id: "topic-multiplying-signed-numbers-grade-7", label: "כיתה ז׳ · כפל מספרים מכוונים", href: "/multiplying-signed-numbers-grade-7", grade: 7 };
        var chips = isDiv
          ? [{ id: "ws-dividing-signed-7", label: "דפי עבודה בחילוק מספרים מכוונים", href: "/worksheets?grade=7&topic=4", grade: 7 }]
          : [{ id: "ws-multiplying-signed-7", label: "דפי עבודה בכפל מספרים מכוונים", href: "/worksheets?grade=7&topic=3", grade: 7 }];
        return makeResult(signedAns, primary, chips);
      }
    }
  }

  // 8. Binary addition or subtraction with signed numbers (requires at least one negative operand): e.g. (-12)+3, -7-4
  var addSubMatch = clean.match(
    /(?:^|[^\dA-Za-z^²³-])(?:\(\s*(-\d+(?:\.\d+)?)\s*\)|(-\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?))\s*([+-])\s*(?:\(\s*(-\d+(?:\.\d+)?)\s*\)|(-\d+(?:\.\d+)?)|(\d+(?:\.\d+)?))(?=$|[^\dA-Za-z^²³])/
  );
  if (addSubMatch) {
    var a2 = Number(addSubMatch[1] ?? addSubMatch[2] ?? addSubMatch[3]);
    var op2 = addSubMatch[4];
    var b2 = Number(addSubMatch[5] ?? addSubMatch[6] ?? addSubMatch[7]);
    if (Number.isFinite(a2) && Number.isFinite(b2) && (a2 < 0 || b2 < 0)) {
      var effectiveB = op2 === "-" ? -b2 : b2;
      var absA2 = Math.abs(a2);
      var absB2 = Math.abs(effectiveB);
      var sameSign2 = (a2 < 0 && effectiveB < 0) || (a2 > 0 && effectiveB > 0);
      var expr2 = iso(fmt(a2) + " " + (op2 === "-" ? "−" : "+") + " " + fmt(b2));
      var step1 =
        op2 === "-" && b2 < 0
          ? "1. הפיכת חיסור לחיבור הנגדי: חיסור מספר שלילי שווה לחיבור המספר הנגדי החיובי (" + iso(fmt(a2) + " + " + absB2) + ")."
          : "1. בדיקת סימנים על ישר המספרים: מחברים או מחסרים שני מספרים מכוונים.";
      var step2 = sameSign2
        ? "2. חישוב הגודל: מאחר שהסימנים באותו כיוון, חברו את הערכים המוחלטים (" + iso(absA2 + " + " + absB2) + ") והשאירו את הסימן המשותף."
        : "2. השוואת ערכים מוחלטים: השוו בין " + absA2 + " לבין " + absB2 + ". סימן התוצאה נקבע לפי המספר בעל הערך המוחלט הגדול יותר, והגודל הוא ההפרש ביניהם (" + iso(Math.max(absA2, absB2) + " − " + Math.min(absA2, absB2)) + ").";
      var addSubAns = [
        "כדי לפתור את התרגיל " + expr2 + " צעד אחר צעד (בלי לגלות את התשובה הסופית):",
        step1,
        step2,
        "3. בדיקה: בדקו על ישר המספרים אם התוצאה נמצאת בצד החיובי או השלילי."
      ].join("\n");
      return makeResult(
        addSubAns,
        { id: "topic-signed-numbers-grade-7", label: "כיתה ז׳ · חיבור וחיסור מספרים מכוונים", href: "/signed-numbers-grade-7", grade: 7 },
        [{ id: "ws-signed-7", label: "דפי עבודה במספרים מכוונים", href: "/worksheets?grade=7&topic=2", grade: 7 }]
      );
    }
  }

  return null;
}
