"""worksheet-wire/5 on the elementary path (ד10): the elementary adapter branch, the WeasyPrint-only PDF wrapper,
the elementary atom-order mode, the runner's elementary v5 path (stubbed and real), the offline render, and the
container context of the new modules."""
import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
from test_v5_d10_elementary import compile_good, lesson, load, overlay, scope  # noqa: E402

import atom_order  # noqa: E402
import division_kinds as dk  # noqa: E402
from general_source import GeneralSourceError, V5_CONTRACT  # noqa: E402
import runner  # noqa: E402
from validation import GenerationError  # noqa: E402

TRUSTED = "worksheet-wire/5"
CONTAINER = S.APP / "cloud/container"
RENDER = S.APP / "cloud/render"
PINNED = S.ELEMENTARY_PINNED
WEASY = S.weasyprint_available()


def compile_adapter(work, ir=None):
    import general_adapters
    ir = ir if ir is not None else compile_good().ir
    return general_adapters.compile_source(lesson(), {"source": ir}, scope(), str(S.ELEMENTARY), work,
                                           contract=V5_CONTRACT)


def skill_tree_state(root):
    root = Path(root)
    return sorted((str(p.relative_to(root)), p.stat().st_mtime_ns, hashlib.sha256(p.read_bytes()).hexdigest()
                   if p.is_file() else "") for p in root.rglob("*"))


# ------------------------------------------------------------------ the adapter branch

