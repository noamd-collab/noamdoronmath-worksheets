"""Teaching-quality predicates of one question, read at selection time.

The checkers of live rounds 1 and 2 found questions that were correct and
still not fit to print: every item of a question with the same answer, an
intro that promises an activity none of the items asks for, and a question
built on the subject of a later lesson. Each predicate below reads one
validated question (general_source.validate_question) and the solved task of
each computed item; a code makes it a bad question, so a reserve replaces it
(lesson_select). Nothing here reads a topic id: the rules are families of
printed forms, the intro's cue words, and the catalog's own order of lessons.

  QUESTION_SAME_ANSWERS   every item of the question has the same final answer
  QUESTION_STEM_MISMATCH  the intro asks for an activity no item carries out
  OUTSIDE_LESSON_BOUNDARY a term outside the lesson's boundary, or the subject
                          of a later lesson of the same grade

The first two are soft (SOFT): the question is replaced when a reserve, or a
correction call made for another reason, can replace it, and printed otherwise.
"""
from __future__ import annotations

import json
import re
import unicodedata

SAME_ANSWERS = "QUESTION_SAME_ANSWERS"
STEM_MISMATCH = "QUESTION_STEM_MISMATCH"
OUTSIDE_BOUNDARY = "OUTSIDE_LESSON_BOUNDARY"
# A reserve, or a correction call made anyway, replaces a question with a soft
# code; otherwise it is printed (general_provider.Draft._keep_soft, shorten):
# a soft code alone never costs a model call, a question or the sheet. A
# question beyond the boundary is never printed.
SOFT = frozenset({SAME_ANSWERS, STEM_MISMATCH})

_POINTS = re.compile(r"[֑-ׇ]")


def _plain(value):
    return _POINTS.sub("", unicodedata.normalize("NFKC", value or ""))


def _words(spans):
    """Unpointed prose of rich spans, with @ for each mathematical span."""
    if isinstance(spans, str):
        return _plain(spans)
    return "".join(_plain(span.get("text", "")) if span.get("kind") == "text" else "@"
                   for span in spans or () if isinstance(span, dict))


def _kind(item):
    answer = item.get("answer") or {}
    if answer.get("kind") == "computed" and isinstance(answer.get("task"), dict):
        return answer["task"].get("kind")
    return answer.get("kind")


# ------------------------------------------------------------- the same answer
def final_answer(solved):
    """What the key of one solved item states, without the letter it names."""
    question, result = solved.get("question", {}), solved.get("result", {})
    if question.get("kind") == "decide":
        return ("verdict", bool(result.get("holds")))
    kind = result.get("type")
    if kind == "solutions":
        return ("solutions", result.get("classification"),
                json.dumps(result.get("values"), sort_keys=True), json.dumps(result.get("excludedValues"), sort_keys=True))
    if kind == "expression":
        return ("value", json.dumps(result.get("value"), sort_keys=True))
    if kind == "comparison":
        return ("comparison", result.get("relation"))
    return ("other", json.dumps({k: v for k, v in result.items() if k != "variable"}, sort_keys=True, default=str))


def same_answers(question, evidence):
    """Every item of the question is keyed, and all keys state one answer (6, 6, 6 or yes, yes, yes).

    A pupil who finds the first answer copies it twice; a run of one verdict
    is guessed. Two equal answers out of three are left alone, and so are
    items that repeat one another word for word: one item printed again is
    the clone check's matter (house gate G62), not a run of answers.
    """
    items = question.get("items") or []
    if len(items) < 2 or len(evidence) != len(items):
        return False
    if len({json.dumps(item, sort_keys=True, ensure_ascii=False) for item in items}) == 1:
        return False
    return len({final_answer(row["computed"]) for row in evidence}) == 1


# ------------------------------------------------------ the intro and its items
# Each family: the cue in the intro, and what at least one item must then carry.
_DECISION = re.compile(
    r"(?<![א-ת])(?:קבלת\s+החלטות?|ה?החלטה|החליטו|הכריעו|ו?קבעו\s+(?:[^.?!:@]{0,30}\s)?(?:אם|האם)"
    r"|נכון\s+או\s+(?:לא\s+נכון|שגוי))(?![א-ת])")
