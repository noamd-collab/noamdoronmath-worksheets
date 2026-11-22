"""Exact grade-eight Pythagorean theorem practice with replayable geometry."""

import secrets

from general_source import GeneralSourceError
from triangle_lesson import angle, item, length, math

TOPIC = "g8:pythagoras"
VERSION = "pythagoras-parameters/1"
IDS = tuple(f"{TOPIC}#{i}" for i in range(12))
STANDARD_NOTE = "סיימנו ללמוד את הנושא משפט פיתגורס ותרגלנו את המושגים שסומנו."
TRIPLES = ((3, 4, 5), (5, 12, 13), (8, 15, 17), (9, 12, 15))
LAYOUT = (
    "right",
    "grid",
    "words",
    "rectangle",
    "isosceles",
    "grid",
    "right",
    "words",
    "median",
    "grid",
    "rectangle",
    "isosceles",
    "words",
    "right",
    "grid",
    "median",
    "rectangle",
    "words",
    "grid",
    "isosceles",
)
TITLES = ("מכירים את היתר ואת הניצבים", "מחשבים ובודקים בעזרת המשפט", "אתגרים")


def eligible(lesson):
    return (
        lesson.get("topicId") == TOPIC
        and lesson.get("gradeNumber") == 8
        and lesson.get("version") == 3
        and lesson.get("level") == "b"
        and lesson.get("questionCount") == len(LAYOUT)
        and lesson.get("lessonGoal") == "practice"
        and not lesson.get("alreadyLearned")
        and lesson.get("lastLesson", "").strip() == STANDARD_NOTE
        and set((lesson.get("lessonBoundary") or {}).get("conceptIds", [])) == set(IDS)
    )


def parameters(lesson):
    if not eligible(lesson):
        raise GeneralSourceError("PYTHAGORAS_SCOPE", "Unsupported Pythagorean lesson")
    return {"version": VERSION, "choices": [secrets.randbelow(4) for _ in LAYOUT]}


def validate_parameters(lesson, data):
    if (
        not eligible(lesson)
        or not isinstance(data, dict)
        or set(data) != {"version", "choices"}
        or data["version"] != VERSION
    ):
        raise GeneralSourceError(
            "PYTHAGORAS_SCOPE", "Unexpected Pythagorean lesson or source"
        )
    choices = data["choices"]
    if (
        type(choices) is not list
        or len(choices) != len(LAYOUT)
        or any(type(i) is not int or not 0 <= i < 4 for i in choices)
    ):
        raise GeneralSourceError(
            "PYTHAGORAS_PARAMETERS", "A bounded choice is needed for every question"
        )


def square_distance(points, edge):
    a, b = (points[k] for k in edge)
    return sum((x - y) ** 2 for x, y in zip(a, b))


def cm(value):
    return math(value) + " ס״מ"


def side_answer(edge, value):
    return cm(f"{edge}={value}")


def right_answer(p, q, h):
    return math(f"{p}·{p}+{q}·{q}={h * h}") + ", ולכן האורך " + cm(h) + "."


def difference(p, h, q):
    return math(f"{h}·{h}-{p}·{p}={q * q}") + ", ולכן האורך " + cm(q) + "."


def sketch():
    task = item(
        "סרטטו סקיצה וסמנו בה את שמות הקודקודים ואת האורכים הנתונים בלבד.",
        "סקיצה לפי התיאור, עם קודקודים ואורכים מסומנים.",
        "סקיצה",
    )
    task["to_prove"] = []
    task["to_construct"] = [{"type": "polygon", "points": list("ABC")}]
    return task


