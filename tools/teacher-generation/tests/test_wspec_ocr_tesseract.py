"""Protocol/resource regressions; real OCR cases run only if already installed."""
from pathlib import Path
import importlib.util
import io
import os
import signal
import subprocess
import sys
import tempfile
import tarfile
import textwrap
import time
import types
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import wspec_ocr_tesseract as OCR

HEADER = '\t'.join(OCR.TSV_FIELDS) + '\n'


def word(text, confidence=91.25, *, number=1, line=1):
    return '\t'.join(map(str, (5, 1, 1, 1, line, number, 0, 0, 30, 20, confidence, text))) + '\n'


class HelperTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.raster = self.root / 'crop with spaces.png'
        Image.new('RGB', (160, 64), 'white').save(self.raster)

    def fake(self, body):
        path = self.root / 'fake-tesseract'
        path.write_text('#!' + sys.executable + '\n' + textwrap.dedent(body), encoding='utf-8')
        path.chmod(0o700)
        return path

    def invoke(self, binary, paths=None, lang='en-US'):
        output = io.StringIO()
        with patch.object(OCR, 'TESSERACT_PATHS', (binary,)):
            code = OCR.main(['--lang', lang, *map(str, paths or [self.raster])], output=output)
        return code, output.getvalue()

    def test_actual_subprocess_protocol_and_exact_normalized_confidence(self):
        script = self.fake('''
            import os,sys
            from pathlib import Path
            assert sys.argv[2:] == ['stdout','-l','eng','--psm','6','tsv']
            assert Path(sys.argv[1]).read_bytes().startswith(b'\\x89PNG')
            assert 'QWEN_API_KEY' not in os.environ
            assert 'TESSDATA_PREFIX' not in os.environ
            sys.stdout.write(%r)
        ''' % (HEADER + word('A', 87.5) + word('12', 92, line=2)))
        with patch.dict(os.environ, {'QWEN_API_KEY': 'must-not-leak', 'TESSDATA_PREFIX': '/untrusted'}):
            code, output = self.invoke(script)
        self.assertEqual(code, 0)
        self.assertEqual(output, '#FILE\t' + str(self.raster) + '\nA\t0.875\n12\t0.92\n')

    def test_unchanged_bundled_wspec_reader_accepts_reads_and_rejects_infrastructure_error(self):
        """Run the pinned reader, this bridge, and a fake OCR process end to end."""
        package_dir = self.root / 'pinned-reader'; package_dir.mkdir()
        with tarfile.open(HERE / 'cloud/container/skills/middle.tar.gz', 'r:gz') as archive:
            for name in ('ocr.py', 'tol.py', 'raster.py'):
                member = archive.extractfile('wspec/check/' + name)
                self.assertIsNotNone(member)
                (package_dir / name).write_bytes(member.read())
        namespace = '_test_pinned_wspec_ocr'
        package = types.ModuleType(namespace); package.__path__ = [str(package_dir)]
        binary = self.fake('import sys\nsys.stdout.write(%r)' % (HEADER + word('A', 87.5)))
        wrapper = self.root / 'bridge'
        wrapper.write_text('#!' + sys.executable + '\n'
            + 'import sys\nfrom pathlib import Path\nsys.path.insert(0, %r)\n' % str(HERE)
            + 'import wspec_ocr_tesseract as helper\nhelper.TESSERACT_PATHS = (Path(%r),)\n' % str(binary)
            + 'raise SystemExit(helper.main())\n')
        wrapper.chmod(0o700)
        with patch.dict(sys.modules, {namespace: package}):
            spec = importlib.util.spec_from_file_location(namespace + '.ocr', package_dir / 'ocr.py')
            reader = importlib.util.module_from_spec(spec); spec.loader.exec_module(reader)
            reader.HELPER = str(wrapper)
            reads = reader.run_helper([str(self.raster)])
            self.assertEqual(reads[str(self.raster)], [('A', 0.875, 'top')])
            self.assertEqual(reads.errors, {})
            missing = str(self.root / 'missing.png')
            reads = reader.run_helper([missing])
            self.assertEqual(reads[missing], [])
            self.assertIn('IMAGE_NOT_READABLE', reads.errors[missing])

    def test_line_confidence_is_minimum_not_inflated_and_order_is_tsv_word_order(self):
        rows = HEADER + word('5', 95, number=2) + word('−', 62.5, number=1)
        self.assertEqual(OCR.parse_tsv(rows), [('− 5', 0.625)])

    def test_blank_ocr_is_no_reads_not_an_error_or_a_guessed_label(self):
        blank = HEADER + '1\t1\t0\t0\t0\t0\t0\t0\t160\t64\t-1\t\n'
        code, output = self.invoke(self.fake('import sys\nsys.stdout.write(%r)' % blank))
        self.assertEqual((code, output), (0, '#FILE\t' + str(self.raster) + '\n'))

    def test_per_file_error_and_nonzero_batch_are_not_read_results(self):
        missing = self.root / 'missing.png'
        code, output = self.invoke(self.fake('import sys\nsys.stdout.write(%r)' % HEADER), [self.raster, missing])
        self.assertEqual(code, 1)
        self.assertEqual(output.count('#FILE\t'), 2)
        self.assertIn('#FILE\t' + str(missing) + '\n#ERR\tIMAGE_NOT_READABLE\n', output)

    def test_fixed_lookup_ignores_path_and_override_environment(self):
        with patch.object(OCR, 'TESSERACT_PATHS', (self.root / 'absent',)):
            with patch.dict(os.environ, {'PATH': str(self.root), 'TESSERACT': str(self.fake('pass'))}):
                with self.assertRaisesRegex(OCR.OCRFailure, 'TESSERACT_NOT_INSTALLED'):
                    OCR.executable()

    def test_failed_process_stderr_is_not_exposed(self):
        binary = self.fake("import sys\nsys.stderr.write('private diagnostic')\nsys.exit(7)")
        code, output = self.invoke(binary)
        self.assertEqual(code, 1)
        self.assertIn('#ERR\tTESSERACT_FAILED', output)
        self.assertNotIn('private', output)

    def test_process_timeout_and_output_limit(self):
        cases = [('import time\ntime.sleep(2)', 'TESSERACT_TIMEOUT', {'MAX_IMAGE_SECONDS': 0.05}),
                 ("import sys\nsys.stdout.write('x'*10000)", 'TESSERACT_OUTPUT_LIMIT', {'MAX_OUTPUT_BYTES': 1000})]
        for body, expected, limits in cases:
            with self.subTest(expected=expected), patch.multiple(OCR, **limits):
                code, output = self.invoke(self.fake(body))
                self.assertEqual(code, 1)
                self.assertIn('#ERR\t' + expected, output)

    def test_exited_parent_with_open_descendant_pipe_is_still_bounded(self):
        binary = self.fake('''
            import os,time
            if os.fork() == 0:
                time.sleep(3)
            else:
                os._exit(0)
        ''')
        with patch.object(OCR, 'MAX_IMAGE_SECONDS', 0.1):
            code, output = self.invoke(binary)
        self.assertEqual(code, 1)
        self.assertIn('#ERR\tTESSERACT_TIMEOUT', output)

    def descendant_holding_the_pipes(self):
        """A fake OCR process whose child writes its pid, then holds the pipes for a minute; the leader exits."""
        marker = self.root / 'descendant.pid'
        binary = self.fake('''
            import os,time
            from pathlib import Path
            marker = Path(%r)
            if os.fork() == 0:
                marker.with_suffix('.tmp').write_text(str(os.getpid()))
                marker.with_suffix('.tmp').rename(marker)
                time.sleep(60)
                os._exit(0)
            deadline = time.monotonic() + 30
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            os._exit(0)
        ''' % str(marker))
        return binary, marker

    @staticmethod
    def running(pid):
        """True while ``pid`` can still run code. A killed process whose new parent has not reaped it yet is a
        zombie: in a container whose PID 1 never reaps orphans it stays one, so a zombie counts as gone."""
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        if os.path.isdir('/proc/self'):
            try:
                with open('/proc/%d/stat' % pid, encoding='ascii') as handle:
                    state = handle.read().rsplit(')', 1)[1].split()[0]
            except FileNotFoundError:
                return False
        else:
            state = subprocess.run(['ps', '-o', 'stat=', '-p', str(pid)], capture_output=True, text=True).stdout.strip()[:1]
            if not state:
                return False
        return state != 'Z'

    def assert_gone(self, pid):
        """``pid`` is killed: it stops running within a few seconds."""
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if not self.running(pid):
                return
            time.sleep(0.05)
        os.kill(pid, signal.SIGKILL)
        self.fail('the descendant was still alive')

    def test_a_refused_group_kill_reaps_the_leader_and_kills_the_group_once_more(self):
        # macOS: killpg raises EPERM while the group's leader has exited and is not yet reaped. The first call is
        # refused here; the leader must be reaped before the one retry, which still kills the live descendant.
        real, calls = os.killpg, []

        def refused_once(pgid, signum):
            try:
                os.kill(pgid, 0)
                leader = 'present'
            except ProcessLookupError:
                leader = 'reaped'
            calls.append((pgid, signum, leader))
            if len(calls) == 1:
                raise PermissionError(1, 'Operation not permitted')
            return real(pgid, signum)

        binary, marker = self.descendant_holding_the_pipes()
        started = time.monotonic()
        with patch.object(OCR, 'MAX_IMAGE_SECONDS', 2.0), patch.object(OCR.os, 'killpg', side_effect=refused_once):
            code, output = self.invoke(binary)
        self.assertLess(time.monotonic() - started, 30)
        self.assertEqual(code, 1)
        self.assertIn('#ERR\tTESSERACT_TIMEOUT', output)
        child = int(marker.read_text())
        self.assertEqual(len(calls), 2)
        self.assertEqual({(pgid, signum) for pgid, signum, _ in calls}, {(calls[0][0], signal.SIGKILL)})
        self.assertNotEqual(calls[0][0], child)
        self.assertEqual(calls[1][2], 'reaped')
        self.assert_gone(child)

    def test_a_group_kill_refused_twice_fails_the_batch_instead_of_leaving_the_descendant(self):
        real, calls = os.killpg, []

        def refused(pgid, signum):
            calls.append(pgid)
            raise PermissionError(1, 'Operation not permitted')

        binary, marker = self.descendant_holding_the_pipes()
        try:
            with patch.object(OCR, 'MAX_IMAGE_SECONDS', 2.0), patch.object(OCR.os, 'killpg', side_effect=refused), \
                    self.assertRaises(PermissionError):
                self.invoke(binary)
            self.assertEqual(len(calls), 2)
        finally:
            if calls:
                try:
                    real(calls[0], signal.SIGKILL)
                except ProcessLookupError:
                    pass
        self.assert_gone(int(marker.read_text()))

    def test_tsv_corruption_and_confidence_forgery_fail_closed(self):
        invalid = [('', 'INVALID_TSV_HEADER'), (HEADER + word('A', 'nan'), 'INVALID_TSV_CONFIDENCE'),
                   (HEADER + word('A', 101), 'INVALID_TSV_CONFIDENCE'),
                   (HEADER + word('A', -1), 'INVALID_TSV_WORD'),
                   (HEADER + word('#ERR'), 'INVALID_TSV_WORD'),
                   (HEADER + word('A') + word('B'), 'DUPLICATE_TSV_WORD'),
                   (HEADER + word('A\textra'), 'INVALID_TSV_ROW')]
        for tsv, code in invalid:
            with self.subTest(code=code), self.assertRaisesRegex(OCR.OCRFailure, code):
                OCR.parse_tsv(tsv)

    def test_symlink_nonraster_and_oversized_inputs_do_not_reach_ocr(self):
        linked = self.root / 'linked.png'; linked.symlink_to(self.raster)
        bogus = self.root / 'bogus.png'; bogus.write_text('not an image')
        large = self.root / 'large.png'; Image.new('L', (OCR.MAX_IMAGE_SIDE + 1, 1)).save(large)
        binary = self.fake("raise RuntimeError('must never run')")
        for source, error in [(linked, 'IMAGE_NOT_READABLE'), (bogus, 'INVALID_RASTER'),
                              (large, 'IMAGE_PIXEL_LIMIT')]:
            with self.subTest(source=source.name):
                code, output = self.invoke(binary, [source])
                self.assertEqual(code, 1)
                self.assertIn('#ERR\t' + error, output)

    def test_batch_limits_and_language_are_explicit_per_file_errors(self):
        binary = self.fake('pass')
        with patch.object(OCR, 'MAX_BATCH_FILES', 1):
            code, output = self.invoke(binary, [self.raster, self.raster])
            self.assertEqual(code, 1)
            self.assertEqual(output.count('#ERR\tBATCH_FILE_LIMIT'), 2)
        code, output = self.invoke(binary, lang='he-IL')
        self.assertEqual(code, 1)
        self.assertIn('#ERR\tUNSUPPORTED_LANGUAGE', output)
        with patch.object(OCR, 'MAX_BATCH_BYTES', 1):
            code, output = self.invoke(binary)
            self.assertEqual(code, 1)
            self.assertIn('#ERR\tBATCH_IMAGE_LIMIT', output)

    def test_path_cannot_inject_protocol_lines(self):
        with patch('sys.stderr', new=io.StringIO()):
            code, output = self.invoke(self.fake('pass'), ['bad\n#FILE\tother'])
        self.assertEqual(code, 2)
        self.assertEqual(output, '')


