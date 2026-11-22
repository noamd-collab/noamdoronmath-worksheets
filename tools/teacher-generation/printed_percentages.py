"""Solve explicitly self-contained percentage tasks from their pupil-visible numbers."""

from fractions import Fraction
import re

from general_source import GeneralSourceError
from math_tasks import number
from numeric_literals import display_literal

COUNT_UNITS = frozenset(
    "תלמידים ספרים פריטים עבודות עצים צופים קופסאות כלים ברגים מוצרים לחמים שיחים בקבוקים תיקיות שאלות".split()
) | {"כתבי עת"}
MEASURES = {"שקלים", "ליטרים", "קילוגרמים", "מטרים", "דקות"}
SIMPLE_ENTITIES = COUNT_UNITS | MEASURES


def _plain(spans):
    out = []
    for s in spans:
        if s["kind"] == "text":
            out.append(s["text"])
        elif s["kind"] == "math" and s["expression"]["type"] == "number":
            a = s["expression"]
            rational = Fraction(a["numerator"], a["denominator"])
            out.append(str(rational))
        elif s["kind"] == "formula" and (spelling := display_literal(s["notation"])) is not None:
            # Match the printed magnitude and keep the meaning of the percent
            # sign in the sentence. The quantity 12.50% is 25/2 percent.
            magnitude = Fraction(spelling.removesuffix("%").replace(",", ""))
            out.append(str(magnitude) + ("%" if spelling.endswith("%") else ""))
        else:
            return None
    return " ".join("".join(out).split())


def _unit(s):
    if s == "כתבי העת":
        return "כתבי עת"
    return s[1:] if s.startswith("ה") else s


def _reject():
    raise GeneralSourceError(
        "PRINTED_TASK_MISMATCH",
        "The percentage result is inconsistent with the pupil-visible words or units",
    )


def percentage_evidence(lesson, intro_spans, item, solved):
    """Return evidence only for a complete known question with an exact, checked answer."""
    if (
        lesson.get("gradeNumber") != 8
        or lesson.get("topicId") != "g8:percentages"
        or solved is None
        or item["answer"]["kind"] != "computed"
    ):
        return None
    p = _plain(item["prompt"])
    intro = _plain(intro_spans)
    if p is None or intro is None:
        return None
    # Percent sign and the Hebrew word both explicitly denote a percent.
    amount = re.fullmatch(
        r"כמה (?:הם|הן|הם בסך הכול) (\d+(?:/\d+)?)\s*(?:אחוזים|אחוז|%) מ[־-]?(\d+(?:/\d+)?) ([א-ת ]+)\?",
        p,
    )
    test_score = re.fullmatch(
        r"([א-ת]+) (?:ענה|ענתה) נכון על (\d+) שאלות\. כמה אחוזים מהשאלות (?:ענה|ענתה) \1 נכון\?",
        p,
    )
    exam = re.fullmatch(r"במבחן היו (\d+) שאלות\.", intro)
    if amount:
        try:
            rate, whole = map(Fraction, amount.groups()[:2])
        except ZeroDivisionError:
            _reject()
        unit = _unit(amount[3])
        if unit not in SIMPLE_ENTITIES:
            return None
        if unit != item["answer"]["unit"] or whole < 0:
            _reject()
        stated = re.fullmatch(
            r"(?:ב[א-ת ]+ יש|המורה בדקה|במפעל ייצרו) (\d+) ([א-ת ]+)\.", intro
        )
        if stated and _unit(stated[2]) == unit and Fraction(stated[1]) != whole:
            _reject()
        expected = rate * whole / 100
        if unit in COUNT_UNITS and (
            expected.denominator != 1 or whole.denominator != 1
        ):
            _reject()
        proof = {"role": "part", "whole": str(whole), "percent": str(rate)}
    elif test_score and exam:
        part, whole = int(test_score[2]), int(exam[1])
        if (
            not 0 <= part <= whole
            or whole == 0
            or item["answer"]["unit"] not in {"אחוזים", "אחוז", "%"}
        ):
            _reject()
        expected = Fraction(part * 100, whole)
        proof = {"role": "percentage", "part": str(part), "whole": str(whole)}
    else:
        return None
    if solved["question"]["kind"] != "evaluate" or solved["result"] != {
        "type": "expression",
        "value": number(expected.numerator, expected.denominator),
    }:
        _reject()
    return {
        **proof,
        "rule": "printed_percentage",
        "value": str(expected),
        "unit": item["answer"]["unit"],
    }
