"""Actual rendered regression plus small, coordinate-controlled PDF cases."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import pymupdf

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from elementary_pdf_order import AnswerOrderError, check_answer_order

FIXTURES = Path(__file__).with_name('fixtures') / 'elementary-answer-order'


class AnswerOrderTests(unittest.TestCase):
    def make(self, root, lines, formulas=('32 : 4 = 8',), *, other_html=''):
        html = root / 'sheet.html'
        html.write_text('<html><body>' + other_html + '<div class="answers"><h2>Answers</h2>'
                        + ''.join('<span class="ltr">' + formula + '</span>' for formula in formulas)
                        + '</div></body></html>', encoding='utf-8')
        pdf = root / 'sheet.pdf'
        document = pymupdf.open()
        for page_lines in lines:
            page = document.new_page()
            for x, y, text in page_lines:
                page.insert_text((x, y), text, fontsize=12)
        document.save(pdf);document.close()
        return pdf, html

    def test_actual_linux_weasyprint_passes_and_chromium_regression_fails(self):
        html = FIXTURES / 'answers.html'
        good = check_answer_order(FIXTURES / 'weasyprint.pdf', html)
        self.assertEqual(good, {'status': 'PASS', 'formulas': 18, 'answerStartPage': 4})
        with self.assertRaisesRegex(AnswerOrderError, 'PDF_ANSWER_LTR_ORDER'):
            check_answer_order(FIXTURES / 'chromium-broken.pdf', html)

    def test_physical_order_overrides_pdf_stream_order(self):
        with tempfile.TemporaryDirectory() as d:
            # Insert text in reverse stream order, while its physical x order
            # is correct. An extraction-string comparison is insufficient.
            pdf, html = self.make(Path(d), [[(40, 100, 'Answers'), (80, 150, '= 8'),
                (60, 150, ': 4'), (40, 150, '32')]])
            self.assertEqual(check_answer_order(pdf, html)['formulas'], 1)

    def test_reverse_split_interleaved_or_distant_formula_cannot_pass(self):
        cases = {
            'reversed': [(40, 150, '8 = 4 : 32')],
            'split_baseline': [(40, 150, '32 : 4'), (75, 170, '= 8')],
            'interleaved_prose': [(40, 150, '32 : prose 4 = 8')],
            'distant_glyphs': [(40, 150, '32'), (300, 150, ': 4 = 8')],
            'numeric_substring': [(40, 150, '132 : 4 = 80')],
        }
        for name, lines in cases.items():
            with self.subTest(name=name), tempfile.TemporaryDirectory() as d:
                pdf, html = self.make(Path(d), [[(40, 100, 'Answers')] + lines])
                with self.assertRaisesRegex(AnswerOrderError, 'PDF_ANSWER_LTR_ORDER'):
                    check_answer_order(pdf, html)

    def test_correct_question_formula_before_heading_cannot_mask_bad_answer(self):
        with tempfile.TemporaryDirectory() as d:
            pdf, html = self.make(Path(d), [[(40, 50, '32 : 4 = 8'), (40, 100, 'Answers'),
                (40, 150, '8 = 4 : 32')]], other_html='<span class="ltr">32 : 4 = 8</span>')
            with self.assertRaisesRegex(AnswerOrderError, 'PDF_ANSWER_LTR_ORDER'):
                check_answer_order(pdf, html)

    def test_prior_question_page_does_not_count_and_continued_answers_do(self):
        with tempfile.TemporaryDirectory() as d:
            pdf, html = self.make(Path(d), [[(40, 50, '32 : 4 = 8')],
                [(40, 100, 'Answers')], [(40, 80, '32 : 4 = 8')]])
            self.assertEqual(check_answer_order(pdf, html)['answerStartPage'], 2)
        with tempfile.TemporaryDirectory() as d:
            pdf, html = self.make(Path(d), [[(40, 50, '32 : 4 = 8')],
                [(40, 100, 'Answers'), (40, 150, '8 = 4 : 32')]])
            with self.assertRaisesRegex(AnswerOrderError, 'PDF_ANSWER_LTR_ORDER'):
                check_answer_order(pdf, html)

    def test_each_duplicate_expected_occurrence_is_required(self):
        with tempfile.TemporaryDirectory() as d:
            pdf, html = self.make(Path(d), [[(40, 100, 'Answers'), (40, 150, '32 : 4 = 8')]],
                                  formulas=('32:4=8', '32:4=8'))
            with self.assertRaisesRegex(AnswerOrderError, 'PDF_ANSWER_LTR_ORDER'):
                check_answer_order(pdf, html)

    def test_heading_and_html_presence_are_required(self):
        for lines in [[(40, 150, '32 : 4 = 8')], [(40, 100, 'Answers'),
                      (40, 120, 'Answers'), (40, 150, '32 : 4 = 8')]]:
            with tempfile.TemporaryDirectory() as d:
                pdf, html = self.make(Path(d), [lines])
                with self.assertRaisesRegex(AnswerOrderError, 'PDF_ANSWER_HEADING'):
                    check_answer_order(pdf, html)
                html.unlink()
                with self.assertRaisesRegex(AnswerOrderError, 'ANSWER_PDF_OR_HTML_MISSING'):
                    check_answer_order(pdf)

    def test_nested_operands_are_not_skipped_or_double_counted(self):
        with tempfile.TemporaryDirectory() as d:
            pdf, html = self.make(Path(d), [[(40, 100, 'Answers'), (40, 150, '32 : 4 = 8')]],
                formulas=('32 : <span class="ltr">4</span> = 8',))
            self.assertEqual(check_answer_order(pdf, html)['formulas'], 1)

    def test_nonflat_equation_fails_explicitly(self):
        with tempfile.TemporaryDirectory() as d:
            pdf, html = self.make(Path(d), [[(40, 100, 'Answers'), (40, 150, '32 : 4 = 8')]],
                formulas=('<span class="frac">32 4</span> = 8',))
            with self.assertRaisesRegex(AnswerOrderError, 'ANSWER_FORMULA_NOT_FLAT_TEXT'):
                check_answer_order(pdf, html)

    def test_launcher_fails_after_upstream_pass_and_infers_sibling_html(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            pdf, html = self.make(root, [[(40, 100, 'Answers'), (40, 150, '8 = 4 : 32')]])
            lib = root / 'skill/scripts/lib';lib.mkdir(parents=True)
            (lib / 'gates_runner.py').write_text('def run_output_gates(*a, **kw): pass\n')
            args = [sys.executable, '-B', str(HERE / 'output_gates.py'), '--skill', str(root / 'skill'),
                    '--pdf', str(pdf), '--band', 'elementary']
            result = subprocess.run(args, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('PDF-answer-LTR FAIL PDF_ANSWER_LTR_ORDER', result.stderr)


if __name__ == '__main__':
    unittest.main()
