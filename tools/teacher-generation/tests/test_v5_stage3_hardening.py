"""Stage-3 hardening (2026-11-25). New tests only; branch tests touched by this stage were only made stricter.

- Reordered repeats inside one question: structured_source.compile_question refuses a later item whose task has
  the same signed-term multiset as an earlier item of the same question (DUPLICATE_REORDERED via
  leak_checks.reordered_items), trimmed while three clean items remain, else the question is refused with
  ITEM_COUNT. question_leaks keeps the section 4 rule; the final validator refuses an IR that still holds one.
- Trusted v5 marker: validate_source / validation.validate_model / runner.render_job / runner._is_v5 and the
  adapter honour the root "contract" marker only with the keyword-only trusted flag contract='worksheet-wire/5',
  set only by structured_source and v5_offline_render. Unflagged, a v5-shaped payload is refused exactly as at
  bafa36f0 (code and message recorded from a `git archive bafa36f0` copy).
- Container packaging: every v5 runtime module is in the exact Docker-context allowlist (context-files.json and
  both Dockerfile.dockerignore files), and the allowlisted modules' local imports are allowlisted too.
- The pinned build's report copy can never pass for the verdict: report.json is marked authoritative, names
  every file's role, describes the pinned copy (sha256, its own result, isVerdict false) and lists stale files.
"""
import ast
import copy
import hashlib
import itertools
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import item_kinds as ik  # noqa: E402
import leak_checks  # noqa: E402
import runner  # noqa: E402
import structured_source as ss  # noqa: E402
from general_source import V5_CONTRACT, GeneralSourceError, validate_source  # noqa: E402
from validation import GenerationError, validate_model  # noqa: E402

G7 = S.FIXTURES / "g7_algebraic_expressions"
CONTAINER = S.APP / "cloud/container"
RENDER = S.APP / "cloud/render"
# validate_source / validate_model / render_job of a `git archive bafa36f0` copy, on the unflagged payloads below.
BASELINE_REFUSAL = ("SOURCE_SHAPE", "Unexpected or missing source fields")
V5_MODULES = ("atom_order.py", "item_kinds.py", "leak_checks.py", "lesson_select.py", "mistake_models.py",
              "school_math.py", "structured_author.py", "structured_contract.py", "structured_source.py",
              "text_lint.py", "v5_offline_render.py")


def compile_question(slot, kind, items, skill_path=None):
    return ss.compile_question(S.question(slot, kind, items), S.rows()[slot], S.context(skill_path))


def records(compiled):
    return [refusal.record() for refusal in compiled.refusals]


def ir_question(kind, items):
    """An IR question compiled by item_kinds alone (what the leak checks read)."""
    compiled = [ik.compile_item(kind, item, index, S.context()) for index, item in enumerate(items, 1)]
    for item in compiled:
        assert item.refusals == [], item.refusals
    return {"intro": ik.intro_spans(kind, S.overlay()), "star": kind == "find_error_collect",
            "items": [{"prompt": item.prompt, "answer": item.answer} for item in compiled]}


def load_g7(name):
    return json.loads((G7 / name).read_text(encoding="utf-8"))


def quadratic():
    root = CONTAINER / "fixtures/general/grade9-quadratic"
    return (json.loads((root / "lesson.json").read_text(encoding="utf-8")),
            json.loads((root / "model-output.json").read_text(encoding="utf-8")))


def refusal_of(call):
    try:
        call()
    except (GeneralSourceError, GenerationError) as error:
        return error.code, str(error)
    return "ACCEPTED", ""


# ------------------------------------------------------------------ (1) reordered repeats inside one question

