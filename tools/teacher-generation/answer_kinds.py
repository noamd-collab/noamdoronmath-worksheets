"""Answers that are not one computed value: a decision, a label, and an item without a key.

A yes/no key is decided by the exact kernel from a typed claim. A true claim
can still be the wrong answer when it is not the question that the pupil
reads ("is 56 : 8 greater than 5?" typed as "smaller than"). ``bind_decision``
ties the claim to the print: to the one printed statement whose correctness is
asked about, or to the relation word and the printed numbers of the question.
Whatever it cannot tie is refused; a question may fail, a wrong "כן" may not
be printed.

A label is a short Hebrew name that no kernel computes ("משולש", "יום שני").
It is printed in the key and reported as unverified, for a teacher note. An
open item (a drawing, a construction, the pupil's own example) has no key: its
key line says that the teacher checks it. Neither kind may stand in for an
answer that can be computed, and a number is never accepted as the key of a
drawing.

Every refusal is a recoverable PRINTED_ANSWER_KIND or PRINTED_TASK_MISMATCH
for one question.
"""

from dataclasses import dataclass
from fractions import Fraction
import re

from general_source import GeneralSourceError
from math_tasks import MathTaskError, number, validate_and_solve_task
from numeric_literals import NUMBER_TOKEN, literal_value
from printed_elementary import _unpointed, blank_count
from printed_parts import (_NUMBER_WORDS, _PART_WORDS, _closed, _numbers, _table_spans, task_numbers,
                           visible_numbers, word_numbers)

# The fixed key line of an item without a key. Teacher notes stay unpointed in
# every grade (pinned elementary skill, references/answer-quality.md).
TEACHER_CHECK = "סעיף פתוח: לבדיקת המורה."
VERDICTS = {
    ("yes_no", True): ("כן", "כֵּן"), ("yes_no", False): ("לא", "לֹא"),
    ("true_false", True): ("נכון", "נָכוֹן"), ("true_false", False): ("לא נכון", "לֹא נָכוֹן"),
}
# What the author is told wherever the answer kinds are described. One text,
# so that the request, the correction and the validator cannot drift apart.
DECISION_GUIDE = (
    "A decide task is only for a comparison, a divisibility or a membership of quantities that the item itself "
    "prints. A question about a property, about 'always' (תמיד), 'necessarily' (בהכרח), 'can it be' (האם ייתכן) "
    "or about whether two methods agree has no decide form: ask instead for a quantity that the pupil computes "
    "(in middle school a proof or an explanation uses review). Never invent values to make a claim decidable. "
    "A yes/no or true/false question ('האם ...?', 'נכון או לא נכון') never has a number as its answer. "
    "Give it a computed answer whose task is {\"kind\":\"decide\",\"relation\":R,\"left\":E,\"right\":E}: "
    "R is eq, ne, lt, le, gt or ge for the comparison that the sentence states, in its printed order, "
    "or divisible / not_divisible (left by right; use right 2 for even and odd). For membership in a printed "
    "list use relation in or not_in with \"values\":[E,...] in place of right. E uses only the numbers and "
    "calculations printed in that item. Never write the yes or the no: the compiler decides the claim and "
    "prints the verdict with its calculation. Ask one decidable claim per item, e.g. "
    "'האם המנה של [[56 : 8]] גדולה מ־[[5]]?' with relation gt, left 56/8, right 5, or "
    "'האם [[32 : 4 = 7]] נכון?' with relation eq, left 32/4, right 7. The whole answer object is "
    "{\"kind\":\"computed\",\"task\":{\"kind\":\"decide\",\"relation\":\"gt\",\"left\":\"56/8\",\"right\":\"5\"},\"unit\":\"\"}. "
    "A question that offers two outcomes "
    "('קטן או גדול מ...') is not a yes/no question: give it a compare task with the two printed sides.")
ELEMENTARY_KINDS_GUIDE = (
    "Two more answer kinds exist for grades 1-6 only. {\"kind\":\"open\"} is for an item with no single answer "
    "that the pupil draws, builds, measures, explains or invents ('ציירו', 'שרטטו', 'בנו', 'מדדו', 'הסבירו', "
    "'תנו דוגמה'); its key says that the teacher checks it. Never give such an item a number as its answer. "
    "{\"kind\":\"label\",\"text\":\"...\"} is only for an item whose own prompt asks for a name ('איזה מצולע ...?', "
    "'... נקרא ___', 'מה שם ...?', 'באיזה יום ...?', 'מי ...?') and whose answer is a short Hebrew name of one to "
    "four words without digits ('משולש', 'יום שני'); it is printed as written and marked for the teacher to "
    "check. Whenever the answer is a number, a calculation, a comparison or a yes/no, use a computed task instead.")


def _refuse_kind(reason):
    raise GeneralSourceError("PRINTED_ANSWER_KIND", reason)


def _mismatch(reason):
    raise GeneralSourceError("PRINTED_TASK_MISMATCH", reason)


@dataclass(frozen=True)
class Decision:
    holds: bool    # the answer to the printed question
    form: str      # "yes_no" or "true_false"
    steps: tuple   # exact calculations that justify it; rendered by the trusted adapter
    proof: dict

    def verdict(self, pointed=False):
        return VERDICTS[(self.form, self.holds)][1 if pointed else 0]


