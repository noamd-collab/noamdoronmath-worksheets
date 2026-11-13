"""Narrow pilot quality rules, additional to the unchanged exact math checks.

These thresholds are an explicit engineering policy, not a complete automated
pedagogical assessment or a purported numerical rule from the installed skill.
No repair, reordering, clamping, randomization or provider retry happens here.
"""
from collections import Counter
from validation import reject
from distractors import plan_distractors

POLICY = 'pilot-didactic-quality/2'
MIN_PATTERN_ITEMS = 24
MIN_REPETITIONS = 3


def period_fit(values, max_edits=0):
    """Smallest cycle explaining the whole sequence, with at least 3 repeats.

    A phase-wise majority gives the exact minimum number of differing values;
    it does not edit, shuffle or infer answers in the submitted worksheet.
    """
    if len(values) < MIN_PATTERN_ITEMS:
        return None
    for period in range(1, len(values)//MIN_REPETITIONS+1):
        edits = sum(len(phase)-Counter(phase).most_common(1)[0][1]
                    for phase in (values[offset::period] for offset in range(period)))
        if edits <= max_edits:
            return {'period':period, 'edits':edits}
    return None


def repeating_period(values):
    fit = period_fit(values)
    return fit['period'] if fit else None


def unit_step_edit_distance(values, budget):
    """Minimum value changes needed for >=90% adjacent +/-1 steps, or None.

    Dynamic programming keeps the number of irregular transitions for each
    last value/edit count. A few isolated edits cannot disguise a full-sheet
    answer progression. Candidate values need only extend the observed range
    by the edit budget; longer excursions cannot rejoin unchanged endpoints.
    """
    if len(values) < MIN_PATTERN_ITEMS:
        return None
    allowed_breaks=(len(values)-1)//10
    candidates=range(min(values)-budget,max(values)+budget+1)
    states={(value,int(value!=values[0])):0 for value in candidates}
    for observed in values[1:]:
        best={edits:min(cost for (value,e),cost in states.items() if e==edits)
              for edits in {e for value,e in states}}
        following={}
        for value in candidates:
            changed=int(value!=observed)
            for edits,breaks in best.items():
                if edits+changed > budget:
                    continue
                cost=min(breaks+1,states.get((value-1,edits),allowed_breaks+1),
                         states.get((value+1,edits),allowed_breaks+1))
                if cost <= allowed_breaks:
                    following[(value,edits+changed)]=cost
        states=following
        if not states:return None
    return min(edits for value,edits in states)


def numerical_pattern(payload):
    items = [item for question in payload['questions'] for item in question['items']]
    a, x = ([item[key] for item in items] for key in ('a','solution'))
    pairs = len(items)-1
    ap, xp = repeating_period(a), repeating_period(x)
    a_steps = sum(abs(v-u)==1 for u,v in zip(a,a[1:]))
    x_steps = sum(abs(v-u)==1 for u,v in zip(x,x[1:]))
    budget=len(items)//20  # at most 5% exceptions; 3 for the 60-item pilot
    near_cycle=period_fit(x,budget)
    step_edits=unit_step_edit_distance(x,budget)
    # A fixed coefficient is legitimate focused practice. Predictability of
    # the answer sequence is measured independently; a constant answer is
    # handled by the separate concentration rule below.
    predictable_cycle=near_cycle is not None and near_cycle['period']>1
    return {'items':len(items), 'adjacentPairs':pairs, 'coefficientPeriod':ap,
            'solutionPeriod':xp, 'coefficientUnitSteps':a_steps,
            'solutionUnitSteps':x_steps, 'maximumChangedValues':budget,
            'nearSolutionCycle':near_cycle, 'solutionUnitStepEdits':step_edits,
            'strongRepeatedPattern':len(items)>=MIN_PATTERN_ITEMS and
                (predictable_cycle or step_edits is not None)}


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


def division_order(payload):
    """Detect an ordered fact table, including a few changed entries.

    A single taught divisor and short graduated warm-ups remain legitimate.
    The two rank bases describe tables with quotients 1..10 or 0..10. At least
    90% of positions must fit one consecutive table, with two actual divisors
    among the fitting positions. This is stricter than merely being sorted.
    No requirement is made to use every teacher-allowed divisor.
    """
    from itertools import groupby
    facts=[(item['right'],item['answer']) for q in payload['questions'] for item in q['items']]
    divisors=[d for d,q in facts]
    ordered=all(a<=b for a,b in zip(divisors,divisors[1:])) or all(a>=b for a,b in zip(divisors,divisors[1:]))
    blocks=[[q for d,q in group] for divisor,group in groupby(facts,key=lambda pair:pair[0])]
    consecutive=bool(blocks) and all(len(block)>=2 and
        (all(b-a==1 for a,b in zip(block,block[1:])) or
         all(b-a==-1 for a,b in zip(block,block[1:]))) for block in blocks)
    dominant=None
    for width in (10,11):
        for direction in (1,-1):
            offsets=[d*width+q-direction*i for i,(d,q) in enumerate(facts)]
            for offset,count in Counter(offsets).items():
                matched_divisors={d for (d,q),value in zip(facts,offsets) if value==offset}
                if len(matched_divisors)>1 and (dominant is None or count>dominant['matchingItems']):
                    dominant={'rankWidth':width,'direction':direction,'intercept':offset,'matchingItems':count,
                              'matchingDivisors':len(matched_divisors)}
    near_table=dominant is not None and 10*dominant['matchingItems']>=9*len(facts)
    return {'items':len(facts),'distinctDivisors':len(set(divisors)),
            'orderedDivisorBlocks':ordered,'consecutiveQuotientsInEveryBlock':consecutive,
            'dominantConsecutiveTable':dominant,
            'sortedFactTable':len(facts)>=MIN_PATTERN_ITEMS and len(set(divisors))>1 and
                ((ordered and consecutive) or near_table)}


def missing_divisor_variety(lesson,payload):
    allowed=(lesson.get('lessonBoundary') or {}).get('allowedDivisors')
    # Legacy offline inputs have the original full divisor domain. New jobs
    # always carry an explicitly validated lesson boundary.
    multiple=allowed is None or len(allowed)>1
    uniform=[i+1 for i,q in enumerate(payload['questions']) if q['kind']=='missing_right'
             and len(q['items'])>=3 and len({v['right'] for v in q['items']})==1]
    return {'multipleDivisorsAllowed':multiple,'uniformMissingDivisorQuestions':uniform,
            'degenerateQuestion':multiple and bool(uniform)}


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
    order = division_order(payload) if cap['family'] != 'linear_equation' else None
    if order and order['sortedFactTable']:
        reject('AUTHOR_DIVISION_ORDER', 'Mix verified facts instead of enumerating a sorted fact table')
    missing = missing_divisor_variety(lesson,payload) if cap['family'] != 'linear_equation' else None
    if missing and missing['degenerateQuestion']:
        reject('AUTHOR_MISSING_DIVISOR_CONSTANT', 'Use varied missing divisors when the taught domain allows them')
    plan = plan_distractors(lesson,payload,cap)
    quality = {'policy':POLICY, 'passed':True, 'numericPattern':pattern,
               'answerConcentration':concentration, 'divisionTemplate':division,
               'divisionOrder':order, 'missingDivisorVariety':missing,
               'mistakeFamilies':len({v['family'] for v in plan.values()}),
               'mistakeDeltas':len({v['delta'] for v in plan.values()})}
    return quality, plan
