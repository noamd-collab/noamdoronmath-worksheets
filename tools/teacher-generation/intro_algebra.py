"""Bounded Qwen authoring for introductory linear equations and percentages.

Qwen selects question activities, settings, and three independent operand
variants per row. The compiler owns Hebrew wording, mathematical structure and
the answer key. Other classroom boundaries continue through general authoring.
"""

import re
from fractions import Fraction

from compact_authoring import expression, spans
from general_source import GeneralSourceError
from math_tasks import number
from printed_percentages import _plain

EQ, PCT = "g7:equations", "g8:percentages"
VERSION = "intro-algebra/1"
CONCEPTS = {EQ: {f"{EQ}#{i}" for i in range(4)}, PCT: {f"{PCT}#0"}}
COMMON = set(
    "אנו אנחנו הכיתה בכיתה כעת היום בשיעור את מהי מהו מהם איך וכיצד ללמוד לומדים מתחילים מתחילות מתחילה מתחיל התחלנו בהיכרות הכרת הכירו נושא הנושא חדש חדשה עם של".split()
)
VOCAB = {
    EQ: set(
        "משוואה משוואות המשוואה המשוואות במשוואות ופתרון פתרון לפתור פותרים ופותרים ממעלה המעלה ראשונה הראשונה".split()
    ),
    PCT: set("אחוז האחוז אחוזים האחוזים באחוזים משמעות המשמעות כחלק חלק מתוך מאה ממאה".split()),
}


def compatible(lesson):
    topic = lesson.get("topicId")
    if topic not in CONCEPTS:
        return False
    note = lesson.get("lastLesson")
    if not isinstance(note, str) or re.search(r"[^א-ת\s.,!?״׳']", note):
        return False
    tokens = set(re.findall(r"[א-ת]+", note))
    introductory = {"מתחילים", "מתחילות", "מתחילה", "מתחיל", "התחלנו", "בהיכרות"}
    count = lesson.get("questionCount")
    return (
        lesson.get("version") == 3
        and lesson.get("gradeNumber") == (7 if topic == EQ else 8)
        and lesson.get("level") == "b"
        and lesson.get("lessonGoal") == "introduce"
        and type(count) is int
        and 20 <= count <= 30
        and not lesson.get("alreadyLearned")
        and bool(tokens & introductory)
        and tokens <= COMMON | VOCAB[topic]
        and set(lesson.get("lessonBoundary", {}).get("conceptIds", ())) == CONCEPTS[topic]
    )


# First meet the unknown/percentage, then vary its position, representation and
# context. The final three rows have their own reasoning activities at every length.
EQ_STAGES = (
    ("add", "one_step_right"),
    ("subtract", "add"),
    ("scale", "divide"),
    ("subtract", "missing_part"),
    ("divide", "scale"),
    ("bank", "one_step_right"),
    ("right_sum", "right_difference"),
    ("missing_part", "balance"),
    ("two_step", "undo_two"),
    ("purchase", "equal_groups"),
    ("grouped", "right_sum"),
    ("bank", "balance"),
    ("right_difference", "undo_two"),
    ("grouped", "equal_groups"),
    ("purchase", "two_step"),
    ("balance", "one_step_right"),
    ("undo_two", "grouped"),
)
EQ_END = (("error_add", "error_divide"), ("budget", "trip"), ("same_unknown", "equivalent"))
PCT_STAGES = (
    ("hundred", "marks"),
    ("rate100", "hundred"),
    ("missing100", "marks"),
    ("part", "pieces"),
    ("survey", "part"),
    ("rate", "rate100"),
    ("pieces", "part"),
    ("missing_count", "remaining"),
    ("rate", "survey"),
    ("remaining", "missing_count"),
    ("fraction_part", "part"),
    ("rate", "survey"),
    ("recover", "pieces"),
    ("rest_rate", "missing100"),
    ("gain", "remaining"),
    ("recover", "fraction_part"),
    ("rate", "missing_count"),
)
PCT_END = (("correct_amount", "correct_rate"), ("recover", "recover_remaining"), ("gap", "goal"))


