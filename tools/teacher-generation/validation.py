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
    from runtime_catalog import general_capabilities
    return general_capabilities(json.loads((HERE / "capabilities.json").read_text(encoding="utf-8")))


def capability(lesson):
    if not isinstance(lesson,dict): reject("INVALID_LESSON", "Expected a lesson object")
    if type(lesson.get("gradeNumber")) is not int or type(lesson.get("version")) is not int or lesson.get("version") not in (1, 2, 3):
        reject("INVALID_LESSON", "Expected a supported intake version and integer gradeNumber")
    if lesson['version'] == 3:
        from runtime_catalog import scope_for_lesson, topic_capability
        from curriculum_scope import CurriculumScopeError
        try:
            scope = scope_for_lesson(lesson)
            return topic_capability({**scope['topic'], 'levels': scope['levels']})
        except CurriculumScopeError as exc:
            reject('INVALID_LESSON_BOUNDARY', str(exc))
    for cap in json.loads((HERE / 'capabilities.json').read_text(encoding='utf-8'))['topics']:
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


def salvaged_count(requested, printed, grade):
    """Whether ``printed`` questions may be delivered for a sheet of ``requested`` questions in ``grade``.

    Only the worker's salvage shortens a sheet (lesson_select): never below
    three quarters of the request, never below six questions, and never below
    the grade minimum that validate_lesson enforces on every request.
    """
    from lesson_select import minimum_count
    from runtime_catalog import question_floor
    return (type(requested) is int and type(printed) is int and type(grade) is int
            and minimum_count(requested, question_floor(grade)) <= printed < requested)


def validate_lesson(lesson, *, allow_legacy=False, salvaged_from=None):
    """``salvaged_from`` is the question count the teacher asked for when the
    worker delivers a shorter, salvaged sheet. It is trusted worker state and
    is never read from a job: the request itself must pass every check."""
    if salvaged_from is not None:
        if (not isinstance(lesson, dict) or lesson.get('version') != 3
                or not salvaged_count(salvaged_from, lesson.get('questionCount'), lesson.get('gradeNumber'))):
            reject("UNSUPPORTED_SHORT_SHEET",
                   "A salvaged sheet keeps at least three quarters of the requested questions and the grade minimum")
        cap = validate_lesson({**lesson, 'questionCount': salvaged_from}, allow_legacy=allow_legacy)
        integer(lesson.get("questionCount"), 4, 40, "questionCount")
        return cap
    cap = capability(lesson)
    general = lesson['version'] == 3
    if not general:
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
    # An opening sheet is written by the general author (version 3). Each local
    # author keeps its own eligibility rule, and the legacy adapters never had one.
    if lesson["lessonGoal"] == "introduce" and not general:
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
    if general:
        from authoring_context import _teacher_context, AuthoringContextError
        from runtime_catalog import scope_for_lesson
        try:
            _teacher_context(lesson, scope_for_lesson(lesson))
        except AuthoringContextError as exc:
            reject('INVALID_LESSON', str(exc))
    # Free-text progress is context for authoring, never an authorization to add tools.
    if lesson.get("taughtThroughTopicId") not in (None, lesson["topicId"]):
        reject("UNSUPPORTED_PROGRESS", "This pilot requires the selected topic as the taught-through boundary")
    from runtime_catalog import question_floor
    minimum = question_floor(lesson["gradeNumber"])
    if lesson["questionCount"] < minimum:
        # No hidden relaxation of the installed engine's volume gates.
        reject("UNSUPPORTED_SHORT_SHEET", f"This adapter requires at least {minimum} questions; explicit short-sheet support is pending")
    return cap


def _validate_trusted_contract(lesson, payload, contract):
    """A compiled worksheet-wire/5 source, flagged by its trusted caller (runner.render_job(contract=...), set
    only by structured_source / v5_offline_render). The payload's own root marker never selects this path:
    without contract= such a payload takes the general branch below and stays SOURCE_SHAPE, as at bafa36f0."""
    from general_source import V5_CONTRACT, GeneralSourceError, validate_source
    from runtime_catalog import scope_for_lesson
    if contract != V5_CONTRACT:
        raise ValueError('Unsupported trusted source contract')
    if lesson['version'] != 3:
        reject('WIRE_SCOPE_UNSUPPORTED', 'worksheet-wire/5 sources need a version 3 lesson')
    try:
        validate_source(lesson, payload, scope_for_lesson(lesson), contract=contract)
    except GeneralSourceError as exc:
        reject(exc.code, str(exc))


def validate_model(lesson, payload, *, allow_legacy=False, salvaged_from=None, contract=None):
    cap = validate_lesson(lesson, allow_legacy=allow_legacy, salvaged_from=salvaged_from)
    if contract is not None:
        _validate_trusted_contract(lesson, payload, contract)
        return cap
    if lesson['version'] == 3:
        from general_source import validate_source, GeneralSourceError
        from runtime_catalog import scope_for_lesson
        try:
            import division_facts
            import square_lesson
            import pythagoras_lesson
            import fraction_lesson
            import counting_lesson
            from triangle_lesson import VERSION, validate_parameters
            if isinstance(payload, dict) and payload.get('version') == fraction_lesson.VERSION:
                fraction_lesson.validate_parameters(lesson,payload)
            elif isinstance(payload, dict) and payload.get('version') == counting_lesson.VERSION:
                counting_lesson.validate_parameters(lesson, payload)
            elif isinstance(payload, dict) and payload.get('version') == division_facts.VERSION:
                division_facts.derive(lesson, payload)
            elif isinstance(payload, dict) and payload.get('version') in (square_lesson.VERSION, square_lesson.INTRO_VERSION):
                square_lesson.validate_parameters(lesson, payload)
            elif isinstance(payload, dict) and payload.get('version') == pythagoras_lesson.VERSION:
                pythagoras_lesson.validate_parameters(lesson, payload)
            elif isinstance(payload, dict) and payload.get('version') == VERSION:
                validate_parameters(lesson, payload)
            else:
                validate_source(lesson, payload, scope_for_lesson(lesson))
        except GeneralSourceError as exc:
            reject(exc.code, str(exc))
        return cap
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
