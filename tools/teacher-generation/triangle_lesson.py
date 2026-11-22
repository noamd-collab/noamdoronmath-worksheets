"""Replayable, closed native authoring of the grade-nine 30/60/90 theorem.

The teacher's selected curriculum determines direction. Only bounded integers
select variants. Nonstandard lesson context is passed intact to the general author.
"""

from pathlib import Path
import hashlib
import re
import secrets
import shutil
import sys

from general_source import GeneralSourceError

TOPIC = "g9r:right_triangle_30_60_90"
VERSION = "triangle-parameters/1"
FAMILIES = (
    "plain",
    "mid_short",
    "mid_hyp",
    "extend_short",
    "rectangle",
    "extend_hyp",
    "equilateral",
)
CONVERSE_ID = TOPIC + "#1"
DIRECT_RULE = "במשולש ישר־זווית הניצב שמול זווית בת $30°$ שווה למחצית היתר."
CONVERSE_RULE = "במשולש ישר־זווית, אם ניצב שווה למחצית היתר, הזווית שמולו היא בת $30°$."
PROGRESS = frozenset(
    """
למדנו למדתי למדו לימדתי לימדנו תרגלנו תרגלתי תרגלו ותרגלנו ותרגלו תרגול
הכרנו הכרתי הסברנו ראינו פתרנו ופתרנו הוכחנו חזרה חזרנו סיכמנו וסיכמנו
את ואת של כל האלו האלה אלו אלה אחד אחת מכל מהם מהן בשיעור האחרון הקודם השיעור
עד עכשיו בכיתה נושא הנושא בנושא בנושאנו בנושאים משפט המשפט משפטים המשפטים בשני שני
שניהם הפוך והפוך ההפוך וההפוך ישר ישרה ישרת ישרי וישר ישרות ישרים במשולש
משולש משולשים במשולשים המשולש המשולשים שלושים שישים תשעים
זוית זווית זוויות זויות הזווית הזויות הזוויות זוויותיו שזוויותיו זוויתו
בזווית יתר היתר הניצב ניצב ניצבים ניצבי מול שמול ומול למחצית מחצית וחצי חצי
פי שניים שווה השווה שווים והשווה יחס היחס בין צלעות הצלעות צלע הצלע וזוויות
למציאת מציאת ומציאת אורך אורכי אורכים חישוב וחישוב זיהוי זיהינו הוכחה
תרגיל תרגילים שאלות ודוגמאות דוגמאות לדוגמה דוגמה לדוגמא ותרגיל להמשך
בסיסי בסיסיים פשוטים פשוטות מעורבים ישיר הישיר והישיר רגיל הרגיל והרגיל
במשפט והמשפט משפטו והמשפטים עם עליו על והקשר שימוש במעלות מעלות
""".split()
)


def eligible(lesson):
    ids = lesson.get("lessonBoundary", {}).get("conceptIds", [])
    supported = {f"{TOPIC}#{i}" for i in range(6)}
    if not (
        lesson.get("version") == 3
        and lesson.get("gradeNumber") == 9
        and lesson.get("topicId") == TOPIC
        and lesson.get("level") in ("a", "e")
        and 20 <= lesson.get("questionCount", 0) <= 30
        and lesson.get("lessonGoal") in ("practice", "review")
        and ids
        and set(ids) <= supported
    ):
        return False
    for sentence in [lesson.get("lastLesson", ""), *lesson.get("alreadyLearned", [])]:
        tokens = re.findall(r"[א-ת]+|[0-9]+|[A-Za-z]+", sentence)
        if any(t not in PROGRESS and t not in {"30", "60", "90"} for t in tokens):
            return False
    return True


def parameters(lesson):
    if not eligible(lesson):
        raise GeneralSourceError(
            "TRIANGLE_SCOPE", "Native author does not cover this lesson"
        )
    return {
        "version": VERSION,
        "choices": [1 + secrets.randbelow(4) for _ in range(lesson["questionCount"])],
    }


