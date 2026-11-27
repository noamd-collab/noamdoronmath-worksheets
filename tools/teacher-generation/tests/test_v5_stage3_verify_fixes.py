"""The stage-3 verification fixes (2026-11-25), each with its own tests (new file; nothing here relaxes a test):

(1) ד10 rule box: every number of the worked example is its own atom with Hebrew between ("כשמחלקים 125 ב־4 מקבלים
    31 שארית 1"); no atom holding an operator may stand next to the word שארית (overlay, IR and printed sheet).
(2) g9r rule box: the complement example prints no number, ruleFacts lists every equation of the rule box, and a
    question sharing a probability with one of them is refused (LEAK_RULE_FACT) and replaced by a reserve.
(3) A sub-check a pinned step did not run although the step passed (check_worksheet "PASS — … (warn)", build_plus
    "G83-room c not run") is notRun, never PASS; report.json names pinned-v72-report.raw.json only when it exists.
(4) Noam's g7 wording "ההפרש בין פי k מ־u לבין v" (key ku − v) and his approval of the g7 overlay (reviewed True,
    approvedBy Noam, approvedAt 2026-11-25); ד10 and g9r stay unreviewed.
"""
from fractions import Fraction
import json
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

from general_source import GeneralSourceError, V5_CONTRACT, validate_source  # noqa: E402
import probability_kinds as pk  # noqa: E402
import runner  # noqa: E402
import school_math  # noqa: E402
import structured_contract as sc  # noqa: E402

D10 = S.FIXTURES / "d10"
G9R = S.FIXTURES / "g9r_probability"
G7 = S.FIXTURES / "g7_algebraic_expressions"
REMAINDER = "שארית"
# An operator inside a printed atom (school notation and the elementary/middle house signs).
OPERATOR = re.compile(r"[:=+\-−×÷/*<>]|\bx\b")
OLD_D10_RULE = [{"kind": "text", "text": "למשל, "}, {"kind": "display", "notation": "125:4=31", "symbols": []},
                {"kind": "text", "text": " שארית "}, {"kind": "display", "notation": "1", "symbols": []},
                {"kind": "text", "text": "."}]
OLD_G9R_EXAMPLE = "1-3/10=7/10"


def _json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _scope(lesson):
    from runtime_catalog import scope_for_lesson
    return scope_for_lesson(lesson)


def atoms_beside_word(html, word=REMAINDER):
    """[(side, atom)] of every LTR atom printed right next to ``word`` in an HTML page (only spaces between)."""
    out = []
    for match in re.finditer(re.escape(word), html):
        before = re.search(r'<span class="ltr">([^<]*)</span>\s*$', html[:match.start()])
        after = re.match(r'\s*<span class="ltr">([^<]*)</span>', html[match.end():])
        out += [("before", before.group(1))] if before else []
        out += [("after", after.group(1))] if after else []
    return out


# ------------------------------------------------------------------ (1) the ד10 rule box reading order

