"""Fixes from the stage-2 review (2026-11-25). New tests only: no existing test is relaxed (decision 6).

- Reordered repeats: a later question repeating an earlier item's terms in another order is refused
  (DUPLICATE_REORDERED), the review case being "x+6+5x+2" (practice) then "5x+2+x+6" (starred reserve).
- References in model math: a kind that declares no givens refuses `{nK}` at parse time (MATH_PARSE); a kernel
  conversion failure or any unexpected exception costs one item, never the sheet (decision 3).
- Provider boundary: model output (validate_source(provider=True)) never selects worksheet-wire/5; a root
  "contract"/"selection" key stays SOURCE_SHAPE there, as before v5 existed.
- The profile's result bound applies to keys; a written coefficient 1 or 0 is refused; an implicit product
  after ':' is out of scope even where division is allowed.
- The final validator checks the code-written title and rule box and recomputes each question's plan row; the
  adapter runs the D12 mirror once the trusted skill path is known.
- An unreviewed overlay is recorded and keeps automatedChecksPassed false; every offline render writes
  report.json with the v5 verdict, and the pinned report is copied as pinned-v72-report.raw.json.
"""
import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import item_kinds as ik  # noqa: E402
import leak_checks  # noqa: E402
import school_math  # noqa: E402
import structured_source as ss  # noqa: E402
from general_source import GeneralSourceError, validate_source  # noqa: E402
from math_tasks import number, operation, validate_and_solve_task  # noqa: E402
from structured_contract import thaw  # noqa: E402

G7 = S.FIXTURES / "g7_algebraic_expressions"
C0, C1 = "g7:algebraic_expressions#0", "g7:algebraic_expressions#1"


def load_g7(name):
    return json.loads((G7 / name).read_text(encoding="utf-8"))


def by_slot(reply):
    return {question["slot"]: question for question in reply["questions"]}


def ir_question(kind, items):
    """An IR question compiled by item_kinds (no leak checks, no pinned skill): what the sheet checks read."""
    compiled = [ik.compile_item(kind, item, index, S.context()) for index, item in enumerate(items, 1)]
    for item in compiled:
        assert item.refusals == [], item.refusals
    return {"intro": ik.intro_spans(kind, S.overlay()), "star": kind == "find_error_collect",
            "items": [{"prompt": item.prompt, "answer": item.answer} for item in compiled]}


def collect(*exprs):
    return ir_question("collect_like_terms", [S.item(expr) for expr in exprs])


def code_of(lesson, payload, scope, **kwargs):
    with unittest.TestCase().assertRaises(GeneralSourceError) as caught:
        validate_source(lesson, payload, scope, **kwargs)
    return caught.exception.code


def item_codes(kind, item, overlay=None):
    ctx = S.context() if overlay is None else ik.Context(S.lesson(), S.scope(), overlay, None)
    out = ik.compile_item(kind, item, 1, ctx)
    return out


# ------------------------------------------------------------------ defect 1: reordered repeats

