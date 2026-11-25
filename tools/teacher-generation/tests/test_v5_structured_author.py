"""structured_author, the TEACHER_V5_TOPICS route and the worker's v5 path, with a fake provider (no network).

provider.request_author_json is replaced by a scripted fake: it records every request and plays replies, HTTP
errors or unusable replies in order. Nothing calls a model, nothing deploys. The provider golden
(golden/provider-golden.json) was recorded by fixtures/v5/make_provider_golden.py at 515ebd5a, before the route
existed.

Stage-4 follow-up (2026-11-25): the trusted-flag provenance assertions moved here from test_v5_stage3_hardening
(restored byte for byte to its 515ebd5a form) and were made stricter; the route needs TEACHER_V5_SITE_READY=1 too;
the worker's own SKIP rule (D22 pending: no SKIP accepted); one place decides the call budget; http.client errors;
AUTHOR_INTERNAL stages; a compiled sheet survives a provider failure in a repair; the targeted repair shows the
question actually taken out of a slot; no call starts with less than 180 s left.
"""
import ast
import copy
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from contextlib import ExitStack, redirect_stdout
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import provider  # noqa: E402
import remote_worker as worker  # noqa: E402
import runner  # noqa: E402
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


class Raise:
    """A script step that raises ``exc`` from the provider function (what request_author_json lets through)."""

    def __init__(self, exc):
        self.exc = exc


class Clock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


class Ticking(Clock):
    """A clock that moves ``step`` seconds on every read: the time the code itself takes between two reads."""

    def __init__(self, now=1000.0, step=0.001):
        super().__init__(now)
        self.step = step

    def __call__(self):
        now = self.now
        self.now += self.step
        return now


class FakeProvider:
    """Scripted stand-in for provider.request_author_json; ``advance`` moves a fake clock per call."""

    def __init__(self, *script, clock=None, advance=()):
        self.script, self.calls, self.clock, self.advance = list(script), [], clock, list(advance)

    def __call__(self, target, key, body, measured, timeout):
        self.calls.append({"target": target, "key": key, "body": copy.deepcopy(body), "timeout": timeout})
        if self.clock is not None and self.advance:
            self.clock.now += self.advance.pop(0)
        step = self.script.pop(0)
        if isinstance(step, Raise):
            raise step.exc
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


def reserve_taken_out():
    """Q4 is refused (ITEM_COUNT, TEMPLATE_MISMATCH) and R1 stands in, but R1 repeats Q1, so the sheet check takes it
    out again (DUPLICATE_TASK) and no reserve is left: Q4 is empty with R1's code, not with the planned Q4's codes."""
    good = by_slot(S.reply())
    questions = [q for q in S.reply()["questions"] if q["slot"] not in ("R2", "R3", "R4")]
    for question in questions:
        if question["slot"] == "Q9":
            question["items"] = copy.deepcopy(good["R2"]["items"])
        if question["slot"] == "Q14":
            question["items"] = copy.deepcopy(good["R3"]["items"])
        if question["slot"] == "R1":
            question["items"] = copy.deepcopy(good["Q1"]["items"])
    return {"questions": questions}


def shorter_sheet():
    """N = 23 > floor 20 (test_v5_structured_source): Q14 and Q20 have no question and no reserve, so the first compile
    already delivers 21 of 23 with both dropped, and both are repair targets while that sheet stands."""
    out = dict(lesson(), questionCount=23)
    good = by_slot(S.reply())
    plan = {"Q%d" % n: good[slot] for n, slot in enumerate(
        ["Q1", "Q2", "Q3", "Q5", "Q6", "R1", "R4", "Q7", "Q8", "Q10", "Q11", "Q12", "R2", None,
         "Q13", "Q15", "Q16", "Q17", "R3", None, "Q18", "Q20", "R5"], 1) if slot}
    return out, {"questions": [dict(copy.deepcopy(question), slot=slot) for slot, question in plan.items()]}


def author(fake, *, clock=None, **kwargs):
    metadata = {}
    with patch.object(provider, "request_author_json", fake):
        if clock is not None:
            with patch.object(sa, "_clock", clock):
                result = _author(metadata, **kwargs)
        else:
            result = _author(metadata, **kwargs)
    return result, metadata


