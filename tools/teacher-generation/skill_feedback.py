"""Read only numbered, actionable failures from the two pinned skill runners."""

import json
from pathlib import Path
import re


MAX_QUESTIONS = 6
MAX_FILE = 256_000
FEEDBACK = {
    "G32": (
        "For a price or amount per unit, state the price or amount of ONE named unit. For a finite "
        "allocation, name the group and how it shares the total. Examples of Hebrew wording only: "
        "מחיר מחברת אחת הוא 4 שקלים. / חילקו 12 עפרונות שווה בשווה בין 4 תלמידים. כמה עפרונות קיבל תלמיד אחד? "
        "Use the question's own facts. For a genuine universal assertion, keep the quantifier and use "
        "only a claim established over the stated domain and supported by the verifier."
    ),
    "G62": "Create a genuinely different mathematical task within the selected concept. Vary the reasoning or representation, and independently derive its answer.",
    "G66": "Use only concepts and tools allowed at the teacher's stated stopping point. Check the written order of amounts and units in each answer.",
    "D12": "State the unknown and all necessary givens. Keep the unknown's value out of the pupil text, diagram and hints. Put the verified result in the answer key.",
    "K6": "Use only point or segment names defined by the matching figure. In construction-from-words questions, describe the construction and omit unsupported figure declarations.",
    "G84": "Replace the premature concept with reasoning that uses only the selected outcomes and the documented prerequisites.",
}


class Unsupported(ValueError):
    pass


def _read(base, relative):
    # All relative paths below are constants from the reviewed runner, never
    # values from a model, report, traceback or returned manifest.
    file = (base / relative).resolve(strict=True)
    if not file.is_relative_to(base) or not file.is_file() or file.stat().st_size > MAX_FILE:
        raise Unsupported
    return file.read_text(encoding="utf-8")


def _difficulty(detail, add):
    # The pinned skill prints the first low/high subitems and up to six
    # over-ceiling subitems. Only their numeric evidence enters the request.
    token = r"Q[1-9][0-9]?[1-9]=[0-9]{1,2}"
    scores = {}

    def record(ref):
        matched = re.fullmatch(r"Q([1-9][0-9]?)([1-9])=([0-9]{1,2})", ref)
        q, item, score = map(int, matched.groups())
        key = (q, item)
        if scores.setdefault(key, score) != score:
            raise Unsupported
        return key

    low = spread_limit = ceiling = None
    for clause in detail.split("; "):
        pair = re.fullmatch(rf"פער קושי ([0-9]{{1,2}}) > ([0-9]{{1,2}}) — הדף מערבב רמות \(({token}) מול ({token})\)", clause)
        if pair:
            if low is not None:
                raise Unsupported
            spread, spread_limit = map(int, pair.group(1, 2))
            low, high = record(pair[3]), record(pair[4])
            if scores[high] - scores[low] != spread or spread <= spread_limit:
                raise Unsupported
            continue
        cap = re.fullmatch(rf"פריטים מעל תקרת (?:[א-ו](?:׳|/מצוינות)?|מצוינות) \(([0-9]{{1,2}})\): ({token}(?:, {token}){{0,5}})", clause)
        if not cap or ceiling is not None:
            raise Unsupported
        ceiling = int(cap[1])
        for ref in cap[2].split(", "):
            if scores[record(ref)] < ceiling + 2:
                raise Unsupported

    target = ceiling
    bounds = {}
    if ceiling is not None:
        bounds["profileCeiling"] = ceiling
    if low is not None:
        if min(scores.values()) != scores[low] or max(scores.values()) != scores[high]:
            raise Unsupported
        bounds.update(measuredRange=[scores[low], scores[high]], maxSpread=spread_limit)
        spread_target = scores[low] + spread_limit
        target = spread_target if ceiling is None else min(ceiling, spread_target)
    by_question = {}
    for (q, item), score in sorted(scores.items()):
        action = "keep" if (q, item) == low and score <= target else "reduce"
        by_question.setdefault(q, []).append({"item": item, "measuredScore": score, "action": action})
    for q, items in by_question.items():
        instruction = "Preserve each keep item's current difficulty and the planned learning objective and challenge role."
        if any(item["action"] == "reduce" for item in items):
            instruction += (
                " For each reduce item, use fewer distinct operation types or remove unnecessary nesting "
                "in the printed problem and its answer. Swapping operands of the same size alone will not lower the score."
            )
        add(q, "G61", {"gate": "G61", **bounds, "maxItemScore": target, "items": items,
                       "instruction": instruction + " Check every item in this question against maxItemScore."})


