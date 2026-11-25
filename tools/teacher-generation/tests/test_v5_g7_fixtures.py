"""The g7 fixture set in tests/fixtures/v5/g7_algebraic_expressions/ (stage 2, offline).

- reply_good.json: 20 planned questions (17 practice + 3 challenges) and 6 reserves, all clean: delivers 20/20
  with no replacement and the hand-computed keys of expected.json.
- reply_with_failures.json: six planned questions are refused (text, scope, two leaks, an unmodeled mistake,
  a wrong kind); the six reserves fill them, Q12 is trimmed to three items, and 20/20 are delivered.
- adversarial.json: single questions, each refused with an exact code set and exact refusal records.
  One case was a known defect, recorded as an expected failure; it is fixed and the test now runs normally.
- expected.json: the hand-computed keys, cross-checked here against an independent sympy evaluation.
"""
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402

G7 = S.FIXTURES / "g7_algebraic_expressions"
CASE = "reply_with_failures"
REQUIRED_CODES = ("TEXT_CHAR", "TEXT_GLUED_REF", "TEXT_ARGUMENT_REQUEST", "REF_UNDECLARED", "TEXT_NUMBER_WORD",
                  "MATH_PARSE", "MATH_SCOPE_PRODUCT_OF_SUM", "MATH_SCOPE_POWER", "NOTHING_TO_DO", "LEAK_OWN",
                  "LEAK_PINNED_VALUE", "MISTAKE_UNMODELED", "FORM_UNKNOWN", "FIELD_NOT_EMPTY", "DUPLICATE_ITEM")


def load(name):
    return json.loads((G7 / name).read_text(encoding="utf-8"))


def lesson():
    return load("lesson.json")


def scope():
    from runtime_catalog import scope_for_lesson
    return scope_for_lesson(lesson())


def rows():
    from structured_source import plan_slots
    planned, reserves = plan_slots(lesson(), scope(), S.overlay())
    return {row.slot: row for row in list(planned) + list(reserves)}


def context():
    from item_kinds import Context
    return Context(lesson(), scope(), S.overlay(), str(S.MIDDLE))


def by_slot(reply):
    return {question["slot"]: question for question in reply["questions"]}


def records(refusals):
    return sorted([refusal.item, refusal.field, refusal.code] for refusal in refusals)


# ------------------------------------------------------------------ an evaluator that shares no code with v5

def _sympy(text):
    """'3x+10y' → 3*x + 10*y, read by sympy after inserting the implicit products (independent of school_math)."""
    import sympy
    text = text.replace("−", "-")
    text = re.sub(r"(?<=[0-9a-z)])(?=[a-z(])", "*", text)
    return sympy.sympify(text, locals={name: sympy.Symbol(name) for name in "xyab"})


def _values(text):
    out = {}
    for part in text.split(","):
        letter, value = part.split("=")
        out[letter.strip()] = int(value)
    return out


