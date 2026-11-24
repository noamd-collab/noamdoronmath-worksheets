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
    sizes = ([(b+c, spec["base"]), (apex+b, spec["left"]), (apex+c, spec["right"])]
             if spec["kind"] == "triangle_part" else [])
    if "printedSides" in spec:
        sizes = [v for k,v in zip(("base","left","right"),sizes) if k in spec["printedSides"]]
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
    if sizes:
        return ", ".join(clauses[:len(sizes)]) + ". " + " ".join(clauses[len(sizes):]), claims
    # The angle-design question states its construction in its own givens.
    return "", claims


def render(spec):
    import shapekit as sk
    if spec["kind"] == "triangle_angle_part":
        apex, b, c, d = spec["names"]
        left, right = spec["angles"]
        family = "triangle.angles." + ("isosceles" if left == right else "scalene") + "." + spec["construction"]
        if left == right:
            from math import cos, radians
            if left == 60:
                variant, params = "equilateral", {"a":8}
            else:
                variant, params = "iso", {"leg":4/cos(radians(left)), "base":8}
        else:
            variant, params = "asa", {"A":left, "B":right, "c":8}
        g, data = sk.shape("triangle", variant=variant, names=b+c+apex,
                           rotate=spec["rotate"], marks=False, fam=family, **params)
        draw_construction(sk, g, data, spec["construction"], apex, b, c, d)
        return sk.finish(g, family)
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
    draw_construction(sk, g, data, kind, apex, b, c, d)
    return sk.finish(g, family)


def draw_construction(sk, g, data, kind, apex, b, c, d):
    if kind == "side_extension":
        end = sk.extend(g, data, b, c)
        sk.point(g, data, d, g.pts[end])
    else:
        build = {"median": sk.median, "angle_bisector": sk.bisector, "altitude": sk.altitude}[kind]
        build(g, data, apex, b, c, name=d, dash=None)



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
        intro = q.get("intro", "")
        if isinstance(intro, str) and fig.get("kind") in ("triangle_part","shape") and re.search(r"שני (?:ה)?משולשים|בשני (?:ה)?משולשים", intro):
            named = set(re.findall(r"(?:משולש|משולשים)\s*(?:\$|\[\[(?:polygon:)?|△)?([A-Z]{3})", intro))
            if any(not set(name) <= set(fig.get("names","")) for name in named):
                issues.append("Only one triangle is drawn. Use the triangle and point names in the supplied figure, or state a second case in words without claiming it is drawn.")
        for j, item in enumerate(q["items"], 1):
            if not isinstance(item, dict) or not isinstance(item.get("answer"), dict) or not isinstance(item.get("prompt"), str):
                continue
            answer, prompt = item["answer"], item["prompt"]
            prose = answer.get("text", "")
            if not isinstance(prose, str):
                prose = ""
            prefix = f"Item {j}: "
            authored = " ".join([prompt,prose,str(answer.get("task",{}))])
            if re.search(r"\b(?:atan2?|asin|acos|arctan|arcsin|arccos|tan|sin|cos|pi)\b|טריגונומטר|רדיאני", authored, re.I):
                issues.append(prefix + "Use only the selected grade-eight triangle theorems. Choose givens that require no trigonometry or radians.")
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

# A broad revision lesson can use exact constructions instead of requiring the
# author to derive angles from arbitrary SSS data. The author selects the
# mathematical investigation, the parameters and the presentation of each one.
DESIGNS = {
    0: ("split_base", "reverse_median", "broken_path"),
    2: ("equal_legs", "apex_from_base", "base_from_apex"),
    3: ("broken_path", "equal_legs", "split_base"),
    4: ("converse_angles", "converse_segments", "refute_median"),
    5: ("exterior_forward", "exterior_reverse", "exterior_error"),
    6: ("apex_from_base", "base_from_apex", "converse_angles"),
    7: ("base_from_apex", "apex_from_base", "exterior_iso"),
    8: ("coincidence", "converse_segments", "apex_split"),
    9: ("converse_segments", "coincidence", "refute_median"),
    10: ("apex_split", "subtriangle", "coincidence"),
    11: ("triangle_range", "triangle_boundary"),
}
DESIGNS[1] = DESIGNS[5]
DESIGNS[12] = DESIGNS[11]
GRID_DESIGNS = {
    0: ("grid_midpoint", "grid_disprove"),
    2: ("grid_symmetry", "grid_reflection"),
    3: ("grid_midpoint", "grid_reflection"),
    4: ("grid_converse", "grid_disprove"),
    5: ("grid_exterior", "grid_exterior_reverse"),
    6: ("grid_reflection", "grid_symmetry"),
    7: ("grid_symmetry", "grid_exterior_reverse"),
    8: ("grid_altitude", "grid_converse"),
    9: ("grid_converse", "grid_altitude"),
    10: ("grid_bisector", "grid_altitude"),
    11: ("grid_midpoint", "grid_disprove"),
}
GRID_DESIGNS[1] = GRID_DESIGNS[5]
GRID_DESIGNS[12] = GRID_DESIGNS[11]
LABEL_SETS = ("ABCD", "MNPK", "RSTH", "KLMN", "PQRS", "EFGH")