# ------------------------------------------------------------ reading the print
def _layout(spans):
    """Unpointed prose with one @ for each mathematical span, and where every span stands."""
    pieces, segments, position = [], [], 0
    for span in spans:
        text = _unpointed(span["text"]) if span["kind"] == "text" else "@"
        segments.append((position, position + len(text), span, text))
        pieces.append(text)
        position += len(text)
    return "".join(pieces), segments


def _window(segments, start, stop):
    """The spans, or the cut parts of a prose span, that stand in [start, stop)."""
    spans = []
    for first, last, span, text in segments:
        if span["kind"] == "text":
            part = text[max(start, first) - first:max(0, min(stop, last) - first)]
            if part:
                spans.append({"kind": "text", "text": part})
        elif start <= first < stop:
            spans.append(span)
    return spans


def _printed_numbers(spans):
    """One entry for each printed number: the values that it can stand for.

    [[25%]] is 25 or one quarter; a printed fraction is its value or its two
    parts. A typed claim must use every entry in one of these readings.
    """
    entries = []
    for span in spans:
        if span["kind"] == "math":
            entries += [_fraction_readings(value) for value in _numbers(span["expression"], set())]
            continue
        text = span["text"] if span["kind"] == "text" else span.get("notation", "")
        for pair in re.finditer(r"frac\(\s*([0-9]+)\s*,\s*([1-9][0-9]*)\s*\)", text):
            entries.append(_fraction_readings(Fraction(int(pair[1]), int(pair[2]))))
        text = re.sub(r"frac\([^()]*\)", " ", text)
        for match in NUMBER_TOKEN.finditer(text):
            value = literal_value(match[0])
            if text[match.end():match.end() + 1] == "%":
                entries.append(({value}, {value / 100}))
            else:
                entries.append(_fraction_readings(value))
    return entries


def _fraction_readings(value):
    readings = [{value}]
    if value.denominator != 1:
        readings.append({Fraction(value.numerator), Fraction(value.denominator)})
    return tuple(readings)


def _used(entry, leaves):
    return any(reading <= leaves for reading in entry)


def _shown(leaves, visible):
    """Every typed number is printed; a typed fraction may be printed as its two parts ("1 : 2")."""
    return all(leaf in visible or (leaf.denominator != 1 and {Fraction(leaf.numerator), Fraction(leaf.denominator)} <= visible)
               for leaf in leaves)


def _subtrees(tree):
    yield tree
    if isinstance(tree, dict) and tree.get("type") == "operation":
        for arg in tree["args"]:
            yield from _subtrees(arg)


def _value(tree):
    """The exact value of a closed printed calculation, or None when it has none."""
    try:
        return validate_and_solve_task({"kind": "evaluate", "expression": tree})["result"]["value"]
    except MathTaskError:
        return None


def _occurs(printed, sides):
    """A printed calculation is part of the claim: the same tree, or the same numbers with the same value."""
    numbers = _numbers(printed, set())
    for side in sides:
        for part in _subtrees(side):
            if part == printed:
                return True
            if (part.get("type") == "operation" and _numbers(part, set()) == numbers
                    and _value(part) is not None and _value(part) == _value(printed)):
                return True
    return False


_PERCENT = re.compile(r"\s*-?[0-9][0-9,.]*%\s*")
_OF = re.compile(r"\s*(?:מ|מתוך|מן|של)[־-]?\s*")
_PERCENT_OF = re.compile(r"\s*(?:אחוזים|אחוז)\s+(?:מ|מתוך|מן|של)[־-]?\s*")


def _quantities(spans, grade):
    """The quantities that a pupil reads in these spans, in order.

    A quantity is a printed number, a printed closed calculation, or the
    phrase "N% מ־M". Each one is a tuple of the exact values that it can stand
    for: a bare [[60%]] is three fifths, or 60 when both sides count percents.
    A span that is none of these (a blank, a letter, a relation) is None.
    """
    def plain(span):
        tree = _closed(span, grade) if span["kind"] != "text" else None
        return tree if tree is not None and tree.get("type") == "number" else None

    found, index = [], 0
    while index < len(spans):
        span = spans[index]
        if span["kind"] == "text":
            index += 1
            continue
        tree = _closed(span, grade)
        percent = span["kind"] == "formula" and bool(_PERCENT.fullmatch(span["notation"]))
        rate = tree if percent else plain(span)
        if rate is not None and index + 2 < len(spans) and spans[index + 1]["kind"] == "text":
            link, whole = _unpointed(spans[index + 1]["text"]), plain(spans[index + 2])
            if whole is not None and (_OF if percent else _PERCENT_OF).fullmatch(link):
                hundredth = rate if percent else {"type": "operation", "op": "divide", "args": [rate, number(100)]}
                found.append((_value({"type": "operation", "op": "multiply", "args": [hundredth, whole]}),))
                index += 3
                continue
        if tree is None:
            found.append(None)
        elif percent:
            found.append((tree, _value({"type": "operation", "op": "multiply", "args": [tree, number(100)]})))
        else:
            found.append((tree if tree.get("type") == "number" else _value(tree),))
        index += 1
    return found