class ReorderedItemsInOneQuestion(unittest.TestCase):
    def test_the_later_item_is_trimmed_while_three_clean_items_remain(self):
        compiled = compile_question("Q16", "collect_like_terms", [S.item("4b+3-b+9"), S.item("x+6+5x+2"),
                                                                  S.item("5x+2+x+6"), S.item("10y-4-3y-3")])
        self.assertEqual((compiled.codes, compiled.trimmed), ((), (3,)))
        self.assertEqual(records(compiled), [{"slot": "Q16", "item": 3, "field": "expr",
                                              "code": "DUPLICATE_REORDERED"}])
        displays = [item["prompt"][0]["notation"] for item in compiled.ir["items"]]
        self.assertEqual(displays, ["4b+3-b+9", "x+6+5x+2", "10y-4-3y-3"])         # the earlier item stays

    def test_with_three_items_the_question_is_refused(self):
        """The re-verifier's probe: Q16 ['4b+3-b+9', 'x+6+5x+2', '5x+2+x+6'] used to compile clean."""
        compiled = compile_question("Q16", "collect_like_terms", [S.item("4b+3-b+9"), S.item("x+6+5x+2"),
                                                                  S.item("5x+2+x+6")])
        self.assertIsNone(compiled.ir)
        self.assertEqual(compiled.codes, ("DUPLICATE_REORDERED", "ITEM_COUNT"))
        self.assertEqual(records(compiled), [
            {"slot": "Q16", "item": 3, "field": "expr", "code": "DUPLICATE_REORDERED"},
            {"slot": "Q16", "item": 0, "field": "items", "code": "ITEM_COUNT"}])

    def test_in_either_order_the_later_item_is_refused(self):
        compiled = compile_question("Q16", "collect_like_terms", [S.item("4b+3-b+9"), S.item("5x+2+x+6"),
                                                                  S.item("x+6+5x+2"), S.item("10y-4-3y-3")])
        self.assertEqual(compiled.trimmed, (3,))
        self.assertEqual(compiled.ir["items"][1]["prompt"][0]["notation"], "5x+2+x+6")

    def test_exact_repeats_stay_duplicate_item_only(self):
        compiled = compile_question("Q13", "collect_like_terms", [S.item("3x+5+2x-1"), S.item("-4y+9+6y-2"),
                                                                  S.item("8a-3+a-5"), S.item("3x+5+2x-1")])
        self.assertEqual(records(compiled), [{"slot": "Q13", "item": 4, "field": "expr", "code": "DUPLICATE_ITEM"}])

    def test_equal_keys_and_other_signs_are_no_reorder(self):
        same_key = compile_question("Q13", "collect_like_terms", [S.item("3x+5+2x-1"), S.item("4x+5+x-1"),
                                                                  S.item("8a-3+a-5")])
        self.assertEqual((same_key.codes, same_key.trimmed, records(same_key)), ((), (), []))
        signs = compile_question("Q16", "collect_like_terms", [S.item("x+6+5x+2"), S.item("x-6+5x+2"),
                                                               S.item("4b+3-b+9")])
        self.assertEqual((signs.codes, signs.trimmed, records(signs)), ((), (), []))

    def test_every_kind(self):
        cases = (
            ("Q7", "substitute", [S.item("4y-y", values="y=-2"), S.item("2a+5", values="a=3"),
                                  S.item("5b-2b", values="b=4"), S.item("-y+4y", values="y=3")]),
            ("Q1", "write_from_words", [S.item("a+b", variant="W_SUM"), S.item("4x", variant="W_TIMES"),
                                        S.item("3y+x", variant="W_TIMES_PLUS"), S.item("b+a", variant="W_SUM")]),
            ("Q18", "find_error_collect", [S.item("4a+3+a+2", "10a", variant="M1"),
                                           S.item("6x+7-1-2x", "4x+8", variant="M2"),
                                           S.item("5b+2a+b", "5b+2a", variant="M3"),
                                           S.item("a+2+4a+3", "10a", variant="M1")]),
        )
        for slot, kind, items in cases:
            with self.subTest(kind=kind):
                compiled = compile_question(slot, kind, items)
                self.assertEqual((compiled.codes, compiled.trimmed), ((), (4,)))
                self.assertEqual(records(compiled), [{"slot": slot, "item": 4, "field": "expr",
                                                      "code": "DUPLICATE_REORDERED"}])

    def test_the_item_rule_is_monotone_and_question_leaks_keep_the_section_4_rule(self):
        exprs = ["3x+5+2x-1", "2x+5+3x-1", "8a-3+a-5", "-1+3x+2x+5", "a-3+8a-5", "-4y+9+6y-2"]
        whole = leak_checks.reordered_items(ir_question("collect_like_terms", [S.item(e) for e in exprs]))
        self.assertEqual(whole, [(2, "DUPLICATE_REORDERED"), (4, "DUPLICATE_REORDERED"),
                                 (5, "DUPLICATE_REORDERED")])
        for size in range(1, len(exprs)):
            for kept in itertools.combinations(range(len(exprs)), size):
                hits = leak_checks.reordered_items(ir_question("collect_like_terms",
                                                               [S.item(exprs[i]) for i in kept]))
                for index, code in hits:
                    self.assertIn((kept[index - 1] + 1, code), whole, kept)
        pair = ir_question("collect_like_terms", [S.item("3x+5+2x-1"), S.item("2x+5+3x-1"), S.item("8a-3+a-5")])
        self.assertEqual(leak_checks.question_leaks(pair, S.overlay(), skill_path=None), [])
        self.assertNotIn("DUPLICATE_REORDERED", leak_checks.QUESTION_CODES)


@unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
class ReorderedItemsOnTheSheet(unittest.TestCase):
    def reply(self):
        reply = load_g7("reply_good.json")
        q13 = next(question for question in reply["questions"] if question["slot"] == "Q13")
        q13["items"][2] = S.item("3x-2+4x+6")                       # the terms of item א, '4x+6+3x-2', reordered
        return reply

    def test_a_planned_question_holding_a_reorder_takes_a_reserve(self):
        result = ss.compile_sheet(load_g7("lesson.json"), S.scope(), self.reply(), skill_path=str(S.MIDDLE))
        selection = result.ir["selection"]
        self.assertEqual(selection["delivered"], 20)
        self.assertEqual(selection["replaced"], [{"slot": "Q13", "by": "R3",
                                                  "codes": ["DUPLICATE_REORDERED", "ITEM_COUNT"]}])
        self.assertEqual(result.diagnostics["refusals"], [
            {"slot": "Q13", "item": 3, "field": "expr", "code": "DUPLICATE_REORDERED"},
            {"slot": "Q13", "item": 0, "field": "items", "code": "ITEM_COUNT"}])
        for question in result.ir["sections"][0]["questions"]:
            self.assertEqual(leak_checks.reordered_items(question), [])

    def test_the_final_validator_refuses_a_reorder_inside_a_question(self):
        with patch.object(leak_checks, "reordered_items", return_value=[]):
            kept = ss.compile_sheet(load_g7("lesson.json"), S.scope(), self.reply(), skill_path=str(S.MIDDLE))
        self.assertEqual(kept.ir["selection"]["replaced"], [])
        with self.assertRaises(GeneralSourceError) as caught:
            validate_source(load_g7("lesson.json"), kept.ir, S.scope(), contract=V5_CONTRACT)
        self.assertEqual((caught.exception.code, str(caught.exception)),
                         ("SOURCE_LEAK", "Answer leak or duplicate item at q13"))

    def test_the_fixture_sheets_hold_no_reorder_inside_a_question(self):
        sheets = [S.ir_good()] + [ss.compile_sheet(load_g7("lesson.json"), S.scope(), load_g7(name),
                                                   skill_path=str(S.MIDDLE)).ir
                                  for name in ("reply_good.json", "reply_with_failures.json")]
        for sheet in sheets:
            for question in sheet["sections"][0]["questions"]:
                self.assertEqual(leak_checks.reordered_items(question), [])


# ------------------------------------------------------------------ (2) the trusted v5 marker

