"""The printed givens must specify a unique dividend in division with remainder."""
import unittest

from test_printed_parts import GeneralSourceError, evaluate, wire


class InverseDivisionGivensTests(unittest.TestCase):
    intro = "פתרו את הבעיות ההפוכות הבאות:"
    prompt = "מספר חולק ב־[[6]] וקיבל מנה [[145]]. מהו המספר המקורי?"

    def exercise(self, *, topic="ד10", intro=None, prompt=None, key="6*145"):
        return wire(topic, self.intro if intro is None else intro,
                    self.prompt if prompt is None else prompt, evaluate(key))

    def test_missing_remainder_refused_at_its_item_across_division_lessons(self):
        for topic in ("ג21", "ד10", "ה04"):
            with self.subTest(topic=topic), self.assertRaises(GeneralSourceError) as failed:
                self.exercise(topic=topic)
            self.assertEqual((failed.exception.code, failed.exception.question, failed.exception.item),
                             ("PRINTED_TASK_MISMATCH", 1, 1))

    def test_divisor_one_has_a_unique_dividend(self):
        self.exercise(prompt=self.prompt.replace("[[6]]", "[[1]]"), key="145")

    def test_specified_remainder_binds_the_key_to_the_givens(self):
        for wording, key in ((" ללא שארית", "6*145"), (" בלי שארית", "870"),
                             (" והשארית היא [[0]]", "870"), (" עם שארית [[3]]", "873")):
            with self.subTest(wording=wording):
                prompt = self.prompt.replace("]].", "]]" + wording + ".")
                self.exercise(prompt=prompt, key=key)
                with self.assertRaises(GeneralSourceError) as failed:
                    self.exercise(prompt=prompt, key="871")
                self.assertEqual(failed.exception.code, "PRINTED_TASK_MISMATCH")

    def test_remainder_must_be_less_than_divisor(self):
        with self.assertRaises(GeneralSourceError) as failed:
            self.exercise(prompt=self.prompt.replace("]].", "]] עם שארית [[6]]."), key="876")
        self.assertEqual(failed.exception.code, "PRINTED_TASK_MISMATCH")

    def test_other_printed_constraints_can_select_a_specific_dividend(self):
        self.exercise(intro="בכל הסעיפים החילוק הוא ללא שארית.")
        self.exercise(intro="בכל הסעיפים השארית היא [[3]].", key="873")
        self.exercise(prompt=self.prompt.replace("מהו המספר המקורי", "מהו המספר המקורי הקטן ביותר"))
        self.exercise(topic="ג10")  # An exact-division lesson does not assume a Euclidean quotient.
