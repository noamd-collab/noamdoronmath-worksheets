"""Expand bounded worksheet notation into the existing data-only source format."""

from copy import deepcopy
from itertools import groupby
import re

from general_source import GeneralSourceError, MAX_BYTES
from math_tasks import MAX_POWER, MathTaskError, inspect_ast, number, operation
from numeric_literals import COEFFICIENT, NUMBER_TOKEN, arithmetic_tokens, display_literal, elementary_operations, literal_value

GEOMETRY = re.compile(r"(point|segment|triangle|angle|polygon):([A-Z]{1,8})")
OP = {
    "+": ("add", 1),
    "-": ("subtract", 1),
    "*": ("multiply", 2),
    "/": ("divide", 2),
    "^": ("power", 3),
}
END = ""
VARIABLES = frozenset("xyab")
PI = frozenset(("pi", "π"))
# Juxtaposition that schoolbooks read as a product: 3(x+2), (x+2)(x-3), 2ab.
IMPLICIT_PRODUCT = re.compile(r"[0-9xyab)π]\s*\(|\)\s*[xyabπ]|[xyabπ]\s*[xyabπ]|[0-9]\s*(?:π|pi|sqrt)")
# A letter must touch its factor. With a space between, "x y" can also be a list of two names.
SPACED_LETTERS = re.compile(r"[0-9xyabπ)]\s+(?:[xyabπ]|pi)|(?:[xyabπ]|pi)\s+[0-9xyabπ]")
_EXPONENTS = "|".join(str(n) for n in range(MAX_POWER, -1, -1))


def invalid():
    raise GeneralSourceError(
        "SOURCE_NOTATION", "Invalid or unsupported compact mathematical notation"
    )


def implicit_products(tokens):
    """Insert the product sign that middle-school juxtaposition stands for.

    Only between a closed left factor and the start of a right one, and never
    where a second reading exists: after a divisor (1/2(x+1)), after a
    bracketed exponent, between a number and frac (a mixed number), between two
    numbers, for a repeated letter, or for letters with a space between them
    (the caller checks that). An exponent is always a literal here, so
    x^2(x+1) can only be the square times the bracket.
    """
    out = []
    for token in tokens:
        previous = out[-1] if out else END
        closes = previous == ")" or previous in VARIABLES or previous in PI or previous[:1].isdigit()
        opens = token == "(" or token in VARIABLES or token in PI or token == "sqrt"
        if closes and opens:
            if previous == token and token in VARIABLES:
                invalid()
            start = len(out) - 1
            if previous == ")":
                depth = 0
                while start >= 0:
                    depth += (out[start] == ")") - (out[start] == "(")
                    if depth == 0:
                        break
                    start -= 1
                if start < 0:
                    invalid()
                if start and out[start - 1] in ("sqrt", "frac"):
                    start -= 1
            if start and out[start - 1] == "-" and (start == 1 or out[start - 2] in OP or out[start - 2] in ("(", ",")):
                start -= 1
            if start and (out[start - 1] == "/" or out[start - 1] == "^" and not (
                    start == len(out) - 1 and previous.isdigit())):
                invalid()
            out.append("*")
        out.append(token)
    return out