# A teacher explicitly stopping at the meaning of "out of one hundred" has
# not requested reverse percentages or percentage change on arbitrary bases.
HUNDRED_STAGES = (
    ("hundred", "marks"),
    ("rate100", "marks"),
    ("hundred", "rate100"),
    ("pieces", "part"),
    ("survey", "rate100"),
    ("marks", "pieces"),
    ("groups10", "rate"),
    ("missing100", "rest_rate"),
    ("survey", "groups10"),
    ("remaining", "missing100"),
    ("fraction_part", "rate100"),
    ("groups10", "rate"),
    ("rest_rate", "missing_count"),
    ("fraction_part", "pieces"),
    ("remaining", "rest_rate"),
    ("missing_count", "rest_rate"),
    ("groups10", "fraction_part"),
)
HUNDRED_END = (
    ("correct_amount", "correct_rate"),
    ("marked_from_rest", "unmarked_rate"),
    ("gap", "goal"),
)


def out_of_hundred(lesson):
    return lesson["topicId"] == PCT and bool(re.search(r"(?<![א-ת])מ?מאה(?![א-ת])", lesson["lastLesson"]))


def activities(lesson):
    count = lesson["questionCount"]
    if lesson["topicId"] == EQ:
        regular, final = EQ_STAGES, EQ_END
    elif out_of_hundred(lesson):
        regular, final = HUNDRED_STAGES, HUNDRED_END
    else:
        regular, final = PCT_STAGES, PCT_END
    extra = count - len(regular) - len(final)
    consolidation = regular[7:]
    return list(regular) + [consolidation[i % len(consolidation)] for i in range(extra)] + list(final)


def _check_scope(lesson, scope):
    selected = {entry["id"] for entry in scope["selectedConcepts"]}
    if (
        not compatible(lesson)
        or selected != CONCEPTS.get(lesson.get("topicId"))
        or scope["topic"]["topicId"] != lesson["topicId"]
        or scope["topic"]["gradeNumber"] != lesson["gradeNumber"]
    ):
        raise GeneralSourceError("INTRO_SCOPE", "The structured introduction does not cover this lesson")


def request(lesson, scope):
    _check_scope(lesson, scope)
    count = lesson["questionCount"]
    integer = lambda low, high: {"type": "integer", "minimum": low, "maximum": high}
    row = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "activity": integer(1, 2),
            "setting": integer(1, 4),
            "operands": {"type": "array", "minItems": 3, "maxItems": 3, "items": integer(1, 4)},
        },
        "required": ["activity", "setting", "operands"],
    }
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["version", "questions"],
        "properties": {
            "version": {"const": VERSION},
            "questions": {"type": "array", "minItems": count, "maxItems": count, "items": row},
        },
    }
    user = {
        "topic": scope["topic"]["title"],
        "stoppingPoint": lesson["lastLesson"],
        "selectedConcepts": scope["selectedConcepts"],
        "minutes": lesson["minutes"],
        "activities": activities(lesson),
        "settings": (
            ["first number range", "second number range", "third number range", "fourth number range"]
            if lesson["topicId"] == EQ
            else list(THEMES)
        ),
        "operandChoices": "1 to 4 select successively larger positive number options within each subitem.",
    }
    guidance = (
        "Author a gradual introductory Hebrew lesson through the supplied numeric planning contract. "
        "For each row choose activity 1 or 2 from its ordered pair and one of four settings. "
        "Choose each of the three operand indices deliberately within 1..4. Start with smaller numbers, "
        "vary representations and values, and use the last three rows for corrective, reverse and transfer tasks. "
        "The compiler writes and checks each Hebrew task from your choices. Return only the version and questions."
    )
    return guidance, user, schema


