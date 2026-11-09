/** Measured-v1 ingestion contract. No rendering, guessed geometry or approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const SHA = /^[a-f0-9]{64}$/;
const MEDIA = /^[a-f0-9]{32}$/;
const copy = value => structuredClone(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b, label) => assert.deepEqual(a, b, `MEASURED_${label}`);

function rectangle(box, pages) {
  assert.ok(box && Number.isSafeInteger(box.page) && box.page >= 1 && box.page <= pages, 'MEASURED_PAGE');
  assert.ok(['x', 'y', 'w', 'h'].every(k => Number.isFinite(box[k])) && box.x >= 0 && box.y >= 0
    && box.w > 0 && box.h > 0 && box.x + box.w <= 1.000001 && box.y + box.h <= 1.000001, 'MEASURED_RECTANGLE');
  assert.ok(!box.mask && !box.masks, 'MEASURED_NO_MASKS');
}

/** Assemble a draft envelope only from raw, SHA-bound measured layout bytes.
 * Media is supplied by the caller. Synthetic identities are permitted only in
 * explicitly marked tests; this function never changes publishable to true.
 */
export function prepareMeasuredManifestDraft(draft, layoutBytes, media) {
  assert.equal(draft?.sourceFormat, 'noam-elementary-layout-site-draft');
  assert.equal(draft.publishable, false);
  assert.ok(Buffer.isBuffer(layoutBytes), 'MEASURED_LAYOUT_BYTES');
  const layout = JSON.parse(layoutBytes.toString('utf8'));
  assert.equal(digest(layoutBytes), draft.binding.layoutSha256, 'MEASURED_LAYOUT_SHA');
  for (const key of ['pdfSha256', 'htmlSha256', 'canonicalSourceSha256']) same(layout[key], draft.binding[key], key);
  assert.ok(MEDIA.test(media?.pdfId || ''), 'MEASURED_MEDIA_ID');
  assert.equal(media.downloadedSha256, draft.binding.pdfSha256, 'MEASURED_MEDIA_SHA');
  assert.equal(media.url, `https://static.wixstatic.com/ugd/d8e7ad_${media.pdfId}.pdf`, 'MEASURED_MEDIA_URL');
  const auxiliary = new Map(layout.auxiliary.map(row => [row.id, row]));
  const margins = new Map(layout.pages.flatMap(page => page.marginBoxes.map((margin, index) =>
    [`page${page.page}-margin${index}`, { role: margin.position, fragments: [{ ...margin, fragment: 1 }] }])));
  const expectedReferences = [];
  for (const [kind, entries] of [['element', Object.entries(layout.elements)], ['auxiliary', [...auxiliary.entries()]], ['margin', [...margins.entries()]]]) {
    for (const [id, node] of entries) for (const fragment of node.fragments) expectedReferences.push(`${kind}:${id}:${fragment.fragment}`);
  }
  same(Object.keys(draft.fragmentLedger).sort(), expectedReferences.sort(), 'RAW_FRAGMENT_COVERAGE');
  const fragments = Object.fromEntries(Object.entries(draft.fragmentLedger).map(([ref, row]) => {
    const node = row.kind === 'element' ? layout.elements[row.ownerId] : row.kind === 'margin' ? margins.get(row.ownerId) : auxiliary.get(row.ownerId);
    const measured = node?.fragments.find(fragment => fragment.fragment === row.fragment);
    assert.ok(measured, 'MEASURED_RAW_FRAGMENT');
    const normalized = measured.bounds.normalized;
    same(row.crop, { page: measured.page, x: normalized.x, y: normalized.y, w: normalized.width, h: normalized.height }, 'RAW_CROP');
    same(row.role, node.role, 'RAW_ROLE');
    const parent = row.kind === 'element' ? node : node?.ownerId ? layout.elements[node.ownerId] : null;
    return [ref, { crop: copy(row.crop), kind: row.kind, role: row.role,
      ownerId: row.ownerId, canonicalOwnerId: row.kind === 'element' ? node?.canonicalId : node?.ownerId ?? null,
      questionId: parent?.questionId ?? null, itemId: parent?.role === 'item' || parent?.role === 'answer-item' ? parent.canonicalId : null,
      fragment: row.fragment, ...(node?.figureId ? { figureId: node.figureId, occurrenceId: node.occurrenceId } : {}) }];
  }));
  const sheet = { ...copy(draft.teacherSheetDraft), pdfId: media.pdfId, pdfUrl: media.url };
  const manifest = { ...copy(draft.manifestDraft), pdfHash: media.pdfId,
    measured: { version: 1, fragments, sheet, wholeQuestions: copy(draft.wholeQuestions),
      figureOccurrences: copy(draft.figureOccurrences), answerParts: copy(draft.answerPartMapDraft) },
    ...(media.syntheticTestFixture === true ? { syntheticTestFixture: true } : {}) };
  validateMeasuredManifest(manifest, { allowDraft: true });
  return manifest;
}

