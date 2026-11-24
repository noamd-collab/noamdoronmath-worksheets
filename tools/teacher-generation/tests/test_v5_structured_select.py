"""v5 sheet selection (structured_select): port of #642 lesson_select without soft/restore, with the grade floor.

Ported from B:tools/teacher-generation/tests/test_lesson_select.py (a95959bb). Not
ported: :137 (it calls restore() for a soft code, a removed relaxation). Rewritten
for v5: :36 (reserve_groups), :43, :158 and :176 (the grade floor replaces
max(6, ceil(3N/4))). :151 is ported: it fills a challenge with a correction and
re-screens; it never calls restore() or uses soft codes.
"""
from __future__ import annotations

import inspect
import math
import sys
import unittest
from dataclasses import fields
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import structured_select as lesson_select  # noqa: E402
from structured_select import (CHALLENGES, MINIMUM_CHALLENGES, NO_QUESTION, PRACTICE, Reserve,  # noqa: E402
                           Selection, Shared, reserve_groups, select)
from runtime_catalog import question_floor  # noqa: E402

FLOOR = 8   # question_floor(1..2); the 12-question test sheet is planned above it


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
    def test_reserve_groups_follow_the_v5_formula(self):            # rewritten from :36
        table = {8: (3, 1), 12: (3, 1), 19: (4, 1), 20: (4, 2), 23: (4, 2), 24: (5, 2), 30: (6, 2)}
        for planned, (practice, challenges) in table.items():
            groups = reserve_groups(planned)
            self.assertEqual(groups, [PRACTICE] * practice + [CHALLENGES] * challenges, planned)
        for planned in range(1, 41):
            practice = max(3, math.ceil(Fraction(planned - 3, 5)))
            self.assertEqual(reserve_groups(planned),
                             [PRACTICE] * practice + [CHALLENGES] * (1 if planned < 20 else 2), planned)
        for bad in (0, -1, 20.0, True, "20", None):
            with self.assertRaises(ValueError):
                reserve_groups(bad)

    def test_the_shortest_sheet_is_the_callers_grade_floor(self):    # rewritten from :43
        # The floors the callers pass are runtime_catalog's grade table.
        self.assertEqual([question_floor(g) for g in range(1, 10)], [8, 8, 12, 12, 14, 14, 20, 20, 20])
        self.assertFalse(hasattr(lesson_select, "minimum_count"))   # no max(6, ceil(3N/4)) rule is left
        self.assertFalse(hasattr(lesson_select, "MINIMUM_SHEET"))
        for function in (Selection.__init__, select):
            parameter = inspect.signature(function).parameters["minimum"]
            self.assertIs(parameter.kind, inspect.Parameter.KEYWORD_ONLY)
            self.assertIs(parameter.default, inspect.Parameter.empty)
        with self.assertRaises(TypeError):
            Selection(sheet(), [], refuse({}))
        with self.assertRaises(TypeError):
            select(sheet(), [], refuse({}))
        for bad in (0, -8, "8", True, 8.0, None):
            with self.assertRaises(ValueError):
                Selection(sheet(), [], refuse({}), minimum=bad)
        self.assertEqual(Selection(sheet(), [], refuse({}), minimum=20).minimum, 20)


