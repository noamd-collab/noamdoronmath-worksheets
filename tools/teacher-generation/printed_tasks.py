"""Bind exact tasks to complete formulas that the student actually sees."""

from dataclasses import dataclass
from fractions import Fraction
import re
import unicodedata

from compact_authoring import display_parts
from general_source import GeneralSourceError
from math_tasks import MathTaskError, number, validate_and_solve_task
from numeric_literals import display_literal, literal_value


@dataclass(frozen=True)
class Binding:
    proof: dict
    label: str = ""


OP_NAMES = {
    "add": "חיבור", "subtract": "חיסור", "multiply": "כפל", "divide": "חילוק",
    "power": "העלאה בחזקה", "sqrt": "הוצאת שורש",
}


def _reject():
    raise GeneralSourceError("PRINTED_TASK_MISMATCH", "The exact answer disagrees with the printed task")


OTHER_QUESTION_WORD = re.compile(r"(?:^|\s)(?:כמה|מה|מהו|מהי|מהם|מהן|איזה|איזו|אילו|מי|מתי|איפה|היכן|למה|מדוע|כיצד|באיזה|באיזו|בכמה|לכמה)(?=\s|$|\?)")


def yes_no_question(prompt):
    """True only for the interrogative particle, not the noun האם ('the mother')."""
    for match in re.finditer(r"(?:^|[.!?:;,@]\s*|\sו)האם\s", prompt):
        clause = re.match(r"[^.!?]*[.!?]?", prompt[match.end():])[0]
        if clause.endswith("?") and not OTHER_QUESTION_WORD.search(clause):
            return True
    return False


# Requests that no typed task keys with one number: the ratio itself, a time of
# day, who or which ("למי", "מי מהשיטות"). The kernel has no ratio, clock time or
# name to print. These three name a request whatever else the words say; the
# form-based readers below add every other wording of the same request.
RATIO_REQUEST = re.compile(r"(?<![א-ת])(?:מה|מהו|מהי|כתבו|רשמו|צמצמו|פשטו|מצאו|חשבו)(?:\s+את)?\s+ה?יחס(?![א-ת])")
CLOCK_REQUEST = re.compile(
    r"(?<![א-ת])(?:(?:מה|מהי)\s+(?:(?:תהיה|הייתה|היא|יהיה|היה)\s+)?השעה|באיזו\s+שעה)(?![א-ת])")
WHO_REQUEST = re.compile(r"(?:^|[.!?:;,@]\s*|\sו)(?:[למבש]|אצל\s+|של\s+)?מי\s[^.!?]*\?")

