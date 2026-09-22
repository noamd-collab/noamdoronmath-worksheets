import { WorksheetsClient } from './WorksheetsClient';
import { getGrade, loadCatalog } from '@/lib/catalog/loadCatalog';

export const dynamic = 'force-static';

type PageProps = {
  searchParams: Promise<{ grade?: string }>;
};

export default async function WorksheetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requested = Number(params.grade || 7);
  const grade = Number.isFinite(requested) && requested >= 1 && requested <= 9 ? requested : 7;

  // Phase 1 vertical slice: complete grade-7 catalog only.
  if (grade !== 7) {
    return (
      <main className="wrap">
        <header className="banner">
          <h1>אב־טיפוס כיתה ז׳ בלבד</h1>
          <p>
            בשלב זה מומש רק{' '}
            <a href="/worksheets?grade=7">/worksheets?grade=7</a>. כיתות אחרות יגיעו בשלבים
            הבאים.
          </p>
        </header>
      </main>
    );
  }

  const catalog = loadCatalog();
  const entry = getGrade(catalog, 7);
  const searchTerms = catalog.searchTerms['7'] || {};

  return (
    <main>
      <WorksheetsClient
        catalog={catalog}
        grade={7}
        gradeLabel={entry.label}
        gradeEmoji={entry.emoji || catalog.config.gradeEmojis['7'] || ''}
        groups={entry.groups}
        topics={entry.topics}
        icons={catalog.icons}
        searchTerms={searchTerms}
      />
    </main>
  );
}