class RelaxationRemovedTests(unittest.TestCase):
    def test_there_is_no_soft_parameter_and_no_restore(self):
        self.assertNotIn("soft", inspect.signature(Selection.__init__).parameters)
        self.assertFalse(hasattr(Selection, "restore"))
        self.assertNotIn("kept", [f.name for f in fields(Reserve)])
        with self.assertRaises(TypeError):
            Selection(sheet(), [], refuse({}), soft={"SOFT"}, minimum=FLOOR)

    def test_a_refused_correction_stays_private_and_the_refused_original_never_returns(self):
        selection = select(sheet(), [], refuse({"p2": "SOFT", "private correction": "HARD"}), minimum=FLOOR)
        self.assertEqual(selection.fill(2, "private correction"), ("HARD",))
        slot = selection.slot(2)
        self.assertEqual(slot.correction_input, ("private correction", ("HARD",), "correction"))
        self.assertEqual(selection.fill(2, None), (NO_QUESTION,))   # an omitted row supplies no new candidate
        self.assertEqual(slot.correction_input, ("private correction", ("HARD",), "correction"))
        self.assertNotIn("private correction", str(selection.record))
        self.assertNotIn("p2", str(selection.record))
        # Neither the refused original nor the refused correction is ever printed.
        self.assertEqual(selection.screen("correction"), [2])
        self.assertEqual(selection.missing(), [2])
        self.assertTrue(selection.shorten())
        printed = [s.question for s in selection.layout()]
        self.assertNotIn("p2", printed)
        self.assertNotIn("private correction", printed)
        self.assertEqual(selection.record[0]["action"], "dropped")
        self.assertEqual(selection.record[0]["refused"], [["HARD"], [NO_QUESTION]])

    def test_a_reserve_refused_once_is_never_examined_again(self):
        predicate = refuse({"p4": "X", "r-bad": "Y", "p5": "Z"})
        selection = select(sheet(), rows(PRACTICE, ["r-bad"]), predicate, minimum=FLOOR)
        self.assertEqual(selection.missing(), [4, 5])
        self.assertEqual(sum(1 for question, _, _ in predicate.seen if question == "r-bad"), 1)
        self.assertEqual(selection.reject({6: ["G66"]}, stage="precheck"), [4, 5, 6])
        self.assertEqual(sum(1 for question, _, _ in predicate.seen if question == "r-bad"), 1)
        self.assertNotIn("r-bad", [s.question for s in selection.layout()])


