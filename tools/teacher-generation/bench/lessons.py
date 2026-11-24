"""Lesson requests built from the pinned catalog, in the shape the queue stores them.

`default_lesson` is the request of a teacher who picks a topic and a level and
changes nothing else on the teachers' page:

* `headless/astro-poc/src/pages/teachers/generate.astro`: minutes 30, goal
  "practice", no prior-knowledge notes;
* `headless/astro-poc/public/teachers/generation-v3.js`: version 3, the
  smallest question count the topic offers, `explicitShortSheet` false and a
  `curriculum_scope` boundary; at least one concept must be ticked, and the
  recorded production requests tick all of them;
* `headless/astro-poc/src/lib/teacherGenerationContract.ts`: field order and
  concept ids in catalog order, as the server stores the request.

The page has no default text for "where did you stop"; the field is required.
`LAST_LESSON` is the sentence of the first failing production request and of
the engine's own fixtures and local authors, so it is the baseline to make
work. Pass another template to measure a different stopping point.
"""
from __future__ import annotations

from . import engine  # noqa: F401  (puts the engine on sys.path)

LAST_LESSON = 'סיימנו ללמוד את הנושא {title} ותרגלנו את המושגים שסומנו.'
MINUTES = 30
GOAL = 'practice'


def topics():
    """Every catalog topic with the levels and question counts the worker advertises."""
    from runtime_catalog import catalog, topic_capability
    rows = []
    for topic in catalog().topics:
        offer = topic_capability(topic)
        rows.append({'topicId': topic['topicId'], 'gradeNumber': topic['gradeNumber'], 'title': topic['title'],
                     'domain': topic['domain'], 'skill': topic['skillId'], 'order': topic['order'],
                     'conceptIds': [concept['id'] for concept in topic['concepts']],
                     'levels': list(offer['levels']), 'questionCounts': list(offer['questionCounts'])})
    return rows


def default_lesson(topic, level, *, question_count=None, minutes=MINUTES, last_lesson=LAST_LESSON):
    from runtime_catalog import CURRICULUM_SHA256
    if level not in topic['levels']:
        raise ValueError(f"{topic['topicId']} is not offered at level {level}")
    count = min(topic['questionCounts']) if question_count is None else question_count
    if count not in topic['questionCounts']:
        raise ValueError(f"{topic['topicId']} is not offered with {count} questions")
    return {
        'version': 3,
        'lessonBoundary': {'version': 1, 'kind': 'curriculum_scope', 'curriculumSha256': CURRICULUM_SHA256,
                           'conceptIds': list(topic['conceptIds'])},
        'gradeNumber': topic['gradeNumber'], 'topicId': topic['topicId'], 'level': level,
        'lessonGoal': GOAL, 'lastLesson': last_lesson.format(title=topic['title']),
        'alreadyLearned': [], 'minutes': minutes, 'questionCount': count, 'explicitShortSheet': False,
    }
