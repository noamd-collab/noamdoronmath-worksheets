/**
 * Which catalog topics have an Eliyahu game.
 *
 * Each game lists the catalog topics it teaches (`topics` in eliyahuGames.ts).
 * A topic is `full` when at least one game marks it full, `partial` when games
 * only teach one route through it, and `none` when no game teaches it yet.
 * The goal for the middle school (grades 7–9) is a game for every topic.
 *
 * The map is a maths map: a game with another `subject` appears here only if it
 * names a topic it genuinely teaches, and otherwise stays outside the map.
 */
import { loadCatalog } from './catalog/loadCatalog';
import { ALL_GAMES, type EliyahuGame } from './eliyahuGames';

export const MIDDLE_SCHOOL_GRADES = [7, 8, 9] as const;

export type GameCoverageLevel = 'none' | 'partial' | 'full';

export interface TopicGameCoverage {
  grade: number;
  topicId: number;
  title: string;
  coverage: GameCoverageLevel;
  /** Slugs of the games that teach this topic, in corner order. */
  games: string[];
}

export interface GradeGameCoverageSummary {
  grade: number;
  topics: number;
  full: number;
  partial: number;
  none: number;
}

/** Games that teach catalog topic `topic` of grade `grade`. */
export function gamesForTopic(grade: number, topic: number, games: EliyahuGame[] = ALL_GAMES): EliyahuGame[] {
  return games.filter((game) => game.topics.some((ref) => ref.grade === grade && ref.topic === topic));
}

/** The best coverage any game gives a topic. */
export function topicGameCoverage(grade: number, topic: number, games: EliyahuGame[] = ALL_GAMES): GameCoverageLevel {
  const refs = games.flatMap((game) => game.topics.filter((ref) => ref.grade === grade && ref.topic === topic));
  if (refs.some((ref) => ref.coverage === 'full')) return 'full';
  return refs.length > 0 ? 'partial' : 'none';
}

/** One row per catalog topic of the grade, in catalog order. */
export function gradeGameCoverage(grade: number, games: EliyahuGame[] = ALL_GAMES): TopicGameCoverage[] {
  const catalogGrade = loadCatalog().grades.find((g) => g.grade === grade);
  if (!catalogGrade) throw new Error(`No catalog grade ${grade}`);
  return catalogGrade.topics.map((topic) => ({
    grade,
    topicId: topic.id,
    title: topic.title,
    coverage: topicGameCoverage(grade, topic.id, games),
    games: gamesForTopic(grade, topic.id, games).map((game) => game.slug),
  }));
}

/** Counts of full, partial and uncovered topics for each middle-school grade. */
export function middleSchoolGameCoverage(games: EliyahuGame[] = ALL_GAMES): GradeGameCoverageSummary[] {
  return MIDDLE_SCHOOL_GRADES.map((grade) => {
    const rows = gradeGameCoverage(grade, games);
    return {
      grade,
      topics: rows.length,
      full: rows.filter((row) => row.coverage === 'full').length,
      partial: rows.filter((row) => row.coverage === 'partial').length,
      none: rows.filter((row) => row.coverage === 'none').length,
    };
  });
}

/** Cross-curricular games that name no maths topic, so they stay outside the map. */
export function gamesOutsideMathsMap(games: EliyahuGame[] = ALL_GAMES): EliyahuGame[] {
  return games.filter((game) => game.subject !== undefined && game.subject !== 'מתמטיקה' && game.topics.length === 0);
}
