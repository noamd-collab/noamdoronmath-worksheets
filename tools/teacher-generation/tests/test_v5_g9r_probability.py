"""worksheet-wire/5 on the middle path for g9r:probability (grade 9, הסתברות, level e): the probability overlay and
its plan, the five probability kinds at compile time and in the final validator, and the fixtures in
tests/fixtures/v5/g9r_probability/:

- lesson.json: the repro g9r:probability lesson, verbatim (scratchpad repro/lessons.json);
- reply_good.json: 20 planned questions (Q18-Q20 starred) and 6 reserves, all clean;
- adversarial.json: single questions, each refused with the exact code set written by hand;
- expected.json: hand-computed keys, cross-checked here against a third, independent probability routine.
"""
import copy
from fractions import Fraction
import itertools
import json
from pathlib import Path
import random
import re
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402

from general_source import GeneralSourceError, V5_CONTRACT, validate_source  # noqa: E402
from item_kinds import BindingError, Context, verify_item, verify_question  # noqa: E402
from math_tasks import validate_and_solve_task  # noqa: E402
import probability_kinds as pk  # noqa: E402
import school_math as sm  # noqa: E402
import structured_contract as sc  # noqa: E402
import structured_source as ss  # noqa: E402

G9R = S.FIXTURES / "g9r_probability"
TOPIC = "g9r:probability"
PINNED = S.MIDDLE_PINNED


def load(name):
    return json.loads((G9R / name).read_text(encoding="utf-8"))


def lesson():
    return load("lesson.json")


def scope(of=None):
    from runtime_catalog import scope_for_lesson
    return scope_for_lesson(of or lesson())


def overlay():
    return sc.overlay_for(TOPIC, "e")


def rows():
    planned, reserves = sc.plan_rows(lesson(), scope(), overlay())
    return {row.slot: row for row in list(planned) + list(reserves)}


def context(ov=None):
    return Context(lesson(), scope(), ov or overlay(), str(S.MIDDLE))


def compile_good(reply=None):
    return ss.compile_sheet(lesson(), scope(), reply if reply is not None else load("reply_good.json"),
                            skill_path=str(S.MIDDLE))


def wire(slot):
    return copy.deepcopy(next(q for q in load("reply_good.json")["questions"] if q["slot"] == slot))


def item(expr, ask, variant, form=""):
    return {"text": "", "expr": expr, "expr2": "", "values": "", "ask": ask, "form": form, "variant": variant}


def independent(kind, ask, counts):
    """A third probability routine (no code shared with probability_kinds): enumerate the equally likely ordered
    draws of the objects themselves and count the event's outcomes."""
    objects = [category for category, count in enumerate(counts, 1) for _ in range(count)]
    name = ask.rsplit("_", 1)
    if kind in ("single_draw_probability", "relative_frequency"):
        outcomes = [(o,) for o in objects]
    elif kind == "two_stage_without_replacement":
        outcomes = [(objects[i], objects[j]) for i in range(len(objects)) for j in range(len(objects)) if i != j]
    else:
        outcomes = [(a, b) for a in objects for b in objects]

    def event(o):
        if ask == "one_of_each":
            return sorted(o) == [1, 2]
        if ask == "same":
            return o[0] == o[1]
        if ask.startswith(("one_", "freq_", "prob_")):
            return o[0] == int(name[1])
        if ask.startswith("either_"):
            return o[0] in (int(ask[-2]), int(ask[-1]))
        if ask.startswith("not_first_"):
            return o[0] != int(name[1])
        if ask.startswith("at_least_one_"):
            return int(name[1]) in o
        if ask.startswith("both_"):
            return o == (int(name[1]),) * 2
        if ask.startswith("first_"):
            return o == (int(ask[6]), int(ask[-1]))
        raise AssertionError(ask)

    return Fraction(sum(1 for o in outcomes if event(o)), len(outcomes))


def printed_key(key):
    if key.endswith("%"):
        return Fraction(int(key[:-1]), 100)
    if "/" in key:
        a, b = key.split("/")
        return Fraction(int(a), int(b))
    return Fraction(key)


# ------------------------------------------------------------------ the overlay and its plan