class ReorderedRepeats(unittest.TestCase):
    def practice(self):
        return collect("4b+3-b+9", "x+6+5x+2", "10y-4-3y-3")

    def star(self, first=("5x+2+x+6", "14x")):
        return ir_question("find_error_collect", [S.item(first[0], first[1], variant="M1"),
                                                  S.item("7b+9-4-2b", "5b+13", variant="M2"),
                                                  S.item("3y+2x+y", "3y+2x", variant="M3")])

    def test_the_review_case_is_refused_in_either_order(self):
        """Q16 ב 'x + 6 + 5x + 2' then Q19★ א 'כינוס הביטוי 5x + 2 + x + 6': the same four terms, key 6x + 8."""
        self.assertEqual(leak_checks.reordered_tasks([self.practice(), self.star()]), {1: ["DUPLICATE_REORDERED"]})
        self.assertEqual(leak_checks.reordered_tasks([self.star(), self.practice()]), {1: ["DUPLICATE_REORDERED"]})
        # sheet_leaks keeps the section 4 definition (the same canonical display), so the rule is a separate one.
        self.assertEqual(leak_checks.sheet_leaks([self.practice(), self.star()]), {})

    def test_exact_repeats_stay_duplicate_task_and_equal_keys_alone_pass(self):
        first = collect("3x+5+2x-1", "-4y+9+6y-2", "8a-3+a-5")
        again = collect("3x+5+2x-1", "6b-1+b+4", "2a+7-a+1")
        self.assertEqual(leak_checks.reordered_tasks([first, again]), {})
        self.assertEqual(leak_checks.sheet_leaks([first, again]), {1: ["DUPLICATE_TASK"]})
        same_key = collect("4x+5+x-1", "6b-1+b+4", "2a+7-a+1")          # key 5x + 4, other terms
        self.assertEqual(leak_checks.reordered_tasks([first, same_key]), {})
        swapped = collect("2x+5+3x-1", "6b-1+b+4", "2a+7-a+1")          # the terms of 3x+5+2x-1 reordered
        self.assertEqual(leak_checks.reordered_tasks([first, swapped]), {1: ["DUPLICATE_REORDERED"]})

    def test_signs_and_negative_numbers_are_part_of_a_term(self):
        first = collect("6x-2+x+5", "9-3y+4y-1", "5a+11-2a-4")
        self.assertEqual(leak_checks.reordered_tasks([first, collect("x+5+6x-2", "6b-1+b+4", "2a+7-a+1")]),
                         {1: ["DUPLICATE_REORDERED"]})
        self.assertEqual(leak_checks.reordered_tasks([first, collect("x-5+6x+2", "6b-1+b+4", "2a+7-a+1")]), {})
        value = ir_question("substitute", [S.item("x-(-2)", values="x=3"), S.item("2a+5", values="a=3"),
                                           S.item("5b-2b", values="b=4")])
        plain = ir_question("substitute", [S.item("2+x", values="x=3"), S.item("4y-y", values="y=-2"),
                                           S.item("3x+2", values="x=5")])
        self.assertEqual(leak_checks.reordered_tasks([value, plain]), {1: ["DUPLICATE_REORDERED"]})

    def test_one_question_alone_is_never_hit(self):
        """Within one question the section 4 rule applies (test_v5_leak_checks.test_duplicate_item pins it)."""
        self.assertEqual(leak_checks.reordered_tasks([collect("3x+5+2x-1", "2x+5+3x-1", "8a-3+a-5")]), {})

    def test_removing_questions_never_adds_a_hit(self):
        import itertools
        pool = [self.practice(), collect("3x+5+2x-1", "-4y+9+6y-2", "8a-3+a-5"), self.star(),
                collect("2x+5+3x-1", "6b-1+b+4", "2a+7-a+1")]
        whole = leak_checks.reordered_tasks(pool)
        self.assertEqual(whole, {2: ["DUPLICATE_REORDERED"], 3: ["DUPLICATE_REORDERED"]})
        for size in range(1, len(pool)):
            for kept in itertools.combinations(range(len(pool)), size):
                for index in leak_checks.reordered_tasks([pool[i] for i in kept]):
                    self.assertIn(kept[index], whole, kept)

    def test_the_code_is_registered(self):
        from structured_contract import CODES
        self.assertIn(leak_checks.DUPLICATE_REORDERED, CODES)
        self.assertEqual(leak_checks.DUPLICATE_REORDERED, "DUPLICATE_REORDERED")


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class ReorderedRepeatsOnTheSheet(unittest.TestCase):
    def original_reply(self):
        """The good reply with reserve R5 item א as it was rendered in stage 2: '5x+2+x+6' (Q16 holds 'x+6+5x+2')."""
        reply = S.reply()
        first = by_slot(reply)["R5"]["items"][0]
        first["expr"], first["expr2"] = "5x+2+x+6", "14x"
        return reply

    def test_the_stage_two_reply_now_takes_r6_for_q19(self):
        result = ss.compile_sheet(S.lesson(), S.scope(), self.original_reply(), skill_path=str(S.MIDDLE))
        selection = result.ir["selection"]
        self.assertEqual(selection["replaced"][-2:], [
            {"slot": "Q19", "by": "R5", "codes": ["ITEM_COUNT", "MISTAKE_UNMODELED"]},
            {"slot": "Q19", "by": "R6", "codes": ["DUPLICATE_REORDERED"]}])
        self.assertEqual([row["slot"] for row in selection["questions"]][17:], ["Q18", "R6", "Q20"])
        self.assertEqual(result.diagnostics["record"][-1]["stage"], "sheet")
        self.assertEqual(leak_checks.reordered_tasks(result.ir["sections"][0]["questions"]), {})
        validate_source(S.lesson(), result.ir, S.scope())

    def test_the_final_validator_refuses_a_reordered_repeat(self):
        with patch.object(leak_checks, "reordered_tasks", return_value={}):
            result = ss.compile_sheet(S.lesson(), S.scope(), self.original_reply(), skill_path=str(S.MIDDLE))
        self.assertEqual([row["slot"] for row in result.ir["selection"]["questions"]][18], "R5")
        self.assertEqual(code_of(S.lesson(), result.ir, S.scope()), "SOURCE_LEAK")

    def test_the_fixture_reserve_is_clean_and_unused_reserves_stay_unused(self):
        """reply-g7-good.json R5 item א is now '5x+2+x+9' → '17x' (key 6x + 11): R5 still fills Q19, R4/R6 unused."""
        result = S.compiled_good()
        selection = result["ir"]["selection"]
        self.assertEqual(selection["replaced"][-1], {"slot": "Q19", "by": "R5",
                                                     "codes": ["ITEM_COUNT", "MISTAKE_UNMODELED"]})
        printed = [row["slot"] for row in selection["questions"]]
        self.assertNotIn("R4", printed)
        self.assertNotIn("R6", printed)
        r5 = result["ir"]["sections"][0]["questions"][18]["items"][0]
        self.assertEqual(r5["answer"]["key"]["notation"], "6x+11")


