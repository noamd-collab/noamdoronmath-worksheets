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
  gamesOutsideMathsMap,
  gradeGameCoverage,
  middleSchoolGameCoverage,
  topicGameCoverage,
} from '../src/lib/gameCoverage.ts';

const catalog = loadCatalog();
const topicIds = new Map(catalog.grades.map((g) => [g.grade, new Set(g.topics.map((t) => t.id))]));

/**
 * A game counts as a maths game unless it declares another subject. Only maths
 * games must name catalog topics; a cross-curricular game may name one when it
 * genuinely teaches it (and is then checked like any other), or name none.
 */
function isMathsGame(game: { subject?: string }): boolean {
  return !game.subject || game.subject === 'מתמטיקה';
}

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
      if (isMathsGame(game)) assert.ok(game.topics.length > 0, game.slug);
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
      if (game.topics.length === 0) continue;
      const keys = new Set(game.topics.map((ref) => `${ref.grade}-${ref.topic}`));
      const linked = game.links.some((link) => {
        const topics = byPage.get(link.href.replace(/^\//, ''));
        return topics ? [...topics].some((key) => keys.has(key)) : false;
      });
      assert.ok(linked, `${game.slug}: no link reaches a page of its topics`);
    }
  });

  it('a cross-curricular game carries a subject badge and never claims maths', () => {
    for (const game of ALL_GAMES) {
      if (game.subject === undefined) continue;
      assert.ok(game.subject.trim().length > 0, `${game.slug}: empty subject`);
      if (isMathsGame(game)) assert.equal(game.subject, 'מתמטיקה', game.slug);
      else assert.notEqual(game.subject, 'מתמטיקה', game.slug);
    }
    const cross = ALL_GAMES.filter((game) => !isMathsGame(game));
    assert.ok(cross.length > 0, 'the corner lists at least one cross-curricular game');
    for (const game of cross) assert.ok(game.topics.length <= 1, `${game.slug} claims several maths topics`);
  });

  it('keeps cross-curricular games out of the maths coverage map', () => {
    const outside = gamesOutsideMathsMap();
    for (const game of outside) {
      assert.equal(game.topics.length, 0, game.slug);
      for (const grade of [3, 4, 5, 6, 7, 8, 9]) {
        const rows = gradeGameCoverage(grade);
        assert.equal(rows.some((row) => row.games.includes(game.slug)), false, `${game.slug} on grade ${grade}`);
      }
    }
    // kod-batzadim names one real topic, so it does appear in the map.
    const anchored = ALL_GAMES.find((game) => game.slug === 'kod-batzadim');
    assert.ok(anchored);
    assert.equal(gamesOutsideMathsMap().some((game) => game.slug === 'kod-batzadim'), false);
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
