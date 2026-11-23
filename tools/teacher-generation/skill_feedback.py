"""Read only numbered, actionable failures from the two pinned skill runners."""

import json
from pathlib import Path
import re

from claim_words import GATE_WORDS
from gate_policy import RECONCILIATION_STEPS, STEP_CODES, decide, finding as _finding


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
    "G33": (
        "Ask for one checkable result. Do not ask which ones, whether something is possible, or for all "
        "possibilities, because no enumeration is recorded for the key. For a hypothetical use אם."
    ),
    "G62": "Create a genuinely different mathematical task within the selected concept. Vary the reasoning or representation, and independently derive its answer.",
    "G66": "Use only concepts and tools allowed at the teacher's stated stopping point. Check the written order of amounts and units in each answer.",
    "D12": "State the unknown and all necessary givens. Keep the unknown's value out of the pupil text, diagram and hints. Put the verified result in the answer key.",
    "K6": "Use only point or segment names defined by the matching figure. In construction-from-words questions, describe the construction and omit unsupported figure declarations.",
    "G84": "Replace the premature concept with reasoning that uses only the selected outcomes and the documented prerequisites.",
    "G76": (
        "Too many questions of this sheet draw the same shape. At most one question in five of the drawn "
        "questions (and never fewer than two) may share one shape or point set. Draw a different shape, or a "
        "different point set on the grid, with its own measures; a new diagonal or altitude on the same shape "
        "is still the same shape."
    ),
    "G75": (
        "Two other questions of this sheet already print exactly this drawing, and at most two questions may "
        "share one drawing. Give this question its own figure: a different shape or point set with its own "
        "measures, or, on a coordinate grid, the point or segment this question adds. Keep every given and "
        "name of the question consistent with the new figure."
    ),
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


# ----------------------------------------------------------------------------
# Structured report of ALL findings (gate_policy classes).
#
# read_skill_feedback above stays the closed view for the single correction
# call. The readers below never give up on an unknown line: every failed step
# yields at least one finding, and what the reader does not know is reported
# as UNREADABLE, which gate_policy treats as truth (blocking). No gate text is
# copied into a finding; only codes, question numbers and bounded numbers.
# ----------------------------------------------------------------------------
MAX_FINDINGS = 400
MAX_CONTENT_FILE = 2_000_000
MAX_REVIEW_FILE = 4_000_000
_TRACEBACK = "Traceback (most recent call last)"
_SIGN_GATE = re.compile(r"(G5[4-9])-[^·\n]{1,12}·(?:html|pdf)")
_NOT_RUN = {"G54-G59·pdf", "G54-G59-signs", "G60-G65", "G60-G69-content"}
_HOUSE_CODES = {"G70-answer-layout": "G70", "G50-★": "G50", "G53-figs": "G53", "G51-bidi": "G51",
                "G52-claim": "G52", "G67-hints": "G67", "G69-drawings": "G69", "G68-docx": "G68"}
