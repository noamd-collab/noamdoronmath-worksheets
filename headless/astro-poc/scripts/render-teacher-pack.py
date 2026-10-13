#!/usr/bin/env python3
"""Render a packed teacher worksheet from normalized PDF crops.

stdin: JSON plan from tests/teacher-print-pack.test.ts
stdout: JSON report (page fill is computed by the test; this reports pixels).
"""
import json
import os
import sys
from html import escape
from pathlib import Path

import numpy as np
import pymupdf

# MuPDF warnings use the C stdout fd. Keep JSON on the original stdout.
sys.stdout.flush()
_JSON_FD = os.dup(1)
os.dup2(2, 1)


def emit(obj):
    os.write(_JSON_FD, json.dumps(obj).encode())

FONT = '/usr/share/fonts/truetype/noto/NotoSerifHebrew-Regular.ttf'
OUT_W = 1000
PAGE_H = 1440
PDF_W = 595.28
PDF_H = PDF_W * PAGE_H / OUT_W
SX = PDF_W / OUT_W
SY = PDF_H / PAGE_H


def dark_count(page, y0, y1, x0, x1, zoom=3):
    if y1 <= y0 or x1 <= x0:
        return 0
    clip = pymupdf.Rect(
        x0 * page.rect.width,
        y0 * page.rect.height,
        x1 * page.rect.width,
        y1 * page.rect.height,
    )
    if clip.width < 0.4 or clip.height < 0.4:
        return 0
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    return int(np.any(arr < 80, axis=2).sum())


def text_lines(doc):
    lines = []
    for index, page in enumerate(doc):
        height = page.rect.height or 1
        width = page.rect.width or 1
        for block in page.get_text('rawdict')['blocks']:
            if block.get('type') != 0:
                continue
            for line in block.get('lines') or []:
                for span in line.get('spans') or []:
                    chars = []
                    for glyph in span.get('chars') or []:
                        token = glyph.get('c') or ''
                        if token == '':
                            continue
                        x0, y0, x1, y1 = glyph['bbox']
                        chars.append({
                            'c': token,
                            'x': round(x0 / width, 4),
                            'x2': round(x1 / width, 4),
                            'y': round(y0 / height, 4),
                            'y2': round(y1 / height, 4),
                        })
                    text = ''.join(glyph['c'] for glyph in chars).strip()
                    if not text or not chars:
                        continue
                    lines.append({
                        'page': index + 1,
                        'y': min(glyph['y'] for glyph in chars),
                        'y2': max(glyph['y2'] for glyph in chars),
                        'x': min(glyph['x'] for glyph in chars),
                        'x2': max(glyph['x2'] for glyph in chars),
                        'text': text,
                        'chars': chars,
                    })
    return lines


def draw_rtl(page, rect, text, size):
    css = "@font-face{font-family:Noto;src:url('%s');} *{font-family:Noto;margin:0;padding:0;}" % FONT
    html = '<div dir="rtl" style="font-size:%dpx;line-height:1.2;color:#22305a;text-align:right;">%s</div>' % (
        size, escape(text),
    )
    page.insert_htmlbox(rect, html, css=css)


def paint_page(out, items, page_index, answers, title, docs, probes):
    out.draw_rect(out.rect, color=(1, 1, 1), fill=(1, 1, 1))
    draw_rtl(out, pymupdf.Rect(PDF_W - 150, 2, PDF_W - 16, 34), 'בס״ד', 18)
    chrome = 40
    if not answers and page_index == 0:
        draw_rtl(out, pymupdf.Rect(PDF_W - 420, 40, PDF_W - 16, 78), title, 20)
        draw_rtl(out, pymupdf.Rect(PDF_W - 120, 82, PDF_W - 16, 114), 'שם:', 16)
        out.draw_line(pymupdf.Point(28, 108 * SY), pymupdf.Point(PDF_W - 90, 108 * SY), color=(0.13, 0.19, 0.35), width=1)
        chrome = 40 + 86
    y = chrome
    placed = []
    for item_index, item in enumerate(items):
        if item_index:
            y += item.get('gap') or 0
        dh = item['dh']
        kind = item.get('kind')
        if kind == 'level':
            draw_rtl(out, pymupdf.Rect(PDF_W - 220, y * SY, PDF_W - 16, (y + dh) * SY), item.get('label') or '', 16)
        else:
            doc = docs[item['pdfId']]
            src = doc[item['page'] - 1]
            box = item['box']
            clip = pymupdf.Rect(
                box['x'] * src.rect.width,
                box['y'] * src.rect.height,
                (box['x'] + box['w']) * src.rect.width,
                (box['y'] + box['h']) * src.rect.height,
            )
            pieces = item.get('pieces') or []
            if pieces:
                row_h = box.get('h') or 0.02
                for piece in pieces:
                    part = piece['box']
                    part_clip = pymupdf.Rect(
                        part['x'] * src.rect.width,
                        part['y'] * src.rect.height,
                        (part['x'] + part['w']) * src.rect.width,
                        (part['y'] + part['h']) * src.rect.height,
                    )
                    if part_clip.width < 0.4 or part_clip.height < 0.4:
                        continue
                    part_pix = src.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=part_clip, alpha=False)
                    part_dh = (part['h'] / row_h) * dh if row_h else dh
                    dy = (piece.get('dy') or 0) * dh
                    dest = pymupdf.Rect(
                        piece['at'] * PDF_W,
                        (y + dy) * SY,
                        (piece['at'] + part['w']) * PDF_W,
                        (y + dy + part_dh) * SY,
                    )
                    out.insert_image(dest, pixmap=part_pix)
            else:
                pix = src.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip, alpha=False)
                dest = pymupdf.Rect(0, y * SY, PDF_W, (y + dh) * SY)
                out.insert_image(dest, pixmap=pix)
                masks = box.get('masks') or ([box['mask']] if box.get('mask') else [])
                for mask in masks:
                    m = pymupdf.Rect(
                        mask['x'] * PDF_W,
                        (y + mask['y'] * dh) * SY,
                        (mask['x'] + mask['w']) * PDF_W,
                        (y + (mask['y'] + mask['h']) * dh) * SY,
                    )
                    out.draw_rect(m, color=(1, 1, 1), fill=(1, 1, 1))
        if item.get('probe'):
            placed.append({'id': item['probe'], 'y': y, 'dh': dh, 'kind': kind})
        y += dh
    probes.append(placed)
    return chrome, y