class D10RuleBox(unittest.TestCase):
    def overlay(self):
        return sc.overlay_for("ד10", "a")

    def test_every_number_of_the_example_is_its_own_atom(self):
        rule = sc.rule_spans(self.overlay())
        displays = [span["notation"] for span in rule if span["kind"] == "display"]
        self.assertEqual(displays, ["125", "4", "31", "1"])
        self.assertEqual(divmod(125, 4), (31, 1))                             # the example is a true division
        texts = [span["text"] for span in rule if span["kind"] == "text"]
        self.assertTrue(texts[0].endswith("למשל, כשמחלקים "))
        self.assertEqual(texts[1:], [" ב־", " מקבלים ", " שארית ", "."])
        self.assertEqual(tuple(self.overlay()["ruleExamples"]), (("125", "4"),))  # EXAMPLE_COPY still guards it
        self.assertIs(self.overlay()["reviewed"], False)                       # still pending Noam's review
        self.assertIn("rule", self.overlay()["pendingReview"])

    def test_no_operator_atom_beside_the_remainder_word_in_the_overlay(self):
        overlay = self.overlay()
        self.assertEqual(sc.remainder_word_neighbours(overlay["rule"], REMAINDER), [])
        for story in overlay["stories"].values():
            self.assertEqual(sc.remainder_word_neighbours([(part == "T", value) for part, value in story["intro"]],
                                                          REMAINDER), [])
        # Every atom next to the word holds no operator, and the quotient (31) comes right before it.
        rule = sc.rule_spans(overlay)
        at = next(i for i, span in enumerate(rule) if span["kind"] == "text" and span["text"].strip() == REMAINDER)
        self.assertEqual((rule[at - 1]["notation"], rule[at + 1]["notation"]), ("31", "1"))
        self.assertFalse(OPERATOR.search(rule[at - 1]["notation"] + rule[at + 1]["notation"]))
        # The old form is caught, by the helper and by check_overlay.
        self.assertEqual(sc.remainder_word_neighbours(OLD_D10_RULE, REMAINDER), [(2, "125:4=31")])
        broken = sc.thaw(overlay)
        broken["rule"] = OLD_D10_RULE
        with self.assertRaises(ValueError) as caught:
            sc.check_overlay(sc._freeze(broken))
        self.assertIn("atom beside the remainder word", str(caught.exception))

    @unittest.skipUnless(S.ELEMENTARY_PINNED, "Pinned elementary skill unavailable")
    def test_no_operator_atom_beside_the_remainder_word_on_the_printed_sheet(self):
        import general_adapters
        from test_v5_d10_elementary import compile_good, lesson, scope
        ir = compile_good().ir
        self.assertEqual(ir["rule"], sc.rule_spans(self.overlay()))
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / "work"
            general_adapters.compile_source(lesson(), {"source": ir}, scope(), str(S.ELEMENTARY), work,
                                            contract=V5_CONTRACT)
            body = (work / "sheet.html").read_text(encoding="utf-8").split("<body", 1)[1]
        beside = atoms_beside_word(body)
        # The rule box (31 | 1) and the two drill keys with a remainder (69 | 2, 84 | 5): every neighbour checked.
        self.assertEqual(beside, [("before", "31"), ("after", "1"), ("before", "69"), ("after", "2"),
                                  ("before", "84"), ("after", "5")])
        self.assertEqual([atom for _, atom in beside if OPERATOR.search(atom)], [])
        self.assertTrue(all(re.fullmatch(r"[0-9]+", atom) for _, atom in beside), beside)
        self.assertIn('<span class="ltr">31</span> שארית <span class="ltr">1</span>.', body)
        # The scanner sees the old form (an equation atom right before the word).
        old = 'למשל, <span class="ltr">125 : 4 = 31</span> שארית <span class="ltr">1</span>.'
        self.assertEqual(atoms_beside_word(old), [("before", "125 : 4 = 31"), ("after", "1")])


# ------------------------------------------------------------------ (2) the g9r rule box never gives a key away

def _g9r_old_example_overlay():
    """The real g9r overlay with the old rule-box example "1 − 3/10 = 7/10" put back and listed in ruleFacts."""
    overlay = sc.thaw(sc.overlay_for("g9r:probability", "e"))
    overlay["rule"] = [{"kind": "text", "text": "ההסתברות של המאורע המשלים היא אחת פחות ההסתברות של המאורע, למשל "},
                       {"kind": "display", "notation": OLD_G9R_EXAMPLE, "symbols": []},
                       {"kind": "text", "text": "."}]
    overlay["ruleFacts"] = [["1-3/10", "7/10"]]
    return sc._freeze(overlay)


