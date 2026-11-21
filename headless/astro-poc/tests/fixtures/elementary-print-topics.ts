import reviewedFiles from '../../src/data/elementary-print-worksheets.json';

// The catalog adds only the topic, slug and available levels of the reviewed PDFs.
// The file bytes and assignments are verified in elementary-print-worksheets.test.ts.
export const expectedElementaryPrintTopics = reviewedFiles.map(row => ({
  grade: row.grade,
  topicId: row.topicId,
  slug: row.slug,
  levels: Object.keys(row.levels),
}));