class InstalledTesseractTests(unittest.TestCase):
    """Real visible glyph/blank cases; skipped, never mocked, if unavailable."""
    @classmethod
    def setUpClass(cls):
        try:
            cls.binary = OCR.executable()
        except OCR.OCRFailure:
            raise unittest.SkipTest('Real OCR not qualified: no Tesseract at a fixed supported path')
        cls.version = subprocess.run([str(cls.binary), '--version'], capture_output=True,
                                     text=True, check=True, timeout=10).stdout.splitlines()[0]
        fonts = [Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
                 Path('/System/Library/Fonts/Supplemental/Arial.ttf')]
        cls.font = next((p for p in fonts if p.is_file()), None)
        if cls.font is None:
            raise unittest.SkipTest('Real OCR not qualified: no known label font available')

    def read(self, label, *, foreground=0, background=255):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'label.png'
            image = Image.new('RGB', (640, 160), (background,) * 3)
            if label:
                ImageDraw.Draw(image).text((25, 20), label,
                    font=ImageFont.truetype(str(self.font), 64), fill=(foreground,) * 3)
            image.save(path)
            output = io.StringIO()
            self.assertEqual(OCR.main(['--lang', 'en-US', str(path)], output=output), 0)
            return [line.split('\t') for line in output.getvalue().splitlines() if not line.startswith('#FILE\t')]

    def test_visible_latin_and_digit_labels(self):
        for label in ('A', 'ABC', '123', '-12', 'A 12'):
            with self.subTest(label=label, engine=self.version):
                reads = self.read(label)
                self.assertTrue(any(text.replace(' ', '') == label.replace(' ', '') for text, _ in reads), reads)
                self.assertTrue(all(0 <= float(confidence) <= 1 for _, confidence in reads))

    def test_blank_and_invisible_low_contrast_have_no_fabricated_read(self):
        self.assertEqual(self.read(''), [])
        self.assertEqual(self.read('ABC 123', foreground=255, background=255), [])

    def test_moderate_contrast_digits_are_read_from_pixels(self):
        reads = self.read('123', foreground=120, background=240)
        self.assertTrue(any(text == '123' for text, _ in reads), reads)


if __name__ == '__main__':
    unittest.main()
