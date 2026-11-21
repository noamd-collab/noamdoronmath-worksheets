"""Mandatory Linux OCR qualification using actual rasters and the pinned reader.

No mock engine, expected-label argument or skip path. Run with --network none.
The unchanged skill reader launches the real bridge/Tesseract subprocess chain.
This qualifies that chain; worksheet geometry still needs its own WSPEC gates.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont


def qualify(output: Path):
    if sys.platform != 'linux' or platform.machine() != 'x86_64':
        raise RuntimeError('Real OCR qualification requires Linux amd64')
    helper = Path('/opt/noam/app/wspec_ocr_tesseract.py')
    if os.environ.get('WSPEC_OCR') != str(helper) or not os.access(helper, os.X_OK):
        raise RuntimeError('Reviewed executable WSPEC_OCR is required')
    version = subprocess.check_output(['/usr/bin/tesseract', '--version'], text=True,
                                      timeout=10).splitlines()[0]
    if version != 'tesseract 5.3.0':
        raise RuntimeError('Unexpected OCR engine')
    skill = Path(os.environ['MIDDLE_SKILL_PATH'])
    module_path = skill / 'wspec/check/ocr.py'
    # Import the locked reader in its real package namespace, without edits.
    sys.path.insert(0, str(skill))
    from wspec.check.ocr import run_helper
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 64)
    output.mkdir(parents=True, exist_ok=False)
    cases = [('letter', 'A', 0), ('letters', 'ABC', 0), ('digits', '123', 0),
             ('signed', '-12', 0), ('mixed', 'A 12', 0),
             ('blank', '', 0), ('invisible', 'ABC 123', 255)]
    rasters = []
    for name, label, shade in cases:
        path = output / (name + '.png')
        image = Image.new('RGB', (640, 160), 'white')
        if label:
            ImageDraw.Draw(image).text((25, 20), label, font=font, fill=(shade,) * 3)
        image.save(path)
        rasters.append(str(path))
    reads = run_helper(rasters)
    if reads.errors:
        raise RuntimeError('Real OCR reader reported an infrastructure error')
    results = []
    for (name, label, shade), path in zip(cases, rasters):
        observed = reads[path]
        if name in ('blank', 'invisible'):
            passed = observed == []
        else:
            passed = any(text.replace(' ', '') == label.replace(' ', '')
                         and 0 < confidence <= 1 for text, confidence, _ in observed)
        results.append({'case': name, 'passed': passed, 'reads': observed,
                        'rasterSha256': hashlib.sha256(Path(path).read_bytes()).hexdigest()})
    report = {'status': 'PASS' if all(case['passed'] for case in results) else 'FAIL',
              'engine': version, 'realRasterOcr': True, 'networkRequired': False,
              'helperSha256': hashlib.sha256(helper.read_bytes()).hexdigest(),
              'readerSha256': hashlib.sha256(module_path.read_bytes()).hexdigest(),
              'cases': results}
    (output / 'qualification.json').write_text(json.dumps(report, indent=2) + '\n')
    if report['status'] != 'PASS':
        raise RuntimeError('Real OCR failed a visible glyph or blank raster fixture')
    return report
