"""One short reply example per grade band for a provider without a strict schema.

A json_object reply is not constrained by the wire schema, so the request
carries one valid question in the compact notation the compiler reads.
tests/test_provider_selection.py proves each example through
compact_authoring.expand_source and general_source validation for every
grade of its band. The Hebrew strings are sample pupil text for the model;
they are never printed on a sheet.
"""
from copy import deepcopy

PURPOSE = ('One valid question in the required notation. It shows format only: '
           'write new content for the selected topic and never reuse these numbers, words or tasks.')


def _evaluate(expression, unit=''):
    return {'kind': 'computed', 'task': {'kind': 'evaluate', 'expression': expression}, 'unit': unit}


# Grades one and two: full niqqud in every Hebrew field and five subitems.
LOWER = {'intro': 'חַשְּׁבוּ וְכִתְבוּ אֶת הַתּוֹצָאָה.', 'items': [
    {'prompt': 'חַשְּׁבוּ: [[3 + 4]]', 'answer': _evaluate('3 + 4')},
    {'prompt': 'חַשְּׁבוּ: [[8 - 5]]', 'answer': _evaluate('8 - 5')},
    {'prompt': 'הַשְׁלִימוּ אֶת הַמִּסְפָּר הֶחָסֵר: [[___ + 2 = 9]]', 'answer': _evaluate('9 - 2')},
    {'prompt': 'לְדָנָה [[5]] בָּלוֹנִים וּלְיוֹסִי [[4]] בָּלוֹנִים. כַּמָּה בָּלוֹנִים יֵשׁ לִשְׁנֵיהֶם יַחַד?',
     'answer': _evaluate('5 + 4', 'בָּלוֹנִים')},
    {'prompt': 'חַשְּׁבוּ: [[10 - 6]]', 'answer': _evaluate('10 - 6')},
]}

# Grades three to six: unvocalized Hebrew, numbers only, a blank inside one formula.
UPPER = {'intro': 'חשבו וכתבו את התוצאה.', 'items': [
    {'prompt': 'חשבו: [[36 + 48]]', 'answer': _evaluate('36 + 48')},
    {'prompt': 'השלימו את המספר החסר: [[___ + 25 = 60]]', 'answer': _evaluate('60 - 25')},
    {'prompt': 'בכל שקית יש [[6]] תפוחים. כמה תפוחים יש בסך הכול בתוך [[4]] שקיות?',
     'answer': _evaluate('4 * 6', 'תפוחים')},
]}

# Grades seven to nine: a printed equation with a solve task, and a review answer.
MIDDLE = {'intro': 'פתרו וחשבו. כתבו את דרך הפתרון.', 'items': [
    {'prompt': 'פתרו את המשוואה [[2*x + 3 = 11]].',
     'answer': {'kind': 'computed', 'task': {'kind': 'solve', 'lhs': '2*x + 3', 'rhs': '11', 'variable': 'x'},
                'unit': ''}},
    {'prompt': 'חשבו: [[(15 - 3) / 4]]', 'answer': _evaluate('(15 - 3) / 4')},
    {'prompt': 'הסבירו מדוע [[x = 4]] הוא פתרון של המשוואה [[x + 5 = 9]].',
     'answer': {'kind': 'review',
                'text': 'מציבים [[4]] במקום [[x]] ומקבלים [[4 + 5 = 9]], ולכן השוויון מתקיים.'}},
]}

BANDS = ((2, LOWER), (6, UPPER), (9, MIDDLE))


def example_question(grade):
    """A fresh copy of the band's question in wire form (no star, no numbering)."""
    for last, question in BANDS:
        if grade <= last:
            return deepcopy(question)
    raise ValueError('No reply example for this grade')


def reply_example(grade):
    return {'purpose': PURPOSE, 'question': example_question(grade)}
