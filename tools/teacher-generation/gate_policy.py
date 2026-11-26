"""One classification of every gate outcome the renderer can see, and the delivery rule.

Three classes:

  truth      The printed mathematics, its answer key or its print form may be
             wrong, unverified, missing or unreadable. Blocks. Acts on one
             question when the gate output names it.
  policy     Correct content that the owner's rules do not allow for this
             pupil or lesson: chronology, drawings outside geometry, signs
             by grade, brand lines. Blocks. Acts on one question when named.
  editorial  Level, variety and page-fill findings. Blocks like the other
             two classes. Acts on one question when the gate output names it.

Every finding blocks, with one exception (blocks()): a DIDACTIC_REVIEW row
of the middle-build step that didactic_review.py already reconciled.
A code that is not in the table is truth, so an unknown outcome blocks.
The table was read from the two pinned skills (file names below are relative
to each skill root) and from this engine's own steps.

This module has no input or output. Callers pass findings that
skill_feedback built from fixed log formats; no gate text is copied here.
"""
from __future__ import annotations

TRUTH, POLICY, EDITORIAL = "truth", "policy", "editorial"
MAX_REVIEW_QUESTIONS = 30
MAX_REVIEW_COUNT = 2000

# Hebrew teacher notes. Only editorial codes have one, and only these fixed
# sentences ever reach the teacher: gate output is never forwarded. A delivered
# sheet can carry only the notes of the codes that do not block a render:
# DIDACTIC_REVIEW (middle-build) and SHORTER_SHEET (added by the worker).
NOTES = {
    "G50": "מספר שאלות האתגר (★) בדף אינו בטווח הרגיל של 2 עד 4.",
    "G61": "רמת הקושי בדף אינה אחידה: הפער בין השאלות הקלות לשאלות הקשות גדול מהרגיל, "
           "או שיש סעיפים קשים מהרמה שנבחרה. כדאי לעבור על השאלות המסומנות.",
    "G62": "כמה סעיפים בדף חוזרים על אותו מבנה תרגיל. אפשר לגוון אותם או להשאיר כתרגול חוזר.",
    "PAGE_FILL": "באחד מעמודי הדף נשאר שטח ריק גדול.",
    "PAGE_GAP": "בדף יש רווח ריק גדול בין שאלות.",
    "DIDACTIC_REVIEW": "בחלק מהסעיפים נדרשת בדיקת מורה: התאמה בין ניסוח השאלה, הנתונים והתשובה.",
    "SHORTER_SHEET": "בדף יש פחות שאלות מהמספר שהתבקש: שאלות שלא עברו את בדיקות הנכונות הושמטו ולא הוחלפו.",
}

# Hebrew teacher notes for printed answers that no exact kernel verified, by
# the kind recorded in the adapter's evidence (general_source: label, open,
# decision, review). The sheet is still delivered; the teacher is told where.
UNVERIFIED_NOTES = {
    "open": "בדף יש סעיפים פתוחים שאין להם תשובה במפתח. הם מסומנים לבדיקת המורה.",
    "label": "בחלק מהסעיפים התשובה היא שם או מונח. היא הודפסה כפי שנכתבה ולא אומתה בחישוב.",
    "decision": "בחלק משאלות כן/לא ההכרעה חושבה מטענה שנוסחה מתוך סיפור. כדאי לוודא שהטענה מתאימה לנוסח השאלה.",
    "review": "תשובות של הסבר או הוכחה לא אומתו בחישוב. נדרשת בהן בדיקת מורה.",
}
MAX_UNVERIFIED_ITEMS = 180  # general_source.MAX_ITEMS