class TrustedContract(unittest.TestCase):
    def unflagged_payloads(self):
        lesson, payload = quadratic()
        return [("bare marker", S.lesson(), {"version": 4, "contract": V5_CONTRACT}),
                ("v4 plus marker", lesson, dict(copy.deepcopy(payload), contract=V5_CONTRACT)),
                ("v4 plus marker and selection", lesson, dict(copy.deepcopy(payload), contract=V5_CONTRACT,
                                                              selection={}))]

    def test_unflagged_v5_shaped_payloads_get_the_baseline_refusal(self):
        for name, lesson, payload in self.unflagged_payloads():
            with self.subTest(name=name):
                scope = S.scope(lesson)
                self.assertEqual(refusal_of(lambda: validate_source(lesson, payload, scope)), BASELINE_REFUSAL)
                self.assertEqual(refusal_of(lambda: validate_source(lesson, payload, scope, provider=True)),
                                 BASELINE_REFUSAL)
                self.assertEqual(refusal_of(lambda: validate_model(lesson, payload)), BASELINE_REFUSAL)
                self.assertFalse(runner._is_v5(payload))

    def test_render_job_refuses_an_unflagged_v5_source_before_any_step(self):
        for name, lesson, payload in self.unflagged_payloads():
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp) / "job"
                with patch.object(runner.subprocess, "run") as run:
                    outcome = refusal_of(lambda: runner.render_job(lesson, payload, work,
                                                                   skill_paths={"middle": tmp, "elementary": tmp}))
                self.assertEqual(outcome, BASELINE_REFUSAL)
                run.assert_not_called()
                self.assertFalse(work.exists())

    def test_the_flag_needs_the_marker(self):
        lesson, payload = quadratic()
        scope = S.scope(lesson)
        self.assertEqual(refusal_of(lambda: validate_source(lesson, payload, scope, contract=V5_CONTRACT))[0],
                         "SOURCE_SHAPE")
        self.assertEqual(refusal_of(lambda: validate_model(lesson, payload, contract=V5_CONTRACT))[0], "SOURCE_SHAPE")
        self.assertFalse(runner._is_v5(payload, contract=V5_CONTRACT))
        with tempfile.TemporaryDirectory() as tmp, patch.object(runner.subprocess, "run") as run:
            outcome = refusal_of(lambda: runner.render_job(lesson, payload, Path(tmp) / "job",
                                                           skill_paths={"middle": tmp}, contract=V5_CONTRACT))
            self.assertEqual(outcome[0], "SOURCE_SHAPE")
            run.assert_not_called()
        # A flagged call whose payload validation was skipped still never takes the v4 path.
        with tempfile.TemporaryDirectory() as tmp, patch.object(runner.subprocess, "run") as run, \
                patch.object(runner, "validate_model", return_value={"skill": "middle", "family": "general"}):
            outcome = refusal_of(lambda: runner.render_job(lesson, payload, Path(tmp) / "job",
                                                           skill_paths={"middle": tmp}, contract=V5_CONTRACT))
            self.assertEqual(outcome[0], "SOURCE_SHAPE")
            run.assert_not_called()

    def test_the_flag_needs_a_version_3_lesson(self):
        root = CONTAINER / "fixtures/grade7-positive"
        lesson = json.loads((root / "lesson.json").read_text(encoding="utf-8"))
        canonical = json.loads((root / "canonical.json").read_text(encoding="utf-8"))
        validate_model(lesson, canonical)
        self.assertEqual(refusal_of(lambda: validate_model(lesson, canonical, contract=V5_CONTRACT))[0],
                         "WIRE_SCOPE_UNSUPPORTED")

    def test_only_the_v5_contract_and_never_on_the_provider_path(self):
        lesson, payload = quadratic()
        scope = S.scope(lesson)
        for call in (lambda: validate_source(lesson, payload, scope, contract="worksheet-wire/4"),
                     lambda: validate_source(lesson, payload, scope, provider=True, contract=V5_CONTRACT),
                     lambda: validate_model(lesson, payload, contract="worksheet-wire/4"),
                     lambda: runner._is_v5({"version": 4, "contract": "worksheet-wire/4"},
                                           contract="worksheet-wire/4")):
            with self.assertRaises(ValueError) as caught:
                call()
            self.assertNotIsInstance(caught.exception, (GeneralSourceError, GenerationError))

    def test_only_the_compilers_set_the_flag(self):
        """Every `contract=` keyword in the app modules is a pass-through, except in the two modules that compile
        the source themselves (structured_source, v5_offline_render).

        Stage 4 wiring adds exactly one pass-through, remote_worker.author_and_render. Its value is bound only from
        the StructuredAuthored that structured_author returned with the compiled source (whose contract is the
        compiler's constant), and it reaches render_job only: never a literal, a payload field or another call."""
        setting, passing = {}, set()
        for path in sorted(S.APP.glob("*.py")):
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                if not isinstance(node, ast.Call):
                    continue
                for keyword in node.keywords:
                    if keyword.arg != "contract":
                        continue
                    value = keyword.value
                    through = (isinstance(value, ast.Name) and value.id == "contract") or (
                        isinstance(value, ast.Attribute) and value.attr == "contract"
                        and isinstance(value.value, ast.Name) and value.value.id == "args")
                    if through:
                        passing.add(path.name)
                    else:
                        setting.setdefault(path.name, []).append(ast.unparse(value))
        self.assertEqual(setting, {"structured_source.py": ["CONTRACT"],
                                   "v5_offline_render.py": ["CONTRACT", "CONTRACT"]})
        self.assertEqual(passing, {"general_adapters.py", "runner.py", "validation.py", "general_source.py",
                                   "remote_worker.py"})
        worker = ast.parse((S.APP / "remote_worker.py").read_text(encoding="utf-8"))
        stores = [node for node in ast.walk(worker)
                  if isinstance(node, ast.Name) and node.id == "contract" and isinstance(node.ctx, ast.Store)]
        self.assertEqual(len(stores), 1)
        self.assertFalse([node for node in ast.walk(worker) if isinstance(node, ast.arg) and node.arg == "contract"])
        bound = [ast.unparse(node) for node in ast.walk(worker) if isinstance(node, ast.Assign)
                 and any(stores[0] in ast.walk(target) for target in node.targets)]
        self.assertEqual(bound, ["source, contract = (structured.source, structured.contract)"])
        callers = [ast.unparse(node.func) for node in ast.walk(worker) if isinstance(node, ast.Call)
                   and any(keyword.arg == "contract" for keyword in node.keywords)]
        self.assertEqual(callers, ["render_job"])

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_the_compiled_ir_needs_the_flag_everywhere(self):
        lesson, scope, ir = S.lesson(), S.scope(), S.ir_good()
        self.assertEqual(refusal_of(lambda: validate_source(lesson, ir, scope)), BASELINE_REFUSAL)
        self.assertEqual(refusal_of(lambda: validate_model(lesson, ir)), BASELINE_REFUSAL)
        self.assertEqual(refusal_of(lambda: validate_source(lesson, ir, scope, contract=V5_CONTRACT)),
                         ("ACCEPTED", ""))
        self.assertEqual(validate_model(lesson, ir, contract=V5_CONTRACT)["skill"], "middle")
        self.assertFalse(runner._is_v5(ir))
        self.assertTrue(runner._is_v5(ir, contract=V5_CONTRACT))
        with tempfile.TemporaryDirectory() as tmp, patch.object(runner.subprocess, "run") as run:
            outcome = refusal_of(lambda: runner.render_job(lesson, ir, Path(tmp) / "job", skill_paths={"middle": tmp}))
            self.assertEqual(outcome, BASELINE_REFUSAL)
            run.assert_not_called()
            self.assertFalse((Path(tmp) / "job").exists())

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_the_adapter_needs_the_flag(self):
        lesson, scope, ir = S.lesson(), S.scope(), S.ir_good()
        env = {"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"}
        for argv, code, needle in (([], 1, "GeneralSourceError: " + BASELINE_REFUSAL[1]),
                                   (["--contract", "worksheet-wire/4"], 2, "invalid choice")):
            with self.subTest(argv=argv), tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp)
                for name, value in (("lesson.json", lesson), ("model-output.json", ir), ("curriculum-scope.json", scope)):
                    (work / name).write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
                done = subprocess.run([sys.executable, "-B", str(S.APP / "general_adapters.py"), "--skill",
                                       str(S.MIDDLE), "--work", str(work)] + argv, cwd=work, env=env,
                                      capture_output=True, text=True, timeout=300)
                self.assertEqual(done.returncode, code, done.stderr[-400:])
                self.assertIn(needle, done.stderr)
                self.assertFalse((work / "levels.json").exists())


