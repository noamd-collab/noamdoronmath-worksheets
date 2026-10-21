# שילוב PR 62 (מבלוג לסרטון ב־HeyGen): בדיקה מחודשת, 18.10.2026

**מה נבדק:** מיזוג ניסיוני מקומי, שלא נדחף, מול `headless/astro-poc-baseline` בגרסה `eebd4c0`. ‏PR 62 נבדק ב־`6fdb85c`.

## התלות ב־PR 54

- **הבסיס של PR 62:** ‏PR 54, ‏`claude/cutover-content-fixes` בגרסה `3f84441`.
- **PR 54 מתנגש עכשיו עם הבסיס ב־10 קבצים**, כולם קובצי קטלוג: `index.html`, ‏`catalog.v1.json`, ‏sha256, ‏snapshot, ‏`noam-learning-catalog.js`, ‏legacy-github, ‏sync-provenance ו־`design-exact-protected.test.ts`.
- **מי פותר:** הקונפליקטים שייכים ל־PR 54 או לאינטגרציה. צריך לפתור אותם ב־`index.html` ואז ליצור את הקטלוג מחדש בכלי הריפו.
- **בקובצי הפוסטים אין קונפליקט:** תיקוני PR 54 בפוסטים חלים נקי על הבסיס.

## הקבצים של PR 62 עצמו

- כולם קבצים חדשים: `blog-video/**` ו־`.github/workflows/blog-video-check.yml`.
- הם חלים על הבסיס בלי קונפליקט.

## תוצאות

| מצב | בדיקות (`node --test blog-video/test/*.test.mjs`) | `bin/build.mjs` | סטטוס הסקירה של הפיילוט |
|---|---|---|---|
| בסיס + PR 62, בלי PR 54 | 34/36 | 0 שגיאות, 8 אזהרות | נפתחה מחדש (`cited-source-changed` / `post-changed-elsewhere`) |
| בסיס + תיקוני הפוסטים של PR 54 + PR 62 | 35/36 | 0 שגיאות, 2 אזהרות | `current` |

**למה הסקירה נפתחה מחדש בלי PR 54:** שלושת פוסטי הפיילוט לא השתנו בבסיס מאז `1be6a0d`. ההבדל היחיד הוא שבבסיס חסרים תיקוני PR 54. זו ההתנהגות הנכונה של הכלי: מקור שונה ממה שנסקר פותח את הסקירה מחדש.

**הכשל שנשאר (generated up to date):**
- **הסיבה:** בבסיס נוספו 8 פוסטים, כך שיש עכשיו 68 במקום 60.
- **התיקון:** אחרי המיזוג להריץ `node blog-video/bin/build.mjs`. הוא מוסיף את 8 הפוסטים למלאי בסטטוס `not-read` / `not-started`, ואחר כך לבצע commit.
- **מה לא נעשה:** את 8 הפוסטים עדיין צריך לקרוא. לא נכתבו להם תסריטים:
  - `adaptive-learning-math`
  - `consistent-math-practice-results`
  - `multiplication-games-practice`
  - `perimeter-and-area-explained`
  - `simplify-expressions-grade-7`
  - `smart-math-assistant-keep-thinking`
  - `teach-long-division-without-guessing`
  - `what-is-order-of-operations`

**`produce.mjs plan`:** כל הסרטונים עדיין חסומים, כצפוי. לא נשלח דבר. חסרים:
- מזהה הקול של נועם
- הבחירה בין קריינות מנוקדת ללא מנוקדת
- בדיקת מכסה ב־HeyGen
- חוזה מאומת מול התיעוד הרשמי

## סדר שילוב מומלץ

1. **PR 54:** לפתור את קונפליקטי הקטלוג במקור, ואז ליצור את הקטלוג מחדש.
2. **PR 62:** לשנות את ה־base ל־`headless/astro-poc-baseline`, או למזג אחרי 54.
3. **אחרי המיזוג:**
   - להריץ `node blog-video/bin/build.mjs` ולבצע commit למלאי המעודכן.
   - להריץ `node --test blog-video/test/*.test.mjs`. התוצאה הצפויה היא 36/36.
