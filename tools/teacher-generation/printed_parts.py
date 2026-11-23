"""Answer every blank that the pupil sees, and decide what is printed beside a prompt.

A typed task has one exact result. A printed prompt can ask for more than one
answer (a quotient and its remainder, several terms of a sequence, hours and
minutes), and it can already show the exercise that the task repeats. Each
binder here recomputes the whole printed answer from the printed givens and
checks the typed result against it. A prompt with several blanks that no
binder recognizes is refused: one number never answers two blanks.

Nothing here approves prose. Every refusal is a recoverable
PRINTED_TASK_MISMATCH for one question.
"""

from fractions import Fraction
import re

from general_source import GeneralSourceError
from math_tasks import validate_and_solve_task
from numeric_literals import NUMBER_TOKEN, literal_value
from printed_elementary import PrintedAnswer, _json_number, _unpointed, blank_count, place_answer, read_tokens


def _reject(reason="The printed question and its typed answer do not agree"):
    raise GeneralSourceError("PRINTED_TASK_MISMATCH", reason)


def _words(spans):
    """Unpointed prose, with every mathematical span replaced by @."""
    return _unpointed("".join(s["text"] if s["kind"] == "text" else "@" for s in spans))


def _scalar(solved):
    """The exact number of a single-valued typed task, or None."""
    result = solved.get("result", {})
    value = result.get("value") if result.get("type") == "expression" else None
    if not isinstance(value, dict) or value.get("type") != "number":
        return None
    return Fraction(value["numerator"], value["denominator"])


def _value(tree):
    """Evaluate a closed printed expression with the same exact kernel."""
    return _scalar(validate_and_solve_task({"kind": "evaluate", "expression": tree}))


def _closed(span, grade):
    """The expression of one printed operand, or None for a relation, blank or label."""
    if span["kind"] == "math":
        return span["expression"]
    if span["kind"] != "formula" or re.search(r"[=<>≤≥≠!]|___|[A-Za-z]", span["notation"].replace("frac", "").replace("sqrt", "")):
        return None
    from compact_authoring import expression
    try:
        return expression(span["notation"], grade)
    except GeneralSourceError:
        return None


def _numbers(tree, found):
    if isinstance(tree, dict):
        if tree.get("type") == "number" and "numerator" in tree:
            found.add(Fraction(tree["numerator"], tree["denominator"]))
        else:
            for child in tree.values():
                _numbers(child, found)
    elif isinstance(tree, list):
        for child in tree:
            _numbers(child, found)
    return found


def task_numbers(task):
    """Every number that the typed task brings to the exercise."""
    return _numbers({k: v for k, v in task.items() if k != "figure"}, set())


def _written_terms(tree, found, *, exponents=True):
    """The numbers written in a printed expression: a stacked fraction shows its numerator and denominator.

    ``exponents=False`` leaves out the exponent of a power, which a pupil reads
    as the form of the power and not as a quantity.
    """
    if isinstance(tree, dict):
        if tree.get("type") == "number" and "numerator" in tree:
            found.add(Fraction(tree["numerator"], tree["denominator"]))
            if tree["denominator"] != 1:
                found.update((Fraction(abs(tree["numerator"])), Fraction(tree["denominator"])))
        elif not exponents and tree.get("type") == "operation" and tree.get("op") == "power":
            _written_terms(tree.get("args", [None])[0], found, exponents=False)
        else:
            for child in tree.values():
                _written_terms(child, found, exponents=exponents)
    elif isinstance(tree, list):
        for child in tree:
            _written_terms(child, found, exponents=exponents)
    return found


_POWER_EXPONENT = re.compile(r"\^\s*(?:\(\s*[-−]?[0-9]+\s*\)|[-−]?[0-9]+)")


def visible_numbers(spans, *, exponents=True):
    """Every number that a pupil can read in these spans.

    A written fraction a/b counts as a/b and as its two written numbers.
    ``exponents=False`` leaves out the exponents of powers.
    """
    found = set()
    for span in spans:
        if span["kind"] == "math":
            _written_terms(span["expression"], found, exponents=exponents)
            continue
        text = span.get("text") if span["kind"] == "text" else span.get("notation", "")
        text = text or ""
        if not exponents:
            text = _POWER_EXPONENT.sub(" ", text)
        for match in NUMBER_TOKEN.finditer(text):
            value = literal_value(match[0])
            found.add(value)
            if text[match.end():match.end() + 1] == "%":
                found.add(value / 100)
        for pair in re.finditer(r"frac\(\s*([0-9]+)\s*,\s*([1-9][0-9]*)\s*\)", text):
            found.add(Fraction(int(pair[1]), int(pair[2])))
    return found


def _key_values(solved):
    """The numbers an answer key prints for one computed item: its value, or each of its solutions."""
    result = solved.get("result", {}) if isinstance(solved, dict) else {}
    if result.get("type") == "expression":
        rows = [result.get("value")]
    elif result.get("type") == "solutions" and result.get("classification") == "finite":
        rows = result.get("values") or []
    else:
        return set()
    return {Fraction(row["numerator"], row["denominator"]) for row in rows
            if isinstance(row, dict) and row.get("type") == "number" and "numerator" in row}


# ------------------------------------------------------- which solution is asked
# Words that choose among the solutions of a typed equation. Unpointed, with
# the Hebrew prefixes a sentence puts before them.
_POSITIVE_WORD = re.compile(r"(?<![א-ת])[ובלשה]{0,2}(?:חיובי(?:ת|ים|ות)?|טבעי(?:ת|ים|ות)?)(?![א-ת])")
_NEGATIVE_WORD = re.compile(r"(?<![א-ת])[ובלשה]{0,2}שלילי(?:ת|ים|ות)?(?![א-ת])")
_NOT_NEGATIVE = re.compile(r"(?<![א-ת])(?:ש?(?:אינו|אינה|אינם|אינן)\s+|אי[־-]?)שלילי(?:ת|ים|ות)?(?![א-ת])")
_NOT_ZERO = re.compile(r"(?<![א-ת])(?:ש?(?:אינו|אינה|אינם|אינן)\s+|ה?שונ(?:ה|ים|ות)\s+מ[־-]?)אפס(?![א-ת])")
# "הפתרון הקטן", "השורש הגדול יותר": an order among the solutions themselves.
_SOLUTION_EXTREME = re.compile(
    r"(?<![א-ת])[ובלשה]{0,2}(?:פתרון|שורש)(?:ות)?\s+ה(גדול|קטן)(?:ה|ים|ות)?(?![א-ת])")
# "המספר הקטן", "הגדול מביניהם": an order among the numbers of a story.
_NUMBER_EXTREME = re.compile(r"(?<![א-ת])[וש]?ה(גדול|קטן|ארוך|קצר)(?:ה|ים|ות)?(?![א-ת])")
# A key in one of these units measures a size, a price, a time or a count: never negative.
_MAGNITUDE_UNIT = re.compile(
    r"(?:ס[\"״]מ|סמ[\"״][רק]|מ[\"״][מרקל]|ק[\"״][מג]|קמ[\"״]ר|דצ[\"״]מ|דצמ[\"״][רק]|ש[\"״]ח|₪|מ['׳]"
    r"|(?:סנטי|מילי|קילו|דצי)?מטר(?:ים)?(?:\s+(?:רבוע|מרובע|מעוקב)(?:ים)?)?|(?:מילי)?ליטר(?:ים)?|(?:קילו)?גרם(?:ים)?"
    r"|טון(?:ות)?|שקל(?:ים)?|אגורו?ת|אגורה|שנים|שנה|חודש(?:ים)?|שבוע(?:ות)?|ימים|יום|שעות|שעה|דקות|דקה"
    r"|שניות|שני(?:י)?ה|יחיד(?:ה|ות)(?:\s+(?:אורך|שטח|נפח))?|תלמיד(?:ים|ות)?|ילד(?:ים|ות)?|אנשים|פריטים)")