@unittest.skipUnless(PINNED, "Pinned elementary skill unavailable")
class ElementaryAdapter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.work = Path(cls.tmp.name) / "work"
        cls.before = skill_tree_state(S.ELEMENTARY)
        cls.result = compile_adapter(cls.work)
        cls.html = (cls.work / "sheet.html").read_text(encoding="utf-8")
        cls.content = json.loads((cls.work / "content.json").read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_outputs_pdf_inputs_only(self):
        self.assertEqual(self.result["skill"], "elementary")
        names = sorted(p.name for p in self.work.iterdir())
        self.assertEqual(names, ["content.json", "figures", "general-evidence.json", "general-source.json",
                                 "sheet.html", "verified.json", "worksheet-source.json"])
        self.assertEqual(list((self.work / "figures").iterdir()), [])
        self.assertNotIn("<svg", self.html)
        self.assertNotIn("<img", self.html)
        self.assertEqual(skill_tree_state(S.ELEMENTARY), self.before)        # nothing written into the skill

    def test_every_number_and_expression_is_one_ltr_atom(self):
        body = self.html.split("<body", 1)[1]
        self.assertIn('<span class="ltr">347 : 5 = <span class="blank" style="min-width:2.6cm"></span></span>', body)
        self.assertIn('בחנות יש <span class="ltr">158</span> עפרונות. אורזים אותם בקופסאות, '
                      '<span class="ltr">6</span> עפרונות בכל קופסה.', body)
        self.assertIn('בכל סירה יש מקום ל־<span class="ltr">4</span> ילדים.', body)
        # The rule's example: every number its own atom, the quotient right before the remainder word.
        self.assertIn('למשל, כשמחלקים <span class="ltr">125</span> ב־<span class="ltr">4</span> מקבלים '
                      '<span class="ltr">31</span> שארית <span class="ltr">1</span>.', body)
        self.assertNotIn('<span class="ltr">125 : 4 = 31</span>', body)
        # Outside an LTR atom no digit is printed (labels, Hebrew and punctuation only), and no forbidden sign.
        outside = re.sub(r'<span class="ltr">.*?</span>(?:</span>)?', " ", body)
        outside = re.sub(r"<[^>]+>", " ", outside)
        self.assertIsNone(re.search(r"[0-9]", outside))
        for sign in ("÷", "/", "·", "*", "-"):
            atoms = re.findall(r'<span class="ltr">([^<]*)', body)
            self.assertFalse([atom for atom in atoms if sign in atom], sign)
        self.assertNotIn(":", "".join(re.findall(r"[^\s>]*:(?=\s*<span class=\"ltr\">)", outside)))

    def test_answer_key_markers_and_house_form(self):
        answers = self.html.split('<div class="answers">', 1)[1]
        self.assertEqual(re.findall(r'<td class="qn"><span class="ltr">\((\d+)\)</span></td>', answers),
                         [str(n) for n in range(1, 13)])
        self.assertNotRegex(answers, r'<td class="qn"><span class="ltr">\d+\.</span>')
        self.assertIn('א. <span class="answer-text" dir="rtl"><span class="ltr">69</span> שארית '
                      '<span class="ltr">2</span></span> ; ב. <span class="ltr">27</span> ; ג. '
                      '<span class="answer-text" dir="rtl"><span class="ltr">84</span> שארית '
                      '<span class="ltr">5</span></span>', answers)

    def test_content_json_for_the_pinned_gates(self):
        expected = load("expected.json")
        meta = self.content["meta"]
        self.assertEqual(meta, {"band": "elementary", "grade": "ד", "level": "א", "topic": "חילוק ארוך ושארית",
                                "topic_id": "ד10", "domain": "operations"})
        questions = self.content["questions"]
        self.assertEqual([q["n"] for q in questions], [str(n) for n in range(1, 13)])
        self.assertEqual([q["star"] for q in questions], [False] * 9 + [True] * 3)
        self.assertEqual(questions[0]["items"], ["347 : 5 =", "216 : 8 =", "593 : 7 ="])
        self.assertEqual(questions[1]["intro"], "בחנות יש 158 עפרונות. אורזים אותם בקופסאות, 6 עפרונות בכל קופסה.")
        self.assertEqual(questions[1]["items"], list(overlay()["stories"]["S_PENCILS"]["asks"].values()))
        slots = ["Q%d" % n for n in range(1, 13)]
        self.assertEqual([q["answer"] for q in questions], [expected["keyLines"][slot] for slot in slots])
        ir = compile_good().ir
        for question, printed in zip(ir["sections"][0]["questions"], questions):
            self.assertEqual(printed["items"], [dk.content_item_text(item, "ד") for item in question["items"]])

    def test_ledger_claims_every_printed_answer(self):
        claims = json.loads((self.work / "verified.json").read_text(encoding="utf-8"))["claims"]
        self.assertEqual(len(claims), 36)
        self.assertEqual({claim["method"] for claim in claims}, {"closed_form"})
        first = claims[0]
        self.assertEqual((first["id"], first["evidence"]), ("1.1", {"dividend": 347, "divisor": 5, "quotient": 69,
                                                                     "remainder": 2}))
        source = json.loads((self.work / "worksheet-source.json").read_text(encoding="utf-8"))
        self.assertEqual(source["meta"]["contract"], V5_CONTRACT)
        self.assertEqual(source["questions"][0]["items"][1]["answer"], "27")
        self.assertEqual(source["questions"][0]["items"][0]["answer"], "69 שארית 2")

    def test_the_pinned_clone_mirror_runs_in_the_final_adapter_check(self):
        import structured_source as ss
        from test_v5_d10_elementary import context, rows
        ir = compile_good().ir
        wire = {"slot": "Q2", "kind": "division_remainder_drill", "intro": "", "givens": [],
                "table": {"head": [], "rows": []},
                "items": [{"text": "", "expr": e, "expr2": "", "values": "", "ask": "", "form": "", "variant": ""}
                          for e in ("418:3", "682:9", "731:4")]}
        drill = ss.compile_question(wire, rows()["Q2"], context()).ir
        ir["sections"][0]["questions"][1] = drill                  # validate_source accepts it (no G62 there)
        from general_source import validate_source
        validate_source(lesson(), copy.deepcopy(ir), scope(), contract=V5_CONTRACT)
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(GeneralSourceError) as caught:
            compile_adapter(Path(tmp) / "w", ir)
        self.assertEqual(caught.exception.code, "SOURCE_STRUCTURE")

    def test_the_v4_elementary_adapter_still_prints_dot_markers(self):
        import general_adapters
        from test_general_source import fixture
        v4_lesson, payload = fixture("ד11", 4)
        with tempfile.TemporaryDirectory() as tmp:
            general_adapters.compile_source(v4_lesson, {"source": payload}, scope(v4_lesson), str(S.ELEMENTARY),
                                            Path(tmp))
            html = (Path(tmp) / "sheet.html").read_text(encoding="utf-8")
        self.assertIn('<td class="qn"><span class="ltr">1.</span></td>', html)
        self.assertNotIn('<td class="qn"><span class="ltr">(1)</span></td>', html)


# ------------------------------------------------------------------ the WeasyPrint-only wrapper

@unittest.skipUnless(PINNED and WEASY, "Pinned elementary skill or WeasyPrint unavailable")
class WeasyPrintOnly(unittest.TestCase):
    HTML = ('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head><body>'
            '<p>חילוק: <span style="direction:ltr">125 : 4 = 31</span></p></body></html>')

    def setUp(self):
        import pdf_weasyprint_only
        self.module = pdf_weasyprint_only
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.html = Path(self.tmp.name) / "sheet.html"
        self.html.write_text(self.HTML, encoding="utf-8")
        self.pdf = Path(self.tmp.name) / "sheet.pdf"

    def test_builds_with_weasyprint_and_writes_nothing_into_the_skill(self):
        before = skill_tree_state(S.ELEMENTARY)
        env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "TMPDIR", "DYLD_FALLBACK_LIBRARY_PATH")}
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        done = subprocess.run([sys.executable, "-B", str(S.APP / "pdf_weasyprint_only.py"), "--skill",
                               str(S.ELEMENTARY), "--html", str(self.html), "--pdf", str(self.pdf)],
                              capture_output=True, text=True, timeout=240, env=env)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("pdf-weasyprint-only: PASS producer=WeasyPrint", done.stdout)
        self.assertTrue(self.module.producer(self.pdf).startswith("WeasyPrint"))
        self.assertTrue((self.html.parent / "DavidLibre-Regular.ttf").is_file())      # the pinned ensure_fonts
        self.assertEqual(skill_tree_state(S.ELEMENTARY), before)

    def test_a_weasyprint_failure_never_falls_back(self):
        real = self.module.pinned_build_pdf(S.ELEMENTARY)
        fake = SimpleNamespace(ensure_fonts=real.ensure_fonts, build_with_weasyprint=lambda html, pdf: False,
                               build_with_chromium=lambda html, pdf: self.fail("Chromium must never run"))
        with patch.object(self.module, "pinned_build_pdf", return_value=fake), \
                self.assertRaises(self.module.WeasyPrintOnlyError) as caught:
            self.module.build(S.ELEMENTARY, self.html, self.pdf)
        self.assertEqual(caught.exception.code, "WEASYPRINT_FAILED")
        self.assertFalse(self.pdf.exists())
        printed = io.StringIO()
        with patch.object(self.module, "pinned_build_pdf", return_value=fake), contextlib.redirect_stdout(printed):
            self.assertEqual(self.module.main(["--skill", str(S.ELEMENTARY), "--html", str(self.html), "--pdf",
                                               str(self.pdf)]), 1)
        self.assertEqual(printed.getvalue(), "pdf-weasyprint-only: FAIL WEASYPRINT_FAILED\n")

    def test_a_pdf_from_another_producer_is_refused_and_removed(self):
        import pymupdf

        def other(html, pdf):
            document = pymupdf.open()
            document.new_page().insert_text((72, 72), "x")
            document.save(str(pdf))
            return True

        real = self.module.pinned_build_pdf(S.ELEMENTARY)
        fake = SimpleNamespace(ensure_fonts=real.ensure_fonts, build_with_weasyprint=other)
        with patch.object(self.module, "pinned_build_pdf", return_value=fake), \
                self.assertRaises(self.module.WeasyPrintOnlyError) as caught:
            self.module.build(S.ELEMENTARY, self.html, self.pdf)
        self.assertEqual(caught.exception.code, "PDF_PRODUCER_NOT_WEASYPRINT")
        self.assertFalse(self.pdf.exists())

    def test_a_skill_that_differs_from_the_lock_is_refused(self):
        fake = Path(self.tmp.name) / "skill"
        (fake / "scripts").mkdir(parents=True)
        (fake / "scripts/build_pdf.py").write_text("def build_with_weasyprint(h, p):\n    return True\n")
        with self.assertRaises(self.module.WeasyPrintOnlyError) as caught:
            self.module.build(fake, self.html, self.pdf)
        self.assertEqual(caught.exception.code, "SKILL_HASH_MISMATCH")


