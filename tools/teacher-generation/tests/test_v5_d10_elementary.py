"""worksheet-wire/5 on the elementary path, topic ד10 (grade 4, חילוק ארוך ושארית, level a): the kernel task
divide_remainder, the elementary sign table, the ד10 overlay and its plan, the two division kinds at compile time
and in the final validator, and the fixtures in tests/fixtures/v5/d10/:

- lesson.json: the repro ד10 lesson, verbatim (scratchpad repro/lessons.json);
- reply_good.json: 12 planned questions (one drill, 11 stories, Q10-Q12 starred) and 4 reserves, all clean;
- reply_replacements.json: four planned questions refused for four reasons, every reserve used;
- adversarial.json: single questions, each with the exact code set written by hand;
- expected.json: hand-computed keys, cross-checked here against an independent long-division routine.
"""
import copy
import json
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402

import division_kinds as dk  # noqa: E402
from general_source import GeneralSourceError, V5_CONTRACT, validate_source  # noqa: E402
from math_tasks import MathTaskError, number, operation, to_house_math, validate_and_solve_task  # noqa: E402
import school_math as sm  # noqa: E402
import structured_contract as sc  # noqa: E402
import structured_source as ss  # noqa: E402

D10 = S.FIXTURES / "d10"
TOPIC = "ד10"
TRUSTED = {"contract": V5_CONTRACT}


def load(name):
    return json.loads((D10 / name).read_text(encoding="utf-8"))


def lesson():
    return load("lesson.json")


def scope(of=None):
    from runtime_catalog import scope_for_lesson
    return scope_for_lesson(of or lesson())


def overlay():
    return sc.overlay_for(TOPIC, "a")


def rows():
    planned, reserves = sc.plan_rows(lesson(), scope(), overlay())
    return {row.slot: row for row in list(planned) + list(reserves)}


def context():
    from item_kinds import Context
    return Context(lesson(), scope(), overlay(), str(S.ELEMENTARY))


def long_division(dividend, divisor):
    """The school algorithm, digit by digit from the left (independent of divmod and of the kernel)."""
    quotient, carry = "", 0
    for digit in str(dividend):
        carry = carry * 10 + int(digit)
        times = 0
        while (times + 1) * divisor <= carry:
            times += 1
        quotient += str(times)
        carry -= times * divisor
    return int(quotient), carry


def compile_good(name="reply_good.json"):
    return ss.compile_sheet(lesson(), scope(), load(name), skill_path=str(S.ELEMENTARY))


def task(dividend, divisor):
    return {"kind": "divide_remainder", "dividend": number(dividend), "divisor": number(divisor)}


# ------------------------------------------------------------------ the kernel task