def _sign_cue(words):
    """"positive", "negative" or "not negative" from the words, None when they say none or both."""
    found = set()
    if _NOT_NEGATIVE.search(words):
        found.add("not_negative")
        words = _NOT_NEGATIVE.sub(" ", words)
    if _POSITIVE_WORD.search(words):
        found.add("positive")
    if _NEGATIVE_WORD.search(words):
        found.add("negative")
    return found.pop() if len(found) == 1 else None


def chosen_solutions(question, item, solved):
    """The solutions of a typed equation that the item asks for, or None when the key prints them all.

    An equation such as x(x+5) = 24 has two solutions, and the item often asks
    for one: "the positive solution", "the smaller solution", "the width in
    metres". Printing both would print a wrong answer beside the right one (a
    negative width). The words that choose are read from the item, and a sign
    word also from the group's intro; a unit of size, price, time or count keeps
    the solutions that are not negative. An order among the numbers of a story
    ("המספר הקטן") picks the least or greatest solution only when every kept
    solution has one sign; otherwise the words do not fix one answer and the
    item is refused, as it is when they choose no solution at all.

    Returns the chosen solution rows, a non-empty list; None leaves the key as
    the kernel solved it (no choosing word, or at most one solution).
    """
    result = solved.get("result", {}) if isinstance(solved, dict) else {}
    if result.get("type") != "solutions" or result.get("classification") != "finite":
        return None
    rows = list(result.get("values") or [])
    if len(rows) < 2:
        return None
    words = _words(item["prompt"])
    sign = _sign_cue(words) or _sign_cue(_words(question["intro"]))
    unit = _unpointed(item["answer"].get("unit") or "").strip()
    if sign is None and unit and _MAGNITUDE_UNIT.fullmatch(unit):
        sign = "not_negative"
    if not (sign or _NOT_ZERO.search(words) or _SOLUTION_EXTREME.search(words) or _NUMBER_EXTREME.search(words)):
        return None
    exact = {id(row): _real_value(row) for row in rows}
    if any(v is None for v in exact.values()):
        # A solution that is not one real constant (a parameter, an undecidable sign) cannot be chosen.
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The item asks for one of the solutions and the kernel cannot order them")
    value = lambda row: exact[id(row)]
    kept = rows
    if sign == "positive":
        kept = [row for row in kept if value(row) > 0]
    elif sign == "negative":
        kept = [row for row in kept if value(row) < 0]
    elif sign == "not_negative":
        kept = [row for row in kept if value(row) >= 0]
    used = sign is not None
    if _NOT_ZERO.search(words):
        kept = [row for row in kept if value(row) != 0]
        used = True
    greatest = {"גדול": True, "ארוך": True, "קטן": False, "קצר": False}
    orders = {greatest[m[1]] for m in _SOLUTION_EXTREME.finditer(words)}
    numbers = {greatest[m[1]] for m in _NUMBER_EXTREME.finditer(words)}
    if len(orders) > 1 or (not orders and len(numbers) > 1 and len(kept) > 1):
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The item names both the greater and the smaller solution; ask for one")
    if orders:
        used = True
        if kept:
            kept = [(max if orders.pop() else min)(kept, key=value)]
    elif numbers and len(kept) > 1:
        used = True
        if not (all(value(row) > 0 for row in kept) or all(value(row) < 0 for row in kept)):
            raise GeneralSourceError(
                "PRINTED_ANSWER_KIND",
                "The equation has solutions of both signs and the item asks for one number; say which one "
                "in its words (positive, negative) or type an equation with one solution")
        kept = [(max if numbers.pop() else min)(kept, key=value)]
    if not used:
        return None
    if not kept:
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "No solution of the typed equation is the one the item asks for")
    return kept


def _real_value(row):
    """The exact real value of one solution, ordered like a number, or None."""
    from math_tasks import Compiler, MathTaskError, S
    if isinstance(row, dict) and row.get("type") == "number" and "numerator" in row:
        return _RealKey(S.Rational(row["numerator"], row["denominator"]))
    try:
        expr = Compiler().compile(row).expr
    except (MathTaskError, KeyError, TypeError, ValueError):
        return None
    if expr.free_symbols or expr.is_real is not True or expr.is_zero is None:
        return None
    return _RealKey(expr)


class _RealKey:
    """A real algebraic number compared exactly (sympy decides the sign of a difference)."""

    def __init__(self, expr):
        self.expr = expr

    def _sign(self, other):
        other = other.expr if isinstance(other, _RealKey) else other
        difference = (self.expr - other)
        if difference.is_zero:
            return 0
        if difference.is_positive:
            return 1
        if difference.is_negative:
            return -1
        raise GeneralSourceError("PRINTED_ANSWER_KIND", "The kernel cannot order these solutions")

    def __gt__(self, other):
        return self._sign(other) > 0

    def __lt__(self, other):
        return self._sign(other) < 0

    def __ge__(self, other):
        return self._sign(other) >= 0

    def __le__(self, other):
        return self._sign(other) <= 0

    def __eq__(self, other):
        return self._sign(other) == 0

    def __ne__(self, other):
        return self._sign(other) != 0

    __hash__ = None


def narrowed(solved, chosen):
    """The solved task with only the chosen solutions, for the key; the task itself is unchanged."""
    if chosen is None:
        return solved
    from copy import deepcopy
    copy = deepcopy(solved)
    copy["result"]["values"] = deepcopy(chosen)
    return copy


# ----------------------------------------------------- the answer beside itself
def _printed_integers(spans, *, skip_blanks=False):
    """The integers a pupil reads in these spans: digits as written, not the exponent of a power.

    ``skip_blanks`` leaves out a formula with a blank, the exercise the pupil completes.
    """
    found = set()
    for span in spans:
        if span["kind"] == "math":
            found |= {v for v in _written_terms(span["expression"], set(), exponents=False) if v.denominator == 1}
            continue
        text = (span.get("text") if span["kind"] == "text" else span.get("notation")) or ""
        if span["kind"] == "formula" and "___" in text and skip_blanks:
            continue
        text = _POWER_EXPONENT.sub(" ", text)
        found |= {literal_value(m[0]) for m in NUMBER_TOKEN.finditer(text) if "." not in m[0]}
    return found


# A sentence with one of these words speaks of a result: "הפתרון קרוב ל־8", "התוצאה היא 12".
_RESULT_WORD = re.compile(
    r"(?<![א-ת])[ובלשהכ]{0,2}(?:פתרו(?:ן|נות|נה)|תוצא(?:ה|ת|ות)|תשוב(?:ה|ת)|מנה|מנת|מכפל(?:ה|ת)|סכום|הפרש"
    r"|קרוב(?:ה|ים|ות)?|בערך|נמצא(?:ת|ים|ות)?\s+בין)(?![א-ת])")


# A sentence that reports what someone proposed, claimed or wrote: the pupil checks it, it is not given as the answer.
_CLAIM_WORD = re.compile(
    r"(?<![א-ת])[ו]?(?:הוצעה|הצעה|הציע(?:ה|ו)?|טען|טענה|טוען|טוענת|טענו|כתב(?:ה|ו)?|קיבל(?:ה|ו)?|אמר(?:ה|ו)?"
    r"|חישב(?:ה|ו)?)(?![א-ת])")


