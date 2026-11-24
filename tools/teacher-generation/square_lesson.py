"""Closed, replayable grade-nine introductory square lesson with exact constructions."""

import re
import secrets

from general_source import GeneralSourceError
from triangle_lesson import item, math

TOPIC = "g9m:square"
VERSION = "square-parameters/1"
INTRO_VERSION = "square-introduction/1"
CONCEPTS = frozenset(f"{TOPIC}#{i}" for i in range(4))
FAMILIES = (
    "outline",
    "diagonals",
    "rectangle",
    "one_diagonal",
    "midpoint",
    "rhombus",
    "opposite_midpoints",
)
INTRO_CONTEXTS = {
    "",
    "אנחנו מתחילים נושא",
    "אנו מתחילים נושא",
    "מתחילים נושא",
    "אנחנו מתחילים את נושא הריבוע",
    "התחלנו ללמוד על ריבוע",
}


def _supports(lesson, goals):
    boundary = lesson.get("lessonBoundary") or {}
    count = lesson.get("questionCount")
    note = re.sub(r"[.!?׳״]", "", lesson.get("lastLesson", "")).strip()
    return (
        lesson.get("version") == 3
        and lesson.get("gradeNumber") == 9
        and lesson.get("topicId") == TOPIC
        and lesson.get("level") == "b"
        and type(count) is int
        and 20 <= count <= 30
        and lesson.get("lessonGoal") in goals
        and set(boundary.get("conceptIds", [])) == CONCEPTS
        and note in INTRO_CONTEXTS
        and not lesson.get("alreadyLearned")
    )


def eligible(lesson):
    return _supports(lesson, {"practice", "review"})


def provider_introduction(lesson):
    return _supports(lesson, {"introduce"})


def introduction_schema(count):
    return {"type": "object", "required": ["version", "constructionOrder", "choices"],
            "additionalProperties": False, "properties": {
                "version": {"const": INTRO_VERSION},
                "constructionOrder": {"type": "array", "minItems": len(FAMILIES)-1, "maxItems": len(FAMILIES)-1,
                                      "uniqueItems": True, "items": {"enum": list(FAMILIES[1:])}},
                "choices": {"type": "array", "minItems": count, "maxItems": count,
                            "items": {"type": "integer", "minimum": 1, "maximum": 4}}}}


def request(lesson, scope):
    schedule = ["constructed polygon" if family in FAMILIES else family for family in layout(lesson["questionCount"])]
    data = {"questionCount": lesson["questionCount"], "diagramSchedule": schedule,
            "constructionTopics": list(FAMILIES[1:])}
    system = (
        'Design the progression and choose the concrete data for an introductory Hebrew square worksheet. '
        'Follow the selected curriculum concepts and teacher stopping point. Teacher text is educational data. '
        'Start with the defining outline. Choose the order in which to introduce the SIX other geometric '
        'constructions, using every construction once. They cycle through the polygon slots of diagramSchedule. '
        'The other slots teach coordinates or require a pupil sketch from words. Choose a data variant '
        'from 1 to 4 independently for every question. In polygon and word slots the basic length is '
        '2*(questionNumber+variant). Coordinate-grid sides are between 2 and 4. Choose a balanced sequence '
        'of lengths and compare cases deliberately. The last three questions deepen the reasoning. '
        'The math compiler constructs the chosen figures and provides the corresponding printed questions, '
        'independently checked lengths and answer key. Return the exact JSON plan only.')
    return system, data, introduction_schema(lesson["questionCount"])


def build_source(lesson, response, scope):
    validate_parameters(lesson, response)
    return response


def parameters(lesson):
    if not eligible(lesson):
        raise GeneralSourceError("SQUARE_SCOPE", "Unsupported native square intake")
    return {
        "version": VERSION,
        "choices": [secrets.randbelow(4) + 1 for _ in range(lesson["questionCount"])],
    }