def expression(value, grade, *, blank_symbol=False, printed=False, spellings=None, implicit=True, as_written=False):
    """Parse compact notation into an exact tree.

    ``printed`` marks notation that the pupil reads, printed from this tree.
    The tree has no negation sign, so a minus before anything but a number
    (-2^4, -x, -(x + 1)) is refused there: it would print as 0 − 2^4, with a
    zero that was never written. ``as_written`` marks notation that the
    caller prints in its own spelling, not from the tree.
    """
    if not isinstance(value, str):
        # Typed source (e.g. an older retained response) is checked as usual.
        return value
    if len(value) > 220:
        invalid()
    if grade >= 7 and COORDINATE.fullmatch(value.strip()):
        invalid()
    try:
        normalized = COEFFICIENT.sub(r"*\1", value) if grade >= 7 else elementary_operations(value)
        tokens = list(arithmetic_tokens(normalized))
    except ValueError:
        invalid()
    if grade >= 7 and implicit:
        if SPACED_LETTERS.search(normalized):
            invalid()
        tokens = implicit_products(tokens)
    if not tokens or len(tokens) > 96:
        invalid()
    index = 0

    def peek():
        return tokens[index] if index < len(tokens) else END

    def take():
        nonlocal index
        token = peek()
        index += 1
        return token

    def expect(wanted):
        if take() != wanted:
            invalid()

    def parse(precedence=1):
        token = take()
        if token == "-":
            arg = parse(3)
            if printed and not as_written and arg["type"] != "number":
                invalid()
            left = (
                number(-arg["numerator"], arg["denominator"])
                if arg["type"] == "number"
                else operation("subtract", number(0), arg)
            )
            if spellings is not None and id(arg) in spellings:
                previous = spellings[id(arg)][1]
                spelling = previous[1:] if previous.startswith("-") else "-" + previous
                spellings[id(left)] = (left, spelling)
        elif token == "(":
            left = parse()
            expect(")")
        elif token and token[0].isdigit():
            val = literal_value(token)
            left = number(val.numerator, val.denominator)
            if spellings is not None and any(mark in token for mark in ",.%"):
                if display_literal(token) is None:
                    invalid()
                spellings[id(left)] = (left, token)
        elif token == "frac":
            expect("(")
            numerator = parse()
            expect(",")
            denominator = parse()
            expect(")")
            if any(
                node.get("type") != "number" or node["denominator"] != 1
                for node in (numerator, denominator)
            ):
                invalid()
            left = number(numerator["numerator"], denominator["numerator"])
            if printed and denominator["numerator"] > 0:
                left = {
                    "type": "number",
                    "numerator": numerator["numerator"],
                    "denominator": denominator["numerator"],
                }
        elif token == "sqrt" and grade >= 7:
            expect("(")
            left = operation("sqrt", parse())
            expect(")")
        elif (token in {"x", "y", "a", "b"} and grade >= 7) or (
            blank_symbol and token == "x"
        ):
            left = {"type": "symbol", "name": token}
        elif token in PI and grade >= 7:
            left = {"type": "constant", "name": "pi"}
        else:
            invalid()
        while peek() in OP and OP[peek()][1] >= precedence:
            symbol = take()
            if (grade == 1 and symbol in ("*", "/")) or (grade < 4 and symbol == "^"):
                invalid()
            name, binding = OP[symbol]
            right = parse(binding if symbol == "^" else binding + 1)
            left = operation(name, left, right)
        return left

    try:
        tree = parse()
        if index != len(tokens):
            invalid()
        inspect_ast(tree)
    except MathTaskError as exc:
        raise GeneralSourceError(
            exc.code, "Mathematics exceeds the exact verifier's limits"
        ) from None
    return tree


RELATIONS = {
    "=": "=",
    "<": "<",
    ">": ">",
    "<=": "≤",
    ">=": "≥",
    "!=": "≠",
    "≤": "≤",
    "≥": "≥",
    "≠": "≠",
}
RELATION = re.compile(r"(!=|<=|>=|[=<>≤≥≠])")
DISPLAY_NAME = re.compile(r"sqrt|frac|___|[A-Z]{1,8}|[a-z]+")
COORDINATE = re.compile(r"([A-Z]?)\(\s*(-?[0-9]{1,6})\s*,\s*(-?[0-9]{1,6})\s*\)")


ANGLE_NAME = r"∠\s*(?:[A-Z]{3}|[A-Z])"
DEGREES = r"[0-9]{1,3}(?:\.[0-9]{1,4})?\s*°"
# One angle or a sum of angles; a chain of equal angles that may end in a measure.
ANGLE_TERM = rf"{ANGLE_NAME}(?:\s*\+\s*{ANGLE_NAME}){{0,3}}"
ANGLE_MEASURE = rf"{ANGLE_TERM}(?:\s*=\s*{ANGLE_TERM}){{0,3}}(?:\s*=\s*{DEGREES})?"
LINE_RELATION = r"[A-Z]{2}\s*[⊥∥]\s*[A-Z]{2}"
GEO_SYMBOLS = re.compile(rf"(?:{ANGLE_MEASURE}|{LINE_RELATION}|{DEGREES}|△\s*[A-Z]{{3}})")


def geometric_display(source):
    """Only generate pinned skill notation from whole, closed Unicode tokens."""
    if not GEO_SYMBOLS.fullmatch(source):
        return None
    if any(len(set(name)) != len(name) for name in re.findall(r"[A-Z]+", source)):
        invalid()
    # These four commands are emitted by us. Input cannot contain a command.
    source = re.sub(r"∠\s*([A-Z]+)", lambda m: r"\angle{" + m[1] + "}", source)
    source = re.sub(r"△\s*([A-Z]+)", lambda m: r"\tri " + m[1], source)
    source = re.sub(r"\s*([⊥∥=+])\s*", lambda m: " " + {"⊥": r"\perp", "∥": r"\para", "=": "=", "+": "+"}[m[1]] + " ", source)
    return re.sub(r"\s+°", "°", source)


# A blank between two complete operands stands for a sign, never a number.
SIGN_BLANK = re.compile(r"(?<=[0-9)%])\s*___\s*(?=[-−]?(?:[0-9(]|frac|sqrt))")


