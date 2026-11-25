"""worksheet-wire/5 for g9r:probability on the middle render path: the atom-order fraction mode (stacked fractions,
composite fraction islands, decimals, table cells) against real WeasyPrint RTL pages, the levels lint of table
cells, the middle adapter's table and fraction keys, the runner's --fractions flag, the real offline render through
the pinned build, and the container context of the new module."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
from test_v5_g9r_probability import compile_good, lesson, load, scope  # noqa: E402

import atom_order  # noqa: E402
from atom_order import AtomOrderError, check_atom_order, expected_atoms_fractions, island_segments  # noqa: E402
from general_source import V5_CONTRACT  # noqa: E402
import runner  # noqa: E402
import text_lint  # noqa: E402

G9R = S.FIXTURES / "g9r_probability"
CONTAINER = S.APP / "cloud/container"
RENDER = S.APP / "cloud/render"
PINNED = S.MIDDLE_PINNED
WEASY = S.weasyprint_available()
STYLE = ("@page{size:A4;margin:2cm} body{direction:rtl;font-family:'Arial Hebrew','Noto Sans Hebrew','DejaVu Sans',"
         "sans-serif;font-size:14pt;line-height:1.9} .m{direction:ltr;unicode-bidi:embed;white-space:nowrap} "
         ".m .op1{margin:0 .13em} .m .op2{margin:0 .22em} .qnum{direction:ltr} "
         ".frac{display:inline-block;vertical-align:middle;text-align:center;margin:0 .16em;line-height:1.06;"
         "position:relative;top:-0.06em} .frac .fnu,.frac .fde{display:block;padding:0 .22em;font-size:.94em} "
         ".frac .fbar{display:block;height:1.25px;background:currentColor;font-size:0;line-height:0} "
         "table{border-collapse:collapse} td,th{border:1px solid #444;padding:3pt 9pt}")


def skill_tree_state(root):
    root = Path(root)
    return sorted((str(p.relative_to(root)), p.stat().st_mtime_ns, hashlib.sha256(p.read_bytes()).hexdigest()
                   if p.is_file() else "") for p in root.rglob("*"))


def frac(top, bottom):
    """The pinned emitter's markup of \\f{top}{bottom} (emit_html m_body)."""
    return ('<span class="frac"><span class="fnu">%s</span><span class="fbar"></span><span class="fde">%s</span>'
            '</span>' % (top, bottom))


def island(*parts):
    return '<span class="m">%s</span>' % "".join(parts)


def page(question_rows, answer_rows):
    body = "".join("<p>%s</p>" % row for row in question_rows)
    body += '<div class="ansband">תשובות סופיות</div>' + "".join("<p>%s</p>" % row for row in answer_rows)
    return '<html dir="rtl" lang="he"><head><meta charset="utf-8"><style>%s</style></head><body>%s</body></html>' % (
        STYLE, body)


def levels(texts, answers, table=None):
    question = {"n": 1, "intro": "חשבו:", "items": [{"text": text} for text in texts]}
    if table is not None:
        question["table"] = table
    return [{"title": "כותרת", "rule": "", "questions": [question],
             "answers": [[1, [["א", answer] for answer in answers]]]}]


# ------------------------------------------------------------------ the fraction mode, parsing

