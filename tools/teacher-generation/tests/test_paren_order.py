"""The second measurement of the pinned bracket-order gate G51."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import paren_order


class BracketOrderTests(unittest.TestCase):
    def test_a_product_of_two_groups_is_in_order_and_a_reversed_pair_is_not(self):
        cases = {
            # (samples the pinned gate reports, samples that stay failures)
            "(10 + 2) x (5 − 3)": (1, 0),      # recorded 2026-11-23: p9:') x ('
            "(8 : 2) + 3 x (4 − 1)": (1, 0),
            "א. (3) x (4)": (1, 0),
            "((5 + 3) x 2) x (5 + (3 x 2))": (1, 0),
            ")2( 18 : 5": (1, 1),               # the defect the gate exists for
            ")4 x )2( + 3(": (1, 1),
            "(א )2( ב)": (1, 1),                # an opening bracket of a Hebrew aside is not the pair's own
            "(a) b (c)": (1, 1),                # Latin letters are not arithmetic between groups
            "(12 + 3) x (4 +": (1, 0),
            "(2 x 10) + 20": (0, 0),
            "(א) + (ב)": (0, 0),
            "((5 + 3) x 2) − (5 + (3 x 2))": (0, 0),
        }
        for line, expected in cases.items():
            self.assertEqual(paren_order.measure_line(line), expected, line)

    def page(self, lines):
        import pymupdf
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        pdf = Path(folder.name) / "sheet.pdf"
        document = pymupdf.open()
        sheet = document.new_page()
        for index, line in enumerate(lines):
            sheet.insert_text((72, 100 + 30 * index), line, fontsize=12)
        document.save(str(pdf))
        document.close()
        return pdf

    def test_whole_pdf_reconciles_only_when_every_sample_is_in_order(self):
        self.assertEqual(paren_order.measure(self.page(["(10 + 2) x (5 - 3)", "24 : 6 + 9"])),
                         {"status": "RECONCILED", "code": "G51", "matches": 1, "unbalanced": 0, "pages": [1]})
        mixed = paren_order.measure(self.page(["(10 + 2) x (5 - 3)", ")2( 18 : 5"]))
        self.assertEqual((mixed["status"], mixed["matches"], mixed["unbalanced"]), ("UNBALANCED", 2, 1))
        self.assertEqual(paren_order.measure(self.page(["24 : 6 + 9"]))["status"], "NO_SAMPLE")

    def test_script_exit_code_follows_the_measurement(self):
        for lines, code, status in ((["(10 + 2) x (5 - 3)"], 0, "RECONCILED"), ([")2( 18 : 5"], 1, "UNBALANCED"),
                                    (["24 : 6"], 1, "NO_SAMPLE")):
            pdf = self.page(lines)
            report = pdf.with_suffix(".json")
            done = subprocess.run([sys.executable, "-B", str(HERE / "paren_order.py"), "--pdf", str(pdf), "--json", str(report)],
                                  capture_output=True, text=True, timeout=120)
            self.assertEqual(done.returncode, code, done.stderr)
            self.assertEqual(json.loads(report.read_text())["status"], status)
            self.assertEqual(json.loads(done.stdout)["status"], status)


if __name__ == "__main__":
    unittest.main()