# code -> (class, the output can name a question)
GATES = {
    # --- this engine's steps (runner.py) ------------------------------------
    "TRUSTED_ADAPTER": (TRUTH, True),    # general_adapters.py: printed-key binders, ledger, figure asserts
    "RENDER_TIMEOUT": (TRUTH, False),    # runner.py: a step exceeded its time limit
    "STEP_FAILED": (TRUTH, False),       # a failed step with no finding the reader understands
    "UNREADABLE": (TRUTH, False),        # a failing line or report the reader does not know
    "GATE_NOT_RUN": (TRUTH, False),      # a gate that reports it was skipped; skipped is failed
    "PDF_BUILD": (TRUTH, False),         # scripts/build_pdf.py
    "WORD_BUILD": (TRUTH, False),        # scripts/build_docx.py
    "WORD_LAYOUT": (TRUTH, False),       # docx_layout.py, docx_web_layout.py and their provenance steps
    "ARTIFACT_MISSING": (TRUTH, False),  # runner.py artifact-presence, word-upstream-presence
    "ANSWER_ORDER": (TRUTH, True),       # output_gates.py PDF-answer-LTR: the printed key reads in another order
    "SHORTER_SHEET": (EDITORIAL, False),  # remote_worker.py: a salvaged sheet prints fewer questions than requested
    # The engine's own error codes for a printed key or figure it could not
    # bind (GeneralSourceError.code). In the trusted-adapter step they arrive
    # as TRUSTED_ADAPTER; a caller that holds the exception can classify the code.
    "PRINTED_TASK_MISMATCH": (TRUTH, True),         # printed_tasks.py:27, general_adapters.py:419
    "PRINTED_ANSWER_KIND": (TRUTH, True),           # printed_tasks.py:53
    "PRINTED_EXPRESSION_SCOPE": (TRUTH, True),      # printed_elementary.py:61
    "PRINTED_EXPRESSION_MISMATCH": (TRUTH, True),   # printed_elementary.py:61
    "UNVERIFIED_ANSWERS": (TRUTH, False),           # general_adapters.py:340
    "UNVERIFIED_FIGURE": (TRUTH, True),             # general_adapters.py:382
    "DRAWING_POLICY": (POLICY, True),               # general_source.py:118 drawings outside geometry
    "SOURCE_NIQQUD": (POLICY, True),                # general_source.py:184 vocalization by grade
    # --- elementary scripts/lib/content_truth.py ----------------------------
    "G31": (TRUTH, True),    # :431 a side triple that is no triangle, or a real one called impossible
    "G32": (TRUTH, True),    # :473 a universal claim or an existence denial without a recorded check
    "G33": (TRUTH, True),    # :494 a list-all / which-of-these request without a recorded enumeration
    "G34": (TRUTH, True),    # :634 the drawn shape contradicts the words
    "G35": (TRUTH, True),    # :509 a singular question with a plural key, or the reverse
    "G36": (TRUTH, True),    # :693 a figure and a numeric key without a measured-figure assert
    "G37": (TRUTH, False),   # :725 delivery archive
    "G38": (TRUTH, True),    # :584 sides and angles that cannot belong to one triangle
    "G39": (TRUTH, False),   # :749 skill integrity
    "G42": (POLICY, True),   # :528 and gates_runner.py:42 a forbidden division sign
    # --- elementary scripts/lib/house_gates.py and its libraries ------------
    "G50": (EDITORIAL, False),  # house_gates.py:51 star count outside 2-4
    "G51": (TRUTH, False),      # house_gates.py:64 a closing bracket printed before its opening one
    "G52": (TRUTH, False),      # house_gates.py:105 a self-signing ledger claim in the generator
    "G53": (TRUTH, False),      # house_gates.py:126 a drawn figure without its source file
    "G54": (POLICY, False),     # signs.py:223 multiplication sign by grade
    "G55": (POLICY, False),     # signs.py:245 division notation
    "G56": (POLICY, False),     # signs.py:273 minus sign
    "G57": (POLICY, False),     # signs.py:293 fractions, decimals and separators by grade
    "G58": (POLICY, False),     # signs.py:313 a glyph outside the house font
    "G59": (POLICY, False),     # signs.py:323 forbidden or above-grade signs
    "G60": (TRUTH, True),       # content_quality.py:324 an inexact or out-of-range key number
    "G61": (EDITORIAL, True),   # content_quality.py:433 difficulty spread or items above the level ceiling (a proxy)
    "G62": (EDITORIAL, True),   # content_quality.py:484 structurally repeated items, low answer variety
    "G63": (TRUTH, True),       # content_quality.py:743 figure geometry or a label outside its box
    "G64": (POLICY, True),      # content_quality.py:894 signs inside a figure
    "G65": (TRUTH, True),       # content_quality.py:973 a placeholder printed as a final answer
    "G66": (POLICY, True),      # content_quality.py:1115 a concept taught later than the lesson
    "G66_FLIP": (TRUTH, True),  # content_quality.py:1170 quotient/remainder or unit printed in reverse order
    "G67": (POLICY, False),     # content_quality.py:1437 hint ladder and spoilers
    "G68": (TRUTH, False),      # house_gates.py:293 the Word file does not verify
    "G69": (POLICY, False),     # content_quality.py:1311 drawings outside geometry
    "G70": (TRUTH, False),      # answer_layout.py:111 Hebrew key text inside a left-to-right container
    # --- elementary scripts/check_worksheet.py ------------------------------
    "PAGE_FILL": (EDITORIAL, False),      # :227 a near-empty page
    "PAGE_GAP": (EDITORIAL, False),       # :227 a giant blank gap between questions
    "PAGE_EMPTY": (TRUTH, False),         # :227 a page with no ink at all
    "WS_FONT": (TRUTH, False),            # :118 forbidden or missing Hebrew font
    "WS_TEXT": (TRUTH, False),            # :134 no text, replacement characters, too little Hebrew
    "WS_VULGAR_FRACTION": (POLICY, False),  # :147 a ready-made fraction glyph
    "WS_DIVISION_SIGN": (POLICY, False),  # :159 a forbidden division sign
    "WS_CONFUSABLE": (POLICY, False),     # :194 a look-alike code point
    "WS_BRAND": (POLICY, False),          # :207 a page without the brand line
    "WS_SQRT": (TRUTH, False),            # :365 a root without its bar
    "WS_MARKER": (TRUTH, False),          # :278 question-number marker direction
    "WS_BRAND_ORDER": (TRUTH, False),     # :338 brand words printed in reverse: broken direction
    "WS_REVERSED_HEBREW": (TRUTH, False),  # :346 Hebrew printed in reverse
    "WS_INVALID_GLYPH": (TRUTH, False),   # :356 broken glyph mapping
    "WS_RENDER": (TRUTH, False),          # :425 the page preview could not be rendered
    # --- elementary scripts/lib/gates_runner.py -----------------------------
    "G43": (TRUTH, False),   # :82 a bare root code point in the text layer
    "G45": (POLICY, False),  # check_render_integrity.py:92 the body is not in the house font
    "G46": (TRUTH, False),   # check_render_integrity.py:126 a figure off the page
    # --- middle build_v72.py and its checkers -------------------------------
    "LOAD_PACKAGE": (TRUTH, False),   # build_v72.py:191
    "BUILD_PLUS": (TRUTH, False),     # build_v72.py:208 any build gate the reader cannot name
    "G84": (POLICY, True),            # build_plus.py:228 a term taught later than the lesson
    "G76": (POLICY, True),            # gate_variety.py:361 DOMINANCE names the questions over the cap; SCALE/PART name none
    "PLAIN_MATH": (TRUTH, False),     # check_plain_math.py
    "VERIFY_EXPORT": (TRUTH, False),  # verify_export.py
    "SELFCHECK": (TRUTH, False),      # selfcheck_noam_package.py, any rule but K6
    "K6": (TRUTH, True),              # selfcheck_noam_package.py: a given names a point no figure defines
    "D0": (TRUTH, False),   # check_didactic.py:4342 the public record is missing
    "D1": (TRUTH, True),    # a conclusion printed as a given
    "D2": (TRUTH, True),    # a helper line or the construction result in the starting figure
    "D3": (TRUTH, True),    # a colour or a mark that reveals the goal
    "D4": (TRUTH, True),    # a mark in the figure that is not a given
    "D5": (TRUTH, True),    # a hint that contains the decisive step
    "D6": (POLICY, True),   # a theorem or formula outside the allowed tools
    "D7": (TRUTH, True),    # an auxiliary figure that shows more than its step
    "D8": (TRUTH, True),    # the text, the public record and the figure disagree
    "D9": (TRUTH, True),
    "D10": (TRUTH, True),   # the asked claim restates a given
    "D11": (TRUTH, True),
    "D12": (TRUTH, True),   # the value to find is printed in the pupil's text
    "D13": (TRUTH, True),
    "EMIT_DOCX": (TRUTH, False),      # build_v72.py:239
    "CATALOG": (TRUTH, False),        # build_v72.py:243
    "GATE_SECTIONS": (TRUTH, False),  # build_v72.py:266; SKIP for the packages this engine builds
    "DOCX_RTL": (TRUTH, False),       # check_docx_rtl.py G90/G91
    "DIDACTIC_REVIEW": (EDITORIAL, True),  # check_didactic.py REVIEW rows, reconciled by didactic_review.py
}