def design_choices(lesson, scope, plan):
    if scope["topic"]["topicId"] != TOPIC or lesson.get("lessonGoal") != "practice":
        return None
    ids = {int(c["id"].split("#")[-1]) for c in scope["selectedConcepts"]}
    # These interdisciplinary situations rely on all five strands being in
    # scope. A narrower selection stays on the original curriculum-bound path.
    if not {0, 2, 3, 4, 6, 7, 8, 9, 10} <= ids or not ids.intersection((1, 5)):
        return None
    uses = {}
    choices = []
    for slot in plan:
        pool = GRID_DESIGNS if slot["representation"] == "coordinate_plane" else DESIGNS
        topics = [int(x.split("#")[-1]) for x in slot["conceptIds"]]
        options = list(dict.fromkeys(name for c in topics for name in pool[c]))
        if slot["group"] == "challenges":
            if pool is GRID_DESIGNS:
                options = ["grid_error_proof", "grid_exterior_proof"]
            elif 0 in topics:
                options = ["challenge_paths", "challenge_scale"]
            else:
                options = ["challenge_converse", "challenge_angle_error"]
        options.sort(key=lambda name: uses.get(name, 0))
        options = options[:2]
        for name in options:
            uses[name] = uses.get(name, 0) + 1
        choices.append(options)
    return choices


def design_schema(count):
    row = {"type":"object", "additionalProperties":False,
           "properties":{"design":{"type":"string"}, "size":{"type":"integer","minimum":2,"maximum":9},
                         "names":{"enum":list(LABEL_SETS)}, "rotation":{"enum":[-22,0,22]}},
           "required":["design","size","names","rotation"]}
    return {"type":"object","properties":{"mode":{"const":"triangle-design/1"},
            "questions":{"type":"array","items":row,"minItems":count,"maxItems":count}},
            "required":["mode","questions"],"additionalProperties":False}


def _label(kind, name):
    return "[[" + kind + ":" + name + "]]"


def _angle(name):
    return _label("angle", name)


def _degree(n):
    return "[[" + str(n) + "°]]"


def _item(prompt, answer):
    return {"prompt":prompt,"answer":{"kind":"review","text":answer}}


