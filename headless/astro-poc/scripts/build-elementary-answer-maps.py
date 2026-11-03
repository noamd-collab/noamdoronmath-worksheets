#!/usr/bin/env python3
"""Derive answer rectangles from unchanged cached source PDFs; fail on ambiguity."""
import json,re,hashlib,collections,math,argparse
from pathlib import Path
import pymupdf as pdf
from elementary_answer_form_bounds import rectify, align_shared_boundaries
W=None
R=None
CACHE=None
OUTPUT=None
REPORT=None
KNOWN_GAPS=None

def spans(page):
 return [s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
def num(text):
 m=re.fullmatch(r'\s*(?:\.(\d{1,3})|(\d{1,3})\.|\((\d{1,3})\))\s*',text)
 return int(next(v for v in m.groups() if v)) if m else None

def normcrop(page,n,r):
 r=r & page.rect
 return dict(page=n,x=round(r.x0/page.rect.width,6),y=round(r.y0/page.rect.height,6),w=round(r.width/page.rect.width,6),h=round(r.height/page.rect.height,6))
def rects(page):
 ds=page.get_drawings();unique={}
 for d in ds:
  r=d['rect']; c=d.get('fill') or d.get('color')
  if c and min(c)>.99:continue
  if r.x0<25 or r.x1>page.rect.width-25 or r.y0<55 or r.y1>page.rect.height-50:continue
  if r.width>100 and 12<r.height<150:
   unique[tuple(round(v,2)for v in r)]=r
 return list(unique.values()),ds

def overlay_numbers(page):
 ss=spans(page); groups={}
 for s in ss:
  if s['size']>=7:continue
  key=round(s['origin'][1],1)
  groups.setdefault(key,[]).append(s)
 nums=[]
 for y,sps in sorted(groups.items()):
  # Text insertion order is semantic, but its page coordinates are deliberately not used.
  t=''.join(s['text']for s in sps).strip()
  m=re.match(r'^(?:\.(\d{1,3})|(\d{1,3})\.)',t)
  if m:nums.append(int(next(v for v in m.groups()if v)))
 return nums

def physical(page):
 out=[]
 for s in spans(page):
  q=num(s['text']);r=pdf.Rect(s['bbox'])
  if q and s['size']>=7 and ('bold' in s['font'].lower() or ((s['color']&255)>((s['color']>>16)&255)+30)) and 50<r.y0<page.rect.height-50 and r.x0>25 and r.x1<page.rect.width-25:
   out.append(dict(q=q,rect=r))
 return out

def bounds_from_grid(page,anchor,anchors,ds):
 # Filled row border paths include both the top and bottom of each cell.
 r=anchor['rect'];cy=(r.y0+r.y1)/2;cx=(r.x0+r.x1)/2
 candidates=[]
 for d in ds:
  z=d['rect']; c=d.get('fill') or d.get('color')
  if c and min(c)>.99:continue
  if z.x0<25 or z.x1>page.rect.width-25 or z.y0<50 or z.y1>page.rect.height-50:continue
  if z.width>20 and 12<z.height<350 and z.contains((cx,cy)):
   n=sum(z.contains(((a['rect'].x0+a['rect'].x1)/2,(a['rect'].y0+a['rect'].y1)/2))for a in anchors)
   if n==1:candidates.append(z)
 if candidates:
  picked=pdf.Rect(max(candidates,key=lambda z:z.get_area()))
  peers=[d['rect']for d in ds if abs(d['rect'].y0-picked.y0)<.8 and abs(d['rect'].y1-picked.y1)<.8 and 20<d['rect'].width and d['rect'].x0>25 and d['rect'].x1<page.rect.width-25]
  for peer in peers:
   union=picked|peer
   count=sum(union.contains(((a['rect'].x0+a['rect'].x1)/2,(a['rect'].y0+a['rect'].y1)/2))for a in anchors)
   if count==1 and (abs(peer.x0-picked.x1)<15 or abs(picked.x0-peer.x1)<15):picked=union
  return picked, 'physical-label-row-border'
 # Early tables use separate thin rules spanning the answer cell, with a number cell on its right.
 rules=[d['rect']for d in ds if d['rect'].width>page.rect.width*.65 and d['rect'].height<2 and d['rect'].x0>=30 and 90<d['rect'].y0<page.rect.height-50]
 above=[z for z in rules if z.y1<cy];below=[z for z in rules if z.y0>cy]
 if above and below:
  top=max(above,key=lambda z:z.y1);bottom=min(below,key=lambda z:z.y0)
  if bottom.y0-top.y1<120 and top.x0<=r.x0:
   rr=pdf.Rect(top.x0-.5,top.y0,min(page.rect.width-30,max(top.x1,r.x1+7)),bottom.y1)
   if sum(rr.contains(((a['rect'].x0+a['rect'].x1)/2,(a['rect'].y0+a['rect'].y1)/2))for a in anchors)==1:return rr,'physical-label-table-rules'
 # Supplemental cells are drawn as four independent thin rectangles.
 cellrules=[d['rect']for d in ds if pale_rule(d,page,10) and d['rect'].x0<=cx<=d['rect'].x1]
 above=[z for z in cellrules if z.y1<cy];below=[z for z in cellrules if z.y0>cy]
 if above and below:
  top=max(above,key=lambda z:z.y1);bottom=min(below,key=lambda z:z.y0)
  if 12<bottom.y1-top.y0<100:
   rr=pdf.Rect(top.x0,top.y0,top.x1,bottom.y1)
   peers=[d['rect']for d in ds if pale_rule(d,page,10) and (abs(d['rect'].y0-top.y0)<.1 or abs(d['rect'].y1-bottom.y1)<.1)]
   for peer in peers:
    if abs(peer.x0-rr.x1)<10 or abs(rr.x0-peer.x1)<10:
     merged=rr|peer
     if sum(merged.contains(((a['rect'].x0+a['rect'].x1)/2,(a['rect'].y0+a['rect'].y1)/2))for a in anchors)==1:rr=merged
   return rr,'physical-label-supplemental-cell-borders'
 return None,None

def pale_rule(d,page,minwidth=100):
 r=d['rect'];c=d.get('fill') or d.get('color')
 return c and min(c)>.55 and max(c)-min(c)<.28 and r.width>minwidth and r.height<2 and r.x0>=30 and 90<r.y0<page.rect.height-50

def patch_number_anchors(page,ds,bottom):
 glyphs=[]
 for d in ds:
  r=d['rect'];c=d.get('fill')
  if c and c[2]>.6 and c[0]<.3 and r.y0>bottom and r.width<20 and 3<r.height<20:glyphs.append(pdf.Rect(r))
 clusters=[]
 for r in sorted(glyphs,key=lambda z:(round(z.y0/2),z.x0)):
  matched=next((c for c in clusters if abs(c.y0-r.y0)<2 and -1<r.x0-c.x1<4),None)
  if matched is not None:matched|=r
  else:clusters.append(pdf.Rect(r))
 return sorted(clusters,key=lambda z:(round(z.x0/5),z.y0))

def patch_crops(page,anchors,ds,outlined=False):
 # The appendix is an original two-column panel. Its number anchors and pale
 # rules identify independent answer cells; never use a page-width strip here.
 result={};cols=[]
 for a in sorted(anchors,key=lambda a:a['rect'].x0):
  col=next((c for c in cols if abs(c[0]['rect'].x0-a['rect'].x0)<5),None)
  if col is None:cols.append([a])
  else:col.append(a)
 for colindex,col in enumerate(cols):
  col.sort(key=lambda a:a['rect'].y0);left=min(a['rect'].x0 for a in col)-1
  nextleft=min(a['rect'].x0 for a in cols[colindex+1])-5 if colindex+1<len(cols)else page.rect.width-42
  rules=[d['rect']for d in ds if pale_rule(d,page,10) and abs(d['rect'].x0-left)<5 and d['rect'].x1<=nextleft+2]
  right=max((r.x1 for r in rules),default=nextleft)
  for i,a in enumerate(col):
   ar=a['rect'];top=ar.y0-2
   nexttop=col[i+1]['rect'].y0-2 if i+1<len(col)else None
   bottoms=[r.y1 for r in rules if r.y0>ar.y1 and (nexttop is None or r.y0<nexttop+2)]
   if bottoms:bottom=min(bottoms)+.5
   elif nexttop is not None:bottom=nexttop-1
   else:
    # Narrow added numeric columns have no rule. The previous rows prove their
    # fixed line spacing; the final numeric answer is one line below the label.
    assert len(col)>1,'unbounded appendix singleton'
    spacing=min(col[j+1]['rect'].y0-col[j]['rect'].y0 for j in range(len(col)-1))
    bottom=top+spacing-1
   r=pdf.Rect(left,top,right+1,bottom)
   assert r.height>10 and not any(r.intersects(b['rect'])for b in anchors if b is not a),'appendix answer overlaps a different label'
   result[a['q']]=r
 return result

def runone(source):
 pid=source['pdfId'];p=CACHE/f'{pid}.pdf'
 sourcehash=hashlib.sha256(p.read_bytes()).hexdigest()
 assert not source.get('sourceSha256') or sourcehash==source['sourceSha256'],'cached PDF hash differs from source catalog'
 doc=pdf.open(p);expected=sorted({int(q['q'])for q in source['questions']}); entries={};methods=[]
 start=source.get('answerStartPage');assert isinstance(start,int)and 1<=start<=len(doc),'invalid answer start'
 producer=doc.metadata.get('producer','')
 outlined='Ghostscript' in producer or 'Unicode text layer rebuilt' in producer
 for n in range(start,len(doc)+1):
  page=doc[n-1];rs,ds=rects(page)
  if outlined:
   labels=overlay_numbers(page)
   if 'Ghostscript' in doc.metadata.get('producer',''):
    # Full-width answer rows; the top intro panel is colored differently and has no peer row abutment.
    rr=[r for r in rs if r.width>page.rect.width*.7]
    chains=[]
    for r in sorted(rr,key=lambda r:r.y0):
     if chains and abs(chains[-1][-1].y1-r.y0)<1:chains[-1].append(r)
     else:chains.append([r])
    rows=max(chains,key=len,default=[])
   else:
    rules=[d['rect']for d in ds if pale_rule(d,page,page.rect.width*.65)]
    rules=sorted({round(z.y0,2):z for z in rules}.values(),key=lambda r:r.y0)
    verticals=[d['rect']for d in ds if d['rect'].width<2 and d['rect'].height>10 and d['rect'].x0>rules[0].x1 and d['rect'].y0>=rules[0].y0-2 and d['rect'].y1<=rules[-1].y1+2]
    right=max((z.x1 for z in verticals),default=page.rect.width-39)
    rows=[pdf.Rect(a.x0-.5,a.y0,right+.5,b.y1)for a,b in zip(rules,rules[1:]) if 12<b.y0-a.y0<120]
    extra=[q for q in labels if q>20]
    if extra:
     ars=patch_number_anchors(page,ds,rules[-1].y1)
     assert len(ars)==len(extra),f'appendix physical anchor count {len(ars)} != labels {extra}'
     ea=[dict(q=q,rect=rr)for q,rr in zip(extra,ars)]
     for q,rr in patch_crops(page,ea,ds,True).items():
      assert q in expected and q not in entries
      entries[q]=[normcrop(page,n,rr)];methods.append('outlined-appendix-vector-label-and-column-rules')
     labels=[q for q in labels if q<=20]
   assert len(rows)==len(labels),f'outlined row/semantic label mismatch p{n}: {len(rows)} vs {labels}'
   for q,rr in zip(labels,rows):
    assert q in expected and q not in entries,f'outlined duplicate/unexpected {q}'
    entries[q]=[normcrop(page,n,rr)];methods.append('outlined-original-row-borders+semantic-label-order')
  else:
   anchors=physical(page)
   appendix=[a for a in anchors if a['q']>20] if source['grade']==1 else []
   if source['grade']==2:
    leftanchors=[a for a in anchors if a['rect'].x1<page.rect.width*.8]
    xs=[]
    for a in leftanchors:
     if not any(abs(x-a['rect'].x0)<5 for x in xs):xs.append(a['rect'].x0)
    if len(xs)>1:appendix=leftanchors
   appendix_rects=patch_crops(page,appendix,ds) if appendix else {}
   for a in anchors:
    q=a['q'];assert q in expected and q not in entries,f'physical duplicate/unexpected {q} p{n}'
    rr,method=(appendix_rects[q],'physical-appendix-column-rules') if q in appendix_rects else bounds_from_grid(page,a,anchors,ds)
    if rr is None:raise ValueError(f'No original answer-row boundary for q{q} page{n}')
    entries[q]=[normcrop(page,n,rr)];methods.append(method)
 if source['grade']==3:
  formproof=rectify(doc,source,entries,physical,spans,normcrop)
  if formproof:
   (R/'form-proofs').mkdir(exist_ok=True);(R/'form-proofs'/f'{pid}.json').write_text(json.dumps(formproof,indent=2)+'\n')
   methods=['physical-label-and-whole-form-bounds']*len(entries)
 assert sorted(entries)==expected,f'coverage expected {expected}, found {sorted(entries)}'
 # Adjacent answer cells share the same painted border. Divide that decorative
 # rule at its midpoint instead of duplicating it; no glyph enters the strip.
 for qa,ca in entries.items():
  for qb,cb in entries.items():
   if qa>=qb:continue
   for a in ca:
    for b in cb:
     if a['page']!=b['page']:continue
     if min(a['x']+a['w'],b['x']+b['w'])-max(a['x'],b['x'])<=.00001:continue
     top,bot=(a,b)if a['y']<b['y']else(b,a)
     overlap=top['y']+top['h']-bot['y']
     if overlap<=.000001:continue
     assert overlap*doc[a['page']-1].rect.height<2,f'answer overlap beyond shared rule q{qa},q{qb}'
     mid=round((top['y']+top['h']+bot['y'])/2,6);botend=bot['y']+bot['h']
     top['h']=round(mid-top['y'],6);bot['y']=mid;bot['h']=round(botend-mid,6)
 if source['grade']==3:align_shared_boundaries(doc,entries)
 result=dict(version=1,sourceSha256=hashlib.sha256(p.read_bytes()).hexdigest(),questions=[dict(q=q,parts=sorted({str(z.get('part',''))for z in source['questions']if int(z['q'])==q and z.get('part')}),crops=entries[q])for q in expected])
 return result,collections.Counter(methods)

def main():
 global W,R,CACHE,OUTPUT,REPORT,KNOWN_GAPS
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--repo',type=Path,required=True,help='Repository root containing headless/astro-poc')
 ap.add_argument('--pdf-cache',type=Path,required=True,help='Read-only source cache named <pdfId>.pdf')
 ap.add_argument('--output',type=Path,required=True,help='Output answer map JSON')
 ap.add_argument('--report',type=Path,required=True,help='Output coverage report JSON')
 ap.add_argument('--known-gaps',type=Path,default=Path(__file__).with_name('elementary-answer-known-gaps.json'),help='Human-verified source content gaps, bound to original PDF hashes')
 args=ap.parse_args();W=args.repo;CACHE=args.pdf_cache;OUTPUT=args.output;REPORT=args.report;KNOWN_GAPS=args.known_gaps
 R=OUTPUT.parent;R.mkdir(parents=True,exist_ok=True);REPORT.parent.mkdir(parents=True,exist_ok=True)
 cat=json.loads((W/'headless/astro-poc/public/teachers/teacher-catalog.json').read_text());sources={}
 for g in cat['grades']:
  if g['grade']>6:continue
  for t in g['topics']:
   for s in t['sheets']:
    sources[s['pdfId']]=json.loads((W/'headless/astro-poc/public/teachers/sheets'/f"{s['pdfId']}.json").read_text())
 maps={};report={'success':[],'failures':[]}
 for pid,source in sources.items():
  try:
   m,methods=runone(source);maps[pid]=m;report['success'].append(dict(pdfId=pid,grade=source['grade'],questions=len(m['questions']),methods=dict(methods)))
  except Exception as ex:report['failures'].append(dict(pdfId=pid,grade=source['grade'],error=str(ex)))
 known=json.loads(KNOWN_GAPS.read_text())
 assert known['version']==1,'unknown content-gap manifest version'
 report['knownContentGaps']=[]
 for pid,issue in known['sources'].items():
  if pid not in maps:continue
  assert issue['sourceSha256']==maps[pid]['sourceSha256'],f'known content gap requires new source review: {pid}'
  byq={q['q']:q for q in maps[pid]['questions']}
  for gap in issue['questions']:
   assert gap['q'] in byq,f'unknown content-gap question: {pid} {gap["q"]}'
   byq[gap['q']]['unavailableReason']=gap['unavailableReason']
   report['knownContentGaps'].append(dict(pdfId=pid,**gap))
 OUTPUT.write_text(json.dumps(maps,ensure_ascii=False,indent=2)+'\n');REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(dict(success=len(maps),fail=len(report['failures']),questions=sum(len(x['questions'])for x in maps.values()))))
 for x in report['failures']:print(x)
 if report['failures']:raise SystemExit(1)
if __name__=='__main__':main()
