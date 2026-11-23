"""Deterministic rewrites of wire worksheet notation that has exactly one reading.

The author model writes each rich field as Hebrew prose with ``[[...]]`` math
islands, and each task field as a compact expression. Many rejected replies use
a spelling that is not in the contract but can only mean one thing. This module
rewrites those spellings into the contract's own form *before* expansion and
validation. It never decides anything mathematical: it does not compute, it
does not pick between readings, and a spelling with two readings is left as it
is, so that validation rejects the question and a reserve can replace it.

Guarantees: pure (the input is never mutated), idempotent, never raises, and a
string that is already in contract form is returned unchanged. Hebrew words are
only moved (a unit out of an island) or, for the elementary unknown, replaced
by the phrase that the letter stands for.

Rules (code, where, example before -> after)

  code               grades  where            before -> after
  -----------------  ------  ---------------  ----------------------------------------
  BIDI_CONTROL       1-9     field, task      embedding/isolate controls removed
  (plain text)       1-9     title, unit      $ABC$ -> ABC; [[100]] -> 100  (codes DOLLAR_MATH, ISLAND_BRACKETS)
  INVISIBLE          1-9     island, task     LRM/RLM/zero-width removed, NBSP -> space
  ISLAND_BRACKETS    1-9     field            ⟦5⟧, 〚5〛, ［［5］］ -> [[5]]
  BRACKET_REPAIR     1-9     field            [[4 + (2 * 3)].  -> [[4 + (2 * 3)]].
                                              [[(___) + 4] * 3 = 21]] -> [[((___) + 4) * 3 = 21]]
  DOLLAR_MATH        1-9     prose            $BM=6$ -> [[BM=6]]; \\(x\\) -> [[x]]
  DOLLAR_STRAY       1-9     prose, island    a lone $ that touches no digit is removed
  LATEX              1-9     island, task     \\frac{1}{2} -> frac(1,2); \\sqrt{9} -> sqrt(9);
                                              \\angle{ABC} -> ∠ABC; \\cdot -> *; ^{2} -> ^2
  SIGN_VARIANT       1-9     island, task     – ‒ － -> -; ∙ ⋅ ✕ -> *; ∶ -> :; ≦ -> ≤; （ -> (
  ROOT_SIGN          1-9     island, task     √49 -> sqrt(49); √(x+1) -> sqrt(x+1)
  SUPERSCRIPT        1-9     island, task     2³ -> 2^3; x² -> x^2; 10⁻² -> 10^(-2)
  VULGAR_FRACTION    1-9     island, task     ½ -> frac(1,2)  (not after a digit: 2½ stays)
                             prose            ½ -> [[frac(1,2)]]
  PLACEHOLDER        1-9     island           ☐ □ ? _ ____ in an operand position -> ___
                             prose            ☐ □ and __ / ____ -> ___
  PUNCTUATION_OUT    1-9     island           [[5 + 3 = 8?]] -> [[5 + 3 = 8]]?
  RESULT_BLANK       1-9     island           [[5 + 3 =]] -> [[5 + 3 = ___]]
  PERCENT_SPACING    1-9     island, prose    25 % -> 25%; [[%25]] -> [[25%]]; [[25]] % -> [[25%]]
  LEADING_DOT        1-9     island, task     .5 -> 0.5
  DEGREE_SIGN        1-9     island, prose    90º, 90˚ -> 90°; from grade 5: [[90]]° -> [[90°]]
  UNIT_OUT           1-9     island           [[12.50 ₪]] -> [[12.50]] ₪; [[5 ס״מ]] -> [[5]] ס״מ
  HEBREW_ISLAND      1-9     island           [[תיכון]] -> תיכון
  WHOLE_FORMULA      1-9     field            a field that is only a formula: 3 < x < 17. -> [[3 < x < 17]].
  SCHOOL_OPERATOR    1-6     island, task     324x15 -> 324 x 15; 1,845:15 -> 1,845 : 15;
                                              25%x80 -> 25% x 80; 12÷4 -> 12 : 4
  ELEMENTARY_UNKNOWN 1-6     question         [[x : 5 = 8]] -> [[___ : 5 = 8]];
                                              מצאו את [[x]] -> מצאו את המספר החסר
  GEOMETRY_SIGN      7-9     island, prose    ∡ABC -> ∠ABC; ΔABC -> △ABC; AB || CD -> AB ∥ CD; ⟂ -> ⊥
  DEGREE_WORD        7-9     prose            ∠ABC = 50 מעלות -> ∠ABC = 50°
  GEOMETRY_ISLAND    7-9     prose            ∠ABC = 40° -> [[∠ABC = 40°]]; △ABC -> [[△ABC]]; AB ⊥ CD -> [[AB ⊥ CD]]
  NUMBER_LIST        7-9     prose            2, 4, 6 -> [[2]], [[4]], [[6]]
  BARE_FORMULA       7-9     prose            כי 4+6 < 9 -> כי [[4+6 < 9]]; כי 4a > 2a+2b -> כי [[4a > 2a+2b]]
  LABEL_NOUN         7-9     prose            משולש ABC -> משולש [[triangle:ABC]];
                                              צלע AB -> צלע [[segment:AB]]; זווית ABC -> זווית [[angle:ABC]];
                                              נקודה A -> נקודה [[point:A]]; מרובע ABCD -> [[polygon:ABCD]];
                                              AD הוא תיכון -> [[segment:AD]] הוא תיכון
  TYPED_RELATION     7-9     field            [[angle:ABC]] = [[50°]] -> [[∠ABC]] = [[50°]]
  TYPED_NAME_INSIDE  7-9     island           [[angle:A + angle:B]] -> [[∠A + ∠B]];
                                              [[angle:DAB = 70]] מעלות -> [[∠DAB = 70°]]
  ANGLE_THREE_LETTER 7-9     question         [[angle:A]], ∠A, זווית A with figure ABCD -> angle BAD;
                                              also inside a formula: [[∠D = 70°]] -> [[∠ADC = 70°]]
  SIGN_ISLAND        1-9     field            הסימן [[%]] -> הסימן %
  NAMED_VALUES       7-9     island           [[a=1, b=-6, c=9]] -> [[a = 1]], [[b = -6]], [[c = 9]]
  FIGURE_WINDOW      7-9     figure           a coordinate window that leaves out a point or passes 10 ->
                                              the points' range with a margin of 1, inside -10..10
  DECIDE_WRAPPER     1-9     answer           {"kind": "decide", relation, left, right} with the unit on the
                                              item -> {"kind": "computed", "task": {...}, "unit": ""}

Deliberately not rewritten (two readings, or not printable): 3,5 (decimal or
list), 7:30 and every colon in ratio and measurement topics (time or ratio),
a lone range 5–10, 2½ (mixed number), 3_8 (digit blank), 3x = 12 in grades 1-6
(needs an operator), a letter that occurs twice or two letters in one formula,
a mention of the unknown that is part of other mathematics (x+2), a
one-letter angle without a figure that fixes its three-letter name, a capital
label with no Hebrew noun before it, and bare mathematics in elementary prose.

The degree sign stays inside the island: outside it the sign would print on
the wrong side of the number in a right-to-left line. A unit or a currency
sign goes outside, where Hebrew order puts it after the number.

An unspaced division in a task ("48:6") is rewritten only when each colon
stands between two plain numbers that divide exactly. A typed task is the
answer key, and until the key can state a remainder an inexact division such
as "13:4" would print a fraction.
"""
from __future__ import annotations

from copy import deepcopy
from fractions import Fraction
import json
import re

MAX_ISLAND = 220
MAX_FIELD = 2400
MAX_NOTE = 240

HEB = "א-ת"
NIQ = "\u05b0-\u05bc\u05c1\u05c2\u05c7"
_HEBREW = re.compile(f"[{HEB}]")
_ISLAND = re.compile(r"\[\[([^\[\]]*)\]\]")
_SEGMENT = re.compile(r"(\[\[[^\[\]]*\]\])")

