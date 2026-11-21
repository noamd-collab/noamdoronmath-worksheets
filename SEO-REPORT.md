# דוח SEO למעבר — Astro + Wix Managed Headless

תאריך: 2.10.2026  
בסיס: `headless/astro-poc-baseline`  
לא מוזג. לא נגענו בדומיין, ב-DNS או באתר החי מלבד קריאה.

סדר מיזוג מומלץ: #43 → #44 → #45 → #46 → #47 → #48 → #49.  
כל PR מאוחר כולל את הקומיטים של הקודמים עד שהם מתמזגים.

> **תיקון, 17.11.2026 (SEO-5).** ב-www את `/robots.txt` ואת `/sitemap.xml` מגיש Wix, לא האתר שלנו. ה-`robots.txt` החי מפנה רק אל `/sitemap.xml` של Wix, ושם אין פוסטים של הבלוג וכמעט אין משחקים. מפת האתר המלאה היא `https://www.noamdoronmath.co.il/sitemap-index.xml`. אותה מגישים ב-Google Search Console וב-Bing Webmaster Tools, לא את `/sitemap.xml`. נועם מוסיף ב-Wix (SEO > Robots.txt Editor) את השורה `Sitemap: https://www.noamdoronmath.co.il/sitemap-index.xml` ומשאיר את שורות Wix. הבדיקה: `npm run check:live-robots` ב-`headless/astro-poc`. היא רצה גם בסוף `tools/release/release.sh`, לדיווח בלבד, ולא עוצרת release.

## שלבים

### שלב 1 — בסיס טכני
- סטטוס: מוכן לסקירה
- PR: https://github.com/noamd-collab/noamdoronmath-worksheets/pull/43
- נעשה: title אחד, description אחד, canonical אחד אל `https://www.noamdoronmath.co.il`. `lang="he"` ו-`dir="rtl"`. `/sitemap.xml` הוא אינדקס אל `/sitemap-pages.xml` ו-`/sitemap-blog.xml`. `robots.txt` דינמי עם קישור ל-sitemap. (ב-www, Wix מגיש את `/sitemap.xml` ואת `robots.txt` לפני הנתיבים האלה. ראו את התיקון למעלה.) Open Graph ו-Twitter ב-layout. עמוד 404 מחזיר סטטוס 404. מתג `SITE_INDEXABLE`: preview תמיד `noindex`. בלי הדגל, רק `www` ו-apex הם `index,follow`.
- פתוח: Wix עדיין מזריק תגיות `[wix-seo-tag="true"]`. הסקריפט ב-layout מוחק אותן אחרי הטעינה. ב-view-source הן עדיין נראות. `SITE_INDEXABLE` לא הוגדר ב-`wix env` (אין הרשאה).

### שלב 2 — מפת הפניות
- סטטוס: מוכן לסקירה
- PR: https://github.com/noamd-collab/noamdoronmath-worksheets/pull/44
- נעשה: `redirects-map.csv` עם העמודות כתובת ישנה, כתובת חדשה, סטטוס, ביטחון בהתאמה. 30 הפניות 301 בביטחון גבוה, כולל `/privacy` → `/accessibilityadaptation#privacy-policy`. שטח המשולש כבר מפנה ל-`/triangle-area-grade-7` בקו הבסיס (לא ל-`/powers-grade-7`). `/workflow` מסומן 404 מכוון ולא הופנה. אין שורות לא ודאיות.
- פתוח: אישור נועם להפניית `/privacy`. PR #7 היה מול ענף אחר; התיקון של המשולש כבר בקו הבסיס ולא שוכפל.

### שלב 3 — JSON-LD
- סטטוס: מוכן לסקירה
- PR: https://github.com/noamd-collab/noamdoronmath-worksheets/pull/45
- נעשה: BreadcrumbList בכל דף דרך ה-layout. LearningResource לדפי נושא ולדפי עבודה, `inLanguage: he` ורמת כיתה. לפוסטים נשאר BlogPosting (תת-סוג של Article). בבית נוסף Organization ליד WebSite ו-EducationalOrganization שכבר היו. לא נוצרו FAQ או ביקורות חדשות.
- פתוח: רק `/pythagorean-theorem-grade-7` חסר LearningResource ב-JSON השמור, והדף משלים אותו בקומפוננטה. לא אומת מול כלי העשירה של גוגל על HTML חי.

### שלב 4 — הצעות מטא-דאטה
- סטטוס: מוכן לסקירה
- PR: https://github.com/noamd-collab/noamdoronmath-worksheets/pull/46
- נעשה: `headless/astro-poc/src/data/seo-proposals.json` ו-`headless/astro-poc/seo-review.csv`. 328 נושאי קטלוג, ועוד 2 דפי נושא שחולקים מזהה קטלוג, ועוד 60 פוסטים. כולם `approved: false`. ה-layout קורא הצעה רק אם `approved: true`.
- פתוח: אף שורה לא אושרה. הצעות לנושאי קטלוג בלי דף ייעודי נשענות על כותרת הקטלוג בלבד (`source: catalog-title`).

