"""Exact, bounded computation for data-only worksheet tasks.

This kernel verifies the typed task it returns as ``question``. It neither
accepts prose/claimed answers nor verifies pedagogy, geometry, proofs, or that
some separately authored sentence describes this task. Render the returned
question and computed result together. Original denominator restrictions are
retained even when algebraic cancellation removes them.

No model string is parsed as Python, a SymPy expression, or markup.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from math import gcd
from fractions import Fraction
from functools import cmp_to_key
from collections import Counter
from typing import Any

import sympy as S

MAX_NODES = 128
MAX_DEPTH = 12
MAX_INPUT_INTEGER = 1_000_000
MAX_RESULT_INTEGER = 1_000_000_000_000
MAX_POWER = 4
MAX_DEGREE = 8
MAX_COEFFICIENT_BITS = 160
MAX_RESULT_NODES = 512
MAX_RESULT_DEPTH = 24
# Bound algebraic expansion *before* constructing SymPy expressions. Degree
# alone misses products of radical sums: they have symbolic degree zero.
MAX_EXPANDED_TERMS = 64
MAX_RADICAL_ATOMS = 4
SYMBOLS = {name: S.Symbol(name, real=True) for name in ("x", "y", "a", "b")}
BINARY = frozenset(("add", "subtract", "multiply", "divide", "power"))


class MathTaskError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def fail(code: str, message: str):
    raise MathTaskError(code, message)


def exact(value, keys, label):
    if type(value) is not dict or set(value) != set(keys):
        fail("INVALID_TASK", label + " has unexpected fields")


def integer(value, bound, label):
    if type(value) is not int or abs(value) > bound:
        fail("INVALID_AST", label + " must be a bounded integer")
    return value


def number(n: int, d: int = 1):
    if d == 0:
        fail("UNDEFINED_TASK", "Zero denominator")
    if d < 0:
        n, d = -n, -d
    g = gcd(n, d)
    return {"type": "number", "numerator": n // g, "denominator": d // g}


def operation(op, *args):
    return {"type": "operation", "op": op, "args": list(args)}


@dataclass
class Budget:
    nodes: int = 0
    result: bool = False

    def visit(self, depth):
        self.nodes += 1
        if self.nodes > (MAX_RESULT_NODES if self.result else MAX_NODES) or depth > (MAX_RESULT_DEPTH if self.result else MAX_DEPTH):
            fail("RESOURCE_LIMIT", "Expression tree exceeds its node or depth budget")


def inspect_ast(ast, budget=None, depth=0):
    """Validate shape before any mathematical construction; strings are enums only."""
    budget = budget or Budget()
    budget.visit(depth)
    if type(ast) is not dict or type(ast.get("type")) is not str:
        fail("INVALID_AST", "Expected a typed expression object")
    kind = ast["type"]
    if kind == "number":
        exact(ast, ("type", "numerator", "denominator"), "number")
        bound = MAX_RESULT_INTEGER if budget.result else MAX_INPUT_INTEGER
        integer(ast["numerator"], bound, "numerator")
        integer(ast["denominator"], bound, "denominator")
        if ast["denominator"] <= 0:
            fail("INVALID_AST", "Number denominator must be positive")
    elif kind == "symbol":
        exact(ast, ("type", "name"), "symbol")
        if type(ast["name"]) is not str or ast["name"] not in SYMBOLS:
            fail("INVALID_AST", "Unknown symbol")
    elif kind == "operation":
        exact(ast, ("type", "op", "args"), "operation")
        op = ast["op"]
        if type(op) is not str or op not in BINARY | {"sqrt"}:
            fail("INVALID_AST", "Unknown operation")
        if type(ast["args"]) is not list or not (
            2 <= len(ast["args"]) <= 6 if op in ("add", "multiply") else len(ast["args"]) == (1 if op == "sqrt" else 2)
        ):
            fail("INVALID_AST", "Incorrect operation arity")
        for arg in ast["args"]:
            inspect_ast(arg, budget, depth + 1)
        if op == "power":
            exponent = ast["args"][1]
            limit = MAX_DEGREE if budget.result else MAX_POWER
            if exponent["type"] != "number" or exponent["denominator"] != 1 or abs(exponent["numerator"]) > limit:
                fail("UNSUPPORTED_POWER", "Power requires a bounded integer literal exponent")
    else:
        fail("INVALID_AST", "Unknown expression type")
    return ast


@dataclass(frozen=True)
class AlgebraCost:
    numerator_terms: int = 1
    denominator_terms: int = 1
    radicals: frozenset = frozenset()


def _fingerprint(ast):
    if ast["type"] == "number":
        return ("number", ast["numerator"], ast["denominator"])
    if ast["type"] == "symbol":
        return ("symbol", ast["name"])
    return (ast["op"], tuple(_fingerprint(arg) for arg in ast["args"]))


def _bounded_cost(numerator, denominator, radicals):
    if max(numerator, denominator) > MAX_EXPANDED_TERMS:
        fail("RESOURCE_LIMIT", "Potential algebraic expansion exceeds the term budget")
    if len(radicals) > MAX_RADICAL_ATOMS:
        fail("RESOURCE_LIMIT", "Expression exceeds the distinct radical budget")
    return AlgebraCost(numerator, denominator, radicals)


def _combine_cost(left, right, op):
    radicals = left.radicals | right.radicals
    ln, ld = left.numerator_terms, left.denominator_terms
    rn, rd = right.numerator_terms, right.denominator_terms
    if op in ("add", "subtract"):
        return _bounded_cost(ln * rd + rn * ld, ld * rd, radicals)
    if op == "multiply":
        return _bounded_cost(ln * rn, ld * rd, radicals)
    return _bounded_cost(ln * rd, ld * rn, radicals)


def _algebra_cost(ast):
    """Pure AST upper bound, before constructors or simplify/factor/expand.

    Numerator/denominator term counts intentionally ignore cancellations and
    repeated monomials. Distinct sqrt syntax is a conservative radical-rank
    bound; no factorization or symbolic equality is needed to enforce it.
    """
    if ast["type"] in ("number", "symbol"):
        return AlgebraCost()
    op, args = ast["op"], ast["args"]
    if op in ("add", "multiply") and len(args) > 2:
        return _algebra_cost(_fold(op, args))
    left = _algebra_cost(args[0])
    if op == "sqrt":
        return _bounded_cost(1, 1, left.radicals | {_fingerprint(ast)})
    if op == "power":
        exponent = args[1]["numerator"]
        numerator, denominator = left.numerator_terms, left.denominator_terms
        if exponent < 0:
            numerator, denominator = denominator, numerator
        return _bounded_cost(numerator ** abs(exponent), denominator ** abs(exponent), left.radicals)
    return _combine_cost(left, _algebra_cost(args[1]), op)


@dataclass
class Compiled:
    expr: Any
    numerator_degree: int
    denominator_degree: int
    bits: int


class Compiler:
    def __init__(self):
        self.conditions = []

    def nonzero(self, ast, expression):
        if expression == 0:
            fail("UNDEFINED_TASK", "An original denominator is zero")
        if expression.is_zero is not False:
            self.conditions.append({"kind": "nonzero", "expression": deepcopy(ast)})

    def compile(self, ast):
        kind = ast["type"]
        if kind == "number":
            n, d = ast["numerator"], ast["denominator"]
            return Compiled(S.Rational(n, d), 0, 0, max(abs(n).bit_length(), d.bit_length(), 1))
        if kind == "symbol":
            return Compiled(SYMBOLS[ast["name"]], 1, 0, 1)
        op, args = ast["op"], ast["args"]
        if op in ("add", "multiply") and len(args) > 2:
            return self.compile(_fold(op, args))
        left = self.compile(args[0])
        right = self.compile(args[1]) if len(args) == 2 else None
        ln, ld = left.numerator_degree, left.denominator_degree
        if op == "sqrt":
            if left.expr.free_symbols:
                fail("UNSUPPORTED_SYMBOLIC_ROOT", "Symbolic radicals require a separate domain solver")
            if not left.expr.is_Rational or left.expr < 0:
                fail("UNSUPPORTED_ROOT", "Only nonnegative rational radicands are supported")
            if max(abs(int(left.expr.p)), int(left.expr.q)) > MAX_RESULT_INTEGER:
                fail("RESOURCE_LIMIT", "Radicand exceeds the exact-root budget")
            return Compiled(S.sqrt(left.expr), 0, 0, left.bits)
        rn, rd = right.numerator_degree, right.denominator_degree
        if op in ("add", "subtract"):
            nd, dd, bits = max(ln + rd, rn + ld), ld + rd, left.bits + right.bits + 1
        elif op == "multiply":
            nd, dd, bits = ln + rn, ld + rd, left.bits + right.bits
        elif op == "divide":
            nd, dd, bits = ln + rd, ld + rn, left.bits + right.bits
        else:
            exponent = args[1]["numerator"]
            nd, dd = ((ln, ld) if exponent >= 0 else (ld, ln))
            nd, dd, bits = nd * abs(exponent), dd * abs(exponent), max(1, left.bits * abs(exponent))
        if max(nd, dd) > MAX_DEGREE or bits > MAX_COEFFICIENT_BITS:
            fail("RESOURCE_LIMIT", "Polynomial degree or coefficient budget exceeded")
        if op == "add":
            expr = left.expr + right.expr
        elif op == "subtract":
            expr = left.expr - right.expr
        elif op == "multiply":
            expr = left.expr * right.expr
        elif op == "divide":
            self.nonzero(args[1], right.expr)
            expr = left.expr / right.expr
        else:
            if exponent <= 0:
                self.nonzero(args[0], left.expr)
            expr = left.expr ** exponent
        if expr.has(S.zoo, S.oo, -S.oo, S.nan):
            fail("UNDEFINED_TASK", "Task has a nonfinite value")
        return Compiled(expr, nd, dd, bits)


def _fold(op, args):
    if len(args) == 1:
        return args[0]
    mid = len(args) // 2
    return operation(op, _fold(op, args[:mid]), _fold(op, args[mid:]))


def _canonical_ast(ast, *, share_leaves=False):
    """Only exact associativity; preserve operand order and every operand.

    Shape is already validated. Original task/conditions remain untouched;
    normalized trees are checked separately before any SymPy construction.
    """
    if ast["type"] != "operation":
        return ast if share_leaves else deepcopy(ast)
    args = [_canonical_ast(arg, share_leaves=share_leaves) for arg in ast["args"]]
    return _fold(ast["op"], args) if ast["op"] in ("add", "multiply") else operation(ast["op"], *args)


def _check_canonical_budget(expressions, result=False):
    budget = Budget(result=result)
    for expression in expressions:
        inspect_ast(_canonical_ast(expression), budget)


def _ast(expression):
    """Serialize only constructors in this closed exact-real algebra."""
    if expression.is_Rational:
        n, d = int(expression.p), int(expression.q)
        if max(abs(n), d) > MAX_RESULT_INTEGER:
            fail("RESOURCE_LIMIT", "Computed value exceeds the printable number budget")
        return number(n, d)
    if expression.is_Symbol and expression in SYMBOLS.values():
        return {"type": "symbol", "name": str(expression)}
    if expression.is_Add:
        return _fold("add", [_ast(x) for x in expression.as_ordered_terms()])
    if expression.is_Mul:
        return _fold("multiply", [_ast(x) for x in expression.as_ordered_factors()])
    if expression.is_Pow:
        base, exponent = expression.args
        if exponent == S.Rational(1, 2):
            return operation("sqrt", _ast(base))
        if exponent.is_Integer and abs(exponent) <= MAX_DEGREE:
            if exponent < 0:
                denominator = _ast(base) if exponent == -1 else operation("power", _ast(base), number(int(-exponent)))
                return operation("divide", number(1), denominator)
            return operation("power", _ast(base), number(int(exponent)))
    fail("UNSUPPORTED_RESULT", "Result cannot be represented in the exact real expression grammar")


def _result_ast(expression):
    ast = _ast(expression)
    inspect_ast(ast, Budget(result=True))
    return ast


def to_house_math(ast, *, number_spellings=None, schoolbook=False) -> str:
    r"""Compile a bounded AST to the skill's math-island *contents*, without $.

    Uses stacked \f{}, \sqrt{}, stretched \g{} parentheses, and middle-school
    multiplication ·. Elementary callers must use their grade's sign renderer.
    Never pass model-authored markup in place of an AST.

    ``schoolbook`` writes a coefficient next to what it multiplies, as a key
    is written by hand: 5x, 2\g{x + 1}, xy. A product of two numbers and a
    number that follows a letter keep the dot, so no two digits ever fuse.
    """
    inspect_ast(ast, Budget(result=True))

    ast = _canonical_ast(ast, share_leaves=bool(number_spellings))
    inspect_ast(ast, Budget(result=True))

    def emit(node):
        kind = node["type"]
        if kind == "number":
            if number_spellings:
                from numeric_literals import printed_number
                spelling = printed_number(node, number_spellings)
                if spelling is not None:
                    return spelling.replace("-", "−")
            n, d = node["numerator"], node["denominator"]
            sign = "−" if n < 0 else ""
            return sign + (str(abs(n)) if d == 1 else r"\f{" + str(abs(n)) + "}{" + str(d) + "}")
        if kind == "symbol":
            return node["name"]
        op, args = node["op"], node["args"]
        parts = [emit(arg) for arg in args]
        group = lambda text: r"\g{" + text + "}"
        def additive(child):
            return child['type']=='operation' and child['op'] in ('add','subtract')
        def negative(child):
            return (child['type']=='number' and child['numerator']<0) or (
                child['type']=='operation' and child['op']=='multiply'
                and child['args'][0]['type']=='number' and child['args'][0]['numerator']<0)
        def letter_led(child):
            # What a reader sees first: a letter, a bracket or a root sign.
            if child['type']=='symbol':
                return True
            if child['type']!='operation':
                return False
            if child['op'] in ('add','subtract','sqrt'):
                return True
            return child['op'] in ('power','multiply') and letter_led(child['args'][0])
        def base(child):
            # The letter of x or of x^n; a product ends with its last factor.
            if child['type']=='symbol':
                return child['name']
            if child['type']=='operation' and child['op']=='power':
                return base(child['args'][0])
            if child['type']=='operation' and child['op']=='multiply':
                return base(child['args'][-1])
            return None
        def juxtaposed(first, second):
            if not letter_led(second) or (second['type']=='operation' and second['op']=='power'
                                          and second['args'][0]['type']!='symbol' and not additive(second['args'][0])):
                return False
            if base(first) is not None and base(first)==base(second):
                return False  # x · x^3 keeps its sign; xx^3 would hide the law being used
            if first['type']=='number':
                return first['denominator']==1
            if first['type']=='symbol':
                return True
            return first['type']=='operation' and (
                first['op']=='power' and first['args'][0]['type']=='symbol'
                or first['op']=='multiply' and juxtaposed(*first['args'][:2])
                or additive(first) and additive(second))
        if op == "sqrt":
            return r"\sqrt{" + parts[0] + "}"
        if op == "divide":
            return r"\f{" + parts[0] + "}{" + parts[1] + "}"
        if op == "power":
            base=parts[0]
            if args[0]['type']=='operation' or negative(args[0]):
                base=group(base)
            return base + "^{" + parts[1] + "}"
        if op in ("add", "subtract"):
            right=parts[1]
            operator=" + " if op=='add' else " − "
            if (negative(args[1]) or (schoolbook and op=='add')) and right.startswith('−'):
                # a + (−b + c) is written a − b + c; the sign belongs to the first term.
                operator=" − " if op=='add' else " + "
                right=right[1:]
            elif op=='subtract' and additive(args[1]):
                right=group(right)
            return parts[0]+operator+right
        left=group(parts[0]) if additive(args[0]) else parts[0]
        right=group(parts[1]) if additive(args[1]) or negative(args[1]) else parts[1]
        # Unary negation is printed as a sign rather than (-1)·(expression).
        if args[0]=={'type':'number','numerator':-1,'denominator':1} and not (number_spellings and id(args[0]) in number_spellings):
            return '−'+right
        if schoolbook and juxtaposed(args[0], args[1]) and not right.startswith('−'):
            return left+right
        return left+" · "+right

    return emit(ast)


def _original_symbols(ast):
    if ast["type"] == "symbol":
        return {SYMBOLS[ast["name"]]}
    if ast["type"] == "operation":
        return set().union(*(_original_symbols(arg) for arg in ast["args"]))
    return set()


def _conditions(compiler):
    # Equality on bounded dictionaries preserves first appearance, independent
    # of SymPy simplification or model-provided condition strings.
    result = []
    for condition in compiler.conditions:
        if condition not in result:
            result.append(condition)
    return result


def _rational_polynomial(expression, variable, degree=2):
    numerator, denominator = S.fraction(S.together(expression))
    try:
        np, dp = S.Poly(numerator, variable), S.Poly(denominator, variable)
    except S.PolynomialError:
        fail("UNSUPPORTED_EQUATION", "Equation is not rational-polynomial")
    if any(not coefficient.is_Rational for p in (np, dp) for coefficient in p.all_coeffs()):
        fail("UNSUPPORTED_EQUATION", "Equation coefficients must be rational")
    if np.degree() > degree or dp.degree() > degree:
        fail("UNSUPPORTED_EQUATION", "Equation degree exceeds the quadratic solver")
    return np, dp


def _real_roots(poly):
    if poly.is_zero:
        return None
    degree = poly.degree()
    if degree == 0:
        return []
    if degree == 1:
        a, b = poly.all_coeffs()
        return [-b / a]
    a, b, c = poly.all_coeffs()
    discriminant = b * b - 4 * a * c
    if discriminant < 0:
        return []
    if max(abs(int(discriminant.p)), int(discriminant.q)) > MAX_RESULT_INTEGER:
        fail("RESOURCE_LIMIT", "Quadratic discriminant exceeds the exact-root budget")
    delta = S.sqrt(discriminant)
    roots = [S.cancel((-b - delta) / (2 * a)), S.cancel((-b + delta) / (2 * a))]
    return list(dict.fromkeys(roots))


def _truth_at(condition, variable, value):
    compiler = Compiler()
    expression = compiler.compile(condition["expression"]).expr.subs(variable, value)
    if expression.has(S.zoo, S.nan, S.oo, -S.oo) or expression.is_zero is True:
        return False
    if expression.is_zero is None:
        fail("UNSUPPORTED_DOMAIN", "A domain restriction cannot be decided exactly")
    return True


def _solve(left, right, variable, conditions):
    symbols = left.free_symbols | right.free_symbols
    for condition in conditions:
        symbols |= Compiler().compile(condition["expression"]).expr.free_symbols
    if symbols - {variable}:
        fail("UNSUPPORTED_EQUATION", "Solve requires exactly one declared variable and rational coefficients")
    excluded = []
    for condition in conditions:
        expr = Compiler().compile(condition["expression"]).expr
        num, _ = _rational_polynomial(expr, variable)
        roots = _real_roots(num)
        if roots is None:
            fail("EMPTY_DOMAIN", "An original denominator vanishes throughout the domain")
        excluded.extend(roots)
    polynomial, _ = _rational_polynomial(left - right, variable)
    candidates = _real_roots(polynomial)
    if candidates is None:
        return {"type": "solutions", "classification": "identity", "variable": str(variable), "values": [],
                "excludedValues": [_result_ast(x) for x in dict.fromkeys(excluded)]}
    values = []
    for candidate in candidates:
        if all(_truth_at(c, variable, candidate) for c in conditions):
            residual = S.cancel(left.subs(variable, candidate) - right.subs(variable, candidate))
            if residual != 0:
                fail("UNVERIFIED_SOLUTION", "Root does not satisfy the original expression")
            values.append(_result_ast(candidate))
    return {"type": "solutions", "classification": "finite" if values else "none", "variable": str(variable),
            "values": values, "excludedValues": [_result_ast(x) for x in dict.fromkeys(excluded)]}


def _rational_shape(ast):
    """Conservative degree/bit bounds using JSON integers, before SymPy calls.

    New system/inequality solvers only admit rational coefficients. Unlike the
    general algebra kernel, no radical constructor is allowed in these inputs.
    """
    if ast["type"] == "number":
        return 0, 0, max(abs(ast["numerator"]).bit_length(), ast["denominator"].bit_length(), 1)
    if ast["type"] == "symbol":
        return 1, 0, 1
    op, args = ast["op"], ast["args"]
    if op in ("add", "multiply") and len(args) > 2:
        return _rational_shape(_fold(op, args))
    if op == "sqrt":
        fail("UNSUPPORTED_EQUATION", "Solver input requires rational coefficients")
    ln, ld, lb = _rational_shape(args[0])
    rn, rd, rb = _rational_shape(args[1])
    if op in ("add", "subtract"):
        nd, dd, bits = max(ln + rd, rn + ld), ld + rd, lb + rb + 1
    elif op == "multiply":
        nd, dd, bits = ln + rn, ld + rd, lb + rb
    elif op == "divide":
        nd, dd, bits = ln + rd, ld + rn, lb + rb
    else:
        exponent = args[1]["numerator"]
        nd, dd = (ln, ld) if exponent >= 0 else (ld, ln)
        nd, dd, bits = nd * abs(exponent), dd * abs(exponent), max(1, lb * abs(exponent))
    if max(nd, dd) > 2:
        fail("UNSUPPORTED_EQUATION", "Original expression exceeds degree two")
    if bits > 64:
        fail("RESOURCE_LIMIT", "Solver coefficient bound exceeded")
    return nd, dd, bits


def _checked_solver_expressions(expressions):
    budget = Budget()
    for expression in expressions:
        inspect_ast(expression, budget)
    _check_canonical_budget(expressions)
    shapes = [_rational_shape(expression) for expression in expressions]
    costs = [_algebra_cost(expression) for expression in expressions]
    for index in range(0, len(costs), 2):
        _combine_cost(costs[index], costs[index + 1], "subtract")
    return shapes


def _pack_task(task, question_math, variables, conditions, result, method):
    return {"version": 1, "question": deepcopy(task), "questionMath": question_math,
            "domain": {"numberSystem": "real", "variables": sorted(variables), "conditions": conditions},
            "result": result, "verification": {"method": method, "scope": "typed task only"}}


def _solve_system_task(task):
    exact(task, ("kind", "variables", "equations"), "system")
    names, equations = task["variables"], task["equations"]
    if type(names) is not list or len(names) != 2 or any(type(n) is not str or n not in SYMBOLS for n in names) or len(set(names)) != 2:
        fail("INVALID_TASK", "System requires two distinct declared variables")
    if type(equations) is not list or len(equations) != 2:
        fail("INVALID_TASK", "System requires exactly two equations")
    for equation in equations:
        exact(equation, ("lhs", "rhs"), "system equation")
    expressions = [equation[side] for equation in equations for side in ("lhs", "rhs")]
    shapes = _checked_solver_expressions(expressions)
    if any(denominator_degree for _, denominator_degree, _ in shapes):
        fail("UNSUPPORTED_EQUATION", "System solver requires polynomial expressions")
    variables = [SYMBOLS[name] for name in names]
    if set().union(*(_original_symbols(expr) for expr in expressions)) - set(variables):
        fail("UNSUPPORTED_EQUATION", "System contains an undeclared variable")
    compiler = Compiler()
    compiled = [compiler.compile(expr).expr for expr in expressions]
    differences = [compiled[0] - compiled[1], compiled[2] - compiled[3]]
    polynomials = [S.Poly(expr, *variables) for expr in differences]
    if any(poly.total_degree() > 2 or any(not c.is_Rational for c in poly.coeffs()) for poly in polynomials):
        fail("UNSUPPORTED_EQUATION", "System requires degree-two rational polynomials")
    # Two quadratics can eliminate to a quartic. Its radical representation and
    # reality queries can be expensive even for tiny input coefficients. Check
    # both elimination directions with rational polynomial arithmetic first;
    # repeated factors do not add distinct roots (x²=1,y²=4 remains supported).
    for eliminated, remaining in ((variables[0], variables[1]), (variables[1], variables[0])):
        resultant = S.Poly(S.resultant(differences[0], differences[1], eliminated), remaining)
        if resultant.is_zero:
            fail("UNSUPPORTED_SYSTEM", "System lacks a bounded finite elimination certificate")
        if resultant.sqf_part().degree() > 2:
            fail("UNSUPPORTED_SYSTEM", "System elimination exceeds quadratic exact-root budget")
    try:
        solutions = S.solve_poly_system(differences, *variables, strict=True)
    except (NotImplementedError, S.PolynomialError, ValueError):
        fail("UNSUPPORTED_SYSTEM", "System does not have a supported finite exact solution set")
    if solutions is None:
        solutions = []
    if len(solutions) > 4:
        fail("RESOURCE_LIMIT", "System solution count exceeds Bezout bound")
    accepted = []
    for solution in solutions:
        if any(value.is_real is False for value in solution):
            continue
        if any(value.is_real is not True for value in solution):
            fail("UNSUPPORTED_SYSTEM", "Reality of a system root cannot be established exactly")
        substitutions = dict(zip(variables, solution))
        if any(S.simplify(expr.subs(substitutions, simultaneous=True)) != 0 for expr in differences):
            fail("UNVERIFIED_SOLUTION", "System root failed original-equation substitution")
        accepted.append({name: _result_ast(value) for name, value in zip(names, solution)})
    return _pack_task(task, {"equations": [{side: to_house_math(eq[side]) for side in ("lhs", "rhs")} for eq in equations]},
                      names, _conditions(compiler), {"type": "system", "variables": names[:],
                      "classification": "finite" if accepted else "none", "solutions": accepted},
                      "finite degree-two rational polynomial system; exact original-equation substitution")


def _compare_exact(left, right):
    delta = S.simplify(left - right)
    if delta == 0:
        return 0
    if delta.is_negative is True:
        return -1
    if delta.is_positive is True:
        return 1
    fail("UNSUPPORTED_COMPARISON", "Exact critical-point ordering cannot be established")


def _inequality_task(task):
    exact(task, ("kind", "variable", "lhs", "rhs", "relation"), "inequality")
    name, relation = task["variable"], task["relation"]
    if type(name) is not str or name not in SYMBOLS or type(relation) is not str or relation not in ("lt", "le", "gt", "ge"):
        fail("INVALID_TASK", "Inequality requires a declared variable and supported relation")
    expressions = [task["lhs"], task["rhs"]]
    _checked_solver_expressions(expressions)
    variable = SYMBOLS[name]
    if set().union(*(_original_symbols(expr) for expr in expressions)) - {variable}:
        fail("UNSUPPORTED_EQUATION", "Inequality contains an undeclared variable")
    compiler = Compiler()
    left, right = [compiler.compile(expr).expr for expr in expressions]
    conditions = _conditions(compiler)
    if len(conditions) > 8:
        fail("RESOURCE_LIMIT", "Too many original domain restrictions")
    polynomial, denominator = _rational_polynomial(left - right, variable)
    points = (_real_roots(polynomial) or []) + (_real_roots(denominator) or [])
    for condition in conditions:
        expression = Compiler().compile(condition["expression"]).expr
        numerator, _ = _rational_polynomial(expression, variable)
        roots = _real_roots(numerator)
        if roots is None:
            fail("EMPTY_DOMAIN", "Original domain is empty")
        points.extend(roots)
    points = sorted(set(points), key=cmp_to_key(_compare_exact))
    def holds(value):
        if not all(_truth_at(condition, variable, value) for condition in conditions):
            return False
        delta = S.cancel((left - right).subs(variable, value))
        if delta.has(S.zoo, S.oo, -S.oo, S.nan):
            return False
        sign = _compare_exact(delta, S.Integer(0))
        return {"lt": sign < 0, "le": sign <= 0, "gt": sign > 0, "ge": sign >= 0}[relation]
    intervals = []
    def append(lower, upper, lower_closed, upper_closed):
        if intervals and lower is not None and intervals[-1][1] == lower and (intervals[-1][3] or lower_closed):
            intervals[-1][1], intervals[-1][3] = upper, upper_closed
        else:
            intervals.append([lower, upper, lower_closed, upper_closed])
    for index in range(len(points) + 1):
        lower = points[index - 1] if index else None
        upper = points[index] if index < len(points) else None
        sample = S.Integer(0) if lower is None and upper is None else upper - 1 if lower is None else lower + 1 if upper is None else (lower + upper) / 2
        if holds(sample):
            append(lower, upper, False, False)
        if upper is not None and holds(upper):
            append(upper, upper, True, True)
    result = {"type": "intervals", "variable": name, "intervals": [
        {"lower": None if lower is None else _result_ast(lower), "upper": None if upper is None else _result_ast(upper),
         "lowerClosed": lc, "upperClosed": uc} for lower, upper, lc, uc in intervals]}
    return _pack_task(task, {"lhs": to_house_math(task["lhs"]), "rhs": to_house_math(task["rhs"])}, [name], conditions, result,
                      "exact rational quadratic sign chart; original domain exclusions and endpoint tests")


def _statistics_task(task):
    exact(task, ("kind", "operation", "values"), "statistics")
    operation_name, values = task["operation"], task["values"]
    if type(operation_name) is not str or operation_name not in ("mean", "median", "mode", "range", "sort"):
        fail("INVALID_TASK", "Unknown statistics operation")
    if type(values) is not list or not 1 <= len(values) <= 64:
        fail("INVALID_TASK", "Statistics requires between one and 64 data values")
    budget = Budget()
    for value in values:
        inspect_ast(value, budget)
        if value["type"] != "number":
            fail("INVALID_TASK", "Statistics values must be literal rational numbers")
    if sum(denominator.bit_length() for denominator in {v["denominator"] for v in values}) > MAX_COEFFICIENT_BITS:
        fail("RESOURCE_LIMIT", "Statistics denominator budget exceeded")
    ordered = sorted(Fraction(v["numerator"], v["denominator"]) for v in values)
    def output(value):
        if max(abs(value.numerator), value.denominator) > MAX_RESULT_INTEGER:
            fail("RESOURCE_LIMIT", "Statistics answer exceeds printable rational bounds")
        return number(value.numerator, value.denominator)
    if operation_name == "sort":
        result = {"type": "list", "values": [output(value) for value in ordered]}
    elif operation_name == "mode":
        counts = Counter(ordered)
        frequency = max(counts.values())
        # When every value appears once, the list is empty: no mode.
        result = {"type": "list", "values": [output(value) for value in sorted(counts) if counts[value] == frequency and frequency > 1]}
    else:
        size = len(ordered)
        value = sum(ordered, Fraction()) / size if operation_name == "mean" else ordered[-1] - ordered[0] if operation_name == "range" else ordered[size // 2] if size % 2 else (ordered[size // 2 - 1] + ordered[size // 2]) / 2
        result = {"type": "expression", "value": output(value)}
    return _pack_task(task, {"values": [to_house_math(value) for value in values]}, [], [], result,
                      "exact rational descriptive statistics; all tied repeated modes returned")


DECISION_RELATIONS = ("eq", "ne", "lt", "le", "gt", "ge", "divisible", "not_divisible", "in", "not_in")
MAX_DECISION_VALUES = 12


def _decide_task(task):
    """Decide one closed claim exactly; the author never supplies its truth value.

    The claim is an order or equality of two numeric expressions, divisibility
    of one natural number by another, or membership of a value in a short
    list. ``holds`` says whether the claim as typed is true. The exact values
    are returned with it, so a key can show why.
    """
    relation = task.get("relation")
    if type(relation) is not str or relation not in DECISION_RELATIONS:
        fail("INVALID_TASK", "Unknown decision relation")
    listed = relation in ("in", "not_in")
    exact(task, ("kind", "relation", "left", "values" if listed else "right"), "decision")
    others = task["values"] if listed else [task["right"]]
    if type(others) is not list or (listed and not 2 <= len(others) <= MAX_DECISION_VALUES):
        fail("INVALID_TASK", "A membership decision needs two to twelve listed values")
    expressions = [task["left"], *others]
    budget = Budget()
    for expression in expressions:
        inspect_ast(expression, budget)
    _check_canonical_budget(expressions)
    costs = [_algebra_cost(expression) for expression in expressions]
    for cost in costs[1:]:
        _combine_cost(costs[0], cost, "subtract")
    if any(_original_symbols(expression) for expression in expressions):
        fail("UNSUPPORTED_TASK", "A decision requires numeric expressions")
    compiler = Compiler()
    values = [compiler.compile(expression).expr for expression in expressions]
    if any(value.has(S.zoo, S.oo, -S.oo, S.nan) or value.is_real is not True for value in values):
        fail("UNDEFINED_TASK", "A decided value is not finite and real")
    left, rest = values[0], values[1:]
    result = {"type": "decision", "relation": relation, "left": _result_ast(left)}
    if listed:
        member = any(_compare_exact(left, value) == 0 for value in rest)
        holds = member == (relation == "in")
        result["values"] = [_result_ast(value) for value in rest]
    elif relation in ("divisible", "not_divisible"):
        if not (left.is_Integer and rest[0].is_Integer) or left < 0 or rest[0] <= 0:
            fail("INVALID_TASK", "Divisibility needs a natural number and a positive whole divisor")
        quotient, remainder = divmod(int(left), int(rest[0]))
        holds = (remainder == 0) == (relation == "divisible")
        result.update(right=_result_ast(rest[0]), quotient=number(quotient), remainder=number(remainder))
    else:
        sign = _compare_exact(left, rest[0])
        holds = {"eq": sign == 0, "ne": sign != 0, "lt": sign < 0, "le": sign <= 0,
                 "gt": sign > 0, "ge": sign >= 0}[relation]
        result.update(right=_result_ast(rest[0]), order={-1: "less", 0: "equal", 1: "greater"}[sign])
    result["holds"] = holds
    question_math = {"left": to_house_math(task["left"])}
    question_math["values" if listed else "right"] = (
        [to_house_math(value) for value in others] if listed else to_house_math(task["right"]))
    return _pack_task(task, question_math, [], [], result,
                      "exact comparison, integer division or list membership of closed numeric expressions")


def validate_and_solve_task(task) -> dict:
    """Validate a closed task and compute its exact answer; no provider/IO calls.

    Tasks: evaluate/simplify/factor/expand ``expression``; compare ``left/right``;
    solve ``lhs/rhs/variable``; substitute ``expression/values``. ``values`` maps
    every free variable to a literal rational number AST (no extra variables).
    Also finite degree-two ``solve_system`` with two variables/equations;
    one-variable rational quadratic ``inequality`` with lt/le/gt/ge relation;
    ``statistics`` with 1..64 literal rationals and mean/median/mode/range/sort.
    ``decide`` a closed claim ``relation/left/right`` (or ``values`` for a
    list); its result is ``holds``, never an authored yes or no.
    Returned ``domain`` restrictions always apply to the original task.
    """
    if type(task) is not dict or type(task.get("kind")) is not str:
        fail("INVALID_TASK", "Expected a typed task object")
    kind = task["kind"]
    if kind in ("lcm", "gcd"):
        exact(task, ("kind","left","right"), "integer pair")
        inputs = []
        for key in ("left","right"):
            value = task[key]
            inspect_ast(value)
            if value["type"] != "number" or value["denominator"] != 1 or value["numerator"] <= 0:
                fail("INVALID_TASK","A common divisor or multiple needs two positive integers")
            inputs.append(value["numerator"])
        a,b = inputs
        answer = gcd(a,b) if kind == "gcd" else a // gcd(a,b) * b
        integer(answer,MAX_RESULT_INTEGER,"integer pair result")
        return _pack_task(task,f"{kind}({a},{b})",set(),[],
                          {"type":"expression","value":number(answer)},"Euclidean algorithm")
    if kind in ("solve_system", "inequality", "statistics", "decide"):
        return {"solve_system": _solve_system_task, "inequality": _inequality_task, "statistics": _statistics_task,
                "decide": _decide_task}[kind](task)
    keys = {
        "evaluate": ("kind", "expression"), "simplify": ("kind", "expression"),
        "factor": ("kind", "expression"), "expand": ("kind", "expression"),
        "compare": ("kind", "left", "right"), "solve": ("kind", "lhs", "rhs", "variable"),
        "substitute": ("kind", "expression", "values"),
    }
    if kind not in keys:
        fail("UNSUPPORTED_TASK", "No trusted solver for this task kind")
    exact(task, keys[kind], "task")
    expressions = ("left", "right") if kind == "compare" else ("lhs", "rhs") if kind == "solve" else ("expression",)
    budget, compiler = Budget(), Compiler()
    for field in expressions:
        inspect_ast(task[field], budget)
    if kind == "solve" and (type(task["variable"]) is not str or task["variable"] not in SYMBOLS):
        fail("INVALID_TASK", "Unknown solving variable")
    if kind == "substitute":
        if type(task["values"]) is not dict or not task["values"] or len(task["values"]) > len(SYMBOLS):
            fail("INVALID_TASK", "Substitution needs a nonempty bounded variable map")
        for name, value in task["values"].items():
            if type(name) is not str or name not in SYMBOLS:
                fail("INVALID_TASK", "Unknown substitution variable")
            inspect_ast(value, budget)
            if value["type"] != "number":
                fail("INVALID_TASK", "Substitution values must be literal rational numbers")
    _check_canonical_budget([task[field] for field in expressions] +
                            (list(task["values"].values()) if kind == "substitute" else []))
    # All cost accounting is integer arithmetic over validated JSON. In
    # particular, reject exponential products of numeric radical sums before
    # SymPy constructors can perform implicit algebra or assumption queries.
    costs = [_algebra_cost(task[field]) for field in expressions]
    if len(costs) == 2:
        _combine_cost(costs[0], costs[1], "subtract")
    compiled_nodes = {field: compiler.compile(task[field]) for field in expressions}
    if kind == "solve" and any(max(node.numerator_degree, node.denominator_degree) > 2 for node in compiled_nodes.values()):
        fail("UNSUPPORTED_EQUATION", "Original rational-polynomial degree exceeds the quadratic solver")
    compiled = {field: node.expr for field, node in compiled_nodes.items()}
    conditions = _conditions(compiler)
    all_symbols = set().union(*(_original_symbols(task[field]) for field in expressions))
    for condition in conditions:
        all_symbols |= Compiler().compile(condition["expression"]).expr.free_symbols
    question_math = {field: to_house_math(task[field]) for field in expressions}
    result = None
    method = "exact rational algebra"
    if kind == "solve":
        if all_symbols - {SYMBOLS[task["variable"]]}:
            fail("UNSUPPORTED_EQUATION", "Original task contains an undeclared variable")
        result = _solve(compiled["lhs"], compiled["rhs"], SYMBOLS[task["variable"]], conditions)
        all_symbols.add(SYMBOLS[task["variable"]])
        method = "all real roots of a rational polynomial of degree at most two; original-domain substitution"
    elif kind == "compare":
        if all_symbols:
            fail("UNSUPPORTED_TASK", "Compare requires numeric expressions")
        delta = S.simplify(compiled["left"] - compiled["right"])
        relation = "equal" if delta == 0 else "less" if delta.is_negative else "greater" if delta.is_positive else None
        if relation is None:
            fail("UNSUPPORTED_COMPARISON", "Comparison cannot be decided exactly")
        result = {"type": "comparison", "relation": relation}
    else:
        expression = compiled["expression"]
        if kind == "substitute":
            expected = {str(symbol) for symbol in all_symbols}
            if set(task["values"]) != expected:
                fail("INVALID_TASK", "Substitution values must exactly cover original free variables")
            substitutions = {SYMBOLS[name]: compiler.compile(value).expr for name, value in task["values"].items()}
            for condition in conditions:
                value = Compiler().compile(condition["expression"]).expr.subs(substitutions, simultaneous=True)
                if value == 0 or value.has(S.zoo, S.oo, -S.oo, S.nan):
                    fail("OUTSIDE_DOMAIN", "Substitution violates an original denominator restriction")
                if value.is_zero is None:
                    fail("UNSUPPORTED_DOMAIN", "Substitution domain cannot be decided exactly")
            expression = expression.subs(substitutions, simultaneous=True)
        elif kind == "evaluate" and all_symbols:
            fail("UNSUPPORTED_TASK", "Evaluate requires a numeric expression")
        elif kind in ("simplify", "factor", "expand"):
            # Algebraic operations remain rational-polynomial. Symbolic roots
            # are rejected during construction; numeric radicals may be kept.
            expression = {"simplify": S.cancel, "factor": S.factor, "expand": S.expand}[kind](expression)
        if expression.has(S.zoo, S.oo, -S.oo, S.nan) or expression.is_real is False:
            fail("UNDEFINED_TASK", "Computed result is not finite and real")
        result = {"type": "expression", "value": _result_ast(expression)}
    return {
        "version": 1, "question": deepcopy(task), "questionMath": question_math,
        "domain": {"numberSystem": "real", "variables": sorted(str(x) for x in all_symbols), "conditions": conditions},
        "result": result, "verification": {"method": method, "scope": "typed task only"},
    }
