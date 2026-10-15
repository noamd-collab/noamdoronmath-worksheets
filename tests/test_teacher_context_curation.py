"""Portable curation guard regressions; every fixture here is synthetic."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'apply-teacher-context-curation.py'
SPEC = importlib.util.spec_from_file_location('teacher_context_curation', SCRIPT)
CURATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CURATION)


class TeacherContextCurationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.manifests = root / 'manifests'
        self.sheets = root / 'sheets'
        self.manifests.mkdir()
        self.sheets.mkdir()
        self.media = 'a' * 32
        self.student_sha = 'b' * 64
        self.crop = {'page': 1, 'x': 0.1, 'y': 0.1, 'w': 0.8, 'h': 0.8}
        self.manifest = {
            'prefix': 'SYNTHETIC', 'level': 'fixture', 'pageCount': 1,
            'sourceSha256': self.student_sha,
            'exercises': [
                {'q': 1, 'part': part, 'pin': {'page': 1, 'x': 0.5, 'y': y},
                 'crops': [copy.deepcopy(self.crop)]}
                for part, y in [('א', 0.25), ('ב', 0.5), ('ג', 0.75)]
            ],
        }
        self.teacher = {
            'pdfId': self.media, 'title': 'Synthetic fixture',
            'questions': [
                {'id': '1' + part, 'q': 1, 'part': part, 'page': 1,
                 'text': 'Synthetic prompt',
                 'row': {'page': 1, 'x': 0.1, 'y': y, 'w': 0.8, 'h': 0.1},
                 'rows': [{'page': 1, 'x': 0.1, 'y': y, 'w': 0.8, 'h': 0.1}]}
                for part, y in [('א', 0.2), ('ב', 0.45), ('ג', 0.7)]
            ],
        }
        self.record = {
            'schema': 'teacher-reviewed-context-curation/2', 'package': 'SYNTHETIC',
            'levels': [{
                'level': 'fixture', 'mediaId': self.media,
                'studentSha256': self.student_sha, 'exerciseCount': 3,
                'stems': [{'id': '1ב', 'stem': {
                    'page': 1, 'x': 0.1, 'y': 0.1, 'w': 0.8, 'h': 0.33}}],
                'rows': [{'id': '1ב', 'row': {
                    'page': 1, 'x': 0.1, 'y': 0.46, 'w': 0.8, 'h': 0.18}}],
            }],
        }

    def write_fixture(self, manifest=None, teacher=None, media=None):
        media = media or self.media
        (self.manifests / (media + '.json')).write_text(
            json.dumps(self.manifest if manifest is None else manifest), encoding='utf-8')
        path = self.sheets / (media + '.json')
        path.write_text(json.dumps(self.teacher if teacher is None else teacher), encoding='utf-8')
        return path

    def assert_rejected_without_writes(self, record=None, manifest=None, teacher=None):
        self.write_fixture(manifest, teacher)
        before = {p.name: p.read_bytes() for p in self.sheets.iterdir()}
        with self.assertRaises(ValueError):
            CURATION.apply(self.record if record is None else record,
                           self.manifests, self.sheets)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.sheets.iterdir()})

    def row_record(self, **changes):
        record = copy.deepcopy(self.record)
        record['levels'][0]['rows'][0]['row'].update(changes)
        return record

    def test_valid_replay_preserves_other_fields_and_is_idempotent(self):
        path = self.write_fixture()
        expected = copy.deepcopy(self.teacher)
        target = expected['questions'][1]
        target['stem'] = self.record['levels'][0]['stems'][0]['stem']
        target['row'] = self.record['levels'][0]['rows'][0]['row']
        target['rows'] = [target['row']]
        self.assertEqual(2, CURATION.apply(self.record, self.manifests, self.sheets))
        self.assertEqual(expected, json.loads(path.read_text(encoding='utf-8')))
        first = path.read_bytes()
        self.assertEqual(2, CURATION.apply(self.record, self.manifests, self.sheets))
        self.assertEqual(first, path.read_bytes())
        self.assertEqual(2, CURATION.apply(self.record, self.manifests, self.sheets, check=True))
        self.assertEqual(first, path.read_bytes())

    def test_check_mode_detects_unapplied_record_without_writing(self):
        path = self.write_fixture()
        before = path.read_bytes()
        with self.assertRaises(ValueError):
            CURATION.apply(self.record, self.manifests, self.sheets, check=True)
        self.assertEqual(before, path.read_bytes())

    def test_malformed_rectangles_are_rejected(self):
        for value in [None, [], {}, {'page': 1}]:
            with self.subTest(value=value):
                record = copy.deepcopy(self.record)
                record['levels'][0]['rows'][0]['row'] = value
                self.assert_rejected_without_writes(record)
        record = self.row_record(unexpected='fixture')
        self.assert_rejected_without_writes(record)

    def test_nonfinite_and_nonnumeric_coordinates_are_rejected(self):
        for field in ['page', 'x', 'y', 'w', 'h']:
            for value in [float('nan'), float('inf'), -float('inf'), '0.1', True, None]:
                with self.subTest(field=field, value=value):
                    self.assert_rejected_without_writes(self.row_record(**{field: value}))

    def test_out_of_page_and_degenerate_rectangles_are_rejected(self):
        cases = [('page', 0), ('page', 2), ('page', 1.5),
                 ('x', -0.1), ('x', 1), ('y', -0.1), ('y', 1),
                 ('w', 0), ('w', -1), ('w', 1), ('h', 0), ('h', -1), ('h', 1)]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                self.assert_rejected_without_writes(self.row_record(**{field: value}))

    def test_row_must_contain_own_pin_in_both_axes(self):
        for changes in [{'x': 0.1, 'w': 0.2}, {'y': 0.55, 'h': 0.1}]:
            with self.subTest(changes=changes):
                self.assert_rejected_without_writes(self.row_record(**changes))

    def test_row_must_stay_inside_question_crop_in_both_axes(self):
        for changes in [{'x': 0.05, 'w': 0.85}, {'y': 0.05, 'h': 0.5}]:
            with self.subTest(changes=changes):
                self.assert_rejected_without_writes(self.row_record(**changes))

    def test_row_cannot_reach_next_item(self):
        self.assert_rejected_without_writes(self.row_record(h=0.3))

    def test_duplicate_manifest_ids_are_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest['exercises'].append(copy.deepcopy(manifest['exercises'][0]))
        self.assert_rejected_without_writes(manifest=manifest)

    def test_binding_changes_are_rejected(self):
        for key, value in [('studentSha256', 'c' * 64), ('level', 'wrong'), ('exerciseCount', 4)]:
            with self.subTest(key=key):
                record = copy.deepcopy(self.record)
                record['levels'][0][key] = value
                self.assert_rejected_without_writes(record)
        record = copy.deepcopy(self.record)
        record['package'] = 'OTHER-SYNTHETIC'
        self.assert_rejected_without_writes(record)
        teacher = copy.deepcopy(self.teacher)
        teacher['pdfId'] = 'c' * 32
        self.assert_rejected_without_writes(teacher=teacher)

    def test_failure_in_later_level_leaves_all_sheets_unchanged(self):
        first = self.write_fixture()
        second_media = 'd' * 32
        second_teacher = copy.deepcopy(self.teacher)
        second_teacher['pdfId'] = second_media
        second = self.write_fixture(teacher=second_teacher, media=second_media)
        record = copy.deepcopy(self.record)
        level = copy.deepcopy(record['levels'][0])
        level['mediaId'] = second_media
        level['rows'][0]['row']['w'] = 0
        record['levels'].append(level)
        before = (first.read_bytes(), second.read_bytes())
        with self.assertRaises(ValueError):
            CURATION.apply(record, self.manifests, self.sheets)
        self.assertEqual(before, (first.read_bytes(), second.read_bytes()))

    def test_schema1_stems_remain_compatible_and_rows_are_rejected(self):
        record = copy.deepcopy(self.record)
        record['schema'] = 'teacher-reviewed-context-curation/1'
        self.assert_rejected_without_writes(record)
        record['levels'][0].pop('rows')
        path = self.write_fixture()
        self.assertEqual(1, CURATION.apply(record, self.manifests, self.sheets))
        expected = copy.deepcopy(self.teacher)
        expected['questions'][1]['stem'] = record['levels'][0]['stems'][0]['stem']
        self.assertEqual(expected, json.loads(path.read_text(encoding='utf-8')))
        self.assertEqual(1, CURATION.apply(record, self.manifests, self.sheets, check=True))


if __name__ == '__main__':
    unittest.main()