class DivideRemainderKernel(unittest.TestCase):
    def test_hand_values(self):
        for (dividend, divisor), (quotient, remainder) in {(125, 4): (31, 1), (347, 5): (69, 2), (216, 8): (27, 0),
                                                           (593, 7): (84, 5), (413, 4): (103, 1),
                                                           (965, 9): (107, 2), (100, 2): (50, 0)}.items():
            solved = validate_and_solve_task(task(dividend, divisor))
            self.assertEqual(solved["result"], {"type": "quotient_remainder", "quotient": number(quotient),
                                                "remainder": number(remainder)})
            self.assertEqual(solved["question"], task(dividend, divisor))
            self.assertEqual(solved["questionMath"], "%d:%d" % (dividend, divisor))
            self.assertEqual(solved["domain"], {"numberSystem": "real", "variables": [], "conditions": []})

    def test_every_level_a_division_agrees_with_the_school_algorithm(self):
        for dividend in range(100, 1000):
            for divisor in range(2, 10):
                result = validate_and_solve_task(task(dividend, divisor))["result"]
                expected = long_division(dividend, divisor)
                self.assertEqual((result["quotient"]["numerator"], result["remainder"]["numerator"]), expected)

    def test_refusals_use_existing_kernel_codes_only(self):
        cases = {
            "divisor one": (task(125, 1), "INVALID_TASK"),
            "divisor zero": ({"kind": "divide_remainder", "dividend": number(125), "divisor": number(0)},
                             "INVALID_TASK"),
            "dividend zero": (task(0, 4), "INVALID_TASK"),
            "negative dividend": ({"kind": "divide_remainder", "dividend": number(-125), "divisor": number(4)},
                                  "INVALID_TASK"),
            "fraction": ({"kind": "divide_remainder", "dividend": number(5, 2), "divisor": number(4)}, "INVALID_TASK"),
            "expression operand": ({"kind": "divide_remainder", "dividend": operation("add", number(1), number(2)),
                                    "divisor": number(4)}, "INVALID_TASK"),
            "missing divisor": ({"kind": "divide_remainder", "dividend": number(125)}, "INVALID_TASK"),
            "extra field": (dict(task(125, 4), remainder=number(1)), "INVALID_TASK"),
            "unbounded dividend": (task(10 ** 7, 4), "INVALID_AST"),
            "bool numerator": ({"kind": "divide_remainder", "dividend": {"type": "number", "numerator": True,
                                                                         "denominator": 1}, "divisor": number(4)},
                               "INVALID_AST"),
        }
        for name, (bad, code) in cases.items():
            with self.subTest(name=name), self.assertRaises(MathTaskError) as caught:
                validate_and_solve_task(bad)
            self.assertEqual(caught.exception.code, code)

    def test_existing_kinds_and_the_house_printer_are_unchanged(self):
        self.assertEqual(validate_and_solve_task({"kind": "evaluate", "expression": operation(
            "divide", number(125), number(4))})["result"], {"type": "expression", "value": number(125, 4)})
        self.assertEqual(to_house_math(operation("divide", number(125), number(4))), "\\f{125}{4}")
        with self.assertRaises(MathTaskError) as caught:
            validate_and_solve_task({"kind": "geometry_proof", "expression": number(1)})
        self.assertEqual(caught.exception.code, "UNSUPPORTED_TASK")

    def test_the_v4_contract_still_refuses_the_task(self):
        from test_general_source import fixture
        v4_lesson, payload = fixture("ד11", 4)
        payload["sections"][0]["questions"][0]["items"][0]["answer"]["task"] = task(125, 4)
        for provider in (False, True):
            with self.subTest(provider=provider), self.assertRaises(GeneralSourceError) as caught:
                validate_source(v4_lesson, copy.deepcopy(payload), scope(v4_lesson), provider=provider)
            self.assertEqual(caught.exception.code, "UNSUPPORTED_TASK")
            self.assertEqual(str(caught.exception),
                             "A typed mathematical task is invalid or outside the supported exact verifier")


# ------------------------------------------------------------------ the elementary sign table

class ElementaryPrinter(unittest.TestCase):
    def node(self, text):
        return sm.parse(text, letters=(), allow_relation=True)

    def test_house_strings(self):
        cases = {("125:4", "ד"): "125 : 4", ("125:4=31", "ד"): "125 : 4 = 31", ("1250:4", "ד"): "1,250 : 4",
                 ("1250:4", "ב"): "1250 : 4", ("2*3+4", "ד"): "2 x 3 + 4", ("2*3", "ב"): "2 × 3",
                 ("-5+3", "ד"): "−5 + 3", ("(7-2):5", "ג"): "(7 − 2) : 5", ("125/4", "ד"): "125 : 4"}
        for (text, grade), expected in cases.items():
            printed = sm.to_elementary(self.node(text), grade)
            self.assertEqual(printed, expected, text)
            self.assertNotIn("-", printed)

    def test_unprintable_input(self):
        for text, grade in (("2.5", "ד"), ("30%", "ד"), ("2*3", "א"), ("8:2", "א")):
            with self.subTest(text=text), self.assertRaises(sm.SchoolMathError) as caught:
                sm.to_elementary(self.node(text), grade)
            self.assertEqual(caught.exception.code, "FORM_UNREPRESENTABLE")
        with self.assertRaises(sm.SchoolMathError):
            sm.to_elementary(sm.parse("x+1", letters=("x",)), "ד")
        with self.assertRaises(ValueError):
            sm.to_elementary(self.node("1"), "ז")

    @unittest.skipUnless(S.ELEMENTARY_PINNED, "Pinned elementary skill unavailable")
    def test_the_table_is_the_pinned_signs_profile(self):
        signs = dk.pinned_elementary(str(S.ELEMENTARY), "scripts/lib/signs.py")
        self.assertEqual(sm.MINUS, signs.MINUS)
        for grade in sm.ELEMENTARY_GRADES:
            row, pinned = sm.ELEMENTARY_SIGNS[grade], signs.PROFILE[grade]
            self.assertEqual((row["mul"], row["div"], row["thousands"]), (pinned["mul"], pinned["div"],
                                                                          pinned["thousands"]), grade)
            if pinned["div"]:
                self.assertEqual(sm.to_elementary(self.node("4562:7"), grade),
                                 "%s : %s" % (signs.fmt(4562, grade), signs.fmt(7, grade)))
            if pinned["mul"]:
                self.assertEqual(sm.to_elementary(self.node("6*4"), grade), signs.expr(6, "*", 4, grade, eq=False))
        self.assertEqual(sm.to_elementary(self.node("125:4"), "ד") + " =", signs.expr(125, "/", 4, "ד"))