/** Validate one complete measured source. Legacy callers never enter this path. */
export function validateMeasuredManifest(manifest, { allowDraft = false } = {}) {
  assert.equal(manifest?.geometryContract, 'measured-v1', 'MEASURED_VERSION');
  assert.ok(/^[a-z0-9][a-z0-9-]{0,63}$(?![\s\S])/.test(manifest.editionId || '') && manifest.editionId !== 'legacy', 'MEASURED_EDITION');
  assert.ok(/^G[1-9]-T\d{2}$/.test(manifest.prefix || '') && /^(?:[ABE]|E2)$/.test(manifest.levelCode || ''), 'MEASURED_WORKSHEET_ID');
  assert.ok(MEDIA.test(manifest.pdfHash || ''), 'MEASURED_MEDIA_ID');
  for (const key of ['sourceSha256', 'canonicalSourceSha256', 'layoutSha256']) assert.match(manifest[key] || '', SHA, 'MEASURED_SHA');
  if (!allowDraft) {
    assert.equal(manifest.reviewRequired, false, 'MEASURED_UNREVIEWED_DRAFT');
    assert.equal(manifest.publishable, true, 'MEASURED_UNPUBLISHED_DRAFT');
    assert.notEqual(manifest.syntheticTestFixture, true, 'MEASURED_TEST_FIXTURE');
  }
  const measured = manifest.measured;
  assert.equal(measured?.version, 1, 'MEASURED_ENVELOPE_VERSION');
  const sheet = measured.sheet;
  assert.ok(sheet && Array.isArray(sheet.questions) && sheet.questions.length, 'MEASURED_SHEET');
  for (const key of ['sourceSha256', 'canonicalSourceSha256', 'layoutSha256', 'editionId', 'pageCount', 'exercisePageCount', 'answerStartPage']) {
    same(sheet[key], manifest[key], key);
  }
  assert.equal(sheet.geometryContract, 'measured-v1');
  assert.equal(sheet.pdfId, manifest.pdfHash, 'MEASURED_PDF_ID');
  assert.equal(sheet.pdfUrl, `https://static.wixstatic.com/ugd/d8e7ad_${manifest.pdfHash}.pdf`);
  assert.ok(Number.isSafeInteger(sheet.pageCount) && sheet.pageCount > 0);
  assert.ok(Number.isSafeInteger(sheet.exercisePageCount) && sheet.exercisePageCount > 0
    && sheet.exercisePageCount < sheet.answerStartPage && sheet.answerStartPage <= sheet.pageCount, 'MEASURED_ANSWERS');
  const fragments = measured.fragments;
  assert.ok(fragments && typeof fragments === 'object' && !Array.isArray(fragments), 'MEASURED_FRAGMENTS');
  for (const [ref, fragment] of Object.entries(fragments)) {
    assert.ok(ref && fragment && typeof fragment.ownerId === 'string' && Number.isSafeInteger(fragment.fragment) && fragment.fragment > 0, 'MEASURED_FRAGMENT_ID');
    rectangle(fragment.crop, sheet.pageCount);
  }
  function bound(refs, boxes, label, { questionId, itemId, answers = false } = {}) {
    assert.ok(Array.isArray(refs) && Array.isArray(boxes) && refs.length === boxes.length, 'MEASURED_' + label);
    assert.equal(new Set(refs).size, refs.length, 'MEASURED_DUPLICATE_REFERENCE');
    refs.forEach((ref, index) => {
      const f = fragments[ref]; assert.ok(f, 'MEASURED_MISSING_FRAGMENT:' + ref);
      same(boxes[index], f.crop, label + '_CROP');
      if (questionId !== undefined) same(f.questionId, questionId, label + '_QUESTION_OWNER');
      if (itemId !== undefined) same(f.itemId, itemId, label + '_ITEM_OWNER');
      assert.ok(answers ? f.crop.page >= sheet.answerStartPage : f.crop.page <= sheet.exercisePageCount, 'MEASURED_PAGE_SECTION');
    });
  }
  const ownerReferences = (role, key, value) => Object.entries(fragments)
    .filter(([, f]) => f.role === role && f[key] === value).map(([ref]) => ref);
  same(sheet.worksheetInstructionFragmentRefs || [], ownerReferences('worksheet-instructions', 'canonicalOwnerId', null), 'INSTRUCTIONS_COMPLETE');
  const whole = new Map();
  for (const q of measured.wholeQuestions || []) {
    assert.ok(Number.isSafeInteger(q.q) && q.q > 0 && !whole.has(q.q), 'MEASURED_QUESTION_ID');
    bound(q.fragmentRefs, q.crops, 'WHOLE', { questionId: q.canonicalQuestionId });
    same(q.fragmentRefs, ownerReferences('question', 'questionId', q.canonicalQuestionId), 'WHOLE_COMPLETE');
    same(q.contextFragmentRefs, Object.entries(fragments).filter(([, f]) => f.kind === 'auxiliary'
      && f.canonicalOwnerId === q.canonicalQuestionId
      && ['question-prompt', 'section-title', 'table-heading', 'question-table-body', 'figure'].includes(f.role)).map(([ref]) => ref), 'WHOLE_CONTEXT_COMPLETE');
    assert.ok(q.fragmentRefs.length);
    whole.set(q.q, q);
  }
  assert.equal(whole.size, manifest.questionCount, 'MEASURED_QUESTION_COVERAGE');
  const ids = new Set(), canonicalIds = new Set();
  assert.equal(sheet.questions.length, manifest.exercises?.length, 'MEASURED_PART_COVERAGE');
  for (let index = 0; index < sheet.questions.length; index += 1) {
    const q = sheet.questions[index], exercise = manifest.exercises[index];
    assert.match(exercise.canonicalQuestionSha256 || '', SHA, 'MEASURED_QUESTION_SHA');
    assert.match(exercise.sourceExerciseSha256 || '', SHA, 'MEASURED_EXERCISE_SHA');
    assert.equal(typeof exercise.text, 'string', 'MEASURED_EXERCISE_TEXT');
    const taskText = exercise.text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim().normalize('NFC');
    assert.ok(taskText, 'MEASURED_EXERCISE_TEXT');
    assert.equal(digest(Buffer.from(taskText, 'utf8')), exercise.sourceExerciseSha256, 'MEASURED_TASK_TEXT_SHA');
    assert.equal(exercise.id, `${manifest.prefix}-${manifest.levelCode}-Q${String(q.q).padStart(2, '0')}${q.part}`, 'MEASURED_EXERCISE_ID');
    assert.equal(q.id, String(q.q) + q.part, 'MEASURED_PART_ID');
    assert.ok(!ids.has(q.id) && !canonicalIds.has(q.canonicalItemId), 'MEASURED_DUPLICATE_PART');
    ids.add(q.id); canonicalIds.add(q.canonicalItemId);
    const owner = whole.get(q.q); assert.ok(owner && q.canonicalQuestionId === owner.canonicalQuestionId, 'MEASURED_PART_OWNER');
    for (const key of ['q', 'part', 'canonicalQuestionId', 'canonicalItemId']) same(q[key], exercise[key], key);
    bound(q.fragmentRefs, q.rows, 'ROWS', { questionId: q.canonicalQuestionId, itemId: q.canonicalItemId });
    same(q.fragmentRefs, ownerReferences('item', 'itemId', q.canonicalItemId), 'ITEM_COMPLETE');
    assert.ok(q.rows.length); same(q.row, q.rows[0], 'FIRST_ROW');
    same(q.writingSpaceFragmentRefs, ownerReferences('writing-space', 'itemId', q.canonicalItemId), 'WRITING_SPACE_COMPLETE');
    same(q.labelFragmentRefs, ownerReferences('item-label', 'itemId', q.canonicalItemId), 'LABEL_COMPLETE');
    bound(q.contextFragmentRefs, q.contextCrops, 'CONTEXT', { questionId: q.canonicalQuestionId });
    assert.ok(owner.contextFragmentRefs.every(ref => q.contextFragmentRefs.includes(ref)), 'MEASURED_MISSING_QUESTION_CONTEXT');
    bound(q.dependencyFragmentRefs, q.dependencyCrops, 'DEPENDENCIES');
    const dependencies = [...new Set(q.dependencyFragmentRefs.map(ref => fragments[ref].questionId))];
    assert.ok(Array.isArray(q.requiredQuestions) && q.requiredQuestions.every(n => whole.has(n) && n !== q.q), 'MEASURED_REQUIRED_QUESTIONS');
    assert.ok(dependencies.every(id => [...whole.values()].some(w => w.canonicalQuestionId === id && w.q !== q.q)), 'MEASURED_DEPENDENCY_OWNER');
    for (const n of q.requiredQuestions) assert.ok(dependencies.includes(whole.get(n).canonicalQuestionId), 'MEASURED_MISSING_DEPENDENCY');
    for (const id of dependencies) assert.ok(ownerReferences('question', 'questionId', id).every(ref => q.dependencyFragmentRefs.includes(ref)), 'MEASURED_DEPENDENCY_COMPLETE');
    same(q.requiredQuestions, exercise.requiredQuestions, 'REQUIRED_QUESTIONS');
    const anchor = fragments[exercise.pinFragmentRef]; assert.ok(anchor, 'MEASURED_PIN_FRAGMENT');
    same(anchor.itemId, q.canonicalItemId, 'PIN_OWNER');
    same(q.box, Object.fromEntries(['x', 'y', 'w', 'h'].map(k => [k, anchor.crop[k]])), 'MARK_BOX');
    assert.equal(exercise.pin.page, anchor.crop.page, 'MEASURED_PIN_PAGE');
    assert.ok(exercise.pin.x >= anchor.crop.x && exercise.pin.x <= anchor.crop.x + anchor.crop.w
      && exercise.pin.y >= anchor.crop.y && exercise.pin.y <= anchor.crop.y + anchor.crop.h, 'MEASURED_PIN_BOUNDS');
    bound(exercise.itemFragmentRefs, exercise.itemCrops, 'MANIFEST_ITEMS', { itemId: q.canonicalItemId });
    same(exercise.itemFragmentRefs, q.fragmentRefs, 'MANIFEST_ITEMS_COMPLETE');
    bound(exercise.fragmentRefs, exercise.crops, 'PREVIEW');
    same(exercise.fragmentRefs, [...new Set([...(sheet.worksheetInstructionFragmentRefs || []), ...q.dependencyFragmentRefs, ...owner.fragmentRefs])], 'PREVIEW_COMPLETE');
    same(exercise.crop, exercise.crops[0], 'FIRST_PREVIEW');
  }
  for (const [refs, boxes] of [['headerFragmentRefs', 'headerCrops'], ['runningHeaderFragmentRefs', 'runningHeaderCrops'], ['footerFragmentRefs', 'footerCrops']]) {
    // Running headers/footers may also appear on answer pages.
    const r = sheet[refs] || [], b = sheet[boxes] || [];
    assert.equal(r.length, b.length);
    r.forEach((ref, i) => same(fragments[ref]?.crop, b[i], refs));
  }
  assert.equal(sheet.answerSourceSha256, manifest.sourceSha256);
  const answers = sheet.answerMap;
  assert.equal(answers?.version, 1); assert.equal(answers.sourceSha256, manifest.sourceSha256);
  same(answers.questions.map(q => q.q), [...whole.keys()], 'ANSWER_QUESTION_COVERAGE');
  assert.equal(measured.answerParts?.length, sheet.questions.length, 'MEASURED_ANSWER_PARTS');
  measured.answerParts.forEach((part, i) => {
    same(part.canonicalItemId, sheet.questions[i].canonicalItemId, 'ANSWER_PART_OWNER');
    bound(part.fragmentRefs, part.crops, 'ANSWER_PART', { itemId: part.canonicalItemId, answers: true });
    same(part.fragmentRefs, ownerReferences('answer-item', 'itemId', part.canonicalItemId), 'ANSWER_PART_COMPLETE');
  });
  for (const answer of answers.questions) {
    const questionId = whole.get(answer.q).canonicalQuestionId;
    const expected = Object.values(fragments).filter(f => f.role === 'answer-question' && f.questionId === questionId).map(f => f.crop);
    same(answer.crops, expected, 'ANSWER_WHOLE_FRAGMENTS');
    same(answer.parts, sheet.questions.filter(q => q.q === answer.q).map(q => q.part).filter(Boolean), 'ANSWER_LABELS');
  }
  const occurrences = new Map();
  for (const figure of measured.figureOccurrences || []) {
    assert.ok(!occurrences.has(figure.occurrenceId), 'MEASURED_DUPLICATE_FIGURE');
    occurrences.set(figure.occurrenceId, figure);
    bound(figure.fragmentRefs, figure.crops, 'FIGURE', { questionId: figure.questionId, itemId: figure.itemId });
    figure.fragmentRefs.forEach(ref => {
      same(fragments[ref].occurrenceId, figure.occurrenceId, 'FIGURE_OCCURRENCE');
      same(fragments[ref].figureId, figure.figureId, 'FIGURE_ID');
    });
  }
  for (const item of sheet.questions) for (const identity of [...(item.figureOccurrenceIds || []), ...(item.dependencyFigureOccurrenceIds || [])]) {
    assert.ok(occurrences.has(identity), 'MEASURED_MISSING_FIGURE');
  }
  same([...occurrences.keys()], [...new Set(Object.values(fragments).filter(f => f.role === 'figure').map(f => f.occurrenceId))], 'FIGURES_COMPLETE');
  return manifest;
}