class FixtureFiles(unittest.TestCase):
    def test_lesson_is_the_repro_lesson(self):
        from runtime_catalog import question_floor
        from validation import validate_lesson
        self.assertEqual(lesson(), S.lesson())          # the verbatim repro lesson of V5-DESIGN §7
        validate_lesson(lesson())
        self.assertEqual((lesson()["questionCount"], question_floor(lesson()["gradeNumber"])), (20, 20))

    def test_replies_are_strict_wire_replies_with_every_slot(self):
        from structured_contract import ITEM_FIELDS, QUESTION_FIELDS
        from structured_source import parse_wire, plan_slots
        planned, reserves = plan_slots(lesson(), scope(), S.overlay())
        slots = ["Q%d" % n for n in range(1, 21)] + ["R%d" % n for n in range(1, 7)]
        for name in ("reply_good.json", "reply_with_failures.json"):
            with self.subTest(reply=name):
                text = (G7 / name).read_text(encoding="utf-8")
                wires, refusals = parse_wire(text, planned, reserves)     # strict JSON text: duplicate keys refused
                self.assertEqual(list(wires), slots)
                self.assertEqual(refusals, [])
                for question in wires.values():
                    self.assertEqual(set(question), set(QUESTION_FIELDS))
                    for item in question["items"]:
                        self.assertEqual(set(item), set(ITEM_FIELDS))

    def test_adversarial_cases_are_well_formed_and_cover_the_required_codes(self):
        from structured_contract import is_known_code
        cases = load("adversarial.json")
        self.assertGreaterEqual(len([case for case in cases if not case.get("knownDefect")]), 15)
        self.assertEqual(len({case["case"] for case in cases}), len(cases))
        covered = set()
        for case in cases:
            with self.subTest(case=case["case"]):
                if case.get("knownDefect"):
                    self.assertTrue(case["expectAnyOf"])
                    continue
                self.assertEqual(case["expect"], sorted({code for _, _, code in case["refusals"]}))
                self.assertTrue(all(is_known_code(code) for code in case["expect"]))
                covered.update(case["expect"])
        self.assertEqual(sorted(set(REQUIRED_CODES) - covered), [])

    def test_hand_computed_keys_agree_with_an_independent_evaluation(self):
        """0 wrong keys: every expected key equals sympy's value of the wire item (substituted or expanded), and
        every find_error wrong result differs from its key."""
        expected = load("expected.json")
        for name in ("reply_good", "reply_with_failures"):
            wires = by_slot(load(name + ".json"))
            for row in expected[name]["printed"]:
                question = wires[row["slot"]]
                items = question["items"][:len(row["keys"])]
                for item, key in zip(items, row["keys"]):
                    with self.subTest(reply=name, slot=row["slot"], expr=item["expr"]):
                        task = _sympy(item["expr"])
                        if question["kind"] == "substitute":
                            value = task.subs({_sympy(letter): v for letter, v in _values(item["values"]).items()})
                            self.assertEqual(int(key), value)
                        else:
                            self.assertEqual((task - _sympy(key)).expand(), 0)
                        if question["kind"] == "find_error_collect":
                            self.assertNotEqual((_sympy(item["expr2"]) - _sympy(key)).expand(), 0)
        reserves = by_slot(load("reply_good.json"))
        for slot, keys in expected["reply_good"]["reserves"].items():
            for item, key in zip(reserves[slot]["items"], keys):
                task = _sympy(item["expr"])
                if reserves[slot]["kind"] == "substitute":
                    task = task.subs({_sympy(letter): v for letter, v in _values(item["values"]).items()})
                self.assertEqual((task - _sympy(key)).expand(), 0, (slot, item["expr"]))


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class AdversarialQuestions(unittest.TestCase):
    def setUp(self):
        self.ctx, self.rows = context(), rows()

    def test_every_adversarial_case_is_refused_with_its_exact_codes_and_records(self):
        import structured_source as ss
        for case in load("adversarial.json"):
            if case.get("knownDefect"):
                continue
            with self.subTest(case=case["case"]):
                compiled = ss.compile_question(case["question"], self.rows[case["slot"]], self.ctx)
                self.assertIsNone(compiled.ir)
                self.assertEqual(list(compiled.codes), case["expect"])
                self.assertEqual(records(compiled.refusals), sorted(case["refusals"]))

    def test_known_defect_a_reference_in_a_substitute_expression_is_refused_not_raised(self):
        """Flipped when the defect was fixed: `{n1}` in a substitute expr used to pass parse, scope and binding and
        then raise an uncaught SchoolMathError out of compile_item (and out of compile_sheet). Spec: refuse the item."""
        import structured_source as ss
        for case in load("adversarial.json"):
            if not case.get("knownDefect"):
                continue
            with self.subTest(case=case["case"]):
                compiled = ss.compile_question(case["question"], self.rows[case["slot"]], self.ctx)
                self.assertIsNone(compiled.ir)
                self.assertIn(list(compiled.codes), case["expectAnyOf"])


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class Sheets(unittest.TestCase):
    def compile(self, name):
        from structured_source import compile_sheet
        return compile_sheet(lesson(), scope(), load(name + ".json"), skill_path=str(S.MIDDLE))

    def check_printed(self, result, expected):
        import school_math
        selection = result.ir["selection"]
        questions = result.ir["sections"][0]["questions"]
        self.assertEqual(len(questions), 20)
        for question, row, want in zip(questions, selection["questions"], expected["printed"]):
            with self.subTest(n=want["n"]):
                self.assertEqual((row["n"], row["slot"], row["origin"], row["star"], row["conceptIds"]),
                                 (want["n"], want["slot"], want["origin"], want["star"], want["conceptIds"]))
                self.assertEqual(question["star"], want["star"])
                keys = [item["answer"]["key"] for item in question["items"]]
                self.assertEqual([key["notation"] for key in keys], want["keys"])
                self.assertEqual([school_math.key_island(key) for key in keys], want["house"])
                self.assertEqual({key["binding"]["kind"] for key in keys}, {want["kind"]})

    def test_good_reply_delivers_twenty_with_the_hand_computed_keys(self):
        from general_source import validate_source
        expected = load("expected.json")["reply_good"]
        result = self.compile("reply_good")
        selection = result.ir["selection"]
        self.assertEqual({key: selection[key] for key in ("requested", "floor", "delivered", "replaced", "dropped")},
                         {key: expected[key] for key in ("requested", "floor", "delivered", "replaced", "dropped")})
        self.assertEqual(result.diagnostics["refusals"], [])          # all 26 questions, reserves included, clean
        self.assertEqual(result.diagnostics["trimmed"], [])
        self.assertEqual(result.diagnostics["repairRounds"], 0)
        self.assertTrue(set(expected["unusedReserves"]).isdisjoint(row["slot"] for row in selection["questions"]))
        self.check_printed(result, expected)
        checked = validate_source(lesson(), result.ir, scope(), contract="worksheet-wire/5")
        self.assertEqual(len(checked["evidence"]["computations"]), sum(len(row["keys"]) for row in expected["printed"]))
        self.assertEqual(checked["evidence"]["unverifiedAnswers"], [])

    def test_good_reply_reserves_compile_clean_with_their_keys(self):
        import structured_source as ss
        ctx, plan = context(), rows()
        wires = by_slot(load("reply_good.json"))
        for slot, keys in load("expected.json")["reply_good"]["reserves"].items():
            with self.subTest(slot=slot):
                compiled = ss.compile_question(wires[slot], plan[slot], ctx)
                self.assertEqual((compiled.codes, compiled.trimmed), ((), ()))
                self.assertEqual([item["answer"]["key"]["notation"] for item in compiled.ir["items"]], keys)

    def test_reply_with_failures_fills_every_refused_slot_from_the_reserves(self):
        expected = load("expected.json")["reply_with_failures"]
        result = self.compile("reply_with_failures")
        selection = result.ir["selection"]
        self.assertEqual({key: selection[key] for key in ("requested", "floor", "delivered", "replaced", "dropped")},
                         {key: expected[key] for key in ("requested", "floor", "delivered", "replaced", "dropped")})
        self.assertEqual(result.diagnostics["trimmed"], expected["trimmed"])
        self.assertEqual(sorted([r["slot"], r["item"], r["field"], r["code"]] for r in result.diagnostics["refusals"]),
                         sorted(expected["refusals"]))
        summary = result.diagnostics["selection"]
        self.assertEqual((summary["printed"], summary["byReserve"], summary["reservesOffered"],
                          summary["reservesRefused"], summary["missing"], summary["dropped"]), (20, 6, 6, 0, 0, 0))
        self.assertEqual(expected["unusedReserves"], [])
        self.check_printed(result, expected)

    def test_printed_prompts(self):
        """What the adapter prints for one item of each layout (text spans as written, displays as islands)."""
        import school_math

        def render(spans):
            return "".join(span["text"] if span["kind"] == "text" else school_math.display_island(span)
                           for span in spans)

        questions = self.compile("reply_good").ir["sections"][0]["questions"]
        prompts = {(n, j): render(questions[n - 1]["items"][j - 1]["prompt"])
                   for n, j in ((1, 3), (2, 2), (2, 4), (8, 2), (9, 4), (14, 2), (19, 3))}
        self.assertEqual(prompts, {
            (1, 3): "ההפרש בין פי $2$ מ־$a$ לבין $y$",          # Noam's wording, 2026-11-25
            (2, 2): "מספר הגדול פי $12$ מ־$b$",
            (2, 4): "פי $4$ מ־$a$ ועוד פי $3$ מ־$b$",
            (8, 2): "$2x + y$ עבור $x = 6$ ו־$y = −2$",
            (9, 4): "$a + 3b$ עבור $a = 2$ ו־$b = 4$",
            (14, 2): "$−6x + 9 + 8x + 2$",
            (19, 3): "כינוס הביטוי $a + 6x + 2a$ נתן $2a + 6x$"})


