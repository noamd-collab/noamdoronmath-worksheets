"""Image qualification without credentials, queue access or model calls.

Run the image with --network none. Inputs are reviewed synthetic
legacy and general-source fixtures; successful automatic checks still do not mean human visual approval.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
APP = HERE.parents[1]
sys.path.insert(0, str(APP))
from preflight import check
from provider import derive_author_parameters
from runner import render_job
from validation import validate_lesson, validate_model
from author_quality import prepare_didactics

SECRET_KEYS = ('QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'TEACHER_GENERATION_SERVICE_KEY')


def native_preflight():
    if any(os.environ.get(key) for key in SECRET_KEYS):
        raise RuntimeError('Offline qualification refuses provider or database credentials')
    if sys.platform != 'linux' or platform.machine() != 'x86_64' or os.getuid() == 0:
        raise RuntimeError('Qualification requires nonroot Linux amd64')
    if platform.python_version() != '3.12.16':
        raise RuntimeError('Python patch version differs from the image pin')
    result = check(require_provider=False)
    if not result['ready']:
        raise RuntimeError('Pinned Python/skill preflight failed')
    versions = {}
    for executable, flags in [('pdfinfo', ['-v']), ('pdffonts', ['-v']),
                              ('pdftotext', ['-v']), ('pdftoppm', ['-v']),
                              ('chromium', ['--version']), ('tini', ['--version']),
                              ('tesseract', ['--version'])]:
        if not shutil.which(executable):
            raise RuntimeError('Missing required native helper: ' + executable)
        p = subprocess.run([executable] + flags, capture_output=True, text=True, timeout=10, check=True)
        versions[executable] = (p.stdout or p.stderr).splitlines()[0][:180]
    pins = json.loads((HERE / 'native-pins.json').read_text())
    for package, info in pins['packages'].items():
        installed = subprocess.check_output(['dpkg-query', '-W', '-f=${Version}', package], text=True)
        if installed != info['version']:
            raise RuntimeError('Native package differs from lock: ' + package)
    font = subprocess.check_output(['fc-match', '-f', '%{family}', 'David Libre'], text=True)
    if 'David Libre' not in font:
        raise RuntimeError('David Libre font substitution is not permitted')
    if os.environ.get('WSPEC_OCR') != '/opt/noam/app/wspec_ocr_tesseract.py':
        raise RuntimeError('Linux WSPEC reader must use the reviewed raster-only bridge')
    import sympy, mpmath
    if (sympy.__version__, mpmath.__version__) != ('1.14.0', '1.3.0'):
        raise RuntimeError('Exact symbolic math runtime differs from the lock')
    return {'ready': True, 'providerCalled': False, 'queueTouched': False,
            'python': result['python'], 'skills': result['skills'], 'helpers': versions}


def general_cases(output):
    """Real representative renders. Fixture coverage is not all-topic proof."""
    root = HERE / 'fixtures/general'
    manifest = json.loads((root / 'manifest.json').read_text())
    cases = manifest.get('cases')
    if (manifest.get('version') != 1 or not isinstance(cases, list) or not cases
            or len(cases) != len(set(cases))
            or any(not isinstance(name, str) or not re.fullmatch(r'[a-z0-9-]{1,60}', name) for name in cases)):
        raise RuntimeError('Reviewed general fixtures are required')
    expected = {name + '/' + kind + '.json' for name in cases for kind in ('lesson', 'model-output')}
    if set(manifest.get('files', {})) != expected:
        raise RuntimeError('General fixture manifest must cover exactly its inputs')
    for name in expected:
        data = (root / name).read_bytes()
        entry = manifest['files'][name]
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise RuntimeError('General fixture checksum mismatch')
    results = []
    # No paid generation or automatic retry can occur during render qualification.
    with patch('provider.author_lesson', side_effect=AssertionError('Offline only')), \
            patch('general_provider.author_general_lesson', side_effect=AssertionError('Offline only')):
        for case in cases:
            fixture = root / case
            lesson = json.loads((fixture / 'lesson.json').read_text())
            source = json.loads((fixture / 'model-output.json').read_text())
            expected_source = {'grade9-special-right-triangle':'triangle-parameters/1',
                               'grade1-counting':'counting-words/1',
                               'grade5-unlike-fractions':'unlike-fractions/1',
                               'grade8-pythagoras':'pythagoras-parameters/1',
                               'grade9-square':'square-parameters/1',
                               'grade3-division-curriculum':'division-facts/1'}.get(case, 4)
            if lesson.get('version') != 3 or source.get('version') != expected_source:
                raise RuntimeError('General fixtures must exercise the new intake and source contracts')
            validate_model(lesson, source)
            rendered = render_job(lesson, source, output / case)
            if case == 'grade3-division-curriculum':
                # Selecting the division concept alone never adds a mandatory
                # inverse-multiplication task, even when the method was taught.
                draft = json.loads((output / case / 'worksheet-source.json').read_text())
                from division_facts import CHALLENGES
                instructions = [q['instruction'] for q in draft['questions']]
                if (any('כפל' in prompt for prompt in instructions)
                        or instructions[-3:] != list(CHALLENGES.values())):
                    raise RuntimeError('Division tasks do not match the selected curriculum concept')
            automated = (rendered['automatedChecksPassed'] is True
                         and all(step['status'] == 'PASS' for step in rendered['steps']))
            review_only = (rendered.get('renderingChecksPassed') is True
                           and isinstance(rendered.get('reviewFindings'), list)
                           and bool(rendered['reviewFindings'])
                           and any(step['status'] == 'REVIEW' for step in rendered['steps']))
            qualified = ((automated or review_only)
                      and rendered['status'] == 'needs_review'
                      and rendered.get('authoringProfile') == 'general-skill-source/v1'
                      and all(step['status'] in ('PASS', 'REVIEW') for step in rendered['steps'])
                      and {a['kind'] for a in rendered['artifacts']} == {'pdf', 'docx'})
            results.append({'case': case, 'topicId': lesson['topicId'],
                            'status': 'PASS' if qualified and automated else 'REVIEW' if qualified else 'FAIL',
                            'automatedChecksPassed': automated,
                            'reviewFindings': rendered.get('reviewFindings', []),
                            'manifest': 'general/' + case + '/manifest.json'})
            if not qualified:
                raise RuntimeError('General skill pipeline failed: ' + case)
    return {'cases': results, 'coverage': 'representative fixtures only; not 232-topic pedagogical approval',
            'providerCalled': False, 'humanVisualReview': 'PENDING'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--preflight-only', action='store_true')
    parser.add_argument('--out', type=Path, default=Path('/work/offline-qualification'))
    args = parser.parse_args()
    report = {'preflight': native_preflight(), 'cases': [], 'humanVisualReview': 'PENDING'}
    if args.preflight_only:
        print(json.dumps(report, ensure_ascii=False))
        return
    args.out.mkdir(parents=True, exist_ok=False)
    from qualify_ocr import qualify
    report['rasterOcr'] = qualify(args.out / 'ocr')
    report['generalSkillSource'] = general_cases(args.out / 'general')
    manifest = json.loads((HERE / 'fixtures/manifest.json').read_text())
    for name, entry in manifest['files'].items():
        data = (HERE / 'fixtures' / name).read_bytes()
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise RuntimeError('Offline fixture checksum mismatch')
    # Defense in depth; --network none is the process-tree isolation boundary.
    with patch('provider.author_lesson', side_effect=AssertionError('Offline only')):
        for case in ('grade3-division', 'grade7-positive', 'grade7-signed'):
            fixture = HERE / 'fixtures' / case
            lesson = json.loads((fixture / 'lesson.json').read_text())
            raw = json.loads((fixture / 'author-parameters.json').read_text())
            canonical = json.loads((fixture / 'canonical.json').read_text())
            cap = validate_lesson(lesson)
            if derive_author_parameters(lesson, cap, raw) != canonical:
                raise RuntimeError('Author parameter derivation changed')
            validate_model(lesson, canonical)
            prepare_didactics(lesson, canonical, cap)
            rendered = render_job(lesson, canonical, args.out / case)
            passed = (rendered['automatedChecksPassed'] is True
                      and rendered['status'] == 'needs_review'
                      and all(step['status'] == 'PASS' for step in rendered['steps'])
                      and {a['kind'] for a in rendered['artifacts']} == {'pdf', 'docx'})
            report['cases'].append({'case': case, 'passed': passed,
                                    'manifest': case + '/manifest.json'})
            if not passed:
                raise RuntimeError('Full skill pipeline failed: ' + case)
    # Qualify the existing locked Chromium fallback, not just command presence.
    skill = Path(os.environ['ELEMENTARY_SKILL_PATH'])
    spec = importlib.util.spec_from_file_location('locked_pdf_builder', skill / 'scripts/build_pdf.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    fallback_work = args.out / 'chromium-fallback'
    shutil.copytree(args.out / 'grade3-division', fallback_work)
    # Do not retain a copied PASS manifest describing the WeasyPrint artifact.
    (fallback_work / 'manifest.json').unlink()
    fallback = fallback_work / 'sheet.pdf'
    fallback.unlink()
    if not module.build_with_chromium(fallback_work / 'sheet.html', fallback):
        raise RuntimeError('Existing Chromium fallback failed')
    with fallback.open('rb') as f:
        if f.read(5) != b'%PDF-':
            raise RuntimeError('Chromium did not produce a PDF')
    commands = [
        [skill / 'scripts/check_worksheet.py', fallback, fallback_work / 'preview-chromium', '--band', 'elementary'],
        [APP / 'output_gates.py', '--skill', skill, '--pdf', fallback, '--band', 'elementary'],
        [skill / 'scripts/lib/house_gates.py', '--html', fallback_work / 'sheet.html', '--pdf', fallback,
         '--gen', APP / 'adapters.py', '--content', fallback_work / 'content.json', '--figdir', fallback_work / 'figures',
         '--grade', 'ג', '--level', 'ב', '--docx', fallback_work / 'sheet.docx'],
    ]
    for number, command in enumerate(commands):
        p = subprocess.run([sys.executable, '-B'] + [str(value) for value in command],
                           cwd=fallback_work, capture_output=True, text=True, timeout=240)
        (fallback_work / f'chromium-gate-{number}.txt').write_text(p.stdout + '\n' + p.stderr)
        if p.returncode:
            raise RuntimeError('Chromium fallback gate failed')
    report['chromiumFallback'] = 'PASS automatic gates; all-page visual comparison pending'
    (args.out / 'qualification.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
