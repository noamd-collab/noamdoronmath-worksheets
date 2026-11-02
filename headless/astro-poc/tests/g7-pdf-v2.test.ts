/**
 * Grade 7 PDF v2: reviewed replacements and the G7-T16 level-a card
 * remain preserved in historical manifests and migrate to active catalog releases.
 * Archived teacher-page data stays available for saved selections.
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
  const migrations = JSON.parse(readFileSync(join(root, 'public/noam-ai/catalog-migrations.json'), 'utf8')).byPdf;

  it('preserves each reviewed v2 identity through its declared active replacement', () => {
    assert.equal(pairs.length, 127);
    for (const row of pairs) {
      const migration = migrations[row.new_media_id];
      const targetPdf = migration?.pdfId || row.new_media_id;
      const grade = catalog.grades.find((entry) => entry.grade === 7)!;
      const topic = grade.topics.find((entry) => migration
        ? entry.id === migration.topicId
        : entry.noamTopicId === row.package_id);
      assert.ok(topic, row.package_id + ' ' + row.level);
      const level = topic.levels.find((entry) => entry.pdfId === targetPdf);
      assert.ok(level, `${row.package_id} ${row.level} missing active ${targetPdf}`);
      if (migration) {
        assert.deepEqual(migration.original, { prefix: row.package_id, grade: 7, level: row.level === 'one' ? 'b' : row.level });
        assert.equal(migration.grade, topic.routing.sourceGrade || 7);
        assert.equal(migration.prefix, topic.routing.sourcePrefix || topic.routing.resolvedNoamPrefix);
        assert.equal(migration.level, level.viewerLevel || (level.key === 'one' ? 'b' : level.key));
        assert.deepEqual(migration.siblings, topic.routing.siblingPdfQuery);
      } else {
        assert.equal(level.key, row.level);
      }
      if (row.old_media_id) {
        assert.equal(text.includes(row.old_media_id), false, `${row.package_id} ${row.level} still has ${row.old_media_id}`);
      }
    }
  });

  it('shows the native G7-T16 single worksheet with its explicit viewer level and AI hint', () => {
    const grade = catalog.grades.find((entry) => entry.grade === 7);
    assert.ok(grade);
    const topic = grade.topics.find((entry) => entry.noamTopicId === 'G7-T16');
    assert.ok(topic);
    assert.equal(topic.title, 'משולש שווה־צלעות — העמקה ורשות');
    assert.equal(topic.levels.length, 1);
    assert.equal(topic.levels[0].key, 'one');
    assert.equal(topic.levels[0].viewerLevel, 'one');
    assert.equal(topic.levels[0].label, 'העמקה ורשות');
    assert.equal(topic.levels[0].pdfId, migrations['204e16c7ea444016ae8725f38a9b1f37']?.pdfId ?? '204e16c7ea444016ae8725f38a9b1f37');
    assert.equal(topic.routing.aiHintShown, true);
  });

  it('keeps reviewed v2 manifests and publishes their active replacement manifests', () => {
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
      const migration = migrations[row.new_media_id];
      const targetPdf = migration?.pdfId || row.new_media_id;
      assert.ok(provenance.files[targetPdf], 'active provenance ' + targetPdf);
      const active = JSON.parse(readFileSync(join(root, 'public/noam-ai/manifests', targetPdf + '.json'), 'utf8'));
      assert.equal(active.pdfHash, targetPdf);
      assert.equal(active.schemaVersion, 2);
      assert.equal(active.prefix, migration?.prefix || row.package_id);
      assert.equal(active.grade, migration?.grade || 7);
      assert.equal(active.level, migration?.level || row.level);
      assert.ok(active.exercises.length > 0, targetPdf);

    }
  });
});