def display_parts(value, grade):
    """Only display formulas can contain a relation, a blank or a diagram label."""
    if not isinstance(value, str) or not 1 <= len(value) <= 220:
        invalid()
    source = value.strip()
    if grade >= 7 and (geometry := geometric_display(source)) is not None:
        return [geometry]
    sides = SIGN_BLANK.split(source)
    if len(sides) > 1:
        # "345 ___ 354" asks for a comparison sign. The blank must never be
        # read as the letter of a multiplication, and a missing operation in
        # an equation has no exact key.
        if len(sides) != 2 or RELATION.search(source) or "___" in "".join(sides):
            invalid()
        left, right = (display_parts(side, grade) for side in sides)
        if len(left) != 1 or len(right) != 1:
            invalid()
        return [left[0], "___", right[0]]
    if grade < 7:
        source = elementary_operations(source)
        # The pinned elementary signs admit a measured angle from grade five.
        if grade >= 5 and re.fullmatch(DEGREES, source):
            return [re.sub(r"\s+°", "°", source)]
    point = COORDINATE.fullmatch(source)
    if point and grade >= 7:
        return [f"{point[1]}({int(point[2])}, {int(point[3])})"]
    if source in RELATIONS:
        return [RELATIONS[source]]
    literal = display_literal(source)
    if literal is not None:
        return [literal]
    if grade >= 7 and re.fullmatch(r"[a-z]%", source):
        # "p%": a letter's percent, printed as written and never computed.
        return [source]
    parts = RELATION.split(source)
    if len(parts) > 19:
        invalid()
    result = []
    for piece in parts:
        if piece in RELATIONS:
            result.append(RELATIONS[piece])
            continue
        aliases = {}

        def alias(name):
            if name != "___" and (
                grade < 7 or not re.fullmatch(r"[a-z]|[A-Z]{1,8}|∠[A-Z]{1,3}|[a-z][0-9]", name)
            ):
                invalid()
            if name not in aliases:
                if len(aliases) >= 4:
                    invalid()
                aliases[name] = "xyab"[len(aliases)]
            return aliases[name]

        def rename(match):
            name = match[0]
            if name in ("frac", "sqrt", "pi"):
                return name
            if grade >= 7 and re.fullmatch(r"[xyab]{2,4}", name) and len(set(name)) == len(name):
                # A product of distinct variables, 2ab: every letter is its own name.
                return "".join(alias(letter) for letter in name)
            return alias(re.sub(r"\s+", "", name))

        names = DISPLAY_NAME
        if grade >= 7:
            # An angle is one name (∠BAD = 3x); d1 is a subscripted name, unless its
            # letter also stands alone, where x2 could be a product.
            bare = set(re.findall(r"(?<![A-Za-z0-9_])[xy](?![A-Za-z0-9_])", piece))
            subscript = r"(?<![A-Za-z0-9_])[a-z][0-9](?![0-9A-Za-z_.])"
            names = re.compile(r"∠\s*[A-Z]{1,3}(?![A-Za-z])|" + subscript + "|" + DISPLAY_NAME.pattern)
            if any(re.search(r"(?<![A-Za-z0-9_])" + letter + r"[0-9]", piece) for letter in bare):
                names = re.compile(r"∠\s*[A-Z]{1,3}(?![A-Za-z])|" + DISPLAY_NAME.pattern)
        rewritten = names.sub(rename, piece)
        spellings = {}
        # In an already parsed schoolbook polynomial keep ordinary numerical
        # coefficients and juxtaposed factors as written. No model markup is copied.
        as_written = bool(grade >= 7 and (COEFFICIENT.search(piece) or IMPLICIT_PRODUCT.search(piece)) and
                          re.fullmatch(r"[0-9xyab,.+()\s^\-]+", piece) and
                          not re.search(rf"\^(?!(?:{_EXPONENTS})(?![0-9]))", piece))
        # Two diagram labels side by side are not a product.
        tree = expression(rewritten, grade, blank_symbol=grade < 7 and "___" in aliases,
                          printed=True, spellings=spellings, as_written=as_written,
                          implicit=not any(name == "___" or name.isupper() for name in aliases))
        if as_written:
            result.append(re.sub(rf"\^({_EXPONENTS})(?![0-9])", r"^{\1}", piece.strip().replace("-", "−")))
        else:
            result.append((tree, {alias: printed_name(name) for name, alias in aliases.items()}, spellings))
    return result


