# דוח אינטגרציה — SEO 43–49 ותיקוני Claude 52–59

תאריך: 3.10.2026  
ענף: `cursor/seo-cutover-integration-9e0a`  
בסיס: `headless/astro-poc-baseline` ב-`1be6a0da7bbc8e708eacff4f3d0cead2be195525`  
לא מוזג. ענפי המקור לא שונו. אין release, DNS, או פריסה לייצור.

הבסיס התקדם מאז שנפתחו שלבי ה-SEO: נכללים בו כבר מיזוג #41 (לופים) ומיזוג #50 (תוויות נגישות). הם לא חלק מ-15 ה-PR-ים, והם כבר ב-ancestry.

סוכן רץ אחר על המאגר: לא נמצא. סוכנים במצב המתנה (לופ משולש, סקירת הצעות, תוויות נגישות) לא נגעתי בענפים שלהם.

## סדר שילוב בפועל

כל קומיט נכנס פעם אחת, לפי ancestry ולא לפי מספר PR.

| סדר | מיזוג | מה נכנס | SHA קצה |
| --- | --- | --- | --- |
| 0 | בסיס | `headless/astro-poc-baseline` כולל #41 ו-#50 | `1be6a0da` |
| 1 | `claude/cutover-seo-fixes` | #53, ומתוכו #43–#49 כי הם אבות | `5946e362` |
| 2 | `claude/seo-stage-4-review-fixes` | רק שני קומיטי #52. שלבים 1–4 כבר היו | `7c628b89` |
| 3 | `claude/site-journey-tests` | #58, ומתוכו #55 ו-#56 (כולל merge commit `e204480`) | `c1d487ab` |
| 4 | `claude/cutover-content-fixes` | #54 | `3f844413` |
| 5 | `claude/tech-debt-root-tests` | #57 | `81126340` |
| 6 | `claude/catalog-qa-audit` | #59 | `a5d71094` |

התנגשות אחת: `headless/astro-poc/src/pages/worksheets.astro`.  
נשמרו שני ה-imports: `trackForPinnedTopic` מ-#55 ו-`learningResourceJsonLd` מ-#53. לא נבחר צד שלם.

`design-exact-protected.test.ts` התמזג בלי קונפליקט ידני: hash של ConceptLoop ו-TriangleAreaExplorer לפי #56 (אחרי #41/#50), hash של `catalog.v1.json` לפי #54, hash של `<head>` לפי #53. ConceptLoop ו-`astro.config.mjs` לא נערכו.

יצירת הצעות SEO אחרי #54: `node scripts/build-seo-proposals.mjs` סיים בלי שגיאה ובלי diff מול `seo-proposals.json` ו-`seo-review.csv`.

## 15 ה-PR-ים

| PR | סטטוס | סיבה |
| --- | --- | --- |
| #43 | נכלל | אב של #53 |
| #44 | נכלל | אב של #53 |
| #45 | נכלל | אב של #53 |
| #46 | נכלל | אב של #53 ושל #52 |
| #47 | נכלל | אב של #53 |
| #48 | נכלל | אב של #53 |
| #49 | נכלל | אב של #53 |
| #52 | נכלל | מיזוג ישיר. שני קומיטים חדשים בלבד |
| #53 | נכלל | מיזוג ישיר. כולל את #43–#49 |
| #54 | נכלל | מיזוג ישיר. meta של הדפים לא שונה; ההצעות נשארו המסלול היחיד |
| #55 | נכלל | אב של #58 |
| #56 | נכלל | אב של #58 |
| #57 | נכלל | מיזוג ישיר. לא נוגע ב-`headless/astro-poc` |
| #58 | נכלל | מיזוג ישיר. כולל את #55 ו-#56 |
| #59 | נכלל | מיזוג ישיר |

אף PR לא נדחה ולא נחסם. אף PR מקור לא נסגר ולא מוזג.

## מה נשמר בכוונה

- 390 הצעות, כולן `approved: false`. שלוש מסומנות `needsDecision`: כיתה א׳ נושאים 4, 19 ו-23 («מרכיבים ומפרקים» / «הרכבה ופירוק»).
- preview ו-localhost נשארים `noindex`. על השרת המקומי `robots.txt` הוא `Disallow: /`, וה-sitemap מצביע ל-www.
- `SITE_INDEXABLE` לא הוגדר. לא שונתה החלטת אינדוקס לייצור.
- הפניית `/privacy` → `/accessibilityadaptation#privacy-policy` **נמצאת בקוד** כי כך היא ב-#44, ו-#53 השאיר אותה להחלטת נועם. בשרת המקומי היא מחזירה 301. היא לא אושרה ולא הופעלה בייצור. אם נועם דוחה אותה, מוחקים את הכלל ב-`redirects.json` לפני מיזוג.
- `/workflow` נשאר 404, בלי הפניה.
- `/triangle-area-grade-7-worksheets` מפנה 301 אל `/triangle-area-grade-7`.

## בדיקות

התקנה: `npm ci` ב-`headless/astro-poc` לפי ה-lockfile. אזהרת מנוע: `undici` מבקש Node `>=22.19`, ובמכונה `22.14`. ההתקנה הסתיימה.