# ------------------------------------------------------------------ the overlay, plan, schema and card

class D10Overlay(unittest.TestCase):
    def test_enabled_for_level_a_only_and_unreviewed(self):
        ov = overlay()
        self.assertIsNotNone(ov)
        for level in ("b", "e", None):
            self.assertIsNone(sc.overlay_for(TOPIC, level))
        self.assertIs(ov["reviewed"], False)
        self.assertEqual(ov["skill"], "elementary")
        self.assertLessEqual({"title", "rule", "verbs", "stories", "remainderWord", "profile", "challengeRule"},
                             set(ov["pendingReview"]))
        sc.check_overlay(ov)
        with self.assertRaises(TypeError):
            ov["stories"]["S_EGGS"] = {}

    def test_the_lesson_is_the_repro_lesson(self):
        self.assertEqual(lesson()["lastLesson"], "תרגלנו חילוק ארוך של מספר תלת-ספרתי במספר חד-ספרתי, עם שארית "
                                                 "ובלי שארית. עדיין לא למדנו בדיקת חילוק בעזרת כפל.")
        self.assertEqual((lesson()["gradeNumber"], lesson()["level"], lesson()["questionCount"]), (4, "a", 12))
        self.assertEqual([c["id"] for c in scope()["selectedConcepts"]], ["ד10#0", "ד10#1"])
        self.assertEqual([c["id"] for c in scope()["excludedConcepts"]], ["ד10#2"])     # בדיקת חילוק

    def test_plan_rows(self):
        planned, reserves = sc.plan_rows(lesson(), scope(), overlay())
        both, story = ("division_remainder_drill", "division_story"), ("division_story",)
        self.assertEqual([(r.slot, r.group, r.concepts, r.kinds) for r in planned],
                         [("Q%d" % n, "practice", ("ד10#0",), both) for n in range(1, 6)]
                         + [("Q%d" % n, "practice", ("ד10#1",), story) for n in range(6, 10)]
                         + [("Q%d" % n, "challenges", ("ד10#1",), story) for n in range(10, 13)])
        self.assertEqual([(r.slot, r.group, r.concepts, r.kinds) for r in reserves],
                         [("R1", "practice", ("ד10#0",), both), ("R2", "practice", ("ד10#1",), story),
                          ("R3", "practice", ("ד10#0",), both), ("R4", "challenges", ("ד10#1",), story)])
        from skill_authoring import question_plan
        self.assertEqual([list(r.concepts) for r in planned[:9]],
                         [row["conceptIds"] for row in question_plan(lesson(), scope())[:9]])

    def test_schema_card_and_reply(self):
        from test_v5_structured_contract import conforms
        schema = sc.wire_schema(lesson(), scope(), overlay(), 4)
        self.assertEqual(sc.schema_problems(schema), [])
        item = schema["properties"]["questions"]["items"]["properties"]["items"]["items"]["properties"]
        self.assertEqual(item["ask"]["enum"], ["", "full_groups", "leftover", "groups_needed"])
        self.assertEqual(item["form"]["enum"], ["", "integer", "quotient_remainder"])
        self.assertEqual(item["variant"]["enum"][1:], list(overlay()["stories"]))
        self.assertEqual(conforms(load("reply_good.json"), schema), [])
        card = sc.authoring_card(lesson(), scope(), overlay())
        self.assertEqual(sc.card_problems(card), [])
        for slot in ("Q1-Q5", "Q6-Q9", "Q10-Q12", "R1", "R2", "R3", "R4"):
            self.assertIn(slot + " |", card)
        self.assertIn("at most one drill question", card)
        self.assertNotRegex(card, r"\b125:4\b(?!, which)")      # the rule example is named only as forbidden
        self.assertEqual(card, sc.authoring_card(lesson(), scope(), overlay()))

    def test_code_written_strings(self):
        """Every code-written string: IR text clean, no forbidden or argument word, no drawing request, no number
        word, no claim word of the pinned content-truth gates, no depth word of the pinned G61; no colon beside an
        atom; story intros obey the atom rule; ask texts are distinct and each passes its own cue only."""
        from general_source import DRAWING_REQUEST
        import text_lint as tl
        ov = overlay()
        strings = sc.code_strings(ov)
        self.assertEqual(len(strings), 1 + 1 + 1 + 3 + 8 * (3 + 3))
        self.assertIn(("remainderWord", "שארית"), strings)
        for path, text in strings:
            self.assertEqual(tl.check_ir_text(text), [], path)
            self.assertFalse(tl.forbidden_term_hits(text, ov["forbiddenTerms"]), path)
            self.assertIsNone(tl._ARGUMENT.search(text), path)
            self.assertIsNone(DRAWING_REQUEST.search(text), path)
            codes, _ = tl.lint_model_text(text, grade=4, declared=(), forbidden_terms=ov["forbiddenTerms"],
                                          max_length=1200)
            self.assertNotIn("TEXT_NUMBER_WORD", codes, path)
        self.assertEqual(tl.check_ir_spans(sc.rule_spans(ov)), [])
        for sid in ov["stories"]:
            spans = dk.story_intro(sid, (158, 6), ov)
            self.assertEqual(tl.check_ir_spans(spans), [], sid)
        asks = [(sid, ask, text) for sid, story in ov["stories"].items() for ask, text in story["asks"].items()]
        self.assertEqual(len({text for _, _, text in asks}), len(asks))
        for sid, ask, text in asks:
            for other in ov["asks"]:
                self.assertEqual(dk.cue_missing(other, text, ov), other != ask, (sid, ask, other))

    @unittest.skipUnless(S.ELEMENTARY_PINNED, "Pinned elementary skill unavailable")
    def test_code_written_strings_pass_the_pinned_word_lists(self):
        truth = dk.pinned_elementary(str(S.ELEMENTARY), "scripts/lib/content_truth.py")
        quality = dk.pinned_elementary(str(S.ELEMENTARY), "scripts/lib/content_quality.py")
        words = truth.DENIAL + truth.UNIVERSAL + truth.ENUMERATE + truth.SINGULAR_ASK
        for path, text in sc.code_strings(overlay()):
            self.assertFalse([w for w in words if w in text], path)
            self.assertFalse([k for k, _ in quality.DEPTH if k in text], path)
        content = {"meta": {"band": "elementary", "grade": "ד", "level": "א", "topic_id": TOPIC},
                   "questions": [{"n": str(n), "text": text, "answer": "1"}
                                 for n, (_, text) in enumerate(sc.code_strings(overlay()), 1)]}
        status, message = quality.g66_chronology(quality.normalize(content), content=content, grade="ד")
        self.assertEqual(status, quality.PASS, message)

    def test_check_overlay_refuses_a_broken_elementary_table(self):
        sc.check_overlay(sc.thaw(overlay()))           # the plain (thawed) copy passes: each refusal is the edit's

        def broken(edit, field):
            value = sc.thaw(overlay())
            edit(value)
            with self.assertRaises(ValueError) as caught:
                sc.check_overlay(value)
            self.assertEqual(str(caught.exception), "Overlay field is inconsistent: " + field)

        broken(lambda v: v["kinds"]["division_remainder_drill"].update(form="integer"),
               "kinds.division_remainder_drill")
        broken(lambda v: v["kinds"]["division_story"].update(items=[3, 4]), "kinds.division_story")
        broken(lambda v: v["stories"]["S_EGGS"]["asks"].update(full_groups=v["stories"]["S_PENCILS"]["asks"]
                                                                ["full_groups"]), "stories.asks")
        broken(lambda v: v["stories"]["S_EGGS"].update(intro=[["T", "בלול נאספו "], ["D", "n1"], ["T", " ביצים."]]),
               "stories.intro")
        broken(lambda v: v["rule"].__setitem__(0, {"kind": "text", "text": "כותבים כך: "}), "colon beside an atom")
        broken(lambda v: v["stories"]["S_EGGS"]["intro"].__setitem__(0, ["T", "בלול נאספו:"]),
               "colon beside an atom")
        broken(lambda v: v.update(challengeRule="quotient_even"), "challengeRule")
        broken(lambda v: v.update(letters=["x"]), "letters")
        broken(lambda v: v.update(remainderWord="נשאר"), "remainderWord")
        broken(lambda v: v["conceptKinds"].update({"ד10#1": ["division_story", "collect_like_terms"]}),
               "conceptKinds")


