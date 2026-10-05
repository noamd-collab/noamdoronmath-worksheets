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
