"""Choose the questions of one v5 sheet from planned questions and reserve questions.

Port of the selection core of #642 (B:tools/teacher-generation/lesson_select.py at
a95959bb) without its relaxations, as V5-DESIGN.md section 3 specifies:

- no ``soft`` codes and no ``restore()``: a question refused for any code is never
  printed again, and a reserve refused for any code is never placed;
- the shortest deliverable sheet is the caller's ``minimum``, the grade floor
  (runtime_catalog.question_floor: 8 / 12 / 14 / 20), not max(6, ceil(3N/4));
- the reserves follow the v5 formula of reserve_groups().

Nothing here knows the wire format, a topic or a grade. A question is an opaque
value. The caller supplies one predicate that says whether a question may be
printed: ``predicate(question, challenge, number)`` returns the refusal codes, an
empty sequence for a usable question. ``challenge`` says whether the question
would be printed as a challenge and ``number`` is the planned position it is
examined for. Every code marks the question bad.

A bad planned question takes a reserve of its own group. A practice reserve may
stand in for a challenge only while at least two real challenges remain, and it
is then printed as an ordinary question; a challenge reserve never fills a
practice slot. What no reserve can fill stays missing: the caller may fill it
later (a repair) or drop it (a shorter sheet, never below ``minimum``). The record
says what was removed, why, and what took its place; it holds numbers, groups,
codes and stage names only, never a question.

This module is named structured_select because lesson_select.py is the selection of
the pre-v5 lesson path, which came in with #635. The two do not share code.

No input, no output, no model call.
"""
from __future__ import annotations

from dataclasses import dataclass, field

PRACTICE, CHALLENGES = "practice", "challenges"
GROUPS = (PRACTICE, CHALLENGES)
MINIMUM_CHALLENGES = 2  # general_source: a sheet prints two to four starred questions
NO_QUESTION = "QUESTION_MISSING"  # the author wrote fewer questions than planned

# Record actions that put a question into a slot that lost its own.
_BY_RESERVE = ("reserve", "reserve_as_practice")
_BY_FILL = ("correction", "repair")       # fill(): B's default origin, and the v5 IR name


