"""Contract table of the structured wire ``worksheet-wire/5`` (stage 2).

One table drives three outputs that must never drift apart:

(a) the strict-safe response schema of one lesson (``wire_schema``);
(b) the per-topic authoring card text a model would read (``authoring_card``);
(c) the plan rows of one sheet, planned and reserve (``plan_rows``).

The module also holds the code registry, the shared limits, the g7 overlay and
the final-authority check of the IR selection record (``validate_selection``).

Nothing here parses mathematics, reads a file, calls a model or renders.
Imports: the standard library, plus ``runtime_catalog`` lazily (grade floor).

The overlay is NOT reviewed (D7). Every code-written Hebrew string in it -- the
title, the rule box, the instruction verbs, the template and layout texts --
waits for Noam's sign-off; ``reviewed`` stays False until then.

Code names follow G9 (``^[A-Z_]{1,60}$``, no digits). Three names in the design
table carried a digit and could never reach the job row (MIG/PILOT:13); they are
registered under the digit-free names listed in ``DESIGN_RENAMES``.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
import re
from types import MappingProxyType

CONTRACT = "worksheet-wire/5"
CODE_RE = re.compile(r"^[A-Z_]{1,60}$")
SLOT_RE = re.compile(r"^(?:Q|R)[1-9][0-9]?$")
PLANNED_SLOT_RE = re.compile(r"^Q[1-9][0-9]?$")
BY_RE = re.compile(r"^(?:R[1-9][0-9]?|REPAIR)$")

QUESTION_FIELDS = ("slot", "kind", "intro", "givens", "table", "items")
ITEM_FIELDS = ("text", "expr", "expr2", "values", "ask", "form", "variant")
GIVEN_FIELDS = ("id", "type", "value", "unit")
TABLE_FIELDS = ("head", "rows")
GIVEN_IDS = ("n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8")
GIVEN_TYPES = ("number", "decimal", "fraction", "percent", "money", "measure", "count", "var", "expr",
               "fact", "list")
LIMITS = MappingProxyType({
    "intro": 300, "text": 200, "expr": 120, "expr2": 120, "values": 40, "cell": 40, "given_value": 60,
    "items_min": 3, "items_max": 6, "givens_max": 8, "table_cols": 6, "table_rows": 8, "reply_bytes": 200_000,
})
FORMS = ("expression", "integer")
# Key forms of the elementary overlays (division_kinds): a whole number, or a quotient with its remainder.
ELEMENTARY_FORMS = ("integer", "quotient_remainder")
GRADE_LINE = MappingProxyType({7: "כיתה ז׳", 8: "כיתה ח׳", 9: "כיתה ט׳"})

PRACTICE, CHALLENGES = "practice", "challenges"
CHALLENGE_SLOTS = 3          # planned positions N-2..N are challenges (skill_authoring.question_plan)
ORIGINS = ("planned", "reserve", "repair")
SELECTION_FIELDS = ("requested", "floor", "delivered", "questions", "replaced", "dropped")
SELECTION_QUESTION_FIELDS = ("n", "slot", "origin", "conceptIds", "star")
SELECTION_REPLACED_FIELDS = ("slot", "by", "codes")
SELECTION_DROPPED_FIELDS = ("slot", "codes")
MAX_REPLACED = 32
MAX_ENTRY_CODES = 16

# Strict-mode schema keywords (plan §d4): nothing else may appear in a generated schema.
SCHEMA_KEYWORDS = frozenset({"type", "properties", "required", "additionalProperties", "items", "enum",
                             "minItems", "maxItems", "minLength", "maxLength"})
SCHEMA_FORBIDDEN = frozenset({"anyOf", "oneOf", "allOf", "not", "pattern", "patternProperties", "const",
                              "format", "minProperties", "maxProperties", "if", "then", "else", "$ref",
                              "$defs", "definitions", "dependentRequired", "dependentSchemas",
                              "unevaluatedProperties", "prefixItems", "contains"})
SCHEMA_MAX_DEPTH = 6

# Authoring card bounds: 3 KB (either reading) to 5,000 bytes; no notation glyphs (plan §d2).
CARD_MIN_BYTES = 3072
CARD_MAX_BYTES = 5000
CARD_FORBIDDEN = ("$", "\\", "[[", "]]", "\u00b7", "\u00d7", "\u00f7", "\u2212", "\u221a")  # $ \ [[ ]] middle dot, times, divide, minus sign, root

# ------------------------------------------------------------------ code registry (§4)

DESIGN_RENAMES = MappingProxyType({
    "V5_TOPIC_UNSUPPORTED": "WIRE_TOPIC_UNSUPPORTED",
    "V5_SCOPE_UNSUPPORTED": "WIRE_SCOPE_UNSUPPORTED",
    "SOURCE_V5_SCOPE": "SOURCE_WIRE_SCOPE",
})

# Codes general_source.py raises today (grep at 8ea258a8); the v5 hooks keep them.
EXISTING_SOURCE_CODES = (
    "SOURCE_ANSWER", "SOURCE_CONCEPT", "SOURCE_COVERAGE", "SOURCE_FIGURE", "SOURCE_FIGURE_TASK",
    "SOURCE_GEOMETRY", "SOURCE_ITEMS", "SOURCE_JSON", "SOURCE_LANGUAGE", "SOURCE_NIQQUD", "SOURCE_NOTATION",
    "SOURCE_NUMBER", "SOURCE_PLAIN_MATH", "SOURCE_QUESTIONS", "SOURCE_RICH_TEXT", "SOURCE_SCOPE",
    "SOURCE_SECTIONS", "SOURCE_SHAPE", "SOURCE_SIZE", "SOURCE_STAR", "SOURCE_STARS", "SOURCE_TABLE",
    "SOURCE_TEXT", "SOURCE_VERSION", "SOURCE_VOLUME", "DRAWING_POLICY",
)

CODE_GROUPS = MappingProxyType({
    "sheet_input": ("WIRE_JSON", "WIRE_SHAPE", "WIRE_TOPIC_UNSUPPORTED"),
    "question_shape": ("Q_SHAPE", "Q_SLOT_UNKNOWN", "Q_SLOT_DUPLICATE", "Q_KIND_NOT_ALLOWED", "FIELD_NOT_EMPTY",
                       "ITEM_COUNT", "ITEM_SHAPE", "QUESTION_MISSING"),
    "text": ("TEXT_LENGTH", "TEXT_MARKUP", "TEXT_CHAR", "TEXT_GLUED_REF", "TEXT_PAREN_ADJACENT",
             "TEXT_NUMBER_WORD", "TEXT_ARGUMENT_REQUEST", "TEXT_FORBIDDEN_TERM", "TEXT_DRAWING_REQUEST",
             "TEXT_NIQQUD", "TEXT_NOT_HEBREW", "ATOM_ADJACENT"),
    "references": ("REF_UNDECLARED", "REF_UNUSED", "GIVEN_SHAPE", "GIVEN_VALUE"),
    "math": ("MATH_PARSE", "MATH_LENGTH", "MATH_SYMBOL_UNDECLARED", "MATH_SCOPE_PRODUCT_OF_SUM",
             "MATH_SCOPE_BRACKETS", "MATH_SCOPE_POWER", "MATH_SCOPE_DIVISION", "MATH_SCOPE_DECIMAL",
             "MATH_SCOPE_PERCENT", "MATH_SCOPE_PRODUCT", "MATH_SCOPE_RANGE", "MATH_SCOPE_TERMS",
             "MATH_SCOPE_LETTERS", "MATH_SCOPE_RELATION", "TASK_LITERAL"),
    "key_display": ("FORM_UNKNOWN", "FORM_UNREPRESENTABLE", "KEY_ROUNDTRIP", "DISPLAY_ROUNDTRIP",
                    "DISPLAY_INVALID", "BINDING_INTERNAL"),
    "binding": ("TEMPLATE_UNKNOWN", "TEMPLATE_MISMATCH", "VALUES_SHAPE", "VALUES_MISMATCH", "MISTAKE_UNKNOWN",
                "MISTAKE_NOT_APPLICABLE", "MISTAKE_UNMODELED", "MISTAKE_NOT_WRONG", "NOTHING_TO_DO",
                "REVEALS_ANSWER"),
    # The elementary division kinds (division_kinds, overlay ד10): a drill expr that is not NUMBER:NUMBER, a
    # story ask outside the kind's asks, a story whose division leaves no remainder (its three asks would not be
    # three answers), a starred story without the overlay's challenge profile, and a printed ask text that lacks
    # its wording cue (a template/ask mismatch in code-written text).
    "division": ("DIVISION_SHAPE", "ASK_UNKNOWN", "STORY_REMAINDER_ZERO", "CHALLENGE_PROFILE", "WORDING_CUE"),
    # The source-side mirror of the pinned elementary G62 clone gate (division_kinds.clone_hits): an item whose
    # structure the sheet already printed as often as the pinned profile allows (sheet loop, final adapter check).
    "structure": ("STRUCTURE_REPEATED", "SOURCE_STRUCTURE"),
    # The probability kinds (probability_kinds, overlay g9r:probability): a probability that is not strictly between
    # 0 and 1 (the model's expr or the key), an expr that is not the probability its ask names (it disagrees with
    # the story's canonical probability at the givens or at a fixed probe point), and a later item of a question
    # with the same key value as an earlier one (one answer would give the other away).
    "probability": ("PROB_RANGE", "ASK_MISMATCH", "KEY_REPEATED"),
    # EXAMPLE_COPY (plan §c2) is emitted by leak_checks.sheet_leaks although §4 does not list it.
    # DUPLICATE_REORDERED (leak_checks.reordered_tasks): a later question repeats an earlier item's terms in
    # another order; added after the stage-2 review (a starred reserve repeated a practice item). Since stage 3
    # also a later item of the same question (leak_checks.reordered_items, structured_source.compile_question).
    "leaks": ("DUPLICATE_ITEM", "LEAK_OWN", "LEAK_LINKED", "LEAK_RULE_FACT", "LEAK_PINNED_VALUE",
              "DUPLICATE_TASK", "LEAK_SHEET_INVERSE", "EXAMPLE_COPY", "DUPLICATE_REORDERED"),
    # Raised while loading a pinned module by path (leak_checks.pinned_module; runner.verify_skill).
    "pinned": ("SKILL_HASH_MISMATCH", "SKILL_MODULE_NOT_STDLIB"),
    "sheet": ("SHEET_BELOW_MINIMUM", "SHEET_STARS", "SHEET_COVERAGE", "REPAIR_BUDGET", "REPAIR_SLOT_NOT_MISSING",
              "RUNTIME_NOT_CONFIGURED"),
    "ir_validator": ("SOURCE_WIRE_SCOPE", "SOURCE_DISPLAY", "SOURCE_ATOM", "SOURCE_KEY", "SOURCE_BINDING",
                     "SOURCE_SELECTION", "SOURCE_LEAK") + EXISTING_SOURCE_CODES,
    "runner": ("WIRE_SCOPE_UNSUPPORTED", "PINNED_REPORT_MISSING", "PINNED_REPORT_INVALID", "ATOM_MISSING",
               "ATOM_NOT_FLAT", "ATOM_ANCHOR_MISSING", "ATOM_PDF_UNREADABLE", "ATOM_LEVELS_INVALID",
               "PDF_PRODUCER_NOT_WEASYPRINT"),
    "contract": ("CARD_CHAR", "CARD_SIZE"),
    # Recorded in the compile diagnostics for the owner's review; never a refusal (leak_checks.equivalent_tasks).
    "warnings": ("EQUIVALENT_TASK",),
})
CODES = frozenset(code for group in CODE_GROUPS.values() for code in group)
KERNEL_PREFIX = "KERNEL_"


class SelectionError(ValueError):
    """code ∈ SOURCE_SELECTION, SOURCE_COVERAGE; reason is short English, never model text."""

    def __init__(self, code: str, reason: str):
        self.code = code
        self.reason = reason
        super().__init__(reason)


class ContractError(ValueError):
    """code ∈ WIRE_TOPIC_UNSUPPORTED, CARD_CHAR, CARD_SIZE; message is short English, never lesson text."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def kernel_code(math_task_code: str) -> str:
    """'KERNEL_' + code; ValueError unless the result matches CODE_RE (an empty kernel code is refused too)."""
    if type(math_task_code) is not str or not math_task_code:
        raise ValueError("Kernel code must be a non-empty string")
    code = KERNEL_PREFIX + math_task_code
    if not CODE_RE.match(code):
        raise ValueError("Kernel code does not match the code alphabet")
    return code


def is_known_code(code) -> bool:
    """True for a registered code or a well-formed KERNEL_* code."""
    if type(code) is not str or not CODE_RE.match(code):
        return False
    return code in CODES or (code.startswith(KERNEL_PREFIX) and len(code) > len(KERNEL_PREFIX))


# ------------------------------------------------------------------ the overlay (§2.7)

def _freeze(value):
    """dict → read-only mapping, list → tuple, recursively (the curriculum_scope convention)."""
    if isinstance(value, (dict, MappingProxyType)):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze(item) for item in value)
    return value


