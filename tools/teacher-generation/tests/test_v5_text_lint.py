"""text_lint: Hebrew-only model text, code-written IR text, the atom rule and the pre-render levels.json lint."""
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import general_source
import structured_contract as sc
import text_lint as tl

APP = Path(__file__).resolve().parents[1]
TERMS = sc.overlay_for("g7:algebraic_expressions", "b")["forbiddenTerms"]
MAQAF, GERESH, GERSHAYIM, NBSP, MINUS = "\u05be", "\u05f3", "\u05f4", "\u00a0", "\u2212"
EMITTED = {"TEXT_LENGTH", "TEXT_MARKUP", "TEXT_CHAR", "TEXT_GLUED_REF", "TEXT_PAREN_ADJACENT", "TEXT_NUMBER_WORD",
           "TEXT_ARGUMENT_REQUEST", "TEXT_FORBIDDEN_TERM", "TEXT_DRAWING_REQUEST", "TEXT_NIQQUD", "TEXT_NOT_HEBREW",
           "REF_UNDECLARED", "ATOM_ADJACENT", "ATOM_LEVELS_INVALID"}


def lint(text, grade=7, declared=("n1", "n2"), max_length=200):
    return tl.lint_model_text(text, grade=grade, declared=declared, forbidden_terms=TERMS, max_length=max_length)


def codes(text, **kwargs):
    return lint(text, **kwargs)[0]


def T(text):
    return {"kind": "text", "text": text}


def D(notation, symbols=()):
    return {"kind": "display", "notation": notation, "symbols": list(symbols)}


def sample_levels():
    """A v5-shaped middle levels.json (the strings §2.8 and §6.1 expect the adapter to emit)."""
    return [{
        "level": "רמה ב" + GERESH, "key": "b", "grade": "כיתה ז" + GERESH, "keep_questions": True,
        "figure_topic": [False, "הנושא אינו גיאומטריה; הוראת נועם אוסרת שרטוטים בנושא זה"],
        "title": "ביטויים אלגבריים: הצבה וכינוס איברים דומים",
        "rule": "כדי לכנס איברים דומים מחברים את המספרים שלפני המשתנה, למשל: $3x + 5x = 8x$.",
        "questions": [
            {"n": 1, "intro": "כנסו איברים דומים:", "star": False, "to_prove": [],
             "part": ["ביטויים אלגבריים", "1\u201320"],
             "items": [{"label": "א", "text": "$3x + 5 + 2x " + MINUS + " 1$", "space": 32,
                        "answer": "$5x + 4$", "given": ["$3x + 5 + 2x " + MINUS + " 1$"],
                        "to_prove": [{"type": "find", "quantity": "value", "what": "x", "value": "$5x + 4$"}]}]},
            {"n": 2, "intro": "חשבו את ערך הביטוי:", "star": False, "to_prove": [],
             "items": [{"label": "א", "text": "$4y " + MINUS + " y$ עבור $y = " + MINUS + "2$", "space": 32,
                        "answer": "$" + MINUS + "6$", "given": [], "to_prove": []}]},
            {"n": 3, "intro": "כתבו ביטוי אלגברי מתאים לכל תיאור:", "star": True, "to_prove": [],
             "items": [{"label": "א", "text": "מספר הגדול פי $4$ מ" + MAQAF + "$x$", "space": 46,
                        "answer": "$4x$", "given": [], "to_prove": []}]},
        ],
        "answers": [[1, [["א", "$5x + 4$"]], False], [2, [["א", "$" + MINUS + "6$"]], False],
                    [3, [["א", "$4x$"]], True]],
        "curriculum": {"topic": "algebraic_expressions", "track": "ז"},
    }]


