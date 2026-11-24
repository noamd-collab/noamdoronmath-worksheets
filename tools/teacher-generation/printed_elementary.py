"""Bind bounded elementary exercises to the facts that the pupil sees.

The provider's symbolic evaluation remains independently verified. Only a whole
supported prompt can provide a stronger, pupil-facing answer binding here.
"""

from dataclasses import dataclass
from fractions import Fraction
import re
import unicodedata

from general_source import GeneralSourceError
from math_tasks import number, operation, validate_and_solve_task
from numeric_literals import NUMBER_TOKEN, display_literal, literal_value

PLACE = {"אחדות": 1, "עשרות": 10, "מאות": 100}
THREE = r"([1-9][0-9]{2})"
SPLIT = r"_+ מאות \+ _+ עשרות \+ _+ אחדות"
# Every decimal position that a pupil names in grades one to six. A value is
# the worth of one unit in that position; longer names are matched first.
PLACES = {
    "אחדות": Fraction(1), "יחידות": Fraction(1), "שלמים": Fraction(1),
    "עשרות": Fraction(10), "מאות": Fraction(100), "אלפים": Fraction(1000),
    "עשרות אלפים": Fraction(10_000), "מאות אלפים": Fraction(100_000),
    "מיליונים": Fraction(1_000_000),
    "עשיריות": Fraction(1, 10), "מאיות": Fraction(1, 100), "אלפיות": Fraction(1, 1000),
}
NATURAL_NUMBER = r"([1-9][0-9]{0,6})"
WHOLE_PLACE = r"(עשרות אלפים|מאות אלפים|מיליונים|אלפים|מאות|עשרות|אחדות|יחידות)"


@dataclass(frozen=True)
class PrintedAnswer:
    # Each part is trusted Hebrew prose (str), or one formula stored as a tuple.
    parts: tuple
    proof: dict


WRITE_EXPRESSION = re.compile(r"(?:^|[.!?:;]\s*|\s+ו)(?:כתבו|רשמו|חברו|בנו)\s+(?:את\s+ה)?(?:תרגיל|ביטוי)(?![א-ת])")
WRITE_INSTRUCTION = re.compile(
    r"(?:כתבו|רשמו|חברו|בנו) (?:תרגיל|ביטוי(?: חשבוני)?)"
    r"(?: (?:המשלב|עם) סוגריים)?(?: (?:עבור כל מצב מתואר|המתאים לכל תיאור))?"
    r"(?:,?\s*וחשבו את (?:התוצאה|ערכו))?[.:]?"
)
NEUTRAL_INTRO = re.compile(r"(?:תרגול מילולי|קראו את ההוראות|פתרו את הסעיפים הבאים)[.:]?")
NATURAL = r"(0|[1-9][0-9]{0,5})"
FROM_WORDS = re.compile(
    r"(הסכום של|ההפרש בין|המכפלה של) " + NATURAL + r" ([ול])[־-]?" + NATURAL +
    r",\s*(מוכפל(?:ת)? ב[־-]?|מחולק(?:ת)? ב[־-]?|פחות |ועוד )" + NATURAL + r"[.]?"
)


QUOTIENT_FROM_ROLES = re.compile(
    r"(?:כתבו|רשמו) תרגיל חילוק שהמחולק (?:בו )?הוא " + NATURAL +
    r" והמחלק (?:בו )?הוא " + NATURAL + r"[.]מה(?:י)? המנה[?]"
)
DIVIDEND_FROM_ROLES = re.compile(
    r"(?:כתבו|רשמו) תרגיל חילוק שהמחלק (?:בו )?הוא " + NATURAL +
    r" ו(?:התוצאה|המנה) היא " + NATURAL + r"[.]?"
)
DIVISION_INSTRUCTION = re.compile(
    r"(?:(?:בנו|כתבו|רשמו) (?:דוגמה (?:משלכם )?ל)?תרגיל חילוק(?: ובדקו אותו)?|בנו דוגמה חדשה)[.:]?"
)
INVERSE_INSTRUCTION = re.compile(r"פתרו את (?:הבעיות(?: ההפוכות)? הבאות|התרגילים הבאים)[.:]?")
INVERSE_DIVIDEND = re.compile(
    r"(?:מספר חולק|חילקו מספר) ב[־-]?\s*(?P<divisor>[0-9]+) "
    r"ו(?:קיבל|קיבלו|התקבלה) ה?מנה(?: של)? (?P<quotient>[0-9]+)"
    r"(?:,?\s*(?:(?:והשארית (?:היא )?|עם שארית )(?P<remainder>[0-9]+)|(?P<exact>ללא שארית|בלי שארית)))?"
    r"\.מהו (?:המספר המקורי|המחולק)\?"
)