def triangle_question(family, mode, p, q, h, star):
    points = {"A": (0, 0), "B": (p, 0), "C": (0, q)}
    intro = r"במשולש $\tri ABC$ הזווית $\angle{BAC}$ ישרה."
    givens = [angle("BAC", 90)]
    labels = {"AB": p, "AC": q}
    reverse = False
    if family == "right":
        if mode == 0:
            tasks = [
                item(
                    "איזו צלע היא היתר? הסבירו לפי מיקום הזווית הישרה.",
                    "$BC$ נמצאת מול הזווית הישרה.",
                    "היתר",
                ),
                item("חשבו את אורך היתר.", right_answer(p, q, h), "אורך היתר"),
                item(
                    "בכמה ארוך המסלול לאורך שני הניצבים מן המסלול הישיר?",
                    cm(p + q - h) + ", ההפרש בין סכום הניצבים ליתר.",
                    "הפרש אורכים",
                ),
            ]
        else:
            labels = {"AB": p, "BC": h}
            tasks = [
                item(
                    "ציינו איזה מן האורכים הנתונים שייך ליתר.",
                    side_answer("BC", h) + ", כי הוא מול הזווית הישרה.",
                    "זיהוי היתר",
                ),
                item("חשבו את אורך הניצב החסר.", difference(p, h, q), "הניצב החסר"),
                item(
                    "תלמיד חיסר את שני האורכים הנתונים וקיבל תשובה שונה. הסבירו את הטעות.",
                    "מחסרים את ריבועי האורכים ומוציאים שורש.",
                    "ניתוח הטעות",
                ),
            ]
        if mode == 2:
            intro += " תלמיד הציע לחבר את שני הריבועים כדי לחשב את הניצב הנוסף."
            tasks = [
                item(
                    "הסבירו בלי לחשב מדוע החיבור שהוצע יניב אורך גדול מדי.",
                    "שורש סכום הריבועים יהיה ארוך מן היתר הנתון, אך ניצב קצר מן היתר.",
                    "זיהוי הטעות",
                ),
                item(
                    "כתבו חישוב מתוקן ומצאו את הניצב החסר.",
                    difference(p, h, q),
                    "חישוב מתוקן",
                ),
                item(
                    "בדקו את התוצאה בהצבה בחיבור ריבועי שני הניצבים.",
                    math(f"{p}·{p}+{q}·{q}={h * h}={h}·{h}") + ".",
                    "בדיקת התוצאה",
                ),
            ]
    elif family == "rectangle":
        points = {"A": (0, 0), "B": (p, 0), "C": (p, q), "D": (0, q)}
        intro = "במלבן $ABCD$ העבירו את האלכסון $AC$."
        givens = [angle("ABC", 90)]
        if mode == 1:
            labels = {"AB": p, "AC": h}
            tasks = [
                item(
                    "הסבירו מדוע $AC$ הוא היתר במשולש $ABC$.",
                    "הוא מול הזווית הישרה בקודקוד $B$.",
                    "זיהוי היתר",
                ),
                item("חשבו את רוחב המלבן $BC$.", difference(p, h, q), "רוחב המלבן"),
                item(
                    "חשבו את המרחק מ־$A$ ל־$C$ לאורך השפה העוברת ב־$B$.",
                    cm(p + q) + ", סכום שתי צלעות סמוכות.",
                    "מסלול לאורך השפה",
                ),
            ]
        else:
            labels = {"AB": p, "BC": q}
            tasks = [
                item(
                    "ציינו את שני הניצבים במשולש $ABC$.",
                    "$AB$ ו־$BC$ נפגשים בזווית ישרה.",
                    "זיהוי ניצבים",
                ),
                item(
                    "חשבו את אורך האלכסון $AC$.", right_answer(p, q, h), "אורך האלכסון"
                ),
                item(
                    "בוחרים ללכת ישירות לאורך האלכסון במקום לאורך שתי צלעות. כמה ס״מ חוסכים?",
                    cm(p + q - h) + ", ההפרש בין שני המסלולים.",
                    "אורך שנחסך",
                ),
            ]
        if mode == 2:
            intro += " מניחים לוח חיזוק מהקודקוד $A$ ועד לקודקוד $C$."
            tasks = [
                item(
                    "אילו אורכים דרושים כדי לקבוע את אורך הלוח?",
                    "$AB$ ו־$BC$, שתי צלעות סמוכות הנפגשות בזווית ישרה.",
                    "בחירת הנתונים",
                ),
                item(
                    "חשבו את האורך המדויק של לוח החיזוק.",
                    right_answer(p, q, h),
                    "אורך לוח החיזוק",
                ),
                item(
                    "נמצא לוח באורך "
                    + cm(h - 1)
                    + ". האם הוא יגיע בין שני הקודקודים? הסבירו.",
                    "הוא קצר בסנטימטר מן האלכסון הדרוש.",
                    "השוואה לאורך הלוח",
                ),
            ]
    elif family == "isosceles":
        points = {"A": (-p, 0), "B": (p, 0), "C": (0, q), "H": (0, 0)}
        intro = r"במשולש $\tri ABC$ נתון $AC=BC$. הגובה $CH$ מאונך לבסיס $AB$ וחוצה אותו, כך ש־$AH=BH$."
        givens = [
            angle("AHC", 90),
            {"type": "equal_length", "of": ["AC", "BC"]},
            {"type": "equal_length", "of": ["AH", "BH"]},
        ]
        if star:
            intro += " מתכננים להגדיל את המשולש על פי מידותיו."
        if mode == 1:
            labels = {"AB": 2 * p, "AC": h}
            tasks = [
                item("מצאו את אורך $AH$.", cm(p) + ", מחצית הבסיס.", "מחצית הבסיס"),
                item("חשבו את אורך הגובה $CH$.", difference(p, h, q), "גובה המשולש"),
                item(
                    "מדוע אי אפשר להשתמש ב־$AB$ כולו כניצב בעת חישוב הגובה?",
                    "במשולש ישר־הזווית $AHC$ הניצב שעל הבסיס הוא $AH$ בלבד.",
                    "בחירת המשולש",
                ),
            ]
        else:
            labels = {"AB": 2 * p, "CH": q}
            tasks = [
                item(
                    "חשבו את אורך הקטע $AH$.",
                    cm(p) + ", כי הגובה חוצה את הבסיס.",
                    "מחצית הבסיס",
                ),
                item("חשבו את אורך השוק $AC$.", right_answer(p, q, h), "אורך השוק"),
                item(
                    "תלמידה השתמשה בבסיס המלא ובגובה כשני הניצבים. הסבירו כיצד תתקנו את החישוב.",
                    "ניצבי המשולש $AHC$ הם הגובה ומחצית הבסיס.",
                    "תיקון בחירת הניצבים",
                ),
            ]
            if star:
                tasks[2] = item(
                    "אם נכפיל גם את הבסיס וגם את הגובה, מה יהיה אורך השוק החדשה? הוכיחו בעזרת המשפט.",
                    math(f"{2 * p}·{2 * p}+{2 * q}·{2 * q}={2 * h}·{2 * h}")
                    + ", ולכן אורך השוק יהיה "
                    + cm(2 * h)
                    + ".",
                    "שוק לאחר שינוי קנה המידה",
                )
    elif family == "median":
        points.update(B=(2 * p, 0), M=(p, 0))
        intro += " הנקודה $M$ היא אמצע $AB$, כלומר $AM=BM$, והעבירו את $CM$."
        givens.append({"type": "equal_length", "of": ["AM", "BM"]})
        labels = {"AB": 2 * p, "AC": q} if mode == 0 else {"AB": 2 * p, "CM": h}
        tasks = [
            item(
                "מצאו את אורך $AM$.", cm(p) + ", מחצית הניצב $AB$.", "אורך מחצית הניצב"
            ),
            item(
                "חשבו את אורך " + math("CM" if mode == 0 else "AC") + ".",
                right_answer(p, q, h) if mode == 0 else difference(p, h, q),
                "אורך במשולש הפנימי",
            ),
            item(
                "איזה מהקטעים $BC$ או $MC$ ארוך יותר? נמקו בעזרת ריבועי האורכים.",
                "$BC$ ארוך יותר: $AC$ משותף, ואילו $AB$ ארוך מ־$AM$.",
                "השוואת היתרים",
            ),
        ]
    else:
        raise ValueError("Unknown figure family")
    for side, value in labels.items():
        if square_distance(points, side) != value**2:
            raise ValueError("Displayed length disagrees with its exact construction")
        givens.append(length(side, value))
    intro += (
        " האורכים הנתונים הם "
        + " ו־".join(side_answer(k, v) for k, v in labels.items())
        + "."
    )
    return intro, tasks, points, givens, labels, reverse


