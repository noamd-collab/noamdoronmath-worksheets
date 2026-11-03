#!/usr/bin/env python3
"""Focused rejection/coverage tests for source answer geometry extraction."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path
import pymupdf

spec = importlib.util.spec_from_file_location('maps', Path(__file__).with_name('build-teacher-answer-maps.py'))
maps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(maps)


class AnswerMaps(unittest.TestCase):
    def make_pdf(self, folder, *, invisible=False, border=True, crossing=False):
        path = Path(folder) / 'source.pdf'
        doc = pymupdf.open()
        page = doc.new_page(width=595, height=842)
        for q, top, bottom in [(1, 40, 90), (2, 90, 140)]:
            if border:
                shape = page.new_shape()
                shape.draw_rect(pymupdf.Rect(42, top, 553, bottom - .45))
                shape.draw_rect(pymupdf.Rect(42, top, 553, bottom))
                shape.finish(color=None, fill=(.84, .84, .82), even_odd=True)
                shape.commit()
            page.insert_text((530, top + 15), f'({q})', fontsize=10, render_mode=3 if invisible else 0)
            page.insert_text((80, top + 15), 'a. answer; b. another answer', fontsize=10)
        page.insert_text((301, 66), '2', fontsize=8)
        page.draw_line((299, 70), (307, 70), color=(0, 0, 0), width=.5)
        page.insert_text((301, 82), '3', fontsize=8)
        if crossing:
            page.draw_line((150, 85), (150, 95), color=(0, 0, 0), width=1)
        doc.save(path)
        doc.close()
        source = {'pdfId': 'fixture', 'pageCount': 1, 'answerStartPage': 1,
                  'questions': [{'q': q, 'part': part, 'id': f'{q}{part}'}
                                for q in (1, 2) for part in ('א', 'ב')]}
        return path, source

    def test_complete_rows_keep_all_parts_and_fraction_ink(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder)
            before = path.read_bytes()
            result, audit = maps.build_answer_map(path, source, raster_check=True)
            self.assertEqual([x['q'] for x in result['questions']], [1, 2])
            self.assertEqual([x['parts'] for x in result['questions']], [['א', 'ב'], ['א', 'ב']])
            crop = result['questions'][0]['crops'][0]
            self.assertLess(crop['y'], 40.01 / 842)
            self.assertGreater(crop['y'] + crop['h'], 89.99 / 842)
            self.assertEqual(audit['rasterBoundaryChecks'], 4)
            self.assertEqual(path.read_bytes(), before, 'Geometry extraction must not mutate PDFs')
            self.assertEqual(result['sourceSha256'], hashlib.sha256(before).hexdigest())

    def test_legacy_ink_refinement_requires_independent_raster_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder)
            with self.assertRaisesRegex(ValueError, 'requires raster verification'):
                maps.build_answer_map(path, source, refine_ink_boundaries=True)

    def test_legacy_refinement_cannot_hide_ink_without_a_white_gap(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder, crossing=True)
            with self.assertRaisesRegex(ValueError, 'no verified white gap'):
                maps.build_answer_map(path, source, raster_check=True, refine_ink_boundaries=True)

    def test_wrong_source_hash_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder)
            with self.assertRaisesRegex(ValueError, 'hash'):
                maps.build_answer_map(path, source, '0' * 64)

    def test_invisible_overlay_cannot_supply_answer_anchors(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder, invisible=True)
            with self.assertRaisesRegex(ValueError, 'anchors/row borders'):
                maps.build_answer_map(path, source)

    def test_missing_layout_evidence_is_not_replaced_with_whole_pages(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder, border=False)
            with self.assertRaisesRegex(ValueError, 'anchors/row borders'):
                maps.build_answer_map(path, source)

    def test_unselected_neighbor_or_unexpected_question_cannot_be_relabelled(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder)
            source['questions'] = [q for q in source['questions'] if q['q'] == 1]
            with self.assertRaisesRegex(ValueError, 'unexpected or duplicate question 2'):
                maps.build_answer_map(path, source)

    def test_fraction_or_vector_crossing_row_boundary_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder, crossing=True)
            with self.assertRaisesRegex(ValueError, 'vector/fraction crosses'):
                maps.build_answer_map(path, source)


if __name__ == '__main__':
    unittest.main()