def validate_parameters(lesson, data):
    if (
        not eligible(lesson)
        or not isinstance(data, dict)
        or set(data) != {"version", "choices"}
        or data["version"] != VERSION
    ):
        raise GeneralSourceError(
            "TRIANGLE_SCOPE", "Unexpected triangle source or lesson"
        )
    if (
        type(data["choices"]) is not list
        or len(data["choices"]) != lesson["questionCount"]
        or any(type(x) is not int or not 1 <= x <= 4 for x in data["choices"])
    ):
        raise GeneralSourceError(
            "TRIANGLE_PARAMETERS", "Expected one bounded choice per triangle question"
        )


def math(value):
    return "$" + str(value) + "$"


def number(v):
    import sympy as sp

    return sp.latex(v).replace(r"\frac", r"\f").replace("-", "−").replace(" ", "")


def angle(name, value):
    return {"type": "angle", "at": name[1], "rays": [name[0], name[2]], "value": value}


def length(side, value):
    return {"type": "length", "of": side, "value": value}


def item(prompt, answer, target):
    return {
        "text": prompt,
        "answer": answer,
        "given": [],
        "to_prove": [
            {"type": "find", "quantity": "value", "what": target, "value": answer}
        ],
    }


def extra(family, s):
    """Every auxiliary vertex participates in a pupil's task."""
    import sympy as sp

    variants = {
        "mid_short": (
            "$M$ היא אמצע הניצב $AB$, כלומר $AM=BM$.",
            "חשבו את $BM$.",
            math("BM=" + number(sp.Rational(s, 2))) + ", מחצית הניצב.",
            "BM",
        ),
        "mid_hyp": (
            "$M$ היא אמצע היתר $BC$, כלומר $BM=CM$.",
            "חשבו את $MC$ והשוו אותו ל־$AB$.",
            math(f"MC={s}=AB") + ", כי שני הקטעים שווים למחצית היתר.",
            "MC",
        ),
        "extend_short": (
            "הניצב $AB$ מוארך מעבר ל־$B$ עד $D$, כך ש־$BD$ שווה למחצית $AB$.",
            "חשבו את $AD$.",
            math("AD=" + number(sp.Rational(3 * s, 2))) + ", סכום הניצב ומחציתו.",
            "AD",
        ),
        "extend_hyp": (
            "היתר $BC$ מוארך מעבר ל־$C$ עד $D$, כך ש־$CD$ שווה למחצית $BC$.",
            "חשבו את $BD$.",
            math(f"BD={3 * s}") + ", סכום היתר ומחציתו.",
            "BD",
        ),
        "rectangle": (
            "המשולש הוא מחצית המלבן $ABDC$, שהאלכסון שלו הוא $BC$.",
            "חשבו את אורך הצלע $CD$ במלבן.",
            math(f"CD={s}") + ", כי צלעות נגדיות במלבן שוות.",
            "CD",
        ),
        "equilateral": (
            "$A$ היא אמצע $BD$, כך ש־$AB=AD$, והקטע $AC$ הוא הגובה במשולש שווה־הצלעות $BCD$.",
            "מצאו את היקף המשולש שווה־הצלעות $BCD$.",
            "ההיקף הוא " + math(6 * s) + ", שלוש פעמים אורך $BC$.",
            "היקף",
        ),
    }
    return variants.get(family)


def layout(n, level):
    words_count = round(n * (0.15 if level == "a" else 0.10))
    words = {int((j + 0.5) * n / words_count) + 1 for j in range(words_count)}
    drawn = [q for q in range(1, n + 1) if q not in words]
    coords_count = (n + 3) // 4
    coords = {
        drawn[int((j + 0.5) * len(drawn) / coords_count)] for j in range(coords_count)
    }
    families = iter(FAMILIES * n)
    return [
        "words" if q in words else "coordinate" if q in coords else next(families)
        for q in range(1, n + 1)
    ]


