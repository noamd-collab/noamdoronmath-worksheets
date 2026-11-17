"""The Word-web diagnostic must preserve data and reject unsupported math."""
import copy
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path
from zipfile import ZipFile

from lxml import etree as E

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from docx_web_layout import M, W, simple_ltr_math


def fixture(path, expression='3x − 2 = 10', complex_math=False):
    root = E.Element(W+'document', nsmap={'w':W[1:-1], 'm':M[1:-1]})
    body = E.SubElement(root, W+'body')
    paragraph = E.SubElement(body, W+'p')
    props = E.SubElement(paragraph, W+'pPr')
    E.SubElement(props, W+'bidi')
    start = E.SubElement(paragraph, W+'bookmarkStart')
    start.set(W+'id', '1'); start.set(W+'name', 'q1a')
    run = E.SubElement(paragraph, W+'r')
    E.SubElement(run, W+'t').text = 'א. פתרו: '
    math = E.SubElement(paragraph, M+'oMath')
    box = E.SubElement(math, M+'box')
    bp=E.SubElement(box,M+'boxPr')
    E.SubElement(bp,M+'noBreak')
    ctrl=E.SubElement(bp,M+'ctrlPr')
    expr = E.SubElement(box, M+'e')
    mr = E.SubElement(expr, M+'r')
    style=E.SubElement(mr,M+'rPr')
    E.SubElement(style,M+'sty').set(M+'val','p')
    rp = E.SubElement(mr, W+'rPr')
    fonts=E.SubElement(rp,W+'rFonts')
    for attr in ('ascii','hAnsi','cs'):fonts.set(W+attr,'Cambria Math')
    E.SubElement(rp,W+'sz').set(W+'val','23')
    E.SubElement(rp,W+'szCs').set(W+'val','23')
    E.SubElement(rp, W+'rtl').set(W+'val', '0')
    ctrl.append(copy.deepcopy(rp))
    text=E.SubElement(mr,M+'t');text.text=expression
    text.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
    if complex_math:
        E.SubElement(expr, M+'f')
    E.SubElement(paragraph, W+'bookmarkEnd').set(W+'id', '1')
    with ZipFile(path, 'w') as archive:
        archive.writestr('word/document.xml', E.tostring(root))
        archive.writestr('word/styles.xml', b'unchanged sentinel')


class SimpleLtrMathTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name)/'source.docx'
        self.output = Path(self.tmp.name)/'output.docx'

    def test_exact_text_bookmarks_and_other_members_preserved(self):
        fixture(self.source)
        original = self.source.read_bytes()
        manifest = simple_ltr_math(self.source, self.output)
        self.assertEqual(self.source.read_bytes(), original)
        self.assertTrue(manifest['printedTextSequencePreserved'])
        self.assertTrue(manifest['bookmarksPreserved'])
        with ZipFile(self.output) as archive:
            self.assertEqual(archive.read('word/styles.xml'), b'unchanged sentinel')
            root = E.fromstring(archive.read('word/document.xml'))
        self.assertFalse(list(root.iter(M+'oMath')))
        text = list(root.iter(W+'t'))[-1]
        self.assertEqual(text.text, '\u200e3x − 2 = 10\u200e')
        self.assertEqual(text.getparent().find(W+'rPr').find(W+'rtl').get(W+'val'), '0')
        self.assertEqual(list(root.iter(W+'bookmarkStart'))[0].get(W+'name'), 'q1a')

    def test_complex_math_fails_without_output(self):
        fixture(self.source, complex_math=True)
        with self.assertRaisesRegex(ValueError, 'formatting properties'):
            simple_ltr_math(self.source, self.output)
        self.assertFalse(self.output.exists())

    def test_nonpilot_or_malformed_math_fails_without_output(self):
        for value in ('x/2 = 4', 'x² = 4', 'y = 7', '1 ++ 2', 'x = = 2', '<script>'):
            with self.subTest(value=value):
                fixture(self.source, value)
                with self.assertRaisesRegex(ValueError, 'pilot grammar'):
                    simple_ltr_math(self.source, self.output)
                self.assertFalse(self.output.exists())

    def test_negative_values_and_constants_are_supported(self):
        for number, value in enumerate(('−7', 'x = −15', '12x − 100 = −240', 'k = 0')):
            with self.subTest(value=value):
                fixture(self.source, value)
                report = simple_ltr_math(self.source, Path(self.tmp.name)/f'{number}.docx')
                self.assertEqual(report['convertedSimpleMathRuns'], 1)

    def test_semantic_formatting_and_unknown_attributes_rejected(self):
        for tag in ('vertAlign','strike','vanish','position'):
            with self.subTest(tag=tag):
                fixture(self.source)
                with ZipFile(self.source) as archive:
                    root=E.fromstring(archive.read('word/document.xml'))
                properties=list(root.iter(M+'r'))[0].find(W+'rPr')
                E.SubElement(properties,W+tag).set(W+'val','superscript')
                with ZipFile(self.source,'w') as archive:
                    archive.writestr('word/document.xml',E.tostring(root))
                with self.assertRaisesRegex(ValueError,'formatting properties'):
                    simple_ltr_math(self.source,self.output)
                self.assertFalse(self.output.exists())
        fixture(self.source)
        with ZipFile(self.source) as archive:
            root=E.fromstring(archive.read('word/document.xml'))
        list(root.iter(M+'box'))[0].set(M+'unknown','1')
        with ZipFile(self.source,'w') as archive:
            archive.writestr('word/document.xml',E.tostring(root))
        with self.assertRaisesRegex(ValueError,'mathematical formatting'):
            simple_ltr_math(self.source,self.output)

    def test_publish_failure_leaves_no_partial_output(self):
        fixture(self.source)
        with mock.patch('os.link',side_effect=OSError('simulated publication failure')):
            with self.assertRaises(OSError):
                simple_ltr_math(self.source,self.output)
        self.assertFalse(self.output.exists())
        self.assertEqual(sorted(p.name for p in Path(self.tmp.name).iterdir()),['source.docx'])

    def test_mid_zip_write_failure_leaves_no_partial_output(self):
        fixture(self.source)
        original_write = ZipFile.writestr
        calls = []
        def fail_second(archive, *args, **kwargs):
            calls.append(1)
            if len(calls) == 2:
                raise OSError('simulated member write failure')
            return original_write(archive, *args, **kwargs)
        with mock.patch.object(ZipFile, 'writestr', new=fail_second):
            with self.assertRaises(OSError):
                simple_ltr_math(self.source, self.output)
        self.assertFalse(self.output.exists())
        self.assertEqual(sorted(p.name for p in Path(self.tmp.name).iterdir()), ['source.docx'])

    def test_answer_subitems_stay_together_without_chaining_next_question(self):
        fixture(self.source)
        with ZipFile(self.source) as archive:
            root = E.fromstring(archive.read('word/document.xml'))
        table = E.SubElement(root.find(W+'body'), W+'tbl')
        for _ in range(2):
            row = E.SubElement(table, W+'tr')
            E.SubElement(E.SubElement(row,W+'trPr'), W+'cantSplit')
            cell = E.SubElement(row, W+'tc')
            paragraph = E.SubElement(cell, W+'p')
            props = E.SubElement(paragraph, W+'pPr')
            E.SubElement(props, W+'bidi')
            for letter in 'אבג':
                E.SubElement(E.SubElement(paragraph,W+'r'),W+'t').text = letter+'.'
                E.SubElement(E.SubElement(paragraph,W+'r'),W+'t').text = ' פתרון  '
        with ZipFile(self.source,'w') as archive:
            archive.writestr('word/document.xml', E.tostring(root))
        report = simple_ltr_math(self.source,self.output)
        self.assertEqual(report['answerSubitemParagraphs'], 6)
        with ZipFile(self.output) as archive:
            output = E.fromstring(archive.read('word/document.xml'))
        for row in output.iter(W+'tr'):
            self.assertEqual(row.find(W+'trPr').find(W+'cantSplit').get(W+'val'), '1')
            paragraphs = list(row.iter(W+'p'))
            self.assertEqual(len(paragraphs), 3)
            for index, paragraph in enumerate(paragraphs):
                properties = paragraph.find(W+'pPr')
                self.assertIsNotNone(properties.find(W+'keepLines'))
                self.assertEqual(properties.find(W+'keepNext') is not None, index < 2)
                self.assertLess(list(properties).index(properties.find(W+'keepLines')), list(properties).index(properties.find(W+'bidi')))

    def test_cannot_overwrite_input_or_existing_output(self):
        fixture(self.source)
        for destination in (self.source, self.output):
            if destination != self.source:
                destination.write_bytes(b'existing')
            before = destination.read_bytes()
            with self.assertRaisesRegex(ValueError, 'new output path'):
                simple_ltr_math(self.source, destination)
            self.assertEqual(destination.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
