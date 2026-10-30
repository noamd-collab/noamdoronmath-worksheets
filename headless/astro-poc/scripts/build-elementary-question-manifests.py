#!/usr/bin/env python3
"""Map original elementary PDF questions; never re-typeset or invent source content.

Requires PyMuPDF. The source catalog is authoritative. Geometry comes from live
question labels and original vector question cards. Ambiguous layouts fail closed.
Use --cache PATH --report PATH --write to regenerate the checked manifests.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
import pymupdf as pdf

ROOT = Path(__file__).resolve().parents[3]
CATALOG = ROOT / 'headless/astro-poc/src/data/catalog.v1.json'
MANIFESTS = ROOT / 'noam-ai/manifests'
CONTEXT_PATH = Path(__file__).parent / 'data/elementary-question-context.json'
ADJUSTMENTS_PATH = Path(__file__).parent / 'data/elementary-crop-adjustments.json'
ANSWER_HEADINGS = ('תשובותסופיות', 'שובותסופיות', 'תשובותלתרגול', 'פתרונותסופיים')


def normalize(text):
    return re.sub(r'[^א-תA-Za-z0-9.]', '', unicodedata.normalize('NFD', text))


def source_inventory():
    catalog = json.loads(CATALOG.read_text())
    elementary = set(catalog['config']['elementaryGrades'])
    return [dict(level, grade=g['grade'], topicId=t['id'], topic=t['title'])
            for g in catalog['grades'] if g['grade'] in elementary
            for t in g['topics'] for level in t['levels']]


def rect_key(rect):
    return tuple(round(v, 2) for v in rect)


def question_cards(page, drawings=None):
    """Deduplicate original card fill/border paths, excluding diagrams and page masks."""
    cards = {}
    for drawing in drawings if drawings is not None else page.get_drawings():
        r = drawing['rect']
        if (r.width < 170 or r.height < 35 or r.height > 710 or
                r.y0 < 35 or r.y1 > page.rect.height - 44 or
                (r.x0 < 5 and r.x1 > page.rect.width - 5)):
            continue
        # A rectangle path can be a rounded card with multiple segments. A bare
        # open diagram does not define a reliable question boundary.
        if drawing.get('fill') is None and not drawing.get('closePath'):
            continue
        cards[rect_key(r)] = r
    return list(cards.values())


def physical_anchors(page):
    anchors = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                token = normalize(span['text'])
                match = re.fullmatch(r'(\d{1,3})\.|\.(\d{1,3})', token)
                r = pdf.Rect(span['bbox'])
                if (match and span['size'] >= 8 and 'bold' in span['font'].lower()
                        and r.y0 > 35 and r.y1 < page.rect.height - 44):
                    anchors.append({'q': int(match.group(1) or match.group(2)), 'rect': r})
    return anchors


def crop(page_number, page, rect):
    rect = rect & page.rect
    return dict(page=page_number, x=round(rect.x0/page.rect.width, 6),
                y=round(rect.y0/page.rect.height, 6),
                w=round(rect.width/page.rect.width, 6), h=round(rect.height/page.rect.height, 6))


def page_content_bottom(page, top, drawings=None):
    """Retain written answer rules, tables and original diagrams, omit page footer."""
    bottom = top + 20
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                r = pdf.Rect(span['bbox'])
                if r.x1 > 35 and r.x0 < page.rect.width-35 and top < r.y1 < page.rect.height-46:
                    bottom = max(bottom, r.y1)
    for drawing in drawings if drawings is not None else page.get_drawings():
        r = drawing['rect']
        if r.x1 > 35 and r.x0 < page.rect.width-35 and top < r.y1 < page.rect.height-46:
            bottom = max(bottom, r.y1)
    return min(page.rect.height-46, bottom+7)


def outlined_card_anchors(page, expected, drawings=None):
    # Grade 2 outlined text has an accurate searchable overlay, but its tiny
    # font coordinates are not the printed coordinates. Original colored card
    # rectangles provide geometry; label order is checked against the overlay.
    numbers = [int(n) for n in re.findall(r'(?:^|\n)(?:★\s*)?(\d{1,2})\s*\n\.\s', page.get_text())]
    cards = [r for r in question_cards(page, drawings) if r.width > page.rect.width*.7]
    cards = [r for r in cards if not any(s != r and s.contains(r) and s.get_area() > r.get_area()+2 for s in cards)]
    cards.sort(key=lambda r: (r.y0, r.x0))
    if numbers != list(range(expected, expected+len(cards))) or not cards:
        raise ValueError(f'outlined-card labels {numbers}; {len(cards)} cards; expected {expected}')
    return [dict(q=q, rect=pdf.Rect(r.x1-28, r.y0+7, r.x1-9, r.y0+23), card=r)
            for q,r in zip(numbers,cards)]


def extract(source, path, overrides=None):
    document = pdf.open(path)
    answer_index = next((i for i,p in enumerate(document)
                         if any(term in normalize(p.get_text()[:250]) for term in ANSWER_HEADINGS)), None)
    if answer_index is None or answer_index == 0:
        raise ValueError('missing/ambiguous answer section')
    producer = document.metadata.get('producer', '')
    source_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if 'Unicode text layer rebuilt' in producer:
        if not overrides or source['pdfId'] not in overrides:
            raise ValueError('outlined grade-1 anchors require verified geometry')
        expected_hash = overrides.get('_sourceSha256', {}).get(source['pdfId'])
        if not expected_hash or expected_hash != source_sha256:
            raise ValueError('outlined geometry source hash mismatch')
        page_anchors = overrides[source['pdfId']]
    else:
        page_anchors = None
    adjustments = json.loads(ADJUSTMENTS_PATH.read_text()).get(source['pdfId']) if ADJUSTMENTS_PATH.exists() else None
    if adjustments and adjustments['sourceSha256'] != source_sha256:
        raise ValueError('verified crop adjustment source hash mismatch')
    exercises=[]
    methods=Counter()
    expected=1
    for index in range(answer_index):
        page=document[index]
        drawings=page.get_drawings()
        if page_anchors is not None:
            anchors=[dict(q=x['q'],rect=pdf.Rect(x['rect']), **({'card':pdf.Rect(x['card'])} if 'card'in x else {}), contextCrops=x.get('contextCrops', [])) for x in page_anchors[str(index+1)]]
        elif 'Ghostscript' in producer:
            anchors=outlined_card_anchors(page,expected,drawings)
        else:
            anchors=physical_anchors(page)
        anchors.sort(key=lambda x:x['q'])
        numbers=[a['q'] for a in anchors]
        if not anchors and page_anchors is not None and any(
                c['page'] == index+1 for aa in page_anchors.values() for a in aa for c in a.get('contextCrops', [])):
            continue
        if numbers != list(range(expected,expected+len(anchors))) or not anchors:
            raise ValueError(f'page {index+1}: labels {numbers}, expected {expected}')
        cards=question_cards(page,drawings)
        for anchor in anchors:
            r=anchor['rect']; center=(r.tl+r.br)/2
            candidates=[c for c in cards if c.contains(center) and
                        sum(c.contains((a['rect'].tl+a['rect'].br)/2) for a in anchors)==1]
            card=anchor.get('card') or (max(candidates,key=lambda c:c.get_area()) if candidates else None)
            if card:
                # Some source diagrams/answer rules protrude a few points past
                # their decorative card. Preserve those original marks too.
                bounds=pdf.Rect(card)
                near=card+(-12,-6,12,12)
                for drawing in drawings:
                    drawn=drawing['rect']
                    if near.contains(drawn) and not (drawn & card).is_empty:
                        bounds |= drawn
                bounds += (-1.5,-1.5,1.5,1.5)
                method='original-question-card'
            else:
                lower=[a['rect'].y0 for a in anchors if a['rect'].y0>r.y0+3]
                if any(abs(a['rect'].y0-r.y0)<3 and a['q']!=anchor['q'] for a in anchors):
                    raise ValueError(f'page {index+1} q{anchor["q"]}: unboxed column layout')
                top=max(37,r.y0-8)
                bottom=max(min(lower)-8, r.y1+3) if lower else page_content_bottom(page,top,drawings)
                bounds=pdf.Rect(30,top,page.rect.width-30,bottom);method='physical-number-boundaries'
            adjustment = adjustments['questions'].get(str(anchor['q']), {}) if adjustments else {}
            if 'top' in adjustment: bounds.y0 = adjustment['top']
            if 'bottom' in adjustment: bounds.y1 = adjustment['bottom']
            if 'right' in adjustment: bounds.x1 = adjustment['right']
            if not bounds.contains(r) or bounds.height<14:
                raise ValueError(f'page {index+1} q{anchor["q"]}: invalid whole question bounds')
            geometry=crop(index+1,page,bounds)
            context=[crop(c['page'],document[c['page']-1],pdf.Rect(c['rect'])) for c in anchor.get('contextCrops', [])]
            label=f'שאלה {anchor["q"]}'
            exercises.append(dict(id=f'G{source["grade"]}-T{source["topicId"]:02}-{source["key"].upper()}-Q{anchor["q"]:02}',
                q=anchor['q'],part='',pin=dict(page=index+1,x=round(center.x/page.rect.width,6),y=round(center.y/page.rect.height,6)),
                crop=geometry,crops=context+[geometry],context='',text=label,
                prompt=f'{label}, בנושא {source["topic"]}. יש לקרוא את כל הנתונים, הסעיפים וההוראות מתמונת השאלה המקורית. אין להשלים נתון שאינו מופיע או שאינו קריא בתמונה.',
                needsVision=True,requiresVision=True,geometryMethod=method))
            methods[method]+=1
        expected+=len(anchors)
    # Explicit, visually checked references are included with the selected
    # question so a chart or number line on an earlier question remains usable.
    references = json.loads(CONTEXT_PATH.read_text()).get(source['pdfId']) if CONTEXT_PATH.exists() else None
    if references:
        if references['sourceSha256'] != source_sha256:
            raise ValueError('question context source hash mismatch')
        by_question = {e['q']: e for e in exercises}
        for number, dependencies in references['questions'].items():
            own = by_question[int(number)]
            context = [c for q in dependencies for c in by_question[q]['crops']]
            unique = {tuple(c.values()): c for c in context + own['crops']}
            own['crops'] = list(unique.values())
            own['contextQuestionNumbers'] = dependencies
    result=dict(schemaVersion=2,pdfHash=source['pdfId'],aliases=[],grade=source['grade'],topicId=source['topicId'],
                prefix=f'G{source["grade"]}-T{source["topicId"]:02}',topic=source['topic'],level=source['key'],levelCode=source['key'].upper(),
                pageCount=len(document),exercisePageCount=answer_index,answerStartPage=answer_index+1,
                answerGeometry='full-pages' if ('Ghostscript' in producer or 'Unicode text layer rebuilt' in producer) else 'text',
                questionCount=len(exercises),exerciseCount=len(exercises),parserConfidence=1,reviewRequired=False,issues=[],
                sourceSha256=source_sha256,wholeQuestionGeometry=True,
                questions=[dict(q=e['q'],page=e['pin']['page'],parts=[])for e in exercises],exercises=exercises)
    return result,dict(methods)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--report',type=Path,required=True)
    parser.add_argument('--overrides',type=Path,default=Path(__file__).parent/'data/outlined-grade1-anchors.json')
    parser.add_argument('--write',action='store_true')
    parser.add_argument('--ids',nargs='*')
    args=parser.parse_args()
    overrides=json.loads(args.overrides.read_text()) if args.overrides.exists() else None
    report=dict(success=[],failures=[])
    for source in source_inventory():
        if args.ids and source['pdfId'] not in args.ids:continue
        try:
            manifest,methods=extract(source,args.cache/f'{source["pdfId"]}.pdf',overrides)
            if args.write:(MANIFESTS/f'{source["pdfId"]}.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
            report['success'].append(dict(pdfId=source['pdfId'],grade=source['grade'],topicId=source['topicId'],level=source['key'],questions=manifest['questionCount'],answerStartPage=manifest['answerStartPage'],methods=methods))
        except Exception as exc:
            report['failures'].append(dict(pdfId=source['pdfId'],grade=source['grade'],topicId=source['topicId'],level=source['key'],error=str(exc)))
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(success=len(report['success']),failures=len(report['failures']),questions=sum(s['questions']for s in report['success']))))
    for failure in report['failures']: print(json.dumps(failure,ensure_ascii=False))
    raise SystemExit(bool(report['failures']))

if __name__=='__main__':main()
