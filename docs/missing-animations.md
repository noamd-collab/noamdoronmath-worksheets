# אנימציות חסרות בדפי נושא (missing animations)

מקור: `catalog.v1.json` (נושאים), `topicFamilies.json` + `src/lib/landingLoops.ts` (מיפוי אנימציות),
`src/data/topic-pages/` (דפים שכבר נבנו). הסטטוס מחושב דרך `topicLandingLoop()` עצמה.

- **exists** — לנושא יש אנימציה ממופית (concept / css / film).
- **missing** — אין מיפוי אנימציה; `topicLandingLoop()` זורקת שגיאה, ודף נושא לא ייבנה בלעדיה.
- דף נושא `—` = הדף עדיין לא נבנה.
- כיתות י׳–י״ב: אין נתוני נושאים באתר (אין קטלוג ואין hubs), ולכן אין טבלה.

## סיכום לפי כיתה

| כיתה | נושאים | דפים נבנו | אנימציה חסרה |
|---|---|---|---|
| 1 (א׳) | 23 | 23 | 0 |
| 2 (ב׳) | 29 | 14 | 0 |
| 3 (ג׳) | 25 | 14 | 0 |
| 4 (ד׳) | 30 | 17 | 0 |
| 5 (ה׳) | 35 | 18 | 0 |
| 6 (ו׳) | 27 | 14 | 0 |
| 7 (ז׳) | 50 | 39 | 0 |
| 8 (ח׳) | 65 | 26 | 0 |
| 9 (ט׳) | 45 | 41 | 0 |
| **סה״כ** | **329** | **206** | **0** |

## כיתה א׳ (grade 1)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 1 | מונים בלי לפספס | 1 | /counting-grade-1 | exists |
| 1 | קוראים כותבים ומייצגים עד 100 | 2 | /numbers-to-100-grade-1 | exists |
| 1 | סדר שכנים והשוואה | 3 | /number-neighbors-grade-1 | exists |
| 1 | מרכיבים ומפרקים עד 10 | 4 | /compose-decompose-10-grade-1 | exists |
| 1 | חיבור בתחום 10 | 5 | /addition-to-10-grade-1 | exists |
| 1 | חיסור בתחום 10 | 6 | /subtraction-to-10-grade-1 | exists |
| 1 | בונים 20 דרך 10 | 7 | /making-20-via-10-grade-1 | exists |
| 1 | חיבור בתחום 20 | 8 | /addition-to-20-grade-1 | exists |
| 1 | חיסור בתחום 20 | 9 | /subtraction-to-20-grade-1 | exists |
| 1 | שוויון נעלם והשוואת תרגילים | 10 | /equality-missing-number-grade-1 | exists |
| 1 | דפוסים וסדרות | 11 | /patterns-sequences-grade-1 | exists |
| 1 | חוקרים את לוח המאה | 12 | /hundred-chart-grade-1 | exists |
| 1 | שרשראות ופירמידות מספרים | 13 | /number-chains-pyramids-grade-1 | exists |
| 1 | בעיות מילוליות בציור ובמספר | 14 | /word-problems-picture-grade-1 | exists |
| 1 | מודדים ומשווים אורך | 15 | /measure-compare-length-grade-1 | exists |
| 1 | קבוצות שוות וחיבור חוזר | 16 | /equal-groups-repeated-addition-grade-1 | exists |
| 1 | מצולעים | 17 | /polygons-grade-1 | exists |
| 1 | ריבוע ומלבן | 18 | /square-rectangle-grade-1 | exists |
| 1 | מרכיבים ומפרקים | 19 | /compose-decompose-grade-1 | exists |
| 1 | שעה שלמה | 20 | /reading-clock-grade-1 | exists |
| 1 | נתונים | 21 | /data-grade-1 | exists |
| 1 | בעיות מילוליות פשוטות | 22 | /word-problems-simple-grade-1 | exists |
| 1 | הרכבה ופירוק | 23 | /shapes-compose-decompose-grade-1 | exists |

