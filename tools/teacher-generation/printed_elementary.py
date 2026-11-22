"""Bind bounded elementary exercises to the facts that the pupil sees.

The provider's symbolic evaluation remains independently verified. Only a whole
supported prompt can provide a stronger, pupil-facing answer binding here.
"""

from dataclasses import dataclass
import re
import unicodedata

from general_source import GeneralSourceError
from math_tasks import number, operation, validate_and_solve_task

PLACE = {"אחדות": 1, "עשרות": 10, "מאות": 100}
THREE = r"([1-9][0-9]{2})"
SPLIT = r"_+ מאות \+ _+ עשרות \+ _+ אחדות"


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


def _plain(spans):
    pieces = []
    for span in spans:
        if span["kind"] == "text":
            pieces.append(span["text"])
        elif span["kind"] == "math":
            v = span["expression"]
            if v["type"] != "number" or v["denominator"] != 1:
                return None
            pieces.append(str(v["numerator"]))
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


def _facts(n):
    h, rem = divmod(n, 100)
    t, u = divmod(rem, 10)
    return h, t, u


def _triple(n):
    h, t, u = _facts(n)
    return ((str(h),), " מאות, ", (str(t),), " עשרות, ", (str(u),), " אחדות")


def _digits(n, digit):
    choices = [place * digit for place in (1, 10, 100) if n // place % 10 == digit]
    if not choices or len(set(choices)) != 1:
        _reject()
    return choices[0]


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


def place_answer(lesson, question, item, solved):
    """Return None for an unrecognized form so unrelated valid tasks keep their representation."""
    if (
        lesson.get("topicId") != "ג01"
        or lesson.get("gradeNumber") != 3
        or item["answer"].get("kind") != "computed"
        or item["answer"].get("unit")
    ):
        return None
    p = _plain(item["prompt"])
    if not p:
        return None
    table_line = re.fullmatch(
        r"השלמת שורה ([אבג])['׳]?:(" + THREE + r" = " + SPLIT + r")", p
    )
    if table_line:
        index = "אבג".index(table_line[1])
        _table_row(question, index, int(table_line[3]))
        p = table_line[2]

    m = re.fullmatch(THREE + " = " + SPLIT, p) or re.fullmatch(SPLIT + " = " + THREE, p)
    if m:
        n = int(m[1])
        target = n
        answers = _triple(n)
        rule = "place_digits"
    elif m := re.fullmatch(THREE + r" = _+ מאות \+ (\d+) \+ _+ אחדות", p):
        n, middle = map(int, m.groups())
        h, t, u = _facts(n)
        if middle != 10 * t:
            _reject()
        # The source models the missing units, while the pupil has two blanks.
        # Independently recover BOTH digits and verify their reconstruction.
        target = u
        answers = ((str(h),), " מאות, ", (str(u),), " אחדות")
        rule = "two_missing_digits"
    elif m := re.fullmatch(THREE + r" [—–-] ספרת ה(מאות|עשרות|אחדות) היא _+", p):
        n = int(m[1])
        target = n // PLACE[m[2]] % 10
        answers = ((str(target),),)
        rule = "digit_at_place"
    elif m := re.fullmatch(r"במספר " + THREE + r",מהו הערך של הספרה (\d)\?", p):
        n, digit = map(int, m.groups())
        target = _digits(n, digit)
        answers = ((str(target),),)
        rule = "digit_value"
    elif m := re.fullmatch(r"(\d+) \+ (\d+) \+ (\d+) = _+", p):
        a, b, c = map(int, m.groups())
        if (
            a not in range(100, 1000, 100)
            or b not in range(0, 100, 10)
            or c not in range(10)
        ):
            return None
        n = target = a + b + c
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
    elif m := re.fullmatch(
        r"טענה:במספר " + THREE + r",הערך של הספרה (\d) הוא (\d+)\.", p
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