# ------------------------------------------------------------------ defect 2: references in model math

class ReferencesInModelMath(unittest.TestCase):
    def test_parse_refuses_a_reference_only_when_asked(self):
        node = school_math.parse("8y-{n1}", letters=("y",))
        self.assertEqual(node, school_math.Sum(school_math.Product(school_math.Num("8"), (("", school_math.Var("y")),)),
                                               (("-", school_math.Ref("n1")),)))
        for text in ("8y-{n1}", "{n1}x", "{n1}", "x+{n9}"):
            with self.subTest(text=text):
                with self.assertRaises(school_math.SchoolMathError) as caught:
                    school_math.parse(text, letters=("x", "y"), allow_refs=False)
                self.assertEqual(caught.exception.code, "MATH_PARSE")
        self.assertEqual(school_math.parse("8y-2", letters=("y",), allow_refs=False),
                         school_math.parse("8y-2", letters=("y",)))

    def test_every_model_math_field_refuses_a_reference(self):
        cases = (("substitute", S.item("8y-{n1}", values="y=2"), [("expr", "MATH_PARSE")]),
                 ("collect_like_terms", S.item("{n1}a+5b-a-2b"), [("expr", "MATH_PARSE")]),
                 ("write_from_words", S.item("{n1}x", variant="W_TIMES"), [("expr", "MATH_PARSE")]),
                 ("find_error_collect", S.item("4a+3+a+2", "{n1}a", variant="M1"), [("expr2", "MATH_PARSE")]))
        for kind, item, refusals in cases:
            with self.subTest(kind=kind):
                out = ik.compile_item(kind, item, 1, S.context())
                self.assertEqual(out.refusals, refusals)
                self.assertIsNone(out.answer)

    def test_the_review_question_is_refused_with_exact_records(self):
        case = next(case for case in load_g7("adversarial.json") if case["case"] == "math_ref_in_substitute_expr")
        compiled = ss.compile_question(case["question"], S.rows()["Q10"], S.context())
        self.assertIsNone(compiled.ir)
        self.assertEqual(compiled.codes, ("ITEM_COUNT", "MATH_PARSE"))
        self.assertEqual([refusal.record() for refusal in compiled.refusals], [
            {"slot": "Q10", "item": 3, "field": "expr", "code": "MATH_PARSE"},
            {"slot": "Q10", "item": 0, "field": "items", "code": "ITEM_COUNT"}])

    def test_a_kernel_conversion_failure_is_a_refusal(self):
        failure = school_math.SchoolMathError("MATH_PARSE", "conversion failed")
        with patch.object(school_math, "to_kernel", side_effect=failure):
            out = ik.compile_item("substitute", S.item("4y-y", values="y=-2"), 1, S.context())
        self.assertEqual(out.refusals, [("expr", "MATH_PARSE")])
        self.assertIsNone(out.answer)

    def test_an_unexpected_exception_costs_one_item_not_the_question(self):
        question = S.question("Q7", "substitute", [S.item("4y-y", values="y=-2"), S.item("2a+5", values="a=3"),
                                                   S.item("5b-2b", values="b=4"), S.item("3x+2", values="x=5")])
        real = ss.compile_item

        def flaky(kind, item, index, ctx):
            if index == 2:
                raise RuntimeError("unforeseen")
            return real(kind, item, index, ctx)

        with patch.object(ss, "compile_item", side_effect=flaky):
            compiled = ss.compile_question(question, S.rows()["Q7"], S.context())
        self.assertEqual(compiled.codes, ())
        self.assertEqual(compiled.trimmed, (2,))
        self.assertEqual([refusal.record() for refusal in compiled.refusals],
                         [{"slot": "Q7", "item": 2, "field": "", "code": "BINDING_INTERNAL"}])
        self.assertEqual(len(compiled.ir["items"]), 3)


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class ReferencesOnTheSheet(unittest.TestCase):
    def test_one_bad_item_in_q7_costs_q7_a_reserve_not_the_sheet(self):
        """The review probe: the good g7 reply with {"kind":"substitute","expr":"8y-{n1}","values":"y=2"} in Q7."""
        reply = load_g7("reply_good.json")
        by_slot(reply)["Q7"]["items"][2] = S.item("8y-{n1}", values="y=2")
        result = ss.compile_sheet(load_g7("lesson.json"), S.scope(), reply, skill_path=str(S.MIDDLE))
        selection = result.ir["selection"]
        self.assertEqual(selection["delivered"], 20)
        self.assertEqual(selection["replaced"], [{"slot": "Q7", "by": "R2", "codes": ["ITEM_COUNT", "MATH_PARSE"]}])
        self.assertIn({"slot": "Q7", "item": 3, "field": "expr", "code": "MATH_PARSE"},
                      result.diagnostics["refusals"])


