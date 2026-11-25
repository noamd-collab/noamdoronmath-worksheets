"""The causes of refusal found in the first live round, each on its recorded reply.

Every test reads a question exactly as the model wrote it in live round 1
(bench/corpus, cases L1-*) and sends it through the engine's real compile
path (bench/isolate.Isolator.check: the question alone on a four-question
sheet). No model call, no network.
"""
from __future__ import annotations

from contextlib import ExitStack
from copy import deepcopy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bench import engine, isolate  # noqa: E402

CORPUS = HERE / 'bench/corpus'
CASES = {case['id']: case for case in json.loads((CORPUS / 'index.json').read_text(encoding='utf-8'))['cases']}


def lesson_of(case_id):
    case = CASES[case_id]
    lesson = json.loads((CORPUS / case['lesson']).read_text(encoding='utf-8'))
    return {**lesson, 'lessonGoal': case['lessonGoal']['replayedAs']}


def reply_of(case_id, correction=None):
    case = CASES[case_id]
    name = case['firstReply'] if correction is None else case['corrections'][correction - 1]
    name = name['reply'] if isinstance(name, dict) else name
    return json.loads((CORPUS / name).read_text(encoding='utf-8'))


def salvaged(case_id, correction=None):
    """A recorded reply that is not JSON, read by the engine's own salvage."""
    from reply_salvage import salvage
    case = CASES[case_id]
    name = case['firstReply'] if correction is None else case['corrections'][correction - 1]
    name = name['reply'] if isinstance(name, dict) else name
    return salvage((CORPUS / name).read_text(encoding='utf-8'))[0]


def recorded_text(case_id, correction=None):
    case = CASES[case_id]
    name = case['firstReply'] if correction is None else case['corrections'][correction - 1]
    return (CORPUS / (name['reply'] if isinstance(name, dict) else name)).read_text(encoding='utf-8')


def question(case_id, group, number, correction=None):
    """One recorded question: practice/challenges/reserves by one-based position, or a correction key."""
    reply = reply_of(case_id, correction)
    if correction is not None:
        return deepcopy(reply[group])
    row = reply[group][number - 1]
    return deepcopy(row['question'] if group == 'reserves' else row)


