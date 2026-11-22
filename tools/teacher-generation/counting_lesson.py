"""Count only pupil-visible text, under the grade-one counting boundary."""

import random
import re
import secrets

from general_source import GeneralSourceError, validate_source
from math_tasks import number


VERSION = "counting-words/1"
CONCEPTS = frozenset({"א01#0", "א01#1", "א01#2"})
WORDS = ("דָּג", "סַל", "דֹּב", "פִּיל", "סוּס", "כַּד", "יָם", "גַּל", "בַּד", "גַּג", "נֵר", "גִּיר")
NAMES = ("רֹן", "טַל", "דָּן", "גַּל", "שַׁי", "אוֹר", "נִיר", "מַי", "נוֹי", "לִי", "יוּבַל", "תֹּם")
INTROS = (
    "מְנוּ אֶת הַמִּלִּים בְּכָל שׁוּרָה. כִּתְבוּ כַּמָּה מִלִּים יֵשׁ.",
    "הַמִּלִּים שׁוֹנוֹת. גְּעוּ בְּכָל מִלָּה פַּעַם אַחַת וְכִתְבוּ כַּמָּה יֵשׁ.",
    "חַפְּשׂוּ בַּשּׁוּרָה אֶת הַמִּלָּה שֶׁבַּמֵּרְכָאוֹת. כַּמָּה פְּעָמִים מְצָאתֶם אוֹתָהּ?",
    "כָּל יֶלֶד וְכָל יַלְדָּה מְקַבְּלִים כּוֹס אַחַת. כַּמָּה כּוֹסוֹת צָרִיךְ?",
    "כָּל זוּג מְקַבֵּל פֶּתֶק אֶחָד. כַּמָּה פְּתָקִים צָרִיךְ?",
    "דָּן סָפַר. סִפְרוּ גַּם אַתֶּם. כִּתְבוּ כַּמָּה יֵשׁ.",
    "שֵׁם אֶחָד חוֹזֵר. מְנוּ כָּל שֵׁם פַּעַם אַחַת. כַּמָּה יְלָדִים בָּאוּ?",
    "אוֹתָם שֵׁמוֹת, סֵדֶר אַחֵר. כַּמָּה שֵׁמוֹת יֵשׁ בְּכָל רְשִׁימָה?",
)
PAIR = " עִם "
CLAIM = ". דָּן אָמַר: "
AGAIN = ". וְעַכְשָׁו: "
# Permit ordinary progress reports. Additional methods, exclusions, narrowed
# counts or personalisations require the ordinary author to interpret them.
PROGRESS = frozenset("""
סיימנו גמרנו ללמוד למדנו לימדנו תרגלנו ותרגלנו התחלנו התנסינו ספרנו סָפרנו מנינו ומנינו
מנייה מניה במנייה במניה ספירה בספירה וספירה לספור ולספור למנות ולמנות
עד 10 עשר עשרה המספרים מספרים התאמה והתאמה חד חד ערכית וערכית אחד לאחד
אחת לאחת את של כל מה עם על השיעור בשיעור האחרון הקודם בנושא הנושא בנושאים
מונים בלי לפספס המושגים שסומנו החומר הנלמד כיתה א תלמידים תלמידות פריטים
חפצים עצמים מילים ילדים שמות בקול בקבוצות קטנות ובקול והספירה
""".split())


def eligible(lesson):
    boundary = lesson.get("lessonBoundary") or {}
    if not (lesson.get("version") == 3 and lesson.get("gradeNumber") == 1
            and lesson.get("topicId") == "א01" and lesson.get("level") == "b"
            and lesson.get("questionCount") == 8 and lesson.get("lessonGoal") in ("practice", "review")
            and boundary.get("kind") == "curriculum_scope" and set(boundary.get("conceptIds", [])) == CONCEPTS):
        return False
    texts = [lesson.get("lastLesson", ""), *lesson.get("alreadyLearned", [])]
    for raw in texts:
        value = re.sub(r"[\u0591-\u05bd\u05bf-\u05c7]", "", raw)
        if re.search(r"[^א-ת0-9\s.,!?׳״'\"־–-]", value):
            return False
        # 'בלי' is allowed only inside the curriculum title.
        value = value.replace("מונים בלי לפספס", "מונים")
        tokens = re.findall(r"[א-ת]+|[0-9]+", value)
        if "בלי" in tokens or not set(tokens) <= PROGRESS:
            return False
    return True


def parameters(lesson):
    if not eligible(lesson):
        raise GeneralSourceError("COUNTING_SCOPE", "Unsupported counting lesson")
    return {"version": VERSION, "seed": secrets.randbits(32)}


def validate_parameters(lesson, payload):
    if not eligible(lesson):
        raise GeneralSourceError("COUNTING_SCOPE", "Unsupported counting lesson")
    if (type(payload) is not dict or set(payload) != {"version", "seed"} or payload["version"] != VERSION
            or type(payload["seed"]) is not int or not 0 <= payload["seed"] < 2**32):
        raise GeneralSourceError("COUNTING_PARAMETERS", "A replayable unsigned 32-bit counting seed is required")


def rich(text):
    return [{"kind": "text", "text": text}]


