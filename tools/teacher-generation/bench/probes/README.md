# Notation probes

285 synthetic questions in 25 topic families. Each is one natural way a model
or a teacher writes a question for a catalog topic, with the answer it was
given. They are hypotheses about model habits, not recorded model output.

`run.py` sends every probe through the engine and compares the result with the
outcome recorded in the corpus file, so a fix shows exactly which forms it
unlocks and whether any form prints wrongly. Every probe is either refused or
printed correctly; a wrong print is never recorded.

```sh
python3 tools/teacher-generation/bench/probes/run.py                 # compare; exit 1 on a regression
python3 tools/teacher-generation/bench/probes/run.py --family time --show
python3 tools/teacher-generation/bench/probes/run.py --update        # record the current outcomes
```

## A probe

`corpus/<family>.json` holds the family's probes:

```json
{
 "id": "vertical_arithmetic-06",
 "topic": "ג21",
 "intro": "חשבו וכתבו את השארית.",
 "prompt": "[[47 : 5]] = ___ (שארית ___)",
 "answer": {"kind": "computed", "task": {"kind": "evaluate", "expression": "47 / 5"}, "unit": ""},
 "expect": {"key": ["9", "2"]},
 "recorded": {"outcome": "rejected", "stage": "source", "code": "SOURCE_NOTATION"}
}
```

- `prompt` and `answer` are repeated to fill the question's items; `items`
  gives a list of `[prompt, answer]` pairs instead. `table`, `figure` and
  `drawingFromWords` are passed through.
- `expect` is optional and hand-written: `key` lists the numbers a correct key
  carries, in order (`[]` means no number at all, as for a drawing task);
  `keyContains` and `keyExcludes` list text the key must or must not contain.
  78 probes have one, where the correct key is not the obvious number.
- `recorded` is written by `--update`.

## Outcomes

| Outcome | Meaning |
| --- | --- |
| `rejected` | The engine refused the question: `stage` is `source` (the author's compile path) or `adapter` (the trusted adapter), with the engine's code. |
| `pass` | The question compiled and the print raised no flag. `unverified: true` marks a middle-school prose answer printed as written. |
| `wrong_print` | The question compiled and the print breaks the sheet's invariant. `flags` says how. Never recorded: the engine must refuse that form. |

Flags (`verdict.py`):

| Flag | Meaning |
| --- | --- |
| `key_mismatch` | The key is not the answer in `expect`. |
| `answer_beside_question` | The pupil text ends with the answer itself. |
| `print_adds_numbers` | The pupil text carries numbers the prompt did not: the exercise printed again, revealed after a story or a table, or rewritten. A bare instruction followed by its exercise is the intended print and is not flagged. |
| `one_key_for_several_blanks` | Several blanks to fill, fewer values in the key. |
| `key_repeats_question` | The key only repeats the number that was asked about. |

The rules compare numerals in the source prompt, the printed text and the key.
They are simple on purpose; when a rule misjudges a probe, give the probe an
`expect` entry.

## Recorded state

At the commit that added the corpus: 56 pass, 94 rejected, 135 wrong print
(`print_adds_numbers` 95, `key_mismatch` 30, `answer_beside_question` 28,
`key_repeats_question` 8). Now: 163 pass, 122 rejected, no wrong print.

## Changes the runner reports

- **Wrong print**: any probe that prints wrongly, whatever its recorded
  outcome. Exit 1, and `--update` records nothing.
- **Now rejected**: passed before. Exit 1.
- **Unlocked**: rejected before, prints cleanly now.
- **Print repaired**, **rejected with a different code**, **printed text, key
  or flags changed**: listed for review.

`tests/test_bench_probes.py` runs the whole corpus and fails when any probe
prints wrongly, with any flag. Only `pass` and `rejected` may be recorded.

## How a probe is run

The probe's question fills every slot of a four-question sheet (the smallest
the source contract accepts) for the topic's default lesson, under a neutral
title and rule, and goes through `general_provider.author_general_lesson` with
the transport replaced. If it compiles, `general_adapters.compile_source`
prints it, and the pupil text and key are read from the adapter's own record.
Elementary and middle-school probes run in separate processes, as the engine
isolates its adapter.
