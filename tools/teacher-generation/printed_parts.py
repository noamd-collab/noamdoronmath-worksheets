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


def visible_numbers(spans):
    """Every number that a pupil can read in these spans."""
    found = set()
    for span in spans:
        if span["kind"] == "math":
            _numbers(span["expression"], found)
            continue
        text = span.get("text") if span["kind"] == "text" else span.get("notation", "")
        for match in NUMBER_TOKEN.finditer(text or ""):
            value = literal_value(match[0])
            found.add(value)
            if (text or "")[match.end():match.end() + 1] == "%":
                found.add(value / 100)
        for pair in re.finditer(r"frac\(\s*([0-9]+)\s*,\s*([1-9][0-9]*)\s*\)", text or ""):
            found.add(Fraction(int(pair[1]), int(pair[2])))
    return found


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


def shows_task(question, item, solved, *, intro=None):
    """Whether the typed task is printed after the pupil prompt.

    It is printed only for a prompt that carries no mathematics of its own,
    and never when the print would be an answer. A prompt with numbers is a
    complete exercise or a word problem; printing the calculation after it
    would repeat the exercise or reveal the operation. The same holds for a
    question about a story or a table that is printed once for all its items,
    and for an item whose words continue the pupil's own earlier answers.
    """
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


def echoed_given(item, solved):
    """Refuse a key that only repeats the one number of a bare prompt.

    A prompt that is nothing but "60", keyed by the value of 2 x 2 x 3 x 5, asks
    for the expression itself. The exact kernel cannot key a requested form.
    """
    typed = _scalar(solved)
    task = solved["question"]
    if typed is None or task.get("kind") != "evaluate" or task["expression"].get("type") != "operation":
        return
    tokens = read_tokens(item["prompt"])
    if len(tokens) == 1 and tokens[0].kind == "num" and tokens[0].value == typed \
            and typed not in task_numbers(task):
        _reject("The key repeats the only printed number; the requested form cannot be verified")


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


def check_item(question, item, solved, grade):
    """Run every printed-answer binder at source validation, where a refusal is recoverable.

    Returns the bound decision of a yes/no item, and None for every other item.
    """
    bind_parts(question, item, solved, grade)
    if item["answer"].get("kind") == "computed":
        comparison_blank(item, solved, grade)
        printed_calculation(question, item, solved, grade)
        echoed_given(item, solved)
        from answer_kinds import bind_decision, refuse_dummy_key
        refuse_dummy_key(question, item, solved, grade)
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
    return forms