class CaseLayout(unittest.TestCase):
    def test_a_case_name_must_be_one_plain_file_name(self):
        import v5_offline_render
        with tempfile.TemporaryDirectory() as tmp:
            for case in ("../up", "a/b", ".hidden", "", "x" * 65):
                with self.subTest(case=case):
                    with self.assertRaises(ValueError):
                        v5_offline_render.run(G7 / "lesson.json", G7 / "reply_good.json", tmp, case=case,
                                              skill_path="/unused")
            self.assertEqual(os.listdir(tmp), [])

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_a_compile_failure_writes_a_case_report_with_exit_code_two(self):
        import v5_offline_render
        reply = load("reply_with_failures.json")
        reply["questions"] = [q for q in reply["questions"] if not q["slot"].startswith("R")]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "reply.json"
            path.write_text(json.dumps(reply, ensure_ascii=False), encoding="utf-8")
            summary = v5_offline_render.run(G7 / "lesson.json", path, Path(tmp) / "out", case="short",
                                            skill_path=str(S.MIDDLE))
            self.assertEqual(summary, {"status": "compile_failed", "code": "SHEET_BELOW_MINIMUM"})
            report = json.loads((Path(tmp) / "out/short/report.json").read_text(encoding="utf-8"))
            self.assertEqual((report["status"], report["exitCode"], report["code"]),
                             ("compile_failed", 2, "SHEET_BELOW_MINIMUM"))
            self.assertEqual([target["slot"] for target in report["missing"]], ["Q3", "Q5", "Q8", "Q16", "Q19", "Q20"])
            self.assertFalse((Path(tmp) / "out/short/sheet.pdf").exists())