def printed_name(name):
    """How a display name prints: ∠BAD as \\angle{BAD}, d1 as d_{1}, any other name as written."""
    if name.startswith("∠"):
        return r"\angle{" + name[1:] + "}"
    if re.fullmatch(r"[a-z][0-9]", name):
        return name[0] + "_{" + name[1] + "}"
    return name


def has_written_number(value):
    if re.search(r"[0-9](?:\.[0-9]|%)", value):
        return True
    if "," not in value or COORDINATE.fullmatch(value.strip()):
        return False
    probe = DISPLAY_NAME.sub(lambda m: m[0] if m[0] in ("frac", "sqrt") else "x", value)
    try:
        return any("," in token and token != "," for token in arithmetic_tokens(RELATION.sub(" ", probe)))
    except ValueError:
        return False


def needs_display_formula(value):
    return bool(
        has_written_number(value)
        or re.fullmatch(r"[a-z]%", value)
        or GEO_SYMBOLS.fullmatch(value)
        or COEFFICIENT.search(value)
        or IMPLICIT_PRODUCT.search(value)
        or RELATION.search(value)
        or COORDINATE.fullmatch(value)
        or "___" in value
        or any(
            m[0] not in ("x", "y", "a", "b", "frac", "sqrt", "pi")
            for m in DISPLAY_NAME.finditer(value)
        )
    )


def schoolbook_tokens(value, grade):
    """A closed elementary calculation whose printed parentheses carry information."""
    if grade >= 7 or not isinstance(value, str) or len(value) > 220:
        return None
    if not re.fullmatch(r"[0-9\s,.()+*/%_!=<>≤≥≠−-]+", value):
        return None
    if not re.search(r"[()+*/=<>≤≥≠]|[0-9)]\s*[-−]", value) or SIGN_BLANK.search(value):
        return None
    pieces = RELATION.split(value.translate(MATH_TRANSLATION))
    if len(pieces) > 19 or any(not part.strip() for part in pieces):
        return None
    tokens = []
    for part in pieces:
        if part in RELATIONS:
            tokens.append(RELATIONS[part])
            continue
        plain = part.replace("___", "x")
        try:
            operands = list(arithmetic_tokens(plain))
        except ValueError:
            return None
        if any(t not in {"(", ")", "+", "-", "*", "/", "x"} and display_literal(t) is None for t in operands):
            return None
        expression(plain, grade, blank_symbol="___" in part)
        tokens.extend("___" if t == "x" else t for t in operands)
    return tokens


_FRACTION_INTEGER = r"(?:[1-9][0-9]{0,2}(?:,[0-9]{3})+|[0-9]+)"
FRACTION_LITERAL = re.compile(rf"(?<![,.0-9/])({_FRACTION_INTEGER})\s*/\s*({_FRACTION_INTEGER})(?![,.0-9/])")
ISLAND = r"\[\[([^\[\]]+)\]\]"
JOINED_ISLANDS = re.compile(
    ISLAND + r"\s*([+*/^−÷×<>!=≤≥≠-](?:___|[+*/^−÷×<>!=≤≥≠ -])*)\s*" + ISLAND
)
MATH_TRANSLATION = str.maketrans({"−": "-", "×": "*", "·": "*", "÷": "/"})


def fraction_literals(value):
    # The comma in frac(n,d) is always structural. Written groups in an
    # original numerator or denominator must be decoded before constructing it.
    return FRACTION_LITERAL.sub(lambda m: f"frac({m[1].replace(',', '')},{m[2].replace(',', '')})", value)


def join_islands(value):
    # Read one arithmetic expression in LTR when the author wrote its
    # operands in adjacent islands. Ordinary Hebrew text is never joined.
    value = re.sub(r"(?<!\w)___\s*([+*/−÷×=<>-])\s*" + ISLAND, r"[[___ \1 \2]]", value)
    while True:
        joined = JOINED_ISLANDS.sub(r"[[\1 \2 \3]]", value)
        if joined == value:
            return joined
        value = joined


