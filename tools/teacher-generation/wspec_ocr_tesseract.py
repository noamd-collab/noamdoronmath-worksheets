#!/usr/bin/env python3
"""Raster-only Tesseract bridge for the pinned WSPEC OCR helper protocol.

Usage: wspec_ocr_tesseract.py --lang en-US crop.png [crop2.png ...]
Each input emits #FILE<TAB>the-original-path, followed by actual OCR reads
and confidence in [0, 1]. Words on one TSV line are joined with spaces;
the line confidence is the minimum of its word confidences / 100. No
expected label, character whitelist, answer, or model output is accepted.

Blank images legitimately return no reads. Infrastructure/format failures
emit #ERR and a nonzero batch exit, which the unchanged WSPEC reader treats
as OCR_UNAVAILABLE. Passing helper tests is not geometry qualification.
"""
from __future__ import annotations

import argparse
import csv
import io
import math
import os
from pathlib import Path
import selectors
import stat
import subprocess
import sys
import tempfile
import time
import warnings

from PIL import Image


# Runtime configuration cannot replace the executable via PATH or an env var.
# Debian is first; the remaining two locations support existing local installs.
TESSERACT_PATHS = (
    Path('/usr/bin/tesseract'), Path('/usr/local/bin/tesseract'),
    Path('/opt/homebrew/bin/tesseract'),
)
MAX_BATCH_FILES = 512
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_BATCH_BYTES = 64 * 1024 * 1024
MAX_IMAGE_SIDE = 8192
MAX_IMAGE_PIXELS = 16_000_000
MAX_BATCH_PIXELS = 128_000_000
MAX_OUTPUT_BYTES = 1024 * 1024
MAX_BATCH_SECONDS = 240.0
MAX_IMAGE_SECONDS = 8.0
TSV_FIELDS = ('level', 'page_num', 'block_num', 'par_num', 'line_num',
              'word_num', 'left', 'top', 'width', 'height', 'conf', 'text')


class OCRFailure(Exception):
    """A fixed error code, never provider text or arbitrary process stderr."""


def executable() -> Path:
    for candidate in TESSERACT_PATHS:
        try:
            resolved = candidate.resolve(strict=True)
            if resolved.is_file() and os.access(resolved, os.X_OK):
                return resolved
        except (OSError, RuntimeError):
            continue
    raise OCRFailure('TESSERACT_NOT_INSTALLED')


def snapshot_image(source: str, destination: Path) -> tuple[int, int]:
    """Bound and decode the raster, then OCR a private, immutable-by-caller copy."""
    if not source or len(source) > 4096 or any(ord(c) < 32 or ord(c) == 127 for c in source):
        raise OCRFailure('INVALID_IMAGE_PATH')
    try:
        fd = os.open(source, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)
                     | getattr(os, 'O_NONBLOCK', 0))
    except OSError:
        raise OCRFailure('IMAGE_NOT_READABLE') from None
    try:
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode):
                raise OCRFailure('IMAGE_NOT_REGULAR_FILE')
            if not 0 < info.st_size <= MAX_IMAGE_BYTES:
                raise OCRFailure('IMAGE_BYTE_LIMIT')
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(stream) as image:
                    width, height = image.size
                    if (image.format not in ('PNG', 'JPEG') or getattr(image, 'n_frames', 1) != 1):
                        raise OCRFailure('UNSUPPORTED_RASTER')
                    if (not 0 < width <= MAX_IMAGE_SIDE or not 0 < height <= MAX_IMAGE_SIDE
                            or width * height > MAX_IMAGE_PIXELS):
                        raise OCRFailure('IMAGE_PIXEL_LIMIT')
                    image.load()
                    # White is the worksheet's visible paper background. No
                    # thresholding, contrast correction, or expected-text hints.
                    if image.mode in ('RGBA', 'LA') or 'transparency' in image.info:
                        rgba = image.convert('RGBA')
                        rgb = Image.new('RGB', image.size, 'white')
                        rgb.paste(rgba, mask=rgba.getchannel('A'))
                    else:
                        rgb = image.convert('RGB')
                    rgb.save(destination, format='PNG')
                    return info.st_size, width * height
    except OCRFailure:
        raise
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError,
            Image.DecompressionBombWarning):
        raise OCRFailure('INVALID_RASTER') from None


