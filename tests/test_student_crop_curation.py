"""Synthetic regression checks for the package-bound crop replay helper."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

HELPER = Path(__file__).resolve().parents[1] / 'scripts' / 'apply-student-crop-curation.py'
spec = importlib.util.spec_from_file_location('student_crop_curation', HELPER)
curation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(curation)


class StudentCropCurationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.before = {'page': 1, 'x': 0, 'y': 0.2, 'w': 1, 'h': 0.4}
        self.after = {'page': 1, 'x': 0, 'y': 0.1, 'w': 1, 'h': 0.5}
        self.record = {'schema': 'student-reviewed-crop-curation/1',
                       'package': 'G9-T40', 'grade': 9, 'topicId': 40, 'levels': []}
        for level, digit in [('a', 'a'), ('c', 'c')]:
            media = digit * 32
            source = digit * 64
            ident = 'synthetic-' + level
            manifest = {'prefix': 'G9-T40', 'grade': 9, 'topicId': 40,
                        'level': level, 'sourceSha256': source, 'pageCount': 1,
                        'reviewRequired': True, 'exercises': [{
                            'id': ident, 'q': 1, 'part': 'א',
                            'pin': {'page': 1, 'x': 0.8, 'y': 0.4},
                            'crop': self.before, 'crops': [self.before],
                            'text': 'Synthetic fixture only'}]}
            (self.directory / (media + '.json')).write_text(json.dumps(manifest))
            self.record['levels'].append({'level': level, 'mediaId': media,
                'studentSha256': source, 'operations': [{'q': 1,
                'itemIds': [ident], 'before': copy.deepcopy(self.before),
                'after': copy.deepcopy(self.after)}]})

    def bytes(self):
        return {p.name: p.read_bytes() for p in self.directory.iterdir()}

    def reject_atomically(self, record):
        original = self.bytes()
        with self.assertRaises(ValueError):
            curation.apply(record, self.directory)
        self.assertEqual(original, self.bytes())

    def test_valid_replay_preserves_other_fields_and_is_idempotent(self):
        original = {p.name: json.loads(p.read_text()) for p in self.directory.iterdir()}
        self.assertEqual(curation.apply(self.record, self.directory), 2)
        once = self.bytes()
        self.assertEqual(curation.apply(self.record, self.directory, check=True), 2)
        self.assertEqual(curation.apply(self.record, self.directory), 2)
        self.assertEqual(once, self.bytes())
        for p in self.directory.iterdir():
            result = json.loads(p.read_text())
            expected = original[p.name]
            for exercise in expected['exercises']:
                exercise['crop'] = self.after
                exercise['crops'] = [self.after]
            self.assertEqual(result, expected)

    def test_wrong_second_source_hash_causes_no_partial_write(self):
        self.record['levels'][1]['studentSha256'] = '0' * 64
        self.reject_atomically(self.record)

    def test_wrong_exact_item_id_causes_no_partial_write(self):
        self.record['levels'][1]['operations'][0]['itemIds'] = ['other-item']
        self.reject_atomically(self.record)

    def test_changed_bottom_causes_no_partial_write(self):
        self.record['levels'][1]['operations'][0]['after']['h'] = 0.7
        self.reject_atomically(self.record)

    def test_nonfinite_rectangle_causes_no_partial_write(self):
        self.record['levels'][1]['operations'][0]['after']['y'] = float('nan')
        self.reject_atomically(self.record)


class StudentCropCrossPageRepairTests(unittest.TestCase):
    """Schema 2: foreign-slice removal and continuation bottom trim."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.owned = {'page': 1, 'x': 0, 'y': 0.2, 'w': 1, 'h': 0.4}
        self.foreign = {'page': 2, 'x': 0, 'y': 0.05, 'w': 1, 'h': 0.05}
        self.tail = {'page': 2, 'x': 0, 'y': 0.05, 'w': 1, 'h': 0.3}
        self.tail_trimmed = {'page': 2, 'x': 0, 'y': 0.05, 'w': 1, 'h': 0.25}
        exercises = [
            {'id': 'q1a', 'q': 1, 'part': 'א', 'pin': {'page': 1, 'x': 0.8, 'y': 0.3},
             'crop': copy.deepcopy(self.owned), 'crops': [copy.deepcopy(self.owned), copy.deepcopy(self.foreign)]},
            {'id': 'q1b', 'q': 1, 'part': 'ב', 'pin': {'page': 1, 'x': 0.8, 'y': 0.5},
             'crop': copy.deepcopy(self.owned), 'crops': [copy.deepcopy(self.owned), copy.deepcopy(self.foreign)]},
            {'id': 'q2a', 'q': 2, 'part': 'א', 'pin': {'page': 1, 'x': 0.8, 'y': 0.7},
             'crop': {'page': 1, 'x': 0, 'y': 0.62, 'w': 1, 'h': 0.2},
             'crops': [{'page': 1, 'x': 0, 'y': 0.62, 'w': 1, 'h': 0.2}, copy.deepcopy(self.tail)]},
            {'id': 'q2b', 'q': 2, 'part': 'ב', 'pin': {'page': 2, 'x': 0.8, 'y': 0.06},
             'crop': copy.deepcopy(self.tail), 'crops': [{'page': 1, 'x': 0, 'y': 0.62, 'w': 1, 'h': 0.2}, copy.deepcopy(self.tail)]},
        ]
        manifest = {'pdfHash': 'a' * 32, 'prefix': 'G9-T40', 'grade': 9, 'topicId': 40,
                    'level': 'a', 'sourceSha256': 'a' * 64, 'pageCount': 2,
                    'reviewRequired': True, 'exercises': exercises}
        (self.directory / ('a' * 32 + '.json')).write_text(json.dumps(manifest))
        self.record = {'schema': 'student-reviewed-crop-curation/2',
                       'package': 'G9-T40', 'grade': 9, 'topicId': 40,
                       'levels': [{'level': 'a', 'mediaId': 'a' * 32,
                                   'studentSha256': 'a' * 64,
                                   'operations': [
                                       {'q': 1, 'itemIds': ['q1a', 'q1b'],
                                        'remove': copy.deepcopy(self.foreign)},
                                       {'q': 2, 'itemIds': ['q2a', 'q2b'],
                                        'before': copy.deepcopy(self.tail),
                                        'after': copy.deepcopy(self.tail_trimmed)}]}]}

        # Bind every primary crop and ordered continuation list for each item.
        for op in self.record['levels'][0]['operations']:
            group = [e for e in exercises if e['q'] == op['q']]
            op['beforeState'] = [dict(id=e['id'], crop=copy.deepcopy(e['crop']),
                                     crops=copy.deepcopy(e['crops'])) for e in group]
            after = copy.deepcopy(op['beforeState'])
            for item in after:
                if 'remove' in op:
                    item['crops'].remove(op['remove'])
                else:
                    if item['crop'] == op['before']:
                        item['crop'] = copy.deepcopy(op['after'])
                    item['crops'] = [copy.deepcopy(op['after']) if c == op['before'] else c
                                     for c in item['crops']]
            op['afterState'] = after

    def bytes(self):
        return {p.name: p.read_bytes() for p in self.directory.iterdir()}

    def reject_atomically(self, record):
        original = self.bytes()
        with self.assertRaises(ValueError):
            curation.apply(record, self.directory)
        self.assertEqual(original, self.bytes())

    def final(self):
        return json.loads((self.directory / ('a' * 32 + '.json')).read_text())

    def test_valid_replay_is_idempotent_and_preserves_everything_else(self):
        self.assertEqual(curation.apply(self.record, self.directory), 2)
        once = self.bytes()
        self.assertEqual(curation.apply(self.record, self.directory, check=True), 2)
        self.assertEqual(curation.apply(self.record, self.directory), 2)
        self.assertEqual(once, self.bytes())
        result = self.final()
        for exercise in result['exercises']:
            if exercise['q'] == 1:
                self.assertEqual(exercise['crops'], [self.owned])
                self.assertEqual(exercise['crop'], self.owned)
            else:
                self.assertEqual(exercise['crops'][-1], self.tail_trimmed)
                self.assertEqual(exercise['crops'][0]['page'], 1)
        self.assertEqual(self.final()['exercises'][3]['crop'], self.tail_trimmed)

    def test_remove_rejects_own_pin_on_the_slice(self):
        self.record['levels'][0]['operations'].pop(1)
        manifest = json.loads((self.directory / ('a' * 32 + '.json')).read_text())
        manifest['exercises'][0]['pin'] = {'page': 2, 'x': 0.8, 'y': 0.06}
        (self.directory / ('a' * 32 + '.json')).write_text(json.dumps(manifest))
        self.reject_atomically(self.record)

    def test_remove_rejects_primary_or_first_slice(self):
        self.record['levels'][0]['operations'].pop(1)
        self.record['levels'][0]['operations'][0]['remove'] = self.owned
        self.reject_atomically(self.record)

    def test_remove_needs_schema_2(self):
        self.record['schema'] = 'student-reviewed-crop-curation/1'
        self.reject_atomically(self.record)

    def test_trim_needs_schema_2(self):
        self.record['schema'] = 'student-reviewed-crop-curation/1'
        self.record['levels'][0]['operations'].pop(0)
        self.reject_atomically(self.record)

    def test_trim_rejects_moved_top(self):
        self.record['levels'][0]['operations'].pop(0)
        op = self.record['levels'][0]['operations'][0]
        op['after'] = dict(self.tail, y=0.06, h=0.29)
        self.reject_atomically(self.record)

    def test_trim_rejects_unknown_rectangle(self):
        self.record['levels'][0]['operations'].pop(0)
        op = self.record['levels'][0]['operations'][0]
        op['before'] = dict(self.tail, h=0.31)
        self.reject_atomically(self.record)

    def test_trim_rejects_dropped_pin(self):
        self.record['levels'][0]['operations'].pop(0)
        op = self.record['levels'][0]['operations'][0]
        op['after'] = dict(self.tail, h=0.008)
        self.reject_atomically(self.record)


    def mutate_manifest(self, fn):
        path = self.directory / ('a' * 32 + '.json')
        manifest = json.loads(path.read_text())
        fn(manifest)
        path.write_text(json.dumps(manifest))

    def test_remove_rejects_modified_continuation_in_apply_and_check(self):
        self.mutate_manifest(lambda m: m['exercises'][0]['crops'][1].update(h=0.051))
        self.reject_atomically(self.record)
        original = self.bytes()
        with self.assertRaisesRegex(ValueError, 'Complete question crop binding'):
            curation.apply(self.record, self.directory, check=True)
        self.assertEqual(original, self.bytes())

    def test_remove_rejects_unrelated_primary_crop_drift(self):
        self.mutate_manifest(lambda m: m['exercises'][0]['crop'].update(h=0.401))
        self.reject_atomically(self.record)

    def test_trim_rejects_unrelated_continuation_list_drift(self):
        self.mutate_manifest(lambda m: m['exercises'][2]['crops'][0].update(h=0.201))
        self.reject_atomically(self.record)

    def test_check_rejects_unrelated_drift_after_successful_replay(self):
        curation.apply(self.record, self.directory)
        self.mutate_manifest(lambda m: m['exercises'][2]['crops'][0].update(h=0.201))
        original = self.bytes()
        with self.assertRaisesRegex(ValueError, 'Complete question crop binding'):
            curation.apply(self.record, self.directory, check=True)
        self.assertEqual(original, self.bytes())

    def test_unrelated_crop_boolean_coordinate_is_not_numeric_equality(self):
        self.mutate_manifest(lambda m: m['exercises'][0]['crops'][0].update(page=True))
        self.reject_atomically(self.record)

    def test_schema2_requires_complete_states(self):
        del self.record['levels'][0]['operations'][0]['beforeState']
        self.reject_atomically(self.record)

    def test_exact_after_state_is_checked_before_any_write(self):
        op = self.record['levels'][0]['operations'][1]
        op['afterState'][0]['crops'].append(copy.deepcopy(self.owned))
        self.reject_atomically(self.record)

    def test_schema2_media_binding_rejects_foreign_pdf_hash(self):
        self.mutate_manifest(lambda m: m.update(pdfHash='b' * 32))
        self.reject_atomically(self.record)

    def test_schema2_later_level_wrong_source_is_atomic(self):
        level = copy.deepcopy(self.record['levels'][0])
        level.update(level='c', mediaId='c' * 32, studentSha256='c' * 64)
        manifest = self.final()
        manifest.update(level='c', pdfHash='c' * 32, sourceSha256='d' * 64)
        (self.directory / ('c' * 32 + '.json')).write_text(json.dumps(manifest))
        self.record['levels'].append(level)
        self.reject_atomically(self.record)

    def test_schema2_later_operation_wrong_id_is_atomic(self):
        self.record['levels'][0]['operations'][1]['itemIds'][0] = 'foreign-item'
        self.reject_atomically(self.record)

if __name__ == '__main__':
    unittest.main()