def _sentences(spans):
    """The spans split into sentences at a full stop, question mark, exclamation mark or semicolon."""
    sentences, current = [], []
    for span in spans:
        if span["kind"] != "text":
            current.append(span)
            continue
        parts = re.split(r"(?<=[.?!;])", span["text"])
        for index, part in enumerate(parts):
            if part:
                current.append(dict(span, text=part))
            if index < len(parts) - 1:
                sentences.append(current)
                current = []
    if current:
        sentences.append(current)
    return sentences


def _closed_equation(span):
    """A printed numeric fact such as "35 : 7 = 5": a formula with an equals sign, no letter and no blank."""
    notation = (span.get("notation") or "") if span["kind"] == "formula" else ""
    return "=" in notation and "___" not in notation and not re.search(r"[A-Za-z]", notation)


def own_answer_printed(question, item, solved):
    """Whether the item prints the very integer that its key prints.

    "בדיקת התרגיל 35 : 7 = 5 נעשית בעזרת הכפל 5 x 7. מהי תוצאת המכפלה?" keyed
    35, and "הפתרון קרוב ל־8" beside an equation whose solution is 8: the pupil
    reads the answer instead of finding it. Two places print an answer: a
    closed numeric fact in the prompt or the intro that shares a number with
    the typed task (the same calculation, stated complete), and a sentence of
    the prompt that speaks of a result (פתרון, תוצאה, קרוב ל, בערך) and does
    not report a proposed or claimed answer for the pupil to check. A number
    of a story that matches the key by chance ("כל כדור עולה 10 שקלים") is
    neither. Not counted are the numbers of the typed task itself (an identity
    such as (24 : 3) x 3 prints its operands by design), the numbers of a
    formula with a blank (the exercise being completed, as in 3 + 4 = 4 + ___),
    0 and 1, exponents, and keys that are not integers (a change of form, as
    from 50% to 1/2, is the task). ``solved`` carries the chosen solutions.
    """
    values = _key_values(solved)
    if not values or any(v.denominator != 1 for v in values):
        return False
    keyed = {v for v in values if abs(v) > 1}
    if not keyed:
        return False
    task = {k: v for k, v in solved["question"].items() if k != "figure"}
    leaves = _written_terms(task, set())
    excluded = leaves | {
        v for span in item["prompt"] if span["kind"] == "formula" and "___" in (span.get("notation") or "")
        for v in _printed_integers([dict(span, notation=span["notation"].replace("___", " "))])}
    printed = set()
    for span in item["prompt"] + question["intro"]:
        if _closed_equation(span):
            numbers = _printed_integers([span])
            if numbers & leaves:
                printed |= numbers
    for sentence in _sentences(item["prompt"]):
        words = _words(sentence)
        if _RESULT_WORD.search(words) and not _CLAIM_WORD.search(words):
            printed |= _printed_integers(sentence, skip_blanks=True)
    return keyed <= printed - excluded


def _standalone_fractions(spans):
    """Fractions printed as one value in prose: [[5/24]], frac(5,24). Not a fraction inside a formula."""
    found = set()
    for span in spans:
        if span["kind"] == "math":
            tree = span["expression"]
            if tree.get("type") == "number" and tree.get("denominator", 1) != 1:
                found.add(Fraction(tree["numerator"], tree["denominator"]))
        elif span["kind"] == "formula":
            whole = re.fullmatch(r"\s*(?:frac\(\s*([0-9]+)\s*,\s*([1-9][0-9]*)\s*\)|([0-9]+)\s*/\s*([1-9][0-9]*))\s*",
                                 span.get("notation") or "")
            if whole:
                numerator, denominator = (whole[1], whole[2]) if whole[1] else (whole[3], whole[4])
                value = Fraction(int(numerator), int(denominator))
                if value.denominator != 1:
                    found.add(value)
    return found


def _divisors(tree, found):
    """The values that a typed expression divides by, and the denominators of its fractions."""
    if isinstance(tree, dict):
        if tree.get("type") == "number" and "numerator" in tree and tree["denominator"] != 1:
            found.add(Fraction(tree["denominator"]))
        elif tree.get("type") == "operation" and tree.get("op") == "divide":
            try:
                divisor = _value(tree["args"][1])
            except Exception:
                divisor = None
            if divisor is not None:
                found.add(abs(divisor))
        for child in tree.values():
            _divisors(child, found)
    elif isinstance(tree, list):
        for child in tree:
            _divisors(child, found)
    return found


def fraction_parts_as_data(item, solved):
    """Refuse an equation that reads a printed fraction as two separate numbers.

    "סכום ההופכיים שלהם הוא 5/24" typed as x(x+5) = 24 keys the wrong number:
    the task uses the numerator and the denominator of the printed fraction, but
    never the fraction (it neither contains its value nor divides by its
    denominator). Only a solve task and a fraction printed alone as one value
    are read; a fraction inside a printed formula is bound elsewhere.
    """
    task = solved["question"]
    if task.get("kind") != "solve":
        return
    integers = {v for v in _numbers({"lhs": task["lhs"], "rhs": task["rhs"]}, set()) if v.denominator == 1}
    values = task_numbers(task)
    divisors = _divisors({"lhs": task["lhs"], "rhs": task["rhs"]}, set())
    for fraction in _standalone_fractions(item["prompt"]):
        if fraction in values or Fraction(fraction.denominator) in divisors:
            continue
        if Fraction(abs(fraction.numerator)) in integers and Fraction(fraction.denominator) in integers:
            _reject("The typed equation uses the numerator and the denominator of the printed fraction "
                    "as two separate numbers, not the fraction")


# A question sentence that asks for an equation or an expression, not for a number:
# "מה הייתה המשוואה המקורית לפני הפירוק לגורמים?".
_ASKS_EQUATION = re.compile(
    r"(?<![א-ת])(?:מה|מהי|מהו|איזו|איזה)\s+(?:(?:הייתה|היה|היא|הוא)\s+)?ה?(?:משווא(?:ה|ות)|ביטוי|תרגיל)(?![א-ת])[^?.!]*\?")


# A key's unit and the size the item asks for: an area unit for a width, or a length unit for an area, is a wrong key.
_AREA_UNIT = re.compile(r"(?:סמ|דצמ|קמ|ממ|מ)[\"״]ר|(?:סנטי|דצי|קילו|מילי)?מטר(?:ים)?\s+(?:רבוע|מרובע)(?:ים)?|יחידות\s+שטח")
_LENGTH_UNIT = re.compile(r"(?:ס|מ|דצ|ק)[\"״]מ|מ['׳]|(?:סנטי|דצי|קילו|מילי)?מטר(?:ים)?|יחידות\s+אורך")
_ASKS_LENGTH = re.compile(r"(?<![א-ת])[ובלהמש]{0,3}(?:אורכ|אורך|רוחב|גובה|צלע|היקף|היקפ|אלכסונ|רדיוס|קוטר|מרחק)")
_ASKS_AREA = re.compile(r"(?<![א-ת])[ובלהמש]{0,3}שטח")
_ASKING = re.compile(r"(?<![א-ת])(?:מה|מהו|מהי|מצאו|חשבו|כמה|בכמה|כתבו)(?![א-ת])")


