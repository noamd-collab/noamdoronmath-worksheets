# אוסף הנתונים `BlogPostAudio`

יש ליצור אותו פעם אחת ב-CMS של האתר (Wix Studio → CMS → אוסף חדש).
שם האוסף חייב להיות בדיוק `BlogPostAudio`.

## הרשאות

| פעולה | מי מורשה |
|---|---|
| קריאה | Admin בלבד |
| יצירה / עדכון / מחיקה | Admin בלבד |

הגולשים לא ניגשים לאוסף ישירות. כל הקריאות עוברות דרך פונקציות ה-backend,
שמשתמשות ב-`suppressAuth`, ומחזירות רק רשומה של פוסט שמפורסם באותו רגע.

## שדות

| Field ID | סוג | תיאור |
|---|---|---|
| `postId` | Text | מזהה הפוסט ב-Wix Blog. מפתח ההתאמה העיקרי. |
| `slug` | Text | ה-slug של הפוסט, לשימוש בנגן ובקישור. |
| `title` | Text | כותרת הפוסט בזמן ההפקה. |
| `storageBackend` | Text | `github-pages` או `wix-media`. |
| `fileId` | Text | נתיב הקובץ באחסון. |
| `fileUrl` | Text | הכתובת הציבורית של קובץ ה-MP3. |
| `durationSec` | Number | אורך ההקראה בשניות. |
| `bytes` | Number | גודל הקובץ. |
| `signature` | Text | חתימת SHA-256 של גרסת ההקראה: טקסט + מודל + קול + סגנון + פורמט. |
| `scriptSha256` | Text | חתימת טקסט ההקראה בלבד. |
| `scriptChars` | Number | מספר התווים שהוקראו. |
| `sourceHash` | Text | טביעת אצבע של הפוסט כפי שהוא באתר. שינוי שלה = צריך להפיק מחדש. |
| `model` | Text | מזהה מודל ה-TTS. |
| `voice` | Text | שם הקול (`Charon`). |
| `language` | Text | קוד שפה אם הוגדר, אחרת ריק. |
| `styleHash` | Text | 16 תווים מחתימת הוראת הסגנון. |
| `active` | Boolean | האם השמע מוצג. נכבה כשפוסט יורד מפרסום. |
| `needsAudio` | Boolean | סומן להפקה מחדש. |
| `renderedAt` | Date and Time | מתי הופק הקובץ. |
| `lastCheckedAt` | Date and Time | מתי הסריקה התקופתית בדקה את הרשומה לאחרונה. |

## אינדקס מומלץ

אינדקס רגיל על `postId`, ועוד אחד על `slug`. שניהם נשאלים בכל פתיחת עמוד פוסט.
