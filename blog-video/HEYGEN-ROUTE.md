# מסלול הפקה ב־HeyGen

**מצב: לא הופק דבר. אין אישור להפקת הסדרה או לפרסום. נדרש קודם אישור של סרטון לדוגמה.**

## מה זמין מהסביבה הזו

| בדיקה | תוצאה |
|---|---|
| `docs.heygen.com`, `developers.heygen.com`, `api.heygen.com` | חסומים ב־egress proxy של הסביבה (WebFetch: `EGRESS_BLOCKED`; curl: אין חיבור) |
| מחבר HeyGen API בסשן | אין |
| מחבר "HyperFrames by HeyGen" | קיים, אבל זה מוצר אחר (קומפוזיציות HTML), וכלי ה־compose/render בו חסומים ללקוחות CLI. הוא אינו הכפיל או הקול של נועם, ולא נעשה בו שימוש |
| מזהי האווטאר והקול של נועם | לא ידועים. לא נבחר שום תחליף |

## מה ידוע על ה־API, ומאיפה

**1. תיעוד רשמי, כפי שהמשתמש מסר מתוך https://developers.heygen.com/docs/video-agent (3.10.2026).** לא נקרא כאן ישירות.
- `POST https://api.heygen.com/v3/video-agents` עם הכותרת `X-Api-Key`.
- גוף הבקשה: `prompt`, `mode` (`generate` או `chat`), `avatar_id` (של ה־look המדויק), `voice_id`, `orientation: "portrait"`.
- `brand_glossary_id`: להגייה ולכתיב המקורי בכתוביות.
- התשובה: `session_id`. `GET /v3/video-agents/{session_id}` מחזיר `video_id`, ו־`GET /v3/videos/{video_id}` מחזיר `status`, `video_url`, `captioned_video_url` ו־`subtitle_url`.
- היצירה אסינכרונית.

**2. תקצירי חיפוש, לא אומתו.** WebSearch החזיר תקצירים מ־docs.heygen.com:
- `POST /v2/video/generate`, עם `video_inputs` → `character` (`type: "avatar"`, `avatar_id`) ו־`voice` (`type: "text"`, `input_text`, `voice_id`), ועם `dimension`.
- `GET /v2/avatars` לרשימת האווטארים, ורשימת קולות ב־`voice.list`.
- תקציר אחד הזכיר גם API של `v3/videos` עם script, ואת המעבר של התיעוד ל־developers.heygen.com.

**הבדלי גרסאות שמשפיעים על ההחלטה:**
- ב־v2 (לפי התקצירים) הטקסט נשלח כ־`input_text`, והכפיל אומר אותו כלשונו. ב־Video Agent של v3 הטקסט נשלח בתוך `prompt` לסוכן. לא ידוע אם הסוכן אומר אותו מילה במילה או מנסח מחדש, ואם הוא מוסיף טקסט למסך.
- אם הסוכן מנסח מחדש, הוא עוקף את כל הסקירה. לכן נוסף `compare-subtitles`: הוא משווה את `subtitle_url` של הסרטון לתסריט שנבדק.
- לא נקבע פרמטר משך. משך הסרטון נמדד מהסרטון שהופק, ולא מבוקש.
- ייתכן שב־v3 יש endpoint ישיר של "תסריט → סרטון אווטאר", בדומה ל־v2. זו שאלה פתוחה לבדיקה בתיעוד, ואין כאן הנחה כזו.

`heygen.contract.video-agent.draft.json` מכיל את הערכים שנמסרו, עם `verifiedFromDocs: false` ורשימת שאלות פתוחות. ערכי הסטטוס (done/failed) ריקים בכוונה, כדי שהכלי לא יסמן סרטון כמוכן על סמך ניחוש.

## צעדים, לפי הסדר (כל אחד דורש את נועם או את החשבון שלו)