# ------------------------------------------------------------------ defect 3: the provider boundary

class ProviderBoundary(unittest.TestCase):
    def test_a_v5_marker_on_model_output_is_source_shape(self):
        from test_general_source import fixture
        lesson, payload = fixture("g9r:quad_func_and_eq", 9)
        scope = S.scope(lesson)
        validate_source(lesson, payload, scope, provider=True)
        for extra in ({"contract": "worksheet-wire/5"}, {"contract": "worksheet-wire/5", "selection": {}}):
            with self.subTest(extra=sorted(extra)):
                self.assertEqual(code_of(lesson, dict(copy.deepcopy(payload), **extra), scope, provider=True),
                                 "SOURCE_SHAPE")

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_the_provider_chain_refuses_a_v5_shaped_reply(self):
        """bind_content → assemble_sections → expand_source → validate_source(provider=True), as
        general_provider.compile_content runs it on every model reply (and every revision)."""
        import compact_authoring
        from general_provider import assemble_sections
        from skill_authoring import bind_content
        lesson, scope, ir = S.lesson(), S.scope(), S.ir_good()
        payload = bind_content(copy.deepcopy(ir), scope)
        payload = assemble_sections(payload, lesson["questionCount"])
        payload = compact_authoring.expand_source(payload, lesson["gradeNumber"], fraction_notation=False)
        self.assertEqual(payload.get("contract"), "worksheet-wire/5")      # the marker survives to the validator
        self.assertEqual(code_of(lesson, payload, scope, provider=True), "SOURCE_SHAPE")
        self.assertEqual(code_of(lesson, ir, scope, provider=True), "SOURCE_SHAPE")
        validate_source(lesson, ir, scope)                                   # off the provider path: still v5