# What a question asks for, read from its form: the intro and the item prompt,
# unpointed, every mathematical span as @, clause by clause. Whatever the verb.
_CLAUSE = re.compile(r"[^.!?;]+[.!?;]?")
# A true/false word in a question ("[[32 : 4 = 8]], נכון?"); "whether" after an
# instruction ("בדקו אם", "קבעו האם").
_TRUTH = re.compile(r"(?<![א-ת])ה?(?:נכון|נכונ(?:ה|ים|ות)|שגוי(?:ה|ים|ות)?|צודק(?:ת|ים|ות)?|אמת|שקר)(?![א-ת])")
_WHETHER = re.compile(r"(?<![א-ת])[א-ת]{2,}ו\s+ה?אם(?![א-ת])")
# A yes/no question that offers comparison outcomes ("קטן או גדול מ...") asks for a sign.
_OUTCOMES = re.compile(r"(?:גדול|קטן|שוו)[^.!?;]*(?<![א-ת])או(?![א-ת])[^.!?;]*(?:גדול|קטן|שוו)")
# A comparison sign: the word for a sign, or a relation sign in the words, in a
# clause that asks for it ("השלימו את הסימן", not "מימין לסימן השוויון").
_SIGN = re.compile(r"(?<![א-ת])[ובלמכשה]{0,3}(?:סימן|סימנים|סימני)(?![א-ת])|[<>≤≥≠]")
# An order of several numbers; one number is never that order.
_ORDER = re.compile(r"(?<![א-ת])ו?סדרו(?![א-ת])|מה(?:קטן|גדול)\s+ל(?:גדול|קטן)|בסדר\s+(?:עולה|יורד)")
# A clause asks for something when it is a question, holds a blank, or tells
# the pupil to write, state or find it.
_REQUEST_VERB = re.compile(r"(?<![א-ת])ו?(?:כתבו|רשמו|ציינו|קבעו|הקיפו|סמנו|אמרו|מצאו|צמצמו|פשטו|השלימו|חשבו)(?![א-ת])")
# A ratio or a map scale, in any inflection, unless its clause states it ("היחס ... הוא [[2:3]]",
# "ביחס [[2:3]]", "היחס הנתון").
_RATIO = re.compile(r"(?<![א-ת])[ובלמכשה]{0,3}(?:יחס(?:ים|י)?|קנה\s+ה?מידה)(?![א-ת])")
_STATED = re.compile(r"(?:יחס(?:ים|י)?|מידה)(?:\s+של)?\s*(?:@|[0-9])|(?:יחס(?:ים|י)?|מידה)\s+ה?(?:נתון|נתונה|נתונים|נתונות)(?![א-ת])|"
                     r"(?<![א-ת])(?:הוא|היא|הם|הן)\s*(?:@|[0-9])|=\s*(?:@|[0-9])")
# A time of day: "at which hour", "when" in a clause that asks, or the hour or a
# clock in a clause that asks or states no time.
_WHEN = re.compile(r"(?<![א-ת])[ולמ]?מתי(?![א-ת])")
_WHICH_HOUR = re.compile(r"(?<![א-ת])[ובלמשה]{0,3}(?:איזו|איזה)\s+שעה(?![א-ת])")
_CLOCK = re.compile(r"(?<![א-ת])[וכש]?(?:השעה|ה?שעון)(?![א-ת])")
_AT_CLOCK = re.compile(r"(?<![א-ת])ו?בשעה(?![א-ת])")
# Who, or which thing that is not a number ("כתבו מי...", "לאיזה ילד...?", not
# "קראו אילו פריטים..." before an addition, nor the name מי in a list).
_WHO = re.compile(r"(?<![א-ת])(?:[ולבמש]|של\s+|אצל\s+|עם\s+|על\s+)?מי(?![א-ת])")
_WHICH = re.compile(r"(?<![א-ת])[ובלמשהכ]{0,3}(?:איזה|איזו|אילו)(?![א-ת])\s*([^\s.!?,;:]*)")
_FIRST_OPERATION = re.compile(r"(?:איזו|איזה) פעולה (?:מבצעים|יש לבצע) (?:ראשונה|תחילה)[\s:?]*")
_NUMBER_NOUNS = frozenset(("מספר", "מספרים", "ערך", "ערכים", "שבר", "שברים", "חלק", "חלקים", "ספרה", "ספרות",
                           "תוצאה", "תוצאות", "אחוז", "אחוזים", "מונה", "מכנה", "אורך", "אורכים", "שטח", "היקף",
                           "נפח", "גובה", "מחיר", "משקל", "כמות"))


def _asks(clause):
    return clause.rstrip().endswith("?") or "___" in clause


def _requests(clause):
    return _asks(clause) or bool(_REQUEST_VERB.search(clause))


def _which_thing(text):
    """A "which" whose noun is not a number: a child, a shop, an exercise, a quadrant."""
    for match in _WHICH.finditer(text):
        noun = match[1]
        stems = {noun[k:] for k in range(4) if re.fullmatch(r"[ובלמשהכ]*", noun[:k])}
        if not stems & _NUMBER_NOUNS:
            return True
    return False