# ------------------------------------------------------------------ (3) the exact Docker context

class ContainerContext(unittest.TestCase):
    @staticmethod
    def rules(path):
        return {line[1:] for line in path.read_text().splitlines()[1:] if line and not line.startswith("#")}

    def test_every_v5_module_is_in_the_exact_docker_context(self):
        files = set(json.loads((CONTAINER / "context-files.json").read_text())["files"])
        container, render = self.rules(CONTAINER / "Dockerfile.dockerignore"), self.rules(RENDER / "Dockerfile.dockerignore")
        for name in V5_MODULES:
            with self.subTest(module=name):
                path = "tools/teacher-generation/" + name
                self.assertTrue((S.APP / name).is_file())
                self.assertIn(path, files)
                self.assertIn(path, container)
                self.assertIn(path, render)

    def test_the_local_imports_of_the_context_are_in_the_context(self):
        """Every app module the image ships imports (or runs as HERE/'x.py') only app modules the image ships."""
        import re
        files = set(json.loads((CONTAINER / "context-files.json").read_text())["files"])
        local = {path.stem for path in S.APP.glob("*.py")}
        missing = []
        for name in sorted(files):
            if not name.endswith(".py") or "/tests/" in name or "/cloud/" in name:
                continue
            source = (S.APP.parents[1] / name).read_text(encoding="utf-8")
            used = set(re.findall(r"HERE\s*/\s*['\"]([A-Za-z_0-9]+)\.py['\"]", source))
            for node in ast.walk(ast.parse(source)):
                if isinstance(node, ast.Import):
                    used |= {alias.name.split(".")[0] for alias in node.names}
                elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                    used.add(node.module.split(".")[0])
            missing += [(name, module) for module in sorted(used & local)
                        if "tools/teacher-generation/%s.py" % module not in files]
        self.assertEqual(missing, [])


