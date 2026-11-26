"""Benign readings of the words the pinned truth gates G32 and G33 search for."""
import copy
import importlib.util
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import claim_words
import runner
from claim_words import claim_lint, claims, scan

# Wording of real Qwen replies (grade 3 division, grade 4 order of operations)
# that the pinned gates failed on 2026-11-23.
BENIGN = {
    "המורה חילקה 24 מחברות ל- 4 תלמידים שווה בשווה, ואז נתנה לכל אחד מהם עוד 2 מחברות.": [("לכל", "per_unit")],
    "התאימו לכל ביטוי את התוצאה שלו על ידי הצבה בחישוב מדורג:": [("לכל", "instruction")],
    "אבא חילק מטבעות לשלושה כיסים שווים, ואז הוסיף 2 מטבעות לכל כיס.": [("לכל", "per_unit")],
    "התאימו לכל תרגיל כפל את תרגיל החילוק המתאים לו.": [("לכל", "instruction")],
    "כמה עפרונות יש לכל תלמיד בסוף?": [("לכל", "per_unit")],
    "כמה ממתקים לכל ילד בסוף?": [("לכל", "per_unit")],
    "אילו המורה הייתה מחלקת את העפרונות לאחר הוספת 3 עפרונות לכל תלמיד, מה היה הביטוי?":
        [("לכל", "per_unit"), ("אילו", "conditional")],
    "אילו הייתה הזמנה של 2 מנות ראשונות, מה הייתה העלות?": [("אילו", "conditional")],
    # Further closed patterns.
    "חילקו 30 סוכריות לכל הילדים בכיתה.": [("לכל", "per_unit")],
    "נתנו לכל אחת 3 בלונים ולכל ילד כובע.": [("לכל", "per_unit"), ("לכל", "per_unit")],
    "התאימו את התוצאה המתאימה לכל תרגיל.": [("לכל", "instruction")],
    "לכל קבוצה 6 ילדים.": [("לכל", "per_unit")],
    "אילו דני היה קונה 3 עטים, כמה היה משלם?": [("אילו", "conditional")],
    "זה נראה כאילו המספר גדל.": [("אילו", "as_if")],
}
CLAIMS = {
    "מכפלה תמיד גדולה מכל אחד מהגורמים.": [("G32", "תמיד")],
    "לכל מספר זוגי יש מחלק 2.": [("G32", "לכל")],
    "הוכיחו שלכל תלמיד יש מספר שונה.": [("G32", "לכל")],
    "הסבירו מדוע לכל משולש יש שלוש זוויות.": [("G32", "לכל"), ("G32", "כל משולש")],
    "לכל אחד מהמספרים הבאים יש שארית 1.": [("G32", "לכל")],
    "לכל קבוצה של שלושה מספרים עוקבים הסכום מתחלק ב- 3.": [("G32", "לכל")],
    "לכל זוג מספרים הסכום זוגי.": [("G32", "לכל")],
    "לכל ביטוי יש ערך אחד.": [("G32", "לכל")],
    "כתבו: לכל מספר יש עוקב.": [("G32", "לכל")],
    "נכון לכל x.": [("G32", "לכל")],
    "אי אפשר לחלק 7 ל- 2 בלי שארית.": [("G32", "אי אפשר")],
    "אילו מהמספרים הבאים זוגיים?": [("G33", "אילו")],
    "אילו תרגילים יש בהם המרה באחדות?": [("G33", "אילו")],
    "אילו היו התוצאות?": [("G33", "אילו")],
    "אילו מהם היה נכון?": [("G33", "אילו")],
    "האם ייתכן שהמנה גדולה מהמחולק?": [("G33", "האם ייתכן")],
    "מצאו את כל האפשרויות.": [("G33", "מצאו את כל"), ("G33", "כל האפשרויות")],
}