def requested(text):
    """The kinds of answer that the words ask for: decision, sign, order, ratio, clock, who.

    Read from the form of each clause, not from one verb, and generous on
    purpose: a request that is misread costs a refused question, never a key
    of the wrong kind.
    """
    from answer_kinds import _INDIRECT, _TRUE_FALSE
    found = set()
    for clause in _CLAUSE.findall(text):
        clause = clause.strip()
        yes_no = yes_no_question(clause)
        if _TRUE_FALSE.search(clause) or (yes_no and not _OUTCOMES.search(clause)):
            found.add("decision")
        elif yes_no:
            found.add("sign")
        elif (_INDIRECT.search(clause) or _WHETHER.search(clause)
              or (clause.rstrip().endswith("?") and _TRUTH.search(clause) and not OTHER_QUESTION_WORD.search(clause))):
            # "בדקו אם", "קבעו האם", "..., נכון?": whether a statement holds.
            found.add("whether")
        if _SIGN.search(clause) and _requests(clause):
            found.add("sign")
        if _ORDER.search(clause):
            found.add("order")
        if RATIO_REQUEST.search(clause) or (_RATIO.search(clause) and _requests(clause) and not _STATED.search(clause)):
            found.add("ratio")
        if (CLOCK_REQUEST.search(clause) or _WHICH_HOUR.search(clause) or (_WHEN.search(clause) and _asks(clause))
                or (_CLOCK.search(clause) and (_asks(clause) or (_requests(clause) and not re.search(r"@|[0-9]", clause))))
                or (_AT_CLOCK.search(clause) and "___" in clause)):
            found.add("clock")
        if WHO_REQUEST.search(clause) or ((_WHO.search(clause) or _which_thing(clause)) and _requests(clause)):
            found.add("who")
    return found


def _prints_relation(spans):
    """A relation sign that the spans print: the statement whose truth a question asks about."""
    return any((span["kind"] == "formula" and re.search(r"[=<>≤≥≠]", span["notation"]))
               or (span["kind"] == "text" and re.search(r"[=<>≤≥≠]", span["text"])) for span in spans)


def _missing_term(item):
    """The item prints a proportion with one missing term ("[[2 : 3 = ___ : 12]]"): that term is a number."""
    return any(span["kind"] == "formula" and "=" in span["notation"]
               and re.search(r"(?:___|(?<![A-Za-z])[a-z](?![A-Za-z]))\s*/|/\s*(?:___|(?<![A-Za-z])[a-z](?![A-Za-z]))",
                             span["notation"])
               for span in item["prompt"])