class FractionSegments(unittest.TestCase):
    def test_island_segments(self):
        cases = {"\\f{3}{10}": (("frac", "3", "10"),),
                 "1 − \\f{3}{10} = \\f{7}{10}": (("flat", "1−"), ("frac", "3", "10"), ("flat", "="),
                                                 ("frac", "7", "10")),
                 "0.35": (("flat", "0.35"),), "28\\%": (("flat", "28%"),), "12": (("flat", "12"),),
                 "\\f{49}{100}": (("frac", "49", "100"),), "x = \\f{1}{2}": (("flat", "x="), ("frac", "1", "2"))}
        for text, segments in cases.items():
            self.assertEqual(island_segments(text), segments, text)
        for text in ("\\f{\\f{1}{2}}{3}", "x^{2}", "\\g{x}", "3.", ".5", "\\d{1}{2}", "1.2.3", "3°", "x_1", "\\f{1}"):
            with self.subTest(text=text), self.assertRaises(AtomOrderError) as caught:
                island_segments(text)
            self.assertEqual(caught.exception.code, "ATOM_NOT_FLAT")
        for text in ("\\f{1}{", "  ", "\\f{}{2}"):
            with self.subTest(text=text), self.assertRaises(AtomOrderError) as caught:
                island_segments(text)
            self.assertEqual(caught.exception.code, "ATOM_LEVELS_INVALID")

    def test_the_flat_mode_is_unchanged(self):
        for text in ("\\f{1}{2}", "0.35"):
            with self.assertRaises(AtomOrderError) as caught:
                atom_order.island_glyphs(text)
            self.assertEqual(caught.exception.code, "ATOM_NOT_FLAT")
        sample = S.load("levels-g7-sample.json")
        questions, answers = atom_order.expected_atoms(sample)
        flat_q, flat_a, shapes_q, shapes_a = expected_atoms_fractions(sample)
        self.assertEqual((flat_q, flat_a, shapes_q, shapes_a), (questions, answers, {}, {}))

    def test_expected_atoms_read_table_cells_and_fraction_keys(self):
        table = {"head": ["צבע", "אדום", "כחול"], "rows": [["מספר הפעמים", "$12$", "$18$"]], "hcol": True}
        flat_q, flat_a, shapes_q, shapes_a = expected_atoms_fractions(levels(["מהי השכיחות?"],
                                                                            ["$\\f{2}{5}$", "$0.4$", "$40\\%$"],
                                                                            table))
        self.assertEqual((flat_q["12"], flat_q["18"], flat_q["(1)"]), (1, 1, 1))
        self.assertEqual(dict(shapes_a), {(("frac", "2", "5"),): 1})
        self.assertEqual((flat_a["0.4"], flat_a["40%"], flat_a["(1)"]), (1, 1, 1))
        self.assertEqual(shapes_q, {})
        with self.assertRaises(AtomOrderError) as caught:
            expected_atoms_fractions(levels(["x"], ["$1$"], {"head": [], "rows": "x"}))
        self.assertEqual(caught.exception.code, "ATOM_LEVELS_INVALID")

    def test_decimal_runs_join_only_between_digits(self):
        row = [("0", 0, 6, 12), (".", 6, 9, 12), ("3", 9, 15, 12), ("5", 15, 21, 12), (".", 22, 25, 12),
               ("א", 30, 40, 12), ("7", 50, 56, 12)]
        self.assertEqual([run[0] for run in atom_order._positioned_runs(row)], ["0.35", "7"])
        self.assertEqual(atom_order._runs(row), ["0", "35", "7"])              # the flat mode breaks at a '.'


# ------------------------------------------------------------------ the fraction mode on real WeasyPrint pages

