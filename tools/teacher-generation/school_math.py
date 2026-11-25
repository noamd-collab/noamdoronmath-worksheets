"""School grammar for worksheet-wire/5 (V5-DESIGN §2.4-§2.8): parse, scope, kernel conversion, house printing.

A model writes every number and expression of a v5 item in a small ASCII "school grammar". This module parses it
into a written-form tree (CST) that keeps brackets, a leading unary minus, implicit products and the division sign
exactly as written; checks the tree against a topic's scope profile; converts it to the sympy kernel AST of
`math_tasks` (§2.5); and prints it in the middle skill's island syntax (§2.8): U+2212 for every minus, one space
around a binary operator and '=', implicit products side by side. A key is a collected polynomial printed with its
terms in first-appearance order and each coefficient beside its letters ("5x + 4").

Pure functions over immutable values. No IO. Error messages carry codes and positions only, never the text that
was parsed (G11). Imports: the standard library and math_tasks.
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from fractions import Fraction
import re

from math_tasks import (MAX_DEGREE, MAX_POWER, SYMBOLS, Budget, MathTaskError, inspect_ast, number, operation,
                        validate_and_solve_task)

__all__ = [
    "SchoolMathError", "Num", "Var", "Ref", "Neg", "Group", "Sum", "Product", "Power", "Relation", "Term",
    "NODE_TYPES", "ERROR_CODES", "SCOPE_CODES", "KERNEL_SYMBOLS", "MAX_LETTERS", "MAX_LENGTH", "MINUS", "TIMES",
    "parse", "parse_values", "unparse", "letters_of", "resolve", "check_scope", "terms", "is_collected",
    "to_kernel", "polynomial_of_kernel", "first_appearance", "key_node", "kernel_equal", "to_house",
    "from_house_flat", "display_island", "key_island",
    # helpers beyond the V5-DESIGN §3 list
    "kernel_mapping", "polynomial", "key_from_result", "key_roundtrip", "written_unit_coefficient",
]

ERROR_CODES = frozenset({"MATH_PARSE", "MATH_LENGTH", "MATH_SYMBOL_UNDECLARED", "REF_UNDECLARED",
                         "FORM_UNREPRESENTABLE"})
SCOPE_CODES = frozenset({"MATH_SCOPE_PRODUCT_OF_SUM", "MATH_SCOPE_BRACKETS", "MATH_SCOPE_POWER",
                         "MATH_SCOPE_DIVISION", "MATH_SCOPE_DECIMAL", "MATH_SCOPE_PERCENT", "MATH_SCOPE_PRODUCT",
                         "MATH_SCOPE_RANGE", "MATH_SCOPE_TERMS", "MATH_SCOPE_LETTERS", "MATH_SCOPE_RELATION"})
KERNEL_SYMBOLS = tuple(SYMBOLS)        # ("x", "y", "a", "b"): the only kernel symbols (math_tasks.py:36)
MAX_LETTERS = len(KERNEL_SYMBOLS)      # a question declares at most 4 letters, each mapped to one kernel symbol
MAX_LENGTH = 120                       # the wire limit of an `expr` field
MAX_NESTING = 32                       # bracket depth (the kernel's own depth limit is 12)
MINUS = "\u2212"                          # the only minus a house island prints
TIMES = "\u00b7"                          # middle-school explicit multiplication (to_house_math, emit_html BRAND)
ROLES = ("task", "result", "value")
BRACKET_POLICIES = ("none", "negative_number", "any")

_NUMBER = re.compile(r"(0|[1-9][0-9]*)(?:\.([0-9]+))?(%?)")
_REF = re.compile(r"\{n[1-8]\}")
_GIVEN = re.compile(r"n[1-8]")
_VALUE = re.compile(r" *([a-z]) *= *(-?)(0|[1-9][0-9]*) *")
_DIGITS = frozenset("0123456789")
_HOUSE_PLAIN = frozenset("0123456789.abcdefghijklmnopqrstuvwxyz+=():")
_PROFILE_INTS = ("literal_max", "result_literal_max", "value_min", "value_max", "terms_max", "letters_max")
_PROFILE_BOOLS = ("division", "decimal", "percent", "explicit_product")


class SchoolMathError(ValueError):
    """code ∈ MATH_PARSE, MATH_LENGTH, MATH_SYMBOL_UNDECLARED, REF_UNDECLARED, FORM_UNREPRESENTABLE."""

    def __init__(self, code: str, message: str):
        if code not in ERROR_CODES:
            raise ValueError("unknown school_math error code")
        self.code = code
        super().__init__(message)


def _fail(code, message):
    raise SchoolMathError(code, message)


def _literal(text):
    """(written magnitude, percent?) of a NUMBER literal. MATH_PARSE when it is not one."""
    match = _NUMBER.fullmatch(text) if type(text) is str else None
    if match is None:
        _fail("MATH_PARSE", "malformed number literal")
    whole, decimals, percent = match.groups()
    decimals = decimals or ""
    return Fraction(int(whole + decimals), 10 ** len(decimals)), bool(percent)


# ---------------------------------------------------------------- CST ----

@dataclass(frozen=True)
class Num:
    """A number literal exactly as written: "12", "2.5", "30%"."""
    text: str

    @property
    def value(self) -> Fraction:
        """The exact value: "12" → 12, "2.5" → 5/2, "30%" → 3/10."""
        magnitude, percent = _literal(self.text)
        return magnitude / 100 if percent else magnitude

    @property
    def magnitude(self) -> Fraction:
        """The written number without its percent sign: what a range rule reads ("30%" → 30)."""
        return _literal(self.text)[0]


@dataclass(frozen=True)
class Var:
    """One declared letter."""
    name: str


@dataclass(frozen=True)
class Ref:
    """A reference to a typed given, "n1".."n8"."""
    given: str


@dataclass(frozen=True)
class Neg:
    """A leading unary minus (only at the start of an expression)."""
    operand: object


@dataclass(frozen=True)
class Group:
    """Brackets exactly as written."""
    inner: object


@dataclass(frozen=True)
class Sum:
    """first, then ((op, term), ...) with op '+' or '-'; at least one rest term."""
    first: object
    rest: tuple


@dataclass(frozen=True)
class Product:
    """first, then ((op, factor), ...) with op '' (implicit), '*', '/' or ':'; left-associative."""
    first: object
    rest: tuple


@dataclass(frozen=True)
class Power:
    """base ^ exponent, the exponent one written digit 0..9."""
    base: object
    exponent: int


@dataclass(frozen=True)
class Relation:
    """left = right (only at the top of a display)."""
    left: object
    op: str
    right: object


NODE_TYPES = (Num, Var, Ref, Neg, Group, Sum, Product, Power, Relation)


@dataclass(frozen=True)
class Term:
    """One signed monomial of a monomial sum: sign ±1, coefficient ≥ 0, signature = sorted letters (() = constant),
    implicit_one = no written coefficient, spelling = the letters as written."""
    sign: int
    coefficient: Fraction
    signature: tuple
    implicit_one: bool
    spelling: tuple

    @property
    def signed(self) -> Fraction:
        return self.sign * self.coefficient


def _children(node):
    """Child nodes in written (left-to-right) order."""
    kind = type(node)
    if kind in (Neg,):
        return (node.operand,)
    if kind is Group:
        return (node.inner,)
    if kind in (Sum, Product):
        return (node.first,) + tuple(child for _, child in node.rest)
    if kind is Power:
        return (node.base,)
    if kind is Relation:
        return (node.left, node.right)
    return ()


def _check(node, where="display", depth=0):
    """Refuse (MATH_PARSE) any tree the grammar of §2.4 cannot produce, so every printer and converter is total.

    where: display (top), expr (bracket inside, relation side), first (first term of a sum), term (later term),
    neg (operand of a leading minus), factor (product operand after nothing or an explicit sign), implicit
    (operand of an implicit product: must start with a letter, a reference or a bracket), base (power base)."""
    if depth > 6 * MAX_NESTING + 16:            # one bracket level adds at most 5 tree levels (Group..Power)
        _fail("MATH_PARSE", "expression tree too deep")
    kind = type(node)
    bad = lambda: _fail("MATH_PARSE", "not a school-grammar tree")
    if kind is Num:
        if type(node.text) is not str or not _NUMBER.fullmatch(node.text) or where == "implicit":
            bad()
    elif kind is Var:
        if type(node.name) is not str or len(node.name) != 1 or not "a" <= node.name <= "z":
            bad()
    elif kind is Ref:
        if type(node.given) is not str or not _GIVEN.fullmatch(node.given):
            bad()
    elif kind is Group:
        _check(node.inner, "expr", depth + 1)
    elif kind is Power:
        exponent = node.exponent
        if where == "base" or type(exponent) is not int or not 0 <= exponent <= 9 or (
                where == "implicit" and type(node.base) is Num):
            bad()
        _check(node.base, "base", depth + 1)
    elif kind is Product:
        if where in ("base", "factor", "implicit") or type(node.rest) is not tuple or not node.rest:
            bad()
        _check(node.first, "factor", depth + 1)
        for item in node.rest:
            if type(item) is not tuple or len(item) != 2 or item[0] not in ("", "*", "/", ":"):
                bad()
            _check(item[1], "implicit" if item[0] == "" else "factor", depth + 1)
    elif kind is Neg:
        if where not in ("display", "expr", "first"):
            bad()
        _check(node.operand, "neg", depth + 1)
    elif kind is Sum:
        if where not in ("display", "expr") or type(node.rest) is not tuple or not node.rest:
            bad()
        _check(node.first, "first", depth + 1)
        for item in node.rest:
            if type(item) is not tuple or len(item) != 2 or item[0] not in ("+", "-"):
                bad()
            _check(item[1], "term", depth + 1)
    elif kind is Relation:
        if where != "display" or node.op != "=":
            bad()
        _check(node.left, "expr", depth + 1)
        _check(node.right, "expr", depth + 1)
    else:
        bad()


# -------------------------------------------------------------- parse ----

def _declared(letters):
    """Declared letters, validated: distinct lowercase ASCII letters, at most MAX_LETTERS, written order kept."""
    try:
        items = tuple(letters)
    except TypeError:
        _fail("MATH_SYMBOL_UNDECLARED", "declared letters must be an iterable of letters")
    ordered = []
    for letter in items:
        if type(letter) is not str or len(letter) != 1 or not "a" <= letter <= "z":
            _fail("MATH_SYMBOL_UNDECLARED", "a declared letter is one lowercase ASCII letter")
        if letter not in ordered:
            ordered.append(letter)
    if len(ordered) > MAX_LETTERS:
        _fail("MATH_SYMBOL_UNDECLARED", "a question declares at most 4 letters")
    return tuple(ordered)


def _tokens(text, declared, refs=True):
    """[(kind, value, position)], kind ∈ num, var, ref, op. ASCII only; U+2212 reads as '-'; spaces separate
    tokens but never split a number (so "3 4", "2 .5" and "30 %" fail). With refs=False a given reference is
    outside the grammar (MATH_PARSE): the field belongs to a kind that declares no givens."""
    out, index, size = [], 0, len(text)
    while index < size:
        char = text[index]
        if char == " ":
            index += 1
        elif char in _DIGITS:
            end = index
            while end < size and text[end] in _DIGITS:
                end += 1
            if end - index > 1 and text[index] == "0":
                _fail("MATH_PARSE", "number with a leading zero at position %d" % index)
            if end < size and text[end] == ".":
                stop = end + 1
                while stop < size and text[stop] in _DIGITS:
                    stop += 1
                if stop == end + 1:
                    _fail("MATH_PARSE", "decimal point without digits at position %d" % end)
                end = stop
            if end < size and text[end] == "%":
                end += 1
            out.append(("num", text[index:end], index))
            index = end
        elif "a" <= char <= "z":
            if char not in declared:
                _fail("MATH_SYMBOL_UNDECLARED", "undeclared letter at position %d" % index)
            out.append(("var", char, index))
            index += 1
        elif char == "{":
            if not refs:
                _fail("MATH_PARSE", "no given reference is allowed here (position %d)" % index)
            if not _REF.match(text, index):
                _fail("MATH_PARSE", "malformed given reference at position %d" % index)
            out.append(("ref", text[index + 1:index + 3], index))
            index += 4
        elif char in "+-*/:^()=" or char == MINUS:
            out.append(("op", "-" if char == MINUS else char, index))
            index += 1
        else:
            _fail("MATH_PARSE", "character outside the school grammar at position %d" % index)
    return out


class _Parser:
    """Recursive descent over the grammar of V5-DESIGN §2.4."""

    def __init__(self, tokens, allow_relation):
        self.tokens, self.index, self.allow_relation, self.depth = tokens, 0, allow_relation, 0

    def peek(self):
        return self.tokens[self.index] if self.index < len(self.tokens) else None

    def take(self):
        token = self.peek()
        self.index += 1
        return token

    def fail(self, reason):
        token = self.peek() if self.index < len(self.tokens) else None
        where = "at position %d" % token[2] if token else "at the end"
        _fail("MATH_PARSE", "%s %s" % (reason, where))

    @staticmethod
    def is_op(token, chars):
        return token is not None and token[0] == "op" and token[1] in chars

    def display(self):
        left = self.expr()
        if self.is_op(self.peek(), "="):
            if not self.allow_relation:
                self.fail("a relation is not allowed here")
            self.take()
            left = Relation(left, "=", self.expr())
        if self.peek() is not None:
            self.fail("unexpected token")
        return left

    def expr(self):
        negative = self.is_op(self.peek(), "-")
        if negative:
            self.take()
        first = self.term()
        if negative:
            first = Neg(first)
        rest = []
        while self.is_op(self.peek(), "+-"):
            rest.append((self.take()[1], self.term()))
        return Sum(first, tuple(rest)) if rest else first

    def term(self):
        first, rest = self.power(), []
        while True:
            token = self.peek()
            if self.is_op(token, "*/:"):
                self.take()
                rest.append((token[1], self.power()))
            elif token is not None and (token[0] in ("var", "ref") or self.is_op(token, "(")):
                rest.append(("", self.power()))
            else:
                break
        return Product(first, tuple(rest)) if rest else first

    def power(self):
        base = self.atom()
        if not self.is_op(self.peek(), "^"):
            return base
        self.take()
        token = self.peek()
        if token is None or token[0] != "num" or len(token[1]) != 1:
            self.fail("an exponent is one digit")
        self.take()
        return Power(base, int(token[1]))

    def atom(self):
        token = self.peek()
        if token is None:
            self.fail("missing operand")
        kind, value, _ = token
        if kind == "num":
            self.take()
            return Num(value)
        if kind == "var":
            self.take()
            return Var(value)
        if kind == "ref":
            self.take()
            return Ref(value)
        if self.is_op(token, "("):
            self.take()
            self.depth += 1
            if self.depth > MAX_NESTING:
                self.fail("brackets nested too deeply")
            inner = self.expr()
            if not self.is_op(self.peek(), ")"):
                self.fail("missing closing bracket")
            self.take()
            self.depth -= 1
            return Group(inner)
        self.fail("unexpected token")


def parse(text: str, *, letters, allow_relation: bool = False, max_length: int = 120, allow_refs: bool = True):
    """Parse school grammar (§2.4) into a CST. Letters outside `letters` → MATH_SYMBOL_UNDECLARED.

    allow_refs=False (a model math field of a kind that declares no givens, as every stage-2 kind): a `{nK}`
    reference is outside the field's grammar → MATH_PARSE, so no unresolvable Ref ever reaches the kernel."""
    if type(text) is not str:
        _fail("MATH_PARSE", "expected a string")
    if type(max_length) is not int or max_length < 1:
        raise ValueError("max_length must be a positive integer")
    if len(text) > max_length:
        _fail("MATH_LENGTH", "longer than %d characters" % max_length)
    declared = _declared(letters)
    if not text.strip(" "):
        _fail("MATH_PARSE", "empty expression")
    return _Parser(_tokens(text, declared, refs=allow_refs is not False), bool(allow_relation)).display()


