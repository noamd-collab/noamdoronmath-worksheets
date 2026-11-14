"""Trusted, reproducible mistakes; never change an authored correct exercise.

Candidates model a named wrong operation and are independently substituted
before selection. The private evidence explains each choice; no model prose
or executable content enters the worksheet.
"""
from collections import Counter
from validation import reject


def candidates(item, family, *, allow_signed=True):
    proposed = []
    if family == 'arithmetic':
        left, right, correct = item['left'], item['right'], item['answer']
        if item['op'] != 'divide' or right <= 0 or left != right * correct:
            reject('DIDACTIC_INPUT_INVALID', 'A verified division fact is required')
        rows = [
            ('divisor_as_quotient', right, 'בלבול בין המחלק למנה'),
            ('single_subtraction', left-right, 'חיסור המחלק פעם אחת במקום ספירת כל הקבוצות'),
            ('dividend_as_quotient', left, 'העתקת המחולק בלי לבצע חילוק'),
            ('one_group_too_many', correct+1, 'ספירת קבוצה אחת יותר מדי'),
            ('one_group_too_few', correct-1, 'ספירת קבוצה אחת פחות מדי'),
        ]
        low, high = 0, 100
        is_wrong = lambda value: value * right != left
    elif family == 'linear_equation':
        a, b, c, correct = (item[k] for k in ('a','b','c','solution'))
        if a <= 0 or a*correct+b != c:
            reject('DIDACTIC_INPUT_INVALID', 'A verified first-degree equation is required')
        rows = [
            ('omitted_division', c-b, 'השמטת החלוקה במקדם אחרי בידוד האיבר עם המשתנה'),
            ('subtract_coefficient', c-b-a, 'חיסור המקדם במקום חלוקה בו'),
            ('add_coefficient', c-b+a, 'חיבור המקדם במקום חלוקה בו'),
        ]
        if (c+b) % a == 0:
            rows.append(('inverse_sign', (c+b)//a, 'שימוש בסימן שגוי בעת ביטול האיבר החופשי'))
        if c % a == 0:
            rows.append(('ignored_constant', c//a, 'חלוקת אגף ימין במקדם בלי לבטל את האיבר החופשי'))
        if allow_signed:
            rows.append(('solution_sign', -correct, 'החלפת סימן הפתרון'))
        low, high = (-250 if allow_signed else 0), 250
        is_wrong = lambda value: a*value+b != c
    else:
        reject('DIDACTIC_INPUT_INVALID', 'No reviewed mistake families for this topic')
    seen = set()
    for name, value, explanation in rows:
        if (type(value) is int and low <= value <= high and value != correct
                and is_wrong(value) and value not in seen):
            seen.add(value)
            proposed.append({'family':name, 'proposed':value, 'correct':correct,
                             'delta':value-correct, 'mistake':explanation})
    return proposed


def plan_distractors(lesson, payload, cap):
    """Select across the full sheet without shuffling exercises or answers."""
    boundary = lesson.get('lessonBoundary') or {}
    allow_signed = boundary.get('allowSignedNumbers', True)
    family_use, delta_use = Counter(), Counter()
    result = {}
    previous_delta = None
    for qi, question in enumerate(payload['questions']):
        if question['kind'] != 'check_solution':
            continue
        for ii, item in enumerate(question['items']):
            options = candidates(item, cap['family'], allow_signed=allow_signed)
            if not options:
                reject('AUTHOR_DISTRACTOR_VARIETY', 'Choose parameters permitting varied verified mistake families')
            chosen = min(enumerate(options), key=lambda pair: (
                family_use[pair[1]['family']], delta_use[pair[1]['delta']],
                pair[1]['delta'] == previous_delta, pair[0]))[1]
            result[(qi,ii)] = dict(chosen, question=qi+1, part=ii+1)
            family_use[chosen['family']] += 1
            delta_use[chosen['delta']] += 1
            previous_delta = chosen['delta']
    if len(result) >= 6 and (len(family_use) < 3 or len(delta_use) < 3):
        reject('AUTHOR_DISTRACTOR_VARIETY', 'Choose parameters permitting varied verified mistake families')
    return result