# ------------------------------------------------------------------ minor: result bound, coefficients, ':'

class ResultBound(unittest.TestCase):
    def test_keys_obey_result_literal_max(self):
        for expr, values in (("20xy", "x=10, y=10"), ("20x+20y", "x=-10, y=-10"), ("10x", "x=10")):
            with self.subTest(expr=expr):
                out = item_codes("substitute", S.item(expr, values=values))
                self.assertEqual(out.refusals, [("expr", "MATH_SCOPE_RANGE")])
        self.assertEqual(item_codes("substitute", S.item("9x+9", values="x=10")).answer["key"]["notation"], "99")
        self.assertEqual(item_codes("substitute", S.item("9x+9", values="x=-10")).answer["key"]["notation"], "-81")

    def test_the_final_check_applies_the_bound_too(self):
        loose = thaw(S.overlay())
        loose["profile"]["result_literal_max"] = 10_000
        out = item_codes("substitute", S.item("20xy", values="x=10, y=10"), overlay=loose)
        self.assertEqual((out.refusals, out.answer["key"]["notation"]), ([], "2000"))
        with self.assertRaises(ik.BindingError) as caught:
            ik.verify_item(out.prompt, out.answer, out.solved, S.overlay())
        self.assertEqual(caught.exception.code, "MATH_SCOPE_RANGE")


class WrittenCoefficients(unittest.TestCase):
    def test_the_helper(self):
        letters = ("x", "y", "a", "b")
        for text, expected in (("1x+2x", True), ("0x+3x+y", True), ("(-1)x+3", True), ("-1x+x", True),
                               ("2x+1", False), ("10x", False), ("x+y", False), ("1/2x", False), ("3(-1)", False),
                               ("2+1", False)):
            with self.subTest(text=text):
                self.assertIs(school_math.written_unit_coefficient(school_math.parse(text, letters=letters)), expected)

    def test_items_with_a_written_coefficient_one_or_zero_are_refused(self):
        for kind, item in (("collect_like_terms", S.item("1x+2x")), ("collect_like_terms", S.item("0x+3x+y")),
                           ("substitute", S.item("(-1)x+3", values="x=2")),
                           ("find_error_collect", S.item("1x+4+2x+3", "10x", variant="M1"))):
            with self.subTest(expr=item["expr"]):
                self.assertEqual(item_codes(kind, item).refusals, [("expr", "MATH_SCOPE_RANGE")])
        # A more specific code wins: W_TIMES needs k in 2..20 (test_v5_item_kinds pins TEMPLATE_MISMATCH).
        self.assertEqual(item_codes("write_from_words", S.item("1x", variant="W_TIMES")).refusals,
                         [("expr", "TEMPLATE_MISMATCH")])

    def test_the_final_check_refuses_a_written_coefficient(self):
        node = school_math.parse("1x+2x", letters=("x",))
        task = {"kind": "simplify", "expression": school_math.to_kernel(node)}
        answer = {"kind": "computed", "task": task, "unit": "", "printTask": False,
                  "key": {"form": "expression", "notation": "3x", "symbols": ["x"],
                          "binding": {"kind": "collect_like_terms"}}}
        prompt = [{"kind": "display", "notation": "1x+2x", "symbols": ["x"]}]
        with self.assertRaises(ik.BindingError) as caught:
            ik.verify_item(prompt, answer, validate_and_solve_task(task), S.overlay())
        self.assertEqual(caught.exception.code, "MATH_SCOPE_RANGE")


