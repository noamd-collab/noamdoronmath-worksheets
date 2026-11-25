"""structured_author, the TEACHER_V5_TOPICS route and the worker's v5 path, with a fake provider (no network).

provider.request_author_json is replaced by a scripted fake: it records every request and plays replies, HTTP
errors or unusable replies in order. Nothing calls a model, nothing deploys. The provider golden
(golden/provider-golden.json) was recorded by fixtures/v5/make_provider_golden.py at 515ebd5a, before the route
existed.
"""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import provider  # noqa: E402
import remote_worker as worker  # noqa: E402
import structured_author as sa  # noqa: E402
import structured_contract as contract  # noqa: E402
from test_remote_worker import FakeRemote, JOB_ID, LEASE, TEACHER_A  # noqa: E402
from validation import GenerationError  # noqa: E402

CONFIG = {"api_key": "unit-key", "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
          "model": "qwen-unit"}
USAGE = {"prompt_tokens": 1200, "completion_tokens": 800, "total_tokens": 2000}
TEACHER_TEXT = "PRIVATE_TEACHER_CONTEXT למדנו כינוס איברים"
NEEDS = unittest.skipUnless(S.MIDDLE_PINNED, "Pinned middle skill unavailable")


class Http:
    def __init__(self, status):
        self.status = status


class Fail:
    def __init__(self, code):
        self.code = code


class Clock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


class FakeProvider:
    """Scripted stand-in for provider.request_author_json; ``advance`` moves a fake clock per call."""

    def __init__(self, *script, clock=None, advance=()):
        self.script, self.calls, self.clock, self.advance = list(script), [], clock, list(advance)

    def __call__(self, target, key, body, measured, timeout):
        self.calls.append({"target": target, "key": key, "body": copy.deepcopy(body), "timeout": timeout})
        if self.clock is not None and self.advance:
            self.clock.now += self.advance.pop(0)
        step = self.script.pop(0)
        if isinstance(step, Http):
            measured["httpStatus"] = step.status
            raise GenerationError("PROVIDER_HTTP_ERROR", "Provider returned HTTP %d; body omitted" % step.status)
        measured["responseReceived"] = True
        measured["usage"] = dict(USAGE)
        measured["responseModel"] = "qwen-unit-2026"
        if isinstance(step, Fail):
            raise GenerationError(step.code, "Provider response did not match the expected JSON envelope")
        return copy.deepcopy(step)


def lesson():
    out = S.lesson()
    out["lastLesson"] = TEACHER_TEXT
    return out


def by_slot(reply):
    return {question["slot"]: question for question in reply["questions"]}


def reserves_run_out():
    """The good reply without practice reserves R1-R4, Q9 and Q14 given good items: Q4 (refused for
    ITEM_COUNT and TEMPLATE_MISMATCH) has no reserve left, so the sheet is below the floor until a repair."""
    good = by_slot(S.reply())
    questions = [q for q in S.reply()["questions"] if q["slot"] not in ("R1", "R2", "R3", "R4")]
    for question in questions:
        if question["slot"] == "Q9":
            question["items"] = copy.deepcopy(good["R2"]["items"])
        if question["slot"] == "Q14":
            question["items"] = copy.deepcopy(good["R3"]["items"])
    return {"questions": questions}


def author(fake, *, clock=None, **kwargs):
    metadata = {}
    with patch.object(provider, "request_author_json", fake):
        if clock is not None:
            with patch.object(sa, "_clock", clock):
                result = _author(metadata, **kwargs)
        else:
            result = _author(metadata, **kwargs)
    return result, metadata


def _author(metadata, **kwargs):
    try:
        return sa.author_structured_lesson(lesson(), metadata=metadata, skill_path=str(S.MIDDLE),
                                           **dict(CONFIG, timeout=300, **kwargs))
    except sa.StructuredAuthorError as exc:
        return exc


def messages(call):
    return call["body"]["messages"]


def user_of(call):
    return json.loads(messages(call)[1]["content"])


