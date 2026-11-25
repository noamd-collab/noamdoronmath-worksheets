"""Read the questions of a finished model reply whose text as a whole is not JSON.

Seen live from gemini-3.8-flash in json_object mode: a reply that finished
normally but whose brackets do not balance, because one answer object closed
too early (a decide answer written without its "task" wrapper) or because the
top-level object was never closed. One such fault used to discard the whole
reply. Here each question is decoded on its own, strictly, from where its
first key opens; a question that cannot be decoded is lost (None) and counts
as refused, exactly like a question that fails a check.

Nothing is repaired here. A decoded question is examined afterwards like any
other, so a salvaged reply can never print what a whole reply could not.
Two shapes only are read:

* an author reply: {"title", "rule", "practice", "challenges"[, "reserves"]};
* a correction reply: {"q1": question, "q7": question, ...}.

Anything else returns None and the caller rejects the reply as before.
"""
from __future__ import annotations

import json
import re

_GROUP = re.compile(r'"(practice|challenges|reserves)"\s*:\s*\[')
# A planned question opens with one of its own keys; a reserve with its group or concept.
_QUESTION = re.compile(r'\{\s*"(?:intro|figure|table|items|drawingFromWords)"\s*:')
_RESERVE = re.compile(r'\{\s*"(?:group|conceptId|question)"\s*:')
_KEY = re.compile(r'"(q[1-9][0-9]?)"\s*:\s*(?=\{)')
MAX_QUESTIONS = 60


class _Duplicate(ValueError):
    pass


def _pairs(values):
    result = {}
    for key, value in values:
        if key in result:
            raise _Duplicate("Duplicate key")
        result[key] = value
    return result


def _nonfinite(_):
    raise ValueError("Nonfinite number")


_DECODER = json.JSONDecoder(object_pairs_hook=_pairs, parse_constant=_nonfinite)


def _decode(text, start):
    """(value, end) of the JSON value that opens at ``start``, or (None, None)."""
    try:
        return _DECODER.raw_decode(text, start)
    except (ValueError, RecursionError):
        return None, None


def _author(text):
    head = {}
    marks = [(match[1], match.start(), match.end()) for match in _GROUP.finditer(text)]
    if [name for name, _, _ in marks] not in (["practice", "challenges"], ["practice", "challenges", "reserves"]):
        return None
    for key in ("title", "rule"):
        found = re.search(r'"%s"\s*:\s*' % key, text[:marks[0][1]])
        if not found:
            return None
        value, _ = _decode(text, found.end())
        if not isinstance(value, str):
            return None
        head[key] = value
    reply, lost = dict(head), 0
    for i, (name, _, start) in enumerate(marks):
        stop = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        opening = _RESERVE if name == "reserves" else _QUESTION
        rows, position = [], start
        for match in opening.finditer(text, start, stop):
            if match.start() < position:
                continue  # inside a question already decoded
            value, end = _decode(text, match.start())
            if isinstance(value, dict):
                rows.append(value)
                position = end
            else:
                rows.append(None)
                lost += 1
                position = match.end()
            if len(rows) > MAX_QUESTIONS:
                return None
        reply[name] = rows
    return reply, lost


def _corrections(text):
    reply, lost = {}, 0
    for match in _KEY.finditer(text):
        if match[1] in reply:
            return None
        value, _ = _decode(text, match.end())
        if not isinstance(value, dict):
            lost += 1
        reply[match[1]] = value if isinstance(value, dict) else None
        if len(reply) > MAX_QUESTIONS:
            return None
    return (reply, lost) if reply else None


def salvage(text):
    """The questions of a reply that is not JSON as a whole: (reply, questions lost) or None.

    A lost question is None in its place, so every other question keeps its
    planned position.
    """
    if not isinstance(text, str) or not text.lstrip().startswith("{"):
        return None
    if _GROUP.search(text):
        return _author(text)
    if re.match(r'\s*\{\s*"q[1-9][0-9]?"\s*:', text):
        return _corrections(text)
    return None
