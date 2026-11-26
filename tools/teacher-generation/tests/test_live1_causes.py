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
        for case_id, group, number in (('L1-p1', 'practice', 17), ('L1-p3', 'challenges', 1)):
            with self.subTest(case=case_id, group=group, number=number):
                self.assertEqual(self.code(case_id, question(case_id, group, number)), 'PRINTED_ANSWER_LEAK')
        # Read as written, these two recorded leaks are refused for their notation first.
        for case_id, group, number in (('L1-p1', 'practice', 12), ('L1-p3-a2', 'challenges', 3)):
            with self.subTest(case=case_id, group=group, number=number):
                self.assertEqual(self.code(case_id, question(case_id, group, number)), 'SOURCE_NOTATION')
        # With only that angle written in contract notation, each is refused for the leak itself: the key
        # x = 4 printed as a given of the next item, and the key 4 of CE printed as the given CE = 4.
        for case_id, group, number, written, contract in (
                ('L1-p1', 'practice', 12, '[[angle:AOB = 90]] מעלות', '[[∠AOB = 90°]]'),
                ('L1-p3-a2', 'challenges', 3, '[[angle:A = angle:D = 90°]]', '[[∠BAD = ∠ADC = 90°]]')):
            with self.subTest(case=case_id, group=group, number=number, contract=contract):
                wire = question(case_id, group, number)
                self.assertEqual(wire['intro'].count(written), 1)
                wire['intro'] = wire['intro'].replace(written, contract)
                self.assertEqual(self.code(case_id, wire), 'PRINTED_ANSWER_LEAK')

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
        from figure_probe import figure_refusal
        # A label on an axis number, even in the window two units wider; two sides that print as equal.
        for case_id, group, number in (('L1-square', 'practice', 6), ('L1-p3', 'practice', 13)):
            with self.subTest(case=case_id, group=group, number=number):
                failure = self.check(case_id, question(case_id, group, number))
                self.assertEqual(failure['code'], 'SOURCE_FIGURE')
                self.assertIn('figure', failure['detail'])
        # Read as written, these recorded questions are refused for their notation before the figure
        # is drawn, so their figures are drawn here alone: the pinned constructors refuse both
        # (two sides that print as equal).
        for case_id, group, number in (('L1-p3-a2', 'practice', 17), ('L1-p3-a2', 'challenges', 3)):
            with self.subTest(case=case_id, group=group, number=number):
                wire = question(case_id, group, number)
                self.assertEqual(self.code(case_id, wire), 'SOURCE_NOTATION')
                refusal = figure_refusal(wire['figure'], skill_path=str(self.skills['middle']))
                self.assertEqual(refusal.code, 'SOURCE_FIGURE')
                self.assertIn('figure', str(refusal))

    def test_a_figure_with_one_reading_is_drawn_as_that_shape(self):
        from figure_probe import figure_refusal
        # A parallelogram with equal sides is a rhombus; a trapezoid with offset 0 is a right trapezoid;
        # a label on an axis number moves off it in a window two units wider.
        for case_id, group, number in (('L1-p1-a2', 'practice', 5), ('L1-p3', 'practice', 3),
                                       ('L1-p1', 'challenges', 2)):
            with self.subTest(case=case_id, group=group, number=number):
                wire = (salvaged(case_id)['practice'][number - 1] if case_id == 'L1-p1-a2'
                        else question(case_id, group, number))
                self.assertNotEqual(self.code(case_id, wire), 'SOURCE_FIGURE')
                # The figure itself, drawn alone: the check above stops early when the question is refused.
                self.assertIsNone(figure_refusal(wire['figure'], skill_path=str(self.skills['middle'])))

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

    # F17: a refused rule is kept as written and refused; only the one correction call can replace it.

    def test_a_refused_rule_is_kept_as_written(self):
        from general_provider import Draft
        from runtime_catalog import scope_for_lesson
        from skill_authoring import examine_frame, question_plan
        lesson = lesson_of('L1-g8')
        scope = scope_for_lesson(lesson)
        reply = reply_of('L1-g8')
        rule = reply['rule'].replace('[[p%]]', '[[p % q]]')
        self.assertEqual(examine_frame('אחוזים', rule, lesson, scope).code, 'SOURCE_NOTATION')
        # No sentence of it is dropped: the rule stays whole and refused.
        asked = []
        flat = {key: reply[key] for key in ('title', 'practice', 'challenges')}
        flat['rule'] = rule
        draft = Draft(flat, [], lesson, scope, question_plan(lesson, scope), compile_sheet=lambda *a: None,
                      ask=lambda body, observed: asked.append(body), context={}, model='m', measured={})
        self.assertEqual(draft.rule, rule)
        self.assertEqual(draft.rule_refusal.code, 'SOURCE_NOTATION')
        self.assertTrue(draft.needs_model())
        self.assertNotIn('ruleTrimmed', draft.report())
        # Building the draft asks nothing; only correct() asks for the rule again (the two tests below).
        self.assertEqual(asked, [])
        # The recorded rules of round one as written: [[p%]], d1 and d2 pass; a bare [[%]] is refused.
        for case_id in ('L1-g8', 'L1-p1'):
            with self.subTest(case=case_id):
                lesson = lesson_of(case_id)
                self.assertIsNone(examine_frame('t', reply_of(case_id)['rule'], lesson, scope_for_lesson(lesson)))
        lesson = lesson_of('L1-g8-a2')
        self.assertEqual(examine_frame('t', reply_of('L1-g8-a2')['rule'], lesson, scope_for_lesson(lesson)).code,
                         'SOURCE_NOTATION')

    def test_a_refused_rule_is_asked_for_again_in_the_one_correction(self):
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
        # The correction carries the refused rule exactly as the model wrote it.
        self.assertEqual(json.loads(asked[0]['messages'][1]['content'])['ruleToCorrect']['rule'], '[[p % q]].')
        self.assertIsNone(draft.rule_refusal)
        self.assertEqual(draft.rule, 'אחוז אחד הוא מאית מתוך שלם: [[1% = frac(1,100)]].')

    def test_a_corrected_rule_that_is_still_refused_is_not_taken_and_the_sheet_fails_on_its_rule(self):
        import general_provider
        from general_source import GeneralSourceError
        from runtime_catalog import scope_for_lesson
        from skill_authoring import examine_frame
        from validation import GenerationError
        # The recorded grade 4 sheet S-g4calc, whose questions all pass the source stage, with a refused rule.
        lesson = json.loads((CORPUS / 'lessons/g4-order-practice.json').read_text(encoding='utf-8'))
        scope = scope_for_lesson(lesson)
        reply = json.loads((CORPUS / 'replies/S-g4calc.json').read_text(encoding='utf-8'))
        refused, still = 'מבצעים קודם כפל: [[4 @ 2]].', 'מבצעים קודם כפל וחילוק: [[3 @ 1]].'
        for rule in (refused, still):
            self.assertEqual(examine_frame(reply['title'], rule, lesson, scope).code, 'SOURCE_NOTATION')
        reply['rule'] = refused
        asked = []

        def answer(target, key, body, observed, timeout):
            asked.append(body)
            return deepcopy(reply) if len(asked) == 1 else {'rule': still}

        session = {}
        with patch('provider.request_author_json', side_effect=answer), self.assertRaises(GenerationError) as error:
            general_provider.author_general_lesson(lesson, metadata={}, revision=session, api_key='k', model='m',
                                                   base_url='https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                                                   authoring_context={'scope': scope})
        draft = session['draft']
        self.assertEqual(error.exception.code, 'SOURCE_NOTATION')
        self.assertEqual((draft.missing(), draft.rule, draft.rule_refusal.code, draft.needs_model()),
                         ([], refused, 'SOURCE_NOTATION', True))
        # The one correction asks for the rule alone; its reply carries a rule that is refused again.
        draft.correct()
        self.assertEqual(len(asked), 2)
        self.assertIn('rule', asked[1]['response_format']['json_schema']['schema']['required'])
        self.assertEqual(json.loads(asked[1]['messages'][1]['content'])['ruleToCorrect']['rule'], refused)
        # It is not taken: the rule stays as the model first wrote it, still refused, and the sheet fails on it.
        self.assertEqual((draft.rule, draft.rule_refusal.code, draft.needs_model()), (refused, 'SOURCE_NOTATION', True))
        with self.assertRaises(GeneralSourceError) as failed:
            draft.source()
        self.assertEqual(failed.exception.code, 'SOURCE_NOTATION')

    def test_the_recorded_percent_sheets_with_no_further_author_call(self):
        from bench import replay
        # The engine now asks for fewer questions than were recorded: each recorded correction answers
        # the ones it holds (corrections='subset'). Live, both attempts ended on their rule.
        results = replay.run(CORPUS, only=('L1-g8', 'L1-g8-a2'), work=Path(tempfile.mkdtemp(dir=self.scratch)),
                             skills=self.skills, render=False, corrections='subset')
        printed, status = {}, {}
        for case in results['cases']:
            with self.subTest(case=case['id']):
                self.assertEqual((case['ladder']['attempts'], case['author']['requests']),
                                 (1, 1 + case['ladder']['corrections']))
                status[case['id']] = (case['finalStatus'], case['finalCode'])
                printed[case['id']] = case['ladder']['attemptRecords'][0]['printed']
        # Attempt 1: four reserves for six refused questions, one correction for the five still missing.
        # Attempt 2: its rule (a bare [[%]]) is refused and kept as written, and question 4 is refused too: its
        # intro asks to order the percents ("סדרו ... בסדר עולה"), and no item's single number is that order
        # (PRINTED_ANSWER_KIND). It takes a reserve, so question 11 (SOURCE_NOTATION) is left without one.
        # The one correction asks for question 11 and the rule; no such reply was recorded, so the sheet fails.
        self.assertEqual(printed, {'L1-g8': 20, 'L1-g8-a2': 19})
        self.assertEqual(status, {'L1-g8': ('authored', None), 'L1-g8-a2': ('failed', 'SOURCE_NOTATION')})
        second = next(case for case in results['cases'] if case['id'] == 'L1-g8-a2')
        self.assertEqual([(event['question'], event['codes']) for event in second['ladder']['attemptRecords'][0]['events']],
                         [(3, ['SOURCE_NOTATION']), (4, ['PRINTED_ANSWER_KIND']), (11, ['SOURCE_NOTATION'])])
        self.assertEqual((second['author']['correction']['questions'], second['author']['correction']['requiredKeys'],
                          second['ladder']['correctionFailed']), ([11], ['q11', 'rule'], True))
        self.assertEqual(second['frameFailure']['field'], 'title or rule')

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

    def test_recorded_angles_inside_a_formula_are_refused_as_written(self):
        # Typed or one-letter angles inside a formula ([[angle:D = 70°]], [[angle:A + angle:B]]): nothing
        # renames them from the figure, so each recorded question is refused.
        for case_id, group, number in (('L1-p3', 'practice', 1), ('L1-p3', 'practice', 4), ('L1-p1', 'practice', 3),
                                       ('L1-p1', 'practice', 8), ('L1-p1', 'practice', 13), ('L1-p3-a2', 'practice', 3)):
            with self.subTest(case=case_id, group=group, number=number):
                self.assertEqual(self.code(case_id, question(case_id, group, number)), 'SOURCE_NOTATION')
        # The same questions written by this test in contract notation, with three-letter angles, compile.
        wire = question('L1-p3', 'practice', 1)
        wire['items'][0]['prompt'] = 'נתון כי [[∠ADC = 70°]]. חשבו את גודל הזווית החד־צדדית [[angle:BAD]].'
        wire['items'][1]['prompt'] = 'נתון כי [[∠ABC = 120°]]. חשבו את גודל הזווית החד־צדדית [[angle:BCD]].'
        self.assertIsNone(self.check('L1-p3', wire))
        # Its third item, "חשבו את סכום כל ארבע זוויות הטרפז." beside the figure, is keyed 110 + 70 + 120 + 60: the
        # trusted adapter never prints that typed task after it (it would print the keys of items 1 and 2).
        isolator = self.isolators['L1-p3']
        compiled = engine.compile_reply(isolator.lesson, engine.ReplyFromSchema(wire, isolator.frame['title'], isolator.frame['rule']),
                                        self.skills, context=isolator.context)
        refused = engine.printed_questions(isolator.lesson, compiled['payload'], self.skills, Path(tempfile.mkdtemp(dir=self.scratch)))
        self.assertEqual((refused['ok'], refused['code']), (False, 'PRINTED_TASK_MISMATCH'))
        # With the second item in its place the question prints.
        wire['items'][2] = deepcopy(wire['items'][1])
        self.assertIsNone(self.check('L1-p3', wire))
        rows = self.printed('L1-p3', wire)
        self.assertIn(r'$\angle{ADC} = 70°$', rows[0][0])
        self.assertEqual(rows[0][1], '$110$ מעלות')
        wire = question('L1-p3', 'practice', 4)
        for item, prompt in zip(wire['items'], ('חשבו את גודל הזווית [[angle:BCD]].', 'חשבו את גודל הזווית הקהה [[angle:BAD]].',
                                                'חשבו את סכום שתי זוויות הבסיס העליון, [[∠BAD + ∠ABC]].')):
            item['prompt'] = prompt
        self.assertIsNone(self.check('L1-p3', wire))
        # Items 2 and 3 are keyed 180 - 55 and 125 + 125 beside the figure and the intro's 55°: the trusted adapter
        # never prints those typed tasks after them (they would show the operation, and the key of item 2).
        isolator = self.isolators['L1-p3']
        compiled = engine.compile_reply(isolator.lesson, engine.ReplyFromSchema(wire, isolator.frame['title'], isolator.frame['rule']),
                                        self.skills, context=isolator.context)
        refused = engine.printed_questions(isolator.lesson, compiled['payload'], self.skills, Path(tempfile.mkdtemp(dir=self.scratch)))
        self.assertEqual((refused['ok'], refused['code']), (False, 'PRINTED_TASK_MISMATCH'))
        # Typed as the values themselves, nothing is printed after the prompts and the sum of the angles prints.
        wire['items'][1]['answer']['task']['expression'] = '125'
        wire['items'][2]['answer']['task']['expression'] = '250'
        self.assertIsNone(self.check('L1-p3', wire))
        rows = self.printed('L1-p3', wire)
        self.assertIn(r'$\angle{BAD} + \angle{ABC}$', rows[2][0])

    # F8: a task letter outside x, y, a and b.

    def test_a_task_letter_outside_the_contract_is_refused_as_written(self):
        # Solve tasks for c, m and h: nothing renames the letter to x, so each recorded question is refused.
        for case_id, group, number, correction in (('L1-p2-a2', 'practice', 3, None), ('L1-p2-a2', 'practice', 12, None),
                                                   ('L1-p3-a2', 'q6', None, 1)):
            with self.subTest(case=case_id, group=group, number=number):
                wire = question(case_id, group, number, correction=correction)
                self.assertEqual(self.code(case_id, wire), 'SOURCE_NOTATION')
        # The same question with only its contract letters (its third item in place of the first) compiles.
        wire = question('L1-p2-a2', 'practice', 3)
        wire['items'][0] = deepcopy(wire['items'][2])
        rows = self.printed('L1-p2-a2', wire)
        self.assertEqual([key for _, key in rows], ['$a = 2$', '$b = 7$', '$a = 2$'])
        # The display of a product of two letters keeps both names (it printed "yx" before).
        self.assertIn('$x^{2} + bx − 18 = 0$', rows[1][0])
        self.assertIn('$ax^{2} − 5x − 12 = 0$', rows[2][0])

    def test_a_reply_cannot_name_the_printed_letter_itself(self):
        wire = question('L1-p2-a2', 'practice', 3)
        wire['items'][0] = deepcopy(wire['items'][2])
        wire['items'][1]['answer']['printedVariable'] = 'q'
        self.assertEqual(self.code('L1-p2-a2', wire), 'SOURCE_SHAPE')

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

    # F4, F6, F7, F9, F10: recorded notation, judged exactly as written.

    def test_recorded_notation_compiles_only_where_the_contract_reads_it(self):
        for case_id, group, number, correction, code in (
                ('L1-g8-a2', 'q13', None, 1, None),                   # F4 a printed frac shows its numerator and denominator
                ('L1-p1', 'challenges', 3, None, None),               # F6 d1, d2
                ('L1-g8', 'practice', 17, None, None),                # F7 [[x%]]
                ('L1-p2', 'reserves', 2, None, 'SOURCE_NOTATION'),    # F9 [[a=1, b=-6, c=9]] is one island of three values
                ('L1-p1', 'practice', 10, None, 'SOURCE_NUMBER'),     # F10 a window that leaves out a point
                ('L1-p3-a2', 'practice', 14, None, 'SOURCE_NUMBER')):  # F10 a window past 10
            with self.subTest(case=case_id, group=group, number=number):
                self.assertEqual(self.code(case_id, question(case_id, group, number, correction)), code)

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

    def test_a_decide_answer_without_its_task_wrapper_is_refused_as_written(self):
        reply = salvaged('L1-p1-a2')

        def flat_decide(wire):
            return wire is not None and any(isinstance(i.get('answer'), dict) and i['answer'].get('kind') == 'decide'
                                            for i in wire['items'])
        practice = {number: wire for number, wire in enumerate(reply['practice'], 1) if flat_decide(wire)}
        reserves = {number: row['question'] for number, row in enumerate(reply['reserves'], 1)
                    if isinstance(row, dict) and flat_decide(row.get('question'))}
        self.assertEqual((sorted(practice), sorted(reserves)), ([1, 5, 7, 13], [2]))
        for wire in list(practice.values()) + list(reserves.values()):
            self.assertEqual(self.code('L1-p1-a2', wire), 'SOURCE_SHAPE')


if __name__ == '__main__':
    unittest.main()
