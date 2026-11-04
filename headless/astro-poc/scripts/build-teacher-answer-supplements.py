#!/usr/bin/env python3
"""Build new, public answer-only PDFs and per-question crop manifests.

This tool never opens, crops, alters or replaces a source worksheet PDF. Its only
content input is reviewed final-answer HTML. WeasyPrint lays out each complete
answer; its actual article border box supplies the PDF crop. An answer that
cannot stay together fails instead of silently losing a part.

Example (run from the repository root):
  python3 headless/astro-poc/scripts/build-teacher-answer-supplements.py \
    --repo . --input reviewed-public-final-answers.json \
    --font-dir /path/to/hebrew-math-worksheet-elementary/assets \
    --output /isolated/stage/teachers/answers --manifest /isolated/stage/maps.json

Requires WeasyPrint and PyMuPDF. Record exact tool/font/input hashes in --report;
the published manifest itself contains only PDF identity and answer geometry.
"""
import argparse
import hashlib
import html
import json
import re
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path

import pymupdf
import weasyprint
from weasyprint import HTML
from weasyprint.formatting_structure.boxes import BlockBox, TextBox

FONT_NAMES = ('DavidLibre-Regular.ttf', 'DavidLibre-Medium.ttf', 'DavidLibre-Bold.ttf')
CSS = '''
@font-face { font-family: 'David Libre'; src: url('DavidLibre-Regular.ttf'); font-weight:400; }
@font-face { font-family: 'David Libre'; src: url('DavidLibre-Medium.ttf'); font-weight:500; }
@font-face { font-family: 'David Libre'; src: url('DavidLibre-Bold.ttf'); font-weight:700; }
@page { size:A4; margin:16mm 18mm 20mm;
  @top-right {content:'בס״ד';font-family:'David Libre';font-size:10pt;color:#444;}
  @top-center {content:'מתמטיקה · נועם דורון';font-family:'David Libre';font-size:9pt;color:#555;}
  @bottom-center {content:'מתמטיקה · נועם דורון · עמוד ' counter(page) ' מתוך ' counter(pages);font-family:'David Libre';font-size:9pt;color:#555;}
}
body {font-family:'David Libre';font-size:14pt;line-height:1.65;direction:rtl;color:#111;}
h1 {font-size:20pt;margin:0 0 4pt;color:#24345b;}
.scope {font-size:12pt;margin:0 0 14pt;color:#44536b;}
.answer {break-inside:avoid;page-break-inside:avoid;padding:8pt 2pt 9pt;margin:0 0 10pt;border-bottom:.6pt solid #b9cbd8;}
.answer-number {font-weight:700;color:#2463a1;margin:0 0 3pt;}
.part {margin:0 0 3pt;}
.part-label {font-weight:700;}
.ltr {direction:ltr;unicode-bidi:isolate;white-space:nowrap;display:inline-block;}
.frac {display:inline-block;vertical-align:middle;text-align:center;direction:ltr;font-size:1em;margin:0 1px;}
.frac .fnum {display:block;border-bottom:1.2px solid #111;padding:0 4px;line-height:1.3;}
.frac .fden {display:block;padding:0 4px;line-height:1.3;}
table {border-collapse:collapse;width:100%;font-size:13pt;break-inside:avoid;}
td,th {border:.5pt solid #b9cbd8;padding:4pt 6pt;text-align:right;vertical-align:top;}
th {font-weight:700;background:#f4f7fa;}
'''


