"""Apply this package's reviewed crop corrections to manifest copies only.

Schema 1 operations expand a single-crop question's top boundary, preserving
its bottom. Schema 2 adds two strictly validated cross-page repairs:
removeContinuationCrop drops a continuation slice that carries only foreign
section chrome (none of the question's pins or its primary crop may sit on
that slice), and a before/after pair with a shared top and a smaller height
trims a continuation slice's bottom in place, by position. IDs, pins and all
unrelated crops never change. Schema 2 binds the complete ordered crop/crops
state of every item before and after each question operation; drift is rejected.
"""
import argparse,copy,json,math
from pathlib import Path

def crop_state(group):
    return [dict(id=e['id'], crop=copy.deepcopy(e['crop']),
                 crops=copy.deepcopy(e['crops'])) for e in group]

def same_state(left, right):
    # JSON equality also distinguishes booleans from numeric coordinates.
    return json.dumps(left, sort_keys=True, allow_nan=False) == json.dumps(
        right, sort_keys=True, allow_nan=False)

def validate_states(op, group):
    for name in ('beforeState', 'afterState'):
        state = op.get(name)
        if not isinstance(state, list) or any(
                not isinstance(item, dict) or set(item) != {'id', 'crop', 'crops'}
                for item in state):
            raise ValueError('Complete schema 2 crop states required')
        if [item['id'] for item in state] != [e['id'] for e in group]:
            raise ValueError('State item binding changed')
    current = crop_state(group)
    if not same_state(current, op['beforeState']) and not same_state(current, op['afterState']):
        raise ValueError('Complete question crop binding changed')

def apply(record, directory, check=False):
    if record.get('schema') not in ('student-reviewed-crop-curation/1','student-reviewed-crop-curation/2') or record.get('package')!='G9-T40' or record.get('grade')!=9 or record.get('topicId')!=40:
        raise ValueError('Unexpected package binding')
    pending=[];count=0
    for level in record['levels']:
        media=level['mediaId']
        if record['schema']=='student-reviewed-crop-curation/2' and (
                not isinstance(media, str) or len(media)!=32 or
                any(c not in '0123456789abcdef' for c in media)):
            raise ValueError('Invalid media binding')
        p=directory/(media+'.json');m=json.loads(p.read_text())
        if record['schema']=='student-reviewed-crop-curation/2' and m.get('pdfHash')!=media:
            raise ValueError('Manifest/media binding changed')
        if (m.get('prefix'),m.get('grade'),m.get('topicId'),m.get('level'),m.get('sourceSha256'))!=('G9-T40',9,40,level['level'],level['studentSha256']):
            raise ValueError('Manifest/source binding changed')
        if len({e['id'] for e in m['exercises']})!=len(m['exercises']):raise ValueError('Duplicate item IDs')
        for op in level['operations']:
            group=[e for e in m['exercises'] if e['q']==op['q']]
            if [e['id'] for e in group]!=op['itemIds'] or not group:raise ValueError('Question item binding changed')
            if record['schema']=='student-reviewed-crop-curation/2':validate_states(op, group)
            if 'remove' in op:
                if record['schema']!='student-reviewed-crop-curation/2':raise ValueError('Continuation removal needs schema 2')
                rect=op['remove']
                if set(rect)!=set(['page','x','y','w','h']):raise ValueError('Unexpected rectangle fields')
                if any(not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) for v in rect.values()):raise ValueError('Invalid rectangle')
                if not (1<=rect['page']<=m['pageCount'] and int(rect['page'])==rect['page'] and 0<=rect['x']<1 and 0<=rect['y']<1 and 0<rect['w']<=1-rect['x'] and 0<rect['h']<=1-rect['y']):raise ValueError('Out of page')
                for e in group:
                    pin=e['pin']
                    if pin['page']==rect['page']:raise ValueError('Own pin sits on the removed slice')
                    if e['crop']==rect:raise ValueError('Primary crop cannot be removed')
                    if e['crops'] and e['crops'][0]==rect:raise ValueError('Owned first slice cannot be removed')
                    if rect in e['crops']:
                        if check:raise ValueError('Patch not applied')
                        e['crops']=[c for c in e['crops'] if c!=rect]
                    if not any(c['page']==pin['page'] and c['x']-1e-9<=pin['x']<=c['x']+c['w']+1e-9 and c['y']-1e-9<=pin['y']<=c['y']+c['h']+1e-9 for c in e['crops']):raise ValueError('Own pin omitted')
            else:
                old,new=op['before'],op['after']
                if set(old)!=set(new) or set(new)!=set(['page','x','y','w','h']):raise ValueError('Unexpected rectangle fields')
                if any(not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) for v in new.values()):raise ValueError('Invalid rectangle')
                expand_top=new['y']<old['y'] and abs(new['y']+new['h']-old['y']-old['h'])<1e-9
                trim_bottom=new['y']==old['y'] and new['h']<old['h']
                if trim_bottom and record['schema']!='student-reviewed-crop-curation/2':raise ValueError('Bottom trim needs schema 2')
                if not (new['page']==old['page'] and new['x']==old['x'] and new['w']==old['w'] and (expand_top or trim_bottom)):raise ValueError('Only top expansion preserving bottom, or bottom trim preserving top, is permitted')
                if not (1<=new['page']<=m['pageCount'] and int(new['page'])==new['page'] and 0<=new['x']<1 and 0<=new['y']<1 and 0<new['w']<=1-new['x'] and 0<new['h']<=1-new['y']):raise ValueError('Out of page')
                for e in group:
                    if expand_top:
                        if not ((e['crop']==old and e['crops']==[old]) or (e['crop']==new and e['crops']==[new])):raise ValueError('Crop binding changed')
                        pin=e['pin']
                        if pin['page']!=new['page'] or not (new['x']<=pin['x']<=new['x']+new['w'] and new['y']<=pin['y']<=new['y']+new['h']):raise ValueError('Own pin omitted')
                        if check and e['crop']!=new:raise ValueError('Patch not applied')
                        e['crop']=copy.deepcopy(new);e['crops']=[copy.deepcopy(new)]
                    else:
                        occurrences=(e['crop']==old)+(old in e['crops'])
                        applied=(e['crop']==new)+(new in e['crops'])
                        if occurrences+applied==0:raise ValueError('Crop binding changed')
                        if check and occurrences:raise ValueError('Patch not applied')
                        pin=e['pin']
                        if pin['page']==new['page'] and not (new['x']-1e-9<=pin['x']<=new['x']+new['w']+1e-9 and new['y']-1e-9<=pin['y']<=new['y']+new['h']+1e-9):raise ValueError('Own pin omitted')
                        if e['crop']==old:e['crop']=copy.deepcopy(new)
                        e['crops']=[copy.deepcopy(new) if c==old else c for c in e['crops']]
            if record['schema']=='student-reviewed-crop-curation/2' and not same_state(crop_state(group), op['afterState']):
                raise ValueError('Complete question crop after-state mismatch')
            count+=1
        pending.append((p,m))
    if not check:
        for p,m in pending:p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    return count
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--record',type=Path,required=True);p.add_argument('--manifest-dir',type=Path,required=True);p.add_argument('--check',action='store_true');a=p.parse_args();print(apply(json.loads(a.record.read_text()),a.manifest_dir,a.check))