class G9rRuleBox(unittest.TestCase):
    def overlay(self):
        return sc.overlay_for("g9r:probability", "e")

    def test_the_rule_box_prints_no_number(self):
        overlay = self.overlay()
        rule = sc.rule_spans(overlay)
        self.assertEqual([span["kind"] for span in rule], ["text"])
        self.assertIsNone(re.search(r"[0-9]", rule[0]["text"]))
        self.assertIn("למשל, ההסתברות שלא ייצא כדור אדום היא אחת פחות ההסתברות שייצא כדור אדום.", rule[0]["text"])
        self.assertEqual(tuple(overlay["ruleFacts"]), ())
        self.assertEqual(pk.rule_values(overlay), frozenset())
        self.assertIs(overlay["reviewed"], False)                                # still pending Noam's review
        self.assertIn("rule", overlay["pendingReview"])

    def test_rule_facts_list_exactly_the_equations_of_the_rule_box(self):
        sc.check_overlay(_g9r_old_example_overlay())
        unlisted = sc.thaw(_g9r_old_example_overlay())
        unlisted["ruleFacts"] = []
        with self.assertRaises(ValueError) as caught:
            sc.check_overlay(sc._freeze(unlisted))
        self.assertIn("ruleFacts", str(caught.exception))
        extra = sc.thaw(self.overlay())
        extra["ruleFacts"] = [["1-3/10", "7/10"]]
        with self.assertRaises(ValueError):
            sc.check_overlay(sc._freeze(extra))

    def test_rule_values_and_question_values(self):
        self.assertEqual(pk.rule_values(_g9r_old_example_overlay()), {Fraction(3, 10), Fraction(7, 10)})
        from test_v5_g9r_probability import compile_good
        questions = compile_good().ir["sections"][0]["questions"]
        overlay = self.overlay()
        q1, q12 = pk.question_values(questions[0], overlay), pk.question_values(questions[11], overlay)
        self.assertLessEqual({Fraction(3, 10), Fraction(7, 10)}, q1)      # keys 3/10 and 7/10 (3 red of 10)
        self.assertLessEqual({Fraction(3, 10), Fraction(7, 10)}, q12)     # 3 black, 7 red: 1 − 3/10 = 7/10
        self.assertEqual(pk.sheet_leaks(questions, overlay), {})            # nothing collides with the real rule

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_a_question_sharing_a_value_with_the_rule_box_is_replaced_by_a_reserve(self):
        from test_v5_g9r_probability import compile_good
        old = _g9r_old_example_overlay()
        real_overlay_for = sc.overlay_for
        with patch.object(sc, "overlay_for",
                          lambda topic, level: old if topic == "g9r:probability" else real_overlay_for(topic, level)):
            result = compile_good()                          # its final validate_source runs with the same overlay
        replaced = result.ir["selection"]["replaced"]
        self.assertEqual([(entry["slot"], entry["by"]) for entry in replaced],
                         [("Q1", "R1"), ("Q8", "R2"), ("Q12", "R3"), ("Q17", "R4")])
        self.assertTrue(all(entry["codes"] == ["LEAK_RULE_FACT"] for entry in replaced))
        facts = pk.rule_values(old)
        for question in result.ir["sections"][0]["questions"]:
            self.assertFalse(pk.question_values(question, old) & facts)
            for item in question["items"]:
                self.assertNotIn(pk.key_value(item["answer"]["key"]), facts)
        self.assertEqual(result.ir["rule"], sc.rule_spans(old))
        # The final validator refuses a sheet that still prints a colliding question (Q1 keys 3/10 and 7/10).
        clean = compile_good().ir
        clean["rule"] = sc.rule_spans(old)
        with patch.object(sc, "overlay_for",
                          lambda topic, level: old if topic == "g9r:probability" else real_overlay_for(topic, level)):
            from test_v5_g9r_probability import lesson, scope
            with self.assertRaises(GeneralSourceError) as caught:
                validate_source(lesson(), clean, scope(), contract=V5_CONTRACT)
        self.assertEqual(caught.exception.code, "SOURCE_LEAK")

    def test_the_card_names_rule_facts_only_when_there_are_some(self):
        from test_v5_g9r_probability import lesson, scope
        self.assertNotIn("rule box already shows", sc.authoring_card(lesson(), scope(), self.overlay()))
        card = sc.authoring_card(lesson(), scope(), _g9r_old_example_overlay())
        self.assertIn("- The rule box already shows 1-3/10=7/10: no question may print or key one of its values.",
                      card)


# ------------------------------------------------------------------ (3) skipped pinned sub-checks are notRun

WORKSHEET_LOG = "\n".join([
    "[band=elementary] — all-fours rules adjusted (יסודי: ':' חילוק חוקי, ÷ אסור)",
    "PASS — pdffonts missing — skipped (warn)",
    "PASS — text OK (1942 Hebrew chars, 0 U+FFFD)",
    "PASS — brand line + בס״ד present on all 4 pages",
    "PASS — pdftoppm missing — skipped render (warn)",
    "PASS — no rendered pages yet — fill check deferred (warn)",
    "WARN — no ★ found in extracted text — verify starred questions rendered",
    "==================================================",
    "GATE: PASS"])