@unittest.skipUnless(WEASY, "WeasyPrint or PyMuPDF unavailable")
class FractionPdf(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def write(self, html, data):
        import weasyprint
        pdf, path = self.dir / "sheet.pdf", self.dir / "levels.json"
        weasyprint.HTML(string=html).write_pdf(str(pdf))
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path, pdf

    def good(self):
        rule = ('<span class="qnum">(1)</span> למשל ' + island('1 <span class="op1">−</span> ', frac("3", "10"),
                                                             ' <span class="op2">=</span> ', frac("7", "10"))
                + ". ועוד מספר " + island("12") + " בטבלה.")
        answers = ['<span class="qnum">(1)</span> א. ' + island(frac("2", "5")) + " ב. " + island("0.35")
                   + " ג. " + island("40%") + " ד. " + island(frac("49", "100"))]
        texts = ["למשל $1 − \\f{3}{10} = \\f{7}{10}$. ועוד מספר $12$ בטבלה."]
        keys = ["$\\f{2}{5}$", "$0.35$", "$40\\%$", "$\\f{49}{100}$"]
        return [rule], answers, texts, keys

    def test_stacked_fractions_composites_and_decimals_pass(self):
        questions, answers, texts, keys = self.good()
        path, pdf = self.write(page(questions, answers), levels(texts, keys))
        report = check_atom_order(path, pdf, fractions=True)
        self.assertEqual((report["status"], report["fractions"]), ("PASS", 3))
        self.assertEqual(report["atoms"], 2 + 1 + 1 + 4)                 # (1) twice, 12, the composite, four keys
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(path, pdf)                                   # without the flag: not flat, as before
        self.assertEqual(caught.exception.code, "ATOM_NOT_FLAT")

    def test_a_composite_out_of_order_is_missing(self):
        questions, answers, texts, keys = self.good()
        questions = ['<span class="qnum">(1)</span> למשל ' + island(frac("7", "10"), ' <span class="op2">=</span> ',
                                                                   frac("3", "10"), ' <span class="op1">−</span> 1')
                     + ". ועוד מספר " + island("12") + " בטבלה."]
        path, pdf = self.write(page(questions, answers), levels(texts, keys))
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(path, pdf, fractions=True)
        self.assertEqual(caught.exception.code, "ATOM_MISSING")
        self.assertIn(("questions", "1−[3/10]=[7/10]"), caught.exception.missing)

    def test_a_flat_fraction_or_a_split_percent_is_missing(self):
        questions, answers, texts, keys = self.good()
        answers = ['<span class="qnum">(1)</span> א. ' + island("2/5") + " ב. " + island("0.35") + " ג. "
                   + island("40") + " % ד. " + island(frac("100", "49"))]
        path, pdf = self.write(page(questions, answers), levels(texts, keys))
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(path, pdf, fractions=True)
        self.assertEqual(caught.exception.code, "ATOM_MISSING")
        self.assertEqual(sorted(caught.exception.missing),
                         [("answers", "40%"), ("answers", "[2/5]"), ("answers", "[49/100]")])

    def test_a_decimal_split_around_its_point_is_missing(self):
        questions, answers, texts, keys = self.good()
        answers = ['<span class="qnum">(1)</span> א. ' + island(frac("2", "5")) + " ב. " + island("0") + "."
                   + island("35") + " ג. " + island("40%") + " ד. " + island(frac("49", "100"))]
        path, pdf = self.write(page(questions, answers), levels(texts, keys))
        with self.assertRaises(AtomOrderError) as caught:
            check_atom_order(path, pdf, fractions=True)
        self.assertEqual(caught.exception.missing, [("answers", "0.35")])

    def test_the_cli_flag(self):
        questions, answers, texts, keys = self.good()
        path, pdf = self.write(page(questions, answers), levels(texts, keys))
        out = self.dir / "atom-order.json"
        for argv, code, status in (([], 1, "FAIL"), (["--fractions"], 0, "PASS")):
            import subprocess
            done = subprocess.run([sys.executable, "-B", str(S.APP / "atom_order.py"), "--levels", str(path), "--pdf",
                                   str(pdf), "--json", str(out)] + argv, capture_output=True, text=True, timeout=120)
            self.assertEqual(done.returncode, code, done.stdout + done.stderr)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["status"], status)


# ------------------------------------------------------------------ the levels lint of table cells

class LevelsLintTables(unittest.TestCase):
    @staticmethod
    def sheet(table):
        found = levels(["מהי השכיחות היחסית?"], ["$\\f{2}{5}$"], table)
        found[0]["questions"][0]["items"][0]["answer"] = "$\\f{2}{5}$"
        return found

    def test_table_cells_are_printed_strings(self):
        table = {"head": ["צבע", "אדום"], "rows": [["מספר הפעמים", "$12$"]], "hcol": True}
        self.assertEqual(text_lint.lint_levels(self.sheet(table)), [])
        bad = {"head": ["צבע", "אדום"], "rows": [["מספר הפעמים", "12"]], "hcol": True}
        self.assertEqual(text_lint.lint_levels(self.sheet(bad)), [("/0/questions/0/table/rows/0/1", "TEXT_CHAR")])
        self.assertEqual(text_lint.lint_levels(self.sheet({"head": [], "rows": "x"})),
                         [("/0/questions/0/table", "ATOM_LEVELS_INVALID")])
        self.assertEqual(text_lint.lint_levels(self.sheet({"head": ["$1$ $2$"], "rows": []})),
                         [("/0/questions/0/table/head/0", "ATOM_ADJACENT")])


# ------------------------------------------------------------------ the middle adapter

