"""v5 answer-leak and duplicate checks, and the source-side mirror of the pinned D12 gate.

V5-DESIGN.md sections 3 and 4. Every function is pure and returns codes and
indices only (G11): never model text, lesson text or an expression.

Question level, question_leaks() -> [(item index, code)], 1-based items:
- DUPLICATE_ITEM   the same canonical task as an earlier item (the later item).
- LEAK_OWN         the key equals a printed atom of its item that is neither the
                   task display nor one of its operands, or either side of a rule
                   fact. Keys equal to the constant 0 or 1 are ignored. Operands:
                   the substituted values of a displayed task; when the task is not
                   displayed as one atom (write_from_words), the numbers and
                   letters it is built of.
- LEAK_LINKED      a key of two or more terms appears verbatim (canonical
                   unparse) as a contiguous run of terms in another item's
                   display; checked in both directions, the later item is hit.
- LEAK_RULE_FACT   a contiguous run of an item's task display has the term
                   multiset of a rule fact's left side ("5x+3x+1" holds {3x, 5x}).
- LEAK_PINNED_VALUE (when skill_path is given) the D12 mirror below.
Monotone: removing items never adds a hit (every rule is per item, or "a later
item with some partner").

Sheet level, sheet_leaks() -> {0-based index of the LATER question: codes}:
- DUPLICATE_TASK      the same canonical task as an item of an earlier question.
- LEAK_SHEET_INVERSE  the LEAK_LINKED rule across two questions, both directions.
- EXAMPLE_COPY        an item whose task is exactly (kernel AST) a worked example
                      the sheet prints, e.g. a side of the rule box's display.
                      Examples are passed by the caller; none by default.
Numeric chance matches between questions are allowed by design (plan c2).

The canonical task of an item is its kernel task expression. For the kinds that
display their task, verify_item proves to_kernel(display) == task.expression, so
this is the canonical task display; it also covers write_from_words, whose task
is not displayed as one atom.

D12 mirror (G6, D12; critique: no dict givens, no exemption): the pinned
check_didactic.py is loaded by path after a sha256 check against skill-lock.json
and its own f_atoms / f_hit are applied to the exact strings the middle adapter
emits: the key island, the intro and every item's rendered prompt (text spans
as written, display spans as school_math.display_island). No given is read, so
the pinned stated-given exemption never applies; a hit in a later item, which
the pinned gate reports as REVIEW, is refused too. Keys 0 and 1 are NOT skipped
here, because the pinned gate does not skip them.

Values are exact polynomials {signature: Fraction} (sorted letters, () for a
constant, zeros dropped), evaluated from school_math.to_kernel with fractions.
"""
from __future__ import annotations

import ast
import hashlib
import json
import sys
import types
from collections import Counter
from fractions import Fraction
from functools import reduce
from pathlib import Path

import school_math

HERE = Path(__file__).resolve().parent
SKILL_LOCK = HERE / "skill-lock.json"
PINNED_SKILL = "middle"

DUPLICATE_ITEM = "DUPLICATE_ITEM"
LEAK_OWN = "LEAK_OWN"
LEAK_LINKED = "LEAK_LINKED"
LEAK_RULE_FACT = "LEAK_RULE_FACT"
LEAK_PINNED_VALUE = "LEAK_PINNED_VALUE"
DUPLICATE_TASK = "DUPLICATE_TASK"
LEAK_SHEET_INVERSE = "LEAK_SHEET_INVERSE"
EXAMPLE_COPY = "EXAMPLE_COPY"
QUESTION_CODES = (DUPLICATE_ITEM, LEAK_OWN, LEAK_LINKED, LEAK_RULE_FACT, LEAK_PINNED_VALUE)
SHEET_CODES = (DUPLICATE_TASK, LEAK_SHEET_INVERSE, EXAMPLE_COPY)

_IGNORED_KEYS = ({}, {(): Fraction(1)})          # the constants 0 and 1


# ------------------------------------------------------------------ the pinned module

_PINNED = {}