BUILD_PLUS_LOG = "\n".join([
    "G76 b    objects 0/1 · busiest 0/2 · parts 1",
    "G83 b    not a figure topic -- declared: הנושא אינו גיאומטריה; הוראת נועם אוסרת שרטוטים בנושא זה",
    "G84-chronology b    PASS (track=ז, topic=algebraic_expressions, 0 premature terms)",
    "G83-room   b    not run -- declared: הנושא אינו גיאומטריה; הוראת נועם אוסרת שרטוטים בנושא זה",
    "G80-text   b    PASS    110 block(s) bound to sheet.json",
    "GATES: all pass"])


class PinnedLogParsing(unittest.TestCase):
    def write(self, work, relative, text):
        path = Path(work) / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def test_check_worksheet_warn_lines(self):
        with tempfile.TemporaryDirectory() as work:
            self.assertEqual(runner._pinned_log_not_run(work, elementary=True), [])        # no log: nothing
            self.write(work, "logs/worksheet.txt", WORKSHEET_LOG + "\nPASS — something new — skipped (warn)\n"
                       "PASS — PIL missing — page-fill check skipped (warn)\nFAIL — pdftoppm failed: x (warn)\n")
            found = runner._pinned_log_not_run(work, elementary=True)
        self.assertEqual([name for name, _, _ in found],
                         ["pinned-log:check_worksheet:fonts", "pinned-log:check_worksheet:render",
                          "pinned-log:check_worksheet:page-fill", "pinned-log:check_worksheet:warn-1"])
        self.assertEqual(found[0][1:], ("logs/worksheet.txt", "PASS — pdffonts missing — skipped (warn)"))

    def test_build_plus_not_run_lines(self):
        with tempfile.TemporaryDirectory() as work:
            self.assertEqual(runner._pinned_log_not_run(work, elementary=False), [])
            self.write(work, "out/logs/build_plus.log", BUILD_PLUS_LOG + "\nG80-text   not run: DELIVER = False "
                       "(no package to bind)\nG83 c    DEFERRED -- declared: later\nG84-numclear c    not run -- x\n")
            found = runner._pinned_log_not_run(work, elementary=False)
        self.assertEqual([name for name, _, _ in found],
                         ["pinned-log:build_plus:G83:b", "pinned-log:build_plus:G83-room:b",
                          "pinned-log:build_plus:G80-text", "pinned-log:build_plus:G83:c",
                          "pinned-log:build_plus:G84-numclear:c"])
        self.assertTrue(found[1][2].startswith("G83-room   b    not run -- declared"))

    def test_an_unreadable_log_is_not_run(self):
        with tempfile.TemporaryDirectory() as work:
            (Path(work) / "out/logs/build_plus.log").mkdir(parents=True)               # a directory, not a log
            self.assertEqual(runner._pinned_log_not_run(work, elementary=False),
                             [("pinned-log:build_plus:unreadable", "out/logs/build_plus.log", "")])