def _has_values(trees, quantities, *, ordered):
    """The typed sides have exactly the values of the printed quantities, in one reading of the percents."""
    values = [tree if tree.get("type") == "number" else _value(tree) for tree in trees]
    if any(value is None for value in values) or any(q is None or None in q for q in quantities):
        return False
    for reading in (0, 1):
        wanted = [q[min(reading, len(q) - 1)] for q in quantities]
        if values == wanted or (not ordered and values[::-1] == wanted):
            return True
    return False


_SIGNS = {"=": "eq", "≠": "ne", "<": "lt", ">": "gt", "≤": "le", "≥": "ge"}


def _printed_statement(span, grade):
    """(relation, left, right) of a printed closed statement such as "32 : 4 = 8".

    None for a span without a relation sign; False for a relation that is not
    one closed numeric statement (a blank, a letter, a chain).
    """
    if span["kind"] != "formula":
        return None
    from compact_authoring import RELATION, display_parts
    if not RELATION.search(span["notation"]):
        return None
    try:
        parts = display_parts(span["notation"], grade)
    except GeneralSourceError:
        return False
    if len(parts) != 3 or not isinstance(parts[1], str) or parts[1] not in _SIGNS:
        return False
    sides = []
    for part in (parts[0], parts[2]):
        if isinstance(part, str):
            from numeric_literals import display_literal
            literal = display_literal(part)
            if literal is None or literal.endswith("%"):
                return False
            exact = literal_value(literal)
            sides.append(number(exact.numerator, exact.denominator))
        else:
            tree, aliases = part[:2]
            if aliases:
                return False
            sides.append(tree)
    return _SIGNS[parts[1]], sides[0], sides[1]


# -------------------------------------------------------- the question sentence
_DIRECT = re.compile(r"(?:^|[.!?:;,@]\s*|\sו)האם\s[^.!?]*\?")
_INDIRECT = re.compile(r"(?<![א-ת])ו?(?:בדקו|קבעו|החליטו|בררו)\s(?:[^.!?]{0,40}\s)?(?:האם|אם)\s[^.!?]*[.?]?")
_TRUE_FALSE = re.compile(r"(?<![א-ת])(?:נכון\s*(?:או|/)\s*(?:לא[ ־]נכון|שגוי|לא)|אמת\s*(?:או|/)\s*שקר)(?![א-ת])\s*[:?.]?")
_OTHER_QUESTION = re.compile(
    r"(?<![א-ת])(?:כמה|מה|מהו|מהי|מהם|מהן|איזה|איזו|אילו|מי|מתי|איפה|היכן|למה|מדוע|כיצד|באיזה|באיזו|בכמה|לכמה)(?![א-ת])")
_OPTIONS = re.compile(r"\(?\s*כן\s*(?:/|או)\s*לא\s*\)?")


def _question_sentence(text, intro_text):
    """Find the yes/no or true/false question of an item: (form, start, stop, text).

    ``form`` chooses the verdict words. The returned text has the same
    length as the prompt; the words "נכון או לא נכון" are blanked in it,
    because they are the instruction and not the statement that is judged.
    A statement whose question is asked once for the group is the whole prompt.
    """
    direct = list(_DIRECT.finditer(text))
    if len(direct) > 1:
        _refuse_kind("One item asks one yes/no question")
    if direct:
        start = text.index("האם", direct[0].start())
        if _OTHER_QUESTION.search(text[start:direct[0].end()]):
            _refuse_kind("A question with another question word is not a yes/no question")
        return "yes_no", start, direct[0].end(), text
    indirect = _INDIRECT.search(text)
    if indirect:
        return "yes_no", indirect.start(), indirect.end(), text
    marker = _TRUE_FALSE.search(text)
    if marker:
        return "true_false", 0, len(text), _blank(text, marker.start(), marker.end())
    if "?" in text or _OTHER_QUESTION.search(text):
        _refuse_kind("The item asks another question; a decision answers only a yes/no question")
    if _TRUE_FALSE.search(intro_text):
        return "true_false", 0, len(text), text
    if _DIRECT.search(intro_text) or _INDIRECT.search(intro_text):
        return "yes_no", 0, len(text), text
    _refuse_kind("A decision needs a printed yes/no or true/false question")


# ------------------------------------------------------------ the relation word
def _word(pattern):
    return re.compile(r"(?<![א-ת])[ושה]{0,2}(?:" + pattern + r")(?![א-ת])")