class SelectionTests(unittest.TestCase):
    def test_a_good_reply_is_printed_as_planned_and_no_reserve_is_examined(self):
        predicate = refuse({})
        selection = select(sheet(), rows(PRACTICE, ["r1"]), predicate, minimum=FLOOR)
        self.assertEqual([slot.question for slot in selection.layout()], [f"p{i}" for i in range(1, 10)] + ["c1", "c2", "c3"])
        self.assertEqual((selection.missing(), selection.record), ([], []))
        self.assertNotIn("r1", [question for question, _, _ in predicate.seen])
        # Each planned question was examined once, for its own position and group.
        self.assertEqual(predicate.seen[0], ("p1", False, 1))
        self.assertEqual(predicate.seen[-1], ("c3", True, 12))

    def test_a_bad_question_takes_a_reserve_of_its_own_group_in_its_own_position(self):
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]) + rows(CHALLENGES, ["rc"]),
                           refuse({"p4": "SOURCE_NOTATION", "c2": "PRINTED_ANSWER_KIND"}), minimum=FLOOR)
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
        selection = select(planned, reserves, refuse({"p3": "X", "r-bad": "SOURCE_TABLE"}), minimum=FLOOR)
        self.assertEqual(selection.slot(3).question, "r-same")
        self.assertEqual(selection.summary()["reservesRefused"], 1)
        self.assertEqual(selection.reserves_left(), 1)   # the reserve of another concept was not needed

    def test_a_practice_reserve_stands_in_for_one_challenge_only_while_two_real_challenges_remain(self):
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]), refuse({"c2": "X"}), minimum=FLOOR)
        self.assertEqual(selection.missing(), [])
        stand_in = selection.slot(11)
        self.assertEqual((stand_in.question, stand_in.challenge), ("r1", False))
        # It is printed with the ordinary questions; two starred questions close the sheet.
        self.assertEqual([slot.question for slot in selection.layout()],
                         [f"p{i}" for i in range(1, 10)] + ["r1", "c1", "c3"])
        self.assertEqual(selection.real_challenges(), MINIMUM_CHALLENGES)
        self.assertEqual(selection.record[0]["action"], "reserve_as_practice")
        # With two challenges bad, one real challenge is left: no practice reserve may stand in.
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]), refuse({"c2": "X", "c3": "X"}), minimum=FLOOR)
        self.assertEqual(selection.missing(), [11, 12])
        self.assertEqual(selection.reserves_left(), 2)

    def test_a_challenge_reserve_never_fills_a_practice_position(self):
        selection = select(sheet(), rows(CHALLENGES, ["rc1", "rc2"]), refuse({"p1": "X"}), minimum=FLOOR)
        self.assertEqual(selection.missing(), [1])
        self.assertEqual(selection.reserves_left(), 2)

    def test_practice_positions_are_served_before_a_challenge_borrows_a_practice_reserve(self):
        selection = select(sheet(), rows(PRACTICE, ["r1"]), refuse({"c1": "X", "p9": "X"}), minimum=FLOOR)
        self.assertEqual(selection.slot(9).question, "r1")
        self.assertEqual(selection.missing(), [10])

    def test_a_position_the_author_left_empty_is_missing_and_can_take_a_reserve(self):
        planned = sheet()
        planned[5]["question"] = None
        selection = select(planned, rows(PRACTICE, ["r1"]), refuse({}), minimum=FLOOR)
        self.assertEqual((selection.slot(6).question, selection.record[0]["codes"]), ("r1", [NO_QUESTION]))
        selection = select(planned, [], refuse({}), minimum=FLOOR)
        self.assertEqual(selection.missing(), [6])

    def test_a_later_check_rejects_printed_questions_and_the_remaining_reserves_fill_in(self):
        selection = select(sheet(), rows(PRACTICE, ["r1", "r2"]), refuse({"p2": "SOURCE_NOTATION"}), minimum=FLOOR)
        self.assertEqual(selection.reject({7: ["G66"], 8: ["G60"]}, stage="precheck"), [8])
        self.assertEqual(selection.slot(7).question, "r2")
        self.assertEqual(selection.record[-1], {"question": 8, "group": PRACTICE, "codes": ["G60"],
                                                "stage": "precheck", "action": "missing"})
        self.assertEqual(selection.slot(8).removed, "p8")

    def test_a_correction_fills_a_missing_position_only_when_the_predicate_accepts_it(self):
        selection = select(sheet(), [], refuse({"p2": "SOURCE_NOTATION", "again-bad": "SOURCE_TABLE"}), minimum=FLOOR)
        self.assertEqual(selection.fill(2, "again-bad"), ("SOURCE_TABLE",))
        self.assertEqual(selection.missing(), [2])
        self.assertEqual(selection.fill(2, "fixed"), ())
        self.assertEqual((selection.slot(2).question, selection.slot(2).origin), ("fixed", "correction"))
        self.assertEqual(selection.record[0]["action"], "correction")
        self.assertEqual(selection.record[0]["refused"], [["SOURCE_TABLE"]])
        with self.assertRaises(ValueError):
            selection.fill(3, "p3 is not missing")

    def test_a_corrected_challenge_lets_a_practice_reserve_stand_in_for_the_other(self):   # :151
        selection = select(sheet(), rows(PRACTICE, ["r1"]), refuse({"c1": "X", "c2": "X"}), minimum=FLOOR)
        self.assertEqual(selection.missing(), [10, 11])
        self.assertEqual(selection.fill(10, "c1-fixed"), ())
        self.assertEqual(selection.screen("correction"), [])
        self.assertEqual((selection.slot(11).question, selection.slot(11).challenge), ("r1", False))

    def test_a_shorter_sheet_keeps_the_grade_floor_and_two_real_challenges(self):     # rewritten from :158
        bad = {f"p{i}": "X" for i in (1, 2, 3)}
        selection = select(sheet(), [], refuse(bad), minimum=FLOOR)
        self.assertTrue(selection.can_shorten())
        self.assertTrue(selection.shorten())
        self.assertEqual([slot.question for slot in selection.layout()], [f"p{i}" for i in range(4, 10)] + ["c1", "c2", "c3"])
        self.assertEqual((selection.missing(), selection.summary()["dropped"]), ([], 3))
        self.assertEqual((selection.summary()["droppedCodes"], selection.summary()["replacedCodes"]), ({"X": 3}, {}))
        self.assertTrue(all(event["action"] == "dropped" for event in selection.record))
        # Four of twelve missing leaves eight, exactly the floor: allowed (three quarters would have been nine).
        selection = select(sheet(), [], refuse({**bad, "p4": "X"}), minimum=FLOOR)
        self.assertTrue(selection.shorten())
        self.assertEqual(len(selection.layout()), FLOOR)
        # Five missing leaves seven, below the floor of eight.
        selection = select(sheet(), [], refuse({**bad, "p4": "X", "p5": "X"}), minimum=FLOOR)
        self.assertFalse(selection.can_shorten())
        self.assertFalse(selection.shorten())
        self.assertEqual(selection.missing(), [1, 2, 3, 4, 5])
        self.assertTrue(all(event["action"] == "missing" for event in selection.record))
        # One real challenge is not a sheet, however many ordinary questions remain.
        selection = select(sheet(), [], refuse({"c1": "X", "c3": "X"}), minimum=FLOOR)
        self.assertFalse(selection.shorten())
        # A complete sheet has nothing to shorten.
        self.assertFalse(select(sheet(), [], refuse({}), minimum=FLOOR).shorten())

    def test_the_floor_is_the_callers_minimum_not_six(self):                         # rewritten from :176
        # Eight planned at the grade 1-2 floor of eight: nothing may be dropped, although B allowed six.
        selection = select(sheet(practice=5), [], refuse({"p1": "X"}), minimum=8)
        self.assertFalse(selection.shorten())
        self.assertEqual(selection.missing(), [1])
        # Fourteen planned at the grade 3-4 floor of twelve: two may be dropped, three may not.
        selection = select(sheet(practice=11), [], refuse({"p1": "X", "p2": "X"}), minimum=12)
        self.assertTrue(selection.shorten())
        self.assertEqual(len(selection.layout()), 12)
        selection = select(sheet(practice=11), [], refuse({"p1": "X", "p2": "X", "p3": "X"}), minimum=12)
        self.assertFalse(selection.shorten())

    def test_a_predicate_code_of_any_kind_marks_the_question_bad(self):
        selection = Selection(sheet(), [], lambda question, challenge, number: (7,) if question == "p5" else None,
                              minimum=FLOOR)
        self.assertEqual(selection.screen(), [5])
        self.assertEqual(selection.record[0]["codes"], ["7"])

    def test_unknown_groups_and_positions_are_refused(self):
        with self.assertRaises(ValueError):
            Selection([{"group": "bonus", "question": "q"}], [], refuse({}), minimum=FLOOR)
        selection = select(sheet(), [], refuse({}), minimum=FLOOR)
        for number in (0, 13, "1", True):
            with self.assertRaises(ValueError):
                selection.slot(number)


