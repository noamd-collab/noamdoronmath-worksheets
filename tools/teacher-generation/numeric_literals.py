"""Numeric spelling shared by the bounded text, task and print adapters."""

from fractions import Fraction
import re

from math_tasks import MAX_INPUT_INTEGER


NUMBER_TOKEN = re.compile(r"(?:[1-9][0-9]{0,2}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?")
PLAIN_TOKEN = re.compile(r"[0-9]+(?:\.[0-9]+)?")
_SYNTAX = re.compile(r"sqrt|frac|[xyab+*/^(),-]")
_LITERAL = re.compile(rf"[+-]?{NUMBER_TOKEN.pattern}%?")
COEFFICIENT = re.compile(r"(?<=[0-9])([xyab])(?![A-Za-z0-9_])")
_SCHOOL_OPERATION = re.compile(r"(?:(?<=[0-9)])|(?<=___))\s+([x:])\s+(?=[0-9(]|___)")


def elementary_operations(source):
    """Only spaced schoolbook operations between numerical operands."""
    return _SCHOOL_OPERATION.sub(lambda m: " * " if m[1] == "x" else " / ", source)


def display_literal(source):
    """Accept one printable numeric token, retaining its written precision."""
    if not isinstance(source, str) or not 1 <= len(source) <= 64:
        return None
    spelling = source.replace("−", "-")
    if not _LITERAL.fullmatch(spelling):
        return None
    value = literal_value(spelling)
    if max(abs(value.numerator), value.denominator) > MAX_INPUT_INTEGER:
        return None
    return spelling


def literal_value(spelling):
    value = Fraction(spelling.removesuffix("%").replace(",", ""))
    return value / 100 if spelling.endswith("%") else value


def printed_number(node, spellings):
    """Only the original, equal-valued numbered leaf may override typography."""
    entry = spellings.get(id(node)) if spellings else None
    if entry is None:
        return None
    original, spelling = entry
    if (original is not node or display_literal(spelling) != spelling or
            literal_value(spelling) != Fraction(node["numerator"], node["denominator"])):
        raise ValueError("Printed number differs from its verified value")
    return spelling


def decimal_result(node, notation, *, money=False):
    """Use an exact terminating decimal when the task was entered in decimals.

    Prices keep two decimals: 12.50 + 7.90 is 20.40, not 20.4. That holds for a
    money question, and for a task that combines several decimals of two places
    with a written closing zero. Only the spelling changes, never the value.
    """
    if (node.get("type") != "number" or not isinstance(notation, str) or
            not re.search(r"[0-9]\.[0-9]", notation) or "frac" in notation or "%" in notation):
        return None
    n, d = node["numerator"], node["denominator"]
    if d <= 0:
        raise ValueError("An exact answer needs a positive denominator")
    if d == 1:
        return str(n)
    remaining = d
    for factor in (2, 5):
        while remaining % factor == 0:
            remaining //= factor
    if remaining != 1:
        return None
    integer, rem = divmod(abs(n), d)
    digits = []
    while rem:
        digit, rem = divmod(rem * 10, d)
        digits.append(str(digit))
    places = re.findall(r"[0-9]\.([0-9]+)", notation)
    if len(digits) == 1 and all(len(p) == 2 for p in places) and (
            money or (len(places) >= 2 and any(p.endswith("0") for p in places))):
        digits.append("0")
    return ("−" if n < 0 else "") + str(integer) + "." + "".join(digits)


def arithmetic_tokens(source):
    """Yield closed expression tokens, retaining delimiters of binary functions.

    Within frac(a,b), commas at the function's argument depth always separate
    arguments. A grouped argument can be written using ungrouped digits.
    """
    pos = 0
    stack = []
    previous = None
    while pos < len(source):
        if source[pos].isspace():
            pos += 1
            continue
        pattern = PLAIN_TOKEN if stack and stack[-1] == "frac" else NUMBER_TOKEN
        token = pattern.match(source, pos)
        if token:
            pos = token.end()
            pct = source[pos:pos + 1] == "%"
            previous = token[0] + ("%" if pct else "")
            pos += int(pct)
        else:
            token = _SYNTAX.match(source, pos)
            if not token:
                raise ValueError("Unsupported mathematical character")
            if token[0] == "(":
                stack.append(previous)
            elif token[0] == ")" and stack:
                stack.pop()
            previous = token[0]
            pos = token.end()
        yield previous