class RunnerSubchecks(unittest.TestCase):
    """The runner's v5 paths with a stubbed subprocess.run whose pinned steps print the real skip markers."""
    REPORT = {"result": "PASS", "review": [],
              "steps": [{"step": name, "status": "PASS"} for name in (
                  "build_plus (PDF + gates)", "check_plain_math.py", "verify_export.py", "selfcheck_noam_package.py",
                  "check_didactic.py")],
              "gates": [{"gate": "G85-section-volume", "level": None, "status": "PASS"}]}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name) / "job"
        self.skill = Path(self.tmp.name) / "skill"
        self.skill.mkdir()

    def render_middle(self, build_log, overlay=None):
        def execute(args, **kwargs):
            if Path(args[2]).name == "build_v72.py":
                (self.work / "out/deliver/b").mkdir(parents=True, exist_ok=True)
                (self.work / "out/deliver/b/sheet.pdf").write_bytes(b"%PDF stub")
                (self.work / "out/v72-report.json").write_text(json.dumps(self.REPORT))
                if build_log is not None:
                    (self.work / "out/logs").mkdir(parents=True, exist_ok=True)
                    (self.work / "out/logs/build_plus.log").write_text(build_log, encoding="utf-8")
            return SimpleNamespace(stdout="", stderr="", returncode=0)
        patches = [patch.object(runner, "validate_model", return_value={"skill": "middle", "family": "general"}),
                   patch.object(runner, "verify_skill", return_value=(self.skill, {"version": "7.2.0-noam",
                                                                                   "sha256": "a" * 64})),
                   patch.object(runner.subprocess, "run", side_effect=execute)]
        if overlay is not None:
            patches.append(patch.object(sc, "overlay_for", return_value=overlay))
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        return runner.render_job(S.lesson(), {"version": 4, "contract": V5_CONTRACT}, self.work,
                                 skill_paths={"middle": self.skill}, contract=V5_CONTRACT)

    def test_a_build_plus_gate_that_did_not_run_keeps_the_reviewed_g7_sheet_unchecked(self):
        manifest = self.render_middle(BUILD_PLUS_LOG)
        self.assertEqual(manifest["status"], "needs_review")
        self.assertIs(manifest["executedChecksPassed"], True)
        self.assertIs(manifest["overlayReviewed"], True)                       # the g7 overlay is approved
        self.assertEqual(manifest["overlayApproval"], {"by": "Noam", "at": "2026-11-25"})
        self.assertEqual(manifest["overlayPendingReview"], [])
        self.assertEqual(manifest["notRun"], ["pinned-log:build_plus:G83:b", "pinned-log:build_plus:G83-room:b"])
        self.assertEqual([entry["log"] for entry in manifest["notRunDetail"]], ["out/logs/build_plus.log"] * 2)
        self.assertIs(manifest["automatedChecksPassed"], False)               # only the not-run gates hold it
        self.assertIs(manifest["renderingChecksPassed"], False)
        self.assertEqual([artifact["kind"] for artifact in manifest["artifacts"]], ["pdf"])

    def test_without_any_not_run_line_the_reviewed_sheet_counts_as_passed(self):
        manifest = self.render_middle("G84-chronology b    PASS (track=ז, 0 premature terms)\nGATES: all pass\n")
        self.assertEqual((manifest["notRun"], manifest["notRunDetail"]), ([], []))
        self.assertIs(manifest["automatedChecksPassed"], True)

    def test_an_unreviewed_overlay_reports_no_approval(self):
        manifest = self.render_middle(None, overlay=sc.overlay_for("g9r:probability", "e"))
        self.assertIs(manifest["overlayReviewed"], False)
        self.assertIsNone(manifest["overlayApproval"])
        self.assertIs(manifest["automatedChecksPassed"], False)

    def render_elementary(self, worksheet_stdout, fail=()):
        from test_v5_d10_elementary import lesson

        def execute(args, **kwargs):
            script = Path(args[2]).name
            if script == "pdf_weasyprint_only.py":
                (self.work / "sheet.pdf").write_bytes(b"%PDF stub")
            stdout = worksheet_stdout if script == "check_worksheet.py" else ""
            return SimpleNamespace(stdout=stdout, stderr="", returncode=1 if script in fail else 0)
        with patch.object(runner, "validate_model", return_value={"skill": "elementary", "family": "general"}), \
                patch.object(runner, "verify_skill", return_value=(self.skill, {"version": "1.0.5-noam",
                                                                                "sha256": "b" * 64})), \
                patch.object(runner.subprocess, "run", side_effect=execute):
            return runner.render_job(lesson(), {"version": 4, "contract": V5_CONTRACT}, self.work,
                                     skill_paths={"elementary": self.skill}, contract=V5_CONTRACT)

    def test_check_worksheet_warn_skips_are_not_run_never_pass(self):
        manifest = self.render_elementary(WORKSHEET_LOG)
        self.assertEqual(manifest["status"], "needs_review")
        self.assertIs(manifest["executedChecksPassed"], True)
        self.assertEqual(manifest["notRun"], ["pinned-log:check_worksheet:fonts", "pinned-log:check_worksheet:render",
                                              "pinned-log:check_worksheet:page-fill"])
        self.assertEqual([entry["line"] for entry in manifest["notRunDetail"]],
                         ["PASS — pdffonts missing — skipped (warn)", "PASS — pdftoppm missing — skipped render (warn)",
                          "PASS — no rendered pages yet — fill check deferred (warn)"])
        self.assertIs(manifest["automatedChecksPassed"], False)
        self.assertEqual({step["name"]: step["status"] for step in manifest["steps"]}["worksheet"], "PASS")

    def test_reviewed_elementary_overlay_still_needs_every_subcheck(self):
        reviewed = sc.thaw(sc.overlay_for("ד10", "a"))
        reviewed.update(reviewed=True, approvedBy="Noam", approvedAt="2026-11-25", pendingReview=[])
        with patch.object(sc, "overlay_for", return_value=sc._freeze(reviewed)):
            held = self.render_elementary(WORKSHEET_LOG)
            shutil.rmtree(self.work)
            clean = self.render_elementary("PASS — text OK\nGATE: PASS\n")
        self.assertIs(held["automatedChecksPassed"], False)
        self.assertEqual(clean["notRun"], [])
        self.assertIs(clean["automatedChecksPassed"], True)

    def test_a_failed_check_worksheet_still_fails(self):
        manifest = self.render_elementary(WORKSHEET_LOG, fail=("check_worksheet.py",))
        self.assertEqual(manifest["status"], "failed")
        self.assertEqual(manifest["artifacts"], [])
        self.assertIn("pinned-log:check_worksheet:fonts", manifest["notRun"])


