"""Grade-five unlike fractions. Reconstruct every answer from the fractions the pupil reads."""

from fractions import Fraction
from itertools import permutations
from math import gcd, lcm
import random
import secrets

from general_source import GeneralSourceError, validate_source
from math_tasks import number, operation

TOPIC = "ה11"
VERSION = "unlike-fractions/1"
TITLE = "חיבור וחיסור שברים במכנים שונים"
NOTE = (
    "סיימנו ללמוד את הנושא חיבור וחיסור שברים במכנים שונים ותרגלנו את המושגים שסומנו."
)
ROWS = ("יום ראשון", "יום שני", "יום שלישי")
HEAD = ("יום המדידה", "בבוקר, בליטרים", "בערב, בליטרים")

# Empty positions in each sentence hold native stacked fractions. The solver
# re-reads those slots or the selected printed table row, never the RNG state.
FORMS = (
    (
        "חברו שברים שאחד ממכניהם הוא כפולה של האחר.",
        "add",
        ("חשבו את הסכום של ", " ושל ", "."),
        "",
    ),
    (
        "חסרו שברים באמצעות הרחבת אחד השברים.",
        "sub",
        ("הפחיתו מהשבר ", " את השבר ", "."),
        "",
    ),
    (
        "מצאו סכומים כאשר למכנים אין גורם משותף מלבד אחד.",
        "add",
        ("חברו את ", " ואת ", "."),
        "",
    ),
    (
        "מצאו הפרשים בין שברים במכנים זרים.",
        "sub",
        ("מצאו את ההפרש בין ", " לבין ", ", לפי הסדר."),
        "",
    ),
    (
        "התאימו מכנה משותף לפני החישוב.",
        "lcm",
        ("מהו המכנה המשותף הקטן ביותר הדרוש לחיבור ", " עם ", "?"),
        "",
    ),
    (
        "בכל סעיף מערבבים שתי כמויות של מיץ.",
        "add",
        ("בכד היו ", " ליטר מיץ. הוסיפו ", " ליטר. כמה ליטרים יש בכד עכשיו?"),
        "ליטר",
    ),
    (
        "בכל סעיף בדקו כמה סרט נשאר על הגליל.",
        "sub",
        ("על גליל היו ", " מטר סרט. גזרו ", " מטר. כמה מטרים נשארו?"),
        "מטר",
    ),
    ("קראו בכל שורה בטבלה את שתי מדידות המים וחברו אותן.", "table", (), "ליטר"),
    (
        "השלימו לשלם אחרי שתי מזיגות.",
        "remaining",
        (
            "מילאו תחילה ",
            " מנפח בקבוק ואחר כך עוד ",
            " מנפחו. איזה חלק מהבקבוק עדיין ריק?",
        ),
        "",
    ),
    (
        "מצאו את המחובר החסר.",
        "sub",
        ("סכום שני שברים הוא ", ". אחד המחוברים הוא ", ". מהו המחובר האחר?"),
        "",
    ),
    (
        "השוו כמויות בעזרת חיסור.",
        "gap",
        ("רוני קראה ", " מהספר ולילך קראה ", " מאותו ספר. מה ההפרש בין החלקים שקראו?"),
        "",
    ),
    (
        "בדקו הצעה לחיבור וכתבו את הסכום הנכון.",
        "correction",
        (
            "תלמיד חיבר את ",
            " ואת ",
            " וקיבל ",
            " מחיבור המונים והמכנים בנפרד. מהו הסכום הנכון?",
        ),
        "",
    ),
    (
        "חשבו לאחור כדי לשחזר כמות התחלתית.",
        "add",
        (
            "אחרי שהשתמשו ב־",
            " קילוגרם קמח נשארו ",
            " קילוגרם. כמה קילוגרמים היו בתחילה?",
        ),
        "ק״ג",
    ),
    (
        "שלבו חיבור וחיסור באותה בעיה.",
        "change",
        (
            "במכל היו ",
            " ליטר מים. הוסיפו ",
            " ליטר והוציאו ",
            " ליטר. כמה ליטרים נשארו?",
        ),
        "ליטר",
    ),
)
DENOMINATORS = (2, 3, 4, 5, 6, 7, 8, 9, 10, 12)
FRACTIONS = tuple(
    Fraction(n, d) for d in DENOMINATORS for n in range(1, d) if gcd(n, d) == 1
)
PAIRS = tuple(
    (a, b)
    for a, b in permutations(FRACTIONS, 2)
    if a.denominator != b.denominator and lcm(a.denominator, b.denominator) <= 36
)