class ProbabilityOverlay(unittest.TestCase):
    def test_enabled_for_level_e_only_and_unreviewed(self):
        self.assertIs(overlay(), sc.OVERLAYS[TOPIC])
        for level in ("a", "b", None):
            self.assertIsNone(sc.overlay_for(TOPIC, level))
        ov = overlay()
        self.assertIs(ov["reviewed"], False)
        self.assertEqual(ov["family"], "probability")
        self.assertNotIn("skill", ov)
        self.assertLessEqual({"title", "rule", "stories", "tables", "formNotes"}, set(ov["pendingReview"]))
        sc.check_overlay(ov)
        sc.check_overlay(sc.thaw(ov))
        with self.assertRaises(TypeError):
            ov["title"] = "x"

    def test_the_lesson_is_the_repro_lesson(self):
        from validation import validate_lesson
        data = lesson()
        self.assertEqual((data["topicId"], data["level"], data["gradeNumber"], data["questionCount"]),
                         (TOPIC, "e", 9, 20))
        self.assertEqual(data["lessonBoundary"]["conceptIds"], ["g9r:probability#%d" % n for n in range(4)])
        self.assertIn("דיאגרמת עץ", data["lastLesson"])
        self.assertIn("עדיין לא למדנו טבלת דו־ממדית", data["lastLesson"])
        self.assertEqual(validate_lesson(data)["skill"], "middle")
        found = scope()
        self.assertEqual(found["topic"]["domain"], "אי-ודאות")              # not geometry: no figure, no drawing
        self.assertEqual([c["id"] for c in found["excludedConcepts"]], ["g9r:probability#4"])

    def test_plan_rows(self):
        planned, reserves = sc.plan_rows(lesson(), scope(), overlay())
        concepts = [row.concepts[0][-1] for row in planned]
        self.assertEqual(concepts, list("00000111122223333") + ["3"] * 3)
        self.assertEqual([row.group for row in planned[17:]], ["challenges"] * 3)
        self.assertEqual({row.kinds for row in planned[17:]}, {("two_stage_without_replacement",)})
        self.assertEqual(planned[13].kinds, ("two_stage_with_replacement", "two_stage_without_replacement"))
        self.assertEqual([(row.slot, row.group, row.concepts[0][-1]) for row in reserves],
                         [("R1", "practice", "0"), ("R2", "practice", "1"), ("R3", "practice", "2"),
                          ("R4", "practice", "3"), ("R5", "challenges", "3"), ("R6", "challenges", "3")])

    def test_schema_card_and_reply(self):
        schema = sc.wire_schema(lesson(), scope(), overlay(), 6)
        self.assertEqual(sc.schema_problems(schema), [])
        item_props = schema["properties"]["questions"]["items"]["properties"]["items"]["items"]["properties"]
        self.assertEqual(item_props["form"]["enum"], ["", "fraction", "decimal", "percent"])
        enums = {name: set(item_props[name]["enum"]) for name in ("ask", "variant")}
        question_props = schema["properties"]["questions"]["items"]["properties"]
        for question in load("reply_good.json")["questions"]:
            self.assertIn(question["slot"], question_props["slot"]["enum"])
            self.assertIn(question["kind"], question_props["kind"]["enum"])
            for entry in question["items"]:
                self.assertIn(entry["ask"], enums["ask"])
                self.assertIn(entry["variant"], enums["variant"])
                self.assertIn(entry["form"], item_props["form"]["enum"])
        card = sc.authoring_card(lesson(), scope(), overlay())
        self.assertEqual(sc.card_problems(card), [])
        self.assertTrue(sc.CARD_MIN_BYTES <= len(card.encode("utf-8")) <= sc.CARD_MAX_BYTES)
        for kind in pk.KINDS:
            self.assertIn(kind, card)
        self.assertIn("No drawing, no two-way table.", card)
        self.assertEqual(card, sc.authoring_card(lesson(), scope(), overlay()))

    def test_the_card_example_is_correct_and_outside_the_profile(self):
        ov = overlay()
        kind, asks = ov["exampleQuestion"]
        counts = tuple(int(given["value"]) for given in ov["exampleGivens"])
        self.assertFalse(pk.in_profile(kind, counts, ov))
        for ask in asks:
            node = sm.parse(pk.canonical_text(kind, ask, 2), letters=())
            self.assertEqual(pk.evaluate(node, {"n1": counts[0], "n2": counts[1]}), independent(kind, ask, counts))
        question = {"slot": "Q14", "kind": kind, "intro": "", "givens": sc.thaw(ov["exampleGivens"]),
                    "table": {"head": [], "rows": []},
                    "items": [item(pk.canonical_text(kind, ask, 2), ask, "R_BALLS") for ask in asks]}
        self.assertEqual(ss.compile_question(question, rows()["Q14"], context()).codes, ("MATH_SCOPE_RANGE",))

    def test_code_written_strings(self):
        import general_source
        import text_lint as tl
        ov = overlay()
        strings = sc.code_strings(ov)
        paths = [path for path, _ in strings]
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual(sum(path.startswith("stories.") and ".asks." in path for path in paths), 108)
        for path, text in strings:
            self.assertEqual(tl.check_ir_text(text), [], path)
            self.assertFalse(tl.forbidden_term_hits(text, ov["forbiddenTerms"]), path)
            self.assertIsNone(tl._ARGUMENT.search(text), path)
            self.assertIsNone(general_source.DRAWING_REQUEST.search(text), path)
            self.assertNotIn("מתוך", text, path)                  # "a מתוך b" is a printed fraction to the pinned D12
            self.assertNotRegex(text, r"(?<![א-ת])(?:חצי|שליש|רבע|אחוז)(?![א-ת])", path)
        asks = [text for path, text in strings if ".asks." in path]
        self.assertEqual(len(asks), len(set(asks)))                # every printed ask is its own sentence
        self.assertEqual(tl.check_ir_spans(sc.rule_spans(ov)), [])
        for sid, story in ov["stories"].items():
            spans = pk.story_intro(sid, tuple(range(2, 2 + story["categories"])), ov)
            self.assertEqual(tl.check_ir_spans(spans), [], sid)

    @unittest.skipUnless(PINNED, "Pinned middle skill unavailable")
    def test_code_written_strings_name_no_not_yet_tool(self):
        """Every code-written string, checked with the pinned didactic keyword reader in an isolated process."""
        strings = [text for _, text in sc.code_strings(overlay())]
        script = ("import json, sys\nsys.dont_write_bytecode = True\nsys.path.insert(0, sys.argv[1])\nimport didactic\n"
                  "block = didactic.curriculum_block({'topic': 'probability', 'track': 'ט_רגילה'}, grade='9')\n"
                  "ids = [row['id'] for row in block['not_yet_allowed']]\n"
                  "texts = json.loads(sys.stdin.read())\n"
                  "print(json.dumps([len(ids)] + [sorted(didactic.tools_named_in(text, ids=ids)) for text in texts]))\n")
        done = subprocess.run([sys.executable, "-I", "-B", "-c", script, str(S.MIDDLE)], input=json.dumps(strings),
                              capture_output=True, text=True, timeout=120)
        self.assertEqual(done.returncode, 0, done.stderr[-400:])
        found = json.loads(done.stdout)
        self.assertGreater(found[0], 0)
        self.assertEqual(found[1:], [[] for _ in strings])

    def test_check_overlay_refuses_a_broken_probability_table(self):
        mutations = {
            "an ask text twice": lambda o: o["stories"]["D_CARDS"]["asks"].update(
                one_1=o["stories"]["D_BALLS"]["asks"]["one_1"]),
            "a missing ask": lambda o: o["stories"]["R_BALLS"]["asks"].pop("same"),
            "a table on a bag story": lambda o: o["stories"]["D_BALLS"].update(
                table={"head": ["צבע", "אדום", "כחול", "ירוק"], "rowHead": "מספר"}),
            "a frequency story without a table": lambda o: o["stories"]["F_CARS"].pop("table"),
            "three colours in a two-draw story": lambda o: o["stories"]["N_PENS"].update(categories=3),
            "an unknown form": lambda o: o["kinds"]["relative_frequency"].update(forms=["fraction", "ratio"]),
            "asks off the code table": lambda o: o["kinds"]["complement_probability"].update(
                asks=["not_first_1", "at_least_one_1"]),
            "a challenge ask of no challenge kind": lambda o: o.update(challengeAsks=["one_1"]),
            "an orphan story": lambda o: o["stories"].update(X_EXTRA=dict(o["stories"]["D_BALLS"])),
            "a percent with places": lambda o: o["profile"].update(percentPlaces=1),
            "no table flag": lambda o: o.update(tables=False),
            "a count below one": lambda o: o["kinds"]["single_draw_probability"]["counts"].update(min=0),
        }
        for name, mutate in mutations.items():
            broken = sc.thaw(overlay())
            mutate(broken)
            with self.subTest(name), self.assertRaises(ValueError):
                sc.check_overlay(broken)