@NEEDS
class Authoring(unittest.TestCase):
    def assert_private(self, metadata):
        text = json.dumps(metadata, ensure_ascii=False)
        self.assertIsNone(re.search(r"[א-ת]", text))
        self.assertNotIn("PRIVATE_", text)
        self.assertNotIn("AUTHORING CARD", text)
        for question in S.reply()["questions"]:
            for item in question["items"]:
                for field in ("expr", "expr2", "values"):
                    if re.search(r"[0-9+\-=]", item[field]):
                        self.assertNotIn('"%s"' % item[field], text)

    def test_good_reply_delivers_twenty_of_twenty_in_one_call(self):
        fake = FakeProvider(S.reply())
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthored)
        self.assertEqual(result.contract, "worksheet-wire/5")
        self.assertEqual(result.source, S.ir_good())
        selection = result.source["selection"]
        self.assertEqual((selection["requested"], selection["delivered"]), (20, 20))
        self.assertEqual(len(fake.calls), 1)
        record = metadata["structured"]
        self.assertEqual(record["outcome"], "delivered")
        self.assertEqual(record["selection"], {"requested": 20, "delivered": 20, "replaced": selection["replaced"],
                                               "dropped": []})
        self.assertEqual([call["purpose"] for call in record["calls"]], ["author"])
        self.assertEqual(record["calls"][0]["finishReason"], "stop")
        self.assertEqual(record["calls"][0]["usage"], USAGE)
        self.assertIsInstance(record["calls"][0]["ms"], int)
        self.assertEqual(record["repairRounds"], 0)
        self.assertEqual(record["authorContract"], "worksheet-wire/5")
        self.assertTrue(record["refusals"] and all(set(r) == {"slot", "item", "field", "code"}
                                                   for r in record["refusals"]))
        card = contract.authoring_card(S.lesson(), S.scope(), S.overlay())
        planned, reserves = sa.structured_source.plan_slots(S.lesson(), S.scope(), S.overlay())
        schema = contract.wire_schema(S.lesson(), S.scope(), S.overlay(), len(reserves))
        self.assertEqual(record["cardSha256"], hashlib.sha256(card.encode()).hexdigest())
        self.assertEqual(record["schemaSha256"], hashlib.sha256(json.dumps(schema, sort_keys=True, separators=(
            ",", ":"), ensure_ascii=False).encode()).hexdigest())
        self.assertEqual((metadata["authorContract"], metadata["validated"], metadata["providerCalled"],
                          metadata["responseReceived"], metadata["usage"]),
                         ("worksheet-wire/5", True, True, True, USAGE))
        self.assert_private(metadata)

    def test_request_carries_card_and_teacher_data_and_the_schema_only_in_response_format(self):
        fake = FakeProvider(S.reply())
        author(fake)
        body = fake.calls[0]["body"]
        card = contract.authoring_card(S.lesson(), S.scope(), S.overlay())
        _, reserves = sa.structured_source.plan_slots(S.lesson(), S.scope(), S.overlay())
        schema = contract.wire_schema(S.lesson(), S.scope(), S.overlay(), len(reserves))
        self.assertEqual(body["response_format"], {"type": "json_schema", "json_schema": {
            "name": "worksheet_wire_v5", "strict": True, "schema": schema}})
        self.assertEqual(contract.schema_problems(schema), [])
        self.assertEqual((body["max_tokens"], body["temperature"], body["enable_thinking"]), (16000, 0.25, False))
        self.assertEqual(messages(fake.calls[0])[0], {"role": "system", "content": card})
        user = user_of(fake.calls[0])
        self.assertEqual(user["teacherContext"]["lastLesson"], TEACHER_TEXT)
        for message in messages(fake.calls[0]):
            self.assertNotIn("additionalProperties", message["content"])
            self.assertNotIn('"properties"', message["content"])
        self.assertEqual(fake.calls[0]["timeout"], 300)
        self.assertEqual(fake.calls[0]["target"],
                         "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions")

    def test_reserves_run_out_and_the_round_one_targeted_repair_fills_the_slot(self):
        repair = S.load("repair-g7-round1.json")
        fake = FakeProvider(reserves_run_out(), repair)
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthored)
        selection = result.source["selection"]
        self.assertEqual(selection["delivered"], 20)
        self.assertIn({"slot": "Q4", "by": "REPAIR", "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]},
                      selection["replaced"])
        self.assertEqual(len(fake.calls), 2)
        body = fake.calls[1]["body"]
        self.assertEqual((body["temperature"], body["max_tokens"], body["enable_thinking"]), (0.15, 1050, False))
        schema = body["response_format"]["json_schema"]["schema"]
        self.assertEqual(contract.schema_problems(schema), [])
        self.assertEqual(schema["required"], ["Q4"])
        self.assertEqual(schema["properties"]["Q4"]["properties"]["slot"]["enum"], ["Q4"])
        self.assertEqual(schema["properties"]["Q4"]["properties"]["kind"]["enum"], ["write_from_words"])
        self.assertEqual(messages(fake.calls[1])[0], messages(fake.calls[0])[0])      # the same card
        user = user_of(fake.calls[1])
        self.assertEqual(len(user["slots"]), 1)
        slot = user["slots"][0]
        self.assertTrue(slot["plan"].startswith("Q4 | practice | "))
        self.assertTrue(slot["plan"].endswith(" | write_from_words"))
        self.assertEqual(slot["codes"], ["ITEM_COUNT", "TEMPLATE_MISMATCH"])
        self.assertEqual(slot["refused"], by_slot(S.reply())["Q4"])                    # model output only
        self.assertEqual(user["fixes"], {code: contract.repair_instruction(code)
                                         for code in ("ITEM_COUNT", "TEMPLATE_MISMATCH")})
        self.assertNotIn("teacherContext", user)
        self.assertNotIn(TEACHER_TEXT, json.dumps(body, ensure_ascii=False))
        record = metadata["structured"]
        self.assertEqual([call["purpose"] for call in record["calls"]], ["author", "repair_targeted"])
        self.assertEqual(record["calls"][1]["slots"], 1)
        self.assertEqual(record["repairRounds"], 1)
        self.assertEqual(metadata["usage"], {key: 2 * value for key, value in USAGE.items()})
        self.assert_private(metadata)

    def test_a_refused_question_over_two_kilobytes_is_not_sent_back(self):
        reply = reserves_run_out()
        q4 = by_slot(reply)["Q4"]
        q4["intro"] = "א" * 300                                  # model output, refused, now over 2 KB
        q4["items"][0]["text"] = "ב" * 200
        q4["items"][1]["text"] = "ג" * 200
        q4["items"][2]["text"] = "ד" * 200
        self.assertGreater(len(json.dumps(q4, ensure_ascii=False, separators=(",", ":")).encode()), 2048)
        fake = FakeProvider(reply, S.load("repair-g7-round1.json"))
        result, _ = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthored)
        slot = user_of(fake.calls[1])["slots"][0]
        self.assertNotIn("refused", slot)
        self.assertIn("FIELD_NOT_EMPTY", slot["codes"])

    def test_round_two_is_fresh_and_three_calls_is_the_hard_limit(self):
        fake = FakeProvider(reserves_run_out(), {}, {"Q4": {"slot": "Q4"}}, S.reply())
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthorError)
        self.assertEqual(result.code, "SHEET_BELOW_MINIMUM")
        self.assertEqual(result.failure_detail, {"stage": "compile", "questions": ["Q4"]})
        self.assertEqual(len(fake.calls), 3)
        self.assertEqual(len(fake.script), 1)                                           # never a fourth call
        fresh = user_of(fake.calls[2])
        self.assertEqual(fresh["slots"], [{"plan": user_of(fake.calls[1])["slots"][0]["plan"],
                                           "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]}])
        self.assertNotIn("fixes", fresh)
        self.assertEqual(messages(fake.calls[2])[0], messages(fake.calls[0])[0])
        self.assertEqual(fake.calls[2]["body"]["temperature"], 0.15)
        record = metadata["structured"]
        self.assertEqual([call["purpose"] for call in record["calls"]], ["author", "repair_targeted", "repair_fresh"])
        self.assertEqual((record["outcome"], record["code"], record["stage"], record["repairRounds"]),
                         ("failed", "SHEET_BELOW_MINIMUM", "compile", 2))
        self.assertEqual(record["questions"], ["Q4"])
        self.assertEqual(record["selection"]["delivered"], 19)
        self.assertFalse(metadata["validated"])
        self.assert_private(metadata)

    def test_round_two_codes_include_the_refused_round_one_candidate(self):
        bad = copy.deepcopy(S.load("repair-g7-round1.json"))
        bad["Q4"]["items"][0]["expr"] = "2(x+1)"
        fake = FakeProvider(reserves_run_out(), bad, S.load("repair-g7-round1.json"))
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthored)
        codes = user_of(fake.calls[2])["slots"][0]["codes"]
        self.assertTrue({"ITEM_COUNT", "TEMPLATE_MISMATCH"} < set(codes))
        self.assertEqual(metadata["structured"]["repairRounds"], 2)

    def test_unusable_first_reply_turns_round_one_into_a_full_reauthor(self):
        for name, first in (("no json", Fail("PROVIDER_INVALID_RESPONSE")), ("duplicate key", Fail("INVALID_MODEL_OUTPUT")),
                            ("truncated", Fail("PROVIDER_INCOMPLETE")), ("wrong root", {"sheet": []}),
                            ("no slot parsed", {"questions": [{"slot": "Z1"}, {"kind": "x"}]})):
            with self.subTest(name):
                fake = FakeProvider(first, S.reply())
                result, metadata = author(fake)
                self.assertIsInstance(result, sa.StructuredAuthored)
                self.assertEqual(result.source, S.ir_good())
                self.assertEqual(len(fake.calls), 2)
                self.assertEqual(fake.calls[1]["body"], fake.calls[0]["body"])          # the same author request
                record = metadata["structured"]
                self.assertEqual([call["purpose"] for call in record["calls"]], ["author", "reauthor"])
                self.assertTrue(record["reauthored"])
                self.assertEqual(record["repairRounds"], 1)
                if name == "truncated":
                    self.assertEqual(record["calls"][0]["finishReason"], "incomplete")
                self.assert_private(metadata)

    def test_after_a_reauthor_only_the_fresh_round_is_left(self):
        fake = FakeProvider({"questions": [{"slot": "Q99"}]}, reserves_run_out(), S.load("repair-g7-round1.json"))
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthored)
        self.assertEqual([call["purpose"] for call in metadata["structured"]["calls"]],
                         ["author", "reauthor", "repair_fresh"])
        self.assertNotIn("fixes", user_of(fake.calls[2]))
        self.assertNotIn("refused", user_of(fake.calls[2])["slots"][0])

    def test_two_unusable_replies_fail_without_a_third_call(self):
        fake = FakeProvider({"questions": []}, Fail("PROVIDER_INVALID_RESPONSE"), S.reply())
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthorError)
        self.assertEqual(result.code, "PROVIDER_INVALID_RESPONSE")
        self.assertEqual(result.failure_detail, {"stage": "author", "questions": []})
        self.assertEqual(len(fake.calls), 2)

    def test_http_400_fails_once_with_the_status_and_its_class(self):
        fake = FakeProvider(Http(400), S.reply())
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthorError)
        self.assertIsInstance(result, GenerationError)
        self.assertEqual(result.code, "PROVIDER_HTTP_ERROR")
        self.assertEqual(result.failure_detail, {"stage": "author", "questions": [], "httpStatus": 400})
        self.assertEqual(len(fake.calls), 1)
        call = metadata["structured"]["calls"][0]
        self.assertEqual((call["code"], call["httpStatus"], call["httpClass"]),
                         ("PROVIDER_HTTP_ERROR", 400, "bad_request"))
        self.assertNotIn("finishReason", call)
        self.assertEqual(metadata["structured"]["outcome"], "failed")
        self.assertEqual(metadata["structured"]["stage"], "author")
        self.assertTrue(metadata["providerCalled"])
        self.assert_private(metadata)

    def test_http_classes(self):
        self.assertEqual([sa.http_error_class(s) for s in (400, 401, 403, 404, 429, 500, 503, 504, 418)],
                         ["bad_request", "credential_rejected", "credential_rejected", "model_not_found",
                          "rate_limited", "server_error", "unavailable", "server_error", "http_error"])

    def test_an_http_error_in_a_repair_keeps_nothing_it_cannot_deliver(self):
        fake = FakeProvider(reserves_run_out(), Http(503))
        result, metadata = author(fake)
        self.assertEqual((result.code, result.failure_detail),
                         ("PROVIDER_HTTP_ERROR", {"stage": "repair", "questions": ["Q4"], "httpStatus": 503}))
        self.assertEqual(len(fake.calls), 2)
        self.assertEqual(metadata["structured"]["calls"][1]["httpClass"], "unavailable")

    def test_no_call_starts_inside_the_last_120_seconds(self):
        clock = Clock()
        fake = FakeProvider(S.reply())
        result, metadata = author(fake, clock=clock, deadline=clock.now + 119)
        self.assertEqual((result.code, result.failure_detail), ("AUTHOR_DEADLINE", {"stage": "author",
                                                                                    "questions": []}))
        self.assertEqual(fake.calls, [])
        self.assertFalse(metadata["providerCalled"])

    def test_the_deadline_stops_repairs_and_bounds_every_timeout(self):
        clock = Clock()
        # The author call takes 500 s of a 720 s budget: the repair starts with 220 s left (timeout 200), takes
        # 150 s, and with 70 s left no second round starts although Q4 is still empty.
        fake = FakeProvider(reserves_run_out(), {}, S.reply(), clock=clock, advance=(500, 150))
        result, metadata = author(fake, clock=clock, deadline=clock.now + 720)
        self.assertEqual(result.code, "SHEET_BELOW_MINIMUM")
        self.assertEqual([call["timeout"] for call in fake.calls], [300, 200])
        self.assertEqual(metadata["structured"]["repairSkipped"], "deadline")
        self.assertEqual(metadata["structured"]["repairRounds"], 1)
        # A shorter budget clips the repair timeout to the time left.
        clock = Clock()
        fake = FakeProvider(reserves_run_out(), S.load("repair-g7-round1.json"), clock=clock, advance=(280, 10))
        result, metadata = author(fake, clock=clock, deadline=clock.now + 450)
        self.assertIsInstance(result, sa.StructuredAuthored)
        self.assertEqual([call["timeout"] for call in fake.calls], [300, 170])
        self.assertEqual([call["timeoutSeconds"] for call in metadata["structured"]["calls"]], [300, 170])
        # A configured repair timeout is honoured.
        fake = FakeProvider(reserves_run_out(), S.load("repair-g7-round1.json"))
        result, _ = author(fake, repair_timeout=90)
        self.assertEqual([call["timeout"] for call in fake.calls], [300, 90])

    def test_unreviewed_or_unconfigured_lessons_never_call(self):
        fake = FakeProvider(S.reply())
        with patch.object(provider, "request_author_json", fake):
            for name, change, code in (("level", {"level": "a"}, "WIRE_TOPIC_UNSUPPORTED"),):
                with self.subTest(name):
                    with self.assertRaises(sa.StructuredAuthorError) as caught:
                        sa.author_structured_lesson(dict(lesson(), **change), skill_path=str(S.MIDDLE), **CONFIG)
                    self.assertEqual(caught.exception.code, code)
            with patch.dict(os.environ, {}, clear=True), self.assertRaises(sa.StructuredAuthorError) as caught:
                sa.author_structured_lesson(lesson(), skill_path=str(S.MIDDLE))
            self.assertEqual(caught.exception.code, "PROVIDER_NOT_CONFIGURED")
            g9r = S.load("g9r_probability/lesson.json")
            self.assertFalse(sa.route_enabled(g9r))
            self.assertFalse(sa.route_enabled(S.load("d10/lesson.json")))
            self.assertTrue(sa.route_enabled(S.lesson()))
            with self.assertRaises(sa.StructuredAuthorError) as caught:
                sa.author_structured_lesson(g9r, skill_path=str(S.MIDDLE), **CONFIG)
            self.assertEqual(caught.exception.code, "WIRE_TOPIC_UNSUPPORTED")
        self.assertEqual(fake.calls, [])

    def test_a_structured_result_holds_only_the_compiler_contract(self):
        with self.assertRaises(ValueError):
            sa.StructuredAuthored(S.ir_good(), "worksheet-wire/4")
        with self.assertRaises(ValueError):
            sa.StructuredAuthored(dict(S.ir_good(), contract="other"), "worksheet-wire/5")
        self.assertEqual(sa.CONTRACT, sa.structured_source.CONTRACT)


