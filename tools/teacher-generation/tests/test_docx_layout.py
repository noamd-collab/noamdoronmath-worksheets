import copy
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from lxml import etree as ET

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from docx_layout import CHECK_INSTRUCTION, INVERSE_INSTRUCTION, NS, W, WORK_MARKER, repair_elementary_docx


class WordLayoutTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'sheet.docx'
        root = ET.Element(W + 'document', nsmap={'w': W[1:-1]})
        body = ET.SubElement(root, W + 'body')
        self.content = {'questions': [{'intro': 'פתרו:', 'star': False, 'items': ['a', 'b', 'c']} for _ in range(12)]}
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

    def write_xml(self, root):
        with ZipFile(self.path) as archive:
            members = {name: archive.read(name) for name in archive.namelist()}
        members['word/document.xml'] = ET.tostring(root)
        with ZipFile(self.path, 'w') as archive:
            for name, data in members.items(): archive.writestr(name, data)

    def use_live_grade3_instruction_plan(self):
        root = self.read_xml()
        headings = root.find(W + 'body').findall(W + 'p')[::4]
        for number, (question, heading) in enumerate(zip(self.content['questions'], headings), 1):
            base = CHECK_INSTRUCTION if number in (3, 7, 11) else 'פתרו:' if number in (1, 5, 9) else 'השלימו את המספר החסר:'
            question['star'] = number >= 10
            question['intro'] = base + (INVERSE_INSTRUCTION if question['star'] else '')
            heading.find('.//w:t', NS).text = f'{number}. ' + ('★  ' if question['star'] else '') + question['intro']
        self.write_xml(root)

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

    def test_live_grade3_plan_adds_18_rtl_work_lines_without_changing_text(self):
        self.use_live_grade3_instruction_plan()
        original = ''.join(self.read_xml().itertext())
        result = repair_elementary_docx(self.path, self.content)
        root = self.read_xml()
        marks = root.findall('.//w:bookmarkStart', NS)
        self.assertEqual(len(marks), 18)
        self.assertEqual(result['answerLines'], 18)
        self.assertEqual(result['answerLinesAdded'], 18)
        self.assertEqual(''.join(root.itertext()).replace('\u00a0', ' '), original)
        self.assertEqual({q: sum(m.get(W + 'name').startswith(f'{WORK_MARKER}q{q:02}_') for m in marks)
                          for q in (3, 7, 10, 11, 12)}, {3: 3, 7: 3, 10: 3, 11: 6, 12: 3})
        self.assertEqual(len({m.get(W + 'id') for m in marks}), 18)
        for mark in marks:
            p = mark.getparent(); props = p.find(W + 'pPr')
            self.assertEqual([child.tag for child in props], [W + n for n in ('keepNext', 'keepLines', 'pBdr', 'bidi', 'spacing')])
            self.assertIsNone(props.find(W + 'jc'))
            self.assertEqual(props.find(W + 'bidi').get(W + 'val'), '1')
            self.assertEqual(props.find(W + 'spacing').get(W + 'lineRule'), 'atLeast')
            self.assertEqual(props.find(W + 'spacing').get(W + 'line'), '360')
            self.assertEqual([c.tag for c in props.find(W + 'pBdr')], [W + 'bottom', W + 'between'])
        for q in (3, 7, 10, 11, 12):
            last = next(m for m in marks if m.get(W + 'name') == f'{WORK_MARKER}q{q:02}_i03_l{2 if q == 11 else 1:02}')
            self.assertEqual(last.getparent().find('w:pPr/w:keepNext', NS).get(W + 'val'), '0')

    def test_work_line_repair_is_idempotent(self):
        self.use_live_grade3_instruction_plan()
        repair_elementary_docx(self.path, self.content)
        before = self.path.read_bytes()
        result = repair_elementary_docx(self.path, self.content)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(result['answerLines'], 18)
        self.assertEqual(result['answerLinesAdded'], 0)

    def test_unknown_instruction_or_mismatched_heading_fails_before_write(self):
        before = self.path.read_bytes()
        for change in ({'intro': 'Do arbitrary new work'}, {'star': True}, {'intro': CHECK_INSTRUCTION}, {'star': 'false'}):
            with self.subTest(change=change):
                content = copy.deepcopy(self.content); content['questions'][0].update(change)
                with self.assertRaisesRegex(ValueError, 'DOCX_LAYOUT_MISMATCH'):
                    repair_elementary_docx(self.path, content)
                self.assertEqual(before, self.path.read_bytes())

    def test_partially_removed_work_lines_fail_before_write(self):
        self.use_live_grade3_instruction_plan()
        repair_elementary_docx(self.path, self.content)
        root = self.read_xml(); mark = root.find('.//w:bookmarkStart', NS)
        mark.getparent().getparent().remove(mark.getparent())
        self.write_xml(root); before = self.path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'incomplete work paragraphs'):
            repair_elementary_docx(self.path, self.content)
        self.assertEqual(before, self.path.read_bytes())

    def test_modified_work_layout_fails_without_erasing_the_change(self):
        self.use_live_grade3_instruction_plan()
        repair_elementary_docx(self.path, self.content)
        root = self.read_xml(); mark = root.find('.//w:bookmarkStart', NS)
        props = mark.getparent().find(W + 'pPr')
        ET.SubElement(props, W + 'jc').set(W + 'val', 'right')
        self.write_xml(root); before = self.path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'modified work layout'):
            repair_elementary_docx(self.path, self.content)
        self.assertEqual(before, self.path.read_bytes())


if __name__ == '__main__':
    unittest.main()