def stage_two_rows():
    """The section 2.3 plan of the first sheet: Q1-Q17 practice (#0 x6, #1 x6, #2 x5), Q18-Q20
    find_error challenges (#2); reserves R1-R4 practice (#0, #1, #2, #0), R5-R6 challenges (#2)."""
    concept = "g7:algebraic_expressions#%d".__mod__
    planned = ([{"group": PRACTICE, "question": f"Q{n}", "concepts": (concept(0 if n <= 6 else 1 if n <= 12 else 2),)}
                for n in range(1, 18)]
               + [{"group": CHALLENGES, "question": f"Q{n}", "concepts": (concept(2),)} for n in range(18, 21)])
    groups = reserve_groups(20)
    reserves = []
    for number, group in enumerate(groups, 1):
        concepts = (concept((number - 1) % 3),) if group == PRACTICE else (concept(2),)
        reserves.append({"group": group, "question": f"R{number}", "concepts": concepts})
    return planned, reserves


class StageTwoSheetTests(unittest.TestCase):
    def test_the_first_sheet_replaces_exactly_q4_q9_q14_q19(self):
        planned, reserves = stage_two_rows()
        self.assertEqual([r["group"] for r in reserves], [PRACTICE] * 4 + [CHALLENGES] * 2)
        bad = {"Q4": "TEMPLATE_MISMATCH", "Q9": "MATH_SCOPE_PRODUCT_OF_SUM", "Q14": "LEAK_PINNED_VALUE",
               "Q19": "MISTAKE_UNMODELED"}
        selection = select(planned, reserves, refuse(bad), minimum=question_floor(7))
        self.assertEqual(selection.missing(), [])
        self.assertEqual({e["question"]: e["reserve"] for e in selection.record}, {4: 1, 9: 2, 14: 3, 19: 5})
        self.assertEqual(sorted(r.number for r in selection.reserves if not r.used), [4, 6])
        layout = [s.question for s in selection.layout()]
        self.assertEqual(len(layout), 20)
        self.assertEqual(layout[3], "R1")
        self.assertEqual(layout[-3:], ["Q18", "R5", "Q20"])
        self.assertEqual(selection.real_challenges(), 3)
        self.assertEqual(selection.summary()["replaced"], 4)
        self.assertFalse(selection.can_shorten())

    def test_at_the_floor_a_missing_question_cannot_be_dropped(self):
        planned, reserves = stage_two_rows()
        bad = {f"Q{n}": "X" for n in (1, 2, 3, 4, 5)}   # five practice refusals, four practice reserves
        selection = select(planned, reserves, refuse(bad), minimum=question_floor(7))
        self.assertEqual(selection.missing(), [5])
        self.assertFalse(selection.can_shorten())
        self.assertFalse(selection.shorten())
        self.assertEqual(selection.missing(), [5])

    def test_a_repair_fill_is_counted_as_a_replacement(self):
        planned, _ = stage_two_rows()
        selection = select(planned, [], refuse({"Q4": "ITEM_COUNT"}), minimum=question_floor(7))
        self.assertEqual(selection.fill(4, "Q4-repaired", origin="repair"), ())
        self.assertEqual((selection.slot(4).question, selection.slot(4).origin), ("Q4-repaired", "repair"))
        self.assertEqual(selection.record[0]["action"], "repair")
        summary = selection.summary()
        self.assertEqual((summary["replaced"], summary["byCorrection"], summary["byReserve"]), (1, 1, 0))
        self.assertEqual(summary["replacedCodes"], {"ITEM_COUNT": 1})

    def test_the_selection_is_deterministic(self):
        def run():
            planned, reserves = stage_two_rows()
            selection = select(planned, reserves, refuse({"Q4": "A", "Q19": "B", "R1": "C"}), minimum=20)
            return [s.question for s in selection.layout()], selection.record, selection.summary()
        self.assertEqual(run(), run())

    def test_a_shared_limit_removes_the_later_repeat_and_refuses_a_reserve_over_it(self):
        drawing = Shared(key=lambda q: "drawing" if q.startswith("d") else None, cap=1, code="SHARED_DRAWING")
        planned = rows(PRACTICE, ["d1", "p2", "d3", "p4"]) + rows(CHALLENGES, ["c1", "c2"])
        selection = Selection(planned, rows(PRACTICE, ["d-reserve", "r2"]), refuse({}), drawing, minimum=4)
        self.assertEqual(selection.screen(), [])
        self.assertEqual(selection.slot(3).question, "r2")
        self.assertEqual(selection.record[0]["codes"], ["SHARED_DRAWING"])
        self.assertEqual(selection.record[0]["stage"], "sheet")
        self.assertEqual(selection.reserves[0].codes, ("SHARED_DRAWING",))


if __name__ == "__main__":
    unittest.main()