# ------------------------------------------------------------------ compile time

@unittest.skipUnless(S.ELEMENTARY_PINNED, "Pinned elementary skill unavailable")
class D10Compile(unittest.TestCase):
    def test_good_reply_delivers_twelve_with_the_hand_keys(self):
        result = compile_good()
        expected = load("expected.json")
        selection = result.ir["selection"]
        self.assertEqual((selection["requested"], selection["floor"], selection["delivered"]), (12, 12, 12))
        self.assertEqual(selection["replaced"], [])
        self.assertEqual(result.diagnostics["refusals"], [])
        self.assertEqual(result.diagnostics["trimmed"], [])
        self.assertEqual([q["slot"] for q in selection["questions"]], expected["reply_good"]["printed"])
        self.assertEqual([q["slot"] for q in selection["questions"] if q["star"]], expected["reply_good"]["stars"])
        printed = dict(zip([q["slot"] for q in selection["questions"]], result.ir["sections"][0]["questions"]))
        self.check_keys(printed, expected)
        self.assertEqual(result.diagnostics["warnings"], [])

    def check_keys(self, printed, expected):
        for slot, question in printed.items():
            kinds = {item["answer"]["key"]["binding"]["kind"] for item in question["items"]}
            if kinds == {"division_remainder_drill"}:
                for item in question["items"]:
                    division = item["prompt"][0]["notation"]
                    hand = expected["drills"][division]
                    key = item["answer"]["key"]
                    self.assertEqual((key["quotient"], key["remainder"]), (hand["quotient"], hand["remainder"]))
                    self.assertEqual(long_division(*map(int, division.split(":"))), (key["quotient"], key["remainder"]))
                    self.assertEqual("".join(v for _, v in dk.key_parts(item, "ד", overlay())), hand["printed"])
                continue
            hand = expected["stories"][slot]
            for item in question["items"]:
                binding, key = item["answer"]["key"]["binding"], item["answer"]["key"]
                self.assertEqual(binding["template"], hand["template"])
                self.assertEqual(dk.task_pair(item["answer"]["task"]), tuple(hand["division"]))
                self.assertEqual(key["value"], hand[binding["ask"]], (slot, binding["ask"]))
                quotient, remainder = long_division(*hand["division"])
                independent = {"full_groups": quotient, "leftover": remainder, "groups_needed": quotient + 1}
                self.assertEqual(key["value"], independent[binding["ask"]])
            self.assertEqual(question["intro"], dk.story_intro(hand["template"], tuple(hand["division"]), overlay()))

    def test_every_reserve_compiles_clean_with_its_hand_keys(self):
        ctx, plan, expected = context(), rows(), load("expected.json")
        for wire in load("reply_good.json")["questions"]:
            compiled = ss.compile_question(wire, plan[wire["slot"]], ctx)
            self.assertEqual(compiled.codes, (), wire["slot"])
            self.assertEqual(compiled.ir["star"], plan[wire["slot"]].group == "challenges")
        reserves = {w["slot"]: ss.compile_question(w, plan[w["slot"]], ctx).ir
                    for w in load("reply_good.json")["questions"] if w["slot"].startswith("R")}
        self.check_keys(reserves, expected)

    def test_adversarial_cases(self):
        ctx, plan = context(), rows()
        cases = load("adversarial.json")
        self.assertGreaterEqual(len(cases), 50)
        seen = set()
        for case in cases:
            with self.subTest(case=case["case"]):
                compiled = ss.compile_question(case["question"], plan[case["slot"]], ctx)
                self.assertIsNone(compiled.ir)
                self.assertEqual(list(compiled.codes), case["expect"])
                seen.update(case["expect"])
                for refusal in compiled.refusals:
                    self.assertRegex(refusal.code, sc.CODE_RE)
                    self.assertTrue(sc.is_known_code(refusal.code))
        for code in ("Q_SHAPE", "Q_KIND_NOT_ALLOWED", "ITEM_COUNT", "FIELD_NOT_EMPTY", "TEXT_CHAR", "TEXT_NUMBER_WORD",
                     "GIVEN_SHAPE", "GIVEN_VALUE", "REF_UNUSED", "REF_UNDECLARED", "TEMPLATE_MISMATCH",
                     "TEMPLATE_UNKNOWN", "ASK_UNKNOWN", "FORM_UNKNOWN", "ITEM_SHAPE", "MATH_PARSE", "MATH_LENGTH",
                     "MATH_SYMBOL_UNDECLARED", "DIVISION_SHAPE", "MATH_SCOPE_RANGE", "STORY_REMAINDER_ZERO",
                     "CHALLENGE_PROFILE", "DUPLICATE_ITEM"):
            self.assertIn(code, seen)

    def test_replacements_reply(self):
        result = compile_good("reply_replacements.json")
        expected = load("expected.json")["reply_replacements"]
        selection = result.ir["selection"]
        self.assertEqual(selection["delivered"], expected["delivered"])
        self.assertEqual(selection["replaced"], expected["replaced"])
        self.assertEqual([q["slot"] for q in selection["questions"]], expected["printed"])
        self.assertEqual([q["slot"] for q in selection["questions"] if q["star"]], expected["stars"])
        printed = dict(zip([q["slot"] for q in selection["questions"]], result.ir["sections"][0]["questions"]))
        self.check_keys(printed, load("expected.json"))

    def sheet(self, edit):
        reply = load("reply_good.json")
        by = {q["slot"]: q for q in reply["questions"]}
        edit(by)
        return reply

    def test_a_story_template_used_a_fourth_time_takes_a_reserve(self):
        def edit(by):
            for slot, (n1, n2) in (("Q3", (167, 5)), ("Q4", (283, 7))):
                by[slot]["givens"][0]["value"], by[slot]["givens"][1]["value"] = str(n1), str(n2)
                for item in by[slot]["items"]:
                    item["variant"] = "S_PENCILS"
        result = ss.compile_sheet(lesson(), scope(), self.sheet(edit), skill_path=str(S.ELEMENTARY))
        self.assertEqual(result.ir["selection"]["replaced"], [{"slot": "Q10", "by": "R4", "codes":
                                                               ["STRUCTURE_REPEATED"]}])

    def test_a_second_drill_takes_a_reserve(self):
        def edit(by):
            by["Q3"].update(kind="division_remainder_drill", givens=[], items=[
                {"text": "", "expr": e, "expr2": "", "values": "", "ask": "", "form": "", "variant": ""}
                for e in ("418:3", "682:9", "731:4")])
        result = ss.compile_sheet(lesson(), scope(), self.sheet(edit), skill_path=str(S.ELEMENTARY))
        self.assertEqual(result.ir["selection"]["replaced"], [{"slot": "Q3", "by": "R1", "codes":
                                                               ["STRUCTURE_REPEATED"]}])

    def test_a_division_printed_twice_takes_a_reserve(self):
        def edit(by):
            by["Q8"]["givens"][0]["value"], by["Q8"]["givens"][1]["value"] = "263", "4"      # Q6's division
        result = ss.compile_sheet(lesson(), scope(), self.sheet(edit), skill_path=str(S.ELEMENTARY))
        self.assertEqual(result.ir["selection"]["replaced"], [{"slot": "Q8", "by": "R2", "codes":
                                                               ["DUPLICATE_TASK"]}])

    def test_without_reserves_a_refusal_is_below_the_floor(self):
        reply = load("reply_good.json")
        reply["questions"] = [q for q in reply["questions"] if not q["slot"].startswith("R")]
        reply["questions"][6]["givens"][0]["value"] = "185"                                 # Q7: 185:5, no remainder
        with self.assertRaises(ss.V5Error) as caught:
            ss.compile_sheet(lesson(), scope(), reply, skill_path=str(S.ELEMENTARY))
        self.assertEqual(caught.exception.code, "SHEET_BELOW_MINIMUM")
        self.assertEqual([t["slot"] for t in caught.exception.diagnostics["missing"]], ["Q7"])

    def test_deterministic_and_private_diagnostics(self):
        first, second = compile_good(), compile_good()
        self.assertEqual(json.dumps(first.ir, ensure_ascii=False), json.dumps(second.ir, ensure_ascii=False))
        broken = compile_good("reply_replacements.json")
        text = json.dumps(broken.diagnostics, ensure_ascii=False)
        self.assertIsNone(re.search(r"[א-ת]", text))
        for wire in load("reply_replacements.json")["questions"]:
            for item in wire["items"]:
                if item["expr"] and ":" in item["expr"] and "{" not in item["expr"]:
                    self.assertNotIn(item["expr"], text)

    def test_the_mirror_and_the_pinned_clone_gate_agree(self):
        quality = dk.pinned_elementary(str(S.ELEMENTARY), "scripts/lib/content_quality.py")
        questions = compile_good().ir["sections"][0]["questions"]
        self.assertEqual(dk.clone_limit(str(S.ELEMENTARY), 4, "a"), 3)
        self.assertEqual(dk.clone_limit(str(S.ELEMENTARY), 4, "e"), 2)

        def gate(sheet):
            content = {"meta": {"band": "elementary", "grade": "ד", "level": "א"}, "questions": [
                {"n": str(n), "intro": "", "items": [dk.content_item_text(item, "ד") for item in q["items"]],
                 "answer": " ; ".join("%s. %d" % ("אבג"[j], j + n) for j in range(len(q["items"])))}
                for n, q in enumerate(sheet, 1)]}
            return quality.g62_cloned_items(quality.normalize(content), quality.profile_of(content))[0]

        self.assertEqual(dk.clone_hits(questions, skill_path=str(S.ELEMENTARY), grade_number=4, level="a"), {})
        self.assertEqual(gate(questions), quality.PASS)
        doubled = questions + [copy.deepcopy(questions[0])]
        self.assertEqual(dk.clone_hits(doubled, skill_path=str(S.ELEMENTARY), grade_number=4, level="a"),
                         {12: ["STRUCTURE_REPEATED"]})
        self.assertEqual(gate(doubled), quality.FAIL)


