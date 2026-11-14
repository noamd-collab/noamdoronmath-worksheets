# הגדרת חיבור האתר לעובד Render

זהו שלב **הגדרה בלבד** דרך `tools/release/release.sh`, במקור בקר הפרסום
`main`. הוא אינו בונה או מפרסם אתר, מעיר worker, יוצר job או מפעיל מודל.
אין לבצע אותו עד לאישור נועם לתוכנית המדויקת. הבדיקות משתמשות בתחליפים בלבד,
עם **0 כתיבות או בקשות ספק אמיתיות**.

## גבולות ואימות

הפקודה רשאית לשנות רק `WORKER_URL` ו־`WORKER_WAKE_SECRET`, בסביבת `prod` של
Wix app `e774b8bf-6d43-4041-ae2d-82b04ba6e9e3`, באתר
`df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46`.
המקור חייב להיות checkout נקי עם SHA מלא ומדויק שכבר נכלל בענף האתר המאושר,
במאגר `noamd-collab/noamdoronmath-worksheets`. אין fetch אוטומטי, מעבר ענף,
התקנה, כניסה חדשה או הרחבת הרשאות.

תוכנית Wix מכילה בדיוק: `version:1`, `target:"teacher-wix-wake-env"`,
`repository`, `sourceSha`, `siteId`, `appId`, `environment:"prod"`, `workerUrl`,
`wakeSecretSha256`, `renderPlanSha256`, `renderReceiptSha256` ו־`expectedPrevious`.
האחרון הוא מפה של שני שמות המשתנים בלבד: `null` אם הם אמורים להיעדר, או
SHA-256 של הערך הקודם שאושר להחלפה. URL מוגבל למקור HTTPS יחיד ב־onrender.com,
ללא path/query/credentials/port; המפתח חייב להיות 64 תווי hex קטנים.

תוכנית ו־receipt של Render חייבים להתאים לגיבובים שאושרו, לאותו source SHA,
אותו URL ול־receipt במצב `active`. קובץ ה־runtime הפרטי הקיים נבדק בזיכרון
מול `runtimeSha256` של אותו receipt, והמפתח חייב להיות זה שכבר הוגדר ב־Render.
מפתחות Qwen ושירות מסד הנתונים נקראים רק לצורך השוואת הגיבוב; הם אינם נשלחים
ל־Wix ואינם מופיעים בפלט. אין להציג secret חדש כאילו הוא מפתח שנבדק.

## שימוש עתידי לאחר ההרשאות והבדיקות

שמור את קובצי הקלט הפרטיים מחוץ לשני ה־checkouts, בבעלות המפעיל ובהרשאת
`0600`, ללא symlinks (השתמש בנתיב מוחלט canonical). קובץ קלט Wix מכיל רק את
שני השמות לעיל. תיקיית ledger נפרדת קיימת מראש בהרשאת `0700`; receipt שלה
נכתב ב־`0600` וננעל מפני הפעלה מקבילה. אין להעתיק ערכים לשורת פקודה, PR,
צילום, log או artifact.

```sh
RELEASE_TARGET=teacher-wix-wake-env bash tools/release/release.sh \
  --plan /absolute/private/wix-wake-plan.json \
  --repo /absolute/reviewed/site-checkout \
  --input-file /absolute/private/wix-wake-values.json \
  --render-plan /absolute/private/render-plan.json \
  --render-receipt /absolute/private/render-ledger/current.json \
  --render-runtime /absolute/private/render-runtime.json
```

ברירת המחדל היא dry-run, ללא כל בקשת ספק. אפשר להזרים JSON ב־stdin במקום
`--input-file`. הפעלה אמיתית דורשת בנוסף `--apply`,
`--ledger-dir /absolute/private/wix-wake-ledger` והביטוי המדויק
`--approval "NOAM APPROVED WIX WAKE ENV <planSha256>"` לאחר אישור נועם.
`planSha256` מחושב מ־JSON עם מפתחות ממוינים; hash של סוד הוא של המחרוזת
עצמה. גיבובי Render משתמשים בקנוניזציה התואמת ל־Python של guard Render.

