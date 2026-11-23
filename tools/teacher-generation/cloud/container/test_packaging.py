"""Host-safe tests. No Docker, network, credentials, model or live worker."""
import gzip
import hashlib
import io
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest
from xml.etree import ElementTree
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
APP = HERE.parents[1]
REPO = APP.parents[1]
sys.path[:0] = [str(HERE), str(APP)]
import skill_bundle as bundle
from bounded_worker import run
from provider import derive_author_parameters
from validation import validate_lesson, validate_model
from author_quality import prepare_didactics


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.lock = json.loads((APP / 'skill-lock.json').read_text())

    def test_all_skill_archive_bytes_and_exact_members(self):
        manifest = json.loads((HERE / 'skills/skill-archives.json').read_text())
        self.assertEqual(manifest['skillLockSha256'], bundle.sha((APP / 'skill-lock.json').read_bytes()))
        for kind in ('elementary', 'middle'):
            blob = (HERE / 'skills' / (kind + '.tar.gz')).read_bytes()
            self.assertEqual(bundle.sha(blob), manifest['archives'][kind]['sha256'])
            self.assertEqual(len(bundle.verify(kind, blob, self.lock)), manifest['archives'][kind]['files'])

    def test_private_middle_closing_stays_with_last_question(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "skills"
            bundle.install(HERE / "skills", root, APP / "skill-lock.json")
            middle = root / "middle"
            self.assertRegex((middle / "emit_html.py").read_text(), r"\.good\s*\{[^}]*break-before:\s*avoid")
            spec = importlib.util.spec_from_file_location("private_emit_docx", middle / "emit_docx.py")
            emitter = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(emitter)
            level = {"key": "b", "level": "רמה ב׳", "title": "תרגול", "questions": [
                {"n": 1, "intro": "כתבו תשובה.", "items": [("א", "הסבירו.", 30)]}
            ]}
            docx = Path(tmp) / "sheet.docx"
            emitter.build_docx(level, docx)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            with ZipFile(docx) as package:
                document = ElementTree.fromstring(package.read("word/document.xml"))
            body = list(document.find("w:body", ns))
            closing = next(i for i, p in enumerate(body) if
                           any(t.text == "בהצלחה!" for t in p.findall(".//w:t", ns)))
            self.assertGreater(closing, 0)
            self.assertIsNotNone(body[closing - 1].find("w:pPr/w:keepNext", ns))

    def test_private_middle_pdf_number_check_reads_a_raised_exponent_apart(self):
        # middle-pdf-raised-numbers.patch: 7² is the numbers 7 and 2, never 72;
        # a number printed on the line that no datum states still fails.
        script = r'''
import json, sys
sys.path.insert(0, sys.argv[1])
import deliver, pymupdf
doc = pymupdf.open(); page = doc.new_page()
page.insert_htmlbox(pymupdf.Rect(50, 50, 500, 200),
                    "<p>בדקו האם 7<sup>2</sup> &lt; 50 וחשבו את 2<sup>2</sup>. 72</p>")
doc.save(sys.argv[2])
got, pages = deliver.pdf_numbers(sys.argv[2])
level = {"questions": [{"n": 1, "intro": "בדקו האם $7^{2} < 50$ וחשבו את $2^{2}$.", "items": []}]}
print(json.dumps([sorted(got), deliver.stray_numbers(level, [], got, pages)]))
'''
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "skills"
            bundle.install(HERE / "skills", root, APP / "skill-lock.json")
            run = subprocess.run([sys.executable, "-P", "-c", script, str(root / "middle"), str(Path(tmp) / "n.pdf")],
                                 cwd=tmp, capture_output=True, text=True, timeout=120)
            self.assertEqual(run.returncode, 0, run.stderr[-1500:])
            got, strays = json.loads(run.stdout.strip().splitlines()[-1])
            self.assertEqual(got, ["2", "2", "2", "50", "7", "72"])
            self.assertEqual(strays, ["72"])

    def test_archive_is_reproducible_and_installs_without_existing_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'skills'
            bundle.install(HERE / 'skills', target, APP / 'skill-lock.json')
            for kind in ('elementary', 'middle'):
                self.assertEqual(bundle.build(kind, target / kind, self.lock),
                                 (HERE / 'skills' / (kind + '.tar.gz')).read_bytes())
            with self.assertRaises(ValueError):
                bundle.install(HERE / 'skills', target, APP / 'skill-lock.json')

    def test_tar_link_path_duplicate_and_tampering_fail_before_install(self):
        name = next(iter(self.lock['skills']['elementary']['files']))
        cases = [('x/../../escape', tarfile.REGTYPE), (name, tarfile.SYMTYPE),
                 ('unlisted.py', tarfile.REGTYPE), (name, tarfile.REGTYPE)]
        for filename, kind in cases:
            raw = io.BytesIO()
            with tarfile.open(fileobj=raw, mode='w:gz') as archive:
                member = tarfile.TarInfo(filename); member.type = kind
                member.size = 3 if kind == tarfile.REGTYPE else 0
                archive.addfile(member, io.BytesIO(b'bad') if member.size else None)
            with self.assertRaises(ValueError):
                bundle.verify('elementary', raw.getvalue(), self.lock)
        valid = bundle.verify('elementary', (HERE / 'skills/elementary.tar.gz').read_bytes(), self.lock)
        raw = io.BytesIO()
        with tarfile.open(fileobj=raw, mode='w:gz') as archive:
            for _ in range(2):
                member = tarfile.TarInfo(name); member.size = len(valid[name])
                archive.addfile(member, io.BytesIO(valid[name]))
        with self.assertRaises(ValueError):
            bundle.verify('elementary', raw.getvalue(), self.lock)

    def test_fixture_bytes_derivation_boundaries_and_quality_are_unchanged(self):
        manifest = json.loads((HERE / 'fixtures/manifest.json').read_text())
        for name, info in manifest['files'].items():
            raw = (HERE / 'fixtures' / name).read_bytes()
            self.assertEqual((len(raw), bundle.sha(raw)), (info['bytes'], info['sha256']))
        for case in ('grade3-division', 'grade7-positive', 'grade7-signed'):
            path = HERE / 'fixtures' / case
            lesson = json.loads((path / 'lesson.json').read_text())
            author = json.loads((path / 'author-parameters.json').read_text())
            canonical = json.loads((path / 'canonical.json').read_text())
            cap = validate_lesson(lesson)
            self.assertEqual(derive_author_parameters(lesson, cap, author), canonical)
            validate_model(lesson, canonical)
            prepare_didactics(lesson, canonical, cap)

    def test_context_is_exact_allowlist_without_secret_or_home_inputs(self):
        files = json.loads((HERE / 'context-files.json').read_text())['files']
        rules = (HERE / 'Dockerfile.dockerignore').read_text().splitlines()
        self.assertEqual(rules[0], '**')
        inclusions = [rule[1:] for rule in rules[1:] if rule and not rule.startswith('#')]
        self.assertTrue(all(rule.startswith('!') for rule in rules[1:] if rule and not rule.startswith('#')))
        self.assertEqual(set(files), {name for name in inclusions if not name.endswith('/')})
        for name in inclusions:
            self.assertNotIn('*', name)
            self.assertNotIn('..', Path(name).parts)
            self.assertTrue(name.startswith('tools/teacher-generation/'))
            self.assertFalse(any(p.startswith('.') or p in ('node_modules','local-output') for p in Path(name).parts))
        for name in files:
            path = REPO / name
            self.assertFalse(path.is_symlink())
            self.assertTrue(path.is_file(), name)
            self.assertNotIn('.env', name)
            self.assertNotIn('credentials', name.lower())

    def test_python_and_native_pins_match_dockerfile(self):
        docker = (HERE / 'Dockerfile').read_text()
        native = json.loads((HERE / 'native-pins.json').read_text())
        self.assertIn(native['image'], docker)
        for package, info in native['packages'].items():
            self.assertIn(package + '=' + info['version'], docker)
        locked = (HERE / 'requirements-linux-amd64.lock').read_text()
        wheels = json.loads((HERE / 'python-wheels.json').read_text())['wheels']
        self.assertEqual(len(wheels), 31)
        self.assertEqual({item['name']: item['version'] for item in wheels if item['name'] in ('sympy', 'mpmath')},
                         {'sympy': '1.14.0', 'mpmath': '1.3.0'})
        for item in wheels:
            self.assertIn(item['name'] + '==' + item['version'] + ' --hash=sha256:' + item['sha256'], locked)
        for line in (APP / 'requirements.txt').read_text().splitlines():
            if '==' in line and not line.startswith('#'):
                self.assertIn(line.lower() + ' --hash=', locked.lower())

    def test_wrapper_propagates_exit_and_bounds_unresponsive_process(self):
        self.assertEqual(run([sys.executable, '-c', 'raise SystemExit(7)'], wall_seconds=2, drain_seconds=.2), 7)
        start = time.monotonic()
        code = 'import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(10)'
        self.assertEqual(run([sys.executable, '-c', code], wall_seconds=.4, drain_seconds=.2), 124)
        self.assertLess(time.monotonic() - start, 3)

    def test_wrapper_cleans_descendant_after_parent_exits(self):
        with tempfile.TemporaryDirectory() as tmp:
            pidfile = str(Path(tmp) / 'pid')
            code = ('import subprocess,sys; from pathlib import Path; '
                    'p=subprocess.Popen([sys.executable,"-c","import time; time.sleep(30)"]); '
                    'Path(sys.argv[1]).write_text(str(p.pid))')
            self.assertEqual(run([sys.executable, '-c', code, pidfile], wall_seconds=3), 0)
            pid = int(Path(pidfile).read_text())
            # An orphan can briefly be a reaped-by-PID1 zombie, never running.
            state = subprocess.run(['ps', '-o', 'stat=', '-p', str(pid)], capture_output=True, text=True).stdout.strip()
            self.assertTrue(not state or state.startswith('Z'), state)


if __name__ == '__main__':
    unittest.main()
