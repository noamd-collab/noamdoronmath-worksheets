import { createHash } from 'node:crypto';
export const GENERATED_GUIDE_PATH = 'headless/astro-poc/src/data/site-guide.v1.json';
const sha = text => createHash('sha256').update(text).digest('hex');
export function jsonChanges(before, after, path = '$', changes = []) {
  if (Object.is(before, after)) return changes;
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const next = Array.isArray(before) ? `${path}[${key}]` : `${path}.${key}`;
      if (!Object.hasOwn(before,key) || !Object.hasOwn(after,key)) changes.push({path:next,before:Object.hasOwn(before,key)?before[key]:{missing:true},after:Object.hasOwn(after,key)?after[key]:{missing:true}});
      else jsonChanges(before[key],after[key],next,changes);
    }
  } else changes.push({path,before,after});
  return changes;
}
/** All non-generated diff sections stay byte-for-byte intact; no code is omitted. */
export function prepareGeneratedJsonReview(rawDiff, beforeText, afterText) {
  const header = `diff --git a/${GENERATED_GUIDE_PATH} b/${GENERATED_GUIDE_PATH}\n`;
  if (!rawDiff.includes(header)) return {text:rawDiff,normalized:false,changes:[]};
  const changes = jsonChanges(JSON.parse(beforeText),JSON.parse(afterText));
  const summary = [header.trimEnd(),
    'Generated JSON semantic diff: complete changed paths/values below; unchanged serialized data is not repeated.',
    `Before full-file SHA-256: ${sha(beforeText)}`,
    `After full-file SHA-256: ${sha(afterText)}`,
    `Total semantic changes: ${changes.length}`,
    ...changes.flatMap(change=>[`@@ ${change.path} @@`,`-${JSON.stringify(change.before)}`,`+${JSON.stringify(change.after)}`]),
    '',
  ].join('\n');
  const sections=rawDiff.split(/(?=^diff --git )/m);
  return {text:sections.map(section=>section.startsWith(header)?summary:section).join(''),normalized:true,changes};
}
