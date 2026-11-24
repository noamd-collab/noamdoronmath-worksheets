"""How the general author's request is laid out, split into parallel parts and joined again.

Nothing here decides what is printed. Every question that comes back is still
examined alone by the Draft's predicate (skill_authoring.question_codes) and
the whole sheet by validate_source; this module only shapes the request and
puts the replies back into the one flat reply the Draft reads.

Layout. The pinned skill documents open the system message as a byte-stable
prefix: the same bytes for every job of one skill version and grade band
(document_prefix), so a provider's prefix cache can serve them. Provenance the
model does not use (file hashes, glossary regexes and source notes) is left out
of the author's copy of the context (trim_context); chronology, the allowed and
not-yet-allowed tools and terms, and the notation contract stay.
request_parts measures every part of a request in characters.

Parts. One Gemini author call takes about a minute, and its time is set by its
output (live round 2: 7.0 ms per output token plus 0.07 ms per input token).
The question plan already fixes concept, group and activity for every slot,
so the plan is split into 2-4 contiguous parts (slice_plan) written by
parallel calls with the same system text and the same plan; each part's
schema asks only for its own rows. The first part also writes the title and
the rule. join() places every returned question at its planned position; a
position with no question stays empty and takes a reserve like any refused
question.

Duplicates. Parts cannot see each other, so after the join a question may not
repeat a question of another part: the same template (the same items in the
same words with other numbers) or most of its typed tasks already asked there
(duplicates). A later planned duplicate is refused by the Draft's predicate
with DUPLICATE_QUESTION; a reserve duplicate is removed before selection.

Errors. A part that fails without a usable reply fails the author attempt as
the single call did; the first part (title and rule) must succeed. A later
part whose reply arrived but cannot be used (REPLY_DEFECTS) loses only its own
positions.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import json
import os
import re

from validation import GenerationError, reject

SLICES_ENV = 'TEACHER_AUTHOR_SLICES'
MAX_PARTS = 4
# Question objects per part when the count is automatic: about 2.9k output
# tokens, about 25 s on gemini-3.8-flash at the measured rate.
UNITS_PER_PART = 9
# A reply arrived but cannot be used as a whole (remote_worker.UNUSABLE_REPLY without REVISION_SCOPE).
REPLY_DEFECTS = frozenset({'PROVIDER_INVALID_RESPONSE', 'INVALID_MODEL_OUTPUT', 'PROVIDER_INCOMPLETE',
                           'PROVIDER_OUTPUT_TOO_LARGE'})
DUPLICATE = 'DUPLICATE_QUESTION'

# ---------------------------------------------------------------------------- layout

DOCUMENTS_HEAD = (
    'Pinned worksheet skill {skill} {version}. Its authoring documents follow in full, each between '
    '<document path="..."> and </document>. They are the authoring rules and the educational context of this '
    'skill. Their instructions about files, scripts, builds, tools and output formats are for the skill\'s own '
    'compiler, not for you. Your task and your output contract follow after the last document.\n\n')


def document_prefix(context):
    """(the byte-stable system prefix, the context without the document texts).

    The prefix depends only on the skill, its pinned version and the document
    texts, never on the lesson. The context keeps the paths so the request
    still names what it was given.
    """
    skill = context.get('skill') if isinstance(context, dict) else None
    documents = skill.get('documents') if isinstance(skill, dict) else None
    if not isinstance(documents, list) or not documents:
        return '', context
    parts = [DOCUMENTS_HEAD.format(skill=skill.get('skillId'), version=skill.get('version'))]
    for doc in documents:
        parts.append(f'<document path="{doc["path"]}">\n{doc["text"].strip()}\n</document>\n\n')
    kept = {**skill, 'documents': [doc['path'] for doc in documents], 'documentsInSystemMessage': True}
    return ''.join(parts), {**context, 'skill': kept}


_TERM_CHRONOLOGY = ('grade', 'track', 'topic', 'subtopic')


def _term(row, chronology):
    kept = {key: row[key] for key in ('id', 'preferred') if key in row}
    start = row.get('allowedFrom')
    if chronology and isinstance(start, dict):
        kept['allowedFrom'] = {key: start[key] for key in _TERM_CHRONOLOGY if start.get(key) is not None}
    return kept


def trim_context(context):
    """The author's copy of the context without what the model does not use.

    Left out: file hashes, the compiler's reference list, the glossary's
    regular expressions and its provenance notes, and the start of terms that
    are already allowed. Kept: the scope, chronology (earlier and later topics,
    when each not-yet-allowed term starts), the allowed and not-yet-allowed
    tools, the forbidden terms, symbols and house spelling, and the teacher
    context. A context of another shape is returned unchanged.
    """
    if not isinstance(context, dict):
        return context
    out = dict(context)
    scope = out.get('scope')
    if isinstance(scope, dict) and isinstance(scope.get('source'), dict):
        out['scope'] = {**scope, 'source': {key: value for key, value in scope['source'].items() if key != 'files'}}
    skill = out.get('skill')
    if isinstance(skill, dict):
        out['skill'] = {key: value for key, value in skill.items()
                        if key not in ('utf8Bytes', 'productionReferencesHandledByCompiler')}
        principles = out['skill'].get('elementaryPrinciples')
        if isinstance(principles, dict):
            out['skill']['elementaryPrinciples'] = {key: value for key, value in principles.items() if key != 'sha256'}
    source = out.get('sourceContext')
    if isinstance(source, dict):
        source = {key: value for key, value in source.items() if key != 'sources'}
        glossary = source.get('glossary')
        if isinstance(glossary, dict):
            glossary = dict(glossary)
            for name in ('previouslyEligibleTerms', 'currentTopicTermsRequiringSelection', 'notYetAllowedTerms',
                         'unresolvedTerms'):
                if isinstance(glossary.get(name), list):
                    glossary[name] = [_term(row, name != 'previouslyEligibleTerms') if isinstance(row, dict) else row
                                      for row in glossary[name]]
            source['glossary'] = glossary
        out['sourceContext'] = source
    return out


def request_parts(body):
    """Characters of each part of one request body: system (documents, contract) and each user key."""
    sizes = {}
    try:
        system, user = body['messages'][0]['content'], body['messages'][1]['content']
    except (KeyError, IndexError, TypeError):
        return sizes
    split = system.rfind('</document>')
    documents = system[:split + len('</document>')] if split >= 0 else ''
    sizes['system.documents'] = len(documents)
    sizes['system.contract'] = len(system) - len(documents)
    try:
        data = json.loads(user)
    except ValueError:
        sizes['user'] = len(user)
        return sizes
    for key, value in data.items():
        if key == 'authoringContext' and isinstance(value, dict):
            for inner, part in value.items():
                sizes[f'user.authoringContext.{inner}'] = len(json.dumps(part, ensure_ascii=False))
        else:
            sizes[f'user.{key}'] = len(json.dumps(value, ensure_ascii=False))
    sizes['total'] = len(system) + len(user)
    return sizes


# ---------------------------------------------------------------------------- parts

def slice_setting(provider_name):
    """The part setting: an int (1 = the single call) or 'auto'.

    TEACHER_AUTHOR_SLICES = 1-4 or auto. Unset or empty: auto for Gemini, whose
    latency was measured, and the single call for Qwen. Anything else fails closed.
    """
    value = (os.environ.get(SLICES_ENV) or '').strip()
    if not value:
        return 'auto' if provider_name == 'gemini' else 1
    if value == 'auto':
        return value
    if value in ('1', '2', '3', '4'):
        return int(value)
    reject('PROVIDER_CONFIG_INVALID', 'TEACHER_AUTHOR_SLICES must be 1 to 4 or auto')


def slice_count(setting, questions, reserves):
    """How many parallel parts write a sheet of ``questions`` planned questions and ``reserves`` reserves."""
    if setting == 'auto':
        units = questions + reserves + 1      # the title and the rule count as one question
        return max(2, min(MAX_PARTS, -(-units // UNITS_PER_PART)))
    return max(1, min(int(setting), MAX_PARTS, questions))


def slice_plan(plan, reserves, parts):
    """Split the plan into ``parts`` contiguous parts of about equal size.

    The units in order are the title and rule, the planned questions, then the
    reserves. Returns one dict per part: its number, whether it writes the
    title and rule, its practice and challenge question numbers and its
    reserve numbers. Every part holds at least one planned question.
    """
    units = [('frame', None)] + [('question', row) for row in plan] + [('reserve', row) for row in reserves]
    parts = max(1, min(parts, len(plan)))
    chunks, start = [], 0
    for index in range(parts):
        stop = start + (len(units) - start) // (parts - index)
        chunks.append(units[start:stop])
        start = stop
    joined = []
    for chunk in chunks:
        if joined and not any(kind == 'question' for kind, _ in chunk):
            joined[-1].extend(chunk)          # a part of reserves only joins the part before it
        else:
            joined.append(list(chunk))
    result = []
    for number, chunk in enumerate(joined, 1):
        rows = [row for kind, row in chunk if kind == 'question']
        result.append({'part': number, 'parts': len(joined), 'writesTitleAndRule': any(kind == 'frame' for kind, _ in chunk),
                       'practiceQuestionNumbers': [row['questionNumber'] for row in rows if row['group'] == 'practice'],
                       'challengeQuestionNumbers': [row['questionNumber'] for row in rows if row['group'] == 'challenges'],
                       'reserveNumbers': [row['reserveNumber'] for kind, row in chunk if kind == 'reserve']})
    return result


SLICE_RULE = (
    ' This request is one part of a sheet that several parts write at the same time from the same questionPlan '
    'and reservePlan. Write only what slice names: the practice questions of slice.practiceQuestionNumbers in '
    'practice and the challenges of slice.challengeQuestionNumbers in challenges, each in the order given and '
    'following its own plan row, and the reserves of slice.reserveNumbers in reserves, following their '
    'reservePlan rows. Write title and rule only when slice.writesTitleAndRule is true; otherwise leave both '
    'fields out. The other parts write the other rows of the same plans: give every question of yours its own '
    'givens, numbers and task structure, distinct from what the other plan rows ask for, and never refer to '
    'another question.')
SLICE_REMINDER = (
    'Put the practice questions that slice names in practice and the challenges that slice names in challenges; '
    'a challenge changes the reasoning, not the number of operations, digits or bracket depth. Put the reserves '
    'that slice names in reserves. Each question has intro and items. Use complete Hebrew words, typed math and '
    'no markup.')


def part_schema(schema, part):
    """The worksheet schema narrowed to one part: its groups and reserves, title and rule for the first part only."""
    props = schema['properties']
    content = {}
    if part['writesTitleAndRule']:
        content['title'], content['rule'] = props['title'], props['rule']
    for group, numbers in (('practice', part['practiceQuestionNumbers']), ('challenges', part['challengeQuestionNumbers'])):
        if numbers:
            content[group] = {**props[group], 'minItems': len(numbers), 'maxItems': len(numbers)}
    if part['reserveNumbers'] and 'reserves' in props:
        count = len(part['reserveNumbers'])
        content['reserves'] = {**props['reserves'], 'minItems': count, 'maxItems': count}
    return {'type': 'object', 'properties': content, 'required': list(content), 'additionalProperties': False,
            '$defs': schema['$defs']}


def part_user(user, part):
    """The user data of one part: the same plans and context, the part's reminder and its slice last."""
    data = {**user, 'finalContractReminder': SLICE_REMINDER}
    data.pop('sourceSchema', None)
    data['slice'] = {key: part[key] for key in ('part', 'parts', 'writesTitleAndRule', 'practiceQuestionNumbers',
                                                'challengeQuestionNumbers', 'reserveNumbers')}
    return data


