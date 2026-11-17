/** A first PDF publication is downloadable before question/progress integration. */
export function isPdfOnlyTopic(topic) {
  return topic?.publicationMode === 'pdf-only';
}

/** Validate the explicit marker; missing native metadata alone is not this mode. */
export function basePublicationErrors(topic, grade, levels, resolvedPrefix) {
  if (!Object.hasOwn(topic, 'publicationMode')) return [];
  const errors = [];
  if (!isPdfOnlyTopic(topic)) errors.push('unsupported base publicationMode');
  if (![7, 8, 9].includes(Number(grade))) errors.push('base pdf-only requires middle school');
  if (levels.length !== 3 || levels.map(level => level.key).sort().join(',') !== 'a,b,c' ||
      levels.some(level => !/^[0-9a-f]{32}$/.test(level.pdfId))) {
    errors.push('base pdf-only requires exactly three real a/b/c PDF IDs');
  }
  if (Object.hasOwn(topic, 'x') || Object.hasOwn(topic, 'noamTopicId') || resolvedPrefix ||
      topic.routing?.usesViewer || topic.routing?.aiHintShown || topic.routing?.sourcePrefix) {
    errors.push('base pdf-only cannot declare native/viewer/hint routing');
  }
  return errors;
}
