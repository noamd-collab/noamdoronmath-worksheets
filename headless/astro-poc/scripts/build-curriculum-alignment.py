#!/usr/bin/env python3
"""Build src/data/curriculum-alignment.v1.json (SEO-4) from inputs in the repo.

Run from headless/astro-poc:
  python3 scripts/build-curriculum-alignment.py            # write the mapping
  python3 scripts/build-curriculum-alignment.py --check    # exit 1 when the committed mapping differs
  python3 scripts/build-curriculum-alignment.py --routed <slug-grades.json>
      # use this {slug: grade} map of routed topic pages instead of asking tsx

Inputs, all in the repo:
  scripts/data/curriculum-alignment-sources.v1.json
      the 173 official layout units (track, name, prisa page) with the
      coverage status and the landing pages of each unit;
  src/data/topic-pages/<slug>.json
      landing copy; every re-judged row names phrases that must appear in it;
  TOPIC_PAGE_SLUGS (src/lib/topicPages.ts)
      the routed topic pages and their grades, read through tsx.

Rules:
  covered_by_landing -> alignmentType "teaches"
  partial            -> alignmentType "educationalSubject"
  topic_exists_no_landing_copy and no_topic rows are not aligned.
CORRECTIONS (from the coverage verifier, verify.json) and REJUDGED (rows
re-judged against the merged landings) override the extracted status.

The sources file is extracted from the curriculum-mapping project folder:
  python3 scripts/build-curriculum-alignment.py --extract <project-root>
It reads reports/curriculum-mapping-20261116/all-units.csv and
submissions/Claude/MANAGER-20261116/landing-plan/coverage.json, hashes
verify.json, and records file names, sha256 and the official layout URLs.
"""
from __future__ import annotations  # "str | None" annotations must load on Python 3.9

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # headless/astro-poc
REPO_PREFIX = 'headless/astro-poc'
SOURCES = ROOT / 'scripts/data/curriculum-alignment-sources.v1.json'
TOPIC_PAGES = ROOT / 'src/data/topic-pages'
OUT = ROOT / 'src/data/curriculum-alignment.v1.json'
GENERATED_AT = '2026-11-17'

# Project-relative inputs of --extract (curriculum-mapping project folder).
UNITS_REL = 'reports/curriculum-mapping-20261116/all-units.csv'
COVERAGE_REL = 'submissions/Claude/MANAGER-20261116/landing-plan/coverage.json'
VERIFY_REL = 'submissions/Claude/MANAGER-20261116/landing-plan/verify.json'

FRAMEWORK = {
    'name': 'תוכנית הלימודים במתמטיקה לחטיבת הביניים',
    'url': 'https://pop.education.gov.il/tchumey_daat/matmatika/chativat-beynayim/teaching-mathematics/tohnit-limudim/',
}
TRACK_GRADE = {'ז': 7, 'ח': 8, 'ט_רגילה': 9, 'ט_מצומצמת': 9}
TRACK_LABEL = {
    'ז': 'כיתה ז׳',
    'ח': 'כיתה ח׳',
    'ט_רגילה': 'כיתה ט׳ · תוכנית רגילה',
    'ט_מצומצמת': 'כיתה ט׳ · תוכנית מצומצמת',
}
TRACK_LAYOUT = {'ז': 'prisa_7.pdf', 'ח': 'prisa_8.pdf', 'ט_רגילה': 'prisa_9A.pdf', 'ט_מצומצמת': 'prisa_9B.pdf'}
ALIGNED = {'covered_by_landing': 'teaches', 'partial': 'educationalSubject'}
STATUSES = set(ALIGNED) | {'topic_exists_no_landing_copy', 'no_topic'}