def part_output_limit(part):
    questions = (len(part['practiceQuestionNumbers']) + len(part['challengeQuestionNumbers'])
                 + len(part['reserveNumbers']))
    # Size the reservation for this part, including its heading and working.
    # Even the maximum of four parts fits the worker's original 40k allowance
    # for a 20-question draft with reserves.
    return 700 + 1150 * questions


def send_parts(bodies, ask):
    """Send every part at once; returns (replies, observed measurements), one per part.

    ``ask(body, observed)`` is the transport. A part whose reply arrived but
    cannot be used (REPLY_DEFECTS) has the reply None. Any other failure of any
    part, and any failure of the first part, is raised after every part has
    ended: the first such part in part order, so the outcome never depends on timing.
    """
    observed = [{} for _ in bodies]
    replies, errors = [None] * len(bodies), [None] * len(bodies)

    def run(index):
        try:
            replies[index] = ask(bodies[index], observed[index])
        except BaseException as exc:  # noqa: BLE001 - re-raised below, in part order
            errors[index] = exc

    with ThreadPoolExecutor(max_workers=len(bodies), thread_name_prefix='author-part') as pool:
        list(pool.map(run, range(len(bodies))))
    for index, error in enumerate(errors):
        if error is None:
            continue
        if index > 0 and isinstance(error, GenerationError) and error.code in REPLY_DEFECTS:
            replies[index] = None
            continue
        error.observed = observed
        raise error
    return replies, observed