_BIDI = re.compile("[\u202a-\u202e\u2066-\u2069]")
_INVISIBLE = re.compile("[\u200b\u200e\u200f\u2060\ufeff\u061c]")
_ODD_SPACE = re.compile("[\u00a0\u2007\u2009\u200a\u202f]")

_NUM = r"(?:[1-9][0-9]{0,2}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?"
_PLAIN_NUMBER = re.compile(r"[-−]?[0-9]+(?:\.[0-9]+)?")

_SIGNS = str.maketrans({
    "\uff0b": "+", "\uff1d": "=", "\uff08": "(", "\uff09": ")", "\uff05": "%", "\uff1a": ":",
    "\uff0f": "/", "\uff0a": "*", "\uff1c": "<", "\uff1e": ">", "\u2236": ":", "\u2215": "/",
    "\u2044": "/", "\u2266": "≤", "\u2a7d": "≤", "\u2267": "≥", "\u2a7e": "≥",
    "\u2219": "*", "\u22c5": "*", "\u2022": "*", "\u2715": "*", "\u2716": "*", "\u2a2f": "*",
    "\u2217": "*",
})
_DASHES = "\u2010\u2011\u2012\u2013\u2014\u2015\ufe63\uff0d"
_DASH = re.compile(f"[{_DASHES}]")
_LONE_RANGE = re.compile(rf"\s*{_NUM}\s*[{_DASHES}]\s*{_NUM}\s*")

_SUPERSCRIPT = re.compile(r"(?<=[0-9A-Za-z)_])(⁻?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)")
_SUPER_DIGITS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")

_ROOT_GROUP = re.compile(r"√\s*\(")
_ROOT_NUMBER = re.compile(rf"√\s*({_NUM})(?![0-9A-Za-z(.]|,[0-9])")
_ROOT_SYMBOL = re.compile(r"√\s*([a-z])(?![A-Za-z0-9(])")

_VULGAR = {
    "½": (1, 2), "⅓": (1, 3), "⅔": (2, 3), "¼": (1, 4), "¾": (3, 4), "⅕": (1, 5), "⅖": (2, 5),
    "⅗": (3, 5), "⅘": (4, 5), "⅙": (1, 6), "⅚": (5, 6), "⅐": (1, 7), "⅛": (1, 8), "⅜": (3, 8),
    "⅝": (5, 8), "⅞": (7, 8), "⅑": (1, 9), "⅒": (1, 10),
}
_VULGAR_CHAR = re.compile("[" + "".join(_VULGAR) + "]")

_BOX = re.compile("[☐□\u25a2\u25fb\u25fd\u2b1c\u2395\u25ad\u25af]")
_UNDERSCORES = re.compile(r"(?<![A-Za-z0-9_])_+(?![A-Za-z0-9_])")
_QUESTION_MARKS = re.compile(r"[?\uff1f]+")
_OPERAND_END = r"0-9A-Za-z)_%°"
_BEFORE_OPERAND = re.compile(r"(?:^|[-+*/:^(=<>≤≥≠−×·÷,])\s*$")
_AFTER_OPERAND = re.compile(r"\s*(?:$|[-+*/:^)=<>≤≥≠−×·÷,])")

_DEGREE_VARIANT = re.compile(r"(?<=[0-9])\s?[\u00ba\u02da\u2218]")
_PERCENT_GAP = re.compile(r"(?<=[0-9])\s+%(?![0-9A-Za-z])")
_PERCENT_FIRST = re.compile(rf"\s*%\s*({_NUM})\s*")
_LEADING_DOT = re.compile(r"(?<![0-9.A-Za-z_)\]])\.(?=[0-9])")

_LEFT = r"(?:(?<=[0-9)%])|(?<=___))"
_RIGHT = r"(?=[0-9(]|___)"
_TIMES_LETTER = re.compile(_LEFT + r"\s*[xX\u0445\u0425]\s*" + _RIGHT)
_COLON = re.compile(_LEFT + r"\s*:\s*" + _RIGHT)
_DIVISION_SIGN = re.compile(r"\s*÷\s*")
_LONE_COLON = re.compile(rf"\s*({_NUM})\s*:\s*({_NUM})\s*")
_TASK_DIVISION = re.compile(rf"(?<![0-9.,)_%])({_NUM})\s*:\s*({_NUM})(?![0-9.,(_%]|\s*[:^])")
_CLOCK = re.compile(r"(?<![0-9.,])([0-9]{1,2})\s*:\s*([0-5][0-9])(?![0-9.,])")
# The colon is a ratio or a clock time in these pinned elementary domains.
_COLON_DOMAINS = frozenset(("ratios", "measurement"))

_UNIT_WORD = rf"[{HEB}{NIQ}]+(?:[\"'״׳][{HEB}{NIQ}]*)?"
_UNIT_TAIL = re.compile(rf"(.*[0-9_)%])\s*((?:₪|{_UNIT_WORD}(?:\s{_UNIT_WORD})?))\s*", re.S)
_CURRENCY_HEAD = re.compile(r"\s*₪\s*([^₪]*[0-9_)%])\s*", re.S)
_HEBREW_ONLY = re.compile(rf"[{HEB}{NIQ}\s־'\"״׳-]+")
_TRAILING_MARKS = re.compile(rf"(.*[{_OPERAND_END}])(\s*[?!\uff1f]+|[.,;])\s*", re.S)
_RELATION = re.compile(r"!=|<=|>=|[=<>≤≥≠]")
_OPEN_EQUALITY = re.compile(rf"(.*[{_OPERAND_END}])\s*=\s*", re.S)

_ANGLE_VARIANT = re.compile("[\u2221\u2222]\\s?(?=[A-Z]{3}(?![A-Za-z0-9]))")
_TRIANGLE_VARIANT = re.compile("[\u0394\u2206\u25b2\u25b5\u22bf]\\s?(?=[A-Z]{3}(?![A-Za-z0-9]))")
_PARALLEL_VARIANT = re.compile(r"(?<=[A-Z]{2})\s*(?:\|\||\u2016)\s*(?=[A-Z]{2}(?![A-Za-z0-9]))")
_PERP_VARIANT = re.compile("\u27c2")
_DEGREE_WORD = re.compile(r"(∠\s*[A-Z]{3}\s*=\s*[0-9]{1,3}(?:\.[0-9]{1,4})?)\s+מעלות(?![א-ת])")

_LIST_NUMBER = rf"[-−]?{_NUM}%?"
_NUMBER_LIST = re.compile(
    rf"(?<![\w.,:;/^=<>+*%$#@(\-−\u2013־]){_LIST_NUMBER}(?:,\s+{_LIST_NUMBER})+(?![\w/^=<>+*°)]|[.,:][0-9])")

_PREFIX = rf"(?<![{HEB}])[ובלכמשה]{{0,3}}"
_JOIN = r"[־ -]"
_LABEL_END = r"(?![A-Za-z0-9_'’′°]|\s*[=<>≤≥≠+*/^⊥∥]|\s*\(\s*[-−]?[0-9]|\s*-\s*[A-Z0-9])"
_LABEL_NOUNS = (
    ("triangle", 3, 3, rf"משולש(?:ים)?(?:\s+(?:שווה|שוות|ישר|חד|קהה|שונה){_JOIN}ה?(?:שוקיים|צלעות|זווית|זוויות))?"),
    ("angle", 3, 3, r"זווי(?:ת|ות)(?:\s+ה?(?:ראש|בסיס|חיצונית|פנימית|ישרה|חדה|קהה))?"),
    ("segment", 2, 2, rf"(?:קטע(?:ים)?|צלע(?:ות)?|שוק(?:יים)?|בסיס|גובה|תיכון|אלכסון|ניצב|יתר|מיתר|קוטר|רדיוס|אנך|חוצ[הי]{_JOIN}ה?זווית)"),
    ("point", 1, 1, r"(?:נקוד(?:ה|ת|ות)|קודקוד(?:ים)?)"),
    ("polygon", 4, 8, r"(?:מרובע|מלבן|ריבוע|טרפז|מקבילית|מעוין|דלתון|מצולע|מחומש|משושה)"),
)
_LABEL_RULES = tuple(
    (kind, low, high, re.compile(rf"({_PREFIX}{noun}\s+)([A-Z]{{{low},{high}}}){_LABEL_END}"))
    for kind, low, high, noun in _LABEL_NOUNS)
