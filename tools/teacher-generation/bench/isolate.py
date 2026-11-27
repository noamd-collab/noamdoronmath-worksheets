"""Find which question, field and substring of a model reply the engine rejects.

Nothing here parses notation. Each answer comes from sending a reduced reply
through the engine's real compile path (`engine.compile_reply`) and seeing
whether the same rejection code comes back:

* a question is tested alone, repeated in every slot of a four-question sheet
  under a neutral title and rule;
* inside a failing question, each item, the intro, the table and the figure
  are tested alone; inside a failing text, each `[[...]]` island is tested
  alone.

The method therefore follows the engine as its grammar and answer contract
change. It reports what reproduces a rejection; it never repairs.
"""
from __future__ import annotations

from copy import deepcopy
import json
import re

from . import engine

ISLAND = re.compile(r'\[\[([^\[\]]*)\]\]')
LOCATION = re.compile(r' at q[0-9]+\.((?:intro|item\.[0-9]+(?:\.(?:prompt|answer))?|table(?:\.[a-z0-9.]+)?))\b')
SUSPECT = re.compile(r'[A-Za-z0-9$\\<>][A-Za-z0-9 .,+*/=()%^:<>$\\−×÷·-]*')
NEUTRAL_ANSWER = {'kind': 'computed', 'task': {'kind': 'evaluate', 'expression': '1 + 1'}, 'unit': ''}
NEUTRAL_ISLAND = '[[1]]'


def neutral(grade):
    """Plain Hebrew frame the engine accepts in every grade (vocalised in grades 1-2)."""
    if grade <= 2:
        return {'title': 'תַּרְגּוּל', 'rule': 'פִּתְרוּ אֶת הַתַּרְגִּילִים.', 'intro': 'פִּתְרוּ.', 'prompt': 'חַשְּׁבוּ.'}
    return {'title': 'תרגול', 'rule': 'פתרו את התרגילים.', 'intro': 'פתרו.', 'prompt': 'חשבו.'}


def clip(value, limit=120):
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, sort_keys=True)
    return text if len(text) <= limit else text[:limit] + '…'


def reply_questions(reply):
    """Questions of a flat reply in printed order: [(number, group, index, question)].

    The engine numbers `practice` then `challenges`. Any further group of
    questions (for example reserves) keeps its own name and no sheet number.
    A group written as an object keyed by question name is read in its own
    order, so its questions can still be examined; the engine rejects that
    shape for the sheet as a whole.
    """
    if not isinstance(reply, dict):
        return []
    rows, number = [], 0
    names = [n for n in ('practice', 'challenges') if n in reply] + sorted(
        n for n, v in reply.items() if n not in ('practice', 'challenges') and isinstance(v, list))
    for name in names:
        group = reply[name]
        group = list(group.values()) if isinstance(group, dict) else group
        if not isinstance(group, list):
            continue
        for index, question in enumerate(group):
            numbered = name in ('practice', 'challenges')
            number += numbered
            if name == 'reserves' and isinstance(question, dict) and isinstance(question.get('question'), dict):
                # A reserve is {"group", "conceptId", "question"}: examine the question it carries.
                question = question['question']
            rows.append((number if numbered else None, name, index, question))
    return rows


def reply_shape(reply):
    """How the reply is laid out, for a reader of the report."""
    if not isinstance(reply, dict):
        return type(reply).__name__
    return {name: f'{type(value).__name__}[{len(value)}]' if isinstance(value, (list, dict)) else type(value).__name__
            for name, value in sorted(reply.items())}