def join(plan, parts, replies):
    """One flat reply from the part replies: (reply, the part of each reserve row, the part of each question number).

    Planned positions keep their numbers; a position its part did not fill is
    None. Questions beyond a part's own rows, and its reserves, become reserve
    rows. Title and rule come from the first part; when it has none, the reply
    has none, as a single malformed reply would.
    """
    practice = [row for row in plan if row['group'] == 'practice']
    position = {row['questionNumber']: (row['group'], index) for group in ('practice', 'challenges')
                for index, row in enumerate([r for r in plan if r['group'] == group])}
    merged = {'practice': [None] * len(practice), 'challenges': [None] * (len(plan) - len(practice))}
    reserves, extras, question_parts = [], [], {}
    for part, reply in zip(parts, replies):
        number = part['part']
        if not isinstance(reply, dict):
            continue
        if part['writesTitleAndRule']:
            for key in ('title', 'rule'):
                if key in reply:
                    merged[key] = reply[key]
        for group, numbers in (('practice', part['practiceQuestionNumbers']), ('challenges', part['challengeQuestionNumbers'])):
            written = reply.get(group) if isinstance(reply.get(group), list) else []
            for planned, question in zip(numbers, written):
                _, index = position[planned]
                merged[group][index] = question
                question_parts[planned] = number
            extras.extend(({'group': group, 'question': question}, number) for question in written[len(numbers):])
        rows = reply.get('reserves') if isinstance(reply.get('reserves'), list) else []
        reserves.extend((row, number) for row in rows)
    # The reserves in reservePlan order, then the questions beyond a part's rows, as a single reply orders them.
    merged['reserves'] = [row for row, _ in reserves + extras]
    return merged, [number for _, number in reserves + extras], question_parts