def parse_values(text: str, *, letters) -> tuple:
    """'y=-2' or 'x=3, y=-1' → (('y', -2),). Integer values only; a malformed value → MATH_PARSE."""
    if type(text) is not str:
        _fail("MATH_PARSE", "expected a string")
    if len(text) > MAX_LENGTH:
        _fail("MATH_LENGTH", "longer than %d characters" % MAX_LENGTH)
    declared = _declared(letters)
    out, seen = [], set()
    for position, part in enumerate(text.replace(MINUS, "-").split(",")):
        match = _VALUE.fullmatch(part)
        if match is None:
            _fail("MATH_PARSE", "value %d is not letter=integer" % (position + 1))
        letter, sign, digits = match.groups()
        if letter not in declared:
            _fail("MATH_SYMBOL_UNDECLARED", "value %d names an undeclared letter" % (position + 1))
        if letter in seen:
            _fail("MATH_PARSE", "value %d repeats a letter" % (position + 1))
        seen.add(letter)
        out.append((letter, -int(digits) if sign else int(digits)))
    return tuple(out)


def unparse(node) -> str:
    """Canonical ASCII form, no spaces, U+2212 never used. parse(unparse(n)) == n."""
    _check(node)
    return _unparse(node)


def _unparse(node):
    kind = type(node)
    if kind is Num:
        return node.text
    if kind is Var:
        return node.name
    if kind is Ref:
        return "{" + node.given + "}"
    if kind is Neg:
        return "-" + _unparse(node.operand)
    if kind is Group:
        return "(" + _unparse(node.inner) + ")"
    if kind in (Sum, Product):
        return _unparse(node.first) + "".join(op + _unparse(child) for op, child in node.rest)
    if kind is Power:
        return _unparse(node.base) + "^" + str(node.exponent)
    return _unparse(node.left) + "=" + _unparse(node.right)