class SharedPatternTests(unittest.TestCase):
    def test_control_and_markup_are_general_source_patterns(self):
        for name in ("CONTROL", "MARKUP", "HEBREW", "NIQQUD"):
            mine, theirs = getattr(tl, name), getattr(general_source, name)
            self.assertEqual((mine.pattern, mine.flags), (theirs.pattern, theirs.flags), name)

    def test_emitted_codes_are_registered(self):
        self.assertLessEqual(EMITTED, sc.CODES)

    def test_word_lists(self):
        self.assertEqual(tl.ARGUMENT_WORDS, ("הוכיחו", "הראו", "נמקו", "הסבירו", "מדוע", "למה", "בדקו", "שכנעו",
                                             "ודאו", "אמתו"))
        for word in ("אפס", "עשר", "עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים",
                     "מאה", "מאתיים", "אלף", "חצי", "שליש", "רבע", "תריסר", "פעמיים"):
            self.assertIn(word, tl.NUMBER_WORDS)
        self.assertFalse(set(tl.NUMBER_WORDS) & set(tl.WEAK_NUMBER_WORDS))
        self.assertEqual(len(tl.NUMBER_WORDS), len(set(tl.NUMBER_WORDS)))
        for word in tl.NUMBER_WORDS + tl.WEAK_NUMBER_WORDS:
            self.assertTrue(all("א" <= ch <= "ת" for ch in word), word)
        self.assertEqual(tl.REF.pattern, r"\{n([1-8])\}")