class ColonAfterAnImplicitProduct(unittest.TestCase):
    def scope(self, text, **changes):
        profile = dict(S.overlay()["profile"], division=True, **changes)
        return school_math.check_scope(school_math.parse(text, letters=("x", "y")), profile)

    def test_round_trip_and_reading(self):
        for text, house in (("6:2x", "6 : 2x"), ("x:2y", "x : 2y"), ("8:2(1+3)", "8 : 2(1 + 3)")):
            with self.subTest(text=text):
                node = school_math.parse(text, letters=("x", "y"))
                self.assertEqual(school_math.unparse(node), text)
                self.assertEqual(school_math.to_house(node), house)
                self.assertEqual(school_math.from_house_flat(house, letters=("x", "y")), node)
        # The kernel reads the chain left to right: (6 : 2)·x = 3x, while the print reads 6 : (2x).
        self.assertEqual(school_math.to_kernel(school_math.parse("6:2x", letters=("x",))),
                         operation("multiply", operation("divide", number(6), number(2)),
                                   {"type": "symbol", "name": "x"}))

    def test_an_implicit_product_after_a_colon_is_out_of_scope(self):
        self.assertEqual(self.scope("6:2x"), ["MATH_SCOPE_DIVISION"])
        self.assertEqual(self.scope("x:2y"), ["MATH_SCOPE_DIVISION"])
        self.assertIn("MATH_SCOPE_DIVISION", self.scope("8:2(1+3)"))
        self.assertEqual(self.scope("12:4"), [])
        self.assertEqual(self.scope("2x:4"), [])                       # (2x) : 4 reads as it prints
        self.assertEqual(self.scope("6:2*x", explicit_product=True), [])
        self.assertEqual(self.scope("x/2y"), [])                       # '/' prints a stacked fraction


# ------------------------------------------------------------------ minor: equivalent evaluations (warnings)

class EquivalentEvaluations(unittest.TestCase):
    def substitute(self, *pairs):
        return ir_question("substitute", [S.item(expr, values=values) for expr, values in pairs])

    def test_same_simplified_task_and_values_after_renaming_letters_is_a_warning(self):
        first = self.substitute(("4y-y", "y=-2"), ("2a+5", "a=3"), ("5b-2b", "b=4"))
        later = self.substitute(("5x-3x", "x=6"), ("10-2a", "a=3"), ("b+b+b", "b=-2"))
        self.assertEqual(leak_checks.equivalent_tasks([first, later]),
                         [{"code": "EQUIVALENT_TASK", "questions": [0, 1], "items": [1, 3]}])
        two = self.substitute(("x+2y", "x=-1, y=3"), ("2a+5", "a=3"), ("5b-2b", "b=4"))
        swapped = self.substitute(("2a+b", "a=3, b=-1"), ("10-2a", "a=4"), ("6x+1", "x=3"))
        self.assertEqual(leak_checks.equivalent_tasks([two, swapped]),
                         [{"code": "EQUIVALENT_TASK", "questions": [0, 1], "items": [1, 1]}])

    def test_other_values_repeats_and_collect_keys_are_not_warnings(self):
        first = self.substitute(("7x-2x", "x=-3"), ("2a+5", "a=3"), ("5b-2b", "b=4"))
        other = self.substitute(("9x-4x", "x=3"), ("10-2a", "a=4"), ("6x+1", "x=3"))
        self.assertEqual(leak_checks.equivalent_tasks([first, other]), [])
        again = self.substitute(("2a+5", "a=3"), ("5x-x", "x=2"), ("b+8", "b=-5"))     # an exact repeat (refused)
        self.assertEqual(leak_checks.equivalent_tasks([first, again]), [])
        self.assertEqual(leak_checks.equivalent_tasks([collect("3x+5+2x-1", "-4y+9+6y-2", "8a-3+a-5"),
                                                       collect("4x+5+x-1", "6b-1+b+4", "2a+7-a+1")]), [])

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_the_compile_diagnostics_record_them_by_slot(self):
        warnings = S.compiled_good()["diagnostics"]["warnings"]
        self.assertIn({"code": "EQUIVALENT_TASK", "slots": ["Q7", "Q10"], "items": [1, 3]}, warnings)
        self.assertEqual(S.compiled_good()["ir"]["selection"]["replaced"][-1]["by"], "R5")    # nothing refused


