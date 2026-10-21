/**
 * Grade 9 PDF v2: reviewed replacements are on the live catalog.
 * Duplicate grade-7 cards stay on their old ids (listed in the PR, not here).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { countRenderedTopicCards } from '../src/lib/catalog/renderedCards';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pairs = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/g9-pdf-v2-replace.json'), 'utf8')
) as Array<{ package_id: string; level: string; old_media_id: string; new_media_id: string }>;

describe('grade 9 PDF v2 replacements', () => {
  const catalog = loadCatalog();
  const text = readFileSync(join(root, 'src/data/catalog.v1.json'), 'utf8');

  it('puts every reviewed new media id in the catalog and drops the old id', () => {
    assert.equal(pairs.length, 56);
    for (const row of pairs) {
      assert.ok(text.includes(row.new_media_id), `${row.package_id} ${row.level} missing ${row.new_media_id}`);
      assert.equal(text.includes(row.old_media_id), false, `${row.package_id} ${row.level} still has ${row.old_media_id}`);
    }
  });

  it('keeps G9-T19 level b and the isosceles title, and adds the kite subtitle', () => {
    const grade = catalog.grades.find((entry) => entry.grade === 9);
    assert.ok(grade);
    const topic = grade.topics.find((entry) => entry.noamTopicId === 'G9-T15');
    assert.ok(topic);
    assert.equal(topic.title, 'משולש שווה שוקיים');
    assert.match(topic.description || '', /הקדמה לדלתון/);
    assert.match(catalog.searchTerms['9']['4'], /דלתון/);
    assert.match(catalog.searchTerms['9']['4'], /kite/);
    const rhombus = grade.topics.find((entry) => entry.noamTopicId === 'G9-T19');
    assert.ok(rhombus);
    assert.equal(
      rhombus.levels.find((level) => level.key === 'b')?.pdfId,
      'e091562d859a4059abca94dfddc17bfa'
    );
  });

  it('publishes a Noam AI manifest for every new media id', () => {
    const provenance = JSON.parse(
      readFileSync(join(root, 'public/noam-ai/sync-provenance.json'), 'utf8')
    );
    for (const row of pairs) {
      const pub = join(root, 'public/noam-ai/manifests', row.new_media_id + '.json');
      assert.equal(existsSync(pub), true, row.new_media_id);
      const manifest = JSON.parse(readFileSync(pub, 'utf8'));
      assert.equal(manifest.pdfHash, row.new_media_id);
      assert.equal(manifest.schemaVersion, 2);
      assert.ok(manifest.exercises.length > 0, row.package_id + ' ' + row.level);
      assert.equal(manifest.reviewRequired, false);
      assert.ok(provenance.files[row.new_media_id], 'provenance ' + row.new_media_id);
    }
  });

  it('counts rendered cards, not hidden children or the other grade 9 track', () => {
    const grade9 = catalog.grades.find((entry) => entry.grade === 9);
    assert.ok(grade9);
    assert.equal(countRenderedTopicCards(grade9, 'reg'), 38);
    assert.equal(countRenderedTopicCards(grade9, 'red'), 4);
    for (const grade of catalog.grades) {
      if (grade.grade === 9) continue;
      const topLevel = grade.topics.filter((topic) => topic.parent === undefined).length;
      assert.equal(countRenderedTopicCards(grade, 'reg'), topLevel, `grade ${grade.grade}`);
    }
  });
});