# ---------------------------------------------------------------------------- duplicates

_NUMBER = re.compile(r'\d+(?:\.\d+)?')
_STRUCTURE = re.compile(r'[-+*/^(]|[a-z]{2,}\(')
_MARKS = re.compile(r'[\u0591-\u05c7\s]+')          # niqqud, cantillation and spacing
_FREE = ('kind', 'relation', 'variable', 'unit', 'operation', 'point')


def _leaves(value, path=()):
    if isinstance(value, dict):
        for key in sorted(value):
            yield from _leaves(value[key], path + (key,))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _leaves(item, path + (str(index),))
    elif isinstance(value, str):
        yield path, re.sub(r'\s+', '', value)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        yield path, repr(value)


def _shape(text):
    """Printed text with its numbers as # and without spacing or niqqud."""
    return _NUMBER.sub('#', _MARKS.sub('', text)) if isinstance(text, str) else ''


def task_keys(question):
    """[(exact task, item template, structured)] for each item of a wire question.

    The exact task is the typed task with its spacing removed. The item
    template is the task and the prompt with every number as #: two items
    share it when they ask the same thing in the same words with other
    numbers. ``structured`` is False for a task with no operator (a bare
    value), which two honest questions may share, and for an item with no
    typed task (label, open, review), whose prompt is its only key.
    """
    keys = []
    items = question.get('items') if isinstance(question, dict) else None
    for item in items if isinstance(items, list) else []:
        item = item if isinstance(item, dict) else {}
        answer = item.get('answer') if isinstance(item.get('answer'), dict) else {}
        task = answer.get('task')
        if answer.get('kind') == 'figure':
            task = {key: answer.get(key) for key in ('operation', 'point')}
        prompt = _shape(item.get('prompt'))
        if task is None:
            exact = json.dumps(['text', str(answer.get('kind')), prompt], ensure_ascii=False)
            keys.append((exact, exact, False))
            continue
        leaves = list(_leaves(task))
        exact = json.dumps(leaves, ensure_ascii=False)
        template = json.dumps([[path, value if path[-1:] and path[-1] in _FREE else _NUMBER.sub('#', value)]
                               for path, value in leaves] + [prompt], ensure_ascii=False)
        structured = any(_STRUCTURE.search(value) for path, value in leaves if not (path[-1:] and path[-1] in _FREE))
        keys.append((exact, template, structured))
    return keys


