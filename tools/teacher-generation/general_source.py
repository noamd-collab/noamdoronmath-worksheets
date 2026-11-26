"""Bounded, data-only authoring contract for original worksheet drafts.

Version four separates original prose from expressions that the exact kernel
actually proves. No provider field can certify a draft or introduce code, raw
markup, file paths, renderer options, or human approvals. A successful parse is
not a pedagogical, prose, geometric-proof, or visual approval.
"""
from __future__ import annotations

from copy import deepcopy
import json
import re

from math_tasks import inspect_ast, validate_and_solve_task, MathTaskError
from general_geometry import solve_figure_task, FIGURE_OPERATIONS

CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]")
MARKUP = re.compile(r"[<>$\\]|(?:https?|file|data):", re.I)
HEBREW = re.compile(r"[\u05d0-\u05ea]")
NIQQUD = re.compile(r"[\u05b0-\u05bc\u05c1\u05c2\u05c7]")
NAMES = re.compile(r"[A-Z]{1,12}\Z")
# Root marker of a compiled worksheet-wire/5 source (equal to structured_contract.CONTRACT). The v5 branches
# below run only when a trusted caller passes validate_source(..., contract=V5_CONTRACT) AND the source carries
# this marker; the marker alone selects nothing, and every other call takes exactly the code it took before.
V5_CONTRACT = "worksheet-wire/5"
MAX_BYTES = 160_000
MAX_ITEMS = 180
SHAPES = {
    "rectangle": {"w", "h"}, "square": {"a"},
    "parallelogram": {"a", "b", "angle"}, "rhombus": {"d1", "d2"},
    "trapezoid": {"a", "b", "h", "dx"}, "kite": {"a", "b", "q"},
    "triangle": {"a", "b", "c"}, "polygon": {"n", "a"}, "circle": {"r"},
}


class GeneralSourceError(ValueError):
    # One-based position of the refused question and of its item, when the
    # raiser knows them. A later stage replaces that question; it must not
    # have to parse a message.
    question = None
    item = None

    def __init__(self, code, message, *, question=None, item=None):
        self.code = code
        if question is not None:
            self.question = question
        if item is not None:
            self.item = item
        super().__init__(message)

    def at(self, question, item=None):
        """Record where the refusal happened, keeping an earlier, more exact position."""
        if self.question is None:
            self.question, self.item = question, item
        return self


def bad(code, message):
    raise GeneralSourceError(code, message)


def exact(value, required, optional=()):
    if type(value) is not dict or not set(required) <= set(value) or set(value) - set(required) - set(optional):
        bad("SOURCE_SHAPE", "Unexpected or missing source fields")


def text(value, maximum=1000, empty=False):
    if (type(value) is not str or len(value) > maximum or (not empty and not value.strip())
            or CONTROL.search(value) or MARKUP.search(value)):
        bad("SOURCE_TEXT", "Text must be bounded plain text; use typed mathematics instead of markup")
    return value


def bounded_int(value, lo, hi):
    if type(value) is not int or not lo <= value <= hi:
        bad("SOURCE_NUMBER", "Integer outside supported bounds")
    return value


def _rich_v5(value, grade, overlay, location):
    """v5 spans: text (Hebrew prose, code-written) and display (canonical school grammar) only."""
    from item_kinds import BindingError, check_display_span
    from text_lint import check_ir_spans, check_ir_text
    where = " at " + location if location else ""
    if type(value) is not list or not 1 <= len(value) <= 30:
        bad("SOURCE_RICH_TEXT", "A text block needs one to thirty typed spans" + where)
    for span in value:
        if type(span) is not dict:
            bad("SOURCE_RICH_TEXT", "Expected a typed span" + where)
        kind = span.get("kind")
        if kind == "text":
            exact(span, ("kind", "text")); text(span["text"], 1200)
            if re.search(r"[0-9A-Za-z]", span["text"]) or check_ir_text(span["text"]):
                bad("SOURCE_PLAIN_MATH", "v5 text spans hold Hebrew prose only" + where)
        elif kind == "display":
            try:
                check_display_span(span, overlay)
            except BindingError as error:
                bad("SOURCE_DISPLAY", error.code + where)
        else:
            bad("SOURCE_RICH_TEXT", "Unsupported text span" + where)
    if check_ir_spans(value):
        bad("SOURCE_ATOM", "Two atoms need Hebrew text between them and no bracket beside them" + where)
    return deepcopy(value)


def _v5_overlay(lesson, scope):
    from structured_contract import overlay_for
    overlay = overlay_for(lesson["topicId"], lesson["level"])
    if overlay is None or scope["topic"]["skillId"] != overlay.get("skill", "middle"):
        bad("SOURCE_WIRE_SCOPE", "This topic and level are not enabled for worksheet-wire/5")
    return overlay