1. **אווטאר וקול:** לאתר בחשבון HeyGen של נועם את ה־avatar look ואת הקול שלו. לרשום ב־`manifest.json` → `heygen.avatarId` ו־`voiceId`, ולסמן `avatarOwnerConfirmed` ו־`voiceOwnerConfirmed` רק אחרי שנועם אישר שאלה שלו.
2. **מכסה ועלות:** לבדוק בחשבון כמה קרדיטים יש וכמה עולה דקת סרטון, ולסמן `heygen.quotaChecked: true`. לא לרכוש, לא להפעיל auto-recharge, ולא ליצור שכפול קול או פנים חדש.
3. **האזנה:** להשמיע בקול של נועם את מילות ה־glossary בסטטוס `needs-listening-priority` (רשימה מלאה ב־`LISTENING-CHECKLIST.md`). להשמיע כל מילה פעם עם ניקוד ופעם בלעדיו, אם יש תצוגה מקדימה שאינה גובה קרדיטים. לפי התוצאה לבחור `heygen.narrationText`: `niqqud` או `unpointed`. אם יש `brand_glossary_id`, לרשום אותו ב־`heygen.brandGlossaryId`.
4. **חוזה:** לאמת את `heygen.contract.video-agent.draft.json` מול התיעוד, לענות על השאלות הפתוחות, ולשמור כ־`heygen.contract.json` עם `verifiedFromDocs: true`.
5. **סרטון לדוגמה:** נועם בוחר סרטון אחד בגרסה אחת, ורושמים אותו ב־`manifest.json` → `pilot.videos`. שתי גרסאות האורך הן טיוטות להשוואה בלבד, ואין בהן אישור להפיק את שתיהן.
6. **אישור תוכן:** אחרי שנועם קרא את `script-source.md` ו־`storyboard.md`, משנים את `contentStatus` של הסרטון ל־`noam-approved`.
7. **הפקה:** מריצים `node blog-video/bin/produce.mjs plan --id <id>`. אם אין חסימות, מריצים `HEYGEN_API_KEY=… node blog-video/bin/produce.mjs generate --id <id> --confirm`, ואחר כך `status --id <id>` עד שהסרטון מוכן.
8. **בדיקה:** מורידים את קובץ הכתוביות (`subtitle_url`) ומריצים `compare-subtitles --id <id> --file <קובץ>`. צופים בסרטון: הגייה, נוסחאות על המסך, כיוון החצים, קישור. אם נועם מאשר, מסמנים `pilot.sampleVideoApproved: true` ואת `format.decision` (`short` או `long`).
9. **סדרה:** רק אחרי סעיף 8, ובפורמט שנבחר.
10. **פרסום:** ידני בלבד. אחרי שפוסט עלה ונבדק, מריצים `record-publish --id <id> --network <רשת> --url <קישור לפוסט החי> --confirmed-by <שם>`.

## בלי API: הפקה ידנית בממשק של HeyGen

לכל סרטון:
- **מה הכפיל אומר:** `narration.he.niqqud.txt`, או הגרסה בלי ניקוד, לפי בדיקת ההאזנה.
- **מה מופיע על המסך:** `screen-text.md`. נוסחאות מוצגות כאובייקט LTR נפרד, ולא בתוך שורת טקסט בעברית.
- **בימוי:** `storyboard.md`.
- **כתוביות:** `captions.he.txt`. את הזמנים צריך לסנכרן מול הסרטון עצמו; הזמנים ב־`captions.segments.json` הם הערכה בלבד.
- **פרסום:** `social.md`.

## אורך לפי רשת

המקורות הם משניים בלבד; צריך לאמת בחשבונות של נועם לפני שבוחרים פורמט.
- **YouTube Shorts:** עד 3 דקות.
- **Instagram Reels:** עד 3 דקות לפחות.
- **Facebook Reels:** המקורות סותרים. חלקם מציינים 90 שניות, חלקם 2 דקות, וחלקם אומרים שאין מגבלה.

ההשלכה: הגרסה הארוכה (90–120 שניות) עשויה לחרוג ממגבלת ה־Reel ב־Facebook.
