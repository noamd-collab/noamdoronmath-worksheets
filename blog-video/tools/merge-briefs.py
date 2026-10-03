#!/usr/bin/env python3
"""Merges per-group reading notes (JSON keyed by postId) into blog-video/briefs.json.
Usage: merge-briefs.py <group.json> <readBy> [--dismiss postId:substring:reason ...]
Existing entries for other posts are kept; entries for the same post are replaced."""
import json, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(root, 'briefs.json')
data = json.load(open(path)) if os.path.exists(path) else {"note": "", "posts": {}}
src, read_by = sys.argv[1], sys.argv[2]
dismiss = [a.split(':', 2) for a in sys.argv[3:] if a != '--dismiss']
for pid, b in json.load(open(src)).items():
    b['readBy'] = read_by
    kept, dropped = [], []
    for s in b.get('sourceIssues', []):
        txt = s if isinstance(s, str) else json.dumps(s, ensure_ascii=False)
        hit = next((d for d in dismiss if d[0] == pid and d[1] in txt), None)
        (dropped if hit else kept).append({"issue": txt, "dismissedBecause": hit[2]} if hit else s)
    b['sourceIssues'] = kept
    if dropped: b['dismissedIssues'] = dropped
    data['posts'][pid] = b
data['posts'] = dict(sorted(data['posts'].items()))
json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
open(path, 'a').write('\n')
print(f"{len(data['posts'])} posts in briefs.json")