def _grid_question(design, size, labels, rotation):
    a,b,c,d = labels
    # No student needs an oblique distance formula. Reflection or horizontal
    # and vertical differences prove every equality asked on the grid.
    off = (size % 3) - 1
    foot = off + 1 if design in ("grid_midpoint", "grid_disprove") else off
    width = 2 + size % 3
    height = width if design in ("grid_exterior","grid_exterior_reverse","grid_exterior_proof","grid_bisector") else 2 + (size+1)%4
    pts = {a:(foot,height), b:(off-width,0), c:(off+width,0), d:(off,0)}
    if design=="grid_disprove":
        pts[d]=(foot,0)
    compare = design=="grid_error_proof"
    if compare:
        end = next(n for n in "XZY" if n not in labels)
        pts.update({a:(off,width),d:(off,-width),end:(off+width+2,0)})
    exterior = design in ("grid_exterior","grid_exterior_reverse","grid_exterior_proof")
    if exterior:
        pts[d] = (off+width+2,0)
    # Quarter turns retain the integer lattice and all geometric relationships.
    turns = {-22:1,0:0,22:3}[rotation]
    for _ in range(turns):
        pts = {k:(-y,x) for k,(x,y) in pts.items()}
    segments = [[a,b],[b,c],[c,a],[c,d] if exterior else [a,d]]
    if compare:
        segments=[[a,b],[b,c],[c,a],[b,d],[d,c],[c,end]]
    fig = {"kind":"coordinate_plane","xr":[-7,7],"yr":[-7,7],"placement":"wide",
           "points":[{"name":k,"x":x,"y":y} for k,(x,y) in pts.items()],"segments":segments}
    A,B,C,D = [_label("point",k) for k in labels]
    AD,BC = _label("segment",a+d),_label("segment",b+c)
    if compare:
        E=_label("point",end)
        above,below=_angle(a+c+end),_angle(d+c+end)
        intro=f"שני משולשים משורטטים משני עברי הבסיס {BC}. הצלע המשותפת נמשכת מעבר ל־{C} עד {E}."
        rows=[(f"איזה קודקוד הוא תמונת הראי של {A} בהשתקפות בישר {BC}? הוכיחו בעזרת המשבצות.",f"{D}. שני הקודקודים נמצאים על אותו אנך לבסיס, במרחק {width} יחידות ממנו משני עבריו."),
              (f"אלכסון של משבצת יוצר זווית של {_degree(45)} עם צלעה. מצאו את הזוויות החיצוניות {above} ו־{below}.",f"כל זווית חיצונית היא {_degree(135)}. השוקיים עוברות לאורך אלכסוני משבצות ולכן זווית הבסיס בכל צד היא {_degree(45)}."),
              ("תלמיד טוען ששתי הזוויות החיצוניות משלימות לזווית שטוחה כי הן נמצאות משני צידי הבסיס. האם השתקפות מבטיחה זאת? נמקו.",f"לא. השתקפות משמרת את גודל הזווית ואינה מחליפה אותה בזווית משלימה. סכום שתי הזוויות כאן {_degree(270)}.")]
    elif exterior:
        ext = _angle(a+c+d)
        intro = f"הצלע {BC} נמשכת מעבר לקודקוד {C}. התבוננו ברשת ובשני הכיוונים היוצאים מהקודקוד {A}."
        if design == "grid_exterior_reverse":
            intro += f" ידוע שהזווית החיצונית {ext} היא {_degree(135)}."
            rows = [(f"מה גודל זווית הבסיס הצמודה ל־{ext}?", f"{_degree(45)}, כי הזוויות הצמודות משלימות לזווית שטוחה."),
                    ("מצאו את זווית הבסיס האחרת והסבירו באמצעות הסימטריה ברשת.", f"{_degree(45)}. השוקיים הן תמונות ראי, ולכן זוויות הבסיס שוות."),
                    (f"חשבו את זווית הראש ובדקו בעזרתה את {ext}.", f"{_degree(90)}. סכום זווית הראש וזווית הבסיס הרחוקה הוא {_degree(135)}.")]
        else:
            rows = [(f"הסבירו בעזרת המשבצות מדוע שתי השוקיים היוצאות מ־{A} שוות.", "בכל שוק יש אותו מספר משבצות לכל אחד משני הכיוונים המאונכים. שתי השוקיים הן תמונות ראי."),
                    (f"כל שוק מונחת לאורך אלכסונים של ריבועי הרשת. מה גודל זווית הבסיס ב־{C}?", f"{_degree(45)}. אלכסון הריבוע חוצה זווית ישרה."),
                    (("תלמיד חיבר את שתי זוויות הבסיס כדי למצוא את " if design=="grid_exterior_proof" else "חשבו את ") + ext + (" והגיע לזווית ישרה. הסבירו את טעותו ותקנו." if design=="grid_exterior_proof" else " ונמקו."),
                     f"{_degree(135)}. הזוויות הפנימיות הרחוקות הן זווית הראש בגודל {_degree(90)} וזווית הבסיס בגודל {_degree(45)}.")]
    else:
        BD,DC = _label("segment",b+d),_label("segment",d+c)
        intro = f"הנקודה {D} נמצאת על {BC}. השתמשו במשבצות המסומנות ברשת כדי לבדוק את תכונות הקטע {AD}."
        if design in ("grid_midpoint","grid_disprove"):
            centered=design=="grid_midpoint"
            rows = [(f"מצאו את אורכי {BD} ו־{DC} ביחידות הרשת.", f"שני הקטעים באורך {width} יחידות." if centered else f"הקטע {BD} באורך {width+1} והקטע {DC} באורך {width-1} יחידות."),
                    (f"האם {AD} הוא תיכון? נמקו לפי ההגדרה.", f"כן. הוא מחבר את {A} לאמצע {BC}." if centered else "לא. שני חלקי הבסיס שונים באורכם."),
                    (f"האם {AD} הוא גם גובה? הסבירו לפי כיווני הקטעים בשרטוט.", "לא. הקטע אלכסוני ביחס לקווי הרשת ואילו הבסיס על קו רשת." if centered else "כן. הקטע והבסיס נמצאים על קווי הרשת המאונכים זה לזה.")]
        elif design == "grid_converse":
            rows = [(f"הוכיחו שהקטע {AD} גם תיכון וגם גובה, בלי לחשב את אורכי הצלעות.", f"שני חצאי הבסיס באורך {width} יחידות, והקטע אל האמצע מאונך לבסיס לפי קווי הרשת."),
                    (f"איזה משפט הפוך מאפשר עתה להסיק שהצלעות היוצאות מ־{A} שוות?", "אם התיכון לצלע הוא גם גובה אליה, המשולש שווה שוקיים. אפשר גם לקפל לאורך האנך האמצעי והקצוות מתלכדים."),
                    (f"תלמיד טוען שדי היה להוכיח שרק {AD} הוא גובה. בדקו את הטענה.", "הטענה שגויה. בכל משולש יש גובה, והוא עשוי לפגוש את הבסיס מחוץ לאמצעו.")]
        elif design in ("grid_symmetry","grid_reflection"):
            rows = [(f"אם מקפלים את השרטוט לאורך {AD}, איזה קודקוד יגיע אל {B}? נמקו.", f"הקודקוד {C}, כי שתי נקודות הקצה מרוחקות {width} יחידות מן הקפל ועל אותו אנך לו."),
                    (f"איזו צלע מתלכדת עם {_label('segment',a+b)} בעקבות הקיפול?", f"הצלע {_label('segment',a+c)}. הקודקוד {A} נשאר במקומו."),
                    ("הסבירו אילו זוויות חייבות להיות שוות בעקבות אותו קיפול.", f"זוויות הבסיס ליד {B} וליד {C} מתלכדות. גם שני חלקי זווית הראש מתלכדים.")]
        else:
            rows = [(f"בנו נימוק מן הרשת לכך שהישר {AD} הוא ציר סימטריה.", f"קצות הבסיס נמצאים משני צדיו במרחק {width} יחידות ממנו על ישר אחד המאונך לקפל. הקודקוד {A} על הציר."),
                    (f"מה מסביר את השוויון בין {_angle(b+a+d)} ובין {_angle(d+a+c)}?", "בהשתקפות סביב הציר שתי קרני השוק מתחלפות והקרן אל אמצע הבסיס נשארת במקומה."),
                    (f"בלי למדוד זוויות, מה גודל {_angle(a+d+c)} ומדוע?", f"{_degree(90)}. ציר הסימטריה מאונך לבסיס.")]
    return {"intro":intro,"figure":fig,"items":[_item(p,k) for p,k in rows]}


