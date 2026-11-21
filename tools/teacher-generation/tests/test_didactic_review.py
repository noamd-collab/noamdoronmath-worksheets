"""A REVIEW may become a private draft; genuine build failures never may."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from didactic_review import reconcile


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.skill=self.root/'skill';self.skill.mkdir()
        self.work=self.root/'work';(self.work/'out/deliver/b').mkdir(parents=True)
        self.artifact=self.work/'out/deliver/b/sheet.pdf';self.artifact.write_bytes(b'unit-test-only')
        (self.work/'out/deliver/b/sheet.json').write_bytes(b'{}')
        (self.work/'out/docx/b').mkdir(parents=True)
        (self.work/'out/docx/b/sheet.docx').write_bytes(b'unit-test-word')
        self.report={'result':'FAIL','steps':[{'step':name,'status':'PASS'} for name in (
            'build_plus (PDF + gates)','check_plain_math.py','verify_export.py',
            'selfcheck_noam_package.py','emit_docx b','check_docx_rtl b')]+
            [{'step':'check_didactic.py','status':'FAIL'}],
            'gates':[{'gate':'G90/G91-docx','level':'b','status':'PASS'}],
            'files':{p.relative_to(self.work/'out').as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
                     for p in (self.work/'out').rglob('*') if p.is_file()}}
        self.write_checker('REVIEW');self.write_report()

    def write_report(self):
        (self.work/'out/v72-report.json').write_text(json.dumps(self.report))

    def write_checker(self,status):
        # This is a test-controlled fixture for the already verified skill,
        # never model-supplied executable data.
        (self.skill/'check_didactic.py').write_text(
            'def _tools(): return {}\ndef check_level(path,tools):\n'
            f'    return [({status!r}, "D10", "q1", "human review required")], ["q1"]\n')

    def test_review_preserves_original_report_and_output_hashes(self):
        before=(self.work/'out/v72-report.json').read_bytes()
        result=reconcile(self.skill,self.work,'b')
        self.assertEqual(result['status'],'REVIEW');self.assertEqual(result['failures'],0)
        self.assertEqual(result['count'],1)
        self.assertEqual((self.work/'out/v72-report.json').read_bytes(),before)
        self.assertEqual(result['originalReportSha256'],hashlib.sha256(before).hexdigest())

    def test_any_other_failing_step_blocks(self):
        self.report['steps'][0]['status']='FAIL';self.write_report()
        with self.assertRaisesRegex(ValueError,'BLOCKING_BUILD_FAILURE'):reconcile(self.skill,self.work,'b')

    def test_genuine_didactic_failure_blocks(self):
        self.write_checker('FAIL')
        with self.assertRaisesRegex(ValueError,'DIDACTIC_HAS_FAIL'):reconcile(self.skill,self.work,'b')

    def test_failing_gate_or_missing_word_check_blocks(self):
        self.report['gates'][0]['status']='FAIL';self.write_report()
        with self.assertRaisesRegex(ValueError,'BLOCKING_GATE_FAILURE'):reconcile(self.skill,self.work,'b')
        self.report['gates'][0]['status']='PASS';self.report['steps'][5]['status']='SKIP';self.write_report()
        with self.assertRaisesRegex(ValueError,'REQUIRED_BUILD_CHECK_MISSING'):reconcile(self.skill,self.work,'b')

    def test_changed_output_cannot_inherit_past_review(self):
        self.artifact.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'BUILD_OUTPUT_CHANGED'):reconcile(self.skill,self.work,'b')

    def test_missing_inventory_or_word_gate_blocks(self):
        self.report['files']={};self.write_report()
        with self.assertRaisesRegex(ValueError,'REQUIRED_OUTPUT_HASH_MISSING'):reconcile(self.skill,self.work,'b')
        self.report['gates']=[];self.write_report()
        with self.assertRaisesRegex(ValueError,'REQUIRED_WORD_GATE_MISSING'):reconcile(self.skill,self.work,'b')


if __name__=='__main__':unittest.main()