# Pointed text (grades one and two) drops the vowel letters of the plain spelling:
# "אָרֹךְ" is ארך, "שָׁוִים" is שוים, "צַיְּרוּ" is צירו. Both spellings are listed.
_GREATER = r"גדול(?:ה|ים|ות)?|ארו?(?:ך|כה|כים|כות)|גבוה(?:ה|ים|ות)?|כבד(?:ה|ים|ות)?|יקר(?:ה|ים|ות)?"
_SMALLER = r"קטן|קטנה|קטנים|קטנות|קצר(?:ה|ים|ות)?|נמו(?:ך|כה|כים|כות)|זול(?:ה|ים|ות)?"
_CUES = (
    ("le", None, _word(r"לכל היותר")),
    ("ge", None, _word(r"לפחות|מספיק(?:ה|ים|ות)?|יספיקו?|תספיק")),
    ("not_divisible", 2, _word(r"אי[־-]?\s?זוגי(?:ת|ים|ות)?")),
    ("divisible", 2, _word(r"זוגי(?:ת|ים|ות)?")),
    ("divisible", None, _word(r"מתחלק(?:ת|ים|ות)?|כפולה של|כפולות של")),
    ("gt", None, _word(_GREATER + r"|יותר|עולה על|מעל")),
    ("lt", None, _word(_SMALLER + r"|פחות|מתחת")),
    ("ne", None, _word(r"שונה|שונים|שונות")),
    ("eq", None, _word(r"שוו?ה|שוו?ים|שוו?ת|זהה|זהים|זהות|אות(?:ו|ה|ם|ן)")),
    ("in", None, _word(r"נמצא(?:ת|ים|ות)?|מופיע(?:ה|ים|ות)?|שייך|שייכת|ברשימה")),
)
_MORE = re.compile(r"(?<![א-ת])(?:(" + _GREATER + "|" + _SMALLER + r")\s+יותר|יותר\s+(?=" + _GREATER + "|" + _SMALLER + r"))(?![א-ת])")
# "הבסיס הגדול", "הצלע הקצרה": with the article the adjective names a thing; it asks about no relation.
_ATTRIBUTIVE = re.compile(r"(?<![א-ת])[וש]?ה(?:" + _GREATER + "|" + _SMALLER + r")(?![א-ת])")
_CORRECT = _word(r"נכון|נכונה|נכונים|נכונות|מתקיים|מתקיימת|צודק|צודקת|צודקים|צדק|צדקה")
_WRONG = _word(r"טעה|טעתה|טעו|טעות|טעויות|שגוי|שגויה|שגויים|שגויות|שגה|שגתה")
_NEGATION = re.compile(r"(?<![א-ת])(?:לא|אינו|אינה|אינם|אינן|אין)(?![א-ת])")
_NEGATED = re.compile(r"(?<![א-ת])(?:לא|אינו|אינה|אינם|אינן)\s+(?:הוא\s+|היא\s+|הם\s+|הן\s+)?$")
_FLIP = {"eq": "ne", "ne": "eq", "gt": "le", "le": "gt", "lt": "ge", "ge": "lt",
         "divisible": "not_divisible", "not_divisible": "divisible", "in": "not_in", "not_in": "in"}
_MIRROR = {"gt": "lt", "lt": "gt", "ge": "le", "le": "ge"}


def _blank(text, start, stop):
    return text[:start] + " " * (stop - start) + text[stop:]


def _relation_word(sentence):
    """The single relation that a sentence asks about: (relation, place, divisor, weak).

    None when the sentence names no relation, more than one, or a negation
    that does not stand directly before the relation word. ``weak`` marks a
    bare "is this right?", which is an equality only when nothing else is said.
    """
    text = _OPTIONS.sub(lambda m: " " * len(m[0]), sentence)
    for match in list(_MORE.finditer(text)):
        # "גדול יותר" is one word of comparison, not two.
        more = text.index("יותר", match.start())
        text = _blank(text, more, more + len("יותר"))
    for match in list(_ATTRIBUTIVE.finditer(text)):
        text = _blank(text, match.start(), match.end())
    found = []
    for relation, divisor, cue in _CUES:
        for match in list(cue.finditer(text)):
            negation = _NEGATED.search(text[:match.start()])
            if negation:
                text = _blank(text, negation.start(), negation.end())
            found.append((_FLIP[relation] if negation else relation, match.start(), divisor))
            text = _blank(text, match.start(), match.end())
    correct = _CORRECT.search(text)
    if correct and _NEGATED.search(text[:correct.start()]):
        return None
    if _NEGATION.search(text) or _WRONG.search(text):
        return None
    relations = {relation for relation, _, _ in found}
    if len(relations) == 1 and len({divisor for _, _, divisor in found}) == 1:
        relation, place, divisor = found[0]
        return relation, place, divisor, False
    either = re.search(r"(?<![א-ת])או(?![א-ת])", text)
    for strict, loose in (("gt", "ge"), ("lt", "le")):
        if relations == {strict, "eq"} and either and len(found) == 2:
            return loose, min(place for _, place, _ in found), None, False
    if not found and correct:
        return "eq", correct.start(), None, True
    return None


# ------------------------------------------------------------------ decisions
def _steps(sides, result):
    """The calculations behind a verdict: the value of every computed side, then the division."""
    steps = []
    for side in sides:
        if side.get("type") == "operation" and _value(side) is not None:
            steps.append(("value", side, _value(side)))
    if result["relation"] in ("divisible", "not_divisible"):
        steps.append(("division", result["left"], result["right"], result["quotient"], result["remainder"]))
    return tuple(steps)


_SOLUTION_WORD = re.compile(r"(?<![א-ת])[ושה]{0,2}פתרו(?:ן|נות|נה|נו|נם|נן|נותיה|נותיהן)(?![א-ת])")
_LETTER = re.compile(r"(?<![A-Za-z])[a-z](?![A-Za-z])")
_THE_SOLUTION = re.compile(r"(?<![א-ת])[וש]?הפתרון(?![א-ת])")