# Comparison signs listed as separate options can be isolated without guessing.
PROSE_COMPARATOR = re.compile(r"(?<![^\s(,])(!=|<=|>=|[=<>≤≥≠])(?![^\s),.:!?])")
PROSE_ATOM = re.compile(
    r"(?P<coordinate>[A-Z]?\(\s*[-−]?[0-9]{1,6}\s*,\s*[-−]?[0-9]{1,6}\s*\))"
    rf"|(?P<number>[-−]?(?:{NUMBER_TOKEN.pattern})%?)"
    r"|(?P<label>[A-Z]{1,8}|[abxy])"
    rf"|(?P<comparison>{PROSE_COMPARATOR.pattern})"
)
SEGMENT_EQUALITY = rf"[A-Z]{{2}}\s*=\s*(?:[A-Z]{{2}}|{NUMBER_TOKEN.pattern})"
LINEAR_TERM = rf"(?:{NUMBER_TOKEN.pattern}[xyab]?|[xyab])"
LINEAR_SIDE = rf"[-−]?{LINEAR_TERM}(?:\s*[+*/−-]\s*{LINEAR_TERM}){{0,4}}"
EQUATION_CUE = re.compile(r"(?<![א-ת])(?:[בהלו]?משוואה|[בהלו]?שוויון)(?:\s+הבא(?:ה)?)?\s*:?\s*$")
MIDDLE_ATOM = re.compile(rf"(?P<geometric>{GEO_SYMBOLS.pattern}|{SEGMENT_EQUALITY})|"
                         rf"(?P<equation>{LINEAR_SIDE}\s*=\s*{LINEAR_SIDE})|" + PROSE_ATOM.pattern)
HEBREW_PREFIX = re.compile(r"(?:^|\s)(?:ו[מבכלהש]?|[מבכלהש])$")
LABEL_CONTEXT = re.compile(
    r"(?:^|\s)(?:[ובלכמשה]{0,3}(?:נקוד(?:ה|ת|ות)|קטע(?:ים)?|צלע(?:ות)?|זווית|"
    r"משולש|מרובע|מלבן|ריבוע|מצולע|אלכסון|ישר|ציר|קודקוד|משתנה|נעלם|גובה|תיכון|"
    r"בסיס|ניצב|יתר|אמצע|אורך|רדיוס|מיתר|קוטר)|ער[ךכ]ו? של)\s+$"
)
LABEL_DESCRIPTION = re.compile(r"\s+(?:הוא|היא)\s+(?:ה?גובה|ה?תיכון|ה?צלע|ה?קטע|ה?יתר|ה?בסיס|חוצה זווית|אמצע|משולש|מרובע)(?![א-ת])")
COORDINATE_CONTEXT = re.compile(r"(?:נקוד(?:ה|ת|ות)|שיעורים|זוג סדור)\s*$")
LABEL_SEPARATOR = re.compile(r"(?:\s+[ול][־-]?|,\s*)")
NUMBER_LIST_PREFIX = re.compile(
    rf"(?:(?:רשימה|אפשרויות|מספרים)\s*:|(?:התוצאות הן|הערכים הם|המספרים הם))"
    rf"\s*(?:[-−]?{NUMBER_TOKEN.pattern}%?\s*,\s+)*$"
)


def standalone_atom(prose, start, end):
    """Leave dates, ratios, ranges, algebra, identifiers and markup to strict validation."""
    before, after = prose[:start], prose[end:]
    # An ASCII hyphen immediately after a Hebrew prefix is punctuation (מ-25),
    # unlike a unary minus. Handle it on the next unsigned candidate.
    left = before.rstrip()
    right = after.lstrip()
    if left.endswith(("+", "-", "−", "–", "—", "×", "÷", "·", "*", "/", "^", "=", "<", ">", "≤", "≥")):
        if not (before.endswith("-") and HEBREW_PREFIX.search(before[:-1])):
            return False
    if right.startswith(("+", "-", "−", "–", "—", "×", "÷", "·", "*", "/", "^", "=", "<", ">", "≤", "≥", "%")):
        return False
    if re.search(r"[A-Za-z0-9_.$%@#א-ת]$", before) or re.match(r"[A-Za-z0-9_$@#]", after):
        return False
    left_joined = re.search(r"[0-9]\s*[:,.]\s*$", before)
    right_joined = re.match(r"\s*[:,.]\s*[0-9]", after)
    if left_joined or right_joined:
        if not NUMBER_LIST_PREFIX.search(before):
            return False
        if right_joined and not re.match(r",\s+[0-9]", after):
            return False
    return True


