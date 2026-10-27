/**
 * Hebrew count labels for the worksheets catalog. One topic reads "נושא אחד",
 * never "1 נושאים". Pure strings, so the client and tests share them.
 */
export function topicCountLabel(count: number): string {
  return count === 1 ? 'נושא אחד' : `${count} נושאים`;
}

/** "נושא אחד תואם" / "3 נושאים תואמים". */
export function matchingTopicsLabel(count: number): string {
  return count === 1 ? 'נושא אחד תואם' : `${count} נושאים תואמים`;
}

/** "תוצאה אחת" / "3 תוצאות". */
export function resultCountLabel(count: number): string {
  return count === 1 ? 'תוצאה אחת' : `${count} תוצאות`;
}