# A failed runner step with no readable finding of its own.
STEP_CODES = {
    "trusted-adapter": "TRUSTED_ADAPTER",
    "pdf": "PDF_BUILD",
    "word": "WORD_BUILD",
    "word-layout": "WORD_LAYOUT",
    "word-web-layout": "WORD_LAYOUT",
    "word-source-provenance": "WORD_LAYOUT",
    "word-web-rtl-parity": "WORD_LAYOUT",
    "word-upstream-presence": "ARTIFACT_MISSING",
    "artifact-presence": "ARTIFACT_MISSING",
}


# The fixed second check of the middle driver's documented REVIEW-only exit
# (didactic_review.py). Its own refusal is not a finding: the middle-build
# step it could not reconcile still fails and blocks.
RECONCILIATION_STEPS = frozenset({"didactic-review-reconciliation"})


def gate_class(code):
    """Class of one code. Unknown codes are truth."""
    row = GATES.get(code)
    return row[0] if row else TRUTH


def names_questions(code):
    row = GATES.get(code)
    return bool(row and row[1])


def finding(code, step, question=None, item=None, **evidence):
    """One structured finding. ``evidence`` is bounded numeric data only."""
    row = {"code": code, "class": gate_class(code), "step": step}
    if question is not None:
        row["question"] = question
        if item is not None:
            row["item"] = item
    if row["class"] == EDITORIAL:
        row["note"] = NOTES[code]
    if evidence:
        row["evidence"] = evidence
    return row