## כיתה ב׳ (grade 2)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 2 | חוזרים להרכבות 10 ו 20 | 1 | /number-bonds-10-20-grade-2 | exists |
| 2 | עשרות ויחידות בתחום 100 | 2 | /tens-and-ones-grade-2 | exists |
| 2 | סדר השוואה וישר מספרים | 3 | /order-compare-numberline-grade-2 | exists |
| 2 | מוסיפים עשרות ומפרקים מספרים | 4 | — | exists |
| 2 | חיבור דו ספרתי ללא המרה | 5 | — | exists |
| 2 | חיבור דו ספרתי עם המרה | 6 | — | exists |
| 2 | חיסור דו ספרתי ללא פריטה | 7 | — | exists |
| 2 | חיסור דו ספרתי עם פריטה | 8 | — | exists |
| 2 | אסטרטגיות חישוב אומדן ופיצוי | 9 | — | exists |
| 2 | שוויון ומספר חסר | 10 | /equality-missing-number-grade-2 | exists |
| 2 | בעיות מילוליות וכסף | 11 | /word-problems-money-grade-2 | exists |
| 2 | קוראים טבלה ודיאגרמת עמודות | 12 | /tables-bar-charts-grade-2 | exists |
| 2 | מאות עשרות ויחידות | 13 | /hundreds-tens-ones-grade-2 | exists |
| 2 | ממיינים ומשווים מספרים עד 1000 | 14 | /compare-numbers-to-1000-grade-2 | exists |
| 2 | מספרים עד 1000 | 15 | /numbers-to-1000-grade-2 | exists |
| 2 | כפל קבוצות שוות ומערכים | 16 | — | exists |
| 2 | חילוק להכלה | 17 | — | exists |
| 2 | חילוק לחלקים שווים | 18 | — | exists |
| 2 | משפחת כפל וחילוק | 19 | — | exists |
| 2 | פי בקבוצות שוות | 20 | — | exists |
| 2 | זוגי אי זוגי וסדרות א | 21 | /even-odd-sequences-a-grade-2 | exists |
| 2 | זוגי אי זוגי וסדרות ב | 22 | /even-odd-sequences-b-grade-2 | exists |
| 2 | מדידת אורך | 23 | — | exists |
| 2 | בעיות מילוליות וכסף פשוט | 24 | /word-problems-money-simple-grade-2 | exists |
| 2 | שעון ומשך זמן | 25 | — | exists |
| 2 | חצי ורבע | 26 | — | exists |
| 2 | צורות וגופים לא אותו דבר | 28 | — | exists |
| 2 | סימטרייה שיקופית אינטואיטיבית | 29 | /reflection-symmetry-grade-2 | exists |
| 2 | סיכום מספרים פעולות וייצוגים | 30 | /numbers-operations-review-grade-2 | exists |

## כיתה ג׳ (grade 3)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 3 | ערך מקום | 1 | /place-value-grade-3 | exists |
| 3 | שכנים וישר מספרים | 2 | /neighbors-numberline-grade-3 | exists |
| 3 | סדרות ואיתור טעות | 3 | /sequences-find-mistake-grade-3 | exists |
| 3 | אל הרבבה | 4 | /thousands-grade-3 | exists |
| 3 | אומדן באמצעות מספרים קרובים | 5 | /estimation-close-numbers-grade-3 | exists |
| 3 | חיבור בטור עם המרה | 6 | — | exists |
| 3 | חיסור בטור עם פריטה | 7 | — | exists |
| 3 | בעיות מילוליות | 8 | /word-problems-grade-3 | exists |
| 3 | כפל עובדות ומבנים | 9 | — | exists |
| 3 | חילוק והקשר ההפוך לכפל | 10 | — | exists |
| 3 | שברי יחידה וחלק משלם | 11 | — | exists |
| 3 | זווית וסוגי זוויות | 12 | /angles-types-grade-3 | exists |
| 3 | קווים וזוויות בצורות מוכרות | 13 | /lines-angles-shapes-grade-3 | exists |
| 3 | מצולעים צלעות וקודקודים | 14 | — | exists |
| 3 | היקף מצולעים | 15 | /perimeter-polygons-grade-3 | exists |
| 3 | מיון משולשים | 16 | /classify-triangles-grade-3 | exists |
| 3 | מרובעים לפי תכונות | 17 | /quadrilaterals-properties-grade-3 | exists |
| 3 | צורות על רשת בנייה ופירוק | 18 | — | exists |
| 3 | מדידות זמן ומשקל | 19 | — | exists |
| 3 | קוראים דיאגרמה | 20 | /read-bar-diagram-grade-3 | exists |
| 3 | חילוק ובדיקה בכפל | 21 | — | exists |
| 3 | מדידות אורך סמ ומטר | 22 | — | exists |
| 3 | בונים ומפרקים צורות | 23 | — | exists |
| 3 | אוספים נתונים | 24 | /collecting-data-grade-3 | exists |
| 3 | כסף | 25 | /money-grade-3 | exists |