_CHOICE = re.compile(
    r"(?<![א-ת])(?:ו?(?:בחרו|סמנו|הקיפו)\s+(?:את\s+)?ה(?:משווא|ביטוי|תרגיל|תשוב|פעול|ערך|ערכ|מספר|סימן|שבר)[א-ת]*"
    r"(?:\s+[א-ת]+){0,2}\s+ה?(?:מתאימ|נכונ|מתאים|נכון)[א-ת]*"
    r"|מתוך\s+הרשימה|מבין\s+האפשרויות)")
_DATA = re.compile(
    r"(?<![א-ת])(?:ו?(?:בחרו|זהו|סמנו|בדקו)\s+(?:רק\s+)?(?:מתוך\s+[א-ת]+\s+)?(?:את\s+)?ה?(?:נתונים|נתון|מידע|כמויות)"
    r"|(?:נתון|נתונים|פרט|פרטים)\s+(?:מיותר|מיותרים|עודף|עודפים))(?![א-ת])")
# Two ways of working one example: "השוו בין שתי דרכי פתרון", "השוואת שתי שיטות".
_METHODS = re.compile(r"(?<![א-ת])(?:ו?השוו|השוואת|השוואה)\s+(?:בין\s+)?(?:שתי\s+|שני\s+)?(?:ה?דרכי|דרכים|ה?שיטות)(?![א-ת])")
_COMPARED = re.compile(r"(?<![א-ת])[ובהש]{0,2}(?:השוו|ההפרש\s+בין|בכמה|אות(?:ה|ו)\s+(?:תוצאה|פתרון|ערך|מספר)|זהה|זהות|זהים|שוות|שווים|איזו\s+(?:דרך|שיטה)|איזה\s+(?:דרך|שיטה)|(?:נוחה|נוח|קצרה|קצר)\s+יותר"
                       r"|ב?שתי\s+ה(?:דרכים|שיטות)|(?:דרך|שיטה)\s+ב['׳]?|תלמיד\s+אחר|תלמידה\s+אחרת)(?![א-ת])")
_ESTIMATE = re.compile(r"(?<![א-ת])(?:ו?(?:העריכו|אמדו)|אומדן|אמידת|הערכה|ו?היעזרו\s+באומדן)(?![א-ת])")
_ESTIMATED = re.compile(r"(?<![א-ת])(?:ו?(?:העריכו|אמדו|עגלו)|אומדן|הערכה|בערך|בקירוב|קרוב|קרובה|גבול|גבולות|בין)(?![א-ת])")
# "Do the (first, next, only) step": the planner's words; the step itself is never printed.
_STEP = re.compile(r"(?<![א-ת])(?:ו?(?:בצעו|נבצע|ביצוע)\s+(?:שוב\s+)?(?:את\s+)?(?:ה|אותו\s+)?צעד|צעד\s+ראשון)(?![א-ת])")
_STEP_PRINTED = re.compile(r"(?<![א-ת])[הבלו]{0,2}(?:צעד|צעדים|שלב|שלבים)(?![א-ת])")
_CONSTRAINT = re.compile(r"(?<![א-ת])[הבלו]{0,2}(?:אילוץ|אילוצים)(?![א-ת])")
_CONDITION = re.compile(r"(?<![א-ת])(?:אם|ידוע\s+כי|ידוע\s+ש|כך\s+ש|בתנאי|עבור\s+איז[הו]|כאשר|נתון\s+כי|נתון\s+ש)")


def _carries_number(span):
    if span.get("kind") == "text":
        return False
    if span.get("kind") == "formula":
        return bool(re.search(r"[0-9]", span.get("notation", "")))
    return '"numerator"' in json.dumps(span, sort_keys=True) or bool(re.search(r"[0-9]", json.dumps(span)))


def _options_printed(question):
    """The question shows the candidates to choose from: in its intro, a table, or one item."""
    if question.get("table"):
        return True
    if sum(1 for span in question.get("intro") or () if _carries_number(span)) >= 2:
        return True
    return any(sum(1 for span in item.get("prompt") or () if span.get("kind") != "text") >= 2
               and _kind(item) in ("compare", "decide", "label", "review")
               for item in question.get("items") or ())


def _story(item):
    """An item whose givens stand in words: two numbers or more, each in its own place."""
    return sum(1 for span in item.get("prompt") or () if _carries_number(span)) >= 2