def _author(metadata, of=None, **kwargs):
    try:
        return sa.author_structured_lesson(of or lesson(), metadata=metadata, skill_path=str(S.MIDDLE),
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

    def test_no_call_starts_inside_the_last_180_seconds(self):
        self.assertEqual(sa.MIN_SECONDS_LEFT, 180)
        for left in (179, 179.999, 100, 0, -5):
            with self.subTest(left=left):
                clock = Clock()
                fake = FakeProvider(S.reply())
                result, metadata = author(fake, clock=clock, deadline=clock.now + left)
                self.assertEqual((result.code, result.failure_detail), ("AUTHOR_DEADLINE", {"stage": "author",
                                                                                            "questions": []}))
                self.assertEqual(fake.calls, [])
                self.assertFalse(metadata["providerCalled"])
                self.assertEqual((metadata["structured"]["stage"], metadata["structured"]["calls"]), ("author", []))
        clock = Clock()
        fake = FakeProvider(S.reply())
        result, _ = author(fake, clock=clock, deadline=clock.now + 180)
        self.assertIsInstance(result, sa.StructuredAuthored)
        self.assertEqual([call["timeout"] for call in fake.calls], [180])

    def test_the_minimum_time_left_is_configurable(self):
        clock = Clock()
        fake = FakeProvider(S.reply())
        result, _ = author(fake, clock=clock, deadline=clock.now + 100, min_seconds_left=60)
        self.assertIsInstance(result, sa.StructuredAuthored)
        self.assertEqual([call["timeout"] for call in fake.calls], [100])
        clock = Clock()
        fake = FakeProvider(S.reply())
        result, _ = author(fake, clock=clock, deadline=clock.now + 250, min_seconds_left=251)
        self.assertEqual(result.code, "AUTHOR_DEADLINE")
        self.assertEqual(fake.calls, [])
        # A repair the minimum refuses is recorded as skipped (179 s left after a 500 s author call).
        clock = Clock()
        fake = FakeProvider(reserves_run_out(), S.load("repair-g7-round1.json"), clock=clock, advance=(500,))
        result, metadata = author(fake, clock=clock, deadline=clock.now + 679)
        self.assertEqual(result.code, "SHEET_BELOW_MINIMUM")
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual((metadata["structured"]["repairSkipped"], metadata["structured"]["repairRounds"]),
                         ("deadline", 0))

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
        # A shorter budget clips the repair timeout to the time left (190 s: above the 180 s minimum, below 200 s).
        clock = Clock()
        fake = FakeProvider(reserves_run_out(), S.load("repair-g7-round1.json"), clock=clock, advance=(280, 10))
        result, metadata = author(fake, clock=clock, deadline=clock.now + 470)
        self.assertIsInstance(result, sa.StructuredAuthored)
        self.assertEqual([call["timeout"] for call in fake.calls], [300, 190])
        self.assertEqual([call["timeoutSeconds"] for call in metadata["structured"]["calls"]], [300, 190])
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

    # ------------------------------------------------------------ stage-4 follow-up

    def test_the_call_budget_is_decided_in_one_place(self):
        source = (S.APP / "structured_author.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        self.assertNotIn("AssertionError", source)
        self.assertNotIn("may_call", source)

        def users(match):
            return sorted({function.name for function in ast.walk(tree) if isinstance(function, ast.FunctionDef)
                           for node in ast.walk(function) if match(node)})
        self.assertEqual(users(lambda node: isinstance(node, ast.Name) and node.id == "MAX_CALLS"), ["no_call_reason"])
        self.assertEqual(users(lambda node: isinstance(node, ast.Attribute) and node.attr == "min_seconds_left"
                               and isinstance(node.ctx, ast.Load)), ["no_call_reason"])
        self.assertEqual(users(lambda node: isinstance(node, ast.Attribute) and node.attr == "no_call_reason"), ["call"])

    def test_a_deadline_boundary_never_crashes_and_a_refused_repair_is_recorded(self):
        """A clock that moves 1 ms on every read, swept across the 180 s boundary of the repair call: each run either
        makes the repair call or records repairSkipped "deadline"; none ends in an internal error."""
        made = skipped = 0
        for step in range(-20, 21):
            clock = Ticking()
            fake = FakeProvider(reserves_run_out(), S.load("repair-g7-round1.json"), clock=clock, advance=(500,))
            result, metadata = author(fake, clock=clock, deadline=clock.now + 680 + step * 0.001)
            record = metadata["structured"]
            self.assertNotEqual(record.get("code"), "AUTHOR_INTERNAL")
            if len(fake.calls) == 2:
                made += 1
                self.assertIsInstance(result, sa.StructuredAuthored)
                self.assertNotIn("repairSkipped", record)
            else:
                skipped += 1
                self.assertEqual(len(fake.calls), 1)
                self.assertEqual((result.code, record["repairSkipped"], record["repairRounds"]),
                                 ("SHEET_BELOW_MINIMUM", "deadline", 0))
        self.assertTrue(made and skipped, (made, skipped))          # the sweep crossed the boundary

    def test_a_reauthor_the_deadline_refuses_is_recorded_as_skipped(self):
        clock = Clock()
        fake = FakeProvider(Fail("PROVIDER_INVALID_RESPONSE"), S.reply(), clock=clock, advance=(400,))
        result, metadata = author(fake, clock=clock, deadline=clock.now + 570)
        self.assertEqual((result.code, result.failure_detail),
                         ("PROVIDER_INVALID_RESPONSE", {"stage": "author", "questions": []}))
        self.assertEqual(len(fake.calls), 1)
        record = metadata["structured"]
        self.assertEqual((record["repairSkipped"], record["reauthored"], record["stage"], record["outcome"]),
                         ("deadline", False, "author", "failed"))

    def test_http_client_and_connection_errors_are_provider_unavailable(self):
        for exc in (http.client.IncompleteRead(b"partial"), http.client.RemoteDisconnected("closed"),
                    http.client.BadStatusLine("status"), http.client.LineTooLong("header"), ConnectionResetError()):
            with self.subTest(type(exc).__name__):
                fake = FakeProvider(Raise(exc), S.reply())
                result, metadata = author(fake)
                self.assertIsInstance(result, sa.StructuredAuthorError)
                self.assertEqual((result.code, result.failure_detail),
                                 ("PROVIDER_UNAVAILABLE", {"stage": "author", "questions": []}))
                self.assertEqual(len(fake.calls), 1)
                record = metadata["structured"]
                self.assertEqual(record["calls"][0]["code"], "PROVIDER_UNAVAILABLE")
                self.assertNotIn("finishReason", record["calls"][0])
                self.assertEqual((record["code"], record["stage"]), ("PROVIDER_UNAVAILABLE", "author"))
                self.assert_private(metadata)

    def test_a_provider_failure_in_a_repair_keeps_the_sheet_that_compiled(self):
        shorter, reply = shorter_sheet()
        for name, step, code in (
                ("incomplete read", Raise(http.client.IncompleteRead(b"")), "PROVIDER_UNAVAILABLE"),
                ("connection reset", Raise(ConnectionResetError()), "PROVIDER_UNAVAILABLE"),
                ("http 503", Http(503), "PROVIDER_HTTP_ERROR"),
                ("unexpected", Raise(AttributeError("'list' object has no attribute 'get'")), "AUTHOR_INTERNAL")):
            with self.subTest(name):
                fake = FakeProvider(reply, step, S.reply())
                result, metadata = author(fake, of=shorter)
                self.assertIsInstance(result, sa.StructuredAuthored)
                selection = result.source["selection"]
                self.assertEqual((selection["requested"], selection["delivered"]), (23, 21))
                self.assertEqual([row["slot"] for row in selection["dropped"]], ["Q14", "Q20"])
                self.assertEqual(len(fake.calls), 2)                             # the calls end there
                record = metadata["structured"]
                self.assertEqual([call["purpose"] for call in record["calls"]], ["author", "repair_targeted"])
                self.assertEqual(record["calls"][1]["code"], code)
                self.assertEqual((record["outcome"], record["repairRounds"]), ("delivered", 1))
                self.assertNotIn("code", record)
                self.assertEqual([slot["plan"][:4] for slot in user_of(fake.calls[1])["slots"]], ["Q14 ", "Q20 "])
                self.assertTrue(all("refused" not in slot for slot in user_of(fake.calls[1])["slots"]))
                self.assertTrue(metadata["validated"])
                self.assert_private(metadata)

    def test_an_internal_failure_is_recorded_with_the_stage_it_happened_in(self):
        cases = (
            ("setup", FakeProvider(S.reply()), (sa.structured_contract, "authoring_card"), "author", 0, []),
            ("author call", FakeProvider(Raise(AttributeError("x"))), None, "author", 1, []),
            ("compile", FakeProvider(S.reply()), (sa.structured_source, "compile_sheet"), "compile", 1, []),
            ("repair call", FakeProvider(reserves_run_out(), Raise(RecursionError())), None, "repair", 2, ["Q4"]),
            ("repair prompt", FakeProvider(reserves_run_out()), (sa._Session, "_plan_line"), "repair", 1, []))
        for name, fake, patched, stage, calls, questions in cases:
            with self.subTest(name):
                metadata = {}
                with patch.object(provider, "request_author_json", fake), ExitStack() as stack:
                    if patched is not None:
                        stack.enter_context(patch.object(*patched, side_effect=KeyError("PRIVATE")))
                    with self.assertRaises(Exception) as caught:
                        sa.author_structured_lesson(lesson(), metadata=metadata, skill_path=str(S.MIDDLE),
                                                    **dict(CONFIG, timeout=300))
                self.assertNotIsInstance(caught.exception, GenerationError)
                self.assertEqual(caught.exception.failure_detail, {"stage": stage, "questions": questions})
                self.assertEqual(worker.safe_failure_detail(caught.exception.failure_detail),
                                 {"stage": stage, "questions": questions})
                record = metadata["structured"]
                self.assertEqual((record["outcome"], record["code"], record["stage"]), ("failed", "AUTHOR_INTERNAL", stage))
                self.assertEqual(len(fake.calls), calls)
                if name.endswith("call"):
                    self.assertEqual(record["calls"][-1]["code"], "AUTHOR_INTERNAL")
                self.assertNotIn("PRIVATE", json.dumps(metadata))

    def test_the_targeted_repair_sends_the_question_actually_taken_out_with_its_own_codes(self):
        reply = reserve_taken_out()
        with self.assertRaises(sa.structured_source.V5Error) as caught:
            sa.structured_source.compile_sheet(S.lesson(), S.scope(), reply, skill_path=str(S.MIDDLE))
        self.assertEqual(caught.exception.diagnostics["occupants"], {"Q4": {"slot": "R1", "codes": ["DUPLICATE_TASK"]}})
        fake = FakeProvider(reply, S.load("repair-g7-round1.json"))
        result, metadata = author(fake)
        self.assertIsInstance(result, sa.StructuredAuthored)
        user = user_of(fake.calls[1])
        self.assertEqual(len(user["slots"]), 1)
        slot = user["slots"][0]
        self.assertEqual(slot["codes"], ["DUPLICATE_TASK"])
        self.assertEqual(slot["refused"], by_slot(reply)["R1"])                 # the reserve, not the planned Q4
        self.assertNotEqual(slot["refused"], by_slot(reply)["Q4"])
        self.assertEqual(user["fixes"], {"DUPLICATE_TASK": contract.repair_instruction("DUPLICATE_TASK")})
        self.assertIn({"slot": "Q4", "by": "REPAIR", "codes": ["DUPLICATE_TASK"]}, result.source["selection"]["replaced"])
        self.assert_private(metadata)
        # The planned question taken out by its own codes is sent with exactly those codes.
        with self.assertRaises(sa.structured_source.V5Error) as caught:
            sa.structured_source.compile_sheet(S.lesson(), S.scope(), reserves_run_out(), skill_path=str(S.MIDDLE))
        self.assertEqual(caught.exception.diagnostics["occupants"],
                         {"Q4": {"slot": "Q4", "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]}})
        # A slot that never held a question has no occupant and gets no "refused".
        shorter, short_reply = shorter_sheet()
        compiled = sa.structured_source.compile_sheet(shorter, S.scope(shorter), short_reply, skill_path=str(S.MIDDLE))
        self.assertEqual(compiled.diagnostics["occupants"], {})

    def test_refused_is_omitted_unless_the_occupant_and_its_codes_match(self):
        wires = {"Q4": {"slot": "Q4", "kind": "write_from_words"}, "R1": {"slot": "R1", "kind": "write_from_words"}}
        refused = sa._Session._refused
        self.assertEqual(refused({"slot": "R1", "codes": ["DUPLICATE_TASK"]}, wires, ("DUPLICATE_TASK",)), wires["R1"])
        self.assertIsNone(refused({"slot": "R1", "codes": ["DUPLICATE_TASK"]}, wires, ("ITEM_COUNT",)))
        self.assertIsNone(refused({"slot": "R1", "codes": ["DUPLICATE_TASK"]}, wires,
                                  ("DUPLICATE_TASK", "ITEM_COUNT")))
        self.assertIsNone(refused({"slot": "R9", "codes": ["ITEM_COUNT"]}, wires, ("ITEM_COUNT",)))
        self.assertIsNone(refused(None, wires, ("QUESTION_MISSING",)))
        big = {"Q4": {"slot": "Q4", "intro": "א" * 1100}}
        self.assertIsNone(refused({"slot": "Q4", "codes": ["ITEM_COUNT"]}, big, ("ITEM_COUNT",)))


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


def run_golden(*options):
    with tempfile.TemporaryDirectory() as out:
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", MIDDLE_SKILL_PATH=str(S.MIDDLE),
                   ELEMENTARY_SKILL_PATH=str(S.ELEMENTARY))
        env.pop("TEACHER_V5_TOPICS", None)
        env.pop("TEACHER_V5_SITE_READY", None)
        path = Path(out) / "provider-golden.json"
        done = subprocess.run([sys.executable, "-B", str(S.FIXTURES / "make_provider_golden.py"), "--app", str(S.APP),
                               "--out", str(path)] + list(options), env=env, capture_output=True, text=True, timeout=600)
        if done.returncode != 0:
            raise AssertionError("make_provider_golden failed: " + done.stderr[-800:])
        return path.read_bytes()


ALL_CASE_TOPICS = "g7:algebraic_expressions,g9r:probability,ד10,ג10"


def without_env(cases):
    return {name: {key: value for key, value in case.items() if key != "env"} for name, case in cases.items()}


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
        # With the site declared ready the same cases still keep the old path: the topic list and the reviewed
        # overlay (D7) decide each of them.
        self.assertEqual(run_golden("--site-ready", "1"), expected)

    @unittest.skipUnless(S.MIDDLE_PINNED and S.ELEMENTARY_PINNED, "Pinned skills unavailable")
    def test_topics_listed_but_site_not_ready_keeps_every_baseline_request(self):
        """Every case lists every topic, the reviewed g7 level-b lesson included; without TEACHER_V5_SITE_READY
        exactly "1" each request and its metadata are the baseline ones (golden/provider-golden.json unchanged)."""
        expected = json.loads((S.FIXTURES / "golden/provider-golden.json").read_bytes())["cases"]
        for site in (None, "", "0", "true", "yes", " 1", "1 ", "01", "1.0"):
            with self.subTest(site=site):
                options = ["--topics", ALL_CASE_TOPICS] + (["--site-ready", site] if site is not None else [])
                produced = json.loads(run_golden(*options))["cases"]
                self.assertEqual({case["env"] for case in produced.values()}, {ALL_CASE_TOPICS})
                self.assertEqual(without_env(produced), without_env(expected))
        # Control: with the site ready the listed reviewed lesson leaves the old path, so the check above can fail.
        ready = json.loads(run_golden("--topics", ALL_CASE_TOPICS, "--site-ready", "1"))["cases"]
        self.assertEqual(ready["v3-g7-unset"]["metadata"]["authorContract"], "worksheet-wire/5")
        self.assertNotEqual(without_env(ready)["v3-g7-unset"], without_env(expected)["v3-g7-unset"])

    @NEEDS
    def test_the_route_needs_the_site_ready_switch_as_well_as_the_topic(self):
        for env in ({"TEACHER_V5_TOPICS": "g7:algebraic_expressions"},
                    {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "TEACHER_V5_SITE_READY": "0"},
                    {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "TEACHER_V5_SITE_READY": "true"},
                    {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "TEACHER_V5_SITE_READY": " 1"},
                    {"TEACHER_V5_SITE_READY": "1"}, {"TEACHER_V5_SITE_READY": "1", "TEACHER_V5_TOPICS": "g7:equations"}):
            with self.subTest(env=env):
                fake = FakeProvider(Http(418))
                metadata = {}
                clean = {key: value for key, value in os.environ.items()
                         if key not in ("TEACHER_V5_TOPICS", "TEACHER_V5_SITE_READY")}
                with patch.dict(os.environ, dict(clean, MIDDLE_SKILL_PATH=str(S.MIDDLE), **env), clear=True), \
                        patch.object(provider, "request_author_json", fake), \
                        patch.object(sa, "author_structured_lesson", side_effect=AssertionError("v5 route taken")):
                    with self.assertRaises(GenerationError) as caught:
                        provider.author_lesson(lesson(), metadata=metadata, timeout=300, **CONFIG)
                self.assertEqual(caught.exception.code, "PROVIDER_HTTP_ERROR")
                self.assertNotIsInstance(caught.exception, sa.StructuredAuthorError)
                self.assertEqual(metadata["authorContract"], "worksheet-source/4")
                self.assertEqual(len(fake.calls), 1)
                self.assertEqual(fake.calls[0]["body"]["max_tokens"], 40000)                  # the general author
                self.assertNotEqual(fake.calls[0]["body"]["response_format"]["json_schema"]["name"],
                                    "worksheet_wire_v5")

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
        # (TEACHER_V5_TOPICS, TEACHER_V5_SITE_READY): the list empty or not naming the topic, or the site not ready.
        for flag, site in ((None, None), ("", None), ("g7:equations", None), ("g7:equations", "1"), ("", "1"),
                           ("g7:algebraic_expressions", None), ("g7:algebraic_expressions", "0")):
            with self.subTest(flag=flag, site=site):
                env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", MIDDLE_SKILL_PATH=str(S.MIDDLE))
                env.pop("TEACHER_V5_TOPICS", None)
                env.pop("TEACHER_V5_SITE_READY", None)
                if flag is not None:
                    env["TEACHER_V5_TOPICS"] = flag
                if site is not None:
                    env["TEACHER_V5_SITE_READY"] = site
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
                                     "TEACHER_V5_SITE_READY": "1", "MIDDLE_SKILL_PATH": str(S.MIDDLE)}), \
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
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": "g9r:probability", "TEACHER_V5_SITE_READY": "1",
                                     "MIDDLE_SKILL_PATH": str(S.MIDDLE)}), \
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

