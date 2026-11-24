"""general_source v5 hooks: only a source carrying the v5 marker reaches them (V5-DESIGN §2.6, §6.1)."""
import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
from general_source import V5_CONTRACT, GeneralSourceError, validate_source  # noqa: E402
import structured_contract  # noqa: E402
from test_general_source import fixture  # noqa: E402

DISPLAY = {"kind": "display", "notation": "3x+5x=8x", "symbols": ["x"]}


def code_of(lesson, payload, scope):
    with unittest.TestCase().assertRaises(GeneralSourceError) as caught:
        validate_source(lesson, payload, scope)
    return caught.exception.code


class Marker(unittest.TestCase):
    def test_contract_constant_is_one(self):
        self.assertEqual(V5_CONTRACT, structured_contract.CONTRACT)
        self.assertEqual(V5_CONTRACT, "worksheet-wire/5")

    def test_v5_additions_without_the_marker_keep_todays_codes(self):
        lesson, payload = fixture("g9r:quad_func_and_eq", 9)
        scope = S.scope(lesson)
        validate_source(lesson, payload, scope)
        cases = []
        display = copy.deepcopy(payload)
        display["sections"][0]["questions"][0]["items"][0]["prompt"] = [DISPLAY]
        cases.append(("display span", display, "SOURCE_RICH_TEXT"))
        for field, value in (("printTask", False), ("key", {"form": "integer", "notation": "1", "symbols": [],
                                                             "binding": {"kind": "substitute"}})):
            changed = copy.deepcopy(payload)
            changed["sections"][0]["questions"][0]["items"][0]["answer"][field] = value
            cases.append((field, changed, "SOURCE_SHAPE"))
        cases.append(("selection", dict(copy.deepcopy(payload), selection={}), "SOURCE_SHAPE"))
        cases.append(("other contract", dict(copy.deepcopy(payload), contract="worksheet-wire/4"), "SOURCE_SHAPE"))
        cases.append(("contract not a string", dict(copy.deepcopy(payload), contract=5), "SOURCE_SHAPE"))
        for name, changed, code in cases:
            with self.subTest(name=name):
                self.assertEqual(code_of(lesson, changed, scope), code)

    def test_elementary_v4_sources_unchanged(self):
        lesson, payload = fixture("ד11", 4)
        scope = S.scope(lesson)
        validate_source(lesson, payload, scope)
        changed = copy.deepcopy(payload)
        changed["sections"][0]["questions"][0]["items"][0]["prompt"] = [DISPLAY]
        self.assertEqual(code_of(lesson, changed, scope), "SOURCE_RICH_TEXT")