def check_unit_size(item):
    """Refuse a key whose unit measures another size than the one the item asks for.

    The asked sentence is the last one with a question or an instruction word.
    "מהו רוחב השולחן" keyed in דצמ"ר (live round 1, g9r quadratics) prints a width
    in square decimetres; "מהו שטח ..." keyed in ס"מ prints an area as a length.
    A sentence that names both sizes ("בכמה סמ"ר גדל השטח כשמאריכים את הצלע")
    decides nothing here.
    """
    unit = item["answer"].get("unit") or ""
    if not unit.strip():
        return
    sentences = [part for part in re.split(r"[.?!]", _words(item["prompt"])) if _ASKING.search(part)]
    if not sentences:
        return
    asked = sentences[-1]
    if re.search(r"(?<![א-ת])[ובלהמש]{0,3}מכפל", asked):
        return  # a product of lengths measures an area
    length, area = bool(_ASKS_LENGTH.search(asked)), bool(_ASKS_AREA.search(asked))
    if (length and not area and _AREA_UNIT.search(unit)) or (
            area and not length and _LENGTH_UNIT.fullmatch(unit.strip()) and not _AREA_UNIT.search(unit)):
        raise GeneralSourceError("PRINTED_ANSWER_KIND", "The key's unit measures another size than the item asks for")


def check_key_print(question, item, solved, grade):
    """The checks of what the key prints beside its own item, at source validation where a refusal is recoverable.

    Returns the solved task narrowed to the solutions the item asks for.
    """
    check_unit_size(item)
    words = _words(item["prompt"])
    asked = _ASKS_EQUATION.search(words)
    if grade >= 7 and asked and words[asked.end():].strip(" .") and solved.get("result", {}).get("type") != "decision":
        # One item, two requests: the equation and a number. A computed key prints only the number.
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The item asks for an equation and for a number; its key prints only the number")
    chosen = chosen_solutions(question, item, solved)
    keyed = narrowed(solved, chosen)
    if own_answer_printed(question, item, keyed):
        raise GeneralSourceError("PRINTED_ANSWER_LEAK", "An item prints its own answer beside its question")
    fraction_parts_as_data(item, solved)
    if "decimal" in answer_form(question, item, solved):
        result = solved.get("result", {})
        if result.get("type") == "expression" and terminating_decimal(result.get("value")) is None:
            raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                     "The item asks for a decimal and its exact answer has no finite decimal")
    return keyed


def terminating_decimal(node):
    """The exact decimal spelling of a number whose expansion ends, or None."""
    if not isinstance(node, dict) or node.get("type") != "number" or "numerator" not in node:
        return None
    n, d = node["numerator"], node["denominator"]
    if d <= 0:
        return None
    rest = d
    for factor in (2, 5):
        while rest % factor == 0:
            rest //= factor
    if rest != 1:
        return None
    integer, remainder = divmod(abs(n), d)
    digits = []
    while remainder:
        digit, remainder = divmod(remainder * 10, d)
        digits.append(str(digit))
    return ("−" if n < 0 else "") + str(integer) + ("." + "".join(digits) if digits else "")


def printed_keys(question, solutions):
    """{item number: its solved task narrowed to the solutions its key prints}, for computed items.

    ``solutions`` holds the solved task of each item in order (None for an item
    without one). The same map validate_question builds for answer_leak, so
    the printer withholds exactly the tasks the validation expected withheld.
    """
    keys = {}
    for j, (item, solved) in enumerate(zip(question["items"], solutions), 1):
        if solved is not None and item["answer"].get("kind") == "computed":
            keys[j] = narrowed(solved, chosen_solutions(question, item, solved))
    return keys


def earlier_answers(question, keys):
    """{item number: the earlier items' key values its print may not show}, or None for an independent item.

    ``keys`` maps an item number (one-based) to its solved computed task. An
    item from the second on may not show a number that an earlier item's key
    prints, unless the intro, the table or an earlier prompt shows it too:
    otherwise the pupil reads that answer beside a later item. 0 and 1 are not
    read as a leaked answer, and neither is the exponent of a power.

    Only items that continue one another are read this way: those of a
    question whose intro or table states numbers that the items share, and an
    item whose words refer back to earlier results. Independent drill items
    under an instruction without numbers (a letter such as [[x]] is not one)
    share small numbers by chance and stay as they are (None).
    """
    shown = visible_numbers(question["intro"]) | visible_numbers(_table_spans(question))
    shared = bool(shown)
    answered, guard = set(), {}
    for j, item in enumerate(question["items"], 1):
        guard[j] = (frozenset(value for value in answered - shown if abs(value) not in (0, 1))
                    if shared or BACK_REFERENCE.search(_words(item["prompt"])) else None)
        shown |= visible_numbers(item["prompt"])
        answered |= _key_values(keys.get(j))
    return guard


def _task_terms(solved):
    """The numbers the typed task prints after its prompt (not the exponents of powers, not a figure's)."""
    return _written_terms({k: v for k, v in solved["question"].items() if k != "figure"}, set(), exponents=False)


# A prompt that only says "compute" or "solve": it asks for the task printed after it and means nothing alone.
_BARE_DIRECTIVE = re.compile(
    r"(?:(?:חשבו|פתרו|מצאו|השלימו|כתבו|רשמו|בדקו)(?: את)?"
    r"(?: התוצאה| התרגיל| התרגילים| הביטוי| ערך הביטוי| הערך| המשוואה| החישוב| הסכום| ההפרש| המכפלה| המנה)?"
    r"(?: של| הבא| הבאה| הבאים| הזה| הזאת)?|מהי התוצאה(?: של)?|מהו הערך(?: של)?|כמה זה)?\s*[:.?!]?")


# A quantity the pupil can find from the question without a printed calculation: a size, a price, a number.
_QUANTITY = re.compile(
    r"(?<![א-ת])[ובלמהש]{0,3}(?:שטח|היקף|אורכ|אורך|רוחב|גובה|גודל|זווי|אלכסונ|צלע|בסיס|רדיוס|קוטר|נפח|מחיר|עלות"
    r"|מספר|הפרש|סכום|מכפלת|מנת|מחצית|ממוצע|משקל|מהירות|מרחק|כמות|גיל)|(?<![א-ת])כמה\s+(?!זה(?![א-ת]))[א-ת]")


# Constants a pupil supplies from the shape or the operation named: half, a double, four sides, a right angle.
_STRUCTURAL = frozenset({Fraction(2), Fraction(3), Fraction(4), Fraction(90), Fraction(180), Fraction(360),
                         Fraction(1, 2), Fraction(1, 3), Fraction(1, 4)})


def needs_task(item):
    """True when the prompt means nothing without the task printed after it.

    A bare instruction ("חשבו:", "חשבו את התוצאה") or a prompt that names no
    quantity and no object ("חשבו ישירות לפי סדר הפעולות") asks for the
    printed calculation itself. A prompt that names what to find ("חשבו את
    היקף המעוין", "מהו גודל הזווית ∡BAD") may stand alone.
    """
    words = " ".join(_words(item["prompt"]).split())
    return bool(_BARE_DIRECTIVE.fullmatch(words)) or ("@" not in words and not _QUANTITY.search(words))


def stands_alone(question, item, solved, withheld):
    """Whether the prompt can be printed without its typed task.

    The prompt names what to find, and the pupil can form the calculation
    from the page: every number of the task is an earlier answer (withheld),
    a number the intro, the table or an earlier prompt prints (in digits or in
    words), or a constant of the shape or the operation (2, 3, 4, 90, 180,
    360, a half, a third, a quarter). "1/5 · 25" under "חשבו כמה תלמידים
    מתקבלים" does not: 1/5 is printed nowhere, so the task stays and the
    question is a leak.
    """
    if needs_task(item):
        return False
    available = set(withheld) | _STRUCTURAL | visible_numbers(question["intro"]) | visible_numbers(_table_spans(question))
    available |= word_numbers(_words(question["intro"]) + " " + _words(item["prompt"]))
    for earlier in question["items"]:
        if earlier is item:
            break
        available |= visible_numbers(earlier["prompt"])
    return {value for value in _task_terms(solved) if abs(value) not in (0, 1)} <= available


