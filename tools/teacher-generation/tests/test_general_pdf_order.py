"""Coordinate-controlled PDF regressions for two-dimensional answer layout."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import pymupdf

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
from general_pdf_order import AnswerOrderError, check_answer_order, _heading_key


def fraction(n,d):
    return '<span class="frac"><span class="fnum">'+str(n)+'</span><span class="fden">'+str(d)+'</span></span>'


def formula(a,b,operator,c,d):
    return '<span class="ltr">'+fraction(a,b)+operator.replace('<','&lt;').replace('>','&gt;')+fraction(c,d)+'</span>'


class GeneralAnswerLayoutTests(unittest.TestCase):
    def make(self,root,expected,visual,*,question_copy=False,without_rules=False,rule_opacity=1,rule_color=(0,0,0),text_opacity=1,heading_opacity=1):
        html=root/'sheet.html';pdf=root/'sheet.pdf'
        html.write_text('<div class="answers"><h2>Answers</h2><table class="ans">'+''.join(
            '<tr><td class="qn"><span class="ltr">%d.</span></td><td>'%(i+1)+''.join(row)+'</td></tr>' for i,row in enumerate(expected))+'</table></div>')
        document=pymupdf.open()
        def draw(page,rows,heading):
            if heading:page.insert_text((220,70),'Answers',fontsize=14,fill_opacity=heading_opacity)
            for row_index,row in enumerate(rows):
                top=100+row_index*80
                page.draw_rect(pymupdf.Rect(50,top,550,top+70));page.draw_line((510,top),(510,top+70))
                page.insert_text((528,top+24),str(row_index+1)+'.',fontsize=12)
                for column,(a,b,operator,c,d) in enumerate(row):
                    x=400-column*130;bar_y=top+35
                    for offset,numerator,denominator in [(0,a,b),(43,c,d)]:
                        if not without_rules:page.draw_line((x+offset,bar_y),(x+offset+20,bar_y),width=.8,stroke_opacity=rule_opacity,color=rule_color)
                        for value,y in [(numerator,top+28),(denominator,top+50)]:
                            text=str(value);width=pymupdf.get_text_length(text,fontsize=10)
                            page.insert_text((x+offset+10-width/2,y),text,fontsize=10,fill_opacity=text_opacity)
                    page.insert_text((x+28,top+39.5),operator,fontsize=12)
        if question_copy:
            draw(document.new_page(),[[(2,7,'<',3,5)]],False)
        draw(document.new_page(),visual,True)
        document.save(pdf);document.close();return pdf,html

    def test_stacked_numerator_denominator_and_each_comparison_operator(self):
        with tempfile.TemporaryDirectory() as d:
            values=[(2,7,'<',3,5),(3,5,'>',2,7),(1,3,'=',1,3)]
            pdf,html=self.make(Path(d),[[formula(*v)]for v in values],[[v]for v in values])
            self.assertEqual(check_answer_order(pdf,html),{'status':'PASS','formulas':3,'answerStartPage':1,'answerRows':3})

    def test_inverted_fraction_reversed_operator_and_operand_order_fail(self):
        for bad in [(7,2,'<',3,5),(2,7,'>',3,5),(3,5,'>',2,7),(2,17,'<',3,5)]:
            with self.subTest(bad=bad),tempfile.TemporaryDirectory() as d:
                pdf,html=self.make(Path(d),[[formula(2,7,'<',3,5)]],[[bad]])
                with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):
                    check_answer_order(pdf,html)

    def test_correct_question_before_heading_cannot_mask_wrong_answer(self):
        with tempfile.TemporaryDirectory() as d:
            pdf,html=self.make(Path(d),[[formula(2,7,'<',3,5)]],[[(7,2,'<',3,5)]],question_copy=True)
            with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):
                check_answer_order(pdf,html)

    def test_math_in_other_question_row_cannot_be_reused(self):
        a,b=(2,7,'<',3,5),(4,9,'>',1,9)
        with tempfile.TemporaryDirectory() as d:
            pdf,html=self.make(Path(d),[[formula(*a)],[formula(*b)]],[[b],[a]])
            with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):
                check_answer_order(pdf,html)

    def test_subanswers_must_match_hebrew_order_and_cannot_reuse_one_instance(self):
        a,b=(2,7,'<',3,5),(4,9,'>',1,9)
        for expected,visual in [([formula(*a),formula(*b)],[b,a]),([formula(*a),formula(*a)],[a])]:
            with tempfile.TemporaryDirectory() as d:
                pdf,html=self.make(Path(d),[expected],[visual])
                with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):
                    check_answer_order(pdf,html)
        with tempfile.TemporaryDirectory() as d:
            pdf,html=self.make(Path(d),[[formula(*a),formula(*b)]],[[a,b]])
            self.assertEqual(check_answer_order(pdf,html)['formulas'],2)

    def test_a_fraction_requires_an_actual_visible_rule(self):
        with tempfile.TemporaryDirectory() as d:
            pdf,html=self.make(Path(d),[[formula(2,7,'<',3,5)]],[[(2,7,'<',3,5)]],without_rules=True)
            with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):
                check_answer_order(pdf,html)

    def test_transparent_or_white_fraction_rules_cannot_satisfy_layout(self):
        for properties in [{'rule_opacity':0},{'rule_color':(1,1,1)}]:
            with tempfile.TemporaryDirectory() as d:
                pdf,html=self.make(Path(d),[[formula(2,7,'<',3,5)]],[[(2,7,'<',3,5)]],**properties)
                with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):check_answer_order(pdf,html)

    def test_invisible_text_layer_cannot_supply_missing_visible_operands(self):
        with tempfile.TemporaryDirectory() as d:
            pdf,html=self.make(Path(d),[[formula(2,7,'<',3,5)]],[[(2,7,'<',3,5)]],text_opacity=0)
            with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):check_answer_order(pdf,html)

    def test_invisible_heading_cannot_establish_answer_region(self):
        with tempfile.TemporaryDirectory() as d:
            pdf,html=self.make(Path(d),[[formula(2,7,'<',3,5)]],[[(2,7,'<',3,5)]],heading_opacity=0)
            with self.assertRaisesRegex(AnswerOrderError,'PDF_ANSWER_HEADING'):check_answer_order(pdf,html)

    def test_missing_question_label_or_cell_borders_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);pdf,html=self.make(root,[[formula(2,7,'<',3,5)]],[[(2,7,'<',3,5)]])
            doc=pymupdf.open(pdf);doc[0].add_redact_annot(pymupdf.Rect(520,105,550,130));doc[0].apply_redactions()
            altered=root/'altered.pdf';doc.save(altered);doc.close()
            with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_CELL'):
                check_answer_order(altered,html)

    def test_general_launcher_uses_new_gate_but_legacy_remains_flat_only(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);pdf,html=self.make(root,[[formula(2,7,'<',3,5)]],[[(2,7,'<',3,5)]])
            lib=root/'skill/scripts/lib';lib.mkdir(parents=True)
            (lib/'gates_runner.py').write_text('def run_output_gates(*a, **kw): pass\n')
            args=[sys.executable,'-B',str(HERE/'output_gates.py'),'--skill',str(root/'skill'),'--pdf',str(pdf),'--band','elementary']
            completed=subprocess.run(args+['--general'],capture_output=True,text=True)
            self.assertEqual(completed.returncode,0,completed.stderr)
            self.assertIn('PASS 1 formula',completed.stdout)
            # Legacy deliberately skips comparisons; its equation limitation
            # remains tested by test_elementary_pdf_order.py without edits.

    def test_plain_numeric_math_islands_and_comparisons_remain_verified(self):
        for expected,shown,passes in [('23','23',True),('23','123',False),('2 &lt; 7','2 < 7',True),('2 &lt; 7','2 > 7',False)]:
            with tempfile.TemporaryDirectory() as d:
                root=Path(d);pdf,html=self.make(root,[['<span class="ltr">'+expected+'</span>']],[[]])
                doc=pymupdf.open(pdf);doc[0].insert_text((420,139.5),shown,fontsize=12)
                edited=root/'flat.pdf';doc.save(edited);doc.close()
                if passes:self.assertEqual(check_answer_order(edited,html)['formulas'],1)
                else:
                    with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):check_answer_order(edited,html)

    def test_vocalized_heading_identity_ignores_only_combining_marks(self):
        source='תְּשׁוּבוֹת סוֹפִיּוֹת'
        physical='תֹויִּפֹוסתֹובוּׁשְּת'
        self.assertEqual(_heading_key(source),_heading_key(physical)[::-1])
        self.assertNotEqual(_heading_key(source),_heading_key('תשובות אחרות'))

    def test_currency_amounts_require_exact_painted_digits_sign_and_order(self):
        font = pymupdf.Font(script=pymupdf.UCDN_SCRIPT_LATIN, language="he")
        self.assertTrue(font.has_glyph(ord("₪")))
        for values, passes in [
            (["27 ₪", "27 ₪", "0 ₪"], True),
            (["27 ₪", "0 ₪", "27 ₪"], False),
            (["27 ₪", "", "0 ₪"], False),
            (["27 ₪", "₪ 27", "0 ₪"], False),
            (["27 ₪", "27 ₪₪", "0 ₪"], False),
            (["27 ₪", "27", "0 ₪"], False),
        ]:
            with self.subTest(values=values), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                expected = ['<span class="ltr">'+s+'</span>' for s in ["27 ₪", "27 ₪", "0 ₪"]]
                pdf, html = self.make(root, [expected], [[]])
                with pymupdf.open(pdf) as doc:
                    pg = doc[0]
                    pg.insert_font(fontname="CashTest", fontbuffer=font.buffer)
                    for i, value in enumerate(values):
                        pg.insert_text((430 - i*95, 139.5), value, fontsize=12, fontname="CashTest")
                    edited = root / "currency.pdf"
                    doc.save(edited)
                if passes:
                    self.assertEqual(check_answer_order(edited, html)["formulas"], 3)
                else:
                    with self.assertRaisesRegex(AnswerOrderError, "GENERAL_ANSWER_VISUAL_ORDER"):
                        check_answer_order(edited, html)
        with tempfile.TemporaryDirectory() as temp:
            pdf, html = self.make(Path(temp), [['<span class="ltr">27 @</span>']], [[]])
            with self.assertRaisesRegex(AnswerOrderError, "GENERAL_ANSWER_UNSUPPORTED_MATH_TEXT"):
                check_answer_order(pdf, html)

    def test_superscript_is_raised_after_its_base_not_flat_or_below(self):
        for placement in ['raised','flat','below','before']:
            with tempfile.TemporaryDirectory() as d:
                root=Path(d);pdf,html=self.make(root,[['<span class="ltr">2<sup>3</sup> = 8</span>']],[[]])
                doc=pymupdf.open(pdf);page=doc[0]
                page.insert_text((400,139.5),'2',fontsize=12)
                page.insert_text((398 if placement=='before' else 407,139.5 if placement=='flat' else 146 if placement=='below' else 133.5),'3',fontsize=12 if placement=='flat' else 8)
                page.insert_text((417,139.5),'= 8',fontsize=12)
                edited=root/'power.pdf';doc.save(edited);doc.close()
                if placement=='raised':self.assertEqual(check_answer_order(edited,html)['formulas'],1)
                else:
                    with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_VISUAL_ORDER'):check_answer_order(edited,html)

    def test_unattached_or_nested_noninteger_superscripts_fail_closed(self):
        for value in ['<sup>2</sup>3','2<sup>x</sup>','2<sup>3<sup>2</sup></sup>','2<sup>100</sup>']:
            with tempfile.TemporaryDirectory() as d:
                pdf,html=self.make(Path(d),[['<span class="ltr">'+value+'</span>']],[[]])
                with self.assertRaisesRegex(AnswerOrderError,'GENERAL_ANSWER_SUPERSCRIPT_STRUCTURE'):check_answer_order(pdf,html)


if __name__=='__main__':unittest.main()