class RepairInstructions(unittest.TestCase):
    def test_every_slot_code_has_one_fixed_lint_clean_instruction(self):
        codes = {code for group in contract.REPAIR_GROUPS for code in contract.CODE_GROUPS[group]
                 if not code.startswith("SOURCE_")}
        self.assertEqual(codes - set(contract.REPAIR_INSTRUCTIONS), set())
        self.assertEqual(set(contract.REPAIR_INSTRUCTIONS) - contract.CODES, set())
        for code in list(contract.REPAIR_INSTRUCTIONS) + ["KERNEL_INVALID_AST", "SHEET_STARS", "NOT A CODE"]:
            text = contract.repair_instruction(code)
            self.assertTrue(text.isascii() and 0 < len(text) <= 160, code)
            self.assertFalse(any(mark in text for mark in contract.CARD_FORBIDDEN), code)
            self.assertIsNone(re.search(r"[0-9]", text), code)
        self.assertEqual(contract.repair_instruction("KERNEL_INVALID_AST"), contract.REPAIR_KERNEL_INSTRUCTION)
        self.assertEqual(contract.repair_instruction("SHEET_STARS"), contract.REPAIR_DEFAULT_INSTRUCTION)


def run_golden():
    with tempfile.TemporaryDirectory() as out:
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", MIDDLE_SKILL_PATH=str(S.MIDDLE),
                   ELEMENTARY_SKILL_PATH=str(S.ELEMENTARY))
        env.pop("TEACHER_V5_TOPICS", None)
        path = Path(out) / "provider-golden.json"
        done = subprocess.run([sys.executable, "-B", str(S.FIXTURES / "make_provider_golden.py"), "--app", str(S.APP),
                               "--out", str(path)], env=env, capture_output=True, text=True, timeout=600)
        if done.returncode != 0:
            raise AssertionError("make_provider_golden failed: " + done.stderr[-800:])
        return path.read_bytes()


