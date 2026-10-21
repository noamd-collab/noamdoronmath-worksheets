# דוח אינטגרציה — SEO 43–49 ותיקוני Claude 52–59

תאריך: 21.10.2026  
ענף אינטגרציה: `cursor/seo-claude-cutover-integration-9e0a`  
בסיס: `headless/astro-poc-baseline` ב-`9eb9e25eec79be067f9e51e9aec93b35a149e235`  
קומיט תיקוני האינטגרציה (לפני קומיט הדוח הזה): `e790102ccca22fbb529f6610bd842653e05e05da`  
לא מוזג לבסיס ולא ל-`main`. ענפי המקור לא שונו. לא בוצעו release, פריסה לייצור, שינוי DNS, סודות או הגדרות ייצור.

## 1. מקור, SHA וסטטוס לכל אחד מ-15 ה-PRs

| PR | כותרת | ענף מקור | SHA שנבדק | סטטוס | סיבה ואופן שילוב |
| --- | --- | --- | --- | --- | --- |
| [#43](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/43) | SEO שלב 1: בסיס טכני | `cursor/seo-stage-1-technical-9e0a` | `ba2085ccf0996cec504626e6da5e96a029b9f226` | נכלל | נכלל במלואו דרך אילן היוחסין של #53 (אב ישיר בשרשרת שלבים 1–7). |
| [#44](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/44) | SEO שלב 2: מפת הפניות 301 | `cursor/seo-stage-2-redirects-9e0a` | `26be50db6565c508ca4aa5353bcf2e1720190937` | נכלל | נכלל במלואו דרך אילן היוחסין של #53. |
| [#45](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/45) | SEO שלב 3: נתונים מובנים JSON-LD | `cursor/seo-stage-3-jsonld-9e0a` | `fa1a9e9532eef19db313b1eb4e85409e95af3590` | נכלל | נכלל במלואו דרך אילן היוחסין של #53. |
| [#46](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/46) | SEO שלב 4: הצעות מטא-דאטה בעברית | `cursor/seo-stage-4-proposals-9e0a` | `5953f5f106caa139e3b109dab8103a82c80b08c9` | נכלל | נכלל במלואו דרך אילן היוחסין של #53 ושל #52. |
| [#47](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/47) | SEO שלב 5: קישורים פנימיים ומדידת Lighthouse | `cursor/seo-stage-5-links-perf-9e0a` | `b944f5ff40ee9ab17a6cedfd277ec64c3d8d08e7` | נכלל | נכלל במלואו דרך אילן היוחסין של #53. |
| [#48](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/48) | SEO שלב 6: בדיקות אוטומטיות ו-llms.txt | `cursor/seo-stage-6-tests-llms-9e0a` | `6f3ae99eff6e377b9598e61be249d9c62eef2a36` | נכלל | נכלל במלואו דרך אילן היוחסין של #53. |
| [#49](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/49) | SEO שלב 7: דוח העברה לסקירה | `cursor/seo-stage-7-handoff-9e0a` | `12562973d85692705bae35168c1b9d10d3d827c2` | נכלל | נכלל במלואו דרך אילן היוחסין של #53 (`cf05f8d5`, `12562973`). |
| [#52](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/52) | fix(seo): apply PR 46 content review to the SEO proposals | `claude/seo-stage-4-review-fixes` | `7c628b89b58749ff303206d1f760c3e298a383d5` | נכלל | מוזג ישירות (`f6fa0f90`). שני הקומיטים החדשים (`39ce59e6`, `7c628b89`) מעל שלב 4 נכנסו פעם אחת. |
| [#53](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/53) | fix(seo): canonical params, Workers-safe env read, protected head hash | `claude/cutover-seo-fixes` | `5946e362700637d6a82688acd3fdfbd681dedc93` | נכלל | מוזג ישירות (`5fd8f275`), ומכניס איתו את כל שרשרת #43–#49 ואת `3f45c004`, `5946e362`. |
| [#54](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/54) | fix(content): math notation, Hebrew and catalog spelling | `claude/cutover-content-fixes` | `3f8444132280f09e079e8e48c16164eb987f6ff2` | נכלל | כבר נמצא ב-ancestry של הבסיס `9eb9e25e` (מוזג דרך PR #62). לא מוזג בשנית. |
| [#55](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/55) | fix(site): RTL math isolation, grade 9 pinned track, image sizes, a11y | `claude/cutover-site-fixes` | `429d77f137f13551c3927235149b35d09ccd4724` | נכלל | כבר נמצא ב-ancestry של הבסיס `9eb9e25e` (מוזג לתוך #58 ודרך PR #61). |
| [#56](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/56) | chore(astro-poc): runnable type checks, real fixes for type errors, stale tests | `claude/tech-debt-types-tests` | `0ec134c858d70c3368745148f02e63fce3de5121` | נכלל | כבר נמצא ב-ancestry של הבסיס `9eb9e25e` (בסיס של #58 ודרך PR #61). |
| [#57](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/57) | fix(viewer): ship ramzi-avatar.js at the root; bring the 28 root tests up to date | `claude/tech-debt-root-tests` | `81126340d8316f545dbf65f0efd3449046e8d7a8` | נכלל | מוזג ישירות (`fcfdf3ea`). |
| [#58](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/58) | test(astro-poc): browser user journeys (grades 1–9, phone + desktop, RTL) | `claude/site-journey-tests` | `fb1605711b0724aa18cab3a99defe5f0ec8d1277` (כולל `c1d487ab`) | נכלל | כבר נמצא ב-ancestry של הבסיס `9eb9e25e` (דרך PR #61). |
| [#59](https://github.com/noamd-collab/noamdoronmath-worksheets/pull/59) | feat(tools): catalog/topic-page/PDF quality audit with regression tests and CI | `claude/catalog-qa-audit` | `a5d71094a311460137629250d46b94551eea6377` | נכלל | מוזג ישירות (`33e4c29e`). |

כל 15 ה-PRs אומתו עם `git merge-base --is-ancestor <branch> HEAD` ונמצאים ב-ancestry של ענף האינטגרציה. אף PR לא נדחה ולא נחסם.

## 2. סדר שילוב בפועל ופתרון התנגשויות

1. **בסיס (`9eb9e25eec79be067f9e51e9aec93b35a149e235`)**: `origin/headless/astro-poc-baseline` העדכני, שכבר מכיל ב-ancestry את #54 (`3f844413`), #55 (`429d77f1`), #56 (`0ec134c8`) ו-#58 (`c1d487ab` + `fb160571`).
2. **מיזוג #53 (`origin/claude/cutover-seo-fixes` ב-`5946e362`, קומיט מיזוג `5fd8f275`)**: מכניס בפעם אחת את כל שרשרת שלבי ה-SEO #43–#49 יחד עם תיקוני #53.
   - **התנגשות 1 (`headless/astro-poc/src/pages/worksheets.astro`)**: אוחדו שני ה-imports ושתי היכולות — `parseWorksheetsUrlState, trackForPinnedTopic` מ-#55 ו-`educationalLevelForGrade, learningResourceJsonLd` מ-#45/#53, יחד עם סטטוס 404 לכיתה לא חוקית, `crumbs`, `seoPath` ו-`LearningResource` JSON-LD.
   - **התנגשות 2 (`headless/astro-poc/tests/blog-seo.test.ts`)**: נשמרה ספירת 68 הפוסטים + 4 הארכיונים (72 סה"כ) מהבסיס יחד עם בדיקת `buildBlogSeoComplement` מ-#43/#53.
3. **מיזוג #52 (`origin/claude/seo-stage-4-review-fixes` ב-`7c628b89`, קומיט מיזוג `f6fa0f90`)**: התמזג נקי (אורתוגונלית מעל שלב 4 שכבר נכנס ב-#53).
4. **מיזוג #57 (`origin/claude/tech-debt-root-tests` ב-`81126340`, קומיט מיזוג `fcfdf3ea`)**: התמזג נקי.
5. **מיזוג #59 (`origin/claude/catalog-qa-audit` ב-`a5d71094`, קומיט מיזוג `33e4c29e`)**:
   - **התנגשות 3 (`.gitignore`)**: נשמרו שתי השורות — `tools/.env` מהבסיס ו-`catalog-audit-report/` מ-#59.
6. **התאמות אינטגרציה לבסיס העדכני (`e790102ccca22fbb529f6610bd842653e05e05da`)**:
   - **הצעות SEO (#46/#52 מול #90/#104/#105 בבסיס)**: בבסיס נוספו מאז סקירת ה-390 שורות דף נושא אחד (`/kite-grade-9`, G9-T46) ו-8 פוסטים חדשים (#90), ו-G9-T39 הוזז במקומו בקטלוג (#104). הגנרטור `scripts/lib/seo-copy.mjs` ו-`seo-overrides.mjs` הותאמו להפיק בדיוק את אצוות 390 השורות שנסקרו, כך שהרצת `node scripts/build-seo-proposals.mjs` מייצרת 0 diff מול `src/data/seo-proposals.json` ו-`seo-review.csv` (390 שורות, 0 מאושרות, 3 `needsDecision`).
   - **M33 (`SiteHeader.astro`) ו-M25 (`reports/m25-blog/pilot-manifest.txt`)**: הסימון `בס״ד` הוצב בפינה הימנית־עליונה הפיזית (`<span class="basad" data-basad lang="he">בס״ד</span>`, עם `padding-top: 28px` על `.exact-header`) תוך שמירה על כל קישורי הכותרת מהבסיס (תפריט תוספים, למורים, חיפוש במובייל). קובץ המניפסט של M25 צורף לגיט כדי שבדיקת `tests/blog-posts.test.ts` תעבור בקופה נקייה.
   - **בקרת הקטלוג (#59 מול #99 בבסיס)**: ב-`tools/catalog-audit.cjs` נוספה תמיכה ברמת `c2` (`מצוינות 2` שנוספה ב-#99), בהתאמה ל-`scripts/build-learning-catalog.cjs`.
   - **בדיקות שורש (#57) וגדרות hashes מול הבסיס**: עודכנו `tests/noam-middle-levels.test.cjs` (127 רמות בכיתה ט׳ אחרי הוספת דלתון ב-#104), `tests/noam-viewer-design-portable-paths.test.cjs` (16 תגיות script כולל `noam-site-companion.js` מ-#82 ורמת `c2` מ-#99, והתאמת עריכות הצפיין מ-#68/#78/#83/#106), ו-`tests/design-exact-protected.test.ts` (`TriangleAreaExplorer.astro` מ-#41, `public/learning.html` מ-#82, ו-`astro.config.mjs` עבור `wix({ robots: false })`).
   - **טיפוסי TypeScript (`tsc` ו-`typecheck:tests`)**: תוקנו שגיאות טיפוסים בקבצים שנוספו לבסיס אחרי #56 (`scripts/build-site-guide.ts`, `src/lib/angleSumFilm.ts`, `src/pages/games/kefel-mekutsar-2/preview.png.ts`, `ExactHeroControls.astro`, `DistancePointsLoop.astro`, `ParallelCointeriorLoop.astro`, ושבעה קובצי בדיקה חדשים ב-`tests/`).
   - **`robots.txt` ו-`sitemap` על Wix Managed Hosting**: הוגדר `wix({ robots: false })` ב-`astro.config.mjs` כדי ש-`src/pages/robots.txt.ts` לא יידרס על ידי `/robots.txt` המוזרק של Wix (ללא אזהרת התנגשות ב-build), ושורת `Sitemap:` ב-`robots.txt` מפנה אל `https://www.noamdoronmath.co.il/sitemap-index.xml` (מכיוון ש-`/sitemap.xml` שמור ב-Wix).

## 3. מה נשמר ללא שינוי משוער (ממתין לנועם)

- כל 390 הצעות ה-SEO ב-`headless/astro-poc/src/data/seo-proposals.json` וב-`seo-review.csv` נשארות `approved: false`.
- 3 שורות בכיתה א׳ (נושאים 4, 19, 23) מסומנות `needsDecision` ללא שינוי נוסח.
- מארחי preview ו-localhost נשארים `noindex,nofollow`, ו-`robots.txt` עליהם מחזיר `Disallow: /`.
- `SITE_INDEXABLE` לא הוגדר בייצור.
- הפניית `/privacy` → `/accessibilityadaptation#privacy-policy` נמצאת ב-`redirects.json` כפי שהגיעה מ-#44/#53 וממתינה לאישור נועם לפני עלייה לייצור.
- `/workflow` ו-`/dev-loops` מסומנים `404-מכוון` (ללא הפניה).
- `ConceptLoop.astro` לא שונה כלל.

## 4. בדיקות ותוצאות

| פקודה / בדיקה | תוצאה |
| --- | --- |
| יצירת הצעות SEO (`node scripts/build-seo-proposals.mjs` + `git diff`) | **עבר (0 diff)** — 390 שורות (330 נושאים/דפים, 60 פוסטים), `approved: 0`, `needsDecision: 3`, `tooLong: 0`. |
| בדיקות שורש (`node --test tests/*.cjs`) | **עבר: 407/407** (0 נכשלו). |
| בדיקות יחידה (`CHROME_PATH=/usr/local/bin/google-chrome npm run test:unit`) | **עבר: 593/595 עברו, 0 נכשלו, 2 דולגו** (`LOOPS_MAP_73_v2.csv` לא בקופה, ובדיקת preview.png כשלא רץ שרת). |
| `npx tsc -p tsconfig.json --noEmit` | **עבר: 0 שגיאות** (יציאה 0). |
| `npm run typecheck:tests` (`tsc -p tsconfig.tests.json`) | **עבר: 0 שגיאות** (יציאה 0). |
| `npx astro check` (עם placeholder env מקומי) | **7 שגיאות ב-`ConceptLoop.astro` המוגן בלבד**, 0 שגיאות בשאר 354 הקבצים. |
| `npm run check:catalog` | **עבר** (`4c5ccc34149a798f47c4f261744f132b36d7ff083dc4d0052c81a53219639fb6`). |
| `npm run check:content` | **עבר** (`ok: true`, CMS ב-`SNAPSHOT_ONLY`). |
| `npm run check:static` | **עבר** (454 manifests תואמים). |
| `npm run check:search-index` | **עבר** (490 מסמכים עדכניים). |
| `npm run check:site-guide` | **עבר** (`site-guide.v1.json` תואם). |
| בקרת איכות קטלוג #59 (`node tools/catalog-audit.cjs`) | **עבר (יציאה 0): 0 שגיאות**, 18 אזהרות (`SEARCH_TERMS_MISPLACED`), 14 לבדיקת אדם, 2 מידע. |
| בדיקות רגרסיה #59 (`node --test tests/catalog-audit.test.cjs`) | **עבר: 30/30**. |
| בניית Wix (`npm run build` עם placeholder env) | **עבר** (יציאה 0). |
| בניית Preview מקומית (`npx astro build --config astro.config.preview.mjs`) | **עבר** (יציאה 0). |
| מסעות משתמש בדפדפן #58 (`CHROME_PATH=/usr/local/bin/google-chrome npm run test:journeys`) | **עבר: 53/53** (46 מסעות #58 + 7 מסעות חיפוש, מובייל 360px ומחשב 1280px, RTL). |
| סריקת בנייה משולבת (190 נתיבי Astro SSR + 404 + 301 + sitemaps/robots/llms + דפדפן 360/1280) | **עבר**: כל 190 הנתיבים החזירו 200 עם `<title>` יחיד, `<meta name="description">` יחיד, canonical ל-`https://www.noamdoronmath.co.il/` ללא זליגת פרמטרי מעקב, `lang="he" dir="rtl"`, `BreadcrumbList`, `stripWixSeoDupes` ו-`data-basad`. `/404`, `/workflow`, `/worksheets?grade=12` החזירו 404. `/triangle-area-grade-7-worksheets` ו-`/privacy` החזירו 301. ב-360px וב-1280px אין גלילה אופקית, `Tab` ראשון מתמקד ב-`skip-link`, ו-`בס״ד` בימין־עליון (`18px` מהקצה הימני, מעל שורת הניווט). |

## 5. כשלים קיימים, חסמים ומה לא אומת

1. **`astro check` (7 שגיאות ב-`ConceptLoop.astro`)**: הקובץ מוגן ב-`tests/design-exact-protected.test.ts` ולכן לא נערך. השגיאות הן `ts(2339)` על `e.detail` ו-`ts(7006)` על פרמטרים ללא טיפוס בשורות 3047–3135.
2. **Wix Preview מרוחק חסום (`LoginRequired`)**: הרצת `npx wix whoami` נכשלת ב-`LoginRequired: You are not authenticated, log in by running wix login`, ואין `.env.local` עם הרשאות Wix בסביבת ה-Cloud. לכן:
   - לא נוצר URL של Wix preview מרוחק.
   - הזרקת תגי `[wix-seo-tag="true"]` של Wix נבדקה מול סקריפט הניקוי `stripWixSeoDupes` ומול הבנייה המקומית, אך לא על דומיין preview חי של Wix.
   - קובצי PDF ותמונות אמיתיים של Wix Media לא אומתו מול ה-CDN ב-preview מרוחק (במסעות הדפדפן #58 מוגש stub PDF מקומי של עמוד אחד לבדיקת בקשת הצפיין ורינדור `pdf.js`, וב-`catalog-audit.cjs` במצב offline כל 959 ה-PDFs מסומנים `unverified`).
3. **בדיקות `test:live-ssr` (מחוץ ל-`test:unit`)**: תלויות ברשת חיה מול `www.noamdoronmath.co.il` (האתר החי כבר מריץ Astro ולכן ארכיון הבלוג הישן של Wix ו-`blog-posts-sitemap.xml` אינם קיימים שם).
4. **18 אזהרות `SEARCH_TERMS_MISPLACED` ו-14 פריטים לבדיקת אדם ב-`catalog-audit`**: מתועדים בדוח הבקרה וממתינים להחלטת נועם (אינם שגיאות).

## 6. החלטות נועם הנדרשות לפני מיזוג סופי ועלייה לייצור

1. **אישור חבילת האינטגרציה**: אישור אנושי מפורש של נועם ל-PR האינטגרציה ול-HEAD SHA שלו.
2. **אישור הצעות ה-SEO (`seo-proposals.json` / `seo-review.csv`)**: בחירת השורות להעברה ל-`approved: true`, והכרעה ב-3 נושאי כיתה א׳ (4, 19, 23 — `needsDecision`). כמו כן הכרעה אם להוסיף סבב הצעות ל-8 הפוסטים ולדף הדלתון שנוספו בבסיס אחרי #46/#52.
3. **אינדוקס בייצור (`SITE_INDEXABLE=true`)**: הגדרת המשתנה ב-`wix env` בייצור בלבד בעת החיבור, והשארת preview על `noindex`.
4. **הפניית `/privacy`**: אישור או הסרה של ההפניה `/privacy` → `/accessibilityadaptation#privacy-policy` ב-`redirects.json`.
5. **`robots.txt` ו-`sitemap` ב-Wix Managed Hosting**: הוגדר `wix({ robots: false })` ב-`astro.config.mjs` ושורת `Sitemap:` ב-`robots.txt` מפנה ל-`https://www.noamdoronmath.co.il/sitemap-index.xml` (כי `/sitemap.xml` שמור ב-Wix). אין לערוך את SEO Tools > Robots.txt Editor בדשבורד ואין לכבות אינדוקס אתר בדשבורד Wix.
6. **18 אזהרות `SEARCH_TERMS_MISPLACED` בקטלוג ו-7 שגיאות הטיפוס ב-`ConceptLoop.astro`**: החלטה אם לטפל בהן בסבב נפרד.

## 7. תוכנית הטמעה ו-Rollback (רק אחרי אישור נועם)

### הטמעה
1. קבלת אישור מפורש מנועם שמציין את ה-PR וה-HEAD SHA.
2. מיזוג PR האינטגרציה אל `headless/astro-poc-baseline` (ולא מיזוג כפול של PRs #43–#49, #52, #53, #57, #59 בנפרד).
3. הרצת אימות ב-CI / סביבת Wix מחוברת: `npm ci`, `npm run test:unit`, `npm run typecheck:tests`, `node tools/catalog-audit.cjs`, ו-`wix preview`.
4. בדיקת preview חי של Wix, ורק לאחר אישור נפרד מנועם — `wix release` ובדיקות פוסט-חיבור (Search Console, `robots.txt`, `sitemap`, והפניות 301).

### Rollback
- **לפני מיזוג**: השארת ה-PR כטיוטה; ענף הבסיס `headless/astro-poc-baseline` (`9eb9e25e`) וענפי המקור לא שונו כלל.
- **אחרי מיזוג לבסיס**: `git revert -m 1 <merge-commit-sha>` על `headless/astro-poc-baseline` ודחיפה רגילה (ללא force-push).