## כיתה ד׳ (grade 4)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 4 | מספרים עד מיליון קריאה ופירוק | 1 | /numbers-to-million-grade-4 | exists |
| 4 | סדר שכנים ועיגול בתחום המיליון | 2 | /order-rounding-million-grade-4 | exists |
| 4 | חיבור רב ספרתי בטור | 3 | — | exists |
| 4 | חיסור רב ספרתי בטור | 4 | — | exists |
| 4 | אומדן ובעיות חיבור וחיסור כולל כסף | 5 | — | exists |
| 4 | חוקי פעולות וכפל בעשרות שלמות | 6 | — | exists |
| 4 | סדר פעולות חשבון | 7 | /order-of-operations-grade-4 | exists |
| 4 | חוק הפילוג ומכפלות חלקיות | 8 | /distributive-area-model-grade-4 | exists |
| 4 | כפל רב ספרתי | 9 | /multiplication-multi-digit-grade-4 | exists |
| 4 | חילוק ארוך ושארית | 10 | — | exists |
| 4 | שבר ייצוגים ושמות שקולים | 11 | — | exists |
| 4 | שברים על ישר והשוואה | 12 | — | exists |
| 4 | שברים שקולים ייצוגים השוואה וישר מספרים | 13 | — | exists |
| 4 | התחלקות וגורמים | 14 | — | exists |
| 4 | מספרים ראשוניים ופריקים | 15 | — | exists |
| 4 | מקבילים ומאונכים בצורות | 16 | /parallel-perpendicular-shapes-grade-4 | exists |
| 4 | מצולעים ואלכסונים | 17 | — | exists |
| 4 | מלבנים ריבועים ויחסי הכלה | 18 | /rectangles-squares-grade-4 | exists |
| 4 | סוגי זוויות | 19 | /angle-types-grade-4 | exists |
| 4 | מיון משולשים | 20 | /classify-triangles-grade-4 | exists |
| 4 | יחידות אורך והמרות | 21 | — | exists |
| 4 | שטח והיקף של מלבן וריבוע | 22 | /area-perimeter-rectangle-grade-4 | exists |
| 4 | שטח והיקף של צורות מורכבות | 23 | /area-perimeter-composite-grade-4 | exists |
| 4 | זמן ומשקל המרות ויישום | 24 | — | exists |
| 4 | דיאגרמות ומסקנות | 25 | /diagrams-conclusions-grade-4 | exists |
| 4 | סימטריה שיקופית וסיבובית | 26 | /symmetry-reflection-rotation-grade-4 | exists |
| 4 | זוויות וקווים במישור | 27 | /angles-lines-plane-grade-4 | exists |
| 4 | משולשים מיון ובנייה | 28 | /triangles-classify-build-grade-4 | exists |
| 4 | מרובעים תכונות מיון והכלה | 29 | /quadrilaterals-classify-grade-4 | exists |
| 4 | דף סיכום אינטגרטיבי לכיתה ד | 31 | /grade-4-summary | exists |

