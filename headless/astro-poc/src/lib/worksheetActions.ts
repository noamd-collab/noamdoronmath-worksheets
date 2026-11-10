/** Name a direct file action visibly, without calling an HTML viewer a PDF. */
export function worksheetActionLabel(label: string, href: string): string {
  const path = new URL(href, 'https://www.noamdoronmath.co.il').pathname;
  return /\.pdf$/i.test(path) && !/\bPDF\b/i.test(label)
    ? `${label} · פתיחת PDF`
    : label;
}