class ModelTextTests(unittest.TestCase):
    def test_clean_hebrew_with_references(self):
        text = "בחנות יש {n1} עפרונות ו" + MAQAF + "{n2} מחברות. כמה {n1} נשארו?"
        self.assertEqual(lint(text), ([], ("n1", "n2")))
        self.assertEqual(lint("כמה מחברות (כחולות) יש בחנות?"), ([], ()))
        self.assertEqual(lint(""), ([], ()))

    def test_digits_and_latin(self):
        for text in ("יש 5 עפרונות", "יש \u0663 עפרונות", "המשתנה x גדל", "ערך A", "מספר ABC", "שלב \u00b2"):
            self.assertIn("TEXT_CHAR", codes(text), text)

    def test_every_listed_symbol(self):
        for symbol in ("+", MINUS, "\u00d7", "\u00f7", "=", "<", ">", "%", "\u00b0", "\u00b2", "\u221a", "\u00b7",
                       "/", "*", "^", "$", "\\", "[", "]", "{", "}", "-"):
            self.assertIn("TEXT_CHAR", codes("כמה " + symbol + " עפרונות"), repr(symbol))
        for symbol in ("$", "\\", "<", ">"):
            self.assertIn("TEXT_MARKUP", codes("כמה " + symbol + " עפרונות"), repr(symbol))
        self.assertIn("TEXT_MARKUP", codes("ראו https: כאן"))

    def test_bidi_and_control_characters(self):
        for char in ["\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2066", "\u2067", "\u2068", "\u2069",
                     "\x00", "\x1f", "\x7f"]:
            found = codes("כמה" + char + "עפרונות")
            self.assertIn("TEXT_MARKUP", found, repr(char))
            self.assertIn("TEXT_CHAR", found, repr(char))
        self.assertEqual(codes("כמה\nעפרונות"), ["TEXT_CHAR"])
        self.assertEqual(codes("כמה" + NBSP + "עפרונות"), ["TEXT_CHAR"])

    def test_glued_reference(self):
        self.assertEqual(codes("כמה ב{n1}?"), ["TEXT_GLUED_REF"])
        self.assertEqual(codes("כמה ב" + MAQAF + "{n1}?"), [])
        self.assertEqual(codes("כמה {n1}ס" + GERSHAYIM + "מ?"), ["TEXT_GLUED_REF"])
        self.assertEqual(codes("כמה {n1} ס" + GERSHAYIM + "מ?"), [])
        self.assertIn("TEXT_GLUED_REF", codes("כמה ב\u05bc{n1}?"))
        self.assertEqual(codes("{n1} ו" + MAQAF + "{n2} הם נתונים"), [])

    def test_bracket_next_to_reference(self):
        for text in ("כמה ({n1}) עפרונות", "כמה ( {n1} ) עפרונות", "כמה ({n1} עפרונות)", "כמה (בערך {n1})"):
            self.assertIn("TEXT_PAREN_ADJACENT", codes(text), text)
        self.assertEqual(codes("כמה (בערך {n1} עפרונות) יש?"), [])

    def test_two_references_need_hebrew_between(self):
        for text in ("הנתונים {n1} {n2} בטבלה", "הנתונים {n1}, {n2} בטבלה", "הנתונים {n1}{n2} בטבלה"):
            self.assertIn("ATOM_ADJACENT", codes(text), text)
        self.assertEqual(codes("הנתונים {n1} ו" + MAQAF + "{n2} בטבלה"), [])

    def test_strong_and_weak_number_words(self):
        for word in tl.NUMBER_WORDS:
            self.assertEqual(codes("יש " + word + " עפרונות"), ["TEXT_NUMBER_WORD"], word)
        for text in ("יש ושלושה עפרונות", "בעשרים דקות", "לשתי בנות", "מחמש עד", "השבעה הלכו", "כשלושים איש",
                     "שני שלישים מהכיתה"):
            self.assertIn("TEXT_NUMBER_WORD", codes(text), text)
        for text in ("לפחות אחד מהם", "ביום שני", "אחת מהן", "לפני שנים רבות", "בשנייה הבאה",
                     "משתנה ומשולש", "השבוע", "החציון", "מספר עשרוני", "השלימו את הטבלה", "המרובע", "פעם אחת"):
            self.assertEqual(codes(text), [], text)

    def test_argument_words(self):
        for word in tl.ARGUMENT_WORDS:
            self.assertEqual(codes(word + " את התשובה"), ["TEXT_ARGUMENT_REQUEST"], word)
            self.assertEqual(codes("ו" + word + " את התשובה"), ["TEXT_ARGUMENT_REQUEST"], word)
        self.assertIn("TEXT_ARGUMENT_REQUEST", codes("הו\u05b9כ\u05b4יחו\u05bc זאת", grade=7))
        for text in ("יחידה שלמה", "המלמד", "הבדיקות", "מבדקי"):
            self.assertEqual(codes(text), [], text)

    def test_forbidden_terms(self):
        for text in ("חוק הפילוג", "לפי חוק" + MAQAF + "הפילוג", "בעזרת פילוג", "זהות", "זהויות רבות", "פתרו את המשוואה",
                     "משוואות", "במשוואת", "חזקה", "בחזקות", "שוויון", "אי" + MAQAF + "שוויון", "שוויונות"):
            self.assertEqual(codes(text), ["TEXT_FORBIDDEN_TERM"], text)
        for text in ("זהו המספר", "חזק מאוד", "משווה בין", "פילוסופיה"):
            self.assertEqual(codes(text), [], text)
        self.assertTrue(tl.forbidden_term_hits("המשוואה", ["משוואה"]))
        self.assertFalse(tl.forbidden_term_hits("המשוואה", []))
        self.assertEqual(lint("משוואה", declared=())[0], ["TEXT_FORBIDDEN_TERM"])

    def test_drawing_request(self):
        for text in ("ציירו מלבן", "שרטטו את הגרף", "היעזרו בשרטוט", "השלימו איור"):
            self.assertEqual(codes(text), ["TEXT_DRAWING_REQUEST"], text)
        self.assertTrue(general_source.DRAWING_REQUEST.search("ציירו מלבן"))

    def test_niqqud_policy(self):
        self.assertEqual(codes("ש\u05b8\u05c1לו\u05b9ם ר\u05b7ב", grade=7), ["TEXT_NIQQUD"])
        self.assertEqual(codes("ש\u05b8\u05c1לו\u05b9ם ר\u05b7ב", grade=3), ["TEXT_NIQQUD"])
        self.assertEqual(codes("שלום רב", grade=2), ["TEXT_NIQQUD"])
        self.assertEqual(codes("ש\u05b8\u05c1לו\u05b9ם ר\u05b7ב", grade=2), [])
        self.assertEqual(codes("ש\u05b8\u05c1לו\u05b9ם ר\u05b7ב", grade=1), [])

    def test_text_without_hebrew(self):
        for text in ("...", "   ", "{n1}", "({n1})"):
            self.assertIn("TEXT_NOT_HEBREW", codes(text), text)

    def test_length(self):
        self.assertEqual(codes("א" * 200), [])
        self.assertEqual(codes("א" * 201), ["TEXT_LENGTH"])
        self.assertEqual(codes("אב" * 20, max_length=40), [])
        self.assertEqual(codes("אב" * 21, max_length=40), ["TEXT_LENGTH"])

    def test_references_returned_and_declared(self):
        self.assertEqual(lint("כמה {n3} יש?"), (["REF_UNDECLARED"], ("n3",)))
        self.assertEqual(lint("כמה {n2} ו" + MAQAF + "{n1} ו" + MAQAF + "{n2}?"), ([], ("n2", "n1")))
        self.assertEqual(lint("כמה {n1} יש?", declared=()), (["REF_UNDECLARED"], ("n1",)))
        for text in ("כמה {n9} יש?", "כמה {N1} יש?", "כמה {n1 } יש?", "כמה {n0} יש?"):
            self.assertEqual(lint(text), (["TEXT_CHAR"], ()), text)

    def test_bad_inputs(self):
        self.assertEqual(lint(5), (["TEXT_CHAR"], ()))
        self.assertEqual(lint(None), (["TEXT_CHAR"], ()))
        with self.assertRaises(ValueError):
            tl.lint_model_text("שלום", grade="7", declared=(), forbidden_terms=(), max_length=10)
        with self.assertRaises(ValueError):
            tl.lint_model_text("שלום", grade=7, declared=(), forbidden_terms=(), max_length=None)

    def test_codes_are_sorted_unique_and_registered(self):
        found, refs = lint("פתרו 5 משוואות ({n1}) ב{n3}, הוכיחו שלושה")
        self.assertEqual(found, sorted(set(found)))
        self.assertEqual(set(found), {"TEXT_CHAR", "TEXT_FORBIDDEN_TERM", "TEXT_PAREN_ADJACENT", "TEXT_GLUED_REF",
                                      "REF_UNDECLARED", "TEXT_ARGUMENT_REQUEST", "TEXT_NUMBER_WORD"})
        self.assertEqual(refs, ("n1", "n3"))
        self.assertLessEqual(set(found), sc.CODES)


