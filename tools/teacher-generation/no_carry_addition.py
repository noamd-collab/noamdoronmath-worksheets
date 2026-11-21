"""Qwen's compact parameter contract for introductory, no-regrouping addition.

The author selects concrete pairs from each slot's four alternatives and the
objects used in its problems. The skill compiler still checks every printed
answer. An incompatible teacher request can use full skill source in the same
provider call.
"""
from general_source import GeneralSourceError
from math_tasks import number, operation


CONCEPT = "ב05#1"
UNITS = ("סְפָרִים", "מַדְבֵּקוֹת", "כַּפְתּוֹרִים", "חֲרוּזִים", "עֶפְרוֹנוֹת",
         "כַּדּוּרִים", "קְלָפִים", "צְדָפִים", "גּוּלוֹת", "מַחְבָּרוֹת")
DRILLS = ("מָה הַסְּכוּם?", "חַבְּרוּ אֶת שְׁנֵי הַמִּסְפָּרִים.",
          "כִּתְבוּ אֶת תּוֹצְאַת הַחִבּוּר.", "חַשְּׁבוּ כַּמָּה יֵשׁ בְּיַחַד.",
          "מָה מְקַבְּלִים כְּשֶׁמְּחַבְּרִים?")
INTROS = {
    "tens": "הַתְחִילוּ בְּחִבּוּר עֲשָׂרוֹת שְׁלֵמוֹת. סִפְרַת הַיְּחִידוֹת נִשְׁאֶרֶת כְּפִי שֶׁהָיְתָה.",
    "place": "חַבְּרוּ יְחִידוֹת לִיחִידוֹת וַעֲשָׂרוֹת לַעֲשָׂרוֹת.",
    "combine": "בְּכָל סְעִיף יֵשׁ שְׁתֵּי קֻפְסָאוֹת. מִצְאוּ אֶת הַכַּמּוּת בִּשְׁתֵּיהֶן יַחַד.",
    "increase": "קִרְאוּ מָה הָיָה בַּהַתְחָלָה וּמָה נוֹסַף. חַשְּׁבוּ אֶת הַכַּמּוּת הַחֲדָשָׁה.",
    "days": "אַסְפוּ פְּרִיטִים בְּמֶשֶׁךְ יוֹמַיִם. כַּמָּה אָסְפוּ בִּשְׁנֵי הַיָּמִים?",
    "digits": "קִרְאוּ אֶת תֵּאוּר הַמִּסְפָּר הַשֵּׁנִי בְּכָל סְעִיף. חַבְּרוּ אוֹתוֹ לַמִּסְפָּר הָרִאשׁוֹן.",
    "check": "בִּדְקוּ אֶת הַתְּשׁוּבָה שֶׁהֻצְּעָה בְּכָל סְעִיף. כִּתְבוּ אֶת הַסְּכוּם הַנָּכוֹן.",
    "choose": "קִרְאוּ אֵילוּ פְּרִיטִים מְבַקְּשִׁים לִסְפֹּר. בַּחֲרוּ אֶת שְׁתֵּי הַכַּמּוּיוֹת הַמַּתְאִימוֹת וְחַבְּרוּ.",
}


def compatible(lesson):
    return (lesson["gradeNumber"] == 2 and lesson["topicId"] == "ב05"
            and lesson["lessonBoundary"]["conceptIds"] == [CONCEPT] and lesson["level"] == "b"
            and lesson.get("lessonGoal") == "practice" and 8 <= lesson["questionCount"] <= 12)


def parameter_schema(count):
    def integer(low, high):
        return {"type": "integer", "minimum": low, "maximum": high}
    def array(item, length):
        return {"type": "array", "items": item, "minItems": length, "maxItems": length}
    row = {"type": "object", "additionalProperties": False, "required": ["theme", "choices"],
           "properties": {"theme": integer(1, len(UNITS)), "choices": array(integer(1, 4), 5)}}
    return {"type": "object", "additionalProperties": False, "required": ["version", "questions"],
            "properties": {"version": {"const": 1}, "questions": array(row, count)}}


def question_kinds(count):
    practice = ("tens", "place", "combine", "increase", "days", "combine", "increase", "days", "place")
    return [*practice[:count-3], "digits", "check", "choose"]


