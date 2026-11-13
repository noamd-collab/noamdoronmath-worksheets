import copy
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from lxml import etree as ET

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from docx_layout import NS, W, repair_elementary_docx


class WordLayoutTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'sheet.docx'
        root = ET.Element(W + 'document', nsmap={'w': W[1:-1]})
        body = ET.SubElement(root, W + 'body')
        self.content = {'questions': [{'items': ['a', 'b', 'c']} for _ in range(12)]}
        for number in range(1, 13):
            for text in [f'{number}. פתרו:', 'א. ', 'ב. ', 'ג. ']:
                paragraph = ET.SubElement(body, W + 'p')
                run = ET.SubElement(paragraph, W + 'r')
                ET.SubElement(run, W + 't').text = text
        answer = ET.SubElement(ET.SubElement(body, W + 'tbl'), W + 'p')
        for text, ltr in [('לכן השוויון אינו נכון. ', False), ('\u200e18 : 9 = 2\u200e', True), ('ordinary English text', True)]:
            run = ET.SubElement(answer, W + 'r')
            props = ET.SubElement(run, W + 'rPr')
            ET.SubElement(props, W + 'rtl').set(W + 'val', '0' if ltr else '1')
            ET.SubElement(run, W + 't').text = text
        with ZipFile(self.path, 'w') as archive:
            archive.writestr('word/document.xml', ET.tostring(root))
            archive.writestr('word/styles.xml', b'unchanged direction and formatting')

    def read_xml(self):
        with ZipFile(self.path) as archive:
            return ET.fromstring(archive.read('word/document.xml'))

    def test_split_ninth_question_and_detached_result_are_prevented(self):
        original_text = ''.join(self.read_xml().itertext())
        result = repair_elementary_docx(self.path, self.content)
        paragraphs = self.read_xml().find(W + 'body').findall(W + 'p')
        for start in range(0, 48, 4):
            group = paragraphs[start:start + 4]
            self.assertEqual([p.find('w:pPr/w:keepNext', NS).get(W + 'val') for p in group], ['1', '1', '1', '0'])
            self.assertTrue(all(p.find('w:pPr/w:keepLines', NS).get(W + 'val') == '1' for p in group))
            self.assertEqual([child.tag for child in group[0].find(W + 'pPr')], [W + 'keepNext', W + 'keepLines'])
            self.assertIsNone(group[0].find('w:pPr/w:pageBreakBefore', NS))
        text = ''.join(self.read_xml().itertext())
        self.assertEqual(text.replace('\u00a0', ' '), original_text)
        self.assertIn('\u200e18\u00a0:\u00a09\u00a0=\u00a02\u200e', text)
        self.assertIn('לכן השוויון אינו נכון. ', text)
        self.assertIn('ordinary English text', text)
        self.assertEqual(result['questionsKeptTogether'], 12)
        with ZipFile(self.path) as archive:
            self.assertEqual(archive.read('word/styles.xml'), b'unchanged direction and formatting')

    def test_unknown_export_structure_fails_without_changing_file(self):
        before = self.path.read_bytes()
        bad_content = copy.deepcopy(self.content)
        bad_content['questions'][8]['items'].append('extra')
        with self.assertRaisesRegex(ValueError, 'DOCX_LAYOUT_MISMATCH'):
            repair_elementary_docx(self.path, bad_content)
        self.assertEqual(before, self.path.read_bytes())

    def test_question_count_mismatch_fails_before_write(self):
        before = self.path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'heading count'):
            repair_elementary_docx(self.path, {'questions': self.content['questions'][:-1]})
        self.assertEqual(before, self.path.read_bytes())

    def test_repeated_repair_does_not_change_content_or_properties(self):
        repair_elementary_docx(self.path, self.content)
        before = self.path.read_bytes()
        result = repair_elementary_docx(self.path, self.content)
        self.assertEqual(before, self.path.read_bytes())
        self.assertEqual(result['mathRunsProtected'], 0)


if __name__ == '__main__':
    unittest.main()
