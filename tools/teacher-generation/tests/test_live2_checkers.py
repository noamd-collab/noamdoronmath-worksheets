"""The invariant findings of the independent checkers of live round 2, each on its recorded reply.

The checkers read the delivered sheets of milestone 2 and found keys that
answer a different request than the item makes, and items that print their
own answer. Every test reads a question exactly as the model wrote it
(bench/corpus: L2-g3, L2-g8 are the delivered round-2 sheets; L1-p2-a2 is the
round-1 quadratic sheet, which the engine still delivers on replay) and sends
it through the engine's real compile path. No model call, no network.
"""
from __future__ import annotations

from contextlib import ExitStack
from copy import deepcopy
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from bench import engine, isolate  # noqa: E402
from test_live1_causes import lesson_of, question  # noqa: E402


class CheckerFindings(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='live2-checkers-')
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

    def isolator(self, case_id):
        if case_id not in self.isolators:
            self.isolators[case_id] = isolate.Isolator(lesson_of(case_id), self.skills)
        return self.isolators[case_id]

    def code(self, case_id, wire):
        failure = self.isolator(case_id).check(wire)
        return None if failure is None else failure['code']

    def keys(self, case_id, wire):
        """The printed key of each item, as the trusted adapter prints the question."""
        isolator = self.isolator(case_id)
        transport = engine.ReplyFromSchema(wire, isolator.frame['title'], isolator.frame['rule'])
        compiled = engine.compile_reply(isolator.lesson, transport, self.skills, context=isolator.context)
        self.assertTrue(compiled['ok'], compiled.get('code'))
        work = Path(tempfile.mkdtemp(dir=self.scratch))
        printed = engine.printed_questions(isolator.lesson, compiled['payload'], self.skills, work)
        self.assertTrue(printed['ok'], printed.get('code'))
        return [item['answer'] for item in printed['questions'][0]['items']]

    # An item that prints its own answer beside its question.

    def test_a_check_fact_that_states_the_answer_is_refused(self):
        # ג10: "בדיקת התרגיל 35 : 7 = 5 נעשית בעזרת הכפל 5 x 7. מהי תוצאת המכפלה?" keyed 35,
        # "אם 18 : 2 = 9 ... ___ x 2 = 18" keyed 9, "נתון כי 4 x 6 = 24 ... 24 : 6 = ___" keyed 4.
        for group, number in (('practice', 3), ('practice', 12), ('practice', 13), ('practice', 17),
                              ('reserves', 3), ('reserves', 4)):
            with self.subTest(group=group, number=number):
                self.assertEqual(self.code('L2-g3', question('L2-g3', group, number)), 'PRINTED_ANSWER_LEAK')

    def test_an_estimate_that_names_the_solution_is_refused(self):
        # "היות ש־8*8 = 64 ו־9*9 = 81, הפתרון קרוב ל־8" beside x(x+2) = 80, x positive: the key is 8.
        self.assertEqual(self.code('L1-p2-a2', question('L1-p2-a2', 'practice', 14)), 'PRINTED_ANSWER_LEAK')

    def test_an_identity_an_estimate_range_and_a_chance_number_are_not_leaks(self):
        # (24 : 3) x 3 prints its operands by design; "בין 4 ל־6" does not print 5;
        # "כל כדור עולה 10 שקלים" is a story datum that equals the key 10 by chance.
        self.assertIsNone(self.code('L2-g3', question('L2-g3', 'practice', 16)))
        self.assertIsNone(self.code('L2-g3', question('L2-g3', 'reserves', 2)))
        self.assertIsNone(self.code('L2-g8', question('L2-g8', 'practice', 15)))

    # A key that answers another request than the item makes.

    def test_the_key_prints_only_the_solution_the_item_asks_for(self):
        # Before: "x = −8, x = 3" for the positive solution, negative lengths with their units.
        self.assertEqual(self.keys('L1-p2-a2', question('L1-p2-a2', 'practice', 2)),
                         ['$x = 3$', '$x = 5$', '$x = 6$'])
        self.assertEqual(self.keys('L1-p2-a2', question('L1-p2-a2', 'practice', 4))[0], '$x = 10$ מטרים')
        self.assertEqual(self.keys('L1-p2-a2', question('L1-p2-a2', 'practice', 9))[0], '$x = 3$')
        # "the smaller number" of two numbers whose sum and product are given: both solutions are positive.
        self.assertEqual(self.keys('L1-p2-a2', question('L1-p2-a2', 'reserves', 1))[0], '$x = 4$')
        # An irrational length: only the positive root, never −(3/2)√17 − 3/2 centimetres.
        key = self.keys('L1-p2-a2', question('L1-p2-a2', 'practice', 7))[2]
        self.assertEqual(key, '$x = −\\f{3}{2} + \\f{3}{2} · \\sqrt{17}$ סנטימטרים')

    def test_the_smaller_number_of_solutions_with_both_signs_is_refused(self):
        wire = deepcopy(question('L1-p2-a2', 'reserves', 1))
        item = wire['items'][0]
        item['prompt'] = 'מכפלת שני מספרים עוקבים היא [[56]]. מהו המספר הקטן מביניהם?'
        item['answer'] = {'kind': 'computed', 'unit': '',
                          'task': {'kind': 'solve', 'lhs': 'x*(x + 1)', 'rhs': '56', 'variable': 'x'}}
        # x = 7 or x = −8: both pairs are consecutive, and "the smaller" does not choose between them.
        self.assertEqual(self.code('L1-p2-a2', wire), 'PRINTED_ANSWER_KIND')
        item['prompt'] = 'מכפלת שני מספרים חיוביים עוקבים היא [[56]]. מהו המספר הקטן מביניהם?'
        self.assertEqual(self.keys('L1-p2-a2', wire)[0], '$x = 7$')

    def test_a_printed_fraction_read_as_two_numbers_is_refused(self):
        # "סכום ההופכיים שלהם הוא 5/24" typed as x(x+5) = 24: the key x = 3 answers another problem.
        wire = question('L1-p2-a2', 'challenges', 3)
        self.assertEqual(self.code('L1-p2-a2', wire), 'PRINTED_TASK_MISMATCH')
        fixed = deepcopy(wire)
        fixed['items'][2]['answer']['task'] = {'kind': 'solve', 'lhs': '1/x + 1/(x + 5)', 'rhs': '5/24', 'variable': 'x'}
        self.assertNotEqual(self.code('L1-p2-a2', fixed), 'PRINTED_TASK_MISMATCH')

    def test_an_item_that_asks_for_an_equation_and_a_number_is_refused(self):
        # "מה הייתה המשוואה המקורית ...? מצאו את האיבר החופשי שלה." was keyed −5 only.
        self.assertEqual(self.code('L1-p2-a2', question('L1-p2-a2', 'practice', 15)), 'PRINTED_ANSWER_KIND')

    def test_a_requested_decimal_is_keyed_as_a_decimal(self):
        # "כתבו את 35% כמספר עשרוני" was keyed 7/20.
        self.assertEqual(self.keys('L2-g8', question('L2-g8', 'practice', 2)), ['$0.35$', '$0.08$', '$0.62$'])
        # "מהו הערך העשרוני הנכון של 5%?" was keyed 1/20.
        self.assertEqual(self.keys('L2-g8', question('L2-g8', 'challenges', 2))[0], '$0.05$')
        # "איזה אחוז שווה למספר העשרוני 0.45?" asks for a percent: the decimal is a given.
        self.assertEqual(self.keys('L2-g8', question('L2-g8', 'practice', 12))[0], '$45%$')
        wire = deepcopy(question('L2-g8', 'practice', 2))
        wire['items'][0]['prompt'] = 'כתבו את [[1/3]] כמספר עשרוני.'
        wire['items'][0]['answer']['task'] = {'kind': 'evaluate', 'expression': '1/3'}
        self.assertEqual(self.code('L2-g8', wire), 'PRINTED_ANSWER_KIND')

    def test_a_percent_key_keeps_its_sign_inside_the_formula(self):
        # Before: "$30$ %" and "$x = 20$ %", which the right-to-left line printed as "% 30" and "% x = 20".
        self.assertEqual(self.keys('L2-g8', question('L2-g8', 'practice', 3)), ['$30%$', '$35%$', '$44%$'])
        self.assertEqual(self.keys('L2-g8', question('L2-g8', 'practice', 17))[0], '$x = 20%$')


if __name__ == '__main__':
    unittest.main()
