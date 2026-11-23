"""Readings of the words that the pinned elementary truth gates G32 and G33 search for.

scripts/lib/content_truth.py (pinned) fails a question whose text contains
one of a fixed list of words, unless verified.json holds a ledger entry for
that question: G32 (:473) for a universal claim or an existence denial, G33
(:494) for a request to enumerate. Both match substrings, so two ordinary
uses fail as well:

  לכל   "to each" in a per-unit amount or in an instruction:
        נתנה לכל תלמיד 3 עפרונות / התאימו לכל ביטוי את התוצאה
  אילו  the conditional "if": אילו המורה הייתה מחלקת (not "which ones")

This module decides, by closed patterns only, whether a word occurrence has
one of those two readings. Every other occurrence, and every other word on
the lists, stays a claim: the gate fails and names the question.
"מכפלה תמיד גדולה מכל אחד מהגורמים" is a claim here, as is "לכל מספר זוגי".

Used in two places:
  general_adapters._compile_elementary  records the reading in the ledger for
      a question whose listed words ALL have a benign reading, which is the
      gate's own mechanism for "this text was looked at";
  claim_lint (a caller before rendering) names a question that would fail.
"""
from __future__ import annotations

import re

# Pinned copies of content_truth.UNIVERSAL + DENIAL and ENUMERATE (:315-320).
# tests/test_claim_words.py compares them with the installed skill.
GATE_WORDS = {
    "G32": ("לעולם", "תמיד", "אף פעם", "בכל מקרה", "לכל ", "אין אף", "כל משולש",
            "אין כזה", "אין כזו", "לא קיים", "לא קיימת", "אי אפשר", "אינו משולש",
            "אינה משולש", "אין משולש", "לא ניתן לבנות", "לא ניתן להרכיב",
            "לא ייתכן", "בלתי אפשרי", "אינו אפשרי", "אינם אפשריים"),
    "G33": ("רשמו את כל", "מצאו את כל", "כל האפשרויות", "כל השלישיות",
            "אילו", "מי מהם", "מי מהן", "האם ייתכן", "כמה אפשרויות"),
}

_LETTER = "\u05d0-\u05ea"
_END = rf"(?![{_LETTER}])"
# People, containers and time units that receive or hold a per-unit amount.
# Mathematical objects (מספר, שבר, משולש, ביטוי, זוג ...) are deliberately
# absent: "לכל מספר" is a universal statement.
_UNITS = (
    "תלמיד|תלמידה|ילד|ילדה|חבר|חברה|אורח|אורחת|משתתף|משתתפת|שחקן|שחקנית|נוסע|נוסעת|"
    "לקוח|לקוחה|קונה|אח|אחות|בן|בת|שכן|שכנה|מוזמן|מדריך|מדריכה|חניך|חניכה|כיתה|משפחה|צוות|"
    "כיס|שקית|קופסה|קופסא|סל|סלסלה|צלחת|מדף|שולחן|כוס|בקבוק|מגש|אגרטל|חבילה|ארגז|תיק|קערה|"
    "חדר|קומה|אוטובוס|מכונית|עגלה|שק|ארנק|קלמר|ספסל|ערוגה|עציץ|צנצנת|מעטפה|מחברת|אלבום|קרון|"
    "סירה|אוהל|יום|שבוע|חודש|שעה|דקה"
)
_GROUPS = (
    "תלמידים|תלמידות|ילדים|ילדות|חברים|חברות|אורחים|משתתפים|שחקנים|נוסעים|לקוחות|קונים|"
    "אחים|אחיות|בנים|בנות|שכנים|מוזמנים|מדריכים|חניכים|כיתות|משפחות|צוותים"
)
# An imperative that governs "לכל": the sentence asks the pupil to do
# something for each object, it asserts nothing. Proof and explanation verbs
# (הוכיחו, הראו, הסבירו, נמקו, בדקו) are deliberately absent.
_IMPERATIVES = "התאימו|כתבו|רשמו|מצאו|בחרו|סמנו|חשבו|השלימו|קבעו|ציינו|הקיפו|הוסיפו"
_AFTER_EACH = (
    (re.compile(rf"(?:{_UNITS}){_END}"), "per_unit"),
    # "to each group" unless it is "a group of ..." (a set of numbers is a claim).
    (re.compile(rf"קבוצה{_END}(?!\s+של{_END})"), "per_unit"),
    (re.compile(rf"ה?(?:{_GROUPS}){_END}"), "per_unit"),
    (re.compile(rf"[0-9]{{1,4}}\s+(?:{_GROUPS}){_END}"), "per_unit"),
    (re.compile(rf"(?:אחד|אחת){_END}(?=\s*(?:$|[.,?!;:\n]|[0-9]|עוד{_END}|מהם{_END}|מהן{_END}"
                rf"|מה(?:{_GROUPS}){_END}))"), "per_unit"),
)
_BEFORE_EACH = (
    re.compile(rf"(?:^|[^{_LETTER}])(?:{_IMPERATIVES})\s+$"),
    re.compile(rf"(?:^|[^{_LETTER}])התאימו(?:\s+[^\s.?!:;\n]{{1,20}}){{1,4}}\s+$"),
)
_CONDITIONAL = (
    re.compile(rf"\s+(?:לא\s+)?(?:היה|הייתה|הייתי|היית|היינו|הייתם){_END}"),
    re.compile(rf"\s+ה[{_LETTER}]{{2,20}}\s+(?:לא\s+)?(?:היה|הייתה|היו){_END}"),
    re.compile(rf"\s+(?![מה])[{_LETTER}]{{2,20}}\s+(?:לא\s+)?(?:היה|הייתה){_END}"),
)
STATEMENT = "המילים שהשער מחפש בשאלה נקראו לפי תבניות סגורות: כמות ליחידה, הוראת פעולה או תנאי. אין בשאלה טענה כוללת או בקשת מנייה."


