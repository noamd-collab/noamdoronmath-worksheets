"""Closed data contract. Model output is never code, HTML, or a filesystem path."""
from __future__ import annotations

import json
from fractions import Fraction
from pathlib import Path
from lesson_boundary import validated_boundary, validate_boundary_item

HERE = Path(__file__).resolve().parent
MAX_JSON_BYTES = 200_000


class GenerationError(ValueError):
    def __init__(self, code, detail):
        self.code = code
        super().__init__(detail)


def reject(code, detail):
    raise GenerationError(code, detail)


def exact(obj, keys, where):
    if not isinstance(obj, dict) or set(obj) != set(keys):
        reject("INVALID_MODEL_OUTPUT", f"{where}: expected fields {','.join(keys)}")


def integer(value, low, high, where):
    if type(value) is not int or not low <= value <= high:
        reject("INVALID_MODEL_OUTPUT", f"{where}: integer outside allowed range")
    return value


def capabilities():
    return json.loads((HERE / "capabilities.json").read_text(encoding="utf-8"))


def capability(lesson):
    if not isinstance(lesson,dict): reject("INVALID_LESSON", "Expected a lesson object")
    if type(lesson.get("gradeNumber")) is not int or type(lesson.get("version")) is not int or lesson.get("version") not in (1, 2):
        reject("INVALID_LESSON", "Expected a supported intake version and integer gradeNumber")
    for cap in capabilities()["topics"]:
        if cap["topicId"] == lesson.get("topicId") and cap["gradeNumber"] == lesson["gradeNumber"]:
            if not cap.get("enabled"):
                reject("UNSUPPORTED_TOPIC", "Adapter candidate is not enabled until its complete end-to-end gates pass")
            return cap
    reject("UNSUPPORTED_TOPIC", "This exact grade/topic does not yet have a trusted adapter")


def number(value, cap, where):
    if type(value) is int:
        integer(value, -cap["maxNumber"] if cap.get("negative") else 0, cap["maxNumber"], where)
        return Fraction(value)
    exact(value, ("numerator", "denominator"), where)
    if not cap.get("fractions"):
        reject("INVALID_MODEL_OUTPUT", "Fractions are not supported for this topic")
    n = integer(value["numerator"], 0, cap["maxNumber"], where)
    d = integer(value["denominator"], 2, 20, where)
    f = Fraction(n, d)
    if f.numerator != n or f.denominator != d:
        reject("INVALID_MODEL_OUTPUT", "Write fractions in lowest terms")
    return f


def calculate(left, op, right):
    if op == "add": return left + right
    if op == "subtract": return left - right
    if op == "multiply": return left * right
    if op == "divide" and right != 0: return left / right
    reject("INVALID_MODEL_OUTPUT", "Unknown operation or division by zero")


def validate_lesson(lesson, *, allow_legacy=False):
    cap = capability(lesson)
    validated_boundary(lesson, allow_legacy=allow_legacy)
    if lesson.get("level") not in ("a", "b", "e"):
        reject("INVALID_LESSON", "Expected level a, b or e")
    if lesson["level"] not in cap.get("levels", []):
        reject("UNSUPPORTED_LEVEL", "This pilot has a verified basic-level adapter only; advanced/excellence need distinct task families")
    if lesson.get("lessonGoal") not in ("practice", "review", "introduce", "assessment"):
        reject("INVALID_LESSON", "Unknown lesson goal")
    # Assessment needs a separate student file/key; do not silently print answers.
    if lesson["lessonGoal"] == "assessment":
        reject("UNSUPPORTED_GOAL", "Assessment with a separate answer key is not implemented")
    if lesson["lessonGoal"] == "introduce":
        reject("UNSUPPORTED_GOAL", "The first adapter supports practice and review only")
    integer(lesson.get("questionCount"), 4, 40, "questionCount")
    if cap.get("questionCounts") and lesson["questionCount"] not in cap["questionCounts"]:
        reject("UNSUPPORTED_VOLUME", "The pilot only supports its validated full-sheet question counts")
    integer(lesson.get("minutes"), 5, 180, "minutes")
    for field in ("lastLesson", "classLabel"):
        value = lesson.get(field, "")
        if not isinstance(value, str) or len(value) > (1000 if field == "lastLesson" else 80):
            reject("INVALID_LESSON", f"Invalid {field}")
    if not isinstance(lesson.get("alreadyLearned"), list) or len(lesson["alreadyLearned"]) > 60:
        reject("INVALID_LESSON", "Invalid alreadyLearned")
    if not all(isinstance(v, str) and len(v) <= 120 for v in lesson["alreadyLearned"]):
        reject("INVALID_LESSON", "Invalid alreadyLearned item")
    # Free-text progress is context for authoring, never an authorization to add tools.
    if lesson.get("taughtThroughTopicId") not in (None, lesson["topicId"]):
        reject("UNSUPPORTED_PROGRESS", "This pilot requires the selected topic as the taught-through boundary")
    minimum = 8 if lesson["gradeNumber"] <= 2 else 12 if lesson["gradeNumber"] <= 4 else 14 if lesson["gradeNumber"] <= 6 else 20
    if lesson["questionCount"] < minimum:
        # No hidden relaxation of the installed engine's volume gates.
        reject("UNSUPPORTED_SHORT_SHEET", f"This adapter requires at least {minimum} questions; explicit short-sheet support is pending")
    return cap