_LABEL_MORE = re.compile(rf"((?:\s+ו[־-]?|,\s+|\s+או\s+))([A-Z]{{1,8}}){_LABEL_END}")
_ISLAND_NOUN_RULES = tuple(
    (kind, low, high, re.compile(rf"({_PREFIX}{noun}\s+)\[\[([A-Z]{{{low},{high}}})\]\]"))
    for kind, low, high, noun in _LABEL_NOUNS)
_TYPED = r"\[\[(angle|segment|triangle|point|polygon):([A-Z]{1,8})\]\]"
_REL = r"\s*[=<>≤≥≠]\s*"
_TYPED_LEFT = re.compile(_TYPED + rf"(?={_REL}\[\[)")
_TYPED_RIGHT = re.compile(rf"(?<=\]\])({_REL})" + _TYPED)

_ANGLE_NAME = r"∠\s*[A-Z]{3}(?![A-Za-z0-9_])"
_DEGREES = r"[0-9]{1,3}(?:\.[0-9]{1,4})?\s*°"
_GEOMETRY_ATOM = re.compile(
    rf"(?<![A-Za-z0-9_=<>+*/^°∠△⊥∥\[])(?:{_ANGLE_NAME}(?:\s*=\s*(?:{_ANGLE_NAME}|{_DEGREES}))?"
    rf"|[A-Z]{{2}}\s*[⊥∥]\s*[A-Z]{{2}}(?![A-Za-z0-9_])|△\s*[A-Z]{{3}}(?![A-Za-z0-9_])|{_DEGREES})"
    rf"(?!\s*[=<>+*/^°∠△⊥∥\]]|[A-Za-z0-9_])")
_ROLE_LABEL = re.compile(
    rf"(?<![A-Za-z0-9_\[:=<>+*/^∠△⊥∥])([A-Z]{{2}})(?=\s+(?:הוא|היא)\s+(?:גם\s+)?ה?"
    rf"(?:גובה|תיכון|חוצ[הי]{_JOIN}ה?זווית|אנך|צלע|קטע|אלכסון|יתר|ניצב|בסיס|שוק|מיתר|קוטר|רדיוס)(?![{HEB}]))")
_BARE_OPERAND = rf"[-−]?(?:{_NUM}%?[xyab]?|[xyab])"
_BARE_OPERATOR = r"\s*(?:<=|>=|!=|[-+*×·−=<>≤≥≠])\s*"
_BARE_FORMULA = re.compile(
    rf"(?:(?<![\w.,:;/^$#@(\[\-−\u2013־'\"״׳])|(?<=[{HEB}][־-])){_BARE_OPERAND}(?:{_BARE_OPERATOR}{_BARE_OPERAND})+"
    rf"(?![\w/^°(\[%]|[.,:][0-9])")
_WHOLE_FORMULA = re.compile(r"[0-9A-Za-z\s+\-−\u2013*/:^()=<>≤≥≠.,%°√_×·÷π☐□]+")
_FORMULA_EVIDENCE = re.compile(r"[=<>≤≥≠+*×÷^√☐□]|___|[0-9)]\s*[xX]\s*[0-9(]")
_LATIN_WORD = re.compile(r"[A-Za-z]{2,}")

_SINGLE_LETTER = re.compile(r"(?<![A-Za-z])[a-z](?![A-Za-z])")
_PURE_ARITHMETIC = re.compile(r"[0-9\s+\-−*/:x×·÷^()=<>≤≥≠.,%_!]+")
_APPOSITION = re.compile(rf"(?:הנעלם|המשתנה|האות|המספר החסר|המספר הנעלם|הערך החסר)\s*$")
_HEBREW_HYPHEN = re.compile(rf"[{HEB}][־-]\s*$")
_MISSING_NUMBER = "המספר החסר"
_MISSING_NUMBER_POINTED = "הַמִּסְפָּר הֶחָסֵר"
# A typed name is a whole island of its own. Inside a larger formula an angle
# or a triangle is written with its sign, as the formula grammar reads it.
_TYPED_ALONE = re.compile(r"\s*(?:point|segment|triangle|angle|polygon):[A-Z]{1,8}\s*")
_TYPED_INSIDE = re.compile(r"(?<![A-Za-z])(angle|triangle):([A-Z]{1,3})(?![A-Za-z0-9_])")
# An angle set equal to a bare number is measured in degrees; a following מעלות repeats the sign.
_ANGLE_DEGREES = re.compile(
    r"\[\[(∠\s*[A-Z]{1,3}\s*=\s*[0-9]{1,3}(?:\.[0-9]{1,4})?)\s*(°?)\]\](\s+מעלות(?![א-ת]))?")
_NAMED_VALUE = r"\s*[a-z]\s*=\s*[-−]?[0-9]+(?:\.[0-9]+)?\s*"
_NAMED_VALUES = re.compile(_NAMED_VALUE + r"(?:," + _NAMED_VALUE + r")+")
_ANGLE_INSIDE = re.compile(r"∠\s*([A-Z])(?![A-Za-z0-9_])")
_ANGLE_ISLAND = re.compile("\\[\\[(angle:|[∠\u2221\u2222]\\s*)([A-Z])\\]\\]")
_ANGLE_SIGN = re.compile("[∠\u2221\u2222]\\s*([A-Z])(?![A-Za-z0-9_'’′])")
_ANGLE_WORD = re.compile(rf"({_PREFIX}זווית\s+)([A-Z])(?![A-Za-z0-9_'’′]|\s*[=<>≤≥≠+*/^(])")

_TASK_FIELDS = ("expression", "left", "right", "lhs", "rhs")


class _Context:
    def __init__(self, grade, topic_id, domain, notes):
        self.grade = grade if type(grade) is int else 0
        self.topic_id = topic_id if isinstance(topic_id, str) else None
        self.domain = domain if isinstance(domain, str) else None
        self.notes = notes
        self.path = ""

    def note(self, code, before, after):
        if before != after:
            self.notes.append({"code": code, "path": self.path,
                               "before": before[:MAX_NOTE], "after": after[:MAX_NOTE]})
        return after


# --------------------------------------------------------------------- LaTeX

class _Unsupported(Exception):
    pass


_TEX_WORDS = {
    "cdot": "*", "times": "*", "ast": "*", "div": "÷", "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥",
    "neq": "≠", "ne": "≠", "lt": "<", "gt": ">", "perp": "⊥", "parallel": "∥", "para": "∥",
    "pi": "π", "circ": "°", "degree": "°", "triangle": "△", "tri": "△", "Delta": "△",
    "quad": " ", "qquad": " ", "left": "", "right": "", "displaystyle": "",
    "%": "%", ",": " ", ";": " ", ":": " ", "!": "", " ": " ",
}
_TEX_INTEGER = re.compile(r"[0-9]{1,7}")


def _tex_group(source, index):
    while index < len(source) and source[index] == " ":
        index += 1
    if index >= len(source) or source[index] != "{":
        raise _Unsupported
    depth, start = 0, index + 1
    for position in range(index, len(source)):
        if source[position] == "{":
            depth += 1
        elif source[position] == "}":
            depth -= 1
            if depth == 0:
                return source[start:position], position + 1
    raise _Unsupported


