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

export const LLMS_FULL_TOPICS_HEADING = '## נושאים לפי כיתה, מסלול וסדר הלימוד';
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
  /** Set on a reduced track: its grade's regular pages are shared by both tracks. */
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

const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;
/** Sentences that only say the sheets are free or downloadable are not scope. */
const PROMO_SENTENCE = /בחינם|ללא הרשמה|חינמי|להורדה/;

/** Visible text without invisible direction marks, on one line. */
export function plainText(value: string): string {
  return String(value || '')
    .replace(BIDI_CONTROLS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first sentence of the page description that says what the topic covers. */
export function landingScopeSentence(description: string): string {
  const text = plainText(description);
  const sentences = text
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const scope = sentences.find((sentence) => !PROMO_SENTENCE.test(sentence)) ?? sentences[0] ?? text;
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
              note: `כאן מופיעים רק נושאי הקטלוג שסומנו למסלול המצומצם. דפי ${trackHeading(grade, false)} שלמעלה משמשים גם את המסלול המצומצם.`,
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