# ------------------------------------------------------------------ the probabilities

class Probabilities(unittest.TestCase):
    def all_asks(self):
        for kind in pk.KINDS:
            for categories in (2, 3, 4):
                for ask in pk.ASKS_BY_KIND[kind]:
                    if pk.ask_available(kind, ask, categories):
                        yield kind, ask, categories

    def test_canonical_value_formula_and_enumeration_agree(self):
        rng = random.Random(9)
        cases = 0
        for kind, ask, categories in self.all_asks():
            node = pk.canonical_node(kind, ask, categories)
            for _ in range(6):
                counts = tuple(rng.randint(2, 9) for _ in range(categories))
                values = {"n%d" % i: c for i, c in enumerate(counts, 1)}
                expected = independent(kind, ask, counts)
                self.assertEqual(pk.probability_value(kind, ask, counts), expected, (kind, ask, counts))
                self.assertEqual(pk.evaluate(node, values), expected, (kind, ask, counts))
                solved = validate_and_solve_task(pk.task_of(kind, ask, counts))
                result = solved["result"]["value"]
                self.assertEqual(Fraction(result["numerator"], result["denominator"]), expected)
                self.assertEqual(pk.task_counts(kind, ask, categories, solved["question"]["expression"]), counts)
                cases += 1
        self.assertGreater(cases, 150)

    def test_asks_fit_their_stories(self):
        ov = overlay()
        for sid, story in ov["stories"].items():
            kind = story["kind"]
            for ask in ov["kinds"][kind]["asks"]:
                self.assertEqual(ask in story["asks"], pk.ask_available(kind, ask, story["categories"]), (sid, ask))
        self.assertFalse(pk.ask_available("relative_frequency", "freq_4", 3))
        self.assertFalse(pk.ask_available("two_stage_with_replacement", "at_least_one_1", 2))
        self.assertFalse(pk.ask_available("single_draw_probability", "either_21", 3))
        self.assertIsNone(pk.ask_parts("first_1_second_1"))

    def test_key_forms_and_house_islands(self):
        ov = overlay()
        cases = [(Fraction(2, 5), "fraction", "2/5", "$\\f{2}{5}$"), (Fraction(7, 20), "decimal", "0.35", "$0.35$"),
                 (Fraction(1, 2), "decimal", "0.5", "$0.5$"), (Fraction(7, 25), "percent", "28%", "$28\\%$"),
                 (Fraction(1, 100), "decimal", "0.01", "$0.01$"), (Fraction(49, 100), "fraction", "49/100",
                                                                   "$\\f{49}{100}$")]
        for value, form, notation, island in cases:
            self.assertEqual(pk.key_notation(value, form, ov), notation)
            key = {"form": form, "notation": notation, "symbols": [], "binding": {}}
            self.assertEqual(sm.key_island(key), island)
            self.assertTrue(pk.key_roundtrip(key, value))
            self.assertFalse(pk.key_roundtrip(key, value + Fraction(1, 1000)))
        for value, form in ((Fraction(9, 40), "decimal"), (Fraction(3, 8), "percent"), (Fraction(1, 3), "decimal"),
                            (Fraction(1), "fraction"), (Fraction(0), "percent"), (Fraction(1, 2), "ratio")):
            with self.assertRaises(ValueError):
                pk.key_notation(value, form, ov)
        self.assertEqual(sm.to_house(sm.parse("1-3/10=7/10", letters=(), allow_relation=True)),
                         "1 − \\f{3}{10} = \\f{7}{10}")
        self.assertEqual(sm.from_house("1 − \\f{3}{10} = \\f{7}{10}", letters=(), allow_relation=True),
                         sm.parse("1-3/10=7/10", letters=(), allow_relation=True))

    def test_the_binding_reads_values_at_the_givens_and_the_probes(self):
        kind, ask = "two_stage_without_replacement", "one_of_each"
        for text in ("({n1}/({n1}+{n2}))*({n2}/({n1}+{n2}-1))+({n2}/({n1}+{n2}))*({n1}/({n1}+{n2}-1))",
                     "2*{n1}*{n2}/(({n1}+{n2})*({n1}+{n2}-1))", "1-({n1}*({n1}-1)+{n2}*({n2}-1))/(({n2}+{n1})^2-{n1}-{n2})"):
            self.assertTrue(pk.binds(sm.parse(text, letters=()), kind, ask, (4, 6)), text)
        same_function = sm.parse("{n1}*{n2}/(({n1}+{n2})*({n1}+{n2}-1))*2+{n1}-{n1}*{n2}/{n2}", letters=())
        self.assertTrue(pk.binds(same_function, kind, ask, (4, 6)))
        # Equal to the canonical probability at the givens only: refused at the probe points.
        coincidence = sm.parse("8/15", letters=())
        self.assertEqual(pk.evaluate(coincidence, {}), pk.probability_value(kind, ask, (4, 6)))
        self.assertFalse(pk.binds(coincidence, kind, ask, (4, 6)))
        with_replacement = sm.parse("2*{n1}*{n2}/(({n1}+{n2})^2)", letters=())
        self.assertFalse(pk.binds(with_replacement, kind, ask, (4, 6)))

    def test_prob_range_at_compile_time(self):
        loose = sc.thaw(overlay())
        loose["kinds"]["two_stage_without_replacement"]["counts"]["min"] = 1
        ctx = context(loose)
        out = pk.compile_item("two_stage_without_replacement",
                              item("({n1}/({n1}+{n2}))*(({n1}-1)/({n1}+{n2}-1))", "both_1", "N_BALLS"), 1, ctx,
                              givens=(1, 5), template="N_BALLS")
        self.assertEqual(out.codes, ("PROB_RANGE",))                       # P = 0: one red ball cannot come twice
        self.assertIsNone(out.prompt)