# ------------------------------------------------------------------ the elementary atom-order mode

class ElementaryAtomOrder(unittest.TestCase):
    PAGE = ('<html><head><meta charset="utf-8"><style>.ltr{direction:ltr}</style></head><body>'
            '<div class="reminder">למשל, <span class="ltr">125 : 4 = 31</span> שארית <span class="ltr">1</span>.</div>'
            '<ol class="questions"><li>פתרו. <table><tr><td><b>א.</b> <span class="ltr">347 : 5 = '
            '<span class="blank"></span></span></td></tr></table></li>'
            '<li class="starred"><span class="star"></span> בחנות יש <span class="ltr">158</span> עפרונות.</li></ol>'
            '<div class="answers"><h2>תשובות סופיות</h2><table class="ans">'
            '<tr><td class="qn"><span class="ltr">(1)</span></td><td>א. <span class="answer-text" dir="rtl">'
            '<span class="ltr">69</span> שארית <span class="ltr">2</span></span></td></tr>'
            '<tr><td class="qn"><span class="ltr">(2)</span></td><td>א. <span class="ltr">26</span></td></tr>'
            '</table></div></body></html>')

    def test_expected_atoms_from_the_html(self):
        questions, answers, heading = atom_order.expected_atoms_html(self.PAGE)
        self.assertEqual(dict(questions), {"125:4=31": 1, "1": 1, "347:5=": 1, "158": 1, "(1)": 1, "(2)": 1})
        self.assertEqual(dict(answers), {"(1)": 1, "69": 1, "2": 1, "(2)": 1, "26": 1})
        self.assertEqual(heading, "תשובותסופיות")

    def test_unflat_and_invalid_pages(self):
        with self.assertRaises(atom_order.AtomOrderError) as caught:
            atom_order.expected_atoms_html(self.PAGE.replace("158", "1,158"))
        self.assertEqual(caught.exception.code, "ATOM_NOT_FLAT")
        for page in (self.PAGE.split('<div class="answers">')[0] + "</body></html>", "<p>שלום</p>", 7):
            with self.assertRaises(atom_order.AtomOrderError) as caught:
                atom_order.expected_atoms_html(page)
            self.assertEqual(caught.exception.code, "ATOM_LEVELS_INVALID")

    @unittest.skipUnless(WEASY, "WeasyPrint unavailable")
    def test_real_rendering(self):
        import weasyprint
        style = ('<style>@page{size:A4;margin:2cm}body{direction:rtl;font-size:14pt}'
                 '.ltr{direction:ltr;white-space:nowrap}ol.questions{list-style:none}'
                 'ol.questions>li::before{content:"(" counter(list-item) ") ";direction:ltr}</style>')
        page = self.PAGE.replace("<style>.ltr{direction:ltr}</style>", style)
        with tempfile.TemporaryDirectory() as tmp:
            html, pdf = Path(tmp) / "sheet.html", Path(tmp) / "sheet.pdf"
            html.write_text(page, encoding="utf-8")
            weasyprint.HTML(str(html)).write_pdf(str(pdf))
            report = atom_order.check_atom_order_html(html, pdf)
            self.assertEqual(report["status"], "PASS")
            self.assertTrue(report["producer"].startswith("WeasyPrint"))
            # An atom printed right-to-left ("= 5 : 347") is no LTR run of its glyphs: reported missing.
            broken = page.replace('<span class="ltr">347 : 5 = ', '<span class="ltr" style="direction:rtl">347 : 5 = ')
            html.write_text(broken, encoding="utf-8")
            weasyprint.HTML(str(html)).write_pdf(str(pdf))
            html.write_text(page, encoding="utf-8")
            with self.assertRaises(atom_order.AtomOrderError) as caught:
                atom_order.check_atom_order_html(html, pdf)
            self.assertEqual(caught.exception.code, "ATOM_MISSING")
            self.assertIn(("questions", "347:5="), caught.exception.missing)
            # A PDF from another producer.
            import pymupdf
            document = pymupdf.open()
            document.new_page().insert_text((72, 72), "x")
            document.save(str(pdf))
            with self.assertRaises(atom_order.AtomOrderError) as caught:
                atom_order.check_atom_order_html(html, pdf)
            self.assertEqual(caught.exception.code, "PDF_PRODUCER_NOT_WEASYPRINT")

    def test_the_middle_mode_is_unchanged(self):
        self.assertEqual(atom_order.ATOM_CHARS, frozenset("0123456789abcdefghijklmnopqrstuvwxyz"
                                                          "ABCDEFGHIJKLMNOPQRSTUVWXYZ+−=()%·"))
        self.assertNotIn(":", atom_order.ATOM_CHARS)
        self.assertEqual(atom_order.ELEMENTARY_ATOM_CHARS - atom_order.ATOM_CHARS, {":", "×"})