## כיתה ה׳ (grade 5)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 5 | תובנה מספרית כפל וחילוק בעשרות ומאות | 1 | — | exists |
| 5 | מספרים גדולים ערך מקום עיגול ואומדן | 2 | /big-numbers-rounding-grade-5 | exists |
| 5 | כפל רב ספרתי ובדיקת סבירות | 3 | /multiplication-multi-digit-grade-5 | exists |
| 5 | חילוק מאונך ושארית | 4 | — | exists |
| 5 | גורמים ראשוניים ופריקים | 5 | — | exists |
| 5 | סדר פעולות תכנון ולא רק ביצוע | 6 | /order-of-operations-grade-5 | exists |
| 5 | חזרה על משמעות השבר וייצוגיו | 7 | — | exists |
| 5 | שברים על ישר והשוואה | 8 | — | exists |
| 5 | הרחבה וצמצום שברים שקולים | 9 | — | exists |
| 5 | מכנה משותף בחירה יעילה | 10 | — | exists |
| 5 | חיבור וחיסור שברים במכנים שונים | 11 | — | exists |
| 5 | חלק מכמות | 12 | — | exists |
| 5 | שברים גדולים מ 1 ומספרים מעורבים | 13 | — | exists |
| 5 | חיבור וחיסור מספרים מעורבים | 14 | — | exists |
| 5 | השלמת שברים ופעולות הפוכות | 15 | — | exists |
| 5 | קריאת טבלאות וחישוב נתונים | 16 | /read-tables-grade-5 | exists |
| 5 | קריאת גרפים והשוואת נתונים | 17 | /read-graphs-grade-5 | exists |
| 5 | משפחת המרובעים ויחסי הכלה | 18 | /quadrilateral-family-grade-5 | exists |
| 5 | תכונות ואלכסונים במרובעים | 19 | /quadrilateral-diagonals-grade-5 | exists |
| 5 | בניית צורות ומיון לפי תכונות | 20 | — | exists |
| 5 | המרות יחידות ומדידת משקל | 21 | — | exists |
| 5 | היקף יחידות וקווים מקבילים מאונכים | 22 | /perimeter-parallel-perpendicular-grade-5 | exists |
| 5 | גובה במשולש חד זווית וישר זווית | 23 | /triangle-height-acute-right-grade-5 | exists |
| 5 | גובה במשולש קהה ובמקבילית | 24 | /triangle-height-obtuse-parallelogram-grade-5 | exists |
| 5 | שטח והיקף של מלבנים וריבועים | 25 | /area-perimeter-rectangles-grade-5 | exists |
| 5 | שטח צורה מורכבת פירוק והרכבה | 26 | /composite-area-grade-5 | exists |
| 5 | שטח מקבילית והקשר למלבן | 27 | /parallelogram-area-grade-5 | exists |
| 5 | מספרים עשרוניים ערך מקום וייצוגים | 28 | — | exists |
| 5 | משווים שברים ומספרים עשרוניים | 29 | — | exists |
| 5 | חיבור וחיסור מספרים עשרוניים ואומדן | 30 | — | exists |
| 5 | שטח משולש בסיס וגובה | 31 | /triangle-area-grade-5 | exists |
| 5 | נעלמים ומשוואות בשברים | 32 | /missing-number-fractions-grade-5 | exists |
| 5 | ממוצע וחקר נתונים | 33 | /mean-data-inquiry-grade-5 | exists |
| 5 | שכיחות סיכוי וזמן מתוך נתונים | 34 | /frequency-chance-grade-5 | exists |
| 5 | שיקוף סיבוב והזזה | 35 | /transformations-grade-5 | exists |

## כיתה ו׳ (grade 6)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 6 | כפל שבר במספר שלם | 1 | — | exists |
| 6 | כפל כחלק מכמות ושטח | 2 | — | exists |
| 6 | כפל שבר בשבר | 3 | — | exists |
| 6 | כפל מספרים מעורבים | 4 | — | exists |
| 6 | כפל שברים יישום ובקרה | 5 | — | exists |
| 6 | משמעות חילוק שברים | 6 | — | exists |
| 6 | אלגוריתם חילוק שברים והופכי | 7 | — | exists |
| 6 | כפל וחילוק שברים בחירת פעולה | 8 | — | exists |
| 6 | כפל מספרים עשרוניים | 9 | — | exists |
| 6 | חילוק מספרים עשרוניים | 10 | — | exists |
| 6 | חקר גופים ותכונותיהם | 11 | /solids-explore-grade-6 | exists |
| 6 | תיבות ופריסות מעבר בין דו ממד לתלת ממד | 12 | /boxes-nets-grade-6 | exists |
| 6 | שטח פנים של תיבה | 13 | /box-surface-area-grade-6 | exists |
| 6 | נפח תיבה ומבנים | 14 | /box-volume-grade-6 | exists |
| 6 | קיבול סמק ליטר ומק | 15 | — | exists |
| 6 | מרובעים ויחסי הכלה חזרה מנומקת | 16 | /quadrilaterals-review-grade-6 | exists |
| 6 | דף סינתזה מדידות גאומטריה ופתרון רב שלבי | 17 | /measurement-geometry-synthesis-grade-6 | exists |
| 6 | שבר עשרוני ואחוז שלושה ייצוגים לאותו מספר | 18 | /fraction-decimal-percent-grade-6 | exists |
| 6 | אחוז כחלק מכמות | 19 | /percent-of-quantity-grade-6 | exists |
| 6 | מציאת השלם ויישומי אחוזים | 20 | /find-the-whole-grade-6 | exists |
| 6 | יחס משמעות ייצוג ויחסים שקולים | 21 | — | exists |
| 6 | קנה מידה במפות ובשרטוטים | 22 | — | exists |
| 6 | מספרים ופעולות סדר אומדן ובדיקת סבירות | 23 | /numbers-operations-review-grade-6 | exists |
| 6 | אוספים ומייצגים נתונים | 24 | /collect-represent-data-grade-6 | exists |
| 6 | משווים קבוצות ומנסחים מסקנות זהירות | 25 | /compare-groups-conclusions-grade-6 | exists |
| 6 | שינוי ממדים מה קורה להיקף לשטח ולנפח | 26 | /scaling-dimensions-grade-6 | exists |
| 6 | חוקיות ופתרון בעיות רב שלביות | 27 | /patterns-multistep-grade-6 | exists |

