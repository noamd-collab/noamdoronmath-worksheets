/**
 * Games coverage: every game names the catalog topics it teaches, and the
 * middle-school coverage map is built from those names.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { catalogLandingCoverage } from '../src/lib/catalogLandingCoverage.ts';
import { ALL_GAMES, ENGINE_GAMES } from '../src/lib/eliyahuGames.ts';
import {
  MIDDLE_SCHOOL_GRADES,
  gamesForTopic,
  gradeGameCoverage,
  middleSchoolGameCoverage,
  topicGameCoverage,
} from '../src/lib/gameCoverage.ts';

const catalog = loadCatalog();
const topicIds = new Map(catalog.grades.map((g) => [g.grade, new Set(g.topics.map((t) => t.id))]));

/** Topic-page slug → the catalog topics whose worksheets it links. */
function pageTopics(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const grade of catalog.grades.map((g) => g.grade)) {
    for (const row of catalogLandingCoverage(grade)) {
      for (const slug of row.slugs) {
        if (!out.has(slug)) out.set(slug, new Set());
        out.get(slug)!.add(`${grade}-${row.topicId}`);
      }
    }
  }
  return out;
}

describe('games coverage', () => {
  it('every game names at least one real catalog topic, once', () => {
    for (const game of ALL_GAMES) {
      assert.ok(game.topics.length > 0, game.slug);
      const keys = game.topics.map((ref) => `${ref.grade}-${ref.topic}`);
      assert.equal(new Set(keys).size, keys.length, `${game.slug} repeats a topic`);
      for (const ref of game.topics) {
        assert.ok(topicIds.get(ref.grade)?.has(ref.topic), `${game.slug}: no catalog topic ${ref.grade}/${ref.topic}`);
        assert.ok(ref.coverage === 'full' || ref.coverage === 'partial', game.slug);
      }
    }
  });

  it('every game links a topic page of one of its topics', () => {
    const byPage = pageTopics();
    for (const game of ALL_GAMES) {
      const keys = new Set(game.topics.map((ref) => `${ref.grade}-${ref.topic}`));
      const linked = game.links.some((link) => {
        const topics = byPage.get(link.href.replace(/^\//, ''));
        return topics ? [...topics].some((key) => keys.has(key)) : false;
      });
      assert.ok(linked, `${game.slug}: no link reaches a page of its topics`);
    }
  });

  it('a full topic is full, a partial one partial, and an untaught one none', () => {
    const full = ENGINE_GAMES.flatMap((game) => game.topics).find((ref) => ref.coverage === 'full');
    assert.ok(full, 'at least one game covers a topic fully');
    assert.equal(topicGameCoverage(full!.grade, full!.topic), 'full');
    assert.ok(gamesForTopic(full!.grade, full!.topic).length > 0);

    const fake = { ...ENGINE_GAMES[0], slug: 'fake', topics: [{ grade: 7, topic: 1, coverage: 'partial' as const }] };
    assert.equal(topicGameCoverage(7, 1, [fake]), 'partial');
    assert.equal(topicGameCoverage(7, 2, [fake]), 'none');
    assert.deepEqual(gamesForTopic(7, 1, [fake]).map((game) => game.slug), ['fake']);
  });

  it('the middle-school summary counts every catalog topic exactly once', () => {
    const summary = middleSchoolGameCoverage();
    assert.deepEqual(summary.map((row) => row.grade), [...MIDDLE_SCHOOL_GRADES]);
    for (const row of summary) {
      assert.equal(row.topics, topicIds.get(row.grade)!.size, `grade ${row.grade}`);
      assert.equal(row.full + row.partial + row.none, row.topics, `grade ${row.grade}`);
      const rows = gradeGameCoverage(row.grade);
      assert.equal(rows.filter((r) => r.coverage !== 'none').length, row.full + row.partial);
      for (const r of rows) assert.equal(r.coverage === 'none', r.games.length === 0, `${row.grade}/${r.topicId}`);
    }
  });
});