def prose_spans(prose, grade):
    start = 0
    previous_label = False
    scanner = MIDDLE_ATOM if grade >= 7 else PROSE_ATOM
    for match in scanner.finditer(prose):
        first, last = match.span()
        atom = match[0]
        if match.lastgroup == "comparison":
            span = {"kind": "formula", "notation": atom}
        else:
            if atom.startswith("-") and HEBREW_PREFIX.search(prose[:first]):
                first += 1
                atom = atom[1:]
            if not standalone_atom(prose, first, last):
                continue
            if match.lastgroup in ("geometric", "equation"):
                if match.lastgroup == "equation" and not EQUATION_CUE.search(prose[:first]):
                    continue
                if (prose[:first].rstrip().endswith(("∠", "△", "⊥", "∥", "°"))
                        or prose[last:].lstrip().startswith(("∠", "△", "⊥", "∥", "°"))):
                    continue
                atom = atom.translate(MATH_TRANSLATION)
                display_parts(atom, grade)
                span = {"kind": "formula", "notation": atom}
            elif match.lastgroup == "number":
                literal = display_literal(atom)
                if literal is None:
                    continue
                # Keep the canonical scalar representation for ordinary integers.
                # Explicit lexical features such as 25%, 0.50 and 1,000 must
                # survive both native renderers, including editable Word.
                if re.fullmatch(r"(?:0|-?[1-9][0-9]*)", literal):
                    span = {"kind": "math", "expression": expression(literal, grade, printed=True)}
                else:
                    span = {"kind": "formula", "notation": literal}
            elif grade >= 7:
                if match.lastgroup == "coordinate":
                    if atom.startswith("(") and not COORDINATE_CONTEXT.search(prose[:first]):
                        continue
                elif not (
                    LABEL_CONTEXT.search(prose[:first])
                    or (atom.isupper() and len(atom) in (2, 3, 4) and LABEL_DESCRIPTION.match(prose[last:]))
                    or (previous_label and LABEL_SEPARATOR.fullmatch(prose[start:first]))
                    or (len(atom) == 1 and re.search(r"[א-ת]", prose))
                    or (atom in {"a", "b", "x", "y"} and atom == prose.strip())
                ):
                    continue
                span = {"kind": "formula", "notation": atom.translate(MATH_TRANSLATION)}
            else:
                continue
        if first > start:
            yield {"kind": "text", "text": prose[start:first]}
        yield span
        start = last
        previous_label = match.lastgroup in ("label", "coordinate")
    if prose[start:]:
        yield {"kind": "text", "text": prose[start:]}


def _span_text(span):
    if type(span) is str:
        return span
    if type(span) is dict and set(span) == {"kind", "text"} and span["kind"] == "text" and type(span["text"]) is str:
        return span["text"]
    return None


def provider_span_array(value, grade, *, fraction_notation=False):
    """Expand text fields of a mixed provider reply before binding its printed tasks."""
    if grade < 7 or not isinstance(value, (dict, list)):
        return value
    items = [value] if isinstance(value, dict) else value
    if not 1 <= len(items) <= 30:
        return value
    result = []
    changed = False
    consumed = 0
    for is_text, run in groupby(items, key=lambda span: _span_text(span) is not None):
        fragments = list(run)
        start = consumed
        consumed += len(fragments)
        if not is_text:
            result.extend(fragments)
            continue
        texts = [_span_text(span) for span in fragments]
        if not any(re.search(r"[A-Za-z0-9]", t) for t in texts):
            result.extend(fragments)
            continue
        if any(not text or len(text) > 1200 for text in texts):
            invalid()
        # Adjacent provider text fields share the same line of ink. Tokenize
        # that line once so, for example, "x+1=4" followed by "0" means 40.
        parts = spans("".join(texts), grade, fraction_notation=fraction_notation)
        if any(part["kind"] != "text" for part in parts):
            # A pre-existing math AST has no recoverable original spelling.
            # Without intervening prose, a new box could fuse with it into a
            # different number, segment name, unit or expression in RTL.
            if ((start and not _safe_math_boundary(parts[0])) or
                    (consumed < len(items) and not _safe_math_boundary(parts[-1]))):
                invalid()
        result.extend(parts)
        changed = True
    return result if changed else value


def _safe_math_boundary(span):
    return span["kind"] == "text" and re.search(r"[א-ת]", span["text"]) is not None


def unmarked_equation(value, grade):
    """An elementary field that is one equation with one blank but is not one [[...]] formula."""
    if value.count("___") != 1 or value.count("=") != 1 or re.search(r"[<>!≤≥≠]", value):
        return False
    bare = re.sub(r"\[\[(___|[-−]?[0-9]+)\]\]", r"\1", value.strip())
    return schoolbook_tokens(elementary_operations(bare.translate(MATH_TRANSLATION)), grade) is not None


