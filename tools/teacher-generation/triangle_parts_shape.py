"""SSS triangle and one named construction chosen by the worksheet author."""
from fractions import Fraction
import operator
import re

TOPIC = "g8:triangle_parts"
PARTS = ("median", "angle_bisector", "altitude", "side_extension")


def foot_fraction(spec):
    """Position on B→C of the foot from A, from the law of cosines."""
    base, left, right = (spec[k] for k in ("base", "left", "right"))
    return Fraction(left * left + base * base - right * right, 2 * base * base)


def givens(spec):
    apex, b, c, d = spec["names"]
    base, left, right = (spec[k] for k in ("base", "left", "right"))
    sizes = [(b + c, base), (apex + b, left), (apex + c, right)]
    clauses = [f"${edge}={length}$" for edge, length in sizes]
    claims = [dict(type="length", of=edge, value=length) for edge, length in sizes]
    kind = spec["construction"]
    if kind == "median":
        clauses.append(f"${d}$ אמצע ${b+c}$ והקטע ${apex+d}$ הוא תיכון.")
        claims.append(dict(type="midpoint", point=d, of=[b, c]))
    elif kind == "altitude":
        clauses.append(f"הגובה ${apex+d}$ מאונך ל־${b+c}$ בנקודה ${d}$.")
        clauses.append(rf"${apex+d} \perp {b+d}$.")
        claims.append(dict(type="perpendicular", at=d, of=[b + d, apex + d]))
    elif kind == "angle_bisector":
        clauses.append(f"הקטע ${apex+d}$ חוצה את זווית הראש בקודקוד ${apex}$.")
        clauses.append(rf"$\angle{{{b+apex+d}}} = \angle{{{d+apex+c}}}$.")
        claims.append(dict(type="equal_angle", of=[b + apex + d, d + apex + c]))
    else:
        clauses.append(f"הצלע ${b+c}$ נמשכת מעבר ל־${c}$ והקטע ${c+d}$ הוא המשכה.")
    return ", ".join(clauses[:3]) + ". " + " ".join(clauses[3:]), claims


def render(spec):
    import shapekit as sk
    apex, b, c, d = spec["names"]
    base, left, right = (spec[k] for k in ("base", "left", "right"))
    # The shape constructors put the base at the first two names for an
    # isosceles triangle, and the right angle at the first name for a right one.
    opposite = {apex: base, b: right, c: left}
    names = apex + b + c
    if base == left == right:
        variant, args = "equilateral", {"a": base}
    elif len(set(opposite.values())) == 2:
        peak = next(v for v in names if list(opposite.values()).count(opposite[v]) == 1)
        ends = [v for v in names if v != peak]
        names = "".join(ends) + peak
        variant, args = "iso", {"leg": opposite[ends[0]], "base": opposite[peak]}
    else:
        longest = max(names, key=opposite.get)
        others = [v for v in names if v != longest]
        if opposite[others[0]]**2 + opposite[others[1]]**2 == opposite[longest]**2:
            names = longest + "".join(others)
            variant, args = "right", {"b": opposite[others[0]], "c": opposite[others[1]]}
        else:
            variant, args = "sss", {"a": base, "b": right, "c": left}
    kind = spec["construction"]
    family = "triangle.parts." + variant + "." + kind
    # Print the three lengths in the question. Mark only the named construction.
    g, data = sk.shape("triangle", variant=variant, names=names, fam=family,
                       rotate=spec["rotate"], marks=False, **args)
    if kind == "side_extension":
        end = sk.extend(g, data, b, c)
        sk.point(g, data, d, g.pts[end])
    else:
        build = {"median": sk.median, "angle_bisector": sk.bisector, "altitude": sk.altitude}[kind]
        build(g, data, apex, b, c, name=d, dash=None)
    return sk.finish(g, family)


# These checks target specific objectively testable errors in a free-text model
# reply. A clean result is not a certificate for proofs or arbitrary prose.
def authored_findings(rows, plan):
    multiple_coords = re.compile(r"(?:רשמו|כתבו|מצאו|קבעו) (?:את )?שיעורי (?:הנקודה )?([A-Z])\b")
    comparison = re.compile(r"(?:^|[.,:]\s*|כי\s+)(\d{1,5})\s*\+\s*(\d{1,5})\s*(<=|>=|[<>≤≥=])\s*(\d{1,6})(?=[.,;!?]|$)")
    comparators = {"<": operator.lt, ">": operator.gt, "=": operator.eq,
                   "≤": operator.le, "≥": operator.ge, "<=": operator.le, ">=": operator.ge}
    expected_drawings = sum(slot.get("representation") == "drawingFromWords" for slot in plan)
    supplied_drawings = sum(isinstance(q, dict) and q.get("drawingFromWords") is True for q in rows)
    findings = []
    for index, (q, slot) in enumerate(zip(rows, plan), 1):
        if not isinstance(q, dict) or not isinstance(q.get("items"), list):
            continue
        issues = []
        fig = q.get("figure") or {}
        if not isinstance(fig, dict):
            continue
        if (supplied_drawings > expected_drawings + 1 and q.get("drawingFromWords") is True and
                slot.get("representation") != "drawingFromWords"):
            issues.append("Use the supplied representation for this position. Excess drawing-from-words tasks fail the level-specific G83 check.")
        for j, item in enumerate(q["items"], 1):
            if not isinstance(item, dict) or not isinstance(item.get("answer"), dict) or not isinstance(item.get("prompt"), str):
                continue
            answer, prompt = item["answer"], item["prompt"]
            prose = answer.get("text", "")
            if not isinstance(prose, str):
                prose = ""
            prefix = f"Item {j}: "
            request = multiple_coords.search(prompt.replace("[[", "").replace("]]", ""))
            if request and fig.get("kind") == "coordinate_plane":
                name = request[1]
                required = answer.get("kind") == "figure" and answer.get("operation") == "coordinate_pair" and answer.get("point") == name
                points = fig.get("points")
                point = next((v for v in points if isinstance(v, dict) and v.get("name") == name), None) if isinstance(points, list) else None
                # A complete authored answer may already state the actual pair.
                pair = re.fullmatch(rf"(?:{name}\s*)?\(\s*([-−]?\d{{1,3}})\s*,\s*([-−]?\d{{1,3}})\s*\)\.?", prose.strip().replace("[[","").replace("]]",""))
                stated = point and pair and tuple(int(v.replace("−","-")) for v in pair.groups()) == (point.get("x"), point.get("y"))
                if not (required or stated):
                    issues.append(prefix + f"Both coordinates of {name} are requested. Bind the answer to that point with figure operation coordinate_pair.")
            if answer.get("kind") == "review":
                for m in comparison.finditer(prose.replace("[[", "").replace("]]", "")):
                    a, b, symbol, c = m.groups()
                    if not comparators[symbol](int(a) + int(b), int(c)):
                        issues.append(prefix + "The asserted numerical comparison in the answer is false. Recheck the triangle inequality and the conclusion.")
                if (re.search(r"(?:מהו גודל הזווית|חשבו את (?:גודל )?הזווית)", prompt)
                        and fig.get("kind") == "coordinate_plane" and not re.search(r"[0-9]", prose)
                        and re.search(r"(?:טריגונומטריה|מספיק להראות|שווה לסכום)", prose)):
                    issues.append(prefix + "The prompt asks for an angle measure but the answer supplies no measure. Choose givens solvable with the allowed tools, or ask the qualitative question that the explanation answers.")
        if issues:
            findings.append({"question": index, "codes": ["TRIANGLE_SOURCE_MISMATCH"], "feedback": issues})
    return findings
