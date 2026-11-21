"""Bounded typed tasks bind the computed key to the exact displayed question."""
import copy
import sys
import unittest
from fractions import Fraction
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import math_tasks
from math_tasks import (MathTaskError, validate_and_solve_task as solve,
                        to_house_math, number as n, operation as op)

X = {"type": "symbol", "name": "x"}
Y = {"type": "symbol", "name": "y"}


def task(expression, kind="evaluate"):
    return {"kind": kind, "expression": expression}


def equation(left, right, variable="x"):
    return {"kind": "solve", "lhs": left, "rhs": right, "variable": variable}

def system(first, second, variables=None):
    return {"kind": "solve_system", "variables": variables or ["x", "y"],
            "equations": [{"lhs": first[0], "rhs": first[1]}, {"lhs": second[0], "rhs": second[1]}]}

def inequality(left, right, relation="lt"):
    return {"kind": "inequality", "variable": "x", "lhs": left, "rhs": right, "relation": relation}

def interval(lower, upper, lc=False, uc=False):
    return {"lower": lower, "upper": upper, "lowerClosed": lc, "upperClosed": uc}


class MathTaskTests(unittest.TestCase):
    def error(self, code, value):
        with self.assertRaises(MathTaskError) as raised:
            solve(value)
        self.assertEqual(raised.exception.code, code)

    def result(self, expression, kind="evaluate"):
        return solve(task(expression, kind))["result"]["value"]

    def test_exact_fraction_arithmetic(self):
        self.assertEqual(self.result(op("add", n(1, 3), n(1, 6))), n(1, 2))
        self.assertEqual(self.result(op("divide", n(5, 6), n(2, 3))), n(5, 4))
        self.assertEqual(self.result(op("subtract", n(2), n(7))), n(-5))
        self.assertEqual(self.result(op("multiply", n(-3, 4), n(2, 9))), n(-1, 6))

    def test_nary_add_multiply_preserve_every_operand_and_original_question(self):
        for expression,expected in [(op("add",n(1,2),n(1,3),n(1,6)),n(1)),
                                    (op("multiply",n(2),n(3),n(5),n(7),n(11),n(13)),n(30030)),
                                    (op("add",n(1),n(2),n(3),n(4),n(5),n(6)),n(21))]:
            original=copy.deepcopy(expression);result=solve(task(expression))
            self.assertEqual(result["result"]["value"],expected)
            self.assertEqual(result["question"]["expression"],original)
            self.assertEqual(expression,original)
        solved=solve(equation(op("add",op("multiply",n(2),X),n(3),n(4)),n(15)))
        self.assertEqual(solved["result"]["values"],[n(4)])
        simplified=solve(task(op("add",n(1),n(2),op("divide",X,X)),"simplify"))
        self.assertEqual(simplified["result"]["value"],n(4))
        self.assertEqual(simplified["domain"]["conditions"],[{"kind":"nonzero","expression":X}])

    def test_nary_printing_preserves_all_operands_and_precedence(self):
        self.assertEqual(to_house_math(op("add",n(1),n(2),n(3))),"1 + 2 + 3")
        self.assertEqual(to_house_math(op("multiply",n(2),n(3),n(5))),"2 · 3 · 5")
        self.assertEqual(to_house_math(op("add",n(1),n(2),n(-3))),"1 + 2 − 3")
        self.assertIn(r"\g{x + 1}",to_house_math(op("multiply",n(2),op("add",X,n(1)),n(5))))

    def test_only_associative_operators_allow_two_to_six_arguments(self):
        for kind,count in [("add",1),("add",7),("multiply",1),("multiply",7),("subtract",3),("divide",3),("power",3),("sqrt",2)]:
            self.error("INVALID_AST",task(op(kind,*[n(1) for _ in range(count)])))

    def test_nary_expansion_and_canonical_node_depth_budgets_precede_sympy(self):
        group=op("add",*[op("add",*[n(1) for _ in range(6)]) for _ in range(6)])
        node_heavy=op("add",group,copy.deepcopy(group),n(1),n(1),n(1),n(1))
        depth_heavy=n(1)
        for _ in range(7):depth_heavy=op("add",depth_heavy,n(1),n(1),n(1),n(1),n(1))
        for expression in [node_heavy,depth_heavy]:
            math_tasks.inspect_ast(expression) # The original n-ary shape fits.
            with patch.object(math_tasks.Compiler,"compile",side_effect=AssertionError("must reject before SymPy")) as compiler:
                self.error("RESOURCE_LIMIT",task(expression));compiler.assert_not_called()
        explosion=op("multiply",*[op("add",n(1),X,Y) for _ in range(6)])
        with patch.object(math_tasks.Compiler,"compile",side_effect=AssertionError("all factor costs must be checked")) as compiler:
            self.error("RESOURCE_LIMIT",task(explosion,"expand"));compiler.assert_not_called()

    def test_square_roots_and_powers(self):
        self.assertEqual(self.result(op("sqrt", n(49, 16))), n(7, 4))
        self.assertEqual(self.result(op("power", n(3, 2), n(-2))), n(4, 9))
        self.assertEqual(self.result(op("power", n(8), n(0))), n(1))
        self.assertEqual(self.result(op("sqrt", n(2))), op("sqrt", n(2)))
        self.assertEqual(self.result(op("multiply", op("sqrt", n(2)), op("sqrt", n(2)))), n(2))

    def test_every_comparison_direction(self):
        for left, right, expected in [(n(1, 2), n(2, 3), "less"), (n(-2), n(-5), "greater"), (n(2, 4), n(1, 2), "equal")]:
            self.assertEqual(solve({"kind": "compare", "left": left, "right": right})["result"]["relation"], expected)
        self.assertEqual(solve({"kind": "compare", "left": op("sqrt", n(2)), "right": n(3, 2)})["result"]["relation"], "less")

    def test_linear_equation(self):
        result = solve(equation(op("add", op("multiply", n(3), X), n(5)), n(-7)))
        self.assertEqual(result["result"]["values"], [n(-4)])
        self.assertEqual(result["result"]["classification"], "finite")

    def test_all_quadratic_real_roots(self):
        result = solve(equation(op("subtract", op("power", X, n(2)), n(9)), n(0)))
        self.assertEqual(result["result"]["values"], [n(-3), n(3)])
        repeated = solve(equation(op("power", op("subtract", X, n(2)), n(2)), n(0)))
        self.assertEqual(repeated["result"]["values"], [n(2)])
        irrational = solve(equation(op("power", X, n(2)), n(2)))
        self.assertEqual(len(irrational["result"]["values"]), 2)
        self.assertIn(r"\sqrt{2}", to_house_math(irrational["result"]["values"][0]))

    def test_nonreal_roots_are_no_real_solution(self):
        result = solve(equation(op("add", op("power", X, n(2)), n(1)), n(0)))
        self.assertEqual(result["result"]["classification"], "none")
        self.assertEqual(result["result"]["values"], [])

    def test_identity_has_original_excluded_value(self):
        result = solve(equation(op("divide", X, X), n(1)))
        self.assertEqual(result["result"]["classification"], "identity")
        self.assertEqual(result["result"]["excludedValues"], [n(0)])
        self.assertEqual(result["domain"]["conditions"], [{"kind": "nonzero", "expression": X}])

    def test_cancelled_root_never_reenters_solution_set(self):
        expression = op("divide", op("subtract", op("power", X, n(2)), n(1)), op("subtract", X, n(1)))
        result = solve(equation(expression, n(2)))
        self.assertEqual(result["result"]["classification"], "none")
        self.assertEqual(result["result"]["excludedValues"], [n(1)])
        result = solve(equation(expression, n(4)))
        self.assertEqual(result["result"]["values"], [n(3)])
        self.assertEqual(result["result"]["excludedValues"], [n(1)])

    def test_rational_equation_keeps_original_domain(self):
        result = solve(equation(op("divide", n(1), X), n(2)))
        self.assertEqual(result["result"]["values"], [n(1, 2)])
        self.assertEqual(result["result"]["excludedValues"], [n(0)])

    def test_denominator_without_real_roots_has_no_exclusion(self):
        denominator = op("add", op("power", X, n(2)), n(1))
        result = solve(equation(op("divide", denominator, denominator), n(1)))
        self.assertEqual(result["result"]["classification"], "identity")
        self.assertEqual(result["result"]["excludedValues"], [])

    def test_no_solution_and_constant_identity(self):
        self.assertEqual(solve(equation(n(1), n(2)))["result"]["classification"], "none")
        identity = solve(equation(n(1), n(1)))
        self.assertEqual(identity["result"]["classification"], "identity")
        self.assertEqual(identity["domain"]["variables"], ["x"])

    def test_factor_expand_and_simplify(self):
        expression = op("subtract", op("power", X, n(2)), n(1))
        factored = self.result(expression, "factor")
        self.assertEqual(factored["op"], "multiply")
        expanded = self.result(op("power", op("add", X, n(1)), n(2)), "expand")
        for x, expected in [(0, 1), (1, 4), (-2, 1)]:
            value = solve({"kind": "substitute", "expression": expanded, "values": {"x": n(x)}})
            self.assertEqual(value["result"]["value"], n(expected))
        rational = op("divide", expression, op("subtract", X, n(1)))
        simplified = solve(task(rational, "simplify"))
        self.assertEqual(simplified["domain"]["conditions"], [{"kind": "nonzero", "expression": op("subtract", X, n(1))}])
        self.assertEqual(simplified["question"]["expression"], rational)

    def test_original_variable_remains_visible_even_after_cancellation(self):
        expression = op("subtract", X, X)
        self.error("UNSUPPORTED_TASK", task(expression))
        self.assertEqual(solve(task(expression, "simplify"))["domain"]["variables"], ["x"])
        self.error("INVALID_TASK", {"kind": "substitute", "expression": expression, "values": {"y": n(1)}})
        self.error("UNSUPPORTED_EQUATION", equation(op("subtract", Y, Y), n(0), "x"))

    def test_substitution_cannot_cancel_domain_restriction(self):
        expression = op("divide", X, X)
        self.error("OUTSIDE_DOMAIN", {"kind": "substitute", "expression": expression, "values": {"x": n(0)}})
        self.assertEqual(solve({"kind": "substitute", "expression": expression, "values": {"x": n(3)}})["result"]["value"], n(1))

    def test_substitution_must_exactly_cover_original_variables(self):
        expression = op("add", X, Y)
        self.error("INVALID_TASK", {"kind": "substitute", "expression": expression, "values": {"x": n(1)}})
        self.error("INVALID_TASK", {"kind": "substitute", "expression": X, "values": {"x": n(1), "y": n(2)}})
        result = solve({"kind": "substitute", "expression": expression, "values": {"x": n(1, 2), "y": n(1, 3)}})
        self.assertEqual(result["result"]["value"], n(5, 6))

    def test_claimed_answer_prose_and_html_fields_are_rejected(self):
        for extra in ["answer", "verified", "proof", "text", "html", "code", "url", "path"]:
            payload = task(n(2))
            payload[extra] = '<script>alert(1)</script>'
            self.error("INVALID_TASK", payload)

    def test_model_strings_are_never_parsed(self):
        strings = ["__import__('os').system('echo bad')", "x+1", "1/2", "<img src=x>", "nan", "Infinity"]
        for value in strings:
            self.error("INVALID_AST", task(value))
            self.error("INVALID_AST", task({"type": "symbol", "name": value}))
        self.error("INVALID_AST", task({"type": "operation", "op": "eval", "args": [n(1), n(2)]}))

    def test_bool_float_string_numbers_and_nonfinite_are_rejected(self):
        for value in [True, False, 1.0, "1", float("nan"), float("inf")]:
            self.error("INVALID_AST", task({"type": "number", "numerator": value, "denominator": 1}))
        for value in [0, -1, True, "2"]:
            self.error("INVALID_AST", task({"type": "number", "numerator": 1, "denominator": value}))

    def test_unexpected_fields_and_wrong_arities(self):
        self.error("INVALID_TASK", task({"type": "number", "numerator": 1, "denominator": 1, "extra": 0}))
        self.error("INVALID_AST", task({"type": "operation", "op": "sqrt", "args": [n(1), n(2)]}))
        self.error("INVALID_AST", task({"type": "operation", "op": "add", "args": [n(1)]}))
        self.error("INVALID_AST", task({"type": "operation", "op": [], "args": [n(1)]}))

    def test_unknown_task_symbol_and_nonquadratic_are_not_verified(self):
        self.error("UNSUPPORTED_TASK", {"kind": "geometry_proof", "expression": n(1)})
        self.error("INVALID_TASK", equation(X, n(1), "z"))
        self.error("UNSUPPORTED_EQUATION", equation(op("add", X, Y), n(1)))
        self.error("UNSUPPORTED_EQUATION", equation(op("power", X, n(3)), n(1)))
        self.error("UNSUPPORTED_EQUATION", equation(op("power", X, n(4)), op("power", X, n(4))))

    def test_singular_inputs_and_complex_roots_are_rejected(self):
        for expression in [op("divide", n(1), n(0)), op("divide", X, op("subtract", X, X)), op("power", n(0), n(-1)), op("power", n(0), n(0))]:
            self.error("UNDEFINED_TASK", task(expression, "simplify"))
        self.error("UNSUPPORTED_ROOT", task(op("sqrt", n(-1))))
        self.error("UNSUPPORTED_SYMBOLIC_ROOT", task(op("sqrt", X), "simplify"))

    def test_exponent_is_bounded_literal_integer(self):
        for exponent in [n(5), n(-5), n(1, 2), X, op("add", n(1), n(1))]:
            self.error("UNSUPPORTED_POWER", task(op("power", n(2), exponent)))

    def test_resource_bounds_are_enforced(self):
        self.error("INVALID_AST", task(n(1_000_001)))
        expression = n(1)
        for _ in range(14):
            expression = op("add", expression, n(1))
        self.error("RESOURCE_LIMIT", task(expression))
        # Balanced tree breaches node budget without exceeding depth.
        expression = n(1)
        for _ in range(7):
            expression = op("add", expression, copy.deepcopy(expression))
        self.error("RESOURCE_LIMIT", task(expression))
        self.error("RESOURCE_LIMIT", task(op("power", op("power", X, n(4)), n(4)), "expand"))
        self.error("RESOURCE_LIMIT", task(op("power", op("power", n(999999), n(4)), n(4))))
        self.error("RESOURCE_LIMIT", task(op("power", n(10000), n(4))))

    def test_radical_product_explosion_rejected_before_any_sympy_construction(self):
        factors = [op("add", op("sqrt", n(2)), op("sqrt", n(p)))
                   for p in [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]]
        while len(factors) > 1:
            factors = [op("multiply", factors[i], factors[i + 1]) for i in range(0, len(factors), 2)]
        for kind in ("expand", "factor", "simplify", "evaluate"):
            with patch.object(math_tasks.Compiler, "compile", side_effect=AssertionError("preflight must reject first")) as compiler, \
                 patch.object(math_tasks.S, "expand", side_effect=AssertionError("must not expand")) as expand:
                self.error("RESOURCE_LIMIT", task(factors[0], kind))
                compiler.assert_not_called()
                expand.assert_not_called()

    def test_expansion_term_budget_boundary_and_radical_rank_boundary(self):
        # The conservative estimate is 16 * 4 = 64 terms (actual cancellations
        # make it smaller), within the limit. One more (y+1) factor is 128.
        left = op("power", op("add", X, n(1)), n(4))
        near = op("multiply", left, op("power", op("add", Y, n(1)), n(2)))
        result = solve(task(near, "expand"))
        self.assertEqual(result["result"]["type"], "expression")
        over = op("multiply", left, op("power", op("add", Y, n(1)), n(3)))
        with patch.object(math_tasks.S, "expand", side_effect=AssertionError("must not expand")) as expand:
            self.error("RESOURCE_LIMIT", task(over, "expand"))
            expand.assert_not_called()
        near_radicals = op("multiply", op("add", op("sqrt", n(2)), op("sqrt", n(3))),
                           op("add", op("sqrt", n(5)), op("sqrt", n(7))))
        self.assertEqual(solve(task(near_radicals, "expand"))["result"]["type"], "expression")
        over_radicals = op("add", near_radicals, op("sqrt", n(11)))
        with patch.object(math_tasks.Compiler, "compile", side_effect=AssertionError("must not construct")) as compiler:
            self.error("RESOURCE_LIMIT", task(over_radicals, "expand"))
            compiler.assert_not_called()

    def test_cyclic_non_json_object_fails_before_recursion_error(self):
        expression = op("add", n(1), n(1))
        expression["args"][0] = expression
        self.error("RESOURCE_LIMIT", task(expression))

    def test_question_preservation_and_no_input_mutation(self):
        original = equation(op("divide", op("subtract", op("power", X, n(2)), n(1)), op("subtract", X, n(1))), n(4))
        before = copy.deepcopy(original)
        result = solve(original)
        self.assertEqual(original, before)
        self.assertEqual(result["question"], before)
        result["question"]["rhs"]["numerator"] = 99
        self.assertEqual(original, before)
        self.assertEqual(result["verification"]["scope"], "typed task only")

    def test_display_has_stacked_fractions_no_raw_markup_or_slash(self):
        expression = op("add", n(-1, 2), op("sqrt", n(3)))
        display = to_house_math(expression)
        self.assertIn(r"\f{1}{2}", display)
        self.assertIn(r"\sqrt{3}", display)
        self.assertIn("−", display)
        self.assertNotIn("/", display)
        self.assertNotIn("$", display)
        self.assertIn(" · ", to_house_math(op("multiply", X, n(2))))
        with self.assertRaises(MathTaskError):
            to_house_math({"type": "symbol", "name": "$<script>"})

    def test_display_groups_only_where_precedence_requires_it(self):
        self.assertEqual(to_house_math(op('subtract',op('power',X,n(2)),n(3))),'x^{2} − 3')
        self.assertEqual(to_house_math(op('subtract',X,op('add',Y,n(2)))),r'x − \g{y + 2}')
        self.assertEqual(to_house_math(op('multiply',op('add',X,n(1)),n(3))),r'\g{x + 1} · 3')
        self.assertEqual(to_house_math(op('power',n(-2),n(2))),r'\g{−2}^{2}')
        self.assertEqual(to_house_math(op('multiply',n(-1),op('sqrt',n(3)))),r'−\sqrt{3}')
        self.assertEqual(to_house_math(op('subtract',X,n(-2))),'x + 2')

    def test_two_variable_linear_system_exact_solution_and_original_question(self):
        value = system((op("add", X, Y), n(3)), (op("subtract", X, Y), n(1)))
        result = solve(value)
        self.assertEqual(result["result"], {"type": "system", "variables": ["x", "y"], "classification": "finite", "solutions": [{"x": n(2), "y": n(1)}]})
        self.assertEqual(result["question"], value)
        self.assertEqual(len(result["questionMath"]["equations"]), 2)
        self.assertEqual(result["domain"]["variables"], ["x", "y"])

    def test_quadratic_system_returns_all_real_solutions(self):
        result = solve(system((op("add", X, Y), n(3)), (op("multiply", X, Y), n(2))))["result"]
        self.assertEqual(result["solutions"], [{"x": n(1), "y": n(2)}, {"x": n(2), "y": n(1)}])
        result = solve(system((op("power", X, n(2)), n(1)), (op("power", Y, n(2)), n(4))))["result"]
        self.assertEqual(len(result["solutions"]), 4)
        self.assertEqual({(v["x"]["numerator"], v["y"]["numerator"]) for v in result["solutions"]}, {(-1,-2),(-1,2),(1,-2),(1,2)})

    def test_system_none_real_and_nonfinite_sets(self):
        self.assertEqual(solve(system((X, n(0)), (X, n(1))))["result"]["classification"], "none")
        self.assertEqual(solve(system((op("power", X, n(2)), n(-1)), (Y, n(0))))["result"]["classification"], "none")
        self.error("UNSUPPORTED_SYSTEM", system((op("add", X, Y), n(1)), (op("add", X, Y), n(1))))

    def test_system_quadratic_roots_with_rational_coefficients(self):
        result = solve(system((op("power", X, n(2)), n(2)), (Y, X)))["result"]
        self.assertEqual(len(result["solutions"]), 2)
        for solution in result["solutions"]:
            self.assertEqual(solution["x"], solution["y"])
            self.assertIn(r"\sqrt{2}", to_house_math(solution["x"]))

    def test_system_bad_shape_and_symbolic_denominators_fail_closed(self):
        valid = system((X, n(0)), (Y, n(1)))
        for change in [{"variables": ["x","x"]}, {"variables": ["x"]}, {"variables": ["x","z"]}, {"equations": []}, {"answer": n(0)}]:
            self.error("INVALID_TASK", {**valid, **change})
        self.error("UNSUPPORTED_EQUATION", system((op("divide", X, Y), n(1)), (Y, n(1))))
        self.error("UNSUPPORTED_EQUATION", system(({"type":"symbol","name":"a"}, n(0)), (Y, n(1))))

    def test_new_solver_degree_and_bit_budgets_precede_sympy_construction(self):
        for value in [system((op("power", X, n(3)), n(1)), (Y, n(1))), inequality(op("power", X, n(3)), n(0))]:
            with patch.object(math_tasks.Compiler, "compile", side_effect=AssertionError("preflight must reject first")) as compiler:
                self.error("UNSUPPORTED_EQUATION", value)
                compiler.assert_not_called()
        big = op("multiply", op("multiply", n(999999), n(999999)), op("multiply", n(999999), n(999999)))
        with patch.object(math_tasks.Compiler, "compile", side_effect=AssertionError("preflight must reject first")) as compiler:
            self.error("RESOURCE_LIMIT", system((op("multiply", big, X), n(1)), (Y, n(1))))
            compiler.assert_not_called()

    def test_small_quadratic_pair_rejects_quartic_elimination_before_radical_solver(self):
        # x²+xy+y²+x+y−1 = 0; 2x²−xy+3y²−4x+5y−6 = 0.
        # Generic radical solving/reality testing of this tiny pair can stall.
        def add(*items):
            result=items[0]
            for item in items[1:]:
                result=op("add",result,item)
            return result
        first=add(op("power",X,n(2)),op("multiply",X,Y),op("power",Y,n(2)),X,Y,n(-1))
        second=add(op("multiply",n(2),op("power",X,n(2))),op("multiply",n(-1),op("multiply",X,Y)),op("multiply",n(3),op("power",Y,n(2))),op("multiply",n(-4),X),op("multiply",n(5),Y),n(-6))
        with patch.object(math_tasks.S,"solve_poly_system",side_effect=AssertionError("quartic radicals must not execute")) as solver:
            self.error("UNSUPPORTED_SYSTEM",system((first,n(0)),(second,n(0))))
            solver.assert_not_called()

    def test_quadratic_inequality_endpoint_strictness_and_signs(self):
        expression=op("subtract",op("power",X,n(2)),n(4))
        self.assertEqual(solve(inequality(expression,n(0),"lt"))["result"]["intervals"],[interval(n(-2),n(2))])
        self.assertEqual(solve(inequality(expression,n(0),"le"))["result"]["intervals"],[interval(n(-2),n(2),True,True)])
        self.assertEqual(solve(inequality(expression,n(0),"ge"))["result"]["intervals"],[interval(None,n(-2),False,True),interval(n(2),None,True,False)])
        self.assertEqual(solve(inequality(op("multiply",n(-1),X),n(-2),"gt"))["result"]["intervals"],[interval(None,n(2))])

    def test_inequality_singleton_none_and_all_reals_are_unambiguous(self):
        square=op("power",X,n(2))
        self.assertEqual(solve(inequality(square,n(0),"le"))["result"]["intervals"],[interval(n(0),n(0),True,True)])
        self.assertEqual(solve(inequality(square,n(0),"lt"))["result"]["intervals"],[])
        self.assertEqual(solve(inequality(square,n(0),"ge"))["result"]["intervals"],[interval(None,None)])

    def test_rational_inequality_never_reintroduces_cancelled_domain_holes(self):
        rational=op("divide",op("subtract",op("power",X,n(2)),n(1)),op("subtract",X,n(1)))
        result=solve(inequality(rational,n(0),"ge"))
        self.assertEqual(result["result"]["intervals"],[interval(n(-1),n(1),True,False),interval(n(1),None)])
        self.assertEqual(len(result["domain"]["conditions"]),1)
        self.assertEqual(solve(inequality(op("divide",X,X),n(1),"le"))["result"]["intervals"],[interval(None,n(0)),interval(n(0),None)])
        self.assertEqual(solve(inequality(op("divide",n(1),X),n(0),"gt"))["result"]["intervals"],[interval(n(0),None)])

    def test_inequality_two_rational_sides_and_irrational_endpoints(self):
        result=solve(inequality(op("divide",n(1),op("subtract",X,n(1))),op("divide",n(1),op("add",X,n(1)))))
        self.assertEqual(result["result"]["intervals"],[interval(n(-1),n(1))])
        result=solve(inequality(op("power",X,n(2)),n(2)))
        self.assertIn(r"\sqrt{2}",to_house_math(result["result"]["intervals"][0]["lower"]))
        self.assertIn(r"\sqrt{2}",to_house_math(result["result"]["intervals"][0]["upper"]))
        self.error("INVALID_TASK",{**inequality(X,n(0)),"relation":"eval"})
        self.error("UNSUPPORTED_EQUATION",inequality(op("subtract",Y,Y),n(0)))

    def test_statistics_exact_fraction_mean_median_range_sort_and_all_modes(self):
        values=[n(1,2),n(3,2),n(1,2),n(-1,2)]
        def stat(operation, data=values):
            return solve({"kind":"statistics","operation":operation,"values":data})["result"]
        self.assertEqual(stat("mean"),{"type":"expression","value":n(1,2)})
        self.assertEqual(stat("median"),{"type":"expression","value":n(1,2)})
        self.assertEqual(stat("median",[n(1),n(5),n(2)]),{"type":"expression","value":n(2)})
        self.assertEqual(stat("range"),{"type":"expression","value":n(2)})
        self.assertEqual(stat("sort"),{"type":"list","values":[n(-1,2),n(1,2),n(1,2),n(3,2)]})
        self.assertEqual(stat("mode"),{"type":"list","values":[n(1,2)]})
        self.assertEqual(stat("mode",[n(1),n(2),n(2),n(1)]),{"type":"list","values":[n(1),n(2)]})
        self.assertEqual(stat("mode",[n(1),n(2)]),{"type":"list","values":[]})

    def test_statistics_closed_shapes_size_and_fraction_resource_limits(self):
        def stat(values, operation="mean"):
            return {"kind":"statistics","operation":operation,"values":values}
        for values in [[],[n(1)]*65,[X],[op("add",n(1),n(2))]]:
            self.error("INVALID_TASK",stat(values))
        self.error("INVALID_TASK",stat([n(1)],"random"))
        self.error("INVALID_AST",stat([{"type":"number","numerator":True,"denominator":1}]))
        self.error("RESOURCE_LIMIT",stat([n(1,999983-i) for i in range(64)]))
        self.assertEqual(solve(stat([n(2)]*64))["result"]["value"],n(2))
        self.assertEqual(solve(stat([n(1,4)]*64))["result"]["value"],n(1,4))

    def test_sign_charts_agree_with_independent_rational_substitution_across_holes_and_repeated_roots(self):
        probes=[Fraction(i,2) for i in range(-7,8)]
        for first, second, hole in [(-2,1,0),(1,1,1),(0,0,-1),(-1,2,2),(2,-2,-2)]:
            expression=op("divide",op("multiply",op("subtract",X,n(first)),op("subtract",X,n(second))),op("subtract",X,n(hole)))
            for relation in ("lt","le","gt","ge"):
                intervals=solve(inequality(expression,n(0),relation))["result"]["intervals"]
                for probe in probes:
                    actual=False
                    for part in intervals:
                        lower=Fraction(part["lower"]["numerator"],part["lower"]["denominator"]) if part["lower"] is not None else None
                        upper=Fraction(part["upper"]["numerator"],part["upper"]["denominator"]) if part["upper"] is not None else None
                        actual |= (lower is None or probe>lower or probe==lower and part["lowerClosed"]) and (upper is None or probe<upper or probe==upper and part["upperClosed"])
                    expected=False
                    if probe!=hole:
                        value=(probe-first)*(probe-second)/(probe-hole)
                        expected={"lt":value<0,"le":value<=0,"gt":value>0,"ge":value>=0}[relation]
                    self.assertEqual(actual,expected,(first,second,hole,relation,probe,intervals))


if __name__ == "__main__":
    unittest.main()