def _require_stdlib(source: bytes, filename: str) -> None:
    """Refuse a module whose import-time code imports anything but the standard library."""
    tree = ast.parse(source, filename=filename)
    pending = list(tree.body)
    while pending:
        node = pending.pop()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            continue                     # runs only when called; v5 calls f_atoms / f_hit only
        if isinstance(node, ast.Import):
            roots = [alias.name.split(".")[0] for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            roots = [(node.module or "").split(".")[0]] if node.level == 0 else [""]
        else:
            roots = []
        if any(root not in sys.stdlib_module_names for root in roots):
            raise ValueError("SKILL_MODULE_NOT_STDLIB")
        pending.extend(ast.iter_child_nodes(node))


def pinned_module(skill_path: str, filename: str = "check_didactic.py"):
    """Import a stdlib-only pinned module by path after a sha256 check against skill-lock.json (middle);
    no sys.path change, sys.dont_write_bytecode held True. Mismatch → ValueError('SKILL_HASH_MISMATCH'). Cached.

    The bytes that are hashed are the bytes that are compiled and executed, so
    nothing can change between the check and the import, and no bytecode is
    ever written. The file is re-hashed on every call; the cache is keyed by
    path and hash. The module is not registered in sys.modules.
    """
    pin = json.loads(SKILL_LOCK.read_text(encoding="utf-8"))["skills"][PINNED_SKILL]["files"]
    expected = pin.get(filename) if isinstance(filename, str) else None
    path = Path(skill_path) / str(filename)
    if (not isinstance(expected, str) or not filename.endswith(".py") or Path(filename).name != filename
            or path.is_symlink() or not path.is_file()):
        raise ValueError("SKILL_HASH_MISMATCH")
    source = path.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != expected:
        raise ValueError("SKILL_HASH_MISMATCH")
    cache_key = (str(path.resolve()), digest)
    module = _PINNED.get(cache_key)
    if module is None:
        _require_stdlib(source, filename)
        module = types.ModuleType("_v5_pinned_%s_%s" % (Path(filename).stem, digest[:12]))
        module.__file__ = str(path)
        code = compile(source, str(path), "exec", dont_inherit=True)
        previous = sys.dont_write_bytecode
        sys.dont_write_bytecode = True
        try:
            exec(code, module.__dict__)
        finally:
            sys.dont_write_bytecode = previous
        _PINNED[cache_key] = module
    return module


# ------------------------------------------------------------------ exact values

def _add(left, right):
    out = dict(left)
    for signature, value in right.items():
        out[signature] = out.get(signature, Fraction(0)) + value
    return {signature: value for signature, value in out.items() if value != 0}


def _scale(poly, factor):
    return {signature: value * factor for signature, value in poly.items() if value * factor != 0}


def _multiply(left, right):
    out = {}
    for s1, v1 in left.items():
        for s2, v2 in right.items():
            out = _add(out, {tuple(sorted(s1 + s2)): v1 * v2})
    return out


def _constant(poly):
    if not poly:
        return Fraction(0)
    if set(poly) == {()}:
        return poly[()]
    return None


def _poly(node):
    """Exact polynomial of a kernel AST (section 2.5); anything else → ValueError('FORM_UNREPRESENTABLE')."""
    kind = node.get("type") if isinstance(node, dict) else None
    if kind == "number":
        value = Fraction(node["numerator"], node["denominator"])
        return {(): value} if value else {}
    if kind == "symbol":
        return {(node["name"],): Fraction(1)}
    if kind == "operation":
        op, args = node.get("op"), node.get("args") or []
        if op == "add" and args:
            return reduce(_add, (_poly(arg) for arg in args))
        if op == "subtract" and len(args) == 2:
            return _add(_poly(args[0]), _scale(_poly(args[1]), -1))
        if op == "multiply" and args:
            return reduce(_multiply, (_poly(arg) for arg in args))
        if op == "power" and len(args) == 2:
            exponent = _constant(_poly(args[1]))
            if exponent is not None and exponent.denominator == 1 and exponent >= 0:
                return reduce(_multiply, [_poly(args[0])] * int(exponent), {(): Fraction(1)})
        if op == "divide" and len(args) == 2:
            divisor = _constant(_poly(args[1]))
            if divisor:
                return _scale(_poly(args[0]), 1 / divisor)
    raise ValueError("FORM_UNREPRESENTABLE")


def _value(node):
    return _poly(school_math.to_kernel(node))


def _canonical(kernel):
    return json.dumps(kernel, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


# ------------------------------------------------------------------ reading one IR question

def _sides(node):
    return (node.left, node.right) if type(node).__name__ == "Relation" else (node,)


def _pieces(node):
    """[(sign, piece)] of an expression in written order: sign '+' or '-'; a leading unary minus is '-'."""
    if type(node).__name__ == "Sum":
        pieces = [("+", node.first)] + [(op, piece) for op, piece in node.rest]
    else:
        pieces = [("+", node)]
    if type(pieces[0][1]).__name__ == "Neg":
        pieces[0] = ("-", pieces[0][1].operand)
    return pieces


def _run_text(pieces):
    """The verbatim (canonical unparse) form of a run of pieces, as comparable tuples."""
    return tuple((sign, school_math.unparse(piece)) for sign, piece in pieces)


def _run_values(pieces):
    """The term multiset of a run of pieces: each signed piece's exact value."""
    return Counter(tuple(sorted(_scale(_value(piece), -1 if sign == "-" else 1).items()))
                   for sign, piece in pieces)


def _contains_run(pieces, run):
    width = len(run)
    texts = _run_text(pieces)
    return any(texts[start:start + width] == run for start in range(len(texts) - width + 1))


def _leaves(kernel, out):
    if isinstance(kernel, dict):
        if kernel.get("type") in ("number", "symbol"):
            out.add(_canonical(kernel))
        for arg in kernel.get("args") or ():
            _leaves(arg, out)
    return out


class _Item:
    """One IR item read through school_math: its displays, task and key (codes and values only)."""

    def __init__(self, item, index):
        self.index = index
        answer = item["answer"]
        task = answer["task"]
        self.task_expression = task["expression"]
        self.task = _canonical(self.task_expression)
        values = task.get("values") or {}
        key = answer["key"]
        self.key_node = school_math.parse(key["notation"], letters=tuple(key["symbols"]))
        self.key_value = _value(self.key_node)
        key_pieces = _pieces(self.key_node)
        self.key_run = _run_text(key_pieces) if len(key_pieces) >= 2 else None
        nodes = [school_math.parse(span["notation"], letters=tuple(span["symbols"]), allow_relation=True)
                 for span in item["prompt"] if span.get("kind") == "display"]
        kernels = [None if type(node).__name__ == "Relation" else school_math.to_kernel(node) for node in nodes]
        task_at = next((at for at, kernel in enumerate(kernels) if kernel == self.task_expression), None)
        # Operands are the displays the task is stated from: the substituted values of a
        # displayed task; when the task is not displayed as one atom (write_from_words),
        # the numbers and letters it is built of. Every other display is a checked atom
        # (a find_error wrong result is one, even when it equals a leaf of the task).
        leaves = _leaves(self.task_expression, set()) if task_at is None else set()
        self.displays = []               # (node, role): role 'task' | 'operand' | 'atom'
        for at, node in enumerate(nodes):
            if at == task_at:
                role = "task"
            elif kernels[at] is None:
                left, right = node.left, node.right
                operand = (type(left).__name__ == "Var" and left.name in values
                           and school_math.to_kernel(right) == values[left.name])
                role = "operand" if operand else "atom"
            elif kernels[at].get("type") in ("number", "symbol") and _canonical(kernels[at]) in leaves:
                role = "operand"
            else:
                role = "atom"
            self.displays.append((node, role))

    def task_display(self):
        return next((node for node, role in self.displays if role == "task"), None)

    def shows(self, run):
        """Whether a display of this item holds ``run`` as a contiguous run of terms."""
        return any(_contains_run(_pieces(side), run) for node, _ in self.displays for side in _sides(node))


def _read(question):
    return [_Item(item, index) for index, item in enumerate(question["items"], 1)]


def _facts(overlay):
    letters = tuple((overlay or {}).get("letters") or ())
    out = []
    for left, right in (overlay or {}).get("ruleFacts") or ():
        left_node = school_math.parse(left, letters=letters)
        right_node = school_math.parse(right, letters=letters)
        out.append((_value(left_node), _value(right_node), _run_values(_pieces(left_node))))
    return out


# ------------------------------------------------------------------ the D12 mirror

def _render(spans):
    """What general_adapters.rich_text emits for v5 middle spans: text as written, displays as islands."""
    out = []
    for span in spans:
        if span.get("kind") == "text":
            out.append(span["text"])
        elif span.get("kind") == "display":
            out.append(school_math.display_island(span))
        else:
            raise ValueError("SOURCE_RICH_TEXT")
    return "".join(out)


def d12_mirror(question: dict, skill_path: str) -> list[int]:
    """1-based item indices the pinned D12 would FAIL or REVIEW, using the pinned f_atoms/f_hit on the exact strings
    the adapter emits: atoms = f_atoms(key_island(key)); words = [intro text] + every item's rendered prompt.
    No stated-given exemption, no givens read (G6); later items count too (pinned REVIEW, v5 refuses)."""
    pinned = pinned_module(skill_path)
    items = question["items"]
    words = [_render(question.get("intro") or [])] + [_render(item["prompt"]) for item in items]
    hits = []
    for index, item in enumerate(items, 1):
        atoms = pinned.f_atoms(school_math.key_island(item["answer"]["key"]))
        if atoms and any(pinned.f_hit(atoms, text) for text in words):
            hits.append(index)
    return hits


# ------------------------------------------------------------------ public checks

def question_leaks(question: dict, overlay, *, skill_path: str | None) -> list[tuple[int, str]]:
    """[(item index, code)] over one IR question: DUPLICATE_ITEM (later item), LEAK_OWN, LEAK_LINKED (later item),
    LEAK_RULE_FACT and, when skill_path is given, LEAK_PINNED_VALUE. Monotone: removing items never adds a hit."""
    items = _read(question)
    facts = _facts(overlay)
    hits = set()
    for later in items:
        if any(earlier.task == later.task for earlier in items[:later.index - 1]):
            hits.add((later.index, DUPLICATE_ITEM))
    for item in items:
        if item.key_value not in _IGNORED_KEYS:
            atoms = [side for node, role in item.displays if role == "atom" for side in _sides(node)]
            if (any(_value(side) == item.key_value for side in atoms)
                    or any(item.key_value in (left, right) for left, right, _ in facts)):
                hits.add((item.index, LEAK_OWN))
        task = item.task_display()
        if task is not None and facts:
            pieces = _pieces(task)
            for _, _, multiset in facts:
                width = sum(multiset.values())
                if any(_run_values(pieces[start:start + width]) == multiset
                       for start in range(len(pieces) - width + 1)):
                    hits.add((item.index, LEAK_RULE_FACT))
    for owner in items:
        if owner.key_run is None or owner.key_value in _IGNORED_KEYS:
            continue
        for other in items:
            if other is not owner and other.shows(owner.key_run):
                hits.add((max(owner.index, other.index), LEAK_LINKED))
    if skill_path is not None:
        hits.update((index, LEAK_PINNED_VALUE) for index in d12_mirror(question, skill_path))
    return sorted(hits)


def _linked(source, target):
    """Whether a key of two or more terms of ``source`` appears verbatim in a display of ``target``."""
    return any(owner.key_run is not None and owner.key_value not in _IGNORED_KEYS and other.shows(owner.key_run)
               for owner in source for other in target)


def _example_tasks(examples):
    """Canonical kernel tasks of every side of every display span among ``examples``."""
    out = set()
    for span in examples or ():
        if isinstance(span, dict) and span.get("kind") == "display":
            node = school_math.parse(span["notation"], letters=tuple(span["symbols"]), allow_relation=True)
            out.update(_canonical(school_math.to_kernel(side)) for side in _sides(node))
    return out


def sheet_leaks(questions: list, *, examples=()) -> dict[int, list[str]]:
    """{0-based index of the LATER question: sorted codes} for DUPLICATE_TASK and LEAK_SHEET_INVERSE (§4).

    ``examples`` (keyword, default none): spans the sheet prints as worked examples,
    e.g. the IR root's ``rule``; text spans are ignored. A question with an item
    whose task is exactly a side of such a display gets EXAMPLE_COPY.
    """
    read = [_read(question) for question in questions]
    copies = _example_tasks(examples)
    hits = {}
    for later, items in enumerate(read):
        codes = set()
        for earlier in range(later):
            if {item.task for item in read[earlier]} & {item.task for item in items}:
                codes.add(DUPLICATE_TASK)
            if _linked(read[earlier], items) or _linked(items, read[earlier]):
                codes.add(LEAK_SHEET_INVERSE)
        if copies and any(item.task in copies for item in items):
            codes.add(EXAMPLE_COPY)
        if codes:
            hits[later] = sorted(codes)
    return hits
