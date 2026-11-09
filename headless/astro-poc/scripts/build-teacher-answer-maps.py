#!/usr/bin/env python3
"""Build selected-question answer crops from the final, visible PDF layout.

Inputs are a private local index of {pdfId,pdf,sheet,expectedSha256}; outputs
contain only a final PDF digest and crop coordinates, never answer/key text.
This adapter recognizes the source engine's whole answer-row bottom border.
It deliberately rejects other layouts instead of guessing or returning pages.
No PDF, worksheet source or teacher sheet is modified.

python3 build-teacher-answer-maps.py --index index.json --out maps --report report.json --raster-check
Use --check to compare regenerated maps to an existing map directory.
Add --ink-edges to also check every crop edge for clipped ink on a 4x raster
(answer_ink_edges.py); row rules, table borders and tints are not ink.
An input row may set refineInkBoundaries=true for reviewed legacy stretchy-
parenthesis metrics; this requires --raster-check and verified white gaps.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import pymupdf

NUMBER = re.compile(r'(?:\(([0-9]{1,3})\)|\)([0-9]{1,3})\()')
EPS = 0.15  # PDF coordinate serialization tolerance, in points, not crop padding.


def rect_contains(outer, inner, eps=EPS):
    return outer.y0 - eps <= inner.y0 and outer.y1 + eps >= inner.y1


def answer_row_rectangle(path, page_width):
    """Recognize the two nested rectangles of a whole-row bottom border."""
    color = path.get('fill')
    items = path.get('items', [])
    if not (path.get('type') == 'f' and path.get('even_odd') and color
            and min(color) > .5 and max(color) < .96
            and len(items) == 2 and all(item[0] == 're' for item in items)):
        return None
    inner, outer = sorted((item[1] for item in items), key=lambda r: r.y1)
    if not (outer.width > page_width * .75 and outer.height > 3
            and .05 < outer.y1 - inner.y1 < 2
            and abs(inner.x0 - outer.x0) < .01
            and abs(inner.x1 - outer.x1) < .01
            and abs(inner.y0 - outer.y0) < .01):
        return None
    return pymupdf.Rect(outer)


def build_answer_map(pdf_path, source, expected_sha256=None, raster_check=False, refine_ink_boundaries=False, ink_edges=False):
    data = Path(pdf_path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha256 and digest != expected_sha256:
        raise ValueError('Source PDF hash differs from the verified index')
    expected = {}
    for question in source['questions']:
        q = int(question['q'])
        parts = expected.setdefault(q, [])
        part = str(question.get('part') or '')
        if part not in parts:
            parts.append(part)
    if not expected:
        raise ValueError('No expected source questions')
    start = source.get('answerStartPage')
    if not isinstance(start, int) or start < 1:
        raise ValueError('Missing verified answerStartPage')
    result = {}
    audit = {'method': 'visible-number-and-source-answer-row-border-v1',
             'questions': len(expected), 'sourceSubpartRecords': len(source['questions']),
             'answerPages': [], 'visibleTraceCount': 0, 'vectorChecks': 0,
             'rasterBoundaryChecks': 0, 'inkEdgeChecks': 0, 'skippedClosingPages': [], 'inkBoundaryRefinements': [], 'parenthesisMetricExceptions': 0, 'issues': []}
    with pymupdf.open(stream=data, filetype='pdf') as document:
        if len(document) != source['pageCount'] or start > len(document):
            raise ValueError('PDF page count disagrees with teacher metadata')
        for number in range(start, len(document) + 1):
            page = document[number - 1]
            traces = page.get_texttrace()
            paths = page.get_drawings()
            borders = [rect for path in paths if (rect := answer_row_rectangle(path, page.rect.width)) is not None]
            anchors = []
            for trace in traces:
                if trace.get('type') != 0 or trace.get('opacity', 1) < .99:
                    continue
                text = ''.join(chr(char[0]) for char in trace['chars']).strip()
                match = NUMBER.fullmatch(text)
                box = pymupdf.Rect(trace['bbox'])
                if match and box.x0 > page.rect.width * .8:
                    anchors.append((int(match[1] or match[2]), box))
            if not anchors and not borders and not result:
                body = page.get_textbox(pymupdf.Rect(0, page.rect.height * .04, page.rect.width, page.rect.height * .94))
                # One legacy export starts its answer range with the source's
                # closing 'good luck' page. It contains no question or answer.
                if re.sub(r'[^א-ת]', '', body) == 'בהצלחה' and not page.get_images():
                    audit['skippedClosingPages'].append(number)
                    continue
            if not anchors or len(anchors) != len(borders):
                raise ValueError(f'Page {number}: visible question anchors/row borders differ: {len(anchors)}/{len(borders)}')
            if refine_ink_boundaries:
                if not raster_check:
                    raise ValueError('Ink boundary refinement requires raster verification')
                import numpy as np
                scale = 4
                pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csGRAY, alpha=False)
                raster = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
                white_rows = np.all(raster > 245, axis=1)
                ordered_borders = sorted(borders, key=lambda r: r.y0)
                cuts = []
                for old in [ordered_borders[0].y0] + [r.y1 for r in ordered_borders]:
                    candidates = [y for y in range(max(2, round(old * scale) - 8), min(pix.height - 2, round(old * scale) + 9))
                                  if np.all(white_rows[y - 1:y + 2])]
                    if not candidates:
                        raise ValueError(f'Page {number}: no verified white gap near source answer boundary')
                    cut = min(candidates, key=lambda y: abs(y / scale - old)) / scale
                    cuts.append(cut)
                    audit['inkBoundaryRefinements'].append({'page': number, 'sourceY': old, 'cropY': cut})
                borders = [pymupdf.Rect(r.x0, cuts[i], r.x1, cuts[i + 1]) for i, r in enumerate(ordered_borders)]
            used = set()
            ordered = []
            for q, anchor in sorted(anchors, key=lambda a: a[1].y0):
                if q not in expected or q in result:
                    raise ValueError(f'Page {number}: unexpected or duplicate question {q}')
                matches = [i for i, border in enumerate(borders) if rect_contains(border, anchor)]
                if len(matches) != 1 or matches[0] in used:
                    raise ValueError(f'Page {number}, question {q}: ambiguous full answer row')
                index = matches[0]
                used.add(index)
                border = borders[index]
                # Full source width preserves source typography/margins; only
                # the verified vertical row is selected. Math remains a bitmap
                # crop of the original PDF, including all fraction/radical ink.
                result[q] = {'q': q, 'parts': expected[q], 'crops': [{
                    'page': number, 'x': 0, 'y': round(border.y0 / page.rect.height, 9),
                    'w': 1, 'h': round(border.height / page.rect.height, 9)}]}
                ordered.append((q, border))
            if used != set(range(len(borders))):
                raise ValueError(f'Page {number}: answer row not assigned to a source question')
            if any(a[1].y1 > b[1].y0 + EPS for a, b in zip(ordered, ordered[1:])):
                raise ValueError(f'Page {number}: neighboring answer rows overlap')
            top, bottom = min(b.y0 for b in borders), max(b.y1 for b in borders)
            # All visible text runs and mathematical vector shapes in the
            # answer body must fit one complete row. Headings/footers are outside.
            for trace in traces:
                if trace.get('type') != 0 or trace.get('opacity', 1) <= 0 or not trace['chars']:
                    continue
                box = pymupdf.Rect(trace['bbox'])
                if box.y1 <= top + EPS or box.y0 >= bottom - EPS:
                    continue
                if not any(rect_contains(border, box) for border in borders):
                    text = ''.join(chr(char[0]) for char in trace['chars']).strip()
                    # A few legacy stretchy-parenthesis font metrics exceed
                    # their painted outline. Only these exact characters may
                    # use the independently verified 288-dpi white cut lines.
                    middle = (box.y0 + box.y1) / 2
                    if not (refine_ink_boundaries and text in ('(', ')')
                            and trace.get('font') == 'David-Libre'
                            and sum(border.y0 <= middle <= border.y1 for border in borders) == 1):
                        raise ValueError(f'Page {number}: visible text crosses an answer boundary')
                    audit['parenthesisMetricExceptions'] += 1
                audit['visibleTraceCount'] += 1
            for path in paths:
                if refine_ink_boundaries and answer_row_rectangle(path, page.rect.width) is not None:
                    continue
                box = path['rect']
                if box.y1 <= top + EPS or box.y0 >= bottom - EPS:
                    continue
                if not any(rect_contains(border, box) for border in borders):
                    raise ValueError(f'Page {number}: vector/fraction crosses an answer boundary')
                audit['vectorChecks'] += 1
            if raster_check:
                import numpy as np
                scale = 4 if refine_ink_boundaries else 2
                pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csGRAY, alpha=False)
                raster = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
                for border in borders:
                    # The border itself is light gray; dark ink at a cut line
                    # would indicate a glyph/fraction clipping risk.
                    for y in (border.y0, border.y1):
                        pixel = min(pix.height - 1, max(0, round(y * scale)))
                        if (raster[pixel, :] < 150).any():
                            raise ValueError(f'Page {number}: dark ink intersects row cut at y={y:.3f}')
                        audit['rasterBoundaryChecks'] += 1
            if ink_edges:
                from answer_ink_edges import clipped_ink
                crops = [result[q]['crops'][0] for q, _ in ordered]
                for finding in clipped_ink(page, crops):
                    q = ordered[finding['crop']][0]
                    raise ValueError(f'Page {number}, question {q}: ink crosses the {finding["edge"]} crop edge at {finding["box"]}')
                audit['inkEdgeChecks'] += len(crops)
            audit['answerPages'].append({'page': number, 'questions': [q for q, _ in ordered]})
    if set(result) != set(expected):
        raise ValueError(f'Missing final answers: {sorted(set(expected) - set(result))}')
    return {'version': 1, 'sourceSha256': digest,
            'questions': [result[q] for q in sorted(result)]}, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--raster-check', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--ink-edges', action='store_true', help='Fail on ink that a crop edge would cut')
    args = parser.parse_args()
    rows = json.loads(args.index.read_text())
    if not args.check:
        args.out.mkdir(parents=True, exist_ok=True)
    report = {'status': 'PASS', 'rows': [], 'mapCount': 0, 'questionCount': 0,
              'sourceSubpartRecords': 0, 'rasterCheck': args.raster_check, 'inkEdges': args.ink_edges}
    for i, row in enumerate(rows):
        try:
            source = json.loads(Path(row['sheet']).read_text())
            if source['pdfId'] != row['pdfId']:
                raise ValueError('Teacher source ID differs from the input index')
            answer_map, audit = build_answer_map(row['pdf'], source, row.get('expectedSha256'), args.raster_check,
                                                 row.get('refineInkBoundaries', False), args.ink_edges)
            path = args.out / (row['pdfId'] + '.json')
            if args.check:
                if json.loads(path.read_text()) != answer_map:
                    raise ValueError('Existing map differs from regenerated source geometry')
            else:
                path.write_text(json.dumps(answer_map, ensure_ascii=False, separators=(',', ':')) + '\n')
            report['rows'].append({'pdfId': row['pdfId'], 'topic': row.get('topic'), 'level': row.get('level'),
                                   'status': 'PASS', 'sourceSha256': answer_map['sourceSha256'], **audit})
            report['mapCount'] += 1
            report['questionCount'] += len(answer_map['questions'])
            report['sourceSubpartRecords'] += len(source['questions'])
        except Exception as error:
            report['status'] = 'FAIL'
            report['rows'].append({'pdfId': row['pdfId'], 'topic': row.get('topic'), 'level': row.get('level'),
                                   'status': 'FAIL', 'error': str(error)})
        if (i + 1) % 50 == 0:
            print(f'{i + 1}/{len(rows)}', flush=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'rows'}))
    for row in report['rows']:
        if row['status'] != 'PASS':
            print(json.dumps(row, ensure_ascii=False))
    raise SystemExit(0 if report['status'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