class ReportTexts(unittest.TestCase):
    def test_the_note_and_the_roles_name_the_pinned_copy_only_when_it_exists(self):
        import v5_offline_render as r
        manifest = {"executedChecksPassed": True, "notRun": ["pinned-log:check_worksheet:fonts"]}
        self.assertIn(r.PINNED_REPORT, r._verdict(manifest)["note"])
        self.assertNotIn(r.PINNED_REPORT, r._verdict(manifest, False)["note"])
        self.assertIn("did not run and are not passed", r._verdict(manifest, False)["note"])
        self.assertIs(r._verdict(manifest, False)["fullyChecked"], False)
        self.assertNotIn(r.PINNED_REPORT, r._file_roles(None))
        self.assertEqual(r._file_roles({"file": r.PINNED_REPORT}), r.FILE_ROLES)

    @unittest.skipUnless(S.ELEMENTARY_PINNED, "Pinned elementary skill unavailable")
    def test_an_elementary_render_never_names_a_pinned_report(self):
        import pymupdf
        import v5_offline_render

        def render_job(lesson, ir, work, skill_paths=None, **kwargs):
            work = Path(work)
            (work / "logs").mkdir(parents=True)
            document = pymupdf.open()
            document.new_page().insert_text((72, 72), "stub")
            document.save(str(work / "sheet.pdf"))
            document.close()
            (work / "logs/atom-order.json").write_text(json.dumps({"status": "PASS", "producer": "stub"}))
            manifest = {"status": "needs_review", "executedChecksPassed": True, "automatedChecksPassed": False,
                        "notRun": ["pinned-log:check_worksheet:fonts"],
                        "notRunDetail": [{"name": "pinned-log:check_worksheet:fonts", "log": "logs/worksheet.txt",
                                          "line": "PASS — pdffonts missing — skipped (warn)"}],
                        "overlayReviewed": False, "overlayPendingReview": ["rule"], "overlayApproval": None,
                        "steps": [{"name": "worksheet", "status": "PASS"}], "skill": {"name": "elementary"}}
            (work / "manifest.json").write_text(json.dumps(manifest))
            return manifest

        with tempfile.TemporaryDirectory() as tmp:
            if " " in tmp:
                self.skipTest("The temporary folder contains a space")
            out = Path(tmp) / "out"
            with patch.object(runner, "render_job", side_effect=render_job):
                summary = v5_offline_render.run(D10 / "lesson.json", D10 / "reply_good.json", out,
                                                work_dir=Path(tmp) / "work", skill_path=str(S.ELEMENTARY), dpi=20,
                                                case="d10")
            report = _json(out / "d10/report.json")
            written = (out / "d10/report.json").read_text(encoding="utf-8")
            self.assertIsNone(report["pinnedReport"])
            self.assertFalse((out / "d10/pinned-v72-report.raw.json").exists())
            self.assertNotIn("pinned-v72-report.raw.json", written)
            self.assertNotIn("pinned-v72-report.raw.json", (out / "d10/summary.json").read_text(encoding="utf-8"))
            self.assertEqual(report["notRunDetail"][0]["name"], "pinned-log:check_worksheet:fonts")
            self.assertEqual((summary["verdict"]["fullyChecked"], report["verdict"]["notRunCount"]), (False, 1))


