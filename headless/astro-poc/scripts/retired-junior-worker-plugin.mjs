/**
 * Inject the retired-sheet 301 at the start of the Wix worker fetch.
 * @wix/astro-wix-hosting-adapter forces its own server entry, and that entry
 * hands /_files and public HTML to the Cloudflare asset handler before Astro.
 */
import { fileURLToPath } from 'node:url';

const VIRTUAL_ID = 'virtual:retired-junior-edge';
const RESOLVED_ID = '\0virtual:retired-junior-edge';
const FETCH = /const fetch = async \(request, env = \{\}, context\) => \{/;

export function injectRetiredJuniorEdge(code) {
  if (typeof code !== 'string' || !FETCH.test(code)) return null;
  if (code.includes('retiredJuniorEdgeResponse(request)')) return code;
  const imported = code.includes('from "virtual:retired-junior-edge"')
    ? code
    : `import { retiredJuniorEdgeResponse } from "${VIRTUAL_ID}";\n${code}`;
  return imported.replace(
    FETCH,
    `const fetch = async (request, env = {}, context) => {\n\t\tconst retiredJunior = retiredJuniorEdgeResponse(request);\n\t\tif (retiredJunior) return retiredJunior;`,
  );
}

export function retiredJuniorWorkerPlugin() {
  const edgeModule = fileURLToPath(new URL('../src/worker/retiredJuniorEdge.ts', import.meta.url));
  return {
    name: 'retired-junior-worker-redirect',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export { retiredJuniorEdgeResponse } from ${JSON.stringify(edgeModule)};`;
    },
    transform(code, id) {
      if (!id.includes('astro-wix-hosting-adapter') || !id.includes('server.mjs')) return null;
      return injectRetiredJuniorEdge(code);
    },
  };
}
