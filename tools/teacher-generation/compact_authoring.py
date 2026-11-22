"""Expand bounded worksheet notation into the existing data-only source format."""

from copy import deepcopy
from fractions import Fraction
import re

from general_source import GeneralSourceError, MAX_BYTES
from math_tasks import MathTaskError, inspect_ast, number, operation

TOKEN = re.compile(r"[0-9]+(?:\.[0-9]+)?|sqrt|frac|[xyab+*/^(),-]")
GEOMETRY = re.compile(r"(point|segment|triangle|angle|polygon):([A-Z]{1,8})")
OP = {
    "+": ("add", 1),
    "-": ("subtract", 1),
    "*": ("multiply", 2),
    "/": ("divide", 2),
    "^": ("power", 3),
}
END = ""


def invalid():
    raise GeneralSourceError(
        "SOURCE_NOTATION", "Invalid or unsupported compact mathematical notation"
    )


def expression(value, grade, *, blank_symbol=False, printed=False):
    if not isinstance(value, str):
        # Typed source (e.g. an older retained response) is checked as usual.
        return value
    if len(value) > 220:
        invalid()
    parts = value.split()
    tokens = [token for part in parts for token in TOKEN.findall(part)]
    if not tokens or len(tokens) > 96 or "".join(tokens) != "".join(parts):
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
            left = (
                number(-arg["numerator"], arg["denominator"])
                if arg["type"] == "number"
                else operation("subtract", number(0), arg)
            )
        elif token == "(":
            left = parse()
            expect(")")
        elif token and token[0].isdigit():
            val = Fraction(token)
            left = number(val.numerator, val.denominator)
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


def display_parts(value, grade):
    """Only display formulas can contain a relation, a blank or a diagram label."""
    if not isinstance(value, str) or not 1 <= len(value) <= 220:
        invalid()
    source = value.strip()
    point = COORDINATE.fullmatch(source)
    if point and grade >= 7:
        return [f"{point[1]}({int(point[2])}, {int(point[3])})"]
    if source in RELATIONS:
        return [RELATIONS[source]]
    parts = RELATION.split(source)
    if len(parts) > 19:
        invalid()
    result = []
    for piece in parts:
        if piece in RELATIONS:
            result.append(RELATIONS[piece])
            continue
        aliases = {}

        def rename(match):
            name = match[0]
            if name in ("frac", "sqrt"):
                return name
            if name != "___" and (
                grade < 7 or not re.fullmatch(r"[a-z]|[A-Z]{1,8}", name)
            ):
                invalid()
            if name not in aliases:
                if len(aliases) >= 4:
                    invalid()
                aliases[name] = "xyab"[len(aliases)]
            return aliases[name]

        rewritten = DISPLAY_NAME.sub(rename, piece)
        tree = expression(
            rewritten, grade, blank_symbol=grade < 7 and "___" in aliases, printed=True
        )
        result.append((tree, {alias: name for name, alias in aliases.items()}))
    return result


def needs_display_formula(value):
    return bool(
        RELATION.search(value)
        or COORDINATE.fullmatch(value)
        or "___" in value
        or any(
            m[0] not in ("x", "y", "a", "b", "frac", "sqrt")
            for m in DISPLAY_NAME.finditer(value)
        )
    )


FRACTION_LITERAL = re.compile(r"(?<![.0-9/])([0-9]+)\s*/\s*([0-9]+)(?![.0-9/])")
ISLAND = r"\[\[([^\[\]]+)\]\]"
JOINED_ISLANDS = re.compile(
    ISLAND + r"\s*([+*/^−÷×<>!=≤≥≠-](?:___|[+*/^−÷×<>!=≤≥≠ -])*)\s*" + ISLAND
)
MATH_TRANSLATION = str.maketrans({"−": "-", "×": "*", "·": "*", "÷": "/"})


def fraction_literals(value):
    return FRACTION_LITERAL.sub(r"frac(\1,\2)", value)


def join_islands(value):
    # Read one arithmetic expression in LTR when the author wrote its
    # operands in adjacent islands. Ordinary Hebrew text is never joined.
    value = re.sub(r"(?<!\w)___\s*([+*/−÷×=<>-])\s*" + ISLAND, r"[[___ \1 \2]]", value)
    while True:
        joined = JOINED_ISLANDS.sub(r"[[\1 \2 \3]]", value)
        if joined == value:
            return joined
        value = joined


# An author may list standalone comparison signs in Hebrew instructions.
# Adjacent text or digits stay in their original block for strict validation.
PROSE_COMPARATOR = re.compile(r"(?<![^\s(,])(!=|<=|>=|[=<>≤≥≠])(?![^\s),.:!?])")


def prose_spans(prose):
    start = 0
    for match in PROSE_COMPARATOR.finditer(prose):
        if prose[start : match.start()].strip():
            yield {"kind": "text", "text": prose[start : match.start()]}
        yield {"kind": "formula", "notation": match[0]}
        start = match.end()
    if prose[start:].strip():
        yield {"kind": "text", "text": prose[start:]}


def spans(value, grade, *, fraction_notation=False):
    if not isinstance(value, str):
        return value
    if len(value) > 2400:
        invalid()
    result = []
    pieces = re.split(r"(\[\[|\]\])", join_islands(value))
    i = 0
    while i < len(pieces):
        prose = pieces[i]
        result.extend(prose_spans(prose))
        if i + 1 == len(pieces):
            break
        if pieces[i + 1] != "[[" or i + 3 >= len(pieces) or pieces[i + 3] != "]]":
            invalid()
        atom = pieces[i + 2].strip().translate(MATH_TRANSLATION)
        if fraction_notation:
            # In fraction topics a written pair 1/2 is a fraction, including
            # inside a sum. Keep the expression in the pupil's notation.
            atom = fraction_literals(atom)
        geo = GEOMETRY.fullmatch(atom)
        if geo:
            result.append({"kind": "geometry", "type": geo[1], "names": geo[2]})
        elif needs_display_formula(atom):
            display_parts(atom, grade)
            result.append({"kind": "formula", "notation": atom})
        else:
            result.append(
                {"kind": "math", "expression": expression(atom, grade, printed=True)}
            )
        i += 4
    return result


def wire_schema(schema, statistics):
    """Describe concise forms instead of repeating typed span/AST keys hundreds of times."""
    defs = schema["$defs"]
    defs["expression"] = {
        "type": "string",
        "minLength": 1,
        "maxLength": 220,
        "pattern": r"^[0-9a-z+*/^(),. -]+$",
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


MISSING_TABLE_REFERENCE = re.compile(
    r"(?:הטבלה הבאה|בטבלה שלפני(?:כם|כן)|לפי הטבלה המצורפת|התוצאה הנכונה מהשורה השנייה)"
)


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
            intro = question.get("intro")
            if (
                isinstance(intro, str)
                and "table" not in question
                and MISSING_TABLE_REFERENCE.search(intro)
            ):
                raise GeneralSourceError(
                    "SOURCE_TABLE",
                    "The question refers to a table that was not supplied",
                )
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
                        expand_task(answer["task"], grade, fraction_notation)
                    if "text" in answer:
                        answer["text"] = rich(answer["text"])
    return data