# verify.json corrections. "status" downgrades a row; "exclude" drops one
# unit-page pair.
CORRECTIONS = [
    {'unit': 'st.g7.word_problems.modeling_linear', 'status': 'partial',
     'reason': 'verify.json coverage_errors[0]: no grade-7 landing covers משוואות מיוחדות'},
    {'unit': 'st.g7.word_problems.context_problems', 'status': 'partial',
     'reason': 'verify.json coverage_errors[0]: no grade-7 landing covers משוואות מיוחדות'},
    {'unit': 'st.g9r.square.def_properties_converse', 'status': 'partial',
     'reason': 'verify.json coverage_errors[1]: square-grade-9 states no converse theorem '
               '(re-checked at 118b4d90: the copy says to reason by the converse theorems but states none)'},
    {'unit': 'st.g9m.quad_partial.table_and_graph', 'status': 'partial',
     'reason': 'verify.json coverage_errors[2]: the copy never substitutes x values'},
    {'unit': 'st.g9m.quad_partial.table_and_graph', 'exclude': 'quadratic-function-grade-9',
     'reason': 'verify.json missed[4]: prisa_9B excludes quadratic-function properties for the reduced track'},
]

# Rows re-judged against the landing copy at headless/astro-poc-baseline
# 118b4d90, where the batch-02a landing drafts are merged. coverage.json
# named those drafts in pending_fix and judged the unmerged baseline.
# "pages" replaces the unit's page list; every "evidence" phrase must appear
# in that landing's copy (bidi isolates ignored).
REJUDGED_AT = 'headless/astro-poc-baseline 118b4d90 (batch 2a merged)'
REJUDGED = [
    {'unit': 'st.g7.coordinate_system.segments_shapes_q1', 'status': 'covered_by_landing',
     'pages': ['coordinate-plane-applications-grade-7', 'coordinate-plane-scale-grade-7'],
     'evidence': {'coordinate-plane-scale-grade-7': ['ומחשבים אורך של קטע המקביל לאחד הצירים',
                                                     'משלימים קודקוד חסר של מלבן, מחשבים שטח והיקף']},
     'reason': 'unchanged: the first-quadrant segments and rectangles section is now on the page'},
    {'unit': 'st.g7.directed_numbers.mul_div', 'status': 'covered_by_landing',
     'pages': ['multiplying-signed-numbers-grade-7', 'dividing-signed-numbers-grade-7',
               'order-of-operations-signed-numbers-grade-7'],
     'evidence': {'multiplying-signed-numbers-grade-7': ['מתרגלים גם מספר הופכי, חילוק באפס וסדר פעולות החשבון']},
     'reason': 'unchanged: the reciprocal, missing before, is now in the copy'},
    {'unit': 'st.g8.triangle_parts.triangle_inequality', 'status': 'covered_by_landing',
     'pages': ['triangle-median-grade-8'],
     'evidence': {'triangle-median-grade-8': ['בודקים אם שלושה אורכים יכולים ליצור משולש לפי אי־שוויון המשולש']},
     'reason': 'no_topic -> covered: the median page now has a triangle-inequality section'},
    {'unit': 'st.g8.triangle_parts.median', 'status': 'covered_by_landing',
     'pages': ['triangle-median-grade-8'],
     'evidence': {'triangle-median-grade-8': ['משווים היקפים ושטחים של שני המשולשים שהתיכון יוצר']},
     'reason': 'unchanged: the median-splits-area facet, missing before, is now in the copy'},
    {'unit': 'st.g8.triangle_parts.isosceles_converse', 'status': 'covered_by_landing',
     'pages': ['isosceles-triangle-properties-grade-8'],
     'evidence': {'isosceles-triangle-properties-grade-8': [
         'בחלק השני עוסקים במשפטים ההפוכים למשולש שווה־שוקיים',
         'מוכיחים שהמשולש שווה־שוקיים כשיש בו שתי זוויות שוות']},
     'reason': 'topic_exists_no_landing_copy -> covered on isosceles-triangle-properties-grade-8; '
               'isosceles-triangle-grade-8 still states no converse'},
    {'unit': 'st.g8.functions_intro.inc_dec_linear_graphs', 'status': 'partial',
     'pages': ['function-representations-grade-8', 'linear-function-grade-8'],
     'evidence': {'linear-function-grade-8': ['וקובעים אם הישר עולה, יורד או אופקי']},
     'reason': 'unchanged partial: rising, falling and horizontal lines are linear only; '
               'intervals of increase, decrease and constancy of a function are still one clause'},
    {'unit': 'st.g8.word_problems_eq.special_denominators', 'status': 'covered_by_landing',
     'pages': ['equations-with-fractions-grade-8'],
     'evidence': {'equations-with-fractions-grade-8': [
         'מזהים משוואות מיוחדות: משוואה שיש לה פתרון יחיד, משוואה שאין לה פתרון ומשוואה שיש לה אינסוף פתרונות']},
     'reason': 'partial -> covered: special equations are now in the copy'},
    {'unit': 'st.g9r.powers.power_of_product', 'status': 'covered_by_landing',
     'pages': ['exponent-rules-grade-9'],
     'evidence': {'exponent-rules-grade-9': ['חזקה של מכפלה, חזקה של מנה, חזקה של חזקה וחזקה עם מעריך אפס']},
     'reason': 'topic_exists_no_landing_copy -> covered'},
    {'unit': 'st.g9r.powers.power_of_quotient', 'status': 'covered_by_landing',
     'pages': ['exponent-rules-grade-9'],
     'evidence': {'exponent-rules-grade-9': ['חזקה של מכפלה, חזקה של מנה, חזקה של חזקה וחזקה עם מעריך אפס']},
     'reason': 'topic_exists_no_landing_copy -> covered'},
    {'unit': 'st.g9r.powers.zero_exponent', 'status': 'covered_by_landing',
     'pages': ['exponent-rules-grade-9'],
     'evidence': {'exponent-rules-grade-9': ['חזקה של מכפלה, חזקה של מנה, חזקה של חזקה וחזקה עם מעריך אפס']},
     'reason': 'topic_exists_no_landing_copy -> covered'},
    {'unit': 'st.g9r.powers.sqrt_laws', 'status': 'partial',
     'pages': ['square-roots-grade-9', 'exponent-rules-grade-9'],
     'evidence': {'exponent-rules-grade-9': ['אחר כך מפשטים שורשים לפי חוקי שורש ריבועי']},
     'reason': 'partial, exponent-rules-grade-9 added: it practises the square-root laws but, like '
               'square-roots-grade-9, does not state the product and quotient laws'},
    {'unit': 'st.g9r.word_problems.quadratic_geometric', 'status': 'partial',
     'pages': ['word-problems-grade-9'],
     'evidence': {'word-problems-grade-9': ['חלק מהמשוואות הן ממעלה שנייה']},
     'reason': 'unchanged partial: second-degree equations now appear in motion, percent and work '
               'problems, but no geometric problem is solved with one and no system of equations is named'},
    {'unit': 'st.g9r.word_problems.motion_percent_literacy', 'status': 'covered_by_landing',
     'pages': ['word-problems-grade-9'],
     'evidence': {'word-problems-grade-9': [
         'תנועה, אחוזים ואוריינות',
         'יש שאלות תנועה בהלוך ושוב, במפגש ובהשגה, שאלות אחוזים על עלייה, הנחה ושינוי חוזר באחוזים',
         'בכל רמה קוראים גם נתונים מטבלה']},
     'reason': 'topic_exists_no_landing_copy -> covered'},
    {'unit': 'st.g9r.isosceles_converse.theorems_and_coord', 'status': 'covered_by_landing',
     'pages': ['isosceles-triangle-grade-9'],
     'evidence': {'isosceles-triangle-grade-9': [
         'מוכיחים שמשולש הוא שווה־שוקיים לפי המשפטים ההפוכים',
         'בכל הרמות בודקים במערכת צירים משובצת אם משולש הוא שווה־שוקיים']},
     'reason': 'topic_exists_no_landing_copy -> covered, including the coordinate-plane check'},
    {'unit': 'st.g9m.word_problems.general_and_quadratic', 'status': 'covered_by_landing',
     'pages': ['word-problems-grade-9'],
     'evidence': {'word-problems-grade-9': ['חלק מהמשוואות הן ממעלה שנייה', 'בכל רמה קוראים גם נתונים מטבלה']},
     'reason': 'partial -> covered: quadratic and literacy questions are now in the copy'},
    {'unit': 'st.g9m.pythagoras.composite_areas_perim', 'status': 'covered_by_landing',
     'pages': ['pythagoras-applications-grade-9', 'composite-polygons-area-grade-9', 'pythagorean-theorem-grade-9'],
     'evidence': {'pythagorean-theorem-grade-9': ['בהמשך מפרקים צורות מורכבות', 'בכל רמה יש שאלות במערכת צירים']},
     'reason': 'unchanged, pythagorean-theorem-grade-9 added: it carries the reduced-track series'},
    {'unit': 'st.g9m.kite_and_isosceles.isosceles_converse', 'status': 'covered_by_landing',
     'pages': ['isosceles-triangle-grade-9'],
     'evidence': {'isosceles-triangle-grade-9': ['מוכיחים שמשולש הוא שווה־שוקיים לפי המשפטים ההפוכים']},
     'reason': 'partial -> covered: identifying an isosceles triangle by the converse is now in the copy'},
    {'unit': 'st.g9m.rhombus.area_pythagoras', 'status': 'partial',
     'pages': ['rhombus-grade-9'],
     'evidence': {'rhombus-grade-9': ['כדי לחשב אורכים, זוויות, היקף ושטח של מעוין']},
     'reason': 'topic_exists_no_landing_copy -> partial: area and perimeter are in the copy; '
               'half the product of the diagonals and Pythagoras are not stated'},
    {'unit': 'st.g9m.square.area_pythagoras', 'status': 'partial',
     'pages': ['square-grade-9'],
     'evidence': {'square-grade-9': ['כדי לחשב היקף, שטח, אורך אלכסון וזוויות']},
     'reason': 'unchanged partial: diagonal length is now in the copy; half the product of the '
               'diagonals and Pythagoras are still not stated'},
    {'unit': 'st.g9r.rhombus.converse_theorems', 'status': 'covered_by_landing',
     'pages': ['rhombus-grade-9'],
     'evidence': {'rhombus-grade-9': [
         'מרובע שכל ארבע צלעותיו שוות, או מקבילית שיש בה שתי צלעות סמוכות שוות, אלכסונים מאונכים או אלכסון שחוצה זווית']},
     'reason': 'verify.json coverage_errors[1] made this partial because rhombus-grade-9 stated no converse; '
               'the merged copy states them, so the coverage status (covered) stands'},
]

