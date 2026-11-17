/**
 * /llms-full.txt: every topic landing, one line each, ordered
 * grade -> track (ז, ח, ט רגילה, ט מצומצמת) -> catalog month or group -> topic.
 *
 * Header, grade hubs and blog are the /llms.txt sections (llmsTxt.ts). The
 * order is the worksheets catalog order through didacticSequence() in
 * noam-ai/site-companion/topic-order.js, the one order source Noam AI uses.
 * Do not keep a second list. Copy comes from page data; no new curriculum text.
 */
import { didacticSequence } from '../../../../noam-ai/site-companion/topic-order.js';
import { loadCatalog } from './catalog/loadCatalog';
import type { CatalogGrade, CatalogV1 } from './catalog/types';
import { link, llmsBlogLines, llmsHeaderLines, oneLine } from './llmsTxt';
import { REDIRECT_RULES } from './redirects';
import { loadAllTopicPages, type TopicPageContent } from './topicPages';

export const LLMS_FULL_TOPICS_HEADING = '## נושאים לפי כיתה, מסלול וסדר הקטלוג';
/** Group heading for a landing whose worksheet topic is not in the catalog order. */
export const LLMS_FULL_UNPLACED_GROUP = 'נושאים נוספים';

export interface LlmsFullGroup {
  key: string;
  label: string;
  pages: TopicPageContent[];
}

export interface LlmsFullTrack {
  grade: number;
  reduced: boolean;
  heading: string;
  /** Set on a reduced track: what the track is, and that only some regular topics are also in it. */
  note?: string;
  groups: LlmsFullGroup[];
}

interface Placement {
  page: TopicPageContent;
  reduced: boolean;
  groupKey: string;
  rank: number;
}

interface DidacticItem {
  grade: number;
  topicId: number;
  groupKey: string;
  index: number;
}

const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
/** Words that only say the sheets are free or downloadable; they are not scope. */
const PROMO_PHRASE = /בחינם|ללא הרשמה|חינמי|להורדה/;
/** Clause boundaries inside a sentence: a comma or semicolon, or a spaced dash. */
const CLAUSE_SEPARATOR = /(\s*[,;]\s+|\s+[—–-]\s+)/u;