class Routing(unittest.TestCase):
    @unittest.skipUnless(S.MIDDLE_PINNED and S.ELEMENTARY_PINNED, "Pinned skills unavailable")
    def test_flag_off_and_unrouted_provider_paths_are_byte_identical_to_the_baseline(self):
        expected = (S.FIXTURES / "golden/provider-golden.json").read_bytes()
        cases = json.loads(expected)["cases"]
        self.assertEqual({name: case["env"] for name, case in cases.items()}, {
            "v3-g7-unset": None, "v3-g7-empty": "", "v3-g7-other-topics": "g7:equations, g9r:probability",
            "v3-g7-level-not-enabled": "g7:algebraic_expressions", "v3-g9r-unreviewed-listed": "g9r:probability",
            "v3-d10-unreviewed-listed": "ד10", "v2-elementary-listed": "ג10"})
        self.assertTrue(all(case["metadata"]["authorContract"] != "worksheet-wire/5" for case in cases.values()))
        produced = run_golden()
        self.assertEqual(json.loads(produced), json.loads(expected))
        self.assertEqual(produced, expected)

    @NEEDS
    def test_the_route_imports_no_v5_author_while_the_list_is_empty(self):
        source = (S.APP / "provider.py").read_text(encoding="utf-8")
        self.assertNotIn("import structured", source.split("def author_lesson")[0])
        probe = ("import json, sys\nsys.path.insert(0, sys.argv[1])\nfrom unittest.mock import patch\nimport provider\n"
                 "import remote_worker\nfrom validation import GenerationError\n"
                 "def fake(target, key, body, measured, timeout):\n"
                 "    raise GenerationError('PROVIDER_HTTP_ERROR', 'Provider returned HTTP 418; body omitted')\n"
                 "lesson = json.loads(open(sys.argv[2], encoding='utf-8').read())\n"
                 "with patch.object(provider, 'request_author_json', fake):\n"
                 "    try:\n        provider.author_lesson(lesson, api_key='k', base_url=sys.argv[3], model='m')\n"
                 "    except GenerationError as exc:\n        code = exc.code\n"
                 "print(json.dumps([code, sorted(m for m in sys.modules if m in ('structured_author', 'structured_source'))]))\n")
        for flag in (None, "", "g7:equations"):
            with self.subTest(flag=flag):
                env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", MIDDLE_SKILL_PATH=str(S.MIDDLE))
                env.pop("TEACHER_V5_TOPICS", None)
                if flag is not None:
                    env["TEACHER_V5_TOPICS"] = flag
                done = subprocess.run([sys.executable, "-B", "-c", probe, str(S.APP),
                                       str(S.FIXTURES / "lesson-g7-algebraic-expressions.json"), CONFIG["base_url"]],
                                      env=env, capture_output=True, text=True, timeout=300)
                self.assertEqual(done.returncode, 0, done.stderr[-600:])
                self.assertEqual(json.loads(done.stdout), ["PROVIDER_HTTP_ERROR", []])

    @NEEDS
    def test_flag_on_with_the_reviewed_overlay_takes_the_structured_path(self):
        fake = FakeProvider(S.reply())
        metadata = {}
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": " g7:equations , g7:algebraic_expressions ",
                                     "MIDDLE_SKILL_PATH": str(S.MIDDLE)}), \
                patch.object(provider, "request_author_json", fake):
            result = provider.author_lesson(lesson(), metadata=metadata, timeout=300, **CONFIG)
        self.assertIsInstance(result, sa.StructuredAuthored)
        self.assertEqual(result.source["selection"]["delivered"], 20)
        self.assertEqual(metadata["authorContract"], "worksheet-wire/5")
        self.assertEqual(fake.calls[0]["timeout"], 300)
        self.assertEqual(fake.calls[0]["body"]["response_format"]["json_schema"]["name"], "worksheet_wire_v5")

    @NEEDS
    def test_flag_on_but_overlay_unreviewed_keeps_the_old_path(self):
        lesson9 = S.load("g9r_probability/lesson.json")
        fake = FakeProvider(Http(418))
        metadata = {}
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": "g9r:probability", "MIDDLE_SKILL_PATH": str(S.MIDDLE)}), \
                patch.object(provider, "request_author_json", fake), \
                patch.object(sa, "author_structured_lesson", side_effect=AssertionError("v5 route taken")):
            with self.assertRaises(GenerationError) as caught:
                provider.author_lesson(lesson9, metadata=metadata, **CONFIG)
        self.assertEqual(caught.exception.code, "PROVIDER_HTTP_ERROR")
        self.assertNotIsInstance(caught.exception, sa.StructuredAuthorError)
        self.assertEqual(metadata["authorContract"], "worksheet-source/4")
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(fake.calls[0]["body"]["max_tokens"], 40000)