# ------------------------------------------------------------------ the runner's elementary v5 path (stubbed)

class RunnerElementaryV5(unittest.TestCase):
    CAP = {"skill": "elementary", "family": "general"}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name) / "job"
        self.skill = Path(self.tmp.name) / "skill"
        self.skill.mkdir()
        self.calls = []

    def render(self, fail=(), pdf=True, cap=None):
        def execute(args, **kwargs):
            script = Path(args[2]).name
            self.calls.append((script, [str(arg) for arg in args[3:]]))
            if script == "pdf_weasyprint_only.py" and pdf:
                (self.work / "sheet.pdf").write_bytes(b"%PDF stub")
            return SimpleNamespace(stdout="", stderr="", returncode=1 if script in fail else 0)
        with patch.object(runner, "validate_model", return_value=cap or self.CAP), \
                patch.object(runner, "verify_skill", return_value=(self.skill, {"version": "1.0.5-noam",
                                                                                "sha256": "b" * 64})), \
                patch.object(runner.subprocess, "run", side_effect=execute):
            return runner.render_job(lesson(), {"version": 4, "contract": V5_CONTRACT}, self.work,
                                     skill_paths={"elementary": self.skill}, contract=TRUSTED)

    def test_steps_artifacts_and_no_word(self):
        manifest = self.render()
        self.assertEqual([script for script, _ in self.calls],
                         ["general_adapters.py", "content_truth.py", "pdf_weasyprint_only.py", "check_worksheet.py",
                          "output_gates.py", "house_gates.py", "atom_order.py"])
        argv = dict(self.calls)
        self.assertEqual(argv["general_adapters.py"][-2:], ["--contract", TRUSTED])
        self.assertIn("--paren-markers", argv["output_gates.py"])
        self.assertIn("--general", argv["output_gates.py"])
        self.assertEqual(argv["house_gates.py"][argv["house_gates.py"].index("--grade") + 1], "ד")
        self.assertEqual(argv["house_gates.py"][argv["house_gates.py"].index("--level") + 1], "א")
        self.assertNotIn("--docx", argv["house_gates.py"])
        self.assertEqual(argv["atom_order.py"][0], "--html")
        self.assertEqual(argv["check_worksheet.py"][-2:], ["--band", "elementary"])
        for word in ("build_docx.py", "docx_layout.py", "build_pdf.py", "build_v72.py", "didactic_review.py"):
            self.assertNotIn(word, argv)
        self.assertEqual(manifest["status"], "needs_review")
        self.assertIs(manifest["executedChecksPassed"], True)
        self.assertIs(manifest["automatedChecksPassed"], False)          # the overlay is not reviewed (D7)
        self.assertEqual(manifest["notRun"], [])
        self.assertEqual(manifest["overlayPendingReview"], list(overlay()["pendingReview"]))
        self.assertEqual([(a["path"], a["kind"]) for a in manifest["artifacts"]], [("sheet.pdf", "pdf")])
        self.assertEqual(manifest["authorContract"], V5_CONTRACT)
        self.assertEqual(manifest["pdfBuilderSha256"],
                         hashlib.sha256((S.APP / "pdf_weasyprint_only.py").read_bytes()).hexdigest())

    def test_any_failed_step_fails_the_job(self):
        for script in ("content_truth.py", "pdf_weasyprint_only.py", "check_worksheet.py", "output_gates.py",
                       "house_gates.py", "atom_order.py"):
            with self.subTest(script=script):
                shutil.rmtree(self.work, ignore_errors=True)
                self.calls = []
                manifest = self.render(fail=(script,))
                self.assertEqual(manifest["status"], "failed")
                self.assertEqual(manifest["artifacts"], [])
                self.assertEqual(len(self.calls), 7)                  # every gate still runs
        shutil.rmtree(self.work, ignore_errors=True)
        self.calls = []
        manifest = self.render(fail=("general_adapters.py",))
        self.assertEqual([script for script, _ in self.calls], ["general_adapters.py"])
        self.assertEqual(manifest["status"], "failed")
        shutil.rmtree(self.work, ignore_errors=True)
        manifest = self.render(pdf=False)
        self.assertEqual(manifest["status"], "failed")

    def test_the_overlay_skill_must_match(self):
        with self.assertRaises(GenerationError) as caught:
            self.render(cap={"skill": "middle", "family": "general"})
        self.assertEqual(caught.exception.code, "WIRE_SCOPE_UNSUPPORTED")
        self.assertEqual(self.calls, [])


