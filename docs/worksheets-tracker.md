# Worksheet tracker

One row per grade and topic in `headless/astro-poc/src/data/catalog.v1.json` on `headless/astro-poc-baseline` (`3911160f`). That file is generated from `index.html`. Level names are the catalog labels.

Columns: grade, topic, levels present, author, reviewed, live, PR.

- Author is `unknown` for every row. No per-topic author was found in merged PR text.
- Live is `unknown` for every row. These PRs say `wix release` was not run, and this check did not verify `noamdoronmath.co.il`.
- Reviewed `yes` means the current PDF id is still the reviewed replacement from #98 (grade 9), #99 (grade 8), or #100 (grade 7).
- Reviewed `no (#104...)` means the current PDF id was written by #104, which skipped Qwen and DeepSeek review.
- #88 replaced specific grade 3 and grade 6 media ids (round 6). That PR does not say those sheets were reviewed, so those levels stay `unknown` and the PR is listed on that level only.
- #100 names three levels that failed review and were not changed: G7-T02 c, G7-T04 b, G7-T11 c. Other levels left off the replacement lists are `unknown`, not failed.
- `noamd-collab/noam-agent-hub` was not readable (repository not found with this token). Nothing from that repo is in this table.
- Topics named in the staging stub as pending (G7-T28, G7-T47, G7-T48, G8-T11, G8-T26, G8-T29, G8-T37, G8-T49, G8-T35, G9-T17, G9-T32) are filled only from the catalog and the PRs above. The stub's author and pending status were not copied.