def answer_leak(question, keys):
    """The first item that prints the key of an earlier item of the same question, or None.

    What an item prints is its prompt and, when shows_task prints it, its
    typed task (earlier_answers says which numbers it may not show). A task
    that would print an earlier answer is left out when the prompt stands
    alone (shows_task with ``withheld``, stands_alone). A prompt that needs
    that task, and a prompt that prints the answer itself, are refused.
    """
    guard = earlier_answers(question, keys)
    for j, item in enumerate(question["items"], 1):
        withheld = guard[j]
        if withheld is None:
            continue
        printed = visible_numbers(item["prompt"], exponents=False)
        solved = keys.get(j)
        if solved is not None and shows_task(question, item, solved, withheld=withheld):
            # The typed task is printed after this prompt, so its numbers are printed too.
            printed |= _task_terms(solved)
        if printed & withheld:
            return j
    return None


def carries_data(spans):
    """True when the spans show a number, a blank or a formula; a bare label is not data."""
    for span in spans:
        if span["kind"] == "math":
            return True
        if span["kind"] == "formula" and re.search(r"[0-9]|___|[-+*/^=<>≤≥≠]", span["notation"]):
            return True
        if span["kind"] == "text" and re.search(r"[0-9]", span["text"]):
            return True
    return False


def _table_spans(question):
    table = question.get("table")
    if not table:
        return []
    return [span for row in [table["head"], *table["rows"]] for cell in row for span in cell]


def reveals_answer(solved):
    """Printing this task would print its own answer."""
    task, result = solved["question"], solved.get("result", {})
    kind = task.get("kind")
    if kind in ("evaluate", "simplify", "factor", "expand"):
        tree = task["expression"]
        return tree.get("type") == "number" or (result.get("type") == "expression" and tree == result.get("value"))
    if kind in ("solve", "inequality"):
        return {task["lhs"].get("type"), task["rhs"].get("type")} == {"symbol", "number"}
    if kind == "statistics":
        return task.get("operation") == "sort" and result.get("values") == task.get("values")
    return False


# Numbers that a story can state in words. A compound such as "עשרים וחמש"
# is not assembled; it only costs a harmless printed task.
_NUMBER_WORDS = {
    # "אחד" is left out: "כל אחד" and "אף אחד" are not numbers of a story.
    "שניים": 2, "שתיים": 2, "שלוש": 3, "שלושה": 3, "ארבע": 4, "ארבעה": 4,
    "חמש": 5, "חמישה": 5, "שש": 6, "שישה": 6, "שבע": 7, "שבעה": 7, "שמונה": 8, "תשע": 9, "תשעה": 9,
    "עשר": 10, "עשרה": 10, "עשרים": 20, "שלושים": 30, "ארבעים": 40, "חמישים": 50, "שישים": 60,
    "שבעים": 70, "שמונים": 80, "תשעים": 90, "מאה": 100, "מאתיים": 200, "אלף": 1000, "אלפיים": 2000,
}
_PART_WORDS = {"חצי": 2, "מחצית": 2, "שליש": 3, "רבע": 4}


def word_numbers(words):
    """The values of the number words in unpointed prose, with a Hebrew prefix removed."""
    found = set()
    for word in re.findall(r"[א-ת]+", words):
        for stem in (word, word[1:], word[2:]):
            if stem != word and not re.fullmatch(r"[ובלמכשה]+", word[:len(word) - len(stem)]):
                continue
            if stem in _NUMBER_WORDS:
                found.add(Fraction(_NUMBER_WORDS[stem]))
                break
            if stem in _PART_WORDS:
                found.update({Fraction(_PART_WORDS[stem]), Fraction(1, _PART_WORDS[stem])})
                break
    return found


# The pupil's own earlier work supplies the data: "the expression you wrote", "both results".
BACK_REFERENCE = re.compile(
    r"(?<![א-ת])(?:ה?קודמ(?:ת|ים|ות)?|ה?קודם|שכתבתם|שמצאתם|שקיבלתם|שחישבתם|שבניתם|שפתרתם|"
    r"(?:שתי|שני|בין) ה?תוצאות|ב?סעיף [א-ט]['׳]?|ב?סעיפים)(?![א-ת])")


def shows_task(question, item, solved, *, intro=None, withheld=None):
    """Whether the typed task is printed after the pupil prompt.

    It is printed only for a prompt that carries no mathematics of its own,
    and never when the print would be an answer. A prompt with numbers is a
    complete exercise or a word problem; printing the calculation after it
    would repeat the exercise or reveal the operation. The same holds for a
    question about a story or a table that is printed once for all its items,
    and for an item whose words continue the pupil's own earlier answers.

    ``withheld`` (earlier_answers) are the earlier items' answers this item
    may not print: a task that shows one ("2 · 62" after the item keyed 62)
    is not printed when the prompt stands alone, and the prompt asks alone.
    Otherwise it is printed, and answer_leak refuses the question. Every
    printer passes it, so the page is the one the validation read.
    """
    if withheld and _task_terms(solved) & withheld and stands_alone(question, item, solved, withheld):
        return False
    return _shows_task(question, item, solved, intro=intro)


def _shows_task(question, item, solved, *, intro=None):
    task = solved["question"]
    if task.get("kind") == "figure_measure":
        return True
    if task.get("kind") == "decide":
        return False  # the printed question is the claim; the claim beside it would be its answer
    prompt = item["prompt"]
    if reveals_answer(solved) or carries_data(prompt):
        return False
    words = _words(prompt).strip()
    leaves = task_numbers(task)
    if BACK_REFERENCE.search(words):
        return False
    shared = question["intro"] if intro is None else intro
    story = visible_numbers(shared) | word_numbers(_words(shared)) | word_numbers(words)
    if leaves and leaves <= story:
        # The story states every number, in digits or in words; the calculation is the pupil's part.
        return False
    if words.endswith("?"):
        # A question about a story or a table that is printed once for all items.
        if leaves & (story | visible_numbers(_table_spans(question))):
            return False
    return True


# --------------------------------------------------------------- one exercise
_DIRECTIVE = re.compile(
    r"(?:(?:חשבו|פתרו|מצאו|השלימו|כתבו|רשמו)(?: בטור)?(?: את)?"
    r"(?: התוצאה| התרגיל| הביטוי| ערך הביטוי| הערך| הסכום| ההפרש| המכפלה| המנה)?(?: של| הבא| הבאה)?"
    r"|מהי התוצאה(?: של)?|מהו הערך של|כמה הם|כמה זה)?\s*:?\s*@\s*(?:=\s*\??)?\s*[?.!]?")


_GROUP_DIRECTIVE = re.compile(
    r"(?:חשבו|פתרו)(?: את(?: התרגילים| התרגיל| הביטויים| הביטוי| התוצאה| התוצאות| ערך הביטוי)(?: הבאים| הבא)?)?"
    r"(?: בטור| במאונך| בעל[ ־]פה)?\s*[.:]?")