def _tex(source, depth=0):
    if depth > 6:
        raise _Unsupported
    out, index = [], 0
    while index < len(source):
        char = source[index]
        if char == "\\":
            name = re.match(r"\\([A-Za-z]+|.)", source[index:], re.S)
            if not name:
                raise _Unsupported
            word, index = name[1], index + name.end()
            if word in ("frac", "dfrac", "tfrac"):
                top, index = _tex_group(source, index)
                bottom, index = _tex_group(source, index)
                top, bottom = _tex(top, depth + 1).strip(), _tex(bottom, depth + 1).strip()
                if _TEX_INTEGER.fullmatch(top) and _TEX_INTEGER.fullmatch(bottom):
                    out.append(f"frac({top},{bottom})")
                else:
                    out.append(f"({top})/({bottom})")
            elif word == "sqrt":
                if source[index:index + 1] == "[":
                    raise _Unsupported
                inner, index = _tex_group(source, index)
                out.append("sqrt(" + _tex(inner, depth + 1).strip() + ")")
            elif word in ("text", "mathrm", "textrm", "mbox"):
                inner, index = _tex_group(source, index)
                if re.search(r"[\\{}]", inner):
                    raise _Unsupported
                out.append(inner)
            elif word in ("angle", "measuredangle"):
                rest = source[index:].lstrip(" ")
                if rest.startswith("{"):
                    inner, index = _tex_group(source, index)
                    out.append("∠" + _tex(inner, depth + 1).strip())
                else:
                    out.append("∠")
            elif word in _TEX_WORDS:
                out.append(_TEX_WORDS[word])
            else:
                raise _Unsupported
        elif char == "^":
            index += 1
            rest = source[index:]
            if rest.startswith("{"):
                inner, index = _tex_group(source, index)
                inner = _tex(inner, depth + 1).strip()
                if inner == "°":
                    out.append("°")
                elif re.fullmatch(r"[0-9]+", inner):
                    out.append("^" + inner)
                else:
                    out.append("^(" + inner + ")")
            elif rest.startswith("\\circ"):
                out.append("°")
                index += 5
            else:
                out.append("^")
        elif char in "{}":
            raise _Unsupported
        else:
            out.append(char)
            index += 1
    return "".join(out)


def _latex(source):
    """Engine notation for a closed LaTeX subset, or None when any markup would remain."""
    try:
        converted = _tex(source)
    except (_Unsupported, RecursionError):
        return None
    if re.search(r"[\\{}$]", converted):
        return None
    return re.sub(r"[ \t]{2,}", " ", converted).strip()


# ----------------------------------------------------------- formula rewrites

def _has_clock(text):
    """7:30, 12:45 or 20:10 can be a time of day; 48:12 cannot."""
    return any(int(match[1]) <= 23 for match in _CLOCK.finditer(text))


def _operand_position(content, start, end):
    return bool(_BEFORE_OPERAND.search(content[:start]) and _AFTER_OPERAND.match(content[end:]))


def _placeholders(content):
    content = _BOX.sub("___", content)

    def mark(match):
        return "___" if _operand_position(content, match.start(), match.end()) else match[0]

    content = _QUESTION_MARKS.sub(mark, content)
    return _UNDERSCORES.sub(lambda m: m[0] if len(m[0]) == 3 else "___", content)


def _vulgar_in_formula(content):
    def replace(match):
        before = content[:match.start()].rstrip()
        after = content[match.end():]
        if (before and before[-1].isdigit()) or (after and after[0].isdigit()):
            return match[0]        # 2½ is a mixed number: no supported spelling.
        n, d = _VULGAR[match[0]]
        return f"frac({n},{d})"
    return _VULGAR_CHAR.sub(replace, content)


def _colon_is_division(content, context, task):
    """An unspaced colon is a school division sign unless it can be a ratio or a time."""
    if context.domain in _COLON_DOMAINS or _has_clock(content):
        return False
    if _LONE_COLON.fullmatch(content) and context.domain is None:
        return False
    if task:
        # A typed task supplies the key. Until the key can state a remainder, an
        # inexact quotient would print a fraction for a division exercise, so
        # every colon must sit between two plain numbers that divide exactly.
        pairs = _TASK_DIVISION.findall(content)
        if len(pairs) != content.count(":"):
            return False
        for dividend, divisor in pairs:
            bottom = Fraction(divisor.replace(",", ""))
            if not bottom or (Fraction(dividend.replace(",", "")) / bottom).denominator != 1:
                return False
    return True


def _school_operators(content, context, task):
    content = _DIVISION_SIGN.sub(" : ", content) if "÷" in content else content
    content = _TIMES_LETTER.sub(" x ", content)
    if ":" in content and _colon_is_division(content, context, task):
        content = _COLON.sub(" : ", content)
    return content


def _formula(content, context, *, task=False):
    """Rewrite one formula that contains no Hebrew. Returns the new formula."""
    note = context.note
    content = note("INVISIBLE", content, _ODD_SPACE.sub(" ", _INVISIBLE.sub("", content)))
    if re.fullmatch(r"\s*\$[^$]*\$\s*", content):
        content = note("DOLLAR_MATH", content, content.strip()[1:-1])
    elif content.count("$") == 1 and not re.search(r"[0-9]\s?\$|\$\s?[0-9]", content):
        content = note("DOLLAR_STRAY", content, content.replace("$", ""))
    if re.search(r"[\\{}]", content):
        converted = _latex(content)
        if converted is None:
            return content        # Markup outside the closed subset: validation rejects it.
        content = note("LATEX", content, converted)
    signs = content.translate(_SIGNS)
    if not _LONE_RANGE.fullmatch(signs):
        signs = _DASH.sub("-", signs)
    content = note("SIGN_VARIANT", content, signs)
    roots = _ROOT_SYMBOL.sub(r"sqrt(\1)", _ROOT_NUMBER.sub(r"sqrt(\1)", _ROOT_GROUP.sub("sqrt(", content)))
    content = note("ROOT_SIGN", content, roots)
    content = note("SUPERSCRIPT", content, _SUPERSCRIPT.sub(
        lambda m: "^" + ("(-" + m[2].translate(_SUPER_DIGITS) + ")" if m[1] else m[2].translate(_SUPER_DIGITS)),
        content))
    content = note("VULGAR_FRACTION", content, _vulgar_in_formula(content))
    if not task:
        content = note("PLACEHOLDER", content, _placeholders(content))
    percent = _PERCENT_GAP.sub("%", content)
    first = _PERCENT_FIRST.fullmatch(percent)
    content = note("PERCENT_SPACING", content, first[1] + "%" if first else percent)
    content = note("LEADING_DOT", content, _LEADING_DOT.sub("0.", content))
    content = note("DEGREE_SIGN", content, _DEGREE_VARIANT.sub("°", content))
    if 1 <= context.grade <= 6:
        content = note("SCHOOL_OPERATOR", content, _school_operators(content, context, task))
    elif context.grade >= 7:
        content = note("GEOMETRY_SIGN", content, _geometry_signs(content))
        if not task and not _TYPED_ALONE.fullmatch(content):
            content = note("TYPED_NAME_INSIDE", content, _TYPED_INSIDE.sub(
                lambda m: {"angle": "∠", "triangle": "△"}[m[1]] + m[2], content))
    return content


def _geometry_signs(text):
    # A one-letter angle keeps its spelling: only a figure can name it (see _three_letter_angles).
    text = _ANGLE_VARIANT.sub("∠", text)
    text = _TRIANGLE_VARIANT.sub("△", text)
    text = _PARALLEL_VARIANT.sub(" ∥ ", text)
    return _PERP_VARIANT.sub("⊥", text)