def _euclidean_question(design, size, labels, rotation, sketch):
    a,b,c,d = labels
    A,B,C,D = [_label("point",k) for k in labels]
    AB,AC,BC,AD,BD,DC = [_label("segment",s) for s in (a+b,a+c,b+c,a+d,b+d,d+c)]
    tri = _label("polygon",a+b+c)
    half = size + 2
    base = 2*half
    leg = base+3
    other = leg if design in ("equal_legs","challenge_scale") else leg+2
    base_ang = (28, 32, 37, 48, 50, 60, 63, 65)[size-2]
    second = base_ang
    construction = "median"
    side_design = design in ("split_base","reverse_median","broken_path","equal_legs","triangle_range","triangle_boundary","challenge_paths","challenge_scale")
    if sketch:
        return _sketch_question(design,size)
    if side_design:
        fig = dict(kind="triangle_part",names=labels,base=base,left=leg,right=other,construction=construction,rotate=rotation)
        intro = f"התבוננו במשולש {tri} ובקטעים המסומנים בשרטוט."
        if design in ("equal_legs","challenge_paths"):
            fig["printedSides"]=["base"]
        if design == "split_base":
            rows = [(f"אילו שני קטעים שווים מעצם הגדרת התיכון?", f"{BD} ו־{DC} שווים כי הנקודה {D} היא אמצע הבסיס."),
                    (f"מצאו את אורך {BD}.", f"{half}. התיכון מחלק את הצלע לשני קטעים שווים."),
                    (f"הולכים מן הקודקוד {A} אל {D} דרך {B}. מה אורך הדרך?", f"{leg+half}, סכום אורך הצלע {AB} ואורך מחצית הבסיס.")]
        elif design == "reverse_median":
            rows = [(f"מצאו את אורך הדרך מ־{A} דרך {C} עד {D}.", f"{other+half}. מחברים את אורך הצלע ואת חצי הבסיס."),
                    (f"במשולש נוסף אורך הדרך באותו מסלול הוא {other+half+3} ואורך הצלע הראשונה הוא {other}. מה אורך מחצית הבסיס החדש?", f"{half+3}, כי מחסרים את אורך הצלע מאורך הדרך."),
                    ("שחזרו את אורך הבסיס החדש בשלמותו והסבירו.", f"{2*(half+3)}. נקודת הקצה של התיכון היא נקודת האמצע ולכן כופלים את מחצית הבסיס בשתיים.")]
        elif design=="challenge_paths":
            intro += f" סכום אורכי הצלעות {AB} ו־{AC} הוא {leg+other}. הולכים מ־{A} אל {D} לאורך צלעות המשולש. המסלול העובר דרך {C} ארוך בשתי יחידות מהמסלול העובר דרך {B}."
            rows = [(f"שחזרו את אורכי {AB} ו־{AC}. הסבירו מדוע ההפרש בין הדרכים שווה להפרש בין אורכי הצלעות האלה.", f"חצאי הבסיס שווים. מסכום {leg+other} ומהפרש של שתיים מקבלים {leg} ו־{other}."),
                    (f"מצאו את אורך כל אחת משתי הדרכים מ־{A} אל אמצע הבסיס דרך קצה הבסיס.", f"דרך {B} האורך {leg+half}, ודרך {C} האורך {other+half}."),
                    ("שני תלמידים מדדו את היקפי המשולשים הקטנים וקיבלו בדיוק אותו היקף. האם ייתכן ששניהם צדקו? נמקו.", "לא. כל היקף כולל אחת מהדרכים ואת אותו התיכון, לכן ההיקפים שונים בשתי יחידות.")]
        elif design=="broken_path":
            rows = [(f"השוו בין שתי הדרכים מ־{A} אל {D}, דרך {B} ודרך {C}. מה הפרש אורכיהן?", f"{other-leg}. חצאי הבסיס שווים, ולכן ההפרש בין אורכי הדרכים שווה להפרש בין אורכי הצלעות {AB} ו־{AC}."),
                    (f"בלי לדעת את אורך {AD}, מצאו את ההפרש בין היקפי שני המשולשים שנוצרו.", f"{other-leg}. לשני ההיקפים נוסף אותו קטע, התיכון."),
                    (f"בדוגמה אחרת שני ההיקפים שווים. איזה שוויון בין צלעות המשולש המקורי נובע מכך? הוכיחו.", f"{AB} ו־{AC} שוות. מחסרים משני ההיקפים את התיכון ואת חצאי הבסיס השווים.")]
        elif design in ("triangle_range","triangle_boundary"):
            rows = [(f"אילו גבולות פתוחים מתקבלים עבור אורך הצלע השלישית כשמשאירים את אורכי {AB} ו־{AC} בלבד?", f"גדול מן ההפרש {other-leg} וקטן מן הסכום {leg+other}."),
                    (f"הציעו את האורך השלם הגדול ביותר שעדיין מתאים לצלע השלישית.", f"{leg+other-1}. זהו השלם האחרון לפני סכום שתי הצלעות."),
                    (f"מה יקרה אם תחליפו את הבסיס בקטע שאורכו {leg+other}? נמקו.", "שלוש הנקודות יהיו על ישר אחד, כי סכום שתי צלעות שווה לשלישית. לא יתקבל משולש.")]
        elif design == "challenge_scale":
            rows = [(f"מצאו את היקף המשולש ואת ההפרש בין אורך השוק לאורך חצי הבסיס.", f"ההיקף {2*leg+base}, וההפרש {leg-half}."),
                    ("בדגם אחר הכפילו רק את אורך הבסיס והשאירו את שתי השוקיים. האם עדיין אפשר לבנות משולש? נמקו.", f"כן, הבסיס החדש {base*2} קצר מסכום השוקיים {2*leg}."),
                    ("האם ההיקף החדש כפול מהמקורי? מצאו את השינוי בהיקף.", f"לא. רק הבסיס גדל ולכן ההיקף גדל ב־{base}.")]
        else:
            rows = [(f"היקף המשולש הוא {2*leg+base} ושתי השוקיים שוות. חשבו את אורך כל שוק בעזרת אורך הבסיס.", f"אורך כל אחת משתי השוקיים הוא {leg}. מחסרים את הבסיס מההיקף ומחלקים בשתיים."),
                    (f"אם עוברים מ־{B} אל {C} דרך {A}, בכמה הדרך ארוכה מן הבסיס?", f"ב־{2*leg-base}, כי מחברים את שתי השוקיים ומחסרים את הבסיס."),
                    (f"במשולש אחר הבסיס קצר בשתי יחידות וכל אחת מהשוקיים קצרה ביחידה. בכמה שונה היקפו?", "היקף המשולש האחר קטן בארבע יחידות. מחברים את שלושת ההפרשים באורכי הצלעות.")]
    else:
        quarter = "apex_split" in design or design in ("subtriangle","challenge_angle_error")
        ext = design.startswith("exterior")
        if quarter or design == "refute_median" or (ext and design != "exterior_iso"):
            second = base_ang+9
        apex_ang = 180-base_ang-second
        # For bisectors choose an even apex without rounding a half-degree.
        if quarter:
            second = base_ang+8
            apex_ang = 180-base_ang-second
        if ext:
            construction="side_extension"
        elif design == "challenge_converse":
            construction="angle_bisector"
        elif quarter:
            construction="angle_bisector"
        elif design in ("converse_segments","coincidence"):
            construction="altitude"
        fig = dict(kind="triangle_angle_part",names=labels,angles=[base_ang,second],construction=construction,rotate=rotation)
        intro = f"נתון משולש {tri}. "
        if ext:
            intro += f"ממשיכים את {BC} מעבר ל־{C} עד לנקודה {D}. "
            outside=180-second
            if design == "exterior_iso":
                intro += f"השוקיים {AB} ו־{AC} שוות. הזווית החיצונית {_angle(a+c+d)} היא {_degree(outside)}."
                rows = [(f"מצאו את הזווית הפנימית הצמודה ליד {C}.", f"{_degree(second)}. הזוויות הצמודות משלימות לזווית שטוחה."),
                        (f"מצאו את זווית הראש בלי למדוד אותה בשרטוט.", f"זוויות הבסיס שוות. מחסרים מזווית שטוחה פעמיים {_degree(second)} ומקבלים {_degree(apex_ang)}."),
                        ("אם השוקיים אינן ידועות כשוות, איזו מן התשובות עדיין מתחייבת מאותו נתון חיצוני? הסבירו.", "רק הזווית הפנימית הצמודה נקבעת מיד. אין מידע הקובע כיצד מתחלק הסכום שנותר בין שתי הזוויות הרחוקות.")]
            elif design == "exterior_reverse" or design == "exterior_error":
                intro += f"הזווית החיצונית {_angle(a+c+d)} היא {_degree(outside)} וזווית הראש היא {_degree(apex_ang)}."
                rows = [(f"מצאו את הזווית הפנימית ליד {C}.", f"{_degree(second)}. שתי הזוויות צמודות על ישר."),
                        (f"שחזרו את הזווית ליד {B} בעזרת משפט הזווית החיצונית.", f"{_degree(base_ang)}. מחסרים מהזווית החיצונית את זווית הראש."),
                        ("תלמיד חיבר את הזווית החיצונית ואת זווית הראש כדי לשחזר את הזווית הרחוקה האחרת. מה טעותו?", "הזווית החיצונית כבר שווה לסכום שתי הזוויות הרחוקות. כדי למצוא אחת מהן מחסרים את האחרת.")]
            else:
                intro += f"זווית הראש היא {_degree(apex_ang)} והזווית ליד {B} היא {_degree(base_ang)}."
                rows = [(f"מה גודל הזווית החיצונית {_angle(a+c+d)}? השתמשו בשתי הזוויות הרחוקות.", f"{_degree(outside)}. זהו סכום זווית הראש והזווית ליד {B}."),
                        (f"מהו גודל הזווית הפנימית ליד {C}?", f"{_degree(second)}. היא משלימה את הזווית החיצונית לזווית שטוחה."),
                        (f"בדגם אחר זווית הראש גדלה בחמש מעלות והזווית ליד {B} קטנה בחמש מעלות. כיצד משתנה הזווית החיצונית?", "היא נשארת באותו גודל כי סכום שתי הזוויות הרחוקות נשמר.")]
        elif quarter:
            intro += f"הקטע {AD} חוצה את זווית הראש ופוגש את {BC} בנקודה {D}. "
            intro += f"זווית הראש היא {_degree(apex_ang)} והזווית ליד {B} היא {_degree(base_ang)}."
            inner=180-base_ang-apex_ang//2
            rows = [(f"חשבו את {_angle(b+a+d)} ונמקו.", f"{_degree(apex_ang//2)}. חוצה הזווית מחלק את זווית הראש לשתי זוויות שוות."),
                    (f"מצאו את {_angle(b+d+a)} מתוך המשולש {_label('polygon',b+d+a)}.", f"{_degree(inner)}. מחסרים מזווית שטוחה את זווית הבסיס ואת מחצית זווית הראש."),
                    (f"תלמיד טוען ש־{AD} מאונך לבסיס מכיוון שהוא חוצה את זווית הראש. בדקו את הטענה בעזרת התוצאה שקיבלתם.", f"הטענה שגויה. הזווית ליד {D} היא {_degree(inner)} ולא זווית ישרה.")]
        elif design == "challenge_converse":
            intro += f"הקטע {AD} חוצה את זווית הראש וגם מאונך ל־{BC}. לא נתון שהנקודה {D} היא אמצע הצלע."
            rows = [(f"השוו בין שני המשולשים שמשני צידי {AD}. איזה זוג זוויות שווה נוסף על הזוויות הישרות, ואיזו צלע משותפת?", f"שתי הזוויות ליד {A} שוות בגלל חוצה הזווית. הצלע {AD} משותפת ונמצאת בין הזוויות השוות."),
                    (f"הוכיחו שהנקודה {D} היא אמצע הבסיס מבלי להניח שוויון שוקיים.", f"המשולשים חופפים לפי זווית, צלע וזווית. הצלעות המתאימות {BD} ו־{DC} שוות ולכן {D} היא נקודת האמצע."),
                    (f"אחרי ההוכחה התברר שזווית הבסיס היא {_degree(base_ang)}. חשבו את זווית הראש בשלמותה.", f"בחפיפה התקבלו גם שוקיים שוות. שתי זוויות הבסיס שוות, ולכן זווית הראש היא {_degree(apex_ang)}.")]
        elif design in ("converse_segments","coincidence"):
            intro += f"{D} אמצע {BC} וגם {AD} מאונך לבסיס."
            rows = [(f"זהו שני תפקידים של {AD} וציינו איזה נתון מצדיק כל תפקיד.", "נקודת האמצע מוכיחה שזהו תיכון. המאונכות מוכיחה שזהו גובה."),
                    (f"הסבירו מדוע {AB} ו־{AC} שוות בעזרת הקיפול לאורך {AD}.", f"שני חצאי הבסיס שווים ונמצאים על אותו אנך לקפל. לכן {B} עובר אל {C}, ואילו {A} נשאר במקומו."),
                    (f"במשולש כזה זווית הבסיס היא {_degree(base_ang)}. מה הגודל של {_angle(b+a+d)}?", f"{_degree(90-base_ang)}. במשולש הקטן יש זווית ישרה וזווית בסיס נתונה.")]
        elif design == "refute_median":
            intro += f"{AD} תיכון לצלע {BC}. זוויות הבסיס הן {_degree(base_ang)} ו־{_degree(second)}."
            rows = [(f"האם הצלעות {AB} ו־{AC} שוות? הסתמכו על זוויות הבסיס.", "לא. אילו שתי הצלעות היו שוות, גם הזוויות שמולן היו שוות."),
                    (f"נתון ש־{AD} תיכון. האם הוא יכול להיות גם גובה במשולש הנתון? נמקו.", "לא. תיכון שהוא גובה היה יוצר אנך אמצעי, ולכן הקודקוד היה שווה מרחק מקצות הבסיס."),
                    ("הציעו שינוי של זווית בסיס אחת שיאפשר לתיכון להיות גם גובה.", f"לדוגמה, משנים את הזווית השנייה ל־{_degree(base_ang)}. אז זוויות הבסיס שוות וגם השוקיים שוות.")]
        elif design == "converse_angles":
            intro += f"שתי זוויות הבסיס ליד {B} וליד {C} בגודל {_degree(base_ang)} כל אחת. הנקודה {D} היא אמצע הבסיס."
            rows = [(f"אילו שתי צלעות תוכלו להוכיח ששוות ולפי איזה משפט?", f"{AB} ו־{AC} שוות. במשולש מול זוויות שוות מונחות צלעות שוות."),
                    (f"חשבו את הזווית השלישית.", f"{_degree(apex_ang)}. מחסרים פעמיים את זווית הבסיס מסכום הזוויות במשולש."),
                    ("מהי ההנחה ומהי המסקנה במשפט הישר המתאים למשפט ההפוך שבו השתמשתם?", "במשפט הישר מניחים שהשוקיים שוות ומסיקים שזוויות הבסיס שוות.")]
        else:
            intro += f"השוקיים {AB} ו־{AC} שוות והנקודה {D} היא אמצע הבסיס. "
            if design=="base_from_apex":
                intro += f"זווית הראש היא {_degree(apex_ang)}."
                rows = [("מה הסכום של שתי זוויות הבסיס?", f"{_degree(2*base_ang)}. מחסרים את זווית הראש מסכום הזוויות במשולש."),
                        (f"חשבו את הזווית ליד {B} והסבירו מדוע מותר לחלק בשתיים.", f"{_degree(base_ang)}. במשולש שווה שוקיים שתי זוויות הבסיס שוות."),
                        ("אם זווית הראש גדלה בשש מעלות והמשולש נשאר שווה שוקיים, מה קורה לכל זווית בסיס?", "היא קטנה בשלוש מעלות. שתי הזוויות מתחלקות שווה בשווה בשינוי של שש מעלות.")]
            else:
                intro += f"זווית הבסיס ליד {C} היא {_degree(base_ang)}."
                rows = [(f"קבעו את זווית הבסיס השנייה. איזה נתון נחוץ לכך?", f"{_degree(base_ang)}. שוויון השוקיים גורר את שוויון זוויות הבסיס."),
                        ("חשבו את זווית הראש והציגו את דרך החישוב.", f"{_degree(apex_ang)}. מחסרים פעמיים את זווית הבסיס מסכום הזוויות במשולש."),
                        ("בדגם אחר כל אחת מזוויות הבסיס גדלה במעלה אחת. בכמה תשתנה זווית הראש?", "זווית הראש תקטן בשתי מעלות כדי לשמור על סכום הזוויות במשולש.")]
    q = {"intro":intro,"figure":fig,"items":[_item(p,k) for p,k in rows]}
    if design=="split_base":
        q["items"][1]["answer"]={"kind":"figure","operation":"half_base","unit":"יחידות אורך"}
    return q


