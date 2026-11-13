"""Final Word artifacts must be gated without invalidating upstream evidence."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import runner


class RunnerWordWebTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.work=Path(self.tmp.name)/'job'
        self.skill=Path(self.tmp.name)/'skill';self.skill.mkdir()
        self.lesson={'version':2,'gradeNumber':7,'topicId':'g7:equations','level':'b'}
        self.cap={'skill':'middle','family':'linear_equation'}
        self.calls=[]

    def run_pipeline(self, fail=None, mutate_original=False):
        def execute(args, **kwargs):
            name=Path(args[2]).name;self.calls.append(name)
            if name=='build_v72.py':
                for name,data in (
                    ('out/docx/b/sheet.docx',b'upstream native Word'),
                    ('out/deliver/b/sheet.pdf',b'original PDF'),
                    ('out/deliver/b/sheet.json',b'{}'),
                    ('out/v72-report.json',b'{"upstream":"unchanged"}'),
                ):
                    path=self.work/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
            if name=='docx_web_layout.py':
                source=self.work/'out/docx/b/sheet.docx'
                final=self.work/'out/docx/b/sheet-web.docx';final.write_bytes(b'final Word')
                report={'sourceSha256':runner.sha(source),'outputSha256':runner.sha(final),
                    'printedTextSequencePreserved':True,'bookmarksPreserved':True}
                (self.work/'logs/word-web-layout.json').write_text(json.dumps(report))
                if mutate_original:source.write_bytes(b'changed upstream')
            return SimpleNamespace(stdout='',stderr='',returncode=1 if name==fail else 0)
        with patch.object(runner,'validate_model',return_value=self.cap), \
             patch.object(runner,'verify_skill',return_value=(self.skill,{'version':'pinned','sha256':'a'*64})), \
             patch.object(runner.subprocess,'run',side_effect=execute):
            return runner.render_job(self.lesson,{},self.work,skill_paths={'middle':self.skill})

    def test_final_artifact_gated_and_upstream_preserved(self):
        report=self.run_pipeline()
        self.assertTrue(report['automatedChecksPassed'])
        self.assertEqual(report['status'],'needs_review')
        self.assertEqual([a['path'] for a in report['artifacts']],
            ['out/deliver/b/sheet.pdf','out/docx/b/sheet-web.docx'])
        evidence=report['wordPostprocess']
        self.assertEqual(evidence['sourceDocx']['sha256'],hashlib.sha256(b'upstream native Word').hexdigest())
        self.assertEqual((self.work/'out/docx/b/sheet.docx').read_bytes(),b'upstream native Word')
        self.assertEqual((self.work/'out/v72-report.json').read_bytes(),b'{"upstream":"unchanged"}')
        self.assertEqual(evidence['finalDocx']['sha256'],report['artifacts'][1]['sha256'])
        self.assertEqual(self.calls[-2:],['docx_web_layout.py','check_docx_rtl.py'])
        self.assertIn('pending',report['review']['visual'])

    def test_failed_postprocessor_or_final_gate_never_exposes_artifacts(self):
        for fail in ('docx_web_layout.py','check_docx_rtl.py'):
            with self.subTest(fail=fail),tempfile.TemporaryDirectory() as tmp:
                self.work=Path(tmp)/'job';self.calls=[]
                report=self.run_pipeline(fail=fail)
                self.assertFalse(report['automatedChecksPassed'])
                self.assertEqual(report['status'],'failed')
                self.assertEqual(report['artifacts'],[])
                self.assertNotIn('wordPostprocess',report)

    def test_changed_upstream_file_fails_provenance(self):
        report=self.run_pipeline(mutate_original=True)
        self.assertFalse(report['automatedChecksPassed'])
        self.assertEqual(report['artifacts'],[])
        self.assertNotIn('check_docx_rtl.py',self.calls)
        self.assertIn({'name':'word-source-provenance','status':'FAIL'},report['steps'])

    def test_future_middle_topics_do_not_silently_use_this_repair(self):
        self.lesson['topicId']='g8:another-topic'
        with patch.object(runner,'validate_model',return_value=self.cap), \
             patch.object(runner.subprocess,'run') as execute:
            with self.assertRaises(runner.GenerationError) as caught:
                runner.render_job(self.lesson,{},self.work,skill_paths={'middle':self.skill})
        self.assertEqual(caught.exception.code,'UNSUPPORTED_WORD_LAYOUT')
        execute.assert_not_called()
        self.assertFalse(self.work.exists())


if __name__=='__main__':unittest.main()
