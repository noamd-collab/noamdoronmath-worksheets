export function isDirectWorksheetPdf(href: string): boolean {
  const path = new URL(href, 'https://www.noamdoronmath.co.il').pathname;
  return /\.pdf$/i.test(path);
}

/** Name a direct file action visibly, without calling an HTML viewer a PDF. */
export function worksheetActionLabel(label: string, href: string): string {
  return isDirectWorksheetPdf(href) && !/\bPDF\b/i.test(label)
    ? `${label} · פתיחת PDF`
    : label;
}