def rich(value, grade, *, provider=False, location="", v5=False, overlay=None):
    if v5:
        return _rich_v5(value, grade, overlay, location)
    # Only the provider boundary accepts equivalent wire representations.
    # Do not infer the meaning of bare math, labels, markup or unknown objects.
    if provider:
        if type(value) in (str, dict):
            value = [value]
        if type(value) is list and 1 <= len(value) <= 30:
            from compact_authoring import provider_span_array
            value = provider_span_array(value, grade)
            value = [
                {"kind": "text", "text": span}
                if type(span) is str and HEBREW.search(span)
                and re.fullmatch(r"[א-ת\u05b0-\u05bc\u05c1\u05c2\u05c7\u05be\u05f3\u05f4 .,!?׳״:;…()\-]+", span)
                else span for span in value
            ]

    if type(value) is not list or not 1 <= len(value) <= 30:
        bad("SOURCE_RICH_TEXT", "A text block needs one to thirty typed spans" + (" at " + location if location else ""))
    for span in value:
        if type(span) is not dict:
            bad("SOURCE_RICH_TEXT", "Expected a typed span" + (" at " + location if location else ""))
        kind = span.get("kind")
        if kind == "text":
            exact(span, ("kind", "text")); text(span["text"], 1200)
            if grade >= 7 and re.search(r"[0-9A-Za-z]", span["text"]):
                bad("SOURCE_PLAIN_MATH", "Middle-school numbers and Latin names require typed spans" + (" at " + location if location else ""))
        elif kind == "math":
            exact(span, ("kind", "expression")); inspect_ast(span["expression"])
        elif kind == "formula":
            from compact_authoring import display_parts
            exact(span, ("kind", "notation"))
            display_parts(span["notation"],grade)
        elif kind == "geometry":
            exact(span, ("kind", "type", "names"))
            lengths = {"point": (1, 1), "segment": (2, 2), "triangle": (3, 3), "angle": (3, 3), "polygon": (3, 8)}
            if grade < 7 or type(span["type"]) is not str or span["type"] not in lengths or type(span["names"]) is not str or not NAMES.fullmatch(span["names"]):
                bad("SOURCE_NOTATION", "Geometry notation requires bounded uppercase names in middle school")
            low, high = lengths[span["type"]]
            if not low <= len(span["names"]) <= high or len(set(span["names"])) != len(span["names"]):
                bad("SOURCE_NOTATION", "Wrong number of distinct points")
        else:
            bad("SOURCE_RICH_TEXT", "Unsupported text span" + (" at " + location if location else ""))
    return deepcopy(value)


DRAWING_REQUEST = re.compile(
    r"(?<![א-ת])(?:ו?(?:ציירו|שרטטו|סרטטו)|(?:היעזרו|העזרו|התבוננו|הסתכלו) "
    r"ב(?:שרטוט|סרטוט|איור|ציור|תרשים)|(?:הוסיפו|השלימו|צרו|הכינו) (?:שרטוט|סרטוט|איור|ציור|תרשים))(?![א-ת])"
)


def geometry_topic(scope):
    """Only a geometry domain in the pinned curriculum permits drawings."""
    return scope["topic"]["domain"] in ("geometry", "analytic_geometry", "גיאומטרי", "גאומטרי")


def validate_figure(fig, scope):
    if type(fig) is not dict or not geometry_topic(scope):
        bad("DRAWING_POLICY", "This topic does not permit this figure")
    kind = fig["kind"]
    middle = scope["topic"]["skillId"] == "middle"
    if kind == "coordinate_plane" and middle:
        exact(fig,("kind","xr","yr","points","segments"),("placement",))
        if fig.get("placement","side") not in ("side","wide"):bad("SOURCE_FIGURE","Unknown coordinate figure placement")
        for key in ("xr","yr"):
            span=fig[key]
            if type(span) is not list or len(span)!=2:bad("SOURCE_FIGURE","Axes need two integer bounds")
            for value in span:bounded_int(value,-10,10)
            if not span[0]<=0<=span[1] or not 2<=span[1]-span[0]<=16:bad("SOURCE_FIGURE","Coordinate window must contain the origin")
        if type(fig["points"]) is not list or not 1<=len(fig["points"])<=8:bad("SOURCE_FIGURE","Coordinate plane needs one to eight points")
        names=set()
        for point in fig["points"]:
            exact(point,("name","x","y"))
            if type(point["name"]) is not str or not re.fullmatch("[A-Z]",point["name"]) or point["name"] in names:bad("SOURCE_FIGURE","Points need unique uppercase names")
            names.add(point["name"]);bounded_int(point["x"],*fig["xr"]);bounded_int(point["y"],*fig["yr"])
        if len({(p["x"],p["y"]) for p in fig["points"]})!=len(fig["points"]):bad("SOURCE_FIGURE","Distinct names require distinct points")
        if type(fig["segments"]) is not list or len(fig["segments"])>10:bad("SOURCE_FIGURE","Too many coordinate segments")
        for pair in fig["segments"]:
            if type(pair) is not list or len(pair)!=2 or pair[0]==pair[1] or any(type(n) is not str or n not in names for n in pair):bad("SOURCE_FIGURE","Segments must reference existing distinct points")
    elif kind == "shape" and middle:
        exact(fig, ("kind", "shape", "parameters", "names", "rotate"))
        shape = fig["shape"]
        if type(shape) is not str or shape not in SHAPES:
            bad("SOURCE_FIGURE", "Unknown pinned shape constructor")
        exact(fig["parameters"], SHAPES[shape])
        for k, v in fig["parameters"].items():
            bounded_int(v, 0 if k == "dx" else 1, 179 if k == "angle" else 100)
        if shape == "polygon":
            bounded_int(fig["parameters"]["n"], 3, 8)
        if shape == "triangle":
            a, b, c = (fig["parameters"][k] for k in "abc")
            if max(a, b, c) * 2 >= a + b + c:
                bad("SOURCE_GEOMETRY", "Degenerate or impossible triangle")
        count = {"triangle": 3, "circle": 1, "polygon": fig["parameters"].get("n", 0)}.get(shape, 4)
        if type(fig["names"]) is not str or not NAMES.fullmatch(fig["names"]) or len(fig["names"]) != count or len(set(fig["names"])) != count:
            bad("SOURCE_FIGURE", "Shape requires one distinct uppercase name per vertex")
        bounded_int(fig["rotate"], -180, 180)
    elif kind == "grid_shape" and not middle:
        exact(fig, ("kind", "cells"))
        cells = fig["cells"]
        if type(cells) is not list or not 1 <= len(cells) <= 8 or type(cells[0]) is not list or not 1 <= len(cells[0]) <= 10:
            bad("SOURCE_FIGURE", "Grid is bounded to eight by ten")
        if any(type(r) is not list or len(r) != len(cells[0]) or any(type(x) is not int or x not in (0, 1) for x in r) for r in cells) or not any(map(any, cells)):
            bad("SOURCE_FIGURE", "Invalid cell mask")
    elif kind == "solid" and not middle:
        exact(fig, ("kind", "shape", "dimensions"))
        if fig["shape"] not in ("box", "cube", "prism", "pyramid") or type(fig["dimensions"]) is not list or len(fig["dimensions"]) != 3:
            bad("SOURCE_FIGURE", "Unsupported solid")
        for value in fig["dimensions"]:
            bounded_int(value, 1, 8)
        if fig["shape"]=="cube" and len(set(fig["dimensions"]))!=1:
            bad("SOURCE_FIGURE","Cube dimensions must all be equal")
    else:
        bad("SOURCE_FIGURE", "Figure constructor is not supported by this pinned skill")
    return deepcopy(fig)