def blocks(row):
    """Every finding blocks, editorial ones included, with one exception.

    A DIDACTIC_REVIEW row of middle-build: it exists only after
    didactic_review.py reconciled the pinned driver's REVIEW-only exit and
    the runner set that step to REVIEW; its delivery follows the runner's own
    result, and this keeps its per-question teacher note. A G51 always
    blocks, whatever a row says about it.
    """
    return not (row.get("code") == "DIDACTIC_REVIEW" and row.get("step") == "middle-build"
                and row.get("class") == EDITORIAL)


def review_findings(rows):
    """Teacher notes for the manifest: one entry per code, in first-seen order."""
    grouped = {}
    for row in rows:
        if blocks(row):
            continue
        code = row["code"]
        entry = grouped.setdefault(code, {"code": code, "class": row["class"], "count": 0,
                                          "steps": [], "questions": []})
        entry["count"] += 1
        if row["step"] not in entry["steps"]:
            entry["steps"].append(row["step"])
        question = row.get("question")
        if question is not None and question not in entry["questions"]:
            entry["questions"].append(question)
        rule = (row.get("evidence") or {}).get("rule")
        if isinstance(rule, str):  # the middle checker's own rule id, for example D12
            rules = entry.setdefault("rules", {})
            rules[rule] = rules.get(rule, 0) + 1
    result = []
    for entry in grouped.values():
        entry["questions"] = sorted(entry["questions"])[:MAX_REVIEW_QUESTIONS]
        if entry["class"] == EDITORIAL:
            entry["note"] = NOTES[entry["code"]]
        result.append(entry)
    return result