@unittest.skipUnless(S.MIDDLE_PINNED and S.weasyprint_available() and " " not in str(S.MIDDLE),
                     "Pinned middle skill or WeasyPrint unavailable")
class CaseRender(unittest.TestCase):
    def test_reply_with_failures_renders_into_its_case_folder_with_a_report(self):
        import runner
        import v5_offline_render
        expected = load("expected.json")[CASE]
        with tempfile.TemporaryDirectory() as tmp:
            if " " in tmp:
                self.skipTest("The temporary folder contains a space")
            out, work = Path(tmp) / "out", Path(tmp) / "work"
            summary = v5_offline_render.run(G7 / "lesson.json", G7 / (CASE + ".json"), out, work_dir=work,
                                            skill_path=str(S.MIDDLE), dpi=40, case=CASE)
            self.assertEqual((summary["status"], summary["delivered"], summary["failedSteps"]),
                             ("needs_review", 20, []))
            folder = out / CASE
            report = json.loads((folder / "report.json").read_text(encoding="utf-8"))
            self.assertEqual((report["status"], report["exitCode"]), ("needs_review", 0))
            self.assertEqual((report["stepCounts"]["FAIL"], report["stepCounts"]["REVIEW"],
                              report["stepCounts"]["OTHER"]), (0, 0, 0))
            # Stricter since the stage-3 verification: the pinned build_plus gates that did not run are notRun too.
            self.assertEqual(set(report["notRun"]), runner.V5_NOT_RUN_ALLOWED | {
                "pinned-log:build_plus:G83:b", "pinned-log:build_plus:G83-room:b"})
            self.assertEqual({step["name"] for step in report["steps"] if step["status"] == "SKIP"},
                             runner.V5_NOT_RUN_ALLOWED)
            self.assertIs(report["verdict"]["fullyChecked"], False)
            self.assertIs(report["overlayReviewed"], True)                # Noam approved the g7 overlay
            self.assertEqual(report["overlayApproval"], {"by": "Noam", "at": "2026-11-25"})
            self.assertIs(report["executedChecksPassed"], True)
            self.assertIs(report["automatedChecksPassed"], False)        # SKIP is notRun, never PASS (D1)
            self.assertEqual(report["atomOrder"]["status"], "PASS")
            self.assertTrue(report["pdfProducer"].startswith("WeasyPrint"))
            self.assertEqual(report["selection"]["replaced"], expected["replaced"])
            self.assertEqual(report["trimmed"], expected["trimmed"])
            self.assertEqual([[item["key"] for item in row["items"]] for row in report["keys"]],
                             [row["house"] for row in expected["printed"]])
            self.assertEqual([row["slot"] for row in report["keys"]], [row["slot"] for row in expected["printed"]])
            pages = report["pdf"]["pages"]
            self.assertEqual(report["pages"], ["page-%d.png" % n for n in range(1, pages + 1)])
            self.assertTrue(all((folder / name).is_file() for name in report["pages"]))
            self.assertTrue((folder / "sheet.pdf").is_file())
            self.assertFalse((folder / "pages").exists())
            self.assertFalse(list(work.glob("out/docx/**/*.docx")))


if __name__ == "__main__":
    unittest.main()