_WORKSHEET = (
    (r"forbidden non-Hebrew main font detected: |no Hebrew-capable embedded font found|pdffonts: no fonts found", "WS_FONT"),
    (r"PDF text extraction produced nothing|\d+ U\+FFFD replacement chars found|suspiciously few Hebrew chars", "WS_TEXT"),
    (r"vulgar fraction glyphs found: ", "WS_VULGAR_FRACTION"),
    (r"colon-division patterns found: ", "WS_DIVISION_SIGN"),
    (r"confusable codepoints found: ", "WS_CONFUSABLE"),
    (r"brand line missing on page\(s\) |בס״ד missing on page\(s\) ", "WS_BRAND"),
    (r"\d+ bare √ found in ", "WS_SQRT"),
    (r"(?:base|starred) (?:parenthesized |period )?question marker ", "WS_MARKER"),
    (r"brand printed in REVERSED word order", "WS_BRAND_ORDER"),
    (r"reversed-Hebrew tokens ", "WS_REVERSED_HEBREW"),
    (r"invalid glyphs \(broken mapping\): ", "WS_INVALID_GLYPH"),
    (r"pdftoppm failed: |pdftoppm produced no pages", "WS_RENDER"),
)
_PAGE = (
    (r"page-(\d{1,3})\.png: near-empty page \(ink reaches \d{1,3}% of height\)", "PAGE_FILL"),
    (r"page-(\d{1,3})\.png: giant interior gap \(\d{1,4}mm of blank rows\)", "PAGE_GAP"),
    (r"page-(\d{1,3})\.png: page appears EMPTY", "PAGE_EMPTY"),
)
_MIDDLE_STEPS = (
    (r"load package \(content\.py\)", "LOAD_PACKAGE"),
    (r"check_plain_math\.py", "PLAIN_MATH"),
    (r"verify_export\.py", "VERIFY_EXPORT"),
    (r"emit_docx(?: [abc])?", "EMIT_DOCX"),
    (r"catalog_build|landing_build|catalog/landing", "CATALOG"),
    (r"gate_sections(?: G85–G92)?", "GATE_SECTIONS"),
    (r"check_docx_rtl [abc]", "DOCX_RTL"),
)


def _label_map(read):
    """The skill labels a sub-item by question number + one item digit.

    The trusted adapter's content.json settles which digits are the question.
    Without it (or for a label it does not hold) the item is the last digit.
    """
    try:
        content = json.loads(read("content.json", MAX_CONTENT_FILE))
        known, twice = {}, set()
        for question in content["questions"]:
            number = str(question["n"])
            if not re.fullmatch(r"[1-9][0-9]?", number):
                continue
            items = question.get("items") or []
            pairs = [(number + str(i), i) for i in range(1, len(items) + 1)] or [(number, None)]
            for label, item in pairs:
                if label in known:
                    twice.add(label)
                known[label] = (int(number), item)
        for label in twice:
            del known[label]
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, AttributeError, Unsupported):
        return _digit_label
    return known.get


def _digit_label(label):
    match = re.fullmatch(r"([1-9][0-9]?)([1-9])", label)
    return (int(match[1]), int(match[2])) if match else None


def _named(code, step, pair, **evidence):
    if pair is None:
        return _finding(code, step, **evidence)
    return _finding(code, step, pair[0], pair[1], **evidence)


def parse_content_truth(text, step="content-truth"):
    """content_truth.py: ' ✗ G32  [content.json.questions#4]  message'."""
    rows, complete = [], "CONTENT-TRUTH GATES: FAIL" in text
    lines = [line for line in text.splitlines() if line.lstrip().startswith("✗")]
    for line in lines:
        match = re.match(r"^\s*✗ (G[0-9]{2})\s+\[([^\]\n]{0,120})\]\s+(.*)$", line)
        if not match:
            rows.append(_finding("UNREADABLE", step)); complete = False
            continue
        where = re.fullmatch(r"content\.json\.questions#([1-9][0-9]?)", match[2])
        evidence = {}
        word = re.match(r"טענה כוללת/שלילת קיום \('([^'\n]{1,20})'\)", match[3])
        if match[1] == "G32" and word and word[1] in GATE_WORDS["G32"]:
            evidence["word"] = word[1].strip()
        rows.append(_finding(match[1], step, int(where[1]) if where else None, **evidence))
    total = re.search(r"^([0-9]{1,4}) blocking content defect\(s\)\. Do not deliver\.\s*$", text, re.M)
    if not lines or not total or int(total[1]) != len(lines) or _TRACEBACK in text:
        complete = False
    return rows, complete


