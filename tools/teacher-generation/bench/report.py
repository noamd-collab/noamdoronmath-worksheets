"""Shared reporting for the bench tools: gate findings, failure classes, stable files.

The gate reader only collects the lines the pinned skills and the adapter
already printed for a failed step. It decides nothing about a worksheet.
"""
from __future__ import annotations

import json
from pathlib import Path
import platform
import re
import shutil
import sys

SUMMARY_LINE = re.compile(r'(?:GATES?|RESULT)\s*:\s*FAIL')
GATE_ID = re.compile(r'(?<![A-Za-z0-9])([GDK][0-9]{1,3})(?![0-9])')
RAISED = re.compile(r'(?:raise\s+\w+|\bbad|\breject|\bfail)\(\s*["\']([A-Z][A-Z0-9_]{2,60})["\']')
TEXT_LIMIT = 240


def write_json(path, value):
    """Stable bytes for equal content: sorted keys, UTF-8, one trailing newline."""
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')


def environment():
    """Facts that change what a local render can check."""
    tools = {name: shutil.which(name) is not None for name in ('pdftoppm', 'pdffonts', 'tesseract')}
    return {'python': '.'.join(map(str, sys.version_info[:3])), 'platform': platform.system().lower(),
            'tools': tools,
            'note': ('Without poppler the elementary page-fill check is deferred with a warning, and without '
                     'tesseract the middle-school figure reader cannot run; the worker image has both.')}


def _questions(line):
    found = [int(n) for n in re.findall(r'questions#([0-9]{1,2})', line)]
    # The elementary skill labels a sub-item Q<question><one digit item>: Q101 is question 10 item 1.
    for digits in re.findall(r'(?<![A-Za-z0-9])Q([0-9]{2,3})(?![0-9])', line):
        found.append(int(digits[:-1]))
    found += [int(n) for n in re.findall(r'(?<![A-Za-z0-9])q([0-9]{1,2})(?:[a-i]|\.|\b)', line)]
    return sorted(set(found))


def _finding(step, line, gate=None):
    text = ' '.join(line.split())
    gate = gate or (GATE_ID.search(text)[1] if GATE_ID.search(text) else None)
    return {'step': step, 'gate': gate, 'questions': _questions(text), 'text': text[:TEXT_LIMIT]}


def _log_findings(step, text):
    rows = []
    lines = text.splitlines()
    if 'Traceback (most recent call last)' in text:
        codes = RAISED.findall(text)
        last = next((line for line in reversed(lines) if line.strip() and not line.startswith(' ')), '')
        rows.append(_finding(step, last, gate=codes[-1] if codes else None))
        return rows
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith(('PASS', '✓')) or SUMMARY_LINE.search(stripped):
            continue
        if stripped.startswith('AssertionError'):
            rows.append(_finding(step, stripped))
            for more in lines[index + 1:]:
                if not more.startswith('  - '):
                    break
                rows.append(_finding(step, more, gate=rows[-1]['gate']))
        elif stripped.startswith('✗') or re.match(r'FAIL\b', stripped) or re.search(r'\sFAIL(?:\s|$)', stripped):
            rows.append(_finding(step, stripped))
    return rows


def _read(path, limit=400_000):
    try:
        return Path(path).read_text(encoding='utf-8', errors='replace')[:limit]
    except OSError:
        return ''


def gate_findings(render_dir, manifest):
    """Failing lines of each failed step of one render, in step and line order."""
    render_dir = Path(render_dir)
    rows = []
    for step in (manifest or {}).get('steps', []):
        if step.get('status') != 'FAIL':
            continue
        name = step.get('name', '?')
        if step.get('reason'):
            rows.append({'step': name, 'gate': step['reason'], 'questions': [], 'text': step['reason']})
            continue
        found = _log_findings(name, _read(render_dir / step['log'])) if step.get('log') else []
        if name == 'middle-build':
            # The middle driver names its failing checkers; their own logs carry the lines.
            report = None
            try:
                report = json.loads(_read(render_dir / 'out/v72-report.json'))
            except ValueError:
                pass
            found = []
            for upstream in (report or {}).get('steps', []):
                if upstream.get('status') != 'FAIL':
                    continue
                label = f"middle-build/{upstream.get('step', '?')}"
                log = render_dir / 'out/logs' / Path(str(upstream.get('log', ''))).name
                lines = _log_findings(label, _read(log))
                found += lines or [{'step': label, 'gate': None, 'questions': [], 'text': 'FAIL (no line found)'}]
        rows += found or [{'step': name, 'gate': None, 'questions': [], 'text': 'FAIL (no line found)'}]
    return [{**row, 'text': row['text'].replace(str(render_dir), '.')} for row in rows]


def skipped_checks(render_dir, manifest):
    """Checks the pinned skill skipped on this machine, as it printed them."""
    rows = []
    for step in (manifest or {}).get('steps', []):
        if not step.get('log'):
            continue
        for line in _read(Path(render_dir) / step['log']).splitlines():
            if 'skipped' in line and '(warn)' in line:
                rows.append(step.get('name', '?') + ': ' + ' '.join(line.split())[:TEXT_LIMIT])
    return rows


def render_record(entry, attempt):
    """The stable part of one render attempt (no paths, hashes or timings)."""
    manifest = entry.get('manifest') or {}
    record = {'attempt': attempt, 'status': manifest.get('status', 'error'),
              'steps': [{k: step[k] for k in ('name', 'status', 'reason') if k in step}
                        for step in manifest.get('steps', [])],
              'reviewFindings': manifest.get('reviewFindings', []),
              'gateFindings': gate_findings(entry['dir'], manifest),
              'skippedChecks': skipped_checks(entry['dir'], manifest)}
    if entry.get('error'):
        record['error'] = entry['error']
    return record


def failure_class(outcome, renders):
    """One label per case, naming the stage and the root code."""
    if outcome.get('delivered'):
        return 'DELIVERED'
    first = (outcome.get('author') or {}).get('firstPass')
    if outcome.get('status') == 'authored':
        return 'AUTHORED'
    if first is None:
        return 'LESSON:' + str(outcome.get('code'))
    if not first.get('ok'):
        code = str(first.get('code'))
        stage = 'PROVIDER' if code.startswith('PROVIDER_') else 'BUDGET' if code.startswith('SWEEP_') else 'SOURCE'
        return f'{stage}:{code}'
    if renders:
        # The first render names the root cause; a later one follows a correction.
        root = renders[0]
        if root.get('error'):
            return 'RENDER:' + root['error']
        gates = sorted({row['gate'] or row['step'] for row in root.get('gateFindings', [])})
        if gates:
            return 'GATES:' + '+'.join(gates)
    return 'OTHER:' + str(outcome.get('code'))


def table(headers, rows):
    lines = ['| ' + ' | '.join(headers) + ' |', '|' + '|'.join(' --- ' for _ in headers) + '|']
    for row in rows:
        lines.append('| ' + ' | '.join(str(cell).replace('|', '\\|').replace('\n', ' ') for cell in row) + ' |')
    return '\n'.join(lines)


def percent(part, whole):
    return f'{part} of {whole} ({100 * part / whole:.0f}%)' if whole else '0 of 0'
