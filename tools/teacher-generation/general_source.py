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
MAX_BYTES = 160_000
MAX_ITEMS = 180
SHAPES = {
    "rectangle": {"w", "h"}, "square": {"a"},
    "parallelogram": {"a", "b", "angle"}, "rhombus": {"d1", "d2"},
    "trapezoid": {"a", "b", "h", "dx"}, "kite": {"a", "b", "q"},
    "triangle": {"a", "b", "c"}, "polygon": {"n", "a"}, "circle": {"r"},
}


class GeneralSourceError(ValueError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


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


def rich(value, grade, *, provider=False, location=""):
    # Only the provider boundary accepts equivalent wire representations.
    # Do not infer the meaning of bare math, labels, markup or unknown objects.
    if provider:
        if type(value) in (str, dict):
            value = [value]
        if type(value) is list and 1 <= len(value) <= 30:
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
                bad("SOURCE_PLAIN_MATH", "Middle-school numbers and Latin names require typed spans")
        elif kind == "math":
            exact(span, ("kind", "expression")); inspect_ast(span["expression"])
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


def validate_source(lesson, payload, scope, *, provider=False):
    try:
        return _validate_source(lesson, payload, scope, provider=provider)
    except MathTaskError as error:
        raise GeneralSourceError(error.code, "A typed mathematical task is invalid or outside the supported exact verifier") from None


def _validate_source(lesson, payload, scope, *, provider):
    """Return normalized source plus evidence, never an approval assertion."""
    try:
        size = len(json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8"))
    except (TypeError, ValueError, RecursionError):
        bad("SOURCE_JSON", "Source must be finite JSON")
    if size > MAX_BYTES:
        bad("SOURCE_SIZE", "Source exceeds byte budget")
    exact(payload, ("version", "title", "rule", "sections"))
    if type(payload["version"]) is not int or payload["version"] != 4:
        bad("SOURCE_VERSION", "Expected source version four")
    if scope["topic"]["gradeNumber"] != lesson["gradeNumber"] or scope["topic"]["topicId"] != lesson["topicId"] or lesson["level"] not in scope["levels"]:
        bad("SOURCE_SCOPE", "Lesson and trusted curriculum scope disagree")
    grade = lesson["gradeNumber"]
    normalized = deepcopy(payload)
    text(payload["title"], 160)
    normalized["rule"] = rich(payload["rule"], grade, provider=provider, location="rule")
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
            exact(question, ("intro", "star", "items"), ("table", "figure", "drawingFromWords"))
            qcount += 1
            question["intro"] = rich(question["intro"], grade, provider=provider, location=f"q{qcount}.intro")
            if type(question["star"]) is not bool:
                bad("SOURCE_STAR", "Star must be boolean")
            stars += int(question["star"])
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
            if "figure" in question:
                validate_figure(question["figure"], scope)
            if "drawingFromWords" in question:
                if type(question["drawingFromWords"]) is not bool or not geometry_topic(scope):
                    bad("DRAWING_POLICY","Drawing-from-words is permitted only in an authorized figure topic")
                if question["drawingFromWords"] and "figure" in question:
                    bad("SOURCE_FIGURE","A drawing-from-words task must leave the requested figure blank")
            if type(question["items"]) is not list or not (5 if grade <= 2 else 3) <= len(question["items"]) <= 9:
                bad("SOURCE_ITEMS", "Broad worksheets require at least five items per question in grades one and two, and three items otherwise")
            for j, item in enumerate(question["items"], 1):
                exact(item, ("prompt", "answer"))
                item_count += 1
                item["prompt"] = rich(item["prompt"], grade, provider=provider, location=f"q{qcount}.item.{j}.prompt")
                answer = item["answer"]
                if type(answer) is not dict:
                    bad("SOURCE_ANSWER", "Expected typed answer")
                item_id = f"q{qcount}-i{j}"
                if answer.get("kind") == "computed":
                    exact(answer, ("kind", "task", "unit")); text(answer["unit"], 50, empty=True)
                    solved = validate_and_solve_task(answer["task"])
                    evidence.append({"itemId": item_id, "computed": solved})
                elif answer.get("kind") == "figure":
                    exact(answer,("kind","operation","unit"),("point",));text(answer["unit"],50,empty=True)
                    if "figure" not in question or answer["operation"] not in FIGURE_OPERATIONS:
                        bad("SOURCE_FIGURE_TASK","Figure answers must bind to the question's actual figure")
                    try:solved=solve_figure_task(question["figure"],answer["operation"],answer.get("point"))
                    except ValueError:bad("SOURCE_FIGURE_TASK","This figure quantity has no implemented exact verifier")
                    evidence.append({"itemId":item_id,"computed":solved})
                elif answer.get("kind") == "review":
                    exact(answer, ("kind", "text"))
                    answer["text"] = rich(answer["text"], grade, provider=provider, location=f"q{qcount}.item.{j}.answer")
                    pending.append({"itemId": item_id, "reason": "No implemented exact verifier for this authored answer or proof"})
                else:
                    bad("SOURCE_ANSWER", "Only computed or explicitly unverified review answers are supported")
    if qcount != lesson["questionCount"] or not 4 <= qcount <= 30 or item_count > MAX_ITEMS:
        bad("SOURCE_VOLUME", "Source must exactly match the requested question count and item budget")
    if seen != allowed:
        bad("SOURCE_COVERAGE", "Every selected concept must be represented by a section")
    if not 2 <= stars <= 4:
        bad("SOURCE_STARS", "The pinned skill requires two to four starred questions")
    prose = " ".join(_prose_strings(normalized))
    if not HEBREW.search(prose):
        bad("SOURCE_LANGUAGE", "Expected original Hebrew worksheet prose")
    if grade >= 3 and NIQQUD.search(prose):
        bad("SOURCE_NIQQUD", "Grades three and up use unvocalized prose")
    if grade <= 2 and any(HEBREW.search(s) and not NIQQUD.search(s) for s in _prose_strings(normalized)):
        bad("SOURCE_NIQQUD", "Grades one and two require vocalized prose in every Hebrew text field")
    return {"source": normalized, "evidence": {"version": 1, "computations": evidence,
        "unverifiedAnswers": pending, "reviewRequired": True,
        "verificationScope": "Typed tasks only. Prose-task alignment, chronology, pedagogy, figure claims and visual output require independent review.",
        "curriculumSha256": scope["curriculum"]["sha256"]}}


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
    prose_st=dict(st)
    if lesson["gradeNumber"]>=7:
        prose_st["allOf"]=[{"pattern":r"^[^0-9A-Za-z]*$"}]
    num = {"type": "integer", "minimum": -1_000_000, "maximum": 1_000_000}
    expr = {"$ref": "#/$defs/expression"}
    task = {"$ref": "#/$defs/task"}
    rt = {"$ref": "#/$defs/rich"}
    expression = {"oneOf": [obj({"type": {"const": "number"}, "numerator": num, "denominator": {"type": "integer", "minimum": 1, "maximum": 1_000_000}}), obj({"type": {"const": "symbol"}, "name": {"enum": ["x", "y", "a", "b"]}}), obj({"type": {"const": "operation"}, "op": {"enum": ["add", "multiply"]}, "args": arr(expr, 2, 6)}), obj({"type": {"const": "operation"}, "op": {"enum": ["subtract", "divide", "power"]}, "args": arr(expr, 2, 2)}), obj({"type": {"const": "operation"}, "op": {"const": "sqrt"}, "args": arr(expr, 1, 1)})]}
    tasks = [obj({"kind": {"enum": ["evaluate", "simplify", "factor", "expand"]}, "expression": expr}), obj({"kind": {"const": "compare"}, "left": expr, "right": expr}), obj({"kind": {"const": "solve"}, "lhs": expr, "rhs": expr, "variable": {"enum": ["x", "y", "a", "b"]}}), obj({"kind": {"const": "substitute"}, "expression": expr, "values": {"type": "object", "properties": {n: expr for n in ("x", "y", "a", "b")}, "additionalProperties": False, "minProperties": 1}})]
    tasks += [obj({"kind":{"const":"solve_system"},"variables":arr({"enum":["x","y","a","b"]},2,2),"equations":arr(obj({"lhs":expr,"rhs":expr}),2,2)}), obj({"kind":{"const":"inequality"},"variable":{"enum":["x","y","a","b"]},"lhs":expr,"rhs":expr,"relation":{"enum":["lt","le","gt","ge"]}}), obj({"kind":{"const":"statistics"},"operation":{"enum":["mean","median","mode","range","sort"]},"values":arr(expression["oneOf"][0],1,64)})]
    rich_schema = arr({"oneOf": [obj({"kind": {"const": "text"}, "text": prose_st}), obj({"kind": {"const": "math"}, "expression": expr}), obj({"kind": {"const": "geometry"}, "type": {"enum": ["point", "segment", "triangle", "angle", "polygon"]}, "names": {"type": "string", "pattern": "^[A-Z]{1,8}$"}})]})
    unit_schema={"type":"string","maxLength":50,"pattern":plain_pattern}
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