def words_question(mode, p, q, h):
    if mode in (1, 2, 3):
        # The altered longest side must still form a genuine triangle.
        longest = h if mode == 2 else h + 1
        if not q < longest < p + q:
            raise ValueError("The counterexample must be a nondegenerate triangle")
        intro = (
            r"במשולש $\tri ABC$ נתונות רק הצלעות: "
            + ", ".join(
                side_answer(side, v)
                for side, v in (("AB", p), ("AC", q), ("BC", longest))
            )
            + "."
        )
        if mode == 3:
            intro += " בודקים אם צריך לשנות את המוט הארוך במסגרת משולשת."
        eq = p * p + q * q == longest**2
        decision = (
            "כן. לפי המשפט ההפוך הזווית שמול הצלע הארוכה, ב־$A$, ישרה."
            if eq
            else "לא. ריבוע הצלע הארוכה שונה מסכום שני הריבועים האחרים."
        )
        tasks = [
            item(
                "השוו את סכום ריבועי שתי הצלעות הקצרות לריבוע הצלע הארוכה.",
                math(f"{p}·{p}+{q}·{q}={p * p + q * q}")
                + " ואילו "
                + math(f"{longest}·{longest}={longest**2}")
                + ".",
                "השוואת ריבועי האורכים",
            ),
            item(
                "האם אפשר לקבוע שהמשולש ישר־זווית? נמקו.", decision, "מסקנת ההשוואה"
            ),
            sketch(),
        ]
        if mode == 3:
            tasks[1] = item(
                "משאירים את שתי הצלעות הקצרות קבועות. מה צריך לשנות בצלע הארוכה כדי שיתקבל משולש ישר־זווית?",
                "יש לקצר אותה ב־"
                + cm(longest - h)
                + ", כי האורך הדרוש הוא "
                + cm(h)
                + ".",
                "תיקון האורך",
            )
        return intro, tasks, {}, [], {"AB": p, "AC": q, "BC": longest}, True
    intro = (
        r"סולם $BC$ שאורכו "
        + cm(h)
        + " נשען על קיר אנכי. נקודת המפגש בין הקיר לקרקע האופקית היא $A$, ורגל הסולם $B$ רחוקה ממנה "
        + cm(p)
        + "."
    )
    tasks = [
        item(
            "מדוע הסולם הוא היתר?",
            "הסולם מול הזווית הישרה.",
            "זיהוי היתר",
        ),
        item(
            "לאיזה גובה מעל הקרקע מגיע ראש הסולם?", difference(p, h, q), "גובה על הקיר"
        ),
        sketch(),
    ]
    return intro, tasks, {}, [], {"AB": p, "BC": h}, False


