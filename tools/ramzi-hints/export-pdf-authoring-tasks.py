#!/usr/bin/env python3
"""Read pinned public worksheet PDFs and render question crops for Flash authoring.
No OCR, model calls, hints, PDF changes, or database writes occur here.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import argparse, hashlib, json, subprocess, os, re, unicodedata
import pymupdf

REPO = Path(__file__).resolve().parents[2]
def sha(data): return hashlib.sha256(data).hexdigest()
def load(path): return json.loads(path.read_text())
def task_hash(text):
    # Match builder.sourceTaskHash; every result must equal the pinned exporter hash.
    return sha(unicodedata.normalize('NFC', re.sub(r'[ \t]+',' ',text.replace('\r','')).strip()).encode())
def atomic(path, data):
    temp = path.with_suffix(path.suffix+'.tmp')
    temp.write_text(data)
    os.chmod(temp, 0o600)
    temp.replace(path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', type=Path)
    parser.add_argument('--tasks', type=Path, help='Original pinned packets for source-image recovery')
    parser.add_argument('--failures', type=Path, help='Only SOURCE_AMBIGUOUS IDs from an authoring checkpoint')
    parser.add_argument('--include-all', action='store_true', help='Attach printed source crops to every supplied task')
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    out = args.out.resolve()
    if out == REPO or REPO in out.parents: raise ValueError('Source crops must remain outside the public checkout')
    out.mkdir(parents=True, exist_ok=True)
    (out/'pdf').mkdir(exist_ok=True); (out/'images').mkdir(exist_ok=True)
    originals = {}
    if args.tasks:
        if not args.failures and not args.include_all: raise ValueError('--tasks requires --failures or --include-all')
        originals = {t['exercise_id']:t for t in (json.loads(line) for line in args.tasks.read_text().splitlines() if line.strip())}
        failures = [{'exercise_id':key} for key in originals] if args.include_all else [f for f in load(args.failures) if f['code']=='SOURCE_AMBIGUOUS']
        blocked = []
        for f in failures:
            t = originals[f['exercise_id']]
            blocked.append({k:t[k] for k in ['exercise_id','grade','question','part','stage','source_pdf_hash','source_native_sha256','source_exercise_sha256']})
    else:
        if not args.inventory: raise ValueError('--inventory or --tasks is required')
        inventory = load(args.inventory)
        blocked = [x for x in inventory['blocked_source'] if x['reason']=='missing_pinned_native_source']
    by_pdf = defaultdict(list)
    for item in blocked: by_pdf[item['source_pdf_hash']].append(item)
    def download(pdf):
        path = out/'pdf'/(pdf+'.pdf')
        if not path.exists():
            raw = subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','90',
                'https://static.wixstatic.com/ugd/d8e7ad_'+pdf+'.pdf'],capture_output=True,check=True).stdout
            if not raw.startswith(b'%PDF-'): raise ValueError('Source is not a PDF: '+pdf)
            path.write_bytes(raw); os.chmod(path,0o600)
        return pdf, sha(path.read_bytes())
    pdf_hashes = dict(ThreadPoolExecutor(max_workers=4).map(download, by_pdf))
    tasks = []
    for pdf, entries in by_pdf.items():
        original = REPO/'noam-ai/manifests'/(pdf+'.json')
        published = REPO/'headless/astro-poc/public/noam-ai/manifests'/(pdf+'.json')
        raw = published.read_bytes()
        if raw != original.read_bytes(): raise ValueError('Manifest mirror mismatch: '+pdf)
        manifest = json.loads(raw)
        if manifest.get('pdfHash') != pdf: raise ValueError('Wrong current PDF identity')
        if not originals and manifest.get('nativeExportSha256'): raise ValueError('Not a PDF-only source')
        if any((manifest.get('nativeExportSha256') or None)!=e['source_native_sha256'] for e in entries): raise ValueError('Native source binding changed')
        exs = {x['id']:x for x in manifest['exercises']}
        selected = defaultdict(list)
        for item in entries: selected[item['question']].append(item)
        doc = pymupdf.open(out/'pdf'/(pdf+'.pdf'))
        question_images = {}
        for q in selected:
            parts = [e for e in manifest['exercises'] if e['q']==q]
            pages = defaultdict(list)
            for ex in parts:
                for crop in ex.get('crops') or [ex.get('crop')]:
                    if not isinstance(crop,dict): raise ValueError('Question crop missing')
                    if not all(isinstance(crop.get(k),(int,float)) for k in ['page','x','y','w','h']): raise ValueError('Invalid crop')
                    if crop['w']<=0 or crop['h']<=0 or not 0<=crop['x']<=1 or not 0<=crop['y']<=1 or crop['x']+crop['w']>1.001 or crop['y']+crop['h']>1.001: raise ValueError('Crop out of bounds')
                    pages[int(crop['page'])].append(crop)
            images = []
            for number, crops in sorted(pages.items()):
                if not 1<=number<=len(doc): raise ValueError('Crop page missing')
                page = doc[number-1]
                x0=min(c['x']for c in crops); y0=min(c['y']for c in crops)
                x1=max(c['x']+c['w']for c in crops); y1=max(c['y']+c['h']for c in crops)
                box = pymupdf.Rect(x0*page.rect.width,y0*page.rect.height,min(x1,1)*page.rect.width,min(y1,1)*page.rect.height)
                dest=out/'images'/f'{pdf}-q{int(q):02}-p{number}.png'
                if not dest.exists():
                    page.get_pixmap(matrix=pymupdf.Matrix(2,2),clip=box,alpha=False).save(dest)
                    os.chmod(dest,0o600)
                images.append({'path':str(dest),'sha256':sha(dest.read_bytes()),'figure_id':f'printed-q{q}-page{number}'})
            question_images[q]=images
        for item in entries:
            ex=exs[item['exercise_id']]
            if item['source_exercise_sha256'] != task_hash(ex['text']): raise ValueError('Task fingerprint mismatch')
            previous=[{'id':e['id'],'label':e.get('part',''),'text':e['text']}for e in manifest['exercises'] if e['q']==ex['q'] and list(exs).index(e['id'])<list(exs).index(ex['id'])]
            task={'schema_version':1,'exercise_id':item['exercise_id'],'grade':int(manifest['grade']),'question':int(ex['q']),
                'part':ex.get('part',''),'topic':manifest.get('topic')or manifest['prefix'],'stage':item['stage'],
                'source_pdf_hash':pdf,'source_native_sha256':item['source_native_sha256'],'source_exercise_sha256':item['source_exercise_sha256'],
                'manifest_sha256':sha(raw),'source':{'source_kind':'printed_pdf_question_crops',
                    'manifest_selected_text':ex['text'],'manifest_context':ex.get('context',''),'manifest_prompt':ex.get('prompt',''),
                    'pdf_bytes_sha256':pdf_hashes[pdf],'selected_part_label':ex.get('part',''),
                    'previous_parts':previous,'prerequisites_policy':'Earlier parts are context, not assumed solved facts.',
                    'source_image_policy':'Read the attached printed question. Use only its actual givens; diagrams are not to scale. The selected label determines the target. Return source_ambiguous if the print is not readable.'},
                'images':question_images[item['question']]}
            if item['exercise_id'] in originals:
                original=originals[item['exercise_id']]
                task['source']={**original['source'],**{k:v for k,v in task['source'].items() if k in ['source_kind','pdf_bytes_sha256','source_image_policy']}}
                task['source']['source_kind']='native_with_printed_pdf_question_crops'
                # The actual printed question supersedes reconstructed SVG images.
                # Native text/givens stay in source; SVG layout is never a measurement.
            task['packet_sha256']=sha(json.dumps(task,ensure_ascii=False,separators=(',',':')).encode())
            tasks.append(task)
        doc.close()
    for grade in [7,8,9]:
        for stage,label in [('q01','stage-1-q01'),('q02plus','stage-2-q02plus')]:
            chosen=sorted((t for t in tasks if t['grade']==grade and t['stage']==stage),key=lambda t:t['exercise_id'])
            if not chosen: continue
            atomic(out/f'{label}-grade-{grade}.jsonl',''.join(json.dumps(t,ensure_ascii=False,separators=(',',':'))+'\n'for t in chosen))
    summary={'pdfs':len(by_pdf),'tasks':len(tasks),'q01':sum(t['stage']=='q01'for t in tasks),
        'q02plus':sum(t['stage']=='q02plus'for t in tasks),'question_images':len(list((out/'images').glob('*.png'))),
        'pdf_bytes_sha256':pdf_hashes,'model_calls':0}
    atomic(out/'inventory.json',json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    for grade in sorted({t['grade'] for t in tasks}):
        atomic(out/f'inventory-grade-{grade}.json',json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k!='pdf_bytes_sha256'},ensure_ascii=False))

if __name__=='__main__': main()
