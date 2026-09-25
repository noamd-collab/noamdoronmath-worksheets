/**
 * Execute the Headless viewer back= block with a fake location.
 * The snippet is the live script in worksheet-viewer-noam.html, so a
 * hostname check that never matches production fails these tests.
 */
import vm from 'node:vm';

export const LEGACY_GITHUB_CATALOG =
  'https://noamd-collab.github.io/noamdoronmath-worksheets/?grade=7';

export function viewerBackHref(
  html: string,
  input: {
    hostname: string;
    back: string;
    pathname?: string;
    okGrade?: boolean;
    g?: number;
  }
): string {
  const start = html.indexOf('/* BACK — Headless adapter:');
  const end = html.indexOf('var panel = document.getElementById("panel");');
  if (start < 0 || end < start) {
    throw new Error('viewer back block not found');
  }
  const snippet = html.slice(start, end);
  const page = new URL(`https://${input.hostname}${input.pathname || '/worksheet-viewer-noam.html'}`);
  page.searchParams.set('g', String(input.g ?? 7));
  page.searchParams.set('back', input.back);
  const backBtn = { href: './' };
  const sandbox = {
    location: {
      href: page.href,
      hostname: page.hostname,
      origin: page.origin,
      search: page.search,
    },
    document: {
      getElementById(id: string) {
        return id === 'backBtn' ? backBtn : null;
      },
      createElement() {
        return { className: '', textContent: '', href: '' };
      },
    },
    HEADLESS_LEGACY_PAGES: 'https://noamd-collab.github.io/noamdoronmath-worksheets/',
    okGrade: input.okGrade !== false,
    g: input.g ?? 7,
    URL,
  };
  vm.runInNewContext('"use strict";\n' + snippet, sandbox, {
    filename: 'worksheet-viewer-back.js',
  });
  return backBtn.href;
}