# ------------------------------------------------------------------ minor: final validator text and plan rows

@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class FinalValidatorCodeWrittenParts(unittest.TestCase):
    def refused(self, change):
        ir = S.ir_good()
        change(ir)
        return code_of(S.lesson(), ir, S.scope())

    def test_title_section_title_and_rule_are_the_overlays(self):
        self.assertEqual(self.refused(lambda ir: ir.update(title="פרק 3: חוק הפילוג")), "SOURCE_BINDING")
        self.assertEqual(self.refused(lambda ir: ir["sections"][0].update(title="כינוס איברים")), "SOURCE_BINDING")
        self.assertEqual(self.refused(lambda ir: ir["rule"][0].update(text="ביטוי אלגברי הוא ביטוי עם משתנים. ")),
                         "SOURCE_BINDING")

    def test_each_question_belongs_to_its_planned_row(self):
        self.assertEqual(self.refused(lambda ir: ir["selection"]["questions"][0].update(conceptIds=[C1])),
                         "SOURCE_SELECTION")

        def swap(ir):
            questions = ir["sections"][0]["questions"]
            questions[0], questions[6] = questions[6], questions[0]     # a substitute question in row Q1
        self.assertEqual(self.refused(swap), "SOURCE_SELECTION")


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class D12MirrorAtTheAdapter(unittest.TestCase):
    def test_the_adapter_refuses_a_pinned_value_leak(self):
        """An IR that validate_source accepts without a skill path (Q14 '7a-2a+4-a', key 4a + 4, kept by a stubbed
        mirror at compile time) is refused by compile_source, which knows the trusted skill path."""
        import general_adapters
        with patch.object(leak_checks, "d12_mirror", return_value=[]):
            result = ss.compile_sheet(S.lesson(), S.scope(), S.reply(), skill_path=str(S.MIDDLE))
        self.assertNotIn("R3", [row["slot"] for row in result.ir["selection"]["questions"]])
        validate_source(S.lesson(), result.ir, S.scope())
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(GeneralSourceError) as caught:
                general_adapters.compile_source(S.lesson(), {"source": result.ir}, S.scope(), str(S.MIDDLE),
                                                Path(tmp) / "work")
        self.assertEqual(caught.exception.code, "SOURCE_LEAK")


# ------------------------------------------------------------------ minor: the overlay review guard

