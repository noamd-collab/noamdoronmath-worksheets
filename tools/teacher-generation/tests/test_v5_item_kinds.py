"""item_kinds: the four stage-2 kinds, their exact IR, every item code, and the shared verifier (V5-DESIGN §6.1)."""
import copy
from fractions import Fraction
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import item_kinds as ik  # noqa: E402
import school_math  # noqa: E402
from math_tasks import MathTaskError, number, validate_and_solve_task  # noqa: E402
from structured_contract import code_strings  # noqa: E402

D = lambda notation, symbols=(): {"kind": "display", "notation": notation, "symbols": list(symbols)}  # noqa: E731
T = lambda text: {"kind": "text", "text": text}  # noqa: E731


def compiled(kind, item, skill_path=None):
    return ik.compile_item(kind, item, 1, S.context(skill_path))


class ExactIR(unittest.TestCase):
    """The §2.1 inputs give exactly the §2.6 prompt, task and key."""

    def test_collect(self):
        out = compiled("collect_like_terms", S.item("3x+5+2x-1"))
        self.assertEqual(out.refusals, [])
        self.assertEqual(out.prompt, [D("3x+5+2x-1", "x")])
        self.assertEqual(out.answer["task"], {"kind": "simplify", "expression": school_math.to_kernel(
            school_math.parse("3x+5+2x-1", letters="x"))})
        self.assertEqual(out.answer["key"], {"form": "expression", "notation": "5x+4", "symbols": ["x"],
                                             "binding": {"kind": "collect_like_terms"}})
        self.assertEqual((out.answer["unit"], out.answer["printTask"], out.answer["kind"]), ("", False, "computed"))
        for expr, key in (("-4y+9+6y-2", "2y+7"), ("8a-3+a-5", "9a-8"), ("5+3x+2", "7+3x")):
            self.assertEqual(compiled("collect_like_terms", S.item(expr)).answer["key"]["notation"], key)

    def test_substitute(self):
        out = compiled("substitute", S.item("4y-y", values="y=-2"))
        self.assertEqual(out.prompt, [D("4y-y", "y"), T(" עבור "), D("y=-2", "y")])
        self.assertEqual(out.answer["task"]["values"], {"y": {"type": "number", "numerator": -2, "denominator": 1}})
        self.assertEqual(out.answer["key"], {"form": "integer", "notation": "-6", "symbols": [],
                                             "binding": {"kind": "substitute"}})
        two = compiled("substitute", S.item("2x+y", values="y=-1, x=3"))
        self.assertEqual(two.prompt, [D("2x+y", "xy"), T(" עבור "), D("x=3", "x"), T(" ו־"), D("y=-1", "y")])
        self.assertEqual(two.answer["key"]["notation"], "5")
        for expr, values, key in (("2a+5", "a=3", "11"), ("5b-2b", "b=4", "12")):
            self.assertEqual(compiled("substitute", S.item(expr, values=values)).answer["key"]["notation"], key)

    def test_write_from_words(self):
        out = compiled("write_from_words", S.item("4x", variant="W_TIMES"))
        self.assertEqual(out.prompt, [T("מספר הגדול פי "), D("4"), T(" מ־"), D("x", "x")])
        self.assertEqual(out.answer["task"]["kind"], "simplify")
        self.assertEqual(out.answer["key"], {"form": "expression", "notation": "4x", "symbols": ["x"],
                                             "binding": {"kind": "write_from_words", "template": "W_TIMES"}})
        layouts = {
            "W_SUM": ("a+b", [T("הסכום של "), D("a", "a"), T(" ו־"), D("b", "b")], "a+b"),
            "W_DIFF": ("x-y", [T("ההפרש בין "), D("x", "x"), T(" לבין "), D("y", "y")], "x-y"),
            "W_PRODUCT": ("ab", [T("המכפלה של "), D("a", "a"), T(" ב־"), D("b", "b")], "ab"),
            "W_TIMES_PLUS": ("3y+x", [T("פי "), D("3"), T(" מ־"), D("y", "y"), T(" ועוד "), D("x", "x")], "3y+x"),
            "W_TIMES_MINUS": ("5a-b", [T("פי "), D("5"), T(" מ־"), D("a", "a"), T(" פחות "), D("b", "b")], "5a-b"),
            "W_TWO_TIMES": ("2x+7y", [T("פי "), D("2"), T(" מ־"), D("x", "x"), T(" ועוד פי "), D("7"), T(" מ־"),
                                      D("y", "y")], "2x+7y"),
        }
        for template, (expr, prompt, key) in layouts.items():
            with self.subTest(template=template):
                out = compiled("write_from_words", S.item(expr, variant=template))
                self.assertEqual(out.prompt, prompt)
                self.assertEqual(out.answer["key"]["notation"], key)

    def test_find_error_prints_the_code_derived_wrong_result(self):
        cases = (("M1", "4a+3+a+2", "10a", "5a+5", ["a"]), ("M2", "6x+7-1-2x", "4x+8", "4x+6", ["x"]),
                 ("M3", "5b+2a+b", "5b+2a", "6b+2a", ["b", "a"]))
        for model, expr, wrong, key, symbols in cases:
            with self.subTest(model=model):
                out = compiled("find_error_collect", S.item(expr, wrong, variant=model))
                self.assertEqual(out.prompt, [T("כינוס הביטוי "), D(expr, symbols), T(" נתן "), D(wrong, symbols)])
                self.assertEqual(out.answer["key"]["notation"], key)
                self.assertEqual(out.answer["key"]["binding"], {"kind": "find_error_collect", "model": model})
        # The wrong result prints in canonical first-appearance form, whatever equal form the model wrote.
        out = compiled("find_error_collect", S.item("6x+7-1-2x", "8+4x", variant="M2"))
        self.assertEqual(out.prompt[3], D("4x+8", "x"))

    def test_only_drills_and_find_error_print_the_task(self):
        """Nothing else prints a task: write_from_words prints its phrase only, no display equals its task."""
        out = compiled("write_from_words", S.item("3y+x", variant="W_TIMES_PLUS"))
        displays = [span["notation"] for span in out.prompt if span["kind"] == "display"]
        self.assertNotIn("3y+x", displays)
        self.assertEqual(displays, ["3", "y", "x"])
        for kind, item in (("collect_like_terms", S.item("3x+5+2x-1")), ("substitute", S.item("4y-y", values="y=-2")),
                           ("find_error_collect", S.item("4a+3+a+2", "10a", variant="M1"))):
            out = compiled(kind, item)
            task_display = next(span for span in out.prompt if span["kind"] == "display"
                                and span["notation"] == item["expr"])
            node = school_math.parse(task_display["notation"], letters=task_display["symbols"])
            self.assertEqual(school_math.to_kernel(node), out.answer["task"]["expression"])

    def test_intro_spans_are_the_overlay_verbs(self):
        overlay = S.overlay()
        for kind in ik.KINDS:
            self.assertEqual(ik.intro_spans(kind, overlay), [T(overlay["verbs"][kind])])


