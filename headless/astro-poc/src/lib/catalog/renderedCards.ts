import type { CatalogGrade } from './types';

export type RenderTrack = 'reg' | 'red';

/**
 * Topics that render as their own cards.
 * Child topics stay inside the parent card.
 * Grade 9 reduced-program groups render only on the reduced track.
 */
export function countRenderedTopicCards(grade: CatalogGrade, track: RenderTrack = 'reg'): number {
  const reduced = new Set(grade.groups.filter((group) => group.reducedProgram).map((group) => group.key));
  return grade.topics.filter((topic) => {
    if (topic.parent !== undefined) return false;
    if (grade.grade !== 9) return true;
    const isReduced = reduced.has(topic.group);
    return track === 'red' ? isReduced : !isReduced;
  }).length;
}
