# נועם AI: תמיכה חלקית בהדגשת זוויות

ה־PDF, הנתונים, הסימונים, האילוצים המדידים והמנוע המקורי נשמרים. במנוע המקורי, פעולות הדגשת angle/equal_angle עדיין מציעות הדגשה של נקודות בלבד. אין כאן תיקון של המנוע או הצהרה שפעולותיו אלה תקינות.

**מסלול הצריכה הנדרש בחבילה זו:** כל קריאת הדגשה עוברת דרך `noam-safe-consumer/safe_highlight.py`, בצירוף תיקיית רמת הלימוד, מזהה האיור ומזהה האובייקט. הקובץ `policy.json` קשור ב־SHA256 לייצוא הסופי ומונה את פעולות הזווית החסומות. בקשה כזו נעצרת בקוד2, ללאSVG, ונועם AI צריך להסביר במילים. שינוי בייצוא או בכלי המקורי עוצר אף הוא את הפעולה עד ביקורת מחודשת. שאר הפעולות מועברות לכלי המקורי ללא שינוי.

מערכת שמייבאת רק את noam-ai.json ועוקפת את מסלול הצריכה עדיין חשופה למגבלה; אין לאשר בה הדגשת זוויות אוטומטית. לא בוצע חיבור או שינוי במערכת חיצונית. שדה התמיכה במנוע עצמו לא שונה. החבילה מיועדת להדפסה ולשימוש בנתוני ההנחיה, והפעלת ההדגשות המוגבלות מחייבת את המסלול המצורף.

## פעולה נוספת שנחסמת במפורש

ברמה a, איור `q1_head`, פעולה `r-perpendicular-B-C-H` נחסמת אף היא. Only CH receives visible highlighting; BH is not highlighted, so the offered perpendicular relation is incomplete.

ברמה a, איור `q17_head`, פעולה `r-perpendicular-B-C-H` נחסמת אף היא. Only CH receives visible highlighting; BH is not highlighted, so the offered perpendicular relation is incomplete.

ברמה b, איור `q5_head`, פעולה `r-perpendicular-B-C-H` נחסמת אף היא. Only CH receives visible highlighting; BH is not highlighted, so the offered perpendicular relation is incomplete.

ברמה b, איור `q15_head`, פעולה `r-perpendicular-B-C-H` נחסמת אף היא. Only CH receives visible highlighting; BH is not highlighted, so the offered perpendicular relation is incomplete.

ברמה c, איור `q1_head`, פעולה `r-perpendicular-B-C-H` נחסמת אף היא. Only CH receives visible highlighting; BH is not highlighted, so the offered perpendicular relation is incomplete.

ברמה c, איור `q12_head`, פעולה `r-perpendicular-B-C-H` נחסמת אף היא. Only CH receives visible highlighting; BH is not highlighted, so the offered perpendicular relation is incomplete.

כל חסימה חלה רק על האיור והפעולה הרשומים ומקושרת לחתימת ה־SVG. נתוני השרטוט המקורי נשמרים. פירוט ב־ADDITIONAL-NATIVE-ACTION-LIMITATIONS.json.
