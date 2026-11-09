#!/usr/bin/env python3
"""Focused rejection/coverage tests for source answer geometry extraction."""
import hashlib
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
import pymupdf

spec = importlib.util.spec_from_file_location('maps', Path(__file__).with_name('build-teacher-answer-maps.py'))
maps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(maps)
sys.path.insert(0, str(Path(__file__).parent))
import answer_ink_edges as ink_edges  # noqa: E402
spec = importlib.util.spec_from_file_location('elementary', Path(__file__).with_name('build-elementary-answer-maps.py'))
elementary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(elementary)


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

    def test_ink_edge_check_passes_complete_rows(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder)
            result, audit = maps.build_answer_map(path, source, raster_check=True, ink_edges=True)
            self.assertEqual([x['q'] for x in result['questions']], [1, 2])
            self.assertEqual(audit['inkEdgeChecks'], 2)

    def test_ink_edge_check_rejects_light_raster_ink_across_a_row_cut(self):
        with tempfile.TemporaryDirectory() as folder:
            path, source = self.make_pdf(folder)
            # A light gray stroke in an embedded image: no text or vector box
            # shows it, and it is lighter than the single-row raster limit.
            doc = pymupdf.open(path)
            pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 4, 40), False)
            pix.set_rect(pix.irect, (165, 165, 165))
            doc[0].insert_image(pymupdf.Rect(400, 84, 401, 94), pixmap=pix)
            doc.saveIncr()
            doc.close()
            maps.build_answer_map(path, source, raster_check=True)
            with self.assertRaisesRegex(ValueError, 'question 1: ink crosses the bottom crop edge'):
                maps.build_answer_map(path, source, raster_check=True, ink_edges=True)


class ElementaryInkEdges(unittest.TestCase):
    """Elementary crops are table cells: their own borders are not clipped ink."""

    def make_table(self, folder, crossing=False):
        doc = pymupdf.open()
        page = doc.new_page(width=595, height=842)
        for q, (top, bottom) in enumerate([(120, 170), (170, 220), (220, 270)], 1):
            shape = page.new_shape()
            shape.draw_rect(pymupdf.Rect(60, top, 535, bottom))
            shape.finish(color=(0, 0, 0), width=1)
            shape.commit()
            page.insert_text((500, top + 20), f'{q}.', fontsize=11, fontname='hebo')
            page.insert_text((100, top + 20), 'answer', fontsize=11)
        if crossing:
            page.insert_text((300, 174), '7', fontsize=14)  # drawn over the border between 1 and 2
        doc.save(Path(folder) / 'table.pdf')
        doc.close()
        elementary.CACHE = elementary.R = Path(folder)
        return {'pdfId': 'table', 'grade': 4, 'answerStartPage': 1, 'questions': [{'q': q, 'part': ''} for q in (1, 2, 3)]}

    def tearDown(self):
        elementary.INK_EDGES = False

    def test_cell_borders_are_not_clipped_ink(self):
        with tempfile.TemporaryDirectory() as folder:
            source = self.make_table(folder)
            elementary.INK_EDGES = True
            result, _ = elementary.runone(source)
            self.assertEqual([q['q'] for q in result['questions']], [1, 2, 3])

    def test_a_glyph_across_a_cell_border_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            source = self.make_table(folder, crossing=True)
            elementary.runone(source)
            elementary.INK_EDGES = True
            with self.assertRaisesRegex(ValueError, 'ink crosses the bottom edge of q1 p1'):
                elementary.runone(source)


class InkEdges(unittest.TestCase):
    """Decoration on a cut is not ink; a stroke across it is."""

    def setUp(self):
        self.doc = pymupdf.open()
        self.page = self.doc.new_page(width=595, height=842)

    def tearDown(self):
        self.doc.close()

    def fill(self, x0, y0, x1, y1, color=(0, 0, 0)):
        shape = self.page.new_shape()
        shape.draw_rect(pymupdf.Rect(x0, y0, x1, y1))
        shape.finish(color=None, fill=color)
        shape.commit()

    def row(self, top, bottom, x0=42, x1=553):
        return {'x': x0 / 595, 'y': top / 842, 'w': (x1 - x0) / 595, 'h': (bottom - top) / 842}

    def flagged(self, *crops):
        return {(f['crop'], f['edge']) for f in ink_edges.clipped_ink(self.page, list(crops))}

    def test_rules_borders_and_separators_on_the_cut_are_not_ink(self):
        self.fill(42, 99.5, 553, 100.5)  # a solid table border astride the cut
        for x in range(42, 553, 8):
            self.fill(x, 199.6, x + 4, 200.4)  # a dashed rule astride the cut
        self.fill(300, 280, 300.8, 320)  # a cell separator running through the cut
        self.fill(552.5, 360, 553.5, 400)  # a vertical border along the right edge
        self.page.insert_text((100, 95), '12', fontsize=10)
        self.assertEqual(self.flagged(self.row(60, 100), self.row(160, 200), self.row(260, 300), self.row(360, 400, x1=553)), set())

    def test_tints_and_highlights_across_the_cut_are_not_ink(self):
        self.fill(42, 80, 553, 120, (.62, .77, .91))  # a light blue row tint
        self.fill(42, 180, 553, 220, (0, 1, 0))  # a lime tint, darker than plain ink limits
        self.fill(200, 285, 240, 315, (0, 1, 1))  # a highlighted part
        self.page.insert_text((60, 95), 'tinted 7', fontsize=10)
        self.page.insert_text((205, 296), '3', fontsize=10)
        self.assertEqual(self.flagged(self.row(60, 100), self.row(160, 200), self.row(260, 300)), set())

    def test_strokes_across_the_cut_are_ink(self):
        self.fill(380, 80, 553, 120, (.62, .77, .91))
        self.page.insert_text((400, 104), '8', fontsize=10)  # text on a tint across the cut
        self.page.insert_text((100, 103), '12', fontsize=12)  # a glyph across the bottom cut
        self.fill(300, 190, 330, 210)  # a solid shape across the bottom cut
        self.fill(200, 295, 230, 296)  # a fraction bar inside the crop ...
        self.page.insert_text((205, 305), '3', fontsize=10)  # ... whose denominator crosses
        self.page.insert_text((540, 380), '45', fontsize=10)  # a glyph across the right edge
        crops = [self.row(60, 100, x1=380), self.row(160, 200), self.row(260, 300), self.row(360, 400, x1=545), self.row(60, 100, x0=380)]
        self.assertEqual(self.flagged(*crops), {(0, 'bottom'), (1, 'bottom'), (2, 'bottom'), (3, 'right'), (4, 'bottom')})

    def test_bars_of_one_answer_row_are_not_a_dashed_rule(self):
        for x in (60, 120, 190, 230, 310, 380, 420):
            self.fill(x, 99.6, x + 14, 100.4)  # fraction bars astride the cut, spaced by their answers
        self.assertEqual(len(ink_edges.clipped_ink(self.page, [self.row(60, 100)])), 7)


if __name__ == '__main__':
    unittest.main()