def letters_of(node) -> tuple:
    """Declared letters in order of first appearance."""
    _check(node)
    seen = []

    def walk(item):
        if type(item) is Var:
            if item.name not in seen:
                seen.append(item.name)
        for child in _children(item):
            walk(child)

    walk(node)
    return tuple(seen)


def _has_ref(node):
    return type(node) is Ref or any(_has_ref(child) for child in _children(node))


def resolve(node, givens):
    """Replace every Ref with the Num of its given; unknown ref → REF_UNDECLARED.

    `givens` maps a given id ("n1".."n8") to its parsed CST, or to a school number literal string (parsed here with
    no letters). A replacement that would change the reading where it stands (a negative number after an operator,
    a sum inside a product, a number right after an implicit product) is wrapped in a Group, so the result is again
    a school-grammar tree with the given's value."""
    _check(node)
    if not isinstance(givens, Mapping):
        _fail("REF_UNDECLARED", "givens must map given ids to values")
    values = {}

    def value(ref):
        if ref.given not in values:
            if ref.given not in givens:
                _fail("REF_UNDECLARED", "reference to an undeclared given")
            item = givens[ref.given]
            if type(item) is str:
                item = parse(item, letters=(), max_length=60)
            elif type(item) not in NODE_TYPES or type(item) is Relation:
                _fail("REF_UNDECLARED", "a given has no school value")
            else:
                _check(item, "expr")
            if _has_ref(item):
                _fail("REF_UNDECLARED", "a given may not refer to another given")
            values[ref.given] = item
        return values[ref.given]

    def fits(item, where):
        kind = type(item)
        if where in ("display", "expr"):
            return True
        if where == "first":
            return kind is not Sum
        if where in ("term", "neg"):
            return kind not in (Sum, Neg)
        if where == "factor":
            return kind in (Num, Var, Ref, Group, Power)
        if where == "implicit":
            return kind in (Var, Ref, Group) or (kind is Power and type(item.base) is not Num)
        return kind in (Num, Var, Ref, Group)          # base

    def walk(item, where):
        kind = type(item)
        if kind is Ref:
            replacement = value(item)
            return replacement if fits(replacement, where) else Group(replacement)
        if kind is Neg:
            return Neg(walk(item.operand, "neg"))
        if kind is Group:
            return Group(walk(item.inner, "expr"))
        if kind is Sum:
            return Sum(walk(item.first, "first"), tuple((op, walk(child, "term")) for op, child in item.rest))
        if kind is Product:
            return Product(walk(item.first, "factor"), tuple(
                (op, walk(child, "implicit" if op == "" else "factor")) for op, child in item.rest))
        if kind is Power:
            return Power(walk(item.base, "base"), item.exponent)
        if kind is Relation:
            return Relation(walk(item.left, "expr"), item.op, walk(item.right, "expr"))
        return item

    resolved = walk(node, "display")
    _check(resolved)
    return resolved