# ------------------------------------------------------------------ the fixtures

@unittest.skipUnless(PINNED, "Pinned middle skill unavailable")
class Fixtures(unittest.TestCase):
    def check_keys(self, questions):
        expected = load("expected.json")["questions"]
        for slot, ir in questions.items():
            row = expected[slot]
            with self.subTest(slot=slot):
                kind, story, counts = pk.question_counts(ir, overlay())
                self.assertEqual((kind, story, list(counts)), (row["kind"], row["story"], row["counts"]))
                self.assertEqual([i["answer"]["key"]["notation"] for i in ir["items"]], [r["key"] for r in row["items"]])
                self.assertEqual([i["answer"]["key"]["form"] for i in ir["items"]], [r["form"] for r in row["items"]])
                self.assertEqual([sm.key_island(i["answer"]["key"]) for i in ir["items"]],
                                 [r["printed"] for r in row["items"]])
                for entry in row["items"]:
                    self.assertEqual(printed_key(entry["key"]), independent(row["kind"], entry["ask"], row["counts"]))

    def test_good_reply_delivers_twenty_with_the_hand_keys(self):
        result = compile_good()
        selection = result.ir["selection"]
        self.assertEqual((selection["requested"], selection["floor"], selection["delivered"]), (20, 20, 20))
        self.assertEqual((selection["replaced"], selection["dropped"]), ([], []))
        self.assertEqual(result.diagnostics["trimmed"], [])
        self.assertEqual(result.diagnostics["warnings"], [])
        self.assertEqual([q["slot"] for q in selection["questions"]], ["Q%d" % n for n in range(1, 21)])
        self.assertEqual([q["slot"] for q in selection["questions"] if q["star"]], ["Q18", "Q19", "Q20"])
        printed = dict(zip(["Q%d" % n for n in range(1, 21)], result.ir["sections"][0]["questions"]))
        self.check_keys(printed)
        tables = [slot for slot, q in printed.items() if "table" in q]
        self.assertEqual(tables, ["Q6", "Q7", "Q8", "Q9"])
        for slot in tables:
            self.assertEqual(len(printed[slot]["table"]["rows"]), 1)       # a one-way table, never two-way
        forms = {i["answer"]["key"]["form"] for q in printed.values() for i in q["items"]}
        self.assertEqual(forms, {"fraction", "decimal", "percent"})

    def test_every_reserve_compiles_clean_with_its_hand_keys(self):
        plan, ctx = rows(), context()
        reserves = {}
        for question in load("reply_good.json")["questions"]:
            if question["slot"].startswith("R"):
                compiled = ss.compile_question(question, plan[question["slot"]], ctx)
                self.assertEqual((compiled.codes, compiled.trimmed), ((), ()), question["slot"])
                self.assertEqual(compiled.ir["star"], plan[question["slot"]].group == "challenges")
                reserves[question["slot"]] = compiled.ir
        self.assertEqual(sorted(reserves), ["R1", "R2", "R3", "R4", "R5", "R6"])
        self.check_keys(reserves)

    def test_adversarial_cases(self):
        ctx, plan = context(), rows()
        cases = load("adversarial.json")
        self.assertGreaterEqual(len(cases), 45)
        seen = set()
        for case in cases:
            with self.subTest(case=case["case"]):
                compiled = ss.compile_question(case["question"], plan[case["slot"]], ctx)
                self.assertIsNone(compiled.ir)
                self.assertEqual(list(compiled.codes), case["expect"])
                seen.update(case["expect"])
                for refusal in compiled.refusals:
                    self.assertTrue(sc.is_known_code(refusal.code))
        for code in ("Q_SHAPE", "Q_KIND_NOT_ALLOWED", "ITEM_COUNT", "FIELD_NOT_EMPTY", "TEXT_CHAR", "TEXT_NUMBER_WORD",
                     "GIVEN_SHAPE", "GIVEN_VALUE", "REF_UNUSED", "REF_UNDECLARED", "TEMPLATE_MISMATCH",
                     "TEMPLATE_UNKNOWN", "ASK_UNKNOWN", "FORM_UNKNOWN", "ITEM_SHAPE", "MATH_PARSE", "MATH_LENGTH",
                     "MATH_SYMBOL_UNDECLARED", "MATH_SCOPE_RANGE", "MATH_SCOPE_POWER", "TASK_LITERAL", "PROB_RANGE",
                     "ASK_MISMATCH", "KERNEL_UNDEFINED_TASK", "FORM_UNREPRESENTABLE", "DUPLICATE_ITEM", "KEY_REPEATED",
                     "LEAK_PINNED_VALUE", "CHALLENGE_PROFILE"):
            self.assertIn(code, seen)

    def built(self, kind, story, counts, entries):
        ov, ctx = overlay(), context()
        items = [pk.compile_item(kind, entry, n, ctx, givens=counts, template=story) for n, entry in enumerate(entries, 1)]
        for compiled in items:
            self.assertEqual(compiled.refusals, [])
        question = {"intro": pk.story_intro(story, counts, ov), "star": False,
                    "items": [{"prompt": c.prompt, "answer": c.answer} for c in items]}
        table = pk.story_table(story, counts, ov)
        if table is not None:
            question["table"] = table
        return question

    def test_the_d12_mirror_reads_each_printed_string_like_the_pinned_gate(self):
        for question in compile_good().ir["sections"][0]["questions"]:
            self.assertEqual(pk.d12_mirror(question, str(S.MIDDLE)), [])
        t3, t4 = "({n1}+{n2}+{n3})", "({n1}+{n2}+{n3}+{n4})"
        # 3/4 with 3 and 4 printed in the one intro string: the pinned D12 reads the value there.
        story = self.built("single_draw_probability", "D_BALLS", (3, 4, 5),
                           [item("{n1}/" + t3, "one_1", "D_BALLS"), item("({n2}+{n3})/" + t3, "either_23", "D_BALLS")])
        self.assertEqual([i["answer"]["key"]["notation"] for i in story["items"]], ["1/4", "3/4"])
        self.assertEqual(pk.d12_mirror(story, str(S.MIDDLE)), [2])
        # 35% with a table cell of 35: the cell prints the value.
        percent = self.built("relative_frequency", "F_SURVEY", (35, 25, 30, 10),
                             [item("{n1}/" + t4, "freq_1", "F_SURVEY", "percent"),
                              item("{n2}/" + t4, "prob_2", "F_SURVEY", "fraction")])
        self.assertEqual(pk.d12_mirror(percent, str(S.MIDDLE)), [1])
        self.assertIn("$35$", pk.printed_words(percent))
        # 2/5 with 2 and 5 in two different cells: no single string prints the value, as in the pinned file check.
        cells = self.built("relative_frequency", "F_SPINNER", (6, 2, 5, 2),
                           [item("{n1}/" + t4, "freq_1", "F_SPINNER", "fraction")])
        self.assertEqual(cells["items"][0]["answer"]["key"]["notation"], "2/5")
        self.assertEqual(pk.d12_mirror(cells, str(S.MIDDLE)), [])
        self.assertEqual(len(pk.printed_words(cells)), 1 + 5 + 5 + 1)        # intro, head, count row, one prompt

    def test_deterministic_and_private_diagnostics(self):
        first, second = compile_good(), compile_good()
        self.assertEqual(json.dumps(first.ir, ensure_ascii=False), json.dumps(second.ir, ensure_ascii=False))
        text = json.dumps(first.diagnostics, ensure_ascii=False)
        self.assertIsNone(re.search(r"[א-ת]", text))
        self.assertNotIn("{n1}", text)

    def test_the_ir_needs_the_trusted_flag(self):
        ir = compile_good().ir
        validate_source(lesson(), ir, scope(), contract=V5_CONTRACT)
        with self.assertRaises(GeneralSourceError) as caught:
            validate_source(lesson(), ir, scope())
        self.assertEqual((caught.exception.code, str(caught.exception)),
                         ("SOURCE_SHAPE", "Unexpected or missing source fields"))

    def test_tampering_is_refused(self):
        ir = compile_good().ir

        def refusal(mutate):
            tampered = copy.deepcopy(ir)
            mutate(tampered["sections"][0]["questions"])
            with self.assertRaises(GeneralSourceError) as caught:
                validate_source(lesson(), tampered, scope(), contract=V5_CONTRACT)
            return caught.exception.code, str(caught.exception).split(" at ")[0]

        table = lambda qs: qs[5]["table"]
        cases = {
            "a table count changed": (lambda qs: table(qs)["rows"][0][1][0].update(notation="13"),
                                      ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "the table removed": (lambda qs: qs[5].pop("table"), ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "a second table row": (lambda qs: table(qs)["rows"].append(copy.deepcopy(table(qs)["rows"][0])),
                                   ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "a table on a bag story": (lambda qs: qs[0].update(table=copy.deepcopy(table(qs))),
                                       ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "a figure": (lambda qs: qs[0].update(figure={"kind": "tree"}), ("SOURCE_SHAPE", "Unexpected or missing source fields")),
            "an intro count changed": (lambda qs: qs[0]["intro"][1].update(notation="4"),
                                       ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "a key changed": (lambda qs: qs[0]["items"][0]["answer"]["key"].update(notation="4/10"),
                              ("SOURCE_KEY", "KEY_ROUNDTRIP")),
            "a form changed": (lambda qs: qs[5]["items"][0]["answer"]["key"].update(form="percent"),
                               ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "a form note removed": (lambda qs: qs[5]["items"][0]["prompt"][0].update(
                text="מהי השכיחות היחסית של הצבע אדום?"), ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "an ask changed": (lambda qs: qs[0]["items"][0]["answer"]["key"]["binding"].update(ask="one_3"),
                               ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "a task built from other counts": (lambda qs: qs[0]["items"][0]["answer"].update(
                task=pk.task_of("single_draw_probability", "one_1", (3, 5, 3))), ("SOURCE_KEY", "KEY_ROUNDTRIP")),
            "a task and key from other counts": (lambda qs: (qs[0]["items"][0]["answer"].update(
                task=pk.task_of("single_draw_probability", "one_1", (3, 5, 3))),
                qs[0]["items"][0]["answer"]["key"].update(notation="3/11")), ("SOURCE_BINDING", "TEMPLATE_MISMATCH")),
            "a star on a practice question": (lambda qs: qs[0].update(star=True), ("SOURCE_SELECTION", "Selection record: star differs from the printed question")),
            "a repeated item": (lambda qs: qs[2]["items"].__setitem__(2, copy.deepcopy(qs[2]["items"][0])),
                                ("SOURCE_BINDING", "DUPLICATE_ITEM")),
        }
        for name, (mutate, expected) in cases.items():
            with self.subTest(name):
                self.assertEqual(refusal(mutate), expected)

    def test_the_question_checker_binds_the_star_and_the_challenge_asks(self):
        ov, ctx = overlay(), context()
        ir = compile_good().ir["sections"][0]["questions"]
        challenge = copy.deepcopy(ir[17])                                  # Q18, N_PENS (4, 6)
        verify_question(challenge, ov)
        single = pk.compile_item("two_stage_without_replacement",
                                 item("({n1}/({n1}+{n2}))*(({n1}-1)/({n1}+{n2}-1))", "both_1", "N_PENS"), 1, ctx,
                                 givens=(4, 6), template="N_PENS")
        self.assertEqual(single.refusals, [])
        challenge["items"][0] = {"prompt": single.prompt, "answer": single.answer}
        with self.assertRaises(BindingError) as caught:
            verify_question(challenge, ov)
        self.assertEqual(caught.exception.code, "CHALLENGE_PROFILE")
        challenge["star"] = False
        verify_question(challenge, ov)                                      # unstarred, it is a practice question
        practice = copy.deepcopy(ir[0])
        practice["star"] = True
        with self.assertRaises(BindingError) as caught:
            verify_question(practice, ov)
        self.assertEqual(caught.exception.code, "BINDING_INTERNAL")       # single_draw has no challenge group

    def test_verify_item_refuses_a_kernel_result_that_is_not_the_probability(self):
        ov = overlay()
        entry = compile_good().ir["sections"][0]["questions"][0]["items"][0]
        solved = validate_and_solve_task(entry["answer"]["task"])
        verify_item(entry["prompt"], entry["answer"], solved, ov)
        wrong = copy.deepcopy(solved)
        wrong["result"]["value"] = {"type": "number", "numerator": 1, "denominator": 3}
        with self.assertRaises(BindingError) as caught:
            verify_item(entry["prompt"], entry["answer"], wrong, ov)
        self.assertEqual(caught.exception.code, "BINDING_INTERNAL")


# ------------------------------------------------------------------ sheet level

@unittest.skipUnless(PINNED, "Pinned middle skill unavailable")
class SheetLevel(unittest.TestCase):
    def sheet(self, edit):
        reply = load("reply_good.json")
        edit({q["slot"]: q for q in reply["questions"]})
        return reply

    def test_refused_questions_take_their_reserves(self):
        def edit(by):
            by["Q3"]["items"][2]["expr"] = "7/({n1}+{n2}+{n3})"                       # TASK_LITERAL
            by["Q6"]["items"][0]["form"] = "percent"; by["Q6"]["givens"][0]["value"] = "13"   # 13/51: no whole percent
            by["Q12"]["items"][0]["expr"] = "{n1}/({n1}+{n2})"                         # ASK_MISMATCH
            by["Q15"]["givens"][1]["value"] = "25"                                     # MATH_SCOPE_RANGE
            by["Q19"]["items"][1].update(ask="both_1", expr="({n1}/({n1}+{n2}))*(({n1}-1)/({n1}+{n2}-1))")
        result = compile_good(self.sheet(edit))
        selection = result.ir["selection"]
        self.assertEqual(selection["delivered"], 20)
        self.assertEqual([(r["slot"], r["by"]) for r in selection["replaced"]],
                         [("Q3", "R1"), ("Q6", "R2"), ("Q12", "R3"), ("Q15", "R4"), ("Q19", "R5")])
        codes = {r["slot"]: r["codes"] for r in selection["replaced"]}
        self.assertEqual(codes["Q3"], ["ITEM_COUNT", "TASK_LITERAL"])
        self.assertEqual(codes["Q6"], ["FORM_UNREPRESENTABLE", "ITEM_COUNT"])
        self.assertEqual(codes["Q12"], ["ASK_MISMATCH", "ITEM_COUNT"])
        self.assertEqual(codes["Q15"], ["MATH_SCOPE_RANGE"])
        self.assertEqual(codes["Q19"], ["CHALLENGE_PROFILE", "ITEM_COUNT"])
        printed = [q["slot"] for q in selection["questions"]]
        self.assertEqual(printed[2], "R1")
        self.assertEqual(printed[18], "R5")
        self.assertTrue(selection["questions"][18]["star"])

    def test_a_repeated_story_takes_a_reserve(self):
        def edit(by):
            by["Q5"]["givens"] = copy.deepcopy(by["Q1"]["givens"])                    # D_BALLS (3, 5, 2) again
        result = compile_good(self.sheet(edit))
        replaced = result.ir["selection"]["replaced"]
        self.assertEqual([(r["slot"], r["by"], r["codes"]) for r in replaced], [("Q5", "R1", ["DUPLICATE_TASK"])])

    def test_the_same_counts_in_another_order_take_a_reserve(self):
        def edit(by):
            by["Q20"]["givens"] = [{"id": "n1", "type": "count", "value": "6", "unit": ""},
                                   {"id": "n2", "type": "count", "value": "4", "unit": ""}]   # Q18 has (4, 6)
        result = compile_good(self.sheet(edit))
        replaced = result.ir["selection"]["replaced"]
        self.assertEqual([(r["slot"], r["by"], r["codes"]) for r in replaced], [("Q20", "R5", ["DUPLICATE_REORDERED"])])

    def test_without_reserves_a_refusal_is_below_the_floor(self):
        def edit(by):
            by["Q2"]["kind"] = "relative_frequency"
        reply = self.sheet(edit)
        reply["questions"] = [q for q in reply["questions"] if q["slot"].startswith("Q")]
        with self.assertRaises(ss.V5Error) as caught:
            compile_good(reply)
        self.assertEqual(caught.exception.code, "SHEET_BELOW_MINIMUM")
        self.assertEqual(caught.exception.diagnostics["missing"][0]["slot"], "Q2")

    def test_sheet_leaks_are_monotone_and_the_final_validator_runs_them(self):
        ir = compile_good().ir
        questions = ir["sections"][0]["questions"]
        self.assertEqual(pk.sheet_leaks(questions, overlay()), {})
        doubled = questions + [copy.deepcopy(questions[3])]
        self.assertEqual(pk.sheet_leaks(doubled, overlay()), {20: ["DUPLICATE_TASK"]})
        for question in questions:
            self.assertEqual(pk.question_leaks(question, overlay()), [])
            for size in range(3, len(question["items"]) + 1):
                for chosen in itertools.combinations(question["items"], size):
                    self.assertEqual(pk.question_leaks(dict(question, items=list(chosen)), overlay()), [])


if __name__ == "__main__":
    unittest.main()
