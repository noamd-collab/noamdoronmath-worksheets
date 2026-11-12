export type TeacherGenerationLevel = 'b' | 'a' | 'e';
export type TeacherGenerationGoal = 'practice' | 'review' | 'introduce' | 'assessment';
export interface TeacherGenerationIntake {
  version: 1;
  gradeNumber: number;
  topicId: string;
  level: TeacherGenerationLevel;
  lessonGoal: TeacherGenerationGoal;
  lastLesson: string;
  alreadyLearned: string[];
  minutes: number;
  questionCount: number;
  classLabel?: string;
  taughtThroughTopicId?: string;
  explicitShortSheet: boolean;
}
export interface TeacherGenerationTopic {
  readonly topicId: string;
  readonly sourceTopicId: string;
  readonly sourceTrack: string;
  readonly gradeNumber: number;
  readonly order: number;
  readonly title: string;
  readonly domain: string;
  readonly allowedConcepts: readonly string[];
  readonly notYetConcepts: readonly string[];
  readonly skillId: 'elementary' | 'middle';
  readonly skillVersion: string;
}
export interface TeacherGenerationIssue { field: string; code: string; message: string }
export type TeacherGenerationValidation =
  | { ok: true; value: TeacherGenerationIntake; topic: TeacherGenerationTopic }
  | { ok: false; issues: TeacherGenerationIssue[] };

type TopicRow = [string, number, string, string, string[], string[]];
interface CurriculumProjection {
  version: number;
  officialCalendarVerified: boolean;
  provenanceNote: string;
  sources: Record<'elementary' | 'middle', { skillVersion: string; curriculumVersion: string; basis: string; files: Record<string, string> }>;
  tracks: Record<string, { sourceTrack: string; gradeNumber: number; label: string }>;
  topics: TopicRow[];
  elementaryForbiddenAll: string[];
  elementaryForbiddenByGrade: Record<string, string[]>;
  middleExcludedByTrack: Record<string, string[]>;
}
const HEBREW_GRADES = 'אבגדהו';
const TRACKS = { g7: ['ז', 7], g8: ['ח', 8], g9r: ['ט_רגילה', 9], g9m: ['ט_מצומצמת', 9] } as const;
export interface TeacherGenerationCurriculum {
  readonly version: 1;
  readonly officialCalendarVerified: false;
  readonly provenanceNote: string;
  readonly sources: Readonly<CurriculumProjection['sources']>;
  readonly tracks: Readonly<CurriculumProjection['tracks']>;
  readonly topics: readonly TeacherGenerationTopic[];
  readonly elementaryForbiddenAll: readonly string[];
  readonly elementaryForbiddenByGrade: Readonly<Record<string, readonly string[]>>;
  readonly middleExcludedByTrack: Readonly<Record<string, readonly string[]>>;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isStringList = (value: unknown): value is string[] => Array.isArray(value) &&
  value.length <= 100 && value.every(item => isText(item, 1000));

/** Decode the caller-supplied, hash-pinned static asset. Never import it into the Wix worker. */
export function parseTeacherGenerationCurriculum(input: unknown): TeacherGenerationCurriculum {
  const fail = () => { throw new Error('Invalid or unsupported teacher generation curriculum'); };
  if (!isRecord(input) || input.version !== 1 || input.officialCalendarVerified !== false ||
      !isText(input.provenanceNote, 1000) || !isRecord(input.sources) || !isRecord(input.tracks) ||
      !Array.isArray(input.topics) || input.topics.length !== 232 || !isStringList(input.elementaryForbiddenAll) ||
      !isRecord(input.elementaryForbiddenByGrade) || !isRecord(input.middleExcludedByTrack)) fail();
  const data = input as unknown as CurriculumProjection;
  for (const [id, version] of [['elementary', '1.0.5-noam'], ['middle', '7.2.0-noam']]) {
    const source = data.sources[id as 'elementary' | 'middle'];
    if (!isRecord(source) || source.skillVersion !== version || !isText(source.basis, 2000) ||
        !isText(source.curriculumVersion, 500) || !isRecord(source.files) ||
        !Object.values(source.files).every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) fail();
  }
  for (const [prefix, [sourceTrack, gradeNumber]] of Object.entries(TRACKS)) {
    const track = data.tracks[prefix];
    if (!isRecord(track) || track.sourceTrack !== sourceTrack || track.gradeNumber !== gradeNumber ||
        !isText(track.label, 200) || !isStringList(data.middleExcludedByTrack[prefix])) fail();
  }
  for (const grade of HEBREW_GRADES) if (!isStringList(data.elementaryForbiddenByGrade[grade])) fail();
  const seen = new Set<string>();
  const topics = data.topics.map(row => {
    if (!Array.isArray(row) || row.length !== 6) return fail();
    const [topicId, order, title, domain, allowedConcepts, notYetConcepts] = row;
    if (typeof topicId !== 'string' || !/^(?:[א-ו]\d{2}|g(?:7|8|9r|9m):[a-z][a-z0-9_]{0,80})$/.test(topicId) ||
        seen.has(topicId) || !Number.isInteger(order) || order < 1 || order > 200 ||
        !isText(title, 500) || !isText(domain, 100) || !isStringList(allowedConcepts) || !isStringList(notYetConcepts)) return fail();
    seen.add(topicId);
    const elementary = /^[א-ו]/.test(topicId);
    const prefix = topicId.split(':')[0];
    const track = elementary ? null : data.tracks[prefix];
    const skillId = elementary ? 'elementary' : 'middle';
    return Object.freeze({ topicId, sourceTopicId: elementary ? topicId : topicId.slice(prefix.length + 1),
      sourceTrack: elementary ? topicId[0] : track!.sourceTrack,
      gradeNumber: elementary ? HEBREW_GRADES.indexOf(topicId[0]) + 1 : track!.gradeNumber,
      order, title, domain, allowedConcepts: Object.freeze(allowedConcepts.slice()),
      notYetConcepts: Object.freeze(notYetConcepts.slice()), skillId,
      skillVersion: data.sources[skillId].skillVersion }) as TeacherGenerationTopic;
  });
  const freezeLists = (record: Record<string, string[]>) => Object.freeze(Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, Object.freeze(value.slice())])));
  return Object.freeze({ version: 1, officialCalendarVerified: false, provenanceNote: data.provenanceNote,
    sources: Object.freeze(Object.fromEntries(Object.entries(data.sources).map(([id, source]) =>
      [id, Object.freeze({ ...source, files: Object.freeze({ ...source.files }) })]))) as CurriculumProjection['sources'],
    tracks: Object.freeze(Object.fromEntries(Object.entries(data.tracks).map(([id, track]) => [id, Object.freeze({ ...track })]))),
    topics: Object.freeze(topics), elementaryForbiddenAll: Object.freeze(data.elementaryForbiddenAll.slice()),
    elementaryForbiddenByGrade: freezeLists(data.elementaryForbiddenByGrade),
    middleExcludedByTrack: freezeLists(data.middleExcludedByTrack) });
}