def _equation(span, grade):
    """(letter, lhs, rhs) of a printed equation in one letter, such as "x + 7 = 12"; else None."""
    if span["kind"] != "formula":
        return None
    from compact_authoring import RELATION, expression
    pieces = RELATION.split(span["notation"])
    if len(pieces) != 3 or pieces[1] != "=":
        return None
    letters = {letter for piece in (pieces[0], pieces[2]) for letter in _LETTER.findall(piece)}
    if len(letters) != 1:
        return None
    letter = letters.pop()
    sides = [_LETTER.sub("x", piece) for piece in (pieces[0], pieces[2])]
    try:
        return letter, expression(sides[0], grade), expression(sides[1], grade)
    except GeneralSourceError:
        return None


def _rational(tree):
    value = tree if isinstance(tree, dict) and tree.get("type") == "number" else _value(tree)
    return Fraction(value["numerator"], value["denominator"]) if isinstance(value, dict) and value.get("type") == "number" else None


def _solutions(lhs, rhs):
    result = validate_and_solve_task({"kind": "solve", "lhs": lhs, "rhs": rhs, "variable": "x"})["result"]
    if result.get("classification") != "finite":
        return None
    return [Fraction(v["numerator"], v["denominator"]) for v in result["values"] if v.get("type") == "number"]


def _has_symbol(tree):
    return isinstance(tree, dict) and (tree.get("type") == "symbol" or any(
        _has_symbol(arg) for arg in tree.get("args", ()) if isinstance(arg, dict)))


def _at(tree, value):
    """The value of one side of the printed equation at x = value."""
    if not _has_symbol(tree):
        return _rational(tree)
    solved = validate_and_solve_task({"kind": "substitute", "expression": tree,
                                      "values": {"x": number(value.numerator, value.denominator)}})
    return _rational(solved["result"]["value"])


_HOLDS = {"eq": lambda a, b: a == b, "ne": lambda a, b: a != b, "lt": lambda a, b: a < b,
          "le": lambda a, b: a <= b, "gt": lambda a, b: a > b, "ge": lambda a, b: a >= b}


def _solution_claim(prompt, sentence, task, result, form, grade):
    """A yes/no question about the solution of a printed equation in one letter, or None.

    Three readings, each decided from the print: "is [[5]] a solution of
    [[x + 7 = 12]]?" (the value substituted into both sides), "is the solution
    of [[5x = 45]] greater than [[8]]?" (the one solution against the printed
    number) and "do [[x + 4 = 10]] and [[2x = 12]] have the same solution?"
    (the two solutions). The typed claim must say the same thing: its relation,
    and sides whose values are those of the print. Anything else is None, and
    the caller refuses the question as before.
    """
    if not _SOLUTION_WORD.search(sentence) or _NEGATION.search(sentence) or _WRONG.search(sentence):
        return None
    if task.get("relation") not in _HOLDS:
        return None
    equations, numbers = [], []
    for span in prompt:
        if span["kind"] == "text":
            continue
        equation = _equation(span, grade)
        if equation is not None:
            equations.append(equation)
            continue
        tree = _closed(span, grade)
        if tree is None or tree.get("type") != "number":
            return None
        numbers.append(Fraction(tree["numerator"], tree["denominator"]))
    typed = [_rational(task["left"]), _rational(task["right"])]
    if None in typed:
        return None
    cue = _relation_word(sentence.replace("@", " "))
    try:
        if len(equations) == 1 and len(numbers) == 1 and (cue is None or cue[3]):
            # Is the printed number a solution? Both sides at that value.
            _, lhs, rhs = equations[0]
            if _THE_SOLUTION.search(sentence):
                # "Is the solution 3?" reads as "is 3 the only solution": only an equation with one solution.
                found = _solutions(lhs, rhs)
                if not found or len(found) != 1:
                    return None
            printed = [_at(lhs, numbers[0]), _at(rhs, numbers[0])]
            if None in printed:
                return None
            relation, agrees = "eq", sorted(typed) == sorted(printed)
            holds = printed[0] == printed[1]
        elif len(equations) == 1 and len(numbers) == 1 and cue and cue[0] in _HOLDS and not cue[3]:
            # Is the one solution in this relation to the printed number?
            _, lhs, rhs = equations[0]
            found = _solutions(lhs, rhs)
            if not found or len(found) != 1:
                return None
            relation, pair = cue[0], [found[0], numbers[0]]
            agrees = typed == (pair[::-1] if task["relation"] == _MIRROR.get(relation) else pair)
            if task["relation"] == _MIRROR.get(relation):
                relation = task["relation"]
                pair = pair[::-1]
            holds = _HOLDS[relation](*pair)
        elif len(equations) == 2 and not numbers and cue and cue[0] in ("eq", "ne") and not cue[3]:
            # Do the two printed equations have the same solution?
            found = [_solutions(lhs, rhs) for _, lhs, rhs in equations]
            if any(not row or len(row) != 1 for row in found):
                return None
            relation, pair = cue[0], [found[0][0], found[1][0]]
            agrees = sorted(typed) == sorted(pair)
            holds = _HOLDS[relation](*pair)
        else:
            return None
    except (MathTaskError, GeneralSourceError, KeyError, TypeError, ZeroDivisionError):
        return None
    # The print decides; the typed claim has to say the same thing.
    if task["relation"] != relation or not agrees or holds != result["holds"]:
        _mismatch("The typed claim is not the printed question about the solution")
    sides = [task["left"], task["right"]]
    return Decision(holds, form, _steps(sides, result),
                    {"rule": "solution_claim", "relation": task["relation"], "holds": holds, "bound": "print",
                     "equations": len(equations)})