def printed_calculation(question, item, solved, grade):
    """Bind a prompt that is one closed calculation to the typed task.

    When an instruction such as "חשבו:" is followed by exactly one printed
    calculation, the key must be the value of that calculation. A different
    typed value would be a wrong key, so it is refused.
    """
    typed = _scalar(solved)
    if typed is None or solved["question"].get("kind") != "evaluate":
        return None
    maths = [s for s in item["prompt"] if s["kind"] != "text"]
    if len(maths) != 1 or not _DIRECTIVE.fullmatch(" ".join(_words(item["prompt"]).split())):
        return None
    tree = _closed(maths[0], grade)
    if tree is None or tree.get("type") != "operation":
        return None
    try:
        shown = _value(tree)
    except Exception:
        return None
    if shown == typed:
        return {"rule": "printed_calculation", "value": _json_number(typed)}
    if ("table" in question or "figure" in question
            or not _GROUP_DIRECTIVE.fullmatch(" ".join(_words(question["intro"]).split()))):
        # Another group instruction (round, estimate, double) changes what is asked.
        return None
    _reject("The typed answer is not the value of the printed calculation")


def echoed_given(item, solved, *, authored=False, mixed=False):
    """Refuse a key that only repeats the one number that the prompt prints.

    A prompt that is nothing but "60", keyed by the value of 2 x 2 x 3 x 5, asks
    for the expression itself. The exact kernel cannot key a requested form.

    A typed task that is one bare number has nothing to calculate. When the
    prompt prints that same number and no other number, blank or calculation,
    and the key would spell it the same way, the pupil reads the answer in the
    question: an integer; a decimal for a task typed in decimals; a fraction
    that is printed in lowest terms and keyed as a fraction. A change of form
    is not an echo and is left to its own binders: a fraction for a printed
    decimal, a reduced fraction, a mixed number when the question asks for one
    (``mixed``). This second rule applies to an authored reply only
    (``authored``): a local author may state a count that the pupil then
    checks against the printed words.
    """
    typed = _scalar(solved)
    task = solved["question"]
    if typed is None or task.get("kind") != "evaluate":
        return
    tokens = read_tokens(item["prompt"])
    if task["expression"].get("type") == "operation":
        if len(tokens) == 1 and tokens[0].kind == "num" and tokens[0].value == typed \
                and typed not in task_numbers(task):
            _reject("The key repeats the only printed number; the requested form cannot be verified")
        return
    if not authored or task["expression"].get("type") != "number":
        return
    shown = []  # (value, written decimal, written fraction in lowest terms)
    for token in tokens:
        if token.kind == "num":
            shown.append((token.value, "." in token.raw, False))
        elif token.kind == "math" and token.value.get("kind") == "math" and token.value["expression"].get("type") == "number":
            written = token.value["expression"]
            exact = Fraction(written["numerator"], written["denominator"])
            shown.append((exact, False, exact.denominator == written["denominator"] > 1))
        elif token.kind in ("blank", "math"):
            return
    if len(shown) != 1 or shown[0][0] != typed:
        return
    notation = item["answer"].get("notation")
    decimal_key = isinstance(notation, str) and re.search(r"[0-9]\.[0-9]", notation) and "frac" not in notation
    _, decimal, lowest_terms = shown[0]
    improper = abs(typed.numerator) > typed.denominator
    if (typed.denominator == 1 or (decimal_key and decimal)
            or (lowest_terms and not decimal_key and not (mixed and improper))):
        _reject("The key repeats the only printed number; there is nothing to calculate")


def comparison_blank(item, solved, grade):
    """Bind "345 ___ 354" to its comparison and keep the printed sides for the key."""
    prompt = item["prompt"]
    maths = [s for s in prompt if s["kind"] != "text"]
    sides = None
    if len(maths) == 1 and maths[0]["kind"] == "formula" and "___" in maths[0]["notation"]:
        from compact_authoring import SIGN_BLANK
        parts = SIGN_BLANK.split(maths[0]["notation"])
        if len(parts) == 2 and not re.search(r"[=<>≤≥≠!]", maths[0]["notation"]):
            sides = [{"kind": "formula", "notation": part.strip()} for part in parts]
    if sides is None:
        tokens = read_tokens(prompt)
        colon = next((i for i, t in enumerate(tokens) if t.kind == "sym" and t.raw == ":"), None)
        if colon is not None and all(t.kind == "word" for t in tokens[:colon]):
            tokens = tokens[colon + 1:]
        if tokens and tokens[-1].kind == "sym" and tokens[-1].raw in ".?":
            tokens = tokens[:-1]
        if [t.kind for t in tokens] not in (["num", "blank", "num"], ["math", "blank", "math"],
                                            ["num", "blank", "math"], ["math", "blank", "num"]):
            return None
        sides = []
        for token in (tokens[0], tokens[2]):
            if token.kind == "math":
                sides.append(token.value)
            else:
                sides.append({"kind": "formula", "notation": token.raw})
    trees = [_closed(side, grade) for side in sides]
    if any(tree is None for tree in trees):
        return None
    task = solved["question"]
    if task.get("kind") != "compare":
        # A sign cannot be keyed by a number.
        _reject("A blank between two quantities asks for a comparison sign")
    try:
        if [_value(tree) for tree in trees] != [_value(task["left"]), _value(task["right"])]:
            _reject("The typed comparison is not the printed comparison")
    except GeneralSourceError:
        raise
    except Exception:
        return None
    return {"rule": "printed_sign", "left": trees[0], "right": trees[1], "sides": sides}


# ------------------------------------------------------- quotient and remainder
_REMAINDER = re.compile(r"(?<![א-ת])[ובלה]{0,2}שארית(?![א-ת])")
_LEFTOVER = re.compile(r"(?<![א-ת])ו?(?:נשאר(?:ו|ות|ים|ת)?|יישאר(?:ו)?|תישאר(?:נה)?|נותר(?:ו|ות|ים|ה)?|ייוותר(?:ו)?)(?![א-ת])")


def _division(tree):
    if (isinstance(tree, dict) and tree.get("type") == "operation" and tree.get("op") == "divide"
            and all(arg.get("type") == "number" and arg["denominator"] == 1 for arg in tree["args"])):
        dividend, divisor = (arg["numerator"] for arg in tree["args"])
        if dividend >= 0 and divisor > 0:
            return dividend, divisor
    return None


