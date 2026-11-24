"""structured_source: plan, wire, per-question pipeline, selection, repairs and the exact delivery rule (V5-DESIGN §6.1)."""
import copy
import json
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import lesson_select  # noqa: E402
import structured_source as ss  # noqa: E402
from structured_contract import PlanRow  # noqa: E402

C0, C1, C2 = ("g7:algebraic_expressions#0",), ("g7:algebraic_expressions#1",), ("g7:algebraic_expressions#2",)


def by_slot(reply):
    return {question["slot"]: question for question in reply["questions"]}


def with_questions(questions):
    return {"questions": questions}


class Plan(unittest.TestCase):
    def test_plan_slots_for_the_fixture(self):
        planned, reserves = ss.plan_slots(S.lesson(), S.scope(), S.overlay())
        self.assertEqual([row.slot for row in planned], ["Q%d" % n for n in range(1, 21)])
        self.assertEqual([row.slot for row in reserves], ["R%d" % n for n in range(1, 7)])
        concepts = [row.concepts for row in planned]
        self.assertEqual(concepts, [C0] * 6 + [C1] * 6 + [C2] * 5 + [C2] * 3)
        self.assertEqual([row.group for row in planned], ["practice"] * 17 + ["challenges"] * 3)
        self.assertEqual({row.kinds for row in planned[17:]}, {("find_error_collect",)})
        self.assertEqual([(row.group, row.concepts) for row in reserves],
                         [("practice", C0), ("practice", C1), ("practice", C2), ("practice", C0),
                          ("challenges", C2), ("challenges", C2)])

    def test_unsupported_topic(self):
        lesson = dict(S.lesson(), level="a")
        with self.assertRaises(ss.V5Error) as caught:
            ss.compile_sheet(lesson, S.scope(), S.reply(), skill_path="/unused")
        self.assertEqual(caught.exception.code, "WIRE_TOPIC_UNSUPPORTED")