## כיתה ז׳ (grade 7)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 7 | מערכת צירים — היכרות וקנה מידה | 8 | /coordinate-plane-scale-grade-7 | exists |
| 7 | מספרים מכוונים — ישר המספרים וערך מוחלט | 1 | /number-line-absolute-value-grade-7 | exists |
| 7 | זוויות חלק 1 — היכרות, סימון ומדידה | 11 | /angles-introduction-measurement-grade-7 | exists |
| 7 | חיבור וחיסור מספרים מכוונים | 2 | /signed-numbers-grade-7 | exists |
| 7 | הרחבת מערכת הצירים חלק 1 | 9 | /coordinate-plane-four-quadrants-grade-7 | exists |
| 7 | זוויות חלק 2 — יחסים ופעולות | 12 | /angles-grade-7 | exists |
| 7 | זוויות — דף חזרה מסכם | 13 | /angles-review-grade-7 | exists |
| 7 | הרחבת מערכת הצירים חלק 2 — יישום והעמקה | 10 | /coordinate-plane-applications-grade-7 | exists |
| 7 | כפל מספרים מכוונים | 3 | /multiplying-signed-numbers-grade-7 | exists |
| 7 | חילוק מספרים מכוונים | 4 | /dividing-signed-numbers-grade-7 | exists |
| 7 | סדר פעולות החשבון במספרים מכוונים | 5 | /order-of-operations-signed-numbers-grade-7 | exists |
| 7 | משולשים מיוחדים | 15 | /special-triangles-grade-7-new | exists |
| 7 | סכום הזוויות במשולש ובמרובע | 14 | /triangle-quadrilateral-angle-sum-grade-7 | exists |
| 7 | מצולעים חופפים וטרנספורמציות | 17 | — | exists |
| 7 | חזקות עם מעריך טבעי | 6 | /powers-grade-7 | exists |
| 7 | שורש ריבועי | 7 | /square-root-grade-7 | exists |
| 7 | שטח מלבן וריבוע — העמקה | 18 | /area-rectangle-perimeter-grade-7 | exists |
| 7 | שטח משולש — העמקה | 19 | /triangle-area-grade-7 | exists |
| 7 | משתנים וביטויים אלגבריים — שפה ומידול | 22 | /algebraic-expressions-grade-7 | exists |
| 7 | הצבה בביטויים אלגבריים | 23 | /equations-advanced-grade-7 | exists |
| 7 | חוקיות | 21 | /patterns-and-graphs-grade-7 | exists |
| 7 | שוויון ביטויים חלק 1 — כינוס ופילוג | 29 | /combining-like-terms-grade-7 | exists |
| 7 | תיבה וקובייה | 20 | /solids-box-cube-prism-grade-7 | exists |
| 7 | איסוף וקריאת מידע | 24 | — | exists |
| 7 | שכיחות | 25 | — | exists |
| 7 | שכיחות יחסית חלק 1 — היכרות | 26 | — | exists |
| 7 | שכיחות יחסית חלק 2 — ניסויים ויציבות | 27 | — | exists |
| 7 | הסתברות — היכרות | 28 | — | exists |
| 7 | שוויון ביטויים חלק 2 — גורם משותף ומינוס לפני סוגריים | 30 | /algebraic-expressions-grade-7 | exists |
| 7 | משוואות ופתרונן חלק 1 — מבוא | 33 | — | exists |
| 7 | מהו פתרון של משוואה | 32 | /equations-basics-grade-7 | exists |
| 7 | משוואות חד־שלביות | 34 | /equations-basics-grade-7 | exists |
| 7 | משוואות דו־שלביות | 35 | — | exists |
| 7 | מפשטים ואז פותרים | 36 | /equations-advanced-grade-7 | exists |
| 7 | משוואות ופתרונן חלק 2 — סוגריים ושקילות | 37 | /equations-advanced-grade-7 | exists |
| 7 | סוגריים וחוק הפילוג | 38 | /equations-advanced-grade-7 | exists |
| 7 | הנעלם בשני האגפים | 39 | /equations-both-sides-word-problems-grade-7 | exists |
| 7 | שלושה ייצוגים לפתרון משוואה | 40 | /equations-both-sides-word-problems-grade-7 | exists |
| 7 | פיתגורס חלק 1 — היכרות וחישוב | 42 | /pythagorean-theorem-grade-7 | exists |
| 7 | פיתגורס חלק 2 — שימושים | 43 | /pythagoras-applications-grade-7 | exists |
| 7 | שאלות מילוליות באמצעות משוואות | 41 | /equations-both-sides-word-problems-grade-7 | exists |
| 7 | שטחים ב׳ חלק 1 — מקבילית וטרפז | 45 | /area-parallelogram-trapezoid-composite-grade-7 | exists |
| 7 | שטחים ב׳ חלק 2 — מצולעים מורכבים | 46 | /area-parallelogram-trapezoid-composite-grade-7 | exists |
| 7 | נקודות על גרף ברביע הראשון | 31 | /patterns-and-graphs-grade-7 | exists |
| 7 | חישובי היקף — צורות מורכבות ואלגברה | 44 | /area-rectangle-perimeter-grade-7 | exists |
| 7 | מנסרה משולשת חלק 1 — מבנה ונפח | 47 | /solids-box-cube-prism-grade-7 | exists |
| 7 | מנסרה משולשת חלק 2 — שטח פנים | 48 | /solids-box-cube-prism-grade-7 | exists |
| 7 | משולש שווה־צלעות — העמקה ורשות | 16 | — | exists |
| 7 | חזרה שנתית | 49 | — | exists |
| 7 | משימת הערכה 1 | 50 | — | exists |