# -------------------------------------------------------------- scope ----

def _scope_profile(profile):
    if not isinstance(profile, Mapping):
        raise ValueError("a scope profile is a mapping")
    missing = [key for key in _PROFILE_INTS + _PROFILE_BOOLS + ("power", "brackets") if key not in profile]
    if missing:
        raise ValueError("scope profile lacks " + ", ".join(missing))
    out = {}
    for key in _PROFILE_INTS:
        if type(profile[key]) is not int:
            raise ValueError("scope profile %s must be an integer" % key)
        out[key] = profile[key]
    for key in _PROFILE_BOOLS + ("distributive", "relation"):
        flag = profile.get(key, False)
        if type(flag) is not bool:
            raise ValueError("scope profile %s must be a boolean" % key)
        out[key] = flag
    power = profile["power"]
    if power is None or power is False or (type(power) is int and power == 0):
        out["power"] = None
    elif power is True:
        out["power"] = MAX_POWER
    elif type(power) is int and 1 <= power <= 9:
        out["power"] = power
    else:
        raise ValueError("scope profile power is False, True or a maximum exponent 1..9")
    if profile["brackets"] not in BRACKET_POLICIES:
        raise ValueError("scope profile brackets must be one of " + ", ".join(BRACKET_POLICIES))
    out["brackets"] = profile["brackets"]
    return out


def _sum_like(node):
    """A bracket content that is a sum once brackets and a leading minus are looked through."""
    while type(node) in (Group, Neg):
        node = node.inner if type(node) is Group else node.operand
    return type(node) is Sum


def _term_count(node):
    return 1 + len(node.rest) if type(node) is Sum else 1


def _written_unit(node):
    """A number literal (or a bracketed negative literal) whose value is 0, 1 or −1: never a written coefficient."""
    if type(node) is Group and type(node.inner) is Neg:
        node = node.inner.operand
    return type(node) is Num and node.value in (0, 1)


def written_unit_coefficient(node) -> bool:
    """True when a literal 0, 1 or (−1) is written directly before a letter, a reference or a bracket as an
    implicit-product coefficient ("1x+2x", "0x+3x+y", "(-1)x"). House notation never prints one (key_node drops
    a coefficient 1 and every zero term), so model math with one is refused (MATH_SCOPE_RANGE in item_kinds)."""
    _check(node)
    stack = [node]
    while stack:
        item = stack.pop()
        if type(item) is Product and item.rest and item.rest[0][0] == "" and _written_unit(item.first):
            return True
        stack.extend(_children(item))
    return False


