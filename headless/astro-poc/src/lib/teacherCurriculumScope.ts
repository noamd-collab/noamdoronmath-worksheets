/** Data-only teaching scope. Catalog inclusion never grants a rendering capability.
 * The exact asset path and expected hash come from reviewed caller configuration,
 * not from intake/model data. Reading bytes is injected so Wix needs no node:fs.
 */
import { parseTeacherGenerationCurriculum, type TeacherGenerationTopic } from './teacherGenerationContract';

const MAX_CATALOG_BYTES = 100_000;
export class CurriculumScopeError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'CurriculumScopeError'; }
}
const fail = (code: string): never => { throw new CurriculumScopeError(code); };
export interface CurriculumScopeBoundary {
  version: 1;
  kind: 'curriculum_scope';
  curriculumSha256: string;
  conceptIds: string[];
}
export interface CurriculumScopeConcept { readonly id: string; readonly text: string }
export interface CurriculumScopeTopic extends Omit<TeacherGenerationTopic, 'allowedConcepts' | 'notYetConcepts'> {
  readonly concepts: readonly CurriculumScopeConcept[];
  readonly forbiddenConcepts: readonly string[];
  readonly levels: readonly ('b' | 'a' | 'e')[];
}
export interface CurriculumScopeCatalog {
  readonly sha256: string;
  readonly topics: readonly CurriculumScopeTopic[];
  readonly sources: ReturnType<typeof parseTeacherGenerationCurriculum>['sources'];
  readonly provenanceNote: string;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export async function loadTeacherCurriculumScope(
  projectionPath: string,
  expectedSha256: string,
  readBytes: (exactPath: string) => Promise<Uint8Array> | Uint8Array,
): Promise<CurriculumScopeCatalog> {
  if (typeof expectedSha256 !== 'string' || expectedSha256.length !== 64 || !/^[a-f0-9]{64}$/.test(expectedSha256)) fail('INVALID_CURRICULUM_PIN');
  if (typeof projectionPath !== 'string' || !projectionPath) fail('CURRICULUM_READ_FAILED');
  let bytes: Uint8Array;
  try { bytes = await readBytes(projectionPath); } catch { return fail('CURRICULUM_READ_FAILED'); }
  if (!(bytes instanceof Uint8Array)) fail('CURRICULUM_READ_FAILED');
  if (bytes.byteLength > MAX_CATALOG_BYTES) fail('CURRICULUM_SIZE');
  // Own the bytes across the asynchronous hash operation; the injected reader
  // cannot mutate a shared buffer between verification and decoding.
  const snapshot = new Uint8Array(bytes);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', snapshot)), n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== expectedSha256) fail('CURRICULUM_HASH_MISMATCH');
  try {
    const curriculum = parseTeacherGenerationCurriculum(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(snapshot)));
    const topics = curriculum.topics.map(topic => {
      if (!topic.allowedConcepts.length || topic.topicId !== topic.topicId.trim()) fail('INVALID_CURRICULUM');
      const prefix = topic.topicId.split(':')[0];
      const forbidden = topic.skillId === 'elementary'
        ? [...curriculum.elementaryForbiddenAll, ...curriculum.elementaryForbiddenByGrade[topic.sourceTrack], ...topic.notYetConcepts]
        : [...curriculum.middleExcludedByTrack[prefix], ...topic.notYetConcepts];
      const { allowedConcepts, notYetConcepts: _notYet, ...identity } = topic;
      const levels: ('b' | 'a' | 'e')[] = prefix === 'g9m' ? ['b'] : prefix === 'g9r' ? ['a', 'e'] : ['b', 'a', 'e'];
      return Object.freeze({ ...identity,
        concepts: Object.freeze(allowedConcepts.map((text, index) => Object.freeze({ id: `${topic.topicId}#${index}`, text }))),
        forbiddenConcepts: Object.freeze([...new Set(forbidden)]), levels: Object.freeze(levels),
      });
    });
    return Object.freeze({ sha256: hash, topics: Object.freeze(topics), sources: curriculum.sources,
      provenanceNote: curriculum.provenanceNote });
  } catch { return fail('INVALID_CURRICULUM'); }
}

/** Resolve the declared selection from the pinned source. Authored questions
 * still require independent content/math/rendering checks against this scope.
 */
export function validateTeacherCurriculumScope(catalog: CurriculumScopeCatalog,
  gradeNumber: unknown, topicId: unknown, boundary: unknown) {
  if (typeof gradeNumber !== 'number' || !Number.isInteger(gradeNumber) || gradeNumber < 1 || gradeNumber > 9) fail('INVALID_GRADE');
  const topic = catalog.topics.find(row => row.topicId === topicId);
  if (!topic) return fail('UNKNOWN_TOPIC');
  if (topic.gradeNumber !== gradeNumber) fail('GRADE_TOPIC_MISMATCH');
  if (!record(boundary) || Object.keys(boundary).sort().join(',') !== 'conceptIds,curriculumSha256,kind,version'
      || boundary.version !== 1 || boundary.kind !== 'curriculum_scope') return fail('INVALID_CURRICULUM_SCOPE');
  if (boundary.curriculumSha256 !== catalog.sha256) fail('CURRICULUM_SCOPE_HASH_MISMATCH');
  const ids = boundary.conceptIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > topic.concepts.length
      || !ids.every(id => typeof id === 'string') || new Set(ids).size !== ids.length) return fail('INVALID_CONCEPT_SELECTION');
  const known = new Set(topic.concepts.map(row => row.id));
  if (ids.some(id => !known.has(id))) fail('UNKNOWN_CONCEPT');
  const selected = new Set(ids), selectedConcepts = topic.concepts.filter(row => selected.has(row.id));
  const { concepts: _concepts, forbiddenConcepts, levels, ...identity } = topic;
  return {
    boundary: { version: 1, kind: 'curriculum_scope', curriculumSha256: catalog.sha256,
      conceptIds: selectedConcepts.map(row => row.id) } as CurriculumScopeBoundary,
    topic: { ...identity }, selectedConcepts: selectedConcepts.map(row => ({ ...row })),
    excludedConcepts: topic.concepts.filter(row => !selected.has(row.id)).map(row => ({ ...row })),
    forbiddenConcepts: [...forbiddenConcepts], levels: [...levels],
    source: structuredClone(catalog.sources[topic.skillId]),
    curriculum: { sha256: catalog.sha256, officialCalendarVerified: false as const, provenanceNote: catalog.provenanceNote },
  };
}
