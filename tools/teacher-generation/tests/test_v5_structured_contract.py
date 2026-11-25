"""structured_contract: code registry, overlay, plan rows, strict-safe schema, authoring card, selection record."""
import copy
from fractions import Fraction
import json
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import structured_contract as sc
from runtime_catalog import question_floor, scope_for_lesson

APP = Path(__file__).resolve().parents[1]
PIN = "57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b"
TOPIC = "g7:algebraic_expressions"
C0, C1, C2 = TOPIC + "#0", TOPIC + "#1", TOPIC + "#2"
# The repro lesson of V5-DESIGN §7, verbatim.
LESSON = json.loads(
    '{"level":"b","minutes":30,"topicId":"g7:algebraic_expressions","version":3,"lastLesson":"למדנו מהו משתנה וביטוי '
    'אלגברי, הצבה בביטוי וכינוס איברים דומים. עדיין לא למדנו את חוק הפילוג.","lessonGoal":"practice","gradeNumber":7,'
    '"questionCount":20,"alreadyLearned":[],"lessonBoundary":{"kind":"curriculum_scope","version":1,"conceptIds":'
    '["g7:algebraic_expressions#0","g7:algebraic_expressions#1","g7:algebraic_expressions#2"],"curriculumSha256":'
    '"57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b"},"explicitShortSheet":false}')
SUBSETS = ((C2,), (C0, C2), (C1, C2), (C0, C1, C2))
W_IDS = ["W_TIMES", "W_SUM", "W_DIFF", "W_PRODUCT", "W_TIMES_PLUS", "W_TIMES_MINUS", "W_TWO_TIMES"]


def lesson_for(count=20, concepts=(C0, C1, C2), level="b"):
    lesson = copy.deepcopy(LESSON)
    lesson["questionCount"], lesson["level"] = count, level
    lesson["lessonBoundary"]["conceptIds"] = list(concepts)
    return lesson


def overlay():
    return sc.overlay_for(TOPIC, "b")


def conforms(value, schema, path="$"):
    """A small structural validator for the strict subset used by wire_schema (no jsonschema dependency)."""
    kind = schema["type"]
    if kind == "object":
        if type(value) is not dict:
            return [path + ":type"]
        errors = [path + ":extra"] if set(value) - set(schema["properties"]) else []
        errors += [path + ":missing:" + key for key in schema["required"] if key not in value]
        for key, child in schema["properties"].items():
            if key in value:
                errors += conforms(value[key], child, path + "." + key)
        return errors
    if kind == "array":
        if type(value) is not list:
            return [path + ":type"]
        errors = [] if schema.get("minItems", 0) <= len(value) <= schema.get("maxItems", 10 ** 9) else [path + ":count"]
        for index, child in enumerate(value):
            errors += conforms(child, schema["items"], "%s[%d]" % (path, index))
        return errors
    if kind == "string":
        if type(value) is not str:
            return [path + ":type"]
        errors = [path + ":enum"] if "enum" in schema and value not in schema["enum"] else []
        if not schema.get("minLength", 0) <= len(value) <= schema.get("maxLength", 10 ** 9):
            errors.append(path + ":length")
        return errors
    return [path + ":schema"]


def keys_everywhere(node):
    """Every dictionary key anywhere inside a JSON value, recursively."""
    if isinstance(node, dict):
        for key, child in node.items():
            yield key
            yield from keys_everywhere(child)
    elif isinstance(node, list):
        for child in node:
            yield from keys_everywhere(child)


def depth(node):
    """Nesting depth of object/array schemas along the deepest path (the root counts as 1)."""
    if not isinstance(node, dict) or node.get("type") not in ("object", "array"):
        return 0
    children = list(node["properties"].values()) if node["type"] == "object" else [node["items"]]
    return 1 + max((depth(child) for child in children), default=0)


def item(expr="", expr2="", values="", variant="", form=""):
    return {"text": "", "expr": expr, "expr2": expr2, "values": values, "ask": "", "form": form, "variant": variant}


def question(slot, kind, items):
    return {"slot": slot, "kind": kind, "intro": "", "givens": [], "table": {"head": [], "rows": []}, "items": items}


def good_reply():
    """26 questions in the §2.1 style; Q1, Q7, Q13 and Q18 are the §2.1 examples verbatim."""
    words = [item("4x", variant="W_TIMES"), item("a+b", variant="W_SUM"), item("3y+x", variant="W_TIMES_PLUS")]
    sub = [item("4y-y", values="y=-2"), item("2a+5", values="a=3"), item("5b-2b", values="b=4")]
    col = [item("3x+5+2x-1"), item("-4y+9+6y-2"), item("8a-3+a-5")]
    err = [item("4a+3+a+2", "10a", variant="M1"), item("6x+7-1-2x", "4x+8", variant="M2"),
           item("5b+2a+b", "5b+2a", variant="M3")]
    kinds = ["write_from_words"] * 6 + ["substitute"] * 6 + ["collect_like_terms"] * 5 + ["find_error_collect"] * 3
    bank = {"write_from_words": words, "substitute": sub, "collect_like_terms": col, "find_error_collect": err}
    reply = [question("Q%d" % n, kind, copy.deepcopy(bank[kind])) for n, kind in enumerate(kinds, 1)]
    for number, kind in enumerate(["write_from_words", "substitute", "collect_like_terms", "write_from_words",
                                   "find_error_collect", "find_error_collect"], 1):
        reply.append(question("R%d" % number, kind, copy.deepcopy(bank[kind])))
    return {"questions": reply}


