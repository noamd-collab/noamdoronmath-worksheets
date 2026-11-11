import { loadCatalog } from './catalog/loadCatalog';
import type { CatalogLevel, CatalogV1 } from './catalog/types';

export type TeacherLandingLevel = 'a' | 'b' | 'c' | 'all';
export interface TeacherLandingScope {
  grade: number;
  topic: number;
  level: TeacherLandingLevel;
  edition: string;
}
export interface TeacherLandingLevelChoice {
  value: TeacherLandingLevel;
  label: string;
  pdfIds: string[];
  teacherPath: string;
}
export interface TeacherLandingEdition {
  id: string;
  label: string;
  isDefault: boolean;
  levels: TeacherLandingLevelChoice[];
}
export interface TeacherLandingTopic {
  id: number;
  title: string;
  defaultEditionId: string;
  defaultLevel: TeacherLandingLevel;
  editions: TeacherLandingEdition[];
}
export interface TeacherLandingCatalog {
  defaultScope: TeacherLandingScope;
  defaultTeacherPath: string;
  grades: { grade: number; label: string; topics: TeacherLandingTopic[] }[];
  counts: {
    grades: number;
    topics: number;
    catalogEntries: number;
    uniquePdfIds: number;
    validScopes: number;
    topicsWithPublishedDefaultEdition: number;
  };
}

const FAMILY_LABELS = { a: 'רמה א׳', b: 'רמה ב׳', c: 'מצוינות' } as const;

function teacherPath(scope: TeacherLandingScope): string {
  const params = new URLSearchParams({
    grade: String(scope.grade), topic: String(scope.topic),
    level: scope.level, edition: scope.edition,
  });
  return '/teachers/app?' + params;
}

function levelChoices(grade: number, topic: number, edition: string, source: CatalogLevel[]): TeacherLandingLevelChoice[] {
  const families = (['a', 'b', 'c'] as const).filter(value =>
    source.some(level => level.key === value || (value === 'c' && level.key === 'c2')));
  const values: TeacherLandingLevel[] = [...families, 'all'];
  return values.map(value => ({
    value,
    label: value === 'all'
      ? (!families.length && source.length === 1 ? source[0].label : 'כל הרמות')
      : FAMILY_LABELS[value],
    pdfIds: [...new Set(source.filter(level => value === 'all' || level.key === value ||
      (value === 'c' && level.key === 'c2')).map(level => level.pdfId))],
    teacherPath: teacherPath({ grade, topic, level: value, edition }),
  }));
}

/**
 * Project the same canonical levels/editions used by buildTeacherCatalog.
 * loadCatalog already merges/validates the publication registry and is shared
 * by existing SSR pages. Do not import the additional 292 KB public teacher
 * snapshot into the worker; tests compare this projection with that snapshot.
 */