def question_template(question):
    """The whole question's template: its figure kind and shape and every item template in order."""
    keys = task_keys(question)
    if not keys:
        return None
    figure = question.get('figure') if isinstance(question.get('figure'), dict) else {}
    return json.dumps([figure.get('kind'), figure.get('shape'), [template for _, template, _ in keys]], ensure_ascii=False)


def duplicates(merged, reserve_parts, question_parts, plan, read=None):
    """Questions of one part that repeat a question of another part.

    Returns (the planned question objects to refuse, the reply without its
    duplicate reserves, how many were found). A question repeats another
    part's questions when its whole template is the template of one of them
    (the same items in the same words, other numbers), or when most of its
    structured typed tasks are already asked there. Questions are taken in
    sheet order, then the reserves; the earlier one stays. Within one part
    nothing is compared: one call sees its own questions. ``read(question)``
    gives the form to compare (the normalised copy).
    """
    read = read or (lambda question: question)
    seen = []          # (part, exact tasks, template) of every question kept so far
    refused, kept_reserves, found = [], [], 0

    def repeats(part, question):
        form = read(question)
        keys = task_keys(form)
        exact = [key for key, _, structured in keys if structured]
        template = question_template(form)
        asked = set()
        for other, other_exact, other_template in seen:
            if other == part:
                continue
            if template is not None and template == other_template:
                return True, set(exact), template
            asked |= other_exact
        repeated = sum(1 for key in exact if key in asked)
        return bool(exact) and 2 * repeated > len(exact), set(exact), template

    numbers = {group: [row['questionNumber'] for row in plan if row['group'] == group] for group in ('practice', 'challenges')}
    for row in plan:
        question = merged[row['group']][numbers[row['group']].index(row['questionNumber'])]
        part = question_parts.get(row['questionNumber'])
        if not isinstance(question, dict) or part is None:
            continue
        repeated, exact, template = repeats(part, question)
        if repeated:
            refused.append(question)
            found += 1
        else:
            seen.append((part, exact, template))
    for row, part in zip(merged.get('reserves') or [], reserve_parts):
        question = row.get('question') if isinstance(row, dict) else None
        if isinstance(question, dict):
            repeated, exact, template = repeats(part, question)
            if repeated:
                found += 1
                continue
            seen.append((part, exact, template))
        kept_reserves.append(row)
    return refused, {**merged, 'reserves': kept_reserves}, found


# ---------------------------------------------------------------------------- measurements

def _add_usage(total, usage):
    for key, value in (usage or {}).items():
        if type(value) is int:
            total[key] = total.get(key, 0) + value
        elif isinstance(value, dict):
            inner = total.setdefault(key, {})
            for name, count in value.items():
                if type(count) is int:
                    inner[name] = inner.get(name, 0) + count
    return total


def merge_measurements(measured, observed):
    """Fold the parts' transport measurements into the author call's one record.

    The first failing part's record wins for the labels (status, error, finish);
    token counts are summed; the elapsed time is the longest part's.
    """
    failing = next((row for row in observed if row.get('providerError') or row.get('replyDefect')
                    or row.get('timeoutPhase') or row.get('finishReason') not in (None, 'stop')), None)
    base = failing if failing is not None else (observed[0] if observed else {})
    for key, value in base.items():
        if key not in ('usage', 'elapsedSeconds', 'attempts'):
            measured[key] = value
    usage = {}
    for row in observed:
        _add_usage(usage, row.get('usage'))
    measured['usage'] = usage
    elapsed = [row['elapsedSeconds'] for row in observed if type(row.get('elapsedSeconds')) in (int, float)]
    if elapsed:
        measured['elapsedSeconds'] = max(elapsed)
    attempts = [row['attempts'] for row in observed if type(row.get('attempts')) is int]
    if attempts:
        measured['attempts'] = max(attempts)
    measured['responseReceived'] = bool(observed) and all(row.get('responseReceived') is True for row in observed)
    lost = sum(row['replySalvaged'].get('questionsLost', 0) for row in observed
               if isinstance(row.get('replySalvaged'), dict) and type(row['replySalvaged'].get('questionsLost')) is int)
    if lost or any(isinstance(row.get('replySalvaged'), dict) for row in observed):
        measured['replySalvaged'] = {'questionsLost': lost}
    return measured

