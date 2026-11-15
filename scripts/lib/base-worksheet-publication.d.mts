export function isPdfOnlyTopic(topic: { publicationMode?: unknown }): boolean;
export function basePublicationErrors(
  topic: object, grade: number | string,
  levels: Array<{ key: string; pdfId: string }>, resolvedPrefix?: string | null,
): string[];