def stem_mismatch(question, evidence=()):
    """The cue family of the intro that no item carries out, or None.

    decision  "החליטו", "הכריעו", "קבעו אם", "קבלת החלטות": an item decides (a decide, compare,
              review, label or open answer, or a yes/no prompt). "בדקו אם" is a self-check and stays.
    choice    "בחרו את המשוואה המתאימה", "מתוך הרשימה": the candidates are printed.
    methods   "השוו בין שתי דרכי פתרון": an item compares, or two items work one example
              to the same answer.
    data      "בחרו את הנתונים", "זהו את הנתונים", "נתון מיותר": the givens stand in words,
              in the intro or in an item (two numbers or more, each in its own place).
    estimate  "העריכו", "אמדו", "אומדן": an item asks for an estimate or a bound.
    step      "בצעו את הצעד הראשון", "נבצע שוב את אותו צעד": an item prints or names a step.
    condition "תחת האילוץ הנתון": an item states a condition.
    """
    from printed_tasks import yes_no_question
    intro = _words(question.get("intro"))
    items = [item for item in question.get("items") or () if isinstance(item, dict)]
    prompts = [_words(item.get("prompt")) for item in items]
    kinds = [_kind(item) for item in items]
    if _DECISION.search(intro) and not (
            any(kind in ("decide", "compare", "review", "label", "open") for kind in kinds)
            or any(yes_no_question(prompt) for prompt in prompts)):
        return "decision"
    if _CHOICE.search(intro) and not (_options_printed(question) or "compare" in kinds):
        return "choice"
    answers = [final_answer(row["computed"]) for row in evidence]
    if _METHODS.search(intro) and not (
            any(kind in ("decide", "compare", "review") for kind in kinds)
            or any(_COMPARED.search(prompt) for prompt in prompts) or len(set(answers)) < len(answers)):
        return "methods"
    if _DATA.search(intro) and not (any(_story(item) for item in items) or _story({"prompt": question.get("intro")})):
        return "data"
    if _ESTIMATE.search(intro) and not (any(_ESTIMATED.search(prompt) for prompt in prompts) or "decide" in kinds):
        return "estimate"
    if _STEP.search(intro) and not any(_STEP_PRINTED.search(prompt) for prompt in prompts):
        return "step"
    if _CONSTRAINT.search(intro) and not any(_CONDITION.search(prompt) for prompt in prompts):
        return "condition"
    return None


# ------------------------------------------------------------ the lesson boundary
def _contains_term(text, term):
    """The pinned elementary G66 reading (content_quality._contains_term): a whole word, or a bare sign."""
    term = _plain(term).strip()
    if not term:
        return False
    if not any("א" <= ch <= "ת" or ch.isalpha() for ch in term):
        return term in text
    return bool(re.search(r"(?<![א-תA-Za-z])" + re.escape(term) + r"(?![א-תA-Za-z])", text))


def _printed_text(question):
    """Every printed string of the question: intro, table cells, prompts, units and written answers."""
    parts = []

    def spans(value):
        for span in value if isinstance(value, list) else ():
            if isinstance(span, dict) and span.get("kind") == "text":
                parts.append(span.get("text", ""))
            elif isinstance(span, dict) and span.get("kind") == "formula":
                parts.append(span.get("notation", ""))
    spans(question.get("intro"))
    table = question.get("table") or {}
    for cell in [*(table.get("head") or ()), *(cell for row in table.get("rows") or () for cell in row)]:
        spans(cell)
    for item in question.get("items") or ():
        spans(item.get("prompt"))
        answer = item.get("answer") or {}
        for key in ("unit", "text"):
            value = answer.get(key)
            if isinstance(value, str):
                parts.append(value)
            else:
                spans(value)
    return _plain(" ".join(parts))


def boundary_term(question, scope):
    """The first term of the lesson's forbidden concepts that the question prints, or None."""
    text = _printed_text(question)
    for term in scope.get("forbiddenConcepts") or ():
        if isinstance(term, str) and _contains_term(text, term):
            return term
    return None


