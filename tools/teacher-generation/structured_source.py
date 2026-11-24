"""Compile one worksheet-wire/5 reply into a validated v4 source with the v5 additions (V5-DESIGN §2.3, §3, §4).

Order (compile_sheet, also exported as compile_reply):

1. plan: planned rows Q1..QN and reserve rows R1..RR (structured_contract.plan_rows);
2. parse the wire: {slot: question}, first occurrence wins; Q_SHAPE / Q_SLOT_UNKNOWN / Q_SLOT_DUPLICATE;
3. compile every question once against its own row (compile_question: Q1-Q3, items I1-I6, Q4 leaks, Q5 trim);
4. lesson_select.Selection(...).screen(): a refused planned question takes a reserve of its group;
5. sheet loop: leak_checks.sheet_leaks over the printed order → Selection.reject, until nothing new;
6. at most two repair rounds ({slot: wire question}), each followed by the sheet loop;
7. the exact delivery rule: floor ≤ M ≤ N (a shorter sheet only when the grade floor allows it), 2-4 stars
   counting challenge-kind questions with at least two real challenges, every selected concept printed, no
   sheet-level leak or duplicate left;
8. the IR (v4 root plus "contract" and "selection") and general_source.validate_source, the final authority.

Diagnostics hold codes, slots, item indices, field names, numbers and concept ids only: never model text,
lesson text or an expression (G11). A sheet-level failure raises V5Error; a GeneralSourceError from the final
validate_source is an internal bug and propagates unchanged.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import json

import leak_checks
import lesson_select
import structured_contract
from item_kinds import Context, compile_item, intro_spans
from structured_contract import (CHALLENGES, CONTRACT, LIMITS, QUESTION_FIELDS, SLOT_RE, ContractError, PlanRow,
                                 is_known_code, rule_spans, thaw)

REPAIR_ROUNDS = 2
WIRE_CODES = ("WIRE_JSON", "WIRE_SHAPE", "WIRE_TOPIC_UNSUPPORTED")


@dataclass(frozen=True)
class Refusal:
    slot: str
    item: int        # 0 = question or sheet level
    field: str
    code: str

    def record(self) -> dict:
        return {"slot": self.slot, "item": self.item, "field": self.field, "code": self.code}


@dataclass
class CompiledQuestion:
    slot: str
    kind: str | None
    row: PlanRow | None
    ir: dict | None
    refusals: list
    trimmed: tuple

    @property
    def codes(self) -> tuple:
        """() when printable, else sorted unique codes."""
        if self.ir is not None:
            return ()
        return tuple(sorted({refusal.code for refusal in self.refusals})) or ("BINDING_INTERNAL",)


class V5Error(ValueError):
    """Sheet-level failure: code ∈ WIRE_JSON, WIRE_SHAPE, WIRE_TOPIC_UNSUPPORTED, SHEET_BELOW_MINIMUM, SHEET_STARS,
    SHEET_COVERAGE, REPAIR_BUDGET, RUNTIME_NOT_CONFIGURED (or a sheet leak code left after the bounded loop);
    .diagnostics holds codes only (G11)."""

    def __init__(self, code: str, diagnostics: dict | None = None):
        self.code = code
        self.diagnostics = diagnostics if diagnostics is not None else {"contract": CONTRACT, "code": code}
        super().__init__(code)


@dataclass
class CompileResult:
    ir: dict
    evidence: dict
    diagnostics: dict


# ------------------------------------------------------------------ plan and wire

def plan_slots(lesson, scope, overlay) -> tuple:
    """Planned rows Q1..QN and reserve rows R1..RR (§2.3)."""
    try:
        return structured_contract.plan_rows(lesson, scope, overlay)
    except ContractError:
        raise V5Error("WIRE_TOPIC_UNSUPPORTED") from None


def _strict_json(data):
    """A reply given as JSON text: ≤200,000 bytes, duplicate keys and non-finite numbers refused."""
    if isinstance(data, str):
        data = data.encode("utf-8")
    if len(data) > LIMITS["reply_bytes"]:
        raise V5Error("WIRE_JSON")

    def pairs(items):
        out = {}
        for key, value in items:
            if key in out:
                raise ValueError("duplicate key")
            out[key] = value
        return out

    def constant(_):
        raise ValueError("non-finite number")

    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=constant)
    except (UnicodeDecodeError, ValueError, RecursionError):
        raise V5Error("WIRE_JSON") from None


def _safe_slot(value) -> str:
    """A model-written slot is echoed only when it is in the slot alphabet (G11)."""
    return value if type(value) is str and SLOT_RE.match(value) else ""


def parse_wire(reply, planned, reserves) -> tuple:
    """{slot: wire question} (first occurrence wins) plus refusals Q_SHAPE, Q_SLOT_UNKNOWN, Q_SLOT_DUPLICATE.
    A non-dict root, keys ≠ {'questions'} or more than 2·(N+R) entries → V5Error WIRE_SHAPE.

    A reply given as JSON text (str or bytes) is read strictly first (WIRE_JSON)."""
    if isinstance(reply, (str, bytes)):
        reply = _strict_json(reply)
    else:
        try:
            size = len(json.dumps(reply, ensure_ascii=False, allow_nan=False).encode("utf-8"))
        except (TypeError, ValueError, RecursionError):
            raise V5Error("WIRE_JSON") from None
        if size > LIMITS["reply_bytes"]:
            raise V5Error("WIRE_JSON")
    known = [row.slot for row in list(planned) + list(reserves)]
    if type(reply) is not dict or set(reply) != {"questions"} or type(reply["questions"]) is not list:
        raise V5Error("WIRE_SHAPE")
    entries = reply["questions"]
    if not 1 <= len(entries) <= 2 * len(known):
        raise V5Error("WIRE_SHAPE")
    wires, refusals = {}, []
    for entry in entries:
        slot = entry.get("slot") if type(entry) is dict else None
        if type(slot) is not str:
            refusals.append(Refusal("", 0, "slot", "Q_SHAPE"))
        elif slot not in known:
            refusals.append(Refusal(_safe_slot(slot), 0, "slot", "Q_SLOT_UNKNOWN"))
        elif slot in wires:
            refusals.append(Refusal(slot, 0, "slot", "Q_SLOT_DUPLICATE"))
        else:
            wires[slot] = entry
    return wires, refusals


# ------------------------------------------------------------------ one question

def _lint(text, ctx, maximum):
    from text_lint import lint_model_text
    codes, _ = lint_model_text(text, grade=ctx.lesson["gradeNumber"], declared=(),
                               forbidden_terms=ctx.overlay["forbiddenTerms"], max_length=maximum)
    return codes


def compile_question(wire: dict, row: PlanRow, ctx: Context) -> CompiledQuestion:
    """Checks Q1–Q5 and per item I1–I6 (§4); refused items are trimmed while ≥3 clean items remain."""
    slot, overlay = row.slot, ctx.overlay
    refusals = []

    def refuse(item, field, code):
        refusal = Refusal(slot, item, field, code)
        if refusal not in refusals:
            refusals.append(refusal)

    def refused(kind=None):
        return CompiledQuestion(slot, kind, row, None, refusals, ())

    # Q1 shape
    if type(wire) is not dict or set(wire) != set(QUESTION_FIELDS) or wire.get("slot") != slot:
        refuse(0, "", "Q_SHAPE")
        return refused()
    kind, intro, givens, table, items = (wire[field] for field in ("kind", "intro", "givens", "table", "items"))
    if (type(kind) is not str or type(intro) is not str or type(givens) is not list or type(items) is not list
            or type(table) is not dict or set(table) != {"head", "rows"} or type(table["head"]) is not list
            or type(table["rows"]) is not list):
        refuse(0, "", "Q_SHAPE")
        return refused()
    if kind not in row.kinds:
        refuse(0, "kind", "Q_KIND_NOT_ALLOWED")
    if not LIMITS["items_min"] <= len(items) <= LIMITS["items_max"]:
        refuse(0, "items", "ITEM_COUNT")
    # Q2 text and Q3 references: every stage-2 kind leaves intro, givens and table empty.
    if intro != "":
        refuse(0, "intro", "FIELD_NOT_EMPTY")
        for code in _lint(intro, ctx, LIMITS["intro"]):
            refuse(0, "intro", code)
    if givens:
        refuse(0, "givens", "FIELD_NOT_EMPTY")
    if table["head"] or table["rows"]:
        refuse(0, "table", "FIELD_NOT_EMPTY")
        cells = list(table["head"]) + [cell for line in table["rows"] if type(line) is list for cell in line]
        for cell in cells:
            for code in (_lint(cell, ctx, LIMITS["cell"]) if type(cell) is str and cell else ()):
                refuse(0, "table", code)
    if kind not in overlay["kinds"]:
        return refused()

    # Items I1-I6
    compiled = [compile_item(kind, item, index, ctx) for index, item in enumerate(items, 1)]
    for item in compiled:
        for field, code in item.refusals:
            refuse(item.index, field, code)
    clean = [item for item in compiled if not item.refusals]
    star = overlay["kinds"][kind]["group"] == CHALLENGES

    def question(chosen):
        return {"intro": intro_spans(kind, overlay), "star": star,
                "items": [{"prompt": item.prompt, "answer": item.answer} for item in chosen]}

    # Q4 leaks over the clean items (monotone: removing the hit items adds no hit)
    if clean:
        hits = leak_checks.question_leaks(question(clean), overlay, skill_path=ctx.skill_path)
        hit_items = set()
        for position, code in hits:
            item = clean[position - 1]
            refuse(item.index, "expr", code)
            hit_items.add(item.index)
        clean = [item for item in clean if item.index not in hit_items]

    # Q5 trim
    if any(refusal.item == 0 for refusal in refusals):
        return refused(kind)
    if len(clean) < LIMITS["items_min"]:
        refuse(0, "items", "ITEM_COUNT")
        return refused(kind)
    trimmed = tuple(item.index for item in compiled if item not in clean)
    return CompiledQuestion(slot, kind, row, question(clean), refusals, trimmed)


# ------------------------------------------------------------------ the sheet

def _registered(codes) -> list:
    out = sorted(set(codes))
    unknown = [code for code in out if not is_known_code(code)]
    if unknown:
        raise ValueError("unregistered refusal code")
    return out[:structured_contract.MAX_ENTRY_CODES]


def _sheet_loop(selection, examples) -> None:
    """sheet_leaks over the printed order → reject the later question, until no new codes. Bounded by N+R+1."""
    bound = selection.planned + len(selection.reserves) + 1
    for _ in range(bound):
        layout = selection.layout()
        hits = leak_checks.sheet_leaks([slot.question.ir for slot in layout], examples=examples)
        if not hits:
            return
        selection.reject({layout[index].number: tuple(codes) for index, codes in hits.items()}, stage="sheet")


def _missing_targets(selection, planned) -> list:
    out = []
    for number in selection.missing():
        row, slot = planned[number - 1], selection.slot(number)
        out.append({"slot": row.slot, "group": row.group, "concepts": list(row.concepts), "kinds": list(row.kinds),
                    "codes": _registered(slot.codes or (lesson_select.NO_QUESTION,))})
    return out


def _diagnostics(lesson, floor, selection, refusals, questions, rounds, delivered) -> dict:
    trimmed = [{"slot": question.slot, "items": list(question.trimmed)}
               for question in questions if question.ir is not None and question.trimmed]
    return {"contract": CONTRACT, "requested": lesson["questionCount"], "floor": floor, "delivered": delivered,
            "refusals": [refusal.record() for refusal in refusals], "trimmed": trimmed,
            "selection": selection.summary(), "record": json.loads(json.dumps(selection.record)),
            "repairRounds": rounds}


def _selection_record(lesson, floor, selection) -> dict:
    layout = selection.layout()
    questions = []
    for n, slot in enumerate(layout, 1):
        compiled = slot.question
        questions.append({"n": n, "slot": compiled.slot, "origin": slot.origin,
                          "conceptIds": list(compiled.row.concepts), "star": compiled.ir["star"]})
    replaced, dropped = [], []
    for event in selection.record:
        action = event.get("action")
        if action in ("reserve", "reserve_as_practice"):
            replaced.append({"slot": "Q%d" % event["question"], "by": "R%d" % event["reserve"],
                             "codes": _registered(event["codes"])})
        elif action == "repair":
            replaced.append({"slot": "Q%d" % event["question"], "by": "REPAIR", "codes": _registered(event["codes"])})
        elif action == "dropped":
            dropped.append({"slot": "Q%d" % event["question"], "codes": _registered(event["codes"])})
    return {"requested": lesson["questionCount"], "floor": floor, "delivered": len(layout),
            "questions": questions, "replaced": replaced, "dropped": dropped}


def compile_sheet(lesson, scope, reply, *, skill_path, repairs=(), overlay=None) -> CompileResult:
    """Wire reply plus ≤2 repair rounds ({slot: wire question}) → validated v4+v5 IR. Order: plan → parse → compile
    every question once → Selection.screen → sheet loop → repair rounds (fill, sheet loop) → acceptance (§4) → build IR
    → general_source.validate_source. Raises V5Error; GeneralSourceError from validate_source is an internal bug."""
    from general_source import validate_source
    from runtime_catalog import question_floor

    repairs = tuple(repairs or ())
    if len(repairs) > REPAIR_ROUNDS:
        raise V5Error("REPAIR_BUDGET")
    if type(skill_path) is not str or not skill_path:
        raise V5Error("RUNTIME_NOT_CONFIGURED")
    if overlay is None:
        overlay = structured_contract.overlay_for(lesson.get("topicId"), lesson.get("level"))
    if overlay is None or scope["topic"]["skillId"] != "middle":
        raise V5Error("WIRE_TOPIC_UNSUPPORTED")
    planned, reserves = plan_slots(lesson, scope, overlay)
    floor = question_floor(lesson["gradeNumber"])
    wires, refusals = parse_wire(reply, planned, reserves)
    ctx = Context(lesson, scope, overlay, skill_path)
    compiled, questions = {}, []
    for row in list(planned) + list(reserves):
        if row.slot in wires:
            compiled[row.slot] = compile_question(wires[row.slot], row, ctx)
            questions.append(compiled[row.slot])
            refusals.extend(compiled[row.slot].refusals)
    selection = lesson_select.Selection(
        [{"group": row.group, "question": compiled.get(row.slot), "concepts": row.concepts} for row in planned],
        [{"group": row.group, "question": compiled.get(row.slot), "concepts": row.concepts} for row in reserves],
        lambda question, challenge, number: question.codes, minimum=floor)
    selection.screen()
    examples = rule_spans(overlay)
    _sheet_loop(selection, examples)

    by_slot = {row.slot: row for row in planned}
    rounds = 0
    for repair in repairs:
        rounds += 1
        if type(repair) is not dict:
            raise V5Error("WIRE_SHAPE")
        for slot in sorted(repair, key=lambda name: (name[:1], int(name[1:]) if name[1:].isdigit() else 0, name)):
            row = by_slot.get(slot)
            if row is None or not selection.slot(row.number).missing:
                refusals.append(Refusal(_safe_slot(slot), 0, "slot", "REPAIR_SLOT_NOT_MISSING"))
                continue
            candidate = compile_question(repair[slot], row, ctx)
            questions.append(candidate)
            refusals.extend(candidate.refusals)
            selection.fill(row.number, candidate, origin="repair")
        _sheet_loop(selection, examples)

    def failure(code):
        diagnostics = _diagnostics(lesson, floor, selection, refusals, questions, rounds, len(selection.layout()))
        diagnostics["code"] = code
        diagnostics["missing"] = _missing_targets(selection, planned)
        return V5Error(code, diagnostics)

    # Acceptance: the exact delivery rule (§4).
    if selection.missing() and not selection.shorten():
        raise failure("SHEET_BELOW_MINIMUM")
    layout = selection.layout()
    if not floor <= len(layout) <= lesson["questionCount"]:
        raise failure("SHEET_BELOW_MINIMUM")
    stars = sum(1 for slot in layout if slot.question.ir["star"])
    if not 2 <= stars <= 4 or selection.real_challenges() < lesson_select.MINIMUM_CHALLENGES:
        raise failure("SHEET_STARS")
    selected = [concept["id"] for concept in scope["selectedConcepts"]]
    printed = {concept for slot in layout for concept in slot.question.row.concepts}
    if not set(selected) <= printed:
        raise failure("SHEET_COVERAGE")
    left = leak_checks.sheet_leaks([slot.question.ir for slot in layout], examples=examples)
    if left:
        raise failure(sorted({code for codes in left.values() for code in codes})[0])

    ir = {"version": 4, "contract": CONTRACT, "title": overlay["title"], "rule": rule_spans(overlay),
          "sections": [{"title": overlay["title"], "conceptIds": selected,
                        "questions": [deepcopy(slot.question.ir) for slot in layout]}],
          "selection": _selection_record(lesson, floor, selection)}
    ir = thaw(ir)
    checked = validate_source(lesson, ir, scope)
    diagnostics = _diagnostics(lesson, floor, selection, refusals, questions, rounds, len(layout))
    return CompileResult(ir, checked["evidence"], diagnostics)


compile_reply = compile_sheet


def repair_targets(diagnostics: dict) -> list:
    """[{slot, group, concepts, kinds, codes}] for still-missing slots, the input of a later repair prompt (no model text)."""
    return deepcopy(list((diagnostics or {}).get("missing") or ()))


__all__ = ["Refusal", "CompiledQuestion", "V5Error", "CompileResult", "plan_slots", "parse_wire", "compile_question",
           "compile_sheet", "compile_reply", "repair_targets", "REPAIR_ROUNDS"]