class LazyImports(unittest.TestCase):
    def test_a_v4_job_loads_no_v5_module(self):
        """G3: validating v4 sources and closed-author payloads imports none of the v5 modules."""
        import subprocess
        script = (
            "import json, sys\n"
            "sys.path.insert(0, sys.argv[1])\n"
            "from pathlib import Path\n"
            "import general_adapters, runner\n"
            "from validation import validate_model\n"
            "root = Path(sys.argv[1]) / 'cloud/container/fixtures/general'\n"
            "for name in ('grade9-quadratic', 'grade4-fractions', 'grade1-counting', 'grade9-square'):\n"
            "    lesson = json.loads((root / name / 'lesson.json').read_text())\n"
            "    payload = json.loads((root / name / 'model-output.json').read_text())\n"
            "    validate_model(lesson, payload)\n"
            "    assert not runner._is_v5(payload)\n"
            "v5 = ('structured_contract', 'school_math', 'item_kinds', 'text_lint', 'leak_checks', 'lesson_select',\n"
            "      'mistake_models', 'structured_source', 'atom_order')\n"
            "print(json.dumps(sorted(name for name in v5 if name in sys.modules)))\n")
        done = subprocess.run([sys.executable, "-B", "-c", script, str(S.APP)], capture_output=True, text=True,
                              timeout=300)
        self.assertEqual(done.returncode, 0, done.stderr[-600:])
        self.assertEqual(done.stdout.strip(), "[]")


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class V5Source(unittest.TestCase):
    def setUp(self):
        self.lesson, self.scope, self.ir = S.lesson(), S.scope(), S.ir_good()

    def refused(self, change, lesson=None, scope=None):
        ir = copy.deepcopy(self.ir)
        change(ir)
        return code_of(lesson or self.lesson, ir, scope or self.scope)

    def question(self, ir, n):
        return ir["sections"][0]["questions"][n - 1]

    def test_compiled_ir_validates(self):
        checked = validate_source(self.lesson, self.ir, self.scope)
        self.assertEqual(checked["source"], self.ir)
        self.assertEqual(len(checked["evidence"]["computations"]), 60)
        from validation import validate_model
        self.assertEqual(validate_model(self.lesson, self.ir)["skill"], "middle")
        without = copy.deepcopy(self.ir)
        del without["contract"]
        self.assertEqual(code_of(self.lesson, without, self.scope), "SOURCE_SHAPE")

    def test_answer_refusals(self):
        def review(ir):
            self.question(ir, 13)["items"][0]["answer"] = {"kind": "review", "text": [{"kind": "text", "text": "א"}]}
        self.assertEqual(self.refused(review), "SOURCE_ANSWER")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 13)["items"][0]["answer"].update(printTask=True)),
                         "SOURCE_SHAPE")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 13)["items"][0]["answer"].update(unit="ס״מ")),
                         "SOURCE_SHAPE")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 13)["items"][0]["answer"].pop("key")),
                         "SOURCE_SHAPE")
        self.assertEqual(self.refused(
            lambda ir: self.question(ir, 13)["items"][0]["answer"]["key"].update(notation="5x+5")), "SOURCE_KEY")
        self.assertEqual(self.refused(
            lambda ir: self.question(ir, 7)["items"][0]["answer"]["key"].update(form="expression")), "SOURCE_KEY")
        self.assertEqual(self.refused(
            lambda ir: self.question(ir, 1)["items"][0]["answer"]["key"]["binding"].update(template="W_SUM")),
            "SOURCE_BINDING")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 13)["items"][0]["prompt"][0].update(
            notation="3x+5+2x-2")), "SOURCE_BINDING")

    def test_span_refusals(self):
        self.assertEqual(self.refused(lambda ir: self.question(ir, 1)["items"][0]["prompt"].__setitem__(
            1, {"kind": "math", "expression": {"type": "number", "numerator": 4, "denominator": 1}})),
            "SOURCE_RICH_TEXT")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 1)["items"][0]["prompt"].__setitem__(
            1, {"kind": "formula", "notation": "4"})), "SOURCE_RICH_TEXT")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 1)["items"][0]["prompt"].__setitem__(
            0, {"kind": "text", "text": "מספר הגדול פי 4 "})), "SOURCE_PLAIN_MATH")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 1)["items"][0]["prompt"].__setitem__(
            2, {"kind": "text", "text": " "})), "SOURCE_TEXT")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 1)["items"][0]["prompt"].__setitem__(
            2, {"kind": "text", "text": " , "})), "SOURCE_ATOM")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 1)["items"][0]["prompt"].__setitem__(
            1, {"kind": "display", "notation": "4", "symbols": ["c"]})), "SOURCE_DISPLAY")
        self.assertEqual(self.refused(lambda ir: ir["rule"].__setitem__(
            1, {"kind": "display", "notation": "3x+5x=8x", "symbols": ["c"]})), "SOURCE_DISPLAY")

    def test_question_refusals(self):
        self.assertEqual(self.refused(lambda ir: self.question(ir, 13).update(table={"head": [], "rows": []})),
                         "SOURCE_SHAPE")
        def seven(ir):
            items = self.question(ir, 13)["items"]
            items.extend(copy.deepcopy(items) + copy.deepcopy(items[:1]))
        self.assertEqual(self.refused(seven), "SOURCE_ITEMS")
        self.assertEqual(self.refused(lambda ir: self.question(ir, 13).update(
            intro=[{"kind": "text", "text": "חשבו את ערך הביטוי:"}])), "SOURCE_BINDING")
        def duplicate_item(ir):
            items = self.question(ir, 13)["items"]
            items[2] = copy.deepcopy(items[0])
        self.assertEqual(self.refused(duplicate_item), "SOURCE_LEAK")
        def duplicate_task(ir):
            self.question(ir, 15)["items"][0] = copy.deepcopy(self.question(ir, 13)["items"][0])
        self.assertEqual(self.refused(duplicate_task), "SOURCE_LEAK")

    def test_selection_refusals(self):
        self.assertEqual(self.refused(lambda ir: ir["selection"].update(delivered=19)), "SOURCE_SELECTION")
        self.assertEqual(self.refused(lambda ir: ir["selection"].update(floor=14)), "SOURCE_SELECTION")
        self.assertEqual(self.refused(lambda ir: ir["selection"]["replaced"][0].update(by="R6")), "SOURCE_SELECTION")
        self.assertEqual(self.refused(lambda ir: ir["selection"]["questions"][0].update(
            conceptIds=["g7:algebraic_expressions#9"])), "SOURCE_COVERAGE")
        self.assertEqual(self.refused(lambda ir: ir["sections"][0]["questions"].pop()), "SOURCE_SELECTION")
        self.assertEqual(self.refused(lambda ir: ir.pop("selection")), "SOURCE_SHAPE")

    def test_scope_refusals(self):
        lesson, _ = fixture("ד11", 4)
        self.assertEqual(code_of(lesson, copy.deepcopy(self.ir), S.scope(lesson)), "SOURCE_WIRE_SCOPE")
        equations = S.load("../../../cloud/container/fixtures/general/grade7-equation-skill/lesson.json")
        self.assertEqual(code_of(equations, copy.deepcopy(self.ir), S.scope(equations)), "SOURCE_WIRE_SCOPE")
        level_a = dict(self.lesson, level="a")
        self.assertEqual(code_of(level_a, copy.deepcopy(self.ir), S.scope(level_a)), "SOURCE_WIRE_SCOPE")


if __name__ == "__main__":
    unittest.main()