@unittest.skipUnless(PINNED, "Pinned middle skill unavailable")
class MiddleAdapter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import general_adapters
        cls.tmp = tempfile.TemporaryDirectory()
        cls.work = Path(cls.tmp.name) / "work"
        cls.before = skill_tree_state(S.MIDDLE)
        cls.ir = compile_good().ir
        general_adapters.compile_source(lesson(), {"source": cls.ir}, scope(), str(S.MIDDLE), cls.work,
                                        contract=V5_CONTRACT)
        cls.levels = json.loads((cls.work / "levels.json").read_text(encoding="utf-8"))
        cls.level = cls.levels[0]

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_grade_line_rule_and_no_figure(self):
        self.assertEqual(self.level["grade"], "כיתה ט׳")
        self.assertEqual(self.level["key"], "c")
        self.assertIn("למשל $1 − \\f{3}{10} = \\f{7}{10}$. בניסוי", self.level["rule"])
        self.assertEqual(self.level["figure_topic"][0], False)
        self.assertFalse(any("fig" in question for question in self.level["questions"]))
        self.assertEqual(skill_tree_state(S.MIDDLE), self.before)
        self.assertEqual((self.work / "content.py").read_text(encoding="utf-8").splitlines()[-1],
                         'PACKAGE = "G9-T90"')

    def test_the_one_way_table_and_the_story_atoms(self):
        q6 = self.level["questions"][5]
        self.assertEqual(q6["table"], {"head": ["צבע", "אדום", "כחול", "צהוב", "ירוק"],
                                       "rows": [["מספר הפעמים", "$12$", "$18$", "$6$", "$14$"]], "hcol": True})
        self.assertEqual(self.level["questions"][0]["intro"],
                         "בשקית יש $3$ כדורים אדומים, $5$ כדורים כחולים ו־$2$ כדורים ירוקים. מוציאים מהשקית כדור "
                         "באקראי.")
        self.assertEqual(q6["items"][2]["text"],
                         "העריכו לפי הטבלה את ההסתברות שבסיבוב הבא ייעצר החץ על הצבע ירוק. כתבו את התשובה באחוזים.")
        self.assertEqual(sum("table" in question for question in self.level["questions"]), 4)

    def test_keys_print_as_fraction_decimal_and_percent_islands(self):
        answers = {row[0]: [pair[1] for pair in row[1]] for row in self.level["answers"]}
        self.assertEqual(answers[1], ["$\\f{3}{10}$", "$\\f{1}{2}$", "$\\f{7}{10}$"])
        self.assertEqual(answers[6], ["$0.24$", "$\\f{9}{25}$", "$28\\%$"])
        self.assertEqual(answers[20], ["$\\f{31}{55}$", "$\\f{27}{55}$", "$\\f{24}{55}$"])
        for question in self.level["questions"]:
            for entry in question["items"]:
                self.assertEqual(entry["given"], [entry["text"]])
                self.assertEqual(entry["to_prove"][0]["value"], entry["answer"])
        self.assertEqual(text_lint.lint_levels(self.levels), [])
        flat_q, flat_a, shapes_q, shapes_a = expected_atoms_fractions(self.levels)
        self.assertEqual(sum(shapes_a.values()) + sum(shapes_q.values()), 59)  # 58 fraction keys and the rule box


# ------------------------------------------------------------------ the runner flag