def parameter_plan(count):
    # Every slot has two possible sums, each used by at most two slots.
    # No unordered operand pair can reappear anywhere in the sheet.
    used = set()
    plan = []
    used_sums = {}
    for qi, kind in enumerate(question_kinds(count)):
        slots = []
        for sub in range(5):
            index = qi * 5 + sub
            base = 33 + (index // 10) * 10 + (index * 7) % 10
            options = []
            for variant in range(2):
                totals = sorted(range(29, 99), key=lambda n: (abs(n - base - variant), n))
                for total in totals:
                    if used_sums.get(total, 0) >= 2 or (options and sum(options[0]) == total):
                        continue
                    available = [(a, total - a) for a in range(10, total // 2 + 1)
                                 if a % 10 + (total - a) % 10 < 10
                                 and (kind != "tens" or a % 10 == 0 or (total - a) % 10 == 0)
                                 and (a, total - a) not in used]
                    if len(available) >= 2:
                        break
                else:
                    raise ValueError("No available no-regrouping addition slot")
                used_sums[total] = used_sums.get(total, 0) + 1
                for offset in range(2):
                    a, b = available.pop((index + offset * 3) % len(available))
                    used.add((a, b))
                    options.append((b, a) if (sub + offset) % 2 else (a, b))
            slots.append(options)
        plan.append({"kind": kind, "options": slots})
    return plan


def spans(*pieces):
    result = []
    for value in pieces:
        if type(value) is int:
            result.append({"kind": "math", "expression": number(value)})
        elif result and result[-1]["kind"] == "text":
            result[-1]["text"] += value
        else:
            result.append({"kind": "text", "text": value})
    return result


def prompt(kind, sub, qi, unit, other, a, b):
    if kind in ("tens", "place"):
        return spans(DRILLS[sub]), ""
    if kind == "combine":
        return spans("בְּקֻפְסָה אַחַת ", a, " ", unit, " וּבְקֻפְסָה שְׁנִיָּה ", b,
                     ". כַּמָּה ", unit, " יֵשׁ בִּשְׁתֵּי הַקֻּפְסָאוֹת?"), unit
    if kind == "increase":
        return spans("בַּסַּל הָיוּ ", a, " ", unit, ". הוֹסִיפוּ עוֹד ", b,
                     ". כַּמָּה ", unit, " יֵשׁ עַכְשָׁו?"), unit
    if kind == "days":
        return spans("אֶתְמוֹל אָסְפוּ ", a, " ", unit, " וְהַיּוֹם אָסְפוּ ", b,
                     ". כַּמָּה ", unit, " אָסְפוּ בְּסַךְ הַכֹּל?"), unit
    if kind == "digits":
        return spans("יֵשׁ ", a, " ", unit, ". מוֹסִיפִים מִסְפָּר נוֹסָף שֶׁל ", unit,
                     ": סִפְרַת הָעֲשָׂרוֹת שֶׁלּוֹ הִיא ", b // 10, " וְסִפְרַת הַיְּחִידוֹת שֶׁלּוֹ הִיא ",
                     b % 10, ". כַּמָּה יֵשׁ בְּיַחַד?"), unit
    if kind == "check":
        claimed = a + b + (-1, 0, 1, -10, 0)[(sub + qi) % 5]
        return spans("לְאַחַר חִבּוּר שְׁתֵּי קְבוּצוֹת שֶׁל ", unit, " הֻצְּעָה הַתְּשׁוּבָה ",
                     claimed, ". חַשְּׁבוּ וְכִתְבוּ אֶת הַסְּכוּם הַנָּכוֹן."), unit
    return spans("בַּסַּל יֵשׁ ", a, " ", unit, " וְגַם ", 3 + sub, " ", other,
                 ". בַּמְּגֵרָה יֵשׁ עוֹד ", b, " ", unit, ". כַּמָּה ", unit, " יֵשׁ בְּיַחַד?"), unit


def build_source(lesson, payload, plan):
    def invalid():
        raise GeneralSourceError("AUTHOR_PLAN_MISMATCH", "Invalid no-regrouping addition parameter plan")
    if type(payload) is not dict or set(payload) != {"version", "questions"} or type(payload["version"]) is not int or payload["version"] != 1:
        invalid()
    rows = payload["questions"]
    if type(rows) is not list or len(rows) != lesson["questionCount"]:
        invalid()
    questions = []
    pairs = set()
    for qi, (row, expected) in enumerate(zip(rows, plan, strict=True)):
        if type(row) is not dict or set(row) != {"theme", "choices"} or type(row["theme"]) is not int or not 1 <= row["theme"] <= len(UNITS):
            invalid()
        choices = row["choices"]
        if type(choices) is not list or len(choices) != 5 or any(type(n) is not int or not 1 <= n <= 4 for n in choices):
            invalid()
        items = []
        for sub, choice in enumerate(choices):
            a, b = expected["options"][sub][choice-1]
            key = tuple(sorted((a, b)))
            if key in pairs or min(a, b) < 10 or a+b > 99 or a % 10 + b % 10 >= 10:
                invalid()
            pairs.add(key)
            pos = row["theme"]-1 + sub
            words, unit = prompt(expected["kind"], sub, qi, UNITS[pos % len(UNITS)], UNITS[(pos+1) % len(UNITS)], a, b)
            task = {"kind":"evaluate", "expression":operation("add", number(a), number(b))}
            items.append({"prompt": words, "answer": {"kind": "computed", "task": task, "unit": unit}})
        questions.append({"intro": spans(INTROS[expected["kind"]]), "star": qi >= len(rows)-3, "items": items})
    return {"version": 4, "title": "חִבּוּר שֶׁל מִסְפָּרִים דּוּ־סִפְרָתִיִּים",
            "rule": spans("מְחַבְּרִים יְחִידוֹת לִיחִידוֹת וַעֲשָׂרוֹת לַעֲשָׂרוֹת. אַחַר כָּךְ כּוֹתְבִים אֶת הַסְּכוּם."),
            "sections": [{"title": "מְתַרְגְּלִים חִבּוּר", "conceptIds": [CONCEPT], "questions": questions}]}


def states_entire_task(lesson, question_index, sub_index, item):
    """Only an exact, independently reconstructed word problem replaces a+b.

    The source has no field permitting the author to hide the verified task.
    Reconstruct its displayed problem from that same task and unit, including
    every required number. Any other prompt keeps the full task on the page.
    """
    if not compatible(lesson):
        return False
    kind = question_kinds(lesson["questionCount"])[question_index]
    if kind not in ("combine", "increase", "days", "digits", "choose"):
        return False
    answer = item["answer"]
    unit = answer.get("unit")
    task = answer.get("task", {})
    expr = task.get("expression", {})
    args = expr.get("args", ())
    if (unit not in UNITS or task.get("kind") != "evaluate" or expr.get("op") != "add"
            or len(args) != 2 or any(v.get("type") != "number" or v["denominator"] != 1 for v in args)):
        return False
    a, b = (v["numerator"] for v in args)
    other = UNITS[(UNITS.index(unit)+1) % len(UNITS)]
    expected, _ = prompt(kind, sub_index, question_index, unit, other, a, b)
    return item["prompt"] == expected
