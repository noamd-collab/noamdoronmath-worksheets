"""Compile validated data-only drafts to the two unchanged pinned skill inputs.

The generated content.py is constant trusted glue. Model strings are stored
only in JSON and escaped by the elementary adapter or the middle skill's seg.
This compiler does not run builds, skip gates, approve prose, or publish files.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import html
import re
import json
from pathlib import Path
import sys

from general_source import GeneralSourceError, validate_source
from math_tasks import to_house_math, validate_and_solve_task
from general_geometry import solve_figure_task, measure_elementary_svg
from no_carry_addition import states_entire_task
from printed_percentages import percentage_evidence
from printed_tasks import match_printed_task, matching_solution_choices, printed_solve, printed_table_row
from printed_elementary import guard_counting_input, place_answer, place_intro, printed_intent, validate_counting_values

LETTERS = "אבגדהוזחטי"
LEVELS = {"a": "רמה א׳", "b": "רמה ב׳", "e": "מצוינות"}
MIDDLE_BRIDGE = '''import json
from pathlib import Path
LEVELS = json.loads((Path(__file__).parent / "levels.json").read_text(encoding="utf-8"))
def _recorded_figure(spec):
    if spec["kind"] == "coordinate_plane":
        from figkit_plus import plane, wide
        points = {p["name"]: (p["x"], p["y"]) for p in spec["points"]}
        builder = wide if spec.get("placement") == "wide" else plane
        return builder(tuple(spec["xr"]), tuple(spec["yr"]), points=[(xy, name) for name, xy in points.items()], solid=[(points[a], points[b]) for a, b in spec["segments"]])
    import shapekit as SK
    params = dict(spec["parameters"])
    if spec["shape"] == "triangle": params["variant"] = "sss"
    elif spec["shape"] == "trapezoid": params["variant"] = "scalene"
    family = "general." + spec["shape"]
    g, data = SK.shape(spec["shape"], rotate=spec["rotate"], names=spec["names"], marks=True, fam=family, **params)
    return SK.finish(g, family)
for level in LEVELS:
    if "words_share" in level:
        level["words_share"] = {int(k): v for k, v in level["words_share"].items()}
    for question in level["questions"]:
        if "_generalFigure" in question:
            svg = _recorded_figure(question.pop("_generalFigure"))
            if svg != question["fig"]:
                raise ValueError("Recorded figure differs from the compiled canonical figure")
            question["fig"] = svg
STRICT_FIGURES = True
'''


def dump(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _load_skill(skill, elementary):
    # These paths are trusted configuration, verified against skill-lock by the
    # caller before the isolated compiler process is started.
    paths = [skill / "scripts", skill / "scripts/lib"] if elementary else [skill]
    sys.path[:0] = [str(p) for p in paths]


def _elementary_math(ast, grade, H, *, blank=False, number_spellings=None):
    kind = ast["type"]
    if kind == "number":
        if number_spellings:
            from numeric_literals import printed_number
            spelling = printed_number(ast, number_spellings)
            if spelling is not None:
                return html.escape(spelling.replace("-", "−"))
        return H.fmt(ast["numerator"], grade) if ast["denominator"] == 1 else H.frac(ast["numerator"], ast["denominator"], grade)
    if kind == "symbol":
        if blank and ast["name"] == "x":
            return "___"
        raise GeneralSourceError("ELEMENTARY_SYMBOL", "The elementary adapter has no approved symbolic-variable typography")
    op, args = ast["op"], ast["args"]
    if op == "sqrt":
        raise GeneralSourceError("ELEMENTARY_SQRT", "Roots are outside elementary signs")
    if op == "power":
        if grade in ("א", "ב", "ג"):
            raise GeneralSourceError("ELEMENTARY_POWER", "Power typography starts in grade four")
        return "(" + _elementary_math(args[0], grade, H, blank=blank, number_spellings=number_spellings) + ")<sup>" + _elementary_math(args[1], grade, H, blank=blank, number_spellings=number_spellings) + "</sup>"
    operator = {"add": "+", "subtract": "-", "multiply": "*", "divide": ":"}[op]
    values = []
    for arg in args:
        value = _elementary_math(arg, grade, H, blank=blank, number_spellings=number_spellings)
        if arg["type"] == "operation":
            value = "(" + value + ")"
        values.append(value)
    return (" " + H.op(operator, grade) + " ").join(values)


def _notation(span):
    names = span["names"]
    if span["type"] == "angle":
        return "\\angle{" + names + "}"
    if span["type"] == "triangle":
        return "\\tri " + names
    return names


# Both pinned middle emitters support these macros in native math islands.
# Unicode relation glyphs can instead select an unshipped fallback font.
_MIDDLE_RELATIONS = str.maketrans({"≤": r"\leq", "≥": r"\geq", "≠": r"\neq"})


def _middle_math(text):
    return "$" + text.translate(_MIDDLE_RELATIONS) + "$"


def _formula(notation, grade, H):
    from compact_authoring import display_parts, schoolbook_tokens
    number_grade = LETTERS.index(grade) + 1 if H else grade
    tokens = schoolbook_tokens(notation, number_grade) if H else None
    if tokens is not None:
        # Reconstruct the exact checked operands and brackets. Adding brackets
        # around a product in a sum would reveal which operation comes first.
        rendered = []
        previous = None
        for token in tokens:
            if token in ("(", ")", "___"):
                rendered.append(token)
            elif token in ("=", "<", ">", "≤", "≥", "≠"):
                rendered.append(" " + html.escape(token) + " ")
            elif token in ("+", "-", "*", "/"):
                sign = H.op(":" if token == "/" else token, grade)
                unary = token == "-" and previous in (None, "(", "+", "-", "*", "/")
                rendered.append(sign if unary else " " + sign + " ")
            elif token.isascii() and token.isdigit() and str(int(token)) == token:
                rendered.append(H.fmt(int(token), grade))
            else:
                rendered.append(html.escape(token))
            previous = token
        return H.ltr("".join(rendered))
    rendered = []
    for part in display_parts(notation, number_grade):
        if isinstance(part,str):
            rendered.append(html.escape(part.replace("-", "−")) if H else part.replace("-", "−"))
            continue
        tree, aliases, spellings = part
        if H:
            rendered.append(_elementary_math(tree,grade,H,blank=bool(aliases),number_spellings=spellings))
        else:
            text = to_house_math(tree,number_spellings=spellings)
            rendered.append(re.sub(r"(?<![A-Za-z\\])[xyab](?![A-Za-z])",
                                   lambda match: aliases.get(match[0],match[0]),text))
    text = " ".join(rendered)
    return H.ltr(text) if H else _middle_math(text)


def rich_text(spans, grade, H=None):
    result = []
    for span in spans:
        if span["kind"] == "text":
            result.append(html.escape(span["text"]) if H else span["text"])
        elif span["kind"] == "math":
            result.append(H.ltr(_elementary_math(span["expression"], grade, H)) if H else _middle_math(to_house_math(span["expression"])))
        elif span["kind"] == "formula":
            result.append(_formula(span["notation"],grade,H))
        elif span["kind"] == "geometry":
            result.append(_middle_math(_notation(span)))
    return "".join(result)


def _prints_calculation(item, computed, number_grade=None):
    # The same exercise can arrive both in a pupil math span and its exact
    # task. Preserve the printed span and retain the independent solution.
    if not computed or computed["question"]["kind"] != "evaluate":
        return False
    mathematics = [span for span in item["prompt"] if span["kind"] != "text"]
    if number_grade and mathematics and mathematics[-1]["kind"] == "formula":
        from compact_authoring import expression, has_written_number, schoolbook_tokens
        notation = mathematics[-1]["notation"]
        if (has_written_number(notation) or schoolbook_tokens(notation, number_grade) is not None) and not re.search(r"[<>=!≤≥≠]", notation):
            # Coordinates and named-geometry labels are display only.
            from compact_authoring import COORDINATE
            if not COORDINATE.fullmatch(notation) and not re.search(r"[A-Z]|___", notation):
                try:
                    return expression(notation, number_grade) == computed["question"]["expression"]
                except GeneralSourceError:
                    return False
    return mathematics == [{"kind": "math", "expression": computed["question"]["expression"]}]


def _task_text(solved, grade, H=None, *, notation=None):
    """Question math is always rendered from the same AST as its answer."""
    task = solved["question"]
    if notation is not None:
        return _formula(notation, grade, H)
    render = (lambda ast: _elementary_math(ast, grade, H)) if H else to_house_math
    wrap = H.ltr if H else _middle_math
    kind = task["kind"]
    if kind == "figure_measure":
        figure=task["figure"]
        # Read-off tasks must not print the requested coordinate.
        # Shape measurements, however, need visible dimensions: the pinned
        # shapekit marks types but does not label constructor measurements.
        # Bind these givens directly to the same typed constructor values.
        if figure["kind"]=="shape" and task["operation"]!="side_count":
            params=figure["parameters"];shape=figure["shape"]
            n=lambda key:wrap(render({"type":"number","numerator":params[key],"denominator":1}))
            if shape=="rectangle":return "נתון: אורכי שתי צלעות סמוכות במלבן הם "+n("w")+" ו־"+n("h")+"."
            if shape=="square":return "נתון: אורך צלע הריבוע הוא "+n("a")+"."
            if shape=="triangle":return "נתון: אורכי צלעות המשולש הם "+n("a")+", "+n("b")+", "+n("c")+"."
            if shape=="rhombus":return "נתון: אורכי אלכסוני המעוין הם "+n("d1")+" ו־"+n("d2")+"."
            if shape=="trapezoid":return "נתון: אורכי בסיסי הטרפז הם "+n("a")+" ו־"+n("b")+", והגובה בין הבסיסים הוא "+n("h")+"."
            if shape=="parallelogram":return "נתון: אורכי שתי צלעות סמוכות במקבילית הם "+n("a")+" ו־"+n("b")+"."
            if shape=="polygon":return "נתון: המצולע משוכלל, ובו "+n("n")+" צלעות. אורך כל צלע הוא "+n("a")+"."
            if shape=="circle":return "נתון: רדיוס המעגל הוא "+n("r")+"."
        if figure["kind"]=="coordinate_plane" and task["operation"] in ("x_coordinate","y_coordinate"):
            axis="x" if task["operation"]=="x_coordinate" else "y"
            return "קראו את שיעור ה־"+wrap(axis)+" של הנקודה "+wrap(task["point"])+"."
        return ""
    if kind in ("gcd","lcm"):
        label = "המחלק המשותף הגדול ביותר של " if kind == "gcd" else "הכפולה המשותפת הקטנה ביותר של "
        return label + wrap(render(task["left"])) + " ושל " + wrap(render(task["right"]))
    if kind == "solve":
        return wrap(render(task["lhs"]) + " = " + render(task["rhs"]))
    if kind == "compare":
        return wrap(render(task["left"]) + " ___ " + render(task["right"]))
    if kind == "solve_system":
        return "; ".join(wrap(render(eq["lhs"])+" = "+render(eq["rhs"])) for eq in task["equations"])
    if kind == "inequality":
        return wrap(render(task["lhs"])+" "+{"lt":"<","le":"≤","gt":">","ge":"≥"}[task["relation"]]+" "+render(task["rhs"]))
    if kind == "statistics":
        return ", ".join(wrap(render(value)) for value in task["values"])
    expression = wrap(render(task["expression"]))
    if kind == "substitute":
        values = ", ".join(wrap(name + " = " + render(ast)) for name, ast in task["values"].items())
        return expression + (" עבור " if not H else " עֲבוּר " if grade in "אב" else " עבור ") + values
    return expression


def _answer_text(solved, unit, grade, H=None, *, original_variable=None, notation=None):
    render = (lambda ast: _elementary_math(ast, grade, H)) if H else to_house_math
    wrap = H.ltr if H else _middle_math
    result = solved["result"]
    if result["type"] == "expression":
        from numeric_literals import decimal_result
        decimal = decimal_result(result["value"], notation)
        answer = wrap(decimal if decimal is not None else render(result["value"]))
    elif result["type"] == "comparison":
        relation={"less": "&lt;" if H else "<", "equal": "=", "greater": "&gt;" if H else ">"}[result["relation"]]
        answer=wrap(render(solved["question"]["left"])+" "+relation+" "+render(solved["question"]["right"]))
    elif result["type"] == "list":
        answer = ", ".join(wrap(render(value)) for value in result["values"]) or "אין שכיח"
    elif result["type"] == "system":
        answer = "אין פתרון בתחום ההצבה" if result["classification"] == "none" else "; ".join(", ".join(wrap(name+" = "+render(solution[name])) for name in result["variables"]) for solution in result["solutions"])
    elif result["type"] == "intervals":
        def interval(row):
            lo, hi, variable = row["lower"], row["upper"], result["variable"]
            if lo is None and hi is None:
                return "כל מספר ממשי"
            if lo is not None and hi is not None and lo == hi:
                return wrap(variable+" = "+render(lo))
            if lo is None:
                return wrap(variable+(" ≤ " if row["upperClosed"] else " < ")+render(hi))
            if hi is None:
                return wrap(variable+(" ≥ " if row["lowerClosed"] else " > ")+render(lo))
            return wrap(render(lo)+(" ≤ " if row["lowerClosed"] else " < ")+variable+(" ≤ " if row["upperClosed"] else " < ")+render(hi))
        answer = " או ".join(interval(row) for row in result["intervals"]) or "אין פתרון בתחום ההצבה"
    else:
        if result["classification"] == "finite":
            answer = ", ".join(wrap(result["variable"] + " = " + render(value)) for value in result["values"])
        elif result["classification"] == "none":
            answer = "אין פתרון בתחום ההצבה"
        else:
            answer = "כל מספר ממשי בתחום ההצבה"
    if unit:
        answer += " " + (html.escape(unit) if H else unit)
    conditions = solved["domain"]["conditions"]
    if conditions:
        domain = []
        for condition in conditions:
            # Elementary symbolic denominator restrictions are not supported.
            condition_math = render(condition["expression"])
            if original_variable:
                condition_math = re.sub(r"(?<![A-Za-z])x(?![A-Za-z])", original_variable, condition_math)
            domain.append(wrap(condition_math + (" שונה מאפס" if H else " \\neq 0")))
        answer += ". תחום ההצבה: " + ", ".join(domain)
    return answer


def _figure(fig, elementary, index, work):
    """Invoke only explicit trusted skill constructors with validated fields."""
    kind = fig["kind"]
    if elementary:
        import svg_elementary_ext as SX
        if kind == "grid_shape":
            svg = SX.area_grid_shape(fig["cells"])
        elif kind == "solid":
            svg = SX.polyhedron_3d(kind="triangular_prism" if fig["shape"] == "prism" else fig["shape"], dims=tuple(fig["dimensions"]))
        else:
            raise ValueError("Unsupported elementary geometry figure")
    elif kind=="coordinate_plane":
        from figkit_plus import plane, wide
        points={p["name"]:(p["x"],p["y"]) for p in fig["points"]}
        # Coordinate object identity is measured from actual point sets by
        # figkit.figure_family. A Euclidean fam tag would incorrectly collapse
        # distinct coordinate graphs into one declared shape (G76 contract).
        builder=wide if fig.get("placement")=="wide" else plane
        svg=builder(tuple(fig["xr"]),tuple(fig["yr"]),points=[(xy,name) for name,xy in points.items()],solid=[(points[a],points[b]) for a,b in fig["segments"]])
    else:
        import shapekit as SK
        params = dict(fig["parameters"])
        if fig["shape"] == "triangle":
            params["variant"] = "sss"
        elif fig["shape"] == "trapezoid":
            params["variant"] = "scalene"
        fam = "general." + fig["shape"]
        g, data = SK.shape(fig["shape"], rotate=fig["rotate"], names=fig["names"], marks=True, fam=fam, **params)
        svg = SK.finish(g, fam)
    path = work / "figures" / f"q{index}.svg"
    path.write_text(svg, encoding="utf-8")
    dump(path.with_suffix(".json"), {"version": 1, "constructorInput": fig, "sha256": hashlib.sha256(svg.encode("utf-8")).hexdigest()})
    return svg, path.relative_to(work).as_posix()


def compile_source(lesson, validated, scope, skill_path, work, *, printed_answers=None, printed_fractions=False):
    """Write skill build inputs. A caller must still run every applicable gate.

    ``validated`` is revalidated rather than trusting deserialized evidence.
    Elementary unsupported prose/proof answers require a real Ledger proof and
    are refused before build inputs. Middle-school prose remains explicitly
    unverified; all unchanged proof/didactic gates must still run.
    """
    checked = validate_source(lesson, validated["source"], scope)
    source, evidence = checked["source"], checked["evidence"]
    work = Path(work); skill = Path(skill_path)
    work.mkdir(parents=True, exist_ok=True)
    dump(work / "general-source.json", source)
    dump(work / "general-evidence.json", evidence)
    elementary = scope["topic"]["skillId"] == "elementary"
    if evidence["unverifiedAnswers"] and elementary:
        raise GeneralSourceError("UNVERIFIED_ANSWERS", "This draft contains prose or proof answers without an implemented exact verifier; no deliverable was compiled")
    if printed_fractions:
        from fraction_lesson import eligible
        if not elementary or not eligible(lesson):
            raise GeneralSourceError("FRACTION_SCOPE", "Printed fractions require the supported lesson scope")
    if printed_answers is not None and not elementary:
        raise GeneralSourceError("PRINTED_TASK_MISMATCH", "Counting evidence must belong to an elementary worksheet")
    _load_skill(skill, elementary)
    (work / "figures").mkdir(exist_ok=True)
    if elementary:
        _compile_elementary(lesson, source, evidence, scope, skill, work, printed_answers=printed_answers, printed_fractions=printed_fractions)
    else:
        _compile_middle(lesson, source, evidence, scope, skill, work)
    return {"skill": scope["topic"]["skillId"], "work": str(work), "sourcePath": str(work / "worksheet-source.json"), "evidencePath": str(work / "general-evidence.json"), "unverifiedAnswerCount": len(evidence["unverifiedAnswers"]), "reviewRequired": True}


def _compile_elementary(lesson, source, evidence, scope, skill, work, *, printed_answers=None, printed_fractions=False):
    import ws_html as H
    from content_truth import Ledger
    grade = LETTERS[lesson["gradeNumber"] - 1]
    ab = lesson["gradeNumber"] <= 2
    solved = {row["itemId"]: row["computed"] for row in evidence["computations"]}
    if printed_answers is not None:
        validate_counting_values(lesson, solved, printed_answers)
    ledger = Ledger(str(work / "verified.json"))
    qs, canon, n = [], [], 0
    for section in source["sections"]:
        for question in section["questions"]:
            n += 1; pieces, items, answers, source_items = [], [], [], []
            revised_intro = place_intro(lesson, question)
            intro_spans = [{"kind":"text","text":revised_intro}] if revised_intro else question["intro"]
            intro = rich_text(intro_spans, grade, H)
            if question is section["questions"][0] and not ((printed_answers is not None or printed_fractions) and len(source["sections"]) == 1):
                pieces.append('<h3 class="section-title">' + html.escape(section["title"]) + '</h3>')
            if "table" in question:
                table = question["table"]
                pieces.append('<table class="work-table" dir="rtl"><thead><tr>' + ''.join('<th>'+rich_text(c, grade, H)+'</th>' for c in table["head"]) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+rich_text(c, grade, H)+'</td>' for c in row)+'</tr>' for row in table["rows"]) + '</tbody></table>')
            figpath = None
            if "figure" in question:
                svg, figpath = _figure(question["figure"], True, n, work)
                measurement=measure_elementary_svg(question["figure"],svg)
                if not measurement[0]:
                    raise GeneralSourceError("UNVERIFIED_FIGURE","The rendered elementary figure has no passing measured-SVG assertion")
                ledger.claim(str(n),"בדיקת הנתונים בשרטוט המודפס",measurement,method="figure_assert")
                pieces.append(H.fig(svg))
            for j, item in enumerate(question["items"], 1):
                item_id = f"q{n}-i{j}"; computed = solved[item_id]
                prompt = rich_text(item["prompt"], grade, H)
                complete = states_entire_task(lesson, n-1, j-1, item) or _prints_calculation(item,computed,lesson["gradeNumber"])
                task_text = "" if complete else _task_text(computed, grade, H, notation=item["answer"].get("notation"))
                answer = _answer_text(computed, item["answer"]["unit"], grade, H, notation=item["answer"].get("notation"))
                intent = (printed_intent(question, item, computed, lesson["gradeNumber"], location=f"q{n}.item.{j}")
                          or printed_table_row(question, item, computed))
                if intent:
                    task_text = ""
                    if intent["rule"] in ("write_expression", "write_division"):
                        entered = _elementary_math(intent["expression"], grade, H)
                        result = _elementary_math(intent.get("value", computed["result"]["value"]), grade, H)
                        answer = H.ltr(entered + " = " + result)
                    ledger.claim(f"{n}.{j}.intent", "הפעולות והנתונים אומתו מול השאלה המודפסת",
                                 intent, method="closed_form")
                bound = match_printed_task(item, computed, lesson["gradeNumber"])
                if bound:
                    task_text = ""
                    if bound.label:
                        answer = html.escape(bound.label) + " (" + answer + ")"
                    ledger.claim(f"{n}.{j}.visible", "התשובה אומתה מול הביטוי המודפס",
                                 bound.proof, method="closed_form")
                if printed_fractions:
                    from fraction_lesson import printed_evidence
                    proof = printed_evidence(question, j - 1, computed)
                    ledger.claim(f"{n}.{j}.printed", "תשובה שנבדקה מול השברים המודפסים", proof, method="closed_form")
                    task_text = ""
                guard_counting_input(lesson, question, item, computed)
                binding = place_answer(lesson, question, item, computed)
                if printed_answers is not None:
                    from counting_lesson import answer_from_prompt
                    counted = answer_from_prompt(intro_spans, item["prompt"])
                    if type(counted) is not int or counted != printed_answers[item_id]:
                        raise GeneralSourceError("PRINTED_TASK_MISMATCH", "The printed words and exact counting key disagree")
                    task_text = ""
                    ledger.claim(f"{n}.{j}.printed", "תשובה שנבדקה מול המילים המודפסות",
                                 {"countFromWords": counted, "evaluated": computed["result"]["value"]}, method="closed_form")
                if binding:
                    task_text = ""
                    answer = "".join(H.ltr(p[0]) if isinstance(p, tuple) else html.escape(p) for p in binding.parts)
                    ledger.claim(f"{n}.{j}.printed", "תשובת ערך המקום שהתקבלה מנתוני השאלה המודפסים",
                                 binding.proof, method="closed_form")
                # A fresh calculation, not a model-provided answer or boolean.
                figure_task=item["answer"]["kind"]=="figure"
                repeated = solve_figure_task(question["figure"],item["answer"]["operation"],item["answer"].get("point")) if figure_task else validate_and_solve_task(item["answer"]["task"])
                ledger.claim(f"{n}.{j}", "תוצאת המשימה המתמטית המודפסת בלבד", (repeated == computed, computed), method="closed_form" if figure_task else "sympy")
                body = prompt + " " + task_text + '<div class="ansline"></div>'
                pieces.append('<div class="sub">'+LETTERS[j-1]+'. '+body+'</div>')
                items.append(H.plain(body)); answers.append(answer)
                source_items.append({"id": item_id, "label": LETTERS[j-1], "text": H.plain(body), "answer": H.plain(answer), "task": computed["question"], "verificationId": f"{n}.{j}"})
            q = {"n": str(n), "intro": H.plain(intro), "items": items, "answer": H.plain(H.keyed(answers)), "star": question["star"]}
            if figpath:
                q["fig"] = figpath
            qs.append((q, intro, ''.join(pieces), H.keyed(answers)))
            canon.append({"id": f"q{n}", "n": n, "section": section["title"], "conceptIds": section["conceptIds"], "intro": intro_spans, "table": question.get("table"), "figure": question.get("figure"), "items": source_items})
    ledger.save()
    meta = {"band": "elementary-ab" if ab else "elementary", "grade": grade, "level": {"a":"א", "b":"ב", "e":"מצוינות"}[lesson["level"]], "topic": source["title"], "topic_id": scope["topic"]["sourceTopicId"], "domain": scope["topic"]["domain"]}
    dump(work / "content.json", {"meta": meta, "questions": [q[0] for q in qs]})
    dump(work / "worksheet-source.json", {"version": 4, "meta": dict(meta, gradeNumber=lesson["gradeNumber"], levelCode={"a":"A", "b":"B", "e":"E"}[lesson["level"]], topicId=lesson["topicId"]), "questions": canon, "reviewRequired": True})
    template = (skill / "assets/worksheet_template_elementary.html").read_text(encoding="utf-8")
    head = template.split("<body", 1)[0]
    # Keep long answer keys readable even when they continue across a page break.
    answer_layout = ("table.ans td{padding:8px}"
                     "table.ans tr:nth-last-child(-n+6):not(:last-child){break-after:avoid}")
    head = head.replace('</head>', '<style>'+answer_layout+'.answers span.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:nowrap}.work-table{border-collapse:collapse;width:100%;margin:8px 0}.work-table td,.work-table th{border:1px solid #9cb5c8;padding:6px;text-align:center}.section-title{font-size:18px;color:#286ca1}</style></head>', 1)
    body = ['<body class="'+('band-ab' if ab else 'band-gd' if lesson["gradeNumber"]<=4 else 'band-hv')+'">', '<div class="unit">'+html.escape(source["title"])+'</div><hr class="unit-rule">', '<div class="subtitle">'+LEVELS[lesson["level"]]+' · כיתה '+grade+'׳</div>', '<div class="details"><span>שם: ____________________</span><span>כיתה: ________</span><span>תאריך: __________</span></div>', '<p>'+rich_text(source["rule"], grade, H)+'</p>', '<ol class="questions">']
    for q, intro, rendered, answer in qs:
        body.append('<li'+(' class="starred"' if q["star"] else '')+'>'+('<span class="star"></span> ' if q["star"] else '')+intro+rendered+'</li>')
    body += ['</ol><div class="goodluck">'+('בְּהַצְלָחָה!' if ab else 'בהצלחה!')+'</div>', '<div class="answers"><h2>'+('תְּשׁוּבוֹת סוֹפִיּוֹת' if ab else 'תשובות סופיות')+'</h2><table class="ans">']
    for q, intro, rendered, answer in qs:
        body.append('<tr><td class="qn">'+H.ltr(q["n"]+'.')+'</td><td>'+answer+'</td></tr>')
    body.append('</table></div></body></html>')
    (work / "sheet.html").write_text(head+'\n'.join(body), encoding="utf-8")


def _compile_middle(lesson, source, evidence, scope, skill, work):
    solved = {row["itemId"]: row["computed"] for row in evidence["computations"]}
    qs, answers, canon, n = [], [], [], 0
    words_share={}
    printed_checks = {}
    for section in source["sections"]:
        first = n + 1
        for question in section["questions"]:
            n += 1; items, answer_items, source_items = [], [], []
            intro = rich_text(question["intro"], lesson["gradeNumber"])
            q = {"n": n, "intro": intro, "star": question["star"], "items": items, "to_prove": []}
            solutions = [solved.get(f"q{n}-i{j}") for j in range(1, len(question["items"]) + 1)]
            bank = matching_solution_choices(question, solutions, lesson["gradeNumber"])
            if bank:
                options, reused = bank
                q["given"] = [rich_text([option], lesson["gradeNumber"]) for option in options]
                if reused:
                    intro += " אפשר לבחור אותו פתרון ליותר ממשוואה אחת."
                    q["intro"] = intro
            if question.get("drawingFromWords"):
                words_share[n]="משימת סרטוט על סמך נתונים מילוליים; מקום הסרטוט נשמר ריק"
            if n == first:
                q["part"] = [section["title"], str(first)+"–"+str(first+len(section["questions"])-1)]
            if "figure" in question:
                q["fig"], path = _figure(question["figure"], False, n, work)
                q["_generalFigure"] = question["figure"]
            if "table" in question:
                table = question["table"]
                q["table"] = {"head": [rich_text(c, lesson["gradeNumber"]) for c in table["head"]], "rows": [[rich_text(c, lesson["gradeNumber"]) for c in row] for row in table["rows"]], "hcol": True}
            for j, item in enumerate(question["items"], 1):
                item_id = f"q{n}-i{j}"; computed = solved.get(item_id)
                prompt = rich_text(item["prompt"], lesson["gradeNumber"])
                printed = (percentage_evidence(lesson, question["intro"], item, computed)
                           or printed_table_row(question, item, computed))
                bound = match_printed_task(item, computed, lesson["gradeNumber"])
                label = printed_solve(item["prompt"], computed["question"], lesson["gradeNumber"]) if computed else None
                if isinstance(label, str) and label != computed["question"]["variable"]:
                    # Use the original, verified variable in the answer, its conditions and the skill targets.
                    computed = deepcopy(computed)
                    computed["result"]["variable"] = label
                    computed["domain"]["variables"] = [label]
                if isinstance(label, str):
                    printed = {"rule": "printed_equation", "variable": label}
                if bound:
                    printed = bound.proof
                if printed:
                    printed_checks[item_id] = printed
                show_task = computed and not printed and not _prints_calculation(item, computed, lesson["gradeNumber"])
                body = prompt+(" "+_task_text(computed, lesson["gradeNumber"], notation=item["answer"].get("notation")) if show_task else "")
                answer = _answer_text(computed, item["answer"]["unit"], lesson["gradeNumber"], original_variable=label, notation=item["answer"].get("notation")) if computed else rich_text(item["answer"]["text"], lesson["gradeNumber"])
                if bound and bound.label:
                    answer = bound.label + " (" + answer + ")"
                space=280 if question.get("drawingFromWords") and j==len(question["items"]) else 46 if question["star"] else 32
                row = {"label": LETTERS[j-1], "text": body, "space": space, "answer": answer, "given": [body], "to_prove": []}
                result = computed["result"] if computed else {}
                if result.get("classification") == "finite" and result.get("variable"):
                    row["variables"] = computed["domain"]["variables"]
                    row["to_prove"] = [{"type":"find", "quantity":"variable", "of":result["variable"], "value":answer}]
                elif computed:
                    # A typed numeric/algebraic task has an exact private
                    # result, even when that result is a list or interval.
                    row["variables"] = computed["domain"]["variables"]
                    row["to_prove"] = [{"type":"find", "quantity":"value", "what":"תוצאת המשימה המתמטית בסעיף", "value":answer}]
                else:
                    # The pinned didactic gate must retain REVIEW, not a forged
                    # relation or an empty target presented as verified.
                    row["no_target_reason"] = "תוצאה של משימה מתמטית מוקלדת; נדרש לבדוק התאמה בין הניסוח, המשימה וההקשר"
                items.append(row); answer_items.append([LETTERS[j-1], answer])
                source_items.append({"id": item_id, "label": LETTERS[j-1], "text": body, "answer": answer, "task": computed["question"] if computed else None, "verification": "typed answer and verified printed givens" if printed else "typed task only" if computed else "unverified prose/proof; owner review required"})
            qs.append(q); answers.append([n, answer_items, question["star"]])
            canon.append({"id":f"q{n}", "n":n, "intro":intro, "section":section["title"], "conceptIds":section["conceptIds"], "items":source_items, "table":question.get("table"), "figure":question.get("figure")})
    from general_source import geometry_topic
    figure_topic = True if geometry_topic(scope) else [False, "הנושא אינו גיאומטריה; הוראת נועם אוסרת שרטוטים בנושא זה"]
    level = {"level": LEVELS[lesson["level"]], "key": {"a":"a", "b":"b", "e":"c"}[lesson["level"]], "grade": str(lesson["gradeNumber"]), "keep_questions": True, "figure_topic": figure_topic, "title": source["title"], "rule": rich_text(source["rule"], lesson["gradeNumber"]), "questions": qs, "answers": answers, "curriculum": {"topic":scope["topic"]["sourceTopicId"], "track":scope["topic"]["sourceTrack"]}}
    if words_share:
        # JSON object keys are strings; trusted bridge restores integer ids
        # expected by the pinned skill. Model text is never Python source.
        level["words_share"]={str(k):v for k,v in words_share.items()}
    dump(work / "levels.json", [level])
    dump(work / "worksheet-source.json", {"version":4, "meta":{"gradeNumber":lesson["gradeNumber"], "levelCode":lesson["level"], "topicId":lesson["topicId"]}, "questions":canon, "reviewRequired":True})
    verification = {"version":1, "scope":"typed tasks only", "computations":evidence["computations"], "proseReviewRequired":True}
    if printed_checks:
        verification.update(scope="typed tasks and checked printed givens", printedChecks=printed_checks)
    dump(work / "verified.json", verification)
    # Constant bridge: no provider-controlled source is interpolated as Python.
    (work / "content.py").write_text(MIDDLE_BRIDGE+'PACKAGE = "G'+str(lesson["gradeNumber"])+'-T90"\n', encoding="utf-8")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--skill", required=True); ap.add_argument("--work", required=True)
    args = ap.parse_args(); wd = Path(args.work)
    load = lambda name: json.loads((wd / name).read_text(encoding="utf-8"))
    lesson, payload, scope = load("lesson.json"), load("model-output.json"), load("curriculum-scope.json")
    import division_facts
    import square_lesson
    import pythagoras_lesson
    import fraction_lesson
    import counting_lesson
    from triangle_lesson import VERSION, compile_triangle
    if payload.get("version") == fraction_lesson.VERSION:
        result = fraction_lesson.compile_fractions(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") == counting_lesson.VERSION:
        result = counting_lesson.compile_counting(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") == division_facts.VERSION:
        result = division_facts.compile_source(lesson, payload, args.skill, wd)
    elif payload.get("version") == pythagoras_lesson.VERSION:
        result = pythagoras_lesson.compile_pythagoras(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") in (square_lesson.VERSION, square_lesson.INTRO_VERSION):
        result = square_lesson.compile_square(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") == VERSION:
        result = compile_triangle(lesson, payload, scope, args.skill, wd)
    else:
        result = compile_source(lesson, validate_source(lesson, payload, scope), scope, args.skill, wd)
    print(json.dumps(result, ensure_ascii=False))
