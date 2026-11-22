"""Closed v3 author for grade-three multiplication-table division practice.

Keep the public curriculum intake and its concept IDs intact. Only the internal
view uses the verified division_facts boundary and four legacy task kinds.
"""

import random
import re
import secrets

from validation import reject

VERSION = "division-facts/1"
FACTS = "ג10#0"
INVERSE = "ג10#1"
MAX_SEED = 2**32 - 1
CHALLENGES = {
    "missing_operand": "השלימו את המחולק. מצאו את המנה החדשה אם מוסיפים למחולק קבוצה אחת בגודל המחלק.",
    "check_solution": "קבעו אם המנה המוצעת גדולה מדי או קטנה מדי וכתבו את השוויון הנכון.",
    "missing_right": "מצאו את המחלק החסר. אחר כך חלקו את אותו מחולק במנה המקורית וכתבו את התרגיל החדש.",
}
# Keep custom methods, restricted divisors, alternative representations, etc.
# on the general author; recognising a few words in a longer request is unsafe.
PROGRESS = frozenset(
    """
תרגלנו תירגלנו פתרנו ופתרנו למדנו לימדתי למדו תרגלו חזרנו סיכמנו השתמשנו מצאנו
חילוק בחילוק חלוקה וחילוק תרגילי בתרגילי תרגילים תרגיל בתרגיל עובדות עובדותיו
תחום בתחום בתחומי עד 100 מאה לוח בלוח מלוח הכפל כפל בכפל וכפל וכפלנו
השווינו בדקנו בדיקת בדיקה ובדיקה בבדיקת באמצעות בעזרת והקשר הקשר ההפוך בין
לחילוק לכפל את של עם כל מתוך על הנושא בנושא השיעור בשיעור האחרון הקודם
המנה מנה מנות מחלק המחלק והמחלק מחולק המחולק והמחולק המספרים מספרים
מתאים מתאימה מתאימים תואם מתרגיל תרגול חזרה ההפך פעולות הפוכות
""".split()
)
INVERSE_METHOD = re.compile(
    r"(?:בעזרת|באמצעות|בדקנו|בדיקה|בדיקת)\s+(?:את\s+|החילוק\s+|תרגילי?\s+|תרגיל\s+){0,3}ב?כפל|הקשר ההפוך בין (?:כפל לחילוק|חילוק לכפל)"
)


def eligible(lesson):
    ids = lesson.get("lessonBoundary", {}).get("conceptIds", [])
    if not (
        lesson.get("version") == 3
        and lesson.get("topicId") == "ג10"
        and lesson.get("gradeNumber") == 3
        and lesson.get("level") == "b"
        and lesson.get("questionCount") == 12
        and lesson.get("lessonGoal") in ("practice", "review")
        and set(ids) in ({FACTS}, {FACTS, INVERSE})
    ):
        return False
    descriptions = [lesson.get("lastLesson", ""), *lesson.get("alreadyLearned", [])]
    for original in descriptions:
        text = re.sub(r"(?:ללא|בלי) שארית", " ", original)
        # Only Hebrew facts-table progress, punctuation, and the table bound.
        if re.search(r"[^א-ת0-9\s.,!?״׳'\"־–—-]", text):
            return False
        if not set(re.findall(r"[א-ת]+|[0-9]+", text)) <= PROGRESS:
            return False
    return INVERSE not in ids or any(INVERSE_METHOD.search(t) for t in descriptions)


def author(lesson):
    if not eligible(lesson):
        reject(
            "DIVISION_SCOPE", "The native division author does not cover this lesson"
        )
    return {"version": VERSION, "seed": secrets.randbelow(MAX_SEED + 1)}


def derive(lesson, source):
    from author_quality import prepare_didactics
    from provider import derive_author_parameters, question_plan
    from validation import validate_lesson, validate_model

    if not eligible(lesson):
        reject(
            "DIVISION_SCOPE", "The native division author does not cover this lesson"
        )
    if (
        not isinstance(source, dict)
        or set(source) != {"version", "seed"}
        or source["version"] != VERSION
        or type(source["seed"]) is not int
        or not 0 <= source["seed"] <= MAX_SEED
    ):
        reject("DIVISION_PARAMETERS", "Expected one bounded division variation seed")
    native = dict(
        lesson,
        version=2,
        lessonBoundary={
            "version": 1,
            "kind": "division_facts",
            "allowedDivisors": list(range(1, 11)),
            "maxDividend": 100,
        },
    )
    cap = validate_lesson(native)
    plan = question_plan(native, cap)
    generator = random.Random(source["seed"])
    # Each of the three item columns uses its own disjoint set of divisors.
    # Thus every row mixes divisors. Every column has at least 27 unique
    # facts available, of which we need only 12. Challenge adjustments stay
    # within the same 10 by 10 table (no overflow or symmetric swapped facts).
    divisors = list(range(1, 11))
    generator.shuffle(divisors)
    columns = []
    for start in range(3):
        pool = [(d, q) for d in divisors[start::3] for q in range(1, 11)]
        generator.shuffle(pool)
        columns.append(pool)
    rows = []
    for slot in plan:
        picks = []
        for pool in columns:
            index = next(
                i
                for i, (d, q) in enumerate(pool)
                if not slot["star"]
                or (slot["kind"] != "missing_operand" or q < 10)
                and (slot["kind"] != "missing_right" or d != q)
            )
            d, q = pool.pop(index)
            picks.append({"divisor": d, "quotient": q})
        generator.shuffle(picks)
        rows.append({"items": picks})
    output = derive_author_parameters(native, cap, {"version": 2, "questions": rows})
    validate_model(native, output)
    prepare_didactics(native, output, cap)
    return native, cap, output


def compile_source(lesson, source, skill, work):
    from pathlib import Path
    from adapters import elementary

    native, cap, payload = derive(lesson, source)
    facts_only = INVERSE not in lesson["lessonBoundary"]["conceptIds"]
    if facts_only:
        cap = dict(cap, title="חילוק בתחום לוח הכפל")
    elementary(native, payload, cap, Path(skill), Path(work), facts_only=facts_only)
    return {
        "skill": "elementary",
        "work": str(work),
        "sourcePath": str(Path(work) / "worksheet-source.json"),
        "reviewRequired": True,
    }
