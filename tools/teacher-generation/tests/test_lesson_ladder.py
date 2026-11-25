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
    {'prompt': '[[999999 x 999 + 1]] = ___', 'answer': computed('999999*999+1')},
    {'prompt': '[[888888 x 999 + 1]] = ___', 'answer': computed('888888*999+1')},
    {'prompt': '[[777777 x 999 + 2]] = ___', 'answer': computed('777777*999+2')}]}


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
        cls.base = json.loads((CORPUS / 'replies/S-g4calc.json').read_text(encoding='utf-8'))
        pool = json.loads((CORPUS / 'replies/G-order.json').read_text(encoding='utf-8'))
        cls.spare = {'practice': pool['practice'], 'challenges': pool['challenges']}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def reply(self, *, practice=2, challenges=1):
        """The recorded good sheet of twelve questions with reserves from another recorded sheet."""
        reply = copy.deepcopy(self.base)
        concept = self.lesson['lessonBoundary']['conceptIds'][0]
        reply['reserves'] = ([{'group': 'practice', 'conceptId': concept, 'question': copy.deepcopy(q)}
                              for q in self.spare['practice'][:practice]]
                             + [{'group': 'challenges', 'conceptId': concept, 'question': copy.deepcopy(q)}
                                for q in self.spare['challenges'][:challenges]])
        return reply

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
        # Questions 2 and 11 took a reserve each. The pre-pass then named questions 4, 8, 10 and 12: the locked G32
        # refuses the per-unit or instruction "לכל" of 4, 8 and 12, and the printed stars put the difficulty spread
        # above the limit (G61 on 4 and 10). The last reserve took question 4; one correction asked for the other
        # three and got no answer. Without 10 and 12 one real challenge would remain, so nothing is rendered.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[1]['required'], ['q10', 'q12', 'q8'])
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [4, 8, 10, 12], 'codes': ['G32', 'G61']}])
        events = outcome['ladder']['attemptRecords'][0]['events']
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action']) for e in events],
                         [(2, 'practice', ['SOURCE_NOTATION'], 'source', 'reserve'),
                          (11, 'challenges', ['SOURCE_ITEMS'], 'source', 'reserve'),
                          (4, 'practice', ['G32', 'G61'], 'precheck', 'reserve'),
                          (8, 'practice', ['G32'], 'precheck', 'missing'),
                          (10, 'challenges', ['G61'], 'precheck', 'missing'),
                          (12, 'challenges', ['G32'], 'precheck', 'missing')])
        self.assertTrue(outcome['ladder']['correctionFailed'])
        self.assertEqual((outcome['ladder']['attempts'], outcome['ladder']['corrections']), (1, 1))

    def test_a_reply_without_reserves_still_compiles_and_one_correction_asks_for_every_named_question(self):
        transport = Scripted(copy.deepcopy(self.base))                                  # as every recorded reply
        outcome, sheets = self.run_job(transport)                                       # the correction gets no answer
        # The pre-pass named questions 4, 8, 10 and 12 (G32 on the "לכל" of 4, 8 and 12, G61 on the printed stars
        # of 4 and 10); with no reserve all four went to one correction, which got no answer. Eight of twelve would
        # remain, below three quarters: nothing is rendered.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [4, 8, 10, 12], 'codes': ['G32', 'G61']}])
        self.assertEqual((len(transport.calls), transport.calls[1]['required']), (2, ['q10', 'q12', 'q4', 'q8']))
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(4, 'practice', ['G32', 'G61'], 'precheck', 'missing'), (8, 'practice', ['G32'], 'precheck', 'missing'),
                          (10, 'challenges', ['G61'], 'precheck', 'missing'), (12, 'challenges', ['G32'], 'precheck', 'missing')])
        self.assertTrue(outcome['ladder']['correctionFailed'])
        self.assertEqual(outcome['ladder']['attempts'], 1)
        # The request asked for the reserves: three beside twelve questions, each tagged.
        schema = transport.bodies[0]['response_format']['json_schema']['schema']
        self.assertIn('reserves', schema['required'])
        self.assertEqual(schema['properties']['reserves']['minItems'], 3)
        self.assertEqual([(row['group'], row['conceptId']) for row in transport.sent(0)['reservePlan']],
                         [('practice', 'ד07#0'), ('practice', 'ד07#0'), ('challenges', 'ד07#1')])

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

        # As recorded, with no reserve: the first pre-pass refuses 4, 8 and 12 with G32 (D19), and nothing is rendered.
        with patch.object(remote_worker, 'precheck_job', recording):
            outcome, sheets = self.run_job(Scripted(copy.deepcopy(self.base)))
        self.assertEqual(rows, [[('G32', 4), ('G32', 8), ('G32', 12), ('G61', 4), ('G61', 10)]])
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        # With the three reserves: 4 and 8 take the practice reserves, 10 the challenge reserve, 12 is dropped; the
        # second pre-pass is clean and the sheet that is rendered carries none of the three questions.
        rows.clear()
        with patch.object(remote_worker, 'precheck_job', recording):
            outcome, sheets = self.run_job(Scripted(self.reply()))
        self.assertEqual(rows, [[('G32', 4), ('G32', 8), ('G32', 12), ('G61', 4), ('G61', 10)], []])
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        self.assertEqual([(e['question'], e['codes'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(4, ['G32', 'G61'], 'reserve'), (8, ['G32'], 'reserve'), (10, ['G61'], 'reserve'), (12, ['G32'], 'dropped')])
        self.assertEqual(len(sheets), 1)
        printed = json.dumps(self.printed(sheets[0]), ensure_ascii=False)
        self.assertEqual((len(self.printed(sheets[0])), printed.count('לכל')), (11, 0))

    def test_a_question_named_by_a_truth_gate_is_swapped_before_any_render_and_delivers(self):
        reply = self.reply()
        reply['practice'][2] = copy.deepcopy(OUT_OF_RANGE)
        transport = Scripted(reply)
        outcome, sheets = self.run_job(transport)
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        # In the pre-pass the pinned house gates named question 3 (G60) and the two ends of the difficulty spread,
        # questions 4 and 10 (G61 on the printed stars, which blocks like any other finding); the locked G32 named the
        # "לכל" of 4, 8 and 12. Reserves took the places of 3, 4 and 10; one correction asked for 8 and 12, got no
        # answer, and they were dropped. The second pass is clean and the shorter sheet carries its note.
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [3, 4, 8, 10, 12], 'codes': ['G32', 'G60', 'G61']},
                                                {'status': 'clean', 'questions': [], 'codes': []}])
        self.assertEqual((transport.names(), transport.calls[1]['required'], len(sheets)),
                         (['skill_worksheet_content', 'revise_skill_questions'], ['q12', 'q8'], 1))   # one render
        questions = self.printed(sheets[0])
        self.assertEqual((sheets[0]['count'], len(questions), sheets[0]['salvagedFrom']), (10, 10, 12))
        self.assertEqual([q['star'] for q in questions], [False] * 8 + [True] * 2)
        self.assertNotIn('999999', json.dumps(questions, ensure_ascii=False))
        self.assertNotIn('לכל', json.dumps(questions, ensure_ascii=False))
        salvage = outcome['result']['salvage']
        self.assertEqual(salvage, {'attempts': 1, 'corrections': 1, 'requestedQuestions': 12, 'printedQuestions': 10,
                                   'replaced': {'count': 3, 'codes': {'G32': 1, 'G60': 1, 'G61': 2}},
                                   'dropped': {'count': 2, 'codes': {'G32': 2}}, 'gate': 'deliver'})
        self.assertEqual([(e['question'], e['codes'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(3, ['G60'], 'precheck', 'reserve'), (4, ['G32', 'G61'], 'precheck', 'reserve'),
                          (8, ['G32'], 'precheck', 'dropped'), (10, ['G61'], 'precheck', 'reserve'),
                          (12, ['G32'], 'precheck', 'dropped')])
        self.assertEqual([(row['code'], row['count'], 'פחות שאלות' in row['note']) for row in outcome['result']['reviewFindings']],
                         [('SHORTER_SHEET', 2, True)])

    # ------------------------------------------------------------------ one correction

    def test_reserves_exhausted_asks_a_correction_for_the_deficit_only(self):
        reply = self.reply(practice=1, challenges=0)
        for index in (1, 4):
            reply['practice'][index]['intro'] = BAD_NOTATION
        fixed = copy.deepcopy(self.spare['practice'][5])
        transport = Scripted(reply, {'q5': fixed})                                      # the second correction gets no answer
        outcome, sheets = self.run_job(transport)
        # Question 2 took the one reserve; only question 5 was left to the model. The pre-pass then named questions
        # 4, 8, 10 and 12 (G32 on the "לכל" of 4, 8 and 12, G61 on the printed stars of 4 and 10), with no reserve
        # left: a second correction asked for exactly those four, got no answer, and eight of twelve would remain.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions', 'revise_skill_questions'])
        self.assertEqual((transport.calls[1]['required'], transport.calls[2]['required']), (['q5'], ['q10', 'q12', 'q4', 'q8']))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [4, 8, 10, 12], 'codes': ['G32', 'G61']}])
        asked = transport.sent(1)['questionsToCorrect']
        self.assertEqual([(row['question'], row['plan']['questionNumber'], row['plan']['group']) for row in asked], [(5, 5, 'practice')])
        self.assertEqual(asked[0]['original']['intro'], BAD_NOTATION)
        # The exact field and substring, then the fixed instruction of the code.
        self.assertTrue(asked[0]['findings'][0].startswith('Check intro at «[[4 @ 2]]». '), asked[0]['findings'][0][:80])
        self.assertIn('ENTIRE expression in one math span', asked[0]['findings'][0])
        self.assertEqual([(row['question'], row['plan']['group']) for row in transport.sent(2)['questionsToCorrect']],
                         [(4, 'practice'), (8, 'practice'), (10, 'challenges'), (12, 'challenges')])
        self.assertEqual((outcome['ladder']['attempts'], outcome['ladder']['corrections'], outcome['ladder']['correctionFailed']),
                         (1, 2, True))
        self.assertEqual([(e['question'], e['codes'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(2, ['SOURCE_NOTATION'], 'source', 'reserve'), (5, ['SOURCE_NOTATION'], 'source', 'correction'),
                          (4, ['G32', 'G61'], 'precheck', 'missing'), (8, ['G32'], 'precheck', 'missing'),
                          (10, ['G61'], 'precheck', 'missing'), (12, ['G32'], 'precheck', 'missing')])

    def test_a_correction_also_serves_a_kernel_code_and_a_refused_correction_drops_its_question(self):
        reply = copy.deepcopy(self.base)
        reply['practice'][3]['items'][0]['answer'] = computed('2^13')                   # a kernel code: UNSUPPORTED_POWER
        still_bad = copy.deepcopy(reply['practice'][3])
        transport = Scripted(reply, {'q4': still_bad})
        outcome, sheets = self.run_job(transport)
        finding = transport.sent(1)['questionsToCorrect'][0]['findings'][0]
        self.assertIn('The exact checker cannot compute this typed task', finding)
        self.assertIn('item.1', finding)
        # The corrected question was examined like any other and refused again: it is dropped, never printed.
        # On the eleven questions left the pre-pass named questions 2, 7, 9 and 11 (questions 2, 8, 10 and 12 of the
        # draft: G32 on the "לכל" of 8 and 12, G61 on the printed stars of 2 and 10); their correction got no answer,
        # and seven of twelve would remain: nothing is rendered.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [2, 7, 9, 11], 'codes': ['G32', 'G61']}])
        self.assertEqual((len(transport.calls), transport.calls[1]['required'], transport.calls[2]['required']),
                         (3, ['q4'], ['q10', 'q12', 'q2', 'q8']))
        self.assertEqual([(e['question'], e['codes'], e['stage'], e['action']) for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(4, ['UNSUPPORTED_POWER'], 'source', 'dropped'), (2, ['G61'], 'precheck', 'missing'),
                          (8, ['G32'], 'precheck', 'missing'), (10, ['G61'], 'precheck', 'missing'),
                          (12, ['G32'], 'precheck', 'missing')])

    # ------------------------------------------------------------------ a shorter sheet

    def test_a_salvaged_shorter_sheet_that_the_prepass_shortens_below_three_quarters_fails(self):
        reply = copy.deepcopy(self.base)
        for index in (0, 6):
            reply['practice'][index]['intro'] = BAD_NOTATION
        transport = Scripted(reply)                                                     # the correction gets no answer
        outcome, sheets = self.run_job(transport)
        # Questions 1 and 7 were dropped. On the ten left the pre-pass named questions 3, 6, 8 and 10 (questions 4, 8,
        # 10 and 12 of the draft: G32 on the "לכל" of 4, 8 and 12, G61 on the printed stars of 4 and 10). No reserve
        # and no further correction: six of twelve would remain.
        self.assertFalse(outcome['delivered'])
        self.assertEqual((outcome['code'], sheets, outcome['uploads']), ('QUALITY_GATE_FAILED', [], []))
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[1]['required'], ['q1', 'q7'])
        self.assertEqual(outcome['prechecks'], [{'status': 'replace', 'questions': [3, 6, 8, 10], 'codes': ['G32', 'G61']}])
        self.assertEqual([(e['question'], e['group'], e['codes'], e['stage'], e['action'])
                          for e in outcome['ladder']['attemptRecords'][0]['events']],
                         [(1, 'practice', ['SOURCE_NOTATION'], 'source', 'dropped'),
                          (7, 'practice', ['SOURCE_NOTATION'], 'source', 'dropped'),
                          (4, 'practice', ['G32', 'G61'], 'precheck', 'missing'),
                          (8, 'practice', ['G32'], 'precheck', 'missing'),
                          (10, 'challenges', ['G61'], 'precheck', 'missing'),
                          (12, 'challenges', ['G32'], 'precheck', 'missing')])
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
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        # The second draft is the reply with three reserves: the pre-pass names 4, 8 and 12 (G32) and 4 and 10 (G61);
        # reserves take 4, 8 and 10, and one correction, which gets no answer, asks for 12.
        self.assertEqual(transport.names(), ['skill_worksheet_content', 'skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(transport.calls[2]['required'], ['q12'])
        self.assertEqual(outcome['author']['firstPass']['code'], 'PROVIDER_INVALID_RESPONSE')
        self.assertEqual((outcome['result']['salvage']['attempts'], outcome['result']['salvage']['corrections']), (2, 1))
        self.assertEqual(outcome['ladder']['firstCode'], 'PROVIDER_INVALID_RESPONSE')
        self.assertEqual(len(self.printed(sheets[0])), 11)
        # The lease is confirmed again before the second draft and before the correction.
        self.assertEqual(outcome['phases'].count('authoring'), 3)

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
                    self.assertTrue(outcome['delivered'], outcome.get('code'))
                    # The second draft, then one correction for question 12, the one G32 question no reserve was left for.
                    self.assertEqual((transport.names(), transport.calls[2]['required']),
                                     (['skill_worksheet_content', 'skill_worksheet_content', 'revise_skill_questions'], ['q12']))
                else:
                    # The failed correction closed the job: no second draft is requested.
                    self.assertFalse(outcome['delivered'])
                    self.assertEqual((len(transport.calls), outcome['code']), (2, 'SOURCE_NOTATION'))
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
            # The reply with reserves needs one further call, a correction for question 12 (G32) once reserves took
            # 4, 8 and 10: no call starts, the question is dropped and the shorter sheet is delivered.
            transport = Scripted(self.reply())
            outcome, _ = self.run_job(transport)
            self.assertTrue(outcome['delivered'], outcome.get('code'))
            self.assertEqual(len(transport.calls), 1)
            salvage = outcome['result']['salvage']
            self.assertEqual((salvage['corrections'], salvage['printedQuestions'], salvage['dropped']),
                             (0, 11, {'count': 1, 'codes': {'G32': 1}}))

    # ------------------------------------------------------------------ an opening sheet

    def test_an_opening_sheet_is_accepted_on_the_general_path(self):
        lesson = {**self.lesson, 'lessonGoal': 'introduce',
                  'lastLesson': 'היום מתחילים ללמוד את סדר פעולות החשבון; עד כה תרגלנו כל פעולה בנפרד.'}
        validate_lesson(lesson)
        transport = Scripted(self.reply())
        outcome, sheets = self.run_job(transport, lesson)
        self.assertTrue(outcome['delivered'], outcome.get('code'))
        # Eleven of twelve: question 12 (G32) had no reserve left and its correction got no answer.
        self.assertEqual((outcome['author']['contract'], len(self.printed(sheets[0]))), ('worksheet-source/4', 11))
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
        cls.base = json.loads((CORPUS / 'replies/S-g4calc.json').read_text(encoding='utf-8'))
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
        reply = copy.deepcopy(self.base)
        reply['practice'] = reply['practice'][:8] + [copy.deepcopy(self.pool['practice'][0])][:0]   # one short
        payload, error, session, _ = self.author(reply)
        self.assertEqual((error.code, session['draft'].missing()), ('AUTHOR_PLAN_MISMATCH', [9]))
        self.assertTrue(session['draft'].shorten())                                     # eleven of twelve may be delivered
        self.assertEqual(session['draft'].lesson['questionCount'], 12)                  # the count changes with the sheet
        self.assertEqual(len(session['draft'].source()['sections'][0]['questions']), 11)
        self.assertEqual(session['draft'].lesson['questionCount'], 11)
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

    def test_a_shorter_sheet_is_valid_only_through_the_worker_and_only_within_three_quarters(self):
        lesson = self.lesson
        for count in (9, 10, 11):
            validate_lesson({**lesson, 'questionCount': count}, salvaged_from=12)
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


if __name__ == '__main__':
    unittest.main()