def _difficulty_rows(detail, resolve, step):
    token = r"Q([1-9][0-9]{0,2})=([0-9]{1,2})"
    rows = []
    for clause in detail.split("; "):
        pair = re.fullmatch(rf"פער קושי ([0-9]{{1,2}}) > ([0-9]{{1,2}}) — הדף מערבב רמות \({token} מול {token}\)", clause)
        if pair:
            spread, limit = int(pair[1]), int(pair[2])
            for role, label, score in (("low", pair[3], pair[4]), ("high", pair[5], pair[6])):
                rows.append(_named("G61", step, resolve(label), clause="spread", role=role,
                                   score=int(score), spread=spread, limit=limit))
            continue
        cap = re.fullmatch(rf"פריטים מעל תקרת [^()\n]{{1,12}} \(([0-9]{{1,2}})\): ({token}(?:, {token}){{0,5}})", clause)
        if cap:
            for label, score in re.findall(token, cap[2]):
                rows.append(_named("G61", step, resolve(label), clause="ceiling", score=int(score), ceiling=int(cap[1])))
            continue
        if clause.startswith("חציון "):
            continue  # the gate's own warning, joined to the blocking clauses
        rows.append(_finding("G61", step))  # wording this reader does not know: still G61, unnamed
    return rows


def _clone_rows(detail, resolve, step):
    rows = []
    for clause in detail.split("; "):
        clone = re.fullmatch(r"([1-9][0-9]?) פריטים זהים מבנית \((Q[0-9]{1,3}(?:, Q[0-9]{1,3}){0,4})\): «[^«»\n]{0,46}»", clause)
        if clone:
            labels = [ref[1:] for ref in clone[2].split(", ")]
            for label in labels:
                rows.append(_named("G62", step, resolve(label), clause="clones", group=int(clone[1])))
            if int(clone[1]) > len(labels):
                rows.append(_finding("G62", step, clause="clones", unlisted=int(clone[1]) - len(labels)))
            continue
        rows.append(_finding("G62", step, clause="variety" if clause.startswith("גיוון תשובות ") else "other"))
    return rows


def _tagged_rows(code, detail, resolve, step, kinds):
    """Clauses that start with 'Q<label>: '. ``kinds`` maps a clause start to a code."""
    starts = list(re.finditer(r"(?:^|; )Q([0-9]{1,3}): ", detail))
    rows = []
    for index, match in enumerate(starts):
        body = detail[match.end():starts[index + 1].start() if index + 1 < len(starts) else len(detail)]
        clause_code = next((value for prefix, value in kinds if body.startswith(prefix)), code)
        rows.append(_named(clause_code, step, resolve(match[1])))
    if not starts or (starts and starts[0].start() != 0) or "…(+" in detail:
        rows.append(_finding(code, step))  # an unnamed remainder: more findings than the gate listed
    return rows


def _figure_rows(code, detail, step):
    """The engine writes one figure per question as figures/q<number>.svg."""
    parts = detail.split("; ")
    numbers = [int(m[1]) for part in parts
               if (m := re.match(r"Q[0-9]{1,3}:q([1-9][0-9]?)\.svg(?:#[0-9]{1,2})?: ", part))]
    rows = [_finding(code, step, number) for number in dict.fromkeys(numbers)]
    # A clause that names no question's figure, or a list cut at the gate's limit of eight.
    if len(numbers) != len(parts) or len(parts) >= 8 or "…(+" in detail:
        rows.append(_finding(code, step))
    return rows


def _bracket_rows(detail, step):
    """G51 prints up to six samples: p6:') x (', p7:')2('."""
    body = re.fullmatch(r"סוגריים הפוכים סביב תוכן מספרי: (.+) — החליפו למספור באותיות עבריות \(טיפוס חזק\)", detail)
    if not body:
        return [_finding("G51", step)]
    sample = r"p([0-9]{1,3}):('(?:[^'\\\n]|\\.){2,24}'|\"(?:[^\"\\\n]|\\.){2,24}\")"
    found = list(re.finditer(sample, body[1]))
    whole = ", ".join(match[0] for match in found) == body[1]
    products = whole and all(re.fullmatch(r"\)\s{0,3}x\s{0,3}\(", match[2][1:-1]) for match in found)
    # Six samples is the gate's print limit, so more may exist: not a closed list.
    return [_finding("G51", step, samples=len(found), pages=sorted({int(match[1]) for match in found})[:6],
                     closedList=bool(whole and 0 < len(found) < 6), productsOnly=bool(products))]