| Grade | Topic | Levels | Author | Reviewed | Live | PR |
|---|---|---|---|---|---|---|
| כיתה א׳ | מונים בלי לפספס (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | קוראים כותבים ומייצגים עד 100 (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | סדר שכנים והשוואה (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מרכיבים ומפרקים עד 10 (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיבור בתחום 10 (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיסור בתחום 10 (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | בונים 20 דרך 10 (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיבור בתחום 20 (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיסור בתחום 20 (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | שוויון נעלם והשוואת תרגילים (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | דפוסים וסדרות (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חוקרים את לוח המאה (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | שרשראות ופירמידות מספרים (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | בעיות מילוליות בציור ובמספר (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מודדים ומשווים אורך (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | קבוצות שוות וחיבור חוזר (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מצולעים (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | ריבוע ומלבן (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מרכיבים ומפרקים (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | שעה שלמה (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | נתונים (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | בעיות מילוליות פשוטות (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | הרכבה ופירוק (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חוזרים להרכבות 10 ו 20 (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | עשרות ויחידות בתחום 100 (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | סדר השוואה וישר מספרים (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מוסיפים עשרות ומפרקים מספרים (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיבור דו ספרתי ללא המרה (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיבור דו ספרתי עם המרה (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיסור דו ספרתי ללא פריטה (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיסור דו ספרתי עם פריטה (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | אסטרטגיות חישוב אומדן ופיצוי (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | שוויון ומספר חסר (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | בעיות מילוליות וכסף (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | קוראים טבלה ודיאגרמת עמודות (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מאות עשרות ויחידות (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | ממיינים ומשווים מספרים עד 1000 (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מספרים עד 1000 (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | כפל קבוצות שוות ומערכים (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חילוק להכלה (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חילוק לחלקים שווים (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | משפחת כפל וחילוק (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | פי בקבוצות שוות (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | זוגי אי זוגי וסדרות א (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | זוגי אי זוגי וסדרות ב (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מדידת אורך (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | בעיות מילוליות וכסף פשוט (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | שעון ומשך זמן (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חצי ורבע (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | צורות וגופים לא אותו דבר (id 28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | סימטרייה שיקופית אינטואיטיבית (id 29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | סיכום מספרים פעולות וייצוגים (id 30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | ערך מקום (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | שכנים וישר מספרים (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | סדרות ואיתור טעות (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | אל הרבבה (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | אומדן באמצעות מספרים קרובים (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | חיבור בטור עם המרה (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | חיסור בטור עם פריטה (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 (c) |
| כיתה ג׳ | בעיות מילוליות (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | כפל עובדות ומבנים (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | חילוק והקשר ההפוך לכפל (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | שברי יחידה וחלק משלם (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | זווית וסוגי זוויות (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | קווים וזוויות בצורות מוכרות (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מצולעים צלעות וקודקודים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | היקף מצולעים (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מיון משולשים (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מרובעים לפי תכונות (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | צורות על רשת בנייה ופירוק (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מדידות זמן ומשקל (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | קוראים דיאגרמה (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | חילוק ובדיקה בכפל (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מדידות אורך סמ ומטר (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | בונים ומפרקים צורות (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | אוספים נתונים (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | כסף (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מספרים עד מיליון קריאה ופירוק (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סדר שכנים ועיגול בתחום המיליון (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חיבור רב ספרתי בטור (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חיסור רב ספרתי בטור (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | אומדן ובעיות חיבור וחיסור כולל כסף (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חוקי פעולות וכפל בעשרות שלמות (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סדר פעולות חשבון (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חוק הפילוג ומכפלות חלקיות (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | כפל רב ספרתי (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חילוק ארוך ושארית (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שבר ייצוגים ושמות שקולים (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שברים על ישר והשוואה (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שברים שקולים ייצוגים השוואה וישר מספרים (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | התחלקות וגורמים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מספרים ראשוניים ופריקים (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מקבילים ומאונכים בצורות (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מצולעים ואלכסונים (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מלבנים ריבועים ויחסי הכלה (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סוגי זוויות (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מיון משולשים (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | יחידות אורך והמרות (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שטח והיקף של מלבן וריבוע (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שטח והיקף של צורות מורכבות (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | זמן ומשקל המרות ויישום (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | דיאגרמות ומסקנות (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סימטריה שיקופית וסיבובית (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | זוויות וקווים במישור (id 27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | משולשים מיון ובנייה (id 28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מרובעים תכונות מיון והכלה (id 29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | דף סיכום אינטגרטיבי לכיתה ד (id 31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | תובנה מספרית כפל וחילוק בעשרות ומאות (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | מספרים גדולים ערך מקום עיגול ואומדן (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | כפל רב ספרתי ובדיקת סבירות (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חילוק מאונך ושארית (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | גורמים ראשוניים ופריקים (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | סדר פעולות תכנון ולא רק ביצוע (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חזרה על משמעות השבר וייצוגיו (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שברים על ישר והשוואה (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | הרחבה וצמצום שברים שקולים (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | מכנה משותף בחירה יעילה (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חיבור וחיסור שברים במכנים שונים (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חלק מכמות (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שברים גדולים מ 1 ומספרים מעורבים (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חיבור וחיסור מספרים מעורבים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | השלמת שברים ופעולות הפוכות (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | קריאת טבלאות וחישוב נתונים (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | קריאת גרפים והשוואת נתונים (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | משפחת המרובעים ויחסי הכלה (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | תכונות ואלכסונים במרובעים (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | בניית צורות ומיון לפי תכונות (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | המרות יחידות ומדידת משקל (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | היקף יחידות וקווים מקבילים מאונכים (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | גובה במשולש חד זווית וישר זווית (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | גובה במשולש קהה ובמקבילית (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח והיקף של מלבנים וריבועים (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח צורה מורכבת פירוק והרכבה (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח מקבילית והקשר למלבן (id 27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | מספרים עשרוניים ערך מקום וייצוגים (id 28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | משווים שברים ומספרים עשרוניים (id 29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חיבור וחיסור מספרים עשרוניים ואומדן (id 30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח משולש בסיס וגובה (id 31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | נעלמים ומשוואות בשברים (id 32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | ממוצע וחקר נתונים (id 33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שכיחות סיכוי וזמן מתוך נתונים (id 34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שיקוף סיבוב והזזה (id 35) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל שבר במספר שלם (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל כחלק מכמות ושטח (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל שבר בשבר (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל מספרים מעורבים (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל שברים יישום ובקרה (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | משמעות חילוק שברים (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | אלגוריתם חילוק שברים והופכי (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל וחילוק שברים בחירת פעולה (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל מספרים עשרוניים (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | חילוק מספרים עשרוניים (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | חקר גופים ותכונותיהם (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | תיבות ופריסות מעבר בין דו ממד לתלת ממד (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | שטח פנים של תיבה (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | נפח תיבה ומבנים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | קיבול סמק ליטר ומק (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | מרובעים ויחסי הכלה חזרה מנומקת (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | דף סינתזה מדידות גאומטריה ופתרון רב שלבי (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | שבר עשרוני ואחוז שלושה ייצוגים לאותו מספר (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | אחוז כחלק מכמות (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | מציאת השלם ויישומי אחוזים (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | יחס משמעות ייצוג ויחסים שקולים (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 (c) |
| כיתה ו׳ | קנה מידה במפות ובשרטוטים (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | מספרים ופעולות סדר אומדן ובדיקת סבירות (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ו׳ | אוספים ומייצגים נתונים (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ו׳ | משווים קבוצות ומנסחים מסקנות זהירות (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ו׳ | שינוי ממדים מה קורה להיקף לשטח ולנפח (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | חוקיות ופתרון בעיות רב שלביות (id 27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ז׳ | מספרים מכוונים — ישר המספרים וערך מוחלט (G7-T01) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | חיבור וחיסור מספרים מכוונים (G7-T02) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b yes (#100); c failed review, not changed (#100) | unknown | #100 |
| כיתה ז׳ | כפל מספרים מכוונים (G7-T03) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | חילוק מספרים מכוונים (G7-T04) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b failed review, not changed (#100); c yes (#100) | unknown | #100 |
| כיתה ז׳ | סדר פעולות החשבון במספרים מכוונים (G7-T05) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | חזקות עם מעריך טבעי (G7-T06) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שורש ריבועי (G7-T07) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | מערכת צירים — היכרות וקנה מידה (G7-T08) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | הרחבת מערכת הצירים חלק 1 (G7-T09) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | הרחבת מערכת הצירים חלק 2 — יישום והעמקה (G7-T10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | זוויות חלק 1 — היכרות, סימון ומדידה (G7-T11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b yes (#100); c failed review, not changed (#100) | unknown | #100 |
| כיתה ז׳ | זוויות חלק 2 — יחסים ופעולות (G7-T12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | זוויות — דף חזרה מסכם (G7-T13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | סכום הזוויות במשולש ובמרובע (G7-T14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | משולשים מיוחדים (G7-T15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | משולש שווה־צלעות — העמקה ורשות (G7-T16) | העמקה ורשות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | מצולעים חופפים וטרנספורמציות (G7-T17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שטח מלבן וריבוע — העמקה (G7-T18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שטח משולש — העמקה (G7-T19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | תיבה וקובייה (G7-T20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | חוקיות (G7-T21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | משתנים וביטויים אלגבריים — שפה ומידול (G7-T22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | הצבה בביטויים אלגבריים (G7-T23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | איסוף וקריאת מידע (G7-T24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ז׳ | שכיחות (G7-T25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ז׳ | שכיחות יחסית חלק 1 — היכרות (G7-T26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ז׳ | שכיחות יחסית חלק 2 — ניסויים ויציבות (G7-T27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ז׳ | הסתברות — היכרות (G7-T28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ז׳ | שוויון ביטויים חלק 1 — כינוס ופילוג (G7-T29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שוויון ביטויים חלק 2 — גורם משותף ומינוס לפני סוגריים (G7-T30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#100); c yes (#100) | unknown | #100 (b,c) |
| כיתה ז׳ | נקודות על גרף ברביע הראשון (G7-T31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | מהו פתרון של משוואה (G7-T32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b yes (#100); c unknown | unknown | #100 (a,b) |
| כיתה ז׳ | משוואות ופתרונן חלק 1 — מבוא (G7-T33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#100); c yes (#100) | unknown | #100 (b,c) |
| כיתה ז׳ | משוואות חד־שלביות (G7-T34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | משוואות דו־שלביות (G7-T35) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | מפשטים ואז פותרים (G7-T36) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | משוואות ופתרונן חלק 2 — סוגריים ושקילות (G7-T37) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | סוגריים וחוק הפילוג (G7-T38) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | הנעלם בשני האגפים (G7-T39) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שלושה ייצוגים לפתרון משוואה (G7-T40) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שאלות מילוליות באמצעות משוואות (G7-T41) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | פיתגורס חלק 1 — היכרות וחישוב (G7-T42) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | פיתגורס חלק 2 — שימושים (G7-T43) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | חישובי היקף — צורות מורכבות ואלגברה (G7-T44) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שטחים ב׳ חלק 1 — מקבילית וטרפז (G7-T45) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | שטחים ב׳ חלק 2 — מצולעים מורכבים (G7-T46) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | unknown | #100 |
| כיתה ז׳ | מנסרה משולשת חלק 1 — מבנה ונפח (G7-T47) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ז׳ | מנסרה משולשת חלק 2 — שטח פנים (G7-T48) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ז׳ | חזרה שנתית (G7-T49) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ז׳ | משימת הערכה 1 (G7-T50) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | אבחון קדם־ידע (G8-T01) | דף יחיד — כל הרמות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | משוואות ליניאריות (G8-T02) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#99); b unknown; c yes (#99) | unknown | #99 (a,c) |
| כיתה ח׳ | מכנים מספריים (G8-T03) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | יחס ופרופורציה (G8-T24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | קנה מידה (G8-T25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | אחוזים — ייצוגים (G8-T20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | בעיות אחוזים (G8-T21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | שינוי באחוזים (G8-T22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | שינויים עוקבים (G8-T23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | שורש ריבועי (G8-T48) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | פיתגורס (G8-T49) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | פיתגורס מורכב (G8-T50) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | גליל — שטח פנים (G8-T52) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | גליל — נפח (G8-T53) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | חרוט (G8-T54) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | ארגון נתונים (G8-T28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | עמודות ופיקטוגרמות (G8-T29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | דיאגרמת עוגה (G8-T30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | מושג הפונקציה (G8-T11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | סימון פונקציה (G8-T16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | מעבר בין ייצוגים (G8-T12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | טווח הנתונים (G8-T31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | הממוצע (G8-T32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | החציון (G8-T33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | בחירת מדד (G8-T34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | אוריינות וביקורת ייצוג (G8-T35) | דף יחיד — כל הרמות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | קצב השתנות (G8-T13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | שיפוע וישר y=mx (G8-T14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | פונקציה קווית (G8-T15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | חיתוך צירים (G8-T17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | משוואת ישר (G8-T18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | ישרים מקבילים לצירים (G8-T19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | תנועה (G8-T10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | אבחון אמצע שנה (G8-T26) | דף יחיד — כל הרמות | unknown | PASS static mapping/native/teacher context (#142 draft; external reviews pending) | no | #142 |
| כיתה ח׳ | גישור ותיקון פערים (G8-T27) | דף יחיד — כל הרמות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | חפיפת משולשים (G8-T38) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#99); b yes (#99); c unknown | unknown | #99 (a,b) |
| כיתה ח׳ | משפטי חפיפה (G8-T39) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#99); c yes (#99) | unknown | #99 (b,c) |
| כיתה ח׳ | הוכחה גאומטרית (G8-T40) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | זווית חיצונית (G8-T41) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#99); b yes (#99); c unknown | unknown | #99 (a,b) |
| כיתה ח׳ | משולש שווה שוקיים (G8-T42) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | הוכחה — שווה שוקיים (G8-T43) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | התיכון במשולש (G8-T44) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | דמיון משולשים (G8-T45) | רמה א׳, רמה ב׳, רמת מצוינות, מצוינות 2 | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | הוכחת דמיון (G8-T46) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | יחס שטחים (G8-T47) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | מילוליות — בחירת נעלמים (G8-T09) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | מערכות — חיתוך גרפי (G8-T06) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | מערכות — פתרון אלגברי (G8-T07) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | מערכות — מידול (G8-T08) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | הסתברות — מרחב תוצאות (G8-T36) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ח׳ | הסתברות — ניסוי והוגנות (G8-T37) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | אי־שוויון (G8-T04) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#99); c yes (#99) | unknown | #99 (b,c) |
| כיתה ח׳ | אי־שוויון גרפי (G8-T05) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | פיתגורס במרחב (G8-T51) | רמה א׳, רמה ב׳, רמת מצוינות, מצוינות 2 | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | סינתזה גאומטרית (G8-T55) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | העמקה — בעיות לא שגרתיות (G8-T56) | העמקה | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | העמקה — חקר והכללה (G8-T57) | העמקה | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | חזרה מסכמת (G8-T58) | דף תלמיד | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | הערכה מסכמת (G8-T59) | דף תלמיד | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | אבחון סוף שנה (G8-T60) | דף תלמיד | unknown | yes (#99) | unknown | #99 |
| כיתה ח׳ | אינטרפולציה ואקסטרפולציה (G8-T61) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | זוויות בין ישרים מקבילים (G8-T62) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | מעגל ועיגול — היקף ושטח (G8-T63) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | משימת הערכה 1 (G8-T64) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | הוכחות בחפיפת משולשים (G8-T65) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | חוק הפילוג המורחב (G9-T02) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | פירוק לגורמים (G9-T03) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | צמצום שברים אלגבריים (G9-T04) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | משולש שווה שוקיים (G9-T15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | הפונקציה הריבועית (G9-T06) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | משוואות ריבועיות ונוסחת השורשים (G9-T31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | המקבילית (G9-T17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | אי־שוויונות ריבועיים ומערכות משוואות (G9-T07) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | סטטיסטיקה (G9-T10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | הסתברות (G9-T11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | המלבן (G9-T18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | קדם אנליזה — מפונקציות לגרפים ובחזרה (G9-T12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | המעוין (G9-T19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#98); b unknown; c yes (#98) | unknown | #98 (a,c) |
| כיתה ט׳ | הריבוע (G9-T20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | גיאומטריה אנליטית (G9-T08) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | חוקי חזקות (G9-T01) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | שורשים (G9-T05) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | בעיות מילוליות (G9-T09) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | דמיון משולשים (G9-T32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | מעבר לחטיבה העליונה (G9-T13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | unknown | #98 |
| כיתה ט׳ | משולש שווה־צלעות — העמקה ורשות — לכיתה ט׳ (G9-T16) | דף יחיד — כל הרמות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | מצולעים חופפים וטרנספורמציות — לכיתה ט׳ (G9-T21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פיתגורס חלק 1 — היכרות וחישוב — לכיתה ט׳ (G9-T22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פיתגורס חלק 2 — שימושים — לכיתה ט׳ (G9-T23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטח מלבן וריבוע — העמקה — לכיתה ט׳ (G9-T24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטח משולש — העמקה — לכיתה ט׳ (G9-T25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטחים ב׳ חלק 1 — מקבילית וטרפז — לכיתה ט׳ (G9-T26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטחים ב׳ חלק 2 — מצולעים מורכבים — לכיתה ט׳ (G9-T27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | מנסרה משולשת חלק 1 — מבנה ונפח — לכיתה ט׳ (G9-T28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | מנסרה משולשת חלק 2 — שטח פנים — לכיתה ט׳ (G9-T29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | הרחבת מערכת הצירים חלק 2 — יישום והעמקה — לכיתה ט׳ (G9-T30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | גיאומטריה חישובית — משולש (G9-T33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פונקציה קווית (G9-T34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | משפט פיתגורס (G9-T35) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | קריאת גרפים (G9-T36) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | משולש ישר זווית 30-60-90 (G9-T37) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | יחסי צלעות וזוויות (G9-T38) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | הטרפז (G9-T39) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
| כיתה ט׳ | דמיון משולשים — משפט ז.ז וחישובים (G9-T40) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פירוק לגורמים 1 — הוצאת גורם משותף (G9-T41, parent 2) | גורם משותף · רמה א׳ | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פירוק לגורמים 2 — נוסחאות הכפל המקוצר וטרינום (G9-T42, parent 2) | כפל מקוצר וטרינום · רמה א׳ | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פירוק לגורמים 3 — פירוק מלא, משוואות ושברים אלגבריים (G9-T43, parent 2) | פירוק מלא ומשוואות · רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | דו איבר בריבוע (G9-T44) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | הפרש ריבועים (G9-T45) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | דלתון (G9-T46) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | unknown | #104 |