def validate_computed_request(question, item, solved, grade, location):
    """The kind of answer that the question asks for, against the kind that its typed task gives.

    The question is its intro and the item prompt together. A yes/no,
    true/false or "whether" question is answered only by a decision: a number
    or a comparison sign printed as its key is not its answer. A request for a
    comparison sign is answered only by a comparison, an order of numbers only
    by a list. A ratio, a time of day, who or which thing is never keyed: the
    kernel has no ratio, clock time or name to print. The one exception is a
    printed proportion with one missing term, whose term is a number. A number
    cannot supply a requested equation either.
    """
    kind = solved["result"].get("type")
    if kind == "decision":
        return
    def words(spans):
        value = "".join(s["text"] if s["kind"] == "text" else "@" for s in spans)
        return "".join(c for c in value if not unicodedata.combining(c))

    from answer_kinds import _OPTIONS, _TRUE_FALSE
    prompt = words(item["prompt"])
    shared = requested(words(question.get("intro", [])))
    if "___" in prompt or any(span["kind"] == "formula" and "___" in span["notation"] for span in item["prompt"]):
        # A blank of its own is the item's request: a group's yes/no or true/false
        # question cannot be asked of an item that is still to be filled in, and
        # beside a printed relation ("[[3.47 = 3 + 0.4 + ___]]") the blank is a number,
        # not the group's sign.
        shared -= {"decision", "whether"}
        if _prints_relation(item["prompt"]):
            shared.discard("sign")
    own = requested(prompt)
    if _FIRST_OPERATION.fullmatch(prompt.replace("@", "").strip()):
        # "איזו פעולה מבצעים ראשונה" is keyed with the operation's name by
        # match_printed_task, which refuses it otherwise.
        own.discard("who")
    asked = shared | own
    # Whether a printed statement holds ("בדקו אם [[32 : 4 = 8]]."): a sign would repeat or contradict
    # it. Asked in words of two printed quantities ("בדקו אם השברים שווים."), the sign states the relation.
    printed = _prints_relation(item["prompt"]) or _prints_relation(question.get("intro", []))
    if "decision" in asked or ("whether" in asked and (kind != "comparison" or printed)):
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The printed request needs a decision, not a " + str(kind) + " key at " + location)
    if "sign" in asked and kind != "comparison":
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The printed request needs a comparison sign, not a " + str(kind) + " key at " + location)
    if "order" in asked and kind != "list":
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The printed request needs an order of numbers, not a " + str(kind) + " key at " + location)
    # "היחס בין שני השברים" keyed by a sign asks for the relation between them, not a ratio.
    if ("ratio" in asked and kind != "comparison" and not _missing_term(item)) or "clock" in asked or "who" in asked:
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The printed request needs a ratio, a time of day or who or which, not a " + str(kind)
                                 + " key at " + location)
    # The earlier readers, on the item prompt as they were: the form-based readers above only add refusals.
    if kind != "expression":
        # "האם ... קטן או גדול מ...?" offers its outcomes and is a comparison; a bare yes/no is not.
        either = re.search(r"(?<![א-ת])או(?![א-ת])", _OPTIONS.sub(" ", prompt))
        if _TRUE_FALSE.search(prompt) or (yes_no_question(prompt) and not either):
            raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                     "The printed request needs a decision, not a " + str(kind) + " key at " + location)
        return
    if (yes_no_question(prompt) or _TRUE_FALSE.search(prompt)
            or re.search(r"(?:כתבו|רשמו|בנו|חברו)\s+(?:את\s+ה)?משוואה", prompt)):
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The printed request needs a decision or an equation, not a scalar at " + location)
    alone = prompt if re.search(r"[א-ת]", prompt) else words(question.get("intro", []))
    if RATIO_REQUEST.search(alone) or CLOCK_REQUEST.search(alone) or WHO_REQUEST.search(alone):
        raise GeneralSourceError("PRINTED_ANSWER_KIND",
                                 "The printed request needs a ratio, a time of day or who or which, not a scalar at " + location)


def _tree(part):
    if isinstance(part, str):
        literal = display_literal(part)
        if literal is None:
            return None
        rational = literal_value(literal)
        return number(rational.numerator, rational.denominator)
    tree, names = part[:2]
    if names and set(names.values()) != {"___"}:
        return None
    return tree


def _first_step(expr):
    if expr["type"] != "operation":
        return []
    if all(arg["type"] == "number" for arg in expr["args"]):
        return [expr]
    return [step for arg in expr["args"] for step in _first_step(arg)]