def parse_house_gates(text, resolve=None, step="house-gates"):
    """house_gates.py: 'FAIL — G61-level: message' and 'HOUSE GATES: FAIL (n)'."""
    resolve = resolve or _digit_label
    rows = []
    lines = [line for line in text.splitlines() if line.startswith("FAIL — ")]
    summary = re.search(r"^HOUSE GATES: FAIL \(([0-9]{1,3})\)\s*$", text, re.M)
    complete = bool(lines and summary and int(summary[1]) == len(lines) and _TRACEBACK not in text)
    for line in lines:
        match = re.fullmatch(r"FAIL — ([^:\n]{1,40}): (.*)", line)
        if not match:
            rows.append(_finding("UNREADABLE", step)); complete = False
            continue
        name, detail = match[1], match[2]
        sign = _SIGN_GATE.fullmatch(name)
        if name in _NOT_RUN:
            rows.append(_finding("GATE_NOT_RUN", step))
        elif sign:
            rows.append(_finding(sign[1], step))
        elif name == "G51-bidi":
            rows += _bracket_rows(detail, step)
        elif name in _HOUSE_CODES:
            rows.append(_finding(_HOUSE_CODES[name], step))
        elif name == "G60-numbers":
            rows += _tagged_rows("G60", detail, resolve, step, ())
        elif name == "G61-level":
            rows += _difficulty_rows(detail, resolve, step)
        elif name == "G62-clones":
            rows += _clone_rows(detail, resolve, step)
        elif name == "G65-answer-placeholders":
            parts = detail.split("; ")
            found = [m[1] for part in parts
                     if (m := re.fullmatch(r"([0-9]{1,3}): מציין המקום «[^«»\n]{1,40}» אינו תשובה סופית", part))]
            rows += [_named("G65", step, resolve(label)) for label in found]
            if len(found) != len(parts) or len(parts) >= 8:  # unread, or cut at the gate's limit of eight
                rows.append(_finding("G65", step))
        elif name == "G66-chronology":
            rows += _tagged_rows("G66", detail, resolve, step, (("היפוך ", "G66_FLIP"),))
        elif name in ("G63-geometry", "G64-svg-signs"):
            rows += _figure_rows(name[:3], detail, step)
        else:
            rows.append(_finding("UNREADABLE", step)); complete = False
    return rows, complete


def parse_worksheet(text, step="worksheet"):
    """check_worksheet.py: 'FAIL — message' and 'GATE: FAIL — …'."""
    rows = []
    lines = [line[len("FAIL — "):] for line in text.splitlines() if line.startswith("FAIL — ")]
    complete = bool(lines and re.search(r"^GATE: FAIL — ", text, re.M) and _TRACEBACK not in text)
    for message in lines:
        pages = []
        for clause in message.split("; "):
            hit = next(((code, m) for pattern, code in _PAGE if (m := re.fullmatch(pattern, clause))), None)
            if hit is None:
                pages = None
                break
            pages.append(_finding(hit[0], step, page=int(hit[1][1])))
        if pages:
            rows += pages
            continue
        code = next((code for pattern, code in _WORKSHEET if re.match(pattern, message)), None)
        if code is None:
            rows.append(_finding("UNREADABLE", step)); complete = False
        else:
            rows.append(_finding(code, step))
    return rows, complete