def bind_decision(question, item, solved, grade):
    """Tie a decided claim to the printed question and return the printable decision.

    None for any other task. Raises when the item is not a yes/no question
    about one decidable relation, or when the typed claim is not that question.
    """
    task, result = solved["question"], solved.get("result", {})
    if task.get("kind") != "decide" or result.get("type") != "decision":
        return None
    prompt, intro = item["prompt"], question["intro"]
    text, segments = _layout(prompt)
    intro_text, _ = _layout(intro)
    form, start, stop, judged = _question_sentence(text, intro_text)
    sentence = judged[start:stop]
    statements = [_printed_statement(span, grade) for span in prompt]
    if any(statement is False for statement in statements):
        claim = _solution_claim(prompt, sentence, task, result, form, grade)
        if claim is not None:
            return claim
        _refuse_kind("A printed relation with a blank or a letter cannot be decided")
    operations = [tree for span in prompt if (tree := _closed(span, grade)) is not None and tree.get("type") == "operation"]
    shared = intro + _table_spans(question)
    visible = (visible_numbers(prompt) | visible_numbers(shared)
               | word_numbers(text) | word_numbers(intro_text))
    leaves = task_numbers(task)
    printed_text = text + " " + intro_text + " ".join(span.get("notation", "") for span in prompt + shared)
    if "%" in printed_text or "אחוז" in printed_text:
        # A printed percent brings its hundred with it.
        visible = visible | {Fraction(100)}
    statements = [statement for statement in statements if statement]
    if statements:
        # The question is whether the one printed statement is right. Its
        # truth comes from the print; the typed claim has to agree with it.
        cue = _relation_word(sentence.replace("@", " "))
        bare = not re.sub(r"האם|אם|בדקו|קבעו|החליטו|בררו|זה|זו|כי|[@\s.,:?!־-]", "", sentence)
        if len(statements) != 1 or operations or not (bare or (cue and cue[3])):
            _refuse_kind("Ask whether the one printed statement is right, with nothing else to decide in the item")
        relation, left, right = statements[0]
        printed = validate_and_solve_task({"kind": "decide", "relation": relation, "left": left, "right": right})["result"]
        if printed["holds"] != result["holds"] or not _shown(leaves, visible):
            _mismatch("The typed claim is not the printed statement")
        return Decision(printed["holds"], form, _steps([left, right], printed),
                        {"rule": "printed_statement", "relation": relation, "left": left, "right": right,
                         "holds": printed["holds"], "bound": "print"})
    cue = _relation_word(sentence.replace("@", " "))
    if cue is None:
        _refuse_kind("The question does not ask about one relation that can be decided")
    relation, place, divisor, weak = cue
    place += start
    typed = task["relation"]
    listed = typed in ("in", "not_in")
    left = task["left"]
    others = task["values"] if listed else [task["right"]]
    if divisor is not None:
        # "זוגי" names the divisor two without printing it.
        if typed != relation or others != [number(divisor)]:
            _mismatch("An even or odd question is a divisibility by two")
        leaves = _numbers(left, set())
    if not _shown(leaves, visible):
        _mismatch("The typed claim uses a number that the question does not print")
    stated = prompt
    if not _printed_numbers(prompt):
        # An item without numbers asks about the group's story, and then about all of it.
        if question.get("table"):
            _mismatch("A question about a table has to print the numbers that it compares")
        stated = intro
        operations = [tree for span in intro if (tree := _closed(span, grade)) is not None and tree.get("type") == "operation"]
    for entry in _printed_numbers(stated):
        if not _used(entry, leaves):
            _mismatch("The typed claim leaves out a number that the item prints")
    sides = [left, *others]
    if not all(_occurs(tree, sides) for tree in operations):
        _mismatch("The typed claim leaves out a calculation that the item prints")
    # Where the sentence names its quantities, the typed sides must have their
    # values: the verdict is then the verdict of the print. Otherwise the sides
    # are built from a story, and only the use of its numbers can be checked.
    named = _quantities(_window(segments, start, stop), grade)
    bound = "story"
    if relation in ("eq", "ne") and not listed:
        if typed != relation:
            _mismatch("The typed relation is not the one that the question asks about")
        # "האם התוצאות שוות?" speaks about the quantities printed before it,
        # in the item or, for an item without numbers, in the group's story.
        if not named:
            named = _quantities(prompt, grade) or ([] if question.get("table") else _quantities(intro, grade))
        if len(named) == 2 and None not in named:
            if not _has_values(sides, named, ordered=False):
                _mismatch("The typed sides are not the two printed quantities")
            bound = "print"
        elif len(named) == 1 and None not in named:
            if not any(_has_values([side], named, ordered=True) for side in sides):
                _mismatch("No typed side is the printed quantity")
    elif divisor is not None:
        if len(named) == 1 and None not in named:
            if not _has_values([left], named, ordered=True):
                _mismatch("The typed number is not the printed quantity")
            bound = "print"
    else:
        before = _window(segments, 0, place)
        after = _window(segments, place, stop)
        first, second = [left], others
        if typed == _MIRROR.get(relation) and not listed:
            first, second = others, [left]
        elif typed != relation:
            _mismatch("The typed relation is not the one that the question asks about")
        _ordered(before, after, first, second, shared, visible, grade, listed)
        ahead, behind = _quantities(_window(segments, start, place), grade), _quantities(after, grade)
        checks = [(first, ahead)] + ([] if listed else [(second, behind)])
        exact = [(trees, quantities) for trees, quantities in checks if len(quantities) == 1 and None not in quantities]
        if exact and not _has_values([trees[0] for trees, _ in exact], [quantities[0] for _, quantities in exact], ordered=True):
            _mismatch("A typed side is not the printed quantity on its side of the relation word")
        if len(exact) == len(checks):
            bound = "print"
    return Decision(result["holds"], form, _steps([left] if listed else sides, result),
                    {"rule": "printed_question", "relation": typed, "holds": result["holds"],
                     "weak": weak, "bound": bound, "sides": sides})