def decide(report, failed_steps=()):
    """The delivery decision for one render or one pre-pass. Pure.

    ``report`` is skill_feedback's structured report. ``failed_steps`` are the
    names of the steps that did not pass.

    action:
      deliver  nothing blocks. The only rows that do not block are
               middle-build DIDACTIC_REVIEW rows (blocks()); their notes
               stay in reviewFindings.
      replace  something blocks and every blocking finding names a question.
               ``questions`` lists them; the caller may replace those
               questions and render again.
      fail     something blocks that names no question, a step failed
               without a readable finding, or the report is incomplete.
    """
    rows = list(report.get("findings", ())) + list(report.get("unnamed", ()))
    explained = {row["step"] for row in rows}
    for step in failed_steps:
        if step not in explained and step not in RECONCILIATION_STEPS:
            rows.append(finding(STEP_CODES.get(step, "STEP_FAILED"), step))
    if report.get("complete") is not True and not any(row["code"] == "UNREADABLE" for row in rows):
        rows.append(finding("UNREADABLE", "report"))
    blocking = [row for row in rows if blocks(row)]
    questions = sorted({row["question"] for row in blocking if row.get("question") is not None})
    if not blocking:
        action = "deliver"
    elif all(row.get("question") is not None for row in blocking):
        action = "replace"
    else:
        action = "fail"
    return {
        "action": action,
        "blocking": [{key: row[key] for key in ("code", "class", "step", "question", "item") if key in row}
                     for row in blocking],
        "questions": questions,
        "reviewFindings": review_findings(rows),
        "reviewSteps": sorted({row["step"] for row in rows if not blocks(row)} - {row["step"] for row in blocking}),
    }


def public_review_findings(rows):
    """The part of manifest reviewFindings that may leave the worker.

    Codes are checked against the table and notes are taken from it, so no
    manifest text reaches the job result. A row whose class says reconciled
    stays private.
    """
    result = []
    if not isinstance(rows, list):
        return result
    for row in rows[:40]:
        if not isinstance(row, dict):
            continue
        code, count = row.get("code"), row.get("count")
        if (not isinstance(code, str) or gate_class(code) != EDITORIAL or row.get("class") == "reconciled"
                or type(count) is not int or not 0 < count <= MAX_REVIEW_COUNT):
            continue
        entry = {"code": code, "count": count, "note": NOTES[code]}
        questions = row.get("questions")
        if isinstance(questions, list):
            numbers = sorted({q for q in questions if type(q) is int and 1 <= q <= MAX_REVIEW_QUESTIONS})
            if numbers:
                entry["questions"] = numbers
        result.append(entry)
    return result


def unverified_rows(rows):
    """Check a list of unverified printed answers: [{question, item, kind}] or None.

    Positions and a closed kind only. Anything else makes the whole list
    untrusted (None), so a caller fails closed instead of dropping a note.
    """
    if not isinstance(rows, list) or len(rows) > MAX_UNVERIFIED_ITEMS:
        return None
    result = []
    for row in rows:
        if not isinstance(row, dict):
            return None
        question, item, kind = row.get("question"), row.get("item"), row.get("kind", "review")
        if (type(question) is not int or type(item) is not int or not 1 <= question <= 99
                or not 1 <= item <= 9 or kind not in UNVERIFIED_NOTES):
            return None
        result.append({"question": question, "item": item, "kind": kind})
    return result


def public_teacher_notes(rows):
    """Teacher notes for the job result: one entry per kind of unverified answer.

    [{"code": "UNVERIFIED_ANSWER", "kind", "count", "note", "items": [{"question", "item"}]}]
    in the fixed order of UNVERIFIED_NOTES. The note is this module's own
    sentence; no worksheet text is read. An untrusted list gives no entry.
    """
    checked = unverified_rows(rows)
    result = []
    for kind, note in UNVERIFIED_NOTES.items():
        items = sorted({(row["question"], row["item"]) for row in checked or () if row["kind"] == kind})
        if items:
            result.append({"code": "UNVERIFIED_ANSWER", "kind": kind, "count": len(items), "note": note,
                           "items": [{"question": question, "item": item} for question, item in items]})
    return result