def reserve_groups(planned):
    """Practice ×max(3, ceil(0.2·(planned−3))), then challenges ×(1 if planned < 20 else 2).

    N=8 → 3+1, N=12 → 3+1, N=20 → 4+2, N=30 → 6+2 (exact integer arithmetic).
    """
    if type(planned) is not int or planned < 1:
        raise ValueError("planned must be a positive integer")
    practice = max(3, -(-(planned - 3) // 5))   # ceil((planned - 3) / 5)
    return [PRACTICE] * practice + [CHALLENGES] * (1 if planned < 20 else 2)


@dataclass
class Slot:
    """One planned position of the sheet. ``number`` is its planned position and never changes."""
    number: int
    group: str
    concepts: tuple
    question: object = None
    challenge: bool = False     # printed as a challenge
    origin: str = "planned"     # planned | reserve | correction | repair
    judged: bool = False
    dropped: bool = False
    removed: object = None      # the last question taken out of this slot
    codes: tuple = ()           # why it was taken out
    event: dict = field(default=None, repr=False)
    refused_correction: tuple | None = field(default=None, repr=False)

    @property
    def correction_input(self):
        """The last refused candidate, its codes and the stage that judged it (input of a repair prompt)."""
        if self.refused_correction is not None:
            question, codes = self.refused_correction
            return question, codes, "correction"
        return self.removed, self.codes, (self.event or {}).get("stage", "source")

    @property
    def missing(self):
        return self.question is None and not self.dropped


@dataclass
class Reserve:
    number: int
    group: str
    concepts: tuple
    question: object
    used: bool = False          # examined once; never examined or placed again
    codes: tuple = ()


def _entry(row):
    group, question = row["group"], row.get("question")
    if group not in GROUPS:
        raise ValueError("Unknown question group")
    return group, question, tuple(row.get("concepts") or ())


@dataclass(frozen=True)
class Shared:
    """A limit over the whole sheet: at most ``cap`` printed questions with one key.

    ``key(question)`` names something a question prints that the sheet may
    repeat only ``cap`` times (a drawing), or None. Over the limit, the
    questions later in printed order are bad with ``code``; a question
    offered later (a reserve, a correction) is bad when its key is already
    printed ``cap`` times.
    """
    key: object
    cap: int
    code: str
    stage: str = "sheet"


class Selection:
    """The state of one sheet while questions are examined, replaced, filled or dropped.

    ``planned`` and ``reserves`` are sequences of {"group", "question",
    "concepts"}; a planned row whose question is None is a position the
    author left empty. ``shared`` is an optional Shared limit over the whole
    sheet. ``minimum`` (keyword-only, required) is the grade floor: the fewest
    questions a shorter sheet may keep. Call screen() once, then reject(),
    fill() and shorten() as later checks require.
    """

    def __init__(self, planned, reserves, predicate, shared=None, *, minimum):
        if type(minimum) is not int or minimum < 1:
            raise ValueError("minimum must be a positive integer (the grade floor)")
        self.predicate = predicate
        self.shared = shared
        self.minimum = minimum
        self.slots = []
        for number, row in enumerate(planned, 1):
            group, question, concepts = _entry(row)
            self.slots.append(Slot(number, group, concepts, question, challenge=group == CHALLENGES))
        self.reserves = []
        for number, row in enumerate(reserves, 1):
            group, question, concepts = _entry(row)
            if question is not None:
                self.reserves.append(Reserve(number, group, concepts, question))
        self.record = []

    # ------------------------------------------------------------------ reading

    @property
    def planned(self):
        return len(self.slots)

    def slot(self, number):
        if type(number) is not int or not 1 <= number <= len(self.slots):
            raise ValueError("No such planned question")
        return self.slots[number - 1]

    def layout(self):
        """The questions in printed order: ordinary questions, then challenges, each by planned number."""
        present = [slot for slot in self.slots if slot.question is not None]
        return sorted(present, key=lambda slot: (slot.challenge, slot.number))

    def missing(self):
        return [slot.number for slot in self.slots if slot.missing]

    def real_challenges(self):
        return sum(1 for slot in self.slots if slot.question is not None and slot.challenge)

    def reserves_left(self):
        return sum(1 for reserve in self.reserves if not reserve.used)

    # ------------------------------------------------------------------ changes

    def _judge(self, question, challenge, number):
        return tuple(str(code) for code in (self.predicate(question, challenge, number) or ()))

    def _key(self, question):
        try:
            return self.shared.key(question) if self.shared is not None and question is not None else None
        except Exception:  # noqa: BLE001 - a key that cannot be read limits nothing; the render's gate still runs
            return None

    def _full(self, question, slot):
        """The shared limit's code when ``question`` in ``slot`` would print its key once too often, else ()."""
        key = self._key(question)
        if key is None:
            return ()
        printed = sum(1 for other in self.slots
                      if other is not slot and other.question is not None and self._key(other.question) == key)
        return (self.shared.code,) if printed >= self.shared.cap else ()

    def _over(self):
        """The printed questions over the shared limit: all but the first ``cap`` of each key, in printed order."""
        if self.shared is None:
            return []
        seen, over = {}, []
        for slot in self.layout():
            key = self._key(slot.question)
            if key is not None:
                seen[key] = seen.get(key, 0) + 1
                if seen[key] > self.shared.cap:
                    over.append(slot)
        return over

    def _remove(self, slot, codes, stage):
        slot.removed, slot.question, slot.codes, slot.judged = slot.question, None, tuple(codes), False
        slot.event = {"question": slot.number, "group": slot.group, "codes": list(codes), "stage": stage,
                      "action": "missing"}
        self.record.append(slot.event)

    def _place(self, slot, question, origin, challenge, action, **extra):
        slot.question, slot.origin, slot.challenge, slot.judged = question, origin, challenge, True
        slot.refused_correction = None
        if slot.event is not None:
            slot.event.update(action=action, **extra)

    def _take(self, slot, group, challenge):
        """Fill ``slot`` from the unused reserves of ``group`` that pass the predicate."""
        pool = [reserve for reserve in self.reserves if not reserve.used and reserve.group == group]
        # A reserve written for the same concept first, then in the author's order.
        pool.sort(key=lambda reserve: (not set(reserve.concepts) & set(slot.concepts), reserve.number))
        for reserve in pool:
            reserve.used = True
            reserve.codes = self._judge(reserve.question, challenge, slot.number) or self._full(reserve.question, slot)
            if not reserve.codes:
                self._place(slot, reserve.question, "reserve", challenge,
                            "reserve" if group == slot.group else "reserve_as_practice", reserve=reserve.number)
                return True
        return False

    def _refill(self):
        """Give every missing slot a reserve where the rules allow one. Returns the missing positions."""
        for slot in self.slots:
            if slot.missing:
                self._take(slot, slot.group, slot.group == CHALLENGES)
        for slot in self.slots:
            # A practice reserve in a challenge slot is an ordinary question, so
            # two real challenges must already stand without it.
            if slot.missing and slot.group == CHALLENGES and self.real_challenges() >= MINIMUM_CHALLENGES:
                self._take(slot, PRACTICE, False)
        return self.missing()

    def screen(self, stage="source"):
        """Examine every question not yet examined; replace the bad ones. Returns the missing positions."""
        for slot in self.slots:
            if slot.dropped or slot.judged:
                continue
            if slot.question is None:
                if slot.event is None:
                    self._remove(slot, (NO_QUESTION,), stage)
                continue
            codes = self._judge(slot.question, slot.challenge, slot.number)
            if codes:
                self._remove(slot, codes, stage)
            else:
                slot.judged = True
        # The sheet's shared limit: the earliest printed questions keep their key.
        for slot in self._over():
            self._remove(slot, (self.shared.code,), self.shared.stage)
        return self._refill()

    def reject(self, findings, stage="gate"):
        """Take out the questions a later check named: {planned number: codes}. Returns the missing positions."""
        for number, codes in sorted(findings.items()):
            slot = self.slot(number)
            if slot.question is not None:
                self._remove(slot, tuple(codes) or ("REJECTED",), stage)
        return self._refill()

    def fill(self, number, question, origin="correction"):
        """Offer a new question for a missing position. Returns its refusal codes; () when it was placed.

        A refused candidate is kept only as the input of the next repair
        (Slot.correction_input); it is never printed.
        """
        slot = self.slot(number)
        if not slot.missing:
            raise ValueError("Only a missing position can be filled")
        challenge = slot.group == CHALLENGES
        codes = ((self._judge(question, challenge, number) or self._full(question, slot))
                 if question is not None else (NO_QUESTION,))
        if codes:
            if question is not None:
                slot.refused_correction = (question, codes)
            if slot.event is not None:
                slot.event.setdefault("refused", []).append(list(codes))
            return codes
        self._place(slot, question, origin, challenge, origin)
        return ()

    def can_shorten(self):
        """Whether the sheet may be printed without its missing questions: something is missing,
        at least ``minimum`` questions remain, and at least two of them are real challenges."""
        present = sum(1 for slot in self.slots if slot.question is not None)
        return (bool(self.missing()) and present >= self.minimum
                and self.real_challenges() >= MINIMUM_CHALLENGES)

    def shorten(self):
        """Drop the missing positions for good. Returns False, changing nothing, when the rules forbid it."""
        if not self.can_shorten():
            return False
        for slot in self.slots:
            if slot.missing:
                slot.dropped = True
                if slot.event is not None:
                    slot.event["action"] = "dropped"
        return True

    # ------------------------------------------------------------------ record

    def summary(self):
        """Counts only: what a job result or a log line may carry."""
        codes, replaced, dropped = {}, {}, {}
        for event in self.record:
            for code in event["codes"]:
                codes[code] = codes.get(code, 0) + 1
                tally = (dropped if event["action"] == "dropped" else
                         replaced if event["action"] in _BY_RESERVE + _BY_FILL else None)
                if tally is not None:
                    tally[code] = tally.get(code, 0) + 1
        actions = [event["action"] for event in self.record]
        return {"planned": self.planned, "printed": len(self.layout()),
                "replaced": sum(action in _BY_RESERVE + _BY_FILL for action in actions),
                "byReserve": sum(action in _BY_RESERVE for action in actions),
                "byCorrection": sum(action in _BY_FILL for action in actions),
                "dropped": actions.count("dropped"), "missing": len(self.missing()),
                "reservesOffered": len(self.reserves),
                "reservesRefused": sum(1 for reserve in self.reserves if reserve.codes),
                "codes": dict(sorted(codes.items())), "replacedCodes": dict(sorted(replaced.items())),
                "droppedCodes": dict(sorted(dropped.items()))}


def select(planned, reserves, predicate, *, minimum):
    """Selection(...).screen() and return it.

    ``layout()`` is the sheet, ``missing()`` the positions no reserve could
    fill, ``record`` the events. ``minimum`` is the grade floor.
    """
    selection = Selection(planned, reserves, predicate, minimum=minimum)
    selection.screen()
    return selection