def validate_model(lesson, payload, *, allow_legacy=False):
    cap = validate_lesson(lesson, allow_legacy=allow_legacy)
    boundary = validated_boundary(lesson, allow_legacy=allow_legacy)
    if len(json.dumps(payload, ensure_ascii=False).encode()) > MAX_JSON_BYTES:
        reject("INVALID_MODEL_OUTPUT", "Model output too large")
    exact(payload, ("version", "questions"), "root")
    if payload["version"] != 1 or type(payload["version"]) is not int:
        reject("INVALID_MODEL_OUTPUT", "Unsupported model schema")
    qs = payload["questions"]
    if not isinstance(qs, list) or len(qs) != lesson["questionCount"]:
        reject("INVALID_MODEL_OUTPUT", "Question count must match the requested count")
    kinds, stars, seen, counts = set(), 0, set(), {}
    for qi, q in enumerate(qs):
        exact(q, ("kind", "star", "items"), f"question {qi+1}")
        if q["kind"] not in cap["questionKinds"] or type(q["star"]) is not bool:
            reject("INVALID_MODEL_OUTPUT", "Unsupported question kind/star")
        kinds.add(q["kind"]); stars += q["star"]
        counts[q["kind"]] = counts.get(q["kind"], 0) + 1
        if q["star"] and q["kind"] in ("calculate", "solve"):
            reject("UNSUPPORTED_CHALLENGE", "A challenge must change the task structure, not only its numbers")
        if not isinstance(q["items"], list) or not (5 if lesson["gradeNumber"] <= 2 else 3) <= len(q["items"]) <= 6:
            reject("INVALID_MODEL_OUTPUT", "Expected 3–6 items (5–6 in grades 1–2)")
        for item in q["items"]:
            if cap["family"] == "linear_equation":
                exact(item, ("a", "b", "c", "solution"), "equation")
                a = integer(item["a"], 1, 12, "a")
                b = integer(item["b"], -100, 100, "b")
                c = integer(item["c"], -250, 250, "c")
                x = integer(item["solution"], -20, 20, "solution")
                if a*x+b != c: reject("WRONG_ANSWER", "Equation solution does not satisfy the equation")
            else:
                exact(item, ("left", "op", "right", "answer"), "arithmetic")
                if item["op"] not in cap["operations"]:
                    reject("INVALID_MODEL_OUTPUT", "Operation is outside this topic")
                left, right, answer = (number(item[k], cap, k) for k in ("left", "right", "answer"))
                result = calculate(left, item["op"], right)
                if result != answer: reject("WRONG_ANSWER", "Arithmetic answer does not match independently computed result")
                if not cap.get("negative") and answer < 0: reject("INVALID_MODEL_OUTPUT", "Negative result outside topic")
                if not cap.get("fractions") and result.denominator != 1: reject("INVALID_MODEL_OUTPUT", "Noninteger result outside topic")
                if q["kind"] == "missing_operand" and item["op"] == "multiply" and right == 0:
                    reject("AMBIGUOUS_ITEM", "Missing factor is not unique when multiplied by zero")
                if q["kind"] == "missing_right" and item["op"] in ("multiply", "divide") and left == 0:
                    reject("AMBIGUOUS_ITEM", "Missing factor/divisor is not unique with zero")
                tid = cap["topicId"]
                if tid in ("ב16", "ב17", "ב18", "ב19"):
                    factors = (left, right) if item["op"] == "multiply" else (answer, right)
                    if not all(v.denominator == 1 and 1 <= v <= 10 for v in factors) or not any(v in (2,3,4,5,6,10) for v in factors):
                        reject("OUTSIDE_TOPIC", "Grade 2 uses only the taught multiplication facts")
                if tid == "ג10" and not (1 <= right <= 10 and 0 <= answer <= 10):
                    reject("OUTSIDE_TOPIC", "Division must remain within the multiplication table")
                if tid == "ו01" and not ((left.denominator == 1) != (right.denominator == 1)):
                    reject("OUTSIDE_TOPIC", "This topic multiplies one fraction and one whole number")
                if tid == "ו06" and not (left.denominator > 1 and right.denominator == 1):
                    reject("OUTSIDE_TOPIC", "This first division-of-fractions topic divides a fraction by a whole number")
                if cap.get("noRegrouping"):
                    la, rb = int(left), int(right)
                    for place in (1, 10, 100, 1000, 10000):
                        if item["op"] == "add" and (la//place%10)+(rb//place%10) >= 10: reject("INVALID_MODEL_OUTPUT", "Regrouping before taught")
                        if item["op"] == "subtract" and la//place%10 < rb//place%10: reject("INVALID_MODEL_OUTPUT", "Borrowing before taught")
            validate_boundary_item(boundary, item)
            fingerprint = (q["kind"], json.dumps(item, sort_keys=True))
            if fingerprint in seen: reject("DUPLICATE_ITEM", "Duplicate task in worksheet")
            seen.add(fingerprint)
    if not 2 <= stars <= 4 or len(kinds) < 3:
        reject("INVALID_MODEL_OUTPUT", "Expected 2–4 challenge questions and at least 3 task structures")
    if cap.get("requiredKindCounts") and counts != cap["requiredKindCounts"]:
        reject("INSUFFICIENT_VARIETY", "Use the capability's exact task-structure balance")
    return cap


def read_json(path):
    data = Path(path).read_bytes()
    if len(data) > MAX_JSON_BYTES: reject("INPUT_TOO_LARGE", "JSON input too large")
    def pairs(items):
        out = {}
        for k, v in items:
            if k in out: reject("INVALID_JSON", "Duplicate JSON field")
            out[k] = v
        return out
    try:
        return json.loads(data, object_pairs_hook=pairs, parse_constant=lambda _: reject("INVALID_JSON", "Nonfinite number"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        reject("INVALID_JSON", "Invalid UTF-8 JSON")
