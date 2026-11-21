"""Offline context checks against the pinned skill documents, never a model."""
import copy
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from authoring_context import AuthoringContextError, build_authoring_context, read_skill_documents
from curriculum_scope import load_curriculum_scope

PROJECTION = Path(__file__).resolve().parents[1] / "generation-curriculum.json"
PIN = "57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b"
ROOTS = {
    "elementary": Path(os.environ.get("ELEMENTARY_SKILL_PATH", str(Path.home() / ".codex/skills/hebrew-math-worksheet-elementary"))),
    "middle": Path(os.environ.get("MIDDLE_SKILL_PATH", str(Path.home() / ".codex/skills/hebrew-math-worksheet"))),
}


class ContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_curriculum_scope(PROJECTION, PIN)

    def lesson(self, topic):
        return {"gradeNumber": topic["gradeNumber"], "topicId": topic["topicId"],
                "level": topic["levels"][0], "lastLesson": "למדנו את המושג הראשון בנושא בלבד",
                "lessonGoal": "review", "questionCount": 12, "minutes": 35,
                "alreadyLearned": ["הגדרת המושג הראשון", "תרגול קודם שנלמד"],
                "lessonBoundary": {"version": 1, "kind": "curriculum_scope",
                    "curriculumSha256": PIN, "conceptIds": [topic["concepts"][0]["id"]]}}

    def test_all_topics_get_their_own_scope_not_a_renamed_pilot(self):
        def reference(kind, root, grade):
            return {"version": self.catalog.sources[kind]["skillVersion"], "documents": []}
        with patch("authoring_context.read_skill_documents", side_effect=reference) as reader, \
                patch("authoring_context._project_skill_context", return_value={"sources": []}):
            for topic in self.catalog.topics:
                context = build_authoring_context(self.catalog, self.lesson(topic), ROOTS)
                self.assertEqual(context["scope"]["topic"]["topicId"], topic["topicId"])
                self.assertEqual(context["scope"]["selectedConcepts"][0]["id"], topic["concepts"][0]["id"])
                self.assertFalse(context["rendererCapabilityGranted"])
                self.assertEqual(context["status"], "AUTHORING_CONTEXT_ONLY")
                reader.assert_called_with(topic["skillId"], ROOTS[topic["skillId"]], topic["gradeNumber"])
                self.assertEqual(context["teacherContext"], {key: self.lesson(topic)[key] for key in
                                 ("level", "lastLesson", "lessonGoal", "questionCount", "minutes", "alreadyLearned")})

    def test_empty_stop_point_and_wrong_track_are_rejected_before_reading(self):
        topic = next(t for t in self.catalog.topics if t["topicId"] == "g9m:equations")
        for change in [{"lastLesson": " "}, {"level": "e"}]:
            lesson = {**self.lesson(topic), **change}
            with patch("authoring_context.read_skill_documents") as reader:
                with self.assertRaises(AuthoringContextError):
                    build_authoring_context(self.catalog, lesson, ROOTS)
                reader.assert_not_called()

    def test_requested_goal_volume_time_and_prior_knowledge_require_valid_explicit_values(self):
        topic = self.catalog.topics[0]
        changes = [{"lessonGoal": None}, {"lessonGoal": "unknown"}, {"questionCount": True},
                   {"questionCount": 3}, {"questionCount": 31}, {"minutes": 9}, {"minutes": 121},
                   {"alreadyLearned": "not a list"}, {"alreadyLearned": ["x" * 121]},
                   {"alreadyLearned": [""]}, {"alreadyLearned": ["x"] * 41},
                   {"lastLesson": "טקסט עם בקרה\u202e"}]
        for change in changes:
            with self.subTest(change=change), patch("authoring_context._project_skill_context") as reader:
                with self.assertRaises(AuthoringContextError):
                    build_authoring_context(self.catalog, {**self.lesson(topic), **change}, ROOTS)
                reader.assert_not_called()
        for key in ("lessonGoal", "questionCount", "minutes", "alreadyLearned"):
            lesson = self.lesson(topic)
            del lesson[key]
            with self.assertRaises(AuthoringContextError):
                build_authoring_context(self.catalog, lesson, ROOTS)

    @unittest.skipUnless(all((p / "SKILL.md").is_file() for p in ROOTS.values()), "Pinned skills not installed in this test environment")
    def test_actual_skill_text_and_required_references_are_hash_verified(self):
        for kind, grade in [("elementary", 1), ("elementary", 6), ("middle", 7), ("middle", 8), ("middle", 9)]:
            reference = read_skill_documents(kind, ROOTS[kind], grade)
            docs = {d["path"]: d for d in reference["documents"]}
            self.assertIn("SKILL.md", docs)
            self.assertGreater(reference["utf8Bytes"], 30_000)
            self.assertTrue(all(len(d["sha256"]) == 64 and d["text"] for d in docs.values()))
            if kind == "middle":
                self.assertEqual("references/g7-gradation-guidance-he.md" in docs, grade == 7)
            else:
                self.assertIn("references/answer-quality.md", docs)

    @unittest.skipUnless(all((p / "SKILL.md").is_file() for p in ROOTS.values()), "Pinned skills not installed")
    def test_targeted_sources_preserve_exact_track_and_exclude_future_tools(self):
        def context(topic_id):
            topic = next(t for t in self.catalog.topics if t["topicId"] == topic_id)
            return build_authoring_context(self.catalog, self.lesson(topic), ROOTS)
        elementary = context("א01")["sourceContext"]
        self.assertEqual(elementary["gradeTools"]["calculation_ceiling"], 20)
        self.assertEqual(elementary["gradeTools"]["niqqud"], "mandatory_full")
        self.assertEqual(elementary["topic"]["topic_id"], "א01")
        self.assertEqual(elementary["earlierTopics"], [])
        self.assertEqual(len(elementary["laterTopics"]), 20)
        early = context("g7:coordinate_system")["sourceContext"]
        self.assertEqual(early["track"], "ז")
        self.assertEqual(early["position"], 0)
        self.assertTrue(any("פיתגורס" in t["name"] for t in early["notYetAllowedTools"]))
        self.assertFalse(any("פיתגורס" in t["name"] for t in early["previouslyEligibleTools"] + early["currentTopicToolsRequiringSelection"]))
        angles = context("g7:angles")["sourceContext"]
        self.assertEqual(len(angles["currentTopicSubtopicsRequiringSelection"]), 12)
        self.assertTrue(all(s["id"].startswith("st.g7.angles.") for s in angles["currentTopicSubtopicsRequiringSelection"]))
        grade8 = context("g8:congruence")["sourceContext"]
        self.assertEqual(grade8["track"], "ח")
        self.assertEqual(grade8["topicId"], "congruence")
        self.assertFalse(grade8["subtopicRegistryAvailable"])
        self.assertTrue(any("חפיפ" in t["name"] for t in grade8["currentTopicToolsRequiringSelection"]))
        grade9 = context("g9m:equations")["sourceContext"]
        self.assertEqual(grade9["track"], "ט_מצומצמת")
        self.assertTrue(any(t["id"] == "mth.factoring" for t in grade9["notYetAllowedTools"]))
        self.assertFalse(any(t["id"] == "mth.factoring" for t in grade9["previouslyEligibleTools"] + grade9["currentTopicToolsRequiringSelection"]))
        self.assertTrue(grade9["currentTopicEntriesAreNotAutomaticallyAuthorized"])
        self.assertFalse(any(t["id"] == "parabola" for t in grade9["glossary"]["previouslyEligibleTerms"]))
        self.assertTrue(any(t["id"] == "parabola" for t in grade9["glossary"]["notYetAllowedTerms"]))

    @unittest.skipUnless((ROOTS["middle"] / "SKILL.md").is_file(), "Pinned middle skill not installed")
    def test_catalog_scope_and_skill_lock_must_describe_the_same_skill_version(self):
        topic = next(t for t in self.catalog.topics if t["topicId"] == "g8:congruence")
        with patch("authoring_context.read_skill_documents", return_value={"version": "new-unreviewed", "documents": []}):
            with self.assertRaisesRegex(AuthoringContextError, "SKILL_SCOPE_PIN_MISMATCH"):
                build_authoring_context(self.catalog, self.lesson(topic), ROOTS)

    @unittest.skipUnless((ROOTS["middle"] / "SKILL.md").is_file(), "Pinned middle skill not installed")
    def test_tampered_document_is_not_loaded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copyfile(ROOTS["middle"] / "SKILL.md", root / "SKILL.md")
            with (root / "SKILL.md").open("a") as stream:
                stream.write("\nchanged")
            with self.assertRaisesRegex(AuthoringContextError, "SKILL_DOCUMENT_HASH_MISMATCH"):
                read_skill_documents("middle", root, 8)


if __name__ == "__main__":
    unittest.main()