def parse_output_gates(text, step="output-gates"):
    """gates_runner.py 'BUILD BLOCKED' rows and output_gates.py 'PDF-answer-LTR FAIL'."""
    rows = []
    for match in re.finditer(r"^  \S[^\n]{0,80}? :: (G42-render|G43-F2|G45/G46) :: (FAIL|SKIPPED) :: (.*)$", text, re.M):
        gate, status, message = match.groups()
        if status == "SKIPPED":
            rows.append(_finding("GATE_NOT_RUN", step))
        elif gate == "G45/G46":
            for clause in message.split("; "):
                code = clause[:3] if re.match(r"G4[56]: ", clause) else "UNREADABLE"
                page = re.match(r"G46: p([0-9]{1,3}) ", clause)
                rows.append(_finding(code, step, **({"page": int(page[1])} if page else {})))
        else:
            rows.append(_finding(gate[:3], step))
    order = re.search(r"^PDF-answer-LTR FAIL ([A-Z_]{1,60})(?:: ([^\n]{0,80}))?\s*$", text, re.M)
    if order:
        label = re.fullmatch(r"([1-9][0-9]?)\.?", order[2] or "")
        named = order[1] in ("GENERAL_ANSWER_VISUAL_ORDER", "GENERAL_ANSWER_CELL_MISSING_OR_AMBIGUOUS")
        rows.append(_finding("ANSWER_ORDER", step, int(label[1]) if label and named else None, reason=order[1]))
    complete = bool(rows) and _TRACEBACK not in text and all(row["code"] != "UNREADABLE" for row in rows)
    if "BUILD BLOCKED — output gates did not all pass:" in text and not any(row["code"] != "ANSWER_ORDER" for row in rows):
        complete = False
    return rows, complete


ADAPTER_RECORD = "adapter-failure.json"  # general_adapters.FAILURE_RECORD


def adapter_refusal(record):
    """The fields of the adapter's own failure record that are safe to use.

    The record is written by the isolated adapter process as
    {"version", "step", "code", "question", "item"}. Anything that is not a
    fixed code or a small position is dropped. Returns (code, question, item).
    """
    if type(record) is not dict:
        return None, None, None
    code, question, item = record.get("code"), record.get("question"), record.get("item")
    code = code if isinstance(code, str) and re.fullmatch(r"[A-Z_]{1,60}", code) else None
    question = question if type(question) is int and 1 <= question <= 99 else None
    item = item if question is not None and type(item) is int and 1 <= item <= 9 else None
    return code, question, item