# ------------------------------------------------------------------ the real render

@unittest.skipUnless(PINNED and WEASY and shutil.which("python3"), "Pinned elementary skill or WeasyPrint unavailable")
class OfflineRender(unittest.TestCase):
    def test_reply_good_renders_with_every_check_passing(self):
        import v5_offline_render
        before = skill_tree_state(S.ELEMENTARY)
        with tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR") or None) as tmp:
            work, out = Path(tmp) / "work", Path(tmp) / "out"
            summary = v5_offline_render.run(D10 / "lesson.json", D10 / "reply_good.json", out, work_dir=work,
                                            skill_path=str(S.ELEMENTARY), case="d10_good")
            report = json.loads((out / "d10_good/report.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["status"], "needs_review", summary)
            self.assertEqual(report["exitCode"], 0)
            # Stricter since the stage-3 verification: a pinned check_worksheet sub-check this host cannot run
            # (no pdffonts / pdftoppm, or no PIL for the page-fill check) is notRun, never PASS.
            expected = (["pinned-log:check_worksheet:fonts"] if shutil.which("pdffonts") is None else []) + (
                ["pinned-log:check_worksheet:render"] if shutil.which("pdftoppm") is None else [])
            try:
                import PIL  # noqa: F401
                pil = True
            except ImportError:
                pil = False
            if shutil.which("pdftoppm") is None or not pil:
                expected.append("pinned-log:check_worksheet:page-fill")
            self.assertEqual(report["notRun"], expected)
            self.assertEqual([entry["name"] for entry in report["notRunDetail"]], expected)
            self.assertTrue(all(entry["line"].endswith("(warn)") and entry["log"] == "logs/worksheet.txt"
                                for entry in report["notRunDetail"]))
            self.assertIs(report["verdict"]["fullyChecked"], expected == [])
            self.assertEqual(report["verdict"]["notRunCount"], len(expected))
            self.assertFalse(report["verdict"]["automatedChecksPassed"])     # unreviewed overlay
            self.assertNotIn("pinned-v72-report.raw.json", report["fileRoles"])
            self.assertNotIn("pinned-v72-report.raw.json", report["verdict"]["note"])
            self.assertNotIn("pinned-v72-report.raw.json", summary["verdict"]["note"])
            self.assertEqual([step["name"] for step in report["steps"]],
                             ["trusted-adapter", "content-truth", "pdf", "worksheet", "output-gates", "house-gates",
                              "atom-order"])
            self.assertEqual({step["status"] for step in report["steps"]}, {"PASS"})
            self.assertTrue(report["pdfProducer"].startswith("WeasyPrint"))
            self.assertEqual(report["atomOrder"]["status"], "PASS")
            self.assertEqual(report["selection"]["delivered"], 12)
            self.assertEqual(report["keys"][0]["key"], "א. 69 שארית 2 ; ב. 27 ; ג. 84 שארית 5")
            self.assertEqual(report["pages"], ["page-%d.png" % n for n in range(1, report["pdf"]["pages"] + 1)])
            for name in report["pages"]:
                self.assertTrue((out / "d10_good" / name).is_file())
            self.assertIsNone(report["pinnedReport"])
            log = (work / "logs/house-gates.txt").read_text(encoding="utf-8")
            for gate in ("G50", "G51-bidi", "G55", "G56", "G60-numbers", "G61-level", "G62-clones",
                         "G66-chronology", "G69-drawings", "G70-answer-layout"):
                self.assertRegex(log, r"PASS — %s" % re.escape(gate))
            self.assertIn("HOUSE GATES: PASS", log)
            self.assertIn("PDF-answer-LTR PASS", (work / "logs/output-gates.txt").read_text(encoding="utf-8"))
        self.assertEqual(skill_tree_state(S.ELEMENTARY), before)


D10 = S.FIXTURES / "d10"


# ------------------------------------------------------------------ the container context

class ContainerContext(unittest.TestCase):
    def test_the_new_modules_are_in_the_exact_docker_context(self):
        files = set(json.loads((CONTAINER / "context-files.json").read_text())["files"])
        rules = {}
        for path in (CONTAINER / "Dockerfile.dockerignore", RENDER / "Dockerfile.dockerignore"):
            rules[path] = {line[1:] for line in path.read_text().splitlines()[1:] if line and not line.startswith("#")}
        for name in ("division_kinds.py", "pdf_weasyprint_only.py"):
            path = "tools/teacher-generation/" + name
            self.assertIn(path, files)
            for found in rules.values():
                self.assertIn(path, found)


if __name__ == "__main__":
    unittest.main()