EQ_INTROS = {
    "add": "מצאו איזה מספר יש להוסיף כדי שהשוויון יתקיים.",
    "one_step_right": "הנעלם מופיע מימין לסימן השוויון. מצאו את ערכו.",
    "subtract": "איזה מספר היה בתחילה, לפני החיסור?",
    "scale": "מצאו איזה מספר הוכפל במקדם הנתון.",
    "divide": "מצאו מה היה המספר לפני שחילקו אותו.",
    "missing_part": "השלימו את ערכו של המחסר כך שההפרש יתאים.",
    "right_sum": "חשבו את הסכום שבאגף אחד, ובעזרתו מצאו את הנעלם שבאגף האחר.",
    "right_difference": "מצאו את הנעלם בעזרת ההפרש שבאגף האחר.",
    "balance": "בשני אגפי המשוואה יש תרגילים. מצאו את הערך שמאזן ביניהם.",
    "two_step": "פתרו משוואות שבהן כופלים את הנעלם ואחר כך מוסיפים מספר.",
    "undo_two": "איזה מספר הוכפל ואחר כך הוקטן במספר הנתון?",
    "grouped": "הסוגריים מראים מה נעשה קודם. מצאו את המספר שבסוגריים המיוצג באות.",
    "purchase": "בכל קנייה רכשו כמה מחברות באותו מחיר ושילמו גם על משלוח. המשוואה מתארת את הסכום הכולל בשקלים. מצאו את מחירה של מחברת אחת.",
    "equal_groups": "בכל סעיף ארזו מספר שווה של עפרונות בכל קופסה והוסיפו עפרונות בודדים. המשוואה מתארת את סך העפרונות. מצאו כמה עפרונות היו בכל קופסה.",
    "error_add": "תלמיד הציע להוסיף לשני האגפים את המספר שכבר נוסף לנעלם, וטען שכך יבודד אותו. בחרו בפעולה ההפוכה וכתבו את הערך הנכון של הנעלם בכל סעיף.",
    "error_divide": "תלמיד כפל שוב במקדם כדי לבטל את הכפל בנעלם. השתמשו בפעולה ההפוכה המתאימה ומצאו את הפתרון הנכון.",
    "budget": "נשאר סכום קבוע לאחר רכישת כמה כרטיסים שווי מחיר. בכל משוואה מופיעים התקציב ההתחלתי והיתרה. חשבו את מחירו של כרטיס אחד בשקלים.",
    "trip": "מחיר נסיעה כולל תשלום קבוע ותשלום אחיד לכל קילומטר. בכל משוואה מופיעים מספר הקילומטרים והמחיר הכולל. מצאו את המחיר לקילומטר בשקלים.",
    "same_unknown": "אותו מספר מופיע בשני אגפי המשוואה. מצאו אותו כך ששני האגפים יהיו שווים.",
    "equivalent": "פשטו את אגף הסכום או את אגף המכפלה, ומצאו את ערך הנעלם שמקיים את שתי ההצגות.",
}


def eq_values(row, j, choice, setting, activity):
    # The three solution intervals in each row are disjoint even if all model
    # indices coincide. Their order changes between rows and settings.
    bucket = (j + row + setting) % 3
    x = 2 + 4 * bucket + (choice - 1) + (row % 4) + (setting - 1)
    a = 2 + (row + j + choice + setting) % 7
    k = 2 + (row + 2 * j + choice + setting) % 4
    if activity in ("subtract", "undo_two"):
        a = min(a, x - 1)
    if activity == "divide":
        x *= k
    return x, a, k