def validate_inverse_dividend(question, item, solved, scope):
    """A Euclidean quotient q constrains the dividend to [dq, dq+d-1]."""
    if question.get("table") or question.get("figure"):
        return
    match = INVERSE_DIVIDEND.fullmatch(_plain(item["prompt"]) or "")
    if not match:
        return
    concepts = (concept["text"] for concept in scope["selectedConcepts"])
    if not any("שארית" in text and not re.search(r"(?:ללא|בלי) שארית", text) for text in concepts):
        return
    # A shared introduction can supply the remainder or a bound on the answer.
    intro = _plain(question["intro"])
    if intro is None or (intro and not (INVERSE_INSTRUCTION.fullmatch(intro) or NEUTRAL_INTRO.fullmatch(intro))):
        return
    divisor, quotient = int(match["divisor"]), int(match["quotient"])
    if not divisor or (divisor > 1 and match["remainder"] is None and not match["exact"]):
        raise GeneralSourceError("PRINTED_TASK_MISMATCH",
                                 "The printed divisor and quotient must determine a unique dividend")
    remainder = int(match["remainder"] or 0)
    if remainder >= divisor:
        _reject()
    _verify_integer(solved, divisor * quotient + remainder)


def printed_intent(question, item, solved, grade, *, location):
    """Bind a printed comparison or a request to write and evaluate an expression."""
    if grade > 6:
        return None
    prompt = item["prompt"]
    task = solved["question"]

    def reject(code):
        raise GeneralSourceError(code, "Unverified pupil exercise or mismatched expression at " + location)

    def words(parts):
        return "".join(c for s in parts if s["kind"] == "text"
                       for c in s["text"] if not unicodedata.combining(c))

    asks_for_expression = any(WRITE_EXPRESSION.search(words(p)) for p in (question["intro"], prompt))
    if task["kind"] == "compare" and not asks_for_expression:
        pattern = "".join(s["text"] if s["kind"] == "text" else "@" for s in prompt).strip()
        if re.fullmatch(r"השוו\s*:?\s*@\s+לבין\s+@\s*[.?]?", pattern):
            from compact_authoring import expression
            visible = []
            for s in prompt:
                if s["kind"] == "math":
                    visible.append(s["expression"])
                elif s["kind"] == "formula":
                    try:
                        visible.append(expression(s["notation"], grade))
                    except GeneralSourceError:
                        reject("PRINTED_EXPRESSION_SCOPE")
                elif s["kind"] != "text":
                    reject("PRINTED_EXPRESSION_SCOPE")
            if visible != [task["left"], task["right"]] or item["answer"].get("unit"):
                reject("PRINTED_EXPRESSION_MISMATCH")
            return {"rule": "printed_comparison", "left": visible[0], "right": visible[1]}

    if not asks_for_expression:
        return None
    if "table" in question or "figure" in question:
        reject("PRINTED_EXPRESSION_SCOPE")
    intro = _plain(question["intro"])
    description = _plain(prompt)
    division = QUOTIENT_FROM_ROLES.fullmatch(description or "")
    inverse = DIVIDEND_FROM_ROLES.fullmatch(description or "")
    if (division or inverse) and (DIVISION_INSTRUCTION.fullmatch(intro or "") or NEUTRAL_INTRO.fullmatch(intro or "")):
        if grade < 2 or task["kind"] != "evaluate" or item["answer"].get("unit"):
            reject("PRINTED_EXPRESSION_SCOPE")
        if inverse:
            divisor, quotient = map(int, inverse.groups())
            if not divisor:
                reject("PRINTED_EXPRESSION_SCOPE")
            product = operation("multiply", number(divisor), number(quotient))
            if task["expression"] != product:
                reject("PRINTED_EXPRESSION_MISMATCH")
            # The requested answer is the whole division equation.
            return {"rule": "write_division", "expression": operation("divide", number(divisor * quotient), number(divisor)),
                    "value": number(quotient)}
        dividend, divisor = map(int, division.groups())
        tree = operation("divide", number(dividend), number(divisor))
        if tree != task["expression"]:
            reject("PRINTED_EXPRESSION_MISMATCH")
        return {"rule": "write_expression", "expression": tree}
    if description and not WRITE_INSTRUCTION.fullmatch(intro or ""):
        # An individual subitem can carry its own instruction and full description.
        instruction, colon, body = description.partition(":")
        if (not colon or not WRITE_INSTRUCTION.fullmatch(instruction)
                or not NEUTRAL_INTRO.fullmatch(intro or "")):
            reject("PRINTED_EXPRESSION_SCOPE")
        description = body
    parsed = FROM_WORDS.fullmatch(description or "")
    if not parsed or task["kind"] != "evaluate" or item["answer"].get("unit"):
        reject("PRINTED_EXPRESSION_SCOPE")
    phrase, first, join, second, then, third = parsed.groups()
    initial, connector = {"הסכום של": ("add", "ו"), "ההפרש בין": ("subtract", "ל"),
                          "המכפלה של": ("multiply", "ו")}[phrase]
    if join != connector:
        reject("PRINTED_EXPRESSION_SCOPE")
    final = next(op for prefix, op in (("מוכפל", "multiply"), ("מחולק", "divide"),
                                       ("פחות", "subtract"), ("ועוד", "add")) if then.startswith(prefix))
    if grade == 1 and {initial, final}.intersection({"multiply", "divide"}):
        reject("PRINTED_EXPRESSION_SCOPE")
    pair = operation(initial, number(int(first)), number(int(second)))
    tree = operation(final, pair, number(int(third)))
    if tree != task["expression"]:
        reject("PRINTED_EXPRESSION_MISMATCH")
    return {"rule": "write_expression", "expression": tree}


