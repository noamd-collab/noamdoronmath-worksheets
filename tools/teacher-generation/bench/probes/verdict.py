"""Judge what the engine printed for a probe. Independent of the engine on purpose.

The engine reports either a rejection or the pupil text and the key that its
adapter printed. This module turns that into one of three outcomes:

* `rejected` with the engine's code;
* `pass`;
* `wrong_print` with flags, when the print breaks the sheet's invariant: a
  wrong key, an answer next to its question, or an exercise the pupil should
  not be shown.

Two sources of judgement, both mechanical:

1. `expect` on the probe, written by hand: the numbers a correct key carries
   (`key`), text it must or must not contain (`keyContains`, `keyExcludes`).
2. Rules over the numbers in the source prompt, the printed text and the key.
   They compare numerals only and know nothing about the engine's grammar.
   A bare instruction followed by its exercise ("solve." then the equation)
   is the intended print and is not flagged.

The rules are deliberately simple. A probe they misjudge should get an
`expect` entry rather than a cleverer rule.
"""
from __future__ import annotations

from collections import Counter
from decimal import Decimal, InvalidOperation
import re

NUMBER = re.compile(r'(?<![\w.])[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?')
RELATION = re.compile(r'[<>=≤≥≠]|\\(?:leq|geq|neq)\b')
BLANK = re.compile(r'_{2,}')
ISLAND = re.compile(r'\[\[[^\[\]]*\]\]')
HEBREW_WORD = re.compile(r'[\u05d0-\u05ea][\u05b0-\u05c7\u05d0-\u05ea״׳]*')
STORY_WORDS = 6
FLAGS = {
    'key_mismatch': "the key is not the answer written in the probe's expectation",
    'answer_beside_question': 'the answer is printed next to the question',
    'print_adds_numbers': ('the pupil text carries numbers the prompt did not: the exercise is printed again, '
                           'revealed after a story or a table, or rewritten'),
    'one_key_for_several_blanks': 'several blanks to fill, fewer values in the key',
    'key_repeats_question': 'the key only repeats the number that was asked about',
}


def numbers(text):
    """Numerals of a text as canonical strings: 45,238 -> 45238, 12.50 -> 12.5."""
    found = []
    for raw in NUMBER.findall(text or ''):
        try:
            value = Decimal(raw.replace(',', ''))
        except InvalidOperation:
            continue
        found.append(format(value.normalize(), 'f'))
    return found


def canonical(values):
    return numbers(' '.join(str(v) for v in values))


def scalar(key):
    """A key that is only a value: no letters, relation or operation left to read."""
    text = re.sub(r'\\[A-Za-z]+', '', key)
    return not (re.search(r'[A-Za-z]', text) or RELATION.search(key) or re.search(r'[+*/^·×:]', text))


def item_flags(prompt, printed, key, expect, context=False):
    """Flags for one printed item, with a short note for a mismatch.

    `context` says the question shows data outside this prompt (numbers in the
    intro, a table or a figure).
    """
    flags, notes = [], []
    given, shown, answer = numbers(prompt), numbers(printed), numbers(key)
    extra = Counter(shown) - Counter(given)
    value = scalar(key)
    blanks = len(BLANK.findall(prompt))
    story = len(HEBREW_WORD.findall(ISLAND.sub(' ', prompt))) >= STORY_WORDS
    if expect:
        if 'key' in expect and answer != canonical(expect['key']):
            flags.append('key_mismatch')
            notes.append(f"key numbers {answer} != expected {canonical(expect['key'])}")
        missing = [part for part in expect.get('keyContains', []) if part not in key]
        present = [part for part in expect.get('keyExcludes', []) if part in key]
        if missing or present:
            if 'key_mismatch' not in flags:
                flags.append('key_mismatch')
            notes += [f'key lacks {part!r}' for part in missing] + [f'key contains {part!r}' for part in present]
    if extra:
        if answer and value and extra == Counter(answer):
            flags.append('answer_beside_question')
        elif given or context or story:
            # A bare instruction ("solve.") followed by its exercise is the intended print.
            flags.append('print_adds_numbers')
    elif answer and value and Counter(answer) == Counter(given):
        flags.append('key_repeats_question')
    if blanks >= 2 and len(answer) < blanks and not (expect and 'key' in expect):
        flags.append('one_key_for_several_blanks')
    return flags, notes


def judge(probe, raw):
    """The recorded outcome of one probe: small, stable and readable in a diff."""
    if raw['stage'] != 'printed':
        return {'outcome': 'rejected', 'stage': raw['stage'], 'code': raw['code']}
    prompts = [row[0] for row in probe['items']] if 'items' in probe else [probe['prompt']]
    context = bool(numbers(probe.get('intro', ''))) or 'table' in probe or 'figure' in probe
    flags, notes, items = [], [], []
    for prompt, row in zip(prompts, raw['items']):
        found, why = item_flags(prompt, row['printed'], row['key'], probe.get('expect'), context)
        flags += [flag for flag in found if flag not in flags]
        notes += [note for note in why if note not in notes]
        items.append({'printed': row['printed'], 'key': row['key']})
    outcome = {'outcome': 'wrong_print' if flags else 'pass'}
    if flags:
        outcome['flags'] = flags
    if notes:
        outcome['notes'] = notes
    if any(row.get('unverified') for row in raw['items']):
        # A middle-school prose answer: printed as written, not checked by the kernel.
        outcome['unverified'] = True
    outcome.update(items[0] if len(items) == 1 else {'items': items})
    return outcome


def short(outcome):
    if outcome['outcome'] == 'rejected':
        return f"rejected {outcome['code']}"
    key = outcome.get('key', outcome.get('items', [{}])[0].get('key', ''))
    if outcome['outcome'] == 'wrong_print':
        return 'wrong print (' + ', '.join(outcome['flags']) + f') key «{key}»'
    return f"pass key «{key}»" + (' (unverified prose)' if outcome.get('unverified') else '')


def long(outcome):
    if outcome['outcome'] == 'rejected':
        return f"rejected at {outcome['stage']}: {outcome['code']}"
    rows = outcome.get('items') or [{'printed': outcome['printed'], 'key': outcome['key']}]
    head = 'WRONG PRINT ' + ', '.join(outcome['flags']) if outcome['outcome'] == 'wrong_print' else 'pass'
    if outcome.get('notes'):
        head += ' — ' + '; '.join(outcome['notes'])
    if outcome.get('unverified'):
        head += ' (unverified prose)'
    return head + ''.join(f"\n    pupil: {row['printed']}\n    key:   {row['key']}" for row in rows)
