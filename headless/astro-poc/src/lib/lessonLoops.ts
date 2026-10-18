/** Lesson-specific sequences. Rest/reduced-motion state keeps all worked steps readable. */
export type LessonStep = { text: string; math: string };
export type Lesson = {
  idea: string;
  picture: 'reflection' | 'net' | 'chart' | 'bars' | 'place' | 'equation' | 'shapes' | 'hundred' | 'rectangles';
  steps: [LessonStep, LessonStep, LessonStep];
  bars?: { total: number; filled: number; label: string }[];
};
const step = (text: string, math: string): LessonStep => ({ text, math });
export const LESSON_LOOPS = {
  'reflect-fold': { picture: 'reflection', idea: 'בשיקוף, כל נקודה והדמות שלה נמצאות באותו מרחק מקו הסימטריה', steps: [step('מסמנים קו סימטריה', ''),step('משקפים את החצי לצד השני', ''),step('בקיפול שני החלקים מתכסים בדיוק', '')] },
  'box-net': { picture: 'net', idea: 'בתיבה יש שישה מלבנים: שלושה זוגות של פאות שוות', steps: [step('זוג פאות ראשון', '2 × (2 × 3) = 12'),step('מחברים את שלושת הזוגות', '2 × 6 + 2 × 8 + 2 × 12'),step('שטח הפנים בסנטימטרים רבועים', 'S = 52')] },
  'read-bars': { picture: 'chart', idea: 'גובה העמודה מראה כמה פריטים יש בכל קבוצה', steps: [step('קוראים את גובה העמודה הראשונה', '3'),step('משווים בין הקבוצות', '5 > 3 > 2'),step('כמה פריטים יש בסך הכול?', '3 + 5 + 2 = 10')] },
  'capacity-units': { picture: 'bars', bars: [{total:10,filled:10,label:'1 L'},{total:10,filled:5,label:'0.5 L'}], idea:'ליטר אחד שווה לאלף מיליליטרים; חצי ליטר הוא חמש מאות',steps:[step('ליטר אחד', '1 L = 1,000 mL'),step('חצי מהכמות', '0.5 L = 500 mL'),step('קשר לנפח', '1 m³ = 1,000 L')] },
  'weight-units': {picture:'equation',idea:'בהמרת קילוגרמים לגרמים כופלים באלף',steps:[step('יחידת המידה', '1 kg = 1,000 g'),step('ממירים קילוגרם וחצי', '1.5 × 1,000 = 1,500'),step('בודקים את היחידות', '1.5 kg = 1,500 g')]},
  'fraction-count': {picture:'bars',bars:[{total:12,filled:7,label:'7/12'}],idea:'החלק מתוך הכמות הוא מספר הפריטים שנבחרו חלקי מספר הפריטים הכולל',steps:[step('נבחרו 35 מתוך 60 פריטים', '35/60'),step('מחלקים מונה ומכנה בחמש', '(35 ÷ 5)/(60 ÷ 5)'),step('אותו חלק בצמצום', '7/12')]},
  'fraction-add': {picture:'bars',bars:[{total:6,filled:3,label:'1/2 = 3/6'},{total:6,filled:2,label:'1/3 = 2/6'},{total:6,filled:5,label:'5/6'}],idea:'מחברים שברים רק אחרי שמחלקים את השלם לחלקים שווים באותו גודל',steps:[step('מוצאים מכנה משותף', '1/2 + 1/3'),step('ממירים לשישיות', '3/6 + 2/6'),step('מחברים את המונים', '5/6')]},
  'fraction-complete': {picture:'bars',bars:[{total:3,filled:1,label:'1/3'},{total:3,filled:2,label:'2/3'}],idea:'משלימים לשלם באמצעות חיסור, ובודקים בחיבור',steps:[step('מה חסר לשלם?', '1/3 + □ = 1'),step('מחסרים את החלק הידוע', '1 − 1/3 = 2/3'),step('בודקים', '1/3 + 2/3 = 1')]},
  'mixed-number': {picture:'bars',bars:[{total:4,filled:4,label:'4/4 = 1'},{total:4,filled:3,label:'3/4'}],idea:'שבעה רבעים הם שלם אחד ועוד שלושה רבעים',steps:[step('יש שבעה רבעים', '7/4'),step('מפרידים שלם אחד', '4/4 + 3/4'),step('מספר מעורב', '1 + 3/4')]},
  'mixed-add': {picture:'bars',bars:[{total:4,filled:4,label:'1'},{total:4,filled:3,label:'3/4'}],idea:'מחברים את השלמים ואת חלקי השבר באמצעות מכנה משותף',steps:[step('שלם ורבע ועוד חצי', '(1 + 1/4) + 1/2'),step('כותבים את החצי ברבעים', '1 + 1/4 + 2/4'),step('מחברים', '1 + 3/4')]},
  'mixed-multiply': {picture:'bars',bars:[{total:4,filled:3,label:'3/4'}],idea:'לפני כפל מספר מעורב ממירים אותו לשבר',steps:[step('שלם וחצי כפול חצי', '(1 + 1/2) × 1/2'),step('ממירים את המספר המעורב', '3/2 × 1/2'),step('כופלים מונים ומכנים', '3/4')]},
  'decimal-add': {picture:'bars',bars:[{total:10,filled:3,label:'0.3'},{total:10,filled:4,label:'0.4'},{total:10,filled:7,label:'0.7'}],idea:'שלוש עשיריות ועוד ארבע עשיריות הן שבע עשיריות',steps:[step('מחברים עשיריות', '0.3 + 0.4'),step('שלוש ועוד ארבע', '3/10 + 4/10'),step('שבע עשיריות', '0.7')]},
  'decimal-multiply': {picture:'bars',bars:[{total:10,filled:4,label:'0.4'},{total:10,filled:4,label:'0.4'},{total:10,filled:4,label:'0.4'}],idea:'שלוש קבוצות של ארבע עשיריות נותנות שתים עשרה עשיריות',steps:[step('שלוש פעמים ארבע עשיריות', '3 × 0.4'),step('מחברים שלוש קבוצות', '0.4 + 0.4 + 0.4'),step('שלם אחד ושתי עשיריות', '1.2')]},
  'decimal-divide': {picture:'bars',bars:[{total:10,filled:6,label:'0.6'},{total:10,filled:2,label:'0.2'}],idea:'בחילוק בודקים כמה קבוצות בגודל הנתון נכנסות בכמות',steps:[step('כמה פעמים שתי עשיריות נכנסות בשש?', '0.6 ÷ 0.2'),step('מודדים את שתי הכמויות בעשיריות', '6 ÷ 2'),step('שלוש קבוצות', '3')]},
  'add-no-carry': {picture:'place',idea:'מחברים יחידות ליחידות ועשרות לעשרות, בלי המרה',steps:[step('מפרקים לעשרות וליחידות', '23 + 14'),step('מחברים כל סוג בנפרד', '(20 + 10) + (3 + 4)'),step('שלוש עשרות ושבע יחידות', '37')]},
  'subtract-no-borrow': {picture:'place',idea:'מחסרים יחידות מיחידות ועשרות מעשרות, בלי פריטה',steps:[step('שלוש עשרות ושבע יחידות', '37 − 14'),step('מחסרים כל סוג בנפרד', '(30 − 10) + (7 − 4)'),step('שתי עשרות ושלוש יחידות', '23')]},
  'add-tens': {picture:'place',idea:'בהוספת עשרות שלמות, ספרת היחידות אינה משתנה',steps:[step('מוסיפים שתי עשרות', '34 + 20'),step('שלוש עשרות ועוד שתיים', '(30 + 20) + 4'),step('חמש עשרות וארבע יחידות', '54')]},
  'equation-expand': {picture:'equation',idea:'פותחים סוגריים ואז מבצעים אותה פעולה בשני האגפים',steps:[step('מכפילים כל איבר בסוגריים', '2(x + 4) = 18'),step('מחסרים שמונה משני האגפים', '2x + 8 = 18 → 2x = 10'),step('מחלקים את שני האגפים בשתיים', 'x = 5')]},
  'equation-both': {picture:'equation',idea:'שומרים על שוויון כשמבצעים אותה פעולה בשני אגפי המשוואה',steps:[step('יש נעלם בשני האגפים', '3x + 2 = x + 10'),step('מחסרים x ואחר כך 2 משני הצדדים', '2x = 8'),step('מחלקים בשתיים ובודקים', 'x = 4; 14 = 14')]},
  'substitute': {picture:'equation',idea:'מציבים מספר במקום הנעלם ואז מחשבים לפי סדר הפעולות',steps:[step('נתון ביטוי וערך לנעלם', '2x + 3; x = 4'),step('מחליפים כל x בארבע', '2 × 4 + 3'),step('קודם כפל, אחר כך חיבור', '8 + 3 = 11')]},
  'like-terms': {picture:'equation',idea:'מאחדים רק איברים עם אותו חלק משתנה',steps:[step('מזהים איברים דומים', '2x + 3 + 5x'),step('מחברים את המקדמים של x', '(2 + 5)x + 3'),step('הקבוע נשאר בנפרד', '7x + 3')]},
  'algebra-fraction': {picture:'equation',idea:'מצמצמים גורמים משותפים ושומרים על תחום ההצבה המקורי',steps:[step('המכנה אינו יכול להיות אפס', '(x² − 9)/(x − 3); x ≠ 3'),step('מפרקים את המונה', '((x − 3)(x + 3))/(x − 3)'),step('מצמצמים את הגורם המשותף', 'x + 3; x ≠ 3')]},
  'binomial-square': {picture:'equation',idea:'בריבוע סכום מופיע גם האיבר האמצעי, פעמיים המכפלה',steps:[step('ריבוע הוא כפל הביטוי בעצמו', '(x + 3)² = (x + 3)(x + 3)'),step('כופלים כל איבר בכל איבר', 'x² + 3x + 3x + 9'),step('מאחדים איברים דומים', 'x² + 6x + 9')]},
  'percent-quantity': {picture:'bars',bars:[{total:10,filled:10,label:'200'},{total:10,filled:1,label:'10% = 20'}],idea:'כדי לחשב אחוז מכמות, מוצאים אחוז אחד ומכפילים במספר האחוזים',steps:[step('מוצאים אחוז אחד מתוך מאתיים', '200 ÷ 100 = 2'),step('מחשבים ארבעים וחמישה אחוזים', '2 × 45'),step('התוצאה', '90')]},
  'percent-whole': {picture:'bars',bars:[{total:4,filled:1,label:'25% = 30'},{total:4,filled:4,label:'100% = 120'}],idea:'אם רבע מהכמות הוא שלושים, הכמות השלמה היא ארבע פעמים שלושים',steps:[step('נתון החלק', '25% = 30'),step('מוצאים אחוז אחד', '30 ÷ 25 = 1.2'),step('מחשבים מאה אחוזים', '1.2 × 100 = 120')]},
  'long-division': {picture:'equation',idea:'בחילוק ארוך מחלקים לפי ערך המקום, מהעשרות אל היחידות',steps:[step('מחלקים 84 לשלוש קבוצות', '84 ÷ 3'),step('תחילה 60, ואז 24', '60 ÷ 3 = 20; 24 ÷ 3 = 8'),step('מחברים ובודקים בכפל', '28; 28 × 3 = 84')]},
  'hundred-chart': {picture:'hundred',idea:'בלוח המאה, צעד ימינה מוסיף אחד וצעד מטה מוסיף עשר',steps:[step('מתחילים במספר 34','34'),step('משבצת אחת ימינה','34 + 1 = 35'),step('מהמספר 34, שורה אחת למטה','34 + 10 = 44')]},
  'square-rectangle': {picture:'rectangles',idea:'למלבן ארבע זוויות ישרות; בריבוע גם כל הצלעות שוות',steps:[step('מזהים ארבע פינות ישרות',''),step('במלבן הצלעות שממול שוות',''),step('בריבוע כל ארבע הצלעות שוות','')]},
  'prime-factorization': {picture:'equation',idea:'מפרקים מספר למכפלה של מספרים ראשוניים',steps:[step('מתחילים מגורם ראשוני','60 = 2 × 30'),step('ממשיכים לפרק את 30','60 = 2 × 2 × 15'),step('כל הגורמים כעת ראשוניים','60 = 2 × 2 × 3 × 5')]},
  'compare-fractions': {picture:'bars',bars:[{total:4,filled:2,label:'1/2 = 2/4'},{total:4,filled:3,label:'3/4'}],idea:'כדי להשוות שברים משווים חלקים מאותו שלם ובאותו גודל',steps:[step('כותבים את החצי ברבעים','1/2 = 2/4'),step('משווים מספרי רבעים','2/4 < 3/4'),step('חוזרים לשברים המקוריים','1/2 < 3/4')]},
  'round-large': {picture:'equation',idea:'בעיגול בוחרים את המספר העגול הקרוב ביותר',steps:[step('מעגלים את 347,000 למאות אלפים','300,000 < 347,000 < 400,000'),step('משווים מרחקים','47,000 < 53,000'),step('קרובים יותר לשלוש מאות אלף','347,000 ≈ 300,000')]},
  'divide-remainder': {picture:'equation',idea:'בחילוק עם שארית בודקים שהשארית קטנה מהמחלק',steps:[step('כמה פעמים 4 נכנס ב־85?','85 ÷ 4'),step('עשרים פעמים, ונשאר 5; מוסיפים עוד קבוצה','85 = 4 × 21 + 1'),step('בודקים שהשארית קטנה מהמחלק','1 < 4')]},
  'shape-solid': {picture:'shapes',idea:'ריבוע הוא צורה במישור; קובייה היא גוף בעל נפח',steps:[step('לריבוע ארבע צלעות', ''),step('בקובייה שש פאות ריבועיות', ''),step('צורה שטוחה לעומת גוף תלת־ממדי', '')]},
} satisfies Record<string,Lesson>;
export type LessonLoopVariant = keyof typeof LESSON_LOOPS;
export const LESSON_LOOP_VARIANTS = Object.keys(LESSON_LOOPS) as LessonLoopVariant[];
export const isLessonLoop = (id:string): id is LessonLoopVariant => Object.hasOwn(LESSON_LOOPS,id);
export const LESSON_TOPIC_MAP: Record<string,LessonLoopVariant> = {
  'hundred-chart-grade-1':'hundred-chart','square-rectangle-grade-1':'square-rectangle','prime-factors-grade-5':'prime-factorization',
  'fractions-numberline-compare-grade-4':'compare-fractions','fractions-numberline-compare-grade-5':'compare-fractions','compare-fractions-decimals-grade-5':'compare-fractions',
  'big-numbers-rounding-grade-5':'round-large','order-rounding-million-grade-4':'round-large','long-division-remainder-grade-4':'divide-remainder',
  'reflection-symmetry-grade-2':'reflect-fold', 'box-surface-area-grade-6':'box-net', 'boxes-nets-grade-6':'box-net',
  'data-grade-1':'read-bars','tables-bar-charts-grade-2':'read-bars','collecting-data-grade-3':'read-bars','read-bar-diagram-grade-3':'read-bars','diagrams-conclusions-grade-4':'read-bars','read-graphs-grade-5':'read-bars','read-tables-grade-5':'read-bars','collect-represent-data-grade-6':'read-bars','compare-groups-conclusions-grade-6':'read-bars',
  'capacity-ml-l-m3-grade-6':'capacity-units','unit-conversion-weight-grade-5':'weight-units','fraction-of-quantity-grade-5':'fraction-count',
  'common-denominator-grade-5':'fraction-add','add-subtract-fractions-grade-5':'fraction-add','add-subtract-mixed-numbers-grade-5':'mixed-add','completing-fractions-grade-5':'fraction-complete','missing-number-fractions-grade-5':'fraction-complete','fractions-mixed-numbers-grade-5':'mixed-number','multiply-mixed-numbers-grade-6':'mixed-multiply',
  'add-subtract-decimals-grade-5':'decimal-add','multiply-decimals-grade-6':'decimal-multiply','divide-decimals-grade-6':'decimal-divide',
  'addition-two-digit-no-carry-grade-2':'add-no-carry','subtraction-two-digit-no-borrow-grade-2':'subtract-no-borrow','adding-tens-decompose-grade-2':'add-tens',
  'equations-advanced-grade-7':'equation-expand','equations-both-sides-word-problems-grade-7':'equation-both','algebraic-expressions-grade-7':'substitute','combining-like-terms-grade-7':'like-terms','algebraic-fractions-grade-9':'algebra-fraction','binomial-square-grade-9':'binomial-square',
  'percent-of-quantity-grade-6':'percent-quantity','find-the-whole-grade-6':'percent-whole','long-division-grade-5':'long-division','shapes-vs-solids-grade-2':'shape-solid',
};
