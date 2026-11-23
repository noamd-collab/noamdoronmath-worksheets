# Recorded model replies

Nineteen first replies of the author model to real lesson requests, with the
requests, for `bench/replay.py`: fourteen from Qwen and five from Gemini.
`index.json` names the provider, the model, the round and the time of each case.

## Origin

The fourteen Qwen replies are all the raw Qwen first replies that existed on
the development machine on 2026-11-23. They were recorded on 2026-11-22 during
development runs of the generator.

| Cases | Lesson | Round |
| --- | --- | --- |
| `A-*` (5) | ג10, ד07, g7:equations, g8:percentages, g9m:square; level b, 20 questions, 30 minutes | bench round A, about 16:00Z |
| `B-*` (5) | the same five lessons | bench round B, about 21:30Z |
| `T1-triangle`, `T2-triangle` | g8:triangle_parts, level e, 20 questions | two qualification runs, 15:45Z and 15:59Z |
| `S-g4calc`, `S-g7eq` | ד07 with 12 questions; g7:equations with 20 questions; 45 minutes | shared-engine samples, about 09:00Z |

The five Gemini replies (`G-*`) are the live capture of 2026-11-23 from
`gemini-3.8-flash`, one call for each of the five `A-*` lessons with the goal
set to `practice` (the lesson files `gemini-*.json` are the requests as sent).
The engine was at commit `4f902f9c9`: `json_object` mode, the schema and one
reply example in the prompt.

`G-equations` is kept as text. The model finished its reply with a stray
character in place of the brackets that close a question, so the content is
not JSON; the engine rejects it with `PROVIDER_INVALID_RESPONSE`, and the
replay does the same by handing the recorded text to the engine's own reply
reader. `replies/G-equations.repaired.json` is a hand repair of that one
character (declared as `repairedReply`). It is never replayed; it only lets
the question-level report look at the twenty questions.

**The replies were written under earlier prompts.** The Qwen replies come from
development branches whose author prompt differed from the prompt of this
line, and the Gemini replies predate the prompt changes of the integration.
They measure the validators, the answer contract and the gates on real model
output. They do not measure the current prompt; only a live sweep does.

## What is stored

- `lessons/*.json`: the lesson requests, byte for byte as recorded.
- `replies/<case>.json`: the raw first reply, byte for byte as recorded;
  `firstReplySha256` in the index pins it. A reply that is not JSON is
  `replies/<case>.txt` with `firstReplyFormat: "text"` in the index.
- `index.json`: the cases. `corrections` lists recorded correction replies of
  a case; none is stored, because the engine now asks for a different set of
  questions than the ones that were recorded, so they could not be replayed.
- `baseline/`: `results.json` and `summary.md` of `replay.py` on the engine
  commit this corpus was added with, for `--compare`.

Nothing else was copied. The files hold worksheet content only: no key, token,
address or contact detail, and no class label. First names inside word
problems are the model's invented characters.

## The substituted lesson goal

The ten `A-*` and `B-*` lessons were recorded with `lessonGoal: "introduce"`,
which this line rejects before authoring. Their index entries carry

```json
"lessonGoal": {"recordedAs": "introduce", "replayedAs": "practice"}
```

and the replay applies exactly that substitution and repeats the pair in its
results. A lesson without such a pair is replayed as recorded; if the engine
rejects it, the case is reported as a lesson failure.

## Adding a case

Put the lesson and the raw reply in `lessons/` and `replies/`, add an index
entry with its `provider`, and check the content for anything that is not
worksheet text. A
recorded correction reply is used only when its keys are exactly the keys the
engine's correction request requires.