def _sketch_question(design, size):
    half = size+2
    base = 2*half
    leg = base+3
    if design in ("triangle_range","triangle_boundary"):
        intro = f"סרטטו שני קטעים שאורכיהם {leg} ו־{leg+2} יחידות. נסו להשתמש בהם כשתי צלעות במשולשים שונים."
        rows=[("הציעו אורך שלם מתאים לצלע השלישית והוסיפו אותה לסקיצה.", f"לדוגמה {base}. האורך גדול מהפרש הצלעות וקטן מסכומן."),
              ("מצאו את האורך השלם הקטן ביותר שעדיין יאפשר לסגור את המשולש.", "שלוש יחידות. אורך שתיים הוא בדיוק הפרש הצלעות."),
              ("מה האורך השלם הגדול ביותר שעדיין מתאים?", f"{2*leg+1}, יחידה אחת פחות מסכום שתי הצלעות.")]
    elif design in ("split_base","reverse_median","broken_path","equal_legs","challenge_paths","challenge_scale"):
        intro = f"סרטטו שני משולשים שווי שוקיים שבסיסיהם באורך {base} יחידות. בראשון כל שוק באורך {leg} יחידות, ובמשולש השני כל שוק ארוכה ביחידה אחת."
        rows=[("הוסיפו בשני השרטוטים תיכון לבסיס. מה שווה בשניהם אף שאורכי השוקיים שונים?", f"כל חצי בסיס באורך {half}, כי לשני המשולשים בסיס באותו אורך."),
              ("השוו בין היקפי שני המשולשים לפני הוספת התיכונים. הוכיחו את ההפרש בלי למדוד את הסקיצות.", "היקף המשולש השני גדול בשתי יחידות. הבסיס לא השתנה וכל שוק התארכה ביחידה אחת."),
              ("האם נתון על אורך הבסיס ואורך מחציתו מספיק כדי לקבוע את אורך השוק? השתמשו בשתי הסקיצות כדי להכריע.", "לא. בשני המשולשים הבסיס ומחציתו זהים, ולמרות זאת אורכי השוקיים שונים.")]
    elif design.startswith("exterior"):
        angle = 42+size
        intro = f"סרטטו משולש שיש בו זווית של {_degree(angle)} וזווית של {_degree(70)}. האריכו צלע מעבר לקודקוד הזווית השלישית."
        rows=[("סמנו את שתי הזוויות הרחוקות מן הזווית החיצונית. מהו סכומן?", f"{_degree(70+angle)}. אלו שתי הזוויות הנתונות."),
              ("סמנו את הזווית הצמודה לזווית החיצונית. מה גודלה?", f"{_degree(110-angle)}. סכום הזוויות במשולש הוא זווית שטוחה."),
              ("תלמיד מציע שרטוט נוסף עם אותן זוויות אך עם צלעות ארוכות יותר. האם הזווית החיצונית משתנה?", "לא. גודל הזווית החיצונית נקבע לפי סכום הזוויות הרחוקות.")]
    else:
        intro = f"סרטטו בסיס באורך {base} יחידות ואנך העובר באמצעו. בחרו על האנך שתי נקודות שונות באותו צד של הבסיס וחברו כל אחת לקצות הבסיס."
        rows=[("סמנו את שני המשולשים שהתקבלו והסבירו מדוע כל אחד מהם שווה שוקיים.", "כל נקודה על האנך האמצעי נמצאת במרחק שווה משני קצות הבסיס. אפשר גם לקפל לאורך האנך."),
              ("בחרו אחד המשולשים. אילו שלושה תפקידים ממלא בו הקטע שמקודקוד הראש אל אמצע הבסיס?", "תיכון לבסיס, גובה לבסיס וחוצה זווית הראש. השתקפות סביב האנך מחליפה בין שתי השוקיים."),
              ("בחרו קודקוד נוסף שאינו על הבסיס ואינו על האנך ורשמו איזה משלושת התפקידים נשאר מובטח לקטע שמחבר אותו לאמצע הבסיס.", "רק תיכון מובטח. הקטע עדיין מסתיים באמצע הבסיס, אבל אינו מאונך לבסיס ואינו חייב לחצות את זווית הראש.")]
    return {"intro":intro, "drawingFromWords":True, "items":[_item(p,k) for p,k in rows]}