class Isolator:
    def __init__(self, lesson, skills):
        # Four is the smallest sheet the source contract accepts: one practice
        # question and three challenges, all the same question.
        self.lesson = {**lesson, 'questionCount': 4}
        self.skills = skills
        self.frame = neutral(lesson['gradeNumber'])
        self.context = engine.authoring_context(self.lesson, skills)
        self.compiles = 0
        self._neutral_ok = None

    def check(self, question):
        """None when the question compiles alone, else {'code', 'detail'}."""
        self.compiles += 1
        transport = engine.ReplyFromSchema(question, self.frame['title'], self.frame['rule'])
        result = engine.compile_reply(self.lesson, transport, self.skills, context=self.context)
        return None if result['ok'] else {'code': result['code'], 'detail': result['detail']}

    def neutral_items(self, count):
        return [{'prompt': self.frame['prompt'], 'answer': deepcopy(NEUTRAL_ANSWER)} for _ in range(count)]

    def baseline(self, count):
        """The neutral question must itself compile, or reduction proves nothing."""
        if self._neutral_ok is None:
            self._neutral_ok = self.check({'intro': self.frame['intro'], 'items': self.neutral_items(count)}) is None
        return self._neutral_ok

    def reproduces(self, question, code):
        failure = self.check(question)
        return failure is not None and failure['code'] == code

    # ------------------------------------------------------------------ text

    def _text(self, text, code, build):
        """The island or the run of prose that reproduces `code` on its own, else the whole text.

        Only positive evidence counts: a fragment is named when that fragment
        alone, after a neutral instruction, brings the same code back.
        Removing a fragment is not used, because it changes the sentence.
        """
        if not isinstance(text, str):
            return clip(text)
        if not text.strip():
            return '(empty)'
        parts = re.split(r'(\[\[[^\[\]]*\]\])', text)
        for part in parts[1::2]:
            if self.reproduces(build(self.frame['prompt'] + ' ' + part), code):
                return part
        runs = [match[0].strip() for part in parts[0::2] for match in SUSPECT.finditer(part)]
        guilty = [run for run in runs[:12] if run and self.reproduces(build(self.frame['prompt'] + ' ' + run), code)]
        if guilty:
            more = f' (+{len(guilty) - 1} more)' if len(guilty) > 1 else ''
            return 'prose: ' + clip(guilty[0], 80) + more
        return clip(text)

    # ------------------------------------------------------------------ question

    def locate(self, question, failure):
        """{'field', 'substring'} for one failing question; best effort, never a guess at a fix."""
        code = failure['code']
        items = question.get('items') if isinstance(question, dict) else None
        if not isinstance(items, list) or not items or not all(isinstance(i, dict) for i in items):
            return {'field': 'question', 'substring': clip(question)}
        count = len(items)
        if not self.baseline(count):
            return {'field': 'question', 'substring': clip(question.get('intro', '')), 'note': 'neutral question rejected'}
        extras = {k: question[k] for k in ('figure', 'drawingFromWords') if k in question}
        named = LOCATION.search(failure['detail'])
        field = named[1] if named else None

        if field is None and 'figure' in question:
            bare = {k: v for k, v in question.items() if k not in ('figure', 'drawingFromWords')}
            if not self.reproduces(bare, code):
                return {'field': 'figure', 'substring': clip(question['figure'])}
        if field is None:
            for number, item in enumerate(items, 1):
                if self.reproduces({'intro': self.frame['intro'], 'items': [item] * count, **extras}, code):
                    field = f'item.{number}'
                    break
        if field is None and not self.reproduces({**question, 'intro': self.frame['intro']}, code):
            field = 'intro'
        if field is None and 'table' in question:
            if not self.reproduces({k: v for k, v in question.items() if k != 'table'}, code):
                field = 'table'
        if field is None:
            return {'field': 'question', 'substring': clip(question.get('intro', ''))}

        if field == 'intro':
            build = lambda text: {'intro': text, 'items': self.neutral_items(count)}
            return {'field': 'intro', 'substring': self._text(question.get('intro'), code, build)}
        if field.startswith('table'):
            return {'field': field, 'substring': self._table(question, code, field)}
        number = int(field.split('.')[1])
        if not 1 <= number <= count:
            return {'field': field, 'substring': ''}
        item = items[number - 1]
        prompt = item.get('prompt')
        if not field.endswith(('.prompt', '.answer')):
            answer_only = {'prompt': self.frame['prompt'], 'answer': item.get('answer')}
            if self.reproduces({'intro': self.frame['intro'], 'items': [answer_only] * count, **extras}, code):
                field += '.answer'
            else:
                build = lambda text: {'intro': self.frame['intro'], 'items': [
                    {'prompt': text, 'answer': deepcopy(NEUTRAL_ANSWER)}] * count}
                part = self._text(prompt, code, build)
                if part != clip(prompt):
                    return {'field': field + '.prompt', 'substring': part}
                # Neither side reproduces it alone: the prompt and its answer disagree.
                return {'field': field, 'substring': clip(prompt), 'answer': clip(item.get('answer'))}
        if field.endswith('.answer'):
            return {'field': field, 'substring': clip(item.get('answer'))}
        build = lambda text: {'intro': self.frame['intro'], 'items': [
            {'prompt': text, 'answer': deepcopy(NEUTRAL_ANSWER)}] * count}
        return {'field': field, 'substring': self._text(prompt, code, build)}

    def _table(self, question, code, field):
        table = question.get('table')
        if not (isinstance(table, dict) and isinstance(table.get('head'), list) and isinstance(table.get('rows'), list)):
            return clip(table)
        named = re.fullmatch(r'table\.(head|row)\.([0-9]+)(?:\.([0-9]+))?', field)
        if named:
            try:
                cell = (table['head'][int(named[2]) - 1] if named[1] == 'head'
                        else table['rows'][int(named[2]) - 1][int(named[3]) - 1])
                return clip(cell)
            except (IndexError, TypeError, ValueError):
                return clip(table)
        return clip(table)

    # ------------------------------------------------------------------ reply

    def frame_failure(self, reply, count):
        """Whether the reply's own title and rule are rejected around a neutral question."""
        if not isinstance(reply, dict) or not self.baseline(count):
            return None
        self.compiles += 1
        question = {'intro': self.frame['intro'], 'items': self.neutral_items(count)}
        transport = engine.ReplyFromSchema(question, reply.get('title'), reply.get('rule'))
        result = engine.compile_reply(self.lesson, transport, self.skills, context=self.context)
        if result['ok']:
            return None
        named = re.search(r' at (rule|title)\b', result['detail'])
        return {'code': result['code'], 'detail': result['detail'][:200], 'field': named[1] if named else 'title or rule',
                'substring': clip(reply.get('rule') if not named or named[1] == 'rule' else reply.get('title'))}

    def failures(self, reply):
        """Every question of the reply that the engine rejects when it stands alone."""
        found = []
        rows = reply_questions(reply)
        sizes = [len(q['items']) for _, _, _, q in rows
                 if isinstance(q, dict) and isinstance(q.get('items'), list) and q['items']]
        if sizes and not self.baseline(sizes[0]):
            # Without a neutral sheet that compiles, a rejection could not be pinned on a question.
            raise engine.BenchError('The neutral four-question sheet is rejected; isolation cannot attribute failures')
        for number, group, index, question in rows:
            if not isinstance(question, dict):
                found.append({'question': number, 'group': group, 'index': index + 1,
                              'code': 'NOT_AN_OBJECT', 'field': 'question', 'substring': clip(question)})
                continue
            failure = self.check(question)
            if failure is None:
                continue
            row = {'question': number, 'group': group, 'index': index + 1, 'code': failure['code'],
                   'detail': failure['detail'][:200]}
            row.update(self.locate(question, failure))
            found.append(row)
        return found
