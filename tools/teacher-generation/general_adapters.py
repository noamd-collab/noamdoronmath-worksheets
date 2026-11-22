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
import json
from pathlib import Path
import sys

from general_source import GeneralSourceError, validate_source
from math_tasks import to_house_math, validate_and_solve_task
from general_geometry import solve_figure_task, measure_elementary_svg
from no_carry_addition import states_entire_task

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


def _elementary_math(ast, grade, H):
    kind = ast["type"]
    if kind == "number":
        return H.fmt(ast["numerator"], grade) if ast["denominator"] == 1 else H.frac(ast["numerator"], ast["denominator"], grade)
    if kind == "symbol":
        raise GeneralSourceError("ELEMENTARY_SYMBOL", "The elementary adapter has no approved symbolic-variable typography")
    op, args = ast["op"], ast["args"]
    if op == "sqrt":
        raise GeneralSourceError("ELEMENTARY_SQRT", "Roots are outside elementary signs")
    if op == "power":
        if grade in ("א", "ב", "ג"):
            raise GeneralSourceError("ELEMENTARY_POWER", "Power typography starts in grade four")
        return "(" + _elementary_math(args[0], grade, H) + ")<sup>" + _elementary_math(args[1], grade, H) + "</sup>"
    operator = {"add": "+", "subtract": "-", "multiply": "*", "divide": ":"}[op]
    values = []
    for arg in args:
        value = _elementary_math(arg, grade, H)
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


def rich_text(spans, grade, H=None):
    result = []
    for span in spans:
        if span["kind"] == "text":
            result.append(html.escape(span["text"]) if H else span["text"])
        elif span["kind"] == "math":
            result.append(H.ltr(_elementary_math(span["expression"], grade, H)) if H else "$" + to_house_math(span["expression"]) + "$")
        elif span["kind"] == "geometry":
            result.append("$" + _notation(span) + "$")
    return "".join(result)


def _task_text(solved, grade, H=None):
    """Question math is always rendered from the same AST as its answer."""
    task = solved["question"]
    render = (lambda ast: _elementary_math(ast, grade, H)) if H else to_house_math
    wrap = H.ltr if H else lambda s: "$" + s + "$"
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


def _answer_text(solved, unit, grade, H=None):
    render = (lambda ast: _elementary_math(ast, grade, H)) if H else to_house_math
    wrap = H.ltr if H else lambda s: "$" + s + "$"
    result = solved["result"]
    if result["type"] == "expression":
        answer = wrap(render(result["value"]))
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
            domain.append(wrap(render(condition["expression"]) + (" שונה מאפס" if H else " \\neq 0")))
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


def compile_source(lesson, validated, scope, skill_path, work):
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
    _load_skill(skill, elementary)
    (work / "figures").mkdir(exist_ok=True)
    if elementary:
        _compile_elementary(lesson, source, evidence, scope, skill, work)
    else:
        _compile_middle(lesson, source, evidence, scope, skill, work)
    return {"skill": scope["topic"]["skillId"], "work": str(work), "sourcePath": str(work / "worksheet-source.json"), "evidencePath": str(work / "general-evidence.json"), "unverifiedAnswerCount": len(evidence["unverifiedAnswers"]), "reviewRequired": True}


def _compile_elementary(lesson, source, evidence, scope, skill, work):
    import ws_html as H
    from content_truth import Ledger
    grade = LETTERS[lesson["gradeNumber"] - 1]
    ab = lesson["gradeNumber"] <= 2
    solved = {row["itemId"]: row["computed"] for row in evidence["computations"]}
    ledger = Ledger(str(work / "verified.json"))
    qs, canon, n = [], [], 0
    for section in source["sections"]:
        for question in section["questions"]:
            n += 1; pieces, items, answers, source_items = [], [], [], []
            intro = rich_text(question["intro"], grade, H)
            if question is section["questions"][0]:
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
                task_text = "" if states_entire_task(lesson, n-1, j-1, item) else _task_text(computed, grade, H)
                answer = _answer_text(computed, item["answer"]["unit"], grade, H)
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
            canon.append({"id": f"q{n}", "n": n, "section": section["title"], "conceptIds": section["conceptIds"], "intro": question["intro"], "table": question.get("table"), "figure": question.get("figure"), "items": source_items})
    ledger.save()
    meta = {"band": "elementary-ab" if ab else "elementary", "grade": grade, "level": {"a":"א", "b":"ב", "e":"מצוינות"}[lesson["level"]], "topic": source["title"], "topic_id": scope["topic"]["sourceTopicId"], "domain": scope["topic"]["domain"]}
    dump(work / "content.json", {"meta": meta, "questions": [q[0] for q in qs]})
    dump(work / "worksheet-source.json", {"version": 4, "meta": dict(meta, gradeNumber=lesson["gradeNumber"], levelCode={"a":"A", "b":"B", "e":"E"}[lesson["level"]], topicId=lesson["topicId"]), "questions": canon, "reviewRequired": True})
    template = (skill / "assets/worksheet_template_elementary.html").read_text(encoding="utf-8")
    head = template.split("<body", 1)[0]
    head = head.replace('</head>', '<style>.answers span.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:nowrap}.work-table{border-collapse:collapse;width:100%;margin:8px 0}.work-table td,.work-table th{border:1px solid #9cb5c8;padding:6px;text-align:center}.section-title{font-size:18px;color:#286ca1}</style></head>', 1)
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
    for section in source["sections"]:
        first = n + 1
        for question in section["questions"]:
            n += 1; items, answer_items, source_items = [], [], []
            intro = rich_text(question["intro"], lesson["gradeNumber"])
            q = {"n": n, "intro": intro, "star": question["star"], "items": items, "to_prove": []}
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
                body = prompt+(" "+_task_text(computed, lesson["gradeNumber"]) if computed else "")
                answer = _answer_text(computed, item["answer"]["unit"], lesson["gradeNumber"]) if computed else rich_text(item["answer"]["text"], lesson["gradeNumber"])
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
                source_items.append({"id": item_id, "label": LETTERS[j-1], "text": body, "answer": answer, "task": computed["question"] if computed else None, "verification": "typed task only" if computed else "unverified prose/proof; owner review required"})
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
    dump(work / "verified.json", {"version":1, "scope":"typed tasks only", "computations":evidence["computations"], "proseReviewRequired":True})
    # Constant bridge: no provider-controlled source is interpolated as Python.
    (work / "content.py").write_text(MIDDLE_BRIDGE+'PACKAGE = "G'+str(lesson["gradeNumber"])+'-T90"\n', encoding="utf-8")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--skill", required=True); ap.add_argument("--work", required=True)
    args = ap.parse_args(); wd = Path(args.work)
    load = lambda name: json.loads((wd / name).read_text(encoding="utf-8"))
    lesson, payload, scope = load("lesson.json"), load("model-output.json"), load("curriculum-scope.json")
    import division_facts
    from triangle_lesson import VERSION, compile_triangle
    if payload.get("version") == division_facts.VERSION:
        result = division_facts.compile_source(lesson, payload, args.skill, wd)
    elif payload.get("version") == VERSION:
        result = compile_triangle(lesson, payload, scope, args.skill, wd)
    else:
        result = compile_source(lesson, validate_source(lesson, payload, scope), scope, args.skill, wd)
    print(json.dumps(result, ensure_ascii=False))
