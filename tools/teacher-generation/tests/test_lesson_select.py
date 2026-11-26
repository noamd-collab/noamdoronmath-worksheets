"""Selection of a sheet from planned questions and reserves: pure, no wire format, no model."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import lesson_select  # noqa: E402
from lesson_select import (CHALLENGES, NO_QUESTION, PRACTICE, Selection, minimum_count,  # noqa: E402
                           reserve_count, reserve_groups, select)
from runtime_catalog import question_floor  # noqa: E402

# The grade minimum of grades 1-2, the lowest the callers pass (validation.validate_lesson); the twelve-question
# test sheet is planned above it, so three quarters decide its shortest sheet.
FLOOR = question_floor(1)


def rows(group, names, concepts=()):
    return [{"group": group, "question": name, "concepts": concepts} for name in names]


def sheet(practice=9, challenges=3):
    return (rows(PRACTICE, [f"p{i}" for i in range(1, practice + 1)])
            + rows(CHALLENGES, [f"c{i}" for i in range(1, challenges + 1)]))


def refuse(bad):
    """A predicate that refuses the named questions, each with its own code."""
    seen = []

    def predicate(question, challenge, number):
        seen.append((question, challenge, number))
        code = bad.get(question)
        return [code] if code else []
    predicate.seen = seen
    return predicate


class LimitTests(unittest.TestCase):
    def test_reserve_count_follows_the_planned_count(self):
        self.assertEqual([reserve_count(n) for n in (8, 12, 15, 16, 20, 23, 24, 30)], [3, 3, 3, 4, 4, 4, 5, 5])
        for planned in (8, 16, 24):
            groups = reserve_groups(planned)
            self.assertEqual(len(groups), reserve_count(planned))
            self.assertEqual(groups.count(CHALLENGES), 1)   # one challenge reserve, the rest practice

    def test_the_shortest_sheet_is_three_quarters_and_never_under_the_grade_minimum(self):
        # The grade minimums (8 / 12 / 14 / 20 for grades 1-2 / 3-4 / 5-6 / 7-9) win wherever they are larger.
        self.assertEqual([question_floor(grade) for grade in range(1, 10)], [8, 8, 12, 12, 14, 14, 20, 20, 20])
        counts = (6, 8, 12, 14, 16, 20, 24, 30)
        self.assertEqual({floor: [minimum_count(n, floor) for n in counts] for floor in (8, 12, 14, 20)},
                         {8: [8, 8, 9, 11, 12, 15, 18, 23], 12: [12, 12, 12, 12, 12, 15, 18, 23],
                          14: [14, 14, 14, 14, 14, 15, 18, 23], 20: [20, 20, 20, 20, 20, 20, 20, 23]})
        # A sheet requested at its grade minimum is never shortened.
        for grade in range(1, 10):
            floor = question_floor(grade)
            self.assertEqual(minimum_count(floor, floor), floor)
        # The grade minimum is never optional and never a guess.
        with self.assertRaises(TypeError):
            minimum_count(12)
        with self.assertRaises(TypeError):
            Selection(sheet(), [], refuse({}))
        with self.assertRaises(TypeError):
            select(sheet(), [], refuse({}))
        # Only a grade minimum is a floor: a lower number would shorten a sheet below the minimum of every grade,
        # and any other number is no grade's minimum.
        self.assertFalse(hasattr(lesson_select, "MINIMUM_SHEET"))
        for bad in (0, -8, "8", True, 8.0, None, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 15, 16, 19, 21, 30):
            with self.subTest(floor=bad):
                with self.assertRaises(ValueError):
                    minimum_count(12, bad)
                with self.assertRaises(ValueError):
                    Selection(sheet(), [], refuse({}), floor=bad)


class SelectionTests(unittest.TestCase):
    def test_a_good_reply_is_printed_as_planned_and_no_reserve_is_examined(self):
        predicate = refuse({})
        selection = select(sheet(), rows(PRACTICE, ["r1"]), predicate, floor=FLOOR)
        self.assertEqual([slot.question for slot in selection.layout()], [f"p{i}" for i in range(1, 10)] + ["c1", "c2", "c3"])
        self.assertEqual((selection.missing(), selection.record), ([], []))
        self.assertNotIn("r1", [question for question, _, _ in predicate.seen])
        # Each planned question was examined once, for its own position and group.
        self.assertEqual(predicate.seen[0], ("p1", False, 1))
        self.assertEqual(predicate.seen[-1], ("c3", True, 12))

    def test_a_bad_question_takes_a_reserve_of_its_own_group_in_its_own_position(self):
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]) + rows(CHALLENGES, ["rc"]),
                           refuse({"p4": "SOURCE_NOTATION", "c2": "PRINTED_ANSWER_KIND"}), floor=FLOOR)
        printed = [slot.question for slot in selection.layout()]
        self.assertEqual(printed[3], "r1")
        self.assertEqual(printed[-3:], ["c1", "rc", "c3"])
        self.assertTrue(selection.slot(11).challenge)
        self.assertEqual(selection.missing(), [])
        self.assertEqual(selection.record, [
            {"question": 4, "group": PRACTICE, "codes": ["SOURCE_NOTATION"], "stage": "source", "action": "reserve", "reserve": 1},
            {"question": 11, "group": CHALLENGES, "codes": ["PRINTED_ANSWER_KIND"], "stage": "source", "action": "reserve", "reserve": 3}])
        summary = selection.summary()
        self.assertEqual((summary["planned"], summary["printed"], summary["replaced"], summary["byReserve"], summary["dropped"]),
                         (12, 12, 2, 2, 0))
        self.assertEqual(summary["codes"], {"PRINTED_ANSWER_KIND": 1, "SOURCE_NOTATION": 1})
        self.assertEqual((summary["replacedCodes"], summary["droppedCodes"]), (summary["codes"], {}))

    def test_a_reserve_for_the_same_concept_is_preferred_and_a_bad_reserve_is_skipped(self):
        planned = sheet()
        planned[2]["concepts"] = ("k2",)
        reserves = (rows(PRACTICE, ["r-other"], ("k1",)) + rows(PRACTICE, ["r-bad"], ("k2",))
                    + rows(PRACTICE, ["r-same"], ("k2",)))
        selection = select(planned, reserves, refuse({"p3": "X", "r-bad": "SOURCE_TABLE"}), floor=FLOOR)
        self.assertEqual(selection.slot(3).question, "r-same")
        self.assertEqual(selection.summary()["reservesRefused"], 1)
        self.assertEqual(selection.reserves_left(), 1)   # the reserve of another concept was not needed

    def test_a_practice_reserve_stands_in_for_one_challenge_only_while_two_real_challenges_remain(self):
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]), refuse({"c2": "X"}), floor=FLOOR)
        self.assertEqual(selection.missing(), [])
        stand_in = selection.slot(11)
        self.assertEqual((stand_in.question, stand_in.challenge), ("r1", False))
        # It is printed with the ordinary questions; two starred questions close the sheet.
        self.assertEqual([slot.question for slot in selection.layout()],
                         [f"p{i}" for i in range(1, 10)] + ["r1", "c1", "c3"])
        self.assertEqual(selection.real_challenges(), 2)
        self.assertEqual(selection.record[0]["action"], "reserve_as_practice")
        # With two challenges bad, one real challenge is left: no practice reserve may stand in.
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]), refuse({"c2": "X", "c3": "X"}), floor=FLOOR)
        self.assertEqual(selection.missing(), [11, 12])
        self.assertEqual(selection.reserves_left(), 2)

    def test_a_challenge_reserve_never_fills_a_practice_position(self):
        selection = select(sheet(), rows(CHALLENGES, ["rc1", "rc2"]), refuse({"p1": "X"}), floor=FLOOR)
        self.assertEqual(selection.missing(), [1])
        self.assertEqual(selection.reserves_left(), 2)

    def test_practice_positions_are_served_before_a_challenge_borrows_a_practice_reserve(self):
        selection = select(sheet(), rows(PRACTICE, ["r1"]), refuse({"c1": "X", "p9": "X"}), floor=FLOOR)
        self.assertEqual(selection.slot(9).question, "r1")
        self.assertEqual(selection.missing(), [10])

    def test_a_position_the_author_left_empty_is_missing_and_can_take_a_reserve(self):
        planned = sheet()
        planned[5]["question"] = None
        selection = select(planned, rows(PRACTICE, ["r1"]), refuse({}), floor=FLOOR)
        self.assertEqual((selection.slot(6).question, selection.record[0]["codes"]), ("r1", [NO_QUESTION]))
        selection = select(planned, [], refuse({}), floor=FLOOR)
        self.assertEqual(selection.missing(), [6])

    def test_a_later_check_rejects_printed_questions_and_the_remaining_reserves_fill_in(self):
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]), refuse({"p2": "SOURCE_NOTATION"}), floor=FLOOR)
        self.assertEqual(selection.reject({7: ["G66"], 8: ["G60"]}, stage="precheck"), [8])
        self.assertEqual(selection.slot(7).question, "r2")
        self.assertEqual(selection.record[-1], {"question": 8, "group": PRACTICE, "codes": ["G60"],
                                                "stage": "precheck", "action": "missing"})
        self.assertEqual(selection.slot(8).removed, "p8")

    def test_a_correction_fills_a_missing_position_only_when_the_predicate_accepts_it(self):
        selection = select(sheet(), [], refuse({"p2": "SOURCE_NOTATION", "again-bad": "SOURCE_TABLE"}), floor=FLOOR)
        self.assertEqual(selection.fill(2, "again-bad"), ("SOURCE_TABLE",))
        self.assertEqual(selection.missing(), [2])
        self.assertEqual(selection.fill(2, "fixed"), ())
        self.assertEqual((selection.slot(2).question, selection.slot(2).origin), ("fixed", "correction"))
        self.assertEqual(selection.record[0]["action"], "correction")
        self.assertEqual(selection.record[0]["refused"], [["SOURCE_TABLE"]])
        with self.assertRaises(ValueError):
            selection.fill(3, "p3 is not missing")

    def test_a_restored_challenge_lets_a_practice_reserve_stand_in_for_the_other(self):
        selection = select(sheet(), rows(PRACTICE, ["r1"]), refuse({"c1": "X", "c2": "X"}), floor=FLOOR)
        self.assertEqual(selection.missing(), [10, 11])
        self.assertEqual(selection.fill(10, "c1-fixed"), ())
        self.assertEqual(selection.screen("correction"), [])
        self.assertEqual((selection.slot(11).question, selection.slot(11).challenge), ("r1", False))

    def test_a_shorter_sheet_keeps_three_quarters_and_two_real_challenges(self):
        bad = {f"p{i}": "X" for i in (1, 2, 3)}
        selection = select(sheet(), [], refuse(bad), floor=FLOOR)
        self.assertTrue(selection.shorten())
        self.assertEqual([slot.question for slot in selection.layout()], [f"p{i}" for i in range(4, 10)] + ["c1", "c2", "c3"])
        self.assertEqual((selection.missing(), selection.summary()["dropped"]), ([], 3))
        self.assertEqual((selection.summary()["droppedCodes"], selection.summary()["replacedCodes"]), ({"X": 3}, {}))
        self.assertTrue(all(event["action"] == "dropped" for event in selection.record))
        # Four of twelve missing leaves eight, below the nine of minimum_count(12, FLOOR).
        selection = select(sheet(), [], refuse({**bad, "p4": "X"}), floor=FLOOR)
        self.assertFalse(selection.shorten())
        self.assertEqual(selection.missing(), [1, 2, 3, 4])
        # One real challenge is not a sheet, however many ordinary questions remain.
        selection = select(sheet(), [], refuse({"c1": "X", "c3": "X"}), floor=FLOOR)
        self.assertFalse(selection.shorten())
        # A complete sheet has nothing to shorten.
        self.assertFalse(select(sheet(), [], refuse({}), floor=FLOOR).shorten())

    def test_a_sheet_planned_at_its_grade_minimum_is_never_shortened(self):
        # Eight planned at the grade 1-2 minimum of eight: two missing would leave six, never printed.
        selection = select(sheet(practice=5), [], refuse({"p1": "X", "p2": "X"}), floor=FLOOR)
        self.assertFalse(selection.shorten())
        self.assertEqual((selection.missing(), len(selection.layout())), ([1, 2], 6))
        selection = select(sheet(practice=5), [], refuse({"p1": "X"}), floor=FLOOR)
        self.assertFalse(selection.shorten())
        self.assertEqual(selection.missing(), [1])
        # Ten planned: the sheet may lose two, down to the minimum of eight, and not three.
        selection = select(sheet(practice=7), [], refuse({"p1": "X", "p2": "X"}), floor=FLOOR)
        self.assertTrue(selection.shorten())
        self.assertEqual(len(selection.layout()), 8)
        selection = select(sheet(practice=7), [], refuse({"p1": "X", "p2": "X", "p3": "X"}), floor=FLOOR)
        self.assertFalse(selection.shorten())

    def test_the_grade_minimum_wins_over_three_quarters(self):
        # The same twelve questions with three missing: nine is three quarters, and enough for grades 1-2 only.
        bad = {f"p{i}": "X" for i in (1, 2, 3)}
        self.assertTrue(select(sheet(), [], refuse(bad), floor=question_floor(1)).shorten())
        for grade in (3, 4, 5, 6, 7, 8, 9):
            with self.subTest(grade=grade):
                selection = select(sheet(), [], refuse(bad), floor=question_floor(grade))
                self.assertFalse(selection.shorten())
                self.assertEqual((selection.missing(), selection.summary()["dropped"]), ([1, 2, 3], 0))
                self.assertFalse(any(event["action"] == "dropped" for event in selection.record))
        # Grades 3-4 at twelve: one missing question is enough to refuse a shorter sheet.
        self.assertFalse(select(sheet(), [], refuse({"p1": "X"}), floor=question_floor(4)).shorten())
        # Sixteen requested in grades 3-4: twelve is both three quarters and the minimum.
        sixteen = {f"p{i}": "X" for i in (1, 2, 3, 4)}
        self.assertTrue(select(sheet(practice=13), [], refuse(sixteen), floor=question_floor(4)).shorten())
        self.assertFalse(select(sheet(practice=13), [], refuse({**sixteen, "p5": "X"}), floor=question_floor(4)).shorten())
        # Twenty-four requested in grades 7-9: three quarters would allow eighteen, the minimum is twenty.
        four = {f"p{i}": "X" for i in (1, 2, 3, 4)}
        selection = select(sheet(practice=21), [], refuse(four), floor=question_floor(7))
        self.assertTrue(selection.shorten())
        self.assertEqual(len(selection.layout()), 20)
        for missing in (5, 6):
            bad = {f"p{i}": "X" for i in range(1, missing + 1)}
            selection = select(sheet(practice=21), [], refuse(bad), floor=question_floor(7))
            self.assertFalse(selection.shorten(), missing)
            self.assertEqual(len(selection.missing()), missing)

    def test_a_predicate_code_of_any_kind_marks_the_question_bad(self):
        selection = Selection(sheet(), [], lambda question, challenge, number: (7,) if question == "p5" else None, floor=FLOOR)
        self.assertEqual(selection.screen(), [5])
        self.assertEqual(selection.record[0]["codes"], ["7"])

    def test_unknown_groups_and_positions_are_refused(self):
        with self.assertRaises(ValueError):
            Selection([{"group": "bonus", "question": "q"}], [], refuse({}), floor=FLOOR)
        selection = select(sheet(), [], refuse({}), floor=FLOOR)
        for number in (0, 13, "1", True):
            with self.assertRaises(ValueError):
                selection.slot(number)


if __name__ == "__main__":
    unittest.main()