def remainder_answer(question, item, solved, grade):
    """Key a division with remainder as "9 (שארית 2)", never as the fraction 47/5."""
    typed = _scalar(solved)
    prompt = item["prompt"]
    words = _words(prompt) + " " + _words(question["intro"])
    typed_division = _division(solved["question"].get("expression"))
    # Until a quotient is taught as a fraction (grade five), a whole-number
    # division that does not come out even has a remainder, said or not.
    uneven = (typed_division is not None and typed_division[0] >= typed_division[1]
              and typed is not None and typed.denominator != 1)
    if typed is None or not (_REMAINDER.search(words) or (uneven and (grade <= 4 or _LEFTOVER.search(words)))):
        return None
    blanks = blank_count(prompt)
    if blanks > 2:
        return None
    from compact_authoring import SIGN_BLANK, expression
    if any(span["kind"] == "formula" and SIGN_BLANK.search(span["notation"]) for span in prompt):
        return None  # a sign blank is another kind of answer
    if blanks == 2:
        # The second blank must be the remainder's own: "(שארית ___)", "ונשארות ___".
        tokens = read_tokens(prompt)
        last = max(i for i, t in enumerate(tokens) if t.kind == "blank")
        near = tokens[max(0, last - 3):last + 3]
        if not any(t.kind == "word" and (_REMAINDER.search(t.value) or _LEFTOVER.search(t.value)) for t in near):
            return None
    shown = []
    for span in prompt:
        if span["kind"] == "math":
            shown.append(_division(span["expression"]))
        elif span["kind"] == "formula":
            left = span["notation"].split("=")[0]
            try:
                shown.append(_division(expression(left, grade)))
            except GeneralSourceError:
                shown.append(None)
    shown = [pair for pair in shown if pair]
    if len(shown) > 1:
        return None
    if shown:
        dividend, divisor = shown[0]
    elif typed_division and (not carries_data(prompt)
                             or set(map(Fraction, typed_division)) <= visible_numbers(prompt) | visible_numbers(question["intro"])):
        dividend, divisor = typed_division
    else:
        return None
    # A prompt without numbers shows the division only through its printed task.
    givens = "prompt" if shown or carries_data(prompt) else "task"
    quotient, remainder = divmod(dividend, divisor)
    if typed not in (Fraction(dividend, divisor), quotient, remainder):
        _reject("The typed answer is not the printed division")
    proof = {"rule": "quotient_remainder", "dividend": dividend, "divisor": divisor, "givens": givens,
             "quotient": quotient, "remainder": remainder, "verifiedTypedValue": _json_number(typed)}
    if blanks < 2 and typed == remainder != quotient and typed != Fraction(dividend, divisor):
        # Only the remainder is asked for; the ordinary key already states it.
        return None
    label = next((t.raw for t in read_tokens(prompt) + read_tokens(question["intro"])
                  if t.kind == "word" and t.value == "שארית"), "שְׁאֵרִית" if grade <= 2 else "שארית")
    # The unit is the author's plain text; the adapter escapes every prose part.
    unit = item["answer"].get("unit") or ""
    return PrintedAnswer(((str(quotient),), (" " + unit if unit else "") + " (" + label + " ",
                          (str(remainder),), ")"), proof)


# -------------------------------------------------------------------- sequences
def _progression(known, size):
    """Fill a sequence from at least three printed terms of one fixed step or ratio."""
    if len(known) < 3:
        return None
    (i0, v0), (i1, v1) = known[0], known[1]
    step = (v1 - v0) / (i1 - i0)
    if all(v == v0 + (i - i0) * step for i, v in known):
        return [v0 + (i - i0) * step for i in range(size)]
    if all(v > 0 for _, v in known) and all(b[0] - a[0] == 1 for a, b in zip(known, known[1:])):
        ratio = v1 / v0
        if ratio != 1 and all(b[1] == a[1] * ratio for a, b in zip(known, known[1:])):
            first = v0 / ratio ** i0
            return [first * ratio ** i for i in range(size)]
    return None


def sequence_answer(item, solved, grade):
    """Key every blank of a printed sequence whose printed terms fix its rule."""
    typed = _scalar(solved)
    if typed is None or item["answer"].get("unit"):
        return None
    tokens = read_tokens(item["prompt"])
    colon = next((i for i, t in enumerate(tokens) if t.kind == "sym" and t.raw == ":"), None)
    if colon is not None and all(t.kind == "word" for t in tokens[:colon]):
        tokens = tokens[colon + 1:]
    while tokens and tokens[-1].kind == "sym" and tokens[-1].raw == ".":
        tokens = tokens[:-1]
    terms = tokens[::2]
    if (len(terms) < 4 or len(tokens) % 2 == 0
            or any(t.kind != "sym" or t.raw != "," for t in tokens[1::2])
            or any(t.kind not in ("num", "blank") for t in terms)):
        return None
    blanks = [i for i, t in enumerate(terms) if t.kind == "blank"]
    known = [(i, t.value) for i, t in enumerate(terms) if t.kind == "num"]
    if not blanks:
        return None
    filled = _progression(known, len(terms))
    if filled is None:
        return None
    values = [filled[i] for i in blanks]
    if any(v.denominator != 1 for v in values) and all(v.denominator == 1 for _, v in known):
        return None
    if typed not in values:
        if len(blanks) == 1:
            return None  # one blank, one typed number: the typed rule may be another one
        _reject("The typed answer is not a missing term of the printed sequence")
    parts = []
    for index, value in enumerate(values):
        parts += [(_plain_number(value),)] + ([", "] if index + 1 < len(values) else [])
    return PrintedAnswer(tuple(parts), {"rule": "sequence", "terms": [_json_number(v) for v in filled],
                                        "verifiedTypedValue": _json_number(typed)})


def _plain_number(value):
    from printed_elementary import _decimal
    return _decimal(value)


# ---------------------------------------------------------- two units, one size
_UNIT_PAIRS = (
    (("שעות", "שעה"), ("דקות", "דקה"), 60),
    (("דקות", "דקה"), ("שניות", "שנייה", "שניה"), 60),
    (("ימים", "יום", "יממות", "יממה"), ("שעות", "שעה"), 24),
    (("שבועות", "שבוע"), ("ימים", "יום"), 7),
    (("שנים", "שנה"), ("חודשים", "חודש"), 12),
    (("מטרים", "מטר"), ("סנטימטרים", "סנטימטר", "ס״מ", 'ס"מ'), 100),
    (("סנטימטרים", "סנטימטר", "ס״מ", 'ס"מ'), ("מילימטרים", "מילימטר", "מ״מ", 'מ"מ'), 10),
    (("קילומטרים", "קילומטר", "ק״מ", 'ק"מ'), ("מטרים", "מטר"), 1000),
    (("קילוגרמים", "קילוגרם", "ק״ג", 'ק"ג'), ("גרמים", "גרם"), 1000),
    (("טונות", "טון"), ("קילוגרמים", "קילוגרם", "ק״ג", 'ק"ג'), 1000),
    (("ליטרים", "ליטר"), ("מיליליטרים", "מיליליטר", "מ״ל", 'מ"ל'), 1000),
    (("שקלים", "שקל", "ש״ח", 'ש"ח'), ("אגורות", "אגורה"), 100),
)


def _stated_sizes(tokens, pair, skip=()):
    """Every printed size of this quantity, expressed in the smaller unit."""
    sizes = set()
    for index, token in enumerate(tokens[:-1]):
        unit = tokens[index + 1]
        if token.kind != "num" or unit.kind != "word" or index + 1 in skip:
            continue
        if unit.value in pair[1]:
            sizes.add(token.value)
        elif unit.value in pair[0]:
            sizes.add(token.value * pair[2])
    return sizes


def compound_answer(question, item, solved, grade):
    """Key "___ שעות ו־___ דקות" when a printed size or the typed unit fixes both parts."""
    typed = _scalar(solved)
    if typed is None or typed < 0:
        return None
    tokens = read_tokens(item["prompt"])
    places = [i for i, t in enumerate(tokens) if t.kind == "blank"]
    if len(places) != 2:
        return None
    first, second = places
    if first + 1 >= len(tokens) or second + 1 >= len(tokens) or tokens[first + 1].kind != "word" \
            or tokens[second + 1].kind != "word":
        return None
    joiner = tokens[first + 2:second]
    if "".join(t.raw for t in joiner if t.kind != "word" or t.value != "ו") not in ("־", "-", ",", ""):
        return None
    big, small = tokens[first + 1], tokens[second + 1]
    pair = next((p for p in _UNIT_PAIRS if big.value in p[0] and small.value in p[1]), None)
    if pair is None:
        return None
    factor = pair[2]
    # A printed size of the same quantity fixes both blanks: in the item, or
    # once in the group's story. Otherwise the typed unit must say what the
    # typed number measures; a bare number is never guessed to be minutes.
    shown = _stated_sizes(tokens, pair, skip=(first + 1, second + 1)) or _stated_sizes(read_tokens(question["intro"]), pair)
    unit = _unpointed(item["answer"].get("unit") or "")
    if len(shown) == 1:
        total = next(iter(shown))
    elif shown:
        return None
    elif unit in pair[1]:
        total = typed
    elif unit in pair[0]:
        total = typed * factor
    else:
        return None
    if total.denominator != 1:
        return None
    whole, rest = divmod(total.numerator, factor)
    if typed not in (total, Fraction(total, factor), whole, rest):
        _reject("The typed answer is not the printed quantity")
    glue = "".join(t.raw for t in joiner)
    glue = " " + glue if glue and not glue.startswith(",") else glue + " " if glue else " "
    parts = ((str(whole),), " " + big.raw + glue, (str(rest),), " " + small.raw)
    return PrintedAnswer(parts, {"rule": "compound_units", "total": total.numerator, "factor": factor,
                                 "verifiedTypedValue": _json_number(typed)})


