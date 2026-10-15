"""Apply this package's reviewed top-boundary corrections to manifest copies only."""
import argparse,copy,json,math
from pathlib import Path

def apply(record, directory, check=False):
    if record.get('schema')!='student-reviewed-crop-curation/1' or record.get('package')!='G9-T32' or record.get('grade')!=9 or record.get('topicId')!=19:
        raise ValueError('Unexpected package binding')
    pending=[];count=0
    for level in record['levels']:
        media=level['mediaId'];p=directory/(media+'.json');m=json.loads(p.read_text())
        if (m.get('prefix'),m.get('grade'),m.get('topicId'),m.get('level'),m.get('sourceSha256'))!=('G9-T32',9,19,level['level'],level['studentSha256']):
            raise ValueError('Manifest/source binding changed')
        if len({e['id'] for e in m['exercises']})!=len(m['exercises']):raise ValueError('Duplicate item IDs')
        for op in level['operations']:
            group=[e for e in m['exercises'] if e['q']==op['q']]
            if [e['id'] for e in group]!=op['itemIds'] or not group:raise ValueError('Question item binding changed')
            old,new=op['before'],op['after']
            if set(old)!=set(new) or set(new)!=set(['page','x','y','w','h']):raise ValueError('Unexpected rectangle fields')
            if any(not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) for v in new.values()):raise ValueError('Invalid rectangle')
            if not (new['page']==old['page'] and new['x']==old['x'] and new['w']==old['w'] and new['y']<old['y'] and abs(new['y']+new['h']-old['y']-old['h'])<1e-9):raise ValueError('Only top expansion preserving bottom is permitted')
            if not (1<=new['page']<=m['pageCount'] and int(new['page'])==new['page'] and 0<=new['x']<1 and 0<=new['y']<1 and 0<new['w']<=1-new['x'] and 0<new['h']<=1-new['y']):raise ValueError('Out of page')
            for e in group:
                if not ((e['crop']==old and e['crops']==[old]) or (e['crop']==new and e['crops']==[new])):raise ValueError('Crop binding changed')
                pin=e['pin']
                if pin['page']!=new['page'] or not (new['x']<=pin['x']<=new['x']+new['w'] and new['y']<=pin['y']<=new['y']+new['h']):raise ValueError('Own pin omitted')
                if check and e['crop']!=new:raise ValueError('Patch not applied')
                e['crop']=copy.deepcopy(new);e['crops']=[copy.deepcopy(new)]
            count+=1
        pending.append((p,m))
    if not check:
        for p,m in pending:p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    return count
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--record',type=Path,required=True);p.add_argument('--manifest-dir',type=Path,required=True);p.add_argument('--check',action='store_true');a=p.parse_args();print(apply(json.loads(a.record.read_text()),a.manifest_dir,a.check))