class ReadingTests(unittest.TestCase):
    def test_per_unit_instruction_and_conditional_readings_are_benign(self):
        for text, expected in BENIGN.items():
            with self.subTest(text=text[:30]):
                self.assertEqual([(row["word"], row["reading"]) for row in scan(text)], expected)
                self.assertEqual(claims(text), [])

    def test_universal_claims_denials_and_enumerations_stay_claims(self):
        for text, expected in CLAIMS.items():
            with self.subTest(text=text[:30]):
                self.assertEqual([(row["gate"], row["word"]) for row in claims(text)], expected)

    def test_one_claim_keeps_the_question_a_claim_and_no_word_means_nothing(self):
        mixed = "נתנו לכל ילד 3 בלונים. הסבירו מדוע התוצאה תמיד זוגית."
        self.assertEqual(claims(mixed), [{"gate": "G32", "word": "תמיד"}])
        self.assertEqual(scan("חשבו: 24 : 6 + 9"), [])
        # A vocalized or attached form is not on the gate's list, so it is not ours to read.
        self.assertEqual(scan("לְכָל תלמיד"), [])

    def test_source_question_lint_reads_text_spans_only(self):
        text = lambda value: {"kind": "text", "text": value}
        number = {"kind": "math", "expression": {"type": "number", "numerator": 3, "denominator": 1}}
        question = {"intro": [text("חלקו שווה בשווה.")], "star": False, "items": [
            {"prompt": [text("כמה עפרונות יש לכל תלמיד אם יש "), number, text(" קלמרים?")], "answer": {}},
            {"prompt": [text("הסבירו מדוע המנה תמיד קטנה מהמחולק.")], "answer": {}}],
            "table": {"head": [[text("תרגיל")], [text("תוצאה")]], "rows": [[[text("אילו מהם זוגיים?")], [number]]]}}
        self.assertEqual(claim_lint(question), [{"gate": "G32", "word": "תמיד"}, {"gate": "G33", "word": "אילו"}])
        del question["items"][1], question["table"]
        self.assertEqual(claim_lint(question), [])
        self.assertEqual(claim_lint(None), [])
        self.assertEqual(claim_lint({"intro": "לכל מספר זוגי יש מחלק 2.", "items": []}), [{"gate": "G32", "word": "לכל"}])


