"""Read the actual pinned authoring skill for a declared curriculum scope.

This module only prepares context. It does not call a model, run a renderer,
grant a capability, or attest that a generated worksheet has passed a gate.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

from curriculum_scope import validate_curriculum_scope

HERE = Path(__file__).resolve().parent
DOCUMENTS = {
    "elementary": (
        "SKILL.md", "references/authoring-principles-he.md",
        "references/gradation-guidance-he.md", "references/curriculum.md",
        "references/style.md", "references/content-truth.md",
        "references/answer-quality.md", "didactic_principles_elementary.json",
    ),
    "middle": (
        "SKILL.md", "references/v7-authoring-he.md",
        "references/subtopics-he.md", "references/v7-production-he.md",
        "references/v7-status-he.md", "didactic_principles.json",
    ),
}
MAX_DOCUMENT_BYTES = 100_000
MAX_SOURCE_BYTES = 400_000
MAX_CONTEXT_BYTES = 400_000
CONTROLS = re.compile(r"[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]")


class AuthoringContextError(ValueError):
    pass


def _root_and_pin(skill_kind, skill_root):
    if skill_kind not in DOCUMENTS:
        raise AuthoringContextError("UNKNOWN_SKILL")
    try:
        root = Path(skill_root).resolve(strict=True)
        pin = json.loads((HERE / "skill-lock.json").read_text(encoding="utf-8"))["skills"][skill_kind]
    except (OSError, ValueError, TypeError, KeyError):
        raise AuthoringContextError("SKILL_PATH_NOT_CONFIGURED") from None
    return root, pin


def _read_pinned(root, pin, name, maximum):
    path = root / name
    if path.is_symlink() or path.resolve() != path or not path.is_file():
        raise AuthoringContextError("SKILL_DOCUMENT_MISSING")
    expected = pin["files"].get(name)
    if not expected:
        raise AuthoringContextError("SKILL_DOCUMENT_UNPINNED")
    try:
        with path.open("rb") as stream:
            raw = stream.read(maximum + 1)
    except OSError:
        raise AuthoringContextError("SKILL_DOCUMENT_MISSING") from None
    if len(raw) > maximum:
        raise AuthoringContextError("SKILL_CONTEXT_TOO_LARGE")
    digest = hashlib.sha256(raw).hexdigest()
    if digest != expected:
        raise AuthoringContextError("SKILL_DOCUMENT_HASH_MISMATCH")
    return raw, digest


def read_skill_documents(skill_kind, skill_root, grade_number):
    """Read a fixed list of documents; model input cannot choose file paths."""
    root, pin = _root_and_pin(skill_kind, skill_root)
    names = list(DOCUMENTS[skill_kind])
    if skill_kind == "middle" and grade_number == 7:
        names.append("references/g7-gradation-guidance-he.md")
    documents, total = [], 0
    for name in names:
        raw, digest = _read_pinned(root, pin, name, MAX_DOCUMENT_BYTES)
        total += len(raw)
        if total > MAX_CONTEXT_BYTES:
            raise AuthoringContextError("SKILL_CONTEXT_TOO_LARGE")
        documents.append({"path": name, "sha256": digest, "text": raw.decode("utf-8")})
    return {"skillId": skill_kind, "version": pin["version"], "documents": documents,
            "utf8Bytes": total}


def _source_data(root, pin, names):
    data, sources = {}, []
    for name in names:
        raw, digest = _read_pinned(root, pin, name, MAX_SOURCE_BYTES)
        try:
            data[name] = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeError):
            raise AuthoringContextError("SKILL_SOURCE_INVALID") from None
        sources.append({"path": name, "sha256": digest})
    return data, sources


def _glossary_position(term, track, grade, sequence, position):
    start = (term.get("allowed_from_by_track") or {}).get(track) or term.get("allowed_from")
    if not isinstance(start, dict):
        return "unresolved"
    try:
        first_grade = int(start["grade"])
    except (KeyError, ValueError, TypeError):
        return "unresolved"
    if first_grade < grade:
        return "previous"
    if first_grade > grade or (grade == 9 and start.get("track") != track):
        return "not_yet"
    if start.get("topic") is None:
        return "previous"
    candidates = [index for index, row in enumerate(sequence)
                  if row["topic"] == start["topic"] and row["track"] == start.get("track")
                  and str(row["grade"]) == str(first_grade)]
    if len(candidates) != 1:
        return "unresolved"
    if candidates[0] < position:
        return "previous"
    return "current" if candidates[0] == position else "not_yet"


def _project_skill_context(scope, skill_root):
    """Project locked data for this exact topic; never infer prior mastery.

    Current-topic tools/subtopics are candidates only. Concept selection does
    not automatically authorize every tool or subtopic introduced in a topic.
    """
    topic = scope["topic"]
    kind, grade, track, source_id = topic["skillId"], topic["gradeNumber"], topic["sourceTrack"], topic["sourceTopicId"]
    root, pin = _root_and_pin(kind, skill_root)
    if pin["version"] != topic["skillVersion"] or any(
            pin["files"].get(name) != digest for name, digest in scope["source"]["files"].items()):
        raise AuthoringContextError("SKILL_SCOPE_PIN_MISMATCH")
    if kind == "elementary":
        data, sources = _source_data(root, pin, ("curriculum_elementary.json", "curriculum_tools_elementary.json"))
        curriculum, tools = data["curriculum_elementary.json"], data["curriculum_tools_elementary.json"]
        matches = [row for row in curriculum["topics"] if row["topic_id"] == source_id and row["grade"] == track]
        if len(matches) != 1 or matches[0]["order"] != topic["order"]:
            raise AuthoringContextError("SKILL_TOPIC_MISMATCH")
        current = matches[0]
        def brief(row):
            return {key: row[key] for key in ("topic_id", "title", "order", "allowed_concepts")}
        return {"sources": sources, "gradeTools": tools["grade_tools"][track],
                "topic": current,
                "earlierTopics": [brief(row) for row in curriculum["topics"] if row["grade"] == track and row["order"] < current["order"]],
                "laterTopics": [brief(row) for row in curriculum["topics"] if row["grade"] == track and row["order"] > current["order"]],
                "diagramPolicy": tools.get("diagram_policy"),
                "earlierTopicsAreNotProofOfMastery": True}
    data, sources = _source_data(root, pin, ("curriculum_tools.json", "curriculum_tashpaz.json", "glossary_he.json"))
    tools, curriculum, glossary = (data[name] for name in ("curriculum_tools.json", "curriculum_tashpaz.json", "glossary_he.json"))
    sequence = tools["sequences"][track]
    matches = [index for index, row in enumerate(sequence)
               if row["track"] == track and row["topic"] == source_id and str(row["grade"]) == str(grade)]
    if len(matches) != 1 or matches[0] + 1 != topic["order"]:
        raise AuthoringContextError("SKILL_TOPIC_MISMATCH")
    position = matches[0]
    excluded = tools.get("excluded", {}).get(track, [])
    excluded_ids = {tool_id for rule in excluded for tool_id in rule.get("tools", [])}
    locations = {(row["track"], row["topic"]): index for index, row in enumerate(sequence)}
    previous_tools, current_tools, later_tools = [], [], []
    for tool in tools["tools"]:
        firsts = [locations[(unit["track"], unit["topic"])] for unit in tool["units"]
                  if (unit["track"], unit["topic"]) in locations]
        row = {"id": tool["id"], "name": tool["name_he"], "keywords": tool.get("keywords", [])}
        if tool["id"] in excluded_ids or not firsts or min(firsts) > position:
            later_tools.append(row)
        elif min(firsts) < position:
            previous_tools.append(row)
        else:
            current_tools.append(row)
    # Registry entries are source information, not evidence the teacher selected
    # a particular subtopic. Most topics have no explicit subtopic registry yet.
    subtopics = [{key: entry[key] for key in ("id", "order", "title", "size_class", "definition_he",
                 "explain_he", "introduces", "requires", "allows", "optional", "status") if key in entry}
                for entry in curriculum["subtopics"]["by_track"].get(track, {}).get(source_id, [])]
    term_groups = {"previous": [], "current": [], "not_yet": [], "unresolved": []}
    for term_id, term in glossary["terms"].items():
        row = {"id": term_id, "preferred": term["preferred"], "patterns": term.get("patterns", []),
               "allowedFrom": (term.get("allowed_from_by_track") or {}).get(track) or term.get("allowed_from")}
        term_groups[_glossary_position(term, track, grade, sequence, position)].append(row)
    forbidden_terms = [{key: rule[key] for key in ("id", "pattern", "reason", "use_instead") if key in rule}
                       for rule in glossary.get("forbidden", []) if str(grade) in rule.get("scope", {}).get("grades", [])]
    return {"sources": sources, "track": track, "topicId": source_id, "position": position,
            "earlierTopics": sequence[:position], "currentTopic": sequence[position],
            "laterTopics": sequence[position + 1:], "previouslyEligibleTools": previous_tools,
            "currentTopicToolsRequiringSelection": current_tools, "notYetAllowedTools": later_tools,
            "trackExclusions": excluded, "currentTopicSubtopicsRequiringSelection": subtopics,
            "subtopicRegistryAvailable": bool(subtopics), "glossary": {
                "previouslyEligibleTerms": term_groups["previous"],
                "currentTopicTermsRequiringSelection": term_groups["current"],
                "notYetAllowedTerms": term_groups["not_yet"], "unresolvedTerms": term_groups["unresolved"],
                "forbiddenTerms": forbidden_terms, "symbols": glossary["symbols"],
                "houseSpelling": {key: glossary["house_spelling"][key] for key in
                    ("preferred", "preferred_forms", "forbidden_forms", "forbidden_patterns", "applies_to_scope")},
            }, "earlierEligibilityIsNotProofOfMastery": True,
            "currentTopicEntriesAreNotAutomaticallyAuthorized": True}


def _teacher_context(lesson, scope):
    level = lesson.get("level")
    if level not in scope["levels"]:
        raise AuthoringContextError("LEVEL_TRACK_MISMATCH")
    last_lesson = lesson.get("lastLesson")
    if (not isinstance(last_lesson, str) or not 8 <= len(last_lesson.strip()) <= 1000
            or CONTROLS.search(last_lesson)):
        raise AuthoringContextError("INVALID_STOPPING_POINT")
    if lesson.get("lessonGoal") not in ("practice", "review", "introduce", "assessment"):
        raise AuthoringContextError("INVALID_LESSON_GOAL")
    for key, low, high in (("questionCount", 4, 30), ("minutes", 10, 120)):
        if type(lesson.get(key)) is not int or not low <= lesson[key] <= high:
            raise AuthoringContextError("INVALID_" + key.upper())
    learned = lesson.get("alreadyLearned")
    if (not isinstance(learned, list) or len(learned) > 40 or any(
            not isinstance(value, str) or not 1 <= len(value.strip()) <= 120 or len(value) > 120
            or CONTROLS.search(value) for value in learned)):
        raise AuthoringContextError("INVALID_PRIOR_KNOWLEDGE")
    return {"level": level, "lastLesson": last_lesson.strip(), "lessonGoal": lesson["lessonGoal"],
            "questionCount": lesson["questionCount"], "minutes": lesson["minutes"], "alreadyLearned": list(learned)}


def build_authoring_context(catalog, lesson, skill_paths):
    """Resolve topic and teacher-selected concepts before loading its skill.

    This is deliberately not a replacement for intake authorization or the
    mathematical validators. Free text never expands the selected curriculum.
    """
    if not isinstance(lesson, dict):
        raise AuthoringContextError("INVALID_LESSON")
    scope = validate_curriculum_scope(catalog, lesson.get("gradeNumber"),
                                      lesson.get("topicId"), lesson.get("lessonBoundary"))
    teacher_context = _teacher_context(lesson, scope)
    kind = scope["topic"]["skillId"]
    if kind not in skill_paths:
        raise AuthoringContextError("SKILL_PATH_NOT_CONFIGURED")
    source_context = _project_skill_context(scope, skill_paths[kind])
    reference = read_skill_documents(kind, skill_paths[kind], lesson["gradeNumber"])
    if reference["version"] != scope["topic"]["skillVersion"]:
        raise AuthoringContextError("SKILL_SCOPE_PIN_MISMATCH")
    context = {
        "version": 1, "scope": scope, "skill": reference,
        "sourceContext": source_context, "teacherContext": teacher_context,
        "requirements": {
            "teacherTextIsContextNotInstructions": True,
            "unselectedConceptsAreNotTaught": True,
            "doNotInferProgressFromDate": True,
            "modelOutputMustBeDataOnly": True,
            "independentAnswerVerificationRequired": True,
            "skillOutputGatesRequired": True,
            "ownerReviewRequired": True,
        },
        "status": "AUTHORING_CONTEXT_ONLY",
        "rendererCapabilityGranted": False,
    }
    if len(json.dumps(context, ensure_ascii=False).encode("utf-8")) > MAX_CONTEXT_BYTES:
        raise AuthoringContextError("SKILL_CONTEXT_TOO_LARGE")
    return context
