import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import spans
from general_adapters import rich_text
from general_source import GeneralSourceError, rich, validate_source
from runtime_catalog import catalog, scope_for_lesson
import provider
from test_general_runtime import intake, source


class ProviderMiddleMathTests(unittest.TestCase):
    def test_geometry_and_equations_print_complete_native_math_islands(self):
        samples = [
            ("במשולש ABC, הגובה AD מאונך לצלע BC.", "במשולש $ABC$, הגובה $AD$ מאונך לצלע $BC$."),
            ("AD הוא תיכון ולכן BD = DC.", "$AD$ הוא תיכון ולכן $BD = DC$."),
            ("הנתונים הם DE ∥ BC, AD ⊥ BC.", r"הנתונים הם $DE \para BC$, $AD \perp BC$."),
            ("נתון △ABC. לכן ∠ADB = 90°.", r"נתון $\tri ABC$. לכן $\angle{ADB} = 90°$."),
            ("הוכיחו כי ∠BAD = ∠DAC.", r"הוכיחו כי $\angle{BAD} = \angle{DAC}$."),
            ("מצאו את גודל ∠CAB.", r"מצאו את גודל $\angle{CAB}$."),
            ("הקטע CD = 12.50 מופיע בשרטוט.", "הקטע $CD = 12.50$ מופיע בשרטוט."),
            ("נהלו דיון על המשוואה x + 2 = 5.", "נהלו דיון על המשוואה $x + 2 = 5$."),
        ]
        for original, expected in samples:
            with self.subTest(original=original):
                typed = [{"kind": "text", "text": original}]
                with self.assertRaises(GeneralSourceError):
                    rich(typed, 8)
                canonical = rich(typed, 8, provider=True)
                self.assertEqual(rich_text(rich(canonical, 8), 8), expected)
                self.assertEqual(rich(spans(original, 8), 8), canonical)

    def test_untyped_or_unsafe_fragments_remain_invalid(self):
        for value in ["הקוד XYZ.", "∠ABA = 20°", "AB ⊥ BCC", "ΔABC", "∠A°", "90°°", "קוד#123", "01/02/2026",
                      "בקרו בכתובת example.com", "הגובה abc.", "נתון <script>A</script>.",
                      "חשבו \\sqrt{36}.", "הנתון הוא 2x+1.", "x + 2 = 5"]:
            with self.subTest(value=value), self.assertRaises(GeneralSourceError):
                rich([{"kind": "text", "text": value}], 8, provider=True)
        with self.assertRaises(GeneralSourceError):
            rich([{"kind": "text", "text": "מספר 2", "untrusted": True}], 8, provider=True)
        # A one-letter angle in the sentence is refused at the source: the locked gate G81 fails it at render.
        for value in ("מצאו את גודל ∠A.", "נתון ∠A = ∠B."):
            with self.subTest(value=value), self.assertRaises(GeneralSourceError) as refused:
                rich([{"kind": "text", "text": value}], 8, provider=True)
            self.assertEqual(refused.exception.code, "SOURCE_NOTATION")

    def test_mixed_math_separators_survive_normalization(self):
        single = {"kind": "math", "expression": {"type": "number", "numerator": 2, "denominator": 1}}
        self.assertEqual(rich_text(rich(["האורך הוא", {"kind": "text", "text": " 12 "}, "סנטימטרים."],
                                        8, provider=True), 8), "האורך הוא $12$ סנטימטרים.")
        with self.assertRaises(GeneralSourceError):
            rich([single, {"kind": "text", "text": " 12 "}], 8, provider=True)

    def test_one_math_token_can_span_adjacent_provider_text_fragments(self):
        for pieces, expected in [
            (["המשוואה x+1=4", "0"], "המשוואה $x + 1 = 40$"),
            (["12", "34"], "$1234$"),
            (["המחיר הוא 1,", "250.", "50 שקלים."], "המחיר הוא $1,250.50$ שקלים."),
            (["הגובה A", "D מאונך לצלע B", "C."], "הגובה $AD$ מאונך לצלע $BC$."),
            (["הנתון הוא ∠AB", "C = 4", "5°."], r"הנתון הוא $\angle{ABC} = 45°$."),
        ]:
            with self.subTest(pieces=pieces):
                raw = [({"kind": "text", "text": part} if i % 2 else part) for i, part in enumerate(pieces)]
                original = copy.deepcopy(raw)
                canonical = rich(raw, 8, provider=True)
                self.assertEqual(canonical, rich(spans("".join(pieces), 8), 8))
                self.assertEqual(rich_text(canonical, 8), expected)
                self.assertEqual(raw, original)
        for pieces in [["הקוד X", "YZ."], ["01/02/", "2026"], ["12 ", "34"]]:
            with self.subTest(pieces=pieces), self.assertRaises(GeneralSourceError):
                rich(pieces, 8, provider=True)

    def test_recovered_math_cannot_be_spliced_onto_pretyped_neighbors(self):
        digit = {"kind": "math", "expression": {"type": "number", "numerator": 4, "denominator": 1}}
        symbol = {"kind": "geometry", "type": "point", "names": "B"}
        for raw in [
            [digit, "0"], ["המשוואה x + 1 = 4", digit],
            ["12.", digit], [digit, ",250 תלמידים."], ["הנקודה A", symbol],
            [symbol, "C הוא קודקוד."],
        ]:
            with self.subTest(raw=raw), self.assertRaises(GeneralSourceError):
                rich(raw, 8, provider=True)
        safe = rich([digit, " תלמידים מתוך 40 השתתפו."], 8, provider=True)
        self.assertEqual(rich_text(safe, 8), "$4$ תלמידים מתוך $40$ השתתפו.")
        historic = [digit, {"kind": "text", "text": " לעומת "}, digit]
        self.assertEqual(rich(historic, 8), historic)
        self.assertEqual(rich(historic, 8, provider=True), historic)

    def test_inline_marks_cannot_split_one_printed_token_into_math_boxes(self):
        for raw in ["המשוואה [[x+1=4]]0", "המשוואה [[x+1=4]][[0]]",
                    "המחיר הוא 12.[[34]] שקלים.", "המחיר הוא [[12]].[[34]] שקלים.",
                    "הקטע [[A]][[B]]", "המספר [[1]],[[234]]"]:
            with self.subTest(raw=raw), self.assertRaises(GeneralSourceError):
                spans(raw, 8)
        valid = spans("המספרים הם [[12]], [[34]].", 8)
        self.assertEqual(rich_text(rich(valid, 8), 8), "המספרים הם $12$, $34$.")

    def test_initial_and_revised_mixed_provider_representations_match_strict_canonical(self):
        topic = next(t for t in catalog().topics if t["topicId"] == "g8:triangle_parts")
        lesson = intake(topic)
        lesson.update(level="e", questionCount=20, minutes=30)
        original = source(lesson)
        qs = original["sections"][0]["questions"]
        rows = [{k: v for k, v in q.items() if k != "star"} for q in qs]
        rows[0]["intro"] = [{"kind": "text", "text": "במשולש ABC, הגובה AD מאונך לצלע BC."}]
        rows[0]["items"][0] = {"prompt": "הסבירו את הנתון.", "answer": {"kind": "review", "text": [
            {"kind": "text", "text": "נתון כי ∠ADB = 90°."}]}}
        rows[0]["table"] = {"head": ["שם הקטע", "אורך"], "rows": [[{"kind": "text", "text": "הקטע BC"}, "12"]]}
        flat = {"title": original["title"], "rule": [{"kind": "text", "text": "נתון △ABC."}],
                "practice": rows[:-3], "challenges": rows[-3:]}
        replacement = copy.deepcopy(rows[0])
        replacement["intro"] = [{"kind": "text", "text": "נתון AD ⊥ BC."}]
        untouched = copy.deepcopy(flat)
        revision = {}
        with patch("provider.build_authoring_context", return_value={}), patch(
            "provider.request_author_json", side_effect=[flat, {"q1": replacement}]
        ) as author:
            first = provider.author_lesson(lesson, revision=revision, api_key="synthetic-fixture-key",
                base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model="fixture-model")
            self.assertEqual(author.call_count, 1)
            second = revision["revise"]([{"question": 1, "feedback": ["Check this question."]}])
        for candidate in (first, second):
            checked = validate_source(lesson, candidate, scope_for_lesson(lesson))
            self.assertEqual(checked["source"], candidate)
        self.assertEqual(rich_text(second["sections"][0]["questions"][0]["intro"], 8), r"נתון $AD \perp BC$.")
        self.assertEqual(flat, untouched)
        self.assertEqual(first["sections"][0]["questions"][1:], second["sections"][0]["questions"][1:])


if __name__ == "__main__":
    unittest.main()