def _island(content, context):
    """Return the replacement for one ``[[content]]``, brackets included."""
    if len(content) > MAX_ISLAND:
        return "[[" + content + "]]"
    note = context.note
    original = "[[" + content + "]]"
    if _HEBREW.search(content) or "₪" in content:
        if _HEBREW_ONLY.fullmatch(content) and content.strip():
            return note("HEBREW_ISLAND", original, content.strip())
        tail = _UNIT_TAIL.fullmatch(content)
        head = None if tail else _CURRENCY_HEAD.fullmatch(content)
        formula, unit = (tail[1], tail[2]) if tail else (head[1], "₪") if head else (None, None)
        if formula is None or _HEBREW.search(formula) or "₪" in formula or not formula.strip():
            return original
        return note("UNIT_OUT", original, _island(formula.strip(), context) + " " + unit)
    if content.strip() == "%":
        # An island that holds only the percent sign is the sign, in prose.
        return note("SIGN_ISLAND", original, "%")
    if context.grade >= 7 and _NAMED_VALUES.fullmatch(content):
        # [[a=1, b=-6, c=9]] lists three givens: one island each.
        parts = [re.sub(r"\s*=\s*", " = ", part.strip()) for part in content.split(",")]
        return note("NAMED_VALUES", original, ", ".join("[[" + part + "]]" for part in parts))
    content = _formula(content, context)
    marks = _TRAILING_MARKS.fullmatch(content)
    suffix = ""
    if marks:
        # A sentence mark after the last operand belongs to the Hebrew sentence.
        suffix = marks[2].strip()
        note("PUNCTUATION_OUT", "[[" + content + "]]", "[[" + marks[1].rstrip() + "]]" + suffix)
        content = marks[1].rstrip()
    opened = _OPEN_EQUALITY.fullmatch(content)
    if opened and "___" not in content and len(_RELATION.findall(content)) == 1:
        content = note("RESULT_BLANK", content, opened[1] + " = ___")
    return "[[" + content + "]]" + suffix


# ------------------------------------------------------------- field rewrites

def _well_formed(text):
    return not re.search(r"[\[\]]", _ISLAND.sub("", text))


def _mathy(content):
    return bool(content.strip()) and not _HEBREW.search(content) and len(content) <= MAX_ISLAND


def _repair_brackets(text):
    """Apply a bracket repair only when exactly one repair gives balanced islands."""
    if _well_formed(text):
        return text
    candidates = []
    # A closing or an opening bracket was dropped: [[4 + (2 * 3)].
    for pattern in (r"\[\[([^\[\]]*)\](?!\])", r"(?<!\[)\[([^\[\]]*)\]\]"):
        fixed = re.sub(pattern, lambda m: "[[" + m[1] + "]]" if _mathy(m[1]) else m[0], text)
        if fixed != text and _well_formed(fixed):
            candidates.append(fixed)

    # Square brackets used for grouping inside one island: [[(___) + 4] * 3 = 21]].
    def group(match):
        inner = match[1]
        if not _mathy(inner) or not re.search(r"[\[\]]", inner):
            return match[0]
        inner = inner.replace("[", "(").replace("]", ")")
        opened, closed = inner.count("("), inner.count(")")
        if closed == opened + 1:
            inner = "(" + inner
        elif opened == closed + 1:
            inner += ")"
        depth = 0
        for char in inner:
            depth += (char == "(") - (char == ")")
            if depth < 0:
                return match[0]
        return "[[" + inner + "]]" if depth == 0 else match[0]

    fixed = re.sub(r"\[\[((?:[^\[\]]|\[(?!\[)|\](?!\]))*)\]\]", group, text)
    if fixed != text and _well_formed(fixed):
        candidates.append(fixed)
    unique = list(dict.fromkeys(candidates))
    return unique[0] if len(unique) == 1 else text


def _dollars(text, context):
    """Turn $...$ and \\(...\\) in prose into islands; drop a stray dollar sign."""
    def island(match):
        inner = match[1].strip()
        if not inner or _HEBREW.search(inner) or re.search(r"[\[\]]", inner) or len(inner) > MAX_ISLAND:
            return match[0]
        if re.search(r"[\\{}]", inner):
            inner = _latex(inner)
            if inner is None:
                return match[0]
        return "[[" + inner + "]]"

    changed = re.sub(r"\$\$([^$]+)\$\$", island, text)
    changed = re.sub(r"\$([^$]+)\$", island, changed)
    changed = re.sub(r"\\\((.+?)\\\)", island, changed)
    text = context.note("DOLLAR_MATH", text, changed)
    if text.count("$") == 1 and not re.search(r"[0-9]\s?\$|\$\s?[0-9]", text):
        text = context.note("DOLLAR_STRAY", text, text.replace("$", ""))
    return text


def _vulgar_in_prose(text):
    def replace(match):
        before, after = text[:match.start()], text[match.end():]
        if re.search(r"[0-9A-Za-z\[\]]\s?$", before) or re.match(r"[0-9A-Za-z\[\]]", after):
            return match[0]
        n, d = _VULGAR[match[0]]
        return f"[[frac({n},{d})]]"
    return _VULGAR_CHAR.sub(replace, text)


def _label_nouns(text):
    """Type a bare capital label only where the Hebrew noun before it fixes what it names."""
    for kind, low, high, pattern in _LABEL_RULES:
        position, out = 0, []
        while True:
            match = pattern.search(text, position)
            if not match:
                break
            names = match[2]
            if len(set(names)) != len(names):
                out.append(text[position:match.end()])
                position = match.end()
                continue
            out.append(text[position:match.start()] + match[1] + f"[[{kind}:{names}]]")
            position = match.end()
            # A following label of the same length continues the list: הצלעות AB ו־AC.
            while True:
                more = _LABEL_MORE.match(text, position)
                if not more or len(more[2]) != len(names) or len(set(more[2])) != len(more[2]):
                    break
                out.append(more[1] + f"[[{kind}:{more[2]}]]")
                position = more.end()
        out.append(text[position:])
        text = "".join(out)
    return text


def _bare_formulas(text):
    """A run of numbers, operators and relations inside a Hebrew sentence is one formula."""
    def island(match):
        run = match[0]
        signs = re.sub(rf"{_NUM}%?", "", run)
        if not re.search(r"[=<>≤≥≠+*×·]", signs):
            return run            # 5-10 alone can be a range.
        if re.search(r"[xyab]", signs) and not (re.search(r"[0-9]", run) or re.search(r"[=<>≤≥≠]", run)):
            return run
        return "[[" + run + "]]"
    return _BARE_FORMULA.sub(island, text)


def _geometry_islands(text):
    """A token that starts with ∠ or △, or holds ⊥, ∥ or °, is mathematics wherever it stands."""
    def island(match):
        before, after = text[:match.start()].rstrip(), text[match.end():].lstrip()
        if re.search(r"[=<>+*/^°∠△⊥∥−]$", before) or re.match(r"[-=<>+*/^°∠△⊥∥−]", after):
            return match[0]       # Part of a longer formula: left to validation.
        if before.endswith("-") and not _HEBREW_HYPHEN.search(before):
            return match[0]
        return "[[" + match[0] + "]]"
    return _GEOMETRY_ATOM.sub(island, text)


def _outside(text, function):
    """Apply a prose rewrite to the text between islands only."""
    pieces = _SEGMENT.split(text)
    for index in range(0, len(pieces), 2):
        if pieces[index]:
            pieces[index] = function(pieces[index])
    return "".join(pieces)


def _islands(text, context):
    """Rewrite every island. An island can turn into prose (a unit, a Hebrew word)."""
    parts = _SEGMENT.split(text)
    for index in range(1, len(parts), 2):
        parts[index] = _island(parts[index][2:-2], context)
    return "".join(parts)


