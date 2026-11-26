"""The repair ladder end to end, offline: hand-built replies through the worker's own job function.

Every test runs `remote_worker.process_job` through bench/engine with a
scripted model transport and no network. The author stage, the selection,
the correction request and the pre-pass (the pinned skill's adapter and
content gates) are the real ones. The PDF and Word render is replaced by a
stand-in that validates the sheet it is given, unless BENCH_RENDER_TESTS=1,
when the pinned skill renders and gates every sheet.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bench import engine  # noqa: E402
import provider  # noqa: E402
import remote_worker  # noqa: E402
from validation import GenerationError, capabilities, validate_lesson, validate_model  # noqa: E402

CORPUS = HERE / 'bench/corpus'
REAL_RENDER = os.environ.get('BENCH_RENDER_TESTS') == '1'
BAD_NOTATION = 'חשבו [[4 @ 2]].'


def computed(expression):
    return {'kind': 'computed', 'task': {'kind': 'evaluate', 'expression': expression}, 'unit': ''}


# The key of each item is a number the house gates refuse (G60): the source is valid, the built sheet is not.
OUT_OF_RANGE = {'intro': 'חשבו את התרגילים הבאים:', 'items': [
    {'prompt': '[[999999 x 999 + 1 = ___]]', 'answer': computed('999999*999+1')},
    {'prompt': '[[888888 x 999 + 1 = ___]]', 'answer': computed('888888*999+1')},
    {'prompt': '[[777777 x 999 + 2 = ___]]', 'answer': computed('777777*999+2')}]}

# Practice questions of the recorded G-order sheet with no gate word and no repeated structure, for a sheet
# requested above the grade 4 minimum. None of them is offered as a reserve or as a correction below.
EXTRA_PRACTICE = (7, 8, 13)


# The five questions of the recorded S-g4calc that the source refuses as written (round 3, notation by
# allowlist), and the spelling that the source reads, with the same numbers and typed tasks: a colon that
# touches a blank is the division sign (questions 3, 6 and 10, SOURCE_NOTATION), and a blank that no binder fills
# from the print is refused (questions 9 and 11, PRINTED_TASK_MISMATCH). Question 9 keeps its table, and beside
# a table an item is read only when it names the one row whose printed expression it types (round 4,
# printed_tasks.table_row_task), so each of its items names its own row in an instruction about it; the trusted
# adapter still refuses to print its typed task beside the table. A tuple gives each item its own spelling.
STRICT_SPELLING = (
    (('practice', 2), 'המספר החסר הוא ___: ', 'המספר החסר הוא: '),
    (('practice', 5), 'המספר החסר הוא ___: ', 'המספר החסר הוא: '),
    (('practice', 8), 'הערך החסר בטבלה הוא ___.', ('חשבו את הביטוי שבשורה הראשונה.', 'חשבו את הביטוי שבשורה השנייה.',
                                                   'חשבו את הביטוי שבשורה השלישית.')),
    (('challenges', 0), 'המספר החסר הוא ___: ', 'המספר החסר הוא: '),
    (('challenges', 1), '. התוצאה הנכונה היא ___', '. מהי התוצאה הנכונה?'),
)


def strict_spelling(recorded):
    """A test-local copy of the recorded S-g4calc reply in the spelling that the source reads (STRICT_SPELLING).

    Every other question, every number and every typed task is the recorded one. ``recorded`` is left as it is.
    """
    reply = copy.deepcopy(recorded)
    for (group, index), written, read in STRICT_SPELLING:
        for position, item in enumerate(reply[group][index]['items']):
            if written not in item['prompt']:
                raise AssertionError('The recorded S-g4calc reply changed: ' + written)
            item['prompt'] = item['prompt'].replace(written, read[position] if isinstance(read, tuple) else read)
    return reply


def clean_sheet(base, pool, extra=0):
    """A test-local copy of the recorded S-g4calc reply that the locked gates accept as written, but for G61.

    The three benign "לכל" sentences (question 4 item 2, question 8 intro, question 12 item 3) are reworded so
    that no gate word remains: the locked G32 refuses each of them as recorded (D19). Question 9 is written
    without its table, each prompt with its own expression: beside a table the trusted adapter never prints a
    typed task (PRINTED_TASK_MISMATCH). ``extra`` practice questions of G-order (EXTRA_PRACTICE) follow the
    practice questions, for a request above the grade 4 minimum of twelve. Its pre-pass names only the two
    ends of the difficulty spread on the printed stars (G61): question 4 and the first challenge.
    """
    reply = copy.deepcopy(base)
    for holder, field, recorded, reworded in (
            (reply['practice'][3]['items'][1], 'prompt', 'ואז נתנה לכל אחד מהם עוד 2 מחברות', 'ואז כל תלמיד קיבל ממנה עוד 2 מחברות'),
            (reply['practice'][7], 'intro', 'התאימו לכל ביטוי את התוצאה שלו על ידי הצבה בחישוב מדורג:',
             'חשבו את התוצאה של כל ביטוי בחישוב מדורג:'),
            (reply['challenges'][2]['items'][2], 'prompt', 'ואז הוסיף 2 מטבעות לכל כיס', 'ואז הוסיף 2 מטבעות בכל כיס')):
        if recorded not in holder[field]:
            raise AssertionError('The recorded S-g4calc reply changed: ' + recorded)
        holder[field] = holder[field].replace(recorded, reworded)
    table = reply['practice'][8]
    del table['table']
    table['intro'] = 'חשבו את ערכי הביטויים הבאים:'
    for item, expression in zip(table['items'], ('(10 + 2) x 3', '10 + 2 x 3', '(20 - 4) : 4')):
        item['prompt'] = f'חשבו: [[{expression}]]'
    reply['practice'] += [copy.deepcopy(pool['practice'][index]) for index in EXTRA_PRACTICE[:extra]]
    return reply


class Scripted:
    """A model transport that answers from a script and keeps every request it was sent.

    A dict is returned as the parsed reply, a string goes through the engine's
    own reply reader as the model's content text, an exception is raised. When
    the script is exhausted the call fails like a provider that does not answer.
    """

    def __init__(self, *replies):
        self.replies, self.bodies, self.calls = list(replies), [], []

    def __call__(self, target, key, body, metadata, timeout):
        self.bodies.append(body)
        self.calls.append(engine.describe_call(body))
        reply = self.replies.pop(0) if self.replies else GenerationError('PROVIDER_UNAVAILABLE', 'nothing scripted')
        if isinstance(reply, Exception):
            raise reply
        if isinstance(reply, str):
            envelope = json.dumps({'choices': [{'finish_reason': 'stop', 'message': {'content': reply}}]}).encode()
            return provider.parse_author_reply(envelope, metadata if isinstance(metadata, dict) else {})
        if isinstance(metadata, dict):
            metadata.update(responseReceived=True, usage={}, elapsedSeconds=0.0)
        return copy.deepcopy(reply)

    def names(self):
        return [call['schema'] for call in self.calls]

    def sent(self, index):
        return json.loads(self.bodies[index]['messages'][1]['content'])


class LadderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='ladder-test-')
        cls.skills = engine.skill_roots(cls.scratch)
        cls.lesson = json.loads((CORPUS / 'lessons/g4-order-practice.json').read_text(encoding='utf-8'))
        cls.recorded = json.loads((CORPUS / 'replies/S-g4calc.json').read_text(encoding='utf-8'))
        cls.base = strict_spelling(cls.recorded)
        pool = json.loads((CORPUS / 'replies/G-order.json').read_text(encoding='utf-8'))
        cls.spare = {'practice': pool['practice'], 'challenges': pool['challenges']}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def reply(self, *, practice=2, challenges=1, base=None):
        """A sheet (the recorded S-g4calc of twelve questions unless ``base`` is given) with reserves from another
        recorded sheet. Two practice and one challenge reserve are what the author schema asks for beside twelve
        to fifteen questions; the recorded replies themselves carry none."""
        from lesson_select import reserve_groups
        reply = copy.deepcopy(self.base if base is None else base)
        groups = reserve_groups(len(reply['practice']) + len(reply['challenges']))
        if practice > groups.count('practice') or challenges > groups.count('challenges'):
            raise AssertionError('More reserves than the author schema asks for')
        concept = self.lesson['lessonBoundary']['conceptIds'][0]
        reply['reserves'] = ([{'group': 'practice', 'conceptId': concept, 'question': copy.deepcopy(q)}
                              for q in self.spare['practice'][:practice]]
                             + [{'group': 'challenges', 'conceptId': concept, 'question': copy.deepcopy(q)}
                                for q in self.spare['challenges'][:challenges]])
        return reply

    def clean(self, extra=0):
        """clean_sheet with the three reserves the author schema asks for."""
        return self.reply(base=clean_sheet(self.base, self.spare, extra))

    def asking(self, count):
        return {**self.lesson, 'questionCount': count}

    def stand_in_render(self, lesson, payload, target, **kwargs):
        # The sheet must be a valid source for the lesson it is rendered with.
        validate_model(lesson, payload, salvaged_from=kwargs.get('salvaged_from'))
        target.mkdir(parents=True, exist_ok=True)
        artifacts = []
        for kind in ('pdf', 'docx'):
            blob = ('stand-in ' + kind).encode()
            (target / ('sheet.' + kind)).write_bytes(blob)
            artifacts.append({'kind': kind, 'path': 'sheet.' + kind, 'sha256': hashlib.sha256(blob).hexdigest(), 'bytes': len(blob)})
        return {'status': 'needs_review', 'automatedChecksPassed': True, 'renderingChecksPassed': True,
                'authoringProfile': 'general-skill-source/v1', 'skill': {'name': 'elementary', 'version': 'pinned', 'sha256': 'a' * 64},
                'steps': [{'name': 'stand-in-render', 'status': 'PASS'}], 'artifacts': artifacts,
                'reviewFindings': [], 'unverifiedAnswers': []}

    def run_job(self, transport, lesson=None):
        """One job through the worker. Returns (outcome, the sheets handed to the render)."""
        sheets = []
        real = remote_worker.render_job

        def render(job_lesson, payload, target, **kwargs):
            sheets.append({'count': job_lesson['questionCount'], 'payload': payload, 'salvagedFrom': kwargs.get('salvaged_from')})
            return (real if REAL_RENDER else self.stand_in_render)(job_lesson, payload, target, **kwargs)

        work = Path(tempfile.mkdtemp(prefix='job-', dir=self.scratch))
        with engine.engine_environment(self.skills), engine.network_guard() as refused, \
                patch.object(remote_worker, 'render_job', render):
            outcome = engine.run_job(lesson or self.lesson, transport, work, seed=work.name)
        self.assertEqual(refused, [])
        return outcome, sheets

    def printed(self, sheet):
        return sheet['payload']['sections'][0]['questions']

    # ------------------------------------------------------------------ reserves

    def test_two_bad_questions_take_reserves_and_the_questions_left_without_one_go_to_one_correction(self):
        reply = self.reply()
        reply['practice'][1]['intro'] = BAD_NOTATION                                    # a practice question
        reply['challenges'][1]['items'] = reply['challenges'][1]['items'][:2]           # a challenge: too few items
        transport = Scripted(reply)                                                     # the correction gets no answer
        outcome, sheets = self.run_job(transport)
        # Questions 2 and 11 took a reserve each. The first pre-pass stopped at question 9: its prompt refers to the
        # table, so the trusted adapter refuses to print its typed task after it (PRINTED_TASK_MISMATCH), and the last
        # reserve took its place. The second pre-pass named questions 4, 8, 10 and 12: the locked G32 refuses the
        # per-unit or instruction "לכל" of 4, 8 and 12, and the printed stars put the difficulty spread above the
        # limit (G61 on 4 and 10). No reserve was left; one correction asked for the four and got no answer.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[1]['required'], ['q10', 'q12', 'q4', 'q8'])
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [9], 'codes': ['TRUSTED_ADAPTER']},
                                                {'status': 'replace', 'questions': [4, 8, 10, 12], 'codes': ['G32', 'G61']}])
        events = outcome['ladder']['attemptRecords'][0]['events']
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action']) for e in events],
                         [(2, 'practice', ['SOURCE_NOTATION'], 'source', 'reserve'),
                          (11, 'challenges', ['SOURCE_ITEMS'], 'source', 'reserve'),
                          (9, 'practice', ['TRUSTED_ADAPTER', 'PRINTED_TASK_MISMATCH'], 'precheck', 'reserve'),
                          (4, 'practice', ['G32', 'G61'], 'precheck', 'missing'),
                          (8, 'practice', ['G32'], 'precheck', 'missing'),
                          (10, 'challenges', ['G61'], 'precheck', 'missing'),
                          (12, 'challenges', ['G32'], 'precheck', 'missing')])
        self.assertTrue(outcome['ladder']['correctionFailed'])
        self.assertEqual((outcome['ladder']['attempts'], outcome['ladder']['corrections']), (1, 1))

    def test_two_bad_questions_on_a_clean_sheet_above_the_minimum_take_reserves_and_a_shorter_sheet_is_delivered(self):
        reply = self.clean(1)                                                           # thirteen questions
        reply['practice'][1]['intro'] = BAD_NOTATION                                    # a practice question
        reply['challenges'][1]['items'] = reply['challenges'][1]['items'][:2]           # a challenge: too few items
        transport = Scripted(reply)                                                     # the correction gets no answer
        outcome, sheets = self.run_job(transport, self.asking(13))
        # Questions 2 and 12 took a reserve each. The pre-pass named the two ends of the difficulty spread on the
        # printed stars (G61): question 4 took the last practice reserve; question 11 had none, the one correction
        # asked for it and got no answer, and it was dropped. Twelve of thirteen keeps three quarters and the grade 4
        # minimum: the shorter sheet is delivered with its note.
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[1]['required'], ['q11'])
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [4, 11], 'codes': ['G61']},
                                                {'status': 'clean', 'questions': [], 'codes': []}])
        self.assertEqual(len(sheets), 1)
        questions = self.printed(sheets[0])
        self.assertEqual((sheets[0]['count'], len(questions), sheets[0]['salvagedFrom']), (12, 12, 13))
        self.assertEqual([q['star'] for q in questions], [False] * 10 + [True] * 2)
        self.assertNotIn('@', json.dumps(questions, ensure_ascii=False))
        self.assertTrue(all(len(q['items']) >= 3 for q in questions))
        self.assertEqual(outcome['result']['salvage'],
                         {'attempts': 1, 'corrections': 1, 'requestedQuestions': 13, 'printedQuestions': 12,
                          'replaced': {'count': 3, 'codes': {'G61': 1, 'SOURCE_ITEMS': 1, 'SOURCE_NOTATION': 1}},
                          'dropped': {'count': 1, 'codes': {'G61': 1}}, 'gate': 'deliver'})
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(2, 'practice', ['SOURCE_NOTATION'], 'source', 'reserve'),
                          (12, 'challenges', ['SOURCE_ITEMS'], 'source', 'reserve'),
                          (4, 'practice', ['G61'], 'precheck', 'reserve'),
                          (11, 'challenges', ['G61'], 'precheck', 'dropped')])
        self.assertEqual([(row['code'], row['count']) for row in outcome['result']['reviewFindings']], [('SHORTER_SHEET', 1)])
        # The same two bad questions on the clean sheet of twelve, the grade 4 minimum: nothing may be dropped.
        reply = self.clean()
        reply['practice'][1]['intro'] = BAD_NOTATION
        reply['challenges'][1]['items'] = reply['challenges'][1]['items'][:2]
        outcome, sheets = self.run_job(Scripted(reply))
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual([(e['question'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(2, 'reserve'), (11, 'reserve'), (4, 'reserve'), (10, 'missing')])

    def test_a_reply_without_reserves_still_compiles_and_one_correction_asks_for_every_named_question(self):
        # The recorded S-g4calc in the spelling the source reads (strict_spelling): no reserves, as every recorded reply.
        transport = Scripted(copy.deepcopy(self.base))
        outcome, sheets = self.run_job(transport)                                       # the correction gets no answer
        # The pre-pass stopped at question 9: its prompt refers to the table, so the trusted adapter refuses to print
        # its typed task after it (PRINTED_TASK_MISMATCH). With no reserve it went to one correction, which got no
        # answer. Eleven of twelve is below the grade 4 minimum of twelve: nothing is rendered.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [9], 'codes': ['TRUSTED_ADAPTER']}])
        self.assertEqual((len(transport.calls), transport.calls[1]['required']), (2, ['q9']))
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(9, 'practice', ['TRUSTED_ADAPTER', 'PRINTED_TASK_MISMATCH'], 'precheck', 'missing')])
        self.assertTrue(outcome['ladder']['correctionFailed'])
        self.assertEqual(outcome['ladder']['attempts'], 1)
        # The request asked for the reserves: three beside twelve questions, each tagged.
        schema = transport.bodies[0]['response_format']['json_schema']['schema']
        self.assertIn('reserves', schema['required'])
        self.assertEqual(schema['properties']['reserves']['minItems'], 3)
        self.assertEqual([(row['group'], row['conceptId']) for row in transport.sent(0)['reservePlan']],
                         [('practice', 'ד07#0'), ('practice', 'ד07#0'), ('challenges', 'ד07#1')])

    def test_the_recorded_reply_as_it_arrived_loses_five_questions_when_it_is_read(self):
        # As it arrived, S-g4calc writes "המספר החסר הוא ___: [[...]]" in questions 3, 6 and 10 (a colon that touches a
        # blank is the division sign: SOURCE_NOTATION), and a blank that no binder fills from the print in questions
        # 9 (beside its table) and 11 (after a printed calculation): PRINTED_TASK_MISMATCH. All five are refused when
        # the reply is read, before any pre-pass; the one correction asks for them and gets no answer.
        transport = Scripted(copy.deepcopy(self.recorded))
        outcome, sheets = self.run_job(transport)
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads'], outcome['prechecks']), ('SOURCE_NOTATION', [], [], []))
        self.assertEqual((transport.names(), transport.calls[1]['required']),
                         (['skill_worksheet_content', 'revise_skill_questions'], ['q10', 'q11', 'q3', 'q6', 'q9']))
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(3, 'practice', ['SOURCE_NOTATION'], 'source', 'missing'),
                          (6, 'practice', ['SOURCE_NOTATION'], 'source', 'missing'),
                          (9, 'practice', ['PRINTED_TASK_MISMATCH'], 'source', 'missing'),
                          (10, 'challenges', ['SOURCE_NOTATION'], 'source', 'missing'),
                          (11, 'challenges', ['PRINTED_TASK_MISMATCH'], 'source', 'missing')])
        self.assertTrue(outcome['ladder']['correctionFailed'])
        # With the three reserves the schema asks for, they take 3, 6 and 10; 9 and 11 go to the correction.
        transport = Scripted(self.reply(base=self.recorded))
        outcome, sheets = self.run_job(transport)
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['prechecks']), ('PRINTED_TASK_MISMATCH', [], []))
        self.assertEqual(transport.calls[1]['required'], ['q11', 'q9'])
        self.assertEqual([(e['question'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(3, 'reserve'), (6, 'reserve'), (9, 'missing'), (10, 'reserve'), (11, 'missing')])
        # The test-local copy in the spelling the source reads changes only those five questions.
        changed = [(group, index) for group in ('practice', 'challenges')
                   for index, (a, b) in enumerate(zip(self.recorded[group], self.base[group])) if a != b]
        self.assertEqual(changed, [('practice', 2), ('practice', 5), ('practice', 8), ('challenges', 0), ('challenges', 1)])

    def test_the_benign_each_of_the_recorded_reply_is_refused_by_the_locked_truth_gate_and_never_printed(self):
        from claim_words import claim_lint, scan
        # The recorded reply uses "לכל" in three questions, each in a per-unit or instruction reading: q4 (practice 4,
        # item 2), q8 (practice 8, its intro) and q12 (challenge 3, item 3). No other question has a gate word.
        # claim_lint names none of them; nothing is recorded in the ledger for them either.
        numbered = list(enumerate(self.base['practice'] + self.base['challenges'], start=1))
        texts = {n: ' '.join([q['intro']] + [item['prompt'] for item in q['items']]) for n, q in numbered}
        self.assertEqual({n: [(row['word'], row['reading']) for row in scan(text)] for n, text in texts.items() if scan(text)},
                         {4: [('לכל', 'per_unit')], 8: [('לכל', 'instruction')], 12: [('לכל', 'per_unit')]})
        self.assertEqual([claim_lint(q) for _, q in numbered], [[]] * 12)
        rows = []
        real = remote_worker.precheck_job

        def recording(*args, **kwargs):
            result = real(*args, **kwargs)
            rows.append([(b['code'], b['question']) for b in result['gate']['blocking']])
            return result

        # In the spelling the source reads, with no reserve: the first pre-pass stops at question 9, whose prompt refers
        # to the table: the trusted adapter refuses to print its typed task after it. Its correction gets no answer;
        # nothing is rendered.
        with patch.object(remote_worker, 'precheck_job', recording):
            outcome, sheets = self.run_job(Scripted(copy.deepcopy(self.base)))
        self.assertEqual(rows, [[('TRUSTED_ADAPTER', 9)]])
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        # With the three reserves: 9 takes a practice reserve; the second pre-pass refuses 4, 8 and 12 with G32 (D19)
        # and 4 and 10 with G61. 4 takes the last practice reserve and 10 the challenge reserve; 8 and 12 stay missing
        # and their correction gets no answer. Ten of twelve is below the grade 4 minimum: nothing is rendered.
        rows.clear()
        with patch.object(remote_worker, 'precheck_job', recording):
            outcome, sheets = self.run_job(Scripted(self.reply()))
        self.assertEqual(rows, [[('TRUSTED_ADAPTER', 9)], [('G32', 4), ('G32', 8), ('G32', 12), ('G61', 4), ('G61', 10)]])
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual([(e['question'], e['codes'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(9, ['TRUSTED_ADAPTER', 'PRINTED_TASK_MISMATCH'], 'reserve'), (4, ['G32', 'G61'], 'reserve'), (8, ['G32'], 'missing'),
                          (10, ['G61'], 'reserve'), (12, ['G32'], 'missing')])
        # The author schema asks for no more than these three reserves. With the three sentences reworded so that no
        # gate word is left (and question 9 written without its table), G32 names nothing: the pre-pass names only
        # 4 and 10 (G61), reserves take both, and the whole sheet of twelve is rendered with no "לכל" in it.
        rows.clear()
        clean = self.clean()
        self.assertEqual([n for n, q in enumerate(clean['practice'] + clean['challenges'], start=1)
                          if scan(' '.join([q['intro']] + [item['prompt'] for item in q['items']]))], [])
        with patch.object(remote_worker, 'precheck_job', recording):
            outcome, sheets = self.run_job(Scripted(clean))
        self.assertEqual(rows, [[('G61', 4), ('G61', 10)], []])
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual([(e['question'], e['codes'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(4, ['G61'], 'reserve'), (10, ['G61'], 'reserve')])
        self.assertEqual(len(sheets), 1)
        printed = json.dumps(self.printed(sheets[0]), ensure_ascii=False)
        self.assertEqual((len(self.printed(sheets[0])), printed.count('לכל')), (12, 0))

    def test_a_question_named_by_a_truth_gate_is_swapped_before_any_render(self):
        reply = self.reply()
        reply['practice'][2] = copy.deepcopy(OUT_OF_RANGE)
        transport = Scripted(reply)
        outcome, sheets = self.run_job(transport)
        # The first pre-pass stopped at question 9: its prompt refers to the table, so the trusted adapter refuses to
        # print its typed task after it (PRINTED_TASK_MISMATCH), and a practice reserve took its place. In the second
        # pre-pass the pinned house gates named question 3 (G60) and the two ends of the difficulty spread, questions
        # 4 and 10 (G61 on the printed stars, which blocks like any other finding); the locked G32 named the "לכל" of
        # 4, 8 and 12. Reserves took the places of 3 and 10; one correction asked for 4, 8 and 12 and got no answer.
        # Nine of twelve is below the grade 4 minimum of twelve: no sheet is shortened and nothing is rendered.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [9], 'codes': ['TRUSTED_ADAPTER']},
                                                {'status': 'replace', 'questions': [3, 4, 8, 10, 12], 'codes': ['G32', 'G60', 'G61']}])
        self.assertEqual((transport.names(), transport.calls[1]['required']),
                         (['skill_worksheet_content', 'revise_skill_questions'], ['q12', 'q4', 'q8']))
        self.assertEqual([(e['question'], e['codes'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(9, ['TRUSTED_ADAPTER', 'PRINTED_TASK_MISMATCH'], 'precheck', 'reserve'), (3, ['G60'], 'precheck', 'reserve'),
                          (4, ['G32', 'G61'], 'precheck', 'missing'), (8, ['G32'], 'precheck', 'missing'),
                          (10, ['G61'], 'precheck', 'reserve'), (12, ['G32'], 'precheck', 'missing')])
        # On the clean sheet (clean_sheet) with the same three reserves the pre-pass names question 3 (G60) and the
        # two ends of the difficulty spread, 4 and 10 (G61). Reserves take all three places, the second pass is
        # clean, and the whole sheet is rendered once with no model call after the draft.
        reply = self.clean()
        reply['practice'][2] = copy.deepcopy(OUT_OF_RANGE)
        transport = Scripted(reply)
        outcome, sheets = self.run_job(transport)
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [3, 4, 10], 'codes': ['G60', 'G61']},
                                                {'status': 'clean', 'questions': [], 'codes': []}])
        self.assertEqual((transport.names(), len(sheets)), (['skill_worksheet_content'], 1))   # no model call, one render
        questions = self.printed(sheets[0])
        self.assertEqual((sheets[0]['count'], sheets[0]['salvagedFrom'], len(questions)), (12, None, 12))
        self.assertEqual([q['star'] for q in questions], [False] * 9 + [True] * 3)
        self.assertNotIn('999999', json.dumps(questions, ensure_ascii=False))
        salvage = outcome['result']['salvage']
        self.assertEqual((salvage['replaced'], salvage['dropped'], salvage['corrections'], salvage['printedQuestions'], salvage['gate']),
                         ({'count': 3, 'codes': {'G60': 1, 'G61': 2}}, {'count': 0, 'codes': {}}, 0, 12, 'deliver'))
        self.assertEqual([(e['question'], e['codes'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(3, ['G60'], 'precheck', 'reserve'), (4, ['G61'], 'precheck', 'reserve'), (10, ['G61'], 'precheck', 'reserve')])
        self.assertEqual(outcome['result']['reviewFindings'], [])

    # ------------------------------------------------------------------ one correction

    def test_reserves_exhausted_asks_a_correction_for_the_deficit_only(self):
        reply = self.reply(practice=1, challenges=0)
        for index in (1, 4):
            reply['practice'][index]['intro'] = BAD_NOTATION
        fixed = copy.deepcopy(self.spare['practice'][5])
        transport = Scripted(reply, {'q5': fixed})                                      # the second correction gets no answer
        outcome, sheets = self.run_job(transport)
        # Question 2 took the one reserve; only question 5 was left to the model. The pre-pass then stopped at
        # question 9, whose prompt refers to the table: the trusted adapter refuses to print its typed task after it.
        # With no reserve left a second correction asked for exactly that question, got no answer, and eleven of
        # twelve would remain, below the grade 4 minimum.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions', 'revise_skill_questions'])
        self.assertEqual((transport.calls[1]['required'], transport.calls[2]['required']), (['q5'], ['q9']))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [9], 'codes': ['TRUSTED_ADAPTER']}])
        asked = transport.sent(1)['questionsToCorrect']
        self.assertEqual([(row['question'], row['plan']['questionNumber'], row['plan']['group']) for row in asked], [(5, 5, 'practice')])
        self.assertEqual(asked[0]['original']['intro'], BAD_NOTATION)
        # The exact field and substring, then the fixed instruction of the code.
        self.assertTrue(asked[0]['findings'][0].startswith('Check intro at «[[4 @ 2]]». '), asked[0]['findings'][0][:80])
        self.assertIn('ENTIRE expression in one math span', asked[0]['findings'][0])
        self.assertEqual([(row['question'], row['plan']['group']) for row in transport.sent(2)['questionsToCorrect']],
                         [(9, 'practice')])
        self.assertEqual((outcome['ladder']['attempts'], outcome['ladder']['corrections'], outcome['ladder']['correctionFailed']),
                         (1, 2, True))
        self.assertEqual([(e['question'], e['codes'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(2, ['SOURCE_NOTATION'], 'source', 'reserve'), (5, ['SOURCE_NOTATION'], 'source', 'correction'),
                          (9, ['TRUSTED_ADAPTER', 'PRINTED_TASK_MISMATCH'], 'precheck', 'missing')])

    def test_reserves_exhausted_then_a_taken_correction_reach_a_delivered_shorter_sheet(self):
        reply = self.clean(1)                                                           # thirteen questions
        for index in (0, 1, 4):
            reply['practice'][index]['intro'] = BAD_NOTATION
        fixed = copy.deepcopy(self.spare['practice'][5])
        transport = Scripted(reply, {'q5': fixed})                                      # the second correction gets no answer
        outcome, sheets = self.run_job(transport, self.asking(13))
        # Questions 1 and 2 took the two practice reserves; question 5 was left to the model, and the question its
        # correction returned was examined and taken. The pre-pass then named 4 and 11 (G61): 11 took the challenge
        # reserve, and a second correction asked for 4 alone, got no answer, and 4 was dropped. Twelve of thirteen
        # keeps three quarters and the grade 4 minimum: the shorter sheet is delivered with its note.
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions', 'revise_skill_questions'])
        self.assertEqual((transport.calls[1]['required'], transport.calls[2]['required']), (['q5'], ['q4']))
        self.assertEqual([(row['question'], row['plan']['group']) for row in transport.sent(1)['questionsToCorrect']],
                         [(5, 'practice')])
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [4, 11], 'codes': ['G61']},
                                                {'status': 'clean', 'questions': [], 'codes': []}])
        self.assertEqual([(sheet['count'], sheet['salvagedFrom']) for sheet in sheets], [(12, 13)])
        questions = self.printed(sheets[0])
        self.assertEqual([q['star'] for q in questions], [False] * 9 + [True] * 3)
        self.assertNotIn('@', json.dumps(questions, ensure_ascii=False))
        self.assertIn(fixed['intro'], json.dumps(questions, ensure_ascii=False))       # the corrected question 5 is printed
        salvage = outcome['result']['salvage']
        self.assertEqual((salvage['attempts'], salvage['corrections'], salvage['replaced'], salvage['dropped']),
                         (1, 2, {'count': 4, 'codes': {'G61': 1, 'SOURCE_NOTATION': 3}}, {'count': 1, 'codes': {'G61': 1}}))
        self.assertEqual([(e['question'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(1, 'source', 'reserve'), (2, 'source', 'reserve'), (5, 'source', 'correction'),
                          (4, 'precheck', 'dropped'), (11, 'precheck', 'reserve')])
        self.assertEqual([(row['code'], row['count']) for row in outcome['result']['reviewFindings']], [('SHORTER_SHEET', 1)])

    def test_a_correction_also_serves_a_kernel_code_and_a_refused_correction_is_never_printed(self):
        reply = copy.deepcopy(self.base)
        reply['practice'][3]['items'][0]['answer'] = computed('2^13')                   # a kernel code: UNSUPPORTED_POWER
        still_bad = copy.deepcopy(reply['practice'][3])
        transport = Scripted(reply, {'q4': still_bad})
        outcome, sheets = self.run_job(transport)
        finding = transport.sent(1)['questionsToCorrect'][0]['findings'][0]
        self.assertIn('The exact checker cannot compute this typed task', finding)
        self.assertIn('item.1', finding)
        # The corrected question was examined like any other and refused again: it stays missing, never printed.
        # Eleven of twelve is below the grade 4 minimum of twelve, so no sheet is shortened and nothing reaches the
        # pre-pass. The correction got an answer, so the worker asks for one second draft, which gets none.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('PROVIDER_UNAVAILABLE', [], []))
        self.assertEqual(outcome['prechecks'], [])
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions', 'skill_worksheet_content'])
        self.assertEqual(transport.calls[1]['required'], ['q4'])
        self.assertEqual([[(e['question'], e['codes'], e['stage'], e['action']) for e in attempt['events']]
                          for attempt in outcome['ladder']['attemptRecords'] if attempt['draft']],
                         [[(4, ['UNSUPPORTED_POWER'], 'source', 'missing')]])
        self.assertEqual((outcome['ladder']['attempts'], outcome['ladder']['corrections'], outcome['ladder']['firstCode']),
                         (2, 1, 'UNSUPPORTED_POWER'))

    def test_a_kernel_code_refused_again_after_its_correction_is_dropped_into_a_delivered_shorter_sheet(self):
        reply = self.clean(2)                                                           # fourteen questions
        for index in (0, 1):
            reply['practice'][index]['intro'] = BAD_NOTATION
        reply['practice'][3]['items'][0]['answer'] = computed('2^13')                   # a kernel code: UNSUPPORTED_POWER
        still_bad = copy.deepcopy(reply['practice'][3])
        dropped_text = 'למורה היו'                                                      # question 4, item 2
        self.assertIn(dropped_text, still_bad['items'][1]['prompt'])
        transport = Scripted(reply, {'q4': still_bad})                                  # the second correction gets no answer
        outcome, sheets = self.run_job(transport, self.asking(14))
        # Questions 1 and 2 took the two practice reserves, so question 4 went to the model. Its correction answered
        # and was examined like any other: refused again, it was dropped and is never printed. On the thirteen left the
        # pre-pass named 1 and 11 (G61; questions 1 and 12 of the draft): 12 took the challenge reserve; 1 went to a
        # second correction, got no answer and was dropped. Twelve of fourteen keeps three quarters and the grade 4
        # minimum: the shorter sheet is delivered with its note.
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        finding = transport.sent(1)['questionsToCorrect'][0]['findings'][0]
        self.assertIn('The exact checker cannot compute this typed task', finding)
        self.assertIn('item.1', finding)
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions', 'revise_skill_questions'])
        self.assertEqual((transport.calls[1]['required'], transport.calls[2]['required']), (['q4'], ['q1']))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [1, 11], 'codes': ['G61']},
                                                {'status': 'clean', 'questions': [], 'codes': []}])
        self.assertEqual([(sheet['count'], sheet['salvagedFrom']) for sheet in sheets], [(12, 14)])
        questions = self.printed(sheets[0])
        self.assertEqual([q['star'] for q in questions], [False] * 9 + [True] * 3)
        self.assertNotIn(dropped_text, json.dumps(questions, ensure_ascii=False))
        salvage = outcome['result']['salvage']
        self.assertEqual((salvage['attempts'], salvage['corrections'], salvage['printedQuestions'], salvage['replaced'], salvage['dropped']),
                         (1, 2, 12, {'count': 3, 'codes': {'G61': 1, 'SOURCE_NOTATION': 2}},
                          {'count': 2, 'codes': {'G61': 1, 'UNSUPPORTED_POWER': 1}}))
        self.assertEqual([(e['question'], e['codes'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(1, ['SOURCE_NOTATION'], 'source', 'reserve'), (2, ['SOURCE_NOTATION'], 'source', 'reserve'),
                          (4, ['UNSUPPORTED_POWER'], 'source', 'dropped'), (1, ['G61'], 'precheck', 'dropped'),
                          (12, ['G61'], 'precheck', 'reserve')])
        self.assertEqual([(row['code'], row['count']) for row in outcome['result']['reviewFindings']], [('SHORTER_SHEET', 2)])

    # ------------------------------------------------------------------ a shorter sheet

    def test_a_sheet_requested_at_the_grade_minimum_is_never_shortened(self):
        reply = copy.deepcopy(self.base)
        for index in (0, 6):
            reply['practice'][index]['intro'] = BAD_NOTATION
        transport = Scripted(reply)                                                     # the correction gets no answer
        outcome, sheets = self.run_job(transport)
        # Questions 1 and 7 are missing and their correction got no answer. Ten of twelve keeps three quarters but
        # not the grade 4 minimum of twelve: nothing is dropped, nothing reaches the pre-pass, and the job reports
        # the first refusal.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('SOURCE_NOTATION', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[1]['required'], ['q1', 'q7'])
        self.assertEqual(outcome['prechecks'], [])
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(1, 'practice', ['SOURCE_NOTATION'], 'source', 'missing'),
                          (7, 'practice', ['SOURCE_NOTATION'], 'source', 'missing')])
        self.assertTrue(outcome['ladder']['correctionFailed'])
        self.assertEqual(outcome['ladder']['attempts'], 1)   # a provider that did not answer is not asked for a second draft

    def order_of_twenty(self):
        """A recorded grade 4 sheet of twenty questions, above the grade minimum of twelve."""
        lesson = json.loads((CORPUS / 'lessons/g4-order.json').read_text(encoding='utf-8'))
        reply = json.loads((CORPUS / 'replies/G-order.json').read_text(encoding='utf-8'))
        self.assertEqual((lesson['gradeNumber'], lesson['questionCount'], len(reply['practice']), len(reply['challenges'])),
                         (4, 20, 17, 3))
        return lesson, reply

    def test_a_sheet_requested_above_the_grade_minimum_is_shortened_to_three_quarters_with_its_note(self):
        lesson, reply = self.order_of_twenty()
        transport = Scripted(reply)                                                     # the correction gets no answer
        outcome, sheets = self.run_job(transport, lesson)
        # The pre-pass named questions 4, 7, 13, 17 and 20 (G32, G61, G62). No reserve was offered; one correction
        # asked for all five and got no answer. Fifteen of twenty is three quarters and above the grade 4 minimum of
        # twelve: the five are dropped and the shorter sheet is delivered with its note.
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [4, 7, 13, 17, 20], 'codes': ['G32', 'G61', 'G62']},
                                                {'status': 'clean', 'questions': [], 'codes': []}])
        self.assertEqual((transport.names(), transport.calls[1]['required']),
                         (['skill_worksheet_content', 'revise_skill_questions'], ['q13', 'q17', 'q20', 'q4', 'q7']))
        self.assertEqual([(sheet['count'], sheet['salvagedFrom']) for sheet in sheets], [(15, 20)])
        self.assertEqual([q['star'] for q in self.printed(sheets[0])], [False] * 13 + [True] * 2)
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(4, 'practice', ['G32', 'G61'], 'precheck', 'dropped'), (7, 'practice', ['G32'], 'precheck', 'dropped'),
                          (13, 'practice', ['G62'], 'precheck', 'dropped'), (17, 'practice', ['G62'], 'precheck', 'dropped'),
                          (20, 'challenges', ['G61'], 'precheck', 'dropped')])
        self.assertEqual(outcome['result']['salvage'],
                         {'attempts': 1, 'corrections': 1, 'requestedQuestions': 20, 'printedQuestions': 15,
                          'replaced': {'count': 0, 'codes': {}},
                          'dropped': {'count': 5, 'codes': {'G32': 2, 'G61': 2, 'G62': 2}}, 'gate': 'deliver'})
        self.assertEqual([(row['code'], row['count'], 'פחות שאלות' in row['note']) for row in outcome['result']['reviewFindings']],
                         [('SHORTER_SHEET', 5, True)])

    def test_a_salvaged_shorter_sheet_that_the_prepass_shortens_below_three_quarters_fails(self):
        lesson, reply = self.order_of_twenty()
        reply['practice'][0]['intro'] = BAD_NOTATION
        transport = Scripted(reply)                                                     # the correction gets no answer
        outcome, sheets = self.run_job(transport, lesson)
        # Question 1 was dropped: nineteen of twenty may be delivered. On the nineteen left the pre-pass named
        # questions 3, 6, 12, 16 and 19 (questions 4, 7, 13, 17 and 20 of the draft). No reserve and no further
        # correction: fourteen of twenty would remain, below three quarters.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[1]['required'], ['q1'])
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [3, 6, 12, 16, 19], 'codes': ['G32', 'G61', 'G62']}])
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(1, 'practice', ['SOURCE_NOTATION'], 'source', 'dropped'),
                          (4, 'practice', ['G32', 'G61'], 'precheck', 'missing'), (7, 'practice', ['G32'], 'precheck', 'missing'),
                          (13, 'practice', ['G62'], 'precheck', 'missing'), (17, 'practice', ['G62'], 'precheck', 'missing'),
                          (20, 'challenges', ['G61'], 'precheck', 'missing')])
        self.assertTrue(outcome['ladder']['correctionFailed'])
        self.assertEqual(outcome['ladder']['attempts'], 1)   # a provider that did not answer is not asked for a second draft

    def test_below_three_quarters_the_sheet_fails_and_names_its_first_refusal(self):
        reply = copy.deepcopy(self.base)
        for index in (0, 2, 4, 6):                                                      # eight of twelve would remain
            reply['practice'][index]['intro'] = BAD_NOTATION
        transport = Scripted(reply)
        outcome, sheets = self.run_job(transport)
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('SOURCE_NOTATION', [], []))
        self.assertEqual(len(transport.calls), 2)

    # ------------------------------------------------------------------ a second full attempt

    def test_a_first_reply_that_is_not_json_gets_exactly_one_second_attempt(self):
        transport = Scripted('{"title": "סדר פעולות", "rule": "כלל" ]', self.reply())
        outcome, sheets = self.run_job(transport)
        # The second draft is the reply with three reserves: the first pre-pass refuses the printed task of 9, which
        # takes a reserve; the second names 4, 8 and 12 (G32) and 4 and 10 (G61); reserves take 4 and 10, and one
        # correction, which gets no answer, asks for 8 and 12. Ten of twelve is below the grade 4 minimum of twelve:
        # nothing is rendered.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[2]['required'], ['q12', 'q8'])
        self.assertEqual(outcome['author']['firstPass']['code'], 'PROVIDER_INVALID_RESPONSE')
        self.assertEqual((outcome['ladder']['attempts'], outcome['ladder']['corrections']), (2, 1))
        self.assertEqual(outcome['ladder']['firstCode'], 'PROVIDER_INVALID_RESPONSE')
        # The lease is confirmed again before the second draft and before the correction.
        self.assertEqual(outcome['phases'].count('authoring'), 3)
        # A second draft that is the clean sheet (clean_sheet) with the same three reserves: they take the two
        # questions the pre-pass names (G61) and it is delivered whole, with no correction.
        transport = Scripted('{"title": "סדר פעולות", "rule": "כלל" ]', self.clean())
        outcome, sheets = self.run_job(transport)
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'skill_worksheet_content'])
        self.assertEqual(outcome['author']['firstPass']['code'], 'PROVIDER_INVALID_RESPONSE')
        self.assertEqual((outcome['result']['salvage']['attempts'], outcome['result']['salvage']['corrections']), (2, 0))
        self.assertEqual(outcome['ladder']['firstCode'], 'PROVIDER_INVALID_RESPONSE')
        self.assertEqual(len(self.printed(sheets[0])), 12)
        self.assertEqual(outcome['phases'].count('authoring'), 2)

    def test_a_reply_of_the_wrong_shape_or_below_the_minimum_gets_one_second_attempt_and_no_third(self):
        wrong_shape = {'title': 'כותרת', 'rule': 'כלל', 'practice': {'q1': {}}, 'challenges': []}
        too_few = copy.deepcopy(self.base)
        for question in too_few['practice'][:5]:
            question['intro'] = BAD_NOTATION
        for first in (wrong_shape, too_few):
            with self.subTest(first=sorted(first)):
                transport = Scripted(first, GenerationError('PROVIDER_UNAVAILABLE', 'x') if first is too_few else self.reply(),
                                     self.reply(), self.reply())
                outcome, sheets = self.run_job(transport)
                if first is wrong_shape:
                    # The second draft, then one correction for questions 8 and 12, the G32 questions no reserve was
                    # left for once 9 (its printed task refused) took one. It gets no answer, and ten of twelve is
                    # below the grade 4 minimum: no third draft follows.
                    self.assertFalse(outcome['delivered'])
                    self.assertEqual((outcome['code'], len(transport.replies)), ('QUALITY_GATE_FAILED', 1))
                    self.assertEqual((transport.names(), transport.calls[2]['required']),
                                     (['skill_worksheet_content', 'skill_worksheet_content', 'revise_skill_questions'], ['q12', 'q8']))
                else:
                    # The failed correction closed the job: no second draft is requested.
                    self.assertFalse(outcome['delivered'])
                    self.assertEqual((len(transport.calls), outcome['code']), (2, 'SOURCE_NOTATION'))
        # A second draft that is the clean sheet with the same three reserves is delivered whole, with no correction
        # and no third draft.
        transport = Scripted(wrong_shape, self.clean(), self.clean())
        outcome, sheets = self.run_job(transport)
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual((transport.names(), len(transport.replies), len(self.printed(sheets[0]))),
                         (['skill_worksheet_content', 'skill_worksheet_content'], 1, 12))
        # Two unusable drafts: the job ends after the second one.
        transport = Scripted(wrong_shape, wrong_shape, self.reply())
        outcome, _ = self.run_job(transport)
        self.assertFalse(outcome['delivered'])
        self.assertEqual((len(transport.calls), outcome['code'], outcome['ladder']['firstCode']),
                         (2, 'AUTHOR_PLAN_MISMATCH', 'AUTHOR_PLAN_MISMATCH'))

    # ------------------------------------------------------------------ limits

    def test_the_limits_hold_two_author_calls_and_two_corrections(self):
        bad = copy.deepcopy(self.base)
        for question in bad['practice'][:5]:
            question['intro'] = BAD_NOTATION
        worse = {f'q{n}': copy.deepcopy(bad['practice'][0]) for n in range(1, 6)}       # corrections that fix nothing
        transport = Scripted(bad, worse, bad, worse, self.reply(), self.reply())
        outcome, sheets = self.run_job(transport)
        self.assertFalse(outcome['delivered'])
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions',
                                             'skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual((outcome['ladder']['attempts'], outcome['ladder']['corrections']), (2, 2))
        self.assertEqual((sheets, outcome['uploads'], outcome['code']), ([], [], 'SOURCE_NOTATION'))
        self.assertEqual(len(transport.replies), 2)   # the good drafts were never asked for

    def test_no_model_call_starts_after_the_window(self):
        bad = copy.deepcopy(self.base)
        for question in bad['practice'][:5]:
            question['intro'] = BAD_NOTATION
        with patch.object(remote_worker, 'MODEL_CALL_WINDOW', 0):
            transport = Scripted(bad, self.reply(), self.reply())
            outcome, _ = self.run_job(transport)
            self.assertFalse(outcome['delivered'])
            self.assertEqual(len(transport.calls), 1)                                   # neither correction nor second draft
            # The reply with reserves needs one further call, a correction for questions 8 and 12 (G32) once reserves
            # took 9 (its printed task refused), 4 and 10: no call starts, and ten of twelve is below the grade 4
            # minimum: nothing is rendered.
            transport = Scripted(self.reply())
            outcome, sheets = self.run_job(transport)
            self.assertFalse(outcome['delivered'])
            self.assertEqual((outcome['code'], sheets, len(transport.calls)), ('QUALITY_GATE_FAILED', [], 1))
            self.assertEqual((outcome['ladder']['corrections'], outcome['ladder']['attemptRecords'][0]['missing']), (0, 2))
            # The clean sheet with the same three reserves needs no further call: reserves take the two questions the
            # pre-pass names (G61) and the whole sheet is delivered.
            transport = Scripted(self.clean())
            outcome, _ = self.run_job(transport)
            self.assertTrue(outcome['delivered'], outcome.get('code'))
            self.assertEqual(len(transport.calls), 1)
            salvage = outcome['result']['salvage']
            self.assertEqual((salvage['corrections'], salvage['printedQuestions'], salvage['dropped']),
                             (0, 12, {'count': 0, 'codes': {}}))

    # ------------------------------------------------------------------ an opening sheet

    def test_an_opening_sheet_is_accepted_on_the_general_path(self):
        lesson = {**self.lesson, 'lessonGoal': 'introduce',
                  'lastLesson': 'היום מתחילים ללמוד את סדר פעולות החשבון; עד כה תרגלנו כל פעולה בנפרד.'}
        validate_lesson(lesson)
        transport = Scripted(self.reply())
        outcome, sheets = self.run_job(transport, lesson)
        # Questions 8 and 12 (G32) had no reserve left once 9 (its printed task refused) took one, and their
        # correction got no answer; ten of twelve is below the grade 4 minimum of twelve, so nothing is rendered.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['author']['contract'], outcome['code'], sheets), ('worksheet-source/4', 'QUALITY_GATE_FAILED', []))
        # The clean sheet with the same three reserves is delivered whole as an opening sheet.
        whole = Scripted(self.clean())
        outcome, sheets = self.run_job(whole, lesson)
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual((outcome['author']['contract'], len(self.printed(sheets[0]))), ('worksheet-source/4', 12))
        self.assertIn('This is an opening sheet', whole.bodies[0]['messages'][0]['content'])
        sent, system = transport.sent(0), transport.bodies[0]['messages'][0]['content']
        self.assertIn('This is an opening sheet', system)
        self.assertEqual(sent['authoringContext']['teacherContext']['lessonGoal'], 'introduce')
        roles = [row.get('role') for row in sent['questionPlan']]
        self.assertEqual(roles, ['guided_entry'] * 3 + [None] * 9)                      # the first quarter of the nine ordinary questions
        self.assertTrue(all('step' in row['activity'] or 'idea' in row['activity'] for row in sent['questionPlan'][:3]))
        # A practice sheet states no goal and marks no entry question.
        practice = Scripted(self.reply())
        self.run_job(practice)
        self.assertNotIn('opening sheet', practice.bodies[0]['messages'][0]['content'])
        self.assertFalse(any('role' in row for row in practice.sent(0)['questionPlan']))
        # The worker advertises it; an assessment and the legacy adapters stay as they were.
        self.assertEqual(capabilities()['unsupported'], ['assessment'])
        for refused in ({**lesson, 'lessonGoal': 'assessment'},
                        {**json.loads((HERE / 'examples/elementary-lesson.json').read_text(encoding='utf-8')), 'version': 2,
                         'lessonGoal': 'introduce',
                         'lessonBoundary': {'version': 1, 'kind': 'division_facts', 'allowedDivisors': list(range(1, 11)), 'maxDividend': 100}}):
            with self.assertRaises(GenerationError) as error:
                validate_lesson(refused)
            self.assertEqual(error.exception.code, 'UNSUPPORTED_GOAL')


class DraftTests(unittest.TestCase):
    """The general author's reply handling: reserves in the request, the draft, the salvaged count."""

    @classmethod
    def setUpClass(cls):
        cls.lesson = json.loads((CORPUS / 'lessons/g4-order-practice.json').read_text(encoding='utf-8'))
        cls.base = strict_spelling(json.loads((CORPUS / 'replies/S-g4calc.json').read_text(encoding='utf-8')))
        cls.pool = json.loads((CORPUS / 'replies/G-order.json').read_text(encoding='utf-8'))

    def author(self, reply, *, session=None):
        """The general author on one reply, with no skill documents and no network."""
        import general_provider
        from runtime_catalog import scope_for_lesson
        measured = {}
        session = {} if session is None else session
        with patch('provider.request_author_json', return_value=copy.deepcopy(reply)):
            try:
                payload = general_provider.author_general_lesson(
                    self.lesson, metadata=measured, revision=session, api_key='k', model='m',
                    base_url='https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                    authoring_context={'scope': scope_for_lesson(self.lesson)})
            except GenerationError as error:
                return None, error, session, measured
        return payload, None, session, measured

    def reserve(self, group, index=0):
        return {'group': group, 'conceptId': 'ד07#0', 'question': copy.deepcopy(self.pool[group][index])}

    def test_plan_and_schema_ask_for_reserves_by_sheet_size_and_goal(self):
        from runtime_catalog import scope_for_lesson
        from skill_authoring import question_plan, reserve_plan, worksheet_schema
        scope = scope_for_lesson(self.lesson)
        for count, reserves in ((12, 3), (15, 3), (16, 4), (23, 4), (24, 5), (30, 5)):
            lesson = {**self.lesson, 'questionCount': count}
            rows = reserve_plan(lesson, scope)
            self.assertEqual([row['group'] for row in rows], ['practice'] * (reserves - 1) + ['challenges'])
            self.assertEqual([row['reserveNumber'] for row in rows], list(range(1, reserves + 1)))
            schema = worksheet_schema(lesson, scope)
            self.assertEqual((schema['properties']['reserves']['minItems'], schema['properties']['reserves']['maxItems']),
                             (reserves, reserves))
            self.assertEqual((schema['properties']['practice']['minItems'], schema['properties']['challenges']['minItems']),
                             (count - 3, 3))
        # The goal changes the plan in one respect: the opening questions of an introductory sheet.
        plain = question_plan(self.lesson, scope)
        opening = question_plan({**self.lesson, 'lessonGoal': 'introduce'}, scope)
        self.assertEqual([{k: v for k, v in row.items() if k != 'role'} for row in opening], plain)
        self.assertEqual([row.get('role') for row in opening], ['guided_entry'] * 3 + [None] * 9)
        self.assertEqual(sum('role' in row for row in question_plan({**self.lesson, 'lessonGoal': 'introduce', 'questionCount': 30}, scope)), 7)
        # A salvaged sheet that lost a challenge plans two.
        self.assertEqual([row['group'] for row in question_plan(self.lesson, scope, challenges=2)], ['practice'] * 10 + ['challenges'] * 2)

    def test_reserves_are_optional_and_a_malformed_reserve_costs_only_itself(self):
        from skill_authoring import split_reserves
        self.assertEqual(split_reserves(self.base), (self.base, [], 0))
        good = self.reserve('practice')
        reply = {**copy.deepcopy(self.base), 'reserves': [
            good, {'group': 'bonus', 'question': good['question']}, 'text', {'group': 'practice'},
            {'group': 'challenge', 'question': copy.deepcopy(self.pool['challenges'][0]), 'note': 'extra field'}]}
        flat, usable, dropped = split_reserves(reply)
        self.assertEqual((set(flat), dropped), ({'title', 'rule', 'practice', 'challenges'}, 3))
        self.assertEqual([(row['group'], row['concepts']) for row in usable], [('practice', ('ד07#0',)), ('challenges', ())])
        payload, error, session, measured = self.author(reply)
        self.assertIsNone(error)
        self.assertEqual(measured['reserves'], {'offered': 2, 'dropped': 3})
        self.assertEqual(len(payload['sections'][0]['questions']), 12)
        # Reserves that are not a list at all cost nothing either.
        self.assertIsNone(self.author({**copy.deepcopy(self.base), 'reserves': 'none'})[1])
        # A reserve that repeats a planned question word for word is never offered: it would print that question twice.
        repeated = copy.deepcopy(self.base)
        repeated['reserves'] = [{'group': 'practice', 'conceptId': 'ד07#0', 'question': copy.deepcopy(repeated['practice'][0])}]
        repeated['practice'][3]['intro'] = BAD_NOTATION
        payload, error, session, measured = self.author(repeated)
        self.assertEqual((error.code, session['draft'].missing(), measured['reserves']), ('SOURCE_NOTATION', [4], {'offered': 1, 'dropped': 1}))

    def test_a_practice_reserve_stands_in_for_one_challenge_and_the_sheet_prints_two_stars(self):
        reply = {**copy.deepcopy(self.base), 'reserves': [self.reserve('practice')]}
        reply['challenges'][0]['intro'] = BAD_NOTATION
        payload, error, session, _ = self.author(reply)
        self.assertIsNone(error)
        questions = payload['sections'][0]['questions']
        self.assertEqual([q['star'] for q in questions], [False] * 10 + [True] * 2)
        self.assertEqual(session['draft'].report()['replaced'], 1)
        # With a second challenge bad, one real challenge is left: no stand-in, and the sheet cannot be shortened.
        reply['challenges'][1]['intro'] = BAD_NOTATION
        payload, error, session, _ = self.author(reply)
        self.assertEqual((error.code, session['draft'].missing(), session['draft'].shorten()), ('SOURCE_NOTATION', [10, 11], False))

    def test_too_few_questions_leave_positions_for_reserves_and_extra_ones_become_reserves(self):
        from general_source import GeneralSourceError
        reply = copy.deepcopy(self.base)
        reply['practice'] = reply['practice'][:8] + [copy.deepcopy(self.pool['practice'][0])][:0]   # one short
        payload, error, session, _ = self.author(reply)
        self.assertEqual((error.code, session['draft'].missing()), ('AUTHOR_PLAN_MISMATCH', [9]))
        # Eleven of twelve is below the grade 4 minimum of twelve: the sheet is not shortened and stays refused.
        self.assertFalse(session['draft'].shorten())
        self.assertEqual((session['draft'].missing(), session['draft'].report()['dropped']), ([9], 0))
        with self.assertRaises(GeneralSourceError) as refused:
            session['draft'].source()
        self.assertEqual((refused.exception.code, refused.exception.question), ('AUTHOR_PLAN_MISMATCH', 9))
        self.assertEqual(session['draft'].lesson['questionCount'], 12)
        reply['reserves'] = [self.reserve('practice')]
        payload, error, _, _ = self.author(reply)
        self.assertIsNone(error)
        self.assertEqual(len(payload['sections'][0]['questions']), 12)
        # One practice question too many: it stands by and replaces a bad one.
        reply = copy.deepcopy(self.base)
        reply['practice'].append(copy.deepcopy(self.pool['practice'][1]))
        reply['practice'][4]['intro'] = BAD_NOTATION
        payload, error, session, _ = self.author(reply)
        self.assertIsNone(error)
        self.assertEqual((len(payload['sections'][0]['questions']), session['draft'].report()['byReserve']), (12, 1))

    def test_a_question_that_points_at_another_question_is_refused_only_on_a_changed_sheet(self):
        pointing = copy.deepcopy(self.base)
        pointing['practice'][6]['intro'] = 'היעזרו בתוצאות של שאלה [[2]] וחשבו:'
        payload, error, _, _ = self.author(pointing)
        self.assertIsNone(error)                                                        # the sheet as authored keeps its numbers
        changed = copy.deepcopy(pointing)
        changed['practice'][1]['intro'] = BAD_NOTATION
        changed['reserves'] = [self.reserve('practice', 0), self.reserve('practice', 1)]
        payload, error, session, _ = self.author(changed)
        self.assertIsNone(error)
        events = [(e['question'], e['codes'], e['action']) for e in session['draft'].selection.record]
        self.assertEqual(events, [(2, ['SOURCE_NOTATION'], 'reserve'), (7, ['QUESTION_REFERENCE'], 'reserve')])
        self.assertNotIn('שאלה', json.dumps([q['intro'] for q in payload['sections'][0]['questions']], ensure_ascii=False))
        # Without a second reserve the pointing question is missing and the job reports the gate failure.
        changed['reserves'] = changed['reserves'][:1]
        payload, error, session, _ = self.author(changed)
        self.assertEqual((error.code, session['draft'].missing()), ('QUALITY_GATE_FAILED', [7]))

    def test_a_refusal_of_the_kernel_itself_fails_the_job_with_its_code_never_as_a_raw_error(self):
        import general_provider
        from runtime_catalog import scope_for_lesson
        lesson = json.loads((CORPUS / 'lessons/g7-equations-practice.json').read_text(encoding='utf-8'))
        reply = json.loads((CORPUS / 'replies/S-g7eq.json').read_text(encoding='utf-8'))
        reply['practice'][0]['items'][0]['answer'] = computed('x+1')                    # evaluate needs a number
        session = {}
        with patch('provider.request_author_json', return_value=reply), self.assertRaises(GenerationError) as error:
            general_provider.author_general_lesson(
                lesson, metadata={}, revision=session, api_key='k', model='m',
                base_url='https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                authoring_context={'scope': scope_for_lesson(lesson)})
        self.assertEqual((error.exception.code, session['draft'].missing()), ('UNSUPPORTED_TASK', [1]))
        self.assertIn('The exact checker cannot compute', session['draft']._feedback(session['draft'].selection.slot(1))[0])

    def test_a_shorter_sheet_is_valid_only_through_the_worker_within_three_quarters_and_the_grade_minimum(self):
        from validation import salvaged_count
        lesson = self.lesson                                                            # grade 4: at least twelve
        g7 = json.loads((CORPUS / 'lessons/g7-equations-practice.json').read_text(encoding='utf-8'))   # at least twenty
        # Requested above the grade minimum: the shortest sheet is three quarters or the minimum, whichever is larger.
        for base, requested, shortest in ((lesson, 14, 12), (lesson, 16, 12), (lesson, 20, 15), (lesson, 24, 18),
                                          (g7, 24, 20)):
            for count in range(shortest, requested):
                validate_lesson({**base, 'questionCount': count}, salvaged_from=requested)
            with self.subTest(grade=base['gradeNumber'], requested=requested), self.assertRaises(GenerationError) as error:
                validate_lesson({**base, 'questionCount': shortest - 1}, salvaged_from=requested)
            self.assertEqual(error.exception.code, 'UNSUPPORTED_SHORT_SHEET')
        # Requested at the grade minimum: never shortened. Nine to eleven of twelve in grade 4, and fifteen to
        # nineteen of twenty in grade 7, keep three quarters but not the minimum.
        for base, requested in ((lesson, 12), (g7, 20)):
            for count in range(4, requested + 2):
                with self.subTest(grade=base['gradeNumber'], count=count), self.assertRaises(GenerationError) as error:
                    validate_lesson({**base, 'questionCount': count}, salvaged_from=requested)
                self.assertEqual(error.exception.code, 'UNSUPPORTED_SHORT_SHEET')
        self.assertEqual([salvaged_count(12, printed, grade) for printed, grade in ((9, 2), (8, 2), (11, 2), (11, 3), (11, 4))],
                         [True, False, True, False, False])
        self.assertEqual([salvaged_count(24, printed, 7) for printed in (18, 19, 20, 23, 24)], [False, False, True, True, False])
        for grade in (None, True, '4', 4.0):
            self.assertFalse(salvaged_count(12, 11, grade))
        for count, salvaged in ((8, 12), (12, 12), (13, 12), (5, 8), (11, 40)):
            with self.subTest(count=count, salvaged=salvaged), self.assertRaises(GenerationError):
                validate_lesson({**lesson, 'questionCount': count}, salvaged_from=salvaged)
        # Without the worker's own statement a count below the floor is refused as before.
        with self.assertRaises(GenerationError) as error:
            validate_lesson({**lesson, 'questionCount': 11})
        self.assertEqual(error.exception.code, 'UNSUPPORTED_VOLUME')
        # A legacy lesson is never salvaged, and a job cannot carry the statement in its JSON.
        legacy = {**json.loads((HERE / 'examples/elementary-lesson.json').read_text(encoding='utf-8')), 'version': 2,
                  'lessonBoundary': {'version': 1, 'kind': 'division_facts', 'allowedDivisors': list(range(1, 11)), 'maxDividend': 100}}
        with self.assertRaises(GenerationError):
            validate_lesson({**legacy, 'questionCount': legacy['questionCount'] - 1}, salvaged_from=legacy['questionCount'])
        with self.assertRaises(GenerationError):
            validate_lesson({**lesson, 'questionCount': 11, 'salvaged_from': 12, 'salvagedFrom': 12})

    def test_a_shorter_sheet_prints_only_a_count_that_the_topic_allows(self):
        import validation
        real = validation.capability
        # A topic whose allowed counts have gaps: sixteen may be requested; fifteen and thirteen keep three quarters
        # and the grade 4 minimum but are no count of the topic, so they are refused like a request of that size.
        gapped = lambda lesson: {**real(lesson), 'questionCounts': [12, 16, 20]}
        with patch.object(validation, 'capability', gapped):
            self.assertEqual(validate_lesson({**self.lesson, 'questionCount': 12}, salvaged_from=16)['skill'], 'elementary')
            for count in (13, 14, 15):
                with self.subTest(count=count), self.assertRaises(GenerationError) as error:
                    validate_lesson({**self.lesson, 'questionCount': count}, salvaged_from=16)
                self.assertEqual(error.exception.code, 'UNSUPPORTED_VOLUME')
                with self.assertRaises(GenerationError) as error:
                    validate_lesson({**self.lesson, 'questionCount': count})
                self.assertEqual(error.exception.code, 'UNSUPPORTED_VOLUME')
        # The real grade 4 counts run from the minimum to thirty without a gap: every count from twelve is allowed.
        self.assertEqual(real(self.lesson)['questionCounts'], list(range(12, 31)))
        for count in (12, 13, 14, 15):
            validate_lesson({**self.lesson, 'questionCount': count}, salvaged_from=16)


if __name__ == '__main__':
    unittest.main()