/** Visible text without invisible direction marks, on one line. */
export function plainText(value: string): string {
  return String(value || '')
    .replace(BIDI_CONTROLS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The sentence without its promo clauses, or null when the promo is the
 * sentence itself. A clause that holds a promo phrase is dropped from its
 * last "ו…" word before the phrase ("…המשולש וקבלו רמז ללא הרשמה" keeps
 * "…המשולש"), or whole when no such word precedes it (", ללא הרשמה").
 * A promo in the opening clause ("דפי עבודה חינמיים ב…") means the sentence
 * is about the free sheets, so it is not kept. What remains must still be a
 * sentence of at least three words with no promo phrase.
 */
export function withoutPromoClauses(sentence: string): string | null {
  if (!PROMO_PHRASE.test(sentence)) return sentence;
  const end = /[.!?]$/u.exec(sentence)?.[0] ?? '';
  const parts = (end ? sentence.slice(0, -end.length) : sentence).split(CLAUSE_SEPARATOR);
  const kept: string[] = [];
  // split() with a capturing group alternates clause, separator, clause, ...
  for (let index = 0; index < parts.length; index += 2) {
    const clause = parts[index];
    const promo = PROMO_PHRASE.exec(clause);
    let keep = clause;
    if (promo) {
      const before = clause.slice(0, promo.index).trim().split(/\s+/u).filter(Boolean);
      let cut = -1;
      for (let word = before.length - 1; word >= 1; word -= 1) {
        if (/^ו\S/u.test(before[word])) {
          cut = word;
          break;
        }
      }
      if (cut === -1) {
        if (index === 0) return null;
        continue;
      }
      keep = before.slice(0, cut).join(' ');
    }
    if (kept.length) kept.push(parts[index - 1]);
    kept.push(keep);
  }
  const result = kept.join('').trim();
  if (PROMO_PHRASE.test(result) || result.split(/\s+/u).filter(Boolean).length < 3) return null;
  return `${result}${end}`;
}

/**
 * The first sentence of the page description that says what the topic covers:
 * the first sentence with no promo phrase; else the first one that is still a
 * sentence once its promo clauses are removed; else the first sentence.
 */
export function landingScopeSentence(description: string): string {
  const text = plainText(description);
  const sentences = text
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const scope =
    sentences.find((sentence) => !PROMO_PHRASE.test(sentence)) ??
    sentences.map(withoutPromoClauses).find((sentence): sentence is string => sentence != null) ??
    sentences[0] ??
    text;
  return oneLine(scope);
}

function servedLandings(): TopicPageContent[] {
  const redirected = new Set(REDIRECT_RULES.map((rule) => rule.from));
  return loadAllTopicPages().filter((page) => !redirected.has(page.path));
}

function primaryTopicId(page: TopicPageContent): number | null {
  const id = page.catalogCta?.catalogTopicId;
  if (typeof id === 'number' && Number.isInteger(id)) return id;
  const match = /[?&]topic=(\d+)/.exec(page.catalogCta?.href || '');
  return match ? Number(match[1]) : null;
}

function trackHeading(grade: CatalogGrade, reduced: boolean): string {
  const hasReduced = grade.groups.some((group) => group.reducedProgram);
  if (!hasReduced) return grade.label;
  return `${grade.label} ${reduced ? 'מצומצמת' : 'רגילה'}`;
}

/** Topic landings grouped by grade, track and catalog group, in catalog order. */
export function llmsFullTracks(catalog: CatalogV1 = loadCatalog()): LlmsFullTrack[] {
  const sequence = didacticSequence(catalog) as DidacticItem[];
  const rankOf = new Map<string, DidacticItem>();
  for (const item of sequence) rankOf.set(`${item.grade}:${item.topicId}`, item);

  const gradesByNumber = new Map(catalog.grades.map((grade) => [grade.grade, grade]));
  const placements: Placement[] = [];
  for (const page of servedLandings()) {
    const grade = gradesByNumber.get(page.grade);
    let topicId = primaryTopicId(page);
    const topic = grade?.topics.find((entry) => entry.id === topicId);
    if (topic && topic.parent != null) topicId = topic.parent;
    const item = topicId == null ? undefined : rankOf.get(`${page.grade}:${topicId}`);
    const group = item ? grade?.groups.find((entry) => entry.key === item.groupKey) : undefined;
    placements.push({
      page,
      reduced: Boolean(group?.reducedProgram),
      groupKey: group ? group.key : '',
      rank: item ? item.index : Number.MAX_SAFE_INTEGER,
    });
  }

  const tracks: LlmsFullTrack[] = [];
  const grades = [...new Set(placements.map((placement) => placement.page.grade))].sort((a, b) => a - b);
  for (const gradeNumber of grades) {
    const grade = gradesByNumber.get(gradeNumber);
    const inGrade = placements
      .filter((placement) => placement.page.grade === gradeNumber)
      .sort((a, b) => a.rank - b.rank || a.page.path.localeCompare(b.page.path));
    for (const reduced of [false, true]) {
      const inTrack = inGrade.filter((placement) => placement.reduced === reduced);
      if (!inTrack.length) continue;
      const groups: LlmsFullGroup[] = [];
      for (const group of grade?.groups || []) {
        if (group.reducedProgram !== reduced) continue;
        const pages = inTrack.filter((placement) => placement.groupKey === group.key).map((p) => p.page);
        if (pages.length) groups.push({ key: group.key, label: group.label, pages });
      }
      const unplaced = inTrack.filter((placement) => placement.groupKey === '').map((p) => p.page);
      if (unplaced.length) groups.push({ key: '', label: LLMS_FULL_UNPLACED_GROUP, pages: unplaced });
      tracks.push({
        grade: gradeNumber,
        reduced,
        heading: grade ? trackHeading(grade, reduced) : `כיתה ${gradeNumber}`,
        ...(reduced && grade
          ? {
              // The track description is the site's own wording (WorksheetsClient.tsx tracknote).
              note: `כאן מופיעים רק נושאי הקטלוג שסומנו למסלול המצומצם (מסלול נפרד לקראת 3 יח״ל, לפי פריסת תשפ״ז). חלק מהנושאים של ${trackHeading(grade, false)} שלמעלה נלמדים גם במסלול המצומצם.`,
            }
          : {}),
        groups,
      });
    }
  }
  return tracks;
}

export function llmsFullLandingLine(page: TopicPageContent): string {
  return `- ${link(plainText(page.h1), page.path)}: ${landingScopeSentence(page.description)}`;
}

export function renderLlmsFullTxt(): string {
  const lines: string[] = llmsHeaderLines();
  lines.push(
    '',
    LLMS_FULL_TOPICS_HEADING,
    '',
    '> כל דף נושא מופיע פעם אחת, בסדר קטלוג דפי העבודה באתר: כיתה, מסלול, ואז חודש או תחום. בכל שורה: שם הדף, כתובת ומשפט אחד מתיאור הדף.',
  );
  for (const track of llmsFullTracks()) {
    lines.push('', `### ${track.heading}`);
    if (track.note) lines.push('', `> ${track.note}`);
    for (const group of track.groups) {
      lines.push('', `#### ${group.label}`);
      for (const page of group.pages) lines.push(llmsFullLandingLine(page));
    }
  }
  lines.push('', ...llmsBlogLines());
  lines.push('');
  return lines.join('\n');
}