class PublicAnswerHTML(HTMLParser):
    """Accept mathematical inline markup and simple public tables, no resources."""
    allowed = {'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br'}
    classes = {'ltr', 'frac', 'fnum', 'fden'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        assert tag in self.allowed, f'Forbidden answer HTML tag: {tag}'
        assert len(dict(attrs)) == len(attrs), 'Duplicate HTML attributes'
        for key, value in attrs:
            if key == 'class':
                assert value and set(value.split()) <= self.classes, f'Unknown answer class: {value}'
            elif key in {'colspan', 'rowspan'} and tag in {'td', 'th'}:
                assert value and value.isdigit() and 1 <= int(value) <= 20, 'Invalid table span'
            else:
                raise AssertionError(f'Forbidden answer HTML attribute: {key}')
        if tag != 'br': self.stack.append(tag)

    def handle_endtag(self, tag):
        assert self.stack and self.stack.pop() == tag, 'Unbalanced answer HTML'

    def handle_data(self, value): self.text.append(value)
    def handle_comment(self, value): raise AssertionError('Comments do not belong in public answers')
    def handle_decl(self, value): raise AssertionError('Declarations do not belong in answer fragments')

    def validate(self, value):
        assert isinstance(value, str) and value.strip(), 'Empty answer part'
        self.feed(value); self.close()
        assert not self.stack, 'Unclosed answer HTML'
        text = ''.join(self.text).strip()
        assert text and not re.search(r'\d\s*/\s*\d', text), 'Use a horizontal fraction bar'
        assert text not in {'נימוק', 'בדיקה', 'הוכחה'}, 'Placeholder is not a final answer'


def read_answers(paths):
    result = {}
    for path in paths:
        data = json.loads(path.read_text())
        assert data.get('schemaVersion', 1) == 1
        for item in data['answers']:
            assert item.get('authoringStatus', 'complete') == 'complete', 'Incomplete authoring must remain a visible content gap'
            assert re.fullmatch(r'[a-f0-9]{32}', item.get('pdfId', '')), 'Invalid source pdfId'
            assert re.fullmatch(r'[a-f0-9]{64}', item.get('sourceSha256', '')), 'Invalid source digest'
            assert type(item.get('q')) is int and item['q'] > 0, 'Invalid question number'
            assert item.get('parts'), 'Every completed answer needs a body'
            parts = []
            labels = []
            for part in item['parts']:
                assert isinstance(part.get('label'), str), 'Part label required'
                assert not part['label'] or re.fullmatch(r'[א-ת]{1,2}', part['label']), 'Invalid subpart label'
                PublicAnswerHTML().validate(part['html'])
                parts.append({'label': part['label'], 'html': part['html']})
                labels.append(part['label'])
            assert len(labels) == len(set(labels)), 'Duplicate subpart labels'
            key = (item['pdfId'], item['q'])
            assert key not in result, f'Duplicate authored question: {key}'
            # Do not publish internal review notes, private keys or author logs.
            result[key] = {'pdfId': item['pdfId'], 'sourceSha256': item['sourceSha256'], 'q': item['q'], 'parts': parts}
    return sorted(result.values(), key=lambda item: (item['pdfId'], item['q']))


def markup(sheet, answers, kind='answers'):
    title = html.escape(f"כיתה {sheet['grade']} · {sheet['title']}")
    pieces = ['<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>', CSS,
              '</style><body><h1>', 'נתונים לשאלות' if kind == 'question-data' else 'תשובות סופיות', '</h1><p class="scope">', title, '</p>']
    for answer in answers:
        label = f'נתונים לשאלה {answer["q"]}' if kind == 'question-data' else f'שאלה {answer["q"]}'
        pieces.append(f'<article class="answer" data-answer-q="{answer["q"]}"><div class="answer-number">{label}</div>')
        for part in answer['parts']:
            label = f'<span class="part-label">{html.escape(part["label"])}.</span> ' if part['label'] else ''
            pieces.append('<div class="part">' + label + part['html'] + '</div>')
        pieces.append('</article>')
    return ''.join(pieces) + '</body></html>'


def measured_crops(document, expected):
    found = defaultdict(list)
    page_rects = defaultdict(list)
    for page_number, page in enumerate(document.pages, 1):
        for box in page._page_box.descendants():
            if not isinstance(box, BlockBox) or box.element_tag != 'article': continue
            q = int(box.element.get('data-answer-q'))
            assert q in expected, 'Unexpected answer article'
            x, y, w, h = box.border_box_x(), box.border_box_y(), box.border_width(), box.border_height()
            assert 0 <= x < x+w <= page.width and 0 <= y < y+h <= page.height, f'Answer{q} outside page'
            for child in box.descendants():
                if not isinstance(child, TextBox): continue
                # Inline fraction glyphs and all label text must remain within
                # their actual answer box; long unbreakable math fails here.
                assert child.position_x >= x-.5 and child.position_x+child.width <= x+w+.5, f'Answer{q} text overflows horizontally'
                assert child.position_y >= y-.5 and child.position_y+child.height <= y+h+.5, f'Answer{q} text overflows vertically'
            crop = {'page':page_number,'x':round(x/page.width,9),'y':round(y/page.height,9),
                    'w':round(w/page.width,9),'h':round(h/page.height,9)}
            for other_q, other in page_rects[page_number]:
                overlap_x = min(crop['x']+crop['w'],other['x']+other['w'])-max(crop['x'],other['x'])
                overlap_y = min(crop['y']+crop['h'],other['y']+other['h'])-max(crop['y'],other['y'])
                assert overlap_x <= .00001 or overlap_y <= .00001, f'Answer{q} overlaps{other_q}'
            page_rects[page_number].append((q,crop));found[q].append(crop)
    assert set(found) == expected, 'Not every authored question was rendered'
    assert all(len(crops)==1 for crops in found.values()), 'A complete answer split across pages; revise layout'
    return found


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--repo',type=Path,required=True)
    ap.add_argument('--input',type=Path,action='append',required=True)
    ap.add_argument('--font-dir',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--manifest',type=Path,required=True)
    ap.add_argument('--report',type=Path)
    ap.add_argument('--public-input',type=Path)
    ap.add_argument('--kind',choices=['answers','question-data'],default='answers')
    ap.add_argument('--only-pdf',action='append',help='Rebuild just these source IDs; write a partial manifest, preserving all other staged PDFs')
    args=ap.parse_args()
    fonts={name:hashlib.sha256((args.font_dir/name).read_bytes()).hexdigest() for name in FONT_NAMES}
    answers=read_answers(args.input)
    grouped=defaultdict(list)
    for answer in answers: grouped[answer['pdfId']].append(answer)
    if args.only_pdf:
        assert set(args.only_pdf) <= set(grouped), 'Unknown requested source PDF'
        grouped={key:items for key,items in grouped.items() if key in args.only_pdf}
    args.output.mkdir(parents=True,exist_ok=True)
    manifest={'version':1,'supplements':{}}
    report={'toolVersion':1,'weasyprintVersion':weasyprint.__version__,'fontSha256':fonts,
            'inputSha256':{path.name:hashlib.sha256(path.read_bytes()).hexdigest() for path in args.input},'documents':[]}
    for pdf_id, items in grouped.items():
        sheet=json.loads((args.repo/'headless/astro-poc/public/teachers/sheets'/f'{pdf_id}.json').read_text())
        assert all(item['sourceSha256']==sheet['sourceSha256'] for item in items), f'{pdf_id}: stale question provenance'
        for item in items:
            source_parts={str(q.get('part') or '') for q in sheet['questions'] if int(q['q'])==item['q']}
            assert source_parts, f'{pdf_id}:{item["q"]}: not an original source question'
            if args.kind == 'answers':
                assert source_parts-{''} <= {p['label'] for p in item['parts']}, f'{pdf_id}:{item["q"]}: missing subpart'
        source_html=markup(sheet,items,args.kind)
        document=HTML(string=source_html,base_url=str(args.font_dir.resolve())+'/').render()
        crops=measured_crops(document,{item['q'] for item in items})
        data=document.write_pdf()
        digest=hashlib.sha256(data).hexdigest()
        with pymupdf.open(stream=data,filetype='pdf') as pdf:
            assert len(pdf)==len(document.pages), 'Rendered PDF page count differs from measured layout'
            assert all(page.get_text().strip() for page in pdf), 'Empty answer page'
        (args.output/f'{digest}.pdf').write_bytes(data)
        doc={'url':f'/teachers/answers/{digest}.pdf','sha256':digest,'pageCount':len(document.pages),'answerStartPage':1}
        questions=[{'q':item['q'],'parts':[p['label'] for p in item['parts'] if p['label']],
                    'answerDocument':doc,'crops':crops[item['q']]} for item in items]
        manifest['supplements'][pdf_id]={'sourceSha256':items[0]['sourceSha256'],'questions':questions}
        report['documents'].append({'pdfId':pdf_id,'sha256':digest,'pageCount':len(document.pages),
                                    'questions':[item['q'] for item in items],'htmlSha256':hashlib.sha256(source_html.encode()).hexdigest()})
    args.manifest.parent.mkdir(parents=True,exist_ok=True)
    args.manifest.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    if args.report: args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    if args.public_input: args.public_input.write_text(json.dumps({'schemaVersion':1,'answers':answers},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'documents':len(grouped),'answers':sum(map(len,grouped.values())),'status':'PASS','originalPDFsReadOrChanged':False}))


if __name__=='__main__':main()