## כיתה ח׳ (grade 8)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 8 | אבחון קדם־ידע | 1 | — | exists |
| 8 | משוואות ליניאריות | 2 | /linear-equations-grade-8 | exists |
| 8 | מכנים מספריים | 3 | — | exists |
| 8 | יחס ופרופורציה | 4 | — | exists |
| 8 | קנה מידה | 5 | — | exists |
| 8 | אחוזים — ייצוגים | 6 | — | exists |
| 8 | בעיות אחוזים | 7 | /percentage-problems-grade-8 | exists |
| 8 | שינוי באחוזים | 8 | — | exists |
| 8 | שינויים עוקבים | 9 | — | exists |
| 8 | שורש ריבועי | 10 | — | exists |
| 8 | פיתגורס | 11 | /pythagorean-theorem-grade-8 | exists |
| 8 | פיתגורס מורכב | 12 | /advanced-pythagoras-grade-8 | exists |
| 8 | גליל — שטח פנים | 13 | /cylinder-surface-area-grade-8 | exists |
| 8 | גליל — נפח | 14 | /cylinder-volume-grade-8 | exists |
| 8 | חרוט | 15 | /cone-grade-8 | exists |
| 8 | ארגון נתונים | 16 | /statistics-grade-8 | exists |
| 8 | עמודות ופיקטוגרמות | 17 | — | exists |
| 8 | דיאגרמת עוגה | 18 | — | exists |
| 8 | מושג הפונקציה | 19 | — | exists |
| 8 | סימון פונקציה | 20 | — | exists |
| 8 | מעבר בין ייצוגים | 21 | — | exists |
| 8 | טווח הנתונים | 22 | — | exists |
| 8 | הממוצע | 23 | — | exists |
| 8 | החציון | 24 | — | exists |
| 8 | בחירת מדד | 25 | — | exists |
| 8 | אוריינות וביקורת ייצוג | 26 | — | exists |
| 8 | קצב השתנות | 27 | — | exists |
| 8 | שיפוע וישר y=mx | 28 | — | exists |
| 8 | פונקציה קווית | 29 | /linear-function-grade-8 | exists |
| 8 | חיתוך צירים | 30 | — | exists |
| 8 | משוואת ישר | 31 | — | exists |
| 8 | ישרים מקבילים לצירים | 32 | — | exists |
| 8 | תנועה | 33 | — | exists |
| 8 | אבחון אמצע שנה | 34 | — | exists |
| 8 | גישור ותיקון פערים | 35 | — | exists |
| 8 | חפיפת משולשים | 36 | /triangle-congruence-grade-8 | exists |
| 8 | משפטי חפיפה | 37 | /congruence-theorems-grade-8 | exists |
| 8 | הוכחה גאומטרית | 38 | /geometric-proof-grade-8 | exists |
| 8 | הוכחות בחפיפת משולשים | 65 | /triangle-congruence-proofs-grade-8 | exists |
| 8 | זווית חיצונית | 39 | /exterior-angle-triangle-grade-8 | exists |
| 8 | משולש שווה שוקיים | 40 | /isosceles-triangle-properties-grade-8 | exists |
| 8 | הוכחה — שווה שוקיים | 41 | /isosceles-triangle-grade-8 | exists |
| 8 | התיכון במשולש | 42 | /triangle-median-grade-8 | exists |
| 8 | דמיון משולשים | 43 | /similar-triangles-grade-8 | exists |
| 8 | הוכחת דמיון | 44 | /triangle-similarity-proof-grade-8 | exists |
| 8 | יחס שטחים | 45 | /similar-triangles-area-ratio-grade-8 | exists |
| 8 | מילוליות — בחירת נעלמים | 46 | — | exists |
| 8 | מערכות — חיתוך גרפי | 47 | /systems-of-equations-grade-8 | exists |
| 8 | מערכות — פתרון אלגברי | 48 | — | exists |
| 8 | מערכות — מידול | 49 | — | exists |
| 8 | הסתברות — מרחב תוצאות | 50 | — | exists |
| 8 | הסתברות — ניסוי והוגנות | 51 | — | exists |
| 8 | אי־שוויון | 52 | /inequalities-grade-8 | exists |
| 8 | אי־שוויון גרפי | 53 | — | exists |
| 8 | פיתגורס במרחב | 54 | /pythagoras-in-space-grade-8 | exists |
| 8 | סינתזה גאומטרית | 55 | /coordinate-plane-grade-8 | exists |
| 8 | העמקה — בעיות לא שגרתיות | 56 | — | exists |
| 8 | העמקה — חקר והכללה | 57 | — | exists |
| 8 | חזרה מסכמת | 58 | — | exists |
| 8 | הערכה מסכמת | 59 | — | exists |
| 8 | אבחון סוף שנה | 60 | — | exists |
| 8 | אינטרפולציה ואקסטרפולציה | 61 | — | exists |
| 8 | זוויות בין ישרים מקבילים | 62 | /parallel-lines-angles-grade-8 | exists |
| 8 | מעגל ועיגול — היקף ושטח | 63 | /circle-area-circumference-grade-8 | exists |
| 8 | משימת הערכה 1 | 64 | — | exists |

