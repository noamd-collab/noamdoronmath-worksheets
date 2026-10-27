# טקסטים למסך — order-of-operations-guide · long

- פוסט: איך פותרים סדר פעולות חשבון בלי להתבלבל?
- קישור קנוני: https://www.noamdoronmath.co.il/post/איך-פותרים-סדר-פעולות-חשבון-בלי-להתבלבל
- מקור: `headless/astro-poc/src/data/blog-posts/order-of-operations-guide.json`
- source hash: `e9737e413fa940c3` · script hash: `726c69189e9739ee`
- גרסה: long (יעד 90–120 שניות)
- משך משוער: 92.4 שניות (93.8 לפי 2.4 מילים לשנייה, 91.1 לפי 14 תווים לשנייה). **לא נמדד.**

כללי תצוגה: כל נוסחה מוצגת כאובייקט נפרד בכיוון LTR (לא בתוך שורת טקסט עברית), עם מינוס U+2212, כפל ×, חילוק בנקודתיים, וחזקות כמעריך עילי. אין להקליד חצים בתוך טקסט עברי.

| # | מקטע | סוג | טקסט מדויק | בדיקה |
|---|---|---|---|---|
| 1 | hook | formula | `8 + 2 × 3` | ok: value 14 |
| 2 | hook | text | 30 ?   14 ? | — |
| 3 | trap | text | 30 ✗   14 ✓ | — |
| 4 | rule | list | 1. סוגריים / 2. חזקות ושורשים / 3. כפל וחילוק / 4. חיבור וחיסור | — |
| 5 | solve | formula | `8 + 2 × 3` | ok: value 14 |
| 6 | solve | formula | `8 + 6 = 14` | ok: 14 | 14 |
| 7 | brackets | formula | `5 × (7 − 3)` | ok: value 20 |
| 8 | brackets | formula | `5 × 4 = 20` | ok: 20 | 20 |
| 9 | brackets-trap | formula | `5 × (7 − 3)` | ok: value 20 |
| 10 | same-rank | text | אותה דרגה: משמאל לימין | — |
| 11 | same-rank | graphic | חץ מתחת לתרגיל, מצביע ימינה | — |
| 12 | division | formula | `24 : 4 × 3` | ok: value 18 |
| 13 | division | formula | `6 × 3 = 18` | ok: 18 | 18 |
| 14 | parents | text | "מה הפעולה הראשונה שאתה רואה?" | — |
| 15 | parents | text | "יש כאן סוגריים?" | — |
| 16 | check | list | סוגריים ראשונים? / אותה דרגה משמאל לימין? / תוצאה הגיונית? | — |
| 17 | cta | text | הפוסט המלא: קישור בתיאור | — |