def spans(value, grade, *, fraction_notation=False):
    if not isinstance(value, str):
        return provider_span_array(value, grade, fraction_notation=fraction_notation)
    if len(value) > 2400:
        invalid()
    if re.search(r"\[\[[-−]?[0-9]+(?:\.[0-9]+)?\]\]%", value):
        # The percent sign is written inside the island with its number, [[25%]];
        # one written after the island is refused, never moved into it.
        invalid()
    joined = join_islands(value)
    if grade <= 6 and unmarked_equation(joined, grade):
        # A missing-number equation is one formula, [[24 : ___ = 6]]. Written outside
        # one, the key is not bound to the print: it is refused, never wrapped.
        invalid()
    result = []
    pieces = re.split(r"(\[\[|\]\])", joined)
    i = 0
    while i < len(pieces):
        prose = pieces[i]
        result.extend(prose_spans(prose, grade))
        if i + 1 == len(pieces):
            break
        if pieces[i + 1] != "[[" or i + 3 >= len(pieces) or pieces[i + 3] != "]]":
            invalid()
        atom = pieces[i + 2].strip().translate(MATH_TRANSLATION)
        if fraction_notation:
            # In fraction topics a written pair 1/2 is a fraction, including
            # inside a sum. Keep the expression in the pupil's notation.
            atom = fraction_literals(atom)
        if grade < 7 and ("x" in atom or ":" in atom):
            atom = elementary_operations(atom)
        if grade >= 7 and atom.startswith("point:") and COORDINATE.fullmatch(atom[6:]) and atom[6:7].isupper():
            # An explicitly named coordinate is the existing A(x,y) display form.
            atom = atom[6:]
        geo = GEOMETRY.fullmatch(atom)
        if geo:
            result.append({"kind": "geometry", "type": geo[1], "names": geo[2]})
        elif needs_display_formula(atom) or schoolbook_tokens(atom, grade) is not None:
            display_parts(atom, grade)
            result.append({"kind": "formula", "notation": atom})
        else:
            result.append(
                {"kind": "math", "expression": expression(atom, grade, printed=True)}
            )
        i += 4
    # Outer whitespace is immaterial. Two adjoining mathematical tokens with
    # only whitespace between them would otherwise print as one number/name.
    if result and result[0].get("kind") == "text" and not result[0]["text"].strip():
        result.pop(0)
    if result and result[-1].get("kind") == "text" and not result[-1]["text"].strip():
        result.pop()
    if any(span["kind"] == "text" and not span["text"].strip() for span in result):
        invalid()
    if grade >= 7:
        # Independently laid-out LTR boxes must not split a token, even if
        # the provider explicitly placed [[...]] in the middle of that token.
        for index, span in enumerate(result[1:], 1):
            if span["kind"] != "text" and result[index - 1]["kind"] != "text":
                invalid()
            if (span["kind"] != "text" and index >= 2 and result[index - 2]["kind"] != "text"
                    and result[index - 1].get("text") in (".", ",", ":", "/")):
                invalid()
    return result


def wire_schema(schema, statistics):
    """Describe concise forms instead of repeating typed span/AST keys hundreds of times."""
    defs = schema["$defs"]
    defs["expression"] = {
        "type": "string",
        "minLength": 1,
        "maxLength": 220,
        "pattern": r"^[0-9a-z+*/^(),.:% -]+$",
    }
    defs["rich"] = {"type": "string", "minLength": 1, "maxLength": 2400}
    tasks = defs["task"]["oneOf"]
    stats = next(
        t for t in tasks if t["properties"]["kind"].get("const") == "statistics"
    )
    if statistics:
        stats["properties"]["values"]["items"] = {"$ref": "#/$defs/expression"}
    else:
        tasks.remove(stats)


def expand_task(task, grade, fraction_notation):
    def expr(value):
        if isinstance(value, str):
            value = value.translate(MATH_TRANSLATION)
            if fraction_notation:
                value = fraction_literals(value)
        return expression(value, grade)

    if (
        set(task) == {"kind", "expression"}
        and task["kind"] == "evaluate"
        and grade >= 4
    ):
        value = task["expression"]
        pair = (
            re.fullmatch(
                r"\s*(lcm|gcd)\(\s*([1-9][0-9]{0,5})\s*,\s*([1-9][0-9]{0,5})\s*\)\s*",
                value,
            )
            if isinstance(value, str)
            else None
        )
        if pair:
            task.clear()
            task.update(
                kind=pair[1], left=number(int(pair[2])), right=number(int(pair[3]))
            )
    for field in ("expression", "left", "right", "lhs", "rhs"):
        if field in task:
            task[field] = expr(task[field])
    values = task.get("values")
    if isinstance(values, list):
        task["values"] = [expr(value) for value in values]
    elif isinstance(values, dict):
        task["values"] = {key: expr(value) for key, value in values.items()}
    for eq in (
        task.get("equations", []) if isinstance(task.get("equations"), list) else ()
    ):
        if isinstance(eq, dict):
            for field in ("lhs", "rhs"):
                if field in eq:
                    eq[field] = expr(eq[field])


