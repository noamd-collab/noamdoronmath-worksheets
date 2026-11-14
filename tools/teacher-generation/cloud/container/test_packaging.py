"""Host-safe tests. No Docker, network, credentials, model or live worker."""
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest

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
        self.assertEqual(len(wheels), 29)
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