# ------------------------------------------------------------------ the worker's v5 path

def v5_manifest(target, *, review=False, extra=False, status="needs_review"):
    target.mkdir(parents=True, exist_ok=True)
    (target / "out/deliver/b").mkdir(parents=True)
    blob = b"%PDF synthetic v5"
    (target / "out/deliver/b/sheet.pdf").write_bytes(blob)
    artifacts = [{"path": "out/deliver/b/sheet.pdf", "sha256": hashlib.sha256(blob).hexdigest(), "bytes": len(blob),
                  "kind": "pdf"}]
    if extra:
        (target / "sheet.docx").write_bytes(b"docx")
        artifacts.append({"path": "sheet.docx", "sha256": hashlib.sha256(b"docx").hexdigest(), "bytes": 4,
                          "kind": "docx"})
    steps = [{"name": "trusted-adapter", "status": "PASS"}, {"name": "middle-build", "status": "PASS"},
             {"name": "pinned:emit_docx", "status": "SKIP"},
             {"name": "pinned:check_didactic", "status": "REVIEW" if review else "PASS"},
             {"name": "atom-order", "status": "PASS"}]
    return {"version": 1, "status": status, "executedChecksPassed": status == "needs_review",
            "automatedChecksPassed": False, "renderingChecksPassed": False, "notRun": ["pinned:emit_docx"],
            "authorContract": "worksheet-wire/5", "authoringProfile": "general-skill-source/v1",
            "skill": {"name": "middle", "version": "7.2.0-noam", "sha256": "b" * 64}, "steps": steps,
            "artifacts": artifacts if status == "needs_review" else [], "debug": "PRIVATE local path"}