def equation(activity, x, a, k):
    add = f"x+{a}", str(x + a)
    forms = {
        "add": add,
        "bank": add,
        "error_add": add,
        "one_step_right": (str(x + a), f"{a}+x"),
        "subtract": (f"x-{a}", str(x - a)),
        "scale": (f"{k}*x", str(k * x)),
        "error_divide": (f"{k}*x", str(k * x)),
        "divide": (f"x/{k}", str(x // k)),
        "missing_part": (f"{x+a}-x", str(a)),
        "right_sum": (f"x+{a}", f"{x+a-1}+1"),
        "right_difference": (f"x+{a}", f"{x+2*a}-{a}"),
        "balance": (f"{x+a+1}-{a}", "x+1"),
        "two_step": (f"{k}*x+{a}", str(k * x + a)),
        "undo_two": (f"{k}*x-{a}", str(k * x - a)),
        "grouped": (f"{k}*(x+{a})", str(k * (x + a))),
        "purchase": (f"{k}*x+{a}", str(k * x + a)),
        "equal_groups": (f"{k}*x+{a}", str(k * x + a)),
        "trip": (f"{a}+{k}*x", str(a + k * x)),
        "budget": (f"{k*x+a}-{k}*x", str(a)),
        "same_unknown": (f"{k+1}*x+{a}", f"{k}*x+{x+a}"),
        "equivalent": (f"{k}*(x+{a})", f"{k}*{x+a-1}+{k}"),
    }
    return forms[activity]


def equation_row(activity, row, setting, choices):
    values = [eq_values(row, j, pick, setting, activity) for j, pick in enumerate(choices)]
    if activity == "bank":
        ordered = [v[0] for v in (values[2], values[0], values[1])]
        intro = [{"kind": "text", "text": "התאימו לכל משוואה את הפתרון הנכון מתוך הרשימה: "}]
        for i, x in enumerate(ordered):
            if i:
                intro.append({"kind": "text", "text": ", "})
            intro.append({"kind": "math", "expression": number(x)})
    else:
        intro = spans(EQ_INTROS[activity], 7)
    items = []
    for x, a, k in values:
        lhs, rhs = equation(activity, x, a, k)
        task = {"kind": "solve", "variable": "x", "lhs": expression(lhs, 7), "rhs": expression(rhs, 7)}
        prompt = [{"kind": "formula", "notation": lhs + "=" + rhs}]
        items.append({"prompt": prompt, "answer": {"kind": "computed", "task": task, "unit": ""}})
    return intro, items


THEMES = ("ספרים", "כרטיסים", "בקבוקים", "משחקים")
# Every template names its requested quantity and its unit. The verifier parses
# the literal pupil sentence using the same closed grammar before accepting a key.
PCT_FORMS = {
    "hundred": "מתוך מאה {unit}, {p}% סומנו. כמה {unit} סומנו?",
    "groups10": "מאה {unit} חולקו לעשר קבוצות שוות. נבחרו {g} קבוצות שלמות. כמה אחוזים מהפריטים נבחרו?",
    "marked_from_rest": "ברשימה מאה {unit}. אחרי הבדיקה נשארו {a} פריטים ללא סימון. כמה אחוזים מהפריטים סומנו?",
    "unmarked_rate": "ברשימה מאה {unit}, ומתוכם {a} עברו בדיקה. כמה אחוזים מהפריטים טרם נבדקו?",
    "marks": "ברשימה מאה {unit}. ליד {p}% מהם יש סימון. ליד כמה {unit} יש סימון?",
    "rate100": "מתוך מאה {unit}, {a} נבחרו. כמה אחוזים מהפריטים נבחרו?",
    "missing100": "מתוך מאה {unit}, {p}% נבחרו. כמה {unit} נשארו מחוץ לבחירה?",
    "part": "במלאי {w} {unit}. נבחרו {p}% מהם. כמה {unit} נבחרו?",
    "pieces": "ברשימה {w} {unit}. מתוכם {p}% סומנו לבדיקה. כמה {unit} סומנו לבדיקה?",
    "survey": "בספירה נמצאו {a} {unit} מסומנים מתוך {w}. איזה אחוז מהפריטים סומן?",
    "rate": "מתוך {w} {unit}, {a} התקבלו היום. כמה אחוזים מהפריטים התקבלו היום?",
    "remaining": "במלאי {w} {unit}. הוציאו {p}% מהפריטים. כמה {unit} נשארו?",
    "missing_count": "הזמנה כוללת {w} {unit}. כבר נמסרו {p}% ממנה. כמה {unit} עדיין ממתינים למסירה?",
    "fraction_part": "במאגר {w} {unit}. מתוך כל מאה פריטים, {p} מיועדים לתצוגה. כמה {unit} במאגר מיועדים לתצוגה?",
    "recover": "נבחרו {a} {unit}, שהם {p}% מכלל הפריטים. כמה {unit} היו בסך הכול?",
    "rest_rate": "ברשימה {p}% מהפריטים סומנו. כמה אחוזים מהפריטים נשארו ללא סימון?",
    "gain": "בשבוע הראשון סומנו {p}% מתוך {w} {unit}. בשבוע השני סומנו עוד {a} פריטים. כמה {unit} סומנו בשני השבועות יחד?",
    "correct_amount": "מתוך {w} {unit} נבחרו {p}%. הוצע שנבחרו {z} פריטים. כתבו את מספר הפריטים הנכון.",
    "correct_rate": "מתוך {w} {unit} נבחרו {a}. הוצע שנבחרו {z}% מהפריטים. כתבו את האחוז הנכון.",
    "recover_remaining": "לאחר שהוציאו {p}% מהפריטים, נשארו {a} {unit}. כמה {unit} היו בתחילה?",
    "gap": "שתי מחלקות קיבלו כל אחת {w} {unit}. במחלקה הראשונה נבדקו {t}% ובשנייה {p}%. כמה {unit} נוספים נבדקו בראשונה לעומת השנייה?",
    "goal": "ברשימה {w} {unit}. סומנו {p}% מהפריטים, והיעד הוא {t}%. כמה {unit} נוספים יש לסמן כדי להגיע ליעד?",
}
PCT_INTROS = {
    "hundred": "קראו את האחוז כמספר פריטים מתוך מאה.",
    "groups10": "קשרו בין מספר קבוצות של עשרה לבין שיעור מתוך מאה.",
    "marked_from_rest": "היעזרו במספר הפריטים שנותרו כדי למצוא את האחוז שסומן.",
    "unmarked_rate": "היעזרו במספר הפריטים שנבדקו כדי למצוא את האחוז שנשאר לבדיקה.",
    "marks": "הפכו את האחוז למספר סימונים ברשימה של מאה.",
    "rate100": "כתבו את החלק מתוך מאה באחוזים.",
    "missing100": "חשבו כמה פריטים מתוך מאה לא נבחרו.",
    "part": "חשבו את החלק המתאים לשיעור הנתון.",
    "pieces": "מצאו כמה פריטים נמצאים בקבוצת הבדיקה.",
    "survey": "כתבו את שיעור הקבוצה המסומנת באחוזים.",
    "rate": "מצאו את האחוז לפי החלק ולפי השלם.",
    "remaining": "חשבו כמה פריטים נותרו במלאי.",
    "missing_count": "חשבו כמה פריטים עדיין חסרים להשלמת ההזמנה.",
    "fraction_part": "השתמשו ביחס הנתון לכל מאה פריטים.",
    "recover": "שחזרו את הכמות השלמה מתוך החלק והאחוז.",
    "rest_rate": "השלימו את החלק המסומן למאה אחוז.",
    "gain": "הבחינו בין מספר פריטים לבין אחוז מהקבוצה.",
    "correct_amount": "בדקו את ההצעה והחליפו אותה בכמות הנכונה.",
    "correct_rate": "בדקו את ההצעה וכתבו את השיעור הנכון.",
    "recover_remaining": "השתמשו בחלק שנותר כדי לשחזר את המלאי המקורי.",
    "gap": "השוו בין שתי קבוצות שגודלן שווה.",
    "goal": "מצאו את התוספת הדרושה למעבר בין שני שיעורים.",
}


def percent_calculation(kind, v):
    w, p, a, t = (str(v.get(key, 0)) for key in ("w", "p", "a", "t"))
    if kind == "groups10":
        return f"{v['g']}*10", "%"
    if kind in ("marked_from_rest", "unmarked_rate"):
        return f"100-{a}", "%"
    if kind in ("rate", "survey", "correct_rate"):
        return f"{a}*100/{w}", "%"
    if kind == "rate100":
        return f"{a}*100/100", "%"
    if kind == "rest_rate":
        return f"100-{p}", "%"
    unit = v["unit"]
    if kind in ("hundred", "marks"):
        return f"100*{p}/100", unit
    if kind == "missing100":
        return f"100-{p}", unit
    if kind in ("remaining", "missing_count"):
        return f"{w}*(100-{p})/100", unit
    if kind == "recover":
        return f"{a}*100/{p}", unit
    if kind == "recover_remaining":
        return f"{a}*100/(100-{p})", unit
    if kind in ("gap", "goal"):
        return f"{w}*({t}-{p})/100", unit
    if kind == "gain":
        return f"{w}*{p}/100+{a}", unit
    return f"{w}*{p}/100", unit


def compile_template(template):
    slots = set()
    pieces = []
    for piece in re.split(r"(\{[a-z]+\})", template):
        if not piece.startswith("{"):
            pieces.append(re.escape(piece))
            continue
        key = piece[1:-1]
        if key in slots:
            pieces.append(f"(?P={key})")
        else:
            choices = "|".join(THEMES) if key == "unit" else r"[0-9]+"
            pieces.append(f"(?P<{key}>{choices})")
            slots.add(key)
    return re.compile("".join(pieces))


PCT_PATTERNS = {name: compile_template(form) for name, form in PCT_FORMS.items()}


def _valid_percent_givens(kind, params, result):
    nums = {k: int(v) for k, v in params.items() if k != "unit"}
    p, t, w, a = (nums.get(k) for k in ("p", "t", "w", "a"))
    if w == 0 or p is not None and not 0 < p < 100 or t is not None and not p < t <= 100:
        return False
    if w is not None and a is not None and a > w or kind == "rate100" and a > 100:
        return False
    if kind == "groups10" and not 0 < nums["g"] < 10:
        return False
    if kind in ("marked_from_rest", "unmarked_rate") and a > 100:
        return False
    value = result.get("value", {})
    if value.get("type") != "number":
        return False
    number = Fraction(value["numerator"], value["denominator"])
    if kind in ("correct_rate", "correct_amount") and nums["z"] == number:
        return False
    if kind in ("rate", "survey", "correct_rate", "rate100", "rest_rate"):
        return 0 <= number <= 100
    return number.denominator == 1 and number >= 0 and not (kind == "gain" and number > w)


def percentage_proof(lesson, question, item, computed):
    if lesson.get("topicId") != PCT or not computed:
        return None
    text = _plain(item["prompt"])
    if not text:
        return None
    for kind, pattern in PCT_PATTERNS.items():
        match = pattern.fullmatch(text)
        if not match:
            continue
        params = match.groupdict()
        calculation, unit = percent_calculation(kind, params)
        task = {"kind": "evaluate", "expression": expression(calculation, 8)}
        if (
            item["answer"].get("unit") != unit
            or computed["question"] != task
            or not _valid_percent_givens(kind, params, computed["result"])
        ):
            raise GeneralSourceError(
                "PRINTED_TASK_MISMATCH", "Percentage key must match the printed quantities and unit"
            )
        return {"rule": "printed_percentage", "role": kind, "givens": params, "unit": unit}
    return None


def percent_row(activity, row, setting, choices, hundred=False):
    items = []
    rates = (5, 10, 20, 25, 40, 50, 60, 75)
    for j, pick in enumerate(choices):
        p = rates[(2 * row + 2 * j + pick - 1) % len(rates)]
        w = 20 * (2 + ((row + setting + pick + j * 4) % 9))
        if hundred or activity in ("hundred", "marks", "rate100", "missing100"):
            w = 100
        a = w * p // 100
        if activity == "gain":
            a = max(1, (w - a) // 3)
        if activity == "recover_remaining":
            a = w - a
        unit = THEMES[(setting + j - 1) % len(THEMES)]
        values = dict(
            g=1 + (row + 2 * j + pick + setting) % 9,
            w=w,
            p=p,
            a=a,
            t=min(100, p + 5 * (pick + 1)),
            z=(p if activity == "correct_rate" else a) + j + 1,
            unit=unit,
        )
        prompt = PCT_FORMS[activity].format(**values)
        formula, unit = percent_calculation(activity, values)
        items.append(
            {
                "prompt": spans(prompt, 8),
                "answer": {
                    "kind": "computed",
                    "task": {"kind": "evaluate", "expression": expression(formula, 8)},
                    "unit": unit,
                },
            }
        )
    return spans(PCT_INTROS[activity], 8), items


def build_source(lesson, response, scope):
    _check_scope(lesson, scope)
    if (
        type(response) is not dict
        or set(response) != {"questions", "version"}
        or response["version"] != VERSION
        or not isinstance(response["questions"], list)
        or len(response["questions"]) != lesson["questionCount"]
    ):
        raise GeneralSourceError("INTRO_PARAMETERS", "Expected one bounded plan per requested question")
    topic = lesson["topicId"]
    plans = activities(lesson)
    questions = []
    for i, (row, pair) in enumerate(zip(response["questions"], plans)):
        if (
            type(row) is not dict
            or set(row) != {"activity", "setting", "operands"}
            or type(row["activity"]) is not int
            or row["activity"] not in (1, 2)
            or type(row["setting"]) is not int
            or not 1 <= row["setting"] <= 4
            or type(row["operands"]) is not list
            or len(row["operands"]) != 3
            or any(type(x) is not int or not 1 <= x <= 4 for x in row["operands"])
        ):
            raise GeneralSourceError("INTRO_PARAMETERS", "Invalid activity, setting or operand selection")
        kind = pair[row["activity"] - 1]
        if topic == EQ:
            intro, items = equation_row(kind, i, row["setting"], row["operands"])
        else:
            intro, items = percent_row(
                kind, i, row["setting"], row["operands"], hundred=out_of_hundred(lesson)
            )
        questions.append({"intro": intro, "items": items, "star": i >= len(plans) - 3})
    title = "משוואות ממעלה ראשונה" if topic == EQ else "אחוזים וחלק מתוך מאה"
    rule = (
        "פתרון משוואה הוא ערך הנעלם שיוצר שוויון בין שני האגפים. אפשר להוסיף אותו מספר לשני האגפים או לחסר אותו משניהם. אפשר גם לכפול או לחלק את שניהם באותו מספר שונה מאפס."
        if topic == EQ
        else "אחוז אחד הוא חלק אחד מתוך מאה חלקים שווים. כשנתון אחוז, מזהים תחילה מהי הכמות השלמה, ואז מחשבים את החלק המתאים מתוכה."
    )
    return {
        "version": 4,
        "title": title,
        "rule": spans(rule, lesson["gradeNumber"]),
        "sections": [
            {
                "title": title,
                "conceptIds": [c["id"] for c in scope["selectedConcepts"]],
                "questions": questions,
            }
        ],
    }