לפני upsert נבדקים הערכים הקודמים, ונקראים מחדש המקור וקובצי הראיות.
אחרי upsert יחיד נבדקים שני הערכים בזיכרון והיעדר שינוי בכל שאר משתני
הסביבה. אין שמירת raw response או raw error. כשל לאחר תחילת כתיבה משאיר
`uncertain`: עוצרים לבדיקה, ללא retry אוטומטי או טענת rollback. receipt
`configured` מוכיח readback של ההגדרה בלבד; הפעלה חוזרת עם אותה תוכנית מחזירה
את ה־receipt הקיים ללא בקשת ספק. הוא אינו אימות חי חוזר ואינו מוכיח שהאתר
שכבר פורסם קרא את הערכים החדשים.

## מעבר מהמחשב לענן — תכנון, לא פעולה שבוצעה

לאחר preflight מוצלח של Render כשהעובד עדיין disabled: להמתין לתור ריק
ולסיום עבודה פעילה, לשמור גיבוי של plist המחשב, ואז `bootout` וגם `disable`
ל־LaunchAgent הקיים. עצירה בלבד אינה מספיקה: אסור שיחזור בריבוט במקביל לענן.
אין לשנות את קוד העובד או את קובץ ה־runtime המקומי לצורך זאת. לפני הפעלת
Render יש לאמת שהמחשב אכן stopped/disabled ולתת ל־heartbeat הישן לפקוע
(יותר מ־90 שניות). receipt במצב `active` מוכיח פריסת Render חיה בלבד,
עדיין ללא wake או heartbeat חדש. לאחר קבלתו משלימים את הגדרת Wix ואת
הפרסום המאושר דרך guard; אין דרישת heartbeat חדש לפני שלב הגדרה זה.
רק אחר כך GET של הבעלים לאתר מעיר את הענן כשהתור ריק. יש לאמת `updated_at`
חדש המאוחר מה־activation, עם `acceptedIntakeVersions:[2]`, כדי להוכיח
שה־runtime פועל בענן, ולא להסתמך על heartbeat של המחשב. ה־guard עצמו אינו
שולח wake. אין ליצור דף כחלק מבדיקת המעבר; הניסיון האחרון נשמר לנועם.

## חוזה Wix שנבדק

ה־CLI המוצמד הוא `@wix/cli@1.1.249`. ה־guard בודק version וגם SHA-256 של שלושת
קובצי החוזה שעליהם הוא מסתמך. הוא משתמש ב־`isLoggedInToAccount` וב־
`createHttpClient` המיוצאים מה־CLI, עם token/headers המוגבלים ל־site המדויק.
הוא אינו מפעיל את renderer, הפקודה או מדווח השגיאות של CLI, ואינו מעביר
סודות ל־argv. ההרשאה נשארת זו של הכניסה הקיימת; היעדרה חוסם.

הנתיבים והגוף לקוחים ממימוש `EnvSetCommand-7B4LXWC2.js` ו־
`chunk-EJB7C7MD.js`: upsert ב־`manage.wix.com/_api/wix-code-app-environments`,
`environment:prod`, `mutability:STATIC`, `returnEntity:true`,
`returnAllEnvironment:false`. שגיאות HTTP נשמרות רק כקוד קבוע. redirects
חסומים, timeout הוא 10 שניות, אין proxy מותאם ואין retry של כתיבה.
ה־dispatcher מסיר debug/instrumentation של Node לפני הפעלתו; הלקוח עצמו
חוסם דגלים אלה לפני טעינת auth, כדי ש־HTTP debug לא ידפיס כותרות אימות.
גם `NODE_TLS_REJECT_UNAUTHORIZED` מנוקה לפני Node; ערך `0` נחסם בלקוח עצמו
לפני טעינת auth. בדיקת התנהגות זו מקומית בלבד ואינה שולחת בקשת רשת.

תיעוד רשמי: [Wix env](https://dev.wix.com/docs/wix-cli/cli-for-headless/command-reference/project-commands/env)
ו־[משתני סביבה ב־CLI](https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/development/environment-variables/about-environment-variables-in-the-cli).
אלו משתני סביבת שרת של CLI; אין להציגם כפריטים של Secrets Manager.

CI מריץ `node --test tools/release/tests/teacher-wix-wake-env.test.mjs` דרך
`.github/workflows/release-guard-pr.yml`, ללא credentials או רשת ספק.