class LiveCauses(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='live1-causes-')
        cls.skills = engine.skill_roots(cls.scratch)
        cls.stack = ExitStack()
        cls.stack.enter_context(engine.engine_environment(cls.skills))
        cls.refused = cls.stack.enter_context(engine.network_guard())
        cls.isolators = {}

    @classmethod
    def tearDownClass(cls):
        cls.stack.close()
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def tearDown(self):
        self.assertEqual(self.refused, [])

    def check(self, case_id, wire):
        """None when the question compiles alone, else {'code', 'detail'}."""
        if case_id not in self.isolators:
            self.isolators[case_id] = isolate.Isolator(lesson_of(case_id), self.skills)
        return self.isolators[case_id].check(wire)

    def code(self, case_id, wire):
        failure = self.check(case_id, wire)
        return None if failure is None else failure['code']

    def printed(self, case_id, wire):
        """[(pupil text, key)] of each item, as the trusted adapter prints the question."""
        isolator = self.isolators.get(case_id) or isolate.Isolator(lesson_of(case_id), self.skills)
        self.isolators[case_id] = isolator
        transport = engine.ReplyFromSchema(wire, isolator.frame['title'], isolator.frame['rule'])
        compiled = engine.compile_reply(isolator.lesson, transport, self.skills, context=isolator.context)
        self.assertTrue(compiled['ok'], compiled.get('code'))
        work = Path(tempfile.mkdtemp(dir=self.scratch))
        printed = engine.printed_questions(isolator.lesson, compiled['payload'], self.skills, work)
        self.assertTrue(printed['ok'], printed.get('code'))
        return [(item['text'], item['answer']) for item in printed['questions'][0]['items']]

    # F12: a later item may not print the key of an earlier item.

    def test_a_later_item_that_prints_an_earlier_key_is_refused(self):
        wire = question('L1-p2', 'practice', 17)
        failure = self.check('L1-p2', wire)
        self.assertEqual(failure['code'], 'PRINTED_ANSWER_LEAK')
        # Also when the earlier result is printed as a given of a later item, or as its printed calculation.
        for case_id, group, number in (('L1-p1', 'practice', 12), ('L1-p1', 'practice', 17),
                                       ('L1-p3-a2', 'challenges', 3), ('L1-p3', 'challenges', 1)):
            with self.subTest(case=case_id, group=group, number=number):
                self.assertEqual(self.code(case_id, question(case_id, group, number)), 'PRINTED_ANSWER_LEAK')

    def test_independent_drill_items_may_share_a_number_by_chance(self):
        from compact_authoring import expression
        from math_tasks import validate_and_solve_task
        from printed_parts import answer_leak
        item = lambda notation: {'prompt': [{'kind': 'text', 'text': 'המספר החסר הוא ___: '},
                                            {'kind': 'formula', 'notation': notation}]}
        solved = lambda text: validate_and_solve_task({'kind': 'evaluate', 'expression': expression(text, 4)})
        bare = {'intro': [{'kind': 'text', 'text': 'השלימו את המספר החסר.'}],
                'items': [item('___ + 4 * 3 = 17'), item('___ / 5 + 8 = 11')]}
        keys = {1: solved('17 - 4 * 3'), 2: solved('(11 - 8) * 5')}
        self.assertIsNone(answer_leak(bare, keys))
        # The same items after a story that both continue are one chain of results.
        story = {**bare, 'intro': [{'kind': 'text', 'text': 'בחנות יש 30 מחברות.'}]}
        self.assertEqual(answer_leak(story, keys), 2)

    def test_the_same_number_printed_in_the_intro_is_not_a_leak(self):
        wire = question('L1-p2', 'practice', 17)
        wire['intro'] += ' המספר החיובי הוא [[6]].'
        self.assertIsNone(self.check('L1-p2', wire))

    # F11: a figure the pinned constructors refuse is refused with its question, before the render.

    def test_a_figure_the_skill_cannot_draw_is_refused_at_selection(self):
        # A label on an axis number, even in the window two units wider; two sides that print as equal.
        for case_id, group, number in (('L1-square', 'practice', 6), ('L1-p3', 'practice', 13),
                                       ('L1-p3-a2', 'practice', 17)):
            with self.subTest(case=case_id, group=group, number=number):
                failure = self.check(case_id, question(case_id, group, number))
                self.assertEqual(failure['code'], 'SOURCE_FIGURE')
                self.assertIn('figure', failure['detail'])

    def test_a_figure_with_one_reading_is_drawn_as_that_shape(self):
        # A parallelogram with equal sides is a rhombus; a trapezoid with offset 0 is a right trapezoid;
        # a label on an axis number moves off it in a window two units wider.
        for case_id, group, number in (('L1-p1-a2', 'practice', 5), ('L1-p3-a2', 'challenges', 3),
                                       ('L1-p3', 'practice', 3), ('L1-p1', 'challenges', 2)):
            with self.subTest(case=case_id, group=group, number=number):
                wire = (salvaged(case_id)['practice'][number - 1] if case_id == 'L1-p1-a2'
                        else question(case_id, group, number))
                self.assertNotEqual(self.code(case_id, wire), 'SOURCE_FIGURE')

    def test_the_render_names_the_question_whose_figure_it_cannot_draw(self):
        import general_adapters
        from general_source import GeneralSourceError
        lesson = lesson_of('L1-square')
        wire = question('L1-square', 'practice', 6)
        with self.assertRaises(GeneralSourceError) as raised, patch.object(general_adapters, 'validate_source',
                                                                         lambda *a, **k: a[1]):
            source = {'title': 'תרגול', 'rule': [{'kind': 'text', 'text': 'פתרו.'}], 'sections': [{
                'title': 'תרגול', 'conceptIds': [], 'questions': [
                    {'intro': [{'kind': 'text', 'text': 'פתרו.'}], 'star': False, 'items': [],
                     'figure': wire['figure']}]}]}
            folder = Path(tempfile.mkdtemp(dir=self.scratch))
            (folder / 'figures').mkdir()
            general_adapters._compile_middle(lesson, source, {'computations': []}, {'topic': {}}, None, folder)
        self.assertEqual((raised.exception.code, raised.exception.question), ('SOURCE_FIGURE', 1))

    # F17: a refused rule loses its refused sentences instead of ending the attempt.

    def test_a_rule_keeps_every_sentence_that_passes_alone(self):
        from runtime_catalog import scope_for_lesson
        from skill_authoring import examine_frame, trim_rule
        lesson = lesson_of('L1-g8')
        scope = scope_for_lesson(lesson)
        rule = reply_of('L1-g8')['rule'].replace('[[p%]]', '[[p % q]]')
        self.assertEqual(examine_frame('אחוזים', rule, lesson, scope).code, 'SOURCE_NOTATION')
        trimmed = trim_rule('אחוזים', rule, lesson, scope)
        self.assertNotIn('[[p % q]]', trimmed)
        self.assertTrue(trimmed.startswith('אחוז אחד הוא מאית מתוך שלם') and trimmed.endswith('= 17]].'))
        self.assertIsNone(examine_frame('אחוזים', trimmed, lesson, scope))
        # Nothing stands when every sentence is refused.
        self.assertIsNone(trim_rule('אחוזים', '[[p % q]]. [[...]].', lesson, scope))
        # The recorded rules of round one pass as written now ([[p%]], [[%]], d1 and d2).
        for case_id in ('L1-g8', 'L1-g8-a2', 'L1-p1'):
            with self.subTest(case=case_id):
                lesson = lesson_of(case_id)
                self.assertIsNone(examine_frame('t', reply_of(case_id)['rule'], lesson, scope_for_lesson(lesson)))

    def test_a_rule_that_cannot_be_trimmed_is_asked_for_again_in_the_one_correction(self):
        from general_provider import Draft
        from runtime_catalog import scope_for_lesson
        from skill_authoring import question_plan
        lesson = lesson_of('L1-g8')
        scope = scope_for_lesson(lesson)
        reply = reply_of('L1-g8')
        asked = []

        def ask(body, observed):
            asked.append(body)
            return {'rule': 'אחוז אחד הוא מאית מתוך שלם: [[1% = frac(1,100)]].'}

        flat = {key: reply[key] for key in ('title', 'practice', 'challenges')}
        flat['rule'] = '[[p % q]].'
        draft = Draft(flat, [], lesson, scope, question_plan(lesson, scope), compile_sheet=lambda *a: None,
                      ask=ask, context={}, model='m', measured={})
        self.assertEqual(draft.rule_refusal.code, 'SOURCE_NOTATION')
        self.assertTrue(draft.needs_model())
        draft.correct()
        schema = asked[0]['response_format']['json_schema']['schema']
        self.assertIn('rule', schema['required'])
        self.assertIsNone(draft.rule_refusal)
        self.assertEqual(draft.rule, 'אחוז אחד הוא מאית מתוך שלם: [[1% = frac(1,100)]].')

    def test_the_recorded_percent_sheets_reach_a_sheet_with_no_further_author_call(self):
        from bench import replay
        # The engine now asks for fewer questions than were recorded: each recorded correction answers
        # the ones it holds (corrections='subset'). Live, both attempts ended on their rule.
        results = replay.run(CORPUS, only=('L1-g8', 'L1-g8-a2'), work=Path(tempfile.mkdtemp(dir=self.scratch)),
                             skills=self.skills, render=False, corrections='subset')
        printed = {}
        for case in results['cases']:
            with self.subTest(case=case['id']):
                self.assertEqual(case['finalStatus'], 'authored')
                self.assertEqual((case['ladder']['attempts'], case['author']['requests']),
                                 (1, 1 + case['ladder']['corrections']))
                printed[case['id']] = case['ladder']['attemptRecords'][0]['printed']
        # Attempt 1: four reserves for six refused questions, one correction for the five still missing.
        # Attempt 2: reserves only.
        self.assertEqual(printed, {'L1-g8': 20, 'L1-g8-a2': 20})

    # F1: a decide task only for a relation of printed quantities.

    def test_the_author_is_told_where_a_decide_task_has_no_form_and_asked_for_numbers(self):
        import general_provider
        import provider
        from answer_kinds import DECISION_GUIDE
        from validation import GenerationError
        sent = []

        def capture(target, key, body, metadata, timeout):
            sent.append(body)
            raise GenerationError('STOP', 'captured')

        lesson = lesson_of('L1-g7')
        with patch.object(provider, 'request_author_json', capture), self.assertRaises(GenerationError):
            general_provider.author_general_lesson(lesson, timeout=1, metadata={},
                                                   skill_paths={k: str(v) for k, v in self.skills.items()})
        system = sent[0]['messages'][0]['content']
        user = json.loads(sent[0]['messages'][1]['content'])
        self.assertIn(DECISION_GUIDE, system)
        for words in ("'always' (תמיד)", 'Never invent values', '{"kind":"computed","task":{"kind":"decide"'):
            self.assertIn(words, DECISION_GUIDE)
        activities = [row['activity'] for row in user['questionPlan'] + user['reservePlan']]
        for gone in ('classify a new example using the defining property', 'compare two proposed methods',
                     'contrast two related configurations using an explicit criterion',
                     'recognize and read the given quantities or properties', 'decide which of two given worked methods',
                     'say which of two small given cases'):
            self.assertFalse(any(gone in activity for activity in activities), gone)
        self.assertIn('carry out a given worked method on a new case and give the number that it yields', activities)
        self.assertIn('compute the defining measure of a small given case that shows the new idea', activities)

    # F3: an adjective with the article names a thing, not a relation.

    def test_the_large_base_is_not_a_second_relation(self):
        wire = question('L1-p3-a2', 'q1', None, correction=1)
        self.assertIsNone(self.check('L1-p3-a2', wire))
        text, key = self.printed('L1-p3-a2', wire)[2]
        self.assertIn('הבסיס הגדול', text)
        self.assertEqual(key, 'לא. $5 + 6 = 11$')

    # F5: an angle named inside a larger formula.

    def test_angles_inside_a_formula_compile_with_three_letter_names(self):
        for case_id, group, number in (('L1-p3', 'practice', 1), ('L1-p3', 'practice', 4), ('L1-p1', 'practice', 3),
                                       ('L1-p1', 'practice', 8), ('L1-p1', 'practice', 13), ('L1-p3-a2', 'practice', 3)):
            with self.subTest(case=case_id, group=group, number=number):
                self.assertIsNone(self.check(case_id, question(case_id, group, number)))
        rows = self.printed('L1-p3', question('L1-p3', 'practice', 1))
        self.assertIn(r'$\angle{ADC} = 70°$', rows[0][0])
        self.assertEqual(rows[0][1], '$110$ מעלות')
        rows = self.printed('L1-p3', question('L1-p3', 'practice', 4))
        self.assertIn(r'$\angle{BAD} + \angle{ABC}$', rows[2][0])

    # F8: a task letter outside x, y, a and b.

    def test_a_task_letter_of_the_question_is_solved_and_printed_with_its_own_name(self):
        rows = self.printed('L1-p2-a2', question('L1-p2-a2', 'practice', 3))
        self.assertEqual([key for _, key in rows], ['$c = 12$', '$b = 7$', '$a = 2$'])
        # The display of a product of two letters keeps both names (it printed "yx" before).
        self.assertIn('$x^{2} + bx − 18 = 0$', rows[1][0])
        self.assertIn('$ax^{2} − 5x − 12 = 0$', rows[2][0])
        rows = self.printed('L1-p2-a2', question('L1-p2-a2', 'practice', 12))
        self.assertEqual(rows[0][1], '$m = 9$')
        rows = self.printed('L1-p3-a2', question('L1-p3-a2', 'q6', None, correction=1))
        self.assertEqual(rows[0][1], '$h = 6$ ס"מ')

    def test_a_reply_cannot_name_the_printed_letter_itself(self):
        wire = question('L1-p2-a2', 'practice', 3)
        wire['items'][1]['answer']['printedVariable'] = 'q'
        rows = self.printed('L1-p2-a2', wire)
        self.assertEqual(rows[1][1], '$b = 7$')

    # F2: is a number a solution of a printed equation?

    def test_a_question_about_the_solution_of_a_printed_equation_is_decided_from_the_print(self):
        rows = self.printed('L1-g7', question('L1-g7', 'practice', 1))
        self.assertEqual([key for _, key in rows], ['כן. $5 + 7 = 12$', 'לא. $2 · 4 + 1 = 9$', 'כן. $3 · 6 − 4 = 14$'])
        rows = self.printed('L1-g7', question('L1-g7', 'practice', 2))
        self.assertTrue(all(key.startswith(('כן', 'לא')) for _, key in rows))
        rows = self.printed('L1-g7', question('L1-g7', 'practice', 10))
        self.assertTrue(rows[2][1].startswith('כן.'))
        rows = self.printed('L1-g7', question('L1-g7', 'reserves', 2))
        self.assertEqual([key.split('.')[0] for _, key in rows[:2]], ['כן', 'כן'])

    def test_a_typed_claim_with_another_value_is_a_mismatch(self):
        wire = question('L1-g7', 'practice', 1)
        wire['items'][0]['answer']['task']['left'] = '5 + 8'
        self.assertEqual(self.code('L1-g7', wire), 'PRINTED_TASK_MISMATCH')
        wire = question('L1-g7', 'reserves', 2)
        wire['items'][0]['answer']['task']['relation'] = 'lt'
        self.assertEqual(self.code('L1-g7', wire), 'PRINTED_TASK_MISMATCH')
        wire = question('L1-g7', 'practice', 1)
        wire['items'][0]['prompt'] = wire['items'][0]['prompt'].replace('הוא פתרון', 'אינו פתרון')
        self.assertEqual(self.code('L1-g7', wire), 'PRINTED_ANSWER_KIND')

    # F4, F6, F7, F9, F10: notation with one reading.

    def test_recorded_notation_with_one_reading_compiles(self):
        for case_id, group, number, correction in (
                ('L1-g8-a2', 'q13', None, 1),          # F4 a printed frac shows its numerator and denominator
                ('L1-p1', 'challenges', 3, None),       # F6 d1, d2
                ('L1-g8', 'practice', 17, None),        # F7 [[x%]]
                ('L1-p2', 'reserves', 2, None),         # F9 [[a=1, b=-6, c=9]]
                ('L1-p1', 'practice', 10, None),        # F10 a window that leaves out a point
                ('L1-p3-a2', 'practice', 14, None)):    # F10 a window past 10
            with self.subTest(case=case_id, group=group, number=number):
                self.assertIsNone(self.check(case_id, question(case_id, group, number, correction)))
        rows = self.printed('L1-p2', question('L1-p2', 'reserves', 2))
        self.assertIn('$a = 1$, $b = −6$, $c = 9$', rows[0][0])

    # G76: the questions over the dominance cap are named.

    def test_dominance_names_the_questions_over_the_cap_and_states_the_cap(self):
        import gate_policy
        from skill_feedback import FEEDBACK, parse_build_plus_log
        line = ('AssertionError: G76 (variety scales, level c): DOMINANCE: one shape carries 5 of the 10 drawn '
                'questions (1, 7, 10, 12, 15) — the cap at this size is 2. Those questions may each add their own '
                'diagonal or altitude and still be the same object; change the SHAPE, not the decoration\n')
        rows = parse_build_plus_log('Traceback\n' + line)
        self.assertEqual([(row['code'], row.get('question')) for row in rows], [('G76', 10), ('G76', 12), ('G76', 15)])
        self.assertTrue(gate_policy.names_questions('G76'))
        self.assertIn('one question in five', FEEDBACK['G76'])
        scale = line.replace('decoration', 'decoration | SCALE: 10 drawn question(s) on 2 object(s)')
        self.assertEqual([row.get('question') for row in parse_build_plus_log(scale)], [None])

    def test_a_point_name_finding_on_one_item_names_its_question(self):
        # Recorded in the render of L1-p2: the self-check names the item (q16a), not only the question.
        from skill_feedback import parse_selfcheck_log
        rows = parse_selfcheck_log('out/deliver/a: 1 error(s)\n    K6 q16a given names A, B, which no figure of q16 '
                                   'defines\nselfcheck_noam_package: 1 error(s)\n')
        self.assertEqual([(row['code'], row.get('question'), row.get('item')) for row in rows], [('K6', 16, 1)])

    # F13: a finished reply that is not JSON as a whole is read question by question.

    def test_an_author_reply_with_unbalanced_brackets_keeps_every_question_that_decodes(self):
        import provider
        text = recorded_text('L1-p1-a2')
        with self.assertRaises(ValueError):
            json.loads(text)
        measured = {}
        envelope = json.dumps({'choices': [{'finish_reason': 'stop', 'message': {'content': text}}]}).encode()
        reply = provider.parse_author_reply(envelope, measured)
        self.assertEqual(set(reply), {'title', 'rule', 'practice', 'challenges', 'reserves'})
        self.assertEqual([len(reply[g]) for g in ('practice', 'challenges', 'reserves')], [17, 3, 4])
        kept = sum(1 for g in ('practice', 'challenges', 'reserves') for q in reply[g] if q is not None)
        self.assertEqual(kept, 16)
        self.assertEqual(measured['replySalvaged'], {'questionsLost': 8})
        self.assertEqual(measured['replyDefect'], 'content_not_json')

    def test_a_correction_reply_never_closed_yields_each_question(self):
        import provider
        text = recorded_text('L1-p3', correction=1)
        envelope = json.dumps({'choices': [{'finish_reason': 'stop', 'message': {'content': text}}]}).encode()
        reply = provider.parse_author_reply(envelope, {})
        self.assertEqual(sorted(reply), ['q12', 'q14', 'q16', 'q5', 'q7', 'q9'])
        self.assertTrue(all(isinstance(q, dict) for q in reply.values()))

    def test_text_that_is_neither_shape_is_still_rejected(self):
        import provider
        from validation import GenerationError
        for text in ('{"title": "x", "rule": "y", "practice": [', 'not json', '{"f1": "x"'):
            envelope = json.dumps({'choices': [{'finish_reason': 'stop', 'message': {'content': text}}]}).encode()
            with self.subTest(text=text), self.assertRaises(GenerationError) as raised:
                provider.parse_author_reply(envelope, {})
            self.assertEqual(raised.exception.code, 'PROVIDER_INVALID_RESPONSE')

    def test_a_decide_answer_without_its_task_wrapper_is_read_as_the_decide_task(self):
        from source_normalize import normalize_question
        reply = salvaged('L1-p1-a2')
        flat = [q for q in reply['practice'] if q is not None
                and any(isinstance(i.get('answer'), dict) and i['answer'].get('kind') == 'decide' for i in q['items'])]
        self.assertTrue(flat)
        for wire in flat:
            fixed, notes = normalize_question(wire, 9)
            self.assertIn('DECIDE_WRAPPER', {n['code'] for n in notes})
            for item in fixed['items']:
                self.assertEqual(set(item), {'prompt', 'answer'})
                if 'task' in item['answer']:
                    self.assertEqual(item['answer']['kind'], 'computed')


if __name__ == '__main__':
    unittest.main()
