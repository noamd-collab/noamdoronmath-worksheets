/**
 * Approved Hebrew SEO copy. Proposals stay unused until approved is true.
 */
import proposalFile from '../data/seo-proposals.json';

export type SeoProposal = {
  path: string;
  kind: string;
  title: string;
  description: string;
  approved: boolean;
  currentTitle?: string;
  currentDescription?: string;
  source?: string;
};

const items = (proposalFile as { items: SeoProposal[] }).items;
const byPath = new Map(items.map((item) => [item.path, item]));

export function listSeoProposals(): readonly SeoProposal[] {
  return items;
}

/** Returns replacement title and description only when a person set approved: true. */
export function approvedSeoProposal(path: string | undefined): { title: string; description: string } | null {
  if (!path) return null;
  const row = byPath.get(path);
  if (!row || row.approved !== true) return null;
  if (!row.title || !row.description) return null;
  return { title: row.title, description: row.description };
}