# ------------------------------------------------------------------ (4) the pinned report copy is never the verdict

class PinnedReportCopy(unittest.TestCase):
    def test_the_roles_say_which_file_is_the_verdict(self):
        import v5_offline_render as r
        self.assertEqual(r.VERDICT_FILE, "report.json")
        self.assertNotEqual(r.PINNED_REPORT, "v72-report.json")
        self.assertIn(("out/v72-report.json", r.PINNED_REPORT), r.COPIES)
        self.assertNotIn("v72-report.json", [target for _, target in r.COPIES])
        self.assertEqual(r.LEGACY_NAMES, ("v72-report.json",))
        self.assertTrue(r.FILE_ROLES["report.json"].startswith("AUTHORITATIVE"))
        self.assertIn("NOT the v5 verdict", r.FILE_ROLES[r.PINNED_REPORT])
        self.assertEqual([role for role in r.FILE_ROLES.values() if role.startswith("AUTHORITATIVE")],
                         [r.FILE_ROLES["report.json"]])

    def test_the_pinned_report_facts_and_stale_files(self):
        import v5_offline_render as r
        with tempfile.TemporaryDirectory() as tmp:
            work, out = Path(tmp) / "work", Path(tmp) / "out"
            (work / "out").mkdir(parents=True)
            out.mkdir()
            self.assertIsNone(r._pinned_report(work))
            raw = b'{"result": "PASS", "review": [], "steps": [], "gates": []}'
            (work / "out/v72-report.json").write_bytes(raw)
            self.assertEqual(r._pinned_report(work), {
                "file": "pinned-v72-report.raw.json", "copiedFrom": "out/v72-report.json",
                "sha256": hashlib.sha256(raw).hexdigest(), "pinnedResult": "PASS", "isVerdict": False,
                "verdictFile": "report.json", "note": r.FILE_ROLES[r.PINNED_REPORT]})
            (work / "out/v72-report.json").write_bytes(b"not json")
            self.assertEqual(r._pinned_report(work)["pinnedResult"], None)
            for name in ("v72-report.json", "sheet.pdf", "report.json", "page-1.png", "page-2.png", "notes.txt"):
                (out / name).write_bytes(b"x")
            self.assertEqual(r._stale(out, {"report.json", "sheet.pdf"}, out, ["page-1.png"]),
                             ["v72-report.json", "page-2.png"])
            (out / "pages").mkdir()
            (out / "pages/page-03.png").write_bytes(b"x")
            self.assertEqual(r._stale(out, {"report.json"}, out / "pages", []),
                             ["sheet.pdf", "v72-report.json", "pages/page-03.png"])

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_a_render_annotates_the_copy_and_never_deletes_a_stale_report(self):
        import pymupdf
        import v5_offline_render
        raw = json.dumps({"result": "PASS", "review": [], "steps": [], "gates": []}).encode("utf-8")
        seen = {}

        def render_job(lesson, ir, work, skill_paths=None, **kwargs):
            seen.update(kwargs)
            work = Path(work)
            (work / "out/deliver/b").mkdir(parents=True)
            (work / "logs").mkdir()
            document = pymupdf.open()
            document.new_page().insert_text((72, 72), "stub")
            document.save(str(work / "out/deliver/b/sheet.pdf"))
            document.close()
            (work / "out/v72-report.json").write_bytes(raw)
            (work / "logs/atom-order.json").write_text(json.dumps({"status": "PASS", "producer": "stub"}))
            manifest = {"status": "needs_review", "executedChecksPassed": True, "automatedChecksPassed": False,
                        "notRun": ["pinned:emit_docx"], "overlayReviewed": False, "overlayPendingReview": [],
                        "steps": [{"name": "trusted-adapter", "status": "PASS"}], "skill": {"name": "middle"}}
            (work / "manifest.json").write_text(json.dumps(manifest))
            return manifest

        with tempfile.TemporaryDirectory() as tmp:
            if " " in tmp:
                self.skipTest("The temporary folder contains a space")
            out = Path(tmp) / "out"
            (out / "case").mkdir(parents=True)
            legacy = b'{"result": "PASS", "note": "left by an earlier render"}'
            (out / "case/v72-report.json").write_bytes(legacy)
            (out / "case/page-9.png").write_bytes(b"old page")
            with patch.object(runner, "render_job", side_effect=render_job):
                summary = v5_offline_render.run(G7 / "lesson.json", G7 / "reply_good.json", out,
                                                work_dir=Path(tmp) / "work", skill_path=str(S.MIDDLE), dpi=20,
                                                case="case")
            folder = out / "case"
            report = json.loads((folder / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(seen.get("contract"), V5_CONTRACT)                 # the trusted flag reached render_job
            self.assertEqual((report["authoritative"], report["verdictFile"], summary["verdictFile"]),
                             (True, "report.json", "report.json"))
            self.assertEqual(report["fileRoles"], v5_offline_render.FILE_ROLES)
            self.assertEqual((folder / "pinned-v72-report.raw.json").read_bytes(), raw)    # a byte copy
            self.assertEqual(report["pinnedReport"], {
                "file": "pinned-v72-report.raw.json", "copiedFrom": "out/v72-report.json",
                "sha256": hashlib.sha256(raw).hexdigest(), "pinnedResult": "PASS", "isVerdict": False,
                "verdictFile": "report.json", "note": v5_offline_render.FILE_ROLES["pinned-v72-report.raw.json"]})
            self.assertIs(report["verdict"]["automatedChecksPassed"], False)
            self.assertEqual(report["staleFiles"], ["v72-report.json", "page-9.png"])
            self.assertEqual((folder / "v72-report.json").read_bytes(), legacy)         # recorded, not deleted
            self.assertEqual(report["pages"], ["page-1.png"])

    @unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")
    def test_a_compile_failure_records_the_outputs_of_an_earlier_render_as_stale(self):
        import v5_offline_render
        reply = load_g7("reply_with_failures.json")
        reply["questions"] = [q for q in reply["questions"] if not q["slot"].startswith("R")]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "reply.json"
            path.write_text(json.dumps(reply, ensure_ascii=False), encoding="utf-8")
            folder = Path(tmp) / "out/short"
            folder.mkdir(parents=True)
            for name in ("sheet.pdf", "pinned-v72-report.raw.json", "page-1.png"):
                (folder / name).write_bytes(b"earlier render")
            summary = v5_offline_render.run(G7 / "lesson.json", path, Path(tmp) / "out", case="short",
                                            skill_path=str(S.MIDDLE))
            self.assertEqual(summary, {"status": "compile_failed", "code": "SHEET_BELOW_MINIMUM"})
            report = json.loads((folder / "report.json").read_text(encoding="utf-8"))
            self.assertEqual((report["authoritative"], report["verdictFile"], report["pinnedReport"]),
                             (True, "report.json", None))
            self.assertEqual(report["staleFiles"], ["pinned-v72-report.raw.json", "sheet.pdf", "page-1.png"])
            self.assertEqual((folder / "sheet.pdf").read_bytes(), b"earlier render")


if __name__ == "__main__":
    unittest.main()