def source_probes(docs, probes):
    report = []
    for probe in probes:
        page = docs[probe['pdfId']][probe['page'] - 1]
        report.append({
            'id': probe['id'],
            'dark': dark_count(page, probe['y0'], probe['y1'], probe['x0'], probe['x1']),
        })
    return report


def main():
    plan = json.load(sys.stdin)
    if plan.get('cmd') == 'warn-probe':
        os.write(1, b'MuPDF warning: probe\n')
        emit({'ok': True})
        return
    if plan.get('cmd') == 'lines':
        lines = {}
        size = None
        for pdf_id, path in plan['pdfs'].items():
            doc = pymupdf.open(path)
            lines[pdf_id] = text_lines(doc)
            size = [doc[0].rect.width, doc[0].rect.height]
        emit({'lines': lines, 'pageSize': size})
        return

    docs = {pdf_id: pymupdf.open(path) for pdf_id, path in plan['pdfs'].items()}
    out_doc = pymupdf.open()
    out_dir = Path(plan['outDir'])
    out_dir.mkdir(parents=True, exist_ok=True)
    title = plan.get('title') or 'דף תרגול'
    placed_pages = []
    page_reports = []
    sequences = [('exercise', plan.get('exercisePages') or []), ('answer', plan.get('answerPages') or [])]
    for kind, pages in sequences:
        for index, items in enumerate(pages):
            page = out_doc.new_page(width=PDF_W, height=PDF_H)
            chrome, bottom = paint_page(page, items, index, kind == 'answer', title, docs, placed_pages)
            page_reports.append({
                'kind': kind,
                'index': index,
                'chrome': chrome,
                'bottom': bottom,
                'probes': placed_pages[-1],
            })
    out_pdf = Path(plan['outPdf'])
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    out_doc.save(out_pdf)
    pngs = []
    for index, page in enumerate(out_doc):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4), alpha=False)
        png = out_dir / ('page-%02d.png' % (index + 1))
        pix.save(png)
        pngs.append(str(png))
        top = dark_count(page, 0.0, 0.04, 0.72, 0.99, zoom=2)
        page_reports[index]['basadDark'] = top
        saved = {}
        for probe in page_reports[index]['probes']:
            y0 = probe['y'] / PAGE_H
            y1 = (probe['y'] + probe['dh']) / PAGE_H
            clip = pymupdf.Rect(0, y0 * page.rect.height, page.rect.width, y1 * page.rect.height)
            if clip.height < 1:
                continue
            crop = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=clip, alpha=False)
            dest = out_dir / ('crop-%s.png' % probe['id'])
            if probe['id'] in saved:
                # Keep the first slice image; a later slice of the same probe is separate.
                dest = out_dir / ('crop-%s-%d.png' % (probe['id'], saved[probe['id']]))
            saved[probe['id']] = saved.get(probe['id'], 0) + 1
            crop.save(dest)
            rows = max(1, int(crop.height * 0.03))
            top_arr = np.frombuffer(crop.samples, dtype=np.uint8).reshape(crop.height, crop.width, crop.n)
            top_dark = int(np.any(top_arr[:rows, int(crop.width * 0.45):] < 80, axis=2).sum())
            body_dark = int(np.any(top_arr < 80, axis=2).sum())
            page_reports[index].setdefault('cropDark', []).append({
                'id': probe['id'],
                'png': str(dest),
                'topDark': top_dark,
                'bodyDark': body_dark,
            })
    emit({
        'pdf': str(out_pdf),
        'pngs': pngs,
        'pages': page_reports,
        'sourceProbes': source_probes(docs, plan.get('sourceProbes') or []),
    })


if __name__ == '__main__':
    main()