def prompt_for(family, count, rng, slot):
    word = rng.choice(WORDS)
    if family == 0:
        words = [word] * count
    elif family == 1:
        words = rng.sample(WORDS, count)
    elif family == 2:
        other = rng.choice([w for w in WORDS if w != word])
        words = [word] * count + [other] * rng.randint(1, min(3, 10-count))
        rng.shuffle(words)
        return rich("״" + word + "״: " + ", ".join(words))
    elif family == 3:
        words = rng.sample(NAMES, count)
    elif family == 4:
        names = rng.sample(NAMES, 2 * count)
        words = [a + PAIR + b for a, b in zip(names[::2], names[1::2])]
    elif family == 5:
        words = rng.choices(WORDS, k=count)
        # Some reported counts are correct. Recounting must decide.
        wrong = [n for n in range(1,11) if abs(n - count) == 1]
        claim = count if slot in (1, 3) else rng.choice(wrong)
        return rich(", ".join(words) + CLAIM) + [{"kind": "math", "expression": number(claim)}]
    elif family == 6:
        words = rng.sample(NAMES, count)
        words.append(rng.choice(words))
        rng.shuffle(words)
    else:
        words = rng.sample(NAMES, count)
        shift = rng.randint(1, count-1)
        reordered = words[shift:] + words[:shift]
        return rich(", ".join(words) + AGAIN + ", ".join(reordered))
    return rich(", ".join(words))


def require(condition):
    if not condition:
        raise GeneralSourceError("COUNTING_PRINT", "Printed counting task has invalid or ambiguous evidence")


def tokens(value, vocabulary):
    items = value.split(", ")
    require(1 <= len(items) <= 10 and all(x in vocabulary for x in items))
    return items


def answer_from_prompt(intro, prompt):
    """Reconstruct the scalar from the printed words, never from the seed/key."""
    require(type(intro) is list and len(intro) == 1 and intro[0].get("kind") == "text")
    require(intro[0].get("text") in INTROS)
    family = INTROS.index(intro[0]["text"])
    require(type(prompt) is list and len(prompt) == (2 if family == 5 else 1))
    require(prompt[0].get("kind") == "text" and type(prompt[0].get("text")) is str)
    value = prompt[0]["text"]
    if family in (0, 1):
        words = tokens(value, WORDS)
        require(len(set(words)) == (1 if family == 0 else len(words)))
        return len(words)
    if family == 2:
        target, delimiter, row = value.partition("״: ")
        require(delimiter and target.startswith("״") and target[1:] in WORDS)
        words = tokens(row, WORDS)
        count = words.count(target[1:])
        require(0 < count < len(words))
        return count
    if family == 3:
        names = tokens(value, NAMES)
        require(len(names) == len(set(names)))
        return len(names)
    if family == 4:
        pairs = [pair.split(PAIR) for pair in value.split(", ")]
        names = [name for pair in pairs for name in pair]
        require(1 <= len(pairs) <= 5 and all(len(pair) == 2 for pair in pairs)
                and all(name in NAMES for name in names) and len(names) == len(set(names)))
        return len(pairs)
    if family == 5:
        require(value.endswith(CLAIM))
        claim = prompt[1]
        require(claim.get("kind") == "math" and any(claim.get("expression") == number(n) for n in range(1,11)))
        return len(tokens(value[:-len(CLAIM)], WORDS))
    if family == 6:
        names = tokens(value, NAMES)
        require(len(names) == len(set(names)) + 1)
        return len(set(names))
    first, delimiter, second = value.partition(AGAIN)
    require(delimiter)
    names, reordered = tokens(first, NAMES), tokens(second, NAMES)
    require(names != reordered and sorted(names) == sorted(reordered) and len(names) == len(set(names)))
    return len(names)


def build(lesson, payload):
    validate_parameters(lesson, payload)
    rng = random.Random(payload["seed"])
    pools = (range(1,7), range(4,11), range(1,8), range(2,10),
             range(1,6), range(3,11), range(2,9), range(2,7))
    questions, printed = [], {}
    for family, pool in enumerate(pools):
        intro = rich(INTROS[family])
        items = []
        for j, expected in enumerate(rng.sample(list(pool), 5)):
            prompt = prompt_for(family, expected, rng, j)
            actual = answer_from_prompt(intro, prompt)
            require(actual == expected)
            item_id = f"q{family+1}-i{j+1}"
            printed[item_id] = actual
            items.append({"prompt": prompt, "answer": {"kind":"computed", "unit":"",
                "task":{"kind":"evaluate", "expression":number(expected)}}})
        questions.append({"intro":intro, "star":family >= 5, "items":items})
    return {"version":4, "title":"מוֹנִים בְּלִי לְפַסְפֵּס", "rule":rich(
        "גְּעוּ בְּכָל מִלָּה שֶׁמּוֹנִים פַּעַם אַחַת. סִפְרוּ בְּקוֹל וְכִתְבוּ מִסְפָּר."),
        "sections":[{"title":"מוֹנִים בְּמִלִּים", "conceptIds":list(lesson["lessonBoundary"]["conceptIds"]),
                     "questions":questions}]}, printed


def compile_counting(lesson, payload, scope, skill, work):
    from general_adapters import compile_source
    source, printed = build(lesson, payload)
    checked = validate_source(lesson, source, scope)
    return compile_source(lesson, checked, scope, skill, work, printed_answers=printed)