TABLE_CONSTRUCTION = re.compile(r"(?:בנו|צרו|הכינו|ערכו) (?:לכם |בעצמכם )?טבלה(?![א-ת])")
ATTACHED_TABLE = re.compile(r"(?:הטבלה|בטבלה) (?:הבאה|הנתונה|המצורפת|שלפני(?:כם|כן))")
MISSING_TABLE_REFERENCE = re.compile(
    r"(?:הטבלה (?:הבאה|הנתונה|המצורפת|שלפני(?:כם|כן))|בטבלה (?:הנתונה|שלפני(?:כם|כן))|"
    r"(?:קראו|השלימו|מלאו) את הטבלה|(?:הערך החסר|הנתונים) בטבלה|התוצאה הנכונה מהשורה השנייה)"
)


def requires_existing_table(question):
    """Detect an explicit dependency on tabular data in compact or typed prose."""
    prompts = [question.get("intro")]
    items = question.get("items")
    if isinstance(items, list):
        prompts.extend(item.get("prompt") for item in items if isinstance(item, dict))
    prose = []
    for prompt in prompts:
        if isinstance(prompt, list):
            prompt = "".join(span.get("text", " ") for span in prompt if isinstance(span, dict)
                             and isinstance(span.get("text", " "), str))
        if isinstance(prompt, str):
            prose.append(re.sub(r"[\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7]", "", prompt))
    return (any(ATTACHED_TABLE.search(part) for part in prose)
            or (any(MISSING_TABLE_REFERENCE.search(part) for part in prose)
                and not any(TABLE_CONSTRUCTION.search(part) for part in prose)))


def expand_source(source, grade, *, fraction_notation=False):
    if not isinstance(source, dict) or source.get("version") != 4:
        return source
    from json import dumps

    if len(dumps(source, ensure_ascii=False).encode()) > MAX_BYTES:
        raise GeneralSourceError("SOURCE_SIZE", "Source exceeds byte budget")

    def rich(value):
        return spans(value, grade, fraction_notation=fraction_notation)

    data = deepcopy(source)
    if "rule" in data:
        data["rule"] = rich(data["rule"])
    for section in (
        data.get("sections", []) if isinstance(data.get("sections"), list) else ()
    ):
        if not isinstance(section, dict) or not isinstance(
            section.get("questions"), list
        ):
            continue
        for question in section["questions"]:
            if not isinstance(question, dict):
                continue
            if "table" not in question and requires_existing_table(question):
                raise GeneralSourceError("SOURCE_TABLE", "The question refers to a table that was not supplied")
            if "intro" in question:
                question["intro"] = rich(question["intro"])
            figure = question.get("figure")
            if isinstance(figure, dict) and figure.get("kind") == "coordinate_plane":
                # The paper axes include the origin. Expand only the viewport,
                # preserving every authored point, segment and mathematical quantity.
                for axis in ("xr", "yr"):
                    limits = figure.get(axis)
                    if (
                        isinstance(limits, list)
                        and len(limits) == 2
                        and all(type(v) is int and -10 <= v <= 10 for v in limits)
                        and 2 <= limits[1] - limits[0] <= 16
                    ):
                        figure[axis] = [min(0, limits[0]), max(0, limits[1])]
            table = question.get("table")
            if isinstance(table, dict):
                if isinstance(table.get("head"), list):
                    table["head"] = [rich(cell) for cell in table["head"]]
                if isinstance(table.get("rows"), list):
                    table["rows"] = [
                        [rich(cell) for cell in row] if isinstance(row, list) else row
                        for row in table["rows"]
                    ]
            for item in (
                question.get("items", [])
                if isinstance(question.get("items"), list)
                else ()
            ):
                if not isinstance(item, dict):
                    continue
                if "prompt" in item:
                    item["prompt"] = rich(item["prompt"])
                answer = item.get("answer")
                if isinstance(answer, dict):
                    if isinstance(answer.get("task"), dict):
                        task = answer["task"]
                        if task.get("kind") == "solve":
                            from printed_tasks import printed_solve
                            bound = printed_solve(item.get("prompt"), task, grade)
                            if isinstance(bound, dict):
                                task = answer["task"] = bound
                        raw = task.get("expression") if task.get("kind") == "evaluate" else None
                        if (task.get("kind") == "compare" and isinstance(task.get("left"), str)
                                and isinstance(task.get("right"), str)
                                and (has_written_number(task["left"]) or has_written_number(task["right"]))):
                            # A decimal comparison is keyed in decimals, as it was asked.
                            raw = task["left"] + " ___ " + task["right"]
                        expand_task(task, grade, fraction_notation)
                        if isinstance(raw, str) and ("___" in raw or has_written_number(raw)):
                            notation = raw.translate(MATH_TRANSLATION)
                            if fraction_notation:
                                notation = fraction_literals(notation)
                            answer.setdefault("notation", notation)
                    if "text" in answer:
                        answer["text"] = rich(answer["text"])
    return data