def fail():
    raise GeneralSourceError(
        "FRACTION_PRINT", "The displayed fraction exercise and its exact key disagree"
    )


def eligible(lesson):
    return (
        lesson.get("version") == 3
        and lesson.get("topicId") == TOPIC
        and lesson.get("gradeNumber") == 5
        and lesson.get("level") == "b"
        and lesson.get("questionCount") == 14
        and lesson.get("lessonGoal") == "practice"
        and lesson.get("lastLesson", "").strip() == NOTE
        and not lesson.get("alreadyLearned")
        and (lesson.get("lessonBoundary") or {}).get("conceptIds") == [TOPIC + "#0"]
    )


def parameters(lesson):
    if not eligible(lesson):
        raise GeneralSourceError("FRACTION_SCOPE", "Unsupported exact fraction scope")
    return {"version": VERSION, "seed": secrets.randbits(32)}


def validate_parameters(lesson, payload):
    if (
        not eligible(lesson)
        or type(payload) is not dict
        or set(payload) != {"version", "seed"}
        or payload["version"] != VERSION
        or type(payload["seed"]) is not int
        or not 0 <= payload["seed"] < 2**32
    ):
        raise GeneralSourceError(
            "FRACTION_PARAMETERS",
            "Expected a single bounded fraction seed for this exact scope",
        )


def rich(text):
    return [{"kind": "text", "text": text}]


def value(num):
    return number(num.numerator, num.denominator)


def token(num):
    return {"kind": "math", "expression": value(num)}


def read_fraction(span):
    ast = span.get("expression", {})
    if span.get("kind") != "math" or ast.get("type") != "number":
        fail()
    fraction = Fraction(ast["numerator"], ast["denominator"])
    if not 0 < fraction < 1:
        fail()
    return fraction


def sentence(parts, values):
    out = rich(parts[0])
    for f, ending in zip(values, parts[1:]):
        out.extend([token(f), *rich(ending)])
    return out


def read_sentence(parts, spans):
    if len(spans) != 2 * len(parts) - 1 or spans[::2] != [rich(p)[0] for p in parts]:
        fail()
    return [read_fraction(i) for i in spans[1::2]]


def table_prompt(index):
    return rich(f"מה הייתה כמות המים הכוללת ביום {ROWS[index].split()[-1]}?")


def printed_evidence(question, index, computed):
    """Independently evaluate the actual native pupil spans, including the editable table."""
    try:
        form = next(f for f in FORMS if question["intro"] == rich(f[0]))
    except StopIteration:
        fail()
    _, kind, parts, unit = form
    item = question["items"][index]
    if item["answer"]["unit"] != unit:
        fail()
    if kind == "table":
        t = question.get("table", {})
        if (
            t.get("head") != [rich(h) for h in HEAD]
            or len(t.get("rows", [])) != len(ROWS)
            or item["prompt"] != table_prompt(index)
        ):
            fail()
        row = t["rows"][index]
        if (
            len(row) != 3
            or row[0] != rich(ROWS[index])
            or any(len(cell) != 1 for cell in row[1:])
        ):
            fail()
        vals = [read_fraction(cell[0]) for cell in row[1:]]
    else:
        if "table" in question:
            fail()
        vals = read_sentence(parts, item["prompt"])
    a, b = vals[:2]
    if a.denominator == b.denominator:
        fail()
    if kind == "lcm":
        expected = Fraction(lcm(a.denominator, b.denominator))
    elif kind == "sub":
        expected = a - b
    elif kind == "gap":
        expected = abs(a - b)
    elif kind == "remaining":
        expected = 1 - a - b
    elif kind == "change":
        expected = a + b - vals[2]
    else:
        expected = a + b
        if kind == "correction" and (
            vals[2]
            != Fraction(a.numerator + b.numerator, a.denominator + b.denominator)
            or vals[2] == expected
        ):
            fail()
    if expected <= 0 or computed.get("result") != {
        "type": "expression",
        "value": value(expected),
    }:
        fail()
    return {
        "printed": [str(v) for v in vals],
        "unit": unit,
        "operation": kind,
        "result": str(expected),
    }