def check_scope(node, profile, *, role: str = "task") -> list:
    """Sorted unique MATH_SCOPE_* codes, [] when in scope. Each offending node gives only its most specific code:
    a bracketed sum used as a factor → PRODUCT_OF_SUM (not BRACKETS/PRODUCT); any other Group except Group(Neg(Num))
    → BRACKETS; Power or a repeated letter → POWER (not PRODUCT); explicit '*' → PRODUCT; '/' ':' → DIVISION;
    decimals → DECIMAL; '%' → PERCENT; literals > literal_max → RANGE; TERMS and LETTERS once per expression.
    role 'result' uses result_literal_max; role 'value' checks value_min..value_max.

    Profile keys (structured_contract overlay): literal_max, result_literal_max, value_min, value_max, terms_max,
    letters_max, power (False | True = up to the kernel's 4 | a maximum exponent), division, decimal, percent,
    explicit_product, brackets ("none" | "negative_number" | "any"); optional distributive (default False: a
    bracketed sum used as a factor needs the distributive law) and relation (default False: '=' outside role
    'value' → RELATION). A literal is a number as written (its sign comes from a leading minus or Group(Neg(Num)));
    a percent or decimal literal reports PERCENT or DECIMAL instead of RANGE. A power base counts as a factor."""
    _check(node)
    if role not in ROLES:
        raise ValueError("role must be one of " + ", ".join(ROLES))
    rules = _scope_profile(profile)
    codes = set()

    def literal(item, negated):
        written, percent = _literal(item.text)
        if percent and not rules["percent"]:
            codes.add("MATH_SCOPE_PERCENT")
        elif "." in item.text and not rules["decimal"]:
            codes.add("MATH_SCOPE_DECIMAL")
        elif role == "value":
            signed = -written if negated else written
            if not rules["value_min"] <= signed <= rules["value_max"]:
                codes.add("MATH_SCOPE_RANGE")
        elif written > rules["result_literal_max" if role == "result" else "literal_max"]:
            codes.add("MATH_SCOPE_RANGE")

    def visit(item, factor=False, negated=False):
        kind = type(item)
        if kind is Num:
            literal(item, negated)
        elif kind is Neg:
            visit(item.operand, False, not negated)
        elif kind is Group:
            inner = item.inner
            if factor and _sum_like(inner):
                if not rules["distributive"]:
                    codes.add("MATH_SCOPE_PRODUCT_OF_SUM")
            elif type(inner) is Neg and type(inner.operand) is Num:
                if rules["brackets"] == "none":
                    codes.add("MATH_SCOPE_BRACKETS")
            elif rules["brackets"] != "any":
                codes.add("MATH_SCOPE_BRACKETS")
            visit(inner, False, negated)
        elif kind is Sum:
            for child in _children(item):
                visit(child)
        elif kind is Product:
            factors = _children(item)
            ops = tuple(op for op, _ in item.rest)
            names = [f.name for f in factors if type(f) is Var] + [
                f.base.name for f in factors if type(f) is Power and type(f.base) is Var]
            repeated = len(names) != len(set(names))
            if repeated:
                codes.add("MATH_SCOPE_POWER")
            if ("/" in ops or ":" in ops) and not rules["division"]:
                codes.add("MATH_SCOPE_DIVISION")
            if ":" in ops and "" in ops[ops.index(":"):]:
                # "6:2x" prints "6 : 2x" (read 6 : (2x)) but means (6 : 2)·x: an implicit product after ':'
                # is never in scope, even where division is (a ':' prints inline, unlike the stacked '/').
                codes.add("MATH_SCOPE_DIVISION")
            sum_factor = not rules["distributive"] and any(
                type(f) is Group and _sum_like(f.inner) for f in factors)
            if "*" in ops and not rules["explicit_product"] and not repeated and not sum_factor:
                codes.add("MATH_SCOPE_PRODUCT")
            for child in factors:
                visit(child, True)
        elif kind is Power:
            if rules["power"] is None or item.exponent > rules["power"]:
                codes.add("MATH_SCOPE_POWER")
            visit(item.base, True)
        elif kind is Relation:
            if role != "value" and not rules["relation"]:
                codes.add("MATH_SCOPE_RELATION")
            visit(item.left)
            visit(item.right)

    visit(node)
    sides = (node.left, node.right) if type(node) is Relation else (node,)
    if any(_term_count(side) > rules["terms_max"] for side in sides):
        codes.add("MATH_SCOPE_TERMS")
    if len(letters_of(node)) > rules["letters_max"]:
        codes.add("MATH_SCOPE_LETTERS")
    return sorted(codes)


# ---------------------------------------------------------- monomials ----

def _monomial(node, strict):
    """(sign, coefficient, signature, implicit_one, spelling) of one written term, or None.

    strict: the stage-2 monomial of §2.4 (Num, Var, Group(Neg(Num)), or an optional leading Num and 1-2 distinct
    Vars joined implicitly; the first term of a sum may be wrapped in Neg). Not strict also reads letter powers
    ("ax^2", "3x^2y"), for the key order of later topics."""
    sign = 1
    if type(node) is Neg:
        sign, node = -1, node.operand
    kind = type(node)
    if kind is Num:
        return sign, node.value, (), False, ()
    if kind is Group and type(node.inner) is Neg and type(node.inner.operand) is Num:
        return -sign, node.inner.operand.value, (), False, ()
    if kind in (Var, Power):
        factors = [node]
    elif kind is Product and all(op == "" for op, _ in node.rest):
        factors = list(_children(node))
    else:
        return None
    coefficient, implicit = Fraction(1), True
    if type(factors[0]) is Num:
        coefficient, implicit, factors = factors[0].value, False, factors[1:]
    spelling = []
    for factor in factors:
        if type(factor) is Var:
            spelling.append(factor.name)
        elif not strict and type(factor) is Power and type(factor.base) is Var:
            spelling.extend([factor.base.name] * factor.exponent)
        else:
            return None
    if not spelling or (strict and (len(spelling) > 2 or len(set(spelling)) != len(spelling))):
        return None
    return sign, coefficient, tuple(sorted(spelling)), implicit, tuple(spelling)


def _top_terms(node):
    """((op, term), ...) of the top-level sum, the first with op '+'."""
    if type(node) is Sum:
        return (("+", node.first),) + node.rest
    return (("+", node),)