// This is a planning catalog. Presence here never grants a renderer capability.
export function getTeacherGenerationTopics(gradeNumber: number, curriculum: TeacherGenerationCurriculum): readonly TeacherGenerationTopic[] {
  return curriculum.topics.filter(topic => topic.gradeNumber === gradeNumber);
}
export function getTeacherGenerationTopic(gradeNumber: number, topicId: string, curriculum: TeacherGenerationCurriculum): TeacherGenerationTopic | null {
  const topic = curriculum.topics.find(row => row.topicId === topicId);
  return topic?.gradeNumber === gradeNumber ? topic : null;
}

/** Full-sheet intake floor; a renderer must still validate its actual sections/subitems/figures. */
export function getTeacherGenerationMinimumQuestionCount(gradeNumber: number): number | null {
  if (!Number.isInteger(gradeNumber) || gradeNumber < 1 || gradeNumber > 9) return null;
  return gradeNumber <= 2 ? 8 : gradeNumber <= 4 ? 12 : gradeNumber <= 6 ? 14 : 20;
}

const FIELDS = new Set(['version', 'gradeNumber', 'topicId', 'level', 'lessonGoal', 'lastLesson',
  'alreadyLearned', 'minutes', 'questionCount', 'classLabel', 'taughtThroughTopicId', 'explicitShortSheet']);
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const isText = (value: unknown, maximum: number): value is string => typeof value === 'string' &&
  value.trim().length > 0 && value.length <= maximum && !CONTROLS.test(value);
const exactTerm = (text: string) => text.normalize('NFC').replace(/[\u0591-\u05bd\u05bf-\u05c7]/gu, '').trim();

/**
 * Free-text lesson context is not proof of prerequisite mastery. Only exact known topic IDs
 * and explicit forbidden terms can be checked here; generation still needs pedagogical review.
 * Class labels are generic group labels, never a student record or a claim of PII detection.
 */