def question(lesson, n, family, choice, converse, coord_index):
    import sympy as sp

    star = n > lesson["questionCount"] - 3
    coord = family == "coordinate"
    counter = coord and converse and coord_index % 3 == 1
    algebra = (
        not converse
        and not coord
        and family != "words"
        and (star or lesson["level"] == "e" and n % 3 == 1)
    )
    mode = (
        "converse"
        if converse
        else "algebra"
        if algebra
        else "forward_hyp"
        if not coord and (n // 2) % 2 == 0
        else "forward_short"
    )
    s = 1 + (coord_index + choice) % 3 if coord else 4 + (3 * n + choice) % 20
    if counter:
        # A 3:4:5 nonexample at scale 3 forces the large grid's native labels
        # below the pinned face-size tolerance. Both smaller scales retain
        # distinct exact integer nonexamples and full-size axis labels.
        s = min(2, s)
    ax, ay = -2 + coord_index % 4, -2 + (coord_index + 1) // 2 % 4
    if coord and not converse:
        # Coordinate tasks give the short leg and ask for the hypotenuse.
        # Keep coordinate components distinct from the requested unknown.
        # This also keeps the figure and the literal radical readable.
        span = 2 if s == 1 else 4
        occurrence = coord_index // 2
        ax, ay = -(occurrence % span), -((occurrence // span + 1) % span)
    vertical = coord_index % 2 == 1
    fig = (
        {
            "family": family,
            "short": s,
            "mode": mode,
            "anchor": [ax, ay],
            "vertical": vertical,
            "rotate": 0 if coord else (0, 25, 90, 180)[(n - 1) % 4],
            "names": "ABC",
            "counterexample": counter,
        }
        if family != "words"
        else None
    )
    ab = 3 * s if counter else s
    ac = 4 * s if counter else s * sp.sqrt(3)
    bc = 5 * s if counter else 2 * s
    points = {
        "A": (ax, ay),
        "B": (ax, ay + ab) if vertical else (ax + ab, ay),
        "C": (ax + ac, ay) if vertical else (ax, ay + ac),
    }

    def distance(side):
        (x, y), (u, v) = (points[p] for p in side)
        return sp.sqrt((x - u) ** 2 + (y - v) ** 2)

    lengths = {side: distance(side) for side in ("AB", "AC", "BC")}
    if (
        lengths != {"AB": ab, "AC": ac, "BC": bc}
        or ab**2 + ac**2 != bc**2
        or (2 * lengths["AB"] == lengths["BC"]) == counter
    ):
        raise ValueError("Triangle differs from its exact coordinate model")
    unit = "יחידות אורך" if coord else "ס״מ"
    given = [angle("BAC", 90)]
    intro = r"במשולש $\tri ABC$ נתון $\angle{BAC}=90°$."
    if family == "words":
        intro = "לפי התיאור המילולי, " + intro
    if coord:
        coords = ", ".join(
            math(p + "(" + number(x) + "," + number(y) + ")")
            for p, (x, y) in points.items()
        )
        intro = "במערכת הצירים נתונות הנקודות " + coords + "."
    if converse:
        intro += (
            " נתון " + math(f"AB={ab}") + " ו־" + math(f"BC={bc}") + " " + unit + "."
        )
        given.extend([length("AB", ab), length("BC", bc)])
    else:
        intro += r" נתון $\angle{ACB}=30°$."
        given.append(angle("ACB", 30))
        if algebra:
            a = (s + 1) // 2
            b = 3 * a - s
            expressions = math(f"AB=x+{a}") + " ו־" + math(f"BC=3x+{b}")
            intro += " האורכים בס״מ הם " + expressions + "."
            given.append(expressions)
        else:
            side, size = ("BC", bc) if mode == "forward_hyp" else ("AB", ab)
            measured_unit = "יחידת אורך" if coord and size == 1 else unit
            intro += (
                " אורך " + math(side) + " הוא " + math(size) + " " + measured_unit + "."
            )
            given.append(length(side, size))
    extension = extra(family, s)
    if extension:
        intro += " " + extension[0]
        given.append(extension[0])
        if family in ("mid_short", "mid_hyp"):
            parts = ["AM", "BM"] if family == "mid_short" else ["BM", "CM"]
            given.append({"type": "equal_length", "of": parts})
        elif family == "equilateral":
            given.append({"type": "equal_length", "of": ["AB", "AD"]})
    if coord:
        direction = "$AB$ אנכי ו־$AC$ אופקי" if vertical else "$AB$ אופקי ו־$AC$ אנכי"
        first = item(
            "נמקו בעזרת השיעורים מדוע הזווית ב־$A$ ישרה.",
            direction + " לפי השיעורים, ולכן הצלעות מאונכות.",
            "אנכיות הצלעות",
        )
    elif algebra:
        x = sp.Symbol("x")
        if sp.solve(sp.Eq(3 * x + b, 2 * (x + a)), x) != [s - a]:
            raise ValueError(
                "Algebraic length does not have the intended unique solution"
            )
        first = item(
            "כתבו משוואה בעזרת המשפט ופתרו אותה.",
            math(f"3x+{b}=2(x+{a})") + ", ולכן " + math(f"x={s - a}") + ".",
            "ערך המשתנה",
        )
    elif converse and (star or lesson["level"] == "e" and n % 3 == 1):
        # The displayed side lengths are the original ones. Preserving the half
        # ratio after one side grows requires twice that increment on the other.
        increase = choice + 1
        first = item(
            "אם נוסיף "
            + math(increase)
            + " ס״מ ל־$AB$, כמה ס״מ יהיה צורך להוסיף ל־$BC$ כדי לשמור על היחס המקורי?",
            "נוסיף " + math(2 * increase) + " ס״מ ליתר, כי עליו להישאר כפול מהניצב.",
            "התוספת ליתר",
        )
    elif converse and n % 3 == 0:
        first = item(
            "לפי מיקום הזווית הישרה, איזו מהצלעות הנתונות היא היתר? מה הקשר בינה לניצב הנתון?",
            "$BC$ מול הזווית הישרה. $AB$ שווה למחצית $BC$.",
            "היתר והיחס לניצב",
        )
    elif converse:
        first = item(
            "חשבו את היחס בין $AB$ ל־$BC$.", r"$\f{AB}{BC}=\f{1}{2}$.", "יחס האורכים"
        )
    else:
        side, size = ("AB", ab) if mode == "forward_hyp" else ("BC", bc)
        first = item(
            "חשבו את אורך " + math(side) + " ונמקו.",
            math(f"{side}={size}")
            + " "
            + unit
            + ". הניצב שמול הזווית בת $30°$ שווה למחצית היתר.",
            side,
        )
    if converse and counter:
        second = item(
            "בדקו אם $AB$ הוא מחצית היתר ונמקו.",
            "לא. כפל אורך $AB$ בשתיים נותן "
            + math(2 * ab)
            + ", ואורך היתר הוא "
            + math(bc)
            + ".",
            "בדיקת המחצית",
        )
    elif converse:
        second = item(
            r"מצאו את $\angle{ACB}$ באמצעות המשפט ההפוך. נמקו.",
            r"$\angle{ACB}=30°$. המשולש ישר־זווית ו־$AB$ שווה למחצית $BC$.",
            "מידת הזווית",
        )
    elif coord:
        missing, result = ("AB", ab) if mode == "forward_hyp" else ("BC", bc)
        measured_unit = "יחידת אורך" if result == 1 else unit
        second = item(
            "השתמשו במשפט כדי לחשב את אורך " + math(missing) + ".",
            math(f"{missing}={result}")
            + " "
            + measured_unit
            + ". אורך היתר כפול מאורך הניצב שמול $30°$.",
            missing,
        )
        second["to_prove"][0] = {
            "type": "find",
            "quantity": "length",
            "of": missing,
            "value": result,
        }
    elif algebra:
        second = item(
            "חשבו את אורכי $AB$ ו־$BC$ והסבירו את הקשר ביניהם.",
            math(f"AB={ab}")
            + ", "
            + math(f"BC={bc}")
            + " "
            + unit
            + ". אורך היתר כפול מאורך הניצב שמול $30°$.",
            "אורכי הצלעות",
        )
    else:
        second = item(
            r"מצאו את $\angle{ABC}$ ונמקו.",
            r"$\angle{ABC}=60°$, משלימים את $90°$ ו־$30°$ ל־$180°$.",
            "מידת הזווית",
        )
    if family == "words":
        marks = (
            ("מסמנים " + math(f"AB={ab}") + " ו־" + math(f"BC={bc}") + ".")
            if converse
            else r"מסמנים $\angle{ACB}=30°$ ואת האורך הנתון."
        )
        third = item(
            "סרטטו סקיצה וסמנו בה רק את הנתונים שבטקסט.",
            "זווית ישרה ב־$A$. " + marks + " כל סקיצה המקיימת נתונים אלה מתקבלת.",
            "סקיצה המקיימת את הנתונים",
        )
        third["to_prove"] = []
        third["to_construct"] = [{"type": "polygon", "points": ["A", "B", "C"]}]
    elif extension:
        third = item(*extension[1:])
    elif counter and lesson["lessonBoundary"]["conceptIds"] == [CONVERSE_ID]:
        third = item(
            "במשולש ישר־זווית אחר הניצב הוא באורך $AB$. איזה אורך יתר יאפשר להפעיל את המשפט ההפוך?",
            "אורך היתר צריך להיות " + math(2 * ab) + " יחידות אורך, כפול מאורך הניצב.",
            "יתר המקיים את תנאי המשפט ההפוך",
        )
    elif counter:
        third = item(
            r"האם $\angle{ACB}$ יכולה להיות בת $30°$? נמקו.",
            r"לא. אילו הייתה בת $30°$, הניצב $AB$ שמולה היה שווה למחצית היתר.",
            "בדיקת הטענה",
        )
        # A yes/no claim; the stated hypothesis is intentionally part of the
        # prompt. Its explanation is evidence for the answer, not the target.
        third["to_prove"][0]["value"] = "לא"
    elif star:
        third = item(
            "תלמידה טוענת שגם הניצב השני שווה למחצית היתר. בדקו את טענתה.",
            r"לא. מול הניצב $AC$ נמצאת זווית בת $60°$. לשני ניצבים שווים היו שתי זוויות חדות שוות.",
            "הערכת טענה",
        )
    elif converse:
        third = item(
            r"מצאו גם את $\angle{ABC}$.",
            r"$\angle{ABC}=60°$, לפי סכום הזוויות במשולש.",
            "הזווית החדה השנייה",
        )
    else:
        third = item(
            "מגדילים את כל אורכי הצלעות פי שלושה. מה יהיה אורך היתר החדש?",
            "אורך היתר החדש יהיה "
            + math(3 * bc)
            + " "
            + unit
            + ", פי שלושה מאורך היתר המקורי.",
            "היתר לאחר הגדלה",
        )
    items = [
        dict(
            row,
            label=label,
            space=280 if family == "words" and label == "ג" else 50 if star else 32,
        )
        for label, row in zip("אבג", (first, second, third))
    ]
    facts = {
        "itemId": f"q{n}",
        "vertices": {p: list(map(str, xy)) for p, xy in points.items()},
        "lengths": {k: str(v) for k, v in lengths.items()},
        "halfHypotenuse": not counter,
        "method": "exact distances and Pythagorean identity",
    }
    # Words-only givens belong to the text. Typed geometric declarations in
    # this pinned skill specifically assert measurements on a finished SVG.
    facts["givens"] = given
    return (
        {
            "n": n,
            "intro": intro,
            "star": star,
            "given": given if fig else [intro],
            "items": items,
            "to_prove": [],
        },
        fig,
        facts,
    )


def build(lesson, data):
    validate_parameters(lesson, data)
    ids = lesson["lessonBoundary"]["conceptIds"]
    direct = [cid for cid in ids if cid != CONVERSE_ID]
    reverse = CONVERSE_ID in ids
    n = lesson["questionCount"]
    rule = " ".join(
        ([DIRECT_RULE] if direct else []) + ([CONVERSE_RULE] if reverse else [])
    )
    level = {
        "key": "a" if lesson["level"] == "a" else "c",
        "level": "רמה א׳" if lesson["level"] == "a" else "מצוינות",
        "title": "משולש ישר־זווית שזוויותיו 30°, 60°, 90°",
        "grade": "9",
        "rule": rule,
        "curriculum": {"topic": "right_triangle_30_60_90", "track": "ט_רגילה"},
        "keep_questions": True,
        "figure_topic": True,
        "words_share": {},
        "questions": [],
        "answers": [],
    }
    canon, evidence, coord_index = [], [], 0
    used_intros = set()
    ends = (n // 3, n - 3, n)
    starts = (1, ends[0] + 1, ends[1] + 1)
    titles = ("מזהים נתונים ומשתמשים במשפט", "משלבים נתונים ומנמקים", "אתגרים")
    for pos, (family, choice) in enumerate(
        zip(layout(n, lesson["level"]), data["choices"]), 1
    ):
        converse = reverse and (
            not direct
            or (coord_index % 2 == 1 if family == "coordinate" else pos % 2 == 0)
        )
        for offset in range(4):
            variation = 1 + (choice - 1 + offset) % 4
            q, fig, facts = question(
                lesson, pos, family, variation, converse, coord_index
            )
            if q["intro"] not in used_intros:
                break
        else:
            raise ValueError(
                "Exhausted distinct triangle givens in the requested worksheet"
            )
        used_intros.add(q["intro"])
        coord_index += int(family == "coordinate")
        section = next(i for i, end in enumerate(ends) if pos <= end)
        if pos in starts:
            q["part"] = [titles[section], f"{starts[section]}–{ends[section]}"]
        if fig:
            q["_triangleFigure"] = fig
        else:
            level["words_share"][pos] = "סרטוט סקיצה לפי נתונים מילוליים"
        level["questions"].append(q)
        level["answers"].append(
            [pos, [[i["label"], i["answer"]] for i in q["items"]], q["star"]]
        )
        canon.append(
            {
                "id": f"q{pos}",
                "n": pos,
                "intro": q["intro"],
                "section": titles[section],
                "conceptIds": [CONVERSE_ID] if converse else direct,
                "figure": fig,
                "items": q["items"],
            }
        )
        evidence.append(facts)
    return level, canon, evidence


BRIDGE = """import importlib.util
import json
from pathlib import Path
base = Path(__file__).parent
spec = importlib.util.spec_from_file_location("triangle_shape", base / "triangle_shape.py")
shapes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shapes)
LEVELS = json.loads((base / "levels.json").read_text(encoding="utf-8"))
for level in LEVELS:
    level["words_share"] = {int(k): v for k, v in level["words_share"].items()}
    for q in level["questions"]:
        if "_triangleFigure" in q:
            svg = shapes.render_triangle(q.pop("_triangleFigure"))
            if svg != q["fig"]:
                raise ValueError("Triangle differs from its recorded construction")
STRICT_FIGURES = True
PACKAGE = "G9-T90"
"""


def compile_triangle(lesson, data, scope, skill, work):
    from general_adapters import dump

    sys.path.insert(0, str(Path(skill).resolve()))
    from triangle_shape import render_triangle

    level, canonical, facts = build(lesson, data)
    folder = Path(work)
    (folder / "figures").mkdir(exist_ok=True)
    for q in level["questions"]:
        if "_triangleFigure" in q:
            spec = q["_triangleFigure"]
            svg = render_triangle(spec)
            q["fig"] = svg
            stem = folder / "figures" / ("q" + str(q["n"]))
            stem.with_suffix(".svg").write_text(svg, encoding="utf-8")
            dump(
                stem.with_suffix(".json"),
                {
                    "version": 1,
                    "constructorInput": spec,
                    "sha256": hashlib.sha256(svg.encode()).hexdigest(),
                },
            )
    evidence = {
        "version": 1,
        "scope": "exact lengths, half-hypotenuse and right-angle identities",
        "computations": facts,
        "proseReviewRequired": True,
    }
    dump(folder / "general-source.json", data)
    dump(folder / "general-evidence.json", evidence)
    dump(folder / "verified.json", evidence)
    dump(folder / "levels.json", [level])
    dump(
        folder / "worksheet-source.json",
        {
            "version": 4,
            "meta": {"gradeNumber": 9, "levelCode": lesson["level"], "topicId": TOPIC},
            "questions": canonical,
            "reviewRequired": True,
        },
    )
    shutil.copyfile(
        Path(__file__).with_name("triangle_shape.py"), folder / "triangle_shape.py"
    )
    (folder / "content.py").write_text(BRIDGE, encoding="utf-8")
    return {
        "skill": "middle",
        "work": str(folder),
        "sourcePath": str(folder / "worksheet-source.json"),
        "reviewRequired": True,
    }
