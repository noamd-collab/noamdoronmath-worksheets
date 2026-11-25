"""general_adapters v5 hooks: the pinned middle inputs of a compiled v5 source (V5-DESIGN §2.6 A1-A3, §6.1)."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import general_adapters  # noqa: E402
from general_source import GeneralSourceError, validate_source  # noqa: E402
from text_lint import lint_levels  # noqa: E402


class RichText(unittest.TestCase):
    def test_unknown_span_kind_raises(self):
        with self.assertRaises(GeneralSourceError) as caught:
            general_adapters.rich_text([{"kind": "text", "text": "א"}, {"kind": "raw", "html": "<b>"}], 7)
        self.assertEqual(caught.exception.code, "SOURCE_RICH_TEXT")

    def test_display_span(self):
        span = {"kind": "display", "notation": "4y-y", "symbols": ["y"]}
        self.assertEqual(general_adapters.rich_text([span, {"kind": "text", "text": " עבור "},
                                                     {"kind": "display", "notation": "y=-2", "symbols": ["y"]}], 7),
                         "$4y − y$ עבור $y = −2$")
        with self.assertRaises(GeneralSourceError) as caught:
            general_adapters.rich_text([span], 4, H=object())
        self.assertEqual(caught.exception.code, "SOURCE_WIRE_SCOPE")

    def test_existing_kinds_unchanged(self):
        self.assertEqual(general_adapters.rich_text([{"kind": "text", "text": "שלום"},
                                                     {"kind": "geometry", "type": "angle", "names": "ABC"}], 8),
                         "שלום$\\angle{ABC}$")


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class MiddleInputs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.work = Path(cls.tmp.name) / "work"
        cls.work.mkdir()
        lesson, scope, ir = S.lesson(), S.scope(), S.ir_good()
        for name, value in (("lesson.json", lesson), ("model-output.json", ir), ("curriculum-scope.json", scope)):
            (cls.work / name).write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        env = {key: value for key, value in os.environ.items() if key in ("PATH", "HOME", "TMPDIR", "LANG")}
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        # As runner.render_job(contract=...) runs it: the trusted flag, never the payload's marker, selects v5.
        cls.done = subprocess.run([sys.executable, "-B", str(S.APP / "general_adapters.py"), "--skill", str(S.MIDDLE),
                                   "--work", str(cls.work), "--contract", "worksheet-wire/5"], cwd=cls.work, env=env,
                                  capture_output=True, text=True, timeout=300)
        cls.ir = ir

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def level(self):
        return json.loads((self.work / "levels.json").read_text(encoding="utf-8"))[0]

    def test_compiles(self):
        self.assertEqual(self.done.returncode, 0, self.done.stderr[-600:])
        self.assertEqual(json.loads(self.done.stdout)["skill"], "middle")

    def test_grade_line_rule_and_intros(self):
        level = self.level()
        self.assertEqual(level["grade"], "כיתה ז׳")
        self.assertTrue(level["rule"].endswith("למשל: $3x + 5x = 8x$."))
        overlay = S.overlay()
        self.assertEqual(level["questions"][0]["intro"], overlay["verbs"]["write_from_words"])
        self.assertEqual(level["questions"][12]["intro"], overlay["verbs"]["collect_like_terms"])
        self.assertEqual(level["questions"][17]["intro"], overlay["verbs"]["find_error_collect"])

    def test_item_texts_and_answers(self):
        level = self.level()
        questions = level["questions"]
        self.assertEqual(questions[0]["items"][0]["text"], "מספר הגדול פי $4$ מ־$x$")
        self.assertEqual(questions[6]["items"][0]["text"], "$4y − y$ עבור $y = −2$")
        self.assertEqual(questions[12]["items"][0]["text"], "$3x + 5 + 2x − 1$")
        self.assertEqual(questions[17]["items"][0]["text"], "כינוס הביטוי $4a + 3 + a + 2$ נתן $10a$")
        self.assertEqual(level["answers"][12][1][0], ["א", "$5x + 4$"])
        self.assertEqual(level["answers"][6][1][0], ["א", "$−6$"])
        self.assertEqual(level["answers"][17], [18, [["א", "$5a + 5$"], ["ב", "$4x + 6$"], ["ג", "$6b + 2a$"]], True])

    def test_given_is_the_body_and_no_task_text_is_appended(self):
        level = self.level()
        source = self.ir["sections"][0]["questions"]
        for question, ir_question in zip(level["questions"], source):
            for item, ir_item in zip(question["items"], ir_question["items"]):
                self.assertEqual(item["given"], [item["text"]])
                self.assertEqual(item["text"], general_adapters.rich_text(ir_item["prompt"], 7))
                self.assertEqual(item["to_prove"][0]["value"], item["answer"])
                self.assertEqual(item["to_prove"][0]["quantity"], "value")
                self.assertNotIn("_", item["text"])
        printed = [item["text"] for q in level["questions"] for item in q["items"]]
        printed += [pair[1] for row in level["answers"] for pair in row[1]]
        for text in printed:
            self.assertNotIn("-", "".join(text.split("$")[1::2]))      # every minus inside an island is U+2212

    def test_bridge_constant_and_lint(self):
        bridge = (self.work / "content.py").read_text(encoding="utf-8")
        self.assertEqual(bridge, general_adapters.MIDDLE_BRIDGE + 'PACKAGE = "G7-T90"\n')
        self.assertEqual(lint_levels([self.level()]), [])
        source = json.loads((self.work / "worksheet-source.json").read_text(encoding="utf-8"))
        self.assertEqual(source["meta"], {"gradeNumber": 7, "levelCode": "b", "topicId": "g7:algebraic_expressions",
                                          "contract": "worksheet-wire/5"})
        verified = json.loads((self.work / "verified.json").read_text(encoding="utf-8"))
        self.assertEqual(verified["scope"], "typed tasks only")
        self.assertEqual(len(verified["computations"]), 60)

    def test_elementary_guard(self):
        from test_general_source import fixture
        lesson, _ = fixture("ד11", 4)
        scope = S.scope(lesson)
        with self.assertRaises(GeneralSourceError) as caught:
            general_adapters.compile_source(lesson, {"source": S.ir_good()}, scope, "/unused", self.work / "x",
                                            contract="worksheet-wire/5")
        self.assertEqual(caught.exception.code, "SOURCE_WIRE_SCOPE")
        with self.assertRaises(GeneralSourceError) as caught:
            validate_source(lesson, S.ir_good(), scope, contract="worksheet-wire/5")
        self.assertEqual(caught.exception.code, "SOURCE_WIRE_SCOPE")
        for call in (lambda: general_adapters.compile_source(lesson, {"source": S.ir_good()}, scope, "/unused",
                                                             self.work / "y"),
                     lambda: validate_source(lesson, S.ir_good(), scope)):
            with self.assertRaises(GeneralSourceError) as caught:
                call()
            self.assertEqual(caught.exception.code, "SOURCE_SHAPE")      # unflagged: as before v5
        self.assertFalse((self.work / "x").exists())
        self.assertFalse((self.work / "y").exists())


if __name__ == "__main__":
    unittest.main()