export function buildTeacherLandingCatalog(catalog: Pick<CatalogV1, 'grades'>): TeacherLandingCatalog {
  let catalogEntries = 0;
  const pdfIds = new Set<string>();
  const grades = catalog.grades.map(grade => ({
    grade: grade.grade,
    label: grade.label,
    topics: grade.topics.map(topic => {
      const sources = [
        { id: 'legacy', label: 'דפים קודמים', levels: topic.levels },
        ...(topic.editions || []).filter(edition => edition.status === 'published').map(edition => ({
          id: edition.editionId, label: edition.label, levels: edition.levels,
        })),
      ];
      if (sources.some(source => !source.levels.length)) throw new Error('Empty teacher source: ' + grade.grade + ':' + topic.id);
      const allLevels = sources.flatMap(source => source.levels);
      catalogEntries += allLevels.length;
      allLevels.forEach(level => pdfIds.add(level.pdfId));
      const canonicalDefault = topic.defaultEditionId || 'legacy';
      if (!sources.some(source => source.id === canonicalDefault)) throw new Error('Unavailable teacher default edition: ' + canonicalDefault);
      // The existing tool normalizes a single available edition to "all".
      const defaultEditionId = sources.length === 1 ? 'all' : canonicalDefault;
      const choices = sources.length === 1
        ? [{ id: 'all', label: 'הדפים הקיימים', levels: allLevels }]
        : [{ id: 'all', label: 'כל המהדורות', levels: allLevels }, ...sources];
      const editions = choices.map(edition => ({
        id: edition.id,
        label: edition.label,
        isDefault: edition.id === defaultEditionId,
        levels: levelChoices(grade.grade, topic.id, edition.id, edition.levels),
      }));
      const selected = editions.find(edition => edition.isDefault)!;
      return { id: topic.id, title: topic.title, defaultEditionId,
        defaultLevel: selected.levels[0].value, editions };
    }),
  }));
  // Start beside the real division preview when available; no edition ID is
  // frozen here. A future catalog can remove that topic without breaking entry.
  const sampleGrade = grades.find(grade => grade.grade === 3 && grade.topics.some(topic => topic.id === 10));
  const firstGrade = sampleGrade || grades.find(grade => grade.topics.length);
  if (!firstGrade) throw new Error('No teacher landing topics');
  const firstTopic = sampleGrade ? firstGrade.topics.find(topic => topic.id === 10)! : firstGrade.topics[0];
  const defaultScope = { grade: firstGrade.grade, topic: firstTopic.id,
    level: firstTopic.defaultLevel, edition: firstTopic.defaultEditionId };
  const topics = grades.flatMap(grade => grade.topics);
  return { defaultScope, defaultTeacherPath: teacherPath(defaultScope), grades,
    counts: {
      grades: grades.length, topics: topics.length, catalogEntries, uniquePdfIds: pdfIds.size,
      validScopes: topics.reduce((sum, topic) => sum + topic.editions.reduce((n, edition) => n + edition.levels.length, 0), 0),
      topicsWithPublishedDefaultEdition: topics.filter(topic => !['all', 'legacy'].includes(topic.defaultEditionId)).length,
    } };
}

let cached: TeacherLandingCatalog | undefined;
export function getTeacherLandingCatalog(): TeacherLandingCatalog {
  return cached ??= buildTeacherLandingCatalog(loadCatalog());
}

/** An explicit unavailable edition/level is rejected, never silently replaced. */
export function getTeacherLandingScope(
  input: { grade: number | string; topic: number | string; level?: string; edition?: string },
  catalog: TeacherLandingCatalog = getTeacherLandingCatalog(),
): (TeacherLandingScope & { teacherPath: string; pdfIds: string[] }) | null {
  if (!/^[1-9]$/.test(String(input.grade)) || !/^\d{1,6}$/.test(String(input.topic))) return null;
  const grade = catalog.grades.find(row => row.grade === Number(input.grade));
  const topic = grade?.topics.find(row => row.id === Number(input.topic));
  if (!grade || !topic) return null;
  const edition = topic.editions.find(row => row.id === (input.edition ?? topic.defaultEditionId));
  if (!edition) return null;
  const level = edition.levels.find(row => row.value === (input.level ?? edition.levels[0].value));
  if (!level) return null;
  return { grade: grade.grade, topic: topic.id, level: level.value, edition: edition.id,
    teacherPath: level.teacherPath, pdfIds: level.pdfIds.slice() };
}

/** Minimal inline picker data: default editions only, no PDF IDs or repeated URLs. */
export function getTeacherLandingPickerData(catalog: TeacherLandingCatalog = getTeacherLandingCatalog()) {
  return {
    defaultScope: { ...catalog.defaultScope },
    defaultTeacherPath: catalog.defaultTeacherPath,
    grades: catalog.grades.map(grade => ({
      grade: grade.grade, label: grade.label,
      topics: grade.topics.map(topic => {
        const edition = topic.editions.find(row => row.isDefault)!;
        return { id: topic.id, title: topic.title, edition: { id: edition.id, label: edition.label },
          defaultLevel: topic.defaultLevel, levels: edition.levels.map(level => ({ value: level.value, label: level.label })) };
      }),
    })),
  };
}
