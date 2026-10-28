/**
 * Grade 7 PDF v2: reviewed replacements and the G7-T16 level-a card
 * are on the live catalog, with a Noam AI manifest for each new media id.
 * Teacher-page copies of the old ids stay until the post-PR-95 rebuild.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pairs = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/g7-pdf-v2-replace.json'), 'utf8')
) as Array<{ package_id: string; level: string; old_media_id: string | null; new_media_id: string }>;

describe('grade 7 PDF v2 replacements', () => {
  const catalog = loadCatalog();
  const text = readFileSync(join(root, 'src/data/catalog.v1.json'), 'utf8');

  it('puts every reviewed new media id in the catalog and drops replaced ids', () => {
    assert.equal(pairs.length, 127);
    for (const row of pairs) {
      assert.ok(text.includes(row.new_media_id), `${row.package_id} ${row.level} missing ${row.new_media_id}`);
      if (row.old_media_id) {
        assert.equal(text.includes(row.old_media_id), false, `${row.package_id} ${row.level} still has ${row.old_media_id}`);
      }
    }
  });

  it('shows G7-T16 as level a with an AI hint', () => {
    const grade = catalog.grades.find((entry) => entry.grade === 7);
    assert.ok(grade);
    const topic = grade.topics.find((entry) => entry.noamTopicId === 'G7-T16');
    assert.ok(topic);
    assert.equal(topic.title, 'משולש שווה־צלעות — העמקה ורשות');
    assert.equal(topic.levels.length, 1);
    assert.equal(topic.levels[0].key, 'a');
    assert.equal(topic.levels[0].label, 'העמקה ורשות');
    assert.equal(topic.levels[0].pdfId, '2462413929e84600b5e47e24ca1340c1');
    assert.equal(topic.routing.aiHintShown, true);
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
});