## כיתה ט׳ (grade 9)

| כיתה | נושא | מזהה נושא | דף נושא | אנימציה |
|---|---|---|---|---|
| 9 | חוק הפילוג המורחב | 1 | /distributive-law-grade-9 | exists |
| 9 | דו איבר בריבוע | 44 | /binomial-square-grade-9 | exists |
| 9 | הפרש ריבועים | 45 | /difference-of-squares-grade-9 | exists |
| 9 | פירוק לגורמים | 2 | /factoring-grade-9 | exists |
| 9 | פירוק לגורמים 1 — הוצאת גורם משותף | 41 | — | exists |
| 9 | פירוק לגורמים 2 — נוסחאות הכפל המקוצר וטרינום | 42 | — | exists |
| 9 | פירוק לגורמים 3 — פירוק מלא, משוואות ושברים אלגבריים | 43 | — | exists |
| 9 | צמצום שברים אלגבריים | 3 | /algebraic-fractions-grade-9 | exists |
| 9 | משולש שווה שוקיים | 4 | /isosceles-triangle-grade-9 | exists |
| 9 | הפונקציה הריבועית | 5 | /quadratic-function-grade-9 | exists |
| 9 | משוואות ריבועיות ונוסחת השורשים | 6 | /quadratic-equations-grade-9 | exists |
| 9 | דלתון | 46 | /kite-grade-9 | exists |
| 9 | המקבילית | 7 | /parallelogram-grade-9 | exists |
| 9 | אי־שוויונות ריבועיים ומערכות משוואות | 8 | /quadratic-inequalities-systems-grade-9 | exists |
| 9 | סטטיסטיקה | 9 | /statistics-grade-9 | exists |
| 9 | הסתברות | 10 | /probability-grade-9 | exists |
| 9 | המלבן | 11 | /rectangle-grade-9 | exists |
| 9 | קדם אנליזה — מפונקציות לגרפים ובחזרה | 12 | /precalculus-functions-graphs-grade-9 | exists |
| 9 | המעוין | 13 | /rhombus-grade-9 | exists |
| 9 | הריבוע | 14 | /square-grade-9 | exists |
| 9 | הטרפז | 39 | /trapezoid-grade-9 | exists |
| 9 | גיאומטריה אנליטית | 15 | /analytic-geometry-grade-9 | exists |
| 9 | חוקי חזקות | 16 | /exponent-rules-grade-9 | exists |
| 9 | שורשים | 17 | /square-roots-grade-9 | exists |
| 9 | בעיות מילוליות | 18 | /word-problems-grade-9 | exists |
| 9 | דמיון משולשים — משפט ז.ז וחישובים | 40 | /triangle-similarity-aa-grade-9 | exists |
| 9 | דמיון משולשים | 19 | /similar-triangles-grade-9 | exists |
| 9 | מעבר לחטיבה העליונה | 20 | /transition-to-high-school-grade-9 | exists |
| 9 | משולש שווה־צלעות — העמקה ורשות — לכיתה ט׳ | 22 | — | exists |
| 9 | מצולעים חופפים וטרנספורמציות — לכיתה ט׳ | 23 | /congruent-polygons-transformations-grade-9 | exists |
| 9 | פיתגורס חלק 1 — היכרות וחישוב — לכיתה ט׳ | 24 | /pythagoras-basics-grade-9 | exists |
| 9 | פיתגורס חלק 2 — שימושים — לכיתה ט׳ | 25 | /pythagoras-applications-grade-9 | exists |
| 9 | שטח מלבן וריבוע — העמקה — לכיתה ט׳ | 26 | /rectangle-square-area-grade-9 | exists |
| 9 | שטח משולש — העמקה — לכיתה ט׳ | 27 | /triangle-area-grade-9 | exists |
| 9 | שטחים ב׳ חלק 1 — מקבילית וטרפז — לכיתה ט׳ | 28 | /parallelogram-trapezoid-area-grade-9 | exists |
| 9 | שטחים ב׳ חלק 2 — מצולעים מורכבים — לכיתה ט׳ | 29 | /composite-polygons-area-grade-9 | exists |
| 9 | מנסרה משולשת חלק 1 — מבנה ונפח — לכיתה ט׳ | 30 | /triangular-prism-volume-grade-9 | exists |
| 9 | מנסרה משולשת חלק 2 — שטח פנים — לכיתה ט׳ | 31 | /triangular-prism-surface-area-grade-9 | exists |
| 9 | הרחבת מערכת הצירים חלק 2 — יישום והעמקה — לכיתה ט׳ | 32 | /coordinate-plane-applications-grade-9 | exists |
| 9 | גיאומטריה חישובית — משולש | 33 | /triangle-calculations-grade-9 | exists |
| 9 | פונקציה קווית | 34 | /linear-function-grade-9 | exists |
| 9 | משפט פיתגורס | 35 | /pythagorean-theorem-grade-9 | exists |
| 9 | קריאת גרפים | 36 | /reading-graphs-grade-9 | exists |
| 9 | משולש ישר זווית 30-60-90 | 37 | /triangle-30-60-90-grade-9 | exists |
| 9 | יחסי צלעות וזוויות | 38 | /triangle-sides-angles-grade-9 | exists |