BIDI = re.compile('[⁦-⁩]')


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repo_path(path: Path) -> str:
    return f'{REPO_PREFIX}/{path.relative_to(ROOT).as_posix()}'


def dump_by_line(doc: dict, keyed: tuple) -> str:
    """Indented JSON with one line per entry of each `keyed` object, so the file stays small."""
    head = {k: v for k, v in doc.items() if k not in keyed}
    text = json.dumps(head, ensure_ascii=False, indent=2)[:-2]
    lines = [text + ',']
    for n, key in enumerate(keyed):
        items = list(doc[key].items())
        lines.append(f'  "{key}": {{')
        for i, (k, v) in enumerate(items):
            comma = ',' if i < len(items) - 1 else ''
            lines.append(f'    {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}{comma}')
        lines.append('  },' if n < len(keyed) - 1 else '  }')
    lines.append('}')
    out = '\n'.join(lines) + '\n'
    assert json.loads(out) == doc
    return out


def extract(project: Path) -> None:
    """Write scripts/data/curriculum-alignment-sources.v1.json from the project folder."""
    units_path, coverage_path, verify_path = (project / p for p in (UNITS_REL, COVERAGE_REL, VERIFY_REL))
    rows = list(csv.DictReader(units_path.open(encoding='utf-8-sig')))
    by_id = {r['יחידה']: r for r in rows}
    assert len(by_id) == len(rows) == 173, len(rows)
    coverage = json.loads(coverage_path.read_text(encoding='utf-8'))
    terms = coverage['terms']
    assert sorted(t['unit_id'] for t in terms) == sorted(by_id), 'coverage and CSV disagree'
    layouts = {d['file']: d for d in coverage['layout_source']['documents']}
    units = {}
    for term in terms:
        row = by_id[term['unit_id']]
        assert row['נושא'] == term['layout_term'], term['unit_id']
        assert row['מסלול'] == term['track'], term['unit_id']
        assert term['layout_source'].split()[0] == TRACK_LAYOUT[row['מסלול']], term['unit_id']
        draft = re.search(r'landing-drafts/([\w-]+)\.json', term.get('pending_fix') or '')
        units[term['unit_id']] = {
            'track': row['מסלול'],
            'name': row['נושא'],
            'layout': term['layout_source'],
            'status': term['status'],
            'pages': [p['slug'] for p in term['existing_pages']],
            'pendingFixDraft': draft.group(1) if draft else None,
        }
    doc = {
        'schema': 'noam-curriculum-alignment-sources/v1',
        'extractedAt': GENERATED_AT,
        'purpose': 'Input of scripts/build-curriculum-alignment.py: official layout units with their landing coverage.',
        'framework': FRAMEWORK,
        'officialLayouts': {
            track: {k: layouts[file][k] for k in ('file', 'url', 'sha256')} for track, file in TRACK_LAYOUT.items()
        },
        'upstream': {
            'all-units.csv': {'sha256': sha256(units_path), 'rows': len(rows),
                              'columns': {'id': 'יחידה', 'track': 'מסלול', 'name': 'נושא'}},
            'coverage.json': {'sha256': sha256(coverage_path),
                              'judgedAt': coverage['site_source']['commit'].split()[0],
                              'rule': 'pendingFixDraft names an unmerged landing draft that coverage.json expected to close the gap'},
            'verify.json': {'sha256': sha256(verify_path), 'use': 'CORRECTIONS in the generator'},
        },
        # Layout order (coverage.json term order): a page lists its units in this order.
        'units': units,
    }
    SOURCES.write_text(dump_by_line(doc, ('units',)), encoding='utf-8')
    print(json.dumps({'sources': repo_path(SOURCES), 'units': len(units),
                      'pendingFix': sum(1 for u in units.values() if u['pendingFixDraft'])}))