def match_printed_task(item, solved, grade):
    """Check a printed fill-in equality or unique next operation, across the curriculum."""
    if not solved or solved["question"]["kind"] != "evaluate":
        return None
    spans = item["prompt"]
    math = [s for s in spans if s["kind"] != "text"]
    if len(math) != 1:
        return None
    span = math[0]
    if span["kind"] == "math":
        parts = [span["expression"]]
    elif span["kind"] == "formula":
        parts = [(_tree(p) or p) for p in display_parts(span["notation"], grade)]
    else:
        return None

    words = " ".join(s["text"] for s in spans if s["kind"] == "text")
    words = "".join(c for c in words if not unicodedata.combining(c)).strip()
    first = _FIRST_OPERATION.fullmatch(words)
    if first and len(parts) == 1 and isinstance(parts[0], dict):
        steps = _first_step(parts[0])
        if len(steps) != 1 or steps[0] != solved["question"]["expression"] or item["answer"]["unit"]:
            _reject()
        labels = OP_NAMES if grade > 2 else {
            "add": "חִבּוּר", "subtract": "חִסּוּר", "multiply": "כֶּפֶל", "divide": "חִלּוּק"}
        return Binding({"rule": "first_operation", "step": steps[0]}, labels[steps[0]["op"]])
    if ((not words or re.fullmatch(r"(?:השלימו(?: את המספר החסר)?|המספר החסר הוא(?: ___)?|מצאו את המספר החסר)[\s:?.]*",
                                   words))
            and span["kind"] == "formula" and span["notation"].count("___") == 1 and len(parts) == 3
            and parts[1] == "=" and isinstance(parts[0], dict) and isinstance(parts[2], dict)):
        if item["answer"]["unit"]:
            _reject()
        eq = {"kind": "solve", "variable": "x", "lhs": parts[0], "rhs": parts[2]}
        result = validate_and_solve_task(eq)["result"]
        if result["classification"] != "finite" or result["values"] != [solved["result"]["value"]]:
            _reject()
        return Binding({"rule": "unique_missing_number", "equation": eq,
                        "value": result["values"][0]})
    return None


def printed_table_row(question, item, solved):
    """Prove the single missing quantity in a referenced numeric row with named roles."""
    table = question.get("table")
    if not table or not solved or solved["question"]["kind"] != "evaluate":
        return None
    prompt = item["prompt"]
    if (len(prompt) != 2 or prompt[0].get("text", "").strip() not in ("שורה", "שׁוּרָה")
            or prompt[1].get("kind") != "math"):
        return None
    index = prompt[1]["expression"]
    if index.get("type") != "number" or index["denominator"] != 1 or not 1 <= index["numerator"] <= len(table["rows"]):
        return None
    labels = [cell[0].get("text", "") if len(cell) == 1 else "" for cell in table["head"]]
    ratios = (("מחלק", "מנה", "מחולק"), ("מספר", "אחוז", "תוצאה"))
    roles = next((roles for roles in ratios if len(labels) == 3 and set(roles) == set(labels)), None)
    if roles is None:
        return None
    row = table["rows"][index["numerator"] - 1]
    quantities = []
    for role in roles:
        cell = row[labels.index(role)]
        if len(cell) != 1:
            return None
        span = cell[0]
        if span.get("notation") == "___":
            quantities.append(None)
        elif role == "אחוז":
            spelling = span.get("notation", "")
            if not spelling.endswith("%") or display_literal(spelling) is None:
                return None
            quantities.append(literal_value(spelling))
        elif span.get("kind") == "math" and span["expression"].get("type") == "number":
            val = span["expression"]
            quantities.append(Fraction(val["numerator"], val["denominator"]))
        elif span.get("kind") == "formula" and display_literal(span["notation"]) is not None:
            quantities.append(literal_value(span["notation"]))
        else:
            return None
    if quantities.count(None) != 1:
        return None
    a, b, total = quantities
    missing = quantities.index(None)
    if missing != 2 and not quantities[1 - missing]:
        _reject()
    expected = a * b if missing == 2 else total / quantities[1 - missing]
    if roles[0] == "מחלק" and (expected if missing == 0 else a) == 0:
        _reject()
    if roles[missing] == "אחוז":
        expected *= 100
    actual = solved["result"].get("value", {})
    if (actual.get("type") != "number" or Fraction(actual["numerator"], actual["denominator"]) != expected
            or item["answer"]["unit"] not in (("%", "אחוז", "אחוזים", "") if roles[missing] == "אחוז" else ("",))):
        _reject()
    return {"rule": "printed_table_row", "row": index["numerator"], "quantity": roles[missing]}


