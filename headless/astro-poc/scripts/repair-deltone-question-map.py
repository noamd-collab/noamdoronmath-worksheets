"""Rebuild the verified Deltone excellence map from physical PDF labels.

The legacy map missed starred questions 14, 16 and 20 and used text-order
estimates as positions. This migration accepts only the existing source hash;
it never changes the PDF. Usage: python3 scripts/repair-deltone-question-map.py PDF
"""
import hashlib
import json
from pathlib import Path
import re
import sys

import pymupdf


ROOT = Path(__file__).resolve().parents[3]
PDF_ID = '7adbcdb3bb5c49d1b9e3c38ea74a1285'
MANIFEST = ROOT / 'noam-ai/manifests' / (PDF_ID + '.json')


def rebuild(pdf_path):
    original = json.loads(MANIFEST.read_text())
    source = Path(pdf_path).read_bytes()
    if hashlib.sha256(source).hexdigest() != original['sourceSha256']:
        raise ValueError('The physical PDF differs from the published source')
    doc = pymupdf.open(stream=source, filetype='pdf')
    anchors, parts, closing = [], [], {}
    for page_number, page in enumerate(doc, 1):
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    text = span['text'].strip()
                    x0, y0, x1, y1 = span['bbox']
                    question = re.fullmatch(r'\((\d{1,2})\)', text)
                    part = re.fullmatch(r'\.([א-ת])', text)
                    if question and x0 > 520:
                        anchors.append({'q': int(question[1]), 'page': page_number, 'y': y0})
                    elif part and 490 < x0 < 510:
                        parts.append({'part': part[1], 'page': page_number,
                                      'x': (x0 + x1) / 2, 'y': (y0 + y1) / 2})
                    elif 'בהצלחה' in text:
                        closing[page_number] = y0 - 6
    anchors.sort(key=lambda item: (item['page'], item['y']))
    parts.sort(key=lambda item: (item['page'], item['y']))
    if [item['q'] for item in anchors] != list(range(1, 21)):
        raise ValueError('Expected exactly the 20 printed question labels')

    exercises, questions = [], []
    for index, anchor in enumerate(anchors):
        next_anchor = anchors[index + 1] if index + 1 < len(anchors) else None
        start = (anchor['page'], anchor['y'])
        stop = (next_anchor['page'], next_anchor['y']) if next_anchor else (len(doc) + 1, 0)
        own = [part for part in parts if start <= (part['page'], part['y']) < stop]
        labels = [part['part'] for part in own]
        if not labels or labels != list('אבגדהוזחט')[:len(labels)]:
            raise ValueError('Ambiguous printed subparts for question ' + str(anchor['q']))
        last_page = next_anchor['page'] if next_anchor else len(doc)
        crops = []
        for page_number in range(anchor['page'], last_page + 1):
            page = doc[page_number - 1]
            top = anchor['y'] - 4 if page_number == anchor['page'] else 36
            bottom = min(page.rect.height - 36, closing.get(page_number, page.rect.height))
            if next_anchor and page_number == next_anchor['page']:
                bottom = min(bottom, next_anchor['y'] - 8)
            # A following question at the normal page header does not create
            # a five-pixel continuation of the previous page's question.
            if bottom - top < 12:
                continue
            crops.append({'page': page_number, 'x': 0, 'y': top / page.rect.height,
                          'w': 1, 'h': (bottom - top) / page.rect.height})
        questions.append({'q': anchor['q'], 'page': anchor['page'], 'parts': labels})
        for part in own:
            page = doc[part['page'] - 1]
            pin = {'page': part['page'], 'x': part['x'] / page.rect.width,
                   'y': part['y'] / page.rect.height}
            assert any(c['page'] == pin['page'] and c['y'] <= pin['y'] <= c['y'] + c['h'] for c in crops)
            q, label = anchor['q'], part['part']
            exercises.append({
                'id': f'G9-T46-E-Q{q}{label}', 'q': q, 'part': label,
                'pin': pin, 'crop': crops[0], 'crops': crops,
                'context': '', 'text': f'שאלה {q}, סעיף {label}',
                'prompt': f'התרגיל שנבחר הוא שאלה {q}, סעיף {label}, בנושא דלתון. יש לקרוא את הנתונים וההוראות מתמונות השאלה המצורפות. יש להתייחס לסעיף שנבחר בלבד ולהשתמש בנתונים, בשרטוט ובסעיפים הקודמים של אותה שאלה כאשר הם נדרשים. אין להשלים נתון שאינו מופיע או שאינו קריא בתמונה.',
                'needsVision': True, 'requiresVision': True,
            })
    if len(exercises) != 71 or len({(e['q'], e['part']) for e in exercises}) != 71:
        raise ValueError('Expected 71 unique physical subpart labels')
    original.update({'questionCount': 20, 'exerciseCount': len(exercises),
                     'questions': questions, 'exercises': exercises,
                     'parserConfidence': 1, 'reviewRequired': False, 'issues': []})
    output = json.dumps(original, ensure_ascii=False, indent=2) + '\n'
    MANIFEST.write_text(output)
    public_copy = ROOT / 'headless/astro-poc/public/noam-ai/manifests' / (PDF_ID + '.json')
    public_copy.write_text(output)
    print(json.dumps({'pdfId': PDF_ID, 'questions': 20, 'uniqueSubparts': 71}))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Pass the existing Deltone excellence PDF path')
    rebuild(sys.argv[1])