def routed_grades(path: str | None) -> dict:
    if path:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    code = ("import { TOPIC_PAGE_SLUGS, loadTopicPage } from './src/lib/topicPages.ts';"
            "process.stdout.write(JSON.stringify(Object.fromEntries("
            "TOPIC_PAGE_SLUGS.map((s) => [s, loadTopicPage(s).grade]))));")
    out = subprocess.run(['npx', 'tsx', '--eval', code], cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def landing_copy(slug: str) -> str:
    """Visible copy of a landing: every string in its data file except the JSON-LD."""
    parts = []

    def walk(value):
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, dict):
            for key, item in value.items():
                if key != 'jsonLd':
                    walk(item)

    walk(json.loads((TOPIC_PAGES / f'{slug}.json').read_text(encoding='utf-8')))
    return BIDI.sub('', '\n'.join(parts))


def build(routed: dict) -> tuple[str, dict]:
    sources = json.loads(SOURCES.read_text(encoding='utf-8'))
    units = sources['units']
    assert len(units) == 173, len(units)

    status_override = {c['unit']: c['status'] for c in CORRECTIONS if 'status' in c}
    excluded = {(c['unit'], c['exclude']) for c in CORRECTIONS if 'exclude' in c}
    rejudged = {r['unit']: r for r in REJUDGED}
    assert len(rejudged) == len(REJUDGED), 'a unit is re-judged twice'
    assert not set(rejudged) & set(status_override), 'a unit is both corrected and re-judged'
    pending = {u for u, row in units.items() if row['pendingFixDraft']}
    assert pending <= set(rejudged), f'pending_fix rows not re-judged: {sorted(pending - set(rejudged))}'
    for unit_id, r in rejudged.items():
        assert unit_id in units, unit_id
        assert r['status'] in STATUSES, unit_id
        assert set(r['evidence']) <= set(r['pages']) | {units[unit_id]['pendingFixDraft']}, unit_id
        for slug, phrases in r['evidence'].items():
            copy = landing_copy(slug)
            for phrase in phrases:
                assert phrase in copy, f'{unit_id}: "{phrase}" is not in {slug}'

    pages: dict[str, list[dict]] = {}
    used_units: dict[str, dict] = {}
    skipped_unrouted = []
    for unit_id, row in units.items():
        r = rejudged.get(unit_id)
        status = r['status'] if r else status_override.get(unit_id, row['status'])
        if status not in ALIGNED:
            continue
        for slug in (r['pages'] if r else row['pages']):
            if (unit_id, slug) in excluded:
                continue
            if slug not in routed:
                skipped_unrouted.append([unit_id, slug])
                continue
            assert routed[slug] == TRACK_GRADE[row['track']], (unit_id, slug, routed[slug])
            entries = pages.setdefault(slug, [])
            if any(e['unit'] == unit_id for e in entries):
                continue
            entries.append({'unit': unit_id, 'alignmentType': ALIGNED[status]})
            used_units[unit_id] = {'track': row['track'], 'name': row['name']}

    sources_ref = {'path': repo_path(SOURCES), 'sha256': sha256(SOURCES)}
    doc = {
        'schema': 'noam-curriculum-alignment/v1',
        'generatedAt': GENERATED_AT,
        'purpose': 'educationalAlignment on topic-page LearningResource JSON-LD (SEO-4).',
        'framework': FRAMEWORK,
        'source': {
            'generator': repo_path(Path(__file__).resolve()),
            'units': {
                **sources_ref,
                'rows': len(units),
                'officialLayouts': {t: d['url'] for t, d in sources['officialLayouts'].items()},
            },
            'pages': {
                **sources_ref,
                'rule': 'covered_by_landing -> teaches; partial -> educationalSubject; other statuses are not aligned',
            },
            'corrections': {
                'path': repo_path(Path(__file__).resolve()),
                'upstreamSha256': sources['upstream']['verify.json']['sha256'],
                'applied': CORRECTIONS,
            },
            'rejudged': {
                'path': repo_path(Path(__file__).resolve()),
                'against': REJUDGED_AT,
                'evidence': repo_path(TOPIC_PAGES),
                'applied': [{k: r[k] for k in ('unit', 'status', 'pages', 'reason')} for r in REJUDGED],
            },
        },
        'tracks': TRACK_LABEL,
        'units': dict(sorted(used_units.items())),
        'pages': dict(sorted(pages.items())),
    }
    stats = {
        'pages': len(pages),
        'units': len(used_units),
        'pairs': sum(len(v) for v in pages.values()),
        'teaches': sum(1 for v in pages.values() for e in v if e['alignmentType'] == 'teaches'),
        'educationalSubject': sum(1 for v in pages.values() for e in v if e['alignmentType'] == 'educationalSubject'),
        'skipped_unrouted': skipped_unrouted,
    }
    return dump_by_line(doc, ('units', 'pages')), stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true', help='exit 1 when the committed mapping differs')
    parser.add_argument('--routed', help='JSON {slug: grade} of routed topic pages')
    parser.add_argument('--extract', metavar='PROJECT_ROOT', help='rewrite the sources file from the project folder')
    args = parser.parse_args()
    if args.extract:
        extract(Path(args.extract))
        return
    text, stats = build(routed_grades(args.routed))
    if args.check:
        current = OUT.read_text(encoding='utf-8') if OUT.exists() else ''
        if current != text:
            print(f'{repo_path(OUT)} is stale: run python3 scripts/build-curriculum-alignment.py', file=sys.stderr)
            sys.exit(1)
        print(json.dumps({'check': 'ok', **stats}, ensure_ascii=False))
        return
    OUT.write_text(text, encoding='utf-8')
    print(json.dumps({**stats, 'bytes': OUT.stat().st_size}, ensure_ascii=False))


if __name__ == '__main__':
    main()
