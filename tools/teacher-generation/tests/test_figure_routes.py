"""Figures of the middle-school lessons, on the replies recorded in live rounds 1 and 2.

Three faults, each on its recorded reply:

* a figure whose measures make it a special shape (an isosceles trapezoid, a
  square) was sent to the general constructor, which refuses it; the routed
  ones were drawn at selection but not by the render's bridge;
* a letter on an axis number refused a coordinate figure that another window
  draws exactly;
* one drawing served five questions and three reserves of the square sheet,
  and the skill's G75 (at most two) found it only at render, naming no question.

The replies are bench/corpus (L1-*) and tests/fixtures/live2-figures. No model
call, no network; the pinned skills are the bundled archives.
"""
from __future__ import annotations

from contextlib import ExitStack
from copy import deepcopy
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bench import engine  # noqa: E402

CORPUS = HERE / 'bench/corpus'
LIVE2 = HERE / 'tests/fixtures/live2-figures'
CASES = {case['id']: case for case in json.loads((CORPUS / 'index.json').read_text(encoding='utf-8'))['cases']}


def live2(name):
    return json.loads((LIVE2 / name).read_text(encoding='utf-8'))


def lesson_live2(case):
    return {**live2(case + '-lesson.json'), 'lessonGoal': 'practice'}


def lesson_corpus(case_id):
    case = CASES[case_id]
    return {**json.loads((CORPUS / case['lesson']).read_text(encoding='utf-8')),
            'lessonGoal': case['lessonGoal']['replayedAs']}


def corpus_reply(case_id, correction=None):
    case = CASES[case_id]
    name = case['firstReply'] if correction is None else case['corrections'][correction - 1]
    return json.loads((CORPUS / (name['reply'] if isinstance(name, dict) else name)).read_text(encoding='utf-8'))


def pick(reply, where):
    """'practice4', 'challenges3', 'reserve2' or a correction key 'q6' of a recorded reply."""
    group, number = re.fullmatch(r'(practice|challenges|reserve|q)([0-9]+)', where).groups()
    if group == 'q':
        return deepcopy(reply[where])
    if group == 'reserve':
        return deepcopy(reply['reserves'][int(number) - 1]['question'])
    return deepcopy(reply[group][int(number) - 1])


class FigureRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='figure-routes-')
        cls.skills = engine.skill_roots(cls.scratch)
        cls.stack = ExitStack()
        cls.stack.enter_context(engine.engine_environment(cls.skills))
        cls.refused = cls.stack.enter_context(engine.network_guard())

    @classmethod
    def tearDownClass(cls):
        cls.stack.close()
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def tearDown(self):
        self.assertEqual(self.refused, [])

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def normalised(lesson, wire):
        from runtime_catalog import scope_for_lesson
        from source_normalize import normalize_question
        topic = scope_for_lesson(lesson)['topic']
        return normalize_question(wire, lesson['gradeNumber'], topic_id=topic.get('topicId'),
                                  domain=topic.get('domain'))[0]

    def codes(self, lesson, wire, challenge=False):
        """The engine's per-question predicate on a recorded question, as the Draft calls it."""
        from runtime_catalog import scope_for_lesson
        from skill_authoring import question_codes
        return question_codes(self.normalised(lesson, wire), lesson, scope_for_lesson(lesson), challenge=challenge)

    def validated(self, lesson, wire, challenge=False):
        from runtime_catalog import scope_for_lesson
        from skill_authoring import examine_question
        refusal, question = examine_question(self.normalised(lesson, wire), 1, lesson, scope_for_lesson(lesson),
                                             challenge=challenge)
        self.assertIsNone(refusal)
        return question

    def drawn(self, lesson, wire):
        """(svg, the recorded call) of one recorded question's figure, as the adapter draws it."""
        import general_adapters
        question = self.validated(lesson, wire)
        call, work = {}, Path(tempfile.mkdtemp(dir=self.scratch))
        (work / 'figures').mkdir()
        svg, _ = general_adapters._figure(question['figure'], False, 1, work,
                                          declared=general_adapters.declared_properties(question), call=call)
        return svg, call['call']

    def replay_bridge(self, calls):
        """Run the render bridge (general_adapters.MIDDLE_BRIDGE) on recorded calls in a child process."""
        import general_adapters
        work = Path(tempfile.mkdtemp(dir=self.scratch))
        questions = []
        for n, (svg, call) in enumerate(calls, 1):
            questions.append({'n': n, 'fig': svg, '_generalFigure': call})
        (work / 'levels.json').write_text(json.dumps([{'questions': questions}], ensure_ascii=False), encoding='utf-8')
        (work / 'content.py').write_text(general_adapters.MIDDLE_BRIDGE, encoding='utf-8')
        probe = ('import json, runpy, sys\n'
                 f'sys.path.insert(0, {str(self.skills["middle"])!r})\n'
                 f'ns = runpy.run_path({str(work / "content.py")!r})\n'
                 'print(json.dumps([("_generalFigure" in q, len(q["fig"])) for q in ns["LEVELS"][0]["questions"]]))\n')
        return subprocess.run([sys.executable, '-I', '-c', probe], cwd=work, capture_output=True, text=True, timeout=300)

    # ------------------------------------------------------------------ 1. routes

    def test_an_isosceles_trapezoid_that_the_intro_states_is_drawn_as_one(self):
        # Live 2, the trapezoid lesson: legs equal by measure (dx = (a - b) / 2) and the intro says
        # "טרפז שווה־שוקיים ... AD = BC". The scalene constructor refused all four.
        lesson = lesson_live2('p3')
        for name, where in (('p3-reply-1.json', 'practice4'), ('p3-reply-1.json', 'practice17'),
                            ('p3-reply-3.json', 'practice17')):
            with self.subTest(reply=name, question=where):
                wire = pick(live2(name), where)
                self.assertEqual(self.codes(lesson, wire), [])
                _, call = self.drawn(lesson, wire)
                self.assertEqual((call['shape'], call['parameters']['variant'], call['family']),
                                 ('trapezoid', 'iso', 'general.trapezoid.iso'))
                self.assertNotIn('dx', call['parameters'])

    def test_a_trapezoid_that_only_measures_isosceles_stays_refused(self):
        # Equal legs by measure, but the intro never says so: corresponding angles on a figure that
        # happens to be a trapezoid, a midsegment, and base angles of 70 and 125 that deny it.
        lesson = lesson_live2('p3')
        for name, where in (('p3-reply-1.json', 'practice9'), ('p3-reply-1.json', 'challenges3'),
                            ('p3-reply-3.json', 'practice1')):
            with self.subTest(reply=name, question=where):
                self.assertEqual(self.codes(lesson, pick(live2(name), where), where.startswith('challenges')),
                                 ['SOURCE_FIGURE'])

    def test_a_definition_mark_never_states_what_an_item_asks(self):
        # Each figure is the special shape by measure; the routed constructor would mark it, and an
        # item asks for exactly that property, so the figure stays refused.
        cases = (
            # "Find x so that the parallelogram is a rhombus": the rhombus ticks would print AB = BC.
            (lesson_live2('p1'), pick(live2('p1-reply-4.json'), 'q6')),
            # "Is parallelogram ABCD with sides 8 and 8 a rhombus?"
            (lesson_corpus('L1-p1'), pick(corpus_reply('L1-p1', 1), 'q5')),
            # A rhombus with equal diagonals: "if one angle is right, what are the other three?"
            (lesson_live2('square'), pick(live2('square-reply-1.json'), 'practice12')),
        )
        for lesson, wire in cases:
            with self.subTest(figure=wire['figure']):
                self.assertEqual(self.codes(lesson, wire), ['SOURCE_FIGURE'])

    def test_what_an_intro_states(self):
        import general_adapters
        lesson = lesson_live2('p3')
        stated = general_adapters.declared_properties(self.validated(lesson, pick(live2('p3-reply-1.json'), 'practice4')))
        self.assertTrue({'isosceles', '=AD,BC'} <= stated)
        right = general_adapters.declared_properties(self.validated(lesson_corpus('L1-p3'),
                                                                    pick(corpus_reply('L1-p3'), 'practice3')))
        self.assertIn('right', right)
        # A question, a condition or a negation states nothing.
        for sentence in ('האם הטרפז שווה־שוקיים?', 'אם הטרפז שווה־שוקיים, חשבו.', 'הטרפז אינו שווה־שוקיים.',
                         'הוכיחו שהטרפז שווה־שוקיים.'):
            with self.subTest(sentence=sentence):
                spans = [{'kind': 'text', 'text': sentence}]
                self.assertEqual(general_adapters.declared_properties({'intro': spans}), frozenset())
        spans = [{'kind': 'text', 'text': 'נתון: '}, {'kind': 'formula', 'notation': '∠A = ∠D = 90°'},
                 {'kind': 'text', 'text': ', '}, {'kind': 'formula', 'notation': 'AD = 13'},
                 {'kind': 'text', 'text': ' ו־'}, {'kind': 'formula', 'notation': 'BC = 13'}, {'kind': 'text', 'text': '.'}]
        self.assertEqual(general_adapters.declared_properties({'intro': spans}),
                         frozenset({'right', 'right@A', 'right@D', '=AD,BC'}))

    def test_a_triangle_is_routed_by_its_measures_and_the_stated_vertex(self):
        # The figures of the recorded triangle-parts replies (T1-triangle practice 3, 4, 10).
        import general_adapters
        iso = {'kind': 'shape', 'shape': 'triangle', 'parameters': {'a': 9, 'b': 9, 'c': 6}, 'names': 'ABC', 'rotate': 0}
        # BC = CA: the apex is C, drawn last by the pinned isosceles constructor.
        self.assertEqual(general_adapters._shape_call(iso, frozenset({'isosceles'}))[:3],
                         ('triangle', {'base': 6, 'leg': 9, 'variant': 'iso'}, 'ABC'))
        # The recorded intro says "שווה שוקיים ABC (AB=AC)": the wrong pair, so the scalene call stays.
        self.assertEqual(general_adapters._shape_call(iso, frozenset({'isosceles', '=AB,AC'}))[1]['variant'], 'sss')
        apex_a = {**iso, 'parameters': {'a': 6, 'b': 9, 'c': 9}}
        self.assertEqual(general_adapters._shape_call(apex_a, frozenset({'isosceles', '=AB,AC'}))[1:3],
                         ({'base': 6, 'leg': 9, 'variant': 'iso'}, 'BCA'))
        right = {**iso, 'parameters': {'a': 5, 'b': 4, 'c': 3}}    # BC^2 = CA^2 + AB^2: right angle at A
        self.assertEqual(general_adapters._shape_call(right, frozenset({'right'}))[1:],
                         ({'c': 3, 'b': 4, 'variant': 'right'}, 'ABC', 'general.triangle.right'))
        self.assertEqual(general_adapters._shape_call(right, frozenset({'right', 'right@B'}))[1]['variant'], 'sss')
        at_b = {**iso, 'parameters': {'a': 3, 'b': 5, 'c': 4}}     # CA^2 = AB^2 + BC^2: right angle at B
        self.assertEqual(general_adapters._shape_call(at_b, frozenset({'right', 'right@B'}))[1:3],
                         ({'c': 3, 'b': 4, 'variant': 'right'}, 'BCA'))
        self.assertEqual(general_adapters._shape_call(right, frozenset())[1]['variant'], 'sss')
        with tempfile.TemporaryDirectory() as folder:
            work = Path(folder)
            (work / 'figures').mkdir()
            for fig, stated in ((iso, {'isosceles'}), (apex_a, {'isosceles'}), (right, {'right'}), (at_b, {'right'})):
                general_adapters._figure(fig, False, 1, work, declared=frozenset(stated))   # the pinned skill draws it
            with self.assertRaises(Exception) as refused:
                general_adapters._figure(right, False, 1, work)
            self.assertTrue(general_adapters.figure_refused(refused.exception))

    # ------------------------------------------------------------------ 2. the coordinate window

    def test_a_letter_on_an_axis_number_is_drawn_in_another_exact_window(self):
        # Live 1 square q6 (B at (0, 4)) and live 2 rhombus q14 (A at (0, 4)): the letter stood in the
        # slot of the y-axis number 4 in the author's window and in the window two units wider.
        import figure_probe
        import general_adapters
        for figure in (pick(corpus_reply('L1-square'), 'practice6')['figure'],
                       pick(live2('p1-reply-1.json'), 'practice14')['figure']):
            with self.subTest(figure=figure):
                self.assertIsNone(figure_probe.figure_refusal(figure))
                call, work = {}, Path(tempfile.mkdtemp(dir=self.scratch))
                (work / 'figures').mkdir()
                general_adapters._figure(figure, False, 1, work, call=call)
                call = call['call']
                # The same points and segments; only the window or the numbering step differs.
                self.assertEqual((call['points'], call['segments']), (figure['points'], figure['segments']))
                self.assertNotEqual((call['xr'], call['yr'], call.get('step')), (figure['xr'], figure['yr'], None))
                # The author's own window still refuses it: the letter stands on the axis number.
                from figkit_plus import wide
                points = {p['name']: (p['x'], p['y']) for p in figure['points']}
                with self.assertRaises(Exception) as refused:
                    wide(tuple(figure['xr']), tuple(figure['yr']), points=[(xy, n) for n, xy in points.items()],
                         solid=[(points[a], points[b]) for a, b in figure['segments']])
                self.assertEqual(type(refused.exception).__name__, 'LayoutError')
                self.assertIn('slot of the y-axis number 4', str(refused.exception))

    def test_the_render_bridge_draws_what_selection_drew(self):
        # The bridge used to redraw the author's figure: the routed rhombus and right trapezoid were
        # refused by their general constructors, and the wider window hit the label again.
        calls = [self.drawn(lesson_live2('p3'), pick(live2('p3-reply-1.json'), 'practice4')),
                 self.drawn(lesson_corpus('L1-p3'), pick(corpus_reply('L1-p3'), 'practice3')),
                 self.drawn(lesson_corpus('L1-square'), pick(corpus_reply('L1-square'), 'practice6')),
                 self.drawn(lesson_corpus('L1-p1'), pick(corpus_reply('L1-p1'), 'challenges2'))]
        self.assertEqual([call['shape'] if call['kind'] == 'shape' else 'plane' for _, call in calls],
                         ['trapezoid', 'trapezoid', 'plane', 'plane'])
        done = self.replay_bridge(calls)
        self.assertEqual(done.returncode, 0, done.stderr[-2000:])
        self.assertEqual(json.loads(done.stdout.strip().splitlines()[-1]), [[False, len(svg)] for svg, _ in calls])

    # ------------------------------------------------------------------ 3. one drawing, at most two questions

    def draft(self, lesson, reply):
        from general_provider import Draft
        from runtime_catalog import scope_for_lesson
        from skill_authoring import question_plan, split_reserves
        from source_normalize import normalize_source
        scope = scope_for_lesson(lesson)
        flat, reserves, _ = split_reserves(normalize_source(deepcopy(reply), lesson['gradeNumber'], topic=scope['topic']))
        return Draft(flat, reserves, lesson, scope, question_plan(lesson, scope), compile_sheet=lambda *a: None,
                     ask=lambda *a: {}, context={}, model='m', measured={})

    def test_one_drawing_serves_at_most_two_questions_of_the_sheet(self):
        # Live 2 square, reply 1: a square ABCD of any side prints one SVG. Five usable questions and three
        # reserves drew it; G75 (cap 2) refused the built sheet and named no question.
        draft = self.draft(lesson_live2('square'), live2('square-reply-1.json'))
        selection = draft.selection
        keys = [draft._drawings.get(id(slot.question)) for slot in selection.layout()]
        printed = {key: keys.count(key) for key in keys if key is not None}
        self.assertLessEqual(max(printed.values()), 2)
        over = [event for event in selection.record if event['codes'] == ['G75']]
        self.assertEqual([event['question'] for event in over], [9, 14, 16])
        self.assertEqual({event['stage'] for event in over}, {'sheet'})
        # Planned questions 1 and 7 keep the drawing; every reserve that draws it is refused too.
        square = draft._drawings[id(selection.slot(1).question)]
        self.assertEqual([slot.number for slot in selection.layout() if draft._drawings.get(id(slot.question)) == square],
                         [1, 7])
        self.assertEqual([reserve.number for reserve in selection.reserves if reserve.codes == ('G75',)], [1, 2, 3])
        # What stays missing fails as the gate did, and the correction asks for a new drawing.
        from general_provider import failure_code
        slot = selection.slot(9)
        self.assertEqual(failure_code(slot.codes, slot.event['stage']), 'QUALITY_GATE_FAILED')
        feedback = draft._feedback(slot)
        self.assertTrue(any('at most two questions may share one drawing' in row for row in feedback))
        # A correction that draws the same square again is refused at once.
        self.assertEqual(selection.fill(9, pick(live2('square-reply-1.json'), 'practice7')), ('G75',))

    def test_the_third_printing_of_a_drawing_is_the_one_replaced(self):
        # Live 2 rhombus, reply 1: one rhombus on practice 1 and 13 and on challenge 1 (planned 18).
        # Challenges print last, so the challenge is the third printing; the practice questions keep it.
        draft = self.draft(lesson_live2('p1'), live2('p1-reply-1.json'))
        over = [event['question'] for event in draft.selection.record if event['codes'] == ['G75']]
        self.assertEqual(over, [18])
        rhombus = draft._drawings[id(draft.selection.slot(1).question)]
        self.assertEqual([slot.number for slot in draft.selection.layout()
                          if draft._drawings.get(id(slot.question)) == rhombus], [1, 13])

    def test_the_correction_says_what_the_measures_draw(self):
        # Live 2 trapezoid, reply 1, question 9: equal legs by measure on a sheet that never says
        # isosceles. The correction request now says what a, b, h and dx draw and when a trapezoid
        # may be isosceles, so the rewritten figure can be drawn.
        draft = self.draft(lesson_live2('p3'), live2('p3-reply-1.json'))
        slot = draft.selection.slot(9)
        self.assertEqual(slot.codes, ('SOURCE_FIGURE',))
        feedback = ' '.join(draft._feedback(slot))
        self.assertIn('dx = (a - b) / 2', feedback)
        self.assertIn('טרפז שווה־שוקיים', feedback)

    def test_the_render_names_the_questions_over_the_reuse_cap(self):
        # The gate's own message, from the pinned emit_html.assert_figure_variety.
        import gate_policy
        from skill_feedback import FEEDBACK, parse_build_plus_log
        line = ('AssertionError: G75 (figure variety, level c): the same drawing serves questions 1, 3, 5, 6; '
                'questions 2, 4, 7 (cap is 2): draw what each of those questions adds — a diagonal, an altitude, '
                'a midpoint, a new point\n')
        rows = parse_build_plus_log('Traceback (most recent call last):\n' + line)
        self.assertEqual([(row['code'], row.get('question')) for row in rows],
                         [('G75', 5), ('G75', 6), ('G75', 7)])
        self.assertTrue(gate_policy.names_questions('G75'))
        self.assertEqual(gate_policy.decide({'complete': True, 'findings': rows, 'unnamed': []})['action'], 'replace')
        cover = line.rstrip('\n') + '; a figure sheet with drawings on 7 of 20 questions (35%, floor 60%)\n'
        rows = parse_build_plus_log(cover)
        self.assertIn(('G75', None), [(row['code'], row.get('question')) for row in rows])
        self.assertIn('two questions may share one drawing', FEEDBACK['G75'])

    def test_the_reuse_cap_is_the_pinned_skill_s(self):
        import figure_probe
        source = (Path(self.skills['middle']) / 'emit_html.py').read_text(encoding='utf-8')
        self.assertEqual(int(re.search(r'^FIG_REUSE_MAX = ([0-9]+)$', source, re.M)[1]), figure_probe.FIGURE_REUSE_MAX)
        # The message skill_feedback.parse_g75 reads.
        self.assertIn('"the same drawing serves %s (cap is %d)', source)
        self.assertIn('"; ".join("questions %s" % ", ".join(map(str, qn))', source)


if __name__ == '__main__':
    unittest.main()