def parse_adapter(text, step="trusted-adapter", record=None):
    """The trusted adapter stops at its first refusal.

    ``record`` is its structured failure record (adapter_refusal) when it left
    one: the refused code with the question and item it belongs to. Without a
    position there, the last line of the log is the exception, and some
    messages end with the position.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    last = lines[-1] if lines else ""
    kind = re.match(r"(?:[A-Za-z_][A-Za-z0-9_]*\.)*([A-Z][A-Za-z]{1,38}(?:Error|Exception)): ", last)
    evidence = {"error": kind[1]} if kind else {}
    code, question, item = adapter_refusal(record)
    if code:
        evidence["refusal"] = code
    if question is not None:
        return [_finding("TRUSTED_ADAPTER", step, question, item, **evidence)], True
    where = re.search(r"\bat q([1-9][0-9]?)\.item\.([1-9])\s*$", last)
    claim = re.match(r"AssertionError: \[([1-9][0-9]?)(?:\.([1-9]))?(?:\.[a-z]{1,12})?\] claim is FALSE ", last)
    if where:
        return [_finding("TRUSTED_ADAPTER", step, int(where[1]), int(where[2]), **evidence)], True
    if claim:
        return [_finding("TRUSTED_ADAPTER", step, int(claim[1]), int(claim[2]) if claim[2] else None, **evidence)], True
    return [_finding("TRUSTED_ADAPTER", step, **evidence)], True


def _item(tag):
    """Middle item id 'q7c' -> (7, 3); 'q7' -> (7, None)."""
    match = re.fullmatch(r"q([1-9][0-9]?)([a-i])?", tag)
    return (int(match[1]), "abcdefghi".index(match[2]) + 1 if match[2] else None) if match else None


def parse_didactic_log(text, step="middle-build"):
    """check_didactic.py: '    FAIL   D12 q7c      message'. REVIEW rows are read elsewhere."""
    rows = []
    for line in text.splitlines():
        match = re.match(r"^\s*FAIL\s+(D[0-9]{1,2})\s+(\S{1,40})\s", line)
        if match:
            rows.append(_named(match[1], step, _item(match[2])))
    return rows


def parse_selfcheck_log(text, step="middle-build"):
    rows = []
    for line in text.splitlines():
        rule = re.match(r"^\s*(K[0-9]{1,2})\s", line)
        if not rule:
            if re.match(r"^\s*\.\.\. [0-9]+ more\s*$", line):
                rows.append(_finding("SELFCHECK", step))
            continue
        # "K6 q4 given names ..." or, for one item, "K6 q16a given names ...".
        mark = re.match(r"\s*K6 q([1-9][0-9]?)([a-i])? given names ", line)
        rows.append(_finding("K6", step, int(mark[1]), "abcdefghi".index(mark[2]) + 1 if mark[2] else None) if mark
                    else _finding("K6" if rule[1] == "K6" else "SELFCHECK", step))
    return rows


_DOMINANCE = re.compile(r"DOMINANCE: one shape carries ([0-9]{1,2}) of the [0-9]{1,2} drawn questions "
                        r"\(([0-9]{1,2}(?:, [0-9]{1,2}){0,29})\) \S the cap at this size is ([0-9]{1,2})\.")


def parse_g76(line, step="middle-build"):
    """G76 variety scales: the questions over the DOMINANCE cap, named; anything else unnamed.

    The gate lists the questions that draw the busiest shape and the cap. The
    first ``cap`` of them stay and the rest are named, so that replacing them
    brings the shape under the cap. A SCALE or PART finding is about the
    whole sheet and names no question.
    """
    found = _DOMINANCE.search(line)
    if found is None or re.search(r"\b(?:SCALE|PART):", line):
        return [_finding("G76", step)]
    questions, cap = [int(n) for n in found[2].split(", ")], int(found[3])
    if len(questions) != int(found[1]) or not 1 <= cap < len(questions):
        return [_finding("G76", step)]
    return [_finding("G76", step, question) for question in questions[cap:]]


_REUSE = re.compile(r"the same drawing serves (questions [0-9]{1,2}(?:, [0-9]{1,2}){1,29}"
                    r"(?:; questions [0-9]{1,2}(?:, [0-9]{1,2}){1,29}){0,9}) \(cap is ([0-9])\)")


def parse_g75(line, step="middle-build"):
    """G75 figure variety: the questions over the REUSE cap, named; anything else unnamed.

    emit_html.assert_figure_variety lists, for each SVG that serves more than
    ``cap`` questions, the questions it serves in printed order. The first
    ``cap`` of each keep the drawing and the rest are named, so that replacing
    them brings every drawing under the cap. COVER and OBJECTS are about the
    whole sheet and name no question.
    """
    found = _REUSE.search(line)
    rest = line if found is None else line[:found.start()] + line[found.end():]
    rows = []
    if found is not None:
        cap = int(found[2])
        for group in found[1].split("; "):
            questions = [int(n) for n in group[len("questions "):].split(", ")]
            if not 1 <= cap < len(questions):
                return [_finding("G75", step)]
            rows += [_finding("G75", step, question) for question in questions[cap:]]
    if found is None or re.search(r"a figure sheet with drawings on|drawn questions but only", rest):
        rows.append(_finding("G75", step))
    return rows


def parse_build_plus_log(text, step="middle-build"):
    header = re.search(r"^AssertionError: G84-chronology FAIL on level '[abc]' \([^\n]+\):\n", text, re.M)
    if not header:
        gate = re.search(r"^AssertionError: (G[0-9]{2})\b.*$", text, re.M)
        if gate and gate[1] == "G76":
            return parse_g76(gate[0], step)
        if gate and gate[1] == "G75":
            return parse_g75(gate[0], step)
        return [_finding(gate[1] if gate else "BUILD_PLUS", step)]
    rows = []
    for line in text[header.end():].splitlines():
        if not line.startswith("  - "):
            break
        mark = re.match(r"  - q([1-9][0-9]?)\.", line)
        rows.append(_finding("G84", step, int(mark[1]) if mark else None))
    return rows or [_finding("G84", step)]


def _middle_rows(read, step):
    """Blocking findings of one failed build_v72 run, from its own report and logs."""
    try:
        report = json.loads(read("out/v72-report.json", MAX_REVIEW_FILE))
        failed = [row["step"] for row in report["steps"] if row["status"] == "FAIL"]
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, Unsupported):
        return [_finding("UNREADABLE", step)], False
    rows, complete = [], bool(failed)
    logs = {"build_plus (PDF + gates)": ("out/logs/build_plus.log", parse_build_plus_log, "BUILD_PLUS"),
            "selfcheck_noam_package.py": ("out/logs/selfcheck_noam_package.py.log", parse_selfcheck_log, "SELFCHECK"),
            "check_didactic.py": ("out/logs/check_didactic.py.log", parse_didactic_log, "UNREADABLE")}
    for name in failed:
        if name in logs:
            path, parser, fallback = logs[name]
            try:
                found = parser(read(path, MAX_REVIEW_FILE), step)
            except (OSError, UnicodeError, Unsupported):
                found = []
            rows += found or [_finding(fallback, step)]
            continue
        code = next((code for pattern, code in _MIDDLE_STEPS if re.fullmatch(pattern, str(name))), "UNREADABLE")
        rows.append(_finding(code, step))
    if any(row["code"] == "UNREADABLE" for row in rows):
        complete = False
    return rows, complete


def didactic_review_rows(evidence, step="middle-build"):
    """REVIEW rows that didactic_review.py reconciled: teacher notes, never blocking."""
    rows = []
    for entry in evidence["findings"][:2000]:
        rule = entry.get("rule")
        extra = {"rule": rule} if isinstance(rule, str) and re.fullmatch(r"D[0-9]{1,2}", rule) else {}
        rows.append(_named("DIDACTIC_REVIEW", step, _item(str(entry.get("item"))), **extra))
    if len(rows) != evidence["count"]:
        # The recorded count stays the reported one; unlisted rows are unnamed.
        rows = rows[:evidence["count"]] + [_finding("DIDACTIC_REVIEW", step)] * max(0, evidence["count"] - len(rows))
    return rows


def gate_report(workdir, skill, steps, question_count):
    """Every finding of one rendered or pre-checked work folder. Never raises.

    ``steps`` is the runner's step list. Each step whose status is FAIL or
    REVIEW is read; a failed step always yields at least one finding.
    Returns {"version", "skill", "complete", "findings", "unnamed"}:
    ``findings`` name a question (and an item when the output names it),
    ``unnamed`` do not. ``complete`` is False when something was not understood.
    """
    rows, complete = [], True
    try:
        base = Path(workdir).resolve(strict=True)

        def read(relative, limit=MAX_FILE):
            file = (base / relative).resolve(strict=True)
            if not file.is_relative_to(base) or not file.is_file() or file.stat().st_size > limit:
                raise Unsupported
            return file.read_text(encoding="utf-8")

        resolve = _label_map(read)

        def refused(text, name):
            # The adapter's structured record names the refused question.
            try:
                record = json.loads(read(ADAPTER_RECORD, 2000))
            except (OSError, UnicodeError, ValueError, Unsupported):
                record = None
            return parse_adapter(text, name, record)

        readers = {"content-truth": lambda text, name: parse_content_truth(text, name),
                   "house-gates": lambda text, name: parse_house_gates(text, resolve, name),
                   "worksheet": parse_worksheet, "output-gates": parse_output_gates,
                   "trusted-adapter": refused}
        for step in steps:
            name, status = step.get("name"), step.get("status")
            if status not in ("FAIL", "REVIEW") or not isinstance(name, str):
                continue
            if step.get("reason") == "RENDER_TIMEOUT":
                rows.append(_finding("RENDER_TIMEOUT", name))
                continue
            if name == "middle-build":
                if status == "REVIEW":
                    found, good = didactic_review_rows(json.loads(read("logs/didactic-review.json", MAX_REVIEW_FILE)), name), True
                else:
                    found, good = _middle_rows(read, name)
            elif name in RECONCILIATION_STEPS:
                continue  # its refusal is the failure of the gate it measured again, reported there
            elif name in readers and isinstance(step.get("log"), str):
                try:
                    found, good = readers[name](read("logs/" + name + ".txt"), name)
                except (OSError, UnicodeError, Unsupported):
                    found, good = [], False
            else:
                found, good = [_finding(STEP_CODES.get(name, "STEP_FAILED"), name)], True
            if not found:
                found, good = [_finding("UNREADABLE", name)], False
            if not good and not any(row["code"] == "UNREADABLE" for row in found):
                found.append(_finding("UNREADABLE", name))
            rows += found
            complete = complete and good
        if any(step.get("name") == "bracket-order-reconciliation" and step.get("status") == "PASS" for step in steps):
            # paren_order.py measured every G51 sample again and found each
            # closing bracket to the right of its opening one.
            measured = json.loads(read("logs/bracket-order.json"))
            if (measured.get("status") == "RECONCILED" and type(measured.get("matches")) is int
                    and measured["matches"] > 0 and measured.get("unbalanced") == 0):
                for row in rows:
                    if row["code"] == "G51":
                        row["reconciled"] = True
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, AttributeError, RecursionError):
        rows.append(_finding("UNREADABLE", "report")); complete = False
    if len(rows) > MAX_FINDINGS:
        rows = rows[:MAX_FINDINGS] + [_finding("UNREADABLE", "report")]; complete = False
    limit = question_count if type(question_count) is int else 0
    named, unnamed = [], []
    for row in rows:
        question = row.get("question")
        if question is not None and not 1 <= question <= limit:
            # A number outside the sheet names nothing the caller can act on.
            row = {key: value for key, value in row.items() if key not in ("question", "item")}
            question = None
        (named if question is not None else unnamed).append(row)
    return {"version": 1, "skill": skill, "complete": complete, "findings": named, "unnamed": unnamed}


def read_gate_report(workdir, question_count):
    """gate_report for a folder that already holds its manifest.json."""
    try:
        manifest = json.loads(_read(Path(workdir).resolve(strict=True), "manifest.json"))
        return gate_report(workdir, manifest["skill"]["name"], manifest["steps"], question_count)
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, RecursionError):
        return {"version": 1, "skill": None, "complete": False, "findings": [],
                "unnamed": [_finding("UNREADABLE", "report")]}


def blocking_feedback(workdir, question_count):
    """Correction rows for the questions that block, from the structured report.

    Same shape as read_skill_feedback, for the same correction call, but
    editorial findings ask for nothing, so they neither spend the question
    budget nor stop the request. Returns [] unless every blocking finding
    names a question, has a fixed instruction, and at most MAX_QUESTIONS
    questions are named; a caller then replaces questions instead.
    """
    try:
        manifest = json.loads(_read(Path(workdir).resolve(strict=True), "manifest.json"))
        steps = manifest["steps"]
        if manifest["status"] != "failed":
            return []
        report = gate_report(workdir, manifest["skill"]["name"], steps, question_count)
        failed = [step["name"] for step in steps if step["status"] == "FAIL"]
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, RecursionError):
        return []
    decision = decide(report, failed)
    if decision["action"] != "replace" or len(decision["questions"]) > MAX_QUESTIONS:
        return []
    result = {}
    for row in decision["blocking"]:
        if type(FEEDBACK.get(row["code"])) is not str:
            return []
        result.setdefault(row["question"], {})[row["code"]] = FEEDBACK[row["code"]]
    return [{"question": q, "codes": sorted(found), "feedback": [found[c] for c in sorted(found)]}
            for q, found in sorted(result.items())]

