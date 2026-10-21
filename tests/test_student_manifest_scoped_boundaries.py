"""A generic full-width question box must not become a section header.

Uses the same configurable helper loader as the physical-ink regression suite.
The PDF and data are synthetic; no worksheet artifacts are required.
"""
from pathlib import Path
import tempfile
import unittest

import pymupdf
import test_student_manifest_ink as ink_tests


class ScopedBoundaryTests(unittest.TestCase):
    def test_generic_boxed_continuation_remains_question_content(self):
        helper = ink_tests.load_helper()
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "boxed-continuation.pdf"
            doc = pymupdf.open()
            self.addCleanup(doc.close)
            first = doc.new_page(width=600, height=840)
            first.insert_text((510, 100), "(1)", fontsize=11)
            first.insert_text((80, 125), "Use the supplied data on the next page.", fontsize=11)
            second = doc.new_page(width=600, height=840)
            second.draw_rect(pymupdf.Rect(30, 90, 570, 120),
                             color=(0, 0, 0), fill=(0.92, 0.92, 0.92), width=1)
            second.insert_text((50, 110), "Question 1 continued: required data 7, 12, 19.",
                               fontsize=11)
            second.insert_text((510, 250), "(2)", fontsize=11)
            second.insert_text((80, 275), "A separate second question.", fontsize=11)
            doc.save(pdf)
            manifest = helper.build(str(pdf), "0" * 32, 8, 11,
                                    "SYNTHETIC", "Synthetic regression", "a")
            first_question = next(e for e in manifest["exercises"] if e["q"] == 1)
            self.assertEqual([c["page"] for c in first_question["crops"]], [1, 2])
            continuation = first_question["crops"][1]
            top = continuation["y"] * 840
            bottom = (continuation["y"] + continuation["h"]) * 840
            self.assertLessEqual(top, 89.5 + 0.01)
            self.assertGreaterEqual(bottom, 120.5 - 0.01)
            next_marker = next(w for w in second.get_text("words") if w[4] == "(2)")
            self.assertLessEqual(bottom, next_marker[1] + 0.01)


if __name__ == "__main__":
    unittest.main()