def thaw(value):
    """A fresh plain copy (dict/list) of frozen overlay data, ready for JSON or an IR."""
    if isinstance(value, (dict, MappingProxyType)):
        return {key: thaw(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [thaw(item) for item in value]
    return value


_W_TEMPLATES = ("W_TIMES", "W_SUM", "W_DIFF", "W_PRODUCT", "W_TIMES_PLUS", "W_TIMES_MINUS", "W_TWO_TIMES")

_G7_ALGEBRAIC_EXPRESSIONS = {
    "topicId": "g7:algebraic_expressions",
    "reviewed": False,
    "pendingReview": ("title", "rule", "verbs", "templates", "layouts", "forbiddenTerms"),
    "levels": ("b",),
    # The catalog title names חוק הפילוג and זהות, which the lesson excludes, so the title is curated.
    "title": "ביטויים אלגבריים: הצבה וכינוס איברים דומים",
    "letters": ("x", "y", "a", "b"),          # = kernel symbols; identity map in stage 2
    "conceptKinds": {"g7:algebraic_expressions#0": ("write_from_words",),
                     "g7:algebraic_expressions#1": ("substitute",),
                     "g7:algebraic_expressions#2": ("collect_like_terms",)},
    "challengeKinds": {"find_error_collect": ("g7:algebraic_expressions#2",)},
    # The contract table per kind. Every item field a kind does not read must be "". For every stage-2
    # kind intro is "", givens is [], table is {"head": [], "rows": []} and each item's text is "".
    "kinds": {
        "write_from_words": {
            "group": PRACTICE, "reads": ("expr", "variant"), "form": "expression", "asks": ("",),
            "variants": _W_TEMPLATES,
            "card": "expr is what a student writes for a Hebrew phrase that code builds from variant, so expr "
                    "has exactly the shape of its variant.",
        },
        "substitute": {
            "group": PRACTICE, "reads": ("expr", "values"), "form": "integer", "asks": ("",), "variants": ("",),
            "card": "expr is evaluated at values, which give each letter of expr one whole number, as a=3 or "
                    "x=2, y=-1; expr is never a single letter.",
        },
        "collect_like_terms": {
            "group": PRACTICE, "reads": ("expr",), "form": "expression", "asks": ("",), "variants": ("",),
            "card": "expr has like terms for the student to collect; it is never already collected.",
        },
        "find_error_collect": {
            "group": CHALLENGES, "reads": ("expr", "expr2", "variant"), "form": "expression", "asks": ("",),
            "variants": ("M1", "M2", "M3"),
            "card": "a student collects expr with the mistake named by variant; expr2 is exactly that wrong "
                    "result, and expr is never already collected.",
        },
    },
    "profile": {"literal_max": 20, "result_literal_max": 99, "value_min": -10, "value_max": 10,
                "terms_max": 4, "letters_max": 2, "power": False, "division": False, "decimal": False,
                "percent": False, "explicit_product": False, "brackets": "negative_number"},
    "levelNotes": {"b": "Level b: a guided entry, one step per item, friendly numbers."},
    # Tier A instructions, written by code above each question (reviewed: False).
    "verbs": {"write_from_words": "כתבו ביטוי אלגברי מתאים לכל תיאור:",
              "substitute": "חשבו את ערך הביטוי:",
              "collect_like_terms": "כנסו איברים דומים:",
              "find_error_collect": "בכל סעיף תלמיד כינס איברים דומים וטעה. רשמו את התוצאה הנכונה."},
    # Tier A templates of write_from_words: k, m are numbers in templateNumbers, v != w are letters.
    # A layout is a sequence of ("T", Hebrew text) and ("D", placeholder) parts; every number is a
    # coefficient glued to a letter, so a key never holds a standalone integer (§2.7, D12).
    "templateNumbers": (2, 20),
    "templates": {
        "W_TIMES": {"shape": "kv", "layout": (("T", "מספר הגדול פי "), ("D", "k"), ("T", " מ־"), ("D", "v"))},
        "W_SUM": {"shape": "v+w", "layout": (("T", "הסכום של "), ("D", "v"), ("T", " ו־"), ("D", "w"))},
        "W_DIFF": {"shape": "v-w", "layout": (("T", "ההפרש בין "), ("D", "v"), ("T", " לבין "), ("D", "w"))},
        "W_PRODUCT": {"shape": "vw", "layout": (("T", "המכפלה של "), ("D", "v"), ("T", " ב־"), ("D", "w"))},
        "W_TIMES_PLUS": {"shape": "kv+w", "layout": (("T", "פי "), ("D", "k"), ("T", " מ־"), ("D", "v"),
                                                     ("T", " ועוד "), ("D", "w"))},
        "W_TIMES_MINUS": {"shape": "kv-w", "layout": (("T", "פי "), ("D", "k"), ("T", " מ־"), ("D", "v"),
                                                      ("T", " פחות "), ("D", "w"))},
        "W_TWO_TIMES": {"shape": "kv+mw", "layout": (("T", "פי "), ("D", "k"), ("T", " מ־"), ("D", "v"),
                                                     ("T", " ועוד פי "), ("D", "m"), ("T", " מ־"), ("D", "w"))},
    },
    # Fixed layouts of the other kinds; substitute joins a second value with valueSeparator.
    "layouts": {
        "collect_like_terms": (("D", "expr"),),
        "substitute": (("D", "expr"), ("T", " עבור "), ("D", "value")),
        "find_error_collect": (("T", "כינוס הביטוי "), ("D", "expr"), ("T", " נתן "), ("D", "wrong")),
    },
    "valueSeparator": " ו־",
    "units": (),
    "rule": [{"kind": "text", "text": "ביטוי אלגברי הוא ביטוי שיש בו מספרים, משתנים ופעולות חשבון. כדי למצוא את ערך "
              "הביטוי מציבים מספר במקום המשתנה. איברים דומים הם איברים שיש להם אותו חלק של משתנים. כדי לכנס איברים "
              "דומים מחברים או מחסרים את המספרים שלפני המשתנה, למשל: "},
             {"kind": "display", "notation": "3x+5x=8x", "symbols": ["x"]}, {"kind": "text", "text": "."}],
    "ruleFacts": (("3x+5x", "8x"),),
    "forbiddenTerms": ("חוק הפילוג", "פילוג", "זהות", "משוואה", "חזקה", "שוויון"),
    "mistakes": ("M1", "M2", "M3"),
    # English card notes; the examples use numbers outside the profile so a copied example is refused.
    "mistakeNotes": {
        "M1": "adds every coefficient and number into one term with the first letter: 24a+33+a+35 gives 93a.",
        "M2": "turns the first subtraction into an addition: 26x+37-21-22x gives 4x+58.",
        "M3": "drops the first bare-letter term that has a like term: 25b+32a+b gives 25b+32a.",
    },
    "examples": {
        "write_from_words": {"text": "", "expr": "25y", "expr2": "", "values": "", "ask": "", "form": "",
                             "variant": "W_TIMES"},
        "substitute": {"text": "", "expr": "30a-a", "expr2": "", "values": "a=15", "ask": "", "form": "",
                       "variant": ""},
        "collect_like_terms": {"text": "", "expr": "31x+47+26x-15", "expr2": "", "values": "", "ask": "",
                               "form": "", "variant": ""},
        "find_error_collect": {"text": "", "expr": "24a+33+a+35", "expr2": "93a", "values": "", "ask": "",
                               "form": "", "variant": "M1"},
    },
    "exampleQuestion": ("collect_like_terms", ("31x+47+26x-15", "-22y+43+35y-27", "38b-23+b-29")),
}

def _story(intro, full_groups, leftover, groups_needed):
    """One Tier A story template: the intro as T/D parts (n1 = the whole amount, n2 = the size of one group) and
    one code-written question per ask."""
    return {"intro": intro, "asks": {"full_groups": full_groups, "leftover": leftover,
                                     "groups_needed": groups_needed}}


# The elementary overlay of ד10 (grade 4, חילוק ארוך ושארית), level a only, for the repro lesson: concepts #0
# חילוק ארוך (מאונך) and #1 מנה ושארית; #2 בדיקת חילוק is not yet taught ("עדיין לא למדנו בדיקת חילוק בעזרת כפל"),
# so no kind, verb, story or rule mentions multiplication or checking. Every Hebrew string here is code-written
# Tier A text and NOT reviewed (D7): reviewed stays False until Noam signs. Tier B (model-written story context)
# stays off: the model chooses a story template, the two whole numbers of its givens and the three asks.
_D10_LONG_DIVISION = {
    "topicId": "ד10",
    "skill": "elementary",
    "reviewed": False,
    "pendingReview": ("title", "rule", "verbs", "stories", "remainderWord", "profile", "challengeRule",
                      "forbiddenTerms"),
    "levels": ("a",),
    "title": "חילוק ארוך ושארית",
    "letters": (),
    "conceptKinds": {"ד10#0": ("division_remainder_drill", "division_story"),
                     "ד10#1": ("division_story",)},
    # Starred questions are stories written for a challenge row (the star follows the row, as validate_selection
    # requires); a starred story must also meet challengeRule.
    "challengeKinds": {"division_story": ("ד10#1",)},
    "kinds": {
        "division_remainder_drill": {
            "groups": (PRACTICE,), "reads": ("expr",), "form": "quotient_remainder", "asks": ("",),
            "variants": ("",), "givens": False, "items": (3, 3),
            "card": "expr is one division NUMBER:NUMBER, as 4371:6; code prints it with a blank and keys the quotient "
                    "with its remainder. Three items, all different.",
        },
        "division_story": {
            "groups": (PRACTICE, CHALLENGES), "reads": ("expr", "variant", "ask"), "form": "integer",
            "asks": ("full_groups", "leftover", "groups_needed"), "variants": (
                "S_PENCILS", "S_EGGS", "S_BOATS", "S_SHELVES", "S_COOKIES", "S_TEAMS", "S_BOTTLES", "S_STICKERS"),
            "givens": True, "items": (3, 3),
            "card": "variant names a story code writes around two givens: n1 (type count) is the whole amount and "
                    "n2 (type count) the size of one group. Every item has expr {n1}:{n2} and one ask; the three "
                    "items ask full_groups, leftover and groups_needed once each. The division must leave a "
                    "remainder.",
        },
    },
    # Level a: a three-digit dividend and a one-digit divisor of at least 2, with and without a remainder.
    "profile": {"dividend_min": 100, "dividend_max": 999, "divisor_min": 2, "divisor_max": 9},
    # A starred story divides so that the quotient has a zero digit (413:4 gives 103), the long-division step
    # most often skipped; a practice reserve standing in for a challenge prints unstarred and needs none.
    "challengeRule": "quotient_zero_digit",
    "asks": {"full_groups": "floor", "leftover": "remainder", "groups_needed": "ceil"},
    # Wording cues of a printed ask (checked on every story text at compile time and in the final validator).
    "cues": {"full": r"(?<![א-ת])[הבלוכמש]?(?:מלא|שלמ)", "leftover": r"(?:יישאר|נשאר|שארית)",
             "needed": r"צריך[^.?!]*כדי"},
    "givenTypes": ("count",),
    "units": (),
    "verbs": {"division_remainder_drill": "פתרו בחילוק ארוך. אם יש שארית, כתבו גם אותה."},
    # The word between the two atoms of a drill key: "31 שארית 1" (the order pinned gate G66 requires).
    "remainderWord": "שארית",
    "stories": {
        "S_PENCILS": _story((("T", "בחנות יש "), ("D", "n1"), ("T", " עפרונות. אורזים אותם בקופסאות, "),
                             ("D", "n2"), ("T", " עפרונות בכל קופסה.")),
                            "כמה קופסאות מלאות יהיו?", "כמה עפרונות יישארו מחוץ לקופסאות המלאות?",
                            "כמה קופסאות צריך כדי לארוז את כל העפרונות?"),
        "S_EGGS": _story((("T", "בלול נאספו "), ("D", "n1"), ("T", " ביצים. מסדרים אותן בתבניות, "), ("D", "n2"),
                          ("T", " ביצים בכל תבנית.")),
                         "כמה תבניות מלאות יהיו?", "כמה ביצים יישארו מחוץ לתבניות המלאות?",
                         "כמה תבניות צריך כדי לסדר את כל הביצים?"),
        "S_BOATS": _story((("T", "לשיט יצאו "), ("D", "n1"), ("T", " ילדים. בכל סירה יש מקום ל־"), ("D", "n2"),
                           ("T", " ילדים.")),
                          "כמה סירות יהיו מלאות?", "כמה ילדים יישארו בלי מקום בסירות המלאות?",
                          "כמה סירות צריך כדי שכל הילדים יצאו לשיט?"),
        "S_SHELVES": _story((("T", "בספרייה יש "), ("D", "n1"), ("T", " ספרים חדשים. מסדרים אותם על מדפים, "),
                             ("D", "n2"), ("T", " ספרים על כל מדף.")),
                            "כמה מדפים מלאים יהיו?", "כמה ספרים יישארו מחוץ למדפים המלאים?",
                            "כמה מדפים צריך כדי לסדר את כל הספרים?"),
        "S_COOKIES": _story((("T", "לקראת המסיבה אפו "), ("D", "n1"), ("T", " עוגיות. אורזים אותן בשקיות, "),
                             ("D", "n2"), ("T", " עוגיות בכל שקית.")),
                            "כמה שקיות מלאות יהיו?", "כמה עוגיות יישארו מחוץ לשקיות המלאות?",
                            "כמה שקיות צריך כדי לארוז את כל העוגיות?"),
        "S_TEAMS": _story((("T", "בטורניר משתתפים "), ("D", "n1"), ("T", " תלמידים. מחלקים אותם לקבוצות, "),
                           ("D", "n2"), ("T", " תלמידים בכל קבוצה.")),
                          "כמה קבוצות מלאות יהיו?", "כמה תלמידים יישארו מחוץ לקבוצות המלאות?",
                          "כמה קבוצות צריך כדי שכל התלמידים ישחקו?"),
        "S_BOTTLES": _story((("T", "במפעל מילאו "), ("D", "n1"), ("T", " בקבוקי מיץ. אורזים אותם בארגזים, "),
                             ("D", "n2"), ("T", " בקבוקים בכל ארגז.")),
                            "כמה ארגזים מלאים יהיו?", "כמה בקבוקים יישארו מחוץ לארגזים המלאים?",
                            "כמה ארגזים צריך כדי לארוז את כל הבקבוקים?"),
        "S_STICKERS": _story((("T", "לנועה יש "), ("D", "n1"), ("T", " מדבקות. היא מדביקה אותן בשורות, "),
                              ("D", "n2"), ("T", " מדבקות בכל שורה.")),
                             "כמה שורות מלאות יהיו?", "כמה מדבקות יישארו מחוץ לשורות המלאות?",
                             "כמה שורות צריך כדי להדביק את כל המדבקות?"),
    },
    # The rule box (code-written) and the division it shows as a worked example (EXAMPLE_COPY for an item).
    # No text span ends with ':' before an atom (or starts with one after it): in the elementary atom-order check
    # ':' is an atom glyph (the division sign), so an adjacent colon would glue onto the atom's glyph run.
    # The middle overlay's write_from_words templates and fixed layouts have no elementary counterpart: the stories
    # above are the elementary Tier A texts. Both shapes keep these keys so a reader of every overlay finds them.
    "templates": {},
    "layouts": {},
    "rule": [{"kind": "text", "text": "בחילוק ארוך מחלקים קודם את המאות, אחר כך את העשרות ובסוף את היחידות. מה "
              "שנשאר בסוף קטן מהמחלק, והוא נקרא שארית. למשל, "},
             {"kind": "display", "notation": "125:4=31", "symbols": []}, {"kind": "text", "text": " שארית "},
             {"kind": "display", "notation": "1", "symbols": []}, {"kind": "text", "text": "."}],
    "ruleExamples": (("125", "4"),),
    "forbiddenTerms": ("בדיקת חילוק", "בדיקה", "בדקו", "כפל", "שבר", "עשרוני", "אחוז"),
    "levelNotes": {"a": "Level a: a three-digit number divided by a one-digit number (2 to 9), with and without "
                        "a remainder. Checking a division by multiplication is not taught yet."},
    # Card examples deliberately outside the profile (four-digit dividends), so a copied example is refused.
    "exampleQuestion": ("division_remainder_drill", ("4371:6", "5208:7", "6115:8")),
    "examples": {
        "division_remainder_drill": {"text": "", "expr": "4371:6", "expr2": "", "values": "", "ask": "", "form": "",
                                     "variant": ""},
        "division_story": {"text": "", "expr": "{n1}:{n2}", "expr2": "", "values": "", "ask": "full_groups",
                           "form": "", "variant": "S_PENCILS"},
    },
}

def _prob_story(kind, categories, intro, asks, table=None):
    """One Tier A probability story: the intro as T/D parts (n1..nK = the counts of the K categories), the
    code-written question of every ask of the story and, for a relative-frequency story, its one-way table (head
    labels and the label of the count row; the count cells are the givens)."""
    out = {"kind": kind, "categories": categories, "intro": intro, "asks": asks}
    if table is not None:
        out["table"] = {"head": table[0], "rowHead": table[1]}
    return out


PROBABILITY_FORMS = ("fraction", "decimal", "percent")
_P0, _P1, _P2, _P3 = ("g9r:probability#%d" % n for n in range(4))
_TWO_STAGE_ASKS = ("both_1", "both_2", "first_1_second_2", "first_2_second_1", "one_of_each", "same")

# The probability overlay of g9r:probability (grade 9, track ט רגילה), level e only, for the repro lesson: concepts
# #0 מהי הסתברות, מושגים בסיסיים, #1 חישובי הסתברות והקשר לשכיחות יחסית, #2 מאורע משלים and #3 מאורעות דו־שלביים.
# The teacher wrote that a tree diagram was learned and a two-way table was not: no kind prints a two-way table,
# and no kind draws (this is not a geometry page, so there is no figure field and no tree drawing). Every Hebrew
# string is code-written Tier A text and NOT reviewed (D7). Tier B (model-written story context) stays off: the
# model chooses a story, the counts of its givens, one ask and one form per item, and writes the probability the
# ask names as expr over the givens; code prints every sentence and table and keys the kernel's value of the
# story's own (canonical) probability of the ask.
_G9R_PROBABILITY = {
    "topicId": "g9r:probability",
    "family": "probability",
    "reviewed": False,
    "pendingReview": ("title", "rule", "stories", "tables", "formNotes", "profile", "challengeRule",
                      "forbiddenTerms"),
    "levels": ("e",),
    "title": "הסתברות: שכיחות יחסית, מאורע משלים ומאורעות דו־שלביים",
    "letters": (),
    "conceptKinds": {_P0: ("single_draw_probability",),
                     _P1: ("relative_frequency",),
                     _P2: ("complement_probability",),
                     _P3: ("two_stage_with_replacement", "two_stage_without_replacement")},
    # Starred questions are two-draw stories without replacement written for a challenge row; every item of one
    # asks an event of more than one branch, or at least one of a colour (challengeAsks).
    "challengeKinds": {"two_stage_without_replacement": (_P3,)},
    "challengeAsks": ("one_of_each", "same", "at_least_one_1", "at_least_one_2"),
    "kinds": {
        "single_draw_probability": {
            "groups": (PRACTICE,), "reads": ("expr", "variant", "ask"), "form": "fraction", "forms": ("fraction",),
            "asks": ("one_1", "one_2", "one_3", "either_12", "either_13", "either_23"),
            "variants": ("D_BALLS", "D_CARDS", "D_CANDIES", "D_CLUB"), "givens": True, "items": (3, 6),
            "replacement": None, "counts": {"min": 2, "max": 20, "totalMin": 6, "totalMax": 40},
            "card": "one draw, three categories n1 n2 n3. one_k: category k; either_jk: category j or k.",
        },
        "relative_frequency": {
            "groups": (PRACTICE,), "reads": ("expr", "variant", "ask"), "form": "fraction",
            "forms": PROBABILITY_FORMS,
            "asks": ("freq_1", "freq_2", "freq_3", "freq_4", "prob_1", "prob_2", "prob_3", "prob_4"),
            "variants": ("F_SPINNER", "F_SURVEY", "F_CARS", "F_DRAWS"), "givens": True, "items": (3, 6),
            "replacement": None, "counts": {"min": 1, "max": 400, "totalMin": 10, "totalMax": 1000},
            "card": "a one-way table of counts n1..n4 (n1..n3 in F_DRAWS). freq_k: the relative frequency of "
                    "outcome k; prob_k: the probability it gives. form fraction, decimal (two places at most) or "
                    "percent (whole).",
        },
        "complement_probability": {
            "groups": (PRACTICE,), "reads": ("expr", "variant", "ask"), "form": "fraction", "forms": ("fraction",),
            "asks": ("not_first_1", "not_first_2", "at_least_one_1", "at_least_one_2"),
            "variants": ("C_BALLS", "C_SPINNER", "C_CARDS"), "givens": True, "items": (3, 4),
            "replacement": True, "counts": {"min": 2, "max": 20, "totalMin": 4, "totalMax": 30},
            "card": "two draws with replacement, categories n1 n2. not_first_k: the first draw is not k; "
                    "at_least_one_k: 1 minus the probability of no k.",
        },
        "two_stage_with_replacement": {
            "groups": (PRACTICE,), "reads": ("expr", "variant", "ask"), "form": "fraction", "forms": ("fraction",),
            "asks": _TWO_STAGE_ASKS, "variants": ("R_BALLS", "R_SPINNER", "R_CARDS"), "givens": True,
            "items": (3, 6), "replacement": True, "counts": {"min": 2, "max": 20, "totalMin": 4, "totalMax": 30},
            "card": "two draws with replacement, categories n1 n2: products of fractions.",
        },
        "two_stage_without_replacement": {
            "groups": (PRACTICE, CHALLENGES), "reads": ("expr", "variant", "ask"), "form": "fraction",
            "forms": ("fraction",), "asks": _TWO_STAGE_ASKS + ("at_least_one_1", "at_least_one_2"),
            "variants": ("N_BALLS", "N_PENS", "N_MARBLES"), "givens": True, "items": (3, 6),
            "replacement": False, "counts": {"min": 2, "max": 20, "totalMin": 4, "totalMax": 30},
            "card": "two draws without replacement, categories n1 n2: the second fraction counts what is left.",
        },
    },
    # A story prints each count before a plural noun ("5 כדורים"), so a bag count is at least 2; a table cell may
    # hold 1. Keys: a reduced fraction, a decimal of at most decimalPlaces places, or a whole percent.
    "profile": {"decimalPlaces": 2, "percentPlaces": 0, "literals": (1, 2), "power": 2},
    "challengeRule": "combined_event",
    "givenTypes": ("count",),
    "units": (),
    # The form instruction of an item whose kind declares more than one form (code-written, after the ask).
    "formNotes": {"fraction": "כתבו את התשובה כשבר מצומצם.", "decimal": "כתבו את התשובה כמספר עשרוני.",
                  "percent": "כתבו את התשובה באחוזים."},
    "stories": {
        "D_BALLS": _prob_story("single_draw_probability", 3, (
            ("T", "בשקית יש "), ("D", "n1"), ("T", " כדורים אדומים, "), ("D", "n2"), ("T", " כדורים כחולים ו־"),
            ("D", "n3"), ("T", " כדורים ירוקים. מוציאים מהשקית כדור באקראי.")), {
            "one_1": "מה ההסתברות להוציא כדור אדום?", "one_2": "מה ההסתברות להוציא כדור כחול?",
            "one_3": "מה ההסתברות להוציא כדור ירוק?", "either_12": "מה ההסתברות להוציא כדור אדום או כחול?",
            "either_13": "מה ההסתברות להוציא כדור אדום או ירוק?",
            "either_23": "מה ההסתברות להוציא כדור כחול או ירוק?"}),
        "D_CARDS": _prob_story("single_draw_probability", 3, (
            ("T", "בקופסה יש "), ("D", "n1"), ("T", " כרטיסים צהובים, "), ("D", "n2"), ("T", " כרטיסים לבנים ו־"),
            ("D", "n3"), ("T", " כרטיסים סגולים. בוחרים מהקופסה כרטיס באקראי.")), {
            "one_1": "מה ההסתברות לבחור כרטיס צהוב?", "one_2": "מה ההסתברות לבחור כרטיס לבן?",
            "one_3": "מה ההסתברות לבחור כרטיס סגול?", "either_12": "מה ההסתברות לבחור כרטיס צהוב או לבן?",
            "either_13": "מה ההסתברות לבחור כרטיס צהוב או סגול?",
            "either_23": "מה ההסתברות לבחור כרטיס לבן או סגול?"}),
        "D_CANDIES": _prob_story("single_draw_probability", 3, (
            ("T", "בצנצנת יש "), ("D", "n1"), ("T", " סוכריות בטעם תות, "), ("D", "n2"),
            ("T", " סוכריות בטעם לימון ו־"), ("D", "n3"),
            ("T", " סוכריות בטעם ענבים. שולפים מהצנצנת סוכרייה באקראי.")), {
            "one_1": "מה ההסתברות לשלוף סוכרייה בטעם תות?", "one_2": "מה ההסתברות לשלוף סוכרייה בטעם לימון?",
            "one_3": "מה ההסתברות לשלוף סוכרייה בטעם ענבים?",
            "either_12": "מה ההסתברות לשלוף סוכרייה בטעם תות או בטעם לימון?",
            "either_13": "מה ההסתברות לשלוף סוכרייה בטעם תות או בטעם ענבים?",
            "either_23": "מה ההסתברות לשלוף סוכרייה בטעם לימון או בטעם ענבים?"}),
        "D_CLUB": _prob_story("single_draw_probability", 3, (
            ("T", "בחוג מדעים משתתפים "), ("D", "n1"), ("T", " תלמידים מכיתה ז׳, "), ("D", "n2"),
            ("T", " תלמידים מכיתה ח׳ ו־"), ("D", "n3"), ("T", " תלמידים מכיתה ט׳. בוחרים באקראי תלמיד מהחוג.")), {
            "one_1": "מה ההסתברות שהתלמיד שנבחר לומד בכיתה ז׳?",
            "one_2": "מה ההסתברות שהתלמיד שנבחר לומד בכיתה ח׳?",
            "one_3": "מה ההסתברות שהתלמיד שנבחר לומד בכיתה ט׳?",
            "either_12": "מה ההסתברות שהתלמיד שנבחר לומד בכיתה ז׳ או בכיתה ח׳?",
            "either_13": "מה ההסתברות שהתלמיד שנבחר לומד בכיתה ז׳ או בכיתה ט׳?",
            "either_23": "מה ההסתברות שהתלמיד שנבחר לומד בכיתה ח׳ או בכיתה ט׳?"}),
        "F_SPINNER": _prob_story("relative_frequency", 4, (
            ("T", "דנה סובבה חץ על לוח צבעוני פעמים רבות. בטבלה רשום כמה פעמים נעצר החץ על כל צבע."),), {
            "freq_1": "מהי השכיחות היחסית של הצבע אדום?", "freq_2": "מהי השכיחות היחסית של הצבע כחול?",
            "freq_3": "מהי השכיחות היחסית של הצבע צהוב?", "freq_4": "מהי השכיחות היחסית של הצבע ירוק?",
            "prob_1": "העריכו לפי הטבלה את ההסתברות שבסיבוב הבא ייעצר החץ על הצבע אדום.",
            "prob_2": "העריכו לפי הטבלה את ההסתברות שבסיבוב הבא ייעצר החץ על הצבע כחול.",
            "prob_3": "העריכו לפי הטבלה את ההסתברות שבסיבוב הבא ייעצר החץ על הצבע צהוב.",
            "prob_4": "העריכו לפי הטבלה את ההסתברות שבסיבוב הבא ייעצר החץ על הצבע ירוק."},
            (("צבע", "אדום", "כחול", "צהוב", "ירוק"), "מספר הפעמים")),
        "F_SURVEY": _prob_story("relative_frequency", 4, (
            ("T", "בסקר שאלו תלמידים איזה ענף ספורט הם אוהבים יותר מכול. בטבלה רשום כמה תלמידים בחרו בכל ענף."),), {
            "freq_1": "מהי השכיחות היחסית של התלמידים שבחרו בכדורגל?",
            "freq_2": "מהי השכיחות היחסית של התלמידים שבחרו בכדורסל?",
            "freq_3": "מהי השכיחות היחסית של התלמידים שבחרו בשחייה?",
            "freq_4": "מהי השכיחות היחסית של התלמידים שבחרו בטניס?",
            "prob_1": "בוחרים באקראי תלמיד שהשתתף בסקר. מה ההסתברות שהוא בחר בכדורגל?",
            "prob_2": "בוחרים באקראי תלמיד שהשתתף בסקר. מה ההסתברות שהוא בחר בכדורסל?",
            "prob_3": "בוחרים באקראי תלמיד שהשתתף בסקר. מה ההסתברות שהוא בחר בשחייה?",
            "prob_4": "בוחרים באקראי תלמיד שהשתתף בסקר. מה ההסתברות שהוא בחר בטניס?"},
            (("ענף", "כדורגל", "כדורסל", "שחייה", "טניס"), "מספר התלמידים")),
        "F_CARS": _prob_story("relative_frequency", 4, (
            ("T", "בצומת ספרו במשך שעה את המכוניות שעברו בו, לפי הצבע שלהן."),), {
            "freq_1": "מהי השכיחות היחסית של המכוניות הלבנות?", "freq_2": "מהי השכיחות היחסית של המכוניות השחורות?",
            "freq_3": "מהי השכיחות היחסית של המכוניות האפורות?", "freq_4": "מהי השכיחות היחסית של המכוניות האדומות?",
            "prob_1": "העריכו לפי הטבלה את ההסתברות שהמכונית הבאה שתעבור בצומת תהיה לבנה.",
            "prob_2": "העריכו לפי הטבלה את ההסתברות שהמכונית הבאה שתעבור בצומת תהיה שחורה.",
            "prob_3": "העריכו לפי הטבלה את ההסתברות שהמכונית הבאה שתעבור בצומת תהיה אפורה.",
            "prob_4": "העריכו לפי הטבלה את ההסתברות שהמכונית הבאה שתעבור בצומת תהיה אדומה."},
            (("צבע", "לבן", "שחור", "אפור", "אדום"), "מספר המכוניות")),
        "F_DRAWS": _prob_story("relative_frequency", 3, (
            ("T", "יואב הוציא כדור משקית, רשם את צבעו והחזיר אותו לשקית. הוא חזר על כך פעמים רבות. בטבלה רשום "
                  "כמה פעמים יצא כל צבע."),), {
            "freq_1": "מהי השכיחות היחסית של הכדורים האדומים שיצאו?",
            "freq_2": "מהי השכיחות היחסית של הכדורים הכחולים שיצאו?",
            "freq_3": "מהי השכיחות היחסית של הכדורים הירוקים שיצאו?",
            "prob_1": "העריכו לפי הטבלה את ההסתברות שבהוצאה הבאה ייצא כדור אדום.",
            "prob_2": "העריכו לפי הטבלה את ההסתברות שבהוצאה הבאה ייצא כדור כחול.",
            "prob_3": "העריכו לפי הטבלה את ההסתברות שבהוצאה הבאה ייצא כדור ירוק."},
            (("צבע", "אדום", "כחול", "ירוק"), "מספר הפעמים")),
        "C_BALLS": _prob_story("complement_probability", 2, (
            ("T", "בשקית יש "), ("D", "n1"), ("T", " כדורים ירוקים ו־"), ("D", "n2"),
            ("T", " כדורים כחולים. מוציאים מהשקית כדור באקראי, רושמים את צבעו ומחזירים אותו לשקית. אחר כך "
                  "מוציאים שוב כדור באקראי.")), {
            "not_first_1": "מה ההסתברות שבהוצאה הראשונה לא ייצא כדור ירוק?",
            "not_first_2": "מה ההסתברות שבהוצאה הראשונה לא ייצא כדור כחול?",
            "at_least_one_1": "מה ההסתברות שלפחות אחד משני הכדורים שהוציאו יהיה ירוק?",
            "at_least_one_2": "מה ההסתברות שלפחות אחד משני הכדורים שהוציאו יהיה כחול?"}),
        "C_SPINNER": _prob_story("complement_probability", 2, (
            ("T", "לוח עגול מחולק לגזרות שוות: "), ("D", "n1"), ("T", " גזרות כתומות ו־"), ("D", "n2"),
            ("T", " גזרות סגולות. מסובבים את החץ שעל הלוח, רושמים את הצבע שעליו נעצר ומסובבים אותו שוב.")), {
            "not_first_1": "מה ההסתברות שבסיבוב הראשון החץ לא ייעצר על גזרה כתומה?",
            "not_first_2": "מה ההסתברות שבסיבוב הראשון החץ לא ייעצר על גזרה סגולה?",
            "at_least_one_1": "מה ההסתברות שלפחות באחד משני הסיבובים ייעצר החץ על גזרה כתומה?",
            "at_least_one_2": "מה ההסתברות שלפחות באחד משני הסיבובים ייעצר החץ על גזרה סגולה?"}),
        "C_CARDS": _prob_story("complement_probability", 2, (
            ("T", "בחפיסה יש "), ("D", "n1"), ("T", " קלפים שחורים ו־"), ("D", "n2"),
            ("T", " קלפים אדומים. בוחרים מהחפיסה קלף באקראי, רושמים את צבעו ומחזירים אותו לחפיסה. אחר כך "
                  "בוחרים שוב קלף באקראי.")), {
            "not_first_1": "מה ההסתברות שהקלף הראשון שנבחר לא יהיה שחור?",
            "not_first_2": "מה ההסתברות שהקלף הראשון שנבחר לא יהיה אדום?",
            "at_least_one_1": "מה ההסתברות שלפחות אחד משני הקלפים שנבחרו יהיה שחור?",
            "at_least_one_2": "מה ההסתברות שלפחות אחד משני הקלפים שנבחרו יהיה אדום?"}),
        "R_BALLS": _prob_story("two_stage_with_replacement", 2, (
            ("T", "בשקית יש "), ("D", "n1"), ("T", " כדורים לבנים ו־"), ("D", "n2"),
            ("T", " כדורים שחורים. מוציאים מהשקית כדור באקראי, רושמים את צבעו ומחזירים אותו לשקית. אחר כך "
                  "מוציאים שוב כדור באקראי.")), {
            "both_1": "מה ההסתברות ששני הכדורים שהוציאו לבנים?",
            "both_2": "מה ההסתברות ששני הכדורים שהוציאו שחורים?",
            "first_1_second_2": "מה ההסתברות שהכדור הראשון לבן והכדור השני שחור?",
            "first_2_second_1": "מה ההסתברות שהכדור הראשון שחור והכדור השני לבן?",
            "one_of_each": "מה ההסתברות שהוציאו כדור לבן אחד וכדור שחור אחד?",
            "same": "מה ההסתברות ששני הכדורים שהוציאו לבנים או ששניהם שחורים?"}),
        "R_SPINNER": _prob_story("two_stage_with_replacement", 2, (
            ("T", "לוח עגול מחולק לגזרות שוות: "), ("D", "n1"), ("T", " גזרות כחולות ו־"), ("D", "n2"),
            ("T", " גזרות צהובות. מסובבים את החץ שעל הלוח, רושמים את הצבע שעליו נעצר ומסובבים אותו שוב.")), {
            "both_1": "מה ההסתברות שבשני הסיבובים ייעצר החץ על גזרה כחולה?",
            "both_2": "מה ההסתברות שבשני הסיבובים ייעצר החץ על גזרה צהובה?",
            "first_1_second_2": "מה ההסתברות שבסיבוב הראשון ייעצר החץ על גזרה כחולה ובסיבוב השני על גזרה צהובה?",
            "first_2_second_1": "מה ההסתברות שבסיבוב הראשון ייעצר החץ על גזרה צהובה ובסיבוב השני על גזרה כחולה?",
            "one_of_each": "מה ההסתברות שבסיבוב אחד ייעצר החץ על גזרה כחולה ובסיבוב האחר על גזרה צהובה?",
            "same": "מה ההסתברות שבשני הסיבובים ייעצר החץ על גזרות באותו צבע?"}),
        "R_CARDS": _prob_story("two_stage_with_replacement", 2, (
            ("T", "בקופסה יש "), ("D", "n1"), ("T", " כרטיסים ירוקים ו־"), ("D", "n2"),
            ("T", " כרטיסים אדומים. בוחרים מהקופסה כרטיס באקראי, רושמים את צבעו ומחזירים אותו לקופסה. אחר כך "
                  "בוחרים שוב כרטיס באקראי.")), {
            "both_1": "מה ההסתברות ששני הכרטיסים שנבחרו ירוקים?",
            "both_2": "מה ההסתברות ששני הכרטיסים שנבחרו אדומים?",
            "first_1_second_2": "מה ההסתברות שהכרטיס הראשון ירוק והכרטיס השני אדום?",
            "first_2_second_1": "מה ההסתברות שהכרטיס הראשון אדום והכרטיס השני ירוק?",
            "one_of_each": "מה ההסתברות שנבחרו כרטיס ירוק אחד וכרטיס אדום אחד?",
            "same": "מה ההסתברות ששני הכרטיסים שנבחרו ירוקים או ששניהם אדומים?"}),
        "N_BALLS": _prob_story("two_stage_without_replacement", 2, (
            ("T", "בשקית יש "), ("D", "n1"), ("T", " כדורים אדומים ו־"), ("D", "n2"),
            ("T", " כדורים צהובים. מוציאים מהשקית כדור באקראי ולא מחזירים אותו. אחר כך מוציאים מהשקית כדור נוסף "
                  "באקראי.")), {
            "both_1": "מה ההסתברות ששני הכדורים שהוציאו אדומים?",
            "both_2": "מה ההסתברות ששני הכדורים שהוציאו צהובים?",
            "first_1_second_2": "מה ההסתברות שהכדור הראשון אדום והכדור השני צהוב?",
            "first_2_second_1": "מה ההסתברות שהכדור הראשון צהוב והכדור השני אדום?",
            "one_of_each": "מה ההסתברות שהוציאו כדור אדום אחד וכדור צהוב אחד?",
            "same": "מה ההסתברות ששני הכדורים שהוציאו אדומים או ששניהם צהובים?",
            "at_least_one_1": "מה ההסתברות שלפחות אחד משני הכדורים שהוציאו יהיה אדום?",
            "at_least_one_2": "מה ההסתברות שלפחות אחד משני הכדורים שהוציאו יהיה צהוב?"}),
        "N_PENS": _prob_story("two_stage_without_replacement", 2, (
            ("T", "בקלמר יש "), ("D", "n1"), ("T", " עטים כחולים ו־"), ("D", "n2"),
            ("T", " עטים שחורים. מוציאים מהקלמר עט באקראי ולא מחזירים אותו. אחר כך מוציאים מהקלמר עט נוסף "
                  "באקראי.")), {
            "both_1": "מה ההסתברות ששני העטים שהוציאו כחולים?",
            "both_2": "מה ההסתברות ששני העטים שהוציאו שחורים?",
            "first_1_second_2": "מה ההסתברות שהעט הראשון כחול והעט השני שחור?",
            "first_2_second_1": "מה ההסתברות שהעט הראשון שחור והעט השני כחול?",
            "one_of_each": "מה ההסתברות שהוציאו עט כחול אחד ועט שחור אחד?",
            "same": "מה ההסתברות ששני העטים שהוציאו כחולים או ששניהם שחורים?",
            "at_least_one_1": "מה ההסתברות שלפחות אחד משני העטים שהוציאו יהיה כחול?",
            "at_least_one_2": "מה ההסתברות שלפחות אחד משני העטים שהוציאו יהיה שחור?"}),
        "N_MARBLES": _prob_story("two_stage_without_replacement", 2, (
            ("T", "בכד יש "), ("D", "n1"), ("T", " גולות לבנות ו־"), ("D", "n2"),
            ("T", " גולות שחורות. שולפים מהכד גולה באקראי ולא מחזירים אותה. אחר כך שולפים מהכד גולה נוספת "
                  "באקראי.")), {
            "both_1": "מה ההסתברות ששתי הגולות שנשלפו לבנות?",
            "both_2": "מה ההסתברות ששתי הגולות שנשלפו שחורות?",
            "first_1_second_2": "מה ההסתברות שהגולה הראשונה לבנה והגולה השנייה שחורה?",
            "first_2_second_1": "מה ההסתברות שהגולה הראשונה שחורה והגולה השנייה לבנה?",
            "one_of_each": "מה ההסתברות שנשלפו גולה לבנה אחת וגולה שחורה אחת?",
            "same": "מה ההסתברות ששתי הגולות שנשלפו לבנות או ששתיהן שחורות?",
            "at_least_one_1": "מה ההסתברות שלפחות אחת משתי הגולות שנשלפו תהיה לבנה?",
            "at_least_one_2": "מה ההסתברות שלפחות אחת משתי הגולות שנשלפו תהיה שחורה?"}),
    },
    # The middle overlay's write_from_words templates and fixed layouts have no probability counterpart: the
    # stories above are the probability Tier A texts. Both keys stay so a reader of every overlay finds them.
    "templates": {},
    "layouts": {},
    # A relative-frequency question prints its counts in a one-way table (no two-way table: not taught yet).
    "tables": True,
    # Keys print as stacked fractions (\f) and decimals: the atom-order check runs in its fraction mode.
    "atomFractions": True,
    "rule": [{"kind": "text", "text": "ההסתברות של מאורע היא מספר בין אפס לאחת. כשלכל התוצאות יש אותו סיכוי, "
              "ההסתברות של מאורע היא מספר התוצאות המתאימות לו חלקי מספר כל התוצאות. השכיחות היחסית של תוצאה היא "
              "מספר הפעמים שהתקבלה חלקי מספר הפעמים שחזרו על הניסוי, והיא מאפשרת להעריך את ההסתברות שלה. "
              "ההסתברות של המאורע המשלים היא אחת פחות ההסתברות של המאורע, למשל "},
             {"kind": "display", "notation": "1-3/10=7/10", "symbols": []},
             {"kind": "text", "text": ". בניסוי דו־שלבי כופלים את ההסתברות של התוצאה בשלב הראשון בהסתברות של "
              "התוצאה בשלב השני, ובהוצאה בלי החזרה סופרים בשלב השני רק את מה שנשאר. כתבו כל הסתברות כשבר "
              "מצומצם, אלא אם נאמר אחרת."}],
    "forbiddenTerms": ("דיאגרמת עץ", "מודל השטח", "דו ממדית", "דו ממדי", "תוחלת", "בלתי תלויים"),
    "levelNotes": {"e": "Level e (excellence): two-step reasoning, complements and draws without replacement; "
                        "the relative-frequency answers come as a fraction, a decimal or a percent as declared."},
    # Card examples deliberately outside the profile (counts above 20 in a bag), so a copied example is refused.
    "exampleQuestion": ("two_stage_with_replacement", ("both_1", "both_2", "first_1_second_2")),
    "examples": {
        "single_draw_probability": {"text": "", "expr": "{n2}/({n1}+{n2}+{n3})", "expr2": "", "values": "",
                                    "ask": "one_2", "form": "", "variant": "D_BALLS"},
        "relative_frequency": {"text": "", "expr": "{n3}/({n1}+{n2}+{n3}+{n4})", "expr2": "", "values": "",
                               "ask": "freq_3", "form": "percent", "variant": "F_SPINNER"},
        "complement_probability": {"text": "", "expr": "1-({n2}/({n1}+{n2}))*({n2}/({n1}+{n2}))", "expr2": "",
                                   "values": "", "ask": "at_least_one_1", "form": "", "variant": "C_BALLS"},
        "two_stage_with_replacement": {"text": "", "expr": "({n1}/({n1}+{n2}))*({n1}/({n1}+{n2}))", "expr2": "",
                                       "values": "", "ask": "both_1", "form": "", "variant": "R_BALLS"},
        "two_stage_without_replacement": {"text": "", "expr": "({n1}/({n1}+{n2}))*({n2}/({n1}+{n2}-1))",
                                          "expr2": "", "values": "", "ask": "first_1_second_2", "form": "",
                                          "variant": "N_BALLS"},
    },
    "exampleGivens": ({"id": "n1", "type": "count", "value": "23", "unit": ""},
                      {"id": "n2", "type": "count", "value": "27", "unit": ""}),
}

OVERLAYS = MappingProxyType({
    _G7_ALGEBRAIC_EXPRESSIONS["topicId"]: _freeze(_G7_ALGEBRAIC_EXPRESSIONS),
    _D10_LONG_DIVISION["topicId"]: _freeze(_D10_LONG_DIVISION),
    _G9R_PROBABILITY["topicId"]: _freeze(_G9R_PROBABILITY),
})


def overlay_for(topic_id: str, level: str):
    """The frozen overlay when topic and level are v5-enabled, else None."""
    if type(topic_id) is not str or type(level) is not str:
        return None
    overlay = OVERLAYS.get(topic_id)
    if overlay is None or level not in overlay["levels"]:
        return None
    return overlay


def rule_spans(overlay) -> list:
    """The overlay's rule box as a fresh list of plain span dicts (IR-ready)."""
    return thaw(overlay["rule"])


def code_strings(overlay) -> list:
    """[(path, text)] of every code-written Hebrew string of one overlay, in a fixed order."""
    if overlay.get("family") == "probability":
        out = [("title", overlay["title"])]
        out += [("rule.%d" % i, span["text"]) for i, span in enumerate(overlay["rule"]) if span["kind"] == "text"]
        out += [("formNotes." + form, text) for form, text in overlay["formNotes"].items()]
        for sid, story in overlay["stories"].items():
            out += [("stories.%s.intro.%d" % (sid, i), value) for i, (part, value) in enumerate(story["intro"])
                    if part == "T"]
            out += [("stories.%s.asks.%s" % (sid, ask), text) for ask, text in story["asks"].items()]
            if "table" in story:
                out += [("stories.%s.table.head.%d" % (sid, i), text)
                        for i, text in enumerate(story["table"]["head"])]
                out.append(("stories.%s.table.rowHead" % sid, story["table"]["rowHead"]))
        return out
    if overlay.get("skill") == "elementary":
        out = [("title", overlay["title"])]
        out += [("verbs." + kind, text) for kind, text in overlay["verbs"].items()]
        out.append(("remainderWord", overlay["remainderWord"]))
        out += [("rule.%d" % i, span["text"]) for i, span in enumerate(overlay["rule"]) if span["kind"] == "text"]
        for sid, story in overlay["stories"].items():
            out += [("stories.%s.intro.%d" % (sid, i), value) for i, (part, value) in enumerate(story["intro"])
                    if part == "T"]
            out += [("stories.%s.asks.%s" % (sid, ask), text) for ask, text in story["asks"].items()]
        return out
    out = [("title", overlay["title"])]
    out += [("verbs." + kind, text) for kind, text in overlay["verbs"].items()]
    out += [("rule.%d" % i, span["text"]) for i, span in enumerate(overlay["rule"]) if span["kind"] == "text"]
    for tid, template in overlay["templates"].items():
        out += [("templates.%s.%d" % (tid, i), value) for i, (part, value) in enumerate(template["layout"])
                if part == "T"]
    for kind, layout in overlay["layouts"].items():
        out += [("layouts.%s.%d" % (kind, i), value) for i, (part, value) in enumerate(layout) if part == "T"]
    out.append(("valueSeparator", overlay["valueSeparator"]))
    return out


def _check_elementary_overlay(overlay, need) -> None:
    """check_overlay for an elementary overlay (skill "elementary": the division kinds of division_kinds)."""
    kinds = overlay["kinds"]
    need(overlay["reviewed"] is False or overlay["reviewed"] is True, "reviewed")
    need(tuple(overlay["letters"]) == (), "letters")
    for concept, names in overlay["conceptKinds"].items():
        need(concept.startswith(overlay["topicId"] + "#") and names, "conceptKinds")
        need(all(name in kinds and PRACTICE in kinds[name]["groups"] for name in names), "conceptKinds")
    for name, concepts in overlay["challengeKinds"].items():
        need(name in kinds and CHALLENGES in kinds[name]["groups"], "challengeKinds")
        need(concepts and all(c in overlay["conceptKinds"] for c in concepts), "challengeKinds")
    used = {name for names in overlay["conceptKinds"].values() for name in names} | set(overlay["challengeKinds"])
    need(used == set(kinds) == {"division_remainder_drill", "division_story"}, "kinds")
    for name, row in kinds.items():
        need(row["form"] in ELEMENTARY_FORMS and set(row["groups"]) <= {PRACTICE, CHALLENGES} and row["groups"],
             "kinds.form")
        need(set(row["reads"]) <= {"expr", "variant", "ask"} and "expr" in row["reads"], "kinds.reads")
        need(("ask" in row["reads"]) == (tuple(row["asks"]) != ("",)), "kinds.asks")
        need(("variant" in row["reads"]) == (tuple(row["variants"]) != ("",)), "kinds.variants")
        low, high = row["items"]
        need(LIMITS["items_min"] <= low <= high <= LIMITS["items_max"], "kinds.items")
        need(name in overlay["examples"] and tuple(overlay["examples"][name]) == ITEM_FIELDS, "examples")
    drill, story = kinds["division_remainder_drill"], kinds["division_story"]
    need(drill["form"] == "quotient_remainder" and drill["givens"] is False and "division_remainder_drill"
         in overlay["verbs"], "kinds.division_remainder_drill")
    need(story["form"] == "integer" and story["givens"] is True and set(story["asks"]) == set(overlay["asks"])
         and tuple(story["variants"]) == tuple(overlay["stories"]), "kinds.division_story")
    need(tuple(story["items"]) == (len(story["asks"]), len(story["asks"])), "kinds.division_story")
    need(set(overlay["asks"].values()) == {"floor", "remainder", "ceil"}, "asks")
    profile = overlay["profile"]
    need(2 <= profile["divisor_min"] <= profile["divisor_max"] and 1 <= profile["dividend_min"]
         <= profile["dividend_max"] <= 999_999, "profile")
    need(overlay["challengeRule"] in ("quotient_zero_digit", ""), "challengeRule")
    need(tuple(overlay["givenTypes"]) == ("count",) and tuple(overlay["units"]) == (), "givenTypes")
    need(overlay["remainderWord"] == "שארית", "remainderWord")      # the pinned G66 house form names this word
    texts = set()
    for story_row in overlay["stories"].values():
        parts = story_row["intro"]
        need(all(part in ("T", "D") for part, _ in parts) and parts[0][0] == "T"
             and all(a[0] != b[0] for a, b in zip(parts, parts[1:])), "stories.intro")
        need(sorted(value for part, value in parts if part == "D") == ["n1", "n2"], "stories.intro")
        need(set(story_row["asks"]) == set(overlay["asks"]), "stories.asks")
        texts.update(story_row["asks"].values())
    need(len(texts) == len(overlay["stories"]) * len(overlay["asks"]), "stories.asks")
    need(set(overlay["levelNotes"]) == set(overlay["levels"]), "levelNotes")
    # ':' is an atom glyph of the elementary atom-order check: no code-written text touches an atom with one.
    sequences = [[(span["kind"] == "text", span.get("text", "")) for span in overlay["rule"]]]
    sequences += [[(part == "T", value) for part, value in story_row["intro"]]
                  for story_row in overlay["stories"].values()]
    for sequence in sequences:
        for index, (is_text, value) in enumerate(sequence):
            if not is_text:
                continue
            if index + 1 < len(sequence) and not sequence[index + 1][0]:
                need(not value.rstrip().endswith(":"), "colon beside an atom")
            if index > 0 and not sequence[index - 1][0]:
                need(not value.lstrip().startswith(":"), "colon beside an atom")


_PROBABILITY_KINDS = ("single_draw_probability", "relative_frequency", "complement_probability",
                      "two_stage_with_replacement", "two_stage_without_replacement")


def _check_probability_overlay(overlay, need) -> None:
    """check_overlay for a probability overlay (family "probability": the kinds of probability_kinds)."""
    from probability_kinds import ASKS_BY_KIND, ask_available
    kinds = overlay["kinds"]
    need(overlay["reviewed"] is False or overlay["reviewed"] is True, "reviewed")
    need(tuple(overlay["letters"]) == () and overlay.get("skill", "middle") == "middle", "letters")
    for concept, names in overlay["conceptKinds"].items():
        need(concept.startswith(overlay["topicId"] + "#") and names, "conceptKinds")
        need(all(name in kinds and PRACTICE in kinds[name]["groups"] for name in names), "conceptKinds")
    for name, concepts in overlay["challengeKinds"].items():
        need(name in kinds and CHALLENGES in kinds[name]["groups"], "challengeKinds")
        need(concepts and all(c in overlay["conceptKinds"] for c in concepts), "challengeKinds")
    used = {name for names in overlay["conceptKinds"].values() for name in names} | set(overlay["challengeKinds"])
    need(used == set(kinds) == set(_PROBABILITY_KINDS), "kinds")
    need(set(overlay["challengeAsks"]) <= {ask for name in overlay["challengeKinds"] for ask in kinds[name]["asks"]}
         and overlay["challengeRule"] == "combined_event", "challengeAsks")
    stories = overlay["stories"]
    for name, row in kinds.items():
        need(set(row["groups"]) <= {PRACTICE, CHALLENGES} and row["groups"], "kinds.groups")
        need(tuple(row["reads"]) == ("expr", "variant", "ask") and row["givens"] is True, "kinds.reads")
        need(row["form"] == "fraction" and row["form"] in row["forms"]
             and set(row["forms"]) <= set(PROBABILITY_FORMS), "kinds.form")
        need(tuple(row["asks"]) == ASKS_BY_KIND[name], "kinds.asks")
        need(row["variants"] and all(stories.get(v, {}).get("kind") == name for v in row["variants"]), "kinds.variants")
        low, high = row["items"]
        need(LIMITS["items_min"] <= low <= high <= LIMITS["items_max"], "kinds.items")
        counts = row["counts"]
        need(1 <= counts["min"] <= counts["max"] and counts["totalMin"] <= counts["totalMax"] <= 1000, "kinds.counts")
        need(name in overlay["examples"] and tuple(overlay["examples"][name]) == ITEM_FIELDS, "examples")
    need({v for row in kinds.values() for v in row["variants"]} == set(stories), "stories")
    texts = set()
    for sid, story in stories.items():
        row = kinds[story["kind"]]
        categories = story["categories"]
        parts = story["intro"]
        need(all(part in ("T", "D") for part, _ in parts) and parts[0][0] == "T"
             and all(a[0] != b[0] for a, b in zip(parts, parts[1:])), "stories.intro")
        holes = [value for part, value in parts if part == "D"]
        need(set(story["asks"]) == {ask for ask in row["asks"] if ask_available(story["kind"], ask, categories)},
             "stories.asks")
        texts.update(story["asks"].values())
        if "table" in story:
            need(story["kind"] == "relative_frequency" and holes == [] and len(story["table"]["head"]) == categories + 1
                 and 2 <= categories + 1 <= LIMITS["table_cols"], "stories.table")
        else:
            need(story["kind"] != "relative_frequency" and holes == ["n%d" % i for i in range(1, categories + 1)],
                 "stories.intro")
        need(2 <= categories <= 4 and (categories == 2 or row["replacement"] is None), "stories.categories")
    need(len(texts) == sum(len(story["asks"]) for story in stories.values()), "stories.asks")
    need(set(overlay["formNotes"]) == set(PROBABILITY_FORMS), "formNotes")
    profile = overlay["profile"]
    need(profile["decimalPlaces"] in (1, 2, 3) and profile["percentPlaces"] == 0 and profile["power"] == 2
         and tuple(profile["literals"]) == (1, 2), "profile")
    need(tuple(overlay["givenTypes"]) == ("count",) and tuple(overlay["units"]) == (), "givenTypes")
    need(overlay["tables"] is True and overlay["atomFractions"] is True, "tables")
    need(set(overlay["levelNotes"]) == set(overlay["levels"]), "levelNotes")
    need(overlay["exampleQuestion"][0] in kinds and 3 <= len(overlay["exampleQuestion"][1]) <= 6, "exampleQuestion")


def check_overlay(overlay) -> None:
    """Internal consistency of one overlay; raises ValueError naming the broken field (English only)."""
    def need(condition, field):
        if not condition:
            raise ValueError("Overlay field is inconsistent: " + field)

    if overlay.get("skill") == "elementary":
        _check_elementary_overlay(overlay, need)
        return
    if overlay.get("family") == "probability":
        _check_probability_overlay(overlay, need)
        return
    kinds = overlay["kinds"]
    need(overlay["reviewed"] is False or overlay["reviewed"] is True, "reviewed")
    need(set(overlay["letters"]) <= {"x", "y", "a", "b"} and len(set(overlay["letters"])) == len(overlay["letters"]),
         "letters")
    for concept, names in overlay["conceptKinds"].items():
        need(concept.startswith(overlay["topicId"] + "#") and names, "conceptKinds")
        need(all(name in kinds and kinds[name]["group"] == PRACTICE for name in names), "conceptKinds")
    for name, concepts in overlay["challengeKinds"].items():
        need(name in kinds and kinds[name]["group"] == CHALLENGES, "challengeKinds")
        need(concepts and all(c in overlay["conceptKinds"] for c in concepts), "challengeKinds")
    used = {name for names in overlay["conceptKinds"].values() for name in names} | set(overlay["challengeKinds"])
    need(used == set(kinds), "kinds")
    for name, row in kinds.items():
        need(row["form"] in FORMS, "kinds.form")
        need(set(row["reads"]) <= {"text", "expr", "expr2", "values", "variant"}, "kinds.reads")
        need(tuple(row["asks"]) == ("",), "kinds.asks")
        need(("variant" in row["reads"]) == (tuple(row["variants"]) != ("",)), "kinds.variants")
        need(name in overlay["verbs"] and name in overlay["examples"], "verbs")
        example = overlay["examples"][name]
        need(tuple(example) == ITEM_FIELDS, "examples")
        need(all(example[field] == "" for field in ITEM_FIELDS if field not in row["reads"]), "examples")
        need(example["variant"] in row["variants"], "examples")
    variants = {variant for row in kinds.values() for variant in row["variants"] if variant}
    need(variants == set(overlay["templates"]) | set(overlay["mistakes"]), "variants")
    need(not set(overlay["templates"]) & set(overlay["mistakes"]), "variants")
    need(set(overlay["mistakeNotes"]) == set(overlay["mistakes"]), "mistakeNotes")
    low, high = overlay["templateNumbers"]
    need(2 <= low <= high <= overlay["profile"]["literal_max"], "templateNumbers")
    for template in overlay["templates"].values():
        need(all(part in ("T", "D") for part, _ in template["layout"]), "templates.layout")
        holes = [value for part, value in template["layout"] if part == "D"]
        need(sorted(holes) == sorted(ch for ch in template["shape"] if ch in "kmvw"), "templates.layout")
        need(template["layout"][0][0] == "T" and all(
            a[0] != b[0] for a, b in zip(template["layout"], template["layout"][1:])), "templates.layout")
    for kind, layout in overlay["layouts"].items():
        need(kind in kinds and all(part in ("T", "D") for part, _ in layout), "layouts")
    need(set(overlay["levelNotes"]) == set(overlay["levels"]), "levelNotes")
    need(overlay["exampleQuestion"][0] in kinds and 3 <= len(overlay["exampleQuestion"][1]) <= 6, "exampleQuestion")


# ------------------------------------------------------------------ plan rows and reserves (§2.3)

@dataclass(frozen=True)
class PlanRow:
    slot: str                 # "Q1".."QN" | "R1".."RR"
    number: int               # planned position 1..N (Q) | reserve index 1..R (R)
    group: str                # "practice" | "challenges"
    concepts: tuple           # concept ids, e.g. ("g7:algebraic_expressions#0",)
    kinds: tuple              # kinds allowed for this row (overlay)


def _plain_int(value) -> bool:
    return type(value) is int


def reserve_groups(planned: int) -> list:
    """Practice ×max(3, ⌈(planned−3)/5⌉), then challenges ×(1 if planned < 20 else 2).

    ⌈0.2·(N−3)⌉ is computed in exact integers: 0.2*15 is 3.0000000000000004 in floats."""
    if not _plain_int(planned) or not 4 <= planned <= 99:
        raise ValueError("Planned question count outside 4..99")
    practice = max(3, -(-(planned - 3) // 5))
    challenges = 1 if planned < 20 else 2
    return [PRACTICE] * practice + [CHALLENGES] * challenges


def slot_names(planned: int, reserves: int) -> tuple:
    """('Q1'..'QN', 'R1'..'RR')."""
    if not _plain_int(planned) or not 1 <= planned <= 99 or not _plain_int(reserves) or not 0 <= reserves <= 99:
        raise ValueError("Slot counts outside the slot alphabet")
    return tuple("Q%d" % i for i in range(1, planned + 1)) + tuple("R%d" % i for i in range(1, reserves + 1))


def _selected(scope) -> list:
    return [row["id"] for row in scope["selectedConcepts"]]


def _unique(values) -> tuple:
    out = []
    for value in values:
        if value not in out:
            out.append(value)
    return tuple(out)


def _check_lesson(lesson, scope, overlay) -> int:
    """The question count, after checking that lesson, scope and overlay name one enabled topic and level."""
    if (overlay is None or lesson.get("topicId") != overlay["topicId"]
            or type(lesson.get("level")) is not str or lesson["level"] not in overlay["levels"]):
        raise ContractError("WIRE_TOPIC_UNSUPPORTED", "Topic and level are not enabled for the structured wire")
    topic = scope["topic"]
    if (topic["topicId"] != overlay["topicId"] or topic["gradeNumber"] != lesson.get("gradeNumber")
            or topic["skillId"] != overlay.get("skill", "middle")):
        raise ContractError("WIRE_TOPIC_UNSUPPORTED", "Lesson, scope and overlay disagree")
    count = lesson.get("questionCount")
    if not _plain_int(count) or not CHALLENGE_SLOTS + 1 <= count <= 30:
        raise ContractError("WIRE_TOPIC_UNSUPPORTED", "Question count outside the plan")
    return count


def _sheet_kinds(scope, overlay):
    """(practice kinds per selected concept, challenge kinds, challenge concepts) for one lesson."""
    selected = _selected(scope)
    if not selected:
        raise ContractError("WIRE_TOPIC_UNSUPPORTED", "No selected concept")
    practice = {}
    for concept in selected:
        kinds = overlay["conceptKinds"].get(concept)
        if not kinds:
            raise ContractError("WIRE_TOPIC_UNSUPPORTED", "A selected concept has no structured kind")
        practice[concept] = tuple(kinds)
    challenge_kinds = tuple(name for name, concepts in overlay["challengeKinds"].items()
                            if all(c in selected for c in concepts))
    if not challenge_kinds:
        raise ContractError("WIRE_TOPIC_UNSUPPORTED", "No challenge kind fits the selected concepts")
    exercised = {c for name in challenge_kinds for c in overlay["challengeKinds"][name]}
    challenge_concepts = tuple(c for c in selected if c in exercised)
    return practice, challenge_kinds, challenge_concepts


def plan_rows(lesson, scope, overlay) -> tuple:
    """(planned rows Q1..QN, reserve rows R1..RR) as two lists of PlanRow (§2.3).

    Practice rows rotate the selected concepts exactly as skill_authoring.question_plan rows 1..N−3;
    challenge rows carry every challenge kind that fits the selection; practice reserves rotate the
    selected concepts in catalog order, challenge reserves repeat the challenge row."""
    count = _check_lesson(lesson, scope, overlay)
    practice, challenge_kinds, challenge_concepts = _sheet_kinds(scope, overlay)
    selected = _selected(scope)
    ordinary = count - CHALLENGE_SLOTS

    def row(slot, number, concepts):
        kinds = _unique(kind for concept in concepts for kind in practice[concept])
        return PlanRow(slot, number, PRACTICE, tuple(concepts), kinds)

    planned = []
    for index in range(ordinary):
        first = index * len(selected) // ordinary
        stop = max(first + 1, (index + 1) * len(selected) // ordinary)
        planned.append(row("Q%d" % (index + 1), index + 1, selected[first:stop]))
    for number in range(ordinary + 1, count + 1):
        planned.append(PlanRow("Q%d" % number, number, CHALLENGES, challenge_concepts, challenge_kinds))
    reserves, turn = [], 0
    for number, group in enumerate(reserve_groups(count), 1):
        if group == PRACTICE:
            reserves.append(row("R%d" % number, number, (selected[turn % len(selected)],)))
            turn += 1
        else:
            reserves.append(PlanRow("R%d" % number, number, CHALLENGES, challenge_concepts, challenge_kinds))
    return planned, reserves


# ------------------------------------------------------------------ (a) the response schema (§2.1)

def _string(limit):
    return {"type": "string", "maxLength": limit}


def _choice(values):
    return {"type": "string", "enum": list(values)}


def _object(properties):
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


def _array(items, maximum, minimum=None):
    out = {"type": "array", "items": items}
    if minimum is not None:
        out["minItems"] = minimum
    out["maxItems"] = maximum
    return out


def wire_schema(lesson, scope, overlay, reserves: int) -> dict:
    """Strict-mode JSON Schema of §2.1: root object, all keys required, additionalProperties false, enums for
    slot/kind/ask/form/variant; no anyOf/oneOf/allOf/pattern/const/format. Advisory; parse_wire decides."""
    count = _check_lesson(lesson, scope, overlay)
    practice, challenge_kinds, _ = _sheet_kinds(scope, overlay)
    kinds = _unique([kind for names in practice.values() for kind in names] + list(challenge_kinds))
    rows = [overlay["kinds"][kind] for kind in kinds]
    slots = slot_names(count, reserves)
    # A kind declares one form, or (the probability kinds) the tuple of forms it accepts.
    declared = {form for row in rows for form in row.get("forms", (row["form"],))}
    forms = ("",) + tuple(form for form in _unique(FORMS + ELEMENTARY_FORMS + PROBABILITY_FORMS) if form in declared)
    asks = _unique(("",) + tuple(ask for row in rows for ask in row["asks"]))
    variants = _unique(("",) + tuple(v for row in rows for v in row["variants"]))
    given = _object({"id": _choice(GIVEN_IDS), "type": _choice(GIVEN_TYPES),
                     "value": _string(LIMITS["given_value"]), "unit": _choice(("",) + tuple(overlay["units"]))})
    cell = _string(LIMITS["cell"])
    table = _object({"head": _array(cell, LIMITS["table_cols"]),
                     "rows": _array(_array(cell, LIMITS["table_cols"]), LIMITS["table_rows"])})
    item = _object({"text": _string(LIMITS["text"]), "expr": _string(LIMITS["expr"]),
                    "expr2": _string(LIMITS["expr2"]), "values": _string(LIMITS["values"]),
                    "ask": _choice(asks), "form": _choice(forms), "variant": _choice(variants)})
    question = _object({"slot": _choice(slots), "kind": _choice(kinds), "intro": _string(LIMITS["intro"]),
                        "givens": _array(given, LIMITS["givens_max"]), "table": table,
                        "items": _array(item, LIMITS["items_max"], LIMITS["items_min"])})
    return _object({"questions": _array(question, 2 * len(slots), 1)})


def schema_problems(schema) -> list:
    """Sorted strict-mode violations of a generated schema: SCHEMA_KEYWORD:<k>, SCHEMA_DEPTH,
    SCHEMA_REQUIRED, SCHEMA_ADDITIONAL, SCHEMA_TYPE. [] when strict-safe."""
    problems = set()

    def walk(node, depth):
        if not isinstance(node, dict):
            problems.add("SCHEMA_TYPE")
            return
        for key in node:
            if key not in SCHEMA_KEYWORDS:
                problems.add("SCHEMA_KEYWORD:" + str(key))
        kind = node.get("type")
        if type(kind) is not str:
            problems.add("SCHEMA_TYPE")
            return
        if kind in ("object", "array"):
            depth += 1
            if depth > SCHEMA_MAX_DEPTH:
                problems.add("SCHEMA_DEPTH")
        if kind == "object":
            properties = node.get("properties")
            if not isinstance(properties, dict) or node.get("required") != list(properties):
                problems.add("SCHEMA_REQUIRED")
            if node.get("additionalProperties") is not False:
                problems.add("SCHEMA_ADDITIONAL")
            for child in (properties or {}).values():
                walk(child, depth)
        elif kind == "array":
            walk(node.get("items"), depth)
        elif kind != "string":
            problems.add("SCHEMA_TYPE")

    walk(schema, 0)
    return sorted(problems)


# ------------------------------------------------------------------ (b) the authoring card

def card_problems(text: str) -> list:
    """Sorted codes for card text: CARD_CHAR (a notation glyph), CARD_SIZE (outside 3 KB..5,000 bytes)."""
    codes = set()
    if any(mark in text for mark in CARD_FORBIDDEN):
        codes.add("CARD_CHAR")
    if not CARD_MIN_BYTES <= len(text.encode("utf-8")) <= CARD_MAX_BYTES:
        codes.add("CARD_SIZE")
    return sorted(codes)


def _json(value) -> str:
    return json.dumps(thaw(value), ensure_ascii=False, separators=(",", ":"))


def _plan_lines(rows, names) -> list:
    lines, i = [], 0
    while i < len(rows):
        j = i
        while (j + 1 < len(rows) and rows[j + 1].slot[0] == rows[i].slot[0]
               and rows[j + 1].number == rows[j].number + 1
               and (rows[j + 1].group, rows[j + 1].concepts, rows[j + 1].kinds)
               == (rows[i].group, rows[i].concepts, rows[i].kinds)):
            j += 1
        label = rows[i].slot if i == j else rows[i].slot + "-" + rows[j].slot
        group = "challenge" if rows[i].group == CHALLENGES else "practice"
        lines.append("%s | %s | %s | %s" % (label, group, " + ".join(names[c] for c in rows[i].concepts),
                                            " or ".join(rows[i].kinds)))
        i = j + 1
    return lines


def _notation_lines(profile, letters) -> list:
    """The MATH FIELDS lines of the card, derived from the overlay's number profile."""
    signs = ["+", "-"] + (["*"] if profile["explicit_product"] else []) + ([":"] if profile["division"] else [])
    brackets = {"none": ", and no brackets",
                "negative_number": ", and brackets only around a negative number, as in x-(-2)",
                "any": ", and brackets"}[profile["brackets"]]
    never = ([] if profile["explicit_product"] else ["*"]) + ([] if profile["division"] else ["/", ":"])
    never += ([] if profile["power"] else ["^"]) + ([] if profile["percent"] else ["%"])
    never = " ".join(never) + (", =" if never else "=") + ("" if profile["decimal"] else ", a decimal point")
    return [
        "- ASCII school notation: %s, the letters %s, the signs %s%s."
        % ("numbers" if profile["decimal"] else "whole numbers", letters, " and ".join(signs), brackets),
        "- A product is a number written right before a letter (4x) or two different letters side by side (ab).",
        "- Never write %s, a space inside a number or two signs in a row. A minus sign may open an expression."
        % never,
    ]


def _scope_sentence(profile) -> str:
    """' No powers, no division, no brackets around a sum.' for the stage-2 profile ('' when all are allowed)."""
    parts = ([] if profile["power"] else ["no powers"]) + ([] if profile["division"] else ["no division"])
    parts += [] if profile["brackets"] == "any" else ["no brackets around a sum"]
    return (" " + ", ".join(parts) + ".").replace(" no", " No", 1) if parts else ""


_ELEMENTARY_GRADES = "אבגדהו"
_STORY_GLOSSES = {"S_PENCILS": "pencils packed in boxes", "S_EGGS": "eggs set in trays",
                  "S_BOATS": "children sailing in boats", "S_SHELVES": "books put on shelves",
                  "S_COOKIES": "cookies packed in bags", "S_TEAMS": "pupils split into teams",
                  "S_BOTTLES": "bottles packed in crates", "S_STICKERS": "stickers stuck in rows"}


def _elementary_card(lesson, scope, overlay) -> str:
    """authoring_card for an elementary overlay (the division kinds): same sections, elementary rules."""
    practice, challenge_kinds, _ = _sheet_kinds(scope, overlay)
    planned, reserves = plan_rows(lesson, scope, overlay)
    kinds = _unique([kind for names in practice.values() for kind in names] + list(challenge_kinds))
    names = {row["id"]: row["text"] for row in scope["selectedConcepts"]}
    profile, story = overlay["profile"], overlay["kinds"]["division_story"]
    grade = lesson["gradeNumber"]
    lines = [
        "AUTHORING CARD | contract %s | overlay reviewed: %s" % (CONTRACT, "yes" if overlay["reviewed"] else "no"),
        "",
        "ROLE",
        "Write the questions of one Hebrew mathematics worksheet as JSON that follows the response schema. "
        "Code writes the instructions, title, rule box, every story sentence, numbering, stars, answer keys and "
        "layout: never write them.",
        "",
        "OUTPUT",
        "- One question object per PLAN slot, each slot once. Every key is required: write \"\" or [] for an "
        "empty value.",
        "- question keys: %s. item keys: %s." % (", ".join(QUESTION_FIELDS), ", ".join(ITEM_FIELDS)),
        "- On this sheet intro is \"\", table is {\"head\":[],\"rows\":[]}, and every item has text \"\", expr2 \"\" "
        "and values \"\". Leave every field the kind does not read as \"\".",
        "- Each question has exactly %d items, all of its kind and all different." % story["items"][0],
        "- Write no Hebrew word anywhere: code writes every sentence the sheet prints.",
        "",
        "MATH FIELDS (expr)",
        "- ASCII school notation: whole numbers and the division sign : only, as 4371:6. Never write / or any other "
        "sign, a space inside a number, a leading zero or a decimal point.",
        "- A story item writes its two givens as {n1}:{n2}, exactly in that order.",
        "",
        "TOPIC",
        "- Grade %d (כיתה %s׳), level %s. Title: %s" % (grade, _ELEMENTARY_GRADES[grade - 1], lesson["level"],
                                                     overlay["title"]),
        "- " + overlay["levelNotes"][lesson["level"]],
        "- Teach: " + "; ".join(names[c] for c in _selected(scope)),
        "- Never use or hint at: " + "; ".join(overlay["forbiddenTerms"]),
        "- Every dividend is a whole number from %d to %d; every divisor is a whole number from %d to %d."
        % (profile["dividend_min"], profile["dividend_max"], profile["divisor_min"], profile["divisor_max"]),
        "- Never repeat a division on the sheet, and never use %s, which the rule box already shows."
        % ", ".join("%s:%s" % pair for pair in overlay["ruleExamples"]),
        "- The sheet may print one exercise structure at most three times: write at most one drill question, "
        "and use each story variant for at most three questions.",
        "",
        "KINDS (form is \"\" or the kind's own form)",
    ]
    for kind in kinds:
        row = overlay["kinds"][kind]
        group = " and ".join("challenge" if g == CHALLENGES else "practice" for g in row["groups"])
        lines.append("%s (%s, form %s): %s" % (kind, group, row["form"], row["card"]))
        if kind == "division_story":
            lines.append("  asks: full_groups (how many full groups: the quotient), leftover (how many are left "
                         "over: the remainder), groups_needed (how many groups hold everything: one more than the "
                         "quotient).")
            lines.append("  variants: " + "; ".join("%s %s" % (sid, _STORY_GLOSSES.get(sid, "a story"))
                                                    for sid in row["variants"]))
            lines.append("  givens: [{\"id\":\"n1\",\"type\":\"count\",\"value\":\"<whole amount>\",\"unit\":\"\"},"
                         "{\"id\":\"n2\",\"type\":\"count\",\"value\":\"<group size>\",\"unit\":\"\"}]")
            if overlay["challengeRule"] == "quotient_zero_digit":
                lines.append("  In a challenge slot the quotient has a zero digit, as 4113:4 gives 1028 remainder 1.")
    lines += ["", "PLAN (slot | group | concept | kind)"]
    lines += _plan_lines(planned, names)
    lines += _plan_lines(reserves, names)
    lines.append("R slots are reserves under the same rules, printed only in place of a refused question.")
    lines += ["", "EXAMPLES (numbers deliberately outside this sheet's range: never copy them)"]
    example_kind, exprs = overlay["exampleQuestion"]
    if example_kind in kinds:
        items = [dict(thaw(overlay["examples"][example_kind]), expr=expr) for expr in exprs]
        lines.append(_json({"slot": "Q1", "kind": example_kind, "intro": "", "givens": [],
                            "table": {"head": [], "rows": []}, "items": items}))
    for kind in kinds:
        if kind != example_kind:
            lines.append("%s item: %s" % (kind, _json(overlay["examples"][kind])))
    text = "\n".join(lines) + "\n"
    problems = card_problems(text)
    if problems:
        raise ContractError(problems[0], "Authoring card breaks the card lint")
    return text


def _probability_card(lesson, scope, overlay) -> str:
    """authoring_card for a probability overlay: same sections, the story/given/ask rules of probability_kinds."""
    practice, challenge_kinds, _ = _sheet_kinds(scope, overlay)
    planned, reserves = plan_rows(lesson, scope, overlay)
    kinds = _unique([kind for names in practice.values() for kind in names] + list(challenge_kinds))
    names = {row["id"]: row["text"] for row in scope["selectedConcepts"]}
    lines = [
        "AUTHORING CARD | contract %s | overlay reviewed: %s" % (CONTRACT, "yes" if overlay["reviewed"] else "no"),
        "",
        "ROLE",
        "Write the questions of one Hebrew mathematics worksheet as JSON that follows the response schema. "
        "Code writes the title, rule box, every story sentence and table, numbering, stars, answer keys and "
        "layout: never write them.",
        "",
        "OUTPUT",
        "- One question object per PLAN slot, each slot once. Every key is required: write \"\" or [] for an "
        "empty value.",
        "- intro is \"\", table is {\"head\":[],\"rows\":[]}; every item has text, expr2 and values \"\". Write no "
        "Hebrew word.",
        "- 3 to 6 items (complement_probability 3 or 4), one variant per question, a different ask per item.",
        "- givens: n1..nK of the variant, each {\"id\":\"nK\",\"type\":\"count\",\"value\":\"<whole number>\","
        "\"unit\":\"\"}.",
        "",
        "MATH FIELD (expr)",
        "- expr is the probability the ask names, over the givens: {n1}..{n4}, the numbers 1 and 2, + - * / ^2 and "
        "brackets, as {n2}/({n1}+{n2}+{n3}). Code keys the story's own probability.",
        "- form \"\" is a reduced fraction; relative_frequency may also say decimal or percent.",
        "",
        "TOPIC",
        "- Grade %d (%s), level %s. Title: %s" % (lesson["gradeNumber"], GRADE_LINE[lesson["gradeNumber"]],
                                                 lesson["level"], overlay["title"]),
        "- Teach: " + "; ".join(names[c] for c in _selected(scope)),
        "- Never use or hint at: " + "; ".join(overlay["forbiddenTerms"]) + ". No drawing, no two-way table.",
        "- Every probability lies strictly between 0 and 1. No two items of a question share a value; no answer's "
        "number is printed in its question; never repeat a story with the same counts.",
        "",
        "KINDS (counts min..max, total min..max)",
    ]
    for kind in kinds:
        row = overlay["kinds"][kind]
        group = "+".join("challenge" if g == CHALLENGES else "practice" for g in row["groups"])
        counts = row["counts"]
        lines.append("%s (%s; %d..%d, %d..%d): %s Variants %s." % (
            kind, group, counts["min"], counts["max"], counts["totalMin"], counts["totalMax"], row["card"],
            " ".join(row["variants"])))
    lines.append("Two-draw asks: both_k, first_j_second_k, one_of_each (either order), same (one colour), "
                 "at_least_one_k (without replacement and complement only). A challenge asks only "
                 + ", ".join(overlay["challengeAsks"]) + ".")
    lines += ["", "PLAN (slot | group | concept | kind)"]
    lines += _plan_lines(planned, names)
    lines += _plan_lines(reserves, names)
    lines.append("R slots are reserves under the same rules, printed only in place of a refused question.")
    lines += ["", "EXAMPLE (counts deliberately outside this sheet's range: never copy them)"]
    example_kind, asks = overlay["exampleQuestion"]
    example = thaw(overlay["examples"][example_kind])
    from probability_kinds import canonical_text
    items = [dict(example, ask=ask, expr=canonical_text(example_kind, ask, 2)) for ask in asks]
    lines.append(_json({"slot": "Q1", "kind": example_kind, "intro": "", "givens": thaw(overlay["exampleGivens"]),
                        "table": {"head": [], "rows": []}, "items": items}))
    text = "\n".join(lines) + "\n"
    problems = card_problems(text)
    if problems:
        raise ContractError(problems[0], "Authoring card breaks the card lint")
    return text


def authoring_card(lesson, scope, overlay) -> str:
    """Per-topic authoring card text (English rules, Hebrew catalog labels) for one lesson.

    Deterministic; 3 KB..5,000 bytes; never contains $ \\ [[ ]] · × ÷ − √. Teacher text is not part of the
    card: a caller appends it verbatim as data, outside this budget (stage 3). Raises ContractError."""
    _check_lesson(lesson, scope, overlay)
    if overlay.get("skill") == "elementary":
        return _elementary_card(lesson, scope, overlay)
    if overlay.get("family") == "probability":
        return _probability_card(lesson, scope, overlay)
    practice, challenge_kinds, _ = _sheet_kinds(scope, overlay)
    planned, reserves = plan_rows(lesson, scope, overlay)
    kinds = _unique([kind for names in practice.values() for kind in names] + list(challenge_kinds))
    names = {row["id"]: row["text"] for row in scope["selectedConcepts"]}
    profile = overlay["profile"]
    low, high = overlay["templateNumbers"]
    letters = ", ".join(overlay["letters"])
    lines = [
        "AUTHORING CARD | contract %s | overlay reviewed: %s" % (CONTRACT, "yes" if overlay["reviewed"] else "no"),
        "",
        "ROLE",
        "Write the questions of one Hebrew mathematics worksheet as JSON that follows the response schema. "
        "Code writes the instructions, title, rule box, numbering, stars, answer keys and layout: never "
        "write them.",
        "",
        "OUTPUT",
        "- One question object per PLAN slot, each slot once. Every key is required: write \"\" or [] for an "
        "empty value.",
        "- question keys: %s. item keys: %s." % (", ".join(QUESTION_FIELDS), ", ".join(ITEM_FIELDS)),
        "- On this sheet intro is \"\", givens is [], table is {\"head\":[],\"rows\":[]}, and every item has "
        "%sask \"\". Leave every field the kind does not read as \"\"."
        % ("" if any("text" in overlay["kinds"][kind]["reads"] for kind in kinds) else "text \"\" and "),
        "- Each question has %d to %d items, all of its kind and all different."
        % (LIMITS["items_min"], LIMITS["items_max"]),
        "- Text fields hold Hebrew words and punctuation only: never a digit, a Latin letter or a math sign.",
        "",
        "MATH FIELDS (expr, expr2, values)",
    ] + _notation_lines(profile, letters) + [
        "",
        "TOPIC",
        "- Grade %d (%s), level %s. Title: %s" % (lesson["gradeNumber"], GRADE_LINE[lesson["gradeNumber"]],
                                                 lesson["level"], overlay["title"]),
        "- " + overlay["levelNotes"][lesson["level"]],
        "- Teach: " + "; ".join(names[c] for c in _selected(scope)),
        "- Never use or hint at: " + "; ".join(overlay["forbiddenTerms"]),
        "- Every number in expr is a whole number from 0 to %d; every value is a whole number from %d to %d."
        % (profile["literal_max"], profile["value_min"], profile["value_max"]),
        "- At most %d terms and at most %d different letters in one expression, never one letter twice in a "
        "term.%s" % (profile["terms_max"], profile["letters_max"], _scope_sentence(profile)),
    ]
    for left, right in overlay["ruleFacts"]:
        lines.append("- The rule box already shows %s=%s: never ask about those terms together." % (left, right))
    lines += [
        "- An item's answer must not appear elsewhere in its question, and its numbers must not all be printed "
        "already in that question. Never repeat an expression on the sheet.",
        "",
        "KINDS (form is \"\" or the kind's own form)",
    ]
    for kind in kinds:
        row = overlay["kinds"][kind]
        group = "challenge" if row["group"] == CHALLENGES else "practice"
        lines.append("%s (%s, form %s): %s" % (kind, group, row["form"], row["card"]))
        if kind == "write_from_words":
            lines.append("  k and m are whole numbers from %d to %d; v and w are different letters." % (low, high))
            lines.append("  " + "; ".join("%s %s" % (tid, overlay["templates"][tid]["shape"])
                                          for tid in row["variants"]))
        if kind == "find_error_collect":
            lines += ["  %s %s" % (mid, overlay["mistakeNotes"][mid]) for mid in row["variants"]]
    lines += ["", "PLAN (slot | group | concept | kind)"]
    lines += _plan_lines(planned, names)
    lines += _plan_lines(reserves, names)
    lines.append("R slots are reserves under the same rules, printed only in place of a refused question.")
    lines += ["", "EXAMPLES (numbers deliberately outside this sheet's range: never copy them)"]
    example_kind, exprs = overlay["exampleQuestion"]
    if example_kind in kinds:
        items = [dict(thaw(overlay["examples"][example_kind]), expr=expr) for expr in exprs]
        lines.append(_json({"slot": "Q1", "kind": example_kind, "intro": "", "givens": [],
                            "table": {"head": [], "rows": []}, "items": items}))
    for kind in kinds:
        if kind != example_kind:
            lines.append("%s item: %s" % (kind, _json(overlay["examples"][kind])))
    text = "\n".join(lines) + "\n"
    problems = card_problems(text)
    if problems:
        raise ContractError(problems[0], "Authoring card breaks the card lint")
    return text


# ------------------------------------------------------------------ the IR selection record (§2.6)

def _codes_ok(codes) -> bool:
    return (type(codes) is list and 1 <= len(codes) <= MAX_ENTRY_CODES and len(set(codes)) == len(codes)
            and all(is_known_code(code) for code in codes))


def validate_selection(selection, *, lesson, scope, questions) -> None:
    """Final-authority check of the IR selection record (§2.6); raises SelectionError.

    Record shape (all keys required, nothing else):
      requested  = lesson.questionCount; floor = runtime_catalog.question_floor(grade), recomputed;
      delivered  = number of IR questions, floor ≤ delivered ≤ requested;
      questions  = [{n, slot, origin, conceptIds, star}] in printed order, n = 1..delivered. slot is the wire
                   slot that produced the question: planned → Qk, reserve → Rk, repair → Qk (the position it
                   repairs). conceptIds: non-empty subset of the selected concepts, union = all of them
                   (else SOURCE_COVERAGE). star = the IR question's star.
      replaced   = [{slot: Qk, by: Rk | REPAIR, codes}] in chronological order, ≤32; each reserve once; a
                   challenge reserve never fills a practice position.
      dropped    = [{slot: Qk, codes}], len = requested − delivered.
    Codes: 1..16 unique registered codes per entry. Every planned position is printed exactly once or
    dropped; the question printed at a position is the last replacement there (or the planned one when
    there is none); star = the group of the row the question was written for; printed order is ordinary
    questions, then challenges, each by planned position (lesson_select layout)."""
    def fail(reason, code="SOURCE_SELECTION"):
        raise SelectionError(code, reason)

    if type(selection) is not dict or set(selection) != set(SELECTION_FIELDS):
        fail("selection fields")
    requested, grade = lesson.get("questionCount"), lesson.get("gradeNumber")
    if not _plain_int(requested) or not _plain_int(grade) or not CHALLENGE_SLOTS + 1 <= requested <= 99:
        fail("lesson counts")
    from runtime_catalog import question_floor
    floor = question_floor(grade)
    if not all(_plain_int(selection[key]) for key in ("requested", "floor", "delivered")):
        fail("counts must be integers")
    if selection["requested"] != requested:
        fail("requested differs from the lesson")
    if selection["floor"] != floor:
        fail("floor differs from the grade floor")
    delivered = selection["delivered"]
    if not floor <= delivered <= requested:
        fail("delivered outside floor..requested")
    if type(questions) is not list or len(questions) != delivered:
        fail("delivered differs from the printed questions")
    rows, replaced, dropped = selection["questions"], selection["replaced"], selection["dropped"]
    if type(rows) is not list or len(rows) != delivered:
        fail("question record length")
    if type(dropped) is not list or len(dropped) != requested - delivered:
        fail("dropped count")
    if type(replaced) is not list or len(replaced) > MAX_REPLACED:
        fail("replaced entries")

    groups = reserve_groups(requested)
    last_practice = requested - CHALLENGE_SLOTS
    selected = _selected(scope)
    covered, slots = set(), set()
    for index, row in enumerate(rows):
        if type(row) is not dict or set(row) != set(SELECTION_QUESTION_FIELDS):
            fail("question record fields")
        if not _plain_int(row["n"]) or row["n"] != index + 1:
            fail("question numbering")
        slot = row["slot"]
        if type(slot) is not str or not SLOT_RE.match(slot) or slot in slots:
            fail("question slot")
        slots.add(slot)
        if int(slot[1:]) > (requested if slot[0] == "Q" else len(groups)):
            fail("slot outside the plan")
        if row["origin"] not in ORIGINS or (row["origin"] == "reserve") != (slot[0] == "R"):
            fail("origin does not match the slot")
        ids = row["conceptIds"]
        if type(ids) is not list or any(type(c) is not str for c in ids) or len(set(ids)) != len(ids):
            fail("concept id list")
        if not ids or any(c not in selected for c in ids):
            fail("concepts outside the selection", "SOURCE_COVERAGE")
        covered.update(ids)
        printed = questions[index]
        if type(row["star"]) is not bool or type(printed) is not dict or printed.get("star") is not row["star"]:
            fail("star differs from the printed question")
    if covered != set(selected):
        fail("a selected concept has no question", "SOURCE_COVERAGE")

    history, used = {}, set()
    for entry in replaced:
        if type(entry) is not dict or set(entry) != set(SELECTION_REPLACED_FIELDS):
            fail("replaced entry fields")
        slot, by = entry["slot"], entry["by"]
        if type(slot) is not str or not PLANNED_SLOT_RE.match(slot) or int(slot[1:]) > requested:
            fail("replaced slot")
        if type(by) is not str or not BY_RE.match(by):
            fail("replaced by")
        if by != "REPAIR":
            number = int(by[1:])
            if number > len(groups) or by in used:
                fail("reserve outside the plan or used twice")
            used.add(by)
            if groups[number - 1] == CHALLENGES and int(slot[1:]) <= last_practice:
                fail("challenge reserve in a practice position")
        if not _codes_ok(entry["codes"]):
            fail("replaced codes")
        history.setdefault(int(slot[1:]), []).append(by)
    gone = set()
    for entry in dropped:
        if type(entry) is not dict or set(entry) != set(SELECTION_DROPPED_FIELDS):
            fail("dropped entry fields")
        slot = entry["slot"]
        if type(slot) is not str or not PLANNED_SLOT_RE.match(slot) or int(slot[1:]) > requested:
            fail("dropped slot")
        if int(slot[1:]) in gone or not _codes_ok(entry["codes"]):
            fail("dropped entry")
        gone.add(int(slot[1:]))

    placed = {by: position for position, bys in history.items() for by in bys if by != "REPAIR"}
    order = []
    for row in rows:
        slot, origin = row["slot"], row["origin"]
        if origin == "reserve":
            if slot not in placed:
                fail("reserve without a replacement entry")
            position, challenge = placed[slot], groups[int(slot[1:]) - 1] == CHALLENGES
            expected = slot
        else:
            position, challenge = int(slot[1:]), int(slot[1:]) > last_practice
            expected = "REPAIR" if origin == "repair" else None
        if (history.get(position, [None])[-1]) != expected:
            fail("printed question is not the last placement of its position")
        if row["star"] is not challenge:
            fail("star differs from the planned group")
        order.append((row["star"], position))
    positions = [position for _, position in order]
    if len(set(positions)) != len(positions) or set(positions) & gone:
        fail("a position is printed twice or printed and dropped")
    if set(positions) | gone != set(range(1, requested + 1)):
        fail("a planned position is neither printed nor dropped")
    if order != sorted(order):
        fail("printed order")