def selection_record():
    """The §7 good reply after selection: Q4→R1, Q9→R2, Q14→R3, Q19→R5 (printed order = layout)."""
    concept = {n: C0 if n <= 6 else C1 if n <= 12 else C2 for n in range(1, 21)}
    reserves = {4: "R1", 9: "R2", 14: "R3", 19: "R5"}
    rows = []
    for position in list(range(1, 18)) + [18, 19, 20]:
        slot = reserves.get(position, "Q%d" % position)
        rows.append({"n": len(rows) + 1, "slot": slot, "origin": "reserve" if slot[0] == "R" else "planned",
                     "conceptIds": [concept[position]], "star": position > 17})
    replaced = [{"slot": "Q4", "by": "R1", "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]},
                {"slot": "Q9", "by": "R2", "codes": ["ITEM_COUNT", "MATH_SCOPE_PRODUCT_OF_SUM"]},
                {"slot": "Q14", "by": "R3", "codes": ["ITEM_COUNT", "LEAK_PINNED_VALUE"]},
                {"slot": "Q19", "by": "R5", "codes": ["ITEM_COUNT", "MISTAKE_UNMODELED"]}]
    selection = {"requested": 20, "floor": 20, "delivered": 20, "questions": rows, "replaced": replaced, "dropped": []}
    return selection, [{"star": row["star"]} for row in rows]


def monomials(text):
    """{signature: coefficient} of a flat monomial sum such as '24a+33+a+35' (test-only reader)."""
    out = {}
    for sign, digits, letters in re.findall(r"([+-]?)(\d*)([a-z]*)", text):
        if not digits and not letters:
            continue
        value = int(digits or "1") * (-1 if sign == "-" else 1)
        out[letters] = out.get(letters, 0) + value
    return {key: value for key, value in out.items() if value}


def terms(text):
    return [(sign or "+", digits, letters) for sign, digits, letters in re.findall(r"([+-]?)(\d*)([a-z]*)", text)
            if digits or letters]


class CodeRegistryTests(unittest.TestCase):
    def test_every_code_matches_the_alphabet(self):
        self.assertGreater(len(sc.CODES), 100)
        for code in sc.CODES:
            self.assertRegex(code, sc.CODE_RE)
            self.assertLessEqual(len(code), 60)
            self.assertFalse(any(ch.isdigit() for ch in code), code)
        listed = [code for group in sc.CODE_GROUPS.values() for code in group]
        self.assertEqual(len(listed), len(set(listed)), "a code is registered twice")

    def test_design_codes_with_digits_are_renamed(self):
        for design, registered in sc.DESIGN_RENAMES.items():
            self.assertIsNone(sc.CODE_RE.match(design))
            self.assertNotIn(design, sc.CODES)
            self.assertIn(registered, sc.CODES)
        self.assertNotIn("D12_MIRROR", sc.CODES)

    def test_section_four_codes_are_registered(self):
        for code in ("WIRE_JSON", "Q_SLOT_DUPLICATE", "TEXT_GLUED_REF", "ATOM_ADJACENT", "REF_UNUSED",
                     "MATH_SCOPE_PRODUCT_OF_SUM", "TASK_LITERAL", "KEY_ROUNDTRIP", "BINDING_INTERNAL",
                     "REVEALS_ANSWER", "LEAK_PINNED_VALUE", "LEAK_SHEET_INVERSE", "REPAIR_SLOT_NOT_MISSING",
                     "SOURCE_SELECTION", "SOURCE_LEAK", "PDF_PRODUCER_NOT_WEASYPRINT", "ATOM_LEVELS_INVALID"):
            self.assertIn(code, sc.CODES)

    def test_codes_of_sibling_v5_modules_are_registered(self):
        for code in ("EXAMPLE_COPY", "SKILL_HASH_MISMATCH", "SKILL_MODULE_NOT_STDLIB", "QUESTION_MISSING",
                     "MISTAKE_UNMODELED", "MISTAKE_NOT_APPLICABLE", "MISTAKE_UNKNOWN"):
            self.assertIn(code, sc.CODES)
        # lesson_select falls back to REJECTED only when a caller passes no codes: a record carrying it is a
        # caller bug, so it stays unregistered and validate_selection refuses it.
        self.assertNotIn("REJECTED", sc.CODES)

    def test_kernel_code_for_every_math_task_literal(self):
        source = (APP / "math_tasks.py").read_text(encoding="utf-8")
        literals = set(re.findall(r'(?:fail|MathTaskError)\("([A-Z_]+)"', source))
        expected = {"INVALID_TASK", "INVALID_AST", "UNDEFINED_TASK", "RESOURCE_LIMIT", "UNSUPPORTED_POWER",
                    "UNSUPPORTED_SYMBOLIC_ROOT", "UNSUPPORTED_ROOT", "UNSUPPORTED_RESULT", "UNSUPPORTED_EQUATION",
                    "EMPTY_DOMAIN", "UNVERIFIED_SOLUTION", "UNSUPPORTED_SYSTEM", "UNSUPPORTED_COMPARISON",
                    "UNSUPPORTED_DOMAIN", "UNSUPPORTED_TASK", "OUTSIDE_DOMAIN"}
        self.assertEqual(literals, expected)
        for code in sorted(literals):
            kernel = sc.kernel_code(code)
            self.assertEqual(kernel, "KERNEL_" + code)
            self.assertRegex(kernel, sc.CODE_RE)
            self.assertTrue(sc.is_known_code(kernel))
            self.assertNotIn(kernel, sc.CODES)
        for bad in ("A1", "bad-code", "", "X" * 54, 5, None):
            with self.assertRaises(ValueError):
                sc.kernel_code(bad)

    def test_registry_covers_general_source_codes(self):
        source = (APP / "general_source.py").read_text(encoding="utf-8")
        found = set(re.findall(r'"(SOURCE_[A-Z_]+)"', source)) | set(re.findall(r'"(DRAWING_POLICY)"', source))
        self.assertTrue(found)
        self.assertLessEqual(found, sc.CODES)

    def test_is_known_code(self):
        self.assertTrue(sc.is_known_code("TEXT_CHAR"))
        self.assertTrue(sc.is_known_code("KERNEL_INVALID_AST"))
        for code in ("KERNEL_", "NOT_A_CODE", "D12_MIRROR", "text_char", 3, None, "V5_TOPIC_UNSUPPORTED"):
            self.assertFalse(sc.is_known_code(code), code)

    def test_contract_marker(self):
        self.assertEqual(sc.CONTRACT, "worksheet-wire/5")
        import general_source
        # general_source gains V5_CONTRACT only when the integrator wires v5 in (E4); it must then be this id.
        self.assertEqual(getattr(general_source, "V5_CONTRACT", sc.CONTRACT), sc.CONTRACT)

    def test_limits_and_field_tables(self):
        self.assertEqual(sc.QUESTION_FIELDS, ("slot", "kind", "intro", "givens", "table", "items"))
        self.assertEqual(sc.ITEM_FIELDS, ("text", "expr", "expr2", "values", "ask", "form", "variant"))
        self.assertEqual(sc.GIVEN_FIELDS, ("id", "type", "value", "unit"))
        self.assertEqual(sc.GIVEN_IDS, tuple("n%d" % i for i in range(1, 9)))
        self.assertEqual(len(sc.GIVEN_TYPES), 11)
        self.assertEqual(dict(sc.LIMITS), {"intro": 300, "text": 200, "expr": 120, "expr2": 120, "values": 40,
                                           "cell": 40, "given_value": 60, "items_min": 3, "items_max": 6,
                                           "givens_max": 8, "table_cols": 6, "table_rows": 8, "reply_bytes": 200_000})
        self.assertEqual(sc.FORMS, ("expression", "integer"))
        self.assertEqual(sc.GRADE_LINE[7], "כיתה ז\u05f3")
        self.assertEqual(set(sc.GRADE_LINE), {7, 8, 9})
        with self.assertRaises(TypeError):
            sc.LIMITS["intro"] = 5


class OverlayTests(unittest.TestCase):
    def test_overlay_concepts_exist_in_the_fixture_scope(self):
        scope = scope_for_lesson(LESSON)
        ids = [row["id"] for row in scope["selectedConcepts"]]
        self.assertEqual(ids, [C0, C1, C2])
        self.assertEqual(list(overlay()["conceptKinds"]), ids)
        for concepts in overlay()["challengeKinds"].values():
            self.assertLessEqual(set(concepts), set(ids))
        self.assertEqual(scope["topic"]["topicId"], overlay()["topicId"])
        from math_tasks import SYMBOLS
        self.assertLessEqual(set(overlay()["letters"]), set(SYMBOLS))

    def test_overlay_is_consistent_frozen_and_unreviewed(self):
        for value in sc.OVERLAYS.values():
            sc.check_overlay(value)
        ov = overlay()
        # Noam approved the g7 overlay as a whole on 2026-11-25 (D7): reviewed, recorded, nothing left pending.
        self.assertIs(ov["reviewed"], True)
        self.assertEqual((ov["approvedBy"], ov["approvedAt"], ov["pendingReview"]), ("Noam", "2026-11-25", ()))
        with self.assertRaises(TypeError):
            ov["title"] = "x"
        with self.assertRaises(TypeError):
            ov["verbs"]["substitute"] = "x"
        with self.assertRaises(TypeError):
            sc.OVERLAYS["g7:x"] = {}
        self.assertIsInstance(ov["letters"], tuple)
        json.dumps(sc.thaw(ov), ensure_ascii=False)
        spans = sc.rule_spans(ov)
        self.assertEqual(spans[1], {"kind": "display", "notation": "3x+5x=8x", "symbols": ["x"]})
        spans[1]["symbols"].append("y")
        self.assertEqual(sc.rule_spans(ov)[1]["symbols"], ["x"])

    def test_overlay_for(self):
        self.assertIs(sc.overlay_for(TOPIC, "b"), sc.OVERLAYS[TOPIC])
        for topic, level in ((TOPIC, "a"), (TOPIC, "e"), ("g7:equations", "b"), ("ד10", "b"), (None, "b"),
                             (TOPIC, None), (TOPIC, ["b"])):
            self.assertIsNone(sc.overlay_for(topic, level))

    def test_overlay_matches_the_stage_two_contract(self):
        ov = overlay()
        profile = ov["profile"]
        self.assertEqual((profile["literal_max"], profile["terms_max"], profile["letters_max"]), (20, 4, 2))
        self.assertEqual((profile["value_min"], profile["value_max"], profile["result_literal_max"]), (-10, 10, 99))
        self.assertIs(profile["power"], False)
        self.assertEqual(ov["letters"], ("x", "y", "a", "b"))
        self.assertEqual(ov["mistakes"], ("M1", "M2", "M3"))
        self.assertEqual(list(ov["templates"]), W_IDS)
        self.assertEqual(ov["templateNumbers"], (2, 20))
        kinds = ov["kinds"]
        self.assertEqual({k: kinds[k]["form"] for k in kinds},
                         {"write_from_words": "expression", "substitute": "integer",
                          "collect_like_terms": "expression", "find_error_collect": "expression"})
        self.assertEqual({k: kinds[k]["group"] for k in kinds},
                         {"write_from_words": "practice", "substitute": "practice",
                          "collect_like_terms": "practice", "find_error_collect": "challenges"})
        self.assertTrue(all(kinds[k]["asks"] == ("",) for k in kinds))
        self.assertEqual(ov["verbs"]["collect_like_terms"], "כנסו איברים דומים:")
        self.assertEqual(ov["ruleFacts"], (("3x+5x", "8x"),))
        self.assertIn("משוואה", ov["forbiddenTerms"])

    def test_check_overlay_refuses_a_broken_table(self):
        sc.check_overlay(sc.thaw(overlay()))
        broken = sc.thaw(overlay())
        broken["kinds"]["substitute"]["form"] = "fraction"
        with self.assertRaises(ValueError):
            sc.check_overlay(broken)
        broken = sc.thaw(overlay())
        broken["templates"]["W_SUM"]["layout"] = [["T", "הסכום של "], ["D", "v"], ["D", "w"]]
        with self.assertRaises(ValueError):
            sc.check_overlay(broken)
        broken = sc.thaw(overlay())
        broken["challengeKinds"]["find_error_collect"] = [TOPIC + "#9"]
        with self.assertRaises(ValueError):
            sc.check_overlay(broken)

    def test_code_strings_list_every_code_written_string(self):
        strings = sc.code_strings(overlay())
        paths = [path for path, _ in strings]
        self.assertEqual(len(paths), len(set(paths)))
        self.assertIn("title", paths)
        self.assertEqual(sum(path.startswith("verbs.") for path in paths), 4)
        self.assertIn("templates.W_TWO_TIMES.4", paths)
        self.assertIn("layouts.find_error_collect.0", paths)
        self.assertIn("valueSeparator", paths)
        self.assertTrue(all(type(text) is str and text.strip() for _, text in strings))


class PlanTests(unittest.TestCase):
    def test_reserve_groups_table(self):
        table = {8: (3, 1), 12: (3, 1), 18: (3, 1), 19: (4, 1), 20: (4, 2), 23: (4, 2), 24: (5, 2), 30: (6, 2)}
        for planned, (practice, challenges) in table.items():
            groups = sc.reserve_groups(planned)
            self.assertEqual(groups, ["practice"] * practice + ["challenges"] * challenges, planned)
        for planned in range(4, 100):
            exact = max(3, -(-Fraction(planned - 3, 5).numerator // Fraction(planned - 3, 5).denominator))
            self.assertEqual(sc.reserve_groups(planned).count("practice"), exact)
        for bad in (3, 100, True, 20.0, "20"):
            with self.assertRaises(ValueError):
                sc.reserve_groups(bad)

    def test_reserve_groups_agree_with_lesson_select(self):
        # One formula in two modules (the contract's plan rows and the selection port) must never drift.
        import lesson_select
        self.assertEqual((sc.PRACTICE, sc.CHALLENGES), (lesson_select.PRACTICE, lesson_select.CHALLENGES))
        self.assertIn(lesson_select.NO_QUESTION, sc.CODES)
        for planned in range(4, 100):
            self.assertEqual(sc.reserve_groups(planned), lesson_select.reserve_groups(planned), planned)

    def test_slot_names(self):
        names = sc.slot_names(20, 6)
        self.assertEqual(len(names), 26)
        self.assertEqual(names[:2] + names[19:21] + names[-1:], ("Q1", "Q2", "Q20", "R1", "R6"))
        self.assertTrue(all(sc.SLOT_RE.match(name) for name in names))
        self.assertEqual(sc.slot_names(1, 0), ("Q1",))
        for bad in ((0, 1), (100, 0), (20, -1), (20, 100), (True, 1), (20, 1.0)):
            with self.assertRaises(ValueError):
                sc.slot_names(*bad)

    def test_plan_rows_for_the_fixture(self):
        planned, reserves = sc.plan_rows(LESSON, scope_for_lesson(LESSON), overlay())
        self.assertEqual([row.slot for row in planned], ["Q%d" % n for n in range(1, 21)])
        self.assertEqual([row.number for row in planned], list(range(1, 21)))
        expect = [(C0, "write_from_words")] * 6 + [(C1, "substitute")] * 6 + [(C2, "collect_like_terms")] * 5
        self.assertEqual([(row.concepts, row.kinds) for row in planned[:17]],
                         [((c,), (k,)) for c, k in expect])
        self.assertTrue(all(row.group == "practice" for row in planned[:17]))
        for row in planned[17:]:
            self.assertEqual((row.group, row.concepts, row.kinds), ("challenges", (C2,), ("find_error_collect",)))
        self.assertEqual([(r.slot, r.number, r.group, r.concepts, r.kinds) for r in reserves],
                         [("R1", 1, "practice", (C0,), ("write_from_words",)),
                          ("R2", 2, "practice", (C1,), ("substitute",)),
                          ("R3", 3, "practice", (C2,), ("collect_like_terms",)),
                          ("R4", 4, "practice", (C0,), ("write_from_words",)),
                          ("R5", 5, "challenges", (C2,), ("find_error_collect",)),
                          ("R6", 6, "challenges", (C2,), ("find_error_collect",))])
        with self.assertRaises(Exception):
            planned[0].slot = "Q9"

    def test_practice_rows_follow_question_plan(self):
        from skill_authoring import question_plan
        for concepts in SUBSETS:
            for count in range(20, 31):
                lesson = lesson_for(count, concepts)
                scope = scope_for_lesson(lesson)
                planned, reserves = sc.plan_rows(lesson, scope, overlay())
                plan = question_plan(lesson, scope)
                self.assertEqual([list(row.concepts) for row in planned[:count - 3]],
                                 [row["conceptIds"] for row in plan[:count - 3]])
                self.assertEqual(len(reserves), len(sc.reserve_groups(count)))
                self.assertTrue(all(row.kinds == ("find_error_collect",) for row in planned[count - 3:]))

    def test_unsupported_lessons_are_refused(self):
        scope = scope_for_lesson(LESSON)
        cases = [
            (lesson_for(level="a"), scope),
            (lesson_for(concepts=(C0, C1)), scope_for_lesson(lesson_for(concepts=(C0, C1)))),
            (lesson_for(concepts=(C2, TOPIC + "#3")), scope_for_lesson(lesson_for(concepts=(C2, TOPIC + "#3")))),
            (dict(LESSON, topicId="g7:equations"), scope),
            (dict(LESSON, questionCount=31), scope),
        ]
        for lesson, lesson_scope in cases:
            for call in (lambda: sc.plan_rows(lesson, lesson_scope, overlay()),
                         lambda: sc.wire_schema(lesson, lesson_scope, overlay(), 6),
                         lambda: sc.authoring_card(lesson, lesson_scope, overlay())):
                with self.assertRaises(sc.ContractError) as caught:
                    call()
                self.assertEqual(caught.exception.code, "WIRE_TOPIC_UNSUPPORTED")
        with self.assertRaises(sc.ContractError):
            sc.plan_rows(LESSON, scope, None)


class SchemaTests(unittest.TestCase):
    def schema(self, lesson=LESSON):
        return sc.wire_schema(lesson, scope_for_lesson(lesson), overlay(), len(sc.reserve_groups(lesson["questionCount"])))

    def test_no_forbidden_keyword_anywhere(self):
        for concepts in SUBSETS:
            for count in (20, 25, 30):
                schema = self.schema(lesson_for(count, concepts))
                keys = set(keys_everywhere(schema))
                for banned in ("anyOf", "oneOf", "allOf", "pattern", "const", "format", "$ref", "$defs", "not",
                               "minProperties", "patternProperties", "if", "then", "else"):
                    self.assertNotIn(banned, keys)
                self.assertFalse(keys & sc.SCHEMA_FORBIDDEN)
                self.assertEqual(sc.schema_problems(schema), [])
                self.assertLessEqual(depth(schema), 6)

    def test_every_object_is_closed_and_fully_required(self):
        def walk(node):
            self.assertIsInstance(node, dict)
            self.assertLessEqual(set(node), sc.SCHEMA_KEYWORDS)
            self.assertIsInstance(node["type"], str)
            if node["type"] == "object":
                self.assertEqual(node["required"], list(node["properties"]))
                self.assertIs(node["additionalProperties"], False)
                for child in node["properties"].values():
                    walk(child)
            elif node["type"] == "array":
                walk(node["items"])
            else:
                self.assertEqual(node["type"], "string")
                self.assertTrue("enum" in node or "maxLength" in node)
        schema = self.schema()
        self.assertEqual(schema["type"], "object")
        self.assertEqual(list(schema["properties"]), ["questions"])
        walk(schema)

    def test_enums_and_bounds(self):
        schema = self.schema()
        root = schema["properties"]["questions"]
        self.assertEqual((root["minItems"], root["maxItems"]), (1, 52))
        q = root["items"]["properties"]
        self.assertEqual(list(root["items"]["properties"]), list(sc.QUESTION_FIELDS))
        self.assertEqual(q["slot"]["enum"], ["Q%d" % n for n in range(1, 21)] + ["R%d" % n for n in range(1, 7)])
        self.assertEqual(len(q["slot"]["enum"]), 26)
        self.assertEqual(q["kind"]["enum"], ["write_from_words", "substitute", "collect_like_terms",
                                             "find_error_collect"])
        self.assertEqual(q["intro"]["maxLength"], 300)
        self.assertEqual((q["items"]["minItems"], q["items"]["maxItems"]), (3, 6))
        self.assertEqual(q["givens"]["maxItems"], 8)
        given = q["givens"]["items"]["properties"]
        self.assertEqual(given["id"]["enum"], list(sc.GIVEN_IDS))
        self.assertEqual(given["type"]["enum"], list(sc.GIVEN_TYPES))
        self.assertEqual(given["unit"]["enum"], [""])
        self.assertEqual(given["value"]["maxLength"], 60)
        table = q["table"]["properties"]
        self.assertEqual((table["head"]["maxItems"], table["rows"]["maxItems"], table["rows"]["items"]["maxItems"]),
                         (6, 8, 6))
        it = q["items"]["items"]["properties"]
        self.assertEqual(list(q["items"]["items"]["properties"]), list(sc.ITEM_FIELDS))
        self.assertEqual(it["form"]["enum"], ["", "expression", "integer"])
        self.assertEqual(it["ask"]["enum"], [""])
        self.assertEqual(it["variant"]["enum"], [""] + W_IDS + ["M1", "M2", "M3"])
        self.assertEqual([it[f]["maxLength"] for f in ("text", "expr", "expr2", "values")], [200, 120, 120, 40])

    def test_enums_follow_the_selected_concepts(self):
        schema = self.schema(lesson_for(24, (C1, C2)))
        q = schema["properties"]["questions"]["items"]["properties"]
        self.assertEqual(q["kind"]["enum"], ["substitute", "collect_like_terms", "find_error_collect"])
        self.assertEqual(q["items"]["items"]["properties"]["variant"]["enum"], ["", "M1", "M2", "M3"])
        self.assertEqual(len(q["slot"]["enum"]), 24 + 7)
        schema = self.schema(lesson_for(20, (C2,)))
        q = schema["properties"]["questions"]["items"]["properties"]
        self.assertEqual(q["items"]["items"]["properties"]["form"]["enum"], ["", "expression"])

    def test_good_reply_satisfies_the_schema(self):
        schema = self.schema()
        reply = good_reply()
        self.assertEqual(len(reply["questions"]), 26)
        self.assertEqual(conforms(reply, schema), [])
        self.assertLessEqual(len(json.dumps(reply, ensure_ascii=False).encode("utf-8")), sc.LIMITS["reply_bytes"])

    def test_structural_walker_refuses_off_schema_replies(self):
        schema = self.schema()
        mutations = {
            "extra key": lambda r: r["questions"][0].update(rule="x"),
            "missing table": lambda r: r["questions"][0].pop("table"),
            "missing expr2": lambda r: r["questions"][0]["items"][0].pop("expr2"),
            "unknown slot": lambda r: r["questions"][0].update(slot="Q21"),
            "unknown kind": lambda r: r["questions"][0].update(kind="solve"),
            "unknown variant": lambda r: r["questions"][0]["items"][0].update(variant="W_HALF"),
            "unknown form": lambda r: r["questions"][0]["items"][0].update(form="fraction"),
            "seven items": lambda r: r["questions"][0]["items"].extend([item("x")] * 4),
            "two items": lambda r: r["questions"][0]["items"].pop(),
            "long expr": lambda r: r["questions"][0]["items"][0].update(expr="x" * 121),
            "object for array": lambda r: r["questions"][0].update(items={"q1": item("x")}),
            "root extra": lambda r: r.update(rule=[]),
        }
        for name, mutate in mutations.items():
            reply = good_reply()
            mutate(reply)
            self.assertNotEqual(conforms(reply, schema), [], name)

    def test_schema_problems_finds_unsafe_keywords(self):
        schema = self.schema()
        unsafe = copy.deepcopy(schema)
        unsafe["properties"]["questions"]["items"]["properties"]["slot"]["pattern"] = "^Q"
        self.assertIn("SCHEMA_KEYWORD:pattern", sc.schema_problems(unsafe))
        unsafe = copy.deepcopy(schema)
        unsafe["anyOf"] = []
        self.assertIn("SCHEMA_KEYWORD:anyOf", sc.schema_problems(unsafe))
        unsafe = copy.deepcopy(schema)
        unsafe["properties"]["questions"]["items"]["additionalProperties"] = True
        self.assertIn("SCHEMA_ADDITIONAL", sc.schema_problems(unsafe))
        unsafe = copy.deepcopy(schema)
        unsafe["required"] = []
        self.assertIn("SCHEMA_REQUIRED", sc.schema_problems(unsafe))
        nested = {"type": "string", "maxLength": 1}
        for _ in range(7):
            nested = {"type": "array", "items": nested, "maxItems": 1}
        self.assertIn("SCHEMA_DEPTH", sc.schema_problems(nested))
        self.assertIn("SCHEMA_TYPE", sc.schema_problems({"type": ["string", "null"]}))

    def test_schema_is_deterministic_and_small(self):
        first = json.dumps(self.schema(), ensure_ascii=False, separators=(",", ":"))
        second = json.dumps(self.schema(), ensure_ascii=False, separators=(",", ":"))
        self.assertEqual(first, second)
        self.assertLessEqual(len(first.encode("utf-8")), 2600)
        with self.assertRaises(ValueError):
            sc.wire_schema(LESSON, scope_for_lesson(LESSON), overlay(), -1)


class CardTests(unittest.TestCase):
    def test_card_size_bounds_and_lint_for_every_lesson_shape(self):
        sizes = []
        for concepts in SUBSETS:
            for count in range(20, 31):
                lesson = lesson_for(count, concepts)
                scope = scope_for_lesson(lesson)
                card = sc.authoring_card(lesson, scope, overlay())
                size = len(card.encode("utf-8"))
                sizes.append(size)
                self.assertGreaterEqual(size, 3072, (count, concepts))
                self.assertLessEqual(size, 5000, (count, concepts))
                for mark in ("$", "\\", "[[", "]]", "\u00b7", "\u00d7", "\u00f7", "\u2212", "\u221a"):
                    self.assertNotIn(mark, card)
                self.assertEqual(sc.card_problems(card), [])
                self.assertEqual(card, sc.authoring_card(lesson, scope, overlay()))
                self.assertIn("overlay reviewed: yes", card)               # approved by Noam, 2026-11-25
                self.assertIn(overlay()["title"], card)
                for term in overlay()["forbiddenTerms"]:
                    self.assertIn(term, card)
                for kind in sc.wire_schema(lesson, scope, overlay(), len(sc.reserve_groups(count)))[
                        "properties"]["questions"]["items"]["properties"]["kind"]["enum"]:
                    self.assertIn(kind + " (", card)
        self.assertEqual(len(sizes), 44)

    def test_card_plan_lines_cover_every_slot_once(self):
        for concepts in SUBSETS:
            for count in (20, 27, 30):
                lesson = lesson_for(count, concepts)
                card = sc.authoring_card(lesson, scope_for_lesson(lesson), overlay())
                plan = card.split("PLAN (slot | group | concept | kind)\n", 1)[1].split("\nR slots", 1)[0]
                seen = []
                for line in plan.splitlines():
                    label = line.split(" | ", 1)[0]
                    first, _, last = label.partition("-")
                    last = last or first
                    seen += ["%s%d" % (first[0], n) for n in range(int(first[1:]), int(last[1:]) + 1)]
                self.assertEqual(seen, list(sc.slot_names(count, len(sc.reserve_groups(count)))))

    def test_card_examples_are_outside_the_profile_and_correct(self):
        ov = overlay()
        profile = ov["profile"]
        for kind, example in ov["examples"].items():
            numbers = [int(n) for n in re.findall(r"\d+", example["expr"])]
            self.assertTrue(any(n > profile["literal_max"] for n in numbers), kind)
        values = [int(v) for v in re.findall(r"-?\d+", ov["examples"]["substitute"]["values"])]
        self.assertTrue(any(not profile["value_min"] <= v <= profile["value_max"] for v in values))
        for expr in ov["exampleQuestion"][1]:
            self.assertTrue(any(int(n) > profile["literal_max"] for n in re.findall(r"\d+", expr)))
            self.assertGreater(len(monomials(expr)), 0)
            self.assertLess(len(monomials(expr)), len(terms(expr)), "an example must have like terms")
        # The mistake notes state real outcomes of M1, M2 and M3.
        notes = {mid: re.search(r": (\S+) gives (\S+)\.$", note).groups() for mid, note in ov["mistakeNotes"].items()}
        expr, wrong = notes["M1"]
        parts = terms(expr)
        total = sum(int(d or "1") * (-1 if s == "-" else 1) for s, d, _ in parts)
        self.assertEqual(monomials(wrong), {next(l for _, _, l in parts if l): total})
        expr, wrong = notes["M2"]
        parts = terms(expr)
        flip = next(i for i, (s, _, _) in enumerate(parts) if i and s == "-")
        parts[flip] = ("+",) + parts[flip][1:]
        self.assertEqual(monomials(wrong), monomials("".join(s + d + l for s, d, l in parts)))
        self.assertNotEqual(monomials(wrong), monomials(expr))
        expr, wrong = notes["M3"]
        parts = terms(expr)
        drop = next(i for i, (_, d, l) in enumerate(parts) if l and not d
                    and any(j != i and parts[j][2] == l for j in range(len(parts))))
        del parts[drop]
        self.assertEqual(monomials(wrong), monomials("".join(s + d + l for s, d, l in parts)))
        example = ov["examples"]["find_error_collect"]
        self.assertEqual(example["expr2"], notes[example["variant"]][1])

    def test_card_and_schema_follow_the_one_table(self):
        scope = scope_for_lesson(LESSON)
        table = sc.thaw(overlay())
        table["profile"].update(literal_max=12, value_min=-5, terms_max=3, power=True)
        table["forbiddenTerms"].append("מכפלה")
        table["kinds"]["collect_like_terms"]["form"] = "integer"
        table["templates"]["W_TIMES"]["shape"] = "kv "
        card = sc.authoring_card(LESSON, scope, table)
        self.assertIn("whole number from 0 to 12; every value is a whole number from -5 to 10", card)
        self.assertIn("At most 3 terms", card)
        self.assertIn("No division, no brackets around a sum.", card)
        self.assertNotIn("^", card.split("TOPIC", 1)[0])
        self.assertIn("מכפלה", card)
        self.assertIn("collect_like_terms (practice, form integer)", card)
        self.assertIn("W_TIMES kv ;", card)
        schema = sc.wire_schema(LESSON, scope, table, 6)
        item_props = schema["properties"]["questions"]["items"]["properties"]["items"]["items"]["properties"]
        self.assertEqual(item_props["form"]["enum"], ["", "expression", "integer"])
        table["kinds"]["substitute"]["form"] = "expression"
        table["kinds"]["collect_like_terms"]["form"] = "expression"
        schema = sc.wire_schema(LESSON, scope, table, 6)
        item_props = schema["properties"]["questions"]["items"]["properties"]["items"]["items"]["properties"]
        self.assertEqual(item_props["form"]["enum"], ["", "expression"])

    def test_card_problems(self):
        self.assertIn("CARD_SIZE", sc.card_problems("short"))
        self.assertIn("CARD_CHAR", sc.card_problems("a $x$ " * 600))
        self.assertIn("CARD_CHAR", sc.card_problems("[[12]] " * 600))
        self.assertIn("CARD_CHAR", sc.card_problems("5 \u2212 2 " * 600))
        self.assertEqual(sc.card_problems("plain words " * 300), [])


class SelectionTests(unittest.TestCase):
    def check(self, selection, questions, lesson=LESSON):
        sc.validate_selection(selection, lesson=lesson, scope=scope_for_lesson(lesson), questions=questions)

    def refused(self, selection, questions, lesson=LESSON):
        with self.assertRaises(sc.SelectionError) as caught:
            self.check(selection, questions, lesson)
        error = caught.exception
        self.assertIn(error.code, ("SOURCE_SELECTION", "SOURCE_COVERAGE"))
        self.assertIsNone(re.search(r"[א-ת0-9]", error.reason))
        return error.code

    def test_good_record_passes(self):
        selection, questions = selection_record()
        self.assertEqual(selection["floor"], question_floor(7))
        self.check(selection, questions)

    def test_each_mutation_is_refused_with_its_code(self):
        def edit(path, value):
            def apply(selection, questions):
                target = selection
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = value
            return apply

        cases = {
            "requested": (edit(["requested"], 19), "SOURCE_SELECTION"),
            "delivered as bool": (edit(["delivered"], True), "SOURCE_SELECTION"),
            "floor": (edit(["floor"], 8), "SOURCE_SELECTION"),
            "delivered": (edit(["delivered"], 19), "SOURCE_SELECTION"),
            "dropped length": (edit(["dropped"], [{"slot": "Q5", "codes": ["ITEM_COUNT"]}]), "SOURCE_SELECTION"),
            "digit code": (edit(["replaced", 0, "codes"], ["D12_MIRROR"]), "SOURCE_SELECTION"),
            "unknown code": (edit(["replaced", 0, "codes"], ["NOT_A_CODE"]), "SOURCE_SELECTION"),
            "no codes": (edit(["replaced", 0, "codes"], []), "SOURCE_SELECTION"),
            "seventeen codes": (edit(["replaced", 0, "codes"], ["KERNEL_" + "A" * n for n in range(1, 18)]),
                                "SOURCE_SELECTION"),
            "unknown concept": (edit(["questions", 0, "conceptIds"], [TOPIC + "#3"]), "SOURCE_COVERAGE"),
            "empty concepts": (edit(["questions", 0, "conceptIds"], []), "SOURCE_COVERAGE"),
            "star mismatch": (edit(["questions", 0, "star"], True), "SOURCE_SELECTION"),
            "by planned slot": (edit(["replaced", 0, "by"], "Q5"), "SOURCE_SELECTION"),
            "by unplanned reserve": (edit(["replaced", 0, "by"], "R9"), "SOURCE_SELECTION"),
            "by lower case": (edit(["replaced", 0, "by"], "repair"), "SOURCE_SELECTION"),
            "replaced reserve slot": (edit(["replaced", 0, "slot"], "R1"), "SOURCE_SELECTION"),
            "numbering": (edit(["questions", 2, "n"], 4), "SOURCE_SELECTION"),
            "unknown origin": (edit(["questions", 0, "origin"], "model"), "SOURCE_SELECTION"),
            "origin and slot disagree": (edit(["questions", 3, "origin"], "planned"), "SOURCE_SELECTION"),
            "bad slot": (edit(["questions", 0, "slot"], "Q01"), "SOURCE_SELECTION"),
            "slot outside plan": (edit(["questions", 0, "slot"], "R7"), "SOURCE_SELECTION"),
            "extra key": (edit(["note"], "x"), "SOURCE_SELECTION"),
        }
        for name, (mutate, code) in cases.items():
            selection, questions = selection_record()
            mutate(selection, questions)
            self.assertEqual(self.refused(selection, questions), code, name)

    def test_cross_record_consistency(self):
        def coverage_gap(selection, questions):
            for row in selection["questions"]:
                if row["conceptIds"] == [C1]:
                    row["conceptIds"] = [C0]

        def swap_order(selection, questions):
            rows = selection["questions"]
            rows[0]["slot"], rows[1]["slot"] = rows[1]["slot"], rows[0]["slot"]

        def duplicate_slot(selection, questions):
            selection["questions"][1]["slot"] = "Q1"

        def reserve_twice(selection, questions):
            selection["replaced"][1]["by"] = "R1"

        def challenge_reserve_in_practice(selection, questions):
            selection["replaced"][0]["by"] = "R6"
            selection["questions"][3]["slot"] = "R6"

        def planned_but_replaced(selection, questions):
            selection["replaced"].append({"slot": "Q5", "by": "REPAIR", "codes": ["ITEM_COUNT"]})

        def reserve_without_entry(selection, questions):
            del selection["replaced"][0]

        def repair_without_entry(selection, questions):
            selection["questions"][4]["origin"] = "repair"

        def missing_position(selection, questions):
            selection["questions"][4]["slot"] = "R4"
            selection["questions"][4]["origin"] = "reserve"
            selection["replaced"].append({"slot": "Q4", "by": "R4", "codes": ["DUPLICATE_TASK"]})

        def star_against_group(selection, questions):
            selection["questions"][18]["star"] = False
            questions[18]["star"] = False

        def too_many_replaced(selection, questions):
            selection["replaced"] += [{"slot": "Q4", "by": "REPAIR", "codes": ["ITEM_COUNT"]}] * 29

        def questions_not_dicts(selection, questions):
            questions[0] = []

        cases = {
            "coverage gap": (coverage_gap, "SOURCE_COVERAGE"),
            "printed order": (swap_order, "SOURCE_SELECTION"),
            "duplicate slot": (duplicate_slot, "SOURCE_SELECTION"),
            "reserve used twice": (reserve_twice, "SOURCE_SELECTION"),
            "challenge reserve in a practice slot": (challenge_reserve_in_practice, "SOURCE_SELECTION"),
            "planned question with a replacement": (planned_but_replaced, "SOURCE_SELECTION"),
            "reserve without an entry": (reserve_without_entry, "SOURCE_SELECTION"),
            "repair without an entry": (repair_without_entry, "SOURCE_SELECTION"),
            "two questions in one position": (missing_position, "SOURCE_SELECTION"),
            "star against the planned group": (star_against_group, "SOURCE_SELECTION"),
            "more than 32 replacements": (too_many_replaced, "SOURCE_SELECTION"),
            "printed question is not a dict": (questions_not_dicts, "SOURCE_SELECTION"),
        }
        for name, (mutate, code) in cases.items():
            selection, questions = selection_record()
            mutate(selection, questions)
            self.assertEqual(self.refused(selection, questions), code, name)
        self.refused(selection_record()[0], selection_record()[1][:-1])
        self.refused(None, [])

    def test_repairs_chains_stand_ins_and_short_sheets_pass(self):
        # A repaired position keeps its planned slot; a chain prints the last reserve placed there.
        selection, questions = selection_record()
        selection["questions"][6].update(origin="repair")
        selection["replaced"].append({"slot": "Q7", "by": "REPAIR", "codes": ["QUESTION_MISSING"]})
        selection["questions"][3]["slot"] = "R4"
        selection["replaced"].insert(1, {"slot": "Q4", "by": "R4", "codes": ["DUPLICATE_TASK"]})
        self.check(selection, questions)
        stale = copy.deepcopy(selection)
        stale["questions"][3]["slot"] = "R1"
        self.refused(stale, questions)
        # D5: a practice reserve stands in for a challenge, printed unstarred among the ordinary questions.
        selection, questions = selection_record()
        rows = selection["questions"]
        challenge = rows.pop(18)
        challenge.update(slot="R4", star=False)
        rows.insert(17, challenge)
        for n, row in enumerate(rows, 1):
            row["n"] = n
        selection["replaced"][3]["by"] = "R4"
        self.check(selection, [{"star": row["star"]} for row in rows])
        # N=24 > floor: two planned positions are dropped and 22 questions print.
        lesson = lesson_for(24)
        concept = {n: C0 if n <= 7 else C1 if n <= 14 else C2 for n in range(1, 25)}
        rows = []
        for position in [p for p in range(1, 22) if p not in (5, 10)] + [22, 23, 24]:
            rows.append({"n": len(rows) + 1, "slot": "Q%d" % position, "origin": "planned",
                         "conceptIds": [concept[position]], "star": position > 21})
        selection = {"requested": 24, "floor": 20, "delivered": 22, "questions": rows, "replaced": [],
                     "dropped": [{"slot": "Q5", "codes": ["MATH_PARSE"]}, {"slot": "Q10", "codes": ["LEAK_OWN"]}]}
        questions = [{"star": row["star"]} for row in rows]
        self.check(selection, questions, lesson)
        printed_and_dropped = copy.deepcopy(selection)
        printed_and_dropped["dropped"][0]["slot"] = "Q6"
        self.refused(printed_and_dropped, questions, lesson)
        below_floor = copy.deepcopy(selection)
        below_floor["delivered"] = 19
        self.refused(below_floor, questions, lesson)


if __name__ == "__main__":
    unittest.main()