class RunnerFractionsFlag(unittest.TestCase):
    def run_job(self, payload, the_lesson):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        work, skill, calls = Path(tmp.name) / "job", Path(tmp.name) / "skill", []
        skill.mkdir()
        key = {"a": "a", "b": "b", "e": "c"}[the_lesson["level"]]

        def execute(args, **kwargs):
            calls.append((Path(args[2]).name, [str(arg) for arg in args[3:]]))
            if Path(args[2]).name == "build_v72.py":
                path = work / ("out/deliver/%s/sheet.pdf" % key)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"%PDF stub")
                shutil.copyfile(S.FIXTURES / "v72-report-legacy-pass.json", work / "out/v72-report.json")
            return SimpleNamespace(stdout="", stderr="", returncode=0)
        with patch.object(runner, "validate_model", return_value={"skill": "middle", "family": "general"}), \
                patch.object(runner, "verify_skill", return_value=(skill, {"version": "7.2.0-noam", "sha256": "a" * 64})), \
                patch.object(runner.subprocess, "run", side_effect=execute):
            manifest = runner.render_job(the_lesson, payload, work, skill_paths={"middle": skill},
                                         contract="worksheet-wire/5")
        return manifest, calls

    def test_only_the_probability_overlay_runs_the_fraction_mode(self):
        payload = {"version": 4, "contract": "worksheet-wire/5"}
        manifest, calls = self.run_job(payload, lesson())
        atom = [args for script, args in calls if script == "atom_order.py"]
        self.assertEqual(len(atom), 1)
        self.assertEqual(atom[0][-1], "--fractions")
        self.assertEqual(manifest["status"], "needs_review")
        self.assertIs(manifest["overlayReviewed"], False)
        self.assertEqual(manifest["artifacts"][0]["path"], "out/deliver/c/sheet.pdf")
        manifest, calls = self.run_job(payload, S.lesson())                     # the g7 overlay
        atom = [args for script, args in calls if script == "atom_order.py"]
        self.assertNotIn("--fractions", atom[0])


# ------------------------------------------------------------------ the real render

@unittest.skipUnless(PINNED and WEASY and shutil.which("python3"), "Pinned middle skill or WeasyPrint unavailable")
class OfflineRender(unittest.TestCase):
    def test_reply_good_renders_with_every_executed_check_passing(self):
        import v5_offline_render
        before = skill_tree_state(S.MIDDLE)
        with tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR") or None) as tmp:
            work, out = Path(tmp) / "work", Path(tmp) / "out"
            summary = v5_offline_render.run(G9R / "lesson.json", G9R / "reply_good.json", out, work_dir=work,
                                            skill_path=str(S.MIDDLE), case="g9r_good")
            report = json.loads((out / "g9r_good/report.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["status"], "needs_review", summary)
            self.assertEqual(report["exitCode"], 0)
            self.assertEqual(set(report["notRun"]), runner.V5_NOT_RUN_ALLOWED)
            self.assertFalse(report["verdict"]["automatedChecksPassed"])      # notRun and an unreviewed overlay
            failed = [step for step in report["steps"] if step["status"] not in ("PASS", "SKIP")]
            self.assertEqual(failed, [])
            self.assertTrue(report["pdfProducer"].startswith("WeasyPrint"))
            self.assertEqual(report["atomOrder"]["status"], "PASS")
            self.assertEqual(report["atomOrder"]["fractions"], 59)
            self.assertEqual(report["selection"]["delivered"], 20)
            self.assertEqual(report["pages"], ["page-%d.png" % n for n in range(1, report["pdf"]["pages"] + 1)])
            argv = json.loads((work / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(argv["steps"][-1]["name"], "atom-order")
            self.assertIn("PASS", (work / "out/logs/check_didactic.py.log").read_text(encoding="utf-8"))
            self.assertRegex((work / "out/logs/check_didactic.py.log").read_text(encoding="utf-8"),
                             r"PASS \d+  FAIL 0  REVIEW 0")
            build = (work / "out/logs/build_plus.log").read_text(encoding="utf-8")
            self.assertIn("G84-chronology c    PASS (track=ט_רגילה, topic=probability, 0 premature terms)", build)
            self.assertIn("GATES: all pass", build)
            self.assertIn("levels-lint: PASS (0 findings)", (work / "logs/levels-lint.txt").read_text(encoding="utf-8"))
        self.assertEqual(skill_tree_state(S.MIDDLE), before)


# ------------------------------------------------------------------ the container context

class ContainerContext(unittest.TestCase):
    def test_the_new_module_is_in_the_exact_docker_context(self):
        files = set(json.loads((CONTAINER / "context-files.json").read_text())["files"])
        path = "tools/teacher-generation/probability_kinds.py"
        self.assertIn(path, files)
        for rules in (CONTAINER / "Dockerfile.dockerignore", RENDER / "Dockerfile.dockerignore"):
            self.assertIn("!" + path, rules.read_text().splitlines())


if __name__ == "__main__":
    unittest.main()
