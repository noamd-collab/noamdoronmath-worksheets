// Synthetic identities only. Never imported by production code or registries.
import { createHash } from 'node:crypto';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
function edition(grade: number, topicId: number, status: string) {
  const editionId = 'test-renewal-r1';
  return { grade, topicId, editionId, label: 'דפים חדשים', status, isDefault: true,
    levels: (['a', 'b', 'c'] as const).map((key, n) => {
      const identity = `test-g${grade}-t${topicId}-${key}`;
      return { key, viewerLevel: ['A', 'B', 'E'][n], pdfId: sha(identity + '-media').slice(0, 32),
        worksheetId: identity + '-' + ['A', 'B', 'E'][n], revision: 1, pdfSha256: sha(identity + '-pdf'),
        canonicalSourceSha256: sha(identity + '-canonical'), manifestSha256: sha(identity + '-manifest'),
        answerMapSha256: sha(identity + '-answers'), wordSourceSha256: sha(identity + '-word'),
        hintsBundleSha256: sha(identity + '-hints') };
    }) };
}
export function editionFixture() {
  return { version: 1, editions: [edition(1, 5, 'published'), edition(2, 28, 'reviewed')] };
}

export function middleEditionFixture() {
  return { version: 1, editions: [
    [7, 17, 'G7-T86'], [8, 14, 'G8-T84'], [8, 15, 'G8-T87'], [9, 7, 'G9-T85'],
  ].map(([grade, topicId, prefix]) => {
    const row = edition(Number(grade), Number(topicId), 'published');
    return { ...row, isDefault: false, nativePrefix: String(prefix), levels: row.levels.map(level => ({
      ...level, nativeExportSha256: sha(`test-native-${prefix}-${level.key}`),
    })) };
  }) };
}