# ------------------------------------------------------------------ the final validator

@unittest.skipUnless(S.ELEMENTARY_PINNED, "Pinned elementary skill unavailable")
class D10FinalValidator(unittest.TestCase):
    def setUp(self):
        self.ir = compile_good().ir

    def code_of(self, edit, **kwargs):
        ir = copy.deepcopy(self.ir)
        edit(ir)
        try:
            validate_source(lesson(), ir, scope(), **kwargs)
        except GeneralSourceError as error:
            return error.code
        return "ACCEPTED"

    def questions(self, ir):
        return ir["sections"][0]["questions"]

    def test_the_ir_needs_the_trusted_flag(self):
        self.assertEqual(self.code_of(lambda ir: None, **TRUSTED), "ACCEPTED")
        self.assertEqual(self.code_of(lambda ir: None), "SOURCE_SHAPE")
        self.assertEqual(self.code_of(lambda ir: None, provider=True), "SOURCE_SHAPE")
        level_b = dict(lesson(), level="b")
        with self.assertRaises(GeneralSourceError) as caught:
            validate_source(level_b, copy.deepcopy(self.ir), scope(level_b), **TRUSTED)
        self.assertEqual(caught.exception.code, "SOURCE_WIRE_SCOPE")

    def test_tampering_is_refused(self):
        def drill(ir):
            return self.questions(ir)[0]

        def story(ir, n=1):
            return self.questions(ir)[n]

        def swap_numbers(ir):
            story(ir)["intro"][1]["notation"] = "159"

        cases = {
            "drill key": (lambda ir: drill(ir)["items"][0]["answer"]["key"].update(quotient=70), "SOURCE_KEY"),
            "drill remainder": (lambda ir: drill(ir)["items"][0]["answer"]["key"].update(remainder=3), "SOURCE_KEY"),
            "story key": (lambda ir: story(ir)["items"][2]["answer"]["key"].update(value=26), "SOURCE_KEY"),
            "drill display": (lambda ir: drill(ir)["items"][0]["prompt"][0].update(notation="348:5"),
                              "SOURCE_BINDING"),
            "ask text": (lambda ir: story(ir)["items"][0]["prompt"][0].update(
                text=story(ir)["items"][1]["prompt"][0]["text"]), "SOURCE_BINDING"),
            "ask binding": (lambda ir: story(ir)["items"][0]["answer"]["key"]["binding"].update(ask="leftover"),
                            "SOURCE_BINDING"),
            "intro numbers": (swap_numbers, "SOURCE_BINDING"),
            # The selection record is checked first: a star that is not the planned row's group.
            "drill star": (lambda ir: drill(ir).update(star=True), "SOURCE_SELECTION"),
            "printTask": (lambda ir: drill(ir)["items"][0]["answer"].update(printTask=True), "SOURCE_SHAPE"),
            "unit": (lambda ir: drill(ir)["items"][0]["answer"].update(unit="ס״מ"), "SOURCE_SHAPE"),
            "drill task out of range": (lambda ir: drill(ir)["items"][0]["answer"]["task"].update(
                dividend=number(47)), "SOURCE_BINDING"),
            "drill verb": (lambda ir: drill(ir)["intro"][0].update(text="חשבו."), "SOURCE_BINDING"),
            "duplicate item": (lambda ir: drill(ir)["items"].__setitem__(1, copy.deepcopy(drill(ir)["items"][0])),
                               "SOURCE_LEAK"),
            "rule box": (lambda ir: ir["rule"][0].update(text="בחילוק ארוך מחלקים."), "SOURCE_BINDING"),
            "title": (lambda ir: ir.update(title="חילוק"), "SOURCE_BINDING"),
            "selection star": (lambda ir: ir["selection"]["questions"][1].update(star=True), "SOURCE_SELECTION"),
        }
        for name, (edit, code) in cases.items():
            with self.subTest(case=name):
                self.assertEqual(self.code_of(edit, **TRUSTED), code)

    def test_the_question_checker_binds_the_star_and_the_challenge_profile(self):
        from item_kinds import BindingError, verify_question
        questions = self.questions(copy.deepcopy(self.ir))
        drill, practice_story, challenge = questions[0], questions[1], questions[9]
        for question in (drill, practice_story, challenge):
            verify_question(question, overlay())
        cases = ((dict(drill, star=True), "BINDING_INTERNAL"),                   # a drill is never a challenge
                 (dict(practice_story, star=True), "CHALLENGE_PROFILE"),         # 158:6 = 26: no zero digit
                 (dict(challenge, intro=practice_story["intro"]), "TEMPLATE_MISMATCH"),
                 (dict(drill, items=drill["items"][:2]), "ITEM_COUNT"),
                 (dict(practice_story, items=[practice_story["items"][0]] * 3), "DUPLICATE_ITEM"))
        for question, code in cases:
            with self.assertRaises(BindingError) as caught:
                verify_question(question, overlay())
            self.assertEqual(caught.exception.code, code)
        self.assertTrue(dk.meets_challenge((413, 4), overlay()))
        self.assertFalse(dk.meets_challenge((158, 6), overlay()))

    def test_sheet_level_refusals(self):
        def duplicate_division(ir):
            q3, q2 = self.questions(ir)[2], self.questions(ir)[1]
            template = q3["items"][0]["answer"]["key"]["binding"]["template"]
            for item in q3["items"]:
                item["answer"]["task"] = copy.deepcopy(q2["items"][0]["answer"]["task"])
            pair = dk.task_pair(q2["items"][0]["answer"]["task"])
            q3["intro"] = dk.story_intro(template, pair, overlay())
            for item in q3["items"]:
                quotient, remainder = divmod(*pair)
                ask = item["answer"]["key"]["binding"]["ask"]
                item["answer"]["key"]["value"] = dk.key_value(ask, quotient, remainder, overlay())

        def rule_example(ir):
            item = self.questions(ir)[0]["items"][0]
            item["prompt"][0]["notation"] = "125:4"
            item["answer"]["task"] = {"kind": "divide_remainder", "dividend": number(125), "divisor": number(4)}
            item["answer"]["key"].update(quotient=31, remainder=1)

        self.assertEqual(self.code_of(duplicate_division, **TRUSTED), "SOURCE_LEAK")
        self.assertEqual(self.code_of(rule_example, **TRUSTED), "SOURCE_LEAK")


if __name__ == "__main__":
    unittest.main()