def _each(text, start, end):
    """Reading of one 'לכל ' occurrence, or None when it may be a claim."""
    before = text[:start]
    prefix = before[-1:] if before else ""
    if re.match(rf"[{_LETTER}]", prefix):
        # Only the conjunction ו may be attached: "שלכל" is "that for every".
        if prefix != "ו" or re.match(rf"[{_LETTER}]", before[-2:-1] or " "):
            return None
        before = before[:-1]
    rest = text[end:].lstrip(" ")
    for pattern, reading in _AFTER_EACH:
        if pattern.match(rest):
            return reading
    if any(pattern.search(before) for pattern in _BEFORE_EACH):
        return "instruction"
    return None


def _which(text, start, end):
    """Reading of one 'אילו' occurrence, or None when it may ask to enumerate."""
    before, after = text[start - 1:start] if start else "", text[end:]
    if re.match(rf"[{_LETTER}]", after[:1] or " "):
        return None  # a longer word; not judged here
    if before == "כ" and not re.match(rf"[{_LETTER}]", text[start - 2:start - 1] or " "):
        return "as_if"
    if re.match(rf"[{_LETTER}]", before or " "):
        return None
    return "conditional" if any(pattern.match(after) for pattern in _CONDITIONAL) else None


def scan(text):
    """Every occurrence of a gate word: {"gate", "word", "reading"}.

    ``reading`` is None for a claim the gate must judge, otherwise the
    benign reading. Order follows the gates: G32 words, then G33 words.
    """
    found = []
    for gate, words in GATE_WORDS.items():
        for word in words:
            for match in re.finditer(re.escape(word), text):
                if word == "לכל ":
                    reading = _each(text, match.start(), match.end())
                elif word == "אילו":
                    reading = _which(text, match.start(), match.end())
                else:
                    reading = None
                found.append({"gate": gate, "word": word.strip(), "reading": reading})
    return found


def claims(text):
    """The occurrences that stay claims: what G32 / G33 should fail on."""
    return [{"gate": row["gate"], "word": row["word"]} for row in scan(text) if row["reading"] is None]


def gate_text(question):
    """The text the pinned gate reads for one content.json question: every string in it."""
    parts = []

    def walk(value):
        if isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str):
            parts.append(value)
    walk(question)
    return "\n".join(parts)


def register(ledger, questions):
    """Record the reading for each question whose gate words are ALL benign.

    ``ledger`` is the pinned content_truth.Ledger and ``questions`` the
    records about to be written to content.json. A question with any claim,
    or with no gate word, is left alone, so the gates judge it unchanged.
    A question that already has its own entry (a measured figure) is left
    alone too. Returns the question labels that were recorded.
    """
    recorded = []
    held = {str(entry.get("id")) for entry in ledger.entries}
    for question in questions:
        label = str(question["n"])
        rows = scan(gate_text(question))
        if not rows or label in held:
            continue
        open_claims = [row for row in rows if row["reading"] is None]
        if open_claims:
            continue
        ledger.claim(label, STATEMENT, (len(open_claims) == 0, {"words": rows}), method="closed_form")
        recorded.append(label)
    return recorded


def claim_lint(question):
    """Claims in one source question (rich spans), before anything is rendered.

    Advisory: the pinned gates still decide on the built content.json. A
    caller can use a non-empty result to replace the question first.
    """
    parts = []

    def spans(value):
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, list):
            for span in value:
                if isinstance(span, dict) and span.get("kind") == "text" and isinstance(span.get("text"), str):
                    parts.append(span["text"])
                elif isinstance(span, list):
                    spans(span)
                else:
                    parts.append(" ")

    if isinstance(question, dict):
        spans(question.get("intro"))
        for item in question.get("items") or []:
            if isinstance(item, dict):
                spans(item.get("prompt"))
        table = question.get("table")
        if isinstance(table, dict):
            for cell in table.get("head") or []:
                spans(cell)
            for row in table.get("rows") or []:
                spans(row)
    return claims(" ".join(parts))
