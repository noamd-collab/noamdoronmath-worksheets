# Lighthouse — 10 דפים מייצגים

נמדד ב-2.10.2026 מול `https://www.noamdoronmath.co.il` (האתר החי, כבר חזית Astro).  
Lighthouse mobile, קטגוריות performance / seo / accessibility.  
זו מדידת **לפני** השינויים בענף הזה. השינויים לא הועלו ל-preview, ולכן אין מדידת אחרי.

| דף | Performance | SEO | Accessibility | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `/` | 97 | 100 | 96 | 2.4s | 0 | 0ms |
| `/grade-1` | 99 | 100 | 100 | 2.1s | 0 | 0ms |
| `/grade-7` | 99 | 100 | 100 | 2.1s | 0 | 0ms |
| `/triangle-area-grade-7` | 99 | 100 | 96 | 2.1s | 0 | 0ms |
| `/powers-grade-7` | 99 | 100 | 100 | 2.2s | 0 | 0ms |
| `/quadratic-function-grade-9` | 99 | 100 | 100 | 2.2s | 0.029 | 0ms |
| `/worksheets?grade=7` | 96 | 100 | 97 | 2.6s | 0 | 0ms |
| `/blog` | 72 | 100 | 100 | 9.0s | 0.111 | 0ms |
| `/post/annual-review-grade-7` | 100 | 100 | 92 | 1.7s | 0.03 | 0ms |
| `/aboutus` | 88 | 100 | 96 | 2.9s | 0.156 | 0ms |

אחרי העלאה ל-preview צריך למדוד שוב בעיקר את `/blog` (LCP ו-CLS) ואת `/aboutus` (CLS).

מה כן השתנה בקוד, בלי מספר אחרי:

- בלוק «בכיתה הבאה» בדפי נושא, בלי להחליף את «נושאים קשורים».
- פירורי לחם גלויים בדפי כיתה, וקישור «בלוג» בפירורים של פוסט.
- `width`/`height` לתמונת שער של פוסט רק כשה-JSON שומר מידות. בלי מידות לא הומצא גודל.
- גופנים ונוסחאות: כבר בקו הבסיס (`font-display: swap`, fallback עם `size-adjust`, ו-`unicode-bidi: isolate` למתמטיקה). לא שונו כאן.