class OverlayReviewGuard(unittest.TestCase):
    REPORT = {"result": "PASS", "review": [],
              "steps": [{"step": name, "status": "PASS"} for name in (
                  "build_plus (PDF + gates)", "check_plain_math.py", "verify_export.py", "selfcheck_noam_package.py",
                  "check_didactic.py")],
              "gates": [{"gate": "G85-section-volume", "level": None, "status": "PASS"}]}

    def render(self, overlay=None):
        import runner
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        work, skill = Path(tmp.name) / "job", Path(tmp.name) / "skill"
        skill.mkdir()

        def execute(args, **kwargs):
            if Path(args[2]).name == "build_v72.py":
                (work / "out/deliver/b").mkdir(parents=True, exist_ok=True)
                (work / "out/deliver/b/sheet.pdf").write_bytes(b"%PDF stub")
                (work / "out/v72-report.json").write_text(json.dumps(self.REPORT))
            return SimpleNamespace(stdout="", stderr="", returncode=0)

        patches = [patch.object(runner, "validate_model", return_value={"skill": "middle", "family": "general"}),
                   patch.object(runner, "verify_skill", return_value=(skill, {"version": "7.2.0-noam",
                                                                              "sha256": "a" * 64})),
                   patch.object(runner.subprocess, "run", side_effect=execute)]
        if overlay is not None:
            import structured_contract
            patches.append(patch.object(structured_contract, "overlay_for", return_value=overlay))
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        return runner.render_job(S.lesson(), {"version": 4, "contract": "worksheet-wire/5"}, work,
                                 skill_paths={"middle": skill})

    def test_an_unreviewed_overlay_never_counts_as_passed(self):
        manifest = self.render()
        self.assertEqual((manifest["status"], manifest["notRun"], manifest["executedChecksPassed"]),
                         ("needs_review", [], True))
        self.assertIs(manifest["overlayReviewed"], False)
        self.assertEqual(manifest["overlayPendingReview"], list(S.overlay()["pendingReview"]))
        self.assertIs(manifest["automatedChecksPassed"], False)
        self.assertIs(manifest["renderingChecksPassed"], False)

    def test_only_the_review_flag_was_holding_it(self):
        reviewed = thaw(S.overlay())
        reviewed["reviewed"] = True
        manifest = self.render(overlay=reviewed)
        self.assertIs(manifest["overlayReviewed"], True)
        self.assertEqual(manifest["overlayPendingReview"], [])
        self.assertIs(manifest["automatedChecksPassed"], True)


# ------------------------------------------------------------------ minor: offline render records

@unittest.skipUnless(S.MIDDLE_PINNED and S.weasyprint_available() and " " not in str(S.MIDDLE),
                     "Pinned middle skill or WeasyPrint unavailable")
class OfflineRenderRecords(unittest.TestCase):
    def test_every_render_writes_report_and_verdict(self):
        import v5_offline_render
        with tempfile.TemporaryDirectory() as tmp:
            if " " in tmp:
                self.skipTest("The temporary folder contains a space")
            out, work = Path(tmp) / "out", Path(tmp) / "work"
            summary = v5_offline_render.run(S.FIXTURES / "lesson-g7-algebraic-expressions.json",
                                            S.FIXTURES / "reply-g7-good.json", out, work_dir=work,
                                            skill_path=str(S.MIDDLE), dpi=30)
            self.assertEqual(summary["status"], "needs_review", summary)
            self.assertEqual(summary["trimmed"], [{"slot": "Q12", "items": [3]}])
            verdict = {"executedChecksPassed": True, "automatedChecksPassed": False, "notRunCount": 9,
                       "overlayReviewed": False, "fullyChecked": False}
            self.assertEqual({key: summary["verdict"][key] for key in verdict}, verdict)
            report = json.loads((out / "report.json").read_text(encoding="utf-8"))
            self.assertEqual((report["case"], report["status"], report["exitCode"]), (None, "needs_review", 0))
            self.assertEqual(report["verdict"], summary["verdict"])
            self.assertEqual(report["trimmed"], summary["trimmed"])
            self.assertIs(report["overlayReviewed"], False)
            self.assertTrue(all((out / name).is_file() for name in report["pages"]))
            self.assertEqual(len(report["keys"]), 20)
            self.assertTrue((out / "pinned-v72-report.raw.json").is_file())
            self.assertFalse((out / "v72-report.json").exists())


if __name__ == "__main__":
    unittest.main()