def _prose(text, context):
    """Rewrite the Hebrew sentence around the islands. Islands are not touched here."""
    note = context.note
    parts = _SEGMENT.split(text)
    for index in range(0, len(parts), 2):
        part = parts[index]
        if not part:
            continue
        blank = _UNDERSCORES.sub(lambda m: m[0] if len(m[0]) in (1, 3) else "___", _BOX.sub("___", part))
        part = note("PLACEHOLDER", part, blank)
        part = note("PERCENT_SPACING", part, _PERCENT_GAP.sub("%", part))
        part = note("DEGREE_SIGN", part, _DEGREE_VARIANT.sub("°", part))
        if context.grade >= 7:
            part = note("GEOMETRY_SIGN", part, _geometry_signs(part))
            part = note("DEGREE_WORD", part, _DEGREE_WORD.sub(r"\1°", part))
            part = note("NUMBER_LIST", part, _NUMBER_LIST.sub(
                lambda m: re.sub(_LIST_NUMBER, lambda n: "[[" + n[0] + "]]", m[0]), part))
            part = note("GEOMETRY_ISLAND", part, _outside(part, _geometry_islands))
            part = note("LABEL_NOUN", part, _outside(
                part, lambda piece: _ROLE_LABEL.sub(r"[[segment:\1]]", _label_nouns(piece))))
            part = note("BARE_FORMULA", part, _outside(part, _bare_formulas))
        part = note("VULGAR_FRACTION", part, _outside(part, _vulgar_in_prose))
        parts[index] = part
    return "".join(parts)


def _across_islands(text, context):
    note = context.note
    text = note("PERCENT_SPACING", text, re.sub(
        r"\[\[(" + _PLAIN_NUMBER.pattern + r")\]\]\s+%(?![0-9A-Za-z])", r"[[\1%]]", text))
    if context.grade >= 5:
        text = note("DEGREE_SIGN", text, re.sub(
            r"\[\[(" + _PLAIN_NUMBER.pattern + r")\]\]\s?°", r"[[\1°]]", text))
    if context.grade >= 7:
        typed = text
        for kind, low, high, pattern in _ISLAND_NOUN_RULES:
            typed = pattern.sub(
                lambda m: m[1] + (f"[[{kind}:{m[2]}]]" if len(set(m[2])) == len(m[2]) else f"[[{m[2]}]]"), typed)
        text = note("LABEL_NOUN", text, typed)
        symbol = {"angle": "∠", "triangle": "△"}
        plain = lambda kind, names: "[[" + symbol.get(kind, "") + names + "]]"
        joined = _TYPED_LEFT.sub(lambda m: plain(m[1], m[2]), text)
        joined = _TYPED_RIGHT.sub(lambda m: m[1] + plain(m[2], m[3]), joined)
        text = note("TYPED_RELATION", text, joined)
        text = note("TYPED_NAME_INSIDE", text, _ANGLE_DEGREES.sub(
            lambda m: m[0] if m[2] and not m[3] else "[[" + m[1] + "°]]", text))
    return text


def _whole_formula(text, context):
    """A field that consists of one formula and nothing else is that formula."""
    body = text.strip()
    marks = re.search(r"[.?!]$", body)
    core = body[:-1].rstrip() if marks else body
    if (not core or len(core) > MAX_ISLAND or not _WHOLE_FORMULA.fullmatch(core)
            or not _FORMULA_EVIDENCE.search(core) or not re.search(r"[0-9]", core)
            or _has_clock(core)):
        return text
    words = _LATIN_WORD.findall(core.replace("sqrt", "").replace("frac", ""))
    if any(not word.isupper() for word in words) or (context.grade <= 6 and words):
        return text
    return context.note("WHOLE_FORMULA", text, "[[" + core + "]]" + (marks[0] if marks else ""))


def _rich_once(text, context):
    note = context.note
    text = note("BIDI_CONTROL", text, _BIDI.sub("", text))
    brackets = (text.replace("\u27e6", "[[").replace("\u27e7", "]]").replace("\u301a", "[[")
                .replace("\u301b", "]]").replace("\uff3b\uff3b", "[[").replace("\uff3d\uff3d", "]]"))
    text = note("ISLAND_BRACKETS", text, brackets)
    text = note("BRACKET_REPAIR", text, _repair_brackets(text))
    if not _well_formed(text):
        return text               # Unbalanced islands have no single reading.
    if "$" in text or "\\(" in text:
        text = _dollars(text, context)
    if not re.search(r"[\[\]$]", text) and not _HEBREW.search(text):
        text = _whole_formula(text, context)
    text = _islands(text, context)
    if not _well_formed(text):
        return text
    return _across_islands(_prose(text, context), context)


def _fixed_point(once, value, context):
    """Apply until nothing changes, so a second call is always a no-op.

    A spelling that keeps changing has no stable reading: it stays as written.
    """
    text, start = value, len(context.notes)
    for _ in range(4):
        changed = once(text, context)
        if changed == text:
            return text
        text = changed
    del context.notes[start:]
    return value


def _rich(value, context):
    if not isinstance(value, str) or not value or len(value) > MAX_FIELD:
        return value
    return _fixed_point(_rich_once, value, context)


def _expression_once(text, context):
    text = context.note("BIDI_CONTROL", text, _BIDI.sub("", text))
    whole = re.fullmatch(r"\s*\[\[([^\[\]]+)\]\]\s*", text)
    if whole:
        text = context.note("ISLAND_BRACKETS", text, whole[1])
    return _formula(text, context, task=True)


def _expression(value, context):
    """A task field is one bare formula: the islands' rewrites without blanks."""
    if not isinstance(value, str) or not value or len(value) > MAX_ISLAND or _HEBREW.search(value):
        return value
    return _fixed_point(_expression_once, value, context)


def _plain_once(text, context):
    """A title or a unit is printed as plain text: math delimiters there are a slip."""
    note = context.note
    text = note("BIDI_CONTROL", text, _BIDI.sub("", text))
    text = note("DOLLAR_MATH", text, re.sub(r"\$([^$\\{}\[\]]{1,60})\$", r"\1", text))
    if text.count("$") == 1 and not re.search(r"[0-9]\s?\$|\$\s?[0-9]", text):
        text = note("DOLLAR_STRAY", text, text.replace("$", ""))
    return note("ISLAND_BRACKETS", text, re.sub(r"\[\[([^\[\]:\\{}$]{1,60})\]\]", r"\1", text))


def _plain(value, context):
    if not isinstance(value, str) or not value or len(value) > 200:
        return value
    return _fixed_point(_plain_once, value, context)


# ---------------------------------------------------------- question rewrites

def _rich_paths(question):
    """Yield (path, container, key) for every rich string of one wire question."""
    if isinstance(question.get("intro"), str):
        yield "intro", question, "intro"
    table = question.get("table")
    if isinstance(table, dict):
        head = table.get("head")
        if isinstance(head, list):
            for column, cell in enumerate(head):
                if isinstance(cell, str):
                    yield f"table.head.{column + 1}", head, column
        rows = table.get("rows")
        if isinstance(rows, list):
            for number, row in enumerate(rows, 1):
                if isinstance(row, list):
                    for column, cell in enumerate(row):
                        if isinstance(cell, str):
                            yield f"table.row.{number}.{column + 1}", row, column
    items = question.get("items")
    if isinstance(items, list):
        for number, item in enumerate(items, 1):
            if not isinstance(item, dict):
                continue
            if isinstance(item.get("prompt"), str):
                yield f"item.{number}.prompt", item, "prompt"
            answer = item.get("answer")
            if isinstance(answer, dict) and isinstance(answer.get("text"), str):
                yield f"item.{number}.answer.text", answer, "text"


def _task_paths(question):
    items = question.get("items")
    if not isinstance(items, list):
        return
    for number, item in enumerate(items, 1):
        answer = item.get("answer") if isinstance(item, dict) else None
        task = answer.get("task") if isinstance(answer, dict) else None
        if not isinstance(task, dict):
            continue
        base = f"item.{number}.answer.task"
        for field in _TASK_FIELDS:
            if isinstance(task.get(field), str):
                yield f"{base}.{field}", task, field
        values = task.get("values")
        if isinstance(values, list):
            for index, value in enumerate(values):
                if isinstance(value, str):
                    yield f"{base}.values.{index + 1}", values, index
        elif isinstance(values, dict):
            for key, value in values.items():
                if isinstance(value, str):
                    yield f"{base}.values.{key}", values, key
        equations = task.get("equations")
        if isinstance(equations, list):
            for index, equation in enumerate(equations, 1):
                if isinstance(equation, dict):
                    for side in ("lhs", "rhs"):
                        if isinstance(equation.get(side), str):
                            yield f"{base}.equations.{index}.{side}", equation, side