export function validateTeacherGenerationIntake(input: unknown, curriculum: TeacherGenerationCurriculum): TeacherGenerationValidation {
  const issues: TeacherGenerationIssue[] = [];
  const add = (field: string, code: string, message: string) => { issues.push({ field, code, message }); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, issues: [{ field: 'intake', code: 'INVALID_OBJECT', message: 'נדרש מפרט שיעור תקין.' }] };
  }
  const raw = input as Record<string, unknown>;
  for (const field of Object.keys(raw)) if (!FIELDS.has(field)) add(field, 'UNKNOWN_FIELD', 'שדה שאינו נתמך במפרט השיעור.');
  if (raw.version !== 1) add('version', 'UNSUPPORTED_VERSION', 'גרסת מפרט השיעור אינה נתמכת.');
  const grade = raw.gradeNumber;
  if (typeof grade !== 'number' || !Number.isInteger(grade) || grade < 1 || grade > 9) {
    add('gradeNumber', 'INVALID_GRADE', 'יש לבחור כיתה א׳ עד ט׳.');
  }
  const topicId = raw.topicId;
  const byId = new Map(curriculum.topics.map(topic => [topic.topicId, topic]));
  const known = typeof topicId === 'string' ? byId.get(topicId) : undefined;
  if (!known) add('topicId', 'UNKNOWN_TOPIC', 'יש לבחור נושא קיים מהרשימה, ללא שינוי המזהה.');
  else if (known.gradeNumber !== grade) add('topicId', 'GRADE_TOPIC_MISMATCH', 'הנושא אינו שייך לכיתה שנבחרה.');
  if (!['b', 'a', 'e'].includes(raw.level as string)) add('level', 'INVALID_LEVEL', 'יש לבחור רמה ב׳, רמה א׳ או מצוינות.');
  if (!['practice', 'review', 'introduce', 'assessment'].includes(raw.lessonGoal as string)) {
    add('lessonGoal', 'INVALID_GOAL', 'יש לבחור מטרת שיעור.');
  }
  if (!isText(raw.lastLesson, 1000)) add('lastLesson', 'INVALID_LAST_LESSON', 'יש לתאר בקצרה מה נלמד בשיעור האחרון.');
  const learned = raw.alreadyLearned;
  const validLearned = Array.isArray(learned) && learned.length <= 40 && learned.every(item => isText(item, 160));
  if (!validLearned) add('alreadyLearned', 'INVALID_LEARNED_CONTEXT', 'הידע הקודם צריך להיות רשימה של עד 40 תיאורים קצרים.');
  if (typeof raw.minutes !== 'number' || !Number.isInteger(raw.minutes) || raw.minutes < 10 || raw.minutes > 120) {
    add('minutes', 'INVALID_MINUTES', 'משך השיעור צריך להיות בין 10 ל־120 דקות.');
  }
  if (typeof raw.questionCount !== 'number' || !Number.isInteger(raw.questionCount) || raw.questionCount < 4 || raw.questionCount > 30) {
    add('questionCount', 'INVALID_QUESTION_COUNT', 'יש לבקש בין 4 ל־30 שאלות.');
  }
  if (typeof raw.explicitShortSheet !== 'boolean') add('explicitShortSheet', 'INVALID_SHORT_SHEET_CHOICE', 'נדרשת בחירה מפורשת לגבי דף קצר.');
  const floor = typeof grade === 'number' ? getTeacherGenerationMinimumQuestionCount(grade) : null;
  if (floor !== null && typeof raw.questionCount === 'number' && raw.questionCount < floor && raw.explicitShortSheet !== true) {
    add('questionCount', 'SHORT_SHEET_REQUIRES_EXPLICIT_REQUEST', `דף בהיקף קטן מ־${floor} שאלות דורש בקשה מפורשת לדף קצר.`);
  }
  if (raw.classLabel !== undefined && (!isText(raw.classLabel, 60) || /@|https?:\/\/|\d[\d ()+\-]{6,}\d/u.test(raw.classLabel))) {
    add('classLabel', 'INVALID_CLASS_LABEL', 'יש להזין כינוי כללי לכיתה, ללא פרטי תלמידים או פרטי קשר.');
  }
  if (known && ((known.topicId.startsWith('g9r:') && raw.level === 'b') ||
               (known.topicId.startsWith('g9m:') && ['a', 'e'].includes(raw.level as string)))) {
    add('level', 'LEVEL_TRACK_MISMATCH', 'הרמה אינה תואמת למסלול כיתה ט׳ שנבחר; יש לבחור את המסלול והרמה במפורש.');
  }
  if (raw.taughtThroughTopicId !== undefined) {
    const boundary = typeof raw.taughtThroughTopicId === 'string' ? byId.get(raw.taughtThroughTopicId) : undefined;
    if (!boundary) add('taughtThroughTopicId', 'UNKNOWN_PROGRESS_TOPIC', 'נקודת ההתקדמות חייבת להיות נושא קיים.');
    else if (known) {
      if (boundary.gradeNumber !== grade || boundary.sourceTrack !== known.sourceTrack) {
        add('taughtThroughTopicId', 'PROGRESS_TRACK_MISMATCH', 'נקודת ההתקדמות צריכה להיות באותה כיתה ובאותו מסלול.');
      } else if (boundary.order > known.order) {
        add('taughtThroughTopicId', 'FUTURE_PROGRESS_TOPIC', 'נקודת ההתקדמות אינה יכולה להיות אחרי הנושא שנבחר.');
      } else if (boundary.order < known.order && raw.lessonGoal !== 'introduce') {
        add('lessonGoal', 'TOPIC_NOT_LEARNED', 'לפי נקודת ההתקדמות, הנושא החדש מיועד להקנייה ולא לחזרה או להערכה.');
      }
    }
  }
  if (known && validLearned) {
    const forbidden = new Set((known.skillId === 'elementary'
      ? [...curriculum.elementaryForbiddenAll, ...(curriculum.elementaryForbiddenByGrade[known.sourceTrack] || []), ...known.notYetConcepts]
      : [...(curriculum.middleExcludedByTrack[known.topicId.split(':')[0]] || []), ...known.notYetConcepts]).map(exactTerm));
    const currentOrEarlier = new Set(curriculum.topics.filter(topic => topic.gradeNumber < known.gradeNumber ||
      (topic.sourceTrack === known.sourceTrack && topic.order <= known.order))
      .flatMap(topic => [topic.title, ...topic.allowedConcepts]).map(exactTerm));
    const laterTerms = new Set(curriculum.topics.filter(topic => topic.gradeNumber === known.gradeNumber &&
      topic.sourceTrack === known.sourceTrack && topic.order > known.order)
      .flatMap(topic => [topic.title, ...topic.allowedConcepts]).map(exactTerm)
      .filter(term => !currentOrEarlier.has(term)));
    learned.forEach((value, index) => {
      const term = value.trim();
      const prior = byId.get(term);
      if (prior && (prior.gradeNumber > known.gradeNumber ||
          (prior.gradeNumber === known.gradeNumber && (prior.sourceTrack !== known.sourceTrack || prior.order > known.order)))) {
        add(`alreadyLearned.${index}`, 'FUTURE_OR_OTHER_TRACK_TOPIC', 'הידע הקודם כולל נושא מאוחר יותר או ממסלול אחר.');
      } else if (forbidden.has(exactTerm(term))) {
        add(`alreadyLearned.${index}`, 'FORBIDDEN_CONCEPT', 'המושג אינו מותר בנקודה הזאת לפי הסקיל.');
      } else if (laterTerms.has(exactTerm(term))) {
        add(`alreadyLearned.${index}`, 'FUTURE_CONCEPT', 'המושג שייך לנושא מאוחר יותר ברצף הסקיל.');
      }
    });
  }
  if (issues.length || !known) return { ok: false, issues };
  const value: TeacherGenerationIntake = {
    version: 1, gradeNumber: grade as number, topicId: known.topicId,
    level: raw.level as TeacherGenerationLevel, lessonGoal: raw.lessonGoal as TeacherGenerationGoal,
    lastLesson: (raw.lastLesson as string).trim(), alreadyLearned: [...new Set((learned as string[]).map(item => item.trim()))],
    minutes: raw.minutes as number, questionCount: raw.questionCount as number,
    explicitShortSheet: raw.explicitShortSheet as boolean,
    ...(raw.classLabel === undefined ? {} : { classLabel: (raw.classLabel as string).trim() }),
    ...(raw.taughtThroughTopicId === undefined ? {} : { taughtThroughTopicId: raw.taughtThroughTopicId as string }),
  };
  return { ok: true, value, topic: known };
}