def _ordered(before, after, first, second, shared, visible, grade, listed):
    """What stands before the relation word is the first side; what follows it is the second."""
    implied = visible & {Fraction(100)}
    lead = set().union(*(_numbers(tree, set()) for tree in first))
    tail = set().union(*(_numbers(tree, set()) for tree in second))
    later = visible_numbers(after)
    if listed and not later:
        # The list is printed once for the group; the item prints only the value.
        later = visible_numbers(shared)
        if any(tree.get("type") != "number" for tree in second):
            _mismatch("The typed list is not the printed list")
    if listed and tail != later:
        _mismatch("The typed list is not the printed list")
    # The first side may also use the numbers of the group's story; the
    # second side is what the sentence names after its relation word.
    if not _shown(lead, (visible - later) | visible_numbers(before) | implied) or not _shown(tail, later | implied):
        _mismatch("The typed sides are not in the printed order")
    for entry in _printed_numbers(before):
        if not _used(entry, lead):
            _mismatch("A number before the relation word belongs to the first side")
    for entry in _printed_numbers(after):
        if not _used(entry, tail):
            _mismatch("A number after the relation word belongs to the second side")
    for spans, trees in ((before, first), (after, second)):
        for span in spans:
            tree = _closed(span, grade) if span["kind"] != "text" else None
            if tree is not None and tree.get("type") == "operation" and not _occurs(tree, trees):
                _mismatch("A printed calculation is on the other side of the typed claim")


# -------------------------------------------------------------- label and open
_PRODUCTION = re.compile(
    r"(?<![א-ת])ו?(?:צי?ירו|שרטטו|סרטטו|צבעו|גזרו|קפלו|בנו|הרכיבו|מדדו|המציאו|הציעו|הסבירו|נמקו|תארו|"
    r"(?:תנו|הביאו|כתבו|רשמו) דו?גמ(?:ה|א|אות)|"
    r"(?:כתבו|רשמו|חברו) (?:שאלה|בעיה|בעיית|סיפור|תרגיל|משפט)(?: [א-ת]+){0,3} משלכם)(?![א-ת])")
# Final letters change before a possessive ending ("היקף", "היקפו"), so both forms are listed.
_QUANTITY = (r"סכו[םמ]|הפרש|מכפל[הת]|מנ[הת]|תוצא[הת]|ער[ךכ]|הי?ק[ףפ]|שטח|נפח|או?ר[ךכ]|רו?חב|גו?בה|מספר|"
             r"שארית|ממוצע|חציו[ןנ]|שכיח|טווח|מחיר|עוד[ףפ]|משקל|מרח[קק]|זמ[ןנ]")
_ASKS_NUMBER = re.compile(
    r"(?<![א-ת])ו?(?:כמה|בכמה|לכמה|חשבו|פתרו|השלימו|עגלו|פשטו|צמצמו|"
    r"מ(?:ה|הו|הי|הם|הן)\s+ה?(?:" + _QUANTITY + r")[והםן]{0,2}|מצאו את ה?(?:" + _QUANTITY + r")[והםן]{0,2})(?![א-ת])")
_POINTS = "\u05b0-\u05bc\u05c1\u05c2\u05c7"
_LABEL = re.compile("[א-ת][א-ת" + _POINTS + "־׳״'\" -]{0,38}[א-ת" + _POINTS + "׳']|[א-ת]")
_NOT_A_LABEL = frozenset((
    "כן", "לא", "נכון", "לא נכון", "שגוי", "שגויה", "אמת", "שקר",
    "גדול", "גדולה", "קטן", "קטנה", "שווה", "שווים", "שוות", "גדול יותר", "קטן יותר", "גדולה יותר", "קטנה יותר",
    "נימוק", "הוכחה", "לפי השרטוט", "ייתכנו תשובות נוספות",
))


def _words(spans):
    return _layout(spans)[0]


def _has_formula_blank(spans):
    return any(span["kind"] == "formula" and "___" in span["notation"] for span in spans)


def asks_for_number(question, item):
    """The printed request has an answer that the kernel can key: a quantity, a blank in a formula, a yes/no."""
    from printed_tasks import yes_no_question
    prompt = _words(item["prompt"])
    return bool(_ASKS_NUMBER.search(prompt) or _has_formula_blank(item["prompt"])
                or yes_no_question(prompt) or _TRUE_FALSE.search(prompt))