def _times_letter(content, start, end):
    """A spaced x between two numerical operands is the school multiplication sign."""
    return bool(content[start] == "x" and re.search(r"(?:[0-9)%]|___)\s+$", content[:start])
                and re.match(r"\s+(?:[0-9(]|___)", content[end:]))


def _unknown_in_island(content):
    """Classify the single letters of one elementary formula.

    Returns (letter, span) for one letter used once as the unknown of one
    relation, ("ref", letter) for an island that is only a letter, None when
    the island has no letter, and False when its letters have no single reading.
    """
    letters = [m for m in _SINGLE_LETTER.finditer(content)
               if not _times_letter(content, m.start(), m.end())]
    if not letters:
        return None
    if content.strip() == letters[0][0] and len(letters) == 1:
        return "ref", letters[0][0]
    if len(letters) != 1:
        return False
    match = letters[0]
    stripped = content[:match.start()] + "___" + content[match.end():]
    before, after = content[:match.start()], content[match.end():]
    if (not _PURE_ARITHMETIC.fullmatch(stripped) or "___" in content
            or re.search(r"[0-9)%_.,]$", before) or re.match(r"[0-9(_.,]", after)
            or len(_RELATION.findall(content)) != 1):
        return False
    left, right = _RELATION.split(stripped)
    other = right if "___" in left else left
    own = left if "___" in left else right
    if own.strip() == "___" and re.fullmatch(rf"\s*{_NUM}%?\s*", other):
        return False              # x = 5 states a value; it is not an exercise.
    return match[0], match.span()


def _reference(before, after, pointed):
    """How a bare mention of the unknown's letter is rewritten: 'drop', 'phrase' or None."""
    if _HEBREW_HYPHEN.search(before):
        return None               # ל־x needs a fused Hebrew prefix: not rewritten.
    if before and not before[-1].isspace():
        return None
    if after and not re.match(r"[\s.,?!:;]", after):
        return None
    if re.search(r"[-+*/^=<>≤≥≠−×·÷:(0-9]\s*$", before) or re.match(r"\s*[-+*/^=<>≤≥≠−×·÷:)0-9]", after):
        return None               # Part of bare mathematics in the prose.
    return "drop" if _APPOSITION.search(_strip_points(before)) else "phrase"


def _elementary_unknowns(question, context):
    """Replace a letter that stands for the one missing number of a formula.

    The rule applies to the whole question or not at all: a mention of the
    letter that cannot be rewritten would otherwise point at nothing.
    Returns True when the question changed.
    """
    unknowns, plans = set(), []
    for path, box, key in _rich_paths(question):
        text = box[key]
        if not re.search(r"[a-z]", text):
            continue
        parts = _SEGMENT.split(text)
        plan = []
        for index, part in enumerate(parts):
            if index % 2:
                content = part[2:-2]
                letters = {m[0] for m in _SINGLE_LETTER.finditer(content)}
                found = (False if letters else None) if _HEBREW.search(content) else _unknown_in_island(content)
                if found is False:
                    plan.append(("blocked", index, letters))
                elif found and found[0] == "ref":
                    plan.append(("ref", index, found[1]))
                elif found:
                    unknowns.add(found[0])
                    plan.append(("blank", index, found[1]))
            else:
                for match in re.finditer(r"(?<![A-Za-z0-9_])[a-z](?![A-Za-z0-9_])", part):
                    plan.append(("prose", index, match))
        plans.append((path, box, key, parts, plan))
    if not unknowns:
        return False
    pointed = context.grade <= 2
    phrase = _MISSING_NUMBER_POINTED if pointed else _MISSING_NUMBER
    results = []
    for path, box, key, parts, plan in plans:
        parts = list(parts)
        # Later edits first, so earlier offsets in the same prose part stay valid.
        for kind, index, data in reversed(plan):
            if kind == "blocked":
                if data & unknowns:
                    return False
            elif kind == "blank":
                start, end = data
                content = parts[index][2:-2]
                parts[index] = "[[" + content[:start] + "___" + content[end:] + "]]"
            elif kind == "ref":
                if data not in unknowns:
                    continue
                action = _reference("".join(parts[:index]), "".join(parts[index + 1:]), pointed)
                if action is None:
                    return False
                if action == "drop":
                    parts[index - 1] = parts[index - 1].rstrip()
                    parts[index] = ""
                else:
                    parts[index] = phrase
            elif data[0] in unknowns:
                part = parts[index]
                before, after = part[:data.start()], part[data.end():]
                action = _reference("".join(parts[:index]) + before, after + "".join(parts[index + 1:]), pointed)
                if action is None:
                    return False
                parts[index] = before.rstrip() + after if action == "drop" else before + phrase + after
        results.append((path, box, key, "".join(parts)))
    changed = False
    for path, box, key, text in results:
        context.path = path
        changed = changed or text != box[key]
        box[key] = context.note("ELEMENTARY_UNKNOWN", box[key], text)
    return changed


def _strip_points(text):
    return re.sub(f"[{NIQ}]", "", text)


def _interior_angle(figure, vertex):
    """The three-letter name of the only angle that a single vertex names in this figure."""
    if not isinstance(figure, dict):
        return None
    neighbours = None
    if figure.get("kind") == "shape" and isinstance(figure.get("names"), str):
        names = figure["names"]
        if re.fullmatch(r"[A-Z]{3,8}", names) and len(set(names)) == len(names) and vertex in names:
            index = names.index(vertex)
            neighbours = (names[index - 1], names[(index + 1) % len(names)])
    elif figure.get("kind") == "coordinate_plane" and isinstance(figure.get("segments"), list):
        ends = []
        for pair in figure["segments"]:
            if (isinstance(pair, list) and len(pair) == 2 and all(isinstance(name, str) for name in pair)
                    and vertex in pair and pair[0] != pair[1]):
                ends.append(pair[1] if pair[0] == vertex else pair[0])
        if len(ends) == 2 and len(set(ends)) == 2 and all(re.fullmatch(r"[A-Z]", name) for name in ends):
            neighbours = tuple(ends)
    if not neighbours:
        return None
    first, last = sorted(neighbours)
    return first + vertex + last


def _three_letter_angles(question, context):
    """The pinned middle skill always names an angle with three letters (its gate G81).

    A one-letter angle is rewritten only when the question's own figure leaves
    one angle at that vertex. Without such a figure it stays as written.
    Returns True when the question changed.
    """
    figure = question.get("figure")
    if not isinstance(figure, dict):
        return False
    changed = False
    for path, box, key in list(_rich_paths(question)):
        parts = _SEGMENT.split(box[key])
        for index, part in enumerate(parts):
            if index % 2:
                match = _ANGLE_ISLAND.fullmatch(part)
                name = _interior_angle(figure, match[2]) if match else None
                if name:
                    parts[index] = "[[" + ("angle:" if match[1] == "angle:" else "∠") + name + "]]"
                elif not match:
                    # A one-letter angle inside a larger formula: [[∠A + ∠B]], [[∠D = 70°]].
                    def inside(found):
                        name = _interior_angle(figure, found[1])
                        return "∠" + name if name else found[0]
                    parts[index] = _ANGLE_INSIDE.sub(inside, part)
            else:
                def sign(match):
                    name = _interior_angle(figure, match[1])
                    return "∠" + name if name else match[0]

                def word(match):
                    name = _interior_angle(figure, match[2])
                    return match[1] + "[[angle:" + name + "]]" if name else match[0]

                parts[index] = _ANGLE_WORD.sub(word, _ANGLE_SIGN.sub(sign, part))
        text = "".join(parts)
        context.path = path
        changed = changed or text != box[key]
        box[key] = context.note("ANGLE_THREE_LETTER", box[key], text)
    return changed


