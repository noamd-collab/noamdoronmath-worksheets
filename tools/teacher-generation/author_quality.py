"""Narrow pilot quality rules, additional to the unchanged exact math checks.

These thresholds are an explicit engineering policy, not a complete automated
pedagogical assessment or a purported numerical rule from the installed skill.
No repair, reordering, clamping, randomization or provider retry happens here.
"""
from collections import Counter
from validation import reject
from distractors import plan_distractors

POLICY = 'pilot-didactic-quality/1'
MIN_PATTERN_ITEMS = 24
MAX_PERIOD = 12
MIN_REPETITIONS = 3


def repeating_period(values):
    if len(values) < MIN_PATTERN_ITEMS:
        return None
    for period in range(1, min(MAX_PERIOD, len(values)//MIN_REPETITIONS)+1):
        if all(value == values[i % period] for i,value in enumerate(values)):
            return period
    return None


def numerical_pattern(payload):
    items = [item for question in payload['questions'] for item in question['items']]
    a, x = ([item[key] for item in items] for key in ('a','solution'))
    pairs = len(items)-1
    ap, xp = repeating_period(a), repeating_period(x)
    a_steps = sum(abs(v-u)==1 for u,v in zip(a,a[1:]))
    x_steps = sum(abs(v-u)==1 for u,v in zip(x,x[1:]))
    a_regular = ap is not None or 10*a_steps >= 9*pairs
    x_regular = xp is not None or 10*x_steps >= 9*pairs
    return {'items':len(items), 'adjacentPairs':pairs, 'coefficientPeriod':ap,
            'solutionPeriod':xp, 'coefficientUnitSteps':a_steps,
            'solutionUnitSteps':x_steps,
            'strongRepeatedPattern':len(items)>=MIN_PATTERN_ITEMS and a_regular and x_regular}


def answer_concentration(payload, cap):
    """Measure equation roots, or the requested answer for arithmetic tasks.

    Equation roots include construct questions: otherwise changing the requested
    unknown to c could hide a sheet of sixty equations all solved by x=0.
    """
    values = []
    for question in payload['questions']:
        for item in question['items']:
            if cap['family'] == 'linear_equation':
                key = 'solution'
            else:
                key = {'missing_operand':'left','missing_right':'right'}.get(question['kind'],'answer')
            values.append(item[key])
    largest = max(Counter(values).values(), default=0)
    return {'items':len(values), 'largestAnswerCount':largest,
            'basis':'equation_solution' if cap['family']=='linear_equation' else 'requested_arithmetic_answer',
            'dominantAnswer':len(values)>=MIN_PATTERN_ITEMS and 10*largest>=9*len(values)}


def division_template(payload):
    """Reject only the complete repeated-three-divisors/uniform-quotient grid.

    The same three teacher-selected divisors alone remain legitimate. This
    narrow rule does not infer whether every repeated fact is pedagogically bad.
    """
    rows = [question['items'] for question in payload['questions']]
    triples = [tuple(item['right'] for item in row) for row in rows]
    fixed = bool(rows) and all(len(row)==3 for row in rows) and len(set(triples))==1
    uniform = bool(rows) and all(len({item['answer'] for item in row})==1 for row in rows)
    count = sum(map(len,rows))
    return {'items':count, 'fixedDivisorTriple':fixed,
            'uniformQuotientWithinEveryQuestion':uniform,
            'strongRepeatedTemplate':count>=MIN_PATTERN_ITEMS and fixed and uniform}


def prepare_didactics(lesson, payload, cap):
    """Call after canonical validation; return bounded stats and private plan."""
    first = payload['questions'][0]['items'][:3]
    if cap['family'] == 'linear_equation':
        copied = [(v['a'],v['solution']) for v in first] == [(2,4),(3,5),(4,6)]
        pattern = numerical_pattern(payload)
    else:
        copied = [(v['right'],v['answer']) for v in first] == [(3,4),(5,6),(7,8)]
        pattern = None
    if copied:
        reject('AUTHOR_EXAMPLE_COPY', 'Choose a new first question instead of the reserved demonstration')
    if pattern and pattern['strongRepeatedPattern']:
        reject('AUTHOR_NUMERIC_PATTERN', 'Choose varied parameters instead of a long predictable numeric pattern')
    concentration = answer_concentration(payload,cap)
    if concentration['dominantAnswer']:
        reject('AUTHOR_ANSWER_CONCENTRATION', 'Choose varied answers instead of one dominant answer')
    division = division_template(payload) if cap['family'] != 'linear_equation' else None
    if division and division['strongRepeatedTemplate']:
        reject('AUTHOR_DIVISION_TEMPLATE', 'Vary quotient combinations instead of repeating the entire divisor grid')
    plan = plan_distractors(lesson,payload,cap)
    quality = {'policy':POLICY, 'passed':True, 'numericPattern':pattern,
               'answerConcentration':concentration, 'divisionTemplate':division,
               'mistakeFamilies':len({v['family'] for v in plan.values()}),
               'mistakeDeltas':len({v['delta'] for v in plan.values()})}
    return quality, plan