class PinnedSkillTests(unittest.TestCase):
    """The same readings against the pinned gate itself, installed from the bundle."""

    @classmethod
    def setUpClass(cls):
        from cloud.container.skill_bundle import install
        temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(temp.cleanup)
        cls.root = Path(temp.name)
        install(HERE / "cloud/container/skills", cls.root / "skills", HERE / "skill-lock.json")
        cls.skill = cls.root / "skills/elementary"
        spec = importlib.util.spec_from_file_location("pinned_content_truth", cls.skill / "scripts/lib/content_truth.py")
        cls.truth = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.truth)
        fixture = HERE / "cloud/container/fixtures/general/grade4-skill-calculation"
        cls.lesson = json.loads((fixture / "lesson.json").read_text())
        cls.model = json.loads((fixture / "model-output.json").read_text())

    def test_pinned_word_lists_are_the_gates_own(self):
        self.assertEqual(claim_words.GATE_WORDS["G32"], self.truth.UNIVERSAL + self.truth.DENIAL)
        self.assertEqual(claim_words.GATE_WORDS["G33"], self.truth.ENUMERATE)

    def gate(self, questions):
        ledger = self.truth.Ledger(str(self.root / "unused.json"))
        ledger.claim("5", "בדיקת הנתונים בשרטוט המודפס", (1 + 1 == 2, 2), method="figure_assert")
        labelled = [("content.json.questions#" + q["n"], q) for q in questions]
        fails = self.truth.Fail()
        ids = [entry["id"] for entry in ledger.entries]
        self.truth.g32_universal_claims(labelled, ids, fails)
        self.truth.g33_enumeration(labelled, ids, fails)
        return [line.split("  ")[0] + line.split("#")[1].split("]")[0] for line in fails], ledger

    def test_pinned_gates_fail_every_listed_word_without_a_ledger_entry(self):
        questions = [
            {"n": "1", "intro": "כמה עפרונות יש לכל תלמיד בסוף?", "items": ["(20 : 4) + 3"], "answer": "א. 8"},
            {"n": "2", "intro": "מכפלה תמיד גדולה מכל אחד מהגורמים.", "items": ["3 x 4"], "answer": "א. 12"},
            {"n": "3", "intro": "אילו הייתה הזמנה של 2 מנות, מה הייתה העלות?", "items": ["2 x 10"], "answer": "א. 20"},
            {"n": "4", "intro": "נתנו לכל ילד בלון.", "items": ["אילו מהתרגילים הבאים נכונים?"], "answer": "א. 4"},
            {"n": "5", "intro": "לכל מספר זוגי יש מחלק 2.", "items": ["4 : 2"], "answer": "א. 2"},
            {"n": "6", "intro": "חשבו.", "items": ["24 : 6 + 9"], "answer": "א. 13"},
            {"n": "7", "intro": "לכל מספר זוגי יש מחלק 2.", "items": ["6 : 2"], "answer": "א. 3"},
        ]
        failed, ledger = self.gate(questions)
        # The locked gates refuse the benign readings too (D19): the per-unit "לכל" of 1 and the conditional
        # "אילו" of 3 fail like the claims of 2, 4 and 7. 4 fails both gates. Only 5, which holds a
        # measured-figure entry under its own number, passes; nothing else is in the ledger.
        self.assertEqual(failed, ["G321", "G322", "G324", "G327", "G333", "G334"])
        self.assertEqual([e["id"] for e in ledger.entries], ["5"])

    def precheck(self, extra, name, *, ninth_as_seventh=False):
        model = copy.deepcopy(self.model)
        model["sections"][0]["questions"][3]["intro"][-1]["text"] += extra
        if ninth_as_seventh:
            # Question 9 refers to its table, and the trusted adapter refuses to print its typed task after it.
            # A copy of question 7 in its place lets the gates see the whole sheet.
            model["sections"][0]["questions"][8] = copy.deepcopy(model["sections"][0]["questions"][6])
        work = self.root / "runs" / name
        return runner.precheck_job(self.lesson, model, work, {"elementary": str(self.skill)}), work

    def test_real_prepass_names_the_question_of_every_gate_word(self):
        # The fixture prints its three challenges with a star, and the pinned G61 proxy weighs that star: the
        # difficulty spread of the sheet as printed is 5 > 4 (Q41=2 against Q102=7), so G61 names questions 4 and
        # 10 in every case but "always", whose "תמיד" also lifts question 4. The truth step fails question 4 in
        # every case: the locked G32 / G33 refuse a per-unit "לכל" and a conditional "אילו" as they refuse a claim.
        spread = [("G61", 4, "editorial"), ("G61", 10, "editorial")]
        cases = {"benign": (" תנו לכל תלמיד בקבוצה סעיף אחד.", [("G32", 4, "truth")] + spread, ["PASS", "FAIL", "FAIL"]),
                 "if": (" אילו המורה הייתה מוסיפה עוד מחברת, התוצאה הייתה גדלה.", [("G33", 4, "truth")] + spread,
                        ["PASS", "FAIL", "FAIL"]),
                 "always": (" זכרו: מכפלה תמיד גדולה מכל אחד מהגורמים.", [("G32", 4, "truth")], ["PASS", "FAIL", "PASS"]),
                 "every": (" לכל מספר זוגי יש מחלק 2.", [("G32", 4, "truth")] + spread, ["PASS", "FAIL", "FAIL"])}
        # "Which" asked in the intro is a question that no number of the items answers: the reply is refused
        # when it is read (PRINTED_ANSWER_KIND), before the trusted adapter or any gate, also with question 7 in
        # place of question 9.
        from validation import GenerationError
        for ninth_as_seventh in (False, True):
            with self.subTest(name="which", ninth_as_seventh=ninth_as_seventh), \
                    self.assertRaises(GenerationError) as refused:
                self.precheck(" אילו מהתרגילים קלים?", "which" + ("" if ninth_as_seventh else "-recorded"),
                              ninth_as_seventh=ninth_as_seventh)
            self.assertEqual(refused.exception.code, "PRINTED_ANSWER_KIND")
            work = self.root / "runs" / ("which" + ("" if ninth_as_seventh else "-recorded"))
            self.assertFalse((work / "content.json").exists() or (work / "verified.json").exists())
        for name, (extra, blocking, statuses) in cases.items():
            with self.subTest(name=name):
                # As recorded, the pre-pass stops at the trusted adapter: question 9 refers to its table, and its
                # typed task is never printed after such a prompt. No gate runs and nothing is built.
                result, work = self.precheck(extra, name + "-recorded")
                self.assertEqual(result["status"], "replace")
                self.assertEqual([(b["code"], b["question"], b["class"]) for b in result["gate"]["blocking"]],
                                 [("TRUSTED_ADAPTER", 9, "truth")])
                self.assertEqual([(step["name"], step["status"]) for step in result["steps"]], [("trusted-adapter", "FAIL")])
                self.assertFalse((work / "content.json").exists() or (work / "verified.json").exists())
                # With question 7 in place of question 9 the gates see the whole sheet.
                result, work = self.precheck(extra, name, ninth_as_seventh=True)
                self.assertEqual(result["status"], "replace")
                self.assertEqual([(b["code"], b["question"], b["class"]) for b in result["gate"]["blocking"]], blocking)
                self.assertEqual(result["gate"]["review"], [])
                self.assertEqual([(step["name"], step["status"]) for step in result["steps"]],
                                 list(zip(["trusted-adapter", "content-truth", "house-gates"], statuses)))
                self.assertFalse((work / "sheet.pdf").exists() or (work / "sheet.docx").exists())
                claims = json.loads((work / "verified.json").read_text())["claims"]
                # The compiler never writes a ledger entry under a bare question number, except a measured figure:
                # that is the id the locked gates accept for the whole question.
                self.assertEqual([c["id"] for c in claims if c["id"] == "4"], [])
                self.assertEqual([c for c in claims if str(c["id"]).isdigit() and c["method"] != "figure_assert"], [])

    def test_adapter_refusal_inside_the_compiler_names_the_question_and_item(self):
        # A binder that only the trusted adapter runs refuses the second item of question 3.
        script = (
            "import json, sys\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "sys.path.insert(0, sys.argv[1])\n"
            "import general_adapters as adapters\n"
            "from general_source import GeneralSourceError, validate_source\n"
            "from runtime_catalog import scope_for_lesson\n"
            "lesson = json.loads(Path(sys.argv[2]).read_text()); model = json.loads(Path(sys.argv[3]).read_text())\n"
            "scope = scope_for_lesson(lesson); seen = []\n"
            "def refuse(question, item, computed, grade):\n"
            "    seen.append(item)\n"
            "    if len(seen) == int(sys.argv[6]):\n"
            "        raise GeneralSourceError('PRINTED_TASK_MISMATCH', 'The exact answer disagrees with the printed task')\n"
            "with patch.object(adapters, 'bind_parts', side_effect=refuse):\n"
            "    try:\n"
            "        adapters.compile_source(lesson, validate_source(lesson, model, scope), scope, sys.argv[4], sys.argv[5])\n"
            "    except GeneralSourceError as error:\n"
            "        print(json.dumps({'code': error.code, 'question': error.question, 'item': error.item}))\n"
        )
        import subprocess
        fixture = HERE / "cloud/container/fixtures/general/grade4-skill-calculation"
        sizes = [len(q["items"]) for q in self.model["sections"][0]["questions"]]
        call = sizes[0] + sizes[1] + 2
        done = subprocess.run([sys.executable, "-B", "-c", script, str(HERE), str(fixture / "lesson.json"),
                               str(fixture / "model-output.json"), str(self.skill), str(self.root / "runs/refusal"), str(call)],
                              capture_output=True, text=True, timeout=120)
        self.assertEqual(json.loads(done.stdout), {"code": "PRINTED_TASK_MISMATCH", "question": 3, "item": 2}, done.stderr)
        # The same fields are what the adapter process leaves in its failure record.
        from skill_feedback import parse_adapter
        rows, complete = parse_adapter("general_source.GeneralSourceError: The exact answer disagrees with the printed task\n",
                                       record=json.loads(done.stdout))
        self.assertEqual(rows, [{"code": "TRUSTED_ADAPTER", "class": "truth", "step": "trusted-adapter", "question": 3, "item": 2,
                                 "evidence": {"error": "GeneralSourceError", "refusal": "PRINTED_TASK_MISMATCH"}}])
        self.assertTrue(complete)

    def test_gate_content_carries_the_printed_stars(self):
        # As recorded, the trusted adapter refuses question 9 (its typed task after a prompt about the table) and
        # nothing is built.
        result, work = self.precheck("", "schema-recorded")
        self.assertEqual((result["status"], [(b["code"], b["question"], b["item"]) for b in result["gate"]["blocking"]]),
                         ("replace", [("TRUSTED_ADAPTER", 9, 1)]))
        self.assertFalse((work / "content.json").exists() or (work / "sheet.html").exists())
        result, work = self.precheck("", "schema", ninth_as_seventh=True)
        # The star the page prints is the star the pinned G61 proxy weighs: both ends of the spread are named.
        self.assertEqual(result["status"], "replace")
        self.assertEqual([(b["code"], b["question"], b["item"]) for b in result["gate"]["blocking"]], [("G61", 4, 1), ("G61", 10, 2)])
        self.assertEqual(result["gate"]["review"], [])
        content = json.loads((work / "content.json").read_text())
        keys = {key for question in content["questions"] for key in question}
        self.assertEqual(keys, {"n", "intro", "items", "answer", "star"})
        stars = [question["star"] for question in content["questions"]]
        self.assertEqual(stars, [False] * 9 + [True] * 3)
        page = (work / "sheet.html").read_text()
        self.assertEqual([marked == ' class="starred"' for marked in re.findall(r'<li( class="starred")?>', page)], stars)
        self.assertEqual(page.count('class="starred"'), 3)
        # The pinned difficulty proxy adds two points to every item of a starred question, and to nothing else.
        spec = importlib.util.spec_from_file_location("pinned_content_quality", self.skill / "scripts/lib/content_quality.py")
        quality = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(quality)
        profile = quality.profile_of(content)
        stripped = copy.deepcopy(content)
        for question in stripped["questions"]:
            del question["star"]
        plain = [quality.difficulty(r, profile) for r in quality.normalize(stripped)]
        starred = [quality.difficulty(r, profile) for r in quality.normalize(content)]
        challenge_items = sum(len(q["items"]) for q in content["questions"][-3:])
        self.assertEqual((len(plain), challenge_items), (36, 9))
        self.assertEqual([b - a for a, b in zip(plain, starred)], [0] * (len(plain) - challenge_items) + [2] * challenge_items)
        self.assertEqual([r["starred"] for r in quality.normalize(content)], [False] * (len(plain) - challenge_items) + [True] * challenge_items)
        self.assertEqual(quality.g61_level_consistency(quality.normalize(content), profile),
                         (quality.FAIL, "פער קושי 5 > 4 — הדף מערבב רמות (Q41=2 מול Q102=7)"))


if __name__ == "__main__":
    unittest.main()