def terms(node) -> tuple:
    """Signed monomial terms of a monomial sum (§2.4); anything else → SchoolMathError MATH_PARSE."""
    _check(node)
    if type(node) is Relation:
        _fail("MATH_PARSE", "a relation is not a monomial sum")
    out = []
    for op, term in _top_terms(node):
        monomial = _monomial(term, strict=True)
        if monomial is None:
            _fail("MATH_PARSE", "not a monomial sum")
        sign, coefficient, signature, implicit, spelling = monomial
        out.append(Term(sign if op == "+" else -sign, coefficient, signature, implicit, spelling))
    return tuple(out)


def is_collected(node) -> bool:
    """True when no two terms share a signature."""
    signatures = [term.signature for term in terms(node)]
    return len(signatures) == len(set(signatures))


def first_appearance(node) -> tuple:
    """((signature, spelling), ...) in first written order.

    Read from the top-level terms that are monomials (letter powers included); other terms (a bracket product, a
    reference) contribute nothing, so key_node orders their monomials by degree. A signature counts once."""
    _check(node)
    if type(node) is Relation:
        _fail("MATH_PARSE", "split a relation before ordering its terms")
    order, seen = [], set()
    for _, term in _top_terms(node):
        monomial = _monomial(term, strict=False)
        if monomial is not None and monomial[2] not in seen:
            seen.add(monomial[2])
            order.append((monomial[2], monomial[4]))
    return tuple(order)


# ------------------------------------------------------------- kernel ----

def kernel_mapping(letters) -> dict:
    """Declared letters → kernel symbols: x, y, a, b map to themselves; any other letter takes the first unused
    kernel symbol, in KERNEL_SYMBOLS order. More than 4 letters → MATH_SYMBOL_UNDECLARED (helper)."""
    declared = _declared(letters)
    table = {letter: letter for letter in declared if letter in KERNEL_SYMBOLS}
    free = [symbol for symbol in KERNEL_SYMBOLS if symbol not in table]
    for letter in declared:
        if letter not in table:
            table[letter] = free.pop(0)
    return {letter: table[letter] for letter in declared}


def _mapping_table(node, mapping):
    if mapping is None:
        table = {symbol: symbol for symbol in KERNEL_SYMBOLS}
    else:
        if not isinstance(mapping, Mapping):
            _fail("MATH_SYMBOL_UNDECLARED", "a letter mapping is a mapping")
        table = dict(mapping)
        _declared(table)
        targets = list(table.values())
        if any(type(t) is not str or t not in KERNEL_SYMBOLS for t in targets) or len(set(targets)) != len(targets):
            _fail("MATH_SYMBOL_UNDECLARED", "a letter mapping is injective into the kernel symbols x, y, a, b")
    for letter in letters_of(node):
        if letter not in table:
            _fail("MATH_SYMBOL_UNDECLARED", "a letter has no kernel symbol")
    return table


def to_kernel(node, mapping=None) -> dict:
    """Kernel AST per §2.5; letters outside the kernel symbols need `mapping` (stage 2: identity)."""
    _check(node)
    table = _mapping_table(node, mapping)

    def convert(item):
        kind = type(item)
        if kind is Num:
            value = item.value
            return number(value.numerator, value.denominator)
        if kind is Var:
            return {"type": "symbol", "name": table[item.name]}
        if kind is Neg:
            if type(item.operand) is Num:
                value = item.operand.value
                return number(-value.numerator, value.denominator)
            return operation("multiply", number(-1), convert(item.operand))
        if kind is Group:
            return convert(item.inner)
        if kind is Sum:
            ast = convert(item.first)
            for op, child in item.rest:
                ast = operation("add" if op == "+" else "subtract", ast, convert(child))
            return ast
        if kind is Product:
            ast = convert(item.first)
            for op, child in item.rest:
                ast = operation("divide" if op in ("/", ":") else "multiply", ast, convert(child))
            return ast
        if kind is Power:
            return operation("power", convert(item.base), number(item.exponent))
        _fail("MATH_PARSE", "resolve references and split relations before kernel conversion")

    return convert(node)


def _sorted_polynomial(poly):
    return dict(sorted(poly.items(), key=lambda item: (-len(item[0]), item[0])))


def _poly_add(left, right, sign=1):
    out = dict(left)
    for signature, coefficient in right.items():
        total = out.get(signature, 0) + sign * coefficient
        if total:
            out[signature] = total
        else:
            out.pop(signature, None)
    return out


def _poly_mul(left, right):
    out = {}
    for first, a in left.items():
        for second, b in right.items():
            signature = tuple(sorted(first + second))
            if len(signature) > MAX_DEGREE:
                _fail("FORM_UNREPRESENTABLE", "degree above the kernel bound")
            total = out.get(signature, 0) + a * b
            if total:
                out[signature] = total
            else:
                out.pop(signature, None)
    return out


def _poly(ast):
    kind = ast["type"]
    if kind == "number":
        value = Fraction(ast["numerator"], ast["denominator"])
        return {(): value} if value else {}
    if kind == "symbol":
        return {(ast["name"],): Fraction(1)}
    op, args = ast["op"], ast["args"]
    if op == "add":
        out = {}
        for arg in args:
            out = _poly_add(out, _poly(arg))
        return out
    if op == "subtract":
        return _poly_add(_poly(args[0]), _poly(args[1]), -1)
    if op == "multiply":
        out = {(): Fraction(1)}
        for arg in args:
            out = _poly_mul(out, _poly(arg))
        return out
    if op == "divide":
        divisor = _poly(args[1])
        if set(divisor) != {()}:
            _fail("FORM_UNREPRESENTABLE", "division by an expression that is not a nonzero number")
        return _poly_mul(_poly(args[0]), {(): 1 / divisor[()]})
    if op == "power":
        exponent = args[1]["numerator"]
        base = _poly(args[0])
        if exponent < 0 or (exponent == 0 and not base):
            _fail("FORM_UNREPRESENTABLE", "negative or undefined power")
        out = {(): Fraction(1)}
        for _ in range(exponent):
            out = _poly_mul(out, base)
        return out
    _fail("FORM_UNREPRESENTABLE", "a square root is not a polynomial")


