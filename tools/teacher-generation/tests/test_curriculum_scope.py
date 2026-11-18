"""Data-only scope tests. No model, network, installation, or generation calls."""
from pathlib import Path
import copy
import hashlib
import json
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_scope import CurriculumScopeError, load_curriculum_scope, validate_curriculum_scope

PROJECTION = Path(__file__).resolve().parents[1] / "generation-curriculum.json"
PIN = "57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b"


class CurriculumScopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_curriculum_scope(PROJECTION, PIN)

    def boundary(self, topic_id="g8:congruence", ids=None):
        return {"version": 1, "kind": "curriculum_scope", "curriculumSha256": PIN,
                "conceptIds": ids if ids is not None else [topic_id + "#0"]}

    def rejects(self, code, callback):
        with self.assertRaises(CurriculumScopeError) as caught:
            callback()
        self.assertEqual(caught.exception.code, code)

    def test_every_pinned_topic_resolves_with_source_track_and_all_concepts(self):
        counts = [0] * 9
        concept_count = 0
        for topic in self.catalog.topics:
            counts[topic["gradeNumber"] - 1] += 1
            ids = [row["id"] for row in reversed(topic["concepts"])]
            scope = validate_curriculum_scope(self.catalog, topic["gradeNumber"], topic["topicId"], self.boundary(topic["topicId"], ids))
            expected = [row["id"] for row in topic["concepts"]]
            self.assertEqual(scope["boundary"]["conceptIds"], expected)
            self.assertEqual([row["id"] for row in scope["selectedConcepts"]], expected)
            self.assertEqual(scope["excludedConcepts"], [])
            self.assertEqual(scope["topic"]["sourceTrack"], topic["sourceTrack"])
            self.assertEqual(scope["source"]["skillVersion"], topic["skillVersion"])
            self.assertFalse(scope["curriculum"]["officialCalendarVerified"])
            self.assertNotIn("e2eVerified", scope)
            self.assertNotIn("enabled", scope)
            concept_count += len(topic["concepts"])
        self.assertEqual(counts, [21, 26, 25, 30, 31, 27, 13, 17, 42])
        self.assertEqual(concept_count, 879)

    def test_selected_and_excluded_text_is_derived_from_source(self):
        scope = validate_curriculum_scope(self.catalog, 8, "g8:congruence", self.boundary())
        self.assertEqual(scope["selectedConcepts"], [{"id": "g8:congruence#0", "text": "חפיפה"}])
        self.assertEqual(len(scope["excludedConcepts"]), 19)
        self.assertEqual(scope["levels"], ["b", "a", "e"])
        scope["selectedConcepts"][0]["text"] = "cannot rewrite source"
        scope["source"]["files"]["SKILL.md"] = "cannot rewrite pin"
        again = validate_curriculum_scope(self.catalog, 8, "g8:congruence", self.boundary())
        self.assertEqual(again["selectedConcepts"][0]["text"], "חפיפה")
        self.assertEqual(len(again["source"]["files"]["SKILL.md"]), 64)
        with self.assertRaises(TypeError):
            self.catalog.topics[0]["concepts"][0]["text"] = "immutable"

    def test_grade_nine_tracks_cannot_be_combined(self):
        for topic in self.catalog.topics:
            if topic["gradeNumber"] == 9:
                scope = validate_curriculum_scope(self.catalog, 9, topic["topicId"], self.boundary(topic["topicId"]))
                self.assertEqual(scope["levels"], ["b"] if topic["topicId"].startswith("g9m:") else ["a", "e"])
        self.rejects("UNKNOWN_CONCEPT", lambda: validate_curriculum_scope(self.catalog, 9, "g9m:equations",
                     self.boundary("g9m:equations", ["g9r:alg_technique#0"])))

    def test_invalid_boundary_and_cross_topic_or_grade_selections(self):
        decimal_json = json.loads('{"version":1.0,"kind":"curriculum_scope","curriculumSha256":"' + PIN
                                  + '","conceptIds":["g8:congruence#0"]}')
        self.assertEqual(validate_curriculum_scope(self.catalog, 8.0, "g8:congruence", decimal_json)["topic"]["gradeNumber"], 8)
        fixtures = [
            ("INVALID_CURRICULUM_SCOPE", None),
            ("INVALID_CURRICULUM_SCOPE", {**self.boundary(), "version": True}),
            ("INVALID_CURRICULUM_SCOPE", {**self.boundary(), "conceptText": "client assertion"}),
            ("INVALID_CURRICULUM_SCOPE", {**self.boundary(), "kind": "linear_equations"}),
            ("CURRICULUM_SCOPE_HASH_MISMATCH", {**self.boundary(), "curriculumSha256": "0" * 64}),
            ("INVALID_CONCEPT_SELECTION", self.boundary(ids=[])),
            ("INVALID_CONCEPT_SELECTION", self.boundary(ids=["g8:congruence#0"] * 2)),
            ("INVALID_CONCEPT_SELECTION", self.boundary(ids=[0])),
            ("UNKNOWN_CONCEPT", self.boundary(ids=["g8:congruence#01"])),
            ("UNKNOWN_CONCEPT", self.boundary(ids=["g8:congruence#999"])),
            ("UNKNOWN_CONCEPT", self.boundary(ids=["g7:equations#0"])),
        ]
        for code, boundary in fixtures:
            with self.subTest(code=code, boundary=boundary):
                self.rejects(code, lambda: validate_curriculum_scope(self.catalog, 8, "g8:congruence", boundary))
        for grade in [True, "8", 0, 10, 8.5]:
            self.rejects("INVALID_GRADE", lambda: validate_curriculum_scope(self.catalog, grade, "g8:congruence", self.boundary()))
        self.rejects("GRADE_TOPIC_MISMATCH", lambda: validate_curriculum_scope(self.catalog, 7, "g8:congruence", self.boundary()))
        self.rejects("UNKNOWN_TOPIC", lambda: validate_curriculum_scope(self.catalog, 8, "congruence", self.boundary()))

    def test_exact_pin_read_failure_and_bounded_file(self):
        self.rejects("INVALID_CURRICULUM_PIN", lambda: load_curriculum_scope(PROJECTION, "not-a-pin"))
        self.rejects("INVALID_CURRICULUM_PIN", lambda: load_curriculum_scope(PROJECTION, PIN + "\n"))
        self.rejects("CURRICULUM_HASH_MISMATCH", lambda: load_curriculum_scope(PROJECTION, "0" * 64))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "projection.json"
            self.rejects("CURRICULUM_READ_FAILED", lambda: load_curriculum_scope(path, PIN))
            path.write_bytes(b" " * 100_001)
            self.rejects("CURRICULUM_SIZE", lambda: load_curriculum_scope(path, PIN))
            path.write_bytes(PROJECTION.read_bytes() + b" ")
            self.rejects("CURRICULUM_HASH_MISMATCH", lambda: load_curriculum_scope(path, PIN))

    def test_even_a_trusted_new_pin_cannot_change_contract_or_track_structure(self):
        source = json.loads(PROJECTION.read_text())
        mutations = [
            lambda x: x.update(officialCalendarVerified=True),
            lambda x: x.update(version=True),
            lambda x: x["topics"].pop(),
            lambda x: x["topics"][0].__setitem__(4, []),
            lambda x: x["topics"][0].__setitem__(0, "g8:missing#0"),
            lambda x: x["topics"][0].__setitem__(0, "א01\n"),
            lambda x: x["topics"][1].__setitem__(0, x["topics"][0][0]),
            lambda x: x["tracks"]["g9m"].update(gradeNumber=8),
            lambda x: x["sources"]["elementary"].update(skillVersion="unreviewed"),
        ]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "projection.json"
            for mutate in mutations:
                data = copy.deepcopy(source)
                mutate(data)
                raw = json.dumps(data, ensure_ascii=False).encode()
                path.write_bytes(raw)
                self.rejects("INVALID_CURRICULUM", lambda: load_curriculum_scope(path, hashlib.sha256(raw).hexdigest()))


if __name__ == "__main__":
    unittest.main()
