"""Reviewed curriculum projection for the general private authoring profile.

Capabilities describe accepted authoring requests, not a claim that every
generated worksheet has already passed output gates. Each output is gated.
"""
from __future__ import annotations

from functools import cache
from pathlib import Path
from curriculum_scope import load_curriculum_scope, validate_curriculum_scope

PROFILE = 'general-skill-source/v1'
CURRICULUM_SHA256 = '57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b'
HERE = Path(__file__).resolve().parent


@cache
def catalog():
    """Reuse the immutable, hash-verified projection for this worker process."""
    return load_curriculum_scope(HERE / 'generation-curriculum.json', CURRICULUM_SHA256)


def scope_for_lesson(lesson):
    return validate_curriculum_scope(catalog(), lesson.get('gradeNumber'),
                                     lesson.get('topicId'), lesson.get('lessonBoundary'))


def question_floor(grade):
    return 8 if grade <= 2 else 12 if grade <= 4 else 14 if grade <= 6 else 20


def topic_capability(topic):
    return {'topicId': topic['topicId'], 'gradeNumber': topic['gradeNumber'],
            'title': topic['title'], 'skill': topic['skillId'], 'family': 'general',
            'enabled': True, 'readiness': 'private_draft',
            'levels': list(topic['levels']),
            'questionCounts': list(range(question_floor(topic['gradeNumber']), 31))}


def general_capabilities(legacy):
    """Keep exact two legacy v2 adapters, while advertising scoped v3 authoring."""
    existing = {t['topicId']: t for t in legacy['topics'] if t.get('enabled') is True}
    topics = []
    for topic in catalog().topics:
        entry = topic_capability(topic)
        # Titles/skill/family already live in the hash-pinned catalog. Omitting
        # duplicates keeps PostgreSQL jsonb::text under the 64 KB heartbeat cap.
        for key in ('title','skill','family'):
            del entry[key]
        # Existing fields continue to serve old v2 intake. V3 validation resolves
        # level/count against the pinned topic instead of trusting these extras.
        if topic['topicId'] in existing:
            old = existing[topic['topicId']]
            entry['legacy'] = {'intakeVersion':2,'e2eVerified':old.get('e2eVerified') is True,
                               'levels':old['levels'],'questionCounts':old['questionCounts']}
        topics.append(entry)
    return {'version':1,'scope':'Owner-only skill-authored drafts; every output runs its applicable gates and requires human review.',
            'unsupported':['assessment','introduce'],
            'profile': PROFILE, 'curriculumSha256': CURRICULUM_SHA256,
            'acceptedIntakeVersions': [2, 3], 'topics': topics}