# ------------------------------------------------------------------ (4) Noam's g7 wording and approval

class G7WordingAndApproval(unittest.TestCase):
    def test_the_times_minus_template_reads_as_noam_approved(self):
        overlay = sc.overlay_for("g7:algebraic_expressions", "b")
        template = overlay["templates"]["W_TIMES_MINUS"]
        self.assertEqual(template["shape"], "kv-w")
        self.assertEqual(tuple(template["layout"]), (("T", "ההפרש בין פי "), ("D", "k"), ("T", " מ־"), ("D", "v"),
                                                      ("T", " לבין "), ("D", "w")))
        self.assertFalse([path for path, text in sc.code_strings(overlay) if "פחות" in text])

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_the_printed_item_and_its_key(self):
        from structured_source import compile_sheet
        lesson = _json(G7 / "lesson.json")
        ir = compile_sheet(lesson, _scope(lesson), _json(G7 / "reply_good.json"), skill_path=str(S.MIDDLE)).ir
        item = ir["sections"][0]["questions"][0]["items"][2]
        printed = "".join(span["text"] if span["kind"] == "text" else school_math.display_island(span)
                          for span in item["prompt"])
        self.assertEqual(printed, "ההפרש בין פי $2$ מ־$a$ לבין $y$")
        self.assertEqual(item["answer"]["key"]["notation"], "2a-y")             # the key stays ku − v
        self.assertEqual(item["answer"]["key"]["binding"]["template"], "W_TIMES_MINUS")
        self.assertEqual(school_math.key_island(item["answer"]["key"]), "$2a − y$")

    def test_only_the_g7_overlay_is_approved(self):
        g7, d10, g9r = (sc.overlay_for(*pair) for pair in (("g7:algebraic_expressions", "b"), ("ד10", "a"),
                                                             ("g9r:probability", "e")))
        self.assertEqual((g7["reviewed"], g7["approvedBy"], g7["approvedAt"], tuple(g7["pendingReview"])),
                         (True, "Noam", "2026-11-25", ()))
        for overlay in (d10, g9r):
            self.assertIs(overlay["reviewed"], False)
            self.assertNotIn("approvedBy", overlay)
            self.assertNotIn("approvedAt", overlay)
            self.assertTrue(overlay["pendingReview"])

    def test_check_overlay_refuses_an_inconsistent_review_record(self):
        g7 = sc.thaw(sc.overlay_for("g7:algebraic_expressions", "b"))
        d10 = sc.thaw(sc.overlay_for("ד10", "a"))
        cases = {
            "approved without approver": dict(g7, approvedBy=""),
            "approved by someone else": dict(g7, approvedBy="Claude"),
            "approved with a bad date": dict(g7, approvedAt="25.11.2026"),
            "approved with pending fields": dict(g7, pendingReview=["rule"]),
            "unreviewed with an approver": dict(d10, approvedBy="Noam", approvedAt="2026-11-25"),
            "unreviewed with nothing pending": dict(d10, pendingReview=[]),
        }
        no_date = dict(g7)
        del no_date["approvedAt"]
        cases["approved without a date"] = no_date
        for name, overlay in cases.items():
            with self.subTest(name=name):
                with self.assertRaises(ValueError) as caught:
                    sc.check_overlay(sc._freeze(overlay))
                self.assertIn("reviewed", str(caught.exception))

    def test_the_cards_say_which_overlay_is_reviewed(self):
        from test_v5_d10_elementary import lesson as d10_lesson, scope as d10_scope
        from test_v5_g9r_probability import lesson as g9r_lesson, scope as g9r_scope
        self.assertIn("overlay reviewed: yes", sc.authoring_card(S.lesson(), S.scope(), S.overlay()))
        self.assertIn("overlay reviewed: no", sc.authoring_card(d10_lesson(), d10_scope(),
                                                                 sc.overlay_for("ד10", "a")))
        self.assertIn("overlay reviewed: no", sc.authoring_card(g9r_lesson(), g9r_scope(),
                                                                 sc.overlay_for("g9r:probability", "e")))


if __name__ == "__main__":
    unittest.main()