class IrTextTests(unittest.TestCase):
    def test_code_written_strings_pass(self):
        for text in ("כנסו איברים דומים:", ".", ": ", "(", " עבור ", " ו" + MAQAF, "כיתה ז" + GERESH,
                     NBSP + "ס" + GERSHAYIM + "מ", "שאלה \u2013 חלק"):
            self.assertEqual(tl.check_ir_text(text), [], repr(text))

    def test_refused_strings(self):
        self.assertEqual(tl.check_ir_text(""), ["TEXT_NOT_HEBREW"])
        self.assertEqual(tl.check_ir_text("   "), ["TEXT_NOT_HEBREW"])
        self.assertEqual(tl.check_ir_text("5"), ["TEXT_CHAR", "TEXT_NOT_HEBREW"])
        self.assertEqual(tl.check_ir_text("מספר 5"), ["TEXT_CHAR"])
        self.assertEqual(tl.check_ir_text("x"), ["TEXT_CHAR", "TEXT_NOT_HEBREW"])
        self.assertEqual(tl.check_ir_text("עבור $"), ["TEXT_CHAR", "TEXT_MARKUP"])
        self.assertEqual(tl.check_ir_text("עבור {n1}"), ["TEXT_CHAR"])
        self.assertEqual(tl.check_ir_text("מספר - אחר"), ["TEXT_CHAR"])
        self.assertEqual(tl.check_ir_text("עבור\u202e"), ["TEXT_CHAR", "TEXT_MARKUP"])
        self.assertEqual(tl.check_ir_text(7), ["TEXT_CHAR"])

    def test_atom_rule_on_design_layouts(self):
        layouts = [
            [D("3x+5+2x-1", "x")],
            [D("4y-y", "y"), T(" עבור "), D("y=-2", "y")],
            [D("2x+y", "xy"), T(" עבור "), D("x=1", "x"), T(" ו" + MAQAF), D("y=3", "y")],
            [T("מספר הגדול פי "), D("4"), T(" מ" + MAQAF), D("x", "x")],
            [T("כינוס הביטוי "), D("4a+3+a+2", "a"), T(" נתן "), D("10a", "a")],
            [T("ביטוי אלגברי, למשל: "), D("3x+5x=8x", "x"), T(".")],
        ]
        for spans in layouts:
            self.assertEqual(tl.check_ir_spans(spans), [], spans)

    def test_atom_rule_refusals(self):
        self.assertEqual(tl.check_ir_spans([D("x"), D("y")]), ["ATOM_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([D("x"), T(", "), D("y")]), ["ATOM_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([D("x"), T(" "), T(". "), D("y")]), ["ATOM_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([D("x"), {"kind": "math", "expression": {}}]), ["ATOM_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([T("מספר ("), D("x")]), ["TEXT_PAREN_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([D("x"), T(") נוסף")]), ["TEXT_PAREN_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([D("x"), T(" (הערה)")]), ["TEXT_PAREN_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([T("מספר )"), D("x")]), ["TEXT_PAREN_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([T("מספר (בערך) הוא "), D("x"), T(" ועוד")]), [])
        self.assertEqual(tl.check_ir_spans([T("("), D("x"), D("y")]), ["ATOM_ADJACENT", "TEXT_PAREN_ADJACENT"])
        self.assertEqual(tl.check_ir_spans([]), [])
        with self.assertRaises(TypeError):
            tl.check_ir_spans("x")

    def test_every_code_written_overlay_string(self):
        for ov in sc.OVERLAYS.values():
            for path, text in sc.code_strings(ov):
                self.assertEqual(tl.check_ir_text(text), [], path)
                self.assertFalse(tl.forbidden_term_hits(text, ov["forbiddenTerms"]), path)
                self.assertIsNone(tl._ARGUMENT.search(text), path)
                self.assertIsNone(general_source.DRAWING_REQUEST.search(text), path)
            rule = sc.rule_spans(ov)
            self.assertEqual(tl.check_ir_spans(rule), [])
            for span in rule:
                if span["kind"] == "text":
                    self.assertEqual(tl.check_ir_text(span["text"]), [])
            for template in ov["templates"].values():
                spans = [T(value) if part == "T" else D(value) for part, value in template["layout"]]
                self.assertEqual(tl.check_ir_spans(spans), [], template["shape"])
            for kind, layout in ov["layouts"].items():
                spans = [T(value) if part == "T" else D(value) for part, value in layout]
                if kind == "substitute":
                    spans += [T(ov["valueSeparator"]), D("value")]
                self.assertEqual(tl.check_ir_spans(spans), [], kind)
        for line in sc.GRADE_LINE.values():
            self.assertEqual(tl.check_ir_text(line), [])


class LevelsLintTests(unittest.TestCase):
    def test_clean_levels(self):
        self.assertEqual(tl.lint_levels(sample_levels()), [])

    def test_broken_strings(self):
        cases = [
            (("questions", 0, "items", 0, "answer"), "% 30", ("/0/questions/0/items/0/answer", "TEXT_CHAR")),
            (("questions", 0, "items", 0, "answer"), "$30$ %", ("/0/questions/0/items/0/answer", "TEXT_CHAR")),
            (("questions", 1, "items", 0, "text"), "$4y$ $y = 2$",
             ("/0/questions/1/items/0/text", "ATOM_ADJACENT")),
            (("questions", 1, "items", 0, "text"), "$x$, $y$", ("/0/questions/1/items/0/text", "ATOM_ADJACENT")),
            (("rule",), "למשל: $3x + 5x", ("/0/rule", "ATOM_LEVELS_INVALID")),
            (("title",), "כותרת $$ ריקה", ("/0/title", "ATOM_LEVELS_INVALID")),
            (("questions", 2, "intro"), "כתבו\u2067 ביטוי", ("/0/questions/2/intro", "TEXT_MARKUP")),
            (("questions", 2, "items", 0, "text"), "מספר ($4$) מ" + MAQAF + "$x$",
             ("/0/questions/2/items/0/text", "TEXT_PAREN_ADJACENT")),
            (("questions", 0, "intro"), "כנסו 3 איברים", ("/0/questions/0/intro", "TEXT_CHAR")),
            (("questions", 0, "intro"), "כנסו x איברים", ("/0/questions/0/intro", "TEXT_CHAR")),
            (("questions", 0, "intro"), "כנסו - איברים", ("/0/questions/0/intro", "TEXT_CHAR")),
            (("questions", 0, "intro"), 5, ("/0/questions/0/intro", "ATOM_LEVELS_INVALID")),
            (("answers", 1, 1, 0, 1), "תשובה: 6", ("/0/answers/1/1/0/1", "TEXT_CHAR")),
        ]
        for path, value, expected in cases:
            levels = sample_levels()
            target = levels[0]
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            self.assertEqual(tl.lint_levels(levels), [expected], value)

    def test_islands_may_hold_house_notation(self):
        self.assertEqual(tl.lint_string("$30\\%$ מהכיתה"), [])
        self.assertEqual(tl.lint_string("$\\f{2}{5}$ מהכיתה"), [])
        self.assertEqual(tl.lint_string("$x = 20\\%$"), [])

    def test_malformed_structure(self):
        self.assertEqual(tl.lint_levels([]), [("", "ATOM_LEVELS_INVALID")])
        self.assertEqual(tl.lint_levels({"title": "x"}), [("", "ATOM_LEVELS_INVALID")])
        self.assertEqual(tl.lint_levels(["x"]), [("/0", "ATOM_LEVELS_INVALID")])
        levels = sample_levels()
        del levels[0]["title"]
        self.assertEqual(tl.lint_levels(levels), [("/0/title", "ATOM_LEVELS_INVALID")])
        levels = sample_levels()
        levels[0]["questions"][0]["items"] = "x"
        self.assertEqual(tl.lint_levels(levels), [("/0/questions/0", "ATOM_LEVELS_INVALID")])
        levels = sample_levels()
        levels[0]["answers"][0] = [1, "x"]
        self.assertEqual(tl.lint_levels(levels), [("/0/answers/0", "ATOM_LEVELS_INVALID")])
        levels = sample_levels()
        levels[0]["answers"][0][1][0] = ["א"]
        self.assertEqual(tl.lint_levels(levels), [("/0/answers/0/1/0", "ATOM_LEVELS_INVALID")])

    def test_unprinted_fields_are_not_linted(self):
        levels = sample_levels()
        levels[0]["grade"] = "7"
        levels[0]["curriculum"]["topic"] = "algebraic_expressions"
        levels[0]["questions"][0]["items"][0]["to_prove"][0]["what"] = "x + 1"
        self.assertEqual(tl.lint_levels(levels), [])

    def test_cli(self):
        with tempfile.TemporaryDirectory() as work:
            clean, broken, invalid, duplicate = (Path(work) / name for name in
                                                 ("clean.json", "broken.json", "invalid.json", "dup.json"))
            clean.write_text(json.dumps(sample_levels(), ensure_ascii=False), encoding="utf-8")
            levels = sample_levels()
            levels[0]["questions"][0]["items"][0]["answer"] = "$30$ %"
            broken.write_text(json.dumps(levels, ensure_ascii=False), encoding="utf-8")
            invalid.write_text("[{", encoding="utf-8")
            duplicate.write_text('[{"title": "א", "title": "ב"}]', encoding="utf-8")
            out = io.StringIO()
            self.assertEqual(tl.main(["--levels", str(clean)], output=out), 0)
            self.assertEqual(out.getvalue(), "levels-lint: PASS (0 findings)\n")
            out = io.StringIO()
            self.assertEqual(tl.main(["--levels", str(broken)], output=out), 1)
            self.assertEqual(out.getvalue().splitlines(),
                             ["TEXT_CHAR\t/0/questions/0/items/0/answer", "levels-lint: FAIL (1 findings)"])
            for path in (invalid, duplicate, Path(work) / "missing.json"):
                out = io.StringIO()
                self.assertEqual(tl.main(["--levels", str(path)], output=out), 1)
                self.assertTrue(out.getvalue().startswith("ATOM_LEVELS_INVALID\t\n"))
            env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "TMPDIR", "LANG", "LC_ALL")}
            env["PYTHONDONTWRITEBYTECODE"] = "1"
            for path, code in ((clean, 0), (broken, 1)):
                done = subprocess.run([sys.executable, "-B", str(APP / "text_lint.py"), "--levels", str(path)],
                                      cwd=work, env=env, capture_output=True, text=True, timeout=60)
                self.assertEqual(done.returncode, code, done.stderr)


if __name__ == "__main__":
    unittest.main()
