"""Hebrew-only text rules of the structured wire ``worksheet-wire/5`` and the IR atom rule.

Three surfaces, one rule set (V5-DESIGN §2.2, §2.8, §4):

- ``lint_model_text``: one text field a model wrote. Only Hebrew words, punctuation and ``{nK}``
  references to typed givens; every number lives in a given or a math field.
- ``check_ir_text`` / ``check_ir_spans``: code-written IR text spans and the atom rule over a span
  list (Hebrew between two atoms, no bracket touching an atom).
- ``lint_levels``: the pre-render lint of every printed levels.json string (CLI below).

Codes only, never the offending text (G11). Imports: the standard library;
``general_source.DRAWING_REQUEST`` lazily (so the CLI stays light). CONTROL and MARKUP are
copies of general_source.py:17-18, held equal by a test.

CLI: python3 -B text_lint.py --levels <levels.json>  → exit 0 clean, 1 findings (codes and paths on stdout)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

REF = re.compile(r"\{n([1-8])\}")
ARGUMENT_WORDS = ("הוכיחו", "הראו", "נמקו", "הסבירו", "מדוע", "למה", "בדקו", "שכנעו", "ודאו", "אמתו")

# Closed strong list (0..20 in every gender and construct form, the tens, מאה, מאתיים, אלף, the unit
# fractions, תריסר, פעמיים), including common defective spellings. A word matches after up to three
# prefix letters (ו ה ב כ ל מ ש) are stripped.
NUMBER_WORDS = (
    "אפס",
    "שתיים", "שתים", "שניים", "שתי",
    "שלוש", "שלושה", "שלושת", "שלש", "שלשה", "שלשת",
    "ארבע", "ארבעה", "ארבעת",
    "חמש", "חמישה", "חמשה", "חמשת",
    "שש", "שישה", "ששה", "ששת",
    "שבע", "שבעה", "שבעת",
    "שמונה", "שמונת",
    "תשע", "תשעה", "תשעת",
    "עשר", "עשרה", "עשרת",
    "עשרים", "שלושים", "שלשים", "ארבעים", "חמישים", "חמשים", "שישים", "ששים", "שבעים", "שמונים", "תשעים",
    "מאה", "מאתיים", "אלף",
    "חצי", "שליש", "רבע", "שלישים", "רבעים",
    "תריסר", "פעמיים",
)
# Weak words are allowed in idioms (לפחות אחד, יום שני, שנים = years); text never feeds a task.
WEAK_NUMBER_WORDS = ("אחד", "אחת", "שני", "שנייה", "שניה", "שנים")

CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]")
MARKUP = re.compile(r"[<>$\\]|(?:https?|file|data):", re.I)
HEBREW = re.compile(r"[\u05d0-\u05ea]")
NIQQUD = re.compile(r"[\u05b0-\u05bc\u05c1\u05c2\u05c7]")

_LETTERS = frozenset(chr(c) for c in range(0x05D0, 0x05EB))
_NIQQUD = frozenset(chr(c) for c in list(range(0x05B0, 0x05BD)) + [0x05C1, 0x05C2, 0x05C7])
_MARKS = frozenset("\u05be\u05f3\u05f4")                 # maqaf, geresh, gershayim
PUNCTUATION = frozenset(".,;:!?\"'\u2013\u2026")    # . , ; : ! ? " ' en dash, ellipsis
BRACKETS = frozenset("()")
MODEL_TEXT_CHARS = _LETTERS | _NIQQUD | _MARKS | PUNCTUATION | BRACKETS | {" "}
IR_TEXT_CHARS = MODEL_TEXT_CHARS | {"\u00a0"}         # a no-break space joins a Hebrew unit word (stage 3)
_GLUE_BEFORE = _LETTERS | _NIQQUD | frozenset("\u05f3\u05f4")   # a Hebrew letter, its vowel or geresh
_PREFIX = "והבכלמש"
_NUMBER_SET = frozenset(NUMBER_WORDS)
_ARGUMENT = re.compile("(?<![\u05d0-\u05ea])ו?(?:%s)(?![\u05d0-\u05ea])" % "|".join(ARGUMENT_WORDS))

# Outside $…$ in levels.json: no digit, Latin letter or math sign (the design list plus the pinned
# check_plain_math symbols and the ASCII hyphen-minus, which the house DSL reads as a minus).
LEVELS_MATH = frozenset("+-\u2212\u00d7\u00f7=<>%\u00b0\u00b2\u00b3\u221a\u00b7/*^\\[]{}"
                        "\u2220\u25b3\u2245\u2260\u2194\u2225\u22a5")
MAX_LEVELS_BYTES = 4_000_000


def _strip_niqqud(text: str) -> str:
    return NIQQUD.sub("", text)


def _number_word(token: str) -> bool:
    candidates = [token] + [token[i:] for i in range(1, min(3, len(token) - 2) + 1)
                            if all(ch in _PREFIX for ch in token[:i])]
    return any(candidate in _NUMBER_SET for candidate in candidates)


_MEDIAL = {"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"}


def _inflections(word: str) -> tuple:
    """The word, its plural and its construct form (משוואה → משוואות, משוואת; שוויון → שוויונות)."""
    out = [word]
    if word.endswith("ה"):
        out += [word[:-1] + "ות", word[:-1] + "ת"]
    elif word.endswith("ות") and len(word) > 3:
        out.append(word[:-2] + "ויות")
    elif not word.endswith("ת"):
        stem = word[:-1] + _MEDIAL.get(word[-1], word[-1])     # a final letter takes its medial form
        out += [stem + "ים", stem + "ות"]
    return tuple(dict.fromkeys(out))


def _term_pattern(term: str):
    words = _strip_niqqud(term).replace("\u05be", " ").split()
    if not words:
        return None
    parts = [re.escape(w) for w in words[:-1]] + ["(?:%s)" % "|".join(map(re.escape, _inflections(words[-1])))]
    return re.compile("(?<![\u05d0-\u05ea])[%s]{0,4}%s(?![\u05d0-\u05ea])" % (_PREFIX, r"[\s\u05be]+".join(parts)))


def forbidden_term_hits(text: str, forbidden_terms) -> bool:
    """True when a forbidden term (with up to four prefix letters or a plural/construct ending) occurs."""
    plain = _strip_niqqud(text)
    for term in (forbidden_terms,) if isinstance(forbidden_terms, str) else forbidden_terms:
        pattern = _term_pattern(term) if type(term) is str else None
        if pattern is not None and pattern.search(plain):
            return True
    return False


def _neighbour(text: str, index: int, step: int) -> str:
    """The nearest non-whitespace character from ``index`` in direction ``step`` ('' at the edge)."""
    while 0 <= index < len(text):
        if not text[index].isspace():
            return text[index]
        index += step
    return ""


def lint_model_text(text: str, *, grade: int, declared, forbidden_terms, max_length: int):
    """(codes, refs used) for one model text field: TEXT_LENGTH, TEXT_MARKUP (CONTROL/MARKUP of general_source :17-18),
    TEXT_CHAR, TEXT_GLUED_REF, TEXT_PAREN_ADJACENT, TEXT_NUMBER_WORD, TEXT_ARGUMENT_REQUEST, TEXT_FORBIDDEN_TERM,
    TEXT_DRAWING_REQUEST (general_source.DRAWING_REQUEST, imported), TEXT_NIQQUD, TEXT_NOT_HEBREW, REF_UNDECLARED.

    Also ATOM_ADJACENT (two references with no Hebrew letter between them: each becomes an atom). Codes are
    sorted and unique; refs are the given ids in order of first use. TEXT_GLUED_REF covers a Hebrew letter
    glued to a reference on either side (ב{n1}, {n1}ב); ב־{n1} is fine. "" gives ([], ()); a caller
    lints only non-empty fields and handles a table cell that is exactly one reference itself."""
    if type(grade) is not int or type(max_length) is not int:
        raise ValueError("grade and max_length must be integers")
    if type(text) is not str:
        return ["TEXT_CHAR"], ()
    if text == "":
        return [], ()
    codes = set()
    if len(text) > max_length:
        codes.add("TEXT_LENGTH")
    if CONTROL.search(text) or MARKUP.search(text):
        codes.add("TEXT_MARKUP")
    known = frozenset(declared or ())
    refs, spans = [], []
    for match in REF.finditer(text):
        given = "n" + match.group(1)
        if given not in refs:
            refs.append(given)
        if given not in known:
            codes.add("REF_UNDECLARED")
        spans.append(match.span())
    literal = REF.sub(" ", text)
    if any(ch not in MODEL_TEXT_CHARS for ch in literal):
        codes.add("TEXT_CHAR")
    for start, stop in spans:
        before = text[start - 1] if start else ""
        after = text[stop] if stop < len(text) else ""
        if before in _GLUE_BEFORE or after in _LETTERS:
            codes.add("TEXT_GLUED_REF")
        if _neighbour(text, start - 1, -1) in BRACKETS or _neighbour(text, stop, 1) in BRACKETS:
            codes.add("TEXT_PAREN_ADJACENT")
    for (_, stop), (start, _) in zip(spans, spans[1:]):
        if not HEBREW.search(text[stop:start]):
            codes.add("ATOM_ADJACENT")
    plain = _strip_niqqud(literal)
    if any(_number_word(token) for token in re.findall("[\u05d0-\u05ea]+", plain)):
        codes.add("TEXT_NUMBER_WORD")
    if _ARGUMENT.search(plain):
        codes.add("TEXT_ARGUMENT_REQUEST")
    if forbidden_term_hits(literal, forbidden_terms or ()):
        codes.add("TEXT_FORBIDDEN_TERM")
    from general_source import DRAWING_REQUEST
    if DRAWING_REQUEST.search(plain):
        codes.add("TEXT_DRAWING_REQUEST")
    if (grade >= 3 and NIQQUD.search(text)) or (grade <= 2 and HEBREW.search(text) and not NIQQUD.search(text)):
        codes.add("TEXT_NIQQUD")
    if not HEBREW.search(literal):
        codes.add("TEXT_NOT_HEBREW")
    return sorted(codes), tuple(refs)


def check_ir_text(text: str) -> list:
    """Codes for one code-written IR text span: TEXT_MARKUP, TEXT_CHAR; TEXT_NOT_HEBREW unless punctuation only."""
    if type(text) is not str:
        return ["TEXT_CHAR"]
    codes = set()
    if CONTROL.search(text) or MARKUP.search(text):
        codes.add("TEXT_MARKUP")
    if any(ch not in IR_TEXT_CHARS for ch in text):
        codes.add("TEXT_CHAR")
    if not HEBREW.search(text):
        visible = [ch for ch in text if not ch.isspace()]
        if not visible or any(ch not in PUNCTUATION and ch not in BRACKETS and ch not in _MARKS for ch in visible):
            codes.add("TEXT_NOT_HEBREW")
    return sorted(codes)


def _is_text(span) -> bool:
    return isinstance(span, dict) and span.get("kind") == "text" and type(span.get("text")) is str


def check_ir_spans(spans: list) -> list:
    """Atom rule over one span list: ATOM_ADJACENT (two displays without a Hebrew text span between),
    TEXT_PAREN_ADJACENT (a text span ending '(' or starting ')' next to a display).

    Every span that is not a text span is an atom. Brackets are refused on the side touching an atom in
    both directions (design rule 2: no bracket in prose next to an island), whitespace ignored."""
    if not isinstance(spans, (list, tuple)):
        raise TypeError("spans must be a list")
    codes, hebrew, seen_atom = set(), False, False
    for span in spans:
        if _is_text(span):
            hebrew = hebrew or bool(HEBREW.search(span["text"]))
        else:
            if seen_atom and not hebrew:
                codes.add("ATOM_ADJACENT")
            seen_atom, hebrew = True, False
    for index, span in enumerate(spans):
        if not _is_text(span):
            continue
        tail, head = span["text"].rstrip(), span["text"].lstrip()
        if index + 1 < len(spans) and not _is_text(spans[index + 1]) and tail and tail[-1] in BRACKETS:
            codes.add("TEXT_PAREN_ADJACENT")
        if index > 0 and not _is_text(spans[index - 1]) and head and head[0] in BRACKETS:
            codes.add("TEXT_PAREN_ADJACENT")
    return sorted(codes)


def _bad_prose_char(ch: str) -> bool:
    return (ch.isdigit() or "A" <= ch <= "Z" or "a" <= ch <= "z" or "\u00c0" <= ch <= "\u024f"
            or ch in LEVELS_MATH)


def lint_string(value) -> list:
    """Codes for one printed levels.json string (see lint_levels)."""
    if type(value) is not str:
        return ["ATOM_LEVELS_INVALID"]
    codes = set()
    if CONTROL.search(value):
        codes.add("TEXT_MARKUP")
    parts = value.split("$")
    if len(parts) % 2 == 0:
        codes.add("ATOM_LEVELS_INVALID")
        return sorted(codes)
    prose, islands = parts[0::2], parts[1::2]
    if any(not island.strip() for island in islands):
        codes.add("ATOM_LEVELS_INVALID")
    if any(_bad_prose_char(ch) for piece in prose for ch in piece):
        codes.add("TEXT_CHAR")
    if any(not HEBREW.search(piece) for piece in prose[1:-1]):
        codes.add("ATOM_ADJACENT")
    for index in range(len(islands)):
        tail, head = prose[index].rstrip(), prose[index + 1].lstrip()
        if (tail and tail[-1] in BRACKETS) or (head and head[0] in BRACKETS):
            codes.add("TEXT_PAREN_ADJACENT")
    return sorted(codes)


def lint_levels(levels: list) -> list:
    """Pre-render lint of every levels.json string (title, rule, intros, item texts, answers): outside $…$ no digit,
    Latin or math symbol; Hebrew between islands; even '$' count. Returns [(json_path, code)].

    Paths are JSON Pointers (RFC 6901). Also TEXT_MARKUP (a control or bidi character), TEXT_PAREN_ADJACENT
    (a bracket in prose touching an island) and ATOM_LEVELS_INVALID (odd '$', an empty island, or a missing
    or non-string field). Other levels.json fields (grade, part ranges, gate metadata) are not printed
    prose here and are not linted."""
    findings = []

    def check(path, value):
        findings.extend((path, code) for code in lint_string(value))

    def invalid(path):
        findings.append((path, "ATOM_LEVELS_INVALID"))

    if type(levels) is not list or not levels:
        invalid("")
        return findings
    for li, level in enumerate(levels):
        base = "/%d" % li
        if type(level) is not dict:
            invalid(base)
            continue
        check(base + "/title", level.get("title"))
        check(base + "/rule", level.get("rule"))
        questions = level.get("questions")
        if type(questions) is not list:
            invalid(base + "/questions")
        else:
            for qi, question in enumerate(questions):
                where = "%s/questions/%d" % (base, qi)
                if type(question) is not dict or type(question.get("items")) is not list:
                    invalid(where)
                    continue
                check(where + "/intro", question.get("intro"))
                for ii, item in enumerate(question["items"]):
                    if type(item) is not dict:
                        invalid("%s/items/%d" % (where, ii))
                        continue
                    check("%s/items/%d/text" % (where, ii), item.get("text"))
                    check("%s/items/%d/answer" % (where, ii), item.get("answer"))
        answers = level.get("answers")
        if type(answers) is not list:
            invalid(base + "/answers")
            continue
        for ai, row in enumerate(answers):
            where = "%s/answers/%d" % (base, ai)
            if type(row) is not list or len(row) < 2 or type(row[1]) is not list:
                invalid(where)
                continue
            for ri, pair in enumerate(row[1]):
                if type(pair) is not list or len(pair) != 2:
                    invalid("%s/1/%d" % (where, ri))
                    continue
                check("%s/1/%d/1" % (where, ri), pair[1])
    return findings


def _read_levels(path: Path):
    data = path.read_bytes()
    if len(data) > MAX_LEVELS_BYTES:
        raise ValueError("levels.json too large")

    def pairs(items):
        out = {}
        for key, value in items:
            if key in out:
                raise ValueError("duplicate JSON field")
            out[key] = value
        return out

    def constant(_):
        raise ValueError("non-finite number")

    return json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=constant)


def main(argv=None, output=None) -> int:
    """CLI entry: exit 0 clean, 1 findings (one 'CODE<TAB>path' line each, then a summary line)."""
    output = output or sys.stdout
    parser = argparse.ArgumentParser(description="Pre-render lint of levels.json strings (worksheet-wire/5).")
    parser.add_argument("--levels", required=True)
    args = parser.parse_args(argv)
    try:
        levels = _read_levels(Path(args.levels))
    except (OSError, ValueError, UnicodeDecodeError):
        findings = [("", "ATOM_LEVELS_INVALID")]
    else:
        findings = lint_levels(levels)
    for path, code in findings:
        print("%s\t%s" % (code, path), file=output)
    print("levels-lint: %s (%d findings)" % ("FAIL" if findings else "PASS", len(findings)), file=output)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