def _named_equation(notation, grade):
    """Match one pupil-facing equality in one Latin unknown; keep its original name."""
    if not isinstance(notation, str) or len(notation) > 220:
        return None
    names = set(re.findall(r"[A-Za-z_]+", notation)) - {"sqrt", "frac"}
    if len(names) != 1:
        return None
    name = next(iter(names))
    if not re.fullmatch("[a-z]", name):
        return None
    from compact_authoring import expression, MATH_TRANSLATION
    compact = re.sub(r"(?<![A-Za-z_])" + name + r"(?![A-Za-z_])", "x", notation)
    sides = compact.translate(MATH_TRANSLATION).split("=")
    if len(sides) != 2:
        return None
    return name, expression(sides[0], grade), expression(sides[1], grade)


SOLVE_DIRECTIVE = re.compile(
    r"(?:פתרו(?:\s+את\s+המשוואה)?\s*[:]?\s*@\s*[.?!]?|"
    r"פתרון המשוואה\s*@\s*הוא\s*[:?.]?|@\s*[.?]?)"
)


def printed_solve(prompt, task, grade):
    if (grade < 7 or not isinstance(task, dict) or task.get("kind") != "solve"
            or not isinstance(prompt, list)):
        return None
    maths = [s for s in prompt if isinstance(s, dict) and s.get("kind") != "text"]
    if len(maths) != 1 or maths[0].get("kind") != "formula":
        return None
    printed = _named_equation(maths[0].get("notation"), grade)
    if not printed:
        return None
    if any(not isinstance(s, dict) or s.get("kind") == "text" and not isinstance(s.get("text"), str) for s in prompt):
        return None
    wrapper = "".join(s["text"] if s["kind"] == "text" else "@" for s in prompt).strip()
    def mismatch():
        if SOLVE_DIRECTIVE.fullmatch(wrapper):
            _reject()
        return None
    label, left, right = printed
    if isinstance(task.get("lhs"), str) and isinstance(task.get("rhs"), str):
        if set(task) != {"kind", "lhs", "rhs", "variable"} or task["variable"] not in ("x", "y", "a", "b"):
            return None
        authored = _named_equation(task["lhs"] + "=" + task["rhs"], grade)
        # The wire contract can use canonical x for a differently named
        # printed unknown. Both original sides must still match exactly.
        if not authored or authored[1:] != printed[1:] or (
                authored[0] != label and not (authored[0] == task["variable"] == "x")):
            return mismatch()
        # Normalize only variable spelling. Both original sides must agree with the print.
        if task["variable"] == label:
            return None
        return {"kind": "solve", "lhs": left, "rhs": right, "variable": "x"}
    variable = task.get("variable")
    if variable not in {"x", "y", "a", "b"} or variable not in {"x", label}:
        return mismatch()

    def native_symbol(node):
        if not isinstance(node, dict):
            return node
        if node.get("type") == "symbol":
            return {"type": "symbol", "name": variable} if node["name"] == "x" else node
        if node.get("type") == "operation":
            return {**node, "args": [native_symbol(a) for a in node["args"]]}
        return node

    if (native_symbol(left), native_symbol(right)) == (task.get("lhs"), task.get("rhs")):
        return label
    return mismatch()


INEQUALITY_SIGN = re.compile(r"<=|>=|[<>≤≥]")
_INEQUALITY_RELATIONS = {"<": "lt", "<=": "le", "≤": "le", ">": "gt", ">=": "ge", "≥": "ge"}