def problem(rng, n, index, pair):
    intro, kind, parts, unit = FORMS[n]
    a, b = pair
    aa, bb = value(a), value(b)
    vals = [a, b]
    if kind in ("add", "table", "correction"):
        expr = operation("add", aa, bb)
        if kind == "correction":
            vals.append(
                Fraction(a.numerator + b.numerator, a.denominator + b.denominator)
            )
    elif kind == "sub":
        expr = operation("subtract", aa, bb)
    elif kind == "gap":
        hi, lo = sorted(pair, reverse=True)
        expr = operation("subtract", value(hi), value(lo))
    elif kind == "lcm":
        expr = number(lcm(a.denominator, b.denominator))
    elif kind == "remaining":
        expr = operation("subtract", number(1), operation("add", aa, bb))
    elif kind == "change":
        c = rng.choice(
            [
                v
                for v in FRACTIONS
                if v < a + b
                and v not in pair
                and lcm(a.denominator, b.denominator, v.denominator) <= 36
                and (a + b - v).denominator > 1
            ]
        )
        vals.append(c)
        expr = operation("subtract", operation("add", aa, bb), value(c))
    else:
        raise ValueError("Unknown fraction exercise")
    prompt = table_prompt(index) if kind == "table" else sentence(parts, vals)
    return {
        "prompt": prompt,
        "answer": {
            "kind": "computed",
            "unit": unit,
            "task": {"kind": "evaluate", "expression": expr},
        },
    }


def build(lesson, payload):
    validate_parameters(lesson, payload)
    rng = random.Random(payload["seed"])
    rows = []
    used = set()
    for n, (intro, kind, _, unit) in enumerate(FORMS):
        pool = []
        for a, b in PAIRS:
            if n in (0, 1) and max(a.denominator, b.denominator) % min(
                a.denominator, b.denominator
            ):
                continue
            if n in (2, 3) and gcd(a.denominator, b.denominator) != 1:
                continue
            if kind == "sub" and a <= b or kind == "remaining" and a + b >= 1:
                continue
            if (
                kind in ("add", "table", "correction", "change")
                and (a + b).denominator == 1
            ):
                continue
            if frozenset((a, b)) not in used:
                pool.append((a, b))
        rng.shuffle(pool)
        pairs = []
        for pair in pool:
            key = frozenset(pair)
            if key not in used:
                pairs.append(pair)
                used.add(key)
            if len(pairs) == 3:
                break
        if len(pairs) != 3:
            raise ValueError("Cannot construct three distinct unlike fraction pairs")
        question = {
            "intro": rich(intro),
            "star": n >= 11,
            "items": [problem(rng, n, j, pair) for j, pair in enumerate(pairs)],
        }
        if kind == "table":
            question["table"] = {
                "head": [rich(col) for col in HEAD],
                "rows": [
                    [rich(label), [token(a)], [token(b)]]
                    for label, (a, b) in zip(ROWS, pairs)
                ],
            }
        rows.append(question)
    return {
        "version": 4,
        "title": TITLE,
        "rule": rich(
            "כדי לחבר או לחסר שברים, מביאים אותם למכנה משותף באמצעות הרחבה. לאחר מכן מחברים או מחסרים את המונים ומשאירים את המכנה המשותף. מצמצמים את התוצאה כשאפשר."
        ),
        "sections": [
            {
                "title": "מתרגלים שברים במכנים שונים",
                "conceptIds": [TOPIC + "#0"],
                "questions": rows,
            }
        ],
    }


def compile_fractions(lesson, payload, scope, skill, work):
    from general_adapters import compile_source

    checked = validate_source(lesson, build(lesson, payload), scope)
    return compile_source(lesson, checked, scope, skill, work, printed_fractions=True)