def polynomial_of_kernel(ast: dict) -> dict:
    """Kernel result → {signature: Fraction}; divide by a non-number, sqrt or a negative power → FORM_UNREPRESENTABLE.

    A signature is the sorted tuple of kernel symbol names, one entry per degree (x² → ("x", "x")); () is the
    constant. Zero coefficients are dropped (0 → {}). "A non-number" is read exactly: any divisor whose polynomial
    is not a nonzero constant. A malformed AST or a degree above the kernel's 8 is FORM_UNREPRESENTABLE too."""
    try:
        inspect_ast(ast, Budget(result=True))
    except MathTaskError:
        _fail("FORM_UNREPRESENTABLE", "not a bounded kernel expression")
    return _sorted_polynomial(_poly(ast))


def polynomial(node, mapping=None) -> dict:
    """The exact polynomial of a CST in its own letters: polynomial_of_kernel(to_kernel(node, mapping)) renamed back.
    The default mapping is kernel_mapping(letters_of(node)) (helper)."""
    if mapping is None:
        mapping = kernel_mapping(letters_of(node))
    poly = polynomial_of_kernel(to_kernel(node, mapping))
    return _rename(poly, mapping)


def _rename(poly, mapping):
    inverse = {symbol: letter for letter, symbol in dict(mapping).items()}
    out = {}
    for signature, coefficient in poly.items():
        if any(symbol not in inverse for symbol in signature):
            _fail("MATH_SYMBOL_UNDECLARED", "a kernel symbol has no declared letter")
        out[tuple(sorted(inverse[symbol] for symbol in signature))] = coefficient
    return _sorted_polynomial(out)


def kernel_equal(node, ast: dict, mapping=None) -> bool:
    """True iff the kernel simplifies (node − ast) to the number 0; any kernel error → False."""
    try:
        task = {"kind": "simplify", "expression": operation("subtract", to_kernel(node, mapping), ast)}
        solved = validate_and_solve_task(task)
    except (SchoolMathError, MathTaskError):
        return False
    return solved["result"] == {"type": "expression", "value": number(0)}


# ---------------------------------------------------------------- keys ----

def _monomial_node(coefficient, spelling):
    """CST of coefficient·letters (coefficient > 0): the coefficient beside its letters, a repeated letter as a power,
    letters in the order of `spelling`; a fraction coefficient p/q is written p/q before the letters."""
    counts = {}
    for letter in spelling:
        counts[letter] = counts.get(letter, 0) + 1
    factors = []
    for letter, count in counts.items():
        if count > 9:
            _fail("FORM_UNREPRESENTABLE", "an exponent above 9 cannot be written")
        factors.append(Var(letter) if count == 1 else Power(Var(letter), count))
    if coefficient == 1 and factors:
        first, rest = factors[0], tuple(("", factor) for factor in factors[1:])
    else:
        first = Num(str(coefficient.numerator))
        rest = (("/", Num(str(coefficient.denominator))),) if coefficient.denominator != 1 else ()
        rest += tuple(("", factor) for factor in factors)
    return Product(first, rest) if rest else first


def key_node(poly: dict, order):
    """Collected CST: monomials in `order`, then the rest by (-degree, signature); zero → Num('0').

    `order` is first_appearance(...) output; a monomial from it keeps its written spelling, the rest are spelled
    in sorted letter order. A negative first monomial is wrapped in Neg; later signs become '+'/'-'."""
    if not isinstance(poly, Mapping):
        raise ValueError("a polynomial is a mapping of signatures to coefficients")
    entries = {}
    for signature, coefficient in poly.items():
        if type(signature) is not tuple or any(
                type(letter) is not str or len(letter) != 1 or not "a" <= letter <= "z" for letter in signature):
            raise ValueError("a signature is a tuple of letters")
        if tuple(sorted(signature)) != signature:
            raise ValueError("a signature is sorted")
        if type(coefficient) not in (int, Fraction):
            raise ValueError("a coefficient is an int or a Fraction")
        if coefficient:
            entries[signature] = Fraction(coefficient)
    sequence, used = [], set()
    for entry in order:
        signature, spelling = (tuple(part) for part in entry)
        if tuple(sorted(spelling)) != signature:
            raise ValueError("a spelling spells its signature")
        if signature in entries and signature not in used:
            used.add(signature)
            sequence.append((signature, spelling))
    for signature in sorted((s for s in entries if s not in used), key=lambda s: (-len(s), s)):
        sequence.append((signature, signature))
    if not sequence:
        return Num("0")
    built = [(entries[s] < 0, _monomial_node(abs(entries[s]), spelling)) for s, spelling in sequence]
    negative, first = built[0]
    first = Neg(first) if negative else first
    if len(built) == 1:
        return first
    return Sum(first, tuple(("-" if negative else "+", node) for negative, node in built[1:]))


def key_from_result(result: dict, task_node, mapping=None):
    """The key CST of a kernel result, in the task's letters and first-appearance order (§2.8 rule 5) (helper).

    `mapping` must be the one used for to_kernel(task_node); default kernel_mapping(letters_of(task_node))."""
    if mapping is None:
        mapping = kernel_mapping(letters_of(task_node))
    return key_node(_rename(polynomial_of_kernel(result), mapping), first_appearance(task_node))


# --------------------------------------------------------------- house ----

def _non_flat(text):
    return "\\f{" in text or "\\g{" in text or "^{" in text


def to_house(node) -> str:
    """House DSL for the inside of $…$ (§2.8). Never emits ASCII '-'.

    Binary + and − (U+2212) and '=' get one space each side; a leading minus is glued; implicit products are side by
    side; '*' prints ' · ', ':' prints ' : ', '/' prints a stacked \\f{left}{right} over the product so far
    (left-associative); a power prints ^{n}; brackets print as written, as \\g{…} around a fraction or power and as
    plain ( ) otherwise; '%' prints \\% inside the island. A reference must be resolved first (MATH_PARSE)."""
    _check(node)
    text = _house(node)
    if "-" in text:
        _fail("MATH_PARSE", "house text with an ASCII hyphen")
    return text


