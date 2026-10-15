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
                       'package': 'G9-T32', 'grade': 9, 'topicId': 19, 'levels': []}
        for level, digit in [('a', 'a'), ('c', 'c')]:
            media = digit * 32
            source = digit * 64
            ident = 'synthetic-' + level
            manifest = {'prefix': 'G9-T32', 'grade': 9, 'topicId': 19,
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


if __name__ == '__main__':
    unittest.main()