def run_tesseract(binary: Path, raster: Path, timeout: float) -> str:
    """Fixed argv, isolated environment, bounded pipes and elapsed time."""
    if timeout <= 0:
        raise OCRFailure('BATCH_TIMEOUT')
    args = [str(binary), str(raster), 'stdout', '-l', 'eng', '--psm', '6', 'tsv']
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C',
           'OMP_THREAD_LIMIT': '1', 'OMP_NUM_THREADS': '1'}
    try:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   env=env, start_new_session=True)
    except OSError:
        raise OCRFailure('TESSERACT_START_FAILED') from None
    stdout = bytearray()
    total = 0
    deadline = time.monotonic() + timeout
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ, True)
            selector.register(process.stderr, selectors.EVENT_READ, False)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise OCRFailure('TESSERACT_TIMEOUT')
                for key, _ in selector.select(min(remaining, 0.1)):
                    chunk = os.read(key.fileobj.fileno(), 8192)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    total += len(chunk)
                    if total > MAX_OUTPUT_BYTES:
                        raise OCRFailure('TESSERACT_OUTPUT_LIMIT')
                    if key.data:
                        stdout.extend(chunk)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise OCRFailure('TESSERACT_TIMEOUT')
            try:
                code = process.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                raise OCRFailure('TESSERACT_TIMEOUT') from None
            if code:
                raise OCRFailure('TESSERACT_FAILED')
        try:
            return stdout.decode('utf-8', errors='strict')
        except UnicodeDecodeError:
            raise OCRFailure('INVALID_TSV') from None
    finally:
        # Also clean up descendants if the parent has already exited but a
        # descendant holds a pipe. The group belongs to this invocation only.
        import signal
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
        process.stdout.close()
        process.stderr.close()


def parse_tsv(text: str) -> list[tuple[str, float]]:
    """Return actual line reads with conservative, engine-derived confidence."""
    try:
        reader = csv.DictReader(io.StringIO(text), delimiter='\t')
        if tuple(reader.fieldnames or ()) != TSV_FIELDS:
            raise OCRFailure('INVALID_TSV_HEADER')
        lines: dict[tuple[int, ...], list[tuple[int, str, float]]] = {}
        for row in reader:
            if set(row) != set(TSV_FIELDS) or any(v is None for v in row.values()):
                raise OCRFailure('INVALID_TSV_ROW')
            values = {key: int(row[key]) for key in TSV_FIELDS[:10]}
            if values['level'] not in (1, 2, 3, 4, 5) or any(v < 0 for v in values.values()):
                raise OCRFailure('INVALID_TSV_ROW')
            confidence = float(row['conf'])
            if not math.isfinite(confidence) or not -1 <= confidence <= 100:
                raise OCRFailure('INVALID_TSV_CONFIDENCE')
            if values['level'] != 5:
                continue
            word = row['text'].strip()
            if not word:
                continue
            if (confidence < 0 or values['word_num'] < 1
                    or any(ord(c) < 32 or ord(c) == 127 for c in word)
                    or word in ('#FILE', '#ERR', '#ALT')):
                raise OCRFailure('INVALID_TSV_WORD')
            key = tuple(values[field] for field in ('page_num', 'block_num', 'par_num', 'line_num'))
            lines.setdefault(key, []).append((values['word_num'], word, confidence / 100.0))
        reads = []
        for words in lines.values():
            if len({n for n, _, _ in words}) != len(words):
                raise OCRFailure('DUPLICATE_TSV_WORD')
            ordered = sorted(words)
            reads.append((' '.join(word for _, word, _ in ordered), min(conf for _, _, conf in words)))
        return reads
    except (ValueError, csv.Error):
        raise OCRFailure('INVALID_TSV') from None


def main(argv=None, *, output=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lang', default='en-US')
    parser.add_argument('images', nargs='+')
    args = parser.parse_args(argv)
    output = output or sys.stdout
    if any(any(ord(c) < 32 or ord(c) == 127 for c in path) for path in args.images):
        # Such a path cannot be represented in the inherited line protocol.
        print('Unrepresentable image path', file=sys.stderr)
        return 2
    global_error = None
    if args.lang not in ('en-US', 'en', 'eng'):
        global_error = 'UNSUPPORTED_LANGUAGE'
    elif len(args.images) > MAX_BATCH_FILES:
        global_error = 'BATCH_FILE_LIMIT'
    binary = None
    if global_error is None:
        try:
            binary = executable()
        except OCRFailure as error:
            global_error = str(error)
    failed = False
    total_bytes = total_pixels = 0
    deadline = time.monotonic() + MAX_BATCH_SECONDS
    with tempfile.TemporaryDirectory(prefix='wspec-ocr-') as temporary:
        raster = Path(temporary) / 'input.png'
        for path in args.images:
            print('#FILE\t' + path, file=output, flush=True)
            try:
                if global_error:
                    raise OCRFailure(global_error)
                if time.monotonic() >= deadline:
                    raise OCRFailure('BATCH_TIMEOUT')
                size, pixels = snapshot_image(path, raster)
                total_bytes += size
                total_pixels += pixels
                if total_bytes > MAX_BATCH_BYTES or total_pixels > MAX_BATCH_PIXELS:
                    global_error = 'BATCH_IMAGE_LIMIT'
                    raise OCRFailure(global_error)
                tsv = run_tesseract(binary, raster, min(MAX_IMAGE_SECONDS, deadline - time.monotonic()))
                reads = parse_tsv(tsv)
                for value, confidence in reads:
                    print(value + '\t' + repr(confidence), file=output)
            except OCRFailure as error:
                failed = True
                print('#ERR\t' + str(error), file=output)
            finally:
                raster.unlink(missing_ok=True)
            output.flush()
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