class Wire(unittest.TestCase):
    def setUp(self):
        self.planned, self.reserves = ss.plan_slots(S.lesson(), S.scope(), S.overlay())

    def test_parse_wire_errors(self):
        for reply in ([], {"questions": [], "rule": []}, {"questions": {}}, {"questions": []},
                      {"questions": [{"slot": "Q1"}] * 53}):
            with self.subTest(reply=str(reply)[:40]):
                with self.assertRaises(ss.V5Error) as caught:
                    ss.parse_wire(reply, self.planned, self.reserves)
                self.assertEqual(caught.exception.code, "WIRE_SHAPE")
        for text in ('{"questions": [', '{"questions": [], "questions": []}', '{"questions": [NaN]}',
                     b'\xff', "x" * 200_001):
            with self.subTest(text=str(text)[:40]):
                with self.assertRaises(ss.V5Error) as caught:
                    ss.parse_wire(text, self.planned, self.reserves)
                self.assertEqual(caught.exception.code, "WIRE_JSON")

    def test_slot_refusals_first_occurrence_wins(self):
        good = by_slot(S.reply())
        second = copy.deepcopy(good["Q3"])
        second["items"] = []
        wires, refusals = ss.parse_wire(with_questions([good["Q3"], second, dict(good["Q1"], slot="Q21"),
                                                        dict(good["Q1"], slot="שלום"), "x"]),
                                        self.planned, self.reserves)
        self.assertEqual(wires, {"Q3": good["Q3"]})
        self.assertEqual([refusal.record() for refusal in refusals], [
            {"slot": "Q3", "item": 0, "field": "slot", "code": "Q_SLOT_DUPLICATE"},
            {"slot": "Q21", "item": 0, "field": "slot", "code": "Q_SLOT_UNKNOWN"},
            {"slot": "", "item": 0, "field": "slot", "code": "Q_SLOT_UNKNOWN"},
            {"slot": "", "item": 0, "field": "slot", "code": "Q_SHAPE"}])

    def test_a_json_text_reply_is_read_strictly(self):
        text = json.dumps(S.reply(), ensure_ascii=False)
        wires, refusals = ss.parse_wire(text, self.planned, self.reserves)
        self.assertEqual(len(wires), 26)
        self.assertEqual(refusals, [])


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class Questions(unittest.TestCase):
    def setUp(self):
        self.ctx = S.context(str(S.MIDDLE))
        self.rows = S.rows()

    def test_every_adversarial_case_gives_its_exact_codes(self):
        cases = S.load("reply-g7-adversarial.json")
        self.assertGreaterEqual(len(cases), 34)
        good_q3 = by_slot(S.reply())["Q3"]
        for case in cases:
            with self.subTest(case=case["case"]):
                if case["stage"] == "parse":
                    planned, reserves = ss.plan_slots(S.lesson(), S.scope(), S.overlay())
                    _, refusals = ss.parse_wire(with_questions([good_q3, case["question"]]), planned, reserves)
                    codes = sorted({refusal.code for refusal in refusals})
                else:
                    codes = list(ss.compile_question(case["question"], self.rows[case["slot"]], self.ctx).codes)
                self.assertEqual(codes, case["expect"])

    def test_good_questions_compile_and_q12_is_trimmed(self):
        good = by_slot(S.reply())
        for slot in ("Q1", "Q7", "Q13", "Q18", "R1", "R2", "R3", "R5", "R6"):
            compiled = ss.compile_question(good[slot], self.rows[slot], self.ctx)
            self.assertEqual(compiled.codes, (), slot)
            self.assertEqual(compiled.refusals, [], slot)
        q12 = ss.compile_question(good["Q12"], self.rows["Q12"], self.ctx)
        self.assertEqual(q12.codes, ())
        self.assertEqual(q12.trimmed, (3,))
        self.assertEqual(len(q12.ir["items"]), 3)
        self.assertEqual([refusal.record() for refusal in q12.refusals],
                         [{"slot": "Q12", "item": 3, "field": "values", "code": "VALUES_MISMATCH"}])
        star = ss.compile_question(good["Q18"], self.rows["Q18"], self.ctx).ir["star"]
        self.assertIs(star, True)

    def test_designed_refusals(self):
        good = by_slot(S.reply())
        expected = {"Q4": ("ITEM_COUNT", "TEMPLATE_MISMATCH"), "Q9": ("ITEM_COUNT", "MATH_SCOPE_PRODUCT_OF_SUM"),
                    "Q14": ("ITEM_COUNT", "LEAK_PINNED_VALUE"), "Q19": ("ITEM_COUNT", "MISTAKE_UNMODELED")}
        for slot, codes in expected.items():
            compiled = ss.compile_question(good[slot], self.rows[slot], self.ctx)
            self.assertEqual(compiled.codes, codes, slot)
            self.assertIsNone(compiled.ir)

    def test_question_codes_are_sorted_unique(self):
        question = S.question("Q13", "collect_like_terms", [S.item("3(x+2)"), S.item("3x+5"), S.item("x/2+x")],
                              intro="שלום")
        codes = ss.compile_question(question, self.rows["Q13"], self.ctx).codes
        self.assertEqual(list(codes), sorted(set(codes)))
        self.assertIn("FIELD_NOT_EMPTY", codes)


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class Sheet(unittest.TestCase):
    def compile(self, reply=None, **kwargs):
        return ss.compile_sheet(S.lesson(), S.scope(), reply or S.reply(), skill_path=str(S.MIDDLE), **kwargs)

    def test_good_reply_delivers_twenty_with_exact_replacements(self):
        result = S.compiled_good()
        selection = result["ir"]["selection"]
        self.assertEqual((selection["requested"], selection["floor"], selection["delivered"]), (20, 20, 20))
        self.assertEqual(selection["replaced"], [
            {"slot": "Q4", "by": "R1", "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]},
            {"slot": "Q9", "by": "R2", "codes": ["ITEM_COUNT", "MATH_SCOPE_PRODUCT_OF_SUM"]},
            {"slot": "Q14", "by": "R3", "codes": ["ITEM_COUNT", "LEAK_PINNED_VALUE"]},
            {"slot": "Q19", "by": "R5", "codes": ["ITEM_COUNT", "MISTAKE_UNMODELED"]}])
        self.assertEqual(selection["dropped"], [])
        printed = [(row["slot"], row["origin"], row["star"]) for row in selection["questions"]]
        self.assertEqual(printed[3], ("R1", "reserve", False))
        self.assertEqual(printed[17:], [("Q18", "planned", True), ("R5", "reserve", True), ("Q20", "planned", True)])
        self.assertEqual(result["diagnostics"]["trimmed"], [{"slot": "Q12", "items": [3]}])
        self.assertEqual(result["diagnostics"]["repairRounds"], 0)
        self.assertEqual(result["ir"]["contract"], "worksheet-wire/5")
        self.assertEqual(len(result["ir"]["sections"][0]["questions"]), 20)
        self.assertNotIn("R4", [row["slot"] for row in selection["questions"]])
        self.assertNotIn("R6", [row["slot"] for row in selection["questions"]])

    def test_ir_passes_validate_source(self):
        from general_source import validate_source
        checked = validate_source(S.lesson(), S.ir_good(), S.scope())
        self.assertEqual(len(checked["evidence"]["computations"]), 60)
        self.assertEqual(checked["evidence"]["unverifiedAnswers"], [])

    def test_determinism(self):
        first = json.dumps(self.compile().ir, ensure_ascii=False)
        second = json.dumps(self.compile().ir, ensure_ascii=False)
        self.assertEqual(first, second)

    def test_diagnostics_hold_no_model_text(self):
        diagnostics = json.dumps(S.compiled_good()["diagnostics"], ensure_ascii=False)
        self.assertIsNone(re.search(r"[א-ת]", diagnostics))
        for question in S.reply()["questions"]:
            for item in question["items"]:
                for field in ("expr", "expr2", "values"):
                    if re.search(r"[0-9+\-=]", item[field]):
                        self.assertNotIn(item[field], diagnostics)

    def test_question_missing_takes_a_reserve(self):
        reply = with_questions([q for q in S.reply()["questions"] if q["slot"] != "Q2"])
        selection = self.compile(reply).ir["selection"]
        self.assertIn({"slot": "Q2", "by": "R1", "codes": ["QUESTION_MISSING"]}, selection["replaced"])
        self.assertIn({"slot": "Q4", "by": "R4", "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]}, selection["replaced"])

    def test_duplicate_task_across_questions(self):
        reply = S.reply()
        by_slot(reply)["Q5"]["items"][0] = S.item("4x", variant="W_TIMES")     # Q1 already asks for 4x
        result = self.compile(reply)
        self.assertIn({"slot": "Q5", "by": "R4", "codes": ["DUPLICATE_TASK"]}, result.ir["selection"]["replaced"])
        self.assertEqual(result.diagnostics["record"][-1]["stage"], "sheet")

    def test_leak_sheet_inverse(self):
        reply = S.reply()
        by_slot(reply)["Q16"]["items"][1] = S.item("7x+3+x+2")        # holds Q15's key 7x+3 as a run
        result = self.compile(reply)
        self.assertIn({"slot": "Q16", "by": "R4", "codes": ["LEAK_SHEET_INVERSE"]}, result.ir["selection"]["replaced"])

    def test_below_minimum_without_repair_and_filled_by_repair(self):
        good = by_slot(S.reply())
        variant = [q for q in S.reply()["questions"] if q["slot"] not in ("Q4", "R1", "R2", "R3", "R4")]
        for question in variant:
            if question["slot"] == "Q9":
                question["items"] = copy.deepcopy(good["R2"]["items"])
            if question["slot"] == "Q14":
                question["items"] = copy.deepcopy(good["R3"]["items"])
        with self.assertRaises(ss.V5Error) as caught:
            self.compile(with_questions(variant))
        self.assertEqual(caught.exception.code, "SHEET_BELOW_MINIMUM")
        targets = ss.repair_targets(caught.exception.diagnostics)
        self.assertEqual(targets, [{"slot": "Q4", "group": "practice", "concepts": list(C0),
                                    "kinds": ["write_from_words"], "codes": ["QUESTION_MISSING"]}])
        result = self.compile(with_questions(variant), repairs=[S.load("repair-g7-round1.json")])
        selection = result.ir["selection"]
        self.assertEqual(selection["delivered"], 20)
        self.assertIn({"slot": "Q4", "by": "REPAIR", "codes": ["QUESTION_MISSING"]}, selection["replaced"])
        self.assertEqual(selection["questions"][3], {"n": 4, "slot": "Q4", "origin": "repair", "conceptIds": list(C0),
                                                     "star": False})
        self.assertEqual(result.diagnostics["repairRounds"], 1)

    def test_repair_budget_and_slot_not_missing(self):
        with self.assertRaises(ss.V5Error) as caught:
            self.compile(repairs=[{}, {}, {}])
        self.assertEqual(caught.exception.code, "REPAIR_BUDGET")
        result = self.compile(repairs=[S.load("repair-g7-round1.json")])   # Q4 already has R1: not missing
        self.assertIn({"slot": "Q4", "item": 0, "field": "slot", "code": "REPAIR_SLOT_NOT_MISSING"},
                      result.diagnostics["refusals"])
        self.assertIn({"slot": "Q4", "by": "R1", "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]},
                      result.ir["selection"]["replaced"])

    def test_runtime_not_configured(self):
        with self.assertRaises(ss.V5Error) as caught:
            ss.compile_sheet(S.lesson(), S.scope(), S.reply(), skill_path="")
        self.assertEqual(caught.exception.code, "RUNTIME_NOT_CONFIGURED")

    def clean_practice_reply(self):
        """The good reply with Q4, Q9 and Q14 rewritten clean, so all four practice reserves stay free."""
        reply = S.reply()
        slots = by_slot(reply)
        slots["Q4"]["items"] = copy.deepcopy(S.load("repair-g7-round1.json")["Q4"]["items"])
        slots["Q9"]["items"] = [S.item("3x-1", values="x=4"), S.item("8+a", values="a=-3"),
                                S.item("6b-b", values="b=2")]
        slots["Q14"]["items"] = [S.item("2b+6-b+3"), S.item("x+x+7-2"), S.item("4a+10-a-1")]
        return reply

    def test_sheet_stars_via_a_selection_without_the_challenge_guard(self):
        reply = self.clean_practice_reply()
        for slot in ("Q18", "Q19", "Q20", "R5", "R6"):
            by_slot(reply)[slot]["items"][0] = S.item("3x+4+x+1", "8x", variant="M1")   # MISTAKE_UNMODELED
        with self.assertRaises(ss.V5Error) as caught:
            self.compile(reply)          # a practice stand-in prints only while two real challenges stand
        self.assertEqual(caught.exception.code, "SHEET_BELOW_MINIMUM")
        self.assertEqual([target["slot"] for target in ss.repair_targets(caught.exception.diagnostics)],
                         ["Q18", "Q19", "Q20"])
        with patch.object(lesson_select, "MINIMUM_CHALLENGES", 0):   # a crafted selection without that guard
            with self.assertRaises(ss.V5Error) as caught:
                self.compile(reply)
        self.assertEqual(caught.exception.code, "SHEET_STARS")
        actions = [event["action"] for event in caught.exception.diagnostics["record"]]
        self.assertEqual(actions.count("reserve_as_practice"), 3)

    def test_sheet_coverage_via_crafted_rows(self):
        planned, reserves = ss.plan_slots(S.lesson(), S.scope(), S.overlay())
        crafted = [PlanRow(row.slot, row.number, row.group, C0, ("write_from_words",)) if row.concepts == C1
                   else row for row in planned]
        reply = S.reply()
        tasks = ("13x", "14y", "15a", "16b", "17x", "18y", "19a", "20b", "13y", "14a", "15b", "16x", "17y", "18a",
                 "19b", "20x", "13a", "14b")
        for n in range(7, 13):                       # the #1 rows now carry distinct #0 questions
            question = by_slot(reply)["Q%d" % n]
            question["kind"] = "write_from_words"
            question["items"] = [S.item(task, variant="W_TIMES") for task in tasks[3 * (n - 7):3 * (n - 6)]]
        with patch.object(ss, "plan_slots", return_value=(crafted, reserves)):
            with self.assertRaises(ss.V5Error) as caught:
                self.compile(reply)
        self.assertEqual(caught.exception.code, "SHEET_COVERAGE")

    def test_a_shorter_sheet_only_when_n_is_above_the_floor(self):
        """N = 23 > floor 20: two missing positions with no reserve are dropped (D2); four would go below the floor."""
        lesson = dict(S.lesson(), questionCount=23)
        good = by_slot(S.reply())
        plan = {"Q%d" % n: good[slot] for n, slot in enumerate(
            ["Q1", "Q2", "Q3", "Q5", "Q6", "R1", "R4", "Q7", "Q8", "Q10", "Q11", "Q12", "R2", None,
             "Q13", "Q15", "Q16", "Q17", "R3", None, "Q18", "Q20", "R5"], 1) if slot}
        reply = with_questions([dict(copy.deepcopy(question), slot=slot) for slot, question in plan.items()])
        result = ss.compile_sheet(lesson, S.scope(lesson), reply, skill_path=str(S.MIDDLE))
        selection = result.ir["selection"]
        self.assertEqual((selection["requested"], selection["floor"], selection["delivered"]), (23, 20, 21))
        self.assertEqual(selection["dropped"], [{"slot": "Q14", "codes": ["QUESTION_MISSING"]},
                                                {"slot": "Q20", "codes": ["QUESTION_MISSING"]}])
        fewer = with_questions([q for q in reply["questions"] if q["slot"] not in ("Q1", "Q8")])
        with self.assertRaises(ss.V5Error) as caught:
            ss.compile_sheet(lesson, S.scope(lesson), fewer, skill_path=str(S.MIDDLE))
        self.assertEqual(caught.exception.code, "SHEET_BELOW_MINIMUM")

if __name__ == "__main__":
    unittest.main()
