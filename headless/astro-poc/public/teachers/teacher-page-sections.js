/* Sections of a teacher page: test sections are scored, review sections are not. */

export const MORE_TOPIC_QUESTION = 'האם תרצה לבחור עוד נושא לדף שלך?';

export const SECTION_KINDS = {
  test: {
    label: 'קטע מבחן',
    help: 'ציון, ניקוד לכל שאלה, שם ותאריך.',
    heading: 'מבחן',
  },
  review: {
    label: 'בניית דף חזרה על חומר',
    help: 'שאלות לתרגול וחזרה על חומר, בלי ציון ובלי ניקוד.',
    heading: 'חזרה על חומר',
  },
};

export const TEST_TOTAL_POINTS = 100;

export function sectionKind(value) {
  return value === 'test' ? 'test' : 'review';
}

export const PICK_HEADING = 'מסמנים את השאלות השלמות שמתאימות, כפי שהן בדף המקור';

/** Ask once the teacher has picked at least one whole question, until they answer no for this topic. */
export function shouldAskMoreTopic(selectedQuestions, dismissed) {
  return Number(selectedQuestions) > 0 && !dismissed;
}

/**
 * Split the test points over every test question on the page.
 * blocks: [{ kind, questions: number }] in page order.
 * Returns one array of points per block (empty for review blocks).
 */
export function testPoints(blocks, total = TEST_TOTAL_POINTS) {
  const count = (blocks || []).reduce((sum, block) => sum + (sectionKind(block.kind) === 'test' ? Math.max(0, block.questions | 0) : 0), 0);
  const base = count ? Math.floor(total / count) : 0;
  let extra = count ? total - base * count : 0;
  return (blocks || []).map((block) => {
    if (sectionKind(block.kind) !== 'test') return [];
    const list = [];
    for (let i = 0; i < Math.max(0, block.questions | 0); i += 1) {
      const points = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      list.push(points);
    }
    return list;
  });
}

/** Section headings only when the page mixes topics or has a test section. */
export function needsSectionHeadings(blocks) {
  const list = blocks || [];
  return list.length > 1 || list.some((block) => sectionKind(block.kind) === 'test');
}

export function sectionTitle(kind, topic) {
  const name = SECTION_KINDS[sectionKind(kind)].heading;
  return topic ? `${name} · ${topic}` : name;
}

export function pointsLabel(questionNumber, points) {
  return `שאלה ${questionNumber} · ${points} נק׳`;
}

export function scoreLabel(total) {
  return `ציון: ______ מתוך ${total}`;
}