class ItemCodes(unittest.TestCase):
    """Every I1–I6 code (§4, §7 adversarial table) at item level."""

    def codes(self, kind, item):
        return compiled(kind, item).codes

    def test_shape_and_field_codes(self):
        bad = S.item("4x", variant="W_TIMES")
        del bad["expr2"]
        self.assertEqual(self.codes("write_from_words", bad), ("ITEM_SHAPE",))
        self.assertEqual(self.codes("write_from_words", dict(S.item("4x", variant="W_TIMES"), expr="4x", text=7)),
                         ("ITEM_SHAPE",))
        self.assertEqual(self.codes("write_from_words", S.item("4x", variant="W_TIMES", text="חשבו")),
                         ("FIELD_NOT_EMPTY",))
        self.assertEqual(self.codes("collect_like_terms", S.item("3x+5+2x-1", values="x=1")), ("FIELD_NOT_EMPTY",))
        self.assertEqual(self.codes("collect_like_terms", S.item("3x+5+2x-1", ask="value")), ("FIELD_NOT_EMPTY",))
        self.assertEqual(self.codes("collect_like_terms", S.item("x+2x", form="integer")), ("FORM_UNKNOWN",))
        self.assertEqual(self.codes("substitute", S.item("4y-y", values="y=2", form="expression")), ("FORM_UNKNOWN",))
        self.assertEqual(self.codes("write_from_words", S.item("4x", variant="W_HALF")), ("TEMPLATE_UNKNOWN",))
        self.assertEqual(self.codes("write_from_words", S.item("4x")), ("TEMPLATE_UNKNOWN",))
        self.assertEqual(self.codes("find_error_collect", S.item("4a+3+a+2", "10a", variant="M9")),
                         ("MISTAKE_UNKNOWN",))
        # Text is linted too when it is (wrongly) present.
        self.assertIn("TEXT_CHAR", self.codes("write_from_words", S.item("4x", variant="W_TIMES", text="פי 4")))

    def test_parse_and_scope_codes(self):
        cases = {"3x+": "MATH_PARSE", "x3+1": "MATH_PARSE", "5--2x": "MATH_PARSE", "3·x": "MATH_PARSE",
                 "3c+2c": "MATH_SYMBOL_UNDECLARED", "3(x+2)+x": "MATH_SCOPE_PRODUCT_OF_SUM",
                 "5-(2x+1)+x": "MATH_SCOPE_BRACKETS", "x^2+3x^2": "MATH_SCOPE_POWER", "2xx+x": "MATH_SCOPE_POWER",
                 "x/2+x": "MATH_SCOPE_DIVISION", "2.5x+x": "MATH_SCOPE_DECIMAL", "25x+3x": "MATH_SCOPE_RANGE",
                 "x+2x+3x+4x+5x": "MATH_SCOPE_TERMS", "x+y+a": "MATH_SCOPE_LETTERS", "3*x+2x": "MATH_SCOPE_PRODUCT",
                 "x+" + "1+" * 60 + "x": "MATH_LENGTH"}
        for expr, code in cases.items():
            with self.subTest(expr=expr):
                self.assertEqual(self.codes("collect_like_terms", S.item(expr)), (code,))
        self.assertEqual(self.codes("substitute", S.item("4y-y", values="y=15")), ("MATH_SCOPE_RANGE",))
        self.assertEqual(self.codes("substitute", S.item("4y-y", values="y:=2")), ("VALUES_SHAPE",))
        self.assertEqual(self.codes("substitute", S.item("4y-y", values="")), ("VALUES_SHAPE",))
        self.assertEqual(self.codes("substitute", S.item("4y-y", values="y=1" + ", y=2" * 10)), ("MATH_LENGTH",))
        self.assertEqual(self.codes("substitute", S.item("4y-y", values="c=2")), ("MATH_SYMBOL_UNDECLARED",))
        self.assertEqual(self.codes("find_error_collect", S.item("4a+3+a+2", "100a", variant="M1")),
                         ("MATH_SCOPE_RANGE",))

    def test_binding_codes(self):
        self.assertEqual(self.codes("collect_like_terms", S.item("3x+5")), ("NOTHING_TO_DO",))
        self.assertEqual(self.codes("find_error_collect", S.item("3x+5", "8x", variant="M1")), ("NOTHING_TO_DO",))
        self.assertEqual(self.codes("collect_like_terms", S.item("(-2)x+x")), ("MATH_PARSE",))
        for template, expr, code in (("W_SUM", "x+x", "TEMPLATE_MISMATCH"), ("W_TIMES", "x+3", "TEMPLATE_MISMATCH"),
                                     ("W_TIMES", "1x", "TEMPLATE_MISMATCH"), ("W_DIFF", "x+y", "TEMPLATE_MISMATCH"),
                                     ("W_TWO_TIMES", "2x+3x", "TEMPLATE_MISMATCH"),
                                     # out of scope: the template check is skipped, never counted as passed
                                     ("W_TIMES", "21x", "MATH_SCOPE_RANGE"), ("W_PRODUCT", "xx", "MATH_SCOPE_POWER")):
            with self.subTest(template=template, expr=expr):
                self.assertEqual(self.codes("write_from_words", S.item(expr, variant=template)), (code,))
        self.assertEqual(self.codes("substitute", S.item("4y-y", values="x=2")), ("VALUES_MISMATCH",))
        self.assertEqual(self.codes("substitute", S.item("2x+y", values="x=2")), ("VALUES_MISMATCH",))
        self.assertEqual(self.codes("substitute", S.item("y", values="y=3")), ("REVEALS_ANSWER",))
        self.assertEqual(self.codes("find_error_collect", S.item("4a+3+2a", "6a+3", variant="M3")),
                         ("MISTAKE_NOT_APPLICABLE",))
        self.assertEqual(self.codes("find_error_collect", S.item("4a+3+a+2", "9a", variant="M1")),
                         ("MISTAKE_UNMODELED",))
        self.assertEqual(self.codes("find_error_collect", S.item("4x+7-0+x", "5x+7", variant="M2")),
                         ("MISTAKE_NOT_WRONG",))

    def test_unreachable_codes_by_monkeypatch(self):
        def failing(task):
            raise MathTaskError("RESOURCE_LIMIT", "patched")
        with patch.object(ik, "validate_and_solve_task", failing):
            self.assertEqual(self.codes("collect_like_terms", S.item("3x+5+2x-1")), ("KERNEL_RESOURCE_LIMIT",))
        with patch.object(ik.school_math, "key_roundtrip", lambda *a, **k: False):
            self.assertEqual(self.codes("collect_like_terms", S.item("3x+5+2x-1")), ("KEY_ROUNDTRIP",))
        with patch.object(ik.school_math, "from_house_flat", lambda text, **kwargs: school_math.Num("0")):
            self.assertEqual(self.codes("collect_like_terms", S.item("3x+5+2x-1")), ("DISPLAY_ROUNDTRIP",))
        with patch.object(ik, "verify_item", side_effect=ik.BindingError("TEMPLATE_MISMATCH")):
            self.assertEqual(self.codes("collect_like_terms", S.item("3x+5+2x-1")), ("BINDING_INTERNAL",))
        with patch.object(ik.school_math, "polynomial_of_kernel", lambda ast: {(): Fraction(1, 2)}):
            self.assertEqual(self.codes("substitute", S.item("4y-y", values="y=2")), ("FORM_UNREPRESENTABLE",))

    def test_refusals_are_codes_and_fields_only(self):
        out = compiled("collect_like_terms", S.item("3(x+2)+x", form="integer", text="שלום"))
        for field, code in out.refusals:
            self.assertIn(field, ("", "text", "expr", "expr2", "values", "ask", "form", "variant"))
            self.assertRegex(code, r"^[A-Z_]{1,60}$")


