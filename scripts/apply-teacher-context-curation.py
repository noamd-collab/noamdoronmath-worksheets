#!/usr/bin/env python3
"""Restore reviewed teacher context after the standard teacher-data generator.

Only the existing stem and own-row fields are changed. A student hash and exact
item IDs bind curation to the reviewed public manifest. No PDF, answers or
network are used.

Record schema 1 carries reviewed stems only. Schema 2 may also carry reviewed
own rows, for a printed prompt line that the measured row ends inside; a row
patch must still contain the item's own pin, stay inside the question's crop
union and stop before the next item's printed-label boundary, so it cannot reach another
item's ink.
"""
import argparse
import copy
import json
import math
from pathlib import Path


def validate_rectangle(rect, page_count, label):
    if not isinstance(rect, dict) or set(rect) != {'page', 'x', 'y', 'w', 'h'}:
        raise ValueError(f'Unsupported {label} fields')
    if any(isinstance(rect[k], bool) or not isinstance(rect[k], (int, float))
           or not math.isfinite(rect[k]) for k in ('page', 'x', 'y', 'w', 'h')):
        raise ValueError(f'Non-finite or non-numeric {label} rectangle')
    if rect['page'] != int(rect['page']):
        raise ValueError(f'Invalid {label} page')
    if not (1 <= rect['page'] <= page_count and
            0 <= rect['x'] < 1 and 0 <= rect['y'] < 1 and
            0 < rect['w'] <= 1 - rect['x'] + 1e-6 and
            0 < rect['h'] <= 1 - rect['y'] + 1e-6):
        raise ValueError(f'{label.capitalize()} outside student PDF')


def apply(record, manifest_dir, sheet_dir, check=False):
    schema = record.get('schema')
    if schema not in ('teacher-reviewed-context-curation/1',
                      'teacher-reviewed-context-curation/2'):
        raise ValueError('Unsupported teacher-context record')
    pending = []
    total = 0
    for level in record['levels']:
        media = level['mediaId']
        if len(media) != 32 or any(c not in '0123456789abcdef' for c in media):
            raise ValueError('Invalid media ID')
        manifest = json.loads((manifest_dir / (media + '.json')).read_text())
        path = sheet_dir / (media + '.json')
        original = json.loads(path.read_text())
        source = copy.deepcopy(original)
        if manifest.get('sourceSha256') != level['studentSha256']:
            raise ValueError('Student binding changed; independent re-review required')
        if manifest.get('prefix') != record['package'] or manifest.get('level') != level['level']:
            raise ValueError('Package or level binding changed')
        items = source['questions']
        if len(items) != level['exerciseCount'] or source.get('pdfId') != media:
            raise ValueError('Teacher item binding changed')
        by_id = {str(q['id']): q for q in items}
        manifest_ids = [str(q['q']) + str(q.get('part') or '') for q in manifest['exercises']]
        native_ids = set(manifest_ids)
        if len(native_ids) != len(manifest_ids):
            raise ValueError('Duplicate manifest exercise ID')
        if len(by_id) != len(items) or set(by_id) != native_ids:
            raise ValueError('Teacher/manifest item mismatch')
        seen = set()
        for patch in level.get('stems', []):
            ident = patch['id']
            stem = patch['stem']
            if ident in seen or ident not in by_id:
                raise ValueError('Duplicate or unknown context target')
            seen.add(ident)
            validate_rectangle(stem, manifest['pageCount'], 'context')
            by_id[ident]['stem'] = stem
        rows = level.get('rows', [])
        if rows and schema == 'teacher-reviewed-context-curation/1':
            raise ValueError('Row curation needs schema 2')
        crops = {}
        for exercise in manifest['exercises']:
            ident = str(exercise['q']) + str(exercise.get('part') or '')
            crops[ident] = exercise['crops']
        order = [str(q['id']) for q in items]
        seen_rows = set()
        row_patch_ids = {patch['id'] for patch in rows}
        for patch in rows:
            ident = patch['id']
            row = patch['row']
            if ident in seen_rows or ident not in by_id:
                raise ValueError('Duplicate or unknown row target')
            seen_rows.add(ident)
            validate_rectangle(row, manifest['pageCount'], 'row')
            record_item = by_id[ident]
            pin = next(e['pin'] for e in manifest['exercises']
                       if str(e['q']) + str(e.get('part') or '') == ident)
            if row['page'] != pin['page'] or not (
                    row['x'] <= pin['x'] <= row['x'] + row['w'] and
                    row['y'] <= pin['y'] <= row['y'] + row['h']):
                raise ValueError('Reviewed row must contain its own pin')
            inside = any(crop['page'] == row['page'] and
                         crop['x'] - 1e-6 <= row['x'] and
                         row['x'] + row['w'] <= crop['x'] + crop['w'] + 1e-6 and
                         crop['y'] - 1e-6 <= row['y'] and
                         row['y'] + row['h'] <= crop['y'] + crop['h'] + 1e-6
                         for crop in crops[ident])
            if not inside:
                raise ValueError('Reviewed row outside the question crop')
            position = order.index(ident)
            for later in order[position + 1:]:
                # Context rows may deliberately begin before their own part.
                # The preserved printed-label anchor remains stable on replay.
                nxt = by_id[later].get('labelLine')
                if nxt is None:
                    if later in row_patch_ids:
                        raise ValueError('Missing stable next-item label anchor')
                    # Legacy, unpatched rows retain their original boundary.
                    nxt = by_id[later].get('row')
                if nxt and nxt['page'] == row['page'] and \
                        nxt['y'] + 1e-6 < row['y'] + row['h']:
                    raise ValueError('Reviewed row reaches the next item label')
            record_item['row'] = row
            record_item['rows'] = [row]
        if check and source != original:
            raise ValueError('Reviewed teacher context needs regeneration')
        pending.append((path, source))
        total += len(seen) + len(seen_rows)
    if not check:
        for path, source in pending:
            path.write_text(json.dumps(source, ensure_ascii=False, separators=(',', ':')))
    return total


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--record', type=Path, required=True)
    parser.add_argument('--manifest-dir', type=Path, default=root / 'noam-ai/manifests')
    parser.add_argument('--sheet-dir', type=Path, default=root / 'headless/astro-poc/public/teachers/sheets')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    count = apply(json.loads(args.record.read_text()), args.manifest_dir, args.sheet_dir, args.check)
    print(('Verified' if args.check else 'Applied') + f' {count} reviewed teacher contexts')


if __name__ == '__main__':
    main()