def is_production(question, item):
    """The pupil is asked to draw, build, measure, explain or invent something."""
    return bool(_PRODUCTION.search(_words(item["prompt"])) or _PRODUCTION.search(_words(question["intro"])))


def check_open(question, item, grade):
    """An item without a key is a production task and nothing that could be keyed."""
    if grade > 6:
        _refuse_kind("An item without a key exists only in the elementary skill; use review in middle school")
    if not is_production(question, item):
        _refuse_kind("Only a drawing, a construction, an explanation or the pupil's own example can have no key")
    if ("?" in _words(item["prompt"]) or asks_for_number(question, item)
            or _ASKS_NUMBER.search(_words(question["intro"]))):
        _refuse_kind("The item also asks a question; give its result a computed answer, or ask only for the production")


# A naming question names what it asks for. After "איזה" these nouns ask for a
# number, a calculation or a choice between calculations, which the kernel keys.
# "אילו" is left out: it also opens a condition ("אילו הייתה הזמנה ...").
_COMPUTED_NOUN = (r"מספר(?:ים)?|תרגיל(?:ים)?|ביטוי(?:ים)?|תוצא(?:ה|ות)|סכום|הפרש|מכפלה|מנה|פעול(?:ה|ות)|חיבור|חיסור|כפל|"
                  r"חילוק|שלב(?:ים)?|שגיא(?:ה|ות)|טעו(?:ת|יות)|סוגריים|ערך|שבר(?:ים)?|ספר(?:ה|ות)|משווא(?:ה|ות)|סימן|חלק|"
                  r"כמות|מחיר|או?רך|רו?חב|גו?בה|הי?קף|שטח|נפח|משקל|שעה|גו?דל|מיד(?:ה|ות)|מרחק|גיל|ציון|אחוז(?:ים)?|שיט(?:ה|ות)|"
                  r"דרך|אפשרות|אפשרויות")
_NAMING = re.compile(
    r"(?<![א-ת])(?:[בלמ]?(?:איזה|איזו)\s+(?!(?:" + _COMPUTED_NOUN + r")(?![א-ת]))[א-ת]"
    r"|מ(?:ה|הו|הי)\s+ה?(?:שם|סוג)(?![א-ת])|מה\s+שמ[והםן](?![א-ת])|(?:כיצד|איך)\s+(?:נקרא|קוראים)"
    r"|נקרא(?:ת|ים|ות)?(?:\s+[א-ת]+){0,2}\s*_+|שמ[והםן]\s+_+"
    r"|מי(?![א-ת])(?!\s+מ)|מתי(?![א-ת])|היכן(?![א-ת])|איפה(?![א-ת]))")


def check_label(question, item, grade):
    """A label is a short Hebrew name, for a prompt that itself asks for a name."""
    if grade > 6:
        _refuse_kind("A label answer exists only in the elementary skill; use review in middle school")
    label = item["answer"]["text"]
    plain = " ".join(_unpointed(label).split())
    # Whole words only: the pointed "מְרֻבָּע" and "מְחֻמָּשׁ" are spelled מרבע and מחמש,
    # and stripping a prefix would read them as "from a quarter" and "from five".
    counts = any(word.lstrip("ו") in _NUMBER_WORDS or word.lstrip("ו") in _PART_WORDS or word in ("אחד", "אחת")
                 for word in re.findall(r"[א-ת]+", plain))
    if (not _LABEL.fullmatch(label) or label != label.strip() or len(plain.split()) > 4
            or plain in _NOT_A_LABEL or counts):
        _refuse_kind("A label is one to four Hebrew words that name something; a number, a comparison or a "
                     "yes/no needs a computed answer")
    prompt = item["prompt"]
    calculation = any((tree := _closed(span, grade)) is not None and tree.get("type") == "operation" for span in prompt)
    if (asks_for_number(question, item) or is_production(question, item) or blank_count(prompt) > 1 or calculation
            or not _NAMING.search(_words(prompt))):
        _refuse_kind("Only a prompt that asks for a name takes a label ('איזה מצולע...?', '... נקרא ___', 'מה שם...?', "
                     "'באיזה יום...?'); a quantity, a calculation or a choice between calculations has a computed answer")


def refuse_dummy_key(question, item, solved, grade):
    """A drawing or a construction is never keyed by a number.

    A request to write an expression is bound or refused by printed_intent,
    and an item that also asks a question keeps its computed answer.
    """
    result = solved.get("result", {})
    if grade > 6 or result.get("type") != "expression" or solved["question"].get("kind") == "figure_measure":
        return
    prompt = _words(item["prompt"])
    if not is_production(question, item) or "?" in prompt or _has_formula_blank(item["prompt"]):
        return
    if _ASKS_NUMBER.search(prompt) or _ASKS_NUMBER.search(_words(question["intro"])):
        return
    from printed_elementary import WRITE_EXPRESSION
    if WRITE_EXPRESSION.search(prompt) or WRITE_EXPRESSION.search(_words(question["intro"])):
        return
    _refuse_kind("A drawing, a construction or an explanation has no number as its key; use the open answer kind")