class VerifyItem(unittest.TestCase):
    """verify_item accepts compile output and refuses tampering."""

    def setUp(self):
        self.overlay = S.overlay()
        self.items = {
            "collect_like_terms": compiled("collect_like_terms", S.item("3x+5+2x-1")),
            "substitute": compiled("substitute", S.item("4y-y", values="y=-2")),
            "write_from_words": compiled("write_from_words", S.item("3y+x", variant="W_TIMES_PLUS")),
            "find_error_collect": compiled("find_error_collect", S.item("4a+3+a+2", "10a", variant="M1")),
        }

    def check(self, prompt, answer):
        ik.verify_item(prompt, answer, validate_and_solve_task(answer["task"]), self.overlay)

    def refused(self, prompt, answer):
        with self.assertRaises(ik.BindingError) as caught:
            self.check(prompt, answer)
        return caught.exception.code

    def test_accepts_compile_output(self):
        for kind, out in self.items.items():
            with self.subTest(kind=kind):
                self.check(out.prompt, out.answer)

    def test_display_changed(self):
        out = self.items["collect_like_terms"]
        prompt = copy.deepcopy(out.prompt)
        prompt[0]["notation"] = "3x+5+2x-2"
        self.assertEqual(self.refused(prompt, out.answer), "BINDING_INTERNAL")
        prompt[0]["notation"] = "3x+5+2x -1"
        self.assertEqual(self.refused(prompt, out.answer), "DISPLAY_INVALID")
        prompt[0] = {"kind": "display", "notation": "3x+5+2x-1", "symbols": ["x", "y"]}
        self.assertEqual(self.refused(prompt, out.answer), "DISPLAY_INVALID")

    def test_key_off_by_one(self):
        for kind, notation in (("collect_like_terms", "5x+5"), ("substitute", "-5"), ("find_error_collect", "5a+6")):
            out = self.items[kind]
            answer = copy.deepcopy(out.answer)
            answer["key"]["notation"] = notation
            self.assertEqual(self.refused(out.prompt, answer), "KEY_ROUNDTRIP")
        out = self.items["collect_like_terms"]
        answer = copy.deepcopy(out.answer)
        answer["key"]["notation"] = "4+5x"           # kernel-equal, but not the house key printer's order
        self.assertEqual(self.refused(out.prompt, answer), "KEY_ROUNDTRIP")
        answer["key"]["form"] = "integer"
        self.assertEqual(self.refused(out.prompt, answer), "FORM_UNKNOWN")

    def test_template_text_changed(self):
        out = self.items["write_from_words"]
        prompt = copy.deepcopy(out.prompt)
        prompt[0]["text"] = "פי שניים "
        self.assertEqual(self.refused(prompt, out.answer), "TEMPLATE_MISMATCH")
        prompt = copy.deepcopy(out.prompt)
        prompt[1]["notation"] = "4"                   # the phrase now says 4y+x, the task is 3y+x
        self.assertEqual(self.refused(prompt, out.answer), "BINDING_INTERNAL")
        answer = copy.deepcopy(out.answer)
        answer["key"]["binding"]["template"] = "W_TIMES_MINUS"
        self.assertEqual(self.refused(out.prompt, answer), "TEMPLATE_MISMATCH")

    def test_wrong_result_changed(self):
        out = self.items["find_error_collect"]
        prompt = copy.deepcopy(out.prompt)
        prompt[3] = D("9a", "a")
        self.assertEqual(self.refused(prompt, out.answer), "MISTAKE_UNMODELED")
        answer = copy.deepcopy(out.answer)
        answer["key"]["binding"]["model"] = "M2"
        self.assertEqual(self.refused(out.prompt, answer), "MISTAKE_NOT_APPLICABLE")

    def test_layout_reordered(self):
        out = self.items["substitute"]
        self.assertEqual(self.refused(list(reversed(out.prompt)), out.answer), "BINDING_INTERNAL")
        prompt = copy.deepcopy(out.prompt)
        prompt[1]["text"] = " כאשר "
        self.assertEqual(self.refused(prompt, out.answer), "BINDING_INTERNAL")
        answer = copy.deepcopy(out.answer)
        answer["task"]["values"]["y"] = number(-3)
        self.assertEqual(self.refused(out.prompt, answer), "VALUES_MISMATCH")

    def test_answer_shape_and_print_task(self):
        out = self.items["collect_like_terms"]
        for field, value in (("printTask", True), ("unit", "ס״מ"), ("kind", "review")):
            answer = dict(copy.deepcopy(out.answer), **{field: value})
            self.assertEqual(self.refused(out.prompt, answer), "BINDING_INTERNAL")
        answer = copy.deepcopy(out.answer)
        answer["key"]["binding"] = {"kind": "collect_like_terms", "template": "W_TIMES"}
        self.assertEqual(self.refused(out.prompt, answer), "BINDING_INTERNAL")
        write = self.items["write_from_words"]
        for binding, code in (({"kind": ["x"]}, "BINDING_INTERNAL"),
                              ({"kind": "write_from_words", "template": ["W_TIMES"]}, "TEMPLATE_UNKNOWN"),
                              ({"kind": "find_error_collect", "model": {}}, "MISTAKE_UNKNOWN")):
            answer = copy.deepcopy(write.answer)
            answer["key"]["binding"] = binding
            self.assertEqual(self.refused(write.prompt, answer), code)


