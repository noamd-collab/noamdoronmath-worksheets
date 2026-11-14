import assert from 'node:assert/strict';

/** PR456's exact reviewed copy change. Historical production captures stay intact.
 * Tests reverse only these five fields per page, after requiring their new values;
 * every other educational, SEO, CTA and schema field keeps its original fence.
 */
export const PDF_ONLY_TOPIC_COPY = {
  'cone-grade-8': {
    beforeDescription: 'דפי עבודה חינמיים בנפח חרוט לכיתה ח׳, בשלוש רמות: א׳, ב׳ ומצוינות. תרגלו את נוסחת שליש שטח הבסיס כפול הגובה, פתרו תרגילים וקבלו רמז מנועם AI ללא הרשמה היום.',
    description: 'דפי עבודה חינמיים בנפח חרוט לכיתה ח׳, בשלוש רמות: א׳, ב׳ ומצוינות. תרגלו את נוסחת שליש שטח הבסיס כפול הגובה, פתרו תרגילים והורידו דפי תרגול עם תשובות להדפסה, ללא הרשמה.',
    beforeParagraph: 'מה היחס בין נפח חרוט לנפח גליל בעלי אותו בסיס ואותו גובה? תשובה: 1:3. נפח החרוט הוא שליש מנפח הגליל. בדף העבודה אפשר לבקש רמז מנועם AI ולהמשיך לנסות באופן עצמאי.',
    paragraph: 'מה היחס בין נפח חרוט לנפח גליל בעלי אותו בסיס ואותו גובה? תשובה: 1:3. נפח החרוט הוא שליש מנפח הגליל. בדפים הנפתחים בצופה אפשר לבקש רמז מנועם AI. המהדורה הנוספת זמינה כעת בקובצי PDF להדפסה.',
    blockIndex: 0, flowIndex: 7,
  },
  'cylinder-volume-grade-8': {
    beforeDescription: 'דפי עבודה חינמיים בנפח גליל לכיתה ח׳, בשלוש רמות: א׳, ב׳ ומצוינות. תרגלו הצבה בנוסחה πr²h, פתרו בעיות נפח וקבלו רמז מנועם AI ללא הרשמה, בכל עת, לכל תלמיד ותלמידה.',
    description: 'דפי עבודה חינמיים בנפח גליל לכיתה ח׳, בשלוש רמות: א׳, ב׳ ומצוינות. תרגלו הצבה בנוסחה πr²h, פתרו בעיות נפח והורידו דפי תרגול עם תשובות להדפסה, ללא הרשמה.',
    beforeParagraph: 'בדף העבודה אפשר לבקש רמז מנועם AI ולהמשיך לנסות באופן עצמאי.',
    paragraph: 'בדפים הנפתחים בצופה אפשר לבקש רמז מנועם AI. המהדורה הנוספת זמינה כעת בקובצי PDF להדפסה.',
    blockIndex: 2, flowIndex: 9,
  },
} as const;

export function restoreBeforePdfCopy<T>(slug: string, page: T): T {
  const change = PDF_ONLY_TOPIC_COPY[slug as keyof typeof PDF_ONLY_TOPIC_COPY];
  if (!change) return page;
  const restored: any = structuredClone(page);
  const fields: [any, string, string, string][] = [
    [restored, 'description', change.description, change.beforeDescription],
    [restored.jsonLd['@graph'][0], 'description', change.description, change.beforeDescription],
    [restored.jsonLd['@graph'][1], 'description', change.description, change.beforeDescription],
    [restored.sections[2].blocks[change.blockIndex], 'text', change.paragraph, change.beforeParagraph],
    [restored.bodyFlow[change.flowIndex], 'text', change.paragraph, change.beforeParagraph],
  ];
  for (const [owner, key, current, previous] of fields) {
    assert.equal(owner[key], current, `${slug}: exact PDF-only / viewer-AI scope copy`);
    owner[key] = previous;
  }
  return restored;
}