### שלב 5 — קישורים פנימיים וביצועים
- סטטוס: מוכן לסקירה
- PR: https://github.com/noamd-collab/noamdoronmath-worksheets/pull/47
- נעשה: בלוק «בכיתה הבאה» בלי להחליף «נושאים קשורים». פירורי לחם גלויים בדפי כיתה. קישור «בלוג» בפירורי פוסט. מידות לתמונת שער רק כשהן שמורות ב-JSON. מדידת Lighthouse לפני ב-`headless/astro-poc/internal/SEO-LIGHTHOUSE.md`.
- פתוח: אין מדידת אחרי. היעדים: `/blog` (LCP 9.0s, CLS 0.111) ו-`/aboutus` (CLS 0.156). גופנים ובידוד RTL של נוסחאות כבר היו בקו הבסיס ולא שונו.

### שלב 6 — בדיקות ו-GEO
- סטטוס: מוכן לסקירה
- PR: https://github.com/noamd-collab/noamdoronmath-worksheets/pull/48
- נעשה: `tests/seo-audit.test.ts` ו-workflow `.github/workflows/seo-audit.yml`. `/llms.txt` בעברית עם כיתות, נושאים ובלוג. `robots.txt` מפנה אליו.
- פתוח: `wix build` לא הורץ (אין הרשאות Wix בריפו). הבדיקה רצה על הנתונים וה-layout, לא על HTML מרונדר של כל דף.

### שלב 7 — העברה
- סטטוס: הדוח הזה והתגובות על ה-PR-ים
- PR: https://github.com/noamd-collab/noamdoronmath-worksheets/pull/49
- לא מוזג. ההטמעה נשארת ל-Cursor אחרי אישור נועם.

## התנגשויות שתועדו

- PR #28 (`cursor/pr27-release-hotfix-179e`) כבר נוגע בהסרת תגיות SEO של Wix. העבודה כאן נבנתה על `headless/astro-poc-baseline`, לא על הענף של #28.
- PR #7 היה מול `claude/open15-redirects-middleware`. הפניית שטח המשולש כבר נכונה בקו הבסיס.
- עבודה קודמת אסרה `src/pages/sitemap.xml.ts`. המשימה הזו דורשת `/sitemap.xml`. הבלוג נשאר `/sitemap-blog.xml` ולא סיומת `-sitemap.xml` ש-Wix שומר.
- ב-2.10.2026 האתר החי כבר מגיש את חזית ה-Astro. ה-sitemap החי של Wix (`pages-sitemap.xml`) לא מייצג את האתר הקלאסי הישן.

## החלטות שממתינות לאישור נועם

1. לאשר שורות ב-`seo-proposals.json` / `seo-review.csv`. עד אז הן לא מוצגות.
2. להגדיר `SITE_INDEXABLE=true` רק בייצור (`wix env`), ולהשאיר preview בלי הדגל או עם `false`.
3. לאשר את ההפניה `/privacy` → `/accessibilityadaptation#privacy-policy`.
4. להשאיר את `/workflow` בלי הפניה (404 מכוון).
5. הפניית `/triangle-area-grade-7-worksheets` כבר ל-`/triangle-area-grade-7`. לא לשנות.
6. אחרי החיבור: להגיש ב-Google Search Console וב-Bing Webmaster Tools את `https://www.noamdoronmath.co.il/sitemap-index.xml`. לא את `/sitemap.xml`: הוא של Wix ואין בו את הבלוג.
7. למדוד שוב Lighthouse ל-`/blog` ול-`/aboutus` אחרי העלאה ל-preview.
8. שני דפי נושא חולקים מזהה קטלוג עם דף אחר: `adjacent-vertical-angles-grade-7` ו-`coordinate-plane-four-quadrants-grade-7`.
9. 328 הוא מספר נושאי הקטלוג. דפי נושא ייעודיים: 95. השאר מקבלים הצעת מטא בלי URL ייעודי.
10. Organization נוסף בבית לצד EducationalOrganization שכבר קיים. אם זה כפול מדי, אפשר להוריד את Organization.
11. התווית `ready-for-cursor-review` נוספה ל-PR-ים #43–#49. היא לא הייתה קיימת לפני כן.

## בדיקות אחרי חיבור הדומיין

- `robots.txt` על www הוא הקובץ של Wix. הוא צריך לכלול `Sitemap: https://www.noamdoronmath.co.il/sitemap-index.xml`. בודקים עם `npm run check:live-robots`. על preview: `Disallow: /`.
- `sitemap-index.xml` מחזיר אינדקס, והילדים (`sitemap-pages.xml`, `sitemap-blog.xml`) כוללים כיתות, נושאים, דפי עבודה ובלוג. אין כתובות preview.
- `lastmod` של דף נושא הוא תאריך שורת «עודכן» שלו, כמו `dateModified` ב-JSON-LD. דף בלי תאריך כזה יוצא בלי `lastmod`. אף פעם לא תאריך הבנייה.
- 301 בפועל: `/triangle-area-grade-7-worksheets` → `/triangle-area-grade-7`, ו-`/privacy` → עמוד הנגישות עם העוגן.
- Search Console: להגיש את `sitemap-index.xml`, ולבדוק שה-canonical לא מצביע ל-preview.
- view-source מול DOM: לוודא שנשאר title אחד אחרי הסרת תגיות Wix.