_PRINTED_FORMULA = re.compile(r"[0-9 _=+,.]+")


def _plain(spans):
    pieces = []
    for span in spans:
        if span["kind"] == "text":
            pieces.append(NUMBER_TOKEN.sub(lambda m: m[0].replace(",", ""), span["text"]))
        elif span["kind"] == "math":
            v = span["expression"]
            if v["type"] != "number" or v["denominator"] != 1:
                return None
            pieces.append(str(v["numerator"]))
        elif span["kind"] == "formula" and _PRINTED_FORMULA.fullmatch(span["notation"]):
            # Digits, blanks, "+" and "=" read exactly as they are printed.
            # A written thousands separator is typography, not punctuation.
            notation = " ".join(span["notation"].split())
            pieces.append(NUMBER_TOKEN.sub(lambda m: m[0].replace(",", ""), notation))
        else:
            return None
    s = "".join(pieces)
    s = "".join(
        c for c in unicodedata.normalize("NFC", s) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s*([,?.:()])\s*", r"\1", " ".join(s.split())).strip()


def _reject():
    raise GeneralSourceError(
        "PRINTED_TASK_MISMATCH",
        "The printed question and its typed answer do not agree",
    )


def _verify_integer(solved, expected):
    r = solved["result"]
    if (
        solved["question"]["kind"] != "evaluate"
        or r.get("type") != "expression"
        or r.get("value") != {"type": "number", "numerator": expected, "denominator": 1}
    ):
        _reject()


@dataclass(frozen=True)
class Token:
    kind: str      # "num", "blank", "word", "sym" or "math"
    value: object  # Fraction, None, unpointed word, symbol, or the opaque span
    raw: str       # the spelling that the pupil sees


# Hebrew letters with their points. The maqaf (U+05BE) joins words and is a sign of its own.
_LETTERS = r"[א-ת\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]"
_WORD = _LETTERS + r"+(?:[״׳\"']" + _LETTERS + r"+)*[׳']?"
_TOKEN = re.compile(r"(?P<blank>_+|[☐□▢])|(?P<num>" + NUMBER_TOKEN.pattern + r")|(?P<word>" + _WORD + r")|(?P<sym>\S)")


def _unpointed(word):
    return "".join(c for c in unicodedata.normalize("NFC", word) if unicodedata.category(c) != "Mn")


def read_tokens(spans):
    """Read a prompt as the numbers, blanks, words and signs that are printed.

    A calculation or a figure label stays one opaque "math" token. Nothing is
    inferred here; binders decide whether the whole sequence is a known form.
    """
    tokens = []

    def scan(text):
        for match in _TOKEN.finditer(text):
            kind = match.lastgroup
            raw = match[0]
            if kind == "num":
                tokens.append(Token("num", literal_value(raw), raw))
            elif kind == "word":
                tokens.append(Token("word", _unpointed(raw), raw))
            else:
                tokens.append(Token(kind, None if kind == "blank" else raw, raw))

    for span in spans:
        kind = span["kind"]
        if kind == "text":
            scan(span["text"])
        elif kind == "math" and span["expression"]["type"] == "number":
            value = span["expression"]
            exact = Fraction(value["numerator"], value["denominator"])
            tokens.append(Token("num", exact, str(exact)) if exact.denominator == 1 and exact >= 0
                          else Token("math", span, ""))
        elif kind == "formula" and (literal := display_literal(span["notation"])) is not None \
                and not literal.endswith("%") and not literal.startswith(("-", "+")):
            tokens.append(Token("num", literal_value(literal), literal))
        elif kind == "formula" and _PRINTED_FORMULA.fullmatch(span["notation"]) and re.search(r"[=_]", span["notation"]):
            # An equality or a blank is read sign by sign; a closed calculation
            # such as "3 + 4" stays one operand.
            scan(span["notation"])
        else:
            tokens.append(Token("math", span, ""))
    return tokens


def blank_count(spans):
    """How many separate answers the printed prompt asks the pupil to write."""
    count = 0
    for span in spans:
        if span["kind"] == "text":
            count += len(re.findall(r"_+|[☐□▢]", span["text"]))
        elif span["kind"] == "formula":
            count += len(re.findall(r"_+", span["notation"]))
    return count


def _facts(n):
    h, rem = divmod(n, 100)
    t, u = divmod(rem, 10)
    return h, t, u


def _triple(n):
    h, t, u = _facts(n)
    return ((str(h),), " מאות, ", (str(t),), " עשרות, ", (str(u),), " אחדות")


def _digits(n, digit):
    choices = [10 ** k * digit for k in range(len(str(n))) if n // 10 ** k % 10 == digit]
    if not choices or len(set(choices)) != 1:
        _reject()
    return choices[0]


def _decimal(value):
    """Print an exact terminating decimal; binders only pass such values."""
    value = Fraction(value)
    if value.denominator == 1:
        return str(value.numerator)
    digits = 0
    while (value * 10 ** digits).denominator != 1:
        digits += 1
        if digits > 6:
            _reject()
    whole, part = divmod(abs(value.numerator) * 10 ** digits // value.denominator, 10 ** digits)
    return ("-" if value < 0 else "") + f"{whole}.{part:0{digits}d}"


def _split_places(total, places):
    """Give every named position its digit; the leading position takes the rest.

    Returns None unless the named positions rebuild the number exactly, so
    34 tens and 5 units are found for 345 but hundreds and units alone are not.
    """
    if total < 0 or not places or len(set(places)) != len(places):
        return None
    order = sorted(places, reverse=True)
    values = {order[0]: total // order[0]}
    rest = total - values[order[0]] * order[0]
    for place in order[1:]:
        values[place] = rest // place % 10
    if sum(value * place for place, value in values.items()) != total:
        return None
    return [int(values[place]) for place in places]


def _place_name(tokens, index):
    """Match the longest position name that starts at this word."""
    for size in (2, 1):
        words = tokens[index:index + size]
        if len(words) == size and all(t.kind == "word" for t in words):
            name = " ".join(t.value for t in words)
            if name in PLACES:
                return PLACES[name], " ".join(t.raw for t in words), index + size
    return None


def _place_terms(tokens, separators):
    """Read "___ מאות", "4 עשרות", a bare blank or a bare number, joined by one separator kind."""
    terms, index = [], 0
    while index < len(tokens):
        head = tokens[index]
        if head.kind not in ("blank", "num"):
            return None
        named = _place_name(tokens, index + 1)
        place, label, index = named if named else (None, "", index + 1)
        terms.append((head, place, label))
        if index == len(tokens):
            break
        # "ו־___ אחדות" closes a Hebrew list; "+" joins the parts of a sum.
        step = next((size for size in (2, 1)
                     if tuple(t.value if t.kind == "word" else t.raw for t in tokens[index:index + size]) in separators), 0)
        if not step:
            return None
        index += step
        if index == len(tokens):
            return None
    return terms


_SPLIT_DIRECTIVE = frozenset("השלימו מלאו פרקו כתבו את המספר המספרים החסר החסרים".split())


def _json_number(value):
    """A number for a proof record: an integer, a terminating decimal, or n/d."""
    value = Fraction(value)
    if value.denominator == 1:
        return int(value)
    rest = value.denominator
    for factor in (2, 5):
        while rest % factor == 0:
            rest //= factor
    return _decimal(value) if rest == 1 and value.denominator <= 10 ** 6 else f"{value.numerator}/{value.denominator}"


def _place_split(tokens):
    """Recognize a number that is split into named positions, in either order."""
    tokens = list(tokens)
    if tokens and tokens[-1].kind == "sym" and tokens[-1].raw == ".":
        tokens.pop()
    colon = next((i for i, t in enumerate(tokens) if t.kind == "sym" and t.raw == ":"), None)
    if colon is not None and all(t.kind == "word" and t.value in _SPLIT_DIRECTIVE for t in tokens[:colon]):
        tokens = tokens[colon + 1:]
    if any(t.kind == "math" for t in tokens):
        return None
    if (len(tokens) > 3 and tokens[0].kind == "word" and tokens[0].value == "במספר"
            and tokens[1].kind == "num" and tokens[2].kind == "word" and tokens[2].value == "יש"):
        terms = _place_terms(tokens[3:], {(",",), ("ו", "־"), ("ו", "-"), ("ו",), (",", "ו"), ("+",)})
        if not terms or any(place is None for _, place, _ in terms):
            return None
        return tokens[1].value, terms
    equals = [i for i, t in enumerate(tokens) if t.kind == "sym" and t.raw == "="]
    if len(equals) != 1:
        return None
    left, right = tokens[:equals[0]], tokens[equals[0] + 1:]
    for whole, parts in ((left, right), (right, left)):
        if len(whole) == 1 and whole[0].kind == "num":
            terms = _place_terms(parts, {("+",)})
            if terms and len(terms) >= 2:
                return whole[0].value, terms
    return None


def _split_answer(total, terms):
    """Answer each printed blank of a recognized split, or reject an impossible one."""
    blanks = [(place, label) for head, place, label in terms if head.kind == "blank"]
    if not blanks:
        return None
    if all(place is None for _, place, _ in terms):
        # "345 = ___ + ___ + ___": one part for each digit, written as a sum.
        if any(head.kind != "blank" for head, _, _ in terms) or total.denominator != 1 or len(terms) < 2:
            return None
        digits = str(total.numerator)
        if len(digits) != len(terms) or total <= 0:
            return None
        values = [int(d) * 10 ** (len(digits) - 1 - i) for i, d in enumerate(digits)]
        return values, ((" + ".join(map(str, values)),),), "expanded_form"
    if any(place is None for place, _ in blanks):
        return None
    given = sum((head.value * (place or 1) for head, place, _ in terms if head.kind == "num"), Fraction(0))
    values = _split_places(total - given, [place for place, _ in blanks])
    if values is None:
        _reject()
    parts = []
    for index, (value, (_, label)) in enumerate(zip(values, blanks)):
        parts += [(str(value),), " " + label + (", " if index + 1 < len(blanks) else "")]
    return values, tuple(parts), "place_digits" if len(blanks) == len(terms) else "missing_digits"


def _table_row(question, index, n):
    table = question.get("table")
    if not table or [_plain(c) for c in table["head"]] != [
        "מספר",
        "מאות",
        "עשרות",
        "אחדות",
    ]:
        _reject()
    rows = table["rows"]
    if index >= len(rows):
        _reject()
    actual = [_plain(c) for c in rows[index]]
    if (
        len(actual) != 4
        or actual[0] != str(n)
        or not all(re.fullmatch(r"_+", c or "") for c in actual[1:])
    ):
        _reject()


def _place_table(question, prompt):
    """A referenced table row whose columns are a number and its named positions."""
    table = question.get("table")
    if not table or len(prompt) != 2 or prompt[0].get("text", "").strip() not in ("שורה", "שׁוּרָה"):
        return None
    index = prompt[1].get("expression", {})
    if index.get("type") != "number" or index["denominator"] != 1 or not 1 <= index["numerator"] <= len(table["rows"]):
        return None
    head = [read_tokens(cell) for cell in table["head"]]
    if (len(head) < 3 or len(head[0]) != 1 or head[0][0].kind != "word"
            or head[0][0].value not in ("מספר", "המספר")):
        return None
    names = [_place_name(cell, 0) for cell in head[1:]]
    if any(name is None or name[2] != len(cell) for name, cell in zip(names, head[1:])):
        return None
    row = [read_tokens(cell) for cell in table["rows"][index["numerator"] - 1]]
    if (len(row[0]) != 1 or row[0][0].kind != "num"
            or any(len(cell) != 1 or cell[0].kind != "blank" for cell in row[1:])):
        return None
    return row[0][0].value, [(Token("blank", None, "___"), place, label) for place, label, _ in names]


def _typed_value(solved):
    result = solved["result"]
    if solved["question"]["kind"] != "evaluate" or result.get("type") != "expression" \
            or result["value"].get("type") != "number":
        _reject()
    return Fraction(result["value"]["numerator"], result["value"]["denominator"])


def place_answer(lesson, question, item, solved):
    """Answer every blank of a printed place-value form from the printed number.

    Returns None for an unrecognized form so unrelated valid tasks keep their
    representation. A recognized form whose typed value disagrees is rejected.
    """
    grade = lesson.get("gradeNumber")
    if (
        type(grade) is not int
        or not 1 <= grade <= 6
        or item["answer"].get("kind") != "computed"
        or item["answer"].get("unit")
    ):
        return None
    split = _place_table(question, item["prompt"]) or _place_split(read_tokens(item["prompt"]))
    if split:
        answer = _split_answer(*split)
        if answer:
            values, parts, rule = answer
            typed = _typed_value(solved)
            # The author models the whole number or any one of its blanks.
            if typed != split[0] and typed not in values:
                _reject()
            return PrintedAnswer(parts, {
                "rule": rule, "number": _json_number(split[0]),
                "verifiedTypedValue": _json_number(typed), "pupilAnswerParts": list(parts),
            })
    p = _plain(item["prompt"])
    if not p:
        return None
    table_line = re.fullmatch(
        r"השלמת שורה ([אבג])['׳]?:(" + THREE + r" = " + SPLIT + r")", p
    )
    if table_line:
        index = "אבג".index(table_line[1])
        _table_row(question, index, int(table_line[3]))
        n = target = int(table_line[3])
        answers = _triple(n)
        rule = "place_digits"
    elif m := re.fullmatch(r"פרקו את המספר " + NATURAL_NUMBER + r" ל" + WHOLE_PLACE
                           + r"((?:,ל" + WHOLE_PLACE + r")*) ול" + WHOLE_PLACE + r"\.", p):
        n = target = int(m[1])
        names = [m[2]] + re.findall(WHOLE_PLACE, m[3]) + [m[m.lastindex]]
        values = _split_places(Fraction(n), [PLACES[name] for name in names])
        if values is None:
            _reject()
        answers = tuple(part for i, (value, name) in enumerate(zip(values, names))
                        for part in ((str(value),), " " + name + (", " if i + 1 < len(names) else "")))
        rule = "place_digits"
    elif m := re.fullmatch(NATURAL_NUMBER + r" [—–-] ספרת ה" + WHOLE_PLACE + r" היא _+", p):
        n = int(m[1])
        target = n // int(PLACES[m[2]]) % 10
        answers = ((str(target),),)
        rule = "digit_at_place"
    elif m := re.fullmatch(r"במספר " + NATURAL_NUMBER + r",מהו הערך של הספרה (\d)\?", p):
        n, digit = map(int, m.groups())
        target = _digits(n, digit)
        answers = ((str(target),),)
        rule = "digit_value"
    elif m := (re.fullmatch(r"(\d+)((?: \+ \d+)+) = _+", p) or
               re.fullmatch(r"מהו המספר שמתקבל מחיבור (\d+)((?:,\d+)*) ו־(\d+)\?", p)):
        terms = [int(v) for v in re.findall(r"\d+", p)]
        # Only a sum of one part per position is a place-value exercise.
        size = len(terms)
        if not 2 <= size <= 7 or any(
            value % 10 ** (size - 1 - i) or not (i == 0) <= value // 10 ** (size - 1 - i) <= 9
            for i, value in enumerate(terms)
        ):
            return None
        n = target = sum(terms)
        answers = ((str(n),),)
        rule = "combine_places"
    elif m := re.fullmatch(
        r"מספר תלת[-־]ספרתי שספרת המאות שלו ([1-9]),ספרת העשרות (\d) וספרת האחדות (\d)\.מהו המספר\?",
        p,
    ):
        h, t, u = map(int, m.groups())
        n = target = 100 * h + 10 * t + u
        answers = ((str(n),),)
        rule = "verbal_places"
    elif m := re.fullmatch(r"כמה (עשרות|מאות) שלמות יש במספר " + NATURAL_NUMBER + r"\?", p):
        n = int(m[2])
        target = n // PLACE[m[1]]
        answers = ((str(target),),)
        rule = "whole_groups"
    elif m := re.fullmatch(r"במספר " + THREE + r" מחליפים בין ספרת המאות לספרת האחדות\.מהו המספר החדש\?", p):
        n = int(m[1])
        target = int(m[1][::-1])
        answers = ((str(target),),)
        rule = "exchange_digits"
    elif m := re.fullmatch(r"כמה (עשרות )?יש להוסיף למספר " + THREE + r" כדי לקבל אלף\?", p):
        n = int(m[2])
        if m[1] and n % 10:
            _reject()
        target = (1000 - n) // (10 if m[1] else 1)
        answers = ((str(target),),)
        rule = "complete_thousand"
    elif m := re.fullmatch(
        r"טענה:במספר " + NATURAL_NUMBER + r",הערך של הספרה (\d) הוא (\d+)\.", p
    ):
        n, digit, claim = map(int, m.groups())
        value = _digits(n, digit)
        intended = "equal" if value == claim else "less" if value < claim else "greater"
        if solved["question"]["kind"] != "compare" or solved["result"] != {
            "type": "comparison",
            "relation": intended,
        }:
            _reject()
        for key, expected in (("left", value), ("right", claim)):
            actual = validate_and_solve_task(
                {"kind": "evaluate", "expression": solved["question"][key]}
            )
            _verify_integer(actual, expected)
        answer = (
            "נכון. " if value == claim else "לא נכון. ",
            "ערך הספרה הוא ",
            (str(value),),
            ".",
        )
        return PrintedAnswer(
            answer,
            {
                "rule": "check_place_value",
                "number": n,
                "digit": digit,
                "claim": claim,
                "verified": value,
            },
        )
    elif m := re.fullmatch(
        r"פרקו את המספר " + THREE + r" לצורות שונות\(למשל:מאות ועשרות ואחדות\)\.", p
    ):
        n = target = int(m[1])
        h, t, u = _facts(n)
        # Regroup a whole hundred so that the second example is distinct even for e.g. 900.
        answers = (
            (f"{h*100} + {t*10} + {u}",),
            " או ",
            (f"{(h-1)*100+90} + {10+t*10+u}",),
        )
        rule = "two_decompositions"
    else:
        return None
    _verify_integer(solved, target)
    return PrintedAnswer(
        answers,
        {
            "rule": rule,
            "number": n,
            "verifiedTypedValue": target,
            "pupilAnswerParts": list(answers),
        },
    )


# These suspicious forms were produced on the introductory counting topic.
# Sorting a pair cannot establish the cardinality of the visible set, and
# a description of a nonexistent picture cannot stand in for its contents.
def guard_counting_input(lesson, question, item, solved):
    if lesson.get("gradeNumber") != 1 or lesson.get("topicId") != "א01":
        return
    prompt = _plain(item["prompt"]) or ""
    intro = _plain(question["intro"]) or ""
    task = solved["question"]
    if "דמות:" in prompt and not question.get("figure"):
        _reject()
    if task["kind"] == "statistics" and (
        re.search(r"ספרו|התאימו|התאמה חד[-־]חד|כתבו את המספר", intro)
        or re.search(r"(?<![א-ת])כמה(?![א-ת])", prompt)
    ):
        _reject()


def validate_counting_values(lesson, solved, supplied):
    if (
        lesson.get("gradeNumber") != 1
        or lesson.get("topicId") != "א01"
        or type(supplied) is not dict
        or set(supplied) != set(solved)
        or not supplied
    ):
        _reject()
    for ident, n in supplied.items():
        if type(n) is not int or not 1 <= n <= 10:
            _reject()
        task = solved[ident]
        if task["question"] != {
            "kind": "evaluate",
            "expression": {"type": "number", "numerator": n, "denominator": 1},
        }:
            _reject()
        _verify_integer(task, n)


def place_intro(lesson, question):
    """Make a conflicting group instruction agree with its actual printed blanks."""
    if lesson.get("gradeNumber") != 3 or lesson.get("topicId") != "ג01":
        return None
    intro = _plain(question["intro"])
    prompts = [_plain(i["prompt"]) or "" for i in question["items"]]
    if intro == "חברו את הערכים לקבלת מספר שלם:" and all(
        re.fullmatch(SPLIT + " = " + THREE, p) for p in prompts
    ):
        return "השלימו את מספר המאות, העשרות והאחדות בכל שורה."
    if intro == "מהו הערך של הספרה המודגשת?" and all(
        re.fullmatch(r"במספר " + THREE + r",מהו הערך של הספרה (\d)\?", p)
        for p in prompts
    ):
        return "מצאו את הערך של הספרה המצוינת בכל סעיף."
    return None