def grid_question(mode, choice):
    # Rotate/reflect whole lattice configurations, never individual labels.
    if mode == 2:
        points = {"A": (0, 0), "B": (1, 2), "C": (5, 0)}
    elif mode == 4:
        points = {"A": (0, 0), "B": (3, 0), "C": (1, 3)}
    elif mode == 3:
        points = {"A": (0, 0), "B": (3, 0), "C": (3, 4), "D": (-2, 0), "E": (-2, 4)}
    elif mode == 0:
        points = {"A": (0, 0), "B": (3, 0), "C": (3, 4), "D": (0, 4)}
    else:
        points = {"A": (0, 0), "B": (4, 0), "C": (0, 3)}
    transforms = [
        lambda x, y: (x - 2, y - 1),
        lambda x, y: (1 - y, x - 2),
        lambda x, y: (2 - x, 1 - y),
        lambda x, y: (y - 1, 2 - x),
    ]
    points = {k: transforms[(choice + mode) % 4](*v) for k, v in points.items()}
    edges = ["AB", "BC", "CA"] if len(points) == 3 else ["AB", "BC", "CD", "DA", "AC"]
    if mode == 3:
        edges = ["AB", "BC", "AD", "DE", "EC", "AC"]
    squares = {s: square_distance(points, s) for s in ("AB", "BC", "AC")}
    expected_squares = {
        0: (9, 16, 25),
        1: (16, 25, 9),
        2: (5, 20, 25),
        3: (9, 16, 25),
        4: (9, 13, 10),
    }[mode]
    if tuple(squares.values()) != expected_squares:
        raise ValueError("Grid measurements diverge from the pupil's named points")
    if mode == 3 and [square_distance(points, seg) for seg in ("AD", "DE", "EC")] != [
        4,
        16,
        25,
    ]:
        raise ValueError("Outer path sides do not match the printed map")
    intro = (
        "במערכת הצירים נתונות הנקודות "
        + ", ".join(math(f"{s}({x},{y})") for s, (x, y) in points.items())
        + ". כל משבצת היא יחידת אורך אחת."
    )
    if mode in (0, 3):
        if mode == 0:
            intro += " הקטע $AC$ הוא אלכסון המלבן $ABCD$."
        else:
            intro += " בוחנים מסלול ישיר מ־$A$ ל־$C$ ודרך עקיפה העוברת דרך $D$ ו־$E$."
        tasks = [
            item(
                "קראו מהצירים את האורכים $AB$ ו־$BC$.",
                "$AB=3$ ו־$BC=4$ יחידות אורך.",
                "אורכי שתי הצלעות",
            ),
            item(
                "חשבו את אורך האלכסון $AC$.",
                "$3·3+4·4=25$, ולכן $AC=5$ יחידות אורך.",
                "אורך האלכסון",
            ),
            item(
                "השוו בין המסלול על שפת המלבן דרך $B$ לבין המסלול הישיר.",
                "על השפה $7$ יחידות ובאלכסון $5$. נחסכות $2$ יחידות.",
                "השוואת המסלולים",
            ),
        ]
        if mode == 3:
            tasks[1] = item(
                "חשבו את אורך המסלול הישיר $AC$.",
                "$3·3+4·4=25$, ולכן אורך המסלול הישיר $5$ יחידות אורך.",
                "המסלול הישיר",
            )
            tasks[2] = item(
                "אם אורך כל משבצת ייצג שני מטרים, בכמה מטרים יתקצר המסלול הישיר לעומת המסלול דרך $D$ ו־$E$?",
                "בדרך העקיפה $2+4+5=11$ יחידות. ההפרש לעומת האלכסון הוא $6$ יחידות, כלומר $12$ מטרים.",
                "הפרש לאחר שינוי קנה המידה",
            )
    elif mode == 1:
        tasks = [
            item(
                "זהו את הקודקוד שבו נפגשים קטע אופקי וקטע אנכי.",
                "בנקודה $A$ נפגשים $AB$ ו־$AC$ בזווית ישרה.",
                "הזווית הישרה",
            ),
            item(
                "מה אורכי שני הניצבים לפי השיעורים?",
                "$AB=4$ ו־$AC=3$ יחידות אורך.",
                "אורכי הניצבים",
            ),
            item(
                "חשבו את אורך $BC$.",
                "$BC^2=4·4+3·3=25$, ולכן האורך $5$ יחידות אורך.",
                "אורך היתר",
            ),
        ]
    else:
        longest = max(squares, key=squares.get)
        others = [s for s in squares if s != longest]
        rhs = sum(squares[s] for s in others)
        right = rhs == squares[longest]
        angles = {"AB": "C", "BC": "A", "AC": "B"}
        tasks = [
            item(
                "כדי למצוא את ריבוע אורך $AB$, השתמשו בהפרשים האופקי והאנכי. מהו הריבוע?",
                math(f"AB^2={squares['AB']}") + ".",
                "ריבוע אורך צלע",
            ),
            item(
                "מצאו גם את ריבועי האורכים $BC$ ו־$AC$ בדרך זו.",
                math(f"BC^2={squares['BC']}")
                + " ו־"
                + math(f"AC^2={squares['AC']}")
                + ".",
                "שני ריבועי האורכים",
            ),
            item(
                "האם המשולש ישר־זווית? בססו את הקביעה על שלושת הריבועים.",
                ("כן, כי " if right else "לא, כי ")
                + math(
                    f"{squares[others[0]]}+{squares[others[1]]}"
                    + ("=" if right else r"\neq ")
                    + f"{squares[longest]}"
                )
                + (
                    ". הזווית הישרה ב־" + math(angles[longest]) + "."
                    if right
                    else ". תנאי המשפט ההפוך אינו מתקיים."
                ),
                "בדיקת המשפט ההפוך",
            ),
        ]
    return intro, tasks, points, edges, mode in (2, 4)