def _guarded(function, value, context):
    """No rewrite may raise: an unexpected input keeps its original spelling."""
    try:
        return function(value, context)
    except Exception:          # noqa: BLE001 - validation, not this module, reports the source.
        return value


def _fields(question, context):
    for path, box, key in list(_rich_paths(question)):
        context.path = path
        box[key] = _guarded(_rich, box[key], context)
    for path, box, key in list(_task_paths(question)):
        context.path = path
        box[key] = _guarded(_expression, box[key], context)
    items = question.get("items")
    for number, item in enumerate(items if isinstance(items, list) else (), 1):
        answer = item.get("answer") if isinstance(item, dict) else None
        if isinstance(answer, dict) and isinstance(answer.get("unit"), str):
            context.path = f"item.{number}.answer.unit"
            answer["unit"] = _guarded(_plain, answer["unit"], context)


_DECIDE_FIELDS = frozenset(("kind", "relation", "left", "right"))


def _decide_wrapper(question, context):
    """A decide task written as the answer itself: {"kind": "decide", relation, left, right}.

    Seen live: the model closed the answer after the claim and put the unit
    on the item. The task has one reading, so the answer becomes
    {"kind": "computed", "task": {...}, "unit"} with the unit from either place.
    """
    items = question.get("items")
    for number, item in enumerate(items if isinstance(items, list) else (), 1):
        answer = item.get("answer") if isinstance(item, dict) else None
        if not isinstance(answer, dict) or answer.get("kind") != "decide":
            continue
        units = [box["unit"] for box in (answer, item) if "unit" in box]
        if (set(answer) - {"unit"} != _DECIDE_FIELDS or set(item) - {"prompt", "answer", "unit"}
                or len(units) > 1 or not all(isinstance(unit, str) for unit in units)):
            continue
        context.path = f"item.{number}.answer"
        task = {key: answer[key] for key in ("kind", "relation", "left", "right")}
        item.pop("unit", None)
        item["answer"] = {"kind": "computed", "task": task, "unit": units[0] if units else ""}
        context.note("DECIDE_WRAPPER", json.dumps(answer, ensure_ascii=False, sort_keys=True),
                     json.dumps(item["answer"], ensure_ascii=False, sort_keys=True))


def _figure_window(question, context):
    """A coordinate window that does not hold its points is recomputed from them.

    The points are what the question is about. When the window, widened to
    the origin as the compiler does, still leaves one out or passes the -10..10
    limit, it becomes the range of the points and the origin with a margin of
    1, inside the limit.
    """
    figure = question.get("figure")
    if not isinstance(figure, dict) or figure.get("kind") != "coordinate_plane" or context.grade < 7:
        return
    points = figure.get("points")
    if not isinstance(points, list) or not points or not all(
            isinstance(p, dict) and type(p.get("x")) is int and type(p.get("y")) is int
            and -10 <= p["x"] <= 10 and -10 <= p["y"] <= 10 for p in points):
        return
    window = {}
    for axis in ("x", "y"):
        span = figure.get(axis + "r")
        values = [p[axis] for p in points] + [0]
        if isinstance(span, list) and len(span) == 2 and all(type(v) is int and -10 <= v <= 10 for v in span):
            # The compiler already widens a window to the origin (expand_source); that window stands.
            low, high = min(0, span[0]), max(0, span[1])
            if low <= min(values) and max(values) <= high and 2 <= high - low <= 16:
                window[axis] = span
                continue
        low, high = max(-10, min(values) - 1), min(10, max(values) + 1)
        if not 2 <= high - low <= 16:
            return
        window[axis] = [low, high]
    for axis in ("x", "y"):
        if figure.get(axis + "r") != window[axis]:
            context.path = "figure." + axis + "r"
            before = json.dumps(figure.get(axis + "r"))
            figure[axis + "r"] = window[axis]
            context.note("FIGURE_WINDOW", before, json.dumps(window[axis]))


def _question(question, context):
    _decide_wrapper(question, context)
    _figure_window(question, context)
    _fields(question, context)
    rule = (_elementary_unknowns if 1 <= context.grade <= 6 else
            _three_letter_angles if context.grade >= 7 else None)
    if rule:
        snapshot, count = deepcopy(question), len(context.notes)
        try:
            if rule(question, context):
                # A new blank can sit next to an unspaced school operator.
                _fields(question, context)
        except Exception:      # noqa: BLE001
            question.clear()
            question.update(snapshot)
            del context.notes[count:]
    return question


# ------------------------------------------------------------------ public API

def normalize_rich(value, grade, *, topic_id=None, domain=None, path=""):
    """Normalise one rich wire string (rule, intro, prompt, cell, review text)."""
    context = _Context(grade, topic_id, domain, [])
    context.path = path
    return _guarded(_rich, value, context), context.notes


def normalize_expression(value, grade, *, topic_id=None, domain=None, path=""):
    """Normalise one compact task expression."""
    context = _Context(grade, topic_id, domain, [])
    context.path = path
    return _guarded(_expression, value, context), context.notes


def normalize_question(question, grade, *, topic_id=None, domain=None):
    """Return (normalised copy of one wire question, rewrite notes).

    A note is {"code", "path", "before", "after"}; ``path`` is relative to the
    question (``item.2.prompt``). Notes quote worksheet text: keep them out of
    logs that leave the job.
    """
    context = _Context(grade, topic_id, domain, [])
    if not isinstance(question, dict):
        return question, context.notes
    try:
        current = deepcopy(question)
        for _ in range(4):
            changed = _question(deepcopy(current), context)
            if changed == current:
                return current, context.notes
            current = changed
    except Exception:          # noqa: BLE001
        pass
    return deepcopy(question), []


def normalize_source(source, grade, *, topic=None, notes=None):
    """Normalise the rule and every question of a wire reply or a version-four source.

    ``topic`` is the trusted curriculum topic ({"topicId", "domain"}); without
    it the domain-dependent rules stay off. ``notes``, when a list, receives
    the rewrite notes with sheet-level paths (``q3.item.2.prompt``).
    """
    if not isinstance(source, dict):
        return source
    topic = topic if isinstance(topic, dict) else {}
    topic_id, domain = topic.get("topicId"), topic.get("domain")
    collected = notes if isinstance(notes, list) else []
    try:
        result = dict(source)
        if isinstance(result.get("rule"), str):
            result["rule"], found = normalize_rich(result["rule"], grade, topic_id=topic_id,
                                                   domain=domain, path="rule")
            collected.extend(found)
        context = _Context(grade, topic_id, domain, collected)
        context.path = "title"
        if "title" in result:
            result["title"] = _guarded(_plain, result["title"], context)
        number = 0

        def group(questions):
            nonlocal number
            if not isinstance(questions, list):
                return questions
            out = []
            for question in questions:
                number += 1
                if isinstance(question, dict):
                    question, found = normalize_question(question, grade, topic_id=topic_id, domain=domain)
                    collected.extend({**row, "path": f"q{number}.{row['path']}"} for row in found)
                out.append(question)
            return out

        for key in ("practice", "challenges"):
            if key in result:
                result[key] = group(result[key])
        if isinstance(result.get("sections"), list):
            sections = []
            for section in result["sections"]:
                if isinstance(section, dict):
                    section = dict(section)
                    if "title" in section:
                        section["title"] = _guarded(_plain, section["title"], context)
                    for key in ("questions", "practice", "challenges"):
                        if key in section:
                            section[key] = group(section[key])
                sections.append(section)
            result["sections"] = sections
        return result
    except Exception:          # noqa: BLE001
        return source