| בדיקה | תוצאה |
| --- | --- |
| יצירת הצעות SEO | 0 diff. 390 שורות, 0 מאושרות, 3 `needsDecision` |
| שורש `node --test tests/*.cjs` | 405/405 |
| `npm run test:unit` | 449 עברו, 2 נכשלו, 1 דולג. לא ירוק |
| `npm run typecheck:tests` | 0 |
| `npx tsc -p tsconfig.json --noEmit` אחרי `astro check` | 0 |
| `npm run typecheck` (`astro check`) עם `WIX_CLIENT_ID` מקומי בלבד | 7 שגיאות, כולן ב-`ConceptLoop.astro` המוגן |
| `npm run check:catalog` | עבר. hash `3a4f0d943333…` |
| `npm run check:content` | עבר. CMS הוא snapshot בלבד (`missingExternalInput=yes`) |
| `npm run check:static` | עבר. 449 manifests |
| `node tools/catalog-audit.cjs` | יציאה 0. 0 שגיאות, 18 אזהרות, 8 לבדיקה, 2 מידע |
| `npx astro build --config astro.config.preview.mjs` | עבר. adapter מקומי של Node, בלי Wix |
| `npm run test:journeys` | 46/46. כ-23 שניות |
| סריקת HTML מקומית | כיתות א׳–ט׳, נושאים, דפי עבודה, בלוג, 404: title אחד, description אחד, canonical ל-www, `he`/`rtl` |
| Tab בדף הבית, 360 ו-1280 | המוקד הראשון הוא «דילוג לתוכן». אין גלילה אופקית |

### כשלים שנשארו, לא הוסתרו

- `tests/basad-position.test.ts`: חסר `[data-basad]` או המחרוזת ב-`SiteHeader`. הכלל `.basad` עדיין `right`/`top`. זה כשל קיים (M33), לא תוקן כדי לא לנחש החלטת עיצוב.
- `tests/blog-posts.test.ts`: חסר `reports/m25-blog/pilot-manifest.txt` (M25). הקובץ לא חלק מהחבילה.
- `astro check`: 7 שגיאות סוג ב-`ConceptLoop.astro`. הקובץ מוגן ולא נערך.
- `tsc` בלי types של Astro נכשל על `astro:env/server` (`BLOG_AUDIO_FUNCTIONS_BASE`). אחרי `astro check` התוצאה 0. `astro sync` לבד נכשל כי אין `wix env pull`.
- בקרת הקטלוג: 18 אזהרות `SEARCH_TERMS_MISPLACED`. מצב PDF בכלי הוא `off`: 956 מזהים, 0 אומתו כקבצים אמיתיים.
- מסעות הדפדפן מחליפים PDF של Wix Media ב-stub של עמוד אחד. נבדק איזה קובץ הצופה ביקש, לא שהקובץ האמיתי קיים.
- בדיקות live-SSR מול www לא חלק מ-`test:unit`. הרצה ישירה של כל קבצי ה-`*.test.ts` נכשלת גם עליהן (ארכיון הבלוג החי לא החזיר 20 כרטיסים). זה תלוי רשת, לא שער היחידה.

## סריקת הבנייה המקומית

שרת: `node dist/server/entry.mjs` על `127.0.0.1:4337`. זו לא סביבת Wix.

- `/sitemap.xml` אינדקס אל `sitemap-pages.xml` (112) ו-`sitemap-blog.xml` (64). אין מארח preview.
- `/llms.txt` בעברית, 9 קישורי כיתה.
- `/worksheets?grade=12` ו-`grade=abc` מחזירים 404.
- `/worksheets?grade=9&topic=41` מחזיר 200.
- «בכיתה הבאה», `LearningResource`, `BreadcrumbList` וסקריפט `stripWixSeoDupes` נמצאים ב-HTML.
- תגי `wix-seo-tag` לא הופיעו, כי Wix לא מזריק ב-build המקומי. אי אפשר לאשר מכאן את ההסרה בדפדפן על preview של Wix.
- תמונות ו-PDF אמיתיים מ-Wix Media לא נטענו. המסעות חוסמים רשת חיצונית.

## Preview

חסום. `npx wix whoami` החזיר `LoginRequired` (`wix login`). אין `WIX_CLIENT_ID` אמיתי, ולא נפתח אתר או שירות חדש.  
הבדיקה החיה היא ה-build המקומי בלבד. אין URL preview ציבורי.

## החלטות נועם לפני עלייה לייצור

1. לאשר או לדחות את חבילת האינטגרציה הזו, לפי ה-SHA של ה-PR.
2. הפניית `/privacy`: להשאיר או למחוק לפני המיזוג.
3. `SITE_INDEXABLE=true` רק בייצור, אחרי החלטה. preview נשאר noindex.
4. לאשר שורות ב-`seo-proposals.json`. עד אז הן לא מוצגות. שלושת נושאי כיתה א׳ (4, 19, 23) דורשים הבחנה או איחוד.
5. אחרי חיבור: Search Console, robots על www, sitemap, ו-301 של שטח המשולש.
6. 18 אזהרות מילות חיפוש בקטלוג, ו-7 שגיאות הסוג ב-ConceptLoop, נשארות מחוץ לחבילה הזו.

## הטמעה ו-rollback

הטמעה, רק אחרי אישור אנושי שמזהה את ה-SHA:

1. למזג את PR האינטגרציה אל `headless/astro-poc-baseline`. לא למזג במקביל את #43–#49 ו-#52–#59. הם כבר בתוך הענף, ומיזוג כפול ייצור רעש.
2. לא לסגור את ה-PR-ים המקוריים לפני האישור.
3. לא לעשות release ולא לגעת ב-DNS מתוך המיזוג לבסיס. עלייה לייצור היא צעד נפרד.
4. אחרי המיזוג: `npm ci` ב-`headless/astro-poc`, `npm run test:unit`, `npm run typecheck:tests`, `node tools/catalog-audit.cjs`, ו-build בסביבת Wix המחוברת.

Rollback לפני מיזוג: לא למזג את ה-PR. הבסיס נשאר `1be6a0da`.  
Rollback אחרי מיזוג: `git revert` של קומיט המיזוג לבסיס, בלי force-push, ואז build מחדש. ענפי המקור נשארים זמינים.
