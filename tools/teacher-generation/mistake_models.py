"""Named student mistakes for v5 ``find_error_collect`` items (V5-DESIGN.md sections 2.7 and 3).

A find-the-error item prints a sum of monomials and a wrong result a student
"wrote". The wrong result is never free model text: it must be exactly what one
named mistake model produces from the printed sum (plan section c1, P8). Each
model is deterministic and acts on the terms of a monomial sum as written:

- M1  unlike terms added: every signed coefficient and constant is added into
      ONE term carrying the first letter signature. ``4a+3+a+2`` -> ``10a``.
      Preconditions: at least two distinct signatures; the sum K is not 0.
- M2  sign error: the first term joined by a binary minus is taken as plus.
      ``6x+7-1-2x`` -> ``4x+8``. Precondition: such a term exists.
- M3  coefficient 1 treated as 0: the first term written without a numeric
      coefficient (a bare letter or letters, implicit 1, of either sign) that has
      a like term elsewhere is dropped. ``5b+2a+b`` -> ``5b+2a``.
      Precondition: such a term exists.

apply() checks only these structural preconditions; item_kinds compares the
result with the correct key (MISTAKE_NOT_WRONG) and prints the wrong result in
canonical form. verify_wrong() decides MISTAKE_UNMODELED: the written wrong
result must have exactly the polynomial the named model produces.

Input nodes are school_math CST nodes (section 2.4: Num, Var, Neg, Group, Sum,
Product, ...). They are read by node class name and field, so this module needs
no import beyond the standard library. A monomial sum is a Sum or a single term;
each term is Num, Var, a Product of an optional leading Num and 1-2 distinct Vars
joined implicitly, or Group(Neg(Num)); the first term may be wrapped in Neg.

Polynomials are {signature: Fraction}: a signature is the sorted tuple of the
term's letters (() for a constant); zero coefficients are dropped, so the zero
polynomial is {}. Keys appear in first written order, so results are
deterministic. No code here holds or reports model text (G11).
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

MISTAKES = ("M1", "M2", "M3")
CODES = ("MISTAKE_UNKNOWN", "MISTAKE_NOT_APPLICABLE", "MISTAKE_UNMODELED")


class MistakeError(ValueError):
    """code ∈ MISTAKE_UNKNOWN, MISTAKE_NOT_APPLICABLE (apply), MISTAKE_UNMODELED (verify_wrong)."""

    def __init__(self, code: str, message: str = ""):
        super().__init__(code if not message else f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass(frozen=True)
class WrittenTerm:
    """One term of a monomial sum as written: ``op`` is '' for the first term (even when it is
    wrapped in a leading unary minus), else '+' or '-'; ``sign`` is the term's resulting sign."""
    op: str
    sign: int
    coefficient: Fraction
    signature: tuple
    implicit_one: bool


def _kind(node):
    return type(node).__name__


def _literal(text):
    if not isinstance(text, str) or not text:
        raise MistakeError("MISTAKE_NOT_APPLICABLE", "not a number literal")
    try:
        return Fraction(text[:-1]) / 100 if text.endswith("%") else Fraction(text)
    except (ValueError, ZeroDivisionError):
        raise MistakeError("MISTAKE_NOT_APPLICABLE", "not a number literal") from None


def _term(node):
    """(sign, coefficient, signature, implicit_one) of one monomial term (no leading Neg)."""
    kind = _kind(node)
    if kind == "Num":
        return 1, _literal(node.text), (), False
    if kind == "Var":
        return 1, Fraction(1), (node.name,), True
    if kind == "Group" and _kind(node.inner) == "Neg" and _kind(node.inner.operand) == "Num":
        return -1, _literal(node.inner.operand.text), (), False
    if kind == "Product":
        rest = tuple(node.rest)
        if any(op != "" for op, _ in rest):
            raise MistakeError("MISTAKE_NOT_APPLICABLE", "not a monomial")
        factors = [node.first] + [factor for _, factor in rest]
        coefficient, implicit = Fraction(1), True
        if _kind(factors[0]) == "Num":
            coefficient, implicit = _literal(factors[0].text), False
            factors = factors[1:]
        names = [factor.name for factor in factors if _kind(factor) == "Var"]
        if len(names) != len(factors) or not 1 <= len(names) <= 2 or len(set(names)) != len(names):
            raise MistakeError("MISTAKE_NOT_APPLICABLE", "not a monomial")
        return 1, coefficient, tuple(sorted(names)), implicit
    raise MistakeError("MISTAKE_NOT_APPLICABLE", "not a monomial sum")