def v5_manifest(target, *, review=False, extra=False, status="needs_review", skill="middle",
                skipped=("pinned:emit_docx",), not_run=None):
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
    steps = ([{"name": "trusted-adapter", "status": "PASS"}, {"name": "middle-build", "status": "PASS"}]
             + [{"name": name, "status": "SKIP"} for name in skipped]
             + [{"name": "pinned:check_didactic", "status": "REVIEW" if review else "PASS"},
                {"name": "atom-order", "status": "PASS"}])
    return {"version": 1, "status": status, "executedChecksPassed": status == "needs_review",
            "automatedChecksPassed": False, "renderingChecksPassed": False,
            "notRun": list(skipped) if not_run is None else list(not_run),
            "authorContract": "worksheet-wire/5", "authoringProfile": "general-skill-source/v1",
            "skill": {"name": skill, "version": "7.2.0-noam", "sha256": "b" * 64}, "steps": steps,
            "artifacts": artifacts if status == "needs_review" else [], "debug": "PRIVATE local path"}


NO_DIRECT_RENDER = AssertionError("the worker renders a v5 result only through runner.render_structured")


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

    def fresh(self):
        self.root = Path(tempfile.mkdtemp(dir=self.temp.name)).resolve()
        self.remote = FakeRemote()

    def test_v5_render_gets_the_trusted_flag_and_only_the_pdf_is_uploaded(self):
        seen = []

        def render(lesson, payload, target, **kwargs):
            seen.append((payload, kwargs))
            return v5_manifest(target)
        # The real runner.render_structured runs; runner.render_job stands in for the render itself.
        with patch.object(worker, "author_lesson", side_effect=self.author), \
                patch.object(worker, "render_job", side_effect=NO_DIRECT_RENDER), \
                patch.object(runner, "render_job", side_effect=render), patch.object(worker, "D22_APPROVED", True):
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

    def failed_line(self, render=None, author=None, d22=False):
        self.remote.claims = [self.job]
        with patch.object(sys, "argv", ["worker", "--once", "--work-dir", str(self.root)]), \
                patch.object(worker, "check_readiness", return_value={"ready": True}), \
                patch.object(worker, "Remote", return_value=self.remote), \
                patch.object(worker, "author_lesson", side_effect=author or self.author), \
                patch.object(worker, "render_job", side_effect=NO_DIRECT_RENDER), \
                patch.object(runner, "render_job", side_effect=render), patch.object(worker, "D22_APPROVED", d22), \
                redirect_stdout(io.StringIO()) as output:
            worker.main()
        self.assertEqual(self.remote.uploads(), [])
        self.assertFalse(any(call[2].get("status") == "needs_review" for call in self.remote.calls
                             if call[1] == "PATCH"))
        return json.loads(output.getvalue())

    def test_review_extra_artifacts_or_a_failed_render_are_refused_with_one_log_line(self):
        def raised(lesson, payload, target, **kwargs):
            raise GenerationError("SOURCE_SHAPE", "PRIVATE detail")
        # D22 approved here, so each of these is refused for its own reason and not for its SKIP step.
        for name, render, stage in (
                ("review", lambda lesson, payload, target, **kw: v5_manifest(target, review=True), "acceptance"),
                ("docx", lambda lesson, payload, target, **kw: v5_manifest(target, extra=True), "acceptance"),
                ("failed", lambda lesson, payload, target, **kw: v5_manifest(target, status="failed"), "render"),
                ("raised", raised, "render")):
            with self.subTest(name):
                self.fresh()
                event = self.failed_line(render, d22=True)
                code = "SOURCE_SHAPE" if name == "raised" else "QUALITY_GATE_FAILED"
                self.assertEqual(event, {"event": "generation_failed", "jobId": JOB_ID, "code": code,
                                         "stage": stage, "questions": []})

    def accept(self, d22=False, lesson=None, **manifest):
        """process_job on a fake v5 render: None when the result was accepted, else the refusal."""
        self.fresh()
        self.job["lesson"] = lesson or S.lesson()
        with patch.object(worker, "author_lesson", side_effect=self.author), \
                patch.object(worker, "render_job", side_effect=NO_DIRECT_RENDER), \
                patch.object(runner, "render_job", side_effect=lambda les, pay, target, **kw: v5_manifest(
                    target, **manifest)), patch.object(worker, "D22_APPROVED", d22):
            try:
                worker.process_job(self.remote, self.job, self.root)
            except GenerationError as exc:
                self.assertEqual((exc.code, exc.failure_detail),
                                 ("QUALITY_GATE_FAILED", {"stage": "acceptance", "questions": []}))
                self.assertEqual(self.remote.uploads(), [])
                return exc
        self.assertEqual([call[0].rsplit("/", 1)[1] for call in self.remote.uploads()], ["sheet.pdf"])
        return None

    def test_d22_approval_is_recorded_exactly(self):
        # Noam approved D22 on 2026-11-25; the constant and its record must say exactly that.
        self.assertIs(worker.D22_APPROVED, True)
        self.assertEqual(worker.D22_APPROVAL, {"approvedBy": "Noam", "approvedAt": "2026-11-25"})
        self.assertIn("D22_APPROVED = True\n", (S.APP / "remote_worker.py").read_text(encoding="utf-8"))

    def test_every_skip_is_refused_without_d22(self):
        # With the approval withdrawn (False), every allowlisted SKIP is refused again.
        for name in sorted(runner.V5_NOT_RUN_ALLOWED):
            with self.subTest(name):
                self.assertIsNotNone(self.accept(d22=False, skipped=(name,)))
        self.assertIsNone(self.accept(d22=False, skipped=()))              # no SKIP: accepted without D22

    def test_once_d22_is_approved_only_an_allowlisted_middle_skip_in_not_run_passes(self):
        self.assertIsNone(self.accept(d22=True))                           # pinned:emit_docx, listed in notRun
        self.assertIsNone(self.accept(d22=True, skipped=sorted(runner.V5_NOT_RUN_ALLOWED)))
        self.assertIsNotNone(self.accept(d22=True, not_run=[]))            # allowlisted but not in notRun
        for name in ("pinned:check_didactic", "pinned:build_v72", "atom-order", "pinned-log:build_plus:G83",
                     "pinned-gate:G90-something:sheet"):
            with self.subTest(name):
                self.assertNotIn(name, runner.V5_NOT_RUN_ALLOWED)
                self.assertIsNotNone(self.accept(d22=True, skipped=(name,)))   # listed in notRun all the same

    def test_the_elementary_path_accepts_no_skip(self):
        d10 = S.load("d10/lesson.json")
        for name in sorted(runner.V5_NOT_RUN_ALLOWED):
            with self.subTest(name):
                self.assertIsNotNone(self.accept(d22=True, lesson=d10, skill="elementary", skipped=(name,)))
        self.assertIsNone(self.accept(d22=True, lesson=d10, skill="elementary", skipped=()))

    def test_the_manifest_must_name_the_lessons_skill(self):
        self.assertIsNotNone(self.accept(d22=True, skill="elementary", skipped=()))
        self.assertIsNotNone(self.accept(d22=True, lesson=S.load("d10/lesson.json"), skill="middle", skipped=()))
        self.assertIsNotNone(self.accept(d22=True, skill="PRIVATE", skipped=()))

    def test_accepted_step_is_the_workers_own_rule(self):
        allowed = sorted(runner.V5_NOT_RUN_ALLOWED)[0]
        skip = {"name": allowed, "status": "SKIP"}
        with patch.object(worker, "D22_APPROVED", True):
            self.assertTrue(worker.accepted_step(skip, "middle", [allowed]))
            self.assertFalse(worker.accepted_step(skip, "elementary", [allowed]))
            self.assertFalse(worker.accepted_step(skip, "middle", []))
            for bad in ({"name": allowed, "status": "REVIEW"}, {"name": allowed, "status": "FAIL"},
                        {"name": allowed, "status": "skip"}, {"name": allowed}, {"status": "PASS"}, "PASS", None):
                self.assertFalse(worker.accepted_step(bad, "middle", [allowed]), bad)
        with patch.object(worker, "D22_APPROVED", 1):                       # only True itself approves
            self.assertFalse(worker.accepted_step(skip, "middle", [allowed]))
        with patch.object(worker, "D22_APPROVED", False):                   # approval withdrawn: refused
            self.assertFalse(worker.accepted_step(skip, "middle", [allowed]))
        self.assertTrue(worker.accepted_step(skip, "middle", [allowed]))    # default: D22 approved 2026-11-25
        self.assertFalse(worker.accepted_step(skip, "elementary", [allowed]))
        self.assertFalse(worker.accepted_step(skip, "middle", []))
        self.assertTrue(worker.accepted_step({"name": "atom-order", "status": "PASS"}, "elementary", []))

    @NEEDS
    def test_an_internal_failure_logs_the_stage_it_happened_in(self):
        fake = FakeProvider(S.reply())
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "TEACHER_V5_SITE_READY": "1",
                                     "MIDDLE_SKILL_PATH": str(S.MIDDLE), "QWEN_API_KEY": "unit-key",
                                     "QWEN_BASE_URL": CONFIG["base_url"], "QWEN_MODEL": "qwen-unit"}), \
                patch.object(provider, "request_author_json", fake), \
                patch.object(sa.structured_source, "compile_sheet", side_effect=KeyError("PRIVATE")):
            event = self.failed_line(render=AssertionError("no render"), author=worker.author_lesson)
        self.assertEqual(event, {"event": "generation_failed", "jobId": JOB_ID, "code": "WORKER_FAILED",
                                 "stage": "compile", "questions": []})
        record = json.loads((self.root / "author-diagnostics" / (JOB_ID + ".json")).read_text())
        self.assertEqual((record["structured"]["code"], record["structured"]["stage"]), ("AUTHOR_INTERNAL", "compile"))

    @NEEDS
    def test_http_400_from_the_real_route_logs_status_and_stage_without_text(self):
        fake = FakeProvider(Http(400))
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "TEACHER_V5_SITE_READY": "1",
                                     "MIDDLE_SKILL_PATH": str(S.MIDDLE),
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
        with patch.dict(os.environ, {"TEACHER_V5_TOPICS": "g7:algebraic_expressions", "TEACHER_V5_SITE_READY": "1",
                                     "MIDDLE_SKILL_PATH": str(S.MIDDLE),
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
        with patch.object(worker, "author_lesson", side_effect=author), patch.object(worker, "render_job") as render, \
                patch.object(runner, "render_job") as inner:
            with self.assertRaisesRegex(RuntimeError, "AUTHOR_ROUTE_MISMATCH"):
                worker.process_job(self.remote, self.job, self.root)
        render.assert_not_called()
        inner.assert_not_called()
        self.assertEqual(self.remote.uploads(), [])

    def test_the_env_allowlist_carries_the_topic_list_and_the_site_switch(self):
        env = self.root / "worker.env"
        env.write_text("TEACHER_V5_TOPICS=g7:algebraic_expressions\nTEACHER_V5_SITE_READY=\"1\"\nUNLISTED=x\n"
                       "TEACHER_V5_SITE=1\n")
        with patch.dict(os.environ, {}, clear=True):
            worker.load_env(env)
            self.assertEqual(dict(os.environ), {"TEACHER_V5_TOPICS": "g7:algebraic_expressions",
                                                "TEACHER_V5_SITE_READY": "1"})

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


class TrustedFlagProvenance(unittest.TestCase):
    """Moved from test_v5_stage3_hardening.test_only_the_compilers_set_the_flag (that file is again byte-identical to
    515ebd5a, whose closed set of contract= pass-throughs no longer names remote_worker.py) and made stricter: the
    worker never names a contract at all; runner.render_structured binds the flag from the StructuredAuthored result
    and passes it to render_job only."""

    @staticmethod
    def tree(name):
        return ast.parse((S.APP / name).read_text(encoding="utf-8"))

    def test_the_worker_never_names_a_contract(self):
        tree = self.tree("remote_worker.py")
        self.assertEqual([ast.unparse(node) for node in ast.walk(tree) if isinstance(node, ast.Call)
                          and any(keyword.arg == "contract" for keyword in node.keywords)], [])
        self.assertEqual([node.lineno for node in ast.walk(tree)
                          if (isinstance(node, ast.Name) and node.id == "contract")
                          or (isinstance(node, ast.arg) and node.arg == "contract")
                          or (isinstance(node, ast.Attribute) and node.attr == "contract")], [])
        # The one **splat goes to the author, with the worker's own timeout/revision options only.
        self.assertEqual([ast.unparse(node) for node in ast.walk(tree) if isinstance(node, ast.Call)
                          and any(keyword.arg is None for keyword in node.keywords)],
                         ["author_lesson(lesson, metadata=metadata, **options)"])
        self.assertEqual(sorted(ast.unparse(node.slice) for node in ast.walk(tree) if isinstance(node, ast.Subscript)
                                and isinstance(node.ctx, ast.Store) and ast.unparse(node.value) == "options"),
                         ["'revision'", "'timeout'"])
        renders = sorted(ast.unparse(node) for node in ast.walk(tree) if isinstance(node, ast.Call)
                         and isinstance(node.func, ast.Name) and node.func.id.startswith("render"))
        self.assertEqual(renders, ["render_job(lesson, payload, render_target)",
                                   "render_job(lesson, payload, render_target)",
                                   "render_structured(lesson, structured, render_target)"])

    def test_render_structured_binds_the_flag_from_the_result_only(self):
        tree = self.tree("runner.py")
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                        and node.name == "render_structured")
        self.assertEqual(ast.unparse(function.args), "lesson, structured, workdir")
        stores = [node for node in ast.walk(tree) if isinstance(node, ast.Name) and node.id == "contract"
                  and isinstance(node.ctx, ast.Store)]
        self.assertEqual(len(stores), 1)
        self.assertTrue(any(node is stores[0] for node in ast.walk(function)))
        self.assertEqual([ast.unparse(node) for node in ast.walk(function) if isinstance(node, ast.Assign)],
                         ["contract = structured.contract"])
        self.assertEqual([ast.unparse(node) for node in ast.walk(function) if isinstance(node, ast.Call)
                          and any(keyword.arg == "contract" for keyword in node.keywords)],
                         ["render_job(lesson, structured.source, workdir, contract=contract)"])
        self.assertEqual(sorted(node.arg for node in ast.walk(tree) if isinstance(node, ast.arg)
                                and node.arg == "contract"), ["contract", "contract"])   # render_job, _is_v5

    def test_render_structured_refuses_anything_but_the_structured_result(self):
        structured = sa.StructuredAuthored({"contract": "worksheet-wire/5"}, "worksheet-wire/5")

        class Copy(sa.StructuredAuthored):
            pass
        with tempfile.TemporaryDirectory() as tmp, patch.object(runner, "render_job") as render:
            job = Path(tmp) / "job"
            for value in ({"contract": "worksheet-wire/5"}, structured.source, None,
                          SimpleNamespace(source=structured.source, contract="worksheet-wire/5"),
                          Copy({"contract": "worksheet-wire/5"}, "worksheet-wire/5")):
                with self.subTest(type(value).__name__), self.assertRaises(TypeError):
                    runner.render_structured(S.lesson(), value, job)
            render.assert_not_called()
            self.assertFalse(job.exists())
            render.return_value = {"status": "needs_review"}
            self.assertEqual(runner.render_structured(S.lesson(), structured, job), {"status": "needs_review"})
            render.assert_called_once_with(S.lesson(), structured.source, job, contract="worksheet-wire/5")


class Packaging(unittest.TestCase):
    def test_the_module_ships_with_the_worker(self):
        files = set(json.loads((S.APP / "cloud/container/context-files.json").read_text())["files"])
        self.assertIn("tools/teacher-generation/structured_author.py", files)
        for path in ("cloud/container/Dockerfile.dockerignore", "cloud/render/Dockerfile.dockerignore"):
            self.assertIn("!tools/teacher-generation/structured_author.py", (S.APP / path).read_text().splitlines())


if __name__ == "__main__":
    unittest.main()