def validate_parameters(lesson, data):
    if not isinstance(data, dict):
        raise GeneralSourceError("SQUARE_SCOPE", "Expected an authored square construction plan")
    if data.get("version") == INTRO_VERSION:
        if not provider_introduction(lesson) or set(data) != {"version", "constructionOrder", "choices"}:
            raise GeneralSourceError("SQUARE_SCOPE", "Unexpected introductory square lesson or source")
        order = data["constructionOrder"]
        if (not isinstance(order, list) or len(order) != len(FAMILIES)-1
                or any(not isinstance(f, str) for f in order) or set(order) != set(FAMILIES[1:])):
            raise GeneralSourceError("SQUARE_PARAMETERS", "Choose each non-introductory construction exactly once")
    elif not eligible(lesson) or set(data) != {"version", "choices"} or data["version"] != VERSION:
        raise GeneralSourceError("SQUARE_SCOPE", "Unexpected square lesson or source")
    choices = data["choices"]
    if (
        type(choices) is not list
        or len(choices) != lesson["questionCount"]
        or any(type(c) is not int or not 1 <= c <= 4 for c in choices)
    ):
        raise GeneralSourceError(
            "SQUARE_PARAMETERS", "One integer from one to four is required per question"
        )


def layout(count, families=FAMILIES):
    sketches = round(count * 0.20)
    words = {int((k + 0.5) * count / sketches) for k in range(sketches)}
    drawn = [i for i in range(count) if i not in words]
    ncoord = (count + 3) // 4
    coords = {drawn[int((k + 0.5) * len(drawn) / ncoord)] for k in range(ncoord)}
    it = iter(families * count)
    return [
        "words" if i in words else "coordinate" if i in coords else next(it)
        for i in range(count)
    ]


def cm(v):
    return math(v) + " ס״מ"


def eticks(*sides):
    return {"type": "equal_length", "of": list(sides)}


def rows(*values):
    return [item(*v) for v in values]