def _elementary(read, failed, add):
    if not failed <= {"content-truth", "house-gates"}:
        raise Unsupported
    if "content-truth" in failed:
        data = read("logs/content-truth.txt")
        if "CONTENT-TRUTH GATES: FAIL" not in data:
            raise Unsupported
        count = 0
        for line in data.splitlines():
            if not line.lstrip().startswith("✗"):
                continue
            m = re.match(r"^\s*✗ G32\s+\[content\.json\.questions#([1-9][0-9]?)\]\s+טענה כוללת/שלילת קיום ", line)
            if not m:
                raise Unsupported
            add(int(m[1]), "G32")
            count += 1
        if not count:
            raise Unsupported
    if "house-gates" not in failed:
        return
    raw = read("logs/house-gates.txt")
    lines = [line for line in raw.splitlines() if line.startswith("FAIL — ")]
    if "HOUSE GATES: FAIL" not in raw or not lines:
        raise Unsupported
    for line in lines:
        m = re.fullmatch(r"FAIL — (G61-level|G62-clones|G66-chronology): (.+)", line)
        if not m:
            raise Unsupported
        code = m[1][:3]
        if code == "G61":
            _difficulty(m[2], add)
            continue
        # The skill labels an elementary sub-item by the concatenation of
        # its question number and one digit, so Q101 means question 10 item 1.
        for detail in m[2].split("; "):
            if code == "G62":
                clone = re.fullmatch(r"([1-9][0-9]?) פריטים זהים מבנית \((Q\d+(?:, Q\d+){0,4})\): «[^«»\n]{1,46}»", detail)
                if not clone:
                    raise Unsupported
                refs = clone[2].split(", ")
                if int(clone[1]) != len(refs):
                    raise Unsupported  # Additional affected locations were truncated.
            else:
                chrono = re.fullmatch(r"(Q\d+): (?:המושג(?:/הסימן)? «[^«»;\n]+» (?:שייך לחטיבת הביניים ואסור ביסודי|אסור בכיתה .׳ \(נלמד בכיתה גבוהה יותר\)|טרם נלמד בנושא [^;\n]+)|היפוך יחידת מידה ומספר בתשובה «[^«»;\n]*»)", detail)
                if not chrono or "…(+" in detail:
                    raise Unsupported
                refs = [chrono[1]]
            for ref in refs:
                number = re.fullmatch(r"Q([1-9][0-9]?)[1-9](?:=[0-9]+)?", ref)
                if not number:
                    raise Unsupported
                add(int(number[1]), code)


def _middle(read, failed, add):
    if "middle-build" not in failed or not failed <= {"middle-build", "didactic-review-reconciliation"}:
        raise Unsupported
    report = json.loads(read("out/v72-report.json"))
    upstream = {row["step"] for row in report["steps"] if row["status"] == "FAIL"}
    supported = {"check_didactic.py", "selfcheck_noam_package.py", "build_plus (PDF + gates)"}
    if not upstream or not upstream <= supported:
        raise Unsupported
    if "check_didactic.py" in upstream:
        data = read("out/logs/check_didactic.py.log")
        records = [s.strip() for s in data.splitlines() if re.match(r"^\s*FAIL\s+[A-Z][0-9]+\s+", s)]
        declared = re.search(r"^\s*FAIL items: (q[1-9][0-9]?[a-i]?(?:, q[1-9][0-9]?[a-i]?)*?)\s*$", data, re.M)
        seen = set()
        for row in records:
            tag = re.match(r"FAIL\s+D12\s+(q([1-9][0-9]?)[a-i]?)\s+", row)
            if not tag:
                raise Unsupported
            seen.add(tag[1]); add(int(tag[2]), "D12")
        if not declared or not seen or seen != set(declared[1].split(", ")):
            raise Unsupported
    if "selfcheck_noam_package.py" in upstream:
        data = read("out/logs/selfcheck_noam_package.py.log")
        count = 0
        for line in data.splitlines():
            if not re.match(r"^\s*K\d+\s", line):
                continue
            mark = re.fullmatch(r"\s*K6 q([1-9][0-9]?) given names [A-Z]{1,8}(?:, [A-Z]{1,8})*, which no figure of q\1 defines", line)
            if not mark:
                raise Unsupported
            add(int(mark[1]), "K6"); count += 1
        if not count or f"selfcheck_noam_package: {count} error(s)" not in data:
            raise Unsupported
    if "build_plus (PDF + gates)" in upstream:
        data = read("out/logs/build_plus.log")
        header = re.search(r"^AssertionError: G84-chronology FAIL on level '[abc]' \([^\n]+\):\n", data, re.M)
        if not header:
            raise Unsupported
        count = 0
        for line in data[header.end():].splitlines():
            if not line.startswith("  - "):
                break
            mark = re.match(r"  - q([1-9][0-9]?)\.(?:(?:[א-טa-i1-9])\.)?(?:intro|text|answer|approved_hint): מופיע המונח ", line)
            if not mark:
                raise Unsupported
            add(int(mark[1]), "G84"); count += 1
        if not count:
            raise Unsupported


def read_skill_feedback(workdir, question_count):
    """Return only closed feedback for a failed run, or [] if unsuitable."""
    if type(question_count) is not int or not 4 <= question_count <= 30:
        return []
    result = {}
    def add(number, code, finding=None):
        if not 1 <= number <= question_count:
            raise Unsupported
        findings = result.setdefault(number, {})
        feedback = FEEDBACK[code] if finding is None else finding
        if findings.setdefault(code, feedback) != feedback:
            raise Unsupported
        if len(result) > MAX_QUESTIONS:
            raise Unsupported
    try:
        base = Path(workdir).resolve(strict=True)
        def read(relative):
            return _read(base, relative)
        manifest = json.loads(read("manifest.json"))
        if manifest["status"] != "failed":
            return []
        failed = {step["name"] for step in manifest["steps"] if step["status"] == "FAIL"}
        if not failed:
            return []
        reader = {"elementary": _elementary, "middle": _middle}[manifest["skill"]["name"]]
        reader(read, failed, add)
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, RecursionError):
        return []
    return [{"question": q, "codes": sorted(findings), "feedback": [findings[c] for c in sorted(findings)]}
            for q, findings in sorted(result.items())]