def _trees(question, evidence, grade):
    """Every expression the question computes or prints: typed tasks and printed formulas."""
    from compact_authoring import expression
    from general_source import GeneralSourceError
    from math_tasks import MathTaskError
    found = []

    def collect(value):
        if isinstance(value, dict):
            if value.get("type") == "operation":
                found.append(value)
            for child in value.values():
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)
    for row in evidence:
        collect(row["computed"].get("question"))
    spans = list(question.get("intro") or ())
    for item in question.get("items") or ():
        spans += list(item.get("prompt") or ())
    for span in spans:
        if span.get("kind") == "math":
            collect(span.get("expression"))
        elif span.get("kind") == "formula":
            for side in re.split(r"[=<>≤≥≠]", span.get("notation", "")):
                if side.strip() and "___" not in side:
                    try:
                        collect(expression(side.strip(), grade))
                    except (GeneralSourceError, MathTaskError, ValueError, TypeError, KeyError, RecursionError):
                        pass
    return found


def _canon(tree):
    return json.dumps(tree, sort_keys=True)


def _binary(tree, *ops):
    return (isinstance(tree, dict) and tree.get("type") == "operation" and tree.get("op") in ops
            and len(tree.get("args") or ()) == 2)


def distributive_pair(question, evidence, grade):
    """The question shows a(b ± c) beside ab ± ac, or (b ± c) : a beside b : a ± c : a (the same a, b, c)."""
    grouped, expanded = set(), set()
    for tree in _trees(question, evidence, grade):
        if _binary(tree, "multiply"):
            for factor, rest in (tree["args"], tree["args"][::-1]):
                if _binary(rest, "add", "subtract"):
                    grouped.add(("multiply", _canon(factor), rest["op"], _canon(rest["args"][0]), _canon(rest["args"][1])))
        if _binary(tree, "divide") and _binary(tree["args"][0], "add", "subtract"):
            inner = tree["args"][0]
            grouped.add(("divide", _canon(tree["args"][1]), inner["op"], _canon(inner["args"][0]), _canon(inner["args"][1])))
        if _binary(tree, "add", "subtract"):
            left, right = tree["args"]
            if _binary(left, "multiply") and _binary(right, "multiply"):
                for a, b in (left["args"], left["args"][::-1]):
                    for c, d in (right["args"], right["args"][::-1]):
                        if _canon(a) == _canon(c):
                            expanded.add(("multiply", _canon(a), tree["op"], _canon(b), _canon(d)))
            if _binary(left, "divide") and _binary(right, "divide") and _canon(left["args"][1]) == _canon(right["args"][1]):
                expanded.add(("divide", _canon(left["args"][1]), tree["op"], _canon(left["args"][0]), _canon(right["args"][0])))
    return bool(grouped & expanded)


# A printed form and the word that names its law in the catalog's lesson titles.
SUBJECT_FORMS = (("פילוג", distributive_pair),)


def later_subject(question, evidence, lesson, scope, topics=None):
    """The catalog title word of a later lesson whose subject this question is built on, or None.

    A form names its law ("פילוג" for a(b + c) = ab + ac). When a lesson of the
    same grade that comes after this one carries that word in its title, and
    neither this lesson's own topic nor the teacher's description of what the
    class already learned names it, the question teaches the next lesson.
    """
    if topics is None:
        from runtime_catalog import catalog
        topics = catalog().topics
    topic = scope["topic"]
    own = " ".join([topic.get("title", "")] + [c.get("text", "") for c in scope.get("selectedConcepts") or ()])
    learned = " ".join(str(x) for x in [lesson.get("lastLesson", ""), *(lesson.get("alreadyLearned") or ())])
    for word, form in SUBJECT_FORMS:
        if word in own or word in learned:
            continue
        later = [row for row in topics
                 if row["skillId"] == topic["skillId"] and row["sourceTrack"] == topic["sourceTrack"]
                 and row["order"] > topic["order"] and word in row["title"]]
        if later and form(question, evidence, lesson["gradeNumber"]):
            return word
    return None


def question_quality(question, evidence, lesson, scope):
    """Every teaching-quality code of one validated question; [] when it may be printed."""
    codes = []
    if same_answers(question, evidence):
        codes.append(SAME_ANSWERS)
    if stem_mismatch(question, evidence):
        codes.append(STEM_MISMATCH)
    if boundary_term(question, scope) or later_subject(question, evidence, lesson, scope):
        codes.append(OUTSIDE_BOUNDARY)
    return codes
