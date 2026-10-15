"""Physical-ink regressions for the student-manifest helper.

Run from a repository checkout with:
    python3 -m unittest discover -s tests -p test_student_manifest_ink.py

For a helper outside that checkout, set STUDENT_MANIFEST_HELPER to its path.
All PDFs are synthetic and created in a temporary directory.
"""
import importlib.util
import itertools
import os
from pathlib import Path
import sys
import tempfile
import unittest

import pymupdf


def load_helper():
    default = Path(__file__).resolve().parents[1] / "scripts" / "build-student-manifest.py"
    path = Path(os.environ.get("STUDENT_MANIFEST_HELPER", default))
    spec = importlib.util.spec_from_file_location("student_manifest_under_test", path)
    module = importlib.util.module_from_spec(spec)
    # Importing a helper must not create files in its source directory.
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


class StudentManifestInkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.helper = load_helper()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.serial = 0

    def fixture(self, *, marker_y=100, body_y=120, neighbor=False):
        doc = pymupdf.open()
        self.addCleanup(doc.close)
        page = doc.new_page(width=600, height=840)
        page.insert_text((510, marker_y), "(1)", fontsize=11)
        page.insert_text((300, body_y), "question body", fontsize=11)
        if neighbor:
            page.insert_text((510, 250), "(2)", fontsize=11)
            page.insert_text((300, 275), "next question", fontsize=11)
        return doc, page

    def manifest(self, doc):
        self.serial += 1
        path = Path(self.temp.name) / ("fixture-%d.pdf" % self.serial)
        doc.save(path)
        return self.helper.build(str(path), "0" * 32, 8, 11,
                                 "SYNTHETIC", "Synthetic regression", "a")

    @staticmethod
    def crop(manifest, page, question=1):
        exercise = next(e for e in manifest["exercises"] if e["q"] == question)
        crop = next(c for c in exercise["crops"] if c["page"] == 1)
        return pymupdf.Rect(crop["x"] * page.rect.width,
                            crop["y"] * page.rect.height,
                            (crop["x"] + crop["w"]) * page.rect.width,
                            (crop["y"] + crop["h"]) * page.rect.height)

    def black_pixels(self, page, region):
        """Read painted PDF pixels, independently of the helper's path bounds."""
        scale = 8
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=region)
        pixels = pix.samples
        found = []
        for y in range(pix.height):
            for x in range(pix.width):
                start = (y * pix.width + x) * pix.n
                if max(pixels[start:start + 3]) < 180:
                    found.append(((pix.x + x + 0.5) / scale,
                                  (pix.y + y + 0.5) / scale))
        self.assertTrue(found, "The physical-ink fixture must actually paint ink")
        return found

    def assert_ink_inside(self, page, crop, region):
        points = self.black_pixels(page, region)
        outside = [(x, y) for x, y in points
                   if not (crop.x0 - 0.01 <= x <= crop.x1 + 0.01
                           and crop.y0 - 0.01 <= y <= crop.y1 + 0.01)]
        self.assertFalse(outside,
                         "%d painted pixels outside crop; first=%s; crop=%s"
                         % (len(outside), outside[:1], tuple(crop)))

    @staticmethod
    def draw_chain(page):
        # Horizontal/vertical centrelines have zero-area rectangles, but their
        # strokes paint area. The final horizontal stroke paints below y=210.
        points = [(100, 122), (100, 155), (140, 155),
                  (140, 182), (180, 182), (180, 210), (210, 210)]
        for a, b in zip(points, points[1:]):
            page.draw_line(a, b, width=2, color=(0, 0, 0))

    def test_connected_node_is_complete_in_every_draw_order(self):
        bottoms = []
        for order in itertools.permutations((0, 1, 2)):
            with self.subTest(order=order):
                doc, page = self.fixture()
                for action in order:
                    if action == 0:
                        page.draw_line((100, 122), (110, 170), width=1)
                    elif action == 1:
                        page.draw_line((110, 170), (150, 210), width=1)
                    else:
                        page.draw_circle((150, 210), 3.5,
                                         color=None, fill=(0, 0, 0))
                crop = self.crop(self.manifest(doc), page)
                bottoms.append(crop.y1)
                self.assert_ink_inside(page, crop, pymupdf.Rect(95, 120, 157, 216))
        self.assertLess(max(bottoms) - min(bottoms), 0.01,
                        "Primitive order must not change the crop envelope")

    def test_horizontal_vertical_strokes_include_their_painted_half_width(self):
        doc, page = self.fixture()
        self.draw_chain(page)
        crop = self.crop(self.manifest(doc), page)
        points = self.black_pixels(page, pymupdf.Rect(175, 207, 215, 214))
        self.assertGreater(max(y for _, y in points), 210.8,
                           "The source must paint a real half-stroke below210")
        self.assert_ink_inside(page, crop, pymupdf.Rect(95, 120, 215, 214))

    def test_round_cap_point_is_not_discarded_as_an_empty_rectangle(self):
        doc, page = self.fixture()
        page.draw_line((100, 124), (100, 124), width=4, lineCap=1)
        crop = self.crop(self.manifest(doc), page)
        points = self.black_pixels(page, pymupdf.Rect(96, 120, 104, 128))
        self.assertGreater(max(y for _, y in points), 125.8)
        self.assert_ink_inside(page, crop, pymupdf.Rect(96, 120, 104, 128))

    def test_connected_ink_near_page_foot_is_not_a_running_footer(self):
        doc, page = self.fixture(marker_y=700, body_y=780)
        points = [(100, 777), (100, 797), (130, 797), (130, 810), (150, 810)]
        for a, b in zip(points, points[1:]):
            page.draw_line(a, b, width=1)
        crop = self.crop(self.manifest(doc), page)
        self.assert_ink_inside(page, crop, pymupdf.Rect(95, 775, 155, 814))

    def test_separated_headers_footers_and_page_frame_do_not_expand_crop(self):
        doc, page = self.fixture()
        self.draw_chain(page)
        for rect in ((10, 15, 590, 40), (10, 800, 590, 825), (10, 15, 590, 825)):
            page.draw_rect(pymupdf.Rect(rect), width=1)
        crop = self.crop(self.manifest(doc), page)
        self.assertGreater(crop.y0, 40)
        self.assertLess(crop.y1, 790)
        self.assert_ink_inside(page, crop, pymupdf.Rect(95, 120, 215, 214))

    def test_crop_ends_before_the_next_question_ink(self):
        doc, page = self.fixture(neighbor=True)
        self.draw_chain(page)
        crop = self.crop(self.manifest(doc), page)
        next_ink = self.black_pixels(page, pymupdf.Rect(500, 230, 550, 260))
        self.assertLess(crop.y1, min(y for _, y in next_ink))
        self.assert_ink_inside(page, crop, pymupdf.Rect(95, 120, 215, 214))

    def test_small_label_inside_connected_node_is_kept(self):
        doc, page = self.fixture()
        page.draw_line((100, 122), (130, 200), width=1)
        page.draw_circle((130, 200), 8, color=(0, 0, 0), width=1)
        page.insert_text((128, 203), "8", fontsize=7)
        crop = self.crop(self.manifest(doc), page)
        self.assert_ink_inside(page, crop, pymupdf.Rect(120, 190, 140, 212))


if __name__ == "__main__":
    unittest.main()