# --------------------------------------------------------------- the one guard
def _row_blanks(question, prompt):
    """Blanks of the table row that the prompt refers to."""
    table = question.get("table")
    if (not table or len(prompt) != 2 or prompt[0].get("text", "").strip() not in ("שורה", "שׁוּרָה")
            or prompt[1].get("kind") != "math"):
        return 0
    index = prompt[1]["expression"]
    if index.get("type") != "number" or index["denominator"] != 1 or not 1 <= index["numerator"] <= len(table["rows"]):
        return 0
    return sum(blank_count(cell) for cell in table["rows"][index["numerator"] - 1])


def _answers(solved):
    """How many separate values the typed result supplies."""
    result = solved.get("result", {})
    if result.get("type") == "list":
        return len(result.get("values", []))
    if result.get("type") == "system":
        return len(result.get("variables", []))
    return 1


def bind_parts(question, item, solved, grade):
    """Return the complete printed answer of a multi-part prompt, or refuse it.

    None means that the ordinary single key stands. A prompt with two or more
    blanks never keeps a single key: either a binder answers every blank from
    the printed givens, or the question fails closed.
    """
    kind = item["answer"].get("kind")
    binding = None
    if kind == "computed" and grade <= 6:
        binding = (place_answer({"gradeNumber": grade}, question, item, solved)
                   or remainder_answer(question, item, solved, grade)
                   or sequence_answer(item, solved, grade)
                   or compound_answer(question, item, solved, grade))
    if binding is None and kind in ("computed", "figure"):
        blanks = max(blank_count(item["prompt"]), _row_blanks(question, item["prompt"]))
        if blanks >= 2 and _answers(solved) != blanks:
            from printed_tasks import match_printed_task
            # "המספר החסר הוא ___: [[___ + 4 = 17]]" names one unknown twice,
            # and its binder has already solved the printed equation for it.
            if kind != "computed" or not match_printed_task(item, solved, grade):
                _reject("The prompt has several blanks and the typed task answers only one of them")
    return binding


def check_item(question, item, solved, grade, *, authored=False):
    """Run every printed-answer binder at source validation, where a refusal is recoverable.

    Returns the bound decision of a yes/no item, and None for every other item.
    ``authored`` marks a reply written by the author model.
    """
    bind_parts(question, item, solved, grade)
    if item["answer"].get("kind") == "computed":
        comparison_blank(item, solved, grade)
        printed_calculation(question, item, solved, grade)
        from answer_kinds import bind_decision, refuse_dummy_key
        # A drawing or a construction keyed by a number is told its answer kind first.
        refuse_dummy_key(question, item, solved, grade)
        echoed_given(item, solved, authored=authored, mixed="mixed" in answer_form(question, item, solved))
        return bind_decision(question, item, solved, grade)
    return None


# ----------------------------------------------------------- the written form
_MIXED_CUE = re.compile(r"(?<![א-ת])[ובלכה]{0,2}(?:מספר(?:ים)? מעורב(?:ים)?|שבר(?:ים)? מעורב(?:ים)?)(?![א-ת])")
_MONEY = re.compile(r"(?<![א-ת])ה?(?:שקל(?:ים)?|ש[״\"]ח|אגורות)(?![א-ת])|₪")


def _has_mixed_operand(tree):
    """An integer plus a proper fraction is how the source writes a mixed number."""
    if not isinstance(tree, dict) or tree.get("type") != "operation":
        return False
    args = tree["args"]
    if tree["op"] == "add" and any(
            a.get("type") == "number" and a["denominator"] == 1 and a["numerator"] > 0
            and b.get("type") == "number" and b["denominator"] > 1 and 0 < b["numerator"] < b["denominator"]
            for a, b in zip(args, args[1:])):
        return True
    return any(_has_mixed_operand(arg) for arg in args)


def answer_form(question, item, solved):
    """The spelling in which the question itself writes its numbers.

    Returns a set of "mixed" (a mixed number, not an improper fraction) and
    "money" (two decimals). The exact value of the key is never changed.
    """
    forms = set()
    prompt_words = _words(item["prompt"])
    words = _words(question["intro"]) + " " + prompt_words
    to_mixed = re.compile(r"(?<![א-ת])ו?[לכ](?:מספר(?:ים)?|שבר(?:ים)?) מעורב")
    to_improper = re.compile(r"(?<![א-ת])ו?[לכ]שבר(?:ים)? מדומ")
    # The requested target form decides; the item's own wording outranks the group's.
    target = None
    for text in (prompt_words, words):
        wanted = {name for name, cue in (("mixed", to_mixed), ("improper", to_improper)) if cue.search(text)}
        if len(wanted) == 1:
            target = wanted.pop()
            break
    task = solved["question"]
    trees = [task.get(key) for key in ("expression", "left", "right")]
    if target == "mixed" or (target is None and (
            _MIXED_CUE.search(words) or any(_has_mixed_operand(tree) for tree in trees))):
        forms.add("mixed")
    if _MONEY.search(words) or _MONEY.search(_unpointed(item["answer"].get("unit") or "")):
        forms.add("money")
    # "כתבו את 35% כמספר עשרוני" is keyed 0.35, not 7/20. The item's own target
    # outranks the group's; an item that names another target keeps its form.
    for text in (prompt_words, words):
        decimal, other = bool(_TO_DECIMAL.search(text)), bool(_TO_OTHER_FORM.search(text))
        if decimal or other:
            if decimal and not other:
                forms.add("decimal")
            break
    return forms


# The decimal as the requested form: "כמספר עשרוני", "למספר עשרוני", "מהו הערך העשרוני".
# "שווה למספר העשרוני 0.45" names a given (with its article) and is not a target.
_TO_DECIMAL = re.compile(
    r"(?<![א-ת])(?:ו?[כלב](?:מספר|שבר)\s+עשרוני|ה?ערך\s+ה?עשרוני|ב?(?:צורה|כתיב|הצגה)\s+עשרוני(?:ת)?"
    r"|ב?(?:צורה|כתיב|הצגה)\s+ה?עשרוני(?:ת)?|ה?צורה\s+העשרונית)(?![א-ת])")
_TO_OTHER_FORM = re.compile(
    r"(?<![א-ת])(?:ו?[כלב]שבר(?:ים)?\s+(?:פשוט|מצומצם|רגיל|מדומה)|ב?צורת\s+שבר|ו?[כל]אחוז(?:ים)?|באחוזים"
    r"|איזה\s+אחוז|כמה\s+אחוז(?:ים)?|ו?[כלב]מספר\s+מעורב)(?![א-ת])")