def compile_design(payload, options, plan):
    from general_source import GeneralSourceError
    def invalid_design():
        raise GeneralSourceError("TRIANGLE_DESIGN_INVALID", "Provide every original design selection and its bounded parameters.")
    rows=payload.get("questions")
    if set(payload)!={"mode","questions"} or payload["mode"]!="triangle-design/1" or type(rows) is not list or len(rows)!=len(plan):
        invalid_design()
    compiled=[]
    for row, allowed, slot in zip(rows, options, plan):
        if type(row) is not dict or set(row)!={"design","size","names","rotation"}:
            invalid_design()
        design, size, labels, rotation=(row[k] for k in ("design","size","names","rotation"))
        if (design not in allowed or type(size) is not int or not 2<=size<=9 or labels not in LABEL_SETS or
                type(rotation) is not int or rotation not in (-22,0,22)):
            invalid_design()
        compiled.append(_grid_question(design,size,labels,rotation) if design.startswith("grid_") else
                        _euclidean_question(design,size,labels,rotation,slot["representation"]=="drawingFromWords"))
    return {"title":"משולשים ובניות במשולש", "rule":"קראו את הנתונים, סמנו את היחסים שניתנו והצדיקו כל מסקנה בעזרת הגדרה או משפט.",
            "practice":compiled[:-3],"challenges":compiled[-3:]}
