export type WordSheet = { sourceSha256: string; canonicalSourceSha256?: string;
  worksheetInstructions?: string; worksheetInstructionsSha256?: string;
  questions: Record<string, Record<string, unknown>> };
export type WordBank = { sheets: Record<string, WordSheet> };

// Selection consists only of public worksheet identities. Content and answers
// always come from the checked bank; callers cannot inject replacement answers.
export function selectWordQuestions(bank: WordBank, value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error('INVALID_SELECTION');
  const selected: Record<string, unknown>[] = [], missing: string[] = [], seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || !/^[a-f0-9]{32}$/.test(item.pdfId)
      || !Number.isSafeInteger(item.q) || item.q < 1 || item.q > 999
      || !/^[a-f0-9]{64}$/.test(item.sourceSha256)) throw new Error('INVALID_SELECTION');
    const key = item.pdfId + ':' + item.q;
    if (seen.has(key)) continue;
    seen.add(key);
    const sheet = bank.sheets[item.pdfId], question = sheet?.questions[String(item.q)];
    if (!question || sheet.sourceSha256 !== item.sourceSha256) missing.push(key);
    else {
      // Carry only the selected source's instructions, not its other questions
      // or full figure manifest. The checked bank remains the content authority.
      const context = sheet.worksheetInstructions === undefined ? undefined : {
        pdfId: item.pdfId, sourceSha256: sheet.sourceSha256,
        canonicalSourceSha256: sheet.canonicalSourceSha256,
        instructions: sheet.worksheetInstructions,
        instructionsSha256: sheet.worksheetInstructionsSha256,
      };
      selected.push(context ? { ...question, worksheetSource: context } : question);
    }
  }
  // A question that refers to another exercise must not become an incomplete
  // worksheet or silently add an unselected exercise to the download.
  const required = selected.flatMap(question => {
    const pdfId = String(question.id).split(':')[0];
    const instructions = bank.sheets[pdfId].worksheetInstructions || '';
    const dependencies = [...new Set([
      ...(Array.isArray(question.requiredQuestions) ? question.requiredQuestions : []),
      ...[...instructions.matchAll(/(?:ב|מ|ל)?שאלה\s+(\d+)/g)].map(match => Number(match[1])),
    ])];
    return dependencies.filter(q => !seen.has(pdfId + ':' + q)).map(q => ({
      pdfId, q, topic: question.topic, levelLabel: question.levelLabel,
    }));
  });
  return missing.length || required.length ? { questions: [], missing, required } : { questions: selected, missing: [], required: [] };
}
