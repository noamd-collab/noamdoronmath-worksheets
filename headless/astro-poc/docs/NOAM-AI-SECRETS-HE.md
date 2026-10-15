# איפה להוסיף את הסודות של נועם AI

האתר הוא **Noam Math Astro POC** (מזהה `df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46`, הכתובת www.noamdoronmath.co.il).
לא My Site ולא My Site 2.

1. ב־Wix פותחים את לוח הבקרה של **Noam Math Astro POC**.
2. נכנסים ל־**Developer Tools**, ואז ל־**Secrets Manager**.
3. לוחצים **Add Secret**, בשם כותבים בדיוק `QWEN_API_KEY`, בשדה הערך מדביקים מפתח **Alibaba Cloud Model Studio בתשלום לפי שימוש**, ושומרים.
4. לוחצים **Add Secret** שוב, בשם כותבים בדיוק `NOAM_RECAPTCHA_SECRET_KEY`, בשדה הערך מדביקים את המפתח הסודי של reCAPTCHA, ושומרים.
5. אם האזור או שם המודל שונים מברירת המחדל, מוסיפים עוד שני סודות (רשות): `QWEN_BASE_URL` ו־`QWEN_MODEL`.

בלי `QWEN_API_KEY` ו־`NOAM_RECAPTCHA_SECRET_KEY` נועם AI עונה «לא פעיל» ולא קורא למודל.
אין להדביק את הערכים בצ׳אט או בגיטהאב. נועם מכניס את המפתח בעצמו ב־Secrets Manager.

## מפתח המודל

מפתח Token Plan אישי לא מיועד לשרת של אתר. לפי התיעוד של QwenCloud הוא מוגבל לכלי תכנות, וקריאה משרת האפליקציה עלולה להידחות ב־401 או 403 (`MODEL_AUTH_FAILED`). זה מה שנראה בפריוויו: הבקשה הגיעה לשרת, והתשובה הייתה גיבוי ולא תשובת מודל.

`QWEN_API_KEY` באתר החי צריך להיות מפתח Model Studio רגיל (pay-as-you-go) של אותו חשבון ואזור.

ברירת המחדל, אם לא מגדירים את שני הסודות הרשות:

- `QWEN_BASE_URL` = `https://token-plan.maas.qwencloudapi.com/compatible-mode/v1`
- `QWEN_MODEL` = `qwen3.8-flash`

כתובת שמתאימה ל־Model Studio, לפי האזור של החשבון:

- בינלאומי (סינגפור): `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- בייג׳ינג: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- ארצות הברית: `https://dashscope-us.aliyuncs.com/compatible-mode/v1`

`QWEN_MODEL` הוא מזהה המודל שמופיע בקונסולת Model Studio של אותו חשבון. כתובת או שם לא מוכרים נזרקים, והשרת נשאר על ברירת המחדל. המפתח לא נכתב ללוג.

בדיקות ה־CI משתמשות ב־`CHINESE_MODELS_API_KEY` (מפתח אחר, ל־Token Plan של הביקורות). CI ירוק לא מוכיח שהאתר החי מדבר עם מודל. גם תשובה ל«היי» לא מוכיחה: חלק מהתשובות קבועות בקוד. בפריוויו, `data-answer-kind` הוא `model` רק לתשובת מודל, `hardcoded` לתשובה קבועה, ו־`fallback` לגיבוי. כשל אימות נשמר ב־`data-response-error` כ־`MODEL_AUTH_FAILED`.

אחרי שהמפתח החדש נשמר ב־Wix עדיין צריך בדיקה חיה של בקשה עם כיתה, נושא ורמה. בלי זה אי אפשר לומר שהמודל באתר עובד.

## הגבלת קצב

על Wix כתובת המבקר נלקחת רק מהכותרת `true-client-ip`. הקצה של Wix דורס שם ערך מזויף.
`cf-connecting-ip` ו־`x-real-ip` לא נספרים. `clientAddress` לא נקרא, כי על Wix הוא זורק שגיאה.
כשיש כתובת: 12 בקשות בדקה לאותה כתובת.
כשאין כתובת: כל טוקן של reCAPTCHA נספר לחוד (12 בדקה), ויש גם תקרה משותפת של 120 בדקה לאותו עותק שרת.
המגבלה נשמרת בזיכרון של העותק. התקרה האמיתית לעלות היא reCAPTCHA, המודל Qwen Flash, ומגבלת האסימונים.
