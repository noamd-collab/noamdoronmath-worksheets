export type ReviewResolvedLoop =
  | { kind: 'concept'; variant: string; marker: string }
  | { kind: 'css'; variant: string; marker: string }
  | { kind: 'film'; marker: string; src: string }
  | { kind: 'component'; variant: string; marker: string };

export interface ReviewEntry {
  slug: string;
  /** Audit section, or "נוסף" for a page the audit missed. */
  section: string;
  /** One Hebrew line: what the new picture teaches. */
  note: string;
}
