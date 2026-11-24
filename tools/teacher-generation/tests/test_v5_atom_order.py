"""atom_order: expected atoms from levels.json and glyph runs of a real WeasyPrint RTL PDF (V5-DESIGN §5, §6.2)."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import atom_order  # noqa: E402
from atom_order import AtomOrderError, check_atom_order, expected_atoms, island_glyphs  # noqa: E402

ATOMS = ("5x + 4", "y = −2", "−6", "(−3) + (−4)", "5 − (−2)", "2(x + 3)", "30\\%")
STYLE = ("@page{size:A4;margin:2cm} body{direction:rtl;font-family:'Arial Hebrew','Noto Sans Hebrew','DejaVu Sans',"
         "sans-serif;font-size:14pt} .m{direction:ltr;white-space:nowrap} .qnum{direction:ltr}")


def island_html(island):
    return '<span class="m">%s</span>' % island.replace("\\%", "%")


def page(question_rows, answer_rows, anchor=True):
    body = "".join("<p>%s</p>" % row for row in question_rows)
    if anchor:
        body += '<div class="ansband">תשובות סופיות</div>'
    body += "".join("<p>%s</p>" % row for row in answer_rows)
    return '<html dir="rtl" lang="he"><head><meta charset="utf-8"><style>%s</style></head><body>%s</body></html>' % (
        STYLE, body)


def levels(item_texts, answers):
    return [{"title": "כותרת", "rule": "", "questions": [{"n": 1, "intro": "כנסו:", "items": [
        {"text": text} for text in item_texts]}], "answers": [[1, [["א", answer] for answer in answers]]]}]


class Expected(unittest.TestCase):
    def test_island_glyphs(self):
        cases = {"5x + 4": "5x+4", "y = −2": "y=−2", "30\\%": "30%", "(−3) + (−4)": "(−3)+(−4)", "x + 1": "x+1",
                 "2(x + 3)": "2(x+3)"}
        for island, glyphs in cases.items():
            self.assertEqual(island_glyphs(island), glyphs)
        for island in ("\\f{1}{2}", "x^{2}", "3°", "x_1", "5-2", "10 ₪", "\\g{x}"):
            with self.subTest(island=island):
                with self.assertRaises(AtomOrderError) as caught:
                    island_glyphs(island)
                self.assertEqual(caught.exception.code, "ATOM_NOT_FLAT")
        with self.assertRaises(AtomOrderError) as caught:
            island_glyphs("  ")
        self.assertEqual(caught.exception.code, "ATOM_LEVELS_INVALID")

    def test_expected_atoms_of_the_sample_sheet(self):
        questions, answers = expected_atoms(S.load("levels-g7-sample.json"))
        self.assertEqual(sum(answers.values()), 80)                    # 20 markers and 60 keys
        self.assertEqual(sum(questions[f"({n})"] for n in range(1, 21)), 20)
        self.assertEqual(questions["3x+5x=8x"], 1)                     # the rule box
        self.assertEqual(questions["y=−2"], 1)
        self.assertEqual(questions["4y−y"], 1)
        self.assertEqual(answers["5x+4"], 1)
        self.assertEqual(answers["−6"], 2)
        self.assertEqual(answers["(7)"], 1)
        self.assertEqual(sum(questions.values()) + sum(answers.values()), 215)

    def test_odd_dollar_and_bad_levels(self):
        for bad in ([], [{"questions": [], "answers": [], "title": "a $x", "rule": ""}],
                    [{"questions": [{"n": "x", "items": []}], "answers": []}], "levels"):
            with self.subTest(bad=str(bad)[:40]):
                with self.assertRaises(AtomOrderError) as caught:
                    expected_atoms(bad)
                self.assertEqual(caught.exception.code, "ATOM_LEVELS_INVALID")

    def test_runs_break_on_other_glyphs_and_wide_gaps(self):
        row = [("5", 0, 6, 12), ("x", 6, 12, 12), ("+", 15, 21, 12), ("4", 24, 30, 12), ("א", 31, 40, 12),
               ("4", 41, 47, 12), ("y", 80, 86, 12)]
        self.assertEqual(atom_order._runs(row), ["5x+4", "4", "y"])


@unittest.skipUnless(S.weasyprint_available(), "WeasyPrint or PyMuPDF unavailable")
class RealPdf(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def write(self, html, data):
        import weasyprint
        pdf, levels_path = self.dir / "sheet.pdf", self.dir / "levels.json"
        weasyprint.HTML(string=html).write_pdf(str(pdf))
        levels_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return levels_path, pdf

    def rows(self):
        questions = ['<span class="qnum">(1)</span> כנסו: ' + island_html(ATOMS[0]) + " וגם " + island_html(ATOMS[1])]
        questions += ["חשבו " + island_html(atom) + " ועוד" for atom in ATOMS[2:]]
        answers = ['<span class="qnum">(1)</span> א. ' + island_html("−6")]
        texts = ["$%s$ וגם $%s$" % ATOMS[:2]] + ["חשבו $%s$ ועוד" % atom for atom in ATOMS[2:]]
        return questions, answers, texts

    def test_isolated_atoms_pass(self):
        questions, answers, texts = self.rows()
        levels_path, pdf = self.write(page(questions, answers), levels(texts, ["$−6$"]))
        report = check_atom_order(levels_path, pdf)
        self.assertEqual(report["status"], "PASS")
        self.assertTrue(report["producer"].startswith("WeasyPrint"))
        self.assertEqual(report["atoms"], 1 + len(ATOMS) + 2)          # (1), the 7 atoms; (1) and −6

    def test_split_percent_box_is_missing(self):
        questions, answers, texts = self.rows()
        questions[-1] = "חשבו " + island_html("30") + " % ועוד"
        levels_path, pdf = self.write(page(questions, answers), levels(texts, ["$−6$"]))
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(levels_path, pdf)
        self.assertEqual(caught.exception.code, "ATOM_MISSING")
        self.assertIn(("questions", "30%"), caught.exception.missing)

    def test_unisolated_negative_answer_is_missing(self):
        questions, answers, texts = self.rows()
        levels_path, pdf = self.write(page(questions, ['<span class="qnum">(1)</span> א. −6']),
                                      levels(texts, ["$−6$"]))
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(levels_path, pdf)
        self.assertEqual(caught.exception.code, "ATOM_MISSING")
        self.assertEqual(caught.exception.missing, [("answers", "−6")])

    def test_fraction_island_is_not_flat(self):
        questions, answers, texts = self.rows()
        levels_path, pdf = self.write(page(questions, answers), levels(texts + ["$\\f{1}{2}$"], ["$−6$"]))
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(levels_path, pdf)
        self.assertEqual(caught.exception.code, "ATOM_NOT_FLAT")

    def test_producer_and_anchor(self):
        import pymupdf
        questions, answers, texts = self.rows()
        levels_path, _ = self.write(page(questions, answers), levels(texts, ["$−6$"]))
        other = self.dir / "other.pdf"
        document = pymupdf.open()
        document.new_page().insert_text((72, 72), "5x + 4")
        document.save(str(other))
        document.close()
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(levels_path, other)
        self.assertEqual(caught.exception.code, "PDF_PRODUCER_NOT_WEASYPRINT")
        levels_path, pdf = self.write(page(questions, answers, anchor=False), levels(texts, ["$−6$"]))
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(levels_path, pdf)
        self.assertEqual(caught.exception.code, "ATOM_ANCHOR_MISSING")
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(levels_path, self.dir / "absent.pdf")
        self.assertEqual(caught.exception.code, "ATOM_PDF_UNREADABLE")

    def test_cli_writes_codes_only(self):
        questions, answers, texts = self.rows()
        levels_path, pdf = self.write(page(questions, ['<span class="qnum">(1)</span> א. −6']),
                                      levels(texts, ["$−6$"]))
        out = self.dir / "atom-order.json"
        done = subprocess.run([sys.executable, "-B", str(S.APP / "atom_order.py"), "--levels", str(levels_path),
                               "--pdf", str(pdf), "--json", str(out)], capture_output=True, text=True, timeout=120)
        self.assertEqual(done.returncode, 1)
        report = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual((report["status"], report["code"]), ("FAIL", "ATOM_MISSING"))
        self.assertEqual(report["missing"], [["answers", "−6"]])


if __name__ == "__main__":
    unittest.main()
