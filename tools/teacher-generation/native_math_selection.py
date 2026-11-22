"""Verified mathematical options for the six exact native lesson contracts.

The wire response refers only to visible problem data. The persisted source is
the existing, validated deterministic format understood by the print worker.
"""
from dataclasses import dataclass
from math import lcm
import secrets

import counting_lesson
import division_facts
import fraction_lesson
import pythagoras_lesson
import square_lesson
import triangle_lesson
from general_source import GeneralSourceError

CONTRACT = "teacher-math-selection/1"
AUTHORS = (counting_lesson, division_facts, fraction_lesson,
           pythagoras_lesson, square_lesson, triangle_lesson)
GEOMETRY = (pythagoras_lesson, square_lesson, triangle_lesson)


@dataclass
class Menu:
    author: object
    public: dict
    # Maps the public choice in each position to a replayable native parameter.
    slots: list

    def schema(self):
        choices = {'type': 'array', 'minItems': len(self.slots), 'maxItems': len(self.slots),
                   'items': {'type': 'integer', 'minimum': 1, 'maximum': max(map(len, self.slots))}}
        return {'type': 'object', 'additionalProperties': False, 'required': ['version', 'choices'],
                'properties': {'version': {'type': 'string', 'const': CONTRACT}, 'choices': choices}}

    def resolve(self, lesson, response):
        ids = response.get('choices')
        if (set(response) != {'version', 'choices'} or response['version'] != CONTRACT
                or type(ids) is not list or len(ids) != len(self.slots)
                or any(type(i) is not int or not 1 <= i <= len(slot) for i, slot in zip(ids, self.slots))):
            raise GeneralSourceError('AUTHOR_PLAN_MISMATCH', 'Choose one offered mathematical option in each position')
        values = [slot[i - 1] for i, slot in zip(ids, self.slots)]
        if self.author in GEOMETRY:
            source = {'version': self.author.VERSION, 'choices': values}
            # Cross-question constraints must hold after combining selected rows.
            try:
                self.author.build(lesson, source)
            except ValueError as exc:
                raise GeneralSourceError('AUTHOR_PLAN_MISMATCH', 'Chosen geometry rows do not combine into a valid worksheet') from exc
        else:
            source = {'version': self.author.VERSION, 'seed': values[0]}
        return source


def geometry_menu(lesson, author):
    count = lesson['questionCount']
    public = [[] for _ in range(count)]
    slots = [[] for _ in range(count)]
    minimum = 0 if author is pythagoras_lesson else 1
    for value in range(minimum, minimum + 4):
        try:
            _, questions, evidence = author.build(lesson, {'version': author.VERSION, 'choices': [value] * count})
        except ValueError:
            # A repeated-givens or geometry check excludes this candidate from the offer.
            continue
        for i, (question, facts) in enumerate(zip(questions, evidence)):
            candidate = {'givens': question['intro'], 'tasks': [item['text'] for item in question['items']]}
            # Several verbal constructions show their actual measurements only in the diagram.
            keys = ['printedLengths', 'givens']
            if (question.get('figure') or {}).get('family') in ('grid', 'coordinate'):
                keys.append('vertices')
            for key in keys:
                if facts.get(key):
                    candidate[key] = facts[key]
            if candidate not in public[i]:
                public[i].append(candidate)
                slots[i].append(value)
    if not all(slots) or not any(len(slot) > 1 for slot in slots):
        return None
    return Menu(author, {'mode': 'one option per question', 'questions': public}, slots)


def fractions_in(node):
    if isinstance(node, dict):
        if node.get('type') == 'number' and node.get('denominator', 1) > 1:
            yield node['denominator']
        else:
            for child in node.values():
                yield from fractions_in(child)
    elif isinstance(node, list):
        for child in node:
            yield from fractions_in(child)


def profile(lesson, author, seed):
    source = {'version': author.VERSION, 'seed': seed}
    if author is counting_lesson:
        _, printed = author.build(lesson, source)
        values = list(printed.values())
        return sum(n >= 7 for n in values), {'itemsCountingSevenOrMore': sum(n >= 7 for n in values),
                                               'countsByQuestion': [values[i:i+5] for i in range(0, len(values), 5)]}
    if author is division_facts:
        _, _, worksheet = author.derive(lesson, source)
        facts = [[[item['left'], item['right']] for item in row['items']] for row in worksheet['questions']]
        harder = sum(divisor >= 6 and dividend // divisor >= 6 for row in facts for dividend, divisor in row)
        return harder, {'factsWithBothFactorsAtLeastSix': harder, 'dividendAndDivisorByQuestion': facts}
    questions = author.build(lesson, source)['sections'][0]['questions']
    denominators = [[list(fractions_in(item['answer']['task'])) for item in row['items']] for row in questions]
    larger = sum(lcm(*group) >= 24 for row in denominators for group in row)
    return larger, {'itemsWithCommonDenominatorAtLeast24': larger, 'denominatorsByQuestion': denominators}


def build_menu(lesson):
    author = next((module for module in AUTHORS if module.eligible(lesson)), None)
    if author is None:
        return None
    if author in GEOMETRY:
        return geometry_menu(lesson, author)
    # Preserve the per-sheet independence/coverage guarantees of the three seed
    # contracts. The provider chooses between measured profiles, never a seed.
    start = secrets.randbits(32)
    examples = []
    for offset in range(12):
        seed = (start + offset) % 2**32
        score, view = profile(lesson, author, seed)
        examples.append((score, seed, view))
    examples.sort(key=lambda entry: entry[0])
    low, high = examples[0], examples[-1]
    # A single incidental change offers no meaningful whole-series emphasis.
    if high[0] - low[0] < 3:
        return None
    return Menu(author, {'mode': 'one whole-series profile', 'profiles': [low[2], high[2]]}, [[low[1], high[1]]])
