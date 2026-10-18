# שילוב PR 61 (חיפוש באתר) באינטגרציה

**מה נבדק:** מיזוג מקומי ניסיוני (לא נדחף) של `claude/site-search` מעל:
- ענף האינטגרציה `cursor/seo-cutover-integration-9e0a` (PR 60, ב־`bfbdf7d`)
- הבסיס העדכני `headless/astro-poc-baseline` (ב־`15bac60`)

`claude/site-search` נבדק ב־`2172f71`.

**תלות:** PR 61 בנוי על PR 58 (`claude/site-journey-tests`), ו־PR 58 כבר נמצא בתוך PR 60.

## קונפליקטים (3 קבצים, פתרון מכני)

הקונפליקטים נוצרים רק מול הבסיס העדכני, כי הוא הוסיף לכותרת תפריט "תוספים" עם משחק. בכל אחד מהם צריך לשמור את שני הצדדים:

| קובץ | פתרון |
|---|---|
| `src/lib/activeNav.ts` | לשמור את השורה של הבסיס (`/math-tools` ו־`/games/kefel-mekutsar-2` → `tools`), ולהוסיף אחריה `if (path === '/search') return 'search';` |
| `src/lib/siteSitemaps.ts` | לשמור את ההערה של הבסיס, ולהוסיף `'search'` ל־`SKIP_SLUGS` |
| `src/styles/exact-site.css` | לשמור את כל ה־CSS של תפריט התוספים. להוסיף `.exact-nav-search-mobile` לכלל ה־`display:none` הכללי, ולכלל ה־`display:block` בתוך `@media (max-width:767px)` |

`SiteHeader.astro` מתמזג אוטומטית. פריט "חיפוש באתר" במובייל נשאר במקומו.

## אחרי הפתרון: חובה

```bash
cd headless/astro-poc
npm run refresh:search-index   # 25 כרטיסים השתנו, כי PR 54 תיקן כותרות בקטלוג
npm run check:search-index
```

כל 21 ההחלטות ב־`search-terms-review.json` עדיין חלות. אף אחת מהן לא התיישנה.

## תוצאות על העץ הממוזג

| בדיקה | תוצאה |
|---|---|
| `npx tsx --test tests/site-search.test.ts` | 31/31 |
| מבחן ההשוואה (`npm run eval:search`) | זהה לדוח: פיתוח 63/63, אימות 62/62, תוצאה מטעה אחת, אפס תוצאות בכיתה שגויה |
| `npm run test:unit` (`CHROME_PATH` מוגדר) | 486 עברו, 0 נכשלו |
| `npm run typecheck:tests` | עבר |
| `npx astro check` | 8 שגיאות: 7 ב־`ConceptLoop.astro` המוגן, ואחת ב־`src/pages/games/kefel-mekutsar-2/preview.png.ts` שהגיעה מהבסיס. אף אחת לא מ־PR 61. |
| `npm run build` (wix, env placeholder) | עבר |
| build עם `astro.config.preview.mjs` | עבר |
| `npm run test:journeys` | 53/53: 46 קיימות ו־7 של החיפוש |

## בדיקה מחודשת, 18.10.2026: מול הבסיס העדכני

**הבסיס:** `headless/astro-poc-baseline` בגרסה `eebd4c0`. הוא כולל 42 commits מעבר ל־`15bac60`. PR 60 (`bfbdf7d`) לא מוזג.

**PR 60 מתנגש עכשיו עם הבסיס ב־14 קבצים**, בעיקר קובצי הקטלוג: `index.html`, ‏`catalog.v1.json`, ‏sha256 ו־snapshot. לכן נבדק המסלול הישיר:

**בסיס ← PR 58 (כולל 55/56) ← PR 61**

הכול מקומי בלבד, שום דבר לא נדחף.

### בסיס ← PR 58: 3 קונפליקטים (שייכים ל־PR 58, לא ל־61)

