"""Complete G3 answer geometry from actual per-answer PDF Form XObjects.

Patched original answers can protrude above a decorative table boundary. A
source form must fully contain exactly one physical number label vertically;
its resource name/order is not used as a question id. Original glyphs and
whole rendered forms are retained without reconstructing mathematical text.
"""
import re
import pymupdf as pdf

def form_is_inert(doc, xref, stack=()):
 """Conservatively prove an old form only transforms/clips and paints nothing.

 Unknown operators, images, text, unresolved children or cycles fail closed.
 This is intentionally a narrow recognizer for the original repair forms.
 """
 if xref in stack:return False
 raw=doc.xref_stream(xref)
 if raw is None:return False
 try:tokens=re.findall(r'/[^\s/]+|[^\s/]+',re.sub(r'%[^\r\n]*','',raw.decode('ascii')))
 except UnicodeDecodeError:return False
 permitted={'q','Q','cm','re','W','W*','n','m','l','c','v','y','h'}
 i=0
 while i<len(tokens):
  token=tokens[i]
  if token.startswith('/'):
   if i+1<len(tokens) and tokens[i+1]=='gs':i+=2;continue
   if i+1>=len(tokens) or tokens[i+1]!='Do':return False
   typ,value=doc.xref_get_key(xref,'Resources/XObject/'+token[1:])
   if typ!='xref':return False
   if not form_is_inert(doc,int(value.split()[0]),stack+(xref,)):return False
   i+=2;continue
  if token not in permitted and not re.fullmatch(r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)',token):return False
  i+=1
 return True

def rectify(doc, source, entries, physical, spans, normcrop):
 diagnostics=[]
 for pn in sorted({c['page']for cs in entries.values()for c in cs}):
  p=doc[pn-1];aa=physical(p);byq={a['q']:a for a in aa};forms={};form_xrefs={}
  invocation_order={x.group(1).decode():x.start()for x in re.finditer(rb'/([^\s/]+)\s+Do\b',p.read_contents())}
  invoked=set(invocation_order)
  for xref,name,invoker,bbox in sorted(p.get_xobjects(),key=lambda o:invocation_order.get(o[1],-1)):
   if invoker or name not in invoked:continue
   b=pdf.Rect(bbox);r=pdf.Rect(b.x0,p.rect.height-b.y1,b.x1,p.rect.height-b.y0)
   if not(p.rect.width*.7<r.width<p.rect.width*.95 and 5<r.height<100 and r.y0>60 and r.y1<p.rect.height-50):continue
   owners=[a['q']for a in aa if r.y0<=a['rect'].y0 and r.y1>=a['rect'].y1]
   assert len(owners)==1, f'nonunique answer form ownership {source["pdfId"]} p{pn} {name}: {owners}'
   q=owners[0]
   if q in form_xrefs:assert form_is_inert(doc,form_xrefs[q]),f'superseded answer form still paints content: {source["pdfId"]} p{pn} q{q}'
   form_xrefs[q]=xref;forms[q]=[r];diagnostics.append(dict(page=pn,q=q,xref=xref,form=name,rect=list(r),method='unique complete physical-label vertical containment; latest invoked replacement for repeated q',invocationOffset=invocation_order[name]))
  if not forms:continue
  # Whole form bounds already enclose superscripts, fractions and radical bars.
  # For unpatched answers use visible source text/path ink, excluding unrelated
  # forms that crossed the old decorative cell boundary.
  ds=p.get_drawings();ss=spans(p)
  for q,a in byq.items():
   if q not in entries or entries[q][0]['page']!=pn:continue
   if q in forms:
    r=pdf.Rect(forms[q][0])
    for form in forms[q][1:]:r|=form
    r|=a['rect'];r.x1=max(r.x1,a['rect'].x1+1)
    r+=(-.6,-.6,.6,.6)
   else:
    c=entries[q][0];old=pdf.Rect(c['x']*p.rect.width,c['y']*p.rect.height,(c['x']+c['w'])*p.rect.width,(c['y']+c['h'])*p.rect.height)
    foreign=[f for fq,fs in forms.items() if fq!=q for f in fs]
    r=pdf.Rect(a['rect']);body=[]
    for s in ss:
     z=pdf.Rect(s['bbox']);center=(z.tl+z.br)/2
     if not old.contains(center) or any(f.contains(center) for f in foreign):continue
     if s.get('alpha',255)==0 or not s['text'].strip():continue
     body.append(z)
    for d in ds:
     z=d['rect'];center=(z.tl+z.br)/2;col=d.get('fill')
     if not col or max(col)>.4 or z.width>200 or z.height>50 or z.height<.3 or z.width<.1:continue
     if old.contains(center) and not any(f.contains(center)for f in foreign):body.append(z)
    for z in body:r|=z
    r+=(-1,-2,1,2)
   entries[q]=[normcrop(p,pn,r)]
 return diagnostics


def align_shared_boundaries(doc, entries):
 """Place a shared cut in the observed white gap, within 1pt of form midpoint.

 A source form can leave a one-pixel overhang under rasterization. This moves
 only a boundary shared by two already proven whole-answer forms, never body
 content or a label. Any edge without a clear white gap remains for the separate raster audit.
 """
 pages={}
 flat=[c for cs in entries.values()for c in cs]
 for a in flat:
  for b in flat:
   if a is b or a['page']!=b['page']:continue
   if abs(a['y']+a['h']-b['y'])>0.000002:continue
   if min(a['x']+a['w'],b['x']+b['w'])<=max(a['x'],b['x']):continue
   pn=a['page'];p=doc[pn-1]
   if pn not in pages:
    pix=p.get_pixmap(matrix=pdf.Matrix(4,4),colorspace=pdf.csGRAY,alpha=False)
    pages[pn]=(pix.width,pix.height,pix.samples)
   width,height,samples=pages[pn];cut=round(b['y']*p.rect.height*4)
   x0=max(0,int(min(a['x'],b['x'])*p.rect.width*4));x1=min(width,int(max(a['x']+a['w'],b['x']+b['w'])*p.rect.width*4)+1)
   white=[]
   for y in range(max(0,cut-4),min(height,cut+5)):
    if all(v>=100 for v in samples[y*width+x0:y*width+x1]):white.append(y)
   runs=[]
   for y in white:
    if runs and y==runs[-1][-1]+1:runs[-1].append(y)
    else:runs.append([y])
   safe=[r for r in runs if len(r)>=3]
   if not safe:continue  # original decorative rules can be dark; audit separately
   run=max(safe,key=lambda r:(len(r),-abs((r[0]+r[-1])/2-cut)))
   mid=round(((run[0]+run[-1]+1)/2/4)/p.rect.height,6)
   end=b['y']+b['h'];a['h']=round(mid-a['y'],6);b['y']=mid;b['h']=round(end-mid,6)