def _house(node):
    kind = type(node)
    if kind is Num:
        return node.text.replace("%", "\\%")
    if kind is Var:
        return node.name
    if kind is Neg:
        return MINUS + _house(node.operand)
    if kind is Group:
        inner = _house(node.inner)
        return "\\g{" + inner + "}" if _non_flat(inner) else "(" + inner + ")"
    if kind is Sum:
        return _house(node.first) + "".join(
            (" + " if op == "+" else " " + MINUS + " ") + _house(child) for op, child in node.rest)
    if kind is Product:
        text = _house(node.first)
        for op, child in node.rest:
            right = _house(child)
            if op == "":
                text += right
            elif op == "*":
                text += " " + TIMES + " " + right
            elif op == ":":
                text += " : " + right
            else:
                text = "\\f{" + text + "}{" + right + "}"
        return text
    if kind is Power:
        return _house(node.base) + "^{" + str(node.exponent) + "}"
    if kind is Relation:
        return _house(node.left) + " = " + _house(node.right)
    _fail("MATH_PARSE", "resolve references before printing")


def _brace(text, start):
    """text[start] == '{' → (inside, index after its closing brace); MATH_PARSE when unbalanced."""
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1:index], index + 1
    _fail("MATH_PARSE", "unbalanced brace in house notation")


def _house_school(text, depth=0):
    """House DSL → school grammar text (no validation beyond the character set; _from_house re-prints to check)."""
    if depth > MAX_NESTING:
        _fail("MATH_PARSE", "house notation nested too deeply")
    out, index = [], 0
    while index < len(text):
        if text.startswith("\\f{", index):
            top, index = _brace(text, index + 2)
            if not text.startswith("{", index):
                _fail("MATH_PARSE", "fraction without a denominator in house notation")
            bottom, index = _brace(text, index)
            out.append(_house_school(top, depth + 1) + "/" + _house_school(bottom, depth + 1))
        elif text.startswith("\\g{", index):
            inner, index = _brace(text, index + 2)
            out.append("(" + _house_school(inner, depth + 1) + ")")
        elif text.startswith("^{", index):
            inner, index = _brace(text, index + 1)
            out.append("^" + _house_school(inner, depth + 1))
        elif text.startswith("\\%", index):
            out.append("%")
            index += 2
        elif text[index] == " ":
            index += 1
        elif text[index] == MINUS:
            out.append("-")
            index += 1
        elif text[index] == TIMES:
            out.append("*")
            index += 1
        elif text[index] in _HOUSE_PLAIN:
            out.append(text[index])
            index += 1
        else:
            _fail("MATH_PARSE", "character outside the house notation at position %d" % index)
    return "".join(out)


def _from_house(text, letters, allow_relation):
    """Read house text back into its CST; refuse anything that is not exactly to_house of what it reads as."""
    if type(text) is not str:
        _fail("MATH_PARSE", "expected a string")
    if len(text) > 8 * MAX_LENGTH:
        _fail("MATH_LENGTH", "house notation too long")
    school = _house_school(text)
    node = parse(school, letters=letters, allow_relation=allow_relation, max_length=max(len(school), 1))
    if to_house(node) != text:
        _fail("MATH_PARSE", "not the canonical house form of what it reads as")
    return node


def from_house_flat(text: str, *, letters, allow_relation: bool = False):
    """Inverse of to_house for flat output (used by DISPLAY_ROUNDTRIP).

    Flat means no \\f, \\g, ^ or braces (the escaped percent \\% is flat). Anything else is MATH_PARSE: non-flat
    markup, an ASCII '-', '*' or '/', a bare '%', and spacing other than to_house's own."""
    if type(text) is str and any(mark in text for mark in ("\\f", "\\g", "^", "{", "}")):
        _fail("MATH_PARSE", "a fraction, power or stretched bracket is not flat house output")
    return _from_house(text, letters, allow_relation)


def _fields(value):
    if not isinstance(value, Mapping):
        _fail("MATH_PARSE", "expected an object with notation and symbols")
    notation, symbols = value.get("notation"), value.get("symbols")
    if type(notation) is not str:
        _fail("MATH_PARSE", "notation must be a string")
    if type(symbols) not in (list, tuple):
        _fail("MATH_SYMBOL_UNDECLARED", "symbols must be a list of letters")
    return notation, symbols


def display_island(span: dict) -> str:
    """'$' + to_house(parse(span['notation'], letters=span['symbols'], allow_relation=True)) + '$'."""
    notation, symbols = _fields(span)
    return "$" + to_house(parse(notation, letters=symbols, allow_relation=True)) + "$"


def key_island(key: dict) -> str:
    """'$' + to_house(parse(key['notation'], letters=key['symbols'])) + '$'."""
    notation, symbols = _fields(key)
    return "$" + to_house(parse(notation, letters=symbols)) + "$"


def key_roundtrip(key: dict, result: dict, mapping=None) -> bool:
    """KEY_ROUNDTRIP: the printed key, re-read from its island text, equals the kernel result (helper).

    `key` is an IR answer.key ({"notation", "symbols", ...}); `result` the kernel result AST
    (validate_and_solve_task(task)["result"]["value"]); `mapping` as used for the task. True iff the notation parses
    exactly as key_island parses it and is canonical (unparse(parse(n)) == n), the island text to_house(node) reads
    back to the same CST, and kernel_equal(that CST, result, mapping). Never raises for bad data."""
    try:
        notation, symbols = _fields(key)
        node = parse(notation, letters=symbols)
        if unparse(node) != notation:
            return False
        printed = _from_house(to_house(node), symbols, False)
        return printed == node and kernel_equal(printed, result, mapping)
    except SchoolMathError:
        return False
