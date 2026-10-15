#!/usr/bin/env python3
"""Replay reviewed student crop changes, bound to source, media and exact IDs.

The generic PDF builder is unchanged. Apply to a freshly generated manifest.
Only crop/crops can change. Validation finishes before the file is written.
"""
import argparse
import copy
import json
import math
from pathlib import Path


def apply_curation(manifest, record, level):
    m = copy.deepcopy(manifest)
    if record.get('schema') != 'crop-curation/1':
        raise ValueError('Unsupported crop curation schema')
    bound = record['levels'][level]
    if m['pdfHash'] != bound['mediaId'] or m['sourceSha256'] != bound['sourceSha256']:
        raise ValueError('Media ID or source SHA mismatch')
    seen = set()
    changes = []
    for patch in record['trims']:
        if patch['level'] != level:
            continue
        key = (patch['question'], patch['page'])
        if key in seen:
            raise ValueError('Duplicate question/page patch')
        seen.add(key)
        exercises = [e for e in m['exercises'] if e['q'] == patch['question']]
        if not exercises or [e['id'] for e in exercises] != patch['exerciseIds']:
            raise ValueError('Exercise ID list mismatch')
        for e in exercises:
            crops = e['crops']
            indices = [i for i, c in enumerate(crops) if c['page'] == patch['page']]
            if len(indices) != 1:
                raise ValueError('Expected exactly one crop on the reviewed page')
            i = indices[0]
            c = crops[i]
            if not math.isfinite(patch['expectedOldBottom']) or abs(round(c['y'] + c['h'], 6) - patch['expectedOldBottom']) > 1e-6:
                raise ValueError('Original crop boundary mismatch')
            if patch['operation'] == 'drop':
                if e['pin']['page'] == patch['page'] or len(crops) <= 1:
                    raise ValueError('Cannot drop an own-pin page or sole crop')
                del crops[i]
                if e['crop']['page'] == patch['page']:
                    e['crop'] = copy.deepcopy(crops[0])
            elif patch['operation'] == 'resize':
                bottom = patch['trimBottomY']
                if not math.isfinite(bottom) or not c['y'] < bottom <= 1:
                    raise ValueError('Invalid reviewed bottom boundary')
                if e['pin']['page'] == patch['page'] and not c['y'] <= e['pin']['y'] <= bottom:
                    raise ValueError('Reviewed crop excludes own pin')
                c['h'] = round(bottom - c['y'], 6)
                if e['crop']['page'] == patch['page']:
                    e['crop'] = copy.deepcopy(c)
            else:
                raise ValueError('Unknown crop operation')
            changes.append(e['id'])
    return m, changes


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--curation', required=True)
    ap.add_argument('--level', required=True)
    args = ap.parse_args()
    path = Path(args.manifest)
    result, changes = apply_curation(json.loads(path.read_text()), json.loads(Path(args.curation).read_text()), args.level)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n')
    print(f'{path}: applied {len(changes)} reviewed crop changes')


if __name__ == '__main__':
    main()