def validate_prose(value, grade, scope, *, require_hebrew=False):
    prose = " ".join(_prose_strings(value))
    # The pointed "צַיְּרוּ" of grades one and two is spelled צירו.
    if not geometry_topic(scope) and (DRAWING_REQUEST.search(NIQQUD.sub("", prose)) or (
            grade <= 2 and re.search(r"(?<![א-ת])ו?צירו(?![א-ת])", NIQQUD.sub("", prose)))):
        bad("DRAWING_POLICY", "Only geometry lessons can give drawing instructions")
    if require_hebrew and not HEBREW.search(prose):
        bad("SOURCE_LANGUAGE", "Expected original Hebrew worksheet prose")
    if grade >= 3 and NIQQUD.search(prose):
        bad("SOURCE_NIQQUD", "Grades three and up use unvocalized prose")
    # The live line keeps its field-level pointing rule. The stricter word-level
    # check from the smooth-UX branch rejects valid abbreviations such as ס״מ.
    if grade <= 2 and any(HEBREW.search(s) and not NIQQUD.search(s) for s in _prose_strings(value)):
        bad("SOURCE_NIQQUD", "Grades one and two require vocalized prose in every Hebrew text field")


def validate_question(question, grade, scope, *, provider, qcount, evidence, pending):
    """Validate and normalize one expanded question, preserving its printed position."""
    exact(question, ("intro", "star", "items"), ("table", "figure", "drawingFromWords"))
    question["intro"] = rich(question["intro"], grade, provider=provider, location=f"q{qcount}.intro")
    if type(question["star"]) is not bool:
        bad("SOURCE_STAR", "Star must be boolean")
    if "table" in question:
        table = question["table"]; exact(table, ("head", "rows"))
        if type(table["head"]) is not list or not 2 <= len(table["head"]) <= 6 or type(table["rows"]) is not list or not 1 <= len(table["rows"]) <= 12:
            bad("SOURCE_TABLE", "Table exceeds supported size")
        for col, cell in enumerate(table["head"]):
            table["head"][col] = rich(cell, grade, provider=provider, location=f"q{qcount}.table.head.{col+1}")
        for row_num, row in enumerate(table["rows"], 1):
            if type(row) is not list or len(row) != len(table["head"]):
                bad("SOURCE_TABLE", "Table rows must have the header width")
            for col, cell in enumerate(row):
                row[col] = rich(cell, grade, provider=provider, location=f"q{qcount}.table.row.{row_num}.{col+1}")
    else:
        from compact_authoring import requires_existing_table
        if requires_existing_table(question):
            bad("SOURCE_TABLE", f"The question refers to a table that was not supplied at q{qcount}")
    if "figure" in question:
        validate_figure(question["figure"], scope)
    if "drawingFromWords" in question:
        if type(question["drawingFromWords"]) is not bool or not geometry_topic(scope):
            bad("DRAWING_POLICY","Drawing-from-words is permitted only in an authorized figure topic")
        if question["drawingFromWords"] and "figure" in question:
            bad("SOURCE_FIGURE","A drawing-from-words task must leave the requested figure blank")
    if type(question["items"]) is not list or not (5 if grade <= 2 else 3) <= len(question["items"]) <= 9:
        bad("SOURCE_ITEMS", "Broad worksheets require at least five items per question in grades one and two, and three items otherwise")
    keys = {}  # the solved task of each computed item, for the leak check below
    for j, item in enumerate(question["items"], 1):
        exact(item, ("prompt", "answer"))
        item["prompt"] = rich(item["prompt"], grade, provider=provider, location=f"q{qcount}.item.{j}.prompt")
        answer = item["answer"]
        if type(answer) is not dict:
            bad("SOURCE_ANSWER", "Expected typed answer")
        item_id = f"q{qcount}-i{j}"
        if answer.get("kind") == "computed":
            exact(answer, ("kind", "task", "unit"), ("notation",)); text(answer["unit"], 50, empty=True)
            if type(answer["task"]) is dict and answer["task"].get("kind") == "divide_remainder":
                # The kernel's worksheet-wire/5 elementary task kind stays outside the v4 contract:
                # refused exactly as before the kernel learned it (G1).
                raise MathTaskError("UNSUPPORTED_TASK", "No trusted solver for this task kind")
            solved = validate_and_solve_task(answer["task"])
            from printed_tasks import match_printed_task, printed_table_row, validate_computed_request
            validate_computed_request(question, item, solved, grade, location=f"q{qcount}.item.{j}")
            match_printed_task(item, solved, grade)
            printed_table_row(question, item, solved)
            if grade <= 6:
                from printed_elementary import printed_intent
                printed_intent(question, item, solved, grade, location=f"q{qcount}.item.{j}")
            if "notation" in answer:
                from compact_authoring import expression
                notation = answer["notation"]
                typed = solved["question"]
                sides = notation.split("___") if type(notation) is str else []
                if typed["kind"] == "compare" and len(sides) == 2:
                    # The written spelling of both compared sides, around the sign blank.
                    matches = [expression(side, grade) for side in sides] == [typed["left"], typed["right"]]
                else:
                    matches = (type(notation) is str and typed["kind"] == "evaluate"
                               and expression(notation, grade) == typed["expression"])
                if not matches:
                    bad("SOURCE_NOTATION", "The printed calculation must equal its exact typed task")
            from printed_parts import check_item, check_key_print
            try:
                decision = check_item(question, item, solved, grade, authored=provider)
                # The key as printed: only the solutions the item asks for, never beside its own prompt.
                keyed = check_key_print(question, item, solved, grade)
            except GeneralSourceError as error:
                if error.code == "PRINTED_ANSWER_KIND":
                    # A drawing outside geometry is refused as a drawing, whatever its answer.
                    try:
                        validate_prose({"intro": question["intro"], "prompt": item["prompt"]}, grade, scope)
                    except GeneralSourceError as policy:
                        raise policy.at(qcount, j)
                raise error.at(qcount, j)
            evidence.append({"itemId": item_id, "computed": solved})
            keys[j] = keyed
            if decision is not None and decision.proof["bound"] == "story":
                if scope["topic"]["skillId"] == "elementary":
                    # No binder proves that the typed claim reads the story's words, so
                    # its yes or no has no proven key. Elementary prints none such.
                    raise GeneralSourceError("PRINTED_ANSWER_KIND", "An elementary yes/no claim typed from a story has no proven key",
                                             question=qcount, item=j)
                # The verdict is exact for the typed claim. That the claim reads a
                # story correctly is as unverified as in any word problem; a yes or
                # a no hides a misreading, so the middle-school teacher is told.
                pending.append({"itemId": item_id, "question": qcount, "item": j, "kind": "decision",
                                "reason": "The decided claim was typed from a story; its reading of the words is unverified"})
        elif answer.get("kind") == "figure":
            exact(answer,("kind","operation","unit"),("point",));text(answer["unit"],50,empty=True)
            if "figure" not in question or answer["operation"] not in FIGURE_OPERATIONS:
                bad("SOURCE_FIGURE_TASK","Figure answers must bind to the question's actual figure")
            try:solved=solve_figure_task(question["figure"],answer["operation"],answer.get("point"))
            except ValueError:bad("SOURCE_FIGURE_TASK","This figure quantity has no implemented exact verifier")
            from printed_parts import check_item
            try:
                check_item(question, item, solved, grade)
            except GeneralSourceError as error:
                raise error.at(qcount, j)
            evidence.append({"itemId":item_id,"computed":solved})
        elif answer.get("kind") == "review":
            exact(answer, ("kind", "text"))
            answer["text"] = rich(answer["text"], grade, provider=provider, location=f"q{qcount}.item.{j}.answer")
            pending.append({"itemId": item_id, "question": qcount, "item": j, "kind": "review",
                            "reason": "No implemented exact verifier for this authored answer or proof"})
        else:
            bad("SOURCE_ANSWER", "Only computed, figure or explicitly unverified review answers are supported")
    from printed_parts import answer_leak
    leak = answer_leak(question, keys)
    if leak is not None:
        raise GeneralSourceError("PRINTED_ANSWER_LEAK", "An item prints the answer of an earlier item of the same question",
                                 question=qcount, item=leak)
    validate_prose(question, grade, scope)