class VerifyQuestionAndDisplay(unittest.TestCase):
    def setUp(self):
        self.overlay = S.overlay()
        items = [compiled("collect_like_terms", S.item(expr)) for expr in ("3x+5+2x-1", "-4y+9+6y-2", "8a-3+a-5")]
        self.question = {"intro": ik.intro_spans("collect_like_terms", self.overlay), "star": False,
                         "items": [{"prompt": out.prompt, "answer": out.answer} for out in items]}

    def test_verify_question(self):
        ik.verify_question(self.question, self.overlay)
        for change, code in ((lambda q: q.update(star=True), "BINDING_INTERNAL"),
                             (lambda q: q.update(intro=[T("חשבו:")]), "BINDING_INTERNAL"),
                             (lambda q: q["items"].pop(), "ITEM_COUNT"),
                             (lambda q: q["items"][1]["answer"]["key"]["binding"].update(kind="substitute"),
                              "BINDING_INTERNAL")):
            question = copy.deepcopy(self.question)
            change(question)
            with self.assertRaises(ik.BindingError) as caught:
                ik.verify_question(question, self.overlay)
            self.assertEqual(caught.exception.code, code)
        challenge = compiled("find_error_collect", S.item("4a+3+a+2", "10a", variant="M1"))
        question = {"intro": ik.intro_spans("find_error_collect", self.overlay), "star": True,
                    "items": [{"prompt": challenge.prompt, "answer": challenge.answer}] * 3}
        ik.verify_question(question, self.overlay)

    def test_check_display_span(self):
        ik.check_display_span(D("3x+5x=8x", "x"), self.overlay)
        for span, code in ((D("3c", "c"), "MATH_SYMBOL_UNDECLARED"), (D("3x", ""), "MATH_SYMBOL_UNDECLARED"),
                           (D("3x+", "x"), "DISPLAY_INVALID"), (dict(D("3x", "x"), extra=1), "DISPLAY_INVALID"),
                           (D("3x", "xx"), "DISPLAY_INVALID"), (D("3 x", "x"), "DISPLAY_INVALID"),
                           ({"kind": "display", "notation": 3, "symbols": []}, "DISPLAY_INVALID")):
            with self.subTest(span=span):
                with self.assertRaises(ik.BindingError) as caught:
                    ik.check_display_span(span, self.overlay)
                self.assertEqual(caught.exception.code, code)


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class PinnedSkill(unittest.TestCase):
    def test_every_template_instance_passes_the_d12_mirror(self):
        import leak_checks
        overlay = S.overlay()
        low, _ = overlay["templateNumbers"]
        for template, row in overlay["templates"].items():
            expr = "".join({"k": str(low), "m": str(low + 1), "v": "x", "w": "y"}.get(ch, ch) for ch in row["shape"])
            out = compiled("write_from_words", S.item(expr, variant=template))
            self.assertEqual(out.refusals, [], template)
            question = {"intro": ik.intro_spans("write_from_words", overlay), "star": False,
                        "items": [{"prompt": out.prompt, "answer": out.answer}] * 3}
            self.assertEqual(leak_checks.d12_mirror(question, str(S.MIDDLE)), [], template)

    def test_code_written_strings_name_no_not_yet_tool(self):
        """Every code-written string, checked with the pinned didactic keyword reader in an isolated process."""
        strings = [text for _, text in code_strings(S.overlay())]
        script = ("import json, sys\nsys.dont_write_bytecode = True\nsys.path.insert(0, sys.argv[1])\nimport didactic\n"
                  "block = didactic.curriculum_block({'topic': 'algebraic_expressions', 'track': 'ז'}, grade='7')\n"
                  "ids = [row['id'] for row in block['not_yet_allowed']]\n"
                  "texts = json.loads(sys.stdin.read())\n"
                  "print(json.dumps([sorted(didactic.tools_named_in(text, ids=ids)) for text in texts]))\n")
        done = subprocess.run([sys.executable, "-I", "-B", "-c", script, str(S.MIDDLE)], input=json.dumps(strings),
                              capture_output=True, text=True, timeout=120)
        self.assertEqual(done.returncode, 0, done.stderr[-400:])
        self.assertEqual(json.loads(done.stdout), [[] for _ in strings])


if __name__ == "__main__":
    unittest.main()