export function measuredSheetFromManifest(meta, manifest, options) {
  validateMeasuredManifest(manifest, options);
  assert.equal(meta.pdfId, manifest.pdfHash, 'MEASURED_META_PDF');
  if (meta.editionId) {
    for (const key of ['editionId', 'grade', 'topicId', 'level', 'prefix', 'levelCode', 'canonicalSourceSha256']) {
      same(meta[key], manifest[key], 'META_' + key);
    }
    same(meta.expectedSha256, manifest.sourceSha256, 'META_PDF_SHA');
  }
  return { ...copy(manifest.measured.sheet), case: `catalog-${meta.grade}-${meta.topicId}-${meta.level}${meta.editionId ? '-e-' + meta.editionId : ''}`,
    ...(meta.editionId ? { editionLabel: meta.editionLabel, learningId: meta.learningId, levelLabel: meta.levelLabel } : {}),
    title: meta.title, expectedSha256: manifest.sourceSha256, fragmentLedger: copy(manifest.measured.fragments),
    wholeQuestions: copy(manifest.measured.wholeQuestions), figureOccurrences: copy(manifest.measured.figureOccurrences),
    answerPartMap: copy(manifest.measured.answerParts) };
}

export function measuredQuestionPreview(manifest, options) {
  validateMeasuredManifest(manifest, options);
  return { sourceSha256: manifest.sourceSha256, layoutSha256: manifest.layoutSha256,
    geometryContract: 'measured-v1', exercises: manifest.exercises.map(exercise => {
      const item = {};
      for (const key of ['id', 'q', 'part', 'canonicalItemId', 'canonicalQuestionId', 'crop', 'crops', 'pin', 'pinFragmentRef',
        'canonicalQuestionSha256', 'sourceExerciseSha256', 'fragmentRefs', 'itemCrops', 'itemFragmentRefs', 'contextQuestionNumbers', 'requiredQuestions']) item[key] = copy(exercise[key]);
      return item;
    }) };
}