def written_terms(node) -> tuple:
    """The WrittenTerm tuple of a monomial sum, in written order; anything else → MISTAKE_NOT_APPLICABLE."""
    if _kind(node) == "Sum":
        rest = tuple(node.rest)
        if not rest or any(op not in ("+", "-") for op, _ in rest):
            raise MistakeError("MISTAKE_NOT_APPLICABLE", "not a monomial sum")
        pieces = [("", node.first)] + list(rest)
    else:
        pieces = [("", node)]
    out = []
    for index, (op, piece) in enumerate(pieces):
        lead = 1
        if index == 0 and _kind(piece) == "Neg":
            lead, piece = -1, piece.operand
        sign, coefficient, signature, implicit = _term(piece)
        out.append(WrittenTerm(op, sign * lead * (-1 if op == "-" else 1), coefficient, signature, implicit))
    return tuple(out)


def _collect(pairs):
    """{signature: Fraction} from (signature, signed value) pairs: first written order, zeros dropped."""
    poly = {}
    for signature, value in pairs:
        poly[signature] = poly.get(signature, Fraction(0)) + value
    return {signature: value for signature, value in poly.items() if value != 0}


def polynomial(node) -> dict:
    """The correct polynomial of a monomial sum (no mistake)."""
    return _collect((t.signature, t.sign * t.coefficient) for t in written_terms(node))


def _m1(terms):
    if len({t.signature for t in terms}) < 2:
        raise MistakeError("MISTAKE_NOT_APPLICABLE", "M1 needs two distinct signatures")
    total = sum((t.sign * t.coefficient for t in terms), Fraction(0))
    if total == 0:
        raise MistakeError("MISTAKE_NOT_APPLICABLE", "M1 sum is zero")
    first = next(t.signature for t in terms if t.signature)
    return {first: total}


def _m2(terms):
    for index, term in enumerate(terms):
        if term.op == "-":
            return _collect((t.signature, (-1 if i == index else 1) * t.sign * t.coefficient)
                            for i, t in enumerate(terms))
    raise MistakeError("MISTAKE_NOT_APPLICABLE", "M2 needs a term joined by a binary minus")


def _m3(terms):
    for index, term in enumerate(terms):
        if term.implicit_one and any(i != index and t.signature == term.signature for i, t in enumerate(terms)):
            return _collect((t.signature, t.sign * t.coefficient) for i, t in enumerate(terms) if i != index)
    raise MistakeError("MISTAKE_NOT_APPLICABLE", "M3 needs an implicit-1 term with a like term")


_MODELS = {"M1": _m1, "M2": _m2, "M3": _m3}


def apply(model: str, node) -> dict:
    """The student's polynomial {signature: Fraction} under `model` (§2.7); checks preconditions only."""
    if not isinstance(model, str) or model not in _MODELS:
        raise MistakeError("MISTAKE_UNKNOWN", "unknown mistake model")
    return _MODELS[model](written_terms(node))


def verify_wrong(model: str, node, wrong) -> dict:
    """M(node) when the written wrong result `wrong` (a monomial sum CST) has exactly that polynomial.

    Raises MistakeError MISTAKE_UNKNOWN / MISTAKE_NOT_APPLICABLE from apply(), and
    MISTAKE_UNMODELED when `wrong` is no monomial sum or its polynomial differs.
    """
    expected = apply(model, node)
    try:
        written = polynomial(wrong)
    except MistakeError:
        raise MistakeError("MISTAKE_UNMODELED", "the wrong result is not a monomial sum") from None
    if written != expected:
        raise MistakeError("MISTAKE_UNMODELED", "the wrong result is not what the named model produces")
    return expected