| קובץ | פתרון שנבדק |
|---|---|
| `src/lib/exactReferenceMotion.js` | לקחת את הגרסה של הבסיס (`ensureDoodleControl`), כי היא מחליפה את התיקון של PR 56 |
| `tests/design-exact-protected.test.ts` | ה־hash של הבסיס, כי הקבצים המוגנים בעץ הממוזג הם של הבסיס |
| `tests/design-exact-controls-notice.test.ts` | ה־hash של הבסיס. בנוסף, ה־regex של כפתור ההודעה צריך לקבל את התווית של PR 55: `aria-label="הבנתי – סגירת הודעת הפיתוח"` |

### ← PR 61: 5 קונפליקטים מכניים

| קובץ | פתרון |
|---|---|
| `SiteHeader.astro` | לשמור את "למורים" מהבסיס **וגם** את "חיפוש באתר" (מובייל) |
| `WorksheetsClient.tsx` | לשמור את `countRenderedTopicCards` מהבסיס. את ייבוא `lib/search` להחליף ב־`catalogFilter` + `url` |
| `activeNav.ts` | `'teachers' \| 'search'`. שורת `/math-tools` ו־`/games/…` מהבסיס, ומתחתיה `/search` |
| `siteSitemaps.ts` | ההערה מהבסיס, עם `'search'` ב־`SKIP_SLUGS` |
| `exact-site.css` | כל ה־CSS של תפריט התוספים מהבסיס, ועוד `.exact-nav-search-mobile` בשני הכללים |

### תיקון נדרש בעץ הממוזג

**`tests/landing-loops.test.ts`** (בדיקה חדשה בבסיס): להוסיף `'search.astro'` ל־`NON_LANDING_PAGES`. החיפוש אינו דף נחיתה.

אי אפשר להכניס את התיקון הזה ל־PR 61 עצמו, כי הקובץ קיים רק בבסיס.

### אינדקס החיפוש

`npm run refresh:search-index` משנה את האינדקס מ־480 ל־490 מסמכים:
- נוספו נושא אחד, דף נושא אחד ו־8 פוסטים.
- 303 מסמכים השתנו, בעיקר מזהי PDF חדשים בקטלוג.

21/21 ההחלטות על מילות החיפוש עדיין חלות.

### תוצאות (עם התיקונים שלמעלה)

| בדיקה | תוצאה |
|---|---|
| `tests/site-search.test.ts` | 31/31 |
| מבחן ההשוואה | ללא שינוי: פיתוח 63/63, אימות 62/62, תוצאה מטעה אחת, אפס בכיתה שגויה |
| `npm run test:unit` (`CHROME_PATH`) | 537 עברו, 5 נכשלו. ראו פירוט בהמשך |
| `npm run build` (wix) ו־preview build | עברו |
| `npm run test:journeys` | 51/53. כל 7 בדיקות החיפוש עוברות. ראו פירוט בהמשך |

**כשלי unit:**
- **4 קיימים בבסיס בדיוק כך:** M33 basad, ‏M26 ו־OPEN-07 (רשת חיה), M25 manifest, וגבולות מוגנים (TriangleAreaExplorer, ‏learning.html).
- **כשל חמישי, חדש בעץ הממוזג ולא שייך ל־61:** "runtime portability". הבדיקה מגיעה עם PR 58 (שרשרת 53/56), והיא תופסת את `src/lib/noamSecrets.ts` מהבסיס, שקורא `process.env` חשוף. זה סיכון אמיתי ב־Workers. התיקון שייך לבסיס: להשתמש ב־`runtimeProcessEnv`.
- **2 כשלים בבסיס נעלמו בעץ הממוזג:** nd-gate ו־M24.

**כשלי journeys:**
- **שתי בדיקות של PR 58 נכשלו** ("blog → post → related topic", במובייל ובדסקטופ).
- **הסיבה:** 8 פוסטים חדשים בראש הבלוג בלי קישור לדף נושא. הבדיקה סורקת רק את 6 הכרטיסים הראשונים.
- **אומת:** אחרי שינוי `cards.slice(0, 6)` ל־`cards`, הבדיקה עוברת 2/2.
- התיקון שייך ל־PR 58.