def build(lesson, data):
    validate_parameters(lesson, data)
    level = {
        "key": "b",
        "level": "רמה ב׳",
        "grade": "8",
        "title": "משפט פיתגורס",
        "rule": r"במשולש ישר־זווית היתר נמצא מול הזווית הישרה. אם הניצבים הם $a,b$ והיתר הוא $c$, אז $a^2+b^2=c^2$. למציאת ניצב מחסרים את ריבוע הניצב הידוע מריבוע היתר ומוציאים שורש. במשפט ההפוך בודקים אם ריבוע הצלע הארוכה שווה לסכום ריבועי שתי האחרות.",
        "curriculum": {"track": "ח", "topic": "pythagoras"},
        "figure_topic": True,
        "keep_questions": True,
        "words_share": {},
        "questions": [],
        "answers": [],
    }
    canon, evidence, used = [], [], {}
    for n, (family, ch) in enumerate(zip(LAYOUT, data["choices"]), 1):
        mode = used.get(family, 0)
        used[family] = mode + 1
        scale = 1 + mode % 2
        p, q, h = (scale * v for v in TRIPLES[(n + ch) % 4])
        if p * p + q * q != h * h:
            raise ValueError("Invalid Pythagorean triple")
        labels = {}
        star = n > 17
        if family == "words":
            intro, tasks, points, givens, labels, reverse = words_question(
                mode, p, q, h
            )
            fig = None
            level["words_share"][n] = "סרטוט לפי נתונים מילוליים"
        elif family == "grid":
            intro, tasks, points, edges, reverse = grid_question(mode, ch)
            fig = {"family": family, "points": points, "edges": edges}
            givens = []
        else:
            intro, tasks, points, givens, labels, reverse = triangle_question(
                family, mode, p, q, h, star
            )
            fig = {
                "family": family,
                "triple": [p, q, h],
                "labels": labels,
                "rotation": (0, 25, 90, 180)[(n - 1) % 4],
            }
        for lab, task in zip("אבג", tasks):
            task.update(
                label=lab,
                space=280 if family == "words" and lab == "ג" else 38 if star else 34,
            )
        row = {
            "n": n,
            "intro": intro,
            "items": tasks,
            "given": [intro, *givens],
            "to_prove": [],
            "star": star,
        }
        if fig:
            row["_pythagorasFigure"] = fig
        part = 0 if n <= 7 else 1 if n <= 17 else 2
        if n in (1, 8, 18):
            row["part"] = [TITLES[part], ("1–7", "8–17", "18–20")[part]]
        level["questions"].append(row)
        level["answers"].append([n, [[i["label"], i["answer"]] for i in tasks], star])
        ids = IDS[9:] if reverse else IDS[:9]
        canon.append(
            {
                "id": f"q{n}",
                "n": n,
                "section": TITLES[part],
                "intro": intro,
                "conceptIds": list(ids),
                "figure": fig,
                "items": tasks,
            }
        )
        squares = (
            {side: square_distance(points, side) for side in ("AB", "BC", "AC")}
            if points
            else {s: v * v for s, v in labels.items()}
        )
        evidence.append(
            {
                "itemId": f"q{n}",
                "family": family,
                "mode": mode,
                "triple": [p, q, h],
                "vertices": points,
                "sideSquares": squares,
                "printedLengths": labels,
                "converse": reverse,
            }
        )
    if len(set(v["intro"] for v in canon)) != len(canon):
        raise ValueError("Duplicate question givens")
    return level, canon, evidence


def compile_pythagoras(lesson, data, scope, skill, work):
    from native_geometry import compile_geometry
    from pythagoras_shape import render_pythagoras

    return compile_geometry(
        lesson,
        data,
        skill,
        work,
        build=build,
        render=render_pythagoras,
        figure_key="_pythagorasFigure",
        package="G8-T11",
        evidence_scope="exact printed lengths, coordinate squares and Pythagorean comparisons",
    )