def printed_inequality(item, solved, grade):
    """Bind a typed inequality to the inequality that the item prints, or refuse it.

    A printed chain such as -3 < 2x + 1 ≤ 7 is two inequalities, and a typed
    inequality solves only one of them. One printed inequality in one letter
    must have the solution set of the typed one. None when the item prints no
    inequality or the task is not an inequality.
    """
    task = solved["question"]
    if task.get("kind") != "inequality":
        return None
    printed = [span for span in item["prompt"] if span["kind"] == "formula" and INEQUALITY_SIGN.search(span["notation"])]
    if not printed:
        return None
    from compact_authoring import RELATION, MATH_TRANSLATION, expression
    if len(printed) != 1:
        _reject()
    pieces = [piece.strip() for piece in RELATION.split(printed[0]["notation"])]
    if len(pieces) != 3 or pieces[1] not in _INEQUALITY_RELATIONS:
        _reject()
    names = {name for piece in (pieces[0], pieces[2]) for name in re.findall(r"[A-Za-z_]+", piece)} - {"sqrt", "frac"}
    if len(names) != 1 or not re.fullmatch(r"[a-z]", next(iter(names))):
        _reject()
    letter = next(iter(names))
    sides = [re.sub(r"(?<![A-Za-z_])" + letter + r"(?![A-Za-z_])", "x", piece).translate(MATH_TRANSLATION)
             for piece in (pieces[0], pieces[2])]
    try:
        own = validate_and_solve_task({"kind": "inequality", "variable": "x", "lhs": expression(sides[0], grade),
                                       "rhs": expression(sides[1], grade), "relation": _INEQUALITY_RELATIONS[pieces[1]]})
    except (GeneralSourceError, MathTaskError):
        _reject()
    if own["result"]["intervals"] != solved["result"].get("intervals"):
        _reject()
    return Binding({"rule": "printed_inequality", "relation": _INEQUALITY_RELATIONS[pieces[1]]})


MATCHING_BANK = re.compile(r"התאימו לכל משוואה את הפתרון הנכון מתוך הרשימה\s*:\s*")


def matching_solution_choices(question, solved, grade):
    """Prove that the displayed numbers form a choice bank for these printed equations."""
    intro = question["intro"]
    if not intro or intro[0]["kind"] != "text" or not MATCHING_BANK.fullmatch(intro[0]["text"]):
        return None
    if any(k in question for k in ("table", "figure", "drawingFromWords")):
        _reject()
    parts = list(intro[1:])
    if parts and parts[-1]["kind"] == "text" and parts[-1]["text"].strip() in (".", ""):
        parts.pop()
    if not 3 <= len(parts) <= 15 or len(parts) % 2 != 1:
        _reject()
    options = []
    for index, part in enumerate(parts):
        if index % 2:
            if part["kind"] != "text" or part["text"].strip() != ",":
                _reject()
            continue
        if part["kind"] == "math" and part["expression"]["type"] == "number":
            value = part["expression"]
        elif (part["kind"] == "formula" and (spelling := display_literal(part["notation"]))
              and not spelling.endswith("%")):
            rational = literal_value(spelling)
            value = number(rational.numerator, rational.denominator)
        else:
            _reject()
        if value in options:
            _reject()
        options.append(value)
    if len(question["items"]) != len(solved):
        _reject()
    solutions = []
    for item, actual in zip(question["items"], solved):
        prompt = item["prompt"]
        wrapper = "".join(p["text"] if p["kind"] == "text" else "@" for p in prompt).strip()
        if not SOLVE_DIRECTIVE.fullmatch(wrapper):
            _reject()
        if (item["answer"].get("kind") != "computed" or item["answer"].get("unit") or not actual
                or not printed_solve(prompt, actual["question"], grade)
                or validate_and_solve_task(item["answer"]["task"]) != actual):
            _reject()
        left, right = actual["question"]["lhs"], actual["question"]["rhs"]
        if {left["type"], right["type"]} == {"number", "symbol"}:
            _reject()
        result = actual["result"]
        values = result.get("values", [])
        if result.get("classification") != "finite" or len(values) != 1 or values[0] not in options:
            _reject()
        solutions.append(values[0])
    if len(solutions) < 2 or all(v == solutions[0] for v in solutions):
        _reject()
    reused = any(solutions.count(v) > 1 for v in solutions)
    return parts[::2], reused
