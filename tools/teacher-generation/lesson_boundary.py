"""Explicit teaching limits, independent of model prose or author instructions."""
from fractions import Fraction

MISSING_DIVISOR_QUESTIONS = 3  # Fixed grade-3 pilot task plan.
MINIMUM_QUESTION_ITEMS = 3


def _reject(code, detail):
    # validation imports this module; keep the error class single without a cycle.
    from validation import reject
    reject(code, detail)


def validated_boundary(lesson, *, allow_legacy=False):
    if not isinstance(lesson, dict):
        _reject('INVALID_LESSON', 'Expected a lesson object')
    version = lesson.get('version')
    if type(version) is int and version == 1 and allow_legacy:
        if 'lessonBoundary' in lesson:
            _reject('INVALID_LESSON_BOUNDARY', 'Legacy intake cannot carry an ignored boundary')
        return None
    if type(version) is not int or version != 2:
        _reject('LESSON_VERSION_REQUIRES_NEW_DRAFT', 'Create a new draft with explicit teaching limits')
    value = lesson.get('lessonBoundary')
    if not isinstance(value, dict) or type(value.get('version')) is not int or value['version'] != 1:
        _reject('INVALID_LESSON_BOUNDARY', 'Expected teaching boundary version 1')
    topic = (lesson.get('gradeNumber'), lesson.get('topicId'))
    if topic == (3, 'ג10'):
        if set(value) != {'version', 'kind', 'allowedDivisors', 'maxDividend'} or value.get('kind') != 'division_facts':
            _reject('INVALID_LESSON_BOUNDARY', 'Expected division-facts teaching limits')
        divisors, maximum = value['allowedDivisors'], value['maxDividend']
        if (not isinstance(divisors, list) or not 1 <= len(divisors) <= 10
                or any(type(d) is not int or not 1 <= d <= 10 for d in divisors)
                or len(set(divisors)) != len(divisors)
                or type(maximum) is not int or not 10 <= maximum <= 100):
            _reject('INVALID_LESSON_BOUNDARY', 'Invalid allowed divisors or maximum dividend')
        # The fixed pilot has 3 missing-divisor questions with >=3 parts each.
        # Zero quotients cannot produce a uniquely solvable missing divisor.
        capacities = [min(10, maximum // d) for d in divisors]
        total = sum(capacities)
        if total < MISSING_DIVISOR_QUESTIONS * MINIMUM_QUESTION_ITEMS:
            _reject('BOUNDARY_TOO_NARROW', 'Teaching limits cannot supply nine distinct positive division facts')
        # Each mixed row needs a fact outside the most frequent divisor.
        # Distinct facts cannot be reused across the three missing_right rows.
        # A selected single divisor is intentionally exempt from row variety.
        if len(divisors) > 1 and total - max(capacities) < MISSING_DIVISOR_QUESTIONS:
            _reject('BOUNDARY_TOO_NARROW', 'Teaching limits cannot supply three mixed-divisor questions with distinct facts')
    elif topic == (7, 'g7:equations'):
        if (set(value) != {'version', 'kind', 'allowSignedNumbers'}
                or value.get('kind') != 'linear_equations'
                or type(value.get('allowSignedNumbers')) is not bool):
            _reject('INVALID_LESSON_BOUNDARY', 'Expected explicit signed-number choice')
    else:
        _reject('UNSUPPORTED_LESSON_BOUNDARY', 'Teaching limits are implemented for the two pilot topics only')
    return value


def validate_render_values(lesson, values, where='rendered values'):
    """Gate trusted derived distractors/answer/challenge numbers before markup.

    Canonical item constraints are checked separately. maxDividend bounds the
    dividend, not a distractor or a multiplication factor. v1 is only reachable
    through the caller's explicit offline-legacy validation.
    """
    boundary = validated_boundary(lesson, allow_legacy=lesson.get('version') == 1)
    for value in values:
        if type(value) is not int and not isinstance(value, Fraction):
            _reject('INVALID_RENDER_VALUE', 'Expected an exact rendered number')
        if (boundary and value < 0 and (boundary['kind'] == 'division_facts'
                or not boundary['allowSignedNumbers'])):
            _reject('OUTSIDE_LESSON_BOUNDARY', 'Negative derived value outside the selected teaching limits')


def validate_boundary_item(boundary, item):
    if boundary is None:
        return
    if boundary['kind'] == 'division_facts':
        if item['right'] not in boundary['allowedDivisors'] or item['left'] > boundary['maxDividend']:
            _reject('OUTSIDE_LESSON_BOUNDARY', 'Division fact exceeds the selected teaching limits')
    elif not boundary['allowSignedNumbers']:
        if any(item[k] < 0 for k in ('a', 'b', 'c', 'solution')):
            _reject('OUTSIDE_LESSON_BOUNDARY', 'Signed equation outside the selected teaching limits')