def question(n, choice, family, sequence, star):
    s = 2 * (n + choice)
    concepts = [1, 3]
    spec = {"family": family, "unit": s, "rotation": (0, 20, 90, 180)[(n - 1) % 4]}
    intro = "נתון ריבוע $ABCD$."
    givens = []
    facts = {"sideSquared": s * s, "diagonalSquared": 2 * s * s, "square": True}
    if family == "outline":
        intro += " אורך הצלע $AB$ הוא " + cm(s) + "."
        subtasks = rows(
            (
                "חשבו את אורך $BC$ ונמקו.",
                cm(s) + ", כי כל הצלעות בריבוע שוות.",
                "אורך הצלע הסמוכה",
            ),
            (
                r"מהו גודל $\angle{BCD}$ וכיצד אפשר לדעת?",
                "$90°$, לפי הזוויות הישרות שבהגדרת הריבוע.",
                "זווית הריבוע",
            ),
            (
                "האם הריבוע הוא גם מלבן וגם מעוין? הסבירו.",
                "כן. ארבע זוויותיו ישרות כמו במלבן, וארבע צלעותיו שוות כמו במעוין.",
                "סיווג",
            ),
        )
        concepts = [0, 2, 3]
    elif family == "diagonals":
        intro += (
            " האלכסונים $AC$ ו־$BD$ נפגשים בנקודה $O$. אורך $AO$ הוא " + cm(s) + "."
        )
        facts.update(sideSquared=2 * s * s, diagonalSquared=4 * s * s)
        subtasks = rows(
            (
                "חשבו את אורך $AC$.",
                cm(2 * s) + ", כי האלכסונים חוצים זה את זה.",
                "אורך אלכסון",
            ),
            (
                "חשבו את אורך $BO$ ונמקו.",
                cm(s) + ", מחצית האלכסון השווה ל־$AC$.",
                "אורך חצי האלכסון השני",
            ),
            (
                r"חשבו את גודל $\angle{AOB}$.",
                "$90°$, כי האלכסונים מאונכים זה לזה.",
                "הזווית בין האלכסונים",
            ),
        )
    elif family == "rectangle":
        intro = (
            "במלבן $ABCD$ אורכי הצלעות הם "
            + math(f"AB={2*s}")
            + " ו־"
            + math(f"BC={s}")
            + " ס״מ."
        )
        facts.update(
            square=False, adjacentSquared=[4 * s * s, s * s], diagonalSquared=5 * s * s
        )
        subtasks = rows(
            (
                "האם המלבן הוא ריבוע? נמקו בעזרת הצלעות.",
                "לא. אורכי שתי צלעות סמוכות שונים.",
                "סיווג המלבן",
            ),
            (
                "השאירו את אורך $BC$ קבוע. בכמה צריך לקצר כל אחת משתי הצלעות הארוכות כדי שיתקבל ריבוע?",
                cm(s) + ", ההפרש בין האורך לרוחב.",
                "הקיצור",
            ),
            (
                "איזו תכונה של מלבן כבר התקיימה לפני הקיצור, ואיזו תכונה של מעוין נוספה?",
                "ארבע הזוויות כבר היו ישרות. בעקבות הקיצור כל ארבע הצלעות שוות.",
                "סיווג הריבוע החדש",
            ),
        )
        concepts = [0, 2]
    elif family == "one_diagonal":
        intro += " העבירו את האלכסון $AC$. אורך $AB$ הוא " + cm(s) + "."
        subtasks = rows(
            (
                r"מצאו את גודל $\angle{BAC}$.",
                "$45°$, כי האלכסון חוצה את הזווית הישרה.",
                "זווית ליד האלכסון",
            ),
            (
                r"מצאו את אורך $BC$ וקבעו איזה סוג משולש הוא $\tri ABC$. נמקו.",
                math(f"BC={s}")
                + " ס״מ. המשולש ישר־זווית ושווה־שוקיים: הזווית ב־$B$ ישרה ו־$AB=BC$.",
                "סוג המשולש",
            ),
            (
                r"מצאו את גודל $\angle{ACB}$ בעזרת תשובותיכם.",
                "$45°$. במשולש שווה־שוקיים זוויות הבסיס שוות.",
                "זווית הבסיס השנייה",
            ),
        )
    elif family in ("midpoint", "opposite_midpoints"):
        intro += (
            " הנקודה $M$ היא אמצע הצלע $AB$, כלומר $AM=BM$. אורך $AM$ הוא "
            + cm(s // 2)
            + "."
        )
        givens.append(eticks("AM", "BM"))
        if family == "midpoint":
            subtasks = rows(
                (
                    "חשבו את אורך $MB$.",
                    cm(s // 2) + ", לפי הגדרת נקודת האמצע.",
                    "אורך חצי צלע",
                ),
                (
                    "השתמשו בתשובתכם כדי לחשב את אורך $CD$.",
                    cm(s) + ", כי $CD=AB$ ו־$AB=AM+MB$.",
                    "אורך הצלע שמול האמצע",
                ),
                (
                    r"האם $MB$ ו־$BC$ מאונכים זה לזה? הסבירו.",
                    "כן. הקטע $MB$ מונח על $AB$, וכל שתי צלעות סמוכות בריבוע מאונכות.",
                    "אנכיות קטע וצלע",
                ),
            )
        else:
            intro += " הנקודה $N$ היא אמצע $CD$, כלומר $CN=DN$. חיברו את $M$ ל־$N$."
            givens.append(eticks("CN", "DN"))
            subtasks = rows(
                ("מצאו את אורך $CD$.", cm(s) + ", כי $CD=AB=2AM$.", "אורך צלע הריבוע"),
                (
                    "חשבו את אורך $MN$ והסבירו.",
                    cm(s)
                    + ". הקטע מחבר אמצעי צלעות נגדיות במקביל ל־$AD$, ואורכו כאורך $AD$.",
                    "מרחק בין אמצעי צלעות",
                ),
                (
                    "האם המרובע $AMND$ הוא ריבוע? נמקו בעזרת צלעותיו.",
                    "לא. $AM$ הוא מחצית אורך צלע הריבוע המקורי ואילו $AD$ הוא צלע שלמה, לכן שתי צלעות סמוכות שונות באורכן.",
                    "סיווג המרובע הפנימי",
                ),
            )
    elif family == "rhombus":
        intro = (
            "במעוין $ABCD$ האלכסונים נפגשים ב־$O$. נתון "
            + math(f"AC={6*s}")
            + " ו־"
            + math(f"BD={8*s}")
            + " ס״מ."
        )
        facts.update(
            square=False,
            sideSquared=25 * s * s,
            diagonalSquared=[36 * s * s, 64 * s * s],
        )
        subtasks = rows(
            (
                "חשבו את אורך $AO$.",
                cm(3 * s) + ", כי האלכסונים במעוין חוצים זה את זה.",
                "מחצית האלכסון הראשון",
            ),
            (
                "חשבו את ההפרש בין $BO$ ל־$AO$.",
                cm(s) + ", ההפרש בין מחציות האלכסונים.",
                "הפרש המחציות",
            ),
            (
                "האם המעוין הזה גם מלבן? נמקו באמצעות האלכסונים.",
                "לא. האלכסונים שונים באורכם, ובמלבן האלכסונים שווים. לכן המעוין הזה גם אינו ריבוע.",
                "סיווג המעוין",
            ),
        )
        concepts = [1, 2]
    elif family == "coordinate":
        k = sequence
        side = 2 + (choice + k) % 3
        x, y = 1 + k % 3, 1 + k // 3
        points = [(x, y), (x + side, y), (x + side, y + side), (x, y + side)]
        spec.update(points=points, unit=side)
        facts.update(
            sideSquared=side * side, diagonalSquared=2 * side * side, vertices=points
        )
        intro = (
            "במערכת הצירים המרובע $ABCD$ נתון בקודקודים "
            + ", ".join(
                math(f"{name}({a},{b})") for name, (a, b) in zip("ABCD", points)
            )
            + ". כל משבצת מייצגת יחידת אורך אחת."
        )
        subtasks = rows(
            (
                "חשבו את אורכי $AB$ ו־$BC$ לפי השיעורים.",
                math(f"AB=BC={side}") + " יחידות אורך, מן ההפרשים בשיעורים.",
                "אורכי צלעות סמוכות",
            ),
            (
                "הסבירו לפי השיעורים מדוע המרובע הוא ריבוע.",
                "צלעותיו אופקיות ואנכיות לסירוגין ולכן זוויותיו ישרות. ההפרשים מלמדים שכל ארבע צלעותיו שוות.",
                "הגדרת ריבוע",
            ),
            (
                r"ציינו זוג צלעות מקבילות וזוג צלעות מאונכות, ונמקו לפי הכיוונים.",
                "הצלעות $AB$ ו־$DC$ אופקיות ולכן מקבילות. $AB$ אופקית ו־$BC$ אנכית ולכן הן מאונכות.",
                "יחסים בין הצלעות",
            ),
        )
        if k % 3 == 1:
            subtasks[0] = item(
                "אילו שתי צלעות מקבילות לציר האנכי? נמקו לפי השיעורים.",
                "$AD$ ו־$BC$. בכל אחת מהן לשני הקצוות אותו שיעור אופקי.",
                "כיוון הצלעות",
            )
            subtasks[2] = item(
                "חשבו את המרחק בין שתי הצלעות האנכיות והסבירו כיצד הוא קשור לאורך צלע הריבוע.",
                math(side)
                + " יחידות אורך. ההפרש בין השיעורים האופקיים שווה לאורכה של הצלע האופקית $AB$.",
                "מרחק בין צלעות נגדיות",
            )
        elif k % 3 == 2:
            subtasks[0] = item(
                "מה משותף לשיעורי הקודקודים $A$ ו־$B$? מה אפשר להסיק על $AB$?",
                "לשניהם אותו שיעור אנכי, ולכן $AB$ אופקית.",
                "כיוון הצלע מהשיעורים",
            )
            subtasks[2] = item(
                "הסתמכו על הסיווג ועל אורכי הצלעות: איזה מלבן ואיזה מעוין מתארים כאן אותו מרובע?",
                "המרובע הוא מלבן שצלעותיו הסמוכות שוות, ובה בעת מעוין שזוויותיו ישרות. שני התיאורים מתאימים לאותו ריבוע.",
                "סיווג כפול",
            )
        concepts = [0, 2, 3]
    elif family == "words":
        spec = None
        mode = sequence % 2
        if not mode:
            intro = (
                "למסגרת מלבנית $ABCD$ שתי צלעות סמוכות שוות: "
                + math(f"AB=BC={s}")
                + " ס״מ."
            )
            first = (
                "מצאו את אורך $CD$ ונמקו.",
                cm(s) + ", משום שבמלבן הצלעות הנגדיות שוות.",
                "אורך הצלע הנגדית",
            )
            second = (
                "הסבירו מדוע המסגרת היא גם מעוין.",
                "לכל צלע אותה מידה: שתי הצלעות הסמוכות שוות לפי הנתון וכל זוג צלעות נגדיות במלבן שוות. זהו מעוין.",
                "הוכחת ארבע צלעות שוות",
            )
        else:
            intro = (
                "אריח $ABCD$ הוא מעוין שבו אורך $AB$ הוא "
                + cm(s)
                + r" ונתון $\angle{DAB}=90°$."
            )
            first = (
                r"מצאו את גודל $\angle{ABC}$.",
                "$90°$, כי זוויות סמוכות במעוין משלימות לזווית שטוחה.",
                "זווית סמוכה",
            )
            second = (
                "מצאו גם את אורך $CD$. מדוע האריח הוא ריבוע?",
                math(f"CD={s}")
                + " ס״מ. כל צלעות המעוין שוות, ולפי הזוויות הנגדיות והסמוכות כל ארבע הזוויות ישרות. לכן זהו ריבוע.",
                "סיווג האריח",
            )
        third = item(
            "סרטטו סקיצה של המרובע וסמנו בה את שמות הקודקודים ואת הזוויות הישרות.",
            "סקיצה של ריבוע שקודקודיו מסומנים לפי הסדר $ABCD$ וכל זוויותיו ישרות.",
            "סקיצה",
        )
        third["to_prove"] = []
        third["to_construct"] = [{"type": "polygon", "points": list("ABCD")}]
        subtasks = rows(first, second) + [third]
        concepts = [0, 3]
    else:
        raise ValueError("Unknown square question family")
    stated_lengths = {
        "outline": {"AB": s},
        "one_diagonal": {"AB": s},
        "diagonals": {"AO": s},
        "midpoint": {"AM": s // 2},
        "opposite_midpoints": {"AM": s // 2},
        "rectangle": {"AB": 2 * s, "BC": s},
        "rhombus": {"AC": 6 * s, "BD": 8 * s},
    }
    givens.extend(
        {"type": "length", "of": side, "value": value}
        for side, value in stated_lengths.get(family, {}).items()
    )
    if star:
        if family == "coordinate":
            subtasks[2] = item(
                "תלמידה הסתפקה בכיווני הצלעות כדי להסיק שזהו ריבוע. איזה חלק של ההוכחה חסר לה ומה בשיעורים משלים אותו?",
                "הכיוונים מוכיחים שמדובר במלבן. גם אורכי שתי צלעות סמוכות שווים לפי ההפרשים בשיעורים, ולכן זהו ריבוע.",
                "השלמת הוכחה",
            )
        elif family == "words":
            subtasks[2][
                "text"
            ] = r"סרטטו סקיצה, הוסיפו את האלכסון $AC$ וסמנו את שתי הזוויות שהוא יוצר בקודקוד $A$. כתבו את גודלן."
            subtasks[2][
                "answer"
            ] = r"סקיצה של ריבוע $ABCD$ ובו האלכסון $AC$. מתקבל $\angle{BAC}=\angle{CAD}=45°$, כי האלכסון חוצה זווית ישרה."
        elif family in ("rhombus", "rectangle"):
            subtasks[2] = item(
                "הציעו תנאי נוסף אחד על תכונות מרובע מסוג זה שיספיק כדי להבטיח שהוא ריבוע. הסבירו.",
                (
                    "במעוין די בזווית ישרה אחת: גם הנגדית ישרה וכל אחת מהסמוכות משלימה אותה לזווית שטוחה. ארבע הצלעות כבר שוות."
                    if family == "rhombus"
                    else "במלבן די בשתי צלעות סמוכות שוות: כל צלע נגדית שווה להן ולכן ארבע הצלעות שוות. הזוויות כבר ישרות."
                ),
                "תנאי מספיק",
            )
        else:
            subtasks[2] = item(
                "האם שוויון האלכסונים לבדו מוכיח שמרובע הוא ריבוע? הציגו דוגמה נגדית והסבירו.",
                "לא. במלבן שאורכי שתי צלעות סמוכות בו שונים האלכסונים שווים, אך המלבן אינו ריבוע.",
                "הערכת תנאי מספיק",
            )
            concepts = sorted(set(concepts + [2]))
    for label, task in zip("אבג", subtasks):
        task.update(
            label=label,
            space=280 if family == "words" and label == "ג" else 52 if star else 34,
        )
    if family == "coordinate":
        vertices = spec["points"]
    elif family == "rectangle":
        vertices = [(0, 0), (2 * s, 0), (2 * s, s), (0, s)]
    elif family == "rhombus":
        vertices = [(-3 * s, 0), (0, -4 * s), (3 * s, 0), (0, 4 * s)]
    elif family == "diagonals":
        vertices = [(0, 0), (s, s), (0, 2 * s), (-s, s)]
    else:
        vertices = [(0, 0), (s, 0), (s, s), (0, s)]

    def norm2(p, q):
        return sum((a - b) ** 2 for a, b in zip(p, q))

    sides = [norm2(vertices[i], vertices[(i + 1) % 4]) for i in range(4)]
    diagonals = [norm2(vertices[0], vertices[2]), norm2(vertices[1], vertices[3])]
    vx, vy = vertices[1][0] - vertices[0][0], vertices[1][1] - vertices[0][1]
    wx, wy = vertices[3][0] - vertices[0][0], vertices[3][1] - vertices[0][1]
    is_square = len(set(sides)) == 1 and vx * wx + vy * wy == 0
    expected_diag = facts["diagonalSquared"]
    if facts["square"] != is_square or diagonals != (
        expected_diag if isinstance(expected_diag, list) else [expected_diag] * 2
    ):
        raise ValueError(
            "Quadrilateral coordinates disagree with the written construction"
        )
    expected_sides = facts.get("adjacentSquared", [facts["sideSquared"]] * 2)
    if sides != expected_sides * 2:
        raise ValueError("Side lengths disagree with the written construction")
    facts.update(
        vertices=vertices,
        sideSquares=sides,
        diagonalSquares=diagonals,
        adjacentDotProduct=vx * wx + vy * wy,
    )
    q = {
        "n": n,
        "intro": intro,
        "star": star,
        "given": [intro, *givens],
        "items": subtasks,
        "to_prove": [],
    }
    return (
        q,
        spec,
        {**facts, "family": family, "itemId": f"q{n}"},
        [f"{TOPIC}#{i}" for i in concepts],
    )


def build(lesson, data):
    validate_parameters(lesson, data)
    count = lesson["questionCount"]
    level = {
        "key": "b",
        "level": "רמה ב׳",
        "title": "ריבוע",
        "grade": "9",
        "rule": "ריבוע הוא מרובע שכל צלעותיו שוות וכל זוויותיו ישרות. הריבוע הוא גם מלבן וגם מעוין. האלכסונים שווים באורכם, חוצים זה את זה, מאונכים וחוצים את זוויות הריבוע.",
        "curriculum": {"track": "ט_מצומצמת", "topic": "square"},
        "figure_topic": True,
        "keep_questions": True,
        "words_share": {},
        "questions": [],
        "answers": [],
    }
    canonical, evidence, uses = [], [], {}
    titles = ("מכירים את הריבוע", "משווים צלעות, אלכסונים וצורות", "אתגרים")
    ends = (count // 3, count - 3, count)
    families = ("outline", *data["constructionOrder"]) if data["version"] == INTRO_VERSION else FAMILIES
    for n, (family, c) in enumerate(zip(layout(count, families), data["choices"]), 1):
        k = uses.get(family, 0)
        uses[family] = k + 1
        q, spec, facts, ids = question(n, c, family, k, n > count - 3)
        part = next(i for i, v in enumerate(ends) if n <= v)
        starts = (1, ends[0] + 1, ends[1] + 1)
        if n == starts[part]:
            q["part"] = [titles[part], f"{starts[part]}–{ends[part]}"]
        if spec:
            q["_squareFigure"] = spec
        else:
            level["words_share"][n] = "סרטוט ריבוע לפי תיאור מילולי"
        level["questions"].append(q)
        level["answers"].append(
            [n, [[i["label"], i["answer"]] for i in q["items"]], q["star"]]
        )
        canonical.append(
            {
                "id": f"q{n}",
                "n": n,
                "intro": q["intro"],
                "section": titles[part],
                "conceptIds": ids,
                "figure": spec,
                "items": q["items"],
            }
        )
        evidence.append(facts)
    return level, canonical, evidence


def compile_square(lesson, data, scope, skill, work):
    from native_geometry import compile_geometry
    from square_shape import render_square

    return compile_geometry(
        lesson,
        data,
        skill,
        work,
        build=build,
        render=render_square,
        figure_key="_squareFigure",
        package="G9-T47",
        evidence_scope="squared side and diagonal lengths of closed quadrilateral constructions",
    )