def validate_source(lesson, payload, scope, *, provider=False, contract=None):
    """``contract`` (keyword only) is trusted caller configuration, never payload data. Only code that compiled
    the source itself sets it (structured_source.compile_sheet, v5_offline_render) or passes it through
    (runner.render_job, validation.validate_model, general_adapters): contract=V5_CONTRACT selects the
    worksheet-wire/5 branches, and the source must then carry the same root marker. Without it a root
    "contract" or "selection" key is SOURCE_SHAPE exactly as at bafa36f0, whatever the payload says. The
    provider boundary (provider=True, every model reply) never passes it."""
    if contract is not None and (contract != V5_CONTRACT or provider):
        raise ValueError("Unsupported trusted source contract")
    try:
        return _validate_source(lesson, payload, scope, provider=provider, contract=contract)
    except MathTaskError as error:
        raise GeneralSourceError(error.code, "A typed mathematical task is invalid or outside the supported exact verifier") from None


def _validate_source(lesson, payload, scope, *, provider, contract=None):
    """Return normalized source plus evidence, never an approval assertion."""
    try:
        size = len(json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8"))
    except (TypeError, ValueError, RecursionError):
        bad("SOURCE_JSON", "Source must be finite JSON")
    if size > MAX_BYTES:
        bad("SOURCE_SIZE", "Source exceeds byte budget")
    # worksheet-wire/5 is selected only by the trusted caller's contract= flag, never by the payload's own root
    # marker (model-shaped data): model output (the provider boundary, general_provider.compile_content) and every
    # unflagged caller keep a root "contract" or "selection" key as SOURCE_SHAPE, exactly as before v5 existed.
    v5 = contract == V5_CONTRACT
    if v5:
        exact(payload, ("version", "contract", "title", "rule", "sections", "selection"))
        if payload["contract"] != V5_CONTRACT:
            bad("SOURCE_SHAPE", "A trusted worksheet-wire/5 source carries its root marker")
    else:
        exact(payload, ("version", "title", "rule", "sections"))
    if type(payload["version"]) is not int or payload["version"] != 4:
        bad("SOURCE_VERSION", "Expected source version four")
    if scope["topic"]["gradeNumber"] != lesson["gradeNumber"] or scope["topic"]["topicId"] != lesson["topicId"] or lesson["level"] not in scope["levels"]:
        bad("SOURCE_SCOPE", "Lesson and trusted curriculum scope disagree")
    overlay = _v5_overlay(lesson, scope) if v5 else None
    grade = lesson["gradeNumber"]
    normalized = deepcopy(payload)
    text(payload["title"], 160)
    normalized["rule"] = rich(payload["rule"], grade, provider=provider, location="rule", v5=v5, overlay=overlay)
    if type(payload["sections"]) is not list or not 1 <= len(payload["sections"]) <= 8:
        bad("SOURCE_SECTIONS", "Need one to eight sections")
    allowed = {c["id"] for c in scope["selectedConcepts"]}
    seen, evidence, pending, qcount, item_count, stars = set(), [], [], 0, 0, 0
    for section in normalized["sections"]:
        exact(section, ("title", "conceptIds", "questions"))
        text(section["title"], 160)
        if type(section["conceptIds"]) is not list or not section["conceptIds"] or any(type(c) is not str or c not in allowed for c in section["conceptIds"]) or len(set(section["conceptIds"])) != len(section["conceptIds"]):
            bad("SOURCE_CONCEPT", "Sections must bind to selected source concepts")
        seen.update(section["conceptIds"])
        if type(section["questions"]) is not list or not 1 <= len(section["questions"]) <= 30:
            bad("SOURCE_QUESTIONS", "Empty or oversized section")
        for question in section["questions"]:
            qcount += 1
            if v5:
                item_count += _v5_question(question, grade, provider=provider, qcount=qcount, evidence=evidence,
                                           overlay=overlay)
            else:
                validate_question(question, grade, scope, provider=provider, qcount=qcount,
                                  evidence=evidence, pending=pending)
                item_count += len(question["items"])
            stars += int(question["star"])
    if v5:
        _v5_selection(lesson, scope, normalized, qcount, item_count)
    elif qcount != lesson["questionCount"] or not 4 <= qcount <= 30 or item_count > MAX_ITEMS:
        bad("SOURCE_VOLUME", "Source must exactly match the requested question count and item budget")
    if seen != allowed:
        bad("SOURCE_COVERAGE", "Every selected concept must be represented by a section")
    if not 2 <= stars <= 4:
        bad("SOURCE_STARS", "The pinned skill requires two to four starred questions")
    if v5:
        _v5_questions(normalized, overlay)
        _v5_code_written(lesson, scope, normalized, overlay)
    validate_prose(normalized, grade, scope, require_hebrew=True)
    if grade == 2 and scope["topic"]["topicId"] == "ב05" and allowed == {"ב05#1"}:
        from no_carry_addition import validate_topic_math
        validate_topic_math(normalized)
    if provider and len(json.dumps(normalized, ensure_ascii=False).encode("utf-8")) > MAX_BYTES:
        bad("SOURCE_SIZE", "Source exceeds byte budget")
    return {"source": normalized, "evidence": {"version": 1, "computations": evidence,
        "unverifiedAnswers": pending, "reviewRequired": True,
        "verificationScope": "Typed tasks only. Prose-task alignment, chronology, pedagogy, figure claims and visual output require independent review.",
        "curriculumSha256": scope["curriculum"]["sha256"]}}


def _v5_question(question, grade, *, provider, qcount, evidence, overlay):
    """One worksheet-wire/5 question (the v5 branch of the question loop); returns its item count.

    A v5 question prints a code-written one-way table only on an overlay that declares tables (the probability
    overlay: relative frequency); probability_kinds.verify_question binds it to the story. No figure and no
    drawing-from-words. Every answer is computed by the kernel and bound to its printed display (_v5_answer)."""
    exact(question, ("intro", "star", "items"), ("table",) if overlay.get("tables") is True else ())
    question["intro"] = rich(question["intro"], grade, provider=provider, location=f"q{qcount}.intro", v5=True, overlay=overlay)
    if type(question["star"]) is not bool:
        bad("SOURCE_STAR", "Star must be boolean")
    if "table" in question:
        table = question["table"]; exact(table, ("head", "rows"))
        if type(table["head"]) is not list or not 2 <= len(table["head"]) <= 6 or type(table["rows"]) is not list or not 1 <= len(table["rows"]) <= 12:
            bad("SOURCE_TABLE", "Table exceeds supported size")
        for col, cell in enumerate(table["head"]):
            table["head"][col] = rich(cell, grade, provider=provider, location=f"q{qcount}.table.head.{col+1}", v5=True, overlay=overlay)
        for row_num, row in enumerate(table["rows"], 1):
            if type(row) is not list or len(row) != len(table["head"]):
                bad("SOURCE_TABLE", "Table rows must have the header width")
            for col, cell in enumerate(row):
                row[col] = rich(cell, grade, provider=provider, location=f"q{qcount}.table.row.{row_num}.{col+1}", v5=True, overlay=overlay)
    if type(question["items"]) is not list or not 3 <= len(question["items"]) <= 6:
        bad("SOURCE_ITEMS", "A worksheet-wire/5 question has three to six items")
    for j, item in enumerate(question["items"], 1):
        exact(item, ("prompt", "answer"))
        item["prompt"] = rich(item["prompt"], grade, provider=provider, location=f"q{qcount}.item.{j}.prompt", v5=True, overlay=overlay)
        answer = item["answer"]
        if type(answer) is not dict:
            bad("SOURCE_ANSWER", "Expected typed answer")
        evidence.append({"itemId": f"q{qcount}-i{j}", "computed": _v5_answer(item, answer, overlay, f"q{qcount}.item.{j}")})
    return len(question["items"])


def _v5_answer(item, answer, overlay, location):
    """A worksheet-wire/5 answer: computed by the kernel, keyed and bound to its printed display (item_kinds)."""
    from item_kinds import BindingError, verify_item
    if answer.get("kind") != "computed":
        bad("SOURCE_ANSWER", "worksheet-wire/5 answers are computed and kernel-proven")
    exact(answer, ("kind", "task", "unit", "printTask", "key"))
    if answer["unit"] != "" or answer["printTask"] is not False:
        bad("SOURCE_SHAPE", "worksheet-wire/5 answers print no unit and no task")
    solved = validate_and_solve_task(answer["task"])
    try:
        verify_item(item["prompt"], answer, solved, overlay)
    except BindingError as error:
        code = "SOURCE_KEY" if error.code in ("KEY_ROUNDTRIP", "FORM_UNREPRESENTABLE", "FORM_UNKNOWN") else "SOURCE_BINDING"
        bad(code, f"{error.code} at {location}")
    return solved


def _v5_selection(lesson, scope, normalized, qcount, item_count):
    """Replaces only the exact-count rule: the selection record, recomputed against the grade floor."""
    from structured_contract import SelectionError, validate_selection
    if not 4 <= qcount <= 30 or item_count > MAX_ITEMS:
        bad("SOURCE_VOLUME", "Source exceeds the question or item budget")
    printed = [question for section in normalized["sections"] for question in section["questions"]]
    try:
        validate_selection(normalized["selection"], lesson=lesson, scope=scope, questions=printed)
    except SelectionError as error:
        bad(error.code, "Selection record: " + error.reason)


def _v5_questions(normalized, overlay):
    """Per question: one binding kind, the code-written intro and star; then question and sheet leaks."""
    from item_kinds import BindingError, verify_question
    import leak_checks
    questions = [question for section in normalized["sections"] for question in section["questions"]]
    if overlay.get("family") == "probability":
        # The probability kinds: their own repeats (DUPLICATE_ITEM, KEY_REPEATED, DUPLICATE_TASK, DUPLICATE_REORDERED)
        # and a question sharing a value with the rule box (LEAK_RULE_FACT). The pinned D12 mirror needs the trusted
        # skill path and runs in general_adapters.compile_source.
        import probability_kinds
        for n, question in enumerate(questions, 1):
            try:
                verify_question(question, overlay)
            except BindingError as error:
                bad("SOURCE_BINDING", f"{error.code} at q{n}")
            if probability_kinds.question_leaks(question, overlay):
                bad("SOURCE_LEAK", f"Duplicate item or repeated answer at q{n}")
        if probability_kinds.sheet_leaks(questions, overlay):
            bad("SOURCE_LEAK", "A task or a story with the same counts repeats across questions, or a question "
                               "shares a value with the rule box")
        return
    if overlay.get("skill") == "elementary":
        # The elementary division kinds: their own repeats (DUPLICATE_ITEM, DUPLICATE_TASK, EXAMPLE_COPY). The
        # pinned G62 mirror needs the trusted skill path and runs in general_adapters.compile_source.
        import division_kinds
        for n, question in enumerate(questions, 1):
            try:
                verify_question(question, overlay)
            except BindingError as error:
                bad("SOURCE_BINDING", f"{error.code} at q{n}")
            if division_kinds.question_leaks(question):
                bad("SOURCE_LEAK", f"Duplicate item at q{n}")
        if division_kinds.sheet_leaks(questions, overlay):
            bad("SOURCE_LEAK", "Duplicate division across questions or a copy of the rule box example")
        return
    for n, question in enumerate(questions, 1):
        try:
            verify_question(question, overlay)
        except BindingError as error:
            bad("SOURCE_BINDING", f"{error.code} at q{n}")
        if leak_checks.question_leaks(question, overlay, skill_path=None) or leak_checks.reordered_items(question):
            bad("SOURCE_LEAK", f"Answer leak or duplicate item at q{n}")
    if leak_checks.sheet_leaks(questions, examples=normalized["rule"]) or leak_checks.reordered_tasks(questions):
        bad("SOURCE_LEAK", "Duplicate task or linked answers across questions")


def _v5_code_written(lesson, scope, normalized, overlay):
    """What only code writes in a v5 source, checked last so every earlier refusal keeps its code:

    - the title, every section title and the rule box are exactly the overlay's (SOURCE_BINDING);
    - each printed question's kind is a kind of the plan row of the slot that produced it, and its recorded
      conceptIds are that row's concepts, recomputed with plan_rows instead of trusting the record
      (SOURCE_SELECTION)."""
    from structured_contract import ContractError, plan_rows, rule_spans
    if normalized["title"] != overlay["title"] or any(
            section["title"] != overlay["title"] for section in normalized["sections"]):
        bad("SOURCE_BINDING", "The title is the overlay's code-written title")
    if normalized["rule"] != rule_spans(overlay):
        bad("SOURCE_BINDING", "The rule box is the overlay's code-written rule")
    try:
        planned, reserves = plan_rows(lesson, scope, overlay)
    except ContractError:
        bad("SOURCE_WIRE_SCOPE", "This lesson has no worksheet-wire/5 plan")
    rows = {row.slot: row for row in list(planned) + list(reserves)}
    questions = [question for section in normalized["sections"] for question in section["questions"]]
    for n, (record, question) in enumerate(zip(normalized["selection"]["questions"], questions), 1):
        row = rows.get(record["slot"])
        kind = question["items"][0]["answer"]["key"]["binding"]["kind"]
        if row is None or kind not in row.kinds or record["conceptIds"] != list(row.concepts):
            bad("SOURCE_SELECTION", f"Question kind or concepts outside its planned row at q{n}")


def _prose_strings(value):
    if type(value) is dict:
        for key, child in value.items():
            if key in ("text", "title", "unit") and type(child) is str:
                yield child
            elif type(child) in (dict, list):
                yield from _prose_strings(child)
    elif type(value) is list:
        for child in value:
            yield from _prose_strings(child)


def authoring_schema(lesson, scope):
    """JSON Schema guides authoring; validate_source remains authoritative."""
    def obj(properties, required=None):
        return {"type": "object", "properties": properties, "required": list(properties) if required is None else required, "additionalProperties": False}
    def arr(item, minimum=1, maximum=30):
        return {"type": "array", "items": item, "minItems": minimum, "maxItems": maximum}
    plain_pattern=r"^(?![\s\S]*(?:[<>$\\]|(?:[hH][tT][tT][pP][sS]?|[fF][iI][lL][eE]|[dD][aA][tT][aA]):|[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]))[\s\S]*$"
    st = {"type": "string", "maxLength": 1200, "minLength": 1,"pattern":plain_pattern}
    grade = lesson["gradeNumber"]
    if grade <= 2:
        # This also covers titles copied from the unvocalized catalogue.
        vocalized = {"pattern": r"^(?:[^א-ת]*|[\s\S]*[\u05b0-\u05bc\u05c1\u05c2\u05c7][\s\S]*)$"}
        st["allOf"] = [vocalized]
    prose_st=dict(st)
    if lesson["gradeNumber"]>=7:
        prose_st["allOf"]=[{"pattern":r"^[^0-9A-Za-z]*$"}]
    num = {"type": "integer", "minimum": -1_000_000, "maximum": 1_000_000}
    expr = {"$ref": "#/$defs/expression"}
    task = {"$ref": "#/$defs/task"}
    rt = {"$ref": "#/$defs/rich"}
    middle = scope["topic"]["skillId"] == "middle"
    variables = {"enum": ["x", "y", "a", "b"]}
    rational = obj({"type": {"const": "number"}, "numerator": num,
                    "denominator": {"type": "integer", "minimum": 1, "maximum": 1_000_000}})
    multiple_ops = ["add"] if grade == 1 else ["add", "multiply"]
    binary_ops = ["subtract"] if grade == 1 else ["subtract", "divide"]
    if grade >= 4:
        binary_ops.append("power")
    expressions = [rational,
                   obj({"type": {"const": "operation"}, "op": {"enum": multiple_ops}, "args": arr(expr, 2, 6)}),
                   obj({"type": {"const": "operation"}, "op": {"enum": binary_ops}, "args": arr(expr, 2, 2)})]
    tasks = [obj({"kind": {"enum": ["evaluate", "simplify", "factor", "expand"]}, "expression": expr}),
             obj({"kind": {"const": "compare"}, "left": expr, "right": expr}),
             # A yes/no question: the kernel decides the claim, the author never writes the verdict.
             obj({"kind": {"const": "decide"}, "relation": {"enum": ["eq", "ne", "lt", "le", "gt", "ge", "divisible", "not_divisible"]},
                  "left": expr, "right": expr}),
             obj({"kind": {"const": "decide"}, "relation": {"enum": ["in", "not_in"]}, "left": expr, "values": arr(expr, 2, 12)}),
             obj({"kind": {"const": "statistics"}, "operation": {"enum": ["mean", "median", "mode", "range", "sort"]},
                  "values": arr(rational, 1, 64)})]
    spans = [obj({"kind": {"const": "text"}, "text": prose_st}),
             obj({"kind": {"const": "math"}, "expression": expr})]
    if middle:
        expressions.extend([
            obj({"type": {"const": "symbol"}, "name": variables}),
            obj({"type": {"const": "operation"}, "op": {"const": "sqrt"}, "args": arr(expr, 1, 1)})])
        tasks.extend([
            obj({"kind": {"const": "solve"}, "lhs": expr, "rhs": expr, "variable": variables}),
            obj({"kind": {"const": "substitute"}, "expression": expr, "values": {
                "type": "object", "properties": {name: expr for name in variables["enum"]},
                "additionalProperties": False, "minProperties": 1}}),
            obj({"kind": {"const": "solve_system"}, "variables": arr(variables, 2, 2),
                 "equations": arr(obj({"lhs": expr, "rhs": expr}), 2, 2)}),
            obj({"kind": {"const": "inequality"}, "variable": variables, "lhs": expr, "rhs": expr,
                 "relation": {"enum": ["lt", "le", "gt", "ge"]}})])
        spans.append(obj({"kind": {"const": "geometry"},
                          "type": {"enum": ["point", "segment", "triangle", "angle", "polygon"]},
                          "names": {"type": "string", "pattern": "^[A-Z]{1,8}$"}}))
    expression = {"oneOf": expressions}
    rich_schema = arr({"oneOf": spans})
    unit_schema={"type":"string","maxLength":50,"pattern":plain_pattern}
    if grade <= 2:
        unit_schema["allOf"] = [vocalized]
    answers = [obj({"kind": {"const": "computed"}, "task": task, "unit": unit_schema})]
    if scope["topic"]["skillId"] == "middle":
        answers.append(obj({"kind": {"const": "review"}, "text": rt}))
    answer = {"oneOf": answers}
    figures = []
    if scope["topic"]["skillId"] == "middle" and geometry_topic(scope):
        for shape, keys in SHAPES.items():
            figures.append(obj({"kind": {"const": "shape"}, "shape": {"const": shape}, "parameters": obj({k: {"type": "integer", "minimum": 0 if k == "dx" else 1, "maximum": 179 if k == "angle" else 100} for k in sorted(keys)}), "names": {"type": "string", "pattern": "^[A-Z]{1,8}$"}, "rotate": {"type": "integer", "minimum": -180, "maximum": 180}}))
        figures.append(obj({"kind":{"const":"coordinate_plane"},"xr":arr({"type":"integer","minimum":-10,"maximum":10},2,2),"yr":arr({"type":"integer","minimum":-10,"maximum":10},2,2),"points":arr(obj({"name":{"type":"string","pattern":"^[A-Z]$"},"x":{"type":"integer","minimum":-10,"maximum":10},"y":{"type":"integer","minimum":-10,"maximum":10}}),1,8),"segments":arr(arr({"type":"string","pattern":"^[A-Z]$"},2,2),0,10),"placement":{"enum":["side","wide"]}},["kind","xr","yr","points","segments"]))
    elif scope["topic"]["skillId"] == "elementary" and geometry_topic(scope):
        figures += [obj({"kind": {"const": "grid_shape"}, "cells": arr(arr({"enum": [0, 1]}, 1, 10), 1, 8)}), obj({"kind": {"const": "solid"}, "shape": {"enum": ["box", "cube", "prism", "pyramid"]}, "dimensions": arr({"type": "integer", "minimum": 1, "maximum": 8}, 3, 3)})]
    props = {"intro": rt, "star": {"type": "boolean"}, "items": arr(obj({"prompt": rt, "answer": answer}), 5 if lesson["gradeNumber"]<=2 else 3, 9), "table": obj({"head": arr(rt, 2, 6), "rows": arr(arr(rt, 2, 6), 1, 12)})}
    if figures:
        props["figure"] = {"oneOf": figures}
        props["drawingFromWords"]={"type":"boolean"}
        answers.append(obj({"kind":{"const":"figure"},"operation":{"enum":list(FIGURE_OPERATIONS)},"unit":unit_schema,"point":{"type":"string","pattern":"^[A-Z]$"}},["kind","operation","unit"]))
    question = obj(props, ["intro", "star", "items"])
    result = obj({"version": {"const": 4}, "title": {**st,"maxLength":160}, "rule": rt, "sections": arr(obj({"title": {**st,"maxLength":160}, "conceptIds": arr({"enum": [c["id"] for c in scope["selectedConcepts"]]}, 1, len(scope["selectedConcepts"])), "questions": arr(question, 1, lesson["questionCount"])}), 1, 8)})
    result["$defs"] = {"expression": expression, "task": {"oneOf": tasks}, "rich": rich_schema}
    return result
