"""Pinned, data-only teaching scope; this does not grant a rendering capability.

The trusted caller supplies both the exact projection path and its reviewed hash.
Concept indexes are meaningful only together with that hash. Model/client text
cannot add concepts, change their meaning, or assert official calendar coverage.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
from types import MappingProxyType

MAX_CATALOG_BYTES = 100_000
TRACKS = {"g7": ("ז", 7), "g8": ("ח", 8),
          "g9r": ("ט_רגילה", 9), "g9m": ("ט_מצומצמת", 9)}
GRADES = "אבגדהו"
PIN = re.compile(r"[a-f0-9]{64}\Z")
TOPIC_ID = re.compile(r"(?:[א-ו][0-9]{2}|g(?:7|8|9r|9m):[a-z][a-z0-9_]{0,80})\Z")
CONTROLS = re.compile(r"[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]")


class CurriculumScopeError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _fail(code):
    raise CurriculumScopeError(code)


def _text(value, maximum):
    return (isinstance(value, str) and bool(value.strip()) and len(value) <= maximum
            and not CONTROLS.search(value))


def _strings(value):
    return isinstance(value, list) and len(value) <= 100 and all(_text(x, 1000) for x in value)


def _integer(value):
    # JSON 8 and 8.0 are the same Number in JavaScript. Preserve that parity,
    # while excluding bool (a subclass of int in Python), NaN, and infinity.
    return type(value) is int or (type(value) is float and value.is_integer())


def _freeze(value):
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


def _copy(value):
    if isinstance(value, (dict, MappingProxyType)):
        return {key: _copy(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_copy(item) for item in value]
    return value


@dataclass(frozen=True)
class CurriculumScopeCatalog:
    sha256: str
    topics: tuple
    sources: MappingProxyType
    provenance_note: str


def load_curriculum_scope(projection_path: str | Path, expected_sha256: str) -> CurriculumScopeCatalog:
    """Read one explicit local asset, verify its bytes, then decode its data.

    ``expected_sha256`` must come from reviewed code/operator configuration,
    never from the lesson, model output, or a hash beside an untrusted upload.
    """
    if not isinstance(expected_sha256, str) or not PIN.fullmatch(expected_sha256):
        _fail("INVALID_CURRICULUM_PIN")
    if not isinstance(projection_path, (str, Path)):
        _fail("CURRICULUM_READ_FAILED")
    try:
        with Path(projection_path).open("rb") as source:
            raw = source.read(MAX_CATALOG_BYTES + 1)
    except (OSError, ValueError, TypeError):
        _fail("CURRICULUM_READ_FAILED")
    if len(raw) > MAX_CATALOG_BYTES:
        _fail("CURRICULUM_SIZE")
    if hashlib.sha256(raw).hexdigest() != expected_sha256:
        _fail("CURRICULUM_HASH_MISMATCH")
    try:
        data = json.loads(raw.decode("utf-8"))
        return _decode(data, expected_sha256)
    except CurriculumScopeError:
        raise
    except (ValueError, KeyError, TypeError, AttributeError, UnicodeError):
        _fail("INVALID_CURRICULUM")


def _decode(data, sha256):
    if (not isinstance(data, dict) or not _integer(data.get("version")) or data["version"] != 1
            or data.get("officialCalendarVerified") is not False
            or not _text(data.get("provenanceNote"), 1000)
            or not isinstance(data.get("sources"), dict) or not isinstance(data.get("tracks"), dict)
            or not isinstance(data.get("topics"), list) or len(data["topics"]) != 232
            or not _strings(data.get("elementaryForbiddenAll"))
            or not isinstance(data.get("elementaryForbiddenByGrade"), dict)
            or not isinstance(data.get("middleExcludedByTrack"), dict)):
        _fail("INVALID_CURRICULUM")
    for kind, version in (("elementary", "1.0.5-noam"), ("middle", "7.2.0-noam")):
        source = data["sources"].get(kind)
        if (not isinstance(source, dict) or source.get("skillVersion") != version
                or not _text(source.get("basis"), 2000) or not _text(source.get("curriculumVersion"), 500)
                or not isinstance(source.get("files"), dict)
                or not all(isinstance(h, str) and PIN.fullmatch(h) for h in source["files"].values())):
            _fail("INVALID_CURRICULUM")
    for prefix, (source_track, grade) in TRACKS.items():
        track = data["tracks"].get(prefix)
        if (not isinstance(track, dict) or track.get("sourceTrack") != source_track
                or not _integer(track.get("gradeNumber")) or track["gradeNumber"] != grade
                or not _text(track.get("label"), 200)
                or not _strings(data["middleExcludedByTrack"].get(prefix))):
            _fail("INVALID_CURRICULUM")
    if not all(_strings(data["elementaryForbiddenByGrade"].get(grade)) for grade in GRADES):
        _fail("INVALID_CURRICULUM")
    topics, seen = [], set()
    for row in data["topics"]:
        if not isinstance(row, list) or len(row) != 6:
            _fail("INVALID_CURRICULUM")
        topic_id, order, title, domain, allowed, not_yet = row
        if (not isinstance(topic_id, str) or not TOPIC_ID.fullmatch(topic_id) or topic_id in seen
                or not _integer(order) or not 1 <= order <= 200
                or not _text(title, 500) or not _text(domain, 100)
                or not _strings(allowed) or not allowed or not _strings(not_yet)):
            _fail("INVALID_CURRICULUM")
        seen.add(topic_id)
        elementary = topic_id[0] in GRADES
        prefix = topic_id.split(":")[0]
        skill_id = "elementary" if elementary else "middle"
        source_track, grade = (topic_id[0], GRADES.index(topic_id[0]) + 1) if elementary else TRACKS[prefix]
        forbidden = ([*data["elementaryForbiddenAll"], *data["elementaryForbiddenByGrade"][source_track], *not_yet]
                     if elementary else [*data["middleExcludedByTrack"][prefix], *not_yet])
        topics.append(_freeze({
            "topicId": topic_id, "sourceTopicId": topic_id if elementary else topic_id.split(":", 1)[1],
            "sourceTrack": source_track, "gradeNumber": grade, "order": order, "title": title, "domain": domain,
            "skillId": skill_id, "skillVersion": data["sources"][skill_id]["skillVersion"],
            "concepts": [{"id": f"{topic_id}#{index}", "text": text} for index, text in enumerate(allowed)],
            "forbiddenConcepts": list(dict.fromkeys(forbidden)),
            "levels": ["b"] if prefix == "g9m" else ["a", "e"] if prefix == "g9r" else ["b", "a", "e"],
        }))
    return CurriculumScopeCatalog(sha256, tuple(topics), _freeze(data["sources"]), data["provenanceNote"])


def validate_curriculum_scope(catalog: CurriculumScopeCatalog, grade_number: int, topic_id: str, boundary):
    """Resolve selected/excluded text from the pinned source, without rendering.

    This validates the teacher's declared concept selection. It does not prove
    that authored questions respect it, or that an arbitrary topic can render.
    """
    if not _integer(grade_number) or not 1 <= grade_number <= 9:
        _fail("INVALID_GRADE")
    topic = next((row for row in catalog.topics if row["topicId"] == topic_id), None)
    if topic is None:
        _fail("UNKNOWN_TOPIC")
    if topic["gradeNumber"] != grade_number:
        _fail("GRADE_TOPIC_MISMATCH")
    if (not isinstance(boundary, dict)
            or set(boundary) != {"version", "kind", "curriculumSha256", "conceptIds"}
            or not _integer(boundary.get("version")) or boundary["version"] != 1
            or boundary.get("kind") != "curriculum_scope"):
        _fail("INVALID_CURRICULUM_SCOPE")
    if boundary["curriculumSha256"] != catalog.sha256:
        _fail("CURRICULUM_SCOPE_HASH_MISMATCH")
    ids = boundary["conceptIds"]
    if (not isinstance(ids, list) or not 1 <= len(ids) <= len(topic["concepts"])
            or not all(isinstance(value, str) for value in ids) or len(set(ids)) != len(ids)):
        _fail("INVALID_CONCEPT_SELECTION")
    known = {row["id"] for row in topic["concepts"]}
    if any(value not in known for value in ids):
        _fail("UNKNOWN_CONCEPT")
    selected = set(ids)
    selected_rows = [_copy(row) for row in topic["concepts"] if row["id"] in selected]
    return {
        "boundary": {"version": 1, "kind": "curriculum_scope", "curriculumSha256": catalog.sha256,
                     "conceptIds": [row["id"] for row in selected_rows]},
        "topic": {key: topic[key] for key in ("topicId", "sourceTopicId", "sourceTrack", "gradeNumber",
                  "order", "title", "domain", "skillId", "skillVersion")},
        "selectedConcepts": selected_rows,
        "excludedConcepts": [_copy(row) for row in topic["concepts"] if row["id"] not in selected],
        "forbiddenConcepts": _copy(topic["forbiddenConcepts"]), "levels": _copy(topic["levels"]),
        "source": _copy(catalog.sources[topic["skillId"]]),
        "curriculum": {"sha256": catalog.sha256, "officialCalendarVerified": False,
                       "provenanceNote": catalog.provenance_note},
    }