class WorkerPath(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.job = {"id": JOB_ID, "owner_id": TEACHER_A, "lease_token": LEASE, "status": "running",
                    "lease_until": (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat(),
                    "lesson": S.lesson()}
        self.remote = FakeRemote()
        self.structured = sa.StructuredAuthored({"contract": "worksheet-wire/5", "selection": {
            "requested": 20, "floor": 20, "delivered": 20,
            "replaced": [{"slot": "Q4", "by": "R1", "codes": ["ITEM_COUNT"]}], "dropped": []}}, "worksheet-wire/5")

    def author(self, lesson, *, metadata, **options):
        metadata.update(authorContract="worksheet-wire/5", providerCalled=True, responseReceived=True,
                        validated=True, structured={"calls": [{"purpose": "author", "ms": 5, "usage": USAGE}]})
        return self.structured

    def test_v5_render_gets_the_trusted_flag_and_only_the_pdf_is_uploaded(self):
        seen = []

        def render(lesson, payload, target, **kwargs):
            seen.append((payload, kwargs))
            return v5_manifest(target)
        with patch.object(worker, "author_lesson", side_effect=self.author), \
                patch.object(worker, "render_job", side_effect=render):
            worker.process_job(self.remote, self.job, self.root)
        self.assertEqual(seen, [(self.structured.source, {"contract": "worksheet-wire/5"})])
        uploads = self.remote.uploads()
        self.assertEqual([call[0] for call in uploads],
                         ["/storage/v1/object/teacher-generation-private/%s/%s/sheet.pdf" % (TEACHER_A, JOB_ID)])
        self.assertEqual(uploads[0][3]["mime"], "application/pdf")
        completion = [call for call in self.remote.calls if call[1] == "PATCH"][-1][2]
        self.assertEqual(completion["status"], "needs_review")
        result = completion["result"]
        self.assertEqual(set(result), {"version", "automatedChecksPassed", "humanReviewRequired", "skill",
                                       "artifacts", "checks", "authoringProfile", "authorContract",
                                       "renderingChecksPassed", "notRun", "questionsRequested",
                                       "questionsDelivered", "replaced"})
        self.assertEqual([a["kind"] for a in result["artifacts"]], ["pdf"])
        self.assertIs(result["automatedChecksPassed"], False)
        self.assertEqual((result["questionsRequested"], result["questionsDelivered"]), (20, 20))
        self.assertEqual(result["replaced"], [{"slot": "Q4", "by": "R1", "codes": ["ITEM_COUNT"]}])
        self.assertEqual(result["notRun"], ["pinned:emit_docx"])
        self.assertNotIn("PRIVATE", json.dumps(result))
        record = json.loads((self.root / "author-diagnostics" / (JOB_ID + ".json")).read_text())
        self.assertEqual(record["authorContract"], "worksheet-wire/5")
        self.assertEqual(record["structured"]["calls"], [{"purpose": "author", "usage": USAGE, "ms": 5}])

    def failed_line(self, render=None, author=None):
        self.remote.claims = [self.job]
        with patch.object(sys, "argv", ["worker", "--once", "--work-dir", str(self.root)]), \
                patch.object(worker, "check_readiness", return_value={"ready": True}), \
                patch.object(worker, "Remote", return_value=self.remote), \
                patch.object(worker, "author_lesson", side_effect=author or self.author), \
                patch.object(worker, "render_job", side_effect=render), redirect_stdout(io.StringIO()) as output:
            worker.main()
        self.assertEqual(self.remote.uploads(), [])
        self.assertFalse(any(call[2].get("status") == "needs_review" for call in self.remote.calls
                             if call[1] == "PATCH"))
        return json.loads(output.getvalue())

    def test_review_extra_artifacts_or_a_failed_render_are_refused_with_one_log_line(self):
        def raised(lesson, payload, target, **kwargs):
            raise GenerationError("SOURCE_SHAPE", "PRIVATE detail")
        for name, render, stage in (
                ("review", lambda lesson, payload, target, **kw: v5_manifest(target, review=True), "acceptance"),
                ("docx", lambda lesson, payload, target, **kw: v5_manifest(target, extra=True), "acceptance"),
                ("failed", lambda lesson, payload, target, **kw: v5_manifest(target, status="failed"), "render"),
                ("raised", raised, "render")):
            with self.subTest(name):
                self.root = Path(tempfile.mkdtemp(dir=self.temp.name)).resolve()
                self.remote = FakeRemote()
                event = self.failed_line(render)
                code = "SOURCE_SHAPE" if name == "raised" else "QUALITY_GATE_FAILED"
                self.assertEqual(event, {"event": "generation_failed", "jobId": JOB_ID, "code": code,
                                         "stage": stage, "questions": []})

    @NEEDS
    def test_http_400_from_the_real_route_logs_status_and_stage_without_text(self):
        fake = FakeProvider(Http(400))
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "MIDDLE_SKILL_PATH": str(S.MIDDLE),
                                     "QWEN_API_KEY": "unit-key", "QWEN_BASE_URL": CONFIG["base_url"],
                                     "QWEN_MODEL": "qwen-unit"}), patch.object(provider, "request_author_json", fake):
            event = self.failed_line(render=AssertionError("no render"), author=worker.author_lesson)
        self.assertEqual(event, {"event": "generation_failed", "jobId": JOB_ID, "code": "PROVIDER_HTTP_ERROR",
                                 "stage": "author", "questions": [], "httpStatus": 400})
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(fake.calls[0]["timeout"], 300)
        record = json.loads((self.root / "author-diagnostics" / (JOB_ID + ".json")).read_text())
        self.assertEqual(record["errorCode"], "PROVIDER_HTTP_ERROR")
        self.assertEqual(record["structured"]["calls"][0]["httpStatus"], 400)
        self.assertEqual(record["structured"]["calls"][0]["httpClass"], "bad_request")

    @NEEDS
    def test_a_compile_failure_names_the_empty_slots(self):
        fake = FakeProvider(reserves_run_out(), {}, {})
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "MIDDLE_SKILL_PATH": str(S.MIDDLE),
                                     "QWEN_API_KEY": "unit-key", "QWEN_BASE_URL": CONFIG["base_url"],
                                     "QWEN_MODEL": "qwen-unit"}), patch.object(provider, "request_author_json", fake):
            event = self.failed_line(render=AssertionError("no render"), author=worker.author_lesson)
        self.assertEqual(event, {"event": "generation_failed", "jobId": JOB_ID, "code": "SHEET_BELOW_MINIMUM",
                                 "stage": "compile", "questions": ["Q4"]})
        self.assertEqual(len(fake.calls), 3)

    def test_a_v5_marker_without_the_structured_result_is_refused_before_render(self):
        def author(lesson, *, metadata, **options):
            metadata["authorContract"] = "worksheet-wire/5"
            return {"contract": "worksheet-wire/5"}
        with patch.object(worker, "author_lesson", side_effect=author), patch.object(worker, "render_job") as render:
            with self.assertRaisesRegex(RuntimeError, "AUTHOR_ROUTE_MISMATCH"):
                worker.process_job(self.remote, self.job, self.root)
        render.assert_not_called()
        self.assertEqual(self.remote.uploads(), [])

    def test_the_env_allowlist_carries_the_topic_list(self):
        env = self.root / "worker.env"
        env.write_text("TEACHER_V5_TOPICS=g7:algebraic_expressions\nUNLISTED=x\n")
        with patch.dict(os.environ, {}, clear=True):
            worker.load_env(env)
            self.assertEqual(dict(os.environ), {"TEACHER_V5_TOPICS": "g7:algebraic_expressions"})

    def test_structured_diagnostics_are_allowlisted_and_fit_the_file(self):
        refusals = [{"slot": "Q%d" % (i % 20 + 1), "item": i % 6, "field": "expr", "code": "MATH_SCOPE_PRODUCT_OF_SUM"}
                    for i in range(64)]
        metadata = {"authorContract": "worksheet-wire/5", "structured": {
            "cardSha256": "a" * 64, "schemaSha256": "PRIVATE", "outcome": "failed", "code": "SHEET_BELOW_MINIMUM",
            "stage": "compile", "questions": ["Q4", "PRIVATE"], "refusals": refusals + [{"slot": "Q1", "item": 1,
                                                                                    "field": "PRIVATE text",
                                                                                    "code": "X"}],
            "calls": [{"purpose": "author", "ms": 9, "usage": {"prompt_tokens": 5, "raw": "PRIVATE"},
                       "prompt": "PRIVATE prompt"}],
            "selection": {"requested": 20, "delivered": 19, "replaced": [
                {"slot": "Q%d" % (i + 1), "by": "R1", "codes": ["ITEM_COUNT"]} for i in range(32)], "dropped": []},
            "teacherText": "PRIVATE"}}
        self.assertTrue(worker.save_author_diagnostics(self.root, JOB_ID, metadata))
        path = self.root / "author-diagnostics" / (JOB_ID + ".json")
        self.assertLessEqual(len(path.read_bytes()), 8192)
        self.assertNotIn("PRIVATE", path.read_text())
        record = json.loads(path.read_text())["structured"]
        self.assertEqual(record["questions"], ["Q4"])
        self.assertEqual(record["calls"], [{"purpose": "author", "usage": {"prompt_tokens": 5}, "ms": 9}])
        self.assertTrue(record["truncated"])
        self.assertNotIn("schemaSha256", record)

    def test_v4_failure_line_and_result_keep_their_baseline_shape(self):
        self.assertIsNone(worker.safe_failure_detail(None))
        self.assertIsNone(worker.safe_failure_detail({"stage": "PRIVATE"}))
        self.assertEqual(worker.safe_failure_detail({"stage": "repair", "questions": ["Q4", "x"], "httpStatus": 503,
                                                     "body": "PRIVATE"}),
                         {"stage": "repair", "questions": ["Q4"], "httpStatus": 503})


class Packaging(unittest.TestCase):
    def test_the_module_ships_with_the_worker(self):
        files = set(json.loads((S.APP / "cloud/container/context-files.json").read_text())["files"])
        self.assertIn("tools/teacher-generation/structured_author.py", files)
        for path in ("cloud/container/Dockerfile.dockerignore", "cloud/render/Dockerfile.dockerignore"):
            self.assertIn("!tools/teacher-generation/structured_author.py", (S.APP / path).read_text().splitlines())


if __name__ == "__main__":
    unittest.main()
